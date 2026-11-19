/**
 * Fiori elements comparison of stage 5, the list report settings (docs/26c, docs/30 §5.3, §7.2, AL-13 F): the same
 * manifest setting on both sides — FE: apps/fe-reference with the setting laid over the app's `manifest.json` in the
 * browser (`page.route`, as views4.spec.ts); smart-kit: the demo's `/po` / `/po-draft`, whose settings are the very
 * settings object of that manifest (apps/demo/src/feListReport.ts) changed by the same value through a query
 * parameter (apps/demo/src/pages/PurchaseOrdersPage.tsx).
 *
 * - lr5-views-counts: `views.paths` (three SelectionPresentationVariants) with `showCounts`: the tabs, the counts and
 *   the `/$count` requests.
 * - lr5-initial-auto / -disabled: `initialLoad` "Auto" (the default SV has values: loads) and "Disabled" (waits for Go).
 * - lr5-vm-none: `variantManagement` "None": no variant management, no variant request.
 * - lr5-table-default: no `tableSettings.type`: the responsive table (FE getTableType) with 30 rows per request.
 * - lr5-threshold: `tableSettings.threshold` 50 on the grid table.
 * - lr5-export-off: `tableSettings.enableExport` false.
 * - lr5-selection-single: `tableSettings.selectionMode` "Single".
 * - lr5-draft-newpage: `creationMode` NewPage (default) on the draft list: Create opens a new draft on the object page.
 * - lr5-creation-dialog: `creationMode.name` "CreationDialog" on the draft list: Create opens a dialog.
 */
import { expect, test, type Browser, type Page } from '@playwright/test';
import type { Snapshot, Structure } from './compare';
import { DEMO, FE, MOCK, readFe, readSk, RequestRecorder } from './collect';
import { compareScenario } from './harness';

type FeApp = 'purchasing' | 'purchasing-views' | 'purchasing-draft';
type Settings = Record<string, unknown>;
type TableSettings = Record<string, unknown>;

interface Scenario {
  name: string;
  fe: FeApp;
  /** Change of the FE manifest's list report settings (the same as the demo's query parameter). */
  manifest?(s: Settings, table: TableSettings): void;
  sk: string;
  /** The list loads on start (else the comparison waits until the page is idle). */
  loads: boolean;
  /** Grid table (structure and text are read); otherwise only the requests and the checks of `extra` are compared. */
  grid: boolean;
  /** Further checks on both sides after the comparison snapshot (same answer expected). */
  extra?: { fe(page: Page): Promise<unknown>; sk(page: Page): Promise<unknown> };
}

const LIST = 'PurchaseOrdersList';
const LINE_ITEM = '@com.sap.vocabularies.UI.v1.LineItem';
/* eslint-disable @typescript-eslint/no-explicit-any -- the UI5 control tree is untyped here */
const feControls = (page: Page, type: string) => page.evaluate((t) => ((window as any).sap?.ui?.require?.('sap/ui/core/ElementRegistry')?.filter((e: any) => e.isA(t)) ?? []).length, type);

async function overlay(page: Page, app: FeApp, change: Scenario['manifest']) {
  if (!change) return;
  await page.route(new RegExp(`/${app}/manifest\\.json`), async (route) => {
    const res = await fetch(route.request().url());
    const m = await res.json() as { 'sap.ui5': { routing: { targets: Record<string, { options: { settings: Settings } }> } } };
    const s = m['sap.ui5'].routing.targets[LIST]!.options.settings;
    const cc = (s.controlConfiguration ??= {}) as Record<string, { tableSettings?: TableSettings }>;
    const table = ((cc[LINE_ITEM] ??= {}).tableSettings ??= {});
    change(s, table);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(m) });
  });
}

