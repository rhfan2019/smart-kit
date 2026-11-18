/**
 * Chart toolbar actions (sap.fe.macros.Chart `actions`: sap.fe.macros.chart.Action / ActionGroup) and the list report's
 * chart action settings (`controlConfiguration › @UI.Chart › actions`, FE getChartActions → MdcChartTemplate): overflow
 * priority, group / overflowGroup, isAIOperation, menus with a default action (split button); isPrimaryAction and
 * template are accepted without effect, as in FE 1.154 (AL-05, AL-13).
 */
import { MantineProvider } from '@mantine/core';
import { buildModel, MemoryProvider, MemoryVariantStore, type Row } from '@rhfan2019/smart-kit-core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SmartKitProvider } from '../src/context/SmartKitProvider';
import { smartKitMantineTheme } from '../src/theme/mantine';
import Chart from '../src/v4/fe/macros/Chart';
import ListReport, { type $ListReportSettings } from '../src/v4/fe/templates/ListReport';

const XML = `<?xml version="1.0"?>
<edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx">
  <edmx:Reference Uri="u"><edmx:Include Namespace="com.sap.vocabularies.UI.v1" Alias="UI"/></edmx:Reference>
  <edmx:Reference Uri="a"><edmx:Include Namespace="Org.OData.Aggregation.V1" Alias="Aggregation"/></edmx:Reference>
  <edmx:DataServices><Schema xmlns="http://docs.oasis-open.org/odata/ns/edm" Namespace="T">
<EntityType Name="Order"><Key><PropertyRef Name="ID"/></Key><Property Name="ID" Type="Edm.String" Nullable="false"/><Property Name="Status" Type="Edm.String"/>
  <Property Name="Amount" Type="Edm.Decimal" Scale="0"/></EntityType>
<EntityContainer Name="C"><EntitySet Name="Orders" EntityType="T.Order"/></EntityContainer>
<Annotations Target="T.Order">
  <Annotation Term="UI.HeaderInfo"><Record><PropertyValue Property="TypeName" String="Order"/><PropertyValue Property="TypeNamePlural" String="Orders"/></Record></Annotation>
  <Annotation Term="Aggregation.CustomAggregate" Qualifier="Amount" String="Edm.Decimal"/>
  <Annotation Term="Aggregation.ApplySupported"><Record><PropertyValue Property="Transformations"><Collection><String>filter</String><String>groupby</String><String>aggregate</String></Collection></PropertyValue></Record></Annotation>
  <Annotation Term="UI.LineItem"><Collection><Record Type="UI.DataField"><PropertyValue Property="Value" Path="ID"/></Record></Collection></Annotation>
  <Annotation Term="UI.PresentationVariant"><Record><PropertyValue Property="Visualizations"><Collection><AnnotationPath>@UI.Chart#ByStatus</AnnotationPath><AnnotationPath>@UI.LineItem</AnnotationPath></Collection></PropertyValue></Record></Annotation>
  <Annotation Term="UI.Chart" Qualifier="ByStatus"><Record><PropertyValue Property="Title" String="Amount by status"/><PropertyValue Property="ChartType" EnumMember="UI.ChartType/Column"/>
    <PropertyValue Property="Dimensions"><Collection><PropertyPath>Status</PropertyPath></Collection></PropertyValue><PropertyValue Property="Measures"><Collection><PropertyPath>Amount</PropertyPath></Collection></PropertyValue></Record></Annotation>
</Annotations>
  </Schema></edmx:DataServices>
</edmx:Edmx>`;

const model = buildModel(XML);
const data: Record<string, Row[]> = { Orders: [{ ID: '1', Status: 'A', Amount: 100 }, { ID: '2', Status: 'B', Amount: 50 }] };

function wrap(children: ReactNode) {
  return (
    <MantineProvider theme={smartKitMantineTheme}>
      <SmartKitProvider services={{ t: { model, dataProvider: new MemoryProvider({ model, data }), variants: new MemoryVariantStore() } }} locale="en" namespace={`chart-actions-${Math.random()}`}>
        {children}
      </SmartKitProvider>
    </MantineProvider>
  );
}

