/**
 * LineMicroChart + LineMicroChartLine + LineMicroChartPoint + LineMicroChartEmphasizedPoint (sap.suite.ui.microchart,
 * 1.154): lines over x / y points, the threshold line, four corner labels (docs/15 MC-35 … MC-40). Scaling follows
 * LineMicroChart._calcExtremums: the threshold (default 0, `null` disables it) starts the y range, minX/maxX/minY/maxY
 * replace the data range. Emphasized points switch a line to focus mode (grey line when one shown point is coloured);
 * a colour `{ above, below }` colours the line above and below the threshold (semantic mode).
 */
import { isValidElement, useId, type ReactElement, type ReactNode } from 'react';
import { colorOf, cx, EdgeLabels, finite, itemsOf, MicroChartRoot, Num, unlabelled, type MicroChartBaseSettings, type MicroChartColor, type MicroCtx, type Rendered } from './microCore';

/** sap.suite.ui.microchart.LineType */
export type LineType = 'Solid' | 'Dashed' | 'Dotted';
export const LineType = { Solid: 'Solid', Dashed: 'Dashed', Dotted: 'Dotted' } as const;
/** A line colour: one colour, or one above and one below the threshold. */
export type LineMicroChartColor = MicroChartColor | { above: MicroChartColor; below: MicroChartColor };

export interface $LineMicroChartPointSettings {
  /**
   * The horizontal position.
   * @defaultValue 0
   */
  x?: number;
  /**
   * The vertical position.
   * @defaultValue 0
   */
  y?: number;
}
/** A point of a line; rendered by its parent. */
export function LineMicroChartPoint(_: $LineMicroChartPointSettings): null {
  return null;
}
export interface $LineMicroChartEmphasizedPointSettings extends $LineMicroChartPointSettings {
  /**
   * The colour of the point (when shown).
   * @defaultValue 'Neutral'
   */
  color?: MicroChartColor;
  /**
   * The point is shown.
   * @defaultValue false
   */
  show?: boolean;
}
/** A point that can be shown in its own colour (focus mode); rendered by its parent. */
export function LineMicroChartEmphasizedPoint(_: $LineMicroChartEmphasizedPointSettings): null {
  return null;
}
type PointProp = $LineMicroChartEmphasizedPointSettings | ReactElement<$LineMicroChartPointSettings> | ReactElement<$LineMicroChartEmphasizedPointSettings>;

export interface $LineMicroChartLineSettings {
  /** The colour of the line (default: the chart's colour). */
  color?: LineMicroChartColor;
  /** Shows the points (priority over the chart's showPoints). */
  showPoints?: boolean;
  /**
   * The line type.
   * @defaultValue 'Solid'
   */
  type?: LineType;
  /** The points (default aggregation: also the point children). */
  points?: PointProp[];
  children?: ReactNode;
}
/** A line of LineMicroChart; rendered by its parent. */
export function LineMicroChartLine(_: $LineMicroChartLineSettings): null {
  return null;
}

export interface $LineMicroChartSettings extends MicroChartBaseSettings {
  /**
   * The threshold (vertical normalisation and the threshold line); `null` disables it.
   * @defaultValue 0
   */
  threshold?: number | null;
  /**
   * Shows the threshold line.
   * @defaultValue true
   */
  showThresholdLine?: boolean;
  /**
   * Shows the threshold value (with the threshold line).
   * @defaultValue false
   */
  showThresholdValue?: boolean;
  /** Shown instead of the threshold value. */
  thresholdDisplayValue?: string;
  minXValue?: number;
  maxXValue?: number;
  minYValue?: number;
  maxYValue?: number;
  leftTopLabel?: string;
  rightTopLabel?: string;
  leftBottomLabel?: string;
  rightBottomLabel?: string;
  /**
   * Shows the two top labels.
   * @defaultValue true
   */
  showTopLabels?: boolean;
  /**
   * Shows the two bottom labels.
   * @defaultValue true
   */
  showBottomLabels?: boolean;
  /**
   * The colour of the chart.
   * @defaultValue 'Neutral'
   */
  color?: LineMicroChartColor;
  /**
   * Shows the points.
   * @defaultValue false
   */
  showPoints?: boolean;
  /** The points of a single line (default aggregation: also the point children); when given, `lines` is ignored. */
  points?: PointProp[];
  /** The lines. */
  lines?: ($LineMicroChartLineSettings | ReactElement<$LineMicroChartLineSettings>)[];
  children?: ReactNode;
}

