/** Query requests and their OData URL form. See docs/05-data-provider.md §2. */
import { isComplete, toFilter, type Condition, type FilterState } from '../conditions/conditions';
import { restrictConditions } from '../conditions/filterExpressions';
import { EDIT_STATE, editStateFilter, editStateOf } from './draftEditState';
import { hiddenFilterPath, hiddenFiltersOf } from './hiddenFilters';
import { capabilitiesFor, isFilterable, isSortable } from '../model/access';
import { resolvePath } from '../model/buildModel';
import type { ChartModel, DataPointModel, EntityUi, FieldModel, MetaModel, PropertyModel, ValueListModel } from '../model/types';
import { resolveEntityPath, type EntityPath } from './entityPath';
import { encodeKeyLiteral } from './literals';
import type { AnalyticalApply } from './analytical';

export type Row = Record<string, unknown>;

export interface SortItem {
  path: string;
  descending: boolean;
}

export interface ExpandSpec {
  navigation: string;
  select: string[];
  expand: ExpandSpec[];
  /** Collection navigations only: order and size of the expanded collection (micro chart series, ADR-025). */
  orderBy?: SortItem[];
  top?: number;
}

export type QuerySource = { entitySet: string } | { parent: EntityPath; navigation: string };

export interface QueryRequest {
  source: QuerySource;
  select: string[];
  expand: ExpandSpec[];
  /** Conditions combined with "and" across properties. */
  filters?: FilterState;
  /** Conditions where any property may match (combined with "or"); used for value help search fallback. */
  anyOf?: FilterState;
  /**
   * `anyOf` is the whole filter and is written without parentheses ("Code eq '1' or Name eq '1'"), as the mdc field
   * validates a typed value against the key and the description of its value list.
   */
  anyOfOnly?: boolean;
  search?: string;
  orderBy: SortItem[];
  skip?: number;
  top?: number;
  count: boolean;
  /** Time zone for calendar-day filters on Edm.DateTimeOffset properties. */
  /** String conditions are case-insensitive (Capabilities.FilterFunctions tolower). */
  caseInsensitive?: boolean;
  timeZone?: string;
  /** Server-side aggregation ($apply, OData Data Aggregation): group by `groupBy` and aggregate the measures (ADR-021). */
  aggregate?: { groupBy: string[]; measures: AggregateMeasure[] };
  /** Recursive hierarchy (docs/26 §3.10): the visible nodes as `$apply=…/com.sap.vocabularies.Hierarchy.v1.TopLevels(…)`. */
  hierarchy?: HierarchyRequest;
  /**
   * First page of an analytical table (AL-10, ./analytical.ts): grand total, number of leaves (`count`) and the leaves
   * from `skip` / `top`, sorted by `orderBy`, in one `$apply` with `concat`; `select` and `expand` are not sent.
   */
  analytical?: AnalyticalApply;
}

/**
 * One aggregate of a `$apply` request. Without `with` it is the custom aggregate `path` (Aggregation.CustomAggregate:
 * `aggregate(NetAmount)`, the service decides how); `with: 'count'` is `$count as <as>` (rows of the group; `path` is
 * ignored).
 */
export interface AggregateMeasure {
  path: string;
  with?: 'sum' | 'average' | 'min' | 'max' | 'countdistinct' | 'count';
  as?: string;
}

/** Parameters of the TopLevels function (OData Hierarchy vocabulary). */
export interface HierarchyRequest {
  /** Qualifier of Aggregation.RecursiveHierarchy. */
  qualifier: string;
  nodeProperty: string;
  /** Levels shown from the roots (1: only the roots); undefined: all levels. */
  levels?: number;
  /** Nodes expanded (`levels` > 0, null: all levels) or collapsed (0) apart from `levels`. */
  expandLevels?: { nodeId: string; levels: number | null }[];
}

export interface ReadRequest {
  select: string[];
  expand: ExpandSpec[];
}

export interface QueryResult {
  rows: Row[];
  count?: number;
  /** The grand total row of an analytical request (`QueryRequest.analytical` with a grand total). */
  grandTotal?: Row;
}

// ---------------------------------------------------------------------------------------------
// Context helpers

export interface SourceInfo {
  /** Entity set holding the queried rows. */
  entitySet: string;
  typeName: string;
  /** Entity set of the parent when querying through a navigation. */
  parentSet?: string;
  navigation?: string;
}

export function sourceInfo(model: MetaModel, source: QuerySource): SourceInfo {
  if ('entitySet' in source) {
    const set = model.entitySets[source.entitySet];
    if (!set) throw new Error(`Unknown entity set "${source.entitySet}"`);
    return { entitySet: source.entitySet, typeName: set.typeName };
  }
  const parent = resolveEntityPath(model, source.parent);
  const nav = model.entityTypes[parent.typeName]?.navigations[source.navigation];
  const target = model.entitySets[parent.entitySet]?.navigationBindings[source.navigation];
  if (!nav || !target) throw new Error(`Cannot query "${source.navigation}" from ${parent.entitySet}`);
  return { entitySet: target, typeName: nav.targetType, parentSet: parent.entitySet, navigation: source.navigation };
}

const prefixed = (prefix: string, p: string) => {
  const dir = prefix.includes('/') ? prefix.slice(0, prefix.lastIndexOf('/') + 1) : '';
  return dir + p;
};

