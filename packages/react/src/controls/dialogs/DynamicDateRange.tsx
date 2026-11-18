/**
 * DynamicDateRange (sap.m.DynamicDateRange, docs/26 3.8): a text field with a popover of date options (today, last X
 * days, this quarter, a date, a date range …). The value has the UI5 shape `{ operator, values }`.
 */
import { ActionIcon, Button, Group, NumberInput, Popover, Radio, Text, TextInput, UnstyledButton } from '@mantine/core';
import { DatePicker, TimeInput } from '@mantine/dates';
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useId, useImperativeHandle, useMemo, useState, type KeyboardEvent, type ReactNode, type Ref } from 'react';
import type { MessageKey } from '../../i18n/messages.en';
import { useControlLocale, useControlText } from '../context';
import { toneOf, type ValueState } from '../types';
import {
  asDate, DEFAULT_STANDARD_OPTIONS, enhances, formatStandard, fromIsoDay, GROUP_ORDER, groupOf, isoDay, kindOf, optionText, parseStandard, rangeText,
  standardToDates, unitKey, UNITS, valueTypesOf,
  type CalendarWeekNumbering, type DynamicDateFormatter, type DynamicDateOption, type DynamicDateRangeValue, type FormatContext, type Kind,
  type StandardDynamicDateRangeKeys, type Unit,
} from './dateOptions';

export {
  CalendarWeekNumbering, DEFAULT_STANDARD_OPTIONS, StandardDynamicDateRangeKeys,
  type DynamicDateFormatter, type DynamicDateOption, type DynamicDateRangeValue,
} from './dateOptions';
import { TEXTS } from './texts';

/** Parameters of the `change` event. */
export interface DynamicDateRange$ChangeEvent {
  /** The current value; undefined when the field was cleared or the text could not be read. */
  value: DynamicDateRangeValue | undefined;
  /** Whether the new value is valid. */
  valid: boolean;
}

export interface $DynamicDateRangeSettings {
  /** The value (controlled); undefined: empty. */
  value?: DynamicDateRangeValue;
  /** CSS width of the field. */
  width?: string;
  /** @defaultValue true */
  enabled?: boolean;
  /** @defaultValue 'None' */
  valueState?: ValueState;
  /** Name of the input (forms). */
  name?: string;
  placeholder?: string;
  /** @defaultValue true */
  editable?: boolean;
  valueStateText?: string;
  /** @defaultValue false */
  required?: boolean;
  /**
   * Shows the group headers (single dates, date ranges, weeks …) in the option list.
   * @defaultValue true
   */
  enableGroupHeaders?: boolean;
  /** Formats and parses the dates in the field (UI5: a DateFormat instance). */
  formatter?: DynamicDateFormatter;
  /**
   * The standard options offered; the list keeps the UI5 grouping and this order inside each group. Default: all 68
   * keys (`DEFAULT_STANDARD_OPTIONS`).
   * @defaultValue DATE,TODAY,YESTERDAY,TOMORROW,FIRSTDAYWEEK,LASTDAYWEEK,FIRSTDAYMONTH,LASTDAYMONTH,FIRSTDAYQUARTER,LASTDAYQUARTER,FIRSTDAYYEAR,LASTDAYYEAR,DATERANGE,DATETIMERANGE,FROM,TO,FROMDATETIME,TODATETIME,YEARTODATE,DATETOYEAR,LASTMINUTES,LASTHOURS,LASTDAYS,LASTWEEKS,LASTMONTHS,LASTQUARTERS,LASTYEARS,LASTMINUTESINCLUDED,LASTHOURSINCLUDED,LASTDAYSINCLUDED,LASTWEEKSINCLUDED,LASTMONTHSINCLUDED,LASTQUARTERSINCLUDED,LASTYEARSINCLUDED,NEXTMINUTES,NEXTHOURS,NEXTDAYS,NEXTWEEKS,NEXTMONTHS,NEXTQUARTERS,NEXTYEARS,NEXTMINUTESINCLUDED,NEXTHOURSINCLUDED,NEXTDAYSINCLUDED,NEXTWEEKSINCLUDED,NEXTMONTHSINCLUDED,NEXTQUARTERSINCLUDED,NEXTYEARSINCLUDED,TODAYFROMTO,THISWEEK,LASTWEEK,NEXTWEEK,SPECIFICMONTH,SPECIFICMONTHINYEAR,THISMONTH,LASTMONTH,NEXTMONTH,THISQUARTER,LASTQUARTER,NEXTQUARTER,QUARTER1,QUARTER2,QUARTER3,QUARTER4,THISYEAR,LASTYEAR,NEXTYEAR,DATETIME
   */
  standardOptions?: readonly StandardDynamicDateRangeKeys[];
  /**
   * Renders no field; the popover is opened with `open(domRef)` / `openBy(domRef)`.
   * @defaultValue false
   */
  hideInput?: boolean;
  /** Week numbering for week options (default: the locale). */
  calendarWeekNumbering?: CalendarWeekNumbering;
  /** @defaultValue false */
  showClearIcon?: boolean;
  /** Own options (sap.m.DynamicDateOption). */
  customOptions?: DynamicDateOption[];
  /** Fired when the user picks, types or clears a value; `valid` is false when typed text could not be read. */
  onChange?(e: DynamicDateRange$ChangeEvent): void;
  /** Extension: field label (Mantine input label). */
  label?: ReactNode;
  id?: string;
  'aria-label'?: string;
  ref?: Ref<DynamicDateRange>;
}

