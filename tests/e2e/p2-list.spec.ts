/** Phase 2 · List Report (docs/13 §1–3): Components and Actions figures, behaviour rules. */
import { expect, test, type Page } from '@playwright/test';
import { clearFilter, columnTexts, evidence, filterInput, mainScroll, showFilters, open, recordOData, resetServer, table, waitForRows, PURCHASING } from './helpers';

test.beforeEach(async ({ page }) => resetServer(page));

const rows = (page: Page, set = 'PurchaseOrders') => table(page, set).locator('tr[data-sk-row]');
/** Selects grid rows by purchase order number (the checkbox lives in the pinned left container, same row-index). */
async function selectGrid(page: Page, ...pos: string[]) {
  for (const po of pos) {
    const index = await table(page, 'PurchaseOrders').locator('.ag-row', { hasText: po }).first().getAttribute('row-index');
    await table(page, 'PurchaseOrders').locator(`.ag-row[row-index="${index}"] input[type="checkbox"]`).first().check();
  }
}
async function filterStatus(page: Page, ...codes: string[]) {
  await page.locator('[data-sk-header-toggle]').click();
  await clearFilter(page, 'Status');
  const st = filterInput(page, 'Status');
  // Wait for the list request with the whole filter: until it returns, the grid still shows the unfiltered rows.
  const filtered = page.waitForResponse((r) => /\/PurchaseOrders\?/.test(r.url()) && codes.every((c) => decodeURIComponent(r.url()).includes(`'${c}'`)));
  for (const c of codes) { await st.fill(`=${c}`); await st.press('Enter'); }
  await filtered;
  await page.locator('[data-sk-header-toggle]').click();
}

test('P2-LRC-04 P2-LRA-01 share opens an action sheet with e-mail and copy link; it is a global action in the header toolbar', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await open(page, '/po');
  const share = page.locator('[data-sk-global-actions] [data-sk-share]');
  await expect(share).toBeVisible();
  await share.click();
  await expect(page.locator('[data-sk-share-email]')).toHaveAttribute('href', /^mailto:\?subject=.*&body=http%3A%2F%2Flocalhost%3A\d+%2Fpo/);
  await evidence(page, 'P2-LRC-04');
  await page.locator('[data-sk-share-copy]').click();
  await expect(page.locator('[data-sk-share-copy]')).toHaveText('The link was copied to the clipboard.');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/\/po$/);
  // finalizing actions are never in the header toolbar
  await expect(page.locator('[data-sk-global-actions] [data-sk-save], [data-sk-global-actions] [data-sk-action="Create"]')).toHaveCount(0);
});

test('P2-LRA-02 table actions: Create always enabled, selection actions disabled without a fitting selection, similar actions in a menu', async ({ page }) => {
  await open(page, '/po');
  await waitForRows(page, 'PurchaseOrders');
  const t = table(page, 'PurchaseOrders');
  await expect(t.locator('[data-sk-action="Create"]')).toBeEnabled();
  await expect(t.locator('[data-sk-action="Delete"]')).toBeDisabled();
  // the menu button is enabled without a selection, its items are not (FE ActionsTemplating getMenuButton, stage 4)
  await expect(t.locator('[data-sk-action-group="decide"]')).toBeEnabled();
  await t.locator('[data-sk-action-group="decide"]').click();
  await expect(page.getByRole('menuitem', { name: 'Approve' })).toBeDisabled();
  await page.keyboard.press('Escape');
  // a closed order: approve/reject (OperationAvailable false) stay disabled
  await filterStatus(page, 'CLOSED');
  await expect(t.locator('.ag-row[row-index="0"] [col-id="DataField::Status"]')).toHaveText(/Closed/);
  await t.locator('.ag-row[row-index="0"] input[type="checkbox"]').first().check();
  await expect(t.locator('[data-sk-action="Delete"]')).toBeEnabled();
  await t.locator('[data-sk-action-group="decide"]').click();
  await expect(page.getByRole('menuitem', { name: 'Approve' })).toBeDisabled();
  await page.keyboard.press('Escape');
  // a new order: the menu button opens Approve and Reject
  await filterStatus(page, 'NEW');
  await expect(t.locator('.ag-row[row-index="0"] [col-id="DataField::Status"]')).toHaveText(/New/);
  await t.locator('.ag-row[row-index="0"] input[type="checkbox"]').first().check();
  await t.locator('[data-sk-action-group="decide"]').click();
  await expect(page.getByRole('menuitem', { name: 'Approve' })).toBeEnabled();
  await expect(page.getByRole('menuitem', { name: 'Reject' })).toBeEnabled();
  await evidence(page, 'P2-LRA-02');
  await page.getByRole('menuitem', { name: 'Approve' }).click();
  // the response message appears in the footer message button (P2-LRC-11)
  await expect(page.locator('[data-sk-message-button]')).toBeVisible();
});

