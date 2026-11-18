/** Normalized metadata model. See docs/04-model-spec.md. */

export const MODEL_VERSION = 1 as const;

export type EdmType =
  | 'Edm.String' | 'Edm.Boolean' | 'Edm.Byte' | 'Edm.SByte' | 'Edm.Int16' | 'Edm.Int32' | 'Edm.Int64'
  | 'Edm.Decimal' | 'Edm.Double' | 'Edm.Single' | 'Edm.Date' | 'Edm.DateTimeOffset' | 'Edm.TimeOfDay'
  | 'Edm.Duration' | 'Edm.Guid' | 'Edm.Binary' | 'Edm.Stream' | (string & {});

/** A value that is either a constant or a path relative to the row. */
export type ValueRef = { path: string } | { value: string | number | boolean };

export type Criticality = 0 | 1 | 2 | 3 | 5;
export type TextArrangement = 'TextFirst' | 'TextLast' | 'TextOnly' | 'TextSeparate';
export type FilterExpression =
  | 'SingleValue' | 'MultiValue' | 'SingleRange' | 'MultiRange' | 'SearchExpression' | 'MultiRangeOrSearchExpression';

export interface ValueListParameter {
  kind: 'InOut' | 'Out' | 'In' | 'DisplayOnly' | 'Constant';
  /** Property of the source entity (InOut, Out, In). */
  local?: string;
  /** Property of the value list entity. */
  valueListProperty: string;
  constant?: string;
}

export interface ValueListModel {
  collectionPath: string;
  label?: string;
  searchSupported: boolean;
  parameters: ValueListParameter[];
  /** The value list property that maps to the annotated property. */
  keyProperty: string;
  /** Description property shown as text (first DisplayOnly string, if any). */
  descriptionProperty?: string;
  fixedValues: boolean;
}

export interface PropertyModel {
  name: string;
  edmType: EdmType;
  nullable: boolean;
  isKey: boolean;
  maxLength?: number;
  precision?: number;
  scale?: number | 'variable';
  label: string;
  labelDerived: boolean;
  description?: string;
  text?: string;
  textArrangement?: TextArrangement;
  unit?: ValueRef;
  isCurrency: boolean;
  valueList?: ValueListModel;
  criticality?: ValueRef;
  hidden: boolean;
  hiddenFilter: boolean;
  computed: boolean;
  immutable: boolean;
  isImageUrl: boolean;
  isUrl: boolean;
  multiLine: boolean;
  isDigitSequence: boolean;
  isUpperCase: boolean;
  /** Common.FieldControl constant (0 hidden, 1 read-only, 3 optional, 7 mandatory) or a path. */
  fieldControl?: ValueRef;
  /** Common.FieldControl is the constant Mandatory (7). */
  mandatory: boolean;
  /** Common.FieldControl is the constant ReadOnly (1). */
  readOnly: boolean;
}

export interface NavigationModel {
  name: string;
  targetType: string;
  collection: boolean;
  partner?: string;
  referentialConstraints: { property: string; referencedProperty: string }[];
}

export interface EntityTypeModel {
  name: string;
  fullName: string;
  keys: string[];
  properties: Record<string, PropertyModel>;
  /** Declaration order. */
  propertyOrder: string[];
  navigations: Record<string, NavigationModel>;
  etag?: string;
  /** Recursive hierarchies of the type (docs/26 §3.10); absent when the type declares none. */
  hierarchies?: RecursiveHierarchyModel[];
}

/**
 * A recursive hierarchy: `Aggregation.RecursiveHierarchy` (node and parent) with the same qualifier as
 * `Hierarchy.RecursiveHierarchy` (properties the service fills per row of a TopLevels result).
 */
export interface RecursiveHierarchyModel {
  qualifier: string;
  /** NodeProperty: the node id. */
  nodeProperty: string;
  /** ParentNavigationProperty. */
  parentNavigation: string;
  /** Property holding the parent's node id (referential constraint of the parent navigation), when declared. */
  parentProperty?: string;
  /** 'expanded' | 'collapsed' | 'leaf'. */
  drillState?: string;
  distanceFromRoot?: string;
  limitedDescendantCount?: string;
  matched?: string;
  matchedDescendantCount?: string;
  externalKey?: string;
}

