/** Condition editor of one filter field: tokens with typed conditions, fixed-value multi-select, date range (LR-10, LR-11). */
import { ActionIcon, Select, TagsInput } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { getProperty, isComplete, type Condition, type PropertyModel } from '@rhfan2019/smart-kit-core';
import { Copy } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useService, useSmartKit, useText } from '../context/SmartKitProvider';
import { getPath } from '../field/values';
import { conditionText, parseConditionText } from './conditionText';
import { useValueList } from './useValueList';

export interface ConditionInputProps {
  entitySet: string;
  path: string;
  service?: string;
  conditions: Condition[];
  onChange(conditions: Condition[]): void;
  label: string;
  error?: string;
  required?: boolean;
  /** Opens the value help dialog (rendered by the caller). */
  onValueHelp?(): void;
  id?: string;
}

function isDateType(p: PropertyModel | undefined) {
  return p?.edmType === 'Edm.Date' || p?.edmType === 'Edm.DateTimeOffset';
}

/** Date fields use a range picker when the conditions are a single include range or equality. */
function rangeOf(conditions: Condition[]): [string | null, string | null] | undefined {
  const complete = conditions.filter(isComplete);
  if (complete.length === 0) return [null, null];
  if (complete.length > 1 || complete[0]!.exclude) return undefined;
  const c = complete[0]!;
  if (c.operator === 'BT') return [String(c.values[0]).slice(0, 10), String(c.values[1]).slice(0, 10)];
  if (c.operator === 'EQ') return [String(c.values[0]).slice(0, 10), String(c.values[0]).slice(0, 10)];
  return undefined;
}

export function ConditionInput(p: ConditionInputProps) {
  const service = useService(p.service);
  const { intlLocale, timeZone } = useSmartKit();
  const t = useText();
  const typeName = service.model.entitySets[p.entitySet]!.typeName;
  const prop = getProperty(service.model, typeName, p.path);
  const vl = prop?.valueList;
  const [typed, setTyped] = useState('');

  const fixed = useValueList(vl, { top: 200, enabled: Boolean(vl?.fixedValues) }, p.service);
  const suggest = useValueList(vl, { search: typed, top: 10, enabled: Boolean(vl && !vl.fixedValues && typed.trim().length > 0) }, p.service);

  const describe = (row: Record<string, unknown>) => {
    const key = String(getPath(row, vl!.keyProperty) ?? '');
    const text = vl!.descriptionProperty ? getPath(row, vl!.descriptionProperty) : undefined;
    return { key, text: text === undefined || text === null || text === '' ? undefined : String(text) };
  };

  const common = { label: p.label, error: p.error, required: p.required, id: p.id, withAsterisk: p.required, className: 'sk-filter-field' };

  if (prop?.edmType === 'Edm.Boolean') {
    const v = p.conditions.find((c) => c.operator === 'EQ')?.values[0];
    return (
      <Select
        {...common}
        clearable
        data={[{ value: 'true', label: t('common.yes') }, { value: 'false', label: t('common.no') }]}
        value={v === undefined ? null : String(v)}
        onChange={(val) => p.onChange(val === null ? [] : [{ operator: 'EQ', values: [val === 'true'] }])}
      />
    );
  }

  const range = isDateType(prop) ? rangeOf(p.conditions) : undefined;
  if (range) {
    return (
      <DatePickerInput
        {...common}
        type="range"
        allowSingleDateInRange
        clearable
        value={range}
        valueFormat="ll"
        locale={intlLocale.slice(0, 2)}
        onChange={(v) => {
          const [a, b] = v as [string | null, string | null];
          if (!a) p.onChange([]);
          else if (!b || a === b) p.onChange([{ operator: 'EQ', values: [a] }]);
          else p.onChange([{ operator: 'BT', values: [a, b] }]);
        }}
      />
    );
  }

  const tokens = p.conditions.map((c) => conditionText(c, prop, intlLocale, timeZone));
  const suggestions = ((vl?.fixedValues ? fixed.data?.rows : suggest.data?.rows) ?? []).map(describe);
  const suggestionLabel = (d: { key: string; text?: string }) => (d.text ? `${d.text} (${d.key})` : d.key);
  return (
    <TagsInput
      {...common}
      value={tokens}
      searchValue={typed}
      onSearchChange={setTyped}
      data={suggestions.map(suggestionLabel).filter((l) => !tokens.includes(l))}
      acceptValueOnBlur
      clearable
      splitChars={[]}
      rightSection={
        vl && !vl.fixedValues ? (
          <ActionIcon onClick={p.onValueHelp} aria-label={t('filterBar.showValueHelp')} title={t('filterBar.showValueHelp')}>
            <Copy className="sk-icon" />
          </ActionIcon>
        ) : undefined
      }
      onChange={(next) => {
        const kept: Condition[] = [];
        for (const token of next) {
          const i = tokens.indexOf(token);
          if (i >= 0) { kept.push(p.conditions[i]!); continue; }
          const s = suggestions.find((d) => suggestionLabel(d) === token);
          if (s) { kept.push({ operator: 'EQ', values: [s.key], text: s.text }); continue; }
          const c = parseConditionText(token, prop);
          if (c) kept.push(c);
        }
        setTyped('');
        p.onChange(kept);
      }}
    />
  );
}

/** Memoized label lookup for filter fields. */
export function useFieldLabel(entitySet: string, serviceName?: string) {
  const service = useService(serviceName);
  return useMemo(() => {
    const typeName = service.model.entitySets[entitySet]!.typeName;
    return (path: string) => getProperty(service.model, typeName, path)?.label ?? path;
  }, [service.model, entitySet]);
}
