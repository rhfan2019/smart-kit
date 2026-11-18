/**
 * Stage 4 (docs/31), docs/29 §5 "表格列" and "动作": the columns and actions of a UI.LineItem as Fiori elements 1.154
 * builds them (sap.fe.core.converters.controls.Common.table.Columns, Table, table.StandardActions, Action;
 * sap.fe.core.helpers.StableIdHelper; FE comparison tests/e2e-fe/cols.spec.ts).
 */
import { describe, expect, it } from 'vitest';
import { buildModel, fieldPaths } from '../src/index';

const doc = (lineItem: string, more = '', set = '') => `<?xml version="1.0"?>
<edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx">
  <edmx:Reference Uri="u"><edmx:Include Namespace="com.sap.vocabularies.UI.v1" Alias="UI"/></edmx:Reference>
  <edmx:Reference Uri="c"><edmx:Include Namespace="com.sap.vocabularies.Common.v1" Alias="Common"/></edmx:Reference>
  <edmx:Reference Uri="k"><edmx:Include Namespace="Org.OData.Capabilities.V1" Alias="Capabilities"/></edmx:Reference>
  <edmx:Reference Uri="h"><edmx:Include Namespace="com.sap.vocabularies.HTML5.v1" Alias="HTML5"/></edmx:Reference>
  <edmx:Reference Uri="m"><edmx:Include Namespace="com.sap.vocabularies.Communication.v1" Alias="Communication"/></edmx:Reference>
  <edmx:DataServices><Schema xmlns="http://docs.oasis-open.org/odata/ns/edm" Namespace="T">
    <EntityType Name="Quote"><Key><PropertyRef Name="ID"/></Key>
      <Property Name="ID" Type="Edm.String" Nullable="false"/>
      <Property Name="Title" Type="Edm.String"/>
      <Property Name="From" Type="Edm.Date"/>
      <Property Name="To" Type="Edm.Date"/>
      <Property Name="State" Type="Edm.Byte"/>
      <Property Name="Name" Type="Edm.String"/>
      <Property Name="Mail" Type="Edm.String"/>
      <Property Name="Phone" Type="Edm.String"/>
      <Property Name="CanDelete" Type="Edm.Boolean"/>
      <Property Name="Partner" Type="Edm.String"/>
      <NavigationProperty Name="_Partner" Type="T.Partner"/>
    </EntityType>
    <EntityType Name="Partner"><Key><PropertyRef Name="Partner"/></Key>
      <Property Name="Partner" Type="Edm.String" Nullable="false"/>
      <Property Name="Score" Type="Edm.Decimal" Scale="1"/>
    </EntityType>
    <Action Name="accept" IsBound="true"><Parameter Name="_it" Type="T.Quote"/><ReturnType Type="T.Quote"/></Action>
    <Action Name="reject" IsBound="true"><Parameter Name="_it" Type="T.Quote"/><ReturnType Type="T.Quote"/></Action>
    <Action Name="copy" IsBound="true"><Parameter Name="_it" Type="T.Quote"/><ReturnType Type="T.Quote"/></Action>
    <EntityContainer Name="C">
      <EntitySet Name="Quotes" EntityType="T.Quote"><NavigationPropertyBinding Path="_Partner" Target="Partners"/></EntitySet>
      <EntitySet Name="Partners" EntityType="T.Partner"/>
    </EntityContainer>
    <Annotations Target="T.C/Quotes">${set}</Annotations>
    <Annotations Target="T.Quote">
      <Annotation Term="UI.LineItem">
        <Collection>${lineItem}</Collection>
        <Annotation Term="UI.Criticality" Path="State"/>
      </Annotation>
      <Annotation Term="UI.FieldGroup" Qualifier="Validity"><Record><PropertyValue Property="Label" String="Validity"/><PropertyValue Property="Data"><Collection>
        <Record Type="UI.DataField"><PropertyValue Property="Value" Path="From"/></Record>
        <Record Type="UI.DataField"><PropertyValue Property="Value" Path="To"/></Record>
      </Collection></PropertyValue></Record></Annotation>
      <Annotation Term="UI.ConnectedFields" Qualifier="Range"><Record>
        <PropertyValue Property="Label" String="Range"/>
        <PropertyValue Property="Template" String="{F} – {T}"/>
        <PropertyValue Property="Data"><Record>
          <PropertyValue Property="F"><Record Type="UI.DataField"><PropertyValue Property="Value" Path="From"/></Record></PropertyValue>
          <PropertyValue Property="T"><Record Type="UI.DataField"><PropertyValue Property="Value" Path="To"/></Record></PropertyValue>
        </Record></PropertyValue>
      </Record></Annotation>
      <Annotation Term="Communication.Contact"><Record>
        <PropertyValue Property="fn" Path="Name"/>
        <PropertyValue Property="email"><Collection><Record><PropertyValue Property="address" Path="Mail"/></Record></Collection></PropertyValue>
        <PropertyValue Property="tel"><Collection><Record><PropertyValue Property="uri" Path="Phone"/></Record></Collection></PropertyValue>
      </Record></Annotation>
      ${more}
    </Annotations>
    <Annotations Target="T.Partner">
      <Annotation Term="UI.DataPoint" Qualifier="Score"><Record><PropertyValue Property="Value" Path="Score"/><PropertyValue Property="Title" String="Score title"/><PropertyValue Property="Visualization" EnumMember="UI.VisualizationType/Rating"/></Record></Annotation>
    </Annotations>
    <Annotations Target="T.Partner/Score"><Annotation Term="Common.Label" String="Partner Score"/></Annotations>
    <Annotations Target="T.accept(T.Quote)"><Annotation Term="Common.IsActionCritical" Bool="true"/></Annotations>
  </Schema></edmx:DataServices>
</edmx:Edmx>`;

