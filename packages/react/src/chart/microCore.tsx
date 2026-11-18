/**
 * Shared parts of the nine sap.suite.ui.microchart controls (docs/15, ADR-021, stage 6): the root element (size, "No
 * data", press), the measured box, labels that are hidden instead of cut (MC-04), colours and the library enums.
 * Each control module imports only this file and its own drawing.
 */
import { isValidElement, useLayoutEffect, useMemo, useState, type CSSProperties, type ReactElement, type ReactNode } from 'react';
import { useSmartKit } from '../context/SmartKitProvider';
import { elementsOf } from '../controls/types';
import type { TextFn } from '../i18n/text';

/** sap.m.Size (the size of a micro chart). */
export type Size = 'XS' | 'S' | 'M' | 'L' | 'Responsive' | 'Auto';
export const Size = { XS: 'XS', S: 'S', M: 'M', L: 'L', Responsive: 'Responsive', Auto: 'Auto' } as const;
/** sap.m.ValueColor */
export type ValueColor = 'Good' | 'Critical' | 'Error' | 'Neutral' | 'None';
export const ValueColor = { Good: 'Good', Critical: 'Critical', Error: 'Error', Neutral: 'Neutral', None: 'None' } as const;
/** sap.suite.ui.microchart.MicroChartColorType */
export type MicroChartColorType = ValueColor | `Sequence${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12}`;
export const MicroChartColorType = {
  Good: 'Good', Critical: 'Critical', Error: 'Error', Neutral: 'Neutral', None: 'None',
  Sequence1: 'Sequence1', Sequence2: 'Sequence2', Sequence3: 'Sequence3', Sequence4: 'Sequence4', Sequence5: 'Sequence5', Sequence6: 'Sequence6',
  Sequence7: 'Sequence7', Sequence8: 'Sequence8', Sequence9: 'Sequence9', Sequence10: 'Sequence10', Sequence11: 'Sequence11', Sequence12: 'Sequence12',
} as const;
/** sap.suite.ui.microchart.CommonBackgroundType */
export type CommonBackgroundType = 'Lightest' | 'ExtraLight' | 'Light' | 'MediumLight' | 'Medium' | 'Dark' | 'ExtraDark' | 'Darkest' | 'Transparent';
export const CommonBackgroundType = {
  Lightest: 'Lightest', ExtraLight: 'ExtraLight', Light: 'Light', MediumLight: 'MediumLight', Medium: 'Medium', Dark: 'Dark', ExtraDark: 'ExtraDark', Darkest: 'Darkest', Transparent: 'Transparent',
} as const;
/** sap.suite.ui.microchart.HorizontalAlignmentType */
export type HorizontalAlignmentType = 'Left' | 'Center' | 'Right';
export const HorizontalAlignmentType = { Left: 'Left', Center: 'Center', Right: 'Right' } as const;
/** A MicroChartColorType or a CSS colour (sap.m.ValueCSSColor; also the theme parameter names `sapUiChartPaletteQualitativeHue1` …). */
export type MicroChartColor = MicroChartColorType | (string & {});

/** Settings every micro chart has (sap.suite.ui.microchart.*MicroChart). */
export interface MicroChartBaseSettings {
  /**
   * The size of the micro chart: XS, S, M, L are fixed boxes; Auto is M (S on phones); Responsive fills the container.
   * @defaultValue 'Auto'
   */
  size?: Size;
  /** The width of the chart (CSS size); overrides the width of `size`. */
  width?: string;
  /** The height of the chart (CSS size); overrides the height of `size`. */
  height?: string;
  /**
   * The control is hidden when there is no data.
   * @defaultValue false
   */
  hideOnNoData?: boolean;
  /** The chart was pressed; with a handler the chart is a button (Enter / Space / click). Not fired without data. */
  onPress?: () => void;
  /** Accessible name; the text alternative of the chart is appended. */
  'aria-label'?: string;
  className?: string;
  style?: CSSProperties;
}

export interface Rendered {
  body: ReactNode;
  /** The text alternative (without the accessible name). */
  aria: string;
  /** Colour of the root (e.g. the bullet's actual value). */
  mark?: ColorProps;
}
export interface MicroCtx {
  t: TextFn;
  /** Locale number format for the text alternative. */
  fmt: (n: number) => string;
  /** Locale percentage (0.425 → "42.5 %"), at most `digits` decimals (default 0). */
  pct: (f: number, digits?: number) => string;
  /** The measured box is lower than MICRO_LABEL_MIN_HEIGHT (or the size is XS): no labels. */
  compact: boolean;
  w?: number;
  h?: number;
}

/** Below this height (px) the labels are hidden (MC-27, MC-36, MC-53, MC-57, MC-63). */
export const MICRO_LABEL_MIN_HEIGHT = 56;

