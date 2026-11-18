/**
 * SelectDialog and TableSelectDialog (sap.m, docs/26 3.8): a dialog with a search field and a list (or table) to pick
 * one or several items. Opened through the ref: `ref.current?.open(searchValue?)`; the dialog closes itself on
 * confirm or cancel (UI5 has no public `close`).
 */
import { Badge, Button, Checkbox, Group, Table, Text, TextInput } from '@mantine/core';
import { ArrowDown, ArrowUp, ChevronRight, Pencil, Search } from 'lucide-react';
import { useEffect, useImperativeHandle, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode, type Ref } from 'react';
import { useControlText } from '../context';
import { toneOf, type ValueState } from '../types';
import { DialogFrame, type TitleAlignment } from './DialogFrame';
import { TEXTS } from './texts';

/** sap.m.ListType */
export type ListType = 'Active' | 'Detail' | 'DetailAndActive' | 'Inactive' | 'Navigation';
export const ListType = { Active: 'Active', Detail: 'Detail', DetailAndActive: 'DetailAndActive', Inactive: 'Inactive', Navigation: 'Navigation' } as const;

/** sap.m.SelectDialogInitialFocus */
export type SelectDialogInitialFocus = 'List' | 'SearchField';
export const SelectDialogInitialFocus = { List: 'List', SearchField: 'SearchField' } as const;

/** sap.ui.core.TextAlign */
export type TextAlign = 'Begin' | 'End' | 'Left' | 'Right' | 'Center' | 'Initial';
/** sap.ui.core.VerticalAlign */
export type VerticalAlign = 'Bottom' | 'Inherit' | 'Middle' | 'Top';
/** sap.m.PopinDisplay */
export type PopinDisplay = 'Block' | 'Inline' | 'WithoutHeader';
/** sap.ui.core.SortOrder */
export type SortOrder = 'Ascending' | 'Descending' | 'None';
/** sap.ui.core.Priority */
export type Priority = 'High' | 'Low' | 'Medium' | 'None';

/** The ListItemBase properties shared by StandardListItem and ColumnListItem. */
export interface ListItemBase {
  key: string;
  /** ('Inactive') */
  type?: ListType;
  /** (true) */
  visible?: boolean;
  /** (false) Shows the title in bold. */
  unread?: boolean;
  /** (false) */
  selected?: boolean;
  counter?: number;
  /** ('None') A ValueState or 'Indication01'…'Indication20': the coloured line at the start. */
  highlight?: string;
  highlightText?: string;
  /** (false) */
  navigated?: boolean;
}

/** sap.m.StandardListItem */
export interface StandardListItem extends ListItemBase {
  title?: string;
  description?: string;
  icon?: ReactNode;
  /** (true) */
  iconInset?: boolean;
  /** Icon shown while the item is selected. */
  activeIcon?: ReactNode;
  info?: string;
  /** ('None') */
  infoState?: ValueState;
  infoIcon?: ReactNode;
  /** (true) */
  adaptTitleSize?: boolean;
  /** (false) */
  wrapping?: boolean;
  /** (false) Shows the info as a filled badge. */
  infoStateInverted?: boolean;
  /** (0) With `wrapping`: characters shown before the text is cut (0: the UI5 default, 300 on desktop). */
  wrapCharLimit?: number;
}

/** sap.m.Column */
export interface Column {
  header?: ReactNode;
  footer?: ReactNode;
  width?: string;
  /** ('Begin') */
  hAlign?: TextAlign;
  /** ('Inherit') */
  vAlign?: VerticalAlign;
  /** (true) */
  visible?: boolean;
  /** CSS width or 'Phone' | 'Tablet' | 'Desktop' | 'Small' | 'Medium' | 'Large' | 'XLarge' | 'XXLarge': below it the column is hidden or popped in. */
  minScreenWidth?: string;
  /** (false) */
  demandPopin?: boolean;
  /** ('Block') */
  popinDisplay?: PopinDisplay;
  /** (false) Leaves a cell empty when it repeats the cell above. */
  mergeDuplicates?: boolean;
  /** ('None') */
  sortIndicator?: SortOrder;
  /** ('None') Kept for UI5 compatibility; the dialog's table has no automatic pop-in. */
  importance?: Priority;
  /** (8) Kept for UI5 compatibility (automatic pop-in only). */
  autoPopinWidth?: number;
}

/** sap.m.ColumnListItem */
export interface ColumnListItem extends ListItemBase {
  cells: ReactNode[];
  /** ('Inherit') */
  vAlign?: VerticalAlign;
}

