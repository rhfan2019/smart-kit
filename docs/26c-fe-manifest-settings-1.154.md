# 26c SAPUI5 1.154 的 Fiori elements manifest 设置（ListReport、ObjectPage）

> 2026-11-17 按 SAPUI5 1.154.0 的 sap.fe 源码整理（docs/31 阶段 0 第 6 项，`30` 第 5.3、8 节）。源码从 `https://ui5.sap.com/1.154.0/resources/sap/fe/<模块>.ts` 下载，缓存在 `.cache/ui5/1.154.0/src/`，不提交。只写名字、类型、取值、默认值和读取位置，不抄 SAP 的说明。模块路径省略 `sap/fe/` 前缀。

## 1. 权威来源

**结论：以 sap.fe 1.154.0 的 TypeScript 源码为准，按下面的优先级读。**

1. **模板组件的属性声明**（`templates/ListComponent.ts`、`templates/ListReport/Component.ts`、`templates/ObjectPage/Component.ts`、`core/TemplateComponent.ts` 的 `@property`）：定义"页面级设置有哪些、默认值是什么"。`TemplateComponent.getViewData()` 把组件的全部属性（含默认值）放进 viewData，`core/services/TemplatedViewServiceFactory` 再把 viewData 交给 `ManifestWrapper` 和转换器。所以组件的默认值**先于**转换器里的回退值生效。
2. **`core/converters/ManifestSettings.ts` 的类型**（`ListReportManifestSettings`、`ObjectPageManifestSettings`、`BaseManifestSettings`、`TableManifestSettingsConfiguration`、`FilterManifestConfiguration`、`ChartManifestConfiguration`、`ManifestSettingsSapFE` …）：定义嵌套设置的结构、类型和取值。
3. **转换器和读取设置的代码**（`core/converters/ManifestWrapper.ts`、`converters/templates/ListReportConverter.ts`、`ObjectPageConverter.ts`、`converters/controls/Common/Table.ts`、`Chart.ts`、`controls/ListReport/FilterBar.ts`、`objectPage/HeaderAndFooterAction.ts`、`controls/ObjectPage/SubSection.ts` …，以及模板的 view XML 和 controller）：定义实际默认值和取值的效果。**一项设置有没有效，以有没有读取点为准**；类型里有、代码里不读的设置标"不读"。
4. SAPUI5 文档（Fiori elements 章节）只作说明参考；和源码冲突时以源码为准。

为什么不用别的：

- `api.json`（`sap.fe.core.api.json` 的 `sap.fe.core.converters.ManifestSettings.*` typedef）只公开了 `ManifestSettingsSapFE.app` 的三项（`enableLazyLoading`、`enableSaveAndLeave`、`aiConfiguration`），页面级设置一项都没有；`sap.fe.templates.api.json` 里 ListReport / ObjectPage 只有命名空间和 controller；`sap.fe.core.CreationMode`、`sap.fe.core.VariantManagement`、`sap.fe.templates.ObjectPage.SectionLayout` 这些枚举也不在 api.json 里。所以 api.json 不够做权威来源，只能做交叉核对。
- 源码可以机器核对：`.ts` 文件可以直接下载（`resources/sap/fe/**/*.ts`，和 `-dbg.js` 同目录），类型和 `@property` 声明都能用脚本读。阶段 5 的核对脚本应读 1～3。
- 已知不一致（以源码的实际行为为准，下文各项都按实际行为写）：
  - `initialLoad`：`ListReportManifestSettings` 写成 `boolean`，组件属性是 `sap.fe.core.InitialLoadMode`（`Auto` / `Enabled` / `Disabled`，默认 `Auto`），类型也接受布尔值：`true` → `Enabled`，`false` → `Disabled`（`core/library` 的 `InitialLoadType`）。
  - `sectionLayout`：组件默认 `Page`；`ManifestWrapper.getSectionLayout()` 的回退是 `Tabs`，只在没有组件属性时（例如自由页面里的积木）才用到。对象页的实际默认是 `Page`。
  - `editableHeaderContent`：组件默认 `true`；`ManifestWrapper.isHeaderEditable()` 是 `!!editableHeaderContent`，只有没有组件属性时才是 `false`。对象页的实际默认是 `true`。
  - `variantManagement`：`ManifestWrapper` 回退 `None`；列表页组件默认 `Page`，对象页组件默认 `None`（对象页设 `Page` 会报错并改成 `None`）。
  - `sap.fe › macros › filter › enableCommonIntervalFilter`：类型注释写默认 `false`，`ManifestWrapper.isCommonIntervalFilterEnabled()` 实际是 `?? true`。

## 2. 写法约定

- 页面级设置的完整路径是 `sap.ui5 › routing › targets › <target> › options › settings › <设置>`，下文简写为 `settings › <设置>`。
- `controlConfiguration` 的键是注解路径，例如 `@com.sap.vocabularies.UI.v1.LineItem`（可带限定符 `#Q`，也可以带导航路径 `_Items/@…LineItem`），下文简写为 `@UI.LineItem`、`@UI.SelectionFields`、`@UI.Chart`、`@UI.Facets`、`@UI.HeaderFacets`、`@UI.FieldGroup#Q`。没有 `@` 的路径会被 `ManifestWrapper` 自动补上（`defaultTemplateAnnotationPath`、`views.paths[].annotationPath`、`quickVariantSelection.paths[].annotationPath`）。
- "默认"写的是实际生效的值；"—"表示不设（下游控件按自己的默认）。"LR" = 列表页，"OP" = 对象页。

## 3. 页面级设置

### 3.1 两种模板都有（`core/TemplateComponent`、`BaseManifestSettings`）

