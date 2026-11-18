# 27 通用控件验收条目

> 状态：现行 · 2026-11-17（讨论记录 D31，ADR-032）。计划和 API 见 `26-ui-elements-plan.md`，API 依据见 `26a-ui5-api-1.154.md`。
>
> 写法沿用 `22-cards-acceptance.md`：每条一个编号 UE-xx，测试名称里带这个编号；`npm run trace -- --strict` 检查验收方式含 U 或 E 的条目都有**通过**的测试。
>
> 验收方式：U = 单元测试（`packages/react/test/controls-{messages,display,process,dialogs}.test.tsx`；层级表在 `packages/core/test/hierarchy.test.ts`、`packages/react/test/tree.test.tsx`）；E = 端到端（层级表：`tests/e2e/p6-tree.spec.ts`）；D = 只是说明。

## 消息（UE-01～UE-19）

| 编号 | 要求 | 出处 | 验收方式 |
| --- | --- | --- | --- |
| UE-01 | MessageToast.show 以 status 显示消息，duration 后开始淡出，再过 animationDuration 关闭并调用 onClose | sap.m.MessageToast | U |
| UE-02 | autoClose 时下一次点按就关闭；width、animationTimingFunction 生效；默认位置在窗口底部居中并留边距 | sap.m.MessageToast | U |
| UE-03 | MessageBox.confirm：标题"Confirmation"，确定 + 取消，强调确定；返回 Promise 并调用 onClose | sap.m.MessageBox | U |
| UE-04 | 快捷方法只在没传 actions 时强调确定；show 的单个 actions 值是强调按钮；emphasizedAction: null 优先 | sap.m.MessageBox（1.154 源码） | U |
| UE-05 | MessageBox.error：标题"Error"，只有关闭、不强调；Esc 关闭时结果为 null | sap.m.MessageBox | U |
| UE-06 | show 带 details：信息图标、确定 + 取消；"View Details"展开；details 为函数时点开才加载 | sap.m.MessageBox | U |
| UE-07 | initialFocus 按动作或按钮文字设置初始焦点；标题和按钮文字跟随 SmartKitProvider 的语言 | sap.m.MessageBox | U |
| UE-08 | 嵌套多个 SmartKitProvider 时只有一个 MessageHost 渲染，消息不重复 | docs/26 §2 | U |
| UE-09 | MessageStrip 按 type 着色、showIcon 显示图标，None 按 Information；关闭按钮和 ref.close() 触发 close | sap.m.MessageStrip | U |
| UE-10 | MessageStrip 的 colorSet（ColorSet1、ColorSet2）和 colorScheme 1～10；link 和 controls 显示在文字后 | sap.m.MessageStrip | U |
| UE-11 | MessageView 顶部按类型筛选（全部 + 各类型及数量，按错误、警告、成功、信息排序），触发 listSelect | sap.m.MessageView | U |
| UE-12 | 有说明的项目进入详情页并触发 itemSelect；ref.navigateBack() 和返回按钮回到列表 | sap.m.MessageView | U |
| UE-13 | groupItems 按 groupName 分组（无分组的在前）；只有一条消息时直接显示详情 | sap.m.MessageView | U |
| UE-14 | activeTitle 时标题是链接并触发 activeTitlePress；core 的消息作为项目显示（target 为副标题） | sap.m.MessageView、sap.m.MessageItem | U |
| UE-15 | longtextUrl 在详情页加载长文本并触发 longtextLoaded | sap.m.MessageItem | U |
| UE-16 | MessagePopover 的 toggle、openBy、close、isOpen，beforeOpen / afterOpen / beforeClose / afterClose 带 openBy，关闭后焦点回到打开它的控件 | sap.m.MessagePopover | U |
| UE-17 | initiallyExpanded=false 时只显示页头，选筛选后显示列表 | sap.m.MessagePopover | U |
| UE-18 | 页脚 MessageButton（ADR-023）改用 MessagePopover：数量、清除、带 target 的消息跳到字段 | ADR-023 | U |
| UE-19 | 没有 SmartKitProvider 时用英文，有时跟随它的语言 | docs/26 §2 | U |

## 对象显示、状态与工具栏（UE-20～UE-39）

