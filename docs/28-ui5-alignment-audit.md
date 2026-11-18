# 28 已有组件与 SAPUI5 1.154 API 的对照

> 状态：待用户决定 · 2026-11-17（讨论记录 D32）。事件参数名抽查过 api.json（DynamicPageTitle `stateChange`、ObjectPageLayout `navigate`、FlexibleColumnLayout `stateChange`、ListBase `itemPress`、VariantManagement `select`）。对照方法和 `26a` 相同：用 TypeScript 读出每个组件的全部属性，和 SAPUI5 1.154.0 的 `api.json`（sap.ui.comp、sap.m、sap.f、sap.uxap、sap.suite.ui.microchart）逐个比对，再逐条判断。范围是 D31 之前就有的组件；D31 新做的控件已经按 1.154 核实过（`26` 第 6 节）。

## 1. 结论

1. **已经一致的**：卡片（`Card`、`Header`、`NumericHeader`、`NumericSideIndicator`，D20 时就按 UI5 起名）；`FlexibleColumnLayout` 的布局取值（和 `sap.f.LayoutType` 九个值相同）。其余组件的**组件名**大多和 UI5 一致，但**属性名、事件名大多不一致**：一期、二期时只约定了组件名（ADR-011），属性按 React 习惯起名。
2. **不一致的有四类**（第 3 节逐条列出）：
   - A 同一个意思、名字不同，改名即可（约 45 处）；
   - B 取值不同（例如 `GenericTag.status` 用 0～5 的数字，UI5 是 `ValueState` 字符串；`titleLevel` 用数字，UI5 是 `'H2'`）；
   - C 用法不同（例如 `ValueHelpDialog` 用 `opened` 属性控制，UI5 用 `open()` / `close()` 方法；`MicroChart` 是一个组件加 `kind`，UI5 是九个独立控件）；
   - D smart-kit 自己的东西，UI5 没有对应（`service`、`typeName`、`row`、`extend`、`query`、`FilterSummary`、`HeaderFacet` 等），**不改**。
3. **还来得及**：
   - 版本还是 0.3.0（0.x 期间小版本可以有不兼容改动），已知的使用方只有 invoice-assure；
   - 做法是**加新名、留旧名**：下一个小版本（0.4.0）同时接受 UI5 的名字和现在的名字，旧名标 `@deprecated`（编辑器里显示删除线，开发模式下控制台提示一次）；invoice-assure 换完后，再下一个小版本（0.5.0）或 1.0 删掉旧名；
   - 越晚改越贵：1.0 之后再改就要升主版本。
4. 需要注意的几处：
   - `DynamicPage.snapOnScroll` 和 UI5 的 `preserveHeaderStateOnScroll` 意思相反（一个是"滚动时折叠"，一个是"滚动时保持"），换名时值要取反；
   - `GenericTag.status`、`titleLevel` 的取值要两种都接受一段时间；
   - 模板（`SmartListReport`、`SmartObjectPage`）对应的是 Fiori elements 的 manifest 设置，不在 `api.json` 里，这次没有核实，需要另外对照 sap.fe 的 manifest schema（第 3.9 节）。

## 2. 对照总表