| 路径 | 类型 / 取值 | 默认 | 读取位置 |
| --- | --- | --- | --- |
| `settings › entitySet` | string | — | `ConverterContext`、各转换器（`getEntitySet`） |
| `settings › contextPath` | string（`/Set` 或 `/Set/_Nav`） | — （没有时用 `/${entitySet}`） | `ConverterContext`、各转换器（`getContextPath`） |
| `settings › navigation › <实体集或导航> › detail › route` / `create › route` / `create › outbound` / `display › …` | object | — | `controls/Common/Table`（行导航、新建跳转） |
| `settings › controlConfiguration › <注解路径>` | object（见第 4～8 节） | — | `ManifestWrapper.getControlConfiguration` |
| `settings › content › header › actions › <key>` | `ManifestAction`（见第 8 节） | — | `ListReportConverter`、`ObjectPageConverter`（`getHeaderActions`） |
| `settings › content › header › overflowGroups › <n> › showSeparator` | boolean | — | 同上（`getHeaderOverflowGroups`） |
| `settings › variantManagement` | `Page` / `Control` / `None` | LR `Page`；OP `None` | `ListReportConverter`、`controls/Common/Table`、`Chart`、`macros/FilterBar` |
| `settings › inlineEdit › enabledFields[]` / `disabledFields[]` / `connectedFields[]` | string[] | `[]` | `controls/Common/table/StandardActions`（`hasInlineEdit`） |
| `settings › additionalProperties` | string[] | `[]` | `ObjectPageConverter`、`TemplatedViewServiceFactory` |
| `settings › preloadConfigurationProperties` | string[] | — | `controls/Common/Table`、`controls/ListReport/FilterBar` |
| `settings › allowDeepLinking`、`refreshStrategyOnAppRestore`、`enhanceI18n`、`breadcrumbsHierarchyMode` | 组件属性 | OP `breadcrumbsHierarchyMode` = `objectNavigation` | 运行时（controller、路由），不在转换器里 |
| `settings › shareOverflowPriority` | `sap.m.OverflowToolbarPriority` | `High` | view XML（`viewData>/shareOverflowPriority`） |
| `settings › share` | object（LR：`ShareOptions`；OP：`Record<string, Record<string, boolean>>`） | — | 运行时（`controllerextensions/Share`；结构阶段 5 核实，见第 11 节） |
| `viewLevel` / `level`、`fclEnabled`、`converterType`、`isDesktop`、`isPhone`、`contentDensities`、`shellContentDensity`、`sapFeManifestConfiguration` | 框架填写 | — | 不是应用设置：由路由、FCL、Shell 和 `sap.fe` 段填进 viewData |

### 3.2 列表页（`templates/ListComponent`、`templates/ListReport/Component`、`ListReportManifestSettings`）

| 路径 | 类型 / 取值 | 默认 | 读取位置 |
| --- | --- | --- | --- |
| `settings › initialLoad` | `Auto` / `Enabled` / `Disabled`（也收 `true` / `false`） | `Auto`（有默认筛选值或用户变式"自动应用"时才加载） | `templates/ListReport/ListReportController`、`macros/FilterBar`（`isSearchTriggeredByInitialLoad`） |
| `settings › liveMode` | boolean | `false` | `ListReport.view.xml`（传给筛选栏的 `liveMode`；`liveMode` 时不注册 Ctrl+Enter 搜索命令）、`macros/FilterBar` |
| `settings › defaultTemplateAnnotationPath` | string（SPV / PV 路径） | — （用无限定符的 SPV / PV / LineItem） | `ListReportConverter`、`controls/Common/DataVisualization` |
| `settings › views` | `MultipleViewsConfiguration`（见第 7 节） | — | `ListReportConverter`、`controls/Common/Table` |
| `settings › stickyMultiTabHeader` | boolean | `true` | `ListReportConverter` |
| `settings › keyPerformanceIndicators › <名字>` | `{ model?, entitySet?, contextPath?, qualifier, detailNavigation? }` 或 `{ template }` | — | `controls/Common/KPI` |
| `settings › hideFilterBar` | boolean | `false`（有图表时无效） | `ListReportConverter`、`controls/Common/Table`（个性化加 `Filter`）、controller |
| `settings › useHiddenFilterBar` | boolean | `false`（筛选栏渲染但隐藏，条件仍生效） | `ListReportConverter`、view XML |
| `settings › content › header › customHeader › expandedHeaderFragment` / `collapsedHeaderFragment` | string（fragment 名） | — | `ListReportConverter` |
| `settings › content › header › aiNotice`、`avatar › imageFitType` | object | — | 类型里有，LR 转换器不读 |

### 3.3 对象页（`templates/ObjectPage/Component`、`ObjectPageManifestSettings`）

