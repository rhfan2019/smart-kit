/**
 * SmartTable: columns from UI.LineItem, server-side sorting and paging, selection, row navigation, personalization,
 * export and "no data" texts (LR-18–LR-35); phase 2: actions from UI.DataFieldForAction (toolbar, menu buttons,
 * line item actions, partial processing), create and delete, copy, working modes, draft markers (ADR-024).
 * Kernels (ADR-002, ADR-020):
 * - mode "grid": AG Grid, own scrollbar, infinite row model with server blocks (list pages on desktop)
 * - mode "auto": AG Grid with auto height, "More" button or scroll to load (object page sub-tables)
 * - mode "responsive": HTML table scrolling with the page, scroll to load, pop-in by importance (LR Responsiveness)
 */
import { ActionIcon, Alert, Anchor, Button, Group, Menu, Modal, Stack, Text, TextInput, Tooltip } from '@mantine/core';
import {
  capabilitiesFor, isAbortError, isSortable, keyPredicate, matches, resolvePath, sourceInfo, type ActionModel, type FieldModel, type FilterState,
  type Message, type QuerySource, type Row, type SortItem,
} from '@rhfan2019/smart-kit-core';
import { useQueryClient } from '@tanstack/react-query';
import {
  AllCommunityModule, ModuleRegistry, type CellKeyDownEvent, type ColDef, type GridApi, type GridReadyEvent, type IDatasource, type SortChangedEvent,
} from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import { ChevronDown, ChevronRight, Copy, Download, ListCollapse, ListTree, MoreHorizontal, Search, Settings2 } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { actionPaths, isActionAvailable, useActionRunner, type ActionResult } from '../actions/useActionRunner';
import { useService, useSmartKit, useText } from '../context/SmartKitProvider';
import { CreateDialog, createFields, createWith, useEditStrategy } from '../edit/editing';
import { SmartField } from '../field/SmartField';
import { fieldValue, getPath } from '../field/values';
import { useMessages } from '../messages/MessageContext';
import { DraftMarker } from '../object/DraftMarker';
import { smartKitGridTheme } from '../theme/agGrid';
import { applyExtensions, type ExtendEntry } from '../util/extend';
import { usePageState, useStoredState } from '../util/usePageState';
import { useDynamicPage } from '../page/DynamicPage';
import { exportRows } from './exportRows';
import { TableP13nDialog } from './TableP13nDialog';
import { useListQuery } from './useListQuery';
import { InlineCreateRow } from './InlineCreateRow';
import { groupValueOf, ResponsiveTable, type ResponsiveColumn } from './ResponsiveTable';

let gridModulesRegistered = false;

/** Registers AG Grid's modules the first time a grid table renders, not when this module loads (ADR-026 P2, P3). */
function ensureGridModules(): void {
  if (gridModulesRegistered) return;
  ModuleRegistry.registerModules([AllCommunityModule]);
  gridModulesRegistered = true;
}

export interface ColumnItem {
  id: string;
  label: string;
  /** Model field; omitted for custom columns. */
  field?: FieldModel;
  /** Custom cell content. */
  render?(row: Row): ReactNode;
  width?: number;
  /** Extra paths to select for custom columns. */
  select?: string[];
}

export interface ActionItem {
  id: string;
  label: string;
  onPress(ctx: TableContextValue): void;
  /** Disabled while no row is selected (LR-18). */
  requiresSelection?: boolean;
  /** Further enablement check on the selected rows. */
  enabled?(selected: Row[]): boolean;
  /** Menu button the action belongs to (similar actions grouped, LR Table Toolbar). */
  group?: string;
}

export interface ActionGroup {
  id: string;
  label: string;
  /** Action ids (`DataFieldForAction::Namespace.action` or custom ids) shown in the menu. */
  actions: string[];
}

export type TableExtendEntry =
  | (ExtendEntry<ColumnItem> & { kind?: 'column' })
  | (ExtendEntry<ActionItem> & { kind: 'action' });

export interface TableQuery {
  filters: FilterState;
  search: string;
}

export interface SmartTableProps {
  service?: string;
  /** List: entity set. */
  entitySet?: string;
  /** Sub-table: parent entity path and collection navigation. */
  parent?: { path: string; navigation: string };
  mode?: 'grid' | 'auto' | 'responsive';
  /** Applied filters; null means "not executed yet" (shows "To start, set the relevant filters."). Undefined loads without filters. */
  query?: TableQuery | null;
  /** Visible column ids in order (controlled) */
  columns?: string[];
  onColumnsChange?(ids: string[]): void;
  sort?: SortItem[];
  onSortChange?(sort: SortItem[]): void;
  onSelectionChange?(rows: Row[]): void;
  /** Called when the total count becomes known (object page tab counts). */
  onCountChange?(count: number | undefined): void;
  /** Called with the row and its entity path; default: NavigationAdapter.toObject when the adapter has an object page. */
  onRowNavigate?(row: Row, path: string): void;
  /** Whether rows navigate (shows the chevron). Defaults to the adapter's hasObjectPage. */
  navigable?: boolean;
  extend?: TableExtendEntry[];
  title?: string;
  /** Sub-tables: initial rows (default 10) and growth (default 20). */
  growingThreshold?: number;
  growBy?: number;
  /** Key for restoring sort, columns, scroll and selection on back navigation. */
  pageKey?: string;
  /** Grey out the table (filters changed in manual mode). */
  overlay?: boolean;
  exportLimit?: number;
  /** Search field in the toolbar (sub-tables, when searchable). */
  showSearch?: boolean;
  /** Replace the default parts: <SmartTable.Toolbar> etc. */
  children?: ReactNode;
  className?: string;
  /** Menu buttons for similar actions. */
  actionGroups?: ActionGroup[];
  /** Actions from UI.DataFieldForAction (default true). */
  modelActions?: boolean;
  /**
   * Create: "dialog" (list pages; LR Add/Create Using a Dialog), "inline" (a new row at the top; OP inline create),
   * "none". Default: "dialog" for entity sets, "inline" for sub-tables. Only offered when the set is insertable and,
   * for sub-tables, while `editing`.
   */
  createMode?: 'dialog' | 'inline' | 'none';
  /** Called after an object was created (default for lists: navigate to its object page). */
  onCreated?(path: string, row: Row): void;
  /** Offer "Delete" for selected rows when the set is deletable (default: lists always, sub-tables while editing). */
  deletable?: boolean;
  /** Sub-tables: the parent object is in edit mode (enables Add and Delete). */
  editing?: boolean;
  /** "Copy" of the selected rows to the clipboard (default true). */
  copy?: boolean;
  /** "auto" mode: grow with a "More" button (default) or when the end of the table is scrolled into view. */
  growing?: 'button' | 'scroll';
  /** "auto" mode: above this count only a preview is shown with a "Show All (x)" link (OP Tables; default 200). */
  showAllThreshold?: number;
  /** "Show All (x)": default NavigationAdapter.toTable. */
  onShowAll?(): void;
  /** Heading level and style of the title (OP Title Styles). */
  titleLevel?: 2 | 3 | 4 | 5;
  /** Worklist (default): rows refresh after an action; continuous: changed rows stay and are marked (LR Working Modes). */
  workingMode?: 'worklist' | 'continuous';
  /** Called with the loaded rows (e.g. paging buttons of a flexible column layout). */
  onRowsChange?(rows: Row[]): void;
  /** Change this value to reload the table. */
  refreshToken?: number;
  /** Columns instead of UI.LineItem (multiple views with their own LineItem). */
  lineItem?: FieldModel[];
  /** Toolbar content after the title (content switch of multiple views, LR Multiple Views). */
  titleAddon?: ReactNode;
  /** Toolbar content before the settings (table / chart toggle). */
  toolbarEnd?: ReactNode;
}

