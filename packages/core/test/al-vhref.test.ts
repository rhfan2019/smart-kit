/**
 * Stage 4 tail (docs/29 §5, AL-10 – AL-12): Common.ValueListReferences / Common.ValueListMapping (value lists of a
 * separate value help service, SAPUI5 ODataMetaModel#requestValueListInfo) and parameterized entity sets
 * (Common.ResultContext, UI.SelectionVariant/Parameters; FE FilterBar getFilterFields, FilterUtils
 * getBindingPathForParameters).
 */
import { describe, expect, it, vi } from 'vitest';
import {
  buildListRequest, buildModel, buildValueHelpRequest, MemoryProvider, ODataV4Provider, readValueListService, referencedValueLists, resolveValueListReference,
  sourcePath, toQueryString, type FetchLike,
} from '../src';

const head = `<?xml version="1.0"?>
<edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx">
  <edmx:Reference Uri="u"><edmx:Include Namespace="com.sap.vocabularies.UI.v1" Alias="UI"/></edmx:Reference>
  <edmx:Reference Uri="c"><edmx:Include Namespace="com.sap.vocabularies.Common.v1" Alias="Common"/></edmx:Reference>`;

const main = `${head}
  <edmx:DataServices><Schema xmlns="http://docs.oasis-open.org/odata/ns/edm" Namespace="M">
    <EntityType Name="Order"><Key><PropertyRef Name="ID"/></Key>
      <Property Name="ID" Type="Edm.String" Nullable="false"/><Property Name="Company" Type="Edm.String"/><Property Name="Kind" Type="Edm.String"/>
    </EntityType>
    <EntityType Name="Kind"><Key><PropertyRef Name="Code"/></Key><Property Name="Code" Type="Edm.String" Nullable="false"/></EntityType>
    <EntityType Name="SpendParameters"><Key><PropertyRef Name="P_Currency"/><PropertyRef Name="P_Date"/></Key>
      <Property Name="P_Currency" Type="Edm.String" Nullable="false"/><Property Name="P_Date" Type="Edm.Date" Nullable="false"/>
      <NavigationProperty Name="Set" Type="Collection(M.Spend)" ContainsTarget="true"/>
    </EntityType>
    <EntityType Name="Spend"><Key><PropertyRef Name="Supplier"/></Key>
      <Property Name="Supplier" Type="Edm.String" Nullable="false"/><Property Name="Country" Type="Edm.String"/><Property Name="Amount" Type="Edm.Decimal" Scale="2"/>
    </EntityType>
    <EntityContainer Name="C">
      <EntitySet Name="Orders" EntityType="M.Order"/><EntitySet Name="Kinds" EntityType="M.Kind"/>
      <EntitySet Name="SpendParameters" EntityType="M.SpendParameters"/>
    </EntityContainer>
    <Annotations Target="M.Order/Company">
      <Annotation Term="Common.ValueListReferences"><Collection><String>../vh/$metadata</String></Collection></Annotation>
    </Annotations>
    <Annotations Target="M.Order/Kind">
      <Annotation Term="Common.ValueListReferences"><Collection><String>../vh/$metadata</String></Collection></Annotation>
      <Annotation Term="Common.ValueList" Qualifier="Local"><Record><PropertyValue Property="CollectionPath" String="Kinds"/>
        <PropertyValue Property="Parameters"><Collection>
          <Record Type="Common.ValueListParameterInOut"><PropertyValue Property="LocalDataProperty" PropertyPath="Kind"/><PropertyValue Property="ValueListProperty" String="Code"/></Record>
        </Collection></PropertyValue></Record></Annotation>
    </Annotations>
    <Annotations Target="M.SpendParameters"><Annotation Term="Common.ResultContext"/></Annotations>
    <Annotations Target="M.SpendParameters/P_Currency"><Annotation Term="Common.Label" String="Display Currency"/></Annotations>
    <Annotations Target="M.SpendParameters/P_Date"><Annotation Term="Common.FilterDefaultValue" String="2026-11-14"/></Annotations>
    <Annotations Target="M.Spend">
      <Annotation Term="UI.SelectionFields"><Collection><PropertyPath>Country</PropertyPath></Collection></Annotation>
      <Annotation Term="UI.SelectionVariant"><Record><PropertyValue Property="Parameters"><Collection>
        <Record Type="UI.Parameter"><PropertyValue Property="PropertyName" PropertyPath="P_Currency"/><PropertyValue Property="PropertyValue" String="EUR"/></Record>
      </Collection></PropertyValue></Record></Annotation>
    </Annotations>
  </Schema></edmx:DataServices>
</edmx:Edmx>`;

