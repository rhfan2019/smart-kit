/**
 * sap.m.p13n.SelectionPanel (1.154): a list of fields to select (show / hide) and reorder. The state is an array of
 * sap.m.p13n.Item (`p13nData`, BasePanel.setP13nData); `getP13nData()` on the ref returns what the user set.
 */
import { ActionIcon, Button, Checkbox, Group, ScrollArea, Stack, Text, TextInput } from '@mantine/core';
import { Circle, X } from 'lucide-react';
import { useImperativeHandle, useState, type ReactNode, type Ref } from 'react';
import type { MultiSelectMode } from '../../table/ResponsiveTable';
import { cx } from '../display/shared';
import { MoveButtons, moveItem, PANEL_TITLES, useP13nText, usePanelData, type BasePanel$ChangeEvent, type BasePanelMethods, type Item } from './base';

/** SelectionPanel `change` event (sap.m.p13n.BasePanel `change`). */
export type SelectionPanel$ChangeEvent = BasePanel$ChangeEvent<Item>;

export interface $SelectionPanelSettings {
  /** A short text describing the panel (the tab text in a Popup with several panels). Default: the localized text "Fields" (p13n.DEFAULT_TITLE_SELECTION). @defaultValue ...see text or source */
  title?: string;
  /** Whether the items can be reordered (move buttons). @defaultValue true */
  enableReorder?: boolean;
  /** Shows a header with a search field and the "Show Selected" switch. @defaultValue false */
  showHeader?: boolean;
  /** Shows the count of selected items in the field column header, e.g. "Field (3/12)". @defaultValue false */
  enableCount?: boolean;
  /** The header text of the field column; empty: the localized text "Field". @defaultValue "" */
  fieldColumn?: string;
  /** The header text of the second column; when set, items with `active: true` show an active marker there. @defaultValue "" */
  activeColumn?: string;
  /** Extra content per item, rendered below its label (UI5: a factory returning a control per item). */
  itemFactory?: (item: Item) => ReactNode;
  /** The multi-selection mode of the list: ClearAll shows a "Deselect All" button, SelectAll / Default a select-all check box. @defaultValue 'ClearAll' */
  multiSelectMode?: MultiSelectMode;
  /** A message strip shown above the list (BasePanel `messageStrip`, a sap.m.MessageStrip element). */
  messageStrip?: ReactNode;
  /** The personalization state shown (BasePanel.setP13nData); a new array starts the panel again from it. */
  p13nData?: Item[];
  /** Fired when the user changes the state (BasePanel `change`). */
  onChange?: (e: SelectionPanel$ChangeEvent) => void;
  ref?: Ref<SelectionPanel>;
}

/** Instance methods of SelectionPanel (sap.m.p13n.BasePanel). */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- the instance type merged with the component (ADR-033)
export interface SelectionPanel extends BasePanelMethods<Item> {}