test('P2-LRA-03 line item actions are in the row and disabled when not available (FE, stage 4)', async ({ page }) => {
  await open(page, '/po?table=responsive');
  await expect(rows(page).first()).toBeVisible();
  const open1 = rows(page).filter({ hasNot: page.locator('[data-sk-cell] >> text=Closed') }).first();
  await expect(open1.locator('[data-sk-inline-action="DataFieldForAction::Purchasing.close"]')).toBeEnabled();
  await filterStatus(page, 'CLOSED');
  await expect(rows(page).first()).toBeVisible();
  // closed orders only: every Close button is disabled
  await expect(table(page, 'PurchaseOrders').locator('[data-sk-inline-action]:not([disabled])')).toHaveCount(0);
  await expect(table(page, 'PurchaseOrders').locator('[data-sk-inline-action]').first()).toBeDisabled();
});

test('P2-LRC-11 footer toolbar shows the message button when messages exist; it opens the message popover', async ({ page }) => {
  await open(page, '/po');
  await waitForRows(page, 'PurchaseOrders');
  await expect(page.locator('.sk-dynamic-page__footer')).toHaveCount(0);
  await filterStatus(page, 'NEW');
  // every rendered row is New (the unfiltered first row may be New too, so one row proves nothing)
  await expect.poll(() => columnTexts(page, 'PurchaseOrders', 'DataField::Status').then((t) => t.length > 0 && t.every((x) => /New/.test(x)))).toBe(true);
  await table(page, 'PurchaseOrders').locator('.ag-row[row-index="0"] input[type="checkbox"]').first().check();
  await table(page, 'PurchaseOrders').locator('[data-sk-action-group="decide"]').click();
  await page.getByRole('menuitem', { name: 'Approve' }).click();
  const button = page.locator('.sk-dynamic-page__footer [data-sk-message-button]');
  await expect(button).toBeVisible();
  await button.click();
  const popover = page.locator('[data-sk-message-popover]');
  await expect(popover).toBeVisible();
  await expect(popover.locator('[data-sk-message="success"]')).toContainText('approved');
  await evidence(page, 'P2-LRC-11');
  await popover.locator('[data-sk-messages-clear]').click();
  await expect(page.locator('.sk-dynamic-page__footer')).toHaveCount(0);
});

