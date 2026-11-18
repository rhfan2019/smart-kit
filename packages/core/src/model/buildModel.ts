/* eslint-disable @typescript-eslint/no-explicit-any -- the converter output is a deeply dynamic object graph */
import type { ConvertedMetadata } from '@sap-ux/vocabularies-types';
import { strictestExpression } from '../conditions/filterExpressions';
import { convertSources, type CsdlSource } from '../csdl/load';
import { humanize } from './labels';
import { deriveColumns, deriveUi } from './derive';
import {
  MODEL_VERSION,
  type ActionModel,
  type AggregatedPropertyModel,
  type AggregationModel,
  type CapabilityModel,
  type ChartModel,
  type CriticalityCalculationModel,
  type DraftModel,
  type Importance,
  type ViewModel,
  type ColumnModel,
  type DataPointModel,
  type EntitySetModel,
  type EntityTypeModel,
  type EntityUi,
  type EventModel,
  type PresentationVariantModel,
  type FieldModel,
  type FilterExpression,
  type FormGroupModel,
  type HeaderFacetModel,
  type InitialCondition,
  type KpiModel,
  type MetaModel,
  type ModelWarning,
  type NavigationModel,
  type PresentationModel,
  type PropertyModel,
  type RecursiveHierarchyModel,
  type SectionModel,
  type SubSectionModel,
  type TextArrangement,
  type ValueListModel,
  type ValueRef,
} from './types';

type Any = Record<string, any>;

const str = (v: unknown): string | undefined => (v === undefined || v === null ? undefined : typeof v === 'object' && !(v instanceof String) ? undefined : String(v));
const enumName = (v: unknown): string | undefined => {
  const s = str(v);
  return s === undefined ? undefined : s.split('/').pop()!.split(' ')[0];
};
const bool = (v: unknown, dflt: boolean): boolean => {
  if (v === undefined || v === null) return dflt;
  if (typeof v === 'boolean') return v;
  if (v instanceof Boolean) return v.valueOf();
  if (typeof v === 'object' && 'type' in (v as Any)) return dflt; // dynamic expressions are not evaluated in phase 1
  return String(v) === 'true';
};
/** A constant annotation value (String, Int, Decimal, Bool, Date …) as a primitive; expressions and records give undefined. */
const primitive = (v: unknown): string | number | boolean | undefined => {
  if (v === undefined || v === null) return undefined;
  if (v instanceof String || v instanceof Number || v instanceof Boolean) return v.valueOf();
  return typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' ? v : undefined;
};
const pathOf = (v: unknown): string | undefined => {
  if (v && typeof v === 'object' && !(v instanceof String)) {
    const o = v as Any;
    if (typeof o.path === 'string') return o.path;
    if (typeof o.value === 'string') return o.value;
  }
  return undefined;
};
const join = (prefix: string, path: string) => (prefix ? `${prefix}/${path}` : path);
/** UI.Hidden given as a path (FE getExpressionFromAnnotation: a binding), relative to `prefix`; constants give undefined. */
const hiddenPathOf = (v: unknown, prefix = ''): string | undefined => {
  if (!v || typeof v !== 'object' || v instanceof Boolean || v instanceof String) return undefined;
  const o = v as Any;
  return (o.type === 'Path' || o.type === 'PropertyPath') && typeof (o.path ?? o.value) === 'string' ? join(prefix, o.path ?? o.value) : undefined;
};

// UI.CriticalityType values; VeryNegative (-1) and VeryPositive (4) get no colour, as in Fiori elements (D41).
const CRITICALITY: Record<string, number> = { VeryNegative: -1, Neutral: 0, Negative: 1, Critical: 2, Positive: 3, VeryPositive: 4, Information: 5 };

function valueRef(v: unknown, prefix = ''): ValueRef | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v === 'object' && !(v instanceof String) && !(v instanceof Number) && !(v instanceof Boolean)) {
    const o = v as Any;
    if (o.type === 'Path' || o.type === 'PropertyPath') return { path: join(prefix, o.path ?? o.value) };
    if (o.type === 'EnumMember') return { value: enumName(o.value)! };
    // Decimal constants arrive as { isDecimal, valueOf } (e.g. DataPoint MinimumValue Decimal="0", thresholds).
    if ((typeof o.isDecimal === 'function' ? o.isDecimal() : o.isDecimal) === true) return { value: Number(o.valueOf()) };
    return undefined;
  }
  if (typeof v === 'number' || v instanceof Number) return { value: Number(v) };
  if (typeof v === 'boolean' || v instanceof Boolean) return { value: Boolean(v.valueOf()) };
  const s = String(v);
  if (s.includes('/')) return { value: enumName(s)! };
  return { value: s };
}

function criticalityRef(v: unknown, prefix = ''): ValueRef | undefined {
  const r = valueRef(v, prefix);
  if (r && 'value' in r && typeof r.value === 'string') {
    const n = CRITICALITY[r.value];
    return n === undefined ? (/^-?\d+$/.test(r.value) ? { value: Number(r.value) } : undefined) : { value: n };
  }
  return r;
}

/** Options for {@link buildModel}. */
export interface BuildModelOptions {
  /** Annotation files, applied after the service annotations, in order. */
  annotationFiles?: CsdlSource[];
  /** Local overlay, applied last. */
  overlay?: CsdlSource;
}

export function buildModel(metadata: CsdlSource, options: BuildModelOptions = {}): MetaModel {
  const { converted, diagnostics } = convertSources(metadata, options.annotationFiles, options.overlay);
  return fromConverted(converted, diagnostics);
}

export function fromConverted(c: ConvertedMetadata, diagnostics: string[] = []): MetaModel {
  const warnings: ModelWarning[] = diagnostics.map((message) => ({ level: 'warning', code: 'PARSER', message }));
  const warn = (code: string, message: string, target?: string, level: ModelWarning['level'] = 'warning') =>
    warnings.push({ level, code, message, target });

  const entityTypes: Record<string, EntityTypeModel> = {};
  const raw: Record<string, Any> = {};
  for (const et of c.entityTypes as Any[]) {
    raw[et.fullyQualifiedName] = et;
    entityTypes[et.fullyQualifiedName] = buildEntityType(et);
  }

  const entitySets: Record<string, EntitySetModel> = {};
  for (const es of c.entitySets as Any[]) {
    const bindings: Record<string, string> = {};
    for (const [path, target] of Object.entries((es.navigationPropertyBinding ?? {}) as Any)) bindings[path] = (target as Any).name;
    const { capabilities, navigationCapabilities } = buildCapabilities(es.annotations?.Capabilities ?? {}, es.annotations?.Core ?? {});
    // Capabilities.FilterFunctions of the entity set, else of the container: "tolower" makes string filters
    // case-insensitive (FE Columns isFilteringCaseSensitive, ModelHelper isFilteringCaseSensitive).
    const filterFunctions = es.annotations?.Capabilities?.FilterFunctions ?? (c as Any).entityContainer?.annotations?.Capabilities?.FilterFunctions;
    if (Array.isArray(filterFunctions) && filterFunctions.map((f) => String(f?.valueOf?.() ?? f)).includes('tolower')) capabilities.caseInsensitive = true;
    // Aggregation.ApplySupported may annotate the entity set or its type (Aggregation vocabulary).
    const typeAggregation = raw[es.entityTypeName ?? es.entityType?.fullyQualifiedName]?.annotations?.Aggregation;
    const apply = es.annotations?.Aggregation?.ApplySupported ?? typeAggregation?.ApplySupported;
    // Aggregation.CustomAggregate is read where FE reads it: the entity set when it has ApplySupported, else the type
    // (sap.fe.core.converters.helpers.Aggregation: _determineAggregationAnnotationTarget).
    if (apply) {
      const analytics = [(c as Any).entityContainer?.annotations?.Analytics, raw[es.entityTypeName ?? es.entityType?.fullyQualifiedName]?.annotations?.Analytics].filter(Boolean);
      capabilities.aggregation = aggregationFrom(apply, es.annotations?.Aggregation?.ApplySupported ? es.annotations.Aggregation : typeAggregation, analytics);
    }
    // UI.CreateHidden / UI.DeleteHidden / UI.UpdateHidden: on the entity set, else on its type (FE StandardActions
    // isActionAnnotatedHidden, ModelHelper isUpdateHidden).
    const typeUi = raw[es.entityTypeName ?? es.entityType?.fullyQualifiedName]?.annotations?.UI;
    for (const [term, key] of [['CreateHidden', 'createHidden'], ['DeleteHidden', 'deleteHidden'], ['UpdateHidden', 'updateHidden']] as const) {
      const hidden = valueRef(es.annotations?.UI?.[term] ?? typeUi?.[term]);
      if (hidden) capabilities[key] = hidden;
    }
    entitySets[es.name] = { name: es.name, typeName: es.entityTypeName ?? es.entityType?.fullyQualifiedName, navigationBindings: bindings, capabilities, navigationCapabilities };
    // Core.OptimisticConcurrency applies to entity sets (Core vocabulary); the ETag property is kept on the type.
    const concurrency = es.annotations?.Core?.OptimisticConcurrency;
    const type = entityTypes[entitySets[es.name]!.typeName];
    if (type && !type.etag && Array.isArray(concurrency) && concurrency.length) type.etag = pathOf(concurrency[0]);
  }

  // Draft (ADR-018): Common.DraftRoot on the root entity set, Common.DraftNode on the sets reached from it.
  let draftEnabled = false;
  for (const es of c.entitySets as Any[]) {
    const common = es.annotations?.Common ?? es.entityType?.annotations?.Common ?? {};
    const rec = common.DraftRoot ?? common.DraftNode;
    if (!rec) continue;
    draftEnabled = true;
    const name = (v: unknown) => str(v) ?? pathOf(v);
    const draft: DraftModel = {
      root: Boolean(common.DraftRoot),
      activationAction: name(rec.ActivationAction),
      editAction: name(rec.EditAction),
      preparationAction: name(rec.PreparationAction),
      discardAction: name(rec.DiscardAction),
      newAction: name(rec.NewAction),
    };
    entitySets[es.name]!.draft = draft;
  }
  if (draftEnabled) warn('DRAFT', 'The service is draft-enabled: editing uses the draft strategy (ADR-018).', undefined, 'info');

  // Parameterized entity sets (stage 4 tail): an entity set whose type has Common.ResultContext holds the parameters
  // as its keys and contains the results (ContainsTarget navigation, usually "Set"). FE's list report runs on the
  // contained set (contextPath "/P/Set", sap.fe.core TypeGuards `isParameterizedEntitySet`, MetaModelConverter): the
  // parameters are filter fields first, mandatory and single-valued (FilterBar definition getFilterFields, FilterRestrictions
  // getFilterRestriction "SingleValue"), and the request path is "P(p1=…,p2=…)/Set" (FilterUtils getBindingPathForParameters).
  // smart-kit models the contained set as an entity set "P/Set" of the result type; the parameter properties are
  // resolvable on the result type (filter fields, conditions) without being part of it (not in propertyOrder).
  for (const es of Object.values(entitySets)) {
    const paramType = raw[es.typeName];
    const resultContext = paramType?.annotations?.Common?.ResultContext;
    if (resultContext === undefined || resultContext?.valueOf?.() === false) continue;
    const params = entityTypes[es.typeName]!.propertyOrder;
    for (const nav of ((paramType.navigationProperties ?? []) as Any[]).filter((n) => n.containsTarget)) {
      const resultTypeName: string = nav.targetTypeName ?? nav.targetType?.fullyQualifiedName;
      const resultType = entityTypes[resultTypeName];
      if (!resultType) continue;
      const name = `${es.name}/${nav.name}`;
      const filterExpressions: Record<string, FilterExpression> = { ...es.capabilities.filterExpressions };
      for (const p of params) filterExpressions[p] = 'SingleValue';
      entitySets[name] = {
        name,
        typeName: resultTypeName,
        navigationBindings: {},
        // the contained set has no capability annotations of its own: FE falls back to the parameter set's (checkOnPath)
        capabilities: { ...es.capabilities, requiredFilters: [...new Set([...params, ...es.capabilities.requiredFilters])], filterExpressions },
        navigationCapabilities: {},
        parameters: { entitySet: es.name, navigation: nav.name, typeName: es.typeName, properties: params },
      };
      for (const p of params) {
        if (!resultType.properties[p]) resultType.properties[p] = { ...entityTypes[es.typeName]!.properties[p]!, isKey: false, parameter: true };
      }
    }
  }

  // value list descriptions: the Common.Text of the key property in the value list entity (FE ValueListHelper _enrichPath)
  for (const type of Object.values(entityTypes)) {
    for (const prop of Object.values(type.properties)) {
      for (const vl of prop.valueLists ?? (prop.valueList ? [prop.valueList] : [])) {
        const vhType = entitySets[vl.collectionPath]?.typeName;
        const text = vhType ? resolvePath(entityTypes, vhType, vl.keyProperty).property?.text : undefined;
        if (text) vl.descriptionProperty = vl.keyProperty.includes('/') ? `${vl.keyProperty.slice(0, vl.keyProperty.lastIndexOf('/'))}/${text}` : text;
      }
    }
  }

  const ui: Record<string, EntityUi> = {};
  const ctx: UiContext = { entityTypes, raw, warn };
  for (const fullName of Object.keys(entityTypes)) ui[fullName] = buildUi(fullName, ctx);
  // Common.FilterDefaultValue of the parameters (FE FilterHelper: read on the parameter entity set as well)
  for (const es of Object.values(entitySets)) {
    if (!es.parameters) continue;
    const sv = ui[es.typeName]!.selectionVariant;
    for (const p of es.parameters.properties) {
      const v = entityTypes[es.parameters.typeName]!.properties[p]?.filterDefaultValue;
      if (v !== undefined && !sv.some((c) => c.path === p)) sv.push({ path: p, exclude: false, operator: 'EQ', values: [v] });
    }
  }

  const namespace = (c as Any).namespace ?? Object.keys(entityTypes)[0]?.split('.').slice(0, -1).join('.') ?? '';
  return { version: MODEL_VERSION, namespace, entitySets, entityTypes, ui, draftEnabled, warnings };
}

