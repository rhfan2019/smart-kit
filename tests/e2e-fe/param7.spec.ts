/**
 * Fiori elements comparison, stage 7 group "param7" (AL-10, AL-11): the action parameter dialog
 * (sap.fe.macros.coreUI.OperationParameterDialog) of the test service's bound action `reject`, whose parameters
 * apps/mock annotates ("reject parameters": fixed values with a constant default, a mandatory multi-line text, a date
 * defaulted from the order, a number with a constant default). FE: the object page of apps/fe-reference
 * `?app=purchasing`; smart-kit: the demo's `/purchasing/object` of the same order.
 * Compared:
 * - structure `actions` = the dialog's buttons, `columns` = the parameter labels in order;
 * - text: one row per parameter (label, control kind, value as shown, mandatory), then "submit without the mandatory
 *   value" (blocked: the dialog stays open, the field shows an error) and the request body of the action after the
 *   mandatory value is entered (JSON, keys sorted).
 */
import { expect, test, type Browser, type Page } from '@playwright/test';
import type { Snapshot, Structure, TextRows } from './compare';
import { DEMO, FE, MOCK } from './collect';
import { compareScenario } from './harness';

const ORDER = "PurchaseOrders('4500000035')";
const NOTE = 'Too expensive';

const structure = (s: Partial<Structure>): Structure => ({ filterFields: [], columns: [], actions: [], editingStatus: [], viewTabs: [], chartType: '', ...s });

interface Param { label: string; kind: string; value: string; required: string }
interface Read { params: Param[]; buttons: string[] }

const sortedJson = (body: string) => {
  const o = JSON.parse(body) as Record<string, unknown>;
  return JSON.stringify(Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]])));
};

/** Records the body of the `reject` POST (direct or inside a $batch). */
function recordReject(page: Page): { body?: string } {
  const out: { body?: string } = {};
  page.on('request', (r) => {
    if (r.method() !== 'POST') return;
    const data = r.postData() ?? '';
    if (r.url().includes('Purchasing.reject')) out.body = sortedJson(data || '{}');
    else if (/\/\$batch(\?|$)/.test(r.url())) {
      const m = /POST \S*Purchasing\.reject\S* HTTP\/1\.1[\s\S]*?\r?\n\r?\n(\{[\s\S]*?\})\r?\n/.exec(data);
      if (m) out.body = sortedJson(m[1]!);
    }
  });
  return out;
}

// ---------------------------------------------------------------------------------------------- FE

async function openFe(page: Page) {
  await page.goto(`${FE}/index.html?app=purchasing#/${ORDER}`);
  await page.waitForFunction(() => {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any -- the UI5 control tree is untyped here */
    const all: any[] = (window as any).sap?.ui?.require?.('sap/ui/core/ElementRegistry')?.filter(() => true) ?? [];
    return all.some((e) => e.isA('sap.m.Button') && e.getText?.() === 'Reject' && e.getDomRef() && e.getEnabled());
  }, undefined, { timeout: 90_000, polling: 250 });
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any -- the UI5 control tree is untyped here */
    const all: any[] = (window as any).sap.ui.require('sap/ui/core/ElementRegistry').filter(() => true);
    all.find((e) => e.isA('sap.m.Button') && e.getText?.() === 'Reject' && e.getDomRef())?.firePress();
  });
  await page.waitForFunction(() => {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any -- the UI5 control tree is untyped here */
    const all: any[] = (window as any).sap.ui.require('sap/ui/core/ElementRegistry').filter(() => true);
    return all.some((e) => e.isA('sap.m.Dialog') && e.isOpen() && e.getId().includes('APD_'));
  }, undefined, { timeout: 30_000, polling: 250 });
  await page.waitForTimeout(1500);
}

