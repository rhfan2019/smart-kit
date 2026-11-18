/**
 * Stage 3 (docs/31), D39: totals and group subtotals as Fiori elements 1.154 has them — only the analytical table
 * (sap.fe.core.converters.controls.Common.Table updateTableVisualizationForType / getAggregateConditions / getP13nMode),
 * only for custom aggregates (Aggregation.CustomAggregate), by default all of them when UI.PresentationVariant/Total
 * is missing (an empty Total: none). The unit is aggregated with the measure; a total over several currencies shows
 * "Show Details" with the amounts per currency in a popover (sap.fe.macros FieldRuntime displayAggregateDetails).
 * The responsive table groups without subtotals; the grid table neither groups nor totals.
 * FE comparison: tests/e2e-fe/totals.spec.ts (fe:po-analytical-totals).
 */
import { MantineProvider } from '@mantine/core';
import { buildModel, MemoryProvider, MemoryVariantStore, toQueryString, type MetaModel, type QueryRequest, type Row } from '@rhfan2019/smart-kit-core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { SmartKitProvider } from '../src/context/SmartKitProvider';
import { smartKitMantineTheme } from '../src/theme/mantine';
import Table from '../src/v4/fe/macros/Table';

const xml = (annotations: string) => `<?xml version="1.0"?>
<edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx">
  <edmx:Reference Uri="u"><edmx:Include Namespace="com.sap.vocabularies.UI.v1" Alias="UI"/></edmx:Reference>
  <edmx:Reference Uri="a"><edmx:Include Namespace="Org.OData.Aggregation.V1" Alias="Aggregation"/></edmx:Reference>
  <edmx:Reference Uri="c"><edmx:Include Namespace="com.sap.vocabularies.Common.v1" Alias="Common"/></edmx:Reference>
  <edmx:Reference Uri="m"><edmx:Include Namespace="Org.OData.Measures.V1" Alias="Measures"/></edmx:Reference>
  <edmx:DataServices><Schema xmlns="http://docs.oasis-open.org/odata/ns/edm" Namespace="T">
<EntityType Name="Sale"><Key><PropertyRef Name="ID"/></Key><Property Name="ID" Type="Edm.String" Nullable="false"/>
  <Property Name="Region" Type="Edm.String"/>
  <Property Name="Amount" Type="Edm.Decimal" Scale="0"/><Property Name="Cost" Type="Edm.Decimal" Scale="0"/><Property Name="Currency" Type="Edm.String"/></EntityType>
<EntityContainer Name="C"><EntitySet Name="Sales" EntityType="T.Sale"/></EntityContainer>
<Annotations Target="T.Sale/Region"><Annotation Term="Common.Label" String="Region"/></Annotations>
<Annotations Target="T.Sale/Amount"><Annotation Term="Common.Label" String="Amount"/><Annotation Term="Measures.ISOCurrency" Path="Currency"/></Annotations>
<Annotations Target="T.Sale/Cost"><Annotation Term="Common.Label" String="Cost"/></Annotations>
<Annotations Target="T.Sale">
  <Annotation Term="Aggregation.ApplySupported"><Record><PropertyValue Property="Transformations"><Collection><String>filter</String><String>groupby</String><String>aggregate</String></Collection></PropertyValue></Record></Annotation>
  <Annotation Term="UI.LineItem"><Collection>
    <Record Type="UI.DataField"><PropertyValue Property="Value" Path="ID"/></Record>
    <Record Type="UI.DataField"><PropertyValue Property="Value" Path="Region"/></Record>
    <Record Type="UI.DataField"><PropertyValue Property="Value" Path="Amount"/></Record>
    <Record Type="UI.DataField"><PropertyValue Property="Value" Path="Cost"/></Record>
  </Collection></Annotation>
  ${annotations}
</Annotations>
  </Schema></edmx:DataServices>
</edmx:Edmx>`;

const CUSTOM = '<Annotation Term="Aggregation.CustomAggregate" Qualifier="Amount" String="Edm.Decimal"/><Annotation Term="Aggregation.CustomAggregate" Qualifier="Cost" String="Edm.Decimal"/>';
const sales: Row[] = [
  { ID: '1', Region: 'North', Amount: 10, Cost: 4, Currency: 'EUR' },
  { ID: '2', Region: 'North', Amount: 5, Cost: 1, Currency: 'EUR' },
  { ID: '3', Region: 'South', Amount: 7, Cost: 2, Currency: 'USD' },
];

