/** Phase 2 · Object page editing (docs/13 §7): direct save on /odata/purchasing/, draft on /odata/purchasing-draft/. */
import { expect, test, type Page } from '@playwright/test';
import { evidence, MOCK, open, orderPath, PURCHASING, resetServer } from './helpers';

test.beforeEach(async ({ page }) => resetServer(page));

const field = (page: Page, path: string) => page.locator(`[data-sk-field-path="${path}"]`).first();
const input = (page: Page, path: string) => field(page, path).locator('input:not([type="hidden"]), textarea').first();
const footer = (page: Page) => page.locator('.sk-dynamic-page__footer');
const get = async (page: Page, svc: string, path: string) => (await page.request.get(`${svc === 'purchasing' ? PURCHASING : `${MOCK}/odata/${svc}`}/${path}`)).json();

test('P2-OP-15 P2-OP-16 edit keeps the layout; the footer offers Save and Cancel; initial focus on the first editable field', async ({ page }) => {
  await open(page, orderPath('4500000001'));
  const label = page.locator('[data-sk-subsection="GeneralData"] [data-sk-field-path="Description"] .sk-form__label');
  const before = await label.boundingBox();
  await page.locator('[data-sk-action="Edit"]').click();
  await expect(footer(page).locator('[data-sk-save]')).toBeVisible();
  await expect(footer(page).locator('[data-sk-cancel]')).toBeVisible();
  // no mandatory field is empty: the first editable element gets the focus
  await expect.poll(() => page.evaluate(() => Boolean(document.activeElement?.closest('[data-sk-editable]')))).toBe(true);
  const sections = await page.locator('[data-sk-section]').evaluateAll((els) => els.map((e) => e.getAttribute('data-sk-section')));
  expect(sections.slice(1)).toEqual(['GeneralInformation', 'Custom::Timeline', 'Items', 'NotesSection']);
  const after = await page.locator('[data-sk-subsection="GeneralData"] [data-sk-field-path="Description"] .sk-form__label').boundingBox();
  expect(Math.abs(after!.x - before!.x)).toBeLessThan(2); // same column
  await evidence(page, 'P2-OP-15');
});

test('P2-OP-16 initial focus on the first empty mandatory field', async ({ page }) => {
  await open(page, orderPath('4500000001'));
  await page.locator('[data-sk-action="Edit"]').click();
  await input(page, 'PurchasingGroup').fill('');
  await page.locator('[data-sk-cancel]').click();
  await page.locator('[data-sk-confirm-ok]').click();
  // a new object has empty mandatory fields: the first one is focused
  await open(page, '/purchasing/object?create=PurchaseOrders&layout=anchor');
  await expect.poll(() => page.evaluate(() => document.activeElement?.closest('[data-sk-mandatory-empty]')?.getAttribute('data-sk-field-path'))).toBeTruthy();
});

test('P2-OP-17 direct save: PATCH with If-Match; a stale ETag is reported as a conflict and nothing is overwritten', async ({ page }) => {
  await open(page, orderPath('4500000003'));
  const patches: { ifMatch?: string; body: string }[] = [];
  page.on('request', (r) => { if (r.method() === 'PATCH') patches.push({ ifMatch: r.headers()['if-match'], body: r.postData() ?? '' }); });
  await page.locator('[data-sk-action="Edit"]').click();
  await input(page, 'Description').fill('Changed in the UI');
  await page.locator('[data-sk-save]').click();
  await expect(page.locator('[data-sk-action="Edit"]')).toBeVisible();
  expect(patches[0]!.ifMatch).toBeTruthy();
  expect(JSON.parse(patches[0]!.body)).toEqual({ Description: 'Changed in the UI' });
  expect((await get(page, 'purchasing', "PurchaseOrders('4500000003')")).Description).toBe('Changed in the UI');
  // someone else changes the order while we edit
  await page.locator('[data-sk-action="Edit"]').click();
  const current = await get(page, 'purchasing', "PurchaseOrders('4500000003')");
  await page.request.patch(`${PURCHASING}/PurchaseOrders('4500000003')`, { data: { Description: 'Changed by someone else' }, headers: { 'If-Match': current['@odata.etag'] } });
  await input(page, 'Description').fill('Mine');
  await page.locator('[data-sk-save]').click();
  await page.locator('[data-sk-message-button]').click();
  await expect(page.locator('[data-sk-message="error"]')).toContainText('changed by someone else');
  expect((await get(page, 'purchasing', "PurchaseOrders('4500000003')")).Description).toBe('Changed by someone else');
});

