/**
 * SmartTable: columns from UI.LineItem, server-side sorting and paging, selection, row navigation, personalization,
 * export and "no data" texts (LR-18–LR-35). Kernel: AG Grid Community (ADR-002).
 * - mode "grid": own scrollbar, infinite row model with server blocks (list pages)
 * - mode "auto": auto height, "More" button (object page sub-tables)
 */
import { ActionIcon, Alert, Button, Group, Menu, Text, TextInput, Tooltip } from '@mantine/core';
import {
  capabilitiesFor, isAbortError, isSortable, keyPredicate, sourceInfo, type FieldModel, type FilterState, type QuerySource, type Row, type SortItem,
} from '@rhfan2019/smart-kit-core';
import { useQueryClient } from '@tanstack/react-query';
import {
  AllCommunityModule, ModuleRegistry, type CellKeyDownEvent, type ColDef, type GridApi, type GridReadyEvent, type IDatasource, type SortChangedEvent,
} from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import { ChevronRight, Download, MoreHorizontal, Search, Settings2 } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useService, useSmartKit, useText } from '../context/SmartKitProvider';
import { SmartField } from '../field/SmartField';
import { smartKitGridTheme } from '../theme/agGrid';
import { applyExtensions, type ExtendEntry } from '../util/extend';
import { usePageState, useStoredState } from '../util/usePageState';
import { useDynamicPage } from '../page/DynamicPage';
import { exportRows } from './exportRows';
import { TableP13nDialog } from './TableP13nDialog';
import { useListQuery } from './useListQuery';

ModuleRegistry.registerModules([AllCommunityModule]);

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
  mode?: 'grid' | 'auto';
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
  if (edmType === 'Edm.Date') return 130;
  if (edmType === 'Edm.DateTimeOffset') return 180;
  if (edmType && /Decimal|Int|Double|Single/.test(edmType)) return 150;
  return 200;
}

// ---------------------------------------------------------------------------------------------- parts

function TitlePart() {
  const { title, ctx } = useInternal();
  const t = useText();
  return (
    <h2 className="sk-table__title" data-sk-table-title>
      {ctx.count === undefined ? title : t('table.title', { title, count: ctx.count })}
    </h2>
  );
}