/** Parameters of `updateStarted` / `updateFinished` (sap.m.SelectDialogBase). */
export interface ListUpdateEvent { reason: 'Refresh' | 'Filter' | 'Growing'; actual: number; total: number }

interface CommonProps<I> {
  title?: string;
  noDataText?: string;
  /** (false) */
  multiSelect?: boolean;
  /** (true) Shows `growingThreshold` items and a "More" trigger. */
  growing?: boolean;
  /** (null → 20, the list default) */
  growingThreshold?: number;
  contentWidth?: string;
  /** (false) Keeps the confirmed selection for the next opening; otherwise the items' `selected` is the start. */
  rememberSelections?: boolean;
  contentHeight?: string;
  /** (false) */
  showClearButton?: boolean;
  /** ('OK') */
  confirmButtonText?: string;
  /** (false) */
  draggable?: boolean;
  /** (false) */
  resizable?: boolean;
  /** ('Auto') */
  titleAlignment?: TitleAlignment;
  searchPlaceholder?: string;
  /** ('List') */
  initialFocus?: SelectDialogInitialFocus;
  /**
   * Fired on Enter in the search field and when it is cleared. Extension: without `onSearch` and `onLiveChange` the
   * dialog filters the items itself (title and description, or the text of the cells).
   */
  onSearch?(e: { value: string; clearButtonPressed: boolean }): void;
  onLiveChange?(e: { value: string }): void;
  onConfirm?(e: { selectedItem: I | undefined; selectedItems: I[] }): void;
  onCancel?(): void;
  onSelectionChange?(e: { listItem: I; listItems: I[]; selected: boolean; selectAll: boolean }): void;
  onUpdateStarted?(e: ListUpdateEvent): void;
  onUpdateFinished?(e: ListUpdateEvent): void;
}

export interface $SelectDialogSettings extends CommonProps<StandardListItem> {
  items: StandardListItem[];
  ref?: Ref<SelectDialog>;
}

export interface $TableSelectDialogSettings extends CommonProps<ColumnListItem> {
  columns: Column[];
  items: ColumnListItem[];
  ref?: Ref<TableSelectDialog>;
}

export interface SelectDialog {
  open(searchValue?: string): void;
  /** Deselects all items. */
  clearSelection(): void;
}
export interface TableSelectDialog {
  open(searchValue?: string): void;
}

const textOf = (n: ReactNode): string => (typeof n === 'string' || typeof n === 'number' ? String(n) : Array.isArray(n) ? n.map(textOf).join(' ') : '');
const STATES = ['None', 'Error', 'Warning', 'Success', 'Information'];

/** Class and style of the highlight line of a list item. */
export function highlightOf(h: string | undefined): { className: string; style?: CSSProperties } {
  if (!h || h === 'None') return { className: '' };
  if (STATES.includes(h)) return { className: ` sk-list-item--highlight sk-list-item--hl-${toneOf(h as ValueState)}` };
  const m = /^Indication(\d\d)$/.exec(h);
  return m ? { className: ' sk-list-item--highlight', style: { '--sk-list-hl': `var(--sk-color-indication-${m[1]})` } as CSSProperties } : { className: '' };
}

