/**
 * Chart building block (sap.fe.macros.Chart, ADR-033): the chart of a list report (LR Simple Content / Multiple Views,
 * ADR-021), the data aggregated on the server by all dimensions of the UI.Chart and the units of its measures, as FE
 * requests it (docs/29 §4 P1-2, P1-3); all measures are drawn (grouped bars), dimensions with the role Series split the
 * measures into series. `contextPath` is the entity set, `metaPath` the
 * UI.Chart (or a UI.PresentationVariant / UI.SelectionPresentationVariant with one, docs/30 §5.2). Selecting a bar opens
 * a popover whose "Show Details" drills down (docs/12 U-4).
 */
import { ActionIcon, Button, Group, Menu, Popover, Text } from '@mantine/core';
import {
  buildChartRequest, canGroup, capabilitiesFor, formatNumber, isFilterable, resolvePath, STANDARD_VARIANT_ID,
  type FilterState, type PropertyModel, type Row, type VariantContent,
} from '@rhfan2019/smart-kit-core';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, MoreHorizontal, Sparkles } from 'lucide-react';
import { isValidElement, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode, type Ref } from 'react';
import { useActionRunner } from '../actions/useActionRunner';
import { drawnChart, feChartType } from '../chart/chartType';
import { resolveChartMetaPath, resolveChartPresentation, resolveContextPath } from '../chart/metaPath';
import { SimpleChart, type ChartDatum, type ChartSeries } from '../chart/SimpleChart';
import { useService, useSmartKit, useText } from '../context/SmartKitProvider';
import { getPath } from '../field/values';
import { fromSelectionVariant, toSelectionVariant, type SelectionVariant } from '../filter/selectionVariant';
import { usePageState } from '../util/usePageState';
import { applyExtensions, type ExtendEntry } from '../util/extend';
import { VariantManagement } from '../variants/VariantManagement';
import { useVariants } from '../variants/useVariants';
import {
  applyChartPresentationVariant, chartP13nModes, chartStateFromContent, chartStateToContent, chartStateToPresentationVariant, ChartP13nDialog,
  ChartSettingsButton, ChartTypeButton, defaultChartState, ViewByButton, type ChartItem, type ChartP13nState,
} from './chartP13n';
import type { PresentationVariant } from './presentationVariant';

export type { PresentationVariant, PresentationVariantVisualization } from './presentationVariant';
export type { ChartItem, ChartP13nState } from './chartP13n';

/** Instance of the chart building block (`ref`), sap.fe.macros.Chart. */
export interface Chart {
  /** The aggregated rows of the selected data points (sap.fe.macros.Chart#getSelectedContexts). */
  getSelectedContexts(): Row[];
  /** The chart's own filters (in addition to `query`) as a sap.fe.navigation.SelectionVariant JSON object. */
  getSelectionVariant(): Promise<SelectionVariant>;
  /** Replaces the chart's own filters (applied in addition to `query`; a property in both takes the chart's conditions). */
  setSelectionVariant(selectionVariant: SelectionVariant, prefillDescriptions?: boolean): Promise<void>;
  /**
   * The applied chart type, dimensions and measures with their roles, and sort as the JSON object of a
   * sap.fe.navigation.PresentationVariant (as FE's toJSONObject: Visualizations [{ Type "Chart", Content }], SortOrder).
   */
  getPresentationVariant(): Promise<PresentationVariant>;
  /** Applies a PresentationVariant (same form): what it names replaces the current chart type, items or sort. */
  setPresentationVariant(presentationVariant: PresentationVariant): Promise<void>;
  /** Key of the current variant of the chart's variant management (`variantManagement` "Control"; "" the standard); null without one. */
  getCurrentVariantKey(): string | null;
  /** Selects and applies the variant with this key; an unknown key is ignored. */
  setCurrentVariantKey(key: string): void;
}

/** A custom action of the chart toolbar (sap.fe.macros.chart.Action; `press` names a handler in FE, here it is the handler). */
export interface $ChartActionSettings {
  /** Unique key of the action. */
  key: string;
  /** Button text. */
  text: string;
  /** Key of another action the new one is placed next to; default: after the last action. */
  anchor?: string;
  /** "After" (default) or "Before" `anchor`. */
  placement?: 'After' | 'Before';
  /** @defaultValue true */
  enabled?: boolean;
  /** @defaultValue true */
  visible?: boolean;
  /** Enabled only with selected data points. */
  requiresSelection?: boolean;
  /**
   * Overflow group of the action (sap.m.OverflowToolbarLayoutData group): the actions of a group move into the overflow
   * together; takes precedence over `group`.
   */
  overflowGroup?: number;
  /** Group of the action in the overflow toolbar (used when there is no `overflowGroup`). */
  group?: number;
  /** Priority in the overflow toolbar: "High" stays, "Low" moves first, "AlwaysOverflow" / "NeverOverflow" (sap.m.OverflowToolbarPriority). */
  priority?: 'AlwaysOverflow' | 'Disappear' | 'High' | 'Low' | 'NeverOverflow';
  /**
   * Displays the AI icon on the action button.
   * @defaultValue false
   */
  isAIOperation?: boolean;
  /** The button was pressed; the aggregated rows of the selected data points are passed. */
  press?(e: { selectedContexts: Row[] }): void;
}

