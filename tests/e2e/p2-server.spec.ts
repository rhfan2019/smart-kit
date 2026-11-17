/** Phase 2 test services on the API level: writes, bound actions, sap-messages, $apply, draft (docs/08-test-services.md). */
import { expect, test, type APIResponse } from '@playwright/test';
import { MOCK, PURCHASING } from './helpers';

const PO = PURCHASING;
const DRAFT = `${MOCK}/odata/purchasing-draft`;
const JSON_HEADERS = { 'Content-Type': 'application/json', Accept: 'application/json' };
const NEW_ORDER = { Supplier: '0000100001', CompanyCode: '2000', PurchaseOrderType: 'NB', PurchasingGroup: 'P01', OrderDate: '2026-11-15', Description: 'Created by p2-server' };

type Detail = { code: string; message: string; target: string };
type SapMessage = { code: string; message: string; numericSeverity: number; target: string };
const targets = async (res: APIResponse) => ((await res.json()).error.details as Detail[]).map((d) => d.target).sort();
const sapMessages = (res: APIResponse): SapMessage[] => JSON.parse(res.headers()['sap-messages'] ?? '[]');
const draftKey = (id: string, active: boolean) => `PurchaseOrders(PurchaseOrder='${id}',IsActiveEntity=${active})`;

test.beforeEach(async ({ request }) => {
  expect((await request.post(`${MOCK}/test/reset`)).ok()).toBeTruthy();
  if (process.env.E2E_EXTRA_RESET) expect((await request.post(process.env.E2E_EXTRA_RESET)).ok()).toBeTruthy();
});

test('p2-server: create a purchase order (number, defaults, ETag, Location)', async ({ request }) => {
  const res = await request.post(`${PO}/PurchaseOrders`, { headers: JSON_HEADERS, data: NEW_ORDER });
  expect(res.status()).toBe(201);
  const po = await res.json();
  expect(po).toMatchObject({ PurchaseOrder: '4500010001', Status: 'NEW', StatusCriticality: 0, NetAmount: 0, BudgetAmount: 0, Currency: 'USD', DeliveredPercent: 0, Version: 1, ApproveEnabled: true, CloseEnabled: true });
  expect(res.headers().etag).toBe(po['@odata.etag']);
  expect(res.headers().location).toMatch(/\/odata\/purchasing\/PurchaseOrders\('4500010001'\)$/);
  expect(sapMessages(res)).toEqual([]); // it has a description
  expect((await request.get(`${PO}/PurchaseOrders('4500010001')`)).ok()).toBeTruthy();
});

test('p2-server: create validation: mandatory fields, order date, no-description warning', async ({ request }) => {
  const missing = await request.post(`${PO}/PurchaseOrders`, { headers: JSON_HEADERS, data: { Description: 'Incomplete' } });
  expect(missing.status()).toBe(400);
  expect(await targets(missing)).toEqual(['CompanyCode', 'OrderDate', 'PurchaseOrderType', 'PurchasingGroup', 'Supplier']);
  const late = await request.post(`${PO}/PurchaseOrders`, { headers: JSON_HEADERS, data: { ...NEW_ORDER, OrderDate: '2100-01-01' } });
  expect(late.status()).toBe(400);
  expect(await targets(late)).toEqual(['OrderDate']);
  const immutable = await request.patch(`${PO}/PurchaseOrders('4500000003')`, { headers: JSON_HEADERS, data: { CompanyCode: '2000' } });
  expect(immutable.status()).toBe(400);
  const patchLate = await request.patch(`${PO}/PurchaseOrders('4500000003')`, { headers: JSON_HEADERS, data: { OrderDate: '2100-01-01' } });
  expect(await targets(patchLate)).toEqual(['OrderDate']);

  const noText = await request.post(`${PO}/PurchaseOrders`, { headers: JSON_HEADERS, data: { ...NEW_ORDER, Description: '' } });
  expect(noText.status()).toBe(201);
  expect(sapMessages(noText)).toEqual([expect.objectContaining({ numericSeverity: 3, target: 'Description', message: 'The purchase order has no description.' })]);
  const patched = await request.patch(`${PO}/PurchaseOrders('4500000003')`, { headers: JSON_HEADERS, data: { Description: '' } });
  expect(patched.status()).toBe(200);
  expect(sapMessages(patched).map((m) => m.numericSeverity)).toEqual([3]);
});