| 编号 | 要求 | 出处 | 验收方式 |
| --- | --- | --- | --- |
| UE-20 | ObjectStatus 显示"标题:"和文本，按状态着色，并为读屏提供状态文字（stateAnnouncementText 可覆盖） | sap.m.ObjectStatus | U |
| UE-21 | ObjectStatus inverted 填充背景，IndicationColor Indication01～20 各有颜色 | sap.m.ObjectStatus | U |
| UE-22 | ObjectStatus active 时是按钮并触发 press，emptyIndicatorMode On 时空文本显示"–" | sap.m.ObjectStatus | U |
| UE-23 | ObjectIdentifier 显示粗体标题和文本，titleActive 时标题可点并触发 titlePress({ domRef }) | sap.m.ObjectIdentifier | U |
| UE-24 | ObjectNumber 显示数字和单位，默认粗体，支持 state、inverted、textAlign 和 active 的 press | sap.m.ObjectNumber | U |
| UE-25 | ObjectNumber displayMode Currency 按 Currency 的方式格式化（unit 作币种，maxPrecision 补位，useSymbol） | sap.m.ObjectNumber | U |
| UE-26 | ObjectMarker 不设 visibility 时按类型显示：Flagged/Favorite 只显示图标，Draft 只显示文字，Locked 等在窄屏只显示图标 | sap.m.ObjectMarker | U |
| UE-27 | ObjectMarker LockedBy/UnsavedBy 显示 additionalInfo 的人名（没有时显示"其他用户"），press({ type })，没有 type 时不渲染 | sap.m.ObjectMarker | U |
| UE-28 | ToggleButton 点击切换 aria-pressed 并触发 press({ pressed })，按下时显示 activeIcon，enabled=false 时禁用 | sap.m.ToggleButton | U |
| UE-29 | ToggleButton 支持 sap.m.Button 的属性：type、iconFirst、ariaHasPopup、accessibleRole、badgeStyle，pressed 属性变化时以属性为准 | sap.m.ToggleButton | U |
| UE-30 | IllustratedMessage 默认类型是 NoSearchResults，按类型给出中英文默认标题和说明 | sap.m.IllustratedMessage | U |
| UE-31 | IllustratedMessage 为 33 种未废弃类型都画了插画并有中英文文案，尺寸 Base（无插画）到 Large | sap.m.IllustratedMessage | U |
| UE-32 | IllustratedMessage 支持自定义标题/说明、关闭默认文案、ariaTitleLevel、decorative 和 additionalContent | sap.m.IllustratedMessage | U |
| UE-33 | BusyIndicator 是带 aria-busy 的 progressbar，立即显示（无延迟），支持 text、size 和旋转的 customIcon | sap.m.BusyIndicator | U |
| UE-34 | BusyDialog 通过 ref 的 open()/close() 打开关闭，按"取消"或 close(true) 时 close 事件的 cancelPressed 为 true | sap.m.BusyDialog | U |
| UE-35 | Currency 用 figure space 补齐到 maxPrecision、无小数币种用 punctuation space，小数点对齐，显示符号或代码，stringValue 不丢精度 | sap.ui.unified.Currency | U |
| UE-36 | ExpandableText 超过 maxCharacters 时截断并显示"更多/收起"（InPlace），支持 expanded，Popover 模式在弹出框里显示全文 | sap.m.ExpandableText | U |
| UE-37 | 工具栏溢出顺序：AlwaysOverflow 总在溢出区，先 Low/Disappear 后 High、从右往左，NeverOverflow 不动，同 group 一起移动 | sap.m.OverflowToolbarLayoutData | U |
| UE-38 | OverflowToolbar 把放不下的子元素收进"更多"，OverflowToolbarButton 在溢出区显示文字，closeOverflowOnInteraction 和 closeOverflow() 生效 | sap.m.OverflowToolbar | U |
| UE-39 | OverflowToolbar active 时点击非交互区触发 press({ srcControl })，enabled=false 时不可操作，ToolbarSpacer 支持 width，不需要 SmartKitProvider | sap.m.OverflowToolbar、sap.m.ToolbarSpacer | U |

## 流程与协作（UE-40～UE-59）

