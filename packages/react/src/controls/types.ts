/**
 * Shared enums and helpers of the controls (docs/26, ADR-032). Enum values are the SAPUI5 values (capitalised strings);
 * each type has a constant object of the same name, so `ValueState.Error` works as in UI5.
 */
import { Children, Fragment, isValidElement, type ReactElement, type ReactNode } from 'react';
import type { Message } from '@rhfan2019/smart-kit-core';

/** sap.ui.core.ValueState */
export type ValueState = 'None' | 'Error' | 'Warning' | 'Success' | 'Information';
export const ValueState = { None: 'None', Error: 'Error', Warning: 'Warning', Success: 'Success', Information: 'Information' } as const;

/** sap.ui.core.message.MessageType (sap.ui.core.MessageType is deprecated; same values). */
export type MessageType = 'None' | 'Error' | 'Warning' | 'Success' | 'Information';
export const MessageType = ValueState;

/** sap.ui.core.IndicationColor (Indication01–Indication20 in 1.154). */
export type IndicationColor = `Indication${'01' | '02' | '03' | '04' | '05' | '06' | '07' | '08' | '09' | '10' | '11' | '12' | '13' | '14' | '15' | '16' | '17' | '18' | '19' | '20'}`;
export const IndicationColor = Object.fromEntries(
  Array.from({ length: 20 }, (_, i) => { const k = `Indication${String(i + 1).padStart(2, '0')}`; return [k, k]; }),
) as { readonly [K in IndicationColor]: K };

/** sap.m.EmptyIndicatorMode */
export type EmptyIndicatorMode = 'Auto' | 'On' | 'Off';
export const EmptyIndicatorMode = { Auto: 'Auto', On: 'On', Off: 'Off' } as const;

/** sap.m.TitleAlignment */
export type TitleAlignment = 'Auto' | 'Center' | 'None' | 'Start';
export const TitleAlignment = { Auto: 'Auto', Center: 'Center', None: 'None', Start: 'Start' } as const;

/** sap.ui.core.TitleLevel */
export type TitleLevel = 'Auto' | 'H1' | 'H2' | 'H3' | 'H4' | 'H5' | 'H6';
export const TitleLevel = { Auto: 'Auto', H1: 'H1', H2: 'H2', H3: 'H3', H4: 'H4', H5: 'H5', H6: 'H6' } as const;

/** sap.m.WrappingType */
export type WrappingType = 'Normal' | 'Hyphenated';
export const WrappingType = { Normal: 'Normal', Hyphenated: 'Hyphenated' } as const;

/** The empty indicator of SAPUI5 (an en dash). */
export const EMPTY_INDICATOR = '–';

/** The tone used by the CSS classes `sk-status--*` and `sk-tone--*`. */
export type Tone = 'neutral' | 'negative' | 'critical' | 'positive' | 'info';

/** ValueState / MessageType → tone. */
export function toneOf(state: ValueState | MessageType | undefined): Tone {
  switch (state) {
    case 'Error': return 'negative';
    case 'Warning': return 'critical';
    case 'Success': return 'positive';
    case 'Information': return 'info';
    default: return 'neutral';
  }
}

/** core `Message.type` (lower case, ADR-023) → MessageType. */
export function messageTypeOf(type: Message['type']): MessageType {
  return type === 'error' ? 'Error' : type === 'warning' ? 'Warning' : type === 'success' ? 'Success' : 'Information';
}

/** Severity order of SAPUI5 message lists: Error, Warning, Success, Information, None. */
export const MESSAGE_TYPE_ORDER: MessageType[] = ['Error', 'Warning', 'Success', 'Information', 'None'];

/** An event object for handlers whose UI5 event can be prevented (`oEvent.preventDefault()`). */
export type PreventableEvent<T> = T & { preventDefault(): void };

/** Creates a preventable event; returns it with a `defaultPrevented` getter for the caller. */
export function preventable<T extends object>(params: T): PreventableEvent<T> & { readonly defaultPrevented: boolean } {
  let prevented = false;
  // a getter in Object.assign's source would be read once; define it on the target instead
  const e = Object.assign(params, { preventDefault() { prevented = true; } });
  Object.defineProperty(e, 'defaultPrevented', { get: () => prevented, enumerable: true });
  return e as PreventableEvent<T> & { readonly defaultPrevented: boolean };
}

/**
 * The child elements of one control type, with their React `key` (the UI5 `key` property, ADR-032 rule 4). Fragments
 * are flattened; other children are ignored.
 */
export function elementsOf<P>(children: ReactNode, type: unknown): Array<{ key: string | undefined; props: P; element: ReactElement<P> }> {
  const out: Array<{ key: string | undefined; props: P; element: ReactElement<P> }> = [];
  const walk = (nodes: ReactNode) => Children.forEach(nodes, (c) => {
    if (!isValidElement(c)) return;
    if (c.type === Fragment) {
      walk((c.props as { children?: ReactNode }).children);
      return;
    }
    if (c.type === type) out.push({ key: c.key ?? undefined, props: c.props as P, element: c as ReactElement<P> });
  });
  walk(children);
  return out;
}