/** The value help service: an own schema, mappings for M.Order/Company (unqualified and #ByCity) and M.Order/Kind. */
const vh = `${head}
  <edmx:Reference Uri="../main/$metadata"><edmx:Include Namespace="M" Alias="Main"/></edmx:Reference>
  <edmx:DataServices><Schema xmlns="http://docs.oasis-open.org/odata/ns/edm" Namespace="VH">
    <EntityType Name="Company"><Key><PropertyRef Name="Code"/></Key>
      <Property Name="Code" Type="Edm.String" Nullable="false"/><Property Name="Name" Type="Edm.String"/><Property Name="City" Type="Edm.String"/>
    </EntityType>
    <EntityContainer Name="C"><EntitySet Name="Companies" EntityType="VH.Company"/></EntityContainer>
    <Annotations Target="VH.Company/Code"><Annotation Term="Common.Label" String="Company"/>
      <Annotation Term="Common.Text" Path="Name"><Annotation Term="UI.TextArrangement" EnumMember="UI.TextArrangementType/TextFirst"/></Annotation></Annotations>
    <Annotations Target="Main.Order/Company">
      <Annotation Term="Common.ValueListMapping" Qualifier="ByCity"><Record><PropertyValue Property="CollectionPath" String="Companies"/>
        <PropertyValue Property="Parameters"><Collection>
          <Record Type="Common.ValueListParameterOut"><PropertyValue Property="LocalDataProperty" PropertyPath="Company"/><PropertyValue Property="ValueListProperty" String="Code"/></Record>
          <Record Type="Common.ValueListParameterDisplayOnly"><PropertyValue Property="ValueListProperty" String="City"/></Record>
        </Collection></PropertyValue></Record></Annotation>
      <Annotation Term="Common.ValueListMapping"><Record><PropertyValue Property="Label" String="Companies"/><PropertyValue Property="CollectionPath" String="Companies"/>
        <PropertyValue Property="Parameters"><Collection>
          <Record Type="Common.ValueListParameterInOut"><PropertyValue Property="LocalDataProperty" PropertyPath="Company"/><PropertyValue Property="ValueListProperty" String="Code"/></Record>
          <Record Type="Common.ValueListParameterDisplayOnly"><PropertyValue Property="ValueListProperty" String="Name"/></Record>
        </Collection></PropertyValue></Record></Annotation>
    </Annotations>
    <Annotations Target="M.Order/Kind">
      <Annotation Term="Common.ValueListMapping" Qualifier="Remote"><Record><PropertyValue Property="CollectionPath" String="Companies"/>
        <PropertyValue Property="Parameters"><Collection>
          <Record Type="Common.ValueListParameterInOut"><PropertyValue Property="LocalDataProperty" PropertyPath="Kind"/><PropertyValue Property="ValueListProperty" String="Code"/></Record>
        </Collection></PropertyValue></Record></Annotation>
    </Annotations>
  </Schema></edmx:DataServices>
</edmx:Edmx>`;

const model = buildModel(main);
const dummy = new MemoryProvider({ model, data: {} });

function response(body: string, status = 200) {
  return { ok: status < 400, status, statusText: '', headers: { get: () => null }, text: async () => body };
}

