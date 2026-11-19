/**
 * Fiori elements comparison of stage 7 (lr7, docs/26c, docs/30 §5.3, §7.2, AL-13): FE app apps/fe-reference
 * `purchasing` with the setting laid over its manifest in the browser (as macros6-lr.spec.ts) against the demo's `/po`
 * (apps/demo/src/feListReport.ts, the same settings through `lr`).
 *
 * - lr7-menu-default: a manifest menu with `defaultAction` is a split button (FE ActionsTemplating getMenuButton:
 *   MenuButton buttonMode "Split").
 * - lr7-toolbar-content: an action with `template` puts the fragment into the table toolbar (FE getCustomToolbarContent).
 * - lr7-merge-cells: an annotation column's `settings.mergeCells` on a responsive table leaves cells equal to the one
 *   above empty (sap.m.Column mergeDuplicates).
 * - lr7-ai-notice: a column `aiNotice` puts an AI button into the column header (FE getColumnHeaderAiNotice).
 * - lr7-no-semantic-dates: `useSemanticDateRange` false: the date filter field has no semantic date operators (no
 *   DynamicDateRange; FE CommonHelper.getOperatorsForProperty).
 */
import { expect, test, type Browser, type Page } from '@playwright/test';
import type { Snapshot } from './compare';
import { DEMO, FE, MOCK, readFe, readSk, RequestRecorder } from './collect';
import { compareScenario } from './harness';

/* eslint-disable @typescript-eslint/no-explicit-any -- the UI5 control tree is untyped here */
const LIST = 'PurchaseOrdersList';
type Json = Record<string, unknown>;
const UI = 'com.sap.vocabularies.UI.v1';
const LINE_ITEM = `@${UI}.LineItem`;

function merge(base: unknown, patch: unknown): unknown {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch) || !base || typeof base !== 'object' || Array.isArray(base)) return patch;
  const out: Json = { ...(base as Json) };
  for (const [k, v] of Object.entries(patch)) out[k] = merge(out[k], v);
  return out;
}

async function openFeWith(page: Page, settings: Json) {
  await page.route(/\/purchasing\/manifest\.json/, async (route) => {
    const m = await (await fetch(route.request().url())).json() as { 'sap.ui5': { routing: { targets: Record<string, { options: { settings: Json } }> } } };
    const target = m['sap.ui5'].routing.targets[LIST]!;
    target.options.settings = merge(target.options.settings, settings) as Json;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(m) });
  });
  await page.goto(`${FE}/index.html?app=purchasing`);
  await page.waitForFunction(() => {
    const R = (window as any).sap?.ui?.require?.('sap/ui/core/ElementRegistry');
    if (!R) return false;
    return R.filter((e: any) => e.isA('sap.ui.mdc.Table') && e.getDomRef()).some((t: any) => (t.getRowBinding?.()?.getCurrentContexts?.() ?? []).some(Boolean));
  }, undefined, { timeout: 90_000, polling: 250 });
}

async function openSkWith(page: Page, settings: Json) {
  await page.goto(`${DEMO}/po?lang=en&lr=${encodeURIComponent(JSON.stringify(settings))}`);
  await expect(page.locator('[data-sk-table] .ag-row[row-index="0"]:not(.ag-row-loading), [data-sk-table] tr[data-sk-row]').first()).toBeVisible({ timeout: 60_000 });
  const expand = page.getByRole('button', { name: /^(Show Filters|Expand Header)$/ });
  if (await expand.isVisible()) await expand.click();
  await expect(page.locator('[data-sk-filter]').first()).toBeVisible();
}

interface Scenario {
  name: string;
  settings: Json;
  extra: { fe(page: Page): Promise<unknown>; sk(page: Page): Promise<unknown> };
  feExtra: unknown;
  /** Compare the requests and the structure too (else only the extra answer). */
  full?: boolean;
}

async function snapshot(browser: Browser, s: Scenario, side: 'fe' | 'sk'): Promise<{ snap: Snapshot; extra: unknown }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    expect((await page.request.post(`${MOCK}/test/reset`)).ok()).toBeTruthy();
    const rec = new RequestRecorder(page);
    if (side === 'fe') await openFeWith(page, s.settings);
    else await openSkWith(page, s.settings);
    await rec.idle(page);
    const read = s.full ? await (side === 'fe' ? readFe(page) : readSk(page)) : { structure: { filterFields: [], columns: [], actions: [], editingStatus: [], viewTabs: [], chartType: '' }, text: [] };
    const extra = await s.extra[side](page);
    return { snap: { requests: s.full ? rec.requests : [], ...read }, extra };
  } finally {
    await context.close();
  }
}

const feTable = `(window.sap.ui.require('sap/ui/core/ElementRegistry').filter((e) => e.isA('sap.ui.mdc.Table') && e.getDomRef())[0])`;

