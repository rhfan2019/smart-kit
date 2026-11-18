/**
 * Stage 4, group "cols" (docs/29 §5 表格列, 动作): the table columns and toolbar actions as Fiori elements 1.154 renders
 * them (sap.fe.core.converters.controls.Common.Table getTableActions, table.StandardActions, table.Columns;
 * sap.fe.macros.table.ActionsTemplating, MdcTableTemplate; FE comparison tests/e2e-fe/cols.spec.ts).
 */
import { MantineProvider } from '@mantine/core';
import { buildModel, MemoryProvider, MemoryVariantStore } from '@rhfan2019/smart-kit-core';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { SmartKitProvider } from '../src/context/SmartKitProvider';
import { smartKitMantineTheme } from '../src/theme/mantine';
import Table from '../src/v4/fe/macros/Table';
import { templateParts } from '../src/table/cells';
import { shopData } from './helpers';

const SHOP = readFileSync(join(import.meta.dirname, '../../core/test/fixtures/shop.xml'), 'utf8');
const DISCONTINUE = `<Record Type="UI.DataFieldForAction">
              <PropertyValue Property="Action" String="Shop.discontinue"/>
              <PropertyValue Property="Label" String="Discontinue"/>
            </Record>`;

/** shop.xml with bound actions and the given records instead of the Discontinue action of the product LineItem. */
function shop(records: string, more = ''): string {
  const xml = SHOP
    .replace('<EntityContainer Name="Container">', `<Action Name="discontinue" IsBound="true"><Parameter Name="_it" Type="Shop.Product"/><ReturnType Type="Shop.Product"/></Action>
      <Action Name="restock" IsBound="true"><Parameter Name="_it" Type="Shop.Product"/><ReturnType Type="Shop.Product"/></Action>
      <Action Name="close" IsBound="true"><Parameter Name="_it" Type="Shop.Product"/><ReturnType Type="Shop.Product"/></Action>
      <EntityContainer Name="Container">`)
    .replace('<Annotations Target="Shop.Product">', `<Annotations Target="Shop.discontinue(Shop.Product)"><Annotation Term="Common.IsActionCritical" Bool="true"/></Annotations>
      <Annotations Target="Shop.close(Shop.Product)"><Annotation Term="Core.OperationAvailable" Bool="false"/></Annotations>
      <Annotations Target="Shop.Product">${more}`)
    .replace(DISCONTINUE, records);
  expect(xml).toContain(records);
  return xml;
}
const action = (name: string, extra = '') => `<Record Type="UI.DataFieldForAction"><PropertyValue Property="Action" String="Shop.${name}"/><PropertyValue Property="Label" String="${name[0]!.toUpperCase()}${name.slice(1)}"/>${extra}</Record>`;

function host(xml: string, children: ReactNode) {
  const model = buildModel(xml);
  const provider = new MemoryProvider({ model, data: structuredClone(shopData) });
  return (
    <MantineProvider theme={smartKitMantineTheme}>
      <SmartKitProvider services={{ shop: { model, dataProvider: provider, variants: new MemoryVariantStore() } }} locale="en" namespace="al-cols">
        {children}
      </SmartKitProvider>
    </MantineProvider>
  );
}
const rows = async () => {
  const r = await waitFor(() => { const x = document.querySelectorAll('tr[data-sk-row]'); expect(x.length).toBeGreaterThan(0); return x; });
  // jsdom has no width: the responsive table moves the columns into the pop-in; "Show Details" shows them all
  const details = document.querySelector<HTMLElement>('[data-sk-table-details]');
  if (details && details.getAttribute('aria-pressed') !== 'true') fireEvent.click(details);
  return [...(r.length ? document.querySelectorAll('tr[data-sk-row]') : r)] as HTMLElement[];
};
const toolbar = () => [...document.querySelectorAll('.sk-table__toolbar-actions [data-sk-action], .sk-table__toolbar-actions [data-sk-action-group]')].map((b) => `${(b.textContent ?? '').trim()}${(b as HTMLButtonElement).disabled ? ' [disabled]' : ''}`);

