/** Grouping, group subtotals and totals of list tables (docs/23 §7, GT-01–GT-09). */
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { evidence, filterInput, clearFilter, mainScroll, open, recordOData, resetServer, table, waitForRows, PURCHASING } from './helpers';

test.beforeEach(async ({ page }) => resetServer(page));

const shot = (page: Page, id: string, target?: import('@playwright/test').Locator) => evidence(page, id, target, '24-evidence');
const PO = 'PurchaseOrders';
/** The default selection variant of /po. */
const DEFAULT_FILTER = "Status ne 'CLOSED' and CompanyCode eq '1000'";

type Order = { PurchaseOrder: string; Status: string; Supplier: string; NetAmount: number | string; Currency: string };

/** All orders matching a filter, read page by page (independent of $apply). */
async function orders(request: APIRequestContext, filter: string): Promise<Order[]> {
  const out: Order[] = [];
  for (let skip = 0; ; skip += 500) {
    // encoded by hand: `params` would write spaces as "+", which smart-kit-server reads literally
    const q = `$filter=${encodeURIComponent(filter)}&$select=PurchaseOrder,Status,Supplier,NetAmount,Currency&$orderby=PurchaseOrder&$skip=${skip}&$top=500`;
    const res = await request.get(`${PURCHASING}/${PO}?${q}`);
    expect(res.ok()).toBeTruthy();
    const page = ((await res.json()) as { value: Order[] }).value;
    out.push(...page);
    if (page.length < 500) return out;
  }
}

/** Sums per currency, formatted as the table shows them (en-US, currency digits), largest first. */
function sums(rows: Order[]): string[] {
  const by = new Map<string, number>();
  for (const r of rows) by.set(r.Currency, (by.get(r.Currency) ?? 0) + Number(r.NetAmount));
  return [...by.entries()].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).map(([cur, v]) => {
    const digits = new Intl.NumberFormat('en', { style: 'currency', currency: cur }).resolvedOptions().maximumFractionDigits;
    return `${new Intl.NumberFormat('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v)} ${cur}`;
  });
}

const lines = async (cell: import('@playwright/test').Locator) => cell.locator('.sk-total__line').allInnerTexts();

async function openSettings(page: Page) {
  await table(page, PO).locator('[data-sk-table-settings]').click();
}

async function groupBy(page: Page, label: string) {
  await openSettings(page);
  await page.locator('[data-sk-p13n-group-tab]').click();
  await page.locator('[data-sk-p13n-group]').click();
  await page.getByRole('option', { name: label, exact: true }).click();
  await page.locator('[data-sk-p13n-ok]').click();
}

