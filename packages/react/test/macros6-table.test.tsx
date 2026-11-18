/**
 * Stage 6 (macros6): the rest of the sap.fe.macros.Table / TreeTable API — the analytical table's visual grouping
 * (collapsed groups, leaves on expand, `$$aggregation.groupLevels`), `analyticalConfiguration`, the PresentationVariant
 * and SelectionVariant methods, `variantManagement` "Control", `quickVariantSelection`, `actionOverflowGroups`,
 * `rowCount`, `enablePaste` and `massEdit`. FE comparison: tests/e2e-fe/macros6.spec.ts.
 */
import { MantineProvider } from '@mantine/core';
import { buildAnalyticalRequests, buildModel, MemoryProvider, MemoryVariantStore, toQueryString, type MetaModel, type QueryRequest, type Row } from '@rhfan2019/smart-kit-core';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef, type ReactNode, type Ref } from 'react';
import { describe, expect, it } from 'vitest';
import { SmartKitProvider } from '../src/context/SmartKitProvider';
import { smartKitMantineTheme } from '../src/theme/mantine';
import type { Table as TableInstance } from '../src/table/Table';
import { parseClipboard, pastedRows, pasteTargets } from '../src/table/paste';
import { stateOfPresentationVariant, tablePresentationVariant } from '../src/table/tableState';
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
  <Property Name="Region" Type="Edm.String"/><Property Name="Note" Type="Edm.String"/><Property Name="Stamp" Type="Edm.String"/>
  <Property Name="Amount" Type="Edm.Decimal" Scale="0"/><Property Name="Currency" Type="Edm.String"/>
  <NavigationProperty Name="Lines" Type="Collection(T.Line)"/></EntityType>
<EntityType Name="Line"><Key><PropertyRef Name="Pos"/></Key><Property Name="Pos" Type="Edm.Int32" Nullable="false"/><Property Name="Text" Type="Edm.String"/>
  <Property Name="Qty" Type="Edm.Int32"/><Property Name="Calc" Type="Edm.String"/></EntityType>
<EntityContainer Name="C"><EntitySet Name="Sales" EntityType="T.Sale"><NavigationPropertyBinding Path="Lines" Target="Lines"/></EntitySet><EntitySet Name="Lines" EntityType="T.Line"/></EntityContainer>
<Annotations Target="T.Sale/Region"><Annotation Term="Common.Label" String="Region"/></Annotations>
<Annotations Target="T.Sale/Note"><Annotation Term="Common.Label" String="Note"/></Annotations>
<Annotations Target="T.Sale/Stamp"><Annotation Term="Common.Label" String="Stamp"/><Annotation Term="Core.Computed" Bool="true"/></Annotations>
<Annotations Target="T.Sale/Amount"><Annotation Term="Common.Label" String="Amount"/><Annotation Term="Measures.ISOCurrency" Path="Currency"/></Annotations>
<Annotations Target="T.Line/Calc"><Annotation Term="Core.Computed" Bool="true"/></Annotations>
<Annotations Target="T.Sale">
  <Annotation Term="Aggregation.ApplySupported"><Record>
    <PropertyValue Property="Transformations"><Collection><String>filter</String><String>groupby</String><String>aggregate</String></Collection></PropertyValue>
    <PropertyValue Property="GroupableProperties"><Collection><PropertyPath>Region</PropertyPath><PropertyPath>Note</PropertyPath></Collection></PropertyValue>
  </Record></Annotation>
  <Annotation Term="Aggregation.CustomAggregate" Qualifier="Amount" String="Edm.Decimal"/>
  <Annotation Term="UI.SelectionVariant" Qualifier="North"><Record><PropertyValue Property="Text" String="North"/><PropertyValue Property="SelectOptions"><Collection>
    <Record><PropertyValue Property="PropertyName" PropertyPath="Region"/><PropertyValue Property="Ranges"><Collection><Record><PropertyValue Property="Sign" EnumMember="UI.SelectionRangeSignType/I"/><PropertyValue Property="Option" EnumMember="UI.SelectionRangeOptionType/EQ"/><PropertyValue Property="Low" String="North"/></Record></Collection></PropertyValue></Record>
  </Collection></PropertyValue></Record></Annotation>
  <Annotation Term="UI.SelectionVariant" Qualifier="South"><Record><PropertyValue Property="Text" String="South"/><PropertyValue Property="SelectOptions"><Collection>
    <Record><PropertyValue Property="PropertyName" PropertyPath="Region"/><PropertyValue Property="Ranges"><Collection><Record><PropertyValue Property="Sign" EnumMember="UI.SelectionRangeSignType/I"/><PropertyValue Property="Option" EnumMember="UI.SelectionRangeOptionType/EQ"/><PropertyValue Property="Low" String="South"/></Record></Collection></PropertyValue></Record>
  </Collection></PropertyValue></Record></Annotation>
  <Annotation Term="UI.LineItem"><Collection>
    <Record Type="UI.DataField"><PropertyValue Property="Value" Path="ID"/></Record>
    <Record Type="UI.DataField"><PropertyValue Property="Value" Path="Region"/></Record>
    <Record Type="UI.DataField"><PropertyValue Property="Value" Path="Note"/></Record>
    <Record Type="UI.DataField"><PropertyValue Property="Value" Path="Amount"/></Record>
  </Collection></Annotation>
