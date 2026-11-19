/**
 * Stage 7, object page manifest settings (docs/31 stage 7): the sub-object tables' settings through the list report's
 * mapping (templates/tableManifest), and the header, footer and section toolbars (priority, groups, separators, menus
 * with a default action, primary action emphasis, Share's overflow priority, overrides of annotation actions).
 */
import { MantineProvider } from '@mantine/core';
import { buildModel, MemoryProvider, MemoryVariantStore, type Row } from '@rhfan2019/smart-kit-core';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ReactNode } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { SmartKitProvider, smartKitMantineTheme, type NavigationAdapter } from '../src';
import ObjectPage, { type $ObjectPageSettings } from '@rhfan2019/smart-kit/v4/fe/templates/ObjectPage';
import { objectPageEmphasis, tableAggregationsOf, withSeparators } from '../src/templates/ObjectPage';
import { massEditOf, tableSettingsOf } from '../src/templates/tableManifest';

beforeAll(() => {
  (window as unknown as { getBoundingClientRect(): Partial<DOMRect> }).getBoundingClientRect = () => ({ top: 0, bottom: 0, height: 0 });
  if (!('fonts' in document)) Object.defineProperty(document, 'fonts', { configurable: true, value: { addEventListener() {}, removeEventListener() {}, ready: Promise.resolve() } });
});

// The test service plus two selection variants of the items (quick filters of the sub-table).
const sv = (q: string, text: string, plant: string) => `<Annotation Term="UI.SelectionVariant" Qualifier="${q}"><Record Type="UI.SelectionVariantType"><PropertyValue Property="Text" String="${text}"/><PropertyValue Property="SelectOptions"><Collection><Record Type="UI.SelectOptionType"><PropertyValue Property="PropertyName" PropertyPath="Plant"/><PropertyValue Property="Ranges"><Collection><Record Type="UI.SelectionRangeType"><PropertyValue Property="Sign" EnumMember="UI.SelectionRangeSignType/I"/><PropertyValue Property="Option" EnumMember="UI.SelectionRangeOptionType/EQ"/><PropertyValue Property="Low" String="${plant}"/></Record></Collection></PropertyValue></Record></Collection></PropertyValue></Record></Annotation>`;
const xml = readFileSync(join(import.meta.dirname, '../../../apps/mock/Csdl/purchasing.template.xml'), 'utf8')
  .replace(/\{\{label:([^}]+)\}\}/g, '$1')
  .replace('<Annotations Target="Purchasing.PurchaseOrderItem">', `<Annotations Target="Purchasing.PurchaseOrderItem">${sv('P1', 'Plant 1', '1000')}${sv('P2', 'Plant 2', '2000')}`);
const model = buildModel(xml);
// `close` gets a parameter (the parameter dialog of defaultValuesFunction)
const close = model.ui['Purchasing.PurchaseOrder']!.objectActions.find((a) => a.name === 'close')!;
close.parameters = [{ name: 'Reason', edmType: 'Edm.String', label: 'Reason', nullable: true }];

const order = (id: string): Row => ({ PurchaseOrder: id, Description: `Order ${id}`, Supplier: 'S1', ApproveEnabled: true, CloseEnabled: true, Status: 'NEW', Currency: 'EUR', NetAmount: '10', '@odata.etag': 'W/"1"' });
const item = (n: number, plant: string): Row => ({ PurchaseOrder: '1', PurchaseOrderItem: n, Material: 'M1', Plant: plant, OrderQuantity: '1', OrderUnit: 'PC', NetPrice: '1', NetAmount: '1', Currency: 'EUR', DeliveryDate: '2026-01-01', ReceivedQuantity: '0', InvoicedAmount: '0', Version: 1 });
const supplier = { Supplier: 'S1', SupplierName: 'Supplier One', IsBlocked: false, Rating: 3, RatingCount: 2 };

function host(children: ReactNode, o: { navigation?: NavigationAdapter; close?(row: Row | undefined, params: Row): Row | undefined } = {}) {
  const provider = new MemoryProvider({
    model,
    data: { PurchaseOrders: [order('1'), order('2')], PurchaseOrderItems: [item(10, '1000'), item(20, '2000'), item(30, '2000')], Suppliers: [{ ...supplier }] },
    actions: { 'Purchasing.close': o.close ?? ((row) => row) },
  });
  return (
    <MantineProvider theme={smartKitMantineTheme}>
      <SmartKitProvider services={{ p: { model, dataProvider: provider, variants: new MemoryVariantStore() } }} locale="en" namespace={`op7${Math.random()}`} navigation={o.navigation}>
        {children}
      </SmartKitProvider>
    </MantineProvider>
  );
}
const page = (p: Partial<$ObjectPageSettings>) => <ObjectPage service="p" path="PurchaseOrders('1')" sectionLayout="Page" {...p} />;
const heading = () => document.querySelector('[data-sk-heading]')?.textContent;
/** Keys of the header toolbar's visible items in order (data-sk-action / -group / separators). */
const headerKeys = () => [...document.querySelectorAll('.sk-dynamic-page__toolbar > [data-sk-toolbar-item]')]
  .map((el) => el.querySelector('[data-sk-separator]') ? '|' : el.querySelector('[data-sk-action-group]')?.getAttribute('data-sk-action-group') ?? el.querySelector('[data-sk-action]')?.getAttribute('data-sk-action') ?? el.querySelector('[data-sk-toolbar-content]')?.getAttribute('data-sk-toolbar-content') ?? 'Share');
