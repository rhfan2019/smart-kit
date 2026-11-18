/**
 * Stage 4 tail in the filter fields (docs/29 §5, AL-10 – AL-12): a value help from Common.ValueListReferences (the
 * value help service's Common.ValueListMapping, SAPUI5 requestValueListInfo) and the filter bar of a parameterized
 * entity set (Common.ResultContext: parameters first, mandatory; FE FilterBar getFilterFields).
 */
import { MantineProvider } from '@mantine/core';
import { buildModel, MemoryProvider, MemoryVariantStore, type QueryRequest } from '@rhfan2019/smart-kit-core';
import { fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { SmartKitProvider, smartKitMantineTheme } from '../src';
import ConditionInput from '../src/kit/ConditionInput';
import useFilterState from '../src/kit/useFilterState';
import ValueHelpDialog from '../src/kit/ValueHelpDialog';

const head = `<?xml version="1.0"?>
<edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx">
  <edmx:Reference Uri="c"><edmx:Include Namespace="com.sap.vocabularies.Common.v1" Alias="Common"/></edmx:Reference>
  <edmx:Reference Uri="u"><edmx:Include Namespace="com.sap.vocabularies.UI.v1" Alias="UI"/></edmx:Reference>`;

const model = buildModel(`${head}
  <edmx:DataServices><Schema xmlns="http://docs.oasis-open.org/odata/ns/edm" Namespace="M">
    <EntityType Name="Order"><Key><PropertyRef Name="ID"/></Key>
      <Property Name="ID" Type="Edm.String" Nullable="false"/><Property Name="Company" Type="Edm.String"/>
    </EntityType>
    <EntityType Name="SpendParameters"><Key><PropertyRef Name="P_Currency"/></Key>
      <Property Name="P_Currency" Type="Edm.String" Nullable="false"/>
      <NavigationProperty Name="Set" Type="Collection(M.Spend)" ContainsTarget="true"/>
    </EntityType>
    <EntityType Name="Spend"><Key><PropertyRef Name="Supplier"/></Key>
      <Property Name="Supplier" Type="Edm.String" Nullable="false"/><Property Name="Country" Type="Edm.String"/>
    </EntityType>
    <EntityContainer Name="C"><EntitySet Name="Orders" EntityType="M.Order"/><EntitySet Name="SpendParameters" EntityType="M.SpendParameters"/></EntityContainer>
    <Annotations Target="M.Order/Company">
      <Annotation Term="Common.Label" String="Company"/>
      <Annotation Term="Common.ValueListReferences"><Collection><String>../vh/$metadata</String></Collection></Annotation>
    </Annotations>
    <Annotations Target="M.SpendParameters"><Annotation Term="Common.ResultContext"/></Annotations>
    <Annotations Target="M.SpendParameters/P_Currency"><Annotation Term="Common.Label" String="Display Currency"/></Annotations>
    <Annotations Target="M.Spend"><Annotation Term="UI.SelectionFields"><Collection><PropertyPath>Country</PropertyPath></Collection></Annotation></Annotations>
  </Schema></edmx:DataServices>
</edmx:Edmx>`);

const vh = `${head}
  <edmx:DataServices><Schema xmlns="http://docs.oasis-open.org/odata/ns/edm" Namespace="VH">
    <EntityType Name="Company"><Key><PropertyRef Name="Code"/></Key>
      <Property Name="Code" Type="Edm.String" Nullable="false"/><Property Name="Name" Type="Edm.String"/><Property Name="City" Type="Edm.String"/>
    </EntityType>
    <EntityContainer Name="C"><EntitySet Name="Companies" EntityType="VH.Company"/></EntityContainer>
    <Annotations Target="VH.Company/Code"><Annotation Term="Common.Label" String="Company Code"/>
      <Annotation Term="Common.Text" Path="Name"><Annotation Term="UI.TextArrangement" EnumMember="UI.TextArrangementType/TextFirst"/></Annotation></Annotations>
    <Annotations Target="VH.Company/Name"><Annotation Term="Common.Label" String="Company Name"/></Annotations>
    <Annotations Target="VH.Company/City"><Annotation Term="Common.Label" String="City"/></Annotations>
    <Annotations Target="M.Order/Company">
      <Annotation Term="Common.ValueListMapping"><Record><PropertyValue Property="CollectionPath" String="Companies"/>
        <PropertyValue Property="Parameters"><Collection>
          <Record Type="Common.ValueListParameterInOut"><PropertyValue Property="LocalDataProperty" PropertyPath="Company"/><PropertyValue Property="ValueListProperty" String="Code"/></Record>
          <Record Type="Common.ValueListParameterDisplayOnly"><PropertyValue Property="ValueListProperty" String="Name"/></Record>
          <Record Type="Common.ValueListParameterDisplayOnly"><PropertyValue Property="ValueListProperty" String="City"/></Record>
        </Collection></PropertyValue></Record></Annotation>
    </Annotations>
  </Schema></edmx:DataServices>
</edmx:Edmx>`;

const companies = [{ Code: '1000', Name: 'Germany GmbH', City: 'Hamburg' }, { Code: '2000', Name: 'US Inc.', City: 'Chicago' }];

function setup() {
  const provider = new MemoryProvider({ model, data: { Orders: [], 'SpendParameters/Set': [] }, valueListServices: { '../vh/$metadata': { metadata: vh, data: { Companies: companies } } } });
  const load = vi.spyOn(provider, 'valueListService');
  let vhQuery: ReturnType<typeof vi.spyOn> | undefined;
  const ready = provider.valueListService('../vh/$metadata').then((s) => { vhQuery = vi.spyOn(s.provider, 'query'); });
  load.mockClear();
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MantineProvider theme={smartKitMantineTheme}>
        <SmartKitProvider services={{ m: { model, dataProvider: provider, variants: new MemoryVariantStore() } }} locale="en" namespace="test">{children}</SmartKitProvider>
      </MantineProvider>
    );
  }
  return { Wrapper, load, ready, vhRequests: () => (vhQuery?.mock.calls ?? []).map((c) => c[0] as QueryRequest) };
}

