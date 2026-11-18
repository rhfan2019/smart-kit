/** Tree tables (docs/26 §3.10, docs/27 UE-84–UE-88): TreeTable (sap.fe.macros.TreeTable) on the grid and responsive kernels. */
import { MantineProvider } from '@mantine/core';
import { buildModel, MemoryProvider, MemoryVariantStore, type QueryRequest, type Row } from '@rhfan2019/smart-kit-core';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRef, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { SmartKitProvider, smartKitMantineTheme } from '../src';
import ListReport from '@rhfan2019/smart-kit/v4/fe/templates/ListReport';
import Table from '../src/v4/fe/macros/Table';
import TreeTable from '../src/v4/fe/macros/TreeTable';

const model = buildModel(readFileSync(join(import.meta.dirname, '../../core/test/fixtures/tree.xml'), 'utf8'));
const units = (): Row[] => [
  { ID: 'A', Name: 'Alpha', ParentID: null, Headcount: 10 },
  { ID: 'A1', Name: 'Alpha One', ParentID: 'A', Headcount: 4 },
  { ID: 'A1a', Name: 'Alpha One A', ParentID: 'A1', Headcount: 2 },
  { ID: 'A2', Name: 'Alpha Two', ParentID: 'A', Headcount: 6 },
  { ID: 'B', Name: 'Beta', ParentID: null, Headcount: 3 },
  { ID: 'B1', Name: 'Beta One', ParentID: 'B', Headcount: 3 },
];

function host(children: ReactNode) {
  const provider = new MemoryProvider({ model, data: { Units: units(), Flats: [{ ID: 'F', Name: 'Flat' }] } });
  const requests: QueryRequest[] = [];
  const query = provider.query.bind(provider);
  provider.query = (req, opts) => { requests.push(req); return query(req, opts); };
  const ui = (
    <MantineProvider theme={smartKitMantineTheme}>
      <SmartKitProvider services={{ org: { model, dataProvider: provider, variants: new MemoryVariantStore() } }} locale="en" namespace="tree">
        {children}
      </SmartKitProvider>
    </MantineProvider>
  );
  return { ui, requests };
}

/** Visible rows as "<level>:<ID>:<drill state>" from the first cells. */
const shown = () => [...document.querySelectorAll<HTMLElement>('[data-sk-tree-level]')].map((el) => `${el.dataset.skTreeLevel}:${(el.closest('tr')?.dataset.skRow ?? '').replace(/[()']/g, '')}:${el.dataset.skDrillState}`);
const toggleOf = (name: string) => screen.getByText(name).closest('.sk-tree')!.querySelector<HTMLElement>('[data-sk-tree-toggle]')!;

describe('responsive tree table (UE-84, UE-85)', () => {
  it('UE-84 first level from TopLevels, indentation by DistanceFromRoot, the toggle expands with ExpandLevels and collapses', async () => {
    const { ui, requests } = host(<TreeTable service="org" contextPath="/Units" responsive enableExport={false} />);
    render(ui);
    await waitFor(() => expect(shown()).toEqual(['0:A:collapsed', '0:B:collapsed']));
    expect(requests.at(-1)!.hierarchy).toEqual({ qualifier: 'Org', nodeProperty: 'ID', levels: 1 });
    fireEvent.click(toggleOf('Alpha'));
    await waitFor(() => expect(shown()).toEqual(['0:A:expanded', '1:A1:collapsed', '1:A2:leaf', '0:B:collapsed']));
    expect(requests.at(-1)!.hierarchy!.expandLevels).toEqual([{ nodeId: 'A', levels: 1 }]);
    expect(screen.getByText('Alpha One').closest<HTMLElement>('.sk-tree')!.style.getPropertyValue('--sk-tree-level')).toBe('1');
    // leaves get a spacer instead of a toggle
    expect(screen.getByText('Alpha Two').closest('.sk-tree')!.querySelector('[data-sk-tree-toggle]')).toBeNull();
    fireEvent.click(toggleOf('Alpha'));
    await waitFor(() => expect(shown()).toEqual(['0:A:collapsed', '0:B:collapsed']));
  });

  it('UE-85 treegrid semantics: aria-level, aria-expanded, labelled toggle; row clicks on the toggle do not navigate', async () => {
    const onRowPress = vi.fn();
    const { ui } = host(<TreeTable service="org" contextPath="/Units" responsive onRowPress={onRowPress} enableExport={false} />);
    render(ui);
    const table = await screen.findByRole('treegrid');
    await waitFor(() => expect(table.querySelectorAll('tr[data-sk-row]')).toHaveLength(2));
    const first = table.querySelector<HTMLElement>('tr[data-sk-row]')!;
    expect(first).toHaveAttribute('aria-level', '1');
    expect(first).toHaveAttribute('aria-expanded', 'false');
    const toggle = toggleOf('Alpha');
    expect(toggle).toHaveAccessibleName('Expand node');
    fireEvent.click(toggle);
    await waitFor(() => expect(toggleOf('Alpha')).toHaveAccessibleName('Collapse node'));
    expect(table.querySelector('tr[data-sk-row]')).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Alpha One').closest('tr')).toHaveAttribute('aria-level', '2');
    expect(onRowPress).not.toHaveBeenCalled();
  });
});

