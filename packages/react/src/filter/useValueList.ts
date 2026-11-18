/** Loads value list entries (typeahead, fixed values, value help dialog). */
import {
  buildValueHelpRequest, getProperty, referencedValueLists, type DataProvider, type FilterState, type MetaModel, type PropertyModel, type QueryResult, type ValueListModel,
  type ValueListService,
} from '@rhfan2019/smart-kit-core';
import { useQueries, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
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

/** Where a value list's data and metadata live: the data service, or the value help service of a Common.ValueListReferences entry. */
export interface ValueListSource {
  /** Query key part of the service. */
  key: string;
  model: MetaModel;
  dataProvider: DataProvider;
}

/** Query of a value help service (Common.ValueListReferences): loaded once per reference and service (SAPUI5 shared models). */
function serviceQuery(namespace: string, serviceName: string, locale: string, provider: DataProvider, reference: string, enabled: boolean) {
  return {
    queryKey: ['smart-kit', namespace, serviceName, locale, 'valueListService', reference],
    enabled: enabled && Boolean(provider.valueListService),
    queryFn: ({ signal }: { signal: AbortSignal }) => provider.valueListService!(reference, { signal }),
    staleTime: Infinity,
    gcTime: Infinity,
  };
}

/**
 * The service a value list reads from: the data service, or — for a value list of Common.ValueListReferences
 * (`valueList.reference`) — the loaded value help service. Undefined while that service is loading.
 */
export function useValueListSource(valueList: ValueListModel | undefined, serviceName?: string): ValueListSource | undefined {
  const service = useService(serviceName);
  const { namespace, locale } = useSmartKit();
  const reference = valueList?.reference;
  const loaded = useQuery<ValueListService>(serviceQuery(namespace, service.name, locale, service.dataProvider, reference ?? '', Boolean(reference)));
  return useMemo(() => {
    if (!reference) return { key: service.name, model: service.model, dataProvider: service.dataProvider };
    const vh = loaded.data;
    return vh ? { key: `${service.name}|${vh.metadataUrl}`, model: vh.model, dataProvider: vh.provider } : undefined;
  }, [reference, service, loaded.data]);
}

export interface ResolvedValueLists {
  property?: PropertyModel;
  /** The first value list (the default one first). */
  valueList?: ValueListModel;
  /** All value lists (local Common.ValueList and the mappings of Common.ValueListReferences). */
  valueLists: ValueListModel[];
  /** The property has a value help (local value lists or references), known without loading anything. */
  hasValueHelp: boolean;
  /** Common.ValueListWithFixedValues. */
  fixedValues: boolean;
  /** Value help services of the references are still loading. */
  loading: boolean;
}

/**
 * The value lists of a property: its Common.ValueList annotations and, when it has Common.ValueListReferences, the
 * Common.ValueListMapping annotations of the referenced value help services, loaded on demand (`enabled`), as SAPUI5
 * `requestValueListInfo` does when the value help is used.
 */
export function useValueLists(entitySet: string, path: string, serviceName?: string, enabled = true): ResolvedValueLists {
  const service = useService(serviceName);
  const { namespace, locale } = useSmartKit();
  const typeName = service.model.entitySets[entitySet]?.typeName ?? '';
  const property = getProperty(service.model, typeName, path);
  const references = property?.valueListReferences ?? [];
  const results = useQueries({ queries: references.map((r) => serviceQuery(namespace, service.name, locale, service.dataProvider, r, enabled)) });
  const loadedServices = results.map((r) => r.data).filter((d): d is ValueListService => Boolean(d));
  const loadedKey = loadedServices.map((s) => s.metadataUrl).join('|');
  const valueLists = useMemo(
    () => (references.length ? referencedValueLists(service.model, typeName, path, loadedServices) : property?.valueLists ?? (property?.valueList ? [property.valueList] : [])),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadedKey stands for the loaded services
    [service.model, typeName, path, loadedKey, property],
  );
  return {
    property,
    valueList: valueLists[0],
    valueLists,
    hasValueHelp: Boolean(property?.valueList) || references.length > 0,
    fixedValues: property?.valueListFixedValues ?? property?.valueList?.fixedValues ?? false,
    loading: results.some((r) => r.isLoading),
  };
}

export function useValueList(valueList: ValueListModel | undefined, q: ValueListQuery = {}, serviceName?: string) {
  const service = useService(serviceName);
  const { namespace, locale } = useSmartKit();
  const source = useValueListSource(valueList, serviceName);
  const request = valueList && source ? buildValueHelpRequest(source.model, valueList, { search: q.search, top: q.top, skip: q.skip, filters: q.filters, purpose: q.purpose }) : undefined;
  return useQuery<QueryResult>({
    queryKey: ['smart-kit', namespace, source?.key ?? service.name, locale, 'valueList', valueList?.collectionPath, valueList?.qualifier ?? '', q.purpose ?? 'suggest', q.search ?? '', q.skip ?? 0, q.top ?? 50, JSON.stringify(request?.filters ?? null)],
    enabled: Boolean(valueList && source) && q.enabled !== false,
    queryFn: ({ signal }) => source!.dataProvider.query(request!, { signal }),
    staleTime: 60_000,
  });
}
