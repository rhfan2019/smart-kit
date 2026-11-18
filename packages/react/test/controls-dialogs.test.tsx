/** Dialogs controls (docs/26 §3.8–3.9, ADR-032): DynamicDateRange, SelectDialog, TableSelectDialog, ViewSettingsDialog, Wizard, IconTabBar. */
import { MantineProvider } from '@mantine/core';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createRef, useState, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  DynamicDateRange, IconTabBar, IconTabFilter, IconTabSeparator, SelectDialog, TableSelectDialog, ViewSettingsDialog, Wizard, WizardStep,
  type DynamicDateRangeRef, type DynamicDateRangeValue, type SelectDialogRef, type StandardListItem, type TableSelectDialogRef, type ViewSettingsDialogRef,
  type WizardRef,
} from '../src/entries/controls';
import { dialogsEn } from '../src/i18n/controls/dialogs.en';
import { dialogsZh } from '../src/i18n/controls/dialogs.zh';
import { SmartKitProvider } from '../src';

const wrap = ({ children }: { children: ReactNode }) => <MantineProvider env="test">{children}</MantineProvider>;
const r = (ui: ReactNode) => render(ui, { wrapper: wrap });
const NOW = new Date(2026, 10, 18, 10, 30); // Wednesday 18 Nov 2026, 10:30 local
const day = (y: number, m: number, d: number, h = 0, mi = 0, s = 0, ms = 0) => new Date(y, m - 1, d, h, mi, s, ms);
const end = (y: number, m: number, d: number) => day(y, m, d, 23, 59, 59, 999);

