/**
 * sap.m.Table (ADR-020, ADR-033; LR Table / Sticky Behavior / Responsiveness): a semantic table that scrolls with the
 * page, grows ("More" button or scroll to load), keeps the column headers sticky, moves columns into the pop-in area
 * by importance on narrow widths (`autoPopinMode`), selects rows (`mode`), groups rows (with subtotals and counts in
 * the group header) and shows a totals row at the end (docs/23), shows a tree (treegrid, docs/26 §3.10) and fires
 * `itemPress` when a navigable row is clicked.
 *
 * React form (ADR-032 rule 2): `items` are the row data and every column renders its cell with `cell(row)` — the
 * column list item template of a UI5 items binding; `keyOf` gives the row key.
 */
import { ActionIcon, Button, Checkbox, Loader, Menu, Popover, Radio, Text } from '@mantine/core';
import type { HierarchyNode, Row } from '@rhfan2019/smart-kit-core';
import { ChevronRight, MoreHorizontal, Pencil, Trash2, X } from 'lucide-react';
import {
  useEffect, useImperativeHandle, useLayoutEffect, useRef, useState,
  type FocusEvent, type KeyboardEvent, type MouseEvent, type ReactNode, type Ref, type TouchEvent,
} from 'react';
import { useText } from '../context/SmartKitProvider';
import { getPath } from '../field/values';
import type { TitleLevel } from '../controls/types';
import { TreeCell } from './tree';

/** sap.m.ListMode (the deprecated SingleSelect is left out). */
export type ListMode = 'None' | 'SingleSelectLeft' | 'SingleSelectMaster' | 'MultiSelect' | 'Delete';
export const ListMode = { None: 'None', SingleSelectLeft: 'SingleSelectLeft', SingleSelectMaster: 'SingleSelectMaster', MultiSelect: 'MultiSelect', Delete: 'Delete' } as const;
/** sap.m.PopinLayout */
export type PopinLayout = 'Block' | 'GridLarge' | 'GridSmall';
export const PopinLayout = { Block: 'Block', GridLarge: 'GridLarge', GridSmall: 'GridSmall' } as const;
/** sap.m.Sticky */
export type Sticky = 'ColumnHeaders' | 'GroupHeaders' | 'HeaderToolbar' | 'InfoToolbar';
export const Sticky = { ColumnHeaders: 'ColumnHeaders', GroupHeaders: 'GroupHeaders', HeaderToolbar: 'HeaderToolbar', InfoToolbar: 'InfoToolbar' } as const;
/** sap.m.MultiSelectMode */
export type MultiSelectMode = 'Default' | 'ClearAll' | 'SelectAll';
export const MultiSelectMode = { Default: 'Default', ClearAll: 'ClearAll', SelectAll: 'SelectAll' } as const;
/** sap.m.ListSeparators */
export type ListSeparators = 'All' | 'Inner' | 'None';
export const ListSeparators = { All: 'All', Inner: 'Inner', None: 'None' } as const;
/** sap.ui.core.Priority (column importance). */
export type Priority = 'None' | 'Low' | 'Medium' | 'High';
/** sap.m.PopinDisplay */
export type PopinDisplay = 'Block' | 'Inline' | 'WithoutHeader';
/** sap.m.ListKeyboardMode */
export type ListKeyboardMode = 'Edit' | 'Navigation';
export const ListKeyboardMode = { Edit: 'Edit', Navigation: 'Navigation' } as const;
/** sap.m.ListGrowingDirection */
export type ListGrowingDirection = 'Downwards' | 'Upwards';
export const ListGrowingDirection = { Downwards: 'Downwards', Upwards: 'Upwards' } as const;
/** sap.m.SwipeDirection */
// LeftToRight / RightToLeft are deprecated in 1.154 (no old names, docs/30 §9)
export type SwipeDirection = 'BeginToEnd' | 'Both' | 'EndToBegin';
export const SwipeDirection = { BeginToEnd: 'BeginToEnd', Both: 'Both', EndToBegin: 'EndToBegin' } as const;
/** sap.m.ListItemActionType */
export type ListItemActionType = 'Custom' | 'Delete' | 'Edit' | 'Navigation';
// Navigation is a restricted value in 1.154 (used by sap.m internally); the type keeps it for the row actions
export const ListItemActionType = { Custom: 'Custom', Delete: 'Delete', Edit: 'Edit' } as const;

/**
 * An action of a row (sap.m.ListItemAction of the list item aggregation `actions`). "Edit" and "Delete" bring their
 * own icon and text (Ctrl+E and Delete on the focused row press them); "Navigation" is not shown but makes the row
 * navigable (chevron and `itemPress`).
 */
export interface $ListItemActionSettings {
  /** Key of the action (React key; tells actions apart in `itemActionPress`). Defaults to the type and the text. */
  key?: string;
  /** @defaultValue "Custom" */
  type?: ListItemActionType;
  /** Text (tooltip of the button, text of the overflow menu item) of a "Custom" action. @defaultValue "" */
  text?: string;
  /** Icon of a "Custom" action. */
  icon?: ReactNode;
  /** @defaultValue true */
  visible?: boolean;
}

/** A column (sap.m.Column) of the `columns` aggregation. */
export interface $ColumnSettings {
  /** Column id (the element id in UI5); used in events and for `groupBy`. */
  id: string;
  /** Column header (sap.m.Column aggregation `header`). */
  header: ReactNode;
  /** Cell of a row: the column list item template (React form of the items binding). */
  cell(row: Row): ReactNode;
  /** Importance for the automatic pop-in (`autoPopinMode`); "None" counts as "Medium". @defaultValue "None" */
  importance?: Priority;
  /** Horizontal alignment of the header and the cells. @defaultValue "Begin" */
  hAlign?: 'Begin' | 'End' | 'Center' | 'Left' | 'Right' | 'Initial';
  /** Column width (CSS length). */
  width?: string;
  /** @defaultValue true */
  visible?: boolean;
  /** Without `autoPopinMode`: below `minScreenWidth` the column goes into the pop-in instead of being hidden. @defaultValue false */
  demandPopin?: boolean;
  /** Without `autoPopinMode`: a sap.m.ScreenSize ("Phone", "Tablet", "Desktop", …) or a CSS width below which the column is hidden or popped in. */
  minScreenWidth?: string;
  /** How the pop-in shows header and value. @defaultValue "Block" */
  popinDisplay?: PopinDisplay;
  /** Footer of the column (sap.m.Column aggregation `footer`). */
  footer?: ReactNode;
  /** Text of the grouping header (value of the group property; smart-kit addition). */
  groupValue?(row: Row): string;
}

