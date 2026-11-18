# 26b SAPUI5 1.154.0 的 sap.fe.macros 积木 API（核实用）

> 2026-11-17 从 SAPUI5 1.154.0 的官方 API 描述文件生成（`https://ui5.sap.com/1.154.0/test-resources/<库>/designtime/api.json`，库：sap.fe.macros、sap.fe.core、sap.fe.base、sap.fe.templates，祖先类用到 sap.ui.layout）。生成命令：`node scripts/ui5/gen-api-doc.mjs --lib fe --out docs/26b-ui5-api-fe-1.154.md`（文件缓存在 `.cache/ui5/1.154.0/`，不提交）。格式同 `26a`。
>
> - 只列公开、未废弃的成员：属性（名字:类型{允许值}=默认值，没有默认值就不写 `=`）、聚合（类型[基数]）、关联、默认聚合、事件（参数:类型）、方法（不含 ManagedObject 生成的 get/set/add/attach… 访问方法；`static` 标静态，`[祖先]` 标从哪个祖先来）。类型名去掉 `sap.` 前缀，`sap.fe.macros.` 整个去掉（`table.Column` 即 `sap.fe.macros.table.Column`）。
> - `inherited:` 一行列出从非基础祖先（例如 `sap.fe.macros.MacroAPI`、`sap.fe.macros.controls.BaseAction`、`sap.ui.layout.form.FormElement`）继承的成员；`BuildingBlock`、`BuildingBlockBase`、`BuildingBlockObjectProperty`、`Control`、`Element` 等基础类的成员不列（`scripts/ui5/ui5-model.mjs` 的 `BASE_CLASSES`）。
> - 每节标题后面是 api.json 的 `module`（导入路径）。注意 `FlexibleColumnLayoutActions` 的模块是 `sap/fe/macros/fcl/FlexibleColumnLayoutActions.block`，不是 `sap/fe/macros/FlexibleColumnLayoutActions`。
> - api.json 里很多属性的默认值是空的，实际默认值由 sap.fe 的转换器决定，见文末"实际默认值（源码）"。
> - 已废弃、不列的类：`sap.fe.macros.chart.Chart`、`sap.fe.macros.controls.BuildingBlockWithTemplating`、`sap.fe.macros.field.Field`、`sap.fe.macros.filterBar.FilterBar`、`sap.fe.macros.microchart.MicroChart`、`sap.fe.macros.table.Table`、`sap.fe.macros.table.TreeTable`。
> - 阶段 6 实现的成员（smart-kit `v4/fe/macros/*`）：Table / TreeTable 的 `rowCount`、`variantManagement`（`''` / `Control`）、`quickVariantSelection`、`actionOverflowGroups`、`massEdit`（含 `customContent`）、`analyticalConfiguration`、`enablePaste`、`enablePastingOfComputedProperties`，`creationMode` 的 `creationFields`、`createAtEnd`，`table.Column` 的 `availability`、`tooltip`、`required`、`widthIncludingColumnHeader`，`table.Action` 的 `overflowGroup`、`priority`、`isAIOperation`，方法 `get/setCurrentVariantKey`、`get/setPresentationVariant`、`get/setSelectionVariant`，分析表分组按 groupLevels 折叠；Chart 的 `personalization`（默认 true）、`ignorePersonalizationChanges`、`variantManagement`、`actionOverflowGroups`、变式键和 PV 方法；FilterBar `get/setCurrentVariantKey`；Field `semanticObject`；MicroChart 只剩 sap.fe.macros.MicroChart 的属性，画图用九个 sap.suite.ui.microchart 控件（`26a`）。还没做或不做的（`tools/ui5-alignment/deviations.json`）：树表的移动和复制（要可维护层级）、树表新建、`beforeRebindTable`、`usePropertyKeysMode`、`fromInline`、AddViaValueHelp、Form 的 `navigationPropertiesForAdaptationDialog`（RTA，D42）。

## 主要积木

