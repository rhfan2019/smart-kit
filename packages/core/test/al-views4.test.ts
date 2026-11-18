/**
 * Stage 4 (docs/31), docs/29 §5 "views, charts, aggregation": which LineItem / Chart the list shows, the views'
 * own presentation, the chart's sort, dynamic measures and the automatic table type inputs, as Fiori elements 1.154
 * does it (sap.fe.core.converters.templates.ListReportConverter, controls/Common/DataVisualization, Chart, Table,
 * helpers/Aggregation; sap.fe.macros.chart.ChartHelper, MdcChartTemplate). FE comparison: tests/e2e-fe/views4.spec.ts.
 */
import { describe, expect, it } from 'vitest';
import { buildChartRequest, buildListRequest, buildModel, toQueryString } from '../src/index';

const doc = (annotations: string, extra = '') => `<?xml version="1.0"?>
<edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx">
  <edmx:Reference Uri="a"><edmx:Include Namespace="Org.OData.Aggregation.V1" Alias="Aggregation"/></edmx:Reference>
  <edmx:Reference Uri="an"><edmx:Include Namespace="com.sap.vocabularies.Analytics.v1" Alias="Analytics"/></edmx:Reference>
  <edmx:Reference Uri="h"><edmx:Include Namespace="com.sap.vocabularies.Hierarchy.v1" Alias="Hierarchy"/></edmx:Reference>
  <edmx:Reference Uri="u"><edmx:Include Namespace="com.sap.vocabularies.UI.v1" Alias="UI"/></edmx:Reference>
  <edmx:Reference Uri="c"><edmx:Include Namespace="com.sap.vocabularies.Common.v1" Alias="Common"/></edmx:Reference>
  <edmx:DataServices><Schema xmlns="http://docs.oasis-open.org/odata/ns/edm" Namespace="T">
    <EntityType Name="Sale"><Key><PropertyRef Name="ID"/></Key>
      <Property Name="ID" Type="Edm.String" Nullable="false"/>
      <Property Name="Region" Type="Edm.String"/>
      <Property Name="Year" Type="Edm.String"/>
      <Property Name="Amount" Type="Edm.Decimal" Scale="2"/>
      <Property Name="Note" Type="Edm.String"/>
      <Property Name="Parent" Type="Edm.String"/>
      <NavigationProperty Name="_Parent" Type="T.Sale"/>
    </EntityType>
    <Action Name="recalc"><Parameter Name="Year" Type="Edm.String"/></Action>
    <Action Name="approve" IsBound="true"><Parameter Name="_it" Type="T.Sale"/></Action>
    <EntityContainer Name="C"><EntitySet Name="Sales" EntityType="T.Sale"/><ActionImport Name="recalc" Action="T.recalc"/></EntityContainer>
    <Annotations Target="T.Sale">
      <Annotation Term="Aggregation.ApplySupported"><Record>
        <PropertyValue Property="Transformations"><Collection><String>filter</String><String>groupby</String><String>aggregate</String></Collection></PropertyValue>
      </Record></Annotation>
      <Annotation Term="Aggregation.CustomAggregate" Qualifier="Amount" String="Edm.Decimal"/>
      <Annotation Term="UI.LineItem"><Collection><Record Type="UI.DataField"><PropertyValue Property="Value" Path="Region"/></Record></Collection></Annotation>
      <Annotation Term="UI.LineItem" Qualifier="Short"><Collection><Record Type="UI.DataField"><PropertyValue Property="Value" Path="Year"/></Record></Collection></Annotation>
      <Annotation Term="UI.Chart" Qualifier="ByRegion"><Record>
        <PropertyValue Property="Title" String="Amount by region"/>
        <PropertyValue Property="ChartType" EnumMember="UI.ChartType/Line"/>
        <PropertyValue Property="Dimensions"><Collection><PropertyPath>Region</PropertyPath></Collection></PropertyValue>
        <PropertyValue Property="Measures"><Collection><PropertyPath>Amount</PropertyPath></Collection></PropertyValue>
      </Record></Annotation>
      ${annotations}
    </Annotations>
    ${extra}
  </Schema></edmx:DataServices>
</edmx:Edmx>`;

