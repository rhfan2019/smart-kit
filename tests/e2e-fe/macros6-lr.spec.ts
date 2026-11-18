/**
 * Fiori elements comparison of stage 6, list report leftovers (docs/26c, docs/30 §5.3, §7.2, AL-13): FE app
 * apps/fe-reference (with the setting laid over the app's manifest in the browser, as lr5.spec.ts) against the demo's
 * `/po` / `/po-draft` (apps/demo/src/feListReport.ts, the same settings through query parameters).
 *
 * - macros6-lr-newobject: creationMode NewPage on the draft list: Create asks the non-computed key and the immutable
 *   company code in a "New Object" dialog (Continue / Cancel) and POSTs them (FE TransactionHelper createWithDialog,
 *   MetaModelFunction getCreatePopupFields).
 * - macros6-lr-views-sv: `views.paths` with UI.SelectionVariant paths: the default table filtered by each SV, titled by
 *   the SV's Text (FE ListReportConverter getViews / getViewTitle).
 * - macros6-lr-combined / -combined-table: a combined view (`primary` chart, `secondary` table): the content switcher
 *   (Chart and Table / Chart / Table), `defaultPath` "both" (default) and "secondary" (FE CollectionVisualization,
 *   ListReportController _getDefaultPath).
 * - macros6-lr-default-template: `defaultTemplateAnnotationPath` (an SPV): its PV is the table's, its SV the filter
 *   bar's defaults (FE getCompliantVisualizationAnnotation, getSelectionVariant).
 * - macros6-lr-header: `content.header` — `customHeader` (expanded / collapsed fragments), header actions with
 *   `priority` "AlwaysOverflow" and `isPrimaryAction` (FE getHeaderActions).
 * - macros6-lr-vm-control: `variantManagement` "Control": no page variant management; the filter bar's variant
 *   management in the title, the table's own.
 */
import { expect, test, type Browser, type Page } from '@playwright/test';
import type { Snapshot } from './compare';
import { DEMO, FE, MOCK, readFe, readSk, RequestRecorder } from './collect';
import { compareScenario } from './harness';

/* eslint-disable @typescript-eslint/no-explicit-any -- the UI5 control tree is untyped here */
const registry = (page: Page) => page.evaluate(() => Boolean((window as any).sap?.ui?.require?.('sap/ui/core/ElementRegistry')));

/** Body of the POST that creates a purchase order (direct or inside a $batch). */
function createBodies(page: Page): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  page.on('request', (r) => {
    if (r.method() !== 'POST' || !r.url().includes('/odata/')) return;
    const body = r.postData() ?? '';
    if (/\/\$batch(\?|$)/.test(r.url())) {
      const m = /POST PurchaseOrders HTTP\/1\.1[\s\S]*?\r?\n\r?\n(\{.*\})/.exec(body);
      if (m) out.push(JSON.parse(m[1]!) as Record<string, unknown>);
    } else if (/\/PurchaseOrders(\?|$)/.test(r.url())) out.push(JSON.parse(body || '{}') as Record<string, unknown>);
  });
  return out;
}

interface NewObject { title: string; labels: string[]; required: string[]; buttons: string[]; body: Record<string, unknown> | undefined; navigated: boolean }

