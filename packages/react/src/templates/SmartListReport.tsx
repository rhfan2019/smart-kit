/**
 * List report page template, built only from public building blocks (AC-BOOT-01): variant management, filter bar,
 * table, filter summary, header expand/collapse and pin, initial focus and state restoration; phase 2: share,
 * multiple views and multiple content (LR General Layout), chart view with drilldown, responsive table, actions,
 * create dialog, working modes, footer messages (ADR-023) and the draft editing status.
 */
import { Group, SegmentedControl, Select, Tabs, Text, Tooltip } from '@mantine/core';
import {
  isFilterable, type Condition, type FilterState, type Operator, type Row, type SortItem, type VariantContent, type ViewModel,
} from '@rhfan2019/smart-kit-core';
import { useQueries } from '@tanstack/react-query';
import { BarChart3, Table2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ChartView, DynamicPage, FilterSummary, MessageButton, MessageProvider, ShareMenu, SmartFilterBar, SmartTable, SmartVariantManagement, useFilterState, useMessages,
  useMetaModel, usePageState, useService, useSmartKit, useText, useVariants,
  type ActionGroup, type ExportEvent, type ExtendEntry, type FilterFieldItem, type TableExtendEntry, type TableType,
} from '../index';

export interface ListContentItem {
  key: string;
  /** Entity set of the table (multiple content); defaults to the page's entity set. */
  entitySet?: string;
  title?: string;
  tableExtend?: TableExtendEntry[];
}

export interface SmartListReportProps {
  /** Entity set of the list, e.g. "Orders". Required. Columns come from `UI.LineItem`, filters from `UI.SelectionFields`, the title from `UI.HeaderInfo/TypeNamePlural`. */
  entitySet: string;
  /** Name of the service in `SmartKitProvider` `services`; default: the provider's `defaultService`. */
  service?: string;
  /** Key for variants and state restoration; defaults to the entity set. */
  pageKey?: string;
  /**
   * Live update mode (default true, recommended by the list report guideline): every change filters immediately.
   * False: manual update mode with "Go", for services where filtering on every change is too slow.
   */
  liveMode?: boolean;
  /** Execute the standard variant on load (default true). */
  autoExecute?: boolean;
  /** Page title; default `UI.HeaderInfo/TypeNamePlural` of the entity type. */
  title?: string;
  /** Extra buttons in the page header toolbar. */
  headerActions?: ReactNode;
  /** Insert, replace or remove filter fields (ids are the property paths). */
  filterExtend?: ExtendEntry<FilterFieldItem>[];
  /** Insert, replace or remove columns and toolbar actions (`TableExtendEntry`, ids as in the model). */
  tableExtend?: TableExtendEntry[];
  /** Row press; receives the row and its entity path. Default: `NavigationAdapter.toObject` when the adapter has an object page for the set. */
  onRowNavigate?(row: Row, path: string): void;
  /** Content between header and table (e.g. KPI cards). */
  beforeTable?: ReactNode;
  /**
   * "Show Filters / Hide Filters" in the title bar instead of the expand/collapse and pin buttons on the header border
   * (the variant the list report guideline describes for grid tables). Default false: the header features as in the
   * SAP reference app; the header collapses while the table is scrolled down and expands at the top, unless pinned.
   */
  filterToggle?: boolean;
  /** Extra CSS class on the root element. */
  className?: string;
  /**
   * Multiple views (LR Multiple Views) from the qualified UI.SelectionPresentationVariant annotations:
   * "switch" replaces the table title area with a segmented button (≤ 3 views) or a select (> 3); "tabs" shows a tab per view.
   */
  views?: { mode: 'switch' | 'tabs'; ids?: string[] };
  /** Multiple content (LR Multiple Content): a text-only tab per table, all filtered by the same filter bar. */
  contents?: ListContentItem[];
  /**
   * Table type: grid (desktop), responsive, or auto = responsive below 600px (LR Responsiveness, docs/12 U-17). The UI5
   * names (sap.ui.comp.smarttable.TableType) are accepted too: "Table" and "AnalyticalTable" = grid,
   * "ResponsiveTable" = responsive, "TreeTable" = grid tree table of the recursive hierarchy (docs/26 §3.10).
   */
  tableType?: 'grid' | 'responsive' | 'auto' | TableType;
  /** Tree tables: qualifier of Aggregation.RecursiveHierarchy (default: the type's first hierarchy). */
  hierarchyQualifier?: string;
  /** Offer a chart view from UI.Chart (qualifier; true = the first chart); views use the chart of their presentation variant. */
  chart?: boolean | string;
  /** Working mode after actions (LR Working Modes; default worklist). */
  workingMode?: 'worklist' | 'continuous';
  /** Menu buttons for similar table actions. */
  actionGroups?: ActionGroup[];
  /** Share button in the header toolbar (default true when the navigation adapter can build links). */
  share?: boolean;
  /** Loaded rows of the main table (e.g. paging buttons in a flexible column layout). */
  onRowsChange?(rows: Row[]): void;
  /**
   * Change this value to reload the tables, tab counts and chart (after the host changed data elsewhere, e.g. in a
   * drawer or dialog). The first value does not reload.
   */
  refreshToken?: number | string;
  /** Offer "Export to Spreadsheet" in the table toolbars (default true). */
  exportable?: boolean;
  /** Before an export is written; return false to cancel (see `SmartTable` `onBeforeExport`). */
  onBeforeExport?(e: ExportEvent): boolean | void | Promise<boolean | void>;
  /** After an export was written. */
  onExported?(e: ExportEvent): void;
  /**
   * Whether views may be saved (default: the service's `VariantStore.canSave`, else true). False: the view menu only
   * selects views (no Save, Save As, Manage).
   */
  canSaveVariants?: boolean;
}

