/** Loads value list entries (typeahead, fixed values, value help dialog). */
import { buildValueHelpRequest, type FilterState, type QueryResult, type ValueListModel } from '@rhfan2019/smart-kit-core';
import { useQuery } from '@tanstack/react-query';
import { useService, useSmartKit } from '../context/SmartKitProvider';

export interface ValueListQuery {
  search?: string;
  top?: number;
  skip?: number;
  enabled?: boolean;
  /**
   * Conditions of the source by local property path (usually the filter bar's); the In and InOut parameters of the
   * value list filter by them, Constant parameters always filter (docs/29 §4 P1-5).
   */
  filters?: FilterState;
  /** `dialog` for the value help dialog's table (FE's $select, sort and page of the dialog), default type-ahead / fixed values. */
  purpose?: 'dialog' | 'suggest';
}

export function useValueList(valueList: ValueListModel | undefined, q: ValueListQuery = {}, serviceName?: string) {
  const service = useService(serviceName);
  const { namespace, locale } = useSmartKit();
  const request = valueList ? buildValueHelpRequest(service.model, valueList, { search: q.search, top: q.top, skip: q.skip, filters: q.filters, purpose: q.purpose }) : undefined;
  return useQuery<QueryResult>({
    queryKey: ['smart-kit', namespace, service.name, locale, 'valueList', valueList?.collectionPath, valueList?.qualifier ?? '', q.purpose ?? 'suggest', q.search ?? '', q.skip ?? 0, q.top ?? 50, JSON.stringify(request?.filters ?? null)],
    enabled: Boolean(valueList) && q.enabled !== false,
    queryFn: ({ signal }) => service.dataProvider.query(request!, { signal }),
    staleTime: 60_000,
  });
}
