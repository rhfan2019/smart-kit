/**
 * MicroChart: small, non-interactive charts (docs/15-research-micro-chart.md; ADR-021): inline SVG, colours from tokens
 * through CSS classes, one text alternative for the whole chart (role="img", or a button when pressable).
 *
 * The chart fills its container within 64×18 – 320×94 px (MC-02, MC-03). The measured height decides which labels are
 * shown; a number that does not fit is hidden, never cut (MC-04).
 */
import { useLayoutEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { useSmartKit } from '../context/SmartKitProvider';
import type { TextFn } from '../i18n/text';

export type MicroChartKind = 'bullet' | 'radial' | 'harvey' | 'delta' | 'column' | 'line' | 'comparison' | 'area' | 'stackedBar';
export type MicroChartCriticality = 0 | 1 | 2 | 3 | 5;
export interface MicroChartPoint {
  /** Dimension value (category or date) shown as a label. */
  label: string;
  value: number;
  criticality?: MicroChartCriticality;
  /** Area: the target value at this point (MC-46). */
  target?: number;
  /** Stacked bar: text shown on the segment instead of the percentage (MC-59). */
  display?: string;
  /** Stacked bar: qualitative palette colour 1–11 when there is no criticality. */
  color?: number;
}
/** Area threshold boundaries, one value per point (MC-47). */
export interface MicroChartAreaThresholds {
  direction: 'Maximize' | 'Minimize' | 'Target';
  deviationLow?: number[];
  toleranceLow?: number[];
  toleranceHigh?: number[];
  deviationHigh?: number[];
}
/** A bullet chart threshold marker (MC-25). */
export interface MicroChartThreshold { value: number; criticality: MicroChartCriticality }

export interface MicroChartProps {
  /** Chart type: "bullet" | "radial" | "harvey" | "delta" | "column" | "line" | "comparison" | "area" | "stackedBar" (from `UI.Chart/ChartType` when model-driven). */
  kind: MicroChartKind;
  /** Accessible name, e.g. the facet title or the column header. */
  label: string;
  /** Single-value charts (bullet, radial, harvey, delta value 1). */
  value?: number;
  /** Bullet target; radial total (default 100: the value is a percentage, MC-51); delta value 2. */
  target?: number;
  /** Bullet forecast (MC-23). */
  forecast?: number;
  /** Bullet scale start (default: the smallest of 0 and all values, MC-26). */
  min?: number;
  /** Bullet scale end (default: the largest value); Harvey Ball total (MaximumValue, MC-55). */
  max?: number;
  /** Bullet threshold markers (MC-25). */
  thresholds?: MicroChartThreshold[];
  /** Bullet: 'delta' shows the difference between the value and the target (DeltaBulletChart, MC-24). */
  mode?: 'actual' | 'delta';
  /** Semantic colour of the value (from `UI.DataPoint/Criticality` or `CriticalityCalculation`). */
  criticality?: MicroChartCriticality;
  /** Qualitative palette colour 1–11, used when there is no criticality (Harvey Ball, MC-56). Default 1. */
  color?: number;
  /** Series charts (column, line, comparison, area, stacked bar). Comparison shows at most 12 bars (MC-41). */
  points?: MicroChartPoint[];
  /** Line: up to three lines, one per measure (MC-35); replaces `points`. */
  lines?: MicroChartPoint[][];
  /** Line: a threshold line (MC-39). */
  threshold?: number;
  /** Line: show the data points (MC-37; default false). */
  showPoints?: boolean;
  /** Area: threshold areas (MC-47). */
  areaThresholds?: MicroChartAreaThresholds;
  /** Area: 'wide' puts the labels before and after the chart (MC-49). */
  view?: 'normal' | 'wide';
  /** Delta: names (or dates) of the two values, the optional left labels (MC-62). */
  titles?: [string, string];
  /** Column: a value label on every column when the columns are wide enough and the chart is at least 72 px high (MC-31). */
  columnLabels?: boolean;
  /** Line: indexes of focus points of the first line, e.g. [0, n - 1] for the first and last value (MC-38). */
  focusPoints?: number[];
  /** Line: show the threshold value next to the threshold line (MC-39). */
  thresholdLabel?: boolean;
  /** Area: the smallest and largest value as extra labels (MC-48). */
  minMaxLabels?: boolean;
  /** Line, column, area: a fixed scale, so that the charts of a table column are comparable (MC-40). */
  scaleMin?: number;
  scaleMax?: number;
  /** Formats numbers for the text alternative (default Intl.NumberFormat of the locale). */
  format?(n: number): string;
  /** Formats the visible number labels (default: short form of the locale, e.g. "6.7M", MC-13). */
  formatLabel?(n: number): string;
  /** Render nothing when there is no data (table cells, MC-06); otherwise a "No data" placeholder (MC-05). */
  hideOnNoData?: boolean;
  /** @deprecated The size follows the container (MC-02); ignored. */
  size?: 'S' | 'M';
  /** When set, the chart is a button (Enter / Space / click). Not used for the "No data" placeholder. */
  onPress?(): void;
}

/** Maximum number of bars of a comparison chart (MC-41). */
export const MICRO_COMPARISON_MAX = 12;
/** Approximate width (px) of one label character, for choosing the column label mode before rendering. */
const CHAR_WIDTH = 7;
/** Below this height (px) the labels are hidden (MC-27, MC-36, MC-53, MC-57, MC-63). */
export const MICRO_LABEL_MIN_HEIGHT = 56;

const CRITICALITY: Record<number, string> = { 0: 'neutral', 1: 'negative', 2: 'critical', 3: 'positive', 5: 'info' };
export const criticalityClass = (c: number | undefined) => (c === undefined || CRITICALITY[c] === undefined ? '' : `sk-chart--${CRITICALITY[c]}`);
const paletteClass = (n: number | undefined) => `sk-chart--palette-${n !== undefined && Number.isInteger(n) && n >= 1 && n <= 11 ? n : 1}`;
const cx = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(' ');
const finite = (n: number | undefined): n is number => typeof n === 'number' && Number.isFinite(n);
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

interface Rendered { body: ReactNode; aria: string }
interface Ctx { t: TextFn; fmt: (n: number) => string; short: (n: number) => string; pct: (f: number) => string; compact: boolean; w?: number; h?: number }

/** Whether the chart has something to draw (false: "No data", MC-05 / MC-06). */
export function microChartHasData(p: Pick<MicroChartProps, 'kind' | 'value' | 'target' | 'max' | 'points' | 'lines'>): boolean {
  switch (p.kind) {
    case 'bullet': return finite(p.value);
    case 'radial': return finite(p.value) && (p.target === undefined || (finite(p.target) && p.target > 0));
    case 'harvey': { const total = finite(p.max) ? p.max : p.target; return finite(p.value) && finite(total) && total > 0; }
    case 'delta': return finite(p.value) && finite(p.target);
    case 'line': return (p.lines ?? [p.points ?? []]).some((l) => l.some((pt) => finite(pt.value)));
    case 'stackedBar': return (p.points ?? []).some((pt) => finite(pt.value) && pt.value > 0);
    default: return (p.points ?? []).some((pt) => finite(pt.value));
  }
}

/** Content box of the element, updated on resize (undefined without ResizeObserver: everything is shown). The root
 * element changes (placeholder → chart, span → button), so the observer follows the element, not a ref object. */
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

export function MicroChart(p: MicroChartProps) {
  const { t, intlLocale } = useSmartKit();
  const [el, ref] = useState<HTMLElement | null>(null);
  const box = useBox(el);
  useFitLabels(el);
  const numberFormat = useMemo(() => new Intl.NumberFormat(intlLocale, { maximumFractionDigits: 2 }), [intlLocale]);
  const shortFormat = useMemo(() => new Intl.NumberFormat(intlLocale, { notation: 'compact', maximumFractionDigits: 1 }), [intlLocale]);
  const percentFormat = useMemo(() => new Intl.NumberFormat(intlLocale, { style: 'percent', maximumFractionDigits: 0 }), [intlLocale]);
  // Stacked bar percentages: precision 1 (MC-59).
  const percent1Format = useMemo(() => new Intl.NumberFormat(intlLocale, { style: 'percent', maximumFractionDigits: 1 }), [intlLocale]);
  const ctx: Ctx = {
    t,
    fmt: p.format ?? ((n: number) => numberFormat.format(n)),
    short: p.formatLabel ?? ((n: number) => shortFormat.format(n)),
    pct: (f: number) => percentFormat.format(f),
    compact: box !== undefined && box.h < MICRO_LABEL_MIN_HEIGHT,
    w: box?.w,
    h: box?.h,
  };
  const r = microChartHasData(p) ? (p.kind === 'stackedBar' ? stackedBar(p, ctx, (f) => percent1Format.format(f)) : renderKind(p, ctx)) : undefined;
  if (!r) {
    if (p.hideOnNoData) return null;
    // MC-05: a placeholder of the chart's size; focusable, never pressable, no labels.
    return (
      <span ref={ref} className={cx('sk-microchart', `sk-microchart--${p.kind}`, 'sk-microchart--nodata')} role="img" aria-label={t('chart.noDataFor', { label: p.label })} tabIndex={0} data-sk-microchart={p.kind}>
        <span className="sk-microchart__nodata" aria-hidden>{t('chart.noData')}</span>
      </span>
    );
  }
  // Default colours: semantic charts start neutral (bullet, radial, column, comparison, MC-22, MC-33); Harvey Ball uses the
  // qualitative palette (MC-56); line and area are blue (MC-40).
  const mark = p.criticality !== undefined && p.kind !== 'delta' ? criticalityClass(p.criticality) : p.kind === 'harvey' ? paletteClass(p.color) : ['bullet', 'radial', 'column', 'comparison'].includes(p.kind) ? 'sk-chart--neutral' : '';
  const className = cx('sk-microchart', `sk-microchart--${p.kind}`, ctx.compact && 'sk-microchart--compact', mark);
  const inner = <span className="sk-microchart__frame" aria-hidden>{r.body}</span>;
  if (p.onPress) {
    return (
      <button ref={ref} type="button" className={cx(className, 'sk-microchart--pressable')} data-sk-microchart={p.kind} onClick={() => p.onPress?.()}>
        {/* The name comes from the content (not aria-label), so it never conflicts with the visible numbers. */}
        <span className="sk-visually-hidden">{r.aria}</span>
        {inner}
      </button>
    );
  }
  return <span ref={ref} className={className} role="img" aria-label={r.aria} data-sk-microchart={p.kind}>{inner}</span>;
}

function renderKind(p: MicroChartProps, c: Ctx): Rendered | undefined {
  switch (p.kind) {
    case 'bullet': return bullet(p, c);
    case 'radial': return radial(p, c);
    case 'harvey': return harvey(p, c);
    case 'delta': return delta(p, c);
    case 'column': return column(p, c);
    case 'line': return line(p, c);
    case 'comparison': return comparison(p, c);
    case 'area': return area(p, c);
    case 'stackedBar': return undefined;
  }
}

/** The values plus the fixed scale ends, if any (MC-40). */
const withScale = (p: MicroChartProps, values: number[]) => [...values, ...(finite(p.scaleMin) ? [p.scaleMin] : []), ...(finite(p.scaleMax) ? [p.scaleMax] : [])];

/** Linear scale of [lo, hi] (always containing 0 when `withZero`) onto [0, 100]. */
function scale(values: number[], withZero = true) {
  let lo = Math.min(...values, ...(withZero ? [0] : []));
  let hi = Math.max(...values, ...(withZero ? [0] : []));
  // All values equal: with zero the bar starts at zero; without, the value sits in the middle.
  if (hi <= lo) { if (withZero) { hi = lo + 1; lo = Math.min(lo, 0); } else { lo -= 0.5; hi += 0.5; } }
  return (v: number) => ((v - lo) / (hi - lo)) * 100;
}

const seriesPoints = (p: MicroChartProps) => (p.points ?? []).filter((pt) => finite(pt.value));
const seriesAria = (p: MicroChartProps, t: TextFn, fmt: (n: number) => string, pts: MicroChartPoint[], states = false) =>
  t('chart.series', { label: p.label, points: pts.map((pt) => t('chart.seriesItem', { name: pt.label, value: fmt(pt.value) }) + (states ? state(t, pt.criticality) : '')).join(t('chart.listSeparator')) });
const signed = (fmt: (n: number) => string, n: number) => (n > 0 ? `+${fmt(n)}` : fmt(n));

const STATE_KEY = { 0: 'chart.state.neutral', 1: 'chart.state.negative', 2: 'chart.state.critical', 3: 'chart.state.positive', 5: 'chart.state.info' } as const;
/** The semantic state in words for the text alternative, e.g. " (Good)" (colour is not the only carrier, WCAG 1.4.1). */
const state = (t: TextFn, c: MicroChartCriticality | undefined) => (c === undefined ? '' : ` (${t(STATE_KEY[c])})`);

/** A number label that is hidden (not cut) when it does not fit (MC-04). */
const Num = ({ className, children, style }: { className?: string; children: ReactNode; style?: CSSProperties }) => <span className={className} style={style} data-sk-num>{children}</span>;

function bullet(p: MicroChartProps, { t, fmt, short, compact }: Ctx): Rendered | undefined {
  if (!finite(p.value)) return undefined;
  const value = p.value;
  const target = finite(p.target) ? p.target : undefined;
  const isDelta = p.mode === 'delta' && target !== undefined;
  const forecast = !isDelta && finite(p.forecast) ? p.forecast : undefined;
  const thresholds = (p.thresholds ?? []).filter((th) => finite(th.value));
  const all = [value, ...(target !== undefined ? [target] : []), ...(forecast !== undefined ? [forecast] : []), ...thresholds.map((th) => th.value)];
  const min = finite(p.min) ? p.min : Math.min(0, ...all);
  let max = finite(p.max) ? p.max : Math.max(...all);
  if (max <= min) max = min + 1;
  const x = (v: number) => clamp01((v - min) / (max - min)) * 100;
  const origin = isDelta ? x(target!) : x(Math.min(Math.max(0, min), max));
  const xv = x(value);
  const span = (a: number, b: number) => ({ x: Math.min(a, b), width: Math.max(Math.abs(b - a), 0.5) });
  const sep = t('chart.listSeparator');
  const parts = [
    (isDelta ? t('chart.difference', { value: signed(fmt, value - target!) }) : t('chart.actual', { value: fmt(value) })) + state(t, p.criticality),
    ...(target !== undefined ? [t('chart.target', { value: fmt(target) })] : []),
    ...(forecast !== undefined ? [t('chart.forecast', { value: fmt(forecast) })] : []),
    ...(thresholds.length ? [t('chart.thresholds', { values: thresholds.map((th) => fmt(th.value)).join(sep) })] : []),
  ];
  // A label placed at a position along the bar: left-aligned at 0 %, centred in the middle, right-aligned at 100 %.
  const at = (pos: number) => ({ left: `${pos}%`, transform: `translateX(-${pos}%)` });
  return {
    aria: t('chart.parts', { label: p.label, parts: parts.join(sep) }),
    body: (
      <>
        {/* MC-21, MC-27: the actual value above the bar at its end, the target below at the marker; none below 56 px. */}
        {!compact && (
          <span className="sk-microchart__lane" data-sk-fit>
            <Num className="sk-microchart__value sk-microchart__value--mark sk-microchart__placed" style={at(xv)}>{isDelta ? signed(short, value - target!) : short(value)}</Num>
          </span>
        )}
        <svg className="sk-microchart__plot" viewBox="0 0 100 20" preserveAspectRatio="none" focusable="false">
          <rect className="sk-microchart__track" x={0} y={4} width={100} height={12} />
          {forecast !== undefined && <rect className="sk-microchart__mark sk-microchart__forecast" data-sk-microchart-bar="forecast" {...span(origin, x(forecast))} y={4} height={12} />}
          <rect className="sk-microchart__mark" data-sk-microchart-bar={isDelta ? 'delta' : 'value'} {...span(origin, xv)} y={7} height={6} />
          {/* MC-25: thresholds are short lines across the bar in their semantic colour. */}
          {thresholds.map((th, i) => (
            <rect key={i} className={cx('sk-microchart__threshold', criticalityClass(th.criticality))} data-sk-microchart-bar="threshold" x={Math.min(99.4, Math.max(0, x(th.value) - 0.3))} y={2} width={0.6} height={16} />
          ))}
          {target !== undefined && <rect className="sk-microchart__target" data-sk-microchart-bar="target" x={Math.min(99, Math.max(0, x(target) - 0.75))} y={0} width={1.5} height={20} />}
        </svg>
        {!compact && target !== undefined && (
          <span className="sk-microchart__lane" data-sk-fit>
            <Num className="sk-microchart__placed" style={at(x(target))}>{short(target)}</Num>
          </span>
        )}
      </>
    ),
  };
}

function radial(p: MicroChartProps, { t, pct, compact }: Ctx): Rendered | undefined {
  // MC-51: without a target the value is the percentage itself (total 100).
  const total = p.target === undefined ? 100 : p.target;
  if (!finite(p.value) || !finite(total) || total <= 0) return undefined;
  const f = clamp01(p.value / total);
  const text = pct(p.value / total);
  // MC-53: below the S size the percentage moves to the right of the ring; hidden when there is no room.
  const label = <span className={compact ? 'sk-microchart__side' : 'sk-microchart__center'} data-sk-fit><Num>{text}</Num></span>;
  return {
    aria: t('chart.percent', { label: p.label, percent: text }) + state(t, p.criticality),
    body: (
      <>
        <span className="sk-microchart__ring">
          <svg className="sk-microchart__circle" viewBox="0 0 40 40" focusable="false">
            <circle className="sk-microchart__ring-track" cx={20} cy={20} r={17} strokeWidth={6} pathLength={100} />
            {f > 0 && <circle className="sk-microchart__ring-mark" data-sk-microchart-bar="value" cx={20} cy={20} r={17} strokeWidth={6} pathLength={100} strokeDasharray={`${f * 100} 100`} transform="rotate(-90 20 20)" />}
          </svg>
          {!compact && label}
        </span>
        {compact && label}
      </>
    ),
  };
}

function harvey(p: MicroChartProps, { t, fmt, short, compact }: Ctx): Rendered | undefined {
  // MC-55: the total is MaximumValue.
  const total = finite(p.max) ? p.max : p.target;
  if (!finite(p.value) || !finite(total) || total <= 0) return undefined;
  const f = clamp01(p.value / total);
  const a = f * 2 * Math.PI;
  // The slice is inset from the background circle (as in the SAP chart).
  const r = 16.5;
  const ex = 20 + r * Math.sin(a);
  const ey = 20 - r * Math.cos(a);
  const sector = f >= 1
    ? <circle className="sk-microchart__mark" data-sk-microchart-bar="value" cx={20} cy={20} r={r} />
    : f > 0 && <path className="sk-microchart__mark" data-sk-microchart-bar="value" d={`M20 20 L20 ${20 - r} A${r} ${r} 0 ${f > 0.5 ? 1 : 0} 1 ${ex.toFixed(3)} ${ey.toFixed(3)} Z`} />;
  return {
    aria: t('chart.valueOf', { label: p.label, value: fmt(p.value), target: fmt(total) }) + state(t, p.criticality),
    body: (
      <>
        <svg className="sk-microchart__circle" viewBox="0 0 40 40" focusable="false">
          <circle className="sk-microchart__track" cx={20} cy={20} r={18} />
          {sector}
        </svg>
        {/* MC-57: small charts keep only the slice label. */}
        <span className="sk-microchart__texts sk-microchart__texts--stack" data-sk-fit>
          <Num className="sk-microchart__value sk-microchart__value--mark sk-microchart__value--large">{short(p.value)}</Num>
          {!compact && <Num>{short(total)}</Num>}
        </span>
      </>
    ),
  };
}

function delta(p: MicroChartProps, { t, fmt, short, compact }: Ctx): Rendered | undefined {
  if (!finite(p.value) || !finite(p.target)) return undefined;
  const v1 = p.value;
  const v2 = p.target;
  const d = v1 - v2;
  const x = scale([v1, v2]);
  const z = x(0);
  const deltaClass = p.criticality === undefined ? 'sk-chart--neutral' : criticalityClass(p.criticality);
  const span = (a: number, b: number) => ({ x: Math.min(a, b), width: Math.max(Math.abs(b - a), 0.5) });
  const titles = p.titles;
  // MC-62, MC-63 (SAP anatomy): value 1 on top, the delta in the middle, value 2 below; names on the left, values on the
  // right; below 56 px only the delta value stays.
  const row = (title: string | undefined, value: number) => (
    <span className="sk-microchart__texts" data-sk-fit>
      <span className="sk-microchart__muted sk-microchart__title" title={title}>{title ?? ''}</span>
      <Num>{short(value)}</Num>
    </span>
  );
  return {
    aria: t('chart.delta', { label: p.label, value1: `${titles?.[0] ? `${titles[0]} ` : ''}${fmt(v1)}`, value2: `${titles?.[1] ? `${titles[1]} ` : ''}${fmt(v2)}`, delta: signed(fmt, d) }) + state(t, p.criticality),
    body: (
      <span className="sk-microchart__delta-grid">
        {!compact && row(titles?.[0], v1)}
        <span className="sk-microchart__delta-body">
          <svg className="sk-microchart__plot" viewBox="0 0 100 30" preserveAspectRatio="none" focusable="false">
            <rect className="sk-microchart__mark sk-microchart__mark--plain" data-sk-microchart-bar="value1" {...span(z, x(v1))} y={1} height={4} />
            <rect className={cx('sk-microchart__mark', deltaClass)} data-sk-microchart-bar="delta" {...span(x(v1), x(v2))} y={10} height={10} />
            <rect className="sk-microchart__mark sk-microchart__mark--plain" data-sk-microchart-bar="value2" {...span(z, x(v2))} y={25} height={4} />
            <line className="sk-microchart__connector" x1={x(v1)} x2={x(v1)} y1={1} y2={20} vectorEffect="non-scaling-stroke" />
            <line className="sk-microchart__connector" x1={x(v2)} x2={x(v2)} y1={10} y2={29} vectorEffect="non-scaling-stroke" />
          </svg>
          <span data-sk-fit className="sk-microchart__delta-value"><Num className={cx('sk-microchart__value', 'sk-microchart__delta', deltaClass)}>{signed(short, d)}</Num></span>
        </span>
        {!compact && row(titles?.[1], v2)}
      </span>
    ),
  };
}

/** A pair of labels at the two ends; hidden together when one does not fit (MC-04). */
function edgeLabels(first: ReactNode, last: ReactNode, kind: 'top' | 'bottom', crit?: [MicroChartCriticality | undefined, MicroChartCriticality | undefined]) {
  // Area: the start and end values carry their semantic colour (SAP anatomy).
  return (
    <span className={cx('sk-microchart__edges', `sk-microchart__edges--${kind}`)} data-sk-fit>
      <Num className={crit ? cx(criticalityClass(crit[0]), crit[0] !== undefined && 'sk-microchart__value--mark') : undefined}>{first}</Num>
      <Num className={crit ? cx(criticalityClass(crit[1]), crit[1] !== undefined && 'sk-microchart__value--mark') : undefined}>{last}</Num>
    </span>
  );
}

function column(p: MicroChartProps, { t, fmt, short, compact, w, h }: Ctx): Rendered | undefined {
  const pts = seriesPoints(p);
  if (!pts.length) return undefined;
  const y = scale(withScale(p, pts.map((pt) => pt.value)));
  // MC-31, MC-32: a label per column from 72 px height when every column is at least as wide as its label (about one
  // character width per character); otherwise the first and last values.
  const longest = Math.max(...pts.map((pt) => short(pt.value).length));
  const perColumn = Boolean(p.columnLabels) && !compact && (h === undefined || h >= 72) && (w === undefined || w / pts.length >= longest * CHAR_WIDTH);
  const base = 100 - y(0);
  const band = 100 / pts.length;
  const first = pts[0]!;
  const last = pts[pts.length - 1]!;
  return {
    aria: seriesAria(p, t, fmt, pts),
    body: (
      <>
        {/* MC-31: top labels are the first and last values (or one per column), bottom labels the first and last dimension values. */}
        {!compact && !perColumn && edgeLabels(short(first.value), pts.length > 1 ? short(last.value) : '', 'top')}
        {perColumn && (
          <span className="sk-microchart__column-labels" data-sk-fit>
            {pts.map((pt, i) => <Num key={i} className={cx(criticalityClass(pt.criticality), pt.criticality !== undefined && 'sk-microchart__value--mark')}>{short(pt.value)}</Num>)}
          </span>
        )}
        <svg className="sk-microchart__plot" viewBox="0 0 100 100" preserveAspectRatio="none" focusable="false">
          {pts.map((pt, i) => {
            const top = 100 - y(pt.value);
            return <rect key={i} className={cx('sk-microchart__mark', criticalityClass(pt.criticality))} data-sk-microchart-bar={i} x={i * band + band * 0.1} y={Math.min(top, base)} width={band * 0.8} height={Math.max(Math.abs(base - top), 0.5)} />;
          })}
          <line className="sk-microchart__baseline" x1={0} x2={100} y1={base} y2={base} vectorEffect="non-scaling-stroke" />
        </svg>
        {!compact && edgeLabels(first.label, pts.length > 1 ? last.label : '', 'bottom')}
      </>
    ),
  };
}

function line(p: MicroChartProps, { t, fmt, short, compact }: Ctx): Rendered | undefined {
  // MC-35: up to three lines, one per measure.
  const lines = (p.lines ?? [p.points ?? []]).slice(0, 3).map((l) => l.filter((pt) => finite(pt.value))).filter((l) => l.length);
  if (!lines.length) return undefined;
  const threshold = finite(p.threshold) ? p.threshold : undefined;
  const y = scale(withScale(p, [...lines.flat().map((pt) => pt.value), ...(threshold !== undefined ? [threshold] : [])]), false);
  const n = Math.max(...lines.map((l) => l.length));
  const xs = (i: number) => (n === 1 ? 50 : 2 + (i / (n - 1)) * 96);
  const ys = (v: number) => 95 - y(v) * 0.9;
  const multi = lines.length > 1;
  // MC-37, MC-38: points are hidden by default; points with a semantic colour are always shown (except in the smallest size).
  // A line of one point is drawn as that point.
  const focus = new Set(p.focusPoints ?? []);
  const dots = (pt: MicroChartPoint, l: MicroChartPoint[], li: number, i: number) => l.length === 1 || (!compact && (p.showPoints || pt.criticality !== undefined || (li === 0 && focus.has(i))));
  // MC-36: with several lines the start label is the smallest first value, the end label the largest last value.
  const firsts = lines.map((l) => l[0]!.value);
  const lasts = lines.map((l) => l[l.length - 1]!.value);
  const startValue = multi ? Math.min(...firsts) : firsts[0]!;
  const endValue = multi ? Math.max(...lasts) : lasts[0]!;
  const dims = lines[0]!;
  const aria = multi
    ? t('chart.series', { label: p.label, points: lines.map((l, i) => `${t('chart.line', { n: i + 1 })} ${l.map((pt) => t('chart.seriesItem', { name: pt.label, value: fmt(pt.value) })).join(t('chart.listSeparator'))}`).join('; ') })
    : seriesAria(p, t, fmt, dims);
  return {
    aria,
    body: (
      <>
        {!compact && edgeLabels(short(startValue), n > 1 ? short(endValue) : '', 'top')}
        <span className="sk-microchart__plot-box">
        <svg className="sk-microchart__plot" viewBox="0 0 100 100" preserveAspectRatio="none" focusable="false">
          {threshold !== undefined && <line className="sk-microchart__threshold-line" data-sk-microchart-bar="threshold" x1={0} x2={100} y1={ys(threshold)} y2={ys(threshold)} vectorEffect="non-scaling-stroke" />}
          {lines.map((l, li) => (
            <g key={li} className={multi ? paletteClass(li + 1) : undefined} data-sk-microchart-line={li}>
              <polyline className="sk-microchart__line" points={l.map((pt, i) => `${xs(i).toFixed(2)},${ys(pt.value).toFixed(2)}`).join(' ')} vectorEffect="non-scaling-stroke" />
              {/* Zero-length round-capped lines draw undistorted dots under preserveAspectRatio="none". */}
              {l.map((pt, i) => dots(pt, l, li, i) && (
                <line key={i} className={cx('sk-microchart__dot', li === 0 && focus.has(i) && 'sk-microchart__dot--focus', criticalityClass(pt.criticality))} data-sk-microchart-bar={`${li}-${i}`} x1={xs(i)} x2={xs(i)} y1={ys(pt.value)} y2={ys(pt.value)} vectorEffect="non-scaling-stroke" />
              ))}
            </g>
          ))}
        </svg>
        {/* MC-39: the threshold value next to its line; hidden when it would take more than half the width. */}
        {threshold !== undefined && p.thresholdLabel && !compact && (
          <span className="sk-microchart__threshold-label" data-sk-fit style={{ top: `${ys(threshold)}%` }}>
            <Num className="sk-microchart__muted">{short(threshold)}</Num>
          </span>
        )}
        </span>
        {!compact && edgeLabels(dims[0]!.label, n > 1 ? dims[dims.length - 1]!.label : '', 'bottom')}
      </>
    ),
  };
}

function comparison(p: MicroChartProps, { t, fmt, short, w }: Ctx): Rendered | undefined {
  const pts = seriesPoints(p).slice(0, MICRO_COMPARISON_MAX);
  if (!pts.length) return undefined;
  const lo = Math.min(0, ...(finite(p.min) ? [p.min] : []), ...pts.map((pt) => pt.value));
  const hi = Math.max(0, ...(finite(p.max) ? [p.max] : []), ...pts.map((pt) => pt.value));
  const x = scale([lo, hi]);
  const z = x(0);
  // MC-42: wider than 192 px: labels on both sides; up to 96 px: no labels; otherwise the labels sit above each bar.
  const layout = w === undefined || w > 192 ? 'wide' : w > 96 ? 'normal' : 'bare';
  return {
    aria: seriesAria(p, t, fmt, pts, true),
    body: (
      <span className={cx('sk-microchart__rows', `sk-microchart__rows--${layout}`)}>
        {pts.map((pt, i) => {
          const bar = (
            <svg className="sk-microchart__row-plot" viewBox="0 0 100 10" preserveAspectRatio="none" focusable="false">
              <rect className="sk-microchart__track" x={0} y={0} width={100} height={10} />
              <rect className={cx('sk-microchart__mark', criticalityClass(pt.criticality))} data-sk-microchart-bar={i} x={Math.min(z, x(pt.value))} y={0} width={Math.max(Math.abs(x(pt.value) - z), 0.5)} height={10} />
            </svg>
          );
          if (layout === 'bare') return <span key={i} className="sk-microchart__row">{bar}</span>;
          const name = <span className="sk-microchart__row-label" title={pt.label}>{pt.label}</span>;
          // The value label has the bar's semantic colour (SAP anatomy).
          const value = <span data-sk-fit className={cx('sk-microchart__row-fit', criticalityClass(pt.criticality))}><Num className="sk-microchart__row-value">{short(pt.value)}</Num></span>;
          return layout === 'wide'
            ? <span key={i} className="sk-microchart__row">{name}{bar}{value}</span>
            : <span key={i} className="sk-microchart__row"><span className="sk-microchart__row-head">{name}{value}</span>{bar}</span>;
        })}
      </span>
    ),
  };
}

/** The chart area between two boundary curves (values per point), as an SVG polygon. */
function band(xs: (i: number) => number, ys: (v: number) => number, lower: number[], upper: number[]) {
  const top = upper.map((v, i) => `${xs(i).toFixed(2)},${ys(v).toFixed(2)}`);
  const bottom = lower.map((v, i) => `${xs(i).toFixed(2)},${ys(v).toFixed(2)}`).reverse();
  return [...top, ...bottom].join(' ');
}

function area(p: MicroChartProps, { t, fmt, short, compact, h }: Ctx): Rendered | undefined {
  const pts = seriesPoints(p);
  if (!pts.length) return undefined;
  const targets = pts.map((pt) => pt.target).filter(finite);
  const th = p.areaThresholds;
  const curves = th ? [th.deviationLow, th.toleranceLow, th.toleranceHigh, th.deviationHigh].filter((c): c is number[] => Array.isArray(c)).map((c) => c.filter(finite)) : [];
  const all = withScale(p, [...pts.map((pt) => pt.value), ...targets, ...curves.flat()]);
  const lo = Math.min(...all);
  let hi = Math.max(...all);
  if (hi <= lo) hi = lo + 1;
  const ys = (v: number) => 100 - ((Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo)) * 100;
  const n = pts.length;
  const xs = (i: number) => (n === 1 ? 50 : (i / (n - 1)) * 100);
  const flat = (v: number) => pts.map(() => v);
  const at = (c: number[] | undefined) => (c && c.length === n && c.every(finite) ? c : undefined);
  // MC-47: threshold areas from the improvement direction; a missing boundary merges the two areas next to it.
  const bands: { lower: number[]; upper: number[]; tone: string }[] = [];
  if (th) {
    const stops: { curve: number[] | undefined; tone: string }[] = th.direction === 'Maximize'
      ? [{ curve: at(th.deviationLow), tone: 'negative' }, { curve: at(th.toleranceLow), tone: 'critical' }, { curve: flat(hi), tone: 'positive' }]
      : th.direction === 'Minimize'
        ? [{ curve: at(th.toleranceHigh), tone: 'positive' }, { curve: at(th.deviationHigh), tone: 'critical' }, { curve: flat(hi), tone: 'negative' }]
        : [{ curve: at(th.deviationLow), tone: 'negative' }, { curve: at(th.toleranceLow), tone: 'critical' }, { curve: at(th.toleranceHigh), tone: 'positive' }, { curve: at(th.deviationHigh), tone: 'critical' }, { curve: flat(hi), tone: 'negative' }];
    let lower = flat(lo);
    for (const s of stops) {
      if (!s.curve) continue;
      bands.push({ lower, upper: s.curve, tone: s.tone });
      lower = s.curve;
    }
  }
  const wide = p.view === 'wide';
  // MC-48: labels hidden below 56 px (normal) or 36 px (wide).
  const showLabels = h === undefined || h >= (wide ? 36 : MICRO_LABEL_MIN_HEIGHT);
  const first = pts[0]!;
  const last = pts[n - 1]!;
  const sep = t('chart.listSeparator');
  const aria = [seriesAria(p, t, fmt, pts), ...(targets.length === n ? [t('chart.target', { value: pts.map((pt) => fmt(pt.target!)).join(sep) })] : [])].join(sep);
  const plot = (
    <svg className="sk-microchart__plot" viewBox="0 0 100 100" preserveAspectRatio="none" focusable="false">
      {bands.map((b, i) => <polygon key={i} className={`sk-microchart__band sk-microchart__band--${b.tone}`} data-sk-microchart-bar={`band-${b.tone}`} points={band(xs, ys, b.lower, b.upper)} />)}
      {targets.length === n && <polyline className="sk-microchart__line sk-microchart__line--target" data-sk-microchart-bar="target" points={pts.map((pt, i) => `${xs(i).toFixed(2)},${ys(pt.target!).toFixed(2)}`).join(' ')} vectorEffect="non-scaling-stroke" />}
      <polyline className="sk-microchart__line" data-sk-microchart-bar="actual" points={pts.map((pt, i) => `${xs(i).toFixed(2)},${ys(pt.value).toFixed(2)}`).join(' ')} vectorEffect="non-scaling-stroke" />
    </svg>
  );
  if (wide) {
    const side = (pt: MicroChartPoint) => (
      <span className="sk-microchart__texts sk-microchart__texts--stack" data-sk-fit>
        <Num className="sk-microchart__value">{short(pt.value)}</Num>
        <Num className="sk-microchart__muted">{pt.label}</Num>
      </span>
    );
    return { aria, body: <span className="sk-microchart__wide">{showLabels && side(first)}{plot}{showLabels && side(last)}</span> };
  }
  void compact;
  // MC-48: optional minimum and maximum labels; then each label takes a third of the width.
  if (showLabels && p.minMaxLabels && n > 2) {
    const values = pts.map((pt) => pt.value);
    const row = (items: ReactNode[], kind: string) => (
      <span className={cx('sk-microchart__edges', 'sk-microchart__edges--thirds', `sk-microchart__edges--${kind}`)} data-sk-fit>
        {items.map((it, i) => <Num key={i}>{it}</Num>)}
      </span>
    );
    return {
      aria,
      body: (
        <>
          {row([short(first.value), short(Math.max(...values)), short(last.value)], 'top')}
          {plot}
          {row([first.label, short(Math.min(...values)), last.label], 'bottom')}
        </>
      ),
    };
  }
  return {
    aria,
    body: (
      <>
        {showLabels && edgeLabels(short(first.value), n > 1 ? short(last.value) : '', 'top', [first.criticality, last.criticality])}
        {plot}
        {showLabels && edgeLabels(first.label, n > 1 ? last.label : '', 'bottom')}
      </>
    ),
  };
}

function stackedBar(p: MicroChartProps, { t, fmt, compact }: Ctx, pct1: (f: number) => string): Rendered | undefined {
  // MC-58: no negative values.
  const pts = seriesPoints(p).filter((pt) => pt.value > 0);
  if (!pts.length) return undefined;
  const sum = pts.reduce((s, pt) => s + pt.value, 0);
  // MC-59: with a maximum the full length is the maximum; otherwise 100 % of the sum.
  const total = finite(p.max) && p.max > 0 ? Math.max(p.max, sum) : sum;
  return {
    aria: t('chart.series', { label: p.label, points: pts.map((pt) => t('chart.seriesItem', { name: pt.label, value: `${fmt(pt.value)} (${pct1(pt.value / total)})` })).join(t('chart.listSeparator')) }),
    body: (
      <span className="sk-microchart__stack">
        {pts.map((pt, i) => (
          <span key={i} className={cx('sk-microchart__segment', pt.criticality !== undefined ? criticalityClass(pt.criticality) : paletteClass(pt.color ?? i + 1))} data-sk-microchart-bar={i} style={{ width: `${(pt.value / total) * 100}%` }} title={pt.label}>
            {!compact && <span data-sk-fit className="sk-microchart__segment-label"><Num>{pt.display ?? pct1(pt.value / total)}</Num></span>}
          </span>
        ))}
      </span>
    ),
  };
}
