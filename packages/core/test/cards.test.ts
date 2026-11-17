/** Cards (docs/20-research-cards.md): the annotations a card selects by qualifier. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildModel, calculateTrend, parseAnnotationPath, type TrendCalculationModel, type ValueRef } from '../src';

const model = buildModel(readFileSync(join(import.meta.dirname, 'samples', 'purchasing.en.xml'), 'utf8'));
const po = model.ui['Purchasing.PurchaseOrder']!;
const meeting = model.ui['Purchasing.SupplierMeeting']!;

describe('card annotations (docs/20)', () => {
  it('CD-50 parseAnnotationPath accepts the OVP and the short forms', () => {
    expect(parseAnnotationPath('com.sap.vocabularies.UI.v1.LineItem#CardList')).toEqual({ term: 'LineItem', qualifier: 'CardList' });
    expect(parseAnnotationPath('@UI.Chart#ByStatus')).toEqual({ term: 'Chart', qualifier: 'ByStatus' });
    expect(parseAnnotationPath('UI.Identification')).toEqual({ term: 'Identification', qualifier: '' });
  });
  it('CD-50 qualified line items, presentation and selection variants, data points and field groups are kept', () => {
    expect(po.lineItems['']).toBe(po.lineItem);
    expect(po.lineItems.CardList!.map((f) => f.path ?? f.dataPoint?.value)).toEqual(['PurchaseOrder', 'Description', 'Supplier', 'OrderDate', 'NetAmount', 'Status']);
    expect(po.presentationVariants.CardLarge).toEqual({ presentation: { sortOrder: [{ path: 'NetAmount', descending: true }], requestAtLeast: [] }, maxItems: 5, lineItemQualifier: 'CardList', chartQualifier: undefined });
    expect(po.selectionVariants.CardNew).toEqual([{ path: 'Status', exclude: false, operator: 'EQ', values: ['NEW'] }]);
    expect(po.dataPoints.CardAmount).toMatchObject({ value: 'NetAmount', criticality: { path: 'StatusCriticality' } });
    expect(po.fieldGroups.General!.fields.length).toBeGreaterThan(2);
    expect(po.identification.length).toBeGreaterThanOrEqual(0);
  });
  it('CD-51 Communication.Event names the start, end and texts of an event', () => {
    expect(meeting.event).toEqual({ dtstart: 'StartAt', dtend: 'EndAt', summary: 'Subject', description: '_Supplier/SupplierName', location: 'Location', categories: 'Category' });
    expect(po.event).toBeUndefined();
  });
  it('CD-52 UI.TrendCalculation gives the trend of a KPI', () => {
    const dp = po.dataPoints.CardSpend!;
    expect(dp.trendCalculation).toMatchObject({ referenceValue: { value: 550000000 }, isRelative: false });
    const resolve = (r: ValueRef | undefined) => (r && 'value' in r ? Number(r.value) : undefined);
    expect(calculateTrend(dp.trendCalculation!, 587000000, resolve)).toBe('Up');
    expect(calculateTrend(dp.trendCalculation!, 555000000, resolve)).toBe('None');
    expect(calculateTrend(dp.trendCalculation!, 500000000, resolve)).toBe('Down');
    const relative: TrendCalculationModel = { referenceValue: { value: 100 }, isRelative: true, upDifference: { value: 0.1 } };
    expect(calculateTrend(relative, 111, resolve)).toBe('Up');
    expect(calculateTrend(relative, 105, resolve)).toBe('None');
    expect(calculateTrend({ isRelative: false }, 5, resolve)).toBe('None');
  });
});
