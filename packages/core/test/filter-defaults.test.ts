/**
 * docs/29 §4 P1-4, P1-5, P1-7: Common.FilterDefaultValue, value list In / InOut / Constant parameters, default
 * searchability (Capabilities.SearchRestrictions, Common.ValueList/SearchSupported) — as in Fiori elements 1.154.
 */
import { describe, expect, it } from 'vitest';
import { buildModel, buildValueHelpRequest, formatValue, toQueryString, type PropertyModel } from '../src';

const csdl = (annotations: string, setAnnotations = '') => `<?xml version="1.0"?>
<edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx">
  <edmx:Reference Uri="c"><edmx:Include Namespace="com.sap.vocabularies.Common.v1" Alias="Common"/></edmx:Reference>
  <edmx:Reference Uri="u"><edmx:Include Namespace="com.sap.vocabularies.UI.v1" Alias="UI"/></edmx:Reference>
  <edmx:Reference Uri="k"><edmx:Include Namespace="Org.OData.Capabilities.V1" Alias="Capabilities"/></edmx:Reference>
  <edmx:DataServices><Schema xmlns="http://docs.oasis-open.org/odata/ns/edm" Namespace="M">
    <EntityType Name="Order"><Key><PropertyRef Name="ID"/></Key>
      <Property Name="ID" Type="Edm.String" Nullable="false" MaxLength="10"/>
      <Property Name="Plant" Type="Edm.String" MaxLength="4"/>
      <Property Name="CompanyCode" Type="Edm.String" MaxLength="4"/>
      <Property Name="Country" Type="Edm.String" MaxLength="3"/>
      <Property Name="Type" Type="Edm.String" MaxLength="2"/>
      <Property Name="Quantity" Type="Edm.Int32"/>
    </EntityType>
    <EntityType Name="PlantVH"><Key><PropertyRef Name="Plant"/></Key>
      <Property Name="Plant" Type="Edm.String" Nullable="false" MaxLength="4"/>
      <Property Name="CompanyCode" Type="Edm.String" MaxLength="4"/>
      <Property Name="Country" Type="Edm.String" MaxLength="3"/>
      <Property Name="Language" Type="Edm.String" MaxLength="2"/>
      <Property Name="Name" Type="Edm.String"/>
    </EntityType>
    <EntityContainer Name="C">
      <EntitySet Name="Orders" EntityType="M.Order"/>
      <EntitySet Name="Plants" EntityType="M.PlantVH">${setAnnotations}</EntitySet>
    </EntityContainer>
    ${annotations}
  </Schema></edmx:DataServices>
</edmx:Edmx>`;

const plantValueList = (searchSupported = '') => `
  <Annotations Target="M.Order/Plant">
    <Annotation Term="Common.ValueList"><Record>
      <PropertyValue Property="CollectionPath" String="Plants"/>${searchSupported}
      <PropertyValue Property="Parameters"><Collection>
        <Record Type="Common.ValueListParameterInOut"><PropertyValue Property="LocalDataProperty" PropertyPath="Plant"/><PropertyValue Property="ValueListProperty" String="Plant"/></Record>
        <Record Type="Common.ValueListParameterIn"><PropertyValue Property="LocalDataProperty" PropertyPath="CompanyCode"/><PropertyValue Property="ValueListProperty" String="CompanyCode"/></Record>
        <Record Type="Common.ValueListParameterInOut"><PropertyValue Property="LocalDataProperty" PropertyPath="Country"/><PropertyValue Property="ValueListProperty" String="Country"/></Record>
        <Record Type="Common.ValueListParameterConstant"><PropertyValue Property="ValueListProperty" String="Language"/><PropertyValue Property="Constant" String="EN"/></Record>
        <Record Type="Common.ValueListParameterDisplayOnly"><PropertyValue Property="ValueListProperty" String="Name"/></Record>
      </Collection></PropertyValue>
    </Record></Annotation>
  </Annotations>`;

describe('AL-10 P1-4 Common.FilterDefaultValue', () => {
  const defaults = `
    <Annotations Target="M.Order/Type"><Annotation Term="Common.FilterDefaultValue" String="NB"/></Annotations>
    <Annotations Target="M.Order/Quantity"><Annotation Term="Common.FilterDefaultValue" Int="5"/></Annotations>`;

  it('AL-10 P1-4 without a default selection variant each FilterDefaultValue gives an EQ condition (FE FilterHelper)', () => {
    const m = buildModel(csdl(defaults));
    expect(m.entityTypes['M.Order']!.properties.Type!.filterDefaultValue).toBe('NB');
    expect(m.ui['M.Order']!.selectionVariant).toEqual([
      { path: 'Type', exclude: false, operator: 'EQ', values: ['NB'] },
      { path: 'Quantity', exclude: false, operator: 'EQ', values: [5] },
    ]);
  });

  it('AL-10 P1-4 a default UI.SelectionVariant wins: FilterDefaultValue is ignored', () => {
    const sv = `<Annotations Target="M.Order"><Annotation Term="UI.SelectionVariant"><Record><PropertyValue Property="SelectOptions"><Collection>
      <Record><PropertyValue Property="PropertyName" PropertyPath="CompanyCode"/><PropertyValue Property="Ranges"><Collection>
        <Record><PropertyValue Property="Sign" EnumMember="UI.SelectionRangeSignType/I"/><PropertyValue Property="Option" EnumMember="UI.SelectionRangeOptionType/EQ"/><PropertyValue Property="Low" String="1000"/></Record>
      </Collection></PropertyValue></Record></Collection></PropertyValue></Record></Annotation></Annotations>`;
    expect(buildModel(csdl(defaults + sv)).ui['M.Order']!.selectionVariant).toEqual([{ path: 'CompanyCode', exclude: false, operator: 'EQ', values: ['1000'] }]);
    // an empty selection variant also counts as "present"
    const empty = `<Annotations Target="M.Order"><Annotation Term="UI.SelectionVariant"><Record/></Annotation></Annotations>`;
    expect(buildModel(csdl(defaults + empty)).ui['M.Order']!.selectionVariant).toEqual([]);
  });
});