const pv = (visualizations: string, more = '') => `<Annotation Term="UI.PresentationVariant"><Record>
  <PropertyValue Property="SortOrder"><Collection><Record><PropertyValue Property="Property" PropertyPath="Amount"/><PropertyValue Property="Descending" Bool="true"/></Record></Collection></PropertyValue>
  <PropertyValue Property="RequestAtLeast"><Collection><PropertyPath>Note</PropertyPath></Collection></PropertyValue>
  ${visualizations ? `<PropertyValue Property="Visualizations"><Collection>${visualizations}</Collection></PropertyValue>` : ''}${more}
</Record></Annotation>`;

const qs = (m: ReturnType<typeof buildModel>, req: Parameters<typeof toQueryString>[1]) => decodeURIComponent(toQueryString(m, req));

describe('AL-12 P2 LineItem selection rule (FE ListReportConverter getCompliantVisualizationAnnotation)', () => {
  it('AL-12 P2 a compliant PV (Visualizations with a LineItem) gives the sort, RequestAtLeast and the LineItem it names', () => {
    const m = buildModel(doc(pv('<AnnotationPath>@UI.LineItem#Short</AnnotationPath>')));
    const ui = m.ui['T.Sale']!;
    expect(ui.presentation.sortOrder).toEqual([{ path: 'Amount', descending: true }]);
    expect(ui.presentation.requestAtLeast).toEqual(['Note']);
    expect(ui.lineItem.map((c) => c.path)).toEqual(['Year']);
    expect(ui.defaultChart).toBeUndefined();
  });

  it('AL-12 P2 a PV without LineItem or Chart is not compliant: the UI.LineItem alone, without sort or RequestAtLeast', () => {
    for (const viz of ['', '<AnnotationPath>@UI.LineItem#Missing</AnnotationPath>']) {
      const m = buildModel(doc(pv(viz)));
      const ui = m.ui['T.Sale']!;
      expect(ui.presentation.sortOrder).toEqual([]);
      expect(ui.presentation.requestAtLeast).toEqual([]);
      expect(ui.lineItem.map((c) => c.path)).toEqual(['Region']);
      expect(qs(m, buildListRequest(m, ui, { source: { entitySet: 'Sales' }, columns: ui.lineItem }))).toBe('$select=ID,Region');
    }
  });

  it('AL-12 P2 a non-compliant default SPV falls back to the PV', () => {
    const m = buildModel(doc(`${pv('<AnnotationPath>@UI.LineItem</AnnotationPath>')}
      <Annotation Term="UI.SelectionPresentationVariant"><Record>
        <PropertyValue Property="PresentationVariant"><Record><PropertyValue Property="SortOrder"><Collection><Record><PropertyValue Property="Property" PropertyPath="Year"/></Record></Collection></PropertyValue></Record></PropertyValue>
      </Record></Annotation>`));
    expect(m.ui['T.Sale']!.presentation.sortOrder).toEqual([{ path: 'Amount', descending: true }]);
  });

  it('AL-12 P2 a Chart first in the default PV: the list shows that chart (SingleChart); the table keeps the UI.LineItem', () => {
    const m = buildModel(doc(pv('<AnnotationPath>@UI.Chart#ByRegion</AnnotationPath><AnnotationPath>@UI.LineItem#Short</AnnotationPath>')));
    const ui = m.ui['T.Sale']!;
    expect(ui.defaultChart).toBe('ByRegion');
    expect(ui.lineItem.map((c) => c.path)).toEqual(['Region']);
    expect(ui.presentation.sortOrder).toEqual([{ path: 'Amount', descending: true }]);
  });
});

