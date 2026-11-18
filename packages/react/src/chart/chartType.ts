/**
 * UI.ChartType of the list report chart (docs/29 §5): the sap.chart type Fiori elements 1.154 maps each member to
 * (sap.fe.macros.chart.ChartHelper `ChartTypeEnum`, `formatChartType`), and how smart-kit's SVG chart draws it.
 */
import type { SimpleChartProps } from './SimpleChart';

/** UI.ChartType member → sap.chart chart type (FE ChartHelper ChartTypeEnum, verbatim). */
export const FE_CHART_TYPES: Readonly<Record<string, string>> = {
  Column: 'column',
  ColumnStacked: 'stacked_column',
  ColumnDual: 'dual_column',
  ColumnStackedDual: 'dual_stacked_column',
  ColumnStacked100: '100_stacked_column',
  ColumnStackedDual100: '100_dual_stacked_column',
  Bar: 'bar',
  BarStacked: 'stacked_bar',
  BarDual: 'dual_bar',
  BarStackedDual: 'dual_stacked_bar',
  BarStacked100: '100_stacked_bar',
  BarStackedDual100: '100_dual_stacked_bar',
  Area: 'area',
  AreaStacked: 'stacked_column',
  AreaStacked100: '100_stacked_column',
  HorizontalArea: 'bar',
  HorizontalAreaStacked: 'stacked_bar',
  HorizontalAreaStacked100: '100_stacked_bar',
  Line: 'line',
  LineDual: 'dual_line',
  Combination: 'combination',
  CombinationStacked: 'stacked_combination',
  CombinationDual: 'dual_combination',
  CombinationStackedDual: 'dual_stacked_combination',
  HorizontalCombinationStacked: 'horizontal_stacked_combination',
  Pie: 'pie',
  Donut: 'donut',
  Scatter: 'scatter',
  Bubble: 'bubble',
  Radar: 'line',
  HeatMap: 'heatmap',
  TreeMap: 'treemap',
  Waterfall: 'waterfall',
  Bullet: 'bullet',
  VerticalBullet: 'vertical_bullet',
  HorizontalWaterfall: 'horizontal_waterfall',
  HorizontalCombinationDual: 'dual_horizontal_combination',
  HorizontalCombinationStackedDual: 'dual_horizontal_stacked_combination',
};

/** The sap.chart type of a UI.ChartType member (FE gives `undefined` for a member it does not map; smart-kit "column"). */
export function feChartType(member: string): string {
  return FE_CHART_TYPES[member] ?? 'column';
}

/**
 * How smart-kit draws a sap.chart type: column, bar, line, area, pie and donut as they are, stacked and 100 % stacked
 * columns and bars stacked. The others (dual axes, combination, scatter, bubble, heat map, tree map, waterfall,
 * bullet) are drawn as the closest of these — columns, or bars for the horizontal types — with all measures as
 * series; `exact` is false for them (registered difference, docs/29 §5).
 */
export function drawnChart(type: string): { kind: SimpleChartProps['kind']; stacked?: true | 'percent'; exact: boolean } {
  switch (type) {
    case 'column': case 'bar': case 'line': case 'area': case 'pie': case 'donut': return { kind: type, exact: true };
    case 'stacked_column': return { kind: 'column', stacked: true, exact: true };
    case '100_stacked_column': return { kind: 'column', stacked: 'percent', exact: true };
    case 'stacked_bar': return { kind: 'bar', stacked: true, exact: true };
    case '100_stacked_bar': return { kind: 'bar', stacked: 'percent', exact: true };
    case 'dual_line': return { kind: 'line', exact: false };
    case 'dual_stacked_column': case 'stacked_combination': return { kind: 'column', stacked: true, exact: false };
    case '100_dual_stacked_column': return { kind: 'column', stacked: 'percent', exact: false };
    case 'dual_stacked_bar': case 'horizontal_stacked_combination': case 'dual_horizontal_stacked_combination': return { kind: 'bar', stacked: true, exact: false };
    case '100_dual_stacked_bar': return { kind: 'bar', stacked: 'percent', exact: false };
    case 'dual_bar': case 'dual_horizontal_combination': case 'horizontal_waterfall': case 'bullet': return { kind: 'bar', exact: false };
    default: return { kind: 'column', exact: false };
  }
}
