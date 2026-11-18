/**
 * Condition editor of one filter field: tokens with typed conditions, fixed-value multi-select, date range (LR-10, LR-11),
 * relative dates (today, this month, last X days …); the control follows Capabilities.FilterExpressionRestrictions
 * (P2-LR-19): one value, values only, one range, or search patterns. Values of a value list are shown according to
 * UI.TextArrangement (TextOnly: the text alone; TextSeparate is shown like TextFirst here).
 */
import { ActionIcon, Select, TagsInput } from '@mantine/core';
import { DateInput, DatePickerInput } from '@mantine/dates';
import {
  arrangeText, conditionAllowed, filterExpressionRules, getProperty, isComplete, isRelativeDateOperator, valueListTextArrangement,
  type Condition, type PropertyModel, type TextArrangement,
} from '@rhfan2019/smart-kit-core';
import dayjs from 'dayjs';
import { Copy } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useService, useSmartKit } from '../context/SmartKitProvider';
import { useFilterText } from './filterText';
import { getPath } from '../field/values';
import { conditionText, parseConditionText, sameCondition } from './conditionText';
import { RelativeDateButton } from './RelativeDateButton';
import { useTokenDescriptions } from './useTokenDescriptions';
import { useValueList } from './useValueList';
import { propagateOut, useValueHelpSource } from './valueHelpSource';

export interface ConditionInputProps {
  /** Entity set of the filtered property. */
  entitySet: string;
  /** Filtered property path, e.g. "Status". */
  path: string;
  /** Name of the service in `SmartKitProvider` `services`; default: the provider's `defaultService`. */
  service?: string;
  /** Conditions of the field (controlled). */
  conditions: Condition[];
  /** Called with the new conditions (typed values become "EQ" conditions; "=x", ">x", "a...b", "*x*" are parsed). */
  onChange(conditions: Condition[]): void;
  /** Accessible name, usually the property label. */
  label: string;
  /** Error text shown under the field. */
  error?: string;
  /** Shows the mandatory marker and validates that a value is entered. */
  required?: boolean;
  /** Opens the value help dialog (rendered by the caller). */
  onValueHelp?(): void;
  /** Element id (e.g. for an external `<label htmlFor>`). */
  id?: string;
  /** Disables the field (`FilterBar.setFilterFieldEnabled`). */
  disabled?: boolean;
  /** Tooltip of the field (`FilterBar.setFilterFieldsTooltip`). */
  title?: string;
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
  const t = useFilterText();
  const typeName = service.model.entitySets[p.entitySet]!.typeName;
  const prop = getProperty(service.model, typeName, p.path);
  const vl = prop?.valueList;
  const rules = filterExpressionRules(service.model.entitySets[p.entitySet]!.capabilities.filterExpressions[p.path], prop?.edmType);
  const [rejected, setRejected] = useState(false);
  const [typed, setTyped] = useState('');
  // A range being picked (first date chosen, second not yet): kept locally, not written to the conditions, so that the
  // picker does not treat "equal to the first date" as a finished range.
  const [pending, setPending] = useState<[string | null, string | null] | null>(null);

  // In / InOut parameters filter by the other fields of the surrounding filter bar (P1-5).
  const source = useValueHelpSource();
  // Fixed values (Common.ValueListWithFixedValues) are read when the field is used (focus, dropdown) or a value needs
  // its description, not when the filter bar is shown: Fiori elements requests them on demand (DV-FE-08, DV-FE-09).
  const [used, setUsed] = useState(false);
  // (a single-value select shows its value through the list)
  const needsText = p.conditions.some((c) => c.operator === 'EQ' && (c.text === undefined || rules.expression === 'SingleValue'));
  const fixed = useValueList(vl, { top: 200, enabled: Boolean(vl?.fixedValues) && (used || needsText), filters: source?.filters }, p.service);
  const use = () => setUsed(true);
  // type-ahead after a short pause in typing, as the mdc field's delayed suggestion request
  const [typedNow, setTypedNow] = useState('');
  useEffect(() => { const h = setTimeout(() => setTypedNow(typed), 300); return () => clearTimeout(h); }, [typed]);
  const suggest = useValueList(vl, { search: typedNow, top: 10, enabled: Boolean(vl && !vl.fixedValues && typed.trim().length > 0 && typedNow === typed), filters: source?.filters }, p.service);

