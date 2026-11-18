# 公开 API

> 状态：现行 · 2026-11-16。两个包的入口只导出本文列出的名字（AC-Q-03，测试 `packages/react/test/api.test.ts` 比对）。新增或删除导出时，同时修改本文和 `CHANGELOG.md`。

## `@rhfan2019/smart-kit-core`

### 值（运行时导出）

- `activeFilterPaths`
- `arrangeText`
- `buildAggregateRequest`
- `buildHierarchyRequest`
- `buildListRequest`
- `buildModel`
- `buildObjectRequest`
- `buildTotalsRequest`
- `buildValueHelpRequest`
- `calculateCriticality`
- `calculateTrend`
- `canGroup`
- `canSubtotal`
- `canTotal`
- `capabilitiesFor`
- `chartExpand`
- `chartFields`
- `chartIsSeries`
- `chartSeriesSelect`
- `childPathOf`
- `collectTotals`
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
- `groupKey`
- `hierarchyNodeOf`
- `hierarchyOf`
- `highestSeverity`
- `humanize`
- `isAbortError`
- `isComplete`
- `isDraftRow`
- `isFilterable`
- `isRelativeDateOperator`
- `isSortable`
- `keyPredicate`
- `LiteralError`
- `loadService`
- `matches`
- `MAX_GROUP_VALUES`
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
- `parseAnnotationPath`
- `parseEntityPath`
- `propertyFilter`
- `readQueryString`
- `RELATIVE_DATE_OPERATORS`
- `relativeDateRange`
- `resolveCondition`
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
- `todayIn`
- `toFilter`
- `toLiteral`
- `toQueryString`
- `TOTAL_COUNT_ALIAS`
- `unitPathOf`
- `UnknownEntitySetError`
- `valueListTextArrangement`

### 类型

- `ActionModel`
- `AggregateRequestOptions`
- `AggregationModel`
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
- `DrillState`
- `EditSession`
- `EditStrategy`
- `EdmType`
- `EntityPath`
- `EntitySetModel`
- `EntityTypeModel`
- `EntityUi`
- `EventModel`
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
- `HierarchyNode`
- `HierarchyRequest`
- `HierarchyRequestOptions`
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
- `ODataVariantStoreOptions`
- `Operator`
- `PageStateStore`
- `PathSegment`
- `PresentationModel`
- `PresentationVariantModel`
- `PropertyModel`
- `QueryRequest`
- `QueryResult`
- `QuerySource`
- `ReadDataProvider`
- `ReadRequest`
- `RecursiveHierarchyModel`
- `RelativeDateOperator`
- `RequestOptions`
- `ResolvedPath`
- `Row`
- `SectionModel`
- `SortItem`
- `SourceInfo`
- `SubSectionContent`
- `SubSectionModel`
- `TextArrangement`
- `TotalAmount`
- `TotalsEntry`
- `TotalsRequestOptions`
- `TrendCalculationModel`
- `ValueHelpRequestOptions`
- `ValueListModel`
- `ValueListParameter`
- `ValueOperator`
- `ValueRef`
- `Variant`
- `VariantContent`
- `VariantStore`
- `ViewModel`
- `WriteDataProvider`
- `WriteResult`

## UI5 模块（`@rhfan2019/smart-kit/<路径>`，ADR-033）

> 和 SAPUI5 一样，每个类一个模块、默认导出：`import MessageBox from '@rhfan2019/smart-kit/m/MessageBox'`（UI5：`sap/m/MessageBox`）；`sap.fe.*` 多一层 `v4`。枚举从所在库的 `library` 模块具名导出（`import { ValueState } from '@rhfan2019/smart-kit/ui/core/library'`），有自己模块的枚举默认导出（`m/IllustratedMessageType`）。设置类型 `$<类名>Settings`、实例类型就是类名（`useRef<MessageStrip>(null)`）。UI5 没有对应的放 `kit/`。下表由 `node scripts/gen-exports.mjs` 生成；这些模块不再从根入口导出。

