/** Phase 3 (docs/15-research-micro-chart.md): micro chart annotations in the model. */
import { describe, expect, it } from 'vitest';
import { buildListRequest, buildModel, calculateCriticality, fieldPaths, MemoryProvider, toQueryString, type CriticalityCalculationModel, type ValueRef } from '../src';

const xml = `<?xml version="1.0"?>
<edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx">
  <edmx:Reference Uri="u"><edmx:Include Namespace="com.sap.vocabularies.UI.v1" Alias="UI"/></edmx:Reference>
  <edmx:DataServices><Schema xmlns="http://docs.oasis-open.org/odata/ns/edm" Namespace="T">
<EntityType Name="Order"><Key><PropertyRef Name="ID"/></Key>
  <Property Name="ID" Type="Edm.String" Nullable="false"/>
  <Property Name="Amount" Type="Edm.Decimal" Scale="2"/>
  <Property Name="Budget" Type="Edm.Decimal" Scale="2"/>
  <Property Name="Forecast" Type="Edm.Decimal" Scale="2"/>
  <Property Name="Low" Type="Edm.Decimal" Scale="2"/>
  <Property Name="Share" Type="Edm.Decimal"/>
  <NavigationProperty Name="Items" Type="Collection(T.Item)"/>
</EntityType>
<EntityType Name="Item"><Key><PropertyRef Name="Pos"/></Key><Property Name="Pos" Type="Edm.Int32" Nullable="false"/><Property Name="ID" Type="Edm.String"/><Property Name="Qty" Type="Edm.Decimal"/></EntityType>
<EntityContainer Name="C"><EntitySet Name="Orders" EntityType="T.Order"><NavigationPropertyBinding Path="Items" Target="Items"/></EntitySet><EntitySet Name="Items" EntityType="T.Item"/></EntityContainer>
<Annotations Target="T.Item">
  <Annotation Term="UI.Chart" Qualifier="Qty"><Record><PropertyValue Property="ChartType" EnumMember="UI.ChartType/Line"/><PropertyValue Property="Dimensions"><Collection><PropertyPath>Pos</PropertyPath></Collection></PropertyValue><PropertyValue Property="Measures"><Collection><PropertyPath>Qty</PropertyPath></Collection></PropertyValue></Record></Annotation>
</Annotations>
<Annotations Target="T.Order">
  <Annotation Term="UI.DataPoint" Qualifier="Budget"><Record>
    <PropertyValue Property="Value" Path="Amount"/><PropertyValue Property="TargetValue" Path="Budget"/><PropertyValue Property="ForecastValue" Path="Forecast"/>
    <PropertyValue Property="Visualization" EnumMember="UI.VisualizationType/DeltaBulletChart"/>
    <PropertyValue Property="ValueFormat"><Record><PropertyValue Property="NumberOfFractionalDigits" Int="1"/></Record></PropertyValue>
    <PropertyValue Property="CriticalityCalculation"><Record>
      <PropertyValue Property="ImprovementDirection" EnumMember="UI.ImprovementDirectionType/Maximize"/>
      <PropertyValue Property="DeviationRangeLowValue" Path="Low"/>
      <PropertyValue Property="ToleranceRangeLowValue" Decimal="80"/>
    </Record></PropertyValue>
  </Record></Annotation>
  <Annotation Term="UI.Chart" Qualifier="Bullet"><Record><PropertyValue Property="ChartType" EnumMember="UI.ChartType/Bullet"/><PropertyValue Property="Measures"><Collection><PropertyPath>Amount</PropertyPath></Collection></PropertyValue>
    <PropertyValue Property="MeasureAttributes"><Collection><Record Type="UI.ChartMeasureAttributeType"><PropertyValue Property="Measure" PropertyPath="Amount"/><PropertyValue Property="DataPoint" AnnotationPath="@UI.DataPoint#Budget"/></Record></Collection></PropertyValue></Record></Annotation>
  <Annotation Term="UI.LineItem"><Collection>
    <Record Type="UI.DataField"><PropertyValue Property="Value" Path="ID"/></Record>
    <Record Type="UI.DataFieldForAnnotation"><PropertyValue Property="Label" String="Budget use"/><PropertyValue Property="Target" AnnotationPath="@UI.Chart#Bullet"/></Record>
    <Record Type="UI.DataFieldForAnnotation"><PropertyValue Property="Target" AnnotationPath="Items/@UI.Chart#Qty"/></Record>
  </Collection></Annotation>
</Annotations>
  </Schema></edmx:DataServices>
</edmx:Edmx>`;

