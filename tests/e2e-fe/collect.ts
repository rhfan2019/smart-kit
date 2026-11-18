/**
 * Browser side of the Fiori elements comparison: records OData requests and reads structure and cell text from
 * the FE reference app (apps/fe-reference, UI5 control tree) and from the smart-kit demo (DOM).
 */
import { expect, type Page, type Request } from '@playwright/test';
import { normalizeRequest, parseBatch, type NormalizedRequest, type Structure, type TextRows } from './compare';

export const MOCK = `http://localhost:${process.env.E2E_MOCK_PORT ?? '4400'}`;
export const DEMO = `http://localhost:${process.env.E2E_DEMO_PORT ?? '4401'}`;
export const FE = `http://localhost:${process.env.FE_PORT ?? '4420'}`;

/** Rows whose cell text is compared (AL-12). */
export const TEXT_ROWS = 5;

/** Records the OData data requests of a page ($batch split into its parts) and tracks requests in flight. */
export class RequestRecorder {
  private all: NormalizedRequest[] = [];
  private pending = new Set<Request>();
  private last = Date.now();

  constructor(page: Page) {
    page.on('request', (r) => {
      if (!r.url().includes('/odata/')) return;
      this.pending.add(r);
      this.last = Date.now();
      const url = r.url();
      if (r.method() === 'POST' && /\/\$batch(\?|$)/.test(url)) {
        const service = /^https?:\/\/[^/]+(\/odata\/[^/?]+\/)/.exec(url)?.[1];
        for (const part of parseBatch(r.postData() ?? '')) {
          if (part.method !== 'GET') continue;
          const n = normalizeRequest(part.url, service);
          if (n) this.all.push(n);
        }
      } else if (r.method() === 'GET') {
        const n = normalizeRequest(url);
        if (n) this.all.push(n);
      }
    });
    const done = (r: Request) => {
      if (this.pending.delete(r)) this.last = Date.now();
    };
    page.on('requestfinished', done);
    page.on('requestfailed', done);
  }

  /** Forgets what was recorded so far (e.g. before entering a filter condition). */
  reset() {
    this.all = [];
  }

  get requests(): NormalizedRequest[] {
    return [...this.all];
  }

  /** Waits until no OData request is in flight and none started for `quietMs`. */
  async idle(page: Page, quietMs = 1500, timeoutMs = 30_000) {
    const until = Date.now() + timeoutMs;
    while (Date.now() < until) {
      if (this.pending.size === 0 && Date.now() - this.last >= quietMs) return;
      await page.waitForTimeout(200);
    }
    throw new Error(`OData requests still in flight after ${timeoutMs} ms`);
  }
}

// ---------------------------------------------------------------------------------------------- FE

