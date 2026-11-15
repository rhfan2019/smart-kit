import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildModel, csdlJsonToXml, ModelError } from '../src';

const shopXml = readFileSync(join(import.meta.dirname, 'fixtures/shop.xml'), 'utf8');

const annotationFile = (body: string, alias = 'UI') => `<?xml version="1.0"?>
<edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx">
  <edmx:Reference Uri="https://sap.github.io/odata-vocabularies/vocabularies/UI.xml"><edmx:Include Namespace="com.sap.vocabularies.UI.v1" Alias="${alias}"/></edmx:Reference>
  <edmx:Reference Uri="https://sap.github.io/odata-vocabularies/vocabularies/Common.xml"><edmx:Include Namespace="com.sap.vocabularies.Common.v1" Alias="Common"/></edmx:Reference>
  <edmx:DataServices><Schema xmlns="http://docs.oasis-open.org/odata/ns/edm" Namespace="local">${body}</Schema></edmx:DataServices>
</edmx:Edmx>`;

describe('annotation layering (AC-MOD-02)', () => {
  it('ANN-71 annotation files and overlay replace whole terms in order', () => {
    const file1 = annotationFile(`<Annotations Target="Shop.Product">
      <Annotation Term="UI.SelectionFields"><Collection><PropertyPath>Name</PropertyPath></Collection></Annotation>
      <Annotation Term="UI.HeaderInfo"><Record><PropertyValue Property="TypeName" String="Item"/><PropertyValue Property="TypeNamePlural" String="Items"/></Record></Annotation>
    </Annotations>`);
    const overlay = annotationFile(`<Annotations Target="Shop.Product">
      <Annotation Term="UI.SelectionFields"><Collection><PropertyPath>Price</PropertyPath><PropertyPath>Status</PropertyPath></Collection></Annotation>
    </Annotations>
    <Annotations Target="Shop.Product/Name"><Annotation Term="Common.Label" String="Title"/></Annotations>`);
    const m = buildModel(shopXml, { annotationFiles: [file1], overlay });
    const ui = m.ui['Shop.Product']!;
    // overlay wins over file1, which wins over the service
    expect(ui.selectionFields).toEqual(['Price', 'Status']);
    // whole-term replacement: HeaderInfo from file1 has no Title, so the service Title is not merged in
    expect(ui.headerInfo.typeName).toBe('Item');
    expect(ui.headerInfo.description).toBeUndefined();
    expect(m.entityTypes['Shop.Product']!.properties.Name!.label).toBe('Title');
    // untouched terms stay
    expect(ui.lineItem.length).toBe(7);
  });

  it('ANN-72 files may use different aliases for the same vocabulary', () => {
    const overlay = annotationFile(`<Annotations Target="Shop.Product">
      <Annotation Term="MyUI.SelectionFields"><Collection><PropertyPath>Notes</PropertyPath></Collection></Annotation>
    </Annotations>`, 'MyUI');
    const m = buildModel(shopXml, { overlay });
    expect(m.ui['Shop.Product']!.selectionFields).toEqual(['Notes']);
  });

  it('overlay may be a CSDL JSON object', () => {
    const m = buildModel(shopXml, {
      overlay: {
        $Version: '4.0',
        $Reference: { 'https://sap.github.io/odata-vocabularies/vocabularies/UI.xml': { $Include: [{ $Namespace: 'com.sap.vocabularies.UI.v1', $Alias: 'UI' }] } },
        local: { $Annotations: { 'Shop.Product': { '@UI.SelectionFields': [{ $PropertyPath: 'Code' }] } } },
      },
    });
    expect(m.ui['Shop.Product']!.selectionFields).toEqual(['Code']);
  });

  it('rejects documents that are not CSDL', () => {
    expect(() => buildModel('hello')).toThrow(ModelError);
    expect(() => buildModel('{bad json')).toThrow(ModelError);
  });
});

