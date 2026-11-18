/**
 * Fiori elements comparison, stage 5 group "op5" (docs/30 §7.2, AL-13 F; docs/26c §3.3): the object page settings.
 * FE: the object page of apps/fe-reference `?app=purchasing-draft` (sectionLayout Tabs, editable header content, the
 * custom section Custom::Timeline with side content and a sub-section action, CreationDialog for items) and
 * `?app=purchasing-op` (sectionLayout Page, editableHeaderContent false, a custom header facet after HeaderGeneral, a
 * custom header action, a custom footer action); smart-kit: the demo's `/purchasing-draft/object` with the same
 * settings (apps/demo/src/pages/objectPageSettings.tsx reads the FE manifests) and `&fe=purchasing-op`.
 * Compared is what the settings decide, as keys (FE stable ids without their prefix), not the annotation content of the
 * object page (stage 6): `viewTabs` = the sections in order, `columns` = the header facets, `actions` = the header
 * actions (texts), `editingStatus` = the footer actions (texts), `text[0]` = section layout, anchor / tab bar,
 * header content visible, side content shown. The OData requests of the object page are stage 6 and not compared here.
 */
import { expect, test, type Browser, type Page } from '@playwright/test';
import type { Snapshot, Structure, TextRows } from './compare';
import { DEMO, FE, MOCK } from './collect';
import { compareScenario } from './harness';

type FeApp = 'purchasing-draft' | 'purchasing-op';

/** An order without drafts (apps/mock/lib/draft.mjs locks 4500000004). */
const ORDER = '4500000001';
const KEY = `PurchaseOrder='${ORDER}',IsActiveEntity=true`;

interface Scenario {
  name: string;
  fe: FeApp;
  /** demo query after path= */
  sk: string;
  /** Press Edit before reading. */
  edit?: boolean;
  /** Open the tab of Custom::Timeline and press its sub-section action (shows the side content). */
  sideContent?: boolean;
}

const SCENARIOS: Scenario[] = [
  { name: 'op5-draft-display', fe: 'purchasing-draft', sk: '' },
  { name: 'op5-draft-edit', fe: 'purchasing-draft', sk: '', edit: true },
  { name: 'op5-draft-side-content', fe: 'purchasing-draft', sk: '', sideContent: true },
  { name: 'op5-custom-display', fe: 'purchasing-op', sk: '&fe=purchasing-op' },
  { name: 'op5-custom-edit', fe: 'purchasing-op', sk: '&fe=purchasing-op', edit: true },
];

const structure = (s: Partial<Structure>): Structure => ({ filterFields: [], columns: [], actions: [], editingStatus: [], viewTabs: [], chartType: '', ...s });

// ---------------------------------------------------------------------------------------------- FE

async function openFe(page: Page, app: FeApp) {
  await page.goto(`${FE}/index.html?app=${app}#/PurchaseOrders(${KEY})`);
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
  await page.waitForTimeout(500);
}

async function readFe(page: Page): Promise<{ structure: Structure; text: TextRows }> {
  const r = await page.evaluate(() => {
    /* eslint-disable @typescript-eslint/no-explicit-any -- the UI5 control tree is untyped here */
    const all: any[] = (window as any).sap.ui.require('sap/ui/core/ElementRegistry').filter(() => true);
    const opl = all.find((e) => e.isA('sap.uxap.ObjectPageLayout') && e.getDomRef());
    const keyOf = (id: string, kinds: string[]) => {
      for (const k of kinds) {
        const i = id.indexOf(`fe::${k}::`);
        if (i >= 0) return id.slice(i + k.length + 6);
      }
      return id.includes('fe::EditableHeaderSection') ? '$Header' : id.replace(/^.*--/, '');
    };
    const visible = (c: any) => c.getVisible() && Boolean(c.getDomRef());
    const sections = opl.getSections().filter((s: any) => s.getVisible()).map((s: any) => keyOf(s.getId(), ['FacetSection', 'CustomSection']));
    const content = opl.getHeaderContent() ?? [];
    const container = content[0]?.getItems ? content[0] : undefined;
    // header facets only (the avatar is part of the header content, smart-kit puts it before the facets)
    const facets = (container ? container.getItems() : content).filter((c: any) => visible(c) && !c.isA('sap.m.Avatar') && !c.getId().startsWith('__avatar'))
      .map((c: any) => keyOf(c.getId(), ['HeaderFacetContainer', 'HeaderFacetCustomContainer']));
    const title = opl.getHeaderTitle();
    // buttons with text, also inside toolbars and building blocks (FooterContent wraps an OverflowToolbar)
    const texts = (controls: any[]): string[] => controls.flatMap((c: any): string[] => {
      if (!c || !visible(c)) return [];
      if (c.isA('sap.m.Button') || c.isA('sap.m.MenuButton')) return c.getText() ? [String(c.getText())] : [];
      if (c.getContent && Array.isArray(c.getContent())) return texts(c.getContent());
      if (c.getContent && c.getContent()) return texts([c.getContent()]);
      return [];
    });
    const footer = opl.getFooter();
    const headerDom = opl.getDomRef().querySelector('.sapUxAPObjectPageHeaderContent, .sapFDynamicPageHeader');
    const side = all.find((e) => e.isA('sap.ui.layout.DynamicSideContent') && e.getDomRef() && e.getShowSideContent());
    return {
      sections,
      facets,
      header: texts(title?.getActions() ?? []),
      footer: footer ? texts([footer]) : [],
      layout: {
        sectionLayout: opl.getUseIconTabBar() ? 'Tabs' : 'Page',
        anchorBar: String(opl.getShowAnchorBar()),
        headerContent: String(Boolean(opl.getShowHeaderContent() && facets.length && headerDom && (headerDom as HTMLElement).offsetHeight > 0)),
        sideContent: String(Boolean(side)),
      },
    };
    /* eslint-enable @typescript-eslint/no-explicit-any */
  });
  return { structure: structure({ viewTabs: r.sections, columns: r.facets, actions: r.header.filter((t) => t !== 'Share'), editingStatus: r.footer }), text: [r.layout] };
}

