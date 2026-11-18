/**
 * Fiori elements comparison of table totals (docs/30 §7.2, AL-10 – AL-12; D39: totals only in the analytical table,
 * only for custom aggregates). FE: apps/fe-reference `?app=purchasing-analytical` (`tableSettings.type:
 * "AnalyticalTable"`); smart-kit: the demo's `/po?table=analytical` (`tableType="AnalyticalTable"`).
 * Compared: the collection requests of PurchaseOrders (both: one $apply with rows, grand total and count — the page
 * size inside it, `top(n)`, is the registered DV-FE-03 and normalized; both: the per-currency request of "Show
 * Details"; the request shape itself is compared in apply.spec.ts), the columns with a total
 * (`structure.columns`), the personalization panels (`structure.actions`: Column, Sort, Group, Aggregate), the text of
 * the totals row (several currencies: "Show Details") and the lines of its details popover (`text` rows 1 and 2).
 */
import { expect, test, type Browser, type Page } from '@playwright/test';
import type { NormalizedRequest, Snapshot, Structure, TextRows } from './compare';
import { DEMO, FE, MOCK, RequestRecorder } from './collect';
import { compareScenario } from './harness';

const SCENARIO = 'po-analytical-totals';

const structure = (s: Partial<Structure>): Structure => ({ filterFields: [], columns: [], actions: [], editingStatus: [], viewTabs: [], chartType: '', ...s });
/** Only the collection requests of the list (the row-by-row requests are not about totals); page size normalized. */
const collection = (requests: NormalizedRequest[]) => requests.filter((r) => r.resource === 'PurchaseOrders')
  .map((r) => (r.options.$apply ? { ...r, options: { ...r.options, $apply: r.options.$apply.replace(/\btop\(\d+\)/g, 'top(N)') } } : r));

// ---------------------------------------------------------------------------------------------- FE

async function openFe(page: Page) {
  await page.goto(`${FE}/index.html?app=purchasing-analytical`);
  // rows and the grand total row (node level 0) are there
  await page.waitForFunction(
    () => {
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any -- the UI5 control tree is untyped here */
      const all: any[] = (window as any).sap?.ui?.require?.('sap/ui/core/ElementRegistry')?.filter(() => true) ?? [];
      const rows = all.find((e) => e.isA('sap.ui.mdc.Table'))?._oTable?.getRows() ?? [];
      return rows.some((r: { getBindingContext(): { getProperty(p: string): unknown } | null }) => r.getBindingContext()?.getProperty('@$ui5.node.level') === 0);
    },
    undefined,
    { timeout: 90_000, polling: 250 },
  );
}

async function readFe(page: Page): Promise<{ structure: Structure; text: TextRows }> {
  const r = await page.evaluate(() => {
    /* eslint-disable @typescript-eslint/no-explicit-any -- the UI5 control tree is untyped here */
    const all: any[] = (window as any).sap.ui.require('sap/ui/core/ElementRegistry').filter(() => true);
    const table = all.find((e) => e.isA('sap.ui.mdc.Table'));
    const columns: any[] = table.getColumns();
    // aggregate condition keys are property infos ("Property::NetAmount"), columns "DataField::NetAmount"
    const name = (key: string) => key.split('::').pop();
    const headerOf = (key: string) => String(columns.find((c) => name(c.getPropertyKey()) === name(key))?.getHeader() ?? key);
    const totalled = Object.keys(table.getAggregateConditions() ?? {}).map((k) => headerOf(k));
    const total = table._oTable.getRows().find((row: any) => row.getBindingContext()?.getProperty('@$ui5.node.level') === 0);
    const text: Record<string, string> = {};
    const links: Record<string, string> = {};
    total?.getCells().forEach((cell: any, i: number) => {
      const h = String(columns[i]?.getHeader() ?? '');
      if (!totalled.includes(h)) return;
      text[h] = (cell.getDomRef()?.innerText ?? '').replace(/\s+/g, ' ').trim();
      const link = cell.getDomRef()?.querySelector('a.sapMLnk');
      if (link) links[h] = link.id;
    });
    return { totalled, p13n: table.getP13nMode() as string[], text, links };
    /* eslint-enable @typescript-eslint/no-explicit-any */
  });
  // "Show Details" (several currencies): the popover lists the amount per currency (sap.m.table.Util multi-unit popover)
  const details: Record<string, string> = {};
  for (const [h, id] of Object.entries(r.links)) {
    await page.locator(`[id="${id}"]`).click();
    const list = page.locator('[id$="-multiUnitPopover-detailsList"]');
    const item = list.locator('.sapMLIB:not(.sapMListNoData)');
    await expect(item.first()).toBeVisible({ timeout: 30_000 });
    const title = await page.evaluate(() => {
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any -- the UI5 control tree is untyped here */
      const all: any[] = (window as any).sap.ui.require('sap/ui/core/ElementRegistry').filter(() => true);
      return String(all.find((e) => e.isA('sap.m.ResponsivePopover') && e.getId().endsWith('-multiUnitPopover'))?.getTitle() ?? '');
    });
    const items = (await item.allInnerTexts()).map((x) => x.replace(/\s+/g, ' ').trim());
    details[h] = [title, ...items].join(' | ');
    await page.keyboard.press('Escape');
  }
  return { structure: structure({ columns: r.totalled, actions: [...r.p13n].sort() }), text: [r.text, details] };
}

