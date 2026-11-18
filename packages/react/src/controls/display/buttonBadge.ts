/**
 * The badge of sap.m.Button (BadgeEnabler) as used by ToggleButton and OverflowToolbarButton: the value is limited as in
 * Button.prototype.badgeValueFormatter, and setBadgeMinValue / setBadgeMaxValue change the limits (SAPUI5 1.154 source).
 */
import { useImperativeHandle, useRef, useState, type Ref } from 'react';

/** BADGE_MIN_VALUE and BADGE_MAX_VALUE of sap.m.Button. */
export const BADGE_MIN_VALUE = 1;
export const BADGE_MAX_VALUE = 9999;

/** The badge instance methods of sap.m.Button; both return the instance for chaining. */
export interface ButtonBadgeMethods<T> {
  /** Value below which the badge is hidden (from 1 up to the current maximum; invalid values are ignored). @defaultValue 1 */
  setBadgeMinValue(iMin: number): T;
  /** Value above which the badge shows `<max>+` (`999+` for a maximum of 1000 or more); from the current minimum up to 9999. @defaultValue 9999 */
  setBadgeMaxValue(iMax: number): T;
}

/**
 * The shown badge text as sap.m.Button.badgeValueFormatter: `null` hides the badge (no value, or below the minimum), a
 * non-numeric value gives an empty badge, a value above the maximum gives `<max>+` (or `999+`).
 */
export function badgeValueText(value: string | number | undefined, min = BADGE_MIN_VALUE, max = BADGE_MAX_VALUE): string | null {
  if (value === undefined) return null;
  const text = String(value);
  const n = parseInt(text, 10);
  if (Number.isNaN(n)) return '';
  if (n < min) return null;
  if (n > max && !text.includes('+')) return max < 1000 ? `${max}+` : '999+';
  return text;
}

/** Puts setBadgeMinValue / setBadgeMaxValue on `ref` and returns the current limits. */
export function useButtonBadge<T extends ButtonBadgeMethods<T>>(ref: Ref<T> | undefined): { min: number; max: number } {
  const [limits, setLimits] = useState({ min: BADGE_MIN_VALUE, max: BADGE_MAX_VALUE });
  const current = useRef(limits);
  current.current = limits;
  useImperativeHandle(ref, () => {
    const self = {
      setBadgeMinValue(iMin: number) {
        const { min, max } = current.current;
        // same validity check as sap.m.Button.setBadgeMinValue
        if (iMin && !Number.isNaN(iMin) && iMin >= BADGE_MIN_VALUE && iMin !== min && iMin <= max) {
          current.current = { min: iMin, max };
          setLimits(current.current);
        }
        return self;
      },
      setBadgeMaxValue(iMax: number) {
        const { min, max } = current.current;
        if (iMax && !Number.isNaN(iMax) && iMax <= BADGE_MAX_VALUE && iMax !== max && iMax >= min) {
          current.current = { min, max: iMax };
          setLimits(current.current);
        }
        return self;
      },
    } as T;
    return self;
  }, []);
  return limits;
}
