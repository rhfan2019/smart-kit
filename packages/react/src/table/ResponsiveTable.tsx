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
import { ActionIcon, Button, Checkbox, Loader, Radio, Text } from '@mantine/core';
import type { HierarchyNode, Row } from '@rhfan2019/smart-kit-core';
import { ChevronRight, Trash2, X } from 'lucide-react';
import { useEffect, useImperativeHandle, useRef, useState, type KeyboardEvent, type ReactNode, type Ref } from 'react';
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
  /** More items can be loaded by the parent (`onUpdateStarted` with reason "Growing" asks for them; smart-kit addition). */
  hasMore?: boolean;
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
  const grow = (n?: number) => {
    const l = latest.current;
    if (!l.growing) return;
    if (l.hasMore !== undefined) {
      if (!l.hasMore || l.busy) return;
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

  // Scroll to load: the sentinel after the last row starts the next page.
  const scrollToLoad = Boolean(p.growing && p.growingScrollToLoad);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !scrollToLoad || typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver(([e]) => { if (e!.isIntersecting) growRef.current(); }, { rootMargin: '0px 0px 200px 0px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, [scrollToLoad]);
  useEffect(() => {
    // Rows may not fill the viewport yet: keep loading while the sentinel is visible.
    const el = sentinelRef.current;
    if (!el || !scrollToLoad || !canGrow || p.busy) return;
    if (el.getBoundingClientRect().top < window.innerHeight + 200) growRef.current();
  });

  const tableRef = useRef<HTMLTableElement>(null);
  useImperativeHandle(p.ref, (): Table => ({
    getGrowingInfo: () => (latest.current.growing ? { actual: rows.length, total } : null),
    getSelectedItem: () => latest.current.items.find((r) => selectedKeys.has(latest.current.keyOf(r))) ?? null,
    getSelectedItems: () => latest.current.items.filter((r) => selectedKeys.has(latest.current.keyOf(r))),
    setSelectedItem: (row, select = true, fireEvent = false) => change([row], select, false, fireEvent),
    removeSelections: (_all, fireEvent = false) => change(latest.current.items.filter((r) => selectedKeys.has(latest.current.keyOf(r))), false, false, fireEvent),
    selectAll: (fireEvent = false) => change(rows, true, true, fireEvent),
    requestItems: (n) => growRef.current(n),
    scrollToIndex: async (index) => {
      const trs = tableRef.current?.querySelectorAll<HTMLTableRowElement>('tr[data-sk-row]');
      const tr = trs?.[index < 0 ? trs.length - 1 : index];
      tr?.scrollIntoView?.({ block: 'nearest' });
    },
  }));

  const allSelected = rows.length > 0 && rows.every((r) => selectedKeys.has(p.keyOf(r)));
  const deleteColumn = mode === 'Delete';
  const span = visible.length + (selectColumn ? 1 : 0) + (p.inlineActions ? 1 : 0) + (p.navigable ? 1 : 0) + (deleteColumn ? 1 : 0);
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
        {p.navigable ? <td /> : null}
        {deleteColumn ? <td /> : null}
      </>
    );
  };

  const press = (row: Row, src: HTMLElement) => {
    if (mode === 'SingleSelectMaster' || (p.includeItemInSelection && (multi || single))) toggle(row);
    if (p.navigable || mode === 'SingleSelectMaster') p.onItemPress?.({ listItem: row, srcControl: src });
  };

  // Grid keyboard navigation (arrow keys between cells, Enter presses the row, Space selects).
  const onKeyDown = (e: KeyboardEvent<HTMLTableElement>) => {
    const cell = (e.target as HTMLElement).closest<HTMLElement>('[data-sk-cell]');
    if (!cell) return;
    const tr = cell.parentElement as HTMLTableRowElement;
    const cells = [...tr.querySelectorAll<HTMLElement>('[data-sk-cell]')];
    const i = cells.indexOf(cell);
    const trs = [...(tr.closest('table')?.querySelectorAll<HTMLTableRowElement>('tr[data-sk-row], thead tr') ?? [])];
    const ri = trs.indexOf(tr);
    let next: HTMLElement | undefined;
    if (e.key === 'ArrowRight') next = cells[i + 1];
    else if (e.key === 'ArrowLeft') next = cells[i - 1];
    else if (e.key === 'ArrowDown') next = trs[ri + 1]?.querySelectorAll<HTMLElement>('[data-sk-cell]')[i];
    else if (e.key === 'ArrowUp') next = trs[ri - 1]?.querySelectorAll<HTMLElement>('[data-sk-cell]')[i];
    else if (e.key === 'Enter' && tr.dataset.skRow && p.navigable && e.target === cell) {
      const row = p.items.find((r) => p.keyOf(r) === tr.dataset.skRow);
      if (row) p.onItemPress?.({ listItem: row, srcControl: cell });
    } else if (e.key === ' ' && tr.dataset.skRow && mode !== 'None' && mode !== 'Delete' && e.target === cell) {
      const row = p.items.find((r) => p.keyOf(r) === tr.dataset.skRow);
      if (row) { toggle(row); e.preventDefault(); }
    }
    if (next) {
      e.preventDefault();
      cell.tabIndex = -1;
      next.tabIndex = 0;
      next.focus();
    }
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
  return (
    <div className="sk-rtable" ref={boxRef} data-sk-responsive-table data-width={width} data-mode={mode} style={{ width: p.width, background, padding: p.inset ? 'var(--sk-space-4)' : undefined }} aria-busy={p.busy || undefined}>
      {p.headerText ? <Heading className="sk-rtable__header" data-sk-rtable-header>{p.headerText}</Heading> : null}
      {p.headerToolbar}
      {p.infoToolbar}
      <table ref={tableRef} role={p.tree ? 'treegrid' : 'grid'} aria-label={p.headerText ?? p['aria-label']} aria-rowcount={rows.length} onKeyDown={onKeyDown} onPaste={p.onPaste ? (e) => {
        const text = e.clipboardData.getData('text/plain');
        if (!text) return;
        p.onPaste!({ data: text.replace(/\r\n?/g, '\n').replace(/\n$/, '').split('\n').map((line) => line.split('\t')), preventDefault: () => e.preventDefault() });
      } : undefined} className="sk-rtable__table" style={{ tableLayout: layout }}>
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
            {p.navigable ? <th data-sk-cell tabIndex={-1} className="sk-rtable__nav" style={headStyle}><span className="sk-visually-hidden">{t('table.navigate')}</span></th> : null}
            {deleteColumn ? <th data-sk-cell tabIndex={-1} style={headStyle}><span className="sk-visually-hidden">{t('actions.delete')}</span></th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
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
            const clickable = p.navigable || mode === 'SingleSelectMaster' || (p.includeItemInSelection && mode !== 'None' && mode !== 'Delete');
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
                className={['sk-rtable__row', clickable ? 'sk-rtable__row--nav' : '', p.rowHighlight?.(row) ? `sk-table__row--${p.rowHighlight(row)}` : ''].join(' ')}
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
                {p.navigable ? <td data-sk-cell tabIndex={-1} className="sk-rtable__nav" aria-label={t('table.navigate')} style={cellStyle(index)}><ChevronRight className="sk-icon" aria-hidden /></td> : null}
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
                {p.navigable ? <td /> : null}
                {deleteColumn ? <td /> : null}
              </tr>
            ) : null}
          </tfoot>
        ) : null}
      </table>
      {!rows.length && !p.busy && p.showNoData !== false ? <div className="sk-table__nodata sk-rtable__nodata" data-sk-nodata>{p.noData ?? <Text c="dimmed">{p.noDataText ?? t('table.noData.empty')}</Text>}</div> : null}
      {p.growing && canGrow && !p.growingScrollToLoad ? (
        <Button variant="subtle" fullWidth className="sk-table__more" loading={p.busy} onClick={() => grow()} data-sk-more>
          {p.growingTriggerText ?? (total !== undefined ? t('table.moreCount', { loaded: rows.length, count: total }) : t('table.more'))}
        </Button>
      ) : null}
      <div ref={sentinelRef} className="sk-rtable__sentinel" aria-hidden />
      {showBusy ? <div className="sk-rtable__loading" role="status"><Loader size="xs" /> {t('table.loadingMore')}</div> : null}
      {p.footerText ? <Text size="sm" c="dimmed" className="sk-rtable__footer-text" data-sk-rtable-footer>{p.footerText}</Text> : null}
      {p.showOverlay ? <div className="sk-table__overlay" data-sk-overlay><Text>{t('page.overlay')}</Text></div> : null}
    </div>
  );
}

/** Group value of a column backed by a field path. */
export const groupValueOf = (path: string) => (row: Row) => String(getPath(row, path) ?? '');
