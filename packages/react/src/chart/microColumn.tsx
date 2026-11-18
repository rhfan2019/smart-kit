/**
 * ColumnMicroChart + ColumnMicroChartData + ColumnMicroChartLabel (sap.suite.ui.microchart, 1.154): columns from a
 * zero baseline, four corner labels (given by the label aggregations, shown with showTopLabels / showBottomLabels) and,
 * with allowColumnLabels and enough room, a label per column instead of the top labels (docs/15 MC-30 … MC-33).
 */
import type { ReactElement, ReactNode } from 'react';
import { colorOf, cx, EdgeLabels, finite, itemOf, itemsOf, MicroChartRoot, Num, scale, unlabelled, type MicroChartBaseSettings, type MicroChartColor, type MicroCtx, type Rendered } from './microCore';

export interface $ColumnMicroChartDataSettings {
  /**
   * The colour of the column.
   * @defaultValue 'Neutral'
   */
  color?: MicroChartColor;
  /**
   * The title of the column (text alternative).
   * @defaultValue ''
   */
  label?: string;
  /** Shown instead of the value as the column label (allowColumnLabels). */
  displayValue?: string;
  /** The value. */
  value?: number;
  /** The column was pressed. */
  onPress?: () => void;
}
/** A column of ColumnMicroChart; rendered by its parent. */
export function ColumnMicroChartData(_: $ColumnMicroChartDataSettings): null {
  return null;
}
export interface $ColumnMicroChartLabelSettings {
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
/** A corner label of ColumnMicroChart; rendered by its parent. */
export function ColumnMicroChartLabel(_: $ColumnMicroChartLabelSettings): null {
  return null;
}

type Label = $ColumnMicroChartLabelSettings | ReactElement<$ColumnMicroChartLabelSettings>;
export interface $ColumnMicroChartSettings extends MicroChartBaseSettings {
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
   * With enough room, a label per column replaces the top labels.
   * @defaultValue false
   */
  allowColumnLabels?: boolean;
  /** The columns (default aggregation: also the ColumnMicroChartData children). */
  columns?: ($ColumnMicroChartDataSettings | ReactElement<$ColumnMicroChartDataSettings>)[];
  leftTopLabel?: Label;
  rightTopLabel?: Label;
  leftBottomLabel?: Label;
  rightBottomLabel?: Label;
  children?: ReactNode;
}

/** Approximate width (px) of one label character, for choosing the column label mode before rendering. */
const CHAR_WIDTH = 7;
const labelOf = (l: Label | undefined) => itemOf(l, undefined, ColumnMicroChartLabel);
/** Neutral labels are plain text; other colours colour the label (UI5 colours Neutral labels grey). */
const tone = (c: string | undefined) => (c && c !== 'Neutral' ? c : undefined);

function draw(p: $ColumnMicroChartSettings, columns: $ColumnMicroChartDataSettings[], { t, fmt, compact, w, h }: MicroCtx): Rendered | undefined {
  const pts = columns.filter((c) => finite(c.value)) as (Omit<$ColumnMicroChartDataSettings, 'value'> & { value: number })[];
  if (!pts.length) return undefined;
  const y = scale(pts.map((pt) => pt.value));
  const texts = pts.map((pt) => pt.displayValue ? pt.displayValue : String(pt.value));
  // MC-31, MC-32: a label per column from 72 px height when every column is at least as wide as its label.
  const longest = Math.max(...texts.map((s) => s.length));
  const perColumn = Boolean(p.allowColumnLabels) && !compact && (h === undefined || h >= 72) && (w === undefined || w / pts.length >= longest * CHAR_WIDTH);
  const base = 100 - y(0);
  const band = 100 / pts.length;
  const lt = labelOf(p.leftTopLabel);
  const rt = labelOf(p.rightTopLabel);
  const lb = labelOf(p.leftBottomLabel);
  const rb = labelOf(p.rightBottomLabel);
  const top = !compact && !perColumn && p.showTopLabels !== false && (lt?.label || rt?.label);
  const bottom = !compact && p.showBottomLabels !== false && (lb?.label || rb?.label);
  return {
    aria: unlabelled(t, 'chart.series', { points: pts.map((pt) => t('chart.seriesItem', { name: pt.label ?? '', value: fmt(pt.value) })).join(t('chart.listSeparator')) }),
    body: (
      <>
        {top && <EdgeLabels first={lt?.label ?? ''} last={rt?.label ?? ''} kind="top" colors={[tone(lt?.color), tone(rt?.color)]} />}
        {perColumn && (
          <span className="sk-microchart__column-labels" data-sk-fit>
            {pts.map((pt, i) => { const c = colorOf(tone(pt.color)); return <Num key={i} className={cx(c.className, (c.className || c.style) && 'sk-microchart__value--mark')} style={c.style}>{texts[i]}</Num>; })}
          </span>
        )}
        <svg className="sk-microchart__plot" viewBox="0 0 100 100" preserveAspectRatio="none" focusable="false">
          {pts.map((pt, i) => {
            const top = 100 - y(pt.value);
            const c = colorOf(pt.color ?? 'Neutral');
            return (
              <rect key={i} className={cx('sk-microchart__mark', c.className, pt.onPress && 'sk-microchart__mark--pressable')} style={c.style} data-sk-microchart-bar={i}
                x={i * band + band * 0.1} y={Math.min(top, base)} width={band * 0.8} height={Math.max(Math.abs(base - top), 0.5)}
                onClick={pt.onPress ? (e) => { e.stopPropagation(); pt.onPress!(); } : undefined} />
            );
          })}
          <line className="sk-microchart__baseline" x1={0} x2={100} y1={base} y2={base} vectorEffect="non-scaling-stroke" />
        </svg>
        {bottom && <EdgeLabels first={lb?.label ?? ''} last={rb?.label ?? ''} kind="bottom" />}
      </>
    ),
  };
}

/** sap.suite.ui.microchart.ColumnMicroChart */
export function ColumnMicroChart(p: $ColumnMicroChartSettings) {
  const columns = itemsOf(p.columns, p.children, ColumnMicroChartData);
  return <MicroChartRoot kind="column" base={p} draw={(c) => draw(p, columns, c)} />;
}
