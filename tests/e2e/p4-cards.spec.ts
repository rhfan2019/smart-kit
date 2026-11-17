/** Cards (docs/20-research-cards.md, docs/22-cards-acceptance.md) on the demo's card page (/cards). */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { open, resetServer } from './helpers';

test.beforeEach(async ({ page }) => resetServer(page));

const shot = async (target: Locator, id: string) => {
  if (process.env.E2E_EVIDENCE === '1') await target.screenshot({ path: `docs/21-evidence/${id}.png`, animations: 'disabled' });
};
const pageShot = async (page: Page, id: string) => {
  if (process.env.E2E_EVIDENCE !== '1') return;
  await page.locator('#demo-main').evaluate((el) => el.scrollTo(0, 0));
  await page.screenshot({ path: `docs/21-evidence/${id}.png`, fullPage: true, animations: 'disabled' });
};
const card = (page: Page, title: string) => page.getByRole('region', { name: title, exact: true });
/** Position of `inner` relative to the card's border box. */
const at = async (c: Locator, inner: Locator) => {
  const a = (await c.boundingBox())!;
  const b = (await inner.boundingBox())!;
  return { x: Math.round(b.x - a.x), y: Math.round(b.y - a.y), w: Math.round(b.width), h: Math.round(b.height) };
};

test('CD-01 CD-02 CD-03 CD-08 CD-10 list card: 340 px from the grid, header 16 px inset, counter top right, items 80 px', async ({ page }) => {
  await open(page, '/cards');
  const c = card(page, 'Large Orders to Approve');
  await expect(c.locator('.sk-card__item')).toHaveCount(3);
  expect((await c.boundingBox())!.width).toBe(340);
  expect(await at(c, c.locator('.sk-card__title'))).toMatchObject({ x: 17, y: 17 });
  const status = c.locator('.sk-card__status');
  await expect(status).toHaveText(/^3 of \d+$/);
  const s = await at(c, status);
  expect(s.x + s.w).toBe(323);
  const first = await at(c, c.locator('.sk-card__item').nth(0));
  const second = await at(c, c.locator('.sk-card__item').nth(1));
  expect(second.y - first.y).toBe(80);
  // the info is the data point with its currency, on the description row
  await expect(c.locator('.sk-card__item-info').first()).toHaveText(/^[\d,]+\.\d\d [A-Z]{3}$/);
  await shot(c, 'CD-10-list');
});

test('CD-05 CD-11 the header opens the list page with the same entity set; an item opens its object page', async ({ page }) => {
  await open(page, '/cards');
  const c = card(page, 'Large Orders in Delivery');
  await c.getByRole('button', { name: 'Large Orders in Delivery' }).click();
  await expect(page).toHaveURL(/\/po\?|\/po$/);
  await open(page, '/cards');
  await card(page, 'Large Orders in Delivery').locator('.sk-card__item').first().click();
  await expect(page).toHaveURL(/\/purchasing\/object\?path=PurchaseOrders/);
});

test('CD-12 CD-13 extended list, bar flavor and table card', async ({ page }) => {
  await open(page, '/cards');
  const ext = card(page, 'Large Orders (Extended)');
  await expect(ext.locator('.sk-card__item')).toHaveCount(3);
  await expect(ext.locator('.sk-card__item-attributes').first()).toBeVisible();
  // the bar flavor with a target value draws bullets (also CD-17 below)
  await expect(card(page, 'Invoicing vs. Budget').locator('.sk-card__item-chart')).toHaveCount(4);
  const table = card(page, 'Orders to Approve');
  await expect(table.locator('thead th')).toHaveCount(3);
  await expect(table.locator('tbody tr')).toHaveCount(5);
  expect(await at(table, table.locator('thead th').nth(1))).toMatchObject({ x: 114 });
  await shot(table, 'CD-13-table');
});

test('CD-04 CD-30 analytical card: KPI header from UI.DataPoint (sum, unit, state, trend, target, deviation) and the chart', async ({ page }) => {
  await open(page, '/cards');
  const c = card(page, 'Purchasing Spend');
  await expect(c.locator('.sk-card__number')).toHaveText('587');
  await expect(c.locator('.sk-card__scale')).toHaveText('M');
  await expect(c.locator('.sk-card__unit')).toHaveText('EUR');
  await expect(c.locator('.sk-card__main')).toHaveClass(/sk-card--state-good/);
  await expect(c.locator('.sk-card__trend--up')).toBeVisible();
  await expect(c.locator('.sk-card__side')).toHaveText(['Target600M', 'Deviation-2.2%']);
  await expect(c.locator('[data-sk-chart="column"] [data-sk-chart-bar]')).not.toHaveCount(0);
  await expect(card(page, 'By Order Type').locator('.sk-chart__segment')).toHaveCount(3);
  await shot(c, 'CD-04-analytical');
});

test('CD-20 object card: UI.HeaderInfo header, UI.QuickViewFacets groups', async ({ page }) => {
  await open(page, '/cards');
  const c = card(page, 'Fenufield Supply Inc');
  await expect(c.getByRole('heading', { name: 'Supplier Details' })).toBeVisible();
  await expect(c.locator('.sk-card__object-label').first()).toHaveText(/:$/);
  const title = await at(c, c.locator('.sk-card__object-group-title'));
  const label = await at(c, c.locator('.sk-card__object-label').first());
  expect(title).toMatchObject({ x: 17, y: 97 });
  expect(label.y - title.y).toBe(43); // SAPUI5: 97 → 140
  await shot(c, 'CD-20-object');
});

