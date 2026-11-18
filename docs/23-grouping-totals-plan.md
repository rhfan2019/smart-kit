# 23 列表页的分组、小计和总计：方案

> 状态：已实施 · 2026-11-17。来源：讨论记录 D28；决定见 ADR-031；验收条目见第 7 节（`npm run trace -- --strict` 检查），结果见 `24-grouping-totals-report.md`。实施时与方案不同的地方见第 8 节。
> **D39 修订（2026-11-17）**：合计、小计（以及网格里的分组）只给分析表格，只合计 `Aggregation.CustomAggregate`，见第 10 节；第 2、3.4、3.5、9 节里"两种表格都有合计""网格表格分组""数值属性按 sum 合计"的说法以第 10 节为准。
> **阶段 4 收尾（D45，2026-11-18）**：未分组的分析表格按 FE 用一个 `$apply` 同时取行、总计和条数，请求失败时显示错误、没有合计行，见第 3 节开头和第 10 节末尾；分组的分析表格仍按第 3.3 节分开请求，留到阶段 5。

## 1. 现状

| 项 | 响应式表格（`mode="responsive"`） | 网格表格（`mode="grid"`，AG Grid） |
| --- | --- | --- |
| 分组 | 有：个性化对话框的"分组"页，单级；先按分组字段排序，值变化时插一行组标题（P2-LR-12） | 没有：AG Grid Community 不提供行分组（ADR-002、`12` U-5） |
| 小计 / 总计 | 没有 | 没有 |
| 分组进视图 | 没有：`groupBy` 只存在页面状态里，`VariantContent` 只存列和排序 | — |

可以直接用的部分：
- 服务端：`packages/server` 和内存数据提供者都实现了 `$apply` 的 `filter`、`search`、`groupby`、`aggregate`，聚合方法有 `sum`、`min`、`max`、`average`、`countdistinct`。
- core：`buildAggregateRequest` 已经生成 `$apply=filter(…)/groupby((维度,维度文本),aggregate(度量 with sum as 度量))`，现在只给图表用（ADR-021）。
- 注解：测试服务的 `PurchaseOrders` 已声明 `Aggregation.ApplySupported`（可分组字段：状态、订单类型、公司代码、供应商；可聚合字段：净值），但 core 的模型还没有读取它。`UI.PresentationVariant/GroupBy` 已读取（卡片在用），`Total` 没有读取。

## 2. 范围

| 项 | 响应式表格 | 网格表格 |
| --- | --- | --- |
| 分组（单级） | 保留，改为只能选可分组字段 | 不做（2026-11-17 补做，见第 9 节） |
| 组小计（在组标题行上） | **做** | 不做（同上） |
| 每组条数 | **做**（显示在组标题里） | 不做（同上） |
| 总计 | **做**（表尾一行） | **做**（AG Grid 底部固定行） |
| 分组和合计进视图 | **做** | 合计进视图 |
| 默认值来自注解 | `UI.PresentationVariant/GroupBy`、`Total` | `Total` |

不做：多级分组；网格表格的分组；导出带小计和总计（导出仍是明细行，Excel 里自己汇总）；`Aggregation.CustomAggregate` 和自定义聚合方法；只读取第一个 `GroupBy`。

## 3. 关键决定

> **阶段 4 收尾（D45，2026-11-18）改为按 FE**：未分组的分析表格不再分开发列表请求和总计请求，首页只发一个 FE 形状的 `$apply`：`filter(…)/search(…)/concat(aggregate(总计),groupby((键 + 可见的可分组列 + 技术属性 + 文本),aggregate(…))/orderby(…)/concat(aggregate($count as UI5__count),top(n)))`，行、总计和条数一起返回（core `buildAnalyticalRequests`）；`orderby` 只保留分组或聚合的属性（FE `getFilteredOrderby`，默认的日期排序因此不发）；后续页是普通列表请求，不带 `$count`；不可分组的列在行显示后按行补读。这个请求失败时表格显示错误、没有合计行（第 3.6 节"合计请求失败只在合计单元格显示'–'"对未分组的分析表格不再适用）。**分组的分析表格**仍按第 3.3 节和第 10 节：行走列表请求，小计按组另发 `$apply`，总计另发 `aggregate`；FE 是可折叠的层级（先只读折叠的组），按 FE 改在阶段 5（DV-apply-005、006）。FE 对照：`tests/e2e-fe/apply.spec.ts`（`apply-initial`、`apply-sort`、`apply-sort-amount`、`apply-filter`、`apply-search`、`apply-paging`、`apply-grouped`）。

