/**
 * Fiori elements comparison of the analytical table's requests (docs/30 §7.2, AL-10 – AL-12; stage 4 tail "request
 * shape"). FE: apps/fe-reference `?app=purchasing-analytical` (`tableSettings.type: "AnalyticalTable"`); smart-kit:
 * the demo's `/po?table=analytical` (`type="AnalyticalTable"`).
 *
 * FE 1.154 (sap.ui.model.odata.v4.lib._AggregationHelper buildApply, _ConcatHelper, _AggregationCache): the first
 * page reads grand total, count and rows in one `$apply` with `concat`; the following pages are plain list requests
 * (identity); the properties the first page does not deliver are read per rendered row (`PurchaseOrders('…')?$select=
 * …&$expand=…`). Compared: the requests of PurchaseOrders after opening and after an interaction (sort, filter, search,
 * scrolling), the columns and the cell text of the first rows.
 *
 * Normalized here (not differences of this item): the page size inside `$apply` (`top(144)` vs `top(100)`, the
 * registered DV-FE-03 for `$top`), and the number of requests of one shape: FE reads the rows it renders per row and
 * pages of its own size, which depends on the viewport (the key is replaced by `<key>`, identical requests are kept
 * once).
 */
import { expect, test, type Browser, type Page } from '@playwright/test';
import type { NormalizedRequest, Snapshot } from './compare';
import { DEMO, FE, feFilter, MOCK, readFe, readSk, RequestRecorder, skFilter } from './collect';
import { compareScenario } from './harness';

/* eslint-disable @typescript-eslint/no-explicit-any -- the UI5 control tree is untyped here */

interface Scenario {
  name: string;
  /** Adds "search" to Aggregation.ApplySupported/Transformations (FE offers the search of an analytical table only then). */
  searchable?: boolean;
  act?: { fe(page: Page): Promise<void>; sk(page: Page): Promise<void> };
}

/** FE: applies a sort condition through the p13n state of the mdc table (as the sort dialog does). */
const feSort = (key: string, descending: boolean) => async (page: Page) => {
  await page.evaluate(async ([k, d]) => {
    const all: any[] = (window as any).sap.ui.require('sap/ui/core/ElementRegistry').filter(() => true);
    const table = all.find((e) => e.isA('sap.ui.mdc.Table'));
    const StateUtil = await new Promise<any>((r) => (window as any).sap.ui.require(['sap/ui/mdc/p13n/StateUtil'], r));
    // replace the default sort (as a header click in smart-kit does)
    const old = table.getSortConditions()?.sorters ?? [];
    await StateUtil.applyExternalState(table, { sorters: [...old.map((s: any) => ({ key: s.key, sorted: false })), { key: k, descending: d }] });
  }, [key, descending] as const);
};
/** smart-kit: header clicks (ascending, then descending). */
const skSort = (column: string, descending: boolean) => async (page: Page) => {
  const header = page.locator(`[data-sk-table] .ag-header-cell[col-id="${column}"] .ag-header-cell-label`);
  await header.click();
  if (descending) {
    await page.waitForTimeout(300);
    await header.click();
  }
};
/** FE: groups by a property through the p13n state (visual grouping, groupLevels). */
const feGroup = (key: string) => async (page: Page) => {
  await page.evaluate(async (k) => {
    const all: any[] = (window as any).sap.ui.require('sap/ui/core/ElementRegistry').filter(() => true);
    const table = all.find((e) => e.isA('sap.ui.mdc.Table'));
    const StateUtil = await new Promise<any>((r) => (window as any).sap.ui.require(['sap/ui/mdc/p13n/StateUtil'], r));
    await StateUtil.applyExternalState(table, { groupLevels: [{ key: k }] });
  }, key);
};
/** smart-kit: the Group tab of the table settings. */
const skGroup = (label: string) => async (page: Page) => {
  await page.locator('[data-sk-table] [data-sk-table-settings]').click();
  await page.locator('[data-sk-p13n-group-tab]').click();
  await page.locator('[data-sk-p13n-group]').click();
  await page.getByRole('option', { name: label, exact: true }).click();
  await page.locator('[data-sk-p13n-ok]').click();
};
const feScroll = async (page: Page) => {
  await page.evaluate(() => {
    const all: any[] = (window as any).sap.ui.require('sap/ui/core/ElementRegistry').filter(() => true);
    all.find((e) => e.isA('sap.ui.mdc.Table'))._oTable.setFirstVisibleRow(200);
  });
};
const skScroll = async (page: Page) => {
  await page.locator('[data-sk-table] .ag-body-vertical-scroll-viewport').evaluate((el) => el.scrollTo({ top: 200 * 36 }));
};
async function feSearch(page: Page, text: string) {
  const id = await page.evaluate(() => {
    const all: any[] = (window as any).sap.ui.require('sap/ui/core/ElementRegistry').filter(() => true);
    return all.find((e) => e.isA('sap.ui.mdc.FilterBar'))?.getBasicSearchField()?.getId() as string | undefined;
  });
  expect(id, 'FE basic search').toBeTruthy();
  const box = page.locator(`[id="${id}"] input`).first();
  await box.fill(text);
  await box.press('Enter');
}
async function skSearch(page: Page, text: string) {
  const box = page.locator('[data-sk-filter="$search"] input').first();
  await box.fill(text);
  await box.press('Enter');
}

