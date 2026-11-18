/** sap.m.ObjectNumber: a number with its unit, optionally coloured, bold and inverted (docs/26 §3.2). */
import type { HTMLAttributes } from 'react';
import type { MessageKey } from '../../i18n/messages.en';
import { useControlLocale, useControlText } from '../context';
import type { EmptyIndicatorMode, ValueState } from '../types';
import { currencyAmount, currencyText } from './Currency';
import { ALIGN, cx, EmptyIndicator, isEmpty, stateModifier, type ReactiveAreaMode, type TextAlignValue } from './shared';
import { TEXTS } from './texts';

/** sap.m.ObjectNumberDisplayMode */
export type ObjectNumberDisplayMode = 'Default' | 'Currency' | 'Unit';
export const ObjectNumberDisplayMode = { Default: 'Default', Currency: 'Currency', Unit: 'Unit' } as const;

export interface $ObjectNumberSettings extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  /** The number. In Default mode it is shown as given; Currency and Unit modes format it with the locale. */
  number?: string | number;
  /** Bold number. @defaultValue true */
  emphasized?: boolean;
  /** Colour. @defaultValue 'None' */
  state?: ValueState;
  /** Unit after the number; the ISO currency code in Currency mode. */
  unit?: string;
  /** sap.ui.core.TextAlign. @defaultValue 'Begin' */
  textAlign?: TextAlignValue;
  /** The number is clickable; fires onPress. @defaultValue false */
  active?: boolean;
  /** Overlay enlarges the clickable area of an active number. @defaultValue 'Inline' */
  reactiveAreaMode?: ReactiveAreaMode;
  /** Filled background in the state colour. @defaultValue false */
  inverted?: boolean;
  /** Default shows the number as given; Currency formats it like Currency with `unit` as the currency; Unit formats it as a decimal. @defaultValue 'Default' */
  displayMode?: ObjectNumberDisplayMode;
  /** Fraction digits in Currency and Unit modes (Currency: padded like Currency; default the currency's digits). */
  maxPrecision?: number;
  /** Currency mode: shows the currency symbol instead of the code. @defaultValue true */
  useSymbol?: boolean;
  /** Shows "–" when number is empty. @defaultValue 'Off' */
  emptyIndicatorMode?: EmptyIndicatorMode;
  /** Fired when an active number is pressed. */
  onPress?(e: Record<string, never>): void;
}

export function ObjectNumber({
  number, emphasized = true, state = 'None', unit, textAlign = 'Begin', active = false, reactiveAreaMode = 'Inline', inverted = false,
  displayMode = 'Default', maxPrecision, useSymbol = true, emptyIndicatorMode = 'Off', onPress, className, style, ...rest
}: $ObjectNumberSettings) {
  const t = useControlText(TEXTS);
  const { intlLocale } = useControlLocale();
  const cls = cx(
    'sk-object-number', `sk-object-number--${stateModifier(state)}`, emphasized && 'sk-object-number--emphasized', inverted && 'sk-object-number--inverted',
    active && 'sk-object-number--active', displayMode !== 'Default' && 'sk-object-number--aligned', className,
  );
  const stateText = state !== 'None' ? t(`ctl.objectStatus.state.${state}` as MessageKey) : undefined;
  const numeric = !isEmpty(number) && !Number.isNaN(Number(number));
  const shown = !numeric || displayMode === 'Default' ? number
    : displayMode === 'Currency' ? currencyAmount(intlLocale, String(number), unit, maxPrecision)
      : new Intl.NumberFormat(intlLocale, maxPrecision === undefined ? {} : { minimumFractionDigits: maxPrecision, maximumFractionDigits: maxPrecision }).format(String(number) as unknown as number);
  const shownUnit = displayMode === 'Currency' ? currencyText(intlLocale, unit, useSymbol) : unit;
  const body = isEmpty(number) ? <EmptyIndicator mode={emptyIndicatorMode} /> : (
    <>
      <span className="sk-object-number__number">{shown}</span>
      {shownUnit ? <span className="sk-object-number__unit">{shownUnit}</span> : null}
    </>
  );
  return (
    <span {...rest} className={cls} style={{ textAlign: ALIGN[textAlign], ...style }} data-sk-object-number={state}>
      {active ? (
        <button type="button" className={cx('sk-object-number__inner sk-object-number__link', reactiveAreaMode === 'Overlay' && 'sk-reactive-overlay')} onClick={() => onPress?.({})}>{body}</button>
      ) : <span className="sk-object-number__inner">{body}</span>}
      {stateText ? <span className="sk-visually-hidden">{stateText}</span> : null}
    </span>
  );
}