/** All paths a field needs: the value plus text, unit, criticality, URL. */
export function fieldPaths(model: MetaModel, typeName: string, field: FieldModel, o: { cell?: boolean } = {}): string[] {
  if (field.kind === 'dataPoint' && field.dataPoint) return dataPointPaths(model, typeName, field.dataPoint, o);
  // Field groups and connected fields read their fields; a contact its name and details; an inline action column
  // only the paths of its action (actionPaths).
  if (field.kind === 'fieldGroup' || field.kind === 'connectedFields') return [...new Set((field.fields ?? []).flatMap((f) => fieldPaths(model, typeName, f, o)))];
  // a contact: only its name, as the OData V4 model of FE (the popover reads the details when it opens, ContactLink)
  if (field.kind === 'contact') return field.contact?.fn && 'path' in field.contact.fn ? [field.contact.fn.path] : [];
  if (field.kind === 'action') return [];
  if (field.kind === 'chart') {
    const chart = field.chart;
    if (!chart) return [];
    if (!chart.navigation) return chartFields(chart).flatMap((f) => fieldPaths(model, typeName, f));
    // A chart of a single-valued navigation reads that object's fields; a collection is expanded (chartExpand).
    if (chartIsSeries(model, typeName, chart)) return [];
    return chartSeriesSelect(model, chart).map((p) => `${chart.navigation}/${p}`);
  }
  const out: string[] = [];
  if (!field.path) return out;
  out.push(field.path);
  const prop = resolvePath(model.entityTypes, typeName, field.path).property;
  if (prop) out.push(...companionPaths(prop, field.path));
  // what the display shows besides the value (Common.ExternalID, Common.Timezone, the file name of a stream)
  if (prop?.externalId) out.push(prefixed(field.path, prop.externalId));
  for (const ref of [prop?.timezone, prop?.filename]) if (ref && 'path' in ref) out.push(prefixed(field.path, ref.path));
  if (field.criticality && 'path' in field.criticality) out.push(field.criticality.path);
  if (field.url && 'path' in field.url) out.push(field.url.path);
  if (field.iconUrl && 'path' in field.iconUrl) out.push(field.iconUrl.path);
  return out;
}

/**
 * Text and unit paths of a property reached through `path` (a property's UI.Criticality is not read, D41). With
 * TextSeparate the field shows the value only (FE displayMode "Value"), so its text is not requested, as in FE.
 */
export function companionPaths(prop: PropertyModel, path: string): string[] {
  const out: string[] = [];
  if (prop.text && prop.textArrangement !== 'TextSeparate') out.push(prefixed(path, prop.text));
  if (prop.unit && 'path' in prop.unit) out.push(prefixed(path, prop.unit.path));
  return out;
}

/**
 * Paths a data point reads. In a table cell (`o.cell`) the rating's SampleSize is not shown (sap.fe.macros.internal.DataPoint
 * binds it only in the header data point), so it is not requested, as in Fiori elements.
 */
export function dataPointPaths(model: MetaModel, typeName: string, dp: DataPointModel, o: { cell?: boolean } = {}): string[] {
  const out = [dp.value];
  const prop = resolvePath(model.entityTypes, typeName, dp.value).property;
  if (prop) out.push(...companionPaths(prop, dp.value));
  const cc = dp.criticalityCalculation;
  const refs = [dp.targetValue, dp.criticality, dp.minimumValue, dp.maximumValue, o.cell ? undefined : dp.sampleSize, dp.forecastValue,
    cc?.deviationRangeLowValue, cc?.toleranceRangeLowValue, cc?.acceptanceRangeLowValue, cc?.acceptanceRangeHighValue, cc?.toleranceRangeHighValue, cc?.deviationRangeHighValue];
  for (const ref of refs) if (ref && 'path' in ref && !out.includes(ref.path)) out.push(ref.path);
  return out;
}

/** Splits property paths into a $select list and a $expand tree (single-valued navigations only). */
export function selectAndExpand(model: MetaModel, typeName: string, paths: string[], nonExpandable: string[] = []): { select: string[]; expand: ExpandSpec[] } {
  const select: string[] = [];
  const expand: ExpandSpec[] = [];
  const add = (list: string[], v: string) => { if (!list.includes(v)) list.push(v); };
  for (const path of paths) {
    const segments = path.split('/');
    if (segments.length === 1) { add(select, path); continue; }
    let tn = typeName;
    let level = expand;
    let spec: ExpandSpec | undefined;
    let ok = true;
    for (let i = 0; i < segments.length - 1; i++) {
      const nav = model.entityTypes[tn]?.navigations[segments[i]!];
      if (!nav || nav.collection || (i === 0 && nonExpandable.includes(nav.name))) { ok = false; break; }
      spec = level.find((e) => e.navigation === nav.name);
      if (!spec) { spec = { navigation: nav.name, select: [], expand: [] }; level.push(spec); }
      level = spec.expand;
      tn = nav.targetType;
    }
    if (ok && spec) add(spec.select, segments[segments.length - 1]!);
  }
  // The OData V4 model of Fiori elements (autoExpandSelect) always selects the key properties of an expanded entity
  // (sap.ui.model.odata.v4.lib._Helper selectKeyProperties): `_Status($select=Code,Name)` for the text `_Status/Name`.
  const withKeys = (specs: ExpandSpec[], tn: string) => {
    for (const e of specs) {
      const target = model.entityTypes[tn]?.navigations[e.navigation]?.targetType;
      if (!target) continue;
      for (const k of model.entityTypes[target]?.keys ?? []) add(e.select, k);
      withKeys(e.expand, target);
    }
  };
  withKeys(expand, typeName);
  return { select, expand };
}

function dedupe(paths: string[]): string[] {
  return [...new Set(paths.filter(Boolean))];
}

// ---------------------------------------------------------------------------------------------
// Request builders

export interface ListRequestOptions {
  source: QuerySource;
  /** Visible columns, in display order. */
  columns: FieldModel[];
  filters?: FilterState;
  search?: string;
  sort?: SortItem[];
  skip?: number;
  top?: number;
  /** Request the total count (ignored when the service cannot count). */
  count?: boolean;
  /** Extra paths to select (e.g. requested by custom content). */
  extraSelect?: string[];
  timeZone?: string;
  /**
   * UI.PresentationVariant/RequestAtLeast of the table's presentation (a view's own PV, FE Table
   * createRequestedProperties); default the entity's default presentation.
   */
  requestAtLeast?: string[];
}

