/**
 * One header facet (OP Header Content): form, plain text, image (in the layout), key value, micro chart, progress and
 * rating (single or aggregated).
 */
import { Modal } from '@mantine/core';
import { formatNumber, resolvePath, type ChartModel, type FieldModel, type HeaderFacetModel, type Row } from '@rhfan2019/smart-kit-core';
import { useQuery } from '@tanstack/react-query';
import { Fragment, useState, type ReactNode } from 'react';
import { MicroChart, type MicroChartKind } from '../chart/MicroChart';
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

/** UI.ChartType → micro chart (ADR-021; Waterfall is this library's convention for the delta micro chart). */
const KIND: Record<string, MicroChartKind> = { Bullet: 'bullet', VerticalBullet: 'bullet', Donut: 'radial', Pie: 'harvey', Waterfall: 'delta', HorizontalWaterfall: 'delta', Column: 'column', ColumnStacked: 'column', Line: 'line', Area: 'line', Bar: 'comparison', BarStacked: 'comparison' };

/** Plain text with http(s) URLs as links (no HTML from the server is rendered). */
export function linkify(text: string): ReactNode[] {
  return text.split(/(https?:\/\/[^\s)]+)/g).map((part, i) => (/^https?:\/\//.test(part) ? <a key={i} className="sk-link" href={part} target="_blank" rel="noreferrer">{part}</a> : <Fragment key={i}>{part}</Fragment>));
}

function ChartFacet({ facet, chart, row, service: serviceName, path }: { facet: HeaderFacetModel; chart: ChartModel; row: Row | undefined; service?: string; path?: string }) {
  const service = useService(serviceName);
  const { intlLocale, timeZone } = useSmartKit();
  const t = useText();
  const [opened, setOpened] = useState(false);
  const kind = KIND[chart.chartType] ?? 'column';
  const series = Boolean(chart.navigation);
  const model = service.model;
  const measure = chart.measures[0]!;
  const dim = chart.dimensions[0];
  const dimProp = dim ? resolvePath(model.entityTypes, chart.typeName, dim).property : undefined;
  const textPath = dimProp?.text;
  const q = useQuery({
    queryKey: ['smart-kit', 'microchart', service.name, path, chart.navigation, chart.id],
    enabled: series && Boolean(path),
    queryFn: ({ signal }) => {
      const select = [...new Set([...model.entityTypes[chart.typeName]!.keys, ...chart.measures, ...chart.dimensions, ...(textPath && !textPath.includes('/') ? [textPath] : [])])];
      return service.dataProvider.query({ source: { parent: path!, navigation: chart.navigation }, select, expand: [], orderBy: dim ? [{ path: dim, descending: false }] : [], top: kind === 'comparison' ? 4 : 12, count: false }, { signal });
    },
    staleTime: 30_000,
  });
  const measureProp = resolvePath(model.entityTypes, chart.typeName, measure).property;
  const num = (v: unknown) => (v === null || v === undefined || v === '' ? undefined : Number(v));
  const fmt = (n: number) => formatNumber(String(n), intlLocale, typeof measureProp?.scale === 'number' ? { min: measureProp.scale, max: measureProp.scale } : { max: 2 });
  const unit = measureProp?.unit ? String(resolveRef(row, measureProp.unit) ?? (series ? resolveRef(q.data?.rows[0], measureProp.unit) ?? '' : '')) : '';
  const dp = chart.dataPoints[measure];
  const label = facet.label ?? chart.title;
  let props: { value?: number; target?: number; min?: number; max?: number; points?: { label: string; value: number }[]; criticality?: 0 | 1 | 2 | 3 | 5 };
  if (series) {
    props = { points: (q.data?.rows ?? []).map((r) => ({ label: String((textPath ? getPath(r, textPath) : undefined) ?? (dim ? getPath(r, dim) : '') ?? ''), value: num(r[measure]) ?? 0 })) };
  } else if (kind === 'delta') {
    props = { value: num(getPath(row, measure)), target: num(getPath(row, chart.measures[1] ?? measure)) };
  } else {
    const c = dp?.criticality ? Number(resolveRef(row, dp.criticality)) : undefined;
    props = {
      value: num(getPath(row, dp?.value ?? measure)),
      target: num(resolveRef(row, dp?.targetValue)),
      min: num(resolveRef(row, dp?.minimumValue)),
      max: num(resolveRef(row, dp?.maximumValue)),
      criticality: c === 0 || c === 1 || c === 2 || c === 3 || c === 5 ? c : undefined,
    };
    if (kind === 'harvey' && props.target === undefined) props.target = props.max;
  }
  const subtitle = series && dimProp ? t('chart.caption', { measure: measureProp?.label ?? measure, dimension: dimProp.label }) : undefined;
  void timeZone;
  return (
    <div className="sk-facet sk-facet--chart" data-sk-facet={facet.id} data-sk-facet-kind="chart">
      <div className="sk-facet__title">{label}</div>
      {subtitle ? <div className="sk-facet__subtitle">{subtitle}</div> : null}
      <div className="sk-facet__chart">
        <MicroChart kind={kind} label={label} format={fmt} onPress={() => setOpened(true)} {...props} />
      </div>
      {unit ? <div className="sk-facet__footer" data-sk-facet-footer>{unit}</div> : null}
      <Modal opened={opened} onClose={() => setOpened(false)} title={label} size="lg" closeButtonProps={{ 'aria-label': t('common.close') }}>
        {series ? (
          <SimpleChart kind="column" title={label} measureLabel={measureProp?.label ?? measure} dimensionLabel={dimProp?.label ?? ''} data={(props.points ?? []).map((p, i) => ({ key: String(i), label: p.label, value: p.value, formatted: `${fmt(p.value)} ${unit}`.trim() }))} format={fmt} height={260} />
        ) : (
          <SimpleChart kind="bar" title={label} measureLabel={measureProp?.label ?? measure} dimensionLabel="" format={fmt} height={200}
            data={[{ key: 'value', label: measureProp?.label ?? measure, value: props.value ?? 0 }, ...(props.target !== undefined ? [{ key: 'target', label: kind === 'delta' ? resolvePath(model.entityTypes, chart.typeName, chart.measures[1] ?? '').property?.label ?? '' : dp?.title ?? '', value: props.target }] : [])]} />
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
  if (f.kind === 'chart') return <ChartFacet facet={f} chart={f.chart} row={p.row} service={p.service} path={p.path} />;
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
