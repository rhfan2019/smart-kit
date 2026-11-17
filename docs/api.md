# 公开 API

> 状态：现行 · 2026-11-16。两个包的入口只导出本文列出的名字（AC-Q-03，测试 `packages/react/test/api.test.ts` 比对）。新增或删除导出时，同时修改本文和 `CHANGELOG.md`。

## `@rhfan2019/smart-kit-core`

### 值（运行时导出）

- `activeFilterPaths`
- `buildAggregateRequest`
- `buildListRequest`
- `buildModel`
- `buildObjectRequest`
- `buildValueHelpRequest`
- `calculateCriticality`
- `capabilitiesFor`
- `chartExpand`
- `chartFields`
- `chartIsSeries`
- `chartSeriesSelect`
- `childPathOf`
- `companionPaths`
- `compareDecimal`
- `compareValues`
- `ConcurrencyError`
- `conditionAllowed`
- `createMessage`
- `createSessionPageStateStore`
- `csdlJsonToXml`
- `currencyDigits`
- `dataPointPaths`
- `DEFAULT_CAPABILITIES`
- `deriveColumns`
- `DERIVED_GENERAL_SECTION`
- `DirectEditStrategy`
- `DraftEditStrategy`
- `editStrategyFor`
- `encodeOption`
- `EntityPathError`
- `entityPathOf`
- `errorFromResponse`
- `fieldPaths`
- `filterExpressionRules`
- `filterString`
- `formatDate`
- `formatDateTime`
- `formatNumber`
- `formatTime`
- `formatValue`
- `getEntitySet`
- `getEntityType`
- `getProperty`
- `getUi`
- `highestSeverity`
- `humanize`
- `isAbortError`
- `isComplete`
- `isDraftRow`
- `isFilterable`
- `isSortable`
- `keyPredicate`
- `LiteralError`
- `loadService`
- `matches`
- `MemoryPageStateStore`
- `MemoryProvider`
- `MemoryVariantStore`
- `messagesFromError`
- `messagesFromHeader`
- `MICRO_CHART_MAX_POINTS`
- `MICRO_COMPARISON_MAX_BARS`
- `MODEL_VERSION`
- `ModelError`
- `objectFields`
- `ODataError`
- `ODataV4Provider`
- `ODataVariantStore`
- `OPERATOR_ARITY`
- `OPERATORS`
- `parseEntityPath`
- `propertyFilter`
- `readQueryString`
- `resolveEntityPath`
- `resolvePath`
- `restrictConditions`
- `selectAndExpand`
- `siblingPath`
- `sourceInfo`
- `sourcePath`
- `STANDARD_VARIANT_ID`
- `startOfDayIso`
- `targetEntitySet`
- `toCsdlXml`
- `toFilter`
- `toLiteral`
- `toQueryString`
- `UnknownEntitySetError`

### 类型

- `ActionModel`
- `AggregateRequestOptions`
- `BuildModelOptions`
- `CapabilityModel`
- `ChartModel`
- `ColumnModel`
- `Condition`
- `Criticality`
- `CriticalityCalculationModel`
- `CsdlSource`
- `DataPointModel`
- `DataProvider`
- `DraftModel`
- `EditSession`
- `EditStrategy`
- `EdmType`
- `EntityPath`
- `EntitySetModel`
- `EntityTypeModel`
- `EntityUi`
- `ExpandSpec`
- `FetchLike`
- `FieldModel`
- `FilterExpression`
- `FilterExpressionRules`
- `FilterOptions`
- `FilterState`
- `FormatOptions`
- `FormGroupModel`
- `HeaderFacetModel`
- `HeaderInfoModel`
- `Importance`
- `ImprovementDirection`
- `InitialCondition`
- `ListRequestOptions`
- `LoadServiceOptions`
- `MemoryProviderOptions`
- `Message`
- `MessageType`
- `MetaModel`
- `ModelWarning`
- `NavigationAdapter`
- `NavigationModel`
- `NavigationTarget`
- `ODataErrorDetail`
- `ODataV4ProviderOptions`
- `Operator`
- `PageStateStore`
- `PathSegment`
- `PresentationModel`
- `PropertyModel`
- `QueryRequest`
- `QueryResult`
- `QuerySource`
- `ReadDataProvider`
- `ReadRequest`
- `RequestOptions`
- `ResolvedPath`
- `Row`
- `SectionModel`
- `SortItem`
- `SourceInfo`
- `SubSectionContent`
- `SubSectionModel`
- `TextArrangement`
- `ValueHelpRequestOptions`
- `ValueListModel`
- `ValueListParameter`
- `ValueRef`
- `Variant`
- `VariantContent`
- `VariantStore`
- `ViewModel`
- `WriteDataProvider`
- `WriteResult`

