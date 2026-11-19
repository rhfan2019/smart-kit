import { describe, expect, it } from 'vitest';
import { filterExpressionRules, restrictConditions } from '../src';

/** FE CommonHelper.getOperatorsForDateProperty: the mdc date type's basic operators and Empty. */
const BASIC = ['EQ', 'BT', 'LT', 'LE', 'GT', 'GE', 'Empty', 'NE', 'NB'];

describe('AL-11 date7: date filter field without FilterExpressionRestrictions (FE FieldHelper.operators → getOperatorsForDateProperty)', () => {
  it.each(['Edm.Date', 'Edm.DateTimeOffset'] as const)('AL-11 %s: the basic operators and Empty, no semantic or relative dates, any number of conditions', (type) => {
    const rules = filterExpressionRules(undefined, type);
    expect([...rules.operators].sort()).toEqual([...BASIC].sort());
    expect([...rules.excludeOperators].sort()).toEqual(['BT', 'EQ', 'GE', 'GT', 'LE', 'LT'].sort());
    expect(rules.exclude).toBe(true);
    expect(rules.max).toBeUndefined();
  });

  it('AL-11 the same whatever useSemanticDateRange and operatorConfiguration say', () => {
    const base = filterExpressionRules(undefined, 'Edm.Date');
    expect(filterExpressionRules(undefined, 'Edm.Date', { semanticDates: false })).toEqual(base);
    expect(filterExpressionRules(undefined, 'Edm.Date', { operatorConfiguration: [{ path: 'category', contains: 'YEAR', exclude: false }] })).toEqual(base);
  });

  it('AL-11 restricted date fields keep the semantic dates; other types are not affected', () => {
    expect(filterExpressionRules('SingleRange', 'Edm.Date').operators).toContain('LASTWEEKS');
    expect(filterExpressionRules('MultiRange', 'Edm.Date').operators).not.toContain('LASTWEEKS');
    expect(filterExpressionRules(undefined, 'Edm.String').operators).toContain('Contains');
    expect(filterExpressionRules(undefined, 'Edm.Decimal').operators).toContain('BT');
  });

  it('AL-11 a relative date condition on an unrestricted date field is dropped (FE getConditionsOfSupportedOperators)', () => {
    expect(restrictConditions(undefined, [{ operator: 'LASTWEEKS', values: [2] }, { operator: 'EQ', values: ['2026-11-02'] }], 'Edm.Date')).toEqual([{ operator: 'EQ', values: ['2026-11-02'] }]);
  });

  it('AL-11 without a known type the date side still allows the relative dates (whichever allows more)', () => {
    expect(filterExpressionRules(undefined).operators).toContain('LASTWEEKS');
  });
});