const SCENARIOS: Scenario[] = [
  {
    name: 'lr7-menu-default',
    settings: { controlConfiguration: { [LINE_ITEM]: { actions: { decide: { defaultAction: 'DataFieldForAction::Purchasing.approve' } } } } },
    extra: {
      fe: (page) => page.evaluate(() => {
        const R = (window as any).sap.ui.require('sap/ui/core/ElementRegistry');
        const b = R.filter((e: any) => e.isA('sap.m.MenuButton') && e.getDomRef() && e.getText() === 'Decide')[0];
        return { split: b?.getButtonMode() === 'Split', items: b?.getMenu()?.getItems().map((i: any) => i.getText()) ?? [] };
      }),
      sk: async (page) => {
        const split = (await page.locator('[data-sk-table] [data-sk-action-group="decide"][data-sk-split]').count()) === 1;
        await page.locator('[data-sk-action-group-arrow="decide"]').click();
        const items = await page.locator('[role="menu"] [role="menuitem"]').allInnerTexts();
        await page.keyboard.press('Escape');
        return { split, items: items.map((x) => x.trim()) };
      },
    },
    feExtra: { split: true, items: ['Approve', 'Reject'] },
  },
  {
    name: 'lr7-toolbar-content',
    settings: { controlConfiguration: { [LINE_ITEM]: { actions: { note: { text: 'Note', template: 'fe.ref.ext.ToolbarNote' } } } } },
    extra: {
      fe: (page) => page.evaluate((expr) => {
        const table = eval(expr);
        const texts = (table?._oToolbar?.getContent?.() ?? []).flatMap((c: any) => (c.getAction ? [c.getAction()] : [c]))
          .map((a: any) => a?.getDomRef?.()?.textContent ?? '').filter((x: string) => x.includes('Toolbar note'));
        return { content: texts.length ? 'Toolbar note' : '', button: (window as any).sap.ui.require('sap/ui/core/ElementRegistry').filter((e: any) => e.isA('sap.m.Button') && e.getText?.() === 'Note' && e.getDomRef()).length > 0 };
      }, feTable),
      sk: (page) => page.evaluate(() => ({
        content: document.querySelector('[data-sk-table] [data-sk-toolbar-content="note"]')?.textContent ?? '',
        button: Boolean(document.querySelector('[data-sk-table] [data-sk-action="note"]')),
      })),
    },
    feExtra: { content: 'Toolbar note', button: false },
  },
  {
    name: 'lr7-merge-cells',
    settings: { controlConfiguration: { [LINE_ITEM]: { tableSettings: { type: 'ResponsiveTable' }, columns: { 'DataField::PurchaseOrderType': { settings: { mergeCells: true } } } } } },
    extra: {
      // merged cells (left empty) of the column in the first 20 rows, by row index
      fe: (page) => page.evaluate((expr) => {
        const table = eval(expr);
        const inner = table._oTable;
        const col = inner.getColumns().findIndex((c: any) => c.getMergeDuplicates());
        if (col < 0) return ['no merged column'];
        return inner.getItems().slice(0, 20).flatMap((item: any, i: number) => (item.getDomRef()?.querySelectorAll('td.sapMListTblCell')[col]?.classList.contains('sapMListTblCellDup') ? [i] : []));
      }, feTable),
      sk: (page) => page.evaluate(() => [...document.querySelectorAll('[data-sk-table] tr[data-sk-row]')].slice(0, 20)
        .flatMap((tr, i) => (tr.querySelector('td[data-col="DataField::PurchaseOrderType"][data-sk-merged]') ? [i] : []))),
    },
    feExtra: 'merged rows',
  },
  {
    name: 'lr7-ai-notice',
    settings: { controlConfiguration: { [LINE_ITEM]: { columns: { 'DataField::Supplier': { aiNotice: { contentText: 'Suggested by AI' } } } } } },
    extra: {
      fe: (page) => page.evaluate(() => ({ notices: (window as any).sap.ui.require('sap/ui/core/ElementRegistry').filter((e: any) => e.isA('sap.m.plugins.ColumnAIAction')).length })),
      sk: (page) => page.evaluate(() => ({ notices: document.querySelectorAll('[data-sk-table] [data-sk-ai-notice]').length })),
    },
    feExtra: { notices: 1 },
  },
  {
    name: 'lr7-no-semantic-dates',
    settings: { controlConfiguration: { [`@${UI}.SelectionFields`]: { useSemanticDateRange: false } } },
    full: true,
    extra: {
      fe: (page) => page.evaluate(() => {
        const R = (window as any).sap.ui.require('sap/ui/core/ElementRegistry');
        const field = R.filter((e: any) => e.isA('sap.ui.mdc.FilterField') && e.getPropertyKey?.() === 'OrderDate')[0];
        const ops: string[] = field?.getOperators?.() ?? [];
        return { semantic: ops.some((o) => /^(TODAY|LASTWEEKS|DATERANGE|THISYEAR)$/.test(o)) || R.filter((e: any) => e.isA('sap.m.DynamicDateRange') && e.getDomRef()).length > 0 };
      }),
      sk: (page) => page.evaluate(() => ({ semantic: Boolean(document.querySelector('[data-sk-filter="OrderDate"] [data-sk-relative-dates]')) })),
    },
    feExtra: { semantic: false },
  },
];

for (const s of SCENARIOS) {
  test(`AL-13 FE comparison: ${s.name}`, async ({ browser }) => {
    const fe = await snapshot(browser, s, 'fe');
    const sk = await snapshot(browser, s, 'sk');
    if (s.full) compareScenario(s.name, fe.snap, sk.snap);
    // merged rows: FE has a merged column and leaves at least one cell empty
    if (s.feExtra === 'merged rows') expect((fe.extra as unknown[]).length > 0 && typeof (fe.extra as unknown[])[0] === 'number', `${s.name}: FE ${JSON.stringify(fe.extra)}`).toBe(true);
    else expect(fe.extra, `${s.name}: FE`).toMatchObject(s.feExtra as Record<string, unknown>);
    expect(sk.extra, `${s.name}: smart-kit`).toEqual(fe.extra);
  });
}
