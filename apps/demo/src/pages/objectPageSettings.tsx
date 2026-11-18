/**
 * Object page settings of the demo = the `options.settings` of the object page targets in the FE reference app
 * (apps/fe-reference/webapp/<app>/manifest.json, docs/30 §7.2, AL-13 F). The demo reads the same JSON and only
 * resolves what FE names by string: fragment names (`template`) become React render functions, extension functions
 * (`press`) handlers, `{i18n>key}` texts the demo's texts. So the demo page and the FE app have the same settings.
 */
import type ObjectPage from '@rhfan2019/smart-kit/v4/fe/templates/ObjectPage';
import type { ObjectPageManifestSettings } from '@rhfan2019/smart-kit/v4/fe/templates/ObjectPage';
import MessageToast from '@rhfan2019/smart-kit/m/MessageToast';
import { getPath } from '@rhfan2019/smart-kit';
import type { Row } from '@rhfan2019/smart-kit-core';
import type { ReactNode, RefObject } from 'react';
import purchasing from '../../../fe-reference/webapp/purchasing/manifest.json';
import purchasingDraft from '../../../fe-reference/webapp/purchasing-draft/manifest.json';
import purchasingOp from '../../../fe-reference/webapp/purchasing-op/manifest.json';
import purchasingDisplay from '../../../fe-reference/webapp/purchasing-display/manifest.json';
import type { ShellKey } from '../shellText';

/** FE apps whose object page the demo mirrors (`?fe=<app>`; default by service). */
export const FE_APPS = { purchasing, 'purchasing-draft': purchasingDraft, 'purchasing-op': purchasingOp, 'purchasing-display': purchasingDisplay } as const;
export type FeApp = keyof typeof FE_APPS;

/** Texts of the FE i18n keys that the demo's shell texts do not have. */
const EXTRA = {
  zh: { contactFacet: '采购组', remindAction: '提醒供应商', checkAction: '检查订单', reminded: '已提醒供应商', checked: '已检查' },
  en: { contactFacet: 'Purchasing Group', remindAction: 'Remind Supplier', checkAction: 'Check Order', reminded: 'Reminder sent', checked: 'Checked' },
} as const;

interface Resolve {
  locale: 'zh' | 'en';
  s(key: ShellKey, params?: Record<string, string | number>): string;
  /** The object page instance (ExtensionAPI): the handlers call showSideContent on it. */
  page: RefObject<ObjectPage | null>;
}

/** The object page target's settings of an FE app (the target whose component is sap.fe.templates.ObjectPage). */
export function feObjectPageSettings(app: FeApp, entitySet: string): Record<string, unknown> | undefined {
  const targets = FE_APPS[app]['sap.ui5'].routing.targets as Record<string, { name: string; options: { settings: Record<string, unknown> } }>;
  return Object.values(targets).find((t) => t.name === 'sap.fe.templates.ObjectPage' && t.options.settings.contextPath === `/${entitySet}`)?.options.settings;
}

/** Resolves fragment names, extension functions and i18n texts of manifest settings into the React form. */
export function resolveSettings(settings: Record<string, unknown>, r: Resolve): ObjectPageManifestSettings {
  const text = (v: string) => v.replace(/^\{i18n>([^}]+)\}$/, (_m, key: string) => (key in EXTRA[r.locale] ? EXTRA[r.locale][key as keyof (typeof EXTRA)['en']] : r.s(key as ShellKey)));
  const templates: Record<string, (row: Row | undefined) => ReactNode> = {
    'fe.ref.ext.Timeline': () => <div className="demo__card" data-demo-timeline>{r.s('timelineText')}</div>,
    'fe.ref.ext.SupplierInfo': (row) => <div className="demo__card" data-demo-supplier-info>{r.s('supplierInfoText', { id: String(getPath(row, 'Supplier') ?? '') })}</div>,
    'fe.ref.ext.ContactFacet': (row) => <span data-demo-contact-facet>{String(getPath(row, 'PurchasingGroup') ?? '')}</span>,
  };
  const handlers: Record<string, () => void> = {
    'fe.ref.ext.CustomActions.toggleSupplierInfo': () => r.page.current?.showSideContent('Custom::Timeline'),
    'fe.ref.ext.CustomActions.remind': () => MessageToast.show(EXTRA[r.locale].reminded),
    'fe.ref.ext.CustomActions.check': () => MessageToast.show(EXTRA[r.locale].checked),
  };
  const walk = (v: unknown, key?: string): unknown => {
    if (Array.isArray(v)) return v.map((x) => walk(x));
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x, k)]));
    if (typeof v !== 'string') return v;
    if (key === 'template' || key === 'templateEdit') return templates[v] ?? (() => v);
    if (key === 'press') return handlers[v];
    return text(v);
  };
  return walk(settings) as ObjectPageManifestSettings;
}