| 编号 | 要求 | 出处 | 验收方式 |
| --- | --- | --- | --- |
| UE-40 | ProcessFlow 按 position 把泳道排成列，子节点从父节点所在行开始，兄弟节点往下排 | sap.suite.ui.commons.ProcessFlow | U |
| UE-41 | 连线用 SVG 画并带箭头，parents 也会连线，指向计划中节点的连线为虚线 | sap.suite.ui.commons.ProcessFlow、ProcessFlowNode | U |
| UE-42 | nodePress 收到节点、headerPress 收到泳道（泳道自身 onPress 也会触发），节点是可用键盘操作的按钮 | sap.suite.ui.commons.ProcessFlow、ProcessFlowLaneHeader | U |
| UE-43 | 没有 zoomLevel 属性，只用 zoomIn/zoomOut/getZoomLevel/setZoomLevel 缩放，Four 级显示 titleAbbreviation，zoomLevel*Content 替换节点内容 | sap.suite.ui.commons.ProcessFlow、ProcessFlowNode | U |
| UE-44 | setSelectedPath 高亮路径上的节点和连线并淡化其余，getFocusedNode 返回焦点节点，泳道或节点不存在时触发 onError | sap.suite.ui.commons.ProcessFlow | U |
| UE-45 | showLabels 显示连线标签（同一位置取 priority 最高的），labelPress 收到标签及两端节点，foldedCorners 显示折角 | sap.suite.ui.commons.ProcessFlowConnectionLabel | U |
| UE-46 | 泳道头的图标外有环形图，各段按 state 绘制，并有可读的状态摘要 | sap.suite.ui.commons.ProcessFlowLaneHeader | U |
| UE-47 | MicroProcessFlow 是有序列表，显示状态图标、分隔线、intermediary、customControl、stepWidth 和 renderType | sap.suite.ui.commons.MicroProcessFlow、MicroProcessFlowItem | U |
| UE-48 | 带 press 的步骤是按钮，press({ item }) 带 key 且可以 preventDefault；ScrollingWithResizer 有滚动按钮 | sap.suite.ui.commons.MicroProcessFlowItem | U |
| UE-49 | Timeline 是列表，默认最新在前，sortOldestFirst 和排序按钮反转顺序，sort=false 保持子元素顺序 | sap.suite.ui.commons.Timeline | U |
| UE-50 | 先显示 growingThreshold（5）条，"更多"追加下一批并触发 grow | sap.suite.ui.commons.Timeline | U |
| UE-51 | groupByType 按年、季、月、周、日加分组标题（ISO 周，中英文） | sap.suite.ui.commons.Timeline | U |
| UE-52 | 搜索筛选条目并触发 filterSelectionChange，itemFiltering 调用 preventDefault 可保留条目 | sap.suite.ui.commons.Timeline | U |
| UE-53 | 筛选弹窗按 filterValue（filterList）和时间段筛选，触发 filterOpen，reset() 清除全部筛选 | sap.suite.ui.commons.Timeline | U |
| UE-54 | select 带 selectedItem 和 userAction，条目 press、userNameClicked({ uiElement })、customActionClicked、回复与回复列表事件都会触发 | sap.suite.ui.commons.TimelineItem | U |
| UE-55 | 支持水平轴、对齐方式、双侧排列、maxCharacters、noDataText 和 setCustomMessage | sap.suite.ui.commons.Timeline、TimelineItem | U |
| UE-56 | FeedInput 发布后清空，内容为空或超过 maxLength 时不能发布，按钮提示默认 "Submit"，actions 放在发布按钮旁 | sap.m.FeedInput | U |
| UE-57 | FeedListItem 显示发送人、正文、info 和时间，超过 maxCharacters 显示"更多/更少"（可用 moreLabel 改文字），senderPress/iconPress 带 domRef | sap.m.FeedListItem | U |
| UE-58 | 操作菜单遵守 visible/enabled，支持 ListItemBase 的 type、press、detailPress、unread、counter、highlight，正文链接可转为超链接 | sap.m.FeedListItem、FeedListItemAction、ListItemBase | U |
| UE-59 | 没有 SmartKitProvider 时用英文，有时用其语言（中文文案、zh-CN 日期），中英文键一致 | docs/26 §3 | U |

## 选择、设置与导航（UE-60～UE-79）