function useSelectDialog<I extends ListItemBase>(p: CommonProps<I> & { items: I[] }, matches: (item: I, q: string) => boolean) {
  const threshold = p.growingThreshold ?? 20;
  const [opened, setOpened] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [remembered, setRemembered] = useState<Set<string> | null>(null);
  const [shown, setShown] = useState(threshold);
  const [reason, setReason] = useState<ListUpdateEvent['reason'] | null>(null);
  const clientFilter = !p.onSearch && !p.onLiveChange;
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const q = search.trim().toLowerCase();
  const items = p.items.filter((i) => i.visible !== false);
  const filtered = clientFilter && q ? items.filter((i) => matches(i, q)) : items;
  const visible = p.growing ?? true ? filtered.slice(0, shown) : filtered;
  const update = (r: ListUpdateEvent['reason'], actual: number) => { p.onUpdateStarted?.({ reason: r, actual, total: filtered.length }); setReason(r); };

  useEffect(() => {
    if (!reason) return;
    setReason(null);
    p.onUpdateFinished?.({ reason, actual: visible.length, total: filtered.length });
  }, [reason, visible.length, filtered.length, p]);

  useEffect(() => {
    if (!opened) return undefined;
    const id = requestAnimationFrame(() => {
      if (p.initialFocus === 'SearchField') searchRef.current?.focus();
      else listRef.current?.querySelector<HTMLElement>('[tabindex="0"]')?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [opened, p.initialFocus]);

  const open = (searchValue = '') => {
    setSearch(searchValue);
    setShown(threshold);
    setSelected(new Set(p.rememberSelections && remembered ? remembered : p.items.filter((i) => i.selected).map((i) => i.key)));
    setOpened(true);
    update('Refresh', 0);
    if (searchValue) p.onLiveChange?.({ value: searchValue });
  };
  const chosen = () => p.items.filter((i) => selected.has(i.key));
  const confirm = (keys: Set<string>) => {
    const out = p.items.filter((i) => keys.has(i.key));
    setOpened(false);
    if (p.rememberSelections) setRemembered(keys);
    p.onConfirm?.({ selectedItem: out[0], selectedItems: out });
  };
  const cancel = () => { setOpened(false); p.onCancel?.(); };
  const toggle = (item: I) => {
    const on = !selected.has(item.key);
    const next = new Set(p.multiSelect ? selected : []);
    if (on) next.add(item.key); else next.delete(item.key);
    setSelected(next);
    p.onSelectionChange?.({ listItem: item, listItems: [item], selected: on, selectAll: false });
    // Single selection confirms right away, as in UI5.
    if (!p.multiSelect && on) confirm(next);
  };
  const setQuery = (value: string) => { setSearch(value); setShown(threshold); update('Filter', 0); };
  const grow = () => { update('Growing', visible.length); setShown(shown + threshold); };
  return { opened, open, search, setQuery, selected, setSelected, filtered, visible, grow, chosen, confirm, cancel, toggle, searchRef, listRef, threshold };
}

type State<I extends ListItemBase> = ReturnType<typeof useSelectDialog<I>>;

function Frame<I extends ListItemBase>({ p, s, children }: { p: CommonProps<I>; s: State<I>; children: ReactNode }) {
  const t = useControlText(TEXTS);
  const submit = (e: KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') p.onSearch?.({ value: s.search, clearButtonPressed: false }); };
  return (
    <DialogFrame
      opened={s.opened} onClose={s.cancel} title={p.title ?? ''} titleAlignment={p.titleAlignment} contentWidth={p.contentWidth} contentHeight={p.contentHeight}
      draggable={p.draggable} resizable={p.resizable} className="sk-select-dialog"
      subHeader={(
        <>
          <TextInput
            ref={s.searchRef} type="search" value={s.search} placeholder={p.searchPlaceholder ?? t('ctl.list.search')} aria-label={p.searchPlaceholder ?? t('ctl.list.search')}
            leftSection={<Search className="sk-icon" />}
            onChange={(e) => {
              const value = e.currentTarget.value;
              s.setQuery(value);
              p.onLiveChange?.({ value });
              if (!value) p.onSearch?.({ value, clearButtonPressed: true });
            }}
            onKeyDown={submit}
          />
          {p.multiSelect && s.selected.size > 0 && <Text size="sm" className="sk-select-dialog__info" role="status">{t('ctl.list.selectedCount', { count: s.selected.size })}</Text>}
        </>
      )}
      footer={(
        <Group justify="flex-end" gap="xs">
          {p.multiSelect && <Button size="sm" onClick={() => s.confirm(new Set(s.chosen().map((i) => i.key)))}>{p.confirmButtonText ?? t('common.ok')}</Button>}
          {p.showClearButton && <Button size="sm" variant="default" disabled={s.selected.size === 0} onClick={() => s.setSelected(new Set())}>{t('common.clear')}</Button>}
          <Button size="sm" variant="default" onClick={s.cancel}>{t('common.cancel')}</Button>
        </Group>
      )}
    >
      <div ref={s.listRef}>
        {s.filtered.length === 0 ? <Text className="sk-select-dialog__empty" c="dimmed">{p.noDataText ?? t('ctl.list.noData')}</Text> : children}
      </div>
      {(p.growing ?? true) && s.filtered.length > s.visible.length && (
        <button type="button" className="sk-select-dialog__more" onClick={s.grow} data-sk-growing>
          <span>{t('ctl.list.more')}</span>
          <Text span size="sm" c="dimmed">{t('ctl.list.moreCount', { shown: s.visible.length, total: s.filtered.length })}</Text>
        </button>
      )}
    </DialogFrame>
  );
}

const activate = (fn: () => void) => (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } };
const DEFAULT_WRAP_LIMIT = 300;
const typeIcon = (type: ListType | undefined) => (type === 'Navigation' ? <ChevronRight className="sk-icon" aria-hidden />
  : type === 'Detail' || type === 'DetailAndActive' ? <Pencil className="sk-icon" aria-hidden /> : null);

/** SelectDialog (sap.m.SelectDialog) with StandardListItem data. */
export function SelectDialog(p: $SelectDialogSettings) {
  const s = useSelectDialog(p, (i, q) => (i.title ?? '').toLowerCase().includes(q) || (i.description ?? '').toLowerCase().includes(q));
  useImperativeHandle(p.ref, () => ({ open: s.open, clearSelection() { s.setSelected(new Set()); } }));
  return (
    <Frame p={p} s={s}>
      <div role="listbox" aria-multiselectable={p.multiSelect || undefined} aria-label={p.title} className="sk-select-dialog__list">
        {s.visible.map((i, n) => {
          const on = s.selected.has(i.key);
          const hl = highlightOf(i.highlight);
          const limit = i.wrapCharLimit || DEFAULT_WRAP_LIMIT;
          const cut = (x: string | undefined) => (x && i.wrapping && x.length > limit ? `${x.slice(0, limit)}…` : x);
          const icon = on && i.activeIcon ? i.activeIcon : i.icon;
          return (
            <div
              key={i.key} role="option" aria-selected={on} tabIndex={n === 0 ? 0 : -1} data-sk-key={i.key}
              className={`sk-list-item${on ? ' sk-list-item--selected' : ''}${i.wrapping ? ' sk-list-item--wrapping' : ''}${i.unread ? ' sk-list-item--unread' : ''}${i.navigated ? ' sk-list-item--navigated' : ''}${hl.className}`}
              style={hl.style} title={i.highlightText || undefined}
              onClick={() => s.toggle(i)} onKeyDown={(e) => {
                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                  e.preventDefault();
                  ((e.key === 'ArrowDown' ? e.currentTarget.nextElementSibling : e.currentTarget.previousElementSibling) as HTMLElement | null)?.focus();
                } else activate(() => s.toggle(i))(e);
              }}
            >
              {p.multiSelect && <Checkbox checked={on} readOnly tabIndex={-1} aria-hidden />}
              {icon && <span className={`sk-list-item__icon${i.iconInset === false ? '' : ' sk-list-item__icon--inset'}`} aria-hidden>{icon}</span>}
              <span className="sk-list-item__main">
                <span className={`sk-list-item__title${i.adaptTitleSize === false || i.description ? '' : ' sk-list-item__title--large'}`}>{cut(i.title)}</span>
                {i.description && <span className="sk-list-item__description">{cut(i.description)}</span>}
              </span>
              {i.info && (
                i.infoStateInverted
                  ? <Badge className={`sk-list-item__info sk-list-item__info--inverted sk-list-item__badge--${toneOf(i.infoState)}`} leftSection={i.infoIcon}>{i.info}</Badge>
                  : <span className={`sk-list-item__info sk-status--${toneOf(i.infoState)}`}>{i.infoIcon}{i.info}</span>
              )}
              {i.counter !== undefined && i.counter !== 0 && <span className="sk-list-item__counter">{i.counter}</span>}
              {typeIcon(i.type)}
            </div>
          );
        })}
      </div>
    </Frame>
  );
}

const H_ALIGN: Record<TextAlign, CSSProperties['textAlign']> = { Begin: 'start', Left: 'left', End: 'end', Right: 'right', Center: 'center', Initial: undefined };
const V_ALIGN: Record<VerticalAlign, CSSProperties['verticalAlign']> = { Top: 'top', Middle: 'middle', Bottom: 'bottom', Inherit: undefined };
/** The UI5 names of `minScreenWidth`, in CSS pixels (sap.m.ScreenSize). */
const SCREEN: Record<string, number> = { Phone: 240, Tablet: 600, Desktop: 1024, Small: 240, Medium: 560, Large: 960, XLarge: 1440, XXLarge: 1920, XSmall: 320, XXSmall: 240 };

/** Whether the window is at least each column's `minScreenWidth` wide (columns without one always fit). */
function useScreenFit(columns: Column[]): boolean[] {
  const queries = columns.map((c) => (!c.minScreenWidth ? '' : SCREEN[c.minScreenWidth] ? `(min-width: ${SCREEN[c.minScreenWidth]}px)` : `(min-width: ${c.minScreenWidth})`)).join('|');
  const read = () => queries.split('|').map((q) => !q || typeof window === 'undefined' || !window.matchMedia || window.matchMedia(q).matches);
  const [fit, setFit] = useState(read);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const lists = queries.split('|').filter(Boolean).map((q) => window.matchMedia(q));
    const update = () => setFit(queries.split('|').map((q) => !q || window.matchMedia(q).matches));
    update();
    lists.forEach((l) => l.addEventListener?.('change', update));
    return () => lists.forEach((l) => l.removeEventListener?.('change', update));
  }, [queries]);
  return fit;
}

