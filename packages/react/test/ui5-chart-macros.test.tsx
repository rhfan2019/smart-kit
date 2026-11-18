import { MantineProvider } from '@mantine/core';
import { buildModel, createMessage, MemoryProvider, MemoryVariantStore, type Row } from '@rhfan2019/smart-kit-core';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef, useEffect, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { SmartKitProvider } from '../src/context/SmartKitProvider';
import { smartKitMantineTheme } from '../src/theme/mantine';
import useMessages from '../src/kit/useMessages';
import MessageProvider from '../src/kit/MessageProvider';
import Chart from '../src/v4/fe/macros/Chart';
import MessageButton from '../src/v4/fe/macros/MessageButton';
import MicroChart from '../src/v4/fe/macros/MicroChart';

const xml = `<?xml version="1.0"?>
<edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx">
  <edmx:Reference Uri="u"><edmx:Include Namespace="com.sap.vocabularies.UI.v1" Alias="UI"/></edmx:Reference>
  <edmx:Reference Uri="m"><edmx:Include Namespace="Org.OData.Measures.V1" Alias="Measures"/></edmx:Reference>
  <edmx:DataServices><Schema xmlns="http://docs.oasis-open.org/odata/ns/edm" Namespace="T">
<EntityType Name="Order"><Key><PropertyRef Name="ID"/></Key><Property Name="ID" Type="Edm.String" Nullable="false"/><Property Name="Status" Type="Edm.String"/>
  <Property Name="Amount" Type="Edm.Decimal" Scale="0"/><Property Name="Budget" Type="Edm.Decimal" Scale="0"/><Property Name="Currency" Type="Edm.String"/>
  <NavigationProperty Name="Items" Type="Collection(T.Item)"/></EntityType>
<EntityType Name="Item"><Key><PropertyRef Name="Pos"/></Key><Property Name="Pos" Type="Edm.Int32" Nullable="false"/><Property Name="Qty" Type="Edm.Decimal"/></EntityType>
<EntityContainer Name="C"><EntitySet Name="Orders" EntityType="T.Order"><NavigationPropertyBinding Path="Items" Target="Items"/></EntitySet><EntitySet Name="Items" EntityType="T.Item"/></EntityContainer>
<Annotations Target="T.Order/Amount"><Annotation Term="Measures.ISOCurrency" Path="Currency"/></Annotations>
<Annotations Target="T.Order">
  <Annotation Term="UI.DataPoint" Qualifier="Amount"><Record><PropertyValue Property="Value" Path="Amount"/><PropertyValue Property="TargetValue" Path="Budget"/></Record></Annotation>
  <Annotation Term="UI.Chart" Qualifier="ByStatus"><Record><PropertyValue Property="Title" String="Amount by status"/><PropertyValue Property="ChartType" EnumMember="UI.ChartType/Column"/>
    <PropertyValue Property="Dimensions"><Collection><PropertyPath>Status</PropertyPath></Collection></PropertyValue><PropertyValue Property="Measures"><Collection><PropertyPath>Amount</PropertyPath></Collection></PropertyValue></Record></Annotation>
  <Annotation Term="UI.Chart" Qualifier="Budget"><Record><PropertyValue Property="Title" String="Budget used"/><PropertyValue Property="ChartType" EnumMember="UI.ChartType/Bullet"/>
    <PropertyValue Property="Measures"><Collection><PropertyPath>Amount</PropertyPath></Collection></PropertyValue>
    <PropertyValue Property="MeasureAttributes"><Collection><Record Type="UI.ChartMeasureAttributeType"><PropertyValue Property="Measure" PropertyPath="Amount"/><PropertyValue Property="DataPoint" AnnotationPath="@UI.DataPoint#Amount"/></Record></Collection></PropertyValue></Record></Annotation>
</Annotations>
<Annotations Target="T.Item">
  <Annotation Term="UI.Chart" Qualifier="Trend"><Record><PropertyValue Property="Title" String="Quantities"/><PropertyValue Property="ChartType" EnumMember="UI.ChartType/Column"/>
    <PropertyValue Property="Dimensions"><Collection><PropertyPath>Pos</PropertyPath></Collection></PropertyValue><PropertyValue Property="Measures"><Collection><PropertyPath>Qty</PropertyPath></Collection></PropertyValue></Record></Annotation>
</Annotations>
  </Schema></edmx:DataServices>
</edmx:Edmx>`;