const variant = (sel: string) => document.querySelector(sel)?.getAttribute('data-variant');

describe('AL-13 op7 sub-object tables (the list report mapping)', () => {
  it('AL-13 op7 tableSettings, columns, actions and overflowGroups map as on the list report', () => {
    const ts = tableSettingsOf({ enablePaste: false, selectAll: true, enableMassEdit: { visibleFields: 'A, B' }, analyticalConfiguration: { aggregationOnLeafLevel: true }, personalization: { sort: true } }, { massEditGrouping: 'ChangeSet' });
    expect(ts).toMatchObject({ enablePaste: false, enableSelectAll: true, massEdit: { visibleFields: ['A', 'B'], operationGroupingMode: 'ChangeSet' }, analyticalConfiguration: { aggregationOnLeafLevel: true }, personalization: 'Sort' });
    expect(massEditOf(true, 'Isolated')).toEqual({ operationGroupingMode: 'Isolated' });
    const agg = tableAggregationsOf({
      columns: { C: { header: 'C', availability: 'Adaptation', tooltip: 'T', required: true, widthIncludingColumnHeader: true, position: { placement: 'End' } } },
      actions: { A: { text: 'A', priority: 'AlwaysOverflow', group: 2 }, B: { text: 'B', overflowGroup: 3, group: 1 }, M: { text: 'M', menu: ['A'], defaultAction: 'A' }, X: { text: 'X', template: () => 'x' } },
      overflowGroups: { 3: { showSeparator: true } },
    });
    expect(agg.columns?.[0]).toMatchObject({ key: 'C', availability: 'Adaptation', tooltip: 'T', required: true, widthIncludingColumnHeader: true });
    // an annotation column override (no template) carries the list report's override settings
    expect(tableAggregationsOf({ columns: { 'DataField::Plant': { showDataFieldsLabel: true, settings: { mergeCells: true, mergeComparisonProperties: 'Plant' } } } }).columns?.[0])
      .toMatchObject({ key: 'DataField::Plant', showDataFieldsLabel: true, mergeCells: true, mergeComparisonProperties: ['Plant'] });
    expect(agg.actions?.map((a) => [a.key, a.priority, a.overflowGroup])).toEqual([['A', 'AlwaysOverflow', 2], ['B', undefined, 3]]);
    expect(agg.actionGroups).toEqual([{ id: 'M', label: 'M', actions: ['A'], defaultAction: 'A' }]);
    expect(agg.extend?.[0]).toMatchObject({ kind: 'action', id: 'X' });
    expect(agg.actionOverflowGroups).toEqual([{ overflowGroup: 3, showSeparator: true }]);
  });

  it('AL-13 op7 quickVariantSelection with hideTableTitle: the quick filter switch in the sub-table, no title', async () => {
    render(host(page({
      controlConfiguration: { '_Item/@com.sap.vocabularies.UI.v1.LineItem#InOrder': { tableSettings: { quickVariantSelection: { paths: [{ annotationPath: 'com.sap.vocabularies.UI.v1.SelectionVariant#P1' }, { annotationPath: 'com.sap.vocabularies.UI.v1.SelectionVariant#P2' }], hideTableTitle: true } } } },
    })));
    await waitFor(() => expect(document.querySelector('[data-sk-quick-variants]')).not.toBeNull());
    const table = document.querySelector('[data-sk-table="PurchaseOrderItems"]')!;
    expect(table.querySelector('[data-sk-table-title]')).toBeNull();
  });
});

describe('AL-13 op7 variantManagement', () => {
  it('AL-13 op7 variantManagement "Control": every sub-table has its own variant management; none by default', async () => {
    const { unmount } = render(host(page({ variantManagement: 'Control' })));
    await waitFor(() => expect(document.querySelector('[data-sk-table="PurchaseOrderItems"] [data-sk-table-variant]')).not.toBeNull());
    unmount();
    render(host(page({})));
    await waitFor(() => expect(document.querySelector('[data-sk-table="PurchaseOrderItems"]')).not.toBeNull());
    expect(document.querySelector('[data-sk-table-variant]')).toBeNull();
  });
});