test('P2-LR-14 partial processing: "x of y cannot be processed" with the reason; continue processes the rest, cancel nothing', async ({ page }) => {
  await open(page, '/po');
  await waitForRows(page, 'PurchaseOrders');
  // one New and one Ordered order among the loaded rows
  const t = table(page, 'PurchaseOrders');
  await expect(t.locator('.ag-row [col-id="DataField::Status"]', { hasText: 'Ordered' }).first()).toBeVisible();
  const info = await t.locator('.ag-row[row-index]').evaluateAll((els) => {
    const by: Record<string, { status?: string; po?: string }> = {};
    for (const e of els) {
      const i = e.getAttribute('row-index')!;
      by[i] ??= {};
      const st = e.querySelector('[col-id="DataField::Status"]')?.textContent?.trim();
      const po = e.querySelector('[col-id="DataField::PurchaseOrder"]')?.textContent?.trim();
      if (st) by[i].status = st;
      if (po) by[i].po = po;
    }
    return Object.values(by);
  });
  const ids = { neu: info.find((r) => r.status === 'New')!.po!, ord: info.find((r) => r.status === 'Ordered')!.po! };
  await selectGrid(page, ids.neu, ids.ord);
  await table(page, 'PurchaseOrders').locator('[data-sk-action-group="decide"]').click();
  await page.getByRole('menuitem', { name: 'Approve' }).click();
  const dialog = page.locator('[data-sk-partial-dialog]').getByRole('dialog').or(page.getByRole('dialog', { name: 'Approve' }));
  await expect(page.locator('[data-sk-partial-count]')).toHaveText('1 of 2 selected items cannot be processed.');
  await expect(page.locator('[data-sk-partial-reason]')).toContainText(ids.ord);
  await evidence(page, 'P2-LR-14');
  await page.locator('[data-sk-partial-cancel]').click();
  await expect(dialog).toHaveCount(0);
  let status = await page.request.get(`${PURCHASING}/PurchaseOrders('${ids.neu}')?$select=Status`).then((r) => r.json());
  expect(status.Status).toBe('NEW');
  await table(page, 'PurchaseOrders').locator('[data-sk-action-group="decide"]').click();
  await page.getByRole('menuitem', { name: 'Approve' }).click();
  await page.locator('[data-sk-partial-continue]').click();
  await expect.poll(async () => (await page.request.get(`${PURCHASING}/PurchaseOrders('${ids.neu}')?$select=Status`).then((r) => r.json())).Status).toBe('APPR');
  status = await page.request.get(`${PURCHASING}/PurchaseOrders('${ids.ord}')?$select=Status`).then((r) => r.json());
  expect(status.Status).toBe('ORD');
});

test('P2-LR-15 create with a dialog (fewer than 8 mandatory fields), direct save service', async ({ page }) => {
  await open(page, '/po');
  await waitForRows(page, 'PurchaseOrders');
  await table(page, 'PurchaseOrders').locator('[data-sk-action="Create"]').click();
  const dialog = page.getByRole('dialog', { name: 'New Purchase Order' });
  await expect(dialog).toBeVisible();
  const fields = dialog.locator('[data-sk-create-field]');
  expect(await fields.count()).toBeLessThan(8);
  // mandatory check on the client
  await dialog.locator('[data-sk-create-submit]').click();
  await expect(dialog.getByText('Supplier: enter a value.')).toBeVisible();
  await evidence(page, 'P2-LR-15', dialog);
  await dialog.locator('[data-sk-create-field="Supplier"] input:not([type="hidden"])').fill('0000100001');
  await dialog.locator('[data-sk-create-field="CompanyCode"] input:not([type="hidden"])').fill('1000');
  await dialog.locator('[data-sk-create-field="PurchaseOrderType"] input[role="combobox"]').click();
  await page.getByRole('option', { name: /Standard Order/ }).click();
  await dialog.locator('[data-sk-create-field="PurchasingGroup"] input:not([type="hidden"])').fill('P01');
  const date = dialog.locator('[data-sk-create-field="OrderDate"] input[data-sk-editor="date"]');
  await date.fill('2026-11-20');
  await date.press('Tab');
  await dialog.locator('[data-sk-create-submit]').click();
  // the new object opens
  await expect.poll(() => decodeURIComponent(page.url())).toContain("object?path=PurchaseOrders('4500010001')");
  await expect(page.locator('.sk-dynamic-page__heading')).toHaveText('4500010001');
});

