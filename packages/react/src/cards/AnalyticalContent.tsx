/**
 * Analytical card content (sap.ui.integration.cards.AnalyticalContent; OVP analytical card) — docs/20 §2.2.
 * UI.Chart aggregated on the server ($apply groupby, ADR-021) drawn with SimpleChart: Column, Bar, Line, Donut.
 * Other chart types show a message; `renderChart` replaces the drawing with any chart library.
 */
import { buildAggregateRequest, getEntitySet, resolvePath, type ChartModel, type FilterState } from '@rhfan2019/smart-kit-core';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, type ReactNode } from 'react';
import { SimpleChart, type ChartDatum } from '../chart/SimpleChart';
import { useService, useSmartKit, useText } from '../context/SmartKitProvider';
import { getPath } from '../field/values';
import { cardFilters, qualifierOf } from './annotations';
import { hasListPage, useReportHeaderDefaults, useReportToCard } from './CardContext';
import { CardMessage, CardPlaceholder } from './CardStates';

const KINDS: Record<string, 'column' | 'bar' | 'line' | 'donut'> = { Column: 'column', Bar: 'bar', Line: 'line', Donut: 'donut' };

export interface AnalyticalContentProps {
  /** Entity set name as in `$metadata`, e.g. "Orders". */
  entitySet: string;
  /** Name of the service in `SmartKitProvider` `services`; default: the provider's `defaultService`. */
  service?: string;
  /** UI.Chart, e.g. "com.sap.vocabularies.UI.v1.Chart#ByStatus"; default: from the presentation variant, else the unqualified chart. */
  chartAnnotationPath?: string;
  /** Qualified `UI.PresentationVariant` term, e.g. "@UI.PresentationVariant#Top5" (sort, MaxItems, chart). */
  presentationAnnotationPath?: string;
  /** Qualified `UI.SelectionVariant` term, e.g. "@UI.SelectionVariant#Open" (fixed filters). */
  selectionAnnotationPath?: string;
  /** Filter state (from `useFilterState` / `SmartFilterBar`), applied to the request. */
  filters?: FilterState;
  /** Maximum number of data points (default 4 for column, bar and donut; OVP fixed card layout). */
  maxItems?: number;
  /** OVP `navigation`: "dataPointNav" (default: header and data points), "headerNav" (header only), "noHeaderNav" (data points only). */
  navigation?: 'dataPointNav' | 'headerNav' | 'noHeaderNav';
  /** Data point press: the dimension value of the selected point. */
  onDataPointPress?(dimension: string, value: string): void;
  /** Height of the chart area (CSS length; default the card token). */
  height?: number;
  /** Replaces the drawing (e.g. with a chart library), for chart types SimpleChart does not draw. */
  renderChart?(chart: ChartModel, data: ChartDatum[]): ReactNode;
}

export function AnalyticalContent(p: AnalyticalContentProps) {
  const service = useService(p.service);
  const { namespace, locale, intlLocale, timeZone, navigation } = useSmartKit();
  const t = useText();
  const model = service.model;
  const typeName = getEntitySet(model, p.entitySet).typeName;
  const ui = model.ui[typeName]!;
  const pv = p.presentationAnnotationPath !== undefined ? ui.presentationVariants[qualifierOf(p.presentationAnnotationPath)] : undefined;
  const chart = ui.charts[p.chartAnnotationPath !== undefined ? qualifierOf(p.chartAnnotationPath) : pv?.chartQualifier ?? ''];
  const conditions = p.selectionAnnotationPath !== undefined ? ui.selectionVariants[qualifierOf(p.selectionAnnotationPath)] : undefined;
  const filters = useMemo(() => cardFilters(conditions, p.filters), [conditions, p.filters]);
  const kind = chart ? KINDS[chart.chartType] : undefined;
  const max = p.maxItems ?? (kind === 'line' ? undefined : 4);
  const req = chart ? buildAggregateRequest(model, chart, { source: { entitySet: p.entitySet }, filters, timeZone }) : undefined;
  if (req && pv?.presentation.sortOrder.length) req.orderBy = pv.presentation.sortOrder;
  if (req && max !== undefined && kind !== 'line') req.top = max;
  const q = useQuery({
    queryKey: ['smart-kit', namespace, service.name, locale, 'card-chart', JSON.stringify(req)],
    enabled: Boolean(req),
    queryFn: ({ signal }) => service.dataProvider.query(req!, { signal }),
  });

  const svc = service.name;
  const entitySet = p.entitySet;
  const headerNav = p.navigation !== 'noHeaderNav' && hasListPage(navigation, entitySet, svc);
  const headerPress = useCallback(() => navigation?.toList(entitySet, svc), [navigation, entitySet, svc]);
  useReportToCard(undefined, headerNav ? headerPress : undefined);
  useReportHeaderDefaults(chart ? { title: chart.title } : undefined);

  if (!chart) return <CardMessage kind="error" />;
  const dim = chart.dimensions[0];
  const measure = chart.measures[0]!;
  const dimProp = dim ? resolvePath(model.entityTypes, typeName, dim).property : undefined;
  const measureProp = resolvePath(model.entityTypes, typeName, measure).property;
  if (q.isLoading) return <CardPlaceholder kind="analytical" rows={1} />;
  if (q.error) return <CardMessage kind="error" />;
  // CD-07: amounts and numbers in the short format (1K).
  const compact = new Intl.NumberFormat(intlLocale, { notation: 'compact', maximumFractionDigits: 1 });
  const fmt = (n: number) => compact.format(n);
  const data: ChartDatum[] = (q.data?.rows ?? []).map((r) => {
    const key = dim ? String(getPath(r, dim) ?? '') : '';
    const text = dimProp?.text ? getPath(r, dimProp.text) : undefined;
    return { key, label: text !== undefined && text !== null && text !== '' ? String(text) : key, value: Number(r[measure.replace(/\//g, '_')]) };
  });
  const pointNav = p.navigation !== 'headerNav' && p.onDataPointPress && dim;
  if (p.renderChart) return <div className="sk-card__analytical">{p.renderChart(chart, data)}</div>;
  if (!kind) return <div className="sk-card__message">{t('card.unsupportedChart', { type: chart.chartType })}</div>;
  return (
    <div className="sk-card__analytical">
      <SimpleChart
        kind={kind}
        measureLabel={measureProp?.label ?? measure}
        dimensionLabel={dimProp?.label ?? dim ?? ''}
        data={data}
        format={fmt}
        height={p.height ?? CHART_HEIGHT}
        onSelect={pointNav ? (d) => p.onDataPointPress!(dim, d.key) : undefined}
      />
    </div>
  );
}

/** Height of the chart area of an analytical card (px, SAPUI5 analytical card). */
const CHART_HEIGHT = 212;
