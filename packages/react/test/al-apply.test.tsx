/**
 * Stage 4 tail: the analytical table reads its rows as Fiori elements 1.154 does (sap.ui.mdc.odata.v4.TableDelegate
 * create$$Aggregation, sap.ui.model.odata.v4.lib._AggregationHelper buildApply, _ConcatHelper): grand total, count and
 * the first rows in one $apply; what the rows of that page lack is read per row once rendered; what only a toolbar
 * action needs (its Core.OperationAvailable) is read when a row is selected. FE comparison: tests/e2e-fe/apply.spec.ts.
 */
import { MantineProvider } from '@mantine/core';
import { buildModel, MemoryProvider, MemoryVariantStore, toQueryString, readQueryString, type MetaModel, type QueryRequest, type ReadRequest, type Row } from '@rhfan2019/smart-kit-core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { SmartKitProvider } from '../src/context/SmartKitProvider';
import { smartKitMantineTheme } from '../src/theme/mantine';
import Table from '../src/v4/fe/macros/Table';

const xml = `<?xml version="1.0"?>
<edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx">
  <edmx:Reference Uri="u"><edmx:Include Namespace="com.sap.vocabularies.UI.v1" Alias="UI"/></edmx:Reference>
  <edmx:Reference Uri="a"><edmx:Include Namespace="Org.OData.Aggregation.V1" Alias="Aggregation"/></edmx:Reference>
  <edmx:Reference Uri="c"><edmx:Include Namespace="com.sap.vocabularies.Common.v1" Alias="Common"/></edmx:Reference>
  <edmx:Reference Uri="o"><edmx:Include Namespace="Org.OData.Core.V1" Alias="Core"/></edmx:Reference>
  <edmx:Reference Uri="m"><edmx:Include Namespace="Org.OData.Measures.V1" Alias="Measures"/></edmx:Reference>
  <edmx:DataServices><Schema xmlns="http://docs.oasis-open.org/odata/ns/edm" Namespace="T">
<EntityType Name="Sale"><Key><PropertyRef Name="ID"/></Key><Property Name="ID" Type="Edm.String" Nullable="false"/>
  <Property Name="Region" Type="Edm.String"/><Property Name="Note" Type="Edm.String"/><Property Name="CanBook" Type="Edm.Boolean"/>
  <Property Name="Amount" Type="Edm.Decimal" Scale="0"/><Property Name="Currency" Type="Edm.String"/></EntityType>
<Action Name="book" IsBound="true"><Parameter Name="_it" Type="T.Sale"/></Action>
<EntityContainer Name="C"><EntitySet Name="Sales" EntityType="T.Sale"/></EntityContainer>
<Annotations Target="T.Sale/Region"><Annotation Term="Common.Label" String="Region"/></Annotations>
<Annotations Target="T.Sale/Note"><Annotation Term="Common.Label" String="Note"/></Annotations>
<Annotations Target="T.Sale/Amount"><Annotation Term="Common.Label" String="Amount"/><Annotation Term="Measures.ISOCurrency" Path="Currency"/></Annotations>
<Annotations Target="T.book(T.Sale)"><Annotation Term="Core.OperationAvailable" Path="_it/CanBook"/></Annotations>
<Annotations Target="T.Sale">
  <Annotation Term="Aggregation.ApplySupported"><Record>
    <PropertyValue Property="Transformations"><Collection><String>filter</String><String>groupby</String><String>aggregate</String></Collection></PropertyValue>
    <PropertyValue Property="GroupableProperties"><Collection><PropertyPath>Region</PropertyPath></Collection></PropertyValue>
  </Record></Annotation>
  <Annotation Term="Aggregation.CustomAggregate" Qualifier="Amount" String="Edm.Decimal"/>
  <Annotation Term="UI.LineItem"><Collection>
    <Record Type="UI.DataFieldForAction"><PropertyValue Property="Label" String="Book"/><PropertyValue Property="Action" String="T.book"/></Record>
    <Record Type="UI.DataField"><PropertyValue Property="Value" Path="ID"/></Record>
    <Record Type="UI.DataField"><PropertyValue Property="Value" Path="Region"/></Record>
    <Record Type="UI.DataField"><PropertyValue Property="Value" Path="Note"/></Record>
    <Record Type="UI.DataField"><PropertyValue Property="Value" Path="Amount"/></Record>
  </Collection></Annotation>
</Annotations>
  </Schema></edmx:DataServices>
</edmx:Edmx>`;

