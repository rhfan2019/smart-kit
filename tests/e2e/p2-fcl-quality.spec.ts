/** Phase 2 · Flexible column layout (docs/13 §10) and cross-cutting quality (§11). */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { evidence, open, orderPath, resetServer, table, waitForRows } from './helpers';

test.beforeEach(async ({ page }) => resetServer(page));

const col = (page: Page, i: number) => page.locator(`[data-sk-fcl-column="${i}"]`);
const width = (page: Page, i: number) => col(page, i).evaluate((e) => e.getBoundingClientRect().width);

test('P2-FCL-01 P2-FCL-05 P2-DPL-01 list in the first column, object page in the second, sub-object page in the third; each column is a dynamic page', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await open(page, '/fcl');
  await waitForRows(page, 'PurchaseOrders');
  await expect(page.locator('[data-sk-fcl="OneColumn"]')).toBeVisible();
  await table(page, 'PurchaseOrders').locator('[data-sk-row-nav]').first().click();
  await expect(page.locator('[data-sk-fcl="TwoColumnsMidExpanded"]')).toBeVisible();
  await expect(col(page, 1).locator('.sk-dynamic-page__heading')).toHaveText(/^45\d{8}$/);
  // the separators between the columns take a few pixels (S23)
  expect(Math.abs(await width(page, 0) / 1600 * 100 - 33)).toBeLessThan(1.5);
  expect(Math.abs(await width(page, 1) / 1600 * 100 - 67)).toBeLessThan(1.5);
  // items: the item opens in the third column
  await col(page, 1).locator('[data-sk-anchor="Items"]').click();
  await col(page, 1).locator('[data-sk-section="Items"] [data-sk-row-nav]').first().click();
  await expect(page.locator('[data-sk-fcl="ThreeColumnsMidExpanded"]')).toBeVisible();
  expect(await width(page, 1)).toBeGreaterThan(await width(page, 0));
  expect(await width(page, 1)).toBeGreaterThan(await width(page, 2));
  for (const i of [0, 1, 2]) await expect(col(page, i).locator('.sk-dynamic-page').first()).toBeVisible();
  await expect(col(page, 2).locator('.sk-dynamic-page__heading')).toHaveText(/^\d+$/);
  await expect(col(page, 2).locator('[data-sk-microchart="harvey"][role="img"], [data-sk-microchart="harvey"]').first()).not.toContainText('No data');
  // the narrow list column keeps its toolbar inside: actions move into "More"
  await expect(col(page, 0).locator('.sk-table__toolbar [data-sk-action="Create"]')).toHaveCount(0);
  await expect(col(page, 0).locator('.sk-table__toolbar [aria-label="More actions"]')).toBeVisible();
  await evidence(page, 'P2-FCL-01');
  // narrow screens show only the last column
  await page.setViewportSize({ width: 900, height: 900 });
  await expect(col(page, 0)).toBeHidden();
  await expect(col(page, 1)).toBeHidden();
  await expect(col(page, 2)).toBeVisible();
});

test('P2-FCL-03 P2-DPT-03 breadcrumbs only in full screen with one column', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  const order = "PurchaseOrders('4500000001')";
  const item = `${order}/_Item(PurchaseOrder='4500000001',PurchaseOrderItem=10)`;
  await open(page, `/fcl?object=${encodeURIComponent(order)}&sub=${encodeURIComponent(item)}`);
  await expect(col(page, 2).locator('.sk-dynamic-page__heading')).toHaveText('10');
  await expect(col(page, 2).locator('[data-sk-breadcrumb]')).toHaveCount(0);
  await col(page, 2).locator('[data-sk-layout-action="full-screen"]').click();
  await expect(page.locator('[data-sk-fcl="EndColumnFullScreen"]')).toBeVisible();
  await expect(col(page, 2).locator('[data-sk-breadcrumb]')).toHaveText(['4500000001']);
  // outside a flexible column layout the sub-object page always shows them
  await open(page, `/purchasing/object?path=${encodeURIComponent(item)}`);
  await expect(page.locator('[data-sk-breadcrumb]')).toHaveCount(1);
});

