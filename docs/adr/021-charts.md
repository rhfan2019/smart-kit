# ADR-021 图表与微图表用 SVG 自己实现

- **背景**：[LR] 要求表格和图表可切换、图表随视图变化、可下钻；[OP] 要求七种微图表 Facet。可选的图表库（ECharts、Recharts 等）gzip 后都在 40 KB 以上，会超出包体积预算（AC-Q-02，react ≤ 80 KB）。
- **决定**：
  - 列表页图表只做柱状图和条形图（`UI.Chart` 的 `Column`、`Bar`），一个维度一个度量；数据用 `$apply=groupby((维度),aggregate(度量 with sum as 度量))` 由服务端聚合（`core` 的 `buildAggregateRequest`）。
  - 微图表 Facet：Bullet、Radial（`Donut`）、Harvey Ball（`Pie`）、Delta 用 DataPoint 的值、目标值和区间；Column、Line、Comparison（`Bar`）用集合导航的前 N 条。
  - 全部是内联 SVG，颜色从令牌读取（v5 第 6.7 节），带 `role="img"` 和文字说明。
- **理由**：满足规范列出的形态，体积小，主题一致。
- **代价**：功能远少于图表库（没有缩放、图例交互）；复杂图表由使用者用插槽换成自己的图表库。
- **状态**：采纳；2026-11-15 部分被 `15-research-micro-chart.md` 修订（讨论记录 D08：与 SAP 官方不一致的以官方为准）：
  - 微图表改成九种，`ChartType` 只认 Fiori Elements 的八种（`Area` 是面积图、`BarStacked` 是堆叠条，不再画成折线和 Comparison）。
  - Delta 不再由 `Waterfall` 驱动，只作展示组件（MC-64）。
  - 不设固定尺寸，随父容器变化；数字不截断，放不下就隐藏（MC-02～MC-04）。
  - Comparison 最多 12 条（MC-41）；Harvey Ball 的总数是 `MaximumValue`（MC-55）。
  - 配色沿用三层令牌并随主题切换，新增定性色板（MC-08）。
  - Area、Stacked Bar 已实现；导航集合上的图在单元格里用 `$expand` 读取（ADR-025）；外观按 SAPUI5 示例对齐（`15` 第 7 节）。