describe('DynamicDateRange', () => {
  it('UE-60 lists the options in UI5 groups and picks an option without values directly', async () => {
    const onChange = vi.fn();
    r(<DynamicDateRange aria-label="Order date" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open date range options' }));
    const list = await screen.findByRole('listbox', { name: 'Date range options' });
    expect(within(list).getByRole('group', { name: 'Single Dates' })).toBeInTheDocument();
    expect(within(list).getByRole('group', { name: 'Quarters' })).toHaveTextContent('Fourth Quarter');
    // all 68 default keys; the 28 LAST/NEXT X options are four entries, as in UI5
    expect(list.querySelectorAll('[data-sk-ddr-option]')).toHaveLength(68 - 28 + 4);
    fireEvent.click(within(list).getByRole('option', { name: 'Today' }));
    expect(onChange).toHaveBeenCalledWith({ value: { operator: 'TODAY', values: [] }, valid: true });
  });

  it('UE-61 opens a detail page for options with values: Last X with a unit, a date range', async () => {
    const onChange = vi.fn();
    r(<DynamicDateRange aria-label="d" onChange={onChange} standardOptions={['LASTDAYS', 'LASTWEEKS', 'DATERANGE', 'SPECIFICMONTHINYEAR']} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open date range options' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Last X' }));
    const detail = screen.getByRole('group', { name: 'Last X' });
    fireEvent.change(within(detail).getByRole('textbox', { name: 'Value' }), { target: { value: '3' } });
    fireEvent.click(within(detail).getByRole('radio', { name: 'Weeks' }));
    expect(detail).toHaveTextContent('Selected:');
    fireEvent.click(within(detail).getByRole('button', { name: 'OK' }));
    expect(onChange).toHaveBeenLastCalledWith({ value: { operator: 'LASTWEEKS', values: [3] }, valid: true });
    // back button returns to the list
    fireEvent.click(screen.getByRole('button', { name: 'Open date range options' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Month in Year' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('UE-62 DynamicDateRange.toDates resolves every kind of option (local time, week numbering)', () => {
    const to = (operator: string, values: Array<Date | number> = [], wn?: 'ISO_8601' | 'WesternTraditional') => DynamicDateRange.toDates({ operator, values }, wn, NOW);
    expect(to('TODAY')).toEqual([day(2026, 11, 18), end(2026, 11, 18)]);
    expect(to('LASTDAYS', [7])).toEqual([day(2026, 11, 11), end(2026, 11, 17)]);
    expect(to('LASTDAYSINCLUDED', [7])).toEqual([day(2026, 11, 12), end(2026, 11, 18)]);
    expect(to('THISWEEK', [], 'ISO_8601')).toEqual([day(2026, 11, 16), end(2026, 11, 22)]);
    expect(to('THISWEEK', [], 'WesternTraditional')).toEqual([day(2026, 11, 15), end(2026, 11, 21)]);
    expect(to('LASTWEEKS', [2], 'ISO_8601')).toEqual([day(2026, 11, 2), end(2026, 11, 15)]);
    expect(to('NEXTMONTHS', [2])).toEqual([day(2026, 12, 1), end(2027, 1, 31)]);
    expect(to('LASTHOURS', [2])).toEqual([day(2026, 11, 18, 8), day(2026, 11, 18, 9, 59, 59, 999)]);
    expect(to('NEXTMINUTESINCLUDED', [5])).toEqual([day(2026, 11, 18, 10, 30), day(2026, 11, 18, 10, 34, 59, 999)]);
    expect(to('QUARTER2')).toEqual([day(2026, 4, 1), end(2026, 6, 30)]);
    expect(to('LASTDAYQUARTER')).toEqual([day(2026, 12, 31), end(2026, 12, 31)]);
    expect(to('SPECIFICMONTHINYEAR', [1, 2025])).toEqual([day(2025, 2, 1), end(2025, 2, 28)]);
    expect(to('TODAYFROMTO', [1, 2])).toEqual([day(2026, 11, 17), end(2026, 11, 20)]);
    expect(to('DATETOYEAR')).toEqual([day(2026, 11, 18), end(2026, 12, 31)]);
    expect(to('DATERANGE', [day(2026, 1, 5), day(2026, 1, 9)])).toEqual([day(2026, 1, 5), end(2026, 1, 9)]);
    expect(to('FROM', [day(2026, 1, 5)])).toEqual([day(2026, 1, 5)]);
    expect(to('DATETIME', [day(2026, 1, 5, 8, 15)])).toEqual([day(2026, 1, 5, 8, 15), day(2026, 1, 5, 8, 15)]);
  });

  it('UE-63 shows the formatted value, reads typed text and flags text it cannot read', () => {
    const onChange = vi.fn();
    const { rerender } = r(<DynamicDateRange aria-label="d" value={{ operator: 'LASTDAYS', values: [5] }} onChange={onChange} showClearIcon />);
    const input = screen.getByRole('textbox', { name: 'd' });
    expect((input as HTMLInputElement).value).toMatch(/^Last 5 days \(.+ – .+\)$/);
    fireEvent.change(input, { target: { value: 'Next 3 weeks' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenLastCalledWith({ value: { operator: 'NEXTWEEKS', values: [3] }, valid: true });
    fireEvent.change(input, { target: { value: '2026-03-04 - 2026-03-01' } });
    fireEvent.blur(input);
    expect(onChange.mock.lastCall![0].value).toEqual({ operator: 'DATERANGE', values: [day(2026, 3, 1), day(2026, 3, 4)] });
    fireEvent.change(input, { target: { value: 'next blue moon' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenLastCalledWith({ value: undefined, valid: false });
    expect(input).toHaveAttribute('aria-invalid', 'true');
    rerender(<DynamicDateRange aria-label="d" value={{ operator: 'TODAY', values: [] }} onChange={onChange} showClearIcon />);
    fireEvent.click(screen.getByRole('button', { name: 'Clear value' }));
    expect(onChange).toHaveBeenLastCalledWith({ value: undefined, valid: true });
  });

  it('UE-64 supports custom options, a formatter, hideInput with openBy and the toDates method', async () => {
    const ref = createRef<DynamicDateRangeRef>();
    const onChange = vi.fn();
    const fiscal = {
      key: 'FISCALYEAR', valueTypes: [], getText: () => 'This fiscal year',
      format: () => 'FY 2026', toDates: () => [day(2026, 4, 1), end(2027, 3, 31)],
    };
    r(
      <>
        <button type="button">anchor</button>
        <DynamicDateRange ref={ref} hideInput standardOptions={['TODAY']} customOptions={[fiscal]} onChange={onChange} />
      </>,
    );
    expect(screen.queryByRole('textbox')).toBeNull();
    act(() => ref.current!.openBy(screen.getByRole('button', { name: 'anchor' })));
    const list = await screen.findByRole('listbox');
    expect(within(list).getByRole('group', { name: 'Other Options' })).toBeInTheDocument();
    fireEvent.click(within(list).getByRole('option', { name: 'This fiscal year' }));
    expect(onChange).toHaveBeenCalledWith({ value: { operator: 'FISCALYEAR', values: [] }, valid: true });
    expect(ref.current!.toDates({ operator: 'FISCALYEAR', values: [] })).toEqual([day(2026, 4, 1), end(2027, 3, 31)]);
    const fmt = { format: (d: Date) => `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}` };
    const value: DynamicDateRangeValue = { operator: 'DATE', values: [day(2026, 5, 7)] };
    r(<DynamicDateRange aria-label="f" value={value} formatter={fmt} required name="from" />);
    expect(screen.getByRole('textbox', { name: 'f' })).toHaveValue('7.5.2026');
    expect(screen.getByRole('textbox', { name: 'f' })).toHaveAttribute('name', 'from');
  });
});

const suppliers: StandardListItem[] = Array.from({ length: 45 }, (_, i) => ({
  key: `S${i + 1}`, title: `Supplier ${i + 1}`, description: i % 2 ? 'Berlin' : 'Munich', info: i % 3 ? 'Active' : 'Blocked', infoState: i % 3 ? 'Success' : 'Error',
}));

describe('SelectDialog', () => {
  it('UE-65 opens through the ref with a search value; single selection confirms right away', async () => {
    const ref = createRef<SelectDialogRef>();
    const onConfirm = vi.fn();
    r(<SelectDialog ref={ref} title="Select Supplier" items={suppliers} onConfirm={onConfirm} />);
    expect(ref.current).not.toHaveProperty('close');
    act(() => ref.current!.open('Supplier 1'));
    const list = await screen.findByRole('listbox', { name: 'Select Supplier' });
    expect(screen.getByRole('searchbox')).toHaveValue('Supplier 1');
    // client filter (extension): Supplier 1, 10–19
    expect(within(list).getAllByRole('option')).toHaveLength(11);
    fireEvent.click(within(list).getByRole('option', { name: /Supplier 12/ }));
    expect(onConfirm).toHaveBeenCalledWith({ selectedItem: suppliers[11], selectedItems: [suppliers[11]] });
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
  });

  it('UE-66 multi-select: checkboxes, "Selected: n", selectionChange, clear button and clearSelection()', async () => {
    const ref = createRef<SelectDialogRef>();
    const onConfirm = vi.fn();
    const onSelectionChange = vi.fn();
    const items = suppliers.slice(0, 5).map((s, i) => ({ ...s, selected: i === 0 }));
    r(<SelectDialog ref={ref} title="Suppliers" items={items} multiSelect showClearButton onConfirm={onConfirm} onSelectionChange={onSelectionChange} />);
    act(() => ref.current!.open());
    const list = await screen.findByRole('listbox');
    expect(list).toHaveAttribute('aria-multiselectable', 'true');
    expect(screen.getByRole('status')).toHaveTextContent('Selected: 1');
    fireEvent.click(within(list).getByRole('option', { name: /Supplier 3/ }));
    expect(onSelectionChange).toHaveBeenCalledWith({ listItem: items[2], listItems: [items[2]], selected: true, selectAll: false });
    expect(screen.getByRole('status')).toHaveTextContent('Selected: 2');
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.queryByRole('status')).toBeNull();
    fireEvent.click(within(list).getByRole('option', { name: /Supplier 4/ }));
    act(() => ref.current!.clearSelection());
    fireEvent.click(within(list).getByRole('option', { name: /Supplier 5/ }));
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    expect(onConfirm).toHaveBeenCalledWith({ selectedItem: items[4], selectedItems: [items[4]] });
  });

  it('UE-67 search field: liveChange on typing, search on Enter and when cleared (no client filter then)', async () => {
    const ref = createRef<SelectDialogRef>();
    const onSearch = vi.fn();
    const onLiveChange = vi.fn();
    r(<SelectDialog ref={ref} items={suppliers.slice(0, 3)} onSearch={onSearch} onLiveChange={onLiveChange} searchPlaceholder="Find supplier" initialFocus="SearchField" />);
    act(() => ref.current!.open());
    const search = await screen.findByRole('searchbox', { name: 'Find supplier' });
    fireEvent.change(search, { target: { value: 'zz' } });
    expect(onLiveChange).toHaveBeenCalledWith({ value: 'zz' });
    expect(screen.getAllByRole('option')).toHaveLength(3);
    fireEvent.keyDown(search, { key: 'Enter' });
    expect(onSearch).toHaveBeenCalledWith({ value: 'zz', clearButtonPressed: false });
    fireEvent.change(search, { target: { value: '' } });
    expect(onSearch).toHaveBeenLastCalledWith({ value: '', clearButtonPressed: true });
  });

  it('UE-68 growing: shows growingThreshold items, "More [20/45]", updateStarted / updateFinished', async () => {
    const ref = createRef<SelectDialogRef>();
    const started = vi.fn();
    const finished = vi.fn();
    r(<SelectDialog ref={ref} items={suppliers} onUpdateStarted={started} onUpdateFinished={finished} noDataText="Nothing" />);
    act(() => ref.current!.open());
    await screen.findByRole('listbox');
    expect(screen.getAllByRole('option')).toHaveLength(20);
    const more = screen.getByRole('button', { name: /More.*\[20\/45\]/ });
    fireEvent.click(more);
    expect(started).toHaveBeenLastCalledWith({ reason: 'Growing', actual: 20, total: 45 });
    await waitFor(() => expect(finished).toHaveBeenLastCalledWith({ reason: 'Growing', actual: 40, total: 45 }));
    expect(screen.getAllByRole('option')).toHaveLength(40);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'nobody' } });
    expect(screen.getByText('Nothing')).toBeInTheDocument();
  });

  it('UE-69 rememberSelections keeps the confirmed selection; cancel fires onCancel and drops changes', async () => {
    const ref = createRef<SelectDialogRef>();
    const onCancel = vi.fn();
    r(<SelectDialog ref={ref} items={suppliers.slice(0, 4)} multiSelect rememberSelections onCancel={onCancel} confirmButtonText="Choose" />);
    act(() => ref.current!.open());
    fireEvent.click(within(await screen.findByRole('listbox')).getByRole('option', { name: /Supplier 2/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Choose' }));
    act(() => ref.current!.open());
    await waitFor(() => expect(screen.getByRole('option', { name: /Supplier 2/ })).toHaveAttribute('aria-selected', 'true'));
    fireEvent.click(screen.getByRole('option', { name: /Supplier 3/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
    act(() => ref.current!.open());
    await waitFor(() => expect(screen.getByRole('option', { name: /Supplier 3/ })).toHaveAttribute('aria-selected', 'false'));
  });
});

describe('TableSelectDialog', () => {
  it('UE-70 renders columns and ColumnListItem rows; multi-select, merged duplicates, pop-in, column footer', async () => {
    const ref = createRef<TableSelectDialogRef>();
    const onConfirm = vi.fn();
    const items = [
      { key: 'P1', cells: ['Laptop', 'IT', '1,200 EUR'] },
      { key: 'P2', cells: ['Monitor', 'IT', '300 EUR'] },
      { key: 'P3', cells: ['Chair', 'Office', '150 EUR'] },
    ];
    const mm = window.matchMedia;
    window.matchMedia = ((q: string) => ({ ...mm(q), matches: !q.includes('9999') })) as typeof window.matchMedia;
    r(
      <TableSelectDialog
        ref={ref} title="Select Product" multiSelect items={items} onConfirm={onConfirm}
        columns={[{ header: 'Product', footer: '3 products' }, { header: 'Category', mergeDuplicates: true, sortIndicator: 'Ascending' }, { header: 'Price', hAlign: 'End', minScreenWidth: '9999px', demandPopin: true }]}
      />,
    );
    window.matchMedia = mm;
    expect(ref.current).not.toHaveProperty('clearSelection');
    act(() => ref.current!.open());
    const table = await screen.findByRole('table', { name: 'Select Product' });
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['', 'Product', 'Category']);
    expect(within(table).getByRole('columnheader', { name: 'Category' })).toHaveAttribute('aria-sort', 'ascending');
    const rows = within(table).getAllByRole('row').slice(1, 4);
    expect(rows[1]).not.toHaveTextContent('IT'); // merged with the row above
    expect(rows[0]).toHaveTextContent('Price: 1,200 EUR'); // popped in
    expect(table).toHaveTextContent('3 products');
    fireEvent.click(rows[0]!);
    fireEvent.click(rows[2]!);
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    expect(onConfirm).toHaveBeenCalledWith({ selectedItem: items[0], selectedItems: [items[0], items[2]] });
  });
});

const vsdProps = {
  sortItems: [{ key: 'date', text: 'Order Date', selected: true }, { key: 'amount', text: 'Net Amount' }],
  groupItems: [{ key: 'supplier', text: 'Supplier' }, { key: 'status', text: 'Status' }],
  filterItems: [
    { key: 'status', text: 'Status', items: [{ key: 'NEW', text: 'New' }, { key: 'APPR', text: 'Approved' }, { key: 'REJ', text: 'Rejected' }] },
    { key: 'supplier', text: 'Supplier', multiSelect: false, items: [{ key: 'S1', text: 'Acme Corp' }, { key: 'S2', text: 'Bolt Ltd' }] },
  ],
};

describe('ViewSettingsDialog', () => {
  it('UE-71 sort and group pages behind a segmented button; confirm reports the choices', async () => {
    const ref = createRef<ViewSettingsDialogRef>();
    const onConfirm = vi.fn();
    r(<ViewSettingsDialog ref={ref} {...vsdProps} onConfirm={onConfirm} />);
    expect(ref.current).not.toHaveProperty('close');
    act(() => ref.current!.open());
    const dialog = await screen.findByRole('dialog', { name: 'View Settings' });
    expect(within(dialog).getByRole('radio', { name: 'Order Date' })).toBeChecked();
    fireEvent.click(within(dialog).getByRole('radio', { name: 'Net Amount' }));
    fireEvent.click(within(dialog).getByRole('radio', { name: 'Descending' }));
    fireEvent.click(within(dialog).getByRole('radio', { name: 'Group' }));
    expect(within(dialog).getByRole('radio', { name: '(Not Grouped)' })).toBeChecked();
    fireEvent.click(within(dialog).getByRole('radio', { name: 'Status' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'OK' }));
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({
      sortItem: vsdProps.sortItems[1], sortDescending: true, groupItem: vsdProps.groupItems[1], groupDescending: false, presetFilterItem: undefined, filterItems: [], filterString: '',
    }));
  });

  it('UE-72 filter page: detail page with checkboxes and search, filterString and filterCompoundKeys', async () => {
    const ref = createRef<ViewSettingsDialogRef>();
    const onConfirm = vi.fn();
    const onFilterDetailPageOpened = vi.fn();
    r(<ViewSettingsDialog ref={ref} {...vsdProps} onConfirm={onConfirm} onFilterDetailPageOpened={onFilterDetailPageOpened} filterSearchOperator="Contains" />);
    act(() => ref.current!.open('filter'));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /Status/ }));
    expect(onFilterDetailPageOpened).toHaveBeenCalledWith({ parentFilterItem: vsdProps.filterItems[0] });
    fireEvent.change(within(dialog).getByRole('searchbox'), { target: { value: 'pro' } });
    expect(within(dialog).getAllByRole('checkbox').map((c) => c.closest('.sk-vsd__item, .sk-vsd__select-all')?.textContent)).toEqual(['Select All', 'Approved']);
    fireEvent.change(within(dialog).getByRole('searchbox'), { target: { value: '' } });
    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'New' }));
    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Approved' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Back' }));
    expect(within(dialog).getByRole('button', { name: /Status/ })).toHaveTextContent('2');
    fireEvent.click(within(dialog).getByRole('button', { name: 'OK' }));
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({
      filterString: 'Filtered by: Status (New, Approved)',
      filterKeys: { NEW: true, APPR: true },
      filterCompoundKeys: { status: { NEW: true, APPR: true } },
    }));
  });

  it('UE-73 preset filters, reset, clearFilters(), custom tabs and a preventable beforeClose', async () => {
    const ref = createRef<ViewSettingsDialogRef>();
    const onConfirm = vi.fn();
    const onReset = vi.fn();
    const onResetFilters = vi.fn();
    let block = true;
    const onBeforeClose = vi.fn((e: { preventDefault(): void }) => { if (block) e.preventDefault(); });
    r(
      <ViewSettingsDialog
        ref={ref} {...vsdProps} presetFilterItems={[{ key: 'mine', text: 'My Orders' }]} selectedFilterKeys={{ status: ['REJ'] }}
        customTabs={[{ key: 'columns', title: 'Columns', content: <p>Column settings</p> }]}
        onConfirm={onConfirm} onReset={onReset} onResetFilters={onResetFilters} onBeforeClose={onBeforeClose}
      />,
    );
    act(() => ref.current!.open('columns'));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Column settings')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('radio', { name: 'Filter' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reset' }));
    expect(onReset).toHaveBeenCalled();
    expect(onResetFilters).toHaveBeenCalledTimes(1);
    fireEvent.click(within(dialog).getByRole('radio', { name: 'My Orders' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'OK' }));
    expect(onBeforeClose).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
    block = false;
    fireEvent.click(within(dialog).getByRole('button', { name: 'OK' }));
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ presetFilterItem: { key: 'mine', text: 'My Orders' }, filterString: 'Filtered by: My Orders', filterItems: [] }));
    act(() => ref.current!.clearFilters());
    expect(onResetFilters).toHaveBeenCalledTimes(2);
  });
});