/** Builds the request for a list or sub-table. Applies capability restrictions (Q-01–Q-07). */
export function buildListRequest(model: MetaModel, ui: EntityUi, o: ListRequestOptions): QueryRequest {
  const info = sourceInfo(model, o.source);
  const caps = info.parentSet ? capabilitiesFor(model, info.parentSet, info.navigation) : capabilitiesFor(model, info.entitySet);
  const type = model.entityTypes[info.typeName]!;
  const paths = dedupe([
    ...type.keys,
    ...o.columns.flatMap((c) => fieldPaths(model, info.typeName, c, { cell: true })),
    ...(o.requestAtLeast ?? ui.presentation.requestAtLeast),
    ...(o.extraSelect ?? []),
  ]);
  const { select, expand } = selectAndExpand(model, info.typeName, paths, caps.nonExpandable);
  addChartExpands(model, info.typeName, o.columns, expand, caps.nonExpandable);

  const filters: FilterState = {};
  for (const [path, conds] of Object.entries(o.filters ?? {})) {
    // Conditions the service does not allow for the property are never sent (capability degradation, LR-35, P2-LR-19).
    const allowed = path === EDIT_STATE || hiddenFilterPath(path) ? conds : isFilterable(caps, path) ? restrictConditions(caps.filterExpressions[path], conds, resolvePath(model.entityTypes, info.typeName, path).property?.edmType) : [];
    if (allowed.length) filters[path] = allowed;
  }

  const sort = (o.sort ?? ui.presentation.sortOrder).filter((s) => isSortable(caps, s.path));
  const orderBy: SortItem[] = [];
  for (const s of sort) {
    // Q-05b: amounts and quantities are sorted by their unit first.
    const prop = resolvePath(model.entityTypes, info.typeName, s.path).property;
    if (prop?.unit && 'path' in prop.unit) {
      const unitPath = prefixed(s.path, prop.unit.path);
      if (isSortable(caps, unitPath) && !orderBy.some((x) => x.path === unitPath)) orderBy.push({ path: unitPath, descending: false });
    }
    if (!orderBy.some((x) => x.path === s.path)) orderBy.push(s);
  }

  return {
    source: o.source,
    select,
    expand,
    filters: Object.keys(filters).length ? filters : undefined,
    search: caps.searchable && o.search?.trim() ? o.search.trim() : undefined,
    orderBy,
    skip: caps.skipSupported ? o.skip : undefined,
    top: caps.topSupported ? o.top : undefined,
    count: Boolean(o.count) && caps.countable,
    timeZone: o.timeZone,
    caseInsensitive: caps.caseInsensitive || undefined,
  };
}

/** Fields shown by the object page: header, header facets, and every form in every section. */
export function objectFields(ui: EntityUi): FieldModel[] {
  const out: FieldModel[] = [];
  for (const f of ui.headerFacets) {
    if (f.kind === 'form') out.push(...f.fields);
    else if (f.kind === 'text') out.push(f.field);
    else if (f.kind === 'dataPoint') out.push({ id: f.id, kind: 'dataPoint', dataPoint: f.dataPoint, label: f.label ?? '', criticalityIcon: true, isSemanticKey: false });
    else if (!f.chart.navigation) out.push(...chartFields(f.chart));
    // A chart of a single-valued navigation reads that object's fields; a series has its own query (ADR-025).
    else out.push({ id: f.id, kind: 'chart', chart: f.chart, label: f.label ?? '', criticalityIcon: false, isSemanticKey: false });
  }
  for (const s of ui.sections) for (const sub of s.subSections) {
    if (sub.content.kind === 'form') for (const g of sub.content.groups) out.push(...g.fields);
    if (sub.content.kind === 'dataPoint') out.push({ id: sub.id, kind: 'dataPoint', dataPoint: sub.content.dataPoint, label: sub.label, criticalityIcon: true, isSemanticKey: false });
  }
  return out;
}

/** Fields a chart of the entity itself needs (measures with their data points, dimensions). */
export function chartFields(chart: { id: string; measures: string[]; dimensions: string[]; dataPoints: Record<string, DataPointModel> }): FieldModel[] {
  const out: FieldModel[] = [];
  for (const m of chart.measures) {
    const dp = chart.dataPoints[m];
    out.push(dp ? { id: `${chart.id}::${m}`, kind: 'dataPoint', dataPoint: dp, label: dp.title, criticalityIcon: true, isSemanticKey: false } : { id: `${chart.id}::${m}`, kind: 'field', path: m, label: m, criticalityIcon: true, isSemanticKey: false });
  }
  for (const d of chart.dimensions) out.push({ id: `${chart.id}::${d}`, kind: 'field', path: d, label: d, criticalityIcon: true, isSemanticKey: false });
  return out;
}

/** Builds the read request of an object page (Q-08). */
export function buildObjectRequest(model: MetaModel, typeName: string, ui: EntityUi, extra: FieldModel[] = [], extraSelect: string[] = []): ReadRequest {
  const type = model.entityTypes[typeName]!;
  const hi = ui.headerInfo;
  const paths = dedupe([
    ...type.keys,
    ...(type.etag ? [type.etag] : []),
    ...[hi.title, hi.description].filter((p): p is string => Boolean(p)).flatMap((p) => {
      const prop = resolvePath(model.entityTypes, typeName, p).property;
      return prop ? [p, ...companionPaths(prop, p)] : [p];
    }),
    ...(hi.imageUrl && 'path' in hi.imageUrl ? [hi.imageUrl.path] : []),
    ...[...objectFields(ui), ...extra].flatMap((f) => fieldPaths(model, typeName, f)),
    ...extraSelect,
  ]);
  const out = selectAndExpand(model, typeName, paths);
  const headerIds = new Set(ui.headerFacets.map((f) => f.id));
  addChartExpands(model, typeName, [...objectFields(ui).filter((f) => !headerIds.has(f.id)), ...extra], out.expand);
  return out;
}

/** Maximum number of points read for a micro chart over a navigation collection (ADR-025). */
export const MICRO_CHART_MAX_POINTS = 100;
/** Comparison micro charts show at most 12 bars (docs/15 MC-41). */
export const MICRO_COMPARISON_MAX_BARS = 12;

/** The chart's navigation from `typeName` is a collection (its data is a series of rows). */
export function chartIsSeries(model: MetaModel, typeName: string, chart: Pick<ChartModel, 'navigation'>): boolean {
  if (!chart.navigation) return false;
  let tn = typeName;
  let collection = false;
  for (const seg of chart.navigation.split('/')) {
    const nav = model.entityTypes[tn]?.navigations[seg];
    if (!nav) return false;
    collection ||= nav.collection;
    tn = nav.targetType;
  }
  return collection;
}

/** Paths (relative to the chart's entity) a micro chart reads from each row: keys, measures, dimensions and their texts,
 * units, and the data point values the chart uses (docs/15 §3.2). Paths through further navigations are left out. */
