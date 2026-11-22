/**
 * List report fixes (docs/25 S29, S35, the selected view of a saved view):
 * - S29: the table of another entity set's view reads `"/<Set>/@UI.LineItem"` (FE getManifestControlConfiguration);
 *   `onRowsChange` reports the rows of the shown table;
 * - S35: `navigationParameter` — an inbound navigation's conditions and view, applied once per navigation;
 * - a saved view brings back the view tab it was saved on.
 */
import { expect, test } from '@playwright/test';
import { open, recordOData, resetServer, showFilters, waitForRows } from './helpers';

test.beforeEach(async ({ page }) => {
  await resetServer(page);
});

test('S29 the table of another entity set has the actions, columns and additionalProperties of "/Set/@UI.LineItem"', async ({ page }) => {
  const rec = recordOData(page);
  await open(page, '/po?contents=1');
  const orders = await waitForRows(page, 'PurchaseOrders');
  // the main table: the relative configuration
  await expect(orders.locator('[data-sk-action="Custom::Copy"]')).toBeVisible();
  await expect(orders.locator('[data-sk-action="invoiced"]')).toHaveCount(0);
  await expect(page.locator('[data-demo-rows-set]')).toHaveAttribute('data-demo-rows-set', 'PurchaseOrders');

  await page.locator('[data-sk-list-tab="items"]').click();
  const items = await waitForRows(page, 'PurchaseOrderItems');
  // the items table: its own configuration, not the main table's
  const action = items.locator('[data-sk-action="invoiced"]');
  await expect(action).toBeVisible();
  await expect(action).toBeDisabled();
  await expect(items.locator('[data-sk-action="Custom::Copy"]')).toHaveCount(0);
  await expect(items.locator('.ag-header-cell[col-id="Custom::Open"]')).toContainText('Open quantity');
  await expect(items.locator('.ag-header-cell[col-id="Custom::Overdue"]')).toHaveCount(0);
  await expect(items.locator('[data-demo-open-quantity]').first()).toBeVisible();
  // additionalProperties are read with the rows of this table only
  const select = (set: string) => rec.urls.filter((u) => new RegExp(`/${set}\\?`).test(u) && u.includes('$select=')).map((u) => u.match(/\$select=([^&]*)/)![1]!);
  await expect.poll(() => select('PurchaseOrderItems').some((s) => s.split(',').includes('InvoicedAmount'))).toBe(true);
  expect(select('PurchaseOrders').some((s) => s.split(',').includes('InvoicedAmount'))).toBe(false);
  // the selected contexts of the action carry them
  await items.locator('.ag-row[row-index]').first().locator('.ag-selection-checkbox input, input[type="checkbox"]').first().check();
  await expect(action).toBeEnabled();
  await action.click();
  await expect(page.locator('[data-sk-message-toast]')).toContainText(/Invoiced: 45\d+\/\d+ \d/);
  // onRowsChange: the rows of the table that is shown
  await expect(page.locator('[data-demo-rows-set]')).toHaveAttribute('data-demo-rows-set', 'PurchaseOrderItems');
  expect(Number(await page.locator('[data-demo-rows]').getAttribute('data-demo-rows'))).toBeGreaterThan(0);
  await page.locator('[data-sk-list-tab="orders"]').click();
  await waitForRows(page, 'PurchaseOrders');
  await expect(page.locator('[data-demo-rows-set]')).toHaveAttribute('data-demo-rows-set', 'PurchaseOrders');
});

const nav = (o: { supplier?: string; selectedTab?: string; navigationId?: string }) => encodeURIComponent(JSON.stringify({
  // the selection variant replaces every condition, so it brings the mandatory company code too
  selectionVariant: o.supplier ? { SelectOptions: [{ PropertyName: 'CompanyCode', Ranges: [{ Sign: 'I', Option: 'EQ', Low: '1000' }] }, { PropertyName: 'Supplier', Ranges: [{ Sign: 'I', Option: 'EQ', Low: o.supplier }] }] } : undefined,
  selectedTab: o.selectedTab, navigationId: o.navigationId,
}));

