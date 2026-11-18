/**
 * Fiori elements comparison of the stage 4 tail items (docs/29 §5, docs/30 §7.2, AL-10 – AL-12):
 * - Common.ValueListReferences / Common.ValueListMapping: the company code value help comes from the value help
 *   service `/odata/purchasing-vh/` (apps/mock/Csdl/purchasing-vh.xml). The reference is laid over the purchasing
 *   `$metadata` in the browser (`page.route`), identically for the FE reference app and the smart-kit demo `/po`, so the
 *   other scenarios keep a company code field without value help.
 * - Common.ResultContext and UI.SelectionVariant/Parameters: the parameterized entity set `SpendParameters` (results in
 *   `Set`) in the FE reference app `?app=purchasing-params` (contextPath `/SpendParameters/Set`) and the demo `/spend`.
 */
import { expect, test, type Browser, type Page } from '@playwright/test';
import type { Snapshot } from './compare';
import { FE, feFilter, MOCK, openFe, openSk, readFe, readSk, RequestRecorder, skFilter } from './collect';
import { compareScenario } from './harness';

type Side = 'fe' | 'sk';
type Overlay = (xml: string) => string;

/** Adds `<Annotations>` elements at the end of the Purchasing schema. */
function addAnnotations(xml: string, annotations: string): string {
  const schema = xml.indexOf('<Schema Namespace="Purchasing"');
  const end = xml.indexOf('</Schema>', schema);
  expect(end).toBeGreaterThan(0);
  return `${xml.slice(0, end)}${annotations}\n    ${xml.slice(end)}`;
}

/** Common.ValueListReferences on the company code of the orders (relative to the purchasing $metadata URL). */
const REFERENCES: Overlay = (xml) =>
  addAnnotations(xml, `
      <Annotations Target="Purchasing.PurchaseOrder/CompanyCode">
        <Annotation Term="Common.ValueListReferences"><Collection><String>../purchasing-vh/$metadata</String></Collection></Annotation>
      </Annotations>`);

const NONE: Overlay = (xml) => xml;

async function overlay(page: Page, change: Overlay) {
  if (change === NONE) return;
  // read from the test service directly: route.fetch rejects the FE app's proxied response (Content-Length and
  // Transfer-Encoding); the purchasing (non-draft) metadata is not changed by that proxy
  await page.route(/\/odata\/purchasing\/\$metadata/, async (route) => {
    const url = new URL(route.request().url());
    const headers = await route.request().allHeaders();
    const res = await fetch(`${MOCK}${url.pathname}${url.search}`, { headers: { 'accept-language': headers['accept-language'] ?? 'en' } });
    await route.fulfill({ status: res.status, contentType: res.headers.get('content-type') ?? 'application/xml', body: change(await res.text()) });
  });
}

// ---------------------------------------------------------------------------------------------- steps

async function feFieldId(page: Page, propertyKey: string): Promise<string> {
  const id = await page.evaluate((key) => {
    const w = window as unknown as { sap: { ui: { require(n: string): { filter(f: (e: { isA(t: string): boolean }) => boolean): { getPropertyKey(): string; getId(): string }[] } } } };
    return w.sap.ui.require('sap/ui/core/ElementRegistry').filter((e) => e.isA('sap.ui.mdc.FilterField')).find((f) => f.getPropertyKey() === key)?.getId();
  }, propertyKey);
  expect(id, `FE filter field ${propertyKey}`).toBeTruthy();
  return id!;
}

async function feTokens(page: Page, propertyKey: string): Promise<string[]> {
  const id = await feFieldId(page, propertyKey);
  return (await page.locator(`[id="${id}"] .sapMToken .sapMTokenText`).allInnerTexts()).map((s) => s.trim());
}

async function skTokens(page: Page, path: string): Promise<string[]> {
  return (await page.locator(`[data-sk-filter="${path}"] .mantine-Pill-label`).allInnerTexts()).map((s) => s.trim());
}

async function feOpenValueHelp(page: Page, propertyKey: string) {
  const id = await feFieldId(page, propertyKey);
  await page.locator(`[id="${id}-inner-vhi"]`).click();
  await expect(page.locator('.sapMDialog').getByRole('gridcell').first()).not.toBeEmpty({ timeout: 30_000 });
}

async function skOpenValueHelp(page: Page, path: string) {
  await page.locator(`[data-sk-filter="${path}"]`).getByRole('button', { name: 'Show value help' }).click();
  await expect(page.getByRole('dialog').getByRole('checkbox').first()).toBeVisible({ timeout: 30_000 });
}