### 3.1 小计和总计由服务端算

列表是分页续载的（例如 1616 行先加载 20 行）。在浏览器里累加只会得到已加载行的和，所以一律发 `$apply` 请求，由服务端按当前的筛选和搜索计算。没有声明 `Aggregation.ApplySupported` 的实体集不显示合计，分组照旧（只有组标题，没有小计和条数）。

### 3.2 按单位（币种）分开

> **D39 补记（2026-11-17）改为按 FE**：下面的原方案（单位进 `groupby`、单元格里每种单位一行）已废止，现行做法见第 10 节"多币种"。

原方案：度量带 `Measures.ISOCurrency` 或 `Measures.Unit` 时，单位字段加进 `groupby`，每种单位一个值，不能直接相加。例如总计：

```
$apply=filter(CompanyCode eq '1000')/groupby((Currency),aggregate(NetAmount with sum as NetAmount))
```

单元格里每种单位各占一行（"1,234,567.00 EUR / 89,000.00 USD"），按金额降序排列。只有一种单位时和普通单元格一样。

### 3.3 小计显示在组标题行上，只取已加载的组

组尾在续载时可能还没加载出来，组标题总在组的第一行，所以小计放在组标题行：标题文字占前几列，度量列下面对齐显示小计。

组可能很多（按供应商分组有几百组），所以小计只请求已加载行里出现过的组，续载出现新组时再补请求：

```
$apply=filter((CompanyCode eq '1000') and (Supplier in ('0000100001','0000100007')))
       /groupby((Supplier,Currency),aggregate(NetAmount with sum as NetAmount,ID with countdistinct as __count))
```

- 分组字段的文本（`Common.Text`）沿用 `buildAggregateRequest` 的做法一起 `groupby`，组标题显示"供应商：Pelulton Plastics B.V. (0000100001)（23）"。
- 条数用标准写法 `$count as smartkit_count`（实施时改的，见第 8 节）。
- 组值为空显示"–"，用 `eq null` 取它的小计。

### 3.4 合计哪些列

- 可合计的列 = 当前可见、字段在 `AggregatableProperties` 里的列。
- 默认合计哪些列来自 `UI.PresentationVariant/Total`；没有这个注解就不合计（不自动合计所有金额列）。
- 个性化对话框加一页"合计"：勾选要合计的列。两种表格都有这一页；"分组"页仍只在响应式表格里出现，下拉框只列 `GroupableProperties` 里的可见列（没有 `ApplySupported` 时仍列所有可排序的列，和现在一样）。
- 方法只用 `sum`。`AggregatablePropertyType` 里写了 `SupportedAggregationMethods` 并且不含 `sum` 的列不能合计。

### 3.5 网格表格的总计

用 AG Grid Community 的 `pinnedBottomRowData` 放一行总计，首列显示"合计"，度量列显示 3.2 的多单位值；多币种时按行数调整行高（`getRowHeight` 只作用于固定行）。不能选中，不能点进去。

### 3.6 何时刷新

合计请求和列表请求用同一份筛选、搜索、`refreshToken`；保存、删除、动作执行后列表刷新时一起刷新。合计请求失败只在合计单元格显示"–"并带提示，不影响明细行（阶段 4 收尾起只用于分组的分析表格；未分组时行和总计是同一个请求，失败时表格显示错误、没有合计行，见第 3 节开头）。

