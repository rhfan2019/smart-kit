/**
 * sap.fe.macros.Table and sap.fe.macros.TreeTable (ADR-033, docs/26b): columns from UI.LineItem, server-side sorting
 * and paging, selection, row navigation, personalization, export and "no data" texts (LR-18–LR-35); actions from
 * UI.DataFieldForAction (toolbar, menu buttons, line item actions, partial processing), create and delete, copy,
 * working modes, draft markers (ADR-024).
 * Kernels (ADR-002, ADR-020):
 * - "grid": AG Grid, own scrollbar, infinite row model with server blocks (`type` GridTable / AnalyticalTable with
 *   `rowCountMode` "Auto", the default of list tables)
 * - "auto": AG Grid with auto height, "More" button or scroll to load (`rowCountMode` "Fixed" / "Interactive", the
 *   default of sub-tables)
 * - "responsive": sap.m.Table scrolling with the page, scroll to load, pop-in by importance (`type` ResponsiveTable)
 * `TreeTable` shows the recursive hierarchy (Aggregation.RecursiveHierarchy, docs/26 §3.10, tree.tsx) in the grid
 * kernel (the grid uses client-side rows like grouping, docs/23 §9).
 */
import { ActionIcon, Alert, Anchor, Button, Group, Menu, Modal, Stack, Text, TextInput, Tooltip } from '@mantine/core';
import {
  canGroup, canSubtotal, canTotal, capabilitiesFor, hierarchyOf, isAbortError, isSortable, keyPredicate, matches, parseAnnotationPath, resolvePath, sourceInfo,
  type ActionModel, type EntityTypeModel, type FieldModel, type FilterState, type MetaModel, type Message, type MessageType, type PresentationModel, type QueryRequest, type QuerySource, type Row, type SortItem, type TotalsEntry,
} from '@rhfan2019/smart-kit-core';
import { useQueryClient } from '@tanstack/react-query';
import {
  AllCommunityModule, ModuleRegistry, type CellKeyDownEvent, type ColDef, type GridApi, type GridReadyEvent, type IDatasource, type SortChangedEvent,
} from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import { ChevronDown, ChevronRight, Copy, Download, ListCollapse, ListTree, Maximize2, Minimize2, MoreHorizontal, Search, Settings2 } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode, type Ref } from 'react';
import { actionPaths, isActionAvailable, useActionRunner, type ActionResult } from '../actions/useActionRunner';
import { useService, useSmartKit, useText } from '../context/SmartKitProvider';
import type { TitleLevel } from '../controls/types';
import { typedText } from '../i18n/text';
import { CreateDialog, createFields, createWith, useEditStrategy } from '../edit/editing';
import { Field } from '../field/Field';
import { fieldValue, getPath } from '../field/values';
import { useMessages } from '../messages/MessageContext';
import { DraftIndicator } from '../object/DraftIndicator';
import { IllustratedMessage, type IllustratedMessageSize } from '../controls/display/IllustratedMessage';
import { smartKitGridTheme } from '../theme/agGrid';
import { applyExtensions, type ExtendEntry } from '../util/extend';
import { usePageState, useStoredState } from '../util/usePageState';
import { useDynamicPage } from '../page/DynamicPage';
import { exportRows } from './exportRows';
import { TableP13nDialog } from './TableP13nDialog';
import { useListQuery } from './useListQuery';
import { InlineCreateRow } from './InlineCreateRow';
import { groupValueOf, Table as MTable, type $ColumnSettings as MColumn, type PopinLayout, type Priority } from './ResponsiveTable';
import { MultiUnitTotal, TotalLines, useGrandTotals, useSubtotals, useTotalFormatter } from './useTotals';
import { TreeCell, useTree, useTreeState, type TreeMethods, type TreeTable$ToggleOpenStateEvent } from './tree';

let gridModulesRegistered = false;

/** Registers AG Grid's modules the first time a grid table renders, not when this module loads (ADR-026 P2, P3). */
function ensureGridModules(): void {
  if (gridModulesRegistered) return;
  ModuleRegistry.registerModules([AllCommunityModule]);
  gridModulesRegistered = true;
}

/** A column of the table (annotation or custom); the internal form of `columns` and `extend`. */
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
  /** Importance in responsive tables (pop-in on narrow screens); default the field's `UI.Importance`, else Medium. */
  importance?: 'High' | 'Medium' | 'Low';
  /** Horizontal alignment of the cells; default right for numbers. */
  align?: 'Begin' | 'Center' | 'End';
  /** Not exported to the spreadsheet. */
  disableExport?: boolean;
}

/** A toolbar action (annotation or custom); the internal form of `actions` and `extend`. */
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

/** Menu button grouping annotation and custom actions by id (smart-kit addition). */
export interface ActionGroup {
  id: string;
  label: string;
  /** Action ids (`DataFieldForAction::Namespace.action` or custom ids) shown in the menu. */
  actions: string[];
}

export type TableExtendEntry =
  | (ExtendEntry<ColumnItem> & { kind?: 'column' })
  | (ExtendEntry<ActionItem> & { kind: 'action' });

/** A row of the table, as sap.ui.model.odata.v4.Context: its entity path and its data. */
export interface Context {
  /** Entity path, e.g. "/Orders('1')". */
  getPath(): string;
  /** The row data. */
  getObject(): Row;
}

/** A custom column (sap.fe.macros.table.Column) of the `columns` aggregation. */
export interface $ColumnSettings {
  /** Unique key; annotation columns have keys like "DataField::GrossAmount". */
  key: string;
  /** Column header. */
  header?: string;
  /** Key of the column the new one is placed next to; default: after the last column. */
  anchor?: string;
  /** @defaultValue "After" */
  placement?: 'After' | 'Before';
  /** Column width (CSS length). */
  width?: string;
  /** Importance for the pop-in of responsive tables. */
  importance?: 'High' | 'Medium' | 'Low' | 'None';
  /** Horizontal alignment of the cells. */
  horizontalAlign?: 'Begin' | 'Center' | 'End';
  /** Properties the column shows: they are selected from the service (and exported). */
  properties?: string[];
  /** The column is not exported. */
  disableExport?: boolean;
  /** Cell content (the template control of the column in FE). */
  template?(row: Row): ReactNode;
}

/** A custom action (sap.fe.macros.table.Action) of the `actions` aggregation. */
export interface $ActionSettings {
  /** Unique key; annotation actions have keys like "DataFieldForAction::Namespace.action". */
  key: string;
  /** Button text. */
  text: string;
  /** Key of the action the new one is placed next to; default: after the last action. */
  anchor?: string;
  /** @defaultValue "After" */
  placement?: 'After' | 'Before';
  /** @defaultValue true */
  enabled?: boolean;
  /** Enabled only with one ("single") or at least one ("multi") selected row. */
  enableOnSelect?: 'single' | 'multi';
  /** Enabled only with selected rows. */
  requiresSelection?: boolean;
  /** @defaultValue true */
  visible?: boolean;
  /** The button was pressed; the contexts of the selected rows are passed. */
  onPress?(e: { selectedContexts: Context[] }): void;
}

/** Creation options (sap.fe.macros.table.TableCreationOptions) of the `creationMode` aggregation. */
export interface $TableCreationOptionsSettings {
  /**
   * "CreationDialog" (a dialog with the line item fields; then the object page of a list), "Inline" /
   * "InlineCreationRows" (a new row in sub-tables). Default: "CreationDialog" for lists, "Inline" for sub-tables;
   * "NewPage", "External" and "AddViaValueHelp" are not implemented yet (they behave as the default).
   */
  name?: 'AddViaValueHelp' | 'CreationDialog' | 'External' | 'Inline' | 'InlineCreationRows' | 'NewPage';
  /** false: no "Create" button (smart-kit addition; FE hides it with UI.CreateHidden). */
  enabled?: boolean;
}

/** What is exported (`onBeforeExport`, `onExported`); the same filters, search and sort as the file. */
export interface Table$BeforeExportEvent {
  entitySet: string;
  /** File name (without .xlsx): `exportFileName`, else the header. */
  title: string;
  filters: FilterState;
  search: string;
  sort: SortItem[];
  /** Ids of the exported columns, in order. */
  columns: string[];
  /** Number of exported rows. */
  rowCount: number;
  /** More rows matched than `exportRequestSize`; only the first `rowCount` are exported. */
  truncated: boolean;
  /** The request that read the rows (without paging). */
  request: QueryRequest;
}
export type Table$ExportedEvent = Table$BeforeExportEvent;

export interface Table$RowPressEvent {
  /** The pressed row. */
  bindingContext: Context;
}
export interface Table$SelectionChangeEvent {
  /** The selected rows (also `getSelectedContexts()`). */
  selectedContexts: Context[];
}

export interface TableQuery {
  filters: FilterState;
  search: string;
}

