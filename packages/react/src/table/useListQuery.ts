/** Headless list query: builds requests from the model and loads pages (growing). Used by SmartTable's "auto" mode and by custom UIs. */
import {
  buildListRequest, capabilitiesFor, sourceInfo, type FieldModel, type FilterState, type QueryRequest, type QuerySource,
  type Row, type SortItem,
} from '@rhfan2019/smart-kit-core';
import { useInfiniteQuery } from '@tanstack/react-query';
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
  /** Builds a request for an arbitrary page (export, grid blocks). */
  pageRequest(skip: number, top: number, count: boolean): QueryRequest;
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
    buildListRequest(model, ui, { source: o.source, columns, filters: o.filters, search: o.search, sort: o.sort, skip, top, count, extraSelect: o.extraSelect, timeZone });
  const base = pageRequest(0, pageSize, true);
  const key = ['smart-kit', namespace, service.name, locale, 'list', JSON.stringify({ ...base, skip: undefined, top: undefined })];

  const q = useInfiniteQuery({
    queryKey: key,
    enabled: o.enabled !== false,
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => {
      const skip = pageParam as number;
      const top = skip === 0 ? pageSize : growSize;
      return service.dataProvider.query(pageRequest(skip, top, skip === 0), { signal }).then((r) => ({ ...r, skip, top }));
    },
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((n, p) => n + p.rows.length, 0);
      const total = pages[0]?.count;
      if (total !== undefined) return loaded < total ? loaded : undefined;
      return last.rows.length < last.top ? undefined : loaded;
    },
  });

  const rows = useMemo(() => (q.data?.pages ?? []).flatMap((p) => p.rows), [q.data]);
  const count = q.data?.pages[0]?.count ?? (caps.countable ? undefined : q.hasNextPage ? undefined : q.data ? rows.length : undefined);
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
  };
}
