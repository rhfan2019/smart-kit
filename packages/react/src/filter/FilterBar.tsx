/**
 * sap.fe.macros.FilterBar: search, filter fields from UI.SelectionFields, "Go", "Clear", "Adapt Filters (n)"
 * (LR-05–LR-11, docs/26b).
 */
import { Button, Group, TextInput } from '@mantine/core';
import { activeFilterPaths, isComplete, type Condition, type FilterState, type Operator } from '@rhfan2019/smart-kit-core';
import { Search } from 'lucide-react';
import { createContext, useContext, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode, type Ref } from 'react';
import { useMetaModel, useText } from '../context/SmartKitProvider';
import { MessageBox } from '../messages/MessageBox';
import { applyExtensions, type ExtendEntry } from '../util/extend';
import { AdaptFiltersDialog } from './AdaptFiltersDialog';
import { ConditionInput, useFieldLabel } from './ConditionInput';
import { filterSummaryText } from './FilterSummary';
import { fromSelectionVariant, toSelectionVariant, type SelectionVariant } from './selectionVariant';
import { useFilterState, type FilterStateApi } from './useFilterState';
import { ValueHelpDialog } from './ValueHelpDialog';

export type { SelectionVariant, SelectionVariantRange } from './selectionVariant';

/** Context of a custom filter field's editor (the `template` of a FilterField, or the `render` of an `extend` item). */
export interface FilterFieldTemplateContext {
  conditions: Condition[];
  onChange(c: Condition[]): void;
  label: string;
  id: string;
  required?: boolean;
  disabled?: boolean;
}

/** A filter field of the `extend` extension point (kit-extension): ids are property paths or custom keys. */
export interface FilterFieldItem {
  id: string;
  label: string;
  /** Custom editor; when omitted the default ConditionInput is used. */
  render?(ctx: FilterFieldTemplateContext): ReactNode;
}

/** Settings of one entry of the `filterFields` aggregation (sap.fe.macros.filterBar.FilterField). */
export interface $FilterFieldSettings {
  /** The property name of the FilterField; its conditions are stored under this key. */
  key: string;
  /** The text that will be displayed for this FilterField. */
  label?: string;
  /**
   * Defines which property are influenced by the FilterField. Without a `template` smart-kit shows the default
   * condition input for this property (default: `key`).
   */
  property?: string;
  /** Reference to the key of another filter to place this one. */
  anchor?: string;
  /** Where the field is placed relative to `anchor` (default: after the last field). */
  placement?: 'Before' | 'After';
  /** If set, the FilterField is marked as a mandatory field. */
  required?: boolean;
  /** `Default` (shown), `Adaptation` (only offered in "Adapt Filters") or `Hidden`. */
  availability?: 'Default' | 'Adaptation' | 'Hidden';
  /** The editor of the field (FE: the `template` aggregation). */
  template?(ctx: FilterFieldTemplateContext): ReactNode;
}

/** Result of `getFilters()`: the current conditions (smart-kit has no sap.ui.model.Filter) and the search text. */
export interface FilterBarFilters {
  filters: FilterState;
  search?: string;
}

/** Instance methods (ref) of `FilterBar` (sap.fe.macros.FilterBar). */
export interface FilterBar {
  /** Active filters summary as text. */
  getActiveFiltersText(): string;
  /** Whether the field is enabled. */
  getFilterFieldEnabled(name: string): boolean;
  /** Whether a filter field is visible in the filter bar. */
  getFilterFieldVisible(conditionPath: string): Promise<boolean>;
  /** All current conditions together with the search expression. */
  getFilters(): FilterBarFilters;
  /** The filter values as a SelectionVariant (JSON form); the search text is `$search`. */
  getSelectionVariant(): Promise<SelectionVariant>;
  /** Enables or disables a field. */
  setFilterFieldEnabled(name: string, enabled: boolean): void;
  /** `active: false` hides fields from the filter bar and from "Adapt Filters". */
  setFilterFieldsActive(activeChanges: { conditionPath: string; active: boolean }[]): Promise<void>;
  /** Label overrides. */
  setFilterFieldsLabel(labelChanges: { conditionPath: string; label: string }[]): Promise<void>;
  /** Tooltip overrides. */
  setFilterFieldsTooltip(tooltipChanges: { conditionPath: string; tooltip: string }[]): Promise<void>;
  /** Shows or hides a field in the filter bar; it stays in "Adapt Filters". */
  setFilterFieldVisible(conditionPath: string, visible: boolean): Promise<void>;
  /** Sets the values of a field: one condition per value (`BT`/`NB`: one range); operator default `EQ`. */
  setFilterValues(sConditionPath: string, sOperator: string | undefined, vValues?: boolean | boolean[] | number | number[] | string | string[]): Promise<void>;
  /** Clears the conditions and applies the SelectionVariant (the search text is not set, as in FE). */
  setSelectionVariant(selectionVariant: SelectionVariant, prefillDescriptions?: boolean): Promise<void>;
  /** Triggers the search; rejects when mandatory fields are empty. */
  triggerSearch(): Promise<object | undefined>;
}

