# 29 列表页的注解：和 Fiori elements 1.154 逐条对照

> 状态：P1 八项已在阶段 3 按 FE 修正（D40，2026-11-18）；第 5、6 节的各项已在阶段 4 按 FE 修正（D41、D42、D43，2026-11-18），每条后面注明，剩下的见第 5 节末尾。现状以按 FE 源码重写的 `02` 为准；本文保留 D33 时的分析。原状态：待用户决定 · 2026-11-17（讨论记录 D33）。逐条对照表见附录 `29a-list-report-annotation-tables.md`（195 行，每行都有 FE 源码和 smart-kit 代码的依据）。

## 1. 为什么要重做

`02-annotation-coverage.md` 的依据是设计规范（Fiori Design Guidelines）、参考项目和一个参考应用的观察，说的是"界面应该是什么样"，没有说"Fiori elements 拿每个注解做了什么"。注解驱动是 smart-kit 的核心：同一份 `$metadata` 和注解，smart-kit 和 Fiori elements 必须得到相同的筛选栏、列、动作、请求和显示，否则使用方会在两边来回对照、各自打补丁。

## 2. 方法

1. **Fiori elements 实际读了哪些注解**：下载 SAPUI5 1.154.0 的 sap.fe 四个库（core、macros、templates、base）的 library-preload，按模块拆开（1,240 个模块），从字符串和属性访问里提取注解术语（`com.sap.vocabularies.UI.v1.LineItem`、`annotations.UI?.LineItem` 两种写法），去掉整套词汇表的转换器模块，得到 161 个被使用的术语；按使用它的模块分为列表页相关 136 个、只用于对象页 11 个、其他 14 个。
2. **逐条对照**：分四组（表格列与动作、筛选栏与值帮助、值的显示、视图与聚合），每个术语和它的重要记录属性，都读 FE 的转换器和控件代码（`converters/templates/ListReportConverter`、`controls/ListReport/FilterBar`、`controls/Common/Table`、`table/Columns`、`Action`、`Chart`、`KPI`，`macros/field`、`macros/internal/valuehelp`、`DraftEditState` 等），再读 smart-kit 的 `buildModel.ts`、`query/*`、`SmartField`、`filter/*`、`table/*`、`SmartListReport.tsx`，写出两边的做法、结论和改法。词汇表定义取自 SAP 和 OASIS 的官方 XML。
3. **抽查**：最高优先级的结论我又对着代码复核过（草稿筛选、默认不可搜索、不读 `FilterDefaultValue` 和 `CustomAggregate`、值帮助请求不带 In 参数）。

## 3. 总体结果

| 组 | 行数 | 一致 | 部分一致 | 不一致 | 未实现 | FE 列表页不用 |
| --- | --- | --- | --- | --- | --- | --- |
| 表格列与动作 | 41 | 2 | 15 | 7 | 15 | 2 |
| 筛选栏与值帮助 | 47 | 5 | 11 | 3 | 21 | 7 |
| 值的显示 | 57 | 16 | 14 | 7 | 18 | 2 |
| 视图、呈现、聚合与能力 | 50 | 5 | 14 | 9 | 16 | 6 |
| **合计** | **195** | **28** | **54** | **26** | **70** | **17** |

一致的主要是：`Common.Text` + `TextArrangement` 在单元格里的显示、`DataField.Criticality` 和 `CriticalityRepresentation`、评分、`PresentationVariant.SortOrder`、`SortRestrictions`、`GroupableProperties`、`HeaderInfo.TypeNamePlural` 作为表格标题。

## 4. 结果会错的（P1，8 项）

