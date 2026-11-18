# 02 注解覆盖表（以 Fiori elements 1.154 源码为依据）

> 状态：现行 · 2026-11-18（阶段 3 重写，`31` 阶段 3、ADR-033；阶段 4 更新，D41、D42、D43；阶段 4 收尾更新，D45）。
>
> **依据**：SAPUI5 / Fiori elements 1.154.0 的 sap.fe 源码（core、macros、templates、base 四个库按模块拆开读，模块路径相对 `sap/fe/`，对应源码可在 `https://ui5.sap.com/1.154.0/resources/sap/fe/<模块>-dbg.js` 找到），以及 FE 对比测试（`npm run e2e:fe`，同一份 `$metadata` 和注解分别交给 FE 参考应用 `apps/fe-reference` 和 smart-kit，比较请求和显示）。列表页部分以 `29a` 的 195 行逐条对照为底稿，按阶段 3、阶段 4 的结果更新；**只用于对象页的术语在阶段 6 核对**（`29b`、`29c`），这里先保留原来的说法，标为"阶段 6 核对"。
>
> **结论**：一致 / 部分一致 / 不一致（行为不同）/ 未实现 / FE 列表页不用。阶段 3、阶段 4 改过的行，只有 FE 对比场景或 FE 源码确认过的才写"一致"；只按 FE 源码实现、还没有 FE 对比场景的，写明"只有单元测试"。
>
> **计划阶段**：`31` 的阶段（阶段 4：列表页其余注解；阶段 5：页面模板和 manifest 设置；阶段 6：对象页注解）。"—"表示不需要再改。阶段 4 已完成（D43）："阶段 4 收尾"是 D43 留给收尾的，收尾已完成（D45），做完的行改为"—"，剩下的差异按 `tools/ui5-alignment/deviations.json` 写登记的阶段；"待排"是阶段 4 没做、还没排进哪个阶段的；"长期"是登记为长期偏差的（D42 等）；仍写"阶段 4"的行是阶段 4 没有涉及的（多为 `29a` 的 P3），还没排定。
>
> **ANN 编号和期**：ANN 编号是测试编号，测试名称里带这个编号（例如 `it('ANN-01 …')`）。"期"一列是原来的交付期次（一期 / 二期 / 三期），`npm run trace`（`scripts/trace.mjs`）按这一列检查每个一期条目都有测试、每个二期条目都有通过的测试；新加的行没有原来的期次，写"—"。
>
> 词汇表命名空间：UI = `com.sap.vocabularies.UI.v1`，Common = `com.sap.vocabularies.Common.v1`，Measures = `Org.OData.Measures.V1`，Capabilities = `Org.OData.Capabilities.V1`，Core = `Org.OData.Core.V1`，Aggregation = `Org.OData.Aggregation.V1`，Analytics = `com.sap.vocabularies.Analytics.v1`，Communication = `com.sap.vocabularies.Communication.v1`，HTML5 = `com.sap.vocabularies.HTML5.v1`。
>
> 常用 FE 模块简称：`Table` = `core/converters/controls/Common/Table`，`Columns` = `core/converters/controls/Common/table/Columns`，`FilterBar` = `core/converters/controls/ListReport/FilterBar`，`LRConverter` = `core/converters/templates/ListReportConverter`，`DataVisualization` = `core/converters/controls/Common/DataVisualization`，`FieldStructureHelper` = `macros/internal/field/FieldStructureHelper`，`DisplayStyle` = `macros/internal/field/DisplayStyle`，`ValueListHelper` = `macros/internal/valuehelp/ValueListHelper`，`StandardActions` = `core/converters/controls/Common/table/StandardActions`。

## 1. 表格列与动作

