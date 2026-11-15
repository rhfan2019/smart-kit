# ADR-021 图表与微图表用 SVG 自己实现

- **背景**：[LR] 要求表格和图表可切换、图表随视图变化、可下钻；[OP] 要求七种微图表 Facet。可选的图表库（ECharts、Recharts 等）gzip 后都在 40 KB 以上，会超出包体积预算（AC-Q-02，react ≤ 80 KB）。
- **决定**：
  - 列表页图表只做柱状图和条形图（`UI.Chart` 的 `Column`、`Bar`），一个维度一个度量；数据用 `$apply=groupby((维度),aggregate(度量 with sum as 度量))` 由服务端聚合（`core` 的 `buildAggregateRequest`）。
  - 微图表 Facet：Bullet、Radial（`Donut`）、Harvey Ball（`Pie`）、Delta 用 DataPoint 的值、目标值和区间；Column、Line、Comparison（`Bar`）用集合导航的前 N 条。
  - 全部是内联 SVG，颜色从令牌读取（v5 第 6.7 节），带 `role="img"` 和文字说明。
- **理由**：满足规范列出的形态，体积小，主题一致。
- **代价**：功能远少于图表库（没有缩放、图例交互）；复杂图表由使用者用插槽换成自己的图表库。
- **状态**：采纳。
