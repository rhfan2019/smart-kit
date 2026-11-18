/**
 * Requests of the analytical table as Fiori elements 1.154 sends them (AL-10; sap.ui.mdc.odata.v4.TableDelegate
 * create$$Aggregation, sap.ui.model.odata.v4.lib._AggregationHelper buildApply, _ConcatHelper, _AggregationCache).
 *
 * The table binds with `$$aggregation`: the key properties, the visible groupable properties (with their local text
 * as `additionally`, their unit and the other properties they need, e.g. the criticality) form the leaf level `group`;
 * the visible custom aggregates are `aggregate` (with their unit), those with a total also `grandTotal`. The key
 * properties make every leaf one entity (`$leafLevelAggregated` false). Then:
 *
 * - the first page reads the grand total, the number of leaves and the first leaves in one request:
 *   `$apply=filter(F)/search(S)/concat(aggregate(NetAmount,Currency),groupby((ID,Status,…),
 *   aggregate(NetAmount,Currency))/orderby(O)/concat(aggregate($count as UI5__count),top(n)))` — no other option;
 * - the following pages are plain list requests (identity: `$select` of everything shown, `$expand`, `$filter`,
 *   `$search`, `$orderby`, `$skip`, `$top`, no `$count`);
 * - the properties the first page does not deliver (not groupable, not aggregatable, texts over navigations) are
 *   requested per row: `Orders('…')?$select=…&$expand=…` (the late properties of the OData V4 model).
 *
 * `$orderby` keeps only grouped and aggregated properties and units (_AggregationHelper getFilteredOrderby): sorting by
 * a property the request does not group by would fail on the service.
 */
import { capabilitiesFor } from '../model/access';
import { resolvePath } from '../model/buildModel';
import type { EntityUi, FieldModel, MetaModel } from '../model/types';
import { aggregateMeasure, ANALYTICAL_LEAVES_ALIAS, buildListRequest, fieldPaths, sourceInfo, type AggregateMeasure, type ListRequestOptions, type QueryRequest, type ReadRequest, type Row } from './request';
import { canTotal, unitPathOf } from './totals';

/** Alias of the number of leaves in the first page of an analytical table (sap.ui.model.odata.v4 "UI5__count"). */
export const ANALYTICAL_COUNT_ALIAS = 'UI5__count';
export { ANALYTICAL_LEAVES_ALIAS };

export interface AnalyticalRequestOptions extends Omit<ListRequestOptions, 'skip' | 'count'> {
  /** Measures (custom aggregates) with a grand total: the columns whose totals are shown. */
  totals?: string[];
  /** Further properties the visible content needs from the leaves (custom columns' `properties`): grouped by. */
  groupExtra?: string[];
  /**
   * Visual grouping (sap.ui.mdc.Table groupLevels, `$$aggregation.groupLevels`): the first page reads the number of
   * leaves, the grand total and the groups of the first level (collapsed); `leaves` reads the rows of a group.
   */
  groupLevels?: string[];
  /**
   * sap.fe.macros.table.AnalyticalConfiguration aggregationOnLeafLevel: the leaves are aggregated by the shown
   * groupable properties, without the keys (`$leafLevelAggregated`).
   */
  aggregationOnLeafLevel?: boolean;
}

/** The analytical part of the first page request (`QueryRequest.analytical`). */
export interface AnalyticalApply {
  /** Leaf level: sorted group properties, followed by the `additionally` properties (local texts). */
  groupBy: string[];
  /** Aggregates of the leaves (custom aggregates by name), each followed by its unit unless it is grouped by. */
  measures: AggregateMeasure[];
  /** Grand total (`concat(aggregate(…),…)` first); empty: none. */
  grandTotal: AggregateMeasure[];
  /** Visual grouping: the groups of the first level (`groupBy`) with their subtotals (`measures`) instead of the leaves. */
  groupLevel?: { groupBy: string[]; measures: AggregateMeasure[] };
}

export interface AnalyticalRequests {
  /** First page: grand total, number of leaves (`count`) and the first `top` leaves in one `$apply`. */
  first: QueryRequest;
  /** A following page: a plain list request without `$count`. */
  page(skip: number, top: number): QueryRequest;
  /** What each row of the first page still needs (late properties); undefined when the first page has everything. */
  late?: ReadRequest;
  /**
   * Visual grouping: the leaves of the group `group` (a row of the first page) from `skip`: a list request with the
   * group's conditions first (`$filter=G eq 'v' and (…)`) and `$count` (_AggregationCache, the last level); `$orderby`
   * keeps what the leaf level groups or aggregates, as the first page (getFilteredOrderby).
   */
  leaves?(group: Row, skip: number, top: number): QueryRequest;
}

const prefixed = (path: string, rel: string) => {
  const i = path.lastIndexOf('/');
  return i < 0 ? rel : `${path.slice(0, i)}/${rel}`;
};

