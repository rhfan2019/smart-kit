/** Headless object read (Q-08): header and all form fields in one request. */
import { buildObjectRequest, isAbortError, resolveEntityPath, type EntityUi, type FieldModel, type ResolvedPath, type Row } from '@rhfan2019/smart-kit-core';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useService, useSmartKit } from '../context/SmartKitProvider';

export interface UseObjectOptions {
  service?: string;
  /** Additional fields used by custom content. */
  extraFields?: FieldModel[];
  extraSelect?: string[];
  enabled?: boolean;
}

export interface ObjectResult {
  path: string;
  resolved: ResolvedPath;
  typeName: string;
  entitySet: string;
  ui: EntityUi;
  data: Row | undefined;
  isLoading: boolean;
  error: Error | null;
  refresh(): void;
}

export function useObject(path: string, o: UseObjectOptions = {}): ObjectResult {
  const service = useService(o.service);
  const { namespace, locale } = useSmartKit();
  const resolved = useMemo(() => resolveEntityPath(service.model, path), [service.model, path]);
  const ui = service.model.ui[resolved.typeName]!;
  const req = useMemo(() => buildObjectRequest(service.model, resolved.typeName, ui, o.extraFields, o.extraSelect), [service.model, resolved.typeName, ui, o.extraFields, o.extraSelect]);
  const q = useQuery({
    queryKey: ['smart-kit', namespace, service.name, locale, 'object', resolved.canonical, JSON.stringify(req)],
    queryFn: ({ signal }) => service.dataProvider.read(path, req, { signal }),
    enabled: o.enabled !== false,
  });
  return {
    path,
    resolved,
    typeName: resolved.typeName,
    entitySet: resolved.entitySet,
    ui,
    data: q.data,
    isLoading: q.isLoading,
    error: q.error && !isAbortError(q.error) ? (q.error as Error) : null,
    refresh: () => void q.refetch(),
  };
}

/** Title of an entity from its HeaderInfo (breadcrumbs, page title). */
export function useObjectTitle(path: string, serviceName?: string): { title: string | undefined; typeName: string } {
  const service = useService(serviceName);
  const resolved = useMemo(() => resolveEntityPath(service.model, path), [service.model, path]);
  const ui = service.model.ui[resolved.typeName]!;
  const title = ui.headerInfo.title;
  const { namespace, locale } = useSmartKit();
  const fields = title ? [title] : [];
  const q = useQuery({
    queryKey: ['smart-kit', namespace, service.name, locale, 'title', resolved.canonical],
    queryFn: ({ signal }) => service.dataProvider.read(path, buildObjectRequest(service.model, resolved.typeName, { ...ui, headerFacets: [], sections: [] }), { signal }),
    enabled: fields.length > 0,
    staleTime: 60_000,
  });
  const value = title ? q.data?.[title] : undefined;
  return { title: value === undefined || value === null ? undefined : String(value), typeName: ui.headerInfo.typeName };
}