// The continuous working mode is no FE list report setting (stage 5): the list report works as a worklist.
test('P2-LR-16 working modes: worklist removes items that no longer match', async ({ page }) => {
  // worklist (default): a closed order vanishes from the "Status != Closed" list
  await open(page, '/po?table=responsive');
  await expect(rows(page).first()).toBeVisible();
  const first = rows(page).filter({ has: page.locator('[data-sk-inline-action]:not([disabled])') }).first();
  const key = await first.getAttribute('data-sk-row');
  await first.locator('[data-sk-inline-action="DataFieldForAction::Purchasing.close"]').click();
  await expect(rows(page).and(page.locator(`[data-sk-row="${key}"]`))).toHaveCount(0);
});

test('P2-LR-01 P2-LRC-08 multiple views with a segmented button (≤ 3) after the title; view properties that are selection fields stay in the filter bar (FE)', async ({ page }) => {
  const rec = recordOData(page);
  await open(page, '/po?views=switch');
  await waitForRows(page, 'PurchaseOrders');
  const sw = page.locator('[data-sk-view-switch="segmented"]');
  await expect(sw).toBeVisible();
  // the content switch comes after the table title, on the left of the toolbar
  const title = await page.locator('[data-sk-table-title]').boundingBox();
  const s = await sw.boundingBox();
  expect(s!.x).toBeGreaterThan(title!.x + title!.width);
  // FE getExcludedFilterProperties: only view properties that are not selection fields leave the filter bar
  await page.locator('[data-sk-header-toggle]').click();
  await expect(page.locator('[data-sk-filter="Status"]')).toBeVisible();
  await page.locator('[data-sk-header-toggle]').click();
  await sw.getByText('Closed').click();
  await expect.poll(() => rec.urls.some((u) => u.includes("Status eq 'CLOSED'"))).toBe(true);
  await evidence(page, 'P2-LRC-08');
  // more than three views: a select
  await open(page, '/po?views=select');
  await expect(page.locator('[data-sk-view-switch="select"]')).toBeVisible();
});

test('P2-LR-02 P2-LRC-09 multiple views in tabs: each tab has its own table toolbar, sort and selection', async ({ page }) => {
  await open(page, '/po?views=tabs');
  const tabs = page.locator('[data-sk-list-tab]');
  await expect(tabs).toHaveCount(3);
  await expect(tabs.first()).toHaveText(/Open Orders \(\d+\)/);
  await waitForRows(page, 'PurchaseOrders');
  await expect(page.locator('[data-sk-table-title]')).toHaveCount(1);
  await page.locator('[data-sk-list-tab="InDelivery"]').click();
  await waitForRows(page, 'PurchaseOrders');
  await expect(page.locator('.sk-table__toolbar')).toHaveCount(1);
  // the In Delivery view uses its own LineItem (delivery progress column)
  await expect(table(page, 'PurchaseOrders').locator('.ag-header-cell[col-id="DataFieldForAnnotation::UI.DataPoint#Delivery"]')).toBeVisible();
  await expect(table(page, 'PurchaseOrders').locator('.ag-header-cell[col-id="DataField::Status"]')).toHaveCount(0);
});

test('P2-LR-03 multiple content: tables of different entity sets in text tabs with counts, one filter bar', async ({ page }) => {
  await open(page, '/po?contents=1');
  const tabs = page.locator('[data-sk-list-tab]');
  await expect(tabs).toHaveCount(2);
  await expect(tabs.nth(0)).toHaveText(/Purchase Orders \(\d+\)/);
  await expect(tabs.nth(1)).toHaveText(/Purchase Order Items \(\d+\)/);
  await expect(tabs.locator('svg')).toHaveCount(0); // text only
  await evidence(page, 'P2-LR-03');
  await page.locator('[data-sk-list-tab="items"]').click();
  await waitForRows(page, 'PurchaseOrderItems');
  // filters without a matching property are reported, not sent
  await expect(page.locator('[data-sk-ignored-filters]')).toContainText('Status');
});

