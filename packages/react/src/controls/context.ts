/**
 * Texts and locale for the controls (docs/26). Each control group brings its own texts (bundled only with that group);
 * a text overridden in `SmartKitProvider messages` wins. Outside a provider the controls use English.
 */
import { useMemo } from 'react';
import { useOptionalSmartKit } from '../context/SmartKitProvider';
import { createText, INTL_LOCALE, type Locale, type TextFn } from '../i18n/text';
import type { Messages } from '../i18n/messages.en';

/** The texts of one control group, per locale. */
export interface ControlTexts { en: Record<string, string | Record<string, string>>; zh: Record<string, string | Record<string, string>> }

const cache = new WeakMap<ControlTexts, Partial<Record<Locale, TextFn>>>();
function groupText(texts: ControlTexts, locale: Locale): TextFn {
  const byLocale = cache.get(texts) ?? {};
  cache.set(texts, byLocale);
  return (byLocale[locale] ??= createText(locale, texts[locale] as Partial<Messages>));
}

/** `t()` for a control group: the provider's text when it has one for the key (overrides), else the group's text. */
export function useControlText(texts: ControlTexts): TextFn {
  const ctx = useOptionalSmartKit();
  return useMemo<TextFn>(() => {
    const own = groupText(texts, ctx?.locale ?? 'en');
    if (!ctx) return own;
    return (key, params) => { const v = ctx.t(key, params); return v === key ? own(key, params) : v; };
  }, [ctx, texts]);
}

/** Locale, Intl locale and time zone of the nearest SmartKitProvider; English and the browser time zone outside one. */
export function useControlLocale(): { locale: Locale; intlLocale: string; timeZone?: string } {
  const ctx = useOptionalSmartKit();
  return useMemo(() => (ctx ? { locale: ctx.locale, intlLocale: ctx.intlLocale, timeZone: ctx.timeZone } : { locale: 'en' as Locale, intlLocale: INTL_LOCALE.en }), [ctx]);
}
