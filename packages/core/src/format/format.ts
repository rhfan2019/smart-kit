/** Locale-aware value formatting with Intl. Decimal and Int64 values are formatted from strings, never through floats. */
import type { PropertyModel } from '../model/types';

export interface FormatOptions {
  locale: string;
  /** IANA time zone for Edm.DateTimeOffset. Defaults to the runtime's zone. */
  timeZone?: string;
}

type NumberFormatInput = number | bigint | `${number}`;

const nfCache = new Map<string, Intl.NumberFormat>();
function nf(locale: string, o: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `${locale}|${JSON.stringify(o)}`;
  let f = nfCache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(locale, o);
    nfCache.set(key, f);
  }
  return f;
}

/** Number of fraction digits of an ISO 4217 currency (e.g. JPY → 0, USD → 2). */
export function currencyDigits(code: string | undefined): number | undefined {
  if (!code || !/^[A-Z]{3}$/.test(code)) return undefined;
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency: code }).resolvedOptions().maximumFractionDigits;
  } catch {
    return undefined;
  }
}

/** Formats a numeric value given as number or exact decimal string. */
export function formatNumber(value: unknown, locale: string, fractionDigits?: { min?: number; max?: number }): string {
  if (value === null || value === undefined || value === '') return '';
  const input = (typeof value === 'number' || typeof value === 'bigint' ? value : String(value).trim()) as NumberFormatInput;
  const o: Intl.NumberFormatOptions = {};
  if (fractionDigits?.min !== undefined) o.minimumFractionDigits = fractionDigits.min;
  if (fractionDigits?.max !== undefined) o.maximumFractionDigits = Math.max(fractionDigits.max, fractionDigits.min ?? 0);
  else o.maximumFractionDigits = 20;
  try {
    return nf(locale, o).format(input as never);
  } catch {
    return String(value);
  }
}

export function formatDate(value: unknown, locale: string): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(value)) return value == null ? '' : String(value);
  const [y, m, d] = value.slice(0, 10).split('-').map(Number) as [number, number, number];
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)));
}

export function formatDateTime(value: unknown, locale: string, timeZone?: string): string {
  if (value === null || value === undefined || value === '') return '';
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', ...(timeZone ? { timeZone } : {}) }).format(d);
}

/**
 * Display name of an IANA time zone as sap.ui.model.odata.type.DateTimeWithTimezone shows it in English (CLDR time zone
 * translations): "Europe/Berlin" → "Europe, Berlin", "America/New_York" → "Americas, New York". Other languages get the
 * same English form (the CLDR translations are not available to Intl).
 */
export function formatTimezone(zone: unknown): string {
  if (zone === null || zone === undefined || zone === '') return '';
  const parts = String(zone).split('/').map((p) => p.replace(/_/g, ' '));
  if (parts[0] === 'America' && parts.length > 1) parts[0] = 'Americas';
  return parts.join(', ');
}

/**
 * Edm.DateTimeOffset with Common.Timezone (FE UIFormatters getBindingWithTimezone, sap.fe.core.type.DateTimeWithTimezone):
 * date and time (medium style) in the given zone, then the zone's name; empty values show nothing.
 */
export function formatDateTimeWithTimezone(value: unknown, locale: string, zone: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value);
  const tz = typeof zone === 'string' && zone ? zone : undefined;
  let text: string;
  try {
    text = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'medium', ...(tz ? { timeZone: tz } : {}) }).format(d);
  } catch {
    text = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'medium' }).format(d);
  }
  return tz ? `${text} ${formatTimezone(tz)}` : text;
}

export function formatTime(value: unknown, locale: string): string {
  if (typeof value !== 'string' || !/^\d{2}:\d{2}/.test(value)) return value == null ? '' : String(value);
  const [h, mi, s] = value.split(':').map((x) => Number.parseFloat(x)) as [number, number, number?];
  return new Intl.DateTimeFormat(locale, { timeStyle: 'medium', timeZone: 'UTC' }).format(new Date(Date.UTC(1970, 0, 1, h, mi, s ?? 0)));
}

const INTEGER = /^Edm\.(Byte|SByte|Int16|Int32|Int64)$/;

/**
 * Formats a property value for display (without unit, text or criticality decoration).
 * `unitCode` is the resolved currency code of amounts (drives fraction digits).
 */
export function formatValue(value: unknown, prop: Pick<PropertyModel, 'edmType' | 'scale' | 'isCurrency' | 'isDigitSequence'> & Partial<Pick<PropertyModel, 'maxLength'>>, o: FormatOptions & { unitCode?: string }): string {
  if (value === null || value === undefined) return '';
  switch (prop.edmType) {
    case 'Edm.Decimal': {
      const digits = prop.isCurrency ? currencyDigits(o.unitCode) : undefined;
      const scale = typeof prop.scale === 'number' ? prop.scale : undefined;
      const fd = digits ?? scale;
      return formatNumber(value, o.locale, fd === undefined ? undefined : { min: fd, max: fd });
    }
    case 'Edm.Double':
    case 'Edm.Single':
      return formatNumber(value, o.locale);
    case 'Edm.Date':
      return formatDate(value, o.locale);
    case 'Edm.DateTimeOffset':
      return formatDateTime(value, o.locale, o.timeZone);
    case 'Edm.TimeOfDay':
      return formatTime(value, o.locale);
    case 'Edm.String':
      // Common.IsDigitSequence (sap.ui.model.odata.type.String formatValue): digits only lose their leading zeros;
      // with a MaxLength (ABAP NUMC) the value 0 is shown empty.
      if (prop.isDigitSequence && /^\d+$/.test(String(value))) {
        const v = String(value).replace(/^0*(?=\d)/, '');
        return prop.maxLength && v === '0' ? '' : v;
      }
      return String(value);
    default:
      if (INTEGER.test(prop.edmType)) return formatNumber(value, o.locale, { max: 0 });
      return String(value);
  }
}