export function chartSeriesSelect(model: MetaModel, chart: ChartModel): string[] {
  const type = model.entityTypes[chart.typeName];
  const out: string[] = [...(type?.keys ?? [])];
  const add = (p: string | undefined) => { if (p && !p.includes('/') && !out.includes(p)) out.push(p); };
  for (const d of chart.dimensions) {
    add(d);
    add(resolvePath(model.entityTypes, chart.typeName, d).property?.text);
  }
  for (const m of chart.measures) {
    add(m);
    const prop = resolvePath(model.entityTypes, chart.typeName, m).property;
    if (prop?.unit && 'path' in prop.unit) add(prop.unit.path);
    if (prop?.text) add(prop.text);
    const dp = chart.dataPoints[m];
    if (dp) {
      add(dp.value);
      const cc = dp.criticalityCalculation;
      for (const ref of [dp.targetValue, dp.criticality, dp.minimumValue, dp.maximumValue, dp.forecastValue,
        cc?.deviationRangeLowValue, cc?.toleranceRangeLowValue, cc?.acceptanceRangeLowValue, cc?.acceptanceRangeHighValue, cc?.toleranceRangeHighValue, cc?.deviationRangeHighValue]) {
        if (ref && 'path' in ref) add(ref.path);
      }
    }
  }
  return out;
}

/** $expand of a micro chart over a collection navigation (ADR-025): ordered by the dimension, at most N rows. */
export function chartExpand(model: MetaModel, chart: ChartModel): ExpandSpec {
  return {
    navigation: chart.navigation,
    select: chartSeriesSelect(model, chart),
    expand: [],
    orderBy: chart.dimensions.slice(0, 1).map((d) => ({ path: d, descending: false })),
    top: chart.chartType === 'Bar' ? MICRO_COMPARISON_MAX_BARS : MICRO_CHART_MAX_POINTS,
  };
}

function addChartExpands(model: MetaModel, typeName: string, fields: FieldModel[], expand: ExpandSpec[], nonExpandable: string[] = []) {
  for (const f of fields) {
    const chart = f.kind === 'chart' ? f.chart : undefined;
    if (!chart || chart.navigation.includes('/') || nonExpandable.includes(chart.navigation) || !chartIsSeries(model, typeName, chart)) continue;
    const e = chartExpand(model, chart);
    const same = expand.find((x) => x.navigation === e.navigation);
    if (!same) expand.push(e);
    else {
      // Two charts over the same collection share one expand.
      for (const p of e.select) if (!same.select.includes(p)) same.select.push(p);
      same.top = Math.max(same.top ?? 0, e.top ?? 0);
      same.orderBy ??= e.orderBy;
    }
  }
}

/**
 * The aggregate of a measure as FE requests it (docs/29 §4 P1-2): a custom aggregate (Aggregation.CustomAggregate with
 * the measure's name as qualifier) is requested by its name, `aggregate(NetAmount)`, and the service decides how it
 * is aggregated (sap.fe.core.converters.helpers.Aggregation isPropertyAggregatable; sap.fe.macros.chart.ChartDelegate).
 * Other measures are summed (`with sum`).
 */
export function aggregateMeasure(model: MetaModel, source: QuerySource, path: string): AggregateMeasure {
  return isCustomAggregate(model, source, path) ? { path } : { path, with: 'sum' };
}

/** Whether `path` is a custom aggregate (Aggregation.CustomAggregate) of the source's entity set or type. */
export function isCustomAggregate(model: MetaModel, source: QuerySource, path: string): boolean {
  const info = sourceInfo(model, source);
  const caps = info.parentSet ? capabilitiesFor(model, info.parentSet, info.navigation) : capabilitiesFor(model, info.entitySet);
  return Boolean(caps.aggregation && Object.hasOwn(caps.aggregation.customAggregates ?? {}, path));
}

export interface AggregateRequestOptions {
  source: QuerySource;
  filters?: FilterState;
  search?: string;
  timeZone?: string;
  /** Maximum number of groups. */
  top?: number;
}

/**
 * Builds the aggregation request of a chart (ADR-021): group by the dimensions (and the texts of the dimensions,
 * so that categories can be labelled) and sum the measures.
 */
export function buildAggregateRequest(model: MetaModel, chart: { dimensions: string[]; measures: string[] }, o: AggregateRequestOptions): QueryRequest {
  const info = sourceInfo(model, o.source);
  const caps = info.parentSet ? capabilitiesFor(model, info.parentSet, info.navigation) : capabilitiesFor(model, info.entitySet);
  const groupBy: string[] = [];
  for (const d of chart.dimensions) {
    groupBy.push(d);
    const prop = resolvePath(model.entityTypes, info.typeName, d).property;
    if (prop) for (const c of companionPaths(prop, d)) if (!groupBy.includes(c)) groupBy.push(c);
  }
  const filters: FilterState = {};
  for (const [path, conds] of Object.entries(o.filters ?? {})) {
    const allowed = path === EDIT_STATE || hiddenFilterPath(path) ? conds : isFilterable(caps, path) ? restrictConditions(caps.filterExpressions[path], conds, resolvePath(model.entityTypes, info.typeName, path).property?.edmType) : [];
    if (allowed.length) filters[path] = allowed;
  }
  return {
    source: o.source,
    select: [],
    expand: [],
    filters: Object.keys(filters).length ? filters : undefined,
    search: caps.searchable && o.search?.trim() ? o.search.trim() : undefined,
    orderBy: chart.dimensions.map((d) => ({ path: d, descending: false })),
    top: o.top,
    count: false,
    timeZone: o.timeZone,
    caseInsensitive: caps.caseInsensitive || undefined,
    aggregate: { groupBy, measures: chart.measures.map((m) => aggregateMeasure(model, o.source, m)) },
  };
}

export interface ChartRequestOptions {
  source: QuerySource;
  filters?: FilterState;
  search?: string;
  timeZone?: string;
  /** Sort of the chart (UI.PresentationVariant SortOrder of the chart's presentation variant); default none. */
  sort?: SortItem[];
}

