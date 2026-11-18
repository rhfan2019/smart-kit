/**
 * Fiori elements comparison, stage 6 group "op6" (docs/30 §7.2, docs/29b, docs/29c; AL-10 – AL-12 on the object page):
 * the object page's annotation semantics. FE: the object pages of apps/fe-reference `?app=purchasing-draft` (draft,
 * tab layout), `?app=purchasing` (direct save, tab layout) and `?app=purchasing-display` (contacts, page layout, the
 * stage 6 facets of apps/mock); smart-kit: the demo's `/<service>/object` with the same settings.
 * Compared, as keys (FE stable ids without their prefix):
 * - requests: the reads of the object itself while the page opens (`$select`, `$expand`), not in edit mode;
 * - `viewTabs` = the visible sections, `filterFields` = the visible sub-sections ("section/sub-section"),
 *   `columns` = the header facets, `actions` = the header actions, `editingStatus` = the footer actions, both as
 *   text with " [disabled]";
 * - text: one row per form field: sub-section, label, value as shown (edit mode: the input's value, with
 *   " [editable]" and " [required]"); containers behind "Show More" and fields behind "Show Details" are not shown.
 */
import { expect, test, type Browser, type Page } from '@playwright/test';
import type { NormalizedRequest, Snapshot, Structure, TextRows } from './compare';
import { DEMO, FE, MOCK, RequestRecorder } from './collect';
import { compareScenario } from './harness';

type FeApp = 'purchasing-draft' | 'purchasing' | 'purchasing-display';

interface Scenario {
  name: string;
  fe: FeApp;
  /** Service of the demo route. */
  service: 'purchasing' | 'purchasing-draft';
  /** Entity path (FE route hash = the same). */
  path: string;
  /** Press Edit before reading. */
  edit?: boolean;
}

const DRAFT_ORDER = "PurchaseOrders(PurchaseOrder='4500000001',IsActiveEntity=true)";
const SCENARIOS: Scenario[] = [
  { name: 'op6-draft-display', fe: 'purchasing-draft', service: 'purchasing-draft', path: DRAFT_ORDER },
  { name: 'op6-draft-edit', fe: 'purchasing-draft', service: 'purchasing-draft', path: DRAFT_ORDER, edit: true },
  // closed order: Close not available (CloseEnabled false), Approve / Reject not available
  { name: 'op6-display', fe: 'purchasing', service: 'purchasing', path: "PurchaseOrders('4500000002')" },
  // new order: Approve / Reject available
  { name: 'op6-approvable', fe: 'purchasing', service: 'purchasing', path: "PurchaseOrders('4500000035')" },
  { name: 'op6-contact', fe: 'purchasing-display', service: 'purchasing', path: 'SupplierContacts(5c0a0001-0d4e-4f00-8a00-000000001eef)' },
  // an item as an object page of its own (purchasing-display's PurchaseOrderItems target): a collection facet with a
  // table and a field group is one "mixed" sub-section (FE createCollectionFacetSubSection)
  { name: 'op6-item', fe: 'purchasing-display', service: 'purchasing', path: "PurchaseOrderItems(PurchaseOrder='4500000001',PurchaseOrderItem=10)" },
  // a contact of a blocked supplier: the facet "Supplier Details" is hidden (UI.Hidden Path="_Supplier/IsBlocked")
  { name: 'op6-contact-blocked', fe: 'purchasing-display', service: 'purchasing', path: 'SupplierContacts(5c0a0016-0d4e-4f00-8a00-00000002a88a)' },
];

const structure = (s: Partial<Structure>): Structure => ({ filterFields: [], columns: [], actions: [], editingStatus: [], viewTabs: [], chartType: '', ...s });

/** The reads of the object itself (resource = the entity path, any IsActiveEntity). */
function objectReads(requests: NormalizedRequest[], path: string): NormalizedRequest[] {
  const base = decodeURIComponent(path).replace(/IsActiveEntity=(true|false)/, 'IsActiveEntity=X');
  return requests.filter((r) => r.resource.replace(/IsActiveEntity=(true|false)/, 'IsActiveEntity=X') === base);
}

interface Read { sections: string[]; subSections: string[]; facets: string[]; header: string[]; footer: string[]; forms: Record<string, string>[] }

// ---------------------------------------------------------------------------------------------- FE