| # | 问题 | FE 1.154 | smart-kit | 改法 |
| --- | --- | --- | --- | --- |
| 1 | 草稿服务的列表 | "全部"＝`IsActiveEntity eq false or SiblingEntity/IsActiveEntity eq null`：自己的草稿代替活动实例出现，新建未激活的草稿也在列表里；编辑状态 6 个选项（含"被他人锁定""他人有未保存的更改"，按 `InProcessByUser`）（`DraftEditState`） | 永远 `IsActiveEntity eq true`，4 个选项用活动实例上的标记（`SmartListReport.tsx` `tableFilters`）。这是二期有意的做法（`14`） | 按 FE 改请求和选项 |
| 2 | 合计、图表、KPI 的度量 | 以 `Aggregation.CustomAggregate` 为准，请求 `aggregate(M)`（由服务决定怎么算） | 不读 `CustomAggregate`，一律 `M with sum`（`request.ts`、`totals.ts`）；平均、比率、去重计数会算错，有的服务直接拒绝 | 读 `CustomAggregate`，按 FE 发请求 |
| 3 | 列表页图表 | 全部维度和度量 | 只用第一个维度和第一个度量（`ChartView.tsx`） | 按 `UI.Chart` 全部画出 |
| 4 | 默认筛选值 | 没有默认 SV 时用 `Common.FilterDefaultValue` 生成 EQ 条件（RAP 的 `@Consumption.filter.defaultValue` 生成的就是它） | 不读 | 实现 |
| 5 | 值帮助的 In、InOut、Constant 参数 | 作为值帮助请求的 `$filter`（In 的值取筛选栏里对应字段的条件） | 不加（`buildValueHelpRequest`），值帮助会给出不该出现的值；Out 也不回写 | 实现 In / Constant 过滤和 Out 回写 |
| 6 | 多视图的筛选条件 | 每个视图应用自己完整的 SV | 只叠加"各视图取值不同"的条件，所有视图共有、默认 SV 又没有的条件丢失 | 按 FE 应用完整 SV |
| 7 | 搜索框 | 只要没写 `Searchable=false` 就显示 | 没写就不显示（`DEFAULT_CAPABILITIES.searchable: false`，`04` 里有意的做法）；值帮助 `SearchSupported` 的缺省也和词汇表相反 | 缺省改为可搜索 |
| 8 | `Common.IsDigitSequence` 的筛选输入 | 按 `MaxLength` 补前导零（"123" → "0000000123"） | 原样发出，查不到 | 补零（UI5 的具体规则待核实） |

## 5. 显示、动作、视图不完整（P2，主要的）

**表格列**
- `DataFieldForAnnotation` 指向 FieldGroup、ConnectedFields、Contact，以及 `DataFieldWithIntentBasedNavigation`、`DataFieldWithAction`：smart-kit 整列丢掉，FE 显示；反过来 FE 不当列显示的 `DataFieldWithActionGroup`，smart-kit 显示成普通列。**阶段 4 已按 FE**（Contact 弹出框只显示第一个电话和邮件，其余阶段 6；`DataFieldWithIntentBasedNavigation` 的链接目标按 D42 由宿主的 `NavigationAdapter` 给出）。
- 不读 `HTML5.CssDefaults/width`（列宽）、LineItem 上的 `UI.Criticality`（行高亮）；`DataFieldWithNavigationPath` 只显示文本，不是链接；个性化不能加 LineItem 以外的属性。**阶段 4 已按 FE**；阶段 4 收尾用真 FE 核对：行高亮的常量（Negative、VeryNegative、VeryPositive 等）真 FE 不高亮，smart-kit 跟着改（`02` 第 7.3 节）；个性化的列、排序、分组候选也按 FE 的属性列表。
- LineItem 的选定：FE 只在 SPV / PV 的 `Visualizations` 含 LineItem 或 Chart 时才用它，否则逐级回退；Chart 排第一时默认显示图表。smart-kit 都没做。**阶段 4 已按 FE**（manifest 指定默认 SPV 在阶段 5）。

**动作**
- `DataFieldForActionGroup` 的子动作全部丢失；`UI.CreateHidden`、`UI.DeleteHidden`、`Common.IsActionCritical`（执行前确认）、`UI.IsCopyAction` 没实现；LineItem 里 `Determining` 的动作被放进了工具栏（FE 列表页不显示）。**阶段 4 已按 FE**（`CreateHidden` / `DeleteHidden` 的路径形式不求值）。
- **缺陷**：非绑定动作的 `Core.OperationAvailable` 为 false 时按钮仍可点，点了没有反应。**阶段 3 已修。**
- 路径形式的 `DeleteRestrictions/Deletable` 被当成 true；`InsertRestrictions` 只读常量；默认新建方式是对话框，FE 列表页默认打开对象页（NewPage）。**阶段 4**：路径形式的 `Deletable` 按行判断、`Insertable` 路径保留新建，已按 FE；新建方式 NewPage 留给阶段 5；没有草稿的服务在列表页也有"新建"（FE 没有），按 D42 补记长期保留（`kit-extension`）。
- 删除确认显示语义键，FE 显示 `HeaderInfo.Title`。**阶段 4 已按 FE**（文字和 FE 相同）。

