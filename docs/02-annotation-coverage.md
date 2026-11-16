# 02 注解覆盖矩阵

> 状态：现行 · 2026-11-14。
>
> 期次：**一期** / **二期** / **三期** / **不做**。
>
> "测试"一列是测试编号，测试名称里带这个编号（例如 `it('ANN-01 …')`），可以用 `npm run trace` 检查每个一期条目都有对应测试（v4 第 9 节第 10 条）。
>
> 规则编号见 `01`、`01b`。词汇表命名空间：
> - UI = `com.sap.vocabularies.UI.v1`
> - Common = `com.sap.vocabularies.Common.v1`
> - Measures = `Org.OData.Measures.V1`
> - Capabilities = `Org.OData.Capabilities.V1`
> - Core = `Org.OData.Core.V1`

## 1. UI

| 术语 | 用途 | 期次 | 规则 | 测试 |
| --- | --- | --- | --- | --- |
| `UI.LineItem` | 表格列：`DataField`、`DataFieldWithUrl`、`DataFieldForAnnotation`（指向 DataPoint，即评分和进度）、`DataFieldWithNavigationPath`（显示为文本）；`DataFieldForAction` 和 `DataFieldForIntentBasedNavigation` 在一期忽略 | 一期（动作二期） | LR-18、LR-31 | ANN-01 |
| `UI.SelectionFields` | 筛选栏默认字段，按顺序 | 一期 | LR-09、LR-10 | ANN-02 |
| `UI.HeaderInfo` | 列表表标题（`TypeNamePlural`）、对象页标题和副标题（`Title`、`Description`）、图片（`ImageUrl`）、面包屑文字 | 一期 | OP-01、NAV-03 | ANN-03 |
| `UI.PresentationVariant` | 默认排序（`SortOrder`）、使用的 LineItem 限定符（`Visualizations`）、`RequestAtLeast` | 一期（分组由个性化对话框提供，`GroupBy`、`Total` 注解不做） | LR-32 | ANN-04 |
| `UI.SelectionVariant` | 默认筛选条件（`SelectOptions`）、默认参数 | 一期（用作初始条件） | LR-06 | ANN-05 |
| `UI.SelectionPresentationVariant` | 列表页的默认组合 | 一期（只取它引用的 SV 和 PV） | LR-06 | ANN-05 |
| `UI.Facets` | 对象页区块：`CollectionFacet` 是区块，它的子 Facet 是子区块；顶层的 `ReferenceFacet` 是只有一个子区块的区块 | 一期 | OP-10、OP-12 | ANN-06 |
| `UI.ReferenceFacet` | 指向 `@UI.FieldGroup`、`@UI.Identification` 的是表单；指向 `导航/@UI.LineItem` 的是子表；指向 `@UI.DataPoint` 的是关键值 | 一期 | OP-12、OP-13、OP-14 | ANN-06 |
| `UI.CollectionFacet` | 区块（顶层）和表单组集合（子区块内） | 一期 | OP-10 | ANN-06 |
| `UI.PartOfPreview` | 为 false 时放进"显示更多" | 一期 | OP-11 | ANN-07 |
| `UI.HeaderFacets` | 页头 Facet：FieldGroup 是表单，DataPoint 是关键值、评分或进度 | 一期 | OP-03、OP-04 | ANN-08 |
| `UI.FieldGroup` | 表单组，以及页头的表单 Facet | 一期 | OP-13、OP-04 | ANN-09 |
| `UI.Identification` | 没有 Facet 时的默认表单字段 | 一期 | OP-13 | ANN-09 |
| `UI.DataPoint` | 关键值（`Value`、`Title`、`Criticality`）；`Visualization` 为 `Rating` 时是评分，为 `Progress` 时是进度（`TargetValue`） | 一期 | OP-04、LR-31 | ANN-10 |
| `UI.Criticality`（字段上） 和 `DataField/Criticality` | 状态色和图标（0 中性、1 负面、2 警告、3 正面、5 信息）；可以是常量或路径 | 一期 | LR-31 | ANN-11 |
| `UI.CriticalityRepresentation` | 是否显示图标 | 一期 | LR-31 | ANN-11 |
| `UI.Hidden` | 字段不出现在任何界面（列、筛选、表单、个性化） | 一期（只支持常量；路径值二期） | LR-31 | ANN-12 |
| `UI.HiddenFilter` | 字段不出现在筛选栏和适配筛选里 | 一期 | LR-09 | ANN-12 |
| `UI.Importance` | 列的重要性（响应式表格按宽度隐藏列，见 ADR-020）；表单字段在小屏隐藏 | 二期 | OP-13、P2-LR-09、P2-OP-10 | ANN-87 |
| `UI.TextArrangement` | 代码与文本的排列：`TextFirst`、`TextLast`、`TextOnly`、`TextSeparate` | 一期 | LR-31 | ANN-13 |
| `UI.IsImageURL` | 字段值是图片地址，显示为头像 | 一期 | LR-31、OP-04 | ANN-14 |
| `UI.MultiLineText` | 多行文本显示 | 一期 | OP-13 | ANN-14 |
| `UI.Chart` | 列表页图表视图（Column、Bar）和页头微图表 Facet（Bullet、Donut、Pie、Waterfall 作为 Delta、Column、Line、Bar 作为 Comparison），见 ADR-021。三期按 SAP 改正：`Waterfall` 作为 Delta 的约定去掉，见下面三期一行和 `15` | 二期 | P2-LR-04、P2-OP-04 | ANN-82、ANN-83 |
| `UI.ConnectedFields`、`UI.Note` | 组合字段、备注 | 不做（三篇基准规范没有要求） | — | — |
| `UI.SelectionPresentationVariant`（带限定符，多视图） | 每个限定符是一个视图：`Text`、`SelectionVariant`、`PresentationVariant`（LineItem 限定符、图表） | 二期 | P2-LR-01、P2-LR-02 | ANN-85 |
| `UI.DataFieldForAction`（`LineItem`、`Identification`）与 `Core.OperationAvailable` | 表动作、行内动作（`Inline`）、页头和页脚动作（`Determining`）；可用性和部分处理，见 ADR-024 | 二期 | P2-LRA-02、P2-LRA-03、P2-OP-26 | ANN-80、ANN-81 |
| `UI.QuickViewFacets` | 快速预览（交叉导航） | 二期 | P2-LR-13 | ANN-86 |
| `UI.DataPoint` 的 `SampleSize`、`MinimumValue`、`MaximumValue` | 汇总评分、微图表的刻度 | 二期 | P2-OP-04、P2-OP-06 | ANN-84 |
| `UI.Badge`、`UI.KPI`、`UI.DeleteHidden`、`UI.UpdateHidden`、`UI.CreateHidden` | | 不做（三篇基准规范没有要求；动作的隐藏用 Capabilities 和 `OperationAvailable`） | — | — |
| `UI.Chart`（作为微型图表，被 `DataFieldForAnnotation` 或 `ReferenceFacet` 引用，九种全做：Area、Bullet、Column、Comparison、Delta、Harvey Ball、Line、Radial、Stacked Bar），以及它用到的 `UI.DataPoint` 的 `CriticalityCalculation`、`ForecastValue`、`Visualization`（`DeltaBulletChart`）、`ValueFormat` | 表格单元格里的微型图表；页头微图表 Facet 补齐其余种类（二期已有的见上一行）。`ChartType` 对应关系：`Bullet`、`Donut`（Radial）、`Pie`（Harvey Ball）、`Column`、`Line`、`Area`、`Bar`（Comparison）、`BarStacked`（Stacked Bar），Delta 暂用本库约定 `Waterfall`（待定）；二期的 `Area`→折线、`BarStacked`→Comparison 改正。规则见 `15-research-micro-chart.md` 第 3 节，导航集合的读取见 ADR-025；讨论记录 D01、D07～D10。三期已实现，验收见 `17`、`18` | 三期 | LR-31、OP-04、MC-60、MC-61、MC-65 | MC-60、MC-61、MC-65 |

