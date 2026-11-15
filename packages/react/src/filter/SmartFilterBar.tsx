/** SmartFilterBar: search, filter fields from UI.SelectionFields, "Go", "Adapt Filters (n)" (LR-05–LR-11). */
import { Button, Group, TextInput } from '@mantine/core';
import type { Condition } from '@rhfan2019/smart-kit-core';
import { Search } from 'lucide-react';
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { useMetaModel, useText } from '../context/SmartKitProvider';
import { applyExtensions, type ExtendEntry } from '../util/extend';
import { AdaptFiltersDialog } from './AdaptFiltersDialog';
import { ConditionInput, useFieldLabel } from './ConditionInput';
import type { FilterStateApi } from './useFilterState';
import { ValueHelpDialog } from './ValueHelpDialog';

export interface FilterFieldItem {
  id: string;
  label: string;
  /** Custom editor; when omitted the default ConditionInput is used. */
  render?(ctx: { conditions: Condition[]; onChange(c: Condition[]): void; label: string; id: string }): ReactNode;
}

export interface SmartFilterBarProps {
  /** State from useFilterState (controlled). */
  state: FilterStateApi;
  /** Insert or replace filter fields. Custom fields store their conditions under their id. */
  extend?: ExtendEntry<FilterFieldItem>[];
  /** Extra buttons before "Go". */
  actions?: ReactNode;
  /** Replace the default parts: write <SmartFilterBar.Search/>, <SmartFilterBar.Fields/>, <SmartFilterBar.Actions/>. */
  children?: ReactNode;
  className?: string;
}

const Ctx = createContext<{ p: SmartFilterBarProps; fields: FilterFieldItem[]; openVh(path: string): void; openAdapt(): void } | null>(null);
function useBar() {
  const c = useContext(Ctx);
  if (!c) throw new Error('SmartFilterBar parts must be used inside <SmartFilterBar>');
  return c;
}

/** Context for custom content inside the filter bar. */
export function useFilterBarContext(): FilterStateApi {
  return useBar().p.state;
}

function SearchPart() {
  const { p } = useBar();
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
      onKeyDown={(e) => { if (e.key === 'Enter') p.state.go(); }}
    />
    </div>
  );
}

function FieldsPart() {
  const { p, fields, openVh } = useBar();
  const t = useText();
  const { capabilities } = useMetaModel(p.state.entitySet, { service: p.state.service });
  return (
    <>
      {fields.map((f) => {
        const conditions = p.state.filters[f.id] ?? [];
        const onChange = (c: Condition[]) => p.state.setConditions(f.id, c);
        const required = capabilities.requiredFilters.includes(f.id);
        const error = required && p.state.showRequiredErrors && p.state.missingRequired.includes(f.id) ? t('filterBar.required') : undefined;
        const id = `sk-filter-${p.state.entitySet}-${f.id.replace(/\W/g, '_')}`;
        return (
          <div key={f.id} className="sk-filterbar__field" data-sk-filter={f.id}>
            {f.render ? (
              f.render({ conditions, onChange, label: f.label, id })
            ) : (
              <ConditionInput entitySet={p.state.entitySet} service={p.state.service} path={f.id} conditions={conditions} onChange={onChange} label={f.label} required={required} error={error} id={id} onValueHelp={() => openVh(f.id)} />
            )}
          </div>
        );
      })}
    </>
  );
}

function ActionsPart({ children }: { children?: ReactNode }) {
  const { p, openAdapt } = useBar();
  const t = useText();
  const n = p.state.activeCount;
  return (
    <Group gap="xs" className="sk-filterbar__actions" wrap="nowrap">
      {children ?? p.actions}
      {!p.state.liveMode ? <Button onClick={() => p.state.go()} data-sk-go>{t('filterBar.go')}</Button> : null}
      <Button variant="subtle" onClick={openAdapt}>{t('filterBar.adaptFilters', { count: n })}</Button>
    </Group>
  );
}

export function SmartFilterBar(p: SmartFilterBarProps) {
  const label = useFieldLabel(p.state.entitySet, p.state.service);
  const [vhPath, setVhPath] = useState<string | null>(null);
  const [adapt, setAdapt] = useState(false);
  const { capabilities } = useMetaModel(p.state.entitySet, { service: p.state.service });
  const fields = useMemo(() => {
    const base: FilterFieldItem[] = p.state.fields.map((id) => ({ id, label: label(id) }));
    return applyExtensions(base, p.extend, 'SmartFilterBar');
  }, [p.state.fields, p.extend, label]);
  const value = useMemo(() => ({ p, fields, openVh: setVhPath, openAdapt: () => setAdapt(true) }), [p, fields]);
  const locked = [...new Set([...capabilities.requiredFilters, ...Object.keys(p.state.filters).filter((k) => (p.state.filters[k] ?? []).length)])];
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
          entitySet={p.state.entitySet}
          service={p.state.service}
          path={vhPath}
          title={label(vhPath)}
          conditions={p.state.filters[vhPath] ?? []}
          onOk={(c) => { p.state.setConditions(vhPath, c); setVhPath(null); }}
          onCancel={() => setVhPath(null)}
        />
      ) : null}
      <AdaptFiltersDialog
        opened={adapt}
        entitySet={p.state.entitySet}
        service={p.state.service}
        fields={p.state.fields}
        locked={locked}
        onOk={(f) => { p.state.setFields(f); setAdapt(false); }}
        onCancel={() => setAdapt(false)}
      />
    </Ctx.Provider>
  );
}

SmartFilterBar.Search = SearchPart;
SmartFilterBar.Fields = FieldsPart;
SmartFilterBar.Actions = ActionsPart;
