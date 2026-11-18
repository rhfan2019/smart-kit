/**
 * Stage 4 tail, group "cols5" (docs/29 §5 表格列 and 动作, D43 "留给阶段 4 收尾"): the column and action types that had
 * unit tests only (packages/core/test/al-cols.test.ts, packages/react/test/al-cols.test.tsx), against real Fiori
 * elements 1.154 (AL-10 – AL-12). The annotations each scenario needs are laid over the purchasing `$metadata` in the
 * browser, identically for the FE reference app (`?app=purchasing`) and the smart-kit demo (`/po`), so the shared test
 * service and the other scenarios stay unchanged. Besides the generic comparison (requests, columns, toolbar actions,
 * cell text) the row highlights, the enabled state of the toolbar actions after a selection, the confirmation dialog
 * texts and the personalization dialog's properties are compared. The last test checks that expanding the header of
 * `/contacts` does not request the list again (FE neither).
 */
import { expect, test, type Browser, type Page } from '@playwright/test';
import type { Snapshot } from './compare';
import { DEMO, FE, MOCK, openFe, openSk, readFe, readSk, RequestRecorder } from './collect';
import { compareScenario } from './harness';

type Side = 'fe' | 'sk';
type Overlay = (xml: string) => string;

// ---------------------------------------------------------------------------------------------- $metadata overlay

/** Adds `<Annotations>` elements (or other schema children) at the end of the Purchasing schema. */
function addToSchema(xml: string, content: string): string {
  const schema = xml.indexOf('<Schema Namespace="Purchasing"');
  const end = xml.indexOf('</Schema>', schema);
  expect(end).toBeGreaterThan(0);
  return `${xml.slice(0, end)}${content}\n    ${xml.slice(end)}`;
}

/** Adds bound actions of the purchase order before the entity container (metadata only; they are never run). */
function addActions(xml: string, names: string[]): string {
  const at = xml.indexOf('<EntityContainer Name="Container">');
  expect(at).toBeGreaterThan(0);
  const actions = names.map((n) => `<Action Name="${n}" IsBound="true"><Parameter Name="_it" Type="Purchasing.PurchaseOrder" Nullable="false"/><ReturnType Type="Purchasing.PurchaseOrder" Nullable="false"/></Action>\n      `).join('');
  return xml.slice(0, at) + actions + xml.slice(at);
}

/** Replaces the records of the unqualified UI.LineItem of the purchase order; `inner` goes after the collection. */
function replaceLineItem(xml: string, records: string, inner = ''): string {
  const target = xml.indexOf('<Annotations Target="Purchasing.PurchaseOrder">');
  const start = xml.indexOf('<Annotation Term="UI.LineItem">', target);
  const col = xml.indexOf('<Collection>', start) + '<Collection>'.length;
  const end = xml.indexOf('</Collection>', col);
  expect(start).toBeGreaterThan(0);
  return `${xml.slice(0, col)}${records}${xml.slice(end, end + '</Collection>'.length)}${inner}${xml.slice(end + '</Collection>'.length)}`;
}

/** Replaces the first occurrence of `from` after `<Annotations Target="target">`. */
function replaceIn(xml: string, target: string, from: string, to: string): string {
  const at = xml.indexOf(`<Annotations Target="${target}">`);
  const i = at < 0 ? -1 : xml.indexOf(from, at);
  expect(i, `${target}: ${from}`).toBeGreaterThan(0);
  return xml.slice(0, i) + to + xml.slice(i + from.length);
}

const DF = (path: string, extra = '') => `<Record Type="UI.DataField"><PropertyValue Property="Value" Path="${path}"/>${extra}</Record>`;
const ACTION = (name: string, label: string, extra = '') => `<Record Type="UI.DataFieldForAction"><PropertyValue Property="Label" String="${label}"/><PropertyValue Property="Action" String="Purchasing.${name}"/>${extra}</Record>`;

/**
 * Every column type of docs/29 §5 in one LineItem: DataFieldWithNavigationPath, a rating and a progress data point,
 * a field group, connected fields, a contact, DataFieldWithIntentBasedNavigation (no navigation target: value only,
 * D42), DataFieldWithAction, HTML5.CssDefaults width, DataFieldWithActionGroup, an inline action, a Determining
 * action, an action group, a copy action, a critical action; the row highlight from LineItem@UI.Criticality.
 */