<!-- ui5-modules:start -->
| 模块 | 对应的 SAPUI5（`tools/ui5-alignment/mapping.json`） |
| --- | --- |
| `@rhfan2019/smart-kit/base/i18n/date/CalendarWeekNumbering` | module:sap/base/i18n/date/CalendarWeekNumbering |
| `@rhfan2019/smart-kit/f/Card` | sap.f.Card |
| `@rhfan2019/smart-kit/f/cards/Header` | sap.f.cards.Header |
| `@rhfan2019/smart-kit/f/cards/NumericHeader` | sap.f.cards.NumericHeader |
| `@rhfan2019/smart-kit/f/cards/NumericSideIndicator` | sap.f.cards.NumericSideIndicator |
| `@rhfan2019/smart-kit/kit/MessageHost` | 无（React 宿主：承载 MessageToast / MessageBox（UI5 由核心渲染），无对应） |
| `@rhfan2019/smart-kit/kit/MessageIcon` | 无（消息类型图标，UI5 没有单独的控件） |
| `@rhfan2019/smart-kit/kit/MessageProvider` | 无（React 上下文：页面消息模型（UI5 用 sap.ui.core.Messaging），无对应的控件） |
| `@rhfan2019/smart-kit/kit/useMessages` | 无（React hook：页面消息（UI5 用 sap.ui.core.Messaging）） |
| `@rhfan2019/smart-kit/m/AvatarShape` | sap.m.AvatarShape |
| `@rhfan2019/smart-kit/m/AvatarSize` | sap.m.AvatarSize |
| `@rhfan2019/smart-kit/m/BusyDialog` | sap.m.BusyDialog |
| `@rhfan2019/smart-kit/m/BusyIndicator` | sap.m.BusyIndicator |
| `@rhfan2019/smart-kit/m/DynamicDateRange` | sap.m.DynamicDateRange |
| `@rhfan2019/smart-kit/m/ExpandableText` | sap.m.ExpandableText |
| `@rhfan2019/smart-kit/m/FeedInput` | sap.m.FeedInput |
| `@rhfan2019/smart-kit/m/FeedListItem` | sap.m.FeedListItem |
| `@rhfan2019/smart-kit/m/IconTabBar` | sap.m.IconTabBar |
| `@rhfan2019/smart-kit/m/IconTabFilter` | sap.m.IconTabFilter |
| `@rhfan2019/smart-kit/m/IconTabSeparator` | sap.m.IconTabSeparator |
| `@rhfan2019/smart-kit/m/IllustratedMessage` | sap.m.IllustratedMessage |
| `@rhfan2019/smart-kit/m/IllustratedMessageSize` | sap.m.IllustratedMessageSize |
| `@rhfan2019/smart-kit/m/IllustratedMessageType` | sap.m.IllustratedMessageType |
| `@rhfan2019/smart-kit/m/MessageBox` | sap.m.MessageBox |
| `@rhfan2019/smart-kit/m/MessageItem` | sap.m.MessageItem |
| `@rhfan2019/smart-kit/m/MessagePopover` | sap.m.MessagePopover |
| `@rhfan2019/smart-kit/m/MessageStrip` | sap.m.MessageStrip |
| `@rhfan2019/smart-kit/m/MessageToast` | sap.m.MessageToast |
| `@rhfan2019/smart-kit/m/MessageView` | sap.m.MessageView |
| `@rhfan2019/smart-kit/m/ObjectIdentifier` | sap.m.ObjectIdentifier |
| `@rhfan2019/smart-kit/m/ObjectMarker` | sap.m.ObjectMarker |
| `@rhfan2019/smart-kit/m/ObjectNumber` | sap.m.ObjectNumber |
| `@rhfan2019/smart-kit/m/ObjectStatus` | sap.m.ObjectStatus |
| `@rhfan2019/smart-kit/m/OverflowToolbar` | sap.m.OverflowToolbar |
| `@rhfan2019/smart-kit/m/OverflowToolbarButton` | sap.m.OverflowToolbarButton |
| `@rhfan2019/smart-kit/m/SelectDialog` | sap.m.SelectDialog |
| `@rhfan2019/smart-kit/m/TableSelectDialog` | sap.m.TableSelectDialog |
| `@rhfan2019/smart-kit/m/ToggleButton` | sap.m.ToggleButton |
| `@rhfan2019/smart-kit/m/ToolbarSpacer` | sap.m.ToolbarSpacer |
| `@rhfan2019/smart-kit/m/ViewSettingsDialog` | sap.m.ViewSettingsDialog |
| `@rhfan2019/smart-kit/m/Wizard` | sap.m.Wizard |
| `@rhfan2019/smart-kit/m/WizardStep` | sap.m.WizardStep |
| `@rhfan2019/smart-kit/m/library` | sap.m.BackgroundDesign → `BackgroundDesign`；sap.m.BadgeStyle → `BadgeStyle`；sap.m.ButtonAccessibleRole → `ButtonAccessibleRole`；sap.m.ButtonType → `ButtonType`；sap.m.EmptyIndicatorMode → `EmptyIndicatorMode`；sap.m.ExpandableTextOverflowMode → `ExpandableTextOverflowMode`；sap.m.IconTabDensityMode → `IconTabDensityMode`；sap.m.IconTabFilterDesign → `IconTabFilterDesign`；sap.m.IconTabFilterInteractionMode → `IconTabFilterInteractionMode`；sap.m.IconTabHeaderMode → `IconTabHeaderMode`；sap.m.LinkConversion → `LinkConversion`；sap.m.ListType → `ListType`；sap.m.ObjectMarkerType → `ObjectMarkerType`；sap.m.ObjectMarkerVisibility → `ObjectMarkerVisibility`；sap.m.ObjectNumberDisplayMode → `ObjectNumberDisplayMode`；sap.m.OverflowToolbarPriority → `OverflowToolbarPriority`；sap.m.PageBackgroundDesign → `PageBackgroundDesign`；sap.m.ReactiveAreaMode → `ReactiveAreaMode`；sap.m.SelectDialogInitialFocus → `SelectDialogInitialFocus`；sap.m.StandardDynamicDateRangeKeys → `StandardDynamicDateRangeKeys`；sap.m.StringFilterOperator → `StringFilterOperator`；sap.m.TabsOverflowMode → `TabsOverflowMode`；sap.m.TitleAlignment → `TitleAlignment`；sap.m.ToolbarDesign → `ToolbarDesign`；sap.m.ToolbarStyle → `ToolbarStyle`；sap.m.UploadSetwithTableActionPlaceHolder → `UploadSetwithTableActionPlaceHolder`；sap.m.UploadState → `UploadState`；sap.m.VerticalPlacementType → `VerticalPlacementType`；sap.m.WizardRenderMode → `WizardRenderMode`；sap.m.WrappingType → `WrappingType` |
| `@rhfan2019/smart-kit/m/plugins/UploadSetwithTable` | sap.m.plugins.UploadSetwithTable |
| `@rhfan2019/smart-kit/m/upload/ActionsPlaceholder` | sap.m.upload.ActionsPlaceholder |
| `@rhfan2019/smart-kit/m/upload/UploaderHttpRequestMethod` | sap.m.upload.UploaderHttpRequestMethod |
| `@rhfan2019/smart-kit/m/upload/UploaderTableItem` | sap.m.upload.UploaderTableItem |
| `@rhfan2019/smart-kit/suite/ui/commons/MicroProcessFlow` | sap.suite.ui.commons.MicroProcessFlow |
| `@rhfan2019/smart-kit/suite/ui/commons/MicroProcessFlowItem` | sap.suite.ui.commons.MicroProcessFlowItem |
| `@rhfan2019/smart-kit/suite/ui/commons/ProcessFlow` | sap.suite.ui.commons.ProcessFlow |
| `@rhfan2019/smart-kit/suite/ui/commons/Timeline` | sap.suite.ui.commons.Timeline |
| `@rhfan2019/smart-kit/suite/ui/commons/TimelineItem` | sap.suite.ui.commons.TimelineItem |
| `@rhfan2019/smart-kit/suite/ui/commons/library` | sap.suite.ui.commons.MicroProcessFlowRenderType → `MicroProcessFlowRenderType`；sap.suite.ui.commons.ProcessFlowConnectionLabelState → `ProcessFlowConnectionLabelState`；sap.suite.ui.commons.ProcessFlowNodeState → `ProcessFlowNodeState`；sap.suite.ui.commons.ProcessFlowNodeType → `ProcessFlowNodeType`；sap.suite.ui.commons.ProcessFlowZoomLevel → `ProcessFlowZoomLevel`；sap.suite.ui.commons.TimelineAlignment → `TimelineAlignment`；sap.suite.ui.commons.TimelineAxisOrientation → `TimelineAxisOrientation`；sap.suite.ui.commons.TimelineFilterType → `TimelineFilterType`；sap.suite.ui.commons.TimelineGroupType → `TimelineGroupType` |
| `@rhfan2019/smart-kit/ui/core/library` | sap.ui.core.IconColor → `IconColor`；sap.ui.core.IndicationColor → `IndicationColor`；sap.ui.core.TitleLevel → `TitleLevel`；sap.ui.core.ValueState → `ValueState` |
| `@rhfan2019/smart-kit/ui/core/message/MessageType` | module:sap/ui/core/message/MessageType |
| `@rhfan2019/smart-kit/ui/integration/cards/AnalyticalContent` | manifest sap.card/Analytical |
| `@rhfan2019/smart-kit/ui/integration/cards/CalendarContent` | manifest sap.card/Calendar |
| `@rhfan2019/smart-kit/ui/integration/cards/ListContent` | manifest sap.card/List |
| `@rhfan2019/smart-kit/ui/integration/cards/ObjectContent` | manifest sap.card/Object |
| `@rhfan2019/smart-kit/ui/integration/cards/TableContent` | manifest sap.card/Table |
| `@rhfan2019/smart-kit/ui/integration/cards/TimelineContent` | manifest sap.card/Timeline |
| `@rhfan2019/smart-kit/ui/unified/Currency` | sap.ui.unified.Currency |
| `@rhfan2019/smart-kit/v4/fe/macros/MessageButton` | sap.fe.macros.MessageButton |
<!-- ui5-modules:end -->

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
- `DEFAULT_STANDARD_OPTIONS`
- `DraftMarker`
- `draftState`
- `dynamicDateValueTypes`
- `DynamicPage`
- `fclArrows`
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
- `MESSAGES`
- `messageTypeOf`
- `MICRO_COMPARISON_MAX`
- `MicroChart`
- `MissingProviderError`
- `niceTicks`
- `ObjectPageLayout`
- `OverflowActions`
- `parseConditionText`
- `QuickViewLink`
- `readToken`
- `relativeDateText`
- `resolveRef`
- `ResponsiveTable`
- `RESTRICTED_FILE_NAME_CHARACTERS`
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
- `toDates`
- `typedText`
- `useActionRunner`
- `useColumn`
- `useDynamicPage`
- `useEditStrategy`
- `useFilterBarContext`
- `useFilterState`
- `useListQuery`
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
- `viewSettingsFilterString`

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
- `BusyDialog`
- `ChartDatum`
- `ChartViewProps`
- `ColumnContextValue`
- `ColumnItem`
- `ConditionInputProps`
- `ConditionTextOptions`
- `CreateDialogProps`
- `DateLike`
- `DraftState`
- `DynamicDateRange`
- `DynamicPageProps`
- `EntitySetHandle`
- `ExportEvent`
- `ExtendEntry`
- `ExtendPosition`
- `FclArrow`
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
- `MessagePopover`
- `Messages`
- `MessageStrip`
- `MessageView`
- `MicroChartAreaThresholds`
- `MicroChartCriticality`
- `MicroChartKind`
- `MicroChartPoint`
- `MicroChartProps`
- `MicroChartThreshold`
- `ObjectPageLayoutProps`
- `ObjectResult`
- `OverflowActionsProps`
- `OverflowToolbar`
- `PreventableEvent`
- `ProcessFlow`
- `RendererRegistry`
- `ResponsiveColumn`
- `ResponsiveTableProps`
- `SectionItem`
- `SelectDialog`
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
- `SmartTableRef`
- `SmartVariantManagementProps`
- `SubSectionItem`
- `TableContextValue`
- `TableExtendEntry`
- `TableP13nDialogProps`
- `TableQuery`
- `TableSelectDialog`
- `TableType`
- `TextFn`
- `TextParams`
- `Timeline`
- `ToggleOpenStateEvent`
- `ToolbarAction`
- `TypedKey`
- `UploadSetwithTable`
- `UseFilterStateOptions`
- `UseObjectOptions`
- `UseVariantsOptions`
- `ValueContext`
- `ValueHelpDialogProps`
- `VariantsApi`
- `ViewSettingsDialog`
- `Wizard`