test('p2-server: delete a purchase order (If-Match, then 404)', async ({ request }) => {
  const created = await (await request.post(`${PO}/PurchaseOrders`, { headers: JSON_HEADERS, data: NEW_ORDER })).json();
  const path = `${PO}/PurchaseOrders('${created.PurchaseOrder}')`;
  expect((await request.delete(path, { headers: { 'If-Match': 'W/"OTk="' } })).status()).toBe(412);
  expect((await request.delete(path, { headers: { 'If-Match': created['@odata.etag'] } })).status()).toBe(204);
  expect((await request.get(path)).status()).toBe(404);
});

test('p2-server: items: create, change quantity, delete; order totals follow', async ({ request }) => {
  const order = await (await request.post(`${PO}/PurchaseOrders`, { headers: JSON_HEADERS, data: NEW_ORDER })).json();
  const items = `${PO}/PurchaseOrders('${order.PurchaseOrder}')/_Item`;
  const missing = await request.post(items, { headers: JSON_HEADERS, data: {} });
  expect(missing.status()).toBe(400);
  expect(await targets(missing)).toEqual(['Material', 'OrderQuantity', 'Plant']);

  const res = await request.post(items, { headers: JSON_HEADERS, data: { Material: 'MAT-10001', Plant: '2010', OrderQuantity: 4 } });
  expect(res.status()).toBe(201);
  const item = await res.json();
  expect(item).toMatchObject({ PurchaseOrderItem: 10, Currency: 'USD', OrderUnit: 'EA', DeliveryDate: '2026-11-29', ReceivedQuantity: 0, Version: 1 });
  expect(item.NetAmount).toBeCloseTo(4 * item.NetPrice, 2);
  const second = await (await request.post(items, { headers: JSON_HEADERS, data: { Material: 'MAT-10002', Plant: '2010', OrderQuantity: 1 } })).json();
  expect(second.PurchaseOrderItem).toBe(20);

  const itemPath = `${PO}/PurchaseOrderItems(PurchaseOrder='${order.PurchaseOrder}',PurchaseOrderItem=10)`;
  expect((await request.patch(itemPath, { headers: JSON_HEADERS, data: { OrderQuantity: 10 } })).ok()).toBeTruthy();
  let po = await (await request.get(`${PO}/PurchaseOrders('${order.PurchaseOrder}')`)).json();
  expect(po.NetAmount).toBeCloseTo(10 * item.NetPrice + second.NetAmount, 2);
  expect(po.BudgetAmount).toBeCloseTo(po.NetAmount * 1.2, 1);

  expect((await request.delete(itemPath)).status()).toBe(204);
  po = await (await request.get(`${PO}/PurchaseOrders('${order.PurchaseOrder}')?$expand=_Item($select=PurchaseOrderItem)`)).json();
  expect(po._Item.map((i: { PurchaseOrderItem: number }) => i.PurchaseOrderItem)).toEqual([20]);
  expect(po.NetAmount).toBeCloseTo(second.NetAmount, 2);
});

