/**
 * Flexible column layout (ADR-022, NAV-07; DP Combining the Dynamic Page with the FCL): up to three columns, each with
 * its own dynamic page. The layout is controlled by the host (its router); the columns get layout actions (full screen,
 * exit full screen, close) and optional paging buttons, shown at the very right of their title bar. Between the columns a
 * separator carries arrow buttons that switch between the column ratios (UI5 FCL: 33/67 ↔ 67/33, 25/50/25 ↔ 25/25/50 …);
 * the arrows call `onLayoutChange`, the host's router applies the new layout.
 */
import { ActionIcon, Group, Tooltip } from '@mantine/core';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Maximize2, Minimize2, X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useText } from '../context/SmartKitProvider';
import { ColumnContext } from '../page/columnContext';

/** Column layouts and their widths (UI5 sap.f.LayoutType): begin / mid / end in percent. */
export type FclLayout =
  | 'OneColumn' // 100
  | 'TwoColumnsBeginExpanded' // 67 / 33
  | 'TwoColumnsMidExpanded' // 33 / 67
  | 'ThreeColumnsMidExpanded' // 25 / 50 / 25
  | 'ThreeColumnsEndExpanded' // 25 / 25 / 50
  | 'ThreeColumnsMidExpandedEndHidden' // 33 / 67 / 0
  | 'ThreeColumnsBeginExpandedEndHidden' // 67 / 33 / 0
  | 'MidColumnFullScreen'
  | 'EndColumnFullScreen';

export interface FclPaging {
  onPrevious?(): void;
  onNext?(): void;
}

export interface FlexibleColumnLayoutProps {
  layout: FclLayout;
  onLayoutChange(layout: FclLayout): void;
  begin: ReactNode;
  mid?: ReactNode;
  end?: ReactNode;
  /** Close of the mid / end column (the host clears its selection). */
  onCloseMid?(): void;
  onCloseEnd?(): void;
  /** Paging buttons of the mid / end column (DP Header Title Guidelines: paging buttons left of the layout actions). */
  midPaging?: FclPaging;
  endPaging?: FclPaging;
  /** Arrow buttons on the separators between the columns (default true). */
  separatorArrows?: boolean;
  /** Extra CSS class on the root element. */
  className?: string;
}

/** One arrow of a column separator: the layout it switches to and its accessible label. */
export interface FclArrow {
  layout: FclLayout;
  direction: 'left' | 'right';
  label: 'layout.expandBegin' | 'layout.expandMid' | 'layout.expandEnd' | 'layout.showEnd';
}

/**
 * Arrows of the separators after the begin column ([0]) and after the mid column ([1]) in a layout (UI5 FCL). The
 * second separator's arrows need an end column (`hasEnd`).
 */
