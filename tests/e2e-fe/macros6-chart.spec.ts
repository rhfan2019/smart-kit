/**
 * Fiori elements comparison of the chart building block's personalization (stage 6, sap.fe.macros.Chart
 * `personalization`, sap.ui.mdc.Chart p13nMode; docs/30 §7.2). The list report shows only the chart
 * (the default UI.PresentationVariant names `@UI.Chart#ByStatus` first, as views4-pv-chart-first):
 * - macros6-chart-p13n: the personalization the list report offers (FE getP13nMode without chartSettings: Sort, Type,
 *   Item): the toolbar buttons, the "View By" dimensions, the chart types and the panels of "View Settings".
 * - macros6-chart-type: choosing "Bar Chart" with the chart type button (no new request, the chart type changes).
 * - macros6-chart-item: Order Type is added as a dimension (FE: the Chart panel's state, StateUtil; smart-kit: "View By"):
 *   the aggregation request groups by it as well and it follows the annotated dimension.
 * - macros6-chart-sort: setPresentationVariant (FE) / the Sort panel (smart-kit) sorts by Status ascending: `$orderby`.
 */
import { expect, test, type Browser, type Page } from '@playwright/test';
import type { Snapshot, Structure, TextRows } from './compare';
import { DEMO, FE, MOCK, RequestRecorder } from './collect';
import { compareScenario } from './harness';

/** The default PV of PurchaseOrder names the chart first and sorts by NetAmount descending (views4 CHART_FIRST). */
function chartFirst(xml: string): string {
  const at = xml.indexOf('<Annotations Target="Purchasing.PurchaseOrder">');
  const start = at < 0 ? -1 : xml.indexOf('<Annotation Term="UI.PresentationVariant">', at);
  const end = start < 0 ? -1 : xml.indexOf('</Annotation>', start);
  expect(end, 'PurchaseOrder UI.PresentationVariant').toBeGreaterThan(0);
  return `${xml.slice(0, start)}<Annotation Term="UI.PresentationVariant">
          <Record Type="UI.PresentationVariantType">
            <PropertyValue Property="SortOrder"><Collection><Record Type="Common.SortOrderType"><PropertyValue Property="Property" PropertyPath="NetAmount"/><PropertyValue Property="Descending" Bool="true"/></Record></Collection></PropertyValue>
            <PropertyValue Property="Visualizations"><Collection><AnnotationPath>@UI.Chart#ByStatus</AnnotationPath><AnnotationPath>@UI.LineItem</AnnotationPath></Collection></PropertyValue>
            <PropertyValue Property="RequestAtLeast"><Collection><PropertyPath>Currency</PropertyPath></Collection></PropertyValue>
          </Record>
        </Annotation>${xml.slice(end + '</Annotation>'.length)}`;
}

async function overlay(page: Page) {
  await page.route(/\/odata\/purchasing\/\$metadata/, async (route) => {
    const url = new URL(route.request().url());
    const headers = await route.request().allHeaders();
    const res = await fetch(`${MOCK}${url.pathname}${url.search}`, { headers: { 'accept-language': headers['accept-language'] ?? 'en' } });
    await route.fulfill({ status: res.status, contentType: res.headers.get('content-type') ?? 'application/xml', body: chartFirst(await res.text()) });
  });
}

const structure = (s: Partial<Structure>): Structure => ({ filterFields: [], columns: [], actions: [], editingStatus: [], viewTabs: [], chartType: '', ...s });

// ---------------------------------------------------------------------------------------------- FE

/* eslint-disable @typescript-eslint/no-explicit-any -- the UI5 control tree is untyped here */
async function feChartReady(page: Page) {
  await page.waitForFunction(() => {
    const all: any[] = (window as any).sap?.ui?.require?.('sap/ui/core/ElementRegistry')?.filter(() => true) ?? [];
    const c = all.find((e) => e.isA('sap.chart.Chart') && e.getDomRef());
    return Boolean(c?.getBinding('data')?.getCurrentContexts().length && /\S/.test(c.getDomRef()?.innerText ?? ''));
  }, undefined, { timeout: 90_000, polling: 250 });
}

