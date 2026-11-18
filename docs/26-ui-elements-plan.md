# 26 通用控件（参照 SAP Fiori UI Elements）

> 状态：进行中 · 2026-11-17（讨论记录 D31，ADR-032）。第 3 节已对照 SAPUI5 1.154.0 的 api.json 核实（附录 `26a-ui5-api-1.154.md`，结果见第 6 节）。来源：SAP Fiori Design Guidelines for Web v1.154 的 UI Elements 清单（198 项），用户选了第一梯队、第二梯队和五个消息控件。

## 1. 范围

| 组 | 控件（与 SAPUI5 同名） | SAPUI5 出处 | 子路径 |
| --- | --- | --- | --- |
| 消息 | `MessageToast`、`MessageBox`、`MessageStrip`、`MessageView` + `MessageItem`、`MessagePopover` | sap.m | `/messages` |
| 对象显示 | `ObjectStatus`、`ObjectIdentifier`、`ObjectNumber`、`ObjectMarker`、`ToggleButton` | sap.m | `/controls` |
| 状态与空状态 | `IllustratedMessage`、`BusyIndicator`、`BusyDialog` | sap.m | `/controls` |
| 文本与数值 | `Currency`、`ExpandableText` | sap.ui.unified、sap.m | `/controls` |
| 工具栏 | `OverflowToolbar`、`ToolbarSpacer` | sap.m | `/controls` |
| 流程 | `ProcessFlow`、`MicroProcessFlow` + `MicroProcessFlowItem`、`Timeline` | sap.suite.ui.commons | `/controls` |
| 协作 | `FeedInput`、`FeedListItem`、附件上传 `UploadSetwithTable` + `UploadItem` | sap.m、sap.m.upload、sap.m.plugins | `/controls` |
| 选择与设置 | `DynamicDateRange`、`SelectDialog`、`TableSelectDialog`、`ViewSettingsDialog` | sap.m | `/controls` |
| 导航 | `Wizard` + `WizardStep`、`IconTabBar` + `IconTabFilter` + `IconTabSeparator` | sap.m | `/controls` |
| 层级表 | `SmartTable tableType="TreeTable"`（`Hierarchy.RecursiveHierarchy`） | sap.ui.comp.smarttable、sap.ui.table.TreeTable | `/table` |

清单里有、但这里**不单独做**的：

- **Flag and Favorite**：SAPUI5 没有这个控件，它是一种用法：显示用 `ObjectMarker type="Flagged" / "Favorite"`，切换用 `ToggleButton`（图标 flag / favorite）。两个都做。
- **Placeholder Loading / Busy State**：SAPUI5 里是每个控件的 `busy`、`busyIndicatorDelay` 属性，以及 Fiori elements 内部的占位页，没有公开控件名。本库的积木已经各自有加载占位；独立的骨架屏用 Mantine 的 `Skeleton`。这里只做有公开名字的 `BusyIndicator`、`BusyDialog`。
- **Footer Toolbar**：在 SAPUI5 里是放在 DynamicPage / ObjectPageLayout `footer` 里的 `OverflowToolbar`。本库的 `DynamicPage` 已经有 `footer`，这里补 `OverflowToolbar`、`ToolbarSpacer`。

## 2. 命名约定（ADR-032）

用户是 UI5 开发者，从 UI5 换过来时不用重新学（D20、D31）。规则：

1. **控件名**和 SAPUI5 的类名相同（去掉命名空间）。和 Mantine 重名时（例如 `Timeline`）以本库为准，本库内部不用 Mantine 的同名组件。
2. **属性**：名字、默认值和取值都和 SAPUI5 相同（`showCloseButton`、`emphasized`、`maxCharacters`……）。宽度、高度等 `sap.ui.core.CSSSize` 属性接受 CSS 长度字符串。
3. **枚举**：取 SAPUI5 枚举的值，即首字母大写的字符串：`'Error' | 'Warning' | 'Success' | 'Information' | 'None'`（`MessageType`、`ValueState`），`'Indication01'`～`'Indication08'`（`IndicationColor`），`'Flagged' | 'Favorite' | …`（`ObjectMarkerType`）。这些类型同名导出，同时导出同名的常量对象，所以 `MessageBox.Action.OK`、`ValueState.Error` 都可以写。core 的 `Message.type`（小写）保持不变，由 `messageTypeOf()` 转换。
4. **聚合**：
   - 子控件有自己的外观时，用 JSX 子元素：`<IconTabBar><IconTabFilter key="all" text="全部" count={120}>…</IconTabFilter></IconTabBar>`，`<MessageView><MessageItem type="Error" title="…" /></MessageView>`，`<Wizard><WizardStep title="…">…</WizardStep></Wizard>`。UI5 的 `key` 属性就用 React 的 `key`（组件从子元素上读）。
   - 只是数据时，用同名的数组属性：`ProcessFlow` 的 `lanes`、`nodes`；`ViewSettingsDialog` 的 `sortItems`、`groupItems`、`filterItems`；`TableSelectDialog` 的 `columns`、`items`。数组元素的字段名和 UI5 子控件的属性名相同（`ProcessFlowNode.children` 是子节点 id 数组，和 UI5 一样）。