const TYPES_RECORDS = [
  DF('PurchaseOrder'),
  `<Record Type="UI.DataFieldWithNavigationPath"><PropertyValue Property="Value" Path="Supplier"/><PropertyValue Property="Target" NavigationPropertyPath="_Supplier"/></Record>`,
  `<Record Type="UI.DataFieldForAnnotation"><PropertyValue Property="Label" String="Supplier Rating"/><PropertyValue Property="Target" AnnotationPath="_Supplier/@UI.DataPoint#Rating"/></Record>`,
  `<Record Type="UI.DataFieldForAnnotation"><PropertyValue Property="Label" String="Dates"/><PropertyValue Property="Target" AnnotationPath="@UI.FieldGroup#Cols5Dates"/></Record>`,
  `<Record Type="UI.DataFieldForAnnotation"><PropertyValue Property="Label" String="Net / Budget"/><PropertyValue Property="Target" AnnotationPath="@UI.ConnectedFields#Cols5Amounts"/></Record>`,
  `<Record Type="UI.DataFieldForAnnotation"><PropertyValue Property="Label" String="Contact"/><PropertyValue Property="Target" AnnotationPath="@Communication.Contact"/></Record>`,
  DF('Status', '<PropertyValue Property="Criticality" Path="StatusCriticality"/>'),
  `<Record Type="UI.DataFieldWithIntentBasedNavigation"><PropertyValue Property="Value" Path="CompanyCode"/><PropertyValue Property="SemanticObject" String="CompanyCode"/><PropertyValue Property="Action" String="display"/></Record>`,
  `<Record Type="UI.DataFieldWithAction"><PropertyValue Property="Value" Path="PurchasingGroup"/><PropertyValue Property="Action" String="Purchasing.approve"/></Record>`,
  DF('NetAmount', '<Annotation Term="HTML5.CssDefaults"><Record Type="HTML5.CssDefaultsType"><PropertyValue Property="width" String="15em"/></Record></Annotation>'),
  `<Record Type="UI.DataFieldForAnnotation"><PropertyValue Property="Label" String="Delivery Progress"/><PropertyValue Property="Target" AnnotationPath="@UI.DataPoint#Delivery"/></Record>`,
  `<Record Type="UI.DataFieldWithActionGroup"><PropertyValue Property="ID" String="TypeActions"/><PropertyValue Property="Value" Path="PurchaseOrderType"/><PropertyValue Property="Actions"><Collection>${ACTION('cols5Hold', 'Hold')}${ACTION('cols5Release', 'Release')}</Collection></PropertyValue></Record>`,
  ACTION('approve', 'Approve'),
  ACTION('reject', 'Reject'),
  ACTION('close', 'Close', '<PropertyValue Property="Inline" Bool="true"/>'),
  ACTION('cols5Determining', 'Finalize', '<PropertyValue Property="Determining" Bool="true"/>'),
  `<Record Type="UI.DataFieldForActionGroup"><PropertyValue Property="ID" String="Follow"/><PropertyValue Property="Label" String="Follow-Up"/><PropertyValue Property="Actions"><Collection>${ACTION('cols5Remind', 'Remind')}${ACTION('cols5Escalate', 'Escalate')}</Collection></PropertyValue></Record>`,
  ACTION('cols5Copy', 'Duplicate', '<Annotation Term="UI.IsCopyAction" Bool="true"/>'),
  ACTION('cols5Check', 'Check'),
].join('\n            ');

const TYPES_ANNOTATIONS = `
      <Annotations Target="Purchasing.PurchaseOrder">
        <Annotation Term="UI.FieldGroup" Qualifier="Cols5Dates"><Record Type="UI.FieldGroupType"><PropertyValue Property="Label" String="Dates"/><PropertyValue Property="Data"><Collection>
          ${DF('OrderDate')}${DF('CreatedAt')}
        </Collection></PropertyValue></Record></Annotation>
        <Annotation Term="UI.ConnectedFields" Qualifier="Cols5Amounts"><Record Type="UI.ConnectedFieldsType">
          <PropertyValue Property="Label" String="Net / Budget"/>
          <PropertyValue Property="Template" String="{Net} / {Budget}"/>
          <PropertyValue Property="Data"><Record Type="Core.Dictionary">
            <PropertyValue Property="Net">${DF('NetAmount')}</PropertyValue>
            <PropertyValue Property="Budget">${DF('BudgetAmount')}</PropertyValue>
          </Record></PropertyValue>
        </Record></Annotation>
        <Annotation Term="Communication.Contact"><Record Type="Communication.ContactType"><PropertyValue Property="fn" Path="Description"/></Record></Annotation>
      </Annotations>
      <Annotations Target="Purchasing.cols5Check(Purchasing.PurchaseOrder)"><Annotation Term="Common.IsActionCritical" Bool="true"/></Annotations>`;

