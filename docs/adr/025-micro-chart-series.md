# ADR-025 导航集合上的微型图表：用 `$expand` 带 `$orderby`、`$top` 一起读

- **背景**：Line、Column、Area、Comparison、Stacked Bar 的数据来自 `UI.Chart` 所在实体的导航集合（`15` MC-65）。OData V4 的 Fiori Elements 给每个图单独绑定这个集合（每行一个请求，靠 `$batch` 合并）。本库不用 `$batch`（ADR-015），表格一块 100 行时，逐行请求不可接受。
- **决定**：
  - **表格和表单单元格**：在主请求里加 `$expand=导航($select=…;$orderby=维度;$top=N)`，一次取回所有行的序列。`$select` 只含图要的字段（键、度量、维度及其文本、单位、DataPoint 用到的路径，见 core 的 `chartSeriesSelect`）。同一导航上的多个图合并成一个 `$expand`。
  - **页头微图表 Facet**：沿用二期的做法，每个 Facet 单独查询父对象下的子集合（只有一个对象，请求数少）；`$select` 与单元格相同。
  - **N**：Comparison 最多 12 条（MC-41）；其他图最多 100 个点（`MICRO_CHART_MAX_POINTS`，防止过大的响应）。客户端再按 N 截一次，因为有的服务（包括测试服务 `fe-mockserver-core`）不支持 `$expand` 里的 `$top`。
  - **顺序**：按第一个维度升序（时间从左到右，MC-30、MC-35）。
  - 只支持一级集合导航；导航为单值时，图读的是那个对象的字段（按本行的图处理）。服务把导航列为 `NonExpandableProperties` 时不加 `$expand`，图显示"没有数据"。
- **理由**：一次请求、URL 形状可断言（与 ADR-015 一致）；`$expand` 的选项是 OData V4 标准（4.01 第 5.1.3 节），SAP RAP 和 Gateway 支持。
- **代价**：列表响应变大（每行最多 100 个点）；`$top` 不被支持时多传的数据由客户端丢弃。测试服务从实体集查询并展开集合时，先展开全部行再取 `$top`（2.8 万行约 34 秒），所以测试服务只在订单页的子表里放这种列（`LineItem#InOrder`）；真实的 OData 服务先分页再展开，没有这个问题。
- **状态**：采纳（2026-11-15，三期）。