async function openFe(page: Page, s: Scenario) {
  await page.goto(`${FE}/index.html?app=${s.fe}#/${s.path}`);
  await page.waitForFunction(
    () => {
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any -- the UI5 control tree is untyped here */
      const R = (window as any).sap?.ui?.require?.('sap/ui/core/ElementRegistry');
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any -- the UI5 control tree is untyped here */
      const opl: any = R?.filter((e: { isA(t: string): boolean }) => e.isA('sap.uxap.ObjectPageLayout'))[0];
      const ctx = opl?.getBindingContext();
      return Boolean(opl?.getDomRef() && ctx && Object.keys(ctx.getObject() ?? {}).length > 2 && opl.getSections().length);
    },
    undefined,
    { timeout: 90_000, polling: 250 },
  );
  await page.waitForTimeout(1500);
}

/** Selects a section of the FE object page (tab or scroll) by its index among the visible ones. */
async function feSelect(page: Page, index: number) {
  await page.evaluate((i) => {
    /* eslint-disable @typescript-eslint/no-explicit-any -- the UI5 control tree is untyped here */
    const all: any[] = (window as any).sap.ui.require('sap/ui/core/ElementRegistry').filter(() => true);
    const opl = all.find((e) => e.isA('sap.uxap.ObjectPageLayout') && e.getDomRef());
    const section = opl.getSections().filter((x: any) => x.getVisible())[i];
    if (section) opl.setSelectedSection(section);
    /* eslint-enable @typescript-eslint/no-explicit-any */
  }, index);
  await page.waitForTimeout(1200);
}

async function readFe(page: Page): Promise<Read> {
  const read = () => page.evaluate(() => {
    /* eslint-disable @typescript-eslint/no-explicit-any -- the UI5 control tree is untyped here */
    const HIDDEN = '.sapUiInvisibleText, .sapUiPseudoInvisibleText';
    const visibleText = (el: Element | null | undefined) => {
      if (!el) return '';
      const out: string[] = [];
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const parent = node.parentElement;
        if (!parent || parent.closest(HIDDEN) || !parent.checkVisibility({ visibilityProperty: true, opacityProperty: true })) continue;
        out.push(node.textContent ?? '');
      }
      return out.join(' ').replace(/\s+/g, ' ').trim();
    };
    const all: any[] = (window as any).sap.ui.require('sap/ui/core/ElementRegistry').filter(() => true);
    const opl = all.find((e) => e.isA('sap.uxap.ObjectPageLayout') && e.getDomRef());
    const keyOf = (id: string, kinds: string[]) => {
      for (const k of kinds) {
        const i = id.indexOf(`fe::${k}::`);
        if (i >= 0) return id.slice(i + k.length + 6);
      }
      return /fe::EditableHeader(Sub)?Section/.test(id) ? '$Header' : id.replace(/^.*--/, '');
    };
    const sectionKey = (s: any) => keyOf(s.getId(), ['FacetSection', 'CustomSection']);
    const visible = (c: any) => c.getVisible() && Boolean(c.getDomRef());
    const sectionsV = opl.getSections().filter((s: any) => s.getVisible());
    const sections = sectionsV.map(sectionKey);
    const subSections = sectionsV.flatMap((s: any) => s.getSubSections().filter((x: any) => x.getVisible()).map((x: any) => `${sectionKey(s)}/${keyOf(x.getId(), ['FacetSubSection', 'CustomSubSection'])}`));
    const content = opl.getHeaderContent() ?? [];
    const container = content[0]?.getItems ? content[0] : undefined;
    const facets = (opl.getShowHeaderContent() ? (container ? container.getItems() : content) : [])
      .filter((c: any) => visible(c) && !c.isA('sap.m.Avatar') && !c.getId().startsWith('__avatar') && (c.getDomRef() as HTMLElement).offsetHeight > 0)
      .map((c: any) => keyOf(c.getId(), ['HeaderFacetContainer', 'HeaderCollectionFacetContainer', 'HeaderFacetCustomContainer']));
    const texts = (controls: any[]): string[] => controls.flatMap((c: any): string[] => {
      if (!c || !visible(c)) return [];
      if (c.isA('sap.m.Button') || c.isA('sap.m.MenuButton')) return c.getText() ? [`${String(c.getText())}${c.getEnabled() ? '' : ' [disabled]'}`] : [];
      if (c.getContent && Array.isArray(c.getContent())) return texts(c.getContent());
      if (c.getContent && c.getContent()) return texts([c.getContent()]);
      return [];
    });
    // form elements of the selected section (tabs) or of all rendered sections
    const forms: Record<string, Record<string, string>> = {};
    for (const s of sectionsV) {
      for (const sub of s.getSubSections().filter((x: any) => x.getVisible())) {
        const dom = sub.getDomRef();
        if (!dom || !(dom as HTMLElement).offsetHeight) continue;
        const key = `${sectionKey(s)}/${keyOf(sub.getId(), ['FacetSubSection', 'CustomSubSection'])}`;
        const elements = all.filter((e) => e.isA('sap.ui.layout.form.FormElement') && e.getVisible() && e.getDomRef() && dom.contains(e.getDomRef()) && (e.getDomRef() as HTMLElement).offsetHeight > 0);
        if (!elements.length) continue;
        const rec: Record<string, string> = {};
        for (const fe of elements) {
          const l = fe.getLabel();
          const label = (typeof l === 'string' ? l : String(l?.getText?.() ?? fe.getLabelControl?.()?.getText?.() ?? '')).replace(/:$/, '').trim();
          const d = fe.getDomRef() as HTMLElement;
          const fields = fe.getFields().map((f: any) => f.getDomRef()).filter(Boolean) as HTMLElement[];
          const input = d.querySelector<HTMLInputElement>('input:not([type="hidden"]):not([type="checkbox"]), textarea');
          let value: string;
          if (input && input.offsetHeight > 0) {
            value = input.value;
            if (!input.readOnly && !input.disabled) value += ' [editable]';
            if (input.getAttribute('aria-required') === 'true') value += ' [required]';
          } else value = fields.map((f) => visibleText(f)).join(' ').trim();
          rec[label] = value;
        }
        forms[key] = rec;
      }
    }
    return {
      sections,
      subSections,
      facets,
      header: texts(opl.getHeaderTitle()?.getActions() ?? []),
      footer: opl.getFooter() ? texts([opl.getFooter()]) : [],
      forms,
    };
    /* eslint-enable @typescript-eslint/no-explicit-any */
  });
  const first = await read();
  const forms: Record<string, Record<string, string>> = { ...first.forms };
  for (let i = 0; i < first.sections.length; i++) {
    await feSelect(page, i);
    Object.assign(forms, (await read()).forms);
  }
  await feSelect(page, 0);
  return { ...first, forms: Object.keys(forms).sort().map((k) => ({ '': k, ...forms[k] })) };
}

