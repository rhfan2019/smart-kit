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
  /** Common.ValueList/SearchSupported; the vocabulary default is true. */
  searchSupported: boolean;
  parameters: ValueListParameter[];
  /** The value list property that maps to the annotated property. */
  keyProperty: string;
  /**
   * Description property shown as text: the Common.Text of the key property in the value list entity (FE
   * ValueListHelper `_enrichPath`: "only the text annotation of the key can specify the description").
   */
  descriptionProperty?: string;
  fixedValues: boolean;
  /** Qualifier of the Common.ValueList annotation ("" for the unqualified one). */
  qualifier?: string;
  /** Common.ValueList/PresentationVariantQualifier: the PV of the value list entity whose SortOrder sorts the list. */
  presentationVariantQualifier?: string;
  /**
   * The Common.ValueListReferences entry (URL of a value help service's `$metadata`, relative to the data service's
   * `$metadata`) this value list comes from, as a Common.ValueListMapping of that service: `collectionPath` and the
   * parameters' value list properties belong to that service (SAPUI5 ODataMetaModel#requestValueListInfo `$model`).
   * Absent for a Common.ValueList of the data service itself.
   */
  reference?: string;
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
  /**
   * All Common.ValueList annotations that apply, by qualifier, default ("") first (FE `putDefaultQualifierFirst`),
   * limited to Common.ValueListRelevantQualifiers when it lists qualifiers; `valueList` is the first of them. Absent
   * when there is at most one.
   */
  valueLists?: ValueListModel[];
  /**
   * Common.ValueListReferences: URLs of value help services' `$metadata` (relative to this service's `$metadata`) whose
   * Common.ValueListMapping annotations describe the value lists of the property. They are loaded on demand
   * (`ValueListReferenceService`, `referencedValueLists`); `valueList` / `valueLists` hold only the local ones.
   */
  valueListReferences?: string[];
  /** Common.ValueListWithFixedValues (also for value lists that come from Common.ValueListReferences). */
  valueListFixedValues?: boolean;
  hidden: boolean;
  /** UI.Hidden as a path: the field is hidden for rows where it is true (FE UIFormatters isVisible). */
  hiddenPath?: string;
  /** UI.Placeholder: the placeholder of the editor (FE FieldTemplating getPlaceholder). */
  placeholder?: string;
  hiddenFilter: boolean;
  computed: boolean;
  immutable: boolean;
  isImageUrl: boolean;
  /** Communication.IsEmailAddress: shown as a `mailto:` link. */
  isEmailAddress?: boolean;
  /** Communication.IsPhoneNumber: shown as a `tel:` link. */
  isPhoneNumber?: boolean;
  /** Common.Masked: shown as "*" characters. */
  masked?: boolean;
  /** Common.ExternalID: path of the property whose value is shown instead of this (technical) one. */
  externalId?: string;
  /** Common.Timezone of an Edm.DateTimeOffset: IANA time zone constant or path. */
  timezone?: ValueRef;
  /** Common.IsTimezone: the value is an IANA time zone ID. */
  isTimezone?: boolean;
  /** Core.ContentDisposition/Filename of an Edm.Stream. */
  filename?: ValueRef;
  /** Core.MediaType of an Edm.Stream or binary. */
  mediaType?: ValueRef;
  /** HTML5.LinkTarget of the property (target window of its URL links). */
  linkTarget?: string;
  /** Common.SemanticObject (constant): the value is a smart link to the semantic object's targets (D42). */
  semanticObject?: string;
  multiLine: boolean;
  isDigitSequence: boolean;
  /** Common.FilterDefaultValue: default "EQ" filter condition when there is no default selection variant (FE FilterHelper). */
  filterDefaultValue?: string | number | boolean;
  /** Common.FieldControl constant (0 hidden, 1 read-only, 3 optional, 7 mandatory) or a path. */
  fieldControl?: ValueRef;
  /** Common.FieldControl is the constant Mandatory (7). */
  mandatory: boolean;
  /** Common.FieldControl is the constant ReadOnly (1). */
  readOnly: boolean;
  /** A parameter of a parameterized entity set, resolvable on its result type (EntitySetModel.parameters). */
  parameter?: boolean;
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
  /** Hierarchy.RecursiveHierarchy with the same (non-empty) qualifier exists (FE: the default table type is TreeTable). */
  paired?: boolean;
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
  /**
   * InsertRestrictions/Insertable or DeleteRestrictions/Deletable given as a path (FE isPathInsertable / isPathDeletable):
   * the list keeps the button; a deletable path is evaluated per selected row (FE deletableContexts).
   */
  insertablePath?: string;
  deletablePath?: string;
  /** Capabilities.FilterFunctions contains "tolower": string filters are case-insensitive (`tolower(p) eq tolower('x')`). */
  caseInsensitive?: boolean;
  /** UI.CreateHidden / UI.DeleteHidden of the entity set, else of its type (FE StandardActions isActionAnnotatedHidden). */
  createHidden?: ValueRef;
  deleteHidden?: ValueRef;
  /** UI.UpdateHidden of the entity set (else its type): a constant true hides the object page's Edit, a path per object (FE getEditButtonVisibility). */
  updateHidden?: ValueRef;
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
  /**
   * Aggregation.CustomAggregate by qualifier (the name of the aggregate, usually the property it aggregates) → its
   * type, e.g. `{ NetAmount: 'Edm.Decimal' }`. FE takes these as the aggregatable measures and requests
   * `aggregate(Name)`, leaving the method to the service (docs/29 §4 P1-2).
   */
  customAggregates: Record<string, string>;
  /**
   * Analytics.AggregatedProperty (qualified, preferred) or the first Analytics.AggregatedProperties of the type,
   * restricted to aggregatable properties: the transformation aggregates of charts (FE AggregationHelper
   * getTransAggregations), requested as `aggregate(<property> with <method> as <name>)`.
   */
  aggregatedProperties?: AggregatedPropertyModel[];
}

