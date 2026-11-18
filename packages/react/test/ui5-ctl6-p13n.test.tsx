/** Stage 6 (ctl6): sap.m.p13n.Popup and its panels follow SAPUI5 1.154 (docs/31 stage 6). */
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import GroupPanel from '@rhfan2019/smart-kit/m/p13n/GroupPanel';
import Popup from '@rhfan2019/smart-kit/m/p13n/Popup';
import SelectionPanel from '@rhfan2019/smart-kit/m/p13n/SelectionPanel';
import SortPanel from '@rhfan2019/smart-kit/m/p13n/SortPanel';
import { TableP13nDialog } from '../src/table/TableP13nDialog';
import { wrap } from './helpers';

const items = [
  { name: 'a', label: 'Alpha', visible: true },
  { name: 'b', label: 'Beta', visible: false },
  { name: 'c', label: 'Gamma', visible: true },
];

describe('sap.m.p13n.SelectionPanel', () => {
  it('AL-05 SelectionPanel: reorder on, header off, ClearAll; the field column header is "Field"', () => {
    render(wrap(<SelectionPanel p13nData={items} />));
    expect(screen.getByText('Field')).toBeTruthy();
    expect(screen.queryByPlaceholderText('Search')).toBeNull();
    expect(document.querySelector('[data-sk-p13n-clear-all]')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /^Move Up: / })).toHaveLength(3);
    render(wrap(<SelectionPanel p13nData={items} enableReorder={false} showHeader enableCount fieldColumn="Column" multiSelectMode="SelectAll" />));
    expect(screen.getByText('Column (2/3)')).toBeTruthy();
    expect(screen.getByPlaceholderText('Search')).toBeTruthy();
    expect(document.querySelector('[data-sk-p13n-select-all]')).toBeTruthy();
  });

  it('AL-06 AL-07 SelectionPanel: change { reason, item }; getP13nData / getItemByKey / setP13nData on the ref', () => {
    const ref = createRef<SelectionPanel>();
    const onChange = vi.fn();
    render(wrap(<SelectionPanel ref={ref} p13nData={items} onChange={onChange} />));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Beta' }));
    expect(onChange).toHaveBeenLastCalledWith({ reason: 'Add', item: { name: 'b', label: 'Beta', visible: true } });
    fireEvent.click(screen.getByRole('button', { name: 'Move to Top: Gamma' }));
    expect(onChange.mock.lastCall![0].reason).toBe('Move');
    expect(ref.current!.getP13nData().map((x) => x.name)).toEqual(['c', 'a', 'b']);
    expect(ref.current!.getP13nData(true).map((x) => x.name)).toEqual(['c', 'a', 'b']);
    fireEvent.click(document.querySelector('[data-sk-p13n-clear-all]')!);
    expect(onChange.mock.lastCall![0].reason).toBe('DeselectAll');
    expect(ref.current!.getP13nData(true)).toEqual([]);
    expect(ref.current!.getItemByKey('a')?.label).toBe('Alpha');
    act(() => ref.current!.setP13nData([{ name: 'x', label: 'X', visible: true }]));
    expect(screen.getByRole('checkbox', { name: 'X' })).toBeTruthy();
  });
});

describe('sap.m.p13n.SortPanel / GroupPanel (QueryPanel)', () => {
  const sortItems = [
    { name: 'a', label: 'Alpha', sorted: true, descending: true },
    { name: 'b', label: 'Beta', sorted: false, descending: false },
  ];
  it('AL-05 SortPanel: one row per sorted item plus an empty row with the placeholder "Sort By"; queryLimit -1', () => {
    render(wrap(<SortPanel p13nData={sortItems} />));
    expect(document.querySelectorAll('[data-sk-p13n-sort-field]')).toHaveLength(2);
    expect(screen.getAllByPlaceholderText('Sort By')).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Remove Sort Criterion' })).toHaveLength(1);
  });

  it('AL-06 AL-07 SortPanel: removing and the order switch fire change; getP13nData(true) gives the sorted items', () => {
    const ref = createRef<SortPanel>();
    const onChange = vi.fn();
    render(wrap(<SortPanel ref={ref} p13nData={sortItems} onChange={onChange} />));
    fireEvent.click(screen.getAllByRole('radio', { name: 'Ascending' })[0]!);
    expect(onChange).toHaveBeenLastCalledWith({ reason: 'sortorder', item: { name: 'a', label: 'Alpha', sorted: true, descending: false } });
    fireEvent.click(screen.getByRole('button', { name: 'Remove Sort Criterion' }));
    expect(onChange.mock.lastCall![0].reason).toBe('Remove');
    expect(ref.current!.getP13nData(true)).toEqual([]);
    expect(ref.current!.getP13nData().map((x) => x.name)).toEqual(['a', 'b']);
  });

  it('AL-05 GroupPanel: queryLimit 1 shows a single row; enableShowField adds "Show Field as Column"', () => {
    const groupItems = [{ name: 'a', label: 'Alpha', grouped: true }, { name: 'b', label: 'Beta', grouped: false }];
    render(wrap(<GroupPanel p13nData={groupItems} queryLimit={1} />));
    expect(document.querySelectorAll('[data-sk-p13n-group]')).toHaveLength(1);
    expect(screen.queryByText('Show Field as Column')).toBeNull();
    render(wrap(<GroupPanel p13nData={groupItems} enableShowField />));
    expect(screen.getAllByRole('checkbox', { name: 'Show Field as Column' })).toHaveLength(2);
    expect(screen.getAllByPlaceholderText('Group By')).toHaveLength(3);
  });
});