const DF = (path: string, extra = '') => `<Record Type="UI.DataField"><PropertyValue Property="Value" Path="${path}"/>${extra}</Record>`;
const ACTION = (name: string, extra = '') => `<Record Type="UI.DataFieldForAction"><PropertyValue Property="Label" String="${name}!"/><PropertyValue Property="Action" String="T.${name}"/>${extra}</Record>`;
const ui = (lineItem: string, more = '', set = '') => {
  const model = buildModel(doc(lineItem, more, set));
  return { model, ui: model.ui['T.Quote']!, caps: model.entitySets.Quotes!.capabilities };
};

describe('AL-10 AL-12 columns of the UI.LineItem (docs/29 §5 表格列)', () => {
  it('AL-12 DataFieldForAnnotation to a FieldGroup: one column with the group fields, labelled by the record, else the group', () => {
    const { ui: u } = ui(`<Record Type="UI.DataFieldForAnnotation"><PropertyValue Property="Target" AnnotationPath="@UI.FieldGroup#Validity"/></Record>`);
    const col = u.lineItem[0]!;
    expect(col).toMatchObject({ kind: 'fieldGroup', label: 'Validity', id: 'DataFieldForAnnotation::FieldGroup::Validity' });
    expect(col.fields!.map((f) => f.path)).toEqual(['From', 'To']);
  });

  it('AL-12 DataFieldForAnnotation to ConnectedFields: the template and the key of each field', () => {
    const { ui: u, model } = ui(`<Record Type="UI.DataFieldForAnnotation"><PropertyValue Property="Label" String="Valid"/><PropertyValue Property="Target" AnnotationPath="@UI.ConnectedFields#Range"/></Record>`);
    const col = u.lineItem[0]!;
    expect(col).toMatchObject({ kind: 'connectedFields', label: 'Valid', template: { text: '{F} – {T}', keys: ['F', 'T'] } });
    expect(col.fields!.map((f) => f.path)).toEqual(['From', 'To']);
    expect(fieldPaths(model, 'T.Quote', col)).toEqual(['From', 'To']);
  });

  it('AL-12 DataFieldForAnnotation to Communication.Contact: the name and the details; no label → the FE column key; the list reads only the name (the popover the details)', () => {
    const { ui: u, model } = ui(`<Record Type="UI.DataFieldForAnnotation"><PropertyValue Property="Target" AnnotationPath="@Communication.Contact"/></Record>`);
    const col = u.lineItem[0]!;
    expect(col).toMatchObject({ kind: 'contact', label: 'DataFieldForAnnotation::Contact', contact: { fn: { path: 'Name' }, email: { path: 'Mail' }, tel: { path: 'Phone' } } });
    expect(fieldPaths(model, 'T.Quote', col).sort()).toEqual(['Name']);
  });

  it('AL-12 a data point column is labelled by Common.Label of its value (FE Columns getLabel), not by the record or the title', () => {
    const { ui: u } = ui(`<Record Type="UI.DataFieldForAnnotation"><PropertyValue Property="Label" String="Partner Rating"/><PropertyValue Property="Target" AnnotationPath="_Partner/@UI.DataPoint#Score"/></Record>`);
    expect(u.lineItem[0]!.label).toBe('Partner Score');
  });

  it('AL-12 DataFieldWithIntentBasedNavigation and DataFieldWithAction are columns of their value; DataFieldWithActionGroup is none', () => {
    const { ui: u } = ui(`
      <Record Type="UI.DataFieldWithIntentBasedNavigation"><PropertyValue Property="Value" Path="Title"/><PropertyValue Property="SemanticObject" String="Quote"/><PropertyValue Property="Action" String="display"/></Record>
      <Record Type="UI.DataFieldWithAction"><PropertyValue Property="Value" Path="Name"/><PropertyValue Property="Action" String="T.accept"/></Record>
      <Record Type="UI.DataFieldWithActionGroup"><PropertyValue Property="Value" Path="Mail"/><PropertyValue Property="Actions"><Collection>${ACTION('reject')}</Collection></PropertyValue></Record>
      <Record Type="UI.DataFieldWithNavigationPath"><PropertyValue Property="Value" Path="Partner"/><PropertyValue Property="Target" NavigationPropertyPath="_Partner"/></Record>`);
    expect(u.lineItem.map((c) => [c.id, c.kind, c.path])).toEqual([
      ['DataFieldWithIntentBasedNavigation::Title::Quote::display', 'field', 'Title'],
      ['DataFieldWithAction::Name::accept', 'field', 'Name'],
      ['DataFieldWithNavigationPath::Partner', 'field', 'Partner'],
    ]);
    expect(u.lineItem[0]!.intent).toEqual({ semanticObject: 'Quote', action: 'display' });
    expect(u.lineItem[1]!.action).toMatchObject({ action: 'T.accept', bound: true, critical: { value: true } });
    expect(u.lineItem[2]!.navigationPath).toBe('_Partner');
  });

  it('AL-12 TextSeparate: the column shows the value only, its text is not requested (FE displayMode Value)', () => {
    const text = (arrangement: string) => buildModel(doc(DF('Partner')).replace('</Schema>', `<Annotations Target="T.Quote/Partner"><Annotation Term="Common.Text" Path="Name"><Annotation Term="UI.TextArrangement" EnumMember="UI.TextArrangementType/${arrangement}"/></Annotation></Annotations></Schema>`));
    const separate = text('TextSeparate');
    expect(fieldPaths(separate, 'T.Quote', separate.ui['T.Quote']!.lineItem[0]!)).toEqual(['Partner']);
    const first = text('TextFirst');
    expect(fieldPaths(first, 'T.Quote', first.ui['T.Quote']!.lineItem[0]!)).toEqual(['Partner', 'Name']);
  });

  it('AL-12 HTML5.CssDefaults/width is the column width', () => {
    const { ui: u } = ui(DF('Title', '<Annotation Term="HTML5.CssDefaults"><Record><PropertyValue Property="width" String="20rem"/></Record></Annotation>'));
    expect(u.lineItem[0]!.width).toBe('20rem');
  });

  it('AL-12 UI.Criticality on the LineItem is the row highlight; UI.Criticality on a property is not read (D41)', () => {
    const { ui: u, model } = ui(DF('Title'), '', '');
    expect(u.rowHighlight).toEqual({ '': { path: 'State' } });
    const withProperty = buildModel(doc(DF('Title')).replace('</Schema>', '<Annotations Target="T.Quote/Title"><Annotation Term="UI.Criticality" Path="State"/></Annotations></Schema>'));
    expect(withProperty.ui['T.Quote']!.lineItem[0]!.criticality).toBeUndefined();
    expect(fieldPaths(withProperty, 'T.Quote', withProperty.ui['T.Quote']!.lineItem[0]!)).toEqual(['Title']);
    expect(model.entityTypes['T.Quote']!.properties.Title).not.toHaveProperty('criticality');
  });

  it('AL-12 an inline DataFieldForAction is a column of its own at its position (FE Columns _isValidColumn)', () => {
    const { ui: u } = ui(`${DF('ID')}${ACTION('accept', '<PropertyValue Property="Inline" Bool="true"/>')}${DF('Title')}`);
    expect(u.lineItem.map((c) => [c.id, c.kind])).toEqual([['DataField::ID', 'field'], ['DataFieldForAction::T.accept', 'action'], ['DataField::Title', 'field']]);
    expect(u.lineItem[1]!.action).toMatchObject({ inline: true, label: 'accept!' });
  });

  it('AL-12 a micro chart column without Label is labelled by its FE key', () => {
    const { ui: u } = ui(`<Record Type="UI.DataFieldForAnnotation"><PropertyValue Property="Target" AnnotationPath="@UI.Chart#Bullet"/></Record>`, `
      <Annotation Term="UI.Chart" Qualifier="Bullet"><Record><PropertyValue Property="Title" String="Bullet title"/><PropertyValue Property="ChartType" EnumMember="UI.ChartType/Bullet"/>
        <PropertyValue Property="Measures"><Collection><PropertyPath>State</PropertyPath></Collection></PropertyValue></Record></Annotation>`);
    expect(u.lineItem[0]!.label).toBe('DataFieldForAnnotation::Chart::Bullet');
  });
});