/** Presses a toolbar button of the FE chart by its text ("Settings", "Chart Type", "View By"). */
async function fePress(page: Page, text: string) {
  expect(await page.evaluate((t) => {
    const all: any[] = (window as any).sap.ui.require('sap/ui/core/ElementRegistry').filter(() => true);
    const b = all.find((e) => e.isA('sap.m.Button') && String(e.getText?.() ?? '') === t && e.getDomRef());
    b?.firePress();
    return Boolean(b);
  }, text), `FE button ${text}`).toBe(true);
}

/** Item texts of the open popover's list (chart types, View By). */
async function fePopoverItems(page: Page): Promise<string[]> {
  const shown = () => [...document.querySelectorAll('.sapMPopover')].filter((x) => (x as HTMLElement).offsetParent !== null || getComputedStyle(x).visibility === 'visible' && (x as HTMLElement).getClientRects().length > 0);
  await page.waitForFunction(`(${shown.toString()})().some((x) => x.querySelector('.sapMLIB'))`, undefined, { timeout: 15_000 });
  return page.evaluate(`(${shown.toString()})().flatMap((p) => [...p.querySelectorAll('.sapMLIB')].map((li) => li.innerText.trim())).filter(Boolean)`);
}

async function feClosePopover(page: Page) {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
}

async function readFeChart(page: Page): Promise<{ structure: Structure; text: TextRows }> {
  const r = await page.evaluate(() => {
    const all: any[] = (window as any).sap.ui.require('sap/ui/core/ElementRegistry').filter(() => true);
    const mdc = all.find((e) => e.isA('sap.ui.mdc.Chart') && e.getDomRef());
    const c = all.find((e) => e.isA('sap.chart.Chart') && e.getDomRef());
    const dims: string[] = c.getVisibleDimensions();
    const measures: string[] = c.getVisibleMeasures();
    return {
      type: String(mdc.getChartType()),
      p13n: [...mdc.getP13nMode()].sort() as string[],
      labels: [...dims.map((d) => String(c.getDimensionByName(d)?.getLabel() ?? d)), ...measures.map((m) => String(c.getMeasureByName(m)?.getLabel() ?? m))],
    };
  });
  // the Sort mode is the "Sort" panel of View Settings (compared in macros6-chart-p13n)
  return { structure: structure({ chartType: r.type, columns: r.labels, actions: r.p13n.filter((x) => x !== 'Sort') }), text: [] };
}