export interface Table$SelectionChangeEvent {
  /** The row whose selection changed (the first one when several changed). */
  listItem: Row | undefined;
  /** The rows whose selection changed. */
  listItems: Row[];
  /** Whether they were selected (true) or deselected (false). */
  selected: boolean;
  /** The change came from the "select all" checkbox. */
  selectAll: boolean;
}
export interface Table$ItemPressEvent {
  listItem: Row;
  /** The element that was clicked. */
  srcControl: HTMLElement;
}
export interface Table$DeleteEvent {
  listItem: Row;
}
export interface Table$UpdateStartedEvent {
  /** "Growing" when more items are requested, "Change" otherwise. */
  reason: string;
  /** Number of items shown. */
  actual: number;
  /** Total number of items, when known. */
  total: number | undefined;
}
export type Table$UpdateFinishedEvent = Table$UpdateStartedEvent;
export interface Table$PopinChangedEvent {
  hasPopin: boolean;
  /** Columns shown in the pop-in area. */
  visibleInPopin: $ColumnSettings[];
  /** Columns moved out of the table whose pop-in is hidden (`hiddenInPopin`). */
  hiddenInPopin: $ColumnSettings[];
}

export interface Table$PasteEvent {
  /** Pasted text as rows of cells (tab-separated columns, one line per row). */
  data: string[][];
  /** Stops the browser's default paste handling. */
  preventDefault(): void;
}

export interface Table$BeforeOpenContextMenuEvent {
  /** The row in which the context menu was opened. */
  listItem: Row;
  /** The column in which the context menu was opened (undefined outside the columns, e.g. the selection cell). */
  column: $ColumnSettings | undefined;
  /** Keeps the context menu closed (the browser's own menu opens). */
  preventDefault(): void;
}
export interface Table$SwipeEvent {
  /** The swiped row. */
  listItem: Row;
  /** The `swipeContent` shown at the end of the row. */
  swipeContent: ReactNode;
  /** The element the swipe started on. */
  srcControl: HTMLElement;
  /** "BeginToEnd" or "EndToBegin" (left to right / right to left in left-to-right languages). */
  swipeDirection: 'BeginToEnd' | 'EndToBegin';
  /** Cancels the swipe (the swipe content is not shown). */
  preventDefault(): void;
}
export interface Table$ItemActionPressEvent {
  /** The pressed action. */
  action: $ListItemActionSettings;
  /** The row of the action. */
  listItem: Row;
}

export interface GroupSummary {
  count?: number;
  cells: Record<string, ReactNode>;
}

export interface $TableSettings {
  /** Accessible name of the table when there is no `headerText`. */
  'aria-label'?: string;
  /** Columns (sap.m.Column). */
  columns: $ColumnSettings[];
  /** The rows (React form of the items binding: data, rendered with the columns' `cell`). */
  items: Row[];
  /** Key of a row (React key, selection and events). */
  keyOf(row: Row): string;
  /** Title shown above the table. */
  headerText?: string;
  /** Heading level of `headerText` ("Auto" = H2). @defaultValue "Auto" */
  headerLevel?: TitleLevel;
  /** Text shown below the table. */
  footerText?: string;
  /** Toolbar above the column headers. */
  headerToolbar?: ReactNode;
  /** Info bar below the header toolbar. */
  infoToolbar?: ReactNode;
  /** Selection mode: "MultiSelect" check boxes, "SingleSelectLeft" radio buttons, "SingleSelectMaster" the row, "Delete" a delete button per row. @defaultValue "None" */
  mode?: ListMode;
  /** Selected row keys (controlled; smart-kit addition). Without it the table keeps the selection itself. */
  selectedKeys?: string[];
  /** A click on the row toggles its selection (selection modes). @defaultValue false */
  includeItemInSelection?: boolean;
  /** Keeps the selection when the items change (uncontrolled selection). @defaultValue true */
  rememberSelections?: boolean;
  /** "ClearAll" shows a "clear selection" button instead of the "select all" check box. @defaultValue "Default" */
  multiSelectMode?: MultiSelectMode;
  /** @defaultValue "100%" */
  width?: string;
  /** `table-layout: fixed`; false: column widths follow the content. @defaultValue true */
  fixedLayout?: boolean | 'Strict';
  /** Greys out the table (e.g. filters changed but not applied). @defaultValue false */
  showOverlay?: boolean;
  /** Background: "Solid", "Translucent" (the page shows through the theme's table colors) or "Transparent". @defaultValue "Translucent" */
  backgroundDesign?: 'Solid' | 'Translucent' | 'Transparent';
  /** Every other row with a background. @defaultValue false */
  alternateRowColors?: boolean;
  /** Row separators: "All", "Inner" (not after the last row) or "None". @defaultValue "All" */
  showSeparators?: ListSeparators;
  /** Space around the table. @defaultValue false */
  inset?: boolean;
  /** Arrangement of the pop-in: "Block" (one below the other) or "GridSmall" / "GridLarge" (a grid of small or large cells). @defaultValue "Block" */
  popinLayout?: PopinLayout;
  /** Text when there are no items; default "No items available.". */
  noDataText?: string;
  /** Content when there are no items (replaces `noDataText`). */
  noData?: ReactNode;
  /** @defaultValue true */
  showNoData?: boolean;
  /** Shows the busy indicator (rows are loading). */
  busy?: boolean;
  /** @defaultValue true */
  enableBusyIndicator?: boolean;
  /** Shows the items in pages: a "More" button or scrolling loads the next one. @defaultValue false */
  growing?: boolean;
  /** Items per page when the table grows over `items` itself (no `hasMore`). @defaultValue 20 */
  growingThreshold?: number;
  /** Text of the "More" button (default "More"). */
  growingTriggerText?: string;
  /** Load the next page when the end of the table scrolls into view instead of a button. @defaultValue false */
  growingScrollToLoad?: boolean;
  /** "Upwards": the "More" button (or scroll to load) is at the top and the items are shown in reverse order, the first one at the bottom (chat-like lists). @defaultValue "Downwards" */
  growingDirection?: ListGrowingDirection;
  /** More items can be loaded by the parent (`onUpdateStarted` with reason "Growing" asks for them; smart-kit addition). */
  hasMore?: boolean;
  /** "Navigation": arrow keys move between the cells; "Edit": Tab moves between the input fields of the cells, arrow up / down moves to the same field of the previous / next row. @defaultValue "Navigation" */
  keyboardMode?: ListKeyboardMode;
  /** Shows the unread indicator (bold rows) of the rows that `rowUnread` marks. @defaultValue false */
  showUnread?: boolean;
  /** Whether a row is unread (sap.m.ListItemBase `unread` of the row; shown with `showUnread`). */
  rowUnread?(row: Row): boolean;
  /** The selection controls animate in when `mode` changes. @defaultValue true */
  modeAnimationOn?: boolean;
  /** Maximum number of row actions (`rowActions`) shown in a column at the end; more go into an overflow menu. 0–2 enable the actions (mode "Delete" then has no effect); -1 does not show them. @defaultValue -1 */
  itemActionCount?: number;
  /** Actions of a row (sap.m.ListItemBase aggregation `actions` of the row). */
  rowActions?(row: Row): $ListItemActionSettings[];
  /** Content shown at the end of a row after a touch swipe (e.g. a button); hidden again by a tap elsewhere in the table or `swipeOut`. */
  swipeContent?: ReactNode;
  /** Swipe direction that shows `swipeContent`. @defaultValue "Both" */
  swipeDirection?: SwipeDirection;
  /** Context menu of the rows (opened by right-click or Shift+F10 / the menu key on a row); a function gets the row (the binding context UI5 sets on the menu). */
  contextMenu?: ReactNode | ((listItem: Row) => ReactNode);
  /** Moves columns into the pop-in by `importance` as the width shrinks. @defaultValue false */
  autoPopinMode?: boolean;
  /** Importances whose popped-in columns are not shown in the pop-in area ("Show Details" off). */
  hiddenInPopin?: Priority[];
  /** Width used for the pop-in: "Inherit" (the table's), "Desktop", "Tablet", "Phone" or a CSS width. @defaultValue "Inherit" */
  contextualWidth?: string;
  /** Parts that stay visible when the page scrolls; "ColumnHeaders" keeps the column headers. */
  sticky?: Sticky[];
  /** Rows can navigate: a chevron and `onItemPress` on click and Enter (type "Navigation" of the items; smart-kit addition). */
  navigable?: boolean;
  /** Column id to group by (React form of a grouping sorter; smart-kit addition). */
  groupBy?: string;
  /** Subtotals of the group starting with `row`: row count and cells by column id (docs/23). */
  groupSummary?(row: Row): GroupSummary | undefined;
  /** Totals row after the last row: cells by column id (docs/23). */
  totals?: { label: ReactNode; cells: Record<string, ReactNode> };
  /** Tree rows (docs/26 §3.10): indentation and toggle in the first column. */
  tree?: { nodeOf(row: Row): HierarchyNode | undefined; toggle(row: Row): void };
  /** Actions in a column at the end of each row. */
  inlineActions?(row: Row): ReactNode;
  /** Keys of rows marked as changed (continuous working mode). */
  changedKeys?: Set<string>;
  /** Highlight of a row (sap.m.ListItemBase highlight: "error", "warning", "success", "information"; smart-kit internal). */
  rowHighlight?(row: Row): string | undefined;
  /** Content after the first cell (e.g. draft markers). */
  rowMarker?(row: Row): ReactNode;
  onSelectionChange?(e: Table$SelectionChangeEvent): void;
  onItemPress?(e: Table$ItemPressEvent): void;
  /** A row's delete button was pressed (mode "Delete"). */
  onDelete?(e: Table$DeleteEvent): void;
  /** More items are needed (reason "Growing"). */
  onUpdateStarted?(e: Table$UpdateStartedEvent): void;
  /** The items changed. */
  onUpdateFinished?(e: Table$UpdateFinishedEvent): void;
  /** The set of columns in the pop-in changed. */
  onPopinChanged?(e: Table$PopinChangedEvent): void;
  /** Text was pasted into the table (e.g. from a spreadsheet). */
  onPaste?(e: Table$PasteEvent): void;
  /** The context menu of a row is about to open (`preventDefault` keeps it closed). */
  onBeforeOpenContextMenu?(e: Table$BeforeOpenContextMenuEvent): void;
  /** A row was swiped, before `swipeContent` is shown (`preventDefault` cancels). */
  onSwipe?(e: Table$SwipeEvent): void;
  /** A row action (`rowActions`) was pressed. */
  onItemActionPress?(e: Table$ItemActionPressEvent): void;
  /** Instance methods (sap.m.Table / sap.m.ListBase). */
  ref?: Ref<Table>;
}