describe('TreeTable methods and event (UE-86, UE-87)', () => {
  it('UE-86 ref: expand, collapse (single and several rows), isExpanded, expandToLevel, collapseAll', async () => {
    const ref = createRef<TreeTable>();
    const { ui, requests } = host(<TreeTable service="org" contextPath="/Units" responsive ref={ref} enableExport={false} />);
    render(ui);
    await waitFor(() => expect(shown()).toHaveLength(2));
    expect(ref.current!.isExpanded(0)).toBe(false);
    act(() => ref.current!.expand([0, 1]));
    await waitFor(() => expect(shown()).toEqual(['0:A:expanded', '1:A1:collapsed', '1:A2:leaf', '0:B:expanded', '1:B1:leaf']));
    expect(ref.current!.isExpanded(0)).toBe(true);
    expect(ref.current!.isExpanded(2)).toBe(false);
    act(() => ref.current!.collapse(3));
    await waitFor(() => expect(shown()).toEqual(['0:A:expanded', '1:A1:collapsed', '1:A2:leaf', '0:B:collapsed']));
    act(() => ref.current!.expandToLevel(3));
    await waitFor(() => expect(shown()).toHaveLength(6));
    expect(requests.at(-1)!.hierarchy).toEqual({ qualifier: 'Org', nodeProperty: 'ID', levels: 3 });
    // a node open by the levels is collapsed with ExpandLevels Levels 0
    act(() => ref.current!.collapse(0));
    await waitFor(() => expect(shown()).toEqual(['0:A:collapsed', '0:B:expanded', '1:B1:leaf']));
    expect(requests.at(-1)!.hierarchy!.expandLevels).toEqual([{ nodeId: 'A', levels: 0 }]);
    act(() => ref.current!.collapseAll());
    await waitFor(() => expect(shown()).toEqual(['0:A:collapsed', '0:B:collapsed']));
  });

  it('UE-87 onToggleOpenState({ rowIndex, rowContext, expanded }) on user toggles, not on method calls', async () => {
    const onToggleOpenState = vi.fn();
    const ref = createRef<TreeTable>();
    const { ui } = host(<TreeTable service="org" contextPath="/Units" responsive ref={ref} onToggleOpenState={onToggleOpenState} enableExport={false} />);
    render(ui);
    await waitFor(() => expect(shown()).toHaveLength(2));
    fireEvent.click(toggleOf('Beta'));
    expect(onToggleOpenState).toHaveBeenCalledWith({ rowIndex: 1, rowContext: expect.objectContaining({ ID: 'B', Name: 'Beta' }), expanded: true });
    await waitFor(() => expect(shown()).toHaveLength(3));
    fireEvent.click(toggleOf('Beta'));
    expect(onToggleOpenState).toHaveBeenLastCalledWith(expect.objectContaining({ rowIndex: 1, expanded: false }));
    act(() => ref.current!.expand(0));
    await waitFor(() => expect(shown()).toHaveLength(4));
    expect(onToggleOpenState).toHaveBeenCalledTimes(2);
  });
});

