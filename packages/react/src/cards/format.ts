/** Formatting helpers of the cards (docs/20): compact numbers, counters, relative dates and durations. */
import type { TextFn } from '../i18n/text';

/** "125.6K" → { number: "125.6", scale: "K" } (numeric header: the scale is shown next to the number). */
export function compactParts(value: number, locale: string, fractionDigits = 1): { number: string; scale: string } {
  const parts = new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: fractionDigits }).formatToParts(value);
  let number = '';
  let scale = '';
  for (const part of parts) {
    if (part.type === 'compact') scale += part.value;
    else if (part.type !== 'literal') number += part.value;
  }
  return { number, scale };
}

/** Header counter "5 of 40" (CD-03): totals above 1000 get a scaling factor; no counter when everything is visible. */
export function counterText(t: TextFn, locale: string, visible: number, total: number | undefined): string | undefined {
  if (total === undefined || visible >= total) return undefined;
  const fmt = (n: number, compact: boolean) => new Intl.NumberFormat(locale, compact ? { notation: 'compact', maximumFractionDigits: 1 } : {}).format(n);
  return t('card.counter', { visible: fmt(visible, false), total: fmt(total, total > 1000) });
}

const dayKey = (d: Date, timeZone?: string) => new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);

/** Day difference between two instants in a time zone (calendar days). */
export function dayDiff(a: Date, b: Date, timeZone?: string): number {
  const ms = (d: Date) => Date.parse(`${dayKey(d, timeZone)}T00:00:00Z`);
  return Math.round((ms(a) - ms(b)) / 86400000);
}

/** Timeline date (SAPUI5 Timeline): "Today at 9:00 AM", "11/19/26 at 11:00 AM". */
export function relativeDateTime(t: TextFn, locale: string, value: Date, now: Date, timeZone?: string): string {
  const time = new Intl.DateTimeFormat(locale, { timeZone, hour: 'numeric', minute: '2-digit' }).format(value);
  const diff = dayDiff(value, now, timeZone);
  if (diff === 0) return t('card.todayAt', { time });
  if (diff === -1) return t('card.yesterdayAt', { time });
  if (diff === 1) return t('card.tomorrowAt', { time });
  const date = new Intl.DateTimeFormat(locale, { timeZone, year: '2-digit', month: 'numeric', day: 'numeric' }).format(value);
  return t('card.dateAt', { date, time });
}

/** Appointment duration (calendar card): "30 min", "1 hr", "1 hr 30 min". */
export function durationText(t: TextFn, minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return [h ? t('card.hours', { count: h }) : '', m || !h ? t('card.minutes', { count: m }) : ''].filter(Boolean).join(' ');
}

/** Display text of a card value: with its unit or currency ("12,500.00 EUR"); Booleans as Yes / No (like SmartField). */
export function withUnit(v: { display: string; unit?: string; value?: unknown; property?: { edmType: string } } | undefined, t?: TextFn): string {
  if (!v) return '';
  if (t && v.property?.edmType === 'Edm.Boolean' && v.value !== null && v.value !== undefined) return v.value === true || v.value === 'true' ? t('common.yes') : t('common.no');
  return v.unit && v.display && !v.display.includes(v.unit) ? `${v.display} ${v.unit}` : v.display;
}
