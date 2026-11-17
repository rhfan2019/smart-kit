/** Message lookup with {placeholders} and plural forms (Intl.PluralRules). */
import { en, type MessageKey, type Messages } from './messages.en';
import { zh } from './messages.zh';

export type Locale = 'zh' | 'en';
export const MESSAGES: Record<Locale, Messages> = { zh, en: en as unknown as Messages };
export const INTL_LOCALE: Record<Locale, string> = { zh: 'zh-CN', en: 'en-US' };

export type TextParams = Record<string, string | number>;
export type TextFn = (key: MessageKey, params?: TextParams) => string;

export function createText(locale: Locale, overrides?: Partial<Messages>): TextFn {
  const messages = { ...MESSAGES[locale], ...(overrides ?? {}) } as Messages;
  const plural = new Intl.PluralRules(INTL_LOCALE[locale]);
  return (key, params = {}) => {
    const m = messages[key] as string | Record<string, string> | undefined;
    if (m === undefined) return key;
    let template: string;
    if (typeof m === 'string') template = m;
    else {
      const n = Number(params.count ?? 0);
      template = (n === 0 && m.zero) || m[plural.select(n)] || m.other || '';
    }
    return template.replace(/\{(\w+)\}/g, (_, name: string) => (params[name] === undefined ? `{${name}}` : String(params[name])));
  };
}

/** Keys that have a variant `<key>Type` naming the kind of record (UI.HeaderInfo/TypeName). */
export type TypedKey = 'create.done' | 'delete.done' | 'edit.conflict' | 'object.notFound' | 'object.loadError';

/** The message naming the record type ("用户已创建。"); without a type name the neutral text ("已创建。"). */
export function typedText(t: TextFn, key: TypedKey, typeName: string | undefined, params: TextParams = {}): string {
  return typeName ? t(`${key}Type` as MessageKey, { ...params, type: typeName }) : t(key, params);
}