/** Instance methods of sap.m.Table (through `ref`). Rows stand for the list items. */
export interface Table {
  /** Shown and total number of items while growing; null without growing. */
  getGrowingInfo(): { actual: number; total: number | undefined } | null;
  getSelectedItem(): Row | null;
  getSelectedItems(): Row[];
  /** Selects or deselects a row; with controlled `selectedKeys` the event always fires (the parent owns the state). */
  setSelectedItem(listItem: Row, select?: boolean, fireEvent?: boolean): void;
  removeSelections(all?: boolean, fireEvent?: boolean): void;
  selectAll(fireEvent?: boolean): void;
  /** Loads the next page (growing). */
  requestItems(items?: number): void;
  scrollToIndex(index: number): Promise<void>;
  /** The row whose `swipeContent` is shown, null when none is. */
  getSwipedItem(): Row | null;
  /** Hides the shown `swipeContent`; `callback` gets the swiped row and the swipe content. */
  swipeOut(callback?: (swipedListItem: Row, swipedContent: ReactNode) => void): Table;
}

/** Widths below which Low, then Medium columns move out of the table (sap.m.Table pop-in by importance). */
export function hiddenByImportance(width: number, importance: Priority | undefined): boolean {
  if (importance === 'High') return false;
  if (importance === 'Low') return width < 1024;
  return width < 600;
}

/** sap.m.ScreenSize in px. */
const SCREEN: Record<string, number> = { Phone: 240, Tablet: 600, Desktop: 1024, XXSmall: 240, XSmall: 320, Small: 480, Medium: 560, Large: 768, XLarge: 960, XXLarge: 1120 };
function pxOf(v: string | undefined): number | undefined {
  if (!v) return undefined;
  if (v in SCREEN) return SCREEN[v];
  const m = /^(\d+(?:\.\d+)?)(px|em|rem)?$/.exec(v.trim());
  if (!m) return undefined;
  return Number(m[1]) * (m[2] === 'em' || m[2] === 'rem' ? 16 : 1);
}

/** Input fields handle their own arrow keys (text cursor, options). */
const EDITABLE = 'input:not([type="checkbox"]):not([type="radio"]), textarea, select, [contenteditable="true"], [role="combobox"]';
/** Tabbable elements inside a row (sap.m.ListItemBase getTabbables), without the cells of the grid navigation. */
const TABBABLE = 'input, select, textarea, button, a[href], [tabindex]:not([tabindex="-1"])';
const tabbablesOf = (el: Element | null | undefined) =>
  [...(el?.querySelectorAll<HTMLElement>(TABBABLE) ?? [])].filter((x) => !x.hasAttribute('data-sk-cell') && !(x as HTMLInputElement).disabled);

/** The element that scrolls the table (the page when no ancestor scrolls). */
function scrollParent(el: HTMLElement | null): HTMLElement {
  for (let n = el?.parentElement; n; n = n.parentElement) {
    const o = getComputedStyle(n).overflowY;
    if ((o === 'auto' || o === 'scroll') && n.scrollHeight > n.clientHeight) return n;
  }
  return (document.scrollingElement as HTMLElement | null) ?? document.documentElement;
}

/** sap.m.ListBase _getItemActionCount: -1 (no actions) up to 2. */
const actionCountOf = (n: number | undefined) => Math.min(2, Math.max(-1, Math.trunc(n ?? -1)));

