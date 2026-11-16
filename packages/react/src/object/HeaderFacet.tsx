/**
 * One header facet (OP Header Content): form, plain text, image (in the layout), key value, micro chart, progress and
 * rating (single or aggregated).
 */
import { Modal } from '@mantine/core';
import { chartExpand, chartIsSeries, formatNumber, resolvePath, type ChartModel, type FieldModel, type HeaderFacetModel, type Row } from '@rhfan2019/smart-kit-core';
import { useQuery } from '@tanstack/react-query';
import { Fragment, useState, type ReactNode } from 'react';
import { MicroChart, microChartHasData, type MicroChartProps } from '../chart/MicroChart';
import { chartHidden, chartProps, MICRO_CHART_KIND } from '../chart/fromModel';
import { SimpleChart } from '../chart/SimpleChart';
import { useService, useSmartKit, useText } from '../context/SmartKitProvider';
import { CriticalityIcon, SmartField } from '../field/SmartField';
import { fieldValue, getPath, resolveRef } from '../field/values';

export interface HeaderFacetProps {
  facet?: HeaderFacetModel;
  typeName: string;
  row: Row | undefined;
  service?: string;
  /** Entity path of the object (micro charts over a collection navigation). */
  path?: string;
  /** Plain text facet or custom content. */
  title?: ReactNode;
  children?: ReactNode;
}

const STATUS = ['neutral', 'negative', 'critical', 'positive', 'neutral', 'info'];

