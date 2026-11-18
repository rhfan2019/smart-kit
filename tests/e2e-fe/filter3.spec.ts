/**
 * Fiori elements comparison of filter defaults and value help parameters (docs/29 §4 P1-4, P1-5, P1-7, P1-8;
 * docs/30 §7.2, AL-10 – AL-12). The annotations each scenario needs are laid over the purchasing `$metadata` in
 * the browser, identically for the FE reference app and the smart-kit demo (`page.route`), so the shared test
 * service and the other scenarios stay unchanged.
 */
import { expect, test, type Browser, type Page } from '@playwright/test';
import type { Snapshot } from './compare';
import { feFilter, MOCK, openFe, openSk, readFe, readSk, RequestRecorder, skFilter } from './collect';
import { compareScenario } from './harness';

// ---------------------------------------------------------------------------------------------- $metadata overlay

/** Removes the first `<Annotation Term="…">` (exact, so unqualified) inside `<Annotations Target="…">`. */
function removeAnnotation(xml: string, target: string, term: string): string {
  const at = xml.indexOf(`<Annotations Target="${target}">`);
  const start = at < 0 ? -1 : xml.indexOf(`<Annotation Term="${term}">`, at);
  const end = start < 0 ? -1 : xml.indexOf('</Annotation>', start);
  expect(end, `${target} ${term}`).toBeGreaterThan(0);
  return xml.slice(0, start) + xml.slice(end + '</Annotation>'.length);
}

/** Adds `<Annotations>` elements at the end of the Purchasing schema. */
function addAnnotations(xml: string, annotations: string): string {
  const schema = xml.indexOf('<Schema Namespace="Purchasing"');
  const end = xml.indexOf('</Schema>', schema);
  expect(end).toBeGreaterThan(0);
  return `${xml.slice(0, end)}${annotations}\n    ${xml.slice(end)}`;
}

type Overlay = (xml: string) => string;

/** P1-4: no default UI.SelectionVariant; Common.FilterDefaultValue on a selection field and on a field outside SelectionFields. */
const FILTER_DEFAULTS: Overlay = (xml) =>
  addAnnotations(removeAnnotation(xml, 'Purchasing.PurchaseOrder', 'UI.SelectionVariant'), `
      <Annotations Target="Purchasing.PurchaseOrder/CompanyCode"><Annotation Term="Common.FilterDefaultValue" String="1000"/></Annotations>
      <Annotations Target="Purchasing.PurchaseOrder/PurchasingGroup"><Annotation Term="Common.FilterDefaultValue" String="P01"/></Annotations>`);

/** P1-7: the entity set does not say whether it is searchable. */
const NO_SEARCH_RESTRICTIONS: Overlay = (xml) => removeAnnotation(xml, 'Purchasing.Container/PurchaseOrders', 'Capabilities.SearchRestrictions');

/** P1-8: order number and company code are digit sequences (NUMC). */
const DIGIT_SEQUENCE: Overlay = (xml) =>
  addAnnotations(xml, `
      <Annotations Target="Purchasing.PurchaseOrder/PurchaseOrder"><Annotation Term="Common.IsDigitSequence" Bool="true"/></Annotations>
      <Annotations Target="Purchasing.PurchaseOrder/CompanyCode"><Annotation Term="Common.IsDigitSequence" Bool="true"/></Annotations>`);

/**
 * P1-5: a value help on the order number from the orders themselves: In CompanyCode, Constant Currency, Out Supplier,
 * no SearchSupported (default true).
 */