function buildEntityType(et: Any): EntityTypeModel {
  const properties: Record<string, PropertyModel> = {};
  const order: string[] = [];
  const keys: string[] = (et.keys ?? []).map((k: Any) => k.name);
  for (const p of et.entityProperties as Any[]) {
    properties[p.name] = buildProperty(p, keys, et);
    order.push(p.name);
  }
  const navigations: Record<string, NavigationModel> = {};
  for (const n of et.navigationProperties as Any[]) {
    navigations[n.name] = {
      name: n.name,
      targetType: n.targetTypeName ?? n.targetType?.fullyQualifiedName,
      collection: Boolean(n.isCollection),
      partner: n.partner || undefined,
      referentialConstraints: (n.referentialConstraint ?? []).map((r: Any) => ({ property: r.sourceProperty, referencedProperty: r.targetProperty })),
    };
  }
  const concurrency = et.annotations?.Core?.OptimisticConcurrency;
  const etag = Array.isArray(concurrency) && concurrency.length ? pathOf(concurrency[0]) : undefined;
  const hierarchies = buildHierarchies(et, navigations);
  return { name: et.name, fullName: et.fullyQualifiedName, keys, properties, propertyOrder: order, navigations, etag, ...(hierarchies.length ? { hierarchies } : {}) };
}

/** Aggregation.RecursiveHierarchy#Q with Hierarchy.RecursiveHierarchy#Q on the entity type (docs/26 §3.10). */
function buildHierarchies(et: Any, navigations: Record<string, NavigationModel>): RecursiveHierarchyModel[] {
  const out: RecursiveHierarchyModel[] = [];
  const agg = (et.annotations?.Aggregation ?? {}) as Any;
  const hier = (et.annotations?.Hierarchy ?? {}) as Any;
  for (const [key, a] of Object.entries(agg)) {
    if (key.split('#')[0] !== 'RecursiveHierarchy') continue;
    const qualifier = key.split('#')[1] ?? '';
    const nodeProperty = pathOf(a?.NodeProperty);
    const parentNavigation = pathOf(a?.ParentNavigationProperty);
    if (!nodeProperty || !parentNavigation) continue;
    const h = (hier[qualifier ? `RecursiveHierarchy#${qualifier}` : 'RecursiveHierarchy'] ?? {}) as Any;
    const parentProperty = navigations[parentNavigation]?.referentialConstraints[0]?.property;
    const model: RecursiveHierarchyModel = { qualifier, nodeProperty, parentNavigation };
    if (parentProperty) model.parentProperty = parentProperty;
    // FE Table getTableType: a qualified pair of both annotations makes the default table a TreeTable.
    if (qualifier && hier[`RecursiveHierarchy#${qualifier}`] !== undefined) model.paired = true;
    for (const [field, term] of [['drillState', 'DrillState'], ['distanceFromRoot', 'DistanceFromRoot'], ['limitedDescendantCount', 'LimitedDescendantCount'],
      ['matched', 'Matched'], ['matchedDescendantCount', 'MatchedDescendantCount'], ['externalKey', 'ExternalKey']] as const) {
      const v = pathOf(h[term]);
      if (v) model[field] = v;
    }
    out.push(model);
  }
  return out;
}

/**
 * Display annotations of a property as Fiori elements reads them (sap.fe.macros.internal.field.FieldStructureHelper
 * setUpDisplayStyle, sap.fe.core.templating.PropertyHelper): e-mail and phone links, masked values, the external ID,
 * the time zone of a date-time, the file name of a stream. Only the annotations present are set.
 */
function displayAnnotations(a: Any, common: Any, core: Any): Partial<PropertyModel> {
  const comm = a.Communication ?? {};
  const out: Partial<PropertyModel> = {};
  if (bool(comm.IsEmailAddress, false)) out.isEmailAddress = true;
  if (bool(comm.IsPhoneNumber, false)) out.isPhoneNumber = true;
  if (bool(common.Masked, false)) out.masked = true;
  const externalId = valueRef(common.ExternalID);
  if (externalId && 'path' in externalId) out.externalId = externalId.path;
  if (common.Timezone !== undefined) out.timezone = valueRef(common.Timezone);
  if (bool(common.IsTimezone, false)) out.isTimezone = true;
  const filename = core.ContentDisposition?.Filename;
  if (filename !== undefined) out.filename = valueRef(filename);
  if (core.MediaType !== undefined) out.mediaType = valueRef(core.MediaType);
  const target = str(a.HTML5?.LinkTarget);
  if (target) out.linkTarget = target;
  // Common.SemanticObject (constant): a smart link to the targets the host gives (NavigationAdapter.semanticTargets, D42)
  const so = str(common.SemanticObject);
  if (so) out.semanticObject = so;
  return out;
}

function buildProperty(p: Any, keys: string[], et: Any): PropertyModel {
  const a = p.annotations ?? {};
  const common = a.Common ?? {};
  const ui = a.UI ?? {};
  const measures = a.Measures ?? {};
  const core = a.Core ?? {};
  const label = str(common.Label);
  const text = common.Text;
  const arrangement =
    enumName(text?.annotations?.UI?.TextArrangement) ?? enumName(et.annotations?.UI?.TextArrangement) ?? undefined;
  const currency = measures.ISOCurrency;
  const unit = currency ?? measures.Unit;
  return {
    name: p.name,
    edmType: p.type,
    nullable: p.nullable !== false,
    isKey: keys.includes(p.name),
    maxLength: p.maxLength ?? undefined,
    // Temporal precision 0 is the CSDL default; XML omits it while some JSON writers emit it.
    precision: p.precision === 0 && /DateTimeOffset|TimeOfDay|Duration/.test(p.type) ? undefined : p.precision ?? undefined,
    scale: p.scale === 'variable' || p.scale === 'Variable' ? 'variable' : p.scale ?? undefined,
    label: label ?? humanize(p.name),
    labelDerived: label === undefined,
    description: str(core.Description),
    text: pathOf(text),
    textArrangement: arrangement as TextArrangement | undefined,
    unit: valueRef(unit),
    isCurrency: currency !== undefined,
    ...buildValueLists(p, common),
    ...valueListReferencesOf(common),
    // UI.Criticality on a property is not read: the vocabulary applies it to annotations (the LineItem row highlight)
    // and Fiori elements ignores it on properties (D41).
    hidden: bool(ui.Hidden, false) || (common.FieldControl !== undefined && enumName(common.FieldControl) === 'Hidden'),
    ...(hiddenPathOf(ui.Hidden) ? { hiddenPath: hiddenPathOf(ui.Hidden) } : {}),
    ...(str(ui.Placeholder) ? { placeholder: str(ui.Placeholder) } : {}),
    hiddenFilter: bool(ui.HiddenFilter, false),
    computed: bool(core.Computed, false),
    immutable: bool(core.Immutable, false),
    isImageUrl: bool(ui.IsImageURL, false) || bool(ui.IsImageUrl, false),
    // Core.IsURL is not read: Fiori elements shows such values as text (D41).
    ...displayAnnotations(a, common, core),
    multiLine: bool(ui.MultiLineText, false),
    isDigitSequence: bool(common.IsDigitSequence, false),
    filterDefaultValue: primitive(common.FilterDefaultValue),
    fieldControl: common.FieldControl === undefined ? undefined : valueRef(common.FieldControl),
    mandatory: enumName(common.FieldControl) === 'Mandatory',
    readOnly: enumName(common.FieldControl) === 'ReadOnly',
  };
}

const PARAM_KIND: Record<string, ValueListModel['parameters'][number]['kind']> = {
  ValueListParameterInOut: 'InOut',
  ValueListParameterOut: 'Out',
  ValueListParameterIn: 'In',
  ValueListParameterDisplayOnly: 'DisplayOnly',
  ValueListParameterConstant: 'Constant',
};

/**
 * Common.ValueList and its qualified variants (Common.ValueList#Q), default first, then in annotation order;
 * Common.ValueListRelevantQualifiers (plain qualifiers; "" – which the converter reads as null – is the unqualified one) limits them.
 */
function buildValueLists(p: Any, common: Any): { valueList?: ValueListModel; valueLists?: ValueListModel[] } {
  const all: ValueListModel[] = [];
  for (const [key, value] of Object.entries((common ?? {}) as Any)) {
    if (key.split('#')[0] !== 'ValueList') continue;
    const qualifier = key.includes('#') ? key.slice(key.indexOf('#') + 1) : (value as Any)?.qualifier ?? '';
    const vl = buildValueList(p, value, common);
    if (vl) all.push({ ...vl, qualifier });
  }
  all.sort((a, b) => Number(Boolean(a.qualifier)) - Number(Boolean(b.qualifier)));
  const relevant = Array.isArray(common?.ValueListRelevantQualifiers)
    ? (common.ValueListRelevantQualifiers as unknown[]).map((q) => (q === null || q === undefined ? '' : typeof q === 'string' ? q : typeof (q as Any)?.valueOf?.() === 'string' ? String((q as Any).valueOf()) : undefined)).filter((q): q is string => q !== undefined)
    : undefined;
  const lists = relevant?.length ? all.filter((v) => relevant.includes(v.qualifier ?? '')) : all;
  if (!lists.length) return {};
  return lists.length > 1 ? { valueList: lists[0], valueLists: lists } : { valueList: lists[0] };
}

