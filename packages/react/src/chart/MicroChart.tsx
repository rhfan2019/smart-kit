/**
 * sap.fe.macros.MicroChart (docs/26b): the micro chart of a UI.Chart annotation (`contextPath` + `metaPath`), drawn
 * by the sap.suite.ui.microchart control of its chart type as FE's MicroChart.createMicroChart and MicroChartHelper do
 * (sap/fe/macros/MicroChart.tsx, microchart/MicroChartHelper.ts, microchart/MicroChartContainer.ts of 1.154).
 *
 * `MicroChartDrawing` is the same mapping for smart-kit's own callers (header facets, table and form cells), which read
 * the annotations themselves (chart/fromModel.ts) and pass the result as MicroChartData.
 */
import { chartExpand, chartIsSeries, resolvePath, type Row } from '@rhfan2019/smart-kit-core';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useService, useSmartKit, useText } from '../context/SmartKitProvider';
import { getPath, resolveRef } from '../field/values';
import { chartHidden, chartProps, MICRO_CHART_KIND } from './fromModel';
import { resolveChartMetaPath, resolveContextPath } from './metaPath';
import { AreaMicroChart, type $AreaMicroChartItemSettings } from './microArea';
import { BulletMicroChart } from './microBullet';
import { ColumnMicroChart } from './microColumn';
import { ComparisonMicroChart } from './microComparison';
import type { Size, ValueColor } from './microCore';
import { HarveyBallMicroChart } from './microHarvey';
import { LineMicroChart } from './microLine';
import { RadialMicroChart } from './microRadial';
import { StackedBarMicroChart } from './microStackedBar';

/** The eight micro chart types of UI.ChartType (MC-60); UI.Chart has no delta chart. */
export type MicroChartKind = 'bullet' | 'radial' | 'harvey' | 'column' | 'line' | 'comparison' | 'area' | 'stackedBar';
export type MicroChartCriticality = 0 | 1 | 2 | 3 | 5;
export interface MicroChartPoint {
  /** Dimension value (category or date) shown as a label. */
  label: string;
  value: number;
  criticality?: MicroChartCriticality;
  /** Area: the target value at this point (MC-46). */
  target?: number;
  /** Stacked bar: the measure's text, shown instead of the value (MC-59). */
  display?: string;
}
/** Area threshold boundaries, one value per point (MC-47). */
export interface MicroChartAreaThresholds {
  direction: 'Maximize' | 'Minimize' | 'Target';
  deviationLow?: number[];
  toleranceLow?: number[];
  toleranceHigh?: number[];
  deviationHigh?: number[];
}
/** A bullet chart threshold marker (MC-25). */
export interface MicroChartThreshold { value: number; criticality: MicroChartCriticality }

/** A micro chart read from the annotations (chart/fromModel.ts), the input of MicroChartDrawing (internal). */
export interface MicroChartData {
  kind: MicroChartKind;
  /** Accessible name, e.g. the facet title or the column header. */
  label?: string;
  /** Bullet, Radial, Harvey Ball: DataPoint/Value. */
  value?: number;
  /** Bullet target; radial total (none: the value is a percentage). */
  target?: number;
  /** Bullet forecast. */
  forecast?: number;
  /** DataPoint/MinimumValue. */
  min?: number;
  /** DataPoint/MaximumValue (Harvey Ball total). */
  max?: number;
  /** Bullet thresholds from CriticalityCalculation. */
  thresholds?: MicroChartThreshold[];
  /** Bullet: 'delta' for UI.VisualizationType/DeltaBulletChart. */
  mode?: 'actual' | 'delta';
  /** Semantic colour from Criticality / CriticalityCalculation. */
  criticality?: MicroChartCriticality;
  /** Series charts: one point per row of the collection. */
  points?: MicroChartPoint[];
  /** Line: one line per measure. */
  lines?: MicroChartPoint[][];
  /** Area: threshold areas from CriticalityCalculation. */
  areaThresholds?: MicroChartAreaThresholds;
  /** The control's size (default: the control's Auto; comparison Responsive, as in FE). */
  size?: Size;
  /** Render nothing without data (table cells, MC-06). */
  hideOnNoData?: boolean;
  /** Column and area labels (FE: not with showOnlyChart). Default true. */
  showLabels?: boolean;
  /** Kept for callers; the controls build their text alternative themselves. */
  format?(n: number): string;
  onPress?(): void;
}

