/** Query requests and their OData URL form. See docs/05-data-provider.md §2. */
import { toFilter, type Condition, type FilterState } from '../conditions/conditions';
import { restrictConditions } from '../conditions/filterExpressions';
import { capabilitiesFor, isFilterable, isSortable } from '../model/access';
import { resolvePath } from '../model/buildModel';
import type { DataPointModel, EntityUi, FieldModel, MetaModel, PropertyModel, ValueListModel } from '../model/types';
import { resolveEntityPath, type EntityPath } from './entityPath';

export type Row = Record<string, unknown>;

export interface SortItem {
  path: string;
  descending: boolean;
}

export interface ExpandSpec {
  navigation: string;
  select: string[];
  expand: ExpandSpec[];
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
  search?: string;
  orderBy: SortItem[];
  skip?: number;
  top?: number;
  count: boolean;
  /** Time zone for calendar-day filters on Edm.DateTimeOffset properties. */
  timeZone?: string;
  /** Server-side aggregation ($apply, OData Data Aggregation): group by `groupBy` and aggregate the measures (ADR-021). */
  aggregate?: { groupBy: string[]; measures: { path: string; with: 'sum' | 'average' | 'min' | 'max' }[] };
}

export interface ReadRequest {
  select: string[];
  expand: ExpandSpec[];
}

