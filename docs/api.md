# 公开 API

> 状态：现行 · 2026-11-16。两个包的入口只导出本文列出的名字（AC-Q-03，测试 `packages/react/test/api.test.ts` 比对）。新增或删除导出时，同时修改本文和 `CHANGELOG.md`。

## `@rhfan2019/smart-kit-core`

### 值（运行时导出）

- `DRAFT_EDIT_STATES`
- `EDIT_STATE`
- `editStateFilter`
- `editStateOf`
- `matchesEditState`
- `hiddenFilterPath`
- `hiddenFiltersOf`
- `withHiddenFilters`
- `activeFilterPaths`
- `aggregateMeasure`
- `arrangeText`
- `ANALYTICAL_COUNT_ALIAS`
- `buildAggregateRequest`
- `buildAnalyticalRequests`
- `buildChartRequest`
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
- `formatDateTimeWithTimezone`
- `formatNumber`
- `formatTime`
- `formatTimezone`
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
- `isCustomAggregate`
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
- `ALLOWED_EXPRESSIONS_PRIORITY`
- `COUNT_DATE_OPERATORS`
- `FIXED_DAY_OPERATORS`
- `MDC_DATE_OPERATORS`
- `relativeDateValueTypes`
- `setDefaultWeekStart`
- `strictestExpression`
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
- `readValueListService`
- `referencedValueLists`
- `resolveValueListReference`
- `serviceRootOf`
- `actionParameterBody`
- `actionParameterDefaults`
- `actionParameterErrors`
- `actionParameterState`
- `skipsParameterDialog`

### 类型