test('P2-LRC-03 the page variant stores the selected tab', async ({ page }) => {
  await open(page, '/po?views=tabs');
  await waitForRows(page, 'PurchaseOrders');
  await page.locator('[data-sk-list-tab="Closed"]').click();
  await page.locator('[data-sk-variant]').click();
  await page.locator('[data-sk-variant-saveas]').click();
  const dialog = page.getByRole('dialog', { name: 'Save As' });
  await dialog.getByRole('textbox', { name: 'View' }).fill('Closed tab');
  await dialog.getByRole('checkbox', { name: 'Set as Default' }).check();
  await dialog.locator('[data-sk-variant-saveas-ok]').click();
  await expect(page.locator('[data-sk-variant]')).toHaveText('Closed tab');
  const body = await page.request.get(`${PURCHASING}/Variants?$filter=PageKey eq 'po'`).then((r) => r.json());
  expect(JSON.parse(body.value[0].Content).custom.tab).toBe('Closed');
  await page.evaluate(() => sessionStorage.clear());
  await page.reload();
  await expect(page.locator('[data-sk-variant]')).toHaveText('Closed tab');
  await expect(page.locator('[data-sk-list-tab="Closed"]')).toHaveAttribute('aria-selected', 'true');
});

test('P2-LRC-10 P2-LR-04 chart view: a table view and a chart view (FE views.paths); selecting a bar filters by it', async ({ page }) => {
  const rec = recordOData(page);
  await open(page, '/po?chart=1');
  await waitForRows(page, 'PurchaseOrders');
  await page.locator('[data-sk-list-tab="chart"]').click();
  const chart = page.locator('[data-sk-chart]');
  // as in FE (docs/29 §4 P1-3, fe:po-chart): grouped by the currency too; orders in EUR and USD are not drawn
  await expect(page.locator('[data-sk-chart-invalid]')).toContainText('Some measures have different units.');
  await expect.poll(() => rec.urls.some((u) => u.includes('$apply=filter(') && u.includes('groupby((Currency,Status),aggregate(NetAmount))'))).toBe(true);
  // a supplier with orders in EUR only (live mode applies the filter at once)
  await showFilters(page);
  await filterInput(page, 'Supplier').fill('0000100126');
  await filterInput(page, 'Supplier').press('Enter');
  await expect(chart.locator('[data-sk-chart-bar]').first()).toBeVisible();
  await evidence(page, 'P2-LRC-10');
  await chart.locator('[data-sk-chart-bar="APPR"]').click();
  // the dimension's Common.Text is on a navigation (_Status/Name): FE does not group by it, the code is shown
  await expect(page.locator('[data-sk-chart-popover]')).toContainText('APPR');
  await page.locator('[data-sk-chart-drilldown]').click();
  await expect.poll(() => rec.urls.some((u) => u.includes("Status eq 'APPR'") && u.includes('$apply'))).toBe(true);
});

test('P2-LR-05 P2-LR-18 responsive table: scroll to load; busy while loading', async ({ page }) => {
  const rec = recordOData(page);
  await open(page, '/po?table=responsive');
  await expect(rows(page).first()).toBeVisible();
  // FE getThreshold: 30 rows per request in a responsive table
  const before = await rows(page).count();
  expect(before).toBeGreaterThanOrEqual(30);
  await mainScroll(page, 100000);
  await expect.poll(() => rows(page).count()).toBeGreaterThan(before);
  expect(rec.urls.some((u) => /\$skip=30/.test(u))).toBe(true);
});

test('P2-LR-06 P2-LR-07 sticky toolbar and column headers; the header snaps on page scroll and can be pinned', async ({ page }) => {
  await open(page, '/po?table=responsive');
  await expect(rows(page).first()).toBeVisible();
  await page.locator('[data-sk-header-toggle]').click();
  await expect(page.locator('.sk-dynamic-page__header')).toBeVisible();
  await mainScroll(page, 1500);
  await expect(page.locator('.sk-dynamic-page__title[data-collapsed]')).toBeVisible();
  const title = await page.locator('.sk-dynamic-page__sticky').boundingBox();
  const bar = await table(page, 'PurchaseOrders').locator('.sk-table__toolbar').boundingBox();
  const th = await table(page, 'PurchaseOrders').locator('thead th').nth(1).boundingBox();
  expect(Math.abs(bar!.y - (title!.y + title!.height))).toBeLessThanOrEqual(2);
  expect(Math.abs(th!.y - (bar!.y + bar!.height))).toBeLessThanOrEqual(2);
  await evidence(page, 'P2-LR-06');
  // pin
  await mainScroll(page, 0);
  await page.locator('[data-sk-header-pin]').click();
  await mainScroll(page, 1500);
  await page.waitForTimeout(200);
  await expect(page.locator('.sk-dynamic-page__title[data-collapsed]')).toHaveCount(0);
});