export interface $MicroChartSettings {
  /** Entity set path of the annotated entity, e.g. "/Orders". */
  contextPath?: string;
  /**
   * Annotation path of the UI.Chart, e.g. "@com.sap.vocabularies.UI.v1.Chart#Budget" (alias "@UI.Chart#Budget"), or
   * "_Items/@UI.Chart#Trend" over a collection. Type, data, title and unit come from the annotations.
   */
  metaPath?: string;
  /**
   * Only the chart, without title, subtitle and unit of measure (and without the column and area labels, as in FE).
   * @defaultValue false
   */
  showOnlyChart?: boolean;
  /** The size of the micro chart (sap.m.Size; default: the control's Auto; Responsive for comparison charts, as in FE). */
  size?: Size;
  /** Render nothing when there is no data (table cells, MC-06); otherwise a "No data" placeholder (MC-05). */
  hideOnNoData?: boolean;
  /** The title is a link that fires `titlePress`. */
  titleAsLink?: boolean;
  /** Accessible name of the title link. */
  linkAriaText?: string;
  /** The title link was pressed (`titleAsLink`). */
  onTitlePress?(): void;
  /** Name of the service in `SmartKitProvider` `services`; default: the provider's `defaultService`. */
  service?: string;
  /** The annotated entity as read from the service (the binding context in Fiori elements); undefined while loading. */
  row?: Row;
  /** Entity path of the annotated entity, e.g. "Orders('1')": reads the collection of a chart over a navigation. */
  path?: string;
}

/** Maximum number of bars of a comparison chart (MC-41). */
export const MICRO_COMPARISON_MAX = 12;

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
/** FE CriticalityFormatters.buildExpressionForCriticality: Negative → Error, Critical, Positive → Good, else Neutral. */
const colorOf = (c: MicroChartCriticality | undefined): ValueColor | undefined => (c === undefined ? undefined : c === 1 ? 'Error' : c === 2 ? 'Critical' : c === 3 ? 'Good' : 'Neutral');
/** MicroChartHelper.getColorPaletteForMicroChart: the qualitative palette when the data point has no criticality. */
const QUALITATIVE = Array.from({ length: 11 }, (_, i) => `sapUiChartPaletteQualitativeHue${i + 1}`);

/** Whether the chart has something to draw (false: "No data", MC-05 / MC-06). */
export function microChartHasData(p: Pick<MicroChartData, 'kind' | 'value' | 'target' | 'max' | 'points' | 'lines'>): boolean {
  switch (p.kind) {
    case 'bullet': return finite(p.value);
    case 'radial': return finite(p.value);
    case 'harvey': return finite(p.value) && finite(p.max) && p.max > 0;
    case 'line': return (p.lines ?? [p.points ?? []]).some((l) => l.some((pt) => finite(pt.value)));
    case 'area': return (p.points ?? []).filter((pt) => finite(pt.value)).length > 1;
    default: return (p.points ?? []).some((pt) => finite(pt.value));
  }
}