const VALUE_HELP_PARAMETERS: Overlay = (xml) =>
  addAnnotations(xml, `
      <Annotations Target="Purchasing.PurchaseOrder/PurchaseOrder">
        <Annotation Term="Common.ValueList">
          <Record Type="Common.ValueListType">
            <PropertyValue Property="Label" String="Purchase Orders"/>
            <PropertyValue Property="CollectionPath" String="PurchaseOrders"/>
            <PropertyValue Property="Parameters">
              <Collection>
                <Record Type="Common.ValueListParameterInOut"><PropertyValue Property="LocalDataProperty" PropertyPath="PurchaseOrder"/><PropertyValue Property="ValueListProperty" String="PurchaseOrder"/></Record>
                <Record Type="Common.ValueListParameterIn"><PropertyValue Property="LocalDataProperty" PropertyPath="CompanyCode"/><PropertyValue Property="ValueListProperty" String="CompanyCode"/></Record>
                <Record Type="Common.ValueListParameterConstant"><PropertyValue Property="ValueListProperty" String="Currency"/><PropertyValue Property="Constant" String="EUR"/></Record>
                <Record Type="Common.ValueListParameterOut"><PropertyValue Property="LocalDataProperty" PropertyPath="Supplier"/><PropertyValue Property="ValueListProperty" String="Supplier"/></Record>
                <Record Type="Common.ValueListParameterDisplayOnly"><PropertyValue Property="ValueListProperty" String="Description"/></Record>
              </Collection>
            </PropertyValue>
          </Record>
        </Annotation>
      </Annotations>`);

async function overlay(page: Page, change: Overlay) {
  // read from the test service directly: the FE app's proxy answers with Content-Length and Transfer-Encoding,
  // which route.fetch rejects; the purchasing (non-draft) metadata is not changed by that proxy
  await page.route(/\/odata\/purchasing\/\$metadata/, async (route) => {
    const url = new URL(route.request().url());
    const headers = await route.request().allHeaders();
    const res = await fetch(`${MOCK}${url.pathname}${url.search}`, { headers: { 'accept-language': headers['accept-language'] ?? 'en' } });
    await route.fulfill({ status: res.status, contentType: res.headers.get('content-type') ?? 'application/xml', body: change(await res.text()) });
  });
}

// ---------------------------------------------------------------------------------------------- value help steps

/** FE: opens the value help dialog of a filter field (by property key) and waits for its table rows. */
async function feOpenValueHelp(page: Page, propertyKey: string) {
  const id = await page.evaluate((key) => {
    const w = window as unknown as { sap: { ui: { require(n: string): { filter(f: (e: { isA(t: string): boolean }) => boolean): { getPropertyKey(): string; getId(): string }[] } } } };
    return w.sap.ui.require('sap/ui/core/ElementRegistry').filter((e) => e.isA('sap.ui.mdc.FilterField')).find((f) => f.getPropertyKey() === key)?.getId();
  }, propertyKey);
  expect(id, `FE filter field ${propertyKey}`).toBeTruthy();
  await page.locator(`[id="${id}-inner-vhi"]`).click();
  // the dialog's list is a grid table; wait for its first data cell
  await expect(page.locator('.sapMDialog').getByRole('gridcell').first()).not.toBeEmpty({ timeout: 30_000 });
}

/**
 * FE: selects the first row of the open value help dialog and confirms with OK. In live mode FE applies the
 * selection (and its Out parameters) to the filter bar right away; the dialog may still be closing afterwards.
 */