async function openFe(page: Page, s: Scenario) {
  await overlay(page, s.fe, s.manifest);
  await page.goto(`${FE}/index.html?app=${s.fe}`);
  await page.waitForFunction(
    (loads) => {
      const R = (window as any).sap?.ui?.require?.('sap/ui/core/ElementRegistry');
      if (!R) return false;
      if (!loads) return R.filter((e: any) => e.isA('sap.ui.mdc.FilterBar') && e.getDomRef()).length > 0;
      return R.filter((e: any) => e.isA('sap.ui.mdc.Table') && e.getDomRef()).some((t: any) => (t.getRowBinding?.()?.getCurrentContexts?.() ?? []).some(Boolean));
    },
    s.loads,
    { timeout: 90_000, polling: 250 },
  );
}

async function openSk(page: Page, s: Scenario) {
  await page.goto(`${DEMO}${s.sk}${s.sk.includes('?') ? '&' : '?'}lang=en`);
  if (s.loads) await expect(page.locator('[data-sk-table] .ag-row[row-index="0"]:not(.ag-row-loading), [data-sk-table] tr[data-sk-row]').first()).toBeVisible({ timeout: 60_000 });
  else await expect(page.locator('[data-sk-filter]').first()).toBeVisible({ timeout: 60_000 });
  if (s.grid) {
    const expand = page.getByRole('button', { name: /^(Show Filters|Expand Header)$/ });
    if (await expand.isVisible()) await expand.click();
    await expect(page.locator('[data-sk-filter]').first()).toBeVisible();
  }
}

const empty: Structure = { filterFields: [], columns: [], actions: [], editingStatus: [], viewTabs: [], chartType: '' };

async function snapshot(browser: Browser, s: Scenario, side: 'fe' | 'sk'): Promise<{ snap: Snapshot; extra: unknown }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    expect((await page.request.post(`${MOCK}/test/reset`)).ok()).toBeTruthy();
    const rec = new RequestRecorder(page);
    if (side === 'fe') await openFe(page, s);
    else await openSk(page, s);
    await rec.idle(page);
    const read = s.grid ? await (side === 'fe' ? readFe(page) : readSk(page)) : { structure: empty, text: [] };
    const extra = s.extra ? await s.extra[side](page) : undefined;
    return { snap: { requests: rec.requests, ...read }, extra };
  } finally {
    await context.close();
  }
}

// ---------------------------------------------------------------------------------------------- extra checks

/** FE view tabs: text and count of each IconTabFilter (the counts arrive after the tabs). */
async function feTabCounts(page: Page) {
  await page.waitForFunction(() => {
    const bars = (window as any).sap.ui.require('sap/ui/core/ElementRegistry').filter((e: any) => e.isA('sap.m.IconTabBar'));
    const items = bars.flatMap((b: any) => b.getItems().filter((i: any) => i.isA('sap.m.IconTabFilter') && i.getText()));
    return items.length > 0 && items.every((i: any) => i.getCount() !== '');
  }, undefined, { timeout: 30_000 });
  return page.evaluate(() => (window as any).sap.ui.require('sap/ui/core/ElementRegistry').filter((e: any) => e.isA('sap.m.IconTabBar'))
    .flatMap((b: any) => b.getItems().filter((i: any) => i.isA('sap.m.IconTabFilter') && i.getText()).map((i: any) => `${i.getText()}: ${i.getCount()}`)));
}
async function skTabCounts(page: Page) {
  await expect(page.locator('[data-sk-list-tab] [data-sk-tab-count]')).toHaveCount(await page.locator('[data-sk-list-tab]').count());
  return page.locator('[data-sk-list-tab]').evaluateAll((tabs) => tabs.map((t) => `${t.querySelector('[data-sk-tab-text]')?.textContent ?? ''}: ${t.querySelector('[data-sk-tab-count]')?.getAttribute('data-sk-tab-count') ?? ''}`));
}

/** Whether a page variant management is shown, and the number of visible rows' worth of table type. */
const feVariantManagement = async (page: Page) => (await feControls(page, 'sap.ui.fl.variants.VariantManagement')) > 0;
const skVariantManagement = async (page: Page) => (await page.locator('[data-sk-variant]').count()) > 0;