/** Settings of sap.fe.macros.Table (docs/26b; defaults in "实际默认值（源码）"). */
export interface $TableSettings {
  /**
   * Entity set path as in FE: "/Orders"; a sub-table "/Orders/_Item" (the navigation of the object
   * in `bindingContext`).
   */
  contextPath?: string;
  /**
   * Annotation path of the table: "@com.sap.vocabularies.UI.v1.LineItem#Q" (alias "@UI.LineItem#Q"),
   * "@…SelectionPresentationVariant#Q" or "@…PresentationVariant#Q" (their line item, sort, grouping and totals); sub-tables may
   * prefix the navigation ("_Item/@UI.LineItem"). Default: the LineItem (sub-tables: the one of the UI.Facets entry).
   */
  metaPath?: string;
  /** Instance path of the parent object of a sub-table, e.g. "Orders('1')" (FE: the binding context; smart-kit addition). */
  bindingContext?: string;
  /** Name of the service in `SmartKitProvider` `services`; default: the provider's `defaultService` (smart-kit addition). */
  service?: string;
  /**
   * Table type: "ResponsiveTable" (sap.m.Table, rows scroll with the page; grouping without subtotals), "GridTable"
   * (the grid; no grouping, no totals) and "AnalyticalTable" (the grid with grouping, group subtotals and totals of the
   * custom aggregates, on entity sets with Aggregation.ApplySupported; docs/23, D39). Default: the grid (FE derives
   * it from the annotations, stage 4).
   */
  type?: 'GridTable' | 'ResponsiveTable' | 'AnalyticalTable';
  /**
   * Grid tables: "Auto" fills the available height with its own scrollbar (default of list tables); "Fixed" and
   * "Interactive" grow with the rows and a "More" button (default of sub-tables).
   */
  rowCountMode?: 'Auto' | 'Fixed' | 'Interactive';
  /** Table title in the toolbar; default `UI.HeaderInfo/TypeNamePlural`, with the row count. */
  header?: string;
  /** Shows the title. Default true. */
  headerVisible?: boolean;
  /** Heading level of the title (OP Title Styles; smart-kit addition). Default "H2". */
  headerLevel?: TitleLevel;
  /** Shows the busy indicator. */
  busy?: boolean;
  /** Grid tables: lower rows (condensed content density). Default false. */
  condensedTableLayout?: boolean;
  /** A button in the toolbar shows the table in full screen. */
  enableFullScreen?: boolean;
  /** false: rows are loaded only after `refresh()` (or a new `query`). Default: loaded at once. */
  initialLoad?: boolean;
  /**
   * "No data" display: "text", or an illustrated message ("illustratedMessage-Auto", "-Base", "-ExtraSmall", "-Small",
   * "-Medium", "-Large"; "-Dot", "-Spot", "-Scene" as ExtraSmall, Small, Large). Default "text" (FE: illustratedMessage-Auto, stage 4).
   */
  modeForNoDataMessage?: 'illustratedMessage-Auto' | 'illustratedMessage-Base' | 'illustratedMessage-Medium' | 'illustratedMessage-Dot' | 'illustratedMessage-ExtraSmall' | 'illustratedMessage-Scene' | 'illustratedMessage-Large' | 'illustratedMessage-Spot' | 'illustratedMessage-Small' | 'text';
  /** Responsive tables: arrangement of the pop-in ("Block", "GridSmall", "GridLarge"). Default "Block". */
  popinLayout?: PopinLayout;
  /** Maximum number of selected rows (0: no limit). Default 200. */
  selectionLimit?: number;
  /** Offers "Export to Spreadsheet" in the toolbar. Default true. */
  enableExport?: boolean;
  /** File name of the export (without .xlsx); default the header. */
  exportFileName?: string;
  /** Sheet name of the export. */
  exportSheetName?: string;
  /** Maximum rows of the export (read in requests of 500). Default 10 000. */
  exportRequestSize?: number;
  /** Hides "Copy" of the selected rows to the clipboard. Default false. */
  disableCopyToClipboard?: boolean;
  /** Display only: no create, no delete in sub-tables. Default for sub-tables: true (the parent is not in edit mode). */
  readOnly?: boolean;
  /** Search field in the toolbar (when the service can search). Default: no search field. */
  isSearchable?: boolean;
  /** "None", "Single", "Multi"; "Auto", "ForceMulti" are "Multi", "ForceSingle" is "Single". Default "Multi". */
  selectionMode?: 'None' | 'Single' | 'Multi' | 'Auto' | 'ForceMulti' | 'ForceSingle';
  /** "Select all" check box in tables that hold all rows (responsive, sub-tables); false hides it. */
  enableSelectAll?: boolean;
  /** Rows per request when growing (sub-tables and responsive tables); default 10 for the first, 20 for each further page. */
  threshold?: number;
  /** Grid tables: rows per request while scrolling. Default 100. */
  scrollThreshold?: number;
  /** Grid tables: no column is frozen. */
  disableColumnFreeze?: boolean;
  /** Grid tables: number of frozen (pinned) columns. Default 1. */
  frozenColumnCount?: number;
  /** Column widths follow the type of their content; false: one width for all. @defaultValue true */
  enableAutoColumnWidth?: boolean;
  /** Automatic column widths are at least as wide as the column header. @defaultValue false */
  widthIncludingColumnHeader?: boolean;
  /** Comma-separated properties whose columns are left out. */
  ignoredFields?: string;
  /** Ignores the stored personalization (columns, sort, grouping, totals) of `pageKey`. @defaultValue false */
  ignorePersonalizationChanges?: boolean;
  /**
   * Personalization: "false" hides the settings button; a comma-separated list of "Column", "Sort", "Group",
   * "Aggregate" offers grouping and totals only when listed. Default: all.
   */
  personalization?: string;
  /** Content when there are no rows (replaces the "no data" text). */
  noData?: ReactNode;
  /** Custom columns (sap.fe.macros.table.Column), placed by `anchor` and `placement`. */
  columns?: $ColumnSettings[];
  /** Custom actions (sap.fe.macros.table.Action), placed by `anchor` and `placement`. */
  actions?: $ActionSettings[];
  /** Creation (sap.fe.macros.table.TableCreationOptions). */
  creationMode?: $TableCreationOptionsSettings;
  /** Applied filters; null means "not executed yet" (shows "To start, set the relevant filters."). Undefined loads without filters (smart-kit addition). */
  query?: TableQuery | null;
  /** Visible column ids in order (controlled, smart-kit addition). */
  visibleColumns?: string[];
  /** Called with the visible column ids after personalization. */
  onVisibleColumnsChange?(ids: string[]): void;
  /** Sort order (controlled); default from `UI.PresentationVariant/SortOrder` (smart-kit addition). */
  sort?: SortItem[];
  /** Called with the new sort order. */
  onSortChange?(sort: SortItem[]): void;
  /** The selection changed. */
  onSelectionChange?(e: Table$SelectionChangeEvent): void;
  /** Called when the total count becomes known (object page tab counts; smart-kit addition). */
  onCountChange?(count: number | undefined): void;
  /** A row was pressed; without a handler rows navigate with NavigationAdapter.toObject when the adapter has an object page. */
  onRowPress?(e: Table$RowPressEvent): void;
  /** Whether rows navigate (shows the chevron). Defaults to `onRowPress` or the adapter's hasObjectPage (smart-kit addition). */
  navigable?: boolean;
  /** Insert, replace or remove columns and toolbar actions (ids as in the model, e.g. "DataField::GrossAmount"; smart-kit addition). */
  extend?: TableExtendEntry[];
  /** Key for restoring sort, columns, scroll and selection on back navigation (smart-kit addition). */
  pageKey?: string;
  /** Grey out the table (filters changed in manual mode; sap.m.Table showOverlay). */
  showOverlay?: boolean;
  /**
   * Called when the rows to export are loaded, before the file is written. Return false (or a promise of false) to
   * cancel: no file is written. Use it to check permissions or to log the export.
   */
  onBeforeExport?(e: Table$BeforeExportEvent): boolean | void | Promise<boolean | void>;
  /** Called after the file was written. */
  onExported?(e: Table$ExportedEvent): void;
  /** Replace the default parts: <Table.Toolbar> etc. */
  children?: ReactNode;
  /** Extra CSS class on the root element. */
  className?: string;
  /** Menu buttons for similar actions (smart-kit addition). */
  actionGroups?: ActionGroup[];
  /** Called after an object was created (default for lists: navigate to its object page). */
  onCreated?(path: string, row: Row): void;
  /** Sub-tables ("Fixed" rows): grow when the end of the table is scrolled into view instead of a "More" button. */
  growingScrollToLoad?: boolean;
  /** Sub-tables: above this count only a preview is shown with a "Show All (x)" link (OP Tables; default 200). */
  showAllThreshold?: number;
  /** "Show All (x)": default NavigationAdapter.toTable. */
  onShowAll?(): void;
  /** Worklist (default): rows refresh after an action; continuous: changed rows stay and are marked (LR Working Modes). */
  workingMode?: 'worklist' | 'continuous';
  /** Called with the loaded rows (e.g. paging buttons of a flexible column layout). */
  onRowsChange?(rows: Row[]): void;
  /** Toolbar content after the title (content switch of multiple views, LR Multiple Views). */
  titleAddon?: ReactNode;
  /** Toolbar content before the settings (table / chart toggle). */
  toolbarEnd?: ReactNode;
  /**
   * Group column id (controlled, docs/23; grid tables then load rows in blocks of 100 while scrolling and show group
   * header rows). Default: the column of the first `UI.PresentationVariant/GroupBy` path; null: not grouped.
   */
  groupBy?: string | null;
  /** Called with the group column id after personalization; when given, `groupBy` is fully controlled (undefined: the default). */
  onGroupByChange?(id: string | null): void;
  /** Column ids whose totals are shown (controlled, docs/23). Default: the columns of `UI.PresentationVariant/Total`. */
  totals?: string[];
  /** Called with the total column ids after personalization; when given, `totals` is fully controlled (undefined: the default). */
  onTotalsChange?(ids: string[]): void;
  /** Instance methods: refresh, getSelectedContexts, clearSelection, … (sap.fe.macros.Table). */
  ref?: Ref<Table>;
}

