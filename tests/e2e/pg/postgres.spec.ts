// The demo app on the PostgreSQL-backed purchasing service (apps/pg-server, smart-kit-server, ADR-027).
// The reused specs (playwright.pg.config.ts) cover the list report, object page, micro charts and chart view;
// these tests check what is specific to this service.
import { expect, test } from '@playwright/test';
import { clearFilter, columnTexts, filterInput, open, orderPath, resetServer, table, titleCount, waitForRows } from '../helpers';

const PG = `http://localhost:${process.env.E2E_PG_PORT ?? '4402'}/odata/purchasing`;

test('PG-01 the list report reads /odata/purchasing/ from smart-kit-server on PostgreSQL', async ({ page }) => {
  const served = page.waitForResponse((r) => r.url().includes('/odata/purchasing/PurchaseOrders?') && /(\$|%24)count=true/.test(r.url()) && r.status() === 200);
  await open(page, '/po');
  const res = await served;
  expect(res.headers()['x-smart-kit-service']).toBe('postgres');
  const count = (await res.json())['@odata.count'] as number;
  expect(count).toBeGreaterThan(0);
  await waitForRows(page, 'PurchaseOrders');
  expect(await titleCount(page, 'PurchaseOrders')).toBe(count);
});

test('PG-02 an edit on the object page is stored in PostgreSQL (PATCH with If-Match, version counts up)', async ({ page, request }) => {
  await resetServer(page);
  await open(page, orderPath('4500000003'));
  await page.locator('[data-sk-global-actions] [data-sk-action="Edit"]').click();
  const description = page.locator('[data-sk-field-path="Description"]').first().locator('input:not([type="hidden"]), textarea').first();
  await description.fill('Stored in PostgreSQL');
  const saved = page.waitForResponse((r) => r.request().method() === 'PATCH' && r.url().includes("PurchaseOrders('4500000003')"));
  await page.locator('[data-sk-save]').click();
  const res = await saved;
  expect(res.status()).toBe(200);
  expect(res.request().headers()['if-match']).toBe('W/"MQ=="');
  const row = await (await request.get(`${PG}/PurchaseOrders('4500000003')?$select=Description,Version`)).json();
  expect(row).toMatchObject({ Description: 'Stored in PostgreSQL', Version: 2 });
  await resetServer(page);
  expect((await (await request.get(`${PG}/PurchaseOrders('4500000003')?$select=Description`)).json()).Description).not.toBe('Stored in PostgreSQL');
});

test('PG-03 labels come from the label bundles per language ($metadata in Chinese)', async ({ page }) => {
  await open(page, '/po', { lang: 'zh' });
  await waitForRows(page, 'PurchaseOrders');
  await expect(table(page, 'PurchaseOrders').locator('.ag-header-cell[col-id="DataField::NetAmount"]')).toContainText('净值');
});

test('PG-04 protocol: read-only sets 405, PUT 501, unknown properties 400, no injection through literals', async ({ request }) => {
  const post = await request.post(`${PG}/Suppliers`, { data: { Supplier: 'X' } });
  expect(post.status()).toBe(405);
  expect((await post.json()).error.code).toBe('NotWritable');
  expect((await request.put(`${PG}/PurchaseOrders('4500000001')`, { data: {} })).status()).toBe(501);
  const bad = await request.get(`${PG}/PurchaseOrders?$filter=${encodeURIComponent("Unknown eq 'x'")}`);
  expect(bad.status()).toBe(400);
  expect((await bad.json()).error).toMatchObject({ code: 'PropertyNotFound', target: 'Unknown' });
  const injection = await request.get(`${PG}/Suppliers?$filter=${encodeURIComponent("SupplierName eq 'x'' or ''1''=''1'")}&$count=true`);
  expect(injection.status()).toBe(200);
  expect((await injection.json())['@odata.count']).toBe(0);
});

test('PG-05 an action on several selected orders is one $batch request; each order succeeds or fails on its own', async ({ page, request }) => {
  await resetServer(page);
  const writes: string[] = [];
  page.on('request', (r) => { if (r.method() !== 'GET' && r.url().includes('/odata/purchasing/')) writes.push(`${r.method()} ${new URL(r.url()).pathname.replace('/odata/purchasing/', '')}`); });
  await open(page, '/po');
  await waitForRows(page, 'PurchaseOrders');
  // only New orders, so the first two rows can both be approved
  await page.locator('[data-sk-header-toggle]').click();
  await clearFilter(page, 'Status');
  const filtered = page.waitForResponse((r) => /\/PurchaseOrders\?/.test(r.url()) && decodeURIComponent(r.url()).includes("'NEW'"));
  await filterInput(page, 'Status').fill('=NEW');
  await filterInput(page, 'Status').press('Enter');
  await filtered;
  await page.locator('[data-sk-header-toggle]').click();
  await expect.poll(() => columnTexts(page, 'PurchaseOrders', 'DataField::Status').then((t) => t.length > 1 && t.every((x) => /New/.test(x)))).toBe(true);
  const news = (await columnTexts(page, 'PurchaseOrders', 'DataField::PurchaseOrder')).slice(0, 2);
  for (const i of [0, 1]) await table(page, 'PurchaseOrders').locator(`.ag-row[row-index="${i}"] input[type="checkbox"]`).first().check();
  const batched = page.waitForResponse((r) => r.url().endsWith('/odata/purchasing/$batch'));
  await table(page, 'PurchaseOrders').locator('[data-sk-action-group="decide"]').click();
  await page.getByRole('menuitem', { name: 'Approve' }).click();
  const res = await batched;
  const sent = res.request().postDataJSON() as { requests: { method: string; url: string; atomicityGroup?: string }[] };
  expect(sent.requests.map((x) => [x.method, x.url, x.atomicityGroup])).toEqual(news.map((po) => ['POST', `PurchaseOrders('${po}')/Purchasing.approve`, undefined]));
  expect(((await res.json()) as { responses: { status: number }[] }).responses.map((x) => x.status)).toEqual([200, 200]);
  expect(writes).toEqual(['POST $batch']);
  for (const po of news) expect((await (await request.get(`${PG}/PurchaseOrders('${po}')?$select=Status`)).json()).Status).toBe('APPR');
  await resetServer(page);
});
