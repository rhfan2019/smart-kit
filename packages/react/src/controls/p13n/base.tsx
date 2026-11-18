/**
 * Shared parts of the sap.m.p13n panels (sap.m.p13n.BasePanel 1.154): the item typedefs, the `change` event, the
 * link to the enclosing Popup (reset button, panel reset) and the move buttons.
 */
import { ActionIcon, Group } from '@mantine/core';
import { ArrowDown, ArrowDownToLine, ArrowUp, ArrowUpToLine } from 'lucide-react';
import { createContext, useContext, useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react';
import { useControlText } from '../context';
import { TEXTS } from './texts';

/** sap.m.p13n.Item: one personalization entry (a column, a field). */
export interface Item {
  /** The unique key of the item. */
  name: string;
  /** The text shown for the item. */
  label: string;
  /** Whether the item is selected (shown). */
  visible: boolean;
  /** SelectionPanel `activeColumn`: whether the item is marked active. */
  active?: boolean;
  /** A tooltip for the item. */
  tooltip?: string;
}

/** sap.m.p13n.SortItem */
export interface SortItem {
  name: string;
  label: string;
  /** Whether the item is sorted. */
  sorted: boolean;
  /** Descending sort order. */
  descending: boolean;
}

/** sap.m.p13n.GroupItem */
export interface GroupItem {
  name: string;
  label: string;
  /** Whether the item is grouped. */
  grouped: boolean;
  /** GroupPanel `enableShowField`: whether the grouped field stays visible as a column (default true). */
  showIfGrouped?: boolean;
}

/** The `reason` of the BasePanel `change` event (BasePanel.CHANGE_REASON_*, SortPanel / GroupPanel extras). */
export type ChangeReason = 'Add' | 'Remove' | 'Move' | 'SelectAll' | 'DeselectAll' | 'RangeSelect' | 'sortorder' | 'showifgrouped';

/** sap.m.p13n.BasePanel `change` event. */
export interface BasePanel$ChangeEvent<T = Item> {
  /** Add, Remove, Move, SelectAll, DeselectAll, RangeSelect (SortPanel: sortorder; GroupPanel: showifgrouped). */
  reason: ChangeReason;
  /** The changed item (for SelectAll / DeselectAll the list of items). */
  item: T | T[];
}

/** Instance methods every panel has (sap.m.p13n.BasePanel). */
export interface BasePanelMethods<T> {
  /** The personalization state currently shown; `bOnlyActive` returns only the present (visible / sorted / grouped) items. */
  getP13nData(bOnlyActive?: boolean): T[];
  /** Replaces the state shown by the panel (BasePanel.setP13nData). */
  setP13nData(aP13nData: T[]): void;
  /** The item with the given key, or undefined (BasePanel.getItemByKey). */
  getItemByKey(sName: string): T | undefined;
}

/** What a panel inside a Popup reports to it (Popup.addPanel attaches to `change`; Popup._resetPanels calls `onReset`). */
interface PopupLink { changed(): void; registerReset(fn: () => void): () => void }
export const PopupLinkContext = createContext<PopupLink | null>(null);

/** The panel's state: starts from `p13nData` and starts again when the prop changes (setP13nData). */
export function usePanelData<T>(p13nData: T[] | undefined, onReset?: () => void) {
  const [items, setItems] = useState<T[]>(() => p13nData ?? []);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const [seen, setSeen] = useState(p13nData);
  if (seen !== p13nData) {
    setSeen(p13nData);
    setItems(p13nData ?? []);
  }
  const link = useContext(PopupLinkContext);
  const resetRef = useRef(onReset);
  resetRef.current = onReset;
  useEffect(() => link?.registerReset(() => resetRef.current?.()), [link]);
  const set = (next: T[]) => { itemsRef.current = next; setItems(next); };
  return { items, itemsRef, set, changed: () => link?.changed() };
}

/** The default `title` of each panel class (the Popup shows it on the tab when the panel has none). */
export const PANEL_TITLES = new Map<ComponentType<never>, string>();

export function useP13nText() {
  return useControlText(TEXTS);
}

/** Move buttons of a row (BasePanel move to top / up / down / bottom). */
export function MoveButtons({ index, count, label, onMove, top = true }: { index: number; count: number; label: string; onMove(to: number): void; top?: boolean }) {
  const t = useP13nText();
  const btn = (to: number, text: string, icon: ReactNode, disabled: boolean) => (
    <ActionIcon variant="subtle" size="sm" disabled={disabled} onClick={() => onMove(to)} aria-label={`${text}: ${label}`} title={text}>{icon}</ActionIcon>
  );
  return (
    <Group gap={0} wrap="nowrap" className="sk-p13n__move">
      {top ? btn(0, t('ctl.p13n.moveToTop'), <ArrowUpToLine className="sk-icon" />, index === 0) : null}
      {btn(index - 1, t('ctl.p13n.moveUp'), <ArrowUp className="sk-icon" />, index === 0)}
      {btn(index + 1, t('ctl.p13n.moveDown'), <ArrowDown className="sk-icon" />, index >= count - 1)}
      {top ? btn(count - 1, t('ctl.p13n.moveToBottom'), <ArrowDownToLine className="sk-icon" />, index >= count - 1) : null}
    </Group>
  );
}

/** Moves `list[from]` to `to`. */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length || from === to) return list;
  const next = [...list];
  const [x] = next.splice(from, 1);
  next.splice(to, 0, x!);
  return next;
}