  // UI.TextArrangement of the values; TextSeparate shows the code only, as FE's filter field (FilterFieldTemplating
  // getDisplayProperty: display mode "Value").
  const arrangement: TextArrangement | undefined = valueListTextArrangement(service.model, prop);
  const valueLabel = (d: { key: string; text?: string }) => arrangeText(d.key, d.text, arrangement);
  // values without a description (typed, or written back by an Out parameter) read it from the value list
  const descriptions = useTokenDescriptions(vl, p.conditions, arrangement !== 'TextSeparate', p.service);
  const relativeOps = isDateType(prop) ? rules.operators.filter(isRelativeDateOperator).filter((o) => o !== 'DATE' && o !== 'DATERANGE') : [];
  const hasRelative = p.conditions.some((c) => isRelativeDateOperator(c.operator));

  const describe = (row: Record<string, unknown>) => {
    const key = String(getPath(row, vl!.keyProperty) ?? '');
    const text = vl!.descriptionProperty ? getPath(row, vl!.descriptionProperty) : undefined;
    return { key, text: text === undefined || text === null || text === '' ? undefined : String(text) };
  };

  const hint = rules.expression && rules.expression !== 'MultiRange' && rules.expression !== 'MultiRangeOrSearchExpression' ? t(`filterBar.only.${rules.expression}`) : undefined;
  const common = {
    label: p.label, error: p.error ?? (rejected ? hint : undefined), required: p.required, id: p.id, withAsterisk: p.required, className: 'sk-filter-field',
    disabled: p.disabled, title: p.title,
    'data-sk-filter-expression': rules.expression,
  };

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

  if (rules.expression === 'SingleValue' && vl?.fixedValues) {
    const v = p.conditions[0]?.values[0];
    const described = (fixed.data?.rows ?? []).map(describe);
    const data = described.map((d) => ({ value: d.key, label: valueLabel(d) }));
    return (
      <Select
        {...common} clearable searchable data={data} value={v === undefined ? null : String(v)} data-sk-single-select onFocus={use} onDropdownOpen={use}
        onChange={(val) => {
          const d = described.find((x) => x.key === val);
          p.onChange(val === null ? [] : [{ operator: 'EQ', values: [val], text: d?.text }]);
        }}
      />
    );
  }
  if (rules.expression === 'SingleValue' && isDateType(prop) && !hasRelative) {
    const v = p.conditions[0]?.values[0];
    // Edm.Date: FE's single-value semantic dates (today, first day of this month …, getSingleValueDateOperations)
    return (
      <DateInput
        {...common} clearable value={v ? String(v).slice(0, 10) : null} valueFormat={t('filterBar.dateFormat')} locale={intlLocale.slice(0, 2)}
        leftSection={relativeOps.length && !p.disabled ? <RelativeDateButton operators={relativeOps} onPick={(c) => p.onChange([c])} /> : undefined}
        leftSectionPointerEvents="all"
        onChange={(d) => p.onChange(d ? [{ operator: 'EQ', values: [dayjs(d).format('YYYY-MM-DD')] }] : [])}
      />
    );
  }