export const cx = (...names: (string | false | undefined | null)[]) => names.filter(Boolean).join(' ');
export const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
export const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export interface ColorProps { className?: string; style?: CSSProperties }
const SEMANTIC: Record<string, string> = { Good: 'positive', Error: 'negative', Critical: 'critical', Neutral: 'neutral' };
/** Colour of a mark: a semantic class, a palette class (Sequence1…12, sapUiChartPaletteQualitativeHue1…11) or a CSS colour. */
export function colorOf(color: string | undefined): ColorProps {
  const c = color?.trim();
  if (!c || c === 'None') return {};
  if (SEMANTIC[c]) return { className: `sk-chart--${SEMANTIC[c]}` };
  const seq = /^(?:Sequence|sapUiChartPaletteQualitativeHue)(\d+)$/.exec(c);
  if (seq) return { className: paletteClass(((Number(seq[1]) - 1) % 11) + 1) };
  const sem = /^sapUiChartPaletteSemantic(Good|Bad|Critical|Neutral)/.exec(c);
  if (sem) return { className: `sk-chart--${SEMANTIC[sem[1] === 'Bad' ? 'Error' : sem[1]!]}` };
  return { style: { ['--sk-chart-mark' as string]: c } };
}
export const paletteClass = (n: number | undefined) => `sk-chart--palette-${n !== undefined && Number.isInteger(n) && n >= 1 && n <= 11 ? n : 1}`;
/** The colour of item `i`: the palette (cycled) when given, else the item's own colour (colorPalette rule of UI5). */
export const itemColor = (palette: string[] | undefined, i: number, own: string | undefined) => colorOf(palette?.length ? palette[i % palette.length] : own);

/**
 * The items of an aggregation: the same-named prop (settings objects or elements) or, for the default aggregation, the
 * child elements of the item type.
 */
export function itemsOf<P extends object>(prop: (P | ReactElement<P>)[] | P | ReactElement<P> | undefined, children: ReactNode, type: unknown): P[] {
  if (prop !== undefined && prop !== null) return (Array.isArray(prop) ? prop : [prop]).map((x) => (isValidElement(x) ? (x.props as P) : x));
  return elementsOf<P>(children, type).map((e) => e.props);
}
export const itemOf = <P extends object>(prop: P | ReactElement<P> | undefined, children: ReactNode, type: unknown): P | undefined => itemsOf(prop, children, type)[0];

/** The accessible name followed by the text alternative ("Budget: Actual 10"); without a name only the text alternative. */
export function named(t: TextFn, label: string | undefined, aria: string): string {
  if (!label) return aria;
  return t('chart.parts', { label, parts: aria });
}

/** A labelled text ("{label}: …") without its label: the accessible name is added by the root. */
const MARK = '{\u2063label\u2063}';
export const unlabelled = (t: TextFn, key: Parameters<TextFn>[0], params: Record<string, string | number>) => {
  const s = t(key, { ...params, label: MARK });
  return s.startsWith(MARK) ? s.slice(MARK.length).replace(/^[:：]\s*/, '') : s;
};