export interface CapabilityModel {
  searchable: boolean;
  countable: boolean;
  filterable: boolean;
  sortable: boolean;
  topSupported: boolean;
  skipSupported: boolean;
  nonFilterable: string[];
  nonSortable: string[];
  requiredFilters: string[];
  filterExpressions: Record<string, FilterExpression>;
  nonExpandable: string[];
  insertable: boolean;
  updatable: boolean;
  deletable: boolean;
  /** Aggregation.ApplySupported on the entity set or its type ($apply: groups and totals, docs/23). Absent: no aggregation. */
  aggregation?: AggregationModel;
}

/** Aggregation.ApplySupported. */
export interface AggregationModel {
  /** Supported transformations (filter, search, groupby, aggregate, …); empty when the annotation does not list them. */
  transformations: string[];
  /** GroupableProperties; empty means any property may be grouped by. */
  groupable: string[];
  /** AggregatableProperties; empty means any numeric property may be aggregated. */
  aggregatable: { path: string; methods: string[] }[];
}

export interface DataPointModel {
  id: string;
  title: string;
  /** Path relative to the entity that owns the column or facet (already prefixed by the navigation). */
  value: string;
  targetValue?: ValueRef;
  visualization: 'Number' | 'Rating' | 'Progress';
  criticality?: ValueRef;
  minimumValue?: ValueRef;
  maximumValue?: ValueRef;
  /** Aggregated rating: number of ratings (OP Rating Indicator Facet). */
  sampleSize?: ValueRef;
  /** Bullet micro chart forecast (MC-23). */
  forecastValue?: ValueRef;
  /** Semantic colour from thresholds when there is no Criticality (MC-09). */
  criticalityCalculation?: CriticalityCalculationModel;
  /** UI.VisualizationType/DeltaBulletChart: the bullet micro chart shows the difference to the target (MC-24). */
  deltaBullet?: boolean;
  /** UI.NumberFormat/NumberOfFractionalDigits of ValueFormat (MC-13). */
  fractionDigits?: number;
  /** UI.TrendCalculation: the trend arrow of a KPI (numeric card header, docs/20). */
  trendCalculation?: TrendCalculationModel;
}

/** UI.TrendCalculationType: differences to the reference value that make the trend up or down. */
export interface TrendCalculationModel {
  referenceValue?: ValueRef;
  /** The differences are relative (value / reference − 1) instead of absolute. */
  isRelative: boolean;
  upDifference?: ValueRef;
  strongUpDifference?: ValueRef;
  downDifference?: ValueRef;
  strongDownDifference?: ValueRef;
}

export type ImprovementDirection = 'Maximize' | 'Minimize' | 'Target';

/** UI.CriticalityCalculationType: each value is a constant or a path relative to the row. */
export interface CriticalityCalculationModel {
  improvementDirection: ImprovementDirection;
  deviationRangeLowValue?: ValueRef;
  toleranceRangeLowValue?: ValueRef;
  acceptanceRangeLowValue?: ValueRef;
  acceptanceRangeHighValue?: ValueRef;
  toleranceRangeHighValue?: ValueRef;
  deviationRangeHighValue?: ValueRef;
}

export type Importance = 'High' | 'Medium' | 'Low';

/** UI.DataFieldForAction (ADR-024). */
export interface ActionModel {
  id: string;
  label: string;
  /** Qualified action name, e.g. "Namespace.approve". */
  action: string;
  /** Unqualified name. */
  name: string;
  bound: boolean;
  /** Line item action (UI.DataFieldForAction/Inline). */
  inline: boolean;
  /** Footer action of the object page (UI.DataFieldForAction/Determining). */
  determining: boolean;
  criticality?: ValueRef;
  /** Core.OperationAvailable: a constant or a path relative to the bound entity (binding parameter removed). */
  operationAvailable?: ValueRef;
  /** Non-binding parameters. */
  parameters: { name: string; edmType: EdmType; label: string; nullable: boolean }[];
}