5. **事件**：`on` + 首字母大写的 UI5 事件名（`press` → `onPress`，`itemSelect` → `onItemSelect`，`close` → `onClose`）。处理函数收到一个对象，字段是 UI5 事件参数的名字（`oEvent.getParameter('selectedItems')` → `e.selectedItems`）。UI5 里可以 `preventDefault()` 的事件，对象上也有 `preventDefault()`。
6. **方法**：
   - 静态方法（`MessageToast.show`、`MessageBox.confirm`、`DynamicDateRange.toDates`）就是同名的静态函数。
   - 实例方法（`openBy`、`close`、`isOpen`、`toggle`、`open`、`navigateBack`、`nextStep`、`goToStep`、`validateStep`……）通过 `ref` 调用：`const ref = useRef<MessagePopoverRef>(null); ref.current?.openBy(button)`。
   - `getXxx` / `setXxx` 不提供：React 里就是属性。
7. **不做**：数据绑定（`items="{/Products}"`、`selectedContexts`）、`styleClass`、`textDirection`、`ariaLabelledBy` 一类关联（用标准 `aria-*` 属性）、`tooltip`（用 `title`）。
8. **扩展**（UI5 没有、本库多出来的）标在 TSDoc 里，写成"扩展："开头。目前有：`MessageBox.*` 返回 `Promise<action>`；`MessageView` / `MessagePopover` 的 `items` 数组属性（直接传 core 的 `Message[]`）；`SelectDialog` 没有 `onSearch` / `onLiveChange` 时按标题和描述在客户端筛选。

`MessageToast`、`MessageBox` 是全局调用，要有一个宿主：`SmartKitProvider` 里自动放一个 `MessageHost`；不用 `SmartKitProvider` 的应用在 `MantineProvider` 里放 `<MessageHost />`。

## 3. 各控件的 API（已对照 1.154 核实）

**依据**：`26a-ui5-api-1.154.md`，从 SAPUI5 1.154.0 的 `api.json` 生成，列出每个控件公开、未废弃的全部属性、聚合、事件和方法。默认值有疑问的，另读了 1.154.0 的源码：`MessageBox-dbg.js`、`ObjectMarker-dbg.js`、`Currency-dbg.js`、`ExpandableText-dbg.js`。

**做多少**：每个控件实现 `26a` 里列出的**全部**属性、事件和方法，只有下面写明"不做"的除外。所以本节只写三类内容：不做的、和 UI5 写法不同的、核实时改掉的（核实结果见第 6 节）。

所有控件都不做：
- 数据绑定和 `*Binding` 参数
- `textDirection`、`styleClass`
- `iconDensityAware` / `customIconDensityAware`
- `aria*` 关联（用标准 `aria-*` 属性代替）
- `ariaProperties` 聚合
- `asyncDescriptionHandler` / `asyncURLHandler`
- 云文件选择器（`cloudFilePicker*`）

**图标**：UI5 的图标属性（`icon`、`customIcon`、`iconSrc`、`activeIcon`，类型是 `sap.ui.core.URI`）指向 SAP 的图标字体，本库没有这套字体。这些属性改为接收 `ReactNode`（例如 lucide 图标）。`sap-icon://flag` 这类内置图标由控件自己画。

### 3.1 消息（`/messages`）

#### MessageToast

`MessageToast.show(message, mOptions)` 的选项和默认值：

| 选项 | 默认值 | 说明 |
| --- | --- | --- |
| `duration` | 3000 | |
| `width` | '15em' | |
| `my` / `at` | 'CenterBottom' | `sap.ui.core.Popup.Dock` 的 15 个值 |
| `of` | 窗口 | 也可以传 DOM 元素 |
| `offset` | '0 0' | |
| `collision` | 'fit fit' | |
| `onClose` | | |
| `autoClose` | true | |
| `animationTimingFunction` | 'ease' | |
| `animationDuration` | 1000 | |
| `closeOnBrowserNavigation` | true | 本库没有路由，接受但不起作用 |

#### MessageBox

- 方法：`show`、`alert`、`confirm`、`error`、`information`、`warning`、`success`；常量 `MessageBox.Action`、`MessageBox.Icon`。
- 选项：
  - `icon`（只有 `show` 有）、`title`、`actions`、`emphasizedAction`、`onClose`、`id`、`initialFocus`
  - `details`：字符串、对象，或返回 Promise 的函数
  - `contentWidth`、`verticalScrolling`、`horizontalScrolling`
  - `closeOnNavigation`、`dependentOn`：接受但不起作用
- 各方法的默认按钮（按源码）：

  | 方法 | 默认按钮 | 其他默认值 |
  | --- | --- | --- |
  | `alert` | OK | 标题"Alert" |
  | `confirm` | OK + CANCEL | 图标 QUESTION |
  | `error` | CLOSE | 不强调任何按钮 |
  | `information` / `warning` / `success` | OK | |

