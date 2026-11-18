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
| `settings › share` | object（LR：`ShareOptions`；OP：`Record<string, Record<string, boolean>>`） | — | 运行时（`controllerextensions/Share`，未下载核对） |
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

## 10. smart-kit 现在的对应属性

阶段 5 的输入。读的是 `packages/react/src/templates/SmartListReport.tsx` 和 `SmartObjectPage.tsx` 现在的属性；"差别"一列只记默认值或取值不同的地方。

### 10.1 `SmartListReport`

| smart-kit 属性 | manifest 设置 | 差别 |
| --- | --- | --- |
| `entitySet` | `settings › entitySet`（或 `contextPath`） | |
| `service` | 无对应（FE 用 `sap.app › dataSources` 和路由的模型） | |
| `pageKey` | 无对应（FE 用视图 id 和 flex 持久化） | |
| `liveMode` | `settings › liveMode` | smart-kit 默认 `true`，FE 默认 `false` |
| `autoExecute` | `settings › initialLoad` | smart-kit 是 boolean，默认 `true`；FE 是 `Auto` / `Enabled` / `Disabled`，默认 `Auto` |
| `title` | 无对应（FE 取 `sap.app › title` / `UI.HeaderInfo`） | |
| `headerActions` | `settings › content › header › actions` | smart-kit 传 React 节点，FE 是 `ManifestAction` 记录 |
| `filterExtend` | `controlConfiguration › @UI.SelectionFields › filterFields` | |
| `tableExtend` | `controlConfiguration › @UI.LineItem › columns` 和 `actions` | |
| `onRowNavigate` | `settings › navigation › <set> › detail`、`tableSettings › rowPress` | |
| `beforeTable` | 无对应（近似 `content › header › customHeader` 或 `keyPerformanceIndicators`） | |
| `filterToggle` | 无对应 | |
| `className` | 无对应 | |
| `views` | `settings › views › paths[]` | smart-kit 自动收集带限定符的 SPV，用 `mode: switch / tabs` 选样式；FE 由 `paths` 列出视图，没有样式开关 |
| `contents` | `settings › views › paths[]`（带 `entitySet` / `contextPath` 的视图） | |
| `tableType` | `controlConfiguration › @UI.LineItem › tableSettings › type` | smart-kit 取值 `grid` / `responsive` / `auto` 和 UI5 名；FE 未设时按注解自动判断（分析表、树表），没有 `auto`（按宽度） |
| `hierarchyQualifier` | `tableSettings › hierarchyQualifier` | |
| `chart` | `settings › views › paths[]` 的组合视图（`primary` / `secondary`） | |
| `workingMode` | 无对应 | |
| `actionGroups` | `controlConfiguration › @UI.LineItem › actions › <key> › menu` | |
| `share` | `settings › share` | |
| `onRowsChange` | 无对应 | |
| `refreshToken` | 无对应 | |
| `exportable` | `tableSettings › enableExport` | 默认都是 `true` |
| `onBeforeExport`、`onExported` | 无对应（FE 是控制器扩展 `onBeforeExport`） | |
| `canSaveVariants` | 无对应（近似 `variantManagement`） | |
| 无 | `settings › variantManagement`（LR 默认 `Page`） | smart-kit 没有这个开关 |
| 无 | `tableSettings › selectionMode`、`creationMode`、`personalization`、`quickVariantSelection`、`hideFilterBar`、`defaultTemplateAnnotationPath`、筛选栏 `layout` / `useSemanticDateRange` / `showClearButton` 等 | smart-kit 没有对应属性 |

### 10.2 `SmartObjectPage`

| smart-kit 属性 | manifest 设置 | 差别 |
| --- | --- | --- |
| `path` | 无对应（FE 从路由得到上下文） | |
| `service` | 无对应 | |
| `navigation` | `settings › sectionLayout` | smart-kit `anchor` / `tabs`，默认 `anchor`；FE `Page` / `Tabs`，默认 `Page`（默认一致，取值名不同） |
| `headerActions` | `settings › content › header › actions` | 节点 vs `ManifestAction` |
| `headerMessage` | 无对应 | |
| `sectionExtend` | `settings › content › body › sections`（及 `subSections`） | |
| `tableExtend` | `controlConfiguration › <nav>/@UI.LineItem › columns` 和 `actions` | |
| `extraSelect` | `settings › additionalProperties` | |
| `onRowNavigate` | `settings › navigation › <nav> › detail` | |
| `className` | 无对应 | |
| `create` | 无对应（FE 由路由和 `creationMode` 决定） | |
| `onCreated`、`onDeleted` | 无对应（FE 是控制器扩展 / editFlow） | |
| `editable` | 无对应（FE 按 `UpdateRestrictions`；`openInEditMode` 是打开即编辑，不是一回事） | |
| `subObjectCreate` | `controlConfiguration › <nav>/@UI.LineItem › tableSettings › creationMode › name` | smart-kit `inline` / `dialog` / `none`；FE `Inline` / `CreationDialog` / `NewPage` …，默认 `NewPage`（没有路由时 `Inline`） |
| `keyInfo` | 无对应（近似页眉 facets） | |
| `sideContent`、`sideContentTitle` | `… › subSections › <key> › sideContent` | FE 挂在子区块上，smart-kit 挂在页面上 |
| `paging` | 无对应（FE 用 `sap.fe.macros.Paginator`） | |
| `showAllThreshold` | 无对应（近似 `tableSettings › threshold`） | |
| `letterboxing` | 无对应（FE 由 Shell 决定） | |
| `partialHeaderEdit` | `settings › editableHeaderContent` | 默认都是 `true`；FE 是编辑态在页眉区块里直接编辑，smart-kit 是对话框 |
| `share` | `settings › share` | |
| 无 | `content › header › anchorBarVisible`、`content › header › visible`、`enableLazyLoading`、`openInEditMode`、`showRelatedApps`、`useTextForNoDataMessages`、`variantManagement`、`content › footer › actions` | smart-kit 没有对应属性 |

## 11. 未核实

- `views › paths[]` 组合视图 `defaultPath` 的默认值（只读到类型 `both` / `primary` / `secondary`）。
- `settings › share` 两种结构的具体字段（读取方在 `controllerextensions/Share`，没下载）。
- 第 9 节最后几行字段级 `sap.fe` 设置的默认值。
- 表格 `initialLoad`（积木属性）：源码里没找到读取点，见 `26b`。