/**
 * A menu button of the chart toolbar (sap.fe.macros.chart.ActionGroup, a sap.fe.macros.chart.Action with `actions`).
 * With `press` (the inherited chart.Action event) the button is a split button whose main part runs `press` (FE: the
 * manifest menu's `defaultAction`, MenuButton buttonMode "Split" with useDefaultActionOnly); without it a plain menu.
 * A menu without visible actions is not shown; its AI icon shows when it or all of its actions are AI operations. The
 * menu button itself is enabled unless `enabled` is false (FE: `requiresSelection` of a group is not used); its actions
 * follow their own `requiresSelection`.
 */
export interface $ChartActionGroupSettings extends $ChartActionSettings {
  /** The actions of the menu. */
  actions: $ChartActionSettings[];
}

/** An overflow group of the chart toolbar (sap.fe.macros.chart.OverflowGroup). */
export interface $ChartOverflowGroupSettings {
  /** The group (the `overflowGroup` of its actions). */
  overflowGroup: number;
  /** A separator before the group (FE Action addSeparators). */
  showSeparator?: boolean;
}

/** One data point in `selectionChange`: the dimension and measure values by property path. */
export interface ChartSelectionData { data: Record<string, unknown> }

/** sap.fe.macros.Chart `selectionChange`: data points were selected or deselected. */
export interface Chart$SelectionChangeEvent {
  /** The data points whose selection changed. */
  data: ChartSelectionData[];
  /** True when they were selected, false when deselected. */
  selected: boolean;
}

/** Drilldown from the popover's "Show Details" (smart-kit). */
export interface Chart$DrilldownEvent {
  /** Property path of the dimension. */
  dimension: string;
  /** The dimension value of the selected data point. */
  value: string;
}

/** Applied filters of the chart; null: not executed yet. */
export interface ChartQuery {
  filters: FilterState;
  search?: string;
}

export interface $ChartSettings {
  /** Entity set path, e.g. "/Orders" (sap.fe.macros.Chart#contextPath). */
  contextPath: string;
  /**
   * Annotation path of the chart, e.g. "@com.sap.vocabularies.UI.v1.Chart#Q" (alias "@UI.Chart#Q"), or of a
   * UI.PresentationVariant / UI.SelectionPresentationVariant that contains one.
   */
  metaPath: string;
  /** Header text of the chart; default the UI.Chart Title (FE MdcChartTemplate `header`; none without a Title). */
  header?: string;
  /**
   * Whether the header (title and the content after it) is shown; the toolbar actions stay.
   * @defaultValue true
   */
  headerVisible?: boolean;
  /**
   * "None": the data points cannot be selected; "Single": one; "Multiple": selecting adds to the selection.
   * @defaultValue Multiple
   */
  selectionMode?: 'None' | 'Single' | 'Multiple';
  /**
   * Toolbar actions after the annotation actions (sap.fe.macros.Chart `actions`, sap.fe.macros.chart.Action and
   * sap.fe.macros.chart.ActionGroup): an array of action settings, or any React content placed as it is.
   */
  actions?: ($ChartActionSettings | $ChartActionGroupSettings)[] | ReactNode;
  /** Separators between the overflow groups of the actions (sap.fe.macros.chart.OverflowGroup). */
  actionOverflowGroups?: $ChartOverflowGroupSettings[];
  /**
   * Options of the chart personalization: true all ("Sort", "Type", "Item", "Filter"), false none, or a comma-separated
   * list of them ("Type": the chart type button; "Item": dimensions and measures, "View By"; "Sort"; "Filter": the
   * chart's own filters). The list report passes "Sort,Type,Item" (FE getP13nMode).
   * @defaultValue true
   */
  personalization?: string | boolean;
  /**
   * The personalization (and the chart's variant) is kept only while the chart is shown and is not restored when it
   * is shown again.
   * @defaultValue false
   */
  ignorePersonalizationChanges?: boolean;
  /**
   * "Control": a variant management of the chart's own in its toolbar (smart-kit's variant store, D42); not set: none.
   * It needs personalization (FE: no variant management when personalization is disabled).
   */
  variantManagement?: '' | 'Control';
  /** Data points were selected or deselected. */
  onSelectionChange?(e: Chart$SelectionChangeEvent): void;
  /** Name of the service in `SmartKitProvider` `services`; default: the provider's `defaultService`. */
  service?: string;
  /** Applied filters (from `useFilterState` / the filter bar); null means "not executed yet". Undefined loads without filters. */
  query?: ChartQuery | null;
  /** Content after the header text (e.g. the view switch of the list report). */
  headerContent?: ReactNode;
  /** Drilldown: "Show Details" of the selected data point. */
  onDrilldown?(e: Chart$DrilldownEvent): void;
  /** Change to reload. */
  revision?: number;
  /** getSelectedContexts, get/setSelectionVariant, get/setPresentationVariant, get/setCurrentVariantKey. */
  ref?: Ref<Chart>;
}