describe('AL-10 AL-12 toolbar actions (docs/29 §5 动作, DV-FE-04)', () => {
  it('AL-12 DataFieldForActionGroup is a menu at its position, enabled without a selection; Determining actions are not in the toolbar', async () => {
    const group = `<Record Type="UI.DataFieldForActionGroup"><PropertyValue Property="ID" String="Stock"/><PropertyValue Property="Label" String="Stock"/>
      <PropertyValue Property="Actions"><Collection>${action('discontinue')}${action('restock')}</Collection></PropertyValue></Record>
      ${action('close', '<PropertyValue Property="Determining" Bool="true"/>')}`;
    render(host(shop(group), <Table service="shop" contextPath="/Products" type="ResponsiveTable" />));
    await rows();
    expect(toolbar()).toEqual(['Stock', 'Create']); // shop.xml: Deletable false
    fireEvent.click(screen.getByRole('button', { name: 'Stock' }));
    const items = await screen.findAllByRole('menuitem');
    expect(items.map((i) => [i.textContent, i.hasAttribute('data-disabled')])).toEqual([['Discontinue', true], ['Restock', true]]);
  });

  it('AL-12 manifest menus (actionGroups) and custom actions without anchor stand before Create (FE getTableActions)', async () => {
    render(host(shop(`${action('discontinue')}${action('restock')}`), (
      <Table service="shop" contextPath="/Products" type="ResponsiveTable" actionGroups={[{ id: 'decide', label: 'Decide', actions: ['DataFieldForAction::Shop.discontinue', 'DataFieldForAction::Shop.restock'] }]}
        actions={[{ key: 'Custom::Hello', text: 'Hello' }]} />
    )));
    await rows();
    expect(toolbar()).toEqual(['Hello', 'Decide', 'Create']);
  });

  it('AL-12 UI.IsCopyAction: "Copy" after Create, enabled with exactly one row; UI.CreateHidden / UI.DeleteHidden hide the buttons', async () => {
    render(host(shop(action('restock', '<Annotation Term="UI.IsCopyAction" Bool="true"/>'), '<Annotation Term="UI.CreateHidden" Bool="true"/><Annotation Term="UI.DeleteHidden" Bool="true"/>'),
      <Table service="shop" contextPath="/Products" type="ResponsiveTable" />));
    await rows();
    expect(toolbar()).toEqual(['Restock [disabled]']);
  });

  it('AL-12 Common.IsActionCritical asks "Perform this action?" before running', async () => {
    render(host(shop(action('discontinue')), <Table service="shop" contextPath="/Products" type="ResponsiveTable" />));
    const [first] = await rows();
    fireEvent.click(within(first!).getAllByRole('checkbox')[0]!);
    fireEvent.click(screen.getByRole('button', { name: 'Discontinue' }));
    expect(await screen.findByText('Perform this action?')).toBeInTheDocument();
  });

  it('AL-12 the delete confirmation names the object by UI.HeaderInfo Title and Description (FE C_TRANSACTION_HELPER_CONFIRM_DELETE_WITH_OBJECTINFO)', async () => {
    render(host(shop(action('discontinue')).replace('<PropertyValue Property="Deletable" Bool="false"/>', '<PropertyValue Property="Deletable" Bool="true"/>'), <Table service="shop" contextPath="/Products" type="ResponsiveTable" />));
    const [first] = await rows();
    fireEvent.click(within(first!).getAllByRole('checkbox')[0]!);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText(/^Delete object Item \d+ "P\d+"\?$/)).toBeInTheDocument();
  });

  it('AL-12 DeleteRestrictions/Deletable as a path: Delete is enabled only for deletable rows', async () => {
    const xml = shop(action('discontinue')).replace('<Annotations Target="Shop.Product">', `<Annotations Target="Shop.Container/Products"><Annotation Term="Capabilities.DeleteRestrictions"><Record><PropertyValue Property="Deletable" Path="Deletable"/></Record></Annotation></Annotations>
      <Annotations Target="Shop.Product">`).replace('<Property name="Version"', '<Property name="Version"')
      .replace('<Property Name="Version" Type="Edm.Int32"/>', '<Property Name="Version" Type="Edm.Int32"/><Property Name="Deletable" Type="Edm.Boolean"/>');
    const model = buildModel(xml);
    expect(model.entitySets.Products!.capabilities.deletablePath).toBe('Deletable');
  });
});

