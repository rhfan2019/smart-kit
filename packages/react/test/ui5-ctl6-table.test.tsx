/** UI5 alignment stage 6 (ADR-033): sap.m.Table (m/Table) — the sap.m.ListBase members of stage 6. */
import { MantineProvider } from '@mantine/core';
import type { Row } from '@rhfan2019/smart-kit-core';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createRef, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { SmartKitProvider } from '../src/context/SmartKitProvider';
import { smartKitMantineTheme } from '../src/theme/mantine';
import Table, { type $ListItemActionSettings, type $TableSettings } from '../src/m/Table';

const host = (children: ReactNode) => (
  <MantineProvider theme={smartKitMantineTheme}>
    <SmartKitProvider services={{}} locale="en" namespace="ctl6-table">{children}</SmartKitProvider>
  </MantineProvider>
);
const rows: Row[] = Array.from({ length: 5 }, (_, i) => ({ ID: i + 1, Name: `Row ${i + 1}` }));
const columns: $TableSettings['columns'] = [
  { id: 'Name', header: 'Name', cell: (r: Row) => String(r.Name) },
  { id: 'Edit', header: 'Edit', cell: (r: Row) => <input aria-label={`edit ${String(r.ID)}`} defaultValue={String(r.Name)} /> },
];
const keyOf = (r: Row) => String(r.ID);
const tr = (key: string) => document.querySelector<HTMLTableRowElement>(`tr[data-sk-row="${key}"]`)!;
const shownKeys = () => [...document.querySelectorAll<HTMLElement>('tr[data-sk-row]')].map((x) => x.dataset.skRow);
const swipeLeft = (el: Element) => {
  fireEvent.touchStart(el, { touches: [{ clientX: 300, clientY: 10 }] });
  fireEvent.touchEnd(el, { changedTouches: [{ clientX: 200, clientY: 14 }] });
};

