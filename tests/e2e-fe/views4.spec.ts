/**
 * Fiori elements comparison of stage 4 "views, charts, aggregation, KPI" (docs/29 §5; docs/30 §7.2, AL-10 – AL-12).
 * The annotations and manifest settings each scenario needs are laid over the purchasing `$metadata` and the FE
 * `purchasing/manifest.json` in the browser (`page.route`), so the shared test service, the manifests and the other
 * scenarios stay unchanged. FE: apps/fe-reference `?app=purchasing`; smart-kit: the demo's `/po` (with `?kpi=1` for the
 * KPI tag, `?table=annotation` for the table type chosen from the annotations).
 *
 * - views4-pv-chart-first: the default UI.PresentationVariant names `@UI.Chart#ByStatus` first (and sorts by NetAmount
 *   descending): FE shows only the chart (ListReportConverter SingleChart), sorted by the PV (ChartHelper getSortConditions).
 * - views4-chart-<type>: the same with another UI.ChartType (ChartHelper ChartTypeEnum).
 * - views4-pv-not-compliant: the default PV has no Visualizations: FE uses the UI.LineItem alone (no sort, no RequestAtLeast).
 * - views4-kpi-tag: UI.KPI#OpenAmount with manifest `keyPerformanceIndicators`: the KPI tag in the title.
 * - views4-table-type: ApplySupported with all eight transformations and no table type: FE AnalyticalTable.
 */
import { expect, test, type Browser, type Page } from '@playwright/test';
import type { Snapshot, Structure, TextRows } from './compare';
import { DEMO, FE, MOCK, openFe, openSk, readFe, readSk, RequestRecorder } from './collect';
import { compareScenario } from './harness';

// ---------------------------------------------------------------------------------------------- overlays

type Overlay = (xml: string) => string;

/** Replaces the first `<Annotation Term="…">…</Annotation>` (exact term, unqualified) inside `<Annotations Target="…">`. */
function replaceAnnotation(xml: string, target: string, term: string, replacement: string): string {
  const at = xml.indexOf(`<Annotations Target="${target}">`);
  const start = at < 0 ? -1 : xml.indexOf(`<Annotation Term="${term}">`, at);
  const end = start < 0 ? -1 : xml.indexOf('</Annotation>', start);
  expect(end, `${target} ${term}`).toBeGreaterThan(0);
  return xml.slice(0, start) + replacement + xml.slice(end + '</Annotation>'.length);
}

/** Adds `<Annotations>` elements at the end of the Purchasing schema. */
function addAnnotations(xml: string, annotations: string): string {
  const schema = xml.indexOf('<Schema Namespace="Purchasing"');
  const end = xml.indexOf('</Schema>', schema);
  expect(end).toBeGreaterThan(0);
  return `${xml.slice(0, end)}${annotations}\n    ${xml.slice(end)}`;
}

const PO = 'Purchasing.PurchaseOrder';

/** The default PV with the given Visualizations (none: not compliant), sorted by NetAmount descending. */
const defaultPv = (visualizations: string): Overlay => (xml) => replaceAnnotation(xml, PO, 'UI.PresentationVariant', `<Annotation Term="UI.PresentationVariant">
          <Record Type="UI.PresentationVariantType">
            <PropertyValue Property="SortOrder"><Collection><Record Type="Common.SortOrderType"><PropertyValue Property="Property" PropertyPath="NetAmount"/><PropertyValue Property="Descending" Bool="true"/></Record></Collection></PropertyValue>
            ${visualizations ? `<PropertyValue Property="Visualizations"><Collection>${visualizations}</Collection></PropertyValue>` : ''}
            <PropertyValue Property="RequestAtLeast"><Collection><PropertyPath>Currency</PropertyPath></Collection></PropertyValue>
          </Record>
        </Annotation>`);

const CHART_FIRST = defaultPv('<AnnotationPath>@UI.Chart#ByStatus</AnnotationPath><AnnotationPath>@UI.LineItem</AnnotationPath>');

/** UI.Chart#ByStatus with another chart type. */
const chartType = (type: string): Overlay => (xml) => CHART_FIRST(xml).replace(
  /(<Annotation Term="UI.Chart" Qualifier="ByStatus">[\s\S]*?EnumMember=")UI\.ChartType\/Column(")/,
  `$1UI.ChartType/${type}$2`,
);