export interface $FilterBarSettings {
  /** Entity set path, e.g. `/Items`; used when no `state` is given (and then required). */
  contextPath?: string;
  /**
   * Annotation path of the selection fields, e.g. `@com.sap.vocabularies.UI.v1.SelectionFields` (alias `@UI.SelectionFields`).
   * Stage 2 reads the unqualified SelectionFields; qualified paths follow with the annotation work (docs/31 stage 3).
   */
  metaPath?: string;
  /**
   * If true, the search is triggered automatically when a filter value is changed (no "Go" button). With a `state` of
   * `useFilterState({ liveMode: true })` the bar is in live mode as well.
   * @defaultValue false
   */
  liveMode?: boolean;
  /**
   * Shows the "Clear" button.
   * @defaultValue false
   */
  showClearButton?: boolean;
  /**
   * Shows errors of the search (empty mandatory fields) in a message box. The list report template sets it to false.
   * @defaultValue true
   */
  showMessages?: boolean;
  /**
   * When true, changes of "Adapt Filters" stay in this filter bar instance and are not written to `state` (so they are
   * neither saved in views nor restored on back navigation).
   * @defaultValue false
   */
  ignorePersonalizationChanges?: boolean;
  /**
   * Single-valued navigation properties whose properties are offered in "Adapt Filters" (paths `Nav/Property`).
   * @defaultValue []
   */
  navigationPropertiesForPersonalization?: string[];
  /** Custom filter fields (sap.fe.macros.filterBar.FilterField). */
  filterFields?: $FilterFieldSettings[];
  /** Fired after a filter value or the visibility of a filter field changed. */
  onFilterChanged?(): void;
  /** Fired when the search was executed ("Go", Enter in the search field, live mode, `triggerSearch`). */
  onSearch?(): void;
  /** Fired after the "Clear" button was pressed. */
  onAfterClear?(): void;
  /** Filter state from `useFilterState` (controlled); without it the bar keeps its own state for `contextPath`. */
  state?: FilterStateApi;
  /** Name of the service in `SmartKitProvider` `services` (own state only). */
  service?: string;
  /** Insert, replace or remove fields by id (property path); custom fields store their conditions under their id. */
  extend?: ExtendEntry<FilterFieldItem>[];
  /** Extra buttons before "Go". */
  actions?: ReactNode;
  /** Replace the default parts: write <FilterBar.Search/>, <FilterBar.Fields/>, <FilterBar.Actions/>. */
  children?: ReactNode;
  /** Extra CSS class on the root element. */
  className?: string;
  ref?: Ref<FilterBar>;
}

interface Field extends FilterFieldItem {
  required?: boolean;
  property?: string;
}

interface BarCtx {
  p: $FilterBarSettings & { state: FilterStateApi };
  fields: Field[];
  live: boolean;
  disabled: Set<string>;
  tooltips: Record<string, string>;
  missingCustom: string[];
  showErrors: boolean;
  search(): boolean;
  clear(): void;
  openVh(path: string): void;
  openAdapt(): void;
}

const Ctx = createContext<BarCtx | null>(null);
function useBar() {
  const c = useContext(Ctx);
  if (!c) throw new Error('FilterBar parts must be used inside <FilterBar>');
  return c;
}

/** Context for custom content inside the filter bar. */
export function useFilterBarContext(): FilterStateApi {
  return useBar().p.state;
}