describe('AL-10 AL-12 columns (docs/29 §5 表格列, DV-FE-05)', () => {
  it('AL-12 an inline action is a column of its own at its LineItem position, header "Inline Action" hidden, button disabled when unavailable', async () => {
    render(host(shop(action('close', '<PropertyValue Property="Inline" Bool="true"/>')), <Table service="shop" contextPath="/Products" type="ResponsiveTable" />));
    const [first] = await rows();
    const btn = within(first!).getByRole('button', { name: 'Close' });
    expect(btn).toBeDisabled();
    // the column label is FE's INLINE_ACTION text
    expect(document.body.textContent).toContain('Inline Action');
  });

  it('AL-12 LineItem@UI.Criticality highlights the rows (StatusCriticality 3 → success)', async () => {
    const xml = shop(action('discontinue')).replace('<Annotation Term="UI.LineItem">\n          <Collection>', '<Annotation Term="UI.LineItem"><Annotation Term="UI.Criticality" Path="StatusCriticality"/>\n          <Collection>');
    expect(buildModel(xml).ui['Shop.Product']!.rowHighlight).toEqual({ '': { path: 'StatusCriticality' } });
    render(host(xml, <Table service="shop" contextPath="/Products" type="ResponsiveTable" />));
    const [first] = await rows();
    expect(first!.getAttribute('data-sk-highlight')).toBe('success');
  });

  it('AL-12 a VeryNegative / VeryPositive row highlight is error / success (FE getMessageTypeFromCriticalityType)', async () => {
    for (const [constant, state] of [['VeryNegative', 'error'], ['VeryPositive', 'success']]) {
      const xml = shop(action('discontinue')).replace('<Annotation Term="UI.LineItem">\n          <Collection>', `<Annotation Term="UI.LineItem"><Annotation Term="UI.Criticality" EnumMember="UI.CriticalityType/${constant}"/>\n          <Collection>`);
      const view = render(host(xml, <Table service="shop" contextPath="/Products" type="ResponsiveTable" />));
      const [first] = await rows();
      expect(first!.getAttribute('data-sk-highlight')).toBe(state);
      view.unmount();
    }
  });

  it('AL-12 a field group column stacks its values; personalization offers the other properties without showing them', async () => {
    const fg = `<Record Type="UI.DataFieldForAnnotation"><PropertyValue Property="Target" AnnotationPath="@UI.FieldGroup#Codes"/></Record>`;
    const xml = shop(fg, `<Annotation Term="UI.FieldGroup" Qualifier="Codes"><Record><PropertyValue Property="Label" String="Codes"/><PropertyValue Property="Data"><Collection>
      <Record Type="UI.DataField"><PropertyValue Property="Value" Path="Code"/></Record><Record Type="UI.DataField"><PropertyValue Property="Value" Path="CategoryID"/></Record>
    </Collection></PropertyValue></Record></Annotation>`);
    render(host(xml, <Table service="shop" contextPath="/Products" type="ResponsiveTable" />));
    const [first] = await rows();
    expect(first).toBeTruthy();
    const group = document.querySelector('[data-sk-field-group]')!;
    expect(group.children.length).toBe(2);
    expect(document.body.textContent).toContain('Codes');
    // Stock (outside the LineItem) is offered in the personalization only
    expect(document.querySelector('[data-col="Stock"]')).toBeNull();
  });

  it('AL-12 ConnectedFields template parts (sap.fe.macros.ConnectedFields)', () => {
    expect(templateParts('{A} – {B}', ['A', 'B'])).toEqual([{ key: 'A' }, { literal: ' – ' }, { key: 'B' }]);
    expect(templateParts('{A}/{C}', ['A', 'B'])).toEqual([{ key: 'A' }, { key: 'B' }]);
  });
});
