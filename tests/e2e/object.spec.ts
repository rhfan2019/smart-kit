import { expect, test, type Page } from '@playwright/test';
import { open, recordOData, resetServer, table, PURCHASING } from './helpers';

const PO = '4500000001';
/** Anchor navigation unless `layout` says otherwise (purchase orders default to tabs, see AC-OP-03). */
const poPath = (po = PO, layout: 'anchor' | 'tabs' | '' = 'anchor') => `/purchasing/object?path=${encodeURIComponent(`PurchaseOrders('${po}')`)}${layout ? `&layout=${layout}` : ''}`;
const navTop = (page: Page) => page.locator('.sk-dynamic-page__navigation').evaluate((el) => Math.round(el.getBoundingClientRect().top));
const itemPath = (po = PO, item = 10) => `/purchasing/object?path=${encodeURIComponent(`PurchaseOrders('${po}')/_Item(PurchaseOrder='${po}',PurchaseOrderItem=${item})`)}`;
const main = (page: Page) => page.locator('#demo-main');
const scrollMain = (page: Page, y: number) => main(page).evaluate((el, top) => el.scrollTo({ top }), y);

test.beforeEach(async ({ page }) => resetServer(page));

test('AC-OP-01 header: title, subtitle, avatar, facets, snap on scroll, pin, collapse button', async ({ page }) => {
  await open(page, poPath());
  await expect(page.locator('.sk-dynamic-page__heading')).toHaveText(PO);
  await expect(page.locator('.sk-dynamic-page__subheading')).not.toBeEmpty();
  await expect(page.locator('.sk-object-header__avatar img')).toBeVisible();
  await expect(page.locator('.sk-object-header__facets > .sk-facet')).toHaveCount(7); // phase 2 added budget, delivery radial and notes
  await expect(page.locator('.sk-facet--form .sk-facet__pair')).toHaveCount(4);
  await expect(page.locator('.sk-facet--kpi .sk-facet__kpi-value')).toHaveText(/^\d{1,3}(,\d{3})*\.\d{2}$/);
  await expect(page.locator('.sk-facet--progress [role="progressbar"]')).toBeVisible();
  await expect(page.locator('.sk-facet--rating .mantine-Rating-root')).toBeVisible();
  // snap on scroll
  await scrollMain(page, 600);
  await expect(page.locator('.sk-dynamic-page__title[data-collapsed]')).toBeVisible();
  await expect(page.locator('.sk-dynamic-page__avatar img')).toBeVisible();
  await scrollMain(page, 0);
  await expect(page.locator('.sk-dynamic-page__title[data-collapsed]')).toHaveCount(0);
  // pin keeps the header while scrolling
  await page.locator('[data-sk-header-pin]').click();
  await scrollMain(page, 600);
  await page.waitForTimeout(200);
  await expect(page.locator('.sk-dynamic-page__title[data-collapsed]')).toHaveCount(0);
  await expect(page.locator('.sk-object-header')).toBeInViewport();
  await page.locator('[data-sk-header-pin]').click();
  await scrollMain(page, 0);
  // collapse button
  await page.locator('[data-sk-header-toggle]').click();
  await expect(page.locator('.sk-object-header')).toHaveCount(0);
  await page.locator('[data-sk-header-toggle]').click();
  await expect(page.locator('.sk-object-header')).toBeVisible();
});

test('AC-OP-02 anchors: scroll, scroll spy, subsection menu, overflow, small-screen select', async ({ page }) => {
  await open(page, poPath());
  await page.locator('[data-sk-anchor="Items"]').click();
  await expect(page.locator('[data-sk-anchor="Items"]')).toHaveAttribute('aria-current', 'true');
  await expect(page.locator('[data-sk-section="Items"]')).toBeInViewport();
  await scrollMain(page, 0);
  await expect(page.locator('[data-sk-anchor="GeneralInformation"]')).toHaveAttribute('aria-current', 'true');
  // subsection dropdown for a section with two subsections
  await page.locator('[data-sk-anchor-menu="GeneralInformation"]').click();
  await expect(page.getByRole('menuitem')).toHaveCount(2);
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-sk-anchor-menu="Items"]')).toHaveCount(0);
  // overflow menu
  await page.setViewportSize({ width: 900, height: 900 });
  await open(page, `${poPath()}&extra=8`);
  await expect(page.locator('[data-sk-anchor-overflow]')).toBeVisible();
  await page.locator('[data-sk-anchor-overflow]').click();
  await expect(page.getByRole('menuitem', { name: /8$/ })).toBeVisible();
  await page.keyboard.press('Escape');
  // small screens: a select
  await page.setViewportSize({ width: 480, height: 900 });
  await open(page, poPath());
  await expect(page.locator('.sk-anchorbar--select')).toBeVisible();
});