interface Pt { x: number; y: number; emphasized: boolean; color?: string; show?: boolean }
/** The points of an aggregation, with whether each is an emphasized point. */
function pointsOf(prop: PointProp[] | undefined, children: ReactNode): Pt[] {
  const plain = (s: $LineMicroChartEmphasizedPointSettings, emphasized: boolean): Pt => ({ x: s.x ?? 0, y: s.y ?? 0, emphasized, color: s.color, show: s.show });
  if (prop) return prop.map((x) => (isValidElement(x) ? plain(x.props as $LineMicroChartEmphasizedPointSettings, x.type === LineMicroChartEmphasizedPoint) : plain(x, 'show' in x || 'color' in x)));
  const out: Pt[] = [];
  const walk = (nodes: ReactNode) => {
    for (const c of ([] as ReactNode[]).concat(nodes)) {
      if (!isValidElement<$LineMicroChartEmphasizedPointSettings & { children?: ReactNode }>(c)) continue;
      const el = c;
      if (el.type === LineMicroChartPoint || el.type === LineMicroChartEmphasizedPoint) out.push(plain(el.props, el.type === LineMicroChartEmphasizedPoint));
      else if (typeof el.type === 'symbol') walk(el.props.children);
    }
  };
  walk(children);
  return out;
}

const isPair = (c: LineMicroChartColor | undefined): c is { above: MicroChartColor; below: MicroChartColor } => typeof c === 'object' && c !== null && 'above' in c;

