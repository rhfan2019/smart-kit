import { describe, expect, it } from 'vitest';
import { filterExpressionRules, restrictConditions } from '../src';

describe('AL-13 lr7 filter bar: useSemanticDateRange and operatorConfiguration (FE CommonHelper.getOperatorsForProperty)', () => {
  it('AL-13 useSemanticDateRange false: a SingleRange date has the plain range operators, no semantic dates, no Empty', () => {
    const on = filterExpressionRules('SingleRange', 'Edm.Date');
    expect(on.operators).toContain('LASTYEAR');
    expect(on.operators).toContain('Empty');
    const off = filterExpressionRules('SingleRange', 'Edm.Date', { semanticDates: false });
    expect(off.operators).toEqual(expect.arrayContaining(['EQ', 'BT', 'LT', 'LE', 'GT', 'GE', 'NE', 'NB']));
    expect(off.operators.some((o) => ['TODAY', 'LASTYEAR', 'DATE', 'DATERANGE', 'LASTDAYS', 'Empty'].includes(o))).toBe(false);
    expect(off.max).toBe(1);
  });

  it('AL-13 useSemanticDateRange false: SingleValue date is EQ only; DateTimeOffset SingleRange EQ and BT; unrestricted date the basic operators', () => {
    expect(filterExpressionRules('SingleValue', 'Edm.Date', { semanticDates: false }).operators).toEqual(['EQ']);
    expect(filterExpressionRules('SingleRange', 'Edm.DateTimeOffset', { semanticDates: false }).operators.sort()).toEqual(['BT', 'EQ']);
    const free = filterExpressionRules(undefined, 'Edm.Date', { semanticDates: false });
    expect(free.operators).toContain('Empty');
    expect(free.operators.some((o) => ['TODAY', 'LASTDAYS', 'THISYEAR'].includes(o))).toBe(false);
    // other types are not affected
    expect(filterExpressionRules('SingleRange', 'Edm.Decimal', { semanticDates: false })).toEqual(filterExpressionRules('SingleRange', 'Edm.Decimal'));
  });

  it('AL-13 restrictConditions with useSemanticDateRange false drops a semantic date condition', () => {
    expect(restrictConditions('SingleRange', [{ operator: 'LASTYEAR', values: [] }], 'Edm.Date', { semanticDates: false })).toEqual([]);
    expect(restrictConditions('SingleRange', [{ operator: 'BT', values: ['2024-01-01', '2024-02-01'] }], 'Edm.Date', { semanticDates: false })).toHaveLength(1);
  });

  it('AL-13 operatorConfiguration: an include configuration keeps the other operators (FE _filterOperation: unmatched → not extended)', () => {
    const years = filterExpressionRules('SingleRange', 'Edm.Date', { operatorConfiguration: [{ path: 'category', contains: 'YEAR', exclude: false }] });
    expect(years.operators).toEqual(expect.arrayContaining(['THISYEAR', 'LASTYEAR', 'TODAY', 'LASTMONTH', 'Empty']));
    const months = filterExpressionRules('SingleRange', 'Edm.Date', { operatorConfiguration: [{ path: 'category', equals: 'FIXED.MONTH', exclude: true }] });
    expect(months.operators).not.toContain('THISMONTH');
    expect(months.operators).not.toContain('LASTMONTH');
    expect(months.operators).toContain('LASTMONTHS');
    expect(months.operators).toContain('THISYEAR');
  });

  it('AL-13 operatorConfiguration: exclude; LAST<unit> also excludes its INCLUDED variant; the extended FROM/TO<day> only when included', () => {
    const r = filterExpressionRules('SingleRange', 'Edm.Date', { operatorConfiguration: [{ path: 'key', equals: 'LASTDAYS,Empty', exclude: true }] });
    expect(r.operators).not.toContain('LASTDAYS');
    expect(r.operators).not.toContain('LASTDAYSINCLUDED');
    expect(r.operators).toContain('LASTWEEKS');
    expect(r.operators).not.toContain('Empty');
    expect(r.operators).not.toContain('FROMTODAY');
    const ext = filterExpressionRules('SingleRange', 'Edm.Date', { operatorConfiguration: [{ path: 'key', equals: 'FROMTODAY', exclude: false }] });
    expect(ext.operators).toContain('FROMTODAY');
  });

  it('AL-13 operatorConfiguration on a SingleValue date: key exclusions remove single dates', () => {
    const r = filterExpressionRules('SingleValue', 'Edm.Date', { operatorConfiguration: [{ path: 'key', equals: 'TOMORROW', exclude: true }] });
    expect(r.operators).toContain('TODAY');
    expect(r.operators).not.toContain('TOMORROW');
  });
});
