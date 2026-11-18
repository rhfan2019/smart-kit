/**
 * docs/29 §4 P1-5 and P1-8 in the filter bar: value list In / InOut / Constant parameters filter the value help,
 * Out / InOut write the chosen row back (FE ValueHelpDelegate); Common.IsDigitSequence pads typed values
 * (sap.ui.model.odata.type.String parseValue).
 */
import { MantineProvider } from '@mantine/core';
import { buildModel, MemoryProvider, MemoryVariantStore, type QueryRequest } from '@rhfan2019/smart-kit-core';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SmartKitProvider, smartKitMantineTheme } from '../src';
import { digitSequenceValue, parseConditionText } from '../src/filter/conditionText';
import useFilterState, { type FilterStateApi } from '../src/kit/useFilterState';
import FilterBar from '../src/v4/fe/macros/FilterBar';

const model = buildModel(`<?xml version="1.0"?>
<edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx">
  <edmx:Reference Uri="c"><edmx:Include Namespace="com.sap.vocabularies.Common.v1" Alias="Common"/></edmx:Reference>
  <edmx:Reference Uri="u"><edmx:Include Namespace="com.sap.vocabularies.UI.v1" Alias="UI"/></edmx:Reference>
  <edmx:DataServices><Schema xmlns="http://docs.oasis-open.org/odata/ns/edm" Namespace="M">
    <EntityType Name="Order"><Key><PropertyRef Name="ID"/></Key>
      <Property Name="ID" Type="Edm.String" Nullable="false" MaxLength="10"/>
      <Property Name="Plant" Type="Edm.String" MaxLength="4"/>
      <Property Name="CompanyCode" Type="Edm.String" MaxLength="4"/>
      <Property Name="Country" Type="Edm.String" MaxLength="3"/>
    </EntityType>
    <EntityType Name="PlantVH"><Key><PropertyRef Name="Plant"/></Key>
      <Property Name="Plant" Type="Edm.String" Nullable="false" MaxLength="4"/>
      <Property Name="CompanyCode" Type="Edm.String" MaxLength="4"/>
      <Property Name="Country" Type="Edm.String" MaxLength="3"/>
      <Property Name="Language" Type="Edm.String" MaxLength="2"/>
    </EntityType>
    <EntityContainer Name="C">
      <EntitySet Name="Orders" EntityType="M.Order"/>
      <EntitySet Name="Plants" EntityType="M.PlantVH"/>
    </EntityContainer>
    <Annotations Target="M.Order">
      <Annotation Term="UI.SelectionFields"><Collection><PropertyPath>ID</PropertyPath><PropertyPath>Plant</PropertyPath><PropertyPath>CompanyCode</PropertyPath><PropertyPath>Country</PropertyPath></Collection></Annotation>
    </Annotations>
    <Annotations Target="M.Order/ID"><Annotation Term="Common.IsDigitSequence" Bool="true"/></Annotations>
    <Annotations Target="M.Order/Plant">
      <Annotation Term="Common.ValueList"><Record>
        <PropertyValue Property="CollectionPath" String="Plants"/>
        <PropertyValue Property="Parameters"><Collection>
          <Record Type="Common.ValueListParameterInOut"><PropertyValue Property="LocalDataProperty" PropertyPath="Plant"/><PropertyValue Property="ValueListProperty" String="Plant"/></Record>
          <Record Type="Common.ValueListParameterIn"><PropertyValue Property="LocalDataProperty" PropertyPath="CompanyCode"/><PropertyValue Property="ValueListProperty" String="CompanyCode"/></Record>
          <Record Type="Common.ValueListParameterOut"><PropertyValue Property="LocalDataProperty" PropertyPath="Country"/><PropertyValue Property="ValueListProperty" String="Country"/></Record>
          <Record Type="Common.ValueListParameterConstant"><PropertyValue Property="ValueListProperty" String="Language"/><PropertyValue Property="Constant" String="EN"/></Record>
        </Collection></PropertyValue>
      </Record></Annotation>
    </Annotations>
  </Schema></edmx:DataServices>
</edmx:Edmx>`);