/**
 * The aggregation request of the list report chart as FE sends it (sap.fe.macros.Chart with sap.chart on the V4
 * model, docs/29 §4 P1-3): `$apply=filter(…)/groupby((<sorted groups>),aggregate(<measures>))&$count=true`. Groups are
 * all dimensions, their Common.Text when it is groupable and not on a navigation (ChartDelegate), and the units of the
 * measures (so amounts in different currencies are never added up); the measures are requested by
 * `aggregateMeasure`. No `$top`; `$orderby` only from `sort`.
 */
export function buildChartRequest(model: MetaModel, chart: Pick<ChartModel, 'dimensions' | 'measures' | 'dynamicMeasures'>, o: ChartRequestOptions): QueryRequest {
  const info = sourceInfo(model, o.source);
  const caps = info.parentSet ? capabilitiesFor(model, info.parentSet, info.navigation) : capabilitiesFor(model, info.entitySet);
  const groupable = caps.aggregation?.groupable ?? [];
  const groups = new Set<string>();
  for (const d of chart.dimensions) {
    groups.add(d);
    const text = resolvePath(model.entityTypes, info.typeName, d).property?.text;
    if (text && !text.includes('/') && !d.includes('/') && (!groupable.length || groupable.includes(text))) groups.add(text);
  }
  // Dynamic measures (Analytics.AggregatedProperty, FE MdcChartTemplate getDynamicMeasures) come first:
  // `aggregate(<property> with <method> as <name>)`.
  const transAgg = (name: string) => caps.aggregation?.aggregatedProperties?.find((x) => x.name === name);
  const dynamic = (chart.dynamicMeasures ?? []).map(transAgg).filter((x): x is NonNullable<typeof x> => Boolean(x));
  const measurePaths = [...dynamic.map((x) => x.property), ...chart.measures];
  for (const m of measurePaths) {
    const prop = resolvePath(model.entityTypes, info.typeName, m).property;
    if (prop?.unit && 'path' in prop.unit) groups.add(prefixed(m, prop.unit.path));
  }
  const filters: FilterState = {};
  for (const [path, conds] of Object.entries(o.filters ?? {})) {
    const allowed = path === EDIT_STATE || hiddenFilterPath(path) ? conds : isFilterable(caps, path) ? restrictConditions(caps.filterExpressions[path], conds, resolvePath(model.entityTypes, info.typeName, path).property?.edmType) : [];
    if (allowed.length) filters[path] = allowed;
  }
  return {
    source: o.source,
    select: [],
    expand: [],
    filters: Object.keys(filters).length ? filters : undefined,
    search: caps.searchable && o.search?.trim() ? o.search.trim() : undefined,
    orderBy: (o.sort ?? []).filter((s) => isSortable(caps, s.path)),
    count: caps.countable,
    timeZone: o.timeZone,
    caseInsensitive: caps.caseInsensitive || undefined,
    // the V4 model sorts the groups of $$aggregation (sap.ui.model.odata.v4.lib._AggregationHelper)
    aggregate: {
      groupBy: [...groups].sort(),
      measures: [
        ...dynamic.map((x): AggregateMeasure => ({ path: x.property, with: x.method as AggregateMeasure['with'], as: x.name })),
        ...chart.measures.map((m) => aggregateMeasure(model, o.source, m)),
      ],
    },
  };
}

export interface ValueHelpRequestOptions {
  /**
   * What the request is for (FE ValueListHelper): `dialog` – the value help dialog's table ($select of the value list
   * entity's UI.SelectionFields, the parameters and the keys; texts of the shown columns expanded; sorted by the
   * value list's PresentationVariant, else by the key); `suggest` (default) – type-ahead and fixed values (sorted by
   * the PresentationVariant, fixed values else by their first shown parameter); `description` – the text of one
   * value (`$select` = the description, `$top=2`, no count, as the mdc field reads a token's description;
   * `withDescription: false` when the field shows the code only); `validate` – a typed value checked as the mdc field
   * does (`getItemForValue` with `checkKey` and `checkDescription`): `$filter=<key> eq 'v' or <description> eq 'v'`
   * (the key only without a description or with `withDescription: false`), no `$select`, `$top=2`.
   */
  purpose?: 'dialog' | 'suggest' | 'description' | 'validate';
  /** With `purpose: 'description'`: whether the description is selected (default true). */
  withDescription?: boolean;
  search?: string;
  skip?: number;
  top?: number;
  /** Restrict to these key values (used to load descriptions of selected tokens). */
  keys?: string[];
  /**
   * Conditions of the source by local property path (the filter bar's filter state). The value list's In and InOut
   * parameters take the conditions of their LocalDataProperty (FE ValueHelpDelegate
   * `_getInitialFilterConditionsFromFilterBar`).
   */
  filters?: FilterState;
}

/**
 * Filter of a value help request from its In, InOut and Constant parameters (FE ValueListHelper `getInParameters`,
 * ValueHelpDelegate `_resolveInParameterConditions`): a Constant gives an "EQ" condition (none for an empty
 * constant), In and InOut take the source's conditions of their LocalDataProperty. The parameter of the annotated
 * property itself is left out (FE `_getValueListInfo`: LocalDataProperty !== the property).
 */
export function valueHelpInFilters(vl: ValueListModel, source: FilterState = {}): FilterState {
  const own = vl.parameters.find((x) => x.valueListProperty === vl.keyProperty && x.local)?.local;
  const out: FilterState = {};
  // constants first, then the filter bar's conditions (the order FE builds the conditions in)
  for (const p of vl.parameters) {
    if (p.kind === 'Constant' && p.valueListProperty && p.constant !== undefined && p.constant !== '') out[p.valueListProperty] = [{ operator: 'EQ', values: [p.constant] }];
  }
  for (const p of vl.parameters) {
    if (!p.valueListProperty) continue;
    if ((p.kind === 'In' || p.kind === 'InOut') && p.local && p.local !== own) {
      const conds = (source[p.local] ?? []).filter(isComplete).map(({ text: _text, ...c }) => c);
      if (conds.length) out[p.valueListProperty] = conds;
    }
  }
  return out;
}