export function SelectionPanel({
  enableReorder = true, showHeader = false, enableCount = false, fieldColumn = '', activeColumn = '', itemFactory,
  multiSelectMode = 'ClearAll', messageStrip, p13nData, onChange, ref,
}: $SelectionPanelSettings) {
  const t = useP13nText();
  const [search, setSearch] = useState('');
  const [onlySelected, setOnlySelected] = useState(false);
  // BasePanel.onReset (Popup reset): clears the search
  const { items, itemsRef, set, changed } = usePanelData(p13nData, () => { setSearch(''); });
  useImperativeHandle(ref, () => ({
    getP13nData: (bOnlyActive) => (bOnlyActive ? itemsRef.current.filter((x) => x.visible) : itemsRef.current),
    setP13nData: (a) => set(a),
    getItemByKey: (name) => itemsRef.current.find((x) => x.name === name),
  }), [itemsRef, set]);
  const fire = (next: Item[], e: BasePanel$ChangeEvent<Item>) => { set(next); changed(); onChange?.(e); };
  const toggle = (name: string, visible: boolean) => {
    const next = items.map((x) => (x.name === name ? { ...x, visible } : x));
    fire(next, { reason: visible ? 'Add' : 'Remove', item: next.find((x) => x.name === name)! });
  };
  const all = (visible: boolean) => {
    const next = items.map((x) => ({ ...x, visible }));
    fire(next, { reason: visible ? 'SelectAll' : 'DeselectAll', item: next });
  };
  const move = (from: number, to: number) => {
    const next = moveItem(items, from, to);
    if (next !== items) fire(next, { reason: 'Move', item: next[to]! });
  };
  const q = search.trim().toLowerCase();
  const shown = items.filter((x) => (!onlySelected || x.visible) && (!q || x.label.toLowerCase().includes(q)));
  const selected = items.filter((x) => x.visible).length;
  const header = (fieldColumn || t('ctl.p13n.field')) + (enableCount ? ` ${t('ctl.p13n.count', { selected, total: items.length })}` : '');
  const allChecked = items.length > 0 && selected === items.length;
  return (
    <Stack gap="xs" className="sk-p13n-panel sk-p13n-selection" data-sk-p13n-selection-panel>
      {messageStrip}
      {showHeader ? (
        <Group gap="xs" wrap="nowrap">
          <TextInput className="sk-grow" size="xs" value={search} placeholder={t('ctl.p13n.search')} aria-label={t('ctl.p13n.search')} onChange={(e) => setSearch(e.currentTarget.value)} data-sk-p13n-search />
          <Button size="xs" variant="subtle" onClick={() => setOnlySelected((x) => !x)} aria-pressed={onlySelected}>{onlySelected ? t('ctl.p13n.showAll') : t('ctl.p13n.showSelected')}</Button>
        </Group>
      ) : null}
      <Group justify="space-between" wrap="nowrap" className="sk-p13n__header">
        <Group gap="xs" wrap="nowrap">
          {multiSelectMode === 'ClearAll' ? (
            <ActionIcon variant="subtle" size="sm" disabled={!selected} onClick={() => all(false)} aria-label={t('ctl.p13n.clearAll')} title={t('ctl.p13n.clearAll')} data-sk-p13n-clear-all><X className="sk-icon" /></ActionIcon>
          ) : (
            <Checkbox aria-label={t('ctl.p13n.selectAll')} checked={allChecked} indeterminate={!!selected && !allChecked} onChange={() => all(!allChecked)} data-sk-p13n-select-all />
          )}
          <Text size="sm" fw={600}>{header}</Text>
        </Group>
        {activeColumn ? <Text size="sm" fw={600}>{activeColumn}</Text> : null}
      </Group>
      <ScrollArea.Autosize mah="var(--sk-size-dialog-list)">
        <Stack gap={4}>
          {shown.map((x) => {
            const i = items.indexOf(x);
            return (
              <Group key={x.name} justify="space-between" wrap="nowrap" className={cx('sk-p13n__row', x.visible && 'sk-p13n__row--selected')} title={x.tooltip}>
                <Stack gap={2} className="sk-grow">
                  <Checkbox label={x.label} checked={x.visible} data-sk-p13n-item={x.name} onChange={(e) => toggle(x.name, e.currentTarget.checked)} />
                  {itemFactory ? itemFactory(x) : null}
                </Stack>
                <Group gap="xs" wrap="nowrap">
                  {activeColumn ? (
                    <span className="sk-p13n__active" aria-label={x.active ? t('ctl.p13n.active') : t('ctl.p13n.inactive')} role="img">
                      {x.active ? <Circle className="sk-icon" fill="currentColor" /> : null}
                    </span>
                  ) : null}
                  {enableReorder && !q && !onlySelected ? <MoveButtons index={i} count={items.length} label={x.label} onMove={(to) => move(i, to)} /> : null}
                </Group>
              </Group>
            );
          })}
        </Stack>
      </ScrollArea.Autosize>
    </Stack>
  );
}
PANEL_TITLES.set(SelectionPanel as never, 'ctl.p13n.titleSelection');