- `ActionModel`
- `ActionParameterModel`
- `ActionParameterState`
- `AggregateMeasure`
- `AggregateRequestOptions`
- `AggregationModel`
- `DraftEditState`
- `BuildModelOptions`
- `CapabilityModel`
- `ChartModel`
- `ChartRequestOptions`
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
- `SemanticTarget`
- `SemanticTargetRequest`
- `SortItem`
- `SourceInfo`
- `SubSectionContent`
- `SubSectionModel`
- `TextArrangement`
- `TotalAmount`
- `TotalsEntry`
- `TotalsRequestOptions`
- `AnalyticalRequestOptions`
- `AnalyticalRequests`
- `AnalyticalApply`
- `TrendCalculationModel`
- `ValueHelpRequestOptions`
- `ValueListModel`
- `ValueListService`
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
| `@rhfan2019/smart-kit/f/DynamicPage` | sap.f.DynamicPage |
| `@rhfan2019/smart-kit/f/DynamicPageAccessibleLandmarkInfo` | sap.f.DynamicPageAccessibleLandmarkInfo |
| `@rhfan2019/smart-kit/f/DynamicPageHeader` | sap.f.DynamicPageHeader |
| `@rhfan2019/smart-kit/f/DynamicPageTitle` | sap.f.DynamicPageTitle |
| `@rhfan2019/smart-kit/f/FlexibleColumnLayout` | sap.f.FlexibleColumnLayout |
| `@rhfan2019/smart-kit/f/FlexibleColumnLayoutAccessibleLandmarkInfo` | sap.f.FlexibleColumnLayoutAccessibleLandmarkInfo |
| `@rhfan2019/smart-kit/f/cards/Header` | sap.f.cards.Header |
| `@rhfan2019/smart-kit/f/cards/NumericHeader` | sap.f.cards.NumericHeader |
| `@rhfan2019/smart-kit/f/cards/NumericSideIndicator` | sap.f.cards.NumericSideIndicator |
| `@rhfan2019/smart-kit/f/library` | sap.f.LayoutType → `LayoutType`；sap.f.DynamicPageTitleShrinkRatio → `DynamicPageTitleShrinkRatio` |
| `@rhfan2019/smart-kit/kit/AdaptFiltersDialog` | 无（FE 用 sap.ui.mdc 的 p13n 内部对话框，无公开类） |
| `@rhfan2019/smart-kit/kit/ColumnContext` | 无（React 上下文：弹性分栏的当前列，无 UI5 对应） |
| `@rhfan2019/smart-kit/kit/ConditionInput` | 无（FE 用 sap.ui.mdc 的 FilterField 内部实现，sap.fe.macros 没有公开类） |
| `@rhfan2019/smart-kit/kit/CreateDialog` | 无（FE 的新建对话框由 EditFlow 内部生成，无公开类） |
| `@rhfan2019/smart-kit/kit/CriticalityIcon` | 无（FE 在字段内部按 Criticality 画图标（sap.fe.macros 内部），无公开类） |
| `@rhfan2019/smart-kit/kit/DraftIndicator` | 无（草稿标记加弹出框（谁、何时改的）：FE 里是 sap.fe.macros 的内部组件（draftIndicator），没有公开类；公开的标记控件是 m/ObjectMarker） |
| `@rhfan2019/smart-kit/kit/FieldEditor` | 无（FE 的编辑控件由 Field 内部按类型选（sap.fe.macros 内部），无公开类） |
| `@rhfan2019/smart-kit/kit/FilterSummary` | 无（FE 列表页折叠页头里的筛选摘要是模板内部实现，无公开类） |
| `@rhfan2019/smart-kit/kit/HeaderFacet` | 无（FE 对象页页头 Facet 由模板内部生成（templates/ObjectPage），无公开类） |
| `@rhfan2019/smart-kit/kit/MessageHost` | 无（React 宿主：承载 MessageToast / MessageBox（UI5 由核心渲染），无对应） |
| `@rhfan2019/smart-kit/kit/MessageIcon` | 无（消息类型图标，UI5 没有单独的控件） |
| `@rhfan2019/smart-kit/kit/MessageProvider` | 无（React 上下文：页面消息模型（UI5 用 sap.ui.core.Messaging），无对应的控件） |
| `@rhfan2019/smart-kit/kit/QuickViewLink` | 无（FE 在字段里内部生成的快速预览链接，无公开类；FE 字段里的快速预览链接，基于 m/QuickView） |
| `@rhfan2019/smart-kit/kit/SimpleChart` | 无（smart-kit 自己的 SVG 图表（ADR-021）；FE 用 sap.viz / sap.chart，无可对齐的公开类） |
| `@rhfan2019/smart-kit/kit/ValueHelpDialog` | 无（FE 的值帮助是 sap.ui.mdc.ValueHelp 的内部组合（macros/internal/valuehelp），无公开类） |
| `@rhfan2019/smart-kit/kit/smartKitGridTheme` | 无（AG Grid 的主题，UI5 没有对应；单独一个模块，/theme 不需要 AG Grid） |
| `@rhfan2019/smart-kit/kit/useActionRunner` | 无（React hook：执行动作（UI5 由 EditFlow 控制器扩展承担）） |
| `@rhfan2019/smart-kit/kit/useColumn` | 无（React hook：弹性分栏的当前列，无 UI5 对应） |
| `@rhfan2019/smart-kit/kit/useDynamicPage` | 无（React hook：动态页状态，无 UI5 对应） |
| `@rhfan2019/smart-kit/kit/useEditStrategy` | 无（React hook：编辑策略（UI5 由 EditFlow 承担）） |
| `@rhfan2019/smart-kit/kit/useFilterBarContext` | 无（React hook：筛选栏上下文，无 UI5 对应） |
| `@rhfan2019/smart-kit/kit/useFilterState` | 无（React hook：筛选条件状态（UI5 由 FilterBar 和 ConditionModel 承担）） |
| `@rhfan2019/smart-kit/kit/useListQuery` | 无（React hook：列表请求（UI5 由 ODataListBinding 承担）） |
| `@rhfan2019/smart-kit/kit/useMessages` | 无（React hook：页面消息（UI5 用 sap.ui.core.Messaging）） |
| `@rhfan2019/smart-kit/kit/useObject` | 无（React hook：读一个对象（UI5 由 ODataContextBinding 承担）） |
| `@rhfan2019/smart-kit/kit/useObjectTitle` | 无（React hook：对象标题，无 UI5 对应） |
| `@rhfan2019/smart-kit/kit/useSectionScrollSpy` | 无（React hook：区块滚动定位（ObjectPageLayout 内部），无 UI5 对应） |
| `@rhfan2019/smart-kit/kit/useTableContext` | 无（React hook：表格上下文，无 UI5 对应） |
| `@rhfan2019/smart-kit/kit/useValueList` | 无（React hook：读取 ValueList 注解，无 UI5 对应） |
| `@rhfan2019/smart-kit/kit/useVariants` | 无（React hook：变体存取（UI5 由 flex 变体服务承担）） |
| `@rhfan2019/smart-kit/m/AvatarShape` | sap.m.AvatarShape |
| `@rhfan2019/smart-kit/m/AvatarSize` | sap.m.AvatarSize |
| `@rhfan2019/smart-kit/m/BusyDialog` | sap.m.BusyDialog |
| `@rhfan2019/smart-kit/m/BusyIndicator` | sap.m.BusyIndicator |
| `@rhfan2019/smart-kit/m/DynamicDateRange` | sap.m.DynamicDateRange |
| `@rhfan2019/smart-kit/m/ExpandableText` | sap.m.ExpandableText |
| `@rhfan2019/smart-kit/m/FeedInput` | sap.m.FeedInput |
| `@rhfan2019/smart-kit/m/FeedListItem` | sap.m.FeedListItem |
| `@rhfan2019/smart-kit/m/GenericTag` | sap.m.GenericTag |
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
| `@rhfan2019/smart-kit/m/QuickView` | sap.m.QuickView |
| `@rhfan2019/smart-kit/m/QuickViewGroup` | sap.m.QuickViewGroup |
| `@rhfan2019/smart-kit/m/QuickViewGroupElement` | sap.m.QuickViewGroupElement |
| `@rhfan2019/smart-kit/m/QuickViewPage` | sap.m.QuickViewPage |
| `@rhfan2019/smart-kit/m/SelectDialog` | sap.m.SelectDialog |
| `@rhfan2019/smart-kit/m/Table` | sap.m.Table |
| `@rhfan2019/smart-kit/m/TableSelectDialog` | sap.m.TableSelectDialog |
| `@rhfan2019/smart-kit/m/ToggleButton` | sap.m.ToggleButton |
| `@rhfan2019/smart-kit/m/ToolbarSpacer` | sap.m.ToolbarSpacer |
| `@rhfan2019/smart-kit/m/ViewSettingsDialog` | sap.m.ViewSettingsDialog |
| `@rhfan2019/smart-kit/m/Wizard` | sap.m.Wizard |
| `@rhfan2019/smart-kit/m/WizardStep` | sap.m.WizardStep |
| `@rhfan2019/smart-kit/m/library` | sap.m.BackgroundDesign → `BackgroundDesign`；sap.m.BadgeStyle → `BadgeStyle`；sap.m.ButtonAccessibleRole → `ButtonAccessibleRole`；sap.m.ButtonType → `ButtonType`；sap.m.EmptyIndicatorMode → `EmptyIndicatorMode`；sap.m.ExpandableTextOverflowMode → `ExpandableTextOverflowMode`；sap.m.IconTabDensityMode → `IconTabDensityMode`；sap.m.IconTabFilterDesign → `IconTabFilterDesign`；sap.m.IconTabFilterInteractionMode → `IconTabFilterInteractionMode`；sap.m.IconTabHeaderMode → `IconTabHeaderMode`；sap.m.LinkConversion → `LinkConversion`；sap.m.ListType → `ListType`；sap.m.ObjectMarkerType → `ObjectMarkerType`；sap.m.ObjectMarkerVisibility → `ObjectMarkerVisibility`；sap.m.ObjectNumberDisplayMode → `ObjectNumberDisplayMode`；sap.m.OverflowToolbarPriority → `OverflowToolbarPriority`；sap.m.PageBackgroundDesign → `PageBackgroundDesign`；sap.m.ReactiveAreaMode → `ReactiveAreaMode`；sap.m.SelectDialogInitialFocus → `SelectDialogInitialFocus`；sap.m.StandardDynamicDateRangeKeys → `StandardDynamicDateRangeKeys`；sap.m.StringFilterOperator → `StringFilterOperator`；sap.m.TabsOverflowMode → `TabsOverflowMode`；sap.m.TitleAlignment → `TitleAlignment`；sap.m.ToolbarDesign → `ToolbarDesign`；sap.m.ToolbarStyle → `ToolbarStyle`；sap.m.UploadSetwithTableActionPlaceHolder → `UploadSetwithTableActionPlaceHolder`；sap.m.UploadState → `UploadState`；sap.m.VerticalPlacementType → `VerticalPlacementType`；sap.m.WizardRenderMode → `WizardRenderMode`；sap.m.WrappingType → `WrappingType`；sap.m.ListMode → `ListMode`；sap.m.Size → `Size`；sap.m.ValueColor → `ValueColor`；sap.m.P13nPopupMode → `P13nPopupMode`；sap.m.PlacementType → `PlacementType`；sap.m.QuickViewGroupElementType → `QuickViewGroupElementType`；sap.m.ListKeyboardMode → `ListKeyboardMode`；sap.m.ListGrowingDirection → `ListGrowingDirection`；sap.m.SwipeDirection → `SwipeDirection`；sap.m.ListItemActionType → `ListItemActionType`；sap.m.PopinLayout → `PopinLayout`；sap.m.Sticky → `Sticky`；sap.m.MultiSelectMode → `MultiSelectMode`；sap.m.ListSeparators → `ListSeparators`；sap.m.GenericTagDesign → `GenericTagDesign`；sap.m.GenericTagValueState → `GenericTagValueState` |
| `@rhfan2019/smart-kit/m/p13n/GroupPanel` | sap.m.p13n.GroupPanel |
| `@rhfan2019/smart-kit/m/p13n/Popup` | sap.m.p13n.Popup |
| `@rhfan2019/smart-kit/m/p13n/SelectionPanel` | sap.m.p13n.SelectionPanel |
| `@rhfan2019/smart-kit/m/p13n/SortPanel` | sap.m.p13n.SortPanel |
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
| `@rhfan2019/smart-kit/suite/ui/microchart/AreaMicroChart` | sap.suite.ui.microchart.AreaMicroChart |
| `@rhfan2019/smart-kit/suite/ui/microchart/AreaMicroChartItem` | sap.suite.ui.microchart.AreaMicroChartItem |
| `@rhfan2019/smart-kit/suite/ui/microchart/AreaMicroChartLabel` | sap.suite.ui.microchart.AreaMicroChartLabel |
| `@rhfan2019/smart-kit/suite/ui/microchart/AreaMicroChartPoint` | sap.suite.ui.microchart.AreaMicroChartPoint |
| `@rhfan2019/smart-kit/suite/ui/microchart/BulletMicroChart` | sap.suite.ui.microchart.BulletMicroChart |
| `@rhfan2019/smart-kit/suite/ui/microchart/BulletMicroChartData` | sap.suite.ui.microchart.BulletMicroChartData |
| `@rhfan2019/smart-kit/suite/ui/microchart/ColumnMicroChart` | sap.suite.ui.microchart.ColumnMicroChart |
| `@rhfan2019/smart-kit/suite/ui/microchart/ColumnMicroChartData` | sap.suite.ui.microchart.ColumnMicroChartData |
| `@rhfan2019/smart-kit/suite/ui/microchart/ColumnMicroChartLabel` | sap.suite.ui.microchart.ColumnMicroChartLabel |
| `@rhfan2019/smart-kit/suite/ui/microchart/ComparisonMicroChart` | sap.suite.ui.microchart.ComparisonMicroChart |
| `@rhfan2019/smart-kit/suite/ui/microchart/ComparisonMicroChartData` | sap.suite.ui.microchart.ComparisonMicroChartData |
| `@rhfan2019/smart-kit/suite/ui/microchart/DeltaMicroChart` | sap.suite.ui.microchart.DeltaMicroChart |
| `@rhfan2019/smart-kit/suite/ui/microchart/HarveyBallMicroChart` | sap.suite.ui.microchart.HarveyBallMicroChart |
| `@rhfan2019/smart-kit/suite/ui/microchart/HarveyBallMicroChartItem` | sap.suite.ui.microchart.HarveyBallMicroChartItem |
| `@rhfan2019/smart-kit/suite/ui/microchart/LineMicroChart` | sap.suite.ui.microchart.LineMicroChart |
| `@rhfan2019/smart-kit/suite/ui/microchart/LineMicroChartEmphasizedPoint` | sap.suite.ui.microchart.LineMicroChartEmphasizedPoint |
| `@rhfan2019/smart-kit/suite/ui/microchart/LineMicroChartLine` | sap.suite.ui.microchart.LineMicroChartLine |
| `@rhfan2019/smart-kit/suite/ui/microchart/LineMicroChartPoint` | sap.suite.ui.microchart.LineMicroChartPoint |
| `@rhfan2019/smart-kit/suite/ui/microchart/RadialMicroChart` | sap.suite.ui.microchart.RadialMicroChart |
| `@rhfan2019/smart-kit/suite/ui/microchart/StackedBarMicroChart` | sap.suite.ui.microchart.StackedBarMicroChart |
| `@rhfan2019/smart-kit/suite/ui/microchart/StackedBarMicroChartBar` | sap.suite.ui.microchart.StackedBarMicroChartBar |
| `@rhfan2019/smart-kit/suite/ui/microchart/library` | sap.suite.ui.microchart.AreaMicroChartViewType → `AreaMicroChartViewType`；sap.suite.ui.microchart.BulletMicroChartModeType → `BulletMicroChartModeType`；sap.suite.ui.microchart.CommonBackgroundType → `CommonBackgroundType`；sap.suite.ui.microchart.ComparisonMicroChartViewType → `ComparisonMicroChartViewType`；sap.suite.ui.microchart.DeltaMicroChartViewType → `DeltaMicroChartViewType`；sap.suite.ui.microchart.HorizontalAlignmentType → `HorizontalAlignmentType`；sap.suite.ui.microchart.LineType → `LineType`；sap.suite.ui.microchart.MicroChartColorType → `MicroChartColorType` |
| `@rhfan2019/smart-kit/ui/core/library` | sap.ui.core.IconColor → `IconColor`；sap.ui.core.IndicationColor → `IndicationColor`；sap.ui.core.TitleLevel → `TitleLevel`；sap.ui.core.ValueState → `ValueState`；sap.ui.core.AccessibleLandmarkRole → `AccessibleLandmarkRole` |
| `@rhfan2019/smart-kit/ui/core/message/MessageType` | module:sap/ui/core/message/MessageType |
| `@rhfan2019/smart-kit/ui/integration/cards/AnalyticalContent` | manifest sap.card/Analytical |
| `@rhfan2019/smart-kit/ui/integration/cards/CalendarContent` | manifest sap.card/Calendar |
| `@rhfan2019/smart-kit/ui/integration/cards/ListContent` | manifest sap.card/List |
| `@rhfan2019/smart-kit/ui/integration/cards/ObjectContent` | manifest sap.card/Object |
| `@rhfan2019/smart-kit/ui/integration/cards/TableContent` | manifest sap.card/Table |
| `@rhfan2019/smart-kit/ui/integration/cards/TimelineContent` | manifest sap.card/Timeline |
| `@rhfan2019/smart-kit/ui/unified/Currency` | sap.ui.unified.Currency |
| `@rhfan2019/smart-kit/uxap/AnchorBar` | sap.uxap.AnchorBar |
| `@rhfan2019/smart-kit/uxap/ObjectPageAccessibleLandmarkInfo` | sap.uxap.ObjectPageAccessibleLandmarkInfo |
| `@rhfan2019/smart-kit/uxap/ObjectPageDynamicHeaderContent` | sap.uxap.ObjectPageDynamicHeaderContent |
| `@rhfan2019/smart-kit/uxap/ObjectPageDynamicHeaderTitle` | sap.uxap.ObjectPageDynamicHeaderTitle |
| `@rhfan2019/smart-kit/uxap/ObjectPageLayout` | sap.uxap.ObjectPageLayout |
| `@rhfan2019/smart-kit/uxap/library` | sap.uxap.Importance → `Importance`；sap.uxap.ObjectPageSubSectionLayout → `ObjectPageSubSectionLayout` |
| `@rhfan2019/smart-kit/v4/fe/macros/Chart` | sap.fe.macros.Chart |
| `@rhfan2019/smart-kit/v4/fe/macros/Field` | sap.fe.macros.Field |
| `@rhfan2019/smart-kit/v4/fe/macros/FilterBar` | sap.fe.macros.FilterBar |
| `@rhfan2019/smart-kit/v4/fe/macros/Form` | sap.fe.macros.Form |
| `@rhfan2019/smart-kit/v4/fe/macros/KPITag` | sap.fe.macros.KPITag |
| `@rhfan2019/smart-kit/v4/fe/macros/MessageButton` | sap.fe.macros.MessageButton |
| `@rhfan2019/smart-kit/v4/fe/macros/MicroChart` | sap.fe.macros.MicroChart |
| `@rhfan2019/smart-kit/v4/fe/macros/Paginator` | sap.fe.macros.Paginator |
| `@rhfan2019/smart-kit/v4/fe/macros/Share` | sap.fe.macros.Share |
| `@rhfan2019/smart-kit/v4/fe/macros/Table` | sap.fe.macros.Table |
| `@rhfan2019/smart-kit/v4/fe/macros/TreeTable` | sap.fe.macros.TreeTable |
| `@rhfan2019/smart-kit/v4/fe/macros/VariantManagement` | sap.fe.macros.VariantManagement |
| `@rhfan2019/smart-kit/v4/fe/macros/fcl/FlexibleColumnLayoutActions.block` | sap.fe.macros.FlexibleColumnLayoutActions |
| `@rhfan2019/smart-kit/v4/fe/templates/ListReport` | manifest sap.fe.templates.ListReport |
| `@rhfan2019/smart-kit/v4/fe/templates/ObjectPage` | manifest sap.fe.templates.ObjectPage |
<!-- ui5-modules:end -->