- 强调按钮的规则（按源码）：
  - **快捷方法只在没传 `actions` 时强调 OK。**
  - `show` 的 `actions` 传单个值（不是数组）时，这个值就是强调按钮，除非写了 `emphasizedAction: null`。快捷方法传了 `actions` 就不强调任何按钮，除非自己写 `emphasizedAction`。
  - `show` 带 `details` 时，图标默认 INFORMATION，按钮默认 OK + CANCEL。
- 按 Esc 关闭时调用 `onClose(null)`。
- 扩展：所有方法返回 `Promise<action>`。

#### MessageStrip

- 属性：
  - `text`
  - `type`：默认 'Information'；传 'None' 时按 Information 处理
  - `colorSet`：'Default' | 'ColorSet1' | 'ColorSet2'（1.143 新增）
  - `colorScheme`：1–10
  - `customIcon`、`showIcon`、`showCloseButton`
  - `enableFormattedText`：不解析 HTML，改用 `children`
- 聚合：`link`、`controls`（多个链接）。
- 事件 `close`；方法 `close()`。

#### MessageView 和 MessageItem

**MessageView**：
- 属性：`groupItems`、`showDetailsPageHeader`。
- 聚合：
  - `items`：`MessageItem` 子元素。扩展：也可以用 `items` 数组属性直接传 core 的 `Message[]`。
  - `headerButton`
- 事件：`itemSelect({ item, messageTypeFilter })`、`listSelect({ messageTypeFilter })`、`activeTitlePress({ item })`、`longtextLoaded`、`urlValidated`。
- 方法：`navigateBack()`。
- `afterOpen` 已废弃，不做。

**MessageItem**：
- 属性：`type`（默认 'Error'）、`title`、`subtitle`、`description`、`counter`、`groupName`、`activeTitle`
  - `markupDescription`：说明当纯文本显示
  - `longtextUrl`：用 fetch 读成纯文本
- 聚合：`link`。

#### MessagePopover

- 属性：
  - `placement`：`VerticalPlacementType`，只有 'Vertical' | 'Top' | 'Bottom'，默认 'Vertical'
  - `initiallyExpanded`：默认 true
  - `groupItems`
- 聚合：`items`、`headerButton`。
- 事件：`beforeOpen` / `afterOpen` / `beforeClose` / `afterClose`，参数都是 `{ openBy }`；另有 `MessageView` 的四个事件。
- 方法：`openBy(control)`、`close()`、`isOpen()`、`toggle(control)`、`navigateBack()`。

`MessageButton`（页脚的消息按钮，ADR-023）改为在内部使用 `MessagePopover`，外部用法不变。

### 3.2 对象显示

#### ObjectStatus

- 属性：`title`、`text`、`active`、`inverted`、`icon`、`stateAnnouncementText`
  - `state`：`ValueState` 或 `IndicationColor`，默认 'None'
  - `emptyIndicatorMode`：默认 'Off'
  - `reactiveAreaMode`：'Inline' | 'Overlay'
- 事件 `press`。

#### ObjectIdentifier

- 属性：`title`、`text`、`titleActive`、`emptyIndicatorMode`、`reactiveAreaMode`。
- 事件 `titlePress({ domRef })`。

#### ObjectNumber

- 属性：`number`、`unit`、`state`、`active`、`inverted`、`maxPrecision`、`emptyIndicatorMode`、`reactiveAreaMode`
  - `emphasized`：默认 true
  - `textAlign`：默认 'Begin'
  - `displayMode`：'Default' | 'Currency' | 'Unit'
  - `useSymbol`：默认 true
- 事件 `press`。

#### ObjectMarker

- 属性：
  - `type`：没有默认值
  - `visibility`：没有默认值。不设时按类型决定：

    | 类型 | 显示 |
    | --- | --- |
    | Flagged、Favorite | 只显示图标 |
    | Draft | 只显示文字 |
    | Locked、Unsaved、LockedBy、UnsavedBy | 窄屏只显示图标，宽屏显示图标和文字 |

  - `additionalInfo`、`reactiveAreaMode`
- 事件 `press({ type })`。

#### ToggleButton

- 属性：`pressed`，以及 `sap.m.Button` 的全部属性：`text`、`type`（`ButtonType`，14 个值）、`width`、`enabled`、`icon`、`iconFirst`、`activeIcon`、`ariaHasPopup`、`accessibleRole`、`badgeStyle`。
- 事件 `press({ pressed })`。

### 3.3 状态与空状态

#### IllustratedMessage

- 属性：
  - `illustrationType`：默认 **'NoSearchResults'**；只做未废弃的类型
  - `illustrationSize`：'Auto' | 'Base' | 'ExtraSmall' | 'Small' | 'Medium' | 'Large'。Dot、Spot、Dialog、Scene 已废弃，不做
  - `title`、`description`
  - `enableDefaultTitleAndDescription`：默认 true
  - `enableFormattedText`：不解析 HTML
  - `enableVerticalResponsiveness`、`ariaTitleLevel`、`decorative`
- 聚合 `additionalContent`。
- 不做：`src`（自定义插画文件）。
- 插画由本库自己画。

#### BusyIndicator

- 属性：`text`、`size`（默认 '1rem'）、`customIcon`、`customIconRotationSpeed`（默认 1000）、`customIconWidth` / `customIconHeight`。
- **没有延迟显示**：`busyIndicatorDelay` 是控件"忙"状态用的属性，不属于这个控件。

