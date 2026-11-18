/**
 * The standard options of DynamicDateRange (sap.m.StandardDynamicDateRangeKeys): value types, resolution to dates
 * (`toDates`), texts and parsing. Relative days, weeks, months, quarters and years use core's `relativeDateRange`.
 */
import { relativeDateRange, RELATIVE_DATE_OPERATORS, type Operator } from '@rhfan2019/smart-kit-core';
import type { ReactNode } from 'react';
import type { MessageKey } from '../../i18n/messages.en';
import type { TextFn } from '../../i18n/text';

const KEYS = [
  'DATE', 'TODAY', 'YESTERDAY', 'TOMORROW', 'FIRSTDAYWEEK', 'LASTDAYWEEK', 'FIRSTDAYMONTH', 'LASTDAYMONTH', 'FIRSTDAYQUARTER', 'LASTDAYQUARTER',
  'FIRSTDAYYEAR', 'LASTDAYYEAR', 'DATERANGE', 'DATETIMERANGE', 'FROM', 'TO', 'FROMDATETIME', 'TODATETIME', 'YEARTODATE', 'DATETOYEAR', 'LASTMINUTES',
  'LASTHOURS', 'LASTDAYS', 'LASTWEEKS', 'LASTMONTHS', 'LASTQUARTERS', 'LASTYEARS', 'LASTMINUTESINCLUDED', 'LASTHOURSINCLUDED', 'LASTDAYSINCLUDED',
  'LASTWEEKSINCLUDED', 'LASTMONTHSINCLUDED', 'LASTQUARTERSINCLUDED', 'LASTYEARSINCLUDED', 'NEXTMINUTES', 'NEXTHOURS', 'NEXTDAYS', 'NEXTWEEKS',
  'NEXTMONTHS', 'NEXTQUARTERS', 'NEXTYEARS', 'NEXTMINUTESINCLUDED', 'NEXTHOURSINCLUDED', 'NEXTDAYSINCLUDED', 'NEXTWEEKSINCLUDED', 'NEXTMONTHSINCLUDED',
  'NEXTQUARTERSINCLUDED', 'NEXTYEARSINCLUDED', 'TODAYFROMTO', 'THISWEEK', 'LASTWEEK', 'NEXTWEEK', 'SPECIFICMONTH', 'SPECIFICMONTHINYEAR', 'THISMONTH',
  'LASTMONTH', 'NEXTMONTH', 'THISQUARTER', 'LASTQUARTER', 'NEXTQUARTER', 'QUARTER1', 'QUARTER2', 'QUARTER3', 'QUARTER4', 'THISYEAR', 'LASTYEAR',
  'NEXTYEAR', 'DATETIME',
] as const;

/** sap.m.StandardDynamicDateRangeKeys */
export type StandardDynamicDateRangeKeys = (typeof KEYS)[number];
export const StandardDynamicDateRangeKeys = Object.fromEntries(KEYS.map((k) => [k, k])) as { readonly [K in StandardDynamicDateRangeKeys]: K };

/** The default `standardOptions` of 1.154 (all 68 keys, in the UI5 order). */
export const DEFAULT_STANDARD_OPTIONS: readonly StandardDynamicDateRangeKeys[] = KEYS;

/** sap/base/i18n/date/CalendarWeekNumbering */
export type CalendarWeekNumbering = 'Default' | 'ISO_8601' | 'MiddleEastern' | 'WesternTraditional';
export const CalendarWeekNumbering = { Default: 'Default', ISO_8601: 'ISO_8601', MiddleEastern: 'MiddleEastern', WesternTraditional: 'WesternTraditional' } as const;

/**
 * The value of a DynamicDateRange, as in UI5: `{ operator: 'LASTDAYS', values: [7] }`, `{ operator: 'DATE', values: [Date] }`,
 * `{ operator: 'DATERANGE', values: [Date, Date] }`, `{ operator: 'SPECIFICMONTH', values: [monthIndex] }`,
 * `{ operator: 'SPECIFICMONTHINYEAR', values: [monthIndex, year] }`, `{ operator: 'TODAYFROMTO', values: [daysBefore, daysAfter] }`.
 * Custom options use their own key and values.
 */
export interface DynamicDateRangeValue {
  operator: StandardDynamicDateRangeKeys | (string & {});
  values: Array<Date | number | string>;
}

/** The date formatter of the `formatter` property (UI5: a sap.ui.core.format.DateFormat instance). */
export interface DynamicDateFormatter {
  format(date: Date): string;
  parse?(text: string): Date | null;
}