| smart-kit | 对应的 UI5 | 组件名 | 属性 / 事件 | 建议 |
| --- | --- | --- | --- | --- |
| `SmartTable` | sap.ui.comp.smarttable.SmartTable（树表的方法：sap.ui.table.TreeTable） | 一致 | 53 个属性里只有 5 个同名 | A 改名 11 处，C 1 处 |
| `ResponsiveTable` | sap.m.Table | 不同 | 3 个同名 | A 改名 7 处；或改名为 `Table` 后整体对齐（见 3.2） |
| `SmartFilterBar` | sap.ui.comp.smartfilterbar.SmartFilterBar | 一致 | 0 个同名（状态在 `useFilterState` 里） | C：加 UI5 的事件 |
| `ValueHelpDialog` | sap.ui.comp.valuehelpdialog.ValueHelpDialog | 一致 | 3 个同名 | C：加 ref 方法 |
| `SmartField` | sap.ui.comp.smartfield.SmartField | 一致 | 4 个同名 | A 改名 4 处 |
| `SmartForm` | sap.ui.comp.smartform.SmartForm | 一致 | 1 个同名 | A 改名 1 处 |
| `SmartVariantManagement` | sap.ui.comp.smartvariants.SmartVariantManagement | 一致 | 0 个同名 | A 改名 4 处 |
| `DynamicPage` | sap.f.DynamicPage + DynamicPageTitle + DynamicPageHeader | 一致 | 6 个同名 | A 改名 10 处，B 1 处 |
| `ObjectPageLayout` | sap.uxap.ObjectPageLayout + ObjectPageDynamicHeaderTitle | 一致 | 6 个同名 | A 改名 7 处 |
| `AnchorBar` | sap.uxap.AnchorBar | 一致 | 1 个同名 | 内部组件，低优先 |
| `FlexibleColumnLayout` | sap.f.FlexibleColumnLayout | 一致 | `layout` 及取值一致 | A 改名 4 处 |
| `GenericTag` | sap.m.GenericTag | 一致 | 4 个同名 | B：`status` 取值 |
| `MicroChart` | sap.suite.ui.microchart 的九个控件 | 不同 | 12 个同名 | C：加九个 UI5 同名控件 |
| `Card`、`Header`、`NumericHeader`、`NumericSideIndicator` | sap.f.Card、sap.f.cards.* | 一致 | 一致（D20） | 不改 |
| `TableP13nDialog` | sap.m.p13n.Popup | 不同 | — | 低优先 |
| `QuickViewLink` | sap.ui.comp.navpopover.SmartLink | 不同 | — | 低优先 |
| `DraftMarker` | sap.m.ObjectMarker（`type="Draft"`） | 不同 | — | 内部改用 `ObjectMarker` |
| `OverflowActions` | sap.m.OverflowToolbar（D31 已做） | 不同 | — | 标为废弃，改用 `OverflowToolbar` |
| `SmartListReport`、`SmartObjectPage` | sap.fe.templates.ListReport / ObjectPage 的 manifest 设置 | 一致 | 未核实 | 另做对照 |
| `SmartKitProvider`、`HeaderFacet`、`FilterSummary`、`ConditionInput`、`AdaptFiltersDialog`、`CreateDialog`、`SimpleChart`、`ChartView`、`ShareMenu`、`CriticalityIcon`、`FieldEditor`、`MessageButton` | 没有对应的公开控件 | — | — | D，不改 |

## 3. 逐条清单

"A" 改名（新旧名都收一段时间）；"B" 取值不同；"C" 用法不同；"D" 不改。

### 3.1 SmartTable（sap.ui.comp.smarttable.SmartTable）

| 现在 | UI5 | 类 | 说明 |
| --- | --- | --- | --- |
| `title` | `header` | A | 表格标题 |
| `titleLevel`（2～5） | `headerLevel`（'Auto' / 'H1'～'H6'） | A + B | 两种取值都收 |
| `exportable` | `enableExport` | A | |
| `copy` | `enableCopy` | A | |
| `editing` | `editable` | A | |
| `overlay` | `showOverlay`（sap.m.Table 的属性） | A | |
| `growing: 'button' \| 'scroll'` | `growing: boolean` + `growingScrollToLoad` | A + B | sap.m.Table 的写法 |
| `mode: 'grid' \| 'responsive' \| 'auto'` | `tableType`（D31 已加） | A | `mode` 标为废弃 |
| `refreshToken` | 方法 `rebindTable()`（ref） | C | 两种都收 |
| `onRowNavigate` | `onItemPress`（内表 sap.m.Table 的事件） | A | SmartTable 本身没有，取内表的名字 |
| `onBeforeExport` | `beforeExport` | 一致 | |
| `entitySet`、`tableType`、`onToggleOpenState`、`growingThreshold` | 同名 | 一致 | |
| `service`、`parent`、`query`、`sort`、`groupBy`、`totals`、`lineItem`、`presentation`、`extend`、`actionGroups`、`createMode`、`deletable`、`workingMode`、`showSearch`、`exportLimit`、`onExported`、`onCountChange` 等 | 无 | D | 注解驱动、扩展点、Fiori elements 的设置 |

UI5 有、本库没有、值得补的：`showRowCount`、`showFullScreenButton`、`enableAutoColumnWidth`、`noData`、`initiallyVisibleFields`、`ignoredFields`。

### 3.2 ResponsiveTable（sap.m.Table）

这是表格的底层积木，使用方很少直接用。建议改名为 `Table`（sap.m.Table），属性一并对齐；旧名 `ResponsiveTable` 保留一段时间。

| 现在 | UI5 | 类 |
| --- | --- | --- |
| `rows` | `items` | A |
| `selectable` + `selectedKeys` | `mode`（'None' / 'MultiSelect' / 'SingleSelectLeft'…）+ 行的 `selected` | A + B |
| `onNavigate` | `onItemPress({ listItem, srcControl })` | A |
| `hasMore` / `loadMore` | `growing` + `onUpdateStarted` / `onUpdateFinished` | C |
| `loading` | `busy`（所有控件都有） | A |
| `label` | `headerText` 或 `aria-label` | A |
| `noData`、`columns`、`onSelectionChange` | 同名 | 一致 |

