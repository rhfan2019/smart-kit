/**
 * Stage 3 (docs/31), docs/29 §4 P1-2 and P1-3: the list report chart (sap.fe.macros.Chart) requests and draws all
 * dimensions and measures of the UI.Chart as FE 1.154 does (FE comparison tests/e2e-fe/aggr.spec.ts, fe:po-chart).
 */
import { MantineProvider } from '@mantine/core';
import { buildModel, MemoryProvider, MemoryVariantStore, toQueryString, type QueryRequest, type Row } from '@rhfan2019/smart-kit-core';
import { render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { SmartKitProvider } from '../src/context/SmartKitProvider';
import { smartKitMantineTheme } from '../src/theme/mantine';
import Chart from '../src/v4/fe/macros/Chart';

const xml = `<?xml version="1.0"?>
<edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx">
  <edmx:Reference Uri="u"><edmx:Include Namespace="com.sap.vocabularies.UI.v1" Alias="UI"/></edmx:Reference>
  <edmx:Reference Uri="a"><edmx:Include Namespace="Org.OData.Aggregation.V1" Alias="Aggregation"/></edmx:Reference>
  <edmx:Reference Uri="c"><edmx:Include Namespace="com.sap.vocabularies.Common.v1" Alias="Common"/></edmx:Reference>
  <edmx:Reference Uri="m"><edmx:Include Namespace="Org.OData.Measures.V1" Alias="Measures"/></edmx:Reference>
  <edmx:DataServices><Schema xmlns="http://docs.oasis-open.org/odata/ns/edm" Namespace="T">
<EntityType Name="Sale"><Key><PropertyRef Name="ID"/></Key><Property Name="ID" Type="Edm.String" Nullable="false"/>
  <Property Name="Year" Type="Edm.String"/><Property Name="Region" Type="Edm.String"/>
  <Property Name="Amount" Type="Edm.Decimal" Scale="0"/><Property Name="Cost" Type="Edm.Decimal" Scale="0"/><Property Name="Currency" Type="Edm.String"/></EntityType>
<EntityContainer Name="C"><EntitySet Name="Sales" EntityType="T.Sale"/></EntityContainer>
<Annotations Target="T.Sale/Amount"><Annotation Term="Common.Label" String="Amount"/><Annotation Term="Measures.ISOCurrency" Path="Currency"/></Annotations>
<Annotations Target="T.Sale/Cost"><Annotation Term="Common.Label" String="Cost"/></Annotations>
<Annotations Target="T.Sale">
  <Annotation Term="Aggregation.ApplySupported"><Record><PropertyValue Property="Transformations"><Collection><String>filter</String><String>groupby</String><String>aggregate</String></Collection></PropertyValue></Record></Annotation>
  <Annotation Term="Aggregation.CustomAggregate" Qualifier="Amount" String="Edm.Decimal"/>
  <Annotation Term="UI.Chart" Qualifier="Two"><Record><PropertyValue Property="Title" String="Amount and cost"/><PropertyValue Property="ChartType" EnumMember="UI.ChartType/Column"/>
    <PropertyValue Property="Dimensions"><Collection><PropertyPath>Year</PropertyPath></Collection></PropertyValue>
    <PropertyValue Property="Measures"><Collection><PropertyPath>Amount</PropertyPath><PropertyPath>Cost</PropertyPath></Collection></PropertyValue></Record></Annotation>
  <Annotation Term="UI.Chart" Qualifier="Series"><Record><PropertyValue Property="Title" String="Amount by region"/><PropertyValue Property="ChartType" EnumMember="UI.ChartType/Column"/>
    <PropertyValue Property="Dimensions"><Collection><PropertyPath>Year</PropertyPath><PropertyPath>Region</PropertyPath></Collection></PropertyValue>
    <PropertyValue Property="DimensionAttributes"><Collection><Record><PropertyValue Property="Dimension" PropertyPath="Region"/><PropertyValue Property="Role" EnumMember="UI.ChartDimensionRoleType/Series"/></Record></Collection></PropertyValue>
    <PropertyValue Property="Measures"><Collection><PropertyPath>Amount</PropertyPath></Collection></PropertyValue></Record></Annotation>
</Annotations>
  </Schema></edmx:DataServices>
</edmx:Edmx>`;

const model = buildModel(xml);

/** Records the requests (URL form) the chart sends. */
class Recording extends MemoryProvider {
  urls: string[] = [];
  override async query(req: QueryRequest, o?: { signal?: AbortSignal }) {
    this.urls.push(decodeURIComponent(toQueryString(model, req)));
    return super.query(req, o);
  }
}

function setup(sales: Row[]) {
  const provider = new Recording({ model, data: { Sales: sales } });
  const wrap = (children: ReactNode) => (
    <MantineProvider theme={smartKitMantineTheme}>
      <SmartKitProvider services={{ t: { model, dataProvider: provider, variants: new MemoryVariantStore() } }} locale="en" namespace="al-aggr">{children}</SmartKitProvider>
    </MantineProvider>
  );
  return { provider, wrap };
}

const EUR: Row[] = [
  { ID: '1', Year: '2025', Region: 'N', Amount: 100, Cost: 40, Currency: 'EUR' },
  { ID: '2', Year: '2025', Region: 'S', Amount: 50, Cost: 10, Currency: 'EUR' },
  { ID: '3', Year: '2026', Region: 'N', Amount: 20, Cost: 5, Currency: 'EUR' },
];

const values = (key: string) => [...document.querySelectorAll(`[data-sk-chart-bar="${key}"] rect`)].map((r) => [r.getAttribute('data-sk-chart-series'), Number(r.getAttribute('data-sk-chart-value'))]);

describe('AL-11 P1-3 list report chart: all dimensions and measures (docs/29 §4)', () => {
  it('AL-11 P1-3 requests all measures (custom aggregate by name) grouped by the dimensions and the unit, and draws one series per measure', async () => {
    const { provider, wrap } = setup(EUR);
    render(wrap(<Chart contextPath="/Sales" metaPath="@UI.Chart#Two" />));
    await waitFor(() => expect(document.querySelector('[data-sk-chart-bar="2025"]')).not.toBeNull());
    expect(provider.urls).toEqual(['$apply=groupby((Currency,Year),aggregate(Amount,Cost with sum as Cost))&$count=true']);
    expect(values('2025')).toEqual([['Amount', 150], ['Cost', 50]]);
    expect(values('2026')).toEqual([['Amount', 20], ['Cost', 5]]);
    expect([...document.querySelectorAll('[data-sk-chart-legend]')].map((x) => x.textContent)).toEqual(['Amount', 'Cost']);
  });

  it('AL-11 P1-3 a dimension with the role Series splits the measure into one series per value', async () => {
    const { provider, wrap } = setup(EUR);
    render(wrap(<Chart contextPath="/Sales" metaPath="@UI.Chart#Series" />));
    await waitFor(() => expect(document.querySelector('[data-sk-chart-bar="2025"]')).not.toBeNull());
    expect(provider.urls).toEqual(['$apply=groupby((Currency,Region,Year),aggregate(Amount))&$count=true']);
    expect(values('2025')).toEqual([['Amount\u0001N', 100], ['Amount\u0001S', 50]]);
    expect(values('2026')).toEqual([['Amount\u0001N', 20]]);
    expect([...document.querySelectorAll('[data-sk-chart-legend]')].map((x) => x.textContent)).toEqual(['N', 'S']);
  });

  it('AL-11 P1-3 a measure with different units is not drawn: "Invalid data", as sap.chart in FE', async () => {
    const { wrap } = setup([...EUR, { ID: '4', Year: '2026', Region: 'S', Amount: 7, Cost: 1, Currency: 'USD' }]);
    render(wrap(<Chart contextPath="/Sales" metaPath="@UI.Chart#Two" />));
    expect(await screen.findByText('Invalid data')).toBeInTheDocument();
    expect(screen.getByText('Some measures have different units.')).toBeInTheDocument();
    expect(document.querySelector('[data-sk-chart-bar]')).toBeNull();
  });
});
