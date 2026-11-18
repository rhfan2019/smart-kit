/** Helpers shared by the process controls (docs/26 §3.6, §3.7). */
import type { KeyboardEvent } from 'react';

/** A date property of the controls: a Date or an ISO string (UI5 accepts a string or a Date). */
export type DateLike = Date | string;

/** Date of a DateLike; undefined for an empty or unparsable value. */
export function toDate(v: DateLike | undefined | null): Date | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/** Medium date with short time in the smart-kit locale ("Nov 16, 2026, 9:00 AM"). */
export function dateTimeText(d: Date, intlLocale: string, timeZone?: string): string {
  return new Intl.DateTimeFormat(intlLocale, { dateStyle: 'medium', timeStyle: 'short', timeZone }).format(d);
}

/** Enter / Space on a non-button element with role="button". */
export function pressKeys(press: () => void) {
  return (e: KeyboardEvent) => {
    if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return;
    e.preventDefault();
    press();
  };
}

export const cx = (...names: Array<string | false | null | undefined>) => names.filter(Boolean).join(' ');

/** sap.m.AvatarShape */
export type AvatarShape = 'Circle' | 'Square';
export const AvatarShape = { Circle: 'Circle', Square: 'Square' } as const;

/** sap.m.AvatarSize */
export type AvatarSize = 'XS' | 'S' | 'M' | 'L' | 'XL' | 'Custom';
export const AvatarSize = { XS: 'XS', S: 'S', M: 'M', L: 'L', XL: 'XL', Custom: 'Custom' } as const;

/** Mantine Avatar `size` and `radius` of an AvatarSize / AvatarShape. */
export function avatarProps(size: AvatarSize | undefined, shape: AvatarShape | undefined): { size: 'xs' | 'sm' | 'md' | 'lg' | 'xl'; radius: 'xl' | 'sm' } {
  const map = { XS: 'xs', S: 'sm', M: 'md', L: 'lg', XL: 'xl', Custom: 'md' } as const;
  return { size: map[size ?? 'S'], radius: shape === 'Square' ? 'sm' : 'xl' };
}