/** Opens the FE reference app (`app`: purchasing | purchasing-draft) and waits for the first table rows. */
export async function openFe(page: Page, app: 'purchasing' | 'purchasing-draft') {
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

/** Structure and cell text of the FE list report, from the UI5 control tree. */
export async function readFe(page: Page, rows = TEXT_ROWS): Promise<{ structure: Structure; text: TextRows }> {
  return page.evaluate((n) => {
    const HIDDEN = '.sapUiInvisibleText, .sapUiPseudoInvisibleText';
    /* eslint-disable @typescript-eslint/no-explicit-any -- the UI5 control tree is untyped here */
    const w = window as any;
    const all: any[] = w.sap.ui.require('sap/ui/core/ElementRegistry').filter(() => true);
    const of = (t: string) => all.filter((e) => e.isA(t));
    // visible text of a live cell: text nodes joined with spaces, skipping hidden and screen-reader-only elements
    const visibleText = (el: Element | null | undefined) => {
      if (!el) return '';
      const out: string[] = [];
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const parent = node.parentElement;
        if (!parent || parent.closest(HIDDEN) || !parent.checkVisibility({ visibilityProperty: true, opacityProperty: true })) continue;
        out.push(node.textContent ?? '');
      }
      return out.join(' ');
    };
    const fb = of('sap.ui.mdc.FilterBar').find((x) => x.getDomRef());
    const table = of('sap.ui.mdc.Table').find((x) => x.getDomRef());
    const filterFields: string[] = [];
    if (fb?.getBasicSearchField?.()) filterFields.push('[search]');
    for (const f of fb?.getFilterItems() ?? []) if (f.getVisible()) filterFields.push(f.getLabel());
    const editState = (fb?.getFilterItems() ?? []).find((f: any) => f.getPropertyKey() === '$editState');
    const select = editState ? all.find((e) => e.isA('sap.m.Select') && e.getId().startsWith(editState.getId())) : undefined;
    const columns = (table?.getColumns() ?? []).map((c: any) => String(c.getHeader() ?? '')).filter(Boolean);
    const actions = (table?.getActions() ?? [])
      .map((a: any) => (a.getAction ? a.getAction() : a))
      // toolbar separators of overflow groups (macros6) have no text
      .filter((b: any) => b.getVisible() && typeof b.getText === 'function')
      .map((b: any) => `${b.getText()}${b.getEnabled() ? '' : ' [disabled]'}`);
    // the view tabs (IconTabFilter texts; their counts are a property of their own, compared by tests/e2e-fe/lr5.spec.ts;
    // the IconTabBar's overflow items have no text; the tabs of an open value help dialog are no view tabs)
    const viewTabs = of('sap.m.IconTabBar').filter((t) => !t.getDomRef()?.closest('[role="dialog"]')).flatMap((t) => t.getItems().filter((i: any) => i.isA('sap.m.IconTabFilter') && i.getVisible() && i.getText()).map((i: any) => i.getText()))
      .concat(of('sap.m.SegmentedButton').filter((s) => s.getId().includes('fe::')).flatMap((s) => s.getItems().map((i: any) => i.getText()).filter(Boolean)));
    const chart = of('sap.ui.mdc.Chart').find((x) => x.getDomRef());
    const inner = table?._oTable;
    const headers = (table?.getColumns() ?? []).map((c: any) => String(c.getHeader() ?? ''));
    const text: Record<string, string>[] = [];
    for (const row of (inner?.getRows() ?? []).slice(0, n)) {
      if (!row.getBindingContext()) break;
      const rec: Record<string, string> = {};
      row.getCells().forEach((cell: any, i: number) => {
        if (headers[i]) rec[headers[i]] = visibleText(cell.getDomRef());
      });
      text.push(rec);
    }
    return {
      structure: {
        filterFields,
        columns,
        actions,
        editingStatus: select ? select.getItems().map((i: any) => i.getText()) : [],
        viewTabs,
        chartType: chart ? String(chart.getChartType()) : '',
      },
      text,
    };
    /* eslint-enable @typescript-eslint/no-explicit-any */
  }, rows);
}

/** Enters a condition into an FE filter field (by property key) and applies it with Enter (live mode). */
export async function feFilter(page: Page, propertyKey: string, value: string) {
  const id = await page.evaluate((key) => {
    const w = window as unknown as { sap: { ui: { require(n: string): { filter(f: (e: { isA(t: string): boolean }) => boolean): { getPropertyKey(): string; getId(): string }[] } } } };
    const fields = w.sap.ui.require('sap/ui/core/ElementRegistry').filter((e) => e.isA('sap.ui.mdc.FilterField'));
    return fields.find((f) => f.getPropertyKey() === key)?.getId();
  }, propertyKey);
  expect(id, `FE filter field ${propertyKey}`).toBeTruthy();
  const input = page.locator(`[id="${id}"] input`).first();
  await input.click();
  await input.fill(value);
  await input.press('Enter');
}

// ---------------------------------------------------------------------------------------------- smart-kit

const SK_FIRST_CELL = '[data-sk-table] .ag-row[row-index="0"]:not(.ag-row-pinned):not(.ag-row-loading) [col-id^="DataField::"]';

/** Opens a smart-kit demo route in English and waits for the first table rows. */
export async function openSk(page: Page, path: string) {
  await page.goto(`${DEMO}${path}${path.includes('?') ? '&' : '?'}lang=en`);
  await expect(page.locator(SK_FIRST_CELL).first()).not.toBeEmpty({ timeout: 60_000 });
  // the header (filter bar) may start collapsed while the table fills the page
  const expand = page.getByRole('button', { name: /^(Show Filters|Expand Header)$/ });
  if (await expand.isVisible()) await expand.click();
  await expect(page.locator('[data-sk-filter]').first()).toBeVisible();
}