| 术语 / 记录属性 | FE 1.154 的处理（模块） | smart-kit 现状 | 结论 | 计划阶段 | ANN 编号 | 期 |
| --- | --- | --- | --- | --- | --- | --- |
| `UI.LineItem`：怎样选定（SPV、PV、限定符） | 按 manifest 的默认 SPV → 不带限定符的 SPV → 不带限定符的 PV → `UI.LineItem` 的顺序选，PV 的 `Visualizations` 要含 LineItem 或 Chart 才采用；取第一个 LineItem 或 Chart，Chart 在前时默认显示图表（`LRConverter`、`DataVisualization`） | **阶段 4 按 FE**：不带限定符的 SPV → PV → `UI.LineItem`，PV 的 Visualizations 不含 LineItem 或 Chart 时不采用（也不用它的排序和 RequestAtLeast）；Chart 在前时整页只显示图表。FE 对比场景确认（`views4-pv-chart-first`、`views4-pv-not-compliant`）。manifest 的默认 SPV 见第 4 节 | 一致 | —（默认 SPV 阶段 5） | — | — |
| `UI.LineItem`：列集合与个性化 | LineItem 的记录生成列；实体上其他不隐藏的属性生成 `availability:"Adaptation"` 的列，可在个性化里添加；没有 LineItem 时是默认表（`Columns` `getColumnsFromEntityType`、`Table`） | **阶段 4 按 FE**：LineItem 以外不隐藏的属性可以在个性化里添加，默认不显示；没有 LineItem 时推导最多 8 列（本库约定，见第 6.3 节）。**阶段 4 收尾**：个性化对话框的候选按 FE：列面板先列显示中的列，其余按字母序；排序是全部可排序属性（去掉 NonSortable 和 TextOnly 的属性，加上文本和 criticality 的技术属性）；响应式表格的分组候选同排序，分析表的分组候选是 GroupableProperties。FE 对比场景确认（`cols5-p13n-GridTable`、`cols5-p13n-ResponsiveTable`；分析表的分组没有对比场景） | 一致 | — | — | — |
| `UI.LineItem@UI.Criticality`（行高亮） | 注在 LineItem 集合上，生成行的 `highlight`（`Table`、`core/converters/…/Criticality`、`macros/table/MdcTableTemplate`） | **阶段 4 按 FE**：读 LineItem 上的 `UI.Criticality`（路径加进请求）：1 错误、2 警告、3 成功、5 信息，没激活过的新草稿为信息。常量（Negative、VeryNegative、VeryPositive 等）：真 FE 把枚举名交给 `TableFormatter.rowHighlighting`，值不合法，**不高亮**，smart-kit 跟着不高亮。路径值和常量都经阶段 4 收尾的 FE 对比场景确认（`cols5-types`、`cols5-negative`、`cols5-very-negative`、`cols5-very-positive`） | 一致 | — | — | — |
| `UI.DataField`：`Value`、`Label` | 标签：`Label` → Value 的 `Common.Label` → 属性名；提示取 `Common.QuickInfo`（`Columns`） | 标签：`Label` → 属性标签（相同）；不设提示 | 一致 | — | ANN-01 | 一期 |
| `DataField/Criticality`、`CriticalityRepresentation`（列） | 记录上有 `Criticality` 时显示为 ObjectStatus；除 `WithoutIcon` 外带图标（`FieldStructureHelper`、`core/templating/CriticalityFormatters`）；不用属性上的 `UI.Criticality` | 只用记录上的值；**阶段 4（D41）**：不再回退到属性上的 `UI.Criticality`；VeryNegative、VeryPositive 和路径值 -1、4 都不上色（同 FE） | 一致 | — | ANN-11 | 一期 |
| `@UI.Importance`（列） | 语义键列和 `InsertRestrictions/RequiredProperties` 的列一律 High，优先于记录上的值；FieldGroup 列取组内最高值（`Columns`） | 先取记录上的 Importance，再看语义键，默认 Medium；响应式表格按宽度隐藏列（ADR-020） | 部分一致 | 阶段 4 | ANN-87 | 二期 |
| `@UI.Hidden`（列） | 静态 Hidden 的列 availability 为 Hidden；路径形式按行隐藏单元格内容（`core/converters/helpers/DataFieldHelper`、`Columns`） | 静态 Hidden 的列去掉；路径形式当作 false | 部分一致 | 阶段 4 | ANN-12 | 一期 |
| `@HTML5.CssDefaults/width` | 列宽（`Columns`） | **阶段 4 按 FE**：作为列宽。阶段 4 收尾 FE 对比场景确认（`cols5-types`） | 一致 | — | — | — |
| `@HTML5.RowSpanForDuplicateValues` | 响应式表格合并相邻的重复值（`Columns`、`MdcTableTemplate`） | 不读 | 未实现 | 阶段 4 | — | — |
| `UI.DataFieldDefault` | 属性派生的列用它的 Label 和 Importance（`Columns`） | 不读 | 未实现 | 阶段 4 | — | — |
| `UI.DataFieldWithUrl`（`Url`、`IconUrl`、`@HTML5.LinkTarget`） | 链接，target 取 LinkTarget，缺省当前窗口；有 IconUrl 时带图标；不限协议（`DisplayStyle`） | **阶段 4 按 FE**：target 取 LinkTarget，缺省当前窗口（D41）；有 IconUrl 时带图标；不限协议，只拒绝 `javascript:`、`vbscript:`、`data:`（本库的安全约定）。FE 对比场景确认（`display4-contacts`） | 一致 | — | — | — |
| `UI.DataFieldWithNavigationPath` | 链接，点击按 `Target` 导航（`DisplayStyle`） | **阶段 4 按 FE**：值是链接，点击按 `Target` 导航。链接的显示阶段 4 收尾 FE 对比场景确认（`cols5-types`），点击导航只有单元测试 | 一致 | — | — | — |
| `UI.DataFieldWithIntentBasedNavigation` | 列照常显示值；目标意图存在时值是链接（`DisplayStyle`、`Columns`） | **阶段 4（D42）**：列照常显示值；导航目标由宿主的 `NavigationAdapter.semanticTargets` 给出，有目标时值是链接，没有时是普通文本（和没有 FLP 的 FE 相同）；需要 FLP 的部分（Mapping 等）登记为长期偏差。没有目标时只显示值，阶段 4 收尾 FE 对比场景确认（`cols5-types`） | 部分一致 | 长期（D42） | — | — |
| `UI.DataFieldWithAction` | 列显示值，值是执行动作的链接（`DisplayStyle`） | **阶段 4 按 FE**：显示值，值是执行动作的链接。列和值阶段 4 收尾 FE 对比场景确认（`cols5-types`），点击执行只有单元测试 | 一致 | — | — | — |
| `UI.DataFieldWithActionGroup` | 列转换不把它当成列，列表不显示（`Columns`；术语是 Experimental） | **阶段 4 按 FE**：不作为列 | 一致 | — | — | — |
| `UI.DataFieldForAnnotation` → `UI.DataPoint` | DataPoint 控件显示评分、进度或数值；列标签先取 DataPoint Value 的 `Common.Label`，再取记录 `Label`，不用 `Title`；导出带目标值（`Columns`、`macros/internal/DataPoint`） | 支持评分、进度、数值；**阶段 4 按 FE**：标签先取 DataPoint Value 的 `Common.Label`，再取记录 `Label`，不用 `Title`（FE 对比场景 `cols-po-list` 确认）；导出不带目标值 | 部分一致 | 待排（导出） | ANN-10 | 一期 |
| `UI.DataFieldForAnnotation` → `UI.Chart`（单元格微图表） | 单元格里的 XS 微图表，也接受 PV 作为目标；没有数据时隐藏（`MdcTableTemplate`） | 支持行自身、单值导航、集合导航的图表；不接受 PV 作为目标。九种微图表，规则见 `15`，验收见 `17`；**阶段 4**：没有 `Label` 时，列标题和 FE 一样是列的键（例如 `DataFieldForAnnotation::Chart::BudgetBullet`） | 一致 | — | MC-60、MC-61、MC-65 | 三期 |
| `UI.DataFieldForAnnotation` → `Communication.Contact` | Contact 控件：名字链接，点开联系人弹出框（`DisplayStyle`、`macros/contact/Contact`） | **阶段 4 按 FE**：名字链接，点开弹出框（职位、部门、角色、电话、邮件），详细信息在打开时按键读取。FE 对比场景确认（`display4-contacts`）。只显示第一个电话和邮件，没有地址和照片（阶段 6，DV-display4-006） | 部分一致 | 阶段 6 | — | — |
| `UI.DataFieldForAnnotation` → `UI.FieldGroup` | 一列里纵向列出组内字段，缺省不带标签（manifest `showDataFieldsLabel` 时才带）；全部隐藏时整列隐藏（`MdcTableTemplate`、`Columns`） | **阶段 4 按 FE**：一个单元格里纵向列出，不带标签。阶段 4 收尾 FE 对比场景确认（`cols5-types`） | 一致 | — | — | — |
| `UI.ConnectedFields`（列） | 按 `Template` 把多个字段拼在一个单元格（`MdcTableTemplate`、`Columns`） | **阶段 4 按 FE**：按 `Template` 拼成一行。阶段 4 收尾 FE 对比场景确认（`cols5-types`） | 一致 | — | — | — |
| `UI.DataFieldForAction`（工具栏） | 非 Inline、非 Determining 的动作放在工具栏；绑定动作要先选行；没有绑定动作和删除时表格不可选（`Table`） | **阶段 4 按 FE**：非 Inline、非 Determining 的动作放进工具栏，顺序是注解动作、没有锚点的自定义动作、新建、复制、删除（FE 对比场景 `cols-po-draft-list` 工具栏一致）；表格仍始终可多选；参数对话框、部分处理见 ADR-024 | 部分一致 | 待排（选择列） | ANN-80 | 二期 |
| `DataFieldForAction/Inline`（及 `Criticality`、`IconUrl`） | 每个 Inline 动作单独一列，在 LineItem 里的位置；不可用时禁用；按钮类型按 Criticality（`Columns`、`DisplayStyle`、`CriticalityFormatters`） | **阶段 4 按 FE**：每个 Inline 动作单独一列，在 LineItem 里的位置，列名 "Inline Action"、不显示列标题；不可用时禁用（FE 对比场景 `cols-po-list` 列标题一致）。Criticality 和 IconUrl 还没用上 | 部分一致 | 待排（Criticality、IconUrl） | — | — |
| `DataFieldForAction/Determining`（在 LineItem 里） | 列表页不放进工具栏，也没有页脚，所以不显示（`Table`） | **阶段 4 按 FE**：不放进工具栏 | 一致 | — | — | — |
| `DataFieldForAction/InvocationGrouping` | `ChangeSet` 时多行在一个 change set 里执行（`macros/internal/helpers/ActionHelper`） | 逐行请求，相当于 Isolated | 部分一致 | 阶段 4 | — | — |
| `Core.OperationAvailable` | 绑定动作按选中行求值，至少一行可用时可用，只处理可用的行；非绑定动作、静态值按常量或表达式（`ActionHelper` `getOperationAvailableMap`、`macros/table/TableHelper`、`Table`） | 绑定动作按选中行判断，部分可用时弹出部分处理对话框；**阶段 3 修正**：非绑定动作为 false 或路径时按钮禁用（以前可点、点了无反应）。上下文路径的警告未做 | 部分一致 | 阶段 4（其余） | — | — |
| `Common.IsActionCritical` | 执行前确认（`core/controllerextensions/editFlow/operations/Operation`、`core/templating/ActionHelper`） | **阶段 4 按 FE**：没有参数对话框时，执行前先确认。确认对话框阶段 4 收尾 FE 对比场景确认（`cols5-types`） | 一致 | — | — | — |
| `UI.IsCopyAction` | 标准"复制"按钮，放在"新建"之后，执行后导航到新实例（`Table`、`core/converters/controls/Common/Action`） | **阶段 4 按 FE**："复制"放在"新建"之后，正好选中一行时可用（有 OperationAvailable 时按它），执行后打开新实例的对象页。位置和可用性阶段 4 收尾 FE 对比场景确认（`cols5-types`，选一行、两行），执行后的导航只有单元测试 | 一致 | — | — | — |
| `UI.IsAIOperation` | 按钮和菜单带 AI 标记（`Action`） | 不读 | 未实现 | 阶段 4 | — | — |
| `UI.DataFieldForActionGroup` | 工具栏菜单按钮，子动作可用性同样计算（`Table`、`ActionHelper`） | **阶段 4 按 FE**：在原来的位置显示菜单按钮，子动作保留（`ui.actionGroups`）；菜单总是可用，菜单项按选中行判断。菜单按钮阶段 4 收尾 FE 对比场景确认（`cols5-types`） | 一致 | — | — | — |
| `UI.DataFieldForIntentBasedNavigation` | 工具栏按钮或 Inline 列，`RequiresContext` 时要选行，依赖 launchpad（`Table`、`DisplayStyle`） | 忽略 | 未实现 | 阶段 4 | — | — |
| `UI.CreateHidden` | 实体集或实体类型上，常量或路径，为真时隐藏"新建"（`StandardActions`） | **阶段 4**：读实体集上的，没有时读实体类型上的；常量为真时隐藏"新建"；路径形式不求值（FE 按绑定表达式求值）。常量形式阶段 4 收尾 FE 对比场景确认（`cols5-create-delete-hidden`） | 部分一致 | 待排（路径） | — | — |
| `UI.DeleteHidden` | 为真时隐藏"删除"（`StandardActions`） | **阶段 4**：同上，常量为真时隐藏"删除"；路径形式不求值。常量形式阶段 4 收尾 FE 对比场景确认（`cols5-create-delete-hidden`） | 部分一致 | 待排（路径） | — | — |
| `UI.UpdateHidden` | 列表页没有"编辑"按钮，只用于批量编辑和对象页（`StandardActions`） | 不读 | FE 列表页不用 | 阶段 6 核对 | — | — |
| `Capabilities.InsertRestrictions` | `Insertable` 常量、路径或表达式；草稿根有 `NewAction` 时用它的 OperationAvailable；`RequiredProperties` 在新建时必填；默认新建方式 NewPage（`StandardActions`、`Table`） | 读入模型（`insertable`）；**阶段 4**：路径形式的 `Insertable` 保留"新建"；表达式当作 true；默认对话框新建；`newAction` 读了没用。没有草稿的服务，列表页也有"新建"（FE 1.154 只在草稿、粘性会话或 External 新建方式时有），按 D42 补记长期保留（`kit-extension`，DV-FE-04） | 部分一致 | 阶段 5（新建方式）；长期（非草稿新建） | ANN-45 | 一期 |
| `Capabilities.DeleteRestrictions` | `Deletable` 常量 false 时隐藏"删除"；路径时加进请求，选中的行里至少一行可删时可用，只删可删的行（`Table`、`StandardActions`） | **阶段 4 按 FE**：常量和路径形式都按 FE（路径加进请求，按行判断）。路径形式阶段 4 收尾 FE 对比场景确认（`cols5-deletable-path`：请求、选行后的可用性、确认文字） | 一致 | — | ANN-45 | 一期 |
| `Capabilities.UpdateRestrictions` | 列表页只用于批量编辑（`Table`） | 读入模型，给对象页编辑用 | FE 列表页不用 | 阶段 6 核对 | ANN-45 | 一期 |
| `Capabilities.SupportedFormats` | 含 `application/pdf` 时导出菜单多一个 PDF；XLSX 总是有（`macros/table/delegates/TableDelegate`） | 只导出 xlsx | 未实现 | 阶段 4 | — | — |
| `UI.MediaResource` | 有 Stream 时启用上传表格插件（`Table`） | 不读（`UploadSetwithTable` 要手工配置） | 未实现 | 阶段 4 | — | — |
| `Common.SemanticKey`（列和请求） | 总是请求语义键；响应式表格显示为 ObjectIdentifier，网格表是加粗 Label；Importance High；草稿标记在语义键单元格，网格表单独一列 `draftStatus`（`Table`、`Columns`、`MdcTableTemplate`） | 语义键列加粗；**阶段 3**：网格表的草稿标记改为单独一列 `draftStatus`（只有图标、无列标题）；语义键不在 LineItem 里时仍不请求 | 部分一致 | 阶段 4 | ANN-24 | 一期 |
| `Common.DraftRoot`/`DraftNode`：编辑状态筛选 | 6 个选项（全部、全部（隐藏草稿）、未更改、自己的草稿、被他人锁定、他人有未保存的更改）；"全部"＝`IsActiveEntity eq false or SiblingEntity/IsActiveEntity eq null`；锁定和未保存按 `DraftAdministrativeData/InProcessByUser`（`macros/filterBar/DraftEditState`） | **阶段 3 按 FE**：6 个选项，键和文字取 FE 的 DraftEditState；过滤条件相同；状态键 `$editState`（旧键 `$editingStatus` 的变式回退到"全部"）。FE 对比场景确认（偏差 DV-F002、DV-F011 已删） | 一致 | —（协作草稿见第 4 节） | — | — |
| `Common.DraftRoot`/`DraftNode`：草稿标记和请求的字段 | 请求 `HasActiveEntity`、`HasDraftEntity`、`DraftAdministrativeData/InProcessByUser`；草稿节点的表格也显示标记（`Table`） | **阶段 3**：请求这三项；草稿标记弹出框打开时才加载。草稿节点（子表）的标记未做 | 部分一致 | 阶段 6（草稿节点） | — | — |

## 2. 筛选栏与值帮助

