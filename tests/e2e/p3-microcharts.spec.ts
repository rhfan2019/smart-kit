/** Phase 3 · micro charts (docs/15-research-micro-chart.md) in the real pages: header facets and table cells. */
import { expect, test } from '@playwright/test';
import { open, orderPath, recordOData, resetServer, waitForRows } from './helpers';

test.beforeEach(async ({ page }) => resetServer(page));

const shot = async (target: import('@playwright/test').Locator, id: string) => {
  if (process.env.E2E_EVIDENCE === '1') await target.screenshot({ path: `docs/16-evidence/${id}.png`, animations: 'disabled' });
};

test('MC-10 MC-02 MC-03 a bullet micro chart in a table cell fills the cell and keeps within the size limits', async ({ page }) => {
  await open(page, '/po');
  const t = await waitForRows(page, 'PurchaseOrders');
  // the column is the last one: scroll it into the grid's rendered range (column virtualisation)
  await t.locator('.ag-body-horizontal-scroll-viewport').evaluate((el) => { el.scrollLeft = el.scrollWidth; });
  const cell = t.locator('.ag-row[row-index="0"] [col-id="DataFieldForAnnotation::UI.Chart#BudgetBullet"]');
  const chart = cell.locator('[data-sk-microchart="bullet"]');
  await expect(chart).toBeVisible();
  await expect(chart).toHaveAccessibleName(/^.+: Actual .+, Target .+, Thresholds .+$/);
  const box = (await chart.boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(18);
  expect(box.height).toBeLessThan(56);
  expect(box.width).toBeLessThanOrEqual(320);
  // MC-27: a cell is lower than 56 px, so the bullet shows no labels
  await expect(chart.locator('.sk-microchart__lane').first()).toHaveCount(0);
  await shot(t, 'MC-10');
});

test('MC-02 MC-27 header facet: the chart fills the facet; MC-24 the item shows a delta bullet; MC-55 Harvey Ball total', async ({ page }) => {
  await open(page, orderPath('4500000001'));
  const bullet = page.locator('[data-sk-facet="HeaderBudget"] [data-sk-microchart="bullet"]');
  await expect(bullet).toBeVisible();
  // the facet re-renders when its data arrives: read the box once it is stable (boundingBox() is null while detached)
  await expect.poll(async () => (await bullet.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(56);
  await expect(bullet.locator('.sk-microchart__lane').first()).toBeVisible();
  await shot(page.locator('.sk-object-header'), 'MC-02-order');
  await open(page, `/purchasing/object?path=${encodeURIComponent("PurchaseOrders('4500000001')/_Item(PurchaseOrder='4500000001',PurchaseOrderItem=10)")}`);
  await expect(page.locator('[data-sk-facet="ItemDelta"] [data-sk-microchart="bullet"]')).toHaveAccessibleName(/Difference/);
  await expect(page.locator('[data-sk-facet="ItemHarvey"] [data-sk-microchart="harvey"]')).toHaveAccessibleName(/: [\d.,]+ of [\d.,]+$/);
  await shot(page.locator('.sk-object-header'), 'MC-24-item');
});

test('MC-08 micro chart colours follow the theme', async ({ page }) => {
  const colour = async (theme: string) => {
    await open(page, orderPath('4500000001'), { theme });
    return page.locator('[data-sk-facet="HeaderBudget"] [data-sk-microchart-bar="value"]').evaluate((el) => getComputedStyle(el).fill);
  };
  expect(await colour('yellow')).not.toBe(await colour('dark'));
});

const itemPath = `/purchasing/object?path=${encodeURIComponent("PurchaseOrders('4500000001')/_Item(PurchaseOrder='4500000001',PurchaseOrderItem=10)")}`;

test('MC-35 MC-45 MC-58 MC-41 series charts in the item header: line, area, stacked bar, comparison, column', async ({ page }) => {
  await open(page, itemPath);
  const facet = (id: string) => page.locator(`[data-sk-facet="${id}"]`);
  await expect(facet('ItemHistoryLine').locator('[data-sk-microchart="line"] polyline')).toHaveCount(1);
  await expect(facet('ItemHistoryLine').locator('.sk-microchart__edges--bottom')).toBeVisible();
  const area = facet('ItemHistoryArea').locator('[data-sk-microchart="area"]');
  await expect(area.locator('[data-sk-microchart-bar="actual"]')).toHaveCount(1);
  await expect(area.locator('[data-sk-microchart-bar="target"]')).toHaveCount(1);
  await expect(area.locator('polygon')).not.toHaveCount(0);
  const stacked = facet('ItemConditionShare').locator('[data-sk-microchart="stackedBar"]');
  await expect(stacked).toHaveAccessibleName(/%\)/);
  await expect(facet('ItemConditions').locator('[data-sk-microchart="comparison"] .sk-microchart__row')).not.toHaveCount(0);
  await expect(facet('ItemPricingColumn').locator('[data-sk-microchart="column"] .sk-microchart__edges--top')).toBeVisible();
  await shot(page.locator('.sk-object-header'), 'MC-series-item');
});

test('MC-10 ADR-025 a line chart over a collection in a table cell, read with $expand($select;$orderby;$top)', async ({ page }) => {
  const rec = recordOData(page);
  await open(page, orderPath('4500000001'));
  await page.locator('[data-sk-anchor="Items"]').click();
  const t = await waitForRows(page, 'PurchaseOrderItems');
  await t.locator('.ag-body-horizontal-scroll-viewport').evaluate((el) => { el.scrollLeft = el.scrollWidth; });
  await expect(t.locator('[col-id="DataFieldForAnnotation::_History::UI.Chart#Quantities"] [data-sk-microchart="line"]').first()).toBeVisible();
  expect(rec.urls.some((u) => /\/_Item\?.*\$expand=.*_History\(\$select=[^;)]*Quantity[^;)]*;\$orderby=HistoryCounter;\$top=100\)/.test(u))).toBe(true);
  await shot(t, 'MC-10-series');
});