/** Settings of sap.fe.macros.TreeTable: those of `Table` plus the hierarchy. */
export interface $TreeTableSettings extends Omit<$TableSettings, 'type' | 'ref' | 'groupBy' | 'onGroupByChange' | 'totals' | 'onTotalsChange'> {
  /** The only value. @defaultValue "TreeTable" */
  type?: 'TreeTable';
  /** Qualifier of Aggregation.RecursiveHierarchy (default: the type's first hierarchy; without one it is a plain table). */
  hierarchyQualifier?: string;
  /** Levels shown at first (default 1: the roots); `collapseAll` goes back to the roots (smart-kit addition). */
  initialExpansionLevel?: number;
  /** Leaves (nodes without children) cannot be selected. Default false. */
  disableLeafSelection?: boolean;
  /** Shows the tree in the responsive table (sap.m.Table) kernel, e.g. on phones (smart-kit addition; FE always uses the grid). */
  responsive?: boolean;
  /** A node was expanded or collapsed by the user (sap.ui.table.TreeTable#toggleOpenState; smart-kit addition). */
  onToggleOpenState?(e: TreeTable$ToggleOpenStateEvent): void;
  /** Instance methods of `Table` plus expand, collapse, collapseAll, expandToLevel, isExpanded (sap.ui.table.TreeTable). */
  ref?: Ref<TreeTable>;
}

/** Instance methods of sap.fe.macros.Table (through `ref`). */
export interface Table {
  /** Reloads the rows (and totals). */
  refresh(): void;
  /** Contexts of the selected rows. */
  getSelectedContexts(): Context[];
  clearSelection(): void;
  /** Contexts of the loaded rows. */
  getAllCurrentContexts(): Context[];
  /** Number of rows of the result, when known. */
  getCount(): number | undefined;
  /** Hides the columns with these keys (they stay in the personalization dialog). */
  hideColumns(columnKeys: string[], keepInPersonalisationDialog?: boolean): Promise<void>;
  /** Shows the columns with these keys, at the end or at `position`. */
  showColumns(columnKeys: (string | { key: string; position: number })[]): Promise<void>;
  /** Changes column labels at runtime. */
  changeColumnsLabel(labelChanges: { key: string; newLabel: string; newTooltip?: string }[]): Promise<void>;
  getIgnoredFields(): string;
  setIgnoredFields(ignoredFields: string): Table;
  /** Adds a message about the whole table to the page messages; resolves with its id. */
  addMessage(parameters: { message?: string; description?: string; type?: 'Error' | 'Warning' | 'Success' | 'Information' | 'None'; persistent?: boolean }): Promise<string>;
  removeMessage(id: string): void;
}

/** Instance methods of sap.fe.macros.TreeTable: those of `Table` plus the tree methods of sap.ui.table.TreeTable. */
export interface TreeTable extends Omit<Table, 'setIgnoredFields'>, TreeMethods {
  setIgnoredFields(ignoredFields: string): TreeTable;
}

/** Internal settings shared by both components. */
interface CoreSettings extends Omit<$TreeTableSettings, 'type' | 'ref'>, Pick<$TableSettings, 'groupBy' | 'onGroupByChange' | 'totals' | 'onTotalsChange'> {
  type?: $TableSettings['type'];
  tree?: boolean;
  ref?: Ref<TreeTable>;
}

/** Data of the grid's pinned totals row (docs/23). */
const TOTAL_ROW = '$smartKitTotal';
/** Group header rows of grouped grid tables (docs/23 §9): `{ [GROUP_ROW]: { key, value, row } }`. */
const GROUP_ROW = '$smartKitGroup';
interface GroupRowData { key: string; display: string; first: Row }
const groupOf = (data: unknown): GroupRowData | undefined => (data as Row | undefined)?.[GROUP_ROW] as GroupRowData | undefined;
/** Rows per request of grouped grid tables (client-side rows, loaded while scrolling). */
const GRID_GROUP_BLOCK = 100;

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
  p: CoreSettings;
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
  fullScreen: { on: boolean; toggle(): void };
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
  if (!c) throw new Error('Table parts must be used inside <Table> or <TreeTable>');
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

/**
 * Draft paths a list always requests (FE Table.ts "Some properties are always loaded"): HasActiveEntity on
 * draft-enabled lists; on draft roots also HasDraftEntity and DraftAdministrativeData/InProcessByUser (not for tree
 * tables, which show active instances only). The key of DraftAdministrativeData comes with it, as the SAPUI5 V4 model
 * adds the keys of expanded entities. The draft indicator loads the rest of the administrative data when opened.
 */
function draftPaths(model: MetaModel, type: EntityTypeModel, root: boolean, tree: boolean): string[] {
  const out = ['HasActiveEntity', ...(root ? ['HasDraftEntity'] : [])].filter((p) => p in type.properties);
  const admin = type.navigations.DraftAdministrativeData;
  if (root && !tree && admin) out.push(...(model.entityTypes[admin.targetType]?.keys ?? []).map((k) => `DraftAdministrativeData/${k}`), 'DraftAdministrativeData/InProcessByUser');
  return out;
}

// ---------------------------------------------------------------------------------------------- parts

function TitlePart() {
  const { title, ctx, p } = useInternal();
  const t = useText();
  if (p.headerVisible === false) return null;
  const level = p.headerLevel && p.headerLevel !== 'Auto' ? Number(p.headerLevel.slice(1)) : 2;
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
  const { openP13n, p } = useInternal();
  const t = useText();
  if (p.personalization === 'false') return null;
  return (
    <Tooltip label={t('table.settings')}>
      <ActionIcon onClick={openP13n} aria-label={t('table.settings')} data-sk-table-settings><Settings2 className="sk-icon" /></ActionIcon>
    </Tooltip>
  );
}