| 编号 | 要求 | 出处 | 验收方式 |
| --- | --- | --- | --- |
| UE-60 | DynamicDateRange 按 UI5 分组列出选项，无参数选项点击即选中并触发 change({ value, valid }) | sap.m.DynamicDateRange | U |
| UE-61 | 带参数的选项打开详情页（Last X 输入数值并选单位、日期范围等），OK 后给出 UI5 形状的 value，Back 返回列表 | sap.m.DynamicDateRange | U |
| UE-62 | 静态方法 DynamicDateRange.toDates 对各类选项（相对日、周、月、季、分钟、小时、含当前、指定月、日期时间）按本地时间和周起始规则返回 Date[] | sap.m.DynamicDateRange | U |
| UE-63 | 输入框显示格式化文本（相对选项附实际日期），可解析手输文本，无法解析时 valid=false 并标错，showClearIcon 可清空 | sap.m.DynamicDateRange | U |
| UE-64 | 支持 customOptions、formatter、required/name、hideInput 下用 openBy(domRef) 打开，以及实例方法 toDates | sap.m.DynamicDateRange、sap.m.DynamicDateOption | U |
| UE-65 | SelectDialog 通过 ref.open(searchValue) 打开（无公开 close），列表为 listbox/option，单选点击即确认并关闭 | sap.m.SelectDialog | U |
| UE-66 | SelectDialog 多选：复选框、"已选：n"信息栏、selectionChange 参数、清除按钮和 clearSelection() | sap.m.SelectDialog | U |
| UE-67 | 搜索框输入触发 liveChange，回车和清空触发 search（clearButtonPressed），有事件处理时不在客户端筛选 | sap.m.SelectDialog | U |
| UE-68 | growing 按 growingThreshold 分批显示"更多 [20/45]"，并触发 updateStarted/updateFinished，无数据时显示 noDataText | sap.m.SelectDialog、sap.m.SelectDialogBase | U |
| UE-69 | rememberSelections 保留已确认的选择，取消时触发 cancel 并丢弃改动 | sap.m.SelectDialog | U |
| UE-70 | TableSelectDialog 按 Column 渲染表头（hAlign、sortIndicator、footer），支持多选、mergeDuplicates 和窄屏 demandPopin | sap.m.TableSelectDialog、sap.m.Column、sap.m.ColumnListItem | U |
| UE-71 | ViewSettingsDialog 用分段按钮切换排序和分组页，confirm 返回 sortItem、sortDescending、groupItem 等参数 | sap.m.ViewSettingsDialog | U |
| UE-72 | 筛选页进入详情页（复选框、全选、按 filterSearchOperator 搜索），confirm 给出 filterString "Filtered by: Status (New, Approved)" 和 filterCompoundKeys | sap.m.ViewSettingsDialog、sap.m.ViewSettingsFilterItem | U |
| UE-73 | 支持预设筛选、customTabs、重置（reset/resetFilters）、clearFilters()，beforeClose 可阻止关闭 | sap.m.ViewSettingsDialog | U |
| UE-74 | Wizard 滚动模式：顶部进度导航、"第 n 步"按钮，未校验步骤不显示按钮，末步显示 finishButtonText 并触发 complete | sap.m.Wizard、sap.m.WizardStep | U |
| UE-75 | Wizard 的 ref 方法 nextStep、previousStep、goToStep、validateStep、invalidateStep、discardProgress、getProgress、getProgressStep、getCurrentStep 行为与 UI5 一致 | sap.m.Wizard | U |
| UE-76 | enableBranching 下按 nextStep/subsequentSteps 分支，未选分支时不能前进；Page 模式只显示当前步；支持 width、height、stepTitleLevel | sap.m.Wizard | U |
| UE-77 | IconTabBar 使用 tablist/tab/tabpanel 语义，显示计数和 iconColor，select 事件参数完整，方向键在可用页签间移动焦点 | sap.m.IconTabBar、sap.m.IconTabFilter | U |
| UE-78 | 再次点击已选页签可折叠/展开内容（expand 事件），selectedKey 随属性变化，下级页签通过菜单选择并显示其内容 | sap.m.IconTabBar、sap.m.IconTabFilter | U |
| UE-79 | 放不下的页签收进"更多"菜单，enableTabReordering 时可用 Ctrl+方向键调整顺序；中文文案可用，中英文键一致 | sap.m.IconTabBar | U |

## 附件上传（UE-90～UE-99）

