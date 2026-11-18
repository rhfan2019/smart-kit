/**
 * UI.Chart + row → MicroChart props for the charts that use the row's own fields (Bullet, Radial, Harvey Ball;
 * docs/15 §3). Shared by HeaderFacet and SmartField (table and form cells).
 */
import { calculateCriticality, chartIsSeries, formatValue, MICRO_CHART_MAX_POINTS, resolvePath, type ChartModel, type CriticalityCalculationModel, type DataPointModel, type MetaModel, type Row, type ValueRef } from '@rhfan2019/smart-kit-core';
import { getPath, resolveRef } from '../field/values';
import { MICRO_COMPARISON_MAX, type MicroChartCriticality, type MicroChartKind, type MicroChartPoint, type MicroChartData, type MicroChartThreshold } from './MicroChart';

/** UI.ChartType → micro chart (MC-60): the eight types of the OData V4 Fiori Elements. Others draw nothing. */
export const MICRO_CHART_KIND: Partial<Record<string, MicroChartKind>> = {
  Bullet: 'bullet', Donut: 'radial', Pie: 'harvey', Column: 'column', Line: 'line', Area: 'area', Bar: 'comparison', BarStacked: 'stackedBar',
};

/** Chart types drawn from the row's own fields. */
export const ROW_CHART_KINDS: readonly MicroChartKind[] = ['bullet', 'radial', 'harvey'];

