/** Headless filter state: conditions, search, visible fields, "Go", mandatory checks (LR-05–LR-09). */
import { activeFilterPaths, isComplete, isFilterable, type Condition, type FilterState, type Operator } from '@rhfan2019/smart-kit-core';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useMetaModel } from '../context/SmartKitProvider';
import { usePageState } from '../util/usePageState';

export interface AppliedFilter {
  filters: FilterState;
  search: string;
}

export interface FilterSnapshot {
  filters: FilterState;
  search: string;
  fields: string[];
  /** Last executed query; null until "Go" (or auto-execution) happened. */
  applied: AppliedFilter | null;
}

export interface UseFilterStateOptions {
  service?: string;
  /** Key under which the state survives back navigation. */
  pageKey?: string;
  /** Initial state (non-controlled). Defaults to the SelectionVariant annotation. */
  initial?: Partial<Pick<FilterSnapshot, 'filters' | 'search' | 'fields'>>;
  /** Execute on load when no mandatory field is empty (default true). */
  autoExecute?: boolean;
  /** Live update mode: apply changes automatically after a short delay (default false = manual "Go"). */
  liveMode?: boolean;
  /** Delay of the live mode in ms. */
  liveDelay?: number;
}

export interface FilterStateApi extends FilterSnapshot {
  entitySet: string;
  service?: string;
  liveMode: boolean;
  setFilters(next: FilterState): void;
  setConditions(path: string, conditions: Condition[]): void;
  setSearch(search: string): void;
  setFields(fields: string[]): void;
  /** Applies the current filters; returns false when mandatory fields are empty. */
  go(): boolean;
  /** Replaces filters, search and fields (e.g. from a variant); applies them when `apply` is true. */
  load(content: Partial<Pick<FilterSnapshot, 'filters' | 'search' | 'fields'>>, apply: boolean): void;
  /** Filters differ from the applied query (manual mode shows an overlay). */
  dirty: boolean;
  /** Mandatory filter paths without a complete condition. */
  missingRequired: string[];
  /** Number of fields that carry a condition ("Adapt Filters (n)"). */
  activeCount: number;
  /** Set when "Go" was pressed with missing mandatory fields. */
  showRequiredErrors: boolean;
  /** Defaults from the annotations (SelectionVariant, SelectionFields), i.e. the "Standard" variant. */
  defaults: Pick<FilterSnapshot, 'filters' | 'search' | 'fields'>;
}

const sameFilter = (a: AppliedFilter | null, f: FilterState, s: string) => !!a && a.search === s && JSON.stringify(normalize(a.filters)) === JSON.stringify(normalize(f));
function normalize(f: FilterState): FilterState {
  return Object.fromEntries(Object.entries(f).map(([k, cs]) => [k, cs.filter(isComplete)] as const).filter(([, cs]) => cs.length).sort(([a], [b]) => a.localeCompare(b)));
}

export function useFilterState(entitySet: string, o: UseFilterStateOptions = {}): FilterStateApi {
  const meta = useMetaModel(entitySet, { service: o.service });
  const { ui, capabilities, type } = meta;

  const defaults = useMemo<Pick<FilterSnapshot, 'filters' | 'search' | 'fields'>>(() => {
    const filters: FilterState = {};
    for (const c of ui.selectionVariant) {
      if (!type.properties[c.path] && !c.path.includes('/')) continue;
      (filters[c.path] ??= []).push({ operator: c.operator as Operator, values: c.values, exclude: c.exclude || undefined });
    }
    const fields = [...new Set([...ui.selectionFields, ...capabilities.requiredFilters, ...Object.keys(filters)])].filter((p) => isFilterable(capabilities, p));
    return { filters: o.initial?.filters ?? filters, search: o.initial?.search ?? '', fields: o.initial?.fields ?? fields };
  }, [ui, capabilities, type, o.initial]);

  const [state, setState] = usePageState<FilterSnapshot & { showRequiredErrors: boolean }>(o.pageKey ? `${o.pageKey}:filters` : undefined, () => ({ ...defaults, applied: null, showRequiredErrors: false }));

  const missing = useCallback(
    (f: FilterState) => capabilities.requiredFilters.filter((p) => !(f[p] ?? []).some(isComplete)),
    [capabilities.requiredFilters],
  );

  // Auto-execution on first load (LR-15).
  const first = useRef(true);
  useEffect(() => {
    if (!first.current) return;
    first.current = false;
    if (state.applied === null && o.autoExecute !== false && missing(state.filters).length === 0) {
      setState((s) => ({ ...s, applied: { filters: s.filters, search: s.search } }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  const go = useCallback((): boolean => {
    let ok = true;
    setState((s) => {
      if (missing(s.filters).length) {
        ok = false;
        return { ...s, showRequiredErrors: true };
      }
      return { ...s, applied: { filters: s.filters, search: s.search }, showRequiredErrors: false };
    });
    return ok;
  }, [missing, setState]);

  // Live mode: apply after a short delay.
  const live = Boolean(o.liveMode);
  useEffect(() => {
    if (!live) return;
    if (sameFilter(state.applied, state.filters, state.search) || missing(state.filters).length) return;
    const h = setTimeout(() => go(), o.liveDelay ?? 300);
    return () => clearTimeout(h);
  }, [live, state.filters, state.search, state.applied, go, missing, o.liveDelay]);

  const setFilters = useCallback((filters: FilterState) => setState((s) => ({ ...s, filters })), [setState]);
  const setConditions = useCallback(
    (path: string, conditions: Condition[]) =>
      setState((s) => {
        const filters = { ...s.filters };
        if (conditions.length) filters[path] = conditions;
        else delete filters[path];
        return { ...s, filters };
      }),
    [setState],
  );
  const setSearch = useCallback((search: string) => setState((s) => ({ ...s, search })), [setState]);
  const setFields = useCallback((fields: string[]) => setState((s) => ({ ...s, fields })), [setState]);
  const load = useCallback(
    (content: Partial<Pick<FilterSnapshot, 'filters' | 'search' | 'fields'>>, apply: boolean) =>
      setState((s) => {
        const filters = content.filters ?? defaults.filters;
        const search = content.search ?? '';
        const next = { ...s, filters, search, fields: content.fields ?? defaults.fields, showRequiredErrors: false };
        return apply && missing(filters).length === 0 ? { ...next, applied: { filters, search } } : next;
      }),
    [setState, defaults, missing],
  );

  const missingRequired = missing(state.filters);
  return {
    entitySet,
    service: o.service,
    liveMode: live,
    filters: state.filters,
    search: state.search,
    fields: state.fields,
    applied: state.applied,
    setFilters,
    setConditions,
    setSearch,
    setFields,
    go,
    load,
    dirty: state.applied !== null && !sameFilter(state.applied, state.filters, state.search),
    missingRequired,
    activeCount: activeFilterPaths(state.filters).length,
    showRequiredErrors: state.showRequiredErrors && missingRequired.length > 0,
    defaults,
  };
}
