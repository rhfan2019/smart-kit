/** Headless list query: builds requests from the model and loads pages (growing). Used by SmartTable's "auto" mode and by custom UIs. */
import {
  buildHierarchyRequest, buildListRequest, capabilitiesFor, sourceInfo, type FieldModel, type FilterState, type HierarchyRequestOptions,
  type QueryRequest, type QueryResult, type QuerySource, type Row, type SortItem,
} from '@rhfan2019/smart-kit-core';
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useService, useSmartKit } from '../context/SmartKitProvider';

export interface ListQueryOptions {
  service?: string;
  source: QuerySource;
  /** Visible columns (drives $select/$expand); defaults to the LineItem. */
  columns?: FieldModel[];
  filters?: FilterState;
  search?: string;
  sort?: SortItem[];
  /** Rows of the first page. */
  pageSize?: number;
  /** Rows of each following page. */
  growSize?: number;
  /** When false nothing is loaded (e.g. before "Go"). */
  enabled?: boolean;
  extraSelect?: string[];
  /** RequestAtLeast of the table's own presentation variant (a view's PV); default the entity's default presentation. */
  requestAtLeast?: string[];
  /** Tree tables (docs/26 §3.10): one TopLevels request for the visible nodes instead of pages. */
  hierarchy?: Pick<HierarchyRequestOptions, 'qualifier' | 'levels' | 'expandLevels'>;
  /** The request of a page instead of the list request (analytical table, AL-10); undefined: the list request. */
  blockRequest?: (skip: number, top: number) => QueryRequest | undefined;
  /** Called with each page loaded from the service. */
  onBlock?: (skip: number, result: QueryResult) => void;
}

export interface ListQueryResult {
  request: QueryRequest;
  rows: Row[];
  count?: number;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  hasMore: boolean;
  loadMore(): void;
  refresh(): void;
  /** Builds a request for an arbitrary page (export, grid blocks); never hierarchical. */
  pageRequest(skip: number, top: number, count: boolean): QueryRequest;
  /** The result of the first page (an analytical table's grand total). */
  first?: QueryResult;
}

export function useListQuery(o: ListQueryOptions): ListQueryResult {
  const service = useService(o.service);
  const { namespace, locale, timeZone } = useSmartKit();
  const model = service.model;
  const info = useMemo(() => sourceInfo(model, o.source), [model, o.source]);
  const ui = model.ui[info.typeName]!;
  const columns = o.columns ?? ui.lineItem;
  const caps = info.parentSet ? capabilitiesFor(model, info.parentSet, info.navigation) : capabilitiesFor(model, info.entitySet);
  const pageSize = o.pageSize ?? 20;
  const growSize = o.growSize ?? 20;

  const pageRequest = (skip: number, top: number, count: boolean) =>
    buildListRequest(model, ui, { source: o.source, columns, filters: o.filters, search: o.search, sort: o.sort, skip, top, count, extraSelect: o.extraSelect, requestAtLeast: o.requestAtLeast, timeZone });
  const tree = o.hierarchy
    ? buildHierarchyRequest(model, ui, { source: o.source, columns, filters: o.filters, search: o.search, sort: o.sort, extraSelect: o.extraSelect, requestAtLeast: o.requestAtLeast, timeZone, ...o.hierarchy })
    : undefined;
  const block = (skip: number, top: number) => o.blockRequest?.(skip, top) ?? pageRequest(skip, top, skip === 0);
  const base = tree ?? block(0, pageSize);
  const key = ['smart-kit', namespace, service.name, locale, 'list', JSON.stringify({ ...base, skip: undefined, top: undefined })];

  const q = useInfiniteQuery({
    queryKey: key,
    enabled: o.enabled !== false,
    initialPageParam: 0,
    // Expanding or collapsing keeps the previous rows until the next result is in.
    placeholderData: tree ? keepPreviousData : undefined,
    queryFn: ({ pageParam, signal }) => {
      if (tree) return service.dataProvider.query(tree, { signal }).then((r) => ({ ...r, count: undefined, skip: 0, top: r.rows.length }));
      const skip = pageParam as number;
      const top = skip === 0 ? pageSize : growSize;
      return service.dataProvider.query(block(skip, top), { signal }).then((r) => { o.onBlock?.(skip, r); return { ...r, skip, top }; });
    },
    getNextPageParam: (last, pages) => {
      if (tree) return undefined;
      const loaded = pages.reduce((n, p) => n + p.rows.length, 0);
      const total = pages[0]?.count;
      if (total !== undefined) return loaded < total ? loaded : undefined;
      return last.rows.length < last.top ? undefined : loaded;
    },
  });

  const rows = useMemo(() => (q.data?.pages ?? []).flatMap((p) => p.rows), [q.data]);
  const count = tree ? undefined : q.data?.pages[0]?.count ?? (caps.countable ? undefined : q.hasNextPage ? undefined : q.data ? rows.length : undefined);
  return {
    request: base,
    rows,
    count,
    isLoading: q.isLoading,
    isFetching: q.isFetching,
    error: (q.error as Error | null) ?? null,
    hasMore: Boolean(q.hasNextPage),
    loadMore: () => void q.fetchNextPage(),
    refresh: () => void q.refetch(),
    pageRequest,
    first: q.data?.pages[0],
  };
}
