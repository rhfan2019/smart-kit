/**
 * Fiori elements comparison of the filter bar and value help annotations of docs/29 §5 (stage 4, AL-10 – AL-12):
 * Capabilities.FilterExpressionRestrictions (strictest record), semantic date operators, UI.HiddenFilter / UI.Hidden
 * with default conditions, Capabilities.FilterFunctions (tolower), the value help description column, filter tokens
 * with TextSeparate, the value help dialog request and the description read after an Out parameter.
 * The annotations each scenario needs are laid over the purchasing `$metadata` in the browser, identically for the FE
 * reference app and the smart-kit demo (`page.route`), so the shared test service and the other scenarios stay unchanged.
 */
import { expect, test, type Browser, type Page } from '@playwright/test';
import type { Snapshot } from './compare';
import { feFilter, MOCK, openFe, openSk, readFe, readSk, RequestRecorder, skFilter } from './collect';
import { compareScenario } from './harness';

// ---------------------------------------------------------------------------------------------- $metadata overlay

type Overlay = (xml: string) => string;

/** Adds `<Annotations>` elements at the end of the Purchasing schema. */
function addAnnotations(xml: string, annotations: string): string {
  const schema = xml.indexOf('<Schema Namespace="Purchasing"');
  const end = xml.indexOf('</Schema>', schema);
  expect(end).toBeGreaterThan(0);
  return `${xml.slice(0, end)}${annotations}\n    ${xml.slice(end)}`;
}

/** Replaces the first occurrence of `from` after `<Annotations Target="target">`. */
function replaceIn(xml: string, target: string, from: string, to: string): string {
  const at = xml.indexOf(`<Annotations Target="${target}">`);
  const i = at < 0 ? -1 : xml.indexOf(from, at);
  expect(i, `${target}: ${from}`).toBeGreaterThan(0);
  return xml.slice(0, i) + to + xml.slice(i + from.length);
}

const range = (prop: string, option: string, low: string) => `
                <Record Type="UI.SelectOptionType">
                  <PropertyValue Property="PropertyName" PropertyPath="${prop}"/>
                  <PropertyValue Property="Ranges"><Collection><Record Type="UI.SelectionRangeType">
                    <PropertyValue Property="Sign" EnumMember="UI.SelectionRangeSignType/I"/>
                    <PropertyValue Property="Option" EnumMember="UI.SelectionRangeOptionType/${option}"/>
                    <PropertyValue Property="Low" String="${low}"/>
                  </Record></Collection></PropertyValue>
                </Record>`;

/** Adds select options to the default UI.SelectionVariant of the orders. */
function addSelectOptions(xml: string, options: string): string {
  const at = xml.indexOf('<Annotation Term="UI.SelectionVariant">');
  const so = xml.indexOf('<PropertyValue Property="SelectOptions">', at);
  const col = xml.indexOf('<Collection>', so) + '<Collection>'.length;
  expect(at).toBeGreaterThan(0);
  return xml.slice(0, col) + options + xml.slice(col);
}

/** Strictest FilterExpressionRestrictions: CompanyCode has a SingleValue and a MultiValue record (FE takes SingleValue). */
const STRICTEST: Overlay = (xml) =>
  replaceIn(xml, 'Purchasing.Container/PurchaseOrders', '<PropertyValue Property="FilterExpressionRestrictions">\n              <Collection>', `<PropertyValue Property="FilterExpressionRestrictions">
              <Collection>
                <Record Type="Capabilities.FilterExpressionRestrictionType"><PropertyValue Property="Property" PropertyPath="CompanyCode"/><PropertyValue Property="AllowedExpressions" String="SingleValue"/></Record>
                <Record Type="Capabilities.FilterExpressionRestrictionType"><PropertyValue Property="Property" PropertyPath="CompanyCode"/><PropertyValue Property="AllowedExpressions" String="MultiValue"/></Record>`);