async function feSettingsTabs(page: Page): Promise<string[]> {
  await fePress(page, 'Settings');
  await page.waitForFunction(() => document.querySelector('[role=dialog] [role=tab]'), undefined, { timeout: 15_000 });
  const tabs = await page.evaluate(() => [...document.querySelectorAll('[role=dialog] [role=tab]')].map((x) => (x as HTMLElement).innerText.trim()).filter(Boolean));
  await page.keyboard.press('Escape');
  return tabs;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------------------------- smart-kit

const SK_CHART = '[data-sk-chart-view] [data-sk-chart]:not(.sk-chart--loading)';

async function skOpen(page: Page) {
  await page.goto(`${DEMO}/po?lang=en`);
  await expect(page.locator(SK_CHART).first()).toBeVisible({ timeout: 60_000 });
}

async function readSkChart(page: Page): Promise<{ structure: Structure; text: TextRows }> {
  const r = await page.evaluate(() => {
    const view = document.querySelector('[data-sk-chart-view]')!;
    const split = (v: string | null) => (v ?? '').split('\u0001').filter(Boolean);
    const p13n = [
      ...(view.querySelector('[data-sk-chart-view-by]') ? ['Item'] : []),
      ...(view.querySelector('[data-sk-chart-type-button]') ? ['Type'] : []),
    ];
    return { type: view.getAttribute('data-sk-chart-type') ?? '', labels: [...split(view.getAttribute('data-sk-chart-dimensions')), ...split(view.getAttribute('data-sk-chart-measures'))], p13n };
  });
  return { structure: structure({ chartType: r.type, columns: r.labels, actions: r.p13n }), text: [] };
}

async function skMenuItems(page: Page, button: string): Promise<string[]> {
  await page.locator(`[data-sk-chart-view] ${button}`).click();
  const menu = page.getByRole('menu');
  await expect(menu).toBeVisible();
  const items = (await menu.getByRole('menuitem').allInnerTexts()).map((x) => x.trim());
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  return items;
}

async function skSettingsTabs(page: Page): Promise<string[]> {
  await page.locator('[data-sk-chart-view] [data-sk-chart-settings]').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const tabs = (await dialog.getByRole('tab').allInnerTexts()).map((x) => x.trim());
  await page.keyboard.press('Escape');
  return tabs;
}

// ---------------------------------------------------------------------------------------------- scenarios

interface Side {
  open(page: Page): Promise<void>;
  act?(page: Page): Promise<void>;
  read(page: Page): Promise<{ structure: Structure; text: TextRows }>;
}
interface Scenario { name: string; fe: Side; sk: Side; check?(fe: Snapshot, sk: Snapshot): void }

const feOpen = async (page: Page) => { await page.goto(`${FE}/index.html?app=purchasing`); await feChartReady(page); };
const chartRequest = (s: Snapshot) => s.requests.filter((r) => r.resource === 'PurchaseOrders' && r.options.$apply);

const SCENARIOS: Scenario[] = [
  {
    name: 'macros6-chart-p13n',
    fe: {
      open: feOpen,
      read: async (page) => {
        const base = await readFeChart(page);
        await fePress(page, 'View By');
        const viewBy = await fePopoverItems(page);
        await feClosePopover(page);
        await fePress(page, 'Chart Type');
        const types = await fePopoverItems(page);
        await feClosePopover(page);
        const tabs = await feSettingsTabs(page);
        return { structure: base.structure, text: [{ viewBy: viewBy.join(', '), types: types.join(', '), settings: tabs.join(', ') }] };
      },
    },
    sk: {
      open: skOpen,
      read: async (page) => {
        const base = await readSkChart(page);
        const viewBy = await skMenuItems(page, '[data-sk-chart-view-by]');
        const types = await skMenuItems(page, '[data-sk-chart-type-button]');
        const tabs = await skSettingsTabs(page);
        return { structure: base.structure, text: [{ viewBy: viewBy.join(', '), types: types.join(', '), settings: tabs.join(', ') }] };
      },
    },
  },
  {
    name: 'macros6-chart-type',
    fe: {
      open: feOpen,
      act: async (page) => {
        await fePress(page, 'Chart Type');
        await fePopoverItems(page);
        await page.locator('.sapMPopover .sapMLIB', { hasText: /^\s*Bar Chart\s*$/ }).first().click();
        await page.waitForFunction(() => {
          /* eslint-disable-next-line @typescript-eslint/no-explicit-any -- the UI5 control tree is untyped here */
          const all: any[] = (window as any).sap.ui.require('sap/ui/core/ElementRegistry').filter(() => true);
          return all.find((e) => e.isA('sap.ui.mdc.Chart') && e.getDomRef())?.getChartType() === 'bar';
        }, undefined, { timeout: 30_000 });
      },
      read: readFeChart,
    },
    sk: {
      open: skOpen,
      act: async (page) => {
        await page.locator('[data-sk-chart-view] [data-sk-chart-type-button]').click();
        await page.getByRole('menuitem', { name: 'Bar Chart', exact: true }).click();
        await expect(page.locator('[data-sk-chart-view]')).toHaveAttribute('data-sk-chart-type', 'bar');
      },
      read: readSkChart,
    },
    check: (fe, sk) => {
      expect(fe.structure.chartType).toBe('bar');
      expect(sk.structure.chartType).toBe('bar');
    },
  },
  {
    name: 'macros6-chart-item',
    fe: {
      open: feOpen,
      act: async (page) => {
        // the item as the Chart panel adds it (sap.ui.mdc.p13n.StateUtil; FE drill-down "View By" ends in the same state)
        await page.evaluate(async () => {
          /* eslint-disable @typescript-eslint/no-explicit-any -- the UI5 control tree is untyped here */
          const all: any[] = (window as any).sap.ui.require('sap/ui/core/ElementRegistry').filter(() => true);
          const mdc = all.find((e) => e.isA('sap.ui.mdc.Chart'));
          const StateUtil = await new Promise<any>((r) => (window as any).sap.ui.require(['sap/ui/mdc/p13n/StateUtil'], r));
          /* eslint-enable @typescript-eslint/no-explicit-any */
          await StateUtil.applyExternalState(mdc, { items: [{ name: '_fe_groupable_PurchaseOrderType', role: 'category' }] });
        });
        await page.waitForFunction(() => {
          /* eslint-disable-next-line @typescript-eslint/no-explicit-any -- the UI5 control tree is untyped here */
          const all: any[] = (window as any).sap.ui.require('sap/ui/core/ElementRegistry').filter(() => true);
          return all.find((e) => e.isA('sap.chart.Chart') && e.getDomRef())?.getVisibleDimensions().includes('PurchaseOrderType');
        }, undefined, { timeout: 30_000 });
        await feChartReady(page);
      },
      read: readFeChart,
    },
    sk: {
      open: skOpen,
      act: async (page) => {
        await page.locator('[data-sk-chart-view] [data-sk-chart-view-by]').click();
        await page.getByRole('menuitem', { name: 'Order Type', exact: true }).click();
        await expect(page.locator('[data-sk-chart-view]')).toHaveAttribute('data-sk-chart-dimensions', /Order Type/);
        await expect(page.locator(SK_CHART).first()).toBeVisible({ timeout: 60_000 });
      },
      read: readSkChart,
    },
    check: (fe, sk) => {
      expect(chartRequest(fe)[0]?.options.$apply, 'FE groups by the added dimension').toContain('PurchaseOrderType');
      expect(chartRequest(sk)[0]?.options.$apply).toContain('PurchaseOrderType');
    },
  },
  {
    name: 'macros6-chart-sort',
    fe: {
      open: feOpen,
      act: async (page) => {
        await page.evaluate(async () => {
          /* eslint-disable-next-line @typescript-eslint/no-explicit-any -- the UI5 control tree is untyped here */
          const all: any[] = (window as any).sap.ui.require('sap/ui/core/ElementRegistry').filter(() => true);
          const bb = all.find((e) => e.isA('sap.fe.macros.Chart'));
          const pv = await bb.getPresentationVariant();
          pv.setProperties({ SortOrder: [{ Property: 'Status', Descending: false }] });
          await bb.setPresentationVariant(pv);
        });
        await feChartReady(page);
      },
      read: readFeChart,
    },
    sk: {
      open: skOpen,
      act: async (page) => {
        await page.locator('[data-sk-chart-view] [data-sk-chart-settings]').click();
        const dialog = page.getByRole('dialog');
        await dialog.locator('[data-sk-p13n-tab="sort"]').click();
        // sap.m.p13n.SortPanel: × removes the annotation's sort, the last (empty) row adds a sort criterion (FE's PV replaces SortOrder)
        const panel = dialog.locator('[data-sk-p13n-panel="sort"]');
        while (await panel.locator('[data-sk-p13n-remove]').count()) await panel.locator('[data-sk-p13n-remove]').first().click();
        await panel.locator('input[data-sk-p13n-sort-field]').last().click();
        await page.getByRole('option', { name: 'Status', exact: true }).click();
        await dialog.locator('[data-sk-p13n-ok]').click();
        await expect(page.locator(SK_CHART).first()).toBeVisible({ timeout: 60_000 });
      },
      read: readSkChart,
    },
    check: (fe, sk) => {
      expect(chartRequest(fe)[0]?.options.$orderby, 'FE sorts the chart by Status').toBe('Status');
      expect(chartRequest(sk)[0]?.options.$orderby).toBe('Status');
    },
  },
];

async function snapshot(browser: Browser, s: Scenario, side: 'fe' | 'sk'): Promise<Snapshot> {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    expect((await page.request.post(`${MOCK}/test/reset`)).ok()).toBeTruthy();
    await overlay(page);
    const rec = new RequestRecorder(page);
    const x = s[side];
    await x.open(page);
    await rec.idle(page);
    if (x.act) {
      rec.reset();
      await x.act(page);
      await rec.idle(page);
    }
    const { structure: st, text } = await x.read(page);
    return { requests: rec.requests, structure: st, text };
  } finally {
    await context.close();
  }
}

for (const s of SCENARIOS) {
  test(`AL-11 AL-12 FE comparison: ${s.name}`, async ({ browser }) => {
    const fe = await snapshot(browser, s, 'fe');
    const sk = await snapshot(browser, s, 'sk');
    s.check?.(fe, sk);
    compareScenario(s.name, fe, sk);
  });
}