function ActionsPart() {
  const { actions, ctx } = useInternal();
  const t = useText();
  const INLINE = 3;
  const btn = (a: ActionItem) => {
    const disabled = (a.requiresSelection && ctx.selected.length === 0) || (a.enabled ? !a.enabled(ctx.selected) : false);
    return { disabled, onPress: () => a.onPress(ctx) };
  };
  const inline = actions.slice(0, INLINE);
  const overflow = actions.slice(INLINE);
  return (
    <>
      {inline.map((a) => {
        const b = btn(a);
        return <Button key={a.id} variant="subtle" disabled={b.disabled} onClick={b.onPress} data-sk-action={a.id}>{a.label}</Button>;
      })}
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

function ToolbarPart({ children }: { children?: ReactNode }) {
  const { p } = useInternal();
  return (
    <div className="sk-table__toolbar" role="toolbar">
      {children ?? (
        <>
          <TitlePart />
          <span className="sk-grow" />
          <Group gap="xs" wrap="nowrap" className="sk-table__toolbar-actions">
            {p.showSearch ? <SearchPart /> : null}
            <ActionsPart />
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

  const lineItem = useMemo(() => {
    if (!p.parent) return ui.lineItem;
    const parentUi = model.ui[model.entitySets[info.parentSet!]!.typeName]!;
    for (const s of parentUi.sections) for (const sub of s.subSections) {
      if (sub.content.kind === 'table' && sub.content.navigation === info.navigation) return sub.content.columns;
    }
    return ui.lineItem;
  }, [p.parent, ui, model, info]);

  const allColumns = useMemo(() => {
    const base: ColumnItem[] = lineItem.map((f) => ({ id: f.id, label: f.label, field: f }));
    const colExt = (p.extend ?? []).filter((e) => e.kind !== 'action') as ExtendEntry<ColumnItem>[];
    return applyExtensions(base, colExt, 'SmartTable columns');
  }, [lineItem, p.extend]);
  const actions = useMemo(() => applyExtensions<ActionItem>([], (p.extend ?? []).filter((e) => e.kind === 'action') as ExtendEntry<ActionItem>[], 'SmartTable actions'), [p.extend]);

  const stateKey = p.pageKey ? `${p.pageKey}:table` : undefined;
  const [own, setOwn] = usePageState<{ columns: string[]; sort?: SortItem[]; search: string; loaded: number }>(stateKey, () => ({ columns: allColumns.map((c) => c.id), search: '', loaded: p.growingThreshold ?? 10 }));
  const visibleIds = (p.columns ?? own.columns).filter((id) => allColumns.some((c) => c.id === id));
  // Columns added by extensions after the state was stored are shown too.
  const known = new Set([...own.columns, ...(p.columns ?? [])]);
  const visible = [...visibleIds, ...allColumns.filter((c) => !known.has(c.id) && !p.columns).map((c) => c.id)];
  const setVisibleIds = (ids: string[]) => { if (!p.columns) setOwn((s) => ({ ...s, columns: ids })); p.onColumnsChange?.(ids); };
  const sort = p.sort ?? own.sort ?? ui.presentation.sortOrder;
  const setSort = (s: SortItem[]) => { if (!p.sort) setOwn((x) => ({ ...x, sort: s })); p.onSortChange?.(s); };
  const search = own.search;
  const setSearch = (s: string) => setOwn((x) => ({ ...x, search: s }));

  const visibleColumns = visible.map((id) => allColumns.find((c) => c.id === id)!).filter(Boolean);
  const fields = visibleColumns.map((c) => c.field).filter((f): f is FieldModel => Boolean(f));
  const extraSelect = visibleColumns.flatMap((c) => c.select ?? []);
  const filters = p.query?.filters ?? {};
  const effectiveSearch = [p.query?.search, search].filter(Boolean).join(' ');
  const executed = p.query !== null;

  const list = useListQuery({
    service: p.service, source, columns: fields, filters, search: effectiveSearch, sort, extraSelect,
    pageSize: Math.max(p.growingThreshold ?? 10, own.loaded), growSize: p.growBy ?? 20, enabled: mode === 'auto' && executed,
  });

  const [selected, setSelected] = useState<Row[]>([]);
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

  const ctx: TableContextValue = {
    entitySet: info.entitySet, typeName: info.typeName, source,
    rows: mode === 'auto' ? list.rows : gridRows, selected,
    count: mode === 'auto' ? list.count : gridCount,
    filters, search: effectiveSearch, sort,
    refresh: () => (mode === 'auto' ? list.refresh() : setRefreshToken((n) => n + 1)),
  };
  const onCountChange = p.onCountChange;
  useEffect(() => { onCountChange?.(ctx.count); }, [ctx.count, onCountChange]);
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
        cellRenderer: (params: { data?: Row }) => (params.data ? (c.render ? c.render(params.data) : <SmartField typeName={info.typeName} service={p.service} field={c.field!} row={params.data} />) : null),
        context: { sortPath },
      } satisfies ColDef;
    });
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
  }, [visible.join('|'), allColumns, navigable, JSON.stringify(sort), intlLocale, timeZone, mode]);

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
  const internal: InternalCtx = {
    p, ctx, title, allColumns, visibleIds: visible, setVisibleIds, setSort, actions, openP13n: () => setP13n(true),
    exportNow: () => void exportNow(), exporting, search, setSearch, searchable,
  };

  const error = mode === 'auto' ? list.error : gridError;
  const empty = mode === 'auto' ? executed && !list.isLoading && list.rows.length === 0 && !list.error : gridEmpty;
  const noDataText = !executed ? t('table.noData.start') : p.parent ? t('table.noData.empty') : t('table.noData.notFound');

  const onSortChanged = (e: SortChangedEvent) => {
    const next = e.api.getColumnState().filter((s) => s.sort).sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0))
      .map((s) => ({ path: (e.api.getColumn(s.colId)?.getColDef().context as { sortPath?: string } | undefined)?.sortPath ?? s.colId, descending: s.sort === 'desc' }));
    if (JSON.stringify(next) !== JSON.stringify(latest.current.sort)) setSort(next);
  };

  const grid = (
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
      <section className={['sk-table', `sk-table--${mode}`, p.className].filter(Boolean).join(' ')} aria-label={title} data-sk-table={info.entitySet}>
        {p.children ?? <ToolbarPart />}
        {error ? (
          <Alert color="red" variant="light" className="sk-table__error" role="alert">{t('table.error', { message: error.message })}</Alert>
        ) : null}
        <div className="sk-table__body">
          {grid}
          {(!executed || empty) && !error ? <div className="sk-table__nodata" data-sk-nodata><Text c="dimmed">{noDataText}</Text></div> : null}
          {p.overlay ? <div className="sk-table__overlay" data-sk-overlay><Text>{t('page.overlay')}</Text></div> : null}
        </div>
        {mode === 'auto' && list.hasMore ? (
          <Button variant="subtle" fullWidth className="sk-table__more" loading={list.isFetching} onClick={() => { list.loadMore(); setOwn((s) => ({ ...s, loaded: list.rows.length + (p.growBy ?? 20) })); }} data-sk-more>
            {list.count !== undefined ? t('table.moreCount', { loaded: list.rows.length, count: list.count }) : t('table.more')}
          </Button>
        ) : null}
      </section>
      <TableP13nDialog
        opened={p13n}
        columns={allColumns}
        visible={visible}
        sort={sort}
        sortable={allColumns.filter((c) => c.field?.kind === 'field' && c.field.path && isSortable(caps, c.field.path)).map((c) => ({ path: c.field!.path!, label: c.label }))}
        onOk={(ids, s) => { setVisibleIds(ids); setSort(s); setP13n(false); }}
        onCancel={() => setP13n(false)}
      />
    </TableCtx.Provider>
  );
}

SmartTable.Toolbar = ToolbarPart;
SmartTable.Title = TitlePart;
SmartTable.Actions = ActionsPart;
SmartTable.Settings = SettingsPart;
SmartTable.Export = ExportPart;
SmartTable.Search = SearchPart;