/** HiddenFilter on Currency and Hidden on PurchasingGroup, both with a default condition in the selection variant. */
const HIDDEN_DEFAULTS: Overlay = (xml) =>
  addSelectOptions(addAnnotations(xml, `
      <Annotations Target="Purchasing.PurchaseOrder/Currency"><Annotation Term="UI.HiddenFilter" Bool="true"/></Annotations>
      <Annotations Target="Purchasing.PurchaseOrder/PurchasingGroup"><Annotation Term="UI.Hidden" Bool="true"/></Annotations>`),
  range('Currency', 'EQ', 'EUR') + range('PurchasingGroup', 'EQ', 'P01'));

/** Capabilities.FilterFunctions with tolower on the entity container: string filters are case-insensitive. */
const TOLOWER: Overlay = (xml) =>
  addAnnotations(xml, `
      <Annotations Target="Purchasing.Container"><Annotation Term="Capabilities.FilterFunctions"><Collection><String>tolower</String><String>contains</String></Collection></Annotation></Annotations>`);

/**
 * Supplier value help with Country as the first DisplayOnly parameter: FE takes the description from the Common.Text
 * of the value help key (SupplierName), not from the first DisplayOnly parameter.
 */
const VH_DESCRIPTION: Overlay = (xml) =>
  replaceIn(xml, 'Purchasing.PurchaseOrder/Supplier', `<Record Type="Common.ValueListParameterDisplayOnly">
                  <PropertyValue Property="ValueListProperty" String="SupplierName"/>
                </Record>`, `<Record Type="Common.ValueListParameterDisplayOnly">
                  <PropertyValue Property="ValueListProperty" String="Country"/>
                </Record>
                <Record Type="Common.ValueListParameterDisplayOnly">
                  <PropertyValue Property="ValueListProperty" String="SupplierName"/>
                </Record>`);

/** The supplier filter tokens with TextSeparate: FE shows the code only. */
const TEXT_SEPARATE: Overlay = (xml) =>
  replaceIn(xml, 'Purchasing.PurchaseOrder/Supplier', 'UI.TextArrangementType/TextFirst', 'UI.TextArrangementType/TextSeparate');

/** P1-5 value help of filter3 (In CompanyCode, Constant Currency, Out Supplier). */
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

const NONE: Overlay = (xml) => xml;

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

// ---------------------------------------------------------------------------------------------- steps

async function feFieldId(page: Page, propertyKey: string): Promise<string> {
  const id = await page.evaluate((key) => {
    const w = window as unknown as { sap: { ui: { require(n: string): { filter(f: (e: { isA(t: string): boolean }) => boolean): { getPropertyKey(): string; getId(): string }[] } } } };
    return w.sap.ui.require('sap/ui/core/ElementRegistry').filter((e) => e.isA('sap.ui.mdc.FilterField')).find((f) => f.getPropertyKey() === key)?.getId();
  }, propertyKey);
  expect(id, `FE filter field ${propertyKey}`).toBeTruthy();
  return id!;
}

/** FE: the token texts of a filter field (by property key). */
async function feTokens(page: Page, propertyKey: string): Promise<string[]> {
  const id = await feFieldId(page, propertyKey);
  return (await page.locator(`[id="${id}"] .sapMToken .sapMTokenText`).allInnerTexts()).map((s) => s.trim());
}

async function skTokens(page: Page, path: string): Promise<string[]> {
  return (await page.locator(`[data-sk-filter="${path}"] .mantine-Pill-label`).allInnerTexts()).map((s) => s.trim());
}

/** FE: opens the value help dialog of a filter field and waits for its table rows. */
async function feOpenValueHelp(page: Page, propertyKey: string) {
  const id = await feFieldId(page, propertyKey);
  await page.locator(`[id="${id}-inner-vhi"]`).click();
  await expect(page.locator('.sapMDialog').getByRole('gridcell').first()).not.toBeEmpty({ timeout: 30_000 });
}

