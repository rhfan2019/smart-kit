/** Condition model and its translation to an OData $filter. See docs/05-data-provider.md §3. */
import type { EdmType } from '../model/types';
import { toLiteral } from '../query/literals';

/** Operators that compare with fixed values. */
export type ValueOperator =
  | 'EQ' | 'NE' | 'BT' | 'NB' | 'LT' | 'LE' | 'GT' | 'GE'
  | 'Contains' | 'NotContains' | 'StartsWith' | 'EndsWith' | 'Empty' | 'NotEmpty';

/**
 * Relative and semantic date operators (date and date-time properties), as the operators of sap.ui.mdc
 * FilterOperatorUtil and the semantic date operators of sap.fe.macros.filterBar (DefaultSemanticDateOperators,
 * ExtendedSemanticDateOperators) in SAPUI5 1.154. A condition stores the operator, not dates; `toFilter` and
 * `matches` resolve it against the current date each time they run.
 * - DATE, FROM, TO, DATERANGE take dates; LAST/NEXT…S (and …INCLUDED) a count; TODAYFROMTO two counts (days before,
 *   days after); SPECIFICMONTH a month index (0–11); SPECIFICMONTHINYEAR a month index and a year.
 * - LASTDAYS / NEXTDAYS (and weeks, months …) exclude the current period, the …INCLUDED variants include it.
 * - FROM<op> / TO<op> (e.g. FROMTODAY, TOLASTDAYMONTH) are from / up to the day of a fixed single-day operator.
 */
export type RelativeDateOperator =
  | 'TODAY' | 'YESTERDAY' | 'TOMORROW'
  | 'FIRSTDAYWEEK' | 'LASTDAYWEEK' | 'FIRSTDAYMONTH' | 'LASTDAYMONTH' | 'FIRSTDAYQUARTER' | 'LASTDAYQUARTER' | 'FIRSTDAYYEAR' | 'LASTDAYYEAR'
  | 'DATE' | 'FROM' | 'TO' | 'DATERANGE' | 'TODAYFROMTO' | 'SPECIFICMONTH' | 'SPECIFICMONTHINYEAR'
  | 'LASTDAYS' | 'LASTDAYSINCLUDED' | 'NEXTDAYS' | 'NEXTDAYSINCLUDED'
  | 'LASTWEEKS' | 'LASTWEEKSINCLUDED' | 'NEXTWEEKS' | 'NEXTWEEKSINCLUDED'
  | 'LASTMONTHS' | 'LASTMONTHSINCLUDED' | 'NEXTMONTHS' | 'NEXTMONTHSINCLUDED'
  | 'LASTQUARTERS' | 'LASTQUARTERSINCLUDED' | 'NEXTQUARTERS' | 'NEXTQUARTERSINCLUDED'
  | 'LASTYEARS' | 'LASTYEARSINCLUDED' | 'NEXTYEARS' | 'NEXTYEARSINCLUDED'
  | 'THISWEEK' | 'LASTWEEK' | 'NEXTWEEK' | 'THISMONTH' | 'LASTMONTH' | 'NEXTMONTH'
  | 'THISQUARTER' | 'LASTQUARTER' | 'NEXTQUARTER' | 'QUARTER1' | 'QUARTER2' | 'QUARTER3' | 'QUARTER4'
  | 'THISYEAR' | 'LASTYEAR' | 'NEXTYEAR' | 'YEARTODATE' | 'DATETOYEAR'
  | `FROM${FixedDayOperator}` | `TO${FixedDayOperator}`;

/** The fixed single-day operators (DefaultSemanticDateOperators getFixedDateSingleValueOperations). */
export type FixedDayOperator =
  | 'YESTERDAY' | 'TODAY' | 'TOMORROW' | 'FIRSTDAYWEEK' | 'LASTDAYWEEK' | 'FIRSTDAYMONTH' | 'LASTDAYMONTH'
  | 'FIRSTDAYQUARTER' | 'LASTDAYQUARTER' | 'FIRSTDAYYEAR' | 'LASTDAYYEAR';

