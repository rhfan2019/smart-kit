/**
 * ComparisonMicroChart + ComparisonMicroChartData (sap.suite.ui.microchart, 1.154): one horizontal bar per item from a
 * common zero line (docs/15 MC-41 … MC-43). Views follow ComparisonMicroChart._getCurrentLookClass: Wide puts the title
 * left and the value right of each bar; Responsive does so above 12rem; otherwise title and value sit above the bar and
 * a chart up to 6rem wide shows bars only. colorPalette replaces the items' colours, cycled.
 */
import type { ReactElement, ReactNode } from 'react';
import { cx, finite, itemColor, itemsOf, MicroChartRoot, Num, scale, stateText, unlabelled, type MicroChartBaseSettings, type MicroChartColor, type MicroCtx, type Rendered } from './microCore';

/** sap.suite.ui.microchart.ComparisonMicroChartViewType */
export type ComparisonMicroChartViewType = 'Normal' | 'Wide' | 'Responsive';
export const ComparisonMicroChartViewType = { Normal: 'Normal', Wide: 'Wide', Responsive: 'Responsive' } as const;

export interface $ComparisonMicroChartDataSettings {
  /**
   * The value.
   * @defaultValue 0
   */
  value?: number;
  /**
   * The colour of the bar.
   * @defaultValue 'Neutral'
   */
  color?: MicroChartColor;
  /**
   * The title of the bar.
   * @defaultValue ''
   */
  title?: string;
  /**
   * Shown instead of the value.
   * @defaultValue ''
   */
  displayValue?: string;
  /** The bar was pressed. */
  onPress?: () => void;
}
/** A bar of ComparisonMicroChart; rendered by its parent. */
export function ComparisonMicroChartData(_: $ComparisonMicroChartDataSettings): null {
  return null;
}

export interface $ComparisonMicroChartSettings extends MicroChartBaseSettings {
  /**
   * The scaling suffix added to the values.
   * @defaultValue ''
   */
  scale?: string;
  /** The start of the scale (for comparable charts). */
  minValue?: number;
  /** The end of the scale (for comparable charts). */
  maxValue?: number;
  /**
   * The view of the chart.
   * @defaultValue 'Normal'
   */
  view?: ComparisonMicroChartViewType;
  /**
   * Colours assigned to the bars in turn; replaces the items' colours.
   * @defaultValue []
   */
  colorPalette?: string[];
  /**
   * The height is defined by the content.
   * @defaultValue false
   */
  shrinkable?: boolean;
  /** The bars (default aggregation: also the ComparisonMicroChartData children). */
  data?: ($ComparisonMicroChartDataSettings | ReactElement<$ComparisonMicroChartDataSettings>)[];
  children?: ReactNode;
}

/** 12rem and 6rem (THRESHOLD_LOOK_L, THRESHOLD_LOOK_XS of ComparisonMicroChart). */
const WIDE_PX = 192;
const BARE_PX = 96;

function draw(p: $ComparisonMicroChartSettings, items: $ComparisonMicroChartDataSettings[], { t, fmt, w }: MicroCtx): Rendered | undefined {
  const pts = items.map((d) => ({ ...d, value: d.value ?? 0 })).filter((d) => finite(d.value));
  if (!pts.length) return undefined;
  const x = scale([...pts.map((d) => d.value), ...(finite(p.minValue) ? [p.minValue] : []), ...(finite(p.maxValue) ? [p.maxValue] : [])]);
  const z = x(0);
  const view = p.view ?? 'Normal';
  const layout = view === 'Wide' || (view === 'Responsive' && (w === undefined || w > WIDE_PX)) ? 'wide' : w !== undefined && w <= BARE_PX ? 'bare' : 'normal';
  const sc = p.scale ?? '';
  return {
    aria: unlabelled(t, 'chart.series', { points: pts.map((d, i) => t('chart.seriesItem', { name: d.title ?? '', value: fmt(d.value) }) + stateText(t, p.colorPalette?.length ? undefined : items[i]?.color)).join(t('chart.listSeparator')) }),
    body: (
      <span className={cx('sk-microchart__rows', `sk-microchart__rows--${layout}`)}>
        {pts.map((d, i) => {
          const c = itemColor(p.colorPalette, i, d.color ?? 'Neutral');
          const bar = (
            <svg className="sk-microchart__row-plot" viewBox="0 0 100 10" preserveAspectRatio="none" focusable="false">
              <rect className="sk-microchart__track" x={0} y={0} width={100} height={10} />
              <rect className={cx('sk-microchart__mark', c.className, d.onPress && 'sk-microchart__mark--pressable')} style={c.style} data-sk-microchart-bar={i}
                x={Math.min(z, x(d.value))} y={0} width={Math.max(Math.abs(x(d.value) - z), 0.5)} height={10}
                onClick={d.onPress ? (e) => { e.stopPropagation(); d.onPress!(); } : undefined} />
            </svg>
          );
          if (layout === 'bare') return <span key={i} className="sk-microchart__row">{bar}</span>;
          const name = <span className="sk-microchart__row-label" title={d.title}>{d.title}</span>;
          // The value label has the bar's colour (SAP anatomy).
          const value = <span data-sk-fit className={cx('sk-microchart__row-fit', c.className)} style={c.style}><Num className="sk-microchart__row-value">{`${d.displayValue ? d.displayValue : d.value}${sc}`}</Num></span>;
          return layout === 'wide'
            ? <span key={i} className="sk-microchart__row">{name}{bar}{value}</span>
            : <span key={i} className="sk-microchart__row"><span className="sk-microchart__row-head">{name}{value}</span>{bar}</span>;
        })}
      </span>
    ),
  };
}

/** sap.suite.ui.microchart.ComparisonMicroChart */
export function ComparisonMicroChart(p: $ComparisonMicroChartSettings) {
  const items = itemsOf(p.data, p.children, ComparisonMicroChartData);
  return <MicroChartRoot kind="comparison" base={p} draw={(c) => draw(p, items, c)} extraClass={p.shrinkable ? 'sk-microchart--shrinkable' : undefined} />;
}