function ExportPart() {
  const { exportNow, exporting, p } = useInternal();
  const t = useText();
  if (p.enableExport === false) return null;
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

function FullScreenPart() {
  const { p, fullScreen } = useInternal();
  const t = useText();
  if (!p.enableFullScreen) return null;
  const label = fullScreen.on ? t('layout.exitFullScreen') : t('layout.fullScreen');
  return (
    <Tooltip label={label}>
      <ActionIcon onClick={fullScreen.toggle} aria-label={label} aria-pressed={fullScreen.on} data-sk-table-fullscreen>{fullScreen.on ? <Minimize2 className="sk-icon" /> : <Maximize2 className="sk-icon" />}</ActionIcon>
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
            {p.isSearchable ? <SearchPart /> : null}
            <ActionsPart />
            <CopyPart />
            <DetailsPart />
            {p.toolbarEnd}
            <SettingsPart />
            <ExportPart />
            <FullScreenPart />
          </Group>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------- table

/** Line item and presentation of a `metaPath` (docs/30 §5.2); undefined parts fall back to the defaults. */
function resolveMetaPath(ui: { lineItems: Record<string, FieldModel[]>; views: { id: string; lineItem: FieldModel[]; presentation: PresentationModel }[]; presentationVariants: Record<string, { presentation: PresentationModel; lineItemQualifier?: string }> }, metaPath: string | undefined): { lineItem?: FieldModel[]; presentation?: PresentationModel } {
  if (!metaPath) return {};
  const { term, qualifier } = parseAnnotationPath(metaPath);
  if (term === 'LineItem') return { lineItem: ui.lineItems[qualifier] };
  if (term === 'SelectionPresentationVariant') {
    const v = ui.views.find((x) => x.id === qualifier);
    return v ? { lineItem: v.lineItem, presentation: v.presentation } : {};
  }
  if (term === 'PresentationVariant') {
    const pv = ui.presentationVariants[qualifier];
    return pv ? { lineItem: ui.lineItems[pv.lineItemQualifier ?? ''], presentation: pv.presentation } : {};
  }
  return {};
}

/** Entity set or sub-table source of `contextPath`, `metaPath` and `bindingContext`. */
function sourceOf(contextPath: string | undefined, metaPath: string | undefined, bindingContext: string | undefined): { entitySet: string; parent?: { path: string; navigation: string } } {
  const segs = (contextPath ?? '').split('/').filter(Boolean);
  const metaNav = metaPath && metaPath.includes('@') ? metaPath.slice(0, metaPath.indexOf('@')).split('/').filter(Boolean).pop() : undefined;
  const navigation = segs.length > 1 ? segs[segs.length - 1] : metaNav;
  return { entitySet: segs[0] ?? '', parent: bindingContext && navigation ? { path: bindingContext, navigation } : undefined };
}

/** CSS width (px, rem, em) → px for the grid; undefined otherwise. */
function pxWidth(w: string | undefined): number | undefined {
  const m = w ? /^(\d+(?:\.\d+)?)(px|rem|em)?$/.exec(w.trim()) : null;
  return m ? Number(m[1]) * (m[2] === 'rem' || m[2] === 'em' ? 16 : 1) : undefined;
}

const contextOf = (path: string, row: Row): Context => ({ getPath: () => (path.startsWith('/') ? path : `/${path}`), getObject: () => row });

const MESSAGE_TYPE: Record<string, MessageType> = { Error: 'error', Warning: 'warning', Success: 'success', Information: 'info', None: 'info' };

function TableCore(p: CoreSettings) {
  ensureGridModules();
  const service = useService(p.service);
  const { navigation, intlLocale, timeZone } = useSmartKit();
  const t = useText();
  const page = useDynamicPage();
  const model = service.model;
  const { entitySet, parent } = sourceOf(p.contextPath, p.metaPath, p.bindingContext);
  const source: QuerySource = useMemo(
    () => (parent ? { parent: parent.path, navigation: parent.navigation } : { entitySet }),
    [parent?.path, parent?.navigation, entitySet], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const info = useMemo(() => sourceInfo(model, source), [model, source]);
  const type = model.entityTypes[info.typeName]!;
  const ui = model.ui[info.typeName]!;
  const caps = info.parentSet ? capabilitiesFor(model, info.parentSet, info.navigation) : capabilitiesFor(model, info.entitySet);
  const rowCountMode = p.rowCountMode ?? (parent ? 'Fixed' : 'Auto');
  const mode: 'grid' | 'auto' | 'responsive' = p.type === 'ResponsiveTable' || (p.tree && p.responsive) ? 'responsive' : rowCountMode === 'Auto' ? 'grid' : 'auto';
  const responsive = mode === 'responsive';
  const editing = p.readOnly === undefined ? false : !p.readOnly;
  // Tree table (docs/26 §3.10): no grouping, no totals, no paging.
  const hierarchy = p.tree ? hierarchyOf(model, info.typeName, p.hierarchyQualifier) : undefined;
  const isTree = Boolean(hierarchy);
  const treeState = useTreeState(p.initialExpansionLevel ?? 1);
  const messages = useMessages();
  const draftRoot = !parent && Boolean(model.entitySets[info.entitySet]?.draft?.root);
  // Draft root or node list (FE isObjectPathDraftSupported, outside an object page).
  const draftList = !parent && Boolean(model.entitySets[info.entitySet]?.draft);
  const meta = useMemo(() => resolveMetaPath(ui, p.metaPath), [ui, p.metaPath]);
  const [ignored, setIgnored] = useState(p.ignoredFields);
  useEffect(() => setIgnored(p.ignoredFields), [p.ignoredFields]);
  const [labels, setLabels] = useState<Record<string, string>>({});

  const lineItem = useMemo(() => {
    const ignoredPaths = new Set((ignored ?? '').split(',').map((x) => x.trim()).filter(Boolean));
    const keep = (fs: FieldModel[]) => (ignoredPaths.size ? fs.filter((f) => !f.path || !ignoredPaths.has(f.path)) : fs);
    if (meta.lineItem) return keep(meta.lineItem);
    if (!parent) return keep(ui.lineItem);
    const parentUi = model.ui[model.entitySets[info.parentSet!]!.typeName]!;
    for (const s of parentUi.sections) for (const sub of s.subSections) {
      if (sub.content.kind === 'table' && sub.content.navigation === info.navigation) return keep(sub.content.columns);
    }
    return keep(ui.lineItem);
  }, [Boolean(parent), meta, ui, model, info, ignored]); // eslint-disable-line react-hooks/exhaustive-deps

  const allColumns = useMemo(() => {
    const base: ColumnItem[] = lineItem.map((f) => ({ id: f.id, label: f.label, field: f }));
    // `columns` (sap.fe.macros.table.Column) first, then `extend`.
    const custom: ExtendEntry<ColumnItem>[] = (p.columns ?? []).map((c) => ({
      id: c.key, position: c.anchor ? (c.placement === 'Before' ? 'before' : 'after') : 'end', anchor: c.anchor,
      item: {
        id: c.key, label: c.header ?? '', render: c.template, select: c.properties, width: pxWidth(c.width), align: c.horizontalAlign,
        importance: c.importance === 'None' ? undefined : c.importance, disableExport: c.disableExport,
      },
    }));
    const colExt = (p.extend ?? []).filter((e) => e.kind !== 'action') as ExtendEntry<ColumnItem>[];
    const out = applyExtensions(applyExtensions(base, custom, 'Table columns'), colExt, 'Table extend');
    return Object.keys(labels).length ? out.map((c) => (labels[c.id] ? { ...c, label: labels[c.id]! } : c)) : out;
  }, [lineItem, p.columns, p.extend, labels]);
  const modelActions: ActionModel[] = ui.actions;
  const inlineActions = modelActions.filter((a) => a.inline);
  const creationName = p.creationMode?.name;
  const createMode = p.creationMode?.enabled === false ? 'none' : creationName === 'CreationDialog' ? 'dialog' : creationName === 'Inline' || creationName === 'InlineCreationRows' ? 'inline' : parent ? 'inline' : 'dialog';
  const canCreate = createMode !== 'none' && caps.insertable && (!parent || editing) && Boolean(service.dataProvider.create);
  const canDelete = (!parent || editing) && caps.deletable && Boolean(service.dataProvider.remove);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Row[] | null>(null);

  const stateKey = p.pageKey && !p.ignorePersonalizationChanges ? `${p.pageKey}:table` : undefined;
  const firstPage = p.threshold ?? 10;
  const growSize = p.threshold ?? 20;
  const [own, setOwn] = usePageState<{ columns: string[]; known?: string[]; sort?: SortItem[]; search: string; loaded: number; groupBy?: string | null; totals?: string[]; details?: boolean }>(stateKey, () => ({ columns: allColumns.map((c) => c.id), search: '', loaded: firstPage }));
  const visibleIds = (p.visibleColumns ?? own.columns).filter((id) => allColumns.some((c) => c.id === id));
  // Columns added by extensions after the state was stored are shown too.
  const known = new Set([...(own.known ?? own.columns), ...(p.visibleColumns ?? [])]);
  const visible = [...visibleIds, ...allColumns.filter((c) => !known.has(c.id) && !p.visibleColumns).map((c) => c.id)];
  const setVisibleIds = (ids: string[]) => { if (!p.visibleColumns) setOwn((s) => ({ ...s, columns: ids, known: allColumns.map((c) => c.id) })); p.onVisibleColumnsChange?.(ids); };
  const presentation = meta.presentation ?? ui.presentation;
  const baseSort = p.sort ?? own.sort ?? presentation.sortOrder;
  const setSort = (s: SortItem[]) => { if (!p.sort) setOwn((x) => ({ ...x, sort: s })); p.onSortChange?.(s); };
  const search = own.search;
  const setSearch = (s: string) => setOwn((x) => ({ ...x, search: s }));

  const visibleColumns = visible.map((id) => allColumns.find((c) => c.id === id)!).filter(Boolean);
  const fields = visibleColumns.map((c) => c.field).filter((f): f is FieldModel => Boolean(f));
  const draftFields = draftList ? draftPaths(model, type, draftRoot, isTree) : [];
  const extraSelect = [...visibleColumns.flatMap((c) => c.select ?? []), ...actionPaths(modelActions), ...draftFields, ...(type.etag ? [type.etag] : [])];
  // D39 (FE updateTableVisualizationForType, getP13nMode): only the analytical table (type "AnalyticalTable" on an
  // entity set with Aggregation.ApplySupported) groups with subtotals and shows totals; the responsive table groups
  // without subtotals (FE groupConditions, p13n "Group"); the grid table neither groups nor totals.
  const analytical = p.type === 'AnalyticalTable' && !isTree && Boolean(caps.aggregation);
  // Grouping (docs/12 U-5, docs/23): rows are sorted by the group property first.
  const fieldPath = (c: ColumnItem | undefined) => (c?.field?.kind === 'field' ? c.field.path : undefined);
  const columnOfPath = (path: string | undefined) => (path ? allColumns.find((c) => fieldPath(c) === path)?.id : undefined);
  const groupable = allColumns.filter((c) => { const path = fieldPath(c); return Boolean(path && canGroup(model, source, path)); });
  // With onGroupByChange the parent keeps the state (a variant): undefined there means the annotation default.
  const groupOwned = p.groupBy !== undefined || Boolean(p.onGroupByChange);
  const groupChoice = (groupOwned ? p.groupBy : own.groupBy) ?? (groupOwned || own.groupBy === undefined ? columnOfPath(presentation.groupBy[0]) ?? null : null);
  const canGroupHere = !isTree && (responsive || (analytical && mode === 'grid'));
  const groupBy = canGroupHere && groupChoice && groupable.some((c) => c.id === groupChoice) ? groupChoice : null;
  const groupPath = groupBy ? fieldPath(allColumns.find((c) => c.id === groupBy)) : undefined;
  const setGroupBy = (id: string | null) => { if (!groupOwned) setOwn((x) => ({ ...x, groupBy: id })); p.onGroupByChange?.(id); };
  // Totals (docs/23, D39): analytical tables only, columns of custom aggregates (Aggregation.CustomAggregate).
  const totalPath = (c: ColumnItem | undefined) => { const path = analytical ? fieldPath(c) : undefined; return path && canTotal(model, source, path) ? path : undefined; };
  const totalable = analytical ? allColumns.filter((c) => totalPath(c)) : [];
  const totalsOwned = p.totals !== undefined || Boolean(p.onTotalsChange);
  // Default (FE getAggregateConditions): the columns of UI.PresentationVariant/Total (an empty Total: none); without
  // Total all custom aggregates.
  const defaultTotals = presentation.hasTotal || presentation.total.length ? totalable.filter((c) => presentation.total.includes(totalPath(c)!)) : totalable;
  const totalIds = (totalsOwned ? p.totals : own.totals) ?? defaultTotals.map((c) => c.id);
  const setTotals = (ids: string[]) => { if (!totalsOwned) setOwn((x) => ({ ...x, totals: ids })); p.onTotalsChange?.(ids); };
  const filters = p.query?.filters ?? {};
  const effectiveSearch = [p.query?.search, search].filter(Boolean).join(' ');
  // initialLoad false: nothing is loaded before refresh() or a new query.
  const [loadRequested, setLoadRequested] = useState(p.initialLoad !== false);
  const firstQuery = useRef(JSON.stringify(p.query));
  useEffect(() => {
    if (firstQuery.current === JSON.stringify(p.query)) return;
    firstQuery.current = JSON.stringify(p.query);
    setLoadRequested(true);
  }, [JSON.stringify(p.query)]); // eslint-disable-line react-hooks/exhaustive-deps
  const executed = p.query !== null && loadRequested;

  const totalColumns = isTree ? [] : visibleColumns.filter((c) => totalIds.includes(c.id) && totalPath(c));
  const measures = [...new Set(totalColumns.map((c) => totalPath(c)!))];
  const [totalsRevision, setTotalsRevision] = useState(0);

  // Grouped grid tables load client-side rows in blocks (the infinite row model cannot insert group rows).
  const gridGrouped = mode === 'grid' && Boolean(groupPath);
  // The grid's infinite row model with server blocks; grouped and tree grids hold client-side rows instead.
  const infinite = mode === 'grid' && !gridGrouped && !isTree;
  const sort = useMemo(() => (groupPath ? [{ path: groupPath, descending: false }, ...baseSort.filter((x) => x.path !== groupPath)] : baseSort), [groupPath, JSON.stringify(baseSort)]); // eslint-disable-line react-hooks/exhaustive-deps
  const list = useListQuery({
    service: p.service, source, columns: fields, filters, search: effectiveSearch, sort, extraSelect,
    pageSize: gridGrouped ? GRID_GROUP_BLOCK : responsive ? p.threshold ?? 20 : Math.max(firstPage, own.loaded),
    growSize: gridGrouped ? GRID_GROUP_BLOCK : responsive ? p.threshold ?? 20 : growSize,
    enabled: !infinite && executed,
    hierarchy: hierarchy ? { qualifier: hierarchy.qualifier, ...treeState.request } : undefined,
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

  const [selected, setSelected] = useState<Row[]>([]);
  const limit = p.selectionLimit ?? 200;
  const selection = p.selectionMode === 'None' ? 'None' : p.selectionMode === 'Single' || p.selectionMode === 'ForceSingle' ? 'Single' : 'Multi';
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
  const navigable = p.navigable ?? Boolean(p.onRowPress || navigation?.hasObjectPage?.(info.entitySet, service.name));
  const navigate = useCallback((row: Row) => {
    const path = pathOf(row);
    if (p.onRowPress) p.onRowPress({ bindingContext: contextOf(path, row) });
    else navigation?.toObject(path, service.name);
  }, [p, pathOf, navigation, service.name]);

  // Restore selection and scroll position (NAV-04).
  const stored = useStoredState<{ selectedKeys: string[]; firstRow: number }>(stateKey ? `${stateKey}:view` : undefined);
  const restore = useRef(stored.read());

  const loadedRows = useMemo(() => (infinite ? [] : list.rows.map((r) => overrides[keyOf(r)] ?? r)), [infinite, list.rows, overrides, keyOf]);
  const tree = useTree({ hierarchy, rows: loadedRows, tree: treeState, onToggleOpenState: p.onToggleOpenState });
  /** Rows that can be selected: not group headers; with `disableLeafSelection` no tree leaves. */
  const selectable = (row: Row | undefined) => Boolean(row) && !groupOf(row) && !(p.disableLeafSelection && isTree && latest.current.tree.nodeOf(row!)?.drillState === 'leaf');
  useImperativeHandle(p.ref, (): TreeTable => {
    const ctxs = (rows: Row[]) => rows.map((r) => contextOf(pathOf(r), r));
    const self: TreeTable = {
      ...tree.api,
      refresh: () => { setLoadRequested(true); ctx.refresh(); },
      getSelectedContexts: () => ctxs(ctx.selected),
      clearSelection: () => { setSelected([]); apiRef.current?.deselectAll(); },
      getAllCurrentContexts: () => ctxs(ctx.rows),
      getCount: () => ctx.count,
      hideColumns: async (keys) => { setVisibleIds(visible.filter((id) => !keys.includes(id))); },
      showColumns: async (keys) => {
        const next = [...visible];
        for (const k of keys) {
          const key = typeof k === 'string' ? k : k.key;
          if (next.includes(key)) continue;
          if (typeof k === 'string' || k.position < 0 || k.position >= next.length) next.push(key);
          else next.splice(k.position, 0, key);
        }
        setVisibleIds(next);
      },
      changeColumnsLabel: async (changes) => setLabels((x) => ({ ...x, ...Object.fromEntries(changes.map((c) => [c.key, c.newLabel])) })),
      getIgnoredFields: () => ignored ?? '',
      setIgnoredFields: (fields) => { setIgnored(fields); return self; },
      addMessage: async (m) => {
        const id = `table-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        messages?.add([{ id, type: MESSAGE_TYPE[m.type ?? 'Information'] ?? 'info', message: [m.message, m.description].filter(Boolean).join(' – '), source: 'client' }]);
        return id;
      },
      removeMessage: (id) => messages?.remove(id),
    };
    return self;
  });
  const listRows = isTree ? tree.rows : loadedRows;

  // ------------------------------------------------------------------ totals and subtotals (docs/23)
  const totalsQuery = { service: p.service, source, filters, search: effectiveSearch, measures, revision: totalsRevision };
  const grand = useGrandTotals({ ...totalsQuery, enabled: executed });
  const subtotalsOn = Boolean(analytical && groupPath && canSubtotal(model, source, groupPath));
  const groupValues = useMemo(() => {
    if (!subtotalsOn || !groupPath) return [];
    const seen = new Set<string>();
    const out: unknown[] = [];
    for (const r of listRows) {
      const v = getPath(r, groupPath);
      const k = v === null || v === undefined ? '' : String(v);
      if (!seen.has(k)) { seen.add(k); out.push(v ?? null); }
    }
    return out;
  }, [listRows, groupPath, subtotalsOn]);
  const subtotals = useSubtotals({ ...totalsQuery, groupBy: groupPath ?? '', groupValues, enabled: executed && subtotalsOn });
  const formatTotal = useTotalFormatter(p.service, source);
  const totalValue = (c: ColumnItem, entry: TotalsEntry | undefined, failed: boolean): ReactNode => {
    const path = totalPath(c);
    if (!path || !totalIds.includes(c.id)) return null;
    if (failed) return <span className="sk-total" data-sk-total={path}>–</span>;
    // several currencies (the service returned no unit): "Show Details" as FE (D39)
    if (entry?.values[path]?.some((a) => a.multiUnit)) {
      const sub = entry.group !== undefined && groupPath ? { groupBy: groupPath, groupValue: entry.group } : {};
      return <MultiUnitTotal query={{ service: p.service, source, filters, search: effectiveSearch, path, revision: totalsRevision, ...sub }} />;
    }
    return <TotalLines path={path} lines={formatTotal(path, entry?.values[path])} />;
  };
  const totalCells = (entry: TotalsEntry | undefined, failed: boolean) => Object.fromEntries(totalColumns.map((c) => [c.id, totalValue(c, entry, failed)]));
  const totalLabel = (error: string | undefined) => (
    <span className="sk-table__total-label" title={error ? t('table.totalsError', { message: error }) : undefined} data-sk-total-label data-error={error ? true : undefined}>{t('table.total')}</span>
  );
  /** Cell of the grid's pinned totals row. */
  const totalCell = (c: ColumnItem, i: number, data: Row | undefined): ReactNode => {
    const d = data?.[TOTAL_ROW] as { entry?: TotalsEntry; error?: string } | undefined;
    const value = totalValue(c, d?.entry, Boolean(d?.error));
    if (i !== 0) return value;
    return <>{totalLabel(d?.error)}{value ? <> {value}</> : null}</>;
  };
  const valueCtx = { model, typeName: info.typeName, locale: intlLocale, timeZone };
  // Grid group header rows: label and count in the first column (spanning to the first subtotal), subtotals below their columns.
  const groupColumn = groupBy ? allColumns.find((c) => c.id === groupBy) : undefined;
  const groupDisplay = (row: Row) => (groupColumn?.field ? fieldValue(valueCtx, groupColumn.field, row).display || groupValueOf(groupPath ?? '')(row) : '');
  const groupedRows = useMemo<Row[] | undefined>(() => {
    if (!gridGrouped || !groupPath) return undefined;
    const out: Row[] = [];
    let last: string | undefined;
    for (const r of listRows) {
      const v = getPath(r, groupPath);
      const key = v === null || v === undefined ? '' : String(v);
      if (key !== last) out.push({ [GROUP_ROW]: { key, display: groupDisplay(r), first: r } satisfies GroupRowData });
      last = key;
      out.push(r);
    }
    return out;
  }, [gridGrouped, groupPath, listRows, intlLocale, timeZone]); // eslint-disable-line react-hooks/exhaustive-deps
  const groupSummaryOf = (g: GroupRowData) => {
    if (!subtotalsOn) return undefined;
    const failed = Boolean(subtotals.error);
    const e = subtotals.get(getPath(g.first, groupPath!));
    return { entry: e, failed };
  };
  const groupCell = (c: ColumnItem, i: number, g: GroupRowData): ReactNode => {
    const sum = groupSummaryOf(g);
    if (i === 0) {
      const count = sum?.entry?.count;
      return <span className="sk-table__group-label" data-sk-group-row={g.display} data-sk-group-count={count}>{t('table.groupHeader', { label: groupColumn?.label ?? '', value: g.display || '–' }) + (count !== undefined ? t('table.groupCount', { count }) : '')}</span>;
    }
    return sum && (sum.entry || sum.failed) ? totalValue(c, sum.entry, sum.failed) : null;
  };
  // Subtotals arrive after the rows: redraw the group rows (cells and heights).
  useEffect(() => {
    const api = apiRef.current;
    if (!gridGrouped || !api || api.isDestroyed()) return;
    api.refreshCells({ force: true });
    api.resetRowHeights();
  }, [gridGrouped, subtotals.version, groupedRows]);
  /** Lines of the highest subtotal of a group (one per currency). */
  const groupLines = (g: GroupRowData) => {
    const e = groupSummaryOf(g)?.entry;
    return Math.max(1, ...measures.map((m) => e?.values[m]?.length ?? 1));
  };
  const ctx: TableContextValue = {
    entitySet: info.entitySet, typeName: info.typeName, source,
    rows: infinite ? gridRows : listRows, selected,
    count: infinite ? gridCount : list.count,
    filters, search: effectiveSearch, sort,
    refresh: () => { setOverrides({}); setTotalsRevision((n) => n + 1); if (infinite) setRefreshToken((n) => n + 1); else list.refresh(); },
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
        const fits = Object.entries(filters).every(([path, conds]) => path.startsWith('$') || matches(getPath(merged, path), conds, resolvePath(model.entityTypes, info.typeName, path).property?.edmType ?? 'Edm.String'));
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
        // Core.OperationAvailable: bound actions per selected row; unbound actions by the constant or expression
        // itself (FE Table.ts _useEnabledExpression, UIFormatters getActionEnabledExpression: equal(value, true)).
        enabled: (sel) => (a.bound ? sel.some((r) => isActionAvailable(a, r)) : isActionAvailable(a, undefined)),
        onPress: (c) => runner.run(a, a.bound ? c.selected.map(targetOf) : [{ row: {}, path: '', label: '' }]),
      });
    }
    if (canDelete) base.push({ id: 'Delete', label: t('actions.delete'), requiresSelection: true, onPress: (c) => setConfirmDelete(c.selected) });
    // `actions` (sap.fe.macros.table.Action) first, then `extend`.
    const custom: ExtendEntry<ActionItem>[] = (p.actions ?? []).filter((a) => a.visible !== false).map((a) => ({
      id: a.key, position: a.anchor ? (a.placement === 'Before' ? 'before' : 'after') : 'end', anchor: a.anchor,
      item: {
        id: a.key, label: a.text, requiresSelection: Boolean(a.requiresSelection || a.enableOnSelect),
        enabled: (sel) => a.enabled !== false && (a.enableOnSelect !== 'single' || sel.length === 1),
        onPress: (c) => a.onPress?.({ selectedContexts: c.selected.map((r) => contextOf(pathOf(r), r)) }),
      },
    }));
    const withCustom = applyExtensions<ActionItem>(base, custom, 'Table actions');
    return applyExtensions<ActionItem>(withCustom, (p.extend ?? []).filter((e) => e.kind === 'action') as ExtendEntry<ActionItem>[], 'Table extend');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runner is stable enough; rebuilt with its inputs
  }, [p.extend, p.actions, modelActions, canCreate, canDelete, t, targetOf]);
  const inlineCell = inlineActions.length ? (row: Row) => (
    <Group gap={4} wrap="nowrap" data-sk-inline-actions>
      {inlineActions.filter((a) => isActionAvailable(a, row)).map((a) => (
        <Button key={a.id} size="compact-xs" variant="light" onClick={(e) => { e.stopPropagation(); runner.run(a, [targetOf(row)]); }} data-sk-inline-action={a.id}>{a.label}</Button>
      ))}
    </Group>
  ) : undefined;

  // ------------------------------------------------------------------ copy (LR-21)
  const [copied, setCopied] = useState<string | null>(null);
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
    messages?.add([...ms, { id: `created-${Date.now()}`, type: 'success', message: typedText(t, 'create.done', ui.headerInfo.typeName), source: 'server' }]);
    setCreating(false);
    ctx.refresh();
    if (p.onCreated) p.onCreated(path, row);
    else if (!parent && navigation?.hasObjectPage?.(info.entitySet, service.name)) navigation.toObject(path, service.name);
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
    if (done) out.unshift({ id: `deleted-${Date.now()}`, type: 'success', message: done === 1 ? typedText(t, 'delete.done', ui.headerInfo.typeName) : t('delete.doneMany', { count: done }), source: 'server' });
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
  // Draft indicator (FE DraftIndicator): the details are read when the popover opens, as the SAPUI5 model reads the
  // popover's properties late.
  const loadDraftAdmin = useCallback((row: Row) => service.dataProvider.read(pathOf(row), { select: [], expand: [{ navigation: 'DraftAdministrativeData', select: [], expand: [] }] }), [service, pathOf]);
  const marker = draftRoot ? (row: Row) => <DraftIndicator row={row} compact load={() => loadDraftAdmin(row)} /> : undefined;
  // Grid tables of a list show the indicator in a separate "Editing Status" column after the first visible column
  // (FE Columns.ts draftStatus, MdcTableTemplate getComputedColumn: header hidden, 3em, icon only), when a
  // semantic key column would carry it; responsive tables keep it in the first column.
  const statusColumn = draftList && !responsive && visibleColumns.some((c) => c.field?.kind === 'field' && Boolean(c.field.path) && ui.semanticKey.includes(c.field.path!));
  const statusMarker = statusColumn ? (row: Row) => <DraftIndicator row={row} iconOnly load={() => loadDraftAdmin(row)} /> : undefined;
  const cellMarker = statusColumn ? undefined : marker;
  const latest = useRef({ ctx, p, navigate, sort, totalCell, groupCell, groupLines, tree });
  latest.current = { ctx, p, navigate, sort, totalCell, groupCell, groupLines, tree };

  // Frozen columns (grid tables); default the first.
  const frozen = p.disableColumnFreeze ? 0 : p.frozenColumnCount ?? 1;
  /** Width of a column: by its content type (`enableAutoColumnWidth`), at least its header (`widthIncludingColumnHeader`). */
  const autoWidth = (c: ColumnItem, edmType: string | undefined) => {
    const base = p.enableAutoColumnWidth === false ? 200 : defaultWidth(c.field, edmType);
    return p.widthIncludingColumnHeader ? Math.max(base, c.label.length * 8 + 48) : base;
  };
  const colDefs = useMemo<ColDef[]>(() => {
    const defs: ColDef[] = visibleColumns.map((c, i) => {
      const prop = c.field?.path ? model.entityTypes[info.typeName] && type.properties[c.field.path] : undefined;
      const sortPath = c.field?.kind === 'field' ? c.field.path : undefined;
      const s = sort.find((x) => x.path === sortPath);
      return {
        colId: c.id,
        headerName: c.label,
        width: c.width ?? autoWidth(c, prop?.edmType),
        minWidth: 80,
        // Not pinned while grouped: a column span cannot cross from the pinned into the scrolled columns.
        pinned: i < frozen && mode === 'grid' && !gridGrouped ? 'left' : undefined,
        colSpan: i === 0 && gridGrouped ? (params: { data?: Row }) => {
          if (!groupOf(params.data)) return 1;
          const next = visibleColumns.findIndex((x, j) => j > 0 && totalIds.includes(x.id) && totalPath(x));
          return next > 0 ? next : visibleColumns.length;
        } : undefined,
        sortable: Boolean(sortPath && isSortable(caps, sortPath)),
        sort: s ? (s.descending ? 'desc' : 'asc') : null,
        sortIndex: s && sort.length > 1 ? sort.indexOf(s) : null,
        resizable: true,
        type: (c.align ? c.align === 'End' : prop && /Int|Decimal|Double|Single|Byte/.test(prop.edmType) && c.field?.kind === 'field') ? 'rightAligned' : undefined,
        cellRenderer: (params: { data?: Row; node?: { rowPinned?: string | null } }) => {
          if (params.node?.rowPinned) return latest.current.totalCell(c, i, params.data);
          const g = groupOf(params.data);
          if (g) return latest.current.groupCell(c, i, g);
          const row = params.data;
          if (!row) return null;
          const content = (
            <span className={i === 0 && cellMarker ? 'sk-cell--with-marker' : undefined}>
              {c.render ? c.render(row) : <Field typeName={info.typeName} service={p.service} metaPath={c.field!} row={row} cell />}
              {i === 0 && cellMarker ? cellMarker(row) : null}
              {i === 0 && overridesRef.current[keyOf(row)] ? <span className="sk-table__changed" data-sk-changed-marker>{t('table.changedItem')}</span> : null}
            </span>
          );
          const tr = latest.current.tree;
          return i === 0 && isTree ? <TreeCell node={tr.nodeOf(row)} onToggle={() => latest.current.tree.toggle(row)}>{content}</TreeCell> : content;
        },
        context: { sortPath },
      } satisfies ColDef;
    });
    if (statusMarker) {
      defs.splice(1, 0, {
        colId: 'draftStatus', headerName: t('draft.editingStatus'), headerTooltip: t('draft.editingStatus'), headerClass: 'sk-table__header--hidden',
        width: 48, minWidth: 48, sortable: false, resizable: false, suppressMovable: true,
        cellRenderer: (params: { data?: Row; node?: { rowPinned?: string | null } }) => (params.data && !params.node?.rowPinned && !groupOf(params.data) ? statusMarker(params.data) : null),
      });
    }
    if (inlineCell) {
      defs.push({
        colId: '$actions', headerName: t('actions.inline'), width: 160, sortable: false, resizable: false, suppressMovable: true,
        cellRenderer: (params: { data?: Row; node?: { rowPinned?: string | null } }) => (params.data && !params.node?.rowPinned && !groupOf(params.data) ? inlineCell(params.data) : null),
      });
    }
    if (navigable) {
      defs.push({
        colId: '$nav', headerName: '', width: 52, pinned: 'right', sortable: false, resizable: false, suppressMovable: true,
        headerComponentParams: { 'aria-label': t('table.navigate') },
        cellRenderer: (params: { data?: Row; node?: { rowPinned?: string | null } }) => (params.data && !params.node?.rowPinned && !groupOf(params.data) ? (
          <ActionIcon className="sk-table__nav" aria-label={t('table.navigate')} onClick={() => latest.current.navigate(params.data!)} data-sk-row-nav>
            <ChevronRight className="sk-icon" />
          </ActionIcon>
        ) : null),
      });
    }
    return defs;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- column definitions depend on visible columns, sort indicator and navigability only
  }, [visible.join('|'), allColumns, navigable, JSON.stringify(sort), intlLocale, timeZone, mode, Boolean(inlineCell), Boolean(cellMarker), Boolean(statusMarker), gridGrouped, totalIds.join('|'), isTree, frozen, p.enableAutoColumnWidth, p.widthIncludingColumnHeader]);
  const overridesRef = useRef(overrides);
  overridesRef.current = overrides;
  // Tree grids: a node collapsed on the client keeps its row data; redraw the first column's toggles.
  useEffect(() => {
    const api = apiRef.current;
    if (isTree && api && !api.isDestroyed() && visibleColumns[0]) api.refreshCells({ columns: [visibleColumns[0].id], force: true });
  }, [isTree, listRows]); // eslint-disable-line react-hooks/exhaustive-deps

  // Grid datasource: one block per request, first block with $count.
  const datasource = useMemo<IDatasource | null>(() => {
    if (!infinite || !executed) return null;
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
  }, [infinite, executed, JSON.stringify(list.request), refreshToken]);

  useEffect(() => {
    const api = apiRef.current;
    if (!api || !infinite) return;
    if (datasource) api.setGridOption('datasource', datasource);
    else { setGridRows([]); setGridCount(undefined); setGridEmpty(false); }
  }, [datasource, infinite]);

  // Grid totals: a pinned row at the bottom, as high as the most currencies of one total (docs/23).
  // Only once rows are there: no totals row under the loading placeholder or the "no data" text.
  const gridEmptyNow = infinite ? gridEmpty || gridRows.length === 0 : list.rows.length === 0;
  const pinnedBottom = useMemo(
    () => (!responsive && executed && measures.length && !gridEmptyNow ? [{ [TOTAL_ROW]: { entry: grand.entry, error: grand.error?.message } }] : undefined),
    [responsive, executed, measures.join('|'), gridEmptyNow, grand.entry, grand.error], // eslint-disable-line react-hooks/exhaustive-deps
  );
  useEffect(() => {
    if (!pinnedBottom) return;
    const lines = Math.max(1, ...measures.map((m) => grand.entry?.values[m]?.length ?? 1));
    const timer = setTimeout(() => {
      const api = apiRef.current;
      const node = api && !api.isDestroyed() ? api.getPinnedBottomRow(0) : undefined;
      const el = sectionRef.current;
      if (!api || !node || !el) return;
      const style = getComputedStyle(el);
      const base = parseFloat(style.getPropertyValue('--sk-row-height')) || node.rowHeight || 0;
      const line = parseFloat(style.getPropertyValue('--sk-total-line-height')) || 0;
      node.setRowHeight(base + (lines - 1) * line);
      api.onRowHeightChanged();
    }, 0);
    return () => clearTimeout(timer);
  }, [pinnedBottom]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveView = () => {
    const api = apiRef.current;
    if (!stateKey || !api || api.isDestroyed()) return;
    stored.write({ selectedKeys: ((api.getSelectedRows() ?? []) as Row[]).map(keyOf), firstRow: mode === 'grid' ? topRowIndex(api) : 0 });
  };
  useEffect(() => () => saveView(), []); // eslint-disable-line react-hooks/exhaustive-deps -- store on unmount

  const [p13n, setP13n] = useState(false);
  // `personalization`: a list of "Column", "Sort", "Group", "Aggregate" limits grouping and totals; "true" or unset allows all.
  const p13nAllows = (part: string) => !p.personalization || p.personalization === 'true' || p.personalization.split(',').map((x) => x.trim()).includes(part);
  const [exporting, setExporting] = useState(false);
  const exportNow = async () => {
    setExporting(true);
    const exportTitle = p.exportFileName ?? p.header ?? ui.headerInfo.typeNamePlural;
    const event = (r: { count: number; truncated: boolean }): Table$BeforeExportEvent => ({
      entitySet: info.entitySet, title: exportTitle, filters, search: effectiveSearch, sort,
      columns: visibleColumns.filter((c) => !c.disableExport).map((c) => c.id), rowCount: r.count, truncated: r.truncated, request: { ...list.request, skip: undefined, top: undefined },
    });
    try {
      const r = await exportRows({
        service, typeName: info.typeName, columns: visibleColumns.filter((c) => !c.disableExport), title: exportTitle, sheetName: p.exportSheetName,
        pageRequest: list.pageRequest, limit: p.exportRequestSize ?? 10_000, locale: intlLocale, timeZone, t,
        before: p.onBeforeExport ? async (x) => (await p.onBeforeExport!(event(x))) !== false : undefined,
      });
      if (!r.cancelled) p.onExported?.(event(r));
    } catch (e) {
      messages?.add([{ id: `export-${Date.now()}`, type: 'error', message: (e as Error).message, source: 'client' }]);
    } finally {
      setExporting(false);
    }
  };

  const title = p.header ?? ui.headerInfo.typeNamePlural;
  const searchable = caps.searchable;
  const [hiddenCols, setHiddenCols] = useState<string[]>([]);
  const [fullScreen, setFullScreen] = useState(false);
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
    copyNow, canCopy: !p.disableCopyToClipboard, copied, width,
    details: { available: responsive && hiddenCols.length > 0, shown: Boolean(own.details), toggle: () => setOwn((x) => ({ ...x, details: !x.details })) },
    fullScreen: { on: fullScreen, toggle: () => setFullScreen((x) => !x) },
  };

  const error = infinite ? gridError : list.error;
  const empty = infinite ? gridEmpty : executed && !list.isLoading && list.rows.length === 0 && !list.error;
  const threshold = p.showAllThreshold ?? 200;
  const preview = mode === 'auto' && list.count !== undefined && list.count > threshold;
  const scrollGrowing = mode === 'auto' && Boolean(p.growingScrollToLoad) && !preview;
  const growRef = useRef<HTMLDivElement>(null);
  const latestList = useRef(list);
  latestList.current = list;
  useEffect(() => {
    const el = growRef.current;
    if (!el || !scrollGrowing || typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver(([e]) => {
      const l = latestList.current;
      if (e!.isIntersecting && l.hasMore && !l.isFetching) { l.loadMore(); setOwn((s) => ({ ...s, loaded: l.rows.length + growSize })); }
    }, { rootMargin: '0px 0px 120px 0px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, [scrollGrowing, list.rows.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const noDataText = !executed ? t('table.noData.start') : parent ? t('table.noData.empty') : t('table.noData.notFound');
  const noDataMode = p.modeForNoDataMessage ?? 'text';
  const illustrationSize = ({ Dot: 'ExtraSmall', Spot: 'Small', Scene: 'Large' } as Record<string, IllustratedMessageSize>)[noDataMode.slice(19)] ?? (noDataMode.slice(19) as IllustratedMessageSize);
  const noDataContent = p.noData ?? (noDataMode === 'text'
    ? <Text c="dimmed">{noDataText}</Text>
    : <IllustratedMessage illustrationType={!executed ? 'BeforeSearch' : Object.keys(filters).length || effectiveSearch ? 'NoFilterResults' : 'NoData'} illustrationSize={illustrationSize} description={noDataText} />);

  const onSortChanged = (e: SortChangedEvent) => {
    const next = e.api.getColumnState().filter((s) => s.sort).sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0))
      .map((s) => ({ path: (e.api.getColumn(s.colId)?.getColDef().context as { sortPath?: string } | undefined)?.sortPath ?? s.colId, descending: s.sort === 'desc' }));
    if (JSON.stringify(next) !== JSON.stringify(latest.current.sort)) setSort(next);
  };

  const responsiveColumns: MColumn[] = visibleColumns.map((c) => {
    const prop = c.field?.path ? type.properties[c.field.path] : undefined;
    const end = c.align ? c.align === 'End' : Boolean(prop && /Int|Decimal|Double|Single|Byte/.test(prop.edmType) && c.field?.kind === 'field');
    return {
      id: c.id,
      header: c.label,
      importance: (c.importance ?? c.field?.importance ?? (c.field?.isSemanticKey ? 'High' : 'Medium')) as Priority,
      hAlign: end ? 'End' : c.align === 'Center' ? 'Center' : undefined,
      cell: (row: Row) => (c.render ? c.render(row) : c.field ? <Field typeName={info.typeName} service={p.service} metaPath={c.field} row={row} cell /> : null),
      groupValue: c.field ? (row: Row) => fieldValue(valueCtx, c.field!, row).display || groupValueOf(c.field!.path ?? '')(row) : undefined,
    };
  });
  const selectedKeys = useMemo(() => selected.map(keyOf), [selected, keyOf]);
  const responsiveTable = responsive ? (
    <MTable
      aria-label={title}
      columns={responsiveColumns}
      items={listRows}
      keyOf={keyOf}
      mode={selection === 'None' ? 'None' : selection === 'Single' ? 'SingleSelectLeft' : 'MultiSelect'}
      multiSelectMode={p.enableSelectAll === false ? 'ClearAll' : 'Default'}
      selectedKeys={selectedKeys}
      onSelectionChange={(e) => {
        const keys = new Set(selection === 'Single' ? [] : selectedKeys);
        for (const r of e.listItems) { if (e.selected) keys.add(keyOf(r)); else keys.delete(keyOf(r)); }
        const rows = listRows.filter((r) => keys.has(keyOf(r)) && selectable(r)).slice(0, limit || undefined);
        setSelected(rows);
        p.onSelectionChange?.({ selectedContexts: rows.map((r) => contextOf(pathOf(r), r)) });
      }}
      navigable={navigable}
      onItemPress={(e) => navigate(e.listItem)}
      growing
      growingScrollToLoad
      hasMore={list.hasMore}
      busy={list.isFetching}
      onUpdateStarted={() => list.loadMore()}
      autoPopinMode
      fixedLayout={false}
      sticky={['ColumnHeaders']}
      hiddenInPopin={own.details ? [] : ['None', 'Low', 'Medium', 'High']}
      onPopinChanged={(e) => setHiddenCols([...e.visibleInPopin, ...e.hiddenInPopin].map((c) => c.id))}
      tree={isTree ? { nodeOf: tree.nodeOf, toggle: tree.toggle } : undefined}
      groupBy={groupBy ?? undefined}
      groupSummary={subtotalsOn ? (row) => {
        const failed = Boolean(subtotals.error);
        const e = subtotals.get(getPath(row, groupPath!));
        if (!e && !failed) return undefined;
        return { count: e?.count, cells: totalCells(e, failed) };
      } : undefined}
      totals={measures.length ? { label: totalLabel(grand.error?.message), cells: totalCells(grand.entry, Boolean(grand.error)) } : undefined}
      noData={noDataContent}
      popinLayout={p.popinLayout}
      inlineActions={inlineCell}
      changedKeys={new Set(Object.keys(overrides))}
      rowMarker={marker}
    />
  ) : null;

  const grid = responsive ? null : (
    <AgGridReact
      // The row model is fixed when the grid starts: grouping switches between the infinite and the client-side model.
      key={gridGrouped ? 'grouped' : isTree ? 'tree' : 'rows'}
      theme={smartKitGridTheme}
      containerStyle={mode === 'grid' ? { position: 'absolute', inset: 0 } : { width: '100%' }}
      columnDefs={colDefs}
      rowHeight={p.condensedTableLayout ? 32 : undefined}
      {...(isTree
        ? {
            rowData: listRows,
            loading: list.isLoading,
            ...(mode === 'grid' ? {} : { domLayout: 'autoHeight' as const }),
            // Tree order comes from the service (a header click sorts siblings there).
            postSortRows: (params: { nodes: { sourceRowIndex: number }[] }) => { params.nodes.sort((a, b) => a.sourceRowIndex - b.sourceRowIndex); },
          }
        : gridGrouped
        ? {
            rowData: groupedRows ?? [],
            loading: list.isLoading,
            // Rows stay in the service's order (sorted by the group first); a header click sorts on the service.
            postSortRows: (params: { nodes: { sourceRowIndex: number }[] }) => { params.nodes.sort((a, b) => a.sourceRowIndex - b.sourceRowIndex); },
            getRowHeight: (r: { data?: Row }) => {
              const g = groupOf(r.data);
              const el = sectionRef.current;
              if (!g || !el) return undefined;
              const style = getComputedStyle(el);
              const base = parseFloat(style.getPropertyValue('--sk-row-height')) || 0;
              const line = parseFloat(style.getPropertyValue('--sk-total-line-height')) || 0;
              return base ? base + (latest.current.groupLines(g) - 1) * line : undefined;
            },
          }
        : mode === 'grid'
          ? { rowModelType: 'infinite' as const, cacheBlockSize: p.scrollThreshold ?? 100, maxBlocksInCache: 50, infiniteInitialRowCount: 1 }
          : { rowData: list.rows, domLayout: 'autoHeight' as const })}
      getRowId={(r) => (r.rowPinned ? `${TOTAL_ROW}:${r.rowPinned}` : groupOf(r.data) ? `${GROUP_ROW}:${groupOf(r.data)!.key}` : keyOf(r.data as Row))}
      pinnedBottomRowData={pinnedBottom}
      getRowClass={(r) => (r.node.rowPinned ? 'sk-table__total-row' : groupOf(r.data) ? 'sk-table__group-row' : undefined)}
      rowSelection={selection === 'None' ? undefined : selection === 'Single'
        ? { mode: 'singleRow', checkboxes: true, enableClickSelection: false, isRowSelectable: (n) => selectable(n.data as Row | undefined), hideDisabledCheckboxes: true }
        : { mode: 'multiRow', checkboxes: true, headerCheckbox: mode === 'auto' && p.enableSelectAll !== false, enableClickSelection: false, isRowSelectable: (n) => selectable(n.data as Row | undefined), hideDisabledCheckboxes: true }}
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
        const nodes = e.api.getSelectedNodes();
        if (limit && nodes.length > limit) { for (const n of nodes.slice(limit)) n.setSelected(false); return; }
        const rows = e.api.getSelectedRows() as Row[];
        setSelected(rows);
        p.onSelectionChange?.({ selectedContexts: rows.map((r) => contextOf(pathOf(r), r)) });
        saveView();
      }}
      onBodyScroll={(e) => {
        if (mode === 'grid' && e.direction === 'vertical') page?.contentScrolled(e.top);
        // Grouped grid: the next block once the last rows come into view.
        const l = latestList.current;
        if (gridGrouped && l.hasMore && !l.isFetching && e.api.getLastDisplayedRowIndex() >= e.api.getDisplayedRowCount() - 20) l.loadMore();
      }}
      onBodyScrollEnd={() => saveView()}
      onSortChanged={onSortChanged}
      onColumnMoved={(e) => {
        if (!e.finished) return;
        const ids = e.api.getColumnState().map((s) => s.colId).filter((id) => id !== '$nav' && !id.startsWith('ag-Grid'));
        setVisibleIds(ids);
      }}
      onRowDoubleClicked={(e) => { if (navigable && e.data && !e.node.rowPinned && !groupOf(e.data)) navigate(e.data as Row); }}
      onCellKeyDown={(e: CellKeyDownEvent) => {
        const ev = e.event as KeyboardEvent | undefined;
        // Tree tables: "+" expands, "-" collapses the node of the focused row (sap.ui.table.TreeTable).
        if (isTree && e.data && (ev?.key === '+' || ev?.key === '-')) {
          const node = tree.nodeOf(e.data as Row);
          if (node && node.drillState !== 'leaf' && (node.drillState === 'expanded') === (ev.key === '-')) tree.toggle(e.data as Row);
          return;
        }
        if (ev?.key === 'Enter' && navigable && e.data && !e.node.rowPinned && !groupOf(e.data) && e.column.getColId() !== '$nav') navigate(e.data as Row);
      }}
    />
  );

  return (
    <TableCtx.Provider value={internal}>
      <section ref={sectionRef} className={['sk-table', `sk-table--${mode}`, p.className].filter(Boolean).join(' ')} data-sk-fullscreen={fullScreen || undefined}
        style={fullScreen ? { position: 'fixed', inset: 0, zIndex: 300, background: 'var(--sk-color-surface)', padding: 'var(--sk-space-4)', display: 'flex', flexDirection: 'column', overflow: 'auto' } : undefined} aria-label={title} data-sk-table={info.entitySet} aria-busy={p.busy || list.isFetching || undefined}>
        {p.children ?? <ToolbarPart />}
        {error ? (
          <Alert color="red" variant="light" className="sk-table__error" role="alert">{t('table.error', { message: error.message })}</Alert>
        ) : null}
        {creating && createMode === 'inline' && parent ? (
          <InlineCreateRow service={p.service} typeName={info.typeName} fields={createFields(model, info.typeName, lineItem)} onCreate={createChild} onCancel={() => setCreating(false)} />
        ) : null}
        <div className="sk-table__body">
          {grid}
          {responsiveTable}
          {(!executed || empty) && !error && !responsive ? <div className="sk-table__nodata" data-sk-nodata>{noDataContent}</div> : null}
          {!executed && responsive ? <div className="sk-table__nodata sk-rtable__nodata" data-sk-nodata><Text c="dimmed">{noDataText}</Text></div> : null}
          {p.showOverlay ? <div className="sk-table__overlay" data-sk-overlay><Text>{t('page.overlay')}</Text></div> : null}
          {p.busy || (list.isFetching && mode === 'auto' && list.rows.length === 0) ? <div className="sk-table__busy" role="status" aria-label={t('table.loading')} data-sk-busy /> : null}
        </div>
        {preview ? (
          <div className="sk-table__show-all">
            <Anchor component="button" type="button" onClick={() => (p.onShowAll ? p.onShowAll() : parent && navigation?.toTable?.(parent.path, parent.navigation, service.name))} data-sk-show-all>
              {t('table.showAll', { count: list.count! })}
            </Anchor>
          </div>
        ) : null}
        {scrollGrowing ? <div ref={growRef} className="sk-table__grow-sentinel" aria-hidden data-sk-grow-sentinel /> : null}
        {mode === 'auto' && list.hasMore && !preview && !scrollGrowing ? (
          <Button variant="subtle" fullWidth className="sk-table__more" loading={list.isFetching} onClick={() => { list.loadMore(); setOwn((s) => ({ ...s, loaded: list.rows.length + growSize })); }} data-sk-more>
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
        groupable={canGroupHere && p13nAllows('Group') ? groupable.map((c) => ({ id: c.id, label: c.label })) : undefined}
        groupBy={groupBy}
        totalable={p13nAllows('Aggregate') ? totalable.filter((c) => visible.includes(c.id)).map((c) => ({ id: c.id, label: c.label })) : []}
        totals={totalIds}
        onOk={(ids, s, g, tot) => { setVisibleIds(ids); setSort(s); if (g !== undefined) setGroupBy(g); if (tot) setTotals(tot); setP13n(false); }}
        onCancel={() => setP13n(false)}
      />
      {runner.dialogs}
      {canCreate && (createMode === 'dialog' || !parent) ? (
        <CreateDialog
          opened={creating}
          onClose={() => setCreating(false)}
          title={t('create.title', { type: ui.headerInfo.typeName })}
          service={p.service}
          typeName={info.typeName}
          fields={createFields(model, info.typeName, lineItem)}
          onCreate={parent ? createChild : createRoot}
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

/** sap.fe.macros.Table: annotation-driven table (`contextPath`, `metaPath`, docs/30 §5.2). */
export function Table(p: $TableSettings) {
  return <TableCore {...p} ref={p.ref as Ref<TreeTable> | undefined} />;
}

/** sap.fe.macros.TreeTable: the recursive hierarchy of the entity type (Aggregation.RecursiveHierarchy, docs/26 §3.10). */
export function TreeTable(p: $TreeTableSettings) {
  const { type: _type, ...rest } = p;
  return <TableCore {...rest} tree />;
}

/** Parts for a custom toolbar (`children`); they work inside `Table` and `TreeTable`. */
Table.Toolbar = ToolbarPart;
Table.Title = TitlePart;
Table.Actions = ActionsPart;
Table.Settings = SettingsPart;
Table.Export = ExportPart;
Table.Copy = CopyPart;
Table.Details = DetailsPart;
Table.Search = SearchPart;
