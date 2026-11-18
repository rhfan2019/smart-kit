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
  it('GT-02 / GT-03 grand totals aggregate the custom aggregate with its currency (FE, D39), after the filter', () => {
    const req = buildTotalsRequest(model, { source, measures: ['NetAmount'], filters: { CompanyCode: [{ operator: 'EQ', values: ['1000'] }] } });
    expect(decodeURIComponent(toQueryString(model, req))).toBe("$apply=filter(CompanyCode eq '1000')/aggregate(NetAmount,Currency)"); // NetAmount is a custom aggregate (docs/29 §4 P1-2)
  });

  it('GT-03 the details of a total over several currencies: one row per currency, sorted (FE "Show Details")', () => {
    const req = buildTotalsRequest(model, { source, measures: ['NetAmount'], filters: { CompanyCode: [{ operator: 'EQ', values: ['1000'] }] }, byUnit: true });
    expect(decodeURIComponent(toQueryString(model, req))).toBe("$apply=filter(CompanyCode eq '1000')/groupby((Currency),aggregate(NetAmount))&$orderby=Currency&$top=100");
    const sub = buildTotalsRequest(model, { source, measures: ['NetAmount'], groupBy: 'Supplier', groupValues: ['0000100001'], byUnit: true });
    expect(decodeURIComponent(toQueryString(model, sub))).toBe("$apply=filter(Supplier eq '0000100001')/groupby((Currency),aggregate(NetAmount))&$orderby=Currency&$top=100");
    const t = collectTotals(model, { source, measures: ['NetAmount'], groupBy: 'Supplier', byUnit: true }, [{ Currency: 'EUR', NetAmount: 3 }, { Currency: 'USD', NetAmount: 9 }]);
    expect(t.get('')).toEqual({ values: { NetAmount: [{ value: 3, unit: 'EUR' }, { value: 9, unit: 'USD' }] } }); // the service's order (by currency)
  });

  it('GT-04 / GT-05 subtotals group by the property and its text, aggregate the currency, only for the given groups, with the row count', () => {
    const req = buildTotalsRequest(model, { source, measures: ['NetAmount'], groupBy: 'Supplier', groupValues: ['0000100001', '0000100007'], search: 'x' });
    expect(decodeURIComponent(toQueryString(model, req))).toBe(
      "$apply=filter((Supplier eq '0000100001' or Supplier eq '0000100007'))/search(x)/groupby((Supplier,_Supplier/SupplierName),aggregate(NetAmount,Currency,$count as smartkit_count))",
    );
  });

  it('collects one entry per group; a null currency means several currencies (multiUnit, D39)', () => {
    const rows = [
      { Supplier: 'A', _Supplier: { SupplierName: 'Alpha' }, Currency: null, NetAmount: 40, [TOTAL_COUNT_ALIAS]: '3' },
      { Supplier: null, Currency: 'EUR', NetAmount: 5, [TOTAL_COUNT_ALIAS]: 1 },
    ];
    const t = collectTotals(model, { source, measures: ['NetAmount'], groupBy: 'Supplier' }, rows);
    expect(t.get('A')).toEqual({ group: 'A', groupText: 'Alpha', count: 3, values: { NetAmount: [{ value: 40, multiUnit: true }] } });
    expect(t.get('')).toEqual({ group: null, count: 1, values: { NetAmount: [{ value: 5, unit: 'EUR' }] } });
  });

  it('the memory provider evaluates $count, sums per group and returns the currency only when it is the same', async () => {
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
    expect(t.get('NEW')).toMatchObject({ count: 3, values: { NetAmount: [{ value: 22, multiUnit: true }] } });
    expect(t.get('APPR')).toMatchObject({ count: 1, values: { NetAmount: [{ value: 1, unit: 'EUR' }] } });
    const grand = collectTotals(model, { source, measures: ['NetAmount'] }, (await provider.query(buildTotalsRequest(model, { source, measures: ['NetAmount'] }))).rows);
    expect(grand.get('')).toEqual({ values: { NetAmount: [{ value: 123, multiUnit: true }] } });
    const details = buildTotalsRequest(model, { source, measures: ['NetAmount'], byUnit: true });
    const byUnit = collectTotals(model, { source, measures: ['NetAmount'], byUnit: true }, (await provider.query(details)).rows);
    expect(byUnit.get('')).toEqual({ values: { NetAmount: [{ value: 116, unit: 'EUR' }, { value: 7, unit: 'USD' }] } });
  });
});