test('p2-server: bound actions approve / reject / close with sap-messages', async ({ request }) => {
  const metadata = await (await request.get(`${PO}/$metadata`)).text();
  for (const a of ['approve', 'reject', 'close']) expect(metadata).toContain(`<Action Name="${a}" IsBound="true">`);
  expect(metadata).toContain('<Annotation Term="Core.OperationAvailable" Path="_it/ApproveEnabled"/>');

  const created = await (await request.post(`${PO}/PurchaseOrders`, { headers: JSON_HEADERS, data: NEW_ORDER })).json();
  const path = `${PO}/PurchaseOrders('${created.PurchaseOrder}')`;
  const ok = await request.post(`${path}/Purchasing.approve`, { headers: { ...JSON_HEADERS, 'If-Match': created['@odata.etag'] }, data: {} });
  expect(ok.status()).toBe(200);
  expect(await ok.json()).toMatchObject({ Status: 'APPR', StatusCriticality: 3, Version: 2, ApproveEnabled: false, CloseEnabled: true });
  expect(sapMessages(ok)).toEqual([{ code: 'PO_APPROVED', message: `Purchase order ${created.PurchaseOrder} approved.`, numericSeverity: 1, target: '' }]);

  const again = await request.post(`${path}/Purchasing.approve`, { headers: JSON_HEADERS, data: {} });
  expect(again.status()).toBe(400);
  expect((await again.json()).error.message).toBe(`Purchase order ${created.PurchaseOrder} cannot be approved in status Approved.`);
  const stale = await request.post(`${path}/Purchasing.close`, { headers: { ...JSON_HEADERS, 'If-Match': created['@odata.etag'] }, data: {} });
  expect(stale.status()).toBe(412);
  const closed = await request.post(`${path}/Purchasing.close`, { headers: { ...JSON_HEADERS, 'Accept-Language': 'zh' }, data: {} });
  expect(await closed.json()).toMatchObject({ Status: 'CLOSED', CloseEnabled: false });
  expect(sapMessages(closed)[0]!.message).toBe(`采购订单 ${created.PurchaseOrder} 已关闭。`);

  const other = await (await request.post(`${PO}/PurchaseOrders`, { headers: JSON_HEADERS, data: NEW_ORDER })).json();
  const rejected = await request.post(`${PO}/PurchaseOrders('${other.PurchaseOrder}')/Purchasing.reject`, { headers: JSON_HEADERS, data: {} });
  expect(await rejected.json()).toMatchObject({ Status: 'REJ', StatusCriticality: 1, ApproveEnabled: false });
  const zh = await request.get(`${PO}/OrderStatuses('REJ')`, { headers: { 'Accept-Language': 'zh' } });
  expect((await zh.json()).Name).toBe('拒绝');

  const notAvailable = await request.post(`${PO}/PurchaseOrders('4500000005')/Purchasing.close`, { headers: { ...JSON_HEADERS, 'Accept-Language': 'zh' }, data: {} });
  expect(notAvailable.status()).toBe(400);
  expect((await notAvailable.json()).error.message).toContain('不能关闭');
});

test('p2-server: $apply groupby with sum (decimals as strings, $count = groups)', async ({ request }) => {
  const headers = { Accept: 'application/json;IEEE754Compatible=true' };
  const res = await request.get(`${PO}/PurchaseOrders?$apply=filter(CompanyCode eq '1000')/groupby((Status),aggregate(NetAmount with sum as NetAmount))&$count=true`, { headers });
  expect(res.status()).toBe(200);
  const body = await res.json();
  const rows = await (await request.get(`${PO}/PurchaseOrders?$filter=CompanyCode eq '1000'&$select=Status,NetAmount&$top=20000`, { headers })).json();
  const expected: Record<string, number> = {};
  for (const r of rows.value) expected[r.Status] = (expected[r.Status] ?? 0) + Number(r.NetAmount);
  expect(body['@odata.count']).toBe(Object.keys(expected).length);
  for (const g of body.value) {
    expect(g.NetAmount).toMatch(/^-?\d+\.\d{2}$/);
    expect(Number(g.NetAmount)).toBeCloseTo(expected[g.Status]!, 1);
  }
  const metadata = await (await request.get(`${PO}/$metadata`)).text();
  expect(metadata).toContain('Term="Aggregation.ApplySupported"');
  expect(metadata).toContain('<Annotation Term="UI.Chart" Qualifier="ByStatus">');
});

