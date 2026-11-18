/**
 * Visual grouping of the analytical table as Fiori elements 1.154 does it (sap.ui.mdc.Table groupLevels,
 * `$$aggregation.groupLevels`, sap.ui.model.odata.v4.lib._AggregationCache; FE comparison fe:apply-grouped,
 * fe:macros6-grouped-expand):
 *
 * - the first request reads the number of leaves, the grand total and the groups of the first level with their
 *   subtotals: `$apply=filter(F)/concat(groupby((<leaf groups>))/aggregate($count as UI5__leaves),aggregate(<totals>),
 *   groupby((G),aggregate(<measures>))/concat(aggregate($count as UI5__count),top(n)))`;
 * - the groups start collapsed; a collapsed group shows its subtotals in its header row;
 * - expanding a group reads its leaves as a list request with the group's condition first (`$filter=G eq 'v' and
 *   (F)`, `$count`); an expanded group shows its subtotals in a row at its bottom.
 */
import { buildAnalyticalRequests, collectTotals, groupKey, isAbortError, sourceInfo, type FieldModel, type FilterState, type QueryRequest, type QueryResult, type QuerySource, type Row, type SortItem, type TotalsEntry } from '@rhfan2019/smart-kit-core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useService, useSmartKit } from '../context/SmartKitProvider';

/** Group rows of grouped grid tables: `{ [GROUP_ROW]: GroupRowData }`. */
export const GROUP_ROW = '$smartKitGroup';
export interface GroupRowData {
  key: string;
  display: string;
  /** The group's row of the first request (the group property and its subtotals). */
  first: Row;
  expanded: boolean;
  /** The subtotal row at the bottom of an expanded group. */
  bottom?: boolean;
  /** The number of leaves of the group, once read. */
  count?: number;
}
export const groupOf = (data: unknown): GroupRowData | undefined => (data as Row | undefined)?.[GROUP_ROW] as GroupRowData | undefined;

export interface AnalyticalGroupsOptions {
  enabled: boolean;
  service?: string;
  source: QuerySource;
  /** The group property (the first group level). */
  groupPath: string;
  columns: FieldModel[];
  filters?: FilterState;
  search?: string;
  sort?: SortItem[];
  extraSelect?: string[];
  requestAtLeast?: string[];
  totals: string[];
  groupExtra?: string[];
  aggregationOnLeafLevel?: boolean;
  /** Rows (groups, leaves) per request. */
  pageSize: number;
  /** Text of a group value for its header row. */
  display(row: Row): string;
  /** Changes reload everything (refresh). */
  revision: number;
}

interface Leaves { rows: Row[]; count?: number; loading: boolean; error?: Error }

