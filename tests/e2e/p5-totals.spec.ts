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
  // the totals are a sap.m.p13n.SelectionPanel in the sap.m.p13n.Popup (stage 6)
  const boxes = page.locator('[data-sk-p13n-panel="totals"] [data-sk-p13n-item]');
  await expect(boxes).toHaveCount(1);
  await expect(boxes.first()).toHaveAttribute('data-sk-p13n-item', 'DataField::NetAmount');
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
  // the custom aggregate with its currency, as FE (docs/29 §4 P1-2, D39): several currencies -> "Show Details";
  // read with the rows and the count in one $apply (AL-10, FE AnalyticalTable: concat)
  await expect.poll(() => rec.urls.some((u) => u.includes(`$apply=filter(${DEFAULT_FILTER})/concat(aggregate(NetAmount,Currency),groupby((`) && u.includes('/concat(aggregate($count as UI5__count),top('))).toBe(true);
  expect(rec.urls.filter((u) => u.includes('/PurchaseOrders?') && !u.includes('$apply=') && u.includes('$count=true'))).toEqual([]);
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
  // FE (responsive table, isGroupable = sortable; FE comparison tests/e2e-fe/colsfe.spec.ts cols5-p13n-ResponsiveTable):
  // every sortable property, alphabetically; the status is shown as its text only, so its text is offered instead
  await openSettings(page);
  await page.locator('[data-sk-p13n-group-tab]').click();
  await page.locator('[data-sk-p13n-group]').click();
  // sap.m.p13n.GroupPanel (QueryPanel): no 'none' entry; a criterion is removed with its remove button (stage 6)
  await expect(page.getByRole('option')).toHaveText(['Budget', 'Company Code', 'Created On', 'Currency', 'Delivery Progress', 'Invoiced Amount',
    'Net Amount', 'Notes', 'Order Date', 'Order Type', 'Order Type Name', 'Purchase Order', 'Purchasing Group', 'Status Criticality', 'Status Name', 'Supplier', 'Supplier Name', 'Version']);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await groupBy(page, 'Status Name');
  const header = table(page, PO).locator('[data-sk-group-row]').first();
  await expect(header).toContainText('Status Name: ');
  await page.waitForTimeout(500);
  await expect(table(page, PO).locator('[data-sk-group-row][data-sk-group-count]')).toHaveCount(0);
  await expect(header.locator('[data-sk-total]')).toHaveCount(0);
  expect(rec.urls.filter((u) => u.includes('$apply='))).toEqual([]);
  await mainScroll(page, 0);
  await shot(page, 'GT-04');
});

test('GT-10 analytical table grouped by supplier: collapsed groups with their subtotals; expanding reads the group\'s rows, the subtotal moves to its bottom (FE groupLevels, macros6)', async ({ page, request }) => {
  const rec = recordOData(page);
  await open(page, ANALYTICAL);
  await waitForRows(page, PO);
  await groupBy(page, 'Supplier');
  const groupRows = table(page, PO).locator('.ag-row.sk-table__group-row');
  const header = groupRows.first();
  // FE: one request for the number of rows, the grand total and the groups with their subtotals; the groups are collapsed
  await expect.poll(() => rec.urls.some((u) => /UI5__leaves.*groupby\(\(Supplier\)/.test(decodeURIComponent(u)))).toBe(true);
  await expect(header.locator('[data-sk-group-row]')).toHaveAttribute('data-sk-group-expanded', 'false');
  await expect(table(page, PO).locator('.ag-row:not(.sk-table__group-row):not(.ag-row-pinned)')).toHaveCount(0);
  const supplier = (await header.getAttribute('row-id'))!.replace(/^\$smartKitGroup:/, '');
  const all = await orders(request, DEFAULT_FILTER);
  const inGroup = all.filter((o) => o.Supplier === supplier);
  await expectTotal(page, header.locator('[data-sk-total="NetAmount"]'), inGroup, { title: 'Subtotals' });
  // group rows cannot be selected
  await expect(table(page, PO).locator('.sk-table__group-row input[type="checkbox"]:visible')).toHaveCount(0);
  // expanding: the group's rows with the group's condition first, their number in the header, the subtotal at the bottom
  await header.locator('[data-sk-group-toggle]').click();
  await expect.poll(() => rec.urls.some((u) => decodeURIComponent(u).includes(`$filter=Supplier eq '${supplier}' and (`))).toBe(true);
  await expect(header.locator('[data-sk-group-count]')).toHaveAttribute('data-sk-group-count', String(inGroup.length));
  await expect(header.locator('[data-sk-total]')).toHaveCount(0);
  await expectTotal(page, table(page, PO).locator(`.ag-row[row-id="$smartKitGroup:${supplier}:bottom"] [data-sk-total="NetAmount"]`), inGroup, { title: 'Subtotals' });
  await shot(page, 'GT-10');
});

test('GT-05 the subtotals come with the groups: no request per group before a group is expanded', async ({ page }) => {
  const rec = recordOData(page);
  await open(page, ANALYTICAL);
  await waitForRows(page, PO);
  await groupBy(page, 'Supplier');
  await expect(table(page, PO).locator('.sk-table__group-row [data-sk-total="NetAmount"]').first()).toBeVisible();
  await page.waitForTimeout(700);
  expect(rec.urls.filter((u) => /Supplier eq '/.test(decodeURIComponent(u)))).toEqual([]);
  // every group header that is rendered has its subtotal
  const labels = table(page, PO).locator('.sk-table__group-row [data-sk-group-row]');
  const n = await labels.count();
  expect(n).toBeGreaterThan(0);
  await expect.poll(() => table(page, PO).locator('.sk-table__group-row [data-sk-total="NetAmount"]').count()).toBe(n);
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

test('GT-08 totals follow the filters; a failing request of rows and totals shows the error (AL-10)', async ({ page, request }) => {
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
  // the totals are read with the rows (AL-10, one $apply as FE): when that request fails, the table shows the error
  // and no totals row (before: a separate totals request failed alone and the rows stayed)
  await page.route(/\$apply=|%24apply=/, (route) => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: { code: 'X', message: 'Aggregation down' } }) }));
  await open(page, ANALYTICAL);
  await expect(table(page, PO).locator('.sk-table__error')).toContainText('Aggregation down', { timeout: 15_000 });
  await expect(table(page, PO).locator('.sk-table__total-row')).toHaveCount(0);
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
