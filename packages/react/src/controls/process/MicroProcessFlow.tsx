/**
 * MicroProcessFlow + MicroProcessFlowItem (sap.suite.ui.commons), docs/26 §3.6: a compact row of state icons joined by
 * separators. Items are JSX children (aggregation `content`, ADR-032 rule 4); the UI5 `key` is the React key.
 */
import { ChevronLeft, ChevronRight, CircleCheck, CircleX, Info, TriangleAlert } from 'lucide-react';
import { useRef, type ReactNode } from 'react';
import { useControlText } from '../context';
import { elementsOf, preventable, toneOf, type PreventableEvent, type ValueState } from '../types';
import { cx } from './shared';
import { TEXTS } from './texts';

/** sap.suite.ui.commons.MicroProcessFlowRenderType */
export type MicroProcessFlowRenderType = 'Wrap' | 'NoWrap' | 'Scrolling' | 'ScrollingWithResizer';
export const MicroProcessFlowRenderType = { Wrap: 'Wrap', NoWrap: 'NoWrap', Scrolling: 'Scrolling', ScrollingWithResizer: 'ScrollingWithResizer' } as const;

/** A MicroProcessFlowItem in event objects: its props and React key. */
export type MicroProcessFlowPressedItem = Omit<$MicroProcessFlowItemSettings, 'onPress'> & { key?: string };

export interface $MicroProcessFlowItemSettings {
  /** Replaces the state icon. */
  icon?: ReactNode;
  /** Accessible name and tooltip of the step. */
  title?: string;
  /** Default 'None' (a plain dot). */
  state?: ValueState;
  /** Shows `intermediary` (or a small dot) on the separator after the item (default false). */
  showIntermediary?: boolean;
  /** CSS width of the step including its separator. */
  stepWidth?: string;
  /** Line to the next item (default true). */
  showSeparator?: boolean;
  /** Replaces the whole step (icon). */
  customControl?: ReactNode;
  /** Content on the separator when `showIntermediary`. */
  intermediary?: ReactNode;
  /** Preventable, as in UI5. */
  onPress?: (e: PreventableEvent<{ item: MicroProcessFlowPressedItem }>) => void;
}

/** A step of MicroProcessFlow; rendered by its parent. */
export function MicroProcessFlowItem(_: $MicroProcessFlowItemSettings): null {
  return null;
}

export interface $MicroProcessFlowSettings {
  children?: ReactNode;
  /** Default 'Wrap'. */
  renderType?: MicroProcessFlowRenderType;
  /** CSS width. */
  width?: string;
  /** Accessible name of the list. */
  ariaLabel?: string;
}

const ICONS: Partial<Record<ValueState, ReactNode>> = {
  Error: <CircleX aria-hidden="true" />, Warning: <TriangleAlert aria-hidden="true" />,
  Success: <CircleCheck aria-hidden="true" />, Information: <Info aria-hidden="true" />,
};

export function MicroProcessFlow(p: $MicroProcessFlowSettings) {
  const t = useControlText(TEXTS);
  const list = useRef<HTMLOListElement>(null);
  const items = elementsOf<$MicroProcessFlowItemSettings>(p.children, MicroProcessFlowItem);
  const type = p.renderType ?? 'Wrap';
  const scroll = (d: number) => list.current?.scrollBy?.({ left: d * list.current.clientWidth * 0.8, behavior: 'smooth' });
  const ol = (
    <ol
      ref={list}
      className={cx('sk-micro-flow', type !== 'Wrap' && 'sk-micro-flow--nowrap', type.startsWith('Scrolling') && 'sk-micro-flow--scrolling')}
      style={p.width && type !== 'ScrollingWithResizer' ? { inlineSize: p.width } : undefined}
      aria-label={p.ariaLabel ?? t('ctl.microProcessFlow.label')}
    >
      {items.map(({ key, props: it }, i) => {
        const state = it.state ?? 'None';
        const glyph = it.icon ?? ICONS[state] ?? <span className="sk-micro-flow__dot" aria-hidden="true" />;
        const cls = `sk-micro-flow__step sk-status--${toneOf(state)}`;
        const press = it.onPress && (() => {
          const { onPress, ...rest } = it;
          onPress?.(preventable({ item: { ...rest, key } }));
        });
        return (
          <li key={key ?? i} className="sk-micro-flow__item" data-state={state} style={it.stepWidth ? { inlineSize: it.stepWidth } : undefined}>
            {it.customControl ?? (press
              ? <button type="button" className={`${cls} sk-micro-flow__step--active`} title={it.title} aria-label={it.title ?? state} onClick={press}>{glyph}</button>
              : <span className={cls} title={it.title} role="img" aria-label={it.title ?? state}>{glyph}</span>)}
            {i < items.length - 1 && it.showSeparator !== false && (
              <span className="sk-micro-flow__separator">
                {it.showIntermediary && (it.intermediary ?? <span className="sk-micro-flow__intermediary" aria-hidden="true" />)}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
  if (type !== 'ScrollingWithResizer') return ol;
  return (
    <div className="sk-micro-flow-scroller" style={p.width ? { inlineSize: p.width } : undefined}>
      <button type="button" className="sk-micro-flow-scroller__button" aria-label={t('ctl.microProcessFlow.scrollBack')} onClick={() => scroll(-1)}><ChevronLeft aria-hidden="true" /></button>
      {ol}
      <button type="button" className="sk-micro-flow-scroller__button" aria-label={t('ctl.microProcessFlow.scrollForward')} onClick={() => scroll(1)}><ChevronRight aria-hidden="true" /></button>
    </div>
  );
}