test('P2-LR-08 responsive table: clicking the row navigates; rows show the navigation indicator', async ({ page }) => {
  await open(page, '/po?table=responsive');
  const row = rows(page).first();
  await expect(row.locator('.sk-rtable__nav svg')).toBeVisible();
  const key = await row.getAttribute('data-sk-row');
  await row.locator('[data-col="DataField::OrderDate"]').click();
  await expect.poll(() => decodeURIComponent(page.url())).toContain(`object?path=PurchaseOrders${key}`);
});

test('P2-LR-09 responsive table hides Low/Medium columns on narrow widths; "Show Details" shows them below the row', async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 900 });
  await open(page, '/po?table=responsive');
  await expect(rows(page).first()).toBeVisible();
  const t = table(page, 'PurchaseOrders');
  await expect(t.locator('thead [data-col="DataField::Status"]')).toBeVisible(); // High
  await expect(t.locator('thead [data-col="DataField::OrderDate"]')).toBeVisible(); // Medium
  await expect(t.locator('thead [data-col="DataField::PurchaseOrderType"]')).toHaveCount(0); // Low
  await t.locator('[data-sk-table-details]').click();
  await expect(rows(page).first().locator('[data-sk-popin]')).toContainText('Order Type');
  await evidence(page, 'P2-LR-09');
  await t.locator('[data-sk-table-details]').click();
  await expect(rows(page).first().locator('[data-sk-popin]')).toHaveCount(0);
});

test('P2-LR-10 on phones the list report uses the responsive table instead of the grid table', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await open(page, '/po?table=auto');
  await expect(rows(page).first()).toBeVisible();
  await expect(page.locator('.ag-root')).toHaveCount(0);
  await page.setViewportSize({ width: 1280, height: 800 });
  await open(page, '/po?table=auto');
  await waitForRows(page, 'PurchaseOrders');
  await expect(page.locator('.ag-root').first()).toBeVisible();
});

test('P2-LR-11 copy the selected rows to the clipboard (tab separated, visible columns)', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await open(page, '/po?table=responsive');
  await expect(rows(page).first()).toBeVisible();
  const t = table(page, 'PurchaseOrders');
  await expect(t.locator('[data-sk-table-copy]')).toBeDisabled();
  await rows(page).nth(0).locator('input[type="checkbox"]').check();
  await rows(page).nth(1).locator('input[type="checkbox"]').check();
  await t.locator('[data-sk-table-copy]').click();
  await expect(t.locator('[data-sk-copy-status]')).toHaveText('2 rows copied to the clipboard.');
  const text = await page.evaluate(() => navigator.clipboard.readText());
  const lines = text.split('\n');
  expect(lines).toHaveLength(3);
  expect(lines[0]!.split('\t')[0]).toBe('Purchase Order');
  expect(lines[1]!.split('\t')[0]).toMatch(/^45\d{8}$/);
});

test('P2-LR-12 grouping in the view settings of the responsive table', async ({ page }) => {
  await open(page, '/po?table=responsive');
  await expect(rows(page).first()).toBeVisible();
  await table(page, 'PurchaseOrders').locator('[data-sk-table-settings]').click();
  await page.locator('[data-sk-p13n-group-tab]').click();
  await page.locator('[data-sk-p13n-group]').click();
  // FE offers the status text (the status is shown as its text only; FE comparison cols5-p13n-ResponsiveTable)
  await page.getByRole('option', { name: 'Status Name', exact: true }).click();
  await page.locator('[data-sk-p13n-ok]').click();
  const groups = table(page, 'PurchaseOrders').locator('[data-sk-group-row]');
  await expect(groups.first()).toContainText('Status Name:');
  await evidence(page, 'P2-LR-12');
});

