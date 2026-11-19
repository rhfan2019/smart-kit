/** Headless filter state: conditions, search, visible fields, "Go", mandatory checks (LR-05–LR-09). */
import { activeFilterPaths, filterExpressionRules, isComplete, isFilterable, isRelativeDateOperator, resolvePath, restrictConditions, type Condition, type FilterState, type Operator } from '@rhfan2019/smart-kit-core';
import type { FilterOperatorOptionsOf } from './filterOperators';
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
  /**
   * Operator options per field (FE manifest `useSemanticDateRange`, filter field `settings.operatorConfiguration`): they
   * restrict the operators of the bar's fields and the conditions set.
   */
  operatorOptions?: FilterOperatorOptionsOf;
  /**
   * Default conditions laid over the annotation defaults (FE filter field `settings.defaultValues`, FilterHelper
   * getFilterConditions: the manifest value wins over the selection variant for the same property).
   */
  defaultConditions?: FilterState;
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
  /**
   * Set to false by the list report when its table cannot search (FE hides the basic search of the filter bar then:
   * an AnalyticalTable without `search` in ApplySupported/Transformations).
   */
  searchable?: boolean;
  /** Defaults from the annotations (SelectionVariant, SelectionFields), i.e. the "Standard" variant. */
  defaults: Pick<FilterSnapshot, 'filters' | 'search' | 'fields'>;
  /** The operator options of the fields (`UseFilterStateOptions.operatorOptions`). */
  operatorOptions?: FilterOperatorOptionsOf;
}

const sameFilter = (a: AppliedFilter | null, f: FilterState, s: string) => !!a && a.search === s && JSON.stringify(normalize(a.filters)) === JSON.stringify(normalize(f));
function normalize(f: FilterState): FilterState {
  return Object.fromEntries(Object.entries(f).map(([k, cs]) => [k, cs.filter(isComplete)] as const).filter(([, cs]) => cs.length).sort(([a], [b]) => a.localeCompare(b)));
}

export function useFilterState(entitySet: string, o: UseFilterStateOptions = {}): FilterStateApi {
  const meta = useMetaModel(entitySet, { service: o.service });
  const { ui, capabilities, type } = meta;
  const model = meta.service.model;
  const propOf = useCallback((path: string) => resolvePath(model.entityTypes, type.fullName, path), [model, type]);

  const defaults = useMemo<Pick<FilterSnapshot, 'filters' | 'search' | 'fields'>>(() => {
    const filters: FilterState = {};
    // UI.Hidden properties are no filter properties in FE: their default conditions are dropped; UI.HiddenFilter ones
    // filter but get no field (FE FilterBar converter, availability Hidden).
    const isHidden = (path: string) => propOf(path).property?.hidden === true;
    const isHiddenFilter = (path: string) => propOf(path).property?.hiddenFilter === true;
    for (const c of ui.selectionVariant) {
      if (!type.properties[c.path] && !c.path.includes('/')) continue;
      if (isHidden(c.path)) continue;
      (filters[c.path] ??= []).push({ operator: c.operator as Operator, values: c.values, exclude: c.exclude || undefined });
    }
    // A Common.FilterDefaultValue condition outside SelectionFields filters without adding a field to the bar
    // (FE FilterBar converter `_getDefaultFilterFields`: property info only).
    const fromDefaultValue = (p: string) =>
      !ui.selectionFields.includes(p) && type.properties[p]?.filterDefaultValue !== undefined
      && ui.selectionVariant.every((c) => c.operator === 'EQ' && !c.exclude && c.values[0] === type.properties[c.path]?.filterDefaultValue);
    const conditionFields = Object.keys(filters).filter((p) => !fromDefaultValue(p) && !isHiddenFilter(p));
    // a parameterized entity set (Common.ResultContext): the parameters come first (FE FilterBar getFilterFields)
    const parameters = meta.set.parameters?.properties ?? [];
    const fields = [...new Set([...parameters, ...ui.selectionFields, ...capabilities.requiredFilters, ...conditionFields])].filter((p) => isFilterable(capabilities, p));
    // FE FilterHelper getConditionsOfSupportedOperators: default semantic date conditions whose operator the field does
    // not support are dropped
    const merged: FilterState = { ...(o.initial?.filters ?? filters), ...o.defaultConditions };
    if (o.operatorOptions) {
      for (const [path, conds] of Object.entries(merged)) {
        const options = o.operatorOptions(path);
        if (!options) continue;
        const rules = filterExpressionRules(capabilities.filterExpressions[path], propOf(path).property?.edmType, options);
        const kept = conds.filter((c) => !isRelativeDateOperator(c.operator) || rules.operators.includes(c.operator));
        if (kept.length) merged[path] = kept;
        else delete merged[path];
      }
    }
    return { filters: merged, search: o.initial?.search ?? '', fields: o.initial?.fields ?? fields };
  }, [ui, capabilities, type, o.initial, o.defaultConditions, o.operatorOptions, propOf, meta.set]);

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

  const stateRef = useRef(state);
  stateRef.current = state;
  const go = useCallback((): boolean => {
    const ok = missing(stateRef.current.filters).length === 0;
    setState((s) => (ok ? { ...s, applied: { filters: s.filters, search: s.search }, showRequiredErrors: false } : { ...s, showRequiredErrors: true }));
    return ok;
  }, [missing, setState]);

  // Live mode: apply after a short delay — changes only: the start values are applied by `autoExecute` / `go()`
  // (FE: liveMode does not load a list whose initialLoad is "Disabled").
  const live = Boolean(o.liveMode);
  const start = useRef({ filters: state.filters, search: state.search });
  useEffect(() => {
    if (!live) return;
    if (state.applied === null && sameFilter(start.current, state.filters, state.search)) return;
    if (sameFilter(state.applied, state.filters, state.search) || missing(state.filters).length) return;
    const h = setTimeout(() => go(), o.liveDelay ?? 300);
    return () => clearTimeout(h);
  }, [live, state.filters, state.search, state.applied, go, missing, o.liveDelay]);

  const setFilters = useCallback((filters: FilterState) => setState((s) => ({ ...s, filters })), [setState]);
  const setConditions = useCallback(
    (path: string, input: Condition[]) =>
      setState((s) => {
        const filters = { ...s.filters };
        // Capabilities.FilterExpressionRestrictions (P2-LR-19): only allowed conditions are kept.
        const conditions = restrictConditions(capabilities.filterExpressions[path], input, propOf(path).property?.edmType, o.operatorOptions?.(path));
        if (conditions.length) filters[path] = conditions;
        else delete filters[path];
        return { ...s, filters };
      }),
    [setState, capabilities, propOf, o.operatorOptions],
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
    operatorOptions: o.operatorOptions,
  };
}
