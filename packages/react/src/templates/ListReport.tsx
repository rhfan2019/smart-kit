/**
 * sap.fe.templates.ListReport (ADR-033, docs/30 §5.3): the list report page, configured with the Fiori elements manifest
 * settings (`sap.ui5 › routing › targets › <target> › options › settings`, docs/26c) as nested props. Built only from
 * public building blocks (AC-BOOT-01): variant management, filter bar, table or chart, views (IconTabBar), KPI tags,
 * share, footer messages (ADR-023) and the draft editing status.
 */
import { Button, Group, SegmentedControl, Select, Tabs, Text, Title } from '@mantine/core';
import {
  buildTotalsRequest, calculateCriticality, capabilitiesFor, DRAFT_EDIT_STATES, EDIT_STATE, editStateOf, isCustomAggregate, isFilterable, parseAnnotationPath, resolvePath,
  STANDARD_VARIANT_ID, withHiddenFilters,
  type ChartModel, type DataPointModel, type EntityUi, type FilterState, type InitialCondition, type MetaModel, type ValueRef, type Operator, type QueryRequest, type Row, type SortItem, type VariantContent, type ViewModel,
} from '@rhfan2019/smart-kit-core';
import { useQueries } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  useMetaModel, usePageState, useService, useSmartKit, useText,
  type ExtendEntry,
} from '../index';
import FilterSummary from '../kit/FilterSummary';
import useFilterState from '../kit/useFilterState';
import useVariants from '../kit/useVariants';
import Table, { type $ActionSettings, type $ColumnSettings, type $TableSettings, type ActionGroup, type Context, type Table$BeforeExportEvent, type Table$ExportedEvent, type Table$RowPressEvent, type Table$SelectionChangeEvent } from '../v4/fe/macros/Table';
import TreeTable from '../v4/fe/macros/TreeTable';
import FilterBar, { type $FilterFieldSettings, type FilterFieldItem, type FilterFieldTemplateContext } from '../v4/fe/macros/FilterBar';
import VariantManagement from '../v4/fe/macros/VariantManagement';
import MessageButton from '../v4/fe/macros/MessageButton';
import Share from '../v4/fe/macros/Share';
import DynamicPage from '../f/DynamicPage';
import DynamicPageTitle from '../f/DynamicPageTitle';
import DynamicPageHeader from '../f/DynamicPageHeader';
import Chart from '../v4/fe/macros/Chart';
import KPITag from '../v4/fe/macros/KPITag';
import MessageProvider from '../kit/MessageProvider';
import useMessages from '../kit/useMessages';

// ---------------------------------------------------------------------------------------------- settings (docs/26c)

/** sap.fe.core.InitialLoadMode; `true` / `false` are accepted as "Enabled" / "Disabled" (sap.fe.core.library InitialLoadType). */
export type InitialLoadMode = 'Auto' | 'Enabled' | 'Disabled';

/** sap.fe.core.converters.helpers.ConfigurableObject Position. */
export interface $PositionSettings {
  /** Key of the item the new one is placed next to. */
  anchor?: string;
  /** "End" (or no anchor): after the last item. */
  placement?: 'After' | 'Before' | 'End';
}

/**
 * A manifest action (FE `ManifestAction`) of the page header or of the table toolbar. FE names an extension handler in
 * `press`; here it is the handler itself (react-idiom).
 */
export interface $ManifestActionSettings {
  /** Button text. */
  text?: string;
  /** The button was pressed; table actions receive the selected rows. */
  press?(e: { selectedContexts: Context[] }): void;
  /** @defaultValue true */
  visible?: boolean;
  /** @defaultValue true */
  enabled?: boolean;
  /** Table actions: enabled only with selected rows. */
  requiresSelection?: boolean;
  /** Table actions: enabled with exactly one ("single") or at least one ("multi") selected row. */
  enableOnSelect?: 'multi' | 'single';
  /** Table actions: a menu button with these actions (keys such as "DataFieldForAction::Namespace.action"). */
  menu?: string[];
  position?: $PositionSettings;
}

/** A custom column (FE `CustomDefinedTableColumn`); FE names a fragment in `template`, here it renders the cell (react-idiom). */
export interface $ManifestColumnSettings {
  /** Column header. */
  header?: string;
  /** Cell content. */
  template?(row: Row): ReactNode;
  /** Properties the column shows: they are selected from the service (and exported). */
  properties?: string[];
  position?: $PositionSettings;
  /** Column width (CSS length). */
  width?: string;
  /** Importance for the pop-in of responsive tables. */
  importance?: 'High' | 'Low' | 'Medium' | 'None';
  horizontalAlign?: 'Begin' | 'Center' | 'End';
  /** The column is not exported. */
  disableExport?: boolean;
}

/** `tableSettings › creationMode` (FE TableManifestSettingsConfiguration). */
export interface $ManifestCreationModeSettings {
  /**
   * The list report allows "NewPage" (draft: a new draft opens on the object page), "CreationDialog" and "External";
   * the other values fall back to "NewPage" as in FE. Services without draft create with a dialog (kit-extension, D42).
   * @defaultValue "NewPage"
   */
  name?: 'AddViaValueHelp' | 'Async' | 'CreationDialog' | 'CreationRow' | 'Deferred' | 'External' | 'Inline' | 'InlineCreationRows' | 'NewPage' | 'Sync';
}

/** `tableSettings › quickVariantSelection`: a segmented button (≤ 3) or a select (> 3) in the table toolbar. */
export interface $QuickVariantSelectionSettings {
  /** Annotation paths of UI.SelectionVariant (or UI.SelectionPresentationVariant) annotations. */
  paths: { annotationPath: string }[];
  /** Counts in the texts. */
  showCounts?: boolean;
  /** Hides the table title. @defaultValue false */
  hideTableTitle?: boolean;
}

