/**
 * Stage 5 (docs/31, docs/30 §5.3): the list report template `v4/fe/templates/ListReport` takes the Fiori elements
 * manifest settings (docs/26c) — initialLoad, liveMode, variantManagement, views with counts, tableSettings (type,
 * threshold, creationMode), manifest columns and actions — with the FE 1.154 defaults (AL-05, AL-13).
 * FE comparison: tests/e2e-fe/lr5.spec.ts.
 */
import { MantineProvider } from '@mantine/core';
import { buildModel, MemoryProvider, MemoryVariantStore, ODataV4Provider, toQueryString, type QueryRequest } from '@rhfan2019/smart-kit-core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { SmartKitProvider } from '../src/context/SmartKitProvider';
import { smartKitMantineTheme } from '../src/theme/mantine';
import ListReport, { type $ListReportSettings } from '../src/v4/fe/templates/ListReport';
import { initialLoadOf, listCreationMode, loadsOnStart, thresholdOf } from '../src/templates/ListReport';

const spv = (q: string, type: string) => `<Annotation Term="UI.SelectionPresentationVariant" Qualifier="${q}"><Record>
  <PropertyValue Property="Text" String="View ${q}"/>
  <PropertyValue Property="SelectionVariant"><Record><PropertyValue Property="SelectOptions"><Collection>
    <Record><PropertyValue Property="PropertyName" PropertyPath="Type"/><PropertyValue Property="Ranges"><Collection><Record>
      <PropertyValue Property="Sign" EnumMember="UI.SelectionRangeSignType/I"/><PropertyValue Property="Option" EnumMember="UI.SelectionRangeOptionType/EQ"/><PropertyValue Property="Low" String="${type}"/>
    </Record></Collection></PropertyValue></Record>
  </Collection></PropertyValue></Record></PropertyValue>
  <PropertyValue Property="PresentationVariant"><Record><PropertyValue Property="Visualizations"><Collection><AnnotationPath>@UI.LineItem</AnnotationPath></Collection></PropertyValue></Record></PropertyValue>
</Record></Annotation>`;

/** Items: a default selection variant (Status ne C) and two views; Notes: no default filter values. */
const XML = `<?xml version="1.0"?>
<edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx">
  <edmx:Reference Uri="u"><edmx:Include Namespace="com.sap.vocabularies.UI.v1" Alias="UI"/></edmx:Reference>
  <edmx:Reference Uri="c"><edmx:Include Namespace="com.sap.vocabularies.Common.v1" Alias="Common"/></edmx:Reference>
  <edmx:DataServices><Schema xmlns="http://docs.oasis-open.org/odata/ns/edm" Namespace="T">
    <EntityType Name="Item"><Key><PropertyRef Name="ID"/></Key><Property Name="ID" Type="Edm.String" Nullable="false"/><Property Name="Status" Type="Edm.String"/><Property Name="Type" Type="Edm.String"/></EntityType>
    <EntityType Name="Note"><Key><PropertyRef Name="ID"/></Key><Property Name="ID" Type="Edm.String" Nullable="false"/><Property Name="Text" Type="Edm.String"/></EntityType>
    <EntityContainer Name="C"><EntitySet Name="Items" EntityType="T.Item"/><EntitySet Name="Notes" EntityType="T.Note"/></EntityContainer>
    <Annotations Target="T.Item">
      <Annotation Term="UI.HeaderInfo"><Record><PropertyValue Property="TypeName" String="Item"/><PropertyValue Property="TypeNamePlural" String="Items"/></Record></Annotation>
      <Annotation Term="UI.SelectionFields"><Collection><PropertyPath>Status</PropertyPath></Collection></Annotation>
      <Annotation Term="UI.LineItem"><Collection>
        <Record Type="UI.DataField"><PropertyValue Property="Value" Path="ID"/></Record>
        <Record Type="UI.DataField"><PropertyValue Property="Value" Path="Status"/></Record>
      </Collection></Annotation>
      <Annotation Term="UI.SelectionVariant"><Record><PropertyValue Property="SelectOptions"><Collection>
        <Record><PropertyValue Property="PropertyName" PropertyPath="Status"/><PropertyValue Property="Ranges"><Collection><Record>
          <PropertyValue Property="Sign" EnumMember="UI.SelectionRangeSignType/I"/><PropertyValue Property="Option" EnumMember="UI.SelectionRangeOptionType/NE"/><PropertyValue Property="Low" String="C"/>
        </Record></Collection></PropertyValue></Record>
      </Collection></PropertyValue></Record></Annotation>
      ${spv('A', 'X')}${spv('B', 'Y')}
    </Annotations>
    <Annotations Target="T.Note"><Annotation Term="UI.LineItem"><Collection><Record Type="UI.DataField"><PropertyValue Property="Value" Path="Text"/></Record></Collection></Annotation></Annotations>
  </Schema></edmx:DataServices>
</edmx:Edmx>`;
const model = buildModel(XML);
const ITEMS = Array.from({ length: 45 }, (_, i) => ({ ID: `i${String(i).padStart(2, '0')}`, Status: i % 3 === 0 ? 'C' : 'N', Type: i % 2 ? 'X' : 'Y' }));