const KPI: Overlay = (xml) => addAnnotations(xml, `
      <Annotations Target="${PO}">
        <Annotation Term="UI.KPI" Qualifier="OpenAmount">
          <Record Type="UI.KPIType">
            <PropertyValue Property="DataPoint">
              <Record Type="UI.DataPointType">
                <PropertyValue Property="Title" String="Open net amount"/>
                <PropertyValue Property="Value" Path="NetAmount"/>
                <PropertyValue Property="Criticality" EnumMember="UI.CriticalityType/Positive"/>
              </Record>
            </PropertyValue>
            <PropertyValue Property="SelectionVariant">
              <Record Type="UI.SelectionVariantType">
                <PropertyValue Property="SelectOptions"><Collection>
                  <Record Type="UI.SelectOptionType"><PropertyValue Property="PropertyName" PropertyPath="CompanyCode"/><PropertyValue Property="Ranges"><Collection>
                    <Record Type="UI.SelectionRangeType"><PropertyValue Property="Sign" EnumMember="UI.SelectionRangeSignType/I"/><PropertyValue Property="Option" EnumMember="UI.SelectionRangeOptionType/EQ"/><PropertyValue Property="Low" String="1000"/></Record>
                  </Collection></PropertyValue></Record>
                </Collection></PropertyValue>
              </Record>
            </PropertyValue>
            <PropertyValue Property="Detail">
              <Record Type="UI.KPIDetailType">
                <PropertyValue Property="DefaultPresentationVariant">
                  <Record Type="UI.PresentationVariantType"><PropertyValue Property="Visualizations"><Collection><AnnotationPath>@UI.Chart#ByStatus</AnnotationPath></Collection></PropertyValue></Record>
                </PropertyValue>
              </Record>
            </PropertyValue>
          </Record>
        </Annotation>
      </Annotations>`);

const ALL_TRANSFORMATIONS: Overlay = (xml) => xml.replace(
  '<PropertyValue Property="Transformations"><Collection><String>filter</String><String>groupby</String><String>aggregate</String></Collection></PropertyValue>',
  `<PropertyValue Property="Transformations"><Collection>${['filter', 'identity', 'orderby', 'skip', 'top', 'groupby', 'aggregate', 'concat'].map((x) => `<String>${x}</String>`).join('')}</Collection></PropertyValue>`,
);

/** Changes the PresentationVariant of the SelectionPresentationVariant `q` (its SortOrder, its Visualizations). */
const viewPv = (q: string, change: (pv: string) => string): Overlay => (xml) => {
  const start = xml.indexOf(`<Annotation Term="UI.SelectionPresentationVariant" Qualifier="${q}">`);
  expect(start, `SPV#${q}`).toBeGreaterThan(0);
  const pvAt = xml.indexOf('<PropertyValue Property="PresentationVariant">', start);
  const end = xml.indexOf('</Annotation>', start);
  return xml.slice(0, pvAt) + change(xml.slice(pvAt, end)) + xml.slice(end);
};

/** View Open: no SortOrder, RequestAtLeast CompanyCode; view InDelivery: only the chart ByStatus (a chart view). */
const VIEWS: Overlay = (xml) => viewPv('InDelivery', (pv) => pv.replace(/<PropertyValue Property="Visualizations">[\s\S]*?<\/PropertyValue>/, '<PropertyValue Property="Visualizations"><Collection><AnnotationPath>@UI.Chart#ByStatus</AnnotationPath></Collection></PropertyValue>'))(
  viewPv('Open', (pv) => pv.replace(/<PropertyValue Property="SortOrder">[\s\S]*?<\/PropertyValue>/, '<PropertyValue Property="RequestAtLeast"><Collection><PropertyPath>CompanyCode</PropertyPath></Collection></PropertyValue>'))(xml));

/** Tab counts are a template matter (FE showCounts: `/$count` of the other views, stage 5, DV-draft-029): not compared here. */
const withoutCounts = (r: Snapshot['requests']) => r.filter((x) => !x.resource.endsWith('/$count') && x.options.$top !== '0');

