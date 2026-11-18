/**
 * The list report settings of an FE reference app (apps/fe-reference, docs/30 §7.2, AL-13 F): the demo passes the very
 * settings object of the FE manifest (`sap.ui5 › routing › targets › <ListReport target> › options › settings`) to
 * `ListReport`. Only what React cannot take from JSON is replaced: `{i18n>key}` texts by the demo's texts, fragment
 * names (`template`) and extension handlers (`press`) by their React implementations.
 */
import type { $ListReportSettings, $ManifestTableSettings } from '@rhfan2019/smart-kit/v4/fe/templates/ListReport';

interface Manifest {
  'sap.ui5': { routing: { targets: Record<string, { name?: string; options?: { settings?: unknown } }> } };
}

export interface ManifestImplementations {
  /** Text of an `{i18n>key}` binding. */
  text(key: string): string;
  /** React implementations of the fragments named in `template`. */
  templates?: Record<string, unknown>;
  /** React implementations of the extension handlers named in `press`. */
  handlers?: Record<string, unknown>;
}

function convert(value: unknown, impl: ManifestImplementations, key?: string): unknown {
  if (typeof value === 'string') {
    if (key === 'template') return impl.templates?.[value] ?? (() => { throw new Error(`no React template for ${value}`); })();
    if (key === 'press') return impl.handlers?.[value] ?? (() => { throw new Error(`no handler for ${value}`); })();
    const i18n = /^\{i18n>(.+)\}$/.exec(value);
    return i18n ? impl.text(i18n[1]!) : value;
  }
  if (Array.isArray(value)) return value.map((v) => convert(v, impl));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, convert(v, impl, k)]));
  return value;
}

/** The settings of the manifest's `sap.fe.templates.ListReport` target. */
export function listReportSettings(manifest: unknown, impl: ManifestImplementations): $ListReportSettings {
  const targets = (manifest as Manifest)['sap.ui5'].routing.targets;
  const target = Object.values(targets).find((x) => x.name === 'sap.fe.templates.ListReport');
  if (!target) throw new Error('no ListReport target in the manifest');
  return convert(target.options?.settings ?? {}, impl) as $ListReportSettings;
}

const LINE_ITEM = '@com.sap.vocabularies.UI.v1.LineItem';

/** The settings with changed `tableSettings` (`undefined` values remove a setting). */
export function withTableSettings(settings: $ListReportSettings, patch: Partial<$ManifestTableSettings>): $ListReportSettings {
  const cc = settings.controlConfiguration ?? {};
  const table = cc[LINE_ITEM] ?? {};
  const tableSettings: Record<string, unknown> = { ...table.tableSettings, ...patch };
  for (const k of Object.keys(patch)) if (tableSettings[k] === undefined) delete tableSettings[k];
  return { ...settings, controlConfiguration: { ...cc, [LINE_ITEM]: { ...table, tableSettings } } };
}