export interface TableContextValue {
  entitySet: string;
  typeName: string;
  source: QuerySource;
  rows: Row[];
  selected: Row[];
  count?: number;
  filters: FilterState;
  search: string;
  sort: SortItem[];
  refresh(): void;
}

interface InternalCtx {
  p: SmartTableProps;
  ctx: TableContextValue;
  title: string;
  allColumns: ColumnItem[];
  visibleIds: string[];
  setVisibleIds(ids: string[]): void;
  setSort(s: SortItem[]): void;
  actions: ActionItem[];
  copyNow(): void;
  canCopy: boolean;
  copied: string | null;
  details: { available: boolean; shown: boolean; toggle(): void };
  /** Width of the table (px), for the toolbar overflow. */
  width: number;
  openP13n(): void;
  exportNow(): void;
  exporting: boolean;
  search: string;
  setSearch(s: string): void;
  searchable: boolean;
}

const TableCtx = createContext<InternalCtx | null>(null);
function useInternal() {
  const c = useContext(TableCtx);
  if (!c) throw new Error('SmartTable parts must be used inside <SmartTable>');
  return c;
}

/** Context for custom content in and around the table (AC-EXT-02). */
export function useTableContext(): TableContextValue {
  return useInternal().ctx;
}

/** Index of the row at the top of the viewport (getFirstDisplayedRowIndex includes the render buffer). */
function topRowIndex(api: GridApi): number {
  const first = api.getDisplayedRowAtIndex(Math.max(0, api.getFirstDisplayedRowIndex() ?? 0));
  const height = first?.rowHeight || 1;
  return Math.max(0, Math.round(api.getVerticalPixelRange().top / height));
}

function defaultWidth(f: FieldModel | undefined, edmType: string | undefined): number {
  if (f?.kind === 'dataPoint') return f.dataPoint?.visualization === 'Progress' ? 180 : 130;
  if (f?.kind === 'chart') return 160;
  if (edmType === 'Edm.Date') return 130;
  if (edmType === 'Edm.DateTimeOffset') return 180;
  if (edmType && /Decimal|Int|Double|Single/.test(edmType)) return 150;
  return 200;
}

/** Draft administrative paths for markers and the editing status (ADR-018). */
function draftPaths(type: { properties: Record<string, unknown>; navigations: Record<string, { targetType: string }> }): string[] {
  const out = ['IsActiveEntity', 'HasDraftEntity'].filter((p) => p in type.properties);
  if (type.navigations.DraftAdministrativeData) out.push('DraftAdministrativeData/DraftIsCreatedByMe', 'DraftAdministrativeData/InProcessByUser', 'DraftAdministrativeData/LastChangedByUser', 'DraftAdministrativeData/LastChangeDateTime', 'DraftAdministrativeData/CreatedByUser');
  return out;
}

// ---------------------------------------------------------------------------------------------- parts

function TitlePart() {
  const { title, ctx, p } = useInternal();
  const t = useText();
  const level = p.titleLevel ?? 2;
  const Tag = `h${level}` as 'h2';
  return (
    <Tag className={`sk-table__title sk-title--h${level === 2 ? 3 : level}`} data-sk-table-title data-level={level}>
      {ctx.count === undefined ? title : t('table.title', { title, count: ctx.count })}
    </Tag>
  );
}