async function feNewObject(page: Page): Promise<NewObject> {
  const bodies = createBodies(page);
  await page.goto(`${FE}/index.html?app=purchasing-draft`);
  await page.waitForFunction(() => {
    const R = (window as any).sap?.ui?.require?.('sap/ui/core/ElementRegistry');
    return R && R.filter((e: any) => e.isA('sap.m.Button') && e.getId().includes('StandardAction::Create') && e.getDomRef()).length > 0;
  }, undefined, { timeout: 90_000 });
  expect(await registry(page)).toBe(true);
  const id = await page.evaluate(() => (window as any).sap.ui.require('sap/ui/core/ElementRegistry').filter((e: any) => e.isA('sap.m.Button') && e.getId().includes('StandardAction::Create'))[0]?.getId());
  await page.locator(`[id="${id}"]`).click();
  await page.waitForFunction(() => (window as any).sap.ui.require('sap/ui/core/ElementRegistry').filter((e: any) => e.isA('sap.m.Dialog') && e.isOpen()).length > 0, undefined, { timeout: 30_000 });
  const d = await page.evaluate(() => {
    const dialog = (window as any).sap.ui.require('sap/ui/core/ElementRegistry').filter((e: any) => e.isA('sap.m.Dialog') && e.isOpen())[0];
    const labels = [...dialog.getDomRef().querySelectorAll('.sapMLabel')] as HTMLElement[];
    return {
      title: dialog.getTitle(),
      labels: labels.map((l) => (l.querySelector('bdi')?.textContent ?? l.textContent ?? '').replace(/:$/, '').trim()),
      required: labels.filter((l) => l.classList.contains('sapMLabelRequired')).map((l) => (l.querySelector('bdi')?.textContent ?? '').replace(/:$/, '').trim()),
      buttons: dialog.getButtons().map((b: any) => b.getText()),
    };
  });
  const inputs = page.locator('.sapMDialog input');
  await inputs.nth(0).fill('4500009999');
  await inputs.nth(1).fill('1000');
  await inputs.nth(1).press('Tab');
  await page.locator('.sapMDialog').getByText('Continue').click();
  await page.waitForFunction(() => decodeURIComponent(location.hash).includes('IsActiveEntity=false'), undefined, { timeout: 30_000 });
  return { ...d, body: bodies[0], navigated: true };
}

async function skNewObject(page: Page): Promise<NewObject> {
  const bodies = createBodies(page);
  await page.goto(`${DEMO}/po-draft?lang=en`);
  await page.locator('[data-sk-table="PurchaseOrders"] [data-sk-action="Create"]').click();
  const dialog = page.locator('[data-sk-new-object-dialog]').last();
  const modal = page.getByRole('dialog');
  await expect(modal).toBeVisible();
  const fields = modal.locator('[data-sk-create-field]');
  const n = await fields.count();
  const labels: string[] = [];
  const required: string[] = [];
  for (let i = 0; i < n; i++) {
    const label = fields.nth(i).locator('label').first();
    const text = (await label.innerText()).replace(/\*$/, '').replace(/:$/, '').trim();
    labels.push(text);
    if ((await fields.nth(i).locator('input[required], [aria-required="true"], .mantine-InputWrapper-required').count()) > 0) required.push(text);
  }
  const title = (await modal.locator('.mantine-Modal-title').innerText()).trim();
  const buttons = (await modal.locator('button:not([aria-label])').allInnerTexts()).map((x) => x.trim()).filter(Boolean);
  await fields.nth(0).locator('input').first().fill('4500009999');
  await fields.nth(1).locator('input').first().fill('1000');
  await fields.nth(1).locator('input').first().press('Tab');
  await modal.getByRole('button', { name: 'Continue' }).click();
  await expect.poll(() => decodeURIComponent(page.url())).toContain('IsActiveEntity=false');
  void dialog;
  return { title, labels, required, buttons, body: bodies[0], navigated: true };
}

test('AL-13 FE comparison: macros6-lr-newobject (NewPage asks keys and immutable fields in "New Object")', async ({ browser }) => {
  const run = async (side: 'fe' | 'sk') => {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      expect((await page.request.post(`${MOCK}/test/reset`)).ok()).toBeTruthy();
      return side === 'fe' ? await feNewObject(page) : await skNewObject(page);
    } finally {
      await context.close();
    }
  };
  const fe = await run('fe');
  const sk = await run('sk');
  expect(fe).toMatchObject({ title: 'New Object', labels: ['Purchase Order', 'Company Code'], required: ['Company Code'], buttons: ['Continue', 'Cancel'] });
  expect(sk.title).toBe(fe.title);
  expect(sk.labels).toEqual(fe.labels);
  expect(sk.required).toEqual(fe.required);
  expect(sk.buttons).toEqual(fe.buttons);
  expect(sk.body).toEqual(fe.body);
});

// ---------------------------------------------------------------------------------------------- settings scenarios

const LIST = 'PurchaseOrdersList';
type Json = Record<string, unknown>;

