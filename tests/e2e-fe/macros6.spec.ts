/**
 * Fiori elements comparison of stage 6 (macros6): the visual grouping of the analytical table (sap.fe.macros.Table,
 * sap.ui.mdc.Table groupLevels, `$$aggregation.groupLevels`, sap.ui.model.odata.v4.lib._AggregationCache).
 * FE: apps/fe-reference `?app=purchasing-analytical`; smart-kit: the demo's `/po?table=analytical`.
 *
 * - macros6-grouped: grouping by Status reads, in one `$apply`, the number of leaves (`UI5__leaves`), the grand total and
 *   the groups with their subtotals (`groupby((Status),aggregate(…))/concat(aggregate($count as UI5__count),top(n))`);
 *   the groups are collapsed.
 * - macros6-grouped-expand: expanding the first group reads its leaves as a list request with the group's condition first
 *   (`$filter=Status eq 'X' and (…)`, `$count`); the group's header no longer shows the subtotals.
 *
 * Further stage 6 scenarios: tests/e2e-fe/macros6-chart.spec.ts (Chart, FilterBar, Field) and macros6-lr.spec.ts (list
 * report settings, table toolbar, mass edit, row count).
 */
import { expect, test, type Browser, type Page } from '@playwright/test';
import type { NormalizedRequest, Snapshot } from './compare';
import { DEMO, FE, MOCK, RequestRecorder } from './collect';
import { compareScenario } from './harness';

/* eslint-disable @typescript-eslint/no-explicit-any -- the UI5 control tree is untyped here */

const EMPTY = { filterFields: [], columns: [], actions: [], editingStatus: [], viewTabs: [], chartType: '' };

/** The requests of the orders, `top(n)` and `$top` of the viewport normalized (compared by apply-paging). */
function normalize(requests: NormalizedRequest[]): NormalizedRequest[] {
  const out: NormalizedRequest[] = [];
  const seen = new Set<string>();
  for (const r of requests) {
    if (r.resource !== 'PurchaseOrders') continue;
    const options = { ...r.options };
    if (options.$apply) options.$apply = options.$apply.replace(/\btop\(\d+\)/g, 'top(N)');
    if (options.$top) options.$top = 'N';
    const id = JSON.stringify({ ...r, options });
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ ...r, options });
  }
  return out;
}