/** UI.Chart (ADR-021). */
export interface ChartModel {
  id: string;
  title: string;
  /** UI.ChartType member. Micro charts use Bullet, Donut, Pie, Column, Line, Area, Bar, BarStacked (docs/15 MC-60). */
  chartType: string;
  /** Property paths relative to the chart's entity. */
  dimensions: string[];
  measures: string[];
  /** Data points of measures (MeasureAttributes/DataPoint), by measure path. */
  dataPoints: Record<string, DataPointModel>;
  /** Navigation from the annotated entity to the chart's entity ("" for the entity itself). */
  navigation: string;
  /** Entity type the chart's paths are relative to. */
  typeName: string;
}

/** UI.SelectionPresentationVariant with a qualifier: one view of a multi-view list report. */
export interface ViewModel {
  id: string;
  text: string;
  conditions: InitialCondition[];
  presentation: PresentationModel;
  lineItem: ColumnModel[];
  chart?: ChartModel;
}

export interface DraftModel {
  root: boolean;
  activationAction?: string;
  editAction?: string;
  preparationAction?: string;
  discardAction?: string;
  newAction?: string;
}

export interface FieldModel {
  id: string;
  kind: 'field' | 'dataPoint' | 'chart';
  /** Property path relative to the row, for kind 'field'. */
  path?: string;
  label: string;
  dataPoint?: DataPointModel;
  /** Micro chart in a table cell or form (DataFieldForAnnotation to UI.Chart, docs/15 MC-10). */
  chart?: ChartModel;
  criticality?: ValueRef;
  criticalityIcon: boolean;
  url?: ValueRef;
  isSemanticKey: boolean;
  /** UI.Importance of the record (responsive table columns, forms on small screens). */
  importance?: Importance;
  /** The value refers to another object that has UI.QuickViewFacets (cross navigation, LR Navigation). */
  quickView?: { navigation: string; typeName: string };
}

export type ColumnModel = FieldModel;

export interface HeaderInfoModel {
  typeName: string;
  typeNamePlural: string;
  title?: string;
  description?: string;
  imageUrl?: ValueRef;
  /** UI.HeaderInfo/Initials: shown in an avatar when there is no image. */
  initials?: ValueRef;
  /** The type describes a person (Communication.Contact): the avatar is round, otherwise a rounded square. */
  person?: boolean;
}

export interface FormGroupModel {
  id: string;
  label?: string;
  fields: FieldModel[];
}

export type SubSectionContent =
  | { kind: 'form'; groups: FormGroupModel[] }
  | { kind: 'table'; navigation: string; targetType: string; columns: ColumnModel[]; presentation: PresentationModel }
  | { kind: 'dataPoint'; dataPoint: DataPointModel }
  /** Header micro charts (UI.Chart referenced from UI.HeaderFacets). */
  | { kind: 'chart'; chart: ChartModel };

export interface SubSectionModel {
  id: string;
  label: string;
  partOfPreview: boolean;
  content: SubSectionContent;
}

export interface SectionModel {
  id: string;
  label: string;
  subSections: SubSectionModel[];
}

export type HeaderFacetModel =
  | { id: string; kind: 'form'; label?: string; fields: FieldModel[] }
  | { id: string; kind: 'dataPoint'; label?: string; dataPoint: DataPointModel }
  /** Micro chart facet. */
  | { id: string; kind: 'chart'; label?: string; chart: ChartModel }
  /** Plain text facet: a field group with a single multi-line text field. */
  | { id: string; kind: 'text'; label?: string; field: FieldModel };