#### BusyDialog

- 属性：`text`、`title`、`titleAlignment`、`customIcon` 及其尺寸和转速、`cancelButtonText`、`showCancelButton`。
- 事件 `close({ cancelPressed })`。
- 方法 `open()`、`close(isClosedFromUserInteraction?)`。

### 3.4 文本与数值

#### Currency（sap.ui.unified）

- 属性：
  - `value`：float，默认 0
  - `stringValue`、`currency`
  - `maxPrecision`：不设时按币种的小数位
  - `useSymbol`：默认 true
  - `emptyIndicatorMode`
- 对齐方式和源码一样：用 figure space（U+2007）和 punctuation space（U+2008）补位。

#### ExpandableText

- 属性：`text`、`wrappingType`、`textAlign`、`renderWhitespace`
  - `overflowMode`：'InPlace' | 'Popover'
  - `maxCharacters`：默认 100
  - `expanded`：默认 false
  - `emptyIndicatorMode`

### 3.5 工具栏

#### OverflowToolbar

- 继承 `sap.m.Toolbar` 的属性：`width`、`active`、`enabled`、`height`、`design`（默认 'Auto'）、`style`（默认 'Standard'）、`ariaHasPopup`；事件 `press({ srcControl })`。
- 自己的属性 `asyncMode`；方法 `closeOverflow()`。

#### OverflowToolbarLayoutData

- 写法：子元素上加 `layoutData={{ priority: 'Low' }}` 属性，由工具栏读取。
- 字段：
  - `priority`：'NeverOverflow' | 'High' | 'Low' | 'Disappear' | 'AlwaysOverflow'，默认 'High'
  - `group`
  - `closeOverflowOnInteraction`：默认 true

#### ToolbarSpacer

- 属性 `width`。

### 3.6 流程

#### ProcessFlow

- 属性：`foldedCorners`、`scrollable`（默认 true）、`wheelZoomable`（默认 true）、`showLabels`。
- 聚合：`lanes`、`nodes`（数组）。
- 事件：`nodePress`、`labelPress`、`headerPress`、`onError`；参数分别是节点、标签、泳道对象本身。
- 方法：`zoomIn()`、`zoomOut()`、`getZoomLevel()`、`setZoomLevel(level)`、`getFocusedNode()`、`setSelectedPath(sourceNodeId, targetNodeId)`、`optimizeLayout(isOptimized)`。
- **`ProcessFlow` 没有 `zoomLevel` 属性**：缩放只能通过方法改，初始级别按宽度自动选。
- `nodeTitlePress` 已废弃，不做。

#### ProcessFlowLaneHeader

- 属性：`laneId`、`iconSrc`、`text`、`position`、`state`（`{ state, value }[]`）、`zoomLevel`。
- 事件 `press`。

#### ProcessFlowNode

- 属性：
  - `nodeId`、`laneId`、`title`、`titleAbbreviation`
  - `state`：默认 'Neutral'
  - `stateText`
  - `type`：'Single' | 'Aggregated'
  - `children`：节点 id 数组，或 `{ nodeId, connectionLabel }` 数组。标签对应 `ProcessFlowConnectionLabel`（`text`、`icon`、`priority`、`state`）
  - `texts`、`highlighted`、`focused`、`selected`、`tag`、`parents`
- 聚合：`zoomLevelOneContent`～`zoomLevelFourContent`（自定义节点内容）。
- 初稿里的 `isTitleClickable` 在 UI5 里不存在，已删去。

#### MicroProcessFlow（sap.suite.ui.commons）

- 属性：`ariaLabel`、`width`
  - `renderType`：'Wrap' | 'NoWrap' | 'Scrolling' | 'ScrollingWithResizer'
- 聚合 `content`：`MicroProcessFlowItem` 子元素。

#### MicroProcessFlowItem

- 属性：`key`、`icon`、`title`、`state`、`showIntermediary`、`stepWidth`、`showSeparator`（默认 true）。
- 聚合：`customControl`、`intermediary`。
- 事件 `press({ item })`，可以 `preventDefault`。

#### Timeline

- 属性（括号里是默认值）：
  - 外观：`alignment`（'Right'）、`axisOrientation`（'Vertical'）、`enableDoubleSided`、`showIcons`、`width`（'100%'）、`height`、`textHeight`、`noDataText`
  - 行为：`enableBusyIndicator`、`enableModelFilter`、`enableScroll`、`enableSocial`、`forceGrowing`、`growingThreshold`（5）、`sort`（true）、`sortOldestFirst`
  - 分组：`groupBy`（字段名）、`groupByType`（'None'）
  - 页头栏：`showHeaderBar`、`showSearch`、`showSort`、`showItemFilter`、`showTimeFilter`、`filterTitle`
  - `dateTimePath`、`lazyLoading`：依赖数据绑定，接受但不起作用
- 聚合：`content`（`TimelineItem` 子元素）、`customFilter`、`filterList`。
- 事件：
  - `select({ selectedItem, userAction })`
  - `grow`、`filterOpen`、`customMessageClosed`
  - `filterSelectionChange({ type, searchTerm, selectedItem, selectedItems, timeKeys, clear })`
  - `itemFiltering`：可以 `preventDefault`