**筛选栏和值帮助**
- `FilterExpressionRestrictions`：同一属性多条记录时没取最严格的；各表达式允许的运算符和 FE 不同；`SingleValue` 的日期字段没有单值相对日期。**阶段 4 已按 FE。**
- `HiddenFilter`、`Hidden` 字段有 SV 默认条件时被显示出来（FE 保持隐藏，条件照样生效）。**阶段 4 已按 FE。更正**：FE 只对 `HiddenFilter` 的条件照样生效，`UI.Hidden` 属性的默认条件被丢掉、不发。
- 未实现：`Capabilities.FilterFunctions`（`tolower`，不区分大小写）、带限定符的 ValueList 和 `ValueListRelevantQualifiers`、`ValueListReferences`、`Common.ResultContext`（参数化实体集）和 SV 的 Parameters、FROM / TO / N 周 / N 月等日期运算符。**阶段 4**：`FilterFunctions`、带限定符的 ValueList、`ValueListRelevantQualifiers`（不含 `$If` 表达式）和日期运算符已按 FE；**阶段 4 收尾**：`ValueListReferences` / `ValueListMapping`（筛选栏）、`ResultContext` 和 SV 的 Parameters（列表页）已按 FE；编辑态的引用值帮助和参数化实体集的对象页、图表等在阶段 6，启动台的用户默认值长期不做（D42）。
- 值帮助的描述列应取值帮助主键属性上的 `Common.Text`，现在取第一个 DisplayOnly 参数。**阶段 4 已按 FE。**
- 筛选令牌：遇到 `TextSeparate` FE 只显示代码，smart-kit 改成了 TextFirst。**阶段 4 已按 FE**；表格里 TextSeparate 的文本也不再请求（同 FE）。

**值的显示**
- `Communication.IsEmailAddress` / `IsPhoneNumber` 没有 `mailto:` / `tel:` 链接，`Communication.Contact` 列被丢掉（FE 是联系人弹出框）。**阶段 4 已按 FE**（联系人弹出框只显示第一个电话和邮件，阶段 6）。
- 数值：单元格里 DataPoint 的 `ValueFormat.NumberOfFractionalDigits` 没生效；没读 CodeList 里币种和单位的小数位；金额、数量列没有小数点对齐；进度条没有状态色。**阶段 4**：DataPoint 的小数位、进度条的状态色和文字已按 FE；CodeList 和小数点对齐留给阶段 6。
- 链接：外部链接一律新窗口（FE 缺省当前窗口，按 `HTML5.LinkTarget`）。**阶段 4 已按 FE**（D41）。
- 未实现：`Common.ExternalID`（会显示内部 GUID）、`Common.Masked`（会显示明文）、`Common.Timezone`、`Edm.Stream` 文件显示、`Common.SemanticObject` 智能链接；快速预览缺"经导航取目标键或语义键"这条规则。**阶段 4**：都已实现；语义对象链接按 D42 由宿主的 `NavigationAdapter` 给目标，需要 FLP 的部分和非英语的时区名称登记为长期偏差；流属性的图标、上传留给阶段 6；`ExternalID` 在筛选令牌里还没做。

**视图、图表、聚合**
- 图表：除 Bar 以外都画成柱状图（FE 映射约 40 种）；不用 PV 的 SortOrder；不支持 DynamicMeasures、AggregatedProperty；标题不用 `Chart.Title`；没有 `Chart.Actions`。**阶段 4**：照 FE 映射 38 种类型，其中 dual、combination、scatter、bubble、heatmap、treemap、waterfall、bullet 是近似画法；PV SortOrder、DynamicMeasures、AggregatedProperty、`Chart.Title` 已按 FE；`Chart.Actions` 只做了 DataFieldForAction。
- 多视图的来源：FE 由 manifest 指定视图（SPV、PV 或 SV，可以带自己的实体集，引用 Chart 的视图是单独的图表视图）；smart-kit 自动收集所有带限定符的 SPV，每个视图都是"表格 + 可切换的图表"。视图没有排序时 smart-kit 回退到默认 PV 的排序；视图的 RequestAtLeast 不生效。**阶段 4**：图表视图、视图自己的排序和 RequestAtLeast 已按 FE；由属性指定视图（SPV、PV、SV）、页签计数用 `/$count`、页签结构留给阶段 5。
- 自动判断：ApplySupported 支持全部 8 种转换时 FE 自动用分析表格，有成对的 RecursiveHierarchy 时自动用树表；树表的初始展开取 PV 的 `InitialExpansionLevel`；没有 `Total` 时默认合计所有可聚合列。smart-kit 都要手工设。**阶段 4**：分析表、树表的自动判断和初始展开已按 FE（默认合计阶段 3 已按 FE，D39）；都不满足时 smart-kit 仍默认网格表，FE 默认 ResponsiveTable，留给阶段 5；**阶段 4 收尾**：未分组的分析表已按 FE 用一个 `$apply` 的 `concat` 同时取行、合计和条数，分组的分析表（FE 是可折叠的层级）留给阶段 5。
- `UI.KPI`（列表页标题区的 KPI 标签）没实现；列表里没有 `Common.SideEffects`。**阶段 4**：KPI 标签已按 FE（`keyPerformanceIndicators` 属性，名字阶段 5 按 manifest 定；点标签弹出的图表卡片没做）；SideEffects 在 FE 列表页只随批量编辑和内联编辑触发，smart-kit 列表页两者都没有，留给阶段 6。

