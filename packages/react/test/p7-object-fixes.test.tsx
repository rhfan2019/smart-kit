/**
 * Object page fixes of docs/25 (S33, S34, S41, S42, S43) and the block / form column steps:
 * footer actions at the end of the toolbar, `onActionDone`, overrides of annotation sections and actions hidden by
 * UI.Hidden, the first section's title under the anchor bar, column steps by container width.
 */
import { MantineProvider } from '@mantine/core';
import { buildModel, MemoryProvider, MemoryVariantStore, type Row } from '@rhfan2019/smart-kit-core';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ReactNode } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { SmartKitProvider, smartKitMantineTheme } from '../src';
import ObjectPage, { type $ObjectPageSettings } from '@rhfan2019/smart-kit/v4/fe/templates/ObjectPage';
import ObjectPageLayout from '@rhfan2019/smart-kit/uxap/ObjectPageLayout';

beforeAll(() => {
  (window as unknown as { getBoundingClientRect(): Partial<DOMRect> }).getBoundingClientRect = () => ({ top: 0, bottom: 0, height: 0 });
  if (!('fonts' in document)) Object.defineProperty(document, 'fonts', { configurable: true, value: { addEventListener() {}, removeEventListener() {}, ready: Promise.resolve() } });
});

const xml = readFileSync(join(import.meta.dirname, '../../../apps/mock/Csdl/purchasing.template.xml'), 'utf8').replace(/\{\{label:([^}]+)\}\}/g, '$1');
const APPROVE = 'DataFieldForAction::Purchasing.approve';
const REJECT = 'DataFieldForAction::Purchasing.reject';
/** The test service; `hide` adds UI.Hidden paths: the Notes section is hidden while `HideNotes`, approve while `HideApprove` is true. */
function modelOf(hide = false) {
  const model = buildModel(xml);
  const ui = model.ui['Purchasing.PurchaseOrder']!;
  if (hide) {
    ui.sections.find((s) => s.id === 'NotesSection')!.hidden = 'HideNotes';
    ui.objectActions.find((a) => a.id === APPROVE)!.hidden = 'HideApprove';
  }
  return model;
}
const order = (id: string, more: Row = {}): Row => ({ PurchaseOrder: id, Description: `Order ${id}`, Supplier: 'S1', ApproveEnabled: true, CloseEnabled: true, Status: 'NEW', Currency: 'EUR', NetAmount: '10', '@odata.etag': 'W/"1"', ...more });

function host(children: ReactNode, o: { hide?: boolean; row?: Row } = {}) {
  const model = modelOf(o.hide);
  const provider = new MemoryProvider({
    model, data: { PurchaseOrders: [order('1', o.row)], PurchaseOrderItems: [], Suppliers: [] },
    actions: { 'Purchasing.approve': (row) => ({ ...row, Status: 'APPROVED' }) },
  });
  return (
    <MantineProvider theme={smartKitMantineTheme}>
      <SmartKitProvider services={{ p: { model, dataProvider: provider, variants: new MemoryVariantStore() } }} locale="en" namespace={`p7${Math.random()}`}>{children}</SmartKitProvider>
    </MantineProvider>
  );
}
const page = (p: Partial<$ObjectPageSettings>) => <ObjectPage service="p" path="PurchaseOrders('1')" sectionLayout="Page" additionalProperties={['HideNotes', 'HideApprove']} {...p} />;
const heading = () => document.querySelector('[data-sk-heading]')?.textContent;
const sectionIds = () => [...document.querySelectorAll('[data-sk-section]')].map((s) => s.getAttribute('data-sk-section'));
const anchors = () => [...document.querySelectorAll('[data-sk-anchor]')].map((s) => s.textContent);
const footerButtons = () => [...document.querySelectorAll('[data-sk-footer] [data-sk-overflow-toolbar] button')].map((b) => `${b.getAttribute('data-sk-action')}|${b.textContent}|${b.getAttribute('data-variant')}`);

describe('S33 footer toolbar', () => {
  it('S33 the footer toolbar starts with a ToolbarSpacer: the actions follow it (FE FooterContent)', async () => {
    render(host(page({})));
    await waitFor(() => expect(heading()).toBe('1'));
    const items = [...document.querySelectorAll('[data-sk-footer] [data-sk-overflow-toolbar] > [data-sk-toolbar-item]')];
    expect(items[0]!.querySelector('[data-sk-toolbar-spacer]')).not.toBeNull();
    expect(items[0]!.className).toContain('sk-overflow-toolbar__item--grow');
    expect(items.slice(1).map((el) => el.querySelector('button')?.getAttribute('data-sk-action'))).toEqual([APPROVE, REJECT]);
  });
});