test('MC-01 scenario page: each of the nine charts in the situation the guidelines name, at the size of its place', async ({ page }) => {
  await open(page, '/microcharts', { lang: 'en' });
  const kinds = { 'bullet-revenue': 'bullet', 'bullet-cost': 'bullet', 'radial-ontime': 'radial', 'harvey-received': 'harvey', 'harvey-contract': 'harvey', 'column-margin': 'column', 'line-price': 'line', 'area-cash': 'area', 'comparison-suppliers': 'comparison', 'stacked-status': 'stackedBar', 'delta-quarter': 'delta' };
  for (const [id, kind] of Object.entries(kinds)) {
    const chart = page.locator(`[data-demo-scenario="${id}"] [data-sk-microchart="${kind}"]`);
    await expect(chart, id).toBeVisible();
    await expect(chart, id).toHaveAccessibleName(/.+: .+/);
    const box = (await chart.boundingBox())!;
    // MC-03: between 64 × 18 and 320 × 94
    expect(box.width, id).toBeLessThanOrEqual(320.5);
    expect(box.height, id).toBeLessThanOrEqual(94.5);
  }
  // MC-05: no value in a header facet shows the placeholder
  await expect(page.locator('[data-demo-scenario="empty-supplier"]')).toContainText('No data');
  // MC-24: the cost variance is a delta bullet; MC-45: area with actual and target
  await expect(page.locator('[data-demo-scenario="bullet-cost"] [data-sk-microchart="bullet"]')).toHaveAccessibleName(/Difference/);
  await expect(page.locator('[data-demo-scenario="area-cash"] [data-sk-microchart-bar="target"]')).toHaveCount(1);
  // MC-06: table cells without data stay empty; MC-27: no labels in cells
  const table = page.locator('[data-demo-supplier-table]');
  const last = table.locator('tbody tr').last();
  await expect(last.locator('[data-sk-microchart]')).toHaveCount(1);
  await expect(table.locator('.sk-microchart__lane')).toHaveCount(0);
  if (process.env.E2E_EVIDENCE === '1') {
    // the page scrolls inside the shell's main area: let it grow so the screenshot shows every case
    await page.locator('#demo-main').evaluate((el) => { el.style.overflow = 'visible'; el.style.height = 'auto'; document.querySelector<HTMLElement>('.demo')!.style.height = 'auto'; });
    await shot(page.locator('[data-demo-microcharts]'), 'MC-scenarios');
  }
});

test('MC-02 AC-OP-12 header chart facets keep their size while their series loads, so anchor navigation lands under the anchor bar', async ({ page }) => {
  // slow series requests: the facets' data arrives after the anchor click (as on a slow CI runner)
  await page.route(/_History|_Condition/, async (r) => { await new Promise((f) => setTimeout(f, 2000)); await r.continue(); });
  await open(page, itemPath);
  await expect(page.locator('[data-sk-anchor="History"]')).toBeVisible();
  const header = () => page.locator('.sk-object-header').evaluate((el) => (el as HTMLElement).offsetHeight);
  const before = await header();
  await page.locator('[data-sk-anchor="Pricing"]').click();
  await expect(page.locator('[data-sk-facet="ItemHistoryLine"] [data-sk-facet-footer]')).toBeAttached({ timeout: 10_000 });
  expect(await header()).toBe(before);
  const gap = () => page.evaluate(() => document.querySelector('[data-sk-section="Pricing"]')!.getBoundingClientRect().top - document.querySelector('.sk-dynamic-page__navigation')!.getBoundingClientRect().bottom);
  await expect.poll(gap).toBeLessThan(3);
  await expect.poll(gap).toBeGreaterThan(-3);
});
