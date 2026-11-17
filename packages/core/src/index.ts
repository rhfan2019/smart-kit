/** Public API of @rhfan2019/smart-kit-core. Everything exported here is listed in docs/api.md. */
export { MODEL_VERSION } from './model/types';
export type {
  ActionModel, AggregationModel, ChartModel, DraftModel, EventModel, Importance, PresentationVariantModel, ViewModel,
  CapabilityModel, ColumnModel, Criticality, CriticalityCalculationModel, ImprovementDirection, DataPointModel, EdmType, EntitySetModel, EntityTypeModel, EntityUi, FieldModel,
  FilterExpression, FormGroupModel, HeaderFacetModel, HeaderInfoModel, InitialCondition, MetaModel, ModelWarning, NavigationModel,
  PresentationModel, PropertyModel, TrendCalculationModel, SectionModel, SubSectionContent, SubSectionModel, TextArrangement, ValueListModel,
  ValueListParameter, ValueRef,
} from './model/types';
export { buildModel, resolvePath, parseAnnotationPath, DEFAULT_CAPABILITIES, type BuildModelOptions } from './model/buildModel';
export { DERIVED_GENERAL_SECTION, deriveColumns } from './model/derive';
export { humanize } from './model/labels';
export { calculateCriticality, calculateTrend } from './model/criticality';
export { getEntitySet, getEntityType, getUi, getProperty, capabilitiesFor, targetEntitySet, isFilterable, isSortable, UnknownEntitySetError } from './model/access';
export { csdlJsonToXml } from './csdl/csdlJsonToXml';
export { ModelError, toCsdlXml, type CsdlSource } from './csdl/load';

export {
  OPERATORS, OPERATOR_ARITY, toFilter, propertyFilter, isComplete, activeFilterPaths, matches, compareValues, compareDecimal, startOfDayIso,
  type Condition, type FilterState, type Operator, type FilterOptions,
} from './conditions/conditions';
export { filterExpressionRules, conditionAllowed, restrictConditions, type FilterExpressionRules } from './conditions/filterExpressions';
export { toLiteral, LiteralError } from './query/literals';
export {
  keyPredicate, parseEntityPath, resolveEntityPath, entityPathOf, childPathOf, EntityPathError,
  type EntityPath, type PathSegment, type ResolvedPath,
} from './query/entityPath';
export {
  buildListRequest, buildObjectRequest, buildValueHelpRequest, buildAggregateRequest, chartFields, chartExpand, chartIsSeries, chartSeriesSelect, MICRO_CHART_MAX_POINTS, MICRO_COMPARISON_MAX_BARS, objectFields, fieldPaths, companionPaths, dataPointPaths, selectAndExpand,
  toQueryString, readQueryString, filterString, sourcePath, sourceInfo, encodeOption,
  type QueryRequest, type QueryResult, type ReadRequest, type Row, type SortItem, type ExpandSpec, type QuerySource,
  type ListRequestOptions, type ValueHelpRequestOptions, type AggregateRequestOptions, type SourceInfo,
} from './query/request';
export {
  buildTotalsRequest, collectTotals, canTotal, canGroup, canSubtotal, unitPathOf, groupKey, TOTAL_COUNT_ALIAS, MAX_GROUP_VALUES,
  type TotalsRequestOptions, type TotalsEntry, type TotalAmount,
} from './query/totals';

export type { DataProvider, ReadDataProvider, WriteDataProvider, WriteResult, FetchLike, RequestOptions } from './data/provider';
export { messagesFromHeader, messagesFromError, createMessage, highestSeverity, type Message, type MessageType } from './data/messages';
export { ODataV4Provider, loadService, type ODataV4ProviderOptions, type LoadServiceOptions } from './data/odata';
export { MemoryProvider, type MemoryProviderOptions } from './data/memory';
export { ODataError, ConcurrencyError, errorFromResponse, isAbortError, type ODataErrorDetail } from './data/errors';

export { MemoryVariantStore, ODataVariantStore, STANDARD_VARIANT_ID, type Variant, type VariantContent, type VariantStore } from './state/variants';
export { MemoryPageStateStore, createSessionPageStateStore, type PageStateStore } from './state/pageState';
export type { NavigationAdapter, NavigationTarget } from './state/navigation';
export { DirectEditStrategy, DraftEditStrategy, editStrategyFor, siblingPath, isDraftRow, type EditSession, type EditStrategy } from './state/edit';

export { formatValue, formatNumber, formatDate, formatDateTime, formatTime, currencyDigits, type FormatOptions } from './format/format';