function host(children: ReactNode) {
  const provider = new MemoryProvider({ model, data: { Items: ITEMS, Notes: [{ ID: 'n1', Text: 'a' }] } });
  const requests: QueryRequest[] = [];
  const counts: QueryRequest[] = [];
  const query = provider.query.bind(provider);
  provider.query = (req, opts) => { requests.push(req); return query(req, opts); };
  (provider as MemoryProvider & { count(req: QueryRequest): Promise<number> }).count = async (req) => { counts.push(req); return (await query({ ...req, top: 0, count: true })).count ?? 0; };
  const variants = new MemoryVariantStore();
  const list = vi.spyOn(variants, 'list');
  const ui = (
    <MantineProvider theme={smartKitMantineTheme}>
      <SmartKitProvider services={{ s: { model, dataProvider: provider, variants } }} locale="en" namespace={`al-lr5-${Math.random()}`}>{children}</SmartKitProvider>
    </MantineProvider>
  );
  const rows = (set: string) => requests.filter((r) => 'entitySet' in r.source && r.source.entitySet === set && r.top !== 0);
  return { ui, rows, counts, list };
}
const LR = (p: $ListReportSettings) => <ListReport service="s" {...p} />;
const responsive: $ListReportSettings['controlConfiguration'] = { '@com.sap.vocabularies.UI.v1.LineItem': { tableSettings: { type: 'ResponsiveTable' } } };

describe('AL-05 list report defaults (FE ListComponent / ListReport Component @property)', () => {
  it('AL-05 initialLoad: "Auto" loads only with filter values; "Disabled" never, "Enabled" always; booleans as FE', () => {
    expect(initialLoadOf(undefined)).toBe('Auto');
    expect(initialLoadOf(true)).toBe('Enabled');
    expect(initialLoadOf(false)).toBe('Disabled');
    const withValue = { Status: [{ operator: 'NE' as const, values: ['C'] }] };
    expect(loadsOnStart('Auto', 'Page', withValue)).toBe(true);
    expect(loadsOnStart('Auto', 'Page', { $editState: [{ operator: 'EQ' as const, values: [''] }] })).toBe(false);
    expect(loadsOnStart('Auto', 'None', withValue)).toBe(false);
    expect(loadsOnStart('Disabled', 'Page', withValue)).toBe(false);
    expect(loadsOnStart('Enabled', 'None', {})).toBe(true);
  });

  it('AL-05 initialLoad "Auto" (default): a list with default filter values loads, one without waits for "Go"', async () => {
    const a = host(LR({ contextPath: '/Items', controlConfiguration: responsive }));
    const va = render(a.ui);
    await waitFor(() => expect(a.rows('Items').length).toBeGreaterThan(0));
    va.unmount();
    const b = host(LR({ contextPath: '/Notes', controlConfiguration: responsive }));
    render(b.ui);
    await waitFor(() => expect(document.querySelector('[data-sk-go]')).not.toBeNull());
    await new Promise((r) => setTimeout(r, 100));
    expect(b.rows('Notes')).toHaveLength(0);
    fireEvent.click(document.querySelector('[data-sk-go]')!);
    await waitFor(() => expect(b.rows('Notes').length).toBeGreaterThan(0));
  });

  it('AL-05 liveMode false (default) shows "Go"; variantManagement "None" reads no variants and shows the title', async () => {
    const h = host(LR({ contextPath: '/Items', variantManagement: 'None', initialLoad: 'Enabled', title: 'All items', controlConfiguration: responsive }));
    render(h.ui);
    await waitFor(() => expect(h.rows('Items').length).toBeGreaterThan(0));
    expect(screen.getAllByText('All items').length).toBeGreaterThan(0);
    expect(document.querySelector('[data-sk-variant]')).toBeNull();
    expect(h.list).not.toHaveBeenCalled();
  });

  it('AL-05 table type and page size: no tableSettings.type gives the responsive table with 30 rows per request (FE getTableType, getThreshold)', async () => {
    expect(thresholdOf('ResponsiveTable', undefined, undefined)).toBe(30);
    expect(thresholdOf('GridTable', undefined, undefined)).toBe(100);
    expect(thresholdOf('TreeTable', undefined, undefined)).toBe(200);
    expect(thresholdOf('GridTable', undefined, 25)).toBe(25);
    expect(thresholdOf('GridTable', 7, 25)).toBe(7);
    const h = host(LR({ contextPath: '/Items', initialLoad: 'Enabled' }));
    render(h.ui);
    await waitFor(() => expect(document.querySelector('.sk-table--responsive')).not.toBeNull());
    await waitFor(() => expect(h.rows('Items').at(-1)?.top).toBe(30));
  });

  it('AL-05 creationMode: NewPage by default; Inline and other modes fall back to NewPage on the list report (FE _getCreationBehaviour)', () => {
    expect(listCreationMode(undefined)).toBe('NewPage');
    expect(listCreationMode('Inline')).toBe('NewPage');
    expect(listCreationMode('CreationDialog')).toBe('CreationDialog');
    expect(listCreationMode('External')).toBe('External');
  });
});