test('p2-server: supplier quick view and rating count', async ({ request }) => {
  const metadata = await (await request.get(`${PO}/$metadata`)).text();
  expect(metadata).toContain('<Annotation Term="UI.QuickViewFacets">');
  expect(metadata).toContain('<Annotation Term="UI.FieldGroup" Qualifier="QuickView">');
  expect(metadata).toContain('<PropertyValue Property="SampleSize" Path="RatingCount"/>');
  const s = await (await request.get(`${PO}/Suppliers('0000100001')`)).json();
  for (const f of ['Country', 'City', 'Rating', 'IsBlocked', 'SupplierName', 'LogoUrl']) expect(s).toHaveProperty(f);
  expect(s.RatingCount).toBeGreaterThanOrEqual(5);
  expect(s.RatingCount).toBeLessThanOrEqual(400);
});

test('p2-server: order 4500000002 has 230 items', async ({ request }) => {
  const items = `${PO}/PurchaseOrders('4500000002')/_Item`;
  expect(await (await request.get(`${items}/$count`)).text()).toBe('230');
  const page = await (await request.get(`${items}?$count=true&$top=0`)).json();
  expect(page['@odata.count']).toBe(230);
  expect(page.value).toEqual([]);
  const all = await (await request.get(`${items}?$select=PurchaseOrderItem,NetAmount&$orderby=PurchaseOrderItem`)).json();
  expect(all.value.at(-1).PurchaseOrderItem).toBe(2300);
  const po = await (await request.get(`${PO}/PurchaseOrders('4500000002')`)).json();
  expect(po.NetAmount).toBeCloseTo(all.value.reduce((s: number, i: { NetAmount: number }) => s + i.NetAmount, 0), 1);
});

test('p2-server: draft edit, patch, activate', async ({ request }) => {
  const active = await request.patch(`${DRAFT}/${draftKey('4500000003', true)}`, { headers: JSON_HEADERS, data: { Description: 'Direct' } });
  expect(active.status()).toBe(400);
  expect((await active.json()).error.code).toBe('DRAFT_REQUIRED');

  const edit = await request.post(`${DRAFT}/${draftKey('4500000003', true)}/Purchasing.draftEdit`, { headers: JSON_HEADERS, data: { PreserveChanges: true } });
  expect(edit.status()).toBe(200);
  const draft = await edit.json();
  expect(draft).toMatchObject({ PurchaseOrder: '4500000003', IsActiveEntity: false, HasActiveEntity: true });
  expect(draft.DraftAdministrativeData.DraftIsCreatedByMe).toBe(true);
  const activeRow = await (await request.get(`${DRAFT}/${draftKey('4500000003', true)}`)).json();
  expect(activeRow.HasDraftEntity).toBe(true);
  const draftItems = await (await request.get(`${DRAFT}/${draftKey('4500000003', false)}/_Item?$count=true`)).json();
  expect(draftItems['@odata.count']).toBeGreaterThan(0);
  expect(draftItems.value.every((i: { IsActiveEntity: boolean }) => i.IsActiveEntity === false)).toBe(true);
  // pricing conditions are reachable from draft items as from active ones
  const first = draftItems.value[0];
  const cond = await request.get(`${DRAFT}/${draftKey('4500000003', false)}/_Item(PurchaseOrder='4500000003',PurchaseOrderItem=${first.PurchaseOrderItem},IsActiveEntity=false)/_PricingCondition`);
  expect((await cond.json()).value.length).toBeGreaterThan(0);

  const patch = await request.patch(`${DRAFT}/${draftKey('4500000003', false)}`, { headers: { ...JSON_HEADERS, 'If-Match': draft['@odata.etag'] }, data: { Description: '' } });
  expect(patch.status()).toBe(200);
  expect(sapMessages(patch)).toEqual([expect.objectContaining({ numericSeverity: 3, target: 'Description' })]);
  await request.patch(`${DRAFT}/${draftKey('4500000003', false)}`, { headers: JSON_HEADERS, data: { Description: 'Changed in the draft' } });
  // still the old text on the active version
  expect((await (await request.get(`${DRAFT}/${draftKey('4500000003', true)}`)).json()).Description).not.toBe('Changed in the draft');

  const activate = await request.post(`${DRAFT}/${draftKey('4500000003', false)}/Purchasing.draftActivate`, { headers: JSON_HEADERS, data: {} });
  expect(activate.status()).toBe(200);
  expect(await activate.json()).toMatchObject({ IsActiveEntity: true, HasDraftEntity: false, Description: 'Changed in the draft' });
  const rows = await (await request.get(`${DRAFT}/PurchaseOrders?$filter=PurchaseOrder eq '4500000003'&$select=PurchaseOrder,IsActiveEntity,HasDraftEntity`)).json();
  expect(rows.value).toEqual([expect.objectContaining({ IsActiveEntity: true, HasDraftEntity: false })]);
});