/** TableSelectDialog (sap.m.TableSelectDialog) with columns and ColumnListItem rows. */
export function TableSelectDialog(p: $TableSelectDialogSettings) {
  const s = useSelectDialog(p, (i, q) => i.cells.some((c) => textOf(c).toLowerCase().includes(q)));
  useImperativeHandle(p.ref, () => ({ open: s.open }));
  const fit = useScreenFit(p.columns);
  const shown = p.columns.map((c, i) => c.visible !== false && fit[i] !== false);
  const popin = p.columns.map((c, i) => c.visible !== false && fit[i] === false && Boolean(c.demandPopin));
  const firstShown = shown.indexOf(true);
  const sortIcon = (o: SortOrder | undefined) => (o === 'Ascending' ? <ArrowUp className="sk-icon" aria-hidden /> : o === 'Descending' ? <ArrowDown className="sk-icon" aria-hidden /> : null);
  const anyFooter = p.columns.some((c, i) => shown[i] && c.footer !== undefined);
  return (
    <Frame p={p} s={s}>
      <Table className="sk-select-dialog__table" highlightOnHover aria-multiselectable={p.multiSelect || undefined} aria-label={p.title}>
        <Table.Thead>
          <Table.Tr>
            {p.multiSelect && <Table.Th className="sk-select-dialog__check" />}
            {p.columns.map((c, i) => shown[i] && (
              <Table.Th key={i} style={{ width: c.width, textAlign: H_ALIGN[c.hAlign ?? 'Begin'], verticalAlign: V_ALIGN[c.vAlign ?? 'Inherit'] }}
                aria-sort={c.sortIndicator === 'Ascending' ? 'ascending' : c.sortIndicator === 'Descending' ? 'descending' : undefined}>
                {c.header}{sortIcon(c.sortIndicator)}
              </Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {s.visible.map((row, r) => {
            const on = s.selected.has(row.key);
            const hl = highlightOf(row.highlight);
            const prev = s.visible[r - 1];
            return (
              <Table.Tr
                key={row.key} aria-selected={on} tabIndex={r === 0 ? 0 : -1} data-sk-key={row.key} style={hl.style}
                className={`sk-select-dialog__row${on ? ' sk-select-dialog__row--selected' : ''}${row.unread ? ' sk-list-item--unread' : ''}${hl.className}`}
                onClick={() => s.toggle(row)} onKeyDown={activate(() => s.toggle(row))}
              >
                {p.multiSelect && <Table.Td className="sk-select-dialog__check"><Checkbox checked={on} readOnly tabIndex={-1} aria-label={textOf(row.cells[0])} /></Table.Td>}
                {row.cells.map((c, i) => {
                  const col = p.columns[i];
                  if (!shown[i] || !col) return null;
                  const merged = col.mergeDuplicates && prev && textOf(prev.cells[i]) === textOf(c) && textOf(c) !== '';
                  return (
                    <Table.Td key={i} style={{ textAlign: H_ALIGN[col.hAlign ?? 'Begin'], verticalAlign: V_ALIGN[row.vAlign ?? col.vAlign ?? 'Inherit'] }}>
                      {merged ? null : c}
                      {i === firstShown && popin.some(Boolean) && (
                        <div className="sk-select-dialog__popin">
                          {row.cells.map((pc, j) => popin[j] && (
                            <div key={j} className={`sk-select-dialog__popin-item sk-select-dialog__popin-item--${(p.columns[j]!.popinDisplay ?? 'Block').toLowerCase()}`}>
                              {p.columns[j]!.popinDisplay !== 'WithoutHeader' && <span className="sk-select-dialog__popin-label">{p.columns[j]!.header}:</span>} {pc}
                            </div>
                          ))}
                        </div>
                      )}
                    </Table.Td>
                  );
                })}
              </Table.Tr>
            );
          })}
        </Table.Tbody>
        {anyFooter && (
          <Table.Tfoot>
            <Table.Tr>
              {p.multiSelect && <Table.Td />}
              {p.columns.map((c, i) => shown[i] && <Table.Td key={i} style={{ textAlign: H_ALIGN[c.hAlign ?? 'Begin'] }}>{c.footer}</Table.Td>)}
            </Table.Tr>
          </Table.Tfoot>
        )}
      </Table>
    </Frame>
  );
}
