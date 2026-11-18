/** Phase 2 · Dynamic Page Layout (docs/13 §8–9): figure items and behaviour rules on the list report and object page. */
import { expect, test, type Page } from '@playwright/test';
import { evidence, mainScroll, open, orderPath, resetServer, waitForRows } from './helpers';

test.beforeEach(async ({ page }) => resetServer(page));

const title = (page: Page) => page.locator('.sk-dynamic-page__title').first();
const collapsed = (page: Page) => page.locator('.sk-dynamic-page__title[data-collapsed]');
const box = (page: Page, sel: string) => page.locator(sel).first().evaluate((el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom }; });

test('P2-DPI-01 P2-DPI-02 P2-DPC-01a P2-DPC-01b P2-DPC-02 P2-DPC-03 P2-DPC-05 P2-DPC-07 P2-DPT-01 P2-DPT-02 P2-LRC-01 P2-LRC-02 P2-LRC-05 P2-LRC-07 list report on the dynamic page', async ({ page }) => {
  await open(page, '/po');
  await waitForRows(page, 'PurchaseOrders');
  // header title with variant management (title can be variant management, DP Header Title (1))
  await expect(title(page).getByRole('button', { name: /Standard/ })).toBeVisible();
  // collapsed (a query ran): the subtitle shows the filter information (DP Header Title (2), LR Filter Information)
  await expect(collapsed(page)).toBeVisible();
  await expect(page.locator('.sk-dynamic-page__summary')).toHaveText(/filters? active/);
  // global actions on the right (share)
  const actions = await box(page, '[data-sk-global-actions]');
  const heading = await box(page, '.sk-dynamic-page__heading-block');
  expect(actions.x).toBeGreaterThan(heading.right);
  await expect(page.locator('[data-sk-global-actions] [data-sk-share]')).toBeVisible();
  // expandable header content with the filter bar
  await page.locator('[data-sk-header-toggle]').click();
  await expect(page.locator('.sk-dynamic-page__header .sk-filterbar')).toBeVisible();
  // content area with the table
  await expect(page.locator('.sk-dynamic-page__content [data-sk-table="PurchaseOrders"]')).toBeVisible();
  await evidence(page, 'P2-LRC-01');
});

test('P2-DPH-02 P2-DPC-06a P2-DPC-06b P2-LRC-06a P2-LRC-06b header features on the bottom border, also with data loaded', async ({ page }) => {
  await open(page, '/po');
  await waitForRows(page, 'PurchaseOrders');
  await page.locator('[data-sk-header-toggle]').click();
  await expect(page.locator('.sk-dynamic-page__header')).toBeVisible();
  const toggle = page.locator('[data-sk-header-toggle]');
  const pin = page.locator('[data-sk-header-pin]');
  await expect(toggle).toBeVisible();
  await expect(pin).toBeVisible();
  // both icon buttons sit centred on the bottom border of the header content
  const header = await box(page, '.sk-dynamic-page__header');
  const t = await box(page, '[data-sk-header-toggle]');
  const p = await box(page, '[data-sk-header-pin]');
  expect(Math.abs(t.y + t.h / 2 - header.bottom)).toBeLessThanOrEqual(2);
  expect(Math.abs(p.y + p.h / 2 - header.bottom)).toBeLessThanOrEqual(2);
  const page1 = await box(page, '.sk-dynamic-page');
  expect(Math.abs((t.x + p.right) / 2 - (page1.x + page1.w / 2))).toBeLessThan(40);
  await expect(toggle).toHaveAttribute('aria-label', 'Collapse Header');
  await expect(pin).toHaveAttribute('aria-pressed', 'false');
  await evidence(page, 'P2-LRC-06a', page.locator('.sk-dynamic-page__sticky'));
});

test('P2-DP-01 P2-OPC-01 the header starts expanded on the object page', async ({ page }) => {
  await open(page, orderPath('4500000001'));
  await expect(page.locator('.sk-object-header')).toBeVisible();
  await expect(collapsed(page)).toHaveCount(0);
});

