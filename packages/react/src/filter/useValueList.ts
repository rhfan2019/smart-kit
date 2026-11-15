/** Loads value list entries (typeahead, fixed values, value help dialog). */
import { buildValueHelpRequest, type QueryResult, type ValueListModel } from '@rhfan2019/smart-kit-core';
import { useQuery } from '@tanstack/react-query';
import { useService, useSmartKit } from '../context/SmartKitProvider';

export interface ValueListQuery {
  search?: string;
  top?: number;
  skip?: number;
  enabled?: boolean;
}

export function useValueList(valueList: ValueListModel | undefined, q: ValueListQuery = {}, serviceName?: string) {
  const service = useService(serviceName);
  const { namespace, locale } = useSmartKit();
  return useQuery<QueryResult>({
    queryKey: ['smart-kit', namespace, service.name, locale, 'valueList', valueList?.collectionPath, q.search ?? '', q.skip ?? 0, q.top ?? 50],
    enabled: Boolean(valueList) && q.enabled !== false,
    queryFn: ({ signal }) => service.dataProvider.query(buildValueHelpRequest(service.model, valueList!, { search: q.search, top: q.top, skip: q.skip }), { signal }),
    staleTime: 60_000,
  });
}
