/**
 * Fiori elements comparison of the value display in list report cells (docs/29 §5 "值的显示", docs/30 §7.2,
 * AL-10 – AL-12): the supplier contacts of the test service (`SupplierContacts`, stage 4 block in
 * apps/mock/Csdl/purchasing.template.xml) in the FE reference app (`?app=purchasing-display`) and in the smart-kit demo
 * (`/contacts`). Besides requests, structure and cell text, the links of the cells (href, target) are compared.
 * The purchase order scenarios check the text $expand, the ETag property and the fixed-value lists (DV-FE-01, -02, -08, -09).
 */
import { expect, test, type Browser, type Page } from '@playwright/test';
import type { Snapshot } from './compare';
import { DEMO, FE, MOCK, openFe, openSk, readFe, readSk, RequestRecorder } from './collect';
import { compareScenario } from './harness';

type Side = 'fe' | 'sk';

interface CellLinks {
  /** Column header → links of the cell: "<href> <target>" (target "" when none). */
  [header: string]: string[];
}

/** Links (href and target) of the first rows' cells, keyed by column header. */
async function readLinks(page: Page, side: Side, rows = 3): Promise<CellLinks[]> {
  return page.evaluate(({ side, rows }) => {
    const out: Record<string, string[]>[] = [];
    const linksOf = (el: Element | null | undefined) =>
      // a link without href (sap.m.Link with a press handler; smart-kit's popover buttons) is "(press)"
      [...(el?.matches('a, button.sk-link') ? [el] : []), ...(el?.querySelectorAll('a, button.sk-link') ?? [])].map((a) => (a.getAttribute('href') && !a.getAttribute('href')!.startsWith('#') ? `${a.getAttribute('href')} ${a.getAttribute('target') ?? ''}`.trim() : '(press)'));
    if (side === 'fe') {
      /* eslint-disable @typescript-eslint/no-explicit-any -- the UI5 control tree is untyped here */
      const w = window as any;
      const table = w.sap.ui.require('sap/ui/core/ElementRegistry').filter((e: any) => e.isA('sap.ui.mdc.Table')).find((x: any) => x.getDomRef());
      const headers = table.getColumns().map((c: any) => String(c.getHeader() ?? ''));
      for (const row of table._oTable.getRows().slice(0, rows)) {
        const rec: Record<string, string[]> = {};
        row.getCells().forEach((cell: any, i: number) => { if (headers[i]) rec[headers[i]] = linksOf(cell.getDomRef()); });
        out.push(rec);
      }
      /* eslint-enable @typescript-eslint/no-explicit-any */
    } else {
      const table = document.querySelector('[data-sk-table]');
      const headerOf = new Map<string, string>();
      table?.querySelectorAll('.ag-header-row-column .ag-header-cell[col-id]').forEach((h) => headerOf.set(h.getAttribute('col-id')!, (h.querySelector('.ag-header-cell-text')?.textContent ?? '').trim()));
      for (let i = 0; i < rows; i++) {
        const rec: Record<string, string[]> = {};
        table?.querySelectorAll(`.ag-row[row-index="${i}"]:not(.ag-row-pinned) [col-id]`).forEach((c) => {
          const h = headerOf.get(c.getAttribute('col-id')!);
          if (h) rec[h] = linksOf(c);
        });
        out.push(rec);
      }
    }
    return out;
  }, { side, rows });
}

async function openFeApp(page: Page, app: string) {
  await page.goto(`${FE}/index.html?app=${app}`);
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

async function snapshot(browser: Browser, side: Side, fe: string, sk: string, extra?: (page: Page) => Promise<unknown>): Promise<{ snap: Snapshot; extra: unknown }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    expect((await page.request.post(`${MOCK}/test/reset`)).ok()).toBeTruthy();
    const rec = new RequestRecorder(page);
    if (side === 'fe') {
      if (fe === 'purchasing' || fe === 'purchasing-draft') await openFe(page, fe);
      else await openFeApp(page, fe);
    } else {
      // the requests of the first load: openSk expands a collapsed header (14 columns fill the page), and expanding it
      // mounts the list again (a second load, not a difference in what is requested)
      await page.goto(`${DEMO}${sk}?lang=en`);
      await expect(page.locator('[data-sk-table] .ag-row[row-index="0"] [col-id]').first()).toBeVisible({ timeout: 60_000 });
    }
    await rec.idle(page);
    const requests = rec.requests;
    if (side === 'sk') await openSk(page, sk);
    const { structure, text } = side === 'fe' ? await readFe(page) : await readSk(page);
    return { snap: { requests, structure, text }, extra: await extra?.(page) };
  } finally {
    await context.close();
  }
}

test('AL-10 AL-11 AL-12 FE comparison: display4-contacts (e-mail, phone, links, external ID, masked, time zone, data points, amounts)', async ({ browser }) => {
  const fe = await snapshot(browser, 'fe', 'purchasing-display', '/contacts', (p) => readLinks(p, 'fe'));
  const sk = await snapshot(browser, 'sk', 'purchasing-display', '/contacts', (p) => readLinks(p, 'sk'));
  expect(fe.snap.text.length, 'FE rows').toBeGreaterThan(0);
  expect(sk.snap.text.length, 'smart-kit rows').toBeGreaterThan(0);
  compareScenario('display4-contacts', fe.snap, sk.snap);
  // links: mailto / tel, external links in the same window unless HTML5.LinkTarget says otherwise (D41)
  const feLinks = fe.extra as CellLinks[];
  const skLinks = sk.extra as CellLinks[];
  for (const header of ['Phone', 'Website', 'Portal']) {
    expect(skLinks.map((r) => r[header]), `links of ${header}`).toEqual(feLinks.map((r) => r[header]));
  }
  // e-mail: FE's sap.fe.macros.contact.Email is a link whose press opens `mailto:` (URLHelper.redirect); smart-kit has the
  // same target as href
  expect(feLinks.map((r) => r['E-Mail'])).toEqual(feLinks.map(() => ['(press)']));
  expect(skLinks.map((r) => r['E-Mail'])).toEqual(sk.snap.text.slice(0, skLinks.length).map((r) => [`mailto:${r['E-Mail']}`]));
  // the contact name and the supplier (quick view): a link that opens a popover on both sides
  for (const header of ['Name', 'Supplier']) expect(skLinks.map((r) => r[header]), `links of ${header}`).toEqual(feLinks.map((r) => r[header]));
});

test('AL-10 AL-11 AL-12 FE comparison: display4-po-requests (text $expand with keys, no ETag property, no fixed-value preload)', async ({ browser }) => {
  const fe = await snapshot(browser, 'fe', 'purchasing', '/po');
  const sk = await snapshot(browser, 'sk', 'purchasing', '/po');
  const main = (s: Snapshot) => s.requests.find((r) => r.resource === 'PurchaseOrders')!;
  expect(main(sk.snap).options.$expand).toBe(main(fe.snap).options.$expand);
  expect(main(sk.snap).options.$select).toBe(main(fe.snap).options.$select);
  const resources = (s: Snapshot) => s.requests.map((r) => r.resource);
  expect(resources(sk.snap)).not.toContain('OrderStatuses');
  expect(resources(sk.snap)).not.toContain('PurchaseOrderTypes');
  expect(resources(fe.snap)).not.toContain('OrderStatuses');
});