</Annotations>
<Annotations Target="T.Line"><Annotation Term="UI.LineItem"><Collection>
  <Record Type="UI.DataField"><PropertyValue Property="Value" Path="Pos"/></Record>
  <Record Type="UI.DataField"><PropertyValue Property="Value" Path="Text"/></Record>
  <Record Type="UI.DataField"><PropertyValue Property="Value" Path="Qty"/></Record>
  <Record Type="UI.DataField"><PropertyValue Property="Value" Path="Calc"/></Record>
</Collection></Annotation></Annotations>
  </Schema></edmx:DataServices>
</edmx:Edmx>`;

const sales: Row[] = [
  { ID: '1', Region: 'North', Note: 'a', Amount: 10, Currency: 'EUR', Lines: [] },
  { ID: '2', Region: 'South', Note: 'b', Amount: 5, Currency: 'EUR', Lines: [] },
  { ID: '3', Region: 'North', Note: 'c', Amount: 7, Currency: 'EUR', Lines: [] },
];

function setup(model: MetaModel, store = new MemoryVariantStore()) {
  const provider = new MemoryProvider({ model, data: { Sales: structuredClone(sales), Lines: [] } });
  const urls: string[] = [];
  const query = provider.query.bind(provider);
  provider.query = (req: QueryRequest, o?: { signal?: AbortSignal }) => { urls.push(decodeURIComponent(toQueryString(model, req))); return query(req, o); };
  const wrap = (children: ReactNode) => (
    <MantineProvider theme={smartKitMantineTheme}>
      <SmartKitProvider services={{ t: { model, dataProvider: provider, variants: store } }} locale="en" namespace="macros6-table">{children}</SmartKitProvider>
    </MantineProvider>
  );
  return { urls, wrap, provider };
}

const model = buildModel(xml);
const settle = () => act(() => new Promise((r) => setTimeout(r, 50)));

describe('AL-10 macros6: the analytical table groups as FE ($$aggregation groupLevels)', () => {
  it('AL-10 core: the first request reads the leaves count, grand total and the groups; a group\'s leaves come with its condition first', () => {
    const r = buildAnalyticalRequests(model, model.ui['T.Sale']!, {
      source: { entitySet: 'Sales' }, columns: model.ui['T.Sale']!.lineItem, filters: { Note: [{ operator: 'NE', values: ['x'] }] }, totals: ['Amount'], groupLevels: ['Region'],
    });
    expect(decodeURIComponent(toQueryString(model, { ...r.first, top: 50 }))).toBe(
      "$apply=filter(Note ne 'x')/concat(groupby((ID,Note,Region))/aggregate($count as UI5__leaves),aggregate(Amount,Currency),groupby((Region),aggregate(Amount,Currency))/concat(aggregate($count as UI5__count),top(50)))",
    );
    const leaves = decodeURIComponent(toQueryString(model, r.leaves!({ Region: 'North' }, 0, 50)));
    expect(leaves).toContain("$filter=Region eq 'North' and (Note ne 'x')");
    expect(leaves).toContain('$count=true');
    expect(leaves).not.toContain('$apply');
  });

  it('AL-10 core: aggregationOnLeafLevel leaves the keys out of the leaves and pages with the same aggregation', () => {
    const r = buildAnalyticalRequests(model, model.ui['T.Sale']!, { source: { entitySet: 'Sales' }, columns: model.ui['T.Sale']!.lineItem, totals: ['Amount'], aggregationOnLeafLevel: true });
    expect(decodeURIComponent(toQueryString(model, { ...r.first, top: 20 }))).toBe('$apply=concat(aggregate(Amount,Currency),groupby((Note,Region),aggregate(Amount,Currency))/concat(aggregate($count as UI5__count),top(20)))');
    expect(decodeURIComponent(toQueryString(model, r.page(20, 20)))).toBe('$apply=groupby((Note,Region),aggregate(Amount,Currency))/skip(20)/top(20)');
  });

  it('AL-10 AL-11 Table: groups start collapsed with their subtotals; expanding reads the group\'s leaves', async () => {
    const { urls, wrap, provider } = setup(model);
    const res = await provider.query(buildAnalyticalRequests(model, model.ui['T.Sale']!, { source: { entitySet: 'Sales' }, columns: model.ui['T.Sale']!.lineItem, totals: ['Amount'], groupLevels: ['Region'] }).first);
    expect(res.rows.map((g) => [g.Region, g.Amount])).toEqual([['North', 17], ['South', 5]]);
    expect(res.leafCount).toBe(3);
    urls.length = 0;
    render(wrap(<Table service="t" contextPath="/Sales" type="AnalyticalTable" groupBy="DataField::Region" enableExport={false} />));
    await waitFor(() => expect(urls.some((u) => u.includes('UI5__leaves'))).toBe(true));
    await settle();
    expect(urls.filter((u) => u.includes("Region eq 'North'"))).toEqual([]);
    const toggle = await waitFor(() => { const b = document.querySelector<HTMLElement>('[data-sk-group-row="North"] [data-sk-group-toggle]'); expect(b).not.toBeNull(); return b!; });
    fireEvent.click(toggle);
    await waitFor(() => expect(urls.some((u) => u.includes("$filter=Region eq 'North'"))).toBe(true));
    await waitFor(() => expect(document.querySelector('[data-sk-group-bottom="North"]')).not.toBeNull());
  });
});

describe('AL-07 macros6: PresentationVariant, SelectionVariant and variants of the table', () => {
  it('AL-07 tablePresentationVariant: the JSON form FE writes; stateOfPresentationVariant keeps what the PV leaves out', () => {
    const pv = tablePresentationVariant({ columns: ['DataField::ID'], sort: [{ path: 'Region', descending: true }], groupBy: [], totals: ['Amount'] });
    expect(pv).toEqual({
      Version: { Major: '1', Minor: '0', Patch: '0' }, PresentationVariantID: '', Text: 'Presentation Variant with ID ',
      GroupBy: [], SortOrder: [{ Property: 'Region', Descending: true }], Aggregations: { Amount: {} },
      Visualizations: [{ Type: 'LineItem', Content: [{ Value: 'DataField::ID' }] }],
    });
    const next = stateOfPresentationVariant({ PresentationVariantID: '', SortOrder: [{ Property: 'Nope', Descending: false }, { Property: 'Note', Descending: false }] }, { columns: ['a'], sort: [], groupBy: ['Region'], totals: [] }, { columns: ['a'], properties: ['Note', 'Region'] });
    expect(next).toEqual({ columns: ['a'], sort: [{ path: 'Note', descending: false }], groupBy: ['Region'], totals: [] });
  });

  it('AL-07 Table: get/setPresentationVariant read and change sort and columns; set/getSelectionVariant filter the table itself', async () => {
    const { urls, wrap } = setup(model);
    const ref = createRef<TableInstance>();
    render(wrap(<Table service="t" contextPath="/Sales" type="ResponsiveTable" enableExport={false} ref={ref as Ref<TableInstance>} />));
    await waitFor(() => expect(document.querySelectorAll('[data-sk-row]').length).toBe(3));
    const pv = await ref.current!.getPresentationVariant();
    expect(pv.Visualizations).toEqual([{ Type: 'LineItem', Content: [{ Value: 'DataField::ID' }, { Value: 'DataField::Region' }, { Value: 'DataField::Note' }, { Value: 'DataField::Amount' }] }]);
    await act(() => ref.current!.setPresentationVariant({ PresentationVariantID: '', SortOrder: [{ Property: 'Note', Descending: true }], Visualizations: [{ Type: 'LineItem', Content: [{ Value: 'DataField::ID' }, { Value: 'DataField::Note' }] }] }));
    await waitFor(() => expect(urls.some((u) => u.includes('$orderby=Note desc'))).toBe(true));
    expect((await ref.current!.getPresentationVariant()).SortOrder).toEqual([{ Property: 'Note', Descending: true }]);
    await act(() => ref.current!.setSelectionVariant({ SelectOptions: [{ PropertyName: 'Region', Ranges: [{ Sign: 'I', Option: 'EQ', Low: 'South' }] }] }));
    await waitFor(() => expect(document.querySelectorAll('[data-sk-row]').length).toBe(1));
    expect(urls.some((u) => u.includes("Region eq 'South'"))).toBe(true);
    expect(screen.getByText('Filtered By: Region')).toBeTruthy();
    expect((await ref.current!.getSelectionVariant()).SelectOptions).toEqual([{ PropertyName: 'Region', Ranges: [{ Sign: 'I', Option: 'EQ', Low: 'South', High: null }] }]);
    fireEvent.click(document.querySelector('[data-sk-table-filter-clear]')!);
    await waitFor(() => expect(document.querySelectorAll('[data-sk-row]').length).toBe(3));
  });

  it('AL-07 Table: variantManagement "Control" shows the table\'s variants; get/setCurrentVariantKey; none without it', async () => {
    const store = new MemoryVariantStore();
    const saved = await store.save({ id: '', pageKey: 'sales:variants', name: 'By note', isDefault: false, autoApply: true, content: { columns: ['DataField::ID', 'DataField::Note'], sort: [{ path: 'Note', descending: false }] } });
    const { urls, wrap } = setup(model, store);
    const ref = createRef<TableInstance>();
    const { rerender } = render(wrap(<Table service="t" contextPath="/Sales" type="ResponsiveTable" pageKey="sales" variantManagement="Control" enableExport={false} ref={ref as Ref<TableInstance>} />));
    await waitFor(() => expect(document.querySelector('[data-sk-table-variant] [data-sk-variant]')).not.toBeNull());
    expect(ref.current!.getCurrentVariantKey()).toBe('');
    ref.current!.setCurrentVariantKey('nope');
    expect(ref.current!.getCurrentVariantKey()).toBe('');
    await waitFor(() => { ref.current!.setCurrentVariantKey(saved.id); expect(ref.current!.getCurrentVariantKey()).toBe(saved.id); });
    await waitFor(() => expect(urls.some((u) => u.includes('$orderby=Note')), urls.join('\n')).toBe(true));
    rerender(wrap(<Table service="t" contextPath="/Sales" type="ResponsiveTable" pageKey="sales2" enableExport={false} ref={ref as Ref<TableInstance>} />));
    await waitFor(() => expect(document.querySelector('[data-sk-table-variant]')).toBeNull());
    expect(ref.current!.getCurrentVariantKey()).toBeNull();
  });
});

describe('AL-05 AL-06 macros6: quick filters, overflow groups, row count, paste and mass edit', () => {
  it('AL-05 Table: quickVariantSelection shows a switch of the selection variants; the selected one filters the rows', async () => {
    const { urls, wrap } = setup(model);
    render(wrap(<Table service="t" contextPath="/Sales" type="ResponsiveTable" enableExport={false} quickVariantSelection={{ paths: ['@com.sap.vocabularies.UI.v1.SelectionVariant#North', '@com.sap.vocabularies.UI.v1.SelectionVariant#South'], showCounts: true }} />));
    await waitFor(() => expect(document.querySelectorAll('[data-sk-row]').length).toBe(2));
    expect(urls.some((u) => u.includes("Region eq 'North'"))).toBe(true);
    await waitFor(() => expect(screen.getByText('North (2)')).toBeTruthy());
    expect(screen.getByText('South (1)')).toBeTruthy();
    fireEvent.click(screen.getByText('South (1)'));
    await waitFor(() => expect(document.querySelectorAll('[data-sk-row]').length).toBe(1));
  });

  it('AL-05 Table: actionOverflowGroups put a separator before the first action of a group; priorities keep or move actions', async () => {
    const { wrap } = setup(model);
    render(wrap(<Table service="t" contextPath="/Sales" type="ResponsiveTable" enableExport={false}
      actionOverflowGroups={[{ overflowGroup: 2, showSeparator: true }]}
      actions={[{ key: 'a1', text: 'One', overflowGroup: 1 }, { key: 'a2', text: 'Two', overflowGroup: 2 }, { key: 'a3', text: 'Three', overflowGroup: 2 }, { key: 'a4', text: 'Gone', priority: 'AlwaysOverflow' }, { key: 'a5', text: 'AI', isAIOperation: true }]} />));
    await waitFor(() => expect(document.querySelector('[data-sk-action="a1"]')).not.toBeNull());
    const separators = [...document.querySelectorAll('.sk-table__action')].filter((x) => x.querySelector('[data-sk-separator]')).map((x) => x.querySelector('[data-sk-action]')!.getAttribute('data-sk-action'));
    expect(separators).toEqual(['a2']);
    expect(document.querySelector('[data-sk-action="a4"]')).toBeNull();
  });

  it('AL-05 Table: rowCount with rowCountMode "Fixed" shows exactly that many rows (own scrollbar)', async () => {
    const { wrap } = setup(model);
    render(wrap(<Table service="t" contextPath="/Sales" type="GridTable" rowCountMode="Fixed" rowCount={5} enableExport={false} />));
    const body = await waitFor(() => { const b = document.querySelector<HTMLElement>('[data-sk-row-count="5"]'); expect(b).not.toBeNull(); return b!; });
    expect(body.style.height).toContain('5 * var(--sk-row-height)');
    expect(document.querySelector('.sk-table--grid')).not.toBeNull();
  });

  it('AL-06 paste: the pasted lines fill the shown plain properties; computed ones only with enablePastingOfComputedProperties', () => {
    const type = model.entityTypes['T.Line']!;
    const fields = model.ui['T.Line']!.lineItem;
    const cells = parseClipboard('1\tx\t3\tc\r\n2\ty\tno\t\n\n');
    expect(cells).toEqual([['1', 'x', '3', 'c'], ['2', 'y', 'no', '']]);
    const r = pastedRows(type, pasteTargets(type, fields, false), cells);
    expect(r.rows[0]).toEqual({ Pos: 1, Text: 'x', Qty: 3 });
    expect(r.errors).toEqual([{ row: 2, message: 'Qty: "no" is not a number' }]);
    expect(pastedRows(type, pasteTargets(type, fields, true), [['1', 'x', '3', 'c']]).rows[0]).toEqual({ Pos: 1, Text: 'x', Qty: 3, Calc: 'c' });
  });

  it('AL-06 Table: Ctrl+V on an editable sub-table creates the pasted rows', async () => {
    const { wrap, provider } = setup(model);
    render(wrap(<Table service="t" contextPath="/Sales/Lines" bindingContext="Sales('1')" readOnly={false} type="ResponsiveTable" enableExport={false} />));
    const section = await waitFor(() => { const s = document.querySelector<HTMLElement>('[data-sk-table]'); expect(s).not.toBeNull(); return s!; });
    await settle();
    const ev = new Event('paste', { bubbles: true, cancelable: true }) as Event & { clipboardData: unknown };
    Object.defineProperty(ev, 'clipboardData', { value: { getData: () => '7\tseven\t1\n8\teight\t2' } });
    act(() => { section.dispatchEvent(ev); });
    await waitFor(async () => expect((await provider.query({ source: { parent: "Sales('1')", navigation: 'Lines' }, select: [], expand: [], orderBy: [] })).rows.map((x) => x.Text)).toEqual(['seven', 'eight']));
  });

  it('AL-06 Table: massEdit offers "Edit" for the selected rows and changes the chosen field of each', async () => {
    const user = userEvent.setup();
    const { wrap, provider } = setup(model);
    render(wrap(<Table service="t" contextPath="/Sales" type="ResponsiveTable" enableExport={false} massEdit={{ ignoredFields: ['Region'] }} />));
    await waitFor(() => expect(document.querySelectorAll('[data-sk-row]').length).toBe(3));
    const edit = document.querySelector<HTMLButtonElement>('[data-sk-action="MassEdit"]')!;
    expect(edit.disabled).toBe(true);
    const boxes = [...document.querySelectorAll<HTMLInputElement>('[data-sk-row] input[type="checkbox"]')];
    await user.click(boxes[0]!);
    await user.click(boxes[1]!);
    await waitFor(() => expect(edit.disabled).toBe(false));
    await user.click(edit);
    const dialog = await screen.findByRole('dialog');
    expect([...dialog.querySelectorAll('[data-sk-mass-edit-field]')].map((x) => x.getAttribute('data-sk-mass-edit-field'))).toEqual(['Note', 'Amount']);
    const note = dialog.querySelector<HTMLInputElement>('[data-sk-mass-edit-field="Note"] input')!;
    await user.click(note);
    const list = await waitFor(() => { const l = document.getElementById(note.getAttribute('aria-controls') ?? ''); expect(l).not.toBeNull(); return l!; });
    await user.click(within(list).getByRole('option', { name: '< Leave Blank >', hidden: true }));
    await user.click(dialog.querySelector('[data-sk-mass-edit-apply]')!);
    await waitFor(async () => {
      const rows = (await provider.query({ source: { entitySet: 'Sales' }, select: [], expand: [], orderBy: [] })).rows;
      expect(rows.map((x) => x.Note)).toEqual([null, null, 'c']);
    });
  });
});
