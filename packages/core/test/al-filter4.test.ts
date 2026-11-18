/**
 * Stage 4 filter bar and value help annotations (docs/29 §5 筛选栏和值帮助, AL-10 – AL-12): FilterExpressionRestrictions
 * (strictest record), FE semantic date operators, Capabilities.FilterFunctions (tolower), qualified value lists and
 * Common.ValueListRelevantQualifiers, the value list description from the key's Common.Text, the value help requests.
 */
import { describe, expect, it } from 'vitest';
import { buildListRequest, buildModel, buildValueHelpRequest, matches, relativeDateRange, resolveCondition, toFilter, toQueryString, type Condition } from '../src';

const xml = (container: string, extra: string) => `<?xml version="1.0"?>
<edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx">
  <edmx:Reference Uri="u"><edmx:Include Namespace="com.sap.vocabularies.UI.v1" Alias="UI"/></edmx:Reference>
  <edmx:Reference Uri="c"><edmx:Include Namespace="com.sap.vocabularies.Common.v1" Alias="Common"/></edmx:Reference>
  <edmx:Reference Uri="p"><edmx:Include Namespace="Org.OData.Capabilities.V1" Alias="Capabilities"/></edmx:Reference>
  <edmx:DataServices><Schema xmlns="http://docs.oasis-open.org/odata/ns/edm" Namespace="M">
    <EntityType Name="Order"><Key><PropertyRef Name="ID"/></Key>
      <Property Name="ID" Type="Edm.String" Nullable="false"/><Property Name="Customer" Type="Edm.String"/><Property Name="Day" Type="Edm.Date"/>
      <Property Name="Region" Type="Edm.String"/>
    </EntityType>
    <EntityType Name="Customer"><Key><PropertyRef Name="Customer"/></Key>
      <Property Name="Customer" Type="Edm.String" Nullable="false"/><Property Name="Name" Type="Edm.String"/><Property Name="City" Type="Edm.String"/>
      <Property Name="Country" Type="Edm.String"/><Property Name="Internal" Type="Edm.String"/>
    </EntityType>
    <EntityContainer Name="C">${container}
      <EntitySet Name="Orders" EntityType="M.Order"/><EntitySet Name="Customers" EntityType="M.Customer"/>
    </EntityContainer>
    <Annotations Target="M.Customer/Customer"><Annotation Term="Common.Text" Path="Name"/></Annotations>
    <Annotations Target="M.Customer/Internal"><Annotation Term="UI.Hidden" Bool="true"/></Annotations>
    <Annotations Target="M.Customer">
      <Annotation Term="UI.SelectionFields"><Collection><PropertyPath>Country</PropertyPath></Collection></Annotation>
      <Annotation Term="UI.PresentationVariant"><Record><PropertyValue Property="SortOrder"><Collection><Record><PropertyValue Property="Property" PropertyPath="City"/><PropertyValue Property="Descending" Bool="true"/></Record></Collection></PropertyValue></Record></Annotation>
    </Annotations>
    <Annotations Target="M.Order/Customer">
      <Annotation Term="Common.ValueList"><Record><PropertyValue Property="CollectionPath" String="Customers"/><PropertyValue Property="Label" String="By name"/>
        <PropertyValue Property="Parameters"><Collection>
          <Record Type="Common.ValueListParameterInOut"><PropertyValue Property="LocalDataProperty" PropertyPath="Customer"/><PropertyValue Property="ValueListProperty" String="Customer"/></Record>
          <Record Type="Common.ValueListParameterDisplayOnly"><PropertyValue Property="ValueListProperty" String="City"/></Record>
          <Record Type="Common.ValueListParameterDisplayOnly"><PropertyValue Property="ValueListProperty" String="Internal"/></Record>
          <Record Type="Common.ValueListParameterConstant"><PropertyValue Property="ValueListProperty" String="Country"/><PropertyValue Property="Constant" String="DE"/></Record>
        </Collection></PropertyValue></Record></Annotation>
      <Annotation Term="Common.ValueList" Qualifier="ByCity"><Record><PropertyValue Property="CollectionPath" String="Customers"/><PropertyValue Property="Label" String="By city"/>
        <PropertyValue Property="Parameters"><Collection>
          <Record Type="Common.ValueListParameterOut"><PropertyValue Property="LocalDataProperty" PropertyPath="Customer"/><PropertyValue Property="ValueListProperty" String="Customer"/></Record>
        </Collection></PropertyValue></Record></Annotation>
      <Annotation Term="Common.ValueList" Qualifier="Unused"><Record><PropertyValue Property="CollectionPath" String="Customers"/>
        <PropertyValue Property="Parameters"><Collection>
          <Record Type="Common.ValueListParameterOut"><PropertyValue Property="LocalDataProperty" PropertyPath="Customer"/><PropertyValue Property="ValueListProperty" String="Customer"/></Record>
        </Collection></PropertyValue></Record></Annotation>
      ${extra}
    </Annotations>
  </Schema></edmx:DataServices>
</edmx:Edmx>`;