## 4. 各包改动

| 包 | 改动 |
| --- | --- |
| core / 模型 | 读取 `Aggregation.ApplySupported`（转换、可分组字段、可聚合字段和支持的方法），放进 `capabilitiesFor(...).aggregation`；`PresentationVariant` 增加 `total: string[]` |
| core / 请求 | 新增 `buildTotalsRequest(model, ui, { source, filters, search, groupBy?, groupValues?, measures })`：单位字段和分组文本自动加进 `groupby`，`groupValues` 生成 `in (…)`；条数用键 `countdistinct`。`buildAggregateRequest` 的公共部分抽出来共用 |
| core / 数据 | 内存数据提供者支持 `in` 和 `countdistinct`（服务端已支持，核对一致） |
| react | 新增 `useTotalsQuery`（React Query，按请求缓存）；`ResponsiveTable` 组标题行按列渲染小计、`<tfoot>` 总计行（吸底）；`SmartTable` 网格模式加固定底行；`TableP13nDialog` 加"合计"页；新增 props `totals`（受控）、`defaultTotals`；`VariantContent` 增加 `groupBy`、`totals` |
| 文案 | 中英文："合计"页、"合计"行标题、条数、合计加载失败 |
| 测试服务 | 采购 `PresentationVariant` 加 `Total`（净值）；准备同一公司多币种的数据（已有 EUR、USD） |
| 文档 | `01` LR-19、`02`（`Total`、`GroupBy`、`ApplySupported` 改为已做）、`03`、`05`（新请求）、`api.md`、ADR-031；随包的 Skill 和 `annotations.md` 加"分组和合计"一节 |

## 5. 分步

1. core：模型读注解、`buildTotalsRequest`、内存提供者；单元测试。先确认 fe-mockserver（`apps/mock`）对 `in`、`countdistinct`、单位 `groupby` 的结果和 smart-kit-server 一致，不一致就记下并在 e2e 里只用 smart-kit-server 验证该项。
2. react：总计（两种表格）和"合计"页、进视图。
3. react：响应式表格的组小计、条数、分组字段限制、分组进视图。
4. 测试服务注解和数据；e2e（mock 和 `e2e:pg` 各一套）；截图证据。
5. 文档、ADR-031、changeset（minor）。

每一步结束都跑 typecheck、lint、单元测试、build、size；第 4 步之后跑全部 e2e 和 `trace --strict`。

## 6. 风险

| 风险 | 处理 |
| --- | --- |
| 每次查询多一到两个请求 | 合计请求只在打开合计或分组时发；React Query 缓存；组小计只取已加载的组 |
| `in (…)` 的组很多时 URL 过长 | 每次最多 50 个组值，超过就分批 |
| 小计和明细不同步（两次请求之间数据变了） | 和 SAP 一样接受；刷新时一起刷新 |
| react 包体积（≤ 80 KB） | 新增代码不引入依赖，预计 2–3 KB；超了再拆子路径 |
| 别的 OData 服务不支持 `$apply` | 只看 `ApplySupported`，没声明就不显示合计 |

## 7. 验收条目

| 编号 | 条目 | 证据 |
| --- | --- | --- |
| GT-01 | 声明了 `ApplySupported` 时，个性化对话框有"合计"页，只列可聚合的可见列；没声明时没有这一页 | U、E |
| GT-02 | 两种表格：勾选净值后表尾出现"合计"行，值等于服务端按当前筛选、搜索算出的和，不随续载变化 | E、S |
| GT-03 | 多币种时合计按币种分行显示，不相加 | U、E、S |
| GT-04 | 响应式表格按状态分组时，组标题行显示组值文本、条数和该组净值小计，小计和服务端一致 | E、S |
| GT-05 | 续载出现新组时补取小计；每次请求只含已加载的组值，最多 50 个 | U、E |
| GT-06 | 分组下拉只列表格的列中属于 `GroupableProperties` 的（没有 `ApplySupported` 时是所有可排序的列） | U、E |
| GT-07 | `UI.PresentationVariant` 的 `GroupBy`、`Total` 作为默认值；分组和合计保存进视图并能恢复 | U、E |
| GT-08 | 筛选、搜索、保存、删除、动作后合计跟着刷新；合计请求失败时显示"–"和提示，明细照常 | E |
| GT-09 | 中英文文案、暗色主题、紧凑密度下显示正常；合计行有可读的无障碍名称 | E、S |
| GT-10 | 网格表格按供应商分组：组头行显示组值、条数和净值小计（与服务端一致），不能选中；点表头排序后分组字段仍排在最前；滚到底续载 | E、S |