const TYPES: Overlay = (xml) =>
  addToSchema(
    replaceLineItem(addActions(xml, ['cols5Hold', 'cols5Release', 'cols5Determining', 'cols5Remind', 'cols5Escalate', 'cols5Copy', 'cols5Check']), TYPES_RECORDS, '\n          <Annotation Term="UI.Criticality" Path="StatusCriticality"/>'),
    TYPES_ANNOTATIONS,
  );

/** A constant row highlight (LineItem@UI.Criticality with an EnumMember). */
const CONSTANT = (criticality: string): Overlay => (xml) => replaceLineItem(xml, [DF('PurchaseOrder'), DF('Supplier'), DF('Status'), DF('NetAmount'), ACTION('approve', 'Approve'), ACTION('reject', 'Reject')].join(''), `<Annotation Term="UI.Criticality" EnumMember="UI.CriticalityType/${criticality}"/>`);

/** UI.CreateHidden and UI.DeleteHidden on the entity set (constants). */
const HIDDEN: Overlay = (xml) =>
  addToSchema(xml, `
      <Annotations Target="Purchasing.Container/PurchaseOrders"><Annotation Term="UI.CreateHidden" Bool="true"/><Annotation Term="UI.DeleteHidden" Bool="true"/></Annotations>`);

/** DeleteRestrictions/Deletable as a path: only orders that can be approved are deletable (first row yes, second no). */
const DELETABLE_PATH: Overlay = (xml) =>
  replaceIn(xml, 'Purchasing.Container/PurchaseOrders', '<PropertyValue Property="Deletable" Bool="true"/>', '<PropertyValue Property="Deletable" Path="ApproveEnabled"/>');

async function overlay(page: Page, change: Overlay) {
  // read from the test service directly: the FE app's proxy answers with Content-Length and Transfer-Encoding,
  // which route.fetch rejects; the purchasing (non-draft) metadata is not changed by that proxy
  await page.route(/\/odata\/purchasing\/\$metadata/, async (route) => {
    const url = new URL(route.request().url());
    const headers = await route.request().allHeaders();
    const res = await fetch(`${MOCK}${url.pathname}${url.search}`, { headers: { 'accept-language': headers['accept-language'] ?? 'en' } });
    await route.fulfill({ status: res.status, contentType: res.headers.get('content-type') ?? 'application/xml', body: change(await res.text()) });
  });
}

/** FE: the purchasing manifest with a different table type (for the responsive table's personalization). */
async function feTableType(page: Page, type: string) {
  await page.route(/\/purchasing\/manifest\.json/, async (route) => {
    const res = await route.fetch();
    const manifest = await res.json();
    manifest['sap.ui5'].routing.targets.PurchaseOrdersList.options.settings.controlConfiguration['@com.sap.vocabularies.UI.v1.LineItem'].tableSettings.type = type;
    await route.fulfill({ response: res, json: manifest });
  });
}

// ---------------------------------------------------------------------------------------------- reading

/** Row highlights of the first rows (FE RowSettings highlight / smart-kit data-sk-highlight), "None" when none. */
async function highlights(page: Page, side: Side, rows = 5): Promise<string[]> {
  if (side === 'fe') {
    return page.evaluate((n) => {
      /* eslint-disable @typescript-eslint/no-explicit-any -- the UI5 control tree is untyped here */
      const w = window as any;
      const table = w.sap.ui.require('sap/ui/core/ElementRegistry').filter((e: any) => e.isA('sap.ui.mdc.Table')).find((x: any) => x.getDomRef());
      return table._oTable.getRows().slice(0, n).map((r: any) => String(r.getAggregation('_settings')?.getHighlight() ?? 'None'));
      /* eslint-enable @typescript-eslint/no-explicit-any */
    }, rows);
  }
  return page.evaluate((n) => {
    const out: string[] = [];
    const name: Record<string, string> = { error: 'Error', warning: 'Warning', success: 'Success', information: 'Information' };
    for (let i = 0; i < n; i++) {
      const row = document.querySelector(`[data-sk-table] .ag-row[row-index="${i}"]:not(.ag-row-pinned)`);
      const state = /sk-table__row--(\w+)/.exec(row?.className ?? '')?.[1];
      out.push((state && name[state]) ?? 'None');
    }
    return out;
  }, rows);
}