/** Common.ValueListReferences (and qualified variants), in annotation order: URLs of value help services' $metadata. */
function valueListReferencesOf(common: Any): { valueListReferences?: string[]; valueListFixedValues?: boolean } {
  const urls: string[] = [];
  for (const [key, value] of Object.entries((common ?? {}) as Any)) {
    if (key.split('#')[0] !== 'ValueListReferences' || !Array.isArray(value)) continue;
    for (const v of value as unknown[]) {
      const url = str(v);
      if (url) urls.push(url);
    }
  }
  if (!urls.length) return {};
  return bool(common.ValueListWithFixedValues, false) ? { valueListReferences: urls, valueListFixedValues: true } : { valueListReferences: urls };
}

/**
 * A value list from a Common.ValueList or Common.ValueListMapping record (in the converter's form) for the property
 * `propertyName`; `fixedValues` is the property's Common.ValueListWithFixedValues.
 */
export function valueListFromRecord(propertyName: string, record: unknown, fixedValues: boolean): ValueListModel | undefined {
  return buildValueList({ name: propertyName }, record as Any, { ValueListWithFixedValues: fixedValues });
}

function buildValueList(p: Any, vl: Any, common: Any): ValueListModel | undefined {
  if (!vl || typeof vl !== 'object') return undefined;
  const parameters = ((vl.Parameters ?? []) as Any[]).map((param) => {
    const kind = PARAM_KIND[String(param.$Type).split('.').pop()!] ?? 'DisplayOnly';
    return {
      kind,
      local: pathOf(param.LocalDataProperty),
      valueListProperty: str(param.ValueListProperty) ?? '',
      constant: str(param.Constant),
    };
  });
  const key = parameters.find((x) => (x.kind === 'InOut' || x.kind === 'Out') && x.local === p.name) ?? parameters[0];
  if (!key) return undefined;
  return {
    collectionPath: str(vl.CollectionPath) ?? '',
    label: str(vl.Label),
    searchSupported: bool(vl.SearchSupported, true),
    parameters,
    keyProperty: key.valueListProperty,
    fixedValues: bool(common.ValueListWithFixedValues, false),
    presentationVariantQualifier: str(vl.PresentationVariantQualifier),
  };
}

const FILTER_EXPRESSIONS = new Set(['SingleValue', 'MultiValue', 'SingleRange', 'MultiRange', 'SearchExpression', 'MultiRangeOrSearchExpression']);

function restrictions(cap: Any): Partial<CapabilityModel> {
  const out: Partial<CapabilityModel> = {};
  const fr = cap.FilterRestrictions;
  if (fr) {
    out.filterable = bool(fr.Filterable, true);
    out.nonFilterable = ((fr.NonFilterableProperties ?? []) as unknown[]).map(pathOf).filter(Boolean) as string[];
    out.requiredFilters = ((fr.RequiredProperties ?? []) as unknown[]).map(pathOf).filter(Boolean) as string[];
    // several records for one property: the strictest (FE FilterField getSpecificAllowedExpression)
    const all: Record<string, FilterExpression[]> = {};
    for (const r of (fr.FilterExpressionRestrictions ?? []) as Any[]) {
      const prop = pathOf(r.Property);
      const kind = str(r.AllowedExpressions);
      if (prop && kind && FILTER_EXPRESSIONS.has(kind)) (all[prop] ??= []).push(kind as FilterExpression);
    }
    out.filterExpressions = Object.fromEntries(Object.entries(all).map(([p, kinds]) => [p, strictestExpression(kinds)!]));
  }
  const sr = cap.SortRestrictions;
  if (sr) {
    out.sortable = bool(sr.Sortable, true);
    out.nonSortable = ((sr.NonSortableProperties ?? []) as unknown[]).map(pathOf).filter(Boolean) as string[];
  }
  if (cap.SearchRestrictions) out.searchable = bool(cap.SearchRestrictions.Searchable, true);
  if (cap.CountRestrictions) out.countable = bool(cap.CountRestrictions.Countable, true);
  if (cap.TopSupported !== undefined) out.topSupported = bool(cap.TopSupported, true);
  if (cap.SkipSupported !== undefined) out.skipSupported = bool(cap.SkipSupported, true);
  if (cap.ExpandRestrictions) {
    out.nonExpandable = ((cap.ExpandRestrictions.NonExpandableProperties ?? []) as unknown[]).map(pathOf).filter(Boolean) as string[];
  }
  if (cap.InsertRestrictions) out.insertable = bool(cap.InsertRestrictions.Insertable, true);
  if (cap.UpdateRestrictions) out.updatable = bool(cap.UpdateRestrictions.Updatable, true);
  if (cap.DeleteRestrictions) out.deletable = bool(cap.DeleteRestrictions.Deletable, true);
  // Paths (FE isPathInsertable / isPathDeletable): the button stays; a deletable path is read per row.
  const insertablePath = cap.InsertRestrictions ? pathOf(cap.InsertRestrictions.Insertable) : undefined;
  const deletablePath = cap.DeleteRestrictions ? pathOf(cap.DeleteRestrictions.Deletable) : undefined;
  if (insertablePath) out.insertablePath = insertablePath;
  if (deletablePath) out.deletablePath = deletablePath;
  return out;
}

/**
 * Transformation aggregates (FE AggregationHelper getTransAggregations): the qualified Analytics.AggregatedProperty
 * annotations of the entity container and type, else the first Analytics.AggregatedProperties; only those whose
 * property is aggregatable (an empty AggregatableProperties list does not restrict).
 */
function aggregatedPropertiesFrom(analytics: Any[], aggregatable: string[]): AggregatedPropertyModel[] {
  const one = (r: Any, qualifier?: string): AggregatedPropertyModel | undefined => {
    const name = str(r?.Name);
    const property = pathOf(r?.AggregatableProperty) ?? str(r?.AggregatableProperty);
    const method = str(r?.AggregationMethod);
    if (!name || !property || !method) return undefined;
    const label = str(r?.annotations?.Common?.Label);
    return { ...(qualifier ? { qualifier } : {}), name, property, method, ...(label ? { label } : {}) };
  };
  let out: AggregatedPropertyModel[] = [];
  for (const a of analytics) {
    for (const [key, value] of Object.entries(a ?? {})) {
      if (key.split('#')[0] !== 'AggregatedProperty') continue;
      const ap = one(value as Any, (value as Any)?.qualifier ?? key.split('#')[1]);
      if (ap) out.push(ap);
    }
  }
  if (!out.length) {
    const list = analytics.map((a) => Object.entries(a ?? {}).find(([k]) => k.split('#')[0] === 'AggregatedProperties')?.[1]).find(Array.isArray) as Any[] | undefined;
    out = (list ?? []).map((r) => one(r)).filter((x): x is AggregatedPropertyModel => Boolean(x));
  }
  return out.filter((x) => !aggregatable.length || aggregatable.includes(x.property));
}

function aggregationFrom(a: Any, target: Any, analytics: Any[] = []): AggregationModel {
  const strings = (v: unknown) => ((v ?? []) as unknown[]).map((x) => str(x) ?? pathOf(x)).filter((x): x is string => Boolean(x));
  const customAggregates: Record<string, string> = {};
  for (const [key, value] of Object.entries((target ?? {}) as Any)) {
    if (key.split('#')[0] !== 'CustomAggregate') continue;
    const qualifier = (value as Any)?.qualifier ?? key.split('#')[1];
    if (qualifier) customAggregates[qualifier] = str(value) ?? String((value as Any)?.valueOf?.() ?? '');
  }
  const aggregatable = ((a.AggregatableProperties ?? []) as Any[])
    .map((r) => ({ path: pathOf(r?.Property) ?? '', methods: strings(r?.SupportedAggregationMethods) }))
    .filter((r) => r.path);
  const aggregatedProperties = aggregatedPropertiesFrom(analytics, aggregatable.map((x) => x.path));
  return {
    customAggregates,
    transformations: strings(a.Transformations),
    groupable: ((a.GroupableProperties ?? []) as unknown[]).map(pathOf).filter((x): x is string => Boolean(x)),
    aggregatable,
    ...(aggregatedProperties.length ? { aggregatedProperties } : {}),
  };
}

export const DEFAULT_CAPABILITIES: CapabilityModel = {
  // Capabilities.SearchRestrictions/Searchable defaults to true (vocabulary, FE FilterBar converter, D34).
  searchable: true,
  countable: true,
  filterable: true,
  sortable: true,
  topSupported: true,
  skipSupported: true,
  nonFilterable: [],
  nonSortable: [],
  requiredFilters: [],
  filterExpressions: {},
  nonExpandable: [],
  insertable: true,
  updatable: true,
  deletable: true,
};

function buildCapabilities(cap: Any, _core: Any): { capabilities: CapabilityModel; navigationCapabilities: Record<string, Partial<CapabilityModel>> } {
  const capabilities = { ...DEFAULT_CAPABILITIES, ...restrictions(cap) };
  const navigationCapabilities: Record<string, Partial<CapabilityModel>> = {};
  for (const r of (cap.NavigationRestrictions?.RestrictedProperties ?? []) as Any[]) {
    const nav = pathOf(r.NavigationProperty);
    if (nav) navigationCapabilities[nav] = restrictions(r);
  }
  return { capabilities, navigationCapabilities };
}

// ---------------------------------------------------------------------------------------------
// UI description

interface UiContext {
  entityTypes: Record<string, EntityTypeModel>;
  raw: Record<string, Any>;
  warn: (code: string, message: string, target?: string, level?: ModelWarning['level']) => void;
}

/** Resolves "nav1/nav2/Prop" against an entity type; returns the property and its owning type. */
export function resolvePath(entityTypes: Record<string, EntityTypeModel>, typeName: string, path: string): { property?: PropertyModel; type?: EntityTypeModel; navigationPath: string[] } {
  const segments = path.split('/');
  let type = entityTypes[typeName];
  const navigationPath: string[] = [];
  for (let i = 0; i < segments.length - 1; i++) {
    const nav = type?.navigations[segments[i]!];
    if (!nav) return { navigationPath };
    navigationPath.push(nav.name);
    type = entityTypes[nav.targetType];
  }
  return { property: type?.properties[segments[segments.length - 1]!], type, navigationPath };
}

/** Splits "nav/@UI.LineItem#Q" or "@com.sap.vocabularies.UI.v1.FieldGroup#Q" into navigation, term and qualifier. */
function splitAnnotationPath(value: string): { navigation: string; term: string; qualifier?: string } {
  const at = value.indexOf('@');
  const navigation = at > 0 ? value.slice(0, at).replace(/\/$/, '') : '';
  const rest = value.slice(at + 1);
  const [termFull, qualifier] = rest.split('#');
  return { navigation, term: termFull!.split('.').pop()!, qualifier };
}