describe('sap.m.p13n.Popup', () => {
  it('AL-05 AL-07 Popup: open() / isOpen(); several panels as tabs with the panel titles (default "Fields", "Sort")', async () => {
    const ref = createRef<Popup>();
    const onOpen = vi.fn();
    render(wrap(<Popup ref={ref} title="View Settings" onOpen={onOpen} panels={[<SelectionPanel key="columns" p13nData={items} />, <SortPanel key="sort" p13nData={[]} />]} />));
    expect(ref.current!.isOpen()).toBe(false);
    expect(screen.queryByRole('dialog')).toBeNull();
    act(() => ref.current!.open(null));
    expect(ref.current!.isOpen()).toBe(true);
    expect(onOpen).toHaveBeenCalledTimes(1);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getAllByRole('tab').map((x) => x.textContent)).toEqual(['Fields', 'Sort']);
    expect(within(dialog).getByRole('tab', { name: 'Fields' }).getAttribute('aria-selected')).toBe('true');
    expect(within(dialog).queryByRole('button', { name: 'Reset' })).toBeNull();
  });

  it('AL-06 Popup: close { reason } for OK and Cancel; the panels can be read in the handler', async () => {
    const ref = createRef<Popup>();
    const sel = createRef<SelectionPanel>();
    const seen: unknown[] = [];
    render(wrap(<Popup ref={ref} onClose={(e) => seen.push([e.reason, ref.current!.isOpen(), sel.current?.getP13nData(true).map((x) => x.name)])} panels={[<SelectionPanel key="c" ref={sel} p13nData={items} />]} />));
    act(() => ref.current!.open(null));
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Beta' }));
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    act(() => ref.current!.open(null));
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(seen[0]).toEqual(['Ok', false, ['a', 'b', 'c']]);
    expect((seen[1] as unknown[]).slice(0, 2)).toEqual(['Cancel', false]);
  });

  it('AL-05 Popup: the Reset button only with `reset`, enabled by open settings or a panel change', async () => {
    const ref = createRef<Popup>();
    render(wrap(<Popup ref={ref} reset={() => {}} warningText="Sure?" additionalButtons={[<button key="x" type="button">Extra</button>]} panels={[<SelectionPanel key="c" p13nData={items} />]} />));
    act(() => ref.current!.open(null));
    const reset = (await screen.findByRole('button', { name: 'Reset' })) as HTMLButtonElement;
    expect(reset.disabled).toBe(true);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Beta' }));
    expect(reset.disabled).toBe(false);
    expect(screen.getByRole('button', { name: 'Extra' })).toBeTruthy();
  });

  it('AL-06 TableP13nDialog builds on Popup: OK returns columns, sort, group and totals', () => {
    const onOk = vi.fn();
    render(wrap(
      <TableP13nDialog opened columns={[{ id: 'A', label: 'Alpha' }, { id: 'B', label: 'Beta' }]} visible={['A']} sort={[{ path: 'A', descending: true }]}
        sortable={[{ path: 'A', label: 'Alpha' }, { path: 'B', label: 'Beta' }]} groupable={[{ id: 'B', label: 'Beta' }]} groupBy="B"
        totalable={[{ id: 'A', label: 'Alpha' }]} totals={[]} onOk={onOk} onCancel={() => {}} />,
    ));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getAllByRole('tab').map((x) => x.textContent)).toEqual(['Columns', 'Sort', 'Group', 'Totals']);
    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Beta' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'OK' }));
    expect(onOk).toHaveBeenCalledWith(['A', 'B'], [{ path: 'A', descending: true }], 'B', []);
  });
});