function merge(base: unknown, patch: unknown): unknown {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch) || !base || typeof base !== 'object' || Array.isArray(base)) return patch;
  const out: Json = { ...(base as Json) };
  for (const [k, v] of Object.entries(patch)) out[k] = merge(out[k], v);
  return out;
}

interface SettingsScenario {
  name: string;
  /** List report settings laid over the `purchasing` manifest (FE) and passed as `lr` (demo). */
  settings: Json;
  /** Table rows load (else only the requests are compared). */
  grid?: boolean;
  extra?: { fe(page: Page): Promise<unknown>; sk(page: Page): Promise<unknown> };
  /** What FE's extra answer must be (guards the comparison against reading nothing on both sides). */
  feExtra?: unknown;
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
    const tables = R.filter((e: any) => e.isA('sap.ui.mdc.Table') && e.getDomRef());
    const charts = R.filter((e: any) => e.isA('sap.ui.mdc.Chart') && e.getDomRef());
    return tables.some((t: any) => (t.getRowBinding?.()?.getCurrentContexts?.() ?? []).some(Boolean)) || (charts.length > 0 && tables.length === 0);
  }, undefined, { timeout: 90_000, polling: 250 });
}

async function openSkWith(page: Page, settings: Json) {
  await page.goto(`${DEMO}/po?lang=en&lr=${encodeURIComponent(JSON.stringify(settings))}`);
  await expect(page.locator('[data-sk-table] .ag-row[row-index="0"]:not(.ag-row-loading), [data-sk-table] tr[data-sk-row], [data-sk-chart]').first()).toBeVisible({ timeout: 60_000 });
  // the header collapses after the first load; FE's filter fields are read with the header expanded (as lr5.spec.ts)
  const expand = page.getByRole('button', { name: /^(Show Filters|Expand Header)$/ });
  if (await expand.isVisible()) await expand.click();
  await expect(page.locator('[data-sk-filter]').first()).toBeVisible();
}

async function settingsSnapshot(browser: Browser, s: SettingsScenario, side: 'fe' | 'sk'): Promise<{ snap: Snapshot; extra: unknown }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    expect((await page.request.post(`${MOCK}/test/reset`)).ok()).toBeTruthy();
    const rec = new RequestRecorder(page);
    if (side === 'fe') await openFeWith(page, s.settings);
    else await openSkWith(page, s.settings);
    await rec.idle(page);
    const read = s.grid === false
      ? { structure: { filterFields: [], columns: [], actions: [], editingStatus: [], viewTabs: [], chartType: '' }, text: [] }
      : await (side === 'fe' ? readFe(page) : readSk(page));
    const extra = s.extra ? await s.extra[side](page) : undefined;
    return { snap: { requests: rec.requests, ...read }, extra };
  } finally {
    await context.close();
  }
}

const UI = 'com.sap.vocabularies.UI.v1';

/** Content switcher of a combined view: the items and the selected one; whether a chart and a table are shown. */
const feCombined = (page: Page) => page.evaluate(() => {
  const R = (window as any).sap.ui.require('sap/ui/core/ElementRegistry');
  const seg = R.filter((e: any) => e.isA('sap.m.SegmentedButton') && e.getDomRef())[0];
  const shown = (t: string) => R.filter((e: any) => e.isA(t) && e.getDomRef() && e.getDomRef().offsetParent !== null).length > 0;
  return {
    items: seg ? seg.getItems().map((i: any) => i.getTooltip?.() || i.getText()) : [],
    selected: seg ? (R.filter((e: any) => e.getId() === seg.getSelectedItem())[0]?.getTooltip?.() ?? '') : '',
    chart: shown('sap.ui.mdc.Chart'),
    table: shown('sap.ui.mdc.Table'),
  };
});
const skCombined = (page: Page) => page.evaluate(() => {
  const seg = document.querySelector('[data-sk-content-switch]');
  const labels = seg ? [...seg.querySelectorAll('label')].map((l) => l.textContent ?? '') : [];
  const checked = seg?.querySelector('input:checked')?.closest('div')?.querySelector('label')?.textContent ?? '';
  return { items: labels, selected: checked, chart: Boolean(document.querySelector('.sk-chart[data-sk-chart]')), table: Boolean(document.querySelector('[data-sk-table]')) };
});