function SupplierWizard(p: { wizard?: Partial<Parameters<typeof Wizard>[0]>; validated?: boolean }) {
  return (
    <Wizard aria-label="Create supplier" {...p.wizard}>
      <WizardStep id="general" title="General"><input aria-label="Name" /></WizardStep>
      <WizardStep id="bank" title="Bank" validated={p.validated} optional>bank</WizardStep>
      <WizardStep id="review" title="Summary">summary</WizardStep>
    </Wizard>
  );
}

describe('Wizard', () => {
  it('UE-74 Scroll mode: progress navigator, next button "Step n", validated, Review and complete', () => {
    const onStepActivate = vi.fn();
    const onComplete = vi.fn();
    const { rerender } = r(<SupplierWizard wizard={{ onStepActivate, onComplete }} validated={false} />);
    const nav = screen.getByRole('navigation', { name: 'Wizard progress' });
    expect(within(nav).getAllByRole('listitem')).toHaveLength(3);
    expect(within(nav).getAllByRole('listitem')[0]).toHaveAttribute('aria-current', 'step');
    expect(nav).toHaveTextContent('Step 1 of 3');
    fireEvent.click(screen.getByRole('button', { name: 'Step 2' }));
    expect(onStepActivate).toHaveBeenCalledWith({ index: 2 });
    expect(screen.getByRole('heading', { name: '2. Bank (Optional)', level: 3 })).toBeInTheDocument();
    expect(screen.getAllByRole('region')).toHaveLength(2); // both reached steps are shown
    expect(screen.queryByRole('button', { name: 'Step 3' })).toBeNull(); // not validated
    rerender(<SupplierWizard wizard={{ onStepActivate, onComplete, finishButtonText: 'Create' }} validated />);
    fireEvent.click(screen.getByRole('button', { name: 'Step 3' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(onComplete).toHaveBeenCalled();
  });

  it('UE-75 ref methods: nextStep, goToStep, previousStep, discardProgress, validate / invalidate, getProgress*', () => {
    const ref = createRef<WizardRef>();
    const onNavigationChange = vi.fn();
    r(<SupplierWizard wizard={{ ref, onNavigationChange }} />);
    act(() => ref.current!.nextStep());
    act(() => ref.current!.nextStep());
    expect(ref.current!.getProgress()).toBe(3);
    expect(ref.current!.getProgressStep()).toEqual({ id: 'review', title: 'Summary', index: 3 });
    act(() => ref.current!.goToStep('general'));
    expect(ref.current!.getCurrentStep()).toBe('general');
    fireEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name: /Bank/ }));
    expect(onNavigationChange).toHaveBeenCalledWith({ step: { id: 'bank', title: 'Bank', index: 2 } });
    act(() => ref.current!.previousStep());
    expect(ref.current!.getProgress()).toBe(2);
    act(() => ref.current!.invalidateStep('bank'));
    act(() => ref.current!.nextStep());
    expect(ref.current!.getProgress()).toBe(2);
    act(() => ref.current!.validateStep('bank'));
    act(() => ref.current!.nextStep());
    expect(ref.current!.getProgress()).toBe(3);
    act(() => ref.current!.discardProgress('general'));
    expect(ref.current!.getProgress()).toBe(1);
    expect(ref.current!.getProgressStep()?.id).toBe('general');
  });

  it('UE-76 branching with nextStep / subsequentSteps; Page mode shows one step; width, height, title level', () => {
    const ref = createRef<WizardRef>();
    function Branching() {
      const [kind, setKind] = useState<string | undefined>();
      return (
        <Wizard ref={ref} enableBranching renderMode="Page" width="40rem" height="30rem" stepTitleLevel="H2" backgroundDesign="Solid">
          <WizardStep id="type" title="Type" subsequentSteps={['domestic', 'foreign']} nextStep={kind}>
            <button type="button" onClick={() => setKind('foreign')}>Foreign</button>
          </WizardStep>
          <WizardStep id="domestic" title="Domestic" nextStep="done">d</WizardStep>
          <WizardStep id="foreign" title="Foreign bank" nextStep="done">f</WizardStep>
          <WizardStep id="done" title="Done">done</WizardStep>
        </Wizard>
      );
    }
    const { container } = r(<Branching />);
    expect(container.querySelector('.sk-wizard')!.getAttribute('style')).toBe('width: 40rem; height: 30rem;');
    expect(screen.getByRole('button', { name: 'Step 2' })).toBeDisabled(); // branch not chosen yet
    fireEvent.click(screen.getByRole('button', { name: 'Foreign' }));
    fireEvent.click(screen.getByRole('button', { name: 'Step 2' }));
    expect(screen.getByRole('heading', { name: '2. Foreign bank', level: 2 })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Type/ })).toBeNull(); // Page mode
    expect(within(screen.getByRole('navigation')).getAllByRole('listitem').map((l) => l.textContent)).toEqual(['Type', '2Foreign bank', '3Done']); // done steps show a check mark
    act(() => ref.current!.discardProgress('type'));
    expect(screen.getByRole('button', { name: 'Step 2' })).toBeDisabled(); // nextStep dropped (preserveNextStep false)
  });
});

