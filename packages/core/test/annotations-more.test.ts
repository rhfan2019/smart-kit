import { describe, expect, it } from 'vitest';
import { buildListRequest, buildModel } from '../src';

const doc = (types: string, container: string, annotations: string) => `<?xml version="1.0"?>
<edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx">
  <edmx:Reference Uri="u"><edmx:Include Namespace="com.sap.vocabularies.UI.v1" Alias="UI"/></edmx:Reference>
  <edmx:Reference Uri="c"><edmx:Include Namespace="com.sap.vocabularies.Common.v1" Alias="Common"/></edmx:Reference>
  <edmx:Reference Uri="k"><edmx:Include Namespace="Org.OData.Capabilities.V1" Alias="Capabilities"/></edmx:Reference>
  <edmx:DataServices><Schema xmlns="http://docs.oasis-open.org/odata/ns/edm" Namespace="T">${types}<EntityContainer Name="C">${container}</EntityContainer>${annotations}</Schema></edmx:DataServices>
</edmx:Edmx>`;

const types = `<EntityType Name="Order"><Key><PropertyRef Name="ID"/></Key>
  <Property Name="ID" Type="Edm.Int32" Nullable="false"/><Property Name="CustomerID" Type="Edm.String"/><Property Name="Secret" Type="Edm.String"/>
  <NavigationProperty Name="Customer" Type="T.Customer"><ReferentialConstraint Property="CustomerID" ReferencedProperty="ID"/></NavigationProperty>
</EntityType>
<EntityType Name="Customer"><Key><PropertyRef Name="ID"/></Key><Property Name="ID" Type="Edm.String" Nullable="false"/><Property Name="Name" Type="Edm.String"/></EntityType>`;
const container = `<EntitySet Name="Orders" EntityType="T.Order"><NavigationPropertyBinding Path="Customer" Target="Customers"/></EntitySet><EntitySet Name="Customers" EntityType="T.Customer"/>`;

describe('more annotation terms', () => {
  it('ANN-21 Common.Text through a navigation is selected via $expand', () => {
    const m = buildModel(doc(types, container, `<Annotations Target="T.Order/CustomerID"><Annotation Term="Common.Text" Path="Customer/Name"/></Annotations>`));
    const ui = m.ui['T.Order']!;
    expect(m.entityTypes['T.Order']!.properties.CustomerID!.text).toBe('Customer/Name');
    const req = buildListRequest(m, ui, { source: { entitySet: 'Orders' }, columns: ui.lineItem.filter((c) => c.path === 'CustomerID') });
    expect(req.expand).toEqual([{ navigation: 'Customer', select: ['Name', 'ID'], expand: [] }]); // with the target's key (DV-FE-01)
  });

  it('ANN-23 Common.FieldControl Hidden hides the field; other values are kept for the edit seam', () => {
    const m = buildModel(doc(types, container, `<Annotations Target="T.Order/Secret"><Annotation Term="Common.FieldControl" EnumMember="Common.FieldControlType/Hidden"/></Annotations>
      <Annotations Target="T.Order/CustomerID"><Annotation Term="Common.FieldControl" EnumMember="Common.FieldControlType/Mandatory"/></Annotations>`));
    const t = m.entityTypes['T.Order']!;
    expect(t.properties.Secret!.hidden).toBe(true);
    expect(m.ui['T.Order']!.lineItem.map((c) => c.path)).not.toContain('Secret');
    expect(t.properties.CustomerID!.fieldControl).toEqual({ value: 'Mandatory' });
  });

  it('ANN-26 draft-enabled services are recognized (phase 2: draft strategy, ADR-018)', () => {
    const m = buildModel(doc(types, container, `<Annotations Target="T.C/Orders"><Annotation Term="Common.DraftRoot"><Record><PropertyValue Property="ActivationAction" String="T.activate"/></Record></Annotation></Annotations>`));
    expect(m.draftEnabled).toBe(true);
    expect(m.entitySets.Orders!.draft).toMatchObject({ root: true, activationAction: 'T.activate' });
    expect(m.warnings.map((w) => w.code)).toContain('DRAFT');
  });

  it('ANN-44 ExpandRestrictions: non-expandable navigations are not expanded', () => {
    const m = buildModel(doc(types, container, `<Annotations Target="T.Order/CustomerID"><Annotation Term="Common.Text" Path="Customer/Name"/></Annotations>
      <Annotations Target="T.C/Orders"><Annotation Term="Capabilities.ExpandRestrictions"><Record><PropertyValue Property="NonExpandableProperties"><Collection><NavigationPropertyPath>Customer</NavigationPropertyPath></Collection></PropertyValue></Record></Annotation></Annotations>`));
    expect(m.entitySets.Orders!.capabilities.nonExpandable).toEqual(['Customer']);
    const ui = m.ui['T.Order']!;
    const req = buildListRequest(m, ui, { source: { entitySet: 'Orders' }, columns: ui.lineItem });
    expect(req.expand).toEqual([]);
  });
});