| 路径 | 类型 / 取值 | 默认 | 读取位置 |
| --- | --- | --- | --- |
| `settings › sectionLayout` | `Page` / `Tabs` | `Page`（组件；`ManifestWrapper` 回退 `Tabs` 不生效） | `ObjectPageConverter`、`controls/Common/Table`、controller |
| `settings › content › header › anchorBarVisible` | boolean | `true` | `ObjectPageConverter`（`showAnchorBar`；同时控制 `toggleHeaderOnTitleClick`、`headerContentPinnable`） |
| （推导）`useIconTabBar` | — | `anchorBarVisible && sectionLayout === "Tabs"` | `ManifestWrapper.useIconTabBar` |
| `settings › content › header › visible` | boolean | `true` | `ObjectPageConverter`（`getShowObjectPageHeader`） |
| `settings › editableHeaderContent` | boolean | `true`（组件）；页眉不可见时按 `false` | `ObjectPageConverter`（`isHeaderEditable`：编辑态显示可编辑的页眉区块） |
| `settings › content › header › facets › <key>` | `ManifestHeaderFacet`（`type`、`name`、`template`、`position`、`visible`、`title`、`subTitle`、`stashed`、`requestGroupId`、`templateEdit`、`flexSettings`） | — | `controls/ObjectPage/HeaderFacet`、`SubSection`（和 `controlConfiguration › @UI.HeaderFacets › facets` 合并） |
| `settings › content › header › aiNotice` | `{ visible?, contentText?, contentFragmentName? }` | — | `ObjectPageConverter`（`getHeaderAiNotice`） |
| `settings › content › header › avatar › imageFitType` | `sap.m.AvatarImageFitType` | — | 类型里有，转换器不读（`getHeaderAvatar` 没有调用方） |
| `settings › content › body › sections › <key>` | `ManifestSection`（`title`、`id`、`name`、`template`、`position`、`visible`、`subSections`、`actions`、`overflowGroups`、`useSingleTextAreaFieldAsNotes`、`onSectionLoaded`、`applyState`、`retrieveState`、`isPartOfPreview`、`flexSettings`） | — | `controls/ObjectPage/SubSection`、`ObjectPageConverter`（和 `controlConfiguration › @UI.Facets › sections` 合并） |
| `… › sections › <key> › subSections › <key>` | `ManifestSubSection`（`template`、`title`、`position`、`visible`、`actions`、`overflowGroups`、`sideContent{template, equalSplit}`、`enableLazyLoading`、`embeddedComponent{name, settings}`、`horizontalLayout`、`isPartOfPreview`、`applyState`、`retrieveState`、`flexSettings`） | — | `controls/ObjectPage/SubSection`、`controls/Common/Form`（`horizontalLayout`） |
| `settings › content › transportSelection` | `{ transportRequestProperty, selectTransportAction }` | — | `ObjectPageConverter` |
| `settings › enableLazyLoading` | boolean | 组件 `undefined` → `sap.fe › app › enableLazyLoading` → `false` | `ObjectPageConverter`、`SubSection`（前 3 个子区块外按需显示） |
| `settings › disableObjectPageRequestOptimization` | boolean | 组件 `undefined` → `sap.fe › app › disableObjectPageRequestOptimization` → `false` | `ObjectPageConverter`、controller |
| `settings › useTextForNoDataMessages` | boolean | `false`（表格无数据用 `illustratedMessage-ExtraSmall`；`true` 用文本） | `controls/Common/Table` |
| `settings › openInEditMode` | boolean | `undefined`（按 `false`） | `ObjectPageController`（`isOpenInEditMode`） |
| `settings › showRelatedApps` | boolean | `false` | `ObjectPage.view.xml`、controller |
| `settings › additionalSemanticObjects`、`inboundParameters` | object | — | controller / 运行时 |
| `settings › variantManagement` | `Control` / `None`（`Page` 改为 `None`） | `None` | 同 3.1 |

## 4. 表格（`settings › controlConfiguration › @UI.LineItem › …`，`controls/Common/Table`）

积木 `sap.fe.macros.Table` 的属性也走同一个转换器（`macros/table/TableDefinition` 把积木属性转成 `tableSettings`），所以 `26b` 文末"实际默认值"和这里一致。

| 路径（`… › tableSettings ›` 下） | 类型 / 取值 | 默认 | 备注 |
| --- | --- | --- | --- |
| `type` | `ResponsiveTable` / `GridTable` / `AnalyticalTable` / `TreeTable` | 分析能力（ApplySupported 含 8 种转换）→ `AnalyticalTable`；有成对 RecursiveHierarchy → `TreeTable`；否则 `ResponsiveTable` | 非法值回退 `ResponsiveTable` |
| `selectionMode` | `Auto` / `None` / `Single` / `Multi` / `ForceSingle` / `ForceMulti` | `Auto`：有删除、批量编辑、剪切或需要选择的操作时 `Multi`，否则 `None`（OP 只在编辑态）；TreeTable 未设时 `Multi` | `getSelectionMode` |
| `disableLeafSelection` | boolean | `false` | 只对 TreeTable |
| `creationMode › name` | `NewPage` / `Inline` / `InlineCreationRows` / `CreationDialog` / `External` / `AddViaValueHelp`（枚举里还有 `Sync`、`Async`、`Deferred`、`CreationRow`，也算合法值） | `NewPage`（`sap.fe › macros › table › defaultCreationMode` = `InlineCreationRows` 时用它）；OP 上没有子页面路由时改为 `Inline` | `getTableManifestConfiguration`、`_getCreationBehaviour` |
| `creationMode › createAtEnd` | boolean | `Inline`、`CreationDialog` 为 `false`，其他 `true`；OP 回退 `Inline` 时 `false` | |
| `creationMode › creationFields` | string（逗号分隔或 FieldGroup） | — | `CreationDialog` 用 |
| `creationMode › inlineCreationRowCount` | number | 1 | |
| `creationMode › inlineCreationRowsHiddenInEditMode` | boolean 或 `"true"` | `false` | |
| `creationMode › disableAddRowButtonForEmptyData` | boolean | `false`（有 `customValidationFunction` 时总是 `false`） | |
| `creationMode › customValidationFunction`、`isCreateEnabled`、`outbound`、`createInPlace`、`nodeType{propertyName, values}`、`addViaValueHelpSettings › referenceProperty` | string / object | — | `outbound` 只对 `External`；`isCreateEnabled`、`createInPlace`、`nodeType` 只对 TreeTable |
| `enableExport` | boolean | `true`；OP 上等于 `enablePaste` | `_getEnableExport` |
| `exportFileName`、`exportSheetName`、`exportRequestSize` | string / number | — | |
| `enablePaste` | boolean | OP `true`；LR 只有草稿 TreeTable `true` | |
| `enablePastingOfComputedProperties` | boolean | — | |
| `disableCopyToClipboard` | boolean | — | |
| `enableFullScreen` | boolean | 只在手机上 `true`；LR 非手机强制 `false` | |
| `enableMassEdit` | boolean 或 `{ visibleFields, ignoredFields, operationGroupingMode: ChangeSet/Isolated, customFragment, fromInline }` | `false`；`operationGroupingMode` LR `Isolated`、OP `ChangeSet` | `getMassEditSettings` |
| `personalization` | boolean 或 `{ sort, column, filter, group, aggregate }` | `Sort, Column`；LR 只有 Control 级变式管理或隐藏筛选栏时加 `Filter`，OP 加 `Filter`；ResponsiveTable 加 `Group`；AnalyticalTable 加 `Group, Aggregate` | `getP13nMode` |
| `quickVariantSelection › paths[] › annotationPath` | string（SV 路径） | — | `getFilterConfiguration` |
| `quickVariantSelection › showCounts` | boolean | — | |
| `quickVariantSelection › hideTableTitle` | boolean | `false`（`true` 时表头不显示） | |
| `header` | string | `UI.HeaderInfo/TypeNamePlural` | |
| `headerVisible` | boolean | `true` | |
| `rowCountMode` / `rowCount` | `Auto` / `Fixed` / `Interactive`，number | 非 ResponsiveTable：LR `Auto` / 3；OP `Fixed`，GridTable 5，TreeTable / AnalyticalTable 10（`Auto` 时 3） | `_getTableMode` |
| `selectAll` | boolean | ResponsiveTable 的 multiSelectMode：`Default`（`false` → `ClearAll`）；OP 用 IconTabBar 时未设 → `ClearAll` | `_getMultiSelectMode` |
| `selectionLimit` | number | 200（`selectAll=true` 或 0 时不限） | |
| `frozenColumnCount` / `disableColumnFreeze` | number / boolean | — / `false` | |
| `widthIncludingColumnHeader` | boolean | `false` | |
| `condensedTableLayout` | boolean | `false`（只对非 ResponsiveTable，且内容密度允许） | |
| `popinLayout` | `Block` / `GridLarge` / `GridSmall` | `sap.fe › macros › table › defaultPopinLayout`，否则 `Block`（只对 ResponsiveTable） | |
| `threshold` | number | `MaxItems`；否则 TreeTable 200，GridTable / AnalyticalTable 100，其他 30（导航属性表格 10）；manifest 值优先（`MdcTableTemplate`） | `getThreshold` |
| `scrollThreshold` | number | 非 ResponsiveTable 300 | |
| `isSearchable` | boolean | 平表看 `SearchRestrictions/Searchable`；分析表、树表看 ApplySupported 是否含 `search` | |
| `readOnly` | boolean | — （显示模式时只读） | |
| `ignoredFields` | string | — | |
| `analyticalConfiguration › aggregationOnLeafLevel` | boolean | `false`（`true` 时 AnalyticalTable 只读） | |
| `hierarchyQualifier` | string | 实体的第一个 RecursiveHierarchy | 只对 TreeTable |
| `isNodeMovable`、`isNodeCopyable`、`isMoveToPositionAllowed`、`isCopyToPositionAllowed` | string（扩展函数） | — | 只对 TreeTable |
| `rowPress`、`selectionChange`、`beforeRebindTable` | string（扩展函数） | — | |
| `enableAddCardToInsights` | boolean | — | |
| `disableRequestCache` | boolean | — （乐观批处理默认开） | |
| `disableOwnRequestOnMVF` | boolean | — | |
| `additionalProperties`、`usePropertyKeysMode` | string[] / boolean | — | |
| `… › @UI.LineItem › actions › <key>` | `ManifestAction`（见第 8 节） | — | `getActionsFromManifest` |
| `… › @UI.LineItem › overflowGroups › <n> › showSeparator` | boolean | — | |
| `… › @UI.LineItem › columns › <key>` | 自定义列：`header`、`template`、`properties`、`position{placement, anchor}`、`width`、`importance`、`horizontalAlign`、`availability`（`Default`/`Adaptation`/`Hidden`）、`tooltip`、`required`、`widthIncludingColumnHeader`、`exportSettings`、`formatOptions`、`disableExport`、`aiNotice`；覆盖注解列：再加 `settings{microChartSize, showMicroChartLabel, mergeCells, mergeComparisonProperties}`、`showDataFieldsLabel`、`afterExecution` | — | `controls/Common/table/Columns` |

