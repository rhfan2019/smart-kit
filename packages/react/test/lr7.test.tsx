/**
 * Stage 7 (lr7): table toolbar menus with a default action (sap.fe.macros.table.ActionGroup `defaultAction`, manifest
 * `defaultAction`), custom toolbar content (manifest action `template`), `isPrimaryAction` without effect in the table
 * toolbar, annotation column overrides (`showDataFieldsLabel`, `settings.mergeCells` / `mergeComparisonProperties`,
 * `formatOptions`), the column AI notice and the column export settings. FE comparison: tests/e2e-fe/lr7.spec.ts.
 */
import { MantineProvider } from '@mantine/core';
import { buildModel, MemoryProvider, MemoryVariantStore, type Row } from '@rhfan2019/smart-kit-core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { SmartKitProvider } from '../src/context/SmartKitProvider';
import { smartKitMantineTheme } from '../src/theme/mantine';
import { exportColumns, toCells } from '../src/table/exportRows';
import type { ColumnItem } from '../src/table/Table';
import Table from '../src/v4/fe/macros/Table';
import ListReport, { type $ListReportSettings } from '../src/v4/fe/templates/ListReport';

const XML = `<?xml version="1.0"?>
<edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx">
  <edmx:Reference Uri="u"><edmx:Include Namespace="com.sap.vocabularies.UI.v1" Alias="UI"/></edmx:Reference>
  <edmx:Reference Uri="c"><edmx:Include Namespace="com.sap.vocabularies.Common.v1" Alias="Common"/></edmx:Reference>
  <edmx:DataServices><Schema xmlns="http://docs.oasis-open.org/odata/ns/edm" Namespace="T">
    <EntityType Name="Item"><Key><PropertyRef Name="ID"/></Key>
      <Property Name="ID" Type="Edm.String" Nullable="false"/><Property Name="Area" Type="Edm.String"/><Property Name="Note" Type="Edm.String"/>
      <Property Name="Open" Type="Edm.Boolean"/>
    </EntityType>
    <EntityContainer Name="C"><EntitySet Name="Items" EntityType="T.Item"/></EntityContainer>
    <Annotations Target="T.Item/Area"><Annotation Term="Common.Label" String="Area"/></Annotations>
    <Annotations Target="T.Item/Note"><Annotation Term="Common.Label" String="Note"/></Annotations>
    <Annotations Target="T.Item">
      <Annotation Term="UI.HeaderInfo"><Record><PropertyValue Property="TypeName" String="Item"/><PropertyValue Property="TypeNamePlural" String="Items"/></Record></Annotation>
      <Annotation Term="UI.FieldGroup" Qualifier="Info"><Record><PropertyValue Property="Data"><Collection>
        <Record Type="UI.DataField"><PropertyValue Property="Value" Path="Area"/></Record>
        <Record Type="UI.DataField"><PropertyValue Property="Value" Path="Note"/></Record>
      </Collection></PropertyValue></Record></Annotation>
      <Annotation Term="UI.LineItem"><Collection>
        <Record Type="UI.DataField"><PropertyValue Property="Value" Path="ID"/></Record>
        <Record Type="UI.DataField"><PropertyValue Property="Value" Path="Area"/></Record>
        <Record Type="UI.DataFieldForAnnotation"><PropertyValue Property="Label" String="Info"/><PropertyValue Property="Target" AnnotationPath="@UI.FieldGroup#Info"/></Record>
      </Collection></Annotation>
    </Annotations>
  </Schema></edmx:DataServices>
</edmx:Edmx>`;
const model = buildModel(XML);
const ITEMS: Row[] = [
  { ID: 'a', Area: 'North', Note: 'x', Open: true },
  { ID: 'b', Area: 'North', Note: 'y', Open: false },
  { ID: 'c', Area: 'South', Note: 'y', Open: true },
];

function host(children: ReactNode) {
  const provider = new MemoryProvider({ model, data: { Items: structuredClone(ITEMS) } });
  return (
    <MantineProvider theme={smartKitMantineTheme}>
      <SmartKitProvider services={{ s: { model, dataProvider: provider, variants: new MemoryVariantStore() } }} locale="en" namespace={`lr7-${Math.random()}`}>{children}</SmartKitProvider>
    </MantineProvider>
  );
}
const rowsShown = () => waitFor(() => expect(document.querySelectorAll('tr[data-sk-row]').length).toBe(3));
const cellsOf = (col: string) => [...document.querySelectorAll(`tr[data-sk-row] td[data-col="${col}"]`)];
const lineItemId = (path: string) => model.ui['T.Item']!.lineItem.find((f) => f.path === path || f.kind === path)!.id;