export function fclArrows(layout: FclLayout, hasEnd: boolean): [FclArrow | undefined, FclArrow | undefined] {
  const a = (to: FclLayout, direction: FclArrow['direction'], label: FclArrow['label']): FclArrow => ({ layout: to, direction, label });
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

/** Below this width only the last visible column is shown (UI5 FCL: one column on small screens). */
const NARROW = 1024;

function widths(layout: FclLayout, narrow: boolean): [number, number, number] {
  if (narrow) {
    if (layout === 'OneColumn') return [100, 0, 0];
    if (layout === 'ThreeColumnsMidExpanded' || layout === 'ThreeColumnsEndExpanded' || layout === 'EndColumnFullScreen') return [0, 0, 100];
    return [0, 100, 0];
  }
  switch (layout) {
    case 'TwoColumnsBeginExpanded': return [67, 33, 0];
    case 'TwoColumnsMidExpanded': return [33, 67, 0];
    case 'ThreeColumnsMidExpanded': return [25, 50, 25];
    case 'ThreeColumnsEndExpanded': return [25, 25, 50];
    case 'ThreeColumnsMidExpandedEndHidden': return [33, 67, 0];
    case 'ThreeColumnsBeginExpandedEndHidden': return [67, 33, 0];
    case 'MidColumnFullScreen': return [0, 100, 0];
    case 'EndColumnFullScreen': return [0, 0, 100];
    default: return [100, 0, 0];
  }
}

export function FlexibleColumnLayout(p: FlexibleColumnLayoutProps) {
  const t = useText();
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1440);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth || 1440));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const narrow = width < NARROW;
  const [wb, wm, we] = widths(p.layout, narrow);
  const fullScreen = p.layout === 'MidColumnFullScreen' || p.layout === 'EndColumnFullScreen';
  const single = [wb, wm, we].filter((w) => w > 0).length === 1;

  const btn = (label: string, icon: ReactNode, onClick: () => void, data: string) => (
    <Tooltip label={label} key={data}><ActionIcon variant="subtle" aria-label={label} onClick={onClick} data-sk-layout-action={data}>{icon}</ActionIcon></Tooltip>
  );
  const pagingButtons = (paging?: FclPaging) => (paging ? (
    <Group gap={2} wrap="nowrap" data-sk-fcl-paging>
      {btn(t('layout.previous'), <ChevronUp className="sk-icon" />, () => paging.onPrevious?.(), 'previous')}
      {btn(t('layout.next'), <ChevronDown className="sk-icon" />, () => paging.onNext?.(), 'next')}
    </Group>
  ) : null);
  const midActions = (
    <Group gap={2} wrap="nowrap">
      {pagingButtons(p.midPaging)}
      {p.layout === 'MidColumnFullScreen'
        ? btn(t('layout.exitFullScreen'), <Minimize2 className="sk-icon" />, () => p.onLayoutChange(p.end ? 'ThreeColumnsMidExpanded' : 'TwoColumnsMidExpanded'), 'exit-full-screen')
        : btn(t('layout.fullScreen'), <Maximize2 className="sk-icon" />, () => p.onLayoutChange('MidColumnFullScreen'), 'full-screen')}
      {btn(t('layout.close'), <X className="sk-icon" />, () => p.onCloseMid?.(), 'close')}
    </Group>
  );
  const endActions = (
    <Group gap={2} wrap="nowrap">
      {pagingButtons(p.endPaging)}
      {p.layout === 'EndColumnFullScreen'
        ? btn(t('layout.exitFullScreen'), <Minimize2 className="sk-icon" />, () => p.onLayoutChange('ThreeColumnsMidExpanded'), 'exit-full-screen')
        : btn(t('layout.fullScreen'), <Maximize2 className="sk-icon" />, () => p.onLayoutChange('EndColumnFullScreen'), 'full-screen')}
      {btn(t('layout.close'), <X className="sk-icon" />, () => p.onCloseEnd?.(), 'close')}
    </Group>
  );
  const col = (index: number, w: number, content: ReactNode, actions: ReactNode | undefined) => (
    <div className="sk-fcl__column" data-sk-fcl-column={index} data-width={w} hidden={w === 0} style={{ flexBasis: `${w}%` }}>
      {w > 0 && content ? (
        // DP Header Title (3): breadcrumbs only in full screen mode with one column.
        <ColumnContext.Provider value={{ column: index, layoutActions: actions, showBreadcrumbs: single && (fullScreen || narrow) }}>{content}</ColumnContext.Provider>
      ) : null}
    </div>
  );
  const arrows = narrow || p.separatorArrows === false ? [undefined, undefined] : fclArrows(p.layout, Boolean(p.end));
  // A separator between two visible columns, or after the mid column when its arrow shows the hidden end column.
  const separator = (index: 1 | 2, visible: boolean) => {
    const arrow = arrows[index - 1];
    if (!visible && !arrow) return null;
    const label = arrow ? t(arrow.label) : '';
    return (
      <div className="sk-fcl__separator" data-sk-fcl-separator={index}>
        {arrow ? (
          <Tooltip label={label}>
            <ActionIcon variant="default" size="sm" radius="xl" aria-label={label} onClick={() => p.onLayoutChange(arrow.layout)} data-sk-fcl-arrow={arrow.layout} className="sk-fcl__arrow">
              {arrow.direction === 'left' ? <ChevronLeft className="sk-icon" /> : <ChevronRight className="sk-icon" />}
            </ActionIcon>
          </Tooltip>
        ) : null}
      </div>
    );
  };
  return (
    <div ref={ref} className={['sk-fcl', p.className].filter(Boolean).join(' ')} data-sk-fcl={p.layout}>
      {col(0, wb, p.begin, undefined)}
      {separator(1, wb > 0 && wm > 0)}
      {col(1, wm, p.mid, p.mid ? midActions : undefined)}
      {separator(2, wm > 0 && we > 0)}
      {col(2, we, p.end, p.end ? endActions : undefined)}
    </div>
  );
}
