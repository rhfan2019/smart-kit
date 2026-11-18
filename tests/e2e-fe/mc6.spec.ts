/**
 * Fiori elements comparison, stage 6 group "mc6" (docs/30 §7.2): the micro charts of sap.fe.macros.MicroChart are the
 * sap.suite.ui.microchart controls (FE MicroChart.createMicroChart, MicroChartHelper). FE: the order object page and the
 * list report of apps/fe-reference `?app=purchasing`; smart-kit: the demo's `/purchasing/object` and `/po`.
 * Compared per chart (text rows): the control class, its size, its colour (semantic value or "palette") and, for the
 * bullet, the mode and the number of thresholds. Header facets have no size (Auto); table cells are XS.
 */
import { expect, test, type Browser, type Page } from '@playwright/test';
import type { Snapshot, Structure, TextRows } from './compare';
import { DEMO, FE, MOCK } from './collect';
import { compareScenario } from './harness';

const ORDER = '4500000001';
const structure = (s: Partial<Structure>): Structure => ({ filterFields: [], columns: [], actions: [], editingStatus: [], viewTabs: [], chartType: '', ...s });

type Row = Record<string, string>;

// ---------------------------------------------------------------------------------------------- FE

/** Reads every rendered micro chart control under `rootType` (first instance), in DOM order. */
async function readFeCharts(page: Page, rootType: string, limit: number): Promise<Row[]> {
  return page.evaluate(({ rootType, limit }) => {
    /* eslint-disable @typescript-eslint/no-explicit-any -- the UI5 control tree is untyped here */
    const all: any[] = (window as any).sap.ui.require('sap/ui/core/ElementRegistry').filter(() => true);
    const root = all.find((e) => e.isA(rootType) && e.getDomRef());
    const charts = all.filter((e) => e.getMetadata().getName().startsWith('sap.suite.ui.microchart.') && /MicroChart$/.test(e.getMetadata().getName()) && e.getDomRef() && root.getDomRef().contains(e.getDomRef()));
    charts.sort((a, b) => (a.getDomRef().compareDocumentPosition(b.getDomRef()) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
    const tone = (c: unknown) => (typeof c === 'string' && /Palette|Sequence/.test(c) ? 'palette' : c ? String(c) : 'Neutral');
    return charts.slice(0, limit).map((c) => {
      const type = c.getMetadata().getName().split('.').pop();
      const palette = c.getColorPalette?.() ?? [];
      const color = type === 'BulletMicroChart' ? c.getActual()?.getColor()
        : type === 'RadialMicroChart' ? c.getValueColor()
          : type === 'HarveyBallMicroChart' ? (palette.length ? palette[0] : c.getItems()[0]?.getColor())
            : type === 'ComparisonMicroChart' ? (palette.length ? palette[0] : c.getData()[0]?.getColor())
              : type === 'ColumnMicroChart' ? c.getColumns()[0]?.getColor()
                : type === 'StackedBarMicroChart' ? c.getBars()[0]?.getValueColor()
                  : type === 'LineMicroChart' ? c.getLines()[0]?.getColor()
                    : type === 'AreaMicroChart' ? c.getChart()?.getColor() : undefined;
      const row: Record<string, string> = { control: type, size: c.getSize(), color: tone(color) };
      if (type === 'BulletMicroChart') { row.mode = c.getMode(); row.thresholds = String(c.getThresholds().length); }
      return row;
    });
    /* eslint-enable @typescript-eslint/no-explicit-any */
  }, { rootType, limit });
}

async function waitForFeCharts(page: Page, rootType: string) {
  await page.waitForFunction(
    (rootType) => {
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any -- the UI5 control tree is untyped here */
      const R = (window as any).sap?.ui?.require?.('sap/ui/core/ElementRegistry');
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any -- the UI5 control tree is untyped here */
      return Boolean(R?.filter((e: any) => e.isA(rootType) && e.getDomRef()).length && R.filter((e: any) => e.getMetadata().getName().startsWith('sap.suite.ui.microchart.') && e.getDomRef()).length);
    },
    rootType,
    { timeout: 90_000, polling: 250 },
  );
  await page.waitForTimeout(1500);
}

// ---------------------------------------------------------------------------------------------- smart-kit

const CONTROL: Record<string, string> = {
  bullet: 'BulletMicroChart', radial: 'RadialMicroChart', harvey: 'HarveyBallMicroChart', delta: 'DeltaMicroChart', column: 'ColumnMicroChart',
  line: 'LineMicroChart', comparison: 'ComparisonMicroChart', area: 'AreaMicroChart', stackedBar: 'StackedBarMicroChart',
};

async function readSkCharts(page: Page, root: string, limit: number): Promise<Row[]> {
  const rows = await page.evaluate(({ root, limit }) => {
    const tone = (el: Element | null | undefined) => {
      const m = /sk-chart--(positive|negative|critical|neutral|palette-\d+)/.exec(el?.getAttribute('class') ?? '');
      return !m ? 'Neutral' : m[1]!.startsWith('palette') ? 'palette' : ({ positive: 'Good', negative: 'Error', critical: 'Critical', neutral: 'Neutral' } as Record<string, string>)[m[1]!]!;
    };
    return [...document.querySelector(root)!.querySelectorAll('[data-sk-microchart]')].slice(0, limit).map((c) => {
      const kind = c.getAttribute('data-sk-microchart')!;
      const size = /sk-microchart--size-(\w+)/.exec(c.className)?.[1] ?? 'Responsive';
      const markOf: Record<string, Element | null> = {
        comparison: c.querySelector('[data-sk-microchart-bar="0"]'), column: c.querySelector('[data-sk-microchart-bar="0"]'), stackedBar: c.querySelector('[data-sk-microchart-bar="0"]'),
        line: c.querySelector('[data-sk-microchart-line="0"]'), area: c.querySelector('[data-sk-microchart-bar="actual"]'),
      };
      const row: Record<string, string> = { kind, size, color: tone(kind in markOf ? markOf[kind] : c) };
      if (kind === 'bullet') { row.mode = c.querySelector('[data-sk-microchart-bar="delta"]') ? 'Delta' : 'Actual'; row.thresholds = String(c.querySelectorAll('[data-sk-microchart-bar="threshold"]').length); }
      return row;
    });
  }, { root, limit });
  return rows.map(({ kind, ...r }) => ({ control: CONTROL[kind!]!, ...r }));
}

// ---------------------------------------------------------------------------------------------- scenarios

interface Scenario {
  name: string;
  fe: (page: Page) => Promise<Row[]>;
  sk: (page: Page) => Promise<Row[]>;
}

const SCENARIOS: Scenario[] = [
  {
    name: 'mc6-header-facets',
    fe: async (page) => {
      await page.goto(`${FE}/index.html?app=purchasing#/PurchaseOrders('${ORDER}')`);
      await waitForFeCharts(page, 'sap.uxap.ObjectPageLayout');
      return readFeCharts(page, 'sap.uxap.ObjectPageLayout', 10);
    },
    sk: async (page) => {
      await page.goto(`${DEMO}/purchasing/object?path=${encodeURIComponent(`PurchaseOrders('${ORDER}')`)}&lang=en`);
      await expect(page.locator('[data-sk-facet] [data-sk-microchart]').first()).toBeVisible({ timeout: 60_000 });
      await page.waitForTimeout(800);
      return readSkCharts(page, '.sk-object-header', 10);
    },
  },
  {
    name: 'mc6-table-cells',
    fe: async (page) => {
      await page.goto(`${FE}/index.html?app=purchasing#/`);
      await waitForFeCharts(page, 'sap.ui.mdc.Table');
      return readFeCharts(page, 'sap.ui.mdc.Table', 3);
    },
    sk: async (page) => {
      await page.goto(`${DEMO}/po?lang=en`);
      const t = page.locator('[data-sk-table]').first();
      await expect(t.locator('.ag-row').first()).toBeVisible({ timeout: 60_000 });
      await t.locator('.ag-body-horizontal-scroll-viewport').evaluate((el) => { el.scrollLeft = el.scrollWidth; });
      await expect(t.locator('[data-sk-microchart]').first()).toBeVisible({ timeout: 30_000 });
      await page.waitForTimeout(500);
      return readSkCharts(page, '[data-sk-table]', 3);
    },
  },
];

async function snapshot(browser: Browser, read: (page: Page) => Promise<Row[]>): Promise<Snapshot> {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    expect((await page.request.post(`${MOCK}/test/reset`)).ok()).toBeTruthy();
    const text: TextRows = await read(page);
    return { requests: [], structure: structure({}), text };
  } finally {
    await context.close();
  }
}

for (const s of SCENARIOS) {
  test(`FE comparison: ${s.name}`, async ({ browser }) => {
    const fe = await snapshot(browser, s.fe);
    const sk = await snapshot(browser, s.sk);
    expect(fe.text.length, 'FE micro charts').toBeGreaterThan(0);
    expect(sk.text.length, 'smart-kit micro charts').toBeGreaterThan(0);
    compareScenario(s.name, fe, sk);
  });
}
