/**
 * Stage 6, list report leftovers (docs/31 stage 6, docs/26c): views with a UI.SelectionVariant path, combined views
 * (`primary` / `secondary` / `defaultPath`), `defaultTemplateAnnotationPath`, `content.header` (customHeader, header
 * action priority / overflow groups / primary action / menu), chart `controlConfiguration` (FE getP13nMode),
 * `variantManagement` "Control" and the "New Object" dialog fields (FE getCreatePopupFields) (AL-05, AL-13).
 * FE comparison: tests/e2e-fe/macros6-lr.spec.ts.
 */
import { MantineProvider } from '@mantine/core';
import { buildModel, MemoryProvider, MemoryVariantStore, type QueryRequest } from '@rhfan2019/smart-kit-core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { SmartKitProvider } from '../src/context/SmartKitProvider';
import { createPopupFields } from '../src/edit/NewObjectDialog';
import { smartKitMantineTheme } from '../src/theme/mantine';
import ListReport, { type $ListReportSettings } from '../src/v4/fe/templates/ListReport';
import { chartPersonalization, combinedDefault, conditionsToFilters, defaultTemplateView, nextPoints, pointConditions, viewTabs } from '../src/templates/ListReport';

const range = (path: string, value: string) => `<Record><PropertyValue Property="PropertyName" PropertyPath="${path}"/><PropertyValue Property="Ranges"><Collection><Record>
  <PropertyValue Property="Sign" EnumMember="UI.SelectionRangeSignType/I"/><PropertyValue Property="Option" EnumMember="UI.SelectionRangeOptionType/EQ"/><PropertyValue Property="Low" String="${value}"/>
</Record></Collection></PropertyValue></Record>`;

const XML = `<?xml version="1.0"?>
<edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx">
  <edmx:Reference Uri="u"><edmx:Include Namespace="com.sap.vocabularies.UI.v1" Alias="UI"/></edmx:Reference>
  <edmx:Reference Uri="c"><edmx:Include Namespace="com.sap.vocabularies.Common.v1" Alias="Common"/></edmx:Reference>
  <edmx:Reference Uri="o"><edmx:Include Namespace="Org.OData.Core.V1" Alias="Core"/></edmx:Reference>
  <edmx:DataServices><Schema xmlns="http://docs.oasis-open.org/odata/ns/edm" Namespace="T">
    <EntityType Name="Item"><Key><PropertyRef Name="ID"/></Key>
      <Property Name="ID" Type="Edm.String" Nullable="false"/><Property Name="Status" Type="Edm.String"/><Property Name="Area" Type="Edm.String"/>
      <Property Name="Created" Type="Edm.String"/><Property Name="Amount" Type="Edm.Decimal"/>
    </EntityType>
    <EntityContainer Name="C"><EntitySet Name="Items" EntityType="T.Item"/></EntityContainer>
    <Annotations Target="T.Item/Area"><Annotation Term="Core.Immutable" Bool="true"/></Annotations>
    <Annotations Target="T.Item/Created"><Annotation Term="Core.Computed" Bool="true"/></Annotations>
    <Annotations Target="T.Item">
      <Annotation Term="UI.HeaderInfo"><Record><PropertyValue Property="TypeName" String="Item"/><PropertyValue Property="TypeNamePlural" String="Items"/></Record></Annotation>
      <Annotation Term="UI.SelectionFields"><Collection><PropertyPath>Area</PropertyPath></Collection></Annotation>
      <Annotation Term="UI.LineItem"><Collection>
        <Record Type="UI.DataField"><PropertyValue Property="Value" Path="ID"/></Record>
        <Record Type="UI.DataField"><PropertyValue Property="Value" Path="Status"/></Record>
      </Collection></Annotation>
      <Annotation Term="UI.SelectionVariant" Qualifier="Open"><Record><PropertyValue Property="Text" String="Open items"/>
        <PropertyValue Property="SelectOptions"><Collection>${range('Status', 'O')}</Collection></PropertyValue></Record></Annotation>
      <Annotation Term="UI.SelectionPresentationVariant" Qualifier="North"><Record><PropertyValue Property="Text" String="North"/>
        <PropertyValue Property="SelectionVariant"><Record><PropertyValue Property="SelectOptions"><Collection>${range('Area', 'N')}</Collection></PropertyValue></Record></PropertyValue>
        <PropertyValue Property="PresentationVariant"><Record><PropertyValue Property="Visualizations"><Collection><AnnotationPath>@UI.LineItem</AnnotationPath></Collection></PropertyValue></Record></PropertyValue>
      </Record></Annotation>
    </Annotations>
  </Schema></edmx:DataServices>
</edmx:Edmx>`;
const model = buildModel(XML);
const ITEMS = Array.from({ length: 12 }, (_, i) => ({ ID: `i${i}`, Status: i % 2 ? 'O' : 'C', Area: i % 3 ? 'N' : 'S', Created: '', Amount: i }));