/** One Analytics.AggregatedProperty (stage 4, docs/29 §5). */
export interface AggregatedPropertyModel {
  /** Qualifier of the Analytics.AggregatedProperty annotation (absent for an AggregatedProperties entry). */
  qualifier?: string;
  /** Name: the alias of the aggregate in the response. */
  name: string;
  /** AggregatableProperty. */
  property: string;
  /** AggregationMethod (sum, min, max, average, countdistinct, …). */
  method: string;
  /** Common.Label of the annotation. */
  label?: string;
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
  /** Common.IsActionCritical of the action: a confirmation before it runs (FE Operation confirmAction). */
  critical?: ValueRef;
  /** UI.IsCopyAction of the record: the standard "Copy" button after "Create" (FE Table getTableAnnotationActions). */
  copy?: boolean;
  /** Id of the UI.DataFieldForActionGroup the action belongs to ("DataFieldForActionGroup::<ID>"). */
  menu?: string;
  criticality?: ValueRef;
  /** Core.OperationAvailable: a constant or a path relative to the bound entity (binding parameter removed). */
  operationAvailable?: ValueRef;
  /** UI.Hidden of the record as a path (a constant true drops the action): the button is hidden for rows where it is true. */
  hidden?: string;
  /** UI.Emphasized of the record (FE HeaderAndFooterAction getDataFieldAnnotationAction: emphasized when there is no Criticality). */
  emphasized?: boolean;
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
  /** UI.Chart/DimensionAttributes Role by dimension path ("Category", "Series", "Category2"); absent: Category. */
  dimensionRoles?: Record<string, string>;
  /** Data points of measures (MeasureAttributes/DataPoint), by measure path. */
  dataPoints: Record<string, DataPointModel>;
  /** Navigation from the annotated entity to the chart's entity ("" for the entity itself). */
  navigation: string;
  /** Entity type the chart's paths are relative to. */
  typeName: string;
  /** UI.Chart/Title as annotated (`title` falls back to the first measure's label); FE: the chart header. */
  chartTitle?: string;
  /** UI.Chart/Description. */
  description?: string;
  /** UI.Chart/DynamicMeasures: names of the Analytics.AggregatedProperty they point to (FE: measures before `Measures`). */
  dynamicMeasures?: string[];
  /** UI.Chart/MeasureAttributes Role by measure (or dynamic measure name): "Axis1" … "Axis4". */
  measureRoles?: Record<string, string>;
  /** UI.Chart/Actions: the unbound, non-inline, non-determining UI.DataFieldForAction (FE Chart getChartActions). */
  actions?: ActionModel[];
}