export const FIXED_DAY_OPERATORS: readonly FixedDayOperator[] = [
  'YESTERDAY', 'TODAY', 'TOMORROW', 'FIRSTDAYWEEK', 'LASTDAYWEEK', 'FIRSTDAYMONTH', 'LASTDAYMONTH', 'FIRSTDAYQUARTER', 'LASTDAYQUARTER', 'FIRSTDAYYEAR', 'LASTDAYYEAR',
];

export type Operator = ValueOperator | RelativeDateOperator;

/** The value operators (relative date operators are in RELATIVE_DATE_OPERATORS). */
export const OPERATORS: readonly ValueOperator[] = ['EQ', 'NE', 'BT', 'NB', 'LT', 'LE', 'GT', 'GE', 'Contains', 'NotContains', 'StartsWith', 'EndsWith', 'Empty', 'NotEmpty'];

const UNITS = ['DAYS', 'WEEKS', 'MONTHS', 'QUARTERS', 'YEARS'] as const;
type Unit = (typeof UNITS)[number];
/** LAST/NEXT <unit> [INCLUDED], in the sap.ui.mdc order (days, weeks, months, quarters, years). */
export const COUNT_DATE_OPERATORS: readonly RelativeDateOperator[] = UNITS.flatMap((u) =>
  [`LAST${u}`, `LAST${u}INCLUDED`, `NEXT${u}`, `NEXT${u}INCLUDED`] as RelativeDateOperator[]);

/**
 * All relative and semantic date operators: the sap.ui.mdc date operators first (FilterOperatorUtil, BaseType Date),
 * then the semantic ones of FE (DATE, FROM, TO, DATERANGE) and the extended FROM<op> / TO<op>.
 */
export const RELATIVE_DATE_OPERATORS: readonly RelativeDateOperator[] = [
  'TODAY', 'YESTERDAY', 'TOMORROW', 'FIRSTDAYWEEK', 'LASTDAYWEEK', 'FIRSTDAYMONTH', 'LASTDAYMONTH', 'FIRSTDAYQUARTER', 'LASTDAYQUARTER',
  'FIRSTDAYYEAR', 'LASTDAYYEAR', 'TODAYFROMTO', 'LASTDAYS', 'LASTDAYSINCLUDED', 'NEXTDAYS', 'NEXTDAYSINCLUDED',
  'THISWEEK', 'LASTWEEK', 'LASTWEEKS', 'LASTWEEKSINCLUDED', 'NEXTWEEK', 'NEXTWEEKS', 'NEXTWEEKSINCLUDED',
  'SPECIFICMONTH', 'SPECIFICMONTHINYEAR', 'THISMONTH', 'LASTMONTH', 'LASTMONTHS', 'LASTMONTHSINCLUDED', 'NEXTMONTH', 'NEXTMONTHS', 'NEXTMONTHSINCLUDED',
  'THISQUARTER', 'LASTQUARTER', 'LASTQUARTERS', 'LASTQUARTERSINCLUDED', 'NEXTQUARTER', 'NEXTQUARTERS', 'NEXTQUARTERSINCLUDED',
  'QUARTER1', 'QUARTER2', 'QUARTER3', 'QUARTER4', 'THISYEAR', 'LASTYEAR', 'LASTYEARS', 'LASTYEARSINCLUDED', 'NEXTYEAR', 'NEXTYEARS', 'NEXTYEARSINCLUDED',
  'YEARTODATE', 'DATETOYEAR', 'DATE', 'FROM', 'TO', 'DATERANGE',
  ...FIXED_DAY_OPERATORS.map((o) => `FROM${o}` as RelativeDateOperator), ...FIXED_DAY_OPERATORS.map((o) => `TO${o}` as RelativeDateOperator),
];

/** The mdc date operators (FilterOperatorUtil for Edm.Date without FE's semantic date range: no DATE, FROM, TO, DATERANGE, FROM<op>, TO<op>). */
export const MDC_DATE_OPERATORS: readonly RelativeDateOperator[] = RELATIVE_DATE_OPERATORS.slice(0, RELATIVE_DATE_OPERATORS.indexOf('DATE'));

export function isRelativeDateOperator(op: string): op is RelativeDateOperator {
  return (RELATIVE_DATE_OPERATORS as readonly string[]).includes(op);
}