/** Column widths in px (header → width): FE the declared column width, smart-kit the rendered header cell. */
async function columnWidths(page: Page, side: Side, headers: string[]): Promise<Record<string, number>> {
  return page.evaluate(({ side, headers }) => {
    const out: Record<string, number> = {};
    if (side === 'fe') {
      /* eslint-disable @typescript-eslint/no-explicit-any -- the UI5 control tree is untyped here */
      const w = window as any;
      const table = w.sap.ui.require('sap/ui/core/ElementRegistry').filter((e: any) => e.isA('sap.ui.mdc.Table')).find((x: any) => x.getDomRef());
      // the declared width (the grid table may squeeze the rendered one when the columns do not fit): em / rem at 16px
      for (const c of table.getColumns()) {
        if (!headers.includes(c.getHeader())) continue;
        const m = /^([\d.]+)(px|em|rem)$/.exec(String(c.getWidth()));
        out[c.getHeader()] = m ? Math.round(Number(m[1]) * (m[2] === 'px' ? 1 : 16)) : -1;
      }
      /* eslint-enable @typescript-eslint/no-explicit-any */
    } else {
      document.querySelectorAll('[data-sk-table] .ag-header-row-column .ag-header-cell[col-id]').forEach((h) => {
        const label = (h.querySelector('.ag-header-cell-text')?.textContent ?? '').trim();
        if (headers.includes(label)) out[label] = Math.round(h.getBoundingClientRect().width);
      });
    }
    return out;
  }, { side, headers });
}

/** Selects table rows by index (FE: the grid table's selection plugin; smart-kit: the row checkboxes). */
async function selectRows(page: Page, side: Side, indexes: number[]) {
  if (side === 'fe') {
    for (const i of indexes) {
      await page.locator('.sapUiTableRowSelectionCell:not(.sapUiTableHeaderCell)').nth(i).click({ modifiers: indexes.length > 1 ? ['ControlOrMeta'] : [] });
    }
  } else {
    for (const i of indexes) await page.locator(`[data-sk-table] .ag-row[row-index="${i}"]:not(.ag-row-pinned) .ag-selection-checkbox input`).first().check();
  }
  await page.waitForTimeout(500);
}

/** Text of the open confirmation dialog (title, message, buttons). */
async function dialogText(page: Page, side: Side): Promise<{ title: string; text: string; buttons: string[] }> {
  if (side === 'fe') {
    const dialog = page.locator('.sapMDialog:visible').last();
    await expect(dialog).toBeVisible();
    const title = (await dialog.locator('.sapMDialogTitleGroup, .sapMTitle').first().innerText()).trim();
    const text = (await dialog.locator('.sapMDialogScrollCont').innerText()).trim().replace(/\s+/g, ' ');
    const buttons = (await dialog.locator('footer .sapMBtn, .sapMDialogFooter .sapMBtn').allInnerTexts()).map((s) => s.trim()).filter(Boolean);
    return { title, text, buttons };
  }
  const dialog = page.getByRole('dialog').last();
  await expect(dialog).toBeVisible();
  const title = (await dialog.locator('h2, .mantine-Modal-title').first().innerText()).trim();
  // the message without the footer buttons
  const text = (await dialog.locator('.mantine-Modal-body').evaluate((el) => {
    let all = (el as HTMLElement).innerText;
    for (const b of el.querySelectorAll('button')) all = all.replace((b as HTMLElement).innerText, '');
    return all;
  })).trim().replace(/\s+/g, ' ');
  const buttons = (await dialog.getByRole('button').allInnerTexts()).map((s) => s.trim()).filter(Boolean);
  return { title, text, buttons };
}