test.describe('with smooth scrolling (no reduced motion)', () => {
  test.use({ reducedMotion: 'no-preference' });
  test('AC-OP-02 anchors bring the section under the sticky area, also when the header snaps during the scroll', async ({ page }) => {
    await open(page, poPath());
    const sectionTop = async (id: string) =>
      page.locator(`[data-sk-section="${id}"]`).evaluate((el) => el.getBoundingClientRect().top - document.querySelector('.sk-dynamic-page__navigation')!.getBoundingClientRect().bottom);
    for (const id of ['Items', 'Custom::Timeline', 'GeneralInformation']) {
      await page.locator(`[data-sk-anchor="${id}"]`).click();
      await expect(page.locator(`[data-sk-anchor="${id}"]`)).toHaveAttribute('aria-current', 'true');
      await expect.poll(() => sectionTop(id), { timeout: 3000 }).toBeLessThan(40);
      await expect.poll(() => sectionTop(id), { timeout: 3000 }).toBeGreaterThan(-4);
    }
    // the header buttons sit centred on the line between header and anchor bar
    const box = await page.locator('.sk-dynamic-page__features-buttons').boundingBox();
    const line = await page.locator('.sk-dynamic-page__features').boundingBox();
    expect(Math.abs(box!.y + box!.height / 2 - line!.y)).toBeLessThan(2);
  });
});

test('AC-OP-03 purchase orders use tab navigation: one section, counts on every tab, the tab bar stays in place', async ({ page }) => {
  await open(page, poPath(PO, '')); // default of the demo: an order has up to 150 items (OP Tables)
  await expect(page.locator('[data-sk-section]')).toHaveCount(1);
  // the count is there before the tab is opened
  await expect(page.locator('[data-sk-anchor="Items"]')).toHaveText('Items (150)');
  const top = await navTop(page);
  for (const id of ['Items', 'NotesSection', 'Custom::Timeline', 'GeneralInformation']) {
    await page.locator(`[data-sk-anchor="${id}"]`).click();
    await expect(page.locator(`[data-sk-section="${id}"]`)).toBeVisible();
    await expect(page.locator('[data-sk-section]')).toHaveCount(1);
    expect(await navTop(page)).toBe(top);
    await expect(page.locator('.sk-object-header')).toBeVisible(); // switching tabs does not collapse the header
  }
});

test('AC-OP-03 switching tabs keeps a collapsed header collapsed; the new tab starts under the tab bar', async ({ page }) => {
  await open(page, poPath(PO, 'tabs'));
  await page.locator('[data-sk-anchor="Items"]').click();
  await expect(page.locator('[data-sk-section="Items"]')).toBeVisible();
  const items = table(page, 'PurchaseOrderItems');
  // the table ends its tab: it loads more rows on scroll (phase 2, OP Tables · Tab Navigation)
  await expect(items.locator('.ag-row[row-index]').first()).toBeVisible();
  await scrollMain(page, 100000);
  await expect.poll(() => items.locator('.ag-row[row-index] [col-id="DataField::PurchaseOrderItem"]').count()).toBeGreaterThan(10);
  await scrollMain(page, 500);
  await expect(page.locator('.sk-dynamic-page__title[data-collapsed]')).toBeVisible();
  await page.locator('[data-sk-anchor="NotesSection"]').click();
  await expect(page.locator('[data-sk-section="NotesSection"]')).toBeVisible();
  await page.waitForTimeout(300);
  await expect(page.locator('.sk-dynamic-page__title[data-collapsed]')).toBeVisible();
  // the tab content starts right under the tab bar (separated only by the content area's top padding)
  const gap = await page.evaluate(() => {
    const content = document.querySelector('.sk-dynamic-page__content')!;
    const pad = parseFloat(getComputedStyle(content).paddingTop);
    return document.querySelector('.sk-object-page__sections')!.getBoundingClientRect().top - document.querySelector('.sk-dynamic-page__navigation')!.getBoundingClientRect().bottom - pad;
  });
  expect(Math.abs(gap)).toBeLessThan(2);
});

