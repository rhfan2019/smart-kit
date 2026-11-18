/** Phase 2 · Draft (docs/13 §7, ADR-018, ADR-019) on /odata/purchasing-draft/. */
import { expect, test, type Page } from '@playwright/test';
import { evidence, MOCK, open, orderPath, resetServer } from './helpers';

test.beforeEach(async ({ page }) => resetServer(page));

const SVC = 'purchasing-draft';
const input = (page: Page, path: string) => page.locator(`[data-sk-field-path="${path}"]`).first().locator('input:not([type="hidden"]), textarea').first();
const active = (po: string) => `${MOCK}/odata/${SVC}/PurchaseOrders(PurchaseOrder='${po}',IsActiveEntity=true)`;
const draft = (po: string) => `${MOCK}/odata/${SVC}/PurchaseOrders(PurchaseOrder='${po}',IsActiveEntity=false)`;

test('P2-OP-18 P2-OP-01 draft: edit creates a draft (marker), changes are saved in the background, Save activates', async ({ page }) => {
  const patches: string[] = [];
  page.on('request', (r) => { if (r.method() === 'PATCH') patches.push(decodeURIComponent(r.url())); });
  await open(page, orderPath('4500000003', { service: SVC }));
  await expect(page.locator('[data-sk-draft-marker]')).toHaveCount(0);
  await page.locator('[data-sk-action="Edit"]').click();
  await expect(page.locator('.sk-dynamic-page__title [data-sk-draft-marker="own"]')).toBeVisible();
  await input(page, 'Description').fill('Changed in a draft');
  // background save (no Save pressed)
  await expect(page.locator('[data-sk-draft-status]')).toHaveText('Draft saved');
  expect(patches.some((u) => u.includes('IsActiveEntity=false'))).toBe(true);
  expect((await (await page.request.get(draft('4500000003'))).json()).Description).toBe('Changed in a draft');
  expect((await (await page.request.get(active('4500000003'))).json()).Description).not.toBe('Changed in a draft');
  await evidence(page, 'P2-OP-18');
  await page.locator('[data-sk-save]').click();
  await expect(page.locator('[data-sk-action="Edit"]')).toBeVisible();
  expect((await (await page.request.get(active('4500000003'))).json()).Description).toBe('Changed in a draft');
  expect((await page.request.get(draft('4500000003'))).status()).toBe(404);
  await expect(page.locator('[data-sk-draft-marker]')).toHaveCount(0);
});

test('P2-OP-18 discarding the draft keeps the active version', async ({ page }) => {
  await open(page, orderPath('4500000003', { service: SVC }));
  const original = (await (await page.request.get(active('4500000003'))).json()).Description;
  await page.locator('[data-sk-action="Edit"]').click();
  await input(page, 'Description').fill('Throw away');
  await expect(page.locator('[data-sk-draft-status]')).toHaveText('Draft saved');
  await page.locator('[data-sk-cancel]').click();
  await expect(page.locator('[data-sk-confirm="discard"]').getByRole('dialog').or(page.getByRole('dialog', { name: 'Discard Draft' }))).toBeVisible();
  await page.locator('[data-sk-confirm-ok]').click();
  await expect(page.locator('[data-sk-action="Edit"]')).toBeVisible();
  expect((await page.request.get(draft('4500000003'))).status()).toBe(404);
  expect((await (await page.request.get(active('4500000003'))).json()).Description).toBe(original);
});