async function skOpenValueHelp(page: Page, path: string) {
  await page.locator(`[data-sk-filter="${path}"]`).getByRole('button', { name: 'Show value help' }).click();
  await expect(page.getByRole('dialog').getByRole('checkbox').first()).toBeVisible({ timeout: 30_000 });
}

/** FE: selects the first row of the open value help dialog (after a search) and confirms with OK. */
async function feChooseFirst(page: Page, search: string) {
  const box = page.locator('.sapMDialog').getByRole('searchbox');
  await box.fill(search);
  await box.press('Enter');
  await expect(page.locator('.sapMDialog').getByRole('gridcell', { name: search })).toBeVisible({ timeout: 30_000 });
  const selector = page.locator('.sapMDialog .sapUiTableRowSelectionCell:not(.sapUiTableHeaderCell)').first();
  await expect(selector).toBeVisible({ timeout: 30_000 });
  await selector.click();
  await expect(page.locator('.sapMDialog .sapMTokenizer .sapMToken').first()).toBeVisible();
  await page.locator('.sapMDialog').getByRole('button', { name: 'OK', exact: true }).click();
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

/** FE: types into the DynamicDateRange of a date filter field (e.g. "Last 2 weeks") and applies it. */
async function feDate(page: Page, propertyKey: string, text: string) {
  const id = await feFieldId(page, propertyKey);
  const input = page.locator(`[id="${id}"] input`).first();
  await input.click();
  await input.fill(text);
  await input.press('Enter');
}

/** smart-kit: picks a relative date option of a date filter field ("Last X weeks" with a count). */
async function skRelativeDate(page: Page, path: string, operator: string, count?: number) {
  await page.locator(`[data-sk-filter="${path}"] [data-sk-relative-dates]`).click();
  if (count !== undefined) await page.locator(`[data-sk-relative-count="${operator}"]`).fill(String(count));
  await page.locator(`[data-sk-relative-date="${operator}"]`).click();
}

// ---------------------------------------------------------------------------------------------- scenarios

interface Extra {
  fe(page: Page): Promise<unknown>;
  sk(page: Page): Promise<unknown>;
}

interface Scenario {
  name: string;
  overlay: Overlay;
  /** Optional interaction; only the requests sent after it are compared. */
  act?: { fe(page: Page): Promise<void>; sk(page: Page): Promise<void> };
  /** Something read after the interaction, compared as is (tokens, value help columns). */
  extra?: Extra;
  noRows?: boolean;
}

const VH_SEARCH = '4500002573';
const SUPPLIER = '0000100175';

const SCENARIOS: Scenario[] = [
  // strictest of two FilterExpressionRestrictions (SingleValue): a second company code replaces the first
  {
    name: 'filter4-expression-strictest',
    overlay: STRICTEST,
    act: { fe: (page) => feFilter(page, 'CompanyCode', '2000'), sk: (page) => skFilter(page, 'CompanyCode', '2000') },
    noRows: true,
  },
  // FE semantic date operators on the SingleRange date (DynamicDateRange): Last 2 weeks
  {
    name: 'filter4-date-last-weeks',
    overlay: NONE,
    act: { fe: (page) => feDate(page, 'OrderDate', 'Last 2 weeks'), sk: (page) => skRelativeDate(page, 'OrderDate', 'LASTWEEKS', 2) },
    noRows: true,
  },
  // HiddenFilter / Hidden fields with a default condition stay hidden, the conditions still filter
  { name: 'filter4-hidden-defaults', overlay: HIDDEN_DEFAULTS, noRows: true },
  // Capabilities.FilterFunctions tolower: string conditions are case-insensitive
  {
    name: 'filter4-tolower',
    overlay: TOLOWER,
    act: { fe: (page) => feFilter(page, 'PurchaseOrder', '4500002573'), sk: (page) => skFilter(page, 'PurchaseOrder', '4500002573') },
  },
  // value help dialog: description column from the Common.Text of the value help key
  {
    name: 'filter4-vh-description',
    overlay: VH_DESCRIPTION,
    act: {
      fe: async (page) => { await feOpenValueHelp(page, 'Supplier'); await feChooseFirst(page, SUPPLIER); },
      sk: async (page) => { await skOpenValueHelp(page, 'Supplier'); await skChooseFirst(page, SUPPLIER); },
    },
    extra: { fe: (page) => feTokens(page, 'Supplier'), sk: (page) => skTokens(page, 'Supplier') },
  },
  // value help dialog request ($select of the value help entity's SelectionFields, $orderby of its PresentationVariant)
  {
    name: 'filter4-vh-dialog-request',
    overlay: VALUE_HELP_PARAMETERS,
    act: { fe: (page) => feOpenValueHelp(page, 'PurchaseOrder'), sk: (page) => skOpenValueHelp(page, 'PurchaseOrder') },
  },
  // Out parameter written back: the supplier's description is read for its token
  {
    name: 'filter4-vh-out-description',
    overlay: VALUE_HELP_PARAMETERS,
    act: {
      fe: async (page) => { await feOpenValueHelp(page, 'PurchaseOrder'); await feChooseFirst(page, VH_SEARCH); },
      sk: async (page) => { await skOpenValueHelp(page, 'PurchaseOrder'); await skChooseFirst(page, VH_SEARCH); },
    },
    extra: { fe: (page) => feTokens(page, 'Supplier'), sk: (page) => skTokens(page, 'Supplier') },
  },
  // filter tokens with TextSeparate show the code only
  {
    name: 'filter4-token-text-separate',
    overlay: TEXT_SEPARATE,
    act: { fe: (page) => feFilter(page, 'Supplier', '0000100175'), sk: (page) => skFilter(page, 'Supplier', '0000100175') },
    extra: { fe: (page) => feTokens(page, 'Supplier'), sk: (page) => skTokens(page, 'Supplier') },
  },
];

async function snapshot(browser: Browser, s: Scenario, side: 'fe' | 'sk'): Promise<Snapshot & { extra?: unknown }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    if (process.env.FILTER4_DEBUG) page.on('console', (m) => { if (m.type() === 'error') console.log(`[${side}] ${m.text().slice(0, 400)}`); });
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
      // smart-kit: the grid fills its rows after the response (the first row may be rendered empty for a moment)
      if (side === 'sk' && !s.noRows) await expect(page.locator('[data-sk-table] .ag-row[row-index="0"]:not(.ag-row-pinned) [col-id^="DataField::"]').first()).not.toBeEmpty({ timeout: 15_000 });
      else await page.waitForTimeout(1000);
    }
    const extra = s.extra ? await s.extra[side](page) : undefined;
    if (extra !== undefined) await page.keyboard.press('Escape');
    const { structure, text } = side === 'fe' ? await readFe(page) : await readSk(page);
    return { requests: rec.requests, structure, text, extra };
  } finally {
    await context.close();
  }
}

for (const s of SCENARIOS) {
  test(`AL-10 AL-11 AL-12 FE comparison: ${s.name}`, async ({ browser }) => {
    const fe = await snapshot(browser, s, 'fe');
    if (process.env.FILTER4_PROBE) {
      console.log(JSON.stringify({ scenario: s.name, fe: fe.requests, extra: fe.extra, feS: fe.structure, text: fe.text.slice(0, 1) }, null, 1));
      return;
    }
    const sk = await snapshot(browser, s, 'sk');
    if (process.env.FILTER4_DEBUG) console.log(JSON.stringify({ scenario: s.name, fe: fe.requests, sk: sk.requests, feX: fe.extra, skX: sk.extra, feS: fe.structure, skS: sk.structure }, null, 1));
    if (!s.noRows) {
      expect(fe.text.length, 'FE rows').toBeGreaterThan(0);
      expect(sk.text.length, 'smart-kit rows').toBeGreaterThan(0);
    }
    if (s.extra) expect(sk.extra, 'tokens / value help columns').toEqual(fe.extra);
    compareScenario(s.name, fe, sk);
  });
}