const META = '@com.sap.vocabularies.UI.v1.Chart#ByStatus';
const view = () => document.querySelector('[data-sk-chart-view]')!;
const inline = (id: string) => view().querySelector(`[data-sk-action="${id}"]`);
const openOverflow = async () => {
  fireEvent.click(view().querySelector('[data-sk-chart-overflow]')!);
  await waitFor(() => expect(document.querySelector('[role="menu"]')).not.toBeNull());
};
const overflowIds = () => [...document.querySelectorAll('[role="menu"] [data-sk-action]')].map((e) => e.getAttribute('data-sk-action'));

/** A chart section of `width` px (the toolbar measures the section with a ResizeObserver). */
function narrow(width: number) {
  vi.stubGlobal('ResizeObserver', class { constructor(private cb: (entries: unknown[]) => void) {} observe() { this.cb([]); } unobserve() {} disconnect() {} });
  const base = Object.getOwnPropertyDescriptor(Element.prototype, 'clientWidth')!;
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get(this: HTMLElement) { return this.classList.contains('sk-chartview') ? width : base.get!.call(this); } });
  return () => { delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth; };
}
let restore: (() => void) | undefined;
afterEach(() => { restore?.(); restore = undefined; vi.unstubAllGlobals(); });

describe('sap.fe.macros.Chart actions: overflow toolbar, AI operation, action groups', () => {
  it('AL-05 Chart: an action has no priority (stays while it fits), no group, no AI icon; a group without press is a plain menu button', async () => {
    render(wrap(<Chart contextPath="/Orders" metaPath={META} service="t" personalization={false}
      actions={[{ key: 'a', text: 'Alpha' }, { key: 'm', text: 'Menu', actions: [{ key: 'x', text: 'Xray' }] }]} />));
    await waitFor(() => expect(inline('a')).not.toBeNull());
    expect(inline('a')!.querySelector('[data-sk-ai-icon]')).toBeNull();
    expect(view().querySelector('[data-sk-chart-overflow]')).toBeNull();
    const menu = view().querySelector('[data-sk-action-group="m"]')!;
    expect(menu.tagName).toBe('BUTTON');
    expect(view().querySelector('[data-sk-split]')).toBeNull();
    // the menu items are not toolbar buttons
    expect(inline('x')).toBeNull();
  });

  it('AL-05 Chart: priority AlwaysOverflow goes into "More", Disappear is not shown, NeverOverflow stays in a narrow toolbar', async () => {
    restore = narrow(500);
    render(wrap(<Chart contextPath="/Orders" metaPath={META} service="t" personalization={false}
      actions={[
        { key: 'h', text: 'A rather long action label' },
        { key: 'n', text: 'Pinned action label', priority: 'NeverOverflow' },
        { key: 'o', text: 'Always', priority: 'AlwaysOverflow' },
        { key: 'd', text: 'Gone', priority: 'Disappear' },
      ]} />));
    await waitFor(() => expect(inline('n')).not.toBeNull());
    expect(inline('h')).toBeNull();
    expect(inline('o')).toBeNull();
    expect(inline('d')).toBeNull();
    await openOverflow();
    expect(overflowIds()).toEqual(['h', 'o']);
  });

  it('AL-05 Chart: actions of one group (overflowGroup, else group) move into "More" together; a Low action goes first', async () => {
    restore = narrow(560);
    render(wrap(<Chart contextPath="/Orders" metaPath={META} service="t" personalization={false}
      actions={[
        { key: 'hi', text: 'High' },
        { key: 'g1', text: 'One', group: 3 },
        { key: 'g2', text: 'A second action that does not fit', group: 3 },
        { key: 'lo', text: 'Low', priority: 'Low' },
      ]} />));
    await waitFor(() => expect(inline('hi')).not.toBeNull());
    // room 140: "High" (64) and "One" (57) fit; the long one does not, so its group (with "One") overflows; "Low" comes after the High ones
    expect(inline('g1')).toBeNull();
    expect(inline('g2')).toBeNull();
    await openOverflow();
    expect(overflowIds()).toEqual(['g1', 'g2', 'lo']);
  });

  it('AL-05 Chart: isAIOperation shows the AI icon; an action group with press is a split button, a menu of AI operations shows the icon', async () => {
    const pressed: string[] = [];
    render(wrap(<Chart contextPath="/Orders" metaPath={META} service="t" personalization={false}
      actions={[
        { key: 'ai', text: 'Summarize', isAIOperation: true },
        { key: 's', text: 'Split', press: () => pressed.push('s'), actions: [{ key: 'x', text: 'Xray', isAIOperation: true, press: () => pressed.push('x') }] },
        { key: 'e', text: 'Empty', actions: [{ key: 'y', text: 'Hidden', visible: false }] },
      ]} />));
    await waitFor(() => expect(inline('ai')).not.toBeNull());
    expect(inline('ai')!.querySelector('[data-sk-ai-icon]')).not.toBeNull();
    const split = view().querySelector('[data-sk-action-group="s"][data-sk-split]')!;
    expect(split.querySelector('[data-sk-ai-icon]')).not.toBeNull();
    // a menu without visible actions is not shown
    expect(view().querySelector('[data-sk-action-group="e"]')).toBeNull();
    fireEvent.click(split.querySelector('[data-sk-action-group-default="s"]')!);
    expect(pressed).toEqual(['s']);
    fireEvent.click(split.querySelector('[data-sk-action-group-arrow="s"]')!);
    fireEvent.click(await screen.findByText('Xray'));
    expect(pressed).toEqual(['s', 'x']);
  });
});