async function clickAction(page: Page, side: Side, text: string) {
  if (side === 'fe') {
    await page.locator('.sapMTB .sapMBtn:visible', { hasText: text }).first().click({ timeout: 10_000 });
  } else {
    await page.locator('[data-sk-table] .sk-table__toolbar-actions [data-sk-action]', { hasText: text }).first().click({ timeout: 10_000 });
  }
}

// ---------------------------------------------------------------------------------------------- snapshots

interface Extra {
  highlights: string[];
  widths?: Record<string, number>;
  afterOne?: string[];
  afterTwo?: string[];
  critical?: { title: string; text: string; buttons: string[] };
  remove?: { title: string; text: string; buttons: string[] };
}

interface Scenario {
  name: string;
  overlay: Overlay;
  widths?: string[];
  /** Row indexes to select one after the other; the toolbar is read after the first and after the second. */
  select?: [number, number];
  critical?: string;
  remove?: boolean;
  deletable?: boolean;
}

const SCENARIOS: Scenario[] = [
  { name: 'cols5-types', overlay: TYPES, widths: ['Net Amount'], select: [0, 1], critical: 'Check' },
  { name: 'cols5-negative', overlay: CONSTANT('Negative') },
  { name: 'cols5-very-negative', overlay: CONSTANT('VeryNegative') },
  { name: 'cols5-very-positive', overlay: CONSTANT('VeryPositive') },
  { name: 'cols5-create-delete-hidden', overlay: HIDDEN },
  { name: 'cols5-deletable-path', overlay: DELETABLE_PATH, select: [1, 0], remove: true },
];

async function snapshot(browser: Browser, s: Scenario, side: Side): Promise<Snapshot & { extra: Extra }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    if (process.env.COLS5_DEBUG) page.on('console', (m) => { if (m.type() === 'error') console.log(`[${side}] ${m.text().slice(0, 400)}`); });
    await overlay(page, s.overlay);
    expect((await page.request.post(`${MOCK}/test/reset`)).ok()).toBeTruthy();
    const rec = new RequestRecorder(page);
    if (side === 'fe') await openFe(page, 'purchasing');
    else await openSk(page, '/po');
    await rec.idle(page);
    const requests = rec.requests;
    const { structure, text } = side === 'fe' ? await readFe(page) : await readSk(page);
    const extra: Extra = { highlights: await highlights(page, side) };
    if (s.widths) extra.widths = await columnWidths(page, side, s.widths);
    if (s.select) {
      await selectRows(page, side, [s.select[0]]);
      extra.afterOne = (side === 'fe' ? await readFe(page) : await readSk(page)).structure.actions;
      await selectRows(page, side, [s.select[1]]);
      extra.afterTwo = (side === 'fe' ? await readFe(page) : await readSk(page)).structure.actions;
    }
    if (s.critical) {
      await clickAction(page, side, s.critical);
      extra.critical = await dialogText(page, side);
      await page.keyboard.press('Escape');
    }
    if (s.remove) {
      await clickAction(page, side, 'Delete');
      extra.remove = await dialogText(page, side);
      await page.keyboard.press('Escape');
    }
    return { requests, structure, text, extra };
  } finally {
    await context.close();
  }
}

for (const s of SCENARIOS) {
  test(`AL-10 AL-11 AL-12 FE comparison: ${s.name}`, async ({ browser }) => {
    const fe = await snapshot(browser, s, 'fe');
    if (process.env.COLS5_PROBE) {
      console.log(JSON.stringify({ scenario: s.name, fe: fe.requests, structure: fe.structure, text: fe.text.slice(0, 2), extra: fe.extra }, null, 1));
      return;
    }
    const sk = await snapshot(browser, s, 'sk');
    if (process.env.COLS5_DEBUG) console.log(JSON.stringify({ scenario: s.name, feA: fe.structure.actions, skA: sk.structure.actions, feX: fe.extra, skX: sk.extra }));
    expect(fe.text.length, 'FE rows').toBeGreaterThan(0);
    expect(sk.text.length, 'smart-kit rows').toBeGreaterThan(0);
    expect(sk.structure.columns, 'column headers').toEqual(fe.structure.columns);
    // the non-draft list keeps "Create" (FE templates it only with draft or sticky sessions; DV-FE-04)
    const withoutCreate = (a: string[] | undefined) => a?.filter((x) => !x.startsWith('Create'));
    expect(withoutCreate(sk.structure.actions), 'toolbar actions').toEqual(withoutCreate(fe.structure.actions));
    expect(withoutCreate(sk.extra.afterOne), 'toolbar actions, one row selected').toEqual(withoutCreate(fe.extra.afterOne));
    expect(withoutCreate(sk.extra.afterTwo), 'toolbar actions, two rows selected').toEqual(withoutCreate(fe.extra.afterTwo));
    expect(sk.extra.highlights, 'row highlights').toEqual(fe.extra.highlights);
    if (s.widths) for (const h of s.widths) expect(Math.abs(sk.extra.widths![h]! - fe.extra.widths![h]!), `width of ${h}`).toBeLessThanOrEqual(4);
    if (s.critical) expect(sk.extra.critical, 'critical action confirmation').toEqual(fe.extra.critical);
    if (s.remove) expect(sk.extra.remove, 'delete confirmation').toEqual(fe.extra.remove);
    compareScenario(s.name, fe, sk);
  });
}