export interface QueryResult {
  rows: Row[];
  count?: number;
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
export function fieldPaths(model: MetaModel, typeName: string, field: FieldModel): string[] {
  if (field.kind === 'dataPoint' && field.dataPoint) return dataPointPaths(model, typeName, field.dataPoint);
  const out: string[] = [];
  if (!field.path) return out;
  out.push(field.path);
  const prop = resolvePath(model.entityTypes, typeName, field.path).property;
  if (prop) out.push(...companionPaths(prop, field.path));
  if (field.criticality && 'path' in field.criticality) out.push(field.criticality.path);
  if (field.url && 'path' in field.url) out.push(field.url.path);
  return out;
}

/** Text, unit and criticality paths of a property reached through `path`. */
export function companionPaths(prop: PropertyModel, path: string): string[] {
  const out: string[] = [];
  if (prop.text) out.push(prefixed(path, prop.text));
  if (prop.unit && 'path' in prop.unit) out.push(prefixed(path, prop.unit.path));
  if (prop.criticality && 'path' in prop.criticality) out.push(prefixed(path, prop.criticality.path));
  return out;
}

export function dataPointPaths(model: MetaModel, typeName: string, dp: DataPointModel): string[] {
  const out = [dp.value];
  const prop = resolvePath(model.entityTypes, typeName, dp.value).property;
  if (prop) out.push(...companionPaths(prop, dp.value));
  for (const ref of [dp.targetValue, dp.criticality, dp.minimumValue, dp.maximumValue, dp.sampleSize]) if (ref && 'path' in ref) out.push(ref.path);
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
}

/** Builds the request for a list or sub-table. Applies capability restrictions (Q-01–Q-07). */
export function buildListRequest(model: MetaModel, ui: EntityUi, o: ListRequestOptions): QueryRequest {
  const info = sourceInfo(model, o.source);
  const caps = info.parentSet ? capabilitiesFor(model, info.parentSet, info.navigation) : capabilitiesFor(model, info.entitySet);
  const type = model.entityTypes[info.typeName]!;
  const paths = dedupe([
    ...type.keys,
    ...o.columns.flatMap((c) => fieldPaths(model, info.typeName, c)),
    ...ui.presentation.requestAtLeast,
    ...(o.extraSelect ?? []),
  ]);
  const { select, expand } = selectAndExpand(model, info.typeName, paths, caps.nonExpandable);

  const filters: FilterState = {};
  for (const [path, conds] of Object.entries(o.filters ?? {})) {
    // Conditions the service does not allow for the property are never sent (capability degradation, LR-35, P2-LR-19).
    const allowed = isFilterable(caps, path) ? restrictConditions(caps.filterExpressions[path], conds) : [];
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
  return selectAndExpand(model, typeName, paths);
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
    const allowed = isFilterable(caps, path) ? restrictConditions(caps.filterExpressions[path], conds) : [];
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
    aggregate: { groupBy, measures: chart.measures.map((m) => ({ path: m, with: 'sum' as const })) },
  };
}

export interface ValueHelpRequestOptions {
  search?: string;
  skip?: number;
  top?: number;
  /** Restrict to these key values (used to load descriptions of selected tokens). */
  keys?: string[];
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
    if (vl.searchSupported || caps?.searchable) search = term;
    else {
      const type = set ? model.entityTypes[set.typeName] : undefined;
      anyOf = {};
      for (const p of params) {
        if (type?.properties[p]?.edmType === 'Edm.String') anyOf[p] = [{ operator: 'Contains', values: [term] } satisfies Condition];
      }
    }
  }
  const filters: FilterState | undefined = o.keys?.length ? { [vl.keyProperty]: o.keys.map((k) => ({ operator: 'EQ' as const, values: [k] })) } : undefined;
  const typeName = set?.typeName ?? '';
  const sel = set ? selectAndExpand(model, typeName, params) : { select: params, expand: [] };
  return {
    source: { entitySet: vl.collectionPath },
    select: sel.select,
    expand: sel.expand,
    filters,
    anyOf,
    search,
    orderBy: [{ path: vl.keyProperty, descending: false }],
    skip: o.skip ?? 0,
    top: o.top ?? 50,
    count: caps?.countable ?? true,
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
  return inner.length ? `${e.navigation}(${inner.join(';')})` : e.navigation;
}

/** Edm type lookup for filter literals. */
export function typeLookup(model: MetaModel, typeName: string) {
  return (path: string) => resolvePath(model.entityTypes, typeName, path).property?.edmType;
}

/** Builds the $filter string of a request (filters and anyOf). */
export function filterString(model: MetaModel, typeName: string, req: Pick<QueryRequest, 'filters' | 'anyOf' | 'timeZone'>): string | undefined {
  const typeOf = typeLookup(model, typeName);
  const parts: string[] = [];
  const all = req.filters ? toFilter(req.filters, typeOf, { timeZone: req.timeZone }) : undefined;
  if (all) parts.push(all);
  if (req.anyOf) {
    const ors = Object.entries(req.anyOf)
      .map(([p, cs]) => toFilter({ [p]: cs }, typeOf, { timeZone: req.timeZone }))
      .filter((x): x is string => Boolean(x));
    if (ors.length) parts.push(ors.length === 1 ? ors[0]! : `(${ors.join(' or ')})`);
  }
  return parts.length ? parts.join(' and ') : undefined;
}

/** The query string (without "?") of a list request. Options are emitted in a stable order. */
export function toQueryString(model: MetaModel, req: QueryRequest): string {
  const info = sourceInfo(model, req.source);
  const opts: string[] = [];
  if (req.aggregate) {
    // $apply is evaluated before $filter: filters go into a filter() transformation (OData Data Aggregation §3).
    const filter = filterString(model, info.typeName, req);
    const steps = [
      ...(filter ? [`filter(${filter})`] : []),
      ...(req.search ? [`search(${req.search})`] : []),
      `groupby((${req.aggregate.groupBy.join(',')}),aggregate(${req.aggregate.measures.map((m) => `${m.path} with ${m.with} as ${m.path.replace(/\//g, '_')}`).join(',')}))`,
    ];
    opts.push(`$apply=${encodeOption(steps.join('/'))}`);
    if (req.orderBy.length) opts.push(`$orderby=${encodeOption(req.orderBy.map((s) => (s.descending ? `${s.path} desc` : s.path)).join(','))}`);
    if (req.top !== undefined) opts.push(`$top=${req.top}`);
    return opts.join('&');
  }
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

/** Query string of a read request. */
export function readQueryString(req: ReadRequest): string {
  const opts: string[] = [];
  if (req.select.length) opts.push(`$select=${encodeOption(req.select.join(','))}`);
  if (req.expand.length) opts.push(`$expand=${encodeOption(req.expand.map(expandToString).join(','))}`);
  return opts.join('&');
}

/** Resource path (relative to the service root) of a request source. */
export function sourcePath(model: MetaModel, source: QuerySource): string {
  if ('entitySet' in source) return source.entitySet;
  return `${resolveEntityPath(model, source.parent).canonical}/${source.navigation}`;
}
