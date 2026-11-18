# 02 注解覆盖表（以 Fiori elements 1.154 源码为依据）

> 状态：现行 · 2026-11-17（阶段 3 重写，`31` 阶段 3、ADR-033）。
>
> **依据**：SAPUI5 / Fiori elements 1.154.0 的 sap.fe 源码（core、macros、templates、base 四个库按模块拆开读，模块路径相对 `sap/fe/`，对应源码可在 `https://ui5.sap.com/1.154.0/resources/sap/fe/<模块>-dbg.js` 找到），以及 FE 对比测试（`npm run e2e:fe`，同一份 `$metadata` 和注解分别交给 FE 参考应用 `apps/fe-reference` 和 smart-kit，比较请求和显示）。列表页部分以 `29a` 的 195 行逐条对照为底稿，按阶段 3 的结果更新；**只用于对象页的术语在阶段 6 核对**（`29b`、`29c`），这里先保留原来的说法，标为"阶段 6 核对"。
>
> **结论**：一致 / 部分一致 / 不一致（行为不同）/ 未实现 / FE 列表页不用。阶段 3 改过的行，只有 FE 对比场景或 FE 源码确认过的才写"一致"。
>
> **计划阶段**：`31` 的阶段（阶段 4：列表页其余注解；阶段 5：页面模板和 manifest 设置；阶段 6：对象页注解）。"—"表示不需要再改。
>
> **ANN 编号和期**：ANN 编号是测试编号，测试名称里带这个编号（例如 `it('ANN-01 …')`）。"期"一列是原来的交付期次（一期 / 二期 / 三期），`npm run trace`（`scripts/trace.mjs`）按这一列检查每个一期条目都有测试、每个二期条目都有通过的测试；新加的行没有原来的期次，写"—"。
>
> 词汇表命名空间：UI = `com.sap.vocabularies.UI.v1`，Common = `com.sap.vocabularies.Common.v1`，Measures = `Org.OData.Measures.V1`，Capabilities = `Org.OData.Capabilities.V1`，Core = `Org.OData.Core.V1`，Aggregation = `Org.OData.Aggregation.V1`，Analytics = `com.sap.vocabularies.Analytics.v1`，Communication = `com.sap.vocabularies.Communication.v1`，HTML5 = `com.sap.vocabularies.HTML5.v1`。
>
> 常用 FE 模块简称：`Table` = `core/converters/controls/Common/Table`，`Columns` = `core/converters/controls/Common/table/Columns`，`FilterBar` = `core/converters/controls/ListReport/FilterBar`，`LRConverter` = `core/converters/templates/ListReportConverter`，`DataVisualization` = `core/converters/controls/Common/DataVisualization`，`FieldStructureHelper` = `macros/internal/field/FieldStructureHelper`，`DisplayStyle` = `macros/internal/field/DisplayStyle`，`ValueListHelper` = `macros/internal/valuehelp/ValueListHelper`，`StandardActions` = `core/converters/controls/Common/table/StandardActions`。

## 1. 表格列与动作