- 方法：`reset()`、`resetTimeLimits()`、`adjustUI()`。

#### TimelineItem

- 属性：
  - 内容：`dateTime`、`title`、`text`、`status`、`filterValue`、`maxCharacters`、`replyCount`
  - 用户：`userName`、`userNameClickable`、`userPicture`
  - 图标：`icon`、`iconDisplayShape`、`iconInitials`、`iconSize`（默认 'XS'）、`iconTooltip`、`useIconTooltip`
- 聚合：`customAction`、`customReply`、`embeddedControl`。
- 事件：
  - **`userNameClicked({ uiElement })`**：初稿写成 `userNamePress`，已改
  - `select`、`press`、`replyPost({ value })`、`replyListOpen`
  - `customActionClicked({ value, key, linkObj })`

### 3.7 协作

#### FeedInput

- 属性（括号里是默认值）：
  - `value`、`enabled`、`rows`（2）、`maxLength`（0）、`showExceededText`、`growing`、`growingMaxLines`（0）
  - `placeholder`：默认文案 "Post something here"，中文"发表内容"
  - `buttonTooltip`："Submit"
  - 头像：`icon`、`iconDisplayShape`、`iconInitials`、`iconSize`（'M'）、`showIcon`（true）
- 聚合 `actions`。
- 事件 `post({ value })`。

#### FeedListItem

- 属性：
  - 内容：`sender`、`text`、`info`、`timestamp`、`maxCharacters`、`moreLabel`、`lessLabel`
  - 头像：`icon`、`activeIcon`、`iconDisplayShape`、`iconInitials`、`iconSize`（默认 'S'）、`showIcon`
  - 可点：`senderActive`、`iconActive`
  - 链接：`convertLinksToAnchorTags`（默认 'None'）、`convertedLinksDefaultTarget`
  - 继承 `ListItemBase` 的：`type`、`unread`、`selected`、`counter`、`highlight`、`highlightText`、`navigated`
- 聚合 `actions`：`FeedListItemAction`（`key`、`text`、`icon`、`enabled`、`visible`，事件 `press`）。
- 事件：`senderPress({ domRef })`、`iconPress({ domRef })`、`press`、`detailPress`。

#### 附件上传：UploadSetwithTable + UploadItem（V-1 定为这个）

UI5 里 `UploadSetwithTable` 是挂在 `sap.m.Table` 上的插件，文件行来自表格的行绑定。React 里没有插件机制，本库把"表格 + 插件"做成一个控件 `UploadSetwithTable`：它自己画文件表格，表格以外的 API 和 UI5 一致。

- 属性：`fileTypes`、`maxFileNameLength`、`maxFileSize`（MB）、`mediaTypes`、`uploadUrl`、`httpRequestMethod`（'Post' | 'Put'）、`multiple`、`uploadButtonInvisible`、`uploadEnabled`、`itemValidationHandler`（`(info: { oItem, iTotalItemsForUpload, oSource }) => Promise<UploadItem>`）、`directory`、`fileNameValidationConfig`（`{ mode: 'include' | 'exclude' | 'override', characters }`）。
- 聚合：
  - `items`：`UploadItem` 数组（代替 UI5 的行绑定 + `rowConfiguration`）。`UploadItem` 字段：`fileName`、`mediaType`、`url`、`uploadUrl`、`uploadState`（`UploadState`：'Ready' | 'Uploading' | 'Complete' | 'Error'）、`previewable`、`fileSize`、`isTrustedSource`、`isDirectory`、`headerFields`。
  - `headerFields`：`{ name, value }[]`。
  - `uploader`：`UploaderTableItem`（`uploadUrl`、`downloadUrl`、`httpRequestMethod`、`useMultipart`，事件 `uploadStarted`、`uploadProgressed`、`uploadCompleted`、`uploadTerminated`）。
  - `noDataIllustration`：`IllustratedMessage`。
  - `actions`：工具栏上的按钮；上传按钮的位置对应 `ActionsPlaceholder`（`UploadButtonPlaceholder`）。
  - 表格列：扩展 `columns`（自定义附加列）；默认列是文件名（图标或缩略图）、大小、状态、操作。
- 事件：`itemRenamed`、`itemRenameCanceled`、`beforeUploadStarts`（可阻止）、`uploadCompleted({ item, response, readyState, status, responseXML, responseText, headers })`、`fileTypeMismatch`、`fileNameLengthExceeded`、`fileSizeExceeded`、`mediaTypeMismatch`、`beforeInitiatingItemUpload`；`onActivated` / `onDeactivated` 是插件生命周期，不做。
- 方法（ref）：`fileSelectionHandler()`（打开选文件对话框）、`download(item, askForLocation)`、`openFilePreview(item)`（`FilePreviewDialog`：图片、PDF 预览，`showCarouselArrows`、`maxFileSizeforPreview`）、`renameItem(item)`、`uploadItemViaUrl(name, url, promise)`、`uploadItemWithoutFile(promise)`；`UploadItem` 的 `download`、`terminateUpload`。
- 不做：云文件选择器（`cloudFilePicker*`）。

