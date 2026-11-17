// The demo app on the PostgreSQL-backed purchasing service (apps/pg-server, smart-kit-server, ADR-027).
// The reused specs (playwright.pg.config.ts) cover the list report, object page, micro charts and chart view;
// these tests check what is specific to this service.
import { expect, test } from '@playwright/test';
import { open, orderPath, resetServer, table, titleCount, waitForRows } from '../helpers';

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