| 术语 / 记录属性 | FE 1.154 的处理（模块） | smart-kit 现状 | 结论 | 计划阶段 | ANN 编号 | 期 |
| --- | --- | --- | --- | --- | --- | --- |
| `UI.SelectionFields` | 列出的字段直接显示，其余属性在"适配筛选"里；支持导航路径（1:n 生成 any()）；去掉不可筛选的；列出的 `HiddenFilter` 字段保留为隐藏筛选；没有注解时不推导（`FilterBar`） | 按顺序读取，解析路径；**阶段 4 按 FE**：列出的 `HiddenFilter` 字段不显示，条件照样生效；没有注解时推导字段（本库约定，第 6.3 节） | 一致 | — | ANN-02 | 一期 |
| `UI.FilterFacets` | 给"适配筛选"的字段分组；没有时按 FieldGroup 分组（`FilterBar`、`macros/filterBar/FilterBarDelegate`） | 平铺列表 | 未实现 | 阶段 4 | — | — |
| `UI.HiddenFilter` | 不出现在筛选栏和"适配筛选"里，条件照样生效；支持路径值（`FilterBar`、`core/helpers/MetaModelFunction`） | **阶段 4 按 FE**：不出现在筛选栏和"适配筛选"里，SV 里的条件照样生效。FE 对比场景确认（`filter4-hidden-defaults`）。只读常量 | 一致 | — | ANN-12 | 一期 |
| `UI.Hidden`（筛选侧） | 同样隐藏；**属性上 SV 的默认条件被丢掉、不发**（阶段 4 FE 对比确认，`29` 原写"条件照样生效"有误）；导航属性 Hidden 时其下属性都不提供筛选（`FilterBar`） | **阶段 4 按 FE**：排除，默认条件丢掉（`filter4-hidden-defaults`）；被隐藏导航下的字段没排除 | 部分一致 | 待排（导航） | ANN-12 | 一期 |
| `Common.FilterDefaultValue` | 没有默认 SV 时每个带它的属性生成一个 EQ 条件；参数实体上也读；不在 SelectionFields 里的也加入属性信息（`macros/filterBar/FilterHelper`、`FilterBar`、`FilterBarDelegate`） | **阶段 3 按 FE**：没有默认 SV 时生成 EQ 条件；不在 SelectionFields 里的作为条件生效、不加字段。FE 对比场景确认（`tests/e2e-fe/filter3.spec.ts`）。**阶段 4 收尾**：参数实体上的也读，作为参数的默认值（只有单元测试，测试服务的参数没有这个注解） | 一致 | — | — | — |
| `Common.FilterDefaultValueHigh` | 只在 AnnotationConverter 的别名表里，没有消费者 | 不读 | FE 列表页不用 | — | — | — |
| `UI.SelectionVariant` / `SelectOptions`（默认筛选值） | 来源是默认 SPV 的 SV，SPV 没有 SV 时不回退到 `UI.SelectionVariant`；CP 按 `*` 位置转 Contains/StartsWith/EndsWith，没有 `*` 时忽略；EQ ""→Empty，NE ""→NotEmpty；Sign=E 转 NOT；日期转语义日期运算符（`DataVisualization` `getSelectionVariant`、`FilterHelper`） | 读 EQ、NE、BT、NB、LT、LE、GT、GE、CP；空值没映射为 Empty/NotEmpty；SPV 没有 SV 时回退；没有 `*` 的 CP 当作 EQ | 部分一致 | 阶段 4 | ANN-05 | 一期 |
| `UI.SelectionPresentationVariant`（不带限定符，默认组合） | 默认 SPV 的 SV 是筛选栏初值，PV 是表格呈现；**多视图时筛选栏照样取初值**（阶段 3 的 FE 对比场景确认，`29a` 原说"多视图时不设初值"有误）（`DataVisualization`、`LRConverter`） | 取它引用的 SV 和 PV；多视图时默认 SV 进入筛选栏（和 FE 一致）；SPV 没有 SV 时回退到 `UI.SelectionVariant`（FE 不回退） | 部分一致 | 阶段 4（回退） | ANN-05 | 一期 |
| `UI.SelectionVariant` / `Parameters` | 生成参数条件，用于参数化实体集（`FilterHelper`） | **阶段 4 收尾按 FE**：SV 的 Parameters 成为参数字段的条件（参数化实体集的参数默认值）。FE 对比场景确认（`params-initial`） | 一致 | — | — | — |
| `UI.SelectionVariant` / `FilterExpression` | 列表页转换器不读，只在 easyFilter 里 | 忽略 | FE 列表页不用 | — | — | — |
| `UI.SelectionVariant` / `Text`（视图标签） | 多视图时用视图所指注解（SPV 或 SV）的 `Text`（`LRConverter`） | 用 SPV 的 `Text`，没有时用限定符 | 一致 | — | — | — |
| `UI.SelectionVariant` 作为视图筛选（多视图） | 每个视图的 SV 完整作用于该视图的表格（`selectionVariantPath`，隐藏过滤）；SelectionFields 的字段仍在筛选栏（`FilterBar`、`LRConverter`） | **阶段 3 按 FE**：视图的完整 SV 作为隐藏过滤（每个属性的条件加括号），SelectionFields 留在筛选栏。FE 对比场景确认（`purchasing-views`，"已关闭"标签页在默认 `Status ne CLOSED` 下为空，和 FE 相同） | 一致 | — | ANN-85 | 二期 |
| `Capabilities.FilterRestrictions` / `Filterable` | 表格列筛选按它；筛选栏只看 NonFilterableProperties；DraftAdministrativeData 导航 Filterable=false 时隐藏编辑状态（`core/templating/EntitySetHelper`、`core/converters/controls/Common/filter/FilterRestrictions`、`MetaModelFunction`） | Filterable=false 时所有路径不可筛选（筛选栏、适配筛选、请求）；DraftAdministrativeData 的情况没处理。FE 筛选栏在 Filterable=false 时的表现待核实 | 部分一致 | 阶段 4 | ANN-40 | 一期 |
| `FilterRestrictions/RequiresFilter` | 只计算，没有使用者（`MetaModelFunction`） | 忽略 | FE 列表页不用 | — | — | — |
| `FilterRestrictions/RequiredProperties` | 字段必填，"执行"被拦截并展开筛选栏；合并导航前缀和 NavigationRestrictions（`FilterRestrictions`、`FilterBar`） | 必填字段可见、带星号，执行时报错，不自动执行；导航层级的合并没做 | 一致 | — | ANN-40 | 一期 |
| `FilterRestrictions/NonFilterableProperties` | 不进入筛选栏；导航路径合并目标实体集和 NavigationRestrictions（`FilterBar`） | 从字段、适配筛选和请求中去掉 | 一致 | — | ANN-40 | 一期 |
| `FilterRestrictions/FilterExpressionRestrictions` | 同一属性多条记录取最严格的；SingleValue、SingleRange 最多一个条件；各表达式的运算符见 `macros/CommonHelper` `getOperatorsForProperty`（MultiValue 含 Empty/NotEmpty，SingleRange 允许排除，SearchExpression 含 Not*）（`core/converters/controls/ListReport/FilterField`） | **阶段 4 按 FE**：多条记录取最严格的；运算符按 FE（`getOperatorsForProperty` 和 mdc 按类型给的运算符取交集）；SingleValue、SingleRange、Edm.Boolean 最多一个条件，单值字段输入新值时替换旧值；SingleValue 的日期字段有单值相对日期。FE 对比场景确认（`filter4-expression-strictest`） | 一致 | — | ANN-40 | 一期 |
| `Capabilities.FilterFunctions` | 含 `tolower` 时字符串筛选不区分大小写（`core/helpers/ModelHelper`、`Columns`、`FilterBar`） | **阶段 4 按 FE**：读实体集上的，没有时读容器上的；含 `tolower` 时生成 `tolower(P) eq tolower('x')`。FE 对比场景确认（`filter4-tolower`） | 一致 | — | — | — |
| `Capabilities.SearchRestrictions/Searchable` | 没写 `Searchable=false` 就显示搜索框（`FilterBar`、`Table`）；导航路径用 NavigationRestrictions 的（`MetaModelFunction`） | **阶段 3 按 FE**：缺省可搜索（以前缺省不可搜索，`04` 的有意设计已推翻）；不支持 `$search` 的服务要声明 `Searchable=false`（迁移说明见 `08` 第 2 节）。FE 对比场景确认 | 一致 | — | ANN-42 | 一期 |
| `Capabilities.NavigationRestrictions`（筛选、排序、搜索） | 筛选导航路径的字段时合并父实体集带前缀的条目、`RestrictedProperties` 和目标实体集的限制（`FilterRestrictions`、`FilterField`、`MetaModelFunction`） | 读入模型，只在对象页子表合并；列表页筛选栏对导航路径只看根实体集 | 部分一致 | 阶段 4 | ANN-46 | 一期 |
| `Common.ValueList`（`CollectionPath`、`Parameters` 整体） | 主键取 LocalDataProperty 是当前属性的 InOut/Out；描述字段取 VH 主键属性上的 `Common.Text`；列来自参数，排除 VH 实体里 UI.Hidden 的（`ValueListHelper`） | **阶段 4 按 FE**：主键规则相同；描述取 VH 主键属性上的 `Common.Text`；列排除 VH 实体里 UI.Hidden 的参数。FE 对比场景确认（`filter4-vh-description`）。**阶段 4 收尾按 FE**：对话框的键列按 TextArrangement 显示"文字 (代码)"，键的 `Common.Text` 参数不单独成列；类型提示和固定值的请求不带 `$count`（FE 对比场景 `vhref-dialog`、`vhref-typeahead`） | 一致 | — | ANN-22 | 一期 |
| 带限定符的 `Common.ValueList#Q` | 多个值帮助内容，可以切换（`ValueListHelper`） | **阶段 4 按 FE**：读全部限定符，不带限定符的排第一，对话框里可以切换。只有单元测试 | 一致 | — | — | — |
| `ValueList/Label` | 值帮助内容（标签页）的标题（`ValueListHelper`） | **阶段 4**：有多个值帮助时作为切换项的名称；只有一个时对话框标题用属性标签 | 一致 | — | — | — |
| `ValueList/CollectionRoot` | FE 没有读取 | 忽略 | FE 列表页不用 | — | — | — |
| `ValueList/SearchSupported` | 词汇表缺省 true；除非 `SearchSupported=false` 或 VH 实体集 `Searchable=false`，都用 `$search`（`ValueListHelper` `entityIsSearchable`） | **阶段 3 按 FE**：缺省 true，规则相同。FE 对比场景确认 | 一致 | — | ANN-22 | 一期 |
| `ValueList/FetchValues` | 值为 2 时等用户搜索后才加载（`ValueListHelper`、`FilterBar`） | 打开对话框就加载 | 未实现 | 阶段 4 | — | — |
| `ValueList/PresentationVariantQualifier` | 用 VH 实体集上该 PV 的 SortOrder 作为默认排序（`ValueListHelper`） | **阶段 4 按 FE**：对话框按 VH 实体集上该 PV 的 SortOrder 排序；没有 PV 时按键排序，搜索时不排序。FE 对比场景确认（`filter4-vh-dialog-request`） | 一致 | — | — | — |
| `ValueList/SelectionVariantQualifier` | 只用于视觉筛选（`core/converters/controls/ListReport/VisualFilters`） | 忽略 | FE 列表页不用 | — | — | — |
| `ValueList/DistinctValuesSupported` | 为 true 时对 In/Out 参数做 distinct 请求（`ValueListHelper`） | 忽略 | 未实现 | 阶段 4 | — | — |
| `ValueListParameterIn`、`InOut`、`ValueListParameterConstant`（过滤） | In、InOut、Constant 都作为值帮助请求的 `$filter`，In 的值取筛选栏对应字段的条件（`ValueListHelper` `getInParameters`） | **阶段 3 按 FE**：值帮助请求带 In / InOut / Constant 过滤（`ValueListQuery.filters`）。FE 对比场景确认 | 一致 | — | ANN-22 | 一期 |
| `ValueListParameterOut`、`InOut`（回写） | 选中后回写到筛选栏的其他字段（`macros/valuehelp/ValueHelpDelegate`）；用户输入的值按 InOut/Out 校验（`macros/filter/FilterUtils`） | **阶段 3 按 FE**：选中后回写（单值字段替换，其他追加）；按 InOut/Out 校验用户输入未做；**阶段 4**：回写或手输的值没有文本时按键读描述（FE 对比场景 `filter4-vh-out-description`）；**阶段 4 收尾**：手输的值按 FE（`getItemForValue`）以 `键 eq v or 描述 eq v`、`$top=2` 读取校验（`vhref-typed`），值不存在时的表现没有核对 | 部分一致 | 待排（校验） | ANN-22 | 一期 |
| `ValueListParameterDisplayOnly` | 值帮助表格的列，参与 distinct（`ValueListHelper`） | 作为列；**阶段 4 按 FE**：不再当作描述 | 一致 | — | — | — |
| `InitialValueIsSignificant`（In、InOut、Constant 参数上） | In 值为空时也作为条件（`ValueListHelper`） | 忽略 | 未实现 | 阶段 4 | — | — |
| `Common.ValueListWithFixedValues` | 下拉或多选，没有对话框（`macros/filterBar/FilterFieldTemplate`、`macros/internal/valuehelp/ValueHelpTemplating`） | SingleValue 用 Select，其他用固定建议的 TagsInput，不显示值帮助按钮；**阶段 4 按 FE**：固定值在获得焦点、打开下拉或条件需要描述时才加载（原来一显示就加载，DV-FE-08、DV-FE-09 已删） | 一致 | — | ANN-22 | 一期 |
| `Common.ValueListReferences` | 交给 OData 模型从外部值帮助服务加载（`core/templating/PropertyHelper`、`macros/field/FieldHelper`） | **阶段 4 收尾按 FE**：筛选栏（类型提示、值帮助对话框、令牌文字、手输校验）加载引用的值帮助服务的 `$metadata`，读其中的 `ValueListMapping`，请求发到值帮助服务；`DataProvider` 新增可选的 `valueListService`。FE 对比场景确认（`vhref-initial`、`vhref-typeahead`、`vhref-dialog`、`vhref-token`、`vhref-typed`，测试服务 `/odata/purchasing-vh/`）。编辑态（对象页、表单）还不加载（阶段 6，DV-vhref-001） | 一致 | 阶段 6（编辑态） | — | — |
| `Common.ValueListMapping` | 外部值帮助服务的映射（`PropertyHelper`、`FieldHelper`） | **阶段 4 收尾按 FE**：随 ValueListReferences 读取，参数、描述和列的规则同本服务的 ValueList（FE 对比场景同上）；`ValueListRelevantQualifiers` 不筛引用服务的映射（FE 要按行求值，属于编辑态，阶段 6，DV-vhref-002） | 一致 | 阶段 6（DV-vhref-002） | — | — |
| `Common.ValueListRelevantQualifiers` | 决定哪些限定符的 ValueList 生效（`ValueHelpTemplating`、`ValueListHelper`） | **阶段 4**：按列出的限定符过滤（空字符串是不带限定符的）；`$If` 等表达式不支持 | 部分一致 | 待排（表达式） | — | — |
| `Common.ValueListShowValuesImmediately` | 只用于编辑态（`macros/internal/field/EditStyle`） | 忽略 | FE 列表页不用 | 阶段 6 核对 | — | — |
| `Common.ValueListForValidation` | 筛选输入按指定值帮助校验（`ValueHelpTemplating`） | 不校验 | 未实现 | 阶段 4 | — | — |
| `Common.QuickInfo`（筛选字段） | 筛选字段的提示（`FilterFieldTemplate`、`FilterBar`） | 不读 | 未实现 | 阶段 4 | — | — |
| `Common.DocumentationRef` | 标签旁的文档链接（`FilterFieldTemplate`、`FilterBarDelegate`） | 不读 | 未实现 | 阶段 4 | — | — |
| `Common.ResultContext` | 参数化实体集：参数成为必填单值筛选字段，请求 `/Set(P=…)/Results`（`FilterBar`、`FilterRestrictions`、`FilterField`、`FilterHelper`） | **阶段 4 收尾按 FE**（列表页）：`SmartListReport` 的 `entitySet="P/Set"`；参数是筛选栏最前面的必填单值字段，默认值来自 SV 的 Parameters 和参数上的 FilterDefaultValue，请求 `/P(p1=…,p2=…)/Set`。FE 对比场景确认（`params-initial`、`params-change`，FE 应用 `purchasing-params`）。没做：从结果行进对象页、参数化实体集上的图表、树表和分析表、值帮助的 CollectionPath 是参数化实体集（阶段 6，DV-vhref-003）；启动台的用户默认值（长期，D42，DV-vhref-004） | 部分一致 | 阶段 6（DV-vhref-003）；长期（D42） | — | — |
| `PersonalData.IsPotentiallySensitive` | 不写入 app state 和导航上下文，值帮助不记输入历史（`FilterBarDelegate`、`navigation/NavigationHandler`、`ValueHelpDelegate`） | 不读；页面状态存 sessionStorage 时会持久化敏感值 | 未实现 | 阶段 4 | — | — |
| `UI.ExcludeFromNavigationContext` | 不写入 app state 和导航上下文（`FilterBarDelegate`、`NavigationHandler`） | 不读；没有带上下文的跨应用导航 | 未实现 | 阶段 4 | — | — |
| `Analytics.Measure`（筛选栏） | 度量字段的筛选值不写入 app state（`FilterBarDelegate`） | 不读 | 未实现 | 阶段 4 | — | — |
| `Common.Label`（筛选字段） | 目标属性的 `Common.Label`，没有时用属性名（`FilterBar`、`FilterFieldTemplate`） | 相同；没有时按驼峰拆词（本库约定） | 一致 | — | ANN-20 | 一期 |
| 日期筛选的语义运算符（Edm.Date、DateTimeOffset） | manifest `useSemanticDateRange` 缺省 true，DynamicDateRange 带大量运算符（`macros/filterBar/DefaultSemanticDateOperators`、`CommonHelper`） | **阶段 4 按 FE**：FE 的默认和扩展运算符（DATE、FROM、TO、DATERANGE、TODAYFROMTO、SPECIFICMONTH(INYEAR)、QUARTER1–4、DATETOYEAR、FIRSTDAY* / LASTDAY*，天、周、月、季、年的 LAST / NEXT 及 …INCLUDED 等）；相对日期一律生成 BT；SingleValue 日期有单值相对日期；一周起始日跟随语言。FE 对比场景确认（`filter4-date-last-weeks`）。DateTimeOffset 的 LAST / NEXT MINUTES / HOURS 没做；DateTimeOffset 的 DATE / TO 上界写成次日 0 点的 `lt`（FE 是 `le 23:59:59.999`，结果相同） | 部分一致 | 待排（分钟、小时） | — | — |
| `Common.SemanticDateRange` | 词汇表没有这个术语，对应的是 manifest 设置 | 相对日期缺省开启，和 FE 一致 | FE 列表页不用 | 阶段 5（manifest） | — | — |