U 单元测试，E 端到端，S 截图。

## 8. 实施时的调整（2026-11-17）

| 方案原文 | 实际 | 原因 |
| --- | --- | --- |
| 条数用"键 `countdistinct`"，不补 `$count as` | 用 `$count as smartkit_count`；smart-kit-server 的解析器和 SQL 支持了 `$count as`（`count(*)`），内存数据提供者也支持 | 核对 fe-mockserver 时发现它对字符串键做 `countdistinct` 返回的是拼接的字符串；`$count as` 是标准写法，两个服务端结果一致（一致性测试"group subtotals with $count"） |
| 组小计按位置每 50 个组值切一批 | 续载时只请求还没请求过的组，每批最多 50 个 | 按位置切时第一批会随续载变化、整批重取，已显示的小计会短暂消失 |
| `groupBy` / `totals` 受控 | 传了 `onGroupByChange` / `onTotalsChange` 就完全由父组件管理，值为 `undefined` 表示用注解默认值 | 切回"标准"视图时分组没有清掉（GT-07 发现） |
| 每组条数 | 只在能求小计时显示（有 `ApplySupported` 且分组字段可分组） | 条数也来自 `$apply` |

公开 API 新增：core 的 `buildTotalsRequest`、`collectTotals`、`canTotal`、`canGroup`、`canSubtotal`、`unitPathOf`、`groupKey`、`TOTAL_COUNT_ALIAS`、`MAX_GROUP_VALUES` 和类型 `AggregationModel`、`TotalsEntry`、`TotalAmount`、`TotalsRequestOptions`；`CapabilityModel.aggregation`；`PresentationModel.groupBy`、`total`；`VariantContent.groupBy`、`totals`。react：`SmartTable` 的 `groupBy`、`onGroupByChange`、`totals`、`onTotalsChange`、`presentation`；`TableP13nDialog` 的 `totalable`、`totals`；`ResponsiveTable` 的 `groupSummary`、`totals`。

## 9. 网格表格的分组（2026-11-17 补，讨论记录 D30）

invoice-assure 的工作清单要在网格表格里按供应商、到期日分组看小计（`25` S3）。AG Grid 的行分组只在 Enterprise 版，所以自己做：

- 分组时网格表格从无限行模型（`rowModelType: 'infinite'`）换成客户端行模型：行由 `useListQuery` 读，每次 100 行，滚到最后 20 行以内时读下一批。行模型在表格创建时定死，所以分组和不分组是两个实例（`key`）。
- 在每组第一行前插一行组头（数据 `{ $smartKitGroup: { key, display, first } }`）：第一列显示“分组列: 值 (条数)”，跨到第一个合计列；合计列显示组小计。组小计、条数和响应式表格一样来自 `useSubtotals`（只请求已加载的组，每批最多 50 个）。小计到达后刷新组头单元格和行高（多币种时行高增加）。
- 组头不能选中（`isRowSelectable`），没有行内动作和导航，双击、回车不打开。
- 排序仍由服务端做：点表头改的是请求的排序，分组字段总在最前；客户端行模型自己的排序被 `postSortRows` 还原成服务端的顺序。
- 分组时第一列不固定在左边：AG Grid 的跨列不能从固定区跨到滚动区。
- 不做：多级分组、折叠和展开、恢复返回时的滚动位置（不分组时照旧）。