```text
### sap.fe.macros.Table (class) extends sap.fe.macros.MacroAPI, module sap/fe/macros/Table
  inherited: sap.fe.macros.MacroAPI (重新声明：contextPath, metaPath)
  props: busy:boolean; condensedTableLayout:boolean; contextPath:string; disableColumnFreeze:boolean; disableCopyToClipboard:boolean; enableAutoColumnWidth:boolean=true; enableExport:boolean; enableFullScreen:boolean; enablePaste:boolean; enablePastingOfComputedProperties:boolean; enableSelectAll:boolean; exportFileName:string; exportRequestSize:int; exportSheetName:string; filterBar:string; frozenColumnCount:int; header:string; headerVisible:boolean; ignoredFields:string; ignorePersonalizationChanges:boolean=false; initialLoad:boolean; isSearchable:boolean; metaPath:string; modeForNoDataMessage:string{illustratedMessage-Auto|illustratedMessage-Base|illustratedMessage-Medium|illustratedMessage-Dot|illustratedMessage-ExtraSmall|illustratedMessage-Scene|illustratedMessage-Large|illustratedMessage-Spot|illustratedMessage-Small|text}; personalization:string; popinLayout:string{Block|GridLarge|GridSmall}; readOnly:boolean; rowCount:int; rowCountMode:string{Auto|Fixed|Interactive}; scrollThreshold:int; selectionLimit:int; selectionMode:string{None|Single|Multi|Auto|ForceMulti|ForceSingle}; threshold:int; type:string{GridTable|ResponsiveTable|AnalyticalTable}; variantManagement:string{|Control}; widthIncludingColumnHeader:boolean=false
  aggs: actionOverflowGroups:table.OverflowGroup[0..n]; actions:table.ITableActionOrGroup[0..n]; analyticalConfiguration:table.AnalyticalConfiguration[0..1]; columns:table.ITableColumn[0..n]; creationMode:table.TableCreationOptions[0..1]; massEdit:table.MassEdit[0..1]; noData:m.IllustratedMessage[0..1]; quickVariantSelection:table.QuickVariantSelection[0..1]
  defaultAgg: columns
  event beforeRebindTable: collectionBindingInfo:CollectionBindingInfo, quickFilterKey:string
  event rowPress: 
  event selectionChange: 
  methods: addAction(action), addColumn(column), addMessage(parameters), changeColumnsLabel(labelChanges), clearSelection(), getAllCurrentContexts(), getCount(), getCurrentVariantKey(), getIgnoredFields(), getPresentationVariant(), getSelectedContexts(), getSelectionVariant(), hideColumns(columnKeys, keepInPersonalisationDialog?), refresh(), removeAction(action), removeColumn(column), removeMessage(id), setCurrentVariantKey(key), setIgnoredFields(ignoredFields), setPresentationVariant(tablePV), setSelectionVariant(selectionVariant, prefillDescriptions?), showColumns(columnKeys)
### sap.fe.macros.TreeTable (class) extends sap.fe.macros.MacroAPI, module sap/fe/macros/TreeTable
  inherited: sap.fe.macros.MacroAPI (重新声明：contextPath, metaPath)
  props: busy:boolean; condensedTableLayout:boolean; contextPath:string; disableColumnFreeze:boolean; disableCopyToClipboard:boolean; disableLeafSelection:boolean; enableAutoColumnWidth:boolean=true; enableExport:boolean; enableFullScreen:boolean; enablePaste:boolean; enablePastingOfComputedProperties:boolean; enableSelectAll:boolean; exportFileName:string; exportRequestSize:int; exportSheetName:string; filterBar:string; frozenColumnCount:int; header:string; headerVisible:boolean; hierarchyQualifier:string; ignoredFields:string; ignorePersonalizationChanges:boolean=false; initialLoad:boolean; isCopyToPositionAllowed:string; isMoveToPositionAllowed:string; isNodeCopyable:string; isNodeMovable:string; isSearchable:boolean; metaPath:string; modeForNoDataMessage:string{illustratedMessage-Auto|illustratedMessage-Base|illustratedMessage-Medium|illustratedMessage-Dot|illustratedMessage-ExtraSmall|illustratedMessage-Scene|illustratedMessage-Large|illustratedMessage-Spot|illustratedMessage-Small|text}; personalization:string; popinLayout:string{Block|GridLarge|GridSmall}; readOnly:boolean; rowCount:int; rowCountMode:string{Auto|Fixed|Interactive}; scrollThreshold:int; selectionLimit:int; selectionMode:string{None|Single|Multi|Auto|ForceMulti|ForceSingle}; threshold:int; type:string{TreeTable}; variantManagement:string{|Control}; widthIncludingColumnHeader:boolean=false
  aggs: actionOverflowGroups:table.OverflowGroup[0..n]; actions:table.ITableActionOrGroup[0..n]; analyticalConfiguration:table.AnalyticalConfiguration[0..1]; columns:table.ITableColumn[0..n]; creationMode:table.TreeTableCreationOptions[0..1]; massEdit:table.MassEdit[0..1]; noData:m.IllustratedMessage[0..1]; quickVariantSelection:table.QuickVariantSelection[0..1]
  event beforeRebindTable: collectionBindingInfo:CollectionBindingInfo, quickFilterKey:string
  event rowPress: 
  event selectionChange: 
  methods: addAction(action), addColumn(column), addMessage(parameters), changeColumnsLabel(labelChanges), clearSelection(), getAllCurrentContexts(), getCount(), getCurrentVariantKey(), getIgnoredFields(), getPresentationVariant(), getSelectedContexts(), getSelectionVariant(), hideColumns(columnKeys, keepInPersonalisationDialog?), refresh(), removeAction(action), removeColumn(column), removeMessage(id), setCurrentVariantKey(key), setIgnoredFields(ignoredFields), setPresentationVariant(tablePV), setSelectionVariant(selectionVariant, prefillDescriptions?), showColumns(columnKeys)
### sap.fe.macros.FilterBar (class) extends sap.fe.macros.MacroAPI, module sap/fe/macros/FilterBar
  inherited: sap.fe.macros.MacroAPI (重新声明：contextPath, metaPath)
  props: contextPath:string; ignorePersonalizationChanges:boolean=false; liveMode:boolean=false; metaPath:string; navigationPropertiesForPersonalization:string[]=[]; showClearButton:boolean=false; showMessages:boolean=true
  aggs: filterFields:filterBar.FilterField[0..n]
  event afterClear: 
  event filterChanged: 
  event search: 
  methods: addFilterField(filterField), getActiveFiltersText(), getCurrentVariantKey(), getFilterFieldEnabled(name), getFilterFieldVisible(conditionPath), getFilters(), getSelectionVariant(), removeFilterField(filterField), setCurrentVariantKey(key), setFilterFieldEnabled(name, enabled), setFilterFieldsActive(activeChanges), setFilterFieldsLabel(labelChanges), setFilterFieldsTooltip(tooltipChanges), setFilterFieldVisible(conditionPath, visible), setFilterValues(sConditionPath, sOperator, vValues?), setSelectionVariant(selectionVariant, prefillDescriptions?), triggerSearch()
### sap.fe.macros.Field (class) extends sap.fe.macros.MacroAPI, module sap/fe/macros/Field
  inherited: sap.fe.macros.MacroAPI (重新声明：contextPath, metaPath)
  props: contextPath:string; description:string; metaPath:string; readOnly:boolean; semanticObject:string; value:string
  aggs: formatOptions:field.FieldFormatOptions[0..1]
  event change: value:boolean | number | string | undefined, isValid:boolean
  event liveChange: 
  methods: addMessage(parameters), getEnabled(), getMainPropertyAbsolutePath(), getMessageManager(), getValue(), removeMessage(id), setEnabled(enabled), setValue(value)
### sap.fe.macros.Form (class) extends sap.fe.macros.MacroAPI, module sap/fe/macros/Form
  inherited: sap.fe.macros.MacroAPI (重新声明：contextPath, metaPath)
  props: contextPath:string; metaPath:string; navigationPropertiesForAdaptationDialog:string[]; title:string; visible:boolean
  aggs: layout:form.FormLayoutOptions[0..1]
### sap.fe.macros.FormElement (class) extends sap.ui.layout.form.FormElement, module sap/fe/macros/FormElement
  inherited: sap.ui.layout.form.FormElement (label；重新声明：visible, fields)
  props: anchor:string; contextPath:string; label:string; metaPath:string; placement:string{After|Before}; visible:boolean=true
  aggs: fields:core.Control[0..n]; label:core.Label[0..1]
  defaultAgg: fields
  methods: getLabelControl() [FormElement], isVisible() [FormElement]
### sap.fe.macros.Chart (class) extends sap.fe.macros.MacroAPI, module sap/fe/macros/Chart
  inherited: sap.fe.macros.MacroAPI (重新声明：contextPath, metaPath)
  props: contextPath:string; header:string; headerVisible:boolean=true; ignorePersonalizationChanges:boolean=false; metaPath:string; personalization:string=true; selectionMode:string{None|Single|Multiple}="Multiple"; variantManagement:string{|Control}
  aggs: actionOverflowGroups:chart.OverflowGroup[0..n]; actions:chart.Action[0..n]
  assocs: filterBar:core.Control
  event selectionChange: data:any[], selected:boolean
  methods: getCurrentVariantKey(), getPresentationVariant(), getSelectedContexts(), getSelectionVariant(), setCurrentVariantKey(key), setPresentationVariant(presentationVariant), setSelectionVariant(selectionVariant, prefillDescriptions?)
### sap.fe.macros.MicroChart (class) extends sap.fe.core.buildingBlocks.BuildingBlock, module sap/fe/macros/MicroChart
  props: contextPath:string; hideOnNoData:boolean; linkAriaText:string; metaPath:string; showOnlyChart:boolean="false"; size:string{XS|S|M|L}; titleAsLink:boolean
  event titlePress: 
### sap.fe.macros.VariantManagement (class) extends sap.fe.core.buildingBlocks.BuildingBlock, module sap/fe/macros/VariantManagement
  props: headerLevel:string; id:any; showSetAsDefault:boolean=true
  assocs: for:core.Control
### sap.fe.macros.MessageButton (class) extends sap.fe.core.buildingBlocks.BuildingBlock, module sap/fe/macros/MessageButton
  event visibilityChange: visible:boolean
### sap.fe.macros.Share (class) extends sap.fe.core.buildingBlocks.BuildingBlock, module sap/fe/macros/Share
  aggs: shareOptions:share.ShareOptions[0..1]
  defaultAgg: shareOptions
### sap.fe.macros.KPITag (class) extends sap.fe.core.buildingBlocks.BuildingBlock, module sap/fe/macros/KPITag
  props: number:string; showIcon:boolean="false"; status:string{Success|Error|Warning|None|Information}="None"; text:string; tooltip:string; unit:string
  event press: 
### sap.fe.macros.Paginator (class) extends sap.fe.core.buildingBlocks.BuildingBlock, module sap/fe/macros/Paginator
  props: ariaTitle:string
### sap.fe.macros.MultiValueField (class) extends sap.fe.core.buildingBlocks.BuildingBlock, module sap/fe/macros/MultiValueField
  props: contextPath:string; items:object; metaPath:string; readOnly:boolean
### sap.fe.macros.Status (class) extends sap.fe.core.buildingBlocks.BuildingBlock, module sap/fe/macros/Status
  props: colorPalette:string{Standard|Pastel}="Standard"; contextPath:string; inverted:boolean="false"; largeDesign:boolean="false"; metaPath:string; reactiveAreaMode:string{Inline|Overlay}="Inline"
  event press: 
### sap.fe.macros.FlexibleColumnLayoutActions (class) extends sap.ui.core.Control, module sap/fe/macros/fcl/FlexibleColumnLayoutActions.block
```

