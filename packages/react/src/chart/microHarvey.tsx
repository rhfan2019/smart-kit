/**
 * HarveyBallMicroChart + HarveyBallMicroChartItem (sap.suite.ui.microchart, 1.154): a circle with a slice of the first
 * item's fraction of `total`, the fraction and the total beside it (docs/15 MC-54 … MC-57). Labels follow
 * HarveyBallMicroChartRenderer: the label replaces the number, the scale (at most 3 characters) follows it; with
 * `formattedLabel` the label already contains the scale.
 */
import type { ReactElement, ReactNode } from 'react';
import { clamp01, colorOf, finite, itemsOf, MicroChartRoot, Num, stateText, unlabelled, type HorizontalAlignmentType, type MicroChartBaseSettings, type MicroChartColor, type MicroCtx, type Rendered } from './microCore';

export interface $HarveyBallMicroChartItemSettings {
  /**
   * The colour of the slice and of the fraction label.
   * @defaultValue 'Neutral'
   */
  color?: MicroChartColor;
  /**
   * The fraction of the total that defines the slice.
   * @defaultValue 0
   */
  fraction?: number;
  /** Shown instead of the fraction value. */
  fractionLabel?: string;
  /** The scaling factor shown after the fraction value. */
  fractionScale?: string;
  /**
   * `fractionLabel` already combines the value and the scale.
   * @defaultValue false
   */
  formattedLabel?: boolean;
}
/** The item of HarveyBallMicroChart (only the first is drawn, as in UI5); rendered by its parent. */
export function HarveyBallMicroChartItem(_: $HarveyBallMicroChartItemSettings): null {
  return null;
}

export interface $HarveyBallMicroChartSettings extends MicroChartBaseSettings {
  /** The total (a full circle). */
  total?: number;
  /** Shown instead of the total value. */
  totalLabel?: string;
  /** The scaling factor shown after the total. */
  totalScale?: string;
  /**
   * `totalLabel` already combines the value and the scale.
   * @defaultValue false
   */
  formattedLabel?: boolean;
  /**
   * Shows the total.
   * @defaultValue true
   */
  showTotal?: boolean;
  /**
   * Shows the fraction.
   * @defaultValue true
   */
  showFractions?: boolean;
  /**
   * Colours; only the first is used and replaces the item's colour.
   * @defaultValue []
   */
  colorPalette?: string[];
  /**
   * The alignment of the content.
   * @defaultValue 'Left'
   */
  alignContent?: HorizontalAlignmentType;
  /**
   * The wider XS dimensions (7rem instead of 6rem).
   * @defaultValue false
   */
  xsWidth?: boolean;
  /** The items (default aggregation: also the HarveyBallMicroChartItem children). */
  items?: ($HarveyBallMicroChartItemSettings | ReactElement<$HarveyBallMicroChartItemSettings>)[];
  children?: ReactNode;
}

/** HarveyBallMicroChart._parseFormattedValue: "1.5K" → value "1.5", scale "K". */
const parse = (s: string) => ({ value: s.replace(/(.*?)[^+\-.,\d]*$/, '$1').trim(), scale: s.replace(/.*?([^+\-.,\d]*)$/, '$1').trim() });
function labelOf(label: string | undefined, value: number | undefined, scaleText: string | undefined, formatted: boolean | undefined) {
  const text = label ? label : `${value ?? ''}`;
  if (formatted) { const f = parse(text); return { value: f.value, scale: f.scale.slice(0, 3) }; }
  return { value: text, scale: (scaleText ?? '').slice(0, 3) };
}

function draw(p: $HarveyBallMicroChartSettings, items: $HarveyBallMicroChartItemSettings[], { t, fmt, compact }: MicroCtx): Rendered | undefined {
  const item = items[0];
  const total = p.total;
  if (!item || !finite(total) || total <= 0) return undefined;
  const value = item.fraction ?? 0;
  if (!finite(value)) return undefined;
  const f = clamp01(value / total);
  const a = f * 2 * Math.PI;
  // The slice is inset from the background circle (as in the SAP chart).
  const r = 16.5;
  const ex = 20 + r * Math.sin(a);
  const ey = 20 - r * Math.cos(a);
  const sector = f >= 1
    ? <circle className="sk-microchart__mark" data-sk-microchart-bar="value" cx={20} cy={20} r={r} />
    : f > 0 && <path className="sk-microchart__mark" data-sk-microchart-bar="value" d={`M20 20 L20 ${20 - r} A${r} ${r} 0 ${f > 0.5 ? 1 : 0} 1 ${ex.toFixed(3)} ${ey.toFixed(3)} Z`} />;
  const color = p.colorPalette?.length ? p.colorPalette[0] : item.color ?? 'Neutral';
  const fr = labelOf(item.fractionLabel, value, item.fractionScale, item.formattedLabel);
  const to = labelOf(p.totalLabel, total, p.totalScale, p.formattedLabel);
  return {
    mark: colorOf(color === 'None' ? 'Neutral' : color),
    aria: unlabelled(t, 'chart.valueOf', { value: fmt(value), target: fmt(total) }) + stateText(t, color),
    body: (
      <>
        <svg className="sk-microchart__circle" viewBox="0 0 40 40" focusable="false">
          <circle className="sk-microchart__track" cx={20} cy={20} r={18} />
          {sector}
        </svg>
        {/* MC-57: small charts keep only the slice label. */}
        <span className="sk-microchart__texts sk-microchart__texts--stack" data-sk-fit>
          {p.showFractions !== false && <Num className="sk-microchart__value sk-microchart__value--mark sk-microchart__value--large">{fr.value}{fr.scale ? <span className="sk-microchart__scale">{fr.scale}</span> : null}</Num>}
          {!compact && p.showTotal !== false && <Num>{to.value}{to.scale ? <span className="sk-microchart__scale">{to.scale}</span> : null}</Num>}
        </span>
      </>
    ),
  };
}

/** sap.suite.ui.microchart.HarveyBallMicroChart */
export function HarveyBallMicroChart(p: $HarveyBallMicroChartSettings) {
  const items = itemsOf(p.items, p.children, HarveyBallMicroChartItem);
  return <MicroChartRoot kind="harvey" base={p} draw={(c) => draw(p, items, c)} extraClass={`sk-microchart--align-${p.alignContent ?? 'Left'}${p.xsWidth ? ' sk-microchart--xs-wide' : ''}`} />;
}