describe('sap.fe.macros.TreeTable (v4/fe/macros/TreeTable)', () => {
  it('AL-05 TreeTable: disableLeafSelection keeps leaves out of the selection', async () => {
    const onSelectionChange = vi.fn();
    const { ui } = host(<TreeTable service="org" contextPath="/Units" responsive initialExpansionLevel={2} disableLeafSelection onSelectionChange={onSelectionChange} enableExport={false} />);
    render(ui);
    await waitFor(() => expect(shown()).toContain('1:A2:leaf'));
    const checkbox = (name: string) => screen.getByText(name).closest('tr')!.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    fireEvent.click(checkbox('Alpha Two'));
    expect(onSelectionChange).toHaveBeenLastCalledWith({ selectedContexts: [] });
    fireEvent.click(checkbox('Alpha'));
    const last = onSelectionChange.mock.calls.at(-1)![0] as { selectedContexts: { getPath(): string }[] };
    expect(last.selectedContexts.map((c) => c.getPath())).toEqual(["/Units('A')"]);
  });

  it('AL-07 TreeTable: ref has the Table methods (refresh, getAllCurrentContexts, getSelectedContexts) besides the tree methods', async () => {
    const ref = createRef<TreeTable>();
    const { ui, requests } = host(<TreeTable service="org" contextPath="/Units" responsive ref={ref} enableExport={false} />);
    render(ui);
    await waitFor(() => expect(shown()).toHaveLength(2));
    expect(ref.current!.getAllCurrentContexts().map((c) => c.getPath())).toEqual(["/Units('A')", "/Units('B')"]);
    expect(ref.current!.getSelectedContexts()).toEqual([]);
    const before = requests.length;
    act(() => ref.current!.refresh());
    await waitFor(() => expect(requests.length).toBeGreaterThan(before));
  });
});

describe('table types (UE-88)', () => {
  it('UE-88 grid tree table: client-side rows with the toggle in the first column; no grouping or totals offered', async () => {
    const { ui, requests } = host(<TreeTable service="org" contextPath="/Units" enableExport={false} />);
    render(ui);
    await waitFor(() => expect(document.querySelectorAll('.ag-row [data-sk-tree-toggle]').length).toBeGreaterThan(0));
    expect(document.querySelector('.sk-table--grid')).not.toBeNull();
    fireEvent.click(toggleOf('Alpha'));
    await waitFor(() => expect(screen.getByText('Alpha One')).toBeInTheDocument());
    expect(requests.every((r) => r.hierarchy && r.skip === undefined && r.top === undefined)).toBe(true);
    fireEvent.click(document.querySelector('[data-sk-table-settings]')!);
    expect(await screen.findByRole('dialog')).not.toHaveTextContent('Group');
  });

  it('UE-88 type ResponsiveTable picks the responsive kernel, GridTable the grid; TreeTable without a hierarchy is a plain table', async () => {
    const a = host(<Table service="org" contextPath="/Units" type="ResponsiveTable" enableExport={false} />);
    const { unmount } = render(a.ui);
    await waitFor(() => expect(document.querySelectorAll('tr[data-sk-row]')).toHaveLength(6));
    expect(document.querySelector('[data-sk-tree-toggle]')).toBeNull();
    expect(a.requests.every((r) => !r.hierarchy)).toBe(true);
    unmount();
    const b = host(<TreeTable service="org" contextPath="/Flats" responsive enableExport={false} />);
    const second = render(b.ui);
    await waitFor(() => expect(document.querySelectorAll('tr[data-sk-row]')).toHaveLength(1));
    expect(b.requests.every((r) => !r.hierarchy)).toBe(true);
    second.unmount();
    const c = host(<Table service="org" contextPath="/Units" type="GridTable" enableExport={false} />);
    render(c.ui);
    await waitFor(() => expect(document.querySelector('.sk-table--grid')).not.toBeNull());
  });

  it('UE-88 ListReport tableSettings.type "TreeTable" (and "ResponsiveTable")', async () => {
    const a = host(<ListReport service="org" contextPath="/Units" initialLoad="Enabled" controlConfiguration={{ '@com.sap.vocabularies.UI.v1.LineItem': { tableSettings: { type: 'TreeTable' } } }} liveMode />);
    const { unmount } = render(a.ui);
    await waitFor(() => expect(document.querySelectorAll('[data-sk-tree-toggle]').length).toBeGreaterThan(0));
    expect(a.requests.some((r) => r.hierarchy?.qualifier === 'Org')).toBe(true);
    unmount();
    const b = host(<ListReport service="org" contextPath="/Units" initialLoad="Enabled" controlConfiguration={{ '@com.sap.vocabularies.UI.v1.LineItem': { tableSettings: { type: 'ResponsiveTable' } } }} liveMode />);
    render(b.ui);
    await waitFor(() => expect(document.querySelector('.sk-table--responsive')).not.toBeNull());
  });
});