## 10. D39 修订（2026-11-17）

阶段 3（P1-2）对照 FE 1.154 源码（`sap/fe/core/converters/controls/Common/Table.ts`：`updateTableVisualizationForType`、`getAggregateConditions`、`getP13nMode`；`converters/helpers/Aggregation.ts`：`isPropertyAggregatable`）后，用户决定按 FE 做（讨论记录 D39）：

| 项 | 修订前 | 修订后（= FE） |
| --- | --- | --- |
| 哪种表格有合计、小计 | 网格表格和响应式表格 | 只有分析表格：`Table` 的 `type="AnalyticalTable"`、`SmartListReport` 的 `tableType="AnalyticalTable"`，实体集要有 `Aggregation.ApplySupported` |
| 分组 | 响应式表格（带条数、小计）和网格表格（D30） | 分析表格：分组带条数和小计（网格）；响应式表格：只分组，组标题只有组值，没有条数和小计（FE `groupConditions`、个性化 "Group"）；网格表格（`GridTable`）不能分组。**阶段 4 收尾**：响应式表格的分组选项和排序选项相同（全部可排序属性，去掉 NonSortable 和 TextOnly 的属性，加上文本和 criticality 的技术属性，按字母序；FE 对比 `cols5-p13n-ResponsiveTable`），分析表格仍列 GroupableProperties |
| 个性化对话框 | 两种表格都有"合计"页 | "合计"页只在分析表格；"分组"页在分析表格和响应式表格 |
| 可合计的列 | `AggregatableProperties` 里的数值属性，方法含 sum；声明了 CustomAggregate 时只认它 | 只认 `Aggregation.CustomAggregate`（限定符 = 属性名）；没有 CustomAggregate 就不合计，去掉"数值属性按 sum"的退路 |
| 默认合计哪些列 | `UI.PresentationVariant/Total`；没有就不合计 | 有 `Total` 用它（空集合 = 不合计，模型的 `PresentationModel.hasTotal`）；没有 `Total` 时合计所有 CustomAggregate 的列（FE `getAggregateConditions`） |
| 请求 | `groupby((Currency),aggregate(M))`（CustomAggregate）或 `M with sum as M` | 按 FE：度量按名字、后面跟它的单位，总计 `filter(…)/aggregate(NetAmount,Currency)`，小计 `filter(…)/groupby((Supplier,供应商名称),aggregate(NetAmount,Currency,$count as smartkit_count))`；单位不再进 `groupby`。服务端对单位返回"所有行相同时的值，否则 null"。smart-kit-server 支持不带 `with` 的 `aggregate(M)`（同名属性求和，或 `SupportedAggregationMethods` 里不含 sum 时的第一个方法）和 CustomAggregate 的单位（`packages/server/docs/README.md`"Custom aggregates"）；测试服务（fe-mockserver）对单位属性也这样聚合（`apps/mock/server.mjs` 的补丁） |
| 多币种（D39 补记） | 每种币种一行，按金额降序 | 按 FE：单位为 null（多个币种）时单元格只显示链接"显示详细信息"/"Show Details"（sap.fe.macros `M_TABLE_SHOW_DETAILS`，FE `getMultiCurrencyLink`）；点开弹出框，标题"总计"/"小计"（sap.m `TABLE_MULTI_TOTAL_TITLE` / `TABLE_MULTI_GROUP_TITLE`），每个币种一行，按币种排序，打开时才请求：`filter(…[ and 组条件])/groupby((Currency),aggregate(NetAmount))&$orderby=Currency&$top=100`（与 FE 的请求一致）。只有一种币种时照常显示金额和币种 |
| 测试服务 | — | `apps/mock`、`apps/pg-server` 的采购订单都声明 `Aggregation.CustomAggregate#NetAmount` |
| 示例 | `/po`（网格）、`/po?table=responsive` 有合计 | 合计、小计用 `/po?table=analytical`；`/po`（网格）和 `/po?table=responsive` 没有合计 |

