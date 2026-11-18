/**
 * sap.f.FlexibleColumnLayout (ADR-022, ADR-033, NAV-07; DP Combining the Dynamic Page with the FCL): up to three columns,
 * each with its own page. The layout is controlled by the host (its router): every change the user asks for (dragging a
 * column separator past a layout's limit, the full screen and close buttons of FlexibleColumnLayoutActions, the
 * optional separator arrows) and every change of the maximum column count fires `onStateChange`, the host's router
 * applies the new layout. The columns give their content a ColumnContext (layout actions, paging for Paginator,
 * breadcrumbs only in full screen).
 * - columns are regions labelled "First column", "Middle column", "Last column" (or the landmark info's labels);
 * - the separators can be dragged (mouse, touch) or moved with the arrow keys, Home and End; the new sizes are fired
 *   with `columnsDistributionChange`, and the begin column keeps its new width in the other layouts of the same media;
 * - `autoFocus`: when a column shows a page for the first time, or another page (a new React key or element type)
 *   while the focus was in it, the focus moves to the page's first focusable element (sap.m.NavContainer autoFocus).
 */
import { ActionIcon, Tooltip } from '@mantine/core';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { isValidElement, useEffect, useImperativeHandle, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode, type Ref } from 'react';
import { useText } from '../context/SmartKitProvider';
import type { BackgroundDesign } from '../controls/dialogs/IconTabBar';
import { ColumnContext, type ColumnPaging, type LayoutType } from '../page/columnContext';
import { landmarkProps, type $FlexibleColumnLayoutAccessibleLandmarkInfoSettings } from '../page/landmarks';

export { LayoutType } from '../page/columnContext';

export interface $FlexibleColumnLayoutSettings {
  /** The column layout. @defaultValue 'OneColumn' */
  layout?: LayoutType;
  /** Pages of the begin column (the first one is shown). */
  beginColumnPages?: ReactNode;
  /** Pages of the mid column. */
  midColumnPages?: ReactNode;
  /** Pages of the end column. */
  endColumnPages?: ReactNode;
  /** Background of the layout. @defaultValue 'Transparent' */
  backgroundDesign?: BackgroundDesign;
  /**
   * The focus moves to the first focusable element of a column's page when the column shows a page for the first
   * time, and when it shows another page (another React key or element type) while the focus was in the column.
   * @defaultValue true
   */
  autoFocus?: boolean;
  /** Labels of the column regions (and the separator arrows), a FlexibleColumnLayoutAccessibleLandmarkInfo. */
  landmarkInfo?: ReactNode;
  /** Fired when the user asks for another layout (dragging a separator, layout actions, arrows) or the maximum column count changes. */
  onStateChange?(e: FlexibleColumnLayout$StateChangeEvent): void;
  /** Fired when column widths change; true for each column that changed. */
  onColumnResize?(e: FlexibleColumnLayout$ColumnResizeEvent): void;
  /** Fired when the user resized the columns by moving a separator. */
  onColumnsDistributionChange?(e: FlexibleColumnLayout$ColumnsDistributionChangeEvent): void;
  /** Extension: paging of the mid column for its Paginator (the host's list). */
  midPaging?: ColumnPaging;
  /** Extension: paging of the end column for its Paginator. */
  endPaging?: ColumnPaging;
  /** Extension: arrow buttons on the separators that switch to the neighbouring layout (default false). */
  separatorArrows?: boolean;
  /** Extra CSS class on the root element. */
  className?: string;
  ref?: Ref<FlexibleColumnLayout>;
}

/** Event object of FlexibleColumnLayout's stateChange. */
export interface FlexibleColumnLayout$StateChangeEvent {
  /** The layout to apply. */
  layout: LayoutType;
  /** How many columns fit (3 from 1280px, 2 from 960px, 1 below). */
  maxColumnsCount: number;
  /** The change comes from the user (a dragged separator or a separator arrow). */
  isNavigationArrow: boolean;
  /** The change comes from a resize (the maximum column count changed). */
  isResize: boolean;
}

/** Event object of FlexibleColumnLayout's columnResize. */
export interface FlexibleColumnLayout$ColumnResizeEvent {
  beginColumn: boolean;
  midColumn: boolean;
  endColumn: boolean;
}