## MacroAPI 和辅助类

```text
### sap.fe.macros.MacroAPI (class) extends sap.fe.core.buildingBlocks.BuildingBlock, module sap/fe/macros/MacroAPI
  props: contextPath:string; metaPath:string
### sap.fe.macros.CollectionBindingInfo (class) extends , module sap/fe/macros/CollectionBindingInfo
  methods: addFilter(customFilter), addSelect(parameters), addSorter(sorter), attachEvent(eventId, callback, listener?, data?), getBindingInfo(), getFilters(), getSorters()
### sap.fe.macros.CollectionBindingInfo.SerializedCollectionBindingInfo (typedef), module sap/fe/macros/CollectionBindingInfo
  props: (none listed in api.json)
```

## sap.fe.macros.table.*

```text
### sap.fe.macros.table.Action (class) extends sap.fe.macros.controls.BaseAction, module sap/fe/macros/table/Action
  inherited: sap.fe.macros.controls.BaseAction (anchor, group, isAIOperation, key, overflowGroup, placement, priority, text；重新声明：enabled, requiresSelection, visible)
  props: command:string; enabled:boolean; enableOnSelect:string{multi|single}; requiresSelection:boolean; visible:boolean; anchor:string; group:int; isAIOperation:boolean=false; key:string; overflowGroup:int; placement:string{After|Before}; priority:string; text:string
  event press: 
### sap.fe.macros.table.ActionGroup (class) extends sap.fe.macros.controls.BuildingBlockObjectProperty, module sap/fe/macros/table/ActionGroup
  props: anchor:string; defaultAction:string; key:string; overflowGroup:int; placement:string{After|Before}; priority:string; text:string
  aggs: actions:table.ITableAction[0..n]
  defaultAgg: actions
### sap.fe.macros.table.ActionGroupOverride (class) extends sap.fe.macros.controls.BuildingBlockObjectProperty, module sap/fe/macros/table/ActionGroupOverride
  props: anchor:string; key:string; placement:string{After|Before}
  aggs: actions:table.ITableAction[0..n]
  defaultAgg: actions
### sap.fe.macros.table.ActionOverride (class) extends sap.fe.macros.controls.BuildingBlockObjectProperty, module sap/fe/macros/table/ActionOverride
  props: anchor:string; command:string; defaultValuesFunction:string; disableStrictHandling:boolean; enableAutoScroll:boolean; enabled:boolean; enableOnSelect:string{multi|single}; isAIOperation:boolean=false; key:string; navigateToInstance:boolean; placement:string{After|Before}; visible:boolean
### sap.fe.macros.table.AnalyticalConfiguration (class) extends sap.fe.macros.controls.BuildingBlockObjectProperty, module sap/fe/macros/table/AnalyticalConfiguration
  props: aggregationOnLeafLevel:boolean=false
### sap.fe.macros.table.Column (class) extends sap.fe.macros.controls.BuildingBlockObjectProperty, module sap/fe/macros/table/Column
  props: anchor:string; availability:string; disableExport:boolean; header:string; horizontalAlign:string; importance:string; key:string; placement:string{After|Before}; properties:string[]; required:boolean; tooltip:string; width:string; widthIncludingColumnHeader:boolean
  aggs: aiNotice:table.ColumnAINotice[0..1]; exportSettings:table.ColumnExportSettings[0..1]
### sap.fe.macros.table.ColumnAINotice (class) extends sap.fe.macros.controls.BuildingBlockObjectProperty, module sap/fe/macros/table/ColumnAINotice
  aggs: content:core.Control[0..1]
  defaultAgg: content
### sap.fe.macros.table.ColumnExportSettings (class) extends sap.fe.macros.controls.BuildingBlockObjectProperty, module sap/fe/macros/table/ColumnExportSettings
  props: falseValue:string; inputFormat:string; label:string; property:string[]; template:string; textAlign:string; trueValue:string; type:string; valueMap:object; width:int; wrap:boolean
### sap.fe.macros.table.ColumnOverride (class) extends sap.fe.macros.controls.BuildingBlockObjectProperty, module sap/fe/macros/table/ColumnOverride
  props: availability:string; disableExport:boolean; horizontalAlign:string; importance:string; key:string; mergeCells:boolean; mergeComparisonProperties:string[]; width:string; widthIncludingColumnHeader:boolean
  aggs: aiNotice:table.ColumnAINotice[0..1]; exportSettings:table.ColumnExportSettings[0..1]; formatOptions:field.FieldFormatOptions[0..1]
### sap.fe.macros.table.ITableAction (interface), module sap/fe/macros/table/ITableAction
### sap.fe.macros.table.ITableActionOrGroup (interface), module sap/fe/macros/table/ITableActionOrGroup
### sap.fe.macros.table.ITableColumn (interface), module sap/fe/macros/table/ITableColumn
### sap.fe.macros.table.MassEdit (class) extends sap.fe.macros.controls.BuildingBlockObjectProperty, module sap/fe/macros/table/MassEdit
  props: ignoredFields:string[]; operationGroupingMode:string{ChangeSet|Isolated}; visibleFields:string[]
  aggs: customContent:layout.form.FormContainer[0..1]
  defaultAgg: customContent
### sap.fe.macros.table.OverflowGroup (class) extends sap.fe.macros.controls.BuildingBlockObjectProperty, module sap/fe/macros/table/OverflowGroups
  props: overflowGroup:int; showSeparator:boolean
### sap.fe.macros.table.QuickVariantSelection (class) extends sap.fe.macros.controls.BuildingBlockObjectProperty, module sap/fe/macros/table/QuickVariantSelection
  props: paths:string[]; showCounts:boolean="false"
### sap.fe.macros.table.TableCreationOptions (class) extends sap.fe.macros.controls.BuildingBlockObjectProperty, module sap/fe/macros/table/TableCreationOptions
  props: createAtEnd:boolean; creationFields:string; inlineCreationRowsHiddenInEditMode:boolean; name:string{AddViaValueHelp|CreationDialog|External|Inline|InlineCreationRows|NewPage}; outbound:string
### sap.fe.macros.table.TreeTableCreationOptions (class) extends sap.fe.macros.controls.BuildingBlockObjectProperty, module sap/fe/macros/table/TreeTableCreationOptions
  props: createInPlace:boolean; creationFields:string; isCreateEnabled:string; name:string{CreationDialog|Inline|NewPage}; nodeType:object{propertyName?: string;|values?: { key: string; label: string; creationFields?: string }[];}
```