export function Table(p: $TableSettings) {
  const t = useText();
  const boxRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState(1440);
  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setMeasured(el.clientWidth));
    ro.observe(el);
    setMeasured(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const width = p.contextualWidth && p.contextualWidth !== 'Inherit' ? pxOf(p.contextualWidth) ?? measured : measured;
  const mode = p.mode ?? 'None';
  const multi = mode === 'MultiSelect';
  const single = mode === 'SingleSelectLeft' || mode === 'SingleSelectMaster';
  const selectColumn = multi || mode === 'SingleSelectLeft';

  // Pop-in (sap.m.Table): the first column always stays (it identifies the row).
  const columns = p.columns.filter((c) => c.visible !== false);
  const outOfTable = (c: $ColumnSettings, i: number): 'popin' | 'hidden' | false => {
    if (i === 0) return false;
    if (p.autoPopinMode) return hiddenByImportance(width, c.importance) ? 'popin' : false;
    const min = pxOf(c.minScreenWidth);
    if (min === undefined || width >= min) return false;
    return c.demandPopin ? 'popin' : 'hidden';
  };
  const placement = columns.map((c, i) => outOfTable(c, i));
  const visible = columns.filter((_, i) => !placement[i]);
  const popped = columns.filter((_, i) => placement[i] === 'popin');
  const hiddenPriorities = p.hiddenInPopin ?? [];
  const inPopin = popped.filter((c) => !hiddenPriorities.includes(c.importance ?? 'None'));
  const notInPopin = popped.filter((c) => hiddenPriorities.includes(c.importance ?? 'None'));
  const popinKey = `${inPopin.map((c) => c.id).join('|')}#${notInPopin.map((c) => c.id).join('|')}`;
  const latest = useRef(p);
  latest.current = p;
  const popinRef = useRef({ inPopin, notInPopin });
  popinRef.current = { inPopin, notInPopin };
  useEffect(() => {
    const { inPopin: a, notInPopin: b } = popinRef.current;
    latest.current.onPopinChanged?.({ hasPopin: a.length > 0, visibleInPopin: a, hiddenInPopin: b });
  }, [popinKey]);

  // Selection: controlled by `selectedKeys` or kept here.
  const [ownKeys, setOwnKeys] = useState<string[]>([]);
  const selectedKeys = new Set(p.selectedKeys ?? ownKeys);
  const itemsKey = p.items.map(p.keyOf).join('|');
  useEffect(() => {
    if (p.selectedKeys || p.rememberSelections !== false) return;
    setOwnKeys([]);
  }, [itemsKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const change = (rows: Row[], selected: boolean, selectAll: boolean, fire = true) => {
    const keys = new Set(single && selected ? [] : selectedKeys);
    for (const r of rows) { if (selected) keys.add(p.keyOf(r)); else keys.delete(p.keyOf(r)); }
    if (!p.selectedKeys) setOwnKeys([...keys]);
    if (fire || p.selectedKeys) p.onSelectionChange?.({ listItem: rows[0], listItems: rows, selected, selectAll });
  };
  const toggle = (row: Row) => change([row], !selectedKeys.has(p.keyOf(row)), false);

  // Growing: over `items` itself, or the parent loads more (`hasMore`).
  const external = p.hasMore !== undefined;
  const threshold = p.growingThreshold ?? 20;
  const [shown, setShown] = useState(threshold);
  const rows = p.growing && !external ? p.items.slice(0, shown) : p.items;
  const canGrow = Boolean(p.growing) && (external ? Boolean(p.hasMore) : shown < p.items.length);
  const total = external ? undefined : p.items.length;
  // growingDirection "Upwards" (sap.m.ListBaseRenderer): the trigger is at the top and the items are rendered in
  // reverse order; loading more keeps the scroll position (GrowingEnablement onScrollToLoad).
  const upwards = Boolean(p.growing) && p.growingDirection === 'Upwards';
  const displayRows = upwards ? [...rows].reverse() : rows;
  const keepScroll = useRef<{ el: HTMLElement; fromBottom: number } | null>(null);
  const grow = (n?: number) => {
    const l = latest.current;
    if (!l.growing) return;
    if (l.hasMore !== undefined && (!l.hasMore || l.busy)) return;
    if (l.growingDirection === 'Upwards') {
      const el = scrollParent(boxRef.current);
      keepScroll.current = { el, fromBottom: el.scrollHeight - el.scrollTop };
    }
    if (l.hasMore !== undefined) {
      l.onUpdateStarted?.({ reason: 'Growing', actual: l.items.length, total: undefined });
    } else {
      l.onUpdateStarted?.({ reason: 'Growing', actual: Math.min(shown, l.items.length), total: l.items.length });
      setShown((s) => s + (n ?? threshold));
    }
  };
  const growRef = useRef(grow);
  growRef.current = grow;
  const firstUpdate = useRef(true);
  const actual = rows.length;
  useEffect(() => {
    if (firstUpdate.current) { firstUpdate.current = false; return; }
    latest.current.onUpdateFinished?.({ reason: latest.current.growing ? 'Growing' : 'Change', actual, total });
  }, [actual, total]);

  // Scroll to load: the sentinel after the last row (before the first one when growing upwards) starts the next page.
  const scrollToLoad = Boolean(p.growing && p.growingScrollToLoad);
  const scrolledToEnd = useRef(false);
  useLayoutEffect(() => {
    const keep = keepScroll.current;
    if (keep) {
      keepScroll.current = null;
      keep.el.scrollTop = keep.el.scrollHeight - keep.fromBottom;
    } else if (upwards && scrollToLoad && actual > 0 && !scrolledToEnd.current) {
      // at the beginning the list scrolls to the last item (GrowingEnablement)
      scrolledToEnd.current = true;
      const el = scrollParent(boxRef.current);
      el.scrollTop = el.scrollHeight;
    }
  }, [actual, upwards, scrollToLoad]);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !scrollToLoad || typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver(([e]) => { if (e!.isIntersecting) growRef.current(); }, { rootMargin: upwards ? '200px 0px 0px 0px' : '0px 0px 200px 0px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, [scrollToLoad, upwards]);
  useEffect(() => {
    // Rows may not fill the viewport yet: keep loading while the sentinel is visible.
    const el = sentinelRef.current;
    if (!el || !scrollToLoad || upwards || !canGrow || p.busy) return;
    if (el.getBoundingClientRect().top < window.innerHeight + 200) growRef.current();
  });

  // Mode animation (sap.m.ListItemBaseRenderer decorateMode): once the mode changed, the selection controls animate in.
  const prevMode = useRef(mode);
  const [modeChanged, setModeChanged] = useState(false);
  useLayoutEffect(() => {
    if (prevMode.current !== mode) setModeChanged(true);
    prevMode.current = mode;
  }, [mode]);
  const modeAnim = modeChanged && p.modeAnimationOn !== false;

  // Item actions (sap.m.ListItemBase actions, sap.m.ListBase itemActionCount).
  const actionCount = actionCountOf(p.itemActionCount);
  const actionsOf = (row: Row) => p.rowActions?.(row) ?? [];
  const navAction = (row: Row) => actionsOf(row).some((a) => a.type === 'Navigation' && a.visible !== false);
  const rowNavigable = (row: Row) => Boolean(p.navigable) || navAction(row);
  const navColumn = Boolean(p.navigable) || (Boolean(p.rowActions) && rows.some(navAction));
  const actionsColumn = actionCount > 0 && Boolean(p.rowActions);
  const pressAction = (row: Row, action: $ListItemActionSettings) => p.onItemActionPress?.({ action, listItem: row });
  const actionInfo = (a: $ListItemActionSettings): { icon: ReactNode; text: string } =>
    a.type === 'Edit' ? { icon: <Pencil className="sk-icon" />, text: t('actions.edit') }
      : a.type === 'Delete' ? { icon: <X className="sk-icon" />, text: t('actions.delete') }
        : { icon: a.icon, text: a.text ?? '' };
  /** ListItemBase _getActionsToRender / _getOverflowActions. */
  const splitActions = (row: Row) => {
    const effective = actionsOf(row).filter((a) => a.type !== 'Navigation');
    const shownActions = effective.filter((a) => a.visible !== false);
    if (effective.length <= actionCount) return { render: effective, overflow: [] as $ListItemActionSettings[] };
    const render = shownActions.slice(0, shownActions.length > actionCount ? actionCount - 1 : actionCount);
    return { render, overflow: shownActions.filter((a) => !render.includes(a)) };
  };
  const actionKey = (a: $ListItemActionSettings, i: number) => a.key ?? `${a.type ?? 'Custom'}:${a.text ?? ''}:${i}`;
  const typedAction = (row: Row, type: ListItemActionType) => actionsOf(row).find((a) => a.type === type && a.visible !== false);

  // Context menu (sap.m.ListBase onItemContextMenu): beforeOpenContextMenu, then the menu opens at the pointer.
  const [menu, setMenu] = useState<{ row: Row; x: number; y: number } | null>(null);
  const openContextMenu = (row: Row, e: MouseEvent<HTMLTableRowElement>) => {
    if (!p.contextMenu) return;
    const target = e.target as HTMLElement;
    if (target.closest(EDITABLE)) return; // an input field keeps the browser's menu
    const td = target.closest<HTMLElement>('td[data-col]');
    let prevented = false;
    p.onBeforeOpenContextMenu?.({ listItem: row, column: td ? columns.find((c) => c.id === td.dataset.col) : undefined, preventDefault: () => { prevented = true; } });
    if (prevented) return;
    e.preventDefault();
    let { clientX: x, clientY: y } = e;
    if (!x && !y) { const r = target.getBoundingClientRect(); x = r.left; y = r.bottom; } // opened by the keyboard
    setMenu({ row, x, y });
  };

  // Swipe (sap.m.ListBase onswipeleft / onswiperight, touch only): swipeContent at the end of the swiped row.
  const [swiped, setSwiped] = useState<{ row: Row; top: number; height: number } | null>(null);
  const swipedRef = useRef(swiped);
  swipedRef.current = swiped;
  const swipeBoxRef = useRef<HTMLDivElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const swipedAt = useRef(0);
  const swipe = (row: Row, left: boolean, tr: HTMLElement, src: HTMLElement) => {
    if (p.swipeContent === undefined || p.swipeContent === null || swiped) return;
    const rtl = boxRef.current ? getComputedStyle(boxRef.current).direction === 'rtl' : false;
    const dir = p.swipeDirection ?? 'Both';
    const except = left === rtl ? 'EndToBegin' : 'BeginToEnd';
    if (dir === except) return;
    const swipeDirection = dir === 'Both' ? (left === rtl ? 'BeginToEnd' : 'EndToBegin') : dir;
    let prevented = false;
    p.onSwipe?.({ listItem: row, swipeContent: p.swipeContent, srcControl: src, swipeDirection, preventDefault: () => { prevented = true; } });
    if (prevented) return;
    const box = boxRef.current!.getBoundingClientRect();
    const r = tr.getBoundingClientRect();
    swipedAt.current = Date.now();
    setSwiped({ row, top: r.top - box.top, height: r.height });
  };
  const onTouchStart = (e: TouchEvent<HTMLTableRowElement>) => {
    const tp = e.touches[0];
    touch.current = tp && e.touches.length === 1 ? { x: tp.clientX, y: tp.clientY } : null;
  };
  const onTouchEnd = (row: Row, e: TouchEvent<HTMLTableRowElement>) => {
    const start = touch.current;
    const tp = e.changedTouches[0];
    touch.current = null;
    if (!start || !tp) return;
    const dx = tp.clientX - start.x;
    const dy = tp.clientY - start.y;
    if (Math.abs(dx) >= 40 && Math.abs(dx) > 2 * Math.abs(dy)) swipe(row, dx < 0, e.currentTarget, e.target as HTMLElement);
  };
  useEffect(() => { if (swiped) swipeBoxRef.current?.focus(); }, [swiped]);

  const tableRef = useRef<HTMLTableElement>(null);
  useImperativeHandle(p.ref, (): Table => {
    const api: Table = {
      getGrowingInfo: () => (latest.current.growing ? { actual: rows.length, total } : null),
      getSelectedItem: () => latest.current.items.find((r) => selectedKeys.has(latest.current.keyOf(r))) ?? null,
      getSelectedItems: () => latest.current.items.filter((r) => selectedKeys.has(latest.current.keyOf(r))),
      setSelectedItem: (row, select = true, fireEvent = false) => change([row], select, false, fireEvent),
      removeSelections: (_all, fireEvent = false) => change(latest.current.items.filter((r) => selectedKeys.has(latest.current.keyOf(r))), false, false, fireEvent),
      selectAll: (fireEvent = false) => change(rows, true, true, fireEvent),
      requestItems: (n) => growRef.current(n),
      scrollToIndex: async (index) => {
        // the index counts the items (data order), also when they are rendered upwards
        const row = rows[index < 0 ? rows.length - 1 : index];
        const key = row ? latest.current.keyOf(row) : undefined;
        const tr = [...(tableRef.current?.querySelectorAll<HTMLTableRowElement>('tr[data-sk-row]') ?? [])].find((x) => x.dataset.skRow === key);
        tr?.scrollIntoView?.({ block: 'nearest' });
      },
      getSwipedItem: () => swipedRef.current?.row ?? null,
      swipeOut: (callback) => {
        const current = swipedRef.current;
        if (!current) return api;
        swipedRef.current = null;
        setSwiped(null);
        callback?.(current.row, latest.current.swipeContent);
        return api;
      },
    };
    return api;
  });
  const swipeOut = () => { if (swipedRef.current) setSwiped(null); };
  const outsideSwipe = (e: { target: EventTarget }) => {
    // the events that end the swipe gesture itself do not count
    if (Date.now() - swipedAt.current > 300 && !swipeBoxRef.current?.contains(e.target as Node)) swipeOut();
  };

  const allSelected = rows.length > 0 && rows.every((r) => selectedKeys.has(p.keyOf(r)));
  // with item actions (itemActionCount 0–2) the Delete mode has no effect; a Delete action is used instead
  const deleteColumn = mode === 'Delete' && actionCount === -1;
  const span = visible.length + (selectColumn ? 1 : 0) + (p.inlineActions ? 1 : 0) + (actionsColumn ? 1 : 0) + (navColumn ? 1 : 0) + (deleteColumn ? 1 : 0);
  const sticky = p.sticky?.includes('ColumnHeaders');
  const headStyle = sticky ? undefined : { position: 'static' as const };
  const alignEnd = (c: $ColumnSettings) => c.hAlign === 'End' || c.hAlign === 'Right';

  /**
   * A group header or totals row: the label spans the columns before the first column with a value; values sit in
   * their columns. Values of columns that are not in the table on this width follow the label.
   */
  const summaryCells = (label: ReactNode, cells: Record<string, ReactNode> | undefined, scope: 'rowgroup' | 'row') => {
    const ids = Object.keys(cells ?? {});
    const first = visible.findIndex((c) => ids.includes(c.id));
    if (!cells || !ids.length) return <th colSpan={span} scope={scope}>{label}</th>;
    const lead = Math.max(1, first < 0 ? visible.length : first);
    const extra = columns.filter((c) => ids.includes(c.id) && !visible.slice(lead).includes(c));
    return (
      <>
        <th colSpan={lead + (selectColumn ? 1 : 0)} scope={scope}>
          {label}
          {extra.map((c) => <span key={c.id} className="sk-rtable__summary-extra" data-sk-summary-extra={c.id}>{c.header}: {cells[c.id]}</span>)}
        </th>
        {visible.slice(lead).map((c) => <td key={c.id} data-col={c.id} className={alignEnd(c) ? 'sk-rtable__end' : undefined}>{cells[c.id] ?? null}</td>)}
        {p.inlineActions ? <td /> : null}
        {actionsColumn ? <td /> : null}
        {navColumn ? <td /> : null}
        {deleteColumn ? <td /> : null}
      </>
    );
  };

  const press = (row: Row, src: HTMLElement) => {
    if (mode === 'SingleSelectMaster' || (p.includeItemInSelection && (multi || single))) toggle(row);
    if (rowNavigable(row) || mode === 'SingleSelectMaster') p.onItemPress?.({ listItem: row, srcControl: src });
  };
  const rowOf = (tr: HTMLElement) => (tr.dataset.skRow === undefined ? undefined : p.items.find((r) => p.keyOf(r) === tr.dataset.skRow));

  // Grid keyboard navigation (arrow keys between cells, Enter presses the row, Space selects). keyboardMode "Edit"
  // (sap.m.ListBase onItemArrowUpDown): arrow up / down in an input field moves to the same field of the next row.
  const onKeyDown = (e: KeyboardEvent<HTMLTableElement>) => {
    const target = e.target as HTMLElement;
    const cell = target.closest<HTMLElement>('[data-sk-cell]');
    if (!cell) return;
    const tr = cell.parentElement as HTMLTableRowElement;
    if (target !== cell && target.closest(EDITABLE)) {
      if (p.keyboardMode === 'Edit' && (e.key === 'ArrowUp' || e.key === 'ArrowDown') && tr.dataset.skRow !== undefined && !(target instanceof HTMLTextAreaElement)) {
        const dataRows = [...(tableRef.current?.querySelectorAll<HTMLTableRowElement>('tr[data-sk-row]') ?? [])];
        const nextRow = dataRows[dataRows.indexOf(tr) + (e.key === 'ArrowUp' ? -1 : 1)];
        if (!nextRow) return;
        const own = tabbablesOf(tr);
        const theirs = tabbablesOf(nextRow);
        const el = theirs[own.indexOf(target)] ?? theirs[theirs.length - 1] ?? nextRow.querySelector<HTMLElement>('[data-sk-cell]');
        e.preventDefault();
        el?.focus();
        if (el instanceof HTMLInputElement) el.select();
        return;
      }
      // the text cursor moves inside the field; in Edit mode the field keeps all arrow keys
      if (p.keyboardMode === 'Edit' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') return;
    }
    const cells = [...tr.querySelectorAll<HTMLElement>('[data-sk-cell]')];
    const i = cells.indexOf(cell);
    const trs = [...(tr.closest('table')?.querySelectorAll<HTMLTableRowElement>('tr[data-sk-row], thead tr') ?? [])];
    const ri = trs.indexOf(tr);
    let next: HTMLElement | undefined;
    const row = target === cell ? rowOf(tr) : undefined;
    if (e.key === 'ArrowRight') next = cells[i + 1];
    else if (e.key === 'ArrowLeft') next = cells[i - 1];
    else if (e.key === 'ArrowDown') next = trs[ri + 1]?.querySelectorAll<HTMLElement>('[data-sk-cell]')[i];
    else if (e.key === 'ArrowUp') next = trs[ri - 1]?.querySelectorAll<HTMLElement>('[data-sk-cell]')[i];
    else if (e.key === 'Enter' && row && rowNavigable(row)) {
      p.onItemPress?.({ listItem: row, srcControl: cell });
    } else if (e.key === ' ' && row && mode !== 'None' && mode !== 'Delete') {
      toggle(row); e.preventDefault();
    } else if (e.key === 'Delete' && row && (deleteColumn || actionCount >= 0)) {
      // ListItemBase onsapdelete: the Delete mode, or the Delete action when item actions are on
      if (deleteColumn) p.onDelete?.({ listItem: row });
      else if (actionCount >= 0) { const a = typedAction(row, 'Delete'); if (a) pressAction(row, a); }
      e.preventDefault();
    } else if (e.code === 'KeyE' && (e.metaKey || e.ctrlKey) && row && actionCount >= 0) {
      // ListItemBase onkeydown: Ctrl+E presses the Edit action
      const a = typedAction(row, 'Edit');
      if (a) pressAction(row, a);
      e.preventDefault();
    }
    if (next) {
      e.preventDefault();
      cell.tabIndex = -1;
      next.tabIndex = 0;
      next.focus();
    }
  };
  // keyboardMode "Edit" (ListBase focusPrevious): tabbing into the table focuses its first input field.
  const onFocus = (e: FocusEvent<HTMLTableElement>) => {
    if (p.keyboardMode !== 'Edit') return;
    const target = e.target as HTMLElement;
    if (!target.hasAttribute('data-sk-cell') || (e.relatedTarget && tableRef.current?.contains(e.relatedTarget as Node))) return;
    tabbablesOf(tableRef.current?.tBodies[0])[0]?.focus();
  };

  const level = p.headerLevel && p.headerLevel !== 'Auto' ? Number(p.headerLevel.slice(1)) : 2;
  const Heading = `h${level}` as 'h2';
  let lastGroup: string | undefined;
  // the group column may be invisible (a grouping sorter does not depend on the column being shown)
  const groupCol = p.groupBy ? p.columns.find((c) => c.id === p.groupBy) : undefined;
  const showBusy = p.busy && p.enableBusyIndicator !== false;
  const layout = p.fixedLayout === false ? 'auto' : 'fixed';
  const background = p.backgroundDesign === 'Solid' ? 'var(--sk-color-surface)' : p.backgroundDesign === 'Transparent' ? 'transparent' : undefined;
  const separators = p.showSeparators ?? 'All';
  const cellStyle = (index: number) => {
    const style: { borderBottom?: string; background?: string } = {};
    if (separators === 'None' || (separators === 'Inner' && index === rows.length - 1)) style.borderBottom = 'none';
    if (p.alternateRowColors && index % 2 === 1) style.background = 'var(--sk-color-surface-2)';
    return style.borderBottom || style.background ? style : undefined;
  };
  const popinStyle = p.popinLayout === 'GridSmall' || p.popinLayout === 'GridLarge'
    ? { display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(calc(var(--sk-size-popin-label) * ${p.popinLayout === 'GridLarge' ? 4 : 2}), 1fr))` }
    : undefined;
  const growingTrigger = p.growing && canGrow && !p.growingScrollToLoad ? (
    <Button variant="subtle" fullWidth className="sk-table__more" loading={p.busy} onClick={() => grow()} data-sk-more>
      {p.growingTriggerText ?? (total !== undefined ? t('table.moreCount', { loaded: rows.length, count: total }) : t('table.more'))}
    </Button>
  ) : null;
  const sentinel = <div ref={sentinelRef} className="sk-rtable__sentinel" aria-hidden />;
  const actionsWidth = `${actionCount * 2.75}rem`;
  const actionCell = (row: Row, index: number) => {
    const { render, overflow } = splitActions(row);
    return (
      <td data-sk-cell tabIndex={-1} className="sk-rtable__item-actions" data-sk-no-nav data-sk-item-actions style={cellStyle(index)}>
        {render.map((a, i) => {
          if (a.visible === false) return <span key={actionKey(a, i)} className="sk-rtable__item-action-hidden" aria-hidden />;
          const info = actionInfo(a);
          return (
            <ActionIcon key={actionKey(a, i)} size="sm" variant="subtle" aria-label={info.text} title={info.text} data-sk-item-action={a.type ?? 'Custom'} onClick={() => pressAction(row, a)}>
              {info.icon}
            </ActionIcon>
          );
        })}
        {overflow.length ? (
          <Menu position="bottom-end" withinPortal>
            <Menu.Target>
              <ActionIcon size="sm" variant="subtle" aria-label={t('table.itemActionMore')} title={t('table.itemActionMore')} aria-haspopup="menu" data-sk-item-action-overflow>
                <MoreHorizontal className="sk-icon" />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              {overflow.map((a, i) => { const info = actionInfo(a); return <Menu.Item key={actionKey(a, i)} leftSection={info.icon} onClick={() => pressAction(row, a)} data-sk-item-action={a.type ?? 'Custom'}>{info.text}</Menu.Item>; })}
            </Menu.Dropdown>
          </Menu>
        ) : null}
      </td>
    );
  };
  return (
    <div
      className="sk-rtable" ref={boxRef} data-sk-responsive-table data-width={width} data-mode={mode} data-sk-mode-anim={modeAnim || undefined}
      style={{ width: p.width, background, padding: p.inset ? 'var(--sk-space-4)' : undefined }} aria-busy={p.busy || undefined}
      // a tap in the table outside the swipe content hides it (ListBase _swipeIn)
      onTouchEnd={swiped ? outsideSwipe : undefined}
      onMouseUp={swiped ? outsideSwipe : undefined}
    >
      {p.headerText ? <Heading className="sk-rtable__header" data-sk-rtable-header>{p.headerText}</Heading> : null}
      {p.headerToolbar}
      {p.infoToolbar}
      {upwards ? growingTrigger : null}
      {upwards ? sentinel : null}
      <table ref={tableRef} role={p.tree ? 'treegrid' : 'grid'} aria-label={p.headerText ?? p['aria-label']} aria-rowcount={rows.length} onKeyDown={onKeyDown} onFocus={onFocus} onPaste={p.onPaste ? (e) => {
        const text = e.clipboardData.getData('text/plain');
        if (!text) return;
        p.onPaste!({ data: text.replace(/\r\n?/g, '\n').replace(/\n$/, '').split('\n').map((line) => line.split('\t')), preventDefault: () => e.preventDefault() });
      } : undefined} className="sk-rtable__table" style={{ tableLayout: layout, pointerEvents: swiped ? 'none' : undefined }}>
        <thead>
          <tr>
            {selectColumn ? (
              <th className="sk-rtable__select" data-sk-cell tabIndex={-1} style={headStyle}>
                {multi && p.multiSelectMode === 'ClearAll' ? (
                  <ActionIcon size="sm" variant="subtle" disabled={!selectedKeys.size} aria-label={t('common.clear')} title={t('common.clear')} data-sk-clear-selection
                    onClick={() => change(p.items.filter((r) => selectedKeys.has(p.keyOf(r))), false, false)}>
                    <X className="sk-icon" />
                  </ActionIcon>
                ) : multi ? (
                  <Checkbox size="xs" checked={allSelected} indeterminate={!allSelected && selectedKeys.size > 0} aria-label={t('filterBar.selectAll')}
                    onChange={() => change(rows, !allSelected, true)} />
                ) : null}
              </th>
            ) : null}
            {visible.map((c, i) => (
              <th key={c.id} data-sk-cell tabIndex={i === 0 ? 0 : -1} data-col={c.id} className={alignEnd(c) ? 'sk-rtable__end' : undefined} style={c.width ? { ...headStyle, width: c.width } : headStyle}>{c.header}</th>
            ))}
            {p.inlineActions ? <th data-sk-cell tabIndex={-1} style={headStyle}><span className="sk-visually-hidden">{t('actions.inline')}</span></th> : null}
            {actionsColumn ? <th data-sk-cell tabIndex={-1} className="sk-rtable__item-actions" style={{ ...headStyle, width: actionsWidth }}><span className="sk-visually-hidden">{t('actions.inline')}</span></th> : null}
            {navColumn ? <th data-sk-cell tabIndex={-1} className="sk-rtable__nav" style={headStyle}><span className="sk-visually-hidden">{t('table.navigate')}</span></th> : null}
            {deleteColumn ? <th data-sk-cell tabIndex={-1} style={headStyle}><span className="sk-visually-hidden">{t('actions.delete')}</span></th> : null}
          </tr>
        </thead>
        <tbody>
          {displayRows.map((row, index) => {
            const k = p.keyOf(row);
            const group = groupCol ? (groupCol.groupValue?.(row) ?? '') : undefined;
            let header: ReactNode = null;
            if (groupCol && group !== lastGroup) {
              const summary = p.groupSummary?.(row);
              const title = t('table.groupHeader', { label: typeof groupCol.header === 'string' ? groupCol.header : '', value: group || '–' }) + (summary?.count !== undefined ? t('table.groupCount', { count: summary.count }) : '');
              header = (
                <tr key={`g:${group}`} className="sk-rtable__group" data-sk-group-row={group} data-sk-group-count={summary?.count}>
                  {summaryCells(title, summary?.cells, 'rowgroup')}
                </tr>
              );
            }
            lastGroup = group;
            const selected = selectedKeys.has(k);
            const node = p.tree?.nodeOf(row);
            const navigable = rowNavigable(row);
            const clickable = navigable || mode === 'SingleSelectMaster' || (p.includeItemInSelection && mode !== 'None' && mode !== 'Delete');
            const unread = Boolean(p.showUnread && p.rowUnread?.(row));
            return [
              header,
              <tr
                key={k}
                data-sk-row={k}
                aria-selected={mode !== 'None' && mode !== 'Delete' ? selected : undefined}
                aria-level={node ? node.level + 1 : undefined}
                aria-expanded={node && node.drillState !== 'leaf' ? node.drillState === 'expanded' : undefined}
                data-changed={p.changedKeys?.has(k) || undefined}
                data-sk-highlight={p.rowHighlight?.(row)}
                data-sk-unread={unread || undefined}
                className={['sk-rtable__row', clickable ? 'sk-rtable__row--nav' : '', unread ? 'sk-rtable__row--unread' : '', p.rowHighlight?.(row) ? `sk-table__row--${p.rowHighlight(row)}` : ''].join(' ')}
                onContextMenu={p.contextMenu ? (e) => openContextMenu(row, e) : undefined}
                onTouchStart={p.swipeContent != null ? onTouchStart : undefined}
                onTouchEnd={p.swipeContent != null ? (e) => onTouchEnd(row, e) : undefined}
                onClick={(e) => {
                  if (!clickable) return;
                  if ((e.target as HTMLElement).closest('button, a, input, label, [role="button"], [data-sk-no-nav]')) return;
                  press(row, e.target as HTMLElement);
                }}
              >
                {selectColumn ? (
                  <td className="sk-rtable__select" data-sk-cell tabIndex={-1} data-sk-no-nav style={cellStyle(index)}>
                    {multi
                      ? <Checkbox size="xs" checked={selected} onChange={() => toggle(row)} aria-label={t('table.selectRow')} />
                      : <Radio size="xs" checked={selected} onChange={() => change([row], true, false)} aria-label={t('table.selectRow')} />}
                  </td>
                ) : null}
                {visible.map((c, i) => (
                  <td key={c.id} data-sk-cell tabIndex={-1} data-col={c.id} className={alignEnd(c) ? 'sk-rtable__end' : undefined} style={cellStyle(index)}>
                    {i === 0 && p.tree ? <TreeCell node={node} onToggle={() => p.tree!.toggle(row)}>{c.cell(row)}</TreeCell> : c.cell(row)}
                    {i === 0 && unread ? <span className="sk-visually-hidden">{t('table.unread')}</span> : null}
                    {i === 0 && p.rowMarker ? p.rowMarker(row) : null}
                    {i === 0 && p.changedKeys?.has(k) ? <div className="sk-rtable__changed" data-sk-changed-marker>{t('table.changedItem')}</div> : null}
                    {i === 0 && inPopin.length ? (
                      <dl className="sk-rtable__popin" data-sk-popin style={popinStyle}>
                        {inPopin.map((h) => (
                          <div key={h.id} className="sk-rtable__popin-pair">{h.popinDisplay === 'WithoutHeader' ? null : <dt>{h.header}:</dt>}<dd>{h.cell(row)}</dd></div>
                        ))}
                      </dl>
                    ) : null}
                  </td>
                ))}
                {p.inlineActions ? <td data-sk-cell tabIndex={-1} className="sk-rtable__actions" data-sk-no-nav style={cellStyle(index)}>{p.inlineActions(row)}</td> : null}
                {actionsColumn ? actionCell(row, index) : null}
                {navColumn ? (
                  <td data-sk-cell tabIndex={-1} className="sk-rtable__nav" aria-label={navigable ? t('table.navigate') : undefined} style={cellStyle(index)}>
                    {navigable ? <ChevronRight className="sk-icon" aria-hidden /> : null}
                  </td>
                ) : null}
                {deleteColumn ? (
                  <td data-sk-cell tabIndex={-1} data-sk-no-nav style={cellStyle(index)}>
                    <ActionIcon size="sm" variant="subtle" aria-label={t('actions.delete')} title={t('actions.delete')} onClick={() => p.onDelete?.({ listItem: row })} data-sk-row-delete><Trash2 className="sk-icon" /></ActionIcon>
                  </td>
                ) : null}
              </tr>,
            ];
          })}
        </tbody>
        {(p.totals && rows.length) || columns.some((c) => c.footer !== undefined) ? (
          <tfoot>
            {p.totals && rows.length ? <tr className="sk-rtable__total" data-sk-total-row>{summaryCells(p.totals.label, p.totals.cells, 'row')}</tr> : null}
            {columns.some((c) => c.footer !== undefined) ? (
              <tr className="sk-rtable__footer">
                {selectColumn ? <td /> : null}
                {visible.map((c) => <td key={c.id} data-col={c.id} className={alignEnd(c) ? 'sk-rtable__end' : undefined}>{c.footer ?? null}</td>)}
                {p.inlineActions ? <td /> : null}
                {actionsColumn ? <td /> : null}
                {navColumn ? <td /> : null}
                {deleteColumn ? <td /> : null}
              </tr>
            ) : null}
          </tfoot>
        ) : null}
      </table>
      {!rows.length && !p.busy && p.showNoData !== false ? <div className="sk-table__nodata sk-rtable__nodata" data-sk-nodata>{p.noData ?? <Text c="dimmed">{p.noDataText ?? t('table.noData.empty')}</Text>}</div> : null}
      {upwards ? null : growingTrigger}
      {upwards ? null : sentinel}
      {swiped ? (
        <div
          ref={swipeBoxRef} className="sk-rtable__swipe" data-sk-swipe tabIndex={-1} style={{ top: swiped.top, height: swiped.height }}
          onKeyDown={(e) => { if (e.key === 'Escape') swipeOut(); }}
        >
          {p.swipeContent}
        </div>
      ) : null}
      {p.contextMenu ? (
        <Popover opened={menu !== null} onChange={(o) => { if (!o) setMenu(null); }} onClose={() => setMenu(null)} position="bottom-start" withinPortal closeOnEscape closeOnClickOutside trapFocus returnFocus>
          <Popover.Target>
            <span aria-hidden className="sk-rtable__context-anchor" style={{ position: 'fixed', left: menu?.x ?? 0, top: menu?.y ?? 0, width: 0, height: 0, pointerEvents: 'none' }} />
          </Popover.Target>
          <Popover.Dropdown data-sk-context-menu onClick={(e) => { if ((e.target as HTMLElement).closest('button, a, [role="menuitem"]')) setMenu(null); }}>
            {menu ? (typeof p.contextMenu === 'function' ? p.contextMenu(menu.row) : p.contextMenu) : null}
          </Popover.Dropdown>
        </Popover>
      ) : null}
      {showBusy ? <div className="sk-rtable__loading" role="status"><Loader size="xs" /> {t('table.loadingMore')}</div> : null}
      {p.footerText ? <Text size="sm" c="dimmed" className="sk-rtable__footer-text" data-sk-rtable-footer>{p.footerText}</Text> : null}
      {p.showOverlay ? <div className="sk-table__overlay" data-sk-overlay><Text>{t('page.overlay')}</Text></div> : null}
    </div>
  );
}

/** Group value of a column backed by a field path. */
export const groupValueOf = (path: string) => (row: Row) => String(getPath(row, path) ?? '');