function idFromPath(path: string): string {
  return path.replace(/\//g, '::');
}

/** Id fragment for an annotation path, independent of aliases: "_Partner/@com.sap.vocabularies.UI.v1.DataPoint#R" → "_Partner::UI.DataPoint#R". */
function annotationId(target: string): string {
  return idFromPath(target.replace(/@/g, '').replace(/com\.sap\.vocabularies\.(\w+)\.v1\./g, '$1.').replace(/Org\.OData\.(\w+)\.V1\./g, '$1.'));
}

function uniqueIds<T extends { id: string }>(items: T[], ctx: UiContext, scope: string): T[] {
  const seen = new Map<string, number>();
  return items.map((it) => {
    const n = (seen.get(it.id) ?? 0) + 1;
    seen.set(it.id, n);
    if (n === 1) return it;
    ctx.warn('DUPLICATE_ID', `Duplicate id "${it.id}" in ${scope}`, scope);
    return { ...it, id: `${it.id}::${n}` };
  });
}

function buildDataPoint(dp: Any, id: string, prefix: string, typeName: string, ctx: UiContext): DataPointModel | undefined {
  const value = pathOf(dp?.Value);
  if (!value) return undefined;
  const resolved = resolvePath(ctx.entityTypes, typeName, join(prefix, value));
  const viz = enumName(dp.Visualization);
  return {
    id,
    title: str(dp.Title) ?? resolved.property?.label ?? humanize(value),
    value: join(prefix, value),
    targetValue: valueRef(dp.TargetValue, prefix),
    visualization: viz === 'Rating' ? 'Rating' : viz === 'Progress' ? 'Progress' : 'Number',
    criticality: criticalityRef(dp.Criticality, prefix),
    minimumValue: valueRef(dp.MinimumValue, prefix),
    maximumValue: valueRef(dp.MaximumValue, prefix),
    sampleSize: valueRef(dp.SampleSize, prefix),
    forecastValue: valueRef(dp.ForecastValue, prefix),
    criticalityCalculation: criticalityCalculation(dp.CriticalityCalculation, prefix),
    deltaBullet: viz === 'DeltaBulletChart' || undefined,
    fractionDigits: typeof dp.ValueFormat?.NumberOfFractionalDigits === 'number' ? dp.ValueFormat.NumberOfFractionalDigits : undefined,
    trendCalculation: dp.TrendCalculation && typeof dp.TrendCalculation === 'object'
      ? {
          referenceValue: valueRef(dp.TrendCalculation.ReferenceValue, prefix),
          isRelative: bool(dp.TrendCalculation.IsRelativeDifference, false),
          upDifference: valueRef(dp.TrendCalculation.UpDifference, prefix),
          strongUpDifference: valueRef(dp.TrendCalculation.StrongUpDifference, prefix),
          downDifference: valueRef(dp.TrendCalculation.DownDifference, prefix),
          strongDownDifference: valueRef(dp.TrendCalculation.StrongDownDifference, prefix),
        }
      : undefined,
  };
}

function criticalityCalculation(cc: Any, prefix: string): CriticalityCalculationModel | undefined {
  if (!cc || typeof cc !== 'object') return undefined;
  const dir = enumName(cc.ImprovementDirection);
  if (dir !== 'Maximize' && dir !== 'Minimize' && dir !== 'Target') return undefined;
  return {
    improvementDirection: dir,
    deviationRangeLowValue: valueRef(cc.DeviationRangeLowValue, prefix),
    toleranceRangeLowValue: valueRef(cc.ToleranceRangeLowValue, prefix),
    acceptanceRangeLowValue: valueRef(cc.AcceptanceRangeLowValue, prefix),
    acceptanceRangeHighValue: valueRef(cc.AcceptanceRangeHighValue, prefix),
    toleranceRangeHighValue: valueRef(cc.ToleranceRangeHighValue, prefix),
    deviationRangeHighValue: valueRef(cc.DeviationRangeHighValue, prefix),
  };
}

/** UI.Chart: dimensions, measures and the data points of the measures (ADR-021). */
function buildChart(rec: Any, id: string, navigation: string, ownerType: string, ctx: UiContext): ChartModel | undefined {
  let typeName = ownerType;
  for (const seg of navigation ? navigation.split('/') : []) {
    const nav = ctx.entityTypes[typeName]?.navigations[seg];
    if (!nav) return undefined;
    typeName = nav.targetType;
  }
  const paths = (v: unknown) => ((Array.isArray(v) ? v : []) as unknown[]).map(pathOf).filter((x): x is string => Boolean(x));
  const measures = paths(rec?.Measures);
  // DynamicMeasures point to Analytics.AggregatedProperty annotations of the chart's type: their Name is the measure.
  const aggregatedName = (v: unknown): string | undefined => {
    const target = (v as Any)?.$target;
    if (target && str(target.Name)) return str(target.Name);
    const path = str((v as Any)?.value) ?? pathOf(v);
    const at = path?.lastIndexOf('@') ?? -1;
    if (!path || at < 0) return undefined;
    const [term, q] = path.slice(at + 1).split('#');
    if (!term!.endsWith('AggregatedProperty')) return undefined;
    return str(ctx.raw[typeName]?.annotations?.Analytics?.[q ? `AggregatedProperty#${q}` : 'AggregatedProperty']?.Name);
  };
  const dynamicMeasures = ((Array.isArray(rec?.DynamicMeasures) ? rec.DynamicMeasures : []) as unknown[]).map(aggregatedName).filter((x): x is string => Boolean(x));
  if (!measures.length && !dynamicMeasures.length) return undefined;
  const dataPoints: Record<string, DataPointModel> = {};
  const measureRoles: Record<string, string> = {};
  for (const ma of (rec.MeasureAttributes ?? []) as Any[]) {
    const role = enumName(ma.Role);
    const roleOf = pathOf(ma.Measure) ?? (ma.DynamicMeasure ? aggregatedName(ma.DynamicMeasure) : undefined);
    if (roleOf && role) measureRoles[roleOf] = role;
    const measure = pathOf(ma.Measure);
    const target = str(ma.DataPoint?.value) ?? pathOf(ma.DataPoint);
    if (!measure || !target) continue;
    const { navigation: n, term, qualifier } = splitAnnotationPath(target);
    if (term !== 'DataPoint') continue;
    const found = lookupAnnotation(typeName, n, term, qualifier, ctx);
    const dp = found ? buildDataPoint(found.value as Any, qualifier ?? 'DataPoint', n, typeName, ctx) : undefined;
    if (dp) dataPoints[measure] = dp;
  }
  const dimensionRoles: Record<string, string> = {};
  for (const da of (rec.DimensionAttributes ?? []) as Any[]) {
    const dimension = pathOf(da.Dimension);
    const role = enumName(da.Role);
    if (dimension && role) dimensionRoles[dimension] = role;
  }
  const firstMeasure = measures[0] ?? dynamicMeasures[0]!;
  const first = resolvePath(ctx.entityTypes, typeName, firstMeasure).property;
  // FE Chart getChartActions: unbound actions that are neither inline nor determining (intent navigation and action
  // groups are not supported by smart-kit's chart toolbar).
  const actions = buildActions(rec.Actions, `${typeName}@UI.Chart#${id}/Actions`, ctx).filter((a) => !a.bound && !a.inline && !a.determining);
  return {
    id,
    title: str(rec.Title) ?? first?.label ?? humanize(firstMeasure),
    chartType: enumName(rec.ChartType) ?? 'Column',
    dimensions: paths(rec.Dimensions),
    measures,
    ...(Object.keys(dimensionRoles).length ? { dimensionRoles } : {}),
    dataPoints,
    navigation,
    typeName,
    ...(str(rec.Title) !== undefined ? { chartTitle: str(rec.Title) } : {}),
    ...(str(rec.Description) !== undefined ? { description: str(rec.Description) } : {}),
    ...(dynamicMeasures.length ? { dynamicMeasures } : {}),
    ...(Object.keys(measureRoles).length ? { measureRoles } : {}),
    ...(actions.length ? { actions } : {}),
  };
}

/** A boolean annotation of an action: a constant, or a path relative to the bound entity (binding parameter removed). */
function actionPathRef(v: unknown, bindingName: string | undefined): ValueRef {
  const path = pathOf(v);
  if (path) return { path: bindingName && path.startsWith(`${bindingName}/`) ? path.slice(bindingName.length + 1) : path };
  return { value: bool(v, true) };
}

/** The UI.DataFieldForActionGroup records of a collection: menu buttons (FE ActionType.Menu). */
function buildActionGroups(records: unknown): { id: string; label: string; actions: string[] }[] {
  if (!Array.isArray(records)) return [];
  return (records as Any[])
    .filter((rec) => String(rec.$Type ?? '').split('.').pop() === 'DataFieldForActionGroup' && !(rec.annotations?.UI?.Hidden !== undefined && bool(rec.annotations.UI.Hidden, false)))
    .map((rec) => ({
      id: `DataFieldForActionGroup::${str(rec.ID) ?? ''}`,
      label: str(rec.Label) ?? '',
      actions: ((rec.Actions ?? []) as Any[]).map((a) => str(a.ID) ?? `DataFieldForAction::${String(str(a.Action) ?? '').replace(/\(.*\)$/, '')}`),
    }));
}

/**
 * The column key Fiori elements generates for a DataFieldForAnnotation (StableIdHelper getStableIdPartFromDataField,
 * prepareId): "_Partner/@UI.DataPoint#Rating" → "DataFieldForAnnotation::_Partner::DataPoint::Rating". FE shows it as
 * the column header when the record has no label (Columns getLabel, MdcTableTemplate `column.label || column.name`).
 */
function feAnnotationKey(target: string): string {
  let id = `DataFieldForAnnotation::${target}`
    .replace(/@(?:[\w]+\.)*?(?=[A-Z]\w*(?:#|$))/g, '@') // namespaces and aliases of the term
    .replace(/[/|@()#]/g, '::');
  while (id.includes('::::')) id = id.replace('::::', '::');
  return id.endsWith('::') ? id.slice(0, -2) : id;
}

/** UI.DataFieldForAction records of a collection (UI.LineItem, UI.Identification). */
function buildActions(records: unknown, scope: string, ctx: UiContext): ActionModel[] {
  if (!Array.isArray(records)) return [];
  const identification = scope.endsWith('@UI.Identification');
  const out: ActionModel[] = [];
  // UI.DataFieldForActionGroup: its actions are listed with `menu` (FE getDataFieldAnnotationAction, ActionType.Menu).
  const flat = (records as Any[]).flatMap((rec) => {
    if (String(rec.$Type ?? '').split('.').pop() !== 'DataFieldForActionGroup') return [rec];
    if (rec.annotations?.UI?.Hidden !== undefined && bool(rec.annotations.UI.Hidden, false)) return [];
    const menu = `DataFieldForActionGroup::${str(rec.ID) ?? ''}`;
    return ((rec.Actions ?? []) as Any[]).map((a) => ({ ...a, $menu: menu }));
  });
  for (const rec of flat) {
    if (String(rec.$Type ?? '').split('.').pop() !== 'DataFieldForAction') continue;
    if (rec.annotations?.UI?.Hidden !== undefined && bool(rec.annotations.UI.Hidden, false)) continue;
    const action = str(rec.Action);
    if (!action) continue;
    const qualified = action.replace(/\(.*\)$/, '');
    const target: Any | undefined = rec.ActionTarget;
    if (!target) ctx.warn('UNRESOLVED_ACTION', `Action ${action} is not declared in the metadata`, scope);
    const params = ((target?.parameters ?? []) as Any[]);
    const bound = Boolean(target?.isBound);
    const bindingName: string | undefined = bound ? params[0]?.name : undefined;
    const avail = target?.annotations?.Core?.OperationAvailable;
    const operationAvailable = avail !== undefined && avail !== null ? actionPathRef(avail, bindingName) : undefined;
    // FE HeaderAndFooterAction getIdentificationDataFieldForActions: a bound action whose OperationAvailable is statically
    // false is left out of the object page header and footer.
    if (identification && bound && operationAvailable && 'value' in operationAvailable && operationAvailable.value === false) continue;
    const hidden = hiddenPathOf(rec.annotations?.UI?.Hidden);
    out.push({
      id: str(rec.ID) ?? `DataFieldForAction::${qualified}`,
      label: str(rec.Label) ?? humanize(qualified.split('.').pop()!),
      action: qualified,
      name: qualified.split('.').pop()!,
      bound,
      inline: bool(rec.Inline, false),
      determining: bool(rec.Determining, false),
      ...(target?.annotations?.Common?.IsActionCritical !== undefined ? { critical: actionPathRef(target.annotations.Common.IsActionCritical, bindingName) } : {}),
      ...(bool(rec.annotations?.UI?.IsCopyAction, false) ? { copy: true } : {}),
      ...(rec.$menu ? { menu: rec.$menu as string } : {}),
      criticality: criticalityRef(rec.Criticality),
      operationAvailable,
      ...(hidden ? { hidden } : {}),
      ...(bool(rec.annotations?.UI?.Emphasized, false) ? { emphasized: true } : {}),
      parameters: params.slice(bound ? 1 : 0).map((p) => ({
        name: String(p.name),
        edmType: String(p.type),
        label: str(p.annotations?.Common?.Label) ?? humanize(String(p.name)),
        nullable: p.nullable !== false,
      })),
    });
  }
  return uniqueIds(out, ctx, scope);
}

function lookupAnnotation(typeName: string, navigation: string, term: string, qualifier: string | undefined, ctx: UiContext, vocabulary = 'UI'): { value: unknown; typeName: string } | undefined {
  let tn = typeName;
  if (navigation) {
    for (const seg of navigation.split('/')) {
      const nav = ctx.entityTypes[tn]?.navigations[seg];
      if (!nav) return undefined;
      tn = nav.targetType;
    }
  }
  const ui = ctx.raw[tn]?.annotations?.[vocabulary];
  if (!ui) return undefined;
  const key = qualifier ? `${term}#${qualifier}` : term;
  return ui[key] === undefined ? undefined : { value: ui[key], typeName: tn };
}

/**
 * A record of a field collection (UI.LineItem, UI.FieldGroup, UI.Identification …) with its UI.Hidden path (of the
 * record, else of its property, FE UIFormatters isVisible) and UI.PartOfPreview (FE Form isFieldPartOfPreview).
 */
function buildField(rec: Any, typeName: string, ctx: UiContext, scope: string, semanticKey: string[]): FieldModel | undefined {
  const f = buildFieldRecord(rec, typeName, ctx, scope, semanticKey);
  if (!f) return undefined;
  const prefix = f.path?.includes('/') ? f.path.slice(0, f.path.lastIndexOf('/')) : '';
  const prop = f.kind === 'field' && f.path ? resolvePath(ctx.entityTypes, typeName, f.path).property : undefined;
  const hidden = hiddenPathOf(rec.annotations?.UI?.Hidden) ?? (prop?.hiddenPath ? join(prefix, prop.hiddenPath) : undefined);
  const preview = rec.annotations?.UI?.PartOfPreview !== undefined && !bool(rec.annotations.UI.PartOfPreview, true);
  return hidden || preview ? { ...f, ...(hidden ? { hidden } : {}), ...(preview ? { partOfPreview: false } : {}) } : f;
}

function buildFieldRecord(rec: Any, typeName: string, ctx: UiContext, scope: string, semanticKey: string[]): FieldModel | undefined {
  const type = String(rec.$Type ?? '').split('.').pop();
  if (rec.annotations?.UI?.Hidden !== undefined && bool(rec.annotations.UI.Hidden, false)) return undefined;
  const lineItem = scope.includes('@UI.LineItem');
  const width = str(rec.annotations?.HTML5?.CssDefaults?.width);
  const importance = enumName(rec.annotations?.UI?.Importance) as Importance | undefined;
  // FE Columns _isValidColumn: an inline DataFieldForAction is a column of its own (header "Inline Action", hidden);
  // other actions are toolbar actions (buildActions). DataFieldWithActionGroup is not a column.
  if (type === 'DataFieldForAction') {
    if (!lineItem || !bool(rec.Inline, false)) return undefined;
    const action = buildActions([rec], scope, ctx)[0];
    return action ? { id: action.id, kind: 'action', label: '', action, criticalityIcon: false, isSemanticKey: false, importance, ...(width ? { width } : {}) } : undefined;
  }
  if (type === 'DataFieldWithActionGroup' || type === 'DataFieldForActionGroup') return undefined;
  if (type === 'DataFieldForIntentBasedNavigation') {
    ctx.warn('UNSUPPORTED_RECORD', `${type} is not supported (depends on the SAP launchpad) and is ignored`, scope, 'info');
    return undefined;
  }
  if (type === 'DataFieldForAnnotation') {
    const target = str(rec.Target?.value) ?? pathOf(rec.Target);
    if (!target) return undefined;
    const { navigation, term, qualifier } = splitAnnotationPath(target);
    const key = feAnnotationKey(target);
    const prefixed = (fields: FieldModel[]) => fields.map((fd) => (navigation && fd.path ? { ...fd, path: join(navigation, fd.path) } : fd));
    if (term === 'FieldGroup' || term === 'ConnectedFields') {
      // FE MdcTableTemplate: the values of a field group stacked in one cell (labels only with the manifest setting
      // showDataFieldsLabel), connected fields in one line by their Template; label: the record's, else the target's
      // (Columns getLabel), else the column key.
      const found = lookupAnnotation(typeName, navigation, term, qualifier, ctx);
      if (!found) {
        ctx.warn('UNRESOLVED_TARGET', `Cannot resolve ${target}`, scope);
        return undefined;
      }
      const t = found.value as Any;
      const entries: [string, Any][] = term === 'FieldGroup'
        ? ((t.Data ?? []) as Any[]).map((d, i) => [String(i), d])
        : Object.entries((t.Data ?? {}) as Any).filter(([, d]) => d && typeof d === 'object' && 'Value' in (d as Any)) as [string, Any][];
      const built = entries.map(([k, d]) => [k, buildField(d, found.typeName, ctx, `${scope}/${term}`, semanticKey)] as const).filter((x): x is readonly [string, FieldModel] => Boolean(x[1]));
      if (!built.length) return undefined;
      const fields = prefixed(built.map((x) => x[1]));
      const label = str(rec.Label) || str(t.Label) || key;
      return {
        id: str(rec.ID) ?? key, kind: term === 'FieldGroup' ? 'fieldGroup' : 'connectedFields', label, fields, criticalityIcon: false, isSemanticKey: false, importance,
        ...(term === 'ConnectedFields' ? { template: { text: str(t.Template) ?? '', keys: built.map((x) => x[0]) } } : {}),
        ...(width ? { width } : {}),
      };
    }
    if (term === 'Contact') {
      // Communication.Contact (FE macros/contact/Contact): the name as a link that opens the contact details.
      const found = lookupAnnotation(typeName, navigation, term, qualifier, ctx, 'Communication');
      if (!found) {
        ctx.warn('UNRESOLVED_TARGET', `Cannot resolve ${target}`, scope);
        return undefined;
      }
      const c = found.value as Any;
      const first = (list: unknown, prop: string) => (Array.isArray(list) && list.length ? valueRef((list[0] as Any)?.[prop], navigation) : undefined);
      const contact = {
        fn: valueRef(c.fn, navigation), title: valueRef(c.title, navigation), org: valueRef(c.org, navigation), role: valueRef(c.role, navigation),
        photo: valueRef(c.photo, navigation), email: first(c.email, 'address'), tel: first(c.tel, 'uri'),
      };
      return { id: str(rec.ID) ?? key, kind: 'contact', label: str(rec.Label) || key, contact, criticalityIcon: false, isSemanticKey: false, importance, ...(width ? { width } : {}) };
    }
    if (term === 'Chart') {
      // Micro chart in a cell or form (docs/15 MC-10): of the row itself, of a single-valued navigation, or over a
      // collection navigation (read with $expand, ADR-025).
      const found = lookupAnnotation(typeName, navigation, term, qualifier, ctx);
      const chart = found ? buildChart(found.value as Any, qualifier ?? 'Chart', navigation, typeName, ctx) : undefined;
      if (!chart) {
        ctx.warn('UNRESOLVED_TARGET', `Cannot resolve ${target}`, scope);
        return undefined;
      }
      const id = str(rec.ID) ?? `DataFieldForAnnotation::${annotationId(target)}`;
      // FE Columns getLabel: the record's Label, else none; the header then shows the column key.
      return { id, kind: 'chart', label: lineItem ? str(rec.Label) || key : str(rec.Label) ?? chart.title, chart, criticalityIcon: false, isSemanticKey: false, importance, ...(width ? { width } : {}) };
    }
    if (term !== 'DataPoint') {
      ctx.warn('UNSUPPORTED_RECORD', `DataFieldForAnnotation to ${term} is not supported in phase 1`, scope, 'info');
      return undefined;
    }
    const found = lookupAnnotation(typeName, navigation, term, qualifier, ctx);
    const dp = found ? buildDataPoint(found.value as Any, qualifier ?? 'DataPoint', navigation, typeName, ctx) : undefined;
    if (!dp) {
      ctx.warn('UNRESOLVED_TARGET', `Cannot resolve ${target}`, scope);
      return undefined;
    }
    const id = str(rec.ID) ?? `DataFieldForAnnotation::${annotationId(target)}`;
    // FE Columns getLabel: a data point column is labelled by Common.Label of the data point's value, else by the
    // record's Label (else by the value path, the column name).
    const valueProp = resolvePath(ctx.entityTypes, typeName, dp.value).property;
    const label = lineItem ? (valueProp && !valueProp.labelDerived ? valueProp.label : undefined) ?? str(rec.Label) ?? dp.value : str(rec.Label) ?? dp.title;
    return { id, kind: 'dataPoint', label, dataPoint: dp, criticalityIcon: true, isSemanticKey: false, importance, ...(width ? { width } : {}) };
  }
  const path = pathOf(rec.Value);
  if (!path) return undefined;
  const resolved = resolvePath(ctx.entityTypes, typeName, path);
  if (!resolved.property) {
    ctx.warn('UNRESOLVED_PATH', `Path "${path}" does not exist on ${typeName}`, scope);
    return undefined;
  }
  if (resolved.property.hidden) return undefined;
  const rep = enumName(rec.CriticalityRepresentation);
  // Keys as FE generates them (StableIdHelper getStableIdPartFromDataField) for the types smart-kit adds here.
  const so = type === 'DataFieldWithIntentBasedNavigation' ? str(rec.SemanticObject) ?? pathOf(rec.SemanticObject) : undefined;
  const intentAction = type === 'DataFieldWithIntentBasedNavigation' ? str(rec.Action) : undefined;
  const withAction = type === 'DataFieldWithAction' ? str(rec.Action)?.replace(/\(.*\)$/, '') : undefined;
  const fallbackId = withAction ? `DataFieldWithAction::${idFromPath(path)}::${withAction.split('.').pop()}`
    : so !== undefined ? `DataFieldWithIntentBasedNavigation::${idFromPath(path)}::${[so, intentAction].filter(Boolean).join('::')}`
      : type === 'DataFieldWithNavigationPath' ? `DataFieldWithNavigationPath::${idFromPath(path)}`
        : `DataField::${idFromPath(path)}`;
  // DataFieldWithAction: the value is a link that runs the action (FE DisplayStyle "Button"/Link with the action press).
  const action = withAction ? buildActions([{ ...rec, $Type: 'com.sap.vocabularies.UI.v1.DataFieldForAction', ID: undefined }], scope, ctx)[0] : undefined;
  const navigationPath = type === 'DataFieldWithNavigationPath' ? str(rec.Target?.value) ?? pathOf(rec.Target) : undefined;
  return {
    id: str(rec.ID) ?? fallbackId,
    kind: 'field',
    path,
    label: str(rec.Label) ?? resolved.property.label,
    criticality: criticalityRef(rec.Criticality),
    criticalityIcon: rep !== 'WithoutIcon',
    url: type === 'DataFieldWithUrl' ? valueRef(rec.Url) : undefined,
    // HTML5.LinkTarget of the record, else of the property (FE DisplayStyle getLinkTemplate; without it: "_top")
    ...(type === 'DataFieldWithUrl' && (str(rec.annotations?.HTML5?.LinkTarget) ?? resolved.property.linkTarget) ? { linkTarget: str(rec.annotations?.HTML5?.LinkTarget) ?? resolved.property.linkTarget } : {}),
    ...(type === 'DataFieldWithUrl' && rec.IconUrl !== undefined ? { iconUrl: valueRef(rec.IconUrl) } : {}),
    isSemanticKey: semanticKey.includes(path),
    importance,
    quickView: quickViewFor(typeName, path, resolved.property, ctx),
    ...(width ? { width } : {}),
    ...(action ? { action } : {}),
    ...(navigationPath ? { navigationPath } : {}),
    ...(so !== undefined ? { intent: { semanticObject: so, ...(intentAction ? { action: intentAction } : {}) } } : {}),
  };
}

/**
 * Cross navigation (LR Navigation): a field refers to an object with UI.QuickViewFacets when its text comes through a
 * single-valued navigation to that object, or when it is the foreign key of such a navigation.
 */
function quickViewFor(typeName: string, path: string, prop: PropertyModel, ctx: UiContext): FieldModel['quickView'] {
  const segments = path.split('/');
  let owner = typeName;
  for (const seg of segments.slice(0, -1)) owner = ctx.entityTypes[owner]?.navigations[seg]?.targetType ?? owner;
  const prefix = segments.slice(0, -1).join('/');
  const has = (tn: string) => Boolean(ctx.raw[tn]?.annotations?.UI?.QuickViewFacets);
  // FE FieldTemplating isUsedInNavigationWithQuickViewFacets: (1) the property is the source of a referential constraint
  // of a navigation whose target has UI.QuickViewFacets (the foreign key) …
  for (const nav of Object.values(ctx.entityTypes[owner]?.navigations ?? {})) {
    if (!nav.collection && nav.referentialConstraints.some((r) => r.property === prop.name) && has(nav.targetType)) return { navigation: join(prefix, nav.name), typeName: nav.targetType };
  }
  // … (2) or it is reached through a navigation and is the key or a semantic key of the target, which has QuickViewFacets.
  if (prefix && has(owner)) {
    const semanticKeys = ((ctx.raw[owner]?.annotations?.Common?.SemanticKey ?? []) as unknown[]).map((k) => pathOf(k));
    if (prop.isKey || semanticKeys.includes(prop.name)) {
      const segs = prefix.split('/');
      let tn = typeName;
      for (const seg of segs) {
        const nav = ctx.entityTypes[tn]?.navigations[seg];
        if (!nav || nav.collection) return undefined;
        tn = nav.targetType;
      }
      return { navigation: prefix, typeName: owner };
    }
  }
  return undefined;
}

function buildFields(records: unknown, typeName: string, ctx: UiContext, scope: string, semanticKey: string[]): FieldModel[] {
  if (!Array.isArray(records)) return [];
  return uniqueIds(
    records.map((r) => buildField(r as Any, typeName, ctx, scope, semanticKey)).filter((f): f is FieldModel => f !== undefined),
    ctx,
    scope,
  );
}

/**
 * The LineItem and Chart visualizations of a presentation variant whose target exists, in order
 * (FE DataVisualization: `viz.$target.term`), and whether the variant mentions a term at all
 * (`annotationExistsInPresentationVariant`: by the path text).
 */
function visualizationsOf(pv: Any | undefined, ui: Any): { list: { term: 'LineItem' | 'Chart'; qualifier: string }[]; mentions(term: string): boolean } {
  const values = ((pv?.Visualizations ?? []) as unknown[]).map((v) => str((v as Any)?.value) ?? pathOf(v) ?? '');
  const list: { term: 'LineItem' | 'Chart'; qualifier: string }[] = [];
  for (const v of values) {
    // same entity type only ("@UI.LineItem#Q", "@com.sap.vocabularies.UI.v1.Chart#Q")
    if (!v.startsWith('@')) continue;
    const [termFull, qualifier = ''] = v.slice(1).split('#');
    const term = termFull!.split('.').pop();
    if ((term === 'LineItem' || term === 'Chart') && ui[qualifier ? `${term}#${qualifier}` : term] !== undefined) list.push({ term, qualifier });
  }
  return { list, mentions: (term) => values.some((v) => v.includes(term)) };
}

function presentationFrom(pv: Any | undefined, typeAnnotations?: Any): { presentation: PresentationModel; lineItemQualifier?: string } {
  const sortOrder = ((pv?.SortOrder ?? []) as Any[])
    .map((s) => ({ path: pathOf(s.Property) ?? '', descending: bool(s.Descending, false) }))
    .filter((s) => s.path);
  // DynamicProperty (charts only): the Name of the Analytics.AggregatedProperty it points to (FE getSortConditions).
  const dynamic = ((pv?.SortOrder ?? []) as Any[]).some((s) => s.DynamicProperty);
  const chartSortOrder = dynamic
    ? ((pv?.SortOrder ?? []) as Any[]).map((s) => {
        if (!s.DynamicProperty) return { path: pathOf(s.Property) ?? '', descending: bool(s.Descending, false) };
        const target = s.DynamicProperty.$target;
        const path = str(s.DynamicProperty.value) ?? pathOf(s.DynamicProperty) ?? '';
        const [, q] = path.split('#');
        const name = str(target?.Name) ?? str(typeAnnotations?.Analytics?.[q ? `AggregatedProperty#${q}` : 'AggregatedProperty']?.Name) ?? '';
        return { path: name, descending: bool(s.Descending, false) };
      }).filter((s) => s.path)
    : undefined;
  const level = Number(pv?.InitialExpansionLevel?.valueOf?.() ?? pv?.InitialExpansionLevel);
  const requestAtLeast = ((pv?.RequestAtLeast ?? []) as unknown[]).map(pathOf).filter(Boolean) as string[];
  const groupBy = ((pv?.GroupBy ?? []) as unknown[]).map(pathOf).filter(Boolean) as string[];
  const total = ((pv?.Total ?? []) as unknown[]).map(pathOf).filter(Boolean) as string[];
  const viz = ((pv?.Visualizations ?? []) as unknown[]).map((v) => str((v as Any)?.value) ?? pathOf(v)).find((v) => v && v.includes('LineItem'));
  const lineItemQualifier = viz?.includes('#') ? viz.split('#')[1] : undefined;
  return {
    presentation: {
      sortOrder, requestAtLeast, groupBy, total,
      ...(pv?.Total !== undefined ? { hasTotal: true } : {}),
      ...(pv?.InitialExpansionLevel !== undefined && Number.isInteger(level) ? { initialExpansionLevel: level } : {}),
      ...(chartSortOrder ? { chartSortOrder } : {}),
    },
    lineItemQualifier,
  };
}

const RANGE_OPTIONS = new Set(['EQ', 'NE', 'BT', 'NB', 'LT', 'LE', 'GT', 'GE']);

function selectionVariantFrom(sv: Any | undefined): InitialCondition[] {
  const out: InitialCondition[] = [];
  for (const so of (sv?.SelectOptions ?? []) as Any[]) {
    const path = pathOf(so.PropertyName);
    if (!path) continue;
    for (const r of (so.Ranges ?? []) as Any[]) {
      const sign = enumName(r.Sign) ?? 'I';
      const option = enumName(r.Option) ?? 'EQ';
      const low = r.Low?.valueOf?.() ?? r.Low;
      const high = r.High?.valueOf?.() ?? r.High;
      let operator = option;
      let values: unknown[] = option === 'BT' || option === 'NB' ? [low, high] : [low];
      if (option === 'CP' && typeof low === 'string') {
        const s = low.startsWith('*');
        const e = low.endsWith('*');
        operator = s && e ? 'Contains' : e ? 'StartsWith' : s ? 'EndsWith' : 'EQ';
        values = [low.replace(/^\*|\*$/g, '')];
      } else if (!RANGE_OPTIONS.has(option)) continue;
      out.push({ path, exclude: sign === 'E', operator, values });
    }
  }
  // UI.SelectionVariant/Parameters: one "EQ" condition per parameter, replacing select options of the same name
  // (FE FilterHelper getFiltersConditionsFromSelectionVariant, `isParameter`)
  for (const par of (sv?.Parameters ?? []) as Any[]) {
    const path = pathOf(par.PropertyName);
    const value = primitive(par.PropertyValue);
    if (!path || value === undefined) continue;
    for (let i = out.length - 1; i >= 0; i--) if (out[i]!.path === path) out.splice(i, 1);
    out.push({ path, exclude: false, operator: 'EQ', values: [value] });
  }
  return out;
}

function buildUi(fullName: string, ctx: UiContext): EntityUi {
  const et = ctx.entityTypes[fullName]!;
  const ann: Any = ctx.raw[fullName]?.annotations ?? {};
  const ui: Any = ann.UI ?? {};
  const semanticKey = ((ann.Common?.SemanticKey ?? []) as unknown[]).map(pathOf).filter(Boolean) as string[];

  const spv = ui.SelectionPresentationVariant;
  // The default presentation (FE ListReportConverter getCompliantVisualizationAnnotation): the unqualified SPV when its
  // PV is compliant (its Visualizations contain a LineItem or a Chart), else the unqualified PV when compliant, else the
  // UI.LineItem alone (no sort, no RequestAtLeast). The first LineItem or Chart is shown: a chart first is a chart-only
  // list (SingleChart), whose table toggle (smart-kit) uses the unqualified LineItem.
  const compliant = (x: Any | undefined) => Boolean(x) && visualizationsOf(x, ui).list.length > 0;
  const pv = compliant(spv?.PresentationVariant) ? spv.PresentationVariant : compliant(ui.PresentationVariant) ? ui.PresentationVariant : undefined;
  const sv = spv?.SelectionVariant ?? ui.SelectionVariant;
  const { presentation } = presentationFrom(pv, ann);
  const primary = pv ? visualizationsOf(pv, ui).list[0] : undefined;
  const lineItemQualifier = primary?.term === 'LineItem' ? primary.qualifier : '';
  const defaultChart = primary?.term === 'Chart' ? primary.qualifier : undefined;
  const lineItemRecords = ui[lineItemQualifier ? `LineItem#${lineItemQualifier}` : 'LineItem'];
  const lineItem: ColumnModel[] | undefined = lineItemRecords ? buildFields(lineItemRecords, fullName, ctx, `${fullName}@UI.LineItem`, semanticKey) : undefined;

  const selectionFields = Array.isArray(ui.SelectionFields)
    ? (ui.SelectionFields as unknown[]).map(pathOf).filter((p): p is string => {
        if (!p) return false;
        const r = resolvePath(ctx.entityTypes, fullName, p);
        if (!r.property) ctx.warn('UNRESOLVED_PATH', `Selection field "${p}" does not exist`, fullName);
        return Boolean(r.property) && !r.property!.hidden && !r.property!.hiddenFilter;
      })
    : undefined;

  const hi = ui.HeaderInfo;
  const headerInfo = hi
    ? {
        typeName: str(hi.TypeName) ?? humanize(et.name),
        typeNamePlural: str(hi.TypeNamePlural) ?? humanize(et.name),
        title: pathOf(hi.Title?.Value),
        description: pathOf(hi.Description?.Value),
        imageUrl: valueRef(hi.ImageUrl),
        initials: valueRef(hi.Initials),
        person: Boolean(ann.Communication?.Contact) || undefined,
      }
    : undefined;

  const sections = Array.isArray(ui.Facets) ? buildSections(ui.Facets as Any[], fullName, ctx, semanticKey) : undefined;
  const headerFacets = Array.isArray(ui.HeaderFacets) ? buildHeaderFacets(ui.HeaderFacets as Any[], fullName, ctx, semanticKey) : [];

  const charts: Record<string, ChartModel> = {};
  for (const key of Object.keys(ui)) {
    if (key !== 'Chart' && !key.startsWith('Chart#')) continue;
    const q = key.includes('#') ? key.split('#')[1]! : '';
    const chart = buildChart(ui[key], q || 'Chart', '', fullName, ctx);
    if (chart) charts[q] = chart;
  }

  // Multiple views (LR General Layout): every qualified SelectionPresentationVariant is a view.
  const views: ViewModel[] = [];
  for (const key of Object.keys(ui)) {
    if (!key.startsWith('SelectionPresentationVariant#')) continue;
    const v = ui[key];
    const q = key.split('#')[1]!;
    const vpv = v?.PresentationVariant;
    // FE (getVisualizationsFromAnnotation with isMacroOrMultipleView, createSingleVisualizationView): a compliant PV shows
    // its first LineItem or Chart; otherwise the default LineItem (unless the PV names one), else the default Chart.
    // The table of a view uses the view's own PV (sort, RequestAtLeast) without falling back to the default PV.
    const { presentation: vp } = presentationFrom(vpv, ann);
    const viz = visualizationsOf(vpv, ui);
    let shown: { term: 'LineItem' | 'Chart'; qualifier: string } | undefined = viz.list[0];
    if (!shown && !viz.mentions('LineItem') && ui.LineItem !== undefined) shown = { term: 'LineItem', qualifier: '' };
    if (!shown && !viz.mentions('Chart') && ui.Chart !== undefined) shown = { term: 'Chart', qualifier: '' };
    const lq = shown?.term === 'LineItem' ? shown.qualifier : '';
    const records = ui[lq ? `LineItem#${lq}` : 'LineItem'];
    const firstChart = shown?.term === 'Chart' ? shown.qualifier : viz.list.find((x) => x.term === 'Chart')?.qualifier;
    views.push({
      id: q,
      text: str(v?.Text) ?? humanize(q),
      conditions: selectionVariantFrom(v?.SelectionVariant),
      presentation: vp,
      lineItem: records ? buildFields(records, fullName, ctx, `${fullName}@UI.LineItem`, semanticKey) : lineItem ?? [],
      chart: firstChart !== undefined ? charts[firstChart] : undefined,
      visualization: shown?.term === 'Chart' && charts[shown.qualifier] ? 'chart' : 'table',
    });
  }

  const quickViewFacets = ui.QuickViewFacets as Any[] | undefined;
  const quickView = Array.isArray(quickViewFacets)
    ? quickViewFacets.flatMap((f) => {
        const c = String(f.$Type).endsWith('ReferenceFacet') ? contentForReference(f, fullName, ctx, semanticKey, `${fullName}@UI.QuickViewFacets`) : undefined;
        return c?.kind === 'form' ? c.groups : [];
      })
    : undefined;

  // Without a default selection variant, Common.FilterDefaultValue gives one EQ condition per property
  // (FE macros/filterBar/FilterHelper getFilterConditions / _collectDefaultFilterConditions).
  const selectionVariant = sv
    ? selectionVariantFrom(sv)
    : et.propertyOrder.flatMap((name) => {
        const v = et.properties[name]?.filterDefaultValue;
        return v === undefined ? [] : [{ path: name, exclude: false, operator: 'EQ', values: [v] }];
      });
  const ui2 = deriveUi(et, ctx.entityTypes, {
    headerInfo,
    lineItem,
    selectionFields,
    presentation,
    selectionVariant,
    sections,
    headerFacets,
    semanticKey,
  }, (target) => tableFor(fullName, target, ctx));
  return {
    ...ui2,
    actions: buildActions(lineItemRecords, `${fullName}@UI.LineItem`, ctx),
    actionGroups: buildActionGroups(lineItemRecords),
    rowHighlight: rowHighlightOf(ui),
    objectActions: buildActions(ui.Identification, `${fullName}@UI.Identification`, ctx),
    charts,
    views,
    ...(defaultChart !== undefined && charts[defaultChart] ? { defaultChart } : {}),
    ...kpisOf(ui, fullName, ctx),
    quickView,
    ...cardAnnotations(fullName, ui, ann, ui2.lineItem, ctx, semanticKey),
  };
}

/** UI.Criticality annotated on each UI.LineItem collection, by qualifier (FE Table getHighlightRowBinding). */
function rowHighlightOf(ui: Any): Record<string, ValueRef> {
  const out: Record<string, ValueRef> = {};
  for (const key of Object.keys(ui)) {
    const q = qualifierOf(key, 'LineItem');
    const ref = q === undefined ? undefined : criticalityRef((ui[key] as Any)?.annotations?.UI?.Criticality);
    if (q !== undefined && ref) out[q] = ref;
  }
  return out;
}

/** UI.KPI annotations (FE createAnalyticalKPIDefinition): an inline DataPoint, SelectionVariant and Detail PV with a Chart. */
function kpisOf(ui: Any, fullName: string, ctx: UiContext): Pick<EntityUi, 'kpis'> {
  const kpis: Record<string, KpiModel> = {};
  for (const key of Object.keys(ui)) {
    if (key !== 'KPI' && !key.startsWith('KPI#')) continue;
    const q = key.includes('#') ? key.split('#')[1]! : '';
    const rec = ui[key] as Any;
    const dataPoint = rec?.DataPoint ? buildDataPoint(rec.DataPoint, `KPI#${q}`, '', fullName, ctx) : undefined;
    if (!dataPoint) continue;
    const chart = visualizationsOf(rec.Detail?.DefaultPresentationVariant, ui).list.find((v) => v.term === 'Chart')?.qualifier;
    const title = str(rec.DataPoint.Title);
    kpis[q] = { id: q, ...(title !== undefined ? { title } : {}), dataPoint, conditions: selectionVariantFrom(rec.SelectionVariant), ...(chart !== undefined ? { chart } : {}) };
  }
  return Object.keys(kpis).length ? { kpis } : {};
}

const qualifierOf = (key: string, term: string): string | undefined =>
  key === term ? '' : key.startsWith(`${term}#`) ? key.slice(term.length + 1) : undefined;

/** Annotations that cards select by qualifier (docs/20): line items, presentation and selection variants, data points, field groups, events. */
function cardAnnotations(fullName: string, ui: Any, ann: Any, lineItem: ColumnModel[], ctx: UiContext, semanticKey: string[]): Pick<EntityUi, 'lineItems' | 'presentationVariants' | 'selectionVariants' | 'selectionVariantTexts' | 'dataPoints' | 'fieldGroups' | 'identification' | 'event'> {
  const lineItems: Record<string, ColumnModel[]> = { '': lineItem };
  const presentationVariants: Record<string, PresentationVariantModel> = {};
  const selectionVariants: Record<string, InitialCondition[]> = {};
  const selectionVariantTexts: Record<string, string> = {};
  const dataPoints: Record<string, DataPointModel> = {};
  const fieldGroups: Record<string, FormGroupModel> = {};
  for (const key of Object.keys(ui)) {
    let q: string | undefined;
    if ((q = qualifierOf(key, 'LineItem')) !== undefined) {
      if (q) lineItems[q] = buildFields(ui[key], fullName, ctx, `${fullName}@UI.LineItem#${q}`, semanticKey);
    } else if ((q = qualifierOf(key, 'PresentationVariant')) !== undefined) {
      const pv = ui[key] as Any;
      const { presentation } = presentationFrom(pv, ann);
      const vizs = ((pv?.Visualizations ?? []) as unknown[]).map((v) => str((v as Any)?.value) ?? pathOf(v) ?? '');
      const qual = (term: string) => {
        const v = vizs.find((x) => x.includes(term));
        return v === undefined ? undefined : v.includes('#') ? v.split('#')[1]! : '';
      };
      const max = Number(pv?.MaxItems?.valueOf?.() ?? pv?.MaxItems);
      presentationVariants[q] = { ...(str(pv?.Text) ? { text: str(pv?.Text) } : {}), presentation, maxItems: Number.isFinite(max) && max > 0 ? max : undefined, lineItemQualifier: qual('LineItem'), chartQualifier: qual('Chart'), groupBy: presentation.groupBy };
    } else if ((q = qualifierOf(key, 'SelectionVariant')) !== undefined) {
      selectionVariants[q] = selectionVariantFrom(ui[key]);
      const text = str((ui[key] as Any)?.Text);
      if (text) selectionVariantTexts[q] = text;
    } else if ((q = qualifierOf(key, 'DataPoint')) !== undefined) {
      const dp = buildDataPoint(ui[key], q || 'DataPoint', '', fullName, ctx);
      if (dp) dataPoints[q] = dp;
    } else if ((q = qualifierOf(key, 'FieldGroup')) !== undefined) {
      const fg = ui[key] as Any;
      fieldGroups[q] = { id: q || 'FieldGroup', label: str(fg?.Label), fields: buildFields(fg?.Data, fullName, ctx, `${fullName}@UI.FieldGroup#${q}`, semanticKey) };
    }
  }
  const identification = buildFields(ui.Identification, fullName, ctx, `${fullName}@UI.Identification`, semanticKey);
  const ev = ann.Communication?.Event as Any | undefined;
  const event: EventModel | undefined = ev
    ? { dtstart: pathOf(ev.dtstart), dtend: pathOf(ev.dtend), summary: pathOf(ev.summary), description: pathOf(ev.description), location: pathOf(ev.location), categories: pathOf(ev.categories) }
    : undefined;
  return { lineItems, presentationVariants, selectionVariants, ...(Object.keys(selectionVariantTexts).length ? { selectionVariantTexts } : {}), dataPoints, fieldGroups, identification, event };
}

/**
 * Splits an annotation path as written in card settings — "com.sap.vocabularies.UI.v1.LineItem#Card", "@UI.LineItem#Card",
 * "UI.Chart" — into its term ("LineItem") and qualifier ("" when unqualified).
 */
export function parseAnnotationPath(path: string): { term: string; qualifier: string } {
  const rest = path.slice(path.lastIndexOf('@') + 1);
  const [termFull, qualifier] = rest.split('#');
  return { term: termFull!.split('.').pop()!, qualifier: qualifier ?? '' };
}

/** Builds the table content for a "nav/@UI.LineItem" facet target. */
function tableFor(typeName: string, navigation: string, ctx: UiContext, qualifier?: string): SubSectionModel['content'] | undefined {
  const nav = ctx.entityTypes[typeName]?.navigations[navigation];
  if (!nav || !nav.collection) return undefined;
  const target = nav.targetType;
  const tui: Any = ctx.raw[target]?.annotations?.UI ?? {};
  const semanticKey = ((ctx.raw[target]?.annotations?.Common?.SemanticKey ?? []) as unknown[]).map(pathOf).filter(Boolean) as string[];
  const records = tui[qualifier ? `LineItem#${qualifier}` : 'LineItem'];
  const columns = records ? buildFields(records, target, ctx, `${target}@UI.LineItem`, semanticKey) : deriveColumns(ctx.entityTypes[target]!, ctx.entityTypes);
  const { presentation } = presentationFrom(tui.PresentationVariant);
  return { kind: 'table', navigation, targetType: target, columns, presentation };
}

function facetId(f: Any, fallback: string): string {
  return str(f.ID) ?? (str(f.Label) ? str(f.Label)!.replace(/\s+/g, '') : fallback);
}

function contentForReference(f: Any, typeName: string, ctx: UiContext, semanticKey: string[], scope: string): SubSectionModel['content'] | undefined {
  const target = str(f.Target?.value) ?? pathOf(f.Target);
  if (!target) return undefined;
  const { navigation, term, qualifier } = splitAnnotationPath(target);
  if (term === 'LineItem') return tableFor(typeName, navigation, ctx, qualifier);
  const group = (fields: FieldModel[], label: string | undefined): SubSectionModel['content'] => ({
    kind: 'form',
    groups: [{
      id: facetId(f, annotationId(target)), label, fields,
      ...(partOfPreview(f) ? {} : { partOfPreview: false }),
      ...(hiddenPathOf(f.annotations?.UI?.Hidden) ? { hidden: hiddenPathOf(f.annotations.UI.Hidden) } : {}),
    }],
  });
  if (term === 'FieldGroup' || term === 'Identification') {
    const found = lookupAnnotation(typeName, navigation, term, qualifier, ctx);
    if (!found) return undefined;
    const data = term === 'FieldGroup' ? (found.value as Any).Data : found.value;
    // FE Form getFormElementsFromAnnotations: actions and intent navigation are no form elements.
    const fields = buildFields(data, found.typeName, ctx, scope, semanticKey).filter((fd) => fd.kind !== 'action').map((fd) => (navigation && fd.path ? { ...fd, path: join(navigation, fd.path) } : fd));
    return group(fields, str((found.value as Any).Label) ?? str(f.Label));
  }
  if (term === 'DataPoint') {
    const found = lookupAnnotation(typeName, navigation, term, qualifier, ctx);
    const dp = found ? buildDataPoint(found.value as Any, qualifier ?? 'DataPoint', navigation, typeName, ctx) : undefined;
    if (!dp) return undefined;
    // In a header facet the data point is a facet of its own; in a section it is a form element (FE Form: key "DataPoint::<qualifier>").
    if (scope.endsWith('@UI.HeaderFacets')) return { kind: 'dataPoint', dataPoint: dp };
    return group([{ id: `DataPoint::${qualifier ?? ''}`, kind: 'dataPoint', dataPoint: dp, label: dp.title, criticalityIcon: true, isSemanticKey: false }], str(f.Label));
  }
  if (term === 'Contact') {
    // Communication.Contact in a form (FE Form "Contact::<qualifier>") or as a header facet (ObjectPageHeaderContact).
    const field = buildField({ $Type: 'com.sap.vocabularies.UI.v1.DataFieldForAnnotation', Target: { value: target }, Label: f.Label }, typeName, ctx, scope, semanticKey);
    return field ? group([{ ...field, id: `Contact::${qualifier ?? ''}` }], str(f.Label)) : undefined;
  }
  if (term === 'Chart' && scope.endsWith('@UI.HeaderFacets')) {
    const found = lookupAnnotation(typeName, navigation, term, qualifier, ctx);
    const chart = found ? buildChart(found.value as Any, qualifier ?? 'Chart', navigation, typeName, ctx) : undefined;
    return chart ? { kind: 'chart', chart } : undefined;
  }
  ctx.warn('UNSUPPORTED_FACET', `Facet target ${target} is not supported`, scope, 'info');
  return undefined;
}

function partOfPreview(f: Any): boolean {
  return bool(f.annotations?.UI?.PartOfPreview, true);
}

/** UI.Hidden of a facet: 'drop' for a constant true (FE: visible "false"), else its path (or undefined). */
function facetHidden(f: Any): string | 'drop' | undefined {
  const h = f.annotations?.UI?.Hidden;
  if (h === undefined || h === null) return undefined;
  return hiddenPathOf(h) ?? (bool(h, false) ? 'drop' : undefined);
}

/** FE SubSection visualizationTerms: facets whose target is a table, chart, card or presentation (no form element). */
const VISUALIZATION_TERMS = new Set(['LineItem', 'Chart', 'CardItem', 'PresentationVariant', 'SelectionPresentationVariant', 'Note']);
const isVisualization = (f: Any) => String(f.$Type).endsWith('ReferenceFacet') && VISUALIZATION_TERMS.has(splitAnnotationPath(str(f.Target?.value) ?? pathOf(f.Target) ?? '').term);

/**
 * One sub-section from a facet (FE SubSection createSubSection): a reference facet is a form, a table or a data point;
 * a collection facet is one form with a container per reference facet (nested collection facets are ignored, FE
 * getFormContainersForCollection), or a "mixed" sub-section when it also refers to tables (createCollectionFacetSubSection).
 */
function buildSubSection(f: Any, typeName: string, ctx: UiContext, semanticKey: string[], index: number): SubSectionModel | undefined {
  const type = String(f.$Type).split('.').pop();
  const scope = `${typeName}@UI.Facets`;
  const hidden = facetHidden(f);
  if (hidden === 'drop') return undefined;
  const base = (id: string, label: string, content: SubSectionModel['content']): SubSectionModel => ({ id, label, partOfPreview: partOfPreview(f), content, ...(hidden ? { hidden } : {}) });
  if (type === 'ReferenceFacet') {
    const content = contentForReference(f, typeName, ctx, semanticKey, scope);
    if (!content) {
      ctx.warn('UNRESOLVED_TARGET', `Cannot resolve facet ${str(f.ID) ?? index}`, scope);
      return undefined;
    }
    const target = str(f.Target?.value) ?? '';
    const label = str(f.Label) ?? (content.kind === 'form' ? content.groups[0]?.label : undefined) ?? (content.kind === 'table' ? ctx.raw[content.targetType] && (str(ctx.raw[content.targetType]!.annotations?.UI?.HeaderInfo?.TypeNamePlural) ?? humanize(content.navigation)) : undefined) ?? '';
    // the form of a single reference facet has no container title (FE createFormDefinition useFormContainerLabels false)
    const shown: SubSectionModel['content'] = content.kind === 'form' ? { kind: 'form', groups: content.groups.map(({ partOfPreview: _p, ...g }) => g) } : content;
    return base(facetId(f, annotationId(target) || `SubSection${index}`), label, shown);
  }
  if (type === 'CollectionFacet') {
    const children = (f.Facets ?? []) as Any[];
    const id = facetId(f, `SubSection${index}`);
    const formOf = (facets: Any[]): SubSectionModel['content'] | undefined => {
      const groups: FormGroupModel[] = [];
      for (const child of facets) {
        if (String(child.$Type).endsWith('CollectionFacet') || facetHidden(child) === 'drop') continue;
        const c = contentForReference(child, typeName, ctx, semanticKey, scope);
        if (c?.kind === 'form') groups.push(...c.groups.filter((g) => g.fields.length));
      }
      return groups.length ? { kind: 'form', groups } : undefined;
    };
    const visualizations = children.filter(isVisualization);
    if (!visualizations.length) {
      const form = formOf(children);
      return form ? base(id, str(f.Label) ?? '', form) : undefined;
    }
    const tables = visualizations.map((c, j) => buildSubSection(c, typeName, ctx, semanticKey, j)).filter((x): x is SubSectionModel => x !== undefined);
    const rest = children.filter((c) => !isVisualization(c));
    const form = rest.length ? formOf(rest) : undefined;
    const formPart = form ? [{ id: `${id}::Form`, label: str(f.Label) ?? '', partOfPreview: true, content: form }] : [];
    const parts = isVisualization(children[0]) ? [...tables, ...formPart] : [...formPart, ...tables];
    if (!parts.length) return undefined;
    return base(id, str(f.Label) ?? '', parts.length === 1 ? parts[0]!.content : { kind: 'mixed', parts });
  }
  return undefined;
}

/**
 * Sections from UI.Facets (FE ObjectPageConverter getSectionFromAnnotation, SubSection createSubSections): every facet
 * is a section; a collection facet that contains a collection facet has a sub-section per child, otherwise the facet
 * itself is the only sub-section.
 */
function buildSections(facets: Any[], typeName: string, ctx: UiContext, semanticKey: string[]): SectionModel[] {
  const sections: SectionModel[] = [];
  facets.forEach((f, i) => {
    const type = String(f.$Type).split('.').pop();
    const hidden = facetHidden(f);
    if (hidden === 'drop') return;
    const label = str(f.Label);
    const common = { ...(label ? { showTitle: true } : {}), ...(hidden ? { hidden } : {}) };
    if (type === 'CollectionFacet' && ((f.Facets ?? []) as Any[]).some((c) => String(c.$Type).endsWith('CollectionFacet'))) {
      const subs = ((f.Facets ?? []) as Any[]).map((c, j) => buildSubSection(c, typeName, ctx, semanticKey, j)).filter((s): s is SubSectionModel => s !== undefined);
      if (subs.length) sections.push({ id: facetId(f, `Section${i}`), label: label ?? subs[0]!.label, subSections: uniqueIds(subs, ctx, `${typeName} section ${i}`), ...common });
    } else {
      const sub = buildSubSection(f, typeName, ctx, semanticKey, i);
      if (sub) sections.push({ id: sub.id, label: label ?? sub.label, subSections: [{ ...sub, hidden: undefined }], ...common });
    }
  });
  return uniqueIds(sections, ctx, `${typeName}@UI.Facets`).map((s) => ({ ...s, subSections: s.subSections.map((x) => (x.hidden === undefined ? stripUndefined(x) : x)) }));
}

const stripUndefined = <T extends object>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;

/** One header facet (FE HeaderFacet createReferenceHeaderFacet / createCollectionHeaderFacet). */
function buildHeaderFacet(f: Any, typeName: string, ctx: UiContext, semanticKey: string[], i: number): HeaderFacetModel | undefined {
  const hiddenOf = facetHidden(f);
  if (hiddenOf === 'drop') return undefined;
  const hidden = hiddenOf ? { hidden: hiddenOf } : {};
  const target = str(f.Target?.value) ?? '';
  const id = facetId(f, annotationId(target) || `HeaderFacet${i}`);
  if (String(f.$Type).endsWith('CollectionFacet')) {
    const facets = ((f.Facets ?? []) as Any[]).filter((c) => String(c.$Type).endsWith('ReferenceFacet')).map((c, j) => buildHeaderFacet(c, typeName, ctx, semanticKey, j)).filter((x): x is HeaderFacetModel => x !== undefined);
    return facets.length ? { id, kind: 'collection', label: str(f.Label), facets, ...hidden } : undefined;
  }
  const content = String(f.$Type).endsWith('ReferenceFacet') ? contentForReference(f, typeName, ctx, semanticKey, `${typeName}@UI.HeaderFacets`) : undefined;
  const fields = content?.kind === 'form' ? content.groups[0]?.fields ?? [] : [];
  const only = fields.length === 1 && fields[0]!.path ? resolvePath(ctx.entityTypes, typeName, fields[0]!.path).property : undefined;
  if (content?.kind === 'form' && fields.length === 1 && fields[0]!.kind === 'contact') return { id, kind: 'contact', label: str(f.Label), field: fields[0]!, ...hidden };
  if (content?.kind === 'form' && only?.multiLine) return { id, kind: 'text', label: str(f.Label) ?? content.groups[0]?.label, field: fields[0]!, ...hidden };
  if (content?.kind === 'form') return { id, kind: 'form', label: str(f.Label) ?? content.groups[0]?.label, fields, ...hidden };
  if (content?.kind === 'chart') return { id, kind: 'chart', label: str(f.Label) ?? content.chart.title, chart: content.chart, ...hidden };
  if (content?.kind === 'dataPoint') return { id, kind: 'dataPoint', label: str(f.Label) ?? content.dataPoint.title, dataPoint: content.dataPoint, ...hidden };
  ctx.warn('UNSUPPORTED_FACET', `Header facet ${id} is not supported`, typeName, 'info');
  return undefined;
}

function buildHeaderFacets(facets: Any[], typeName: string, ctx: UiContext, semanticKey: string[]): HeaderFacetModel[] {
  const out = facets.map((f, i) => buildHeaderFacet(f, typeName, ctx, semanticKey, i)).filter((x): x is HeaderFacetModel => x !== undefined);
  return uniqueIds(out, ctx, `${typeName}@UI.HeaderFacets`);
}

