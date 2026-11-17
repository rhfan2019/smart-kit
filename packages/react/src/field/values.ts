/** Value helpers shared by fields, cells and exports. */
import { arrangeText, formatValue, resolvePath, type FieldModel, type MetaModel, type PropertyModel, type Row, type ValueRef } from '@rhfan2019/smart-kit-core';

/** Reads a value by property path, following expanded navigation objects ("_Partner/PartnerName"). */
export function getPath(row: Row | undefined, path: string): unknown {
  let cur: unknown = row;
  for (const seg of path.split('/')) {
    if (cur === null || cur === undefined || typeof cur !== 'object') return undefined;
    cur = (cur as Row)[seg];
  }
  return cur;
}

export function resolveRef(row: Row | undefined, ref: ValueRef | undefined): unknown {
  if (!ref) return undefined;
  return 'path' in ref ? getPath(row, ref.path) : ref.value;
}

const sibling = (path: string, p: string) => (path.includes('/') ? `${path.slice(0, path.lastIndexOf('/') + 1)}${p}` : p);

export interface FieldValue {
  value: unknown;
  formatted: string;
  display: string;
  unit?: string;
  criticality?: number;
  property?: PropertyModel;
}

export interface ValueContext {
  model: MetaModel;
  typeName: string;
  locale: string;
  timeZone?: string;
}

/** Computes everything a field needs for display. */
export function fieldValue(ctx: ValueContext, field: FieldModel, row: Row | undefined): FieldValue {
  // A micro chart's text value (export, copy, grouping) is its main measure.
  if (field.kind === 'chart' && field.chart) {
    const m = field.chart.measures[0]!;
    const dp = field.chart.dataPoints[m];
    return fieldValue(ctx, dp ? { ...field, kind: 'dataPoint', dataPoint: dp, chart: undefined } : { ...field, kind: 'field', path: m, chart: undefined }, row);
  }
  const path = field.kind === 'dataPoint' ? field.dataPoint!.value : field.path!;
  const prop = resolvePath(ctx.model.entityTypes, ctx.typeName, path).property;
  const value = getPath(row, path);
  const unitRef = prop?.unit && 'path' in prop.unit ? { path: sibling(path, prop.unit.path) } : prop?.unit;
  const unit = resolveRef(row, unitRef);
  const formatted = prop
    ? formatValue(value, prop, { locale: ctx.locale, timeZone: ctx.timeZone, unitCode: typeof unit === 'string' ? unit : undefined })
    : value === null || value === undefined ? '' : String(value);
  let display = formatted;
  if (prop?.text) {
    const text = getPath(row, sibling(path, prop.text));
    if (text !== undefined && text !== null && text !== '') {
      display = arrangeText(formatted, String(text), prop.textArrangement);
    }
  }
  const critRef = field.kind === 'dataPoint' ? field.dataPoint!.criticality : field.criticality ?? (prop?.criticality && 'path' in prop.criticality ? { path: sibling(path, prop.criticality.path) } : prop?.criticality);
  const c = resolveRef(row, critRef);
  const criticality = c === undefined || c === null || c === '' ? undefined : Number(c);
  return { value, formatted, display, unit: unit === undefined || unit === null ? undefined : String(unit), criticality: Number.isNaN(criticality) ? undefined : criticality, property: prop };
}
