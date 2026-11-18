/**
 * AreaMicroChart + AreaMicroChartItem + AreaMicroChartPoint + AreaMicroChartLabel (sap.suite.ui.microchart, 1.154):
 * the actual line, the target line (dotted) and threshold areas over x / y points (docs/15 MC-45 … MC-49). Areas
 * follow AreaMicroChart._renderCanvas: above maxThreshold and below minThreshold in their colour, between the two in
 * Critical, between innerMinThreshold and innerMaxThreshold in innerMaxThreshold's colour. A line needs two points.
 */
import { Fragment, isValidElement, useImperativeHandle, type ReactElement, type ReactNode, type Ref } from 'react';
import { colorOf, cx, finite, itemColor, itemOf, itemsOf, MicroChartRoot, MICRO_LABEL_MIN_HEIGHT, Num, unlabelled, type MicroChartBaseSettings, type MicroChartColor, type MicroCtx, type Rendered } from './microCore';

/** sap.suite.ui.microchart.AreaMicroChartViewType */
export type AreaMicroChartViewType = 'Normal' | 'Wide';
export const AreaMicroChartViewType = { Normal: 'Normal', Wide: 'Wide' } as const;

export interface $AreaMicroChartPointSettings {
  /** The x value. */
  x?: number;
  /** The y value. */
  y?: number;
  ref?: Ref<AreaMicroChartPoint>;
}
/** Instance methods (via `ref`). */
export interface AreaMicroChartPoint {
  /** The x value; undefined when it is not set or not a number. */
  getXValue(): number | undefined;
  /** The y value; undefined when it is not set or not a number. */
  getYValue(): number | undefined;
}
/** A point of an AreaMicroChartItem; rendered by its parent. */
export function AreaMicroChartPoint(p: $AreaMicroChartPointSettings): null {
  useImperativeHandle(p.ref, () => ({ getXValue: () => (finite(p.x) ? p.x : undefined), getYValue: () => (finite(p.y) ? p.y : undefined) }), [p.x, p.y]);
  return null;
}
type PointProp = $AreaMicroChartPointSettings | ReactElement<$AreaMicroChartPointSettings>;
export interface $AreaMicroChartItemSettings {
  /**
   * The colour of the line or area.
   * @defaultValue 'Neutral'
   */
  color?: MicroChartColor;
  /** The title of the line. */
  title?: string;
  /** The points (default aggregation: also the AreaMicroChartPoint children). */
  points?: PointProp[];
  children?: ReactNode;
}
/** A line or threshold of AreaMicroChart; drawn by its parent (it only mounts its point elements, for their refs). */
export function AreaMicroChartItem(p: $AreaMicroChartItemSettings) {
  return <>{p.children}{p.points?.map((x, i) => (isValidElement(x) ? <Fragment key={i}>{x}</Fragment> : null))}</>;
}
export interface $AreaMicroChartLabelSettings {
  /**
   * The colour of the label.
   * @defaultValue 'Neutral'
   */
  color?: MicroChartColor;
  /**
   * The text.
   * @defaultValue ''
   */
  label?: string;
}
/** A label of AreaMicroChart; rendered by its parent. */
export function AreaMicroChartLabel(_: $AreaMicroChartLabelSettings): null {
  return null;
}

type Item = $AreaMicroChartItemSettings | ReactElement<$AreaMicroChartItemSettings>;
type Label = $AreaMicroChartLabelSettings | ReactElement<$AreaMicroChartLabelSettings>;
export interface $AreaMicroChartSettings extends MicroChartBaseSettings {
  maxXValue?: number;
  minXValue?: number;
  maxYValue?: number;
  minYValue?: number;
  /**
   * The view: Wide puts the labels before and after the chart.
   * @defaultValue 'Normal'
   */
  view?: AreaMicroChartViewType;
  /**
   * Colours assigned to `lines` in turn; replaces their colours.
   * @defaultValue []
   */
  colorPalette?: string[];
  /**
   * Shows the labels.
   * @defaultValue true
   */
  showLabel?: boolean;
  /** The actual values line. */
  chart?: Item;
  /** The area above this line. */
  maxThreshold?: Item;
  /** The upper line of the inner area (its colour fills the area). */
  innerMaxThreshold?: Item;
  /** The lower line of the inner area. */
  innerMinThreshold?: Item;
  /** The area below this line. */
  minThreshold?: Item;
  /** The target values line. */
  target?: Item;
  firstXLabel?: Label;
  firstYLabel?: Label;
  lastXLabel?: Label;
  lastYLabel?: Label;
  maxLabel?: Label;
  minLabel?: Label;
  /** More lines (default aggregation: also the AreaMicroChartItem children). */
  lines?: Item[];
  children?: ReactNode;
}