// ---------------------------------------------------------------------------------------------- personalization

interface P13n { columns: string[]; sort: string[]; group?: string[] }

/** FE: the properties offered by the table personalization (sap.ui.mdc p13n panels), from its property helper. */
async function feP13n(page: Page): Promise<P13n> {
  const table = page.locator('.sapUiMdcTable').first();
  await table.locator('.sapMBtn[id$="-settings"]').first().click({ timeout: 20_000 });
  const dialog = page.locator('.sapMDialog:visible').last();
  await expect(dialog).toBeVisible({ timeout: 30_000 });
  const read = async () => page.evaluate(() => {
    /* eslint-disable @typescript-eslint/no-explicit-any -- the UI5 control tree is untyped here */
    const w = window as any;
    const all = w.sap.ui.require('sap/ui/core/ElementRegistry').filter(() => true);
    const panel = (t: string) => all.filter((e: any) => e.isA(t) && e.getDomRef());
    const sel = panel('sap.m.p13n.SelectionPanel')[0];
    const columns = sel ? sel.getP13nData().map((x: any) => x.label) : [];
    const sortPanel = panel('sap.m.p13n.SortPanel')[0];
    const groupPanel = panel('sap.m.p13n.GroupPanel')[0];
    const labels = (p: any) => (p ? p.getP13nData().map((x: any) => x.label) : undefined);
    return { columns, sort: labels(sortPanel), group: labels(groupPanel), tabs: all.filter((e: any) => e.isA('sap.m.IconTabBar') && e.getDomRef()?.closest('.sapMDialog')).flatMap((t: any) => t.getItems().map((i: any) => i.getText())) };
    /* eslint-enable @typescript-eslint/no-explicit-any */
  });
  const first = await read();
  const out: P13n = { columns: first.columns, sort: first.sort ?? [] };
  for (const tab of first.tabs as string[]) {
    await dialog.getByRole('tab', { name: tab }).click();
    await page.waitForTimeout(500);
    const r = await read();
    if (r.sort && !out.sort.length) out.sort = r.sort;
    if (r.group) out.group = r.group;
  }
  if (process.env.COLS5_DEBUG) console.log(JSON.stringify({ feTabs: first.tabs }));
  await page.keyboard.press('Escape');
  return out;
}

async function skP13n(page: Page): Promise<P13n> {
  await page.locator('[data-sk-table] [data-sk-table-settings]').first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const columns = (await dialog.locator('.sk-p13n__row label').allInnerTexts()).map((s) => s.trim());
  await dialog.locator('[data-sk-p13n-sort-tab]').click();
  await dialog.locator('[data-sk-p13n-sort-field]').last().click();
  const sort = (await page.getByRole('option').allInnerTexts()).map((s) => s.trim());
  await page.keyboard.press('Escape');
  const out: P13n = { columns, sort };
  if (await dialog.locator('[data-sk-p13n-group-tab]').count()) {
    await dialog.locator('[data-sk-p13n-group-tab]').click();
    await dialog.locator('[data-sk-p13n-group]').click();
    out.group = (await page.getByRole('option').allInnerTexts()).map((s) => s.trim()).filter((s) => s !== 'No grouping');
    await page.keyboard.press('Escape');
  }
  await page.keyboard.press('Escape');
  return out;
}

