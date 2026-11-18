/**
 * Stage 4 (docs/31), docs/29 §5 "views, charts, aggregation, KPI": the list report chart (types, sort, title, actions,
 * dynamic measures), chart-first presentations and chart views, the automatic table type and the KPI tags, as
 * Fiori elements 1.154 (ListReportConverter, DataVisualization, Chart, Table getTableType, KPI, KPIManagement;
 * sap.fe.macros.chart.ChartHelper, MdcChartTemplate). FE comparison: tests/e2e-fe/views4.spec.ts.
 */
import { MantineProvider } from '@mantine/core';
import { buildModel, MemoryProvider, MemoryVariantStore, toQueryString, type QueryRequest, type Row } from '@rhfan2019/smart-kit-core';
import { fireEvent, render, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { drawnChart, feChartType } from '../src/chart/chartType';
import { SmartKitProvider } from '../src/context/SmartKitProvider';
import { autoTableType, kpiLabel, SmartListReport } from '../src/templates/SmartListReport';
import { smartKitMantineTheme } from '../src/theme/mantine';
import Chart from '../src/v4/fe/macros/Chart';

const xml = (annotations: string, transformations = '<String>filter</String><String>groupby</String><String>aggregate</String>') => `<?xml version="1.0"?>
<edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx">
  <edmx:Reference Uri="u"><edmx:Include Namespace="com.sap.vocabularies.UI.v1" Alias="UI"/></edmx:Reference>
  <edmx:Reference Uri="a"><edmx:Include Namespace="Org.OData.Aggregation.V1" Alias="Aggregation"/></edmx:Reference>
  <edmx:Reference Uri="an"><edmx:Include Namespace="com.sap.vocabularies.Analytics.v1" Alias="Analytics"/></edmx:Reference>
  <edmx:Reference Uri="c"><edmx:Include Namespace="com.sap.vocabularies.Common.v1" Alias="Common"/></edmx:Reference>
  <edmx:Reference Uri="m"><edmx:Include Namespace="Org.OData.Measures.V1" Alias="Measures"/></edmx:Reference>
  <edmx:DataServices><Schema xmlns="http://docs.oasis-open.org/odata/ns/edm" Namespace="T">
<EntityType Name="Sale"><Key><PropertyRef Name="ID"/></Key><Property Name="ID" Type="Edm.String" Nullable="false"/>
  <Property Name="Year" Type="Edm.String"/><Property Name="Region" Type="Edm.String"/>
  <Property Name="Amount" Type="Edm.Decimal" Scale="0"/><Property Name="Cost" Type="Edm.Decimal" Scale="0"/><Property Name="Currency" Type="Edm.String"/></EntityType>
<Action Name="recalc"/>
<EntityContainer Name="C"><EntitySet Name="Sales" EntityType="T.Sale"/><ActionImport Name="recalc" Action="T.recalc"/></EntityContainer>
<Annotations Target="T.Sale/Amount"><Annotation Term="Common.Label" String="Amount"/><Annotation Term="Measures.ISOCurrency" Path="Currency"/></Annotations>
<Annotations Target="T.Sale/Cost"><Annotation Term="Common.Label" String="Cost"/></Annotations>
<Annotations Target="T.Sale">
  <Annotation Term="Aggregation.ApplySupported"><Record><PropertyValue Property="Transformations"><Collection>${transformations}</Collection></PropertyValue></Record></Annotation>
  <Annotation Term="Aggregation.CustomAggregate" Qualifier="Amount" String="Edm.Decimal"/>
  <Annotation Term="UI.LineItem"><Collection><Record Type="UI.DataField"><PropertyValue Property="Value" Path="Year"/></Record><Record Type="UI.DataField"><PropertyValue Property="Value" Path="Amount"/></Record></Collection></Annotation>
  <Annotation Term="UI.Chart" Qualifier="ByYear"><Record><PropertyValue Property="Title" String="Amount by year"/><PropertyValue Property="ChartType" EnumMember="UI.ChartType/ColumnStacked"/>
    <PropertyValue Property="Dimensions"><Collection><PropertyPath>Year</PropertyPath><PropertyPath>Region</PropertyPath></Collection></PropertyValue>
    <PropertyValue Property="DimensionAttributes"><Collection><Record><PropertyValue Property="Dimension" PropertyPath="Region"/><PropertyValue Property="Role" EnumMember="UI.ChartDimensionRoleType/Series"/></Record></Collection></PropertyValue>
    <PropertyValue Property="Measures"><Collection><PropertyPath>Amount</PropertyPath></Collection></PropertyValue>
    <PropertyValue Property="Actions"><Collection><Record Type="UI.DataFieldForAction"><PropertyValue Property="Label" String="Recalculate"/><PropertyValue Property="Action" String="T.EntityContainer/recalc"/></Record></Collection></PropertyValue>
  </Record></Annotation>
  <Annotation Term="UI.Chart" Qualifier="NoTitle"><Record><PropertyValue Property="ChartType" EnumMember="UI.ChartType/Line"/>
    <PropertyValue Property="Dimensions"><Collection><PropertyPath>Year</PropertyPath></Collection></PropertyValue>
    <PropertyValue Property="DynamicMeasures"><Collection><AnnotationPath>@Analytics.AggregatedProperty#maxCost</AnnotationPath></Collection></PropertyValue></Record></Annotation>
  <Annotation Term="Analytics.AggregatedProperty" Qualifier="maxCost"><Record><PropertyValue Property="Name" String="MaxCost"/><PropertyValue Property="AggregatableProperty" PropertyPath="Cost"/><PropertyValue Property="AggregationMethod" String="max"/></Record></Annotation>
  ${annotations}
</Annotations>
  </Schema></edmx:DataServices>
</edmx:Edmx>`;

const SALES: Row[] = [
  { ID: '1', Year: '2025', Region: 'N', Amount: 100, Cost: 40, Currency: 'EUR' },
  { ID: '2', Year: '2025', Region: 'S', Amount: 50, Cost: 10, Currency: 'EUR' },
  { ID: '3', Year: '2026', Region: 'N', Amount: 20, Cost: 5, Currency: 'EUR' },
];

function host(model: ReturnType<typeof buildModel>, children: ReactNode) {
  const provider = new MemoryProvider({ model, data: { Sales: SALES } });
  const requests: QueryRequest[] = [];
  const invoked: string[] = [];
  const query = provider.query.bind(provider);
  provider.query = (req, opts) => { requests.push(req); return query(req, opts); };
  provider.invoke = async (action) => { invoked.push(action); return {}; };
  const urls = () => requests.map((r) => decodeURIComponent(toQueryString(model, r)));
  const ui = (
    <MantineProvider theme={smartKitMantineTheme}>
      <SmartKitProvider services={{ s: { model, dataProvider: provider, variants: new MemoryVariantStore() } }} locale="en" namespace="al-views4">{children}</SmartKitProvider>
    </MantineProvider>
  );
  return { ui, urls, invoked };
}

describe('AL-12 P2 chart types (FE ChartHelper ChartTypeEnum)', () => {
  it('AL-12 P2 maps UI.ChartType as FE and draws column, bar, line, area, pie, donut and stacked types', () => {
    expect(feChartType('Column')).toBe('column');
    expect(feChartType('AreaStacked')).toBe('stacked_column');
    expect(feChartType('Radar')).toBe('line');
    expect(feChartType('HorizontalArea')).toBe('bar');
    expect(feChartType('BarStacked100')).toBe('100_stacked_bar');
    expect(drawnChart('pie')).toEqual({ kind: 'pie', exact: true });
    expect(drawnChart('stacked_column')).toEqual({ kind: 'column', stacked: true, exact: true });
    expect(drawnChart('100_stacked_bar')).toEqual({ kind: 'bar', stacked: 'percent', exact: true });
    expect(drawnChart('bubble')).toEqual({ kind: 'column', exact: false });
  });

  it('AL-12 P2 a stacked column chart stacks the series; header = Chart.Title; Chart.Actions run the unbound action', async () => {
    const model = buildModel(xml(''));
    const { ui, invoked } = host(model, <Chart contextPath="/Sales" metaPath="@UI.Chart#ByYear" service="s" />);
    render(ui);
    await waitFor(() => expect(document.querySelector('[data-sk-chart-bar="2025"]')).not.toBeNull());
    expect(document.querySelector('.sk-chart[data-sk-chart]')).toHaveAttribute('data-sk-chart', 'stacked_column');
    const rects = [...document.querySelectorAll('[data-sk-chart-bar="2025"] rect')].map((r) => Number(r.getAttribute('height')));
    expect(rects).toHaveLength(2);
    // stacked: both rectangles have the same x
    const xs = [...document.querySelectorAll('[data-sk-chart-bar="2025"] rect')].map((r) => r.getAttribute('x'));
    expect(new Set(xs).size).toBe(1);
    expect(document.querySelector('[data-sk-table-title]')).toHaveTextContent('Amount by year');
    fireEvent.click(document.querySelector('[data-sk-action="DataFieldForAction::T.EntityContainer/recalc"]')!);
    await waitFor(() => expect(invoked).toEqual(['T.EntityContainer/recalc']));
  });

  it('AL-12 P2 without Chart.Title no header; dynamic measures are requested `with <method> as <Name>`', async () => {
    const model = buildModel(xml(''));
    const { ui, urls } = host(model, <Chart contextPath="/Sales" metaPath="@UI.Chart#NoTitle" service="s" />);
    render(ui);
    await waitFor(() => expect(document.querySelector('[data-sk-chart-bar="2025"]')).not.toBeNull());
    expect(urls()).toEqual(['$apply=groupby((Year),aggregate(Cost with max as MaxCost))&$count=true']);
    expect(document.querySelector('[data-sk-table-title]')?.textContent ?? '').toBe('');
    expect(document.querySelector('.sk-chart[data-sk-chart]')).toHaveAttribute('data-sk-chart', 'line');
    expect(document.querySelector('[data-sk-chart-bar="2025"]')?.textContent).toContain('40');
  });

  it('AL-12 P2 no chart without Aggregation.ApplySupported (FE createChartVisualization)', () => {
    const model = buildModel(xml('').replace(/<Annotation Term="Aggregation.ApplySupported">.*?<\/Annotation>/s, ''));
    const { ui, urls } = host(model, <Chart contextPath="/Sales" metaPath="@UI.Chart#ByYear" service="s" />);
    render(ui);
    expect(document.querySelector('[data-sk-chart-view]')).toBeNull();
    expect(urls()).toEqual([]);
  });
});

describe('AL-12 P2 list report: chart-first presentation, chart views, automatic table type, KPI tags', () => {
  const pvChartFirst = `<Annotation Term="UI.PresentationVariant"><Record>
    <PropertyValue Property="SortOrder"><Collection><Record><PropertyValue Property="Property" PropertyPath="Amount"/><PropertyValue Property="Descending" Bool="true"/></Record></Collection></PropertyValue>
    <PropertyValue Property="Visualizations"><Collection><AnnotationPath>@UI.Chart#ByYear</AnnotationPath><AnnotationPath>@UI.LineItem</AnnotationPath></Collection></PropertyValue></Record></Annotation>`;

  it('AL-12 P2 the default PV names a chart first: only the chart, sorted by the PV SortOrder', async () => {
    const model = buildModel(xml(pvChartFirst));
    const { ui, urls } = host(model, <SmartListReport service="s" entitySet="Sales" />);
    render(ui);
    await waitFor(() => expect(document.querySelector('[data-sk-chart-bar="2025"]')).not.toBeNull());
    expect(document.querySelector('[data-sk-table="Sales"]')).toBeNull();
    expect(document.querySelector('[data-sk-chart-toggle]')).toBeNull();
    expect(urls().filter((u) => u.includes('groupby'))).toEqual(['$apply=groupby((Currency,Region,Year),aggregate(Amount))&$count=true&$orderby=Amount desc']);
  });

  it('AL-12 P2 a view whose PV names a chart first is a chart view; a table view has no chart switch', async () => {
    const spv = (q: string, viz: string) => `<Annotation Term="UI.SelectionPresentationVariant" Qualifier="${q}"><Record><PropertyValue Property="Text" String="${q}"/>
      <PropertyValue Property="SelectionVariant"><Record><PropertyValue Property="SelectOptions"><Collection/></PropertyValue></Record></PropertyValue>
      <PropertyValue Property="PresentationVariant"><Record><PropertyValue Property="Visualizations"><Collection>${viz}</Collection></PropertyValue></Record></PropertyValue></Record></Annotation>`;
    const model = buildModel(xml(`${spv('Rows', '<AnnotationPath>@UI.LineItem</AnnotationPath><AnnotationPath>@UI.Chart#ByYear</AnnotationPath>')}${spv('Graph', '<AnnotationPath>@UI.Chart#ByYear</AnnotationPath>')}`));
    const { ui } = host(model, <SmartListReport service="s" entitySet="Sales" tableType="ResponsiveTable" views={{ mode: 'tabs' }} />);
    render(ui);
    await waitFor(() => expect(document.querySelectorAll('tr[data-sk-row]').length).toBe(3));
    expect(document.querySelector('[data-sk-chart-toggle]')).toBeNull();
    fireEvent.click(document.querySelector('[data-sk-list-tab="Graph"]')!);
    await waitFor(() => expect(document.querySelector('[data-sk-chart-bar="2025"]')).not.toBeNull());
    expect(document.querySelector('[data-sk-chart-toggle]')).toBeNull();
  });

  it('AL-12 P2 automatic table type: all eight transformations give the analytical table (FE getTableType)', () => {
    const all = ['filter', 'identity', 'orderby', 'skip', 'top', 'groupby', 'aggregate', 'concat'].map((x) => `<String>${x}</String>`).join('');
    expect(autoTableType(buildModel(xml('', all)), 'Sales')).toBe('AnalyticalTable');
    expect(autoTableType(buildModel(xml('')), 'Sales')).toBe('grid');
  });

  it('AL-12 P2 an analytical list report shows the basic search only with the search transformation (FE Table converter)', async () => {
    const all = (extra: string) => ['filter', 'identity', 'orderby', 'skip', 'top', 'groupby', 'aggregate', 'concat', extra].filter(Boolean).map((x) => `<String>${x}</String>`).join('');
    for (const [extra, shown] of [['', false], ['search', true]] as const) {
      const { ui } = host(buildModel(xml('', all(extra))), <SmartListReport service="s" entitySet="Sales" />);
      const view = render(ui);
      await waitFor(() => expect(document.querySelector('[data-sk-filterbar], [data-sk-filter]')).not.toBeNull());
      expect(Boolean(document.querySelector('[data-sk-filter="$search"]'))).toBe(shown);
      view.unmount();
    }
  });

  it('AL-12 P2 KPI tags: UI.KPI value aggregated with its selection variant; FE label and tooltip', async () => {
    expect(kpiLabel('Net amount open')).toBe('NAO');
    expect(kpiLabel('Revenue')).toBe('REV');
    expect(kpiLabel('Net amount')).toBe('NA');
    const kpi = `<Annotation Term="UI.KPI" Qualifier="Amount"><Record>
      <PropertyValue Property="DataPoint"><Record><PropertyValue Property="Title" String="Total amount"/><PropertyValue Property="Value" Path="Amount"/>
        <PropertyValue Property="Criticality" EnumMember="UI.CriticalityType/Positive"/></Record></PropertyValue>
      <PropertyValue Property="SelectionVariant"><Record><PropertyValue Property="SelectOptions"><Collection><Record><PropertyValue Property="PropertyName" PropertyPath="Year"/>
        <PropertyValue Property="Ranges"><Collection><Record><PropertyValue Property="Sign" EnumMember="UI.SelectionRangeSignType/I"/><PropertyValue Property="Option" EnumMember="UI.SelectionRangeOptionType/EQ"/><PropertyValue Property="Low" String="2025"/></Record></Collection></PropertyValue>
      </Record></Collection></PropertyValue></Record></PropertyValue>
      <PropertyValue Property="Detail"><Record><PropertyValue Property="DefaultPresentationVariant"><Record><PropertyValue Property="Visualizations"><Collection><AnnotationPath>@UI.Chart#ByYear</AnnotationPath></Collection></PropertyValue></Record></PropertyValue></Record></PropertyValue>
    </Record></Annotation>`;
    const model = buildModel(xml(kpi));
    const { ui, urls } = host(model, <SmartListReport service="s" entitySet="Sales" tableType="ResponsiveTable" keyPerformanceIndicators={{ amount: { qualifier: 'Amount' } }} />);
    render(ui);
    await waitFor(() => expect(document.querySelector('[data-sk-kpi-tag="amount"] [data-sk-generic-tag]')).not.toBeNull());
    expect(urls()).toContain("$apply=filter(Year eq '2025')/aggregate(Amount,Currency)&$top=1");
    const tag = document.querySelector('[data-sk-kpi-tag="amount"] [data-sk-generic-tag]')!;
    expect(tag).toHaveAttribute('data-sk-generic-tag', 'Success');
    expect(tag.textContent).toBe('TA150 EUR');
    expect(tag).toHaveAttribute('title', 'Total amount 150 EUR\nStatus: Good');
  });
});