test('P2-FCL-04 paging buttons in the layout action area move to the neighbouring list item', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await open(page, '/fcl');
  await waitForRows(page, 'PurchaseOrders');
  const nos = await table(page, 'PurchaseOrders').locator('.ag-row[row-index] [col-id="DataField::PurchaseOrder"]').allInnerTexts();
  await table(page, 'PurchaseOrders').locator('[data-sk-row-nav]').first().click();
  await expect(col(page, 1).locator('.sk-dynamic-page__heading')).toHaveText(nos[0]!);
  const paging = col(page, 1).locator('[data-sk-layout-actions] [data-sk-paging]');
  await expect(paging).toBeVisible();
  // paging buttons come before the full screen and close actions (which stay at the very right)
  const order = await col(page, 1).locator('[data-sk-layout-actions] [data-sk-layout-action]').evaluateAll((els) => els.map((e) => e.getAttribute('data-sk-layout-action')));
  expect(order).toEqual(['previous', 'next', 'full-screen', 'close']);
  await paging.locator('[data-sk-layout-action="next"]').click();
  await expect(col(page, 1).locator('.sk-dynamic-page__heading')).toHaveText(nos[1]!);
  await paging.locator('[data-sk-layout-action="previous"]').click();
  await expect(col(page, 1).locator('.sk-dynamic-page__heading')).toHaveText(nos[0]!);
});

test('P2-GEN-04 the column layout lives in the host URL; the library does not touch the history', async ({ page }) => {
  await open(page, `/fcl?object=${encodeURIComponent("PurchaseOrders('4500000001')")}&layout=MidColumnFullScreen`);
  await expect(page.locator('[data-sk-fcl="MidColumnFullScreen"]')).toBeVisible();
  await col(page, 1).locator('[data-sk-layout-action="exit-full-screen"]').click();
  await expect(page).toHaveURL(/layout=TwoColumnsMidExpanded/);
  await page.goBack();
  await expect(page.locator('[data-sk-fcl="MidColumnFullScreen"]')).toBeVisible();
});

const PAGES: [string, string, string][] = [
  ['responsive list', '/po?table=responsive&views=switch', 'tr[data-sk-row]'],
  ['multiple content', '/po?contents=1&chart=1', '.ag-row[row-index]'],
  ['draft list', '/po-draft?table=responsive', 'tr[data-sk-row]'],
  ['edit', `${orderPath('4500000001')}&edit=1`, '.sk-facet'],
  ['draft object', orderPath('4500000004', { service: 'purchasing-draft' }), '[data-sk-draft-marker]'],
  ['flexible column layout', `/fcl?object=${encodeURIComponent("PurchaseOrders('4500000001')")}`, '[data-sk-fcl-column="1"] .sk-facet'],
];

for (const theme of ['yellow', 'dark']) {
  for (const [name, path, ready] of PAGES) {
    test(`P2-GEN-02 P2-GEN-03 axe: no violations on the ${name} page (${theme})`, async ({ page }) => {
      await open(page, path, { theme });
      await expect(page.locator(ready).first()).toBeVisible();
      if (path.includes('edit=1')) {
        await page.locator('[data-sk-action="Edit"]').click();
        await expect(page.locator('[data-sk-save]')).toBeVisible();
      }
      await page.waitForTimeout(300);
      const result = await new AxeBuilder({ page }).include('#demo-main').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
      const summary = result.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
      expect(summary).toEqual([]);
    });
  }
}

test('P2-GEN-01 new texts in Chinese and English: no texts of the other language', async ({ page }) => {
  const visibleText = () => page.evaluate(() => {
    const clone = document.body.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('[data-demo-lang], script, style, [data-sk-facet-kind="text"], .sk-facet__text').forEach((e) => e.remove());
    return clone.innerText;
  });
  await open(page, orderPath('4500000001'), { lang: 'zh' });
  await expect(page.locator('[data-sk-action="Edit"]')).toBeVisible();
  await page.locator('[data-sk-action="Edit"]').click();
  await expect(page.locator('[data-sk-save]')).toBeVisible();
  const zh = await visibleText();
  for (const english of ['Edit', 'Delete', 'Save', 'Cancel', 'Header', 'Share', 'Show More', 'New ']) expect(zh).not.toMatch(new RegExp(`\\b${english}\\b`));
  expect(zh).toContain('保存');
  await open(page, '/po?table=responsive&views=switch', { lang: 'en' });
  await expect(page.locator('tr[data-sk-row]').first()).toBeVisible();
  expect(await visibleText()).not.toMatch(/[一-鿿]/);
});