test('AC-OP-10 anchors: the first anchor returns to the top and the header expands', async ({ page }) => {
  await open(page, poPath());
  await page.locator('[data-sk-anchor="Items"]').click();
  await expect(page.locator('.sk-dynamic-page__title[data-collapsed]')).toBeVisible();
  await page.locator('[data-sk-anchor="GeneralInformation"]').click();
  await expect.poll(() => main(page).evaluate((el) => el.scrollTop)).toBe(0);
  await expect(page.locator('.sk-dynamic-page__title[data-collapsed]')).toHaveCount(0);
  await expect(page.locator('[data-sk-anchor="GeneralInformation"]')).toHaveAttribute('aria-current', 'true');
});

test('AC-OP-11 header: title click, collapse releases the pin, no pin for a tall header, image enlarges', async ({ page }) => {
  await open(page, poPath());
  const header = page.locator('.sk-object-header');
  // snap on click on the title bar
  const title = (await page.locator('.sk-dynamic-page__title').boundingBox())!;
  await page.mouse.click(title.x + title.width * 0.6, title.y + 16);
  await expect(header).toHaveCount(0);
  await page.mouse.click(title.x + title.width * 0.6, title.y + 16);
  await expect(header).toBeVisible();
  // collapsing overrules the pin and releases it
  await page.locator('[data-sk-header-pin]').click();
  await expect(page.locator('[data-sk-header-pin]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('[data-sk-header-toggle]').click();
  await expect(header).toHaveCount(0);
  await page.locator('[data-sk-header-toggle]').click();
  await expect(page.locator('[data-sk-header-pin]')).toHaveAttribute('aria-pressed', 'false');
  // the image facet enlarges on press
  await page.locator('[data-sk-avatar-enlarge="lg"]').click();
  await expect(page.locator('[data-sk-avatar-large]')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-sk-avatar-large]')).toHaveCount(0);
  // a header taller than 60% of the viewport: no pin
  await page.setViewportSize({ width: 1440, height: 420 });
  await expect(page.locator('[data-sk-header-pin]')).toHaveCount(0);
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.locator('[data-sk-header-pin]')).toHaveCount(1);
  // keyboard: leaving the header for the content collapses it; entering it expands it
  await page.locator('[data-sk-header-pin]').focus();
  await page.keyboard.press('Tab');
  await expect(header).toHaveCount(0);
  await page.keyboard.press('Shift+Tab');
  await expect(header).toBeVisible();
});

test('AC-OP-04 title de-duplication (four cases)', async ({ page }) => {
  await open(page, poPath());
  // ② two subsections: section title + subsection titles
  await expect(page.locator('[data-sk-section="GeneralInformation"] > .sk-section__title')).toBeVisible();
  await expect(page.locator('[data-sk-section="GeneralInformation"] .sk-subsection__title')).toHaveCount(2);
  // ④ one subsection with one table: the table title is the title
  await expect(page.locator('[data-sk-section="Items"] > .sk-section__title')).toHaveCount(0);
  await page.locator('[data-sk-anchor="Items"]').click();
  await expect(page.locator('[data-sk-section="Items"] [data-sk-table-title]')).toHaveText('Items (150)');
  // ① one subsection: its title is promoted
  await expect(page.locator('[data-sk-section="NotesSection"] > .sk-section__title')).toBeVisible();
  await expect(page.locator('[data-sk-section="NotesSection"] .sk-subsection__title')).toHaveCount(0);
  // ③ first subsection is a table: no subsection title, the table carries it; the second keeps its title
  await open(page, itemPath());
  await page.locator('[data-sk-anchor="Pricing"]').click();
  const pricing = page.locator('[data-sk-section="Pricing"]');
  await expect(pricing.locator('> .sk-section__title')).toBeVisible();
  await expect(pricing.locator('[data-sk-subsection="PricingConditions"] .sk-subsection__title')).toHaveCount(0);
  await expect(pricing.locator('[data-sk-subsection="PricingConditions"] [data-sk-table-title]')).toHaveText(/\(\d+\)$/);
  await expect(pricing.locator('[data-sk-subsection="PricingTotals"] .sk-subsection__title')).toBeVisible();
});

test('AC-OP-05 form columns follow the content width; labels on top', async ({ page }) => {
  const columns = async () => {
    // fields hidden by UI.Importance on smaller screens (phase 2) do not count
    const xs = await page.locator('[data-sk-subsection="GeneralData"] .sk-form__field').evaluateAll((els) => els.filter((e) => getComputedStyle(e).display !== 'none').map((e) => Math.round(e.getBoundingClientRect().left)));
    return new Set(xs).size;
  };
  for (const [width, expected] of [[1700, 6], [1250, 4], [850, 3], [500, 1]] as const) {
    await page.setViewportSize({ width, height: 900 });
    await open(page, poPath());
    await expect.poll(columns, { message: `width ${width}` }).toBe(expected);
  }
  const label = await page.locator('.sk-form__label').first().boundingBox();
  const value = await page.locator('.sk-form__value').first().boundingBox();
  expect(label!.y).toBeLessThan(value!.y);
});

test('AC-OP-06 Show More / Show Less', async ({ page }) => {
  await open(page, poPath());
  const notes = page.locator('[data-sk-section="NotesSection"]');
  await expect(notes.locator('.sk-form')).toHaveCount(0);
  await notes.locator('[data-sk-show-more]').click();
  await expect(notes.locator('.sk-form')).toBeVisible();
  await expect(notes.locator('[data-sk-show-more]')).toHaveText('Show Less');
  await notes.locator('[data-sk-show-more]').click();
  await expect(notes.locator('.sk-form')).toHaveCount(0);
});

test('AC-OP-07 sub-table: 10 rows, More adds 20, search, sort, lazy request', async ({ page }) => {
  const rec = recordOData(page);
  await page.setViewportSize({ width: 1440, height: 520 });
  await open(page, poPath());
  await expect(page.locator('.sk-dynamic-page__heading')).toHaveText(PO);
  await page.waitForTimeout(500);
  expect(rec.urls.some((u) => u.includes('/_Item?'))).toBe(false);
  await page.locator('[data-sk-anchor="Items"]').click();
  const items = table(page, 'PurchaseOrderItems');
  await expect(items.locator('.ag-row[row-index]')).toHaveCount(10);
  await items.locator('[data-sk-more]').click();
  await expect(items.locator('.ag-row[row-index]')).toHaveCount(30);
  await expect(items.locator('[data-sk-more]')).toHaveText('More [30/150]');
  await items.getByRole('textbox', { name: 'Search' }).fill('bolt');
  await items.getByRole('textbox', { name: 'Search' }).press('Enter');
  await expect.poll(() => rec.urls.some((u) => u.includes('/_Item?') && u.includes('$search=bolt'))).toBe(true);
  await expect(items.locator('[data-sk-table-title]')).not.toHaveText('Items (150)');
  await items.locator('.ag-header-cell[col-id="DataField::OrderQuantity"] .ag-header-cell-label').click();
  await expect.poll(() => rec.urls.some((u) => u.includes('/_Item?') && u.includes('$orderby=OrderUnit,OrderQuantity'))).toBe(true);
});

test('AC-OP-08 message strips: header and section positions; page-level error', async ({ page }) => {
  const res = await page.request.get(`${PURCHASING}/PurchaseOrders?$filter=StatusCriticality eq 1&$top=1&$select=PurchaseOrder`);
  const overdue = (await res.json()).value[0].PurchaseOrder as string;
  await open(page, poPath(overdue));
  const title = page.locator('.sk-dynamic-page__title');
  await expect(title.locator('[data-demo-header-message]')).toBeVisible();
  const msg = await title.locator('[data-demo-header-message]').boundingBox();
  const header = await page.locator('.sk-object-header').boundingBox();
  const heading = await page.locator('.sk-dynamic-page__heading').boundingBox();
  expect(msg!.y).toBeGreaterThan(heading!.y);
  expect(msg!.y).toBeLessThan(header!.y);
  await scrollMain(page, 600);
  await expect(title.locator('[data-demo-header-message]')).toBeInViewport();
  // section message strip above the section title
  const sec = page.locator('[data-sk-section="Custom::Timeline"]');
  const strip = await sec.locator('[data-demo-section-message]').boundingBox();
  const secTitle = await sec.locator('> .sk-section__title').boundingBox();
  expect(strip!.y).toBeLessThan(secTitle!.y);
  // object that does not exist
  await open(page, poPath('9999999999'));
  await expect(page.locator('[data-sk-object-error]')).toHaveText(/^This .+ does not exist\.$/);
});

test('AC-OP-09 sub-object page with breadcrumbs and two sub-tables', async ({ page }) => {
  await open(page, poPath());
  await page.locator('[data-sk-anchor="Items"]').click();
  await table(page, 'PurchaseOrderItems').locator('[data-sk-row-nav]').first().click();
  await expect(page).toHaveURL(/_Item\(PurchaseOrder%3D%274500000001%27%2CPurchaseOrderItem%3D10\)/);
  await expect(page.locator('[data-sk-breadcrumb]')).toHaveText(PO);
  await expect(page.locator('[data-sk-section="Pricing"]')).toBeVisible();
  await expect(page.locator('[data-sk-anchor="History"]')).toBeVisible();
  await page.locator('[data-sk-breadcrumb]').click();
  await expect(page.locator('.sk-dynamic-page__heading')).toHaveText(PO);
});

test('AC-EXT-03 a custom section after General Information, also in the anchor bar', async ({ page }) => {
  await open(page, poPath());
  const ids = await page.locator('[data-sk-section]').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.skSection));
  expect(ids.slice(0, 3)).toEqual(['GeneralInformation', 'Custom::Timeline', 'Items']);
  await expect(page.locator('[data-sk-anchor="Custom::Timeline"]')).toHaveText('Delivery Timeline');
});