function ActionsPart() {
  const { actions, ctx, p, width } = useInternal();
  const t = useText();
  // Narrow tables (e.g. the first column of a flexible column layout) move actions into "More" earlier.
  const INLINE = width < 560 ? 0 : width < 900 ? 2 : 4;
  const btn = (a: ActionItem) => {
    const disabled = (a.requiresSelection && ctx.selected.length === 0) || (a.enabled ? !a.enabled(ctx.selected) : false);
    return { disabled, onPress: () => a.onPress(ctx) };
  };
  // Similar actions are grouped into menu buttons (LR Table Toolbar).
  const groups = (p.actionGroups ?? []).map((g) => ({ g, items: actions.filter((a) => a.group === g.id || g.actions.includes(a.id)) })).filter((x) => x.items.length);
  const grouped = new Set(groups.flatMap((x) => x.items.map((a) => a.id)));
  const single = actions.filter((a) => !grouped.has(a.id));
  const inline = single.slice(0, INLINE);
  const overflow = single.slice(INLINE);
  return (
    <>
      {inline.map((a) => {
        const b = btn(a);
        return <Button key={a.id} variant="subtle" disabled={b.disabled} onClick={b.onPress} data-sk-action={a.id}>{a.label}</Button>;
      })}
      {groups.map(({ g, items }) => (
        <Menu key={g.id} position="bottom-end">
          <Menu.Target>
            <Button variant="subtle" rightSection={<ChevronDown className="sk-icon" />} disabled={items.every((a) => btn(a).disabled)} data-sk-action-group={g.id}>{g.label}</Button>
          </Menu.Target>
          <Menu.Dropdown>
            {items.map((a) => { const b = btn(a); return <Menu.Item key={a.id} disabled={b.disabled} onClick={b.onPress} data-sk-action={a.id}>{a.label}</Menu.Item>; })}
          </Menu.Dropdown>
        </Menu>
      ))}
      {overflow.length ? (
        <Menu position="bottom-end">
          <Menu.Target>
            <ActionIcon aria-label={t('table.overflow')} title={t('table.overflow')}><MoreHorizontal className="sk-icon" /></ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            {overflow.map((a) => {
              const b = btn(a);
              return <Menu.Item key={a.id} disabled={b.disabled} onClick={b.onPress} data-sk-action={a.id}>{a.label}</Menu.Item>;
            })}
          </Menu.Dropdown>
        </Menu>
      ) : null}
    </>
  );
}

function SettingsPart() {
  const { openP13n } = useInternal();
  const t = useText();
  return (
    <Tooltip label={t('table.settings')}>
      <ActionIcon onClick={openP13n} aria-label={t('table.settings')} data-sk-table-settings><Settings2 className="sk-icon" /></ActionIcon>
    </Tooltip>
  );
}

function ExportPart() {
  const { exportNow, exporting } = useInternal();
  const t = useText();
  return (
    <Tooltip label={exporting ? t('table.exporting') : t('table.export')}>
      <ActionIcon onClick={exportNow} loading={exporting} aria-label={t('table.export')} data-sk-table-export><Download className="sk-icon" /></ActionIcon>
    </Tooltip>
  );
}

function SearchPart() {
  const { search, setSearch, searchable } = useInternal();
  const t = useText();
  const [draft, setDraft] = useState(search);
  if (!searchable) return null;
  return (
    <form onSubmit={(e) => { e.preventDefault(); setSearch(draft); }} className="sk-table__search">
      <TextInput size="xs" value={draft} onChange={(e) => setDraft(e.currentTarget.value)} onBlur={() => setSearch(draft)} placeholder={t('table.search')} aria-label={t('table.search')} leftSection={<Search className="sk-icon" />} />
    </form>
  );
}

function CopyPart() {
  const { copyNow, canCopy, ctx, copied } = useInternal();
  const t = useText();
  if (!canCopy) return null;
  return (
    <>
      {copied ? <span className="sk-table__status" role="status" data-sk-copy-status>{copied}</span> : null}
      <Tooltip label={t('actions.copy')}>
        <ActionIcon onClick={copyNow} disabled={!ctx.selected.length} aria-label={t('actions.copy')} data-sk-table-copy><Copy className="sk-icon" /></ActionIcon>
      </Tooltip>
    </>
  );
}

function DetailsPart() {
  const { details } = useInternal();
  const t = useText();
  if (!details.available) return null;
  const label = details.shown ? t('table.hideDetails') : t('table.showDetails');
  return (
    <Tooltip label={label}>
      <ActionIcon onClick={details.toggle} aria-label={label} aria-pressed={details.shown} data-sk-table-details>{details.shown ? <ListCollapse className="sk-icon" /> : <ListTree className="sk-icon" />}</ActionIcon>
    </Tooltip>
  );
}