describe('S34 onActionDone', () => {
  it('S34 onActionDone gets the ActionResult of a footer annotation action after it has run', async () => {
    const done = vi.fn();
    render(host(page({ onActionDone: done })));
    await waitFor(() => expect(heading()).toBe('1'));
    fireEvent.click(document.querySelector(`[data-sk-footer] [data-sk-action="${APPROVE}"]`)!);
    await waitFor(() => expect(done).toHaveBeenCalledTimes(1));
    const result = done.mock.calls[0]![0];
    expect(result.action.id).toBe(APPROVE);
    expect(result.processed).toHaveLength(1);
    expect(result.processed[0].target.path).toBe("PurchaseOrders('1')");
    expect(result.processed[0].row.Status).toBe('APPROVED');
    expect(result.failed).toEqual([]);
  });
});

describe('S41 override of an annotation section hidden by UI.Hidden', () => {
  const override = { content: { body: { sections: { NotesSection: { messageStrip: <div data-test-strip>strip</div>, subSections: { Extra: { title: 'Extra', template: () => <div data-test-extra>x</div> } } } } } } };

  it('S41 the override changes only the keys it gives: title and sub-sections of the annotation stay', async () => {
    render(host(page(override), { hide: true, row: { HideNotes: false } }));
    await waitFor(() => expect(heading()).toBe('1'));
    expect(sectionIds()).toEqual(['GeneralInformation', 'Items', 'NotesSection']);
    expect(anchors().at(-1)).toBe('Facet.Notes');
    expect(document.querySelector('[data-sk-section="NotesSection"] [data-test-strip]')).not.toBeNull();
    expect(document.querySelector('[data-sk-section="NotesSection"] [data-test-extra]')).not.toBeNull();
  });

  it('S41 hidden by UI.Hidden: the section stays hidden with its override (no untitled custom section)', async () => {
    render(host(page(override), { hide: true, row: { HideNotes: true } }));
    await waitFor(() => expect(heading()).toBe('1'));
    expect(sectionIds()).toEqual(['GeneralInformation', 'Items']);
    expect(anchors()).not.toContain('NotesSection');
    expect(document.querySelector('[data-test-strip]')).toBeNull();
    expect(document.querySelector('[data-test-extra]')).toBeNull();
  });

  it('S41 an explicit `visible` of the override overwrites UI.Hidden (FE getSections visible: overwrite); the title is the annotation\'s', async () => {
    render(host(page({ content: { body: { sections: { NotesSection: { visible: true } } } } }), { hide: true, row: { HideNotes: true } }));
    await waitFor(() => expect(heading()).toBe('1'));
    expect(sectionIds()).toEqual(['GeneralInformation', 'Items', 'NotesSection']);
    expect(anchors().at(-1)).toBe('Facet.Notes');
  });
});

describe('S42 title of the first section', () => {
  it('S42 under the anchor bar the first section\'s title is not shown but stays for screen readers; the others are shown', async () => {
    render(host(page({})));
    await waitFor(() => expect(heading()).toBe('1'));
    const titles = [...document.querySelectorAll('.sk-section__title')];
    expect(titles.map((t) => t.textContent)).toEqual(['Facet.GeneralInformation', 'Facet.Notes']);
    expect(titles[0]!.className).toContain('sk-visually-hidden');
    expect(titles[0]!.tagName).toBe('H2');
    expect(document.querySelector('[data-sk-section="GeneralInformation"]')!.getAttribute('aria-label')).toBe('Facet.GeneralInformation');
    expect(titles[1]!.className).not.toContain('sk-visually-hidden');
  });

  const one = (id: string) => ({ id, title: `Title ${id}`, subSections: [{ id: `${id}1`, title: 'Sub', content: <div>c</div> }] });
  const layout = (p: Partial<Parameters<typeof ObjectPageLayout>[0]>) => (
    <MantineProvider theme={smartKitMantineTheme}>
      <SmartKitProvider services={{ p: { model: modelOf(), dataProvider: new MemoryProvider({ model: modelOf(), data: {} }), variants: new MemoryVariantStore() } }} locale="en" namespace={`p7${Math.random()}`}>
        <ObjectPageLayout scope="T" sections={[one('A'), one('B')]} {...p} />
      </SmartKitProvider>
    </MantineProvider>
  );
  const hidden = () => [...document.querySelectorAll('.sk-section__title')].map((t) => `${t.textContent}:${t.classList.contains('sk-visually-hidden')}`);

  it('S42 ObjectPageLayout: only the first of several sections; a single section (no anchor bar) keeps its title', () => {
    const { unmount } = render(layout({}));
    expect(hidden()).toEqual(['Title A:true', 'Title B:false']);
    unmount();
    render(layout({ sections: [one('A')] }));
    expect(hidden()).toEqual(['Title A:false']);
  });

  it('S42 ObjectPageLayout: without an anchor bar (showAnchorBar false) the first title is shown; with useIconTabBar no section title is rendered', () => {
    const { unmount } = render(layout({ showAnchorBar: false }));
    expect(hidden()).toEqual(['Title A:false', 'Title B:false']);
    unmount();
    render(layout({ useIconTabBar: true }));
    expect(hidden()).toEqual([]);
  });
});