describe('AL-10 P1-5 value help In / InOut / Constant parameters', () => {
  const m = buildModel(csdl(plantValueList()));
  const vl = m.entityTypes['M.Order']!.properties.Plant!.valueList!;
  const query = (o: Parameters<typeof buildValueHelpRequest>[2]) => decodeURIComponent(toQueryString(m, buildValueHelpRequest(m, vl, o)));

  it('AL-10 P1-5 Constant always filters; In and InOut take the filter bar conditions of their local property', () => {
    expect(query({})).toContain("$filter=Language eq 'EN'");
    const q = query({ filters: { CompanyCode: [{ operator: 'EQ', values: ['1000'] }, { operator: 'EQ', values: ['2000'] }], Country: [{ operator: 'EQ', values: ['DE'], text: 'Germany' }], Plant: [{ operator: 'EQ', values: ['P1'] }] } });
    expect(q).toContain("$filter=Language eq 'EN' and (CompanyCode eq '1000' or CompanyCode eq '2000') and Country eq 'DE'");
    // the parameter of the field itself (InOut Plant) does not filter its own value help
    expect(q).not.toContain("Plant eq 'P1'");
  });

  it('AL-10 P1-5 incomplete conditions are ignored; loading descriptions by key does not apply the In filters', () => {
    expect(query({ filters: { CompanyCode: [{ operator: 'EQ', values: [''] }] } })).toContain("$filter=Language eq 'EN'");
    const byKey = query({ keys: ['P1'], filters: { CompanyCode: [{ operator: 'EQ', values: ['1000'] }] } });
    expect(byKey).toContain("$filter=Plant eq 'P1'");
    expect(byKey).not.toContain('CompanyCode eq');
  });
});

describe('AL-10 P1-7 search: Searchable and SearchSupported default to true', () => {
  it('AL-10 P1-7 an entity set without SearchRestrictions is searchable', () => {
    expect(buildModel(csdl('')).entitySets.Orders!.capabilities.searchable).toBe(true);
  });

  it('AL-10 P1-7 value help: $search unless SearchSupported=false or Searchable=false (FE ValueListHelper.entityIsSearchable)', () => {
    const search = (vlXml: string, setXml = '') => {
      const m = buildModel(csdl(vlXml, setXml));
      return buildValueHelpRequest(m, m.entityTypes['M.Order']!.properties.Plant!.valueList!, { search: 'ab' });
    };
    const no = '<PropertyValue Property="SearchSupported" Bool="false"/>';
    const notSearchable = '<Annotation Term="Capabilities.SearchRestrictions"><Record><PropertyValue Property="Searchable" Bool="false"/></Record></Annotation>';
    const searchable = '<Annotation Term="Capabilities.SearchRestrictions"><Record><PropertyValue Property="Searchable" Bool="true"/></Record></Annotation>';
    expect(search(plantValueList()).search).toBe('ab');
    expect(search(plantValueList(no)).search).toBeUndefined();
    expect(search(plantValueList(no), searchable).search).toBeUndefined();
    expect(search(plantValueList(), notSearchable).search).toBeUndefined();
    // not searchable: contains over the string parameters (smart-kit fallback)
    expect(search(plantValueList(no)).anyOf).toMatchObject({ Plant: [{ operator: 'Contains', values: ['ab'] }] });
  });
});

describe('AL-12 P1-8 Common.IsDigitSequence display', () => {
  const numc = { name: 'N', edmType: 'Edm.String', isDigitSequence: true, maxLength: 10, isCurrency: false } as unknown as PropertyModel;
  it('AL-12 P1-8 digits lose leading zeros, 0 with MaxLength is empty, other values are kept (UI5 String formatValue)', () => {
    expect(formatValue('0000000123', numc, { locale: 'en' })).toBe('123');
    expect(formatValue('0000000000', numc, { locale: 'en' })).toBe('');
    expect(formatValue('0000000000', { ...numc, maxLength: undefined }, { locale: 'en' })).toBe('0');
    expect(formatValue('00AB', numc, { locale: 'en' })).toBe('00AB');
  });
});