async function openFeViews(page: Page) {
  await page.goto(`${FE}/index.html?app=purchasing-views`);
  await page.waitForFunction(() => {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any -- the UI5 control tree is untyped here */
    const all: any[] = (window as any).sap?.ui?.require?.('sap/ui/core/ElementRegistry')?.filter(() => true) ?? [];
    return all.some((t) => t.isA('sap.ui.mdc.Table') && t.getDomRef() && t._oTable?.getRows()[0]?.getBindingContext());
  }, undefined, { timeout: 90_000, polling: 250 });
}

type ManifestChange = (settings: Record<string, unknown>) => void;

async function overlay(page: Page, change: Overlay, manifest?: ManifestChange) {
  // read from the test service directly (the FE app's proxy answers with Content-Length and Transfer-Encoding)
  await page.route(/\/odata\/purchasing\/\$metadata/, async (route) => {
    const url = new URL(route.request().url());
    const headers = await route.request().allHeaders();
    const res = await fetch(`${MOCK}${url.pathname}${url.search}`, { headers: { 'accept-language': headers['accept-language'] ?? 'en' } });
    await route.fulfill({ status: res.status, contentType: res.headers.get('content-type') ?? 'application/xml', body: change(await res.text()) });
  });
  if (!manifest) return;
  await page.route(/\/purchasing\/manifest\.json/, async (route) => {
    const res = await fetch(route.request().url());
    const m = await res.json() as { 'sap.ui5': { routing: { targets: Record<string, { options: { settings: Record<string, unknown> } }> } } };
    manifest(m['sap.ui5'].routing.targets.PurchaseOrdersList!.options.settings);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(m) });
  });
}

const structure = (s: Partial<Structure>): Structure => ({ filterFields: [], columns: [], actions: [], editingStatus: [], viewTabs: [], chartType: '', ...s });

// ---------------------------------------------------------------------------------------------- chart (FE / smart-kit)

async function openFeChartOnly(page: Page) {
  await page.goto(`${FE}/index.html?app=purchasing`);
  await openFeChartOnlyWait(page);
}

async function openFeChartOnlyWait(page: Page) {
  await page.waitForFunction(
    () => {
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any -- the UI5 control tree is untyped here */
      const all: any[] = (window as any).sap?.ui?.require?.('sap/ui/core/ElementRegistry')?.filter(() => true) ?? [];
      const c = all.find((e) => e.isA('sap.chart.Chart') && e.getDomRef());
      return Boolean(c?.getBinding('data')?.getCurrentContexts().length && /\S/.test(c.getDomRef()?.innerText ?? ''));
    },
    undefined,
    { timeout: 90_000, polling: 250 },
  );
}

/** Chart type, header, dimension and measure labels, whether a table is there, and the drawn data (FE). */
async function readFeChart(page: Page): Promise<{ structure: Structure; text: TextRows }> {
  const r = await page.evaluate(() => {
    /* eslint-disable @typescript-eslint/no-explicit-any -- the UI5 control tree is untyped here */
    const all: any[] = (window as any).sap.ui.require('sap/ui/core/ElementRegistry').filter(() => true);
    const mdc = all.find((e) => e.isA('sap.ui.mdc.Chart') && e.getDomRef());
    const c = all.find((e) => e.isA('sap.chart.Chart') && e.getDomRef());
    const dims: string[] = c.getVisibleDimensions();
    const measures: string[] = c.getVisibleMeasures();
    const rows = c.getBinding('data').getCurrentContexts().map((x: any) => x.getObject());
    const dom: HTMLElement = c.getDomRef();
    return {
      message: /Invalid data/.test(dom.innerText) ? dom.innerText.replace(/\s+/g, ' ').trim() : '',
      type: String(mdc.getChartType()),
      header: String(mdc.getHeader() ?? ''),
      table: all.some((e) => e.isA('sap.ui.mdc.Table') && e.getDomRef()),
      dimLabels: dims.map((d) => String(c.getDimensionByName(d)?.getLabel() ?? d)),
      measureLabels: measures.map((m) => String(c.getMeasureByName(m)?.getLabel() ?? m)),
      data: rows.map((row: Record<string, unknown>) => [...dims.map((d) => String(row[d] ?? '')), ...measures.map((m) => String(Math.round(Number(row[m.replace(/^_fe_aggregatable_/, '')] ?? 0) * 100) / 100))]),
    };
    /* eslint-enable @typescript-eslint/no-explicit-any */
  });
  const labels = [...r.dimLabels, ...r.measureLabels];
  return {
    structure: structure({ chartType: r.type, columns: r.table ? ['[table]', ...labels] : labels }),
    text: [{ header: r.header }, ...(r.message ? [{ message: r.message }] : r.data.map((d: string[]) => Object.fromEntries(d.map((v, i) => [labels[i]!, v]))))],
  };
}

