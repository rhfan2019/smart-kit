/**
 * MicroChart: the seven micro chart facets of the object page header (ADR-021): inline SVG, colours from
 * tokens through CSS classes, one text alternative for the whole chart (role="img", or a button when pressable).
 */
import { useMemo, type ReactNode } from 'react';
import { useSmartKit } from '../context/SmartKitProvider';
import type { TextFn } from '../i18n/text';

export type MicroChartKind = 'bullet' | 'radial' | 'harvey' | 'delta' | 'column' | 'line' | 'comparison';
export type MicroChartCriticality = 0 | 1 | 2 | 3 | 5;
export interface MicroChartPoint { label: string; value: number; criticality?: MicroChartCriticality }

export interface MicroChartProps {
  kind: MicroChartKind;
  /** Accessible name, e.g. the facet title. */
  label: string;
  /** Single-value charts (bullet, radial, harvey, delta value 1). */
  value?: number;
  /** Bullet target, radial / harvey total (maximum), delta value 2. */
  target?: number;
  /** Bullet scale start (default 0). */
  min?: number;
  /** Bullet scale end (default max(value, target) × 1.1). */
  max?: number;
  criticality?: MicroChartCriticality;
  /** Series charts (column, line, comparison). Comparison shows the first four points. */
  points?: MicroChartPoint[];
  /** Formats numbers for the text alternative and the visible labels (default Intl.NumberFormat of the locale). */
  format?(n: number): string;
  /** 'M' (default, header facet) or 'S' (table cells). */
  size?: 'S' | 'M';
  /** When set, the chart is a button (Enter / Space / click). */
  onPress?(): void;
}

/** Maximum number of bars of a comparison chart. */
export const MICRO_COMPARISON_MAX = 4;

const CRITICALITY: Record<number, string> = { 0: 'neutral', 1: 'negative', 2: 'critical', 3: 'positive', 5: 'info' };
export const criticalityClass = (c: number | undefined) => (c === undefined || CRITICALITY[c] === undefined ? '' : `sk-chart--${CRITICALITY[c]}`);
const cx = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(' ');
const finite = (n: number | undefined): n is number => typeof n === 'number' && Number.isFinite(n);
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

interface Rendered { body: ReactNode; aria: string }

export function MicroChart(p: MicroChartProps) {
  const { t, intlLocale } = useSmartKit();
  const size = p.size ?? 'M';
  const numberFormat = useMemo(() => new Intl.NumberFormat(intlLocale, { maximumFractionDigits: 2 }), [intlLocale]);
  const percentFormat = useMemo(() => new Intl.NumberFormat(intlLocale, { style: 'percent', maximumFractionDigits: 0 }), [intlLocale]);
  const fmt = p.format ?? ((n: number) => numberFormat.format(n));
  const pct = (f: number) => percentFormat.format(f);

  const r = renderKind(p, t, fmt, pct) ?? {
    body: <span className="sk-microchart__nodata">{t('chart.noData')}</span>,
    aria: t('chart.noDataFor', { label: p.label }),
  };
  const className = cx('sk-microchart', `sk-microchart--${p.kind}`, `sk-microchart--${size}`, criticalityClass(p.criticality));
  const inner = <span className="sk-microchart__frame" aria-hidden>{r.body}</span>;
  if (p.onPress) {
    return (
      <button type="button" className={cx(className, 'sk-microchart--pressable')} data-sk-microchart={p.kind} onClick={() => p.onPress?.()}>
        {/* The name comes from the content (not aria-label), so it never conflicts with the visible numbers. */}
        <span className="sk-visually-hidden">{r.aria}</span>
        {inner}
      </button>
    );
  }
  return <span className={className} role="img" aria-label={r.aria} data-sk-microchart={p.kind}>{inner}</span>;
}

function renderKind(p: MicroChartProps, t: TextFn, fmt: (n: number) => string, pct: (f: number) => string): Rendered | undefined {
  switch (p.kind) {
    case 'bullet': return bullet(p, t, fmt);
    case 'radial': return radial(p, t, pct);
    case 'harvey': return harvey(p, t, fmt);
    case 'delta': return delta(p, t, fmt);
    case 'column': return column(p, t, fmt);
    case 'line': return line(p, t, fmt);
    case 'comparison': return comparison(p, t, fmt);
  }
}

/** Linear scale of [lo, hi] (always containing 0 when `withZero`) onto [0, 100]. */
function scale(values: number[], withZero = true) {
  let lo = Math.min(...values, ...(withZero ? [0] : []));
  let hi = Math.max(...values, ...(withZero ? [0] : []));
  if (hi <= lo) { hi = lo + 1; lo = withZero ? Math.min(lo, 0) : lo; }
  return (v: number) => ((v - lo) / (hi - lo)) * 100;
}

const seriesPoints = (p: MicroChartProps) => (p.points ?? []).filter((pt) => finite(pt.value));
const seriesAria = (p: MicroChartProps, t: TextFn, fmt: (n: number) => string, pts: MicroChartPoint[]) =>
  t('chart.series', { label: p.label, points: pts.map((pt) => t('chart.seriesItem', { name: pt.label, value: fmt(pt.value) })).join(t('chart.listSeparator')) });