## 5. 筛选栏（`settings › controlConfiguration › @UI.SelectionFields › …`，`ListReportConverter`、`controls/ListReport/FilterBar`）

| 路径 | 类型 / 取值 | 默认 | 读取位置 / 备注 |
| --- | --- | --- | --- |
| `layout` | `compact` / `compactvisual`（不分大小写） | `compact` | `ListReportConverter`；`compactvisual` 时出现可视化筛选切换 |
| `initialLayout` | `compact` / `visual` | `compact` | `ListReportConverter`（只在 `compactvisual` 时用） |
| `useSemanticDateRange` | boolean | `true` | `ListReportConverter`（日期筛选用 DynamicDateRange，并读 `filterFields › settings › defaultValues` 作默认日期） |
| `showClearButton` | boolean | `false` | `ListReportConverter` |
| `navigationProperties`（旧）/ `navigationPropertiesForPersonalization`（新） | string[] | — | `controls/ListReport/FilterBar`（先读旧名） |
| `usePropertyKeysMode` | boolean | `false` | `controls/ListReport/FilterBar` |
| `showMessages` | boolean | 列表页固定 `false` | 类型里有，列表页模板不读（`ListReport.view.xml` 写死 `false`） |
| `filterFields › <key>` | `label`、`property`、`template`、`type`、`availability`（`Default`/`Adaptation`/`Hidden`）、`position`、`required`、`slotName`、`visualFilter › valueList`、`settings{operatorConfiguration[], defaultValues[{operator}], isCustomFilter, disableIntegerGrouping}`、`intervalFilterField{lowerBoundary, upperBoundary, lowerBoundaryIncluded, upperBoundaryIncluded}` | — | `controls/ListReport/FilterBar`、`VisualFilters` |
| `settings › liveMode`、`hideFilterBar`、`useHiddenFilterBar`、`initialLoad` | 见 3.2 | | 页面级，不在 `controlConfiguration` 里 |

## 6. 图表（`settings › controlConfiguration › @UI.Chart › …`，`controls/Common/Chart`）

| 路径 | 类型 / 取值 | 默认 | 备注 |
| --- | --- | --- | --- |
| `chartSettings › personalization` | boolean、string 或 `{ sort, type, item, filter }` | `Sort,Type,Item`；Control 级变式管理或 `true` 时 `Sort,Type,Item,Filter`；`false` 关闭 | `getP13nMode` |
| `chartSettings › header` | string | — | `getHeaderInfo` |
| `chartSettings › headerVisible` | boolean | — （积木默认 `true`） | |
| `chartSettings › selectionMode` | `Multiple` / `Single` / `None` | — （积木默认 `Multiple`） | |
| `actions › <key>`、`overflowGroups` | `ManifestAction` | — | |
| `enableAddCardToInsights` | boolean | — | |
| （推导）变式管理 | — | 页面的 `variantManagement`；没有个性化时 `None` | `findVariantManagement` |

