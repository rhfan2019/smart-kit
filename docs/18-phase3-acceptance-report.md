# 18 三期验收报告（微型图表）

> 状态：现行 · 2026-11-15。条目见 `17-phase3-acceptance.md`，规则见 `15-research-micro-chart.md`，讨论记录 D07～D10。代码未提交。

## 1. 范围

九种微型图表全部完成：Bullet、Radial、Harvey Ball、Column、Line、Area、Comparison、Stacked Bar 由 `UI.Chart` 注解驱动；Delta 与 SAP 一致不由注解驱动，只作展示组件（MC-64）。图可以放在对象页页头 Facet、表格单元格和表单单元格（`SmartField`）里。导航集合上的图在单元格里用 `$expand` 一次读回（ADR-025）。

## 2. 检查结果

| 检查 | 结果 |
| --- | --- |
| 类型检查 `npm run typecheck` | 通过 |
| lint（含令牌检查、商标检查）`npm run lint` | 通过 |
| 单元测试 `npm test` | 14 个文件、229 个测试全部通过 |
| 端到端测试 `npm run e2e` | 187 个全部通过（含三期 `p3-microcharts.spec.ts` 5 个） |
| 可追溯 `npm run trace -- --strict` | 一期 33/33、72/72；二期 143/143；三期 57/57（验收方式含 U 或 E 的条目全部有通过的测试） |
| 构建 `npm run build`、Storybook | 通过 |
| 体积 `npm run size`（gzip） | core 24.2 KB（预算 60 KB）、react 69.1 KB（预算 80 KB）；三期前为 22.9 KB、64.7 KB |

## 3. 与 SAP 官方示例的对比

方法：在内置浏览器打开 SAPUI5 1.154.0 Demo Kit 的 `sap.suite.ui.microchart` 示例，读取示例里渲染出的元素（位置、尺寸、颜色、字号、`aria-label`）并截图，与本库在 Storybook 和演示应用里的渲染逐项对比。差异按"以 SAP 为准"（D08）改掉，补成规则 MC-70～MC-78。

| 图 | SAP 示例里的样子 | 本库原来 | 修正后 | 规则 |
| --- | --- | --- | --- | --- |
| Bullet | 实际值标签在条上方、对齐实际值末端，语义色加粗；目标值标签在条下方、对齐目标线；阈值是穿过条的竖线；预测条与轨道同高 | 两个标签都在条上方两端；阈值是条上下的小刻度；预测条偏矮 | 与 SAP 相同 | MC-70 |
| Radial | 环粗约为直径的 15%；百分数常规字重 | 环偏细；百分数加粗 | 与 SAP 相同 | MC-71 |
| Harvey Ball | 扇形内缩；部分值语义色加粗、较大，总数正文色 | 部分值正文色；总数浅色 | 与 SAP 相同 | MC-72 |
| Comparison | 每根条后面有浅色轨道；数值用语义色；条 4～6 px | 没有轨道；数值正文色；条 8 px；最多 4 条 | 与 SAP 相同；最多 12 条 | MC-73、MC-41 |
| Area | 阈值区域实心语义色；实际值黑色实线、目标值点线；起止值语义色 | 二期没有 Area（画成折线） | 与 SAP 相同 | MC-74、MC-45～MC-49 |
| Delta | 值 1 细条、差值粗条、值 2 细条，带连接线；值条中性色；名称在左、数值在右 | 三根同样粗的条，差值在最下；值条蓝色 | 与 SAP 相同 | MC-75、MC-62 |
| Stacked Bar | 条细、直角，标签在段内 | 二期没有（画成 Comparison） | 与 SAP 相同 | MC-77、MC-58、MC-59 |
| Line | 首尾标签正文色；数据点 8 px | 底部标签浅色；数据点总是显示 | 标签正文色；数据点默认隐藏（MC-37），显示时 6 px | MC-78、MC-37 |
| 全部 | `aria-label` 带状态词（Good、Critical） | 没有状态词 | 文字说明带状态词（中英文） | MC-76 |
| 全部 | 填满容器；尺寸 64×18～320×94；放不下的标签隐藏 | 固定 160×56；标签会被截断 | 与 SAP 相同 | MC-02～MC-04 |

截图：`docs/16-evidence/story-*.png`（各尺寸、各主题）。

## 4. 页面里的效果

| 截图 | 内容 |
| --- | --- |
| `MC-02-order.png` | 订单页头：Bullet（预算使用，阈值和目标在 8M）、Radial |
| `MC-10.png` | 订单列表：表格单元格里的 Bullet，56 px 以下没有标签 |
| `MC-10-series.png` | 订单页"子项"表格：单元格里的 Line（导航集合，`$expand` 读取） |
| `MC-24-item.png`、`MC-series-item.png` | 子项页头：Harvey Ball、差值子弹图、Comparison、Column、Line、Area、Stacked Bar |
| `story-*.png` | Storybook：九种图在 320×94、200×72、140×40、64×18 下的样子；没有数据；三个主题的色板 |

## 5. 已知限制

- MC-01、MC-20、MC-50 是"什么时候用哪种图"的指引，写在 `15` 里，不能用测试证明。
- MC-41"同一表格列里的图条数相同"由应用的数据决定，本库只保证最多 12 条。
- SAP 规范里 Line 的"同一条线在阈值上下用两种颜色"是可选样式，没有注解驱动，本库没有做；用语义色的数据点代替。
- 测试服务（`fe-mockserver-core`）不支持 `$expand` 里的 `$top`，本库在客户端再截一次；它从实体集展开集合时先展开全部行再分页，很慢，所以"全部子项"列表不放 Line 列，只在订单页的子表里放（`LineItem#InOrder`，ADR-025）。
- 磁贴（tile）里的用法不在本库范围内（本库没有磁贴组件）。