describe('AL-13 list report manifest settings', () => {
  it('AL-13 views with showCounts: a tab per path, the other tabs counted with <set>/$count, the view filters first', async () => {
    const h = host(LR({
      contextPath: '/Items', initialLoad: 'Enabled', liveMode: true, controlConfiguration: responsive,
      views: { paths: [{ key: 'A', annotationPath: 'com.sap.vocabularies.UI.v1.SelectionPresentationVariant#A' }, { key: 'B', annotationPath: 'com.sap.vocabularies.UI.v1.SelectionPresentationVariant#B' }], showCounts: true },
    }));
    render(h.ui);
    await waitFor(() => expect(document.querySelector('[data-sk-list-tab="B"] [data-sk-tab-count]')).not.toBeNull());
    expect([...document.querySelectorAll('[data-sk-tab-text]')].map((x) => x.textContent)).toEqual(['View A', 'View B']);
    // only tab B is counted; tab A counts its own rows
    expect(h.counts).toHaveLength(1);
    expect(decodeURIComponent(toQueryString(model, h.counts[0]!))).toBe("$filter=(Type eq 'Y') and Status ne 'C'");
    const expectedB = ITEMS.filter((x) => x.Type === 'Y' && x.Status !== 'C').length;
    expect(document.querySelector('[data-sk-list-tab="B"] [data-sk-tab-count]')).toHaveAttribute('data-sk-tab-count', String(expectedB));
    await waitFor(() => expect(document.querySelector('[data-sk-list-tab="A"] [data-sk-tab-count]')).toHaveAttribute('data-sk-tab-count', String(ITEMS.filter((x) => x.Type === 'X' && x.Status !== 'C').length)));
  });

  it('AL-13 the OData provider counts with GET <set>/$count and only $filter / $search', () => {
    const p = new ODataV4Provider({ serviceUrl: '/s/', model, fetch: async () => new Response('3') });
    const url = p.countUrl({ source: { entitySet: 'Items' }, select: ['ID'], expand: [], orderBy: [{ path: 'ID' }], filters: { Status: [{ operator: 'EQ', values: ['N'] }] }, count: true, top: 10 });
    expect(decodeURIComponent(url)).toBe("/s/Items/$count?$filter=Status eq 'N'");
  });

  it('AL-13 manifest columns and actions: a column placed by position, an action with press(selectedContexts)', async () => {
    const press = vi.fn();
    const h = host(LR({
      contextPath: '/Items', initialLoad: 'Enabled', liveMode: true,
      controlConfiguration: {
        '@com.sap.vocabularies.UI.v1.LineItem': {
          tableSettings: { type: 'ResponsiveTable', selectionMode: 'Multi' },
          columns: { 'Custom::Mark': { header: 'Mark', template: (row) => <b data-mark>{String(row.Type)}</b>, properties: ['Type'], importance: 'High', position: { anchor: 'DataField::ID', placement: 'After' } } },
          actions: { 'Custom::Do': { text: 'Do it', press, requiresSelection: true } },
        },
      },
    }));
    render(h.ui);
    await waitFor(() => expect(document.querySelectorAll('tr[data-sk-row]').length).toBeGreaterThan(0));
    await waitFor(() => expect(document.querySelector('[data-mark]')).not.toBeNull());
    expect(h.rows('Items').at(-1)!.select).toContain('Type');
    const headers = [...document.querySelectorAll('th[data-col]')].map((x) => x.getAttribute('data-col'));
    expect(headers.indexOf('Custom::Mark')).toBe(headers.indexOf('DataField::ID') + 1);
    const action = document.querySelector<HTMLButtonElement>('[data-sk-action="Custom::Do"]')!;
    expect(action).toBeDisabled();
    fireEvent.click(document.querySelector('tr[data-sk-row] input[type="checkbox"]')!);
    await waitFor(() => expect(action).toBeEnabled());
    fireEvent.click(action);
    expect(press).toHaveBeenCalledTimes(1);
    expect(press.mock.calls[0]![0].selectedContexts).toHaveLength(1);
  });

  it('AL-13 content.header.actions: header buttons with press; hideFilterBar: no filter bar, the list loads without conditions', async () => {
    const press = vi.fn();
    const h = host(LR({ contextPath: '/Items', hideFilterBar: true, controlConfiguration: responsive, content: { header: { actions: { remind: { text: 'Remind', press } } } } }));
    render(h.ui);
    await waitFor(() => expect(h.rows('Items').length).toBeGreaterThan(0));
    expect(document.querySelector('[data-sk-filter]')).toBeNull();
    expect(Object.keys(h.rows('Items').at(-1)!.filters ?? {})).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Remind' }));
    expect(press).toHaveBeenCalled();
  });
});
