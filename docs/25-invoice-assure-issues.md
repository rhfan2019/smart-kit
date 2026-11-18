# invoice-assure 用 smart-kit 发现的问题

> 最后更新：2026-11-17（由 invoice-assure 的会话写入）。invoice-assure 用 smart-kit 时发现、还没修的问题，在本仓库修。修好一条、发版后，在这里写上本仓库的提交号和版本；invoice-assure 升级、拆掉绕行办法后，由那边在它的待办里关掉，并从这里删掉那一条。

## 怎么用

- **背景**：invoice-assure（本机 `../03-invoice-assure`）把列表页、记录页改用 smart-kit（现在是 0.3.0，npm 上的 `@rhfan2019/smart-kit`、`-core`、`-server`、`-cli`），经 OData V4 读 PostgreSQL 里的视图。方向见 invoice-assure 的 `docs/decisions/2026-11-17-smart-kit-list-pages.md`，本仓库的讨论在 `docs/12-discussion-log.md` D27。
- **约定**：invoice-assure 不改 `node_modules`、不拷 smart-kit 的源码。下面的“本项目现在怎么绕”指 invoice-assure 的临时办法，修好后由那边拆掉。
- **能直接看的例子**：用户页（系统管理 → 用户）已经整页用 smart-kit：清单 + 弹性分栏（FCL）里的对象页，代码在 invoice-assure 的 `src/features/users/components/users-client.tsx`、`src/components/smart-kit/`、`src/server/odata/`。
- **编号**：S 是 invoice-assure 决策第 8 节的编号，TECH 是它的待办编号。代码位置指本仓库（核对时 `main` 在 e016471）。“本项目”都指 invoice-assure。

## 已关掉的（2026-11-17）

0.1.0 时记的 S1～S9、S13～S23 在 0.3.0 修好，invoice-assure 已升级到 0.3.0、拆掉了绕行办法，条目删去（历史见 Git 和 `docs/12-discussion-log.md` D29、D30）。

## 还没修

### S24 · TECH-077：对象页的区块和抬头关键值不能按数据隐藏

- **现象**：`UI.Hidden` 只认常量（`buildModel` 里按 `bool(...)` 读），`UI.Facets`、`UI.HeaderFacets` 里的 `ReferenceFacet` 写 `<Annotation Term="UI.Hidden" Path="…"/>` 不起作用；`SmartObjectPage` 也没有扩展抬头关键值的属性（只有 `sectionExtend`）。
- **为什么要**：invoice-assure 的发票对象页按“情形”换内容（疑似重复、确认订单、差异、补单据、会计复核、在等别人、已了结）：同一个实体类型，抬头关键值（匹配度环形图、单价对比微图、付款到期、复核进度）和第一个区块按每张发票的数据决定显示哪些。Fiori elements 用的就是路径式 `UI.Hidden`。
- **期望**：`UI.Facets`、`UI.HeaderFacets` 的 facet（含 `CollectionFacet`、`ReferenceFacet`）和 `UI.DataField` 支持 `UI.Hidden` 的 `Path`（布尔字段，按当前这一行算；编辑中按草稿值算），被隐藏的区块同时从锚点栏里拿掉。
- **本项目现在怎么绕**：发票页不用 `SmartObjectPage`，改用下一层的 `ObjectPageLayout`，由宿主按行给 `facets`、`sections`；代价是区块和字段不再来自注解。补上后可以回到 `SmartObjectPage`。
- **验收**：一个字段为真时区块和锚点都不出现、为假时出现；抬头关键值同理；切换到另一行（FCL 翻页）时跟着变。

### S25 · TECH-078：对象页的页脚不能放宿主自己的决定按钮

- **现象**：页脚的动作只来自 `UI.Identification` 里 `Determining` 的 `DataFieldForAction`，调服务端绑定动作；`SmartObjectPage` 没有 `footer` 之类的属性。
- **为什么要**：invoice-assure 的发票页把了结这一步的决定放在固定页脚（如“接受差异，交财务”“退回供应商”“确认，转待预制”），点了先弹本项目的对话框（选依据类型、写原因、带上数字员工起草的文字），再走本项目的 Server Action；按钮按人、按情形现算；缺条件时左边写缺什么（“还差 1 条复核打勾”）并能点过去。
- **期望**：`SmartObjectPage` 有一个页脚扩展（如 `footerActions: ReactNode | (row) => ReactNode`，再加一个页脚左侧的消息位），和模型动作排在一起，照 Fiori 的顺序（主按钮在前），保持固定、不随滚动消失。
- **本项目现在怎么绕**：同 S24，用 `ObjectPageLayout` 的 `footer`。
- **验收**：宿主给的按钮出现在页脚、按行变化；编辑状态下页脚仍是保存 / 取消。

### S26 · TECH-079：页脚没有消息按钮时，决定按钮靠左

- **现象**：`SmartObjectPage` 的页脚是 `justify: space-between`，左边放消息按钮；没有消息时左边是空的，按钮跑到左边。
- **期望**：页脚动作始终靠右（Fiori 页脚工具栏）。
- **本项目现在怎么绕**：宿主样式 `[data-sk-footer] > :last-child { margin-left: auto }`。
- **验收**：没有消息时按钮在右边；有消息时消息按钮在左、动作在右。