describe('AL-10 AL-11 AL-12 Common.ValueListReferences in the filter field (stage 4 tail)', () => {
  it('AL-11 the field has a value help without loading the value help service; a token text is read from that service', async () => {
    const { Wrapper, load, ready, vhRequests } = setup();
    await ready;
    render(<Wrapper><ConditionInput entitySet="Orders" path="Company" conditions={[{ operator: 'EQ', values: ['2000'] }]} onChange={() => undefined} label="Company" /></Wrapper>);
    expect(screen.getByRole('button', { name: 'Show value help' })).toBeInTheDocument();
    expect(await screen.findByText('US Inc. (2000)')).toBeInTheDocument();
    expect(load).toHaveBeenCalledWith('../vh/$metadata', expect.anything());
    expect(vhRequests().some((r) => 'entitySet' in r.source && r.source.entitySet === 'Companies' && r.top === 2)).toBe(true);
  });

  it('AL-11 AL-12 the dialog reads the mapping\'s collection; the key column shows its text, the text parameter is no column of its own', async () => {
    const { Wrapper, ready } = setup();
    await ready;
    const onOk = vi.fn();
    render(<Wrapper><ValueHelpDialog opened entitySet="Orders" path="Company" title="Company" conditions={[]} onOk={onOk} onCancel={() => undefined} /></Wrapper>);
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText('Germany GmbH (1000)')).toBeInTheDocument();
    expect(within(dialog).getAllByRole('columnheader').map((h) => h.textContent).filter(Boolean)).toEqual(['Company Code', 'City']);
    fireEvent.click(within(dialog).getByText('US Inc. (2000)'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'OK' }));
    expect(onOk).toHaveBeenCalledWith([{ operator: 'EQ', values: ['2000'], text: 'US Inc.' }]);
  });
});

describe('AL-11 parameterized entity set in the filter bar (stage 4 tail)', () => {
  it('AL-11 parameters are the first fields and mandatory: nothing is executed until they are filled', async () => {
    const { Wrapper } = setup();
    const { result } = renderHook(() => useFilterState('SpendParameters/Set', { service: 'm' }), { wrapper: Wrapper });
    expect(result.current.fields).toEqual(['P_Currency', 'Country']);
    expect(result.current.missingRequired).toEqual(['P_Currency']);
    expect(result.current.applied).toBeNull();
    result.current.setConditions('P_Currency', [{ operator: 'EQ', values: ['EUR'] }, { operator: 'EQ', values: ['USD'] }]);
    await waitFor(() => expect(result.current.filters.P_Currency).toEqual([{ operator: 'EQ', values: ['USD'] }]));
    expect(result.current.missingRequired).toEqual([]);
  });
});