test('P2-OP-20 global edit: editable header fields move to a temporary "Header" section before all sections', async ({ page }) => {
  await open(page, orderPath('4500000001'));
  await page.locator('[data-sk-action="Edit"]').click();
  const first = page.locator('[data-sk-section]').first();
  await expect(first).toHaveAttribute('data-sk-section', '$Header');
  await expect(page.locator('[data-sk-anchor="$Header"]')).toHaveText('Header');
  for (const p of ['Description', 'PurchasingGroup', 'OrderDate', 'Supplier']) await expect(first.locator(`[data-sk-field-path="${p}"] [data-sk-editor], [data-sk-field-path="${p}"] input`).first()).toBeVisible();
  // not editable (key, immutable): not in the section
  await expect(first.locator('[data-sk-field-path="PurchaseOrder"]')).toHaveCount(0);
  await expect(first.locator('[data-sk-field-path="CompanyCode"]')).toHaveCount(0);
  await evidence(page, 'P2-OP-20');
});

test('P2-OP-21 partial edit: "Edit Header" opens a dialog with the header fields only', async ({ page }) => {
  await open(page, orderPath('4500000005'));
  await page.locator('[data-sk-edit-header]').click();
  const dialog = page.getByRole('dialog', { name: 'Edit Header' });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('[data-sk-field-path]')).toHaveCount(4);
  await dialog.locator('[data-sk-field-path="Description"] input').fill('Edited in the header dialog');
  await evidence(page, 'P2-OP-21', dialog);
  await dialog.locator('[data-sk-partial-save]').click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.sk-dynamic-page__subheading')).toHaveText('Edited in the header dialog');
  // the page stays in display mode
  await expect(page.locator('[data-sk-save]')).toHaveCount(0);
});

test('P2-OP-22 inline create of a subobject: "Create" adds a row at the top of the table; Ctrl+Enter does the same', async ({ page }) => {
  await open(page, orderPath('4500000003'));
  const countBefore = (await get(page, 'purchasing', "PurchaseOrders('4500000003')/_Item/$count").catch(() => 0)) as number;
  await page.locator('[data-sk-action="Edit"]').click();
  await page.locator('[data-sk-anchor="Items"]').click();
  const items = page.locator('[data-sk-section="Items"] .sk-table');
  await items.locator('[data-sk-action="Create"]').click();
  const row = items.locator('[data-sk-inline-create]');
  await expect(row).toBeVisible();
  // at the top: before the table body
  expect((await row.boundingBox())!.y).toBeLessThan((await items.locator('.sk-table__body').boundingBox())!.y);
  await row.locator('[data-sk-create-field="Material"] input:not([type="hidden"])').fill('MAT-10001');
  await row.locator('[data-sk-create-field="Plant"] input:not([type="hidden"])').fill('1010');
  await row.locator('[data-sk-create-field="OrderQuantity"] input:not([type="hidden"])').fill('5');
  await evidence(page, 'P2-OP-22', items);
  await row.locator('[data-sk-create-field="OrderQuantity"] input:not([type="hidden"])').press('Control+Enter');
  await expect(row).toHaveCount(0);
  await expect.poll(async () => Number(await (await page.request.get(`${PURCHASING}/PurchaseOrders('4500000003')/_Item/$count`)).text())).toBe(Number(countBefore) + 1);
  // Ctrl+Enter in the table opens a new row as well
  await items.locator('.sk-table__search input').focus();
  await page.keyboard.press('Control+Enter');
  await expect(items.locator('[data-sk-inline-create]')).toBeVisible();
});

test('P2-OP-24 delete in display mode asks for confirmation and goes back to the list', async ({ page }) => {
  await open(page, orderPath('4500000007'));
  await page.locator('[data-sk-action="Delete"]').click();
  const dialog = page.locator('.mantine-Modal-content').filter({ hasText: 'Delete 4500000007?' });
  await expect(dialog).toBeVisible();
  await evidence(page, 'P2-OP-24', dialog);
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  expect((await page.request.get(`${PURCHASING}/PurchaseOrders('4500000007')`)).status()).toBe(200);
  await page.locator('[data-sk-action="Delete"]').click();
  await page.locator('[data-sk-confirm-ok]').click();
  await expect(page).toHaveURL(/\/po(\?|$)/);
  expect((await page.request.get(`${PURCHASING}/PurchaseOrders('4500000007')`)).status()).toBe(404);
});

