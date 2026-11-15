import { expect, test } from '@playwright/test';
import { columnTexts, filterInput, open, resetServer, showFilters, table, titleCount, waitForRows } from './helpers';

test.beforeEach(async ({ page }) => resetServer(page));

test('AC-NAV-01 returning to the list restores filters, search, sort, columns, scroll and selection', async ({ page }) => {
  await open(page, '/po');
  const t = await waitForRows(page, 'PurchaseOrders');
  await showFilters(page);
  await filterInput(page, '$search').fill('Ltd');
  await page.locator('[data-sk-go]').click();
  await expect.poll(() => titleCount(page, 'PurchaseOrders')).toBeLessThan(1616);
  const count = await titleCount(page, 'PurchaseOrders');
  // sort by purchase order, hide a column
  await t.locator('.ag-header-cell[col-id="DataField::PurchaseOrder"] .ag-header-cell-label').click();
  await expect(t.locator('.ag-header-cell[col-id="DataField::PurchaseOrder"]')).toHaveAttribute('aria-sort', 'ascending');
  await t.locator('[data-sk-table-settings]').click();
  await page.getByRole('dialog').getByRole('checkbox', { name: 'Net Amount' }).uncheck();
  await page.locator('[data-sk-p13n-ok]').click();
  // scroll down and select a row
  expect(count).toBeGreaterThan(130);
  await expect.poll(async () => {
    await t.locator('.ag-grid-viewport').evaluate((el) => el.scrollTo(0, 120 * 40));
    return t.locator('.ag-row[row-index="125"]').count();
  }, { timeout: 15_000 }).toBe(1);
  await t.locator('.ag-row[row-index="125"] input[type="checkbox"]').check();
  const selectedPo = await t.locator('.ag-row[row-index="125"] [col-id="DataField::PurchaseOrder"]').innerText();
  await page.waitForTimeout(300);
  const scrollBefore = await t.locator('.ag-grid-viewport').evaluate((el) => el.scrollTop);
  await t.locator('.ag-row[row-index="125"] [data-sk-row-nav]').click();
  await expect(page.locator('.sk-dynamic-page__heading')).toHaveText(selectedPo);
  await page.goBack();
  await waitForRows(page, 'PurchaseOrders');
  await expect.poll(() => titleCount(page, 'PurchaseOrders')).toBe(count);
  await expect(page.locator('.sk-dynamic-page__summary, [data-sk-filter="$search"]').first()).toBeVisible();
  await showFilters(page);
  await expect(filterInput(page, '$search')).toHaveValue('Ltd');
  await expect(t.locator('.ag-header-cell[col-id="DataField::PurchaseOrder"]')).toHaveAttribute('aria-sort', 'ascending');
  await expect(t.locator('.ag-header-cell[col-id="DataField::NetAmount"]')).toHaveCount(0);
  await expect.poll(() => t.locator('.ag-grid-viewport').evaluate((el) => el.scrollTop)).toBeGreaterThan(scrollBefore - 60);
  expect(await t.locator('.ag-grid-viewport').evaluate((el) => el.scrollTop)).toBeLessThan(scrollBefore + 60);
  await expect(t.locator('.ag-row[row-index="125"] input[type="checkbox"]')).toBeChecked();
});

test('AC-NAV-06 host routes keep working: back and forward', async ({ page }) => {
  await open(page, '/about');
  await expect(page.locator('[data-demo-about]')).toBeVisible();
  await page.getByRole('link', { name: 'Purchase Orders' }).last().click();
  await waitForRows(page, 'PurchaseOrders');
  await table(page, 'PurchaseOrders').locator('[data-sk-row-nav]').first().click();
  await expect(page).toHaveURL(/object\?path=/);
  await page.goBack();
  await expect(page).toHaveURL(/\/po$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/about\?/);
  await expect(page.locator('[data-demo-about]')).toBeVisible();
  await page.goForward();
  await waitForRows(page, 'PurchaseOrders');
  await page.getByRole('link', { name: 'About' }).click();
  await expect(page.locator('[data-demo-about]')).toBeVisible();
});

test('AC-EXT-04 a page built with hooks only', async ({ page }) => {
  await open(page, '/hooks');
  await page.getByRole('button', { name: 'Go' }).click();
  await expect(page.locator('[data-demo-row]').first()).toBeVisible();
  await expect(page.locator('[data-demo-row]')).toHaveCount(15);
  await page.locator('[data-demo-row]').first().click();
  await expect(page.locator('[data-demo-detail]')).toContainText('Details: 45');
  await expect(page.locator('.sk-table, .sk-filterbar')).toHaveCount(0);
});

for (const svc of [
  { name: 'purchasing', list: '/po', set: 'PurchaseOrders', first: 'DataField::PurchaseOrder' },
  { name: 'northwind', list: '/nw/products', set: 'Products', first: 'DataField::ProductID' },
]) {
  test(`@both multi-backend: list, sort, object page and back (${svc.name}) AC-BOOT-02`, async ({ page }) => {
    await open(page, svc.list);
    const t = await waitForRows(page, svc.set);
    await expect.poll(() => titleCount(page, svc.set)).toBeGreaterThan(0);
    await t.locator(`.ag-header-cell[col-id="${svc.first}"] .ag-header-cell-label`).click();
    await t.locator(`.ag-header-cell[col-id="${svc.first}"] .ag-header-cell-label`).click();
    await expect(t.locator(`.ag-header-cell[col-id="${svc.first}"]`)).toHaveAttribute('aria-sort', 'descending');
    await expect.poll(async () => (await columnTexts(page, svc.set, svc.first))[0] ?? '').not.toBe('');
    const firstValue = (await columnTexts(page, svc.set, svc.first))[0]!;
    await t.locator('[data-sk-row-nav]').first().click();
    await expect(page.locator('.sk-dynamic-page__heading')).not.toBeEmpty();
    await expect(page.locator('[data-sk-section]').first()).toBeVisible();
    await expect(page.locator('.sk-form__field').first()).toBeVisible();
    await page.goBack();
    await waitForRows(page, svc.set);
    await expect.poll(async () => (await columnTexts(page, svc.set, svc.first))[0]).toBe(firstValue);
  });
}

test('AC-BOOT-02 northwind without annotations: derived filters, columns and sections', async ({ page }) => {
  await open(page, '/nw/orders');
  const t = await waitForRows(page, 'Orders');
  const headers = await t.locator('.ag-header-cell-text').allInnerTexts();
  expect(headers).toEqual(expect.arrayContaining(['Order ID', 'Customer ID', 'Order Date']));
  await showFilters(page);
  await expect(page.locator('[data-sk-filter="OrderID"]')).toBeVisible();
  await t.locator('[data-sk-row-nav]').first().click();
  await expect(page.locator('[data-sk-section="GeneralInformation"]')).toBeVisible();
  await expect(page.locator('[data-sk-anchor="OrderDetails::LineItem"]')).toBeVisible();
  await page.locator('[data-sk-anchor="OrderDetails::LineItem"]').click();
  await expect(table(page, 'OrderDetails').locator('.ag-row[row-index]').first()).toBeVisible();
});