describe('AL-10 AL-12 actions of the UI.LineItem (docs/29 §5 动作)', () => {
  it('AL-12 DataFieldForActionGroup: a menu with its sub-actions', () => {
    const { ui: u } = ui(`<Record Type="UI.DataFieldForActionGroup"><PropertyValue Property="ID" String="Respond"/><PropertyValue Property="Label" String="Respond"/>
      <PropertyValue Property="Actions"><Collection>${ACTION('accept')}${ACTION('reject')}</Collection></PropertyValue></Record>`);
    expect(u.actionGroups).toEqual([{ id: 'DataFieldForActionGroup::Respond', label: 'Respond', actions: ['DataFieldForAction::T.accept', 'DataFieldForAction::T.reject'] }]);
    expect(u.actions.map((a) => [a.id, a.menu])).toEqual([['DataFieldForAction::T.accept', 'DataFieldForActionGroup::Respond'], ['DataFieldForAction::T.reject', 'DataFieldForActionGroup::Respond']]);
  });

  it('AL-12 Common.IsActionCritical and UI.IsCopyAction are read', () => {
    const { ui: u } = ui(`${ACTION('accept')}${ACTION('copy', '<Annotation Term="UI.IsCopyAction" Bool="true"/>')}`);
    expect(u.actions.map((a) => [a.name, a.critical, a.copy])).toEqual([['accept', { value: true }, undefined], ['copy', undefined, true]]);
  });

  it('AL-12 path-valued Insertable / Deletable and UI.CreateHidden / UI.DeleteHidden of the entity set', () => {
    const { caps } = ui(DF('ID'), '', `
      <Annotation Term="Capabilities.InsertRestrictions"><Record><PropertyValue Property="Insertable" Path="CanDelete"/></Record></Annotation>
      <Annotation Term="Capabilities.DeleteRestrictions"><Record><PropertyValue Property="Deletable" Path="CanDelete"/></Record></Annotation>
      <Annotation Term="UI.CreateHidden" Bool="true"/>
      <Annotation Term="UI.DeleteHidden" Path="CanDelete"/>`);
    expect(caps).toMatchObject({ insertable: true, insertablePath: 'CanDelete', deletable: true, deletablePath: 'CanDelete', createHidden: { value: true }, deleteHidden: { path: 'CanDelete' } });
  });

  it('AL-12 UI.CreateHidden on the entity type applies when the entity set has none', () => {
    const { caps } = ui(DF('ID'), '<Annotation Term="UI.CreateHidden" Bool="true"/>');
    expect(caps.createHidden).toEqual({ value: true });
    expect(caps.deleteHidden).toBeUndefined();
  });
});