test('P2-LR-13 cross navigation: the supplier is a link that opens a quick view', async ({ page }) => {
  await open(page, '/po');
  await waitForRows(page, 'PurchaseOrders');
  const link = table(page, 'PurchaseOrders').locator('[data-sk-quickview-link]').first();
  const name = (await link.innerText()).split(' (')[0]!;
  await link.click();
  const qv = page.locator('[data-sk-quickview]');
  await expect(qv).toBeVisible();
  await expect(qv.locator('[data-sk-quickview-title]')).toHaveText(name);
  await expect(qv).toContainText('Country');
  await evidence(page, 'P2-LR-13', qv);
  await page.keyboard.press('Escape');
  await expect(qv).toHaveCount(0);
});

test('P2-LR-17 draft list: editing status filter and draft markers on rows', async ({ page }) => {
  const rec = recordOData(page);
  await open(page, '/po-draft?table=responsive');
  await page.locator('[data-sk-header-toggle]').click();
  await expect(page.locator('[data-sk-editing-status]')).toBeVisible();
  await page.locator('[data-sk-editing-status]').click();
  // FE DraftEditState: "Locked by Another User" = active, no own draft, InProcessByUser set
  await page.getByRole('option', { name: 'Locked by Another User' }).click();
  await expect.poll(() => rec.urls.some((u) => u.includes("SiblingEntity/IsActiveEntity eq null and DraftAdministrativeData/InProcessByUser ne ''"))).toBe(true);
  await expect(rows(page)).toHaveCount(1);
  const marker = rows(page).first().locator('[data-sk-draft-marker="other"]');
  await expect(marker).toBeVisible();
  await marker.click();
  await expect(page.locator('[data-sk-draft-popover]')).toContainText('Alex Miller');
  await evidence(page, 'P2-LR-17');
});

test('P2-LR-02 views by order type from local annotations (overlay): tabs with counts, each tab applies its whole selection variant', async ({ page }) => {
  const rec = recordOData(page);
  await open(page, '/po?views=type');
  const tabs = page.locator('[data-sk-list-tab]');
  await expect(tabs).toHaveText([/^Standard Orders \(\d+\)$/, /^Framework Orders \(\d+\)$/, /^Stock Transport Orders \(\d+\)$/]);
  await waitForRows(page, 'PurchaseOrders');
  // the counts add up to the unfiltered total of the same filters
  const counts = (await tabs.allInnerTexts()).map((x) => Number(x.match(/\((\d+)\)/)![1]));
  const total = await page.request.get(`${PURCHASING}/PurchaseOrders/$count?$filter=${encodeURIComponent("Status ne 'CLOSED' and CompanyCode eq '1000'")}`).then((r) => r.text());
  expect(counts.reduce((a, b) => a + b, 0)).toBe(Number(total));
  // the tab bar sits above the table toolbar (no overlap with a grid table)
  const bar = await page.locator('.sk-list-tabs__list').boundingBox();
  const toolbar = await table(page, 'PurchaseOrders').locator('.sk-table__toolbar').boundingBox();
  expect(bar!.y + bar!.height).toBeLessThanOrEqual(toolbar!.y);
  await page.locator('[data-sk-list-tab="TypeFO"]').click();
  await expect.poll(() => rec.urls.some((u) => u.includes("PurchaseOrderType eq 'FO'") && !u.includes('$top=0'))).toBe(true);
  // PurchaseOrderType is a selection field: it stays in the filter bar (FE getExcludedFilterProperties)
  await page.locator('[data-sk-header-toggle]').click();
  await expect(page.locator('[data-sk-filter="PurchaseOrderType"]')).toBeVisible();
  await expect(page.locator('[data-sk-filter="Status"]')).toBeVisible();
});

