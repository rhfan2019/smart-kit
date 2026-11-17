# ADR-031 列表的分组、组小计和总计由服务端计算

- **背景**：列表页有筛选和排序，用户要求分组和小计（讨论记录 D28）。列表分页续载（例如 1616 行先加载 20 行），浏览器里累加只能得到已加载行的和。网格表格用的 AG Grid Community 没有行分组（ADR-002）。金额有多种币种。
- **决定**：
  - 小计和总计一律由服务端用 `$apply` 计算（core 的 `buildTotalsRequest`），条件与列表请求相同（筛选、搜索）。度量的单位或币种字段总是加进 `groupby`，每种单位一个值，不相加。
  - 能合计、能分组由 `Aggregation.ApplySupported` 决定：`AggregatableProperties`（含 `sum`）的数值列能合计；`GroupableProperties` 的列能分组。没有这个注解：不显示合计，分组照旧但没有小计。
  - 默认值来自 `UI.PresentationVariant`：`Total` 是默认合计的列，`GroupBy` 的第一个字段是响应式表格的默认分组。个性化对话框新增"合计"页；分组和合计都保存进视图（`VariantContent.groupBy`、`totals`）。
  - 响应式表格：组小计和条数放在组标题行（续载时组尾可能还没加载，组标题总在组的第一行）；只请求已加载的组，续载时只请求新出现的组，每次最多 50 个组值；表尾一行总计（吸底）。
  - 网格表格：只做总计，用 AG Grid Community 的底部固定行（`pinnedBottomRowData`），行高随币种数增加。不做分组。
  - 组内条数用标准的 `$count as 别名`；smart-kit-server 为此支持了 `$count as`。不用 `countdistinct`：fe-mockserver 对字符串字段算错。
- **理由**：结果和筛选一致、和已加载多少行无关；不引入 AG Grid Enterprise；与 SAP 按币种分别合计的做法一致。
- **代价**：开启合计或分组时，每次查询多一到几个请求；小计和明细是两次请求，期间数据变了会短暂不一致（刷新时一起刷新）；只支持单级分组和求和；导出不带小计和总计。
- **状态**：采纳，2026-11-17 实施（`23-grouping-totals-plan.md`，验收 GT-01～GT-09，结果见 `24-grouping-totals-report.md`）。