test('AC-OP-12 short pages: every anchor brings its section under the anchor bar (spacer after the last section)', async ({ page }) => {
  await open(page, itemPath());
  await expect(page.locator('[data-sk-anchor="History"]')).toBeVisible();
  const gap = (id: string) => page.evaluate((id) => document.querySelector(`[data-sk-section="${id}"]`)!.getBoundingClientRect().top - document.querySelector('.sk-dynamic-page__navigation')!.getBoundingClientRect().bottom, id);
  for (const id of ['Pricing', 'History']) {
    await page.locator(`[data-sk-anchor="${id}"]`).click();
    await expect(page.locator(`[data-sk-anchor="${id}"]`)).toHaveAttribute('aria-current', 'true');
    await expect.poll(() => gap(id)).toBeLessThan(3);
    await expect.poll(() => gap(id)).toBeGreaterThan(-3);
  }
  await page.locator('[data-sk-anchor="ItemData"]').click();
  await expect.poll(() => main(page).evaluate((el) => el.scrollTop)).toBe(0);
  await expect(page.locator('[data-sk-anchor="ItemData"]')).toHaveAttribute('aria-current', 'true');
});

test('AC-NAV-02 returning from the sub-object page restores the object page state', async ({ page }) => {
  await open(page, poPath());
  await page.locator('[data-sk-anchor="Items"]').click();
  const items = table(page, 'PurchaseOrderItems');
  await items.locator('[data-sk-more]').click();
  await expect(items.locator('.ag-row[row-index]')).toHaveCount(30);
  await items.locator('.ag-header-cell[col-id="DataField::OrderQuantity"] .ag-header-cell-label').click();
  await expect(items.locator('.ag-header-cell[col-id="DataField::OrderQuantity"]')).toHaveAttribute('aria-sort', 'ascending');
  await items.locator('.ag-row[row-index="2"] input[type="checkbox"]').check();
  const third = await items.locator('.ag-row[row-index="2"] [col-id="DataField::PurchaseOrderItem"]').innerText();
  // the section that is current when leaving (scrolling to the buttons above may have changed it)
  const current = await page.locator('[data-sk-anchor][aria-current="true"]').getAttribute('data-sk-anchor');
  expect(current).not.toBe('GeneralInformation');
  await items.locator('.ag-row[row-index="0"] [data-sk-row-nav]').click();
  await expect(page.locator('[data-sk-breadcrumb]')).toBeVisible();
  await page.goBack();
  await expect(page.locator(`[data-sk-anchor="${current}"]`)).toHaveAttribute('aria-current', 'true');
  await expect(items.locator('.ag-row[row-index]')).toHaveCount(30);
  await expect(items.locator('.ag-header-cell[col-id="DataField::OrderQuantity"]')).toHaveAttribute('aria-sort', 'ascending');
  await expect(items.locator('.ag-row[row-index="2"] [col-id="DataField::PurchaseOrderItem"]')).toHaveText(third);
  await expect(items.locator('.ag-row[row-index="2"] input[type="checkbox"]')).toBeChecked();
});

test('AC-NAV-03 object and sub-object links open directly in a new tab', async ({ context }) => {
  for (const url of [poPath(), itemPath(PO, 20)]) {
    const fresh = await context.newPage();
    await open(fresh, url);
    await expect(fresh.locator('.sk-dynamic-page__heading')).toHaveText(url.includes('_Item') ? '20' : PO);
    await fresh.close();
  }
});