/** Event object of FlexibleColumnLayout's columnsDistributionChange. */
export interface FlexibleColumnLayout$ColumnsDistributionChangeEvent {
  /** The media: "desktop" (3 columns fit) or "tablet". */
  media: string;
  /** The layout after the resize. */
  layout: string;
  /** Sizes of the columns in percent, separated by "/" (begin/mid/end). */
  columnsSizes: string;
}

/** Instance methods of FlexibleColumnLayout. */
export interface FlexibleColumnLayout {
  /** How many columns fit the current width (3, 2 or 1). */
  getMaxColumnsCount(): number;
}

/** One arrow of a column separator: the layout it switches to and its accessible label. */
export interface FclArrow {
  layout: LayoutType;
  direction: 'left' | 'right';
  label: 'layout.expandBegin' | 'layout.expandMid' | 'layout.expandEnd' | 'layout.showEnd';
}

/**
 * Arrows of the separators after the begin column ([0]) and after the mid column ([1]) in a layout (UI5 FCL). The
 * second separator's arrows need an end column (`hasEnd`).
 */
export function fclArrows(layout: LayoutType, hasEnd: boolean): [FclArrow | undefined, FclArrow | undefined] {
  const a = (to: LayoutType, direction: FclArrow['direction'], label: FclArrow['label']): FclArrow => ({ layout: to, direction, label });
  switch (layout) {
    case 'TwoColumnsMidExpanded': return [a('TwoColumnsBeginExpanded', 'right', 'layout.expandBegin'), undefined];
    case 'TwoColumnsBeginExpanded': return [a('TwoColumnsMidExpanded', 'left', 'layout.expandMid'), undefined];
    case 'ThreeColumnsMidExpanded': return [a('ThreeColumnsBeginExpandedEndHidden', 'right', 'layout.expandBegin'), hasEnd ? a('ThreeColumnsEndExpanded', 'left', 'layout.expandEnd') : undefined];
    case 'ThreeColumnsEndExpanded': return [undefined, hasEnd ? a('ThreeColumnsMidExpanded', 'right', 'layout.expandMid') : undefined];
    case 'ThreeColumnsMidExpandedEndHidden': return [a('ThreeColumnsBeginExpandedEndHidden', 'right', 'layout.expandBegin'), hasEnd ? a('ThreeColumnsMidExpanded', 'left', 'layout.showEnd') : undefined];
    case 'ThreeColumnsBeginExpandedEndHidden': return [a('ThreeColumnsMidExpandedEndHidden', 'left', 'layout.expandMid'), hasEnd ? a('ThreeColumnsMidExpanded', 'left', 'layout.showEnd') : undefined];
    default: return [undefined, undefined];
  }
}

/** How many columns fit (sap.f.FlexibleColumnLayout: desktop 3 from 1280px, tablet 2 from 960px, phone 1). */
function maxColumns(width: number): number {
  return width >= 1280 ? 3 : width >= 960 ? 2 : 1;
}

type Widths = [number, number, number];

/** Column widths in percent (begin / mid / end) of a layout for the maximum column count (sap.f.LayoutType). */
function widths(layout: LayoutType, max: number): Widths {
  if (max === 1) {
    if (layout === 'OneColumn') return [100, 0, 0];
    if (layout === 'ThreeColumnsMidExpanded' || layout === 'ThreeColumnsEndExpanded' || layout === 'EndColumnFullScreen'
      || layout === 'ThreeColumnsMidExpandedEndHidden' || layout === 'ThreeColumnsBeginExpandedEndHidden') return [0, 0, 100];
    return [0, 100, 0];
  }
  switch (layout) {
    case 'TwoColumnsBeginExpanded': return [67, 33, 0];
    case 'TwoColumnsMidExpanded': return [33, 67, 0];
    case 'ThreeColumnsMidExpanded': return max === 2 ? [0, 67, 33] : [25, 50, 25];
    case 'ThreeColumnsEndExpanded': return max === 2 ? [0, 33, 67] : [25, 25, 50];
    case 'ThreeColumnsMidExpandedEndHidden': return [33, 67, 0];
    case 'ThreeColumnsBeginExpandedEndHidden': return [67, 33, 0];
    case 'MidColumnFullScreen': return [0, 100, 0];
    case 'EndColumnFullScreen': return [0, 0, 100];
    default: return [100, 0, 0];
  }
}

const FULL_SCREEN = new Set<LayoutType>(['OneColumn', 'MidColumnFullScreen', 'EndColumnFullScreen']);