/** Header: the title's action buttons (inline, in order; emphasized marked "*"), the overflow ones, the custom header texts
 *  with the header expanded and collapsed. */
async function feHeader(page: Page) {
  const read = () => page.evaluate(() => {
    const R = (window as any).sap.ui.require('sap/ui/core/ElementRegistry');
    const title = R.filter((e: any) => e.isA('sap.f.DynamicPageTitle'))[0];
    const buttons = (title?.getActions() ?? []).filter((b: any) => b.isA('sap.m.Button') && b.getVisible() && b.getText() && !/Share|Send/.test(b.getText()));
    const inline = buttons.filter((b: any) => b.getDomRef() && !b.getDomRef().closest('.sapMPopover')).map((b: any) => b.getText() + (b.getType() === 'Emphasized' ? '*' : ''));
    const overflow = buttons.filter((b: any) => !b.getDomRef() || b.getDomRef().closest('.sapMPopover')).map((b: any) => b.getText());
    const text = (cls: string) => R.filter((e: any) => e.isA('sap.m.Text') && e.hasStyleClass?.(cls) && e.getDomRef()?.offsetParent).map((e: any) => e.getText());
    return { inline, overflow, expanded: text('feRefExpandedHeader'), collapsed: text('feRefCollapsedHeader') };
  });
  const setExpanded = (v: boolean) => page.evaluate((x) => (window as any).sap.ui.require('sap/ui/core/ElementRegistry').filter((e: any) => e.isA('sap.f.DynamicPage'))[0].setHeaderExpanded(x), v);
  await setExpanded(true);
  await page.waitForTimeout(500);
  const open = await read();
  await setExpanded(false);
  await page.waitForTimeout(500);
  const closed = await read();
  return { inline: open.inline, overflow: open.overflow, expanded: open.expanded, collapsed: closed.collapsed };
}
async function skHeader(page: Page) {
  const title = page.locator('.sk-dynamic-page__toolbar').first();
  const inline = await title.locator('[data-sk-toolbar-item] [data-sk-header-action]').evaluateAll((els) => els.map((e) => (e.textContent ?? '') + (e.getAttribute('data-variant') === 'filled' ? '*' : '')));
  let overflow: string[] = [];
  const more = title.locator('[data-sk-toolbar-more]');
  if (await more.count()) {
    await more.click();
    await page.locator('[data-sk-toolbar-overflow] [data-sk-header-action]').first().waitFor();
    overflow = await page.locator('[data-sk-toolbar-overflow] [data-sk-header-action]').allInnerTexts();
    await page.keyboard.press('Escape');
  }
  const expanded = await page.locator('[data-demo-expanded-header]:visible').allInnerTexts();
  await page.getByRole('button', { name: /^(Hide Filters|Collapse Header)$/ }).first().click();
  await expect(page.locator('[data-demo-collapsed-header]').first()).toBeVisible();
  const collapsed = await page.locator('[data-demo-collapsed-header]:visible').allInnerTexts();
  return { inline, overflow, expanded, collapsed };
}

/** Chart of a list report: its header and which personalization buttons it has (chart type; settings for the panels). */
const feChartConfig = (page: Page) => page.evaluate(() => {
  const chart = (window as any).sap.ui.require('sap/ui/core/ElementRegistry').filter((e: any) => e.isA('sap.ui.mdc.Chart'))[0];
  const modes: string[] = chart?.getP13nMode() ?? [];
  return { header: chart?.getHeader() ?? '', type: modes.includes('Type'), settings: modes.some((m) => m !== 'Type') };
});
const skChartConfig = (page: Page) => page.evaluate(() => {
  const view = document.querySelector('[data-sk-chart-view]');
  return { header: view?.querySelector('[data-sk-table-title]')?.textContent ?? '', type: Boolean(view?.querySelector('[data-sk-chart-type-button]')), settings: Boolean(view?.querySelector('[data-sk-chart-settings]')) };
});

