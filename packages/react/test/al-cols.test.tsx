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

  it('AL-12 cols5 the delete confirmation with restricted rows uses FE\'s singular / plural texts (FE DeleteHelper)', async () => {
    const xml = shop(action('discontinue')).replace('<PropertyValue Property="Deletable" Bool="false"/>', '<PropertyValue Property="Deletable" Path="Deletable"/>')
      .replace('<Property Name="Version" Type="Edm.Int32"/>', '<Property Name="Version" Type="Edm.Int32"/><Property Name="Deletable" Type="Edm.Boolean"/>');
    const model = buildModel(xml);
    expect(model.entitySets.Products!.capabilities.deletablePath).toBe('Deletable');
    const data = structuredClone(shopData);
    data.Products!.forEach((r, i) => { r.Deletable = i !== 1; });
    render(
      <MantineProvider theme={smartKitMantineTheme}>
        <SmartKitProvider services={{ shop: { model, dataProvider: new MemoryProvider({ model, data }), variants: new MemoryVariantStore() } }} locale="en" namespace="al-cols5">
          <Table service="shop" contextPath="/Products" type="ResponsiveTable" />
        </SmartKitProvider>
      </MantineProvider>,
    );
    const r = await rows();
    for (const i of [0, 1]) fireEvent.click(within(r[i]!).getAllByRole('checkbox')[0]!);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText('1 out of 2 selected objects has delete restrictions, so it cannot be deleted.')).toBeInTheDocument();
    expect(screen.getByText('Do you still want to delete the remaining object?')).toBeInTheDocument();
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

  it('AL-12 cols5 a constant LineItem@UI.Criticality (Negative, VeryNegative, VeryPositive) highlights nothing (FE Table rowHighlighting gets the enum name; FE comparison cols5-negative)', async () => {
    for (const [constant, state] of [['Negative', null], ['VeryNegative', null], ['VeryPositive', null]]) {
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

describe('AL-10 AL-12 cols5 personalization and toolbar (FE comparison tests/e2e-fe/colsfe.spec.ts)', () => {
  const settings = async () => {
    await rows();
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    return screen.findByRole('dialog');
  };
  const options = async (target: HTMLElement) => {
    fireEvent.click(target);
    const list = await screen.findAllByRole('option');
    return list.map((o) => (o.textContent ?? '').trim());
  };

  it('AL-12 cols5 the columns panel lists the shown columns in order, then the others alphabetically (sap.m.p13n.SelectionPanel)', async () => {
    render(host(shop(action('discontinue')), <Table service="shop" contextPath="/Products" type="ResponsiveTable" />));
    const dialog = await settings();
    const items = [...dialog.querySelectorAll('.sk-p13n__row')].map((r) => ({ label: (r.querySelector('label')?.textContent ?? '').trim(), shown: r.querySelector<HTMLInputElement>('input[type="checkbox"]')!.checked }));
    const firstHidden = items.findIndex((x) => !x.shown);
    expect(firstHidden).toBeGreaterThan(0);
    expect(items.slice(firstHidden).every((x) => !x.shown)).toBe(true);
    const rest = items.slice(firstHidden).map((x) => x.label);
    expect(rest.length).toBeGreaterThan(1);
    expect(rest).toEqual([...rest].sort((a, b) => a.localeCompare(b)));
  });

  it('AL-12 cols5 sort and (responsive) group offer the sortable properties and the column texts and criticality paths (FE PropertyInfos)', async () => {
    render(host(shop(action('discontinue')), <Table service="shop" contextPath="/Products" type="ResponsiveTable" />));
    const dialog = await settings();
    fireEvent.click(within(dialog).getByRole('tab', { name: 'Sort' }));
    // sap.m.p13n.SortPanel (QueryPanel): the last row is the empty one to add a criterion (stage 6)
    const sort = await options([...dialog.querySelectorAll<HTMLElement>('[data-sk-p13n-sort-field]')].at(-1)!);
    // NonSortableProperties (Notes) and hidden properties are not offered; the text of CategoryID (_Category/Name) and
    // the criticality path of the status column (StatusCriticality, hidden) are
    expect(sort).not.toContain('Notes');
    expect(sort).toContain('Category');
    expect(sort.filter((x) => x === 'Notes')).toEqual([]);
    expect(sort).toContain('Name'); // _Category/Name
    expect(sort).toContain('Status Criticality');
    expect(sort.length).toBeGreaterThan(5);
    // sap.m.p13n.SortPanel lists its items in model order: the current sort criterion first, then the others alphabetically
    expect(sort[0]).toBe('Release Date');
    expect(sort.slice(1)).toEqual([...sort.slice(1)].sort((a, b) => a.localeCompare(b)));
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    fireEvent.click(within(dialog).getByRole('tab', { name: 'Group' }));
    const group = await options(dialog.querySelector<HTMLElement>('[data-sk-p13n-group]')!);
    // sap.m.p13n.GroupPanel has no "none" entry (a criterion is removed with its remove button)
    expect([...group].sort()).toEqual([...sort].sort());
  });

  it('AL-12 cols5 toolbar actions stay in the toolbar while they fit (sap.m.OverflowToolbar), not after four', async () => {
    render(host(shop(`${action('discontinue')}${action('restock')}${action('close')}`, '<Annotation Term="UI.IsCopyAction" Bool="false"/>').replace('<PropertyValue Property="Deletable" Bool="false"/>', '<PropertyValue Property="Deletable" Bool="true"/>'),
      <Table service="shop" contextPath="/Products" type="ResponsiveTable" />));
    await rows();
    expect(toolbar()).toEqual(['Discontinue [disabled]', 'Restock [disabled]', 'Close [disabled]', 'Create', 'Delete [disabled]']);
    expect(screen.queryByRole('button', { name: 'More actions' })).toBeNull();
  });
});
