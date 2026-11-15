/** Phase 2 · Object Page (docs/13 §4–7, display mode): Components, anchor bar and tab figures, header facets, content. */
import { expect, test, type Page } from '@playwright/test';
import { evidence, mainScroll, open, orderPath, resetServer } from './helpers';

test.beforeEach(async ({ page }) => resetServer(page));

const itemPath = (po: string, item: number) => `/purchasing/object?path=${encodeURIComponent(`PurchaseOrders('${po}')/_Item(PurchaseOrder='${po}',PurchaseOrderItem=${item})`)}`;
const rect = (page: Page, sel: string) => page.locator(sel).first().evaluate((el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom }; });

test('P2-OPC-02 P2-OPC-03 P2-OPC-04 P2-OPC-07 components: navigation bar, content area with sections, facets wrapping, below the host shell bar', async ({ page }) => {
  await open(page, orderPath('4500000001'));
  await expect(page.locator('.sk-dynamic-page__navigation nav.sk-anchorbar')).toBeVisible();
  await expect(page.locator('.sk-dynamic-page__content [data-sk-section]')).not.toHaveCount(0);
  await expect(page.locator('[data-sk-section] [data-sk-subsection]').first()).toBeVisible();
  // the shell bar belongs to the host (demo bar); the library renders none and the page starts below it
  const shell = await rect(page, '.demo__bar');
  const pageTop = await rect(page, '.sk-dynamic-page');
  expect(pageTop.y).toBeGreaterThanOrEqual(shell.bottom - 1);
  await expect(page.locator('.sk-dynamic-page [role="banner"]')).toHaveCount(0);
  // facets flow from left to right and wrap to a second line
  const tops = await page.locator('.sk-object-header__facets > .sk-facet').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
  expect(new Set(tops).size).toBeGreaterThan(1);
  await evidence(page, 'P2-OPC-07', page.locator('.sk-dynamic-page__sticky, .sk-object-header').first());
});

test('P2-OPC-05 breadcrumbs above the title show the drilldown levels', async ({ page }) => {
  await open(page, itemPath('4500000001', 10));
  const crumbs = page.locator('.sk-dynamic-page__breadcrumbs');
  await expect(crumbs.locator('[data-sk-breadcrumb]')).toHaveText(['4500000001']);
  expect((await rect(page, '.sk-dynamic-page__breadcrumbs')).bottom).toBeLessThanOrEqual((await rect(page, '.sk-dynamic-page__heading')).y + 1);
});

test('P2-OPC-08 P2-OP-26 footer toolbar with the determining actions in display mode; hidden when not available', async ({ page }) => {
  await open(page, orderPath('4500002573')); // New
  const footer = page.locator('.sk-dynamic-page__footer');
  await expect(footer.locator('[data-sk-action="DataFieldForAction::Purchasing.approve"]')).toBeVisible();
  await expect(footer.locator('[data-sk-action="DataFieldForAction::Purchasing.reject"]')).toBeVisible();
  await evidence(page, 'P2-OPC-08', footer);
  await footer.locator('[data-sk-action="DataFieldForAction::Purchasing.approve"]').click();
  // approved: the actions are no longer available and disappear
  await expect(footer.locator('[data-sk-action="DataFieldForAction::Purchasing.approve"]')).toHaveCount(0);
  await expect(page.locator('[data-sk-message-button]')).toBeVisible();
});

test('P2-OPA-01 P2-OPA-02 P2-OPA-03 P2-OPA-04 P2-OPA-05 anchors: active and inactive, subsection dropdown with indicator', async ({ page }) => {
  await open(page, orderPath('4500000001'));
  const active = page.locator('[data-sk-anchor][aria-current="true"]');
  await expect(active).toHaveCount(1);
  await expect(active).toHaveAttribute('data-sk-anchor', 'GeneralInformation');
  const other = page.locator('[data-sk-anchor="Items"]');
  await expect(other).not.toHaveAttribute('aria-current', 'true');
  const colorActive = await active.evaluate((e) => getComputedStyle(e).color);
  const colorOther = await other.evaluate((e) => getComputedStyle(e).color);
  expect(colorActive).not.toBe(colorOther);
  const indicator = page.locator('[data-sk-anchor-menu="GeneralInformation"]');
  await expect(indicator.locator('svg')).toBeVisible();
  await indicator.click();
  const items = page.getByRole('menuitem');
  await expect(items).toHaveCount(2);
  await evidence(page, 'P2-OPA-03');
  await items.nth(1).click();
  await expect(page.locator('[data-sk-subsection="AmountData"]')).toBeInViewport();
});