/** Builds the value help request (Q-09). */
export function buildValueHelpRequest(model: MetaModel, vl: ValueListModel, o: ValueHelpRequestOptions = {}): QueryRequest {
  const set = model.entitySets[vl.collectionPath];
  const caps = set?.capabilities;
  const params = dedupe(vl.parameters.filter((p) => p.kind !== 'Constant').map((p) => p.valueListProperty));
  const term = o.search?.trim();
  let anyOf: FilterState | undefined;
  let search: string | undefined;
  if (term) {
    // FE ValueListHelper.entityIsSearchable: $search unless SearchSupported=false or Searchable=false (both default true).
    if (vl.searchSupported && caps?.searchable !== false) search = term;
    else {
      const type = set ? model.entityTypes[set.typeName] : undefined;
      anyOf = {};
      for (const p of params) {
        if (type?.properties[p]?.edmType === 'Edm.String') anyOf[p] = [{ operator: 'Contains', values: [term] } satisfies Condition];
      }
    }
  }
  // Descriptions of selected tokens are read by key only; otherwise In, InOut and Constant parameters filter.
  const inFilters = o.keys?.length ? {} : valueHelpInFilters(vl, o.filters);
  const keyFilter: FilterState = o.keys?.length ? { [vl.keyProperty]: o.keys.map((k) => ({ operator: 'EQ' as const, values: [k] })) } : {};
  const merged = { ...inFilters, ...keyFilter };
  const filters: FilterState | undefined = Object.keys(merged).length ? merged : undefined;
  const typeName = set?.typeName ?? '';
  const vhType = model.entityTypes[typeName];
  const vhUi = model.ui[typeName];
  if (o.purpose === 'validate') {
    const value = o.keys?.[0] ?? '';
    const desc = o.withDescription === false ? undefined : vl.descriptionProperty;
    const anyOf: FilterState = { [vl.keyProperty]: [{ operator: 'EQ', values: [value] }], ...(desc ? { [desc]: [{ operator: 'EQ', values: [value] }] } : {}) };
    return { source: { entitySet: vl.collectionPath }, select: [], expand: [], anyOf, anyOfOnly: true, orderBy: [], skip: undefined, top: 2, count: false };
  }
  if (o.purpose === 'description') {
    const desc = vl.descriptionProperty;
    const sel = o.withDescription === false || !desc ? { select: [], expand: [] } : selectAndExpand(model, typeName, [desc]);
    return { source: { entitySet: vl.collectionPath }, select: sel.select, expand: sel.expand, filters, orderBy: [], skip: undefined, top: 2, count: false };
  }
  // PresentationVariant of the value list entity (PresentationVariantQualifier, else the unqualified one)
  const pvSort = vhUi?.presentationVariants?.[vl.presentationVariantQualifier ?? '']?.presentation.sortOrder ?? [];
  let orderBy: SortItem[] = pvSort.map((x) => ({ path: x.path, descending: x.descending }));
  const hidden = (path: string) => (vhType ? resolvePath(model.entityTypes, typeName, path).property?.hidden === true : false);
  let paths: string[];
  if (o.purpose === 'dialog') {
    // FE _getColumnDefinitionFromSelectionFields + _mergeColumnDefinitionsFromProperties + vhKeys; $select leaves out
    // navigation paths (_build$SelectString); the texts of the shown columns (the parameters) are expanded.
    const selectionFields = vhUi && !vhUi.derived.selectionFields ? vhUi.selectionFields : [];
    const columns = dedupe([...selectionFields, ...vl.parameters.map((p) => p.valueListProperty), ...(vhType?.keys ?? [])]).filter((p) => !p.includes('/'));
    const texts = params.filter((p) => !hidden(p)).flatMap((p) => {
      const prop = resolvePath(model.entityTypes, typeName, p).property;
      return prop?.text ? [prefixed(p, prop.text)] : [];
    }).filter((p) => p.includes('/'));
    paths = [...columns, ...texts];
    // without a PresentationVariant: by the key, but not while searching (FE: the search result keeps its order)
    if (!orderBy.length && !search && !anyOf) orderBy = [{ path: vl.keyProperty, descending: false }];
  } else {
    paths = params;
    if (!orderBy.length && vl.fixedValues) {
      // FE _getDefaultSortPropertyName: the first InOut / Out / DisplayOnly parameter that is not hidden (its text for TextOnly)
      const first = vl.parameters.find((p) => (p.kind === 'InOut' || p.kind === 'Out' || p.kind === 'DisplayOnly') && !p.valueListProperty.includes('/') && !hidden(p.valueListProperty));
      const prop = first ? resolvePath(model.entityTypes, typeName, first.valueListProperty).property : undefined;
      const path = first && prop?.text && prop.textArrangement === 'TextOnly' ? prop.text : first?.valueListProperty;
      if (path) orderBy = [{ path, descending: false }];
    }
  }
  const sel = set ? selectAndExpand(model, typeName, paths) : { select: paths, expand: [] };
  return {
    source: { entitySet: vl.collectionPath },
    select: sel.select,
    expand: sel.expand,
    filters,
    anyOf,
    search,
    orderBy,
    skip: o.skip ?? 0,
    top: o.top ?? 50,
    // only the dialog's table counts its rows; type-ahead and fixed values do not (FE ValueListHelper
    // getTableItemsParameters: "length: 10" without $count)
    count: o.purpose === 'dialog' ? caps?.countable ?? true : false,
  };
}

// ---------------------------------------------------------------------------------------------
// URL form

const SAFE = /%(2C|28|29|2F|27|24|3A|40|3D)/g;
const DECODE: Record<string, string> = { '2C': ',', '28': '(', '29': ')', '2F': '/', '27': "'", '24': '$', '3A': ':', '40': '@', '3D': '=' };

/** Encodes a system query option value, keeping OData punctuation readable. */
export function encodeOption(v: string): string {
  return encodeURIComponent(v).replace(SAFE, (_, h: string) => DECODE[h.toUpperCase()]!);
}

function expandToString(e: ExpandSpec): string {
  const inner: string[] = [];
  if (e.select.length) inner.push(`$select=${e.select.join(',')}`);
  if (e.expand.length) inner.push(`$expand=${e.expand.map(expandToString).join(',')}`);
  if (e.orderBy?.length) inner.push(`$orderby=${e.orderBy.map((s) => (s.descending ? `${s.path} desc` : s.path)).join(',')}`);
  if (e.top !== undefined) inner.push(`$top=${e.top}`);
  return inner.length ? `${e.navigation}(${inner.join(';')})` : e.navigation;
}