## 子路径入口（`@rhfan2019/smart-kit`）

> ADR-026。根入口 `@rhfan2019/smart-kit` 导出下面列出的全部名字；也可以从子路径只引入一个领域，名字相同。按需引入是否生效由 `npm run size` 检查（例如只用 `MicroChart` 的应用不超过 8 KB gzip）。测试 `packages/react/test/api.test.ts` 检查各子路径合起来正好等于根入口、每个名字只出现一次。

| 子路径 | 主要内容 | 需要 AG Grid |
| --- | --- | --- |
| `/context` | `SmartKitProvider`、`useSmartKit`、`useService`、`useMetaModel`、`useText` | 否 |
| `/i18n` | `createText`、`MESSAGES` | 否 |
| `/theme` | `smartKitMantineTheme`、`smartKitCssVariablesResolver`、`readToken`、`useThemeTokens` | 否 |
| `/util` | `applyExtensions`、`usePageState` | 否 |
| `/v4/fe/templates/ListReport` | `ListReport`（属性 = sap.fe.templates.ListReport 的 manifest 设置，`26c`） | 是 |
| `/v4/fe/templates/ObjectPage` | `ObjectPage`（属性 = sap.fe.templates.ObjectPage 的 manifest 设置，`26c`） | 是 |
| `/styles.css` | 样式（所有组件共用一个文件） | — |