### 3.8 选择与设置

#### DynamicDateRange

- 属性：
  - `value`：`{ operator, values }`
  - **`standardOptions`**：初稿写成 `options`，已改。默认值是 1.154 的 68 个选项，见 `26a`
  - `enableGroupHeaders`：默认 true
  - 其他：`width`、`enabled`、`editable`、`required`、`name`、`placeholder`、`valueState`、`valueStateText`、`formatter`、`hideInput`、`showClearIcon`、`calendarWeekNumbering`
- 聚合 `customOptions`：`DynamicDateOption`（`key`、`valueTypes`、`format`、`parse`、`toDates`、`createValueHelpUI`）。
- 事件 `change({ value, valid })`。
- 方法：`open(domRef)`、`openBy(domRef)`、`toDates(value)`；静态方法 `DynamicDateRange.toDates(value, calendarWeekNumbering)`，返回 `Date[]`。
- 分钟、小时类选项（`LASTMINUTES`、`DATETIME`、`DATETIMERANGE` 等）也做。

#### SelectDialog

- 属性：
  - `title`、`noDataText`、`multiSelect`、`rememberSelections`、`showClearButton`、`confirmButtonText`、`searchPlaceholder`
  - `growing`（默认 true）、`growingThreshold`（不设时用列表的默认值 20）
  - `contentWidth`、`contentHeight`、`draggable`、`resizable`、`titleAlignment`
  - `initialFocus`：'List' | 'SearchField'
- 聚合 `items`：`StandardListItem` 数组。
  - 自己的字段：`title`、`description`、`icon`、`iconInset`、`activeIcon`、`info`、`infoState`、`infoIcon`、`infoStateInverted`、`adaptTitleSize`、`wrapping`、`wrapCharLimit`
  - 继承 `ListItemBase` 的：`type`、`selected`、`counter`、`highlight`、`unread`
- 事件：
  - `confirm({ selectedItem, selectedItems })`、`cancel`
  - `search({ value, clearButtonPressed })`、`liveChange({ value })`
  - `selectionChange({ listItem, listItems, selected, selectAll })`
  - `updateStarted` / `updateFinished`：参数 `{ reason, actual, total }`
- 方法：`open(searchValue)`、`clearSelection()`。
- **UI5 没有公开的 `close()`**，初稿里的 `close` 已删去。

#### TableSelectDialog

- 和 SelectDialog 相同，但没有 `clearSelection()`。
- `items` 是 `ColumnListItem`：`cells`、`vAlign`。
- 另有 `columns`：`Column` 的字段是 `header`、`footer`、`width`、`hAlign`、`vAlign`、`visible`、`minScreenWidth`、`demandPopin`、`popinDisplay`、`mergeDuplicates`、`sortIndicator`、`importance`、`autoPopinWidth`。

#### ViewSettingsDialog

- 属性：`title`、`sortDescending`、`groupDescending`、`filterSearchOperator`（默认 'StartsWith'）、`titleAlignment`。
- 聚合：`sortItems`、`groupItems`、`filterItems`、`presetFilterItems`、`customTabs`。
- 关联（传 key）：`selectedSortItem`、`selectedGroupItem`、`selectedPresetFilterItem`。
- 事件：
  - `confirm({ sortItem, sortDescending, groupItem, groupDescending, presetFilterItem, filterItems, filterKeys, filterCompoundKeys, filterString })`
  - `cancel`、`reset`、`resetFilters`
  - `filterDetailPageOpened({ parentFilterItem })`
  - `beforeClose`：可以 `preventDefault`
- 方法：`open(pageId?)`、`clearFilters()`。**没有公开的 `close()`。**
- `ViewSettingsItem`：`key`、`text`、`enabled`、`selected`、`wrapping`。`ViewSettingsFilterItem` 另有 `multiSelect`（默认 true）和 `items`。

### 3.9 导航

#### Wizard

- 属性（括号里是默认值）：`width`（'auto'）、`height`（'100%'）、`showNextButton`（true）、`finishButtonText`（'Review'）、`enableBranching`、`backgroundDesign`（`PageBackgroundDesign` 'Standard'）、`renderMode`（'Scroll'）、`stepTitleLevel`（'H3'）。
- 聚合 `steps`：`WizardStep` 子元素。
- 关联 `currentStep`：传步骤 id。
- 事件：`stepActivate({ index })`、`navigationChange({ step })`、`complete`。
- 方法：
  - 前后移动：`nextStep()`、`previousStep()`、`goToStep(step, focusFirstStepElement)`
  - 校验：`validateStep(step)`、`invalidateStep(step)`、`discardProgress(step, preserveNextStep)`
  - 查询：`getProgress()`、`getProgressStep()`、`getCurrentStep()`

#### WizardStep

- 属性：
  - `id`：控件 id，被 `nextStep`、`subsequentSteps`、`currentStep` 引用
  - `title`、`icon`、`validated`（默认 true）、`optional`
- 关联：`nextStep`、`subsequentSteps`。
- 事件：`activate`、`complete`。

#### IconTabBar