describe('AL-05 lr7: table menus with a default action (sap.fe.macros.table.ActionGroup)', () => {
  it('AL-05 Table: an ActionGroup with defaultAction is a split button whose main part runs that action; its items are a menu', async () => {
    const one = vi.fn();
    const two = vi.fn();
    render(host(<Table service="s" contextPath="/Items" type="ResponsiveTable" enableExport={false}
      actions={[{ key: 'g', text: 'Group', defaultAction: 'two', actions: [{ key: 'one', text: 'One', onPress: one }, { key: 'two', text: 'Two', onPress: two }] }]} />));
    await rowsShown();
    expect(document.querySelector('[data-sk-action-group="g"][data-sk-split]')).not.toBeNull();
    // the menu items left the toolbar
    expect(document.querySelector('.sk-table__toolbar-actions > .sk-table__action [data-sk-action="one"]')).toBeNull();
    fireEvent.click(document.querySelector('[data-sk-action-group-default="g"]')!);
    expect(two).toHaveBeenCalledTimes(1);
    fireEvent.click(document.querySelector('[data-sk-action-group-arrow="g"]')!);
    await waitFor(() => expect(document.querySelector('[data-sk-action="one"]')).not.toBeNull());
    expect([...document.querySelectorAll('[role="menuitem"]')].map((m) => m.textContent)).toEqual(['One', 'Two']);
  });

  it('AL-05 Table: an ActionGroup without defaultAction is a plain menu button; a group without items is not shown', async () => {
    render(host(<Table service="s" contextPath="/Items" type="ResponsiveTable" enableExport={false}
      actions={[{ key: 'g', text: 'Group', actions: [{ key: 'one', text: 'One', onPress: () => undefined }] }, { key: 'empty', text: 'Empty', actions: [] }]} />));
    await rowsShown();
    expect(document.querySelector('[data-sk-action-group="g"]')).not.toBeNull();
    expect(document.querySelector('[data-sk-split]')).toBeNull();
    expect(document.querySelector('[data-sk-action-group="empty"]')).toBeNull();
  });
});

const LR = (p: $ListReportSettings) => <ListReport service="s" contextPath="/Items" initialLoad="Enabled" {...p} controlConfiguration={{ '@com.sap.vocabularies.UI.v1.LineItem': { tableSettings: { type: 'ResponsiveTable' }, ...p.controlConfiguration?.['@com.sap.vocabularies.UI.v1.LineItem'] } }} />;

describe('AL-13 lr7: manifest table actions (FE getActionsFromManifest, ActionsTemplating)', () => {
  it('AL-13 ListReport: a menu with defaultAction is a split button running that manifest action; isPrimaryAction has no effect in the table toolbar', async () => {
    const copy = vi.fn();
    render(host(<LR controlConfiguration={{ '@com.sap.vocabularies.UI.v1.LineItem': { actions: {
      copy: { text: 'Copy', press: copy, isPrimaryAction: true },
      other: { text: 'Other', press: () => undefined },
      more: { text: 'More', menu: ['copy', 'other'], defaultAction: 'copy' },
    } } }} />));
    await rowsShown();
    fireEvent.click(document.querySelector('[data-sk-action-group-default="more"]')!);
    expect(copy).toHaveBeenCalledTimes(1);
    expect(document.querySelectorAll('[data-sk-table] .mantine-Button-root[data-variant="filled"]').length).toBe(0);
  });

  it('AL-13 ListReport: an action with `template` puts its content into the toolbar instead of a button (FE getCustomToolbarContent)', async () => {
    render(host(<LR controlConfiguration={{ '@com.sap.vocabularies.UI.v1.LineItem': { actions: {
      note: { text: 'Note', template: () => <span data-testid="note">Toolbar note</span> },
    } } }} />));
    await rowsShown();
    expect(document.querySelector('[data-sk-toolbar-content="note"]')?.textContent).toBe('Toolbar note');
    expect(document.querySelector('[data-sk-action="note"]')).toBeNull();
  });
});

