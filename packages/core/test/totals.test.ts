/** Group subtotals and grand totals (docs/23). */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildModel, buildTotalsRequest, canGroup, canSubtotal, canTotal, collectTotals, MemoryProvider, toQueryString, TOTAL_COUNT_ALIAS,
} from '../src/index';

const model = buildModel(readFileSync(join(import.meta.dirname, 'samples', 'purchasing.en.xml'), 'utf8'));
const source = { entitySet: 'PurchaseOrders' };
const ui = model.ui['Purchasing.PurchaseOrder']!;

describe('model (docs/23)', () => {
  it('GT-01 reads Aggregation.ApplySupported of the entity type into the capabilities', () => {
    const agg = model.entitySets.PurchaseOrders!.capabilities.aggregation!;
    expect(agg.transformations).toEqual(['filter', 'groupby', 'aggregate']);
    expect(agg.groupable).toEqual(['Status', 'PurchaseOrderType', 'CompanyCode', 'Supplier']);
    expect(agg.aggregatable).toEqual([{ path: 'NetAmount', methods: [] }]);
    expect(model.entitySets.Suppliers!.capabilities.aggregation).toBeUndefined();
  });

  it('GT-07 reads UI.PresentationVariant Total and GroupBy', () => {
    expect(ui.presentation.total).toEqual(['NetAmount']);
    expect(ui.presentation.groupBy).toEqual([]);
  });

  it('GT-01 / GT-06 decides what can be totalled and grouped by', () => {
    expect(canTotal(model, source, 'NetAmount')).toBe(true);
    expect(canTotal(model, source, 'DeliveryProgress')).toBe(false); // numeric but not aggregatable
    expect(canTotal(model, source, 'Status')).toBe(false);
    expect(canTotal(model, { entitySet: 'Suppliers' }, 'Rating')).toBe(false); // no ApplySupported
    expect(canGroup(model, source, 'Status')).toBe(true);
    expect(canGroup(model, source, 'OrderDate')).toBe(false); // not in GroupableProperties
    expect(canSubtotal(model, source, 'Supplier')).toBe(true);
    expect(canGroup(model, { entitySet: 'Suppliers' }, 'Country')).toBe(true); // no ApplySupported: any sortable property
    expect(canSubtotal(model, { entitySet: 'Suppliers' }, 'Country')).toBe(false);
  });
});

describe('totals request (docs/23)', () => {
  it('GT-02 / GT-03 grand totals are grouped by currency, after the filter', () => {
    const req = buildTotalsRequest(model, { source, measures: ['NetAmount'], filters: { CompanyCode: [{ operator: 'EQ', values: ['1000'] }] } });
    expect(decodeURIComponent(toQueryString(model, req))).toBe("$apply=filter(CompanyCode eq '1000')/groupby((Currency),aggregate(NetAmount with sum as NetAmount))");
  });

  it('GT-04 / GT-05 subtotals group by the property, its text and the currency, only for the given groups, with the row count', () => {
    const req = buildTotalsRequest(model, { source, measures: ['NetAmount'], groupBy: 'Supplier', groupValues: ['0000100001', '0000100007'], search: 'x' });
    expect(decodeURIComponent(toQueryString(model, req))).toBe(
      "$apply=filter((Supplier eq '0000100001' or Supplier eq '0000100007'))/search(x)/groupby((Supplier,_Supplier/SupplierName,Currency),aggregate(NetAmount with sum as NetAmount,$count as smartkit_count))",
    );
  });

  it('collects one entry per group with an amount per currency (largest first)', () => {
    const rows = [
      { Supplier: 'A', _Supplier: { SupplierName: 'Alpha' }, Currency: 'EUR', NetAmount: 10, [TOTAL_COUNT_ALIAS]: 2 },
      { Supplier: 'A', _Supplier: { SupplierName: 'Alpha' }, Currency: 'USD', NetAmount: 30, [TOTAL_COUNT_ALIAS]: '1' },
      { Supplier: null, Currency: 'EUR', NetAmount: 5, [TOTAL_COUNT_ALIAS]: 1 },
    ];
    const t = collectTotals(model, { source, measures: ['NetAmount'], groupBy: 'Supplier' }, rows);
    expect(t.get('A')).toEqual({ group: 'A', groupText: 'Alpha', count: 3, values: { NetAmount: [{ value: 30, unit: 'USD' }, { value: 10, unit: 'EUR' }] } });
    expect(t.get('')).toEqual({ group: null, count: 1, values: { NetAmount: [{ value: 5, unit: 'EUR' }] } });
  });

  it('the memory provider evaluates $count and sums per group', async () => {
    const provider = new MemoryProvider({
      model,
      data: {
        PurchaseOrders: [
          { PurchaseOrder: '1', Status: 'NEW', Currency: 'EUR', NetAmount: 10 },
          { PurchaseOrder: '2', Status: 'NEW', Currency: 'EUR', NetAmount: 5 },
          { PurchaseOrder: '3', Status: 'NEW', Currency: 'USD', NetAmount: 7 },
          { PurchaseOrder: '4', Status: 'APPR', Currency: 'EUR', NetAmount: 1 },
          { PurchaseOrder: '5', Status: 'CLOSED', Currency: 'EUR', NetAmount: 100 },
        ],
      },
    });
    const req = buildTotalsRequest(model, { source, measures: ['NetAmount'], groupBy: 'Status', groupValues: ['NEW', 'APPR'] });
    const t = collectTotals(model, { source, measures: ['NetAmount'], groupBy: 'Status' }, (await provider.query(req)).rows);
    expect([...t.keys()].sort()).toEqual(['APPR', 'NEW']);
    expect(t.get('NEW')).toMatchObject({ count: 3, values: { NetAmount: [{ value: 15, unit: 'EUR' }, { value: 7, unit: 'USD' }] } });
    const grand = collectTotals(model, { source, measures: ['NetAmount'] }, (await provider.query(buildTotalsRequest(model, { source, measures: ['NetAmount'] }))).rows);
    expect(grand.get('')).toEqual({ values: { NetAmount: [{ value: 116, unit: 'EUR' }, { value: 7, unit: 'USD' }] } });
  });
});
