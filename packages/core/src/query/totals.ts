/**
 * Group subtotals and grand totals of a list (docs/23): computed by the service with $apply, never by adding up the
 * loaded rows (lists load page by page). A total over several units or currencies is not added up: the service
 * returns no unit for it and the amounts per unit are requested on demand (D39).
 */
import type { Condition, FilterState } from '../conditions/conditions';
import { restrictConditions } from '../conditions/filterExpressions';
import { capabilitiesFor, isFilterable, isSortable } from '../model/access';
import { resolvePath } from '../model/buildModel';
import type { CapabilityModel, MetaModel } from '../model/types';
import { aggregateMeasure, companionPaths, sourceInfo, type QueryRequest, type QuerySource, type Row } from './request';

/** Alias of the number of rows of a group in a totals result. */
export const TOTAL_COUNT_ALIAS = 'smartkit_count';

/** Maximum number of group values in one subtotal request (URL length). */
export const MAX_GROUP_VALUES = 50;

function capsOf(model: MetaModel, source: QuerySource): { caps: CapabilityModel; typeName: string } {
  const info = sourceInfo(model, source);
  const caps = info.parentSet ? capabilitiesFor(model, info.parentSet, info.navigation) : capabilitiesFor(model, info.entitySet);
  return { caps, typeName: info.typeName };
}

/**
 * Whether totals can be requested for `path`: Aggregation.ApplySupported is declared and `path` is a custom aggregate
 * (Aggregation.CustomAggregate with the property name as qualifier), as in FE: sap.fe.core.converters.helpers.Aggregation
 * isPropertyAggregatable only knows custom aggregates (docs/29 §4 P1-2). Without a custom aggregate nothing is totalled
 * (D39: no "numeric property with sum" fallback). Totals are shown by analytical tables only (D39, `Table` type).
 */
