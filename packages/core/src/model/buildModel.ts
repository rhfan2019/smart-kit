/* eslint-disable @typescript-eslint/no-explicit-any -- the converter output is a deeply dynamic object graph */
import type { ConvertedMetadata } from '@sap-ux/vocabularies-types';
import { convertSources, type CsdlSource } from '../csdl/load';
import { humanize } from './labels';
import { deriveColumns, deriveUi } from './derive';
import {
  MODEL_VERSION,
  type ActionModel,
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
  type MetaModel,
  type ModelWarning,
  type NavigationModel,
  type PresentationModel,
  type PropertyModel,
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
const pathOf = (v: unknown): string | undefined => {
  if (v && typeof v === 'object' && !(v instanceof String)) {
    const o = v as Any;
    if (typeof o.path === 'string') return o.path;
    if (typeof o.value === 'string') return o.value;
  }
  return undefined;
};
const join = (prefix: string, path: string) => (prefix ? `${prefix}/${path}` : path);

const CRITICALITY: Record<string, number> = { VeryNegative: 1, Neutral: 0, Negative: 1, Critical: 2, Positive: 3, VeryPositive: 3, Information: 5 };

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
    return n === undefined ? (/^\d+$/.test(r.value) ? { value: Number(r.value) } : undefined) : { value: n };
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
    // Aggregation.ApplySupported may annotate the entity set or its type (Aggregation vocabulary).
    const apply = es.annotations?.Aggregation?.ApplySupported ?? raw[es.entityTypeName ?? es.entityType?.fullyQualifiedName]?.annotations?.Aggregation?.ApplySupported;
    if (apply) capabilities.aggregation = aggregationFrom(apply);
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

  const ui: Record<string, EntityUi> = {};
  const ctx: UiContext = { entityTypes, raw, warn };
  for (const fullName of Object.keys(entityTypes)) ui[fullName] = buildUi(fullName, ctx);

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
  return { name: et.name, fullName: et.fullyQualifiedName, keys, properties, propertyOrder: order, navigations, etag };
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
    valueList: buildValueList(p, common),
    criticality: criticalityRef(ui.Criticality),
    hidden: bool(ui.Hidden, false) || (common.FieldControl !== undefined && enumName(common.FieldControl) === 'Hidden'),
    hiddenFilter: bool(ui.HiddenFilter, false),
    computed: bool(core.Computed, false),
    immutable: bool(core.Immutable, false),
    isImageUrl: bool(ui.IsImageURL, false) || bool(ui.IsImageUrl, false),
    isUrl: bool(core.IsURL, false) || bool(core.IsUrl, false),
    multiLine: bool(ui.MultiLineText, false),
    isDigitSequence: bool(common.IsDigitSequence, false),
    isUpperCase: bool(common.IsUpperCase, false),
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

function buildValueList(p: Any, common: Any): ValueListModel | undefined {
  const vl = common.ValueList;
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
  const description = parameters.find((x) => x.kind === 'DisplayOnly');
  return {
    collectionPath: str(vl.CollectionPath) ?? '',
    label: str(vl.Label),
    searchSupported: bool(vl.SearchSupported, false),
    parameters,
    keyProperty: key.valueListProperty,
    descriptionProperty: description?.valueListProperty,
    fixedValues: bool(common.ValueListWithFixedValues, false),
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
    const fe: Record<string, FilterExpression> = {};
    for (const r of (fr.FilterExpressionRestrictions ?? []) as Any[]) {
      const prop = pathOf(r.Property);
      const kind = str(r.AllowedExpressions);
      if (prop && kind && FILTER_EXPRESSIONS.has(kind)) fe[prop] = kind as FilterExpression;
    }
    out.filterExpressions = fe;
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
  return out;
}

function aggregationFrom(a: Any): AggregationModel {
  const strings = (v: unknown) => ((v ?? []) as unknown[]).map((x) => str(x) ?? pathOf(x)).filter((x): x is string => Boolean(x));
  return {
    transformations: strings(a.Transformations),
    groupable: ((a.GroupableProperties ?? []) as unknown[]).map(pathOf).filter((x): x is string => Boolean(x)),
    aggregatable: ((a.AggregatableProperties ?? []) as Any[])
      .map((r) => ({ path: pathOf(r?.Property) ?? '', methods: strings(r?.SupportedAggregationMethods) }))
      .filter((r) => r.path),
  };
}

export const DEFAULT_CAPABILITIES: CapabilityModel = {
  searchable: false,
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
  if (!measures.length) return undefined;
  const dataPoints: Record<string, DataPointModel> = {};
  for (const ma of (rec.MeasureAttributes ?? []) as Any[]) {
    const measure = pathOf(ma.Measure);
    const target = str(ma.DataPoint?.value) ?? pathOf(ma.DataPoint);
    if (!measure || !target) continue;
    const { navigation: n, term, qualifier } = splitAnnotationPath(target);
    if (term !== 'DataPoint') continue;
    const found = lookupAnnotation(typeName, n, term, qualifier, ctx);
    const dp = found ? buildDataPoint(found.value as Any, qualifier ?? 'DataPoint', n, typeName, ctx) : undefined;
    if (dp) dataPoints[measure] = dp;
  }
  const first = resolvePath(ctx.entityTypes, typeName, measures[0]!).property;
  return {
    id,
    title: str(rec.Title) ?? first?.label ?? humanize(measures[0]!),
    chartType: enumName(rec.ChartType) ?? 'Column',
    dimensions: paths(rec.Dimensions),
    measures,
    dataPoints,
    navigation,
    typeName,
  };
}

/** UI.DataFieldForAction records of a collection (UI.LineItem, UI.Identification). */
function buildActions(records: unknown, scope: string, ctx: UiContext): ActionModel[] {
  if (!Array.isArray(records)) return [];
  const out: ActionModel[] = [];
  for (const rec of records as Any[]) {
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
    let operationAvailable: ValueRef | undefined;
    if (avail !== undefined && avail !== null) {
      const path = pathOf(avail);
      if (path) operationAvailable = { path: bindingName && path.startsWith(`${bindingName}/`) ? path.slice(bindingName.length + 1) : path };
      else operationAvailable = { value: bool(avail, true) };
    }
    out.push({
      id: str(rec.ID) ?? `DataFieldForAction::${qualified}`,
      label: str(rec.Label) ?? humanize(qualified.split('.').pop()!),
      action: qualified,
      name: qualified.split('.').pop()!,
      bound,
      inline: bool(rec.Inline, false),
      determining: bool(rec.Determining, false),
      criticality: criticalityRef(rec.Criticality),
      operationAvailable,
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

function lookupAnnotation(typeName: string, navigation: string, term: string, qualifier: string | undefined, ctx: UiContext): { value: unknown; typeName: string } | undefined {
  let tn = typeName;
  if (navigation) {
    for (const seg of navigation.split('/')) {
      const nav = ctx.entityTypes[tn]?.navigations[seg];
      if (!nav) return undefined;
      tn = nav.targetType;
    }
  }
  const ui = ctx.raw[tn]?.annotations?.UI;
  if (!ui) return undefined;
  const key = qualifier ? `${term}#${qualifier}` : term;
  return ui[key] === undefined ? undefined : { value: ui[key], typeName: tn };
}

function buildField(rec: Any, typeName: string, ctx: UiContext, scope: string, semanticKey: string[]): FieldModel | undefined {
  const type = String(rec.$Type ?? '').split('.').pop();
  if (rec.annotations?.UI?.Hidden !== undefined && bool(rec.annotations.UI.Hidden, false)) return undefined;
  if (type === 'DataFieldForAction') return undefined; // actions, see buildActions
  if (type === 'DataFieldForIntentBasedNavigation' || type === 'DataFieldWithIntentBasedNavigation' || type === 'DataFieldWithAction') {
    ctx.warn('UNSUPPORTED_RECORD', `${type} is not supported (depends on the SAP launchpad) and is ignored`, scope, 'info');
    return undefined;
  }
  const importance = enumName(rec.annotations?.UI?.Importance) as Importance | undefined;
  if (type === 'DataFieldForAnnotation') {
    const target = str(rec.Target?.value) ?? pathOf(rec.Target);
    if (!target) return undefined;
    const { navigation, term, qualifier } = splitAnnotationPath(target);
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
      return { id, kind: 'chart', label: str(rec.Label) ?? chart.title, chart, criticalityIcon: false, isSemanticKey: false, importance };
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
    return { id, kind: 'dataPoint', label: str(rec.Label) ?? dp.title, dataPoint: dp, criticalityIcon: true, isSemanticKey: false, importance };
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
  return {
    id: str(rec.ID) ?? `DataField::${idFromPath(path)}`,
    kind: 'field',
    path,
    label: str(rec.Label) ?? resolved.property.label,
    criticality: criticalityRef(rec.Criticality) ?? resolved.property.criticality,
    criticalityIcon: rep !== 'WithoutIcon',
    url: type === 'DataFieldWithUrl' ? valueRef(rec.Url) : undefined,
    isSemanticKey: semanticKey.includes(path),
    importance,
    quickView: quickViewFor(typeName, path, resolved.property, ctx),
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
  const candidates: string[] = [];
  if (prop.text?.includes('/')) candidates.push(prop.text.split('/')[0]!);
  for (const nav of Object.values(ctx.entityTypes[owner]?.navigations ?? {})) {
    if (!nav.collection && nav.referentialConstraints.some((r) => r.property === prop.name)) candidates.push(nav.name);
  }
  for (const n of candidates) {
    const nav = ctx.entityTypes[owner]?.navigations[n];
    if (nav && !nav.collection && has(nav.targetType)) return { navigation: join(prefix, n), typeName: nav.targetType };
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

function presentationFrom(pv: Any | undefined): { presentation: PresentationModel; lineItemQualifier?: string } {
  const sortOrder = ((pv?.SortOrder ?? []) as Any[])
    .map((s) => ({ path: pathOf(s.Property) ?? '', descending: bool(s.Descending, false) }))
    .filter((s) => s.path);
  const requestAtLeast = ((pv?.RequestAtLeast ?? []) as unknown[]).map(pathOf).filter(Boolean) as string[];
  const groupBy = ((pv?.GroupBy ?? []) as unknown[]).map(pathOf).filter(Boolean) as string[];
  const total = ((pv?.Total ?? []) as unknown[]).map(pathOf).filter(Boolean) as string[];
  const viz = ((pv?.Visualizations ?? []) as unknown[]).map((v) => str((v as Any)?.value) ?? pathOf(v)).find((v) => v && v.includes('LineItem'));
  const lineItemQualifier = viz?.includes('#') ? viz.split('#')[1] : undefined;
  return { presentation: { sortOrder, requestAtLeast, groupBy, total }, lineItemQualifier };
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
  return out;
}

function buildUi(fullName: string, ctx: UiContext): EntityUi {
  const et = ctx.entityTypes[fullName]!;
  const ann: Any = ctx.raw[fullName]?.annotations ?? {};
  const ui: Any = ann.UI ?? {};
  const semanticKey = ((ann.Common?.SemanticKey ?? []) as unknown[]).map(pathOf).filter(Boolean) as string[];

  const spv = ui.SelectionPresentationVariant;
  const pv = spv?.PresentationVariant ?? ui.PresentationVariant;
  const sv = spv?.SelectionVariant ?? ui.SelectionVariant;
  const { presentation, lineItemQualifier } = presentationFrom(pv);
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
    const { presentation: vp, lineItemQualifier: lq } = presentationFrom(v?.PresentationVariant);
    const vizs = ((v?.PresentationVariant?.Visualizations ?? []) as unknown[]).map((x) => str((x as Any)?.value) ?? pathOf(x) ?? '');
    const chartViz = vizs.find((x) => x.includes('Chart'));
    const records = ui[lq ? `LineItem#${lq}` : 'LineItem'];
    views.push({
      id: q,
      text: str(v?.Text) ?? humanize(q),
      conditions: selectionVariantFrom(v?.SelectionVariant),
      presentation: vp.sortOrder.length ? vp : { ...vp, sortOrder: presentation.sortOrder },
      lineItem: records ? buildFields(records, fullName, ctx, `${fullName}@UI.LineItem`, semanticKey) : lineItem ?? [],
      chart: chartViz ? charts[chartViz.includes('#') ? chartViz.split('#')[1]! : ''] : undefined,
    });
  }

  const quickViewFacets = ui.QuickViewFacets as Any[] | undefined;
  const quickView = Array.isArray(quickViewFacets)
    ? quickViewFacets.flatMap((f) => {
        const c = String(f.$Type).endsWith('ReferenceFacet') ? contentForReference(f, fullName, ctx, semanticKey, `${fullName}@UI.QuickViewFacets`) : undefined;
        return c?.kind === 'form' ? c.groups : [];
      })
    : undefined;

  const ui2 = deriveUi(et, ctx.entityTypes, {
    headerInfo,
    lineItem,
    selectionFields,
    presentation,
    selectionVariant: selectionVariantFrom(sv),
    sections,
    headerFacets,
    semanticKey,
  }, (target) => tableFor(fullName, target, ctx));
  return {
    ...ui2,
    actions: buildActions(lineItemRecords, `${fullName}@UI.LineItem`, ctx),
    objectActions: buildActions(ui.Identification, `${fullName}@UI.Identification`, ctx),
    charts,
    views,
    quickView,
    ...cardAnnotations(fullName, ui, ann, ui2.lineItem, ctx, semanticKey),
  };
}

const qualifierOf = (key: string, term: string): string | undefined =>
  key === term ? '' : key.startsWith(`${term}#`) ? key.slice(term.length + 1) : undefined;

/** Annotations that cards select by qualifier (docs/20): line items, presentation and selection variants, data points, field groups, events. */
function cardAnnotations(fullName: string, ui: Any, ann: Any, lineItem: ColumnModel[], ctx: UiContext, semanticKey: string[]): Pick<EntityUi, 'lineItems' | 'presentationVariants' | 'selectionVariants' | 'dataPoints' | 'fieldGroups' | 'identification' | 'event'> {
  const lineItems: Record<string, ColumnModel[]> = { '': lineItem };
  const presentationVariants: Record<string, PresentationVariantModel> = {};
  const selectionVariants: Record<string, InitialCondition[]> = {};
  const dataPoints: Record<string, DataPointModel> = {};
  const fieldGroups: Record<string, FormGroupModel> = {};
  for (const key of Object.keys(ui)) {
    let q: string | undefined;
    if ((q = qualifierOf(key, 'LineItem')) !== undefined) {
      if (q) lineItems[q] = buildFields(ui[key], fullName, ctx, `${fullName}@UI.LineItem#${q}`, semanticKey);
    } else if ((q = qualifierOf(key, 'PresentationVariant')) !== undefined) {
      const pv = ui[key] as Any;
      const { presentation } = presentationFrom(pv);
      const vizs = ((pv?.Visualizations ?? []) as unknown[]).map((v) => str((v as Any)?.value) ?? pathOf(v) ?? '');
      const qual = (term: string) => {
        const v = vizs.find((x) => x.includes(term));
        return v === undefined ? undefined : v.includes('#') ? v.split('#')[1]! : '';
      };
      const max = Number(pv?.MaxItems?.valueOf?.() ?? pv?.MaxItems);
      presentationVariants[q] = { presentation, maxItems: Number.isFinite(max) && max > 0 ? max : undefined, lineItemQualifier: qual('LineItem'), chartQualifier: qual('Chart'), groupBy: presentation.groupBy };
    } else if ((q = qualifierOf(key, 'SelectionVariant')) !== undefined) {
      selectionVariants[q] = selectionVariantFrom(ui[key]);
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
  return { lineItems, presentationVariants, selectionVariants, dataPoints, fieldGroups, identification, event };
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
  if (term === 'FieldGroup' || term === 'Identification') {
    const found = lookupAnnotation(typeName, navigation, term, qualifier, ctx);
    if (!found) return undefined;
    const data = term === 'FieldGroup' ? (found.value as Any).Data : found.value;
    const fields = buildFields(data, found.typeName, ctx, scope, semanticKey).map((fd) => (navigation && fd.path ? { ...fd, path: join(navigation, fd.path) } : fd));
    return { kind: 'form', groups: [{ id: facetId(f, annotationId(target)), label: str((found.value as Any).Label) ?? str(f.Label), fields }] };
  }
  if (term === 'DataPoint') {
    const found = lookupAnnotation(typeName, navigation, term, qualifier, ctx);
    const dp = found ? buildDataPoint(found.value as Any, qualifier ?? 'DataPoint', navigation, typeName, ctx) : undefined;
    return dp ? { kind: 'dataPoint', dataPoint: dp } : undefined;
  }
  if (term === 'Chart' && scope.endsWith('@UI.HeaderFacets')) {
    const found = lookupAnnotation(typeName, navigation, term, qualifier, ctx);
    const chart = found ? buildChart(found.value as Any, qualifier ?? 'Chart', navigation, typeName, ctx) : undefined;
    return chart ? { kind: 'chart', chart } : undefined;
  }
  ctx.warn('UNSUPPORTED_FACET', `Facet target ${target} is not supported in phase 1`, scope, 'info');
  return undefined;
}

function partOfPreview(f: Any): boolean {
  return bool(f.annotations?.UI?.PartOfPreview, true);
}

function buildSubSection(f: Any, typeName: string, ctx: UiContext, semanticKey: string[], index: number): SubSectionModel | undefined {
  const type = String(f.$Type).split('.').pop();
  const scope = `${typeName}@UI.Facets`;
  if (type === 'ReferenceFacet') {
    const content = contentForReference(f, typeName, ctx, semanticKey, scope);
    if (!content) {
      ctx.warn('UNRESOLVED_TARGET', `Cannot resolve facet ${str(f.ID) ?? index}`, scope);
      return undefined;
    }
    const target = str(f.Target?.value) ?? '';
    const label = str(f.Label) ?? (content.kind === 'form' ? content.groups[0]?.label : undefined) ?? (content.kind === 'table' ? ctx.raw[content.targetType] && (str(ctx.raw[content.targetType]!.annotations?.UI?.HeaderInfo?.TypeNamePlural) ?? humanize(content.navigation)) : undefined) ?? '';
    return { id: facetId(f, annotationId(target) || `SubSection${index}`), label, partOfPreview: partOfPreview(f), content };
  }
  if (type === 'CollectionFacet') {
    // A collection facet nested inside a section is a form with several groups.
    const groups: FormGroupModel[] = [];
    for (const child of (f.Facets ?? []) as Any[]) {
      const c = contentForReference(child, typeName, ctx, semanticKey, scope);
      if (c?.kind === 'form') groups.push(...c.groups);
    }
    if (!groups.length) return undefined;
    return { id: facetId(f, `SubSection${index}`), label: str(f.Label) ?? '', partOfPreview: partOfPreview(f), content: { kind: 'form', groups } };
  }
  return undefined;
}

function buildSections(facets: Any[], typeName: string, ctx: UiContext, semanticKey: string[]): SectionModel[] {
  const sections: SectionModel[] = [];
  facets.forEach((f, i) => {
    const type = String(f.$Type).split('.').pop();
    if (type === 'CollectionFacet') {
      const subs = ((f.Facets ?? []) as Any[]).map((c, j) => buildSubSection(c, typeName, ctx, semanticKey, j)).filter((s): s is SubSectionModel => s !== undefined);
      if (subs.length) sections.push({ id: facetId(f, `Section${i}`), label: str(f.Label) ?? subs[0]!.label, subSections: uniqueIds(subs, ctx, `${typeName} section ${i}`) });
    } else {
      const sub = buildSubSection(f, typeName, ctx, semanticKey, i);
      if (sub) sections.push({ id: sub.id, label: sub.label, subSections: [sub] });
    }
  });
  return uniqueIds(sections, ctx, `${typeName}@UI.Facets`);
}

function buildHeaderFacets(facets: Any[], typeName: string, ctx: UiContext, semanticKey: string[]): HeaderFacetModel[] {
  const out: HeaderFacetModel[] = [];
  facets.forEach((f, i) => {
    const content = String(f.$Type).endsWith('ReferenceFacet') ? contentForReference(f, typeName, ctx, semanticKey, `${typeName}@UI.HeaderFacets`) : undefined;
    const target = str(f.Target?.value) ?? '';
    const id = facetId(f, annotationId(target) || `HeaderFacet${i}`);
    const fields = content?.kind === 'form' ? content.groups[0]?.fields ?? [] : [];
    const only = fields.length === 1 && fields[0]!.path ? resolvePath(ctx.entityTypes, typeName, fields[0]!.path).property : undefined;
    if (content?.kind === 'form' && only?.multiLine) out.push({ id, kind: 'text', label: str(f.Label) ?? content.groups[0]?.label, field: fields[0]! });
    else if (content?.kind === 'form') out.push({ id, kind: 'form', label: str(f.Label) ?? content.groups[0]?.label, fields });
    else if (content?.kind === 'chart') out.push({ id, kind: 'chart', label: str(f.Label) ?? content.chart.title, chart: content.chart });
    else if (content?.kind === 'dataPoint') out.push({ id, kind: 'dataPoint', label: str(f.Label) ?? content.dataPoint.title, dataPoint: content.dataPoint });
    else ctx.warn('UNSUPPORTED_FACET', `Header facet ${id} is not supported in phase 1`, typeName, 'info');
  });
  return uniqueIds(out, ctx, `${typeName}@UI.HeaderFacets`);
}

