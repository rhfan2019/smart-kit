/**
 * Relative and semantic dates of a date filter field (S6; FE semantic date operators, docs/29 §5): the operators the
 * field allows (Capabilities.FilterExpressionRestrictions and the type, as FE CommonHelper getOperatorsForProperty),
 * offered as buttons; operators with values (Last X weeks, From <date>, Today -X / +Y days, a month) get an input
 * next to their button.
 */
import { ActionIcon, Button, Group, NumberInput, Popover, ScrollArea, Select, TextInput } from '@mantine/core';
import { relativeDateValueTypes, type Condition, type RelativeDateOperator } from '@rhfan2019/smart-kit-core';
import { CalendarClock } from 'lucide-react';
import { useState } from 'react';
import { useSmartKit } from '../context/SmartKitProvider';
import { useFilterText } from './filterText';
import { optionText } from '../controls/dialogs/dateOptions';
import { relativeDateText } from './conditionText';

export interface RelativeDateButtonProps {
  operators: readonly RelativeDateOperator[];
  onPick(c: Condition): void;
}

const DEFAULTS: Record<string, unknown[]> = { TODAYFROMTO: [1, 1], SPECIFICMONTH: [0] };

export function RelativeDateButton(p: RelativeDateButtonProps) {
  const t = useFilterText();
  const { intlLocale } = useSmartKit();
  const [opened, setOpened] = useState(false);
  const [values, setValues] = useState<Record<string, unknown[]>>({});
  const pick = (c: Condition) => { setOpened(false); p.onPick(c); };
  const plain = p.operators.filter((o) => relativeDateValueTypes(o).length === 0);
  const withValues = p.operators.filter((o) => relativeDateValueTypes(o).length > 0 && o !== 'DATE' && o !== 'DATERANGE');
  const valuesOf = (o: string) => values[o] ?? DEFAULTS[o] ?? (relativeDateValueTypes(o as RelativeDateOperator)[0] === 'int' ? [7] : []);
  const set = (o: string, i: number, v: unknown) => { const next = [...valuesOf(o)]; next[i] = v; setValues({ ...values, [o]: next }); };
  const month = (m: number) => new Intl.DateTimeFormat(intlLocale, { month: 'long' }).format(new Date(2000, m, 1));
  const complete = (o: RelativeDateOperator) => relativeDateValueTypes(o).every((_, i) => valuesOf(o)[i] !== undefined && valuesOf(o)[i] !== '');
  return (
    <Popover opened={opened} onChange={setOpened} position="bottom-start" trapFocus returnFocus>
      <Popover.Target>
        <ActionIcon variant="subtle" aria-label={t('dateRange.button')} title={t('dateRange.button')} aria-expanded={opened} onClick={() => setOpened((o) => !o)} data-sk-relative-dates>
          <CalendarClock className="sk-icon" />
        </ActionIcon>
      </Popover.Target>
      <Popover.Dropdown className="sk-relative-dates">
        <ScrollArea.Autosize mah="var(--sk-size-dialog-list)">
          <div className="sk-relative-dates__list" role="group" aria-label={t('dateRange.button')}>
            {plain.map((o) => (
              <Button key={o} variant="subtle" size="xs" justify="flex-start" onClick={() => pick({ operator: o, values: [] })} data-sk-relative-date={o}>
                {relativeDateText({ operator: o, values: [] }, t, intlLocale)}
              </Button>
            ))}
          </div>
          {withValues.map((o) => {
            const types = relativeDateValueTypes(o);
            const v = valuesOf(o);
            return (
              <Group key={o} gap="xs" wrap="nowrap" className="sk-relative-dates__days">
                {types.map((type, i) =>
                  type === 'date' ? (
                    <TextInput key={i} size="xs" type="date" value={String(v[i] ?? '')} aria-label={t('vh.value')} onChange={(e) => set(o, i, e.currentTarget.value)} className="sk-relative-dates__count" data-sk-relative-count={i ? `${o}:${i}` : o} />
                  ) : type === 'month' ? (
                    <Select key={i} size="xs" allowDeselect={false} value={String(v[i] ?? 0)} data={Array.from({ length: 12 }, (_, m) => ({ value: String(m), label: month(m) }))} aria-label={t('ctl.ddr.SPECIFICMONTH')} onChange={(x) => set(o, i, Number(x))} className="sk-relative-dates__count" data-sk-relative-count={i ? `${o}:${i}` : o} />
                  ) : (
                    <NumberInput
                      key={i} size="xs" min={type === 'year' ? 1 : o === 'TODAYFROMTO' ? 0 : 1} max={9999} allowDecimal={false} allowNegative={false} value={v[i] as number | undefined}
                      aria-label={o === 'TODAYFROMTO' ? t(i ? 'ctl.ddr.daysAfter' : 'ctl.ddr.daysBefore') : type === 'year' ? t('ctl.ddr.year') : /DAYS/.test(o) ? t('dateRange.dayCount') : t('ctl.ddr.value')}
                      onChange={(x) => set(o, i, typeof x === 'number' ? x : x === '' ? undefined : Number(x))}
                      className="sk-relative-dates__count" data-sk-relative-count={i ? `${o}:${i}` : o}
                    />
                  ),
                )}
                <Button variant="subtle" size="xs" justify="flex-start" disabled={!complete(o)} onClick={() => pick({ operator: o, values: v.slice(0, types.length) })} data-sk-relative-date={o} className="sk-grow">
                  {complete(o) ? relativeDateText({ operator: o, values: v }, t, intlLocale) : optionText(t, o)}
                </Button>
              </Group>
            );
          })}
        </ScrollArea.Autosize>
      </Popover.Dropdown>
    </Popover>
  );
}