test('P2-DPC-04 P2-DPT-04 key information in the middle of the title bar, left-aligned', async ({ page }) => {
  await open(page, orderPath('4500000001'));
  const key = page.locator('[data-sk-key-info]');
  await expect(key.locator('[data-sk-generic-tag]')).toContainText('Status');
  const k = await box(page, '[data-sk-key-info]');
  const h = await box(page, '.sk-dynamic-page__heading-block');
  const a = await box(page, '[data-sk-global-actions]');
  expect(k.x).toBeGreaterThanOrEqual(h.right);
  expect(k.right).toBeLessThanOrEqual(a.x + 1);
  // left-aligned: starts right after the title block, not centred
  expect(k.x - h.right).toBeLessThan(40);
});

test('P2-DPT-05 global actions stay available while the header is collapsed', async ({ page }) => {
  await open(page, orderPath('4500000001'));
  await page.locator('[data-sk-header-toggle]').click();
  await expect(collapsed(page)).toBeVisible();
  await expect(page.locator('[data-sk-global-actions] [data-sk-action="Edit"]')).toBeEnabled();
});

test('P2-DPH-01 without header content the title bar is not interactive and has no expand/collapse button', async ({ page }) => {
  await open(page, '/northwind/object?path=Categories(1)');
  await expect(page.locator('.sk-dynamic-page__heading')).toBeVisible();
  await expect(page.locator('.sk-dynamic-page__header')).toHaveCount(0);
  await expect(page.locator('[data-sk-header-toggle]')).toHaveCount(0);
  await expect(page.locator('.sk-dynamic-page__title[data-snap]')).toHaveCount(0);
  expect(await title(page).evaluate((el) => getComputedStyle(el).cursor)).not.toBe('pointer');
});

test('P2-DP-02 snap on scroll: scrolling down collapses, scrolling up expands', async ({ page }) => {
  await open(page, orderPath('4500000001'));
  await mainScroll(page, 700);
  await expect(collapsed(page)).toBeVisible();
  await expect(title(page)).toBeInViewport();
  await mainScroll(page, 0);
  await expect(collapsed(page)).toHaveCount(0);
});