function setup(model: MetaModel) {
  const provider = new MemoryProvider({ model, data: { Sales: structuredClone(sales) } });
  const urls: string[] = [];
  const query = provider.query.bind(provider);
  provider.query = (req: QueryRequest, o?: { signal?: AbortSignal }) => { urls.push(decodeURIComponent(toQueryString(model, req))); return query(req, o); };
  const wrap = (children: ReactNode) => (
    <MantineProvider theme={smartKitMantineTheme}>
      <SmartKitProvider services={{ t: { model, dataProvider: provider, variants: new MemoryVariantStore() } }} locale="en" namespace="al-totals">{children}</SmartKitProvider>
    </MantineProvider>
  );
  return { urls, wrap };
}

const applies = (urls: string[]) => urls.filter((u) => u.includes('$apply='));
const settle = () => new Promise((r) => setTimeout(r, 50));

describe('AL-11 D39 totals only in the analytical table (FE updateTableVisualizationForType)', () => {
  it('AL-11 D39 analytical table without PresentationVariant/Total totals all custom aggregates (FE getAggregateConditions)', async () => {
    const model = buildModel(xml(CUSTOM));
    const { urls, wrap } = setup(model);
    render(wrap(<Table service="t" contextPath="/Sales" type="AnalyticalTable" rowCountMode="Fixed" enableExport={false} />));
    // AL-10: the grand total is read with the rows and the count in one $apply (FE _AggregationHelper buildApply)
    await waitFor(() => expect(applies(urls)).toEqual(['$apply=concat(aggregate(Amount,Currency,Cost),groupby((ID,Region),aggregate(Amount,Currency,Cost))/concat(aggregate($count as UI5__count),top(10)))']));
    await waitFor(() => expect(document.querySelector('[data-sk-total="Amount"]')).not.toBeNull());
    expect(document.querySelector('[data-sk-total="Cost"]')?.textContent).toContain('7');
  });

  it('AL-11 D39 a total over several currencies shows "Show Details"; the popover lists the amount per currency', async () => {
    const model = buildModel(xml(CUSTOM));
    const { urls, wrap } = setup(model);
    render(wrap(<Table service="t" contextPath="/Sales" type="AnalyticalTable" rowCountMode="Fixed" enableExport={false} />));
    const link = await screen.findByRole('button', { name: 'Show Details' });
    expect(link.closest('[data-sk-total="Amount"]')).toHaveAttribute('data-sk-total-multi-unit');
    fireEvent.click(link);
    await waitFor(() => expect(applies(urls)).toContain('$apply=groupby((Currency),aggregate(Amount))&$orderby=Currency&$top=100'));
    expect(await screen.findByText('Totals')).toBeInTheDocument();
    await waitFor(() => expect([...document.querySelectorAll('[data-sk-total-unit-line]')].map((e) => e.textContent)).toEqual(['15.00 EUR', '7.00 USD']));
  });

  it('AL-11 D39 a single currency is shown with the total', async () => {
    const model = buildModel(xml(CUSTOM));
    const { wrap } = setup(model);
    render(wrap(<Table service="t" contextPath="/Sales" type="AnalyticalTable" rowCountMode="Fixed" enableExport={false} query={{ filters: { Region: [{ operator: 'EQ', values: ['North'] }] } }} />));
    await waitFor(() => expect(document.querySelector('[data-sk-total="Amount"]')?.textContent).toBe('15.00 EUR'));
    expect(screen.queryByRole('button', { name: 'Show Details' })).toBeNull();
  });

  it('AL-11 D39 an empty PresentationVariant/Total totals nothing (FE getAggregateConditions)', async () => {
    const model = buildModel(xml(`${CUSTOM}<Annotation Term="UI.PresentationVariant"><Record><PropertyValue Property="Total"><Collection/></PropertyValue>
      <PropertyValue Property="Visualizations"><Collection><AnnotationPath>@UI.LineItem</AnnotationPath></Collection></PropertyValue></Record></Annotation>`));
    expect(model.ui['T.Sale']!.presentation).toMatchObject({ total: [], hasTotal: true });
    const { urls, wrap } = setup(model);
    render(wrap(<Table service="t" contextPath="/Sales" type="AnalyticalTable" rowCountMode="Fixed" enableExport={false} />));
    await waitFor(() => expect(urls.length).toBeGreaterThan(0));
    await settle();
    // the rows still come from $apply (AL-10), without a grand total
    expect(applies(urls)).toEqual(['$apply=groupby((ID,Region),aggregate(Amount,Currency,Cost))/concat(aggregate($count as UI5__count),top(10))']);
    expect(document.querySelector('[data-sk-total]')).toBeNull();
  });

  it('AL-11 D39 analytical table with PresentationVariant/Total totals only the listed custom aggregates', async () => {
    const model = buildModel(xml(`${CUSTOM}<Annotation Term="UI.PresentationVariant"><Record><PropertyValue Property="Total"><Collection><PropertyPath>Amount</PropertyPath></Collection></PropertyValue>
      <PropertyValue Property="Visualizations"><Collection><AnnotationPath>@UI.LineItem</AnnotationPath></Collection></PropertyValue></Record></Annotation>`));
    const { urls, wrap } = setup(model);
    render(wrap(<Table service="t" contextPath="/Sales" type="AnalyticalTable" rowCountMode="Fixed" enableExport={false} />));
    await waitFor(() => expect(applies(urls)).toEqual(['$apply=concat(aggregate(Amount,Currency),groupby((ID,Region),aggregate(Amount,Currency,Cost))/concat(aggregate($count as UI5__count),top(10)))']));
  });

  it('AL-11 D39 no custom aggregate: no totals, even for numeric aggregatable properties (no "with sum" fallback)', async () => {
    const model = buildModel(xml(''));
    const { urls, wrap } = setup(model);
    render(wrap(<Table service="t" contextPath="/Sales" type="AnalyticalTable" rowCountMode="Fixed" enableExport={false} />));
    await waitFor(() => expect(urls.length).toBeGreaterThan(0));
    await settle();
    // no aggregate: the rows are grouped by everything they show (AL-10), no grand total
    expect(applies(urls)).toEqual(['$apply=groupby((Amount,Cost,Currency,ID,Region))/concat(aggregate($count as UI5__count),top(10))']);
    expect(document.querySelector('[data-sk-total]')).toBeNull();
  });

  it('AL-11 D39 grid table: no totals request and no totals row', async () => {
    const model = buildModel(xml(CUSTOM));
    const { urls, wrap } = setup(model);
    render(wrap(<Table service="t" contextPath="/Sales" type="GridTable" rowCountMode="Fixed" enableExport={false} />));
    await waitFor(() => expect(urls.length).toBeGreaterThan(0));
    await settle();
    expect(applies(urls)).toEqual([]);
    expect(document.querySelector('[data-sk-total]')).toBeNull();
  });

  it('AL-11 D39 responsive table: groups by PresentationVariant/GroupBy without subtotals or counts, no totals row', async () => {
    const model = buildModel(xml(`${CUSTOM}<Annotation Term="UI.PresentationVariant"><Record><PropertyValue Property="GroupBy"><Collection><PropertyPath>Region</PropertyPath></Collection></PropertyValue>
      <PropertyValue Property="Total"><Collection><PropertyPath>Amount</PropertyPath></Collection></PropertyValue>
      <PropertyValue Property="Visualizations"><Collection><AnnotationPath>@UI.LineItem</AnnotationPath></Collection></PropertyValue></Record></Annotation>`));
    const { urls, wrap } = setup(model);
    render(wrap(<Table service="t" contextPath="/Sales" type="ResponsiveTable" enableExport={false} />));
    await waitFor(() => expect(document.querySelectorAll('[data-sk-group-row]').length).toBe(2));
    await settle();
    expect(urls.some((u) => u.includes('$orderby=Region'))).toBe(true);
    expect(applies(urls)).toEqual([]);
    expect(document.querySelector('[data-sk-group-count]')).toBeNull();
    expect(document.querySelector('[data-sk-total-row]')).toBeNull();
  });
});