| 术语 / 记录属性 | FE 1.154 的处理（模块） | smart-kit 现状 | 结论 | 计划阶段 | ANN 编号 | 期 |
| --- | --- | --- | --- | --- | --- | --- |
| `UI.LineItem`：怎样选定（SPV、PV、限定符） | 按 manifest 的默认 SPV → 不带限定符的 SPV → 不带限定符的 PV → `UI.LineItem` 的顺序选，PV 的 `Visualizations` 要含 LineItem 或 Chart 才采用；取第一个 LineItem 或 Chart，Chart 在前时默认显示图表（`LRConverter`、`DataVisualization`） | 用 SPV 的 PV 或默认 PV，取第一个 LineItem；不检查 Visualizations，不回退；Chart 在前也显示表格 | 部分一致 | 阶段 4 | — | — |
| `UI.LineItem`：列集合与个性化 | LineItem 的记录生成列；实体上其他不隐藏的属性生成 `availability:"Adaptation"` 的列，可在个性化里添加；没有 LineItem 时是默认表（`Columns` `getColumnsFromEntityType`、`Table`） | 个性化只列出 LineItem 的列；没有 LineItem 时推导最多 8 列（本库约定，见第 6.3 节） | 不一致 | 阶段 4 | — | — |
| `UI.LineItem@UI.Criticality`（行高亮） | 注在 LineItem 集合上，生成行的 `highlight`（`Table`、`core/converters/…/Criticality`、`macros/table/MdcTableTemplate`） | 不读 | 未实现 | 阶段 4 | — | — |
| `UI.DataField`：`Value`、`Label` | 标签：`Label` → Value 的 `Common.Label` → 属性名；提示取 `Common.QuickInfo`（`Columns`） | 标签：`Label` → 属性标签（相同）；不设提示 | 一致 | — | ANN-01 | 一期 |
| `DataField/Criticality`、`CriticalityRepresentation`（列） | 记录上有 `Criticality` 时显示为 ObjectStatus；除 `WithoutIcon` 外带图标（`FieldStructureHelper`、`core/templating/CriticalityFormatters`）；不用属性上的 `UI.Criticality` | 用记录上的值，没有时回退到属性上的 `UI.Criticality`（本库扩展，见第 3 节）；路径值 -1、4 不上色 | 部分一致 | 阶段 4 | ANN-11 | 一期 |
| `@UI.Importance`（列） | 语义键列和 `InsertRestrictions/RequiredProperties` 的列一律 High，优先于记录上的值；FieldGroup 列取组内最高值（`Columns`） | 先取记录上的 Importance，再看语义键，默认 Medium；响应式表格按宽度隐藏列（ADR-020） | 部分一致 | 阶段 4 | ANN-87 | 二期 |
| `@UI.Hidden`（列） | 静态 Hidden 的列 availability 为 Hidden；路径形式按行隐藏单元格内容（`core/converters/helpers/DataFieldHelper`、`Columns`） | 静态 Hidden 的列去掉；路径形式当作 false | 部分一致 | 阶段 4 | ANN-12 | 一期 |
| `@HTML5.CssDefaults/width` | 列宽（`Columns`） | 不读，列宽按类型取默认值 | 未实现 | 阶段 4 | — | — |
| `@HTML5.RowSpanForDuplicateValues` | 响应式表格合并相邻的重复值（`Columns`、`MdcTableTemplate`） | 不读 | 未实现 | 阶段 4 | — | — |
| `UI.DataFieldDefault` | 属性派生的列用它的 Label 和 Importance（`Columns`） | 不读 | 未实现 | 阶段 4 | — | — |
| `UI.DataFieldWithUrl`（`Url`、`IconUrl`、`@HTML5.LinkTarget`） | 链接，target 取 LinkTarget，缺省当前窗口；有 IconUrl 时带图标；不限协议（`DisplayStyle`） | 只认 `http(s):`、`/`、`mailto:`；外部链接 `_blank`；不读 IconUrl、LinkTarget | 部分一致 | 阶段 4 | — | — |
| `UI.DataFieldWithNavigationPath` | 链接，点击按 `Target` 导航（`DisplayStyle`） | 按普通 DataField 显示文本 | 部分一致 | 阶段 4 | — | — |
| `UI.DataFieldWithIntentBasedNavigation` | 列照常显示值；目标意图存在时值是链接（`DisplayStyle`、`Columns`） | 整列丢弃，记一条警告 | 不一致 | 阶段 4 | — | — |
| `UI.DataFieldWithAction` | 列显示值，值是执行动作的链接（`DisplayStyle`） | 整列丢弃 | 不一致 | 阶段 4 | — | — |
| `UI.DataFieldWithActionGroup` | 列转换不把它当成列，列表不显示（`Columns`；术语是 Experimental） | 按 Value 显示为普通列 | 不一致 | 阶段 4 | — | — |
| `UI.DataFieldForAnnotation` → `UI.DataPoint` | DataPoint 控件显示评分、进度或数值；列标签先取 DataPoint Value 的 `Common.Label`，再取记录 `Label`，不用 `Title`；导出带目标值（`Columns`、`macros/internal/DataPoint`） | 支持评分、进度、数值；标签取 `Label` → DataPoint `Title` → 属性标签 | 部分一致 | 阶段 4 | ANN-10 | 一期 |
| `UI.DataFieldForAnnotation` → `UI.Chart`（单元格微图表） | 单元格里的 XS 微图表，也接受 PV 作为目标；没有数据时隐藏（`MdcTableTemplate`） | 支持行自身、单值导航、集合导航的图表；不接受 PV 作为目标。九种微图表，规则见 `15`，验收见 `17` | 一致 | — | MC-60、MC-61、MC-65 | 三期 |
| `UI.DataFieldForAnnotation` → `Communication.Contact` | Contact 控件：名字链接，点开联系人弹出框（`DisplayStyle`、`macros/contact/Contact`） | 整列丢弃 | 未实现 | 阶段 4 | — | — |
| `UI.DataFieldForAnnotation` → `UI.FieldGroup` | 一列里纵向列出组内字段（"标签：值"）；全部隐藏时整列隐藏（`MdcTableTemplate`、`Columns`） | 整列丢弃 | 未实现 | 阶段 4 | — | — |
| `UI.ConnectedFields`（列） | 按 `Template` 把多个字段拼在一个单元格（`MdcTableTemplate`、`Columns`） | 整列丢弃 | 未实现 | 阶段 4 | — | — |
| `UI.DataFieldForAction`（工具栏） | 非 Inline、非 Determining 的动作放在工具栏；绑定动作要先选行；没有绑定动作和删除时表格不可选（`Table`） | 非 Inline 的动作都放进工具栏（含 Determining，见下）；表格始终可多选；参数对话框、部分处理见 ADR-024 | 部分一致 | 阶段 4 | ANN-80 | 二期 |
| `DataFieldForAction/Inline`（及 `Criticality`、`IconUrl`） | 每个 Inline 动作单独一列，在 LineItem 里的位置；不可用时禁用；按钮类型按 Criticality（`Columns`、`DisplayStyle`、`CriticalityFormatters`） | 所有 Inline 动作挤在末尾的一列；不可用时隐藏；Criticality 解析了没用；不读 IconUrl | 部分一致 | 阶段 4 | — | — |
| `DataFieldForAction/Determining`（在 LineItem 里） | 列表页不放进工具栏，也没有页脚，所以不显示（`Table`） | 放进了工具栏 | 不一致 | 阶段 4 | — | — |
| `DataFieldForAction/InvocationGrouping` | `ChangeSet` 时多行在一个 change set 里执行（`macros/internal/helpers/ActionHelper`） | 逐行请求，相当于 Isolated | 部分一致 | 阶段 4 | — | — |
| `Core.OperationAvailable` | 绑定动作按选中行求值，至少一行可用时可用，只处理可用的行；非绑定动作、静态值按常量或表达式（`ActionHelper` `getOperationAvailableMap`、`macros/table/TableHelper`、`Table`） | 绑定动作按选中行判断，部分可用时弹出部分处理对话框；**阶段 3 修正**：非绑定动作为 false 或路径时按钮禁用（以前可点、点了无反应）。上下文路径的警告未做 | 部分一致 | 阶段 4（其余） | — | — |
| `Common.IsActionCritical` | 执行前确认（`core/controllerextensions/editFlow/operations/Operation`、`core/templating/ActionHelper`） | 不读 | 未实现 | 阶段 4 | — | — |
| `UI.IsCopyAction` | 标准"复制"按钮，放在"新建"之后，执行后导航到新实例（`Table`、`core/converters/controls/Common/Action`） | 当普通动作；表格已有一个剪贴板"复制"按钮，名字会撞 | 未实现 | 阶段 4 | — | — |
| `UI.IsAIOperation` | 按钮和菜单带 AI 标记（`Action`） | 不读 | 未实现 | 阶段 4 | — | — |
| `UI.DataFieldForActionGroup` | 工具栏菜单按钮，子动作可用性同样计算（`Table`、`ActionHelper`） | 子动作全部丢失；`actionGroups` 只能手工配置 | 不一致 | 阶段 4 | — | — |
| `UI.DataFieldForIntentBasedNavigation` | 工具栏按钮或 Inline 列，`RequiresContext` 时要选行，依赖 launchpad（`Table`、`DisplayStyle`） | 忽略 | 未实现 | 阶段 4 | — | — |
| `UI.CreateHidden` | 实体集或实体类型上，常量或路径，为真时隐藏"新建"（`StandardActions`） | 不读 | 未实现 | 阶段 4 | — | — |
| `UI.DeleteHidden` | 为真时隐藏"删除"（`StandardActions`） | 不读 | 未实现 | 阶段 4 | — | — |
| `UI.UpdateHidden` | 列表页没有"编辑"按钮，只用于批量编辑和对象页（`StandardActions`） | 不读 | FE 列表页不用 | 阶段 6 核对 | — | — |
| `Capabilities.InsertRestrictions` | `Insertable` 常量、路径或表达式；草稿根有 `NewAction` 时用它的 OperationAvailable；`RequiredProperties` 在新建时必填；默认新建方式 NewPage（`StandardActions`、`Table`） | 读入模型（`insertable`），只读常量，表达式当作 true；默认对话框新建；`newAction` 读了没用 | 部分一致 | 阶段 4、阶段 5（新建方式） | ANN-45 | 一期 |
| `Capabilities.DeleteRestrictions` | `Deletable` 常量 false 时隐藏"删除"；路径时加进请求，选中的行都能删才可用（`Table`、`StandardActions`） | 读入模型，只读常量，路径当作 true | 部分一致 | 阶段 4 | ANN-45 | 一期 |
| `Capabilities.UpdateRestrictions` | 列表页只用于批量编辑（`Table`） | 读入模型，给对象页编辑用 | FE 列表页不用 | 阶段 6 核对 | ANN-45 | 一期 |
| `Capabilities.SupportedFormats` | 含 `application/pdf` 时导出菜单多一个 PDF；XLSX 总是有（`macros/table/delegates/TableDelegate`） | 只导出 xlsx | 未实现 | 阶段 4 | — | — |
| `UI.MediaResource` | 有 Stream 时启用上传表格插件（`Table`） | 不读（`UploadSetwithTable` 要手工配置） | 未实现 | 阶段 4 | — | — |
| `Common.SemanticKey`（列和请求） | 总是请求语义键；响应式表格显示为 ObjectIdentifier，网格表是加粗 Label；Importance High；草稿标记在语义键单元格，网格表单独一列 `draftStatus`（`Table`、`Columns`、`MdcTableTemplate`） | 语义键列加粗；**阶段 3**：网格表的草稿标记改为单独一列 `draftStatus`（只有图标、无列标题）；语义键不在 LineItem 里时仍不请求 | 部分一致 | 阶段 4 | ANN-24 | 一期 |
| `Common.DraftRoot`/`DraftNode`：编辑状态筛选 | 6 个选项（全部、全部（隐藏草稿）、未更改、自己的草稿、被他人锁定、他人有未保存的更改）；"全部"＝`IsActiveEntity eq false or SiblingEntity/IsActiveEntity eq null`；锁定和未保存按 `DraftAdministrativeData/InProcessByUser`（`macros/filterBar/DraftEditState`） | **阶段 3 按 FE**：6 个选项，键和文字取 FE 的 DraftEditState；过滤条件相同；状态键 `$editState`（旧键 `$editingStatus` 的变式回退到"全部"）。FE 对比场景确认（偏差 DV-F002、DV-F011 已删） | 一致 | —（协作草稿见第 4 节） | — | — |
| `Common.DraftRoot`/`DraftNode`：草稿标记和请求的字段 | 请求 `HasActiveEntity`、`HasDraftEntity`、`DraftAdministrativeData/InProcessByUser`；草稿节点的表格也显示标记（`Table`） | **阶段 3**：请求这三项；草稿标记弹出框打开时才加载。草稿节点（子表）的标记未做 | 部分一致 | 阶段 6（草稿节点） | — | — |

## 2. 筛选栏与值帮助

