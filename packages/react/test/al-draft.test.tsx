/**
 * Stage 3, group "draft" (docs/29 §4 P1-1, P1-6 and the Core.OperationAvailable bug): FE 1.154 semantics of the
 * draft list, the multiple views and the availability of unbound actions.
 */
import { MantineProvider } from '@mantine/core';
import { buildModel, EDIT_STATE, hiddenFiltersOf, MemoryProvider, MemoryVariantStore, toQueryString, type QueryRequest } from '@rhfan2019/smart-kit-core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { SmartKitProvider } from '../src/context/SmartKitProvider';
import { smartKitMantineTheme } from '../src/theme/mantine';
import Table from '../src/v4/fe/macros/Table';
import { ListReport, tableFilters, viewExcludedPaths } from '../src/templates/ListReport';
import { shopData } from './helpers';

const SHOP = readFileSync(join(import.meta.dirname, '../../core/test/fixtures/shop.xml'), 'utf8');

/** shop.xml with two unbound actions (action imports) in the product LineItem: one never available, one always. */
function withUnboundActions(): string {
  return SHOP
    .replace('<EntityContainer Name="Container">', `<Action Name="recalculate" IsBound="false"/>
      <Action Name="refreshPrices" IsBound="false"/>
      <EntityContainer Name="Container">
        <ActionImport Name="recalculate" Action="Shop.recalculate"/>
        <ActionImport Name="refreshPrices" Action="Shop.refreshPrices"/>`)
    .replace('<Annotations Target="Shop.Product">', `<Annotations Target="Shop.recalculate()"><Annotation Term="Core.OperationAvailable" Bool="false"/></Annotations>
      <Annotations Target="Shop.refreshPrices()"><Annotation Term="Core.OperationAvailable" Bool="true"/></Annotations>
      <Annotations Target="Shop.Product">`)
    .replace(`<Record Type="UI.DataFieldForAction">
              <PropertyValue Property="Action" String="Shop.discontinue"/>`, `<Record Type="UI.DataFieldForAction">
              <PropertyValue Property="Action" String="Shop.Container/recalculate"/>
              <PropertyValue Property="Label" String="Recalculate"/>
            </Record>
            <Record Type="UI.DataFieldForAction">
              <PropertyValue Property="Action" String="Shop.Container/refreshPrices"/>
              <PropertyValue Property="Label" String="Refresh Prices"/>
            </Record>
            <Record Type="UI.DataFieldForAction">
              <PropertyValue Property="Action" String="Shop.discontinue"/>`);
}

function host(xml: string, children: ReactNode) {
  const model = buildModel(xml);
  const provider = new MemoryProvider({ model, data: structuredClone(shopData) });
  return (
    <MantineProvider theme={smartKitMantineTheme}>
      <SmartKitProvider services={{ shop: { model, dataProvider: provider, variants: new MemoryVariantStore() } }} locale="en" namespace="al-draft">
        {children}
      </SmartKitProvider>
    </MantineProvider>
  );
}

describe('Core.OperationAvailable on unbound actions', () => {
  it('AL-10 AL-11 bug OperationAvailable: an unbound action with OperationAvailable false is disabled, true stays enabled (FE getActionEnabledExpression)', async () => {
    const model = buildModel(withUnboundActions());
    const actions = model.ui['Shop.Product']!.actions.filter((a) => a.name !== 'discontinue');
    expect(actions.map((a) => [a.name, a.operationAvailable])).toEqual([['Container/recalculate', { value: false }], ['Container/refreshPrices', { value: true }]]);
    render(host(withUnboundActions(), <Table service="shop" contextPath="/Products" type="ResponsiveTable" />));
    await waitFor(() => expect(document.querySelectorAll('tr[data-sk-row]').length).toBeGreaterThan(0));
    const recalc = await screen.findByRole('button', { name: 'Recalculate' });
    expect(recalc).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Refresh Prices' })).toBeEnabled();
  });
});

// ---------------------------------------------------------------------------------------------- draft list, views