export interface DynamicDateRange {
  /** Opens the popover at `domRef` (default: the field). */
  open(domRef?: HTMLElement | null): void;
  /** Opens the popover at `domRef` (default: the field). */
  openBy(domRef?: HTMLElement | null): void;
  /** The dates of a value, with the control's week numbering and custom options. */
  toDates(value: DynamicDateRangeValue): Date[];
  /** Appends a standard option key to the options of the control (once). */
  addStandardOption(sKey: StandardDynamicDateRangeKeys): void;
  /**
   * The option with this key: a custom option as given, or, for a standard key of the control, an option object with
   * its text, group, format / parse / toDates (standing for the StandardDynamicDateOption instance); undefined otherwise.
   */
  getOption(sKey: string): DynamicDateOption | undefined;
  /** Adds an option group (after the standard groups); custom options select it with `getGroup()` returning its name. */
  addGroup(sGroupName: string, sGroupHeader: string): void;
  /** Sets a new header for a group added with addGroup. */
  setGroupHeader(sGroupName: string, sGroupHeader: string): void;
  /** The header text of a standard group or of a group added with addGroup. */
  getGroupHeader(sGroupName: string): string | undefined;
  /** Removes the groups added with addGroup. */
  removeCustomGroups(): void;
}

/** The standard option groups with their numbers (UI5 `DynamicDateRangeGroups`); added groups get the next numbers. */
const STANDARD_GROUPS = ['SingleDates', 'DateRanges', 'Weeks', 'Month', 'Quarters', 'Years'];

/** One entry of the option list; the LAST/NEXT X options with a number are one entry per direction, as in UI5. */
interface Entry { id: string; label: string; group: string; keys: string[]; kind: Kind | 'custom'; custom?: DynamicDateOption }

/** The group key of a custom option: a standard or added group from `getGroup`, else its header (default "Custom"). */
function customGroupOf(c: DynamicDateOption, added: ReadonlyArray<{ name: string }>): string {
  const g = c.getGroup?.();
  const names = [...STANDARD_GROUPS, ...added.map((x) => x.name)];
  const name = typeof g === 'number' ? names[g - 1] : g;
  if (name && names.includes(name)) return name;
  return c.getGroupHeader?.() ?? 'Custom';
}

