/**
 * Fiori elements comparison of the list report (docs/30 §7.2, AL-10 – AL-12, AL-21): the same scenario in the FE
 * reference app (apps/fe-reference, SAPUI5 1.154.0 from ui5.sap.com) and in the smart-kit demo.
 */
import { expect, test, type Browser, type Page } from '@playwright/test';
import { removeLineItemDataField, type Snapshot } from './compare';
import { feFilter, MOCK, openFe, openSk, readFe, readSk, RequestRecorder, skFilter } from './collect';
import { compareScenario } from './harness';

interface Scenario {
  name: string;
  fe: 'purchasing' | 'purchasing-draft';
  sk: string;
  /** Optional interaction; only the requests sent after it are compared. */
  act?: { fe(page: Page): Promise<void>; sk(page: Page): Promise<void> };
}

const FILTER_VALUE = '4500002573';

const SCENARIOS: Scenario[] = [
  { name: 'po-list-initial', fe: 'purchasing', sk: '/po' },
  {
    name: 'po-list-filter',
    fe: 'purchasing',
    sk: '/po',
    act: { fe: (page) => feFilter(page, 'PurchaseOrder', FILTER_VALUE), sk: (page) => skFilter(page, 'PurchaseOrder', FILTER_VALUE) },
  },
  { name: 'po-draft-list-initial', fe: 'purchasing-draft', sk: '/po-draft' },
];

async function snapshot(browser: Browser, s: Scenario, side: 'fe' | 'sk', prepare?: (page: Page) => Promise<void>): Promise<Snapshot> {
  // a fresh context per side: no shared storage (variants, page state) between the two apps
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await prepare?.(page);
    expect((await page.request.post(`${MOCK}/test/reset`)).ok()).toBeTruthy();
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
    compareScenario(s.name, fe, sk);
  });
}

test('AL-21 self-test: a column missing in smart-kit is reported as a columns difference', async ({ browser }) => {
  const s = SCENARIOS[0]!;
  const fe = await snapshot(browser, s, 'fe');
  const full = await snapshot(browser, s, 'sk');
  const broken = await snapshot(browser, s, 'sk', async (page) => {
    // smart-kit only: drop the "Order Date" UI.DataField from the LineItem of the service's $metadata
    await page.route(/\/odata\/purchasing\/\$metadata/, async (route) => {
      const res = await route.fetch();
      const xml = await res.text();
      const changed = removeLineItemDataField(xml, 'Purchasing.PurchaseOrder', 'OrderDate');
      expect(changed).not.toBe(xml);
      await route.fulfill({ response: res, body: changed });
    });
  });
  expect(full.structure.columns).toContain('Order Date');
  expect(broken.structure.columns).not.toContain('Order Date');
  const before = compareScenario('self-test', fe, full, { enforce: false, report: false });
  const after = compareScenario('self-test', fe, broken, { enforce: false });
  const missing = (o: typeof after) => {
    const d = o.diffs.find((x) => x.kind === 'structure' && x.member === 'columns');
    return d ? (d.fe as string[]).filter((c) => !(d.sk as string[]).includes(c)) : [];
  };
  // the complete annotations give no such difference; the broken ones are reported as a columns difference
  expect(missing(before)).not.toContain('Order Date');
  expect(missing(after)).toContain('Order Date');
});