## 7. 多视图（`settings › views`，列表页，`ListReportConverter`）

| 路径 | 类型 / 取值 | 默认 | 备注 |
| --- | --- | --- | --- |
| `views › paths[]`（单视图） | `{ key?, annotationPath, entitySet?, contextPath?, keepPreviousPersonalization?, visible? }` | — | `annotationPath` 指 SPV、PV 或 SV；带不同实体集时是"多表格"（Multiple Content） |
| `views › paths[]`（组合视图） | `{ key?, primary[], secondary[], defaultPath?: both/primary/secondary, visible?, annotationPath? }` | `defaultPath` 未核实 | 表格 + 图表 |
| `views › paths[]`（自定义视图） | `{ key?, label, template, visible? }` | — | |
| `views › showCounts` | boolean | 有多个实体集时 `true`，否则 `false` | `showTabCounts`；为 `true` 时表格不再显示行数 |
| `settings › stickyMultiTabHeader` | boolean | `true` | 见 3.2 |

## 8. 操作、页脚、表单（主要是对象页）

| 路径 | 类型 / 取值 | 默认 | 读取位置 |
| --- | --- | --- | --- |
| `settings › content › header › actions › <key>` | `ManifestAction` | — | `ListReportConverter`、`ObjectPageConverter` |
| `settings › content › footer › actions › <key>` | `ManifestAction` | — （默认页脚操作：保存 / 取消 / 应用、determining 操作、"创建下一个"，由注解、草稿和 `viewLevel`、FCL 决定） | `ObjectPageConverter`、`objectPage/HeaderAndFooterAction` |
| `settings › content › footer › overflowGroups` | object | — | `ObjectPageConverter` |
| `ManifestAction` 的字段 | `press`、`text`、`visible`、`enabled`、`position{placement: Before/After/End, anchor}`、`requiresSelection`、`enableOnSelect`（`single`/`multi`）、`menu[]`、`defaultAction`、`command`、`determining`、`inline`、`afterExecution{navigateToInstance, enableAutoScroll}`、`defaultValuesFunction`、`priority`、`group`、`overflowGroup`、`isAIOperation`、`isPrimaryAction`、`disableStrictHandling`、`facetName`、`template` | — | `controls/Common/Action`（`getActionsFromManifest`） |
| `controlConfiguration › @UI.FieldGroup#Q`（表单） | `{ fields › <key>{type, template, label, property, position, formatOptions, visible, readOnly, semanticObject}, actions, overflowGroups, layout{type: ColumnLayout/ResponsiveGridLayout, …}, navigationPropertiesForAdaptationDialog, flexSettings }` | `layout` 默认 ColumnLayout（`columnsM=3`、`columnsL=4`、`columnsXL=6`、`labelCellsLarge=12`） | `controls/Common/Form`、`macros/Form` |
| `controlConfiguration › @UI.Facets › sections`、`@UI.HeaderFacets › facets` | 同 `content.body.sections`、`content.header.facets` | — | 两处合并，`content` 优先 |
| `controlConfiguration › @UI.MicroChart` | `{ requestGroupId, navigation{targetOutbound, targetSections}, hideOnNoData, showOnlyChart, size }` | — | 页眉微图表 |

## 9. 应用级设置（`sap.fe` 段，`ManifestSettingsSapFE`；`sap.app`）

只列转换器或模板实际读取的。`sap.fe` 段整个作为 `sapFeManifestConfiguration` 放进 viewData。

| 路径 | 类型 / 取值 | 默认 | 读取位置 |
| --- | --- | --- | --- |
| `sap.fe › app › enableLazyLoading` | boolean | `false` | `ManifestWrapper.getEnableLazyLoading`（页面的 `enableLazyLoading` 优先） |
| `sap.fe › app › disableObjectPageRequestOptimization` | boolean | `false` | 同上（页面设置优先） |
| `sap.fe › app › aiConfiguration › smartSummarization › visibility` | `ShowOnAllPages` / `HideOnAllPages` | `ShowOnAllPages` | `ObjectPageConverter`（`isSmartSummarizationEnabled`） |
| `sap.fe › app › hideDraft › enabled`（及 `stayOnCurrentPageAfterSave`、`stayOnCurrentPageAfterCancel`、`hideCreateNext`） | boolean | `false` | `controls/Common/Table`、`controls/ListReport/FilterBar` |
| `sap.fe › app › enableSaveAndLeave` | boolean | `false` | 运行时（未下载核对） |
| `sap.fe › macros › table › defaultCreationMode` | 只认 `InlineCreationRows` | — | `controls/Common/Table`、`table/Columns`、`macros/table/TableDefinition` |
| `sap.fe › macros › table › defaultPopinLayout` | `Block` / `GridLarge` / `GridSmall` | `Block` | `controls/Common/Table` |
| `sap.fe › macros › filter › enableCommonIntervalFilter` | boolean | `true`（代码；类型注释写 `false`） | `controls/ListReport/FilterBar` |
| `sap.fe › form › retrieveTextFromValueList` | boolean | — | `TemplatedViewServiceFactory` |
| `sap.fe › macros › table › currency / unitOfMeasure › decimalPadding`、`macros › multiValueField › itemsSizeLimit`、`macros › filter › customFilterOperators`、`macros › valueHelp › enableLinksInDialogTable`、`app › preserveDecimalsForCurrency`、`showOnlyUnitDecimals`、`share`、`breadcrumbs`、`sideEffectsEventsInteractionType` 等 | 见 `ManifestSettings.ts` | — | 字段、值帮助、运行时模块读取，不改变模板结构（未逐项核对） |
| `sap.app › crossNavigation › outbounds` | object | — | `controls/Common/Table`（外部导航、`creationMode.outbound`） |
| `sap.ui5 › routing › config › flexibleColumnLayout`（FCL） | — | — | 框架据此填 `fclEnabled`，影响页脚和导航（`HeaderAndFooterAction`） |