async function feChooseFirst(page: Page, search: string) {
  // search first (SearchSupported is not annotated: default true, so FE sends $search), then the first row is the same in both apps
  const box = page.locator('.sapMDialog').getByRole('searchbox');
  await box.fill(search);
  await box.press('Enter');
  await expect(page.locator('.sapMDialog').getByRole('gridcell', { name: search })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.sapMDialog').getByRole('gridcell', { name: /^45000/ })).toHaveCount(1);
  // the row selector of the first data row (grid table, multi selection)
  const selector = page.locator('.sapMDialog .sapUiTableRowSelectionCell:not(.sapUiTableHeaderCell)').first();
  await expect(selector).toBeVisible({ timeout: 30_000 });
  await selector.click();
  await expect(page.locator('.sapMDialog .sapMTokenizer .sapMToken').first()).toBeVisible();
  await page.locator('.sapMDialog').getByRole('button', { name: 'OK', exact: true }).click();
}

async function skOpenValueHelp(page: Page, path: string) {
  await page.locator(`[data-sk-filter="${path}"]`).getByRole('button', { name: 'Show value help' }).click();
  await expect(page.getByRole('dialog').getByRole('checkbox').first()).toBeVisible({ timeout: 30_000 });
}

async function skChooseFirst(page: Page, search: string) {
  const dialog = page.getByRole('dialog');
  const box = dialog.getByRole('textbox', { name: 'Search' });
  await box.fill(search);
  await box.press('Enter');
  await expect(dialog.getByRole('checkbox')).toHaveCount(1);
  await dialog.getByRole('checkbox').first().click();
  await dialog.getByRole('button', { name: 'OK' }).click();
  await expect(dialog).toHaveCount(0);
}

// ---------------------------------------------------------------------------------------------- scenarios

interface Scenario {
  name: string;
  overlay: Overlay;
  /** Optional interaction; only the requests sent after it are compared. */
  act?: { fe(page: Page): Promise<void>; sk(page: Page): Promise<void> };
  /** The table may legitimately be empty after the interaction. */
  noRows?: boolean;
}

/** A term that finds exactly one order in the value help (its number). */
const VH_SEARCH = '4500002573';

const SCENARIOS: Scenario[] = [
  // P1-4: first request and filter fields come from Common.FilterDefaultValue
  { name: 'filter3-filter-default-value', overlay: FILTER_DEFAULTS },
  // P1-7: the basic search is shown although SearchRestrictions is missing
  { name: 'filter3-search-default', overlay: NO_SEARCH_RESTRICTIONS },
  // P1-8: typed digits are padded to MaxLength / lose their leading zeros
  {
    name: 'filter3-digit-sequence',
    overlay: DIGIT_SEQUENCE,
    act: {
      fe: async (page) => { await feFilter(page, 'PurchaseOrder', '04500002573'); await page.waitForTimeout(500); await feFilter(page, 'CompanyCode', '100'); },
      sk: async (page) => { await skFilter(page, 'PurchaseOrder', '04500002573'); await page.waitForTimeout(500); await skFilter(page, 'CompanyCode', '100'); },
    },
  },
  // P1-5: the value help request is filtered by In (CompanyCode from the filter bar) and Constant (Currency)
  {
    name: 'filter3-vh-in-constant',
    overlay: VALUE_HELP_PARAMETERS,
    act: { fe: (page) => feOpenValueHelp(page, 'PurchaseOrder'), sk: (page) => skOpenValueHelp(page, 'PurchaseOrder') },
  },
  // P1-5: choosing a row writes the Out parameter (Supplier) to the filter bar; the list request filters by both
  {
    name: 'filter3-vh-out',
    overlay: VALUE_HELP_PARAMETERS,
    act: {
      fe: async (page) => { await feOpenValueHelp(page, 'PurchaseOrder'); await feChooseFirst(page, VH_SEARCH); },
      sk: async (page) => { await skOpenValueHelp(page, 'PurchaseOrder'); await skChooseFirst(page, VH_SEARCH); },
    },
  },
];

async function snapshot(browser: Browser, s: Scenario, side: 'fe' | 'sk'): Promise<Snapshot> {
  // a fresh context per side: no shared storage (variants, page state) between the two apps
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    if (process.env.FILTER3_DEBUG) page.on('console', (m) => { if (m.type() === 'error') console.log(`[${side}] ${m.text().slice(0, 400)}`); });
    await overlay(page, s.overlay);
    expect((await page.request.post(`${MOCK}/test/reset`)).ok()).toBeTruthy();
    const rec = new RequestRecorder(page);
    if (side === 'fe') await openFe(page, 'purchasing');
    else await openSk(page, '/po');
    await rec.idle(page);
    if (s.act) {
      rec.reset();
      await s.act[side](page);
      await page.waitForTimeout(300);
      await rec.idle(page);
    }
    // the value help dialog may still be open: read the list report behind it
    const { structure, text } = side === 'fe' ? await readFe(page) : await readSk(page);
    return { requests: rec.requests, structure, text };
  } finally {
    await context.close();
  }
}

for (const s of SCENARIOS) {
  test(`AL-10 AL-11 AL-12 FE comparison: ${s.name}`, async ({ browser }) => {
    const fe = await snapshot(browser, s, 'fe');
    const sk = await snapshot(browser, s, 'sk');
    if (process.env.FILTER3_DEBUG) console.log(JSON.stringify({ scenario: s.name, fe: fe.requests, sk: sk.requests, feS: fe.structure, skS: sk.structure }, null, 1));
    if (!s.noRows) {
      expect(fe.text.length, 'FE rows').toBeGreaterThan(0);
      expect(sk.text.length, 'smart-kit rows').toBeGreaterThan(0);
    }
    compareScenario(s.name, fe, sk);
  });
}