/** `controlConfiguration › @UI.LineItem › tableSettings` (FE TableManifestSettingsConfiguration, docs/26c §4). */
export interface $ManifestTableSettings {
  /**
   * Not set: "AnalyticalTable" when Aggregation.ApplySupported allows filter, identity, orderby, skip, top, groupby,
   * aggregate and concat, "TreeTable" with a qualified Aggregation / Hierarchy RecursiveHierarchy pair, else
   * "ResponsiveTable" (FE getTableType).
   */
  type?: 'AnalyticalTable' | 'GridTable' | 'ResponsiveTable' | 'TreeTable';
  /** @defaultValue "Auto" */
  selectionMode?: 'Auto' | 'ForceMulti' | 'ForceSingle' | 'Multi' | 'None' | 'Single';
  /** Tree tables: leaves cannot be selected. @defaultValue false */
  disableLeafSelection?: boolean;
  creationMode?: $ManifestCreationModeSettings;
  /** @defaultValue true */
  enableExport?: boolean;
  exportFileName?: string;
  exportSheetName?: string;
  exportRequestSize?: number;
  disableCopyToClipboard?: boolean;
  /** Default: false on the list report (FE: true only on phones). */
  enableFullScreen?: boolean;
  /** true / false, or the panels: Sort and Column by default, Group for responsive tables, Group and Aggregate for analytical tables. */
  personalization?: boolean | { sort?: boolean; column?: boolean; filter?: boolean; group?: boolean; aggregate?: boolean };
  quickVariantSelection?: $QuickVariantSelectionSettings;
  /** Table title; default UI.HeaderInfo/TypeNamePlural. */
  header?: string;
  /** @defaultValue true */
  headerVisible?: boolean;
  /** Grid tables. Default "Auto". */
  rowCountMode?: 'Auto' | 'Fixed' | 'Interactive';
  /** Responsive tables: the "select all" check box. */
  selectAll?: boolean;
  /** @defaultValue 200 */
  selectionLimit?: number;
  frozenColumnCount?: number;
  /** @defaultValue false */
  disableColumnFreeze?: boolean;
  /** @defaultValue false */
  widthIncludingColumnHeader?: boolean;
  /** @defaultValue false */
  condensedTableLayout?: boolean;
  /** @defaultValue "Block" */
  popinLayout?: 'Block' | 'GridLarge' | 'GridSmall';
  /** Rows per request: UI.PresentationVariant/MaxItems, else 200 (TreeTable), 100 (GridTable, AnalyticalTable), 30 (FE getThreshold). */
  threshold?: number;
  /** Default: Capabilities.SearchRestrictions/Searchable; analytical tables: ApplySupported with "search". */
  isSearchable?: boolean;
  readOnly?: boolean;
  /** Comma-separated properties whose columns are left out. */
  ignoredFields?: string;
  /** Tree tables: qualifier of Aggregation.RecursiveHierarchy (default: the type's first hierarchy pair). */
  hierarchyQualifier?: string;
  /** A row was pressed (FE names an extension function; react-idiom). Default: navigation to the object page. */
  rowPress?(e: Table$RowPressEvent): void;
  /** The selection changed (FE names an extension function; react-idiom). */
  selectionChange?(e: Table$SelectionChangeEvent): void;
}

/** `controlConfiguration › @UI.LineItem` (FE TableManifestConfiguration). */
export interface $ManifestTableConfiguration {
  tableSettings?: $ManifestTableSettings;
  /** Custom toolbar actions and menus, by key. */
  actions?: Record<string, $ManifestActionSettings>;
  /** Custom columns, by key. */
  columns?: Record<string, $ManifestColumnSettings>;
}

/** A filter field of `controlConfiguration › @UI.SelectionFields › filterFields` (FE FilterFieldManifestConfiguration). */
export interface $ManifestFilterFieldSettings {
  label?: string;
  /** The property the field filters; default the key. */
  property?: string;
  /** Editor of a custom filter field (FE: a fragment name; react-idiom). */
  template?(ctx: FilterFieldTemplateContext): ReactNode;
  /** @defaultValue "Default" */
  availability?: 'Adaptation' | 'Default' | 'Hidden';
  required?: boolean;
  position?: $PositionSettings;
}

/** `controlConfiguration › @UI.SelectionFields` (FE FilterManifestConfiguration). */
export interface $ManifestFilterConfiguration {
  filterFields?: Record<string, $ManifestFilterFieldSettings>;
  /** @defaultValue false */
  showClearButton?: boolean;
  /** Navigation properties offered in "Adapt Filters". */
  navigationPropertiesForPersonalization?: string[];
}

/** A KPI tag of `keyPerformanceIndicators` (FE AnalyticalKPIConfiguration / CustomKPIConfiguration). */
export interface $KPIConfiguration {
  /** Qualifier of the UI.KPI annotation. */
  qualifier?: string;
  /** Entity set of the KPI; default the page's. */
  entitySet?: string;
  /** Context path of the KPI ("/Set"); wins over `entitySet`. */
  contextPath?: string;
  /** A custom KPI (FE: a fragment name; react-idiom). */
  template?(): ReactNode;
}

/** `views › paths[]` (FE SingleViewPathConfiguration; a custom view with a React `template`). */
export interface $ViewPathSettings {
  key?: string;
  /** UI.SelectionPresentationVariant, UI.PresentationVariant or UI.LineItem path ("com.sap.vocabularies.UI.v1.SelectionPresentationVariant#Open"). */
  annotationPath?: string;
  /** Another entity set: a table per entity set (multiple content). */
  entitySet?: string;
  contextPath?: string;
  /** Tab text of a custom view. */
  label?: string;
  /** Content of a custom view (FE: a fragment name; react-idiom). */
  template?(): ReactNode;
}

/** Settings of the list report: the FE manifest settings (docs/26c §3–§7) plus the registered smart-kit extensions. */
export interface $ListReportSettings {
  /** Entity set of the list, e.g. "Orders" (or `contextPath`). */
  entitySet?: string;
  /** Context path of the list, e.g. "/Orders" (a parameterized set: "/P/Set"); wins over `entitySet`. */
  contextPath?: string;
  /** Row navigation per entity set: `detail.route` makes rows navigate to the object page (NavigationAdapter.toObject). */
  navigation?: Record<string, { detail?: { route?: string } }>;
  /** Settings of the controls by annotation path (table, filter bar). */
  controlConfiguration?: {
    '@com.sap.vocabularies.UI.v1.LineItem'?: $ManifestTableConfiguration;
    '@com.sap.vocabularies.UI.v1.SelectionFields'?: $ManifestFilterConfiguration;
  } & Record<string, object>;
  content?: { header?: { actions?: Record<string, $ManifestActionSettings> } };
  /** "Page": one variant management in the title for the filter bar and the table; "None": no variants. @defaultValue "Page" */
  variantManagement?: 'None' | 'Page';
  /**
   * "Enabled": load on start; "Disabled": only after "Go"; "Auto": load when the start variant has filter values (FE:
   * the standard variant applies automatically when filter values are set). @defaultValue "Auto"
   */
  initialLoad?: InitialLoadMode | boolean;
  /** Every filter change applies at once (no "Go"). @defaultValue false */
  liveMode?: boolean;
  /** Views: a tab per path (an IconTabBar), `showCounts` adds the number of items (default: with several entity sets). */
  views?: { paths: $ViewPathSettings[]; showCounts?: boolean };
  /** The view tabs stay at the top while the table scrolls. @defaultValue true */
  stickyMultiTabHeader?: boolean;
  /** KPI tags in the title by name (docs/29 §5). */
  keyPerformanceIndicators?: Record<string, $KPIConfiguration>;
  /** No filter bar (and no filter conditions). @defaultValue false */
  hideFilterBar?: boolean;
  /** The filter bar is not shown, its conditions apply. @defaultValue false */
  useHiddenFilterBar?: boolean;

  // smart-kit extensions (tools/ui5-alignment/deviations.lr5.json)
  /** Name of the service in `SmartKitProvider` `services`; default: the provider's `defaultService`. */
  service?: string;
  /** Key for variants and state restoration; defaults to the entity set. */
  pageKey?: string;
  /** Page title (standard variant text, e-mail subject); default UI.HeaderInfo/TypeNamePlural. */
  title?: string;
  /** Loaded rows of the main table (e.g. paging buttons in a flexible column layout). */
  onRowsChange?(rows: Row[]): void;
  /** Change this value to reload the tables, tab counts and chart. The first value does not reload. */
  refreshToken?: number | string;
  /** Before an export is written; return false to cancel (FE: controller extension onBeforeExport). */
  onBeforeExport?(e: Table$BeforeExportEvent): boolean | void | Promise<boolean | void>;
  /** After an export was written. */
  onExported?(e: Table$ExportedEvent): void;
  /** Whether views may be saved (default: the service's `VariantStore.canSave`, else true). */
  canSaveVariants?: boolean;
  /** Extra CSS class on the root element. */
  className?: string;
}