/** Chart building block (sap.fe.macros.Chart). Renders nothing when the metaPath does not resolve to a UI.Chart. */
export function Chart(p: $ChartSettings) {
  const service = useService(p.service);
  const { namespace, locale, intlLocale, timeZone } = useSmartKit();
  const t = useText();
  const model = service.model;
  const ctx = resolveContextPath(model, p.contextPath);
  const chart = ctx ? resolveChartMetaPath(model, ctx.typeName, p.metaPath) : undefined;
  // The chart's sort: the SortOrder of the presentation variant the metaPath names (FE getSortConditions).
  const presentation = ctx && !ctx.navigation ? resolveChartPresentation(model, ctx.typeName, p.metaPath) : undefined;
  const sort = presentation ? presentation.chartSortOrder ?? presentation.sortOrder : undefined;
  // FE Chart createChartVisualization: a chart needs Aggregation.ApplySupported ("ApplySupported is not added to the annotations").
  const caps = ctx ? capabilitiesFor(model, ctx.entitySet) : undefined;
  const supported = Boolean(caps?.aggregation);
  const runner = useActionRunner({ service: p.service });
  const selectionMode = p.selectionMode ?? 'Multiple';
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [popover, setPopover] = useState<{ d: ChartDatum; anchor: Element } | null>(null);
  const typeName = ctx?.typeName ?? '';
  const propOf = (path: string): PropertyModel | undefined => resolvePath(model.entityTypes, typeName, path).property;
  const aggregated = (name: string) => caps?.aggregation?.aggregatedProperties?.find((x) => x.name === name);

  // ------------------------------------------------------------------ personalization (FE MdcChartTemplate, ChartDelegate)
  const modes = chartP13nModes(p.personalization);
  const storeKey = `chart:${p.contextPath}:${p.metaPath}`;
  const sortKey = JSON.stringify(sort ?? []);
  const initial = useMemo(() => (chart ? defaultChartState(chart, sort) : undefined), [chart, sortKey]); // eslint-disable-line react-hooks/exhaustive-deps
  // Personalization changes persist (FE: flex changes; smart-kit: the page state) unless ignorePersonalizationChanges.
  const [stored, setStored] = usePageState<ChartP13nState | null>(p.ignorePersonalizationChanges ? undefined : `${storeKey}:p13n`, null);
  const state = initial ? stored ?? initial : undefined;
  const [chartFilters, setChartFilters] = useState<FilterState>({});
  // variantManagement "Control" (FE createVariantManagement): only with personalization, not with ignorePersonalizationChanges
  const vmOn = p.variantManagement === 'Control' && modes.length > 0 && !p.ignorePersonalizationChanges;
  const standardContent = useMemo<VariantContent>(() => (initial ? chartStateToContent(initial, {}) : { filters: {} }), [initial]);
  const applyContent = (c: VariantContent) => { setStored(initial ? chartStateFromContent(c, initial) : null); setChartFilters(c.filters ?? {}); };
  const variants = useVariants(storeKey, { service: p.service, standard: standardContent, enabled: vmOn, onDefaultLoaded: (v) => applyContent(v.content) });
  const isCustomAggregate = (name: string) => Object.hasOwn(caps?.aggregation?.customAggregates ?? {}, name);
  // a measure item is a dynamic measure (Analytics.AggregatedProperty) when the chart names it so, or when only an aggregated property has that name
  const isDynamic = (name: string) => (chart?.dynamicMeasures ?? []).includes(name) || (Boolean(aggregated(name)) && !isCustomAggregate(name) && !(chart?.measures ?? []).includes(name));
  const items = state?.items ?? [];
  const dimensions = items.filter((i) => i.kind === 'Dimension').map((i) => i.name);
  const measureItems = items.filter((i) => i.kind === 'Measure');
  const effective = chart && state ? {
    ...chart,
    chartType: state.chartType,
    dimensions,
    dimensionRoles: Object.fromEntries(items.filter((i) => i.kind === 'Dimension').map((i) => [i.name, i.role])),
    dynamicMeasures: measureItems.filter((m) => isDynamic(m.name)).map((m) => m.name),
    measures: measureItems.filter((m) => !isDynamic(m.name)).map((m) => m.name),
    measureRoles: Object.fromEntries(measureItems.map((m) => [m.name, m.role])),
  } : chart;
  // Measures (FE MdcChartTemplate getChartMeasures): dynamic measures (Analytics.AggregatedProperty, by its Name) and
  // Measures in the order of the chart's items; `key` is the measure's field in the aggregated rows, `path` the aggregated property.
  const measureDefs = measureItems.flatMap((m) => {
    if (isDynamic(m.name)) { const a = aggregated(m.name); return a ? [{ id: m.name, key: m.name, path: a.property, label: a.label ?? propOf(a.property)?.label ?? m.name }] : []; }
    return [{ id: m.name, key: m.name.replace(/\//g, '_'), path: m.name, label: propOf(m.name)?.label ?? m.name }];
  });
  const measures = measureDefs.map((m) => m.id);
  const defOf = (id: string) => measureDefs.find((m) => m.id === id)!;
  // What the Chart panel and "View By" offer (FE ChartDelegate fetchProperties): groupable properties as dimensions,
  // custom aggregates and transformation aggregates as measures; the Filter panel: the filterable properties.
  const choices = useMemo(() => {
    const type = model.entityTypes[typeName];
    if (!type || !ctx) return { dimensions: [], measures: [], filterable: [] };
    const props = type.propertyOrder.filter((n) => !type.properties[n]!.hidden && type.properties[n]!.edmType !== 'Edm.Stream' && !['IsActiveEntity', 'HasActiveEntity', 'HasDraftEntity'].includes(n));
    const label = (n: string) => type.properties[n]?.label ?? n;
    return {
      // sorted by label, as the "View By" list and the panel's field list (sap.m.p13n)
      dimensions: props.filter((n) => canGroup(model, { entitySet: ctx.entitySet }, n) && !isCustomAggregate(n)).map((n) => ({ name: n, label: label(n) })).sort((a, b) => a.label.localeCompare(b.label)),
      measures: [
        ...Object.keys(caps?.aggregation?.customAggregates ?? {}).map((n) => ({ name: n, label: label(n) })),
        ...(caps?.aggregation?.aggregatedProperties ?? []).map((a) => ({ name: a.name, label: a.label ?? label(a.property) })),
      ].filter((x, i, all) => all.findIndex((y) => y.name === x.name) === i),
      filterable: caps ? props.filter((n) => isFilterable(caps, n)).map((n) => ({ name: n, label: label(n) })) : [],
    };
  }, [model, typeName, ctx?.entitySet, caps]); // eslint-disable-line react-hooks/exhaustive-deps
  const [p13nOpen, setP13nOpen] = useState(false);
  const setState = (next: ChartP13nState) => setStored(next);
  // Category dimensions make the categories; dimensions with the role "Series" split each measure into series (sap.chart roles).
  const seriesDims = dimensions.filter((d) => effective?.dimensionRoles?.[d] === 'Series');
  const categoryDims = dimensions.filter((d) => !seriesDims.includes(d));
  const dim = categoryDims[0] ?? dimensions[0];
  const dimProp = dim ? propOf(dim) : undefined;
  const executed = p.query !== null;
  const filters = { ...p.query?.filters, ...chartFilters };
  const req = effective && ctx && supported && dimensions.length + measures.length > 0
    ? buildChartRequest(model, effective, { source: { entitySet: ctx.entitySet }, filters, search: p.query?.search, timeZone, sort: state?.sort ?? sort })
    : undefined;
  const reqKey = JSON.stringify(req);
  // A new query starts a new selection (data points of the old result may be gone).
  useEffect(() => { setSelectedKeys([]); setPopover(null); }, [reqKey, p.revision]);
  const q = useQuery({
    queryKey: ['smart-kit', namespace, service.name, locale, 'chart', reqKey, p.revision ?? 0],
    queryFn: ({ signal }) => service.dataProvider.query(req!, { signal }),
    enabled: executed && Boolean(req),
  });
  const rows = q.data?.rows ?? [];
  const textOf = (r: Row, d: string) => {
    const text = propOf(d)?.text;
    const v = text ? getPath(r, text) : undefined;
    return v === undefined || v === null || v === '' ? String(getPath(r, d) ?? '') : String(v);
  };
  const keyOf = (r: Row) => categoryDims.map((d) => String(getPath(r, d) ?? '')).join('\u0000');
  const unitPathOf = (m: string) => { const u = propOf(defOf(m).path)?.unit; return u && 'path' in u ? u.path : undefined; };
  const measureKey = (m: string) => defOf(m).key;
  // FE (sap.chart): a measure whose rows have different units is not drawn ("Some measures have different units.")
  const mixedUnits = measures.some((m) => { const u = unitPathOf(m); return Boolean(u) && new Set(rows.map((r) => String(getPath(r, u!) ?? ''))).size > 1; });
  const formatted = (m: string, r: Row) => {
    const prop = propOf(defOf(m).path);
    const scale = typeof prop?.scale === 'number' ? prop.scale : 2;
    const unit = unitPathOf(m);
    return `${formatNumber(String(Number(r[measureKey(m)] ?? 0)), intlLocale, { min: scale, max: scale })}${unit && getPath(r, unit) ? ` ${String(getPath(r, unit))}` : ''}`;
  };
  // Series: each measure, split by the values of the series dimensions (in the order of the rows).
  const seriesKeyOf = (r: Row) => seriesDims.map((d) => String(getPath(r, d) ?? '')).join('\u0000');
  const seriesValues: { key: string; label: string }[] = [];
  if (seriesDims.length) for (const r of rows) { const k = seriesKeyOf(r); if (!seriesValues.some((x) => x.key === k)) seriesValues.push({ key: k, label: seriesDims.map((d) => textOf(r, d)).join(' / ') }); }
  const series: (ChartSeries & { measure: string; seriesKey?: string })[] = measures.flatMap((m) => {
    const label = defOf(m).label;
    return seriesDims.length
      ? seriesValues.map((v) => ({ key: `${m}\u0001${v.key}`, label: measures.length > 1 ? `${label} / ${v.label}` : v.label, measure: m, seriesKey: v.key }))
      : [{ key: m, label, measure: m }];
  });
  const data: ChartDatum[] = [];
  for (const r of rows) {
    const key = keyOf(r);
    let d = data.find((x) => x.key === key);
    if (!d) {
      d = { key, label: categoryDims.map((c) => textOf(r, c)).join(' / '), value: NaN, values: series.map(() => undefined), formattedValues: series.map(() => undefined) };
      data.push(d);
    }
    series.forEach((s, i) => {
      if (s.seriesKey !== undefined && seriesKeyOf(r) !== s.seriesKey) return;
      d!.values![i] = Number(r[measureKey(s.measure)] ?? 0);
      d!.formattedValues![i] = formatted(s.measure, r);
    });
  }
  for (const d of data) { d.value = d.values![0] ?? NaN; d.formatted = d.formattedValues![0]; }
  const selectedRows = () => rows.filter((r) => selectedKeys.includes(keyOf(r)));
  const allowedItem = (i: ChartItem) => (i.kind === 'Dimension' ? choices.dimensions.some((x) => x.name === i.name) || (chart?.dimensions ?? []).includes(i.name) : choices.measures.some((x) => x.name === i.name) || [...(chart?.measures ?? []), ...(chart?.dynamicMeasures ?? [])].includes(i.name));
  const latest = useRef({ state, variants, vmOn });
  latest.current = { state, variants, vmOn };
  useImperativeHandle(p.ref, () => ({
    getSelectedContexts: selectedRows,
    getSelectionVariant: async () => toSelectionVariant(chartFilters, ''),
    async setSelectionVariant(selectionVariant, prefillDescriptions) { setChartFilters(fromSelectionVariant(selectionVariant, prefillDescriptions)); },
    getPresentationVariant: async () => {
      const cur = latest.current.state;
      if (!cur) throw new Error('Chart: the metaPath does not resolve to a UI.Chart');
      return chartStateToPresentationVariant(cur);
    },
    async setPresentationVariant(pv) {
      const cur = latest.current.state;
      if (cur) setStored(applyChartPresentationVariant(cur, pv, allowedItem));
    },
    getCurrentVariantKey: () => (latest.current.vmOn ? latest.current.variants.currentId : null),
    setCurrentVariantKey(key) {
      const { variants: v, vmOn: on } = latest.current;
      if (!on || (key !== STANDARD_VARIANT_ID && !v.variants.some((x) => x.id === key))) return;
      applyContent(v.select(key).content);
    },
  }));
  // Toolbar width for the overflow of the actions (sap.m.OverflowToolbar).
  const sectionRef = useRef<HTMLElement>(null);
  const [width, setWidth] = useState(1440);
  useEffect(() => {
    const el = sectionRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth || 1440));
    ro.observe(el);
    return () => ro.disconnect();
  }, [Boolean(chart && ctx && supported)]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!chart || !ctx || !supported) return null;
  const selectionData = (key: string): ChartSelectionData => {
    const r = rows.find((x) => keyOf(x) === key);
    const out: Record<string, unknown> = {};
    for (const d of categoryDims) out[d] = r ? getPath(r, d) : undefined;
    for (const m of measures) out[m] = r ? Number(r[measureKey(m)] ?? 0) : undefined;
    return { data: out };
  };
  const select = (d: ChartDatum, anchor: Element) => {
    const wasSelected = selectedKeys.includes(d.key);
    if (selectionMode === 'Multiple' && wasSelected) {
      setSelectedKeys(selectedKeys.filter((k) => k !== d.key));
      setPopover(null);
      p.onSelectionChange?.({ data: [selectionData(d.key)], selected: false });
      return;
    }
    if (!wasSelected) {
      const deselected = selectionMode === 'Single' ? selectedKeys : [];
      setSelectedKeys(selectionMode === 'Single' ? [d.key] : [...selectedKeys, d.key]);
      if (deselected.length) p.onSelectionChange?.({ data: deselected.map(selectionData), selected: false });
      p.onSelectionChange?.({ data: [selectionData(d.key)], selected: true });
    }
    setPopover({ d, anchor });
  };
  const header = p.header ?? chart.chartTitle ?? '';
  const type = feChartType(effective!.chartType);
  const drawn = drawnChart(type);
  const toolbarActions = chartToolbarActions({
    annotation: (chart.actions ?? []).map((a) => ({ id: a.id, label: a.label, disabled: runner.busy, onPress: () => runner.run(a, [{ row: {}, path: '', label: '' }]) })),
    custom: Array.isArray(p.actions) && isActionSettings(p.actions) ? p.actions : [],
    groups: p.actionOverflowGroups,
    selected: selectedKeys.length > 0,
    selectedRows,
  });
  const viewBy = choices.dimensions.filter((d) => !dimensions.includes(d.name));
  const p13nPanels = modes.filter((m) => m !== 'Type');
  return (
    <section ref={sectionRef} className="sk-table sk-chartview" aria-label={header || chart.title} data-sk-chart-view={chart.id} data-sk-chart-type={type}
      data-sk-chart-dimensions={dimensions.map((d) => propOf(d)?.label ?? d).join('\u0001')} data-sk-chart-measures={measures.map((m) => defOf(m).label).join('\u0001')}>
      <div className="sk-table__toolbar" role="toolbar">
        {p.headerVisible === false ? null : (
          <>
            <h2 className="sk-table__title sk-title--h3" data-sk-table-title>{header}</h2>
            {vmOn && state ? (
              <VariantManagement variants={variants} content={chartStateToContent(state, chartFilters)} onSelect={(e) => applyContent(e.content)} headerLevel="H3" supportApplyAutomatically={false} />
            ) : null}
            {p.headerContent}
          </>
        )}
        <span className="sk-grow" />
        <ChartActions actions={toolbarActions} width={width} />
        {Array.isArray(p.actions) && isActionSettings(p.actions) ? null : (p.actions as ReactNode)}
        {modes.includes('Item') ? <ViewByButton dimensions={viewBy} onSelect={(name) => state && setState({ ...state, items: [...state.items, { name, kind: 'Dimension', role: 'Category' }] })} /> : null}
        {p13nPanels.length ? <ChartSettingsButton onClick={() => setP13nOpen(true)} /> : null}
        {modes.includes('Type') && state ? <ChartTypeButton value={state.chartType} onChange={(chartType) => setState({ ...state, chartType })} /> : null}
      </div>
      {runner.dialogs}
      {state && initial && p13nPanels.length ? (
        <ChartP13nDialog
          opened={p13nOpen} modes={p13nPanels} state={state} filters={chartFilters} initial={initial}
          dimensions={[...choices.dimensions, ...(chart.dimensions.filter((d) => !choices.dimensions.some((x) => x.name === d)).map((d) => ({ name: d, label: propOf(d)?.label ?? d })))]}
          measures={[...choices.measures, ...measureDefs.filter((m) => !choices.measures.some((x) => x.name === m.id)).map((m) => ({ name: m.id, label: m.label }))]}
          filterable={choices.filterable} entitySet={ctx.entitySet} service={p.service}
          onOk={(next, f) => { setState(next); setChartFilters(f); setP13nOpen(false); }}
          onCancel={() => setP13nOpen(false)}
        />
      ) : null}
      <div className="sk-chartview__body">
        {!executed ? <Text c="dimmed" ta="center" p="lg">{t('table.noData.start')}</Text> : !q.isLoading && mixedUnits ? (
          <div className="sk-chart sk-chart__message" data-sk-chart={type} data-sk-chart-invalid role="status" style={{ height: 320 }}>
            <span className="sk-chart__message-title">{t('chart.invalidData')}</span>
            <span>{t('chart.differentUnits')}</span>
          </div>
        ) : (
          <SimpleChart
            kind={drawn.kind}
            stacked={drawn.stacked}
            chartType={type}
            title={chart.title}
            measureLabel={series.length > 1 ? series.map((x) => x.label).join(', ') : (series[0]?.label ?? '')}
            dimensionLabel={categoryDims.map((d) => propOf(d)?.label ?? d).join(' / ')}
            data={data}
            series={series.length > 1 ? series : undefined}
            loading={q.isLoading}
            format={(n) => formatNumber(String(n), intlLocale, { max: 0 })}
            selectedKeys={selectedKeys}
            onSelect={selectionMode === 'None' ? undefined : select}
          />
        )}
        <Popover opened={Boolean(popover)} onChange={(o) => { if (!o) setPopover(null); }} position="top" withArrow trapFocus returnFocus>
          <Popover.Target>
            <span className="sk-chartview__anchor" style={popover ? anchorStyle(popover.anchor) : undefined} />
          </Popover.Target>
          <Popover.Dropdown data-sk-chart-popover>
            {popover ? (
              <div>
                <Text fw={600} size="sm">{t('chart.drilldownTitle', { dimension: dimProp?.label ?? '', value: popover.d.label })}</Text>
                {series.map((x, i) => popover.d.formattedValues?.[i] === undefined ? null : <Text key={x.key} size="sm" mb="xs">{x.label}: {popover.d.formattedValues[i]}</Text>)}
                {p.onDrilldown ? (
                  <Button size="xs" onClick={() => { const d = popover.d; setPopover(null); if (dim) p.onDrilldown?.({ dimension: dim, value: d.key }); }} data-sk-chart-drilldown>{t('chart.drilldown')}</Button>
                ) : null}
              </div>
            ) : null}
          </Popover.Dropdown>
        </Popover>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------- toolbar actions

interface ToolbarAction {
  id: string;
  label: string;
  disabled?: boolean;
  onPress(): void;
  /** Overflow group (FE: overflowGroup ?? group). */
  group?: number;
  /** Overflow priority (sap.m.OverflowToolbarPriority). */
  priority?: $ChartActionSettings['priority'];
  /** A separator (FE ActionType.Separator), before the first action of a group. */
  separator?: boolean;
  /** An AI operation: the button shows the AI icon (FE aiIcon). */
  ai?: boolean;
  /** A menu button with these items (sap.fe.macros.chart.ActionGroup). */
  menu?: ToolbarAction[];
  /** The menu button is a split button whose main part runs `onPress` (FE defaultAction). */
  split?: boolean;
}

/** Whether `actions` is an array of action settings (not React content). */
function isActionSettings(actions: unknown[]): actions is ($ChartActionSettings | $ChartActionGroupSettings)[] {
  return actions.every((a) => Boolean(a) && typeof a === 'object' && !isValidElement(a) && 'key' in (a as object) && 'text' in (a as object));
}

const isGroupSettings = (a: $ChartActionSettings | $ChartActionGroupSettings): a is $ChartActionGroupSettings => Array.isArray((a as $ChartActionGroupSettings).actions);

/**
 * The toolbar actions (FE Chart getChartActions): the annotation actions, then the custom actions and menus placed by
 * anchor and placement; separators before the groups whose overflow group has `showSeparator` (FE Action addSeparators).
 */
function chartToolbarActions(o: { annotation: ToolbarAction[]; custom: ($ChartActionSettings | $ChartActionGroupSettings)[]; groups?: $ChartOverflowGroupSettings[]; selected: boolean; selectedRows(): Row[] }): ToolbarAction[] {
  const item = (a: $ChartActionSettings): ToolbarAction => ({
    id: a.key, label: a.text, group: a.overflowGroup ?? a.group, priority: a.priority, ai: a.isAIOperation === true,
    disabled: a.enabled === false || (Boolean(a.requiresSelection) && !o.selected),
    onPress: () => a.press?.({ selectedContexts: o.selectedRows() }),
  });
  const entries: ExtendEntry<ToolbarAction>[] = o.custom.filter((a) => a.visible !== false).flatMap((a) => {
    let it: ToolbarAction;
    if (isGroupSettings(a)) {
      // FE MdcChartTemplate getActionToolbarMenuAction: a MenuButton (Split with a default action); a menu without
      // visible items is removed (FE transformMenuActionsAndIdentifyCommands); AI icon when all items are AI operations
      const menu = a.actions.filter((m) => m.visible !== false).map(item);
      if (!menu.length) return [];
      it = {
        ...item(a), disabled: a.enabled === false, menu, split: Boolean(a.press),
        ai: a.isAIOperation === true || menu.every((m) => m.ai),
      };
    } else it = item(a);
    return [{ id: a.key, position: a.anchor ? (a.placement === 'Before' ? 'before' : 'after') : 'end', anchor: a.anchor, item: it }];
  });
  const actions = applyExtensions(o.annotation, entries, 'Chart actions');
  if (!o.groups?.length) return actions;
  const started = new Set<number>();
  return actions.map((a, i) => {
    if (a.group === undefined || started.has(a.group)) return a;
    started.add(a.group);
    return i > 0 && o.groups!.some((g) => g.overflowGroup === a.group && g.showSeparator) ? { ...a, separator: true } : a;
  });
}

/**
 * The actions of the chart toolbar (sap.m.OverflowToolbar, as the table toolbar): actions move into "More" only when
 * they do not fit; the widths are estimated from the labels (the title and the chart buttons keep about 420px).
 * Priorities (sap.m.OverflowToolbarPriority, OverflowToolbarLayoutData of FE MdcChartTemplate): "NeverOverflow" stays,
 * "AlwaysOverflow" / "Disappear" go ("Disappear" is not offered in "More"), "Low" goes before the others; an overflow
 * group goes as a whole; separators stay with their group (a divider in the menu); a menu button in "More" lists its items.
 */
function ChartActions(p: { actions: ToolbarAction[]; width: number }) {
  const t = useText();
  if (!p.actions.length) return null;
  const shown = p.actions;
  const keep = new Set<ToolbarAction>();
  let room = p.width - 420;
  const cost = (a: ToolbarAction) => a.label.length * 7.5 + 34 + (a.menu ? 20 : 0) + (a.ai ? 20 : 0);
  for (const a of shown.filter((x) => x.priority === 'NeverOverflow')) { keep.add(a); room -= cost(a); }
  for (const a of [...shown.filter((x) => !x.priority || x.priority === 'High'), ...shown.filter((x) => x.priority === 'Low')]) {
    if (room - cost(a) < 0) break;
    room -= cost(a);
    keep.add(a);
  }
  // an overflow group (non-zero, sap.m.OverflowToolbarLayoutData group) that does not fit completely overflows together
  for (const a of shown) if (a.group && a.priority !== 'NeverOverflow' && shown.some((x) => x.group === a.group && !keep.has(x) && x.priority !== 'Disappear')) keep.delete(a);
  const inline = shown.filter((a) => keep.has(a));
  const overflow = shown.filter((a) => !keep.has(a) && a.priority !== 'Disappear').flatMap((a) => (a.menu ? a.menu.map((m, i) => (i === 0 ? { ...m, separator: a.separator } : m)) : [a]));
  const icon = (a: ToolbarAction) => (a.ai ? <Sparkles className="sk-icon" data-sk-ai-icon /> : undefined);
  const menuItems = (a: ToolbarAction) => (
    <Menu.Dropdown>
      {a.menu!.map((m) => <Menu.Item key={m.id} disabled={m.disabled} onClick={m.onPress} leftSection={icon(m)} data-sk-action={m.id}>{m.label}</Menu.Item>)}
    </Menu.Dropdown>
  );
  return (
    <>
      {inline.map((a) => (
        <span key={a.id} className="sk-chartview__action">
          {a.separator ? <span className="sk-toolbar__separator" role="separator" aria-orientation="vertical" data-sk-separator /> : null}
          {!a.menu ? (
            <Button size="xs" variant="subtle" data-sk-action={a.id} disabled={a.disabled} leftSection={icon(a)} onClick={a.onPress}>{a.label}</Button>
          ) : a.split ? (
            <Group gap={0} wrap="nowrap" display="inline-flex" data-sk-action-group={a.id} data-sk-split>
              <Button size="xs" variant="subtle" disabled={a.disabled} leftSection={icon(a)} onClick={a.onPress} data-sk-action-group-default={a.id}>{a.label}</Button>
              <Menu position="bottom-start">
                <Menu.Target>
                  <ActionIcon size="md" variant="subtle" disabled={a.disabled} aria-label={a.label} data-sk-action-group-arrow={a.id}><ChevronDown className="sk-icon" /></ActionIcon>
                </Menu.Target>
                {menuItems(a)}
              </Menu>
            </Group>
          ) : (
            <Menu position="bottom-start">
              <Menu.Target>
                <Button size="xs" variant="subtle" disabled={a.disabled} leftSection={icon(a)} rightSection={<ChevronDown className="sk-icon" />} data-sk-action-group={a.id}>{a.label}</Button>
              </Menu.Target>
              {menuItems(a)}
            </Menu>
          )}
        </span>
      ))}
      {overflow.length ? (
        <Menu position="bottom-end">
          <Menu.Target>
            <ActionIcon aria-label={t('table.overflow')} title={t('table.overflow')} data-sk-chart-overflow><MoreHorizontal className="sk-icon" /></ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            {overflow.map((a, i) => (
              <span key={a.id}>
                {a.separator && i > 0 ? <Menu.Divider data-sk-separator /> : null}
                <Menu.Item disabled={a.disabled} onClick={a.onPress} leftSection={icon(a)} data-sk-action={a.id}>{a.label}</Menu.Item>
              </span>
            ))}
          </Menu.Dropdown>
        </Menu>
      ) : null}
    </>
  );
}

/** Positions the popover target over the selected chart element. */
function anchorStyle(anchor: Element): React.CSSProperties {
  const host = anchor.closest('.sk-chartview__body');
  const a = anchor.getBoundingClientRect();
  const h = host?.getBoundingClientRect();
  return { position: 'absolute', left: a.left - (h?.left ?? 0) + a.width / 2, top: a.top - (h?.top ?? 0), width: 1, height: 1 };
}
