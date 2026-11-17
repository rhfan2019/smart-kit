/** S6 (TECH-059): relative date conditions are stored as operators and resolved when the filter is built. */
import { describe, expect, it } from 'vitest';
import {
  arrangeText, conditionAllowed, filterExpressionRules, isComplete, matches, relativeDateRange, resolveCondition, todayIn, toFilter,
  type Condition, type EdmType,
} from '../src';

const today = '2026-11-17'; // a Tuesday in Q4
const range = (op: Condition['operator'], v?: unknown, weekStartsOn?: number) => relativeDateRange(op, v, today, weekStartsOn);

describe('relative dates (S6)', () => {
  it('resolves each operator to calendar days', () => {
    expect(range('TODAY')).toEqual([today, today]);
    expect(range('YESTERDAY')).toEqual(['2026-11-16', '2026-11-16']);
    expect(range('TOMORROW')).toEqual(['2026-11-18', '2026-11-18']);
    expect(range('LASTDAYS', 7)).toEqual(['2026-11-10', '2026-11-16']);
    expect(range('NEXTDAYS', '3')).toEqual(['2026-11-18', '2026-11-20']);
    expect(range('THISWEEK')).toEqual(['2026-11-16', '2026-11-22']);
    expect(range('THISWEEK', undefined, 0)).toEqual(['2026-11-15', '2026-11-21']);
    expect(range('LASTWEEK')).toEqual(['2026-11-09', '2026-11-15']);
    expect(range('NEXTWEEK')).toEqual(['2026-11-23', '2026-11-29']);
    expect(range('THISMONTH')).toEqual(['2026-11-01', '2026-11-30']);
    expect(range('LASTMONTH')).toEqual(['2026-10-01', '2026-10-31']);
    expect(range('NEXTMONTH')).toEqual(['2026-12-01', '2026-12-31']);
    expect(range('THISQUARTER')).toEqual(['2026-10-01', '2026-12-31']);
    expect(range('LASTQUARTER')).toEqual(['2026-07-01', '2026-09-30']);
    expect(range('NEXTQUARTER')).toEqual(['2027-01-01', '2027-03-31']);
    expect(range('THISYEAR')).toEqual(['2026-01-01', '2026-12-31']);
    expect(range('LASTYEAR')).toEqual(['2025-01-01', '2025-12-31']);
    expect(range('NEXTYEAR')).toEqual(['2027-01-01', '2027-12-31']);
    expect(range('YEARTODATE')).toEqual(['2026-01-01', today]);
    expect(range('EQ')).toBeUndefined();
  });

  it('crosses year boundaries and leap days', () => {
    expect(relativeDateRange('LASTMONTH', undefined, '2026-01-15')).toEqual(['2025-12-01', '2025-12-31']);
    expect(relativeDateRange('LASTQUARTER', undefined, '2026-02-01')).toEqual(['2025-10-01', '2025-12-31']);
    expect(relativeDateRange('THISMONTH', undefined, '2028-02-10')).toEqual(['2028-02-01', '2028-02-29']);
    expect(relativeDateRange('THISWEEK', undefined, '2026-01-01')).toEqual(['2025-12-29', '2026-01-04']);
  });

  it('a number of days must be a whole number of at least 1', () => {
    expect(isComplete({ operator: 'LASTDAYS', values: [7] })).toBe(true);
    expect(isComplete({ operator: 'LASTDAYS', values: ['30'] })).toBe(true);
    for (const v of [0, -1, 1.5, '', 'x', undefined]) expect(isComplete({ operator: 'LASTDAYS', values: [v] }), String(v)).toBe(false);
    expect(isComplete({ operator: 'THISMONTH', values: [] })).toBe(true);
  });

  it('resolveCondition keeps exclusion and leaves fixed conditions alone', () => {
    expect(resolveCondition({ operator: 'TODAY', values: [] }, { today })).toEqual({ operator: 'EQ', values: [today] });
    expect(resolveCondition({ operator: 'THISMONTH', values: [], exclude: true }, { today })).toEqual({ operator: 'BT', values: ['2026-11-01', '2026-11-30'], exclude: true });
    const fixed: Condition = { operator: 'GT', values: [5] };
    expect(resolveCondition(fixed, { today })).toBe(fixed);
  });

  it('toFilter resolves at query time: Edm.Date ranges and Edm.DateTimeOffset calendar days in the time zone', () => {
    const typeOf = (p: string): EdmType => (p === 'At' ? 'Edm.DateTimeOffset' : 'Edm.Date');
    expect(toFilter({ Day: [{ operator: 'THISMONTH', values: [] }] }, typeOf, { today })).toBe('(Day ge 2026-11-01 and Day le 2026-11-30)');
    expect(toFilter({ Day: [{ operator: 'YESTERDAY', values: [] }] }, typeOf, { today })).toBe('Day eq 2026-11-16');
    expect(toFilter({ At: [{ operator: 'TODAY', values: [] }] }, typeOf, { today, timeZone: 'Asia/Shanghai' }))
      .toBe('(At ge 2026-11-17T00:00:00+08:00 and At lt 2026-11-18T00:00:00+08:00)');
    expect(toFilter({ Day: [{ operator: 'LASTDAYS', values: [2] }, { operator: 'TODAY', values: [], exclude: true }] }, typeOf, { today }))
      .toBe('(Day ge 2026-11-15 and Day le 2026-11-16) and not (Day eq 2026-11-17)');
    // without `today`: the current date in the time zone
    expect(toFilter({ Day: [{ operator: 'TODAY', values: [] }] }, typeOf)).toBe(`Day eq ${todayIn('UTC')}`);
    expect(toFilter({ Day: [{ operator: 'LASTDAYS', values: ['x'] }] }, typeOf, { today })).toBeUndefined();
  });

  it('todayIn uses the time zone', () => {
    const now = new Date('2026-11-17T20:00:00Z');
    expect(todayIn('UTC', now)).toBe('2026-11-17');
    expect(todayIn('Asia/Shanghai', now)).toBe('2026-11-18');
  });

  it('matches (memory provider) resolves the same way', () => {
    const c: Condition[] = [{ operator: 'LASTWEEK', values: [] }];
    expect(matches('2026-11-09', c, 'Edm.Date', { today })).toBe(true);
    expect(matches('2026-11-16', c, 'Edm.Date', { today })).toBe(false);
    expect(matches('2026-11-15T23:00:00Z', c, 'Edm.DateTimeOffset', { today })).toBe(true);
  });

  it('relative dates count as ranges for FilterExpressionRestrictions', () => {
    const c: Condition = { operator: 'THISYEAR', values: [] };
    expect(conditionAllowed(filterExpressionRules(undefined), c)).toBe(true);
    expect(conditionAllowed(filterExpressionRules('SingleRange'), c)).toBe(true);
    expect(conditionAllowed(filterExpressionRules('SingleValue'), c)).toBe(false);
    expect(conditionAllowed(filterExpressionRules('MultiValue'), c)).toBe(false);
  });
});

describe('arrangeText (UI.TextArrangement, S14)', () => {
  it('arranges code and text', () => {
    expect(arrangeText('A', 'Active')).toBe('Active (A)');
    expect(arrangeText('A', 'Active', 'TextFirst')).toBe('Active (A)');
    expect(arrangeText('A', 'Active', 'TextLast')).toBe('A (Active)');
    expect(arrangeText('A', 'Active', 'TextOnly')).toBe('Active');
    expect(arrangeText('A', 'Active', 'TextSeparate')).toBe('A');
    expect(arrangeText('A', undefined, 'TextOnly')).toBe('A');
    expect(arrangeText('', 'Active')).toBe('Active');
  });
});
