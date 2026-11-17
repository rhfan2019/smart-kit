/** Condition model and its translation to an OData $filter. See docs/05-data-provider.md §3. */
import type { EdmType } from '../model/types';
import { toLiteral } from '../query/literals';

/** Operators that compare with fixed values. */
export type ValueOperator =
  | 'EQ' | 'NE' | 'BT' | 'NB' | 'LT' | 'LE' | 'GT' | 'GE'
  | 'Contains' | 'NotContains' | 'StartsWith' | 'EndsWith' | 'Empty' | 'NotEmpty';

/**
 * Relative date operators (date and date-time properties), after SAPUI5's DynamicDateRange. A condition stores the
 * operator, not dates; `toFilter` and `matches` resolve it against the current date each time they run.
 * LASTDAYS / NEXTDAYS take a number of days and, as in SAPUI5, exclude today.
 */
export type RelativeDateOperator =
  | 'TODAY' | 'YESTERDAY' | 'TOMORROW' | 'LASTDAYS' | 'NEXTDAYS'
  | 'THISWEEK' | 'LASTWEEK' | 'NEXTWEEK' | 'THISMONTH' | 'LASTMONTH' | 'NEXTMONTH'
  | 'THISQUARTER' | 'LASTQUARTER' | 'NEXTQUARTER' | 'THISYEAR' | 'LASTYEAR' | 'NEXTYEAR' | 'YEARTODATE';

export type Operator = ValueOperator | RelativeDateOperator;

/** The value operators (relative date operators are in RELATIVE_DATE_OPERATORS). */
export const OPERATORS: readonly ValueOperator[] = ['EQ', 'NE', 'BT', 'NB', 'LT', 'LE', 'GT', 'GE', 'Contains', 'NotContains', 'StartsWith', 'EndsWith', 'Empty', 'NotEmpty'];

export const RELATIVE_DATE_OPERATORS: readonly RelativeDateOperator[] = [
  'TODAY', 'YESTERDAY', 'TOMORROW', 'LASTDAYS', 'NEXTDAYS', 'THISWEEK', 'LASTWEEK', 'NEXTWEEK', 'THISMONTH', 'LASTMONTH', 'NEXTMONTH',
  'THISQUARTER', 'LASTQUARTER', 'NEXTQUARTER', 'THISYEAR', 'LASTYEAR', 'NEXTYEAR', 'YEARTODATE',
];

export function isRelativeDateOperator(op: string): op is RelativeDateOperator {
  return (RELATIVE_DATE_OPERATORS as readonly string[]).includes(op);
}

/** Number of values each operator takes. */
export const OPERATOR_ARITY: Record<Operator, 0 | 1 | 2> = {
  EQ: 1, NE: 1, BT: 2, NB: 2, LT: 1, LE: 1, GT: 1, GE: 1,
  Contains: 1, NotContains: 1, StartsWith: 1, EndsWith: 1, Empty: 0, NotEmpty: 0,
  TODAY: 0, YESTERDAY: 0, TOMORROW: 0, LASTDAYS: 1, NEXTDAYS: 1,
  THISWEEK: 0, LASTWEEK: 0, NEXTWEEK: 0, THISMONTH: 0, LASTMONTH: 0, NEXTMONTH: 0,
  THISQUARTER: 0, LASTQUARTER: 0, NEXTQUARTER: 0, THISYEAR: 0, LASTYEAR: 0, NEXTYEAR: 0, YEARTODATE: 0,
};

export interface Condition {
  operator: Operator;
  values: unknown[];
  exclude?: boolean;
  /** Display text only (e.g. description of a value help selection). */
  text?: string;
}

/** Conditions per property path. */
export type FilterState = Record<string, Condition[]>;

/** Type information needed to build literals. */
export type TypeLookup = (path: string) => EdmType | undefined;

/** Options for date filtering. */
export interface FilterOptions {
  /** IANA time zone used to turn a calendar day into a DateTimeOffset range and to find today. Defaults to UTC. */
  timeZone?: string;
  /** Today (YYYY-MM-DD) for relative date operators; default: the current date in `timeZone`. */
  today?: string;
  /** First day of the week for THISWEEK / LASTWEEK / NEXTWEEK: 0 Sunday … 6 Saturday; default 1 (Monday, ISO 8601). */
  weekStartsOn?: number;
}

const STRING_FUNCTIONS: Partial<Record<Operator, string>> = { Contains: 'contains', NotContains: 'contains', StartsWith: 'startswith', EndsWith: 'endswith' };

