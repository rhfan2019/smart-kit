/**
 * Group subtotals and grand totals of a list (docs/23): computed by the service with $apply, never by adding up the
 * loaded rows (lists load page by page). Amounts are split by unit or currency.
 */
import type { Condition, FilterState } from '../conditions/conditions';
import { restrictConditions } from '../conditions/filterExpressions';
import { capabilitiesFor, isFilterable, isSortable } from '../model/access';
import { resolvePath } from '../model/buildModel';
import type { CapabilityModel, MetaModel } from '../model/types';
import { companionPaths, sourceInfo, type QueryRequest, type QuerySource, type Row } from './request';

/** Alias of the number of rows of a group in a totals result. */
export const TOTAL_COUNT_ALIAS = 'smartkit_count';

/** Maximum number of group values in one subtotal request (URL length). */
export const MAX_GROUP_VALUES = 50;

const NUMERIC = new Set(['Edm.Decimal', 'Edm.Double', 'Edm.Single', 'Edm.Int16', 'Edm.Int32', 'Edm.Int64', 'Edm.Byte', 'Edm.SByte']);

function capsOf(model: MetaModel, source: QuerySource): { caps: CapabilityModel; typeName: string } {
  const info = sourceInfo(model, source);
  const caps = info.parentSet ? capabilitiesFor(model, info.parentSet, info.navigation) : capabilitiesFor(model, info.entitySet);
  return { caps, typeName: info.typeName };
}

/** Whether totals can be requested for `path`: Aggregation.ApplySupported is declared, the property is numeric and aggregatable with sum. */
export function canTotal(model: MetaModel, source: QuerySource, path: string): boolean {
  const { caps, typeName } = capsOf(model, source);
  const agg = caps.aggregation;
  if (!agg || (agg.transformations.length && !agg.transformations.includes('aggregate'))) return false;
  const prop = resolvePath(model.entityTypes, typeName, path).property;
  if (!prop || !NUMERIC.has(prop.edmType)) return false;
  if (!agg.aggregatable.length) return !path.includes('/');
  const entry = agg.aggregatable.find((a) => a.path === path);
  return Boolean(entry && (!entry.methods.length || entry.methods.includes('sum')));
}

/**
 * Whether a list can be grouped by `path`. With Aggregation.ApplySupported only GroupableProperties (when listed);
 * otherwise any sortable property (grouping without subtotals).
 */
export function canGroup(model: MetaModel, source: QuerySource, path: string): boolean {
  const { caps } = capsOf(model, source);
  if (!isSortable(caps, path)) return false;
  const agg = caps.aggregation;
  return !agg?.groupable.length || agg.groupable.includes(path);
}

/** Whether group subtotals (and counts) can be requested when grouping by `path`. */
export function canSubtotal(model: MetaModel, source: QuerySource, path: string): boolean {
  const { caps } = capsOf(model, source);
  const agg = caps.aggregation;
  if (!agg || (agg.transformations.length && !agg.transformations.includes('groupby'))) return false;
  return !agg.groupable.length || agg.groupable.includes(path);
}

export interface TotalsRequestOptions {
  source: QuerySource;
  filters?: FilterState;
  search?: string;
  timeZone?: string;
  /** Properties to sum. */
  measures: string[];
  /** Group property: one result row per group (and unit). Without it: grand totals. */
  groupBy?: string;
  /** Only these groups (values of `groupBy`; null or '' for the empty group), at most MAX_GROUP_VALUES. */
  groupValues?: unknown[];
}

/** Unit or currency property of a measure (Measures.ISOCurrency / Measures.Unit given by a path). */
export function unitPathOf(model: MetaModel, typeName: string, path: string): string | undefined {
  const prop = resolvePath(model.entityTypes, typeName, path).property;
  if (!prop?.unit || !('path' in prop.unit)) return undefined;
  const i = path.lastIndexOf('/');
  return i < 0 ? prop.unit.path : `${path.slice(0, i)}/${prop.unit.path}`;
}

/** Fixed unit or currency of a measure (Measures.ISOCurrency / Measures.Unit given as a string). */
function fixedUnitOf(model: MetaModel, typeName: string, path: string): string | undefined {
  const prop = resolvePath(model.entityTypes, typeName, path).property;
  return prop?.unit && 'value' in prop.unit ? String(prop.unit.value ?? '') || undefined : undefined;
}

/**
 * Builds the $apply request of totals:
 * `filter(…)/groupby((Group,GroupText,Currency),aggregate(NetAmount with sum as NetAmount,$count as smartkit_count))`.
 * Units of the measures are always grouped by, so amounts in different currencies are never added up.
 */