describe('sap.m.Table stage 6 (m/Table)', () => {
  it('AL-05 Table: defaults — showUnread false, itemActionCount -1, growingDirection Downwards, keyboardMode Navigation, modeAnimationOn true', () => {
    const actions = () => [{ type: 'Edit' as const }];
    const { rerender } = render(host(<Table columns={columns} items={rows} keyOf={keyOf} rowUnread={() => true} rowActions={actions} mode="Delete" growing growingThreshold={3} />));
    // showUnread false: rowUnread is ignored
    expect(document.querySelector('[data-sk-unread]')).toBeNull();
    // itemActionCount -1: no actions, the Delete mode shows its buttons
    expect(document.querySelector('[data-sk-item-actions]')).toBeNull();
    expect(document.querySelectorAll('[data-sk-row-delete]')).toHaveLength(3);
    // Downwards: the trigger after the table, items in data order
    const table = document.querySelector('table')!;
    const more = document.querySelector('[data-sk-more]')!;
    expect(table.compareDocumentPosition(more) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(shownKeys()).toEqual(['1', '2', '3']);
    // modeAnimationOn true: animates once the mode changed
    expect(document.querySelector('[data-sk-mode-anim]')).toBeNull();
    rerender(host(<Table columns={columns} items={rows} keyOf={keyOf} mode="MultiSelect" />));
    expect(document.querySelector('[data-sk-mode-anim]')).not.toBeNull();
  });

  it('AL-05 Table: modeAnimationOn false — no mode animation', () => {
    const { rerender } = render(host(<Table columns={columns} items={rows} keyOf={keyOf} modeAnimationOn={false} />));
    rerender(host(<Table columns={columns} items={rows} keyOf={keyOf} modeAnimationOn={false} mode="MultiSelect" />));
    expect(document.querySelector('[data-sk-mode-anim]')).toBeNull();
  });

  it('AL-05 Table: showUnread marks the rows rowUnread returns true for (bold, "Unread" for screen readers)', () => {
    render(host(<Table columns={columns} items={rows} keyOf={keyOf} showUnread rowUnread={(r) => r.ID === 2} />));
    expect(tr('2')).toHaveClass('sk-rtable__row--unread');
    expect(tr('1')).not.toHaveClass('sk-rtable__row--unread');
    expect(tr('2').textContent).toContain('Unread');
  });

  it('AL-05 Table: growingDirection Upwards — the trigger at the top, items in reverse order (the first at the bottom)', () => {
    const onUpdateStarted = vi.fn();
    render(host(<Table columns={columns} items={rows} keyOf={keyOf} growing growingThreshold={2} growingDirection="Upwards" onUpdateStarted={onUpdateStarted} />));
    const table = document.querySelector('table')!;
    const more = document.querySelector('[data-sk-more]')!;
    expect(table.compareDocumentPosition(more) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
    expect(shownKeys()).toEqual(['2', '1']);
    fireEvent.click(more);
    expect(onUpdateStarted).toHaveBeenCalledWith({ reason: 'Growing', actual: 2, total: 5 });
    expect(shownKeys()).toEqual(['4', '3', '2', '1']);
  });

  it('AL-05 Table: itemActionCount — up to that many actions, the rest in an overflow menu; the Delete mode has no effect', () => {
    const actions = (): $ListItemActionSettings[] => [{ type: 'Edit' }, { type: 'Delete' }, { key: 'copy', text: 'Copy' }];
    const { rerender } = render(host(<Table columns={columns} items={rows} keyOf={keyOf} mode="Delete" itemActionCount={2} rowActions={actions} />));
    expect(document.querySelector('[data-sk-row-delete]')).toBeNull();
    let cell = tr('1').querySelector('[data-sk-item-actions]')!;
    // 3 visible actions > 2: one action and the overflow button (ListItemBase _getActionsToRender)
    expect(cell.querySelectorAll('[data-sk-item-action]')).toHaveLength(1);
    expect(cell.querySelector('[data-sk-item-action="Edit"]')).toHaveAttribute('aria-label', 'Edit');
    expect(cell.querySelector('[data-sk-item-action-overflow]')).toHaveAttribute('aria-label', 'More Actions');
    rerender(host(<Table columns={columns} items={rows} keyOf={keyOf} itemActionCount={2} rowActions={() => [{ type: 'Edit' }, { type: 'Delete' }]} />));
    cell = tr('1').querySelector('[data-sk-item-actions]')!;
    expect(cell.querySelectorAll('[data-sk-item-action]')).toHaveLength(2);
    expect(cell.querySelector('[data-sk-item-action-overflow]')).toBeNull();
    // itemActionCount 0: no actions column
    rerender(host(<Table columns={columns} items={rows} keyOf={keyOf} itemActionCount={0} rowActions={() => [{ type: 'Edit' }]} />));
    expect(document.querySelector('[data-sk-item-actions]')).toBeNull();
  });

  it('AL-06 Table: itemActionPress({ action, listItem }) from the buttons, the overflow menu, Ctrl+E and Delete', async () => {
    const onItemActionPress = vi.fn();
    const copy: $ListItemActionSettings = { key: 'copy', text: 'Copy' };
    const list: $ListItemActionSettings[] = [{ type: 'Edit' }, { type: 'Delete' }, copy];
    render(host(<Table columns={columns} items={rows} keyOf={keyOf} itemActionCount={2} rowActions={() => list} onItemActionPress={onItemActionPress} />));
    fireEvent.click(tr('2').querySelector('[data-sk-item-action="Edit"]')!);
    expect(onItemActionPress).toHaveBeenLastCalledWith({ action: list[0], listItem: rows[1] });
    fireEvent.click(tr('2').querySelector('[data-sk-item-action-overflow]')!);
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Copy' }));
    expect(onItemActionPress).toHaveBeenLastCalledWith({ action: copy, listItem: rows[1] });
    const cell = tr('3').querySelector<HTMLElement>('td[data-col="Name"]')!;
    fireEvent.keyDown(cell, { key: 'e', code: 'KeyE', ctrlKey: true });
    expect(onItemActionPress).toHaveBeenLastCalledWith({ action: list[0], listItem: rows[2] });
    fireEvent.keyDown(cell, { key: 'Delete' });
    expect(onItemActionPress).toHaveBeenLastCalledWith({ action: list[1], listItem: rows[2] });
  });

  it('AL-06 Table: a Navigation action makes its row navigable (chevron and itemPress) without being shown', () => {
    const onItemPress = vi.fn();
    render(host(<Table columns={columns} items={rows} keyOf={keyOf} rowActions={(r) => (r.ID === 1 ? [{ type: 'Navigation' }] : [])} onItemPress={onItemPress} />));
    expect(tr('1').querySelector('.sk-rtable__nav svg')).not.toBeNull();
    expect(tr('2').querySelector('.sk-rtable__nav svg')).toBeNull();
    fireEvent.click(tr('1').querySelector('td[data-col="Name"]')!);
    expect(onItemPress).toHaveBeenCalledWith(expect.objectContaining({ listItem: rows[0] }));
    fireEvent.click(tr('2').querySelector('td[data-col="Name"]')!);
    expect(onItemPress).toHaveBeenCalledTimes(1);
  });

  it('AL-06 Table: beforeOpenContextMenu({ listItem, column, preventDefault }) and the context menu of the row', async () => {
    const onBeforeOpenContextMenu = vi.fn();
    render(host(<Table columns={columns} items={rows} keyOf={keyOf} contextMenu={(r) => <button type="button">Open {String(r.Name)}</button>} onBeforeOpenContextMenu={onBeforeOpenContextMenu} />));
    fireEvent.contextMenu(tr('2').querySelector('td[data-col="Name"]')!, { clientX: 40, clientY: 50 });
    expect(onBeforeOpenContextMenu).toHaveBeenCalledWith(expect.objectContaining({ listItem: rows[1], column: columns[0] }));
    const item = await screen.findByRole('button', { name: 'Open Row 2' });
    fireEvent.click(item);
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Open Row 2' })).toBeNull());
    // an input field keeps the browser's menu
    onBeforeOpenContextMenu.mockClear();
    fireEvent.contextMenu(screen.getByLabelText('edit 1'));
    expect(onBeforeOpenContextMenu).not.toHaveBeenCalled();
  });

  it('AL-06 Table: beforeOpenContextMenu preventDefault keeps the menu closed', () => {
    render(host(<Table columns={columns} items={rows} keyOf={keyOf} contextMenu={<button type="button">Menu</button>} onBeforeOpenContextMenu={(e) => e.preventDefault()} />));
    const event = fireEvent.contextMenu(tr('1').querySelector('td[data-col="Name"]')!);
    expect(event).toBe(true); // the browser's default was not prevented
    expect(screen.queryByRole('button', { name: 'Menu' })).toBeNull();
  });

  it('AL-06 Table: swipe({ listItem, swipeContent, srcControl, swipeDirection, preventDefault }) shows swipeContent', () => {
    const onSwipe = vi.fn();
    const content = <button type="button">Approve</button>;
    render(host(<Table columns={columns} items={rows} keyOf={keyOf} swipeContent={content} onSwipe={onSwipe} />));
    swipeLeft(tr('3').querySelector('td[data-col="Name"]')!);
    expect(onSwipe).toHaveBeenCalledWith(expect.objectContaining({ listItem: rows[2], swipeContent: content, swipeDirection: 'EndToBegin' }));
    expect(onSwipe.mock.calls[0]![0].srcControl).toBe(tr('3').querySelector('td[data-col="Name"]'));
    expect(document.querySelector('[data-sk-swipe]')).toHaveTextContent('Approve');
  });

  it('AL-06 Table: swipeDirection BeginToEnd ignores a right-to-left swipe; preventDefault cancels the swipe', () => {
    const onSwipe = vi.fn();
    const { rerender } = render(host(<Table columns={columns} items={rows} keyOf={keyOf} swipeContent="x" swipeDirection="BeginToEnd" onSwipe={onSwipe} />));
    swipeLeft(tr('1'));
    expect(onSwipe).not.toHaveBeenCalled();
    rerender(host(<Table columns={columns} items={rows} keyOf={keyOf} swipeContent="x" onSwipe={(e) => e.preventDefault()} />));
    swipeLeft(tr('1'));
    expect(document.querySelector('[data-sk-swipe]')).toBeNull();
  });

  it('AL-07 Table: getSwipedItem() and swipeOut(callback)', () => {
    const ref = createRef<Table>();
    render(host(<Table ref={ref} columns={columns} items={rows} keyOf={keyOf} swipeContent="Approve" />));
    expect(ref.current!.getSwipedItem()).toBeNull();
    swipeLeft(tr('4'));
    expect(ref.current!.getSwipedItem()).toBe(rows[3]);
    const callback = vi.fn();
    const api = ref.current!;
    let returned: unknown;
    act(() => { returned = api.swipeOut(callback); });
    expect(callback).toHaveBeenCalledWith(rows[3], 'Approve');
    expect(returned).toBe(api); // returns this
    expect(ref.current!.getSwipedItem()).toBeNull();
    expect(document.querySelector('[data-sk-swipe]')).toBeNull();
  });

  it('AL-05 Table: keyboardMode Edit — arrow down in an input moves to the same input of the next row; Navigation keeps the text cursor', () => {
    const { rerender } = render(host(<Table columns={columns} items={rows} keyOf={keyOf} keyboardMode="Edit" />));
    const first = screen.getByLabelText('edit 1');
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(screen.getByLabelText('edit 2'));
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(first);
    // entering the table focuses its first input field
    const head = document.querySelector<HTMLElement>('thead [data-sk-cell][tabindex="0"]')!;
    fireEvent.focusIn(head, { relatedTarget: document.body });
    expect(document.activeElement).toBe(first);
    rerender(host(<Table columns={columns} items={rows} keyOf={keyOf} />));
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(first);
  });
});
