/** UI5 alignment of the tables (ADR-033, stage 2): sap.fe.macros.Table / TreeTable (v4/fe/macros/*) and sap.m.Table (m/Table). */
import { MantineProvider } from '@mantine/core';
import { MemoryProvider, MemoryVariantStore, type QueryRequest, type Row } from '@rhfan2019/smart-kit-core';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createRef, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { SmartKitProvider } from '../src/context/SmartKitProvider';
import { smartKitMantineTheme } from '../src/theme/mantine';
import MTable from '../src/m/Table';
import Table from '../src/v4/fe/macros/Table';
import { shopData, shopModel } from './helpers';

function host(children: ReactNode) {
  const provider = new MemoryProvider({ model: shopModel, data: structuredClone(shopData) });
  const requests: QueryRequest[] = [];
  const query = provider.query.bind(provider);
  provider.query = (req, opts) => { requests.push(req); return query(req, opts); };
  const ui = (
    <MantineProvider theme={smartKitMantineTheme}>
      <SmartKitProvider services={{ shop: { model: shopModel, dataProvider: provider, variants: new MemoryVariantStore() } }} locale="en" namespace="table-ui5">
        {children}
      </SmartKitProvider>
    </MantineProvider>
  );
  return { ui, requests };
}

const rows: Row[] = Array.from({ length: 25 }, (_, i) => ({ ID: i + 1, Name: `Row ${i + 1}`, Notes: `Note ${i + 1}` }));
const columns = [
  { id: 'Name', header: 'Name', importance: 'High' as const, cell: (r: Row) => String(r.Name) },
  { id: 'Notes', header: 'Notes', importance: 'Low' as const, cell: (r: Row) => String(r.Notes) },
];
const keyOf = (r: Row) => String(r.ID);
const mHost = (children: ReactNode) => host(children).ui;
const shownRows = () => document.querySelectorAll('tr[data-sk-row]').length;

describe('sap.m.Table (m/Table)', () => {
  it('AL-05 Table: defaults — mode None, no growing, fixed layout, the default no-data text', () => {
    const { unmount } = render(mHost(<MTable columns={columns} items={rows} keyOf={keyOf} />));
    expect(shownRows()).toBe(25);
    expect(document.querySelector('.sk-rtable__table input[type="checkbox"]')).toBeNull();
    expect(document.querySelector<HTMLElement>('.sk-rtable__table')!.style.tableLayout).toBe('fixed');
    expect(document.querySelector('[data-sk-more]')).toBeNull();
    unmount();
    render(mHost(<MTable columns={columns} items={[]} keyOf={keyOf} />));
    expect(screen.getByText('No items available.')).toBeInTheDocument();
  });

  it('AL-05 Table: growing shows growingThreshold (20) items and a "More" button that loads the next page', () => {
    const onUpdateStarted = vi.fn();
    render(mHost(<MTable columns={columns} items={rows} keyOf={keyOf} growing onUpdateStarted={onUpdateStarted} />));
    expect(shownRows()).toBe(20);
    fireEvent.click(document.querySelector('[data-sk-more]')!);
    expect(onUpdateStarted).toHaveBeenCalledWith({ reason: 'Growing', actual: 20, total: 25 });
    expect(shownRows()).toBe(25);
    expect(document.querySelector('[data-sk-more]')).toBeNull();
  });

  it('AL-06 Table: selectionChange({ listItem, listItems, selected, selectAll }), itemPress({ listItem, srcControl }), delete({ listItem })', () => {
    const onSelectionChange = vi.fn();
    const onItemPress = vi.fn();
    const { unmount } = render(mHost(<MTable columns={columns} items={rows.slice(0, 3)} keyOf={keyOf} mode="MultiSelect" navigable onSelectionChange={onSelectionChange} onItemPress={onItemPress} />));
    fireEvent.click(screen.getAllByRole('checkbox', { name: 'Select row' })[1]!);
    expect(onSelectionChange).toHaveBeenLastCalledWith({ listItem: rows[1], listItems: [rows[1]], selected: true, selectAll: false });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select all' }));
    expect(onSelectionChange).toHaveBeenLastCalledWith(expect.objectContaining({ listItems: rows.slice(0, 3), selected: true, selectAll: true }));
    fireEvent.click(screen.getByText('Row 3'));
    expect(onItemPress).toHaveBeenCalledWith({ listItem: rows[2], srcControl: screen.getByText('Row 3').closest('td') ?? expect.anything() });
    unmount();
    const onDelete = vi.fn();
    render(mHost(<MTable columns={columns} items={rows.slice(0, 2)} keyOf={keyOf} mode="Delete" onDelete={onDelete} />));
    fireEvent.click(document.querySelectorAll('[data-sk-row-delete]')[1]!);
    expect(onDelete).toHaveBeenCalledWith({ listItem: rows[1] });
  });

  it('AL-06 Table: popinChanged({ hasPopin, visibleInPopin, hiddenInPopin }) with autoPopinMode; hiddenInPopin hides the pop-in', () => {
    const onPopinChanged = vi.fn();
    const { rerender } = render(mHost(<MTable columns={columns} items={rows.slice(0, 1)} keyOf={keyOf} autoPopinMode contextualWidth="Phone" onPopinChanged={onPopinChanged} />));
    expect(onPopinChanged).toHaveBeenLastCalledWith({ hasPopin: true, visibleInPopin: [columns[1]], hiddenInPopin: [] });
    expect(document.querySelector('[data-sk-popin]')).toHaveTextContent('Note 1');
    rerender(mHost(<MTable columns={columns} items={rows.slice(0, 1)} keyOf={keyOf} autoPopinMode contextualWidth="Phone" hiddenInPopin={['Low']} onPopinChanged={onPopinChanged} />));
    expect(onPopinChanged).toHaveBeenLastCalledWith({ hasPopin: false, visibleInPopin: [], hiddenInPopin: [columns[1]] });
    expect(document.querySelector('[data-sk-popin]')).toBeNull();
  });

  it('AL-06 Table: paste({ data }) as rows of cells', () => {
    const onPaste = vi.fn();
    render(mHost(<MTable columns={columns} items={rows.slice(0, 1)} keyOf={keyOf} onPaste={onPaste} />));
    fireEvent.paste(document.querySelector('.sk-rtable__table')!, { clipboardData: { getData: () => 'a\tb\nc\td\n' } });
    expect(onPaste).toHaveBeenCalledWith({ data: [['a', 'b'], ['c', 'd']], preventDefault: expect.any(Function) });
  });

  it('AL-07 Table: ref selectAll, getSelectedItems, getSelectedItem, setSelectedItem, removeSelections, getGrowingInfo, requestItems', () => {
    const ref = createRef<MTable>();
    render(mHost(<MTable ref={ref} columns={columns} items={rows} keyOf={keyOf} mode="MultiSelect" growing growingThreshold={10} />));
    expect(ref.current!.getGrowingInfo()).toEqual({ actual: 10, total: 25 });
    act(() => ref.current!.requestItems());
    expect(shownRows()).toBe(20);
    act(() => ref.current!.setSelectedItem(rows[4]!));
    expect(ref.current!.getSelectedItem()).toBe(rows[4]);
    act(() => ref.current!.selectAll());
    expect(ref.current!.getSelectedItems()).toHaveLength(20);
    act(() => ref.current!.removeSelections(true));
    expect(ref.current!.getSelectedItems()).toEqual([]);
  });
});