test('p2-server: draft discard', async ({ request }) => {
  expect((await request.post(`${DRAFT}/${draftKey('4500000006', true)}/Purchasing.draftEdit`, { headers: JSON_HEADERS, data: {} })).status()).toBe(200);
  expect((await request.delete(`${DRAFT}/${draftKey('4500000006', false)}`)).status()).toBe(204);
  const rows = await (await request.get(`${DRAFT}/PurchaseOrders?$filter=PurchaseOrder eq '4500000006'&$select=PurchaseOrder,IsActiveEntity,HasDraftEntity`)).json();
  expect(rows.value).toEqual([expect.objectContaining({ IsActiveEntity: true, HasDraftEntity: false })]);
  const items = await (await request.get(`${DRAFT}/PurchaseOrderItems?$filter=PurchaseOrder eq '4500000006' and IsActiveEntity eq false`)).json();
  expect(items.value).toEqual([]);
});

test('p2-server: draft of another user locks 4500000004 (409)', async ({ request }) => {
  const res = await request.post(`${DRAFT}/${draftKey('4500000004', true)}/Purchasing.draftEdit`, { headers: JSON_HEADERS, data: { PreserveChanges: true } });
  expect(res.status()).toBe(409);
  expect((await res.json()).error.message).toBe('Locked by Alex Miller.');
  const zh = await request.post(`${DRAFT}/${draftKey('4500000004', true)}/Purchasing.draftEdit`, { headers: { ...JSON_HEADERS, 'Accept-Language': 'zh' }, data: {} });
  expect((await zh.json()).error.message).toBe('已被 Alex Miller 锁定。');
  expect((await request.patch(`${DRAFT}/${draftKey('4500000004', false)}`, { headers: JSON_HEADERS, data: { Description: 'x' } })).status()).toBe(409);
  const row = await (await request.get(`${DRAFT}/${draftKey('4500000004', true)}?$expand=DraftAdministrativeData`)).json();
  expect(row).toMatchObject({ HasDraftEntity: true, DraftAdministrativeData: { InProcessByUser: 'Alex Miller', DraftIsCreatedByMe: false, LastChangeDateTime: '2026-11-14T09:30:00.000Z' } });
});