type Xy = { x: number; y: number };
const pointsOf = (item: $AreaMicroChartItemSettings | undefined): Xy[] =>
  item ? itemsOf(item.points, item.children, AreaMicroChartPoint).filter((pt) => finite(pt.x) && finite(pt.y)) as Xy[] : [];
const SEMANTIC_BAND: Record<string, string> = { Good: 'positive', Error: 'negative', Critical: 'critical', Neutral: 'neutral', None: 'neutral' };

function draw(p: $AreaMicroChartSettings, lines: $AreaMicroChartItemSettings[], { t, fmt, h }: MicroCtx): Rendered | undefined {
  const it = (x: Item | undefined) => itemOf(x, undefined, AreaMicroChartItem);
  const chart = it(p.chart);
  const pts = pointsOf;
  const series = {
    chart: pts(chart), target: pts(it(p.target)),
    max: pts(it(p.maxThreshold)), min: pts(it(p.minThreshold)), innerMax: pts(it(p.innerMaxThreshold)), innerMin: pts(it(p.innerMinThreshold)),
  };
  const extra = lines.map((l) => pts(l));
  const all = [...Object.values(series), ...extra].flat();
  if (!all.length || (series.chart.length < 2 && !extra.some((l) => l.length > 1))) return undefined;
  let minX = Math.min(...all.map((pt) => pt.x));
  let maxX = Math.max(...all.map((pt) => pt.x));
  let minY = Math.min(...all.map((pt) => pt.y));
  let maxY = Math.max(...all.map((pt) => pt.y));
  if (finite(p.minXValue)) minX = p.minXValue;
  if (finite(p.maxXValue)) maxX = p.maxXValue;
  if (finite(p.minYValue)) minY = p.minYValue;
  if (finite(p.maxYValue)) maxY = p.maxYValue;
  const xs = (x: number) => (maxX === minX ? 50 : ((x - minX) / (maxX - minX)) * 100);
  const ys = (y: number) => (maxY === minY ? 50 : 100 - ((Math.min(maxY, Math.max(minY, y)) - minY) / (maxY - minY)) * 100);
  const path = (pts: Xy[]) => pts.map((pt) => `${xs(pt.x).toFixed(2)},${ys(pt.y).toFixed(2)}`).join(' ');
  /** The area between a line and a horizontal edge (0 = top, 100 = bottom) or a second line. */
  const area = (upper: Xy[], lower: Xy[] | 0 | 100) => {
    const top = upper.map((pt) => `${xs(pt.x).toFixed(2)},${ys(pt.y).toFixed(2)}`);
    const bottom = typeof lower === 'number'
      ? [`${xs(upper[upper.length - 1]!.x).toFixed(2)},${lower}`, `${xs(upper[0]!.x).toFixed(2)},${lower}`]
      : [...lower].reverse().map((pt) => `${xs(pt.x).toFixed(2)},${ys(pt.y).toFixed(2)}`);
    return [...top, ...bottom].join(' ');
  };
  const band = (key: string, color: string | undefined, points: string) => {
    const tone = SEMANTIC_BAND[color ?? 'Neutral'];
    const c = tone ? {} : colorOf(color);
    return <polygon key={key} className={cx('sk-microchart__band', tone ? `sk-microchart__band--${tone}` : 'sk-microchart__band--mark', c.className)} style={c.style} data-sk-microchart-bar={`band-${key}`} points={points} />;
  };
  const chartColor = colorOf(chart?.color ?? 'Neutral');
  const plot = (
    <svg className="sk-microchart__plot" viewBox="0 0 100 100" preserveAspectRatio="none" focusable="false">
      {series.max.length > 1 && band('max', it(p.maxThreshold)?.color, area(series.max, 0))}
      {series.min.length > 1 && band('min', it(p.minThreshold)?.color, area(series.min, 100))}
      {series.max.length > 1 && series.min.length > 1 && band('between', 'Critical', area(series.max, series.min))}
      {series.innerMax.length > 1 && series.innerMin.length > 1 && band('inner', it(p.innerMaxThreshold)?.color, area(series.innerMax, series.innerMin))}
      {series.target.length > 1 && <polyline className="sk-microchart__line sk-microchart__line--target" data-sk-microchart-bar="target" points={path(series.target)} vectorEffect="non-scaling-stroke" />}
      {series.chart.length > 1 && <polyline className={cx('sk-microchart__line', 'sk-microchart__line--actual', chartColor.className)} style={chartColor.style} data-sk-microchart-bar="actual" points={path(series.chart)} vectorEffect="non-scaling-stroke" />}
      {extra.map((l, i) => {
        if (l.length < 2) return null;
        const c = itemColor(p.colorPalette, i, lines[i]?.color ?? 'Neutral');
        return <polyline key={i} className={cx('sk-microchart__line', c.className)} style={c.style} data-sk-microchart-bar={`line-${i}`} points={path(l)} vectorEffect="non-scaling-stroke" />;
      })}
    </svg>
  );
  const lab = (l: Label | undefined) => itemOf(l, undefined, AreaMicroChartLabel);
  const text = (l: $AreaMicroChartLabelSettings | undefined) => {
    const c = l?.color && l.color !== 'Neutral' ? colorOf(l.color) : {};
    return <Num className={cx(c.className, (c.className || c.style) && 'sk-microchart__value--mark')} style={c.style}>{l?.label ?? ''}</Num>;
  };
  const [fy, ly, fx, lx, mx, mn] = [lab(p.firstYLabel), lab(p.lastYLabel), lab(p.firstXLabel), lab(p.lastXLabel), lab(p.maxLabel), lab(p.minLabel)];
  const wide = p.view === 'Wide';
  // MC-48: labels hidden below 56 px (normal) or 36 px (wide).
  const showLabels = p.showLabel !== false && (h === undefined || h >= (wide ? 36 : MICRO_LABEL_MIN_HEIGHT));
  const sep = t('chart.listSeparator');
  const aria = [
    unlabelled(t, 'chart.series', { points: series.chart.map((pt) => fmt(pt.y)).join(sep) }),
    ...(series.target.length ? [t('chart.target', { value: series.target.map((pt) => fmt(pt.y)).join(sep) })] : []),
  ].join(sep);
  const row = (items: ($AreaMicroChartLabelSettings | undefined)[], kind: string) => items.some((l) => l?.label) && (
    <span className={cx('sk-microchart__edges', items.length === 3 && 'sk-microchart__edges--thirds', `sk-microchart__edges--${kind}`)} data-sk-fit>
      {items.map((l, i) => <span key={i} className="sk-microchart__edge">{text(l)}</span>)}
    </span>
  );
  if (wide) {
    const side = (y: $AreaMicroChartLabelSettings | undefined, x: $AreaMicroChartLabelSettings | undefined) => (y?.label || x?.label) && (
      <span className="sk-microchart__texts sk-microchart__texts--stack" data-sk-fit>
        <span className="sk-microchart__value">{text(y)}</span>
        <span className="sk-microchart__muted">{text(x)}</span>
      </span>
    );
    return { aria, body: <span className="sk-microchart__wide">{showLabels && side(fy, fx)}{plot}{showLabels && side(ly, lx)}</span> };
  }
  const thirds = Boolean(mx?.label || mn?.label);
  return {
    aria,
    body: (
      <>
        {showLabels && row(thirds ? [fy, mx, ly] : [fy, ly], 'top')}
        {plot}
        {showLabels && row(thirds ? [fx, mn, lx] : [fx, lx], 'bottom')}
      </>
    ),
  };
}

/** sap.suite.ui.microchart.AreaMicroChart */
export function AreaMicroChart(p: $AreaMicroChartSettings) {
  const lines = itemsOf(p.lines, p.children, AreaMicroChartItem);
  // the aggregated elements render nothing; mounting them gives their refs (AreaMicroChartPoint#getXValue)
  const items = [p.chart, p.target, p.maxThreshold, p.innerMaxThreshold, p.innerMinThreshold, p.minThreshold, ...(p.lines ?? [])]
    .map((x, i) => (isValidElement(x) ? <Fragment key={i}>{x}</Fragment> : x ? <AreaMicroChartItem key={i} {...x} /> : null));
  return <><MicroChartRoot kind="area" base={p} draw={(c) => draw(p, lines, c)} />{items}{p.children}</>;
}
