/** sap.m.ObjectStatus: a status text with a semantic or indication colour (docs/26 §3.2). */
import type { HTMLAttributes, ReactNode } from 'react';
import type { MessageKey } from '../../i18n/messages.en';
import { useControlText } from '../context';
import type { EmptyIndicatorMode, IndicationColor, ValueState } from '../types';
import { cx, EmptyIndicator, isEmpty, stateModifier, type ReactiveAreaMode } from './shared';
import { TEXTS } from './texts';

export interface $ObjectStatusSettings extends Omit<HTMLAttributes<HTMLElement>, 'title' | 'children'> {
  /** Label shown before the text as "title:". */
  title?: string;
  /** Status text. */
  text?: string;
  /** Text and icon are clickable; fires onPress. @defaultValue false */
  active?: boolean;
  /** Overlay enlarges the clickable area of an active status. @defaultValue 'Inline' */
  reactiveAreaMode?: ReactiveAreaMode;
  /** Colour: a ValueState or an IndicationColor. @defaultValue 'None' */
  state?: ValueState | IndicationColor;
  /** Filled background in the state colour. @defaultValue false */
  inverted?: boolean;
  /** Icon before the text (a React node, e.g. a lucide icon). */
  icon?: ReactNode;
  /** Shows "–" when text is empty. @defaultValue 'Off' */
  emptyIndicatorMode?: EmptyIndicatorMode;
  /** Text read by screen readers for the state, instead of the default ("Error", "Warning", …). */
  stateAnnouncementText?: string;
  /** Fired when an active status is pressed. */
  onPress?(e: Record<string, never>): void;
}

export function ObjectStatus({
  title, text, active = false, reactiveAreaMode = 'Inline', state = 'None', inverted = false, icon, emptyIndicatorMode = 'Off', stateAnnouncementText, onPress, className, ...rest
}: $ObjectStatusSettings) {
  const t = useControlText(TEXTS);
  const cls = cx(
    'sk-object-status', `sk-object-status--${stateModifier(state)}`, inverted && 'sk-object-status--inverted', active && 'sk-object-status--active',
    active && reactiveAreaMode === 'Overlay' && 'sk-reactive-overlay', className,
  );
  const stateText = stateAnnouncementText ?? (state !== 'None' && !state.startsWith('Indication') ? t(`ctl.objectStatus.state.${state}` as MessageKey) : undefined);
  const value = (
    <>
      {icon ? <span className="sk-object-status__icon" aria-hidden>{icon}</span> : null}
      {isEmpty(text) ? <EmptyIndicator mode={emptyIndicatorMode} /> : <span className="sk-object-status__text">{text}</span>}
    </>
  );
  return (
    <span {...rest} className={cls} data-sk-object-status={state}>
      {title ? <span className="sk-object-status__title">{title}:</span> : null}
      {active ? <button type="button" className="sk-object-status__value sk-object-status__link" onClick={() => onPress?.({})}>{value}</button> : <span className="sk-object-status__value">{value}</span>}
      {stateText ? <span className="sk-visually-hidden">{stateText}</span> : null}
    </span>
  );
}