describe('AL-10 AL-11 AL-12 Common.ValueListReferences / ValueListMapping (stage 4 tail)', () => {
  it('AL-10 the references are read from the property; no local value list comes from them', () => {
    const company = model.entityTypes['M.Order']!.properties.Company!;
    expect(company.valueListReferences).toEqual(['../vh/$metadata']);
    expect(company.valueList).toBeUndefined();
  });

  it('AL-10 references resolve against the data service $metadata URL (SAPUI5 _Helper.makeAbsolute)', () => {
    expect(resolveValueListReference('/odata/main/', '../vh/$metadata')).toBe('/odata/vh/$metadata');
    expect(resolveValueListReference('https://h/sap/opu/odata4/srv/0001/', "../../../../srvd_f4/sap/i_x/0001;ps='a'/$metadata")).toBe("https://h/sap/srvd_f4/sap/i_x/0001;ps='a'/$metadata");
  });

  it('AL-10 the value help document: mappings by unaliased target and qualifier, its own model', () => {
    const service = readValueListService('../vh/$metadata', '/odata/vh/$metadata', vh, () => dummy);
    expect(Object.keys(service.mappings).sort()).toEqual(['M.Order/Company', 'M.Order/Kind']);
    expect(Object.keys(service.mappings['M.Order/Company']!).sort()).toEqual(['', 'ByCity']);
    expect(service.model.entitySets.Companies?.typeName).toBe('VH.Company');
  });

  it('AL-10 AL-11 value lists of the references: unqualified first, key and description from the value help service, SearchSupported default', () => {
    const service = readValueListService('../vh/$metadata', '/odata/vh/$metadata', vh, () => dummy);
    const lists = referencedValueLists(model, 'M.Order', 'Company', [service]);
    expect(lists.map((l) => l.qualifier)).toEqual(['', 'ByCity']);
    expect(lists[0]).toMatchObject({ collectionPath: 'Companies', keyProperty: 'Code', descriptionProperty: 'Name', reference: '../vh/$metadata', searchSupported: true, label: 'Companies' });
    // the mappings of the references, then the property's own Common.ValueList annotations (requestValueListInfo)
    expect(referencedValueLists(model, 'M.Order', 'Kind', [service]).map((l) => [l.qualifier, l.reference])).toEqual([['Remote', '../vh/$metadata'], ['Local', undefined]]);
  });

  it('AL-10 value help requests of a mapping use the value help service model; a typed value is validated by key or description', () => {
    const service = readValueListService('../vh/$metadata', '/odata/vh/$metadata', vh, () => dummy);
    const vl = referencedValueLists(model, 'M.Order', 'Company', [service])[0]!;
    const dialog = buildValueHelpRequest(service.model, vl, { purpose: 'dialog' });
    expect(decodeURIComponent(toQueryString(service.model, dialog))).toBe('$count=true&$select=Code,Name&$orderby=Code&$skip=0&$top=50');
    // type-ahead: no $count (FE ValueListHelper getTableItemsParameters "length: 10")
    expect(buildValueHelpRequest(service.model, vl, { search: '10', top: 10 }).count).toBe(false);
    const typed = buildValueHelpRequest(service.model, vl, { purpose: 'validate', keys: ['1000'] });
    expect(decodeURIComponent(toQueryString(service.model, typed))).toBe("$filter=Code eq '1000' or Name eq '1000'&$top=2");
    const codeOnly = buildValueHelpRequest(service.model, vl, { purpose: 'validate', keys: ['1000'], withDescription: false });
    expect(decodeURIComponent(toQueryString(service.model, codeOnly))).toBe("$filter=Code eq '1000'&$top=2");
  });

  it('AL-10 ODataV4Provider loads the value help service once, with the same headers, and reads its data from it', async () => {
    const fetch = vi.fn<FetchLike>(async (url) => (url.endsWith('$metadata') ? response(vh) : response('{"value":[{"Code":"1000","Name":"A"}]}')));
    const provider = new ODataV4Provider({ serviceUrl: '/odata/main/', model, fetch, getLanguage: () => 'en' });
    const [a, b] = await Promise.all([provider.valueListService('../vh/$metadata'), provider.valueListService('../vh/$metadata')]);
    expect(a).toBe(b);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0]![0]).toBe('/odata/vh/$metadata');
    expect(fetch.mock.calls[0]![1]?.headers).toMatchObject({ Accept: 'application/xml', 'Accept-Language': 'en' });
    const vl = referencedValueLists(model, 'M.Order', 'Company', [a])[0]!;
    const rows = await a.provider.query(buildValueHelpRequest(a.model, vl, { purpose: 'description', keys: ['1000'] }));
    expect(rows.rows).toHaveLength(1);
    expect(decodeURIComponent(fetch.mock.calls[1]![0])).toBe("/odata/vh/Companies?$select=Name&$filter=Code eq '1000'&$top=2");
  });

  it('AL-10 MemoryProvider: value help services given as $metadata and rows', async () => {
    const provider = new MemoryProvider({ model, data: {}, valueListServices: { '../vh/$metadata': { metadata: vh, data: { Companies: [{ Code: '1000', Name: 'A', City: 'X' }] } } } });
    const service = await provider.valueListService('../vh/$metadata');
    const vl = referencedValueLists(model, 'M.Order', 'Company', [service])[0]!;
    const res = await service.provider.query(buildValueHelpRequest(service.model, vl, { purpose: 'validate', keys: ['A'] }));
    expect(res.rows.map((r) => r.Code)).toEqual(['1000']);
    await expect(provider.valueListService('../other/$metadata')).rejects.toThrow(/No value help service/);
  });
});

