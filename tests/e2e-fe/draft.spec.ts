/**
 * Fiori elements comparison, stage 3 group "draft" (docs/30 §7.2, AL-10 – AL-12; docs/29 §4 P1-1 draft list,
 * P1-6 multiple views): the editing status options and filters of the draft list, an own draft replacing its
 * active instance, and a list report with a table per view.
 * FE: apps/fe-reference `?app=purchasing-draft` and `?app=purchasing-views` (manifest `views.paths` = the
 * SelectionPresentationVariants Open, InDelivery, Closed with `showCounts`); smart-kit: the demo's `/po-draft` and
 * `/po?views=tabs`.
 */
import { expect, test, type Browser, type Page } from '@playwright/test';
import type { Snapshot } from './compare';
import { FE, feFilter, MOCK, openSk, readFe, readSk, RequestRecorder, skFilter } from './collect';
import { compareScenario } from './harness';

type FeApp = 'purchasing-draft' | 'purchasing-views';

interface Scenario {
  name: string;
  fe: FeApp;
  sk: string;
  /** Changes on the service after the reset, before the apps open (e.g. an own draft). */
  setup?(page: Page): Promise<void>;
  /** Interaction; only the requests sent after it are compared. */
  act?: { fe(page: Page): Promise<void>; sk(page: Page): Promise<void> };
}

/** The order another user has a draft for (apps/mock/lib/draft.mjs LOCKED_ORDER). */
const LOCKED_ORDER = '4500000004';
/** An order the test user edits (own draft). */
const OWN_DRAFT_ORDER = '4500002573';
const DRAFT = `${MOCK}/odata/purchasing-draft`;

/** Opens an FE reference app and waits until a visible table has rows (multiple views: the first view's table). */
async function openFe(page: Page, app: FeApp) {
  await page.goto(`${FE}/index.html?app=${app}`);
  await page.waitForFunction(
    () => {
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any -- the UI5 control tree is untyped here */
      const R = (window as any).sap?.ui?.require?.('sap/ui/core/ElementRegistry');
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any -- the UI5 control tree is untyped here */
      const tables: any[] = R ? R.filter((e: { isA(t: string): boolean }) => e.isA('sap.ui.mdc.Table')) : [];
      return tables.some((t) => t.getDomRef() && t._oTable?.getRows()[0]?.getBindingContext());
    },
    undefined,
    { timeout: 90_000, polling: 250 },
  );
}

/** Chooses an editing status in FE (the sap.m.Select of the $editState filter field). */
async function feEditState(page: Page, text: string) {
  const id = await page.evaluate(() => {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any -- the UI5 control tree is untyped here */
    const all: any[] = (window as any).sap.ui.require('sap/ui/core/ElementRegistry').filter(() => true);
    const field = all.find((e) => e.isA('sap.ui.mdc.FilterField') && e.getPropertyKey() === '$editState');
    return all.find((e) => e.isA('sap.m.Select') && e.getId().startsWith(field.getId()))?.getId() as string | undefined;
  });
  expect(id, 'FE editing status select').toBeTruthy();
  await page.locator(`[id="${id}"]`).click();
  await page.getByRole('option', { name: text, exact: true }).click();
}

/** Chooses an editing status in smart-kit. */
async function skEditState(page: Page, text: string) {
  await page.locator('[data-sk-editing-status]').click();
  await page.getByRole('option', { name: text, exact: true }).click();
}

const editState = (text: string) => ({ fe: (page: Page) => feEditState(page, text), sk: (page: Page) => skEditState(page, text) });

const SCENARIOS: Scenario[] = [
  { name: 'po-draft-list-locked', fe: 'purchasing-draft', sk: '/po-draft', act: editState('Locked by Another User') },
  { name: 'po-draft-list-unchanged', fe: 'purchasing-draft', sk: '/po-draft', act: editState('Unchanged') },
  {
    name: 'po-draft-list-own-draft',
    fe: 'purchasing-draft',
    sk: '/po-draft',
    setup: async (page) => {
      const res = await page.request.post(`${DRAFT}/PurchaseOrders(PurchaseOrder='${OWN_DRAFT_ORDER}',IsActiveEntity=true)/Purchasing.draftEdit`, { headers: { 'Content-Type': 'application/json' }, data: {} });
      expect(res.status()).toBe(200);
    },
    // "All": the own draft replaces its active instance
    act: { fe: (page) => feFilter(page, 'PurchaseOrder', OWN_DRAFT_ORDER), sk: (page) => skFilter(page, 'PurchaseOrder', OWN_DRAFT_ORDER) },
  },
  { name: 'po-views-tabs', fe: 'purchasing-views', sk: '/po?views=tabs' },
];

async function snapshot(browser: Browser, s: Scenario, side: 'fe' | 'sk'): Promise<Snapshot> {
  // a fresh context per side: no shared storage (variants, page state) between the two apps
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    expect((await page.request.post(`${MOCK}/test/reset`)).ok()).toBeTruthy();
    await s.setup?.(page);
    const rec = new RequestRecorder(page);
    if (side === 'fe') await openFe(page, s.fe);
    else await openSk(page, s.sk);
    await rec.idle(page);
    if (s.act) {
      rec.reset();
      await s.act[side](page);
      await page.waitForTimeout(300);
      await rec.idle(page);
    }
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
    expect(fe.text.length, 'FE rows').toBeGreaterThan(0);
    expect(sk.text.length, 'smart-kit rows').toBeGreaterThan(0);
    if (s.name === 'po-draft-list-locked') expect(sk.text.map((r) => r['Purchase Order'])).toEqual([LOCKED_ORDER]);
    compareScenario(s.name, fe, sk);
  });
}