function bullet(p: MicroChartProps, t: TextFn, fmt: (n: number) => string): Rendered | undefined {
  if (!finite(p.value)) return undefined;
  const value = p.value;
  const target = finite(p.target) ? p.target : undefined;
  const min = finite(p.min) ? p.min : 0;
  let max = finite(p.max) ? p.max : Math.max(value, target ?? value) * 1.1;
  if (max <= min) max = min + 1;
  const x = (v: number) => clamp01((v - min) / (max - min)) * 100;
  const zero = x(Math.max(min, 0));
  const xv = x(value);
  return {
    aria: target === undefined ? t('chart.value', { label: p.label, value: fmt(value) }) : t('chart.valueOf', { label: p.label, value: fmt(value), target: fmt(target) }),
    body: (
      <>
        <span className="sk-microchart__texts">
          <span className="sk-microchart__value">{fmt(value)}</span>
          {target !== undefined && <span className="sk-microchart__muted">{fmt(target)}</span>}
        </span>
        <svg className="sk-microchart__plot" viewBox="0 0 100 20" preserveAspectRatio="none" focusable="false">
          <rect className="sk-microchart__track" x={0} y={4} width={100} height={12} />
          <rect className="sk-microchart__mark" data-sk-microchart-bar="value" x={Math.min(zero, xv)} y={7} width={Math.abs(xv - zero)} height={6} />
          {target !== undefined && <rect className="sk-microchart__target" data-sk-microchart-bar="target" x={Math.min(99, Math.max(0, x(target) - 0.75))} y={1} width={1.5} height={18} />}
        </svg>
      </>
    ),
  };
}

function fraction(p: MicroChartProps): number | undefined {
  if (!finite(p.value) || !finite(p.target) || p.target <= 0) return undefined;
  return clamp01(p.value / p.target);
}

function radial(p: MicroChartProps, t: TextFn, pct: (f: number) => string): Rendered | undefined {
  const f = fraction(p);
  if (f === undefined) return undefined;
  const text = pct((p.value as number) / (p.target as number));
  return {
    aria: t('chart.percent', { label: p.label, percent: text }),
    body: (
      <span className="sk-microchart__ring">
        <svg className="sk-microchart__circle" viewBox="0 0 40 40" focusable="false">
          <circle className="sk-microchart__ring-track" cx={20} cy={20} r={16} pathLength={100} />
          {f > 0 && <circle className="sk-microchart__ring-mark" data-sk-microchart-bar="value" cx={20} cy={20} r={16} pathLength={100} strokeDasharray={`${f * 100} 100`} transform="rotate(-90 20 20)" />}
        </svg>
        <span className="sk-microchart__center">{text}</span>
      </span>
    ),
  };
}

function harvey(p: MicroChartProps, t: TextFn, fmt: (n: number) => string): Rendered | undefined {
  const f = fraction(p);
  if (f === undefined) return undefined;
  const a = f * 2 * Math.PI;
  const ex = 20 + 18 * Math.sin(a);
  const ey = 20 - 18 * Math.cos(a);
  const sector = f >= 1
    ? <circle className="sk-microchart__mark" data-sk-microchart-bar="value" cx={20} cy={20} r={18} />
    : f > 0 && <path className="sk-microchart__mark" data-sk-microchart-bar="value" d={`M20 20 L20 2 A18 18 0 ${f > 0.5 ? 1 : 0} 1 ${ex.toFixed(3)} ${ey.toFixed(3)} Z`} />;
  return {
    aria: t('chart.valueOf', { label: p.label, value: fmt(p.value as number), target: fmt(p.target as number) }),
    body: (
      <>
        <svg className="sk-microchart__circle" viewBox="0 0 40 40" focusable="false">
          <circle className="sk-microchart__track" cx={20} cy={20} r={18} />
          {sector}
        </svg>
        <span className="sk-microchart__texts sk-microchart__texts--stack">
          <span className="sk-microchart__value">{fmt(p.value as number)}</span>
          <span className="sk-microchart__muted">{fmt(p.target as number)}</span>
        </span>
      </>
    ),
  };
}