| 编号 | 要求 | 出处 | 验收方式 |
| --- | --- | --- | --- |
| UE-90 | 没有文件时显示 IllustratedMessage（UploadToCloud）；工具栏的上传按钮放在 ActionsPlaceholder 处（没有时放在最后），uploadButtonInvisible 隐藏它；表格列是文件名、大小、状态、扩展列和操作 | sap.m.plugins.UploadSetwithTable、sap.m.upload.ActionsPlaceholder | U |
| UE-91 | 选中的文件用 XMLHttpRequest 上传（带 headerFields），进度用 aria-live 播报，依次触发 beforeInitiatingItemUpload、beforeUploadStarts，完成后触发 uploadCompleted（item、response、readyState、status、responseText、headers） | sap.m.plugins.UploadSetwithTable | U |
| UE-92 | beforeUploadStarts 可以阻止上传；uploader 的 uploadUrl、httpRequestMethod（Put）、useMultipart 生效，并触发 uploadStarted、uploadProgressed、uploadCompleted；非 2xx 时状态为 Error | sap.m.upload.UploaderTableItem | U |
| UE-93 | fileTypes、mediaTypes、maxFileNameLength、maxFileSize（MB）不通过时分别触发对应事件，文件不加入列表 | sap.m.plugins.UploadSetwithTable | U |
| UE-94 | 文件名含受限字符（默认 \:/*?"<>\|[]{}@#$）时给出提示并跳过；fileNameValidationConfig 的 include、exclude、override 生效 | sap.m.plugins.UploadSetwithTable.FilenameValidationConfig | U |
| UE-95 | itemValidationHandler 收到 { oItem, iTotalItemsForUpload, oSource }，resolve 时上传返回的条目，reject 时跳过 | sap.m.plugins.UploadSetwithTable.ItemInfo | U |
| UE-96 | multiple=false 时只取一个文件；拖到控件上的文件会加入并上传；uploadEnabled=false 时上传按钮禁用、拖放无效 | sap.m.plugins.UploadSetwithTable | U |
| UE-97 | renameItem 和行内按钮打开改名框（不含扩展名），回车触发 itemRenamed，Esc 触发 itemRenameCanceled | sap.m.plugins.UploadSetwithTable | U |
| UE-98 | terminateUpload 中止上传，触发 uploadTerminated 并移除该行；download 打开文件地址；isRestricted 按规则判断 | sap.m.upload.UploadItem、sap.m.upload.UploaderTableItem | U |
| UE-99 | openFilePreview 在对话框里预览图片和 PDF，有轮播箭头，超过 maxFileSizeforPreview 不预览；uploadItemViaUrl、uploadItemWithoutFile、UploaderTableItem.uploadFile 可用；中文文案可用 | sap.m.upload.FilePreviewDialog、sap.m.plugins.UploadSetwithTable | U |

## 层级表（UE-80～UE-89）

| 编号 | 要求 | 出处 | 验收方式 |
| --- | --- | --- | --- |
| UE-80 | 模型读出实体类型上同一限定符的 Aggregation.RecursiveHierarchy（NodeProperty、ParentNavigationProperty 及其外键）和 Hierarchy.RecursiveHierarchy（DrillState、DistanceFromRoot、LimitedDescendantCount 等）；没有层级的类型模型不变 | OData Aggregation / SAP Hierarchy 词汇表 | U |
| UE-81 | 首层请求为 `$apply=com.sap.vocabularies.Hierarchy.v1.TopLevels(HierarchyNodes=$root/…,HierarchyQualifier='…',NodeProperty='…',Levels=1)`，选择节点和层级字段，不分页、不带 $count；展开和折叠的节点写进 ExpandLevels；ODataV4Provider 原样发送 | SAP Fiori elements V4 树表 | U |
| UE-82 | 有筛选或搜索时用 `ancestors(…,filter(…)/search(…),keep start)` 保留匹配节点及其祖先；排序作为 TopLevels 之前的 orderby 只排同级节点 | SAP Fiori elements V4 树表 | U |
| UE-83 | MemoryProvider 实现同样的 TopLevels：Levels、ExpandLevels（1 / 0 / null）、DrillState、DistanceFromRoot、LimitedDescendantCount、Matched，筛选时保留祖先，同级排序，可选限定符 | docs/26 §3.10 | U |
| UE-84 | SmartTable tableType="TreeTable" 先显示根节点，第一列按 DistanceFromRoot 缩进并有展开/折叠按钮，叶子没有按钮；点按展开（新的 TopLevels 请求）和折叠 | sap.ui.table.TreeTable | U |
| UE-85 | 响应式树表用 treegrid 语义：行有 aria-level、aria-expanded，按钮有"展开节点/折叠节点"的名称，点按钮不触发行导航 | sap.ui.table.TreeTable | U |
| UE-86 | ref 方法 expand、collapse（单行或多行）、collapseAll、expandToLevel、isExpanded 与 UI5 一致，行号按可见行计；按层级展开的节点用 Levels 0 折叠 | sap.ui.table.TreeTable | U |
| UE-87 | 用户展开或折叠时触发 onToggleOpenState({ rowIndex, rowContext, expanded })，rowContext 是行数据；调用方法不触发 | sap.ui.table.TreeTable | U |
| UE-88 | tableType 取 sap.ui.comp.smarttable.TableType 的值：ResponsiveTable 用响应式内核，Table / AnalyticalTable 用表格内核，TreeTable 在表格内核用客户端行；没有层级注解时是普通表；树表不提供分组和合计；SmartListReport 的 tableType 也接受这些值 | sap.ui.comp.smarttable.TableType | U |
| UE-89 | 测试服务的成本中心层级（/tree）：首层、展开和折叠、全部展开（expandToLevel）和全部折叠、公司代码筛选保留祖先，表格和响应式两种内核，中文文案 | docs/26 §3.10 | E |