test('P2-OP-25 create mode: the title shows "New Purchase Order" until the object has its number', async ({ page }) => {
  await open(page, '/purchasing/object?create=PurchaseOrders&layout=anchor');
  await expect(page.locator('.sk-dynamic-page__heading')).toHaveText('New Purchase Order');
  await input(page, 'Supplier').fill('0000100001');
  await input(page, 'CompanyCode').fill('1000');
  await field(page, 'PurchaseOrderType').locator('input[role="combobox"]').click();
  await page.getByRole('option', { name: /Standard Order/ }).click();
  await input(page, 'PurchasingGroup').fill('P02');
  await field(page, 'OrderDate').locator('input[data-sk-editor="date"]').fill('2026-12-01');
  await field(page, 'OrderDate').locator('input[data-sk-editor="date"]').press('Tab');
  await input(page, 'Description').fill('Created in create mode');
  await evidence(page, 'P2-OP-25');
  await page.locator('[data-sk-save]').click();
  await expect(page.locator('.sk-dynamic-page__heading')).toHaveText('4500010001');
  await expect(page.locator('.sk-dynamic-page__subheading')).toHaveText('Created in create mode');
});

test('P2-OP-27 edit mode: validation messages in the message popover; pressing one focuses the field', async ({ page }) => {
  await open(page, orderPath('4500000001'));
  await page.locator('[data-sk-action="Edit"]').click();
  await input(page, 'PurchasingGroup').fill('');
  await page.locator('[data-sk-save]').click();
  const button = footer(page).locator('[data-sk-message-button="error"]');
  await expect(button).toBeVisible();
  await expect(field(page, 'PurchasingGroup')).toContainText('enter a value');
  await button.click();
  const msg = page.locator('[data-sk-message-target="PurchasingGroup"] button');
  await expect(msg).toBeVisible();
  await evidence(page, 'P2-OP-27');
  await msg.click();
  await expect(input(page, 'PurchasingGroup')).toBeFocused();
  // server-side validation (OrderDate after 2099) shows as a field error too
  await input(page, 'PurchasingGroup').fill('P03');
  await field(page, 'OrderDate').locator('input[data-sk-editor="date"]').fill('2100-01-01');
  await field(page, 'OrderDate').locator('input[data-sk-editor="date"]').press('Tab');
  await page.locator('[data-sk-save]').click();
  await expect(field(page, 'OrderDate')).toContainText(/2099/);
});

test('P2-GEN-05 the edit strategy follows the model: PATCH on the direct-save service, draft actions on the draft service', async ({ page }) => {
  const calls: string[] = [];
  page.on('request', (r) => { if (r.method() !== 'GET' && r.url().includes('/odata/')) calls.push(`${r.method()} ${decodeURIComponent(r.url().replace(/^.*\/odata\//, ''))}`); });
  await open(page, orderPath('4500000003'));
  await page.locator('[data-sk-action="Edit"]').click();
  await input(page, 'Description').fill('direct');
  await page.locator('[data-sk-save]').click();
  await expect(page.locator('[data-sk-action="Edit"]')).toBeVisible();
  expect(calls).toEqual(["PATCH purchasing/PurchaseOrders('4500000003')"]);
  calls.length = 0;
  await open(page, orderPath('4500000003', { service: 'purchasing-draft' }));
  await page.locator('[data-sk-action="Edit"]').click();
  await input(page, 'Description').fill('draft');
  await page.locator('[data-sk-save]').click();
  await expect(page.locator('[data-sk-action="Edit"]')).toBeVisible();
  expect(calls[0]).toBe("POST purchasing-draft/PurchaseOrders(PurchaseOrder='4500000003',IsActiveEntity=true)/Purchasing.draftEdit");
  expect(calls).toContain("PATCH purchasing-draft/PurchaseOrders(PurchaseOrder='4500000003',IsActiveEntity=false)");
  expect(calls[calls.length - 1]).toBe("POST purchasing-draft/PurchaseOrders(PurchaseOrder='4500000003',IsActiveEntity=false)/Purchasing.draftActivate");
});