async function feEdit(page: Page) {
  await page.evaluate(() => {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any -- the UI5 control tree is untyped here */
    const all: any[] = (window as any).sap.ui.require('sap/ui/core/ElementRegistry').filter(() => true);
    all.find((e) => e.isA('sap.m.Button') && e.getText?.() === 'Edit' && e.getDomRef())?.firePress();
  });
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(1500);
}

// ---------------------------------------------------------------------------------------------- smart-kit

async function openSk(page: Page, s: Scenario) {
  await page.goto(`${DEMO}/${s.service}/object?path=${encodeURIComponent(s.path)}&lang=en`);
  await expect(page.locator('[data-sk-heading]')).not.toBeEmpty({ timeout: 60_000 });
  await expect(page.locator('[data-sk-section] [data-sk-field]').first()).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(800);
}

async function readSk(page: Page): Promise<Read> {
  const read = () => page.evaluate(() => {
    const HIDDEN = '.sk-visually-hidden, [class*="VisuallyHidden"]';
    const visibleText = (el: Element | null | undefined) => {
      if (!el) return '';
      const out: string[] = [];
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const parent = node.parentElement;
        if (!parent || parent.closest(HIDDEN) || !parent.checkVisibility({ visibilityProperty: true, opacityProperty: true })) continue;
        out.push(node.textContent ?? '');
      }
      return out.join(' ').replace(/\s+/g, ' ').trim();
    };
    const visible = (el: Element | null) => Boolean(el && (el as HTMLElement).offsetHeight > 0);
    const sections = [...document.querySelectorAll('[data-sk-anchor]')].map((a) => a.getAttribute('data-sk-anchor')!).filter((x, i, a) => a.indexOf(x) === i);
    const subSections: string[] = [];
    const forms: Record<string, Record<string, string>> = {};
    for (const sec of document.querySelectorAll('[data-sk-section]')) {
      const sk = sec.getAttribute('data-sk-section')!;
      for (const sub of sec.querySelectorAll(':scope [data-sk-subsection]')) {
        if (sub.parentElement?.closest('[data-sk-subsection]')) continue;
        const key = `${sk}/${sub.getAttribute('data-sk-subsection')!}`;
        subSections.push(key);
        const fields = [...sub.querySelectorAll('[data-sk-field]')].filter(visible);
        if (!fields.length) continue;
        const rec: Record<string, string> = {};
        for (const f of fields) {
          const label = (f.querySelector('.sk-form__label')?.textContent ?? '').replace(/\s*\*$/, '').trim();
          const input = f.querySelector<HTMLInputElement>('input:not([type="hidden"]):not([type="checkbox"]), textarea');
          let value: string;
          if (input && visible(input)) {
            value = input.value;
            if (!input.readOnly && !input.disabled) value += ' [editable]';
            if (input.required || input.getAttribute('aria-required') === 'true') value += ' [required]';
          } else value = visibleText(f.querySelector('.sk-form__value'));
          rec[label] = value;
        }
        forms[key] = rec;
      }
    }
    const facetsEl = document.querySelector('.sk-object-header__facets');
    const facets = visible(facetsEl) ? [...facetsEl!.querySelectorAll(':scope > [data-sk-facet]')].filter(visible).map((f) => f.getAttribute('data-sk-facet')!) : [];
    const btn = (b: Element) => `${(b.textContent ?? '').replace('▾', '').trim()}${(b as HTMLButtonElement).disabled ? ' [disabled]' : ''}`;
    const header = [...document.querySelectorAll('.sk-dynamic-page__actions button, [data-sk-heading-actions] button, .sk-dynamic-page-title__actions button')]
      .filter((b) => visible(b) && !b.closest('[data-sk-footer]')).map(btn).filter((t) => t && t !== 'Share');
    const footer = [...document.querySelectorAll('[data-sk-footer] button')].filter((b) => visible(b) && !b.closest('[data-sk-message-button], .sk-message-button'))
      .map(btn).filter((t) => t && !/^\d+$/.test(t));
    return { sections, subSections, facets, header, footer, forms };
  });
  const first = await read();
  const forms: Record<string, Record<string, string>> = { ...first.forms };
  const tabs = (await page.locator('[data-sk-section-layout="Tabs"]').count()) > 0;
  const subSections = new Set(first.subSections);
  if (tabs) {
    for (const s of first.sections) {
      await page.locator(`[data-sk-anchor="${s}"]`).first().click();
      await page.waitForTimeout(800);
      const r = await read();
      Object.assign(forms, r.forms);
      r.subSections.forEach((x) => subSections.add(x));
    }
    await page.locator(`[data-sk-anchor="${first.sections[0]}"]`).first().click();
  }
  // sub-sections in section order (tabs render one section at a time)
  const order = (k: string) => first.sections.indexOf(k.split('/')[0]!);
  const subs = [...subSections].sort((a, b) => order(a) - order(b));
  return { ...first, subSections: subs, forms: Object.keys(forms).sort().map((k) => ({ '': k, ...forms[k] })) };
}

