/**
 * SimpleChart: the list report chart view (ADR-021): column, bar, line, area, pie or donut, inline SVG; several
 * measures (or series) are drawn as grouped or stacked bars with a legend (`series`, docs/29 §4 P1-3, §5).
 * Analytical cards (docs/20) also use "line" (the column layout with a line through the points) and "donut".
 * Bars are buttons with a roving tab stop (Tab enters at the selected or first bar, arrow keys move, Enter / Space select).
 */
import { Skeleton, VisuallyHidden } from '@mantine/core';
import { useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useSmartKit } from '../context/SmartKitProvider';

export interface ChartDatum {
  key: string;
  label: string;
  /** Value of the first series. */
  value: number;
  formatted?: string;
  /** With `series`: one value per series (undefined: no value), and their display texts. */
  values?: (number | undefined)[];
  formattedValues?: (string | undefined)[];
}

/** A series of a grouped chart (a measure, or a measure and the values of the series dimensions). */
export interface ChartSeries { key: string; label: string }

export interface SimpleChartProps {
  /**
   * What is drawn: columns, bars, a line (area: filled below the line), a donut or pie. With `series`, columns and bars
   * are grouped, or stacked with `stacked` (FE stacked_column / stacked_bar; "percent": 100_stacked_*).
   */
  kind: 'column' | 'bar' | 'line' | 'area' | 'donut' | 'pie';
  /** Series of columns or bars are stacked ("percent": each category adds up to 100 %). */
  stacked?: boolean | 'percent';
  /** Value of `data-sk-chart` (default `kind`), e.g. the sap.chart type name of the UI.Chart. */
  chartType?: string;
  /** Visible title; a visually hidden caption is used when omitted. */
  title?: string;
  measureLabel: string;
  dimensionLabel: string;
  data: ChartDatum[];
  /** Shows a busy indicator. */
  loading?: boolean;
  /** Formats a number for display. */
  format?(n: number): string;
  /** Called when a data point is selected (click or Enter / Space on a focused bar); `anchor` is the bar element, e.g. for a popover. */
  onSelect?(d: ChartDatum, anchor: Element): void;
  /** Key of the selected data point. */
  selectedKey?: string;
  /** Keys of the selected data points (multiple selection); combined with `selectedKey`. */
  selectedKeys?: readonly string[];
  /** Height in pixels (default 320). */
  height?: number;
  /** Column and bar charts: several series per category (grouped bars, legend); each datum then has `values`. */
  series?: ChartSeries[];
}