function host(children: ReactNode) {
  const provider = new MemoryProvider({ model, data: { Items: ITEMS } });
  const requests: QueryRequest[] = [];
  const query = provider.query.bind(provider);
  provider.query = (req, opts) => { requests.push(req); return query(req, opts); };
  const ui = (
    <MantineProvider theme={smartKitMantineTheme}>
      <SmartKitProvider services={{ s: { model, dataProvider: provider, variants: new MemoryVariantStore() } }} locale="en" namespace={`macros6-lr-${Math.random()}`}>{children}</SmartKitProvider>
    </MantineProvider>
  );
  return { ui, requests };
}
const LR = (p: $ListReportSettings) => <ListReport service="s" contextPath="/Items" initialLoad="Enabled" {...p} controlConfiguration={{ '@com.sap.vocabularies.UI.v1.LineItem': { tableSettings: { type: 'ResponsiveTable' } }, ...p.controlConfiguration }} />;
const ui = model.ui['T.Item']!;

describe('AL-13 views (FE ListReportConverter getViews)', () => {
  it('AL-13 views.paths: a UI.SelectionVariant path is the default table filtered by the SV, titled by its Text', () => {
    const [tab] = viewTabs(model, 'Items', [{ key: 'open', annotationPath: 'com.sap.vocabularies.UI.v1.SelectionVariant#Open' }]);
    expect(tab).toMatchObject({ key: 'open', title: 'Open items', conditions: [{ path: 'Status', operator: 'EQ', values: ['O'] }] });
    expect(tab!.metaPath).toBeUndefined();
  });

  it('AL-13 keepPreviousPersonalization marks the view table; defaultTemplateAnnotationPath is the default visualization', () => {
    const [a] = viewTabs(model, 'Items', [{ key: 'k', annotationPath: 'com.sap.vocabularies.UI.v1.LineItem', keepPreviousPersonalization: true }], '@com.sap.vocabularies.UI.v1.SelectionPresentationVariant#North');
    expect(a).toMatchObject({ keep: true, metaPath: '@com.sap.vocabularies.UI.v1.SelectionPresentationVariant#North' });
  });

  it('AL-05 combined view: defaultPath "both" (default) shows chart and table, "primary" the chart, "secondary" the table; not on desktop "both" is the chart', () => {
    expect(combinedDefault(undefined)).toBe('Hybrid');
    expect(combinedDefault('primary')).toBe('Chart');
    expect(combinedDefault('secondary')).toBe('Table');
    expect(combinedDefault('both', false)).toBe('Chart');
  });

  it('AL-13 combined view: selected chart points filter the table by their dimension values (FE ChartUtils setChartFilters)', () => {
    const pts = nextPoints([], { selected: true, data: [{ data: { Status: 'O', Amount: 3 } }, { data: { Status: 'C', Amount: 1 } }] });
    expect(pointConditions(pts, (p) => p === 'Status').map((c) => c.values[0])).toEqual(['O', 'C']);
    expect(nextPoints(pts, { selected: false, data: [{ data: { Status: 'O', Amount: 3 } }] })).toEqual([{ Status: 'C', Amount: 1 }]);
  });
});