test('P2-DP-03 snap on click: title bar toggles, hand cursor, hover effect on the title and the button', async ({ page }) => {
  await open(page, orderPath('4500000001'));
  expect(await title(page).evaluate((el) => getComputedStyle(el).cursor)).toBe('pointer');
  const before = await title(page).evaluate((el) => getComputedStyle(el).backgroundColor);
  await title(page).hover({ position: { x: 600, y: 20 } });
  await expect.poll(() => title(page).evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe(before);
  const btn = page.locator('[data-sk-header-toggle]');
  const btnBefore = await btn.evaluate((el) => getComputedStyle(el).backgroundColor);
  await btn.hover();
  await expect.poll(() => btn.evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe(btnBefore);
  await title(page).click({ position: { x: 600, y: 20 } });
  await expect(collapsed(page)).toBeVisible();
  await title(page).click({ position: { x: 600, y: 10 } });
  await expect(collapsed(page)).toHaveCount(0);
});

test('P2-DP-04 pin keeps the header while scrolling; collapsing overrules and releases the pin', async ({ page }) => {
  await open(page, orderPath('4500000001'));
  await page.locator('[data-sk-header-pin]').click();
  await mainScroll(page, 700);
  await page.waitForTimeout(200);
  await expect(collapsed(page)).toHaveCount(0);
  await page.locator('[data-sk-header-toggle]').click();
  await expect(collapsed(page)).toBeVisible();
  await page.locator('[data-sk-header-toggle]').click();
  // expanding scrolls back to the top; the pin button is shown again once the header content is visible
  await expect(page.locator('.sk-object-header')).toBeInViewport();
  await expect(page.locator('[data-sk-header-pin]')).toHaveAttribute('aria-pressed', 'false');
});

test('P2-DP-05 no pin on phones or when the header takes more than 60% of the screen', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await open(page, orderPath('4500000001'));
  await expect(page.locator('[data-sk-header-toggle]')).toBeVisible();
  await expect(page.locator('[data-sk-header-pin]')).toHaveCount(0);
  await page.setViewportSize({ width: 1000, height: 420 });
  await open(page, orderPath('4500000001'));
  await expect(page.locator('.sk-object-header')).toBeVisible();
  await expect(page.locator('[data-sk-header-pin]')).toHaveCount(0);
});

test('P2-DP-06 special case: a grid table fills the page, the page does not scroll', async ({ page }) => {
  await open(page, '/po');
  await waitForRows(page, 'PurchaseOrders');
  const m = await page.locator('#demo-main').evaluate((el) => ({ scroll: el.scrollHeight, client: el.clientHeight }));
  expect(m.scroll).toBeLessThanOrEqual(m.client + 1);
  await expect(page.locator('.sk-dynamic-page--fill')).toBeVisible();
});

test('P2-DP-07 keyboard: F6 jumps into the title (expands) and out of the header (collapses); Shift+F6 back', async ({ page }) => {
  await open(page, orderPath('4500000001'));
  await page.locator('.sk-dynamic-page__heading').waitFor();
  await page.locator('[data-sk-header-toggle]').click();
  await expect(collapsed(page)).toBeVisible();
  await page.locator('.demo__nav a').first().focus();
  await page.keyboard.press('F6');
  await expect(title(page)).toBeFocused();
  await expect(collapsed(page)).toHaveCount(0);
  await page.keyboard.press('F6');
  await expect.poll(() => page.evaluate(() => Boolean(document.activeElement?.closest('.sk-dynamic-page__content')))).toBe(true);
  await expect(collapsed(page)).toBeVisible();
  await page.keyboard.press('Shift+F6');
  await expect(title(page)).toBeFocused();
  await expect(collapsed(page)).toHaveCount(0);
  await page.keyboard.press('Shift+F6');
  await expect.poll(() => page.evaluate(() => !document.activeElement?.closest('.sk-dynamic-page'))).toBe(true);
  await expect(collapsed(page)).toBeVisible();
});

test('P2-DP-08 the title truncates when collapsed and wraps when expanded (2 lines at most collapsed)', async ({ page }) => {
  await page.setViewportSize({ width: 700, height: 900 });
  await open(page, orderPath('4500000001'));
  const heading = page.locator('.sk-dynamic-page__heading');
  const sub = page.locator('.sk-dynamic-page__subheading');
  expect(await sub.evaluate((el) => getComputedStyle(el).whiteSpace)).not.toBe('nowrap');
  await page.locator('[data-sk-header-toggle]').click();
  await expect(collapsed(page)).toBeVisible();
  expect(await heading.evaluate((el) => getComputedStyle(el).whiteSpace)).toBe('nowrap');
  expect(await sub.evaluate((el) => getComputedStyle(el).textOverflow)).toBe('ellipsis');
  const lineHeight = await heading.evaluate((el) => parseFloat(getComputedStyle(el).lineHeight) || 24);
  const block = await box(page, '.sk-dynamic-page__heading-block');
  expect(block.h).toBeLessThanOrEqual(lineHeight * 2 + 24);
});

test('P2-DP-09 P2-OPC-06 global actions move into the overflow from right to left; the first stays', async ({ page }) => {
  await open(page, orderPath('4500000001'));
  const actions = page.locator('[data-sk-global-actions]');
  await expect(actions.locator('[data-sk-action="Edit"]')).toBeVisible();
  await expect(actions.locator('[data-sk-action="Delete"]')).toBeVisible();
  await expect(actions.locator('[data-sk-toolbar-more]')).toHaveCount(0);
  // stage 5: the side content toggle left the title (it is a sub-section action now), so one action less: narrower
  await page.setViewportSize({ width: 640, height: 900 });
  await expect(actions.locator('[data-sk-toolbar-more]')).toBeVisible();
  await expect(actions.locator('[data-sk-action="Edit"]')).toBeVisible();
  await actions.locator('[data-sk-toolbar-more]').click();
  // the rightmost actions are in the overflow, in their original order
  const overflow = page.locator('[data-sk-toolbar-overflow]');
  await expect(overflow.locator('button').first()).toBeVisible();
  const menu = await overflow.locator('button').allInnerTexts();
  expect(menu.length).toBeGreaterThan(0);
  expect(menu[menu.length - 1]).not.toBe('Edit');
  // key information stays as long as possible
  await expect(page.locator('[data-sk-key-info]')).toBeVisible();
  await evidence(page, 'P2-OPC-06');
});

test('P2-DP-10 letterboxing limits the page to 1280px', async ({ page }) => {
  await page.setViewportSize({ width: 1700, height: 900 });
  await open(page, orderPath('4500000001', { extra: '&letterbox=1' }));
  const c = await box(page, '.sk-dynamic-page__content');
  expect(c.w).toBeLessThanOrEqual(1280);
  expect(c.x).toBeGreaterThan(100);
});

test('P2-DP-11 summary line on phones: collapsed header shows only the title and an arrow button', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await open(page, orderPath('4500000001'));
  await page.locator('[data-sk-header-toggle]').click();
  const line = page.locator('[data-sk-summary-line]');
  await expect(line).toBeVisible();
  await expect(line.locator('[data-sk-global-actions]')).toHaveCount(0);
  await expect(line.locator('[data-sk-summary-toggle]')).toBeVisible();
  await line.locator('[data-sk-summary-toggle]').click();
  await expect(page.locator('.sk-object-header')).toBeVisible();
});

