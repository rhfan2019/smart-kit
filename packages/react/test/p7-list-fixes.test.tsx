/**
 * List report fixes (docs/25 S29, S35 and the selected view of a saved view):
 * - S29: with views of several entity sets the table of an entity set reads `"/<Set>/@UI.LineItem"`, else the relative
 *   key (FE ConverterContext getManifestControlConfiguration); `onRowsChange` reports the rows of the shown table;
 * - S35: `navigationParameter` — the conditions and the view of an inbound navigation (FE ViewState applyViewState with
 *   an xAppState navigation parameter, FilterBar _applySelectionVariant), applied once per navigation;
 * - a saved view stores the selected view tab (FE MultipleModeControl handlePersonalizationUpdate).
 */
import { MantineProvider } from '@mantine/core';
import { buildModel, MemoryPageStateStore, MemoryProvider, MemoryVariantStore, toQueryString, type QueryRequest, type Row, type VariantStore } from '@rhfan2019/smart-kit-core';
import { fireEvent, render, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { SmartKitProvider } from '../src/context/SmartKitProvider';
import { hasMultipleEntitySets, navigationKey, tableConfigurationOf } from '../src/templates/ListReport';
import { smartKitMantineTheme } from '../src/theme/mantine';
import ListReport, { type $ListReportSettings } from '../src/v4/fe/templates/ListReport';

const XML = `<?xml version="1.0"?>
<edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx">
  <edmx:Reference Uri="u"><edmx:Include Namespace="com.sap.vocabularies.UI.v1" Alias="UI"/></edmx:Reference>
  <edmx:Reference Uri="c"><edmx:Include Namespace="com.sap.vocabularies.Common.v1" Alias="Common"/></edmx:Reference>
  <edmx:DataServices><Schema xmlns="http://docs.oasis-open.org/odata/ns/edm" Namespace="T">
    <EntityType Name="Order"><Key><PropertyRef Name="ID"/></Key>
      <Property Name="ID" Type="Edm.String" Nullable="false"/><Property Name="Status" Type="Edm.String"/><Property Name="Area" Type="Edm.String"/><Property Name="Hint" Type="Edm.String"/>
    </EntityType>
    <EntityType Name="Task"><Key><PropertyRef Name="ID"/></Key>
      <Property Name="ID" Type="Edm.String" Nullable="false"/><Property Name="Owner" Type="Edm.String"/><Property Name="Secret" Type="Edm.String"/>
    </EntityType>
    <EntityContainer Name="C"><EntitySet Name="Orders" EntityType="T.Order"/><EntitySet Name="Tasks" EntityType="T.Task"/></EntityContainer>
    <Annotations Target="T.Order/Status"><Annotation Term="Common.Label" String="Status"/></Annotations>
    <Annotations Target="T.Order/Area"><Annotation Term="Common.Label" String="Area"/></Annotations>
    <Annotations Target="T.Order">
      <Annotation Term="UI.HeaderInfo"><Record><PropertyValue Property="TypeName" String="Order"/><PropertyValue Property="TypeNamePlural" String="Orders"/></Record></Annotation>
      <Annotation Term="UI.SelectionFields"><Collection><PropertyPath>Status</PropertyPath></Collection></Annotation>
      <Annotation Term="UI.LineItem"><Collection>
        <Record Type="UI.DataField"><PropertyValue Property="Value" Path="ID"/></Record>
        <Record Type="UI.DataField"><PropertyValue Property="Value" Path="Status"/></Record>
      </Collection></Annotation>
    </Annotations>
    <Annotations Target="T.Task">
      <Annotation Term="UI.HeaderInfo"><Record><PropertyValue Property="TypeName" String="Task"/><PropertyValue Property="TypeNamePlural" String="Tasks"/></Record></Annotation>
      <Annotation Term="UI.LineItem"><Collection>
        <Record Type="UI.DataField"><PropertyValue Property="Value" Path="ID"/></Record>
        <Record Type="UI.DataField"><PropertyValue Property="Value" Path="Owner"/></Record>
      </Collection></Annotation>
    </Annotations>
  </Schema></edmx:DataServices>
</edmx:Edmx>`;
const baseModel = buildModel(XML);
/** The same service with a mandatory filter field: Area. */
const requiredModel = buildModel(XML
  .replace('<edmx:DataServices>', '<edmx:Reference Uri="p"><edmx:Include Namespace="Org.OData.Capabilities.V1" Alias="Capabilities"/></edmx:Reference><edmx:DataServices>')
  .replace('</Schema>', '<Annotations Target="T.C/Orders"><Annotation Term="Capabilities.FilterRestrictions"><Record><PropertyValue Property="RequiredProperties"><Collection><PropertyPath>Area</PropertyPath></Collection></PropertyValue></Record></Annotation></Annotations></Schema>'));
const ORDERS: Row[] = [
  { ID: 'o1', Status: 'A', Area: 'North', Hint: 'h1' },
  { ID: 'o2', Status: 'B', Area: 'North', Hint: 'h2' },
  { ID: 'o3', Status: 'B', Area: 'South', Hint: 'h3' },
];
const TASKS: Row[] = [{ ID: 't1', Owner: 'ann', Secret: 's1' }, { ID: 't2', Owner: 'bob', Secret: 's2' }];
const LINE_ITEM = '@com.sap.vocabularies.UI.v1.LineItem';
const VIEWS: $ListReportSettings['views'] = { paths: [
  { key: 'orders', annotationPath: 'com.sap.vocabularies.UI.v1.LineItem' },
  { key: 'tasks', entitySet: 'Tasks', annotationPath: 'com.sap.vocabularies.UI.v1.LineItem' },
] };

function world(variants: VariantStore = new MemoryVariantStore(), model = baseModel) {
  const provider = new MemoryProvider({ model, data: { Orders: structuredClone(ORDERS), Tasks: structuredClone(TASKS) } });
  const requests: QueryRequest[] = [];
  const query = provider.query.bind(provider);
  provider.query = (req, opts) => { requests.push(req); return query(req, opts); };
  const pageState = new MemoryPageStateStore();
  const namespace = `p7-${Math.random()}`;
  const host = (children: ReactNode) => (
    <MantineProvider theme={smartKitMantineTheme}>
      <SmartKitProvider services={{ s: { model, dataProvider: provider, variants } }} locale="en" namespace={namespace} pageState={pageState}>{children}</SmartKitProvider>
    </MantineProvider>
  );
  const urls = (set: string) => requests.filter((r) => r.source.entitySet === set).map((r) => decodeURIComponent(toQueryString(model, r)));
  return { host, urls, requests };
}
const rowIds = () => [...document.querySelectorAll('tr[data-sk-row]')].map((r) => r.querySelector('td[data-col]')?.textContent);
const shown = (ids: string[]) => waitFor(() => expect(rowIds()).toEqual(ids));
const tab = (key: string) => document.querySelector<HTMLElement>(`[data-sk-list-tab="${key}"]`)!;
const activeTab = () => document.querySelector('[data-sk-list-tab][aria-selected="true"]')?.getAttribute('data-sk-list-tab');
const RESPONSIVE = { tableSettings: { type: 'ResponsiveTable' as const } };

describe('S29: table configuration per entity set (FE getManifestControlConfiguration)', () => {
  it('S29 the absolute key wins for its entity set, the relative key is the fallback; one entity set reads only the relative key', () => {
    const main = { tableSettings: { header: 'main' } };
    const other = { tableSettings: { header: 'other' } };
    const cc = { [LINE_ITEM]: main, [`/Tasks/${LINE_ITEM}`]: other, [`/Empty/${LINE_ITEM}`]: {} };
    expect(tableConfigurationOf(cc, 'Tasks', true)).toBe(other);
    expect(tableConfigurationOf(cc, 'Orders', true)).toBe(main);
    // an empty configuration counts as none (FE: Object.keys(...).length > 0)
    expect(tableConfigurationOf(cc, 'Empty', true)).toBe(main);
    expect(tableConfigurationOf(cc, 'Tasks', false)).toBe(main);
    expect(tableConfigurationOf(undefined, 'Tasks', true)).toEqual({});
    expect(hasMultipleEntitySets({ contextPath: '/Orders', views: VIEWS })).toBe(true);
    expect(hasMultipleEntitySets({ contextPath: '/Orders', views: { paths: [{ key: 'a' }, { key: 'b', contextPath: '/Orders' }, { key: 'c', entitySet: 'Tasks', template: () => null }] } })).toBe(false);
  });

  it('S29 "/Tasks/@UI.LineItem": its actions, columns and additionalProperties apply to the Tasks view; onRowsChange reports the shown table', async () => {
    const w = world();
    const mainPress = vi.fn();
    const taskPress = vi.fn();
    const rows = vi.fn();
    render(w.host(<ListReport service="s" contextPath="/Orders" initialLoad="Enabled" views={VIEWS} onRowsChange={rows} controlConfiguration={{
      [LINE_ITEM]: { ...RESPONSIVE, actions: { main: { text: 'Main action', press: mainPress } }, columns: { area: { header: 'Area column', template: (r) => String(r.Area), properties: ['Area'], importance: 'High' } } },
      [`/Tasks/${LINE_ITEM}`]: {
        tableSettings: { type: 'ResponsiveTable', selectionMode: 'Multi', additionalProperties: ['Secret'], header: 'My tasks' },
        actions: { confirm: { text: 'Confirm', press: taskPress, requiresSelection: true } },
        columns: { who: { header: 'Who', template: (r) => `by ${String(r.Owner)}`, properties: ['Owner'], importance: 'High' } },
      },
    }} />));
    await shown(['o1', 'o2', 'o3']);
    expect(document.querySelector('[data-sk-action="main"]')).not.toBeNull();
    expect(document.querySelector('[data-sk-action="confirm"]')).toBeNull();
    expect(document.querySelector('th[data-col="area"]')?.textContent).toContain('Area column');
    await waitFor(() => expect(rows.mock.lastCall?.[0].map((r: Row) => r.ID)).toEqual(['o1', 'o2', 'o3']));

    fireEvent.click(tab('tasks'));
    await shown(['t1', 't2']);
    // the Tasks table: its own actions, columns, header and additional properties — not the main table's
    expect(document.querySelector('[data-sk-action="confirm"]')).not.toBeNull();
    expect(document.querySelector('[data-sk-action="main"]')).toBeNull();
    expect(document.querySelector('th[data-col="who"]')?.textContent).toContain('Who');
    expect(document.querySelector('th[data-col="area"]')).toBeNull();
    expect([...document.querySelectorAll('td[data-col="who"]')].map((c) => c.textContent)).toEqual(['by ann', 'by bob']);
    expect(document.querySelector('[data-sk-table]')?.textContent).toContain('My tasks');
    expect(w.urls('Tasks').some((u) => /\$select=[^&]*Secret/.test(u))).toBe(true);
    expect(w.urls('Orders').some((u) => /Secret/.test(u))).toBe(false);
    await waitFor(() => expect(rows.mock.lastCall?.[0].map((r: Row) => r.ID)).toEqual(['t1', 't2']));
    // the selected contexts of the action carry the additional property
    fireEvent.click(document.querySelector('tr[data-sk-row] input[type="checkbox"]')!);
    await waitFor(() => expect(document.querySelector<HTMLButtonElement>('[data-sk-action="confirm"]')!.disabled).toBe(false));
    fireEvent.click(document.querySelector('[data-sk-action="confirm"]')!);
    expect(taskPress.mock.lastCall?.[0].selectedContexts.map((c: { getObject(): Row }) => c.getObject().Secret)).toEqual(['s1']);
  });

  it('S29 without an absolute key the relative configuration applies to the tables of every entity set (FE fallback)', async () => {
    const w = world();
    render(w.host(<ListReport service="s" contextPath="/Orders" initialLoad="Enabled" views={VIEWS} controlConfiguration={{
      [LINE_ITEM]: { ...RESPONSIVE, actions: { main: { text: 'Main action', press: () => undefined } } },
    }} />));
    await shown(['o1', 'o2', 'o3']);
    fireEvent.click(tab('tasks'));
    await shown(['t1', 't2']);
    expect(document.querySelector('[data-sk-action="main"]')).not.toBeNull();
  });
});

describe('S35: navigationParameter (FE applyViewState with a navigation parameter, FilterBar _applySelectionVariant)', () => {
  const sv = (status: string) => ({ SelectOptions: [{ PropertyName: 'Status', Ranges: [{ Sign: 'I' as const, Option: 'EQ', Low: status }] }, { PropertyName: 'Nope', Ranges: [{ Sign: 'I' as const, Option: 'EQ', Low: 'x' }] }] });
  const LR = (p: $ListReportSettings) => <ListReport service="s" contextPath="/Orders" controlConfiguration={{ [LINE_ITEM]: RESPONSIVE }} {...p} />;

  it('S35 navigationKey: the id and the content identify a navigation', () => {
    expect(navigationKey(undefined)).toBeUndefined();
    expect(navigationKey({ selectionVariant: sv('A') })).toBe(navigationKey({ selectionVariant: sv('A') }));
    expect(navigationKey({ selectionVariant: sv('A') })).not.toBe(navigationKey({ selectionVariant: sv('B') }));
    expect(navigationKey({ selectionVariant: sv('A'), navigationId: '1' })).not.toBe(navigationKey({ selectionVariant: sv('A'), navigationId: '2' }));
  });

  it('S35 the conditions are applied and the list is read at once, also with initialLoad "Disabled"; unknown properties are ignored', async () => {
    const w = world();
    render(w.host(<LR initialLoad="Disabled" navigationParameter={{ selectionVariant: sv('B') }} />));
    await shown(['o2', 'o3']);
    // nothing was read before the navigation was applied
    expect(w.urls('Orders').every((u) => u.includes("Status eq 'B'"))).toBe(true);
    expect(w.urls('Orders').some((u) => u.includes('Nope'))).toBe(false);
    // the header is collapsed as after a search on start (FE isSearchTriggeredByInitialLoad: xAppState)
    expect(document.querySelector('[data-sk-filter="Status"]')).toBeNull();
  });

  it('S35 the navigation wins over the restored page state and is applied once: what the user changes afterwards stays', async () => {
    const w = world();
    const nav = (status: string, navigationId: string) => ({ selectionVariant: sv(status), selectedTab: 'orders', navigationId });
    // an earlier visit with status A, left on the Tasks view
    const first = render(w.host(<LR initialLoad="Enabled" views={VIEWS} navigationParameter={nav('A', 'n1')} />));
    await shown(['o1']);
    fireEvent.click(tab('tasks'));
    await shown(['t1', 't2']);
    first.unmount();
    // a new navigation: its conditions and view replace the restored ones
    const second = render(w.host(<LR initialLoad="Enabled" views={VIEWS} navigationParameter={nav('B', 'n2')} />));
    await shown(['o2', 'o3']);
    // the user selects another view; re-rendering with an equal navigation (a new object) does not undo it
    fireEvent.click(tab('tasks'));
    await shown(['t1', 't2']);
    second.rerender(w.host(<LR initialLoad="Enabled" views={VIEWS} navigationParameter={nav('B', 'n2')} />));
    await new Promise((r) => setTimeout(r, 50));
    expect(activeTab()).toBe('tasks');
    second.unmount();
    // back navigation: the page is shown again with the same navigation — the user's state is restored
    const third = render(w.host(<LR initialLoad="Enabled" views={VIEWS} navigationParameter={nav('B', 'n2')} />));
    await shown(['t1', 't2']);
    expect(activeTab()).toBe('tasks');
    // the same conditions with a new id are a new navigation
    third.rerender(w.host(<LR initialLoad="Enabled" views={VIEWS} navigationParameter={nav('B', 'n3')} />));
    await shown(['o2', 'o3']);
    expect(activeTab()).toBe('orders');
  });

  it('S35 selectedTab selects the view of another entity set', async () => {
    const w = world();
    const first = render(w.host(<LR initialLoad="Enabled" views={VIEWS} />));
    await shown(['o1', 'o2', 'o3']);
    expect(activeTab()).toBe('orders');
    first.unmount();
    render(w.host(<LR initialLoad="Enabled" views={VIEWS} navigationParameter={{ selectedTab: 'tasks', selectionVariant: sv('B') }} />));
    await shown(['t1', 't2']);
    expect(activeTab()).toBe('tasks');
    // the Orders table was not read again before the view was selected
    fireEvent.click(tab('orders'));
    await shown(['o2', 'o3']);
  });
});

describe('S35: navigationParameter and the default view (FE requiresStandardVariant)', () => {
  it('S35 the navigation wins over the user\'s default view: the standard view with the navigation\'s conditions', async () => {
    const store = new MemoryVariantStore();
    await store.save({ id: '', pageKey: 'list:Orders', name: 'Mine', isDefault: true, autoApply: true, content: { filters: { Status: [{ operator: 'EQ', values: ['A'] }] }, search: '', filterFields: ['Status'], sort: [] } });
    const w = world(store);
    const sv = { SelectOptions: [{ PropertyName: 'Status', Ranges: [{ Sign: 'I' as const, Option: 'EQ', Low: 'B' }] }] };
    render(w.host(<ListReport service="s" contextPath="/Orders" controlConfiguration={{ [LINE_ITEM]: RESPONSIVE }} navigationParameter={{ selectionVariant: sv }} />));
    await shown(['o2', 'o3']);
    expect(document.querySelector('[data-sk-variant]')?.textContent).toContain('Standard');
    expect(w.urls('Orders').every((u) => u.includes("Status eq 'B'"))).toBe(true);
  });

  it('S35 without a navigation the default view is applied as before', async () => {
    const store = new MemoryVariantStore();
    await store.save({ id: '', pageKey: 'list:Orders', name: 'Mine', isDefault: true, autoApply: true, content: { filters: { Status: [{ operator: 'EQ', values: ['A'] }] }, search: '', filterFields: ['Status'], sort: [] } });
    const w = world(store);
    render(w.host(<ListReport service="s" contextPath="/Orders" controlConfiguration={{ [LINE_ITEM]: RESPONSIVE }} />));
    await shown(['o1']);
    expect(document.querySelector('[data-sk-variant]')?.textContent).toContain('Mine');
  });
});

describe('S35: navigationParameter and mandatory filter fields (FE: the selection variant replaces every condition)', () => {
  const area = (v: string) => ({ PropertyName: 'Area', Ranges: [{ Sign: 'I' as const, Option: 'EQ', Low: v }] });
  const status = (v: string) => ({ PropertyName: 'Status', Ranges: [{ Sign: 'I' as const, Option: 'EQ', Low: v }] });
  const LR = (p: $ListReportSettings) => <ListReport service="s" contextPath="/Orders" initialLoad="Enabled" controlConfiguration={{ [LINE_ITEM]: RESPONSIVE }} {...p} />;

  it('S35 a navigation without the mandatory field reads nothing — not even the restored query — and shows the field\'s error', async () => {
    const w = world(undefined, requiredModel);
    const first = render(w.host(<LR navigationParameter={{ selectionVariant: { SelectOptions: [area('North')] }, navigationId: 'a' }} />));
    await shown(['o1', 'o2']);
    first.unmount();
    w.requests.length = 0;
    render(w.host(<LR navigationParameter={{ selectionVariant: { SelectOptions: [status('B')] }, navigationId: 'b' }} />));
    // the header stays open with the empty mandatory field marked
    await waitFor(() => expect(document.querySelector('[data-sk-filter="Area"] [aria-invalid="true"], [data-sk-filter="Area"] [data-error]')).not.toBeNull());
    await new Promise((r) => setTimeout(r, 50));
    expect(rowIds()).toEqual([]);
    expect(w.urls('Orders')).toEqual([]);
  });

  it('S35 with the mandatory field in the selection variant the list is read', async () => {
    const w = world(undefined, requiredModel);
    render(w.host(<LR navigationParameter={{ selectionVariant: { SelectOptions: [status('B'), area('South')] } }} />));
    await shown(['o3']);
  });
});

describe('Saved views store the selected view tab (FE MultipleModeControl "selectIconTabBarFilter")', () => {
  const LR = () => <ListReport service="s" contextPath="/Orders" initialLoad="Enabled" views={VIEWS} controlConfiguration={{ [LINE_ITEM]: RESPONSIVE }} />;
  const openMenu = async () => {
    fireEvent.click(document.querySelector('[data-sk-variant]')!);
    await waitFor(() => expect(document.querySelector('[data-sk-variant-saveas]')).not.toBeNull());
  };

  it('a view saved on tab B selects tab B again; selecting another tab marks the view as modified', async () => {
    const w = world();
    render(w.host(<LR />));
    await shown(['o1', 'o2', 'o3']);
    expect(document.querySelector('[data-sk-variant-modified]')).toBeNull();
    fireEvent.click(tab('tasks'));
    await shown(['t1', 't2']);
    await waitFor(() => expect(document.querySelector('[data-sk-variant-modified]')).not.toBeNull());
    await openMenu();
    fireEvent.click(document.querySelector('[data-sk-variant-saveas]')!);
    const name = await waitFor(() => { const el = document.querySelector<HTMLInputElement>('[role="dialog"] input[type="text"], [role="dialog"] input:not([type])'); expect(el).not.toBeNull(); return el!; });
    fireEvent.change(name, { target: { value: 'On tasks' } });
    fireEvent.click(document.querySelector('[data-sk-variant-saveas-ok]')!);
    await waitFor(() => expect(document.querySelector('[data-sk-variant]')?.textContent).toContain('On tasks'));
    expect(document.querySelector('[data-sk-variant-modified]')).toBeNull();

    fireEvent.click(tab('orders'));
    await shown(['o1', 'o2', 'o3']);
    await waitFor(() => expect(document.querySelector('[data-sk-variant-modified]')).not.toBeNull());
    await openMenu();
    fireEvent.click(document.querySelector('[data-sk-variant-item="On tasks"]')!);
    await shown(['t1', 't2']);
    expect(activeTab()).toBe('tasks');
    // the standard view has the first tab
    await openMenu();
    fireEvent.click(document.querySelector('[data-sk-variant-item="Standard"]')!);
    await shown(['o1', 'o2', 'o3']);
    expect(activeTab()).toBe('orders');
  });

  it('a view saved before the tab was stored (no `custom`) keeps the selected tab and is not modified by it', async () => {
    const store = new MemoryVariantStore();
    await store.save({ id: '', pageKey: 'list:Orders', name: 'Old', isDefault: false, autoApply: true, content: { filters: { Status: [{ operator: 'EQ', values: ['B'] }] }, search: '', filterFields: ['Status'], sort: [] } });
    render(world(store).host(<LR />));
    await shown(['o1', 'o2', 'o3']);
    fireEvent.click(tab('tasks'));
    await shown(['t1', 't2']);
    await openMenu();
    fireEvent.click(document.querySelector('[data-sk-variant-item="Old"]')!);
    await waitFor(() => expect(document.querySelector('[data-sk-variant]')?.textContent).toContain('Old'));
    expect(activeTab()).toBe('tasks');
    await new Promise((r) => setTimeout(r, 50));
    expect(document.querySelector('[data-sk-variant-modified]')).toBeNull();
    fireEvent.click(tab('orders'));
    await shown(['o2', 'o3']);
    expect(document.querySelector('[data-sk-variant-modified]')).toBeNull();
  });
});