## 10. smart-kit 的对应属性（阶段 5 完成，D46）

模板 `v4/fe/templates/ListReport`（`$ListReportSettings`，`packages/react/src/templates/ListReport.tsx`）和 `v4/fe/templates/ObjectPage`（`$ObjectPageSettings`，`templates/ObjectPageSettings.ts`）的属性就是第 3～8 节的 manifest 设置：同名、同嵌套、同取值和默认值。下表"有"表示有同名属性；没有的写登记它的偏差（`tools/ui5-alignment/deviations.json`，`DV-lr5-*` / `DV-op5-*`，种类 `manifest-missing` / `manifest-values` / `manifest-extra`），格式是"编号 类别 阶段"，"长期"表示没有计划阶段。

- 核对：`scripts/check-manifest-settings.mjs`（AL-13，在 `npm run check:ui5` 里）按 `tools/ui5-alignment/manifest.ListReport.json`（333 项）、`manifest.ObjectPage.json`（382 项）逐项比较，0 未登记。标 `unread` 的项（类型里有、FE 不读，例如 LR 的 `content › header › aiNotice`、`avatar`）不比较。
- FE 写片段名或扩展函数名的地方（`template`、`templateEdit`、`press`、`rowPress`、`selectionChange`），smart-kit 在同一个键下放渲染函数或处理函数（`react-idiom`，D46）。

### 10.1 `ListReport`

| manifest 设置 | smart-kit | 未做的部分 |
| --- | --- | --- |
| `entitySet`、`contextPath` | 有 | |
| `navigation › <set> › detail › route` | 有（行导航走 `NavigationAdapter.toObject`） | `detail › outbound`、`outboundDetail`：lr5-001、003 different-value 长期；`detail › targetControlId`、`availability`：lr5-002、004 no-binding 长期；`create`、`display`：lr5-005、006 different-value 长期 |
| `content › header › actions › <key>` | 有：`text`、`press`、`visible`、`enabled`、`requiresSelection`、`enableOnSelect`、`menu`、`position` | 其余 `ManifestAction` 字段（`defaultAction`、`command`、`determining`、`inline`、`defaultValuesFunction`、`priority`、`group`、`overflowGroup`、`isAIOperation`、`isPrimaryAction`、`disableStrictHandling`、`facetName`、`template`、`afterExecution`）：lr5-007～020 not-implemented 6 |
| `content › header › overflowGroups`、`customHeader` | 无 | lr5-021、022 not-implemented 6 |
| `variantManagement` | 有：`Page`（默认）、`None` | `Control`：lr5-023（`manifest-values`）not-implemented 6，要表格级变式管理（DV-table-005） |
| `inlineEdit`、`additionalProperties`、`shareOverflowPriority`、`defaultTemplateAnnotationPath` | 无 | lr5-024、025、031、033 not-implemented 6 |
| `preloadConfigurationProperties` | 无 | lr5-026 no-binding 长期 |
| `allowDeepLinking`、`refreshStrategyOnAppRestore`、`enhanceI18n`、`breadcrumbsHierarchyMode` | 无 | lr5-027～030 different-value 长期（运行时设置） |
| `share` | 无（Share 总是显示，FE 也没有关闭开关） | lr5-032 different-value 长期（SAP 平台的分享选项） |
| `initialLoad` | 有：`Auto`（默认）/ `Enabled` / `Disabled`，也收布尔值 | |
| `liveMode` | 有，默认 `false` | |
| `views › paths[]`（单视图、自定义视图） | 有：`key`、`annotationPath`、`entitySet`、`contextPath`、`label`、`template` | `visible`：lr5-034 no-binding 长期；`keepPreviousPersonalization`：lr5-035 not-implemented 6 |
| `views › paths[]`（组合视图） | 无 | `defaultPath`、`primary`、`secondary`：lr5-036～038 not-implemented 6 |
| `views › showCounts` | 有（计数用 `<set>/$count`） | |
| `stickyMultiTabHeader`、`hideFilterBar`、`useHiddenFilterBar` | 有 | |
| `keyPerformanceIndicators › <名字>` | 有：`qualifier`、`entitySet`、`contextPath`、`template` | `model`：lr5-039 no-binding 长期；`detailNavigation`：lr5-040 different-value 长期 |
| `@UI.LineItem › tableSettings` | 有：`type`、`selectionMode`、`disableLeafSelection`、`creationMode › name`、`enableExport`、`exportFileName`、`exportSheetName`、`exportRequestSize`、`disableCopyToClipboard`、`enableFullScreen`、`personalization`、`quickVariantSelection`（`paths`、`showCounts`、`hideTableTitle`）、`header`、`headerVisible`、`rowCountMode`、`selectAll`、`selectionLimit`、`frozenColumnCount`、`disableColumnFreeze`、`widthIncludingColumnHeader`、`condensedTableLayout`、`popinLayout`、`threshold`、`isSearchable`、`readOnly`、`ignoredFields`、`hierarchyQualifier`、`rowPress`、`selectionChange` | `creationMode` 的其余字段：lr5-041～051 not-implemented 6（`outbound` 是 lr5-048 different-value 长期）；`enablePaste`、`enablePastingOfComputedProperties`、`enableMassEdit`、`rowCount`、`scrollThreshold`、`analyticalConfiguration`、`isNodeMovable` 等四个树表函数、`beforeRebindTable`、`additionalProperties`、`usePropertyKeysMode`：lr5-052～062、066、067 not-implemented 6；`enableAddCardToInsights`：lr5-063 different-value 长期；`disableRequestCache`、`disableOwnRequestOnMVF`：lr5-064、065 no-binding 长期 |
| `@UI.LineItem › tableSettings › creationMode › name` 的取值 | 列表页认 `NewPage`（默认；草稿服务直接建草稿并打开对象页）、`CreationDialog`、`External`，其他值按 FE 回退 `NewPage` | 非草稿服务用对话框新建：DV-FE-04 kit-extension |
| `@UI.LineItem › actions › <key>` | 有：同页头动作，`menu` 生成菜单按钮 | 其余字段：lr5-068～081 not-implemented 6；`overflowGroups`：lr5-082 not-implemented 6 |
| `@UI.LineItem › columns › <key>` | 有：`header`、`template`、`properties`、`position`、`width`、`importance`、`horizontalAlign`、`disableExport` | `type`、`availability`、`tooltip`、`required`、`widthIncludingColumnHeader`、`showDataFieldsLabel`、`mergeCells`、`mergeComparisonProperties`、`exportSettings`、`formatOptions`、`aiNotice`、`afterExecution`、`settings`：lr5-083～095 not-implemented 6 |
| `@UI.SelectionFields › filterFields › <key>` | 有：`label`、`property`、`template`、`availability`、`required`、`position` | `type`、`settings`、`visualFilter`、`intervalFilterField`：lr5-101、103～105 not-implemented 6；`slotName`：lr5-102 no-binding 长期 |
| `@UI.SelectionFields` 其余 | 有：`showClearButton`、`navigationPropertiesForPersonalization` | `layout`、`initialLayout`、`useSemanticDateRange`、`usePropertyKeysMode`：lr5-096～098、100 not-implemented 6；旧名 `navigationProperties`：lr5-099 different-value 长期 |
| `@UI.Chart`（第 6 节） | 无 | lr5-106 not-implemented 6 |