## `@rhfan2019/smart-kit-server`

> ADR-027，只在 Node 里用（`npm run size` 检查它的代码进不了浏览器包）。OData V4 服务：读（URL → 语法树 → 查询计划 → SQL，PostgreSQL）、直接保存（PATCH + ETag、POST、DELETE）、绑定动作；没有草稿。用法见 `apps/pg-server/server.ts` 和 README"在 PostgreSQL 上手工测试"。测试 `packages/server/test/api.test.ts` 比对本节。

### 值（运行时导出）

- `applyLabels`
- `boundActions`
- `buildSchema`
- `createODataService`
- `createKysely`
- `createPostgresDb`
- `errorBody`
- `escapeLike`
- `mergeMetadata`
- `MetadataDocuments`
- `ODataServerError`
- `parseFilter`
- `parseQueryOptions`
- `parseResourcePath`
- `parseSearch`
- `Planner`
- `SqlBuilder`
- `toNodeListener`
- `validationError`

### 类型

- `ActionHandler`
- `AggregatePlan`
- `BoundExpr`
- `CollectionPlan`
- `ColumnInfo`
- `EntitySetHooks`
- `EntitySetInfo`
- `KyselyOnPoolOptions`
- `Expr`
- `Literal`
- `MetadataSource`
- `NavigationInfo`
- `ODataService`
- `ODataServiceOptions`
- `PostgresDbOptions`
- `QueryOptions`
- `Row`
- `ScopeFunction`
- `SearchExpr`
- `ServiceMessage`
- `ServiceSchema`
- `StorageMapping`
- `WriteContext`