/** UI.SelectionPresentationVariant with a qualifier: one view of a multi-view list report. */
export interface ViewModel {
  id: string;
  text: string;
  conditions: InitialCondition[];
  presentation: PresentationModel;
  lineItem: ColumnModel[];
  /** The first UI.Chart in the view's visualizations (sap.fe.macros.Chart with the view as metaPath). */
  chart?: ChartModel;
  /**
   * What the view shows (FE ListReportConverter SingleTable / SingleChart): "chart" when the first LineItem or Chart of
   * its visualizations is a chart (or, without either, only the default chart exists); default "table".
   */
  visualization?: 'table' | 'chart';
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
  /**
   * 'field': a DataField (also WithUrl, WithNavigationPath, WithIntentBasedNavigation, WithAction); 'dataPoint', 'chart',
   * 'fieldGroup', 'connectedFields', 'contact': a DataFieldForAnnotation to UI.DataPoint, UI.Chart, UI.FieldGroup,
   * UI.ConnectedFields, Communication.Contact; 'action': an inline UI.DataFieldForAction (a column of a line item).
   */
  kind: 'field' | 'dataPoint' | 'chart' | 'fieldGroup' | 'connectedFields' | 'contact' | 'action';
  /** Property path relative to the row, for kind 'field'. */
  path?: string;
  label: string;
  /** HTML5.CssDefaults/width of the record (column width, FE Columns). */
  width?: string;
  /** The fields of a field group or of connected fields, in order. */
  fields?: FieldModel[];
  /** UI.ConnectedFields/Template, e.g. "{From} – {To}", and the key of each field in `fields` (same order). */
  template?: { text: string; keys: string[] };
  /** Communication.Contact (kind 'contact'): paths of the name and the details shown in the contact popover. */
  contact?: ContactModel;
  /** The inline action (kind 'action') or the action a DataFieldWithAction value runs (kind 'field'). */
  action?: ActionModel;
  /** UI.DataFieldWithNavigationPath/Target: the value is a link to the object reached by this navigation. */
  navigationPath?: string;
  /** UI.DataFieldWithIntentBasedNavigation: the intent (a link only where the launchpad resolves it). */
  intent?: { semanticObject: string; action?: string };
  dataPoint?: DataPointModel;
  /** Micro chart in a table cell or form (DataFieldForAnnotation to UI.Chart, docs/15 MC-10). */
  chart?: ChartModel;
  criticality?: ValueRef;
  criticalityIcon: boolean;
  url?: ValueRef;
  /** UI.DataFieldWithUrl: HTML5.LinkTarget of the record or of the property ("_blank", "_self", …); none: the same window ("_top"). */
  linkTarget?: string;
  /** UI.DataFieldWithUrl/IconUrl: an icon shown before the linked value. */
  iconUrl?: ValueRef;
  isSemanticKey: boolean;
  /** UI.Importance of the record (responsive table columns, forms on small screens). */
  importance?: Importance;
  /**
   * UI.Hidden of the record or of its property as a path (a constant true drops the field): hidden for rows where the
   * path is true (FE UIFormatters isVisible / DataField isReferencePropertyStaticallyHidden).
   */
  hidden?: string;
  /** UI.PartOfPreview false on the record: in a form the field is shown only with "Show More" details (FE Form isFieldPartOfPreview). */
  partOfPreview?: boolean;
  /** The value refers to another object that has UI.QuickViewFacets (cross navigation, LR Navigation). */
  quickView?: { navigation: string; typeName: string };
}