test('S35 an inbound navigation applies its conditions at once, also with initialLoad "Disabled", and wins over the restored state', async ({ page }) => {
  const rec = recordOData(page);
  // an earlier visit left another condition in the page state
  await open(page, '/po?mode=manual');
  await waitForRows(page, 'PurchaseOrders');
  await showFilters(page);
  await page.locator('[data-sk-filter="$search"] input').fill('zzz-nothing');
  await page.locator('[data-sk-go]').click();
  await expect(page.locator('[data-sk-table="PurchaseOrders"] [data-sk-nodata], [data-sk-table="PurchaseOrders"] .ag-overlay-no-rows-center').first()).toBeVisible();

  rec.urls.length = 0;
  await open(page, `/po?mode=manual&initialLoad=Disabled&nav=${nav({ supplier: '0000100126', navigationId: 'n1' })}`);
  const t = await waitForRows(page, 'PurchaseOrders');
  const dataUrls = () => rec.urls.filter((u) => /\/PurchaseOrders\?/.test(u) && u.includes('$select='));
  // every request of the list carries the navigation's condition and not the restored search
  expect(dataUrls().length).toBeGreaterThan(0);
  expect(dataUrls().every((u) => u.includes("Supplier eq '0000100126'") && !u.includes('zzz-nothing'))).toBe(true);
  const suppliers = await t.locator('.ag-row[row-index]:not(.ag-row-pinned) [col-id="DataField::Supplier"]').allInnerTexts();
  expect(suppliers.length).toBeGreaterThan(0);
  expect(suppliers.every((s) => s.includes('100126'))).toBe(true);
  await showFilters(page);
  await expect(page.locator('[data-sk-filter="Supplier"]')).toContainText('100126');
  await expect(page.locator('[data-sk-variant]')).toHaveText('Standard');

  // the user changes the filter; showing the page again with the same navigation (reload) keeps the user's state
  await page.locator('[data-sk-filter="$search"] input').fill('4500000001');
  await page.locator('[data-sk-go]').click();
  await expect.poll(() => rec.urls.some((u) => u.includes('$search=') && u.includes('4500000001'))).toBe(true);
  await page.reload();
  await expect(page.locator('#demo-main')).toBeVisible();
  await showFilters(page);
  await expect(page.locator('[data-sk-filter="$search"] input')).toHaveValue('4500000001');

  // the same conditions with a new id are a new navigation: applied again (the search is cleared)
  await open(page, `/po?mode=manual&initialLoad=Disabled&nav=${nav({ supplier: '0000100126', navigationId: 'n2' })}`);
  await waitForRows(page, 'PurchaseOrders');
  await showFilters(page);
  await expect(page.locator('[data-sk-filter="$search"] input')).toHaveValue('');
  await expect(page.locator('[data-sk-filter="Supplier"]')).toContainText('100126');
});

test('S35 selectedTab opens the list on that view', async ({ page }) => {
  await open(page, `/po?views=tabs&nav=${nav({ selectedTab: 'InDelivery', navigationId: 't1' })}`);
  await waitForRows(page, 'PurchaseOrders');
  await expect(page.locator('[data-sk-list-tab="InDelivery"]')).toHaveAttribute('aria-selected', 'true');
  // the user selects another view: a reload with the same navigation keeps it
  const other = page.locator('[data-sk-list-tab]:not([data-sk-list-tab="InDelivery"])').first();
  const key = await other.getAttribute('data-sk-list-tab');
  await other.click();
  await expect(other).toHaveAttribute('aria-selected', 'true');
  await page.reload();
  await expect(page.locator(`[data-sk-list-tab="${key}"]`)).toHaveAttribute('aria-selected', 'true');
});

test('S35 a navigation that leaves a mandatory filter field empty reads nothing and marks the field', async ({ page }) => {
  const rec = recordOData(page);
  const sv = encodeURIComponent(JSON.stringify({ selectionVariant: { SelectOptions: [{ PropertyName: 'Supplier', Ranges: [{ Sign: 'I', Option: 'EQ', Low: '0000100126' }] }] }, navigationId: 'm1' }));
  await open(page, `/po?mode=manual&nav=${sv}`);
  await expect(page.locator('.sk-dynamic-page__header')).toBeVisible();
  await expect(page.locator('[data-sk-filter="CompanyCode"] [aria-invalid="true"], [data-sk-filter="CompanyCode"] [data-error]').first()).toBeVisible();
  await expect(page.locator('[data-sk-filter="Supplier"]')).toContainText('100126');
  expect(rec.urls.filter((u) => /\/PurchaseOrders\?/.test(u) && u.includes('$select='))).toEqual([]);
});

test('a saved view brings back the view tab it was saved on', async ({ page }) => {
  await open(page, '/po?views=tabs');
  await waitForRows(page, 'PurchaseOrders');
  const first = await page.locator('[data-sk-list-tab]').first().getAttribute('data-sk-list-tab');
  await expect(page.locator('[data-sk-variant-modified]')).toHaveCount(0);
  await page.locator('[data-sk-list-tab="Closed"]').click();
  // selecting another view modifies the page view (FE: a personalization change of the variant)
  await expect(page.locator('[data-sk-variant-modified]')).toBeVisible();
  await page.locator('[data-sk-variant]').click();
  await page.locator('[data-sk-variant-saveas]').click();
  const dialog = page.getByRole('dialog', { name: 'Save As' });
  await dialog.getByRole('textbox', { name: 'View' }).fill('On closed');
  await dialog.locator('[data-sk-variant-saveas-ok]').click();
  await expect(page.locator('[data-sk-variant]')).toHaveText('On closed');
  await expect(page.locator('[data-sk-variant-modified]')).toHaveCount(0);

  await page.locator(`[data-sk-list-tab="${first}"]`).click();
  await expect(page.locator(`[data-sk-list-tab="${first}"]`)).toHaveAttribute('aria-selected', 'true');
  await page.locator('[data-sk-variant]').click();
  await page.locator('[data-sk-variant-item="On closed"]').click();
  await expect(page.locator('[data-sk-list-tab="Closed"]')).toHaveAttribute('aria-selected', 'true');
  await page.locator('[data-sk-variant]').click();
  await page.locator('[data-sk-variant-item="Standard"]').click();
  await expect(page.locator(`[data-sk-list-tab="${first}"]`)).toHaveAttribute('aria-selected', 'true');
});