## 2. Common

| 术语 | 用途 | 期次 | 规则 | 测试 |
| --- | --- | --- | --- | --- |
| `Common.Label` | 字段、实体、Facet 的标签；缺省时用属性名（按驼峰拆成单词） | 一期 | 全部 | ANN-20 |
| `Common.Text` | 代码字段对应的文本路径（可以经过导航，如 `_Supplier/Name`），查询时自动 `$expand` | 一期 | LR-31 | ANN-21 |
| `Common.ValueList` | 值帮助：`CollectionPath`、`Parameters`（`ValueListParameterInOut`、`ValueListParameterOut`、`ValueListParameterIn`、`ValueListParameterDisplayOnly`）、`SearchSupported`、`Label` | 一期 | LR-11 | ANN-22 |
| `Common.ValueListWithFixedValues` | 固定值，显示为下拉框而不是对话框 | 一期 | LR-10 | ANN-22 |
| `Common.ValueListReferences`、`Common.ValueListMapping` | 外部值帮助服务 | 不做（测试服务没有外部值帮助服务，三篇基准规范没有要求） | — | — |
| `Common.FieldControl` | 一期只读，只识别 `Hidden`（值为 0）；编辑态见下一行 | 一期（隐藏） | OP-20 | ANN-23 |
| `Common.FieldControl`（`Mandatory`、`ReadOnly` 常量） | 编辑和新建时的必填与只读 | 二期 | P2-OP-16、P2-LR-15 | ANN-88 |
| `Common.SemanticKey` | 关键标识列（加粗）；也决定面包屑和标题的回退显示 | 一期 | LR-24 | ANN-24 |
| `Common.IsUpperCase`、`Common.IsDigitSequence`、`Common.IsCalendarDate` 等 | 格式提示 | 一期（`IsDigitSequence` 显示时去掉前导零） | LR-31 | ANN-25 |
| `Common.DraftRoot` 的识别 | 模型标记草稿服务 | 一期 | — | ANN-26 |
| `Common.DraftRoot`、`Common.DraftNode` 的动作 | 草稿编辑策略：`EditAction`、`PreparationAction`、`ActivationAction`，见 ADR-018 | 二期 | P2-OP-18 | ANN-89 |
| `Common.SideEffects` | 编辑联动 | 不做（三篇基准规范没有要求；保存后整页重新读取） | — | — |