/**
 * The widths of a layout with the begin column width the user dragged in this media (UI5
 * `_getColumnWidthDistributionForLayout` with `_oBeginColumnWidth`): with the begin column at 33% or more the layouts
 * with three visible columns would not be what they are, so it is capped at 32% there.
 */
function widthsWithBegin(layout: LayoutType, max: number, begin: number | undefined): Widths {
  const w = widths(layout, max);
  if (!begin || max === 1 || FULL_SCREEN.has(layout) || w[0] === 0) return w;
  const b = (layout === 'ThreeColumnsMidExpanded' || layout === 'ThreeColumnsEndExpanded') && Math.floor(begin) >= 33 ? 32 : begin;
  return [b, 100 - b - w[2], w[2]];
}

/** Separators a layout shows (UI5 `_getRequiredColumnSeparatorsForLayout`): 1 after the begin column, 2 after the mid column. */
function separatorsOf(layout: LayoutType, max: number): Set<1 | 2> {
  if (max === 1) return new Set();
  switch (layout) {
    case 'TwoColumnsBeginExpanded': case 'TwoColumnsMidExpanded': case 'ThreeColumnsBeginExpandedEndHidden': return new Set([1]);
    case 'ThreeColumnsMidExpanded': case 'ThreeColumnsMidExpandedEndHidden': return new Set([1, 2]);
    case 'ThreeColumnsEndExpanded': return new Set([2]);
    default: return new Set();
  }
}

/** sap.f.FlexibleColumnLayout.COLUMN_MIN_WIDTH: no visible column is narrower after resizing (px). */
const COLUMN_MIN_WIDTH = 312;
type Col = 'begin' | 'mid' | 'end';
type PxWidths = Record<Col, number>;
const COLS: Col[] = ['begin', 'mid', 'end'];

/** The two columns a separator resizes (UI5 `getInteractivelyResizedColumns`; on tablets a hidden begin column counts). */
function resizedColumns(separator: 1 | 2, layout: LayoutType, max: number): [Col, Col] {
  if (max === 2 && layout === 'ThreeColumnsMidExpandedEndHidden') return separator === 1 ? ['begin', 'mid'] : ['begin', 'end'];
  if (max === 2 && layout === 'ThreeColumnsMidExpanded') return separator === 1 ? ['begin', 'end'] : ['mid', 'end'];
  return separator === 1 ? ['begin', 'mid'] : ['mid', 'end'];
}

/** The layout a drag leads to (UI5 `_getNextLayoutOnResizeByDrag`). */
function nextLayoutOnDrag(w: PxWidths, total: number, previous: LayoutType, separator: 1 | 2, forward: boolean, end: boolean, max: number): LayoutType {
  const is = (from: LayoutType, sep: 1 | 2, fwd: boolean) => from === previous && sep === separator && fwd === forward;
  const beginPercent = Math.ceil(total ? (w.begin / total) * 100 : 0);
  if (is('TwoColumnsMidExpanded', 1, true) && w.begin >= w.mid) return 'TwoColumnsBeginExpanded';
  if (is('TwoColumnsBeginExpanded', 1, false) && w.begin < w.mid) return 'TwoColumnsMidExpanded';
  if (is('ThreeColumnsMidExpanded', 1, true) && beginPercent >= 33) return 'ThreeColumnsMidExpandedEndHidden';
  if (is('ThreeColumnsMidExpandedEndHidden', 1, false) && beginPercent < 33) return 'ThreeColumnsMidExpanded';
  if (is('ThreeColumnsMidExpandedEndHidden', 2, false) && (w.end >= COLUMN_MIN_WIDTH || end)) return 'ThreeColumnsMidExpanded';
  if (is('ThreeColumnsMidExpanded', 2, false) && w.mid < w.end) return 'ThreeColumnsEndExpanded';
  if (is('ThreeColumnsEndExpanded', 2, true) && w.mid >= w.end) return 'ThreeColumnsMidExpanded';
  if (is('ThreeColumnsMidExpandedEndHidden', 1, true) && w.begin >= w.mid) return 'ThreeColumnsBeginExpandedEndHidden';
  if (is('ThreeColumnsBeginExpandedEndHidden', 1, false) && w.begin < w.mid) return 'ThreeColumnsMidExpandedEndHidden';
  if (is('ThreeColumnsMidExpanded', 1, true) && max === 2 && (w.begin >= COLUMN_MIN_WIDTH || end)) return 'ThreeColumnsMidExpandedEndHidden';
  return previous;
}