export type ColumnModel = FieldModel;

/** Communication.Contact: each value is a path relative to the row (prefixed by the navigation) or a constant. */
export interface ContactModel {
  fn?: ValueRef;
  title?: ValueRef;
  org?: ValueRef;
  role?: ValueRef;
  photo?: ValueRef;
  email?: ValueRef;
  tel?: ValueRef;
}

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
  /** UI.PartOfPreview false of the facet: the form container is shown only after "Show More" (FE Form hasFacetsNotPartOfPreview). */
  partOfPreview?: boolean;
  /** UI.Hidden of the facet as a path: the container is hidden for rows where it is true (a constant true drops it). */
  hidden?: string;
}

export type SubSectionContent =
  | { kind: 'form'; groups: FormGroupModel[] }
  | { kind: 'table'; navigation: string; targetType: string; columns: ColumnModel[]; presentation: PresentationModel }
  | { kind: 'dataPoint'; dataPoint: DataPointModel }
  /** Header micro charts (UI.Chart referenced from UI.HeaderFacets). */
  | { kind: 'chart'; chart: ChartModel }
  /**
   * A collection facet with tables (or charts) and forms (FE SubSection createCollectionFacetSubSection, SubSectionType
   * Mixed): its parts in order, each a sub-section of its own (the visualizations first when the first facet is one).
   */
  | { kind: 'mixed'; parts: SubSectionModel[] };

export interface SubSectionModel {
  id: string;
  /** UI.Facet/Label; empty without one. */
  label: string;
  partOfPreview: boolean;
  content: SubSectionContent;
  /** UI.Hidden of the facet as a path (a constant true drops the sub-section). */
  hidden?: string;
}

export interface SectionModel {
  id: string;
  /** UI.Facet/Label, else the label of the first sub-section (anchor text). */
  label: string;
  /** The facet has a UI.Facet/Label (FE ObjectPageSection showTitle). */
  showTitle?: boolean;
  subSections: SubSectionModel[];
  /** UI.Hidden of the facet as a path (a constant true drops the section). */
  hidden?: string;
}

export type HeaderFacetModel =
  | { id: string; kind: 'form'; label?: string; fields: FieldModel[]; hidden?: string }
  | { id: string; kind: 'dataPoint'; label?: string; dataPoint: DataPointModel; hidden?: string }
  /** Micro chart facet. */
  | { id: string; kind: 'chart'; label?: string; chart: ChartModel; hidden?: string }
  /** Plain text facet: a field group with a single multi-line text field. */
  | { id: string; kind: 'text'; label?: string; field: FieldModel; hidden?: string }
  /** Communication.Contact facet (FE ObjectPageHeaderContact): the contact's name as a link with its details. */
  | { id: string; kind: 'contact'; label?: string; field: FieldModel; hidden?: string }
  /** A collection facet (FE createCollectionHeaderFacet): its reference facets side by side in one container. */
  | { id: string; kind: 'collection'; label?: string; facets: HeaderFacetModel[]; hidden?: string };