/** The value types of a relative date operator: dates, counts ("int"), a month index or a year. */
export function relativeDateValueTypes(op: RelativeDateOperator): ('date' | 'int' | 'month' | 'year')[] {
  if (op === 'DATE' || op === 'FROM' || op === 'TO') return ['date'];
  if (op === 'DATERANGE') return ['date', 'date'];
  if (op === 'TODAYFROMTO') return ['int', 'int'];
  if (op === 'SPECIFICMONTH') return ['month'];
  if (op === 'SPECIFICMONTHINYEAR') return ['month', 'year'];
  if ((COUNT_DATE_OPERATORS as readonly string[]).includes(op)) return ['int'];
  return [];
}

const arityOf = (op: Operator): 0 | 1 | 2 => {
  if (!isRelativeDateOperator(op)) return ({ BT: 2, NB: 2, Empty: 0, NotEmpty: 0 } as Partial<Record<Operator, 0 | 1 | 2>>)[op] ?? 1;
  return relativeDateValueTypes(op).length as 0 | 1 | 2;
};

/** Number of values each operator takes. */
export const OPERATOR_ARITY: Record<Operator, 0 | 1 | 2> = Object.fromEntries(
  [...OPERATORS, ...RELATIVE_DATE_OPERATORS].map((o) => [o, arityOf(o)]),
) as Record<Operator, 0 | 1 | 2>;

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

let defaultWeekStart = 1;
/**
 * The first day of the week used when FilterOptions.weekStartsOn is not given (0 Sunday … 6 Saturday; initially 1,
 * ISO 8601). The React provider sets it from the locale, as SAPUI5 takes the week from the locale (en-US: Sunday).
 */
export function setDefaultWeekStart(day: number): void {
  if (Number.isInteger(day) && day >= 0 && day <= 6) defaultWeekStart = day;
}

/** Options for date filtering. */
export interface FilterOptions {
  /** IANA time zone used to turn a calendar day into a DateTimeOffset range and to find today. Defaults to UTC. */
  timeZone?: string;
  /** Today (YYYY-MM-DD) for relative date operators; default: the current date in `timeZone`. */
  today?: string;
  /** First day of the week for week operators: 0 Sunday … 6 Saturday; default `setDefaultWeekStart` (initially 1, Monday). */
  weekStartsOn?: number;
  /**
   * String conditions are case-insensitive: `tolower(Path) eq tolower('x')`, as the SAPUI5 V4 model writes filters
   * with `caseSensitive: false` (FE when Capabilities.FilterFunctions contains "tolower", ModelHelper isFilteringCaseSensitive).
   */
  caseInsensitive?: boolean;
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

/** A whole number ≥ `min`, or undefined. */
function wholeNumber(v: unknown, min: number): number | undefined {
  const n = typeof v === 'number' ? v : typeof v === 'string' && /^\s*-?\d+\s*$/.test(v) ? Number(v) : NaN;
  return Number.isInteger(n) && n >= min ? n : undefined;
}

const isDay = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v);

/** Whether the values of a relative date condition are complete. */
function relativeComplete(op: RelativeDateOperator, values: unknown[]): boolean {
  return relativeDateValueTypes(op).every((t, i) => {
    const v = values[i];
    if (t === 'date') return isDay(v);
    if (t === 'month') return wholeNumber(v, 0) !== undefined && Number(v) <= 11;
    if (t === 'year') return wholeNumber(v, 1) !== undefined;
    // counts: LAST/NEXT… need at least 1, TODAYFROMTO takes 0 (only today)
    return wholeNumber(v, op === 'TODAYFROMTO' ? 0 : 1) !== undefined;
  });
}

/**
 * The calendar days [from, to] (YYYY-MM-DD, both included) of a relative date operator on `today` (sap.ui.core.date
 * UniversalDateUtils ranges), or undefined for other operators or incomplete values. FROM, TO, FROM<op> and TO<op>
 * give the one day they start or end at (both entries the same); `resolveCondition` turns them into GE / LE.
 */