## 子路径入口（`@rhfan2019/smart-kit`）

> ADR-026。根入口 `@rhfan2019/smart-kit` 导出下面列出的全部名字；也可以从子路径只引入一个领域，名字相同。按需引入是否生效由 `npm run size` 检查（例如只用 `MicroChart` 的应用不超过 8 KB gzip）。测试 `packages/react/test/api.test.ts` 检查各子路径合起来正好等于根入口、每个名字只出现一次。

| 子路径 | 主要内容 | 需要 AG Grid |
| --- | --- | --- |
| `/context` | `SmartKitProvider`、`useSmartKit`、`useService`、`useMetaModel`、`useText` | 否 |
| `/i18n` | `createText`、`MESSAGES` | 否 |
| `/theme` | `smartKitMantineTheme`、`smartKitCssVariablesResolver`、`readToken`、`useThemeTokens` | 否 |
| `/util` | `applyExtensions`、`usePageState` | 否 |
| `/field` | `SmartField`、`FieldEditor`、`CriticalityIcon`、`QuickViewLink` | 否 |
| `/filter` | `SmartFilterBar`、`ConditionInput`、`ValueHelpDialog`、`AdaptFiltersDialog`、`FilterSummary` | 否 |
| `/variants` | `SmartVariantManagement`、`useVariants` | 否 |
| `/table` | `SmartTable`、`ResponsiveTable`、`TableP13nDialog`、`useListQuery`、`smartKitGridTheme` | 是 |
| `/chart` | `MicroChart`、`SimpleChart`、`ChartView` | 否 |
| `/object` | `ObjectPageLayout`、`HeaderFacet`、`AnchorBar`、`SmartForm`、`DraftMarker`、`GenericTag`、`useObject` | 否 |
| `/page` | `DynamicPage`、`FlexibleColumnLayout`、`OverflowActions`、`ShareMenu` | 否 |
| `/actions` | `useActionRunner`、`isActionAvailable` | 否 |
| `/edit` | `CreateDialog`、`useEditStrategy`、`validate` | 否 |
| `/messages` | `MessageProvider`、`MessageButton`、`MessageIcon`、`useMessages` | 否 |
| `/templates` | `SmartListReport`、`SmartObjectPage` | 是 |
| `/styles.css` | 样式（所有组件共用一个文件） | — |

AG Grid（`ag-grid-community`、`ag-grid-react`）是可选的 peer 依赖：不用表格时可以不装，但这时要从不需要 AG Grid 的子路径引入；从根入口引入时，打包工具仍会去解析 AG Grid。

## `@rhfan2019/smart-kit`

### 值（运行时导出）

