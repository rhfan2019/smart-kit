// $batch (JSON format), unmanaged save, the host's unit of work and the authorize hook, on the PostgreSQL test bed.
// Skipped when the database is not set up (npm run pg:setup); CI sets SMART_KIT_REQUIRE_PG=1.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { actions, entitySets } from '../../../apps/pg-server/rules';
import { createKyselyOnClient, createODataService, createPostgresDb, ODataServerError, type ODataServiceOptions } from '../src/index';
import { metadataSource, storage } from './fixture';

const DATABASE_URL = process.env.SMART_KIT_DATABASE_URL ?? 'postgresql://smart_kit_app@localhost:5432/smart_kit_purchasing';
const { db, pool } = createPostgresDb({ connectionString: DATABASE_URL });
const available = await pool.query('select purchasing_seed.reset()').then(() => true, () => false);
if (!available && process.env.SMART_KIT_REQUIRE_PG === '1') throw new Error('PostgreSQL test database not reachable; run npm run pg:setup');

type Ctx = { user?: string };
const ROOT = 'http://pg.test/odata/purchasing/';
const service = (o: Partial<ODataServiceOptions<Ctx>> = {}) =>
  createODataService<Ctx>({ basePath: '/odata/purchasing/', metadata: metadataSource(), storage: storage(), db, entitySets, actions, onError: () => undefined, ...o });
type BatchResponse = { id: string; atomicityGroup?: string; status: number; headers: Record<string, string>; body?: any }; // eslint-disable-line @typescript-eslint/no-explicit-any
const batch = async (svc: ReturnType<typeof service>, requests: unknown[], headers: Record<string, string> = {}) => {
  const r = await svc.handle(new Request(`${ROOT}$batch`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify({ requests }) }));
  const body = JSON.parse(await r.text()) as { responses?: BatchResponse[]; error?: { code: string } };
  return { status: r.status, responses: body.responses ?? [], error: body.error };
};
const one = async (svc: ReturnType<typeof service>, method: string, path: string, body?: unknown, headers: Record<string, string> = {}) => {
  const r = await svc.handle(new Request(ROOT + path, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) }));
  const text = await r.text();
  return { status: r.status, body: text ? JSON.parse(text) : undefined, headers: r.headers };
};
const ORDER = { Supplier: '0000100001', CompanyCode: '1000', PurchaseOrderType: 'NB', PurchasingGroup: 'P01', OrderDate: '2026-11-20' };
const ITEM = { Material: 'MAT-10001', Plant: '1010', OrderQuantity: 2 };
const description = async (po: string) => (await pool.query<{ d: string | null }>('select description as d from purchasing.purchase_order where purchase_order = $1', [po])).rows[0]?.d;
const orders = async () => (await pool.query<{ n: number }>('select count(*)::int as n from purchasing.purchase_order')).rows[0]!.n;