export function relativeDateRange(operator: Operator, value: unknown, today: string, weekStartsOn = defaultWeekStart, value2?: unknown): [string, string] | undefined {
  if (!isRelativeDateOperator(operator) || !relativeComplete(operator, [value, value2])) return undefined;
  const [y, m, d] = today.split('-').map(Number) as [number, number, number];
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const weekStart = addDays(today, -((dow - weekStartsOn + 7) % 7));
  const q = Math.floor((m - 1) / 3) * 3;
  // first day of the period containing today, shifted by k periods; the period's last day
  const start = (u: Unit, k: number): string => {
    switch (u) {
      case 'DAYS': return addDays(today, k);
      case 'WEEKS': return addDays(weekStart, 7 * k);
      case 'MONTHS': return ymd(y, m - 1 + k, 1);
      case 'QUARTERS': return ymd(y, q + 3 * k, 1);
      default: return ymd(y + k, 0, 1);
    }
  };
  const end = (u: Unit, k: number): string => addDays(start(u, k + 1), -1);
  const period = (u: Unit, k: number): [string, string] => [start(u, k), end(u, k)];
  const day = (x: string): [string, string] => [x, x];
  const n = Number(value);
  const date = (v: unknown) => String(v).slice(0, 10);
  const fixedDay = (op: string): string | undefined => {
    switch (op) {
      case 'TODAY': return today;
      case 'YESTERDAY': return addDays(today, -1);
      case 'TOMORROW': return addDays(today, 1);
      case 'FIRSTDAYWEEK': return start('WEEKS', 0);
      case 'LASTDAYWEEK': return end('WEEKS', 0);
      case 'FIRSTDAYMONTH': return start('MONTHS', 0);
      case 'LASTDAYMONTH': return end('MONTHS', 0);
      case 'FIRSTDAYQUARTER': return start('QUARTERS', 0);
      case 'LASTDAYQUARTER': return end('QUARTERS', 0);
      case 'FIRSTDAYYEAR': return start('YEARS', 0);
      case 'LASTDAYYEAR': return end('YEARS', 0);
      default: return undefined;
    }
  };
  const fixed = fixedDay(operator);
  if (fixed) return day(fixed);
  switch (operator) {
    case 'DATE': case 'FROM': case 'TO': return day(date(value));
    case 'DATERANGE': return date(value) <= date(value2) ? [date(value), date(value2)] : [date(value2), date(value)];
    case 'TODAYFROMTO': return [addDays(today, -n), addDays(today, Number(value2))];
    case 'SPECIFICMONTH': return [ymd(y, n, 1), ymd(y, n + 1, 0)];
    case 'SPECIFICMONTHINYEAR': return [ymd(Number(value2), n, 1), ymd(Number(value2), n + 1, 0)];
    case 'THISWEEK': return period('WEEKS', 0);
    case 'LASTWEEK': return period('WEEKS', -1);
    case 'NEXTWEEK': return period('WEEKS', 1);
    case 'THISMONTH': return period('MONTHS', 0);
    case 'LASTMONTH': return period('MONTHS', -1);
    case 'NEXTMONTH': return period('MONTHS', 1);
    case 'THISQUARTER': return period('QUARTERS', 0);
    case 'LASTQUARTER': return period('QUARTERS', -1);
    case 'NEXTQUARTER': return period('QUARTERS', 1);
    case 'QUARTER1': case 'QUARTER2': case 'QUARTER3': case 'QUARTER4': {
      const k = Number(operator.slice(-1)) - 1;
      return [ymd(y, 3 * k, 1), ymd(y, 3 * k + 3, 0)];
    }
    case 'THISYEAR': return period('YEARS', 0);
    case 'LASTYEAR': return period('YEARS', -1);
    case 'NEXTYEAR': return period('YEARS', 1);
    case 'YEARTODATE': return [start('YEARS', 0), today];
    case 'DATETOYEAR': return [today, end('YEARS', 0)];
    default: break;
  }
  const extended = /^(FROM|TO)(.+)$/.exec(operator);
  if (extended) {
    const x = fixedDay(extended[2]!);
    return x ? day(x) : undefined;
  }
  const counted = /^(LAST|NEXT)(DAYS|WEEKS|MONTHS|QUARTERS|YEARS)(INCLUDED)?$/.exec(operator);
  if (counted) {
    const u = counted[2] as Unit;
    const included = Boolean(counted[3]);
    if (counted[1] === 'LAST') return included ? [start(u, -(n - 1)), end(u, 0)] : [start(u, -n), end(u, -1)];
    return included ? [start(u, 0), end(u, n - 1)] : [start(u, 1), end(u, n)];
  }
  return undefined;
}