`createODataService(options)` 的选项：`basePath`（服务根路径）、`metadata`（生成的 CSDL、手写的注解文件、各语言的标签包）、`storage`（实体集对应的表和列，CLI 生成）、`db`（Kysely）、`maxPageSize`（默认 1000）、`searchFields`（各实体集 `$search` 查哪些字段）、`context`（每个请求的上下文，比如当前用户）、`scope`（数据范围：每个实体集返回一个 `$filter` 条件，条件里可以对集合导航用 `any` / `all`，所有读到这个实体集的地方都加上，写也只能写范围内的行）、`entitySets`（允许写的实体集和它们的业务规则：`creatable`、`updatable` 字段清单，`beforeCreate` / `afterCreate` / `beforeUpdate` / `afterUpdate` / `beforeDelete` / `afterDelete` 钩子；没列出的实体集只读）、`actions`（绑定动作的实现，按全名，例如 `Purchasing.approve`；动作要在注解文件里声明）、`afterRead`（返回前改写每一行，例如按语言替换代码表文字）、`readOnly`、`onError`。钩子拿到本次请求的事务（`db`）、语言、`messages`（写进 `sap-messages` 头），出错时抛 `validationError(message, details)`（400，带字段目标）。返回 `{ handle(request): Promise<Response>, schema, model, metadata(lang) }`。