async function readFe(page: Page): Promise<Read> {
  return page.evaluate(() => {
    /* eslint-disable @typescript-eslint/no-explicit-any -- the UI5 control tree is untyped here */
    const R = (window as any).sap.ui.require('sap/ui/core/ElementRegistry');
    const all: any[] = R.filter(() => true);
    const dialog = all.find((e) => e.isA('sap.m.Dialog') && e.isOpen() && e.getId().includes('APD_'));
    const dom = dialog.getDomRef() as HTMLElement;
    // in the dialog's order (the registry has them in creation order)
    const fields = all.filter((e) => e.isA('sap.ui.mdc.Field') && e.getVisible() && e.getDomRef() && dom.contains(e.getDomRef()))
      .sort((a, b) => (a.getDomRef().compareDocumentPosition(b.getDomRef()) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
    const params = fields.map((f) => {
      const id: string = f.getId();
      const name = id.slice(id.indexOf('APD_::') + 6);
      const label = all.find((e) => e.isA('sap.m.Label') && e.getId().endsWith(`APD_::${name}::Label`))?.getText() ?? '';
      const type = String(f.getBinding('value')?.getType?.()?.getName?.() ?? f.getDataType?.() ?? '');
      const vhId = f.getValueHelp?.();
      const vh = vhId ? R.get(vhId) : undefined;
      const fd = f.getDomRef() as HTMLElement;
      const kind = fd.querySelector('textarea') ? 'textarea' : /Date$/.test(type) ? 'date' : vh ? (vh.getDialog() ? 'valuehelp' : 'select')
        : /Boolean/.test(type) ? 'boolean' : /Int|Decimal|Double|Single|Byte/.test(type) ? 'number' : 'text';
      const input = fd.querySelector<HTMLInputElement>('input:not([type="hidden"]), textarea');
      return { label, kind, value: input?.value ?? '', required: String(Boolean(f.getRequired())) };
    });
    const buttons = [dialog.getBeginButton(), dialog.getEndButton()].filter(Boolean).map((b: any) => String(b.getText()));
    return { params, buttons };
    /* eslint-enable @typescript-eslint/no-explicit-any */
  });
}

/** Presses the dialog's OK button; true when the dialog stays open with an error on the mandatory field. */
async function feSubmit(page: Page): Promise<boolean> {
  await page.evaluate(() => {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any -- the UI5 control tree is untyped here */
    const all: any[] = (window as any).sap.ui.require('sap/ui/core/ElementRegistry').filter(() => true);
    all.find((e) => e.isA('sap.m.Dialog') && e.isOpen() && e.getId().includes('APD_')).getBeginButton().firePress();
  });
  await page.waitForTimeout(1500);
  return page.evaluate(() => {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any -- the UI5 control tree is untyped here */
    const all: any[] = (window as any).sap.ui.require('sap/ui/core/ElementRegistry').filter(() => true);
    const open = all.some((e) => e.isA('sap.m.Dialog') && e.isOpen() && e.getId().includes('APD_'));
    const note = all.find((e) => e.isA('sap.ui.mdc.Field') && e.getId().endsWith('APD_::RejectionNote'));
    return open && note?.getValueState() === 'Error';
  });
}

async function feEnterNote(page: Page) {
  const area = page.locator('[id$="APD_::RejectionNote"] textarea');
  await area.click();
  await area.fill(NOTE);
  await area.evaluate((el) => (el as HTMLElement).blur());
  await page.waitForTimeout(800);
}

// ---------------------------------------------------------------------------------------------- smart-kit

async function openSk(page: Page) {
  await page.goto(`${DEMO}/purchasing/object?path=${encodeURIComponent(ORDER)}&lang=en`);
  const button = page.locator('[data-sk-action="DataFieldForAction::Purchasing.reject"]').first();
  await expect(button).toBeEnabled({ timeout: 60_000 });
  await page.waitForTimeout(800);
  await button.click();
  await expect(page.locator('[data-sk-action-parameter-dialog]')).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(1500);
}

async function readSk(page: Page): Promise<Read> {
  return page.evaluate(() => {
    const dialog = document.querySelector('[data-sk-action-parameter-dialog]')!;
    const params = [...dialog.querySelectorAll('[data-sk-action-parameter]')].map((el) => {
      const editor = el.querySelector('[data-sk-editor]')?.getAttribute('data-sk-editor') ?? '';
      const input = el.querySelector<HTMLInputElement>('input:not([type="hidden"]), textarea');
      const kind = el.querySelector('textarea') ? 'textarea' : editor;
      const label = (el.querySelector('label')?.textContent ?? '').replace(/\s*\*$/, '').trim();
      return { label, kind, value: input?.value ?? '', required: String(Boolean(input?.required)) };
    });
    const buttons = [...dialog.querySelectorAll('button')].map((b) => (b.textContent ?? '').trim()).filter(Boolean);
    return { params, buttons };
  });
}

async function skSubmit(page: Page): Promise<boolean> {
  await page.locator('[data-sk-action-parameter-ok]').click();
  await page.waitForTimeout(1000);
  const open = await page.locator('[data-sk-action-parameter-dialog]').isVisible();
  const error = await page.locator('[data-sk-action-parameter="RejectionNote"] [aria-invalid="true"]').count();
  return open && error > 0;
}

async function skEnterNote(page: Page) {
  const area = page.locator('[data-sk-action-parameter="RejectionNote"] textarea');
  await area.click();
  await area.fill(NOTE);
  await area.evaluate((el) => (el as HTMLElement).blur());
  await page.waitForTimeout(300);
}

// ---------------------------------------------------------------------------------------------- run

async function snapshot(browser: Browser, side: 'fe' | 'sk'): Promise<Snapshot> {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    expect((await page.request.post(`${MOCK}/test/reset`)).ok()).toBeTruthy();
    const request = recordReject(page);
    await (side === 'fe' ? openFe(page) : openSk(page));
    const r = await (side === 'fe' ? readFe(page) : readSk(page));
    const blocked = await (side === 'fe' ? feSubmit(page) : skSubmit(page));
    await (side === 'fe' ? feEnterNote(page) : skEnterNote(page));
    await (side === 'fe' ? feSubmit(page) : skSubmit(page));
    await expect.poll(() => request.body, { timeout: 15_000 }).toBeTruthy();
    const text: TextRows = [
      ...r.params.map((p) => ({ field: p.label, kind: p.kind, value: p.value, required: p.required })),
      { field: '(submit without the mandatory value)', kind: '', value: blocked ? 'blocked' : 'sent', required: '' },
      { field: '(request body)', kind: '', value: request.body ?? '', required: '' },
    ];
    return { requests: [], structure: structure({ actions: r.buttons, columns: r.params.map((p) => p.label) }), text };
  } finally {
    await context.close();
  }
}

test('AL-10 AL-11 FE comparison: param7-dialog', async ({ browser }) => {
  const fe = await snapshot(browser, 'fe');
  const sk = await snapshot(browser, 'sk');
  expect(fe.structure.columns.length, 'FE parameters').toBeGreaterThan(0);
  compareScenario('param7-dialog', fe, sk);
});