| 术语 / 记录属性 | FE 1.154 的处理（模块） | smart-kit 现状 | 结论 | 计划阶段 | ANN 编号 | 期 |
| --- | --- | --- | --- | --- | --- | --- |
| `UI.SelectionFields` | 列出的字段直接显示，其余属性在"适配筛选"里；支持导航路径（1:n 生成 any()）；去掉不可筛选的；列出的 `HiddenFilter` 字段保留为隐藏筛选；没有注解时不推导（`FilterBar`） | 按顺序读取，解析路径；HiddenFilter 字段直接丢掉；没有注解时推导字段（本库约定，第 6.3 节） | 部分一致 | 阶段 4 | ANN-02 | 一期 |
| `UI.FilterFacets` | 给"适配筛选"的字段分组；没有时按 FieldGroup 分组（`FilterBar`、`macros/filterBar/FilterBarDelegate`） | 平铺列表 | 未实现 | 阶段 4 | — | — |
| `UI.HiddenFilter` | 不出现在筛选栏和"适配筛选"里，条件照样生效；支持路径值（`FilterBar`、`core/helpers/MetaModelFunction`） | 只读常量，从筛选栏和"适配筛选"排除；但 SV 里有它的条件时会显示出来 | 部分一致 | 阶段 4 | ANN-12 | 一期 |
| `UI.Hidden`（筛选侧） | 同样隐藏；导航属性 Hidden 时其下属性都不提供筛选（`FilterBar`） | 排除；有默认条件时会显示出来；被隐藏导航下的字段没排除 | 部分一致 | 阶段 4 | ANN-12 | 一期 |
| `Common.FilterDefaultValue` | 没有默认 SV 时每个带它的属性生成一个 EQ 条件；参数实体上也读；不在 SelectionFields 里的也加入属性信息（`macros/filterBar/FilterHelper`、`FilterBar`、`FilterBarDelegate`） | **阶段 3 按 FE**：没有默认 SV 时生成 EQ 条件；不在 SelectionFields 里的作为条件生效、不加字段。FE 对比场景确认（`tests/e2e-fe/filter3.spec.ts`）。参数实体的部分随 `Common.ResultContext` | 一致 | —（参数实体随 ResultContext，阶段 4） | — | — |
| `Common.FilterDefaultValueHigh` | 只在 AnnotationConverter 的别名表里，没有消费者 | 不读 | FE 列表页不用 | — | — | — |
| `UI.SelectionVariant` / `SelectOptions`（默认筛选值） | 来源是默认 SPV 的 SV，SPV 没有 SV 时不回退到 `UI.SelectionVariant`；CP 按 `*` 位置转 Contains/StartsWith/EndsWith，没有 `*` 时忽略；EQ ""→Empty，NE ""→NotEmpty；Sign=E 转 NOT；日期转语义日期运算符（`DataVisualization` `getSelectionVariant`、`FilterHelper`） | 读 EQ、NE、BT、NB、LT、LE、GT、GE、CP；空值没映射为 Empty/NotEmpty；SPV 没有 SV 时回退；没有 `*` 的 CP 当作 EQ | 部分一致 | 阶段 4 | ANN-05 | 一期 |
| `UI.SelectionPresentationVariant`（不带限定符，默认组合） | 默认 SPV 的 SV 是筛选栏初值，PV 是表格呈现；**多视图时筛选栏照样取初值**（阶段 3 的 FE 对比场景确认，`29a` 原说"多视图时不设初值"有误）（`DataVisualization`、`LRConverter`） | 取它引用的 SV 和 PV；多视图时默认 SV 进入筛选栏（和 FE 一致）；SPV 没有 SV 时回退到 `UI.SelectionVariant`（FE 不回退） | 部分一致 | 阶段 4（回退） | ANN-05 | 一期 |
| `UI.SelectionVariant` / `Parameters` | 生成参数条件，用于参数化实体集（`FilterHelper`） | 忽略 | 未实现 | 阶段 4 | — | — |
| `UI.SelectionVariant` / `FilterExpression` | 列表页转换器不读，只在 easyFilter 里 | 忽略 | FE 列表页不用 | — | — | — |
| `UI.SelectionVariant` / `Text`（视图标签） | 多视图时用视图所指注解（SPV 或 SV）的 `Text`（`LRConverter`） | 用 SPV 的 `Text`，没有时用限定符 | 一致 | — | — | — |
| `UI.SelectionVariant` 作为视图筛选（多视图） | 每个视图的 SV 完整作用于该视图的表格（`selectionVariantPath`，隐藏过滤）；SelectionFields 的字段仍在筛选栏（`FilterBar`、`LRConverter`） | **阶段 3 按 FE**：视图的完整 SV 作为隐藏过滤（每个属性的条件加括号），SelectionFields 留在筛选栏。FE 对比场景确认（`purchasing-views`，"已关闭"标签页在默认 `Status ne CLOSED` 下为空，和 FE 相同） | 一致 | — | ANN-85 | 二期 |
| `Capabilities.FilterRestrictions` / `Filterable` | 表格列筛选按它；筛选栏只看 NonFilterableProperties；DraftAdministrativeData 导航 Filterable=false 时隐藏编辑状态（`core/templating/EntitySetHelper`、`core/converters/controls/Common/filter/FilterRestrictions`、`MetaModelFunction`） | Filterable=false 时所有路径不可筛选（筛选栏、适配筛选、请求）；DraftAdministrativeData 的情况没处理。FE 筛选栏在 Filterable=false 时的表现待核实 | 部分一致 | 阶段 4 | ANN-40 | 一期 |
| `FilterRestrictions/RequiresFilter` | 只计算，没有使用者（`MetaModelFunction`） | 忽略 | FE 列表页不用 | — | — | — |
| `FilterRestrictions/RequiredProperties` | 字段必填，"执行"被拦截并展开筛选栏；合并导航前缀和 NavigationRestrictions（`FilterRestrictions`、`FilterBar`） | 必填字段可见、带星号，执行时报错，不自动执行；导航层级的合并没做 | 一致 | — | ANN-40 | 一期 |
| `FilterRestrictions/NonFilterableProperties` | 不进入筛选栏；导航路径合并目标实体集和 NavigationRestrictions（`FilterBar`） | 从字段、适配筛选和请求中去掉 | 一致 | — | ANN-40 | 一期 |
| `FilterRestrictions/FilterExpressionRestrictions` | 同一属性多条记录取最严格的；SingleValue、SingleRange 最多一个条件；各表达式的运算符见 `macros/CommonHelper` `getOperatorsForProperty`（MultiValue 含 Empty/NotEmpty，SingleRange 允许排除，SearchExpression 含 Not*）（`core/converters/controls/ListReport/FilterField`） | 每个属性只留一条（后者覆盖）；运算符集合较小；筛选字段、值帮助和请求都按它限制（P2-LR-19） | 部分一致 | 阶段 4 | ANN-40 | 一期 |
| `Capabilities.FilterFunctions` | 含 `tolower` 时字符串筛选不区分大小写（`core/helpers/ModelHelper`、`Columns`、`FilterBar`） | 不读 | 未实现 | 阶段 4 | — | — |
| `Capabilities.SearchRestrictions/Searchable` | 没写 `Searchable=false` 就显示搜索框（`FilterBar`、`Table`）；导航路径用 NavigationRestrictions 的（`MetaModelFunction`） | **阶段 3 按 FE**：缺省可搜索（以前缺省不可搜索，`04` 的有意设计已推翻）；不支持 `$search` 的服务要声明 `Searchable=false`（迁移说明见 `08` 第 2 节）。FE 对比场景确认 | 一致 | — | ANN-42 | 一期 |
| `Capabilities.NavigationRestrictions`（筛选、排序、搜索） | 筛选导航路径的字段时合并父实体集带前缀的条目、`RestrictedProperties` 和目标实体集的限制（`FilterRestrictions`、`FilterField`、`MetaModelFunction`） | 读入模型，只在对象页子表合并；列表页筛选栏对导航路径只看根实体集 | 部分一致 | 阶段 4 | ANN-46 | 一期 |
| `Common.ValueList`（`CollectionPath`、`Parameters` 整体） | 主键取 LocalDataProperty 是当前属性的 InOut/Out；描述字段取 VH 主键属性上的 `Common.Text`；列来自参数，排除 VH 实体里 UI.Hidden 的（`ValueListHelper`） | 主键规则相同；描述取第一个 DisplayOnly 参数；列是所有非 Constant 参数 | 部分一致 | 阶段 4 | ANN-22 | 一期 |
| 带限定符的 `Common.ValueList#Q` | 多个值帮助内容，可以切换（`ValueListHelper`） | 只读不带限定符的 | 未实现 | 阶段 4 | — | — |
| `ValueList/Label` | 值帮助内容（标签页）的标题（`ValueListHelper`） | 读入模型没用，对话框标题用属性标签 | 部分一致 | 阶段 4 | — | — |
| `ValueList/CollectionRoot` | FE 没有读取 | 忽略 | FE 列表页不用 | — | — | — |
| `ValueList/SearchSupported` | 词汇表缺省 true；除非 `SearchSupported=false` 或 VH 实体集 `Searchable=false`，都用 `$search`（`ValueListHelper` `entityIsSearchable`） | **阶段 3 按 FE**：缺省 true，规则相同。FE 对比场景确认 | 一致 | — | ANN-22 | 一期 |
| `ValueList/FetchValues` | 值为 2 时等用户搜索后才加载（`ValueListHelper`、`FilterBar`） | 打开对话框就加载 | 未实现 | 阶段 4 | — | — |
| `ValueList/PresentationVariantQualifier` | 用 VH 实体集上该 PV 的 SortOrder 作为默认排序（`ValueListHelper`） | 按主键升序 | 未实现 | 阶段 4 | — | — |
| `ValueList/SelectionVariantQualifier` | 只用于视觉筛选（`core/converters/controls/ListReport/VisualFilters`） | 忽略 | FE 列表页不用 | — | — | — |
| `ValueList/DistinctValuesSupported` | 为 true 时对 In/Out 参数做 distinct 请求（`ValueListHelper`） | 忽略 | 未实现 | 阶段 4 | — | — |
| `ValueListParameterIn`、`InOut`、`ValueListParameterConstant`（过滤） | In、InOut、Constant 都作为值帮助请求的 `$filter`，In 的值取筛选栏对应字段的条件（`ValueListHelper` `getInParameters`） | **阶段 3 按 FE**：值帮助请求带 In / InOut / Constant 过滤（`ValueListQuery.filters`）。FE 对比场景确认 | 一致 | — | ANN-22 | 一期 |
| `ValueListParameterOut`、`InOut`（回写） | 选中后回写到筛选栏的其他字段（`macros/valuehelp/ValueHelpDelegate`）；用户输入的值按 InOut/Out 校验（`macros/filter/FilterUtils`） | **阶段 3 按 FE**：选中后回写（单值字段替换，其他追加）；按 InOut/Out 校验用户输入未做 | 部分一致 | 阶段 4（校验） | ANN-22 | 一期 |
| `ValueListParameterDisplayOnly` | 值帮助表格的列，参与 distinct（`ValueListHelper`） | 作为列；第一个当作描述 | 部分一致 | 阶段 4 | — | — |
| `InitialValueIsSignificant`（In、InOut、Constant 参数上） | In 值为空时也作为条件（`ValueListHelper`） | 忽略 | 未实现 | 阶段 4 | — | — |
| `Common.ValueListWithFixedValues` | 下拉或多选，没有对话框（`macros/filterBar/FilterFieldTemplate`、`macros/internal/valuehelp/ValueHelpTemplating`） | SingleValue 用 Select，其他用固定建议的 TagsInput，不显示值帮助按钮 | 一致 | — | ANN-22 | 一期 |
| `Common.ValueListReferences` | 交给 OData 模型从外部值帮助服务加载（`core/templating/PropertyHelper`、`macros/field/FieldHelper`） | 不做 | 未实现 | 阶段 4 | — | — |
| `Common.ValueListMapping` | 外部值帮助服务的映射（`PropertyHelper`、`FieldHelper`） | 不做 | 未实现 | 阶段 4 | — | — |
| `Common.ValueListRelevantQualifiers` | 决定哪些限定符的 ValueList 生效（`ValueHelpTemplating`、`ValueListHelper`） | 忽略 | 未实现 | 阶段 4 | — | — |
| `Common.ValueListShowValuesImmediately` | 只用于编辑态（`macros/internal/field/EditStyle`） | 忽略 | FE 列表页不用 | 阶段 6 核对 | — | — |
| `Common.ValueListForValidation` | 筛选输入按指定值帮助校验（`ValueHelpTemplating`） | 不校验 | 未实现 | 阶段 4 | — | — |
| `Common.QuickInfo`（筛选字段） | 筛选字段的提示（`FilterFieldTemplate`、`FilterBar`） | 不读 | 未实现 | 阶段 4 | — | — |
| `Common.DocumentationRef` | 标签旁的文档链接（`FilterFieldTemplate`、`FilterBarDelegate`） | 不读 | 未实现 | 阶段 4 | — | — |
| `Common.ResultContext` | 参数化实体集：参数成为必填单值筛选字段，请求 `/Set(P=…)/Results`（`FilterBar`、`FilterRestrictions`、`FilterField`、`FilterHelper`） | 不读 | 未实现 | 阶段 4 | — | — |
| `PersonalData.IsPotentiallySensitive` | 不写入 app state 和导航上下文，值帮助不记输入历史（`FilterBarDelegate`、`navigation/NavigationHandler`、`ValueHelpDelegate`） | 不读；页面状态存 sessionStorage 时会持久化敏感值 | 未实现 | 阶段 4 | — | — |
| `UI.ExcludeFromNavigationContext` | 不写入 app state 和导航上下文（`FilterBarDelegate`、`NavigationHandler`） | 不读；没有带上下文的跨应用导航 | 未实现 | 阶段 4 | — | — |
| `Analytics.Measure`（筛选栏） | 度量字段的筛选值不写入 app state（`FilterBarDelegate`） | 不读 | 未实现 | 阶段 4 | — | — |
| `Common.Label`（筛选字段） | 目标属性的 `Common.Label`，没有时用属性名（`FilterBar`、`FilterFieldTemplate`） | 相同；没有时按驼峰拆词（本库约定） | 一致 | — | ANN-20 | 一期 |
| 日期筛选的语义运算符（Edm.Date、DateTimeOffset） | manifest `useSemanticDateRange` 缺省 true，DynamicDateRange 带大量运算符（`macros/filterBar/DefaultSemanticDateOperators`、`CommonHelper`） | 日期范围加 18 个相对日期运算符；缺 FROM、TO、N 周/月/季/年、QUARTERn、SPECIFICMONTH 等；SingleValue 日期没有相对日期 | 部分一致 | 阶段 4 | — | — |
| `Common.SemanticDateRange` | 词汇表没有这个术语，对应的是 manifest 设置 | 相对日期缺省开启，和 FE 一致 | FE 列表页不用 | 阶段 5（manifest） | — | — |

