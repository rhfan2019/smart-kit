/**
 * Fiori elements comparison of the list report chart and of aggregation (docs/30 §7.2, AL-10 – AL-12; docs/29 §4
 * P1-2 Aggregation.CustomAggregate, P1-3 list report chart). FE: apps/fe-reference `?app=purchasing-chart` (views:
 * the LineItem and the chart view PresentationVariant#ByStatusChart = UI.Chart#ByStatus); smart-kit: the demo's
 * `/po?chart=1` (the same `views.paths`: a table view and the chart view). Compared: the requests sent when the chart is
 * shown (without and with a filter condition), the chart type, its dimensions and measures, and what the chart draws.
 */
import { expect, test, type Browser, type Page } from '@playwright/test';
import type { Snapshot, Structure, TextRows } from './compare';
import { DEMO, FE, feFilter, MOCK, RequestRecorder, skFilter } from './collect';
import { compareScenario } from './harness';

/** A supplier whose open orders of company code 1000 are all in EUR: the chart has one unit and is drawn. */
const SINGLE_CURRENCY_SUPPLIER = '0000100126';

interface ChartScenario {
  name: string;
  /** Optional interaction before the chart is shown (a filter condition). */
  act?: { fe(page: Page): Promise<void>; sk(page: Page): Promise<void> };
}

const SCENARIOS: ChartScenario[] = [
  { name: 'po-chart' },
  {
    name: 'po-chart-filter',
    act: { fe: (page) => feFilter(page, 'Supplier', SINGLE_CURRENCY_SUPPLIER), sk: (page) => skFilter(page, 'Supplier', SINGLE_CURRENCY_SUPPLIER) },
  },
];

const structure = (s: Partial<Structure>): Structure => ({ filterFields: [], columns: [], actions: [], editingStatus: [], viewTabs: [], chartType: '', ...s });

// ---------------------------------------------------------------------------------------------- FE

async function openFeChart(page: Page) {
  await page.goto(`${FE}/index.html?app=purchasing-chart`);
  // the first view (the table) has rows
  await page.waitForFunction(
    () => {
      const w = window as unknown as { sap?: { ui?: { require?: (n: string) => unknown } } };
      const R = w.sap?.ui?.require?.('sap/ui/core/ElementRegistry') as { filter(f: (e: { isA(t: string): boolean }) => boolean): unknown[] } | undefined;
      const table = R?.filter((e) => e.isA('sap.ui.mdc.Table'))[0] as { _oTable?: { getRows(): { getBindingContext(): unknown }[] } } | undefined;
      return Boolean(table?._oTable?.getRows()[0]?.getBindingContext());
    },
    undefined,
    { timeout: 90_000, polling: 250 },
  );
}

/** Selects the chart view (the IconTabBar entry of the chart). */
async function showFeChart(page: Page) {
  const id = await page.evaluate(() => {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any -- the UI5 control tree is untyped here */
    const all: any[] = (window as any).sap.ui.require('sap/ui/core/ElementRegistry').filter(() => true);
    return all.find((e) => e.isA('sap.m.IconTabFilter') && String(e.getKey()).includes('Chart'))?.getId() as string | undefined;
  });
  expect(id, 'FE chart view tab').toBeTruthy();
  await page.locator(`[id="${id}"]`).click();
  await waitFeChart(page);
}

/** Waits until the inner chart (sap.chart.Chart) has its data. */
async function waitFeChart(page: Page) {
  await page.waitForFunction(
    () => {
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any -- the UI5 control tree is untyped here */
      const all: any[] = (window as any).sap.ui.require('sap/ui/core/ElementRegistry').filter(() => true);
      const c = all.find((e) => e.isA('sap.chart.Chart') && e.getDomRef());
      const b = c?.getBinding('data');
      return Boolean(b?.getCurrentContexts().length && /\S/.test(c.getDomRef()?.innerText ?? ''));
    },
    undefined,
    { timeout: 60_000, polling: 250 },
  );
}

/** Chart type, dimension and measure labels, and what the FE chart draws (or its message). */
async function readFeChart(page: Page): Promise<{ structure: Structure; text: TextRows }> {
  const r = await page.evaluate(() => {
    /* eslint-disable @typescript-eslint/no-explicit-any -- the UI5 control tree is untyped here */
    const all: any[] = (window as any).sap.ui.require('sap/ui/core/ElementRegistry').filter(() => true);
    const mdc = all.find((e) => e.isA('sap.ui.mdc.Chart') && e.getDomRef());
    const c = all.find((e) => e.isA('sap.chart.Chart') && e.getDomRef());
    const dims: string[] = c.getVisibleDimensions();
    const measures: string[] = c.getVisibleMeasures();
    const dimLabels = dims.map((d) => String(c.getDimensionByName(d)?.getLabel() ?? d));
    const measureLabels = measures.map((m) => String(c.getMeasureByName(m)?.getLabel() ?? m));
    const dom: HTMLElement = c.getDomRef();
    const message = [...dom.querySelectorAll('svg text, div')].length && /Invalid data/.test(dom.innerText) ? dom.innerText.replace(/\s+/g, ' ').trim() : '';
    const rows = c.getBinding('data').getCurrentContexts().map((x: any) => x.getObject());
    return { type: String(mdc.getChartType()), dims, measures, dimLabels, measureLabels, message, rows };
    /* eslint-enable @typescript-eslint/no-explicit-any */
  });
  const text: TextRows = r.message
    ? [{ message: r.message }]
    : r.rows.map((row: Record<string, unknown>) => Object.fromEntries([
      ...r.dims.map((d, i) => [r.dimLabels[i]!, String(row[d] ?? '')]),
      ...r.measures.map((m, i) => [r.measureLabels[i]!, String(Math.round(Number(row[m.replace(/^_fe_aggregatable_/, '')] ?? 0) * 100) / 100)]),
    ]));
  return { structure: structure({ chartType: r.type, columns: [...r.dimLabels, ...r.measureLabels] }), text };
}