/**
 * Replaces a relative date condition by the fixed one it means today, keeping `exclude`; other conditions are returned
 * as they are. Undefined when a relative condition cannot be resolved. As in FE: DATE → EQ, FROM / FROM<op> → GE,
 * TO / TO<op> → LE, every other operator (a sap.ui.mdc RangeOperator, also a single day like TODAY) → BT.
 */
export function resolveCondition(c: Condition, opts: FilterOptions = {}): Condition | undefined {
  if (!isRelativeDateOperator(c.operator)) return c;
  const range = relativeDateRange(c.operator, c.values[0], opts.today ?? todayIn(opts.timeZone), opts.weekStartsOn, c.values[1]);
  if (!range) return undefined;
  const op: string = c.operator;
  const fixed: Condition =
    op === 'DATE' ? { operator: 'EQ', values: [range[0]] }
      : op.startsWith('FROM') ? { operator: 'GE', values: [range[0]] }
        : op.startsWith('TO') && op !== 'TODAY' && op !== 'TOMORROW' && op !== 'TODAYFROMTO' ? { operator: 'LE', values: [range[1]] }
          : { operator: 'BT', values: range };
  return c.exclude ? { ...fixed, exclude: true } : fixed;
}

function resolveAll(conditions: Condition[], opts: FilterOptions): Condition[] {
  const complete = conditions.filter(isComplete);
  if (!complete.some((c) => isRelativeDateOperator(c.operator))) return complete;
  const resolved = { ...opts, today: opts.today ?? todayIn(opts.timeZone) };
  return complete.map((c) => resolveCondition(c, resolved)).filter((c): c is Condition => c !== undefined);
}

const isDateOnly = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

// The SAPUI5 V4 model writes BT as "p ge a and p le b" without parentheses (ODataListBinding fetchFilter: "and"
// binds tighter than "or", an OR group of conditions is parenthesized as a whole).
function single(rawPath: string, c: Condition, type: EdmType, opts: FilterOptions): string {
  // Capabilities.FilterFunctions tolower: tolower() around path and value of string conditions (V4 caseSensitive false)
  const lower = Boolean(opts.caseInsensitive) && type === 'Edm.String';
  const path = lower ? `tolower(${rawPath})` : rawPath;
  const lit = (v: unknown) => (lower ? `tolower(${toLiteral(v, type)})` : toLiteral(v, type));
  const slit = (v: unknown) => (lower ? `tolower(${toLiteral(v, 'Edm.String')})` : toLiteral(v, 'Edm.String'));
  const [a, b] = c.values;
  // Calendar-day filtering on DateTimeOffset properties: [start of day, start of next day).
  if (type === 'Edm.DateTimeOffset' && c.values.every(isDateOnly)) {
    const tz = opts.timeZone ?? 'UTC';
    const from = (d: unknown) => startOfDayIso(d as string, tz);
    const to = (d: unknown) => startOfDayIso(nextDay(d as string), tz);
    switch (c.operator) {
      case 'EQ': return `${path} ge ${from(a)} and ${path} lt ${to(a)}`;
      case 'NE': return `not (${path} ge ${from(a)} and ${path} lt ${to(a)})`;
      case 'BT': return `${path} ge ${from(a)} and ${path} lt ${to(b)}`;
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
    case 'BT': return `${path} ge ${lit(a)} and ${path} le ${lit(b)}`;
    case 'NB': return `not (${path} ge ${lit(a)} and ${path} le ${lit(b)})`;
    case 'Contains': case 'StartsWith': case 'EndsWith':
      return `${STRING_FUNCTIONS[c.operator]}(${path},${slit(a)})`;
    case 'NotContains':
      return `not contains(${path},${slit(a)})`;
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
  if (isRelativeDateOperator(c.operator)) return relativeComplete(c.operator, c.values);
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
  const lower = Boolean(opts.caseInsensitive) && type === 'Edm.String';
  const low = (v: unknown) => (lower && typeof v === 'string' ? v.toLowerCase() : v);
  const test = (c: Condition) => evalCondition(low(value), lower ? { ...c, values: c.values.map(low) } : c, type);
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