const SCENARIOS: Scenario[] = [
  { name: 'apply-initial' },
  { name: 'apply-sort', act: { fe: feSort('Property::Supplier', false), sk: skSort('DataField::Supplier', false) } },
  { name: 'apply-sort-amount', act: { fe: feSort('Property::NetAmount', false), sk: skSort('DataField::NetAmount', false) } },
  { name: 'apply-filter', act: { fe: (page) => feFilter(page, 'Supplier', '0000100126'), sk: (page) => skFilter(page, 'Supplier', '0000100126') } },
  { name: 'apply-search', searchable: true, act: { fe: (page) => feSearch(page, 'spare'), sk: (page) => skSearch(page, 'spare') } },
  { name: 'apply-paging', act: { fe: feScroll, sk: skScroll } },
  // FE shows the groups collapsed (one $apply with the leaf count, grand total and the groups); smart-kit shows them
  // expanded with all rows: registered (DV-apply-…), requests compared only
  { name: 'apply-grouped', act: { fe: feGroup('Property::Status'), sk: skGroup('Status') } },
];

const SEARCH_TRANSFORMATION = (xml: string) => xml.replace('<String>aggregate</String></Collection>', '<String>aggregate</String><String>search</String></Collection>');

async function searchable(page: Page) {
  // read from the test service directly (see filter4.spec.ts overlay)
  await page.route(/\/odata\/purchasing\/\$metadata/, async (route) => {
    const url = new URL(route.request().url());
    const headers = await route.request().allHeaders();
    const res = await fetch(`${MOCK}${url.pathname}${url.search}`, { headers: { 'accept-language': headers['accept-language'] ?? 'en' } });
    const xml = await res.text();
    const changed = SEARCH_TRANSFORMATION(xml);
    expect(changed).not.toBe(xml);
    await route.fulfill({ status: res.status, contentType: res.headers.get('content-type') ?? 'application/xml', body: changed });
  });
}

/** The requests of the orders: collection requests, and the per-row requests once per shape (see the module comment). */
function normalize(requests: NormalizedRequest[]): NormalizedRequest[] {
  const out: NormalizedRequest[] = [];
  const seen = new Set<string>();
  for (const r of requests) {
    if (!/^PurchaseOrders(\(|$)/.test(r.resource)) continue;
    const options = { ...r.options };
    if (options.$apply) options.$apply = options.$apply.replace(/\btop\(\d+\)/g, 'top(N)');
    const n = { ...r, resource: r.resource.replace(/^PurchaseOrders\(.*\)$/, 'PurchaseOrders(<key>)'), options };
    const id = JSON.stringify(n);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(n);
  }
  return out;
}

async function openFe(page: Page) {
  await page.goto(`${FE}/index.html?app=purchasing-analytical`);
  // the rows and the grand total row (node level 0)
  await page.waitForFunction(() => {
    const all: any[] = (window as any).sap?.ui?.require?.('sap/ui/core/ElementRegistry')?.filter(() => true) ?? [];
    const rows = all.find((e) => e.isA('sap.ui.mdc.Table'))?._oTable?.getRows() ?? [];
    return rows.some((r: any) => r.getBindingContext()?.getProperty('@$ui5.node.level') === 0);
  }, undefined, { timeout: 90_000, polling: 250 });
}

async function openSk(page: Page) {
  await page.goto(`${DEMO}/po?table=analytical&lang=en`);
  await expect(page.locator('[data-sk-table] .ag-row[row-index="0"]:not(.ag-row-pinned):not(.ag-row-loading) [col-id^="DataField::"]').first()).not.toBeEmpty({ timeout: 60_000 });
  const expand = page.getByRole('button', { name: /^(Show Filters|Expand Header)$/ });
  if (await expand.isVisible()) await expand.click();
}

async function snapshot(browser: Browser, s: Scenario, side: 'fe' | 'sk'): Promise<Snapshot> {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    if (s.searchable) await searchable(page);
    expect((await page.request.post(`${MOCK}/test/reset`)).ok()).toBeTruthy();
    const rec = new RequestRecorder(page);
    if (side === 'fe') await openFe(page);
    else await openSk(page);
    await rec.idle(page);
    if (s.act) {
      rec.reset();
      await s.act[side](page);
      await page.waitForTimeout(500);
      await rec.idle(page);
    }
    const requests = normalize(rec.requests);
    if (s.name === 'apply-paging' || s.name === 'apply-grouped') {
      // the rows shown after scrolling, or the groups, are not the first rows: compare requests only
      return { requests, structure: { filterFields: [], columns: [], actions: [], editingStatus: [], viewTabs: [], chartType: '' }, text: [] };
    }
    const { structure, text } = side === 'fe' ? await readFe(page) : await readSk(page);
    return { requests, structure, text };
  } finally {
    await context.close();
  }
}

for (const s of SCENARIOS) {
  test(`AL-10 AL-11 AL-12 FE comparison: ${s.name}`, async ({ browser }) => {
    const fe = await snapshot(browser, s, 'fe');
    const sk = await snapshot(browser, s, 'sk');
    const collection = (x: Snapshot) => x.requests.filter((r) => r.resource === 'PurchaseOrders');
    expect(collection(fe).length, `FE requests: ${JSON.stringify(fe.requests)}`).toBeGreaterThan(0);
    const single = (x: Snapshot) => collection(x).some((r) => /concat\(/.test(r.options.$apply ?? '') && Object.keys(r.options).length === 1);
    if (s.name === 'apply-grouped') {
      expect(collection(fe).some((r) => /UI5__leaves/.test(r.options.$apply ?? ''))).toBe(true);
    } else if (s.name === 'apply-paging') {
      // the following pages: plain list requests
      expect(collection(fe).every((r) => !r.options.$apply)).toBe(true);
      expect(collection(sk).every((r) => !r.options.$apply)).toBe(true);
    } else {
      // the first page: one $apply with concat, nothing else
      expect(single(fe)).toBe(true);
      expect(single(sk)).toBe(true);
    }
    compareScenario(s.name, fe, sk);
  });
}
