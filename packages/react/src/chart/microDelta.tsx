/**
 * DeltaMicroChart (sap.suite.ui.microchart, 1.154): two value bars and the delta bar between them, the values on the
 * right (value 1, delta, value 2). Normal view: title 1 above and title 2 below the chart; Wide view: the titles in a
 * column on the left; Responsive: Wide when the chart is wider than 12rem (DeltaMicroChart.THRESHOLD_WIDTH_WIDE_MODE).
 * The delta is |value1 − value2| with the decimals of the values (DeltaMicroChart._getDeltaValue); docs/15 MC-61 … MC-63.
 */
import { colorOf, cx, finite, MicroChartRoot, Num, scale, stateText, unlabelled, type MicroChartBaseSettings, type MicroChartColor, type MicroCtx, type Rendered } from './microCore';

/** sap.suite.ui.microchart.DeltaMicroChartViewType */
export type DeltaMicroChartViewType = 'Normal' | 'Wide' | 'Responsive';
export const DeltaMicroChartViewType = { Normal: 'Normal', Wide: 'Wide', Responsive: 'Responsive' } as const;

export interface $DeltaMicroChartSettings extends MicroChartBaseSettings {
  /** The first value. */
  value1?: number;
  /** The second value. */
  value2?: number;
  /** The title of the first value. */
  title1?: string;
  /** The title of the second value. */
  title2?: string;
  /** Shown instead of value1. */
  displayValue1?: string;
  /** Shown instead of value2. */
  displayValue2?: string;
  /** Shown instead of the calculated delta. */
  deltaDisplayValue?: string;
  /**
   * The colour of the delta.
   * @defaultValue 'Neutral'
   */
  color?: MicroChartColor;
  /**
   * The view of the chart.
   * @defaultValue 'Normal'
   */
  view?: DeltaMicroChartViewType;
}

/** 12rem: the Responsive view switches to Wide above this width. */
const WIDE_PX = 192;
const digits = (n: number) => (String(n).split(/[.,]/)[1] ?? '').length;

function draw(p: $DeltaMicroChartSettings, { t, fmt, compact, w }: MicroCtx): Rendered | undefined {
  if (!finite(p.value1) || !finite(p.value2)) return undefined;
  const v1 = p.value1;
  const v2 = p.value2;
  const d = v1 - v2;
  const x = scale([v1, v2]);
  const z = x(0);
  const color = colorOf(p.color ?? 'Neutral');
  const span = (a: number, b: number) => ({ x: Math.min(a, b), width: Math.max(Math.abs(b - a), 0.5) });
  const view = p.view ?? 'Normal';
  const wide = view === 'Wide' || (view === 'Responsive' && w !== undefined && w > WIDE_PX);
  const deltaText = p.deltaDisplayValue ? p.deltaDisplayValue : Math.abs(d).toFixed(Math.max(digits(v1), digits(v2)));
  const title = (text: string | undefined) => <span className="sk-microchart__muted sk-microchart__title" title={text}>{text ?? ''}</span>;
  return {
    aria: unlabelled(t, 'chart.delta', { value1: `${p.title1 ? `${p.title1} ` : ''}${fmt(v1)}`, value2: `${p.title2 ? `${p.title2} ` : ''}${fmt(v2)}`, delta: d > 0 ? `+${fmt(d)}` : fmt(d) }) + stateText(t, p.color),
    body: (
      <span className={cx('sk-microchart__delta-grid', wide && 'sk-microchart__delta-grid--wide')}>
        {!compact && !wide && p.title1 && title(p.title1)}
        <span className="sk-microchart__delta-body">
          {!compact && wide && (p.title1 || p.title2) && <span className="sk-microchart__titles sk-microchart__texts--stack">{title(p.title1)}{title(p.title2)}</span>}
          <svg className="sk-microchart__plot" viewBox="0 0 100 30" preserveAspectRatio="none" focusable="false">
            <rect className="sk-microchart__mark sk-microchart__mark--plain" data-sk-microchart-bar="value1" {...span(z, x(v1))} y={1} height={4} />
            <rect className={cx('sk-microchart__mark', color.className)} style={color.style} data-sk-microchart-bar="delta" {...span(x(v1), x(v2))} y={10} height={10} />
            <rect className="sk-microchart__mark sk-microchart__mark--plain" data-sk-microchart-bar="value2" {...span(z, x(v2))} y={25} height={4} />
            <line className="sk-microchart__connector" x1={x(v1)} x2={x(v1)} y1={1} y2={20} vectorEffect="non-scaling-stroke" />
            <line className="sk-microchart__connector" x1={x(v2)} x2={x(v2)} y1={10} y2={29} vectorEffect="non-scaling-stroke" />
          </svg>
          <span data-sk-fit className="sk-microchart__delta-values">
            {!compact && <Num>{p.displayValue1 ? p.displayValue1 : String(v1)}</Num>}
            <Num className={cx('sk-microchart__value', 'sk-microchart__delta', color.className)} style={color.style}>{deltaText}</Num>
            {!compact && <Num>{p.displayValue2 ? p.displayValue2 : String(v2)}</Num>}
          </span>
        </span>
        {!compact && !wide && p.title2 && title(p.title2)}
      </span>
    ),
  };
}

/** sap.suite.ui.microchart.DeltaMicroChart */
export function DeltaMicroChart(p: $DeltaMicroChartSettings) {
  return <MicroChartRoot kind="delta" base={p} draw={(c) => draw(p, c)} />;
}