test('P2-OP-19 unsaved changes of another user: icon next to the title, popover with who and when, edit is locked', async ({ page }) => {
  await open(page, orderPath('4500000004', { service: SVC }));
  const marker = page.locator('.sk-dynamic-page__title [data-sk-draft-marker="other"]');
  await expect(marker).toBeVisible();
  const title = await page.locator('.sk-dynamic-page__heading').boundingBox();
  expect((await marker.boundingBox())!.x).toBeGreaterThan(title!.x + title!.width - 1);
  await marker.click();
  const pop = page.locator('[data-sk-draft-popover]');
  await expect(pop.locator('[data-sk-draft-user]')).toHaveText('Changed by: Alex Miller');
  await expect(pop.locator('[data-sk-draft-time]')).toContainText('2026');
  await evidence(page, 'P2-OP-19');
  await pop.locator('[data-sk-draft-popover-close]').click();
  await expect(pop).toHaveCount(0);
  await marker.click();
  await page.locator('.sk-dynamic-page__heading').click({ position: { x: 2, y: 2 } }); // click outside closes too
  await expect(pop).toHaveCount(0);
  await page.locator('[data-sk-action="Edit"]').click();
  await page.locator('[data-sk-message-button]').click();
  await expect(page.locator('[data-sk-message="error"]')).toContainText('Locked by Alex Miller');
});

test('P2-OP-23 subobjects with fewer than 8 fields are created in a dialog (draft)', async ({ page }) => {
  await open(page, orderPath('4500000003', { service: SVC }));
  await page.locator('[data-sk-action="Edit"]').click();
  await page.locator('[data-sk-anchor="Items"]').click();
  const items = page.locator('[data-sk-section="Items"] .sk-table');
  await items.locator('[data-sk-action="Create"]').click();
  const dialog = page.getByRole('dialog', { name: 'New Purchase Order Item' });
  await expect(dialog).toBeVisible();
  expect(await dialog.locator('[data-sk-create-field]').count()).toBeLessThan(8);
  await dialog.locator('[data-sk-create-field="Material"] input:not([type="hidden"])').fill('MAT-10001');
  await dialog.locator('[data-sk-create-field="Plant"] input:not([type="hidden"])').fill('1010');
  await dialog.locator('[data-sk-create-field="OrderQuantity"] input:not([type="hidden"])').fill('3');
  await evidence(page, 'P2-OP-23', dialog);
  await dialog.locator('[data-sk-create-submit]').click();
  await expect(dialog).toHaveCount(0);
  const n = await (await page.request.get(`${draft('4500000003')}/_Item/$count`)).text();
  const m = await (await page.request.get(`${active('4500000003')}/_Item/$count`)).text();
  expect(Number(n)).toBe(Number(m) + 1);
});

test('P2-LR-15 creationMode NewPage (FE default) on the draft service: Create opens a new draft on the object page', async ({ page }) => {
  await open(page, '/po-draft');
  await page.locator('[data-sk-table="PurchaseOrders"] [data-sk-action="Create"]').click();
  await expect.poll(() => decodeURIComponent(page.url())).toContain('IsActiveEntity=false)');
});

test('P2-LR-15 creationMode CreationDialog on the draft service: draft created and activated', async ({ page }) => {
  await open(page, '/po-draft?creation=CreationDialog');
  await page.locator('[data-sk-table="PurchaseOrders"] [data-sk-action="Create"]').click();
  const dialog = page.getByRole('dialog', { name: 'New Purchase Order' });
  await dialog.locator('[data-sk-create-field="Supplier"] input:not([type="hidden"])').fill('0000100001');
  await dialog.locator('[data-sk-create-field="CompanyCode"] input:not([type="hidden"])').fill('1000');
  await dialog.locator('[data-sk-create-field="PurchaseOrderType"] input[role="combobox"]').click();
  await page.getByRole('option', { name: /Standard Order/ }).click();
  await dialog.locator('[data-sk-create-field="PurchasingGroup"] input:not([type="hidden"])').fill('P01');
  const date = dialog.locator('[data-sk-create-field="OrderDate"] input[data-sk-editor="date"]');
  await date.fill('2026-11-21');
  await date.press('Tab');
  await dialog.locator('[data-sk-create-submit]').click();
  await expect.poll(() => decodeURIComponent(page.url())).toContain("IsActiveEntity=true)");
  await expect(page.locator('.sk-dynamic-page__heading')).toHaveText(/^4500010001$/);
});
