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
}

export interface DataPointModel {
  id: string;
  title: string;
  /** Path relative to the entity that owns the column or facet (already prefixed by the navigation). */
  value: string;
  targetValue?: ValueRef;
  visualization: 'Number' | 'Rating' | 'Progress';
  criticality?: ValueRef;
}

export interface FieldModel {
  id: string;
  kind: 'field' | 'dataPoint';
  /** Property path relative to the row, for kind 'field'. */
  path?: string;
  label: string;
  dataPoint?: DataPointModel;
  criticality?: ValueRef;
  criticalityIcon: boolean;
  url?: ValueRef;
  isSemanticKey: boolean;
}

export type ColumnModel = FieldModel;

export interface HeaderInfoModel {
  typeName: string;
  typeNamePlural: string;
  title?: string;
  description?: string;
  imageUrl?: ValueRef;
}

export interface FormGroupModel {
  id: string;
  label?: string;
  fields: FieldModel[];
}

export type SubSectionContent =
  | { kind: 'form'; groups: FormGroupModel[] }
  | { kind: 'table'; navigation: string; targetType: string; columns: ColumnModel[]; presentation: PresentationModel }
  | { kind: 'dataPoint'; dataPoint: DataPointModel };

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
  | { id: string; kind: 'dataPoint'; label?: string; dataPoint: DataPointModel };

export interface PresentationModel {
  sortOrder: { path: string; descending: boolean }[];
  requestAtLeast: string[];
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
}

export interface EntitySetModel {
  name: string;
  typeName: string;
  navigationBindings: Record<string, string>;
  capabilities: CapabilityModel;
  /** Per-navigation capability overrides (NavigationRestrictions). */
  navigationCapabilities: Record<string, Partial<CapabilityModel>>;
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