async function feEdit(page: Page) {
  // press the UI5 button (a pointer click on the title can land on the title's toggle area)
  await page.evaluate(() => {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any -- the UI5 control tree is untyped here */
    const all: any[] = (window as any).sap.ui.require('sap/ui/core/ElementRegistry').filter(() => true);
    all.find((e) => e.isA('sap.m.Button') && e.getText?.() === 'Edit' && e.getDomRef())?.firePress();
  });
  // the draft is open when the footer offers Save
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(1000);
}

async function feSideContent(page: Page) {
  await page.getByRole('tab', { name: /Delivery Timeline/ }).first().click();
  await page.getByRole('button', { name: 'Supplier Information', exact: true }).click();
  await page.waitForTimeout(800);
}

// ---------------------------------------------------------------------------------------------- smart-kit

async function openSk(page: Page, query: string) {
  await page.goto(`${DEMO}/purchasing-draft/object?path=${encodeURIComponent(`PurchaseOrders(${KEY})`)}${query}&lang=en`);
  await expect(page.locator('[data-sk-heading]')).toHaveText(ORDER, { timeout: 60_000 });
  await page.waitForTimeout(500);
}

async function readSk(page: Page): Promise<{ structure: Structure; text: TextRows }> {
  const r = await page.evaluate(() => {
    const visible = (el: Element | null) => Boolean(el && (el as HTMLElement).offsetHeight > 0);
    const root = document.querySelector('[data-sk-section-layout]')!;
    const sections = [...document.querySelectorAll('[data-sk-anchor]')].map((a) => a.getAttribute('data-sk-anchor')!).filter((x, i, a) => a.indexOf(x) === i);
    const facetsEl = document.querySelector('.sk-object-header__facets');
    const facets = visible(facetsEl) ? [...facetsEl!.querySelectorAll('[data-sk-facet]')].map((f) => f.getAttribute('data-sk-facet')!) : [];
    const header = [...document.querySelectorAll('.sk-dynamic-page__actions button, [data-sk-heading-actions] button, .sk-dynamic-page-title__actions button')]
      .filter((b) => visible(b) && !b.closest('[data-sk-footer]')).map((b) => (b.textContent ?? '').trim()).filter(Boolean);
    const footer = [...document.querySelectorAll('[data-sk-footer] button')].filter((b) => visible(b) && !b.closest('[data-sk-message-button], .sk-message-button'))
      .map((b) => (b.textContent ?? '').trim()).filter((t) => t && !/^\d+$/.test(t));
    return {
      sections,
      facets,
      header,
      footer,
      layout: {
        sectionLayout: root.getAttribute('data-sk-section-layout')!,
        anchorBar: String(sections.length > 0),
        headerContent: String(facets.length > 0),
        sideContent: String(visible(document.querySelector('[data-sk-side-content="Custom::Timeline"]'))),
      },
    };
  });
  return { structure: structure({ viewTabs: r.sections, columns: r.facets, actions: r.header, editingStatus: r.footer }), text: [r.layout] };
}

async function skEdit(page: Page) {
  await page.locator('[data-sk-action="Edit"]').click();
  await expect(page.locator('[data-sk-save]')).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(1000);
}

async function skSideContent(page: Page) {
  await page.locator('[data-sk-anchor="Custom::Timeline"]').first().click();
  await page.locator('[data-sk-action="Custom::SupplierInfo"]').click();
  await page.waitForTimeout(500);
}

// ---------------------------------------------------------------------------------------------- run

async function snapshot(browser: Browser, s: Scenario, side: 'fe' | 'sk'): Promise<Snapshot> {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    expect((await page.request.post(`${MOCK}/test/reset`)).ok()).toBeTruthy();
    if (side === 'fe') await openFe(page, s.fe);
    else await openSk(page, s.sk);
    if (s.edit) await (side === 'fe' ? feEdit(page) : skEdit(page));
    if (s.sideContent) await (side === 'fe' ? feSideContent(page) : skSideContent(page));
    const { structure: st, text } = side === 'fe' ? await readFe(page) : await readSk(page);
    // the object page requests are stage 6 (annotations), see the file comment
    return { requests: [], structure: st, text };
  } finally {
    await context.close();
  }
}

for (const s of SCENARIOS) {
  test(`AL-13 FE comparison: ${s.name}`, async ({ browser }) => {
    const fe = await snapshot(browser, s, 'fe');
    const sk = await snapshot(browser, s, 'sk');
    expect(fe.structure.viewTabs.length, 'FE sections').toBeGreaterThan(0);
    expect(sk.structure.viewTabs.length, 'smart-kit sections').toBeGreaterThan(0);
    compareScenario(s.name, fe, sk);
  });
}