describe('AL-12 P2 views (FE getVisualizationsFromAnnotation with isMacroOrMultipleView, createSingleVisualizationView)', () => {
  const spv = (q: string, viz: string, sort = '', more = '') => `<Annotation Term="UI.SelectionPresentationVariant" Qualifier="${q}"><Record>
    <PropertyValue Property="Text" String="${q}"/>
    <PropertyValue Property="SelectionVariant"><Record><PropertyValue Property="SelectOptions"><Collection/></PropertyValue></Record></PropertyValue>
    <PropertyValue Property="PresentationVariant"><Record>${sort}${viz ? `<PropertyValue Property="Visualizations"><Collection>${viz}</Collection></PropertyValue>` : ''}${more}</Record></PropertyValue>
  </Record></Annotation>`;
  const m = buildModel(doc(`${pv('<AnnotationPath>@UI.LineItem</AnnotationPath>')}
    ${spv('Table', '<AnnotationPath>@UI.LineItem#Short</AnnotationPath><AnnotationPath>@UI.Chart#ByRegion</AnnotationPath>', '', '<PropertyValue Property="RequestAtLeast"><Collection><PropertyPath>Year</PropertyPath></Collection></PropertyValue>')}
    ${spv('Chart', '<AnnotationPath>@UI.Chart#ByRegion</AnnotationPath><AnnotationPath>@UI.LineItem</AnnotationPath>', '<PropertyValue Property="SortOrder"><Collection><Record><PropertyValue Property="Property" PropertyPath="Region"/></Record></Collection></PropertyValue>')}
    ${spv('None', '')}`));
  const views = Object.fromEntries(m.ui['T.Sale']!.views.map((v) => [v.id, v]));

  it('AL-12 P2 the first LineItem or Chart decides: a chart first is a chart view', () => {
    expect(views.Table!.visualization).toBe('table');
    expect(views.Table!.lineItem.map((c) => c.path)).toEqual(['Year']);
    expect(views.Chart!.visualization).toBe('chart');
    expect(views.Chart!.chart?.id).toBe('ByRegion');
  });

  it('AL-12 P2 a view without sort does not take the default PV sort; its own RequestAtLeast is kept', () => {
    expect(views.Table!.presentation.sortOrder).toEqual([]);
    expect(views.Table!.presentation.requestAtLeast).toEqual(['Year']);
    expect(views.Chart!.presentation.sortOrder).toEqual([{ path: 'Region', descending: false }]);
    const ui = m.ui['T.Sale']!;
    const req = buildListRequest(m, ui, { source: { entitySet: 'Sales' }, columns: views.Table!.lineItem, sort: views.Table!.presentation.sortOrder, requestAtLeast: views.Table!.presentation.requestAtLeast });
    expect(qs(m, req)).toBe('$select=ID,Year');
  });

  it('AL-12 P2 a view without visualizations shows the default LineItem', () => {
    expect(views.None!.visualization).toBe('table');
    expect(views.None!.lineItem.map((c) => c.path)).toEqual(['Region']);
  });
});