const RELEVANT = '<Annotation Term="Common.ValueListRelevantQualifiers"><Collection><String></String><String>ByCity</String></Collection></Annotation>';
const restrictions = `<Annotation Term="Capabilities.FilterRestrictions"><Record><PropertyValue Property="FilterExpressionRestrictions"><Collection>
  <Record><PropertyValue Property="Property" PropertyPath="Region"/><PropertyValue Property="AllowedExpressions" String="MultiValue"/></Record>
  <Record><PropertyValue Property="Property" PropertyPath="Region"/><PropertyValue Property="AllowedExpressions" String="SingleValue"/></Record>
  <Record><PropertyValue Property="Property" PropertyPath="Region"/><PropertyValue Property="AllowedExpressions" String="MultiRange"/></Record>
</Collection></PropertyValue></Record></Annotation>`;
const container = `<Annotation Term="Capabilities.FilterFunctions"><Collection><String>tolower</String></Collection></Annotation>`;

const model = buildModel(xml(container, RELEVANT).replace('<EntitySet Name="Orders" EntityType="M.Order"/>', `<EntitySet Name="Orders" EntityType="M.Order">${restrictions}</EntitySet>`));
const ui = model.ui['M.Order']!;

describe('AL-10 AL-11 stage 4 filter bar annotations (docs/29 §5)', () => {
  it('AL-10 P2 FilterExpressionRestrictions: several records for one property, the strictest wins', () => {
    expect(model.entitySets.Orders!.capabilities.filterExpressions.Region).toBe('SingleValue');
    const req = buildListRequest(model, ui, { source: { entitySet: 'Orders' }, columns: [], filters: { Region: [{ operator: 'EQ', values: ['A'] }, { operator: 'EQ', values: ['B'] }] } });
    expect(req.filters?.Region).toEqual([{ operator: 'EQ', values: ['B'] }]);
  });

  it('AL-10 P2 Capabilities.FilterFunctions tolower (container): string conditions are case-insensitive', () => {
    expect(model.entitySets.Orders!.capabilities.caseInsensitive).toBe(true);
    const req = buildListRequest(model, ui, { source: { entitySet: 'Orders' }, columns: [], filters: { ID: [{ operator: 'EQ', values: ['x1'] }], Customer: [{ operator: 'Contains', values: ['Ab'] }], Day: [{ operator: 'EQ', values: ['2026-01-02'] }] } });
    expect(decodeURIComponent(toQueryString(model, req))).toContain("$filter=tolower(ID) eq tolower('x1') and contains(tolower(Customer),tolower('Ab')) and Day eq 2026-01-02");
    expect(matches('ABC', [{ operator: 'EQ', values: ['abc'] }], 'Edm.String', { caseInsensitive: true })).toBe(true);
    expect(matches('ABC', [{ operator: 'EQ', values: ['abc'] }], 'Edm.String')).toBe(false);
  });

  it('AL-10 P2 FE semantic date operators: FROM / TO / DATE / DATERANGE, last / next N weeks, months …', () => {
    const today = '2026-11-18'; // a Wednesday
    const r = (c: Condition, weekStartsOn = 0) => resolveCondition(c, { today, weekStartsOn });
    expect(r({ operator: 'FROM', values: ['2026-01-01'] })).toEqual({ operator: 'GE', values: ['2026-01-01'] });
    expect(r({ operator: 'TO', values: ['2026-01-31'] })).toEqual({ operator: 'LE', values: ['2026-01-31'] });
    expect(r({ operator: 'DATE', values: ['2026-01-05'] })).toEqual({ operator: 'EQ', values: ['2026-01-05'] });
    expect(r({ operator: 'DATERANGE', values: ['2026-01-05', '2026-01-09'] })).toEqual({ operator: 'BT', values: ['2026-01-05', '2026-01-09'] });
    // FE (en-US, week from Sunday): Last 2 weeks on 2026-11-18 → 2026-11-01 … 2026-11-14 (the FE comparison)
    expect(r({ operator: 'LASTWEEKS', values: [2] })).toEqual({ operator: 'BT', values: ['2026-11-01', '2026-11-14'] });
    expect(r({ operator: 'LASTWEEKSINCLUDED', values: [2] })).toEqual({ operator: 'BT', values: ['2026-11-08', '2026-11-21'] });
    expect(r({ operator: 'NEXTMONTHS', values: [2] })).toEqual({ operator: 'BT', values: ['2026-12-01', '2027-01-31'] });
    expect(r({ operator: 'LASTQUARTERS', values: [1] })).toEqual({ operator: 'BT', values: ['2026-07-01', '2026-09-30'] });
    expect(r({ operator: 'NEXTYEARSINCLUDED', values: [2] })).toEqual({ operator: 'BT', values: ['2026-01-01', '2027-12-31'] });
    expect(r({ operator: 'LASTDAYSINCLUDED', values: [3] })).toEqual({ operator: 'BT', values: ['2026-11-16', '2026-11-18'] });
    expect(r({ operator: 'TODAYFROMTO', values: [1, 2] })).toEqual({ operator: 'BT', values: ['2026-11-17', '2026-11-20'] });
    expect(r({ operator: 'SPECIFICMONTH', values: [1] })).toEqual({ operator: 'BT', values: ['2026-02-01', '2026-02-28'] });
    expect(r({ operator: 'QUARTER2', values: [] })).toEqual({ operator: 'BT', values: ['2026-04-01', '2026-06-30'] });
    expect(r({ operator: 'DATETOYEAR', values: [] })).toEqual({ operator: 'BT', values: ['2026-11-18', '2026-12-31'] });
    expect(r({ operator: 'FIRSTDAYWEEK', values: [] })).toEqual({ operator: 'BT', values: ['2026-11-15', '2026-11-15'] });
    expect(r({ operator: 'FROMFIRSTDAYMONTH', values: [] })).toEqual({ operator: 'GE', values: ['2026-11-01'] });
    expect(r({ operator: 'TOLASTDAYYEAR', values: [] })).toEqual({ operator: 'LE', values: ['2026-12-31'] });
    expect(relativeDateRange('LASTWEEKS', 0, today)).toBeUndefined();
    // BT as the SAPUI5 V4 model writes it
    expect(toFilter({ Day: [{ operator: 'LASTWEEKS', values: [2] }] }, () => 'Edm.Date', { today, weekStartsOn: 0 })).toBe('Day ge 2026-11-01 and Day le 2026-11-14');
  });

  it('AL-10 P2 qualified Common.ValueList#Q limited by Common.ValueListRelevantQualifiers, default first', () => {
    const prop = model.entityTypes['M.Order']!.properties.Customer!;
    expect(prop.valueLists?.map((v) => v.qualifier)).toEqual(['', 'ByCity']);
    expect(prop.valueList?.label).toBe('By name');
    const all = buildModel(xml('', '')).entityTypes['M.Order']!.properties.Customer!;
    expect(all.valueLists?.map((v) => v.qualifier)).toEqual(['', 'ByCity', 'Unused']);
  });

  it('AL-10 P2 value list description: the Common.Text of the value list key, not the first DisplayOnly parameter', () => {
    expect(model.entityTypes['M.Order']!.properties.Customer!.valueList!.descriptionProperty).toBe('Name');
  });

  it('AL-10 P2 value help dialog request: SelectionFields and parameters selected, the value list PV sorts (DV-filter3-032, DV-FE-02)', () => {
    const vl = model.entityTypes['M.Order']!.properties.Customer!.valueList!;
    const dialog = buildValueHelpRequest(model, vl, { purpose: 'dialog', top: 64 });
    expect([...dialog.select].sort()).toEqual(['City', 'Country', 'Customer', 'Internal']);
    expect(dialog.orderBy).toEqual([{ path: 'City', descending: true }]);
    expect(dialog.top).toBe(64);
    expect(dialog.filters).toEqual({ Country: [{ operator: 'EQ', values: ['DE'] }] });
    // type-ahead: the parameters only, sorted by the PV as well
    const suggest = buildValueHelpRequest(model, vl, { search: 'a', top: 10 });
    expect(suggest.select).toEqual(['Customer', 'City', 'Internal']);
    expect(suggest.orderBy).toEqual([{ path: 'City', descending: true }]);
  });

  it('AL-10 P2 description of a written-back value: $select of the description, $top=2 (DV-filter3-044)', () => {
    const vl = model.entityTypes['M.Order']!.properties.Customer!.valueList!;
    const req = buildValueHelpRequest(model, vl, { purpose: 'description', keys: ['C1'] });
    expect(decodeURIComponent(toQueryString(model, req))).toBe("$select=Name&$filter=Customer eq 'C1'&$top=2");
    const code = buildValueHelpRequest(model, vl, { purpose: 'description', withDescription: false, keys: ['C1'] });
    expect(decodeURIComponent(toQueryString(model, code))).toBe("$filter=Customer eq 'C1'&$top=2");
  });
});
