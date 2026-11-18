/**
 * Stage 4 tail: the requests of the analytical table as Fiori elements 1.154 sends them (sap.ui.mdc.odata.v4.TableDelegate
 * create$$Aggregation, sap.ui.model.odata.v4.lib._AggregationHelper buildApply, _ConcatHelper; FE comparison
 * tests/e2e-fe/apply.spec.ts). The expected strings are the requests recorded from FE (apps/fe-reference
 * `purchasing-analytical`).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildModel, MemoryProvider, ODataV4Provider, toQueryString, type QueryRequest } from '../src/index';
import { buildAnalyticalRequests, type AnalyticalRequestOptions } from '../src/query/analytical';

const model = buildModel(readFileSync(join(import.meta.dirname, 'samples', 'purchasing.en.xml'), 'utf8'));
const source = { entitySet: 'PurchaseOrders' };
const ui = model.ui['Purchasing.PurchaseOrder']!;
const qs = (req: QueryRequest) => decodeURIComponent(toQueryString(model, req));
const FILTER = "Status ne 'CLOSED' and CompanyCode eq '1000'";
const filters = { Status: [{ operator: 'NE' as const, values: ['CLOSED'] }], CompanyCode: [{ operator: 'EQ' as const, values: ['1000'] }] };
const LEAVES = 'groupby((PurchaseOrder,PurchaseOrderType,Status,StatusCriticality,Supplier),aggregate(NetAmount,Currency))';
const build = (o: Partial<AnalyticalRequestOptions> = {}) => buildAnalyticalRequests(model, ui, { source, columns: ui.lineItem, filters, top: 144, totals: ['NetAmount'], ...o });

describe('AL-10 AL-11 AL-12 analytical table request shape ($apply with concat)', () => {
  it('AL-10 AL-11 AL-12 apply: the first page reads grand total, count and leaves in one $apply, nothing else (fe:apply-initial)', () => {
    const r = build();
    expect(qs(r.first)).toBe(`$apply=filter(${FILTER})/concat(aggregate(NetAmount,Currency),${LEAVES}/concat(aggregate($count as UI5__count),top(144)))`);
  });

  it('AL-10 AL-11 AL-12 apply: $orderby becomes orderby() inside, only for grouped or aggregated properties (getFilteredOrderby)', () => {
    // the default sort OrderDate desc: OrderDate is not grouped, so FE sends no orderby
    expect(qs(build({ sort: [{ path: 'OrderDate', descending: true }] }).first)).not.toContain('orderby');
    expect(qs(build({ sort: [{ path: 'OrderDate', descending: true }, { path: 'Supplier', descending: false }] }).first))
      .toBe(`$apply=filter(${FILTER})/concat(aggregate(NetAmount,Currency),${LEAVES}/orderby(Supplier)/concat(aggregate($count as UI5__count),top(144)))`);
    // an amount is sorted with its currency first (Q-05b); both are part of the request
    expect(qs(build({ sort: [{ path: 'NetAmount', descending: true }] }).first)).toContain(`${LEAVES}/orderby(Currency,NetAmount desc)/concat(`);
  });

  it('AL-10 AL-11 AL-12 apply: filter() and search() come before concat(); without totals there is no grand total', () => {
    expect(qs(build({ search: 'Fenu' }).first)).toBe(`$apply=filter(${FILTER})/search(Fenu)/concat(aggregate(NetAmount,Currency),${LEAVES}/concat(aggregate($count as UI5__count),top(144)))`);
    expect(qs(build({ totals: [] }).first)).toBe(`$apply=filter(${FILTER})/${LEAVES}/concat(aggregate($count as UI5__count),top(144))`);
  });

  it('AL-10 AL-11 AL-12 apply: the following pages are plain list requests without $count, with the same orderby', () => {
    const page = build({ sort: [{ path: 'OrderDate', descending: true }, { path: 'Supplier', descending: false }], extraSelect: ['CloseEnabled'] }).page(144, 179);
    expect(qs(page)).toBe(`$select=PurchaseOrder,Supplier,OrderDate,Status,StatusCriticality,NetAmount,Currency,DeliveredPercent,PurchaseOrderType,BudgetAmount,CloseEnabled&$filter=${FILTER}`
      + '&$orderby=Supplier&$expand=_Supplier($select=SupplierName,Rating,Supplier),_Status($select=Name,Code),_PurchaseOrderType($select=Name,Code)&$skip=144&$top=179');
  });

  it('AL-10 AL-11 AL-12 apply: the rows of the first page read what they lack per row (late properties)', () => {
    const late = build({ extraSelect: ['CloseEnabled'] }).late!;
    // FE: PurchaseOrders('…')?$select=BudgetAmount,CloseEnabled,DeliveredPercent,OrderDate&$expand=_PurchaseOrderType(…),_Status(…),_Supplier(…)
    expect([...late.select].sort()).toEqual(['BudgetAmount', 'CloseEnabled', 'DeliveredPercent', 'OrderDate']);
    expect(late.expand.map((e) => e.navigation).sort()).toEqual(['_PurchaseOrderType', '_Status', '_Supplier']);
  });

  it('AL-10 AL-11 AL-12 apply: the OData provider splits grand total and count off the concat() result', async () => {
    const body = { value: [{ NetAmount: '30', Currency: null }, { UI5__count: '2' }, { PurchaseOrder: '1', NetAmount: '10', Currency: 'EUR' }, { PurchaseOrder: '2', NetAmount: '20', Currency: 'USD' }] };
    const fetch = async () => new Response(JSON.stringify(body), { status: 200 });
    const p = new ODataV4Provider({ serviceUrl: '/s/', model, fetch });
    const res = await p.query(build().first);
    expect(res).toEqual({ rows: body.value.slice(2), count: 2, grandTotal: { NetAmount: '30', Currency: null } });
    const noTotal = await new ODataV4Provider({ serviceUrl: '/s/', model, fetch: async () => new Response(JSON.stringify({ value: body.value.slice(1) })) }).query(build({ totals: [] }).first);
    expect(noTotal).toEqual({ rows: body.value.slice(2), count: 2 });
  });

  it('AL-10 AL-11 AL-12 apply: the memory provider answers the analytical request', async () => {
    const rows = [
      { PurchaseOrder: '1', Supplier: 'B', Status: 'NEW', CompanyCode: '1000', NetAmount: 10, Currency: 'EUR' },
      { PurchaseOrder: '2', Supplier: 'A', Status: 'NEW', CompanyCode: '1000', NetAmount: 20, Currency: 'USD' },
      { PurchaseOrder: '3', Supplier: 'C', Status: 'CLOSED', CompanyCode: '1000', NetAmount: 40, Currency: 'EUR' },
    ];
    const p = new MemoryProvider({ model, data: { PurchaseOrders: rows } });
    const res = await p.query(build({ sort: [{ path: 'Supplier', descending: false }], top: 1 }).first);
    expect(res.count).toBe(2);
    expect(res.grandTotal).toEqual({ NetAmount: 30, Currency: null });
    expect(res.rows).toEqual([{ PurchaseOrder: '2', PurchaseOrderType: undefined, Status: 'NEW', StatusCriticality: undefined, Supplier: 'A', NetAmount: 20, Currency: 'USD' }]);
  });
});