/** Width used until the container has been measured (and in environments without layout). */
const FALLBACK_WIDTH = 640;
/** Approximate glyph width of the small text, for label truncation and margins. */
const CHAR = 7;
const TICK_GAP = 6;
/** Radius of a line chart marker. */
const MARKER = 4;

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
  const grouped = (p.kind === 'column' || p.kind === 'bar') && (p.series?.length ?? 0) > 1;
  const stacked = grouped && Boolean(p.stacked);
  const percent = stacked && p.stacked === 'percent';
  const seriesCount = grouped && !stacked ? p.series!.length : 1;
  const valuesOf = (d: ChartDatum): (number | undefined)[] => (grouped ? p.series!.map((_, i) => d.values?.[i]) : [d.value]);
  // 100 % stacking: each value as its share of the category's positive total
  const shareOf = (d: ChartDatum, v: number) => { const sum = valuesOf(d).reduce<number>((n, x) => n + (x !== undefined && Number.isFinite(x) && x > 0 ? x : 0), 0); return sum ? (Math.max(v, 0) / sum) * 100 : 0; };
  const data = useMemo(() => p.data.filter((d) => (grouped ? (d.values ?? []).some((v) => Number.isFinite(v)) : Number.isFinite(d.value))), [p.data, grouped]);
  const isSelected = (key: string) => key === p.selectedKey || Boolean(p.selectedKeys?.includes(key));
  const selectedIndex = data.findIndex((d) => isSelected(d.key));
  const [active, setActive] = useState(-1);
  const current = active >= 0 && active < data.length ? active : Math.max(selectedIndex, 0);
  const bars = useRef<(SVGGElement | null)[]>([]);

  const caption = p.title ?? t('chart.caption', { measure: p.measureLabel, dimension: p.dimensionLabel });
  const header = p.title
    ? <div className="sk-chart__title">{p.title}</div>
    : <VisuallyHidden>{caption}</VisuallyHidden>;

  if (p.loading) {
    return (
      <div ref={ref} className="sk-chart sk-chart--loading" data-sk-chart={p.chartType ?? p.kind} aria-busy="true">
        {header}
        <VisuallyHidden>{t('chart.loading')}</VisuallyHidden>
        <Skeleton height={height} />
      </div>
    );
  }
  if (!data.length) {
    return (
      <div ref={ref} className="sk-chart sk-chart--empty" data-sk-chart={p.chartType ?? p.kind}>
        {header}
        <div className="sk-chart__nodata" style={{ height }}>{t('chart.noData')}</div>
      </div>
    );
  }

  if (p.kind === 'donut' || p.kind === 'pie') return <DonutChart {...p} data={data} width={width} height={height} chartRef={ref} header={header} caption={caption} fmt={fmt} />;

  // stacked: the axis covers the sums of the positive and of the negative values of a category
  const all = stacked
    ? data.flatMap((d) => {
        const vs = valuesOf(d).filter((v): v is number => v !== undefined && Number.isFinite(v));
        if (percent) return [0, 100];
        return [vs.filter((v) => v > 0).reduce((n, v) => n + v, 0), vs.filter((v) => v < 0).reduce((n, v) => n + v, 0)];
      })
    : data.flatMap((d) => valuesOf(d).filter((v): v is number => Number.isFinite(v)));
  const ticks = niceTicks(Math.min(...all), Math.max(...all));
  const lo = ticks[0]!;
  const hi = ticks[ticks.length - 1]!;
  const tickLabels = ticks.map((v) => (percent ? `${fmt(v)} %` : fmt(v)));
  const valueText = (d: ChartDatum) => d.formatted ?? fmt(d.value);
  const vertical = p.kind === 'column' || p.kind === 'line' || p.kind === 'area';
  const line = p.kind === 'line' || p.kind === 'area';

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
  const pointText = (d: ChartDatum) => (grouped
    ? p.series!.map((s, k) => `${s.label} ${d.formattedValues?.[k] ?? (d.values?.[k] === undefined ? '' : fmt(d.values[k]!))}`.trim()).join(t('chart.listSeparator'))
    : valueText(d));
  const rootLabel = interactive ? caption : t('chart.series', {
    label: caption, points: data.map((d) => t('chart.seriesItem', { name: d.label, value: pointText(d) })).join(t('chart.listSeparator')),
  });

  return (
    <div ref={ref} className={`sk-chart sk-chart--${p.kind}`} data-sk-chart={p.chartType ?? p.kind}>
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
        {p.kind === 'area' && (
          <polygon
            className="sk-chart__area"
            aria-hidden
            points={[`${left + band / 2},${top + plotH - zero}`, ...data.map((d, i) => `${left + band * i + band / 2},${top + plotH - pos(d.value)}`), `${left + band * (data.length - 1) + band / 2},${top + plotH - zero}`].join(' ')}
          />
        )}
        {line && (
          <polyline
            className="sk-chart__line"
            aria-hidden
            points={data.map((d, i) => `${left + band * i + band / 2},${top + plotH - pos(d.value)}`).join(' ')}
          />
        )}
        {data.map((d, i) => {
          const a = pos(d.value);
          const thick = Math.min(band * 0.7, 64 * seriesCount);
          const offset = band * i + (band - thick) / 2;
          // stacked: each value starts where the previous value of the same sign ended
          let up = 0;
          let down = 0;
          const rectOf = (v: number, k: number, n: number) => {
            let from = 0;
            let to = v;
            if (stacked) {
              const x = percent ? shareOf(d, v) : v;
              if (x >= 0) { from = up; up += x; to = up; } else { from = down; down += x; to = down; }
            }
            const b = pos(to);
            const z = pos(from);
            const w = thick / n;
            const o = offset + w * (stacked ? 0 : k);
            return vertical
              ? { x: left + o, y: top + plotH - Math.max(b, z), width: w, height: Math.max(Math.abs(b - z), 1) }
              : { x: left + Math.min(b, z), y: top + o, width: Math.max(Math.abs(b - z), 1), height: w };
          };
          const rect = grouped ? undefined : rectOf(d.value, 0, 1);
          const selected = isSelected(d.key);
          const label = t('chart.point', { dimension: p.dimensionLabel, label: d.label, value: pointText(d) });
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
              {line ? <circle cx={left + band * i + band / 2} cy={top + plotH - a} r={MARKER} />
                : grouped ? valuesOf(d).map((v, k) => (v === undefined || !Number.isFinite(v) ? null
                  : <rect key={p.series![k]!.key} className={`sk-chart--palette-${(k % 11) + 1}`} data-sk-chart-series={p.series![k]!.key} data-sk-chart-value={v} {...rectOf(v, k, seriesCount)} />))
                  : <rect data-sk-chart-value={d.value} {...rect!} />}
            </g>
          );
        })}
      </svg>
      {grouped ? (
        <ul className="sk-chart__legend sk-chart__legend--series" aria-hidden>
          {p.series!.map((s, k) => <li key={s.key} data-sk-chart-legend={s.key}><span className={`sk-chart__swatch sk-chart--palette-${(k % 11) + 1}`} />{s.label}</li>)}
        </ul>
      ) : null}
    </div>
  );
}