## 3. Measures

| 术语 | 用途 | 期次 | 规则 | 测试 |
| --- | --- | --- | --- | --- |
| `Measures.ISOCurrency` | 金额字段的币种（路径或常量）；按币种的小数位格式化 | 一期 | LR-31 | ANN-30 |
| `Measures.Unit` | 数量字段的单位（路径或常量） | 一期 | LR-31 | ANN-30 |
| `Measures.Scale` | 小数位 | 一期 | LR-31 | ANN-30 |

## 4. Capabilities

| 术语 | 用途 | 期次 | 规则 | 测试 |
| --- | --- | --- | --- | --- |
| `Capabilities.FilterRestrictions` | `Filterable`、`NonFilterableProperties`、`RequiredProperties`（必填筛选）、`FilterExpressionRestrictions`（`SingleValue`、`MultiValue`、`SingleRange`、`MultiRange`、`SearchExpression`；二期起筛选字段、取值帮助和请求都按它限制，P2-LR-19） | 一期 | LR-06、LR-10、LR-35 | ANN-40 |
| `Capabilities.SortRestrictions` | `Sortable`、`NonSortableProperties` | 一期 | LR-35 | ANN-41 |
| `Capabilities.SearchRestrictions` | `Searchable` | 一期 | LR-05、LR-35 | ANN-42 |
| `Capabilities.CountRestrictions` | `Countable` | 一期 | LR-35 | ANN-43 |
| `Capabilities.TopSupported`、`SkipSupported` | 分页 | 一期 | LR-35 | ANN-43 |
| `Capabilities.ExpandRestrictions` | 不可展开的导航不出现在 `$expand` 里，改为单独读取 | 一期 | `05-data-provider.md` | ANN-44 |
| `Capabilities.InsertRestrictions`、`UpdateRestrictions`、`DeleteRestrictions` | 一期只读入模型（`insertable`、`updatable`、`deletable`），给二期的编辑使用；阶段 1.5 的编辑验证读取 `Updatable` | 一期（入模型） | OP-20 | ANN-45 |
| `Capabilities.NavigationRestrictions` | 按导航细分的上述限制 | 一期（Filter、Sort、Search 部分） | LR-35 | ANN-46 |

## 5. Core

| 术语 | 用途 | 期次 | 规则 | 测试 |
| --- | --- | --- | --- | --- |
| `Core.Computed`、`Core.Immutable` | 入模型（编辑接缝用） | 一期（入模型） | OP-20 | ANN-50 |
| `Core.Description` | 字段说明，作为提示 | 一期 | — | ANN-50 |
| `Core.OptimisticConcurrency` | 实体集声明了 ETag；入模型 | 一期（入模型） | OP-20 | ANN-50 |
| `Core.MediaType`、`Core.IsURL` | 链接显示 | 一期 | LR-31 | ANN-50 |

## 6. 解析与合并

| 项 | 期次 | 测试 |
| --- | --- | --- |
| 同一服务的 CSDL XML 与 CSDL JSON 得到相同模型 | 一期 | ANN-70 |
| 多份注解文件和覆盖层按顺序整条覆盖 | 一期 | ANN-71 |
| 不同文件使用不同别名 | 一期 | ANN-72 |

## 7. 零注解时的推导（见 `04-model-spec.md` 第 4 节）

| 缺失的注解 | 推导 | 测试 |
| --- | --- | --- |
| `UI.LineItem` | 主键加上前若干个基本类型属性（排除流、二进制、`UI.Hidden`），最多 8 列 | ANN-60 |
| `UI.SelectionFields` | 主键，以及有 `ValueList` 的属性；都没有时取前 3 个可筛选的字符串属性 | ANN-61 |
| `UI.HeaderInfo` | `TypeName` 用实体类型名拆词；`Title` 取第一个名字像 Name / Title / Description 的字符串属性，没有就取主键 | ANN-62 |
| `UI.Facets` | 一个"常规信息"区块（全部基本类型属性的表单），加上每个集合导航一个子表区块 | ANN-63 |
| `Common.Label` | 属性名按驼峰和下划线拆成单词 | ANN-64 |