function ToolbarPart({ children, before }: { children?: ReactNode; before?: ReactNode }) {
  const { p } = useInternal();
  return (
    <div className="sk-table__toolbar" role="toolbar">
      {children ?? (
        <>
          <TitlePart />
          {before ?? p.titleAddon}
          <span className="sk-grow" />
          <Group gap="xs" wrap="nowrap" className="sk-table__toolbar-actions">
            {p.showSearch ? <SearchPart /> : null}
            <ActionsPart />
            <CopyPart />
            <DetailsPart />
            {p.toolbarEnd}
            <SettingsPart />
            <ExportPart />
          </Group>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------- table

export function SmartTable(p: SmartTableProps) {
  ensureGridModules();
  const service = useService(p.service);
  const { navigation, intlLocale, timeZone } = useSmartKit();
  const t = useText();
  const page = useDynamicPage();
  const model = service.model;
  const source: QuerySource = useMemo(
    () => (p.parent ? { parent: p.parent.path, navigation: p.parent.navigation } : { entitySet: p.entitySet! }),
    [p.parent?.path, p.parent?.navigation, p.entitySet], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const info = useMemo(() => sourceInfo(model, source), [model, source]);
  const type = model.entityTypes[info.typeName]!;
  const ui = model.ui[info.typeName]!;
  const caps = info.parentSet ? capabilitiesFor(model, info.parentSet, info.navigation) : capabilitiesFor(model, info.entitySet);
  const mode = p.mode ?? (p.parent ? 'auto' : 'grid');
  const responsive = mode === 'responsive';
  const messages = useMessages();
  const draftRoot = !p.parent && Boolean(model.entitySets[info.entitySet]?.draft?.root);

  const lineItem = useMemo(() => {
    if (p.lineItem) return p.lineItem;
    if (!p.parent) return ui.lineItem;
    const parentUi = model.ui[model.entitySets[info.parentSet!]!.typeName]!;
    for (const s of parentUi.sections) for (const sub of s.subSections) {
      if (sub.content.kind === 'table' && sub.content.navigation === info.navigation) return sub.content.columns;
    }
    return ui.lineItem;
  }, [p.parent, p.lineItem, ui, model, info]);

  const allColumns = useMemo(() => {
    const base: ColumnItem[] = lineItem.map((f) => ({ id: f.id, label: f.label, field: f }));
    const colExt = (p.extend ?? []).filter((e) => e.kind !== 'action') as ExtendEntry<ColumnItem>[];
    return applyExtensions(base, colExt, 'SmartTable columns');
  }, [lineItem, p.extend]);
  const modelActions: ActionModel[] = useMemo(() => (p.modelActions === false ? [] : ui.actions), [p.modelActions, ui]);
  const inlineActions = modelActions.filter((a) => a.inline);
  const createMode = p.createMode ?? (p.parent ? 'inline' : 'dialog');
  const canCreate = createMode !== 'none' && caps.insertable && (!p.parent || Boolean(p.editing)) && Boolean(service.dataProvider.create);
  const canDelete = (p.deletable ?? (!p.parent || Boolean(p.editing))) && caps.deletable && Boolean(service.dataProvider.remove);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Row[] | null>(null);

  const stateKey = p.pageKey ? `${p.pageKey}:table` : undefined;
  const [own, setOwn] = usePageState<{ columns: string[]; sort?: SortItem[]; search: string; loaded: number; groupBy?: string | null; details?: boolean }>(stateKey, () => ({ columns: allColumns.map((c) => c.id), search: '', loaded: p.growingThreshold ?? 10 }));
  const visibleIds = (p.columns ?? own.columns).filter((id) => allColumns.some((c) => c.id === id));
  // Columns added by extensions after the state was stored are shown too.
  const known = new Set([...own.columns, ...(p.columns ?? [])]);
  const visible = [...visibleIds, ...allColumns.filter((c) => !known.has(c.id) && !p.columns).map((c) => c.id)];
  const setVisibleIds = (ids: string[]) => { if (!p.columns) setOwn((s) => ({ ...s, columns: ids })); p.onColumnsChange?.(ids); };
  const baseSort = p.sort ?? own.sort ?? ui.presentation.sortOrder;
  const setSort = (s: SortItem[]) => { if (!p.sort) setOwn((x) => ({ ...x, sort: s })); p.onSortChange?.(s); };
  const search = own.search;
  const setSearch = (s: string) => setOwn((x) => ({ ...x, search: s }));

  const visibleColumns = visible.map((id) => allColumns.find((c) => c.id === id)!).filter(Boolean);
  const fields = visibleColumns.map((c) => c.field).filter((f): f is FieldModel => Boolean(f));
  const draftFields = draftRoot ? draftPaths(type) : [];
  const extraSelect = [...visibleColumns.flatMap((c) => c.select ?? []), ...actionPaths(modelActions), ...draftFields, ...(type.etag ? [type.etag] : [])];
  // Responsive table grouping (docs/12 U-5): rows are sorted by the group property first.
  const groupBy = responsive ? own.groupBy ?? null : null;
  const groupPath = groupBy ? allColumns.find((c) => c.id === groupBy)?.field?.path : undefined;
  const filters = p.query?.filters ?? {};
  const effectiveSearch = [p.query?.search, search].filter(Boolean).join(' ');
  const executed = p.query !== null;

  const sort = useMemo(() => (groupPath ? [{ path: groupPath, descending: false }, ...baseSort.filter((x) => x.path !== groupPath)] : baseSort), [groupPath, JSON.stringify(baseSort)]); // eslint-disable-line react-hooks/exhaustive-deps
  const list = useListQuery({
    service: p.service, source, columns: fields, filters, search: effectiveSearch, sort, extraSelect,
    pageSize: responsive ? 20 : Math.max(p.growingThreshold ?? 10, own.loaded), growSize: responsive ? 20 : p.growBy ?? 20, enabled: (mode === 'auto' || responsive) && executed,
  });
  // A new query starts a new selection (rows of the old result may be gone).
  const requestKey = JSON.stringify({ f: list.request.filters, s: list.request.search, o: list.request.orderBy });
  const firstRequest = useRef(requestKey);
  useEffect(() => {
    if (firstRequest.current === requestKey) return;
    firstRequest.current = requestKey;
    setSelected([]);
    apiRef.current?.deselectAll();
  }, [requestKey]);
  const refreshRef = useRef(p.refreshToken);
  useEffect(() => {
    if (refreshRef.current === p.refreshToken) return;
    refreshRef.current = p.refreshToken;
    if (mode === 'grid') setRefreshToken((n) => n + 1);
    else list.refresh();
  }, [p.refreshToken]); // eslint-disable-line react-hooks/exhaustive-deps

  const [selected, setSelected] = useState<Row[]>([]);
  // Continuous working mode: rows changed by actions stay in the list and are marked (LR Working Modes).
  const [overrides, setOverrides] = useState<Record<string, Row>>({});
  const [gridRows, setGridRows] = useState<Row[]>([]);
  const [gridCount, setGridCount] = useState<number | undefined>();
  const [gridError, setGridError] = useState<Error | null>(null);
  const [gridEmpty, setGridEmpty] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const apiRef = useRef<GridApi | null>(null);
  const queryClient = useQueryClient();

  const keyOf = useCallback((row: Row) => keyPredicate(type, row), [type]);
  const pathOf = useCallback((row: Row) => ('entitySet' in source ? `${source.entitySet}${keyOf(row)}` : `${source.parent}/${source.navigation}${keyOf(row)}`), [source, keyOf]);
  const navigable = p.navigable ?? Boolean(p.onRowNavigate || navigation?.hasObjectPage?.(info.entitySet, service.name));
  const navigate = useCallback((row: Row) => {
    const path = pathOf(row);
    if (p.onRowNavigate) p.onRowNavigate(row, path);
    else navigation?.toObject(path, service.name);
  }, [p, pathOf, navigation, service.name]);

  // Restore selection and scroll position (NAV-04).
  const stored = useStoredState<{ selectedKeys: string[]; firstRow: number }>(stateKey ? `${stateKey}:view` : undefined);
  const restore = useRef(stored.read());

  const listRows = useMemo(() => (mode === 'grid' ? [] : list.rows.map((r) => overrides[keyOf(r)] ?? r)), [mode, list.rows, overrides, keyOf]);
  const ctx: TableContextValue = {
    entitySet: info.entitySet, typeName: info.typeName, source,
    rows: mode === 'grid' ? gridRows : listRows, selected,
    count: mode === 'grid' ? gridCount : list.count,
    filters, search: effectiveSearch, sort,
    refresh: () => { setOverrides({}); if (mode === 'grid') setRefreshToken((n) => n + 1); else list.refresh(); },
  };
  const onCountChange = p.onCountChange;
  useEffect(() => { onCountChange?.(ctx.count); }, [ctx.count, onCountChange]);
  const onRowsChange = p.onRowsChange;
  useEffect(() => { onRowsChange?.(ctx.rows); }, [ctx.rows, onRowsChange]);

  // ------------------------------------------------------------------ actions (ADR-024)
  const semanticKey = ui.semanticKey.length ? ui.semanticKey : type.keys;
  const targetOf = useCallback((row: Row) => ({ row, path: pathOf(row), label: semanticKey.map((k) => String(row[k] ?? '')).join(' / ') }), [pathOf, semanticKey]);
  const afterAction = (r: ActionResult) => {
    if (!r.processed.length) return;
    if ((p.workingMode ?? 'worklist') === 'continuous') {
      const next: Record<string, Row> = {};
      const out: Message[] = [];
      for (const x of r.processed) {
        const merged = { ...x.target.row, ...(x.row ?? {}) };
        const k = keyOf(x.target.row);
        next[k] = merged;
        const fits = Object.entries(filters).every(([path, conds]) => matches(getPath(merged, path), conds, resolvePath(model.entityTypes, info.typeName, path).property?.edmType ?? 'Edm.String'));
        if (!fits) out.push({ id: `nm-${k}-${Date.now()}`, type: 'info', message: t('table.noLongerMatches', { item: x.target.label }), source: 'server' });
        apiRef.current?.getRowNode(k)?.setData(merged);
      }
      setOverrides((o) => ({ ...o, ...next }));
      messages?.add(out);
      setSelected((sel) => sel.map((row) => next[keyOf(row)] ?? row));
    } else {
      ctx.refresh();
      setSelected([]);
      apiRef.current?.deselectAll();
    }
  };
  const runner = useActionRunner({ service: p.service, onDone: afterAction });
  const actions = useMemo(() => {
    const base: ActionItem[] = [];
    if (canCreate) base.push({ id: 'Create', label: t('actions.create'), onPress: () => setCreating(true) });
    for (const a of modelActions.filter((x) => !x.inline)) {
      base.push({
        id: a.id, label: a.label, requiresSelection: a.bound,
        enabled: (sel) => !a.bound || sel.some((r) => isActionAvailable(a, r)),
        onPress: (c) => runner.run(a, a.bound ? c.selected.map(targetOf) : [{ row: {}, path: '', label: '' }]),
      });
    }
    if (canDelete) base.push({ id: 'Delete', label: t('actions.delete'), requiresSelection: true, onPress: (c) => setConfirmDelete(c.selected) });
    return applyExtensions<ActionItem>(base, (p.extend ?? []).filter((e) => e.kind === 'action') as ExtendEntry<ActionItem>[], 'SmartTable actions');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runner is stable enough; rebuilt with its inputs
  }, [p.extend, modelActions, canCreate, canDelete, t, targetOf]);
  const inlineCell = inlineActions.length ? (row: Row) => (
    <Group gap={4} wrap="nowrap" data-sk-inline-actions>
      {inlineActions.filter((a) => isActionAvailable(a, row)).map((a) => (
        <Button key={a.id} size="compact-xs" variant="light" onClick={(e) => { e.stopPropagation(); runner.run(a, [targetOf(row)]); }} data-sk-inline-action={a.id}>{a.label}</Button>
      ))}
    </Group>
  ) : undefined;

  // ------------------------------------------------------------------ copy (LR-21)
  const [copied, setCopied] = useState<string | null>(null);
  const valueCtx = { model, typeName: info.typeName, locale: intlLocale, timeZone };
  const copyNow = () => {
    const cols = visibleColumns.filter((c) => c.field);
    const lines = [cols.map((c) => c.label).join('\t'), ...selected.map((r) => cols.map((c) => fieldValue(valueCtx, c.field!, r).display.replace(/[\t\n]/g, ' ')).join('\t'))];
    void navigator.clipboard?.writeText(lines.join('\n')).then(() => {
      setCopied(t('actions.copied', { count: selected.length }));
      setTimeout(() => setCopied(null), 4000);
    });
  };

  // ------------------------------------------------------------------ create and delete
  const strategy = useEditStrategy(info.entitySet, p.service);
  const onCreated = (path: string, row: Row, ms: Message[]) => {
    messages?.add([...ms, { id: `created-${Date.now()}`, type: 'success', message: t('create.done'), source: 'server' }]);
    setCreating(false);
    ctx.refresh();
    if (p.onCreated) p.onCreated(path, row);
    else if (!p.parent && navigation?.hasObjectPage?.(info.entitySet, service.name)) navigation.toObject(path, service.name);
  };
  const createChild = async (values: Row) => {
    const r = await service.dataProvider.create!(source, values);
    onCreated(r.path, r.row, r.messages ?? []);
  };
  const createRoot = async (values: Row) => {
    const r = await createWith(strategy, source, values);
    onCreated(r.path, r.row, r.messages);
  };
  const deleteNow = async (rows: Row[]) => {
    setConfirmDelete(null);
    const out: Message[] = [];
    let done = 0;
    for (const row of rows) {
      try {
        const r = await service.dataProvider.remove!(pathOf(row), { etag: row['@odata.etag'] as string | undefined });
        out.push(...(r.messages ?? []));
        done++;
      } catch (e) {
        out.push({ id: `del-${Date.now()}-${done}`, type: 'error', message: (e as Error).message, source: 'server' });
      }
    }
    if (done) out.unshift({ id: `deleted-${Date.now()}`, type: 'success', message: done === 1 ? t('delete.done') : t('delete.doneMany', { count: done }), source: 'server' });
    messages?.add(out);
    setSelected([]);
    apiRef.current?.deselectAll();
    ctx.refresh();
  };
  // Ctrl+Enter creates a new row in sub-tables (OP Create and edit subobjects).
  const sectionRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = sectionRef.current;
    if (!el || !canCreate) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !(e.target as HTMLElement).closest('[data-sk-inline-create]')) { e.preventDefault(); setCreating(true); } };
    el.addEventListener('keydown', onKey);
    return () => el.removeEventListener('keydown', onKey);
  }, [canCreate, createMode]);
  // Sticky column headers below the sticky toolbar (LR Sticky Behavior, responsive table).
  useEffect(() => {
    const el = sectionRef.current;
    const bar = el?.querySelector<HTMLElement>(':scope > .sk-table__toolbar');
    if (!el || !bar || !responsive || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => el.style.setProperty('--sk-table-toolbar-height', `${bar.offsetHeight}px`));
    ro.observe(bar);
    return () => ro.disconnect();
  }, [responsive]);
  const marker = draftRoot ? (row: Row) => <DraftMarker row={row} compact /> : undefined;
  const latest = useRef({ ctx, p, navigate, sort });
  latest.current = { ctx, p, navigate, sort };

  const colDefs = useMemo<ColDef[]>(() => {
    const defs: ColDef[] = visibleColumns.map((c, i) => {
      const prop = c.field?.path ? model.entityTypes[info.typeName] && type.properties[c.field.path] : undefined;
      const sortPath = c.field?.kind === 'field' ? c.field.path : undefined;
      const s = sort.find((x) => x.path === sortPath);
      return {
        colId: c.id,
        headerName: c.label,
        width: c.width ?? defaultWidth(c.field, prop?.edmType),
        minWidth: 80,
        pinned: i === 0 && mode === 'grid' ? 'left' : undefined,
        sortable: Boolean(sortPath && isSortable(caps, sortPath)),
        sort: s ? (s.descending ? 'desc' : 'asc') : null,
        resizable: true,
        type: prop && /Int|Decimal|Double|Single|Byte/.test(prop.edmType) && c.field?.kind === 'field' ? 'rightAligned' : undefined,
        cellRenderer: (params: { data?: Row }) => (params.data ? (
          <span className={i === 0 && marker ? 'sk-cell--with-marker' : undefined}>
            {c.render ? c.render(params.data) : <SmartField typeName={info.typeName} service={p.service} field={c.field!} row={params.data} cell />}
            {i === 0 && marker ? marker(params.data) : null}
            {i === 0 && overridesRef.current[keyOf(params.data)] ? <span className="sk-table__changed" data-sk-changed-marker>{t('table.changedItem')}</span> : null}
          </span>
        ) : null),
        context: { sortPath },
      } satisfies ColDef;
    });
    if (inlineCell) {
      defs.push({
        colId: '$actions', headerName: t('actions.inline'), width: 160, sortable: false, resizable: false, suppressMovable: true,
        cellRenderer: (params: { data?: Row }) => (params.data ? inlineCell(params.data) : null),
      });
    }
    if (navigable) {
      defs.push({
        colId: '$nav', headerName: '', width: 52, pinned: 'right', sortable: false, resizable: false, suppressMovable: true,
        headerComponentParams: { 'aria-label': t('table.navigate') },
        cellRenderer: (params: { data?: Row }) => (params.data ? (
          <ActionIcon className="sk-table__nav" aria-label={t('table.navigate')} onClick={() => latest.current.navigate(params.data!)} data-sk-row-nav>
            <ChevronRight className="sk-icon" />
          </ActionIcon>
        ) : null),
      });
    }
    return defs;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- column definitions depend on visible columns, sort indicator and navigability only
  }, [visible.join('|'), allColumns, navigable, JSON.stringify(sort), intlLocale, timeZone, mode, Boolean(inlineCell), Boolean(marker)]);
  const overridesRef = useRef(overrides);
  overridesRef.current = overrides;

  // Grid datasource: one block per request, first block with $count.
  const datasource = useMemo<IDatasource | null>(() => {
    if (mode !== 'grid' || !executed) return null;
    return {
      getRows: async (params) => {
        const top = params.endRow - params.startRow;
        const req = list.pageRequest(params.startRow, top, params.startRow === 0);
        try {
          const res = await queryClient.fetchQuery({
            queryKey: ['smart-kit', 'grid', service.name, JSON.stringify(req), refreshToken],
            queryFn: ({ signal }) => service.dataProvider.query(req, { signal }),
            staleTime: 10_000,
          });
          const last = res.count ?? (res.rows.length < top ? params.startRow + res.rows.length : undefined);
          params.successCallback(res.rows, last);
          if (params.startRow === 0) {
            setGridCount(res.count);
            setGridEmpty(res.rows.length === 0);
            setGridError(null);
          }
          setGridRows((prev) => (params.startRow === 0 ? res.rows : [...prev, ...res.rows]));
          const r = restore.current;
          if (r && apiRef.current) {
            const api = apiRef.current;
            api.forEachNode((n) => { if (n.data && r.selectedKeys.includes(keyOf(n.data as Row))) n.setSelected(true); });
            const target = last === undefined ? r.firstRow : Math.min(r.firstRow, last - 1);
            if (target > 0) {
              // Scroll there (this loads the block holding the row); once that block is in, scroll again precisely.
              setTimeout(() => api.ensureIndexVisible(target, 'top'), 0);
              if (params.startRow <= target && target < params.endRow) restore.current = { ...r, firstRow: 0 };
            } else if (params.startRow === 0) restore.current = r.selectedKeys.length ? { ...r, firstRow: 0 } : undefined;
          }
        } catch (e) {
          if (!isAbortError(e)) {
            setGridError(e as Error);
            params.failCallback();
          }
        }
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rebuild when the request changes
  }, [mode, executed, JSON.stringify(list.request), refreshToken]);

  useEffect(() => {
    const api = apiRef.current;
    if (!api || mode !== 'grid') return;
    if (datasource) api.setGridOption('datasource', datasource);
    else { setGridRows([]); setGridCount(undefined); setGridEmpty(false); }
  }, [datasource, mode]);

  const saveView = () => {
    const api = apiRef.current;
    if (!stateKey || !api || api.isDestroyed()) return;
    stored.write({ selectedKeys: ((api.getSelectedRows() ?? []) as Row[]).map(keyOf), firstRow: mode === 'grid' ? topRowIndex(api) : 0 });
  };
  useEffect(() => () => saveView(), []); // eslint-disable-line react-hooks/exhaustive-deps -- store on unmount

  const [p13n, setP13n] = useState(false);
  const [exporting, setExporting] = useState(false);
  const exportNow = async () => {
    setExporting(true);
    try {
      await exportRows({
        service, typeName: info.typeName, columns: visibleColumns, title: p.title ?? ui.headerInfo.typeNamePlural,
        pageRequest: list.pageRequest, limit: p.exportLimit ?? 10_000, locale: intlLocale, timeZone, t,
      });
    } finally {
      setExporting(false);
    }
  };

  const title = p.title ?? ui.headerInfo.typeNamePlural;
  const searchable = caps.searchable;
  const [hiddenCols, setHiddenCols] = useState<string[]>([]);
  const [width, setWidth] = useState(1440);
  useEffect(() => {
    const el = sectionRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth || 1440));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const internal: InternalCtx = {
    p, ctx, title, allColumns, visibleIds: visible, setVisibleIds, setSort, actions, openP13n: () => setP13n(true),
    exportNow: () => void exportNow(), exporting, search, setSearch, searchable,
    copyNow, canCopy: p.copy !== false, copied, width,
    details: { available: responsive && hiddenCols.length > 0, shown: Boolean(own.details), toggle: () => setOwn((x) => ({ ...x, details: !x.details })) },
  };

  const error = mode === 'grid' ? gridError : list.error;
  const empty = mode === 'grid' ? gridEmpty : executed && !list.isLoading && list.rows.length === 0 && !list.error;
  const threshold = p.showAllThreshold ?? 200;
  const preview = mode === 'auto' && list.count !== undefined && list.count > threshold;
  const scrollGrowing = mode === 'auto' && p.growing === 'scroll' && !preview;
  const growRef = useRef<HTMLDivElement>(null);
  const latestList = useRef(list);
  latestList.current = list;
  useEffect(() => {
    const el = growRef.current;
    if (!el || !scrollGrowing || typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver(([e]) => {
      const l = latestList.current;
      if (e!.isIntersecting && l.hasMore && !l.isFetching) { l.loadMore(); setOwn((s) => ({ ...s, loaded: l.rows.length + (p.growBy ?? 20) })); }
    }, { rootMargin: '0px 0px 120px 0px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, [scrollGrowing, list.rows.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const noDataText = !executed ? t('table.noData.start') : p.parent ? t('table.noData.empty') : t('table.noData.notFound');

  const onSortChanged = (e: SortChangedEvent) => {
    const next = e.api.getColumnState().filter((s) => s.sort).sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0))
      .map((s) => ({ path: (e.api.getColumn(s.colId)?.getColDef().context as { sortPath?: string } | undefined)?.sortPath ?? s.colId, descending: s.sort === 'desc' }));
    if (JSON.stringify(next) !== JSON.stringify(latest.current.sort)) setSort(next);
  };

  const responsiveColumns: ResponsiveColumn[] = visibleColumns.map((c) => {
    const prop = c.field?.path ? type.properties[c.field.path] : undefined;
    return {
      id: c.id,
      label: c.label,
      importance: c.field?.importance ?? (c.field?.isSemanticKey ? 'High' : 'Medium'),
      align: prop && /Int|Decimal|Double|Single|Byte/.test(prop.edmType) && c.field?.kind === 'field' ? 'end' : undefined,
      render: (row: Row) => (c.render ? c.render(row) : c.field ? <SmartField typeName={info.typeName} service={p.service} field={c.field} row={row} cell /> : null),
      groupValue: c.field ? (row: Row) => fieldValue(valueCtx, c.field!, row).display || groupValueOf(c.field!.path ?? '')(row) : undefined,
    };
  });
  const selectedKeys = useMemo(() => new Set(selected.map(keyOf)), [selected, keyOf]);
  const responsiveTable = responsive ? (
    <ResponsiveTable
      label={title}
      columns={responsiveColumns}
      rows={listRows}
      keyOf={keyOf}
      selectable
      selectedKeys={selectedKeys}
      onSelectionChange={(keys) => { const rows = listRows.filter((r) => keys.has(keyOf(r))); setSelected(rows); p.onSelectionChange?.(rows); }}
      navigable={navigable}
      onNavigate={navigate}
      hasMore={list.hasMore}
      loading={list.isFetching}
      loadMore={list.loadMore}
      showDetails={Boolean(own.details)}
      groupBy={groupBy ?? undefined}
      noData={noDataText}
      inlineActions={inlineCell}
      changedKeys={new Set(Object.keys(overrides))}
      rowMarker={marker}
      onHiddenColumnsChange={setHiddenCols}
    />
  ) : null;

  const grid = responsive ? null : (
    <AgGridReact
      theme={smartKitGridTheme}
      containerStyle={mode === 'grid' ? { position: 'absolute', inset: 0 } : { width: '100%' }}
      columnDefs={colDefs}
      {...(mode === 'grid'
        ? { rowModelType: 'infinite' as const, cacheBlockSize: 100, maxBlocksInCache: 50, infiniteInitialRowCount: 1 }
        : { rowData: list.rows, domLayout: 'autoHeight' as const })}
      getRowId={(r) => keyOf(r.data as Row)}
      rowSelection={{ mode: 'multiRow', checkboxes: true, headerCheckbox: mode === 'auto', enableClickSelection: false }}
      selectionColumnDef={{ pinned: 'left', width: 48, resizable: false, suppressHeaderMenuButton: true }}
      suppressCellFocus={false}
      suppressColumnVirtualisation={mode === 'auto'}
      animateRows={false}
      ensureDomOrder
      localeText={{ loadingOoo: t('table.loading'), noRowsToShow: noDataText, ariaRowSelect: t('table.selectRow'), ariaChecked: t('common.yes'), ariaUnchecked: t('common.no') }}
      overlayNoRowsTemplate={undefined}
      suppressNoRowsOverlay
      onGridReady={(e: GridReadyEvent) => {
        apiRef.current = e.api;
        if (mode === 'grid' && datasource) e.api.setGridOption('datasource', datasource);
      }}
      onFirstDataRendered={(e) => {
        const r = restore.current;
        if (mode === 'auto' && r) {
          e.api.forEachNode((n) => { if (n.data && r.selectedKeys.includes(keyOf(n.data as Row))) n.setSelected(true); });
          restore.current = undefined;
        }
      }}
      onSelectionChanged={(e) => {
        const rows = e.api.getSelectedRows() as Row[];
        setSelected(rows);
        p.onSelectionChange?.(rows);
        saveView();
      }}
      onBodyScroll={(e) => { if (mode === 'grid' && e.direction === 'vertical') page?.contentScrolled(e.top); }}
      onBodyScrollEnd={() => saveView()}
      onSortChanged={onSortChanged}
      onColumnMoved={(e) => {
        if (!e.finished) return;
        const ids = e.api.getColumnState().map((s) => s.colId).filter((id) => id !== '$nav' && !id.startsWith('ag-Grid'));
        setVisibleIds(ids);
      }}
      onRowDoubleClicked={(e) => { if (navigable && e.data) navigate(e.data as Row); }}
      onCellKeyDown={(e: CellKeyDownEvent) => {
        const ev = e.event as KeyboardEvent | undefined;
        if (ev?.key === 'Enter' && navigable && e.data && e.column.getColId() !== '$nav') navigate(e.data as Row);
      }}
    />
  );

  return (
    <TableCtx.Provider value={internal}>
      <section ref={sectionRef} className={['sk-table', `sk-table--${mode}`, p.className].filter(Boolean).join(' ')} aria-label={title} data-sk-table={info.entitySet} aria-busy={list.isFetching || undefined}>
        {p.children ?? <ToolbarPart />}
        {error ? (
          <Alert color="red" variant="light" className="sk-table__error" role="alert">{t('table.error', { message: error.message })}</Alert>
        ) : null}
        {creating && createMode === 'inline' && p.parent ? (
          <InlineCreateRow service={p.service} typeName={info.typeName} fields={createFields(model, info.typeName, lineItem)} onCreate={createChild} onCancel={() => setCreating(false)} />
        ) : null}
        <div className="sk-table__body">
          {grid}
          {responsiveTable}
          {(!executed || empty) && !error && !responsive ? <div className="sk-table__nodata" data-sk-nodata><Text c="dimmed">{noDataText}</Text></div> : null}
          {!executed && responsive ? <div className="sk-table__nodata sk-rtable__nodata" data-sk-nodata><Text c="dimmed">{noDataText}</Text></div> : null}
          {p.overlay ? <div className="sk-table__overlay" data-sk-overlay><Text>{t('page.overlay')}</Text></div> : null}
          {list.isFetching && mode === 'auto' && list.rows.length === 0 ? <div className="sk-table__busy" role="status" aria-label={t('table.loading')} data-sk-busy /> : null}
        </div>
        {preview ? (
          <div className="sk-table__show-all">
            <Anchor component="button" type="button" onClick={() => (p.onShowAll ? p.onShowAll() : p.parent && navigation?.toTable?.(p.parent.path, p.parent.navigation, service.name))} data-sk-show-all>
              {t('table.showAll', { count: list.count! })}
            </Anchor>
          </div>
        ) : null}
        {scrollGrowing ? <div ref={growRef} className="sk-table__grow-sentinel" aria-hidden data-sk-grow-sentinel /> : null}
        {mode === 'auto' && list.hasMore && !preview && !scrollGrowing ? (
          <Button variant="subtle" fullWidth className="sk-table__more" loading={list.isFetching} onClick={() => { list.loadMore(); setOwn((s) => ({ ...s, loaded: list.rows.length + (p.growBy ?? 20) })); }} data-sk-more>
            {list.count !== undefined ? t('table.moreCount', { loaded: list.rows.length, count: list.count }) : t('table.more')}
          </Button>
        ) : null}
      </section>
      <TableP13nDialog
        opened={p13n}
        columns={allColumns}
        visible={visible}
        sort={baseSort}
        sortable={allColumns.filter((c) => c.field?.kind === 'field' && c.field.path && isSortable(caps, c.field.path)).map((c) => ({ path: c.field!.path!, label: c.label }))}
        groupable={responsive ? allColumns.filter((c) => c.field?.kind === 'field' && c.field.path && isSortable(caps, c.field.path)).map((c) => ({ id: c.id, label: c.label })) : undefined}
        groupBy={groupBy}
        onOk={(ids, s, g) => { setVisibleIds(ids); setSort(s); if (g !== undefined) setOwn((x) => ({ ...x, groupBy: g })); setP13n(false); }}
        onCancel={() => setP13n(false)}
      />
      {runner.dialogs}
      {canCreate && (createMode === 'dialog' || !p.parent) ? (
        <CreateDialog
          opened={creating}
          onClose={() => setCreating(false)}
          title={t('create.title', { type: ui.headerInfo.typeName })}
          service={p.service}
          typeName={info.typeName}
          fields={createFields(model, info.typeName, lineItem)}
          onCreate={p.parent ? createChild : createRoot}
        />
      ) : null}
      <Modal opened={Boolean(confirmDelete)} onClose={() => setConfirmDelete(null)} title={t('delete.title')} data-sk-delete-dialog>
        <Stack>
          <Text>{confirmDelete?.length === 1 ? t('delete.confirmOne', { name: targetOf(confirmDelete[0]!).label }) : t('delete.confirmMany', { count: confirmDelete?.length ?? 0 })}</Text>
          <Group justify="flex-end">
            <Button color="red" onClick={() => confirmDelete && void deleteNow(confirmDelete)} data-sk-delete-confirm>{t('actions.delete')}</Button>
            <Button variant="default" onClick={() => setConfirmDelete(null)}>{t('common.cancel')}</Button>
          </Group>
        </Stack>
      </Modal>
    </TableCtx.Provider>
  );
}

SmartTable.Toolbar = ToolbarPart;
SmartTable.Title = TitlePart;
SmartTable.Actions = ActionsPart;
SmartTable.Settings = SettingsPart;
SmartTable.Export = ExportPart;
SmartTable.Copy = CopyPart;
SmartTable.Details = DetailsPart;
SmartTable.Search = SearchPart;
