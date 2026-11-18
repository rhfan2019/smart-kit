/**
 * Common.ValueListReferences and Common.ValueListMapping (docs/02, stage 4 tail): a property's value lists described in
 * the `$metadata` of separate value help services, as SAPUI5 reads them (sap.ui.model.odata.v4.ODataMetaModel
 * `requestValueListInfo`, `fetchValueListMappings`, `getOrCreateSharedModel`):
 * - each reference is a URL of a value help service's `$metadata`, relative to the data service's `$metadata` URL;
 * - that document's `Common.ValueListMapping` (or `Common.ValueList`) annotations whose target is the property in the
 *   data service (namespace of the data service) are the value lists; `CollectionPath` and the value list properties
 *   belong to the value help service, whose requests go to that service;
 * - the mappings of the references come first (in reference order), then the property's own Common.ValueList
 *   annotations; FE then puts the unqualified one first (ValueListHelper `putDefaultQualifierFirst`);
 * - `SearchSupported` is not taken from a mapping (UI5 removes it), so the vocabulary default (true) applies.
 * No UI5 runtime is involved: the document is read with the same CSDL parser as the data service (D42).
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- raw CSDL annotation records are dynamic */
import { parse } from '@sap-ux/edmx-parser';
import { toCsdlXml, type CsdlSource } from '../csdl/load';
import { hoistInlineAnnotations } from '../csdl/hoist';
import type { DataProvider } from '../data/provider';
import { buildModel, resolvePath, valueListFromRecord } from './buildModel';
import type { MetaModel, ValueListModel } from './types';

type Any = Record<string, any>;

const COMMON = 'com.sap.vocabularies.Common.v1.';

/** A loaded value help service: its model, its value list mappings and the provider that reads its data. */
export interface ValueListService {
  /** The Common.ValueListReferences entry as annotated. */
  reference: string;
  /** Absolute (or root-relative) URL of the value help service's `$metadata`. */
  metadataUrl: string;
  /** Model of the value help service (entity sets, types and UI annotations of the value list entities). */
  model: MetaModel;
  /**
   * Common.ValueListMapping and Common.ValueList annotations of the document whose target lies outside it (the data
   * service's properties), by target (namespace unaliased, e.g. `Sales.Order/CompanyCode`), then by
   * qualifier ("" for the unqualified one); records in the converter's form.
   */
  mappings: Record<string, Record<string, unknown>>;
  /** Reads the value help service's data. */
  provider: DataProvider;
}

/** URL of a referenced `$metadata` resolved against the data service root (SAPUI5 `_Helper.makeAbsolute`). */
export function resolveValueListReference(serviceUrl: string, reference: string): string {
  const root = serviceUrl.endsWith('/') ? serviceUrl : `${serviceUrl}/`;
  const absolute = /^[a-z][a-z\d+.-]*:/i.test(root);
  const base = new URL(`${root}$metadata`, absolute ? undefined : 'http://smart-kit.invalid');
  const url = new URL(reference, base);
  return absolute ? url.href : `${url.pathname}${url.search}`;
}

/** Service root of a `$metadata` URL (the part before `$metadata`, query options dropped). */
export function serviceRootOf(metadataUrl: string): string {
  const path = metadataUrl.split('?')[0]!;
  const i = path.lastIndexOf('$metadata');
  return i >= 0 ? path.slice(0, i) : path.endsWith('/') ? path : `${path}/`;
}

/** A raw CSDL expression (edmx-parser form) in the converter's form, as far as value list records need it. */
function rawValue(v: Any | undefined): unknown {
  if (!v || typeof v !== 'object') return v;
  switch (v.type) {
    case 'String': return v.String;
    case 'Bool': return v.Bool === true || v.Bool === 'true';
    case 'Int': return Number(v.Int);
    case 'Decimal': return Number(v.Decimal);
    case 'EnumMember': return v.EnumMember;
    case 'PropertyPath': return { type: 'PropertyPath', value: v.PropertyPath };
    case 'Path': return { type: 'Path', path: v.Path };
    case 'AnnotationPath': return { type: 'AnnotationPath', value: v.AnnotationPath };
    case 'Record': return rawRecord(v.Record);
    case 'Collection': return ((v.Collection ?? []) as Any[]).map((x) => (x && typeof x === 'object' && 'propertyValues' in x ? rawRecord(x) : rawValue(x)));
    default: return undefined;
  }
}