AG Grid（`ag-grid-community`、`ag-grid-react`）是可选的 peer 依赖：不用表格时可以不装，但这时要从不需要 AG Grid 的子路径引入；从根入口引入时，打包工具仍会去解析 AG Grid。

## `@rhfan2019/smart-kit`

### 值（运行时导出）

- `actionPaths`
- `applyExtensions`
- `conditionText`
- `createFields`
- `createText`
- `createWith`
- `DEFAULT_STANDARD_OPTIONS`
- `draftState`
- `dynamicDateValueTypes`
- `fclArrows`
- `fieldErrors`
- `fieldValue`
- `filterSummaryText`
- `getPath`
- `hiddenByImportance`
- `INTL_LOCALE`
- `isActionAvailable`
- `isEditable`
- `linkify`
- `MESSAGES`
- `messageTypeOf`
- `MICRO_COMPARISON_MAX`
- `MissingProviderError`
- `niceTicks`
- `parseConditionText`
- `readToken`
- `relativeDateText`
- `resolveRef`
- `RESTRICTED_FILE_NAME_CHARACTERS`
- `smartKitCssVariablesResolver`
- `smartKitMantineTheme`
- `SmartKitProvider`
- `toDates`
- `typedText`
- `useMetaModel`
- `usePageState`
- `useService`
- `useSmartKit`
- `useText`
- `useThemeTokens`
- `validate`
- `viewSettingsFilterString`

### 类型

- `ConditionTextOptions`
- `DateLike`
- `DraftState`
- `EntitySetHandle`
- `ExtendEntry`
- `ExtendPosition`
- `FclArrow`
- `FieldRenderer`
- `FieldRenderProps`
- `FieldValue`
- `Locale`
- `MessageKey`
- `Messages`
- `PreventableEvent`
- `RendererRegistry`
- `ServiceConfig`
- `ServiceHandle`
- `SmartKitContextValue`
- `SmartKitProviderProps`
- `TextFn`
- `TextParams`
- `TypedKey`
- `ValueContext`

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