const EDITING_STATUS = '$editingStatus';

/** Filters for a table: the custom editing status becomes draft conditions; conditions of other entity sets are dropped. */
function tableFilters(filters: FilterState, applies: (path: string) => boolean, draft: boolean): { filters: FilterState; ignored: string[] } {
  const out: FilterState = {};
  const ignored: string[] = [];
  for (const [path, conds] of Object.entries(filters)) {
    if (path === EDITING_STATUS) continue;
    if (applies(path)) out[path] = conds;
    else if (conds.length) ignored.push(path);
  }
  if (draft) {
    const status = String(filters[EDITING_STATUS]?.[0]?.values[0] ?? 'all');
    const eq = (v: unknown): Condition[] => [{ operator: 'EQ' as Operator, values: [v] }];
    out.IsActiveEntity = eq(true);
    if (status === 'unchanged') out.HasDraftEntity = eq(false);
    if (status === 'own') { out.HasDraftEntity = eq(true); out['DraftAdministrativeData/DraftIsCreatedByMe'] = eq(true); }
    if (status === 'others') { out.HasDraftEntity = eq(true); out['DraftAdministrativeData/DraftIsCreatedByMe'] = eq(false); }
  }
  return { filters: out, ignored };
}

function viewConditions(v: ViewModel | undefined, paths: Set<string>): FilterState {
  const out: FilterState = {};
  for (const c of (v?.conditions ?? []).filter((x) => paths.has(x.path))) (out[c.path] ??= []).push({ operator: c.operator as Operator, values: c.values, exclude: c.exclude || undefined });
  return out;
}

export function SmartListReport(props: SmartListReportProps) {
  return (
    <MessageProvider>
      <ListReportInner {...props} />
    </MessageProvider>
  );
}