const model = buildModel(xml);
const data: Record<string, Row[]> = {
  Orders: [
    { ID: '1', Status: 'A', Amount: 100, Budget: 200, Currency: 'EUR', Items: [{ Pos: 1, Qty: 3 }, { Pos: 2, Qty: 5 }] },
    { ID: '2', Status: 'B', Amount: 50, Budget: 80, Currency: 'EUR', Items: [] },
    { ID: '3', Status: 'A', Amount: 20, Budget: 10, Currency: 'EUR', Items: [] },
  ],
  Items: [],
};

function wrap(children: ReactNode) {
  return (
    <MantineProvider theme={smartKitMantineTheme}>
      <SmartKitProvider services={{ t: { model, dataProvider: new MemoryProvider({ model, data }), variants: new MemoryVariantStore() } }} locale="en" namespace="test">
        {children}
      </SmartKitProvider>
    </MantineProvider>
  );
}

const bar = (key: string) => document.querySelector(`[data-sk-chart-bar="${key}"]`)!;

describe('sap.fe.macros.Chart (stage 2)', () => {
  it('AL-05 Chart: header defaults to the UI.Chart Title, headerVisible defaults to true', async () => {
    const { rerender } = render(wrap(<Chart contextPath="/Orders" metaPath="@com.sap.vocabularies.UI.v1.Chart#ByStatus" />));
    expect(screen.getByRole('heading', { name: 'Amount by status' })).toBeInTheDocument();
    await waitFor(() => expect(bar('A')).not.toBeNull());
    rerender(wrap(<Chart contextPath="/Orders" metaPath="@UI.Chart#ByStatus" header="Orders" headerVisible={false} actions={<button type="button">Act</button>} />));
    expect(screen.queryByRole('heading')).toBeNull();
    expect(screen.getByRole('button', { name: 'Act' })).toBeInTheDocument();
  });

  it('AL-05 Chart: selectionMode defaults to Multiple; Single replaces, None makes the points not selectable', async () => {
    const user = userEvent.setup();
    const { rerender, unmount } = render(wrap(<Chart contextPath="/Orders" metaPath="@UI.Chart#ByStatus" />));
    await waitFor(() => expect(bar('A')).not.toBeNull());
    await user.click(bar('A'));
    await user.click(bar('B'));
    expect(bar('A')).toHaveAttribute('aria-pressed', 'true');
    expect(bar('B')).toHaveAttribute('aria-pressed', 'true');
    unmount();
    render(wrap(<Chart contextPath="/Orders" metaPath="@UI.Chart#ByStatus" selectionMode="Single" />));
    await waitFor(() => expect(bar('A')).not.toBeNull());
    await user.click(bar('A'));
    await user.click(bar('B'));
    expect(bar('A')).toHaveAttribute('aria-pressed', 'false');
    expect(bar('B')).toHaveAttribute('aria-pressed', 'true');
    void rerender;
  });

  it('AL-05 Chart: selectionMode None', async () => {
    render(wrap(<Chart contextPath="/Orders" metaPath="@UI.Chart#ByStatus" selectionMode="None" />));
    await waitFor(() => expect(document.querySelector('[data-sk-chart-bar="A"]')).not.toBeNull());
    expect(bar('A')).not.toHaveAttribute('role', 'button');
  });

  it('AL-06 Chart: selectionChange carries data and selected', async () => {
    const onSelectionChange = vi.fn();
    const user = userEvent.setup();
    render(wrap(<Chart contextPath="/Orders" metaPath="@UI.Chart#ByStatus" onSelectionChange={onSelectionChange} />));
    await waitFor(() => expect(bar('A')).not.toBeNull());
    await user.click(bar('A'));
    expect(onSelectionChange).toHaveBeenLastCalledWith({ data: [{ data: { Status: 'A', Amount: 120 } }], selected: true });
    await user.click(bar('A'));
    expect(onSelectionChange).toHaveBeenLastCalledWith({ data: [{ data: { Status: 'A', Amount: 120 } }], selected: false });
  });

  it('AL-07 Chart: getSelectedContexts, getSelectionVariant and setSelectionVariant', async () => {
    const ref = createRef<Chart>();
    const user = userEvent.setup();
    render(wrap(<Chart ref={ref} contextPath="/Orders" metaPath="@UI.Chart#ByStatus" query={{ filters: {} }} />));
    await waitFor(() => expect(bar('B')).not.toBeNull());
    await user.click(bar('B'));
    expect(ref.current!.getSelectedContexts()).toEqual([expect.objectContaining({ Status: 'B', Amount: 50 })]);
    expect(await ref.current!.getSelectionVariant()).toEqual({ SelectionVariantID: '', SelectOptions: [] });
    await act(() => ref.current!.setSelectionVariant({ SelectOptions: [{ PropertyName: 'Status', Ranges: [{ Sign: 'I', Option: 'EQ', Low: 'A' }] }] }));
    await waitFor(() => expect(document.querySelector('[data-sk-chart-bar="B"]')).toBeNull());
    expect(bar('A')).not.toBeNull();
    expect((await ref.current!.getSelectionVariant()).SelectOptions).toEqual([{ PropertyName: 'Status', Ranges: [{ Sign: 'I', Option: 'EQ', Low: 'A', High: null }] }]);
  });

  it('query null: not executed yet', () => {
    render(wrap(<Chart contextPath="/Orders" metaPath="@UI.Chart#ByStatus" query={null} />));
    expect(screen.getByText('To start, set the relevant filters.')).toBeInTheDocument();
  });
});

