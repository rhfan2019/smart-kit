/**
 * Condition editor of one filter field: tokens with typed conditions, fixed-value multi-select, date range (LR-10, LR-11),
 * relative dates (today, this month, last X days …); the control follows Capabilities.FilterExpressionRestrictions
 * (P2-LR-19): one value, values only, one range, or search patterns. Values of a value list are shown according to
 * UI.TextArrangement (TextOnly: the text alone; TextSeparate is shown like TextFirst here).
 */
import { ActionIcon, Button, Group, NumberInput, Popover, Select, TagsInput } from '@mantine/core';
import { DateInput, DatePickerInput } from '@mantine/dates';
import {
  arrangeText, conditionAllowed, filterExpressionRules, getProperty, isComplete, isRelativeDateOperator, OPERATOR_ARITY, RELATIVE_DATE_OPERATORS, valueListTextArrangement,
  type Condition, type Operator, type PropertyModel, type TextArrangement,
} from '@rhfan2019/smart-kit-core';
import dayjs from 'dayjs';
import { CalendarClock, Copy } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useService, useSmartKit, useText } from '../context/SmartKitProvider';
import { getPath } from '../field/values';
import { conditionText, parseConditionText, sameCondition } from './conditionText';
import { useValueList } from './useValueList';

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
  const rules = filterExpressionRules(service.model.entitySets[p.entitySet]!.capabilities.filterExpressions[p.path]);
  const [rejected, setRejected] = useState(false);
  const [typed, setTyped] = useState('');
  // A range being picked (first date chosen, second not yet): kept locally, not written to the conditions, so that the
  // picker does not treat "equal to the first date" as a finished range.
  const [pending, setPending] = useState<[string | null, string | null] | null>(null);

  const fixed = useValueList(vl, { top: 200, enabled: Boolean(vl?.fixedValues) }, p.service);
  const suggest = useValueList(vl, { search: typed, top: 10, enabled: Boolean(vl && !vl.fixedValues && typed.trim().length > 0) }, p.service);

  // UI.TextArrangement of the values; TextSeparate has no second column in a field, so it reads like TextFirst.
  const annotated = valueListTextArrangement(service.model, prop);
  const arrangement: TextArrangement | undefined = annotated === 'TextSeparate' ? 'TextFirst' : annotated;
  const valueLabel = (d: { key: string; text?: string }) => arrangeText(d.key, d.text, arrangement);
  const relativeOps = isDateType(prop) ? RELATIVE_DATE_OPERATORS.filter((o) => rules.operators.includes(o)) : [];
  const hasRelative = p.conditions.some((c) => isRelativeDateOperator(c.operator));

  const describe = (row: Record<string, unknown>) => {
    const key = String(getPath(row, vl!.keyProperty) ?? '');
    const text = vl!.descriptionProperty ? getPath(row, vl!.descriptionProperty) : undefined;
    return { key, text: text === undefined || text === null || text === '' ? undefined : String(text) };
  };

  const hint = rules.expression && rules.expression !== 'MultiRange' && rules.expression !== 'MultiRangeOrSearchExpression' ? t(`filterBar.only.${rules.expression}`) : undefined;
  const common = {
    label: p.label, error: p.error ?? (rejected ? hint : undefined), required: p.required, id: p.id, withAsterisk: p.required, className: 'sk-filter-field',
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
        {...common} clearable searchable data={data} value={v === undefined ? null : String(v)} data-sk-single-select
        onChange={(val) => {
          const d = described.find((x) => x.key === val);
          p.onChange(val === null ? [] : [{ operator: 'EQ', values: [val], text: d?.text }]);
        }}
      />
    );
  }
  if (rules.expression === 'SingleValue' && isDateType(prop)) {
    const v = p.conditions[0]?.values[0];
    return (
      <DateInput
        {...common} clearable value={v ? String(v).slice(0, 10) : null} valueFormat={t('filterBar.dateFormat')} locale={intlLocale.slice(0, 2)}
        onChange={(d) => p.onChange(d ? [{ operator: 'EQ', values: [dayjs(d).format('YYYY-MM-DD')] }] : [])}
      />
    );
  }

  const range = isDateType(prop) && !hasRelative ? rangeOf(p.conditions) ?? (rules.expression === 'SingleRange' ? [null, null] : undefined) : undefined;
  const relative = relativeOps.length ? (
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

  const tokens = p.conditions.map((c) => conditionText(c, prop, intlLocale, timeZone, { t, textArrangement: arrangement }));
  const suggestions = ((vl?.fixedValues ? fixed.data?.rows : suggest.data?.rows) ?? []).map(describe);
  const suggestionLabel = valueLabel;
  return (
    <TagsInput
      {...common}
      leftSection={relative}
      leftSectionPointerEvents="all"
      value={tokens}
      searchValue={typed}
      onSearchChange={setTyped}
      data={rules.operators.includes('EQ') ? suggestions.map(suggestionLabel).filter((l) => !tokens.includes(l)) : []}
      maxTags={rules.max}
      acceptValueOnBlur
      clearable
      splitChars={[]}
      classNames={{ pillsList: 'sk-tokens__list', inputField: 'sk-tokens__input' }}
      rightSection={
        vl && !vl.fixedValues ? (
          <ActionIcon onClick={p.onValueHelp} aria-label={t('filterBar.showValueHelp')} title={t('filterBar.showValueHelp')}>
            <Copy className="sk-icon" />
          </ActionIcon>
        ) : undefined
      }
      onChange={(next) => {
        const kept: Condition[] = [];
        let refused = false;
        for (const token of next) {
          const i = tokens.indexOf(token);
          if (i >= 0) { kept.push(p.conditions[i]!); continue; }
          const s = suggestions.find((d) => suggestionLabel(d) === token);
          if (s) { kept.push({ operator: 'EQ', values: [s.key], text: s.text }); continue; }
          let c = parseConditionText(token, prop);
          // Search expressions: plain text means "contains" (P2-LR-19).
          if (c && rules.expression === 'SearchExpression' && c.operator === 'EQ' && !/^=/.test(token.trim())) c = { operator: 'Contains', values: c.values };
          if (c && conditionAllowed(rules, c)) kept.push(c);
          else if (c) refused = true;
        }
        setRejected(refused);
        setTyped('');
        p.onChange(kept);
      }}
    />
  );
}