### 3.3 SmartFilterBar、ValueHelpDialog

| 组件 | 现在 | UI5 | 类 |
| --- | --- | --- | --- |
| SmartFilterBar | 只有 `state`（`useFilterState` 返回），事件都在 hook 里 | 属性 `entitySet`、`liveMode`、`showGoOnFB`、`showClearOnFB`、`showRestoreOnFB`；事件 `search`、`clear`、`reset`、`filterChange`、`assignedFiltersChanged`、`initialise` | C：在组件上加这几个事件和属性（`useFilterState` 的写法保留） |
| ValueHelpDialog | `opened` 控制开关 | 方法 `open()`、`close()`、`isOpen()`（ref） | C：加 ref 方法，`opened` 保留 |
| ValueHelpDialog | 无 | `supportMultiselect`、`supportRanges`、`supportRangesOnly`、`key`、`descriptionKey`、`maxConditions` | 值得补 |
| ValueHelpDialog | `title`、`onOk`、`onCancel` | 同名 | 一致 |

### 3.4 SmartField、SmartForm、SmartVariantManagement

| 组件 | 现在 | UI5 | 类 |
| --- | --- | --- | --- |
| SmartField | `mode: 'display' \| 'edit'` | `editable: boolean` | A + B |
| SmartField | `required` | `mandatory` | A |
| SmartField | `error`（字符串） | `valueState: 'Error'` + `valueStateText` | A + B |
| SmartField | `readOnly` | `editable={false}`（`enabled={false}` 是禁用） | A |
| SmartField | `entitySet`、`value`、`onChange`、`showLabel` | 同名 | 一致 |
| SmartField | `path`、`row`、`field`、`typeName`、`cell` | 无（UI5 用数据绑定） | D |
| SmartForm | `mode` | `editable` | A + B |
| SmartForm | 无 | `title`、`editTogglable`、`onEditToggled`、`checkButton` | 值得补 |
| SmartVariantManagement | `onApply` | `onSelect({ key })`（本库多带 `content`） | A |
| SmartVariantManagement | `standardName` | `standardItemText` | A |
| SmartVariantManagement | `autoApplyOption` | `showExecuteOnSelection` | A |
| SmartVariantManagement | `canSave` | `variantCreationByUserAllowed` | A |

### 3.5 DynamicPage（sap.f.DynamicPage、DynamicPageTitle、DynamicPageHeader）

| 现在 | UI5 | 类 | 说明 |
| --- | --- | --- | --- |
| `pinned` | `headerPinned` | A | |
| `onPinnedChange` | `onPinnedStateChange({ pinned })` | A | |
| `onHeaderExpandedChange` | `onStateChange({ isExpanded })`（DynamicPageTitle 的事件） | A | |
| `defaultHeaderExpanded` | `headerExpanded` 的非受控初值 | D | React 习惯，保留 |
| `snapOnScroll` | `preserveHeaderStateOnScroll` | A + B | **意思相反，值要取反** |
| `subheading` | 标题的 `expandedContent` | A | |
| `summary` | 标题的 `snappedContent` | A | |
| `keyInfo` | 标题的 `content` | A | |
| `navigation`、`layoutActions` | 标题的 `navigationActions` | A | |
| `collapsedAvatar` | 标题的 `snappedHeading` | A | |
| `children` | `content` | A | |
| `layout: 'fill' \| 'flow'` | `fitContent` | A + B | |
| `footer` | `footer` + `showFooter` | 补 `showFooter` | UI5 用 `showFooter` 控制显示 |
| `heading`、`breadcrumbs`、`actions`、`header`、`headerExpanded` | 同名 | 一致 | |
| `actionItems`、`titleAddon`、`titleMessage`、`letterboxing`、`filterToggle` | 无 | D | |

### 3.6 ObjectPageLayout（sap.uxap.ObjectPageLayout）、AnchorBar、FlexibleColumnLayout