## 3. 值的显示

FE 单元格显示方式的判定顺序在 `FieldStructureHelper` 的 `setUpDisplayStyle`，文本排列在 `core/templating/DisplayModeFormatter` 的 `getDisplayMode`。

| 术语 / 记录属性 | FE 1.154 的处理（模块） | smart-kit 现状 | 结论 | 计划阶段 | ANN 编号 | 期 |
| --- | --- | --- | --- | --- | --- | --- |
| `Common.Text`（单元格） | 按 displayMode 绑定文本和代码，文本路径（可以经过导航）自动进入请求（`DisplayModeFormatter`、`macros/internal/helpers/DataPointTemplating`） | 相同，查询时自动 `$select` / `$expand` | 一致 | — | ANN-21 | 一期 |
| `UI.TextArrangement` 的来源与优先级 | `Common.Text@UI.TextArrangement` → 实体类型上的 `UI.TextArrangement`（`DisplayModeFormatter`） | 顺序相同 | 一致 | — | ANN-13 | 一期 |
| 有 Text、没有 TextArrangement 时的缺省 | DescriptionValue，即"文本 (代码)"（`DisplayModeFormatter`） | 缺省 TextFirst | 一致 | — | ANN-13 | 一期 |
| `TextFirst` / `TextLast` / `TextOnly` | `A (B)` 格式，导出相同（`DisplayModeFormatter`、`macros/table/mixin/ColumnManagement`） | 相同 | 一致 | — | ANN-13 | 一期 |
| `TextSeparate`（单元格） | 只显示代码，不会自动多出一列文本 | 只显示代码；**阶段 4 按 FE**：表格不再请求它的文本（`request.ts` `companionPaths`）。`textArrangement.ts` 的注释"文本单独成列"还没改 | 一致 | 待排（注释） | ANN-13 | 一期 |
| TextArrangement 在筛选令牌和值帮助里 | 有 Text 且有值帮助时按 getDisplayMode；有 Text 无值帮助时只显示值；TextSeparate 只显示值（`macros/filter/FilterFieldTemplating`） | **阶段 4 按 FE**：TextSeparate 只显示代码（ConditionInput、ValueHelpDialog）；值帮助键属性的回退相同。FE 对比场景确认（`filter4-token-text-separate`） | 一致 | — | — | — |
| 带 Text 的列的对齐 | 有文本且不是 TextSeparate 时左对齐（`macros/field/FieldTemplating`、`FieldHelper`） | 只看 Edm 类型，数值代码带文本也右对齐 | 不一致 | 阶段 4 | — | — |
| 语义键单元格 | 响应式表格用 ObjectIdentifier（标题、描述两行），网格表用 LabelSemanticKey（`FieldStructureHelper`） | 整行加粗，一行显示 | 部分一致 | 阶段 4 | ANN-24 | 一期 |
| `Common.Label` 与列标题的回退 | DataField.Label → `Common.Label` → 属性名原样；`UI.DataFieldDefault` 的 Label 优先；`Common.QuickInfo` 作列提示（`Columns`） | `Label` → `Common.Label` → 按驼峰拆词（本库约定）；不支持 DataFieldDefault、QuickInfo | 部分一致 | 阶段 4 | ANN-20 | 一期 |
| 指向 DataPoint 的列标题 | 先取 DataPoint.Value 的 `Common.Label`，再取 DataField.Label，不用 DataPoint.Title（`Columns` `getLabel`） | **阶段 4 按 FE**：顺序相同，都没有时用值的路径。FE 对比场景确认（`cols-po-list`） | 一致 | — | — | — |
| `Measures.ISOCurrency` | 表格里 `isCurrencyOrUnitAligned`，数字和币种分开对齐；小数位按 CodeList，否则按 CLDR（`MdcTableTemplate`、`FieldStructureHelper`） | 按 Intl 的 ISO 4217 小数位，数字后面加币种；不做小数点对齐；小数点对齐登记为阶段 6（DV-display4-002） | 部分一致 | 阶段 6 | ANN-30 | 一期 |
| `Measures.Unit` | 同样对齐；小数位按 UnitsOfMeasure CodeList；常量 `%` 显示为"x %"（`core/templating/PropertyHelper`、`DataPointTemplating`） | 小数位按 Edm Scale facet，单位附在后面；CodeList 的小数位阶段 6（DV-display4-001） | 部分一致 | 阶段 6 | ANN-30 | 一期 |
| `CodeList.CurrencyCodes` / `CodeList.UnitsOfMeasure` | 读每个代码的小数位和外部代码（`DataPointTemplating`、`base/BindingToolkit`、`core/AppComponent`） | 不读（DV-display4-001；测试服务没有容器上的 CodeList 注解） | 未实现 | 阶段 6 | — | — |
| `Measures.Scale` | 只在 AnnotationConverter 里登记，不用 | 也不用；小数位来自 Edm 的 `Scale` facet（原 `02` 说支持 `Measures.Scale`，有误） | 一致（都不用） | — | ANN-30 | 一期 |
| `Common.IsCurrency` / `Common.IsUnit` | 只用于值帮助输入校验（`ValueHelpTemplating`） | 不读 | 未实现 | 阶段 4 | — | — |
| `UI.DoNotCheckScaleOfMeasuredQuantity` | 只在解析和编辑时跳过小数位校验（`core/templating/UIFormatters`） | 不读 | FE 列表页不用 | 阶段 6 核对 | — | — |
| `Common.IsDigitSequence` | String 类型约束 `isDigitSequence`：显示去前导零；输入时 UI5 的 `sap.ui.model.odata.type.String` 按 MaxLength 补零（`UIFormatters`、`ValueHelpDelegate`） | **阶段 3 按 FE**：输入全是数字时去零后补零到 MaxLength；文本运算符不解析；显示去前导零，有 MaxLength 时 "0" 显示为空。FE 对比场景确认 | 一致 | — | ANN-25 | 一期 |
| `Common.IsUpperCase` | 列表页不起作用，只在 AI 的 EasyFilter 里（`macros/ai/EasyFilterDataFetcher`） | **阶段 4（D41）**：按 FE 去掉，输入不再转大写（`PropertyModel.isUpperCase` 删除） | 一致 | — | ANN-25 | 一期 |
| `Common.IsCalendar*` | 只用于图表时间轴和微图表（`macros/chart/ChartDelegate`），单元格不按日期格式化 | 不读 | 一致（单元格）；图表时间轴未实现 | 阶段 4 | ANN-25 | 一期 |
| `Common.IsFiscal*` | 会计期类型，单元格按会计期格式显示（`BindingToolkit`、`macros/filter/FilterFieldHelper`） | 不读 | 未实现 | 阶段 4 | — | — |
| `Common.Timezone`（DateTimeOffset 上） | 按行的时区显示并附时区名（`UIFormatters`、`Columns`） | **阶段 4 按 FE**：按行的时区显示，中等日期时间带秒，后附时区名（`formatDateTimeWithTimezone`）；时区路径加进请求。FE 对比场景确认（`display4-contacts`）。非英语的时区名称（FE 用 CLDR）登记为长期偏差（DV-display4-003） | 部分一致 | 长期（时区名称） | — | — |
| `Common.IsTimezone` | 值显示为时区名称（`UIFormatters`） | **阶段 4 按 FE**：显示为时区名称（`formatTimezone`，例如 "Europe, Berlin"）；非英语名称同上 | 部分一致 | 长期（时区名称） | — | — |
| `UI.DateTimeStyle` | 按 short/medium/long/full 格式化（`UIFormatters`） | 不读；固定 medium 日期时间（**阶段 4 收尾**：时间带秒，同 FE `DateTimeOffset` 类型的缺省 medium 样式） | 未实现 | 阶段 4 | — | — |
| `UI.IsImageURL` | Avatar；`IsNaturalPerson` 时圆形，否则方形（`FieldStructureHelper`、`FieldTemplating`） | Avatar，固定小圆角方形 | 部分一致 | 阶段 4 | ANN-14 | 一期 |
| `UI.IsImage`（流属性） | 显示方式 File，内容为图片（`FieldStructureHelper`、`DisplayStyle`） | 不读 | 未实现 | 阶段 4 | — | — |
| `Edm.Stream` + `Core.MediaType` / `ContentDisposition` / `AcceptableMediaTypes` | 显示方式 File：可下载的链接或图标，image/* 有预览（`DisplayStyle`） | **阶段 4 按 FE**：下载链接（`@odata.mediaReadLink`），名字取 `Core.ContentDisposition/Filename`，没有时为"打开文件"；没有内容时不显示。图标、头像、上传阶段 6（DV-display4-005）；fe-mockserver 没有流，没有 FE 对比场景 | 部分一致 | 阶段 6 | ANN-50 | 一期 |
| `Core.IsURL` | 列表页不显示为链接 | **阶段 4（D41）**：按 FE 去掉，显示为普通文本（`PropertyModel.isUrl` 删除） | 一致 | — | ANN-50 | 一期 |
| `DataFieldWithUrl` 的协议和 `IconUrl` | Link，href 不限协议；IconUrl 时带图标（`DisplayStyle`） | **阶段 4 按 FE**：不限协议（只拒绝 `javascript:`、`vbscript:`、`data:`，本库的安全约定）；有 IconUrl 时带图标 | 一致 | — | — | — |
| `HTML5.LinkTarget` | 取 record 或属性上的；缺省不设 target（当前窗口）（`DisplayStyle`） | **阶段 4 按 FE（D41）**：取记录或属性上的，缺省当前窗口。FE 对比场景确认（`display4-contacts`） | 一致 | — | — | — |
| `UI.MultiLineText` | ExpandableText，超长截断带"更多"（`DisplayStyle`） | `pre-wrap` 显示全文 | 部分一致 | 阶段 4 | ANN-14 | 一期 |
| `Common.Masked` | 显示为掩码（`DisplayStyle`） | **阶段 4 按 FE**：每个字符显示为一个 `*`。FE 对比场景确认（`display4-contacts`） | 一致 | — | — | — |
| `UI.InputMask` | 显示是普通文本，掩码只用于编辑（`FieldStructureHelper`、`EditStyle`） | 显示为普通文本 | 一致（显示） | 阶段 6 核对（编辑） | — | — |
| `UI.Placeholder` | 只用于编辑字段（`FieldTemplating`） | 不读 | 未实现 | 阶段 6 核对 | — | — |
| `Communication.IsEmailAddress` | `mailto:` 链接（`DisplayStyle`） | **阶段 4 按 FE**：`mailto:` 链接。FE 对比场景确认（`display4-contacts`） | 一致 | — | — | — |
| `Communication.IsPhoneNumber` | `tel:` 链接（`DisplayStyle`） | **阶段 4 按 FE**：`tel:` 链接。FE 对比场景确认（`display4-contacts`） | 一致 | — | — | — |
| `Communication.Contact`（单元格） | 联系人卡片（`macros/contact/Contact`、`FieldStructureHelper`） | **阶段 4**：名字链接和联系人弹出框，见第 1 节；只显示第一个电话和邮件（阶段 6） | 部分一致 | 阶段 6 | — | — |
| `Common.IsNaturalPerson` | 决定 Avatar 和快速预览头部的形状（`FieldTemplating`、`macros/quickView/QuickViewHeaderOptions`） | 只看有没有 `Communication.Contact`；头像固定形状 | 部分一致 | 阶段 4 | — | — |
| `DataField/Criticality`（单元格） | ObjectStatus，常量或路径（`FieldStructureHelper`、`CriticalityFormatters`） | 状态色和图标（0 中性、1 负面、2 警告、3 正面、5 信息） | 一致 | — | ANN-11 | 一期 |
| `DataField/CriticalityRepresentation` | 只有 `WithoutIcon` 不显示图标（`CriticalityFormatters`） | 相同 | 一致 | — | ANN-11 | 一期 |
| `UI.CriticalityType` 的 VeryPositive / VeryNegative | 颜色表达式只匹配 Negative、Critical、Positive、Information，其余 None（`core/formatters/CriticalityFormatter`） | **阶段 4（D41）**：按 FE 不上色、不带图标 | 一致 | — | — | — |
| `UI.Criticality`（属性上） | 词汇表 AppliesTo 是 Annotation，FE 只用 `LineItem@UI.Criticality` 做行高亮，不读属性上的（`Table`） | **阶段 4（D41）**：按 FE 不再读（`PropertyModel.criticality` 删除）；行高亮见第 1 节 | 一致 | — | ANN-11 | 一期 |
| `UI.CriticalityRepresentation`（属性上） | 同上，FE 用的是 DataField 上的记录属性 | 读，和记录属性一起决定是否显示图标 | 部分一致 | 阶段 4 | ANN-11 | 一期 |
| `UI.DataPoint`：`Visualization` 为 Number 或缺省 | 有单位时 ObjectNumber，否则 ObjectStatus；`ValueFormat.NumberOfFractionalDigits` 生效（`macros/internal/DataPoint`、`DataPointTemplating`） | **阶段 4 按 FE**：单元格里 `ValueFormat.NumberOfFractionalDigits` 对 Decimal、Double、Single 生效（同 FE `getFloatFormat`，0 不生效） | 一致 | — | ANN-10 | 一期 |
| DataPoint `Visualization=Rating`（`TargetValue`） | RatingIndicator，maxValue 取 TargetValue，缺省 5（`DataPoint`） | 相同 | 一致 | — | ANN-10 | 一期 |
| DataPoint `Visualization=Progress`（`TargetValue`、`Criticality`） | ProgressIndicator，"{值} of {目标}"，按单位或 % 显示，状态色取 Criticality（`DataPointTemplating`、`DataPoint`） | **阶段 4 按 FE**：显示值按 FE（单位是 `%` 时 "52.2 %"，没有单位时 "{值} of {目标}"，有单位时附上单位；中文 "第 x 个，共 y 个"），状态色取 Criticality。FE 对比场景确认（`po-list-initial`，DV-FE-06 已删） | 一致 | — | ANN-10 | 一期 |
| DataPoint `Criticality` | 常量或路径（`CriticalityFormatters`） | 相同 | 一致 | — | ANN-10 | 一期 |
| DataPoint `CriticalityCalculation` | 单元格不计算，只用于微图表和 KPI | 单元格不计算；微图表和 KPI 卡片计算（`15`） | 一致 | — | MC-60 | 三期 |
| DataPoint `ValueFormat.ScaleFactor` | 单元格不用 | 不用 | 一致 | — | — | — |
| DataPoint `Title` | 单元格不显示，列标题不用 | **阶段 4 按 FE**：列标题不再用它 | 一致 | — | — | — |
| `UI.ValueCriticality` | 只用于图表和可视筛选按维度值着色（`macros/chart/ChartHelper`、`macros/visualfilters/InteractiveChartHelper`） | 不读 | 未实现 | 阶段 4 | — | — |
| `Validation.Minimum` / `Validation.Maximum` | 类型约束，校验筛选和编辑输入（`UIFormatters`） | 不读 | 未实现 | 阶段 4 | — | — |
| `Common.SemanticObject`（含 `SemanticObjectMapping`、`SemanticObjectUnavailableActions`） | 智能链接 LinkWithQuickView，列出 FLP 意图导航（`FieldStructureHelper`、`core/templating/SemanticObjectHelper`、`macros/quickView/QuickView`） | **阶段 4（D42）**：导航目标由宿主的 `NavigationAdapter.semanticTargets` 给出：没有目标时是普通文本（和没有 FLP 的 FE 相同），一个目标时直接链接，多个时弹出框；只读常量形式。Mapping、UnavailableActions、"更多链接"、路径形式，以及快速预览和链接合在一个弹出框，登记为长期偏差（DV-display4-004） | 部分一致 | 长期（D42） | — | — |
| `UI.QuickViewFacets` | 字段是导航的外键、或经导航取目标的键或语义键时显示快速预览；DataPoint 也可以（`FieldTemplating`、`DataPoint`） | **阶段 4 按 FE**：外键规则，加上"经导航取目标键或语义键"；去掉了"文本经过导航"这一条（FE 没有）。DataPoint 不支持 | 部分一致 | 待排（DataPoint） | ANN-86 | 二期 |
| `Common.ExternalID` | 显示外部 ID 而不是内部 ID（`PropertyHelper`、`FieldStructureHelper`、`DataPointTemplating`、`FilterFieldTemplate`） | **阶段 4 按 FE**：单元格显示并格式化 ExternalID 的属性，加进请求（FE 对比场景 `display4-contacts`）；筛选令牌还没做 | 部分一致 | 待排（筛选令牌） | — | — |
| `PersonalData.IsPotentiallyPersonal` | 只用于判断乐观批处理（`macros/table/Utils`） | 不读 | FE 列表页不用 | — | — | — |
| 按值列表取文本（retrieveTextFromValueList） | 只用于表单（`FieldTemplating`） | 表格没有 | 一致 | 阶段 6 核对（表单） | — | — |
| 空值显示（"–"） | 表格普通列 `showEmptyIndicator: false`（`MdcTableTemplate`；sap.m 的 Auto 模式是否显示待核实） | 单元格为空 | 一致（待核实） | — | — | — |
| `HTML5.CssDefaults`（`width`） | 列宽（同第 1 节） | **阶段 4**：列宽（同第 1 节，阶段 4 收尾 FE 对比确认） | 一致 | — | — | — |

## 4. 视图、呈现、聚合与能力

| 术语 / 记录属性 | FE 1.154 的处理（模块） | smart-kit 现状 | 结论 | 计划阶段 | ANN 编号 | 期 |
| --- | --- | --- | --- | --- | --- | --- |
| `UI.PresentationVariant`（列表页默认解析） | SPV 的 PV 要"合规"（Visualizations 含 LineItem 或 Chart），否则回退到 PV、再到 LineItem（`LRConverter`、`DataVisualization` `isPresentationCompliant`） | **阶段 4 按 FE**：检查合规，按 SPV → PV → LineItem 回退（同第 1 节） | 一致 | — | ANN-04 | 一期 |
| 默认 SPV / PV（manifest `defaultTemplateAnnotationPath`） | manifest 指定带限定符的 SPV 作为默认（`DataVisualization`、`LRConverter`） | 没有对应属性 | 未实现 | 阶段 5 | — | — |
| `PV/SortOrder`（`Property`、`Descending`） | 表格初始排序，跳过不可排序的属性（`Table`、`macros/table/adapter/TablePVToState`） | 相同；金额先按单位排序（本库约定，第 6.3 节） | 一致 | — | ANN-04 | 一期 |
| `PV/SortOrder/DynamicProperty` | 只用于图表（`ChartHelper` `getSortConditions`） | 表格忽略；**阶段 4 按 FE**：图表排序里换成 AggregatedProperty 的 Name | 一致 | — | — | — |
| `PV/Visualizations` | 取第一个 LineItem 或 Chart，只引用 Chart 的 PV 在列表页只显示图表（`DataVisualization`） | **阶段 4 按 FE**：取第一个 LineItem 或 Chart；只引用 Chart 时整页只显示图表（`ui.defaultChart`） | 一致 | — | ANN-04 | 一期 |
| `PV/RequestAtLeast` | 加进表格 `$select`（`Table` `createRequestedProperties`） | 加进 `$select`；**阶段 4 按 FE**：视图用自己 PV 的（`views4-view-no-sort`） | 一致 | — | ANN-04 | 一期 |
| `PV/GroupBy` | ResponsiveTable 只用第一个路径，AnalyticalTable 所有层级（`Table`） | 只用第一个路径作为默认分组 | 部分一致 | 阶段 4 | ANN-04 | 一期 |
| `PV/Total` | 只用于 AnalyticalTable；没有 `Total` 时默认合计所有 CustomAggregate 的列；GridTable、ResponsiveTable 没有合计和小计（`Table` `updateTableVisualizationForType`、`getAggregateConditions`） | **阶段 3 按 FE（D39）**：合计和小计只给分析表；没有 `Total` 时默认合计全部可合计（CustomAggregate）列；多种币种时显示一个值加"多单位"标记，请求按单位一并聚合（按 FE） | 一致 | — | ANN-04 | 一期 |
| `PV/TotalBy`、`IncludeGrandTotal`、`DynamicTotal`、`RequestAtLeastDynamic`、`RecursiveHierarchyQualifier` | 列表页不读 | 不读 | FE 列表页不用 | — | — | — |
| `PV/MaxItems` | 表格每次加载的行数，缺省列表页 30、Grid/Analytical 100、Tree 200（`Table`）；KPI 图表的数据点数（`core/converters/controls/Common/KPI`） | 列表表格不读，页大小写死；只有卡片用 | 不一致 | 阶段 5 | — | — |
| `PV/InitialExpansionLevel` | TreeTable 的初始展开层级（`Table`） | **阶段 4 按 FE**：层级表的 `initialExpansionLevel` 缺省取 InitialExpansionLevel + 1。只有单元测试 | 一致 | — | — | — |
| `PV/Text` | 视图指向 PV 时作为标签页标题（`LRConverter`） | 只读 SPV 的 `Text` | 部分一致 | 阶段 4 | — | — |
| 多视图的来源（manifest `views.paths`） | 只在 manifest 配置时才有；每个 path 可以是 SPV、PV 或 SV，可以带自己的实体集；视图的 SV 是隐藏过滤；`showCounts` 控制计数（`LRConverter`） | 自动收集所有带限定符的 SPV；视图的完整 SV 作为隐藏过滤、SelectionFields 留在筛选栏（**阶段 3 按 FE**，`29a` 第④点已解决）；**阶段 4**：视图没有排序时不再回退到默认 PV 的排序。不支持 PV / SV 视图；`contents` 不能指定注解；页签计数用 `/$count`、页签结构留给阶段 5 | 部分一致 | 阶段 5 | ANN-85 | 二期 |
| 多视图：图表视图与表格视图 | 视图的 PV 引用 Chart 时是单独的图表视图，不能切成表格（`LRConverter`、`DataVisualization`） | **阶段 4 按 FE**：视图 PV 的第一个可视化是 Chart 时是图表视图，不能切成表格；表格视图不再自动出现图表切换（只有 `chart` 属性才有）；图表视图不按视图 PV 的 SortOrder 排序（FE 也不按）。FE 对比场景确认（`views4-chart-view`） | 一致 | — | — | — |
| ALP / 混合视图（图表和表格同屏） | `hasMultipleVisualizations` 或 ALP 时图表加表格（`LRConverter`、`DataVisualization` `isAlpAnnotation`） | 只有表格 / 图表二选一 | 未实现 | 阶段 4（可以不做，写明） | — | — |
| `UI.Chart/ChartType`（列表页图表） | 映射约 40 种 sap.chart 类型（`ChartHelper`、`macros/chart/MdcChartTemplate`） | **阶段 4 按 FE**：照 FE `ChartTypeEnum` 映射 38 种，`data-sk-chart` 用 sap.chart 的名字；柱、条、折线、面积、饼、环形及堆积、百分比堆积按类型画；dual、combination、scatter、bubble、heatmap、treemap、waterfall、bullet 画成最接近的柱或条（近似画法，`drawnChart().exact=false`）。FE 对比场景确认（`views4-chart-line`、`views4-chart-donut`、`views4-chart-column-stacked`） | 部分一致 | 待排（近似画法） | ANN-82 | 二期 |
| `UI.Chart/Dimensions`、`Measures` | 多维度多度量；CustomAggregate 度量请求 `aggregate(M)`，transAgg 用它的 AggregationMethod；groupby 全部维度加度量的单位；多种单位时显示"Invalid data"（`MdcChartTemplate`、`macros/chart/ChartDelegate`） | **阶段 3 按 FE**：groupby 全部维度和度量单位（排序后），`Common.Text` 只在可分组且不经过导航时加入，不发 `$orderby` / `$top`；多币种显示"数据无效 / 部分度量单位不同"；画出全部度量。FE 对比场景 po-chart、po-chart-filter 0 差异 | 一致 | — | ANN-82 | 二期 |
| `UI.Chart/DimensionAttributes`、`MeasureAttributes`（Role、DataPoint） | 维度 Role（Category / Series / Category2）、度量 Role（Axis1-4）、度量的 DataPoint 传给图表（`ChartHelper`、`MdcChartTemplate`、`core/converters/controls/Common/Chart`） | **阶段 3**：维度 Role Series 拆成系列；Category2、度量 Role 未做；MeasureAttributes/DataPoint 读入模型，列表页图表不用；**阶段 4**：Category2 当作类别，度量 Role 只记录（`measureRoles`），不改变画法 | 部分一致 | 待排 | ANN-82 | 二期 |
| `UI.Chart/DynamicMeasures` | 指向 `Analytics.AggregatedProperty` 的度量（`MdcChartTemplate`） | **阶段 4 按 FE**：请求 `aggregate(P with method as Name)`，排在 Measures 前面 | 一致 | — | — | — |
| `UI.Chart/Actions` | 图表工具栏动作，跳过 Inline / Determining（`Chart` `getChartActions`） | **阶段 4 按 FE**：未绑定、非 Inline、非 Determining 的 DataFieldForAction 放在图表工具栏；IBN 和 ActionGroup 没做 | 部分一致 | 待排 | — | — |
| `UI.Chart/Title`、`Description` | 图表标题和描述（`Chart`、`ChartDelegate`） | **阶段 4 按 FE**：标题只用 `Chart.Title`，没有就不显示（不再用页面标题）；Description 读入模型，没有显示 | 部分一致 | 待排（Description） | — | — |
| 图表需要 `ApplySupported` | 没有时报错，不渲染图表（`Chart` `createChartVisualization`） | **阶段 4 按 FE**：没有时不渲染图表 | 一致 | — | — | — |
| 图表的排序 | 用 PV SortOrder（含 DynamicProperty）；没有 SortOrder 时不排序（`ChartHelper`、`ChartPvToStateUtils`） | **阶段 3**：不再按维度升序，没有排序时和 FE 一样不发 `$orderby`；**阶段 4 按 FE**：metaPath 是 PV / SPV 时用 PV 的 SortOrder（DynamicProperty 换成 AggregatedProperty 的 Name） | 一致 | — | — | — |
| `UI.KPI`（列表页页头 KPI 标签） | manifest `keyPerformanceIndicators` 指定时读 KPI 的 DataPoint、SV、Detail 的 PV / Chart；值必须是 CustomAggregate（`KPI`） | **阶段 4 按 FE**：`SmartListReport` 的 `keyPerformanceIndicators` 属性指定时显示 KPI 标签（`v4/fe/macros/KPITag`）：请求 `filter(SV)/aggregate(Value,Unit)&$top=1`（草稿实体集另加 `IsActiveEntity eq true`），文字、数值、状态、提示和 FE 相同（`views4-kpi-tag`）。点标签弹出的图表卡片、SPV 同限定符的回退没做；属性名阶段 5 按 manifest 定 | 部分一致 | 阶段 5（属性名）；待排（卡片） | — | — |
| `UI.HeaderInfo/TypeNamePlural` | 表格标题（`Table` `getTableAnnotationConfiguration`） | 表格标题、导出标题；页面标题缺省也用它（FE 来自应用描述符） | 一致 | — | ANN-03 | 一期 |
| `UI.HeaderInfo/Title`、`Description`（删除确认） | 删除确认显示被删对象的 Title（`macros/table/TableEventHandlerProvider`） | **阶段 4 按 FE**：删除确认用 FE 的文字，带 HeaderInfo 的 Title 和 Description；多行和部分行不能删的提示也按 FE；**阶段 4 收尾**：单数、复数的文字分开，FE 对比场景确认（`cols5-deletable-path`） | 一致 | — | — | — |
| `UI.HeaderInfo/TypeName` | 批量编辑对话框标题等（`MassEditDialogHelper`） | "已删除"提示、新建对话框标题 | 一致 | — | ANN-03 | 一期 |
| `Aggregation.ApplySupported/Transformations` | 全部 8 种转换时默认表格类型自动变成 AnalyticalTable；含 `search` 才允许搜索（分析表、层级表、图表）；读容器上的 `ApplySupportedDefaults`（`Table`、`Chart`、`core/converters/helpers/Aggregation`） | **阶段 4 按 FE**：不设 `tableType` 时按注解自动选，全部 8 种转换时用 AnalyticalTable（`views4-table-type`）；都不满足时 smart-kit 仍是网格表（FE 默认 ResponsiveTable，阶段 5）。**阶段 4 收尾按 FE**：未分组的分析表用一个 `$apply` 的 `concat` 同时取首页的行、合计和条数（FE 对比场景 `apply-initial`、`apply-sort`、`apply-sort-amount`、`apply-filter`、`apply-search`、`apply-paging`）；分组的分析表仍是行、小计、合计分开请求（FE 是可折叠的层级，阶段 5，DV-apply-005、006）；Transformations 不含 `search` 时分析表没有搜索框，筛选栏的搜索也去掉（同 FE）。不读 ApplySupportedDefaults | 部分一致 | 阶段 5（默认类型、分组的分析表）；待排（ApplySupportedDefaults） | — | — |
| `ApplySupported/GroupableProperties` | 列表为空＝都可分组，否则只有列出的（`Aggregation` `isPropertyGroupable`） | 相同（`23`） | 一致 | — | — | — |
| `ApplySupported/AggregatableProperties` | 分析表的可聚合列不看它而看 CustomAggregate；图表的可选度量参考它（`Table`、`Aggregation`、`Chart`、`ChartDelegate`） | **阶段 3**：合计只认 CustomAggregate（D39），和 FE 一致；图表个性化（可选度量）没有做 | 部分一致 | 阶段 4 | — | — |
| `ApplySupported/Rollup`、`PropertyRestrictions` | FE 不读 | 不读 | FE 列表页不用 | — | — | — |
| `Aggregation.CustomAggregate` | 分析表的可聚合、可合计列；图表度量请求 `aggregate(M)`；KPI 的值必须是它（`Table`、`Chart`、`KPI`） | **阶段 3 按 FE**：读入 `AggregationModel.customAggregates`；合计、小计、图表、KPI、卡片都请求 `aggregate(M)`；声明了 CustomAggregate 时只有这些属性可以合计。FE 对比场景确认 | 一致 | — | — | — |
| `Aggregation.ContextDefiningProperties` | 分析表聚合列的附加属性（例如币种）（`Table`、`Columns`） | 不读；按度量的 Unit / ISOCurrency 把单位放进 groupby，效果相同；其他上下文属性没有处理 | 部分一致 | 阶段 4 | — | — |
| `Aggregation.Groupable` / `Aggregatable`（属性级） | 只用于图表个性化的维度和度量候选（`ChartDelegate`、`Aggregation`） | 不读 | 未实现 | 阶段 4 | — | — |
| `Analytics.AggregatedProperty` / `AggregatedProperties` | 图表的 transAgg（`Chart`、`Aggregation` `getTransAggregations`），可视筛选也用 | **阶段 4 按 FE**：读入 `AggregationModel.aggregatedProperties`（带限定符的优先），用于图表的 DynamicMeasures | 一致 | — | — | — |
| `Analytics.Measure` | 只用于把度量排除出导航上下文和 app state（`FilterBarDelegate`） | 不读 | 未实现 | 阶段 4 | — | — |
| `Analytics.Dimension` | FE 不读 | 不读 | FE 列表页不用 | — | — | — |
| `Aggregation.RecursiveHierarchy` + `Hierarchy.RecursiveHierarchy`（同一限定符） | 成对时默认表格类型自动变成 TreeTable；限定符缺省取第一个成对的；每次加载 200 行（`Table`） | 解析 `NodeProperty`、`ParentNavigationProperty`、`DrillState`、`DistanceFromRoot`、`LimitedDescendantCount`、`Matched`、`MatchedDescendantCount`、`ExternalKey`；请求 `TopLevels`（`26` §3.10，`27` UE-80～UE-89）；**阶段 4 按 FE**：不设 `tableType` 时，成对的 RecursiveHierarchy 自动用 TreeTable，限定符取第一个成对的（只有单元测试） | 一致 | — | UE-80 | — |
| `Hierarchy.RecursiveHierarchyActions` | TreeTable 的移动节点（`Table`） | 不读 | 未实现 | 阶段 4 | — | — |
| `Capabilities.SortRestrictions/Sortable`、`NonSortableProperties` | 列和 PV 排序跳过不可排序的（`MetaModelFunction`、`Table`、`EntitySetHelper`） | 相同 | 一致 | — | ANN-41 | 一期 |
| `SortRestrictions/AscendingOnlyProperties`、`DescendingOnlyProperties` | 属性的排序方向固定（`MetaModelFunction`） | 不读 | 未实现 | 阶段 4 | — | — |
| `Capabilities.CountRestrictions` | FE 不读 | `Countable=false` 时不发 `$count`，标签页计数关掉（多做，不冲突，保留） | FE 列表页不用 | — | ANN-43 | 一期 |
| `Capabilities.TopSupported`、`SkipSupported` | FE 不读 | 不支持时不发 `$top` / `$skip`（多做，保留） | FE 列表页不用 | — | ANN-43 | 一期 |
| `Capabilities.ExpandRestrictions` | FE 不读 | 不可展开的导航改为单独读取（多做，保留；`05`） | FE 列表页不用 | — | ANN-44 | 一期 |
| `Common.SemanticKey`（请求和路由） | 加进表格 `$select`；草稿根按语义键生成语义 URL（`Table`、`routing/ContextPathHelper`）；列加粗、显示草稿标记（`Columns`） | 列加粗、行标签；不保证进 `$select`；URL 用技术键；也决定面包屑和标题的回退 | 部分一致 | 阶段 4 | ANN-24 | 一期 |
| `Common.DraftRoot`：列表请求和编辑状态（含协作草稿） | 非协作草稿 6 个选项，"全部"＝`IsActiveEntity eq false or SiblingEntity/IsActiveEntity eq null`；协作草稿只有"全部 / 我的草稿 / 只看已保存"（`DraftEditState`）；额外请求 `HasActiveEntity`、`HasDraftEntity`、`InProcessByUser`（`Table`） | **阶段 3 按 FE**：非协作草稿的选项、过滤和请求字段一致（见第 1 节）；需要服务支持 `SiblingEntity`（mock 已补）。协作草稿的选项未做 | 部分一致 | 阶段 4（协作草稿） | — | — |
| `Session.StickySessionSupported` | 列表页"新建"用 `NewAction`（`StandardActions`、`Table`） | 不读 | 未实现 | 阶段 6 | — | — |
| `Common.SideEffects`（列表里） | 列表页有 SideEffects 扩展，批量编辑和内联编辑后触发（`templates/ListReport/overrides/SideEffects`、`massEdit/MassEditSideEffects`） | 不做；保存后整页重新读取；只在 PreparationAction 里传 `SideEffectsQualifier: ''`。**阶段 4**：FE 在列表页只在批量编辑和表格内联编辑后触发，smart-kit 列表页两者都没有，暂不适用，随批量编辑或内联编辑一起做 | 未实现 | 阶段 6 | — | — |
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

### 6.2 smart-kit 的扩展（FE 不这样做；D41 逐条决定，阶段 4 已按决定改）

| 项 | smart-kit | FE 1.154 |
| --- | --- | --- |
| 属性上的 `UI.Criticality` | 原来作为单元格状态色的回退；**阶段 4 按 FE 去掉**（D41），改为行高亮 | 不读，只用 `LineItem@UI.Criticality` 做行高亮 |
| `Core.IsURL` | 原来显示为链接；**阶段 4 按 FE 去掉**（D41） | 不处理 |
| `Common.IsUpperCase` | 原来筛选输入转大写；**阶段 4 按 FE 去掉**（D41） | 列表页不处理 |
| VeryPositive、VeryNegative | 原来上色；**阶段 4 改为不上色**（D41） | 不上色 |
| 外部链接 | 原来 `_blank`；**阶段 4 改为缺省当前窗口**（D41） | 缺省当前窗口，按 `HTML5.LinkTarget` |
| `CountRestrictions`、`Top/SkipSupported`、`ExpandRestrictions` | 读（保留，`kit-extension`，D41） | 不读（不冲突） |
| 没有草稿的服务，列表页的"新建" | 提供直接保存的新建（ADR-018）；长期保留（D42 补记，`kit-extension`，DV-FE-04） | 只在草稿、粘性会话或 External 新建方式时有 |

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

| 组 | 行数 | 一致（29a → 阶段 3 → 阶段 4 → 阶段 4 收尾） | 部分一致 | 不一致 | 未实现 | FE 列表页不用 |
| --- | --- | --- | --- | --- | --- | --- |
| 表格列与动作 | 41 | 2 → 3 → 18 → 19 | 15 → 15 → 15 → 14 | 7 → 6 → 0 → 0 | 15 → 15 → 6 → 6 | 2 → 2 → 2 → 2 |
| 筛选栏与值帮助 | 47 | 5 → 10 → 19 → 22 | 11 → 12 → 7 → 8 | 3 → 0 → 0 → 0 | 21 → 18 → 14 → 10 | 7 → 7 → 7 → 7 |
| 值的显示 | 57 | 16 → 17 → 32 → 32 | 14 → 13 → 14 → 14 | 7 → 7 → 1 → 1 | 18 → 18 → 8 → 8 | 2 → 2 → 2 → 2 |
| 视图、呈现、聚合与能力 | 50 | 5 → 8 → 20 → 20 | 14 → 17 → 14 → 14 | 9 → 5 → 1 → 1 | 16 → 14 → 9 → 9 | 6 → 6 → 6 → 6 |
| **合计** | **195** | **28 → 38 → 89 → 93** | **54 → 57 → 50 → 50** | **26 → 18 → 2 → 2** | **70 → 65 → 37 → 33** | **17 → 17 → 17 → 17** |

阶段 4 写"一致"的行里，下面这些当时只按 FE 源码实现、只有单元测试：`CssDefaults/width`、`DataFieldWithNavigationPath`、`DataFieldWithAction`、FieldGroup、ConnectedFields 列、`IsActionCritical`、`IsCopyAction`、`DataFieldForActionGroup`、路径形式的 `Deletable`、带限定符的 ValueList、`InitialExpansionLevel` 和树表的自动判断、删除确认的文字。**阶段 4 收尾**（D45）在测试页面上叠加注解，用真 FE 核对了其中的列、工具栏动作（选行后的可用性）、行高亮、列宽、确认对话框和删除确认（`tests/e2e-fe/colsfe.spec.ts`，`cols5-*`），都一致；仍只有单元测试的是：带限定符的 ValueList、`InitialExpansionLevel` 和树表的自动判断、点击导航和执行动作（`DataFieldWithNavigationPath`、`DataFieldWithAction` 的点击，`IsCopyAction` 执行后的导航）。

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

阶段 4 改变结论的 `29a` 行（按 `29a` 文件的行号；"之前"是阶段 3 之后的结论）：

| `29a` 行 | 术语 | 之前 | 现在 |
| --- | --- | --- | --- |
| 14、18、24、25、48 | LineItem 的选定、`DataField/Criticality`、`DataFieldWithUrl`、`DataFieldWithNavigationPath`、`DeleteRestrictions` | 部分一致 | 一致 |
| 15、27、28、36、42 | 列集合与个性化、`DataFieldWithAction`、`DataFieldWithActionGroup`、Determining、`DataFieldForActionGroup` | 不一致 | 一致 |
| 21、32、33、39、40 | `CssDefaults/width`、FieldGroup、ConnectedFields、`IsActionCritical`、`IsCopyAction` | 未实现 | 一致 |
| 16、31、44、45 | 行高亮、Contact 列、`CreateHidden`、`DeleteHidden` | 未实现 | 部分一致 |
| 26 | `DataFieldWithIntentBasedNavigation` | 不一致 | 部分一致（D42） |
| 70、72、85、89、91、100 | `SelectionFields`、`HiddenFilter`、`FilterExpressionRestrictions`、`ValueList` 整体、`ValueList/Label`、`DisplayOnly` | 部分一致 | 一致 |
| 86、90、95 | `FilterFunctions`、带限定符的 ValueList、`ValueList/PresentationVariantQualifier` | 未实现 | 一致 |
| 105 | `ValueListRelevantQualifiers` | 未实现 | 部分一致 |
| 145、163、177、179、183 | DataPoint 列标题、`DataFieldWithUrl` 的协议、DataPoint 小数位、进度条、DataPoint `Title` | 部分一致 | 一致 |
| 141、153、162、164、175、176 | 筛选令牌的 TextSeparate、`IsUpperCase`、`IsURL`、`LinkTarget`、VeryPositive / VeryNegative、属性上的 `UI.Criticality` | 不一致 | 一致 |
| 166、169、170、192 | `Masked`、`IsEmailAddress`、`IsPhoneNumber`、`CssDefaults` | 未实现 | 一致 |
| 156、157、161、171、186、188 | `Timezone`、`IsTimezone`、`Edm.Stream`、Contact 单元格、`SemanticObject`、`ExternalID` | 未实现 | 部分一致 |
| 210、213、214、215、248 | PV 默认解析、`DynamicProperty`、`Visualizations`、`RequestAtLeast`、RecursiveHierarchy 自动判断 | 部分一致 | 一致 |
| 233 | 图表的排序 | 部分一致 | 一致 |
| 224、232、236 | 图表视图、图表需要 `ApplySupported`、删除确认 | 不一致 | 一致 |
| 226 | 图表类型 | 不一致 | 部分一致（近似画法） |
| 220、229、245 | `InitialExpansionLevel`、`DynamicMeasures`、`AggregatedProperty` | 未实现 | 一致 |
| 230、234 | `Chart.Actions`、`UI.KPI` | 未实现 | 部分一致 |

阶段 4 收尾改变结论的 `29a` 行（"之前"是阶段 4 之后的结论）：

| `29a` 行 | 术语 | 之前 | 现在 |
| --- | --- | --- | --- |
| 16 | 行高亮（`LineItem@UI.Criticality`） | 部分一致 | 一致（FE 对比场景 `cols5-*`） |
| 77、103、104 | SV 的 `Parameters`、`ValueListReferences`、`ValueListMapping` | 未实现 | 一致 |
| 110 | `Common.ResultContext` | 未实现 | 部分一致（对象页、参数化集上的图表等阶段 6，用户默认值长期） |

### 7.2 阶段 3 发现的 `29a` 更正

1. **第 222 行（多视图时的筛选栏初值）**：`29a` 说 FE 多视图时不设筛选栏初值（`LRConverter` 的 `j2 = $2 ? undefined : S(...)`）。FE 对比场景（`purchasing-views`）表明 FE 多视图时**照样**用默认 SV 设筛选栏初值（"已关闭"标签页在默认 `Status ne CLOSED` 下为空）。smart-kit 现在和 FE 一样；这一行剩下的差异只是"SPV 没有 SV 时回退到 `UI.SelectionVariant`"。
2. **第 223 行第④点（视图字段从筛选栏拿掉）**：FE 里视图的 SV 是表格的隐藏过滤，SelectionFields 的字段留在筛选栏；拿掉字段是 smart-kit 自己的做法，阶段 3 已去掉。
3. **第 217 行（`PV/Total`）和 `23` 的设计**：`29a` 建议"在 ApplySupported 加网格表的情况下"按 FE 默认合计全部可聚合列。FE 源码（`Table` 的 `updateTableVisualizationForType`、`getAggregateConditions`）表明 **GridTable 和 ResponsiveTable 都没有合计和小计**（GridTable 也不能分组），只有 AnalyticalTable 有；服务没有 CustomAggregate 时不合计。按 D39 改为只给分析表。多种币种的合计 FE 显示一个值加"多单位"标记（请求按单位一并聚合），不是 `23` 第 3.2 节的按币种分行，已按 FE 改。
4. **第 228 行（DimensionAttributes）**：维度 Role 的 Series 已按 FE 拆系列，Category2 和度量的 Axis 角色还没做（`29a` 记为整体未实现）。
5. **第 233 行（图表排序）**：FE 在没有 PV SortOrder 时图表请求不带 `$orderby` / `$top`；`29a` 只写了"用 PV SortOrder"。smart-kit 去掉了按维度升序，PV SortOrder 还没读。
6. **第 227 行（图表请求的细节）**：FE 的 groupby 除维度外还包括度量的单位；`Common.Text` 只在可分组且不经过导航时加入（否则图表显示代码）；多种单位时显示"Invalid data / Some measures have different units."。`29a` 没有写这些。
7. **第 152 行（IsDigitSequence 的补零规则）**：`29a` 标"待核实"。FE 对比场景确认：输入全是数字时去零后补零到 MaxLength；文本运算符（Contains 等）不解析；显示时去前导零，有 MaxLength 时 "0" 显示为空。
8. **第 54 行和第 256 行互相矛盾**：第 256 行说 smart-kit 额外请求的草稿字段"和 FE 一致"，第 54 行说不请求 `HasActiveEntity`。按代码第 54 行是对的；阶段 3 已补上。
9. **原 `02` 的错误**：第 3 节说支持 `Measures.Scale`，实际用的是 Edm 的 Scale facet（`29` 第 8 节），本文已改正；`textArrangement.ts` 关于 TextSeparate 的注释待阶段 4 改正（阶段 4 结束时仍没改）。

### 7.3 阶段 4 发现的更正

1. **`UI.Hidden` 属性的默认条件**（`29` 第 5 节、`29a` 第 72、73 行）：原来说 FE 对 Hidden 和 HiddenFilter 字段都"保持隐藏，条件照样生效"。FE 对比场景（`filter4-hidden-defaults`）表明：HiddenFilter 的条件照样生效，**Hidden 属性的 SV 默认条件被丢掉、不发**。
2. **路径形式的 `Deletable`**（`29a` 第 48 行）：原来说"选中的行都能删才可用"。FE `StandardActions` 按 `deletableContexts` 的个数判断：选中的行里至少一行可删就可用，只删可删的行。
3. **FieldGroup 列**（`29a` 第 32 行）：原来说每行是"标签：值"。FE 缺省不带标签，只有 manifest 设了 `showDataFieldsLabel` 才带。
4. **指向 DataPoint 的列标题**（`29a` 第 29、145 行）：原来标"待核实"。FE 对比场景（`cols-po-list`）确认先取 DataPoint Value 的 `Common.Label`，再取记录 `Label`；没有 `Label` 的微图表列，FE 显示的是列的键。
5. **行高亮的常量**：FE 把 LineItem 上常量 VeryNegative / VeryPositive 的 `UI.Criticality` 映射为错误 / 成功（`getMessageTypeFromCriticalityType`），路径值只认 1、2、3、5。源码读起来如此，但真 FE 的表格把枚举名交给 `TableFormatter.rowHighlighting`，常量一律不高亮；阶段 4 收尾按真 FE 的结果改为常量不高亮（第 1 节行高亮一行）。

### 7.4 阶段 4 之后还剩的

- **阶段 4 收尾**（D43 留下的三项，已完成，D45）：未分组的分析表用一个 `$apply` 的 `concat` 同时取行、合计和条数；`Common.ValueListReferences` / `ValueListMapping`（筛选栏）；`Common.ResultContext` 和 SV 的 Parameters（列表页）；新列类型和新动作用真 FE 核对（见 7.1）。剩下的都已登记，列在下面各阶段里（DV-apply-005～010、DV-vhref-001～004）。
- **阶段 5**：分组的分析表按 FE 的可折叠层级读（DV-apply-005、006）；页签计数用 `/$count`（DV-apply-007）、页签结构；切换到没有排序的视图时 FE 发两次请求、图表 `filter()` 的括号、`$apply` 里的页大小（DV-apply-008～010）；FE 默认的 ResponsiveTable 和 NewPage 新建方式；`keyPerformanceIndicators` 按 manifest 定名；manifest 的默认 SPV；`PV/MaxItems`。
- **阶段 6**：编辑态的引用值帮助、引用服务映射的 `ValueListRelevantQualifiers`（DV-vhref-001、002）；参数化实体集的对象页、图表、树表和分析表（DV-vhref-003）；SideEffects（随批量编辑、内联编辑）；对象页请求不再选 ETag 属性（列表已按 FE 不选）；CodeList 的小数位和金额、数量的小数点对齐；流属性的图标、上传；联系人弹出框的其余内容。
- **长期**（D42 等）：语义对象链接中需要 FLP 的部分（Mapping、UnavailableActions、"更多链接"）；参数的启动台用户默认值（DV-vhref-004）；非英语的时区名称；没有草稿的服务在列表页的"新建"（`kit-extension`）。
- **待排**：dual、combination、scatter、bubble、heatmap、treemap、waterfall、bullet 图表是近似画法；表中标"待排"的其余各项。
