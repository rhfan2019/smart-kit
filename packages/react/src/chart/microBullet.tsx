/**
 * BulletMicroChart + BulletMicroChartData (sap.suite.ui.microchart, 1.154): a bar of the actual value (or the delta to
 * the target) on a scale track, the target marker, forecast and threshold markers (docs/15 MC-21 … MC-27).
 * Scale, labels and modes follow BulletMicroChart._calculateChartData and BulletMicroChartRenderer.
 */
import type { ReactElement, ReactNode } from 'react';
import { colorOf, cx, finite, itemOf, itemsOf, MicroChartRoot, Num, stateText, withSuffix, type CommonBackgroundType, type MicroChartBaseSettings, type MicroCtx, type Rendered, type ValueColor } from './microCore';

/** sap.suite.ui.microchart.BulletMicroChartModeType */
export type BulletMicroChartModeType = 'Actual' | 'Delta';
export const BulletMicroChartModeType = { Actual: 'Actual', Delta: 'Delta' } as const;

export interface $BulletMicroChartDataSettings {
  /**
   * The value.
   * @defaultValue 0
   */
  value?: number;
  /**
   * The semantic color of the value.
   * @defaultValue 'Neutral'
   */
  color?: ValueColor;
}
/** A value of BulletMicroChart (`actual` or one of `thresholds`); rendered by its parent. */
export function BulletMicroChartData(_: $BulletMicroChartDataSettings): null {
  return null;
}

export interface $BulletMicroChartSettings extends MicroChartBaseSettings {
  /**
   * Shows the actual value or the delta between the actual and the target value.
   * @defaultValue 'Actual'
   */
  mode?: BulletMicroChartModeType;
  /**
   * The scaling suffix added to all values.
   * @defaultValue ''
   */
  scale?: string;
  /** The forecast value (Actual mode only): a bar behind the actual value bar. */
  forecastValue?: number;
  /** The target value: a vertical marker. */
  targetValue?: number;
  /** The start of the scale (for comparable charts). */
  minValue?: number;
  /** The end of the scale (for comparable charts). */
  maxValue?: number;
  /**
   * Shows the actual value (Actual mode).
   * @defaultValue true
   */
  showActualValue?: boolean;
  /**
   * Shows the delta value (Delta mode).
   * @defaultValue true
   */
  showDeltaValue?: boolean;
  /**
   * Shows the actual value in Delta mode (priority over `showDeltaValue`).
   * @defaultValue false
   */
  showActualValueInDeltaMode?: boolean;
  /**
   * Shows the target value.
   * @defaultValue true
   */
  showTargetValue?: boolean;
  /**
   * Shows the value marker.
   * @defaultValue false
   */
  showValueMarker?: boolean;
  /**
   * Shows the threshold markers.
   * @defaultValue true
   */
  showThresholds?: boolean;
  /**
   * Shown instead of the actual value.
   * @defaultValue ''
   */
  actualValueLabel?: string;
  /**
   * Shown instead of the calculated delta.
   * @defaultValue ''
   */
  deltaValueLabel?: string;
  /**
   * Shown instead of the target value.
   * @defaultValue ''
   */
  targetValueLabel?: string;
  /**
   * The background color of the scale (only Transparent changes the theme colour).
   * @defaultValue 'MediumLight'
   */
  scaleColor?: CommonBackgroundType;
  /**
   * The scale need not start at 0 for small value ranges.
   * @defaultValue false
   */
  smallRangeAllowed?: boolean;
  /** The actual value (default aggregation: also the first BulletMicroChartData child). */
  actual?: $BulletMicroChartDataSettings | ReactElement<$BulletMicroChartDataSettings>;
  /** The thresholds. */
  thresholds?: ($BulletMicroChartDataSettings | ReactElement<$BulletMicroChartDataSettings>)[];
  children?: ReactNode;
}

const digits = (n: number) => (String(n).split(/[.,]/)[1] ?? '').length;