| 组件 | 现在 | UI5 | 类 |
| --- | --- | --- | --- |
| ObjectPageLayout | `facets` | `headerContent` | A |
| ObjectPageLayout | `navigation: 'tabs' \| 'anchor'` | `useIconTabBar: boolean` | A + B |
| ObjectPageLayout | `onSelectedSectionChange` | `onNavigate({ section, subSection })` / `onSectionChange` | A |
| ObjectPageLayout | `headerPinned` | `headerContentPinned` | A |
| ObjectPageLayout | `onHeaderPinnedChange` | `onHeaderContentPinnedStateChange({ pinned })` | A |
| ObjectPageLayout | `subheading`、`avatar`、`collapsedAvatar` | 标题（ObjectPageDynamicHeaderTitle）的 `expandedContent`、`snappedHeading` 等 | A |
| ObjectPageLayout | `heading`、`breadcrumbs`、`actions`、`sections`、`selectedSection`、`footer` | 同名 | 一致 |
| ObjectPageLayout | `scope`、`extend`、`headerMessage`、`sideContent*`、`letterboxing` | 无 | D |
| AnchorBar | `items`、`onSelect`、`tabs` | `content`（按钮）、`onPress`；切换由 ObjectPageLayout 的 `useIconTabBar` 决定 | 内部组件，低优先 |
| FlexibleColumnLayout | `begin`、`mid`、`end` | `beginColumnPages`、`midColumnPages`、`endColumnPages` | A |
| FlexibleColumnLayout | `onLayoutChange` | `onStateChange({ layout, maxColumnsCount, isNavigationArrow })` | A |
| FlexibleColumnLayout | `layout` 及九个取值 | 同名同值 | 一致 |
| FlexibleColumnLayout | `onCloseMid`、`onCloseEnd`、`midPaging`、`endPaging`、`separatorArrows` | 无（Fiori elements 的按钮） | D |

### 3.7 GenericTag、MicroChart

| 组件 | 现在 | UI5 | 类 |
| --- | --- | --- | --- |
| GenericTag | `status`：0～5 的数字（Criticality） | `status`：`ValueState`（'Error'、'Warning'、'Success'、'Information'、'None'） | B：两种都收 |
| GenericTag | 无 | `design`（'Full' / 'StatusIconHidden'）、`valueState`（'Error' 时值显示为错误图标） | 值得补 |
| MicroChart | 一个组件，`kind` 选类型 | 九个控件：`BulletMicroChart`、`RadialMicroChart`、`HarveyBallMicroChart`、`DeltaMicroChart`、`ColumnMicroChart`、`LineMicroChart`、`ComparisonMicroChart`、`AreaMicroChart`、`StackedBarMicroChart` | C：按 UI5 加九个同名控件（属性如 `targetValue`、`forecastValue`、`percentage`、`value1` / `value2`），内部共用现在的绘制代码；`MicroChart` 保留，给注解驱动用 |

### 3.8 其他

- `DraftMarker` → 内部改用 D31 的 `ObjectMarker`（`type="Draft"` / `"LockedBy"` / `"UnsavedBy"`），对外名字保留。
- `OverflowActions` → 标为废弃，改用 D31 的 `OverflowToolbar` + `OverflowToolbarLayoutData`。
- `TableP13nDialog`（≈ sap.m.p13n.Popup）、`QuickViewLink`（≈ sap.ui.comp.navpopover.SmartLink）：用法差别大，低优先，可以以后再做。

### 3.9 模板（未核实）

`SmartListReport`、`SmartObjectPage` 对应 Fiori elements V4 的 manifest 设置（例如 `initialLoad`、`liveMode`、`tableSettings.type`、`creationMode`、`sectionLayout`、`editableHeaderContent`）。这些设置在 sap.fe 的 manifest schema 里，不在 `api.json` 里，这次没有核实。凭印象看，`autoExecute`（≈ `initialLoad`）、`navigation`（≈ `sectionLayout`）、`partialHeaderEdit`（≈ `editableHeaderContent`）可能要改；**要另外读 sap.fe 的 schema 后再定**，不要凭印象改。

## 4. 建议的做法

| 批次 | 内容 | 影响 |
| --- | --- | --- |
| 1 | 第 3.1、3.4～3.6 节的 A 类改名（约 45 处）：新名旧名都收，旧名标 `@deprecated` | 对使用方无影响；invoice-assure 可以慢慢换 |
| 2 | B 类取值（`GenericTag.status`、`titleLevel`、`snapOnScroll`、`mode`）：两种取值都收 | 同上 |
| 3 | C 类：`ValueHelpDialog` ref 方法、`SmartTable.rebindTable()`、`SmartFilterBar` 事件、`ResponsiveTable` → `Table` | 新增，不影响旧用法 |
| 4 | 九个 UI5 同名微图表控件 | 新增 |
| 5 | 模板对照 sap.fe manifest schema（先核实再改） | 待核实 |
| 6 | 0.5.0 或 1.0：删掉旧名 | invoice-assure 先换完 |

每一批都：加测试（新名和旧名都测），改 `docs/api.md`、`reference.md`、使用文档和示例，写 changeset（minor）和 `25-invoice-assure-issues.md` 里给 invoice-assure 的迁移说明。