/** Builds the requests of an analytical table (see the module comment). */
export function buildAnalyticalRequests(model: MetaModel, ui: EntityUi, o: AnalyticalRequestOptions): AnalyticalRequests {
  const info = sourceInfo(model, o.source);
  const caps = info.parentSet ? capabilitiesFor(model, info.parentSet, info.navigation) : capabilitiesFor(model, info.entitySet);
  const type = model.entityTypes[info.typeName]!;
  const groupable = (p: string) => !p.includes('/') && Boolean(caps.aggregation) && (!caps.aggregation!.groupable.length || caps.aggregation!.groupable.includes(p));
  const plain = (p: string) => !p.includes('/') && Boolean(type.properties[p]);

  // $$aggregation (sap.ui.mdc.odata.v4.TableDelegate create$$Aggregation)
  const group = new Map<string, string[]>(); // property -> additionally
  const aggregate = new Map<string, string | undefined>(); // measure -> unit
  if (!o.aggregationOnLeafLevel) for (const k of type.keys) group.set(k, []);
  for (const p of o.groupExtra ?? []) if (plain(p) && !group.has(p)) group.set(p, []);
  const fieldOf = (f: FieldModel) => (f.kind === 'field' ? f.path : undefined);
  for (const f of o.columns) {
    const path = fieldOf(f);
    if (!path) continue;
    // the other paths of the column (criticality, …), not its text or unit: technical properties, grouped
    const prop = resolvePath(model.entityTypes, info.typeName, path).property;
    const text = prop?.text ? prefixed(path, prop.text) : undefined;
    const unit = unitPathOf(model, info.typeName, path);
    const extra = fieldPaths(model, info.typeName, f, { cell: true }).filter((p) => p !== path && p !== text && p !== unit && plain(p));
    if (canTotal(model, o.source, path)) {
      aggregate.set(path, unit);
      for (const p of extra) if (!group.has(p)) group.set(p, []);
    } else if (groupable(path)) {
      if (!group.has(path)) group.set(path, []);
      // a local text goes along with its property (`additionally`); a text over a navigation is a late property
      if (text && plain(text)) group.set(path, [...new Set([...group.get(path)!, text])]);
      if (unit && plain(unit) && !group.has(unit)) group.set(unit, []);
      for (const p of extra) if (!group.has(p)) group.set(p, []);
    }
  }
  // a property is either grouped or aggregated; an additionally property is not a group of its own
  for (const m of aggregate.keys()) group.delete(m);
  const additionally = new Set([...group.values()].flat());
  for (const a of additionally) group.delete(a);
  const groups = [...group.keys()].sort();
  const groupBy = [...groups];
  for (const g of groups) for (const a of group.get(g)!) if (!groupBy.includes(a)) groupBy.push(a);

  // aggregates: sorted aliases, each followed by its unit unless grouped by (_AggregationHelper aggregate)
  const aliases = [...aggregate.keys()].sort();
  const measuresOf = (list: string[], grouped: string[]) => {
    const out: AggregateMeasure[] = [];
    list.forEach((m, i) => {
      out.push(aggregateMeasure(model, o.source, m));
      const u = aggregate.get(m);
      if (u && !out.some((x) => !x.with && x.path === u) && !list.includes(u, i + 1) && !grouped.includes(u)) out.push({ path: u });
    });
    return out;
  };
  const totals = new Set(o.totals ?? []);
  const analytical: AnalyticalApply = {
    groupBy,
    measures: measuresOf(aliases, groupBy),
    grandTotal: measuresOf(aliases.filter((m) => totals.has(m)), []),
  };

  // $orderby: only what the request groups or aggregates (getFilteredOrderby)
  const kept = new Set([...groupBy, ...aliases, ...[...aggregate.values()].filter((u): u is string => Boolean(u))]);
  const base = buildListRequest(model, ui, { ...o, skip: 0, count: false });
  const orderBy = base.orderBy.filter((s) => kept.has(s.path));
  const levels = (o.groupLevels ?? []).filter((p) => !aggregate.has(p));
  if (levels.length) {
    // the first level: its property (and the local text as additionally), the visible aggregates with their units
    const level = levels.slice(0, 1);
    const text = group.get(level[0]!)?.filter((x) => !level.includes(x)) ?? [];
    const levelBy = [...level, ...text];
    analytical.groupLevel = { groupBy: levelBy, measures: measuresOf(aliases, levelBy) };
    const levelKept = new Set([...levelBy, ...aliases]);
    const first: QueryRequest = { ...base, select: [], expand: [], orderBy: base.orderBy.filter((s) => levelKept.has(s.path)), skip: 0, count: caps.countable, analytical };
    const levelFilter = (row: Row) => Object.fromEntries(level.map((p) => [p, [{ operator: 'EQ' as const, values: [row[p] ?? null] }]]));
    const leafRequest = (row: Row, skip: number, top: number): QueryRequest => (o.aggregationOnLeafLevel
      // aggregated leaves: the leaf level of $$aggregation under the group's condition
      ? { ...base, select: [], expand: [], orderBy, skip, top, count: caps.countable, analytical: { groupBy, measures: analytical.measures, grandTotal: [] }, levelFilter: levelFilter(row) }
      : { ...buildListRequest(model, ui, { ...o, skip, top, count: caps.countable }), orderBy, levelFilter: levelFilter(row) });
    return { first, page: (skip, top) => ({ ...first, skip, top, count: false }), leaves: leafRequest };
  }
  const first: QueryRequest = { ...base, select: [], expand: [], orderBy, skip: 0, count: caps.countable, analytical };
  // aggregated leaves are no entities: the following pages read the same aggregation (without the grand total)
  const page = (skip: number, top: number): QueryRequest => (o.aggregationOnLeafLevel
    ? { ...first, skip, top, count: false, analytical: { ...analytical, grandTotal: [] } }
    : { ...buildListRequest(model, ui, { ...o, skip, top, count: false }), orderBy });
  if (o.aggregationOnLeafLevel) return { first, page };

  // late properties: the list's $select without what the first page delivers, and its $expand
  const delivered = new Set([...groupBy, ...analytical.measures.map((m) => m.path)]);
  const late: ReadRequest = { select: base.select.filter((p) => !delivered.has(p)), expand: base.expand };
  return { first, page, late: late.select.length || late.expand.length ? late : undefined };
}