const num = (v: unknown): number | undefined => {
  if (v === null || v === undefined || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};
const CRIT = new Set([0, 1, 2, 3, 5]);

/** Semantic colour of a data point: Criticality, else CriticalityCalculation (MC-09). */
export function dataPointCriticality(dp: DataPointModel | undefined, row: Row | undefined, value: number | undefined): MicroChartCriticality | undefined {
  if (!dp) return undefined;
  if (dp.criticality) {
    const c = num(resolveRef(row, dp.criticality));
    return c !== undefined && CRIT.has(c) ? (c as MicroChartCriticality) : undefined;
  }
  if (dp.criticalityCalculation && value !== undefined) {
    return calculateCriticality(dp.criticalityCalculation, value, (ref: ValueRef | undefined) => num(resolveRef(row, ref)));
  }
  return undefined;
}

/** Bullet threshold markers (MC-25): the low side unless Minimize, the high side unless Maximize. */
export function bulletThresholds(cc: CriticalityCalculationModel | undefined, row: Row | undefined): MicroChartThreshold[] {
  if (!cc) return [];
  const out: MicroChartThreshold[] = [];
  const add = (ref: ValueRef | undefined, criticality: MicroChartCriticality) => {
    const v = num(resolveRef(row, ref));
    if (v !== undefined) out.push({ value: v, criticality });
  };
  if (cc.improvementDirection !== 'Minimize') { add(cc.deviationRangeLowValue, 1); add(cc.toleranceRangeLowValue, 2); }
  if (cc.improvementDirection !== 'Maximize') { add(cc.toleranceRangeHighValue, 2); add(cc.deviationRangeHighValue, 1); }
  return out;
}

/** The measure is hidden by UI.Hidden: no chart (MC-12). */
export function chartHidden(model: MetaModel, chart: ChartModel): boolean {
  const m = chart.measures[0];
  return Boolean(m && resolvePath(model.entityTypes, chart.typeName, m).property?.hidden);
}

/** Props of a row chart, or undefined when the chart type is not drawn from the row. */
export function rowChartProps(chart: ChartModel, row: Row | undefined): Pick<MicroChartData, 'kind' | 'value' | 'target' | 'forecast' | 'min' | 'max' | 'thresholds' | 'mode' | 'criticality'> | undefined {
  const kind = MICRO_CHART_KIND[chart.chartType];
  if (!kind || !ROW_CHART_KINDS.includes(kind)) return undefined;
  const measure = chart.measures[0]!;
  const dp = chart.dataPoints[measure];
  const value = num(getPath(row, dp?.value ?? measure));
  const criticality = dataPointCriticality(dp, row, value);
  if (kind === 'bullet') {
    return {
      kind, value, criticality,
      target: num(resolveRef(row, dp?.targetValue)),
      forecast: num(resolveRef(row, dp?.forecastValue)),
      min: num(resolveRef(row, dp?.minimumValue)),
      max: num(resolveRef(row, dp?.maximumValue)),
      thresholds: bulletThresholds(dp?.criticalityCalculation, row),
      mode: dp?.deltaBullet ? 'delta' : 'actual',
    };
  }
  // Radial: TargetValue is the total (none: the value is a percentage, MC-51). Harvey Ball: MaximumValue (MC-55).
  if (kind === 'radial') return { kind, value, criticality, target: num(resolveRef(row, dp?.targetValue)) };
  return { kind, value, criticality, max: num(resolveRef(row, dp?.maximumValue)) };
}

export interface SeriesContext { model: MetaModel; locale: string; timeZone?: string }

/** Label of a row's dimension value: its Common.Text, else the formatted value (dates in the locale). */
function dimensionLabel(ctx: SeriesContext, chart: ChartModel, row: Row): string {
  const dim = chart.dimensions[0];
  if (!dim) return '';
  const prop = resolvePath(ctx.model.entityTypes, chart.typeName, dim).property;
  const text = prop?.text ? getPath(row, prop.text) : undefined;
  if (text !== undefined && text !== null && text !== '') return String(text);
  const v = getPath(row, dim);
  return prop ? formatValue(v, prop, { locale: ctx.locale, timeZone: ctx.timeZone }) : String(v ?? '');
}

function measurePoints(ctx: SeriesContext, chart: ChartModel, measure: string, rows: Row[]): MicroChartPoint[] {
  const dp = chart.dataPoints[measure];
  const textPath = resolvePath(ctx.model.entityTypes, chart.typeName, measure).property?.text;
  return rows.map((r) => {
    const value = num(getPath(r, dp?.value ?? measure)) ?? Number.NaN;
    const display = textPath ? getPath(r, textPath) : undefined;
    return {
      label: dimensionLabel(ctx, chart, r),
      value,
      criticality: dataPointCriticality(dp, r, Number.isFinite(value) ? value : undefined),
      target: num(resolveRef(r, dp?.targetValue)),
      display: display === undefined || display === null || display === '' ? undefined : String(display),
    };
  });
}

/** Props of a chart whose data is a navigation collection (ADR-025): one point per row of `rows`. */
export function seriesChartProps(ctx: SeriesContext, chart: ChartModel, rows: Row[]): Omit<MicroChartData, 'label'> | undefined {
  const kind = MICRO_CHART_KIND[chart.chartType];
  if (!kind || ROW_CHART_KINDS.includes(kind)) return undefined;
  const measure = chart.measures[0]!;
  const dp = chart.dataPoints[measure];
  if (kind === 'line') {
    // MC-35: one line per measure, at most three.
    return { kind, lines: chart.measures.slice(0, 3).map((m) => measurePoints(ctx, chart, m, rows)) };
  }
  const points = measurePoints(ctx, chart, measure, kind === 'comparison' ? rows.slice(0, MICRO_COMPARISON_MAX) : rows);
  if (kind === 'area') {
    const cc = dp?.criticalityCalculation;
    const per = (ref: ValueRef | undefined) => (ref ? rows.map((r) => num(resolveRef(r, ref)) ?? Number.NaN) : undefined);
    return {
      kind, points,
      areaThresholds: cc ? { direction: cc.improvementDirection, deviationLow: per(cc.deviationRangeLowValue), toleranceLow: per(cc.toleranceRangeLowValue), toleranceHigh: per(cc.toleranceRangeHighValue), deviationHigh: per(cc.deviationRangeHighValue) } : undefined,
    };
  }
  // Comparison and stacked bar: MinimumValue / MaximumValue (constants) set the scale (MC-43, MC-59).
  const first = rows[0];
  return { kind, points, min: num(resolveRef(first, dp?.minimumValue)), max: num(resolveRef(first, dp?.maximumValue)) };
}

/** Props of any micro chart from the model: `data` is the row (charts of the row or of a single-valued navigation)
 * or the rows of the collection navigation (series). */
export function chartProps(ctx: SeriesContext, ownerType: string, chart: ChartModel, row: Row | undefined, rows?: Row[]): Omit<MicroChartData, 'label'> | undefined {
  if (chartIsSeries(ctx.model, ownerType, chart)) {
    const data = rows ?? (row ? getPath(row, chart.navigation) : undefined);
    // ADR-025: services may ignore $top inside $expand; the client keeps at most N rows.
    return seriesChartProps(ctx, chart, Array.isArray(data) ? (data as Row[]).slice(0, MICRO_CHART_MAX_POINTS) : []);
  }
  const target = chart.navigation ? (getPath(row, chart.navigation) as Row | undefined) ?? undefined : row;
  return rowChartProps(chart, target);
}

