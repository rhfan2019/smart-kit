/**
 * Grouping, group subtotals and totals of list tables (docs/23 §7, GT-01–GT-10, revised by D39 — docs/23 §10): totals
 * and subtotals only in the analytical table (`/po?table=analytical`), only for custom aggregates; the responsive table
 * groups without subtotals; the grid table neither groups nor totals. As in FE, the currency is aggregated with the
 * amount: one currency is shown with the total, several show "Show Details" (a popover with one line per currency).
 */
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

/** Sums per currency, formatted as the table shows them (en-US, currency digits), sorted by currency (FE details). */
function sums(rows: Order[]): string[] {
  const by = new Map<string, number>();
  for (const r of rows) by.set(r.Currency, (by.get(r.Currency) ?? 0) + Number(r.NetAmount));
  return [...by.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([cur, v]) => {
    const digits = new Intl.NumberFormat('en', { style: 'currency', currency: cur }).resolvedOptions().maximumFractionDigits;
    return `${new Intl.NumberFormat('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v)} ${cur}`;
  });
}

const lines = async (cell: import('@playwright/test').Locator) => cell.locator('.sk-total__line').allInnerTexts();

/**
 * Checks a total (or subtotal) cell against the orders it covers: one currency is shown in the cell; several show
 * "Show Details" (FE multi-unit link), whose popover lists the amount per currency.
 */
async function expectTotal(page: Page, cell: import('@playwright/test').Locator, rows: Order[], o: { details?: string; title?: string } = {}) {
  const expected = sums(rows);
  if (expected.length === 1) {
    await expect.poll(() => lines(cell)).toEqual(expected);
    return;
  }
  const link = cell.getByRole('button', { name: o.details ?? 'Show Details' });
  await expect(link).toBeVisible();
  await link.click();
  const popover = page.locator('[data-sk-total-units]');
  await expect(popover).toContainText(o.title ?? 'Totals');
  await expect.poll(() => popover.locator('[data-sk-total-unit-line]').allInnerTexts()).toEqual(expected);
  await page.keyboard.press('Escape');
  await expect(popover).toHaveCount(0);
}

/** The purchase order list with the analytical table (D39). */
const ANALYTICAL = '/po?table=analytical';

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

