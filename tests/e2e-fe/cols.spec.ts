/**
 * Stage 4, group "cols" (docs/29 §5 表格列 and 动作, causes DV-FE-04 / DV-FE-05): the columns and toolbar actions of
 * the list report against Fiori elements 1.154 (AL-10 – AL-12). Besides the generic comparison, the column headers and
 * the toolbar actions must be equal except for the registered differences.
 */
import { expect, test, type Browser } from '@playwright/test';
import type { Snapshot } from './compare';
import { MOCK, openFe, openSk, readFe, readSk, RequestRecorder } from './collect';
import { compareScenario } from './harness';

interface Scenario { name: string; fe: 'purchasing' | 'purchasing-draft'; sk: string }

const SCENARIOS: Scenario[] = [
  { name: 'cols-po-list', fe: 'purchasing', sk: '/po' },
  { name: 'cols-po-draft-list', fe: 'purchasing-draft', sk: '/po-draft' },
];

async function snapshot(browser: Browser, s: Scenario, side: 'fe' | 'sk'): Promise<Snapshot> {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    expect((await page.request.post(`${MOCK}/test/reset`)).ok()).toBeTruthy();
    const rec = new RequestRecorder(page);
    if (side === 'fe') await openFe(page, s.fe);
    else await openSk(page, s.sk);
    await rec.idle(page);
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
    // DV-FE-05: the column headers are FE's (data point label, micro chart key, one "Inline Action" column)
    expect(sk.structure.columns).toEqual(fe.structure.columns);
    // DV-FE-04: same actions, same order; the menu is enabled without a selection. The non-draft list keeps "Create"
    // (FE templates it only with draft or sticky sessions; stopped, DV-cols-001).
    const withoutCreate = (a: string[]) => (s.fe === 'purchasing' ? a.filter((x) => x !== 'Create') : a);
    expect(withoutCreate(sk.structure.actions)).toEqual(fe.structure.actions);
    compareScenario(s.name, fe, sk);
  });
}