const spv = (q: string, type: string) => `<Annotation Term="UI.SelectionPresentationVariant" Qualifier="${q}"><Record>
  <PropertyValue Property="Text" String="View ${q}"/>
  <PropertyValue Property="SelectionVariant"><Record><PropertyValue Property="SelectOptions"><Collection>
    <Record><PropertyValue Property="PropertyName" PropertyPath="Type"/><PropertyValue Property="Ranges"><Collection><Record>
      <PropertyValue Property="Sign" EnumMember="UI.SelectionRangeSignType/I"/><PropertyValue Property="Option" EnumMember="UI.SelectionRangeOptionType/EQ"/><PropertyValue Property="Low" String="${type}"/>
    </Record></Collection></PropertyValue></Record>
    <Record><PropertyValue Property="PropertyName" PropertyPath="Status"/><PropertyValue Property="Ranges"><Collection><Record>
      <PropertyValue Property="Sign" EnumMember="UI.SelectionRangeSignType/I"/><PropertyValue Property="Option" EnumMember="UI.SelectionRangeOptionType/EQ"/><PropertyValue Property="Low" String="N"/>
    </Record></Collection></PropertyValue></Record>
  </Collection></PropertyValue></Record></PropertyValue>
  <PropertyValue Property="PresentationVariant"><Record><PropertyValue Property="Visualizations"><Collection><AnnotationPath>@UI.LineItem</AnnotationPath></Collection></PropertyValue></Record></PropertyValue>
</Record></Annotation>`;

const DRAFT_XML = `<?xml version="1.0"?>
<edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx">
  <edmx:Reference Uri="u"><edmx:Include Namespace="com.sap.vocabularies.UI.v1" Alias="UI"/></edmx:Reference>
  <edmx:Reference Uri="c"><edmx:Include Namespace="com.sap.vocabularies.Common.v1" Alias="Common"/></edmx:Reference>
  <edmx:DataServices><Schema xmlns="http://docs.oasis-open.org/odata/ns/edm" Namespace="T">
    <EntityType Name="Order"><Key><PropertyRef Name="ID"/><PropertyRef Name="IsActiveEntity"/></Key>
      <Property Name="ID" Type="Edm.String" Nullable="false"/>
      <Property Name="Status" Type="Edm.String"/>
      <Property Name="Type" Type="Edm.String"/>
      <Property Name="IsActiveEntity" Type="Edm.Boolean" Nullable="false"/>
      <Property Name="HasActiveEntity" Type="Edm.Boolean" Nullable="false"/>
      <Property Name="HasDraftEntity" Type="Edm.Boolean" Nullable="false"/>
      <NavigationProperty Name="DraftAdministrativeData" Type="T.DraftAdministrativeData"/>
      <NavigationProperty Name="SiblingEntity" Type="T.Order"/>
    </EntityType>
    <EntityType Name="DraftAdministrativeData"><Key><PropertyRef Name="DraftUUID"/></Key>
      <Property Name="DraftUUID" Type="Edm.Guid" Nullable="false"/><Property Name="InProcessByUser" Type="Edm.String"/>
    </EntityType>
    <EntityType Name="Item"><Key><PropertyRef Name="ID"/></Key><Property Name="ID" Type="Edm.String" Nullable="false"/><Property Name="Status" Type="Edm.String"/><Property Name="Type" Type="Edm.String"/></EntityType>
    <EntityContainer Name="C">
      <EntitySet Name="Orders" EntityType="T.Order"><NavigationPropertyBinding Path="SiblingEntity" Target="Orders"/></EntitySet>
      <EntitySet Name="Items" EntityType="T.Item"/>
    </EntityContainer>
    <Annotations Target="T.Order/ID"><Annotation Term="Common.Label" String="Order"/></Annotations>
    <Annotations Target="T.Order">
      <Annotation Term="Common.SemanticKey"><Collection><PropertyPath>ID</PropertyPath></Collection></Annotation>
      <Annotation Term="UI.SelectionFields"><Collection><PropertyPath>Status</PropertyPath></Collection></Annotation>
      <Annotation Term="UI.LineItem"><Collection>
        <Record Type="UI.DataField"><PropertyValue Property="Value" Path="ID"/></Record>
        <Record Type="UI.DataField"><PropertyValue Property="Value" Path="Status"/></Record>
      </Collection></Annotation>
    </Annotations>
    <Annotations Target="T.Item">
      <Annotation Term="UI.SelectionFields"><Collection><PropertyPath>Status</PropertyPath></Collection></Annotation>
      <Annotation Term="UI.LineItem"><Collection><Record Type="UI.DataField"><PropertyValue Property="Value" Path="ID"/></Record></Collection></Annotation>
      <Annotation Term="UI.SelectionVariant"><Record><PropertyValue Property="SelectOptions"><Collection>
        <Record><PropertyValue Property="PropertyName" PropertyPath="Status"/><PropertyValue Property="Ranges"><Collection><Record>
          <PropertyValue Property="Sign" EnumMember="UI.SelectionRangeSignType/I"/><PropertyValue Property="Option" EnumMember="UI.SelectionRangeOptionType/NE"/><PropertyValue Property="Low" String="C"/>
        </Record></Collection></PropertyValue></Record>
      </Collection></PropertyValue></Record></Annotation>
      ${spv('A', 'X')}${spv('B', 'Y')}
    </Annotations>
    <Annotations Target="T.C/Orders"><Annotation Term="Common.DraftRoot"><Record><PropertyValue Property="ActivationAction" String="T.draftActivate"/></Record></Annotation></Annotations>
  </Schema></edmx:DataServices>
</edmx:Edmx>`;
const draftModel = buildModel(DRAFT_XML);