test('P2-DPI-03 P2-DPC-08 P2-DPF-01 footer toolbar with finalizing actions only', async ({ page }) => {
  await open(page, orderPath('4500002573'));
  const footer = page.locator('.sk-dynamic-page__footer');
  await expect(footer).toBeVisible();
  await expect(footer.locator('[data-sk-action]')).not.toHaveCount(0);
  await page.locator('[data-sk-action="Edit"]').click();
  await expect(footer.locator('[data-sk-save]')).toBeVisible();
  await expect(footer.locator('[data-sk-cancel]')).toBeVisible();
  await expect(footer.locator('[data-sk-action="Edit"], [data-sk-share]')).toHaveCount(0);
});

test('P2-DPT-06 P2-FCL-02 layout actions: next to the global actions from 1280px, in a row above below 1280px', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page, `/fcl?object=${encodeURIComponent("PurchaseOrders('4500000001')")}`);
  const mid = page.locator('[data-sk-fcl-column="1"]');
  await expect(mid.locator('[data-sk-layout-actions]')).toHaveAttribute('data-placement', 'above');
  await mid.locator('[data-sk-layout-action="full-screen"]').click();
  await expect(page.locator('[data-sk-fcl="MidColumnFullScreen"]')).toBeVisible();
  await expect(mid.locator('[data-sk-layout-actions]')).toHaveAttribute('data-placement', 'inline');
  // always at the very right, after a divider
  const la = await mid.locator('[data-sk-layout-actions]').evaluate((el) => { const r = el.getBoundingClientRect(); const t = el.closest('.sk-dynamic-page__title-row')!.getBoundingClientRect(); return { right: r.right, rowRight: t.right, divider: Boolean(el.previousElementSibling?.classList.contains('sk-dynamic-page__divider')) }; });
  expect(la.divider).toBe(true);
  expect(la.rowRight - la.right).toBeLessThan(2);
  await expect(mid.locator('[data-sk-layout-action="exit-full-screen"]')).toBeVisible();
  await mid.locator('[data-sk-layout-action="exit-full-screen"]').click();
  await expect(page.locator('[data-sk-fcl="TwoColumnsMidExpanded"]')).toBeVisible();
  await mid.locator('[data-sk-layout-action="close"]').click();
  await expect(page.locator('[data-sk-fcl="OneColumn"]')).toBeVisible();
});