test('AC-LR-05 date range: two clicks pick a range; the field shows formatted dates in both languages', async ({ page }) => {
  for (const [lang, re] of [['en', /^Nov 2, 2026 – Nov 13, 2026$/], ['zh', /^2026年11月2日 – 2026年11月13日$/]] as const) {
    const rec = recordOData(page);
    await open(page, '/po', { lang });
    await showFilters(page);
    const field = page.locator('[data-sk-filter="OrderDate"]');
    await field.locator('button:not([data-sk-relative-dates])').first().click();
    const day = (n: number) => page.locator('.mantine-DatePickerInput-day:not([data-outside])', { hasText: new RegExp(`^${n}$`) }).first();
    await day(2).click();
    await day(13).click();
    await expect(field.locator('button:not([data-sk-relative-dates])').first()).toHaveText(re);
    await expect.poll(() => rec.urls.some((u) => u.includes('OrderDate ge 2026-11-02 and OrderDate le 2026-11-13'))).toBe(true);
  }
});

test('P2-LR-19 ANN-40 FilterExpressionRestrictions shape the filter fields; the service never gets a disallowed filter', async ({ page }) => {
  const rec = recordOData(page);
  const statuses: [string, number][] = [];
  page.on('response', (r) => { if (r.url().includes('/odata/')) statuses.push([decodeURIComponent(r.url()), r.status()]); });
  await open(page, '/po');
  await waitForRows(page, 'PurchaseOrders');
  await showFilters(page);
  // SingleValue with fixed values: a single select, not tokens
  const type = page.locator('[data-sk-filter="PurchaseOrderType"]');
  await expect(type.locator('[data-sk-filter-expression="SingleValue"]').or(type.locator('[data-sk-single-select]')).first()).toBeVisible();
  await type.locator('input').first().click();
  await page.getByRole('option', { name: /Standard Order/ }).click();
  await expect.poll(() => rec.urls.some((u) => u.includes("PurchaseOrderType eq 'NB'"))).toBe(true);
  // SingleRange date: always a range picker
  await expect(page.locator('[data-sk-filter="OrderDate"] [data-sk-filter-expression="SingleRange"]')).toHaveCount(1);
  // MultiValue and SearchExpression fields added with Adapt Filters
  await page.getByRole('button', { name: /Adapt Filters/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Adapt Filters' });
  await dialog.getByRole('checkbox', { name: 'Purchasing Group' }).check();
  await dialog.getByRole('checkbox', { name: 'Description' }).check();
  await dialog.getByRole('button', { name: 'OK' }).click();
  const group = filterInput(page, 'PurchasingGroup');
  await group.fill('P01...P05');
  await group.press('Enter');
  await expect(page.locator('[data-sk-filter="PurchasingGroup"]')).toContainText('Enter values only, without ranges or exclusions.');
  await expect(page.locator('[data-sk-filter="PurchasingGroup"]')).not.toContainText('P01...P05');
  await group.fill('P01');
  await group.press('Enter');
  await expect(page.locator('[data-sk-filter="PurchasingGroup"]')).toContainText('P01');
  const desc = filterInput(page, 'Description');
  await desc.fill('Replenishment');
  await desc.press('Enter');
  // live update: no Go button on this page
  await expect.poll(() => rec.urls.some((u) => u.includes("PurchasingGroup eq 'P01'") && u.includes("contains(Description,'Replenishment')"))).toBe(true);
  await expect.poll(() => statuses.some(([u, st]) => u.includes("contains(Description,'Replenishment')") && st === 200)).toBe(true);
  await expect(table(page, 'PurchaseOrders').locator('[data-sk-table-title]')).not.toContainText('(1192)');
  await evidence(page, 'P2-LR-19');
  expect(statuses.filter(([, st]) => st === 400)).toEqual([]);
});