async function skEdit(page: Page) {
  await page.locator('[data-sk-action="Edit"]').click();
  await expect(page.locator('[data-sk-save]')).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(1500);
}

// ---------------------------------------------------------------------------------------------- run

async function snapshot(browser: Browser, s: Scenario, side: 'fe' | 'sk'): Promise<Snapshot> {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    expect((await page.request.post(`${MOCK}/test/reset`)).ok()).toBeTruthy();
    const recorder = new RequestRecorder(page);
    if (side === 'fe') await openFe(page, s);
    else await openSk(page, s);
    await recorder.idle(page);
    const requests = s.edit ? [] : objectReads(recorder.requests, s.path);
    if (s.edit) await (side === 'fe' ? feEdit(page) : skEdit(page));
    const r = side === 'fe' ? await readFe(page) : await readSk(page);
    // Custom sections (Custom::…) are compared by tests/e2e-fe/op5.spec.ts; their content is not annotation-based.
    // one row per form field: its sub-section, label and value (FE form elements in order)
    const text: TextRows = r.forms.filter((f) => !String(f['']).includes('Custom::'))
      .flatMap((f) => Object.entries(f).filter(([k]) => k !== '').map(([field, value]) => ({ subSection: f['']!, field, value })));
    return {
      requests,
      structure: structure({ viewTabs: r.sections, filterFields: r.subSections, columns: r.facets, actions: r.header, editingStatus: r.footer }),
      text,
    };
  } finally {
    await context.close();
  }
}

for (const s of SCENARIOS) {
  test(`AL-12 FE comparison: ${s.name}`, async ({ browser }) => {
    const fe = await snapshot(browser, s, 'fe');
    const sk = await snapshot(browser, s, 'sk');
    expect(fe.structure.viewTabs.length, 'FE sections').toBeGreaterThan(0);
    expect(sk.structure.viewTabs.length, 'smart-kit sections').toBeGreaterThan(0);
    compareScenario(s.name, fe, sk);
  });
}