## sap.fe.macros.chart.*

```text
### sap.fe.macros.chart.Action (class) extends sap.fe.macros.controls.BaseAction, module sap/fe/macros/chart/Action
  inherited: sap.fe.macros.controls.BaseAction (anchor, enabled, group, isAIOperation, key, overflowGroup, placement, priority, text, visible；重新声明：requiresSelection)
  props: press:string; requiresSelection:boolean; anchor:string; enabled:boolean; group:int; isAIOperation:boolean=false; key:string; overflowGroup:int; placement:string{After|Before}; priority:string; text:string; visible:boolean
### sap.fe.macros.chart.ActionGroup (class) extends sap.fe.macros.chart.Action, module sap/fe/macros/chart/ActionGroup
  inherited: sap.fe.macros.chart.Action (press, requiresSelection); sap.fe.macros.controls.BaseAction (enabled, group, isAIOperation, priority, visible；重新声明：anchor, key, overflowGroup, placement, requiresSelection, text)
  props: anchor:string; key:string; overflowGroup:int; placement:string{After|Before}; text:string; press:string; requiresSelection:boolean; enabled:boolean; group:int; isAIOperation:boolean=false; priority:string; visible:boolean
  aggs: actions:chart.Action[0..n]
  defaultAgg: actions
### sap.fe.macros.chart.OverflowGroup (class) extends sap.fe.macros.controls.BuildingBlockObjectProperty, module sap/fe/macros/chart/OverflowGroup
  props: overflowGroup:int; showSeparator:boolean
```