describe('AL-13 op7 header, footer and section toolbars', () => {
  it('AL-13 op7 objectPageEmphasis: criticality wins, the footer before the header, manifest before UI.Emphasized', () => {
    expect(objectPageEmphasis([{ key: 'h', emphasized: true, manifest: true }], [], { footerShown: false })).toEqual({ header: 'h', footer: undefined, edit: true, save: true });
    expect(objectPageEmphasis([{ key: 'h', emphasized: true }], [{ key: 'f' }], { footerShown: true }).header).toBeUndefined();
    expect(objectPageEmphasis([], [{ key: 'a', emphasized: true }, { key: 'm', emphasized: true, manifest: true }], { footerShown: true })).toMatchObject({ footer: 'm', save: false });
    expect(objectPageEmphasis([{ key: 'h', emphasized: true }, { key: 'c', critical: true }], [{ key: 'f', emphasized: true }], { footerShown: true })).toEqual({ header: undefined, footer: undefined, edit: false, save: false });
    expect(withSeparators([{ key: 'a', group: 1 }, { key: 'b', group: 2 }, { key: 'c', group: 2 }], { 1: { showSeparator: true }, 2: { showSeparator: true } }).map((x) => x.key)).toEqual(['a', 'Separator::2', 'b', 'c']);
  });

  it('AL-13 op7 header: separators of overflowGroups, AlwaysOverflow in "More", a template, a split menu; Share last', async () => {
    const press = vi.fn();
    render(host(page({
      content: {
        header: {
          actions: {
            One: { text: 'One', overflowGroup: 1, press },
            Two: { text: 'Two', group: 2 },
            Hidden: { text: 'Hidden', priority: 'AlwaysOverflow' },
            Content: { text: 'Content', template: () => <b>custom</b> },
            Menu: { text: 'Menu', menu: ['One', 'Two'], defaultAction: 'One' },
          },
          overflowGroups: { 2: { showSeparator: true } },
        },
      },
    })));
    await waitFor(() => expect(heading()).toBe('1'));
    // FE addSeparators: the separator before group 2; the menu's items left the toolbar
    expect(headerKeys().slice(-3)).toEqual(['Content', 'Menu', 'Share']);
    expect(headerKeys()).not.toContain('One');
    expect(headerKeys()).not.toContain('Hidden');
    expect(document.querySelector('[data-sk-toolbar-content="Content"]')?.textContent).toBe('custom');
    expect(headerKeys().at(-1)).toBe('Share');
    fireEvent.click(document.querySelector('[data-sk-action-group-default="Menu"]')!);
    expect(press).toHaveBeenCalledTimes(1);
    fireEvent.click(document.querySelector('.sk-dynamic-page__toolbar [data-sk-toolbar-more]')!);
    await waitFor(() => expect(document.querySelector('[data-sk-toolbar-overflow] [data-sk-action="Hidden"]')).not.toBeNull());
  });

  it('AL-13 op7 header separators: a group start with showSeparator gets a separator', async () => {
    render(host(page({ content: { header: { actions: { One: { text: 'One', overflowGroup: 1 }, Two: { text: 'Two', overflowGroup: 2 } }, overflowGroups: { 2: { showSeparator: true } } } } })));
    await waitFor(() => expect(heading()).toBe('1'));
    const keys = headerKeys();
    expect(keys.slice(keys.indexOf('One'))).toEqual(['One', '|', 'Two', 'Share']);
  });

  it('AL-13 op7 header isPrimaryAction: first and emphasized without a footer; Ghost in place while the footer shows', async () => {
    const { unmount } = render(host(<ObjectPage service="p" path="Suppliers('S1')" content={{ header: { actions: { P: { text: 'P', isPrimaryAction: true } } } }} />));
    await waitFor(() => expect(document.querySelector('[data-sk-action="P"]')).not.toBeNull());
    expect(headerKeys()[0]).toBe('P');
    expect(variant('[data-sk-action="P"]')).toBe('filled');
    unmount();
    // the purchase order shows its determining actions in the footer: no header emphasis
    render(host(page({ content: { header: { actions: { P: { text: 'P', isPrimaryAction: true } } } } })));
    await waitFor(() => expect(heading()).toBe('1'));
    expect(headerKeys()[0]).not.toBe('P');
    expect(variant('[data-sk-action="P"]')).toBe('subtle');
  });

  it('AL-13 op7 footer isPrimaryAction: first and emphasized; Save loses its emphasis', async () => {
    render(host(page({ content: { footer: { actions: { F: { text: 'F', isPrimaryAction: true } } } } })));
    await waitFor(() => expect(heading()).toBe('1'));
    const footerKeys = () => [...document.querySelectorAll('[data-sk-footer] [data-sk-toolbar-item] button')].map((b) => b.getAttribute('data-sk-action') ?? (b.hasAttribute('data-sk-save') ? 'Save' : b.hasAttribute('data-sk-cancel') ? 'Cancel' : ''));
    await waitFor(() => expect(footerKeys()[0]).toBe('F'));
    expect(variant('[data-sk-footer] [data-sk-action="F"]')).toBe('filled');
    fireEvent.click(document.querySelector('[data-sk-action="Edit"]')!);
    await waitFor(() => expect(document.querySelector('[data-sk-save]')).not.toBeNull());
    expect(variant('[data-sk-save]')).toBe('default');
  });

  it('AL-13 op7 shareOverflowPriority: "AlwaysOverflow" moves Share into "More" (default High)', async () => {
    render(host(page({ shareOverflowPriority: 'AlwaysOverflow' })));
    await waitFor(() => expect(heading()).toBe('1'));
    expect(headerKeys()).not.toContain('Share');
    expect(document.querySelector('.sk-dynamic-page__toolbar [data-sk-toolbar-more]')).not.toBeNull();
  });

  it('AL-13 op7 override of an annotation action: text, priority, defaultValuesFunction prefills the dialog, afterExecution', async () => {
    const toObject = vi.fn();
    const navigation = { toObject, toList: vi.fn() } as unknown as NavigationAdapter;
    const defaults = vi.fn(() => Promise.resolve({ Reason: 'Done' }));
    const { unmount } = render(host(page({
      content: { header: { actions: { 'DataFieldForAction::Purchasing.close': { text: 'Close it', defaultValuesFunction: defaults } } } },
    }), { navigation, close: () => order('2') }));
    await waitFor(() => expect(heading()).toBe('1'));
    const button = document.querySelector<HTMLButtonElement>('[data-sk-action="DataFieldForAction::Purchasing.close"]')!;
    expect(button.textContent).toBe('Close it');
    fireEvent.click(button);
    await waitFor(() => expect(document.querySelector<HTMLInputElement>('input[value="Done"]')).not.toBeNull());
    expect(defaults.mock.calls[0]![0].contexts[0]!.getPath()).toBe("/PurchaseOrders('1')");
    fireEvent.submit(document.querySelector<HTMLInputElement>('input[value="Done"]')!.closest('form')!);
    // FE isNavigable: the action returned another order of the set
    await waitFor(() => expect(toObject).toHaveBeenCalledWith("PurchaseOrders('2')", 'p'));
    unmount();
    toObject.mockClear();
    render(host(page({
      content: { header: { actions: { 'DataFieldForAction::Purchasing.close': { afterExecution: { navigateToInstance: false } } } } },
    }), { navigation, close: () => order('2') }));
    await waitFor(() => expect(heading()).toBe('1'));
    fireEvent.click(document.querySelector('[data-sk-action="DataFieldForAction::Purchasing.close"]')!);
    await waitFor(() => expect(document.querySelector('form input')).not.toBeNull());
    fireEvent.submit(document.querySelector('form input')!.closest('form')!);
    await new Promise((r) => setTimeout(r, 50));
    expect(toObject).not.toHaveBeenCalled();
  });

  it('AL-13 op7 sub-section toolbar: priority, separators and a split menu (no emphasis, as FE FormActionButtons)', async () => {
    const press = vi.fn();
    render(host(page({
      content: {
        body: {
          sections: {
            Custom: {
              title: 'Custom', template: () => <div>c</div>,
              actions: { A: { text: 'A', overflowGroup: 1, press }, C: { text: 'C', overflowGroup: 1 }, B: { text: 'B', overflowGroup: 2, isPrimaryAction: true }, Z: { text: 'Z', priority: 'AlwaysOverflow' }, M: { text: 'M', menu: ['A'], defaultAction: 'A' } },
              overflowGroups: { 2: { showSeparator: true } },
            },
          },
        },
      },
    })));
    await waitFor(() => expect(document.querySelector('[data-sk-subsection-actions]')).not.toBeNull());
    const bar = document.querySelector('[data-sk-subsection-actions]')!;
    expect(bar.querySelector('[data-sk-separator]')).not.toBeNull();
    expect(bar.querySelector('[data-sk-action="Z"]')).toBeNull();
    expect(bar.querySelector('[data-sk-action="B"]')?.getAttribute('data-variant')).toBe('default');
    fireEvent.click(bar.querySelector('[data-sk-action-group-default="M"]')!);
    expect(press).toHaveBeenCalledTimes(1);
  });
});