export interface PresentationModel {
  sortOrder: { path: string; descending: boolean }[];
  requestAtLeast: string[];
  /** UI.PresentationVariant/GroupBy: default grouping (the table uses the first path, docs/23). */
  groupBy: string[];
  /** UI.PresentationVariant/Total: properties whose totals are shown by default (docs/23). */
  total: string[];
}

export interface InitialCondition {
  path: string;
  exclude: boolean;
  operator: string;
  values: unknown[];
}

export interface EntityUi {
  headerInfo: HeaderInfoModel;
  lineItem: ColumnModel[];
  selectionFields: string[];
  presentation: PresentationModel;
  selectionVariant: InitialCondition[];
  sections: SectionModel[];
  headerFacets: HeaderFacetModel[];
  semanticKey: string[];
  derived: { lineItem: boolean; selectionFields: boolean; headerInfo: boolean; sections: boolean };
  /** UI.DataFieldForAction in UI.LineItem: table toolbar and line item actions. */
  actions: ActionModel[];
  /** UI.DataFieldForAction in UI.Identification: object page header and footer actions. */
  objectActions: ActionModel[];
  /** UI.Chart by qualifier ("" for the unqualified chart). */
  charts: Record<string, ChartModel>;
  /** Qualified UI.SelectionPresentationVariant annotations, in annotation order (multiple views). */
  views: ViewModel[];
  /** UI.QuickViewFacets as form groups. */
  quickView?: FormGroupModel[];
  /** Every UI.LineItem by qualifier ("" for the unqualified one); cards pick one with `annotationPath` (docs/20). */
  lineItems: Record<string, ColumnModel[]>;
  /** Every UI.PresentationVariant by qualifier ("" for the unqualified one). */
  presentationVariants: Record<string, PresentationVariantModel>;
  /** Every UI.SelectionVariant by qualifier ("" for the unqualified one). */
  selectionVariants: Record<string, InitialCondition[]>;
  /** Every UI.DataPoint by qualifier ("" for the unqualified one). */
  dataPoints: Record<string, DataPointModel>;
  /** Every UI.FieldGroup by qualifier ("" for the unqualified one). */
  fieldGroups: Record<string, FormGroupModel>;
  /** UI.Identification fields (actions are in `objectActions`). */
  identification: FieldModel[];
  /** Communication.Event of the entity type. */
  event?: EventModel;
}

/** UI.PresentationVariant with its qualifier (cards, docs/20). */
export interface PresentationVariantModel {
  presentation: PresentationModel;
  /** UI.PresentationVariant/MaxItems. */
  maxItems?: number;
  /** Qualifier of the UI.LineItem in Visualizations ("" for the unqualified one). */
  lineItemQualifier?: string;
  /** Qualifier of the UI.Chart in Visualizations ("" for the unqualified one). */
  chartQualifier?: string;
  /** UI.PresentationVariant/GroupBy: property paths the items are grouped by (group headers in cards). */
  groupBy: string[];
}

/** Communication.Event: which properties hold the start, end and texts of an event (calendar and timeline cards). */
export interface EventModel {
  dtstart?: string;
  dtend?: string;
  summary?: string;
  description?: string;
  location?: string;
  /** Category of the event (legend and colour of calendar appointments). */
  categories?: string;
}

export interface EntitySetModel {
  name: string;
  typeName: string;
  navigationBindings: Record<string, string>;
  capabilities: CapabilityModel;
  /** Per-navigation capability overrides (NavigationRestrictions). */
  navigationCapabilities: Record<string, Partial<CapabilityModel>>;
  /** Common.DraftRoot / Common.DraftNode (ADR-018). */
  draft?: DraftModel;
}

export interface ModelWarning {
  level: 'info' | 'warning';
  code: string;
  message: string;
  target?: string;
}

export interface MetaModel {
  version: typeof MODEL_VERSION;
  namespace: string;
  entitySets: Record<string, EntitySetModel>;
  entityTypes: Record<string, EntityTypeModel>;
  /** UI description per entity type full name. */
  ui: Record<string, EntityUi>;
  draftEnabled: boolean;
  warnings: ModelWarning[];
}
