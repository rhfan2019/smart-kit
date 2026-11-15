import { expect, type Page, type Request } from '@playwright/test';

export const MOCK = 'http://localhost:4400';

/** Resets the test service data (variants, patched rows) before a test. */
export async function resetServer(page: Page) {
  const res = await page.request.post(`${MOCK}/test/reset`);
  expect(res.ok()).toBeTruthy();
}

/** Opens a demo route with language, theme and density. */
export async function open(page: Page, path: string, o: { lang?: 'zh' | 'en'; theme?: string; density?: string } = {}) {
  const q = new URLSearchParams({ lang: o.lang ?? 'en', theme: o.theme ?? 'yellow', density: o.density ?? 'comfortable' });
  await page.goto(`${path}${path.includes('?') ? '&' : '?'}${q}`);
  await expect(page.locator('#demo-main')).toBeVisible();
}

/** Records OData data requests (not $metadata). */
export function recordOData(page: Page): { urls: string[]; requests: Request[] } {
  const rec = { urls: [] as string[], requests: [] as Request[] };
  page.on('request', (r) => {
    const u = r.url();
    if (u.includes('/odata/') && !u.includes('$metadata')) {
      rec.urls.push(decodeURIComponent(u.replace(/^https?:\/\/[^/]+/, '')));
      rec.requests.push(r);
    }
  });
  return rec;
}

export const table = (page: Page, entitySet: string) => page.locator(`[data-sk-table="${entitySet}"]`);

/** Waits until a grid shows data rows and returns the title text. */
export async function waitForRows(page: Page, entitySet: string) {
  const t = table(page, entitySet);
  await expect(t.locator('.ag-row[row-index]').first()).toBeVisible();
  return t;
}

export async function titleCount(page: Page, entitySet: string): Promise<number> {
  const text = await table(page, entitySet).locator('[data-sk-table-title]').innerText();
  return Number(text.match(/\((\d+)\)/)?.[1] ?? NaN);
}

/** Cell texts of a column (by col-id) in the visible rows. */
export async function columnTexts(page: Page, entitySet: string, colId: string): Promise<string[]> {
  return table(page, entitySet).locator(`.ag-row[row-index] [col-id="${colId}"]`).allInnerTexts();
}

/** The visible input of a filter field. */
export const filterInput = (page: Page, path: string) => page.locator(`[data-sk-filter="${path}"] input:not([type="hidden"])`).first();

/** Removes all tokens of a filter field. */
export async function clearFilter(page: Page, path: string) {
  const input = filterInput(page, path);
  await input.click();
  for (let i = 0; i < 6; i++) await input.press('Backspace');
}

/** Expands the filter bar if it is collapsed. */
export async function showFilters(page: Page) {
  const btn = page.getByRole('button', { name: 'Show Filters' });
  if (await btn.isVisible()) await btn.click();
  await expect(page.locator('.sk-dynamic-page__header')).toBeVisible();
}