async function openFe(page: Page) {
  await page.goto(`${FE}/index.html?app=purchasing-analytical`);
  await page.waitForFunction(() => {
    const all: any[] = (window as any).sap?.ui?.require?.('sap/ui/core/ElementRegistry')?.filter(() => true) ?? [];
    const rows = all.find((e) => e.isA('sap.ui.mdc.Table'))?._oTable?.getRows() ?? [];
    return rows.some((r: any) => r.getBindingContext()?.getProperty('@$ui5.node.level') === 0);
  }, undefined, { timeout: 90_000, polling: 250 });
}
async function openSk(page: Page) {
  await page.goto(`${DEMO}/po?table=analytical&lang=en`);
  await expect(page.locator('[data-sk-table] .ag-row[row-index="0"]:not(.ag-row-pinned):not(.ag-row-loading) [col-id^="DataField::"]').first()).not.toBeEmpty({ timeout: 60_000 });
}
const feGroup = async (page: Page) => {
  await page.evaluate(async () => {
    const all: any[] = (window as any).sap.ui.require('sap/ui/core/ElementRegistry').filter(() => true);
    const table = all.find((e) => e.isA('sap.ui.mdc.Table'));
    const StateUtil = await new Promise<any>((r) => (window as any).sap.ui.require(['sap/ui/mdc/p13n/StateUtil'], r));
    await StateUtil.applyExternalState(table, { groupLevels: [{ key: 'Property::Status' }] });
  });
};
const skGroup = async (page: Page) => {
  await page.locator('[data-sk-table] [data-sk-table-settings]').click();
  await page.locator('[data-sk-p13n-group-tab]').click();
  await page.locator('[data-sk-p13n-group]').last().click();
  await page.getByRole('option', { name: 'Status', exact: true }).click();
  await page.locator('[data-sk-p13n-ok]').click();
};
/** FE: the level-1 rows (groups): their status and whether they are expanded. */
const feGroups = (page: Page) => page.evaluate(() => {
  const all: any[] = (window as any).sap.ui.require('sap/ui/core/ElementRegistry').filter(() => true);
  const rows = all.find((e) => e.isA('sap.ui.mdc.Table'))._oTable.getRows().map((r: any) => r.getBindingContext()).filter(Boolean);
  const groups = rows.filter((c: any) => c.getProperty('@$ui5.node.level') === 1 && !c.getProperty('@$ui5.node.isTotal') === false);
  const header = groups.filter((c: any, i: number) => groups.findIndex((x: any) => x.getProperty('Status') === c.getProperty('Status')) === i);
  return { groups: header.map((c: any) => c.getProperty('Status')), expanded: header.filter((c: any) => c.getProperty('@$ui5.node.isExpanded')).map((c: any) => c.getProperty('Status')), leaves: rows.filter((c: any) => c.getProperty('@$ui5.node.level') === 2).length > 0 };
});
const skGroups = (page: Page) => page.evaluate(() => {
  const heads = [...document.querySelectorAll('[data-sk-table] [data-sk-group-row]')];
  const leaves = [...document.querySelectorAll('[data-sk-table] .ag-row:not(.sk-table__group-row):not(.ag-row-pinned):not(.ag-row-loading)')];
  return {
    // the status codes, as FE's group contexts hold them (the label shows the text)
    groups: heads.map((h) => h.closest('.ag-row')?.getAttribute('row-id')?.replace(/^\$smartKitGroup:/, '') ?? ''),
    expanded: heads.filter((h) => h.getAttribute('data-sk-group-expanded') === 'true').map((h) => h.closest('.ag-row')?.getAttribute('row-id')?.replace(/^\$smartKitGroup:/, '') ?? ''),
    leaves: leaves.length > 0,
  };
});
const feExpandFirst = (page: Page) => page.evaluate(() => {
  const all: any[] = (window as any).sap.ui.require('sap/ui/core/ElementRegistry').filter(() => true);
  const row = all.find((e) => e.isA('sap.ui.mdc.Table'))._oTable.getRows().find((r: any) => r.getBindingContext()?.getProperty('@$ui5.node.level') === 1);
  row.getBindingContext().expand();
});
const skExpandFirst = async (page: Page) => { await page.locator('[data-sk-table] [data-sk-group-toggle]').first().click(); };

interface Scenario { name: string; expand: boolean; feExtra: (x: { groups: string[]; expanded: string[]; leaves: boolean }) => void }
const SCENARIOS: Scenario[] = [
  { name: 'macros6-grouped', expand: false, feExtra: (x) => { expect(x.groups.length).toBeGreaterThan(1); expect(x.expanded).toEqual([]); expect(x.leaves).toBe(false); } },
  { name: 'macros6-grouped-expand', expand: true, feExtra: (x) => { expect(x.expanded).toEqual([x.groups[0]]); expect(x.leaves).toBe(true); } },
];

async function snapshot(browser: Browser, s: Scenario, side: 'fe' | 'sk'): Promise<{ snap: Snapshot; extra: { groups: string[]; expanded: string[]; leaves: boolean } }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    expect((await page.request.post(`${MOCK}/test/reset`)).ok()).toBeTruthy();
    const rec = new RequestRecorder(page);
    if (side === 'fe') await openFe(page);
    else await openSk(page);
    await rec.idle(page);
    await (side === 'fe' ? feGroup(page) : skGroup(page));
    await page.waitForTimeout(500);
    await rec.idle(page);
    if (s.expand) {
      rec.reset();
      await (side === 'fe' ? feExpandFirst(page) : skExpandFirst(page));
      await page.waitForTimeout(500);
      await rec.idle(page);
    }
    const extra = await (side === 'fe' ? feGroups(page) : skGroups(page));
    return { snap: { requests: normalize(rec.requests), structure: EMPTY, text: [] }, extra };
  } finally {
    await context.close();
  }
}

for (const s of SCENARIOS) {
  test(`AL-10 AL-11 FE comparison: ${s.name}`, async ({ browser }) => {
    const fe = await snapshot(browser, s, 'fe');
    const sk = await snapshot(browser, s, 'sk');
    s.feExtra(fe.extra);
    if (!s.expand) expect(fe.snap.requests.some((r) => /UI5__leaves/.test(r.options.$apply ?? ''))).toBe(true);
    compareScenario(s.name, fe.snap, sk.snap);
    expect(sk.extra, `${s.name}: groups and expansion`).toEqual(fe.extra);
  });
}