**阶段 4 之后还剩的**（详见 `02` 第 7.4 节）
- 阶段 4 收尾（D45）已完成：分析表的单个 `$apply`（`concat`）请求（未分组）；`ValueListReferences` / `ValueListMapping`；`ResultContext` 和 SV 的 Parameters；新列类型和新动作用真 FE 核对。剩下的已登记（DV-apply-005～010、DV-vhref-001～004），列在下面。
- 阶段 5：分组的分析表按 FE 的可折叠层级读；页签计数用 `/$count`、页签结构；FE 默认的 ResponsiveTable 和 NewPage 新建方式；`keyPerformanceIndicators` 定名。
- 阶段 6：SideEffects；对象页请求不再选 ETag 属性；编辑态的引用值帮助；参数化实体集的对象页、图表、树表和分析表。
- 近似画法的图表类型（dual、combination、scatter、bubble、heatmap、treemap、waterfall、bullet），还没排。
- D42：smart-kit 不依赖 SAP 和 Fiori 启动台；语义对象链接通过 `NavigationAdapter` 由宿主给目标，没有目标时 IBN 列只显示值；参数化实体集的参数不取启动台的用户默认值（DV-vhref-004）。

## 6. smart-kit 多做或做得不同的（要决定保留还是去掉）

| 项 | smart-kit | FE | 建议 |
| --- | --- | --- | --- |
| 属性上的 `UI.Criticality` | 当作字段的状态色 | 词汇表规定它只能注在注解上（LineItem 的行高亮），FE 不读属性上的 | 去掉，改为行高亮（D41，阶段 4 已改） |
| `Core.IsURL` | 显示为链接 | 不处理 | 去掉（D41，阶段 4 已改） |
| `Common.IsUpperCase` | 输入转大写 | 不处理 | 去掉（D41，阶段 4 已改） |
| Criticality 的 VeryPositive、VeryNegative | 上色 | 不上色 | 改为不上色（D41，阶段 4 已改） |
| 外部链接 | `_blank` | `_top`（当前窗口） | 按 FE（D41，阶段 4 已改） |
| 多视图里各视图取值不同的字段 | 从筛选栏拿掉 | 代码里没找到对应逻辑 | FE 没有，阶段 3 已去掉（D40） |
| `CountRestrictions`、`Top/SkipSupported`、`ExpandRestrictions` | 读 | 不读 | 保留（不冲突，`kit-extension`，D41） |

## 7. FE 不需要 manifest 就做不到的部分

视图列表、默认 SPV（`defaultTemplateAnnotationPath`）、表格类型、新建方式等，在 FE 里由 manifest 决定，不在注解里。smart-kit 没有 manifest，对应的是 `SmartListReport` 的属性。这些属性的名字和取值应该和 manifest 设置一致，和 D32 第 3.9 节（模板对照 sap.fe 的 manifest schema）一起做。

## 8. 文档自己的错误

- `02` 第 3 节说支持 `Measures.Scale`，实际用的是 Edm 的 Scale facet。
- `packages/core/src/model/textArrangement.ts` 的注释说 TextSeparate 会让文本单独成列，代码没有这样做（阶段 4 结束时注释仍没改）。

## 9. 建议的做法

1. **定原则（ADR-033）**：注解的语义以 Fiori elements 的源码为准（版本和 `26a` 一样定为 1.154）；`02` 改为以本文附录为底稿重写，每条注明 FE 的模块；以后新增注解支持先读 FE 源码再写。
2. **第 1 批：P1 八项**（结果会错的）。其中第 1、7 项推翻了以前的有意设计（`14` 的草稿列表、`04` 的默认不可搜索），需要用户确认。
3. **第 2 批：列和动作的完整性**（第 5 节"表格列""动作"，含可用性缺陷）。
4. **第 3 批：显示语义**（第 5 节"值的显示"和第 6 节）。
5. **第 4 批：视图、图表、聚合、KPI**，和 D32 的模板 manifest 对照一起做。
6. **第 5 批：P3**（附录里的其余各项）。

每一批都：先把相关条目写成验收条目和测试（同一份注解，断言 smart-kit 发出的请求和显示与 FE 一致），再改代码；改到使用方可见的行为时写 changeset 和给 invoice-assure 的说明。

对象页的注解这次没有对照，需要同样做一遍。