test('p2-server: editing-status filters', async ({ request }) => {
  await request.post(`${DRAFT}/${draftKey('4500000007', true)}/Purchasing.draftEdit`, { headers: JSON_HEADERS, data: {} });
  const ids = async (filter: string) => {
    const res = await request.get(`${DRAFT}/PurchaseOrders?$filter=${encodeURIComponent(filter)}&$select=PurchaseOrder,IsActiveEntity&$count=true&$top=5`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    return { count: body['@odata.count'] as number, rows: (body.value as { PurchaseOrder: string; IsActiveEntity: boolean }[]).map((r) => `${r.PurchaseOrder}:${r.IsActiveEntity}`) };
  };
  expect((await ids('IsActiveEntity eq false and DraftAdministrativeData/DraftIsCreatedByMe eq true')).rows).toEqual(['4500000007:false']); // own drafts
  expect((await ids("IsActiveEntity eq true and HasDraftEntity eq true and DraftAdministrativeData/DraftIsCreatedByMe eq false and DraftAdministrativeData/InProcessByUser ne ''")).rows).toEqual(['4500000004:true']); // locked by another user
  expect((await ids("IsActiveEntity eq true and HasDraftEntity eq true and DraftAdministrativeData/DraftIsCreatedByMe eq false and DraftAdministrativeData/InProcessByUser eq ''")).count).toBe(0); // unsaved changes of another user
  expect((await ids('IsActiveEntity eq true and HasDraftEntity eq false')).count).toBe(9998); // no changes
  const all = await ids('(IsActiveEntity eq false and DraftAdministrativeData/DraftIsCreatedByMe eq true) or (IsActiveEntity eq true and (HasDraftEntity eq false or DraftAdministrativeData/DraftIsCreatedByMe eq false))');
  expect(all.count).toBe(10000);
  expect((await ids("DraftAdministrativeData/InProcessByUser eq 'Alex Miller'")).count).toBe(2);
});

test('p2-server: new draft is validated on activation', async ({ request }) => {
  const res = await request.post(`${DRAFT}/PurchaseOrders`, { headers: JSON_HEADERS, data: {} });
  expect(res.status()).toBe(201);
  const draft = await res.json();
  expect(draft).toMatchObject({ PurchaseOrder: '4500010001', IsActiveEntity: false, HasActiveEntity: false, Status: 'NEW' });
  expect(res.headers().location).toContain(`/odata/purchasing-draft/${draftKey('4500010001', false)}`);
  const path = `${DRAFT}/${draftKey('4500010001', false)}`;

  const empty = await request.post(`${path}/Purchasing.draftActivate`, { headers: JSON_HEADERS, data: {} });
  expect(empty.status()).toBe(400);
  expect(await targets(empty)).toEqual(['CompanyCode', 'PurchaseOrderType', 'PurchasingGroup', 'Supplier']);

  const fields = { Supplier: NEW_ORDER.Supplier, CompanyCode: NEW_ORDER.CompanyCode, PurchaseOrderType: NEW_ORDER.PurchaseOrderType, PurchasingGroup: NEW_ORDER.PurchasingGroup };
  expect((await request.patch(path, { headers: JSON_HEADERS, data: { ...fields, OrderDate: '2100-01-01' } })).status()).toBe(200);
  const late = await request.post(`${path}/Purchasing.draftActivate`, { headers: JSON_HEADERS, data: {} });
  expect(late.status()).toBe(400);
  expect(await targets(late)).toEqual(['OrderDate']);

  await request.patch(path, { headers: JSON_HEADERS, data: { OrderDate: '2026-11-20' } });
  const item = await request.post(`${path}/_Item`, { headers: JSON_HEADERS, data: { Material: 'MAT-10003' } });
  expect(item.status()).toBe(201);
  const itemTargets = await targets(await request.post(`${path}/Purchasing.draftActivate`, { headers: JSON_HEADERS, data: {} }));
  expect(itemTargets).toEqual(["_Item(PurchaseOrder='4500010001',PurchaseOrderItem=10,IsActiveEntity=false)/OrderQuantity", "_Item(PurchaseOrder='4500010001',PurchaseOrderItem=10,IsActiveEntity=false)/Plant"]);
  await request.patch(`${path}/_Item(PurchaseOrder='4500010001',PurchaseOrderItem=10,IsActiveEntity=false)`, { headers: JSON_HEADERS, data: { Plant: '2010', OrderQuantity: 2 } });

  const ok = await request.post(`${path}/Purchasing.draftActivate`, { headers: JSON_HEADERS, data: {} });
  expect(ok.status()).toBe(200);
  const activated = await ok.json();
  expect(activated).toMatchObject({ PurchaseOrder: '4500010001', IsActiveEntity: true, Currency: 'USD', CompanyCode: '2000' });
  expect(activated.NetAmount).toBeGreaterThan(0);
  const approve = await request.post(`${DRAFT}/${draftKey('4500010001', true)}/Purchasing.approve`, { headers: JSON_HEADERS, data: {} });
  expect(await approve.json()).toMatchObject({ Status: 'APPR' });
});