/** Content box of the element, updated on resize (undefined without ResizeObserver: everything is shown). */
function useBox(el: HTMLElement | null) {
  const [box, setBox] = useState<{ w: number; h: number }>();
  useLayoutEffect(() => {
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (r) setBox((b) => (b && b.w === r.width && b.h === r.height ? b : { w: r.width, h: r.height }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return box;
}

/** Hides a label group ([data-sk-fit]) when one of its numbers ([data-sk-num]) is cut; paired labels go together (MC-04). */
function useFitLabels(root: HTMLElement | null) {
  useLayoutEffect(() => {
    if (!root) return;
    for (const g of root.querySelectorAll<HTMLElement>('[data-sk-fit]')) {
      g.removeAttribute('data-sk-overflow');
      const cut = [...g.querySelectorAll<HTMLElement>('[data-sk-num]')].some((el) => el.scrollWidth > el.clientWidth + 0.5 || el.offsetWidth > g.clientWidth + 0.5);
      if (cut) g.setAttribute('data-sk-overflow', '');
    }
  });
}

/** A number label that is hidden (not cut) when it does not fit (MC-04). */
export const Num = ({ className, children, style }: { className?: string; children: ReactNode; style?: CSSProperties }) => <span className={className} style={style} data-sk-num>{children}</span>;

/** Linear scale of [lo, hi] (always containing 0 when `withZero`) onto [0, 100]. */
export function scale(values: number[], withZero = true) {
  let lo = Math.min(...values, ...(withZero ? [0] : []));
  let hi = Math.max(...values, ...(withZero ? [0] : []));
  if (hi <= lo) { if (withZero) { hi = lo + 1; lo = Math.min(lo, 0); } else { lo -= 0.5; hi += 0.5; } }
  return (v: number) => ((v - lo) / (hi - lo)) * 100;
}

/** "label scale": the UI5 rule for value texts (a label replaces the number; the scale suffix is appended). */
export const withSuffix = (label: string | undefined | null, value: number | undefined, suffix = '') => `${label ? label : value ?? ''}${suffix}`;

/**
 * The root of a micro chart: fixed size or the container's, "No data" placeholder (MC-05) or nothing (`hideOnNoData`,
 * MC-06), a button when pressable, else an image with one text alternative.
 */
export function MicroChartRoot({ kind, base, draw, extraClass }: { kind: string; base: MicroChartBaseSettings; draw: (c: MicroCtx) => Rendered | undefined; extraClass?: string }) {
  const { t, intlLocale } = useSmartKit();
  const [el, ref] = useState<HTMLElement | null>(null);
  const box = useBox(el);
  useFitLabels(el);
  const numberFormat = useMemo(() => new Intl.NumberFormat(intlLocale, { maximumFractionDigits: 2 }), [intlLocale]);
  const size = base.size ?? 'Auto';
  const ctx: MicroCtx = {
    t,
    fmt: (n) => numberFormat.format(n),
    pct: (f, digits = 0) => new Intl.NumberFormat(intlLocale, { style: 'percent', maximumFractionDigits: digits }).format(f),
    compact: size === 'XS' || (box !== undefined && box.h < MICRO_LABEL_MIN_HEIGHT),
    w: box?.w,
    h: box?.h,
  };
  const r = draw(ctx);
  const label = base['aria-label'];
  const sizeClass = size === 'Responsive' ? undefined : `sk-microchart--size-${size}`;
  const style: CSSProperties = { ...base.style, ...(base.width ? { width: base.width } : null), ...(base.height ? { height: base.height } : null) };
  if (!r) {
    if (base.hideOnNoData) return null;
    // MC-05: a placeholder of the chart's size; focusable, never pressable, no labels.
    return (
      <span ref={ref} className={cx('sk-microchart', `sk-microchart--${kind}`, 'sk-microchart--nodata', sizeClass, base.className)} style={style} role="img" aria-label={label ? t('chart.noDataFor', { label }) : t('chart.noData')} tabIndex={0} data-sk-microchart={kind}>
        <span className="sk-microchart__nodata" aria-hidden>{t('chart.noData')}</span>
      </span>
    );
  }
  const className = cx('sk-microchart', `sk-microchart--${kind}`, ctx.compact && 'sk-microchart--compact', r.mark?.className, extraClass, sizeClass, base.className);
  const rootStyle = { ...r.mark?.style, ...style };
  const aria = named(t, label, r.aria);
  const inner = <span className="sk-microchart__frame" aria-hidden>{r.body}</span>;
  if (base.onPress) {
    return (
      <button ref={ref} type="button" className={cx(className, 'sk-microchart--pressable')} style={rootStyle} data-sk-microchart={kind} onClick={() => base.onPress?.()}>
        {/* The name comes from the content (not aria-label), so it never conflicts with the visible numbers. */}
        <span className="sk-visually-hidden">{aria}</span>
        {inner}
      </button>
    );
  }
  return <span ref={ref} className={className} style={rootStyle} role="img" aria-label={aria} data-sk-microchart={kind}>{inner}</span>;
}

/** The semantic state in words for the text alternative, e.g. " (Good)" (colour is not the only carrier, WCAG 1.4.1). */
export function stateText(t: TextFn, color: string | undefined): string {
  const key = color === 'Good' ? 'chart.state.positive' : color === 'Error' ? 'chart.state.negative' : color === 'Critical' ? 'chart.state.critical' : undefined;
  return key ? ` (${t(key)})` : '';
}

/** A pair of labels at the two ends; hidden together when one does not fit (MC-04). */
export function EdgeLabels({ first, last, kind, colors }: { first: ReactNode; last: ReactNode; kind: 'top' | 'bottom'; colors?: [string | undefined, string | undefined] }) {
  const c0 = colors ? colorOf(colors[0]) : {};
  const c1 = colors ? colorOf(colors[1]) : {};
  return (
    <span className={cx('sk-microchart__edges', `sk-microchart__edges--${kind}`)} data-sk-fit>
      <Num className={cx(c0.className, (c0.className || c0.style) && 'sk-microchart__value--mark')} style={c0.style}>{first}</Num>
      <Num className={cx(c1.className, (c1.className || c1.style) && 'sk-microchart__value--mark')} style={c1.style}>{last}</Num>
    </span>
  );
}
