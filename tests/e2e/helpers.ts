import { expect, type Page, type Request } from '@playwright/test';

export const MOCK = `http://localhost:${process.env.E2E_MOCK_PORT ?? '4400'}`;
/** The service behind the demo's /odata/purchasing/: the test service, or the PostgreSQL one (playwright.pg.config.ts). */
export const PURCHASING = process.env.E2E_PURCHASING_URL ?? `${MOCK}/odata/purchasing`;
/** True when the PostgreSQL service is in use: it has no supplier contacts entity set (only the test service has it). */
export const ON_PG = process.env.E2E_PURCHASING_URL !== undefined;

/** Resets the test service data (variants, patched rows) before a test; also the PostgreSQL service when it is in use. */
export async function resetServer(page: Page) {
  const res = await page.request.post(`${MOCK}/test/reset`);
  expect(res.ok()).toBeTruthy();
  if (process.env.E2E_EXTRA_RESET) expect((await page.request.post(process.env.E2E_EXTRA_RESET)).ok()).toBeTruthy();
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
  // a loaded row, not the placeholder the infinite row model shows while the first block loads
  await expect(t.locator('.ag-row[row-index]:not(.ag-row-loading):not(.ag-row-pinned) [col-id]:not([col-id="ag-Grid-SelectionColumn"])').first()).not.toBeEmpty();
  return t;
}

export async function titleCount(page: Page, entitySet: string): Promise<number> {
  const text = await table(page, entitySet).locator('[data-sk-table-title]').innerText();
  return Number(text.match(/\((\d+)\)/)?.[1] ?? NaN);
}

/** Cell texts of a column (by col-id) in the visible rows. */
export async function columnTexts(page: Page, entitySet: string, colId: string): Promise<string[]> {
  return table(page, entitySet).locator(`.ag-row[row-index]:not(.ag-row-pinned) [col-id="${colId}"]`).allInnerTexts();
}

/** The visible input of a filter field. */
export const filterInput = (page: Page, path: string) => page.locator(`[data-sk-filter="${path}"] input:not([type="hidden"])`).first();

/** Removes all tokens of a filter field. */
export async function clearFilter(page: Page, path: string) {
  const input = filterInput(page, path);
  await input.click();
  for (let i = 0; i < 6; i++) await input.press('Backspace');
}

/** Expands the header (filter bar) if it is collapsed: "Show Filters" (list report) or "Expand Header". */
export async function showFilters(page: Page) {
  const btn = page.getByRole('button', { name: /^(Show Filters|Expand Header)$/ });
  if (await btn.isVisible()) await btn.click();
  await expect(page.locator('.sk-dynamic-page__header')).toBeVisible();
}

/** Saves a screenshot as evidence for docs/14 when E2E_EVIDENCE=1 (docs/13 "S"). */
export async function evidence(page: Page, id: string, target?: import('@playwright/test').Locator, dir = '14-evidence') {
  if (process.env.E2E_EVIDENCE !== '1') return;
  const path = `docs/${dir}/${id}.png`;
  if (target) await target.screenshot({ path, animations: 'disabled' });
  else await page.screenshot({ path, animations: 'disabled' });
}

/** Object page route of a purchase order (anchor navigation unless `layout` says otherwise). */
export const orderPath = (po: string, o: { layout?: 'anchor' | 'tabs'; service?: string; extra?: string } = {}) =>
  `/${o.service ?? 'purchasing'}/object?path=${encodeURIComponent(o.service === 'purchasing-draft' ? `PurchaseOrders(PurchaseOrder='${po}',IsActiveEntity=true)` : `PurchaseOrders('${po}')`)}&layout=${o.layout ?? 'anchor'}${o.extra ?? ''}`;

export const mainScroll = (page: Page, y: number) => page.locator('#demo-main').evaluate((el, top) => el.scrollTo({ top }), y);