const data = {
  Orders: [{ ID: '0000000123', Plant: 'P1', CompanyCode: '1000', Country: 'DE' }],
  Plants: [
    { Plant: 'P1', CompanyCode: '1000', Country: 'DE', Language: 'EN' },
    { Plant: 'P2', CompanyCode: '2000', Country: 'FR', Language: 'EN' },
    { Plant: 'P3', CompanyCode: '1000', Country: 'IT', Language: 'DE' },
  ],
};

function setup() {
  const provider = new MemoryProvider({ model, data });
  const query = vi.spyOn(provider, 'query');
  let state!: FilterStateApi;
  function Bar() {
    state = useFilterState('Orders', { autoExecute: false });
    return <FilterBar state={state} />;
  }
  render(
    <MantineProvider theme={smartKitMantineTheme}>
      <SmartKitProvider services={{ m: { model, dataProvider: provider, variants: new MemoryVariantStore() } }} locale="en" namespace="vh-params">
        <Bar />
      </SmartKitProvider>
    </MantineProvider>,
  );
  const plantRequests = () => query.mock.calls.map((c) => c[0] as QueryRequest).filter((r) => 'entitySet' in r.source && r.source.entitySet === 'Plants');
  return { state: () => state, plantRequests };
}

describe('AL-10 P1-5 value help parameters in the filter bar', () => {
  it('AL-10 P1-5 In and Constant filter the value help request; Out writes the chosen row to the other field', async () => {
    const { state, plantRequests } = setup();
    await screen.findByText(/^Adapt Filters/);
    act(() => state().setConditions('CompanyCode', [{ operator: 'EQ', values: ['1000'] }]));
    const plant = document.querySelector('[data-sk-filter="Plant"]')!;
    fireEvent.click(within(plant as HTMLElement).getByRole('button', { name: 'Show value help' }));
    const dialog = await screen.findByRole('dialog');
    // only P1: P2 has another company code, P3 another language
    await within(dialog).findByLabelText('P1');
    expect(within(dialog).queryByLabelText('P2')).toBeNull();
    expect(within(dialog).queryByLabelText('P3')).toBeNull();
    expect(plantRequests().at(-1)!.filters).toEqual({ CompanyCode: [{ operator: 'EQ', values: ['1000'] }], Language: [{ operator: 'EQ', values: ['EN'] }] });
    fireEvent.click(within(dialog).getByLabelText('P1'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'OK' }));
    await waitFor(() => expect(state().filters.Plant).toEqual([{ operator: 'EQ', values: ['P1'], text: undefined }]));
    expect(state().filters.Country).toEqual([{ operator: 'EQ', values: ['DE'] }]);
  });
});

describe('AL-10 P1-8 Common.IsDigitSequence', () => {
  const id = model.entityTypes['M.Order']!.properties.ID!;
  it('AL-10 P1-8 typed digits are padded with zeros to MaxLength; leading zeros are normalized (UI5 String type)', () => {
    expect(digitSequenceValue('123', id)).toBe('0000000123');
    expect(digitSequenceValue('000123', id)).toBe('0000000123');
    expect(digitSequenceValue('04500002573', id)).toBe('4500002573');
    expect(digitSequenceValue('12a', id)).toBe('12a');
    expect(digitSequenceValue('0', { ...id, maxLength: undefined })).toBe('0');
    expect(digitSequenceValue('00123', { ...id, maxLength: undefined })).toBe('123');
    expect(digitSequenceValue('123', { ...id, isDigitSequence: false })).toBe('123');
  });
  it('AL-10 P1-8 parseConditionText pads EQ, ranges and comparisons, not Contains / StartsWith / EndsWith', () => {
    expect(parseConditionText('123', id)).toEqual({ operator: 'EQ', values: ['0000000123'] });
    expect(parseConditionText('1...20', id)).toEqual({ operator: 'BT', values: ['0000000001', '0000000020'] });
    expect(parseConditionText('>5', id)).toEqual({ operator: 'GT', values: ['0000000005'] });
    expect(parseConditionText('*12*', id)).toEqual({ operator: 'Contains', values: ['12'] });
    expect(parseConditionText('12*', id)).toEqual({ operator: 'StartsWith', values: ['12'] });
  });
});
