import { MantineProvider } from '@mantine/core';
import { buildModel, MemoryProvider, MemoryVariantStore, type NavigationAdapter, type Row } from '@rhfan2019/smart-kit-core';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef, type ReactNode, type Ref } from 'react';
import { describe, expect, it } from 'vitest';
import { SmartKitProvider } from '../src/context/SmartKitProvider';
import { smartKitMantineTheme } from '../src/theme/mantine';
import type { Chart as ChartInstance } from '../src/list/ChartView';
import type { FilterBar as FilterBarInstance } from '../src/filter/FilterBar';
import Chart from '../src/v4/fe/macros/Chart';
import Field from '../src/v4/fe/macros/Field';
import FilterBar from '../src/v4/fe/macros/FilterBar';
import useFilterState from '../src/kit/useFilterState';
import { useVariants } from '../src/variants/useVariants';

const xml = `<?xml version="1.0"?>
<edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx">
  <edmx:Reference Uri="u"><edmx:Include Namespace="com.sap.vocabularies.UI.v1" Alias="UI"/></edmx:Reference>
  <edmx:Reference Uri="m"><edmx:Include Namespace="Org.OData.Measures.V1" Alias="Measures"/></edmx:Reference>
  <edmx:Reference Uri="a"><edmx:Include Namespace="Org.OData.Aggregation.V1" Alias="Aggregation"/></edmx:Reference>
  <edmx:Reference Uri="c"><edmx:Include Namespace="com.sap.vocabularies.Common.v1" Alias="Common"/></edmx:Reference>
  <edmx:DataServices><Schema xmlns="http://docs.oasis-open.org/odata/ns/edm" Namespace="T">
<EntityType Name="Order"><Key><PropertyRef Name="ID"/></Key><Property Name="ID" Type="Edm.String" Nullable="false"/><Property Name="Status" Type="Edm.String"/>
  <Property Name="Amount" Type="Edm.Decimal" Scale="0"/><Property Name="Budget" Type="Edm.Decimal" Scale="0"/><Property Name="Currency" Type="Edm.String"/>
  <NavigationProperty Name="Items" Type="Collection(T.Item)"/></EntityType>
<EntityType Name="Item"><Key><PropertyRef Name="Pos"/></Key><Property Name="Pos" Type="Edm.Int32" Nullable="false"/><Property Name="Qty" Type="Edm.Decimal"/></EntityType>
<EntityContainer Name="C"><EntitySet Name="Orders" EntityType="T.Order"><NavigationPropertyBinding Path="Items" Target="Items"/></EntitySet><EntitySet Name="Items" EntityType="T.Item"/></EntityContainer>
<Annotations Target="T.Order/Amount"><Annotation Term="Measures.ISOCurrency" Path="Currency"/></Annotations>
<Annotations Target="T.Order/Status"><Annotation Term="Common.SemanticObject" String="OrderStatus"/></Annotations>
<Annotations Target="T.Order/ID"><Annotation Term="Common.Label" String="Order"/></Annotations>
<Annotations Target="T.Order">
  <Annotation Term="Aggregation.CustomAggregate" Qualifier="Amount" String="Edm.Decimal"/>
  <Annotation Term="Aggregation.CustomAggregate" Qualifier="Budget" String="Edm.Decimal"/>
  <!-- stage 4: FE renders a chart only with Aggregation.ApplySupported (Chart createChartVisualization) -->
  <Annotation Term="Aggregation.ApplySupported"><Record><PropertyValue Property="Transformations"><Collection><String>filter</String><String>groupby</String><String>aggregate</String></Collection></PropertyValue></Record></Annotation>
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
    { ID: '1', Status: 'A', Amount: 100, Budget: 200, Currency: 'EUR', Items: [] },
    { ID: '2', Status: 'B', Amount: 50, Budget: 80, Currency: 'EUR', Items: [] },
    { ID: '3', Status: 'A', Amount: 20, Budget: 10, Currency: 'EUR', Items: [] },
  ],
  Items: [],
};

function wrap(children: ReactNode, o: { variants?: MemoryVariantStore; navigation?: NavigationAdapter } = {}) {
  return (
    <MantineProvider theme={smartKitMantineTheme}>
      <SmartKitProvider services={{ t: { model, dataProvider: new MemoryProvider({ model, data }), variants: o.variants ?? new MemoryVariantStore() } }} locale="en" namespace="test" navigation={o.navigation}>
        {children}
      </SmartKitProvider>
    </MantineProvider>
  );
}

const META = '@com.sap.vocabularies.UI.v1.Chart#ByStatus';
const view = () => document.querySelector('[data-sk-chart-view]')!;

describe('sap.fe.macros.Chart personalization, variants and presentation variant (stage 6)', () => {
  it('AL-05 Chart: personalization defaults to true (Type, Item, Sort, Filter); false and a list limit the buttons', async () => {
    const { rerender } = render(wrap(<Chart contextPath="/Orders" metaPath={META} />));
    await waitFor(() => expect(view().querySelector('[data-sk-chart-type-button="Column"]')).not.toBeNull());
    expect(view().querySelector('[data-sk-chart-view-by]')).not.toBeNull();
    expect(view().querySelector('[data-sk-chart-settings]')).not.toBeNull();
    rerender(wrap(<Chart contextPath="/Orders" metaPath={META} personalization={false} />));
    expect(view().querySelector('[data-sk-chart-type-button]')).toBeNull();
    expect(view().querySelector('[data-sk-chart-settings]')).toBeNull();
    rerender(wrap(<Chart contextPath="/Orders" metaPath={META} personalization="Sort" />));
    expect(view().querySelector('[data-sk-chart-type-button]')).toBeNull();
    expect(view().querySelector('[data-sk-chart-view-by]')).toBeNull();
    expect(view().querySelector('[data-sk-chart-settings]')).not.toBeNull();
    // the list report's default (FE getP13nMode): Sort, Type, Item — no Filter panel
    rerender(wrap(<Chart contextPath="/Orders" metaPath={META} personalization="Sort,Type,Item" />));
    await userEvent.click(view().querySelector('[data-sk-chart-settings]')!);
    const dialog = await screen.findByRole('dialog');
    expect([...dialog.querySelectorAll('[data-sk-p13n-tab]')].map((x) => x.textContent)).toEqual(['Chart', 'Sort']);
  });

  it('AL-07 Chart: getPresentationVariant returns the JSON form FE writes; setPresentationVariant applies type, items and sort', async () => {
    const ref = createRef<ChartInstance>();
    render(wrap(<Chart contextPath="/Orders" metaPath={META} ref={ref as Ref<ChartInstance>} />));
    await waitFor(() => expect(document.querySelector('[data-sk-chart-bar="A"]')).not.toBeNull());
    expect(await ref.current!.getPresentationVariant()).toEqual({
      Version: { Major: '1', Minor: '0', Patch: '0' }, PresentationVariantID: '', Text: 'Presentation Variant with ID ', SortOrder: [],
      Visualizations: [{
        Content: {
          ChartType: 'com.sap.vocabularies.UI.v1.ChartType/Column',
          DimensionAttributes: [{ Dimension: 'Status', Role: 'com.sap.vocabularies.UI.v1.ChartDimensionRoleType/Category' }], Dimensions: ['Status'],
          MeasureAttributes: [{ Measure: 'Amount', Role: 'com.sap.vocabularies.UI.v1.ChartDimensionRoleType/Axis1' }], Measures: ['Amount'],
        },
        Type: 'Chart',
      }],
    });
    // FE's own form of the type ("Stacked_column") and a UI.ChartType member are both accepted; unknown measures are dropped
    await act(() => ref.current!.setPresentationVariant({ PresentationVariantID: '', SortOrder: [{ Property: 'Amount', Descending: true }], Visualizations: [{ Type: 'Chart', Content: { ChartType: 'com.sap.vocabularies.UI.v1.ChartType/Stacked_column', Measures: ['Budget', 'Nope'] } }] }));
    await waitFor(() => expect(view().getAttribute('data-sk-chart-type')).toBe('stacked_column'));
    const pv = await ref.current!.getPresentationVariant();
    expect(pv.SortOrder).toEqual([{ Property: 'Amount', Descending: true }]);
    expect((pv.Visualizations![0]!.Content as { Measures: string[]; ChartType: string })).toMatchObject({ Measures: ['Budget'], ChartType: 'com.sap.vocabularies.UI.v1.ChartType/Stacked_column' });
    await act(() => ref.current!.setPresentationVariant({ PresentationVariantID: '', Visualizations: [{ Type: 'Chart', Content: { ChartType: 'Line' } }] }));
    await waitFor(() => expect(view().getAttribute('data-sk-chart-type')).toBe('line'));
  });

  it('AL-06 Chart: the chart type button and "View By" change the chart; the settings dialog sorts', async () => {
    const user = userEvent.setup();
    render(wrap(<Chart contextPath="/Orders" metaPath={META} />));
    await waitFor(() => expect(document.querySelector('[data-sk-chart-bar="A"]')).not.toBeNull());
    await user.click(view().querySelector('[data-sk-chart-type-button]')!);
    await user.click(await screen.findByRole('menuitem', { name: 'Bar Chart' }, { timeout: 5000 }));
    await waitFor(() => expect(view().getAttribute('data-sk-chart-type')).toBe('bar'));
    // the type menu closes with a transition; under a loaded test run the View By menu can take longer than 1 s
    await waitFor(() => expect(screen.queryByRole('menuitem', { name: 'Bar Chart' })).toBeNull(), { timeout: 5000 });
    await user.click(view().querySelector('[data-sk-chart-view-by]')!);
    await user.click(await screen.findByRole('menuitem', { name: 'Currency' }, { timeout: 5000 }));
    await waitFor(() => expect(view().getAttribute('data-sk-chart-dimensions')).toBe('Status\u0001Currency'));
    await user.click(view().querySelector('[data-sk-chart-settings]')!);
    const dialog = await screen.findByRole('dialog');
    expect(dialog.querySelector('[data-sk-p13n-tab="item"]')).not.toBeNull();
    expect(dialog.querySelector('[data-sk-p13n-tab="filter"]')).not.toBeNull();
    expect([...dialog.querySelectorAll('.sk-p13n__row--selected [data-sk-p13n-item]')].map((x) => x.getAttribute('data-sk-p13n-item'))).toEqual(['Status', 'Amount', 'Currency']);
    // sap.m.p13n.SelectionPanel with the role in the item factory (mdc ChartItemPanel)
    expect(dialog.querySelector('[data-sk-chart-p13n-role="Currency"]')).not.toBeNull();
  });

  it('AL-07 Chart: variantManagement "Control" shows the chart\'s variants; get/setCurrentVariantKey; none without it', async () => {
    const store = new MemoryVariantStore();
    const saved = await store.save({ id: '', pageKey: `chart:/Orders:${META}`, name: 'Lines', isDefault: false, autoApply: true, content: { filters: {}, columns: ['type:Line', 'Dimension:Status:Category', 'Measure:Amount:Axis1'] } });
    const ref = createRef<ChartInstance>();
    const { rerender } = render(wrap(<Chart contextPath="/Orders" metaPath={META} variantManagement="Control" ref={ref as Ref<ChartInstance>} />, { variants: store }));
    await waitFor(() => expect(view().querySelector('[data-sk-variant]')).not.toBeNull());
    expect(ref.current!.getCurrentVariantKey()).toBe('');
    await waitFor(() => { ref.current!.setCurrentVariantKey(saved.id); expect(ref.current!.getCurrentVariantKey()).toBe(saved.id); });
    await waitFor(() => expect(view().getAttribute('data-sk-chart-type')).toBe('line'));
    ref.current!.setCurrentVariantKey('unknown');
    expect(ref.current!.getCurrentVariantKey()).toBe(saved.id);
    rerender(wrap(<Chart contextPath="/Orders" metaPath={META} ref={ref as Ref<ChartInstance>} />, { variants: store }));
    expect(ref.current!.getCurrentVariantKey()).toBeNull();
    expect(view().querySelector('[data-sk-variant]')).toBeNull();
    // FE createVariantManagement: none with ignorePersonalizationChanges or without personalization
    rerender(wrap(<Chart contextPath="/Orders" metaPath={META} variantManagement="Control" personalization={false} ref={ref as Ref<ChartInstance>} />, { variants: store }));
    expect(view().querySelector('[data-sk-variant]')).toBeNull();
  });

  it('AL-05 Chart: ignorePersonalizationChanges defaults to false (changes are kept when the chart is shown again); true discards them', async () => {
    const user = userEvent.setup();
    const pick = async () => {
      await waitFor(() => expect(view().querySelector('[data-sk-chart-type-button]')).not.toBeNull());
      await user.click(view().querySelector('[data-sk-chart-type-button]')!);
      await user.click(await screen.findByRole('menuitem', { name: 'Line Chart' }));
      await waitFor(() => expect(view().getAttribute('data-sk-chart-type')).toBe('line'));
    };
    const Page = (q: { show: boolean; ignore?: boolean }) => (q.show ? <Chart contextPath="/Orders" metaPath={META} ignorePersonalizationChanges={q.ignore} /> : null);
    const { rerender } = render(wrap(<Page show />));
    await pick();
    rerender(wrap(<Page show={false} />));
    rerender(wrap(<Page show />));
    expect(view().getAttribute('data-sk-chart-type')).toBe('line');
    rerender(wrap(<Page show={false} />));
    rerender(wrap(<Page show ignore />));
    expect(view().getAttribute('data-sk-chart-type')).toBe('column');
    await pick();
    rerender(wrap(<Page show={false} ignore />));
    rerender(wrap(<Page show ignore />));
    expect(view().getAttribute('data-sk-chart-type')).toBe('column');
  });

  it('AL-05 Chart: action settings with actionOverflowGroups get a separator before a group with showSeparator', async () => {
    let pressed = 0;
    render(wrap(<Chart contextPath="/Orders" metaPath={META} personalization={false}
      actions={[{ key: 'a', text: 'First', overflowGroup: 1, press: () => { pressed += 1; } }, { key: 'b', text: 'Second', overflowGroup: 2 }, { key: 'c', text: 'Hidden', visible: false }, { key: 'd', text: 'Needs selection', requiresSelection: true, overflowGroup: 2 }]}
      actionOverflowGroups={[{ overflowGroup: 2, showSeparator: true }]} />));
    await waitFor(() => expect(view().querySelector('[data-sk-action="a"]')).not.toBeNull());
    expect(view().querySelector('[data-sk-action="c"]')).toBeNull();
    expect(view().querySelector('[data-sk-action="d"]')).toBeDisabled();
    expect(view().querySelectorAll('[data-sk-separator]')).toHaveLength(1);
    expect(view().querySelector('[data-sk-action="b"]')!.closest('.sk-chartview__action')!.querySelector('[data-sk-separator]')).not.toBeNull();
    await userEvent.click(view().querySelector('[data-sk-action="a"]')!);
    expect(pressed).toBe(1);
  });
});

describe('sap.fe.macros.Field semanticObject (stage 6)', () => {
  const navigation = (asked: string[]): NavigationAdapter => ({
    toObject: () => undefined,
    semanticTargets: (r) => { asked.push(r.semanticObject); return [{ text: `${r.semanticObject} display`, href: `#${r.semanticObject}-display` }]; },
  });
  it('AL-12 Field: semanticObject overwrites Common.SemanticObject; a stringified array asks for all of them', () => {
    const asked: string[] = [];
    const row = { ID: '1', Status: 'A' };
    const { rerender } = render(wrap(<Field contextPath="/Orders" metaPath="Status" row={row} />, { navigation: navigation(asked) }));
    expect(document.querySelector('[data-sk-semantic-link="OrderStatus"]')).not.toBeNull();
    asked.length = 0;
    rerender(wrap(<Field contextPath="/Orders" metaPath="ID" row={row} semanticObject="Order" />, { navigation: navigation(asked) }));
    expect(asked).toEqual(['Order']);
    expect(screen.getByRole('link', { name: '1' })).toHaveAttribute('href', '#Order-display');
    asked.length = 0;
    rerender(wrap(<Field contextPath="/Orders" metaPath="Status" row={row} semanticObject='["Order","Customer"]' />, { navigation: navigation(asked) }));
    expect(asked).toEqual(['Order', 'Customer']);
    expect(document.querySelector('[data-sk-semantic-link="Order,Customer"]')).not.toBeNull();
  });
});