test('GT-01 the Totals tab lists only aggregatable columns, and only for services with Aggregation.ApplySupported', async ({ page }) => {
  await open(page, '/po');
  await waitForRows(page, PO);
  await openSettings(page);
  await page.locator('[data-sk-p13n-totals-tab]').click();
  const boxes = page.locator('[data-sk-p13n-total]');
  await expect(boxes).toHaveCount(1);
  await expect(boxes.first()).toHaveAttribute('data-sk-p13n-total', 'DataField::NetAmount');
  await expect(page.getByRole('checkbox', { name: 'Net Amount' })).toBeChecked();
  await shot(page, 'GT-01', page.getByRole('dialog'));
  await page.keyboard.press('Escape');
  // Northwind declares no Aggregation.ApplySupported: no Totals tab, no totals row
  await open(page, '/nw/products');
  await waitForRows(page, 'Products');
  await table(page, 'Products').locator('[data-sk-table-settings]').click();
  await expect(page.locator('[data-sk-p13n-group-tab], [data-sk-p13n-totals-tab]')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(table(page, 'Products').locator('.sk-table__total-row')).toHaveCount(0);
});

test('GT-02 GT-03 grid: the totals row shows the service totals for the current filters, per currency', async ({ page, request }) => {
  const rec = recordOData(page);
  await open(page, '/po');
  await waitForRows(page, PO);
  const expected = sums(await orders(request, DEFAULT_FILTER));
  expect(expected.length).toBeGreaterThan(1); // several currencies
  const total = table(page, PO).locator('.sk-table__total-row [data-sk-total="NetAmount"]');
  await expect.poll(() => lines(total)).toEqual(expected);
  await expect(table(page, PO).locator('.sk-table__total-row [data-sk-total-label]')).toHaveText('Total');
  expect(rec.urls.some((u) => u.includes(`$apply=filter(${DEFAULT_FILTER})/groupby((Currency),aggregate(NetAmount with sum as NetAmount))`))).toBe(true);
  // scrolling loads more blocks but does not change the totals
  await table(page, PO).locator('.ag-grid-viewport').evaluate((el) => el.scrollTo(0, 4000));
  await page.waitForTimeout(500);
  expect(await lines(total)).toEqual(expected);
  await shot(page, 'GT-02', table(page, PO));
});

test('GT-02 GT-03 responsive table: totals row after the rows, per currency', async ({ page, request }) => {
  await open(page, '/po?table=responsive');
  const expected = sums(await orders(request, DEFAULT_FILTER));
  const total = table(page, PO).locator('[data-sk-total-row] [data-sk-total="NetAmount"]');
  await expect.poll(() => lines(total)).toEqual(expected);
  await expect(table(page, PO).locator('[data-sk-total-row] th')).toHaveText('Total');
  await shot(page, 'GT-03', table(page, PO).locator('[data-sk-total-row]'));
});

test('GT-04 GT-06 responsive table grouped by status: header with count and subtotal of the group', async ({ page, request }) => {
  await open(page, '/po?table=responsive');
  await expect(table(page, PO).locator('tr[data-sk-row]').first()).toBeVisible();
  // only GroupableProperties of the visible columns are offered
  await openSettings(page);
  await page.locator('[data-sk-p13n-group-tab]').click();
  await page.locator('[data-sk-p13n-group]').click();
  await expect(page.getByRole('option')).toHaveText(['No grouping', 'Supplier', 'Status', 'Order Type']);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await groupBy(page, 'Status');
  const header = table(page, PO).locator('[data-sk-group-row]').first();
  await expect(header).toHaveAttribute('data-sk-group-count', /\d+/);
  const all = await orders(request, DEFAULT_FILTER);
  const firstStatus = (await table(page, PO).locator('[data-sk-group-row]').first().getAttribute('data-sk-group-row'))!;
  // the first data row tells the status code of the group
  const firstPo = (await table(page, PO).locator('tr[data-sk-row]').first().locator('td').nth(1).innerText()).trim();
  const code = all.find((o) => o.PurchaseOrder === firstPo)?.Status;
  const inGroup = all.filter((o) => o.Status === code);
  await expect(header).toHaveAttribute('data-sk-group-count', String(inGroup.length));
  await expect(header).toContainText(`Status: ${firstStatus} (${inGroup.length})`);
  await expect.poll(() => lines(header.locator('[data-sk-total="NetAmount"]'))).toEqual(sums(inGroup));
  await mainScroll(page, 0);
  await shot(page, 'GT-04');
});

test('GT-05 more rows request subtotals only for new groups, at most 50 values per request', async ({ page }) => {
  const rec = recordOData(page);
  await open(page, '/po?table=responsive');
  await expect(table(page, PO).locator('tr[data-sk-row]').first()).toBeVisible();
  await groupBy(page, 'Supplier');
  await expect(table(page, PO).locator('[data-sk-group-row] [data-sk-total="NetAmount"]').first()).toBeVisible();
  for (let i = 0; i < 4; i++) {
    await page.locator('#demo-main').evaluate((el) => el.scrollTo({ top: el.scrollHeight }));
    await page.waitForTimeout(700);
  }
  const subtotalUrls = rec.urls.filter((u) => u.includes('groupby((Supplier,'));
  expect(subtotalUrls.length).toBeGreaterThan(1);
  const asked = subtotalUrls.map((u) => [...u.matchAll(/Supplier eq '(\d+)'/g)].map((m) => m[1]!));
  for (const values of asked) expect(values.length).toBeLessThanOrEqual(50);
  const flat = asked.flat();
  expect(new Set(flat).size).toBe(flat.length); // no group asked twice
  // every group header that is loaded has its subtotal
  const headers = table(page, PO).locator('[data-sk-group-row]');
  const n = await headers.count();
  await expect.poll(() => table(page, PO).locator('[data-sk-group-row][data-sk-group-count]').count()).toBe(n);
});

test('GT-07 grouping and totals are stored in the variant and restored', async ({ page }) => {
  await open(page, '/po?table=responsive');
  await expect(table(page, PO).locator('tr[data-sk-row]').first()).toBeVisible();
  await groupBy(page, 'Order Type');
  await openSettings(page);
  await page.locator('[data-sk-p13n-totals-tab]').click();
  await page.getByRole('checkbox', { name: 'Net Amount' }).uncheck();
  await page.locator('[data-sk-p13n-ok]').click();
  await expect(table(page, PO).locator('[data-sk-total-row]')).toHaveCount(0);
  await expect(page.locator('[data-sk-variant-modified]')).toBeVisible();
  await page.locator('[data-sk-variant]').click();
  await page.locator('[data-sk-variant-saveas]').click();
  const dialog = page.getByRole('dialog', { name: 'Save As' });
  await dialog.getByRole('textbox', { name: 'View' }).fill('By type');
  await dialog.locator('[data-sk-variant-saveas-ok]').click();
  const res = await page.request.get(`${PURCHASING}/Variants?$filter=PageKey eq 'po'`);
  const content = JSON.parse(((await res.json()) as { value: { Content: string }[] }).value[0]!.Content);
  expect(content).toMatchObject({ groupBy: 'DataField::PurchaseOrderType', totals: [] });
  // Standard: no grouping, default totals (UI.PresentationVariant/Total)
  await page.locator('[data-sk-variant]').click();
  await page.getByRole('menuitem', { name: 'Standard' }).click();
  await expect(table(page, PO).locator('[data-sk-group-row]')).toHaveCount(0);
  await expect(table(page, PO).locator('[data-sk-total-row]')).toBeVisible();
  // back to the saved variant
  await page.locator('[data-sk-variant]').click();
  await page.getByRole('menuitem', { name: 'By type' }).click();
  await expect(table(page, PO).locator('[data-sk-group-row]').first()).toContainText('Order Type:');
  await expect(table(page, PO).locator('[data-sk-total-row]')).toHaveCount(0);
});

test('GT-08 totals follow the filters; a failing totals request shows "–" and keeps the rows', async ({ page, request }) => {
  await open(page, '/po');
  await waitForRows(page, PO);
  const total = table(page, PO).locator('.sk-table__total-row [data-sk-total="NetAmount"]');
  await expect.poll(() => lines(total)).toEqual(sums(await orders(request, DEFAULT_FILTER)));
  await page.locator('[data-sk-header-toggle]').click();
  await clearFilter(page, 'Status');
  const st = filterInput(page, 'Status');
  await st.fill('=NEW');
  await st.press('Enter');
  const NEW = "Status eq 'NEW' and CompanyCode eq '1000'";
  await expect.poll(() => lines(total)).toEqual(sums(await orders(request, NEW)));
  await page.locator('[data-sk-header-toggle]').click();
  // deleting a row refreshes the totals
  const before = await orders(request, NEW);
  await table(page, PO).locator('.ag-row[row-index="0"] input[type="checkbox"]').first().check();
  await table(page, PO).locator('[data-sk-action="Delete"]').click();
  await page.locator('[data-sk-delete-confirm]').click();
  await expect.poll(async () => (await orders(request, NEW)).length).toBe(before.length - 1);
  await expect.poll(async () => lines(total)).toEqual(sums(await orders(request, NEW)));
  // the totals request fails: the rows stay, the total shows "–" and the label explains why
  await page.route(/\$apply=|%24apply=/, (route) => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: { code: 'X', message: 'Aggregation down' } }) }));
  await open(page, '/po');
  await waitForRows(page, PO);
  await expect(table(page, PO).locator('.sk-table__total-row [data-sk-total="NetAmount"]')).toHaveText('–', { timeout: 15_000 });
  await expect(table(page, PO).locator('.sk-table__total-row [data-sk-total-label]')).toHaveAttribute('title', /Aggregation down/);
});

test('GT-09 Chinese, dark theme and compact density', async ({ page, request }) => {
  await open(page, '/po?table=responsive', { lang: 'zh', theme: 'dark', density: 'compact' });
  const totalRow = table(page, PO).locator('[data-sk-total-row]');
  await expect(totalRow.locator('th')).toHaveText('合计');
  await expect.poll(() => lines(totalRow.locator('[data-sk-total="NetAmount"]'))).toHaveLength(sums(await orders(request, DEFAULT_FILTER)).length);
  await shot(page, 'GT-09-responsive', table(page, PO));
  await open(page, '/po', { lang: 'zh', theme: 'dark', density: 'compact' });
  await waitForRows(page, PO);
  const row = table(page, PO).locator('.sk-table__total-row').first();
  await expect(row.locator('[data-sk-total-label]').first()).toHaveText('合计');
  // the row grows with the number of currencies (one line each)
  const n = (await lines(row.locator('[data-sk-total="NetAmount"]'))).length;
  const h = await row.evaluate((el) => el.getBoundingClientRect().height);
  expect(h).toBeGreaterThanOrEqual(n * 20 - 1);
  await shot(page, 'GT-09-grid', table(page, PO));
});