/** Edm type lookup for filter literals. */
export function typeLookup(model: MetaModel, typeName: string) {
  return (path: string) => resolvePath(model.entityTypes, typeName, path).property?.edmType;
}

/** Builds the $filter string of a request (filters and anyOf). */
export function filterString(model: MetaModel, typeName: string, req: Pick<QueryRequest, 'filters' | 'anyOf' | 'anyOfOnly' | 'timeZone' | 'caseInsensitive'>): string | undefined {
  const typeOf = typeLookup(model, typeName);
  const parts: string[] = [];
  if (req.anyOfOnly && req.anyOf && !req.filters) {
    const ors = Object.entries(req.anyOf).map(([p, cs]) => toFilter({ [p]: cs }, typeOf, { timeZone: req.timeZone, caseInsensitive: req.caseInsensitive })).filter((x): x is string => Boolean(x));
    return ors.length ? ors.join(' or ') : undefined;
  }
  const all = req.filters ? toFilter(req.filters, typeOf, { timeZone: req.timeZone, caseInsensitive: req.caseInsensitive }) : undefined;
  if (all) parts.push(all);
  if (req.anyOf) {
    const ors = Object.entries(req.anyOf)
      .map(([p, cs]) => toFilter({ [p]: cs }, typeOf, { timeZone: req.timeZone, caseInsensitive: req.caseInsensitive }))
      .filter((x): x is string => Boolean(x));
    if (ors.length) parts.push(ors.length === 1 ? ors[0]! : `(${ors.join(' or ')})`);
  }
  // Hidden filters (a view's selection variant), then the draft editing status (filter state key $editState):
  // FE adds both after the filter bar conditions.
  // Each property of a hidden selection variant is a filter of its own, in parentheses as the SAPUI5 V4 model writes
  // FE's per-SelectOption filters ("(Status eq 'A' or Status eq 'B') and (CompanyCode eq '1000')").
  for (const [path, conds] of Object.entries(hiddenFiltersOf(req.filters))) {
    const f = toFilter({ [path]: conds }, typeOf, { timeZone: req.timeZone, caseInsensitive: req.caseInsensitive });
    if (f) parts.push(wrapped(f) ? f : `(${f})`);
  }
  if (req.filters?.[EDIT_STATE]) parts.push(editStateFilter(editStateOf(req.filters), parts.length > 0));
  return parts.length ? parts.join(' and ') : undefined;
}

/** Whether a filter expression is one parenthesized group, e.g. "(a or b)" (not "(a) and (b)"). */
function wrapped(f: string): boolean {
  if (!f.startsWith('(')) return false;
  let depth = 0;
  let quoted = false;
  for (let i = 0; i < f.length; i++) {
    const c = f[i];
    if (c === "'") quoted = !quoted;
    else if (!quoted && c === '(') depth++;
    else if (!quoted && c === ')' && --depth === 0) return i === f.length - 1;
  }
  return false;
}

/** The query string (without "?") of a list request. Options are emitted in a stable order. */
export function toQueryString(model: MetaModel, request: QueryRequest): string {
  // the parameters of a parameterized entity set are in the resource path (sourcePath), not in $filter
  const req = withoutParameters(model, request);
  const info = sourceInfo(model, req.source);
  const opts: string[] = [];
  if (req.analytical) return analyticalQueryString(model, req, req.analytical, info.typeName);
  if (req.aggregate) {
    // $apply is evaluated before $filter: filters go into a filter() transformation (OData Data Aggregation §3).
    const filter = filterString(model, info.typeName, req);
    const aggregates = req.aggregate.measures
      .map((m) => (m.with === 'count' ? `$count as ${m.as ?? 'count'}`
        : m.with ? `${m.path} with ${m.with} as ${m.as ?? m.path.replace(/\//g, '_')}`
          : m.as && m.as !== m.path ? `${m.path} as ${m.as}` : m.path))
      .join(',');
    const steps = [
      ...(filter ? [`filter(${filter})`] : []),
      ...(req.search ? [`search(${req.search})`] : []),
      // No dimensions: one total row (numeric card header, docs/20).
      req.aggregate.groupBy.length
        ? `groupby((${req.aggregate.groupBy.join(',')}),aggregate(${aggregates}))`
        : `aggregate(${aggregates})`,
    ];
    opts.push(`$apply=${encodeOption(steps.join('/'))}`);
    if (req.count) opts.push('$count=true');
    if (req.orderBy.length) opts.push(`$orderby=${encodeOption(req.orderBy.map((s) => (s.descending ? `${s.path} desc` : s.path)).join(','))}`);
    if (req.top !== undefined) opts.push(`$top=${req.top}`);
    return opts.join('&');
  }
  if (req.hierarchy) return hierarchyQueryString(model, req, req.hierarchy, info.typeName);
  if (req.count) opts.push('$count=true');
  if (req.select.length) opts.push(`$select=${encodeOption(req.select.join(','))}`);
  const filter = filterString(model, info.typeName, req);
  if (filter) opts.push(`$filter=${encodeOption(filter)}`);
  if (req.search) opts.push(`$search=${encodeOption(req.search)}`);
  if (req.orderBy.length) opts.push(`$orderby=${encodeOption(req.orderBy.map((s) => (s.descending ? `${s.path} desc` : s.path)).join(','))}`);
  if (req.expand.length) opts.push(`$expand=${encodeOption(req.expand.map(expandToString).join(','))}`);
  if (req.skip !== undefined) opts.push(`$skip=${req.skip}`);
  if (req.top !== undefined) opts.push(`$top=${req.top}`);
  return opts.join('&');
}

const aggregateList = (measures: AggregateMeasure[]) => measures
  .map((m) => (m.with === 'count' ? `$count as ${m.as ?? 'count'}`
    : m.with ? `${m.path} with ${m.with} as ${m.as ?? m.path.replace(/\//g, '_')}`
      : m.as && m.as !== m.path ? `${m.path} as ${m.as}` : m.path))
  .join(',');