/** Structure and cell text of the smart-kit list report, from the DOM. */
export async function readSk(page: Page, rows = TEXT_ROWS): Promise<{ structure: Structure; text: TextRows }> {
  // loaded rows, not the placeholders of the infinite row model
  await expect(page.locator('[data-sk-table] .ag-row-loading')).toHaveCount(0);
  await expect(page.locator(SK_FIRST_CELL).first()).not.toBeEmpty();
  let editingStatus: string[] = [];
  const status = page.locator('[data-sk-editing-status]');
  if (await status.count()) {
    await status.first().click();
    const options = page.getByRole('option');
    await expect(options.first()).toBeVisible();
    editingStatus = (await options.allInnerTexts()).map((s) => s.trim());
    await page.keyboard.press('Escape');
    await expect(options).toHaveCount(0);
  }
  const read = await page.evaluate((n) => {
    const HIDDEN = '.sk-visually-hidden, [class*="VisuallyHidden"]';
    // visible text of a live cell: text nodes joined with spaces, skipping hidden and screen-reader-only elements
    const visibleText = (el: Element | null | undefined) => {
      if (!el) return '';
      const out: string[] = [];
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const parent = node.parentElement;
        if (!parent || parent.closest(HIDDEN) || !parent.checkVisibility({ visibilityProperty: true, opacityProperty: true })) continue;
        out.push(node.textContent ?? '');
      }
      return out.join(' ');
    };
    const filterFields = [...document.querySelectorAll('[data-sk-filter]')].map((el) => {
      const id = el.getAttribute('data-sk-filter');
      return id === '$search' ? '[search]' : (el.querySelector('label')?.textContent ?? id ?? '').replace(/\s*\*$/, '').trim();
    });
    const table = document.querySelector('[data-sk-table]');
    const headerOf = new Map<string, string>();
    const columns: string[] = [];
    table?.querySelectorAll('.ag-header-row-column .ag-header-cell[col-id]').forEach((h) => {
      const label = (h.querySelector('.ag-header-cell-text')?.textContent ?? '').trim();
      headerOf.set(h.getAttribute('col-id')!, label);
      if (label) columns.push(label);
    });
    const actions = [...(table?.querySelectorAll('.sk-table__toolbar-actions [data-sk-action], .sk-table__toolbar-actions [data-sk-action-group]') ?? [])]
      .map((b) => `${(b.textContent ?? '').trim()}${(b as HTMLButtonElement).disabled ? ' [disabled]' : ''}`);
    const viewTabs = [
      ...[...document.querySelectorAll('[data-sk-view-switch="segmented"] label')].map((x) => (x.textContent ?? '').trim()),
      ...[...document.querySelectorAll('[data-sk-list-tab] [data-sk-tab-text]')].map((x) => (x.textContent ?? '').trim()),
    ];
    const chartType = [...document.querySelectorAll('.sk-chart[data-sk-chart]')].find((c) => !c.closest('[data-sk-table]'))?.getAttribute('data-sk-chart') ?? '';
    const text: Record<string, string>[] = [];
    for (let i = 0; i < n; i++) {
      const cells = table?.querySelectorAll(`.ag-row[row-index="${i}"]:not(.ag-row-pinned) [col-id]`) ?? [];
      if (!cells.length) break;
      const rec: Record<string, string> = {};
      cells.forEach((c) => {
        const h = headerOf.get(c.getAttribute('col-id')!);
        if (h) rec[h] = visibleText(c);
      });
      text.push(rec);
    }
    return { filterFields, columns, actions, viewTabs, chartType, text };
  }, rows);
  const { text, ...rest } = read;
  return { structure: { ...rest, editingStatus }, text };
}

/** Enters a condition into a smart-kit filter field (by path) and applies it with Enter (live mode). */
export async function skFilter(page: Page, path: string, value: string) {
  const input = page.locator(`[data-sk-filter="${path}"] input:not([type="hidden"])`).first();
  await input.click();
  await input.fill(value);
  await input.press('Enter');
}
