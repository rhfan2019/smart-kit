/**
 * The query rows of sap.m.p13n.QueryPanel (1.154), shared by SortPanel and GroupPanel: one row per present item
 * (in the order of the state), each with a field selection, its own controls and a remove button, plus an empty row
 * to add a query (left out when `queryLimit` rows exist or every item is used). The field list offers every item,
 * the ones queried in other rows disabled.
 */
import { ActionIcon, Group, Select, Stack } from '@mantine/core';
import { X } from 'lucide-react';
import { useImperativeHandle, type ReactNode, type Ref } from 'react';
import { MoveButtons, moveItem, usePanelData, type BasePanel$ChangeEvent, type BasePanelMethods } from './base';

interface QueryItem { name: string; label: string }

export interface QueryRowsProps<T extends QueryItem> {
  presence: 'sorted' | 'grouped';
  enableReorder: boolean;
  queryLimit: number;
  placeholder: string;
  removeText: string;
  messageStrip?: ReactNode;
  p13nData?: T[];
  onChange?: (e: BasePanel$ChangeEvent<T>) => void;
  panelRef?: Ref<BasePanelMethods<T>>;
  /** Extra controls of a row; `update` changes the row's item and fires `change` with the given reason. */
  extra?: (item: T | undefined, update: (patch: Partial<T>, reason: 'sortorder' | 'showifgrouped') => void) => ReactNode;
  /** Data attribute of the field selection (e2e). */
  fieldAttr: string;
  className: string;
}

export function QueryRows<T extends QueryItem>(p: QueryRowsProps<T>) {
  const { items, itemsRef, set, changed } = usePanelData(p.p13nData);
  const isOn = (x: T) => Boolean((x as unknown as Record<string, unknown>)[p.presence]);
  const withPresence = (x: T, on: boolean) => ({ ...x, [p.presence]: on }) as T;
  // QueryPanel.getP13nData: the queried items in row order, then (unless bOnlyActive) the others
  const ordered = (list: T[]) => [...list.filter(isOn), ...list.filter((x) => !isOn(x))];
  useImperativeHandle(p.panelRef, () => ({
    getP13nData: (bOnlyActive) => (bOnlyActive ? itemsRef.current.filter(isOn) : ordered(itemsRef.current)),
    setP13nData: (a) => set(a),
    getItemByKey: (name) => itemsRef.current.find((x) => x.name === name),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- isOn only depends on the presence attribute
  }), [itemsRef, set, p.presence]);
  const rows = items.filter(isOn);
  const fire = (next: T[], e: BasePanel$ChangeEvent<T>) => { set(next); changed(); p.onChange?.(e); };
  // QueryPanel._selectKey / _updatePresence: the row's old item stops being present, the new one takes its place
  const select = (row: number, name: string | null) => {
    if (!name) return;
    const old = rows[row];
    const picked = items.find((x) => x.name === name);
    if (!picked || picked === old) return;
    const nextRows = [...rows];
    const on = withPresence(picked, true);
    if (old) nextRows[row] = on; else nextRows.push(on);
    const rest = items.filter((x) => x.name !== name && x !== old && !isOn(x));
    const next = [...nextRows, ...(old ? [withPresence(old, false)] : []), ...rest];
    fire(next, { reason: 'Add', item: on });
  };
  const remove = (row: number) => {
    const old = rows[row]!;
    const off = withPresence(old, false);
    fire([...rows.filter((_, i) => i !== row), off, ...items.filter((x) => !isOn(x))], { reason: 'Remove', item: off });
  };
  const move = (from: number, to: number) => {
    const nextRows = moveItem(rows, from, to);
    if (nextRows === rows) return;
    fire([...nextRows, ...items.filter((x) => !isOn(x))], { reason: 'Move', item: nextRows[to]! });
  };
  const update = (row: number) => (patch: Partial<T>, reason: 'sortorder' | 'showifgrouped') => {
    const changedItem = { ...rows[row]!, ...patch };
    fire(items.map((x) => (x === rows[row] ? changedItem : x)), { reason, item: changedItem });
  };
  const limited = p.queryLimit > -1;
  const showEmpty = !(limited && rows.length >= p.queryLimit) && rows.length < items.length;
  // move buttons only when reordering is enabled and at least two queries are possible (QueryPanel._addQueryRow)
  const canMove = p.enableReorder && (p.queryLimit === -1 || p.queryLimit > 1);
  const data = (current?: T) => items.map((x) => ({ value: x.name, label: x.label, disabled: isOn(x) && x !== current }));
  const row = (item: T | undefined, i: number) => (
    <Group key={item?.name ?? '$_none'} wrap="nowrap" gap="xs" className="sk-p13n__query">
      <Select
        className="sk-grow" size="sm" value={item?.name ?? null} placeholder={p.placeholder} aria-label={p.placeholder} allowDeselect={false}
        data={data(item)} onChange={(v) => select(i, v)} {...{ [p.fieldAttr]: item?.name ?? '' }}
        // the panel may have been measured while its tab was hidden (display: none); keep the list shown when opened
        comboboxProps={{ hideDetached: false }}
      />
      {p.extra?.(item, update(i))}
      {item ? (
        <ActionIcon variant="subtle" onClick={() => remove(i)} aria-label={p.removeText} title={p.removeText} data-sk-p13n-remove><X className="sk-icon" /></ActionIcon>
      ) : <span className="sk-p13n__remove-placeholder" />}
      {canMove && item ? <MoveButtons index={i} count={rows.length} label={item.label} top={false} onMove={(to) => move(i, to)} /> : null}
    </Group>
  );
  return (
    <Stack gap="xs" className={`sk-p13n-panel ${p.className}`}>
      {p.messageStrip}
      {rows.map((x, i) => row(x, i))}
      {showEmpty ? row(undefined, rows.length) : null}
    </Stack>
  );
}