smart-kit 多出来的属性：

| 属性 | 偏差 | 为什么 |
| --- | --- | --- |
| `service` | lr5-107 kit-extension | 多服务时选服务；FE 由 `sap.app › dataSources` 和路由的模型决定 |
| `pageKey` | lr5-108 kit-extension | 变式和页面状态的存储键；FE 用视图 id 和 flexibility（D42） |
| `title` | lr5-109 kit-extension | 页面标题（标准变式名、`variantManagement: 'None'` 时的标题、邮件主题）；FE 取 `sap.app › title`，smart-kit 没有应用描述符 |
| `onRowsChange` | lr5-110 kit-extension | 主表格已读的行（宿主做分栏翻页）；FE 由 Paginator 读列表绑定 |
| `refreshToken` | lr5-111 kit-extension | 宿主改了数据后刷新表格、页签计数和图表；FE 用 `ExtensionAPI.refresh()` |
| `onBeforeExport`、`onExported` | lr5-112、113 kit-extension | 导出前后的回调；FE 是控制器扩展 |
| `canSaveVariants` | lr5-114 kit-extension | 能否保存变式，由宿主的 VariantStore 决定（D38、D42） |
| `className` | lr5-115 react-idiom | 根元素的 CSS 类（ADR-032 规则 7） |

### 10.2 `ObjectPage`

| manifest 设置 | smart-kit | 未做的部分 |
| --- | --- | --- |
| `entitySet`、`contextPath` | 有 | |
| `navigation › <nav> › detail › route` | 有（子表的行可以导航） | `detail › outbound`、`outboundDetail`：op5-001、003 no-binding 长期；`detail › targetControlId`、`availability`、`create`、`display`：op5-002、004～006 not-implemented 6 |
| `sectionLayout` | 有：`Page`（默认）/ `Tabs` | |
| `editableHeaderContent` | 有，默认 `true`：编辑态隐藏页头内容，在最前面放"Header"区块；没有"编辑页头"对话框 | |
| `openInEditMode`、`enableLazyLoading`、`useTextForNoDataMessages` | 有，默认都是 `false` | |
| `variantManagement` | 有：`None`（默认）/ `Control` | 没有单独登记；子表还没有表格级变式管理（DV-table-005 阶段 6），`ObjectPage.tsx` 不读这个属性 |
| `additionalProperties` | 有 | |
| `content › header › visible`、`anchorBarVisible` | 有，默认 `true`；`anchorBarVisible && sectionLayout === 'Tabs'` 时用页签 | |
| `content › header › facets › <key>` | 有：`title`、`subTitle`、`template`、`templateEdit`、`position`、`visible` | `type`、`name`：op5-084、085 not-implemented 6；`stashed`、`requestGroupId`、`flexSettings`：op5-086～088 no-binding 长期 |
| `content › header › aiNotice` | 无 | op5-089 no-binding 长期 |
| `content › header › actions`、`content › footer › actions` | 有：`text`、`press`、`visible`、`enabled`、`position`、`menu` | `requiresSelection`、`enableOnSelect` 和其余 `ManifestAction` 字段：op5-067～082、139～154 not-implemented 6（`isAIOperation` 是 op5-077、149 no-binding 长期）；`overflowGroups`：op5-083、155 not-implemented 6 |
| `content › body › sections › <key>` | 有：`title`、`template`、`position`、`visible`、`subSections`、`actions`、`isPartOfPreview` | `id`、`name`、`useSingleTextAreaFieldAsNotes`、`onSectionLoaded`、`applyState`、`retrieveState`：op5-090～095 not-implemented 6；动作的其余字段：op5-096～111；`overflowGroups`：op5-112 not-implemented 6；`flexSettings`：op5-113 no-binding 长期 |
| `… › subSections › <key>` | 有：`title`、`template`、`position`、`visible`、`actions`、`sideContent{template, equalSplit}`、`enableLazyLoading`、`isPartOfPreview`；侧边内容由子区块动作或 `ref.showSideContent` 显示 | `id`、`name`、`subSectionCreated`、`applyState`、`retrieveState`、`horizontalLayout`：op5-114～119 not-implemented 6；动作的其余字段：op5-120～135；`overflowGroups`：op5-136 not-implemented 6；`embeddedComponent`、`flexSettings`：op5-137、138 no-binding 长期 |
| `content › transportSelection`、`inlineEdit`、`breadcrumbsHierarchyMode`、`shareOverflowPriority` | 无 | op5-156、157、162、163 not-implemented 6 |
| `preloadConfigurationProperties`、`allowDeepLinking`、`refreshStrategyOnAppRestore`、`enhanceI18n`、`disableObjectPageRequestOptimization` | 无 | op5-158～161、165 no-binding 长期 |
| `share` | 无（Share 总是显示） | op5-164 no-binding 长期（只用于 MS Teams 卡片） |
| `showRelatedApps`、`additionalSemanticObjects`、`inboundParameters` | 无 | op5-166～168 no-binding 长期（依赖 FLP） |
| `<nav>/@UI.LineItem › tableSettings` | 有：`type`、`selectionMode`、`creationMode › name`（默认 `NewPage`，没有路由时 `Inline`；"路由"是 `navigation` 条目或 `NavigationAdapter.hasObjectPage`）、`enableExport`、`exportFileName`、`exportSheetName`、`exportRequestSize`、`disableCopyToClipboard`、`enableFullScreen`、`personalization`、`header`、`headerVisible`、`rowCountMode`、`selectionLimit`、`frozenColumnCount`、`disableColumnFreeze`、`widthIncludingColumnHeader`、`condensedTableLayout`、`popinLayout`、`threshold`、`scrollThreshold`、`isSearchable`、`readOnly`、`ignoredFields` | `disableLeafSelection`、`creationMode` 的其余字段、`enablePaste`、`enablePastingOfComputedProperties`、`enableMassEdit`、`quickVariantSelection`、`rowCount`、`selectAll`、`analyticalConfiguration`、`hierarchyQualifier`、树表函数、`rowPress`、`selectionChange`、`beforeRebindTable`、`additionalProperties`、`usePropertyKeysMode`：op5-007～033、037、038 not-implemented 6；`enableAddCardToInsights`、`disableRequestCache`、`disableOwnRequestOnMVF`：op5-034～036 no-binding 长期 |
| `<nav>/@UI.LineItem › actions › <key>` | 有：`text`、`press`、`visible`、`enabled`、`position`、`requiresSelection`、`enableOnSelect`、`menu` | 其余字段：op5-039～052 not-implemented 6（`isAIOperation` 是 op5-047 no-binding 长期）；`overflowGroups`：op5-053 not-implemented 6 |
| `<nav>/@UI.LineItem › columns › <key>` | 有：同列表页 | 同列表页的 13 项：op5-054～066 not-implemented 6 |