### S27 · TECH-080：动作参数的对话框只有单行文字框

- **现象**：`useActionRunner` 给每个参数一个 `TextInput`，值都是字符串。
- **为什么要**：invoice-assure 的决定都要填东西：接受差异选依据类型（4 选 1）、写原因（几行字）、附依据文件；退回选原因类别；作废重复要确认“不能恢复”。
- **期望**：参数支持 `Common.ValueListWithFixedValues`（选择框，取值来自值列表或枚举）、`UI.MultiLineText`（多行）、`UI.ParameterDefaultValue`、`Common.Label`；`UI.DataFieldForAction/Criticality` 为负面时先确认；`SmartObjectPage` 有动作做完的回调（`onActionDone(result)`），宿主好刷新自己的部分。
- **本项目现在怎么绕**：参数都是文字，服务端按中文名称或代码认，不填记“其他”；附件、草稿留在整页的发票页；动作做完的通知靠包一层 `DataProvider.invoke`。
- **验收**：枚举参数是选择框；多行参数是文本域；危险动作先确认；回调在成功和失败时都调。

### S28 · TECH-081：按钮不能按人显示（只记录）

- **现象**：`Core.OperationAvailable` 只能指向行上的字段，看不到当前用户；同一张发票，采购员和会计该看到的决定不同。
- **本项目现在怎么绕**：同一个视图注册成三个类型（采购员、会计、只读），各带各的 `UI.Identification`，页面按人选一个。暂不要求补。

## 只记录

### S10 · TECH-063：没有 `$batch`（只记录）

- **现象**：成批动作一行发一个请求，丢掉了“一次确认、逐张报结果”的做法。
- **本项目现在怎么绕**：成批的事用表格工具栏的自定义按钮，调本项目的 Server Action。暂不要求补，记下来供排期参考。

### S11 · TECH-064：服务端没有无绑定的动作（只记录）

- **现象**：smart-kit-server 只支持绑定动作。
- **本项目现在怎么绕**：新建按钮放页头，打开对象页的新建模式（`create`）。暂不要求补。

### S12 · TECH-065：`afterRead` 是同步的（只记录）

- **现象**：`afterRead` 只能放纯函数算的显示字段，不能查库。
- **本项目现在怎么绕**：要查库才能写出来的字段（如用户页的“看不到发票”）用自定义列，按当前页的行调本项目的查询。暂不要求补。

## 迁移清单（SAPUI5 对齐，D34、D35）

smart-kit 按铁律（ADR-033）改名、改属性、改行为时不保留旧名。对齐全部完成后，用户按下面的清单统一修改 invoice-assure。每个阶段追加一节（阶段号见 `31`）。