for (const type of ['GridTable', 'ResponsiveTable'] as const) {
  test(`AL-10 AL-11 AL-12 FE comparison: cols5-p13n-${type} (properties offered for columns, sort and group)`, async ({ browser }) => {
    const read = async (side: Side): Promise<P13n> => {
      const context = await browser.newContext();
      const page = await context.newPage();
      try {
        expect((await page.request.post(`${MOCK}/test/reset`)).ok()).toBeTruthy();
        if (side === 'fe') {
          if (type !== 'GridTable') await feTableType(page, type);
          await page.goto(`${FE}/index.html?app=purchasing`);
          await expect(page.locator('.sapUiMdcTable').first()).toBeVisible({ timeout: 90_000 });
          await page.waitForTimeout(3000);
          return await feP13n(page);
        }
        if (type === 'GridTable') await openSk(page, '/po');
        else {
          await page.goto(`${DEMO}/po?table=responsive&lang=en`);
          await expect(page.locator('[data-sk-table] tr[data-sk-row]').first()).toBeVisible({ timeout: 60_000 });
        }
        return await skP13n(page);
      } finally {
        await context.close();
      }
    };
    const fe = await read('fe');
    if (process.env.COLS5_PROBE) { console.log(JSON.stringify({ type, fe }, null, 1)); return; }
    const sk = await read('sk');
    if (process.env.COLS5_DEBUG) console.log(JSON.stringify({ type, fe, sk }, null, 1));
    expect(sk.columns, 'columns panel').toEqual(fe.columns);
    expect([...sk.sort].sort(), 'sort panel').toEqual([...fe.sort].sort());
    expect(sk.group && [...sk.group].sort(), 'group panel').toEqual(fe.group && [...fe.group].sort());
  });
}

// ---------------------------------------------------------------------------------------------- header expand

test('AL-10 cols5-contacts-expand-header: expanding the collapsed header does not request the list again (FE neither)', async ({ browser }) => {
  const run = async (side: Side) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      expect((await page.request.post(`${MOCK}/test/reset`)).ok()).toBeTruthy();
      const rec = new RequestRecorder(page);
      if (side === 'fe') {
        await page.goto(`${FE}/index.html?app=purchasing-display`);
        await expect(page.locator('.sapUiMdcTable .sapUiTableRow').first()).toBeVisible({ timeout: 90_000 });
      } else {
        await page.goto(`${DEMO}/contacts?lang=en`);
        await expect(page.locator('[data-sk-table] .ag-row[row-index="0"] [col-id]').first()).toBeVisible({ timeout: 60_000 });
      }
      await rec.idle(page);
      const first = rec.requests.filter((r) => r.resource === 'SupplierContacts').length;
      rec.reset();
      const toggle = async (collapse: boolean) => {
        if (side === 'fe') {
          await page.evaluate((c) => {
            /* eslint-disable @typescript-eslint/no-explicit-any -- the UI5 control tree is untyped here */
            const w = window as any;
            const dp = w.sap.ui.require('sap/ui/core/ElementRegistry').filter((e: any) => e.isA('sap.f.DynamicPage') && e.getDomRef())[0];
            dp.setHeaderExpanded(!c);
            /* eslint-enable @typescript-eslint/no-explicit-any */
          }, collapse);
        } else {
          const name = collapse ? /^(Hide Filters|Collapse Header)$/ : /^(Show Filters|Expand Header)$/;
          const button = page.getByRole('button', { name });
          if (await button.isVisible()) await button.click();
        }
        await page.waitForTimeout(500);
      };
      // the smart-kit header starts collapsed when the table fills the page: expand, collapse, expand
      await toggle(false);
      await toggle(true);
      await toggle(false);
      if (side === 'fe') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the UI5 control tree is untyped here
        expect(await page.evaluate(() => (window as any).sap.ui.require('sap/ui/core/ElementRegistry').filter((e: any) => e.isA('sap.f.DynamicPage') && e.getDomRef())[0].getHeaderExpanded())).toBe(true);
      } else await expect(page.locator('[data-sk-filter]').first()).toBeVisible();
      await rec.idle(page);
      return { first, after: rec.requests.map((r) => r.resource) };
    } finally {
      await context.close();
    }
  };
  const fe = await run('fe');
  const sk = await run('sk');
  expect(fe.first).toBe(1);
  expect(sk.first).toBe(1);
  expect(fe.after).toEqual([]);
  expect(sk.after).toEqual([]);
});