test('CD-33 timeline card: Communication.Event, newest first, relative dates', async ({ page }) => {
  await open(page, '/cards');
  const c = card(page, 'Upcoming Supplier Meetings');
  await expect(c.locator('.sk-card__timeline-title')).toHaveText(['Site audit', 'Quality review', 'Framework contract']);
  await expect(c.locator('.sk-card__timeline-date').first()).toHaveText('Today at 1:30 PM');
  const a = await at(c, c.locator('.sk-card__timeline-box').nth(0));
  const b = await at(c, c.locator('.sk-card__timeline-box').nth(1));
  expect(b.y - a.y).toBe(91); // SAPUI5 Timeline in a card: 91 px per item
  await shot(c, 'CD-33-timeline');
});

test('CD-35 CD-36 CD-37 calendar card: the selected day, counter "3 of 4", two columns above 589 px, drill-down picker', async ({ page }) => {
  await open(page, '/cards');
  const c = card(page, 'My Meetings');
  await expect(c.locator('.sk-card__appointment')).toHaveCount(3);
  await expect(c.locator('.sk-card__status')).toHaveText('3 of 4');
  await expect(c.locator('[data-date="2026-11-16"]')).toHaveClass(/sk-card__day--selected/);
  await expect(c.locator('[data-date="2026-11-20"] .sk-card__day-special')).toBeVisible();
  // two columns at 640 px: the appointments are to the right of the calendar
  const left = (await c.locator('.sk-card__calendar-left').boundingBox())!;
  const right = (await c.locator('.sk-card__calendar-right').boundingBox())!;
  expect(right.x).toBeGreaterThanOrEqual(left.x + left.width);
  expect(await at(c, c.locator('.sk-card__calendar-grid'))).toMatchObject({ x: 17, y: 133 });
  await shot(c, 'CD-35-calendar');
  // another day
  await c.locator('[data-date="2026-11-17"]').click();
  await expect(c.locator('[data-date="2026-11-17"]')).toHaveClass(/sk-card__day--selected/);
  // drill down: months → years → back to days
  await c.getByRole('button', { name: 'November 2026' }).click();
  await expect(c.locator('.sk-card__calendar-cells--months .sk-card__cell')).toHaveCount(12);
  await c.getByRole('button', { name: '2026' }).click();
  await expect(c.locator('.sk-card__calendar-cells--years .sk-card__cell')).toHaveCount(20);
  await c.getByRole('button', { name: 'Today' }).click();
  await expect(c.getByRole('button', { name: 'November 2026' })).toBeVisible();
  // one column below 590 px
  await c.evaluate((el) => { (el as HTMLElement).style.width = '400px'; });
  const l2 = (await c.locator('.sk-card__calendar-left').boundingBox())!;
  const r2 = (await c.locator('.sk-card__calendar-right').boundingBox())!;
  expect(r2.y).toBeGreaterThanOrEqual(l2.y + l2.height);
});

test('CD-01 the whole page in both languages and the dark theme', async ({ page }) => {
  await open(page, '/cards', { lang: 'zh' });
  await expect(card(page, '在途大额订单').locator('.sk-card__status')).toHaveText(/^4 \/ \d+$/);
  await expect(card(page, '我的会议').locator('.sk-card__status')).toHaveText('3 / 4');
  await expect(card(page, '我的会议').locator('.sk-card__appointment')).toHaveCount(3);
  await pageShot(page, 'CD-page-zh');
  await open(page, '/cards', { theme: 'dark' });
  await expect(card(page, 'My Meetings').locator('.sk-card__appointment')).toHaveCount(3);
  await pageShot(page, 'CD-page-dark');
});

test('CD-15 CD-16 CD-17 CD-18 sky theme: highlight and state icons, grouped table with links and progress, bullet list', async ({ page }) => {
  await open(page, '/cards', { theme: 'sky' });
  const list = card(page, 'Large Orders in Delivery');
  await expect(list.locator('.sk-card__item')).toHaveCount(4);
  await expect(list.locator('.sk-card__item--highlight').first()).toBeVisible();
  expect(await list.locator('.sk-card__item--highlight').first().evaluate((el) => getComputedStyle(el).borderInlineStartWidth)).toBe('6px');
  await expect(list.locator('.sk-card__state-icon').first()).toBeVisible();
  const table = card(page, 'Orders in Delivery');
  await expect(table.locator('.sk-card__group-row')).toHaveText(['Ordered', 'Partially Delivered']);
  await expect(table.locator('thead th')).toHaveText(['Purchase Order', 'Net Amount', 'Status', 'Delivery Progress']);
  await expect(table.locator('.sk-card__identifier--link').first()).toHaveCSS('color', 'rgb(0, 100, 217)');
  await expect(table.locator('.sk-card__progress')).toHaveCount(5);
  await expect(card(page, 'Invoicing vs. Budget').locator('.sk-card__item-bullet [data-sk-microchart="bullet"]')).toHaveCount(4);
  // Horizon-like colours: page, card and chart
  expect(await page.locator('body').evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--sk-color-page').trim())).not.toBe('');
  await shot(list, 'CD-15-list-sky');
  await shot(table, 'CD-18-table-sky');
  await pageShot(page, 'CD-page-sky');
});