/** Offset in minutes of `timeZone` at the given UTC instant. */
function tzOffsetMinutes(utc: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(utc);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return Math.round((asUtc - utc.getTime()) / 60000);
}

/** Start of the calendar day `date` (YYYY-MM-DD) in `timeZone`, as an ISO string with offset. */
export function startOfDayIso(date: string, timeZone = 'UTC'): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  let guess = new Date(Date.UTC(y, m - 1, d));
  // Two iterations are enough to settle on DST boundaries.
  for (let i = 0; i < 2; i++) guess = new Date(Date.UTC(y, m - 1, d) - tzOffsetMinutes(guess, timeZone) * 60000);
  const off = tzOffsetMinutes(guess, timeZone);
  const sign = off >= 0 ? '+' : '-';
  const abs = Math.abs(off);
  const local = new Date(guess.getTime() + off * 60000).toISOString().slice(0, 19);
  return `${local}${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
}

function nextDay(date: string): string {
  return addDays(date, 1);
}

const ymd = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);

function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return ymd(y, m - 1, d + n);
}

/** The current calendar day (YYYY-MM-DD) in `timeZone` (default UTC). */
export function todayIn(timeZone = 'UTC', now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Whole number of days for LASTDAYS / NEXTDAYS, or undefined when the value is not one. */
function dayCount(v: unknown): number | undefined {
  const n = typeof v === 'number' ? v : typeof v === 'string' && /^\s*\d+\s*$/.test(v) ? Number(v) : NaN;
  return Number.isInteger(n) && n >= 1 ? n : undefined;
}

/**
 * The calendar days [from, to] (YYYY-MM-DD, both included) of a relative date operator on `today`, or undefined
 * for other operators or an invalid number of days.
 */
export function relativeDateRange(operator: Operator, value: unknown, today: string, weekStartsOn = 1): [string, string] | undefined {
  const [y, m, d] = today.split('-').map(Number) as [number, number, number];
  const month = (k: number): [string, string] => [ymd(y, m - 1 + k, 1), ymd(y, m + k, 0)];
  const q = Math.floor((m - 1) / 3) * 3;
  const quarter = (k: number): [string, string] => [ymd(y, q + 3 * k, 1), ymd(y, q + 3 * k + 3, 0)];
  const year = (k: number): [string, string] => [ymd(y + k, 0, 1), ymd(y + k, 11, 31)];
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const weekStart = addDays(today, -((dow - weekStartsOn + 7) % 7));
  const week = (k: number): [string, string] => [addDays(weekStart, 7 * k), addDays(weekStart, 7 * k + 6)];
  switch (operator) {
    case 'TODAY': return [today, today];
    case 'YESTERDAY': { const x = addDays(today, -1); return [x, x]; }
    case 'TOMORROW': { const x = addDays(today, 1); return [x, x]; }
    case 'LASTDAYS': { const n = dayCount(value); return n === undefined ? undefined : [addDays(today, -n), addDays(today, -1)]; }
    case 'NEXTDAYS': { const n = dayCount(value); return n === undefined ? undefined : [addDays(today, 1), addDays(today, n)]; }
    case 'THISWEEK': return week(0);
    case 'LASTWEEK': return week(-1);
    case 'NEXTWEEK': return week(1);
    case 'THISMONTH': return month(0);
    case 'LASTMONTH': return month(-1);
    case 'NEXTMONTH': return month(1);
    case 'THISQUARTER': return quarter(0);
    case 'LASTQUARTER': return quarter(-1);
    case 'NEXTQUARTER': return quarter(1);
    case 'THISYEAR': return year(0);
    case 'LASTYEAR': return year(-1);
    case 'NEXTYEAR': return year(1);
    case 'YEARTODATE': return [ymd(y, 0, 1), today];
    default: return undefined;
  }
}

/**
 * Replaces a relative date condition by the fixed one it means today ("EQ" for one day, "BT" otherwise, keeping
 * `exclude`); other conditions are returned as they are. Undefined when a relative condition cannot be resolved.
 */
export function resolveCondition(c: Condition, opts: FilterOptions = {}): Condition | undefined {
  if (!isRelativeDateOperator(c.operator)) return c;
  const range = relativeDateRange(c.operator, c.values[0], opts.today ?? todayIn(opts.timeZone), opts.weekStartsOn);
  if (!range) return undefined;
  const fixed: Condition = range[0] === range[1] ? { operator: 'EQ', values: [range[0]] } : { operator: 'BT', values: range };
  return c.exclude ? { ...fixed, exclude: true } : fixed;
}

function resolveAll(conditions: Condition[], opts: FilterOptions): Condition[] {
  const complete = conditions.filter(isComplete);
  if (!complete.some((c) => isRelativeDateOperator(c.operator))) return complete;
  const resolved = { ...opts, today: opts.today ?? todayIn(opts.timeZone) };
  return complete.map((c) => resolveCondition(c, resolved)).filter((c): c is Condition => c !== undefined);
}

const isDateOnly = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

function single(path: string, c: Condition, type: EdmType, opts: FilterOptions): string {
  const lit = (v: unknown) => toLiteral(v, type);
  const [a, b] = c.values;
  // Calendar-day filtering on DateTimeOffset properties: [start of day, start of next day).
  if (type === 'Edm.DateTimeOffset' && c.values.every(isDateOnly)) {
    const tz = opts.timeZone ?? 'UTC';
    const from = (d: unknown) => startOfDayIso(d as string, tz);
    const to = (d: unknown) => startOfDayIso(nextDay(d as string), tz);
    switch (c.operator) {
      case 'EQ': return `(${path} ge ${from(a)} and ${path} lt ${to(a)})`;
      case 'NE': return `not (${path} ge ${from(a)} and ${path} lt ${to(a)})`;
      case 'BT': return `(${path} ge ${from(a)} and ${path} lt ${to(b)})`;
      case 'NB': return `not (${path} ge ${from(a)} and ${path} lt ${to(b)})`;
      case 'LT': return `${path} lt ${from(a)}`;
      case 'LE': return `${path} lt ${to(a)}`;
      case 'GT': return `${path} ge ${to(a)}`;
      case 'GE': return `${path} ge ${from(a)}`;
      default: break;
    }
  }
  switch (c.operator) {
    case 'EQ': return `${path} eq ${lit(a)}`;
    case 'NE': return `${path} ne ${lit(a)}`;
    case 'LT': return `${path} lt ${lit(a)}`;
    case 'LE': return `${path} le ${lit(a)}`;
    case 'GT': return `${path} gt ${lit(a)}`;
    case 'GE': return `${path} ge ${lit(a)}`;
    case 'BT': return `(${path} ge ${lit(a)} and ${path} le ${lit(b)})`;
    case 'NB': return `not (${path} ge ${lit(a)} and ${path} le ${lit(b)})`;
    case 'Contains': case 'StartsWith': case 'EndsWith':
      return `${STRING_FUNCTIONS[c.operator]}(${path},${toLiteral(a, 'Edm.String')})`;
    case 'NotContains':
      return `not contains(${path},${toLiteral(a, 'Edm.String')})`;
    case 'Empty':
      return type === 'Edm.String' ? `(${path} eq null or ${path} eq '')` : `${path} eq null`;
    case 'NotEmpty':
      return type === 'Edm.String' ? `(${path} ne null and ${path} ne '')` : `${path} ne null`;
    default:
      throw new Error(`Unresolved relative date condition ${c.operator}`);
  }
}

/** Whether a condition has all the values its operator needs. */
export function isComplete(c: Condition): boolean {
  const n = OPERATOR_ARITY[c.operator];
  if (n === undefined) return false;
  if (c.operator === 'LASTDAYS' || c.operator === 'NEXTDAYS') return dayCount(c.values[0]) !== undefined;
  return c.values.length >= n && c.values.slice(0, n).every((v) => v !== undefined && v !== null && v !== '');
}

/**
 * Builds the $filter expression for one property. Returns undefined when there is nothing to filter. Relative date
 * conditions are resolved against `opts.today` (default: the current date in `opts.timeZone`).
 */
export function propertyFilter(path: string, conditions: Condition[], type: EdmType, opts: FilterOptions = {}): string | undefined {
  const complete = resolveAll(conditions, opts);
  const include = complete.filter((c) => !c.exclude).map((c) => single(path, c, type, opts));
  const exclude = complete.filter((c) => c.exclude).map((c) => `not (${single(path, c, type, opts)})`);
  const parts: string[] = [];
  if (include.length === 1) parts.push(include[0]!);
  else if (include.length > 1) parts.push(`(${include.join(' or ')})`);
  parts.push(...exclude);
  if (!parts.length) return undefined;
  return parts.length === 1 ? parts[0] : parts.join(' and ');
}

/** Builds the complete $filter. Properties are combined with "and"; "or" groups are already parenthesized. */
export function toFilter(state: FilterState, typeOf: TypeLookup, opts: FilterOptions = {}): string | undefined {
  const parts: string[] = [];
  for (const [path, conditions] of Object.entries(state)) {
    const type = typeOf(path);
    if (!type) continue;
    const f = propertyFilter(path, conditions, type, opts);
    if (f) parts.push(f);
  }
  return parts.length ? parts.join(' and ') : undefined;
}

/** Counts properties that carry at least one complete condition (for "Adapt Filters (n)" and the summary). */
export function activeFilterPaths(state: FilterState): string[] {
  return Object.entries(state).filter(([, cs]) => cs.some(isComplete)).map(([p]) => p);
}

/** Evaluates conditions against a value in memory (used by the in-memory provider). Relative dates resolve as in `toFilter`. */
export function matches(value: unknown, conditions: Condition[], type: EdmType, opts: FilterOptions = {}): boolean {
  const complete = resolveAll(conditions, opts);
  const include = complete.filter((c) => !c.exclude);
  const exclude = complete.filter((c) => c.exclude);
  const test = (c: Condition) => evalCondition(value, c, type);
  return (include.length === 0 || include.some(test)) && !exclude.some(test);
}

const NUMERIC = /^Edm\.(Byte|SByte|Int16|Int32|Int64|Decimal|Double|Single)$/;

/** Compares two values of an Edm type. Decimal strings are compared exactly. */
export function compareValues(a: unknown, b: unknown, type: EdmType): number {
  if (a === null || a === undefined) return b === null || b === undefined ? 0 : -1;
  if (b === null || b === undefined) return 1;
  if (NUMERIC.test(type)) return compareDecimal(String(a), String(b));
  if (type === 'Edm.Boolean') return Number(a === true || a === 'true') - Number(b === true || b === 'true');
  if (type === 'Edm.DateTimeOffset') return Date.parse(String(a)) - Date.parse(String(b));
  const sa = String(a);
  const sb = String(b);
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}

/** Exact comparison of two decimal strings. */
export function compareDecimal(a: string, b: string): number {
  const parse = (s: string) => {
    const neg = s.trim().startsWith('-');
    const [i = '0', f = ''] = s.trim().replace(/^[-+]/, '').split('.');
    return { neg, i: i.replace(/^0+(?=\d)/, ''), f: f.replace(/0+$/, '') };
  };
  const x = parse(a);
  const y = parse(b);
  const zero = (n: { i: string; f: string }) => /^0*$/.test(n.i) && n.f === '';
  if (zero(x) && zero(y)) return 0;
  if (x.neg !== y.neg) return x.neg ? -1 : 1;
  const mag = () => {
    if (x.i.length !== y.i.length) return x.i.length - y.i.length;
    if (x.i !== y.i) return x.i < y.i ? -1 : 1;
    const len = Math.max(x.f.length, y.f.length);
    const fx = x.f.padEnd(len, '0');
    const fy = y.f.padEnd(len, '0');
    return fx === fy ? 0 : fx < fy ? -1 : 1;
  };
  const m = Math.sign(mag());
  if (m === 0) return 0;
  return x.neg ? -m : m;
}

function evalCondition(value: unknown, c: Condition, type: EdmType): boolean {
  const [a, b] = c.values;
  if (type === 'Edm.DateTimeOffset' && typeof value === 'string' && c.values.every(isDateOnly)) {
    value = value.slice(0, 10); // memory provider compares calendar days in UTC
    type = 'Edm.Date';
  }
  const cmp = (x: unknown) => compareValues(value, x, type);
  // OData string functions are case-sensitive.
  const s = value === null || value === undefined ? '' : String(value);
  switch (c.operator) {
    case 'EQ': return cmp(a) === 0;
    case 'NE': return cmp(a) !== 0;
    case 'LT': return value != null && cmp(a) < 0;
    case 'LE': return value != null && cmp(a) <= 0;
    case 'GT': return value != null && cmp(a) > 0;
    case 'GE': return value != null && cmp(a) >= 0;
    case 'BT': return value != null && cmp(a) >= 0 && cmp(b) <= 0;
    case 'NB': return !(value != null && cmp(a) >= 0 && cmp(b) <= 0);
    case 'Contains': return s.includes(String(a));
    case 'NotContains': return !s.includes(String(a));
    case 'StartsWith': return s.startsWith(String(a));
    case 'EndsWith': return s.endsWith(String(a));
    case 'Empty': return value === null || value === undefined || value === '';
    case 'NotEmpty': return !(value === null || value === undefined || value === '');
    default: return false;
  }
}