smart-kit 多出来的属性：

| 属性 | 偏差 | 为什么 |
| --- | --- | --- |
| `path` | op5-169 kit-extension | 对象的实体路径；FE 从路由得到绑定上下文，smart-kit 没有路由 |
| `service` | op5-170 kit-extension | `SmartKitProvider` 里的服务名；FE 用 `sap.app › dataSources` |
| `create` | op5-171 kit-extension | 新建模式（实体集默认取 `entitySet` / `contextPath`，初始值）；FE 由新建路由和 `creationMode` 决定 |
| `onCreated`、`onDeleted` | op5-172、173 kit-extension | 保存新对象、删除对象后的去处；FE 由 editFlow 和路由处理，默认同 FE |
| `editable` | op5-174 kit-extension | 宿主按权限关闭"编辑"；FE 只看 `UpdateRestrictions` |
| `headerMessage` | op5-175 kit-extension | 标题下的消息条（OP-17） |
| `keyInfo` | op5-176 kit-extension | 标题栏的关键信息；FE 只能用自定义页头 Facet |
| `onRowNavigate` | op5-177 kit-extension | 子表行按下的处理，给没有 NavigationAdapter 的宿主（例如分栏） |
| `paging` | op5-178 kit-extension | 子对象页的翻页按钮；FE 由 FCL 配置决定 |
| `showAllThreshold` | op5-179 kit-extension | 子表预览的"显示全部 (x)"阈值（设计指南）；FE 没有这个链接 |
| `letterboxing` | op5-180 kit-extension | 页面限宽；FE 由 Shell 的 `appWidthLimited` 决定 |
| `className` | op5-181 kit-extension | 根元素的 CSS 类（ADR-032 规则 7） |
| `… › subSections › <key> › blocks`、`… › sections › <key> › messageStrip` | op5-183、184 kit-extension | 自定义子区块的布局块、区块顶部的消息条；FE 写在片段里 |
| `ref.showSideContent(key, show?)` | op5-182 react-idiom | FE `ExtensionAPI.showSideContent` 的实例方法 |

## 11. 未核实

阶段 5 已核实（源码，缓存在 `.cache/ui5/1.154.0/src/`）：

- `settings › share` 的结构：LR 是 `Share.ts` 的 `ShareOptions`（`teams`、`showSendEmail`、`showCollaborationManager`、`showSaveAsTile`、`showShareInWorkzone`、`print`、`exportToCSV`、`exportToSpreadsheet`、`exportToPDF`）；OP 是 `Record<string, Record<string, boolean>>`，只给 MS Teams"作为卡片"用。
- `initialLoad: 'Auto'`：标准变式的 `executeOnSelect` 为 `true`（`ListReport.view.xml` 的 `executeOnSelectionForStandardDefault`、controller 的 `_shouldAutoTriggerSearch`），所以只有默认筛选值时打开就查；`variantManagement: 'None'` 时 `Auto` 不加载。
- 网格类表格首块 `$top` = `threshold` + ⌈窗口高度 / 25⌉（`sap.ui.table` rowmodes `Auto` 的 `getMinRequestLength`；1100px 窗口是 144）。后续块 FE 按实际行数加 `threshold` 读，见 DV-lr5-122。
- 列表页 `creationMode › name` 只认 `NewPage`、`External`、`CreationDialog`、`AddViaValueHelp`，其他值回退 `NewPage`。
- `openInEditMode`：未设时按 `false`。
- `enableLazyLoading`：前 3 个之外的子区块按需显示（或由 `ObjectPageLazyLoader` 控制）。

还没核实：

- `views › paths[]` 组合视图 `defaultPath` 的默认值（只读到类型 `both` / `primary` / `secondary`；组合视图阶段 6 做，DV-lr5-036）。
- 第 9 节最后几行字段级 `sap.fe` 设置的默认值。
- 表格 `initialLoad`（积木属性）：源码里没找到读取点，见 `26b`。