describe.skipIf(!available)('$batch', () => {
  beforeAll(() => pool.query('select purchasing_seed.reset()'));
  afterAll(() => pool.query('select purchasing_seed.reset()'));

  it('answers each request in order, reads and writes alike', async () => {
    const r = await batch(service(), [
      { id: 'a', method: 'GET', url: "PurchaseOrders('4500000001')?$select=PurchaseOrder" },
      { id: 'b', method: 'PATCH', url: "PurchaseOrders('4500000001')", body: { Description: 'batched' }, headers: { 'If-Match': '*' } },
      { id: 'c', method: 'GET', url: 'PurchaseOrders/$count' },
    ]);
    expect(r.status).toBe(200);
    expect(r.responses.map((x) => [x.id, x.status])).toEqual([['a', 200], ['b', 200], ['c', 200]]);
    expect(r.responses[0]!.body.PurchaseOrder).toBe('4500000001');
    expect(r.responses[1]!.body.Description).toBe('batched');
    expect(r.responses[1]!.headers.etag).toMatch(/^W\//);
    expect(Number(r.responses[2]!.body)).toBeGreaterThan(0);
  });

  it('writes a change set completely or not at all', async () => {
    const before = await orders();
    const failed = await batch(service(), [
      { id: '1', atomicityGroup: 'g', method: 'PATCH', url: "PurchaseOrders('4500000002')", body: { Description: 'first of two' } },
      { id: '2', atomicityGroup: 'g', method: 'PATCH', url: "PurchaseOrders('4500000003')", body: { Supplier: 'NOPE' } },
    ]);
    // one response for the group, naming the request that failed
    expect(failed.responses).toHaveLength(1);
    expect(failed.responses[0]).toMatchObject({ id: '2', atomicityGroup: 'g', status: 400 });
    expect(failed.responses[0]!.body.error.details[0]).toMatchObject({ code: 'UNKNOWN_VALUE', target: 'Supplier' });
    expect(await description('4500000002')).not.toBe('first of two');

    const ok = await batch(service(), [
      { id: '1', atomicityGroup: 'g', method: 'PATCH', url: "PurchaseOrders('4500000002')", body: { Description: 'both' } },
      { id: '2', atomicityGroup: 'g', method: 'PATCH', url: "PurchaseOrders('4500000003')", body: { Description: 'both' } },
    ]);
    expect(ok.responses.map((x) => [x.id, x.atomicityGroup, x.status])).toEqual([['1', 'g', 200], ['2', 'g', 200]]);
    expect([await description('4500000002'), await description('4500000003')]).toEqual(['both', 'both']);
    expect(await orders()).toBe(before);
  });

  it('creates an order and its items in one change set, the items addressed through the new order', async () => {
    const before = await orders();
    const r = await batch(service(), [
      { id: 'po', atomicityGroup: 'new', method: 'POST', url: 'PurchaseOrders', body: { ...ORDER, Description: 'with items' } },
      { id: 'i1', atomicityGroup: 'new', method: 'POST', url: '$po/_Item', body: ITEM },
      { id: 'i2', atomicityGroup: 'new', method: 'POST', url: '$po/_Item', body: { ...ITEM, OrderQuantity: 3 } },
      { id: 'read', method: 'GET', url: '$po?$select=PurchaseOrder,NetAmount&$expand=_Item($select=PurchaseOrderItem)' },
    ]);
    expect(r.responses.map((x) => x.status)).toEqual([201, 201, 201, 200]);
    const po = r.responses[0]!.body.PurchaseOrder as string;
    expect(r.responses[0]!.headers.location).toBe(`${ROOT}PurchaseOrders('${po}')`);
    expect(r.responses[3]!.body._Item.map((x: { PurchaseOrderItem: number }) => x.PurchaseOrderItem)).toEqual([10, 20]);
    expect(Number(r.responses[3]!.body.NetAmount)).toBeGreaterThan(0);
    expect(await orders()).toBe(before + 1);

    // the second item is refused: the order of the same change set is not created either
    const failed = await batch(service(), [
      { id: 'po', atomicityGroup: 'new', method: 'POST', url: 'PurchaseOrders', body: ORDER },
      { id: 'i1', atomicityGroup: 'new', method: 'POST', url: '$po/_Item', body: { ...ITEM, OrderQuantity: -1 } },
    ]);
    expect(failed.responses).toHaveLength(1);
    expect(failed.responses[0]).toMatchObject({ id: 'i1', status: 400 });
    expect(await orders()).toBe(before + 1);
  });

  it('runs a bound action on many entities in one request, each on its own unless they share a group', async () => {
    const { rows } = await pool.query<{ po: string; status: string }>("(select purchase_order as po, status from purchasing.purchase_order where status = 'NEW' order by 1 limit 2) union all (select purchase_order, status from purchasing.purchase_order where status = 'CLOSED' order by 1 limit 1)");
    const [a, b, closed] = rows.map((x) => x.po) as [string, string, string];
    const approve = (po: string, group?: string) => ({ id: po, ...(group ? { atomicityGroup: group } : {}), method: 'POST', url: `PurchaseOrders('${po}')/Purchasing.approve`, body: {} });
    // isolated: the one that cannot be approved fails alone
    const isolated = await batch(service(), [approve(a), approve(closed), approve(b)], { Prefer: 'continue-on-error' });
    expect(isolated.responses.map((x) => x.status)).toEqual([200, 400, 200]);
    expect(isolated.responses[1]!.body.error.code).toBe('ACTION_NOT_AVAILABLE');
    expect(JSON.parse(isolated.responses[0]!.headers['sap-messages']!)[0].code).toBe('PO_APPROVED');
    // without continue-on-error the first failure ends the batch
    const stopped = await batch(service(), [approve(closed), approve(a)]);
    expect(stopped.responses.map((x) => x.id)).toEqual([closed]);
  });

  it('refuses what it does not understand', async () => {
    const svc = service();
    const multipart = await svc.handle(new Request(`${ROOT}$batch`, { method: 'POST', headers: { 'Content-Type': 'multipart/mixed; boundary=b' }, body: '--b--' }));
    expect(multipart.status).toBe(415);
    expect((await batch(svc, [{ id: '1', method: 'GET', url: 'PurchaseOrders' }, { id: '1', method: 'GET', url: 'Suppliers' }])).error?.code).toBe('InvalidBatch');
    expect((await batch(svc, [{ id: '1', atomicityGroup: 'g', method: 'GET', url: 'PurchaseOrders' }])).error?.code).toBe('InvalidBatch');
    expect((await batch(svc, [{ id: '1', method: 'POST', url: '$batch', body: { requests: [] } }])).responses[0]!.body.error.code).toBe('InvalidBatch');
    expect((await batch(svc, [{ id: '1', method: 'POST', url: '$nope/_Item', body: ITEM }])).responses[0]!.body.error.code).toBe('InvalidReference');
    expect((await batch(svc, [{ id: '1', method: 'GET', url: 'http://elsewhere.test/odata/purchasing/PurchaseOrders' }])).responses[0]!.status).toBe(400);
    expect((await svc.handle(new Request(`${ROOT}$batch`))).status).toBe(405);
    expect((await batch(service({ readOnly: true }), [{ id: '1', method: 'PATCH', url: "PurchaseOrders('4500000001')", body: {} }])).responses[0]!.status).toBe(501);
    expect((await batch(svc, [])).responses).toEqual([]);
  });

  it('asks authorize for every request of a batch, with the entity set the path ends at', async () => {
    const seen: string[] = [];
    const svc = service({
      context: () => ({ user: 'reader' }),
      authorize: (e) => {
        seen.push(`${e.operation}${e.action ? `:${e.action}` : ''} ${e.entitySet} ${e.context.user}`);
        if (e.operation !== 'read' && e.entitySet === 'PurchaseOrderItems') throw new ODataServerError(403, 'PERMISSION_DENIED', 'Items are not yours to change.');
      },
    });
    const r = await batch(svc, [
      { id: '1', method: 'GET', url: "PurchaseOrders('4500000001')/_Item?$top=1" },
      { id: '2', method: 'PATCH', url: "PurchaseOrders('4500000001')", body: { Description: 'allowed' } },
      { id: '3', method: 'POST', url: "PurchaseOrders('4500000001')/_Item", body: ITEM },
      { id: '4', method: 'POST', url: "PurchaseOrders('4500000001')/Purchasing.close", body: {} },
    ], { Prefer: 'continue-on-error' });
    expect(r.responses.map((x) => x.status)).toEqual([200, 200, 403, 200]);
    expect(seen).toEqual(['read PurchaseOrderItems reader', 'update PurchaseOrders reader', 'create PurchaseOrderItems reader', 'action:Purchasing.close PurchaseOrders reader']);
    expect((await one(svc, 'DELETE', "PurchaseOrderItems(PurchaseOrder='4500000001',PurchaseOrderItem=10)")).status).toBe(403);
  });
});

describe.skipIf(!available)('unmanaged save and the unit of work', () => {
  beforeAll(() => pool.query('select purchasing_seed.reset()'));
  afterAll(async () => {
    await pool.query('select purchasing_seed.reset()');
    await pool.end();
  });

  // The application's own writes: plain SQL on the connection of its own transaction.
  const calls: string[] = [];
  let current: import('pg').PoolClient | undefined;
  const mine = () => {
    if (!current) throw new Error('no unit of work');
    return current;
  };
  const unmanaged = (o: Partial<ODataServiceOptions<Ctx>> = {}) =>
    service({
      entitySets: {
        PurchaseOrders: {
          creatable: ['Supplier', 'CompanyCode', 'Description'],
          updatable: ['Description'],
          async create(e) {
            calls.push('create');
            const { rows } = await mine().query<{ n: string }>('select coalesce(max(purchase_order::bigint), 4500000000) + 1 as n from purchasing.purchase_order');
            await mine().query(
              `insert into purchasing.purchase_order (purchase_order, purchase_order_type, supplier, company_code, purchasing_group, order_date, created_at, status, status_criticality, net_amount, currency, delivered_percent, description, version, budget_amount, invoiced_amount, approve_enabled, close_enabled)
               select $1, purchase_order_type, $2, $3, purchasing_group, order_date, now(), 'NEW', 0, 0, currency, 0, $4, 1, 0, 0, true, true from purchasing.purchase_order where purchase_order = '4500000001'`,
              [rows[0]!.n, e.data.Supplier, e.data.CompanyCode, e.data.Description ?? null],
            );
            return { PurchaseOrder: rows[0]!.n };
          },
          async update(e) {
            calls.push(`update ${Object.keys(e.patch).join(',')}`);
            if (e.patch.Description === 'refuse') throw new ODataServerError(409, 'NOT_NOW', 'The application refuses.');
            const r = await mine().query('update purchasing.purchase_order set description = $1, version = version + 1 where purchase_order = $2 and version = $3', [e.data.Description, e.key.PurchaseOrder, e.current.Version]);
            if (!r.rowCount) throw new ODataServerError(412, 'PreconditionFailed', 'Changed by someone else.');
          },
          async delete(e) {
            calls.push('delete');
            for (const table of ['pricing_condition', 'item_history', 'purchase_order_item', 'purchase_order']) await mine().query(`delete from purchasing.${table} where purchase_order = $1`, [e.key.PurchaseOrder]);
          },
        },
      },
      actions: {
        // an action that stores what it does itself, and one that hands its changes to the unmanaged update
        'Purchasing.approve': async (e) => {
          await mine().query("update purchasing.purchase_order set status = 'APPR', approve_enabled = false, version = version + 1 where purchase_order = $1", [e.entity.PurchaseOrder]);
        },
        'Purchasing.close': () => ({ Description: 'closed by action' }),
      },
      async unitOfWork(_e, work) {
        const client = await pool.connect();
        current = client;
        try {
          await client.query('begin');
          const result = await work(createKyselyOnClient(client));
          await client.query('commit');
          return result;
        } catch (e) {
          await client.query('rollback');
          throw e;
        } finally {
          current = undefined;
          client.release();
        }
      },
      ...o,
    });

  it('lets the application store the entity and answers with what the entity set reads', async () => {
    const svc = unmanaged();
    const created = await one(svc, 'POST', 'PurchaseOrders', { Supplier: '0000100002', CompanyCode: '1000', Description: 'unmanaged' });
    expect(created.status).toBe(201);
    const po = created.body.PurchaseOrder as string;
    expect(created.body).toMatchObject({ Supplier: '0000100002', Description: 'unmanaged', Status: 'NEW' });
    expect(created.headers.get('location')).toBe(`${ROOT}PurchaseOrders('${po}')`);

    const etag = created.body['@odata.etag'] as string;
    const patched = await one(svc, 'PATCH', `PurchaseOrders('${po}')`, { Description: 'changed' }, { 'If-Match': etag });
    expect(patched.status).toBe(200);
    expect(patched.body.Description).toBe('changed');
    expect(patched.body['@odata.etag']).not.toBe(etag); // the application counted the version up
    // the protocol is still the service's: stale ETag, property whitelist, Edm types
    expect((await one(svc, 'PATCH', `PurchaseOrders('${po}')`, { Description: 'stale' }, { 'If-Match': etag })).status).toBe(412);
    expect((await one(svc, 'PATCH', `PurchaseOrders('${po}')`, { Supplier: '0000100003' })).body.error.code).toBe('PropertyNotUpdatable');
    expect((await one(svc, 'PATCH', `PurchaseOrders('${po}')`, { Description: 'x'.repeat(81) })).body.error.code).toBe('ValueTooLong');
    // the application's own refusal reaches the client as it is
    expect((await one(svc, 'PATCH', `PurchaseOrders('${po}')`, { Description: 'refuse' })).body.error.code).toBe('NOT_NOW');

    expect((await one(svc, 'POST', `PurchaseOrders('${po}')/Purchasing.approve`, {})).body.Status).toBe('APPR');
    expect((await one(svc, 'POST', `PurchaseOrders('${po}')/Purchasing.close`, {})).body.Description).toBe('closed by action');
    expect((await one(svc, 'DELETE', `PurchaseOrders('${po}')`)).status).toBe(204);
    expect(await description(po)).toBeUndefined();
    expect(calls).toEqual(['create', 'update Description', 'update Description', 'update Description', 'delete']);
  });

  it('refuses an unmanaged create that does not return the key', async () => {
    const svc = unmanaged({ entitySets: { PurchaseOrders: { create: () => ({}) } } });
    expect((await one(svc, 'POST', 'PurchaseOrders', ORDER)).status).toBe(500);
  });

  it('commits the application’s writes and the service’s own together, per request and per change set', async () => {
    // items are written by the service (managed), orders by the application: one transaction of the host
    const svc = unmanaged({ entitySets: { PurchaseOrderItems: entitySets.PurchaseOrderItems!, PurchaseOrders: { updatable: ['Description'], update: async (e) => void (await mine().query('update purchasing.purchase_order set description = $1 where purchase_order = $2', [e.data.Description, e.key.PurchaseOrder])) } } });
    const items = async () => (await pool.query<{ n: number }>("select count(*)::int as n from purchasing.purchase_order_item where purchase_order = '4500000004'")).rows[0]!.n;
    const before = await items();
    const failed = await batch(svc, [
      { id: '1', atomicityGroup: 'g', method: 'PATCH', url: "PurchaseOrders('4500000004')", body: { Description: 'never' } },
      { id: '2', atomicityGroup: 'g', method: 'POST', url: "PurchaseOrders('4500000004')/_Item", body: ITEM },
      { id: '3', atomicityGroup: 'g', method: 'POST', url: "PurchaseOrders('4500000004')/_Item", body: { ...ITEM, Material: 'NOPE' } },
    ]);
    expect(failed.responses).toHaveLength(1);
    expect(failed.responses[0]).toMatchObject({ id: '3', status: 400 });
    expect(await description('4500000004')).not.toBe('never');
    expect(await items()).toBe(before);

    const ok = await batch(svc, [
      { id: '1', atomicityGroup: 'g', method: 'PATCH', url: "PurchaseOrders('4500000004')", body: { Description: 'together' } },
      { id: '2', atomicityGroup: 'g', method: 'POST', url: "PurchaseOrders('4500000004')/_Item", body: ITEM },
    ]);
    expect(ok.responses.map((x) => x.status)).toEqual([200, 201]);
    expect(await description('4500000004')).toBe('together');
    expect(await items()).toBe(before + 1);
  });
});
