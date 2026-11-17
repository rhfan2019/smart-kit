// The protocol rules of writes (independent of the business rules), on the PostgreSQL test bed.
// Skipped when the database is not set up (npm run pg:setup); CI sets SMART_KIT_REQUIRE_PG=1.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { actions, entitySets } from '../../../apps/pg-server/rules';
import { createODataService, createPostgresDb, type ODataServiceOptions } from '../src/index';
import { metadataSource, storage } from './fixture';

const DATABASE_URL = process.env.SMART_KIT_DATABASE_URL ?? 'postgresql://smart_kit_app@localhost:5432/smart_kit_purchasing';
const { db, pool } = createPostgresDb({ connectionString: DATABASE_URL });
const available = await pool.query('select purchasing_seed.reset()').then(() => true, () => false);
if (!available && process.env.SMART_KIT_REQUIRE_PG === '1') throw new Error('PostgreSQL test database not reachable; run npm run pg:setup');

const ROOT = 'http://pg.test/odata/purchasing/';
const service = (o: Partial<ODataServiceOptions<{ company?: string }>> = {}) =>
  createODataService<{ company?: string }>({ basePath: '/odata/purchasing/', metadata: metadataSource(), storage: storage(), db, entitySets, actions, ...o });
const call = async (svc: ReturnType<typeof service>, method: string, path: string, body?: unknown, headers: Record<string, string> = {}) => {
  const r = await svc.handle(new Request(ROOT + path, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) }));
  const text = await r.text();
  return { status: r.status, body: text ? JSON.parse(text) : undefined, headers: r.headers };
};
const ORDER = { Supplier: '0000100001', CompanyCode: '1000', PurchaseOrderType: 'NB', PurchasingGroup: 'P01', OrderDate: '2026-11-20' };