/** Whether the sizes fit the layout (UI5 `_isValidWidthDistributionForLayout`, `_verifyColumnWidthsMatchLayout`). */
function validDistribution(percent: Widths, layout: LayoutType, total: number, max: number): boolean {
  if (Math.round(percent[0] + percent[1] + percent[2]) !== 100) return false;
  const [begin, mid, end] = percent.map((x) => (x ? Math.round((total * x) / 100) : 0)) as Widths;
  if ([begin, mid, end].some((x) => x > 0 && x < COLUMN_MIN_WIDTH)) return false;
  const beginPercent = Math.ceil(total ? (begin / total) * 100 : 0);
  switch (layout) {
    case 'TwoColumnsBeginExpanded': return begin >= mid;
    case 'TwoColumnsMidExpanded': return mid > begin;
    case 'ThreeColumnsEndExpanded': return end > mid && beginPercent < 33;
    case 'ThreeColumnsBeginExpandedEndHidden': return begin >= mid && end === 0;
    case 'ThreeColumnsMidExpanded': return mid >= end && ((max === 3 && beginPercent < 33) || (max === 2 && beginPercent === 0));
    case 'ThreeColumnsMidExpandedEndHidden': return mid > begin && end === 0 && ((max === 3 && beginPercent >= 33) || (max === 2 && begin >= COLUMN_MIN_WIDTH));
    default: return false;
  }
}