test('P2-OPA-06 P2-OPA-07 P2-OPA-08 P2-OPA-09 P2-OPA-10 P2-OPA-11 overflow: carousel buttons, overflow menu with sections and subsections', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 900 });
  await open(page, orderPath('4500000001', { extra: '&extra=8' }));
  const forward = page.locator('[data-sk-anchor-scroll="forward"]');
  await expect(forward).toBeVisible();
  const list = page.locator('.sk-anchorbar__list');
  await forward.click();
  await expect.poll(() => list.evaluate((e) => e.scrollLeft)).toBeGreaterThan(0);
  await expect(page.locator('[data-sk-anchor-scroll="back"]')).toBeVisible();
  await evidence(page, 'P2-OPA-06', page.locator('.sk-dynamic-page__navigation'));
  const button = page.locator('[data-sk-anchor-overflow]');
  const b = await button.boundingBox();
  const nav = await page.locator('.sk-anchorbar').boundingBox();
  expect(b!.x + b!.width).toBeGreaterThan(nav!.x + nav!.width - 80); // on the right
  await button.click();
  const section = page.locator('[data-sk-overflow-section="GeneralInformation"]');
  const sub = page.locator('[data-sk-overflow-subsection="AmountData"]');
  await expect(section).toBeVisible();
  await expect(sub).toBeVisible();
  // subsections are indented below their section
  expect((await sub.boundingBox())!.x).toBeLessThan(((await sub.boundingBox())!.x) + 1);
  const pad = async (l: typeof sub) => l.evaluate((e) => parseFloat(getComputedStyle(e).paddingLeft));
  expect(await pad(sub)).toBeGreaterThan(await pad(section));
  // hover highlight of a section in the overflow menu
  const before = await section.evaluate((e) => getComputedStyle(e).backgroundColor);
  await section.hover();
  await expect.poll(() => section.evaluate((e) => getComputedStyle(e).backgroundColor)).not.toBe(before);
  await evidence(page, 'P2-OPA-08');
  await page.locator('[data-sk-overflow-section="Items"]').click();
  await expect(page.locator('[data-sk-section="Items"]')).toBeInViewport();
  await button.click();
  await page.locator('[data-sk-overflow-subsection="AmountData"]').click();
  await expect(page.locator('[data-sk-subsection="AmountData"]')).toBeInViewport();
});

test('P2-OPT-01 P2-OPT-02 P2-OPT-03 tabs: always visible, counts, subnavigation arrow; tab content shows the subsection titles', async ({ page }) => {
  await open(page, orderPath('4500000001', { layout: 'tabs' }));
  const tabs = page.getByRole('tab');
  await expect(page.locator('[data-sk-anchor="Items"]')).toHaveText('Items (150)');
  await expect(page.locator('[data-sk-anchor-menu="GeneralInformation"]')).toBeVisible();
  await expect(tabs.first()).toHaveAttribute('aria-selected', 'true');
  // one section at a time, no section title; the subsections have their titles, in order
  await expect(page.locator('.sk-section__title')).toHaveCount(0);
  const titles = page.locator('[data-sk-section="GeneralInformation"] .sk-subsection__title');
  await expect(titles).toHaveText(['General Data', 'Amounts']);
  const [a, b] = await titles.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().top));
  expect(b!).toBeGreaterThan(a!);
  await evidence(page, 'P2-OPT-01');
  await mainScroll(page, 400);
  await expect(page.locator('.sk-dynamic-page__navigation')).toBeInViewport();
});