- `actionPaths`
- `AdaptFiltersDialog`
- `AnchorBar`
- `applyExtensions`
- `ChartView`
- `ColumnContext`
- `ConditionInput`
- `conditionText`
- `CreateDialog`
- `createFields`
- `createText`
- `createWith`
- `CriticalityIcon`
- `DraftMarker`
- `draftState`
- `DynamicPage`
- `FieldEditor`
- `fieldErrors`
- `fieldValue`
- `FilterSummary`
- `filterSummaryText`
- `FlexibleColumnLayout`
- `GenericTag`
- `getPath`
- `HeaderFacet`
- `hiddenByImportance`
- `INTL_LOCALE`
- `isActionAvailable`
- `isEditable`
- `linkify`
- `MessageButton`
- `MessageIcon`
- `MessageProvider`
- `MESSAGES`
- `MICRO_COMPARISON_MAX`
- `MicroChart`
- `MissingProviderError`
- `niceTicks`
- `ObjectPageLayout`
- `OverflowActions`
- `parseConditionText`
- `QuickViewLink`
- `readToken`
- `resolveRef`
- `ResponsiveTable`
- `ShareMenu`
- `SimpleChart`
- `SmartField`
- `SmartFilterBar`
- `SmartForm`
- `smartKitCssVariablesResolver`
- `smartKitGridTheme`
- `smartKitMantineTheme`
- `SmartKitProvider`
- `SmartListReport`
- `SmartObjectPage`
- `SmartTable`
- `SmartVariantManagement`
- `TableP13nDialog`
- `useActionRunner`
- `useColumn`
- `useDynamicPage`
- `useEditStrategy`
- `useFilterBarContext`
- `useFilterState`
- `useListQuery`
- `useMessages`
- `useMetaModel`
- `useObject`
- `useObjectTitle`
- `usePageState`
- `useSectionScrollSpy`
- `useService`
- `useSmartKit`
- `useTableContext`
- `useText`
- `useThemeTokens`
- `useValueList`
- `useVariants`
- `validate`
- `ValueHelpDialog`

### 类型

- `ActionGroup`
- `ActionItem`
- `ActionResult`
- `ActionRunner`
- `ActionTarget`
- `AdaptFiltersDialogProps`
- `AnchorBarProps`
- `AnchorItem`
- `AppliedFilter`
- `BlockItem`
- `ChartDatum`
- `ChartViewProps`
- `ColumnContextValue`
- `ColumnItem`
- `ConditionInputProps`
- `CreateDialogProps`
- `DraftState`
- `DynamicPageProps`
- `EntitySetHandle`
- `ExtendEntry`
- `ExtendPosition`
- `FclLayout`
- `FclPaging`
- `FieldEditorProps`
- `FieldRenderer`
- `FieldRenderProps`
- `FieldValue`
- `FilterFieldItem`
- `FilterSnapshot`
- `FilterStateApi`
- `FilterSummaryProps`
- `FlexibleColumnLayoutProps`
- `FormFieldItem`
- `GenericTagProps`
- `HeaderFacetProps`
- `ListContentItem`
- `ListQueryOptions`
- `ListQueryResult`
- `Locale`
- `MessageKey`
- `Messages`
- `MessagesApi`
- `MicroChartAreaThresholds`
- `MicroChartCriticality`
- `MicroChartKind`
- `MicroChartPoint`
- `MicroChartProps`
- `MicroChartThreshold`
- `ObjectPageLayoutProps`
- `ObjectResult`
- `OverflowActionsProps`
- `RendererRegistry`
- `ResponsiveColumn`
- `ResponsiveTableProps`
- `SectionItem`
- `ServiceConfig`
- `ServiceHandle`
- `ShareMenuProps`
- `SimpleChartProps`
- `SmartFieldProps`
- `SmartFilterBarProps`
- `SmartFormProps`
- `SmartKitContextValue`
- `SmartKitProviderProps`
- `SmartListReportProps`
- `SmartObjectPageProps`
- `SmartTableProps`
- `SmartVariantManagementProps`
- `SubSectionItem`
- `TableContextValue`
- `TableExtendEntry`
- `TableP13nDialogProps`
- `TableQuery`
- `TextFn`
- `TextParams`
- `ToolbarAction`
- `UseFilterStateOptions`
- `UseObjectOptions`
- `UseVariantsOptions`
- `ValueContext`
- `ValueHelpDialogProps`
- `VariantsApi`
