/** Value helpers shared by fields, cells and exports. */
import { arrangeText, formatDateTimeWithTimezone, formatNumber, formatTimezone, formatValue, resolvePath, type FieldModel, type MetaModel, type PropertyModel, type Row, type ValueRef } from '@rhfan2019/smart-kit-core';

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

const FLOAT = /^Edm\.(Decimal|Double|Single)$/;

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
  // Field groups and connected fields: the texts of their fields; a contact: its name; an inline action column: none.
  if ((field.kind === 'fieldGroup' || field.kind === 'connectedFields') && field.fields) {
    const display = field.fields.map((f) => fieldValue(ctx, f, row).display).filter(Boolean).join(field.kind === 'fieldGroup' ? '\n' : ' ');
    return { value: display, formatted: display, display };
  }
  if (field.kind === 'contact' || field.kind === 'action') {
    const name = field.kind === 'contact' ? resolveRef(row, field.contact?.fn) : undefined;
    const display = name === undefined || name === null ? '' : String(name);
    return { value: name, formatted: display, display };
  }
  // A micro chart's text value (export, copy, grouping) is its main measure.
  if (field.kind === 'chart' && field.chart) {
    const m = field.chart.measures[0]!;
    const dp = field.chart.dataPoints[m];
    return fieldValue(ctx, dp ? { ...field, kind: 'dataPoint', dataPoint: dp, chart: undefined } : { ...field, kind: 'field', path: m, chart: undefined }, row);
  }
  const valuePath = field.kind === 'dataPoint' ? field.dataPoint!.value : field.path!;
  const own = resolvePath(ctx.model.entityTypes, ctx.typeName, valuePath).property;
  // Common.ExternalID: the readable property is shown (and formatted) instead of the technical one
  // (sap.fe.macros.internal.field.FieldStructureHelper computeExternalID).
  const external = own?.externalId ? sibling(valuePath, own.externalId) : undefined;
  const path = external ?? valuePath;
  const prop = external ? resolvePath(ctx.model.entityTypes, ctx.typeName, external).property ?? own : own;
  const value = getPath(row, path);
  const unitRef = prop?.unit && 'path' in prop.unit ? { path: sibling(path, prop.unit.path) } : prop?.unit;
  const unit = resolveRef(row, unitRef);
  // UI.DataPoint ValueFormat/NumberOfFractionalDigits on Decimal, Double and Single values: exactly that many digits, the
  // property's Scale ignored (sap.fe.macros.internal.helpers.DataPointTemplating getValueFormatted / getFloatFormat; 0 is
  // not applied there either).
  const digits = field.kind === 'dataPoint' ? field.dataPoint!.fractionDigits : undefined;
  const formatted = prop && digits && FLOAT.test(prop.edmType) && value !== null && value !== undefined && value !== ''
    ? formatNumber(value, ctx.locale, { min: digits, max: digits })
    : prop?.edmType === 'Edm.DateTimeOffset' && prop.timezone
      ? formatDateTimeWithTimezone(value, ctx.locale, resolveRef(row, 'path' in prop.timezone ? { path: sibling(path, prop.timezone.path) } : prop.timezone))
      : prop?.isTimezone ? formatTimezone(value)
        : prop
      ? formatValue(value, prop, { locale: ctx.locale, timeZone: ctx.timeZone, unitCode: typeof unit === 'string' ? unit : undefined })
      : value === null || value === undefined ? '' : String(value);
  let display = formatted;
  if (prop?.text) {
    const text = getPath(row, sibling(path, prop.text));
    if (text !== undefined && text !== null && text !== '') {
      display = arrangeText(formatted, String(text), prop.textArrangement);
    }
  }
  const critRef = field.kind === 'dataPoint' ? field.dataPoint!.criticality : field.criticality;
  const c = resolveRef(row, critRef);
  const criticality = c === undefined || c === null || c === '' ? undefined : Number(c);
  return { value, formatted, display, unit: unit === undefined || unit === null ? undefined : String(unit), criticality: Number.isNaN(criticality) ? undefined : criticality, property: prop };
}
