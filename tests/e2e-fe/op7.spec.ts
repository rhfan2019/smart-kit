/**
 * Fiori elements comparison, stage 7 group "op7" (docs/30 §7.2, AL-13 F): the object page's toolbar settings. FE: the
 * object page of apps/fe-reference `?app=purchasing-op7` (draft service; header actions with overflow groups,
 * separators and a primary action, a primary footer action); smart-kit: the demo's
 * `/purchasing-draft/object?…&fe=purchasing-op7` with the same settings (apps/demo/src/pages/objectPageSettings.tsx).
 * Compared, in toolbar order: `actions` = the header toolbar, `editingStatus` = the footer toolbar, each item as its
 * text ("|" for a separator) with " [emphasized]" for an emphasized button (FE ButtonType Emphasized, smart-kit the
 * filled variant). Share and the overflow button are left out.
 */
import { expect, test, type Browser, type Page } from '@playwright/test';
import type { Snapshot, Structure } from './compare';
import { DEMO, FE, MOCK } from './collect';
import { compareScenario } from './harness';

/** A new order without a draft: Approve / Reject (determining, in the footer) and Close are available. */
const PATH = "PurchaseOrders(PurchaseOrder='4500000035',IsActiveEntity=true)";

interface Scenario { name: string; edit?: boolean }
const SCENARIOS: Scenario[] = [
  // the footer shows the determining actions: the header's primary action stays in place (FE prepareHeaderEmphasis),
  // the footer's primary action comes first, emphasized
  { name: 'op7-toolbars-display' },
  // editing: the footer's primary action first, Save not emphasized (FE FooterContent emphasizedButtonExpression)
  { name: 'op7-toolbars-edit', edit: true },
];

const structure = (s: Partial<Structure>): Structure => ({ filterFields: [], columns: [], actions: [], editingStatus: [], viewTabs: [], chartType: '', ...s });

// ---------------------------------------------------------------------------------------------- FE

async function openFe(page: Page) {
  await page.goto(`${FE}/index.html?app=purchasing-op7#/${PATH}`);
  await page.waitForFunction(
    () => {
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any -- the UI5 control tree is untyped here */
      const R = (window as any).sap?.ui?.require?.('sap/ui/core/ElementRegistry');
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any -- the UI5 control tree is untyped here */
      const opl: any = R?.filter((e: { isA(t: string): boolean }) => e.isA('sap.uxap.ObjectPageLayout'))[0];
      return Boolean(opl?.getDomRef() && opl.getBindingContext()?.getProperty('PurchaseOrder') && opl.getSections().length);
    },
    undefined,
    { timeout: 90_000, polling: 250 },
  );
  await page.waitForTimeout(1500);
}

async function readFe(page: Page): Promise<{ header: string[]; footer: string[] }> {
  return page.evaluate(() => {
    /* eslint-disable @typescript-eslint/no-explicit-any -- the UI5 control tree is untyped here */
    const all: any[] = (window as any).sap.ui.require('sap/ui/core/ElementRegistry').filter(() => true);
    const opl = all.find((e) => e.isA('sap.uxap.ObjectPageLayout') && e.getDomRef());
    const items = (controls: any[]): string[] => controls.flatMap((c: any): string[] => {
      if (!c || !c.getVisible?.()) return [];
      if (c.isA('sap.m.ToolbarSeparator')) return ['|'];
      if (c.isA('sap.m.Button') || c.isA('sap.m.MenuButton')) {
        const text = String(c.getText?.() ?? '');
        return text ? [`${text}${c.getType?.() === 'Emphasized' ? ' [emphasized]' : ''}`] : [];
      }
      if (c.getContent && Array.isArray(c.getContent())) return items(c.getContent());
      if (c.getContent && c.getContent()) return items([c.getContent()]);
      return [];
    });
    const footer = opl.getFooter();
    return { header: items(opl.getHeaderTitle()?.getActions() ?? []), footer: footer ? items([footer]) : [] };
    /* eslint-enable @typescript-eslint/no-explicit-any */
  });
}

async function feEdit(page: Page) {
  await page.evaluate(() => {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any -- the UI5 control tree is untyped here */
    const all: any[] = (window as any).sap.ui.require('sap/ui/core/ElementRegistry').filter(() => true);
    all.find((e) => e.isA('sap.m.Button') && e.getText?.() === 'Edit' && e.getDomRef())?.firePress();
  });
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(1000);
}

// ---------------------------------------------------------------------------------------------- smart-kit

async function openSk(page: Page) {
  await page.goto(`${DEMO}/purchasing-draft/object?path=${encodeURIComponent(PATH)}&fe=purchasing-op7&lang=en`);
  await expect(page.locator('[data-sk-heading]')).not.toBeEmpty({ timeout: 60_000 });
  await page.waitForTimeout(800);
}

async function readSk(page: Page): Promise<{ header: string[]; footer: string[] }> {
  return page.evaluate(() => {
    const items = (toolbar: Element | null): string[] => (toolbar ? [...toolbar.querySelectorAll(':scope > [data-sk-toolbar-item]')] : []).flatMap((el) => {
      if (el.querySelector('[data-sk-separator]')) return ['|'];
      return [...el.querySelectorAll('button')].filter((b) => !b.closest('[data-sk-split]') || b.hasAttribute('data-sk-action-group-default'))
        .map((b) => `${(b.textContent ?? '').replace('▾', '').trim()}${b.getAttribute('data-variant') === 'filled' ? ' [emphasized]' : ''}`)
        .filter((t) => t && !t.startsWith('Share'));
    });
    return { header: items(document.querySelector('.sk-dynamic-page__toolbar')), footer: items(document.querySelector('[data-sk-footer] .sk-object-footer__toolbar')) };
  });
}

async function skEdit(page: Page) {
  await page.locator('[data-sk-action="Edit"]').click();
  await expect(page.locator('[data-sk-save]')).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(1000);
}

// ---------------------------------------------------------------------------------------------- run

async function snapshot(browser: Browser, s: Scenario, side: 'fe' | 'sk'): Promise<Snapshot> {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    expect((await page.request.post(`${MOCK}/test/reset`)).ok()).toBeTruthy();
    if (side === 'fe') await openFe(page);
    else await openSk(page);
    if (s.edit) await (side === 'fe' ? feEdit(page) : skEdit(page));
    const r = side === 'fe' ? await readFe(page) : await readSk(page);
    return { requests: [], structure: structure({ actions: r.header, editingStatus: r.footer }), text: [] };
  } finally {
    await context.close();
  }
}

for (const s of SCENARIOS) {
  test(`AL-13 FE comparison: ${s.name}`, async ({ browser }) => {
    const fe = await snapshot(browser, s, 'fe');
    const sk = await snapshot(browser, s, 'sk');
    expect(fe.structure.actions.length, 'FE header actions').toBeGreaterThan(0);
    compareScenario(s.name, fe, sk);
  });
}