| 阶段 | 旧写法 | 新写法 | 说明 |
| --- | --- | --- | --- |
| 0 | — | — | 只加核对工具（`check:ui5`、`e2e:fe`），API 没有变化 |
| 1 | `import { ObjectStatus, … } from '@rhfan2019/smart-kit/controls'`（或根入口） | `import ObjectStatus from '@rhfan2019/smart-kit/m/ObjectStatus'`：每个类一个模块、默认导出；对照表见 `docs/api.md` 的"UI5 模块" | 子路径 `/controls`、`/messages`、`/cards` 删除，根入口不再导出这些控件 |
| 1 | `import { MessageBox, MessageToast, MessageStrip, MessageView, MessageItem, MessagePopover } from '@rhfan2019/smart-kit/messages'` | `m/MessageBox`、`m/MessageToast`、`m/MessageStrip`、`m/MessageView`、`m/MessageItem`、`m/MessagePopover`（默认导出） | |
| 1 | `MessageProvider`、`useMessages`、`MessageIcon`、`MessageHost`（`/messages`） | `kit/MessageProvider`、`kit/useMessages`、`kit/MessageIcon`、`kit/MessageHost`（默认导出） | UI5 没有对应 |
| 1 | `MessageButton`（`/messages`） | `v4/fe/macros/MessageButton`（默认导出） | API 在阶段 2 对齐 |
| 1 | `Card`、`Header`、`NumericHeader`、`NumericSideIndicator`（`/cards`） | `f/Card`、`f/cards/Header`、`f/cards/NumericHeader`、`f/cards/NumericSideIndicator` | |
| 1 | `ListContent`、`TableContent`、`ObjectContent`、`AnalyticalContent`、`TimelineContent`、`CalendarContent`（`/cards`） | `ui/integration/cards/ListContent` 等 | |
| 1 | `ProcessFlow`、`MicroProcessFlow`、`MicroProcessFlowItem`、`Timeline`、`TimelineItem` | `suite/ui/commons/ProcessFlow` 等 | |
| 1 | `UploadSetwithTable`、`ActionsPlaceholder`、`UploaderTableItem`、`UploaderHttpRequestMethod` | `m/plugins/UploadSetwithTable`、`m/upload/ActionsPlaceholder`、`m/upload/UploaderTableItem`、`m/upload/UploaderHttpRequestMethod` | |
| 1 | `Currency` | `ui/unified/Currency` | |
| 1 | 枚举 `ValueState`、`IndicationColor`、`TitleLevel`、`IconColor` | `import { ValueState } from '@rhfan2019/smart-kit/ui/core/library'` | |
| 1 | 枚举 `MessageType` | `import MessageType from '@rhfan2019/smart-kit/ui/core/message/MessageType'` | 有自己的模块，默认导出 |
| 1 | sap.m 的枚举（`ButtonType`、`ListType`、`EmptyIndicatorMode`、`TitleAlignment`、`WrappingType`、`VerticalPlacementType`、`BackgroundDesign`…） | `import { ButtonType } from '@rhfan2019/smart-kit/m/library'` | |
| 1 | `IllustratedMessageType`、`IllustratedMessageSize`、`AvatarShape`、`AvatarSize` | `m/IllustratedMessageType` 等（默认导出） | |
| 1 | ProcessFlow、Timeline 的枚举 | `import { ProcessFlowNodeState } from '@rhfan2019/smart-kit/suite/ui/commons/library'` | |
| 1 | `CalendarWeekNumbering` | `base/i18n/date/CalendarWeekNumbering`（默认导出） | |
| 1 | `messageTypeOf`、`toDates`、`dynamicDateValueTypes`、`DEFAULT_STANDARD_OPTIONS`、`viewSettingsFilterString`、`RESTRICTED_FILE_NAME_CHARACTERS`、类型 `PreventableEvent`、`DateLike` | `@rhfan2019/smart-kit/util` | |
| 1 | 类型 `XxxProps`（如 `MessageStripProps`） | `$XxxSettings`（如 `$MessageStripSettings`），从该控件的模块导出 | |
| 1 | 类型 `XxxRef`（如 `MessageStripRef`） | 类名本身：`useRef<MessageStrip>(null)` | |
| 1 | 事件对象类型（如 `TimelineFilterSelectionChangeEvent`、`TimelineItemFilteringEvent`、`UploadCompletedEvent`、`ViewSettingsDialogConfirmEvent`、`FeedListItemPressEvent`） | `Timeline$FilterSelectionChangeEvent`、`Timeline$ItemFilteringEvent`、`UploadSetwithTable$UploadCompletedEvent`、`ViewSettingsDialog$ConfirmEvent`、`FeedListItem$SenderPressEvent` / `FeedListItem$IconPressEvent`；`ProcessFlowLabelPressInfo` 删除 | `<类名>$<事件>Event` |
| 1 | `OverflowToolbar` 的 ref 成员 `element` | `getDomRef()` | |
| 1 | `OverflowToolbarButton` 不写 `type` | 默认 `'Default'`（原来 `'Transparent'`），工具栏里看起来一样 | 行为 |
| 1 | `ObjectStatus`、`ObjectIdentifier`、`ObjectNumber`、`ObjectMarker`、`BusyIndicator`、`ExpandableText`、`Currency` 的 `children` | 删除（UI5 没有内容聚合，原来也被忽略） | 类型 |
| 1 | `ViewSettingsDialog selectedFilterKeys={{ status: ['REJ'] }}` | `selectedFilterCompoundKeys={{ status: { REJ: true } }}`；`onConfirm` 里的 `filterKeys` 改用 `filterCompoundKeys` | |
| 1 | `IconTabBar onSelect` 的 `selectedItem`、`selectedKey` | `item`、`key`（UI5 里前两个已废弃） | |
| 1 | `ProcessFlow onNodePress(node)`、`onHeaderPress(lane)`、`onLabelPress(label, info)`、`onError` | `onNodePress(e)` 取 `e.oEvent`；`onHeaderPress(e)` 取 `e.oEvent`；`onLabelPress(e)` 取 `e.oEvent.selectedLabel`、`e.oEvent.connections`；`onOnError(e)` 取 `e.oEvent.text`（事件名和参数名照 api.json） | |
| 1 | `FeedListItem` 的 `onSenderPress` / `onIconPress` 里的 `domRef` | `getDomRef()` | |
| 1 | `UploadSetwithTable uploader={{ … }}` | `uploader={<UploaderTableItem … />}`；给了 uploader 时不再回退用 `uploadUrl`；上传器事件的 `responseXHR` 是普通对象；`uploadCompleted` 的 `responseXML` 是文本；`uploadItemViaUrl` 的条目带一个空 `File` | 行为 |
| 1 | multipart 上传的表单字段名 `file` | 字段名是文件名，另带 `_charset_=UTF-8`（照 UI5） | **服务端按 `file` 取文件的要改** |
| 1 | `MicroProcessFlowItem` 不写 `state` | 默认 `'Standard'`（原来 `'None'`，显示不变） | |
| 1 | 卡片 `Header icon` | `iconSrc`（图片地址或元素） | |
| 1 | 卡片头像的底色 | 默认 `iconBackgroundColor="Transparent"`（UI5 默认）；要原来的样子写 `iconBackgroundColor="Placeholder"` | 外观 |
| 1 | `NumericHeader` 不写 `state` | 按 `Neutral` 显示数字颜色 | 外观 |
| 1 | `Card` 的宽高 | 根元素默认写出 `width:100%; height:auto`；用 CSS 类设宽度的要改用 `width` 属性或 `style` | 外观 |
| 1 | 卡片页头的 DOM | 标题是 heading（`aria-level` 3）；头像、标题和计数放进 `.sk-card__header-row`，数值页头的附加指标放进 `.sk-card__sides` | 宿主 CSS 依赖旧结构的要改 |
| 1 | `TimelineContent item={{ startDate, title, text }}` | `item={{ dateTime, title, description }}`（manifest 的名字） | |
| 1 | `CalendarContent firstDayOfWeek` | `calendarWeekNumbering`（`'Default'`、`'ISO_8601'`、`'MiddleEastern'`、`'WesternTraditional'`） | |
| 1 | `MessageView` 远程长文本（`longtextUrl`） | 替换说明（照 UI5），原来是追加；新属性 `asyncDescriptionHandler` | 行为 |
| 2 | 子路径 `/field`、`/filter`、`/variants`、`/table`、`/chart`、`/object`、`/page`、`/actions`、`/edit` | 删除。积木按 UI5 模块导入（下面各行）；hooks 和无对应的组件在 `kit/<名字>`（默认导出）；辅助函数在 `/util` | 根入口只剩 `context`、`i18n`、`theme`、`util` 的名字；`/templates` 阶段 5 再改 |
| 2 | `SmartTable` | `v4/fe/macros/Table`（`Table`）；层级表 `tableType="TreeTable"` → `v4/fe/macros/TreeTable` | 类型 `SmartTableProps` → `$TableSettings`，`SmartTableRef` → `Table` / `TreeTable`，`ExportEvent` → `Table$BeforeExportEvent` / `Table$ExportedEvent`，`ToggleOpenStateEvent` → `TreeTable$ToggleOpenStateEvent`，`TableType` 删除 |
| 2 | `Table` 的定位：`entitySet="X"`；`parent={{ path, navigation }}`；`lineItem` / `presentation` | `contextPath="/X"`；`contextPath="/Set/_Nav"` + `bindingContext="Set('1')"`；`metaPath`（`@UI.LineItem#Q`、`@UI.SelectionPresentationVariant#Q`、`@UI.PresentationVariant#Q`） | |
| 2 | `Table` 的属性：`mode` / `tableType`、`title`、`titleLevel`（数字）、`exportable`、`exportLimit`、`copy`、`showSearch`、`overlay`、`editing`、`createMode`、`growingThreshold` / `growBy`、`growing: 'scroll'`、`columns`（可见列 id） | `type`（`GridTable` / `ResponsiveTable` / `AnalyticalTable`）+ `rowCountMode`；`header`；`headerLevel`（`'H3'`）；`enableExport`；`exportRequestSize`；`disableCopyToClipboard`（取反）；`isSearchable`；`showOverlay`；`readOnly`（取反）；`creationMode={{ name: 'CreationDialog' \| 'Inline' }}` 或 `{ enabled: false }`；`threshold`；`growingScrollToLoad`；`visibleColumns` / `onVisibleColumnsChange`（`columns` 现在是 FE 的 Column 聚合） | `deletable`、`modelActions` 删除 |
| 2 | `Table` 的事件：`onRowNavigate(row, path)`、`onSelectionChange(rows)`、`refreshToken` | `onRowPress({ bindingContext })`（`bindingContext.getPath()` 带前导 `/`）；`onSelectionChange({ selectedContexts })`；`ref.current.refresh()` | `selectionLimit` 默认 200（FE） |
| 2 | `ResponsiveTable` | `m/Table`（sap.m.Table）：`rows` → `items`，`label` → `headerText`，`selectable` → `mode`，`onSelectionChange(Set)` → `onSelectionChange({ listItem, listItems, selected, selectAll })`，`onNavigate(row)` → `onItemPress({ listItem, srcControl })`，`hasMore` / `loadMore` / `loading` → `growing` + `growingScrollToLoad` + `hasMore` + `onUpdateStarted` + `busy`，`showDetails` → `hiddenInPopin`，`onHiddenColumnsChange` → `onPopinChanged`；列类型 `ResponsiveColumn` → `$ColumnSettings`（`label` → `header`，`render` → `cell`，`align: 'end'` → `hAlign: 'End'`） | 按重要性弹入要设 `autoPopinMode`（UI5 默认 false） |
| 2 | `TableP13nDialog`（`/table`） | `m/p13n/Popup`（默认导出；API 阶段 6 对齐） | |
| 2 | `smartKitGridTheme`（`/table`） | `kit/smartKitGridTheme`（默认导出） | |
| 2 | `useListQuery`、`useTableContext` | `kit/useListQuery`、`kit/useTableContext` | |
| 2 | `SmartFilterBar` | `v4/fe/macros/FilterBar`（`FilterBar`）；`SmartFilterBarProps` → `$FilterBarSettings`；`<SmartFilterBar.Search/Fields/Actions/>` → `<FilterBar.Search/Fields/Actions/>`；`FilterFieldItem.render(ctx)` 的参数多了 `required`、`disabled` | 新属性 `contextPath`（不传 `state` 也能用）、`metaPath`、`liveMode`、`showClearButton`、`showMessages`（默认 true：必填为空时按 Go 弹出错误框；`SmartListReport` 传 false）；事件 `onSearch`、`onFilterChanged`、`onAfterClear`；ref 方法 `getFilters`、`setFilterValues`、`triggerSearch`… |
| 2 | `SmartVariantManagement` | `v4/fe/macros/VariantManagement`；`onApply({ content, autoApply })` → `onSelect({ key, content, autoApply })`；`autoApplyOption` → `supportApplyAutomatically`；`canSave` → `creationAllowed` | |
| 2 | `useFilterState`、`useFilterBarContext`、`ConditionInput`、`ValueHelpDialog`、`AdaptFiltersDialog`、`FilterSummary`、`useValueList`、`useVariants` | `kit/<同名>`（默认导出） | |
| 2 | `conditionText`、`parseConditionText`、`relativeDateText`、`filterSummaryText`、`getPath`、`fieldValue`、`resolveRef`、`hiddenByImportance`、`niceTicks`、`MICRO_COMPARISON_MAX`、`linkify`、`draftState`、`fclArrows`、`isActionAvailable`、`actionPaths`、`isEditable`、`validate`、`fieldErrors`、`createFields`、`createWith` | `@rhfan2019/smart-kit/util` | |
| 2 | `SmartField` | `v4/fe/macros/Field`（`Field`）：`entitySet="X"` → `contextPath="/X"`；`path` / `field` → `metaPath`；`mode="edit"` → `readOnly={false}`；原来的 `readOnly`（禁用）→ ref 的 `setEnabled(false)`；`onChange(value)` → `onChange({ value, isValid })`；`required` 删除（按注解推导） | **`onChange` 现在只在提交时触发**（文本：失焦或回车；选择、日期、勾选：立即），每次按键是 `onLiveChange({ value })` |
| 2 | `SmartForm` | `v4/fe/macros/Form`：`groups` → `metaPath`（`@UI.FieldGroup#Q`、facet id 或分组数组）；`mode` → `readOnly`；`onChange(path, value)` → `onChange({ path, value })`；`showGroupTitles` 删除（多于一个分组时才显示组标题，同 FE） | |
| 2 | `CriticalityIcon`、`FieldEditor`、`QuickViewLink`、`CreateDialog`、`useEditStrategy`、`useActionRunner` | `kit/<同名>` | `FieldEditor` 的 `onChange` 同样改为提交时触发，`onLiveChange(text)` |
| 2 | `ChartView` | `v4/fe/macros/Chart`（`Chart`）：`entitySet` → `contextPath`；`chart` → `metaPath`；`filters` + `search` + `executed` → `query={{ filters, search }}`（`null` = 未执行）；`title` → `header`；`titleAddon` → `headerContent`；`toolbarEnd` → `actions`；`onDrilldown(dim, value)` → `onDrilldown({ dimension, value })` | 默认多选（`selectionMode` Multiple）：同一点再点一次取消选择；"显示详情"只在设了 `onDrilldown` 时出现 |
| 2 | `MicroChart`（`/chart`） | `v4/fe/macros/MicroChart`：注解驱动用 `contextPath` / `metaPath`；直接给数据的用法保留（`kind`、`value`…）；`MicroChartProps` → `$MicroChartSettings`（数据部分 `MicroChartData`）；原来不生效的 `size` 换成 UI5 的 `XS`～`L` | 九个独立微图表控件阶段 6 |
| 2 | `SimpleChart` | `kit/SimpleChart` | |
| 2 | `MessageButton` 的 `defaultOpened` | 删除；新事件 `onVisibilityChange({ visible })` | |
| 2 | `DynamicPage` | `f/DynamicPage` + `f/DynamicPageTitle` + `f/DynamicPageHeader`（按 UI5 组合）：页面 `children` → `content`，`layout` → `fitContent`，`snapOnScroll` → `preserveHeaderStateOnScroll`（**意思相反**，默认滚动时折叠），`pinned` → `headerPinned`，`onPinnedChange(v)` → `onPinnedStateChange({ pinned })`，`navigation` → `stickySubheaderProvider`，`header` 收 `<DynamicPageHeader>`；标题 `<DynamicPageTitle>`：`heading`（并入 `headingContent`、`titleAddon`），`subheading` → `expandedContent`（只在展开时显示），`summary` → `snappedContent`，`keyInfo` → `content`，`layoutActions` → `navigationActions`，`collapsedAvatar` → `snappedHeading`，`onHeaderExpandedChange(v)` → `onStateChange({ isExpanded })`；`actionItems`、`defaultHeaderExpanded` 删除 | **页脚要设 `showFooter` 才显示**；手机上的摘要行只在设了 `snappedTitleOnMobile` 时出现；所在列的布局按钮不再自动出现，要在 `navigationActions` 里放 `<Paginator/>` 和 `<FlexibleColumnLayoutActions/>` |
| 2 | `FlexibleColumnLayout` | `f/FlexibleColumnLayout`：`begin` / `mid` / `end` → `beginColumnPages` / `midColumnPages` / `endColumnPages`；`onLayoutChange(l)` → `onStateChange({ layout, maxColumnsCount, isNavigationArrow, isResize })`；`onCloseMid` / `onCloseEnd` 删除（关闭按钮发出 `stateChange`，宿主按布局去掉 URL 里的对象）；类型 `FclLayout` → `LayoutType`（`f/library`） | 列数按 UI5：宽度 ≥1280 三列、≥960 两列（原来 <1024 就一列） |
| 2 | FCL 的 `midPaging` / `endPaging`、关闭和全屏按钮 | `v4/fe/macros/Paginator`、`v4/fe/macros/fcl/FlexibleColumnLayoutActions.block`（UI5 的模块名就带 `.block`） | `ColumnContextValue` 的结构变了 |
| 2 | `ObjectPageLayout` | `uxap/ObjectPageLayout`：`heading`、`subheading`、`breadcrumbs`、`avatar`、`collapsedAvatar`、`actions`、`keyInfo`、`titleAddon`、`layoutActions` → `headerTitle={<ObjectPageDynamicHeaderTitle …/>}`（`uxap/ObjectPageDynamicHeaderTitle`）；`facets` → `headerContent`；`navigation` → `useIconTabBar`；`onSelectedSectionChange` → `onSectionChange({ section, subSection })`；`headerPinned` → `headerContentPinned`；`onHeaderPinnedChange` → `onHeaderContentPinnedStateChange({ pinned })`；`actionItems` 删除 | **`upperCaseAnchorBar` 默认 true、`enableLazyLoading` 默认 false（`lazy` 只在它为 true 时生效）、`showFooter` 默认 false**（UI5 默认；`SmartObjectPage` 已显式传） |
| 2 | `AnchorBar` | `uxap/AnchorBar`：`items` → `content`，`active` → `selectedButton`，`tabs` 删除 | |
| 2 | `GenericTag` | `m/GenericTag`：`status` 从 0～5 的数字改为 `ValueState` 字符串（数字 Criticality 由调用方换算）；`value` 收 React 元素；新 `design`、`valueState` | KPI 用法另有 `v4/fe/macros/KPITag` |
| 2 | `ShareMenu` | `v4/fe/macros/Share` | |
| 2 | `DraftMarker` | 删除，改用 `m/ObjectMarker`（`type="Draft"`、`"LockedBy"`、`"UnsavedBy"`）；草稿弹出框 `kit/DraftIndicator` | 文字变成 ObjectMarker 的文本 |
| 2 | `OverflowActions` | 删除，改用 `m/OverflowToolbar` + `m/OverflowToolbarButton` | |
| 2 | `useDynamicPage`、`ColumnContext`、`useColumn`、`useObject`、`useObjectTitle`、`useSectionScrollSpy`、`HeaderFacet` | `kit/<同名>` | |
| 2 | 枚举 `ListMode`、`PopinLayout`、`Sticky`、`MultiSelectMode`、`ListSeparators`、`GenericTagDesign`、`GenericTagValueState`；`LayoutType`、`DynamicPageTitleShrinkRatio`；`Importance`、`ObjectPageSubSectionLayout` | `m/library`；`f/library`；`uxap/library` | |
| 3 | 草稿列表的编辑状态（4 个选项，筛选键 `$editingStatus`） | 6 个选项（FE 的文字和 id），筛选键 `$editState`；"全部"列出自己的草稿（代替活动实例）和新建未激活的草稿 | **行为**：已保存的视图里旧键的条件失效，回到"全部"；网格表草稿列表多一列只显示图标的编辑状态；草稿弹出框打开时才读详细信息 |
| 3 | 多视图 | 每个视图应用完整的 SelectionVariant，和筛选栏里同一属性的条件取交集；属于 SelectionFields 的视图字段留在筛选栏 | 行为：例如"已关闭"页签加上默认的 `Status ne CLOSED` 后是空的（同 FE） |
| 3 | 没写 `Capabilities.SearchRestrictions` 的实体集 | 显示搜索框并发 `$search` | **不支持 `$search` 的服务要写 `Searchable=false`**；值帮助没写 `SearchSupported` 时也用 `$search` |
| 3 | `Common.FilterDefaultValue` | 没有默认 SelectionVariant 时生成默认条件 | 行为 |
| 3 | 值帮助的 In / InOut / Constant / Out 参数 | 值帮助按参数过滤；选中后回写其他筛选字段 | 行为 |
| 3 | `Common.IsDigitSequence` 的筛选输入 | 补前导零到 MaxLength（"123" → "0000000123"）；包含 / 开头 / 结尾不处理；值 0 显示为空 | 行为 |
| 3 | 非绑定动作 `Core.OperationAvailable` 为 false | 按钮禁用 | 行为 |
| 3 | 合计、小计、网格内分组 | **只有 `type="AnalyticalTable"` 有**（D39，用户决定）；网格表没有合计和分组，响应式表分组时没有条数和小计 | 原来在网格表上用合计的要改成分析表 |
| 3 | 服务没有声明 `Aggregation.CustomAggregate` | 不合计；声明了的度量请求 `aggregate(M)`（由服务决定算法），只有这些能合计；分析表没写 `PresentationVariant/Total` 时合计全部 CustomAggregate，`Total` 是空集合时不合计 | 自写服务要在注解里加 CustomAggregate（smart-kit-server 已支持） |
| 3 | 多币种合计按币种分行 | 显示一个值加"显示详细信息"链接，点开弹出框（"总计" / "小计"）每个币种一行 | 请求：总计 `aggregate(M,Currency)`，小计的币种不进 `groupby`；服务要能在 `aggregate()` 里接受单位（相同则为该值，否则 null） |
| 3 | 列表页图表 | 全部维度和度量；按单位分组，多币种时显示"Invalid data"（不再把不同币种相加）；不再按维度排序；导航上的文本不进分组，类别显示代码 | 行为 |
| 3 | core 新导出 | `buildChartRequest`、`aggregateMeasure`、`isCustomAggregate`、`editStateFilter` 等；`AggregateMeasure.with` 可选；`TotalsRequestOptions.byUnit`、`TotalAmount.multiUnit`、`PresentationModel.hasTotal`；`ValueListModel.searchSupported` 缺省 true | |
| 4 | 列表页的列 | 内联动作每个一列（列名隐藏，不可用时禁用而不是隐藏），原来的"动作"列没有了；指向 DataPoint 的列用值的 `Common.Label`；没写 Label 的微图列显示 FE 的键；FieldGroup 上下排列不带标签；`ConnectedFields`、`Contact` 弹出框、`DataFieldWithAction`（链接执行动作）、`DataFieldWithNavigationPath`；`HTML5.CssDefaults/width` 是列宽；个性化里能加全部属性（分组选项也包括这些属性） | 行为 |
| 4 | 行高亮、单元格颜色 | 行高亮读 LineItem 上的 `UI.Criticality`；属性上的 `UI.Criticality` 不再给单元格上色（D41）；VeryPositive / VeryNegative 不上色 | 行为；`PropertyModel.criticality` 删除 |
| 4 | 表格工具栏动作 | 按注解顺序；没写锚点的自定义动作在新建之前（原来在最后）；然后新建、复制（`UI.IsCopyAction`）、删除；`DataFieldForActionGroup` 菜单总是可用；Determining 动作不进列表工具栏；`CreateHidden` / `DeleteHidden` 常量、`DeleteRestrictions/Deletable` 路径按行；`Common.IsActionCritical` 先确认；删除确认用 FE 的文字 | 行为。非草稿列表页仍有新建（长期偏差，D42 补记） |
| 4 | 筛选条件：`FilterExpressionRestrictions` | 同一属性多条时取最严格的一条；运算符按 FE（MultiRange 没有"包含"，数值没有"空"，SingleRange 允许"不等于"）；单值字段输入新值时替换旧值 | 行为；`filterExpressionRules`、`restrictConditions` 多一个 Edm 类型参数 |
| 4 | 日期筛选 | FE 的全部语义日期运算符（DATE、FROM、TO、DATERANGE、各季度、FIRSTDAY / LASTDAY、天周月季年的 LAST / NEXT …）；相对日期一律生成 BT（今天 = `ge d and le d`）；`$filter` 里的 BT 不再带括号；一周起始日跟随语言（en-US 周日）；令牌文字用 DynamicDateRange 的文本 | 行为；保存的视图里的运算符照旧可用 |
| 4 | `UI.HiddenFilter`、`UI.Hidden` 的默认条件 | HiddenFilter 的条件生效但不显示字段；**`UI.Hidden` 属性上的 SV 默认条件不再生效**（FE 不发） | 行为 |
| 4 | `Capabilities.FilterFunctions` 含 `tolower` | 文本条件生成 `tolower(P) eq tolower('x')`，MemoryProvider 也不区分大小写 | 行为 |
| 4 | 值帮助 | 带限定符的多个 ValueList（按 `ValueListRelevantQualifiers`）可切换；描述列取值帮助主键上的 `Common.Text`，没有文本时描述为空（不再取第一个 DisplayOnly 参数）；对话框每页 64 行，按值帮助实体的 PV 排序，搜索时不排序；类型提示不再默认按键排序，延迟 300ms；没有文本的令牌去读描述；TextSeparate 的令牌只显示代码 | 行为；`buildValueHelpRequest` 新参数 `purpose` |
| 4 | `Common.IsUpperCase`、`Core.IsURL` | 不再处理（D41）：输入不转大写；值不显示为链接（要链接用 `UI.DataFieldWithUrl`） | `PropertyModel.isUpperCase`、`isUrl` 删除 |
| 4 | 值的显示 | 邮件、电话是 `mailto:` / `tel:` 链接；`DataFieldWithUrl` 默认在当前窗口打开（按 `HTML5.LinkTarget`），支持 `IconUrl`；`Common.ExternalID`、`Common.Masked`（显示为星号）、`Common.Timezone`、流属性（链接）、`NumberOfFractionalDigits`；进度条文字按 FE（"52.2 %"，中文"第 x 个，共 y 个"）；快速视图按 FE 的规则（只有文本加导航不再出快速视图）；语义对象链接的目标由宿主的 `NavigationAdapter.semanticTargets` 给（D42） | 行为 |
| 4 | 请求 | `$expand` 的导航选上目标实体的键（`_Supplier($select=SupplierName,Rating,Supplier)`）；列表不再选 ETag 属性（靠 `@odata.etag`）；TextSeparate 的文本不请求；固定值列表用到时才读 | 自己写的服务要在实体里返回 `@odata.etag` |
| 4 | 列表页表格和视图 | 默认 PV 里 LineItem 的选择按 SPV → PV → LineItem；PV 第一个可视化是 Chart 时只显示图表；视图没写排序时不再用默认 PV 的排序，视图自己的 `RequestAtLeast` 生效；视图 PV 里有 Chart 时不再自动出现表格 / 图表切换 | 行为 |
| 4 | 图表 | 类型按 FE 的 38 种映射，`data-sk-chart` 的值是 sap.chart 的名字（`stacked_column`、`line`、`donut`…）；标题只取 `UI.Chart/Title`；按 PV 的 SortOrder 排序；`Chart.Actions`（非绑定）；没有 `ApplySupported` 的实体不显示图表 | 行为；部分类型（双轴、组合、散点、气泡、热图、树图、瀑布、子弹）是近似画法 |
| 4 | 不设 `type` 的表格 | 按注解自动选：`ApplySupported` 齐全 → AnalyticalTable；成对的 `RecursiveHierarchy` → TreeTable，默认展开 `InitialExpansionLevel` + 1 层 | 行为（FE 默认 ResponsiveTable 的问题在阶段 5 定） |
| 4 | `UI.KPI` | 列表页标题旁的 KPI 标签（`v4/fe/macros/KPITag`）；模板新属性 `keyPerformanceIndicators`（阶段 5 按 manifest 改名） | 新增 |
| 4 | core 新导出 | `strictestExpression`、`ALLOWED_EXPRESSIONS_PRIORITY`、`relativeDateValueTypes`、`COUNT_DATE_OPERATORS`、`FIXED_DAY_OPERATORS`、`MDC_DATE_OPERATORS`、`setDefaultWeekStart`、`formatDateTimeWithTimezone`、`formatTimezone`；`PropertyModel.valueLists`、`capabilities.caseInsensitive`、`QueryRequest.caseInsensitive` 等（见 `packages/core/docs/reference.md`） | 新增 |
| 4 收尾 | 分析表的请求（未分组） | 一个 FE 形状的 `$apply`（`concat`）同时取首页行、合计和条数；排序只对分组或聚合的属性生效（默认的日期排序不再发出）；不可分组的列在行显示后逐行补读（先空一下）；工具栏动作的可用性在选中行时才读；首请求失败时表格显示错误，没有合计行 | **自己的服务要支持 `$apply` 的 `concat`、`orderby`、`top`、`skip`、`identity`**（smart-kit-server 已支持） |
| 4 收尾 | 分析表的搜索框 | 只在 `Aggregation.ApplySupported/Transformations` 含 `search` 时显示 | 行为 |
| 4 收尾 | `Common.ValueListReferences` | 筛选栏的值帮助从引用的值帮助服务加载 `$metadata` 和数据 | 新增；自己的 `DataProvider` 可实现可选的 `valueListService` |
| 4 收尾 | 值帮助的请求和显示 | 对话框的键列显示"文字 (代码)"，文字参数不单独成列；类型提示和固定值请求不带 `$count`；手输值按 `键 eq v or 文字 eq v`、`$top=2` 校验 | 行为 |
| 4 收尾 | 参数化实体集（`Common.ResultContext`） | `SmartListReport entitySet="P/Set"`：参数是最前面的必填字段，请求 `/P(…)/Set`；任何 SelectionVariant 的 Parameters 都成为条件 | 新增；`sourcePath` 多一个参数 |
| 4 收尾 | 常量 `UI.Criticality` 的行高亮 | 不高亮（真 FE 如此）；路径值照旧 | 行为 |
| 4 收尾 | 日期时间 | 显示到秒（medium） | 行为 |
| 4 收尾 | 表格个性化 | 列面板先显示中的列，再按字母序；排序和响应式表的分组选项是全部可排序属性（不含 NonSortable 和只显示文本的属性，另有文本和 criticality 属性） | 行为：例如按"Status Name"分组 |
| 4 收尾 | 工具栏和删除确认 | 动作放得下时不进"更多"；删除确认分单复数 | 行为 |
| 4 收尾 | core 新导出 | `buildAnalyticalRequests`、`ANALYTICAL_COUNT_ALIAS`、`readValueListService`、`referencedValueLists`、`resolveValueListReference`、`serviceRootOf`；`QueryRequest.analytical` / `anyOfOnly`、`QueryResult.grandTotal`、`EntitySetModel.parameters`、`PropertyModel.valueListReferences` 等 | 新增 |