/** Button with the relative dates of a date filter field (S6): today, this week, last X days … */
function RelativeDateButton(p: { operators: readonly Operator[]; onPick(c: Condition): void }) {
  const t = useText();
  const [opened, setOpened] = useState(false);
  const [days, setDays] = useState<Record<string, number>>({ LASTDAYS: 7, NEXTDAYS: 7 });
  const pick = (c: Condition) => { setOpened(false); p.onPick(c); };
  const plain = p.operators.filter((o) => OPERATOR_ARITY[o] === 0);
  const counted = p.operators.filter((o) => OPERATOR_ARITY[o] === 1);
  return (
    <Popover opened={opened} onChange={setOpened} position="bottom-start" trapFocus returnFocus>
      <Popover.Target>
        <ActionIcon variant="subtle" aria-label={t('dateRange.button')} title={t('dateRange.button')} aria-expanded={opened} onClick={() => setOpened((o) => !o)} data-sk-relative-dates>
          <CalendarClock className="sk-icon" />
        </ActionIcon>
      </Popover.Target>
      <Popover.Dropdown className="sk-relative-dates">
        <div className="sk-relative-dates__list" role="group" aria-label={t('dateRange.button')}>
          {plain.map((o) => (
            <Button key={o} variant="subtle" size="xs" justify="flex-start" onClick={() => pick({ operator: o, values: [] })} data-sk-relative-date={o}>
              {t(`dateRange.${o}` as 'dateRange.TODAY')}
            </Button>
          ))}
        </div>
        {counted.map((o) => (
          <Group key={o} gap="xs" wrap="nowrap" className="sk-relative-dates__days">
            <NumberInput
              size="xs" min={1} max={9999} allowDecimal={false} allowNegative={false} value={days[o]} aria-label={t('dateRange.dayCount')}
              onChange={(v) => setDays({ ...days, [o]: typeof v === 'number' ? v : Number(v) || 0 })}
              className="sk-relative-dates__count"
            />
            <Button variant="subtle" size="xs" justify="flex-start" disabled={!(days[o]! >= 1)} onClick={() => pick({ operator: o, values: [days[o]] })} data-sk-relative-date={o} className="sk-grow">
              {t(`dateRange.${o}` as 'dateRange.LASTDAYS', { count: days[o] ?? 0 })}
            </Button>
          </Group>
        ))}
      </Popover.Dropdown>
    </Popover>
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