export interface PresentationModel {
  sortOrder: { path: string; descending: boolean }[];
  requestAtLeast: string[];
  /** UI.PresentationVariant/GroupBy: default grouping (the table uses the first path, docs/23). */
  groupBy: string[];
  /** UI.PresentationVariant/Total: properties whose totals are shown by default (docs/23). */
  total: string[];
  /**
   * Whether the presentation variant has `Total` at all (also an empty collection: no totals). Without it an analytical
   * table totals all custom aggregates (FE getAggregateConditions, D39).
   */
  hasTotal?: boolean;
  /** UI.PresentationVariant/InitialExpansionLevel (tree tables: FE requests this level + 1). */
  initialExpansionLevel?: number;
  /**
   * The sort order of a chart, when SortOrder has a DynamicProperty: the Analytics.AggregatedProperty name in its
   * place (FE ChartHelper getSortConditions; tables ignore DynamicProperty). Absent: `sortOrder`.
   */
  chartSortOrder?: { path: string; descending: boolean }[];
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
  /**
   * UI.DataFieldForActionGroup records of the UI.LineItem: menu buttons of the table toolbar; their actions are in
   * `actions` with `menu` set to the group id (FE Table getDataFieldAnnotationAction, ActionType.Menu).
   */
  actionGroups?: { id: string; label: string; actions: string[] }[];
  /** UI.Criticality annotated on each UI.LineItem, by qualifier ("" for the unqualified one): the row highlight (FE Table getHighlightRowBinding). */
  rowHighlight?: Record<string, ValueRef>;
  /** UI.DataFieldForAction in UI.Identification: object page header and footer actions. */
  objectActions: ActionModel[];
  /** UI.Chart by qualifier ("" for the unqualified chart). */
  charts: Record<string, ChartModel>;
  /** Qualified UI.SelectionPresentationVariant annotations, in annotation order (multiple views). */
  views: ViewModel[];
  /**
   * Qualifier of the UI.Chart the default presentation shows instead of a table: the first LineItem or Chart of the
   * visualizations of the compliant default SPV / PV is a chart (FE ListReportConverter SingleChart).
   */
  defaultChart?: string;
  /** UI.KPI by qualifier (list report KPI tags, FE controls/Common/KPI); absent when the type has none. */
  kpis?: Record<string, KpiModel>;
  /** UI.QuickViewFacets as form groups. */
  quickView?: FormGroupModel[];
  /** Every UI.LineItem by qualifier ("" for the unqualified one); cards pick one with `annotationPath` (docs/20). */
  lineItems: Record<string, ColumnModel[]>;
  /** Every UI.PresentationVariant by qualifier ("" for the unqualified one). */
  presentationVariants: Record<string, PresentationVariantModel>;
  /** Every UI.SelectionVariant by qualifier ("" for the unqualified one). */
  selectionVariants: Record<string, InitialCondition[]>;
  /** UI.SelectionVariant/Text by qualifier, where annotated (quick variant selection of the list report, FE QuickFilter). */
  selectionVariantTexts?: Record<string, string>;
  /** Every UI.DataPoint by qualifier ("" for the unqualified one). */
  dataPoints: Record<string, DataPointModel>;
  /** Every UI.FieldGroup by qualifier ("" for the unqualified one). */
  fieldGroups: Record<string, FormGroupModel>;
  /** UI.Identification fields (actions are in `objectActions`). */
  identification: FieldModel[];
  /** Communication.Event of the entity type. */
  event?: EventModel;
}

/** UI.KPI (stage 4, docs/29 §5): the data point, its selection variant and the chart of Detail/DefaultPresentationVariant. */
export interface KpiModel {
  id: string;
  /** UI.DataPoint/Title as annotated (FE: no title, no tag text). */
  title?: string;
  dataPoint: DataPointModel;
  /** UI.KPI/SelectionVariant: filters of the KPI value. */
  conditions: InitialCondition[];
  /** Qualifier of the UI.Chart of Detail/DefaultPresentationVariant (FE needs one for the KPI). */
  chart?: string;
}

/** UI.PresentationVariant with its qualifier (cards, docs/20). */
export interface PresentationVariantModel {
  presentation: PresentationModel;
  /** UI.PresentationVariant/Text (the tab text of a list report view, FE MultipleModeControl). */
  text?: string;
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
  /**
   * Parameterized entity set (Common.ResultContext): this set ("P/Set") is the result set contained in the parameter set
   * `entitySet` through `navigation`; `properties` are the parameters (the keys of the parameter type `typeName`), in
   * order. Requests go to "P(p1=…,p2=…)/Set" with the parameters' conditions (`sourcePath`).
   */
  parameters?: { entitySet: string; navigation: string; typeName: string; properties: string[] };
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
