/** Helpers shared by the display controls (docs/26 §3.2–3.5). */
import { EMPTY_INDICATOR, toneOf, type EmptyIndicatorMode, type IndicationColor, type ValueState } from '../types';

/** sap.m.ReactiveAreaMode: Overlay enlarges the clickable area of a small active control to the touch target size. */
export type ReactiveAreaMode = 'Inline' | 'Overlay';
export const ReactiveAreaMode = { Inline: 'Inline', Overlay: 'Overlay' } as const;

/** sap.ui.core.TextAlign (inline union; see the final report on shared enums). */
export type TextAlignValue = 'Begin' | 'End' | 'Left' | 'Right' | 'Center' | 'Initial';
export const ALIGN = { Begin: 'start', End: 'end', Left: 'left', Right: 'right', Center: 'center', Initial: 'initial' } as const;

/** CSS modifier of a ValueState or IndicationColor: tone (`negative` …) or `indication-01` … `indication-20`. */
export function stateModifier(state: ValueState | IndicationColor | undefined): string {
  return state?.startsWith('Indication') ? `indication-${state.slice(10)}` : toneOf(state as ValueState | undefined);
}

/** True when a text value is empty (undefined, null or ""). */
export const isEmpty = (v: unknown) => v === undefined || v === null || v === '';

/**
 * The empty indicator ("–") for an empty value. `On` always shows it; `Auto` shows it only inside an element with the class
 * `sk-show-empty` (the SAPUI5 context class); `Off` shows nothing.
 */
export function EmptyIndicator({ mode }: { mode: EmptyIndicatorMode | undefined }) {
  if (!mode || mode === 'Off') return null;
  return <span className={`sk-empty-indicator sk-empty-indicator--${mode === 'On' ? 'on' : 'auto'}`} aria-hidden>{EMPTY_INDICATOR}</span>;
}

/** Joins class names, skipping falsy entries. */
export const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(' ');