## sap.fe.macros.filterBar.*

```text
### sap.fe.macros.filterBar.FilterField (class) extends sap.fe.macros.controls.BuildingBlockObjectProperty, module sap/fe/macros/filterBar/FilterField
  props: anchor:string; availability:string; key:string; label:string; placement:string{After|Before}; property:string; required:boolean
### sap.fe.macros.filterBar.FilterFieldOverride (class) extends sap.fe.macros.controls.BuildingBlockObjectProperty, module sap/fe/macros/filterBar/FilterFieldOverride
  props: anchor:string; availability:string; key:string; placement:string{After|Before}; required:boolean
```

## sap.fe.macros.field.*

```text
### sap.fe.macros.field.FieldFormatOptions (class) extends sap.fe.macros.controls.BuildingBlockObjectProperty, module sap/fe/macros/field/FieldFormatOptions
  props: dateTimePattern:string; dateTimeStyle:string{short|medium|long|full}; disableIntegerGrouping:boolean; displayMode:string{Description|DescriptionValue|Value|ValueDescription}; enableEnlargeImage:boolean; fieldEditStyle:string{RadioButtons|}; hasSituationsIndicator:boolean; imageFitType:string{Cover|Contain}; measureDisplayMode:string{Hidden|ReadOnly}; radioButtonsHorizontalLayout:boolean; reactiveAreaMode:string{Inline|Overlay}; showDate:boolean; showTime:boolean; showTimezone:boolean; textExpandBehaviorDisplay:string{InPlace|Popover}; textLinesEdit:int; textMaxCharactersDisplay:int; textMaxLength:int; textMaxLines:int
### sap.fe.macros.field.mixin.FieldMixin (class) extends , module sap/fe/macros/field/mixin/FieldMixin
  methods: addMessage(parameters), getEnabled(), getMessageManager(), getValue(), removeMessage(id), setEnabled(enabled), setValue(value)
```

## sap.fe.macros.form.*

```text
### sap.fe.macros.form.FormLayoutOptions (class) extends sap.fe.macros.controls.BuildingBlockObjectProperty, module sap/fe/macros/form/FormLayoutOptions
  props: adjustLabelSpan:boolean; backgroundDesign:string; breakpointL:int; breakpointM:int; breakpointXL:int; columnsL:int; columnsM:int; columnsXL:int; emptyCellsLarge:int; emptySpanL:int; emptySpanM:int; emptySpanS:int; emptySpanXL:int; labelCellsLarge:int; labelSpanL:int; labelSpanM:int; labelSpanS:int; labelSpanXL:int; singleContainerFullSize:boolean; type:string{ColumnLayout|ResponsiveGridLayout}
```

## sap.fe.macros.share.*

```text
### sap.fe.macros.share.ShareOptions (class) extends sap.fe.macros.controls.BuildingBlockObjectProperty, module sap/fe/macros/share/ShareOptions
  props: showShareInWorkzone:boolean
```

## sap.fe.macros.controls.*

