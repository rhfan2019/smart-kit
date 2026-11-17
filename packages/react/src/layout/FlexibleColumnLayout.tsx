/**
 * Flexible column layout (ADR-022, NAV-07; DP Combining the Dynamic Page with the FCL): up to three columns, each with
 * its own dynamic page. The layout is controlled by the host (its router); the columns get layout actions (full screen,
 * exit full screen, close) and optional paging buttons, shown at the very right of their title bar.
 */
import { ActionIcon, Group, Tooltip } from '@mantine/core';
import { ChevronDown, ChevronUp, Maximize2, Minimize2, X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useText } from '../context/SmartKitProvider';
import { ColumnContext } from '../page/columnContext';

export type FclLayout = 'OneColumn' | 'TwoColumnsMidExpanded' | 'ThreeColumnsMidExpanded' | 'MidColumnFullScreen' | 'EndColumnFullScreen';

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
  /** Extra CSS class on the root element. */
  className?: string;
}

/** Below this width only the last visible column is shown (UI5 FCL: one column on small screens). */
const NARROW = 1024;

function widths(layout: FclLayout, narrow: boolean): [number, number, number] {
  if (narrow) {
    if (layout === 'OneColumn') return [100, 0, 0];
    if (layout === 'TwoColumnsMidExpanded' || layout === 'MidColumnFullScreen') return [0, 100, 0];
    return [0, 0, 100];
  }
  switch (layout) {
    case 'TwoColumnsMidExpanded': return [33, 67, 0];
    case 'ThreeColumnsMidExpanded': return [25, 50, 25];
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
  return (
    <div ref={ref} className={['sk-fcl', p.className].filter(Boolean).join(' ')} data-sk-fcl={p.layout}>
      {col(0, wb, p.begin, undefined)}
      {col(1, wm, p.mid, p.mid ? midActions : undefined)}
      {col(2, we, p.end, p.end ? endActions : undefined)}
    </div>
  );
}