function draftHost(children: ReactNode) {
  const admin = (user: string) => ({ DraftUUID: '1', InProcessByUser: user });
  const provider = new MemoryProvider({
    model: draftModel,
    data: {
      Orders: [
        { ID: '1', Status: 'N', Type: 'X', IsActiveEntity: true, HasActiveEntity: false, HasDraftEntity: false, DraftAdministrativeData: null },
        { ID: '2', Status: 'N', Type: 'X', IsActiveEntity: true, HasActiveEntity: false, HasDraftEntity: true, DraftAdministrativeData: admin('Alex') },
        { ID: '3', Status: 'N', Type: 'X', IsActiveEntity: false, HasActiveEntity: false, HasDraftEntity: false, DraftAdministrativeData: admin('') },
      ],
      Items: [
        { ID: 'i1', Status: 'N', Type: 'X' }, { ID: 'i2', Status: 'N', Type: 'Y' }, { ID: 'i3', Status: 'C', Type: 'X' }, { ID: 'i4', Status: 'O', Type: 'X' },
      ],
    },
  });
  const requests: QueryRequest[] = [];
  const query = provider.query.bind(provider);
  provider.query = (req, opts) => { requests.push(req); return query(req, opts); };
  const ui = (
    <MantineProvider theme={smartKitMantineTheme}>
      <SmartKitProvider services={{ d: { model: draftModel, dataProvider: provider, variants: new MemoryVariantStore() } }} locale="en" namespace="al-draft-list">
        {children}
      </SmartKitProvider>
    </MantineProvider>
  );
  return { ui, requests };
}
/** Expands the dynamic page header (it collapses once the list is loaded). */
const expandHeader = () => {
  const toggle = screen.queryByRole('button', { name: /^(Expand Header|Show Filters)$/ });
  if (toggle) fireEvent.click(toggle);
};
const listed = () => [...document.querySelectorAll<HTMLElement>('tr[data-sk-row]')].map((tr) => tr.dataset.skRow);
const rowsOf = (requests: QueryRequest[], set: string) => requests.filter((r) => 'entitySet' in r.source && r.source.entitySet === set && !r.aggregate && r.top !== 0);

