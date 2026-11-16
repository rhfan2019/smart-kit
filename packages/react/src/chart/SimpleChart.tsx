/**
 * SimpleChart: the list report chart view (ADR-021): one dimension, one measure, column or bar, inline SVG.
 * Bars are buttons with a roving tab stop (Tab enters at the selected or first bar, arrow keys move, Enter / Space select).
 */
import { Skeleton, VisuallyHidden } from '@mantine/core';
import { useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useSmartKit } from '../context/SmartKitProvider';

export interface ChartDatum { key: string; label: string; value: number; formatted?: string }

export interface SimpleChartProps {
  kind: 'column' | 'bar';
  /** Visible title; a visually hidden caption is used when omitted. */
  title?: string;
  measureLabel: string;
  dimensionLabel: string;
  data: ChartDatum[];
  loading?: boolean;
  format?(n: number): string;
  /** Called when a data point is selected (click or Enter / Space on a focused bar); `anchor` is the bar element, e.g. for a popover. */
  onSelect?(d: ChartDatum, anchor: Element): void;
  selectedKey?: string;
  /** Height in pixels (default 320). */
  height?: number;
}

/** Width used until the container has been measured (and in environments without layout). */
const FALLBACK_WIDTH = 640;
/** Approximate glyph width of the small text, for label truncation and margins. */
const CHAR = 7;
const TICK_GAP = 6;

/** 4–6 "nice" ticks covering [min, max] (both extended to include 0). */
export function niceTicks(min: number, max: number, count = 5): number[] {
  let lo = Math.min(0, min);
  let hi = Math.max(0, max);
  if (hi === lo) hi = lo + 1;
  const raw = (hi - lo) / (count - 1);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  lo = Math.floor(lo / step) * step;
  hi = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.abs(v) < step / 1e6 ? 0 : Number(v.toPrecision(12)));
  return ticks;
}

const truncate = (s: string, maxChars: number) => (s.length <= maxChars ? s : `${s.slice(0, Math.max(1, maxChars - 1))}…`);

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(FALLBACK_WIDTH);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => { if (el.clientWidth > 0) setWidth(el.clientWidth); };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const obs = new ResizeObserver(measure);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return [ref, width] as const;
}

