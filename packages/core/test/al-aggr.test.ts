/**
 * Stage 3 (docs/31), docs/29 §4 P1-2 and P1-3: Aggregation.CustomAggregate and the list report chart request, as
 * Fiori elements 1.154 sends them (sap.fe.core.converters.helpers.Aggregation, sap.fe.macros.chart.ChartDelegate,
 * sap.ui.model.odata.v4.lib._AggregationHelper; FE comparison tests/e2e-fe/aggr.spec.ts).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  aggregateMeasure, buildAggregateRequest, buildChartRequest, buildModel, buildTotalsRequest, canTotal, collectTotals, isCustomAggregate, MemoryProvider, toQueryString,
} from '../src/index';

const model = buildModel(readFileSync(join(import.meta.dirname, 'samples', 'purchasing.en.xml'), 'utf8'));
const source = { entitySet: 'PurchaseOrders' };
const ui = model.ui['Purchasing.PurchaseOrder']!;
const qs = (req: Parameters<typeof toQueryString>[1], m = model) => decodeURIComponent(toQueryString(m, req));

const doc = (annotations: string) => `<?xml version="1.0"?>
<edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx">
  <edmx:Reference Uri="a"><edmx:Include Namespace="Org.OData.Aggregation.V1" Alias="Aggregation"/></edmx:Reference>
  <edmx:Reference Uri="m"><edmx:Include Namespace="Org.OData.Measures.V1" Alias="Measures"/></edmx:Reference>
  <edmx:Reference Uri="u"><edmx:Include Namespace="com.sap.vocabularies.UI.v1" Alias="UI"/></edmx:Reference>
  <edmx:Reference Uri="c"><edmx:Include Namespace="com.sap.vocabularies.Common.v1" Alias="Common"/></edmx:Reference>
  <edmx:DataServices><Schema xmlns="http://docs.oasis-open.org/odata/ns/edm" Namespace="T">
    <EntityType Name="Sale"><Key><PropertyRef Name="ID"/></Key>
      <Property Name="ID" Type="Edm.String" Nullable="false"/>
      <Property Name="Region" Type="Edm.String"/>
      <Property Name="RegionName" Type="Edm.String"/>
      <Property Name="Year" Type="Edm.String"/>
      <Property Name="Amount" Type="Edm.Decimal" Scale="2"/>
      <Property Name="Margin" Type="Edm.Decimal" Scale="2"/>
      <Property Name="Currency" Type="Edm.String"/>
    </EntityType>
    <EntityContainer Name="C"><EntitySet Name="Sales" EntityType="T.Sale"/></EntityContainer>
    <Annotations Target="T.Sale">
      <Annotation Term="Aggregation.ApplySupported"><Record><PropertyValue Property="Transformations"><Collection><String>filter</String><String>groupby</String><String>aggregate</String></Collection></PropertyValue></Record></Annotation>
      ${annotations}
      <Annotation Term="UI.Chart" Qualifier="Two">
        <Record><PropertyValue Property="ChartType" EnumMember="UI.ChartType/Column"/>
          <PropertyValue Property="Dimensions"><Collection><PropertyPath>Year</PropertyPath><PropertyPath>Region</PropertyPath></Collection></PropertyValue>
          <PropertyValue Property="DimensionAttributes"><Collection><Record><PropertyValue Property="Dimension" PropertyPath="Region"/><PropertyValue Property="Role" EnumMember="UI.ChartDimensionRoleType/Series"/></Record></Collection></PropertyValue>
          <PropertyValue Property="Measures"><Collection><PropertyPath>Amount</PropertyPath><PropertyPath>Margin</PropertyPath></Collection></PropertyValue>
        </Record>
      </Annotation>
    </Annotations>
    <Annotations Target="T.Sale/Region"><Annotation Term="Common.Text" Path="RegionName"/></Annotations>
    <Annotations Target="T.Sale/Amount"><Annotation Term="Measures.ISOCurrency" Path="Currency"/></Annotations>
  </Schema></edmx:DataServices>
</edmx:Edmx>`;

describe('AL-10 P1-2 Aggregation.CustomAggregate (docs/29 §4)', () => {
  it('AL-10 P1-2 reads the custom aggregates of the aggregation target (entity type without ApplySupported on the set)', () => {
    expect(model.entitySets.PurchaseOrders!.capabilities.aggregation!.customAggregates).toEqual({ NetAmount: 'Edm.Decimal' });
    expect(isCustomAggregate(model, source, 'NetAmount')).toBe(true);
    expect(isCustomAggregate(model, source, 'BudgetAmount')).toBe(false);
  });

  it('AL-10 P1-2 a custom aggregate is requested by its name, other measures with sum', () => {
    expect(aggregateMeasure(model, source, 'NetAmount')).toEqual({ path: 'NetAmount' });
    expect(aggregateMeasure(model, source, 'BudgetAmount')).toEqual({ path: 'BudgetAmount', with: 'sum' });
  });

  it('AL-10 P1-2 with custom aggregates only they can be totalled (FE isPropertyAggregatable)', () => {
    expect(canTotal(model, source, 'NetAmount')).toBe(true);
    expect(canTotal(model, source, 'BudgetAmount')).toBe(false);
    const sales = buildModel(doc('<Annotation Term="Aggregation.CustomAggregate" Qualifier="Margin" String="Edm.Decimal"/>'));
    expect(canTotal(sales, { entitySet: 'Sales' }, 'Margin')).toBe(true);
    expect(canTotal(sales, { entitySet: 'Sales' }, 'Amount')).toBe(false);
    // without custom aggregates nothing is totalled (D39: no "numeric property with sum" fallback)
    const plain = buildModel(doc(''));
    expect(plain.entitySets.Sales!.capabilities.aggregation!.customAggregates).toEqual({});
    expect(canTotal(plain, { entitySet: 'Sales' }, 'Amount')).toBe(false);
  });

  it('AL-10 P1-2 totals, KPI and card requests use aggregate(M) for a custom aggregate', () => {
    expect(qs(buildTotalsRequest(model, { source, measures: ['NetAmount'] }))).toBe('$apply=aggregate(NetAmount,Currency)'); // D39: the unit with the measure, as FE
    expect(qs(buildAggregateRequest(model, { dimensions: ['Currency'], measures: ['NetAmount'] }, { source }))).toBe('$apply=groupby((Currency),aggregate(NetAmount))&$orderby=Currency');
    const sales = buildModel(doc('<Annotation Term="Aggregation.CustomAggregate" Qualifier="Margin" String="Edm.Decimal"/>'));
    const req = buildAggregateRequest(sales, { dimensions: [], measures: ['Margin', 'Amount'] }, { source: { entitySet: 'Sales' } });
    expect(qs(req, sales)).toBe('$apply=aggregate(Margin,Amount with sum as Amount)');
  });

  it('AL-10 P1-2 the totals of a custom aggregate are read from the property of its name', () => {
    const t = collectTotals(model, { source, measures: ['NetAmount'] }, [{ Currency: 'EUR', NetAmount: '12.5' }, { Currency: 'USD', NetAmount: 3 }]);
    expect(t.get('')?.values.NetAmount).toEqual([{ value: 12.5, unit: 'EUR' }, { value: 3, unit: 'USD' }]);
  });

  it('AL-10 P1-2 the memory provider evaluates a custom aggregate as a sum', async () => {
    const p = new MemoryProvider({ model, data: { PurchaseOrders: [{ PurchaseOrder: '1', Currency: 'EUR', NetAmount: 10 }, { PurchaseOrder: '2', Currency: 'EUR', NetAmount: 5 }] } });
    expect((await p.query(buildTotalsRequest(model, { source, measures: ['NetAmount'] }))).rows).toEqual([{ Currency: 'EUR', NetAmount: 15 }]);
  });
});

describe('AL-10 P1-3 list report chart request (docs/29 §4)', () => {
  it('AL-10 P1-3 groups by the dimensions and the units, sorted; no text on a navigation; $count, no $orderby or $top', () => {
    // FE 1.154 (fe:po-chart): $count=true&$apply=filter(…)/groupby((Currency,Status),aggregate(NetAmount))
    const req = buildChartRequest(model, ui.charts.ByStatus!, { source, filters: { CompanyCode: [{ operator: 'EQ', values: ['1000'] }] } });
    expect(qs(req)).toBe("$apply=filter(CompanyCode eq '1000')/groupby((Currency,Status),aggregate(NetAmount))&$count=true");
  });

  it('AL-10 P1-3 all dimensions and measures; a groupable text of the entity itself is grouped by; the PV sort is applied', () => {
    const sales = buildModel(doc('<Annotation Term="Aggregation.CustomAggregate" Qualifier="Amount" String="Edm.Decimal"/>'));
    const chart = sales.ui['T.Sale']!.charts.Two!;
    expect(chart.dimensionRoles).toEqual({ Region: 'Series' });
    const req = buildChartRequest(sales, chart, { source: { entitySet: 'Sales' }, sort: [{ path: 'Amount', descending: true }] });
    expect(qs(req, sales)).toBe('$apply=groupby((Currency,Region,RegionName,Year),aggregate(Amount,Margin with sum as Margin))&$count=true&$orderby=Amount desc');
  });
});