export function buildTotalsRequest(model: MetaModel, o: TotalsRequestOptions): QueryRequest {
  const { caps, typeName } = capsOf(model, o.source);
  const groupBy: string[] = [];
  const add = (p: string | undefined) => {
    if (p && !groupBy.includes(p)) groupBy.push(p);
  };
  if (o.groupBy) {
    add(o.groupBy);
    const prop = resolvePath(model.entityTypes, typeName, o.groupBy).property;
    if (prop) for (const c of companionPaths(prop, o.groupBy)) add(c);
  }
  for (const m of o.measures) add(unitPathOf(model, typeName, m));

  const filters: FilterState = {};
  for (const [path, conds] of Object.entries(o.filters ?? {})) {
    const allowed = isFilterable(caps, path) ? restrictConditions(caps.filterExpressions[path], conds) : [];
    if (allowed.length) filters[path] = allowed;
  }
  let anyOf: FilterState | undefined;
  if (o.groupBy && o.groupValues) {
    const conds: Condition[] = o.groupValues.map((v) =>
      v === null || v === undefined || v === '' ? { operator: 'Empty', values: [] } : { operator: 'EQ', values: [v] },
    );
    anyOf = { [o.groupBy]: conds };
  }
  const measures: NonNullable<QueryRequest['aggregate']>['measures'] = o.measures.map((m) => ({ path: m, with: 'sum' }));
  if (o.groupBy) measures.push({ path: '', with: 'count', as: TOTAL_COUNT_ALIAS });
  return {
    source: o.source,
    select: [],
    expand: [],
    filters: Object.keys(filters).length ? filters : undefined,
    anyOf,
    search: caps.searchable && o.search?.trim() ? o.search.trim() : undefined,
    orderBy: [],
    count: false,
    timeZone: o.timeZone,
    aggregate: { groupBy, measures },
  };
}

/** One amount of a total: the sum for one unit (unit is undefined when the measure has none). */
export interface TotalAmount {
  value: number;
  unit?: string;
}

export interface TotalsEntry {
  /** Value of the group property (undefined for grand totals). */
  group?: unknown;
  /** Text of the group value (Common.Text of the group property), when returned. */
  groupText?: string;
  /** Number of rows of the group (subtotals only). */
  count?: number;
  /** Amounts by measure path, one per unit, largest first. */
  values: Record<string, TotalAmount[]>;
}

const get = (row: Row, path: string): unknown => path.split('/').reduce<unknown>((cur, s) => (cur && typeof cur === 'object' ? (cur as Row)[s] : undefined), row);

/** Key of a group value in `collectTotals` results: '' for the empty group. */
export const groupKey = (v: unknown): string => (v === null || v === undefined ? '' : String(v));

/**
 * Turns the rows of a totals request into one entry per group (key: `groupKey(value)`; '' also for grand totals),
 * merging the rows of the different units.
 */
export function collectTotals(model: MetaModel, o: Pick<TotalsRequestOptions, 'source' | 'measures' | 'groupBy'>, rows: Row[]): Map<string, TotalsEntry> {
  const { typeName } = capsOf(model, o.source);
  const textPath = (() => {
    if (!o.groupBy) return undefined;
    const prop = resolvePath(model.entityTypes, typeName, o.groupBy).property;
    if (!prop?.text) return undefined;
    const i = o.groupBy.lastIndexOf('/');
    return i < 0 ? prop.text : `${o.groupBy.slice(0, i)}/${prop.text}`;
  })();
  const out = new Map<string, TotalsEntry>();
  for (const row of rows) {
    const g = o.groupBy ? get(row, o.groupBy) : undefined;
    const key = groupKey(g);
    let e = out.get(key);
    if (!e) {
      e = { values: {} };
      if (o.groupBy) e.group = g ?? null;
      const text = textPath ? get(row, textPath) : undefined;
      if (text !== undefined && text !== null) e.groupText = String(text);
      out.set(key, e);
    }
    const n = row[TOTAL_COUNT_ALIAS];
    if (n !== undefined && n !== null) e.count = (e.count ?? 0) + Number(n);
    for (const m of o.measures) {
      const raw = row[m.replace(/\//g, '_')];
      if (raw === undefined) continue;
      const unitPath = unitPathOf(model, typeName, m);
      const unitValue = unitPath ? get(row, unitPath) : fixedUnitOf(model, typeName, m);
      const unit = unitValue === undefined || unitValue === null || unitValue === '' ? undefined : String(unitValue);
      const list = (e.values[m] ??= []);
      const same = list.find((a) => a.unit === unit);
      if (same) same.value += Number(raw ?? 0);
      else list.push({ value: Number(raw ?? 0), unit });
    }
  }
  for (const e of out.values()) for (const list of Object.values(e.values)) list.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  return out;
}