async function openSkChartOnly(page: Page, path = '/po') {
  await page.goto(`${DEMO}${path}${path.includes('?') ? '&' : '?'}lang=en`);
  await expect(page.locator('[data-sk-chart-view] [data-sk-chart]:not(.sk-chart--loading)').first()).toBeVisible({ timeout: 60_000 });
}

async function readSkChart(page: Page): Promise<{ structure: Structure; text: TextRows }> {
  const r = await page.evaluate(() => {
    const view = document.querySelector('[data-sk-chart-view]')!;
    const split = (v: string | null) => (v ?? '').split('\u0001').filter(Boolean);
    return {
      type: view.querySelector('[data-sk-chart]')?.getAttribute('data-sk-chart') ?? '',
      header: (view.querySelector('[data-sk-table-title]')?.textContent ?? '').trim(),
      table: Boolean(document.querySelector('[data-sk-table]')),
      message: (() => { const invalid = view.querySelector('[data-sk-chart-invalid]'); return invalid ? [...invalid.children].map((c) => (c.textContent ?? '').trim()).join(' ') : ''; })(),
      dims: split(view.getAttribute('data-sk-chart-dimensions')),
      measures: split(view.getAttribute('data-sk-chart-measures')),
      bars: [...view.querySelectorAll('[data-sk-chart-bar]')].map((g) => ({
        key: g.getAttribute('data-sk-chart-bar') ?? '',
        values: [...g.querySelectorAll('[data-sk-chart-value]')].map((x) => Number(x.getAttribute('data-sk-chart-value'))),
      })),
    };
  });
  const labels = [...r.dims, ...r.measures];
  return {
    structure: structure({ chartType: r.type, columns: r.table ? ['[table]', ...labels] : labels }),
    text: [{ header: r.header }, ...(r.message ? [{ message: r.message }] : []), ...r.bars.map((b) => Object.fromEntries([[r.dims[0]!, b.key], ...r.measures.map((m, i) => [m, String(Math.round((b.values[i] ?? 0) * 100) / 100)])]))],
  };
}

// ---------------------------------------------------------------------------------------------- KPI tag

async function readFeKpi(page: Page): Promise<TextRows> {
  await page.waitForFunction(() => {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any -- the UI5 control tree is untyped here */
    const all: any[] = (window as any).sap.ui.require('sap/ui/core/ElementRegistry').filter(() => true);
    const tag = all.find((e) => e.isA('sap.m.GenericTag') && e.getId().includes('kpiTag'));
    return Boolean(tag?.getValue?.()?.getNumber?.());
  }, undefined, { timeout: 60_000, polling: 250 });
  return [await page.evaluate(() => {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any -- the UI5 control tree is untyped here */
    const all: any[] = (window as any).sap.ui.require('sap/ui/core/ElementRegistry').filter(() => true);
    const tag = all.find((e) => e.isA('sap.m.GenericTag') && e.getId().includes('kpiTag'));
    const n = tag.getValue();
    return { text: String(tag.getText()), number: String(n.getNumber()), unit: String(n.getUnit() ?? ''), status: String(tag.getStatus()), tooltip: String(tag.getTooltip() ?? '').replace(/\s+/g, ' ').trim() };
  })];
}

async function readSkKpi(page: Page): Promise<TextRows> {
  const tag = page.locator('[data-sk-kpi-tag="openAmount"] [data-sk-generic-tag]');
  await expect(tag).toBeVisible({ timeout: 60_000 });
  return [await tag.evaluate((el) => {
    const value = (el.querySelector('.sk-generic-tag__value')?.textContent ?? '').trim();
    const [number = '', ...unit] = value.split(' ');
    return { text: (el.querySelector('.sk-generic-tag__text')?.textContent ?? '').trim(), number, unit: unit.join(' '), status: el.getAttribute('data-sk-generic-tag') ?? '', tooltip: (el.getAttribute('title') ?? '').replace(/\s+/g, ' ').trim() };
  })];
}

// ---------------------------------------------------------------------------------------------- scenarios