## 3. 值的显示

FE 单元格显示方式的判定顺序在 `FieldStructureHelper` 的 `setUpDisplayStyle`，文本排列在 `core/templating/DisplayModeFormatter` 的 `getDisplayMode`。

| 术语 / 记录属性 | FE 1.154 的处理（模块） | smart-kit 现状 | 结论 | 计划阶段 | ANN 编号 | 期 |
| --- | --- | --- | --- | --- | --- | --- |
| `Common.Text`（单元格） | 按 displayMode 绑定文本和代码，文本路径（可以经过导航）自动进入请求（`DisplayModeFormatter`、`macros/internal/helpers/DataPointTemplating`） | 相同，查询时自动 `$select` / `$expand` | 一致 | — | ANN-21 | 一期 |
| `UI.TextArrangement` 的来源与优先级 | `Common.Text@UI.TextArrangement` → 实体类型上的 `UI.TextArrangement`（`DisplayModeFormatter`） | 顺序相同 | 一致 | — | ANN-13 | 一期 |
| 有 Text、没有 TextArrangement 时的缺省 | DescriptionValue，即"文本 (代码)"（`DisplayModeFormatter`） | 缺省 TextFirst | 一致 | — | ANN-13 | 一期 |
| `TextFirst` / `TextLast` / `TextOnly` | `A (B)` 格式，导出相同（`DisplayModeFormatter`、`macros/table/mixin/ColumnManagement`） | 相同 | 一致 | — | ANN-13 | 一期 |
| `TextSeparate`（单元格） | 只显示代码，不会自动多出一列文本 | 只显示代码（`textArrangement.ts` 的注释"文本单独成列"不对，待改） | 一致 | 阶段 4（注释） | ANN-13 | 一期 |
| TextArrangement 在筛选令牌和值帮助里 | 有 Text 且有值帮助时按 getDisplayMode；有 Text 无值帮助时只显示值；TextSeparate 只显示值（`macros/filter/FilterFieldTemplating`） | TextSeparate 被改成 TextFirst；值帮助键属性的回退相同 | 不一致 | 阶段 4 | — | — |
| 带 Text 的列的对齐 | 有文本且不是 TextSeparate 时左对齐（`macros/field/FieldTemplating`、`FieldHelper`） | 只看 Edm 类型，数值代码带文本也右对齐 | 不一致 | 阶段 4 | — | — |
| 语义键单元格 | 响应式表格用 ObjectIdentifier（标题、描述两行），网格表用 LabelSemanticKey（`FieldStructureHelper`） | 整行加粗，一行显示 | 部分一致 | 阶段 4 | ANN-24 | 一期 |
| `Common.Label` 与列标题的回退 | DataField.Label → `Common.Label` → 属性名原样；`UI.DataFieldDefault` 的 Label 优先；`Common.QuickInfo` 作列提示（`Columns`） | `Label` → `Common.Label` → 按驼峰拆词（本库约定）；不支持 DataFieldDefault、QuickInfo | 部分一致 | 阶段 4 | ANN-20 | 一期 |
| 指向 DataPoint 的列标题 | 先取 DataPoint.Value 的 `Common.Label`，再取 DataField.Label，不用 DataPoint.Title（`Columns`，按压缩代码读出，待核实） | `Label` → DataPoint Title | 部分一致 | 阶段 4 | — | — |
| `Measures.ISOCurrency` | 表格里 `isCurrencyOrUnitAligned`，数字和币种分开对齐；小数位按 CodeList，否则按 CLDR（`MdcTableTemplate`、`FieldStructureHelper`） | 按 Intl 的 ISO 4217 小数位，数字后面加币种；不做小数点对齐 | 部分一致 | 阶段 4 | ANN-30 | 一期 |
| `Measures.Unit` | 同样对齐；小数位按 UnitsOfMeasure CodeList；常量 `%` 显示为"x %"（`core/templating/PropertyHelper`、`DataPointTemplating`） | 小数位按 Edm Scale facet，单位附在后面 | 部分一致 | 阶段 4 | ANN-30 | 一期 |
| `CodeList.CurrencyCodes` / `CodeList.UnitsOfMeasure` | 读每个代码的小数位和外部代码（`DataPointTemplating`、`base/BindingToolkit`、`core/AppComponent`） | 不读 | 未实现 | 阶段 4 | — | — |
| `Measures.Scale` | 只在 AnnotationConverter 里登记，不用 | 也不用；小数位来自 Edm 的 `Scale` facet（原 `02` 说支持 `Measures.Scale`，有误） | 一致（都不用） | — | ANN-30 | 一期 |
| `Common.IsCurrency` / `Common.IsUnit` | 只用于值帮助输入校验（`ValueHelpTemplating`） | 不读 | 未实现 | 阶段 4 | — | — |
| `UI.DoNotCheckScaleOfMeasuredQuantity` | 只在解析和编辑时跳过小数位校验（`core/templating/UIFormatters`） | 不读 | FE 列表页不用 | 阶段 6 核对 | — | — |
| `Common.IsDigitSequence` | String 类型约束 `isDigitSequence`：显示去前导零；输入时 UI5 的 `sap.ui.model.odata.type.String` 按 MaxLength 补零（`UIFormatters`、`ValueHelpDelegate`） | **阶段 3 按 FE**：输入全是数字时去零后补零到 MaxLength；文本运算符不解析；显示去前导零，有 MaxLength 时 "0" 显示为空。FE 对比场景确认 | 一致 | — | ANN-25 | 一期 |
| `Common.IsUpperCase` | 列表页不起作用，只在 AI 的 EasyFilter 里（`macros/ai/EasyFilterDataFetcher`） | 筛选输入转成大写（本库扩展，第 6.2 节） | 不一致 | 阶段 4（决定保留还是去掉） | ANN-25 | 一期 |
| `Common.IsCalendar*` | 只用于图表时间轴和微图表（`macros/chart/ChartDelegate`），单元格不按日期格式化 | 不读 | 一致（单元格）；图表时间轴未实现 | 阶段 4 | ANN-25 | 一期 |
| `Common.IsFiscal*` | 会计期类型，单元格按会计期格式显示（`BindingToolkit`、`macros/filter/FilterFieldHelper`） | 不读 | 未实现 | 阶段 4 | — | — |
| `Common.Timezone`（DateTimeOffset 上） | 按行的时区显示并附时区名（`UIFormatters`、`Columns`） | 只用全局时区 | 未实现 | 阶段 4 | — | — |
| `Common.IsTimezone` | 值显示为时区名称（`UIFormatters`） | 显示 IANA 字符串 | 未实现 | 阶段 4 | — | — |
| `UI.DateTimeStyle` | 按 short/medium/long/full 格式化（`UIFormatters`） | 固定 medium 日期加 short 时间 | 未实现 | 阶段 4 | — | — |
| `UI.IsImageURL` | Avatar；`IsNaturalPerson` 时圆形，否则方形（`FieldStructureHelper`、`FieldTemplating`） | Avatar，固定小圆角方形 | 部分一致 | 阶段 4 | ANN-14 | 一期 |
| `UI.IsImage`（流属性） | 显示方式 File，内容为图片（`FieldStructureHelper`、`DisplayStyle`） | 不读 | 未实现 | 阶段 4 | — | — |
| `Edm.Stream` + `Core.MediaType` / `ContentDisposition` / `AcceptableMediaTypes` | 显示方式 File：可下载的链接或图标，image/* 有预览（`DisplayStyle`） | 没有专门处理 | 未实现 | 阶段 4 | ANN-50 | 一期 |
| `Core.IsURL` | 列表页不显示为链接 | 显示为链接（本库扩展，第 6.2 节） | 不一致 | 阶段 4（决定保留还是去掉） | ANN-50 | 一期 |
| `DataFieldWithUrl` 的协议和 `IconUrl` | Link，href 不限协议；IconUrl 时带图标（`DisplayStyle`） | 只接受 `http(s):`、`/`、`mailto:`；不支持 IconUrl | 部分一致 | 阶段 4 | — | — |
| `HTML5.LinkTarget` | 取 record 或属性上的；缺省不设 target（当前窗口）（`DisplayStyle`） | 不读，外部链接一律 `_blank` | 不一致 | 阶段 4 | — | — |
| `UI.MultiLineText` | ExpandableText，超长截断带"更多"（`DisplayStyle`） | `pre-wrap` 显示全文 | 部分一致 | 阶段 4 | ANN-14 | 一期 |
| `Common.Masked` | 显示为掩码（`DisplayStyle`） | 显示明文 | 未实现 | 阶段 4 | — | — |
| `UI.InputMask` | 显示是普通文本，掩码只用于编辑（`FieldStructureHelper`、`EditStyle`） | 显示为普通文本 | 一致（显示） | 阶段 6 核对（编辑） | — | — |
| `UI.Placeholder` | 只用于编辑字段（`FieldTemplating`） | 不读 | 未实现 | 阶段 6 核对 | — | — |
| `Communication.IsEmailAddress` | `mailto:` 链接（`DisplayStyle`） | 纯文本 | 未实现 | 阶段 4 | — | — |
| `Communication.IsPhoneNumber` | `tel:` 链接（`DisplayStyle`） | 纯文本 | 未实现 | 阶段 4 | — | — |
| `Communication.Contact`（单元格） | 联系人卡片（`macros/contact/Contact`、`FieldStructureHelper`） | 列被丢弃（同第 1 节） | 未实现 | 阶段 4 | — | — |
| `Common.IsNaturalPerson` | 决定 Avatar 和快速预览头部的形状（`FieldTemplating`、`macros/quickView/QuickViewHeaderOptions`） | 只看有没有 `Communication.Contact`；头像固定形状 | 部分一致 | 阶段 4 | — | — |
| `DataField/Criticality`（单元格） | ObjectStatus，常量或路径（`FieldStructureHelper`、`CriticalityFormatters`） | 状态色和图标（0 中性、1 负面、2 警告、3 正面、5 信息） | 一致 | — | ANN-11 | 一期 |
| `DataField/CriticalityRepresentation` | 只有 `WithoutIcon` 不显示图标（`CriticalityFormatters`） | 相同 | 一致 | — | ANN-11 | 一期 |
| `UI.CriticalityType` 的 VeryPositive / VeryNegative | 颜色表达式只匹配 Negative、Critical、Positive、Information，其余 None（`core/formatters/CriticalityFormatter`） | 常量 VeryNegative、VeryPositive 上色 | 不一致 | 阶段 4 | — | — |
| `UI.Criticality`（属性上） | 词汇表 AppliesTo 是 Annotation，FE 只用 `LineItem@UI.Criticality` 做行高亮，不读属性上的（`Table`） | 当作单元格状态色的回退（本库扩展，第 6.2 节）；行高亮见第 1 节 | 不一致 | 阶段 4 | ANN-11 | 一期 |
| `UI.CriticalityRepresentation`（属性上） | 同上，FE 用的是 DataField 上的记录属性 | 读，和记录属性一起决定是否显示图标 | 部分一致 | 阶段 4 | ANN-11 | 一期 |
| `UI.DataPoint`：`Visualization` 为 Number 或缺省 | 有单位时 ObjectNumber，否则 ObjectStatus；`ValueFormat.NumberOfFractionalDigits` 生效（`macros/internal/DataPoint`、`DataPointTemplating`） | 按普通字段显示，单元格里不用 DataPoint 的小数位 | 部分一致 | 阶段 4 | ANN-10 | 一期 |
| DataPoint `Visualization=Rating`（`TargetValue`） | RatingIndicator，maxValue 取 TargetValue，缺省 5（`DataPoint`） | 相同 | 一致 | — | ANN-10 | 一期 |
| DataPoint `Visualization=Progress`（`TargetValue`、`Criticality`） | ProgressIndicator，"{值} of {目标}"，按单位或 % 显示，状态色取 Criticality（`DataPointTemplating`、`DataPoint`） | 目标缺省 100；没有状态色和单位 / % 处理 | 部分一致 | 阶段 4 | ANN-10 | 一期 |
| DataPoint `Criticality` | 常量或路径（`CriticalityFormatters`） | 相同 | 一致 | — | ANN-10 | 一期 |
| DataPoint `CriticalityCalculation` | 单元格不计算，只用于微图表和 KPI | 单元格不计算；微图表和 KPI 卡片计算（`15`） | 一致 | — | MC-60 | 三期 |
| DataPoint `ValueFormat.ScaleFactor` | 单元格不用 | 不用 | 一致 | — | — | — |
| DataPoint `Title` | 单元格不显示，列标题不用 | 用作列标题的回退 | 部分一致 | 阶段 4 | — | — |
| `UI.ValueCriticality` | 只用于图表和可视筛选按维度值着色（`macros/chart/ChartHelper`、`macros/visualfilters/InteractiveChartHelper`） | 不读 | 未实现 | 阶段 4 | — | — |
| `Validation.Minimum` / `Validation.Maximum` | 类型约束，校验筛选和编辑输入（`UIFormatters`） | 不读 | 未实现 | 阶段 4 | — | — |
| `Common.SemanticObject`（含 `SemanticObjectMapping`、`SemanticObjectUnavailableActions`） | 智能链接 LinkWithQuickView，列出 FLP 意图导航（`FieldStructureHelper`、`core/templating/SemanticObjectHelper`、`macros/quickView/QuickView`） | 不读（没有 FLP） | 未实现 | 阶段 4 | — | — |
| `UI.QuickViewFacets` | 字段是导航的外键、或经导航取目标的键或语义键时显示快速预览；DataPoint 也可以（`FieldTemplating`、`DataPoint`） | 外键规则相同，另有"文本经过导航"一条；缺"经导航取目标键或语义键"；DataPoint 不支持 | 部分一致 | 阶段 4 | ANN-86 | 二期 |
| `Common.ExternalID` | 显示外部 ID 而不是内部 ID（`PropertyHelper`、`FieldStructureHelper`、`DataPointTemplating`、`FilterFieldTemplate`） | 不读，会显示内部 GUID | 未实现 | 阶段 4 | — | — |
| `PersonalData.IsPotentiallyPersonal` | 只用于判断乐观批处理（`macros/table/Utils`） | 不读 | FE 列表页不用 | — | — | — |
| 按值列表取文本（retrieveTextFromValueList） | 只用于表单（`FieldTemplating`） | 表格没有 | 一致 | 阶段 6 核对（表单） | — | — |
| 空值显示（"–"） | 表格普通列 `showEmptyIndicator: false`（`MdcTableTemplate`；sap.m 的 Auto 模式是否显示待核实） | 单元格为空 | 一致（待核实） | — | — | — |
| `HTML5.CssDefaults`（`width`） | 列宽（同第 1 节） | 不读 | 未实现 | 阶段 4 | — | — |

## 4. 视图、呈现、聚合与能力

| 术语 / 记录属性 | FE 1.154 的处理（模块） | smart-kit 现状 | 结论 | 计划阶段 | ANN 编号 | 期 |
| --- | --- | --- | --- | --- | --- | --- |
| `UI.PresentationVariant`（列表页默认解析） | SPV 的 PV 要"合规"（Visualizations 含 LineItem 或 Chart），否则回退到 PV、再到 LineItem（`LRConverter`、`DataVisualization` `isPresentationCompliant`） | 不检查合规 | 部分一致 | 阶段 4 | ANN-04 | 一期 |
| 默认 SPV / PV（manifest `defaultTemplateAnnotationPath`） | manifest 指定带限定符的 SPV 作为默认（`DataVisualization`、`LRConverter`） | 没有对应属性 | 未实现 | 阶段 5 | — | — |
| `PV/SortOrder`（`Property`、`Descending`） | 表格初始排序，跳过不可排序的属性（`Table`、`macros/table/adapter/TablePVToState`） | 相同；金额先按单位排序（本库约定，第 6.3 节） | 一致 | — | ANN-04 | 一期 |
| `PV/SortOrder/DynamicProperty` | 只用于图表（`ChartHelper` `getSortConditions`） | 忽略 | 部分一致 | 阶段 4 | — | — |
| `PV/Visualizations` | 取第一个 LineItem 或 Chart，只引用 Chart 的 PV 在列表页只显示图表（`DataVisualization`） | 只用来找 LineItem 限定符，忽略 Chart | 部分一致 | 阶段 4 | ANN-04 | 一期 |
| `PV/RequestAtLeast` | 加进表格 `$select`（`Table` `createRequestedProperties`） | 加进 `$select`；多视图时用的是默认 PV 的，不是视图自己的 | 部分一致 | 阶段 4 | ANN-04 | 一期 |
| `PV/GroupBy` | ResponsiveTable 只用第一个路径，AnalyticalTable 所有层级（`Table`） | 只用第一个路径作为默认分组 | 部分一致 | 阶段 4 | ANN-04 | 一期 |
| `PV/Total` | 只用于 AnalyticalTable；没有 `Total` 时默认合计所有 CustomAggregate 的列；GridTable、ResponsiveTable 没有合计和小计（`Table` `updateTableVisualizationForType`、`getAggregateConditions`） | **阶段 3 按 FE（D39）**：合计和小计只给分析表；没有 `Total` 时默认合计全部可合计（CustomAggregate）列；多种币种时显示一个值加"多单位"标记，请求按单位一并聚合（按 FE） | 一致 | — | ANN-04 | 一期 |
| `PV/TotalBy`、`IncludeGrandTotal`、`DynamicTotal`、`RequestAtLeastDynamic`、`RecursiveHierarchyQualifier` | 列表页不读 | 不读 | FE 列表页不用 | — | — | — |
| `PV/MaxItems` | 表格每次加载的行数，缺省列表页 30、Grid/Analytical 100、Tree 200（`Table`）；KPI 图表的数据点数（`core/converters/controls/Common/KPI`） | 列表表格不读，页大小写死；只有卡片用 | 不一致 | 阶段 4 | — | — |
| `PV/InitialExpansionLevel` | TreeTable 的初始展开层级（`Table`） | 不读，层级表用 `levels` 属性 | 未实现 | 阶段 4 | — | — |
| `PV/Text` | 视图指向 PV 时作为标签页标题（`LRConverter`） | 只读 SPV 的 `Text` | 部分一致 | 阶段 4 | — | — |
| 多视图的来源（manifest `views.paths`） | 只在 manifest 配置时才有；每个 path 可以是 SPV、PV 或 SV，可以带自己的实体集；视图的 SV 是隐藏过滤；`showCounts` 控制计数（`LRConverter`） | 自动收集所有带限定符的 SPV；视图的完整 SV 作为隐藏过滤、SelectionFields 留在筛选栏（**阶段 3 按 FE**，`29a` 第④点已解决）；不支持 PV / SV 视图；`contents` 不能指定注解；视图没有排序时回退到默认 PV 的排序 | 部分一致 | 阶段 4、阶段 5 | ANN-85 | 二期 |
| 多视图：图表视图与表格视图 | 视图的 PV 引用 Chart 时是单独的图表视图，不能切成表格（`LRConverter`、`DataVisualization`） | 每个视图都是表格，图表只作为切换选项 | 不一致 | 阶段 4 | — | — |
| ALP / 混合视图（图表和表格同屏） | `hasMultipleVisualizations` 或 ALP 时图表加表格（`LRConverter`、`DataVisualization` `isAlpAnnotation`） | 只有表格 / 图表二选一 | 未实现 | 阶段 4（可以不做，写明） | — | — |
| `UI.Chart/ChartType`（列表页图表） | 映射约 40 种 sap.chart 类型（`ChartHelper`、`macros/chart/MdcChartTemplate`） | Bar 画横条，其他都画成柱状图 | 不一致 | 阶段 4 | ANN-82 | 二期 |
| `UI.Chart/Dimensions`、`Measures` | 多维度多度量；CustomAggregate 度量请求 `aggregate(M)`，transAgg 用它的 AggregationMethod；groupby 全部维度加度量的单位；多种单位时显示"Invalid data"（`MdcChartTemplate`、`macros/chart/ChartDelegate`） | **阶段 3 按 FE**：groupby 全部维度和度量单位（排序后），`Common.Text` 只在可分组且不经过导航时加入，不发 `$orderby` / `$top`；多币种显示"数据无效 / 部分度量单位不同"；画出全部度量。FE 对比场景 po-chart、po-chart-filter 0 差异 | 一致 | — | ANN-82 | 二期 |
| `UI.Chart/DimensionAttributes`、`MeasureAttributes`（Role、DataPoint） | 维度 Role（Category / Series / Category2）、度量 Role（Axis1-4）、度量的 DataPoint 传给图表（`ChartHelper`、`MdcChartTemplate`、`core/converters/controls/Common/Chart`） | **阶段 3**：维度 Role Series 拆成系列；Category2、度量 Role 未做；MeasureAttributes/DataPoint 读入模型，列表页图表不用 | 部分一致 | 阶段 4 | ANN-82 | 二期 |
| `UI.Chart/DynamicMeasures` | 指向 `Analytics.AggregatedProperty` 的度量（`MdcChartTemplate`） | 不读 | 未实现 | 阶段 4 | — | — |
| `UI.Chart/Actions` | 图表工具栏动作，跳过 Inline / Determining（`Chart` `getChartActions`） | 不读 | 未实现 | 阶段 4 | — | — |
| `UI.Chart/Title`、`Description` | 图表标题和描述（`Chart`、`ChartDelegate`） | 模型读了 Title，图表用的是页面标题；Description 不读 | 部分一致 | 阶段 4 | — | — |
| 图表需要 `ApplySupported` | 没有时报错，不渲染图表（`Chart` `createChartVisualization`） | 不检查，直接发 `$apply` | 不一致 | 阶段 4 | — | — |
| 图表的排序 | 用 PV SortOrder（含 DynamicProperty）；没有 SortOrder 时不排序（`ChartHelper`、`ChartPvToStateUtils`） | **阶段 3**：不再按维度升序，没有排序时和 FE 一样不发 `$orderby`；PV 的 SortOrder 还没读 | 部分一致 | 阶段 4 | — | — |
| `UI.KPI`（列表页页头 KPI 标签） | manifest `keyPerformanceIndicators` 指定时读 KPI 的 DataPoint、SV、Detail 的 PV / Chart；值必须是 CustomAggregate（`KPI`） | 列表页不支持；只有卡片有 `useKpi` | 未实现 | 阶段 4、阶段 5 | — | — |
| `UI.HeaderInfo/TypeNamePlural` | 表格标题（`Table` `getTableAnnotationConfiguration`） | 表格标题、导出标题；页面标题缺省也用它（FE 来自应用描述符） | 一致 | — | ANN-03 | 一期 |
| `UI.HeaderInfo/Title`、`Description`（删除确认） | 删除确认显示被删对象的 Title（`macros/table/TableEventHandlerProvider`） | 用语义键或主键拼成的标签 | 不一致 | 阶段 4 | — | — |
| `UI.HeaderInfo/TypeName` | 批量编辑对话框标题等（`MassEditDialogHelper`） | "已删除"提示、新建对话框标题 | 一致 | — | ANN-03 | 一期 |
| `Aggregation.ApplySupported/Transformations` | 全部 8 种转换时默认表格类型自动变成 AnalyticalTable；含 `search` 才允许搜索（分析表、层级表、图表）；读容器上的 `ApplySupportedDefaults`（`Table`、`Chart`、`core/converters/helpers/Aggregation`） | 只用于判断能否合计和小计；表格类型要手工设；不读 ApplySupportedDefaults | 部分一致 | 阶段 4 | — | — |
| `ApplySupported/GroupableProperties` | 列表为空＝都可分组，否则只有列出的（`Aggregation` `isPropertyGroupable`） | 相同（`23`） | 一致 | — | — | — |
| `ApplySupported/AggregatableProperties` | 分析表的可聚合列不看它而看 CustomAggregate；图表的可选度量参考它（`Table`、`Aggregation`、`Chart`、`ChartDelegate`） | **阶段 3**：合计只认 CustomAggregate（D39），和 FE 一致；图表个性化（可选度量）没有做 | 部分一致 | 阶段 4 | — | — |
| `ApplySupported/Rollup`、`PropertyRestrictions` | FE 不读 | 不读 | FE 列表页不用 | — | — | — |
| `Aggregation.CustomAggregate` | 分析表的可聚合、可合计列；图表度量请求 `aggregate(M)`；KPI 的值必须是它（`Table`、`Chart`、`KPI`） | **阶段 3 按 FE**：读入 `AggregationModel.customAggregates`；合计、小计、图表、KPI、卡片都请求 `aggregate(M)`；声明了 CustomAggregate 时只有这些属性可以合计。FE 对比场景确认 | 一致 | — | — | — |
| `Aggregation.ContextDefiningProperties` | 分析表聚合列的附加属性（例如币种）（`Table`、`Columns`） | 不读；按度量的 Unit / ISOCurrency 把单位放进 groupby，效果相同；其他上下文属性没有处理 | 部分一致 | 阶段 4 | — | — |
| `Aggregation.Groupable` / `Aggregatable`（属性级） | 只用于图表个性化的维度和度量候选（`ChartDelegate`、`Aggregation`） | 不读 | 未实现 | 阶段 4 | — | — |
| `Analytics.AggregatedProperty` / `AggregatedProperties` | 图表的 transAgg（`Chart`、`Aggregation` `getTransAggregations`），可视筛选也用 | 不读 | 未实现 | 阶段 4 | — | — |
| `Analytics.Measure` | 只用于把度量排除出导航上下文和 app state（`FilterBarDelegate`） | 不读 | 未实现 | 阶段 4 | — | — |
| `Analytics.Dimension` | FE 不读 | 不读 | FE 列表页不用 | — | — | — |
| `Aggregation.RecursiveHierarchy` + `Hierarchy.RecursiveHierarchy`（同一限定符） | 成对时默认表格类型自动变成 TreeTable；限定符缺省取第一个成对的；每次加载 200 行（`Table`） | 解析 `NodeProperty`、`ParentNavigationProperty`、`DrillState`、`DistanceFromRoot`、`LimitedDescendantCount`、`Matched`、`MatchedDescendantCount`、`ExternalKey`；要设 `tableType="TreeTable"`；请求 `TopLevels`（`26` §3.10，`27` UE-80～UE-89） | 部分一致 | 阶段 4 | UE-80 | — |
| `Hierarchy.RecursiveHierarchyActions` | TreeTable 的移动节点（`Table`） | 不读 | 未实现 | 阶段 4 | — | — |
| `Capabilities.SortRestrictions/Sortable`、`NonSortableProperties` | 列和 PV 排序跳过不可排序的（`MetaModelFunction`、`Table`、`EntitySetHelper`） | 相同 | 一致 | — | ANN-41 | 一期 |
| `SortRestrictions/AscendingOnlyProperties`、`DescendingOnlyProperties` | 属性的排序方向固定（`MetaModelFunction`） | 不读 | 未实现 | 阶段 4 | — | — |
| `Capabilities.CountRestrictions` | FE 不读 | `Countable=false` 时不发 `$count`，标签页计数关掉（多做，不冲突，保留） | FE 列表页不用 | — | ANN-43 | 一期 |
| `Capabilities.TopSupported`、`SkipSupported` | FE 不读 | 不支持时不发 `$top` / `$skip`（多做，保留） | FE 列表页不用 | — | ANN-43 | 一期 |
| `Capabilities.ExpandRestrictions` | FE 不读 | 不可展开的导航改为单独读取（多做，保留；`05`） | FE 列表页不用 | — | ANN-44 | 一期 |
| `Common.SemanticKey`（请求和路由） | 加进表格 `$select`；草稿根按语义键生成语义 URL（`Table`、`routing/ContextPathHelper`）；列加粗、显示草稿标记（`Columns`） | 列加粗、行标签；不保证进 `$select`；URL 用技术键；也决定面包屑和标题的回退 | 部分一致 | 阶段 4 | ANN-24 | 一期 |
| `Common.DraftRoot`：列表请求和编辑状态（含协作草稿） | 非协作草稿 6 个选项，"全部"＝`IsActiveEntity eq false or SiblingEntity/IsActiveEntity eq null`；协作草稿只有"全部 / 我的草稿 / 只看已保存"（`DraftEditState`）；额外请求 `HasActiveEntity`、`HasDraftEntity`、`InProcessByUser`（`Table`） | **阶段 3 按 FE**：非协作草稿的选项、过滤和请求字段一致（见第 1 节）；需要服务支持 `SiblingEntity`（mock 已补）。协作草稿的选项未做 | 部分一致 | 阶段 4（协作草稿） | — | — |
| `Session.StickySessionSupported` | 列表页"新建"用 `NewAction`（`StandardActions`、`Table`） | 不读 | 未实现 | 阶段 6 | — | — |
| `Common.SideEffects`（列表里） | 列表页有 SideEffects 扩展，批量编辑和内联编辑后触发（`templates/ListReport/overrides/SideEffects`、`massEdit/MassEditSideEffects`） | 不做；保存后整页重新读取；只在 PreparationAction 里传 `SideEffectsQualifier: ''` | 未实现 | 阶段 4、阶段 6 | — | — |
| `UI.CardItem` | 实验性；只有视图直接指向它时用 GridList（`DataVisualization`） | 不读 | 未实现 | 阶段 4（暂不做） | — | — |

## 5. 对象页（阶段 6 核对）

这些术语 FE 主要在对象页使用（`core/converters/templates/ObjectPageConverter`、`core/converters/controls/ObjectPage/*`、`controls/Common/Form`、`HeaderFacet`、`SubSection`），列表页的对照没有覆盖。下面是原 `02` 的说法和 smart-kit 现状，FE 的处理在阶段 6 写进 `29b`、`29c` 后补上。

| 术语 / 记录属性 | FE 1.154 的处理（模块） | smart-kit 现状 | 结论 | 计划阶段 | ANN 编号 | 期 |
| --- | --- | --- | --- | --- | --- | --- |
| `UI.HeaderInfo`（对象页） | 阶段 6 核对（`ObjectPageConverter`、`controls/ObjectPage/HeaderAndFooterAction`） | 对象页标题和副标题（`Title`、`Description`）、图片（`ImageUrl`）、面包屑文字 | 阶段 6 核对 | 阶段 6 | ANN-03 | 一期 |
| `UI.Facets` | 阶段 6 核对（`controls/ObjectPage/SubSection`） | `CollectionFacet` 是区块，子 Facet 是子区块；顶层 `ReferenceFacet` 是只有一个子区块的区块 | 阶段 6 核对 | 阶段 6 | ANN-06 | 一期 |
| `UI.ReferenceFacet` | 阶段 6 核对（`SubSection`、`controls/Common/Form`） | 指向 `FieldGroup`、`Identification` 的是表单；指向 `导航/@UI.LineItem` 的是子表；指向 `DataPoint` 的是关键值 | 阶段 6 核对 | 阶段 6 | ANN-06 | 一期 |
| `UI.CollectionFacet` | 阶段 6 核对 | 区块（顶层）和表单组集合（子区块内） | 阶段 6 核对 | 阶段 6 | ANN-06 | 一期 |
| `UI.PartOfPreview` | 阶段 6 核对 | 为 false 时放进"显示更多" | 阶段 6 核对 | 阶段 6 | ANN-07 | 一期 |
| `UI.HeaderFacets` | 阶段 6 核对（`controls/ObjectPage/HeaderFacet`） | FieldGroup 是表单，DataPoint 是关键值、评分或进度 | 阶段 6 核对 | 阶段 6 | ANN-08 | 一期 |
| `UI.FieldGroup`（表单） | 阶段 6 核对（`controls/Common/Form`） | 表单组，以及页头的表单 Facet | 阶段 6 核对 | 阶段 6 | ANN-09 | 一期 |
| `UI.Identification`（表单） | 阶段 6 核对 | 没有 Facet 时的默认表单字段 | 阶段 6 核对 | 阶段 6 | ANN-09 | 一期 |
| `UI.Identification` 的 `DataFieldForAction`（`Determining`） | 阶段 6 核对（`HeaderAndFooterAction`） | 页头和页脚动作，可用性和部分处理见 ADR-024 | 阶段 6 核对 | 阶段 6 | ANN-81 | 二期 |
| `UI.Chart`（页头微图表 Facet） | 阶段 6 核对（`HeaderFacet`、`macros/microchart`） | Bullet、Donut、Pie、Column、Line、Bar 等页头微图表 Facet（ADR-021），类型对应见 `15` | 阶段 6 核对 | 阶段 6 | ANN-83 | 二期 |
| `UI.Chart` 作为微型图表（九种）及 DataPoint 的 `CriticalityCalculation`、`ForecastValue`、`DeltaBulletChart`、`ValueFormat` | 阶段 6 核对（`macros/microchart`、`suite/ui/microchart`） | 九种全做，规则见 `15` 第 3 节，验收见 `17`、`18`；Delta 暂用本库约定 `Waterfall`（待定） | 阶段 6 核对 | 阶段 6 | MC-60、MC-61、MC-65 | 三期 |
| `UI.DataPoint` 的 `SampleSize`、`MinimumValue`、`MaximumValue` | 阶段 6 核对 | 汇总评分、微图表的刻度 | 阶段 6 核对 | 阶段 6 | ANN-84 | 二期 |
| `UI.Importance`（表单字段） | 阶段 6 核对 | 表单字段在小屏隐藏 | 阶段 6 核对 | 阶段 6 | ANN-87 | 二期 |
| `Common.FieldControl`（`Hidden`） | 阶段 6 核对（`UIFormatters`、`macros/field`） | 值为 0 时字段隐藏 | 阶段 6 核对 | 阶段 6 | ANN-23 | 一期 |
| `Common.FieldControl`（`Mandatory`、`ReadOnly` 常量） | 阶段 6 核对 | 编辑和新建时的必填与只读 | 阶段 6 核对 | 阶段 6 | ANN-88 | 二期 |
| `Common.DraftRoot`、`Common.DraftNode` 的动作 | 阶段 6 核对（`core/controllerextensions/EditFlow`、`editFlow/draft`） | 草稿编辑策略：`EditAction`、`PreparationAction`、`ActivationAction`（ADR-018） | 阶段 6 核对 | 阶段 6 | ANN-89 | 二期 |
| `Core.Computed`、`Core.Immutable`、`Core.OptimisticConcurrency` | 阶段 6 核对（编辑） | 入模型，编辑时用（OP-20） | 阶段 6 核对 | 阶段 6 | ANN-50 | 一期 |
| `Core.Description` | 阶段 6 核对 | 字段说明，作为提示 | 阶段 6 核对 | 阶段 6 | ANN-50 | 一期 |
| `UI.ConnectedFields`（表单）、`UI.Note` | 阶段 6 核对 | 不做 | 阶段 6 核对 | 阶段 6 | — | — |
| `UI.Badge` | 阶段 6 核对 | 不做 | 阶段 6 核对 | 阶段 6 | — | — |
| `Common.SideEffects`（对象页编辑） | 阶段 6 核对（`core/services/SideEffectsServiceFactory`） | 不做；保存后整页重新读取 | 阶段 6 核对 | 阶段 6 | — | — |

## 6. 其他

### 6.1 模型、解析与合并

| 项 | FE 1.154 的处理（模块） | smart-kit 现状 | 结论 | 计划阶段 | ANN 编号 | 期 |
| --- | --- | --- | --- | --- | --- | --- |
| `Common.DraftRoot` 的识别 | 草稿服务（`core/helpers/ModelHelper` `isDraftSupported`） | 模型标记草稿服务 | 一致 | — | ANN-26 | 一期 |
| `Aggregation.ApplySupported`（实体集或实体类型上） | 见第 4 节 | 没有它就没有合计和图表；能分组、能合计的属性见第 4 节和 `23` | 见第 4 节 | — | GT-01、GT-06 | — |
| 同一服务的 CSDL XML 与 CSDL JSON 得到相同模型 | FE 只读 OData 模型给出的元数据 | 两种格式得到相同模型 | —（本库的输入层） | — | ANN-70 | 一期 |
| 多份注解文件和覆盖层按顺序整条覆盖 | OData 模型的注解合并 | 按顺序整条覆盖 | —（本库的输入层） | — | ANN-71 | 一期 |
| 不同文件使用不同别名 | OData 模型解析别名 | 支持 | —（本库的输入层） | — | ANN-72 | 一期 |

### 6.2 smart-kit 的扩展（FE 不这样做，阶段 4 逐条决定保留还是去掉）

| 项 | smart-kit | FE 1.154 |
| --- | --- | --- |
| 属性上的 `UI.Criticality` | 作为单元格状态色的回退 | 不读，只用 `LineItem@UI.Criticality` 做行高亮 |
| `Core.IsURL` | 显示为链接 | 不处理 |
| `Common.IsUpperCase` | 筛选输入转大写 | 列表页不处理 |
| VeryPositive、VeryNegative | 上色 | 不上色 |
| 外部链接 | `_blank` | 缺省当前窗口，按 `HTML5.LinkTarget` |
| `CountRestrictions`、`Top/SkipSupported`、`ExpandRestrictions` | 读 | 不读（保留，不冲突） |

### 6.3 零注解时的推导（本库约定，FE 不推导；见 `04-model-spec.md` 第 4 节）

FE 没有 LineItem 时是"默认表"（属性都可以在个性化里添加），没有 SelectionFields 时不推导筛选字段；smart-kit 为零注解服务推导以下内容，保留为本库约定。

| 缺失的注解 | 推导 | ANN 编号 |
| --- | --- | --- |
| `UI.LineItem` | 主键加上前若干个基本类型属性（排除流、二进制、`UI.Hidden`），最多 8 列 | ANN-60 |
| `UI.SelectionFields` | 主键，以及有 `ValueList` 的属性；都没有时取前 3 个可筛选的字符串属性 | ANN-61 |
| `UI.HeaderInfo` | `TypeName` 用实体类型名拆词；`Title` 取第一个名字像 Name / Title / Description 的字符串属性，没有就取主键 | ANN-62 |
| `UI.Facets` | 一个"常规信息"区块（全部基本类型属性的表单），加上每个集合导航一个子表区块 | ANN-63 |
| `Common.Label` | 属性名按驼峰和下划线拆成单词（FE 用属性名原样） | ANN-64 |

## 7. 汇总

### 7.1 列表页 195 行的结论（按 `29a` 的行统计）

`29a` 的每一行都对应上面第 1～4 节的一行（`29a` 里重复的几行在这里合并了，例如 `Communication.Contact`、`CssDefaults/width`、草稿编辑状态；统计仍按 `29a` 的 195 行）。

| 组 | 行数 | 一致（29a → 现在） | 部分一致 | 不一致 | 未实现 | FE 列表页不用 |
| --- | --- | --- | --- | --- | --- | --- |
| 表格列与动作 | 41 | 2 → 3 | 15 → 15 | 7 → 6 | 15 → 15 | 2 → 2 |
| 筛选栏与值帮助 | 47 | 5 → 10 | 11 → 12 | 3 → 0 | 21 → 18 | 7 → 7 |
| 值的显示 | 57 | 16 → 17 | 14 → 13 | 7 → 7 | 18 → 18 | 2 → 2 |
| 视图、呈现、聚合与能力 | 50 | 5 → 8 | 14 → 17 | 9 → 5 | 16 → 14 | 6 → 6 |
| **合计** | **195** | **28 → 38** | **54 → 57** | **26 → 18** | **70 → 65** | **17 → 17** |

阶段 3 改变结论的 `29a` 行（按 `29a` 文件的行号）：

| `29a` 行 | 术语 | 29a | 现在 |
| --- | --- | --- | --- |
| 53 | 草稿编辑状态筛选 | 不一致 | 一致 |
| 38 | `Core.OperationAvailable`（非绑定动作） | 部分一致 | 部分一致（缺陷已修，其余见行内） |
| 54、52 | 草稿标记和请求字段、语义键列的草稿标记 | 部分一致 | 部分一致（主要部分已按 FE） |
| 74 | `Common.FilterDefaultValue` | 未实现 | 一致 |
| 80 | 多视图的 SV | 不一致 | 一致 |
| 87 | `SearchRestrictions/Searchable` 缺省 | 不一致 | 一致 |
| 93 | `ValueList/SearchSupported` 缺省 | 不一致 | 一致 |
| 98 | In / InOut / Constant 过滤 | 未实现 | 一致 |
| 99 | Out / InOut 回写 | 未实现 | 部分一致（输入校验未做） |
| 152 | `Common.IsDigitSequence` | 部分一致 | 一致 |
| 217 | `PV/Total` | 部分一致 | 一致（D39） |
| 222、223 | 默认 SPV 的初值、多视图来源 | 部分一致 | 部分一致（见 7.2） |
| 227 | `UI.Chart` 维度和度量 | 不一致 | 一致 |
| 228 | DimensionAttributes / MeasureAttributes | 未实现 | 部分一致 |
| 233 | 图表排序 | 不一致 | 部分一致 |
| 240 | `AggregatableProperties` | 不一致 | 部分一致 |
| 242 | `Aggregation.CustomAggregate` | 未实现 | 一致 |
| 256 | 草稿列表请求和编辑状态（含协作草稿） | 不一致 | 部分一致（协作草稿未做） |

### 7.2 阶段 3 发现的 `29a` 更正

1. **第 222 行（多视图时的筛选栏初值）**：`29a` 说 FE 多视图时不设筛选栏初值（`LRConverter` 的 `j2 = $2 ? undefined : S(...)`）。FE 对比场景（`purchasing-views`）表明 FE 多视图时**照样**用默认 SV 设筛选栏初值（"已关闭"标签页在默认 `Status ne CLOSED` 下为空）。smart-kit 现在和 FE 一样；这一行剩下的差异只是"SPV 没有 SV 时回退到 `UI.SelectionVariant`"。
2. **第 223 行第④点（视图字段从筛选栏拿掉）**：FE 里视图的 SV 是表格的隐藏过滤，SelectionFields 的字段留在筛选栏；拿掉字段是 smart-kit 自己的做法，阶段 3 已去掉。
3. **第 217 行（`PV/Total`）和 `23` 的设计**：`29a` 建议"在 ApplySupported 加网格表的情况下"按 FE 默认合计全部可聚合列。FE 源码（`Table` 的 `updateTableVisualizationForType`、`getAggregateConditions`）表明 **GridTable 和 ResponsiveTable 都没有合计和小计**（GridTable 也不能分组），只有 AnalyticalTable 有；服务没有 CustomAggregate 时不合计。按 D39 改为只给分析表。多种币种的合计 FE 显示一个值加"多单位"标记（请求按单位一并聚合），不是 `23` 第 3.2 节的按币种分行，已按 FE 改。
4. **第 228 行（DimensionAttributes）**：维度 Role 的 Series 已按 FE 拆系列，Category2 和度量的 Axis 角色还没做（`29a` 记为整体未实现）。
5. **第 233 行（图表排序）**：FE 在没有 PV SortOrder 时图表请求不带 `$orderby` / `$top`；`29a` 只写了"用 PV SortOrder"。smart-kit 去掉了按维度升序，PV SortOrder 还没读。
6. **第 227 行（图表请求的细节）**：FE 的 groupby 除维度外还包括度量的单位；`Common.Text` 只在可分组且不经过导航时加入（否则图表显示代码）；多种单位时显示"Invalid data / Some measures have different units."。`29a` 没有写这些。
7. **第 152 行（IsDigitSequence 的补零规则）**：`29a` 标"待核实"。FE 对比场景确认：输入全是数字时去零后补零到 MaxLength；文本运算符（Contains 等）不解析；显示时去前导零，有 MaxLength 时 "0" 显示为空。
8. **第 54 行和第 256 行互相矛盾**：第 256 行说 smart-kit 额外请求的草稿字段"和 FE 一致"，第 54 行说不请求 `HasActiveEntity`。按代码第 54 行是对的；阶段 3 已补上。
9. **原 `02` 的错误**：第 3 节说支持 `Measures.Scale`，实际用的是 Edm 的 Scale facet（`29` 第 8 节），本文已改正；`textArrangement.ts` 关于 TextSeparate 的注释待阶段 4 改正。