/** A custom option (sap.m.DynamicDateOption); methods are optional except where the option needs them. */
export interface DynamicDateOption {
  key: string;
  /** The value types, e.g. `['int']`, `['date']`; empty: the option is picked without a detail page. */
  valueTypes?: string[];
  /** The option text in the list (UI5 `getText`). */
  getText?(): string;
  /** The group header shown above the option (UI5 `getGroupHeader`); default "Other Options". */
  getGroupHeader?(): string;
  format?(value: DynamicDateRangeValue): string;
  parse?(text: string): DynamicDateRangeValue | null | undefined;
  toDates?(value: DynamicDateRangeValue, calendarWeekNumbering?: CalendarWeekNumbering): Date[];
  /**
   * The detail page content. `update` takes the value the page stands for (undefined while it is incomplete);
   * React's answer to UI5's `createValueHelpUI(oControl, fnControlsUpdated)`.
   */
  createValueHelpUI?(ctx: { value: DynamicDateRangeValue | undefined; update(value: DynamicDateRangeValue | undefined): void }): ReactNode;
  /** Whether the detail page is complete (default: a value was given to `update`). */
  validateValueHelpUI?(value: DynamicDateRangeValue | undefined): boolean;
  /** Whether the field also shows the resolved dates, e.g. "Today (Nov 17, 2026)". */
  enhanceFormattedValue?(): boolean;
}

export type Unit = 'MINUTES' | 'HOURS' | 'DAYS' | 'WEEKS' | 'MONTHS' | 'QUARTERS' | 'YEARS';
export const UNITS: Unit[] = ['MINUTES', 'HOURS', 'DAYS', 'WEEKS', 'MONTHS', 'QUARTERS', 'YEARS'];

/** The editor kind of an option. */
export type Kind = 'none' | 'date' | 'daterange' | 'datetime' | 'datetimerange' | 'units' | 'todayfromto' | 'month' | 'monthinyear';

export function kindOf(key: string): Kind {
  if (key === 'DATE' || key === 'FROM' || key === 'TO') return 'date';
  if (key === 'DATERANGE') return 'daterange';
  if (key === 'DATETIME' || key === 'FROMDATETIME' || key === 'TODATETIME') return 'datetime';
  if (key === 'DATETIMERANGE') return 'datetimerange';
  if (key === 'TODAYFROMTO') return 'todayfromto';
  if (key === 'SPECIFICMONTH') return 'month';
  if (key === 'SPECIFICMONTHINYEAR') return 'monthinyear';
  return unitKey(key) ? 'units' : 'none';
}

/** LASTDAYSINCLUDED → { dir: 'LAST', unit: 'DAYS', included: true }. */
export function unitKey(key: string): { dir: 'LAST' | 'NEXT'; unit: Unit; included: boolean } | undefined {
  const m = /^(LAST|NEXT)(MINUTES|HOURS|DAYS|WEEKS|MONTHS|QUARTERS|YEARS)(INCLUDED)?$/.exec(key);
  return m ? { dir: m[1] as 'LAST' | 'NEXT', unit: m[2] as Unit, included: Boolean(m[3]) } : undefined;
}

/** The value types of a standard option (UI5 `getValueTypes`). */
export function valueTypesOf(key: string): string[] {
  switch (kindOf(key)) {
    case 'date': return ['date'];
    case 'daterange': return ['date', 'date'];
    case 'datetime': return ['datetime'];
    case 'datetimerange': return ['datetime', 'datetime'];
    case 'units': case 'month': return ['int'];
    case 'todayfromto': case 'monthinyear': return ['int', 'int'];
    default: return [];
  }
}

/** The list group of a standard option. */
export function groupOf(key: string): string {
  if (['DATE', 'DATETIME', 'TODAY', 'YESTERDAY', 'TOMORROW'].includes(key) || /^(FIRST|LAST)DAY(WEEK|MONTH|QUARTER|YEAR)$/.test(key)) return 'SingleDates';
  if (/WEEK$/.test(key)) return 'Weeks';
  if (/MONTH(INYEAR)?$/.test(key)) return 'Month';
  if (/QUARTER\d?$/.test(key)) return 'Quarters';
  if (/YEAR$/.test(key) && key !== 'DATETOYEAR') return 'Years';
  return 'DateRanges';
}
export const GROUP_ORDER = ['SingleDates', 'DateRanges', 'Weeks', 'Month', 'Quarters', 'Years', 'Custom'];