- 属性（括号里是默认值）：
  - 选择与展开：`selectedKey`、`expandable`（true）、`expanded`（true）
  - 外观：`upperCase`、`stretchContentHeight`、`applyContentPadding`（true）、`backgroundDesign`（'Solid'）、`headerMode`（'Standard'）、`headerBackgroundDesign`（'Solid'）
  - **`tabDensityMode`**：枚举名是 `IconTabDensityMode`
  - 其他：`enableTabReordering`、`maxNestingLevel`（0）、`ariaTexts`、`tabsOverflowMode`（'End' | 'StartAndEnd'）
- 聚合：`items`；`content`（各页签共用的内容）。
- 事件：`select({ item, key, previousKey, selectedItem, selectedKey })`、`expand({ expand, collapse })`。

#### IconTabFilter

- 属性：
  - `key`：就是 React 的 key
  - `text`、`enabled`、`count`（字符串）、`showAll`、`icon`、`visible`
  - `iconColor`：`IconColor` 的 9 个值：'Default' | 'Positive' | 'Critical' | 'Negative' | 'Neutral' | 'Contrast' | 'Marker' | 'NonInteractive' | 'Tile'
  - `design`：默认 'Vertical'
  - `interactionMode`：'Auto' | 'Select' | 'SelectLeavesOnly'
- 聚合：`content`（子元素内容）、`items`（下级页签）。

#### IconTabSeparator

- 属性：`icon`、`visible`。

### 3.10 层级表

- `SmartTable` 的 `tableType` 取值和 `sap.ui.comp.smarttable.TableType` 一致，新增 'TreeTable'。
- 树表的方法和事件和 `sap.ui.table.TreeTable` 一致：
  - 方法：`expand(rowIndex)`、`collapse(rowIndex)`、`collapseAll()`、`expandToLevel(level)`、`isExpanded(rowIndex)`
  - 事件：`toggleOpenState({ rowIndex, rowContext, expanded })`
- 数据：
  - 注解：`Hierarchy.RecursiveHierarchy` + `Aggregation.RecursiveHierarchy`
  - 请求：`$apply=com.sap.vocabularies.Hierarchy.v1.TopLevels(...)`
  - `MemoryProvider` 和测试服务支持；自写服务先不做。
- 做法（2026-11-17，验收 UE-80～UE-89）：
  - `SmartTable` 原来用 `mode`（grid / auto / responsive）选内核，新增的 `tableType` 取 UI5 的四个值：没给 `mode` 时，ResponsiveTable 用响应式内核，其余用表格内核（子表 auto）；AnalyticalTable 就是表格内核（分组和合计照旧由注解决定，见 `23`）。`SmartListReport` 原有的 `tableType`（grid / responsive / auto）同时接受这四个 UI5 值。
  - 另加 `hierarchyQualifier`（默认实体类型的第一个层级）、`initialExpansionLevel`（默认 1）、`onToggleOpenState`、`ref`（`SmartTableRef`）。
  - core：模型的 `EntityTypeModel.hierarchies`（`RecursiveHierarchyModel`），`hierarchyOf`、`buildHierarchyRequest`、`hierarchyNodeOf`，`QueryRequest.hierarchy` 由 `toQueryString` 转成 `$apply`。
  - 请求：每次展开、折叠都重发一次 TopLevels，`Levels` 加上各节点的 `ExpandLevels`（展开 1，按 Levels 已展开的节点折叠时为 0）；有筛选或搜索时前面加 `ancestors($root/…,限定符,节点字段,filter(…)/search(…),keep start)`，排序是 TopLevels 之前的 `orderby(…)`。和 fe-mockserver-core 1.8 核对过（`apps/mock` 的 `CostCenters`）。
  - 表格内核：AG Grid 社区版没有树数据，和分组一样用客户端行模型（`23` §9），第一列缩进加按钮，"+" / "-" 键展开、折叠。响应式内核用 treegrid 语义。
- 和 UI5 / Fiori elements 的差别：
  - 不分页：一次取回全部可见节点（Fiori elements 按 $skip/$top 分块）。标题不显示条数。
  - 展开时重发整个 TopLevels，而不是只读子节点的 `descendants(…,1)`；靠查询缓存，回到见过的展开状态时先显示缓存的结果。
  - fe-mockserver-core 不认 `ExpandLevels` 的 `Levels: 0`，客户端另外隐藏已折叠节点的后代（对遵守规范的服务没有影响）。
  - `toggleOpenState` 只在用户操作时触发，方法调用不触发；`rowContext` 是行数据，不是绑定上下文。
  - 树表不提供分组和合计；导出是平铺的行（不带层级）。`Hierarchy.RecursiveHierarchyActions`（拖放、剪切粘贴）没做。

## 4. 做法

- 代码在 `packages/react/src/controls/`（按组分子目录），消息控件在 `packages/react/src/messages/`。
- 样式写进 `styles.css`，只用令牌（`check-tokens`）；新增的尺寸进 `tokens.css` 第 3 层。
- 文案进 `i18n/messages.controls.{en,zh}.ts`。
- 每个控件：单元测试（`packages/react/test/controls-*.test.tsx`，测试名带验收编号 UE-xx）、Storybook 故事（`apps/storybook/stories/controls.stories.tsx`）、示例应用一页 `/controls`。
- 体积：`/controls` 的入口预算等做完再定，`/messages` 由 2 KB 往上调。

