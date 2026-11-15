import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { open, resetServer, table, waitForRows } from './helpers';

const poPath = `/purchasing/object?path=${encodeURIComponent("PurchaseOrders('4500000001')")}`;

test.beforeEach(async ({ page }) => resetServer(page));

async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
}

const COMBOS = [
  { name: 'yellow', theme: 'yellow', density: 'comfortable' },
  { name: 'navy', theme: 'navy', density: 'comfortable' },
  { name: 'dark', theme: 'dark', density: 'comfortable' },
  { name: 'compact', theme: 'yellow', density: 'compact' },
] as const;

for (const c of COMBOS) {
  test(`AC-THEME-01 screenshots: ${c.name}`, async ({ page }) => {
    await open(page, '/po', { theme: c.theme, density: c.density });
    await waitForRows(page, 'PurchaseOrders');
    await settle(page);
    await expect(page).toHaveScreenshot(`list-${c.name}.png`, { fullPage: false });
    await open(page, poPath, { theme: c.theme, density: c.density });
    await expect(page.locator('.sk-facet--kpi .sk-facet__kpi-value')).not.toBeEmpty();
    await settle(page);
    await expect(page).toHaveScreenshot(`object-${c.name}.png`, { fullPage: false });
  });
}

test('AC-THEME-02 switching theme and density at runtime updates Mantine and AG Grid without remounting', async ({ page }) => {
  await open(page, '/po');
  const t = await waitForRows(page, 'PurchaseOrders');
  await t.locator('.ag-root-wrapper').evaluate((el) => ((el as HTMLElement & { __probe?: boolean }).__probe = true));
  const read = () => page.evaluate(() => {
    const grid = document.querySelector('.ag-root-wrapper')!;
    const row = document.querySelector('.ag-row[row-index="0"]')!;
    const btn = document.querySelector('[data-sk-table-settings]')!;
    return { grid: getComputedStyle(grid).backgroundColor, row: row.getBoundingClientRect().height, body: getComputedStyle(document.body).backgroundColor, text: getComputedStyle(btn).color };
  });
  const before = await read();
  await page.locator('[data-demo-theme]').click();
  await page.getByRole('option', { name: 'Dark' }).click();
  await expect.poll(async () => (await read()).grid).not.toBe(before.grid);
  const dark = await read();
  expect(dark.body).not.toBe(before.body);
  await page.locator('[data-demo-density]').click();
  await page.getByRole('option', { name: 'Compact' }).click();
  await expect.poll(async () => (await read()).row).toBeLessThan(before.row);
  expect(await t.locator('.ag-root-wrapper').evaluate((el) => (el as HTMLElement & { __probe?: boolean }).__probe)).toBe(true);
});

for (const [name, path, entitySet] of [['list', '/po', 'PurchaseOrders'], ['object', poPath, undefined]] as const) {
  for (const theme of ['yellow', 'navy', 'dark']) {
    test(`AC-THEME-04 axe: no violations on the ${name} page (${theme})`, async ({ page }) => {
      await open(page, path, { theme });
      if (entitySet) await waitForRows(page, entitySet);
      else await expect(page.locator('.sk-facet--kpi .sk-facet__kpi-value')).not.toBeEmpty();
      await settle(page);
      const result = await new AxeBuilder({ page }).include('#demo-main').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
      const summary = result.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
      expect(summary).toEqual([]);
    });
  }
}

test('AC-I18N-01 English has no Chinese; Chinese has no English library texts', async ({ page }) => {
  const visibleText = () => page.evaluate(() => {
    const clone = document.body.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('[data-demo-lang], script, style').forEach((e) => e.remove());
    return clone.innerText;
  });
  for (const path of ['/po', poPath]) {
    await open(page, path, { lang: 'en' });
    if (path === '/po') await waitForRows(page, 'PurchaseOrders');
    else await expect(page.locator('.sk-facet--kpi .sk-facet__kpi-value')).not.toBeEmpty();
    expect(await visibleText()).not.toMatch(/[一-鿿]/);
  }
  await open(page, '/po', { lang: 'zh' });
  await waitForRows(page, 'PurchaseOrders');
  await page.getByRole('button', { name: '展开页头' }).click();
  const zh = await visibleText();
  for (const english of ['Expand Header', 'Collapse Header', 'Pin Header', 'Adapt Filters', 'Standard', 'Purchase Orders', 'Search', 'Settings']) expect(zh).not.toContain(english);
  expect(zh).toMatch(/采购订单/);
});

test('AC-Q-02 performance: first rows within 2.5 s; scrolling 10,000 rows without long tasks', async ({ page }) => {
  await page.goto('/about?lang=en');
  await page.evaluate(() => {
    (window as unknown as { __long: number[] }).__long = [];
    new PerformanceObserver((l) => l.getEntries().forEach((e) => (window as unknown as { __long: number[] }).__long.push(e.duration))).observe({ type: 'longtask', buffered: false });
  });
  const t0 = Date.now();
  await page.getByRole('link', { name: 'Purchase Orders' }).last().click();
  await waitForRows(page, 'PurchaseOrders');
  expect(Date.now() - t0).toBeLessThan(2500);
  // all 10,000 rows: widen company codes and drop the status filter
  await page.getByRole('button', { name: 'Expand Header' }).click();
  const cc = page.locator('[data-sk-filter="CompanyCode"] input:not([type="hidden"])').first();
  await cc.click();
  for (let i = 0; i < 3; i++) await cc.press('Backspace');
  await cc.fill('1000...4000');
  await cc.press('Enter');
  const st = page.locator('[data-sk-filter="Status"] input:not([type="hidden"])').first();
  await st.click();
  for (let i = 0; i < 3; i++) await st.press('Backspace');
  await page.locator('[data-sk-go]').click();
  await expect(table(page, 'PurchaseOrders').locator('[data-sk-table-title]')).toHaveText('Purchase Orders (10000)');
  await page.getByRole('button', { name: 'Collapse Header' }).click();
  await page.evaluate(() => ((window as unknown as { __long: number[] }).__long = []));
  const viewport = table(page, 'PurchaseOrders').locator('.ag-grid-viewport');
  for (let y = 0; y < 400_000; y += 20_000) {
    await viewport.evaluate((el, top) => el.scrollTo(0, top), y);
    await page.waitForTimeout(120);
  }
  await viewport.evaluate((el) => el.scrollTo(0, el.scrollHeight));
  await expect(table(page, 'PurchaseOrders').locator('.ag-row[row-index="9999"]')).toBeVisible({ timeout: 20_000 });
  const long = await page.evaluate(() => (window as unknown as { __long: number[] }).__long);
  expect(Math.max(0, ...long)).toBeLessThan(200);
});