/** Variant managements: how many, and whether the title shows one. */
const feVms = (page: Page) => page.evaluate(() => {
  const R = (window as any).sap.ui.require('sap/ui/core/ElementRegistry');
  const vms = R.filter((e: any) => e.isA('sap.ui.fl.variants.VariantManagement'));
  return { count: vms.length, page: vms.some((v: any) => v.getId().includes('PageVariantManagement')), filterBar: vms.some((v: any) => /FilterBar.*VariantManagement|VariantManagement$/.test(v.getId()) && !v.getId().includes('PageVariantManagement') && !v.getId().includes('Table')) };
});
const skVms = (page: Page) => page.evaluate(() => {
  const vms = [...document.querySelectorAll('[data-sk-variant]')];
  return { count: vms.length, page: false, filterBar: Boolean(document.querySelector('.sk-dynamic-page-title [data-sk-variant], [data-sk-page-title] [data-sk-variant]')) || vms.some((v) => !v.closest('[data-sk-table]') && !v.closest('[data-sk-chart]')) };
});

/** Table toolbar (macros6): the custom actions and the separators of their overflow groups, in toolbar order ("|" a separator). */
const CUSTOM = ['One', 'Two', 'Three'];
const feTableSeparators = (page: Page) => page.evaluate((names) => {
  const R = (window as any).sap.ui.require('sap/ui/core/ElementRegistry');
  const table = R.filter((e: any) => e.isA('sap.ui.mdc.Table') && e.getDomRef())[0];
  const content: any[] = table?._oToolbar?.getContent?.() ?? [];
  const out: string[] = [];
  for (const c of content) {
    const a = c.getAction ? c.getAction() : c;
    if (!a || (a.getVisible && !a.getVisible())) continue;
    if (a.isA('sap.m.ToolbarSeparator')) out.push('|');
    else if (names.includes(a.getText?.())) out.push(a.getText());
  }
  // a separator counts only before a custom action
  return out.filter((x, i) => x !== '|' || names.includes(out[i + 1] ?? ''));
}, CUSTOM);
const skTableSeparators = (page: Page) => page.evaluate((names) => {
  const bar = document.querySelector('[data-sk-table] .sk-table__toolbar-actions');
  const out = [...(bar?.querySelectorAll('[data-sk-separator], [data-sk-action]') ?? [])].map((e) => (e.hasAttribute('data-sk-separator') ? '|' : e.textContent ?? '')).filter((x) => x === '|' || names.includes(x));
  return out.filter((x, i) => x !== '|' || names.includes(out[i + 1] ?? ''));
}, CUSTOM);
const LINE_ITEM = `@${UI}.LineItem`;