function draw(p: $LineMicroChartSettings, gid: string, { t, fmt, compact }: MicroCtx): Rendered | undefined {
  const own = pointsOf(p.points, p.children);
  const lines = own.length
    ? [{ color: p.color, showPoints: p.showPoints, type: 'Solid' as LineType, pts: own }]
    : itemsOf(p.lines, undefined, LineMicroChartLine).map((l) => ({ color: l.color ?? p.color, showPoints: l.showPoints ?? p.showPoints, type: l.type ?? 'Solid', pts: pointsOf(l.points, l.children) }));
  const used = lines.map((l) => ({ ...l, pts: l.pts.filter((pt) => finite(pt.x) && finite(pt.y)) })).filter((l) => l.pts.length);
  if (!used.length) return undefined;
  const threshold = p.threshold === null ? undefined : finite(p.threshold) ? p.threshold : 0;
  const all = used.flatMap((l) => l.pts);
  let minX = Math.min(...all.map((pt) => pt.x));
  let maxX = Math.max(...all.map((pt) => pt.x));
  let minY = Math.min(...all.map((pt) => pt.y), ...(threshold !== undefined ? [threshold] : []));
  let maxY = Math.max(...all.map((pt) => pt.y), ...(threshold !== undefined ? [threshold] : []));
  if (finite(p.minXValue)) minX = p.minXValue;
  if (finite(p.maxXValue)) maxX = p.maxXValue;
  if (finite(p.minYValue)) minY = p.minYValue;
  if (finite(p.maxYValue)) maxY = p.maxYValue;
  const nx = (x: number) => (minX === maxX ? 50 : 2 + ((x - minX) / (maxX - minX)) * 96);
  const ny = (y: number) => 95 - (minY === maxY ? 50 : ((y - minY) / (maxY - minY)) * 100) * 0.9;
  const thresholdVisible = threshold !== undefined && threshold >= minY && threshold <= maxY;
  const lt = p.showTopLabels !== false && !compact && (p.leftTopLabel || p.rightTopLabel);
  const lb = p.showBottomLabels !== false && !compact && (p.leftBottomLabel || p.rightBottomLabel);
  const aria = unlabelled(t, 'chart.series', {
    points: used.map((l, i) => `${used.length > 1 ? `${t('chart.line', { n: i + 1 })} ` : ''}${l.pts.map((pt) => fmt(pt.y)).join(t('chart.listSeparator'))}`).join('; '),
  });
  return {
    aria,
    body: (
      <>
        {lt && <EdgeLabels first={p.leftTopLabel ?? ''} last={p.rightTopLabel ?? ''} kind="top" />}
        <span className="sk-microchart__plot-box">
          <svg className="sk-microchart__plot" viewBox="0 0 100 100" preserveAspectRatio="none" focusable="false">
            {thresholdVisible && p.showThresholdLine !== false && <line className="sk-microchart__threshold-line" data-sk-microchart-bar="threshold" x1={0} x2={100} y1={ny(threshold)} y2={ny(threshold)} vectorEffect="non-scaling-stroke" />}
            {used.map((l, li) => {
              const focus = l.pts.some((pt) => pt.emphasized);
              const semanticFocus = focus && l.pts.some((pt) => pt.emphasized && pt.show && pt.color && pt.color !== 'Neutral');
              const pair = !focus && isPair(l.color) && threshold !== undefined ? l.color : undefined;
              const single = colorOf(semanticFocus ? 'None' : isPair(l.color) ? 'Neutral' : (l.color as string | undefined) ?? 'Neutral');
              const above = pair ? colorOf(pair.above) : undefined;
              const below = pair ? colorOf(pair.below) : undefined;
              const id = `${gid}-${li}`;
              const dot = (pt: Pt) => (focus ? pt.emphasized && pt.show : Boolean(l.showPoints));
              const tone = (pt: Pt) => (focus ? colorOf(pt.color ?? 'Neutral') : pair ? (pt.y >= threshold! ? above! : below!) : single);
              return (
                <g key={li} className={cx(!pair && single.className, semanticFocus && 'sk-microchart__line--muted')} style={pair ? undefined : single.style} data-sk-microchart-line={li}>
                  {pair && (
                    // semantic mode: a hard colour stop at the threshold
                    <defs>
                      <linearGradient id={id} gradientUnits="userSpaceOnUse" x1={0} x2={0} y1={0} y2={100}>
                        <stop offset={ny(threshold!) / 100} className={above!.className} style={{ ...above!.style, stopColor: 'var(--sk-chart-mark)' }} />
                        <stop offset={ny(threshold!) / 100} className={below!.className} style={{ ...below!.style, stopColor: 'var(--sk-chart-mark)' }} />
                      </linearGradient>
                    </defs>
                  )}
                  <polyline className={cx('sk-microchart__line', l.type !== 'Solid' && `sk-microchart__line--${l.type.toLowerCase()}`)} style={pair ? { stroke: `url(#${id})` } : undefined}
                    points={l.pts.map((pt) => `${nx(pt.x).toFixed(2)},${ny(pt.y).toFixed(2)}`).join(' ')} vectorEffect="non-scaling-stroke" />
                  {/* Zero-length round-capped lines draw undistorted dots under preserveAspectRatio="none". */}
                  {!compact && l.pts.map((pt, i) => {
                    if (!dot(pt) && l.pts.length > 1) return null;
                    const c = tone(pt);
                    return <line key={i} className={cx('sk-microchart__dot', c.className)} style={c.style} data-sk-microchart-bar={`${li}-${i}`} x1={nx(pt.x)} x2={nx(pt.x)} y1={ny(pt.y)} y2={ny(pt.y)} vectorEffect="non-scaling-stroke" />;
                  })}
                </g>
              );
            })}
          </svg>
          {/* MC-39: the threshold value next to its line, only with the threshold line. */}
          {thresholdVisible && p.showThresholdLine !== false && p.showThresholdValue && !compact && (
            <span className="sk-microchart__threshold-label" data-sk-fit style={{ top: `${ny(threshold)}%` }}>
              <Num className="sk-microchart__muted">{p.thresholdDisplayValue ? p.thresholdDisplayValue : String(threshold)}</Num>
            </span>
          )}
        </span>
        {lb && <EdgeLabels first={p.leftBottomLabel ?? ''} last={p.rightBottomLabel ?? ''} kind="bottom" />}
      </>
    ),
  };
}

/** sap.suite.ui.microchart.LineMicroChart */
export function LineMicroChart(p: $LineMicroChartSettings) {
  const gid = useId().replace(/:/g, '');
  return <MicroChartRoot kind="line" base={p} draw={(c) => draw(p, `sk-lmc${gid}`, c)} />;
}