export function canTotal(model: MetaModel, source: QuerySource, path: string): boolean {
  const { caps } = capsOf(model, source);
  const agg = caps.aggregation;
  if (!agg || (agg.transformations.length && !agg.transformations.includes('aggregate'))) return false;
  return Object.hasOwn(agg.customAggregates ?? {}, path);
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
  /** Properties to aggregate (custom aggregates, or summed). */
  measures: string[];
  /** Group property: one result row per group (and unit). Without it: grand totals. */
  groupBy?: string;
  /** Only these groups (values of `groupBy`; null or '' for the empty group), at most MAX_GROUP_VALUES. */
  groupValues?: unknown[];
  /**
   * Details of a total over several units (FE "Show Details", sap.m.table.Util createOrUpdateMultiUnitPopover): one
   * row per unit (`groupby((Currency),aggregate(NetAmount))`, sorted by the unit); `groupBy` / `groupValues` then
   * only restrict the rows (a subtotal's group). Default: the units are aggregated with the measures.
   */
  byUnit?: boolean;
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
 * Builds the $apply request of totals as Fiori elements does (D39, sap.ui.model.odata.v4 $$aggregation with `unit`):
 * `filter(…)/aggregate(NetAmount,Currency)` for grand totals, `filter(…)/groupby((Group,GroupText),aggregate(NetAmount,
 * Currency,$count as smartkit_count))` for subtotals — the custom aggregate by name (`NetAmount with sum as NetAmount`
 * for a measure that is not one) followed by its unit, which the service returns when all rows share it and null
 * otherwise (several currencies: never added up, shown as "Show Details"). With `byUnit` the units are grouped by
 * instead: `groupby((Currency),aggregate(NetAmount))&$orderby=Currency`, the details of such a total.
 */
export function buildTotalsRequest(model: MetaModel, o: TotalsRequestOptions): QueryRequest {
  const { caps, typeName } = capsOf(model, o.source);
  const groupBy: string[] = [];
  const add = (p: string | undefined) => {
    if (p && !groupBy.includes(p)) groupBy.push(p);
  };
  if (o.groupBy && !o.byUnit) {
    add(o.groupBy);
    const prop = resolvePath(model.entityTypes, typeName, o.groupBy).property;
    if (prop) for (const c of companionPaths(prop, o.groupBy)) add(c);
  }
  const units = [...new Set(o.measures.map((m) => unitPathOf(model, typeName, m)).filter((u): u is string => Boolean(u)))];
  if (o.byUnit) for (const u of units) add(u);

  const filters: FilterState = {};
  for (const [path, conds] of Object.entries(o.filters ?? {})) {
    const allowed = isFilterable(caps, path) ? restrictConditions(caps.filterExpressions[path], conds, resolvePath(model.entityTypes, typeName, path).property?.edmType) : [];
    if (allowed.length) filters[path] = allowed;
  }
  let anyOf: FilterState | undefined;
  if (o.groupBy && o.groupValues) {
    const conds: Condition[] = o.groupValues.map((v) =>
      v === null || v === undefined || v === '' ? { operator: 'Empty', values: [] } : { operator: 'EQ', values: [v] },
    );
    anyOf = { [o.groupBy]: conds };
  }
  // custom aggregates by name (`aggregate(NetAmount)`, the service decides how), other measures `with sum`; each
  // followed by its unit (`aggregate(NetAmount,Currency)`) unless the units are grouped by
  const measures: NonNullable<QueryRequest['aggregate']>['measures'] = [];
  for (const m of o.measures) {
    measures.push(aggregateMeasure(model, o.source, m));
    const u = o.byUnit ? undefined : unitPathOf(model, typeName, m);
    if (u && !measures.some((x) => !x.with && x.path === u)) measures.push({ path: u });
  }
  if (o.groupBy && !o.byUnit) measures.push({ path: '', with: 'count', as: TOTAL_COUNT_ALIAS });
  return {
    source: o.source,
    select: [],
    expand: [],
    filters: Object.keys(filters).length ? filters : undefined,
    anyOf,
    search: caps.searchable && o.search?.trim() ? o.search.trim() : undefined,
    orderBy: o.byUnit ? units.map((u) => ({ path: u, descending: false })) : [],
    // the details list of FE reads the first 100 units (sap.m.List in the multi-unit popover)
    top: o.byUnit ? 100 : undefined,
    count: false,
    timeZone: o.timeZone,
    aggregate: { groupBy, measures },
  };
}

/** One amount of a total: the sum for one unit (unit is undefined when the measure has none). */
export interface TotalAmount {
  value: number;
  unit?: string;
  /**
   * The rows have several units (the service returned null for the unit, D39): the value is not meaningful; show
   * "Show Details" and request the amounts per unit (`byUnit`).
   */
  multiUnit?: boolean;
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
export function collectTotals(model: MetaModel, o: Pick<TotalsRequestOptions, 'source' | 'measures' | 'groupBy' | 'byUnit'>, rows: Row[]): Map<string, TotalsEntry> {
  const { typeName } = capsOf(model, o.source);
  const textPath = (() => {
    if (!o.groupBy || o.byUnit) return undefined;
    const prop = resolvePath(model.entityTypes, typeName, o.groupBy).property;
    if (!prop?.text) return undefined;
    const i = o.groupBy.lastIndexOf('/');
    return i < 0 ? prop.text : `${o.groupBy.slice(0, i)}/${prop.text}`;
  })();
  const out = new Map<string, TotalsEntry>();
  for (const row of rows) {
    const g = o.groupBy && !o.byUnit ? get(row, o.groupBy) : undefined;
    const key = groupKey(g);
    let e = out.get(key);
    if (!e) {
      e = { values: {} };
      if (o.groupBy && !o.byUnit) e.group = g ?? null;
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
      // aggregated unit null: the rows have several units (sap.ui.model.odata.v4 "unit" of an aggregate)
      const multiUnit = Boolean(unitPath && !o.byUnit && unitValue === null);
      const list = (e.values[m] ??= []);
      const same = list.find((a) => a.unit === unit && Boolean(a.multiUnit) === multiUnit);
      if (same) same.value += Number(raw ?? 0);
      else list.push(multiUnit ? { value: Number(raw ?? 0), multiUnit } : { value: Number(raw ?? 0), unit });
    }
  }
  // per unit (details): in the order of the service (sorted by the unit, as FE); otherwise largest first
  if (!o.byUnit) for (const e of out.values()) for (const list of Object.values(e.values)) list.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  return out;
}
