/**
 * sap.ui.unified.Currency: an amount with its currency, decimal points aligned in a column (docs/26 §3.4). As in the SAPUI5
 * source, a fraction shorter than `maxPrecision` is padded with figure spaces (U+2007), and a currency without decimals gets
 * a punctuation space (U+2008) in place of the decimal separator; the currency sits in a fixed-width slot.
 */
import { currencyDigits } from '@rhfan2019/smart-kit-core';
import type { HTMLAttributes } from 'react';
import { useControlLocale } from '../context';
import type { EmptyIndicatorMode } from '../types';
import { cx, EmptyIndicator } from './shared';

export interface CurrencyProps extends HTMLAttributes<HTMLSpanElement> {
  /** The amount (default 0). `null` counts as empty (see emptyIndicatorMode). */
  value?: number | null;
  /** The exact amount as a decimal string (Edm.Decimal); used instead of `value`, avoiding float rounding. */
  stringValue?: string;
  /** ISO 4217 currency code. */
  currency?: string;
  /** Fraction digits the amount is padded to, so amounts in different currencies align (default: the currency's digits). */
  maxPrecision?: number;
  /** Shows the currency symbol (€, $) instead of the code where one exists (default true). */
  useSymbol?: boolean;
  /** Shows "–" when there is no amount (default Off). */
  emptyIndicatorMode?: EmptyIndicatorMode;
}

export const FIGURE_SPACE = ' ';
export const PUNCTUATION_SPACE = ' ';

/** The currency text: its symbol (with useSymbol) or code. */
export function currencyText(intlLocale: string, currency: string | undefined, useSymbol = true): string {
  if (!currency) return '';
  if (!useSymbol || !/^[A-Z]{3}$/.test(currency)) return currency;
  try {
    return new Intl.NumberFormat(intlLocale, { style: 'currency', currency }).formatToParts(0).find((p) => p.type === 'currency')?.value ?? currency;
  } catch {
    return currency;
  }
}

/** The amount formatted with the currency's digits and padded to `maxPrecision`. */
export function currencyAmount(intlLocale: string, amount: number | string, currency: string | undefined, maxPrecision?: number): string {
  const own = currencyDigits(currency) ?? 2;
  const precision = maxPrecision ?? own;
  const digits = Math.max(0, Math.min(own, precision));
  const nf = new Intl.NumberFormat(intlLocale, { minimumFractionDigits: digits, maximumFractionDigits: digits });
  // formatToParts accepts decimal strings (Intl.NumberFormat v3), which keeps Edm.Decimal values exact
  const text = nf.formatToParts(amount as number).map((p) => p.value).join('');
  const pad = precision - digits;
  if (pad <= 0) return text;
  return text + (digits === 0 ? PUNCTUATION_SPACE : '') + FIGURE_SPACE.repeat(pad);
}

export function Currency({ value = 0, stringValue, currency, maxPrecision, useSymbol = true, emptyIndicatorMode = 'Off', className, ...rest }: CurrencyProps) {
  const { intlLocale } = useControlLocale();
  const amount = stringValue ?? value;
  const empty = amount === null || amount === '' || Number.isNaN(Number(amount));
  return (
    <span {...rest} className={cx('sk-currency', className)} data-sk-currency={currency ?? ''}>
      {empty ? <EmptyIndicator mode={emptyIndicatorMode} /> : (
        <>
          <span className="sk-currency__value">{currencyAmount(intlLocale, amount, currency, maxPrecision)}</span>
          <span className="sk-currency__code">{currencyText(intlLocale, currency, useSymbol)}</span>
        </>
      )}
    </span>
  );
}