test('GT-01 the Totals tab lists the custom aggregates, only in the analytical table', async ({ page }) => {
  await open(page, ANALYTICAL);
  await waitForRows(page, PO);
  await openSettings(page);
  await page.locator('[data-sk-p13n-totals-tab]').click();
  const boxes = page.locator('[data-sk-p13n-total]');
  await expect(boxes).toHaveCount(1);
  await expect(boxes.first()).toHaveAttribute('data-sk-p13n-total', 'DataField::NetAmount');
  await expect(page.getByRole('checkbox', { name: 'Net Amount' })).toBeChecked();
  await shot(page, 'GT-01', page.getByRole('dialog'));
  await page.keyboard.press('Escape');
  // grid table (the default of /po): neither a Group nor a Totals tab, no totals row, no $apply (D39, FE GridTable)
  const rec = recordOData(page);
  await open(page, '/po');
  await waitForRows(page, PO);
  await openSettings(page);
  await expect(page.locator('[data-sk-p13n-group-tab]')).toHaveCount(0);
  await expect(page.locator('[data-sk-p13n-totals-tab]')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(table(page, PO).locator('.sk-table__total-row')).toHaveCount(0);
  expect(rec.urls.filter((u) => u.includes('$apply='))).toEqual([]);
  // responsive table: a Group tab, no Totals tab
  await open(page, '/po?table=responsive');
  await expect(table(page, PO).locator('tr[data-sk-row]').first()).toBeVisible();
  await openSettings(page);
  await expect(page.locator('[data-sk-p13n-group-tab]')).toHaveCount(1);
  await expect(page.locator('[data-sk-p13n-totals-tab]')).toHaveCount(0);
  await page.keyboard.press('Escape');
});

test('GT-02 GT-03 analytical table: the totals row shows the service totals for the current filters, per currency', async ({ page, request }) => {
  const rec = recordOData(page);
  await open(page, ANALYTICAL);
  await waitForRows(page, PO);
  expect(sums(await orders(request, DEFAULT_FILTER)).length).toBeGreaterThan(1); // several currencies
  const total = table(page, PO).locator('.sk-table__total-row [data-sk-total="NetAmount"]');
  await expect(table(page, PO).locator('.sk-table__total-row [data-sk-total-label]')).toHaveText('Total');
  // the custom aggregate with its currency, as FE (docs/29 §4 P1-2, D39): several currencies -> "Show Details"
  await expect.poll(() => rec.urls.some((u) => u.includes(`$apply=filter(${DEFAULT_FILTER})/aggregate(NetAmount,Currency)`))).toBe(true);
  await expect(total).toHaveAttribute('data-sk-total-multi-unit');
  await shot(page, 'GT-02', table(page, PO));
  await expectTotal(page, total, await orders(request, DEFAULT_FILTER));
  expect(rec.urls.some((u) => u.includes(`$apply=filter(${DEFAULT_FILTER})/groupby((Currency),aggregate(NetAmount))&$orderby=Currency&$top=100`))).toBe(true);
  // scrolling loads more blocks but does not change the totals
  await table(page, PO).locator('.ag-grid-viewport').evaluate((el) => el.scrollTo(0, 4000));
  await page.waitForTimeout(500);
  await expectTotal(page, total, await orders(request, DEFAULT_FILTER));
});

test('GT-02 responsive table: no totals row and no totals request (D39)', async ({ page }) => {
  const rec = recordOData(page);
  await open(page, '/po?table=responsive');
  await expect(table(page, PO).locator('tr[data-sk-row]').first()).toBeVisible();
  await page.waitForTimeout(500);
  await expect(table(page, PO).locator('[data-sk-total-row]')).toHaveCount(0);
  expect(rec.urls.filter((u) => u.includes('$apply='))).toEqual([]);
});

test('GT-04 GT-06 responsive table grouped by status: group headers with the group value, without count or subtotal (D39)', async ({ page }) => {
  const rec = recordOData(page);
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
  await expect(header).toContainText('Status: ');
  await page.waitForTimeout(500);
  await expect(table(page, PO).locator('[data-sk-group-row][data-sk-group-count]')).toHaveCount(0);
  await expect(header.locator('[data-sk-total]')).toHaveCount(0);
  expect(rec.urls.filter((u) => u.includes('$apply='))).toEqual([]);
  await mainScroll(page, 0);
  await shot(page, 'GT-04');
});

test('GT-10 analytical table grouped by supplier: group rows with count and subtotal; sorting stays inside the groups; more rows while scrolling', async ({ page, request }) => {
  const rec = recordOData(page);
  await open(page, ANALYTICAL);
  await waitForRows(page, PO);
  await groupBy(page, 'Supplier');
  const groupRows = table(page, PO).locator('.ag-row.sk-table__group-row');
  const header = groupRows.first();
  await expect(header.locator('[data-sk-group-count]')).toHaveAttribute('data-sk-group-count', /\d+/);
  // the first data row after the header belongs to the group: its supplier tells the group
  const all = await orders(request, DEFAULT_FILTER);
  const firstPo = (await table(page, PO).locator('.ag-row:not(.sk-table__group-row)[row-index="1"] [col-id="DataField::PurchaseOrder"]').innerText()).trim();
  const supplier = all.find((o) => o.PurchaseOrder === firstPo)?.Supplier;
  const inGroup = all.filter((o) => o.Supplier === supplier);
  await expect(header.locator('[data-sk-group-count]')).toHaveAttribute('data-sk-group-count', String(inGroup.length));
  await expect(header).toContainText(`(${inGroup.length})`);
  await expectTotal(page, header.locator('[data-sk-total="NetAmount"]'), inGroup, { title: 'Subtotals' });
  // group rows cannot be selected
  await expect(table(page, PO).locator('.sk-table__group-row input[type="checkbox"]:visible')).toHaveCount(0);
  // a header click sorts inside the groups on the service: the group property stays first
  await table(page, PO).locator('.ag-header-cell[col-id="DataField::PurchaseOrder"] .ag-header-cell-label').click();
  await expect.poll(() => rec.urls.some((u) => /\$orderby=Supplier( asc)?,PurchaseOrder/.test(decodeURIComponent(u)))).toBe(true);
  await expect(groupRows.first()).toBeVisible();
  // more rows (and subtotals of the new groups) while scrolling
  const before = await groupRows.count();
  const asked = () => rec.urls.filter((u) => u.includes('$skip=100') || u.includes('$skip=200')).length;
  for (let i = 0; i < 3; i++) {
    await table(page, PO).locator('.ag-body-vertical-scroll-viewport').evaluate((el) => el.scrollTo({ top: el.scrollHeight }));
    await page.waitForTimeout(700);
  }
  expect(asked()).toBeGreaterThan(0);
  expect(before).toBeGreaterThan(0);
  await shot(page, 'GT-10');
});

test('GT-05 more rows request subtotals only for new groups, at most 50 values per request', async ({ page }) => {
  const rec = recordOData(page);
  await open(page, ANALYTICAL);
  await waitForRows(page, PO);
  await groupBy(page, 'Supplier');
  await expect(table(page, PO).locator('.sk-table__group-row [data-sk-total="NetAmount"]').first()).toBeVisible();
  for (let i = 0; i < 4; i++) {
    await table(page, PO).locator('.ag-body-vertical-scroll-viewport').evaluate((el) => el.scrollTo({ top: el.scrollHeight }));
    await page.waitForTimeout(700);
  }
  const subtotalUrls = rec.urls.filter((u) => u.includes('groupby((Supplier,'));
  expect(subtotalUrls.length).toBeGreaterThan(1);
  const asked = subtotalUrls.map((u) => [...u.matchAll(/Supplier eq '(\d+)'/g)].map((m) => m[1]!));
  for (const values of asked) expect(values.length).toBeLessThanOrEqual(50);
  const flat = asked.flat();
  expect(new Set(flat).size).toBe(flat.length); // no group asked twice
  // every group header that is rendered has its subtotal
  const labels = table(page, PO).locator('.sk-table__group-row [data-sk-group-row]');
  const n = await labels.count();
  await expect.poll(() => table(page, PO).locator('.sk-table__group-row [data-sk-group-row][data-sk-group-count]').count()).toBe(n);
});

test('GT-07 grouping and totals are stored in the variant and restored', async ({ page }) => {
  await open(page, ANALYTICAL);
  await waitForRows(page, PO);
  await groupBy(page, 'Order Type');
  await openSettings(page);
  await page.locator('[data-sk-p13n-totals-tab]').click();
  await page.getByRole('checkbox', { name: 'Net Amount' }).uncheck();
  await page.locator('[data-sk-p13n-ok]').click();
  await expect(table(page, PO).locator('.sk-table__total-row')).toHaveCount(0);
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
  await expect(table(page, PO).locator('.sk-table__group-row')).toHaveCount(0);
  await expect(table(page, PO).locator('.sk-table__total-row')).toBeVisible();
  // back to the saved variant
  await page.locator('[data-sk-variant]').click();
  await page.getByRole('menuitem', { name: 'By type' }).click();
  await expect(table(page, PO).locator('.sk-table__group-row').first()).toContainText('Order Type:');
  await expect(table(page, PO).locator('.sk-table__total-row')).toHaveCount(0);
});

test('GT-08 totals follow the filters; a failing totals request shows "–" and keeps the rows', async ({ page, request }) => {
  await open(page, ANALYTICAL);
  await waitForRows(page, PO);
  const total = table(page, PO).locator('.sk-table__total-row [data-sk-total="NetAmount"]');
  await expectTotal(page, total, await orders(request, DEFAULT_FILTER));
  await page.locator('[data-sk-header-toggle]').click();
  await clearFilter(page, 'Status');
  const st = filterInput(page, 'Status');
  await st.fill('=NEW');
  await st.press('Enter');
  const NEW = "Status eq 'NEW' and CompanyCode eq '1000'";
  await page.waitForTimeout(500);
  await expectTotal(page, total, await orders(request, NEW));
  await page.locator('[data-sk-header-toggle]').click();
  // deleting a row refreshes the totals
  const before = await orders(request, NEW);
  await table(page, PO).locator('.ag-row[row-index="0"] input[type="checkbox"]').first().check();
  await table(page, PO).locator('[data-sk-action="Delete"]').click();
  await page.locator('[data-sk-delete-confirm]').click();
  await expect.poll(async () => (await orders(request, NEW)).length).toBe(before.length - 1);
  await page.waitForTimeout(500);
  await expectTotal(page, total, await orders(request, NEW));
  // the totals request fails: the rows stay, the total shows "–" and the label explains why
  await page.route(/\$apply=|%24apply=/, (route) => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: { code: 'X', message: 'Aggregation down' } }) }));
  await open(page, ANALYTICAL);
  await waitForRows(page, PO);
  await expect(table(page, PO).locator('.sk-table__total-row [data-sk-total="NetAmount"]')).toHaveText('–', { timeout: 15_000 });
  await expect(table(page, PO).locator('.sk-table__total-row [data-sk-total-label]')).toHaveAttribute('title', /Aggregation down/);
});

test('GT-09 Chinese, dark theme and compact density', async ({ page, request }) => {
  await open(page, ANALYTICAL, { lang: 'zh', theme: 'dark', density: 'compact' });
  await waitForRows(page, PO);
  const row = table(page, PO).locator('.sk-table__total-row').first();
  await expect(row.locator('[data-sk-total-label]').first()).toHaveText('合计');
  await shot(page, 'GT-09-grid', table(page, PO));
  // several currencies: "显示详细信息", popover "总计" (sap.fe.macros / sap.m texts)
  await expectTotal(page, row.locator('[data-sk-total="NetAmount"]'), await orders(request, DEFAULT_FILTER), { details: '显示详细信息', title: '总计' });
});