const model = buildModel(xml);
const order = model.entityTypes['T.Order']!.fullName;
const lineItem = model.ui[order]!.lineItem;

describe('docs/15 micro charts in the model', () => {
  it('MC-61 DataPoint: ForecastValue, CriticalityCalculation, DeltaBulletChart, ValueFormat', () => {
    const dp = model.ui[order]!.charts.Bullet!.dataPoints.Amount!;
    expect(dp.forecastValue).toEqual({ path: 'Forecast' });
    expect(dp.deltaBullet).toBe(true);
    expect(dp.visualization).toBe('Number');
    expect(dp.fractionDigits).toBe(1);
    expect(dp.criticalityCalculation).toEqual({
      improvementDirection: 'Maximize', deviationRangeLowValue: { path: 'Low' }, toleranceRangeLowValue: { value: 80 },
      acceptanceRangeLowValue: undefined, acceptanceRangeHighValue: undefined, toleranceRangeHighValue: undefined, deviationRangeHighValue: undefined,
    });
  });

  it('MC-10 DataFieldForAnnotation to a UI.Chart of the row is a chart column with the paths it needs', () => {
    const col = lineItem.find((c) => c.kind === 'chart')!;
    expect(col.label).toBe('Budget use');
    expect(col.chart?.chartType).toBe('Bullet');
    expect(fieldPaths(model, order, col).sort()).toEqual(['Amount', 'Budget', 'Forecast', 'Low']);
    expect(lineItem).toHaveLength(3);
  });

  it('MC-09 CriticalityCalculation: Maximize, Minimize, Target, acceptance range', () => {
    const r = (ref: ValueRef | undefined) => (ref && 'value' in ref ? Number(ref.value) : undefined);
    const v = (n: number) => ({ value: n });
    const max: CriticalityCalculationModel = { improvementDirection: 'Maximize', deviationRangeLowValue: v(50), toleranceRangeLowValue: v(80) };
    expect([40, 60, 90].map((x) => calculateCriticality(max, x, r))).toEqual([1, 2, 3]);
    const min: CriticalityCalculationModel = { improvementDirection: 'Minimize', toleranceRangeHighValue: v(80), deviationRangeHighValue: v(100) };
    expect([70, 90, 120].map((x) => calculateCriticality(min, x, r))).toEqual([3, 2, 1]);
    const target: CriticalityCalculationModel = {
      improvementDirection: 'Target', deviationRangeLowValue: v(10), toleranceRangeLowValue: v(20), acceptanceRangeLowValue: v(30),
      acceptanceRangeHighValue: v(70), toleranceRangeHighValue: v(80), deviationRangeHighValue: v(90),
    };
    expect([5, 15, 25, 50, 75, 85, 95].map((x) => calculateCriticality(target, x, r))).toEqual([1, 2, 0, 3, 0, 2, 1]);
    expect(calculateCriticality(max, Number.NaN, r)).toBeUndefined();
  });

  it('MC-65 ADR-025 a chart over a collection is read with $expand($select;$orderby;$top) in the list request', () => {
    const req = buildListRequest(model, model.ui[order]!, { source: { entitySet: 'Orders' }, columns: lineItem, top: 10 });
    const items = req.expand.find((e) => e.navigation === 'Items')!;
    expect(items.select).toEqual(['Pos', 'Qty']);
    expect(items.orderBy).toEqual([{ path: 'Pos', descending: false }]);
    expect(items.top).toBe(100);
    expect(decodeURIComponent(toQueryString(model, req))).toContain('$expand=Items($select=Pos,Qty;$orderby=Pos;$top=100)');
  });

  it('ADR-025 the memory provider orders and cuts an expanded collection', async () => {
    const provider = new MemoryProvider({ model, data: {
      Orders: [{ ID: 'A', Amount: '1', Budget: '2', Forecast: '1', Low: '0', Share: '1' }],
      Items: [{ ID: 'A', Pos: 3, Qty: '30' }, { ID: 'A', Pos: 1, Qty: '10' }, { ID: 'A', Pos: 2, Qty: '20' }],
    } });
    const res = await provider.query({ source: { entitySet: 'Orders' }, select: ['ID'], expand: [{ navigation: 'Items', select: ['Pos', 'Qty'], expand: [], orderBy: [{ path: 'Pos', descending: false }], top: 2 }], orderBy: [], count: false });
    expect((res.rows[0]!.Items as { Pos: number }[]).map((r) => r.Pos)).toEqual([1, 2]);
  });
});