describe('sap.fe.macros.MicroChart (stage 2)', () => {
  const order = data.Orders![0]!;

  it('AL-05 MicroChart: showOnlyChart defaults to false (title and unit shown); true shows only the chart', () => {
    const { rerender } = render(wrap(<MicroChart contextPath="/Orders" metaPath="@UI.Chart#Budget" row={order} />));
    const block = document.querySelector('[data-sk-microchart-block="Budget"]')!;
    expect(block.querySelector('.sk-facet__title')).toHaveTextContent('Budget used');
    expect(block.querySelector('[data-sk-facet-footer]')).toHaveTextContent('EUR');
    expect(screen.getByRole('img', { name: /^Budget used: Actual 100/ })).toBeInTheDocument();
    rerender(wrap(<MicroChart contextPath="/Orders" metaPath="@UI.Chart#Budget" row={order} showOnlyChart />));
    expect(document.querySelector('[data-sk-microchart-block]')).toBeNull();
    expect(screen.getByRole('img', { name: /^Budget used:/ })).toBeInTheDocument();
  });

  it('AL-05 MicroChart: size sets a fixed box; hideOnNoData renders nothing without data', () => {
    const { container, rerender } = render(wrap(<MicroChart contextPath="/Orders" metaPath="@UI.Chart#Budget" row={order} size="S" showOnlyChart />));
    expect(container.querySelector('.sk-microchart')?.classList.contains('sk-microchart--size-S')).toBe(true);
    rerender(wrap(<MicroChart contextPath="/Orders" metaPath="@UI.Chart#Budget" row={{ ID: 'x' }} hideOnNoData />));
    expect(container.querySelector('.sk-microchart')).toBeNull();
  });

  it('AL-06 MicroChart: titleAsLink fires titlePress; linkAriaText names the link', async () => {
    const onTitlePress = vi.fn();
    render(wrap(<MicroChart contextPath="/Orders" metaPath="@UI.Chart#Budget" row={order} titleAsLink linkAriaText="Open budget" onTitlePress={onTitlePress} />));
    await userEvent.setup().click(screen.getByRole('button', { name: 'Open budget' }));
    expect(onTitlePress).toHaveBeenCalledTimes(1);
  });

  it('metaPath over a collection navigation: the expanded items of the row', () => {
    render(wrap(<MicroChart contextPath="/Orders" metaPath="Items/@com.sap.vocabularies.UI.v1.Chart#Trend" row={order} />));
    expect(document.querySelector('[data-sk-microchart-block="Trend"] .sk-facet__subtitle')).toHaveTextContent('Qty by Pos');
    expect(screen.getByRole('img', { name: /^Quantities:/ }).querySelectorAll('[data-sk-microchart-bar]')).toHaveLength(2);
  });

  it('without metaPath the data props draw the chart', () => {
    render(wrap(<MicroChart kind="bullet" label="Budget" value={10} target={20} />));
    expect(screen.getByRole('img', { name: /^Budget: Actual 10/ })).toBeInTheDocument();
  });
});

describe('sap.fe.macros.MessageButton (stage 2)', () => {
  it('AL-06 MessageButton: visibilityChange reports visible when messages come and go', async () => {
    const onVisibilityChange = vi.fn();
    let api: ReturnType<typeof useMessages> = null;
    function Grab() {
      const m = useMessages();
      useEffect(() => { api = m; });
      return null;
    }
    render(wrap(<MessageProvider><Grab /><MessageButton onVisibilityChange={onVisibilityChange} /></MessageProvider>));
    expect(onVisibilityChange).not.toHaveBeenCalled();
    act(() => api!.add([createMessage('error', 'Wrong')]));
    expect(onVisibilityChange).toHaveBeenLastCalledWith({ visible: true });
    act(() => api!.clear());
    expect(onVisibilityChange).toHaveBeenLastCalledWith({ visible: false });
    expect(onVisibilityChange).toHaveBeenCalledTimes(2);
  });
});