const feTableType = (page: Page) => page.evaluate(() => {
  const t = (window as any).sap.ui.require('sap/ui/core/ElementRegistry').filter((e: any) => e.isA('sap.ui.mdc.Table'))[0];
  return t?.getType()?.isA?.('sap.ui.mdc.table.ResponsiveTableType') ? 'ResponsiveTable' : t?.getType()?.isA?.('sap.ui.mdc.table.GridTableType') ? 'GridTable' : String(t?.getType());
});
const skTableType = async (page: Page) => ((await page.locator('[data-sk-table] tr[data-sk-row]').count()) ? 'ResponsiveTable' : 'GridTable');

const feExport = async (page: Page) => page.evaluate(() => (window as any).sap.ui.require('sap/ui/core/ElementRegistry')
  .filter((e: any) => e.getId().includes('StandardAction::Export') || e.getId().endsWith('-export')).some((e: any) => e.getVisible?.() && e.getDomRef?.()));
const skExport = async (page: Page) => (await page.locator('[data-sk-table-export]').count()) > 0;

const feSelectionMode = (page: Page) => page.evaluate(() => {
  const t = (window as any).sap.ui.require('sap/ui/core/ElementRegistry').filter((e: any) => e.isA('sap.ui.mdc.Table'))[0];
  return String(t?.getSelectionMode());
});
/** smart-kit: check boxes of the first two rows; Single keeps one selected. */
async function skSelectionMode(page: Page) {
  const boxes = page.locator('[data-sk-table] .ag-row:not(.ag-row-pinned) .ag-selection-checkbox input');
  if (!(await boxes.count())) return 'None';
  await boxes.nth(0).check();
  await boxes.nth(1).click();
  return (await page.locator('[data-sk-table] .ag-row-selected').count()) > 1 ? 'Multi' : 'Single';
}

// ---------------------------------------------------------------------------------------------- scenarios

const SCENARIOS: Scenario[] = [
  { name: 'lr5-views-counts', fe: 'purchasing-views', sk: '/po?views=tabs', loads: true, grid: true, extra: { fe: feTabCounts, sk: skTabCounts } },
  { name: 'lr5-initial-auto', fe: 'purchasing', manifest: (s) => { s.initialLoad = 'Auto'; }, sk: '/po?initialLoad=Auto', loads: true, grid: true },
  { name: 'lr5-initial-disabled', fe: 'purchasing', manifest: (s) => { s.initialLoad = 'Disabled'; }, sk: '/po?initialLoad=Disabled', loads: false, grid: false },
  { name: 'lr5-vm-none', fe: 'purchasing', manifest: (s) => { s.variantManagement = 'None'; }, sk: '/po?vm=None', loads: true, grid: true, extra: { fe: feVariantManagement, sk: skVariantManagement } },
  { name: 'lr5-table-default', fe: 'purchasing', manifest: (_s, t) => { delete t.type; }, sk: '/po?table=annotation', loads: true, grid: false, extra: { fe: feTableType, sk: skTableType } },
  { name: 'lr5-threshold', fe: 'purchasing', manifest: (_s, t) => { t.threshold = 50; }, sk: '/po?threshold=50', loads: true, grid: true },
  { name: 'lr5-export-off', fe: 'purchasing', manifest: (_s, t) => { t.enableExport = false; }, sk: '/po?export=0', loads: true, grid: true, extra: { fe: feExport, sk: skExport } },
  { name: 'lr5-selection-single', fe: 'purchasing', manifest: (_s, t) => { t.selectionMode = 'Single'; }, sk: '/po?selection=Single', loads: true, grid: true, extra: { fe: feSelectionMode, sk: skSelectionMode } },
];

