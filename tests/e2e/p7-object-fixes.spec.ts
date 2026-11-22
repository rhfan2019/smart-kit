/**
 * Object page fixes of docs/25: S33 (footer actions at the end of the toolbar), S42 (the first section's title is not
 * shown under the anchor bar) and the column steps of blocks and forms by the width of their container.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { open, orderPath, resetServer } from './helpers';

test.beforeEach(async ({ page }) => resetServer(page));

const box = async (l: Locator) => (await l.first().boundingBox())!;

test('S33 footer: the actions are at the right end of the toolbar, the message button stays on the left (FE FooterContent ToolbarSpacer)', async ({ page }) => {
  await open(page, orderPath('4500002573')); // New: Approve and Reject in the footer
  const footer = page.locator('.sk-dynamic-page__footer');
  const approve = footer.locator('[data-sk-action="DataFieldForAction::Purchasing.approve"]');
  const reject = footer.locator('[data-sk-action="DataFieldForAction::Purchasing.reject"]');
  await expect(approve).toBeVisible();
  const f = await box(footer);
  const toolbar = await box(footer.locator('.sk-object-footer__toolbar'));
  const a = await box(approve);
  const r = await box(reject);
  // the last action ends at the end of the toolbar (its padding apart), the first one starts in the right half
  expect(toolbar.x + toolbar.width - (r.x + r.width)).toBeLessThan(24);
  expect(f.x + f.width - (r.x + r.width)).toBeLessThan(64);
  expect(a.x).toBeGreaterThan(f.x + f.width / 2);
  expect(a.x).toBeLessThan(r.x);
  // after the action the message button is shown: at the left end
  await approve.click();
  const message = footer.locator('[data-sk-message-button]');
  await expect(message).toBeVisible();
  const m = await box(message);
  expect(m.x - f.x).toBeLessThan(64);
  expect((await box(reject)).x).toBeGreaterThan(f.x + f.width / 2);
});

test('S33 footer while editing: Save and Cancel are at the right end', async ({ page }) => {
  await open(page, orderPath('4500000001'));
  await page.locator('[data-sk-action="Edit"]').click();
  const footer = page.locator('.sk-dynamic-page__footer');
  await expect(footer.locator('[data-sk-save]')).toBeVisible();
  const f = await box(footer);
  const cancel = await box(footer.locator('[data-sk-cancel]'));
  expect(f.x + f.width - (cancel.x + cancel.width)).toBeLessThan(64);
  expect((await box(footer.locator('[data-sk-save]'))).x).toBeGreaterThan(f.x + f.width / 2);
});

test('S42 the first section shows no title under the anchor bar; screen readers still get its name; the other sections keep their titles', async ({ page }) => {
  await open(page, orderPath('4500000001'));
  const first = page.locator('[data-sk-section]').first();
  await expect(first).toHaveAttribute('data-sk-section', 'GeneralInformation');
  const title = first.locator('> .sk-section__title');
  await expect(title).toHaveClass(/sk-visually-hidden/);
  const name = await title.innerText();
  expect(name.length).toBeGreaterThan(0);
  // not shown: clipped to one pixel and out of the flow, so the content starts at the top of the section
  const t = await box(title);
  expect(t.width).toBeLessThanOrEqual(2);
  expect(t.height).toBeLessThanOrEqual(2);
  const s = await box(first);
  const sub = await box(first.locator('[data-sk-subsection]'));
  expect(sub.y - s.y).toBeLessThan(2);
  // the name is what the anchor bar shows, and the accessible name of the region and of its heading
  await expect(page.locator('[data-sk-anchor="GeneralInformation"]')).toHaveText(name);
  await expect(first).toHaveAttribute('aria-label', name);
  await expect(page.getByRole('heading', { name, level: 2 })).toHaveCount(1);
  // the following sections show their titles
  const next = page.locator('[data-sk-section="Custom::Timeline"] > .sk-section__title');
  await expect(next).not.toHaveClass(/sk-visually-hidden/);
  expect((await box(next)).height).toBeGreaterThan(10);
});

test('S42 with sectionLayout "Tabs" no section title is rendered (as before)', async ({ page }) => {
  await open(page, orderPath('4500000001', { layout: 'tabs' }));
  await expect(page.locator('[data-sk-section]')).toHaveCount(1);
  await expect(page.locator('.sk-section__title')).toHaveCount(0);
});

/** Columns of the block grid of the Delivery Timeline sub-section and the width of the sub-section (the query container). */
const blocks = (page: Page) => page.locator('[data-sk-subsection="Custom::Timeline"]').evaluate((sub) => {
  const grid = sub.querySelector<HTMLElement>('[data-sk-blocks]')!;
  return { width: sub.clientWidth, columns: getComputedStyle(grid).gridTemplateColumns.split(' ').length };
});
/** Columns of the first form of the page and the width of the form's content box (the query container). */
const form = (scope: Locator) => scope.locator('.sk-form').first().evaluate((el) => {
  const cs = getComputedStyle(el);
  const grid = el.querySelector<HTMLElement>('.sk-form__grid')!;
  return { width: el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight), columns: Number(getComputedStyle(grid).getPropertyValue('--sk-form-cols')) };
});
const step = (width: number, counts: [number, number, number, number]) => (width < 600 ? counts[0] : width < 1024 ? counts[1] : width < 1440 ? counts[2] : counts[3]);