describe('sap.fe.macros.Table (v4/fe/macros/Table)', () => {
  it('AL-05 Table: headerVisible false hides the title; initialLoad false loads only after refresh(); ignoredFields drops columns', async () => {
    const ref = createRef<Table>();
    const a = host(<Table ref={ref} service="shop" contextPath="/Products" type="ResponsiveTable" headerVisible={false} initialLoad={false} ignoredFields="Notes, Price" />);
    render(a.ui);
    expect(document.querySelector('[data-sk-table-title]')).toBeNull();
    expect(screen.getAllByText('To start, set the relevant filters.').length).toBeGreaterThan(0);
    expect(a.requests).toHaveLength(0);
    const headers = [...document.querySelectorAll('.sk-rtable__table thead th')].map((h) => h.textContent);
    expect(headers).not.toContain('Price');
    act(() => ref.current!.refresh());
    expect(await screen.findByText('P1')).toBeInTheDocument();
  });

  it('AL-05 Table: selectionMode None removes the selection column; Single selects one row', async () => {
    const { unmount } = render(host(<Table service="shop" contextPath="/Products" type="ResponsiveTable" selectionMode="None" />).ui);
    await screen.findByText('P1');
    expect(screen.queryAllByRole('checkbox', { name: 'Select row' })).toHaveLength(0);
    unmount();
    const onSelectionChange = vi.fn();
    render(host(<Table service="shop" contextPath="/Products" type="ResponsiveTable" selectionMode="Single" onSelectionChange={onSelectionChange} />).ui);
    await screen.findByText('P1');
    const radios = screen.getAllByRole('radio', { name: 'Select row' });
    fireEvent.click(radios[0]!);
    fireEvent.click(radios[1]!);
    const last = onSelectionChange.mock.calls.at(-1)![0] as { selectedContexts: { getPath(): string }[] };
    expect(last.selectedContexts.map((c) => c.getPath())).toEqual(['/Products(2)']);
  });

  it('AL-06 Table: rowPress({ bindingContext }) and selectionChange({ selectedContexts }) carry contexts (getPath, getObject)', async () => {
    const onRowPress = vi.fn();
    const onSelectionChange = vi.fn();
    render(host(<Table service="shop" contextPath="/Products" type="ResponsiveTable" onRowPress={onRowPress} onSelectionChange={onSelectionChange} />).ui);
    fireEvent.click(await screen.findByText('P1'));
    const ctx = (onRowPress.mock.calls[0]![0] as { bindingContext: { getPath(): string; getObject(): Row } }).bindingContext;
    expect(ctx.getPath()).toBe('/Products(1)');
    expect(ctx.getObject()).toEqual(expect.objectContaining({ ID: 1, Code: 'P1' }));
    fireEvent.click(screen.getAllByRole('checkbox', { name: 'Select row' })[0]!);
    const sel = onSelectionChange.mock.calls.at(-1)![0] as { selectedContexts: { getPath(): string }[] };
    expect(sel.selectedContexts.map((c) => c.getPath())).toEqual(['/Products(1)']);
  });

  it('AL-06 Table: columns and actions aggregations (sap.fe.macros.table.Column / Action) placed by anchor and placement', async () => {
    const onPress = vi.fn();
    render(host(
      <Table service="shop" contextPath="/Products" rowCountMode="Fixed"
        columns={[{ key: 'Custom', header: 'Custom', anchor: 'DataField::Code', placement: 'After', template: (r) => `#${String(r.ID)}` }]}
        actions={[{ key: 'Mine', text: 'My Action', requiresSelection: true, onPress }]} />,
    ).ui);
    await screen.findByText('#1');
    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent?.trim()).filter(Boolean);
    expect(headers.slice(0, 3)).toEqual(['Product Code', 'Custom', 'Product Name']);
    const button = screen.getByRole('button', { name: 'My Action' });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('AL-07 Table: ref getCount, getAllCurrentContexts, getSelectedContexts, clearSelection, hideColumns, showColumns, changeColumnsLabel, get/setIgnoredFields, addMessage', async () => {
    const ref = createRef<Table>();
    render(host(<Table ref={ref} service="shop" contextPath="/Products" type="ResponsiveTable" />).ui);
    await screen.findByText('P1');
    await waitFor(() => expect(ref.current!.getCount()).toBe(25));
    expect(ref.current!.getAllCurrentContexts()[0]!.getPath()).toBe('/Products(1)');
    fireEvent.click(screen.getAllByRole('checkbox', { name: 'Select row' })[0]!);
    expect(ref.current!.getSelectedContexts().map((c) => c.getPath())).toEqual(['/Products(1)']);
    act(() => ref.current!.clearSelection());
    expect(ref.current!.getSelectedContexts()).toEqual([]);
    const headers = () => [...document.querySelectorAll('.sk-rtable__table thead th[data-col]')].map((h) => h.getAttribute('data-col')).filter((id) => id === 'DataField::Name' || id === 'DataField::Code');
    const popin = () => [...document.querySelectorAll('tr[data-sk-row]')][0]!.textContent ?? '';
    await act(() => ref.current!.hideColumns(['DataField::Name']));
    expect(headers()).toEqual(['DataField::Code']);
    await act(() => ref.current!.showColumns([{ key: 'DataField::Name', position: 0 }]));
    expect(headers()).toEqual(['DataField::Name', 'DataField::Code']);
    await act(() => ref.current!.changeColumnsLabel([{ key: 'DataField::Name', newLabel: 'Label X' }]));
    expect(document.querySelector('.sk-rtable__table thead th[data-col]')).toHaveTextContent('Label X');
    expect(ref.current!.getIgnoredFields()).toBe('');
    act(() => { ref.current!.setIgnoredFields('Name'); });
    await waitFor(() => expect(headers()).toEqual(['DataField::Code']));
    expect(popin()).not.toContain('Item 1');
    expect(ref.current!.getIgnoredFields()).toBe('Name');
    await expect(ref.current!.addMessage({ message: 'Hello', type: 'Warning' })).resolves.toMatch(/^table-/);
  });
});

describe('sap.m.Table autoPopinMode (Table._configureAutoPopin)', () => {
  it('keeps the columns that fit, by importance and width; the most important column always stays', async () => {
    const { autoPopinWidths } = await import('../src/table/ResponsiveTable');
    // order High, Medium (None), Low; 8rem each unless a fixed width is given; 1rem of selection column and padding
    expect(autoPopinWidths([{ importance: 'Low' }, { importance: 'High' }, {}, { importance: 'High', width: '120px' }, { width: '50%' }], 1)).toEqual([
      (1 + 8 + 7.5 + 8 + 8 + 8) * 16, // Low: last
      undefined, // the first High column never pops in
      (1 + 8 + 7.5 + 8) * 16,
      (1 + 8 + 7.5) * 16,
      (1 + 8 + 7.5 + 8 + 8) * 16, // a flexible width counts with autoPopinWidth
    ]);
    expect(autoPopinWidths([{ autoPopinWidth: 20 }, { autoPopinWidth: 4 }], 0)).toEqual([undefined, 24 * 16]);
  });
});