/** Plain text with http(s) URLs as links (no HTML from the server is rendered). */
export function linkify(text: string): ReactNode[] {
  return text.split(/(https?:\/\/[^\s)]+)/g).map((part, i) => (/^https?:\/\//.test(part) ? <a key={i} className="sk-link" href={part} target="_blank" rel="noreferrer">{part}</a> : <Fragment key={i}>{part}</Fragment>));
}

function ChartFacet({ facet, chart, row, typeName, service: serviceName, path }: { facet: HeaderFacetModel; chart: ChartModel; row: Row | undefined; typeName: string; service?: string; path?: string }) {
  const service = useService(serviceName);
  const { intlLocale, timeZone } = useSmartKit();
  const t = useText();
  const [opened, setOpened] = useState(false);
  const kind = MICRO_CHART_KIND[chart.chartType];
  const model = service.model;
  const series = chartIsSeries(model, typeName, chart);
  const measure = chart.measures[0]!;
  const dim = chart.dimensions[0];
  const dimProp = dim ? resolvePath(model.entityTypes, chart.typeName, dim).property : undefined;
  const q = useQuery({
    queryKey: ['smart-kit', 'microchart', service.name, path, chart.navigation, chart.id],
    enabled: series && Boolean(path) && Boolean(kind),
    queryFn: ({ signal }) => {
      // The same $select, order and size as in table cells (ADR-025).
      const e = chartExpand(model, chart);
      return service.dataProvider.query({ source: { parent: path!, navigation: chart.navigation }, select: e.select, expand: [], orderBy: e.orderBy ?? [], top: e.top, count: false }, { signal });
    },
    staleTime: 30_000,
  });
  const measureProp = resolvePath(model.entityTypes, chart.typeName, measure).property;
  const dp = chart.dataPoints[measure];
  const digits = dp?.fractionDigits ?? (typeof measureProp?.scale === 'number' ? measureProp.scale : undefined);
  const fmt = (n: number) => formatNumber(String(n), intlLocale, digits !== undefined ? { min: digits, max: digits } : { max: 2 });
  const unitRow = series ? q.data?.rows[0] : chart.navigation ? (getPath(row, chart.navigation) as Row | undefined) : row;
  const unit = measureProp?.unit ? String(resolveRef(unitRow, measureProp.unit) ?? '') : '';
  const label = facet.label ?? chart.title;
  if (!kind || chartHidden(model, chart)) {
    // MC-60: only the eight micro chart types of the OData V4 Fiori Elements are drawn; MC-12: hidden measure.
    if (!kind && import.meta.env?.DEV) console.warn(`[smart-kit] UI.ChartType "${chart.chartType}" is not a micro chart type (docs/15 MC-60)`);
    return null;
  }
  const props: Omit<MicroChartProps, 'label'> = chartProps({ model, locale: intlLocale, timeZone }, typeName, chart, row, series ? q.data?.rows ?? [] : undefined) ?? { kind };
  const seriesPoints = props.points ?? props.lines?.[0] ?? [];
  const hasData = microChartHasData(props);
  const loading = series && Boolean(path) && q.isPending;
  const subtitle = series && dimProp ? t('chart.caption', { measure: measureProp?.label ?? measure, dimension: dimProp.label }) : undefined;
  void timeZone;
  return (
    <div className="sk-facet sk-facet--chart" data-sk-facet={facet.id} data-sk-facet-kind="chart">
      <div className="sk-facet__title">{label}</div>
      {subtitle ? <div className="sk-facet__subtitle">{subtitle}</div> : null}
      <div className="sk-facet__chart">
        <MicroChart {...props} label={label} format={fmt} onPress={hasData ? () => setOpened(true) : undefined} />
      </div>
      {/* MC-06: without data the footer goes too; MC-51: a radial chart shows a percentage, no unit. */}
      {unit && hasData && kind !== 'radial' ? <div className="sk-facet__footer" data-sk-facet-footer>{unit}</div> : null}
      {/* While the series loads, keep the footer's line so the header does not grow when the unit arrives (no layout shift). */}
      {loading && measureProp?.unit && kind !== 'radial' ? <div className="sk-facet__footer sk-facet__footer--pending" aria-hidden>{'\u00a0'}</div> : null}
      <Modal opened={opened} onClose={() => setOpened(false)} title={label} size="lg" closeButtonProps={{ 'aria-label': t('common.close') }}>
        {series ? (
          <SimpleChart kind="column" title={label} measureLabel={measureProp?.label ?? measure} dimensionLabel={dimProp?.label ?? ''} data={seriesPoints.filter((p) => Number.isFinite(p.value)).map((p, i) => ({ key: String(i), label: p.label, value: p.value, formatted: `${fmt(p.value)} ${unit}`.trim() }))} format={fmt} height={260} />
        ) : (
          <SimpleChart kind="bar" title={label} measureLabel={measureProp?.label ?? measure} dimensionLabel="" format={fmt} height={200}
            data={[{ key: 'value', label: measureProp?.label ?? measure, value: props.value ?? 0 }, ...((props.target ?? props.max) !== undefined ? [{ key: 'target', label: dp?.title ?? '', value: (props.target ?? props.max)! }] : [])]} />
        )}
      </Modal>
    </div>
  );
}

export function HeaderFacet(p: HeaderFacetProps) {
  const service = useService(p.service);
  const { intlLocale, timeZone } = useSmartKit();
  const t = useText();
  if (!p.facet) {
    return (
      <div className="sk-facet sk-facet--text">
        {p.title ? <div className="sk-facet__title">{p.title}</div> : null}
        <div className="sk-facet__text">{p.children}</div>
      </div>
    );
  }
  const f = p.facet;
  if (f.kind === 'form') {
    return (
      <div className="sk-facet sk-facet--form" data-sk-facet={f.id} data-sk-facet-kind="form">
        {f.label ? <div className="sk-facet__title">{f.label}</div> : null}
        <dl className="sk-facet__pairs">
          {f.fields.slice(0, 5).map((fd) => (
            <div key={fd.id} className="sk-facet__pair">
              <dt>{fd.label}:</dt>
              <dd><SmartField typeName={p.typeName} service={p.service} field={fd} row={p.row} /></dd>
            </div>
          ))}
        </dl>
      </div>
    );
  }
  if (f.kind === 'text') {
    const text = f.field.path ? getPath(p.row, f.field.path) : undefined;
    return (
      <div className="sk-facet sk-facet--text" data-sk-facet={f.id} data-sk-facet-kind="text">
        {f.label ? <div className="sk-facet__title">{f.label}</div> : null}
        <div className="sk-facet__text">{text === null || text === undefined || text === '' ? '–' : linkify(String(text))}</div>
      </div>
    );
  }
  if (f.kind === 'chart') return <ChartFacet facet={f} chart={f.chart} row={p.row} typeName={p.typeName} service={p.service} path={p.path} />;
  const dp = f.dataPoint;
  const field: FieldModel = { id: f.id, kind: 'dataPoint', dataPoint: dp, label: f.label ?? dp.title, criticalityIcon: true, isSemanticKey: false };
  if (dp.visualization !== 'Number') {
    // Aggregated rating: the subtitle gives the number of ratings, the footer "x.x out of y" (OP Rating Indicator Facet).
    const samples = dp.visualization === 'Rating' && dp.sampleSize ? resolveRef(p.row, dp.sampleSize) : undefined;
    const value = getPath(p.row, dp.value);
    const max = Number(resolveRef(p.row, dp.targetValue) ?? 5) || 5;
    return (
      <div className={`sk-facet sk-facet--${dp.visualization.toLowerCase()}`} data-sk-facet={f.id} data-sk-facet-kind={dp.visualization === 'Rating' ? (samples !== undefined ? 'rating-aggregated' : 'rating') : 'progress'}>
        <div className="sk-facet__title">{f.label ?? dp.title}</div>
        {samples !== undefined ? <div className="sk-facet__subtitle" data-sk-facet-subtitle>{t('rating.samples', { count: String(samples) })}</div> : null}
        <div className="sk-facet__chart"><SmartField typeName={p.typeName} service={p.service} field={field} row={p.row} /></div>
        {samples !== undefined && value !== undefined && value !== null ? (
          <div className="sk-facet__footer" data-sk-facet-footer>{t('rating.outOf', { value: formatNumber(String(value), intlLocale, { min: 1, max: 1 }), max })}</div>
        ) : null}
      </div>
    );
  }
  const v = fieldValue({ model: service.model, typeName: p.typeName, locale: intlLocale, timeZone }, field, p.row);
  const crit = v.criticality;
  return (
    <div className="sk-facet sk-facet--kpi" data-sk-facet={f.id} data-sk-facet-kind="kpi">
      <div className="sk-facet__title">{f.label ?? dp.title}</div>
      <div className={['sk-facet__kpi', crit !== undefined ? `sk-status sk-status--${STATUS[crit] ?? 'neutral'}` : ''].join(' ')}>
        <span className="sk-facet__kpi-value">{v.display}</span>
        {v.unit ? <span className="sk-facet__kpi-unit">{v.unit}</span> : null}
        {crit !== undefined ? <CriticalityIcon criticality={crit} /> : null}
      </div>
    </div>
  );
}