interface Scenario {
  name: string;
  overlay: Overlay;
  manifest?: ManifestChange;
  open: { fe(page: Page): Promise<void>; sk(page: Page): Promise<void> };
  read: { fe(page: Page): Promise<{ structure: Structure; text: TextRows }>; sk(page: Page): Promise<{ structure: Structure; text: TextRows }> };
  check?(fe: Snapshot, sk: Snapshot): void;
  /** Interaction after opening; only the requests sent after it are compared. */
  act?: { fe(page: Page): Promise<void>; sk(page: Page): Promise<void> };
  /** Only these requests are compared (e.g. the collection requests, not FE's row-by-row requests). */
  requests?(r: Snapshot['requests']): Snapshot['requests'];
}

const chartOnly = (name: string, change: Overlay): Scenario => ({
  name,
  overlay: change,
  open: { fe: openFeChartOnly, sk: (page) => openSkChartOnly(page) },
  read: { fe: readFeChart, sk: readSkChart },
  check: (fe) => expect(fe.structure.columns[0], 'FE shows only the chart').not.toBe('[table]'),
});

const listReport = { fe: (page: Page) => readFe(page), sk: (page: Page) => readSk(page) };

const SCENARIOS: Scenario[] = [
  chartOnly('views4-pv-chart-first', CHART_FIRST),
  chartOnly('views4-chart-line', chartType('Line')),
  chartOnly('views4-chart-donut', chartType('Donut')),
  chartOnly('views4-chart-column-stacked', chartType('ColumnStacked')),
  {
    name: 'views4-pv-not-compliant',
    overlay: defaultPv(''),
    open: { fe: (page) => openFe(page, 'purchasing'), sk: (page) => openSk(page, '/po') },
    read: listReport,
    check: (fe, sk) => {
      const list = (s: Snapshot) => s.requests.find((r) => r.resource === 'PurchaseOrders' && r.options.$select);
      expect(list(fe)?.options.$orderby, 'FE: no sort without a compliant PV').toBeUndefined();
      expect(list(sk)?.options.$orderby).toBeUndefined();
    },
  },
  {
    name: 'views4-view-no-sort',
    overlay: VIEWS,
    requests: withoutCounts,
    open: { fe: openFeViews, sk: (page) => openSk(page, '/po?views=tabs') },
    read: listReport,
    check: (fe, sk) => {
      const list = (x: Snapshot) => x.requests.find((r) => r.resource === 'PurchaseOrders' && r.options.$select);
      expect(list(fe)?.options.$orderby, 'FE: the view has no sort').toBeUndefined();
      expect(list(sk)?.options.$orderby).toBeUndefined();
      expect(list(fe)?.options.$select).toContain('CompanyCode');
      expect(list(sk)?.options.$select).toContain('CompanyCode');
    },
  },
  {
    name: 'views4-chart-view',
    overlay: VIEWS,
    requests: withoutCounts,
    open: { fe: openFeViews, sk: (page) => openSk(page, '/po?views=tabs') },
    act: {
      fe: async (page) => {
        const id = await page.evaluate(() => {
          /* eslint-disable-next-line @typescript-eslint/no-explicit-any -- the UI5 control tree is untyped here */
          const all: any[] = (window as any).sap.ui.require('sap/ui/core/ElementRegistry').filter(() => true);
          return all.find((e) => e.isA('sap.m.IconTabFilter') && String(e.getKey()).includes('InDelivery'))?.getId() as string | undefined;
        });
        expect(id, 'FE InDelivery view tab').toBeTruthy();
        await page.locator(`[id="${id}"]`).click();
        await openFeChartOnlyWait(page);
      },
      sk: async (page) => {
        await page.locator('[data-sk-list-tab="InDelivery"]').click();
        await expect(page.locator('[data-sk-chart-view] [data-sk-chart]:not(.sk-chart--loading)').first()).toBeVisible({ timeout: 60_000 });
      },
    },
    read: { fe: readFeChart, sk: readSkChart },
  },
  {
    name: 'views4-kpi-tag',
    overlay: KPI,
    manifest: (s) => { s.keyPerformanceIndicators = { openAmount: { model: '', entitySet: 'PurchaseOrders', qualifier: 'OpenAmount' } }; },
    open: { fe: (page) => openFe(page, 'purchasing'), sk: (page) => openSk(page, '/po?kpi=1') },
    read: {
      fe: async (page) => { const r = await readFe(page); return { structure: r.structure, text: [...await readFeKpi(page), ...r.text] }; },
      sk: async (page) => { const r = await readSk(page); return { structure: r.structure, text: [...await readSkKpi(page), ...r.text] }; },
    },
  },
  {
    name: 'views4-table-type',
    overlay: ALL_TRANSFORMATIONS,
    // FE's row-by-row requests for the columns that are not groupable are the same cause as DV-totals-002
    requests: (r) => r.filter((x) => x.resource === 'PurchaseOrders'),
    manifest: (s) => {
      const t = ((s.controlConfiguration as Record<string, { tableSettings: Record<string, unknown> }>)['@com.sap.vocabularies.UI.v1.LineItem']!).tableSettings;
      delete t.type;
    },
    open: {
      fe: async (page) => {
        await page.goto(`${FE}/index.html?app=purchasing`);
        await page.waitForFunction(() => {
          /* eslint-disable-next-line @typescript-eslint/no-explicit-any -- the UI5 control tree is untyped here */
          const all: any[] = (window as any).sap?.ui?.require?.('sap/ui/core/ElementRegistry')?.filter(() => true) ?? [];
          const t = all.find((e) => e.isA('sap.ui.mdc.Table'));
          return Boolean(t?._oTable?.getRows?.()?.some((r: { getBindingContext(): unknown }) => r.getBindingContext()));
        }, undefined, { timeout: 90_000, polling: 250 });
      },
      sk: async (page) => {
        await page.goto(`${DEMO}/po?table=annotation&lang=en`);
        await expect(page.locator('[data-sk-table] .ag-row[row-index="0"] [col-id^="DataField::"]').first()).not.toBeEmpty({ timeout: 60_000 });
      },
    },
    read: {
      fe: async (page) => {
        const r = await page.evaluate(() => {
          /* eslint-disable-next-line @typescript-eslint/no-explicit-any -- the UI5 control tree is untyped here */
          const all: any[] = (window as any).sap.ui.require('sap/ui/core/ElementRegistry').filter(() => true);
          const t = all.find((e) => e.isA('sap.ui.mdc.Table'));
          return { type: t.getType()?.getMetadata().getName() ?? '', p13n: [...t.getP13nMode()].sort() as string[] };
        });
        return { structure: structure({ actions: r.p13n }), text: [{ type: r.type.endsWith('GridTableType') && r.p13n.includes('Aggregate') ? 'AnalyticalTable' : r.type }] };
      },
      sk: async (page) => {
        const table = page.locator('[data-sk-table="PurchaseOrders"]');
        await table.locator('[data-sk-table-settings]').click();
        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();
        const p13n = ['Column', 'Sort'];
        if (await dialog.locator('[data-sk-p13n-group-tab]').count()) p13n.push('Group');
        if (await dialog.locator('[data-sk-p13n-totals-tab]').count()) p13n.push('Aggregate');
        await page.keyboard.press('Escape');
        return { structure: structure({ actions: p13n.sort() }), text: [{ type: p13n.includes('Aggregate') ? 'AnalyticalTable' : 'grid' }] };
      },
    },
  },
];

async function snapshot(browser: Browser, s: Scenario, side: 'fe' | 'sk'): Promise<Snapshot> {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    expect((await page.request.post(`${MOCK}/test/reset`)).ok()).toBeTruthy();
    await overlay(page, s.overlay, side === 'fe' ? s.manifest : undefined);
    const rec = new RequestRecorder(page);
    await s.open[side](page);
    await rec.idle(page);
    if (s.act) {
      rec.reset();
      await s.act[side](page);
      await rec.idle(page);
    }
    const { structure: st, text } = await s.read[side](page);
    await rec.idle(page);
    return { requests: s.requests ? s.requests(rec.requests) : rec.requests, structure: st, text };
  } finally {
    await context.close();
  }
}

for (const s of SCENARIOS) {
  test(`AL-10 AL-11 AL-12 FE comparison: ${s.name}`, async ({ browser }) => {
    const fe = await snapshot(browser, s, 'fe');
    const sk = await snapshot(browser, s, 'sk');
    s.check?.(fe, sk);
    compareScenario(s.name, fe, sk);
  });
}