export function SimpleChart(p: SimpleChartProps) {
  const { t, intlLocale } = useSmartKit();
  const height = p.height ?? 320;
  const [ref, width] = useWidth();
  const numberFormat = useMemo(() => new Intl.NumberFormat(intlLocale, { maximumFractionDigits: 2 }), [intlLocale]);
  const fmt = p.format ?? ((n: number) => numberFormat.format(n));
  const data = useMemo(() => p.data.filter((d) => Number.isFinite(d.value)), [p.data]);
  const selectedIndex = data.findIndex((d) => d.key === p.selectedKey);
  const [active, setActive] = useState(-1);
  const current = active >= 0 && active < data.length ? active : Math.max(selectedIndex, 0);
  const bars = useRef<(SVGGElement | null)[]>([]);

  const caption = p.title ?? t('chart.caption', { measure: p.measureLabel, dimension: p.dimensionLabel });
  const header = p.title
    ? <div className="sk-chart__title">{p.title}</div>
    : <VisuallyHidden>{caption}</VisuallyHidden>;

  if (p.loading) {
    return (
      <div ref={ref} className="sk-chart sk-chart--loading" data-sk-chart={p.kind} aria-busy="true">
        {header}
        <VisuallyHidden>{t('chart.loading')}</VisuallyHidden>
        <Skeleton height={height} />
      </div>
    );
  }
  if (!data.length) {
    return (
      <div ref={ref} className="sk-chart sk-chart--empty" data-sk-chart={p.kind}>
        {header}
        <div className="sk-chart__nodata" style={{ height }}>{t('chart.noData')}</div>
      </div>
    );
  }

  const ticks = niceTicks(Math.min(...data.map((d) => d.value)), Math.max(...data.map((d) => d.value)));
  const lo = ticks[0]!;
  const hi = ticks[ticks.length - 1]!;
  const tickLabels = ticks.map(fmt);
  const valueText = (d: ChartDatum) => d.formatted ?? fmt(d.value);
  const vertical = p.kind === 'column';

  // Plot rectangle.
  const tickWidth = Math.max(...tickLabels.map((s) => s.length)) * CHAR + TICK_GAP;
  const maxCategoryWidth = Math.min(Math.max(...data.map((d) => d.label.length)) * CHAR, width * 0.3);
  const left = vertical ? tickWidth : maxCategoryWidth + TICK_GAP;
  const right = vertical ? 8 : tickWidth / 2;
  const top = 8;
  const bottom = 24;
  const plotW = Math.max(width - left - right, 10);
  const plotH = Math.max(height - top - bottom, 10);
  const band = (vertical ? plotW : plotH) / data.length;
  const extent = vertical ? plotH : plotW;
  const pos = (v: number) => ((v - lo) / (hi - lo)) * extent; // distance from the axis origin
  const zero = pos(0);
  const categoryChars = Math.max(2, Math.floor((vertical ? band : maxCategoryWidth) / CHAR));

  const select = (i: number) => {
    const el = bars.current[i];
    setActive(i);
    if (el && p.onSelect) p.onSelect(data[i]!, el);
  };
  const onKeyDown = (e: KeyboardEvent, i: number) => {
    const next = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: data.length - 1 }[e.key];
    if (next !== undefined) {
      e.preventDefault();
      const n = Math.min(data.length - 1, Math.max(0, next));
      setActive(n);
      bars.current[n]?.focus();
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      select(i);
    }
  };
  const interactive = !!p.onSelect;
  const rootLabel = interactive ? caption : t('chart.series', {
    label: caption, points: data.map((d) => t('chart.seriesItem', { name: d.label, value: valueText(d) })).join(t('chart.listSeparator')),
  });

  return (
    <div ref={ref} className={`sk-chart sk-chart--${p.kind}`} data-sk-chart={p.kind}>
      {header}
      <div className="sk-chart__measure" aria-hidden>{p.measureLabel}</div>
      <svg className="sk-chart__svg" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role={interactive ? 'group' : 'img'} aria-label={rootLabel}>
        <g className="sk-chart__axis" aria-hidden>
          {ticks.map((v, i) => {
            const d = pos(v);
            return vertical ? (
              <g key={v}>
                <line className="sk-chart__grid" x1={left} x2={left + plotW} y1={top + plotH - d} y2={top + plotH - d} />
                <text className="sk-chart__tick" x={left - TICK_GAP} y={top + plotH - d} textAnchor="end" dominantBaseline="middle">{tickLabels[i]}</text>
              </g>
            ) : (
              <g key={v}>
                <line className="sk-chart__grid" x1={left + d} x2={left + d} y1={top} y2={top + plotH} />
                <text className="sk-chart__tick" x={left + d} y={top + plotH + TICK_GAP} textAnchor="middle" dominantBaseline="hanging">{tickLabels[i]}</text>
              </g>
            );
          })}
          {vertical
            ? <line className="sk-chart__baseline" x1={left} x2={left + plotW} y1={top + plotH - zero} y2={top + plotH - zero} />
            : <line className="sk-chart__baseline" x1={left + zero} x2={left + zero} y1={top} y2={top + plotH} />}
          {data.map((d, i) => {
            const c = (vertical ? left : top) + band * i + band / 2;
            const text = truncate(d.label, categoryChars);
            return vertical ? (
              <text key={d.key} className="sk-chart__category" x={c} y={top + plotH + TICK_GAP} textAnchor="middle" dominantBaseline="hanging">
                {text !== d.label && <title>{d.label}</title>}{text}
              </text>
            ) : (
              <text key={d.key} className="sk-chart__category" x={left - TICK_GAP} y={c} textAnchor="end" dominantBaseline="middle">
                {text !== d.label && <title>{d.label}</title>}{text}
              </text>
            );
          })}
        </g>
        {data.map((d, i) => {
          const a = pos(d.value);
          const thick = Math.min(band * 0.7, 64);
          const offset = band * i + (band - thick) / 2;
          const rect = vertical
            ? { x: left + offset, y: top + plotH - Math.max(a, zero), width: thick, height: Math.max(Math.abs(a - zero), 1) }
            : { x: left + Math.min(a, zero), y: top + offset, width: Math.max(Math.abs(a - zero), 1), height: thick };
          const selected = d.key === p.selectedKey;
          const label = t('chart.point', { dimension: p.dimensionLabel, label: d.label, value: valueText(d) });
          return (
            <g
              key={d.key}
              ref={(el) => { bars.current[i] = el; }}
              className={`sk-chart__bar${selected ? ' sk-chart__bar--selected' : ''}`}
              data-sk-chart-bar={d.key}
              {...(interactive
                ? { role: 'button', tabIndex: i === current ? 0 : -1, 'aria-label': label, 'aria-pressed': selected, onClick: () => select(i), onKeyDown: (e: KeyboardEvent) => onKeyDown(e, i), onFocus: () => setActive(i) }
                : { 'aria-hidden': true })}
            >
              <title>{label}</title>
              <rect {...rect} />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