## 5. 验收条目

编号 UE-xx，写在 `27-ui-elements-acceptance.md`（UE-01～UE-79 已有，层级表是 UE-80～UE-89，附件上传做完再补）。

## 6. 对照 1.154 核实的结果（2026-11-17）

第 3 节的初稿是凭记忆写的。用户要求先核实再继续（见 D31 的补记）。下表是对照 `26a` 和源码后改掉的地方，只补全了属性、没有改原有写法的不列。

| 控件 | 初稿 | 1.154 实际 |
| --- | --- | --- |
| MessageBox | 快捷方法总是强调 OK | 快捷方法只在没传 `actions` 时强调 OK。`show` 的 `actions` 传单个值时，它自动成为强调按钮。`show` 带 `details` 时默认 OK + CANCEL、图标 INFORMATION |
| MessageToast | `at` 只有三个位置 | `my` / `at` 是 15 个 Dock 值。另有 `of`、`collision`、`animationTimingFunction`、`closeOnBrowserNavigation` |
| MessageStrip | 没有配色选项 | 1.143 起有 `colorSet`、`colorScheme`。另有多链接聚合 `controls` |
| MessageView | 有 `afterOpen` | `afterOpen` 已废弃。另有 `longtextLoaded`、`urlValidated`；MessageItem 有 `longtextUrl`、`link` |
| MessagePopover | `placement` 可以放左右 | 只有 Vertical / Top / Bottom。另有 `initiallyExpanded`、`beforeClose`、`afterOpen` |
| IndicationColor | 01～08 | 01～20 |
| ObjectMarker | Flagged、Favorite 只显示图标，其余显示图标和文字 | Draft 只显示文字。Locked 等在窄屏只显示图标 |
| ObjectNumber | 没有币种模式 | 有 `displayMode`、`maxPrecision`、`useSymbol` |
| IllustratedMessage | 默认 NoData。尺寸 Dot/Spot/Dialog/Scene。类型含 EmptyList、ErrorScreen、SuccessScreen | 默认 NoSearchResults。尺寸是 Base / ExtraSmall / Small / Medium / Large，旧的四个已废弃。那三个类型也已废弃 |
| BusyIndicator | 1 秒后才显示 | 没有延迟属性 |
| ExpandableText | 没有这两个属性 | 有 `expanded`、`textAlign` |
| OverflowToolbar | 用 `data-overflow-priority` 属性和常量 `OverflowToolbarPriority` | 用 `OverflowToolbarLayoutData`（`priority`、`group`、`closeOverflowOnInteraction`）。优先级有 `Disappear`。工具栏本身可以点（`active`、`press`） |
| ProcessFlow | 有 `zoomLevel` 属性和 `onNodeTitlePress`。节点有 `isTitleClickable` | 没有 `zoomLevel` 属性，只有方法。`nodeTitlePress` 已废弃。没有 `isTitleClickable`。另有 `labelPress`、`setSelectedPath`，节点有 `type`、`parents` |
| MicroProcessFlow | 在 sap.suite.ui.microchart | 在 sap.suite.ui.commons。渲染方式有 `Scrolling`；项目有 `key`、`stepWidth`，`press` 可以阻止 |
| Timeline | `onUserNamePress` | 是 `userNameClicked({ uiElement })`。`select` 带 `userAction`。默认 `alignment` 是 'Right'，`width` 是 '100%' |
| FeedInput | placeholder 是"发表评论" | 默认是 "Post something here"。`iconSize` 默认 'M'。有 `actions` 聚合 |
| UploadSet | 照做 | **1.129 起已废弃**，由 `UploadSetwithTable` 插件代替（V-1：用户请我决定，定为 `UploadSetwithTable`） |
| DynamicDateRange | 属性名 `options`，20 个选项 | 属性名是 `standardOptions`，默认 68 个选项（含分钟、小时、日期时间）。有 `open` / `openBy` 方法和 `hideInput`、`showClearIcon`、`required` |
| SelectDialog / ViewSettingsDialog | 有 `close()` | 都没有公开的 `close()`。SelectDialog 有 `clearSelection()`、`initialFocus`；ViewSettingsDialog 有 `clearFilters()`、`presetFilterItems`、`reset`、`beforeClose` |
| Wizard | `discardProgress(step)` | 是 `discardProgress(step, preserveNextStep)`。另有 `width`、`height`、`backgroundDesign`、`stepTitleLevel`、`getCurrentStep()` |
| IconTabBar | 枚举 `TabDensityMode`；IconColor 6 个值 | 枚举名是 `IconTabDensityMode`；IconColor 有 9 个值。另有 `tabsOverflowMode`、`headerBackgroundDesign`、`enableTabReordering`、下级页签和 `interactionMode` |

**V-1（已定）**：附件上传做 `UploadSetwithTable`。用户请我决定；它没有废弃，也是设计规范清单里的名字（第 3.7 节）。