describe('sap.fe.macros.FilterBar variant keys (stage 6)', () => {
  function Bar(q: { r: Ref<FilterBarInstance>; withVariants: boolean }) {
    const state = useFilterState('Orders', { service: 't' });
    const variants = useVariants('fb-page', { service: 't', standard: { filters: {} } });
    return <FilterBar state={state} variants={q.withVariants ? variants : undefined} ref={q.r} />;
  }
  it('AL-07 FilterBar: getCurrentVariantKey / setCurrentVariantKey use the associated variant management', async () => {
    const store = new MemoryVariantStore();
    const v = await store.save({ id: '', pageKey: 'fb-page', name: 'A', isDefault: false, autoApply: false, content: { filters: { Status: [{ operator: 'EQ', values: ['A'] }] } } });
    const ref = createRef<FilterBarInstance>();
    const { rerender } = render(wrap(<Bar r={ref as Ref<FilterBarInstance>} withVariants />, { variants: store }));
    await waitFor(() => expect(ref.current).not.toBeNull());
    expect(ref.current!.getCurrentVariantKey()).toBe('');
    await waitFor(() => { ref.current!.setCurrentVariantKey(v.id); expect(ref.current!.getCurrentVariantKey()).toBe(v.id); });
    await waitFor(async () => expect((await ref.current!.getSelectionVariant()).SelectOptions).toEqual([{ PropertyName: 'Status', Ranges: [{ Sign: 'I', Option: 'EQ', Low: 'A', High: null }] }]));
    rerender(wrap(<Bar r={ref as Ref<FilterBarInstance>} withVariants={false} />, { variants: store }));
    expect(ref.current!.getCurrentVariantKey()).toBeNull();
  });
});