// ---------------------------------------------------------------------------------------------- helpers

const LINE_ITEM = '@com.sap.vocabularies.UI.v1.LineItem';
const SELECTION_FIELDS = '@com.sap.vocabularies.UI.v1.SelectionFields';

/** The entity set of `contextPath` / `entitySet`. */
export function entitySetOf(p: Pick<$ListReportSettings, 'entitySet' | 'contextPath'>): string {
  const set = p.contextPath ? p.contextPath.replace(/^\//, '') : p.entitySet;
  if (!set) throw new Error('ListReport: entitySet or contextPath is required');
  return set;
}

/** initialLoad with booleans as FE reads them (InitialLoadType). */
export const initialLoadOf = (v: InitialLoadMode | boolean | undefined): InitialLoadMode => (v === true ? 'Enabled' : v === false ? 'Disabled' : v ?? 'Auto');

/**
 * Whether the list loads on start with the standard variant (FE ListReportController `_shouldAutoTriggerSearch`,
 * FilterBar `isSearchTriggeredByInitialLoad`; the standard variant's executeOnSelect is true for "Enabled" and "Auto"):
 * "Enabled" always, "Disabled" never, "Auto" with page variant management and a filter value ($-keys such as the
 * editing status do not count).
 */
export function loadsOnStart(mode: InitialLoadMode, variantManagement: 'Page' | 'None' | 'Control', filters: FilterState): boolean {
  if (mode === 'Enabled') return true;
  if (mode === 'Disabled' || variantManagement === 'None') return false;
  return Object.entries(filters).some(([k, conds]) => !k.startsWith('$') && conds.length > 0);
}

/**
 * Filters for a table: conditions of other entity sets are dropped; draft lists always get the editing status
 * (FE DraftEditState: "All" when none is chosen); a view adds its selection variant as hidden filters (FE multiple
 * views: the view's SV is the table's `filters.hiddenFilters`).
 */
export function tableFilters(filters: FilterState, applies: (path: string) => boolean, draft: boolean, conditions: InitialCondition[] = []): { filters: FilterState; ignored: string[] } {
  const out: FilterState = {};
  const ignored: string[] = [];
  for (const [path, conds] of Object.entries(filters)) {
    if (path === EDIT_STATE) continue;
    if (applies(path)) out[path] = conds;
    else if (conds.length) ignored.push(path);
  }
  const hidden: FilterState = {};
  for (const c of conditions) (hidden[c.path] ??= []).push({ operator: c.operator as Operator, values: c.values, exclude: c.exclude || undefined });
  const withView = withHiddenFilters(out, hidden);
  if (draft) withView[EDIT_STATE] = [{ operator: 'EQ', values: [editStateOf(filters)] }];
  return { filters: withView, ignored };
}

/**
 * Filter bar fields a set of views takes away (FE FilterBar.ts getExcludedFilterProperties): the properties of the
 * views' selection variants that are not selection fields.
 */
export function viewExcludedPaths(views: { conditions: InitialCondition[] }[], selectionFields: string[]): Set<string> {
  return new Set(views.flatMap((v) => v.conditions.map((c) => c.path)).filter((path) => !selectionFields.includes(path)));
}

/** The transformations FE requires for the automatic AnalyticalTable (sap.fe.core.converters.controls.Common.Table getTableType). */
const ANALYTICAL_TRANSFORMATIONS = ['filter', 'identity', 'orderby', 'skip', 'top', 'groupby', 'aggregate', 'concat'];

/** Qualifier of the first qualified Aggregation / Hierarchy RecursiveHierarchy pair of the set's type (FE getHierarchyQualifier). */
function pairedHierarchy(model: MetaModel, entitySet: string): string | undefined {
  const typeName = model.entitySets[entitySet]?.typeName;
  return (typeName ? model.entityTypes[typeName]?.hierarchies ?? [] : []).find((h) => h.paired)?.qualifier;
}

/**
 * Table type without `tableSettings.type` (FE Table getTableType): AnalyticalTable when Aggregation.ApplySupported
 * allows all eight transformations, TreeTable with a recursive hierarchy pair, else ResponsiveTable.
 */
export function autoTableType(model: MetaModel, entitySet: string): 'ResponsiveTable' | 'AnalyticalTable' | 'TreeTable' {
  const aggregation = model.entitySets[entitySet]?.capabilities.aggregation;
  if (aggregation && ANALYTICAL_TRANSFORMATIONS.every((x) => aggregation.transformations.includes(x))) return 'AnalyticalTable';
  if (pairedHierarchy(model, entitySet) !== undefined) return 'TreeTable';
  return 'ResponsiveTable';
}

/** Rows per request (FE Table getThreshold): the setting, else MaxItems, else by table type. */
export function thresholdOf(type: string, setting: number | undefined, maxItems: number | undefined): number {
  if (setting !== undefined) return setting;
  if (maxItems) return maxItems;
  return type === 'TreeTable' ? 200 : type === 'GridTable' || type === 'AnalyticalTable' ? 100 : 30;
}

/**
 * Rows per request of a grid, analytical or tree table: the threshold (the OData list binding's prefetch) plus the
 * row count sap.ui.table's "Auto" row mode estimates before the table is rendered — the screen height divided by the
 * condensed row height, 25 px (sap.ui.table.rowmodes.Auto getMinRequestLength, TableUtils.DefaultRowHeight). FE's first
 * request of a grid list report is therefore `$top` = threshold + ⌈window height / 25⌉ (e.g. 100 + 44 at 1100 px).
 */
export function gridRequestSize(threshold: number, height = typeof window === 'undefined' ? 0 : window.innerHeight): number {
  return threshold + Math.ceil(height / 25);
}

/** Creation modes of a list report (FE _getCreationBehaviour: others fall back to NewPage). */
export function listCreationMode(name: $ManifestCreationModeSettings['name']): 'NewPage' | 'CreationDialog' | 'External' | 'AddViaValueHelp' {
  return name === 'CreationDialog' || name === 'External' || name === 'AddViaValueHelp' ? name : 'NewPage';
}

/** The personalization string of `Table` ("false" or the panels) for the FE setting. */
function personalizationOf(v: $ManifestTableSettings['personalization']): string | undefined {
  if (v === undefined || v === true) return undefined;
  if (v === false) return 'false';
  const panels = [v.column && 'Column', v.sort && 'Sort', v.filter && 'Filter', v.group && 'Group', v.aggregate && 'Aggregate'].filter(Boolean);
  return panels.length ? panels.join(',') : 'false';
}

/** One tab of `views` (FE MultipleModeControl). */
interface ViewTab {
  key: string;
  entitySet: string;
  title: string;
  /** Selection variant of the view (hidden filters). */
  conditions: InitialCondition[];
  /** Table metaPath (SPV or PV); undefined: the default LineItem. */
  metaPath?: string;
  /** The chart the view shows instead of a table, and its metaPath. */
  chart?: ChartModel;
  chartMetaPath?: string;
  /** A custom view. */
  template?: () => ReactNode;
}

/** The tabs of `views.paths` (FE ListReportConverter getViewsFromManifest). */
export function viewTabs(model: MetaModel, entitySet: string, paths: $ViewPathSettings[]): ViewTab[] {
  return paths.flatMap((cfg, i): ViewTab[] => {
    if (cfg.template) return [{ key: cfg.key ?? `custom${i}`, entitySet, title: cfg.label ?? '', conditions: [], template: cfg.template }];
    const set = cfg.contextPath ? cfg.contextPath.replace(/^\//, '') : cfg.entitySet ?? entitySet;
    const typeName = model.entitySets[set]?.typeName;
    const ui = typeName ? model.ui[typeName] : undefined;
    if (!ui) return [];
    const path = cfg.annotationPath ?? 'com.sap.vocabularies.UI.v1.LineItem';
    const { term, qualifier } = parseAnnotationPath(path.startsWith('@') ? path : `@${path}`);
    const key = cfg.key ?? path;
    const plural = ui.headerInfo.typeNamePlural;
    const defaultView = (title: string): ViewTab => (ui.defaultChart !== undefined
      ? { key, entitySet: set, title, conditions: [], chart: ui.charts[ui.defaultChart], chartMetaPath: '@com.sap.vocabularies.UI.v1.PresentationVariant' }
      : { key, entitySet: set, title, conditions: [] });
    if (term === 'SelectionPresentationVariant' && qualifier) {
      const v = ui.views.find((x) => x.id === qualifier);
      if (!v) return [];
      const chartQualifier = v.chart ? Object.keys(ui.charts).find((k) => ui.charts[k] === v.chart) : undefined;
      return [v.visualization === 'chart' && v.chart
        ? { key, entitySet: set, title: v.text, conditions: v.conditions, chart: v.chart, chartMetaPath: `@com.sap.vocabularies.UI.v1.Chart${chartQualifier ? `#${chartQualifier}` : ''}` }
        : { key, entitySet: set, title: v.text, conditions: v.conditions, metaPath: `@com.sap.vocabularies.UI.v1.SelectionPresentationVariant#${qualifier}` }];
    }
    if (term === 'PresentationVariant' && qualifier) {
      const pv = ui.presentationVariants[qualifier];
      if (!pv) return [];
      const title = pv.text ?? plural;
      if (pv.lineItemQualifier === undefined && pv.chartQualifier !== undefined && ui.charts[pv.chartQualifier]) {
        return [{ key, entitySet: set, title, conditions: [], chart: ui.charts[pv.chartQualifier], chartMetaPath: `@com.sap.vocabularies.UI.v1.PresentationVariant#${qualifier}` }];
      }
      return [{ key, entitySet: set, title, conditions: [], metaPath: `@com.sap.vocabularies.UI.v1.PresentationVariant#${qualifier}` }];
    }
    return [defaultView(ui.presentationVariants['']?.text ?? plural)];
  });
}

/** One entry of `quickVariantSelection` (FE QuickFilter): a selection variant applied as hidden filters of the table. */
interface QuickVariant { key: string; text: string; conditions: InitialCondition[]; view?: ViewModel }

function quickVariants(ui: EntityUi, cfg: $QuickVariantSelectionSettings | undefined): QuickVariant[] {
  return (cfg?.paths ?? []).flatMap(({ annotationPath }) => {
    const { term, qualifier } = parseAnnotationPath(annotationPath.startsWith('@') ? annotationPath : `@${annotationPath}`);
    if (term === 'SelectionPresentationVariant') {
      const v = ui.views.find((x) => x.id === qualifier);
      return v ? [{ key: annotationPath, text: v.text, conditions: v.conditions, view: v }] : [];
    }
    if (term === 'SelectionVariant') {
      const sv = ui.selectionVariants[qualifier];
      return sv ? [{ key: annotationPath, text: ui.selectionVariantTexts?.[qualifier] ?? qualifier, conditions: sv }] : [];
    }
    return [];
  });
}

/** Orders keyed entries by `position` (FE ConfigurableObject insertCustomElements, relative to each other). */
function positioned<T extends { position?: { anchor?: string; placement?: string } }>(entries: Record<string, T>): [string, T][] {
  const out: [string, T][] = [];
  const pending = Object.entries(entries);
  for (const e of pending.filter(([, v]) => !v.position?.anchor || !(v.position.anchor in entries))) out.push(e);
  for (const e of pending.filter(([, v]) => v.position?.anchor && v.position.anchor in entries)) {
    const at = out.findIndex(([k]) => k === e[1].position!.anchor);
    if (at < 0) out.push(e);
    else out.splice(e[1].position!.placement === 'Before' ? at : at + 1, 0, e);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------- component

export function ListReport(props: $ListReportSettings) {
  return (
    <MessageProvider>
      <ListReportInner {...props} />
    </MessageProvider>
  );
}

function ListReportInner(p: $ListReportSettings) {
  const entitySet = entitySetOf(p);
  const liveMode = p.liveMode ?? false;
  const initialLoad = initialLoadOf(p.initialLoad);
  const variantManagement = p.variantManagement ?? 'Page';
  const tableConfig = p.controlConfiguration?.[LINE_ITEM];
  const ts: $ManifestTableSettings = tableConfig?.tableSettings ?? {};
  const filterConfig = p.controlConfiguration?.[SELECTION_FIELDS];
  const hideFilterBar = p.hideFilterBar ?? false;
  const t = useText();
  const { navigation } = useSmartKit();
  const service = useService(p.service);
  const model = service.model;
  const messages = useMessages();
  const pageKey = p.pageKey ?? `list:${entitySet}`;
  const { ui, set } = useMetaModel(entitySet, { service: p.service });
  const draft = Boolean(set.draft?.root);

  // Views (FE ListReportConverter / MultipleModeControl): a tab per path; the properties of the views' selection
  // variants that are not selection fields leave the filter bar (FE FilterBar.ts getExcludedFilterProperties).
  const tabs = useMemo(() => (p.views ? viewTabs(model, entitySet, p.views.paths) : []), [model, entitySet, p.views]);
  const quick = useMemo(() => quickVariants(ui, ts.quickVariantSelection), [ui, ts.quickVariantSelection]);
  const viewPaths = useMemo(() => viewExcludedPaths([...tabs.filter((x) => x.entitySet === entitySet), ...quick], ui.selectionFields), [tabs, quick, entitySet, ui.selectionFields]);
  const showCounts = p.views?.showCounts ?? new Set(tabs.map((x) => x.entitySet)).size > 1;

  const filter = useFilterState(entitySet, { service: p.service, pageKey, liveMode, autoExecute: false });
  const [view, setView] = usePageState<{ columns?: string[]; sort?: SortItem[]; groupBy?: string | null; totals?: string[]; headerExpanded?: boolean; headerPinned?: boolean; tab?: string; quick?: string }>(`${pageKey}:view`, {});
  const columns = view.columns;
  const sort = view.sort ?? ui.presentation.sortOrder;
  const activeTab = view.tab && tabs.some((x) => x.key === view.tab) ? view.tab : tabs[0]?.key;
  const activeQuick = quick.find((x) => x.key === view.quick) ?? quick[0];

  const standard = useMemo<VariantContent>(
    () => ({ filters: filter.defaults.filters, search: '', filterFields: filter.defaults.fields, sort: ui.presentation.sortOrder, custom: tabs.length || quick.length ? { tab: tabs[0]?.key, quick: quick[0]?.key } : undefined }),
    [filter.defaults, ui], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const apply = (v: { key?: string; content: VariantContent; autoApply: boolean }) => {
    // the standard variant applies automatically by initialLoad (FE executeOnSelectionForStandardDefault)
    const auto = v.key === STANDARD_VARIANT_ID ? loadsOnStart(initialLoad, variantManagement, v.content.filters ?? {}) : v.autoApply;
    filter.load({ filters: v.content.filters, search: v.content.search, fields: v.content.filterFields }, auto || liveMode);
    const custom = v.content.custom as { tab?: string; quick?: string } | undefined;
    setView((s) => ({ ...s, columns: v.content.columns, sort: v.content.sort, groupBy: v.content.groupBy, totals: v.content.totals, tab: custom?.tab ?? s.tab, quick: custom?.quick ?? s.quick }));
  };
  const variants = useVariants(pageKey, { service: p.service, standard, enabled: variantManagement !== 'None', onDefaultLoaded: (v) => apply({ key: v.id, content: v.content, autoApply: v.autoApply }) });
  const initialized = useRef(false);
  useEffect(() => {
    if (initialized.current || variants.isLoading) return;
    initialized.current = true;
    if (filter.applied !== null || variants.variants.some((v) => v.isDefault)) return;
    if (hideFilterBar || loadsOnStart(initialLoad, variantManagement, filter.filters)) filter.go();
  }, [variants.isLoading, variants.variants, filter, initialLoad, variantManagement, hideFilterBar]);
  // The page variant stores the selected view (FE: the IconTabBar's selected key is part of the page variant).
  const content: VariantContent = { filters: filter.filters, search: filter.search, filterFields: filter.fields, columns, sort, groupBy: view.groupBy, totals: view.totals, custom: tabs.length || quick.length ? { tab: activeTab, quick: activeQuick?.key } : undefined };

  // LR-13: expanded when no query ran on start, collapsed otherwise.
  const headerExpanded = view.headerExpanded ?? filter.applied === null;
  const setHeaderExpanded = (v: boolean) => setView((s) => ({ ...s, headerExpanded: v }));

  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = rootRef.current;
    const list = root?.querySelector<HTMLElement>('.sk-list-tabs__list');
    if (!root) return;
    if (!list || typeof ResizeObserver === 'undefined') { root.style.removeProperty('--sk-tabs-height'); return; }
    const ro = new ResizeObserver(() => root.style.setProperty('--sk-tabs-height', `${list.offsetHeight}px`));
    ro.observe(list);
    return () => ro.disconnect();
  });
  const tableTypeOf = (set: string) => ts.type ?? autoTableType(model, set);
  const tableType = tableTypeOf(entitySet);
  const responsive = tableType === 'ResponsiveTable';

  // LR-14: initial focus.
  const latestFilter = useRef(filter);
  latestFilter.current = filter;
  useEffect(() => {
    let tries = 0;
    let stopped = false;
    const stop = () => { stopped = true; };
    document.addEventListener('pointerdown', stop, true);
    document.addEventListener('keydown', stop, true);
    const h = setInterval(() => {
      const root = rootRef.current;
      if (!root || stopped || ++tries > 60) return clearInterval(h);
      if (!initialized.current) return;
      if (latestFilter.current.applied !== null && !root.querySelector('.ag-row[row-index="0"], [data-sk-row], [data-sk-nodata], .sk-table__error, [data-sk-chart]')) return;
      const activeEl = document.activeElement;
      if (activeEl && activeEl !== document.body && activeEl !== document.documentElement) return;
      let target: HTMLElement | null = null;
      const expanded = Boolean(root.querySelector('.sk-dynamic-page__header'));
      if (expanded) {
        const missing = latestFilter.current.missingRequired[0];
        if (missing) target = root.querySelector<HTMLElement>(`[data-sk-filter="${missing}"] input:not([type="hidden"])`);
        target ??= liveMode ? root.querySelector<HTMLElement>('[data-sk-filter] input:not([type="hidden"])') : root.querySelector<HTMLElement>('[data-sk-go]');
      } else target = root.querySelector<HTMLElement>('.ag-row[row-index="0"] [role="gridcell"], tr[data-sk-row] [data-sk-cell]');
      target?.focus();
    }, 100);
    return () => {
      clearInterval(h);
      document.removeEventListener('pointerdown', stop, true);
      document.removeEventListener('keydown', stop, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once on mount
  }, []);

  // Draft lists: "Editing Status" filter (FE sap.fe.macros.filterBar.DraftEditState, non-collaborative draft).
  const filterExtend = useMemo<ExtendEntry<FilterFieldItem>[] | undefined>(() => (draft ? [
    {
      id: EDIT_STATE, position: 'start',
      item: {
        id: EDIT_STATE, label: t('draft.editingStatus'),
        render: ({ conditions, onChange, label, id }) => (
          <Select
            id={id} label={label} allowDeselect={false} data-sk-editing-status
            value={editStateOf({ [EDIT_STATE]: conditions }) || 'ALL'}
            data={DRAFT_EDIT_STATES.map((v) => ({ value: v || 'ALL', label: t(`draft.editState.${v || 'ALL'}`) }))}
            onChange={(v) => onChange(!v || v === 'ALL' ? [] : [{ operator: 'EQ', values: [v] }])}
          />
        ),
      },
    },
  ] : undefined), [draft, t]);
  const filterFields = useMemo<$FilterFieldSettings[] | undefined>(() => (filterConfig?.filterFields
    ? Object.entries(filterConfig.filterFields).map(([key, f]) => ({
      key, label: f.label, property: f.property ?? undefined, required: f.required, availability: f.availability, template: f.template,
      ...(f.position?.placement === 'End' ? {} : { anchor: f.position?.anchor, placement: f.position?.placement }),
    }))
    : undefined), [filterConfig?.filterFields]);
  // FE: the basic search follows the main table; an AnalyticalTable searches only with the `search` transformation
  const aggregation = model.entitySets[entitySet]?.capabilities.aggregation;
  const noSearch = tableType === 'AnalyticalTable' && Boolean(aggregation) && !aggregation!.transformations.includes('search');
  const barState = viewPaths.size || noSearch ? { ...filter, fields: viewPaths.size ? filter.fields.filter((f) => !viewPaths.has(f)) : filter.fields, ...(noSearch ? { searchable: false } : {}) } : filter;

  const queryFor = (set: string, conditions: InitialCondition[] = []) => {
    const applied = hideFilterBar ? { filters: {}, search: '' } : filter.applied;
    if (applied === null) return { query: null, ignored: [] as string[] };
    const typeName = model.entitySets[set]!.typeName;
    const caps = model.entitySets[set]!.capabilities;
    const applies = (path: string) => Boolean(model.entityTypes[typeName]!.properties[path.split('/')[0]!] || model.entityTypes[typeName]!.navigations[path.split('/')[0]!]) && isFilterable(caps, path);
    const r = tableFilters(applied.filters, applies, Boolean(model.entitySets[set]!.draft?.root), conditions);
    return { query: { filters: r.filters, search: applied.search }, ignored: r.ignored };
  };

  // Host refresh (refreshToken): counts the changes, so the first value does not reload.
  const [refreshRevision, setRefreshRevision] = useState(0);
  const lastToken = useRef(p.refreshToken);
  useEffect(() => {
    if (lastToken.current === p.refreshToken) return;
    lastToken.current = p.refreshToken;
    setRefreshRevision((n) => n + 1);
  }, [p.refreshToken]);
  // The tables reload through their ref (sap.fe.macros.Table#refresh).
  const tableRefs = useRef(new Set<{ refresh(): void }>());
  const tableRef = useCallback((r: { refresh(): void } | null) => {
    if (!r) return undefined;
    tableRefs.current.add(r);
    return () => { tableRefs.current.delete(r); };
  }, []);
  const refreshedRevision = useRef(refreshRevision);
  useEffect(() => {
    if (refreshedRevision.current === refreshRevision) return;
    refreshedRevision.current = refreshRevision;
    for (const r of tableRefs.current) r.refresh();
  }, [refreshRevision]);

  // Counts (FE MultipleModeControl / QuickFilter with showCounts): `<set>/$count` with the view's selection variant
  // first, for the views that are not shown (the shown table counts its own rows).
  const [activeCount, setActiveCount] = useState<number | undefined>(undefined);
  const countRequest = (set: string, q: { filters: FilterState; search: string }): QueryRequest => ({
    source: { entitySet: set }, select: [], expand: [], orderBy: [], filters: q.filters,
    search: model.entitySets[set]!.capabilities.searchable && q.search ? q.search : undefined, count: false, hiddenFiltersFirst: true,
  });
  const countTargets = [
    ...(showCounts ? tabs.filter((x) => !x.template && x.key !== activeTab).map((x) => ({ key: `tab:${x.key}`, set: x.entitySet, q: queryFor(x.entitySet, x.conditions).query })) : []),
    ...(ts.quickVariantSelection?.showCounts ? quick.map((x) => ({ key: `quick:${x.key}`, set: entitySet, q: queryFor(entitySet, x.conditions).query })) : []),
  ];
  const countResults = useQueries({
    queries: countTargets.map((x) => ({
      queryKey: ['smart-kit', 'view-count', service.name, x.set, JSON.stringify(x.q), refreshRevision],
      enabled: Boolean(x.q) && model.entitySets[x.set]!.capabilities.countable,
      queryFn: async ({ signal }: { signal: AbortSignal }) => {
        const req = countRequest(x.set, x.q!);
        return service.dataProvider.count ? service.dataProvider.count(req, { signal }) : (await service.dataProvider.query({ ...req, top: 0, count: true }, { signal })).count;
      },
    })),
  });
  const countOf = (key: string): number | undefined => countResults[countTargets.findIndex((x) => x.key === key)]?.data;

  const drilldown = (dimension: string, value: string) => {
    // Drilldown to the details of the aggregated amount: filter the list by the element (docs/12 U-4).
    filter.setConditions(dimension, [{ operator: 'EQ', values: [value] }]);
    if (!liveMode) setTimeout(() => latestFilter.current.go(), 0);
  };

  // Quick variant selection (FE QuickFilter: a segmented button with ≤ 3 entries, else a select).
  const quickLabel = (x: QuickVariant) => { const n = countOf(`quick:${x.key}`); return n === undefined ? x.text : t('table.title', { title: x.text, count: n }); };
  const contentSwitch = quick.length > 1 ? (
    quick.length <= 3 ? (
      <SegmentedControl size="xs" value={activeQuick?.key} onChange={(v) => setView((s) => ({ ...s, quick: v }))} data={quick.map((x) => ({ value: x.key, label: quickLabel(x) }))} aria-label={t('views.label')} data-sk-view-switch="segmented" />
    ) : (
      <Select size="xs" w={200} value={activeQuick?.key} allowDeselect={false} onChange={(v) => v && setView((s) => ({ ...s, quick: v }))} data={quick.map((x) => ({ value: x.key, label: quickLabel(x) }))} aria-label={t('views.label')} data-sk-view-switch="select" />
    )
  ) : null;

  // Columns and actions of the manifest (FE getTableAnnotationConfiguration / getActionsFromManifest).
  const manifestColumns = useMemo<$ColumnSettings[] | undefined>(() => (tableConfig?.columns
    ? Object.entries(tableConfig.columns).map(([key, c]) => ({
      key, header: c.header, template: c.template, properties: c.properties, width: c.width, importance: c.importance, horizontalAlign: c.horizontalAlign,
      disableExport: c.disableExport, ...(c.position?.placement === 'End' ? {} : { anchor: c.position?.anchor, placement: c.position?.placement }),
    }))
    : undefined), [tableConfig?.columns]);
  const manifestActions = useMemo<{ actions?: $ActionSettings[]; groups?: ActionGroup[] }>(() => {
    const entries = Object.entries(tableConfig?.actions ?? {});
    const actions: $ActionSettings[] = entries.filter(([, a]) => !a.menu).map(([key, a]) => ({
      key, text: a.text ?? key, anchor: a.position?.anchor, placement: a.position?.placement === 'End' ? undefined : a.position?.placement,
      enabled: a.enabled, visible: a.visible, requiresSelection: a.requiresSelection, enableOnSelect: a.enableOnSelect,
      onPress: a.press ? (e) => a.press!({ selectedContexts: e.selectedContexts }) : undefined,
    }));
    const groups: ActionGroup[] = entries.filter(([, a]) => a.menu).map(([key, a]) => ({ id: key, label: a.text ?? key, actions: a.menu! }));
    return { actions: actions.length ? actions : undefined, groups: groups.length ? groups : undefined };
  }, [tableConfig?.actions]);
  // Row navigation: navigation › <set> › detail › route (else the NavigationAdapter decides, kit-extension).
  const navigable = (set: string) => {
    const n = p.navigation?.[set];
    return n ? Boolean(n.detail?.route) : undefined;
  };
  const creation = listCreationMode(ts.creationMode?.name);
  const maxItems = ui.presentationVariants['']?.maxItems;

  const table = (tab: ViewTab | undefined, key: string, title: string) => {
    const set = tab?.entitySet ?? entitySet;
    const main = set === entitySet && !tab?.metaPath;
    const conditions = [...(tab?.conditions ?? []), ...(set === entitySet && activeQuick ? activeQuick.conditions : [])];
    const q = queryFor(set, conditions);
    if (tab?.template) return tab.template();
    if (tab?.chart || (!tab && ui.defaultChart !== undefined)) {
      const chartMetaPath = tab?.chartMetaPath ?? '@com.sap.vocabularies.UI.v1.PresentationVariant';
      return <Chart revision={refreshRevision} contextPath={`/${set}`} metaPath={chartMetaPath} service={p.service} query={q.query} onDrilldown={(e) => drilldown(e.dimension, e.value)} />;
    }
    const type = tableTypeOf(set);
    const threshold = thresholdOf(type, ts.threshold, set === entitySet ? maxItems : undefined);
    const own = main && !activeQuick?.view;
    const common: Omit<$TableSettings, 'type' | 'ref'> = {
      service: p.service,
      contextPath: `/${set}`,
      metaPath: tab?.metaPath ?? (activeQuick?.view ? `@com.sap.vocabularies.UI.v1.SelectionPresentationVariant#${activeQuick.view.id}` : undefined),
      query: q.query,
      showOverlay: filter.dirty && !liveMode,
      visibleColumns: own ? columns : undefined,
      onVisibleColumnsChange: own ? (c) => setView((s) => ({ ...s, columns: c })) : undefined,
      sort: own ? sort : undefined,
      onSortChange: own ? (s) => setView((x) => ({ ...x, sort: s })) : undefined,
      groupBy: own ? view.groupBy : undefined,
      onGroupByChange: own ? (g) => setView((x) => ({ ...x, groupBy: g })) : undefined,
      totals: own ? view.totals : undefined,
      onTotalsChange: own ? (ids) => setView((x) => ({ ...x, totals: ids })) : undefined,
      columns: set === entitySet ? manifestColumns : undefined,
      actions: set === entitySet ? manifestActions.actions : undefined,
      actionGroups: set === entitySet ? manifestActions.groups : undefined,
      creationMode: { name: creation },
      onRowPress: ts.rowPress,
      onSelectionChange: ts.selectionChange,
      navigable: navigable(set),
      pageKey: `${pageKey}${key === 'main' ? '' : `:${key}`}`,
      header: ts.header ?? title,
      headerVisible: ts.headerVisible === false || (quick.length > 0 && ts.quickVariantSelection?.hideTableTitle) ? false : undefined,
      titleAddon: set === entitySet ? contentSwitch : undefined,
      onRowsChange: set === entitySet ? p.onRowsChange : undefined,
      onCountChange: tab && tab.key === activeTab ? setActiveCount : undefined,
      selectionMode: ts.selectionMode,
      enableExport: ts.enableExport,
      exportFileName: ts.exportFileName,
      exportSheetName: ts.exportSheetName,
      exportRequestSize: ts.exportRequestSize,
      disableCopyToClipboard: ts.disableCopyToClipboard,
      enableFullScreen: ts.enableFullScreen,
      personalization: personalizationOf(ts.personalization),
      rowCountMode: ts.rowCountMode,
      enableSelectAll: ts.selectAll,
      selectionLimit: ts.selectionLimit,
      frozenColumnCount: ts.frozenColumnCount,
      disableColumnFreeze: ts.disableColumnFreeze,
      widthIncludingColumnHeader: ts.widthIncludingColumnHeader,
      condensedTableLayout: ts.condensedTableLayout,
      popinLayout: ts.popinLayout,
      isSearchable: ts.isSearchable,
      readOnly: ts.readOnly,
      ignoredFields: ts.ignoredFields,
      threshold,
      scrollThreshold: type === 'ResponsiveTable' ? undefined : gridRequestSize(threshold),
      onBeforeExport: p.onBeforeExport,
      onExported: p.onExported,
    };
    return (
      <>
        {q.ignored.length ? <Text size="sm" c="dimmed" data-sk-ignored-filters>{t('views.ignoredFilters', { fields: q.ignored.join(', ') })}</Text> : null}
        {type === 'TreeTable'
          ? <TreeTable key={key} ref={tableRef} {...common} disableLeafSelection={ts.disableLeafSelection} hierarchyQualifier={ts.hierarchyQualifier ?? (ts.type ? undefined : pairedHierarchy(model, set))} />
          : <Table key={key} ref={tableRef} {...common} type={type} />}
      </>
    );
  };

  const mainTitle = ui.headerInfo.typeNamePlural || t('object.sections');
  let body: ReactNode;
  if (tabs.length) {
    body = (
      <Tabs value={activeTab} onChange={(v) => v && setView((s) => ({ ...s, tab: v }))} keepMounted={false} className="sk-list-tabs" data-sk-list-tabs>
        <Tabs.List className="sk-list-tabs__list">
          {tabs.map((x) => {
            const n = !showCounts || x.template ? undefined : x.key === activeTab ? activeCount : countOf(`tab:${x.key}`);
            return (
              <Tabs.Tab key={x.key} value={x.key} data-sk-list-tab={x.key}>
                <span data-sk-tab-text>{x.title}</span>
                {n === undefined ? null : <span data-sk-tab-count={n}>{` (${n})`}</span>}
              </Tabs.Tab>
            );
          })}
        </Tabs.List>
        {tabs.map((x) => (
          <Tabs.Panel key={x.key} value={x.key} className="sk-list-tabs__panel">
            {table(x, x.key, x.title)}
          </Tabs.Panel>
        ))}
      </Tabs>
    );
  } else {
    body = table(undefined, 'main', mainTitle);
  }

  const pageTitle = p.title ?? ui.headerInfo.typeNamePlural;
  const shareHref = navigation?.href?.({ kind: 'list', entitySet, service: service.name });
  const share = shareHref ? <Share title={pageTitle} href={shareHref} /> : null;
  const headerActions = positioned(p.content?.header?.actions ?? {}).filter(([, a]) => a.visible !== false).map(([key, a]) => (
    <Button key={key} size="xs" variant="subtle" disabled={a.enabled === false} onClick={() => a.press?.({ selectedContexts: [] })} data-sk-header-action={key}>{a.text ?? key}</Button>
  ));
  const hasMessages = Boolean(messages?.messages.length);
  const kpis = p.keyPerformanceIndicators && Object.keys(p.keyPerformanceIndicators).length ? p.keyPerformanceIndicators : undefined;
  const heading = variantManagement === 'None'
    ? <Title order={2} size="h4" data-sk-page-title>{pageTitle}</Title>
    : <VariantManagement variants={variants} content={content} onSelect={apply} standardName={p.title} supportApplyAutomatically={!liveMode} creationAllowed={p.canSaveVariants} />;

  return (
    <div ref={rootRef} className={['sk-list-report', responsive ? 'sk-list-report--responsive' : '', p.stickyMultiTabHeader === false ? 'sk-list-report--static-tabs' : '', p.className].filter(Boolean).join(' ')}>
      <DynamicPage
        fitContent={!responsive}
        headerPinned={view.headerPinned ?? false}
        onPinnedStateChange={(e) => setView((s) => ({ ...s, headerPinned: e.pinned }))}
        title={(
          <DynamicPageTitle
            heading={kpis ? (
              // FE ListReport.view.xml: the variant management and the KPI tags in one horizontal layout
              <Group gap="xs" wrap="nowrap" data-sk-kpi-tags>
                {heading}
                <KpiTags entitySet={entitySet} service={p.service} keyPerformanceIndicators={kpis} />
              </Group>
            ) : heading}
            snappedTitleOnMobile={pageTitle}
            actions={headerActions.length || share ? <Group gap="xs" wrap="nowrap">{headerActions}{share}</Group> : undefined}
            snappedContent={hideFilterBar || p.useHiddenFilterBar ? undefined : <FilterSummary entitySet={entitySet} service={p.service} filters={Object.fromEntries(Object.entries(filter.filters).filter(([k]) => k !== EDIT_STATE))} search={filter.search} />}
            onStateChange={(e) => setHeaderExpanded(e.isExpanded)}
          />
        )}
        header={hideFilterBar || p.useHiddenFilterBar ? undefined : (
          <DynamicPageHeader>
            <FilterBar state={barState} extend={filterExtend} filterFields={filterFields} showClearButton={filterConfig?.showClearButton} navigationPropertiesForPersonalization={filterConfig?.navigationPropertiesForPersonalization} showMessages={false} />
          </DynamicPageHeader>
        )}
        headerExpanded={headerExpanded}
        footer={hasMessages ? <Group justify="flex-start" data-sk-footer><MessageButton /></Group> : undefined}
        showFooter={hasMessages}
        data-testid={`list-${entitySet}`}
        content={body}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------------------------- KPI tags

/**
 * KPI tags of the list report title (FE manifest `keyPerformanceIndicators`, sap.fe.core.converters.controls.Common.KPI,
 * sap.fe.core.controllerextensions.KPIManagement, sap.fe.macros.kpiTag.AnalyticalKPITag; docs/29 §5): one tag per
 * configured UI.KPI, its value aggregated on the server (`aggregate(<value>,<unit>)` with the KPI's selection variant and,
 * on draft entity sets, `IsActiveEntity eq true`), shown as a KPITag (sap.fe.macros.KPITag); a custom KPI renders its template.
 */

const constant = (r: ValueRef | undefined): number | undefined => {
  if (!r || !('value' in r)) return undefined;
  const n = Number(r.value);
  return Number.isFinite(n) ? n : undefined;
};

/** FE KPIFormatter labelFormat: the first letters of the title's words (one word: its first three letters), upper case. */
export function kpiLabel(title: string | undefined): string {
  if (!title) return '';
  const w = title.split(' ');
  if (w.length === 1) return w[0]!.substring(0, 3).toUpperCase();
  if (w.length === 2) return (w[0]!.substring(0, 1) + w[1]!.substring(0, 1)).toUpperCase();
  return (w[0]!.substring(0, 1) + w[1]!.substring(0, 1) + w[2]!.substring(0, 1)).toUpperCase();
}

/** sap.ui.core.MessageType of a criticality (FE getMessageTypeFromCriticalityType / MessageTypeFromCriticality). */
const MESSAGE_TYPE: Record<number, string> = { 0: 'None', 1: 'Error', 2: 'Warning', 3: 'Success', 5: 'Information' };

function statusOf(dp: DataPointModel, value: number, row: Record<string, unknown>): string {
  if (dp.criticality) {
    const c = 'value' in dp.criticality ? Number(dp.criticality.value) : Number(row[dp.criticality.path]);
    return MESSAGE_TYPE[c] ?? 'None';
  }
  if (dp.criticalityCalculation) return MESSAGE_TYPE[calculateCriticality(dp.criticalityCalculation, value, constant) ?? 0] ?? 'None';
  return 'None';
}

/** The KPI tags of `keyPerformanceIndicators` (FE: a KPI without ApplySupported, chart or aggregatable value is skipped). */
function KpiTags(p: { entitySet: string; service?: string; keyPerformanceIndicators: Record<string, $KPIConfiguration> }) {
  const service = useService(p.service);
  const { namespace, locale, intlLocale } = useSmartKit();
  const t = useText();
  const model = service.model;
  const custom = Object.entries(p.keyPerformanceIndicators).filter(([, c]) => c.template);
  const defs = Object.entries(p.keyPerformanceIndicators).flatMap(([name, c]) => {
    if (c.template || !c.qualifier) return [];
    const entitySet = c.contextPath ? c.contextPath.replace(/^\//, '') : c.entitySet ?? p.entitySet;
    const set = model.entitySets[entitySet];
    const kpi: NonNullable<EntityUi['kpis']>[string] | undefined = set ? model.ui[set.typeName]?.kpis?.[c.qualifier] : undefined;
    const source = { entitySet };
    // FE createAnalyticalKPIDefinition: ApplySupported, a chart in the Detail PV, and a custom aggregate as value
    if (!set || !kpi || !capabilitiesFor(model, entitySet).aggregation || kpi.chart === undefined || !isCustomAggregate(model, source, kpi.dataPoint.value)) return [];
    const filters: FilterState = {};
    for (const x of kpi.conditions) (filters[x.path] ??= []).push({ operator: x.operator as Operator, values: x.values, exclude: x.exclude || undefined });
    if (set.draft) filters.IsActiveEntity = [{ operator: 'EQ', values: [true] }];
    const crit = kpi.dataPoint.criticality && 'path' in kpi.dataPoint.criticality ? [kpi.dataPoint.criticality.path] : [];
    const req = buildTotalsRequest(model, { source, measures: [kpi.dataPoint.value, ...crit], filters: Object.keys(filters).length ? filters : undefined });
    const prop = resolvePath(model.entityTypes, set.typeName, kpi.dataPoint.value).property;
    return [{ name, kpi, req, prop }];
  });
  const results = useQueries({
    queries: defs.map((d) => ({
      queryKey: ['smart-kit', namespace, service.name, locale, 'kpi-tag', JSON.stringify(d.req)],
      queryFn: ({ signal }: { signal: AbortSignal }) => service.dataProvider.query({ ...d.req, top: 1, skip: 0 }, { signal }),
    })),
  });
  return (
    <>
      {defs.map((d, i) => {
        const row = results[i]?.data?.rows[0];
        if (!row) return null;
        const dp = d.kpi.dataPoint;
        const unitRef = d.prop?.unit;
        const unit = unitRef ? ('path' in unitRef ? row[unitRef.path] : unitRef.value) : undefined;
        const value = Number(row[dp.value.replace(/\//g, '_')]);
        // several units: "*" without unit (FE loadKPITagData)
        const multi = Boolean(unitRef) && (unit === null || unit === undefined || unit === '');
        const number = multi ? '*' : new Intl.NumberFormat(intlLocale, { notation: 'compact', minimumFractionDigits: 0, maximumFractionDigits: dp.fractionDigits ?? 1 }).format(value);
        const status = multi ? 'None' : statusOf(dp, value, row);
        const amount = unitRef ? (multi ? t('kpi.multiUnit') : `${number} ${String(unit)}`) : number;
        return (
          <span key={d.name} data-sk-kpi-tag={d.name}>
            <KPITag text={kpiLabel(d.kpi.title)} number={number} unit={multi ? undefined : unit === undefined ? undefined : String(unit)} status={status}
              tooltip={d.kpi.title ? t(`kpi.tooltip.${status === 'Error' || status === 'Warning' || status === 'Success' ? status : 'None'}`, { title: d.kpi.title, amount }) : undefined} />
          </span>
        );
      })}
      {custom.map(([name, c]) => <span key={name} data-sk-kpi-tag={name}>{c.template!()}</span>)}
    </>
  );
}