## `@rhfan2019/smart-kit-cli`

> ADR-027，开发时用的命令 `smart-kit`：`smart-kit generate`（读 PostgreSQL 的表结构，写生成的 CSDL 和存储映射，再检查注解文件）、`smart-kit check`（不连数据库，只检查注解文件）、`smart-kit agents`（在使用方项目的 `AGENTS.md` 里写入指向包内文档的一段索引，并让 `CLAUDE.md` 引用 `AGENTS.md`，ADR-030）；加 `--strict` 时注解有失效的目标就以退出码 1 结束。配置文件 `smart-kit.config.json` 的写法见 `apps/pg-server/smart-kit.config.json` 和 `packages/cli/src/config.ts`。测试 `packages/server/test/api.test.ts` 比对本节。

### 值（运行时导出）

- `agents`
- `agentsBlock`
- `check`
- `checkAnnotations`
- `checkDeclaredNavigations`
- `generate`
- `indexCsdl`
- `introspect`
- `loadConfig`
- `pascal`
- `plural`
- `toCsdl`
- `toStorage`

### 类型

- `AgentsResult`
- `CheckProblem`
- `CliConfig`
- `CsdlIndex`
- `DeclaredNavigationConfig`
- `EntityConfig`
- `GenEntity`
- `GenerateResult`
- `GenModel`
- `GenNavigation`
- `GenProperty`
- `LoadedConfig`
- `NavigationConfig`
- `Queryable`
- `StorageFile`