function delta(p: MicroChartProps, t: TextFn, fmt: (n: number) => string): Rendered | undefined {
  if (!finite(p.value) || !finite(p.target)) return undefined;
  const v1 = p.value;
  const v2 = p.target;
  const d = v1 - v2;
  const x = scale([v1, v2]);
  const z = x(0);
  const signed = (n: number) => (n > 0 ? `+${fmt(n)}` : fmt(n));
  const deltaClass = p.criticality === undefined ? (d >= 0 ? 'sk-chart--positive' : 'sk-chart--negative') : criticalityClass(p.criticality);
  const bar = (v: number, y: number, cls: string, key: string) => (
    <rect className={cls} data-sk-microchart-bar={key} x={Math.min(z, x(v))} y={y} width={Math.abs(x(v) - z)} height={8} />
  );
  return {
    aria: t('chart.delta', { label: p.label, value1: fmt(v1), value2: fmt(v2), delta: signed(d) }),
    body: (
      <>
        <svg className="sk-microchart__plot" viewBox="0 0 100 30" preserveAspectRatio="none" focusable="false">
          {bar(v1, 0, 'sk-microchart__mark sk-microchart__mark--plain', 'value1')}
          {bar(v2, 11, 'sk-microchart__mark sk-microchart__mark--plain', 'value2')}
          <rect className={cx('sk-microchart__mark', deltaClass)} data-sk-microchart-bar="delta" x={Math.min(x(v1), x(v2))} y={22} width={Math.abs(x(v1) - x(v2))} height={8} />
        </svg>
        <span className="sk-microchart__texts sk-microchart__texts--stack">
          <span className="sk-microchart__muted">{fmt(v1)}</span>
          <span className="sk-microchart__muted">{fmt(v2)}</span>
          <span className={cx('sk-microchart__value', 'sk-microchart__delta', deltaClass)}>{signed(d)}</span>
        </span>
      </>
    ),
  };
}

function edgeLabels(first: ReactNode, last: ReactNode) {
  return (
    <span className="sk-microchart__edges">
      <span>{first}</span>
      <span>{last}</span>
    </span>
  );
}

function column(p: MicroChartProps, t: TextFn, fmt: (n: number) => string): Rendered | undefined {
  const pts = seriesPoints(p);
  if (!pts.length) return undefined;
  const y = scale(pts.map((pt) => pt.value));
  const base = 100 - y(0);
  const band = 100 / pts.length;
  return {
    aria: seriesAria(p, t, fmt, pts),
    body: (
      <>
        <svg className="sk-microchart__plot sk-microchart__plot--tall" viewBox="0 0 100 100" preserveAspectRatio="none" focusable="false">
          {pts.map((pt, i) => {
            const top = 100 - y(pt.value);
            return <rect key={i} className={cx('sk-microchart__mark', criticalityClass(pt.criticality))} data-sk-microchart-bar={i} x={i * band + band * 0.15} y={Math.min(top, base)} width={band * 0.7} height={Math.max(Math.abs(base - top), 0.5)} />;
          })}
          <line className="sk-microchart__baseline" x1={0} x2={100} y1={base} y2={base} vectorEffect="non-scaling-stroke" />
        </svg>
        {edgeLabels(pts[0]!.label, pts.length > 1 ? pts[pts.length - 1]!.label : '')}
      </>
    ),
  };
}

function line(p: MicroChartProps, t: TextFn, fmt: (n: number) => string): Rendered | undefined {
  const pts = seriesPoints(p);
  if (!pts.length) return undefined;
  const y = scale(pts.map((pt) => pt.value), false);
  const xs = (i: number) => (pts.length === 1 ? 50 : 2 + (i / (pts.length - 1)) * 96);
  const ys = (v: number) => 95 - y(v) * 0.9;
  const coords = pts.map((pt, i) => `${xs(i).toFixed(2)},${ys(pt.value).toFixed(2)}`).join(' ');
  return {
    aria: seriesAria(p, t, fmt, pts),
    body: (
      <>
        <svg className="sk-microchart__plot sk-microchart__plot--tall" viewBox="0 0 100 100" preserveAspectRatio="none" focusable="false">
          <polyline className="sk-microchart__line" points={coords} vectorEffect="non-scaling-stroke" />
          {/* Zero-length round-capped lines draw undistorted dots under preserveAspectRatio="none". */}
          {pts.map((pt, i) => (
            <line key={i} className={cx('sk-microchart__dot', criticalityClass(pt.criticality))} data-sk-microchart-bar={i} x1={xs(i)} x2={xs(i)} y1={ys(pt.value)} y2={ys(pt.value)} vectorEffect="non-scaling-stroke" />
          ))}
        </svg>
        {edgeLabels(fmt(pts[0]!.value), pts.length > 1 ? fmt(pts[pts.length - 1]!.value) : '')}
      </>
    ),
  };
}

function comparison(p: MicroChartProps, t: TextFn, fmt: (n: number) => string): Rendered | undefined {
  const pts = seriesPoints(p).slice(0, MICRO_COMPARISON_MAX);
  if (!pts.length) return undefined;
  const x = scale(pts.map((pt) => pt.value));
  const z = x(0);
  return {
    aria: seriesAria(p, t, fmt, pts),
    body: (
      <span className="sk-microchart__rows">
        {pts.map((pt, i) => (
          <span key={i} className="sk-microchart__row">
            <span className="sk-microchart__row-label">{pt.label}</span>
            <svg className="sk-microchart__row-plot" viewBox="0 0 100 10" preserveAspectRatio="none" focusable="false">
              <rect className={cx('sk-microchart__mark', criticalityClass(pt.criticality))} data-sk-microchart-bar={i} x={Math.min(z, x(pt.value))} y={0} width={Math.max(Math.abs(x(pt.value) - z), 0.5)} height={10} />
            </svg>
            <span className="sk-microchart__row-value">{fmt(pt.value)}</span>
          </span>
        ))}
      </span>
    ),
  };
}