describe.skipIf(!available)('writes: protocol', () => {
  beforeAll(() => pool.query('select purchasing_seed.reset()'));
  afterAll(async () => {
    await pool.query('select purchasing_seed.reset()');
    await pool.end();
  });

  it('checks values against the Edm types and facets before any rule runs', async () => {
    const svc = service();
    expect((await call(svc, 'POST', 'PurchaseOrders', { ...ORDER, OrderDate: '20.11.2026' })).body.error).toMatchObject({ code: 'InvalidValue', target: 'OrderDate' });
    expect((await call(svc, 'POST', 'PurchaseOrders', { ...ORDER, Description: 'x'.repeat(81) })).body.error).toMatchObject({ code: 'ValueTooLong', target: 'Description' });
    expect((await call(svc, 'PATCH', "PurchaseOrderItems(PurchaseOrder='4500000001',PurchaseOrderItem=10)", { OrderQuantity: 'ten' })).body.error.code).toBe('InvalidValue');
    expect((await call(svc, 'PATCH', "PurchaseOrders('4500000001')", { Supplier: null })).body.error).toMatchObject({ code: 'NullNotAllowed', target: 'Supplier' });
    expect((await call(svc, 'PATCH', "PurchaseOrders('4500000001')", { Unknown: 1 })).body.error.code).toBe('PropertyNotFound');
    const bad = await svc.handle(new Request(`${ROOT}PurchaseOrders('4500000001')`, { method: 'PATCH', body: '{not json' }));
    expect(bad.status).toBe(400);
  });

  it('refuses what the service does not offer', async () => {
    const svc = service();
    expect((await call(svc, 'POST', 'Suppliers', { Supplier: 'X' })).status).toBe(405); // no InsertRestrictions
    expect((await call(svc, 'PUT', "PurchaseOrders('4500000001')", ORDER)).status).toBe(501);
    expect((await call(svc, 'POST', 'PurchaseOrders', { ...ORDER, _Item: [] })).status).toBe(501); // deep insert
    expect((await call(svc, 'POST', "PurchaseOrders('4500000001')/Purchasing.unknown", {})).status).toBe(404);
    expect((await call(svc, 'POST', "PurchaseOrderItems(PurchaseOrder='4500000001',PurchaseOrderItem=10)/Purchasing.approve", {})).body.error.code).toBe('InvalidBinding');
    expect((await call(service({ actions: {} }), 'POST', "PurchaseOrders('4500000001')/Purchasing.approve", {})).status).toBe(501);
    expect((await call(service({ readOnly: true }), 'PATCH', "PurchaseOrders('4500000001')", { Description: 'x' })).status).toBe(501);
    expect((await call(svc, 'PATCH', "PurchaseOrders('4599999999')", { Description: 'x' })).status).toBe(404);
  });

  it('keeps writes inside the data scope', async () => {
    const svc = service({ context: () => ({ company: '2000' }), scope: (set, c) => (set === 'PurchaseOrders' && c.company ? `CompanyCode eq '${c.company}'` : undefined) });
    // 4500000001 belongs to company 1000: invisible, so it cannot be changed, deleted or acted on
    expect((await call(svc, 'PATCH', "PurchaseOrders('4500000001')", { Description: 'x' })).status).toBe(404);
    expect((await call(svc, 'DELETE', "PurchaseOrders('4500000001')")).status).toBe(404);
    expect((await call(svc, 'POST', "PurchaseOrders('4500000001')/Purchasing.close", {})).status).toBe(404);
    expect((await call(svc, 'POST', "PurchaseOrders('4500000001')/_Item", { Material: 'MAT-10001', Plant: '1010', OrderQuantity: 1 })).status).toBe(404);
    // a new order of another company would be outside the scope: refused, nothing written
    const outside = await call(svc, 'POST', 'PurchaseOrders', ORDER);
    expect(outside.status).toBe(403);
    expect((await pool.query("select 1 from purchasing.purchase_order where purchase_order = '4500010001'")).rowCount).toBe(0);
    expect((await call(svc, 'POST', 'PurchaseOrders', { ...ORDER, CompanyCode: '2000' })).status).toBe(201);
  });

  it('rolls the whole request back when a rule fails after a write', async () => {
    const failing = service({
      entitySets: { ...entitySets, PurchaseOrderItems: { ...entitySets.PurchaseOrderItems, afterCreate: () => { throw new Error('boom'); } } },
      onError: () => undefined,
    });
    const before = (await pool.query("select count(*)::int as n from purchasing.purchase_order_item where purchase_order = '4500000003'")).rows[0].n;
    expect((await call(failing, 'POST', "PurchaseOrders('4500000003')/_Item", { Material: 'MAT-10001', Plant: '1010', OrderQuantity: 1 })).status).toBe(500);
    expect((await pool.query("select count(*)::int as n from purchasing.purchase_order_item where purchase_order = '4500000003'")).rows[0].n).toBe(before);
  });

  it('answers 204 for Prefer: return=minimal, with the ETag and sap-messages headers', async () => {
    const r = await call(service(), 'PATCH', "PurchaseOrders('4500000002')", { Description: '' }, { Prefer: 'return=minimal' });
    expect(r.status).toBe(204);
    expect(r.headers.get('etag')).toBe('W/"Mg=="');
    expect(JSON.parse(r.headers.get('sap-messages')!)[0]).toMatchObject({ code: 'PO_NO_DESCRIPTION', numericSeverity: 3 });
    const { rows } = await pool.query<{ po: string }>("select purchase_order as po from purchasing.purchase_order where status = 'ORD' order by 1 limit 1");
    const zh = await call(service(), 'POST', `PurchaseOrders('${rows[0]!.po}')/Purchasing.close`, {}, { 'Accept-Language': 'zh' });
    // non-ASCII as \uXXXX in the header, Chinese after JSON.parse
    expect(JSON.parse(zh.headers.get('sap-messages')!)[0].message).toContain('已关闭');
  });
});