/**
 * First page of an analytical table as sap.ui.model.odata.v4.lib._AggregationHelper buildApply writes it (AL-10):
 * `filter(F)/search(S)/concat(aggregate(<grand total>),groupby((<leaf groups>),aggregate(<measures>))/orderby(O)/
 * concat(aggregate($count as UI5__count),skip(s)/top(t)))`, no other system query option.
 */
function analyticalQueryString(model: MetaModel, req: QueryRequest, a: AnalyticalApply, typeName: string): string {
  const filter = filterString(model, typeName, req);
  const measures = aggregateList(a.measures);
  let leaves = a.groupBy.length ? `groupby((${a.groupBy.join(',')})${measures ? `,aggregate(${measures})` : ''})` : measures ? `aggregate(${measures})` : 'identity';
  if (req.orderBy.length) leaves += `/orderby(${req.orderBy.map((s) => (s.descending ? `${s.path} desc` : s.path)).join(',')})`;
  const skipTop = [...(req.skip ? [`skip(${req.skip})`] : []), ...(req.top !== undefined ? [`top(${req.top})`] : [])].join('/');
  if (req.count) leaves += `/concat(aggregate($count as UI5__count),${skipTop || 'identity'})`;
  else if (skipTop) leaves += `/${skipTop}`;
  const main = a.grandTotal.length ? `concat(aggregate(${aggregateList(a.grandTotal)}),${leaves})` : leaves;
  const steps = [...(filter ? [`filter(${filter})`] : []), ...(req.search ? [`search(${req.search})`] : []), main];
  return `$apply=${encodeOption(steps.join('/'))}`;
}

/**
 * TopLevels request as SAP Fiori elements sends it: filters and search keep the matching nodes with their ancestors
 * (`ancestors(…,keep start)`), the sort applies to siblings (`orderby` before TopLevels).
 */
function hierarchyQueryString(model: MetaModel, req: QueryRequest, h: HierarchyRequest, typeName: string): string {
  const nodes = `$root/${sourcePath(model, req.source, req.filters)}`;
  const steps: string[] = [];
  const filter = filterString(model, typeName, req);
  const limit = [...(filter ? [`filter(${filter})`] : []), ...(req.search ? [`search(${req.search})`] : [])];
  if (limit.length) steps.push(`ancestors(${nodes},${h.qualifier},${h.nodeProperty},${limit.join('/')},keep start)`);
  if (req.orderBy.length) steps.push(`orderby(${req.orderBy.map((s) => (s.descending ? `${s.path} desc` : s.path)).join(',')})`);
  const params = [`HierarchyNodes=${nodes}`, `HierarchyQualifier='${h.qualifier}'`, `NodeProperty='${h.nodeProperty}'`];
  if (h.levels !== undefined) params.push(`Levels=${h.levels}`);
  if (h.expandLevels?.length) params.push(`ExpandLevels=${JSON.stringify(h.expandLevels.map((e) => ({ NodeID: e.nodeId, Levels: e.levels })))}`);
  steps.push(`com.sap.vocabularies.Hierarchy.v1.TopLevels(${params.join(',')})`);
  const opts = [`$apply=${encodeOption(steps.join('/'))}`];
  if (req.count) opts.push('$count=true');
  if (req.select.length) opts.push(`$select=${encodeOption(req.select.join(','))}`);
  if (req.expand.length) opts.push(`$expand=${encodeOption(req.expand.map(expandToString).join(','))}`);
  if (req.skip !== undefined) opts.push(`$skip=${req.skip}`);
  if (req.top !== undefined) opts.push(`$top=${req.top}`);
  return opts.join('&');
}

/** Query string of a read request. */
export function readQueryString(req: ReadRequest): string {
  const opts: string[] = [];
  if (req.select.length) opts.push(`$select=${encodeOption(req.select.join(','))}`);
  if (req.expand.length) opts.push(`$expand=${encodeOption(req.expand.map(expandToString).join(','))}`);
  return opts.join('&');
}

/**
 * The parameter values of a parameterized entity set from the conditions (EntitySetModel.parameters): the first value of
 * each parameter's first complete condition (FE FilterUtils getBindingPathForParameters); undefined when the set has no
 * parameters. Missing parameters are left out.
 */
export function parameterValues(model: MetaModel, entitySet: string, filters: FilterState | undefined): Record<string, unknown> | undefined {
  const params = model.entitySets[entitySet]?.parameters;
  if (!params) return undefined;
  const out: Record<string, unknown> = {};
  for (const p of params.properties) {
    const c = (filters?.[p] ?? []).find(isComplete);
    if (c && c.values[0] !== undefined && c.values[0] !== null && c.values[0] !== '') out[p] = c.values[0];
  }
  return out;
}

/** The conditions without the parameters of a parameterized entity set (they go into the resource path, not $filter). */
function withoutParameters<T extends Pick<QueryRequest, 'source' | 'filters'>>(model: MetaModel, req: T): T {
  if (!('entitySet' in req.source) || !req.filters) return req;
  const params = model.entitySets[req.source.entitySet]?.parameters;
  if (!params || !params.properties.some((p) => p in req.filters!)) return req;
  const filters = Object.fromEntries(Object.entries(req.filters).filter(([k]) => !params.properties.includes(k)));
  return { ...req, filters: Object.keys(filters).length ? filters : undefined };
}

/**
 * Resource path (relative to the service root) of a request source. A parameterized entity set ("P/Set") is addressed
 * with its parameter values from `filters`: "P(p1='EUR',p2=2026-11-14)/Set" (OData key literals, in parameter order).
 */
export function sourcePath(model: MetaModel, source: QuerySource, filters?: FilterState): string {
  if ('entitySet' in source) {
    const params = model.entitySets[source.entitySet]?.parameters;
    if (!params) return source.entitySet;
    const values = parameterValues(model, source.entitySet, filters)!;
    const missing = params.properties.filter((p) => !(p in values));
    if (missing.length) throw new Error(`Parameterized entity set "${source.entitySet}": no value for ${missing.join(', ')}`);
    const type = model.entityTypes[params.typeName]!;
    const keys = params.properties.map((p) => `${p}=${encodeKeyLiteral(values[p], type.properties[p]!.edmType)}`).join(',');
    return `${params.entitySet}(${keys})/${params.navigation}`;
  }
  return `${resolveEntityPath(model, source.parent).canonical}/${source.navigation}`;
}