/** The props of one sap.suite.ui.microchart control from annotation data (MicroChartHelper of FE 1.154). */
function renderControl(d: MicroChartData, size: Size | undefined, short: (n: number) => string) {
  const base = { size, hideOnNoData: d.hideOnNoData, onPress: d.onPress, 'aria-label': d.label };
  const pts = (d.points ?? []).filter((pt) => finite(pt.value));
  const labels = d.showLabels !== false;
  switch (d.kind) {
    case 'bullet':
      return (
        <BulletMicroChart {...base} targetValue={d.target} forecastValue={d.forecast} minValue={d.min} maxValue={d.max}
          actualValueLabel={finite(d.value) ? short(d.value) : undefined} targetValueLabel={finite(d.target) ? short(d.target) : undefined}
          showDeltaValue={d.mode === 'delta'} mode={d.mode === 'delta' ? 'Delta' : undefined}
          actual={finite(d.value) ? { value: d.value, color: colorOf(d.criticality) } : undefined}
          thresholds={(d.thresholds ?? []).map((th) => ({ value: th.value, color: colorOf(th.criticality) }))} />
      );
    case 'radial':
      return <RadialMicroChart {...base} total={d.target ?? 100} fraction={d.value} percentage={d.target === undefined ? d.value : undefined} valueColor={colorOf(d.criticality)} />;
    case 'harvey':
      return (
        <HarveyBallMicroChart {...base} formattedLabel totalLabel={finite(d.max) ? short(d.max) : undefined} total={d.max} colorPalette={d.criticality === undefined ? QUALITATIVE : undefined}
          items={finite(d.value) ? [{ formattedLabel: true, fractionLabel: short(d.value), fraction: d.value, color: colorOf(d.criticality) }] : []} />
      );
    case 'stackedBar':
      return <StackedBarMicroChart {...base} bars={pts.map((pt) => ({ value: pt.value, displayValue: pt.display, valueColor: colorOf(pt.criticality) }))} />;
    case 'comparison': {
      const semantic = pts.some((pt) => pt.criticality !== undefined);
      return (
        <ComparisonMicroChart {...base} size={size ?? 'Responsive'} minValue={d.min} maxValue={d.max} colorPalette={semantic ? undefined : QUALITATIVE}
          data={pts.slice(0, MICRO_COMPARISON_MAX).map((pt) => ({ value: pt.value, color: colorOf(pt.criticality), title: pt.label, displayValue: short(pt.value) }))} />
      );
    }
    case 'column': {
      const first = pts[0];
      const last = pts[pts.length - 1];
      // MicroChartContainer._setChartLabels: first / last value (in their criticality colour) and dimension value
      const corner = (label: string | undefined, c?: MicroChartCriticality) => (labels ? { label: label ?? '', color: colorOf(c) } : undefined);
      return (
        <ColumnMicroChart {...base} columns={pts.map((pt) => ({ value: pt.value, color: colorOf(pt.criticality), label: pt.label }))}
          leftTopLabel={corner(first && short(first.value), first?.criticality)} rightTopLabel={corner(last && pts.length > 1 ? short(last.value) : '', last?.criticality)}
          leftBottomLabel={corner(first?.label)} rightBottomLabel={corner(pts.length > 1 ? last?.label : '')} />
      );
    }
    case 'line': {
      const lines = (d.lines ?? [d.points ?? []]).map((l) => l.map((pt, i) => ({ ...pt, i })).filter((pt) => finite(pt.value))).filter((l) => l.length);
      const firsts = lines.map((l) => l[0]!.value);
      const lasts = lines.map((l) => l[l.length - 1]!.value);
      const dims = lines[0] ?? [];
      // MicroChartContainer: top labels are the smallest first and the largest last value; each line takes the colour of
      // its last point's criticality
      return (
        <LineMicroChart {...base} showThresholdLine={false}
          leftTopLabel={firsts.length ? short(Math.min(...firsts)) : undefined} rightTopLabel={lasts.length && dims.length > 1 ? short(Math.max(...lasts)) : undefined}
          leftBottomLabel={dims[0]?.label} rightBottomLabel={dims.length > 1 ? dims[dims.length - 1]!.label : undefined}
          lines={lines.map((l) => ({ color: colorOf(l[l.length - 1]!.criticality), points: l.map((pt) => ({ x: pt.i, y: pt.value })) }))} />
      );
    }
    case 'area': {
      const first = pts[0];
      const last = pts[pts.length - 1];
      const th = d.areaThresholds;
      const item = (values: (number | undefined)[] | undefined, color?: ValueColor): $AreaMicroChartItemSettings | undefined =>
        values ? { color, points: pts.map((pt, i) => ({ x: i, y: values[i] })).filter((pt) => finite(pt.y)) } : undefined;
      const lab = (label: string | undefined, c?: MicroChartCriticality) => (labels ? { label: label ?? '', color: colorOf(c) } : undefined);
      // MicroChartHelper.getAreaMicroChartAggregations: threshold items by improvement direction
      return (
        <AreaMicroChart {...base} chart={item(pts.map((pt) => pt.value))} target={item(pts.map((pt) => pt.target))}
          minThreshold={th?.direction === 'Minimize' ? item(th.toleranceHigh, 'Good') : th ? item(th.deviationLow, 'Error') : undefined}
          maxThreshold={th?.direction === 'Minimize' ? item(th.deviationHigh, 'Error') : th?.direction === 'Maximize' ? item(th.toleranceLow, 'Good') : th ? item(th.deviationHigh, 'Error') : undefined}
          innerMinThreshold={th?.direction === 'Target' ? item(th.toleranceLow, 'Good') : undefined}
          innerMaxThreshold={th?.direction === 'Target' ? item(th.toleranceHigh, 'Good') : undefined}
          firstYLabel={lab(first && short(first.value), first?.criticality)} lastYLabel={lab(last && short(last.value), last?.criticality)}
          firstXLabel={lab(first?.label)} lastXLabel={lab(last?.label)} />
      );
    }
  }
}

