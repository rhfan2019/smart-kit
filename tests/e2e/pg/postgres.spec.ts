// The demo app on the PostgreSQL-backed purchasing service (apps/pg-server, smart-kit-server, ADR-027).
// The reused specs (playwright.pg.config.ts) cover the list report, object page, micro charts and chart view;
// these tests check what is specific to this service.
import { expect, test } from '@playwright/test';
import { open, orderPath, table, titleCount, waitForRows } from '../helpers';

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

test('PG-02 read-only service: no create, edit or delete buttons (Capabilities false in the annotation file)', async ({ page }) => {
  await open(page, '/po');
  await waitForRows(page, 'PurchaseOrders');
  await expect(table(page, 'PurchaseOrders').locator('[data-sk-action="Create"]')).toHaveCount(0);
  await expect(table(page, 'PurchaseOrders').locator('[data-sk-action="Delete"]')).toHaveCount(0);
  await open(page, orderPath('4500000001'));
  await expect(page.locator('.sk-dynamic-page__heading')).toContainText('4500000001');
  await expect(page.locator('[data-sk-global-actions] [data-sk-action="Edit"]')).toHaveCount(0);
});

test('PG-03 labels come from the label bundles per language ($metadata in Chinese)', async ({ page }) => {
  await open(page, '/po', { lang: 'zh' });
  await waitForRows(page, 'PurchaseOrders');
  await expect(table(page, 'PurchaseOrders').locator('.ag-header-cell[col-id="DataField::NetAmount"]')).toContainText('净值');
});

test('PG-04 protocol: writes are 501, unknown properties 400, errors in the OData format', async ({ request }) => {
  const post = await request.post(`${PG}/PurchaseOrders`, { data: {} });
  expect(post.status()).toBe(501);
  expect((await post.json()).error.code).toBe('NotImplemented');
  const bad = await request.get(`${PG}/PurchaseOrders?$filter=${encodeURIComponent("Unknown eq 'x'")}`);
  expect(bad.status()).toBe(400);
  expect((await bad.json()).error).toMatchObject({ code: 'PropertyNotFound', target: 'Unknown' });
  const injection = await request.get(`${PG}/Suppliers?$filter=${encodeURIComponent("SupplierName eq 'x'' or ''1''=''1'")}&$count=true`);
  expect(injection.status()).toBe(200);
  expect((await injection.json())['@odata.count']).toBe(0);
});