function draw(p: $BulletMicroChartSettings, actual: $BulletMicroChartDataSettings | undefined, { t, fmt, compact }: MicroCtx): Rendered | undefined {
  const value = actual ? actual.value ?? 0 : undefined;
  if (!finite(value)) return undefined;
  const mode = p.mode ?? 'Actual';
  const target = finite(p.targetValue) ? p.targetValue : undefined;
  const forecast = mode === 'Actual' && finite(p.forecastValue) ? p.forecastValue : undefined;
  const thresholds = itemsOf(p.thresholds, undefined, BulletMicroChartData).map((th) => ({ value: th.value ?? 0, color: th.color ?? 'Neutral' })).filter((th) => finite(th.value));
  const all = [value, ...(finite(p.forecastValue) ? [p.forecastValue] : []), ...(target !== undefined ? [target] : []), ...(finite(p.minValue) ? [p.minValue] : []), ...(finite(p.maxValue) ? [p.maxValue] : []), ...thresholds.map((th) => th.value)];
  let lo = Math.min(...all);
  let hi = Math.max(...all);
  if (!p.smallRangeAllowed) {
    hi = hi < 0 && hi < 3 * (lo - hi) ? 0 : hi;
    lo = lo > 0 && lo > 3 * (hi - lo) ? 0 : lo;
  }
  const total = hi - lo;
  const x = (v: number) => (total === 0 ? 0 : Math.min(100, Math.max(0, ((v - lo) / total) * 100)));
  const isDelta = mode === 'Delta';
  const xv = isDelta && total === 0 ? 50 : x(value);
  const xt = target === undefined ? undefined : isDelta && total === 0 ? 50 : x(target);
  const delta = target === undefined ? 0 : Number(Math.abs(value - target).toFixed(Math.max(digits(value), digits(target))));
  const sc = p.scale ?? '';
  // BulletMicroChartRenderer: the top label is the actual value (Actual mode or showActualValueInDeltaMode) or the delta.
  const top = isDelta
    ? (p.showActualValueInDeltaMode ? withSuffix(p.actualValueLabel, value, sc) : p.showDeltaValue !== false && target !== undefined ? `Δ${withSuffix(p.deltaValueLabel, delta, sc)}` : undefined)
    : p.showActualValue !== false ? withSuffix(p.actualValueLabel, value, sc) : undefined;
  const bottom = target !== undefined && p.showTargetValue !== false ? withSuffix(p.targetValueLabel, target, sc) : undefined;
  const span = (a: number, b: number) => ({ x: Math.min(a, b), width: Math.max(Math.abs(b - a), 0.5) });
  const sep = t('chart.listSeparator');
  const color = actual?.color ?? 'Neutral';
  const parts = [
    (isDelta && target !== undefined ? t('chart.difference', { value: fmt(value - target) }) : t('chart.actual', { value: fmt(value) })) + stateText(t, color),
    ...(target !== undefined ? [t('chart.target', { value: fmt(target) })] : []),
    ...(forecast !== undefined ? [t('chart.forecast', { value: fmt(forecast) })] : []),
    ...(thresholds.length && p.showThresholds !== false ? [t('chart.thresholds', { values: thresholds.map((th) => fmt(th.value)).join(sep) })] : []),
  ];
  // A label placed at a position along the bar: left-aligned at 0 %, centred in the middle, right-aligned at 100 %.
  const at = (pos: number) => ({ left: `${pos}%`, transform: `translateX(-${pos}%)` });
  const barEnd = isDelta && xt !== undefined ? Math.max(xv, xt) : xv;
  return {
    mark: colorOf(color === 'None' ? 'Neutral' : color),
    aria: parts.join(sep),
    body: (
      <>
        {/* MC-21, MC-27: the actual value (or delta) above the bar at its end, the target below at the marker; none in XS. */}
        {!compact && top !== undefined && (
          <span className="sk-microchart__lane" data-sk-fit>
            <Num className="sk-microchart__value sk-microchart__value--mark sk-microchart__placed" style={at(barEnd)}>{top}</Num>
          </span>
        )}
        <svg className="sk-microchart__plot" viewBox="0 0 100 20" preserveAspectRatio="none" focusable="false">
          <rect className={cx('sk-microchart__track', p.scaleColor === 'Transparent' && 'sk-microchart__track--transparent')} x={0} y={4} width={100} height={12} />
          {forecast !== undefined && <rect className="sk-microchart__mark sk-microchart__forecast" data-sk-microchart-bar="forecast" {...span(0, x(forecast))} y={4} height={12} />}
          {isDelta
            ? xt !== undefined && <rect className="sk-microchart__mark" data-sk-microchart-bar="delta" {...span(xt, xv)} y={7} height={6} />
            : xv > 0 && <rect className="sk-microchart__mark" data-sk-microchart-bar="value" {...span(0, xv)} y={7} height={6} />}
          {p.showValueMarker && <rect className="sk-microchart__mark" data-sk-microchart-bar="marker" x={Math.min(99.4, Math.max(0, xv - 0.3))} y={3} width={0.6} height={14} />}
          {/* MC-25: thresholds are short lines across the bar in their semantic colour. */}
          {p.showThresholds !== false && thresholds.map((th, i) => (
            <rect key={i} className={cx('sk-microchart__threshold', colorOf(th.color).className)} data-sk-microchart-bar="threshold" x={Math.min(99.4, Math.max(0, x(th.value) - 0.3))} y={2} width={0.6} height={16} />
          ))}
          {xt !== undefined && <rect className="sk-microchart__target" data-sk-microchart-bar="target" x={Math.min(99, Math.max(0, xt - 0.75))} y={0} width={1.5} height={20} />}
        </svg>
        {!compact && bottom !== undefined && (
          <span className="sk-microchart__lane" data-sk-fit>
            <Num className="sk-microchart__placed" style={at(xt!)}>{bottom}</Num>
          </span>
        )}
      </>
    ),
  };
}

/** sap.suite.ui.microchart.BulletMicroChart */
export function BulletMicroChart(p: $BulletMicroChartSettings) {
  const actual = itemOf(p.actual, p.children, BulletMicroChartData);
  return <MicroChartRoot kind="bullet" base={p} draw={(c) => draw(p, actual, c)} />;
}