```text
### sap.fe.macros.controls.BaseAction (class) extends sap.fe.macros.controls.BuildingBlockObjectProperty, module sap/fe/macros/controls/BaseAction
  props: anchor:string; enabled:boolean; group:int; isAIOperation:boolean=false; key:string; overflowGroup:int; placement:string{After|Before}; priority:string; requiresSelection:boolean; text:string; visible:boolean
### sap.fe.macros.controls.BuildingBlockObjectProperty (class) extends sap.fe.base.BuildingBlockBase, module sap/fe/macros/controls/BuildingBlockObjectProperty
### sap.fe.macros.controls.section.ISingleSectionContributor (interface), module sap/fe/macros/controls/section/ISingleSectionContributor
  methods: getDataFromProvider(sectionLevel?), getSectionContentRole(), sendDataToConsumer(consumerData)
### sap.fe.macros.controls.section.ISingleSectionContributor.ConsumerData (typedef), module sap/fe/macros/controls/section/ISingleSectionContributor
  props: title:string
### sap.fe.macros.controls.section.ISingleSectionContributor.ProviderData (typedef), module sap/fe/macros/controls/section/ISingleSectionContributor
  props: title:string
### sap.fe.macros.controls.section.ISingleSectionContributor.SectionLevel (typedef), module sap/fe/macros/controls/section/ISingleSectionContributor
  props: (none listed in api.json)
```

## sap.fe.macros 的其他积木（不在阶段 0 的清单里，列出备查）

```text
### sap.fe.macros.AINotice (class) extends sap.fe.controls.AINotice, module sap/fe/macros/AINotice
  (ancestor sap.fe.controls.AINotice not in the cached api.json files)
  aggs: popoverContent:core.Control[0..n]
  defaultAgg: popoverContent
### sap.fe.macros.AlwaysEditableField (class) extends sap.fe.macros.MacroAPI, module sap/fe/macros/AlwaysEditableField
  inherited: sap.fe.macros.MacroAPI (重新声明：contextPath, metaPath)
  props: contextPath:string; description:string; metaPath:string; value:string; vhIdPrefix:string
  aggs: formatOptions:field.FieldFormatOptions[0..1]
  event change: value:boolean | number | string | undefined, isValid:boolean
  event liveChange: 
  methods: addMessage(parameters), getEnabled(), getMessageManager(), getValue(), removeMessage(id), setEnabled(enabled), setValue(value)
### sap.fe.macros.CollaborativeDraftHandler (class) extends sap.fe.core.buildingBlocks.BuildingBlock, module sap/fe/macros/CollaborativeDraftHandler
  props: contextPath:string; metaPath:string; showAvatar:boolean=false
  event avatarPress: lockingUserID:string, lockingUserName:string, lockingUserInitials:string, lockingUserColor:string
  event lockChange: isLocked:boolean, lockingUserID:string, lockingUserName:string, lockingUserInitials:string, lockingUserColor:string
### sap.fe.macros.ConditionalSwitch (class) extends sap.fe.base.BuildingBlockBase, module sap/fe/macros/ConditionalSwitch
  props: factory:function
### sap.fe.macros.ConditionalSwitchProperty (class) extends sap.ui.core.Element, module sap/fe/macros/ConditionalSwitchProperty
  props: key:string; value:any
  event valueChanged: 
### sap.fe.macros.Page (class) extends sap.fe.core.buildingBlocks.BuildingBlock, module sap/fe/macros/Page
  props: avatarImageFitType:string{Cover|Contain}; avatarSrc:string; description:string; showFooter:boolean; title:string
  aggs: actions:core.Control[0..n]; breadcrumbs:core.Control[0..1]; footer:core.Control[0..1]; headerContent:core.Control[0..n]; items:core.Control[0..n]; navigationActions:core.Control[0..n]; titleContent:core.Control[0..n]
  assocs: stickySubheaderProvider:core.Control
  defaultAgg: items
### sap.fe.macros.RichTextEditor (class) extends sap.fe.core.buildingBlocks.BuildingBlock, module sap/fe/macros/RichTextEditor
  props: displayType:string{formattedText|richTextEditor}; excludeDefaultPlugins:boolean="false"; height:core.CSSSize; readOnly:boolean; required:boolean="false"; value:string
  aggs: buttonGroups:richtexteditor.ButtonGroup[0..n]; plugins:richtexteditor.Plugin[0..n]
### sap.fe.macros.RichTextEditorWithMetadata (class) extends sap.fe.macros.RichTextEditor, module sap/fe/macros/RichTextEditorWithMetadata
  inherited: sap.fe.macros.RichTextEditor (displayType, excludeDefaultPlugins, height, readOnly, required, value, buttonGroups, plugins)
  props: contextPath:string; metaPath:string; displayType:string{formattedText|richTextEditor}; excludeDefaultPlugins:boolean="false"; height:core.CSSSize; readOnly:boolean; required:boolean="false"; value:string
  aggs: buttonGroups:richtexteditor.ButtonGroup[0..n]; plugins:richtexteditor.Plugin[0..n]
### sap.fe.macros.richtexteditor.ButtonGroup (class) extends sap.ui.core.Element, module sap/fe/macros/richtexteditor/ButtonGroup
  props: buttons:string; name:string; priority:int; visible:boolean
### sap.fe.macros.richtexteditor.Plugin (class) extends sap.ui.core.Element, module sap/fe/macros/richtexteditor/Plugin
  props: name:string
```

## sap.fe.core 的枚举和 manifest typedef（library 模块、converters/ManifestSettings）

```text
### sap.fe.core.ContextNavigationType (enum), module sap/fe/core/library
  values: External, Internal, None
### sap.fe.core.InitialLoadMode (enum), module sap/fe/core/library
  values: Auto, Disabled, Enabled
### sap.fe.core.converters.ManifestSettings.AiConfiguration (typedef), module sap/fe/core/converters/ManifestSettings
  props: smartSummarization.visibility?:fe.core.converters.ManifestSettings.SmartSummarizationVisibility
### sap.fe.core.converters.ManifestSettings.ManifestSettingsSapFE (typedef), module sap/fe/core/converters/ManifestSettings
  props: app.aiConfiguration?:fe.core.converters.ManifestSettings.AiConfiguration; app.enableLazyLoading?:boolean; app.enableSaveAndLeave?:boolean
### sap.fe.core.converters.ManifestSettings.SmartSummarizationVisibility (typedef), module sap/fe/core/converters/ManifestSettings
  props: (none listed in api.json)
```