test('blocks of a sub-section adapt in steps by the width of the sub-section: 1, 2, 3, 4 columns (sap.uxap.ObjectPageSubSection S / M / L / XL)', async ({ page }) => {
  await open(page, orderPath('4500000001'));
  await page.locator('[data-sk-anchor="Custom::Timeline"]').click();
  const seen = new Set<number>();
  for (const width of [560, 800, 1280, 1700]) {
    await page.setViewportSize({ width, height: 900 });
    await expect.poll(async () => { const b = await blocks(page); return b.columns === step(b.width, [1, 2, 3, 4]); }).toBe(true);
    seen.add((await blocks(page)).columns);
  }
  // every step was reached, in particular the two-column step at tablet width
  expect([...seen].sort()).toEqual([1, 2, 3, 4]);
  // a three-column block takes the columns there are
  await page.setViewportSize({ width: 800, height: 900 });
  const w = (id: string) => page.locator(`[data-sk-block="${id}"]`).evaluate((e) => e.getBoundingClientRect().width);
  await expect.poll(async () => (await blocks(page)).columns).toBe(2);
  expect(Math.abs((await w('three')) - (await w('two')))).toBeLessThan(2);
  expect(await w('two')).toBeGreaterThan((await w('one')) * 1.8);
});

test('forms adapt by the width of the form, not of the window: 1 column, then 3, 4, 6 (sap.fe.macros.Form ColumnLayout columnsM / L / XL)', async ({ page }) => {
  await open(page, orderPath('4500000001'));
  const main = page.locator('#demo-main');
  const seen = new Set<number>();
  for (const width of [560, 800, 1280, 1700]) {
    await page.setViewportSize({ width, height: 900 });
    await expect.poll(async () => { const f = await form(main); return f.columns === step(f.width, [1, 3, 4, 6]); }).toBe(true);
    seen.add((await form(main)).columns);
  }
  expect([...seen].sort()).toEqual([1, 3, 4, 6]);
  // in a column of a flexible column layout the window is wide, the form is not: the columns follow the form
  await page.setViewportSize({ width: 1700, height: 900 });
  await open(page, `/fcl?object=${encodeURIComponent("PurchaseOrders('4500000001')")}`);
  const column = page.locator('[data-sk-fcl-column="1"]');
  await expect(column.locator('.sk-form').first()).toBeVisible();
  const f = await form(column);
  expect(f.width).toBeLessThan(1440);
  expect(f.columns).toBe(step(f.width, [1, 3, 4, 6]));
  expect(f.columns).toBeLessThan(6);
});
