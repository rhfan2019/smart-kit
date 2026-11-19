/**
 * Fiori elements comparison of date filter fields without Capabilities.FilterExpressionRestrictions (stage 7, AL-11):
 * FE FieldHelper.operators falls back to CommonHelper.getOperatorsForDateProperty for such a field, so it offers the
 * basic date operators (EQ, BT, LT … NOTGT, Empty) and no semantic / relative date operators, whatever
 * `useSemanticDateRange` says. The annotations each scenario needs are laid over the purchasing `$metadata` in the
 * browser, identically for the FE reference app and the smart-kit demo (`page.route`), so the shared test service and
 * the other scenarios stay unchanged:
 * - OrderDate (Edm.Date) without its SingleRange record,
 * - CreatedAt (Edm.DateTimeOffset, no restriction) added to the UI.SelectionFields.
 */
import { expect, test, type Browser, type Page } from '@playwright/test';
import type { Snapshot } from './compare';
import { MOCK, openFe, openSk, readFe, readSk, RequestRecorder } from './collect';
import { compareScenario } from './harness';

type Overlay = (xml: string) => string;

const ORDER_DATE_RESTRICTION = '<Record Type="Capabilities.FilterExpressionRestrictionType"><PropertyValue Property="Property" PropertyPath="OrderDate"/><PropertyValue Property="AllowedExpressions" String="SingleRange"/></Record>';

/** OrderDate without FilterExpressionRestrictions and CreatedAt as a selection field. */
const UNRESTRICTED: Overlay = (xml) => {
  expect(xml.includes(ORDER_DATE_RESTRICTION), 'OrderDate restriction').toBeTruthy();
  const at = xml.indexOf('<Annotation Term="UI.SelectionFields">');
  const end = xml.indexOf('</Collection>', at);
  expect(at).toBeGreaterThan(0);
  const withField = `${xml.slice(0, end)}  <PropertyPath>CreatedAt</PropertyPath>\n          ${xml.slice(end)}`;
  return withField.replace(ORDER_DATE_RESTRICTION, '');
};

async function overlay(page: Page, change: Overlay) {
  // read from the test service directly (see filter4.spec.ts)
  await page.route(/\/odata\/purchasing\/\$metadata/, async (route) => {
    const url = new URL(route.request().url());
    const headers = await route.request().allHeaders();
    const res = await fetch(`${MOCK}${url.pathname}${url.search}`, { headers: { 'accept-language': headers['accept-language'] ?? 'en' } });
    await route.fulfill({ status: res.status, contentType: res.headers.get('content-type') ?? 'application/xml', body: change(await res.text()) });
  });
}

/** What a filter field offers: semantic date options (FE DynamicDateRange / smart-kit relative date button) or none. */
interface Offer {
  semanticDates: boolean;
  /** FE only: the mdc FilterField's operators, sorted, and whether it takes at most one condition. */
  operators?: string[];
  single?: boolean;
}

/** FE: the mdc FilterField's operators, maxConditions and whether a DynamicDateRange is rendered for it. */
async function feOffer(page: Page, propertyKey: string): Promise<Offer> {
  return page.evaluate((key) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const R = (window as any).sap.ui.require('sap/ui/core/ElementRegistry');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const field = R.filter((e: any) => e.isA('sap.ui.mdc.FilterField') && e.getPropertyKey?.() === key)[0];
    if (!field) throw new Error(`FE filter field ${key}`);
    const dom: HTMLElement | null = field.getDomRef();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ddr = R.filter((e: any) => e.isA('sap.m.DynamicDateRange') && e.getDomRef() && dom?.contains(e.getDomRef())).length > 0;
    return { semanticDates: ddr, operators: [...(field.getOperators() as string[])].sort(), single: field.getMaxConditions() === 1 };
  }, propertyKey);
}

/** smart-kit: whether the relative date button is rendered for the field. */
async function skOffer(page: Page, path: string): Promise<Offer> {
  await expect(page.locator(`[data-sk-filter="${path}"]`)).toBeVisible();
  return { semanticDates: (await page.locator(`[data-sk-filter="${path}"] [data-sk-relative-dates]`).count()) > 0 };
}