// ---------------------------------------------------------------------------------------------- smart-kit

async function openSk(page: Page) {
  await page.goto(`${DEMO}/po?table=analytical&lang=en`);
  await expect(page.locator('[data-sk-table] .sk-table__total-row [data-sk-total]').first()).not.toBeEmpty({ timeout: 60_000 });
}

async function readSk(page: Page): Promise<{ structure: Structure; text: TextRows }> {
  const table = page.locator('[data-sk-table="PurchaseOrders"]');
  const cells = table.locator('.sk-table__total-row [data-sk-total]');
  const text: Record<string, string> = {};
  const details: Record<string, string> = {};
  const totalled: string[] = [];
  for (const cell of await cells.all()) {
    const colId = await cell.evaluate((el) => el.closest('[col-id]')?.getAttribute('col-id') ?? '');
    const header = (await table.locator(`.ag-header-cell[col-id="${colId}"] .ag-header-cell-text`).innerText()).trim();
    totalled.push(header);
    text[header] = (await cell.innerText()).replace(/\s+/g, ' ').trim();
    const link = cell.locator('[data-sk-total-details]');
    if (await link.count()) {
      await link.click();
      const popover = page.locator('[data-sk-total-units]');
      await expect(popover.locator('[data-sk-total-unit-line]').first()).toBeVisible();
      const title = (await popover.locator('p').first().innerText()).trim();
      const items = (await popover.locator('[data-sk-total-unit-line]').allInnerTexts()).map((x) => x.replace(/\s+/g, ' ').trim());
      details[header] = [title, ...items].join(' | ');
      await page.keyboard.press('Escape');
      await expect(popover).toHaveCount(0);
    }
  }
  // personalization panels (sap.ui.mdc p13n modes)
  await table.locator('[data-sk-table-settings]').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const p13n = ['Column', 'Sort'];
  if (await dialog.locator('[data-sk-p13n-group-tab]').count()) p13n.push('Group');
  if (await dialog.locator('[data-sk-p13n-totals-tab]').count()) p13n.push('Aggregate');
  await page.keyboard.press('Escape');
  return { structure: structure({ columns: totalled, actions: p13n.sort() }), text: [text, details] };
}

async function snapshot(browser: Browser, side: 'fe' | 'sk'): Promise<Snapshot> {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    expect((await page.request.post(`${MOCK}/test/reset`)).ok()).toBeTruthy();
    const rec = new RequestRecorder(page);
    if (side === 'fe') await openFe(page);
    else await openSk(page);
    await rec.idle(page);
    const { structure: s, text } = side === 'fe' ? await readFe(page) : await readSk(page);
    await rec.idle(page);
    return { requests: collection(rec.requests), structure: s, text };
  } finally {
    await context.close();
  }
}

test(`AL-10 AL-11 AL-12 FE comparison: ${SCENARIO}`, async ({ browser }) => {
  const fe = await snapshot(browser, 'fe');
  const sk = await snapshot(browser, 'sk');
  // both total the custom aggregate NetAmount (UI.PresentationVariant/Total) and offer the Aggregate panel
  expect(fe.structure.columns).toEqual(['Net Amount']);
  expect(sk.structure.columns).toEqual(['Net Amount']);
  expect(sk.structure.actions).toEqual(fe.structure.actions);
  // FE requests the custom aggregate by name, with the currency as unit; smart-kit by name, grouped by the currency
  expect(fe.requests.some((r) => /aggregate\(NetAmount,Currency\)/.test(r.options.$apply ?? ''))).toBe(true);
  expect(sk.requests.some((r) => /aggregate\(NetAmount,Currency\)/.test(r.options.$apply ?? ''))).toBe(true);
  // several currencies: "Show Details" in both
  expect(fe.text[0]).toEqual({ 'Net Amount': 'Show Details' });
  expect(sk.text[0]).toEqual({ 'Net Amount': 'Show Details' });
  compareScenario(SCENARIO, fe, sk);
});