function rawRecord(r: Any | undefined): Any {
  const out: Any = {};
  if (!r) return out;
  if (r.type) out.$Type = r.type;
  for (const pv of (r.propertyValues ?? []) as Any[]) out[pv.name] = rawValue(pv.value);
  return out;
}

/**
 * Reads a value help service's `$metadata`: its model and the value list mappings it declares for properties of other
 * services (targets in a namespace the document does not define).
 */
export function readValueListService(reference: string, metadataUrl: string, metadata: CsdlSource, provider: (model: MetaModel) => DataProvider): ValueListService {
  const xml = hoistInlineAnnotations(toCsdlXml(metadata));
  const raw = parse(xml, 'value-help');
  const aliases: Record<string, string> = {};
  for (const ref of (raw.references ?? []) as Any[]) if (ref.alias) aliases[ref.alias] = ref.namespace;
  const unalias = (target: string) => {
    const dot = target.indexOf('.');
    const head = target.slice(0, target.indexOf('/') < 0 ? target.length : target.indexOf('/'));
    const ns = head.slice(0, head.lastIndexOf('.'));
    return dot > 0 && aliases[ns] ? aliases[ns] + target.slice(ns.length) : target;
  };
  const own = raw.schema.namespace;
  const mappings: ValueListService['mappings'] = {};
  for (const list of Object.values((raw.schema.annotations ?? {}) as Record<string, Any[]>)) {
    for (const block of list) {
      const target = unalias(String(block.target));
      if (target.startsWith(`${own}.`)) continue;
      for (const a of (block.annotations ?? []) as Any[]) {
        const term = String(a.term).replace(/^Common\./, COMMON);
        if (term !== `${COMMON}ValueListMapping` && term !== `${COMMON}ValueList`) continue;
        (mappings[target] ??= {})[a.qualifier ?? ''] = rawRecord(a.record);
      }
    }
  }
  const model = buildModel(xml);
  return { reference, metadataUrl, model, mappings, provider: provider(model) };
}

/** Description of a value list: the Common.Text of its key property in the value list entity (as buildModel does). */
function withDescription(vl: ValueListModel, model: MetaModel): ValueListModel {
  const vhType = model.entitySets[vl.collectionPath]?.typeName;
  const text = vhType ? resolvePath(model.entityTypes, vhType, vl.keyProperty).property?.text : undefined;
  if (text) vl.descriptionProperty = vl.keyProperty.includes('/') ? `${vl.keyProperty.slice(0, vl.keyProperty.lastIndexOf('/'))}/${text}` : text;
  return vl;
}

/** Whether a mapping target addresses the property `name` of the entity type `typeName` of `model`. */
function targetsProperty(model: MetaModel, target: string, typeName: string, name: string): boolean {
  if (target === `${typeName}/${name}`) return true;
  // Namespace.Container/EntitySet/Property
  const m = /^[^/]+\/([^/]+)\/([^/]+)$/.exec(target);
  return Boolean(m && m[2] === name && model.entitySets[m[1]!]?.typeName === typeName);
}

/**
 * The value lists of a property with Common.ValueListReferences, once its value help services are loaded (`services`,
 * in any order): the mappings of each reference in the order of the references, then the property's own value lists;
 * the unqualified one first. With Common.ValueListWithFixedValues only the first is kept (UI5 expects exactly one).
 */
export function referencedValueLists(model: MetaModel, typeName: string, path: string, services: ValueListService[]): ValueListModel[] {
  const { property, type } = resolvePath(model.entityTypes, typeName, path);
  if (!property) return [];
  const owner = type?.fullName ?? typeName;
  const fixed = property.valueListFixedValues ?? property.valueList?.fixedValues ?? false;
  const out: ValueListModel[] = [];
  for (const reference of property.valueListReferences ?? []) {
    const service = services.find((s) => s.reference === reference);
    if (!service) continue;
    for (const [target, byQualifier] of Object.entries(service.mappings)) {
      if (!targetsProperty(model, target, owner, property.name)) continue;
      for (const [qualifier, record] of Object.entries(byQualifier)) {
        const vl = valueListFromRecord(property.name, record, fixed);
        if (vl) out.push(withDescription({ ...vl, searchSupported: true, qualifier, reference }, service.model));
      }
    }
  }
  out.push(...(property.valueLists ?? (property.valueList ? [property.valueList] : [])));
  const sorted = [...out.filter((v) => !v.qualifier), ...out.filter((v) => v.qualifier)];
  return fixed ? sorted.slice(0, 1) : sorted;
}