function entriesOf(standard: readonly string[], custom: DynamicDateOption[], t: FormatContext['t'], added: ReadonlyArray<{ name: string }> = []): Entry[] {
  const out: Entry[] = [];
  for (const k of standard) {
    const u = unitKey(k);
    if (u) {
      const id = `${u.dir}${u.included ? 'INCLUDED' : ''}`;
      const e = out.find((x) => x.id === id);
      if (e) e.keys.push(k); else out.push({ id, label: t(`ctl.ddr.${id}` as MessageKey), group: 'DateRanges', keys: [k], kind: 'units' });
      continue;
    }
    out.push({ id: k, label: optionText(t, k), group: groupOf(k), keys: [k], kind: kindOf(k) });
  }
  for (const c of custom) out.push({ id: c.key, label: c.getText?.() ?? c.key, group: customGroupOf(c, added), keys: [c.key], kind: 'custom', custom: c });
  for (const e of out) if (e.kind === 'units') e.keys.sort((a, b) => UNITS.indexOf(unitKey(a)!.unit) - UNITS.indexOf(unitKey(b)!.unit));
  return out;
}

/**
 * The dates of a value (sap.m.DynamicDateRange.toDates): start of the first day and end of the last day in local time;
 * FROM / TO give one date, as in UI5. `now` is an internal hook for tests.
 */
export function toDates(value: DynamicDateRangeValue, calendarWeekNumbering?: CalendarWeekNumbering, now?: Date): Date[] {
  return standardToDates(value, calendarWeekNumbering, now);
}

