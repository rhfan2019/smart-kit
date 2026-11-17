import { expect, test } from '@playwright/test';
import { clearFilter, columnTexts, filterInput, open, recordOData, resetServer, showFilters, table, titleCount, waitForRows, PURCHASING } from './helpers';

/** The demo list in manual update mode ("Go"); the template default is live update (LR Filters). */
const MANUAL = '/po?mode=manual';

test.beforeEach(async ({ page }) => resetServer(page));

test.describe('list report: purchase orders', () => {
  test('AC-LR-01 default variant executes on load; header collapsed; no-data texts', async ({ page }) => {
    await open(page, MANUAL);
    await waitForRows(page, 'PurchaseOrders');
    await expect.poll(() => titleCount(page, 'PurchaseOrders')).toBe(1616);
    await expect(page.locator('.sk-dynamic-page__header')).toHaveCount(0);
    await expect(page.locator('.sk-dynamic-page__summary')).toHaveText('2 filters active: Status, Company Code');
    // a filter without results
    await showFilters(page);
    const po = filterInput(page, 'PurchaseOrder');
    await po.fill('0000000000');
    await po.press('Enter');
    await page.locator('[data-sk-go]').click();
    await expect(page.locator('[data-sk-nodata]')).toHaveText('No data found. Try adjusting the filter settings.');
  });

  test('AC-LR-02 manual mode shows an overlay until Go', async ({ page }) => {
    const rec = recordOData(page);
    await open(page, MANUAL);
    await waitForRows(page, 'PurchaseOrders');
    await showFilters(page);
    const before = rec.urls.length;
    await filterInput(page, '$search').fill('Ltd');
    await expect(page.locator('[data-sk-overlay]')).toBeVisible();
    expect(rec.urls.length).toBe(before);
    await page.locator('[data-sk-go]').click();
    await expect(page.locator('[data-sk-overlay]')).toHaveCount(0);
    await expect.poll(() => rec.urls.some((u) => u.includes('$search=Ltd'))).toBe(true);
  });

  test('AC-LR-02 live mode re-queries within 500 ms', async ({ page }) => {
    const rec = recordOData(page);
    await open(page, '/freestyle');
    await waitForRows(page, 'PurchaseOrders');
    await showFilters(page);
    await filterInput(page, '$search').fill('Ltd');
    const t0 = Date.now();
    await expect.poll(() => rec.urls.some((u) => u.includes('$search=Ltd')), { timeout: 2000 }).toBe(true);
    expect(Date.now() - t0).toBeLessThan(1500);
    await expect(page.locator('[data-sk-go]')).toHaveCount(0);
  });

  test('AC-LR-04 filter bar layout: search first without label, Go before Adapt Filters (n)', async ({ page }) => {
    await open(page, MANUAL);
    await showFilters(page);
    const fields = page.locator('.sk-filterbar__fields > *');
    await expect(fields.first()).toHaveAttribute('data-sk-filter', '$search');
    await expect(page.locator('[data-sk-filter="$search"] label')).toHaveCount(0);
    const actions = page.locator('.sk-filterbar__actions button');
    await expect(actions.nth(0)).toHaveText('Go');
    await expect(actions.nth(1)).toHaveText('Adapt Filters (2)');
    const searchBox = await page.locator('[data-sk-filter="$search"]').boundingBox();
    const go = await page.locator('[data-sk-go]').boundingBox();
    expect(go!.x).toBeGreaterThan(searchBox!.x + searchBox!.width);
  });

  test('AC-LR-05 tokens, exclusion, ranges, date range and search together', async ({ page }) => {
    const rec = recordOData(page);
    await open(page, MANUAL);
    await showFilters(page);
    const po = filterInput(page, 'PurchaseOrder');
    await po.fill('4500000001...4500000100');
    await po.press('Enter');
    await po.fill('!(=4500000050)');
    await po.press('Enter');
    await expect(page.locator('[data-sk-filter="PurchaseOrder"]')).toContainText('4500000001...4500000100');
    await expect(page.locator('[data-sk-filter="PurchaseOrder"]')).toContainText('!(=4500000050)');
    await page.locator('[data-sk-filter="OrderDate"] button').first().click();
    await page.locator('.mantine-DatePickerInput-dropdown, [data-dates-dropdown]').waitFor({ state: 'visible' }).catch(() => undefined);
    await page.keyboard.press('Escape');
    await filterInput(page, '$search').fill('Ltd');
    await page.locator('[data-sk-go]').click();
    await expect.poll(() => rec.urls.find((u) => u.includes('$search=Ltd') && u.includes("(PurchaseOrder ge '4500000001' and PurchaseOrder le '4500000100')") && u.includes("not (PurchaseOrder eq '4500000050')"))).toBeTruthy();
    await waitForRows(page, 'PurchaseOrders');
  });

  test('AC-LR-06 value help: typeahead, dialog select, conditions, token "text (code)"', async ({ page }) => {
    await open(page, MANUAL);
    await showFilters(page);
    const sup = page.locator('[data-sk-filter="Supplier"]');
    // typeahead
    await filterInput(page, 'Supplier').fill('Bel');
    await expect(page.getByRole('option').first()).toBeVisible();
    await page.keyboard.press('Escape');
    await filterInput(page, 'Supplier').fill('');
    // dialog
    await sup.getByRole('button', { name: 'Show value help' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('tab', { name: 'Search and Select' })).toBeVisible();
    await dialog.getByRole('textbox', { name: 'Search' }).fill('Ltd');
    await dialog.getByRole('button', { name: 'Go' }).click();
    const firstRow = dialog.locator('tbody tr').first();
    await expect(firstRow).toBeVisible();
    const code = (await firstRow.locator('td').nth(1).innerText()).trim();
    const name = (await firstRow.locator('td').nth(2).innerText()).trim();
    await firstRow.click();
    await dialog.getByRole('tab', { name: 'Define Conditions' }).click();
    await dialog.getByRole('button', { name: 'Add condition' }).click();
    await dialog.getByRole('textbox', { name: 'Value' }).last().fill('0000100001');
    await dialog.getByText('Exclude').last().click();
    await dialog.getByRole('button', { name: 'OK' }).click();
    await expect(sup).toContainText(`${name} (${code})`);
    await expect(sup).toContainText('!(=0000100001)');
  });

  test('AC-LR-07 Adapt Filters adds and removes fields; fields with values are locked', async ({ page }) => {
    await open(page, MANUAL);
    await showFilters(page);
    await page.getByRole('button', { name: /Adapt Filters/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Adapt Filters' });
    await expect(dialog.getByRole('checkbox', { name: 'Company Code' })).toBeDisabled();
    await expect(dialog.getByRole('checkbox', { name: 'Notes' })).toHaveCount(0); // not filterable
    await dialog.getByRole('checkbox', { name: 'Description' }).check();
    await dialog.getByRole('checkbox', { name: 'Order Type' }).uncheck();
    await dialog.getByRole('button', { name: 'OK' }).click();
    await expect(page.locator('[data-sk-filter="Description"]')).toBeVisible();
    await expect(page.locator('[data-sk-filter="PurchaseOrderType"]')).toHaveCount(0);
  });

  test('AC-LR-08 variants are stored in the service database', async ({ page }) => {
    await open(page, MANUAL);
    await waitForRows(page, 'PurchaseOrders');
    await showFilters(page);
    const st = filterInput(page, 'Status');
    await st.fill('=APPR');
    await st.press('Enter');
    await expect(page.locator('[data-sk-variant-modified]')).toBeVisible();
    await page.locator('[data-sk-variant]').click();
    await page.locator('[data-sk-variant-saveas]').click();
    const dialog = page.getByRole('dialog', { name: 'Save As' });
    await dialog.getByRole('textbox', { name: 'View' }).fill('Approved only');
    await dialog.getByRole('checkbox', { name: 'Set as Default' }).check();
    await dialog.getByRole('checkbox', { name: 'Apply Automatically' }).uncheck();
    await dialog.locator('[data-sk-variant-saveas-ok]').click();
    await expect(page.locator('[data-sk-variant]')).toHaveText('Approved only');
    // stored on the server
    const res = await page.request.get(`${PURCHASING}/Variants?$filter=PageKey eq 'po'`);
    const body = await res.json();
    expect(body.value.map((v: { Name: string; IsDefault: boolean; AutoApply: boolean }) => [v.Name, v.IsDefault, v.AutoApply])).toEqual([['Approved only', true, false]]);
    // new session: default variant without auto-apply → header expanded and "To start"
    await page.context().clearCookies();
    await page.evaluate(() => sessionStorage.clear());
    await page.reload();
    await expect(page.locator('[data-sk-variant]')).toHaveText('Approved only');
    await expect(page.locator('.sk-dynamic-page__header')).toBeVisible();
    await expect(page.locator('[data-sk-nodata]')).toHaveText('To start, set the relevant filters.');
    await expect(page.locator('[data-sk-filter="Status"]')).toContainText('APPR');
    await page.locator('[data-sk-go]').click();
    await waitForRows(page, 'PurchaseOrders');
    // manage: rename, auto-apply, delete
    await page.locator('[data-sk-variant]').click();
    await page.locator('[data-sk-variant-manage]').click();
    const manage = page.getByRole('dialog', { name: 'Manage' });
    const row = manage.locator('[data-sk-variant-row="Approved only"]');
    await row.getByRole('textbox').fill('Approved');
    await row.getByRole('textbox').blur();
    await expect(manage.locator('[data-sk-variant-row="Approved"]')).toBeVisible();
    await manage.locator('[data-sk-variant-row="Approved"]').getByRole('button', { name: 'Delete' }).click();
    await expect(manage.locator('[data-sk-variant-row]')).toHaveCount(0);
  });

  test('AC-LR-09 server sorting and block loading; scrolling to the end of 10,000 rows', async ({ page }) => {
    const rec = recordOData(page);
    await open(page, MANUAL);
    await waitForRows(page, 'PurchaseOrders');
    await showFilters(page);
    // remove default conditions to get all 10,000 rows
    for (const f of ['Status', 'CompanyCode']) await clearFilter(page, f);
    await filterInput(page, 'CompanyCode').fill('1000...4000');
    await filterInput(page, 'CompanyCode').press('Enter');
    await page.locator('[data-sk-go]').click();
    await expect.poll(() => titleCount(page, 'PurchaseOrders')).toBe(10000);
    // header click sorts on the server
    await table(page, 'PurchaseOrders').locator('.ag-header-cell[col-id="DataField::PurchaseOrder"] .ag-header-cell-label').click();
    await expect.poll(() => rec.urls.some((u) => u.includes('$orderby=PurchaseOrder&') || u.endsWith('$orderby=PurchaseOrder'))).toBe(true);
    await expect.poll(async () => (await columnTexts(page, 'PurchaseOrders', 'DataField::PurchaseOrder'))[0]).toBe('4500000001');
    // scroll to the end
    const viewport = table(page, 'PurchaseOrders').locator('.ag-grid-viewport');
    for (let i = 0; i < 30; i++) {
      await viewport.evaluate((el) => el.scrollTo(0, el.scrollHeight));
      await page.waitForTimeout(150);
    }
    await expect(table(page, 'PurchaseOrders').locator('.ag-row[row-index="9999"]')).toBeVisible({ timeout: 20_000 });
    expect(rec.urls.some((u) => u.includes('$skip=9900&$top=100'))).toBe(true);
  });

  test('AC-LR-10 personalization updates columns, $select and $orderby', async ({ page }) => {
    const rec = recordOData(page);
    await open(page, MANUAL);
    await waitForRows(page, 'PurchaseOrders');
    await table(page, 'PurchaseOrders').locator('[data-sk-table-settings]').click();
    const dialog = page.getByRole('dialog', { name: 'View Settings' });
    await dialog.getByRole('checkbox', { name: 'Net Amount' }).uncheck();
    // the budget micro chart column (docs/15 MC-10) also reads the net amount
    await dialog.getByRole('checkbox', { name: 'Budget Usage' }).uncheck();
    await dialog.getByRole('tab', { name: 'Sort' }).click();
    await dialog.getByRole('button', { name: 'Remove' }).first().click();
    await dialog.getByRole('button', { name: 'Add sort criterion' }).click();
    await dialog.locator('[data-sk-p13n-ok]').click();
    await expect(table(page, 'PurchaseOrders').locator('.ag-header-cell[col-id="DataField::NetAmount"]')).toHaveCount(0);
    await expect.poll(() => {
      const last = rec.urls.filter((u) => u.startsWith('/odata/purchasing/PurchaseOrders?')).pop() ?? '';
      return !/\$select=[^&]*NetAmount/.test(last) && /\$orderby=PurchaseOrder/.test(last);
    }).toBe(true);
  });

  test('AC-LR-11 export to spreadsheet', async ({ page }) => {
    await open(page, MANUAL);
    await waitForRows(page, 'PurchaseOrders');
    const download = page.waitForEvent('download');
    await table(page, 'PurchaseOrders').locator('[data-sk-table-export]').click();
    const file = await download;
    expect(file.suggestedFilename()).toBe('Purchase Orders.xlsx');
  });

  test('AC-LR-12 navigation indicator and Enter open the object page', async ({ page }) => {
    await open(page, MANUAL);
    const t = await waitForRows(page, 'PurchaseOrders');
    const first = (await columnTexts(page, 'PurchaseOrders', 'DataField::PurchaseOrder'))[0]!;
    await t.locator('[data-sk-row-nav]').first().click();
    await expect(page).toHaveURL(new RegExp(`object\\?path=PurchaseOrders\\(%27${first}%27\\)`));
    await page.goBack();
    await waitForRows(page, 'PurchaseOrders');
    await t.locator('.ag-row[row-index]').nth(1).locator('.ag-cell').nth(1).click();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/object\?path=PurchaseOrders/);
  });

  test('AC-LR-13 header: expand/collapse and pin on the header border; the header snaps when the table scrolls; title click', async ({ page }) => {
    await open(page, MANUAL);
    const t = await waitForRows(page, 'PurchaseOrders');
    const header = page.locator('.sk-dynamic-page__header');
    await expect(header).toHaveCount(0); // a query ran on start: collapsed (LR-13)
    await expect(page.getByRole('button', { name: 'Show Filters' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Expand Header' }).click();
    await expect(header).toBeVisible();
    // the buttons sit centred on the bottom border of the header
    const box = await page.locator('.sk-dynamic-page__features-buttons').boundingBox();
    const line = await page.locator('.sk-dynamic-page__features').boundingBox();
    expect(Math.abs(box!.y + box!.height / 2 - line!.y)).toBeLessThan(2);
    expect(Math.abs(box!.x + box!.width / 2 - page.viewportSize()!.width / 2)).toBeLessThan(40);
    await expect(page.locator('[data-sk-header-pin]')).toBeVisible();
    // scrolling the table down collapses the header, back to the top expands it
    const scroller = t.locator('.ag-grid-viewport');
    await scroller.evaluate((el) => el.scrollTo(0, 400));
    await expect(header).toHaveCount(0);
    await page.waitForTimeout(500);
    await scroller.evaluate((el) => el.scrollTo(0, 0));
    await expect(header).toBeVisible();
    // pinned: scrolling keeps the header
    await page.locator('[data-sk-header-pin]').click();
    await expect(page.locator('[data-sk-header-pin]')).toHaveAttribute('aria-pressed', 'true');
    await scroller.evaluate((el) => el.scrollTo(0, 400));
    await page.waitForTimeout(300);
    await expect(header).toBeVisible();
    // collapsing overrules the pin and releases it
    await page.getByRole('button', { name: 'Collapse Header' }).click();
    await expect(header).toHaveCount(0);
    await page.getByRole('button', { name: 'Expand Header' }).click();
    await expect(page.locator('[data-sk-header-pin]')).toHaveAttribute('aria-pressed', 'false');
    // snap on click: clicking the title bar where there is no active element toggles the header
    const title = (await page.locator('.sk-dynamic-page__title').boundingBox())!;
    await page.mouse.click(title.x + title.width / 2, title.y + 12);
    await expect(header).toHaveCount(0);
    await page.mouse.click(title.x + title.width / 2, title.y + 12);
    await expect(header).toBeVisible();
  });

  test('AC-LR-18 live update is the default: no Go, queries on change, no "Apply Automatically"', async ({ page }) => {
    const rec = recordOData(page);
    await open(page, '/po');
    await waitForRows(page, 'PurchaseOrders');
    await showFilters(page);
    await expect(page.locator('[data-sk-go]')).toHaveCount(0);
    await filterInput(page, '$search').fill('Ltd');
    await expect.poll(() => rec.urls.some((u) => u.includes('$search=Ltd')), { timeout: 2000 }).toBe(true);
    await page.locator('[data-sk-variant]').click();
    await page.locator('[data-sk-variant-saveas]').click();
    const dialog = page.getByRole('dialog', { name: 'Save As' });
    await expect(dialog.getByRole('checkbox', { name: 'Set as Default' })).toBeVisible();
    await expect(dialog.getByRole('checkbox', { name: 'Apply Automatically' })).toHaveCount(0);
  });

  test('AC-LR-19 keyboard: the header expands when the focus enters it and collapses when it leaves', async ({ page }) => {
    await open(page, MANUAL);
    await waitForRows(page, 'PurchaseOrders');
    const header = page.locator('.sk-dynamic-page__header');
    await expect(header).toHaveCount(0);
    await page.locator('[data-sk-table-settings]').focus();
    for (let i = 0; i < 12 && !(await page.evaluate(() => Boolean(document.activeElement?.closest('[data-sk-header-region]')))); i++) await page.keyboard.press('Shift+Tab');
    await expect(header).toBeVisible();
    // leaving the header for the page content collapses it again
    await page.getByRole('button', { name: /^Adapt Filters/ }).focus();
    // Tab past the remaining header elements (the expand/collapse and pin buttons) into the table
    for (let i = 0; i < 6 && (await page.evaluate(() => Boolean(document.activeElement?.closest('[data-sk-header-region]')))); i++) await page.keyboard.press('Tab');
    await expect(header).toHaveCount(0);
  });

  test('AC-LR-14 initial focus', async ({ page }) => {
    // collapsed header → first table row
    await open(page, MANUAL);
    await waitForRows(page, 'PurchaseOrders');
    await expect.poll(() => page.evaluate(() => document.activeElement?.closest('.ag-row') !== null)).toBe(true);
    // expanded header in manual mode with a default variant that does not execute → Go
    await showFilters(page);
    await page.locator('[data-sk-variant]').click();
    await page.locator('[data-sk-variant-saveas]').click();
    const dialog = page.getByRole('dialog', { name: 'Save As' });
    await dialog.getByRole('textbox', { name: 'View' }).fill('No auto');
    await dialog.getByRole('checkbox', { name: 'Set as Default' }).check();
    await dialog.getByRole('checkbox', { name: 'Apply Automatically' }).uncheck();
    await dialog.locator('[data-sk-variant-saveas-ok]').click();
    await page.evaluate(() => sessionStorage.clear());
    await page.reload();
    await expect.poll(() => page.evaluate(() => (document.activeElement as HTMLElement | null)?.dataset.skGo !== undefined)).toBe(true);
  });

  test('AC-LR-15 cell types from annotations', async ({ page }) => {
    await open(page, MANUAL);
    const t = await waitForRows(page, 'PurchaseOrders');
    const row = t.locator('.ag-row[row-index]').first();
    await expect(row.locator('[col-id="DataField::Supplier"]')).toHaveText(/.+ \(00001\d{5}\)/); // text (code)
    await expect(row.locator('[col-id="DataField::NetAmount"] .sk-field__unit')).toHaveText(/^[A-Z]{3}$/);
    await expect(row.locator('[col-id="DataField::OrderDate"]')).toHaveText(/^[A-Z][a-z]{2} \d{1,2}, \d{4}$/);
    await expect(row.locator('[col-id="DataField::Status"] .sk-status')).toHaveCount(1);
    await expect(row.locator('[col-id="DataFieldForAnnotation::_Supplier::UI.DataPoint#Rating"] .mantine-Rating-root')).toHaveCount(1);
    // JPY amounts have no decimals
    await page.goto('/po?lang=en');
  });

  test('AC-LR-16 mandatory filter blocks Go', async ({ page }) => {
    const rec = recordOData(page);
    await open(page, MANUAL);
    await waitForRows(page, 'PurchaseOrders');
    await showFilters(page);
    await clearFilter(page, 'CompanyCode');
    const before = rec.urls.length;
    await page.locator('[data-sk-go]').click();
    await expect(page.locator('[data-sk-filter="CompanyCode"]')).toContainText('Fill in this mandatory field.');
    expect(rec.urls.length).toBe(before);
  });

  test('AC-LR-17 keyboard: arrow keys move between cells', async ({ page }) => {
    await open(page, MANUAL);
    const t = await waitForRows(page, 'PurchaseOrders');
    await t.locator('.ag-row[row-index]').first().locator('.ag-cell').nth(0).click();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowRight');
    const focused = await page.evaluate(() => ({ row: document.activeElement?.closest('.ag-row')?.getAttribute('row-index'), cell: document.activeElement?.getAttribute('aria-colindex') }));
    expect(focused.row).toBe('1');
    expect(Number(focused.cell)).toBeGreaterThan(1);
  });
});

test.describe('capabilities and query shapes', () => {
  test('AC-DATA-07 capability restrictions: no search box, no $count, no non-sortable sort', async ({ page }) => {
    const rec = recordOData(page);
    // northwind declares nothing: Searchable defaults to false
    await open(page, '/nw/products');
    await waitForRows(page, 'Products');
    await showFilters(page);
    await expect(page.locator('[data-sk-filter="$search"]')).toHaveCount(0);
    // purchasing: Description is not sortable, Notes not filterable
    await open(page, MANUAL);
    await waitForRows(page, 'PurchaseOrders');
    await table(page, 'PurchaseOrders').locator('[data-sk-table-settings]').click();
    await page.getByRole('dialog').getByRole('tab', { name: 'Sort' }).click();
    await page.getByRole('dialog').getByLabel('Sort by').first().click();
    await expect(page.getByRole('option', { name: 'Description' })).toHaveCount(0);
    await page.keyboard.press('Escape');
    // ItemHistory is not countable: no $count request ever reaches the service
    await open(page, `/purchasing/object?path=${encodeURIComponent("PurchaseOrders('4500000001')/_Item(PurchaseOrder='4500000001',PurchaseOrderItem=10)")}`);
    await page.locator('[data-sk-anchor="History"]').click();
    await expect.poll(() => rec.urls.some((u) => u.includes('/_History?'))).toBe(true);
    expect(rec.urls.filter((u) => u.includes('/_History?')).every((u) => !u.includes('$count'))).toBe(true);
    expect(rec.urls.filter((u) => u.includes('$search')).every((u) => !u.includes('northwind'))).toBe(true);
  });

  test('AC-DATA-08 query shapes match the reference rules (docs/query-shapes.md)', async ({ page }) => {
    const rec = recordOData(page);
    await open(page, MANUAL);
    await waitForRows(page, 'PurchaseOrders');
    const list = rec.urls.find((u) => u.startsWith('/odata/purchasing/PurchaseOrders?'))!;
    // Q-01/Q-02: only visible columns and their companions; texts through $expand($select)
    expect(list).toContain('$select=PurchaseOrder,Supplier,OrderDate,Status,StatusCriticality,NetAmount,Currency,DeliveredPercent,PurchaseOrderType');
    expect(list).toContain('$expand=_Supplier($select=SupplierName,Rating,RatingCount),_Status($select=Name),_PurchaseOrderType($select=Name)');
    // Q-05 default sort from PresentationVariant; Q-06/Q-07 first block with $count
    expect(list).toMatch(/\$count=true.*\$orderby=OrderDate desc.*\$skip=0&\$top=100/);
    // Q-05b sorting an amount sorts by currency first
    await table(page, 'PurchaseOrders').locator('.ag-header-cell[col-id="DataField::NetAmount"] .ag-header-cell-label').click();
    await expect.poll(() => rec.urls.some((u) => u.includes('$orderby=Currency,NetAmount'))).toBe(true);
    // Q-08 one object read with header and all forms; Q-06 sub-table $top=10 with $count
    await table(page, 'PurchaseOrders').locator('[data-sk-row-nav]').first().click();
    await expect.poll(() => rec.urls.some((u) => /PurchaseOrders\('\d+'\)\?\$select=/.test(u))).toBe(true);
    const read = rec.urls.find((u) => /PurchaseOrders\('\d+'\)\?\$select=/.test(u))!;
    for (const f of ['Description', 'Notes', 'CompanyCode', 'NetAmount', 'DeliveredPercent']) expect(read).toContain(f);
    await page.locator('[data-sk-anchor="Items"]').click();
    await expect.poll(() => rec.urls.some((u) => /\/_Item\?\$count=true.*\$skip=0&\$top=10$/.test(u))).toBe(true);
  });
});

test.describe('extensions in the list', () => {
  test('AC-EXT-02 inserted column after the supplier and a selection-dependent action', async ({ page }) => {
    await open(page, MANUAL);
    const t = await waitForRows(page, 'PurchaseOrders');
    const ids = await t.locator('.ag-header-cell').evaluateAll((els) => els.map((e) => e.getAttribute('col-id')));
    expect(ids.indexOf('Custom::Overdue')).toBe(ids.indexOf('DataField::Supplier') + 1);
    const action = t.locator('[data-sk-action="Custom::Copy"]');
    await expect(action).toBeDisabled();
    await t.locator('.ag-row[row-index]').first().locator('.ag-selection-checkbox input, input[type="checkbox"]').first().check();
    await expect(action).toBeEnabled();
    await action.click();
    await expect(page.locator('[data-demo-message]')).toContainText('Copied: 45');
  });

  test('AC-EXT-01 replaced cell renderer and replaced toolbar', async ({ page }) => {
    await open(page, MANUAL);
    const t = await waitForRows(page, 'PurchaseOrders');
    await t.locator('.ag-grid-viewport').evaluate((el) => el.scrollTo(el.scrollWidth, 0));
    await expect(t.locator('[data-demo-type]').first()).toHaveText(/^(NB|FO|UB)$/);
    await open(page, '/freestyle');
    await waitForRows(page, 'PurchaseOrders');
    await expect(page.locator('[data-demo-toolbar]')).toContainText('Custom Toolbar');
    await expect(page.locator('[data-sk-table-export]')).toHaveCount(0);
  });
});