/** Column headers and the first rows of the open value help dialog's table. */
async function feDialogTable(page: Page): Promise<{ columns: string[]; rows: string[][] }> {
  return page.evaluate(() => {
    /* eslint-disable @typescript-eslint/no-explicit-any -- the UI5 control tree is untyped here */
    const w = window as any;
    const table = w.sap.ui.require('sap/ui/core/ElementRegistry').filter((e: any) => e.isA('sap.ui.table.Table')).find((t: any) => t.getDomRef()?.closest('.sapMDialog'));
    const cols = table.getColumns().filter((c: any) => c.getVisible());
    const columns = cols.map((c: any) => String(c.getLabel()?.getText?.() ?? c.getLabel() ?? ''));
    const rows = table.getRows().filter((r: any) => r.getBindingContext()).map((r: any) => r.getCells().map((c: any) => (c.getDomRef()?.textContent ?? '').trim()));
    return { columns, rows };
    /* eslint-enable @typescript-eslint/no-explicit-any */
  });
}

async function skDialogTable(page: Page): Promise<{ columns: string[]; rows: string[][] }> {
  const dialog = page.getByRole('dialog');
  const columns = (await dialog.locator('table thead th').allInnerTexts()).map((s) => s.trim()).filter(Boolean);
  const rows: string[][] = [];
  for (const tr of await dialog.locator('table tbody tr').all()) rows.push((await tr.locator('td').allInnerTexts()).map((s) => s.trim()).filter((_, i) => i > 0));
  return { columns, rows };
}

/** FE: searches `key` in the open value help dialog, selects the first row and confirms with OK (as filter4.spec.ts). */
async function feChoose(page: Page, key: string) {
  const box = page.locator('.sapMDialog').getByRole('searchbox');
  await box.fill(key);
  await box.press('Enter');
  await expect(page.locator('.sapMDialog').getByRole('gridcell', { name: new RegExp(`\\(${key}\\)`) })).toBeVisible({ timeout: 30_000 });
  const tokens = page.locator('.sapMDialog .sapMTokenizer .sapMToken');
  const before = await tokens.count();
  await page.locator('.sapMDialog .sapUiTableRowSelectionCell:not(.sapUiTableHeaderCell)').first().click();
  await expect(tokens).toHaveCount(before + 1);
  await page.locator('.sapMDialog').getByRole('button', { name: 'OK', exact: true }).click();
}

async function skChoose(page: Page, key: string) {
  const dialog = page.getByRole('dialog');
  const box = dialog.getByRole('textbox', { name: 'Search' });
  await box.fill(key);
  await box.press('Enter');
  await expect(dialog.locator('table tbody tr')).toHaveCount(1);
  await dialog.locator('table tbody tr').getByRole('checkbox').click();
  await dialog.getByRole('button', { name: 'OK' }).click();
  await expect(dialog).toHaveCount(0);
}