/** Day 2 of the current month: the smart-kit date picker opens on the current month. */
const DAY = 2;

/** FE: types a date into the date filter field (one EQ condition; the filter bar is in live mode). */
async function feTypeDate(page: Page, propertyKey: string) {
  const id = await page.evaluate((key) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const R = (window as any).sap.ui.require('sap/ui/core/ElementRegistry');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return R.filter((e: any) => e.isA('sap.ui.mdc.FilterField') && e.getPropertyKey?.() === key)[0]?.getId();
  }, propertyKey);
  const now = new Date();
  const text = new Date(now.getFullYear(), now.getMonth(), DAY).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const input = page.locator(`[id="${id}"] input`).first();
  await input.click();
  await input.fill(text);
  await input.press('Enter');
}

/** smart-kit: picks the same day in the field's date picker (the same day twice: one EQ condition). */
async function skPickDate(page: Page, path: string) {
  const day = page.locator('.mantine-DatePickerInput-day:not([data-outside])', { hasText: new RegExp(`^${DAY}$`) }).first();
  // the picker may close again while the bar re-renders after the first load: open it until the day shows
  await expect(async () => {
    if (!(await day.isVisible())) await page.locator(`[data-sk-filter="${path}"] button:not([data-sk-relative-dates])`).first().click();
    await expect(day).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 30_000 });
  await day.click();
  await day.click();
}

async function snapshot(browser: Browser, side: 'fe' | 'sk', act?: (page: Page) => Promise<void>): Promise<Snapshot & { offers: Record<string, Offer> }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    if (process.env.DATE7_DEBUG) page.on('console', (m) => { if (m.type() === 'error') console.log(`[${side}] ${m.text().slice(0, 400)}`); });
    await overlay(page, UNRESTRICTED);
    expect((await page.request.post(`${MOCK}/test/reset`)).ok()).toBeTruthy();
    const rec = new RequestRecorder(page);
    if (side === 'fe') await openFe(page, 'purchasing');
    else await openSk(page, '/po');
    await rec.idle(page);
    const offers: Record<string, Offer> = {};
    for (const p of ['OrderDate', 'CreatedAt']) offers[p] = side === 'fe' ? await feOffer(page, p) : await skOffer(page, p);
    if (act) {
      rec.reset();
      await act(page);
      await page.waitForTimeout(300);
      await rec.idle(page);
      await page.waitForTimeout(1000);
    }
    const { structure, text } = side === 'fe' ? await readFe(page) : await readSk(page);
    return { requests: act ? rec.requests : [], structure, text, offers };
  } finally {
    await context.close();
  }
}

test('AL-11 FE comparison: date7-unrestricted-date-operators', async ({ browser }) => {
  const fe = await snapshot(browser, 'fe');
  if (process.env.DATE7_PROBE) console.log(JSON.stringify(fe.offers, null, 1));
  // FE 1.154: no DynamicDateRange, the basic operators of getOperatorsForDateProperty
  const basic = ['BT', 'EQ', 'Empty', 'GE', 'GT', 'LE', 'LT', 'NE', 'NOTBT', 'NOTGE', 'NOTGT', 'NOTLE', 'NOTLT'];
  expect(fe.offers.OrderDate).toEqual({ semanticDates: false, operators: basic, single: false });
  expect(fe.offers.CreatedAt).toEqual({ semanticDates: false, operators: basic, single: false });
  const sk = await snapshot(browser, 'sk');
  expect(sk.offers).toEqual({ OrderDate: { semanticDates: false }, CreatedAt: { semanticDates: false } });
});

test('AL-10 AL-11 FE comparison: date7-unrestricted-date-condition', async ({ browser }) => {
  const fe = await snapshot(browser, 'fe', (page) => feTypeDate(page, 'OrderDate'));
  if (process.env.DATE7_PROBE) { console.log(JSON.stringify(fe.requests, null, 1)); return; }
  const sk = await snapshot(browser, 'sk', (page) => skPickDate(page, 'OrderDate'));
  compareScenario('date7-unrestricted-date-condition', fe, sk);
});