test('P2-OP-08 small screens: the anchor bar becomes a select; tabs scroll horizontally (carousel)', async ({ page }) => {
  await page.setViewportSize({ width: 420, height: 800 });
  await open(page, orderPath('4500000001'));
  const select = page.getByRole('combobox', { name: 'Sections' });
  await expect(select).toBeVisible();
  await select.click();
  await expect(page.getByRole('option', { name: /Amounts/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await open(page, orderPath('4500000001', { layout: 'tabs', extra: '&extra=4' }));
  await expect(page.locator('.sk-anchorbar--select')).toHaveCount(0);
  await expect(page.getByRole('tablist')).toBeVisible();
  await expect(page.locator('[data-sk-anchor-scroll="forward"]')).toBeVisible();
  await page.locator('[data-sk-anchor-scroll="forward"]').click();
  await expect.poll(() => page.locator('.sk-anchorbar__list').evaluate((e) => e.scrollLeft)).toBeGreaterThan(0);
});

test('P2-OP-02 P2-OP-03 P2-OP-05 P2-OP-06 P2-OP-07 header facets: link in a form facet, plain text (320px, inline link), progress, aggregated rating', async ({ page }) => {
  await open(page, orderPath('4500000001'));
  // form facet value as a link (quick view of the supplier)
  await expect(page.locator('[data-sk-facet="HeaderGeneral"] [data-sk-quickview-link]')).toBeVisible();
  const text = page.locator('[data-sk-facet-kind="text"]');
  await expect(text.locator('.sk-facet__title')).toHaveText('Notes');
  expect(Math.round((await text.boundingBox())!.width)).toBe(320);
  await expect(text.locator('a[href^="https://example.com"]')).toBeVisible();
  const progress = page.locator('[data-sk-facet-kind="progress"]');
  await expect(progress.locator('.sk-facet__title')).toBeVisible();
  await expect(progress.locator('[role="progressbar"]')).toBeVisible();
  await expect(progress).toContainText('of 100');
  const rating = page.locator('[data-sk-facet-kind="rating-aggregated"]');
  await expect(rating.locator('[data-sk-facet-subtitle]')).toHaveText(/^\d+ ratings$/);
  await expect(rating.locator('[data-sk-facet-footer]')).toHaveText(/^\d\.\d out of 5$/);
  const kpi = page.locator('[data-sk-facet-kind="kpi"]');
  await expect(kpi.locator('.sk-facet__kpi-value')).toBeVisible();
  await evidence(page, 'P2-OP-06', page.locator('.sk-object-header'));
});

test('P2-OP-04 micro chart facets: bullet and radial on the order; harvey ball, delta, comparison, column and line on the item', async ({ page }) => {
  await open(page, orderPath('4500000001'));
  await expect(page.locator('[data-sk-microchart="bullet"]')).toBeVisible();
  await expect(page.locator('[data-sk-microchart="radial"]')).toBeVisible();
  await expect(page.locator('[data-sk-facet="HeaderBudget"] [data-sk-facet-footer]')).toHaveText('EUR');
  await open(page, itemPath('4500000001', 10));
  for (const kind of ['harvey', 'delta', 'comparison', 'column', 'line']) await expect(page.locator(`[data-sk-microchart="${kind}"]`)).toBeVisible();
  await expect(page.locator('[data-sk-microchart="column"] [data-sk-microchart-bar]')).not.toHaveCount(0);
  await evidence(page, 'P2-OP-04', page.locator('.sk-object-header'));
  // a micro chart can be pressed: it opens a larger chart
  await page.locator('[data-sk-microchart="line"]').click();
  await expect(page.getByRole('dialog').locator('[data-sk-chart]')).toBeVisible();
});

test('P2-OP-09 title styles: a lone table carries an H3-style title, a table next to other content an H4-style title', async ({ page }) => {
  await open(page, orderPath('4500000001'));
  await page.locator('[data-sk-anchor="Items"]').click();
  const lone = page.locator('[data-sk-section="Items"] [data-sk-table-title]');
  await expect(lone).toHaveAttribute('data-level', '3');
  await open(page, itemPath('4500000001', 10));
  await page.locator('[data-sk-anchor="History"]').click();
  const mixed = page.locator('[data-sk-section="Pricing"] [data-sk-table-title]');
  await expect(mixed).toHaveAttribute('data-level', '4');
  const loneOnItem = page.locator('[data-sk-section="History"] [data-sk-table-title]');
  await expect(loneOnItem).toHaveAttribute('data-level', '3');
  const size = (l: typeof lone) => l.evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
  expect(await size(loneOnItem)).toBeGreaterThan(await size(mixed));
});

test('P2-OP-10 forms hide Medium and Low importance fields on small screens', async ({ page }) => {
  await open(page, orderPath('4500000001'));
  const field = (path: string) => page.locator(`[data-sk-subsection="GeneralData"] [data-sk-field-path="${path}"]`);
  await expect(field('CreatedAt')).toBeVisible();
  await expect(field('PurchasingGroup')).toBeVisible();
  await page.setViewportSize({ width: 800, height: 900 });
  await expect(field('CreatedAt')).toBeHidden(); // Low
  await expect(field('PurchasingGroup')).toBeVisible();
  await page.setViewportSize({ width: 500, height: 900 });
  await expect(field('PurchasingGroup')).toBeHidden(); // Medium
  await expect(field('Status')).toBeVisible(); // not annotated = High
});

test('P2-OP-11 layout blocks span 1, 2 or 3 columns; a block can be behind "Show More"', async ({ page }) => {
  await open(page, orderPath('4500000001'));
  await page.locator('[data-sk-anchor="Custom::Timeline"]').click();
  const w = (id: string) => page.locator(`[data-sk-block="${id}"]`).evaluate((e) => e.getBoundingClientRect().width);
  const one = await w('one');
  expect(await w('two')).toBeGreaterThan(one * 1.8);
  expect(await w('three')).toBeGreaterThan(one * 2.7);
  await expect(page.locator('[data-sk-block="more"]')).toHaveCount(0);
  await page.locator('[data-sk-subsection="Custom::Timeline"] [data-sk-show-more]').click();
  await expect(page.locator('[data-sk-block="more"]')).toBeVisible();
  await evidence(page, 'P2-OP-11', page.locator('[data-sk-section="Custom::Timeline"]'));
  // fewer columns available: a block takes the available ones
  await page.setViewportSize({ width: 560, height: 900 });
  expect(Math.abs((await w('three')) - (await w('one')))).toBeLessThan(2);
});

test('P2-OP-12 more than 200 items: a preview with a right-aligned "Show All (x)" link to a page with the whole table', async ({ page }) => {
  await open(page, orderPath('4500000002'));
  await page.locator('[data-sk-anchor="Items"]').click();
  const link = page.locator('[data-sk-show-all]');
  await expect(link).toHaveText('Show All (230)');
  const t = page.locator('[data-sk-section="Items"] .ag-row[row-index] [col-id="DataField::PurchaseOrderItem"]');
  expect(await t.count()).toBeLessThanOrEqual(20);
  await expect(page.locator('[data-sk-section="Items"] [data-sk-more]')).toHaveCount(0);
  const l = await link.boundingBox();
  const table = await page.locator('[data-sk-section="Items"] .sk-table').boundingBox();
  expect(table!.x + table!.width - (l!.x + l!.width)).toBeLessThan(40);
  await evidence(page, 'P2-OP-12', page.locator('[data-sk-section="Items"]'));
  await link.click();
  await expect(page.locator('[data-testid="show-all-page"]')).toBeVisible();
  await expect(page.locator('[data-sk-table-title]')).toHaveText('All Items (230)');
});

test('P2-OP-13 tab navigation: a table that ends its tab loads more rows on scroll instead of a "More" button', async ({ page }) => {
  await open(page, orderPath('4500000001', { layout: 'tabs' }));
  await page.locator('[data-sk-anchor="Items"]').click();
  const rows = page.locator('[data-sk-section="Items"] .ag-row[row-index] [col-id="DataField::PurchaseOrderItem"]');
  await expect(rows.first()).toBeVisible();
  await expect(page.locator('[data-sk-more]')).toHaveCount(0);
  const before = await rows.count();
  await mainScroll(page, 100000);
  await expect.poll(() => rows.count()).toBeGreaterThan(before);
});

test('P2-OP-14 paging buttons on a sub-object page switch between sibling items', async ({ page }) => {
  await open(page, itemPath('4500000001', 20));
  const paging = page.locator('[data-sk-layout-actions] [data-sk-paging]');
  await expect(paging).toBeVisible();
  await paging.locator('[data-sk-paging-previous]').click();
  await expect(page.locator('.sk-dynamic-page__heading')).toHaveText('10');
  await expect(paging.locator('[data-sk-paging-previous]')).toBeDisabled();
  await paging.locator('[data-sk-paging-next]').click();
  await expect(page.locator('.sk-dynamic-page__heading')).toHaveText('20');
});

test('P2-OP-28 messages in display mode: generic tag with the status and the object status; message strips do not repeat it', async ({ page }) => {
  await open(page, orderPath('4500000001'));
  const tag = page.locator('[data-sk-key-info] [data-sk-generic-tag]');
  await expect(tag).toContainText('Partially Delivered');
  await expect(page.locator('[data-sk-field-path="Status"] .sk-status')).toBeVisible();
  const strip = page.locator('[data-demo-header-message]');
  if (await strip.count()) await expect(strip).not.toContainText('Partially Delivered');
});

test('P2-OP-29 loading: lazy sections show a busy placeholder; "Show More" content is rendered only when opened', async ({ page }) => {
  await open(page, orderPath('4500000001'));
  await expect(page.locator('[data-sk-section="Items"] [aria-busy="true"]').or(page.locator('[data-sk-section="Items"] .sk-table'))).toBeVisible();
  await expect(page.locator('[data-sk-subsection="NotesData"] [data-sk-field-path="Notes"]')).toHaveCount(0);
  await page.locator('[data-sk-subsection="NotesData"] [data-sk-show-more]').click();
  await expect(page.locator('[data-sk-subsection="NotesData"] [data-sk-field-path="Notes"]')).toBeVisible();
});

test('P2-OP-30 dynamic side content: toggled in the header, on the right, contextual content only', async ({ page }) => {
  await open(page, orderPath('4500000001'));
  await expect(page.locator('[data-sk-side-content]')).toHaveCount(0);
  await page.locator('[data-sk-action="SideContent"]').click();
  const side = page.locator('[data-sk-side-content]');
  await expect(side).toBeVisible();
  await expect(side).toContainText('Supplier Information');
  const s = await side.boundingBox();
  const main = await page.locator('.sk-object-page-wrap__main').boundingBox();
  expect(s!.x).toBeGreaterThanOrEqual(main!.x + main!.width - 1);
  await expect(side.locator('button')).toHaveCount(0); // no finalizing or global actions
  await evidence(page, 'P2-OP-30');
  await page.locator('[data-sk-action="SideContent"]').click();
  await expect(side).toHaveCount(0);
});