export function useAnalyticalGroups(o: AnalyticalGroupsOptions) {
  const service = useService(o.service);
  const { timeZone } = useSmartKit();
  const model = service.model;
  const queryClient = useQueryClient();
  const optsKey = JSON.stringify({ s: o.source, g: o.groupPath, c: o.columns.map((c) => c.id), f: o.filters, q: o.search, o: o.sort, e: o.extraSelect, r: o.requestAtLeast, t: o.totals, x: o.groupExtra, l: o.aggregationOnLeafLevel });
  const requests = useMemo(() => {
    if (!o.enabled) return undefined;
    return buildAnalyticalRequests(model, model.ui[sourceInfo(model, o.source).typeName]!, {
      source: o.source, columns: o.columns, filters: o.filters, search: o.search, sort: o.sort, extraSelect: o.extraSelect, requestAtLeast: o.requestAtLeast,
      totals: o.totals, groupExtra: o.groupExtra, groupLevels: [o.groupPath], aggregationOnLeafLevel: o.aggregationOnLeafLevel, timeZone,
    });
  }, [o.enabled, model, optsKey, timeZone]); // eslint-disable-line react-hooks/exhaustive-deps
  const [groupPages, setGroupPages] = useState(1);
  const first = requests ? { ...requests.first, top: o.pageSize * groupPages } : undefined;
  const q = useQuery({
    queryKey: ['smart-kit', 'analytical-groups', service.name, JSON.stringify(first), o.revision],
    queryFn: ({ signal }) => service.dataProvider.query(first!, { signal }),
    enabled: Boolean(first),
    placeholderData: (prev) => prev,
  });
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [leaves, setLeaves] = useState<Record<string, Leaves>>({});
  const reqKey = `${JSON.stringify(requests?.first)}|${o.revision}`;
  // a new request (or a refresh) starts collapsed again
  const lastKey = useRef(reqKey);
  useEffect(() => {
    if (lastKey.current === reqKey) return;
    lastKey.current = reqKey;
    setExpanded(new Set());
    setLeaves({});
    setGroupPages(1);
  }, [reqKey]);
  const groups = q.data?.rows ?? [];
  const subtotals = useMemo(
    () => collectTotals(model, { source: o.source, measures: o.totals, groupBy: o.groupPath }, groups),
    [groups, o.totals.join('|'), o.groupPath], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const grand: TotalsEntry | undefined = q.data?.grandTotal ? collectTotals(model, { source: o.source, measures: o.totals }, [q.data.grandTotal]).get('') ?? { values: {} } : undefined;

  const fetchLeaves = async (row: Row, key: string, skip: number) => {
    if (!requests?.leaves) return;
    setLeaves((l) => ({ ...l, [key]: { rows: l[key]?.rows ?? [], count: l[key]?.count, loading: true } }));
    const req: QueryRequest = requests.leaves(row, skip, o.pageSize);
    try {
      const res: QueryResult = await queryClient.fetchQuery({
        queryKey: ['smart-kit', 'analytical-leaves', service.name, JSON.stringify(req), o.revision],
        queryFn: ({ signal }) => service.dataProvider.query(req, { signal }),
        staleTime: 10_000,
      });
      setLeaves((l) => ({ ...l, [key]: { rows: [...(skip ? l[key]?.rows ?? [] : []), ...res.rows], count: res.count ?? l[key]?.count, loading: false } }));
    } catch (e) {
      if (!isAbortError(e)) setLeaves((l) => ({ ...l, [key]: { rows: l[key]?.rows ?? [], count: l[key]?.count, loading: false, error: e as Error } }));
    }
  };
  const groupPathValue = (row: Row) => row[o.groupPath];
  const toggle = (key: string) => {
    const row = groups.find((g) => groupKey(groupPathValue(g)) === key);
    if (!row) return;
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else {
        next.add(key);
        if (!leaves[key]) void fetchLeaves(row, key, 0);
      }
      return next;
    });
  };

  /** Group header rows, the leaves of expanded groups and their bottom subtotal rows. */
  const rows = useMemo(() => {
    const out: Row[] = [];
    for (const g of groups) {
      const key = groupKey(groupPathValue(g));
      const open = expanded.has(key);
      const l = leaves[key];
      const data: GroupRowData = { key, display: o.display(g), first: g, expanded: open, count: l?.count };
      out.push({ [GROUP_ROW]: data });
      if (!open) continue;
      out.push(...(l?.rows ?? []));
      if (l && !l.loading) out.push({ [GROUP_ROW]: { ...data, bottom: true } satisfies GroupRowData });
    }
    return out;
  }, [groups, expanded, leaves]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Loads the next leaves of an expanded group whose last loaded leaf is near `lastIndex`, else the next groups. */
  const loadMore = (lastIndex: number) => {
    let index = 0;
    for (const g of groups) {
      const key = groupKey(groupPathValue(g));
      index += 1;
      if (!expanded.has(key)) continue;
      const l = leaves[key];
      index += l?.rows.length ?? 0;
      if (l && !l.loading && l.count !== undefined && l.rows.length < l.count && lastIndex >= index - 20 && lastIndex <= index + 20) { void fetchLeaves(g, key, l.rows.length); return; }
      index += l && !l.loading ? 1 : 0;
    }
    const total = q.data?.count;
    if (!q.isFetching && total !== undefined && groups.length < total && lastIndex >= rows.length - 20) setGroupPages((n) => n + 1);
  };

  return {
    active: Boolean(requests),
    rows,
    /** All leaves loaded so far. */
    leaves: rows.filter((r) => !groupOf(r)),
    leafCount: q.data?.leafCount,
    isLoading: q.isLoading,
    isFetching: q.isFetching || Object.values(leaves).some((l) => l.loading),
    error: (q.error as Error | null) ?? Object.values(leaves).find((l) => l.error)?.error ?? null,
    grand: { entry: grand, error: q.error as Error | null, loading: q.isLoading },
    /** The subtotals of a group (by group key). */
    subtotal: (key: string) => subtotals.get(key),
    toggle,
    loadMore,
  };
}
