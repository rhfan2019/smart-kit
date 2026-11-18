/**
 * sap.f.FlexibleColumnLayout (ADR-022, ADR-033, NAV-07; DP Combining the Dynamic Page with the FCL): up to three columns,
 * each with its own page. The layout is controlled by the host (its router): every change the user asks for (separator
 * arrows, the full screen and close buttons of FlexibleColumnLayoutActions) and every change of the maximum column count
 * fires `onStateChange`, the host's router applies the new layout. The columns give their content a ColumnContext
 * (layout actions, paging for Paginator, breadcrumbs only in full screen).
 */
import { ActionIcon, Tooltip } from '@mantine/core';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useImperativeHandle, useRef, useState, type ReactNode, type Ref } from 'react';
import { useText } from '../context/SmartKitProvider';
import type { BackgroundDesign } from '../controls/dialogs/IconTabBar';
import { ColumnContext, type ColumnPaging, type LayoutType } from '../page/columnContext';

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
  /** Fired when the user asks for another layout (arrows, layout actions) or the maximum column count changes. */
  onStateChange?(e: FlexibleColumnLayout$StateChangeEvent): void;
  /** Fired when column widths change; true for each column that changed. */
  onColumnResize?(e: FlexibleColumnLayout$ColumnResizeEvent): void;
  /** Extension: paging of the mid column for its Paginator (the host's list). */
  midPaging?: ColumnPaging;
  /** Extension: paging of the end column for its Paginator. */
  endPaging?: ColumnPaging;
  /** Extension: arrow buttons on the separators between the columns (default true). */
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
  /** The change comes from a separator arrow. */
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

/** Column widths in percent (begin / mid / end) of a layout for the maximum column count (sap.f.LayoutType). */
function widths(layout: LayoutType, max: number): [number, number, number] {
  if (max === 1) {
    if (layout === 'OneColumn') return [100, 0, 0];
    if (layout === 'ThreeColumnsMidExpanded' || layout === 'ThreeColumnsEndExpanded' || layout === 'EndColumnFullScreen') return [0, 0, 100];
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

export function FlexibleColumnLayout(p: $FlexibleColumnLayoutSettings) {
  const t = useText();
  const layout = p.layout ?? 'OneColumn';
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
  useImperativeHandle(p.ref, () => ({ getMaxColumnsCount: () => max }), [max]);
  const [wb, wm, we] = widths(layout, max);
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
  const lastWidths = useRef<[number, number, number]>([wb, wm, we]);
  useEffect(() => {
    const [b, m, e] = lastWidths.current;
    lastWidths.current = [wb, wm, we];
    if (b === wb && m === wm && e === we) return;
    latest.current.onColumnResize?.({ beginColumn: b !== wb, midColumn: m !== wm, endColumn: e !== we });
  }, [wb, wm, we]);

  const hasEnd = Boolean(p.endColumnPages);
  const col = (index: 0 | 1 | 2, w: number, content: ReactNode) => (
    <div className="sk-fcl__column" data-sk-fcl-column={index} data-width={w} hidden={w === 0} style={{ flexBasis: `${w}%` }}>
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
  const arrows = max === 1 || p.separatorArrows === false ? [undefined, undefined] : fclArrows(layout, hasEnd);
  // A separator between two visible columns, or after the mid column when its arrow shows the hidden end column.
  const separator = (index: 1 | 2, visible: boolean) => {
    const arrow = arrows[index - 1];
    if (!visible && !arrow) return null;
    const label = arrow ? t(arrow.label) : '';
    return (
      <div className="sk-fcl__separator" data-sk-fcl-separator={index}>
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
    <div ref={rootRef} className={['sk-fcl', p.className].filter(Boolean).join(' ')} data-sk-fcl={layout} data-background-design={p.backgroundDesign ?? 'Transparent'}>
      {col(0, wb, p.beginColumnPages)}
      {separator(1, wb > 0 && wm > 0)}
      {col(1, wm, p.midColumnPages)}
      {separator(2, wm > 0 && we > 0)}
      {col(2, we, p.endColumnPages)}
    </div>
  );
}