describe('AL-13 defaultTemplateAnnotationPath (FE getCompliantVisualizationAnnotation, getSelectionVariant)', () => {
  it('AL-13 only an SPV counts; its SV becomes the filter defaults', () => {
    expect(defaultTemplateView(ui, 'com.sap.vocabularies.UI.v1.SelectionPresentationVariant#North')?.id).toBe('North');
    expect(defaultTemplateView(ui, 'com.sap.vocabularies.UI.v1.SelectionVariant#Open')).toBeUndefined();
    expect(conditionsToFilters(defaultTemplateView(ui, '@com.sap.vocabularies.UI.v1.SelectionPresentationVariant#North')!.conditions)).toEqual({ Area: [{ operator: 'EQ', values: ['N'], exclude: undefined }] });
  });

  it('AL-13 the table reads with the SPV selection variant on start', async () => {
    const h = host(LR({ defaultTemplateAnnotationPath: 'com.sap.vocabularies.UI.v1.SelectionPresentationVariant#North' }));
    render(h.ui);
    await waitFor(() => expect(h.requests.some((r) => r.filters?.Area?.[0]?.values[0] === 'N')).toBe(true));
  });
});

describe('AL-05 chart controlConfiguration (FE Chart converter getP13nMode)', () => {
  it('AL-05 default "Sort,Type,Item"; true or variantManagement "Control" all; false none; an object its panels', () => {
    expect(chartPersonalization(undefined, 'Page')).toBe('Sort,Type,Item');
    expect(chartPersonalization(undefined, 'Control')).toBe('Sort,Type,Item,Filter');
    expect(chartPersonalization(true, 'Page')).toBe('Sort,Type,Item,Filter');
    expect(chartPersonalization(false, 'Control')).toBe(false);
    expect(chartPersonalization('false', 'Page')).toBe(false);
    expect(chartPersonalization({ sort: true, type: true }, 'Page')).toBe('Type,Sort');
  });
});

describe('AL-13 content.header (FE getHeaderActions, customHeader)', () => {
  it('AL-13 custom header fragments; the primary action first and emphasized in live mode; AlwaysOverflow in the overflow; a menu', async () => {
    const h = host(LR({
      liveMode: true,
      content: {
        header: {
          customHeader: { expandedHeaderFragment: () => <span data-x-expanded>Overview</span> },
          actions: {
            a: { text: 'Alpha' },
            b: { text: 'Beta', priority: 'AlwaysOverflow' },
            g: { text: 'Gamma', isPrimaryAction: true },
            m: { text: 'More actions', menu: ['x'] },
            x: { text: 'Xray' },
          },
        },
      },
    }));
    render(h.ui);
    await waitFor(() => expect(document.querySelector('[data-x-expanded]')).not.toBeNull());
    const inline = [...document.querySelectorAll('[data-sk-toolbar-item] [data-sk-header-action], [data-sk-toolbar-item] [data-sk-header-menu]')].map((e) => e.textContent);
    expect(inline).toEqual(['Gamma', 'Alpha', 'More actions']);
    expect(document.querySelector('[data-sk-header-action="g"]')!.getAttribute('data-variant')).toBe('filled');
    // menu items leave the toolbar (FE getActionsFromManifest: menu actions are no toolbar actions)
    expect(document.querySelector('[data-sk-toolbar-item] [data-sk-header-action="x"]')).toBeNull();
    fireEvent.click(document.querySelector('[data-sk-toolbar-more]')!);
    await waitFor(() => expect(screen.getByText('Beta')).toBeTruthy());
  });
});

describe('AL-13 variantManagement "Control"', () => {
  it('AL-13 the title keeps a variant management (the filter bar\'s), stored apart from the page variants', async () => {
    const h = host(LR({ variantManagement: 'Control' }));
    render(h.ui);
    await waitFor(() => expect(document.querySelector('[data-sk-variant]')).not.toBeNull());
  });

  it('AL-13 with a hidden filter bar the title is the page title', async () => {
    const h = host(LR({ variantManagement: 'Control', hideFilterBar: true, title: 'All items' }));
    render(h.ui);
    await waitFor(() => expect(document.querySelector('[data-sk-page-title]')?.textContent).toBe('All items'));
  });
});

describe('AL-13 New Object dialog fields (FE MetaModelFunction getCreatePopupFields)', () => {
  it('AL-13 non-computed keys first, then the immutable properties; computed ones never', () => {
    expect(createPopupFields(model, 'T.Item').map((f) => f.path)).toEqual(['ID', 'Area']);
  });
});