const miniXml = `<?xml version="1.0"?>
<edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx">
  <edmx:Reference Uri="https://sap.github.io/odata-vocabularies/vocabularies/UI.xml"><edmx:Include Namespace="com.sap.vocabularies.UI.v1" Alias="UI"/></edmx:Reference>
  <edmx:Reference Uri="https://sap.github.io/odata-vocabularies/vocabularies/Common.xml"><edmx:Include Namespace="com.sap.vocabularies.Common.v1" Alias="Common"/></edmx:Reference>
  <edmx:DataServices><Schema xmlns="http://docs.oasis-open.org/odata/ns/edm" Namespace="Mini">
    <EntityType Name="Order"><Key><PropertyRef Name="ID"/></Key>
      <Property Name="ID" Type="Edm.Int32" Nullable="false"/>
      <Property Name="Amount" Type="Edm.Decimal" Precision="10" Scale="2"/>
      <Property Name="Customer" Type="Edm.String" MaxLength="10"/>
      <NavigationProperty Name="Lines" Type="Collection(Mini.Line)"/>
    </EntityType>
    <EntityType Name="Line"><Key><PropertyRef Name="OrderID"/><PropertyRef Name="No"/></Key>
      <Property Name="OrderID" Type="Edm.Int32" Nullable="false"/>
      <Property Name="No" Type="Edm.Int32" Nullable="false"/>
    </EntityType>
    <EntityContainer Name="C">
      <EntitySet Name="Orders" EntityType="Mini.Order"><NavigationPropertyBinding Path="Lines" Target="Lines"/></EntitySet>
      <EntitySet Name="Lines" EntityType="Mini.Line"/>
    </EntityContainer>
    <Annotations Target="Mini.Order">
      <Annotation Term="UI.LineItem"><Collection>
        <Record Type="UI.DataField"><PropertyValue Property="Value" Path="ID"/></Record>
        <Record Type="UI.DataField"><PropertyValue Property="Value" Path="Amount"/><PropertyValue Property="Label" String="Total"/></Record>
      </Collection></Annotation>
      <Annotation Term="UI.SelectionFields"><Collection><PropertyPath>Customer</PropertyPath></Collection></Annotation>
    </Annotations>
    <Annotations Target="Mini.Order/Customer"><Annotation Term="Common.Label" String="Customer No."/></Annotations>
  </Schema></edmx:DataServices>
</edmx:Edmx>`;

const miniJson = {
  $Version: '4.0',
  $Reference: {
    'https://sap.github.io/odata-vocabularies/vocabularies/UI.xml': { $Include: [{ $Namespace: 'com.sap.vocabularies.UI.v1', $Alias: 'UI' }] },
    'https://sap.github.io/odata-vocabularies/vocabularies/Common.xml': { $Include: [{ $Namespace: 'com.sap.vocabularies.Common.v1', $Alias: 'Common' }] },
  },
  $EntityContainer: 'Mini.C',
  Mini: {
    Order: {
      $Kind: 'EntityType',
      $Key: ['ID'],
      ID: { $Type: 'Edm.Int32' },
      Amount: { $Type: 'Edm.Decimal', $Nullable: true, $Precision: 10, $Scale: 2 },
      Customer: { $Nullable: true, $MaxLength: 10, '@Common.Label': 'Customer No.' },
      Lines: { $Kind: 'NavigationProperty', $Type: 'Mini.Line', $Collection: true },
      '@UI.LineItem': [
        { '@type': '#UI.DataField', Value: { $Path: 'ID' } },
        { '@type': '#UI.DataField', Value: { $Path: 'Amount' }, Label: 'Total' },
      ],
    },
    Line: { $Kind: 'EntityType', $Key: ['OrderID', 'No'], OrderID: { $Type: 'Edm.Int32' }, No: { $Type: 'Edm.Int32' } },
    C: {
      $Kind: 'EntityContainer',
      Orders: { $Collection: true, $Type: 'Mini.Order', $NavigationPropertyBinding: { Lines: 'Lines' } },
      Lines: { $Collection: true, $Type: 'Mini.Line' },
    },
    $Annotations: { 'Mini.Order': { '@UI.SelectionFields': [{ $PropertyPath: 'Customer' }] } },
  },
};

describe('CSDL JSON (AC-MOD-01)', () => {
  it('ANN-70 CSDL XML and CSDL JSON of the same service give the same model', () => {
    const fromXml = buildModel(miniXml);
    const fromJson = buildModel(miniJson);
    const strip = (m: ReturnType<typeof buildModel>) => ({ entitySets: m.entitySets, entityTypes: m.entityTypes, ui: m.ui });
    expect(strip(fromJson)).toEqual(strip(fromXml));
    expect(buildModel(JSON.stringify(miniJson)).ui['Mini.Order']!.lineItem.map((c) => c.label)).toEqual(['ID', 'Total']);
  });

  it('JSON defaults: properties are not nullable unless $Nullable is true', () => {
    const xml = csdlJsonToXml(miniJson);
    expect(xml).toContain('<Property Name="ID" Type="Edm.Int32" Nullable="false">');
    expect(xml).toContain('<Property Name="Customer" Type="Edm.String" Nullable="true" MaxLength="10">');
  });
});