## 实际默认值（源码）

api.json 没写默认值、但影响行为的属性，按 sap.fe 1.154.0 的 TypeScript 源码（`https://ui5.sap.com/1.154.0/resources/sap/fe/<模块>.ts`，缓存在 `.cache/ui5/1.154.0/src/`）核对。积木单独使用时，`createTableDefinition`（`macros/table/TableDefinition`）把积木属性当作 manifest 的 `tableSettings` 交给同一个转换器，所以积木和模板的默认值来自同一处；模板类型（列表页 / 对象页 / 自由页面）会改变其中一些默认值。来源模块省略 `sap/fe/` 前缀。

### sap.fe.macros.Table

| 属性 | 实际默认值 | 来源模块 |
| --- | --- | --- |
| `type` | 未设：实体支持分析（ApplySupported 含 filter、identity、orderby、skip、top、groupby、aggregate、concat）→ `AnalyticalTable`；有成对的 RecursiveHierarchy / Aggregation 限定符 → `TreeTable`；否则 `ResponsiveTable`。非法值回退 `ResponsiveTable` | core/converters/controls/Common/Table (getTableType) |
| `selectionMode` | 未设或 `Auto`：有删除、批量编辑、剪切或需要选择的操作时 `Multi`，否则 `None`（对象页只在编辑态）；`ForceMulti`→`Multi`，`ForceSingle`→`Single`；`None` 遇到删除按钮仍为 `Multi`；最终空值按 `None` | core/converters/controls/Common/Table (getSelectionMode)；macros/table/MdcTableTemplate |
| `enableExport` | 未设：`true`；对象页上等于 `enablePaste`（对象页 `enablePaste` 默认 `true`） | core/converters/controls/Common/Table (_getEnableExport) |
| `enablePaste` | 未设：对象页 `true`；列表页只有草稿树表 `true`；其他 `false` | core/converters/controls/Common/Table (getTableManifestConfiguration) |
| `header` | 未设：目标实体类型的 `UI.HeaderInfo/TypeNamePlural` | core/converters/controls/Common/Table (getTableAnnotationConfiguration)；macros/table/MdcTableTemplate |
| `headerVisible` | `true`；quickVariantSelection 有 `hideTableTitle` 且有快速筛选时 `false` | core/converters/controls/Common/Table (getFilterConfiguration)；macros/table/MdcTableTemplate |
| `initialLoad` | 文档默认 `false`；源码里没找到读取点。MDC 表格 `autoBindOnInit` = 用基本搜索或没有关联筛选栏，即有 `filterBar` 时等筛选栏的搜索（未核实） | macros/Table；macros/table/MdcTableTemplate |
| `personalization` | 未设：`Sort, Column`；列表页只有 Control 级变式管理或隐藏筛选栏时加 `Filter`，其他页面都加 `Filter`；ResponsiveTable 加 `Group`；AnalyticalTable 加 `Group, Aggregate` | core/converters/controls/Common/Table (getP13nMode) |
| `variantManagement` | 未设：页面的变式管理（列表页模板默认 `Page`，对象页 `None`，自由页面 `None`）；`Control` 但没有个性化 → `None` | core/converters/controls/Common/Table；templates/ListComponent；templates/ObjectPage/Component |
| `threshold` | 未设：PresentationVariant `MaxItems`；否则 TreeTable 200，GridTable / AnalyticalTable 100，其他 30（导航属性表格 10） | core/converters/controls/Common/Table (getThreshold)；macros/Table |
| `scrollThreshold` | 非 ResponsiveTable 300；ResponsiveTable 不设 | core/converters/controls/Common/Table |
| `popinLayout` | ResponsiveTable：manifest `sap.fe › macros › table › defaultPopinLayout`，再没有则 `Block` | core/converters/controls/Common/Table |
| `rowCountMode / rowCount` | 只对非 ResponsiveTable：列表页 `Auto` / 3；其他页面 `Fixed`，行数 GridTable 5、TreeTable / AnalyticalTable 10（rowCountMode=Auto 时 3） | core/converters/controls/Common/Table (_getTableMode) |
| `selectionLimit` | 200；`enableSelectAll=true` 或 `selectionLimit=0` 时 0（不限） | core/converters/controls/Common/Table (_getTableSelectionLimit) |
| `enableSelectAll` | ResponsiveTable 的 multiSelectMode：未设 → `Default`（`false` → `ClearAll`）；对象页用 IconTabBar 时未设 → `ClearAll` | core/converters/controls/Common/Table (_getMultiSelectMode) |
| `enableFullScreen` | 未设：只在手机上 `true`；列表页非手机强制 `false` | core/converters/controls/Common/Table (_getFullScreenBasedOnDevice) |
| `creationMode.name` | 未设：`NewPage`（`sap.fe › macros › table › defaultCreationMode` 为 `InlineCreationRows` 时用它）；对象页没有子页面路由时改为 `Inline`；`createAtEnd` 默认 Inline / CreationDialog 为 `false`，其他 `true` | core/converters/controls/Common/Table (getTableManifestConfiguration, _getCreationBehaviour)；macros/table/TableDefinition |
| `isSearchable` | 未设：平表看 `Capabilities.SearchRestrictions/Searchable`；分析表、树表看 ApplySupported 是否含 `search` | core/converters/controls/Common/Table (getTableAnnotationConfiguration) |
| `readOnly` | 未设：显示模式或 manifest `readOnly=true` 时 `true`；AnalyticalTable 在 `aggregationOnLeafLevel` 时 `true` | core/converters/controls/Common/Table；macros/Table |
| `modeForNoDataMessage` | 列表页 `illustratedMessage-Auto`；对象页 `illustratedMessage-ExtraSmall`（`useTextForNoDataMessages` 时 `text`）；积木回退 `illustratedMessage-Auto` | core/converters/controls/Common/Table；macros/Table (getNoDataMessageMode) |
| `condensedTableLayout` | `false`；只对非 ResponsiveTable 且内容密度允许时生效 | core/converters/controls/Common/Table (_getCondensedTableLayout) |
| `enableAutoColumnWidth` | 非手机 `true` | core/converters/controls/Common/Table |
| `disableColumnFreeze / frozenColumnCount` | 列冻结默认可用；冻结列数不设 | core/converters/controls/Common/Table |
| `busy、exportRequestSize、exportFileName、exportSheetName` | 未设时原样不传（未核实下游默认） | core/converters/controls/Common/Table |