/** Donut: one ring, one segment per category (qualitative palette), the legend below with the values. */
function DonutChart(p: SimpleChartProps & { width: number; height: number; chartRef: ReturnType<typeof useWidth>[0]; header: ReactNode; caption: string; fmt(n: number): string }) {
  const { t } = useSmartKit();
  const total = p.data.reduce((n, d) => n + Math.max(0, d.value), 0);
  const size = Math.min(p.width, p.height - LEGEND_ROW * Math.min(p.data.length, 4));
  const r = Math.max(size / 2 - 2, 10);
  const inner = p.kind === 'pie' ? 0 : r * 0.6;
  let angle = -Math.PI / 2;
  const valueText = (d: ChartDatum) => d.formatted ?? p.fmt(d.value);
  const arcs = p.data.map((d, i) => {
    const share = total ? Math.max(0, d.value) / total : 0;
    const a0 = angle;
    const a1 = angle + share * 2 * Math.PI;
    angle = a1;
    return { d, i, path: share >= 0.9999 ? ring(r, inner) : arc(r, inner, a0, a1) };
  });
  const label = t('chart.series', { label: p.caption, points: p.data.map((d) => t('chart.seriesItem', { name: d.label, value: valueText(d) })).join(t('chart.listSeparator')) });
  return (
    <div ref={p.chartRef} className={`sk-chart sk-chart--${p.kind}`} data-sk-chart={p.chartType ?? p.kind}>
      {p.header}
      <svg className="sk-chart__svg" width={p.width} height={2 * r + 4} viewBox={`${-p.width / 2} ${-r - 2} ${p.width} ${2 * r + 4}`} role="img" aria-label={label}>
        {arcs.map((a) => (
          <path key={a.d.key} className={`sk-chart__segment sk-chart--palette-${(a.i % 11) + 1}`} d={a.path} data-sk-chart-bar={a.d.key} onClick={p.onSelect ? (e) => p.onSelect!(a.d, e.currentTarget) : undefined}>
            <title>{t('chart.point', { dimension: p.dimensionLabel, label: a.d.label, value: valueText(a.d) })}</title>
          </path>
        ))}
      </svg>
      <ul className="sk-chart__legend" aria-hidden>
        {p.data.map((d, i) => (
          <li key={d.key}><span className={`sk-chart__swatch sk-chart--palette-${(i % 11) + 1}`} />{d.label}<span className="sk-chart__legend-value">{valueText(d)}</span></li>
        ))}
      </ul>
    </div>
  );
}

/** Height of one legend row of the donut chart (px). */
const LEGEND_ROW = 22;
const pt = (r: number, a: number) => `${(r * Math.cos(a)).toFixed(2)} ${(r * Math.sin(a)).toFixed(2)}`;
function arc(r: number, inner: number, a0: number, a1: number): string {
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M ${pt(r, a0)} A ${r} ${r} 0 ${large} 1 ${pt(r, a1)} L ${pt(inner, a1)} A ${inner} ${inner} 0 ${large} 0 ${pt(inner, a0)} Z`;
}
function ring(r: number, inner: number): string {
  return `M ${r} 0 A ${r} ${r} 0 1 1 ${-r} 0 A ${r} ${r} 0 1 1 ${r} 0 Z M ${inner} 0 A ${inner} ${inner} 0 1 0 ${-inner} 0 A ${inner} ${inner} 0 1 0 ${inner} 0 Z`;
}