/** A separator drag in progress (UI5 `_oMoveInfo`). */
interface Move {
  separator: 1 | 2;
  startX: number;
  lastX: number;
  widths: PxWidths;
  layout: LayoutType;
  total: number;
  rtl: boolean;
  enlarged?: Col;
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Identity of a column's page: another key or element type is another page (a navigation in the column). */
function pageId(content: ReactNode): string | undefined {
  if (content === undefined || content === null || content === false) return undefined;
  if (!isValidElement(content)) return 'page';
  const type = content.type as unknown;
  const name = typeof type === 'string' ? type : (type as { displayName?: string; name?: string }).displayName ?? (type as { name?: string }).name ?? '?';
  return `${name}:${content.key ?? ''}`;
}

export function FlexibleColumnLayout(p: $FlexibleColumnLayoutSettings) {
  const t = useText();
  const propLayout = p.layout ?? 'OneColumn';
  const rootRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1440);
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth || 1440));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const max = maxColumns(width);
  const media = max === 3 ? 'desktop' : 'tablet';
  useImperativeHandle(p.ref, () => ({ getMaxColumnsCount: () => max }), [max]);
  const info = landmarkProps<$FlexibleColumnLayoutAccessibleLandmarkInfoSettings>(p.landmarkInfo);

  // Interactive resize: the begin column width per media (UI5 _oBeginColumnWidth), the last dragged sizes of a layout,
  // and the sizes while dragging.
  const [beginWidth, setBeginWidth] = useState<{ desktop?: number; tablet?: number }>({});
  const [dragged, setDragged] = useState<{ layout: LayoutType; max: number; widths: Widths } | null>(null);
  const [live, setLive] = useState<{ layout: LayoutType; widths: Widths } | null>(null);
  const committed: Widths = dragged && dragged.layout === propLayout && dragged.max === max ? dragged.widths : widthsWithBegin(propLayout, max, beginWidth[media]);
  const layout = live?.layout ?? propLayout;
  const [wb, wm, we] = live?.widths ?? committed;
  const fullScreen = layout === 'MidColumnFullScreen' || layout === 'EndColumnFullScreen';
  const single = [wb, wm, we].filter((w) => w > 0).length === 1;

  const latest = useRef(p);
  latest.current = p;
  const change = (next: LayoutType, isNavigationArrow = false) => latest.current.onStateChange?.({ layout: next, maxColumnsCount: max, isNavigationArrow, isResize: false });
  // A change of the maximum column count is a state change too (isResize).
  const lastMax = useRef(max);
  useEffect(() => {
    if (lastMax.current === max) return;
    lastMax.current = max;
    latest.current.onStateChange?.({ layout: latest.current.layout ?? 'OneColumn', maxColumnsCount: max, isNavigationArrow: false, isResize: true });
  }, [max]);
  const [cb, cm, ce] = committed;
  const lastWidths = useRef<Widths>([cb, cm, ce]);
  useEffect(() => {
    const [b, m, e] = lastWidths.current;
    lastWidths.current = [cb, cm, ce];
    if (b === cb && m === cm && e === ce) return;
    latest.current.onColumnResize?.({ beginColumn: b !== cb, midColumn: m !== cm, endColumn: e !== ce });
  }, [cb, cm, ce]);

  // autoFocus (sap.m.NavContainer): a column's first page, or another page while the focus was in the column.
  const contents = [p.beginColumnPages, p.midColumnPages, p.endColumnPages];
  const ids = contents.map(pageId);
  const shown = [wb, wm, we].map((w, i) => (w > 0 ? ids[i] : undefined));
  const colRefs = useRef<(HTMLDivElement | null)[]>([null, null, null]);
  const lastShown = useRef<(string | undefined)[]>([undefined, undefined, undefined]);
  const focusIn = useRef<boolean[]>([false, false, false]);
  const shownKey = shown.join('|');
  useEffect(() => {
    const previous = lastShown.current;
    lastShown.current = shown;
    if (latest.current.autoFocus === false || rootRef.current?.closest('[role="dialog"]')) return;
    shown.forEach((id, i) => {
      const el = colRefs.current[i];
      if (!id || !el || previous[i] === id) return;
      const active = document.activeElement;
      const lost = !active || active === document.body || el.contains(active);
      // first page of the column, or a navigation in the column that had the focus
      if (previous[i] !== undefined && !(focusIn.current[i] && lost)) return;
      el.querySelector<HTMLElement>(FOCUSABLE)?.focus({ preventScroll: true });
    });
  }, [shownKey]); // eslint-disable-line react-hooks/exhaustive-deps -- reacts to the shown pages only

  // Separator drag (UI5 _onColumnSeparatorMoveStart / Move / MoveEnd).
  const move = useRef<Move | null>(null);
  // the width the columns share: the layout's width without the separators (UI5 _getTotalColumnsWidth)
  const available = () => {
    const root = rootRef.current;
    const separators = [...(root?.querySelectorAll<HTMLElement>(':scope > [data-sk-fcl-separator]') ?? [])].reduce((sum, el) => sum + el.offsetWidth, 0);
    return (root?.clientWidth || width) - separators;
  };
  const toPx = (w: Widths, total: number): PxWidths => ({ begin: (w[0] * total) / 100, mid: (w[1] * total) / 100, end: (w[2] * total) / 100 });
  const toPercent = (w: PxWidths, total: number): Widths => COLS.map((c) => (w[c] && total ? (w[c] / total) * 100 : 0)) as Widths;
  const start = (separator: 1 | 2, x: number) => {
    const total = available();
    const rtl = rootRef.current ? getComputedStyle(rootRef.current).direction === 'rtl' : false;
    move.current = { separator, startX: x, lastX: x, widths: toPx(committed, total), layout: propLayout, total, rtl };
  };
  const preview = (x: number, end = false) => {
    const m = move.current;
    if (!m) return;
    const sign = m.rtl ? -1 : 1;
    const fromPrevious = (x - m.lastX) * sign;
    const fromStart = (x - m.startX) * sign;
    m.lastX = x;
    if (!fromStart || (!fromPrevious && !end)) return;
    const [a, b] = resizedColumns(m.separator, m.layout, max);
    const forward = fromStart > 0;
    const enlarged = forward ? a : b;
    const hidden = [a, b].find((c) => m.widths[c] === 0);
    if (hidden && hidden !== enlarged) return; // resizing in a direction that is not allowed
    m.widths[a] += fromPrevious;
    m.widths[b] -= fromPrevious;
    if (m.widths[a] < 0) { m.widths[b] += m.widths[a]; m.widths[a] = 0; }
    if (m.widths[b] < 0) { m.widths[a] += m.widths[b]; m.widths[b] = 0; }
    m.enlarged = enlarged;
    const next: PxWidths = { ...m.widths };
    // a resized column below the minimum width grows at the cost of the other (not the one being revealed)
    for (const c of [a, b]) {
      if (c === enlarged || next[c] >= COLUMN_MIN_WIDTH) continue;
      const other = c === a ? b : a;
      next[other] -= COLUMN_MIN_WIDTH - next[c];
      next[c] = COLUMN_MIN_WIDTH;
    }
    let widthsPx = next;
    const nextLayout = nextLayoutOnDrag(next, m.total, m.layout, m.separator, forward, end, max);
    if (nextLayout !== m.layout) {
      // the new layout's widths with the dragged column (UI5 _mergeColumnWidthsOnInteractiveLayoutChange)
      const old = toPx(widthsWithBegin(nextLayout, max, beginWidth[media]), m.total);
      const update = a === 'mid' ? b : b === 'mid' ? a : enlarged;
      widthsPx = next[update] < COLUMN_MIN_WIDTH ? old : { ...old, [update]: next[update] };
      if (widthsPx !== old) widthsPx.mid = m.total - widthsPx.begin - widthsPx.end;
      m.layout = nextLayout;
      m.startX = x;
    }
    m.widths = widthsPx;
    setLive({ layout: m.layout, widths: toPercent(widthsPx, m.total) });
  };
  const finish = (x: number) => {
    const m = move.current;
    if (!m) return;
    preview(x, true);
    move.current = null;
    setLive(null);
    const percent = toPercent(m.widths, m.total);
    if (percent.some((w, i) => w !== committed[i]) || m.layout !== propLayout) setDragged({ layout: m.layout, max, widths: percent });
    if (validDistribution(percent, m.layout, m.total, max)) {
      latest.current.onColumnsDistributionChange?.({ media, layout: m.layout, columnsSizes: percent.join('/') });
      setBeginWidth((bw) => ({ ...bw, [media]: percent[0] }));
    }
    if (m.layout !== propLayout) change(m.layout, true);
  };
  const onMouseDown = (separator: 1 | 2) => (e: React.MouseEvent | React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('[data-sk-fcl-arrow]')) return;
    const touch = 'touches' in e;
    const xOf = (ev: MouseEvent | TouchEvent) => ('changedTouches' in ev ? ev.changedTouches[0]?.clientX ?? 0 : ev.clientX);
    start(separator, touch ? (e as React.TouchEvent).touches[0]?.clientX ?? 0 : (e as React.MouseEvent).clientX);
    const onMove = (ev: MouseEvent | TouchEvent) => { if (!touch) ev.preventDefault(); preview(xOf(ev)); };
    const onUp = (ev: MouseEvent | TouchEvent) => {
      document.removeEventListener(touch ? 'touchmove' : 'mousemove', onMove);
      document.removeEventListener(touch ? 'touchend' : 'mouseup', onUp);
      finish(xOf(ev));
      grips.current[separator]?.focus();
    };
    document.addEventListener(touch ? 'touchmove' : 'mousemove', onMove);
    document.addEventListener(touch ? 'touchend' : 'mouseup', onUp);
  };
  // Keyboard (UI5 _resizeColumnOnKeypress): arrows 20px, with a modifier 1px, Home / End as far as possible.
  const onKeyDown = (separator: 1 | 2) => (e: ReactKeyboardEvent) => {
    const modifier = e.shiftKey || e.ctrlKey || e.altKey || e.metaKey;
    const total = rootRef.current?.clientWidth || width;
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    const offset = step !== undefined ? step * (modifier ? 1 : 20) : e.key === 'End' ? total : e.key === 'Home' ? -total : undefined;
    if (offset === undefined) return;
    e.preventDefault();
    const x = (e.currentTarget as HTMLElement).getBoundingClientRect().x;
    start(separator, x);
    preview(x + offset);
    finish(x + offset);
  };
  const grips = useRef<Record<1 | 2, HTMLDivElement | null>>({ 1: null, 2: null });

  const hasEnd = Boolean(p.endColumnPages);
  const labels = [info?.firstColumnLabel || t('layout.firstColumn'), info?.middleColumnLabel || t('layout.midColumn'), info?.lastColumnLabel || t('layout.lastColumn')];
  const seps = separatorsOf(layout, max);
  const sepCount = [1, 2].filter((i) => seps.has(i as 1 | 2) && (i === 1 || we > 0 || hasEnd)).length;
  const col = (index: 0 | 1 | 2, w: number, content: ReactNode) => (
    <div
      ref={(el) => { colRefs.current[index] = el; }}
      className="sk-fcl__column" data-sk-fcl-column={index} data-width={w} hidden={w === 0} role="region" aria-label={labels[index]}
      style={{ flexBasis: sepCount ? `calc((100% - ${sepCount} * var(--sk-fcl-separator-width)) * ${w / 100})` : `${w}%` }}
      onFocus={() => { focusIn.current[index] = true; }}
      onBlur={(e) => { if (e.relatedTarget && !e.currentTarget.contains(e.relatedTarget as Node)) focusIn.current[index] = false; }}
    >
      {w > 0 && content ? (
        <ColumnContext.Provider
          value={{
            column: index,
            layout,
            // DP Header Title (3): breadcrumbs only in full screen mode with one column.
            showBreadcrumbs: single && (fullScreen || max === 1),
            fullScreen: index === 1
              ? { active: layout === 'MidColumnFullScreen', toggle: () => change(layout === 'MidColumnFullScreen' ? (hasEnd ? 'ThreeColumnsMidExpanded' : 'TwoColumnsMidExpanded') : 'MidColumnFullScreen') }
              : index === 2 ? { active: layout === 'EndColumnFullScreen', toggle: () => change(layout === 'EndColumnFullScreen' ? 'ThreeColumnsMidExpanded' : 'EndColumnFullScreen') } : undefined,
            close: index === 1 ? () => change('OneColumn') : index === 2 ? () => change('TwoColumnsMidExpanded') : undefined,
            paging: index === 1 ? p.midPaging : index === 2 ? p.endPaging : undefined,
          }}
        >
          {content}
        </ColumnContext.Provider>
      ) : null}
    </div>
  );
  const arrows = max === 1 || !p.separatorArrows ? [undefined, undefined] : fclArrows(layout, hasEnd);
  // Arrow labels of the landmark info (the arrows of former UI5 versions sat in the columns).
  const arrowLabel = (arrow: FclArrow, index: 1 | 2) => (index === 1
    ? (arrow.direction === 'left' ? info?.firstColumnBackArrowLabel : info?.middleColumnForwardArrowLabel)
    : (arrow.direction === 'left' ? info?.middleColumnBackArrowLabel : info?.lastColumnForwardArrowLabel)) || t(arrow.label);
  // aria-valuenow: the separator's position inside the range it can move in (UI5 _updateAriaPositionInfo).
  const valueNow = (index: 1 | 2) => {
    const min = (COLUMN_MIN_WIDTH / (rootRef.current?.clientWidth || width)) * 100;
    const position = index === 1 ? wb : wb + wm;
    let before = min;
    let after = min;
    if (max === 3 && index === 2) before = wb + min; // the begin column is not resized by the end separator
    if (max === 2 && index === 1 && layout.startsWith('ThreeColumns')) before = 0;
    if (index === 2 && layout === 'ThreeColumnsMidExpandedEndHidden') after = 0;
    const to = 100 - after;
    return to > before ? Math.round(((position - before) / (to - before)) * 10000) / 100 : 0;
  };
  const separator = (index: 1 | 2) => {
    // the separator after the mid column reveals a hidden end column only when there is one
    if (!seps.has(index) || (index === 2 && we === 0 && !hasEnd)) return null;
    const arrow = arrows[index - 1];
    const label = arrow ? arrowLabel(arrow, index) : '';
    return (
      <div className="sk-fcl__separator" data-sk-fcl-separator={index} onMouseDown={onMouseDown(index)} onTouchStart={onMouseDown(index)} data-resizing={live ? true : undefined}>
        <div
          ref={(el) => { grips.current[index] = el; }}
          className="sk-fcl__grip" role="separator" aria-label={t('layout.separatorMove')} aria-orientation="vertical" tabIndex={0}
          aria-valuemin={0} aria-valuemax={100} aria-valuenow={valueNow(index)} onKeyDown={onKeyDown(index)} data-sk-fcl-grip={index}
        />
        {arrow ? (
          <Tooltip label={label}>
            <ActionIcon variant="default" size="sm" radius="xl" aria-label={label} onClick={() => change(arrow.layout, true)} data-sk-fcl-arrow={arrow.layout} className="sk-fcl__arrow">
              {arrow.direction === 'left' ? <ChevronLeft className="sk-icon" /> : <ChevronRight className="sk-icon" />}
            </ActionIcon>
          </Tooltip>
        ) : null}
      </div>
    );
  };
  return (
    <div ref={rootRef} className={['sk-fcl', p.className].filter(Boolean).join(' ')} data-sk-fcl={layout} data-background-design={p.backgroundDesign ?? 'Transparent'} data-resizing={live ? true : undefined}>
      {col(0, wb, p.beginColumnPages)}
      {separator(1)}
      {col(1, wm, p.midColumnPages)}
      {separator(2)}
      {col(2, we, p.endColumnPages)}
    </div>
  );
}