describe('AL-13 lr7: annotation column overrides (FE getColumnsFromManifest isColumnOverride)', () => {
  it('AL-13 ListReport: settings.mergeCells leaves a cell equal to the one above empty in responsive tables; the top-level mergeCells has no effect (FE)', async () => {
    const area = lineItemId('Area');
    const { unmount } = render(host(<LR controlConfiguration={{ '@com.sap.vocabularies.UI.v1.LineItem': { columns: { [area]: { importance: 'High', settings: { mergeCells: true } } } } }} />));
    await rowsShown();
    expect(cellsOf(area).map((c) => c.hasAttribute('data-sk-merged'))).toEqual([false, true, false]);
    expect(cellsOf(area)[0]!.textContent).toBe('North');
    unmount();
    render(host(<LR controlConfiguration={{ '@com.sap.vocabularies.UI.v1.LineItem': { columns: { [area]: { importance: 'High', mergeCells: true } } } }} />));
    await rowsShown();
    expect(cellsOf(area).some((c) => c.hasAttribute('data-sk-merged'))).toBe(false);
  });

  it('AL-13 ListReport: mergeComparisonProperties compares those properties', async () => {
    const area = lineItemId('Area');
    render(host(<LR controlConfiguration={{ '@com.sap.vocabularies.UI.v1.LineItem': { columns: { [area]: { importance: 'High', settings: { mergeCells: true, mergeComparisonProperties: ['Area', 'Note'] } } } } }} />));
    await rowsShown();
    expect(cellsOf(area).map((c) => c.hasAttribute('data-sk-merged'))).toEqual([false, false, false]);
  });

  it('AL-13 ListReport: showDataFieldsLabel shows each field of a field group column with its label; an override keeps the annotation column', async () => {
    const group = lineItemId('fieldGroup');
    render(host(<LR controlConfiguration={{ '@com.sap.vocabularies.UI.v1.LineItem': { columns: { [group]: { importance: 'High', showDataFieldsLabel: true, width: '20rem' } } } }} />));
    await rowsShown();
    expect([...cellsOf(group)[0]!.querySelectorAll('[data-sk-field-group-label]')].map((l) => l.textContent)).toEqual(['Area:', 'Note:']);
    expect(cellsOf(group)[0]!.textContent).toContain('North');
  });

  it('AL-13 ListReport: aiNotice puts an AI button into the column header that opens the notice', async () => {
    const area = lineItemId('Area');
    render(host(<LR controlConfiguration={{ '@com.sap.vocabularies.UI.v1.LineItem': { columns: { [area]: { importance: 'High', aiNotice: { contentText: 'Suggested by AI' } } } } }} />));
    await rowsShown();
    fireEvent.click(document.querySelector('[data-sk-ai-notice]')!);
    await waitFor(() => expect(screen.getByText('Suggested by AI')).toBeTruthy());
    expect(screen.getAllByText('Created with AI').length).toBeGreaterThan(0);
  });
});

describe('AL-13 lr7: column export settings (sap.fe.macros.table.ColumnExportSettings)', () => {
  const service = { model, dataProvider: new MemoryProvider({ model, data: {} }) } as never;
  const field = model.ui['T.Item']!.lineItem.find((f) => f.path === 'Area')!;
  it('AL-13 toCells: label, property with template, Boolean texts and Enumeration values; layout of width, wrap and alignment', () => {
    const columns: ColumnItem[] = [
      { id: 'a', label: 'Area', field, exportSettings: { label: 'Region', property: ['Area', 'Note'], template: '{0} ({1})' } },
      { id: 'o', label: 'Open', exportSettings: { type: 'Boolean', property: ['Open'], trueValue: 'Yes', falseValue: 'No' } },
      { id: 'n', label: 'Note', exportSettings: { type: 'Enumeration', property: ['Note'], valueMap: { x: 'Ex', y: 'Why' }, width: 12, textAlign: 'End' } },
      { id: 'c', label: 'Custom', select: ['Area', 'Note'] },
    ];
    const cells = toCells({ service, typeName: 'T.Item', columns, locale: 'en' }, ITEMS.slice(0, 1));
    expect(cells).toEqual([['Region', 'Open', 'Note', 'Custom'], ['North (x)', 'Yes', 'Ex', 'North\nx']]);
    expect(exportColumns(columns)).toEqual([
      { width: undefined, wrap: true, align: undefined, numeric: undefined },
      { width: undefined, wrap: false, align: undefined, numeric: false },
      { width: 12, wrap: false, align: 'right', numeric: false },
      { width: undefined, wrap: true, align: undefined, numeric: undefined },
    ]);
  });
});