const sales: Row[] = [
  { ID: '1', Region: 'North', Note: 'first', CanBook: true, Amount: 10, Currency: 'EUR' },
  { ID: '2', Region: 'South', Note: 'second', CanBook: false, Amount: 5, Currency: 'EUR' },
];

function setup(model: MetaModel) {
  const provider = new MemoryProvider({ model, data: { Sales: structuredClone(sales) } });
  const urls: string[] = [];
  const query = provider.query.bind(provider);
  provider.query = (req: QueryRequest, o?: { signal?: AbortSignal }) => { urls.push(decodeURIComponent(toQueryString(model, req))); return query(req, o); };
  const read = provider.read.bind(provider);
  provider.read = (path, req: ReadRequest, o) => { urls.push(`${String(path)}?${decodeURIComponent(readQueryString(req))}`); return read(path, req, o); };
  const wrap = (children: ReactNode) => (
    <MantineProvider theme={smartKitMantineTheme}>
      <SmartKitProvider services={{ t: { model, dataProvider: provider, variants: new MemoryVariantStore() } }} locale="en" namespace="al-apply">{children}</SmartKitProvider>
    </MantineProvider>
  );
  return { urls, wrap };
}

describe('AL-10 AL-11 AL-12 apply: analytical table request shape', () => {
  it('AL-10 AL-11 AL-12 apply: one $apply for grand total, count and rows; the rows read what they lack per row', async () => {
    const model = buildModel(xml);
    const { urls, wrap } = setup(model);
    render(wrap(<Table service="t" contextPath="/Sales" type="AnalyticalTable" rowCountMode="Fixed" enableExport={false} />));
    await waitFor(() => expect(urls[0]).toBe('$apply=concat(aggregate(Amount,Currency),groupby((ID,Region),aggregate(Amount,Currency))/concat(aggregate($count as UI5__count),top(10)))'));
    // the grand total from that request (one currency)
    await waitFor(() => expect(document.querySelector('[data-sk-total="Amount"]')?.textContent).toBe('15.00 EUR'));
    // Note is neither grouped nor aggregated: read per row (late property); CanBook only for the toolbar action: not yet
    await waitFor(() => expect(urls).toContain("Sales('1')?$select=Note"));
    expect(urls).toContain("Sales('2')?$select=Note");
    await waitFor(() => expect(screen.getByText('first')).toBeInTheDocument());
    expect(urls.filter((u) => u.includes('$apply='))).toHaveLength(1);
    expect(urls.some((u) => u.includes('CanBook'))).toBe(false);
  });

  it('AL-10 AL-11 AL-12 apply: selecting a row reads the availability of the toolbar action (FE ActionRuntime)', async () => {
    const model = buildModel(xml);
    const { urls, wrap } = setup(model);
    render(wrap(<Table service="t" contextPath="/Sales" type="AnalyticalTable" rowCountMode="Fixed" enableExport={false} selectionMode="Multi" />));
    await waitFor(() => expect(screen.getByText('first')).toBeInTheDocument());
    const book = await screen.findByRole('button', { name: 'Book' });
    const box = document.querySelector('.ag-row[row-index="0"] input[type="checkbox"]') as HTMLInputElement;
    fireEvent.click(box);
    await waitFor(() => expect(urls).toContain("Sales('1')?$select=CanBook"));
    await waitFor(() => expect(book).toBeEnabled());
  });
});