function ListReportInner(props: SmartListReportProps) {
  const p = { ...props, liveMode: props.liveMode ?? true };
  const t = useText();
  const { navigation } = useSmartKit();
  const service = useService(p.service);
  const model = service.model;
  const messages = useMessages();
  const pageKey = p.pageKey ?? `list:${p.entitySet}`;
  const { ui, set } = useMetaModel(p.entitySet, { service: p.service });
  const draft = Boolean(set.draft?.root);

  // Multiple views: the views' filter fields are not offered in the filter bar (LR Multiple Views).
  const views = useMemo(() => (p.views ? ui.views.filter((v) => !p.views!.ids || p.views!.ids.includes(v.id)) : []), [p.views, ui.views]);
  // View-defining fields: conditions that differ between the views (a condition shared by all views, such as a
  // mandatory default, stays a normal filter field).
  const viewPaths = useMemo(() => {
    const all = new Set(views.flatMap((v) => v.conditions.map((c) => c.path)));
    const sig = (v: ViewModel, path: string) => JSON.stringify(v.conditions.filter((c) => c.path === path));
    return new Set([...all].filter((path) => views.some((v) => sig(v, path) !== sig(views[0]!, path))));
  }, [views]);
  const initialFilters = useMemo(() => {
    if (!viewPaths.size) return undefined;
    const filters: FilterState = {};
    for (const c of ui.selectionVariant) if (!viewPaths.has(c.path)) (filters[c.path] ??= []).push({ operator: c.operator as Operator, values: c.values, exclude: c.exclude || undefined });
    return { filters };
  }, [viewPaths, ui.selectionVariant]);

  // Execution on load waits for the variant list: a default variant decides whether to execute (LR-02, LR-15).
  const filter = useFilterState(p.entitySet, { service: p.service, pageKey, liveMode: p.liveMode, autoExecute: false, initial: initialFilters });
  const [view, setView] = usePageState<{ columns?: string[]; sort?: SortItem[]; groupBy?: string | null; totals?: string[]; headerExpanded?: boolean; headerPinned?: boolean; tab?: string; chart?: boolean }>(`${pageKey}:view`, {});
  const columns = view.columns;
  const sort = view.sort ?? ui.presentation.sortOrder;
  const tabs = p.contents?.length ? p.contents.map((c) => ({ key: c.key, entitySet: c.entitySet ?? p.entitySet, title: c.title, tableExtend: c.tableExtend })) : views.length ? views.map((v) => ({ key: v.id, entitySet: p.entitySet, title: v.text, tableExtend: p.tableExtend })) : [];
  const activeTab = view.tab && tabs.some((x) => x.key === view.tab) ? view.tab : tabs[0]?.key;
  const activeView = views.find((v) => v.id === activeTab);

  const standard = useMemo<VariantContent>(
    () => ({ filters: filter.defaults.filters, search: '', filterFields: filter.defaults.fields, sort: ui.presentation.sortOrder, custom: tabs.length ? { tab: tabs[0]!.key } : undefined }),
    [filter.defaults, ui], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const apply = (v: { content: VariantContent; autoApply: boolean }) => {
    filter.load({ filters: v.content.filters, search: v.content.search, fields: v.content.filterFields }, v.autoApply || p.liveMode === true);
    const custom = v.content.custom as { tab?: string; chart?: boolean } | undefined;
    setView((s) => ({ ...s, columns: v.content.columns, sort: v.content.sort, groupBy: v.content.groupBy, totals: v.content.totals, tab: custom?.tab ?? s.tab, chart: custom?.chart ?? false }));
  };
  const variants = useVariants(pageKey, { service: p.service, standard, onDefaultLoaded: (v) => apply({ content: v.content, autoApply: v.autoApply }) });
  const initialized = useRef(false);
  useEffect(() => {
    if (initialized.current || variants.isLoading) return;
    initialized.current = true;
    if (filter.applied === null && !variants.variants.some((v) => v.isDefault) && p.autoExecute !== false) filter.go();
  }, [variants.isLoading, variants.variants, filter, p.autoExecute]);
  // The page variant stores the selected tab and the chart/table choice (LR Variant Management).
  const content: VariantContent = { filters: filter.filters, search: filter.search, filterFields: filter.fields, columns, sort, groupBy: view.groupBy, totals: view.totals, custom: tabs.length || view.chart ? { tab: activeTab, chart: Boolean(view.chart) } : undefined };

  // LR-13: expanded when no query ran on start, collapsed otherwise.
  const headerExpanded = view.headerExpanded ?? filter.applied === null;
  const setHeaderExpanded = (v: boolean) => setView((s) => ({ ...s, headerExpanded: v }));

  // Table type: grid tables are for desktop and tablet only (LR Responsiveness).
  const rootRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1440);
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth || 1440));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    const root = rootRef.current;
    const list = root?.querySelector<HTMLElement>('.sk-list-tabs__list');
    if (!root) return;
    if (!list || typeof ResizeObserver === 'undefined') { root.style.removeProperty('--sk-tabs-height'); return; }
    const ro = new ResizeObserver(() => root.style.setProperty('--sk-tabs-height', `${list.offsetHeight}px`));
    ro.observe(list);
    return () => ro.disconnect();
  });
  const tableType = p.tableType ?? 'grid';
  const responsive = tableType === 'responsive' || tableType === 'ResponsiveTable' || (tableType === 'auto' && width < 600);

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
      const active = document.activeElement;
      if (active && active !== document.body && active !== document.documentElement) return;
      let target: HTMLElement | null = null;
      const expanded = Boolean(root.querySelector('.sk-dynamic-page__header'));
      if (expanded) {
        const missing = latestFilter.current.missingRequired[0];
        if (missing) target = root.querySelector<HTMLElement>(`[data-sk-filter="${missing}"] input:not([type="hidden"])`);
        target ??= p.liveMode ? root.querySelector<HTMLElement>('[data-sk-filter] input:not([type="hidden"])') : root.querySelector<HTMLElement>('[data-sk-go]');
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

  // Draft lists: "Editing Status" filter (LR Examples: draft handling enabled).
  const filterExtend = useMemo<ExtendEntry<FilterFieldItem>[] | undefined>(() => (draft ? [
    {
      id: EDITING_STATUS, position: 'start',
      item: {
        id: EDITING_STATUS, label: t('draft.editingStatus'),
        render: ({ conditions, onChange, label, id }) => (
          <Select
            id={id} label={label} allowDeselect={false} data-sk-editing-status
            value={String(conditions[0]?.values[0] ?? 'all')}
            data={(['all', 'own', 'others', 'unchanged'] as const).map((v) => ({ value: v, label: t(`draft.status.${v}`) }))}
            onChange={(v) => onChange(!v || v === 'all' ? [] : [{ operator: 'EQ', values: [v] }])}
          />
        ),
      },
    },
    ...(p.filterExtend ?? []),
  ] : p.filterExtend), [draft, p.filterExtend, t]);
  const barState = viewPaths.size ? { ...filter, fields: filter.fields.filter((f) => !viewPaths.has(f)) } : filter;

  const queryFor = (entitySet: string, v?: ViewModel) => {
    if (filter.applied === null) return { query: null, ignored: [] as string[] };
    const typeName = model.entitySets[entitySet]!.typeName;
    const caps = model.entitySets[entitySet]!.capabilities;
    const applies = (path: string) => Boolean(model.entityTypes[typeName]!.properties[path.split('/')[0]!] || model.entityTypes[typeName]!.navigations[path.split('/')[0]!]) && isFilterable(caps, path);
    const r = tableFilters(filter.applied.filters, applies, Boolean(model.entitySets[entitySet]!.draft?.root));
    return { query: { filters: { ...r.filters, ...viewConditions(v, viewPaths) }, search: filter.applied.search }, ignored: r.ignored };
  };

  // Host refresh (refreshToken): counts the changes, so the first value does not reload.
  const [refreshRevision, setRefreshRevision] = useState(0);
  const lastToken = useRef(p.refreshToken);
  useEffect(() => {
    if (lastToken.current === p.refreshToken) return;
    lastToken.current = p.refreshToken;
    setRefreshRevision((n) => n + 1);
  }, [p.refreshToken]);

  // Tab counts (LR Icon Tab Bar: display the number of items of each table).
  const countable = tabs.map((x) => ({ ...x, q: queryFor(x.entitySet, views.find((v) => v.id === x.key)) }));
  const counts = useQueries({
    queries: (p.views?.mode === 'tabs' || p.contents?.length ? countable : []).map((x) => ({
      queryKey: ['smart-kit', 'tab-count', service.name, x.entitySet, JSON.stringify(x.q.query), refreshRevision],
      enabled: Boolean(x.q.query) && model.entitySets[x.entitySet]!.capabilities.countable,
      queryFn: ({ signal }: { signal: AbortSignal }) => service.dataProvider.query({ source: { entitySet: x.entitySet }, select: model.entityTypes[model.entitySets[x.entitySet]!.typeName]!.keys, expand: [], orderBy: [], filters: x.q.query!.filters, search: model.entitySets[x.entitySet]!.capabilities.searchable && x.q.query!.search ? x.q.query!.search : undefined, top: 0, count: true }, { signal }),
    })),
  });

  // Chart (LR Simple Content: switch between table and chart).
  const chartModel = activeView?.chart ?? (p.chart ? (typeof p.chart === 'string' ? ui.charts[p.chart] : Object.values(ui.charts)[0]) : undefined);
  const showChart = Boolean(view.chart && chartModel);
  const chartToggle = chartModel ? (
    <SegmentedControl
      size="xs" value={showChart ? 'chart' : 'table'} aria-label={t('views.switch')} data-sk-chart-toggle
      onChange={(v) => setView((s) => ({ ...s, chart: v === 'chart' }))}
      data={[
        { value: 'table', label: <Tooltip label={t('views.table')}><Table2 className="sk-icon" aria-label={t('views.table')} /></Tooltip> },
        { value: 'chart', label: <Tooltip label={t('views.chart')}><BarChart3 className="sk-icon" aria-label={t('views.chart')} /></Tooltip> },
      ]}
    />
  ) : null;
  const drilldown = (dimension: string, value: string) => {
    // Drilldown to the details of the aggregated amount: filter the list by the element and show the table (docs/12 U-4).
    if (viewPaths.has(dimension)) setView((s) => ({ ...s, tab: views[0]?.id }));
    filter.setConditions(dimension, [{ operator: 'EQ', values: [value] }]);
    if (!p.liveMode) setTimeout(() => latestFilter.current.go(), 0);
    setView((s) => ({ ...s, chart: false }));
  };

  // Content switch (≤ 3 views: segmented button, > 3: select; LR Multiple Views).
  const contentSwitch = p.views?.mode === 'switch' && views.length > 1 ? (
    views.length <= 3 ? (
      <SegmentedControl size="xs" value={activeTab} onChange={(v) => setView((s) => ({ ...s, tab: v }))} data={views.map((v) => ({ value: v.id, label: v.text }))} aria-label={t('views.label')} data-sk-view-switch="segmented" />
    ) : (
      <Select size="xs" w={200} value={activeTab} allowDeselect={false} onChange={(v) => v && setView((s) => ({ ...s, tab: v }))} data={views.map((v) => ({ value: v.id, label: v.text }))} aria-label={t('views.label')} data-sk-view-switch="select" />
    )
  ) : null;

  const table = (entitySet: string, key: string, v: ViewModel | undefined, extend: TableExtendEntry[] | undefined, title: string, withSwitch: boolean) => {
    const q = queryFor(entitySet, v);
    if (showChart && chartModel && entitySet === p.entitySet) {
      return <ChartView revision={refreshRevision} entitySet={entitySet} service={p.service} chart={chartModel} filters={q.query?.filters ?? {}} search={q.query?.search} executed={q.query !== null} title={title} titleAddon={withSwitch ? contentSwitch : undefined} toolbarEnd={chartToggle} onDrilldown={drilldown} />;
    }
    return (
      <>
        {q.ignored.length ? <Text size="sm" c="dimmed" data-sk-ignored-filters>{t('views.ignoredFilters', { fields: q.ignored.join(', ') })}</Text> : null}
        <SmartTable
          key={`${key}:${responsive ? 'r' : 'g'}`}
          service={p.service}
          entitySet={entitySet}
          mode={responsive ? 'responsive' : 'grid'}
          tableType={tableType === 'TreeTable' ? 'TreeTable' : undefined}
          hierarchyQualifier={p.hierarchyQualifier}
          query={q.query}
          overlay={filter.dirty && !p.liveMode}
          columns={entitySet === p.entitySet && !v ? columns : undefined}
          onColumnsChange={entitySet === p.entitySet && !v ? (c) => setView((s) => ({ ...s, columns: c })) : undefined}
          sort={entitySet === p.entitySet && !v ? sort : v?.presentation.sortOrder}
          onSortChange={entitySet === p.entitySet && !v ? (s) => setView((x) => ({ ...x, sort: s })) : undefined}
          groupBy={entitySet === p.entitySet && !v ? view.groupBy : undefined}
          onGroupByChange={entitySet === p.entitySet && !v ? (g) => setView((x) => ({ ...x, groupBy: g })) : undefined}
          totals={entitySet === p.entitySet && !v ? view.totals : undefined}
          onTotalsChange={entitySet === p.entitySet && !v ? (ids) => setView((x) => ({ ...x, totals: ids })) : undefined}
          presentation={v?.presentation}
          lineItem={v?.lineItem}
          extend={extend}
          onRowNavigate={p.onRowNavigate}
          pageKey={`${pageKey}${key === 'main' ? '' : `:${key}`}`}
          title={title}
          titleAddon={withSwitch ? contentSwitch : undefined}
          toolbarEnd={entitySet === p.entitySet ? chartToggle : undefined}
          actionGroups={p.actionGroups}
          workingMode={p.workingMode}
          onRowsChange={entitySet === p.entitySet ? p.onRowsChange : undefined}
          refreshToken={refreshRevision}
          exportable={p.exportable}
          onBeforeExport={p.onBeforeExport}
          onExported={p.onExported}
        />
      </>
    );
  };

  const mainTitle = ui.headerInfo.typeNamePlural || t('object.sections');
  let body: ReactNode;
  if (tabs.length && (p.views?.mode === 'tabs' || p.contents?.length)) {
    body = (
      <Tabs value={activeTab} onChange={(v) => v && setView((s) => ({ ...s, tab: v }))} keepMounted={false} className="sk-list-tabs" data-sk-list-tabs>
        <Tabs.List className="sk-list-tabs__list">
          {countable.map((x, i) => {
            const n = counts[i]?.data?.count;
            const label = x.title ?? model.ui[model.entitySets[x.entitySet]!.typeName]!.headerInfo.typeNamePlural;
            return <Tabs.Tab key={x.key} value={x.key} data-sk-list-tab={x.key}>{n === undefined ? label : t('table.title', { title: label, count: n })}</Tabs.Tab>;
          })}
        </Tabs.List>
        {countable.map((x) => (
          <Tabs.Panel key={x.key} value={x.key} className="sk-list-tabs__panel">
            {table(x.entitySet, x.key, views.find((v) => v.id === x.key), x.tableExtend ?? (x.entitySet === p.entitySet ? p.tableExtend : undefined), x.title ?? model.ui[model.entitySets[x.entitySet]!.typeName]!.headerInfo.typeNamePlural, false)}
          </Tabs.Panel>
        ))}
      </Tabs>
    );
  } else {
    body = table(p.entitySet, activeView?.id ?? 'main', activeView, p.tableExtend, mainTitle, true);
  }

  const shareHref = navigation?.href?.({ kind: 'list', entitySet: p.entitySet, service: service.name });
  const share = (p.share ?? true) && shareHref ? <ShareMenu title={p.title ?? ui.headerInfo.typeNamePlural} href={shareHref} /> : null;
  const hasMessages = Boolean(messages?.messages.length);

  return (
    <div ref={rootRef} className={['sk-list-report', responsive ? 'sk-list-report--responsive' : '', p.className].filter(Boolean).join(' ')}>
      <DynamicPage
        layout={responsive ? 'flow' : 'fill'}
        filterToggle={p.filterToggle}
        snapOnScroll={!p.filterToggle}
        pinned={view.headerPinned ?? false}
        onPinnedChange={(v) => setView((s) => ({ ...s, headerPinned: v }))}
        heading={p.title ?? ui.headerInfo.typeNamePlural}
        headingContent={<SmartVariantManagement variants={variants} content={content} onApply={apply} standardName={p.title} autoApplyOption={!p.liveMode} canSave={p.canSaveVariants} />}
        actions={<Group gap="xs" wrap="nowrap">{p.headerActions}{share}</Group>}
        summary={<FilterSummary entitySet={p.entitySet} service={p.service} filters={Object.fromEntries(Object.entries(filter.filters).filter(([k]) => k !== EDITING_STATUS))} search={filter.search} />}
        header={<SmartFilterBar state={barState} extend={filterExtend} />}
        headerExpanded={headerExpanded}
        onHeaderExpandedChange={setHeaderExpanded}
        footer={hasMessages ? <Group justify="flex-start" data-sk-footer><MessageButton /></Group> : undefined}
        data-testid={`list-${p.entitySet}`}
      >
        {p.beforeTable}
        {body}
      </DynamicPage>
    </div>
  );
}