describe('S43 footer override of an annotation action', () => {
  it('S43 isPrimaryAction on the key of a determining action emphasizes that button; no second button', async () => {
    render(host(page({ content: { footer: { actions: { [REJECT]: { isPrimaryAction: true } } } } })));
    await waitFor(() => expect(heading()).toBe('1'));
    // the primary action is shown first and emphasized (FE applyObjectPageEmphasisRules)
    expect(footerButtons()).toEqual([`${REJECT}|A.Reject|filled`, `${APPROVE}|A.Approve|default`]);
  });

  it('S43 the annotation action is hidden by UI.Hidden: its override adds no button with the key as text', async () => {
    render(host(page({ content: { footer: { actions: { [APPROVE]: { isPrimaryAction: true } } } } }), { hide: true, row: { HideApprove: true } }));
    await waitFor(() => expect(heading()).toBe('1'));
    expect(footerButtons()).toEqual([`${REJECT}|A.Reject|default`]);
  });

  it('S43 shown again (UI.Hidden false) the override applies; an explicit `visible` overwrites UI.Hidden (FE visible: overwrite)', async () => {
    const { unmount } = render(host(page({ content: { footer: { actions: { [APPROVE]: { isPrimaryAction: true } } } } }), { hide: true, row: { HideApprove: false } }));
    await waitFor(() => expect(heading()).toBe('1'));
    expect(footerButtons()).toEqual([`${APPROVE}|A.Approve|filled`, `${REJECT}|A.Reject|default`]);
    unmount();
    render(host(page({ content: { footer: { actions: { [APPROVE]: { visible: true, text: 'Go' } } } } }), { hide: true, row: { HideApprove: true } }));
    await waitFor(() => expect(heading()).toBe('1'));
    expect(footerButtons()).toEqual([`${APPROVE}|Go|default`, `${REJECT}|A.Reject|default`]);
  });

  it('S43 header: the override of a hidden annotation action adds no button either', async () => {
    const CLOSE = 'DataFieldForAction::Purchasing.close';
    render(host(page({ content: { header: { actions: { [APPROVE]: { text: 'X' }, [CLOSE]: { text: 'Close it' } } } } }), { hide: true, row: { HideApprove: true } }));
    await waitFor(() => expect(heading()).toBe('1'));
    expect(document.querySelector(`.sk-dynamic-page__toolbar [data-sk-action="${CLOSE}"]`)!.textContent).toBe('Close it');
    expect(document.querySelector(`.sk-dynamic-page__toolbar [data-sk-action="${APPROVE}"]`)).toBeNull();
  });
});

describe('column steps by container width', () => {
  const css = readFileSync(join(import.meta.dirname, '../src/theme/styles.css'), 'utf8');
  const rule = (min: number, selector: string) => new RegExp(`@container \\(min-width: ${min}px\\) \\{ ${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{ --sk-form-cols: ([^;]+); \\} \\}`).exec(css)?.[1];

  it('blocks of a sub-section: S 1, M 2, L 3, XL 4 columns (sap.uxap.ObjectPageSubSection), measured on the sub-section', () => {
    expect(css).toContain('.sk-subsection { container-type: inline-size; }');
    expect(rule(600, '.sk-blocks')).toBe('2');
    expect(rule(1024, '.sk-blocks')).toBe('3');
    expect(rule(1024, '.sk-object-page--two-columns .sk-blocks')).toBe('2');
    expect(rule(1440, '.sk-blocks, .sk-object-page--two-columns .sk-blocks')).toBe('4');
  });

  it('forms: 1 column, then columnsM 3, columnsL 4, columnsXL 6 (sap.fe.macros.Form ColumnLayout), measured on the form', () => {
    expect(css).toContain('.sk-form { container-type: inline-size;');
    expect(rule(600, '.sk-form__grid')).toBe('var(--sk-form-cols-m, 3)');
    expect(rule(1024, '.sk-form__grid')).toBe('var(--sk-form-cols-l, 4)');
    expect(rule(1440, '.sk-form__grid')).toBe('var(--sk-form-cols-xl, 6)');
  });
});