验收条目的变化（`tests/e2e/p5-totals.spec.ts`，内存服务和 `e2e:pg` 都跑）：

| 编号 | 修订后 |
| --- | --- |
| GT-01 | "合计"页只在分析表格出现，只列 CustomAggregate 的可见列；网格表格既没有"分组"页也没有"合计"页，不发 `$apply`；响应式表格只有"分组"页 |
| GT-02 | 合计行只在分析表格（`/po?table=analytical`）；响应式表格没有合计行、不发合计请求。**阶段 4 收尾**：分析表格的总计和行、条数在同一个 `$apply`（`concat`）里读，不再另发带 `$count` 的列表请求 |
| GT-03 | 多币种的总计和小计显示"显示详细信息"，弹出框里每个币种一行，金额与服务端一致；只有一种币种时直接显示（D39 补记，按 FE） |
| GT-04 | 响应式表格按状态分组：组标题只显示"状态: 值"，没有条数和小计，不发 `$apply`；条数和小计由 GT-10 在分析表格上验证。**阶段 4 收尾**：状态列只显示文本，分组选项里是它的文本属性，改按"Status Name"分组 |
| GT-05 | 改在分析表格（网格分组，滚动续载）上验证 |
| GT-06 | 响应式表格的分组选项只列可分组的可见列。**阶段 4 收尾**：按 FE 改为全部可排序属性（同排序选项，见上表"分组"一行） |
| GT-07 | 改在分析表格上验证（分组、合计存进视图并恢复） |
| GT-08 | 改在分析表格上验证。**阶段 4 收尾**：行和总计是同一个请求，请求失败时表格显示错误、没有合计行（原来是总计单元格显示"–"、行保留） |
| GT-09 | 只验证分析表格的合计行（中文、暗色、紧凑）；响应式表格没有合计行 |
| GT-10 | "网格表格按供应商分组"改为"分析表格按供应商分组"，内容不变 |

FE 对照：`tests/e2e-fe/totals.spec.ts`（场景 `po-analytical-totals`，FE `?app=purchasing-analytical` ↔ `/po?table=analytical`）：两边合计的列（净值）和个性化面板（列、排序、分组、合计）一致，都请求 `aggregate(NetAmount,Currency)`；多币种总计两边都显示"Show Details"，弹出框的标题、各币种金额和请求（`groupby((Currency),aggregate(NetAmount))&$orderby=Currency&$top=100`）一致。剩下的差别登记在 `tools/ui5-alignment/deviations.totals.json`：FE 的分析表格用一个 `$apply`（`concat`）同时取明细行和总计，smart-kit 总计单独发、明细走列表请求（DV-totals-001、002，阶段 4：明细行改由 `$apply` 读取是分析表格的数据绑定方式，范围大，留到阶段 4）。DV-totals-003（多币种显示）已按 D39 补记改掉并删除。**阶段 4 收尾**（D45）：未分组的分析表格已按 FE 用一个 `$apply`（`concat`）取行、总计和条数，DV-totals-001、002 删除；偏差登记已合并到 `tools/ui5-alignment/deviations.json`，分组的分析表格登记为 DV-apply-005、006（阶段 5），`$apply` 里的页大小 `top(144)` / `top(100)` 登记为 DV-apply-010（同 DV-FE-03）。

FE 根据注解自动选表格类型（`Table.ts` `getTableType`：`ApplySupported` 含全部 8 种转换时用 AnalyticalTable）是另一个函数，不在本次改动里，留给阶段 4（smart-kit 默认仍是网格表格）。阶段 4 已按注解自动选（`views4-table-type`）；阶段 4 收尾起分析表格只在 `ApplySupported/Transformations` 含 `search` 时有搜索框（FE Table 转换器）。