const SELECTION_FIELDS = /^@(com\.sap\.vocabularies\.UI\.v1|UI)\.SelectionFields(#.*)?$/;

function SearchPart() {
  const { p, search } = useBar();
  const t = useText();
  const { capabilities } = useMetaModel(p.state.entitySet, { service: p.state.service });
  if (!capabilities.searchable) return null;
  return (
    <div className="sk-filterbar__search" data-sk-filter="$search">
    <TextInput
      aria-label={t('filterBar.search')}
      placeholder={t('filterBar.search')}
      value={p.state.search}
      rightSection={<Search className="sk-icon" aria-hidden />}
      rightSectionPointerEvents="none"
      onChange={(e) => p.state.setSearch(e.currentTarget.value)}
      onKeyDown={(e) => { if (e.key === 'Enter') search(); }}
    />
    </div>
  );
}

function FieldsPart() {
  const { p, fields, openVh, disabled, tooltips, missingCustom, showErrors } = useBar();
  const t = useText();
  const { capabilities } = useMetaModel(p.state.entitySet, { service: p.state.service });
  return (
    <>
      {fields.map((f) => {
        const conditions = p.state.filters[f.id] ?? [];
        const onChange = (c: Condition[]) => p.state.setConditions(f.id, c);
        const required = f.required ?? capabilities.requiredFilters.includes(f.id);
        const missing = (p.state.showRequiredErrors && p.state.missingRequired.includes(f.id)) || (showErrors && missingCustom.includes(f.id));
        const error = required && missing ? t('filterBar.required') : undefined;
        const id = `sk-filter-${p.state.entitySet}-${f.id.replace(/\W/g, '_')}`;
        const off = disabled.has(f.id);
        return (
          <div key={f.id} className="sk-filterbar__field" data-sk-filter={f.id} title={tooltips[f.id]}>
            {f.render ? (
              f.render({ conditions, onChange, label: f.label, id, required, disabled: off })
            ) : (
              <ConditionInput entitySet={p.state.entitySet} service={p.state.service} path={f.property ?? f.id} conditions={conditions} onChange={onChange} label={f.label} required={required} error={error} id={id} disabled={off} title={tooltips[f.id]} onValueHelp={() => openVh(f.id)} />
            )}
          </div>
        );
      })}
    </>
  );
}

function ActionsPart({ children }: { children?: ReactNode }) {
  const { p, live, search, clear, openAdapt } = useBar();
  const t = useText();
  const n = p.state.activeCount;
  return (
    <Group gap="xs" className="sk-filterbar__actions" wrap="nowrap">
      {children ?? p.actions}
      {!live ? <Button onClick={() => search()} data-sk-go>{t('filterBar.go')}</Button> : null}
      {p.showClearButton ? <Button variant="subtle" onClick={clear} data-sk-clear>{t('common.clear')}</Button> : null}
      <Button variant="subtle" onClick={openAdapt}>{t('filterBar.adaptFilters', { count: n })}</Button>
    </Group>
  );
}

function OwnStateFilterBar(p: $FilterBarSettings) {
  const entitySet = (p.contextPath ?? '').replace(/^\//, '').split('/')[0]!;
  const state = useFilterState(entitySet, { service: p.service, liveMode: p.liveMode });
  return <FilterBarWithState {...p} state={state} />;
}

/** sap.fe.macros.FilterBar (docs/26b). Without `state` it keeps its own filter state for `contextPath`. */
export function FilterBar(p: $FilterBarSettings) {
  if (p.state) return <FilterBarWithState {...p} state={p.state} />;
  if (!p.contextPath) throw new Error('FilterBar needs a contextPath (e.g. "/Items") or a state from useFilterState');
  return <OwnStateFilterBar {...p} />;
}

FilterBar.Search = SearchPart;
FilterBar.Fields = FieldsPart;
FilterBar.Actions = ActionsPart;

function toConditions(operator: string | undefined, values: unknown): Condition[] {
  const op = (operator ?? 'EQ') as Operator;
  if (values === undefined) return operator ? [{ operator: op, values: [] }] : [];
  const list = Array.isArray(values) ? values : [values];
  if (op === 'BT' || op === 'NB') return [{ operator: op, values: list.slice(0, 2) }];
  return list.map((v) => ({ operator: op, values: [v] }));
}

function FilterBarWithState(p: $FilterBarSettings & { state: FilterStateApi }) {
  const t = useText();
  const s = p.state;
  const label = useFieldLabel(s.entitySet, s.service);
  const [vhPath, setVhPath] = useState<string | null>(null);
  const [adapt, setAdapt] = useState(false);
  const [disabled, setDisabled] = useState<Set<string>>(() => new Set());
  const [inactive, setInactive] = useState<Set<string>>(() => new Set());
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [tooltips, setTooltips] = useState<Record<string, string>>({});
  const [showErrors, setShowErrors] = useState(false);
  // custom filter fields shown in the bar (availability Default, or added in "Adapt Filters")
  const [customShown, setCustomShown] = useState<Set<string>>(() => new Set((p.filterFields ?? []).filter((f) => (f.availability ?? 'Default') === 'Default').map((f) => f.key)));
  // ignorePersonalizationChanges: field selection kept in this instance; reset when the state's fields change
  const [localFields, setLocalFields] = useState<string[] | null>(null);
  useEffect(() => setLocalFields(null), [s.fields]);
  const { capabilities } = useMetaModel(s.entitySet, { service: s.service });
  const live = p.liveMode ?? s.liveMode;

  if (import.meta.env?.DEV && p.metaPath && !SELECTION_FIELDS.test(p.metaPath)) console.warn(`[smart-kit] FilterBar: metaPath "${p.metaPath}" is not a UI.SelectionFields path`);

  const custom = useMemo(() => (p.filterFields ?? []).filter((f) => f.availability !== 'Hidden'), [p.filterFields]);
  const shownFields = localFields ?? s.fields;
  const fields = useMemo(() => {
    const base: Field[] = shownFields.filter((id) => !custom.some((f) => f.key === id)).map((id) => ({ id, label: label(id) }));
    let out = applyExtensions(base, p.extend, 'FilterBar') as Field[];
    for (const f of custom) {
      if (!customShown.has(f.key)) continue;
      const item: Field = { id: f.key, label: f.label ?? label(f.property ?? f.key), render: f.template, required: f.required, property: f.property };
      const at = f.anchor ? out.findIndex((x) => x.id === f.anchor) : -1;
      out = out.filter((x) => x.id !== f.key);
      if (at < 0) out.push(item);
      else out.splice(f.placement === 'Before' ? at : at + 1, 0, item);
    }
    return out.filter((f) => !inactive.has(f.id)).map((f) => (labels[f.id] ? { ...f, label: labels[f.id]! } : f));
  }, [shownFields, p.extend, label, custom, customShown, inactive, labels]);

  const missingCustom = custom.filter((f) => f.required && customShown.has(f.key) && !(s.filters[f.key] ?? []).some(isComplete)).map((f) => f.key);
  const latest = useRef({ s, fields, missingCustom, p });
  latest.current = { s, fields, missingCustom, p };

  const search = (): boolean => {
    const cur = latest.current;
    const missing = cur.missingCustom.length > 0;
    setShowErrors(missing);
    const ok = !missing && cur.s.go();
    if (!ok && cur.p.showMessages !== false) void MessageBox.error(t('filterBar.requiredMissing'));
    return ok;
  };
  const clear = () => {
    s.setFilters({});
    s.setSearch('');
    setShowErrors(false);
    p.onAfterClear?.();
  };
  const writeFields = (next: string[]) => {
    const props = next.filter((id) => !custom.some((f) => f.key === id));
    const shown = new Set(next.filter((id) => custom.some((f) => f.key === id)));
    setCustomShown(shown);
    if (p.ignorePersonalizationChanges) setLocalFields(props);
    else s.setFields(props);
  };

  // live mode set on the bar while the state is in manual mode: apply after a short delay
  const ownLive = Boolean(p.liveMode) && !s.liveMode;
  useEffect(() => {
    if (!ownLive || s.missingRequired.length || (s.applied && !s.dirty)) return;
    const h = setTimeout(() => s.go(), 300);
    return () => clearTimeout(h);
  }, [ownLive, s]);

  // events: search after every executed query, filterChanged after a change of values or visible fields
  const applied = useRef(s.applied);
  useEffect(() => {
    if (s.applied === applied.current) return;
    applied.current = s.applied;
    if (s.applied) latest.current.p.onSearch?.();
  }, [s.applied]);
  const changed = useRef({ f: s.filters, q: s.search, v: shownFields, c: customShown });
  useEffect(() => {
    const c = changed.current;
    if (c.f === s.filters && c.q === s.search && c.v === shownFields && c.c === customShown) return;
    changed.current = { f: s.filters, q: s.search, v: shownFields, c: customShown };
    latest.current.p.onFilterChanged?.();
  }, [s.filters, s.search, shownFields, customShown]);

  const isVisible = (path: string) => latest.current.fields.some((f) => f.id === path);
  const setVisible = (path: string, visible: boolean) => {
    const isCustom = custom.some((f) => f.key === path);
    if (isCustom) { setCustomShown((cur) => { const n = new Set(cur); if (visible) n.add(path); else n.delete(path); return n; }); return; }
    const cur = localFields ?? latest.current.s.fields;
    const next = visible ? (cur.includes(path) ? cur : [...cur, path]) : cur.filter((x) => x !== path);
    if (p.ignorePersonalizationChanges) setLocalFields(next);
    else latest.current.s.setFields(next);
  };

  useImperativeHandle(p.ref, (): FilterBar => ({
    getActiveFiltersText() {
      const cur = latest.current.s;
      const names = [...(cur.search ? [t('filterBar.search')] : []), ...activeFilterPaths(cur.filters).map((x) => labels[x] ?? label(x))];
      return filterSummaryText(t, names);
    },
    getFilterFieldEnabled: (name) => !disabled.has(name),
    getFilterFieldVisible: async (conditionPath) => isVisible(conditionPath),
    getFilters: () => ({ filters: latest.current.s.filters, search: latest.current.s.search || undefined }),
    getSelectionVariant: async () => toSelectionVariant(latest.current.s.filters, latest.current.s.search),
    setFilterFieldEnabled(name, enabled) {
      setDisabled((cur) => { const n = new Set(cur); if (enabled) n.delete(name); else n.add(name); return n; });
    },
    async setFilterFieldsActive(changes) {
      setInactive((cur) => { const n = new Set(cur); for (const c of changes) { if (c.active) n.delete(c.conditionPath); else n.add(c.conditionPath); } return n; });
    },
    async setFilterFieldsLabel(changes) {
      setLabels((cur) => ({ ...cur, ...Object.fromEntries(changes.map((c) => [c.conditionPath, c.label])) }));
    },
    async setFilterFieldsTooltip(changes) {
      setTooltips((cur) => ({ ...cur, ...Object.fromEntries(changes.map((c) => [c.conditionPath, c.tooltip])) }));
    },
    setFilterFieldVisible: async (conditionPath, visible) => setVisible(conditionPath, visible),
    async setFilterValues(sConditionPath, sOperator, vValues) {
      latest.current.s.setConditions(sConditionPath, toConditions(sOperator, vValues));
    },
    async setSelectionVariant(selectionVariant, prefillDescriptions) {
      latest.current.s.setFilters(fromSelectionVariant(selectionVariant, prefillDescriptions));
    },
    async triggerSearch() {
      if (!search()) throw new Error('FilterBar: mandatory filter fields are empty');
      return undefined;
    },
  }));

  const value = useMemo<BarCtx>(
    () => ({ p: { ...p, state: s }, fields, live, disabled, tooltips, missingCustom, showErrors, search, clear, openVh: setVhPath, openAdapt: () => setAdapt(true) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- search and clear read the latest values through refs
    [p, s, fields, live, disabled, tooltips, missingCustom.join('|'), showErrors],
  );
  const locked = [...new Set([...capabilities.requiredFilters, ...Object.keys(s.filters).filter((k) => (s.filters[k] ?? []).length)])];
  const adaptFields = [...shownFields, ...custom.filter((f) => customShown.has(f.key)).map((f) => f.key)];
  return (
    <Ctx.Provider value={value}>
      <div className={['sk-filterbar', p.className].filter(Boolean).join(' ')} role="search">
        {p.children ?? (
          <>
            <div className="sk-filterbar__fields">
              <SearchPart />
              <FieldsPart />
            </div>
            <ActionsPart />
          </>
        )}
      </div>
      {vhPath ? (
        <ValueHelpDialog
          opened
          entitySet={s.entitySet}
          service={s.service}
          path={fields.find((f) => f.id === vhPath)?.property ?? vhPath}
          title={labels[vhPath] ?? label(vhPath)}
          conditions={s.filters[vhPath] ?? []}
          onOk={(c) => { s.setConditions(vhPath, c); setVhPath(null); }}
          onCancel={() => setVhPath(null)}
        />
      ) : null}
      <AdaptFiltersDialog
        opened={adapt}
        entitySet={s.entitySet}
        service={s.service}
        fields={adaptFields}
        locked={[...locked, ...custom.filter((f) => f.required).map((f) => f.key)]}
        extraFields={custom.map((f) => ({ path: f.key, label: f.label ?? label(f.property ?? f.key) }))}
        excluded={[...inactive]}
        navigationProperties={p.navigationPropertiesForPersonalization}
        labels={labels}
        onOk={(f) => { writeFields(f); setAdapt(false); }}
        onCancel={() => setAdapt(false)}
      />
    </Ctx.Provider>
  );
}