function Tabs(p: { onSelect?: () => void; onExpand?: () => void; selectedKey?: string; extra?: ReactNode; reorder?: boolean }) {
  return (
    <IconTabBar selectedKey={p.selectedKey} onSelect={p.onSelect} onExpand={p.onExpand} content={<p>Shared content</p>} ariaTexts={{ headerLabel: 'Order status' }} enableTabReordering={p.reorder}>
      <IconTabFilter key="all" showAll count="120" text="All">All orders</IconTabFilter>
      <IconTabSeparator key="sep" />
      <IconTabFilter key="open" icon={<span>o</span>} iconColor="Critical" count="42" text="Open">Open orders</IconTabFilter>
      <IconTabFilter key="approved" icon={<span>a</span>} iconColor="Positive" count="70" text="Approved" />
      <IconTabFilter key="rejected" icon={<span>r</span>} iconColor="Negative" count="8" text="Rejected" enabled={false} />
      {p.extra}
    </IconTabBar>
  );
}

describe('IconTabBar', () => {
  it('UE-77 tablist / tab / tabpanel roles, counts, icon colours, select event and arrow keys', () => {
    const onSelect = vi.fn();
    r(<Tabs onSelect={onSelect} />);
    const list = screen.getByRole('tablist', { name: 'Order status' });
    const tabs = within(list).getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(['120All', 'o42Open', 'a70Approved', 'r8Rejected']);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('All orders');
    expect(tabs[1]).toHaveClass('sk-itb__tab--critical');
    expect(tabs[3]).toBeDisabled();
    fireEvent.click(tabs[1]!);
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ key: 'open', previousKey: 'all', selectedKey: 'open' }));
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Open orders');
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', tabs[1]!.id);
    tabs[1]!.focus();
    fireEvent.keyDown(tabs[1]!, { key: 'ArrowRight' });
    expect(tabs[2]).toHaveFocus();
    fireEvent.keyDown(tabs[2]!, { key: 'ArrowRight' }); // skips the disabled tab
    expect(tabs[0]).toHaveFocus();
    fireEvent.keyDown(tabs[0]!, { key: 'End' });
    expect(tabs[2]).toHaveFocus();
    fireEvent.click(tabs[2]!);
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Shared content'); // no content of its own
  });

  it('UE-78 re-pressing the selected tab collapses / expands; selectedKey follows the prop; child filters open a menu', async () => {
    const onExpand = vi.fn();
    const onSelect = vi.fn();
    const extra = (
      <IconTabFilter key="more" text="Other">
        <IconTabFilter key="closed" text="Closed" count="3">Closed orders</IconTabFilter>
        <IconTabFilter key="draft" text="Draft">Drafts</IconTabFilter>
      </IconTabFilter>
    );
    const { rerender } = r(<Tabs onExpand={onExpand} onSelect={onSelect} selectedKey="open" extra={extra} />);
    const open = screen.getByRole('tab', { name: /Open/ });
    expect(open).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(open);
    expect(onExpand).toHaveBeenLastCalledWith({ expand: false, collapse: true });
    expect(screen.getByRole('tabpanel', { hidden: true })).not.toBeVisible();
    fireEvent.click(open);
    expect(onExpand).toHaveBeenLastCalledWith({ expand: true, collapse: false });
    rerender(<Tabs onExpand={onExpand} onSelect={onSelect} selectedKey="approved" extra={extra} />);
    expect(screen.getByRole('tab', { name: /Approved/ })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('tab', { name: /Other/ }));
    fireEvent.click(await screen.findByRole('menuitem', { name: /Closed/ }));
    expect(onSelect).toHaveBeenLastCalledWith(expect.objectContaining({ key: 'closed', previousKey: 'approved' }));
    expect(screen.getByRole('tab', { name: /Other/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Closed orders');
  });

  it('UE-79 tabs that do not fit go into "More"; Ctrl + arrow reorders; works without SmartKitProvider and in Chinese', async () => {
    const proto = HTMLElement.prototype;
    const ow = Object.getOwnPropertyDescriptor(proto, 'offsetWidth')!;
    const cw = Object.getOwnPropertyDescriptor(Element.prototype, 'clientWidth')!;
    Object.defineProperty(proto, 'offsetWidth', { configurable: true, get(this: HTMLElement) { return this.dataset.skItbItem ? 100 : this.dataset.skItbMore ? 60 : 0; } });
    Object.defineProperty(Element.prototype, 'clientWidth', { configurable: true, get(this: Element) { return this.classList.contains('sk-itb__header') ? 330 : 0; } });
    try {
      r(<Tabs reorder />);
      const more = await screen.findByRole('button', { name: /More/ });
      expect(screen.getAllByRole('tab').filter((t) => !t.closest('[hidden]'))).toHaveLength(2);
      fireEvent.click(more);
      expect(await screen.findByRole('menuitem', { name: /Approved/ })).toBeInTheDocument();
    } finally {
      Object.defineProperty(proto, 'offsetWidth', ow);
      Object.defineProperty(Element.prototype, 'clientWidth', cw);
    }
    document.body.innerHTML = '';
    r(<Tabs reorder />);
    const first = screen.getAllByRole('tab')[0]!;
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowRight', ctrlKey: true });
    expect(screen.getAllByRole('tab').map((t) => t.textContent)[1]).toBe('120All');
    // Chinese texts through the provider; the key sets of both languages match.
    expect(Object.keys(dialogsZh).sort()).toEqual(Object.keys(dialogsEn).sort());
    const ref = createRef<WizardRef>();
    render(<MantineProvider env="test"><SmartKitProvider services={{}} locale="zh"><SupplierWizard wizard={{ ref }} /></SmartKitProvider></MantineProvider>);
    expect(screen.getByRole('navigation', { name: '向导进度' })).toHaveTextContent('第 1 步，共 3 步');
    expect(screen.getByRole('button', { name: '第 2 步' })).toBeInTheDocument();
  });
});