const SETTINGS_SCENARIOS: SettingsScenario[] = [
  {
    name: 'macros6-lr-views-sv',
    settings: { views: { paths: [{ key: 'new', annotationPath: `${UI}.SelectionVariant#ViewNew` }, { key: 'ordered', annotationPath: `${UI}.SelectionVariant#ViewOrdered` }] } },
  },
  {
    name: 'macros6-lr-combined',
    settings: { views: { paths: [{ primary: [{ annotationPath: `${UI}.PresentationVariant#ByStatusChart` }], secondary: [{ annotationPath: `${UI}.LineItem` }] }] } },
    extra: { fe: feCombined, sk: skCombined },
    feExtra: { items: ['Chart and Table', 'Chart', 'Table'], selected: 'Chart and Table', chart: true, table: true },
  },
  {
    name: 'macros6-lr-combined-table',
    settings: { views: { paths: [{ primary: [{ annotationPath: `${UI}.PresentationVariant#ByStatusChart` }], secondary: [{ annotationPath: `${UI}.LineItem` }], defaultPath: 'secondary' }] } },
    extra: { fe: feCombined, sk: skCombined },
    feExtra: { selected: 'Table', chart: false, table: true },
  },
  {
    name: 'macros6-lr-chart-settings',
    settings: {
      views: { paths: [{ primary: [{ annotationPath: `${UI}.PresentationVariant#ByStatusChart` }], secondary: [{ annotationPath: `${UI}.LineItem` }] }] },
      controlConfiguration: { [`@${UI}.Chart#ByStatus`]: { chartSettings: { header: 'Status overview', personalization: { type: true } } } },
    },
    extra: { fe: feChartConfig, sk: skChartConfig },
    feExtra: { header: 'Status overview', type: true, settings: false },
  },
  {
    name: 'macros6-lr-default-template',
    settings: { defaultTemplateAnnotationPath: `${UI}.SelectionPresentationVariant#Open` },
  },
  {
    name: 'macros6-lr-header',
    settings: {
      content: {
        header: {
          customHeader: { expandedHeaderFragment: 'fe.ref.ext.ExpandedHeader', collapsedHeaderFragment: 'fe.ref.ext.CollapsedHeader' },
          actions: {
            alpha: { text: 'Alpha', press: 'fe.ref.ext.CustomActions.copy' },
            beta: { text: 'Beta', press: 'fe.ref.ext.CustomActions.copy', priority: 'AlwaysOverflow' },
            gamma: { text: 'Gamma', press: 'fe.ref.ext.CustomActions.copy', isPrimaryAction: true },
          },
        },
      },
    },
    extra: { fe: feHeader, sk: skHeader },
    feExtra: { inline: ['Gamma*', 'Alpha'], overflow: ['Beta'], expanded: ['Purchasing overview'], collapsed: ['Purchasing (collapsed)'] },
  },
  {
    // Table macro actionOverflowGroups / action overflowGroup (FE Action addSeparators): a separator before group 2
    name: 'macros6-lr-table-actions',
    settings: { controlConfiguration: { [LINE_ITEM]: {
      actions: {
        one: { text: 'One', press: 'fe.ref.ext.CustomActions.copy', overflowGroup: 1 },
        two: { text: 'Two', press: 'fe.ref.ext.CustomActions.copy', overflowGroup: 2 },
        three: { text: 'Three', press: 'fe.ref.ext.CustomActions.copy', overflowGroup: 2 },
      },
      overflowGroups: { 2: { showSeparator: true } },
    } } },
    extra: { fe: feTableSeparators, sk: skTableSeparators },
    feExtra: ['One', '|', 'Two', 'Three'],
  },
  {
    // Table macro massEdit (FE StandardActions MassEdit): an "Edit" button in the toolbar
    name: 'macros6-lr-mass-edit',
    settings: { controlConfiguration: { [LINE_ITEM]: { tableSettings: { enableMassEdit: true } } } },
  },
  {
    // FE _getTableMode: the list report ignores rowCountMode / rowCount (always "Auto", at least 3 rows): the table fills the
    // screen and reads threshold + ⌈window height / 25⌉
    name: 'macros6-lr-row-count',
    settings: { controlConfiguration: { [LINE_ITEM]: { tableSettings: { type: 'GridTable', rowCountMode: 'Fixed', rowCount: 5 } } } },
    extra: {
      fe: (page) => page.evaluate(() => ({ fixed5: (window as any).sap.ui.require('sap/ui/core/ElementRegistry').filter((e: any) => e.isA('sap.ui.mdc.Table') && e.getDomRef())[0]._oTable.getRows().length === 5 })),
      sk: (page) => page.evaluate(() => {
        const viewport = document.querySelector<HTMLElement>('[data-sk-table] .ag-body-viewport');
        const row = document.querySelector<HTMLElement>('[data-sk-table] .ag-center-cols-container .ag-row');
        return { fixed5: viewport && row ? Math.round(viewport.clientHeight / row.offsetHeight) === 5 : false };
      }),
    },
    feExtra: { fixed5: false },
  },
  {
    name: 'macros6-lr-vm-control',
    settings: { variantManagement: 'Control' },
    extra: { fe: feVms, sk: skVms },
  },
];

for (const s of SETTINGS_SCENARIOS) {
  test(`AL-13 FE comparison: ${s.name}`, async ({ browser }) => {
    const fe = await settingsSnapshot(browser, s, 'fe');
    const sk = await settingsSnapshot(browser, s, 'sk');
    compareScenario(s.name, fe.snap, sk.snap);
    if (s.feExtra !== undefined) expect(fe.extra, `${s.name}: FE`).toMatchObject(s.feExtra as Record<string, unknown>);
    if (s.extra) expect(sk.extra, `${s.name}: smart-kit`).toEqual(fe.extra);
  });
}
