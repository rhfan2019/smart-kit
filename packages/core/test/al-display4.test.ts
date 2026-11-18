/** Value display of the list report (docs/29 §5, stage 4): model and requests as Fiori elements 1.154. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildListRequest, buildModel, formatDateTimeWithTimezone, formatTimezone, MemoryProvider } from '../src';

const model = buildModel(readFileSync(join(import.meta.dirname, 'fixtures/display4.xml'), 'utf8'));
const type = model.entityTypes['D.Contact']!;
const ui = model.ui['D.Contact']!;
const col = (id: string) => ui.lineItem.find((c) => c.id === id)!;

describe('AL-10 AL-12 display4: property annotations', () => {
  it('AL-12 display4 Communication.IsEmailAddress / IsPhoneNumber, Common.Masked, ExternalID, Timezone, IsTimezone, SemanticObject, stream file name', () => {
    expect(type.properties.Email!.isEmailAddress).toBe(true);
    expect(type.properties.Phone!.isPhoneNumber).toBe(true);
    expect(type.properties.Iban!.masked).toBe(true);
    expect(type.properties.UUID!.externalId).toBe('ID');
    expect(type.properties.At!.timezone).toEqual({ path: 'Zone' });
    expect(type.properties.Zone!.isTimezone).toBe(true);
    expect(type.properties.Ref!.semanticObject).toBe('Supplier');
    expect(type.properties.Doc!.filename).toEqual({ path: 'DocName' });
  });
  it('AL-12 display4 D41: Core.IsURL is not read', () => {
    expect('isUrl' in type.properties.Site!).toBe(false);
  });
  it('AL-12 display4 D41: VeryPositive / VeryNegative keep their values (4, -1) and get no colour', () => {
    expect(col('DataField::Name').criticality).toEqual({ value: 4 });
  });
  it('AL-12 display4 DataFieldWithUrl: HTML5.LinkTarget of the record; none means the same window', () => {
    expect(col('Blank').linkTarget).toBe('_blank');
    expect(col('DataField::Site').linkTarget).toBeUndefined();
  });
  it('AL-12 display4 DataPoint ValueFormat/NumberOfFractionalDigits', () => {
    expect(ui.dataPoints.Score!.fractionDigits).toBe(1);
  });
});

describe('AL-10 display4: requests', () => {
  const req = buildListRequest(model, ui, { source: { entitySet: 'Contacts' }, columns: ui.lineItem });
  it('AL-10 display4 DV-FE-01: a text navigation is expanded with the key of its target (autoExpandSelect)', () => {
    expect(req.expand).toEqual([{ navigation: '_Status', select: ['Name', 'Code'], expand: [] }]);
  });
  it('AL-10 display4 DV-FE-02: the ETag property (Core.OptimisticConcurrency) is not selected by the list request', () => {
    expect(req.select).not.toContain('Version');
  });
  it('AL-10 display4 the ExternalID, the time zone and the stream file name are selected; a contact column only its name', () => {
    expect(req.select).toEqual(expect.arrayContaining(['UUID', 'ID', 'At', 'Zone', 'DocName', 'Name']));
    expect(req.select).not.toContain('Title');
  });
  it('AL-10 display4 the memory provider returns @odata.etag whatever is selected (as an OData V4 service)', async () => {
    const p = new MemoryProvider({ model, data: { Contacts: [{ UUID: 'u1', ID: 'C1', Version: 1, '@odata.etag': 'W/"1"' }] } });
    const r = await p.query({ source: { entitySet: 'Contacts' }, select: ['ID'], expand: [], orderBy: [], count: false });
    expect(r.rows[0]).toEqual({ UUID: 'u1', ID: 'C1', '@odata.etag': 'W/"1"' });
  });
});

describe('AL-12 display4: time zones (sap.fe.core.type.DateTimeWithTimezone)', () => {
  it('AL-12 display4 time zone names as UI5 shows them in English', () => {
    expect(formatTimezone('Europe/Berlin')).toBe('Europe, Berlin');
    expect(formatTimezone('America/New_York')).toBe('Americas, New York');
  });
  it('AL-12 display4 date and time in the given zone with seconds, then the zone', () => {
    expect(formatDateTimeWithTimezone('2026-10-18T14:30:00Z', 'en-US', 'Europe/Berlin').replace(/\u202f/g, ' ')).toBe('Oct 18, 2026, 4:30:00 PM Europe, Berlin');
    expect(formatDateTimeWithTimezone(null, 'en-US', 'Europe/Berlin')).toBe('');
  });
});

describe('AL-12 display4: quick view rule (FE FieldTemplating isUsedInNavigationWithQuickViewFacets)', () => {
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx">
  <edmx:Reference Uri="https://sap.github.io/odata-vocabularies/vocabularies/UI.xml"><edmx:Include Namespace="com.sap.vocabularies.UI.v1" Alias="UI"/></edmx:Reference>
  <edmx:Reference Uri="https://sap.github.io/odata-vocabularies/vocabularies/Common.xml"><edmx:Include Namespace="com.sap.vocabularies.Common.v1" Alias="Common"/></edmx:Reference>
  <edmx:DataServices><Schema xmlns="http://docs.oasis-open.org/odata/ns/edm" Namespace="Q">
    <EntityType Name="Order"><Key><PropertyRef Name="ID"/></Key><Property Name="ID" Type="Edm.String"/><Property Name="PartnerID" Type="Edm.String"/><Property Name="StatusID" Type="Edm.String"/>
      <NavigationProperty Name="_Partner" Type="Q.Partner"><ReferentialConstraint Property="PartnerID" ReferencedProperty="ID"/></NavigationProperty>
      <NavigationProperty Name="_Status" Type="Q.Status"><ReferentialConstraint Property="StatusID" ReferencedProperty="ID"/></NavigationProperty></EntityType>
    <EntityType Name="Partner"><Key><PropertyRef Name="ID"/></Key><Property Name="ID" Type="Edm.String"/><Property Name="Number" Type="Edm.String"/><Property Name="Name" Type="Edm.String"/></EntityType>
    <EntityType Name="Status"><Key><PropertyRef Name="ID"/></Key><Property Name="ID" Type="Edm.String"/><Property Name="Name" Type="Edm.String"/></EntityType>
    <EntityContainer Name="C"><EntitySet Name="Orders" EntityType="Q.Order"><NavigationPropertyBinding Path="_Partner" Target="Partners"/></EntitySet><EntitySet Name="Partners" EntityType="Q.Partner"/><EntitySet Name="Statuses" EntityType="Q.Status"/></EntityContainer>
    <Annotations Target="Q.Order"><Annotation Term="UI.LineItem"><Collection>
      <Record Type="UI.DataField"><PropertyValue Property="Value" Path="PartnerID"/></Record>
      <Record Type="UI.DataField"><PropertyValue Property="Value" Path="_Partner/ID"/></Record>
      <Record Type="UI.DataField"><PropertyValue Property="Value" Path="_Partner/Number"/></Record>
      <Record Type="UI.DataField"><PropertyValue Property="Value" Path="_Partner/Name"/></Record>
      <Record Type="UI.DataField"><PropertyValue Property="Value" Path="StatusID"/></Record>
    </Collection></Annotation></Annotations>
    <Annotations Target="Q.Order/StatusID"><Annotation Term="Common.Text" Path="_Partner/Name"/></Annotations>
    <Annotations Target="Q.Partner">
      <Annotation Term="Common.SemanticKey"><Collection><PropertyPath>Number</PropertyPath></Collection></Annotation>
      <Annotation Term="UI.QuickViewFacets"><Collection><Record Type="UI.ReferenceFacet"><PropertyValue Property="Target" AnnotationPath="@UI.FieldGroup#Q"/></Record></Collection></Annotation>
      <Annotation Term="UI.FieldGroup" Qualifier="Q"><Record><PropertyValue Property="Data"><Collection><Record Type="UI.DataField"><PropertyValue Property="Value" Path="Name"/></Record></Collection></PropertyValue></Record></Annotation>
    </Annotations>
  </Schema></edmx:DataServices>
</edmx:Edmx>`;
  const m = buildModel(xml);
  const qv = (path: string) => m.ui['Q.Order']!.lineItem.find((c) => c.path === path)!.quickView;
  it('AL-12 display4 the foreign key of a navigation to a type with QuickViewFacets', () => {
    expect(qv('PartnerID')).toEqual({ navigation: '_Partner', typeName: 'Q.Partner' });
  });
  it('AL-12 display4 the target key or semantic key through the navigation; other target properties not', () => {
    expect(qv('_Partner/ID')).toEqual({ navigation: '_Partner', typeName: 'Q.Partner' });
    expect(qv('_Partner/Number')).toEqual({ navigation: '_Partner', typeName: 'Q.Partner' });
    expect(qv('_Partner/Name')).toBeUndefined();
  });
  it('AL-12 display4 a text through a navigation alone gives no quick view (FE has no such rule)', () => {
    expect(qv('StatusID')).toBeUndefined();
  });
});