/** The DynamicDateRange control; `DynamicDateRange.toDates(value, calendarWeekNumbering)` is the UI5 static method. */
export function DynamicDateRange(p: $DynamicDateRangeSettings) {
  const t = useControlText(TEXTS);
  const { intlLocale } = useControlLocale();
  const ctx: FormatContext = { t, intlLocale, formatter: p.formatter };
  // addStandardOption appends to the standardOptions prop; a new prop value starts over (as setStandardOptions)
  const [addedOptions, setAddedOptions] = useState<{ base: readonly string[] | undefined; keys: string[] }>({ base: p.standardOptions, keys: [] });
  if (addedOptions.base !== p.standardOptions) setAddedOptions({ base: p.standardOptions, keys: [] });
  const baseOptions = p.standardOptions ?? DEFAULT_STANDARD_OPTIONS;
  const standard = useMemo(() => (addedOptions.keys.length ? [...baseOptions, ...addedOptions.keys.filter((k) => !baseOptions.includes(k as StandardDynamicDateRangeKeys))] : baseOptions),
    [baseOptions, addedOptions.keys]);
  const [addedGroups, setGroups] = useState<Array<{ name: string; header: string }>>([]);
  const custom = useMemo(() => p.customOptions ?? [], [p.customOptions]);
  const enabled = p.enabled ?? true;
  const editable = p.editable ?? true;
  const [opened, setOpened] = useState(false);
  const [detail, setDetail] = useState<string | null>(null);
  const [typed, setTyped] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const [field, setField] = useState<HTMLElement | null>(null);
  const listId = useId();
  const entries = useMemo(() => entriesOf(standard, custom, t, addedGroups), [standard, custom, t, addedGroups]);
  const customOf = (key: string) => custom.find((c) => c.key === key);

  const datesOf = (v: DynamicDateRangeValue) => {
    const c = customOf(v.operator);
    if (c) return c.toDates?.(v, p.calendarWeekNumbering) ?? [];
    return standardToDates(v, p.calendarWeekNumbering, undefined, intlLocale);
  };
  const format = (v: DynamicDateRangeValue | undefined) => {
    if (!v) return '';
    const c = customOf(v.operator);
    if (c) {
      const text = c.format?.(v) ?? c.getText?.() ?? v.operator;
      if (!c.enhanceFormattedValue?.()) return text;
      const ds = c.toDates?.(v, p.calendarWeekNumbering);
      return ds?.length ? `${text} (${rangeText(ds, ctx)})` : text;
    }
    const text = formatStandard(v, ctx);
    if (!enhances(v.operator)) return text;
    try {
      const u = unitKey(v.operator);
      return `${text} (${rangeText(datesOf(v), ctx, u?.unit === 'MINUTES' || u?.unit === 'HOURS')})`;
    } catch { return text; }
  };

  const text = typed ?? format(p.value);
  const state = invalid ? 'Error' : p.valueState ?? 'None';
  const emit = (value: DynamicDateRangeValue | undefined, valid = true) => { setInvalid(!valid); p.onChange?.({ value, valid }); };
  const close = () => { setOpened(false); setDetail(null); setAnchor(null); };
  const pick = (value: DynamicDateRangeValue) => { close(); setTyped(null); emit(value); };
  const commitTyped = () => {
    if (typed === null) return;
    if (!typed.trim()) { setTyped(null); emit(undefined); return; }
    let v: DynamicDateRangeValue | null | undefined;
    for (const c of custom) { v = c.parse?.(typed); if (v) break; }
    v ??= parseStandard(typed, standard, ctx);
    if (!v) { emit(undefined, false); return; }
    setTyped(null);
    emit(v);
  };
  const openAt = (el?: HTMLElement | null) => {
    if (!enabled || !editable) return;
    setAnchor(el && el !== field ? el.getBoundingClientRect() : null);
    setDetail(null);
    setOpened(true);
  };

  const groupHeader = (name: string) => (STANDARD_GROUPS.includes(name) ? t(`ctl.ddr.group.${name}` as MessageKey) : addedGroups.find((g) => g.name === name)?.header);
  /** A standard option as a DynamicDateOption object (getOption). */
  const standardOption = (key: string): DynamicDateOption => ({
    key,
    valueTypes: valueTypesOf(key),
    getText: () => optionText(t, key),
    getGroup: () => STANDARD_GROUPS.indexOf(groupOf(key)) + 1,
    getGroupHeader: () => groupHeader(groupOf(key)) ?? '',
    format: (v) => formatStandard(v, ctx),
    parse: (text) => parseStandard(text, [key], ctx),
    toDates: (v, numbering) => standardToDates(v, numbering ?? p.calendarWeekNumbering, undefined, intlLocale),
    enhanceFormattedValue: () => enhances(key),
  });

  useImperativeHandle(p.ref, () => ({
    open: openAt,
    openBy: openAt,
    toDates: datesOf,
    addStandardOption: (key) => setAddedOptions((a) => (a.keys.includes(key) ? a : { ...a, keys: [...a.keys, key] })),
    getOption: (key) => customOf(key) ?? (standard.includes(key as StandardDynamicDateRangeKeys) ? standardOption(key) : undefined),
    addGroup: (name, header) => setGroups((g) => [...g, { name, header }]),
    setGroupHeader: (name, header) => setGroups((g) => g.map((x) => (x.name === name ? { ...x, header } : x))),
    getGroupHeader: groupHeader,
    removeCustomGroups: () => setGroups([]),
  }));

  // standard groups, then the added groups (numbers 7…), then the other custom groups
  const order = [...STANDARD_GROUPS, ...addedGroups.map((g) => g.name), ...GROUP_ORDER.filter((g) => !STANDARD_GROUPS.includes(g))];
  const groups = order.concat(entries.map((e) => e.group).filter((g) => !order.includes(g)))
    .filter((g, i, all) => all.indexOf(g) === i)
    .map((g) => [g, entries.filter((e) => e.group === g)] as const).filter(([, es]) => es.length);
  const selectedEntry = p.value && entries.find((e) => e.keys.includes(p.value!.operator));
  const detailEntry = entries.find((e) => e.id === detail);
  const groupLabel = (g: string) => (GROUP_ORDER.includes(g) ? t(`ctl.ddr.group.${g}` as MessageKey) : addedGroups.find((x) => x.name === g)?.header ?? g);
  const needsDetail = (e: Entry) => (e.kind === 'custom' ? Boolean(e.custom?.valueTypes?.length || e.custom?.createValueHelpUI) : e.kind !== 'none');

  const input = p.hideInput ? null : (
    <TextInput
      ref={setField}
      className="sk-dynamic-date-range"
      id={p.id} label={p.label} aria-label={p['aria-label']} name={p.name} required={p.required} withAsterisk={p.required}
      value={text} placeholder={p.placeholder} disabled={!enabled} readOnly={!editable}
      error={state === 'Error' ? (invalid ? t('ctl.ddr.invalid') : p.valueStateText ?? true) : undefined}
      description={state !== 'None' && state !== 'Error' ? p.valueStateText : undefined}
      data-sk-value-state={state} classNames={{ description: `sk-status--${toneOf(state)}` }}
      onChange={(e) => setTyped(e.currentTarget.value)}
      onBlur={commitTyped}
      onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') commitTyped();
        if (e.key === 'F4' || (e.altKey && e.key === 'ArrowDown')) { e.preventDefault(); openAt(); }
      }}
      rightSectionPointerEvents="all"
      rightSectionWidth="auto"
      rightSection={editable && enabled ? (
        <Group gap={0} wrap="nowrap">
          {p.showClearIcon && (p.value || typed) && (
            <ActionIcon variant="subtle" aria-label={t('ctl.ddr.clear')} title={t('ctl.ddr.clear')} onClick={() => { setTyped(null); emit(undefined); }} data-sk-ddr-clear>
              <X className="sk-icon" />
            </ActionIcon>
          )}
          <ActionIcon variant="subtle" aria-label={t('ctl.ddr.openPicker')} title={t('ctl.ddr.openPicker')} aria-expanded={opened} aria-controls={opened ? listId : undefined}
            onClick={() => (opened ? close() : openAt())} data-sk-ddr-open>
            <CalendarDays className="sk-icon" />
          </ActionIcon>
        </Group>
      ) : undefined}
    />
  );

  // The popover hangs on an empty element over the field, or over the element given to open / openBy.
  return (
    <div className={`sk-ddr-root${p.hideInput ? ' sk-ddr-root--hidden' : ''}`} style={p.width ? { width: p.width } : undefined}>
    {input}
    <Popover opened={opened} onChange={(o) => (o ? setOpened(true) : close())} position="bottom-start" trapFocus returnFocus>
      <Popover.Target>
        <span className="sk-ddr__anchor" aria-hidden
          style={anchor ? { position: 'fixed', left: anchor.left, top: anchor.top, width: anchor.width, height: anchor.height } : undefined} />
      </Popover.Target>
      <Popover.Dropdown className="sk-ddr" id={listId}>
        {detailEntry ? (
          <DetailPage entry={detailEntry} value={selectedEntry === detailEntry ? p.value : undefined} ctx={ctx} datesOf={datesOf}
            onBack={() => setDetail(null)} onApply={pick} onCancel={close} />
        ) : (
          <div role="listbox" aria-label={t('ctl.ddr.options')} className="sk-ddr__list">
            {groups.map(([g, es]) => (
              <div key={g} role="group" aria-label={groupLabel(g)}>
                {(p.enableGroupHeaders ?? true) && <div className="sk-ddr__group" aria-hidden>{groupLabel(g)}</div>}
                {es.map((e) => (
                  <UnstyledButton key={e.id} role="option" aria-selected={selectedEntry === e} className="sk-ddr__option" data-sk-ddr-option={e.id}
                    onClick={() => (needsDetail(e) ? setDetail(e.id) : pick({ operator: e.keys[0]!, values: [] }))}>
                    <span className="sk-grow">{e.label}</span>
                    {needsDetail(e) && <ChevronRight className="sk-icon" aria-hidden />}
                  </UnstyledButton>
                ))}
              </div>
            ))}
          </div>
        )}
      </Popover.Dropdown>
    </Popover>
    </div>
  );
}
DynamicDateRange.toDates = toDates;