describe('AL-10 AL-11 parameterized entity sets: Common.ResultContext, UI.SelectionVariant/Parameters (stage 4 tail)', () => {
  it('AL-11 the contained result set is an entity set "P/Set" with mandatory single-value parameters', () => {
    const set = model.entitySets['SpendParameters/Set']!;
    expect(set.typeName).toBe('M.Spend');
    expect(set.parameters).toEqual({ entitySet: 'SpendParameters', navigation: 'Set', typeName: 'M.SpendParameters', properties: ['P_Currency', 'P_Date'] });
    expect(set.capabilities.requiredFilters).toEqual(['P_Currency', 'P_Date']);
    expect(set.capabilities.filterExpressions).toMatchObject({ P_Currency: 'SingleValue', P_Date: 'SingleValue' });
    const spend = model.entityTypes['M.Spend']!;
    expect(spend.properties.P_Currency).toMatchObject({ label: 'Display Currency', parameter: true, isKey: false });
    expect(spend.propertyOrder).not.toContain('P_Currency');
  });

  it('AL-11 defaults: UI.SelectionVariant/Parameters and the parameters\' Common.FilterDefaultValue', () => {
    expect(model.ui['M.Spend']!.selectionVariant).toEqual([
      { path: 'P_Currency', exclude: false, operator: 'EQ', values: ['EUR'] },
      { path: 'P_Date', exclude: false, operator: 'EQ', values: ['2026-11-14'] },
    ]);
  });

  it('AL-10 the request path carries the parameters (key literals in parameter order), the other conditions are $filter', () => {
    const req = buildListRequest(model, model.ui['M.Spend']!, {
      source: { entitySet: 'SpendParameters/Set' },
      columns: [],
      filters: { P_Date: [{ operator: 'EQ', values: ['2026-11-14'] }], P_Currency: [{ operator: 'EQ', values: ['EUR'] }], Country: [{ operator: 'EQ', values: ['DE'] }] },
    });
    expect(sourcePath(model, req.source, req.filters)).toBe("SpendParameters(P_Currency='EUR',P_Date=2026-11-14)/Set");
    expect(decodeURIComponent(toQueryString(model, req))).toContain("$filter=Country eq 'DE'");
    expect(toQueryString(model, req)).not.toContain('P_Currency');
    const provider = new ODataV4Provider({ serviceUrl: '/s/', model, fetch: vi.fn() });
    expect(provider.queryUrl(req)).toMatch(/^\/s\/SpendParameters\(P_Currency='EUR',P_Date=2026-11-14\)\/Set\?/);
    expect(() => sourcePath(model, req.source, { P_Currency: [{ operator: 'EQ', values: ['EUR'] }] })).toThrow(/no value for P_Date/);
  });
});