const LR = (p: $ListReportSettings) => <ListReport service="t" contextPath="/Orders" initialLoad="Enabled" {...p} />;

describe('AL-13 list report chart actions (controlConfiguration › @UI.Chart › actions)', () => {
  it('AL-13 priority, group and isAIOperation reach the chart toolbar', async () => {
    restore = narrow(700);
    render(wrap(LR({
      controlConfiguration: {
        [META]: {
          actions: {
            a: { text: 'Assist', isAIOperation: true },
            b: { text: 'Back office', priority: 'AlwaysOverflow' },
            c: { text: 'Gone', priority: 'Disappear' },
            g1: { text: 'One', group: 2 },
            g2: { text: 'A second action that does not fit', group: 2 },
          },
        },
      },
    })));
    await waitFor(() => expect(inline('a')).not.toBeNull());
    expect(inline('a')!.querySelector('[data-sk-ai-icon]')).not.toBeNull();
    expect(inline('b')).toBeNull();
    expect(inline('c')).toBeNull();
    expect(inline('g1')).toBeNull();
    await openOverflow();
    expect(overflowIds()).toEqual(['b', 'g1', 'g2']);
  });

  it('AL-13 a menu with defaultAction is a split button running the default action; its actions leave the toolbar', async () => {
    const pressed: string[] = [];
    render(wrap(LR({
      controlConfiguration: {
        [META]: {
          actions: {
            m: { text: 'Process', menu: ['x', 'y'], defaultAction: 'x' },
            x: { text: 'Approve', press: () => pressed.push('x') },
            y: { text: 'Reject', press: () => pressed.push('y') },
            n: { text: 'Plain menu', menu: ['z'] },
            z: { text: 'Zulu' },
          },
        },
      },
    })));
    await waitFor(() => expect(view().querySelector('[data-sk-action-group="m"]')).not.toBeNull());
    expect(inline('x')).toBeNull();
    expect(inline('y')).toBeNull();
    expect(inline('z')).toBeNull();
    expect(view().querySelector('[data-sk-action-group="m"]')!.hasAttribute('data-sk-split')).toBe(true);
    expect(view().querySelector('[data-sk-action-group="n"]')!.hasAttribute('data-sk-split')).toBe(false);
    fireEvent.click(view().querySelector('[data-sk-action-group-default="m"]')!);
    expect(pressed).toEqual(['x']);
    fireEvent.click(view().querySelector('[data-sk-action-group-arrow="m"]')!);
    fireEvent.click(await screen.findByText('Reject'));
    expect(pressed).toEqual(['x', 'y']);
  });

  it('AL-13 isPrimaryAction and template have no effect in the chart toolbar, as in FE 1.154 (a plain button with text and press)', async () => {
    const pressed: string[] = [];
    render(wrap(LR({
      liveMode: true,
      controlConfiguration: {
        [META]: {
          actions: {
            p: { text: 'Primary', isPrimaryAction: true },
            t: { text: 'Templated', template: () => <span data-x-template>custom</span>, press: () => pressed.push('t') },
          },
        },
      },
    })));
    await waitFor(() => expect(inline('p')).not.toBeNull());
    expect(inline('p')!.getAttribute('data-variant')).toBe('subtle');
    expect(document.querySelector('[data-x-template]')).toBeNull();
    fireEvent.click(inline('t')!);
    expect(pressed).toEqual(['t']);
  });
});