const timeOf = (d: Date | undefined) => (d ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : '00:00');
const withTime = (day: string, time: string) => { const d = fromIsoDay(day); const [h, m] = time.split(':').map(Number); d.setHours(h || 0, m || 0); return d; };

/** The detail page of an option with values. */
function DetailPage(p: {
  entry: Entry; value?: DynamicDateRangeValue; ctx: FormatContext; datesOf(v: DynamicDateRangeValue): Date[];
  onBack(): void; onApply(v: DynamicDateRangeValue): void; onCancel(): void;
}) {
  const { t, intlLocale } = p.ctx;
  const { locale } = useControlLocale();
  const { entry } = p;
  const init = p.value?.values ?? [];
  const d0 = asDate(init[0]);
  const d1 = asDate(init[1]);
  const [unitOp, setUnitOp] = useState<string>(p.value?.operator ?? entry.keys.find((k) => unitKey(k)?.unit === 'DAYS') ?? entry.keys[0]!);
  const [n1, setN1] = useState<number>(typeof init[0] === 'number' ? init[0] : entry.kind === 'month' || entry.kind === 'monthinyear' ? new Date().getMonth() : 1);
  const [n2, setN2] = useState<number>(typeof init[1] === 'number' ? init[1] : entry.kind === 'monthinyear' ? new Date().getFullYear() : 1);
  const [day, setDay] = useState<string | null>(d0 ? isoDay(d0) : null);
  const [range, setRange] = useState<[string | null, string | null]>([d0 ? isoDay(d0) : null, d1 ? isoDay(d1) : null]);
  const [time1, setTime1] = useState(timeOf(d0));
  const [time2, setTime2] = useState(d1 ? timeOf(d1) : '23:59');
  const [customValue, setCustomValue] = useState<DynamicDateRangeValue | undefined>(p.value);
  const op = entry.keys[0]!;

  let draft: DynamicDateRangeValue | undefined;
  switch (entry.kind) {
    case 'units': draft = n1 >= 1 ? { operator: unitOp, values: [n1] } : undefined; break;
    case 'todayfromto': draft = n1 >= 0 && n2 >= 0 ? { operator: op, values: [n1, n2] } : undefined; break;
    case 'month': draft = { operator: op, values: [n1] }; break;
    case 'monthinyear': draft = n2 >= 1 ? { operator: op, values: [n1, n2] } : undefined; break;
    case 'date': draft = day ? { operator: op, values: [fromIsoDay(day)] } : undefined; break;
    case 'datetime': draft = day ? { operator: op, values: [withTime(day, time1)] } : undefined; break;
    case 'daterange': draft = range[0] && range[1] ? { operator: op, values: [fromIsoDay(range[0]), fromIsoDay(range[1])] } : undefined; break;
    case 'datetimerange': draft = range[0] && range[1] ? { operator: op, values: [withTime(range[0], time1), withTime(range[1], time2)] } : undefined; break;
    case 'custom': draft = (entry.custom?.validateValueHelpUI?.(customValue) ?? Boolean(customValue)) ? customValue : undefined; break;
    default: break;
  }

  let selected = '';
  if (draft) {
    try {
      const u = unitKey(draft.operator);
      const timed = entry.kind === 'datetime' || entry.kind === 'datetimerange' || u?.unit === 'MINUTES' || u?.unit === 'HOURS';
      const ds = p.datesOf(draft);
      selected = ds.length === 1 ? formatStandard(draft, p.ctx) : rangeText(ds, p.ctx, timed);
    } catch { selected = ''; }
  }
  const months = Array.from({ length: 12 }, (_, i) => new Intl.DateTimeFormat(intlLocale, { month: 'short' }).format(new Date(2000, i, 1)));
  const number = (label: string, value: number, set: (n: number) => void, min = 1) => (
    <NumberInput label={label} min={min} max={9999} allowDecimal={false} allowNegative={false} value={value} data-autofocus
      onChange={(v) => set(typeof v === 'number' ? v : Number(v) || 0)} />
  );
  const monthGrid = (
    <div className="sk-ddr__months" role="radiogroup" aria-label={t('ctl.ddr.SPECIFICMONTH')}>
      {months.map((m, i) => (
        <Button key={m} size="xs" variant={i === n1 ? 'filled' : 'subtle'} role="radio" aria-checked={i === n1} onClick={() => setN1(i)}>{m}</Button>
      ))}
    </div>
  );

  return (
    <div className="sk-ddr__detail" role="group" aria-label={entry.label}>
      <Group gap="xs" wrap="nowrap" className="sk-ddr__detail-head">
        <ActionIcon variant="subtle" onClick={p.onBack} aria-label={t('ctl.ddr.back')} title={t('ctl.ddr.back')}><ChevronLeft className="sk-icon" /></ActionIcon>
        <Text fw={600}>{entry.label}</Text>
      </Group>
      {entry.kind === 'units' && (
        <>
          {number(t('ctl.ddr.value'), n1, setN1)}
          {entry.keys.length > 1 && (
            <Radio.Group label={t('ctl.ddr.unit')} value={unitOp} onChange={setUnitOp}>
              <div className="sk-ddr__units">{entry.keys.map((k) => <Radio key={k} value={k} label={t(`ctl.ddr.unit.${unitKey(k)!.unit as Unit}`)} />)}</div>
            </Radio.Group>
          )}
        </>
      )}
      {entry.kind === 'todayfromto' && <>{number(t('ctl.ddr.daysBefore'), n1, setN1, 0)}{number(t('ctl.ddr.daysAfter'), n2, setN2, 0)}</>}
      {entry.kind === 'month' && monthGrid}
      {entry.kind === 'monthinyear' && <>{monthGrid}{number(t('ctl.ddr.year'), n2, setN2)}</>}
      {(entry.kind === 'date' || entry.kind === 'datetime') && <DatePicker locale={locale} value={day} onChange={setDay} defaultDate={day ?? undefined} />}
      {(entry.kind === 'daterange' || entry.kind === 'datetimerange') && (
        <DatePicker locale={locale} type="range" allowSingleDateInRange value={range} onChange={(v) => setRange(v as [string | null, string | null])} defaultDate={range[0] ?? undefined} />
      )}
      {entry.kind === 'datetime' && <TimeInput label={t('ctl.ddr.time')} value={time1} onChange={(e) => setTime1(e.currentTarget.value)} />}
      {entry.kind === 'datetimerange' && (
        <Group grow gap="xs">
          <TimeInput label={t('ctl.ddr.fromTime')} value={time1} onChange={(e) => setTime1(e.currentTarget.value)} />
          <TimeInput label={t('ctl.ddr.toTime')} value={time2} onChange={(e) => setTime2(e.currentTarget.value)} />
        </Group>
      )}
      {entry.kind === 'custom' && entry.custom?.createValueHelpUI?.({ value: customValue, update: setCustomValue })}
      {selected && <Text size="sm" className="sk-ddr__selected" data-sk-ddr-selected>{t('ctl.ddr.selected', { value: selected })}</Text>}
      <Group justify="flex-end" gap="xs">
        <Button size="xs" disabled={!draft} onClick={() => draft && p.onApply(draft)}>{t('common.ok')}</Button>
        <Button size="xs" variant="default" onClick={p.onCancel}>{t('common.cancel')}</Button>
      </Group>
    </div>
  );
}

/** The value types of an option key (UI5 `DynamicDateOption.getValueTypes` of the standard options). */
export const dynamicDateValueTypes = valueTypesOf;