async function feWaitRows(page: Page) {
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

// ---------------------------------------------------------------------------------------------- scenarios

interface Scenario {
  name: string;
  overlay: Overlay;
  /** FE app (?app=) and smart-kit demo route. */
  fe: 'purchasing' | 'purchasing-params';
  sk: string;
  act?: { fe(page: Page): Promise<void>; sk(page: Page): Promise<void> };
  extra?: { fe(page: Page): Promise<unknown>; sk(page: Page): Promise<unknown> };
  /** Only the requests to this service root are compared (e.g. the value help service). */
  service?: string;
}

const VH = '/odata/purchasing-vh/';

const SCENARIOS: Scenario[] = [
  // the default condition of the company code (SelectionVariant): its text is read from the value help service
  {
    name: 'vhref-initial',
    overlay: REFERENCES,
    fe: 'purchasing',
    sk: '/po',
    extra: { fe: (page) => feTokens(page, 'CompanyCode'), sk: (page) => skTokens(page, 'CompanyCode') },
    service: VH,
  },
  // type-ahead: the suggestions come from the value help service
  {
    name: 'vhref-typeahead',
    overlay: REFERENCES,
    fe: 'purchasing',
    sk: '/po',
    act: { fe: (page) => feType(page, 'CompanyCode', '20'), sk: (page) => skType(page, 'CompanyCode', '20') },
    service: VH,
  },
  // value help dialog of a property with Common.ValueListReferences: $metadata of the value help service, its
  // ValueListMapping, the dialog's request to the value help service and its columns
  {
    name: 'vhref-dialog',
    overlay: REFERENCES,
    fe: 'purchasing',
    sk: '/po',
    act: { fe: (page) => feOpenValueHelp(page, 'CompanyCode'), sk: (page) => skOpenValueHelp(page, 'CompanyCode') },
    extra: { fe: feDialogTable, sk: skDialogTable },
    service: VH,
  },
  // choosing a value in the dialog: the token text comes from the mapping's description (Common.Text of the key)
  {
    name: 'vhref-token',
    overlay: REFERENCES,
    fe: 'purchasing',
    sk: '/po',
    act: {
      fe: async (page) => { await feOpenValueHelp(page, 'CompanyCode'); await feChoose(page, '2000'); },
      sk: async (page) => { await skOpenValueHelp(page, 'CompanyCode'); await skChoose(page, '2000'); },
    },
    extra: { fe: (page) => feTokens(page, 'CompanyCode'), sk: (page) => skTokens(page, 'CompanyCode') },
  },
  // a typed value: checked against (and described by) the value help service
  {
    name: 'vhref-typed',
    overlay: REFERENCES,
    fe: 'purchasing',
    sk: '/po',
    act: { fe: (page) => feFilter(page, 'CompanyCode', '3000'), sk: (page) => skFilter(page, 'CompanyCode', '3000') },
    extra: { fe: (page) => feTokens(page, 'CompanyCode'), sk: (page) => skTokens(page, 'CompanyCode') },
  },
  // parameterized entity set: parameters first as mandatory fields, defaults from UI.SelectionVariant/Parameters,
  // request /SpendParameters(P_DisplayCurrency='EUR',P_KeyDate=2026-11-14)/Set
  { name: 'params-initial', overlay: NONE, fe: 'purchasing-params', sk: '/spend' },
  // a changed parameter and a normal filter: the parameter goes into the path, the filter into $filter
  {
    name: 'params-change',
    overlay: NONE,
    fe: 'purchasing-params',
    sk: '/spend',
    act: {
      // one change after the other (each one is applied in live mode before the next)
      fe: async (page) => { await feParameter(page, 'P_DisplayCurrency', 'USD'); await page.waitForTimeout(1500); await feFilter(page, 'Country', 'DE'); },
      sk: async (page) => { await skParameter(page, 'P_DisplayCurrency', 'USD'); await page.waitForTimeout(1500); await skFilter(page, 'Country', 'DE'); },
    },
  },
];

/** FE: types into a filter field without confirming (type-ahead). */
async function feType(page: Page, key: string, text: string) {
  const id = await feFieldId(page, key);
  const input = page.locator(`[id="${id}"] input`).first();
  await input.click();
  await input.pressSequentially(text, { delay: 50 });
  await page.waitForTimeout(1500);
}

async function skType(page: Page, path: string, text: string) {
  const input = page.locator(`[data-sk-filter="${path}"] input:not([type="hidden"])`).first();
  await input.click();
  await input.pressSequentially(text, { delay: 50 });
  await page.waitForTimeout(1500);
}

/** FE: replaces the value of a single-value parameter field. */
async function feParameter(page: Page, key: string, value: string) {
  const id = await feFieldId(page, key);
  const input = page.locator(`[id="${id}"] input`).first();
  await input.click();
  await input.fill(value);
  await input.press('Enter');
}

async function skParameter(page: Page, key: string, value: string) {
  const input = page.locator(`[data-sk-filter="${key}"] input:not([type="hidden"])`).first();
  await input.click();
  await input.fill(value);
  await input.press('Enter');
}

async function snapshot(browser: Browser, s: Scenario, side: Side): Promise<Snapshot & { extra?: unknown }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    if (process.env.VHREF_DEBUG) page.on('console', (m) => { if (m.type() === 'error') console.log(`[${side}] ${m.text().slice(0, 400)}`); });
    await overlay(page, s.overlay);
    expect((await page.request.post(`${MOCK}/test/reset`)).ok()).toBeTruthy();
    const rec = new RequestRecorder(page);
    if (side === 'fe') {
      if (s.fe === 'purchasing') await openFe(page, 'purchasing');
      else {
        await page.goto(`${FE}/index.html?app=${s.fe}`);
        await feWaitRows(page);
      }
    } else await openSk(page, s.sk);
    await rec.idle(page);
    if (s.act) {
      rec.reset();
      await s.act[side](page);
      await page.waitForTimeout(500);
      await rec.idle(page);
      await page.waitForTimeout(800);
    }
    const extra = s.extra ? await s.extra[side](page) : undefined;
    if (extra !== undefined) await page.keyboard.press('Escape');
    const { structure, text } = side === 'fe' ? await readFe(page) : await readSk(page);
    const requests = s.service ? rec.requests.filter((r) => r.service === s.service) : rec.requests;
    return { requests, structure, text, extra };
  } finally {
    await context.close();
  }
}

for (const s of SCENARIOS) {
  test(`AL-10 AL-11 AL-12 FE comparison: ${s.name}`, async ({ browser }) => {
    const fe = await snapshot(browser, s, 'fe');
    if (process.env.VHREF_PROBE) {
      console.log(JSON.stringify({ scenario: s.name, fe: fe.requests, extra: fe.extra, feS: fe.structure, text: fe.text.slice(0, 2) }, null, 1));
      return;
    }
    const sk = await snapshot(browser, s, 'sk');
    if (process.env.VHREF_DEBUG) console.log(JSON.stringify({ scenario: s.name, fe: fe.requests, sk: sk.requests, feX: fe.extra, skX: sk.extra, feS: fe.structure, skS: sk.structure, feT: fe.text.slice(0, 2), skT: sk.text.slice(0, 2) }, null, 1));
    expect(fe.text.length, 'FE rows').toBeGreaterThan(0);
    expect(sk.text.length, 'smart-kit rows').toBeGreaterThan(0);
    if (s.extra) expect(sk.extra, 'tokens / value help table').toEqual(fe.extra);
    compareScenario(s.name, fe, sk);
  });
}