describe('AL-12 P2 chart: Title, Actions, DynamicMeasures, measure roles, sort (FE Chart, MdcChartTemplate, ChartHelper)', () => {
  const m = buildModel(doc(`
    <Annotation Term="Analytics.AggregatedProperty" Qualifier="avgAmount"><Record>
      <PropertyValue Property="Name" String="AvgAmount"/><PropertyValue Property="AggregatableProperty" PropertyPath="Amount"/><PropertyValue Property="AggregationMethod" String="average"/>
      <Annotation Term="Common.Label" String="Average amount"/>
    </Record></Annotation>
    <Annotation Term="UI.Chart" Qualifier="Avg"><Record>
      <PropertyValue Property="ChartType" EnumMember="UI.ChartType/ColumnStacked"/>
      <PropertyValue Property="Description" String="Averages"/>
      <PropertyValue Property="Dimensions"><Collection><PropertyPath>Year</PropertyPath></Collection></PropertyValue>
      <PropertyValue Property="DynamicMeasures"><Collection><AnnotationPath>@Analytics.AggregatedProperty#avgAmount</AnnotationPath></Collection></PropertyValue>
      <PropertyValue Property="Measures"><Collection><PropertyPath>Amount</PropertyPath></Collection></PropertyValue>
      <PropertyValue Property="MeasureAttributes"><Collection>
        <Record Type="UI.ChartMeasureAttributeType"><PropertyValue Property="DynamicMeasure" AnnotationPath="@Analytics.AggregatedProperty#avgAmount"/><PropertyValue Property="Role" EnumMember="UI.ChartMeasureRoleType/Axis2"/></Record>
      </Collection></PropertyValue>
      <PropertyValue Property="Actions"><Collection>
        <Record Type="UI.DataFieldForAction"><PropertyValue Property="Label" String="Recalculate"/><PropertyValue Property="Action" String="T.EntityContainer/recalc"/></Record>
        <Record Type="UI.DataFieldForAction"><PropertyValue Property="Label" String="Approve"/><PropertyValue Property="Action" String="T.approve"/></Record>
      </Collection></PropertyValue>
    </Record></Annotation>
    <Annotation Term="UI.PresentationVariant" Qualifier="AvgChart"><Record>
      <PropertyValue Property="SortOrder"><Collection><Record><PropertyValue Property="DynamicProperty" AnnotationPath="@Analytics.AggregatedProperty#avgAmount"/><PropertyValue Property="Descending" Bool="true"/></Record></Collection></PropertyValue>
      <PropertyValue Property="Visualizations"><Collection><AnnotationPath>@UI.Chart#Avg</AnnotationPath></Collection></PropertyValue>
    </Record></Annotation>`));
  const ui = m.ui['T.Sale']!;
  const chart = ui.charts.Avg!;

  it('AL-12 P2 reads Analytics.AggregatedProperty as transformation aggregates', () => {
    expect(m.entitySets.Sales!.capabilities.aggregation!.aggregatedProperties).toEqual([{ qualifier: 'avgAmount', name: 'AvgAmount', property: 'Amount', method: 'average', label: 'Average amount' }]);
  });

  it('AL-12 P2 Chart.Title only when annotated; Description; DynamicMeasures by name; measure roles', () => {
    expect(ui.charts.ByRegion!.chartTitle).toBe('Amount by region');
    expect(chart.chartTitle).toBeUndefined();
    expect(chart.description).toBe('Averages');
    expect(chart.dynamicMeasures).toEqual(['AvgAmount']);
    expect(chart.measureRoles).toEqual({ AvgAmount: 'Axis2' });
  });

  it('AL-12 P2 Chart.Actions: only unbound actions (FE getChartActions)', () => {
    expect(chart.actions?.map((a) => a.label)).toEqual(['Recalculate']);
  });

  it('AL-12 P2 the chart request: dynamic measures first, `with <method> as <Name>`; PV SortOrder with DynamicProperty sorts by the Name', () => {
    const p = ui.presentationVariants.AvgChart!.presentation;
    expect(p.chartSortOrder).toEqual([{ path: 'AvgAmount', descending: true }]);
    expect(p.sortOrder).toEqual([]);
    const req = buildChartRequest(m, chart, { source: { entitySet: 'Sales' }, sort: p.chartSortOrder });
    expect(qs(m, req)).toBe('$apply=groupby((Year),aggregate(Amount with average as AvgAmount,Amount))&$count=true&$orderby=AvgAmount desc');
  });
});

describe('AL-12 P2 automatic table type inputs (FE Table getTableType, getInitialExpansionLevel)', () => {
  it('AL-12 P2 a qualified RecursiveHierarchy pair is marked paired; PV InitialExpansionLevel is read', () => {
    const m = buildModel(doc(`
      <Annotation Term="Aggregation.RecursiveHierarchy" Qualifier="H"><Record><PropertyValue Property="NodeProperty" PropertyPath="ID"/><PropertyValue Property="ParentNavigationProperty" NavigationPropertyPath="_Parent"/></Record></Annotation>
      <Annotation Term="Hierarchy.RecursiveHierarchy" Qualifier="H"><Record/></Annotation>
      ${pv('<AnnotationPath>@UI.LineItem</AnnotationPath>', '<PropertyValue Property="InitialExpansionLevel" Int="2"/>')}`));
    expect(m.entityTypes['T.Sale']!.hierarchies?.[0]).toMatchObject({ qualifier: 'H', paired: true });
    expect(m.ui['T.Sale']!.presentation.initialExpansionLevel).toBe(2);
  });
});