  const range = isDateType(prop) && !hasRelative ? rangeOf(p.conditions) ?? (rules.expression === 'SingleRange' ? [null, null] : undefined) : undefined;
  const relative = relativeOps.length && !p.disabled ? (
    <RelativeDateButton
      operators={relativeOps}
      onPick={(c) => {
        if (range) { p.onChange([c]); return; }
        const next = [...p.conditions.filter((x) => !sameCondition(x, c)), c];
        p.onChange(rules.max !== undefined ? next.slice(-rules.max) : next);
      }}
    />
  ) : undefined;
  if (range) {
    return (
      <DatePickerInput
        {...common}
        leftSection={relative}
        leftSectionPointerEvents="all"
        type="range"
        allowSingleDateInRange
        clearable
        value={pending ?? range}
        // Explicit per-language format: dayjs's localized tokens ("ll") need a plugin and would show literally.
        valueFormat={t('filterBar.dateFormat')}
        locale={intlLocale.slice(0, 2)}
        onChange={(v) => {
          const [a, b] = v as [string | null, string | null];
          if (a && !b) { setPending([a, null]); return; }
          setPending(null);
          if (!a) p.onChange([]);
          else if (a === b) p.onChange([{ operator: 'EQ', values: [a] }]);
          else p.onChange([{ operator: 'BT', values: [a, b] }]);
        }}
        onDropdownClose={() => {
          // Closed after one date: filter for that day.
          if (pending?.[0]) p.onChange([{ operator: 'EQ', values: [pending[0]] }]);
          setPending(null);
        }}
      />
    );
  }

  const tokens = p.conditions.map((c) => {
    const text = c.text ?? (c.operator === 'EQ' && !c.exclude ? descriptions[String(c.values[0])] : undefined);
    return conditionText(text === undefined ? c : { ...c, text }, prop, intlLocale, timeZone, { t, textArrangement: arrangement });
  });
  const suggestionRows = (vl?.fixedValues ? fixed.data?.rows : suggest.data?.rows) ?? [];
  const suggestions = suggestionRows.map(describe);
  const suggestionLabel = valueLabel;
  return (
    <TagsInput
      {...common}
      leftSection={relative}
      leftSectionPointerEvents="all"
      value={tokens}
      searchValue={typed}
      onSearchChange={setTyped}
      onFocus={use}
      onDropdownOpen={use}
      data={rules.operators.includes('EQ') ? suggestions.map(suggestionLabel).filter((l) => !tokens.includes(l)) : []}
      // one condition (SingleValue, SingleRange): a new value replaces the old one (FE maxConditions 1)
      acceptValueOnBlur
      clearable
      splitChars={[]}
      classNames={{ pillsList: 'sk-tokens__list', inputField: 'sk-tokens__input' }}
      rightSection={
        vl && !vl.fixedValues && !p.disabled ? (
          <ActionIcon onClick={p.onValueHelp} aria-label={t('filterBar.showValueHelp')} title={t('filterBar.showValueHelp')}>
            <Copy className="sk-icon" />
          </ActionIcon>
        ) : undefined
      }
      onChange={(next) => {
        const kept: Condition[] = [];
        const picked: Record<string, unknown>[] = [];
        let refused = false;
        for (const token of next) {
          const i = tokens.indexOf(token);
          if (i >= 0) { kept.push(p.conditions[i]!); continue; }
          const s = suggestions.find((d) => suggestionLabel(d) === token);
          if (s) {
            kept.push({ operator: 'EQ', values: [s.key], text: s.text });
            picked.push(suggestionRows[suggestions.indexOf(s)]!);
            continue;
          }
          let c = parseConditionText(token, prop);
          // Search expressions: plain text means "contains" (P2-LR-19).
          if (c && rules.expression === 'SearchExpression' && c.operator === 'EQ' && !/^=/.test(token.trim())) c = { operator: 'Contains', values: c.values };
          if (c && conditionAllowed(rules, c)) kept.push(c);
          else if (c) refused = true;
        }
        setRejected(refused);
        setTyped('');
        p.onChange(rules.max !== undefined && kept.length > rules.max ? kept.slice(kept.length - rules.max) : kept);
        if (vl) propagateOut(vl, picked, source);
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