for (const s of SCENARIOS) {
  test(`AL-13 FE comparison: ${s.name}`, async ({ browser }) => {
    const fe = await snapshot(browser, s, 'fe');
    const sk = await snapshot(browser, s, 'sk');
    if (s.loads) {
      expect(fe.snap.requests.some((r) => r.resource === 'PurchaseOrders'), 'FE list request').toBe(true);
      expect(sk.snap.requests.some((r) => r.resource === 'PurchaseOrders'), 'smart-kit list request').toBe(true);
    } else {
      // FE switches the filter bar's requests off when the view starts (ListReportController._setInitLoad); on a slow
      // machine (GitHub runners) the table may bind first and FE loads anyway, so CI only checks smart-kit (D49)
      if (!process.env.CI) expect(fe.snap.requests.filter((r) => r.resource === 'PurchaseOrders'), 'FE: no list request').toEqual([]);
      expect(sk.snap.requests.filter((r) => r.resource === 'PurchaseOrders'), 'smart-kit: no list request').toEqual([]);
    }
    const raced = !s.loads && process.env.CI ? { ...fe.snap, requests: fe.snap.requests.filter((r) => r.resource !== 'PurchaseOrders') } : fe.snap;
    compareScenario(s.name, raced, sk.snap);
    if (s.extra) expect(sk.extra, `${s.name}: smart-kit`).toEqual(fe.extra);
  });
}

// ---------------------------------------------------------------------------------------------- creation

/** Opens the draft list, presses Create and returns where the app is afterwards (a dialog, or the URL of the object page). */
async function create(browser: Browser, side: 'fe' | 'sk', dialog: boolean): Promise<string> {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    expect((await page.request.post(`${MOCK}/test/reset`)).ok()).toBeTruthy();
    const s: Scenario = { name: '', fe: 'purchasing-draft', sk: `/po-draft${dialog ? '?creation=CreationDialog' : ''}`, loads: true, grid: true, ...(dialog ? { manifest: (_x: Settings, t: TableSettings) => { t.creationMode = { name: 'CreationDialog' }; } } : {}) };
    if (side === 'fe') {
      await openFe(page, s);
      const id = await page.evaluate(() => (window as any).sap.ui.require('sap/ui/core/ElementRegistry').filter((e: any) => e.isA('sap.m.Button') && e.getId().includes('StandardAction::Create'))[0]?.getId());
      expect(id, 'FE Create button').toBeTruthy();
      await page.locator(`[id="${id}"]`).click();
      if (dialog) {
        await page.waitForFunction(() => (window as any).sap.ui.require('sap/ui/core/ElementRegistry').filter((e: any) => e.isA('sap.m.Dialog') && e.isOpen()).length > 0, undefined, { timeout: 30_000 });
        return 'dialog';
      }
      // FE opens the object page of the new draft (first with a placeholder "(...)"; this service's non-computed key and
      // the mandatory company code are asked in a "New Object" dialog there, DV-lr5 fe:lr5-draft-newpage)
      await page.waitForFunction(() => decodeURIComponent(location.hash).startsWith('#/PurchaseOrders('), undefined, { timeout: 30_000 });
      return 'object page';
    }
    await openSk(page, s);
    await page.locator('[data-sk-table="PurchaseOrders"] [data-sk-action="Create"]').click();
    if (dialog) {
      await expect(page.getByRole('dialog')).toBeVisible();
      return 'dialog';
    }
    // stage 6 (macros6-lr-newobject): the key and the company code are asked in "New Object" first, as in FE
    const modal = page.getByRole('dialog');
    await modal.locator('[data-sk-create-field="CompanyCode"] input').first().fill('1000');
    await modal.getByRole('button', { name: 'Continue' }).click();
    await expect.poll(() => decodeURIComponent(page.url())).toContain('IsActiveEntity=false');
    return 'object page';
  } finally {
    await context.close();
  }
}

test('AL-13 FE comparison: lr5-draft-newpage (creationMode NewPage, the default)', async ({ browser }) => {
  expect(await create(browser, 'fe', false)).toBe('object page');
  expect(await create(browser, 'sk', false)).toBe('object page');
});

test('AL-13 FE comparison: lr5-creation-dialog (creationMode CreationDialog)', async ({ browser }) => {
  expect(await create(browser, 'fe', true)).toBe('dialog');
  expect(await create(browser, 'sk', true)).toBe('dialog');
});