### sap.fe.macros.TreeTable

| 属性 | 实际默认值 | 来源模块 |
| --- | --- | --- |
| `type` | `TreeTable`（唯一取值） | macros/TreeTable |
| `hierarchyQualifier` | 必填（RecursiveHierarchy 限定符） | macros/TreeTable |
| `selectionMode` | 未设：`Multi` | core/converters/controls/Common/Table (getSelectionMode) |
| `threshold` | 200（有 `MaxItems` 时用它） | core/converters/controls/Common/Table (getThreshold) |
| `rowCountMode / rowCount` | 列表页 `Auto` / 3；其他 `Fixed` / 10 | core/converters/controls/Common/Table (_getTableMode) |
| `enablePaste` | 草稿根实体的列表页 `true`；对象页 `true`；粘贴按钮在树表上不显示 | core/converters/controls/Common/Table；macros/table/MdcTableTemplate |
| `isSearchable` | 看 ApplySupported 是否含 `search` | core/converters/controls/Common/Table |
| `其他` | 同 `Table` |  |

### sap.fe.macros.FilterBar

| 属性 | 实际默认值 | 来源模块 |
| --- | --- | --- |
| `liveMode` | `false` | macros/FilterBar |
| `showClearButton` | `false` | macros/FilterBar；core/converters/templates/ListReportConverter |
| `showMessages` | 积木 `true`；列表页模板里固定写 `false` | macros/FilterBar；templates/ListReport/ListReport.view.xml |
| `navigationPropertiesForPersonalization` | `[]` | macros/FilterBar |
| `useSemanticDateRange（非公开）` | `true` | macros/FilterBar；core/converters/templates/ListReportConverter |
| `initialLayout（非公开）` | `compact` | macros/FilterBar |
| `p13nMode（非公开）` | `Item, Value` | macros/FilterBar |

### sap.fe.macros.Field

| 属性 | 实际默认值 | 来源模块 |
| --- | --- | --- |
| `readOnly` | 未设：由编辑状态和注解（`Core.Computed`、`Core.Immutable`、`Common.FieldControl`）推导（未核实细节） | macros/Field |
| `formatOptions` | 未设：显示方式按 `Common.Text` + `UI.TextArrangement`（未核实细节） | macros/field/FieldFormatOptions |
| `value / description` | 未设：由 `metaPath` 指向的属性和它的 `Common.Text` 绑定 | macros/Field |

### sap.fe.macros.Form

| 属性 | 实际默认值 | 来源模块 |
| --- | --- | --- |
| `layout` | 未设：`ColumnLayout`，`columnsM=3`、`columnsL=4`、`columnsXL=6`、`labelCellsLarge=12`；manifest 的 `controlConfiguration › <facet> › layout` 或 `sections › <facet> › layout` 优先 | macros/Form (getLayoutInformation) |
| `visible` | `true` | macros/Form |
| `title` | 未设：取 facet 的 `Label`（未核实） | macros/Form |
| `navigationPropertiesForAdaptationDialog` | 未设（未核实） | macros/Form |

### sap.fe.macros.Chart

| 属性 | 实际默认值 | 来源模块 |
| --- | --- | --- |
| `selectionMode` | `Multiple` | macros/Chart |
| `headerVisible` | `true` | macros/Chart |
| `personalization` | 积木 `true`；模板里未设时 `Sort,Type,Item`，Control 级变式管理时加 `Filter` | macros/Chart；core/converters/controls/Common/Chart (getP13nMode) |
| `variantManagement` | 模板里取页面的变式管理（没有个性化时 `None`）；积木单独使用时未核实 | core/converters/controls/Common/Chart |
| `header` | 未设：模板里取 manifest `chartSettings.header`，否则未核实（应为 `UI.Chart/Title`） | core/converters/controls/Common/Chart |

### sap.fe.macros.VariantManagement

| 属性 | 实际默认值 | 来源模块 |
| --- | --- | --- |
| `showSetAsDefault` | `true` | macros/VariantManagement |
| `headerLevel` | 未设：原样传给 sap.ui.fl 的 VariantManagement（其默认值未核实） | macros/VariantManagement |