/** The short number format of FE's labels (NumberFormat style "short"). */
function useShort() {
  const { intlLocale } = useSmartKit();
  return useMemo(() => {
    const f = new Intl.NumberFormat(intlLocale, { notation: 'compact', maximumFractionDigits: 1 });
    return (n: number) => f.format(n);
  }, [intlLocale]);
}

/**
 * Draws annotation data with its sap.suite.ui.microchart control (internal: header facets, table and form cells).
 * Without `size` the control's default (Auto) applies, as for FE's header facets; FE's table cells pass XS.
 */
export function MicroChartDrawing(p: MicroChartData) {
  const short = useShort();
  return renderControl(p, p.size, short);
}

/** Micro chart building block (sap.fe.macros.MicroChart): the UI.Chart annotation decides type, data, title and unit. */
export function MicroChart(p: $MicroChartSettings) {
  const service = useService(p.service);
  const { intlLocale, timeZone } = useSmartKit();
  const t = useText();
  const short = useShort();
  const model = service.model;
  const ctx = p.contextPath ? resolveContextPath(model, p.contextPath) : undefined;
  const typeName = ctx?.typeName ?? '';
  const chart = ctx && p.metaPath ? resolveChartMetaPath(model, typeName, p.metaPath) : undefined;
  const kind = chart ? MICRO_CHART_KIND[chart.chartType] : undefined;
  const series = chart ? chartIsSeries(model, typeName, chart) : false;
  const q = useQuery({
    // The same key, $select, order and size as the header facets and table cells (ADR-025).
    queryKey: ['smart-kit', 'microchart', service.name, p.path, chart?.navigation, chart?.id],
    enabled: series && Boolean(p.path) && Boolean(kind),
    queryFn: ({ signal }) => {
      const e = chartExpand(model, chart!);
      return service.dataProvider.query({ source: { parent: p.path!, navigation: chart!.navigation }, select: e.select, expand: [], orderBy: e.orderBy ?? [], top: e.top, count: false }, { signal });
    },
    staleTime: 30_000,
  });
  if (!chart || !kind || chartHidden(model, chart)) return null;
  const data = chartProps({ model, locale: intlLocale, timeZone }, typeName, chart, p.row, series && p.path ? q.data?.rows ?? [] : undefined) ?? { kind };
  const hasData = microChartHasData(data);
  if (!hasData && p.hideOnNoData) return null;
  const measure = chart.measures[0]!;
  const dim = chart.dimensions[0];
  const measureProp = resolvePath(model.entityTypes, chart.typeName, measure).property;
  const dimProp = dim ? resolvePath(model.entityTypes, chart.typeName, dim).property : undefined;
  const unitRow = series ? q.data?.rows[0] : chart.navigation ? (getPath(p.row, chart.navigation) as Row | undefined) : p.row;
  const unit = measureProp?.unit ? String(resolveRef(unitRow, measureProp.unit) ?? '') : '';
  const title = chart.title;
  const drawing = renderControl({ ...data, label: title, hideOnNoData: p.hideOnNoData, showLabels: !p.showOnlyChart }, p.size, short);
  if (p.showOnlyChart) return drawing;
  const subtitle = series && dimProp ? t('chart.caption', { measure: measureProp?.label ?? measure, dimension: dimProp.label }) : undefined;
  return (
    <div className="sk-microchart-block" data-sk-microchart-block={chart.id}>
      <div className="sk-facet__title">
        {p.titleAsLink ? (
          <button type="button" className="sk-link sk-microchart-block__link" aria-label={p.linkAriaText} onClick={() => p.onTitlePress?.()} data-sk-microchart-title-link>{title}</button>
        ) : title}
      </div>
      {subtitle ? <div className="sk-facet__subtitle">{subtitle}</div> : null}
      <div className="sk-facet__chart">{drawing}</div>
      {/* MC-06: without data the footer goes too; MC-51: a radial chart shows a percentage, no unit. */}
      {unit && hasData && kind !== 'radial' ? <div className="sk-facet__footer" data-sk-facet-footer>{unit}</div> : null}
    </div>
  );
}