/** The first day of the week (0 = Sunday) for a week numbering; Default follows the locale. */
export function weekStartOf(numbering?: CalendarWeekNumbering | null, intlLocale?: string): number {
  if (numbering === 'ISO_8601') return 1;
  if (numbering === 'MiddleEastern') return 6;
  if (numbering === 'WesternTraditional') return 0;
  try {
    const loc = new Intl.Locale(intlLocale ?? (typeof navigator === 'undefined' ? 'en-US' : navigator.language)) as Intl.Locale & { getWeekInfo?(): { firstDay: number }; weekInfo?: { firstDay: number } };
    const info = loc.getWeekInfo?.() ?? loc.weekInfo;
    if (info) return info.firstDay % 7;
  } catch { /* old engines */ }
  return 1;
}

const pad = (n: number) => String(n).padStart(2, '0');
export const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromIsoDay = (s: string) => { const [y, m, d] = s.slice(0, 10).split('-').map(Number) as [number, number, number]; return new Date(y, m - 1, d); };
export const asDate = (v: unknown): Date | undefined => (v instanceof Date ? v : typeof v === 'string' && v ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T00:00:00` : v) : undefined);
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

function periodStart(now: Date, unit: Unit, weekStart: number): Date {
  switch (unit) {
    case 'MINUTES': return new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes());
    case 'HOURS': return new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());
    case 'DAYS': return startOfDay(now);
    case 'WEEKS': return new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() - weekStart + 7) % 7));
    case 'MONTHS': return new Date(now.getFullYear(), now.getMonth(), 1);
    case 'QUARTERS': return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    default: return new Date(now.getFullYear(), 0, 1);
  }
}
function add(d: Date, unit: Unit, n: number): Date {
  switch (unit) {
    case 'MINUTES': return new Date(d.getTime() + n * 60_000);
    case 'HOURS': return new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours() + n, d.getMinutes());
    case 'DAYS': return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes());
    case 'WEEKS': return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7 * n);
    case 'MONTHS': return new Date(d.getFullYear(), d.getMonth() + n, 1);
    case 'QUARTERS': return new Date(d.getFullYear(), d.getMonth() + 3 * n, 1);
    default: return new Date(d.getFullYear() + n, 0, 1);
  }
}
const before = (d: Date) => new Date(d.getTime() - 1);

/**
 * The first and last moment of a standard value: start of the first day and end of the last day in local time
 * (minutes, hours and date-time options keep their time). FROM / TO / FROMDATETIME / TODATETIME give one date, as in UI5.
 */
export function standardToDates(value: DynamicDateRangeValue, numbering?: CalendarWeekNumbering | null, now: Date = new Date(), intlLocale?: string): Date[] {
  const v = value.values;
  const ws = weekStartOf(numbering, intlLocale);
  const op = value.operator;
  const d0 = asDate(v[0]);
  const d1 = asDate(v[1]);
  const fail = () => { throw new Error(`DynamicDateRange.toDates: cannot resolve ${op}`); };
  switch (op) {
    case 'DATE': return d0 ? [startOfDay(d0), endOfDay(d0)] : fail();
    case 'DATERANGE': return d0 && d1 ? [startOfDay(d0), endOfDay(d1)] : fail();
    case 'DATETIME': return d0 ? [d0, d0] : fail();
    case 'DATETIMERANGE': return d0 && d1 ? [d0, d1] : fail();
    case 'FROM': return d0 ? [startOfDay(d0)] : fail();
    case 'TO': return d0 ? [endOfDay(d0)] : fail();
    case 'FROMDATETIME': case 'TODATETIME': return d0 ? [d0] : fail();
    case 'SPECIFICMONTH': case 'SPECIFICMONTHINYEAR': {
      const y = op === 'SPECIFICMONTHINYEAR' ? Number(v[1]) : now.getFullYear();
      const m = Number(v[0]);
      return [new Date(y, m, 1), endOfDay(new Date(y, m + 1, 0))];
    }
    case 'TODAYFROMTO': return [startOfDay(add(now, 'DAYS', -Number(v[0] ?? 0))), endOfDay(add(now, 'DAYS', Number(v[1] ?? 0)))];
    case 'DATETOYEAR': return [startOfDay(now), endOfDay(new Date(now.getFullYear(), 11, 31))];
    case 'QUARTER1': case 'QUARTER2': case 'QUARTER3': case 'QUARTER4': {
      const q = Number(op.slice(-1)) - 1;
      return [new Date(now.getFullYear(), 3 * q, 1), endOfDay(new Date(now.getFullYear(), 3 * q + 3, 0))];
    }
    default: break;
  }
  const first = /^(FIRST|LAST)DAY(WEEK|MONTH|QUARTER|YEAR)$/.exec(op);
  if (first) {
    const unit = `${first[2]}S` as Unit;
    const start = periodStart(now, unit, ws);
    const day = first[1] === 'FIRST' ? start : before(add(start, unit, 1));
    return [startOfDay(day), endOfDay(day)];
  }
  const u = unitKey(op);
  if (u && !(u.unit === 'DAYS' && !u.included)) {
    const n = Number(v[0]);
    if (!Number.isInteger(n) || n < 0) fail();
    const start = periodStart(now, u.unit, ws);
    if (u.dir === 'LAST') return u.included ? [add(start, u.unit, -(n - 1)), before(add(start, u.unit, 1))] : [add(start, u.unit, -n), before(start)];
    return u.included ? [start, before(add(start, u.unit, n))] : [add(start, u.unit, 1), before(add(start, u.unit, n + 1))];
  }
  if ((RELATIVE_DATE_OPERATORS as readonly string[]).includes(op)) {
    const range = relativeDateRange(op as Operator, v[0], isoDay(now), ws);
    if (range) return [fromIsoDay(range[0]), endOfDay(fromIsoDay(range[1]))];
  }
  return fail();
}

export interface FormatContext {
  t: TextFn;
  intlLocale: string;
  formatter?: DynamicDateFormatter | null;
}

/** Options whose text the filter bar has as `dateRange.*` ("Today", "This week" …); the others use the `ctl.ddr.*` texts. */
const FILTER_TEXTS = new Set(['TODAY', 'YESTERDAY', 'TOMORROW', 'THISWEEK', 'LASTWEEK', 'NEXTWEEK', 'THISMONTH', 'LASTMONTH', 'NEXTMONTH', 'THISQUARTER', 'LASTQUARTER', 'NEXTQUARTER', 'THISYEAR', 'LASTYEAR', 'NEXTYEAR', 'YEARTODATE']);

/** The option text in the list ("Today", "Date Range", "Last X"). */
export function optionText(t: TextFn, key: string): string {
  if (FILTER_TEXTS.has(key)) return t(`dateRange.${key}` as MessageKey);
  return t(`ctl.ddr.${key}` as MessageKey);
}

export function formatDate(d: Date | undefined, ctx: FormatContext, withTime = false): string {
  if (!d) return '';
  if (ctx.formatter) return ctx.formatter.format(d);
  return new Intl.DateTimeFormat(ctx.intlLocale, withTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' }).format(d);
}

/** The text of a standard value ("Last 7 days", "Nov 3, 2026 – Nov 9, 2026", "From Nov 3, 2026"). */
export function formatStandard(value: DynamicDateRangeValue, ctx: FormatContext): string {
  const { t } = ctx;
  const op = value.operator;
  const d = (i: number, time = false) => formatDate(asDate(value.values[i]), ctx, time);
  const month = (m: number) => new Intl.DateTimeFormat(ctx.intlLocale, { month: 'long' }).format(new Date(2000, m, 1));
  switch (op) {
    case 'DATE': return d(0);
    case 'DATETIME': return d(0, true);
    case 'DATERANGE': return `${d(0)} – ${d(1)}`;
    case 'DATETIMERANGE': return `${d(0, true)} – ${d(1, true)}`;
    case 'FROM': return t('ctl.ddr.fromValue', { date: d(0) });
    case 'TO': return t('ctl.ddr.toValue', { date: d(0) });
    case 'FROMDATETIME': return t('ctl.ddr.fromValue', { date: d(0, true) });
    case 'TODATETIME': return t('ctl.ddr.toValue', { date: d(0, true) });
    case 'SPECIFICMONTH': return month(Number(value.values[0] ?? 0));
    case 'SPECIFICMONTHINYEAR': return `${month(Number(value.values[0] ?? 0))} ${value.values[1] ?? ''}`.trim();
    case 'TODAYFROMTO': return t('ctl.ddr.fmt.TODAYFROMTO', { before: Number(value.values[0] ?? 0), after: Number(value.values[1] ?? 0) });
    case 'LASTDAYS': case 'NEXTDAYS': return t(`dateRange.${op}` as MessageKey, { count: Number(value.values[0] ?? 0) });
    default:
      if (unitKey(op)) return t(`ctl.ddr.fmt.${op}` as MessageKey, { count: Number(value.values[0] ?? 0) });
      return optionText(t, op);
  }
}

/** Whether the field shows the resolved dates after the text (relative options). */
export function enhances(key: string): boolean {
  const k = kindOf(key);
  return k === 'none' || k === 'units' || k === 'todayfromto' || k === 'month' || k === 'monthinyear';
}

/** "Nov 3, 2026 – Nov 9, 2026" (one date when both are the same day; with time for minutes and hours). */
export function rangeText(dates: Date[], ctx: FormatContext, withTime = false): string {
  if (dates.length === 1) return formatDate(dates[0], ctx, withTime);
  const [a, b] = dates as [Date, Date];
  if (!withTime && isoDay(a) === isoDay(b)) return formatDate(a, ctx);
  return `${formatDate(a, ctx, withTime)} – ${formatDate(b, ctx, withTime)}`;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** A regular expression from a text template with `{name}` parameters (each becomes a number group). */
function templateRegex(t: TextFn, key: MessageKey, names: string[]): RegExp[] {
  return [1, 2, 5].map((n) => {
    const params = Object.fromEntries(names.map((name, i) => [name, 987650 + i]));
    if (names[0] === 'count') params.count = n === 1 ? 1 : n;
    let s = escape(t(key, params));
    names.forEach((name, i) => { s = s.replace(String(name === 'count' ? params.count : 987650 + i), '(\\d+)'); });
    return new RegExp(`^${s}$`, 'i');
  });
}

/** Reads a typed date (formatter, ISO or the browser's date parser). */
export function readDate(text: string, ctx: FormatContext): Date | undefined {
  const s = text.trim();
  if (!s) return undefined;
  if (ctx.formatter?.parse) return ctx.formatter.parse(s) ?? undefined;
  const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? fromIsoDay(s) : new Date(Date.parse(s));
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/** Reads typed text of a standard option; undefined when no option matches. */
export function parseStandard(text: string, keys: readonly string[], ctx: FormatContext): DynamicDateRangeValue | undefined {
  const { t } = ctx;
  const s = text.trim().replace(/\s*\([^)]*\)$/, '');
  const lower = s.toLowerCase();
  for (const k of keys) if (kindOf(k) === 'none' && optionText(t, k).toLowerCase() === lower) return { operator: k, values: [] };
  for (const k of keys) {
    if (kindOf(k) !== 'units' && k !== 'TODAYFROMTO') continue;
    const key = (k === 'LASTDAYS' || k === 'NEXTDAYS' ? `dateRange.${k}` : `ctl.ddr.fmt.${k}`) as MessageKey;
    for (const re of templateRegex(t, key, k === 'TODAYFROMTO' ? ['before', 'after'] : ['count'])) {
      const m = re.exec(s);
      if (m) return { operator: k, values: m.slice(1).map(Number) };
    }
  }
  const dateOnly = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate());
  for (const k of ['FROM', 'TO', 'FROMDATETIME', 'TODATETIME'] as const) {
    if (!keys.includes(k)) continue;
    const [pre, post] = t(k === 'FROM' || k === 'FROMDATETIME' ? 'ctl.ddr.fromValue' : 'ctl.ddr.toValue', { date: '\u0000' }).split('\u0000') as [string, string];
    if (lower.startsWith(pre.toLowerCase()) && lower.endsWith(post.toLowerCase())) {
      const d = readDate(s.slice(pre.length, s.length - post.length), ctx);
      if (d) return { operator: k, values: [k.endsWith('DATETIME') ? d : dateOnly(d)] };
    }
  }
  const parts = s.split(/\s+[–-]\s+/);
  if (parts.length === 2) {
    const [a, b] = parts.map((x) => readDate(x, ctx));
    if (a && b) {
      const timed = keys.includes('DATETIMERANGE') && /\d:\d/.test(s);
      if (timed || keys.includes('DATERANGE')) {
        const [x, y] = a <= b ? [a, b] : [b, a];
        return timed ? { operator: 'DATETIMERANGE', values: [x, y] } : { operator: 'DATERANGE', values: [dateOnly(x), dateOnly(y)] };
      }
    }
  }
  if (parts.length === 1) {
    const d = readDate(s, ctx);
    if (d && keys.includes('DATETIME') && /\d:\d/.test(s)) return { operator: 'DATETIME', values: [d] };
    if (d && keys.includes('DATE')) return { operator: 'DATE', values: [dateOnly(d)] };
  }
  return undefined;
}
