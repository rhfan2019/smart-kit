/**
 * Annotation-driven KPI of a numeric header (OVP KPI header, docs/20 CD-04): the UI.DataPoint value summed on the
 * server ($apply aggregate), its unit, the semantic colour (Criticality / CriticalityCalculation), the trend
 * (TrendCalculation) and the target and deviation side indicators.
 */
import { buildAggregateRequest, calculateCriticality, calculateTrend, getEntitySet, resolvePath, type FilterState, type ValueRef } from '@rhfan2019/smart-kit-core';
import { useQuery } from '@tanstack/react-query';
import { useService, useSmartKit, useText } from '../context/SmartKitProvider';
import { cardFilters, qualifierOf } from './annotations';
import { compactParts } from './format';
import type { $NumericHeaderSettings, ValueColor } from './Header';

const COLOR: Record<number, ValueColor> = { 0: 'Neutral', 1: 'Error', 2: 'Critical', 3: 'Good', 5: 'Neutral' };
const constant = (r: ValueRef | undefined): number | undefined => {
  if (!r || !('value' in r)) return undefined;
  const n = Number(r.value);
  return Number.isFinite(n) ? n : undefined;
};

export function useKpi(p: { entitySet: string; service?: string; dataPointAnnotationPath: string; selectionAnnotationPath?: string; filters?: FilterState }): Partial<$NumericHeaderSettings> {
  const service = useService(p.service);
  const { namespace, locale, intlLocale, timeZone } = useSmartKit();
  const t = useText();
  const model = service.model;
  const typeName = getEntitySet(model, p.entitySet).typeName;
  const ui = model.ui[typeName]!;
  const dp = ui.dataPoints[qualifierOf(p.dataPointAnnotationPath)];
  const prop = dp ? resolvePath(model.entityTypes, typeName, dp.value).property : undefined;
  const unitPath = prop?.unit && 'path' in prop.unit ? prop.unit.path : undefined;
  const conditions = p.selectionAnnotationPath !== undefined ? ui.selectionVariants[qualifierOf(p.selectionAnnotationPath)] : undefined;
  const filters = cardFilters(conditions, p.filters);
  const req = dp ? buildAggregateRequest(model, { dimensions: unitPath ? [unitPath] : [], measures: [dp.value] }, { source: { entitySet: p.entitySet }, filters, timeZone }) : undefined;
  const q = useQuery({
    queryKey: ['smart-kit', namespace, service.name, locale, 'kpi', JSON.stringify(req)],
    enabled: Boolean(req),
    queryFn: ({ signal }) => service.dataProvider.query(req!, { signal }),
  });
  if (!dp) return {};
  const rows = q.data?.rows ?? [];
  // Several units (e.g. currencies) cannot be summed into one number.
  const row = rows.length === 1 ? rows[0] : undefined;
  const value = row ? Number(row[dp.value.replace(/\//g, '_')]) : undefined;
  const unit = row && unitPath ? String(row[unitPath] ?? '') : prop?.unit && 'value' in prop.unit ? String(prop.unit.value) : undefined;
  if (value === undefined || !Number.isFinite(value)) return { unitOfMeasurement: unit };
  const digits = dp.fractionDigits ?? 1;
  const { number, scale } = compactParts(value, intlLocale, digits);
  const crit = dp.criticality ? constant(dp.criticality) : dp.criticalityCalculation ? calculateCriticality(dp.criticalityCalculation, value, constant) : undefined;
  const target = constant(dp.targetValue);
  const sideIndicators: $NumericHeaderSettings['sideIndicators'] = [];
  if (target !== undefined) {
    const tp = compactParts(target, intlLocale, digits);
    sideIndicators.push({ title: t('card.target'), number: tp.number, unit: tp.scale });
    if (target !== 0) {
      const dev = ((value - target) / Math.abs(target)) * 100;
      sideIndicators.push({ title: t('card.deviation'), number: new Intl.NumberFormat(intlLocale, { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(dev), unit: '%' });
    }
  }
  return {
    number,
    scale,
    unitOfMeasurement: unit,
    state: crit === undefined ? undefined : COLOR[crit],
    trend: dp.trendCalculation ? calculateTrend(dp.trendCalculation, value, constant) : undefined,
    sideIndicators,
  };
}