// ---------------------------------------------------------------------------------------------- smart-kit

async function openSkChart(page: Page) {
  await page.goto(`${DEMO}/po?chart=1&lang=en`);
  await expect(page.locator('[data-sk-table] .ag-row[row-index="0"]:not(.ag-row-pinned):not(.ag-row-loading) [col-id^="DataField::"]').first()).not.toBeEmpty({ timeout: 60_000 });
  // the header (filter bar) may start collapsed while the table fills the page (as collect.ts openSk)
  const expand = page.getByRole('button', { name: /^(Show Filters|Expand Header)$/ });
  if (await expand.isVisible()) await expand.click();
  await expect(page.locator('[data-sk-filter]').first()).toBeVisible();
}

async function showSkChart(page: Page) {
  // the chart view of `views.paths` (key "chart" in the purchasing-chart manifest, as FE's IconTabBar entry)
  await page.locator('[data-sk-list-tab="chart"]').click();
  await waitSkChart(page);
}

async function waitSkChart(page: Page) {
  await expect(page.locator('[data-sk-chart-view] [data-sk-chart]:not(.sk-chart--loading)').first()).toBeVisible({ timeout: 30_000 });
}

/** Chart type, dimension and measure labels, and what the smart-kit chart draws (or its message). */
async function readSkChart(page: Page): Promise<{ structure: Structure; text: TextRows }> {
  const r = await page.evaluate(() => {
    const view = document.querySelector('[data-sk-chart-view]')!;
    const split = (v: string | null) => (v ?? '').split('\u0001').filter(Boolean);
    const invalid = view.querySelector('[data-sk-chart-invalid]');
    return {
      type: view.querySelector('[data-sk-chart]')?.getAttribute('data-sk-chart') ?? '',
      dims: split(view.getAttribute('data-sk-chart-dimensions')),
      measures: split(view.getAttribute('data-sk-chart-measures')),
      message: invalid ? [...invalid.children].map((c) => (c.textContent ?? '').trim()).join(' ') : '',
      bars: [...view.querySelectorAll('[data-sk-chart-bar]')].map((g) => ({
        label: (g.querySelector('title')?.textContent ?? '').split(':')[1]?.split(',')[0]?.trim() ?? '',
        key: g.getAttribute('data-sk-chart-bar') ?? '',
        values: [...g.querySelectorAll('rect')].map((x) => Number(x.getAttribute('data-sk-chart-value'))),
      })),
    };
  });
  // one dimension: the category key is its value (multi-dimension categories are not in these scenarios)
  const text: TextRows = r.message
    ? [{ message: r.message }]
    : r.bars.map((b) => Object.fromEntries([...r.dims.map((d) => [d, b.key]), ...r.measures.map((m, i) => [m, String(Math.round((b.values[i] ?? 0) * 100) / 100)])]));
  return { structure: structure({ chartType: r.type, columns: [...r.dims, ...r.measures] }), text };
}

// ---------------------------------------------------------------------------------------------- scenarios

async function snapshot(browser: Browser, s: ChartScenario, side: 'fe' | 'sk'): Promise<Snapshot> {
  // a fresh context per side: no shared storage (variants, page state) between the two apps
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    expect((await page.request.post(`${MOCK}/test/reset`)).ok()).toBeTruthy();
    const rec = new RequestRecorder(page);
    if (side === 'fe') await openFeChart(page);
    else await openSkChart(page);
    await rec.idle(page);
    if (s.act) {
      // the condition is entered while the table is shown (FE validates it through the value list first)
      await s.act[side](page);
      await page.waitForTimeout(300);
      await rec.idle(page);
    }
    // only the requests of the chart are compared (the table's are compared by the list report scenarios)
    rec.reset();
    if (side === 'fe') await showFeChart(page);
    else await showSkChart(page);
    await rec.idle(page);
    const { structure: st, text } = side === 'fe' ? await readFeChart(page) : await readSkChart(page);
    return { requests: rec.requests, structure: st, text };
  } finally {
    await context.close();
  }
}

for (const s of SCENARIOS) {
  test(`AL-10 AL-11 AL-12 FE comparison: ${s.name}`, async ({ browser }) => {
    const fe = await snapshot(browser, s, 'fe');
    const sk = await snapshot(browser, s, 'sk');
    expect(fe.requests.some((r) => r.options.$apply), `FE chart request: ${JSON.stringify(fe.requests)}`).toBeTruthy();
    expect(fe.text.length, 'FE chart content').toBeGreaterThan(0);
    compareScenario(s.name, fe, sk);
  });
}
