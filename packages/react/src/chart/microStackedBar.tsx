/**
 * StackedBarMicroChart + StackedBarMicroChartBar (sap.suite.ui.microchart, 1.154): bars side by side in one line
 * (docs/15 MC-58, MC-59). Widths follow StackedBarMicroChart._calculateChartData: of maxValue when it is at least the
 * sum (the rest stays empty and labels show the values), else of the sum (labels show percentages rounded to
 * `precision`); bars without a colour take the qualitative palette in turn; zero bars keep a minimum width unless
 * displayZeroValue is false.
 */
import type { ReactElement, ReactNode } from 'react';
import { cx, finite, itemColor, itemsOf, MicroChartRoot, Num, unlabelled, type MicroChartBaseSettings, type MicroChartColor, type MicroCtx, type Rendered } from './microCore';

export interface $StackedBarMicroChartBarSettings {
  /**
   * The value (the width of the bar).
   * @defaultValue 0
   */
  value?: number;
  /** The colour of the bar (default: the next qualitative palette colour). */
  valueColor?: MicroChartColor;
  /** Shown instead of the value. */
  displayValue?: string;
}
/** A bar of StackedBarMicroChart; rendered by its parent. */
export function StackedBarMicroChartBar(_: $StackedBarMicroChartBarSettings): null {
  return null;
}

export interface $StackedBarMicroChartSettings extends MicroChartBaseSettings {
  /** The value of the full length; ignored when smaller than the sum of the bars. */
  maxValue?: number;
  /**
   * Decimals of the calculated percentages.
   * @defaultValue 1
   */
  precision?: number;
  /**
   * Bars with value 0 are drawn (with a minimum width).
   * @defaultValue true
   */
  displayZeroValue?: boolean;
  /**
   * Shows the bar labels.
   * @defaultValue true
   */
  showLabels?: boolean;
  /** The bars (default aggregation: also the StackedBarMicroChartBar children). */
  bars?: ($StackedBarMicroChartBarSettings | ReactElement<$StackedBarMicroChartBarSettings>)[];
  children?: ReactNode;
}

const round = (n: number, d: number) => Number(n.toFixed(d));

function draw(p: $StackedBarMicroChartSettings, bars: $StackedBarMicroChartBarSettings[], { t, fmt, compact }: MicroCtx): Rendered | undefined {
  if (!bars.length) return undefined;
  const precision = p.precision ?? 1;
  const values = bars.map((b) => (finite(b.value) ? b.value : 0));
  const sum = values.reduce((s, v) => s + v, 0);
  const max = finite(p.maxValue) ? p.maxValue : 0;
  const total = Math.max(max, sum);
  const absolute = max >= sum;
  let palette = 0;
  const items = bars.map((b, i) => {
    const pct = total === 0 ? 0 : (values[i]! * 100) / total;
    // StackedBarMicroChart.BAR_COLOR_PARAM_DEFAULT: sapUiChartPaletteQualitativeHue1 … 11, in turn
    const color = b.valueColor ? b.valueColor : `sapUiChartPaletteQualitativeHue${(palette++ % 11) + 1}`;
    return { value: values[i]!, pct: round(pct, precision), width: round(pct, 2), color, text: b.displayValue || (absolute ? String(values[i]) : `${round(pct, precision)}%`) };
  });
  const shown = items.filter((it) => p.displayZeroValue !== false || it.width > 0);
  const widthSum = shown.reduce((s, it) => s + it.width, 0);
  // the largest bar absorbs rounding (and, without maxValue, fills the line)
  if (shown.length && (widthSum > 100 || (!(max > sum) && widthSum < 100 && shown.some((it) => it.width > 0)))) {
    const big = shown.reduce((a, b) => (b.width > a.width ? b : a));
    big.width = round(big.width - widthSum + 100, 2);
  }
  const sep = t('chart.listSeparator');
  return {
    aria: unlabelled(t, 'chart.series', { points: items.map((it) => `${fmt(it.value)} (${it.pct}%)`).join(sep) }),
    body: (
      <span className="sk-microchart__stack">
        {shown.map((it, i) => {
          const c = itemColor(undefined, i, it.color);
          return (
            <span key={i} className={cx('sk-microchart__segment', c.className, it.value === 0 && 'sk-microchart__segment--zero')} data-sk-microchart-bar={i} style={{ ...c.style, width: `${it.width}%` }}>
              {!compact && p.showLabels !== false && <span data-sk-fit className="sk-microchart__segment-label"><Num>{it.text}</Num></span>}
            </span>
          );
        })}
      </span>
    ),
  };
}

/** sap.suite.ui.microchart.StackedBarMicroChart */
export function StackedBarMicroChart(p: $StackedBarMicroChartSettings) {
  const bars = itemsOf(p.bars, p.children, StackedBarMicroChartBar);
  return <MicroChartRoot kind="stackedBar" base={p} draw={(c) => draw(p, bars, c)} />;
}