describe('draft list (FE DraftEditState)', () => {
  it('AL-10 AL-11 P1-1 draft list: All = IsActiveEntity eq false or SiblingEntity/IsActiveEntity eq null; six editing status options; Locked by Another User by InProcessByUser', async () => {
    const { ui, requests } = draftHost(<ListReport service="d" contextPath="/Orders" initialLoad="Enabled" liveMode controlConfiguration={{ '@com.sap.vocabularies.UI.v1.LineItem': { tableSettings: { type: 'ResponsiveTable' } } }} />);
    render(ui);
    await waitFor(() => expect(listed()).toHaveLength(3));
    const first = rowsOf(requests, 'Orders').at(-1)!;
    expect(first.filters?.[EDIT_STATE]).toEqual([{ operator: 'EQ', values: [''] }]);
    expect(decodeURIComponent(toQueryString(draftModel, first))).toContain('$filter=IsActiveEntity eq false or SiblingEntity/IsActiveEntity eq null');
    // the own new draft 3 is listed; the draft data: HasActiveEntity, HasDraftEntity, DraftAdministrativeData(DraftUUID, InProcessByUser)
    expect(first.select).toEqual(expect.arrayContaining(['HasActiveEntity', 'HasDraftEntity']));
    expect(first.expand).toEqual([{ navigation: 'DraftAdministrativeData', select: ['DraftUUID', 'InProcessByUser'], expand: [] }]);
    expandHeader();
    fireEvent.click(document.querySelector('[data-sk-editing-status]')!);
    const options = await screen.findAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual(['All', 'All (Hiding Drafts)', 'Unchanged', 'Own Draft', 'Locked by Another User', 'Unsaved Changes by Another User']);
    fireEvent.click(options[4]!);
    await waitFor(() => expect(listed()).toHaveLength(1));
    expect(rowsOf(requests, 'Orders').at(-1)!.filters?.[EDIT_STATE]).toEqual([{ operator: 'EQ', values: ['LOCKED'] }]);
  });

  it('AL-11 P1-1 draft list: grid tables show an "Editing Status" column (header hidden) after the first column', async () => {
    const { ui } = draftHost(<ListReport service="d" contextPath="/Orders" initialLoad="Enabled" controlConfiguration={{ '@com.sap.vocabularies.UI.v1.LineItem': { tableSettings: { type: 'GridTable' } } }} />);
    render(ui);
    await waitFor(() => expect(document.querySelector('.ag-header-cell[col-id="draftStatus"]')).not.toBeNull());
    const ids = [...document.querySelectorAll('.ag-header-row-column .ag-header-cell[col-id]')].map((h) => h.getAttribute('col-id')).filter((id) => !id!.startsWith('ag-Grid-'));
    expect(ids.slice(0, 2)).toEqual(['DataField::ID', 'draftStatus']);
    expect(document.querySelector('.ag-header-cell[col-id="draftStatus"]')).toHaveClass('sk-table__header--hidden');
    expect(document.querySelector('.ag-header-cell[col-id="draftStatus"] .ag-header-cell-text')).toHaveTextContent('Editing Status');
  });
});

describe('multiple views (FE views.paths)', () => {
  it('AL-10 P1-6 multiple views: each view applies its complete selection variant; only view properties that are not selection fields leave the filter bar', async () => {
    const views = draftModel.ui['T.Item']!.views;
    expect(views.map((v) => v.id)).toEqual(['A', 'B']);
    expect([...viewExcludedPaths(views, ['Status'])]).toEqual(['Type']);
    // the condition shared by both views (Status eq N) is applied too, combined with the filter bar's by "and"
    const r = tableFilters({ Status: [{ operator: 'EQ', values: ['O'] }] }, () => true, false, views[0]!.conditions);
    expect(r.filters.Status).toEqual([{ operator: 'EQ', values: ['O'] }]);
    expect(hiddenFiltersOf(r.filters)).toEqual({ Type: [{ operator: 'EQ', values: ['X'] }], Status: [{ operator: 'EQ', values: ['N'] }] });

    const { ui, requests } = draftHost(<ListReport service="d" contextPath="/Items" initialLoad="Enabled" controlConfiguration={{ '@com.sap.vocabularies.UI.v1.LineItem': { tableSettings: { type: 'ResponsiveTable' } } }} views={{ paths: [{ key: 'A', annotationPath: 'com.sap.vocabularies.UI.v1.SelectionPresentationVariant#A' }, { key: 'B', annotationPath: 'com.sap.vocabularies.UI.v1.SelectionPresentationVariant#B' }] }} />);
    render(ui);
    await waitFor(() => expect(listed()).toHaveLength(1));
    const req = rowsOf(requests, 'Items').at(-1)!;
    // the filter bar keeps the default selection variant (Status ne C); the view adds Type eq X and Status eq N
    expect(decodeURIComponent(toQueryString(draftModel, req))).toContain("$filter=Status ne 'C' and (Type eq 'X') and (Status eq 'N')");
    expandHeader();
    const fields = [...document.querySelectorAll('[data-sk-filter]')].map((el) => el.getAttribute('data-sk-filter'));
    expect(fields).toContain('Status');
    expect(fields).not.toContain('Type');
  });
});
