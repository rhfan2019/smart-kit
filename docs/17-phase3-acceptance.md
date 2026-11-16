# 17 三期验收条目（微型图表）

> 状态：现行 · 2026-11-15。规则见 `15-research-micro-chart.md`，结果见 `18-phase3-acceptance-report.md`。
>
> 写法沿用 `13-phase2-acceptance.md`：每条一个编号（直接用 `15` 的规则编号 MC-xx），测试名称里带这个编号；`npm run trace -- --strict` 检查验收方式含 U 或 E 的条目都有**通过**的测试。
>
> 验收方式：U = 单元测试（`packages/*/test/phase3.test.ts`、`microcharts.test.tsx`、`charts.test.tsx`）；E = 端到端（`tests/e2e/p3-microcharts.spec.ts`，连 `apps/mock`）；S = 截图（`docs/16-evidence/`，`E2E_EVIDENCE=1` 时生成）；V = 与 SAPUI5 官方示例逐项对比（`15` 第 7 节、`18` 第 3 节）；D = 只是用法指引，写进文档，不能用测试证明。

| 编号 | 要求 | 出处 | 验收方式 |
| --- | --- | --- | --- |
| MC-01 | 用途：在很小的地方一眼看出状况或变化，不能交互分析。 | [MC] Usage | D |
| MC-02 | 响应式：图的大小完全由父容器决定，组件本身不设宽高。 | [MC] Responsiveness | U、E、S、V |
| MC-03 | 尺寸范围：宽 64～320 px，高 18～94 px（九种相同）。 | [MC] 各页 Maximum and Minimum Sizes | U、E、S、V |
| MC-04 | 数字永不截断：放不下就整个隐藏，不显示"12…"。 | [MC] Guidelines · Truncation；Area、Column 页 | U、V |
| MC-05 | 没有数据（页头和其他位置）：画一个和图同样大小的占位块，中间写"No data"（本地化）；不显示标签和提示；占位块可以用键盘聚焦，但不能点击。 | [MC] "No data" Text | U、V |
| MC-06 | 没有数据（表格单元格）：单元格留空。 | [MC] Guidelines · "No data" Text | U、V |
| MC-07 | 点击（可选）：唯一的交互是点击，可以开或关。 | [MC] Clicking | U、V |
| MC-08 | 颜色：只用两类颜色：语义色（好、警告、差、中性）和定性色板（无好坏含义时用，官方有 11 种色相）。 | [MC]；[FE] `getColorPaletteForMicroChart`；`06` 第 3 节 | U、E、S、V |
| MC-09 | 语义色从哪里来：DataPoint 有 `Criticality` 就用它；没有 `Criticality` 但有 `CriticalityCalculation`，就按改进方向（`Maximize`、`Minimi… | [FE] `calculateColorBinding` | U、V |
| MC-10 | 放进表格：九种都能放进表格单元格（网格表格、树形表格，含紧凑密度），用最小的一档，左对齐。 | [MC] 各页 Responsiveness | U、E、S、V |
| MC-11 | 无障碍：整个图是一张图片（`role="img"`），`aria-label` 是由数据生成的一句话（例如"销售额：实际 120 万，目标 150 万"），SVG 本身 `aria-hidden`。 | [API] 渲染器和 messagebundle；[OSS] `@microcharts/react`；二期已有 | U、V |
| MC-12 | 隐藏：度量字段被 `UI.Hidden` 隐藏时不画图（Bullet、Harvey Ball、Radial）。 | [FE] `isNotAlwaysHidden` | U、V |
| MC-13 | 数字格式：可见标签用短格式（例如"1.2K"），文字说明用完整格式。 | [FE] `getExpressionWithType(…, { style: 'short' })` | U、V |
| MC-20 | 用途：一个主要的值（例如年初至今的收入）和目标值、预测值比较，背景是好、中、差的区间。 | [MC] Bullet；总览 Comparison | D |
| MC-21 | 结构：实际值是一根横条；目标值是一根竖线（标记）；阈值是横条上下的小标记；实际值和目标值可以带标签。 | [MC] Bullet Intro | U、V |
| MC-22 | 颜色：实际值只用语义色（好、警告、差、中性）。 | [MC] Bullet | U、V |
| MC-23 | 预测值：在实际值后面画一根同色但更浅的横条。 | [MC] Bullet | U、V |
| MC-24 | 差值模式：只显示实际值和目标值的差，差值条从目标线开始或结束。 | [MC] Bullet；[FE] `showDeltaValue` | U、E、S、V |
| MC-25 | 阈值：来自 `CriticalityCalculation`。 | [FE] `getBulletMicroChartAggregations` | U、V |
| MC-26 | 刻度：`MinimumValue`、`MaximumValue` 给刻度的起止；没给时由值、目标、预测、阈值中的最小和最大决定（二期是 0 到最大值的 1.1 倍，三期改成包含全部值）。 | [FE]；[API] `minValue`、`maxValue` | U、V |
| MC-27 | 标签隐藏：高度小于 56 px 时隐藏全部标签。 | [MC] Bullet Sizes | U、E、S、V |
| MC-30 | 用途：比较一段时间或几个类别的多个值，强调值本身。 | [MC] Column | U、V |
| MC-31 | 标签：三种样式：①上方写首尾两根柱子的值，下方写起止日期（默认）；②每根柱子都有标签，只有柱子宽度不小于标签宽度时才用，否则自动退回①；③没有标签。 | [MC] Column | U、V |
| MC-32 | 标签隐藏：高度小于 72 px 时不显示每根柱子的标签，退回①；小于 56 px 时隐藏全部标签。 | [MC] Column Sizes | U、V |
| MC-33 | 颜色：强烈建议只用语义色；必须用定性色时，一张图只用一种颜色。 | [MC] Column Components；[FE] | U、V |
| MC-35 | 用途：看趋势或形状（迷你折线）。 | [MC] Line；[FE] `getLineMicroChartAggragations` | U、E、S、V |
| MC-36 | 标签：上方写首尾的值，下方写起止日期。 | [MC] Line Labels | U、V |
| MC-37 | 数据点：可以显示或隐藏，默认隐藏；显示时建议每张图 4（季度）到 12（月）个点；最小一档（表格）自动隐藏。 | [MC] Line Components；[API] `showPoints=false` | U、V |
| MC-38 | 焦点：可以突出个别点（例如第一个和最后一个），中性焦点是蓝色，有语义的用语义色。 | [MC] Focus points | U、V |
| MC-39 | 阈值线：可以画一条阈值线（默认 0），线上方和下方可以用两种语义色。 | [MC] Threshold；[FE] `showThresholdLine = false` | U、V |
| MC-40 | 颜色：默认蓝色（`--sk-chart-color`）；一条线时建议用语义色，多条线时每条线一种颜色。 | [MC] Line | U、V |
| MC-41 | 用途和条数：比较前 N 名，或没有顺序的几项。 | [MC] Comparison Guidelines | U、E、S、V |
| MC-42 | 两种布局：普通布局，标签在每根条的上方；宽度超过 192 px 时进入宽布局，类别名在左、值在右；宽度不超过 96 px 时隐藏标签。 | [MC] Comparison Sizes | U、V |
| MC-43 | 类别名和值：类别名取维度的 `Common.Text`，没有就取维度本身；值用短格式。 | [FE] `getComparisonMicroChartAggregations` | U、V |
| MC-45 | 用途：一段时间里实际值和目标值的趋势，和背景里的阈值区域比较。 | [MC] Area | U、E、S、V |
| MC-46 | 结构：实际值是实线，目标值是点线；阈值是背景上的彩色区域；没有阈值时背景透明，只有线。 | [MC] Area Components | U、V |
| MC-47 | 阈值区域：来自 `CriticalityCalculation`，按改进方向：`Maximize` 时，`DeviationRangeLowValue` 以下是差（红），`ToleranceRangeLowValue… | [FE] `getAreaMicroChartAggregations` | U、V |
| MC-48 | 标签：起止的值、起止的日期，可选最小值和最大值。 | [MC] Area Labels | U、V |
| MC-49 | 宽布局：标签放在图的左右两边。 | [MC] Area Guidelines | U、V |
| MC-50 | 用途：只显示一个百分比，圆环加中间的百分数。 | [MC] Radial | D |
| MC-51 | 数值：`TargetValue` 是总数，`Value` 是部分，显示 `Value / TargetValue` 的百分比；没有 `TargetValue` 时总数按 100，`Value` 本身就是百分比。 | [FE] `getRadialMicroChartProperties` | U、V |
| MC-52 | 颜色：`Criticality` 或 `CriticalityCalculation` 的语义色，否则中性色。 | [FE] `calculateColorBinding` | U、V |
| MC-53 | 标签位置：小于 S 档时百分数移到圆环右边；右边也放不下就不显示。 | [MC] Radial Components | U、V |
| MC-55 | 用途和数值：一个值占总数的多少，不是多块的饼图。 | [MC] Harvey Ball；[FE] `shouldRenderMicroChart` | U、E、S、V |
| MC-56 | 颜色：有 `Criticality` 时用语义色，否则用定性色板。 | [MC]；[FE] `getColorPaletteForMicroChart` | U、V |
| MC-57 | 标签：部分的值和总数（短格式）。 | [MC] Harvey Ball Components | U、V |
| MC-58 | 用途：在列表、表格或对象页页头里，把几个值叠成一根条，看各部分占整体多少。 | [MC] Stacked Bar | U、E、S、V |
| MC-59 | 两种刻度：设了最大值时，条的全长代表最大值（适合表格里各行比较，最大值取全表最大）；没设时全长代表 100%，每段显示百分比。 | [MC] Stacked Bar；[API] `precision=1`；[FE] `getStackMicroChartAggregations` | U、V |
| MC-60 | `UI.Chart` 的 `ChartType` 只认 OData V4 Fiori Elements 的八种，其他类型不画（第 3.1 节） | [FE] `MicroChart` | U、V |
| MC-61 | DataPoint 的 `ForecastValue`、`CriticalityCalculation`、`DeltaBulletChart`、`ValueFormat` 都解析并用到图上（第 3.2 节） | [FE] `MicroChartHelper` | U、V |
| MC-62 | 用途和结构：两个关键数字的差，可以是不同时间的，也可以是不同类别的。 | [MC] Delta | U、V |
| MC-63 | 标签隐藏：高度小于 56 px 时隐藏全部标签，但差值本身仍然显示；宽布局下标签放在左右两边，宽度不够时先隐藏数值，再隐藏日期标签。 | [MC] Delta Components | U、V |
| MC-64 | 不由注解驱动（D08 决定，与 SAP 一致）：OData V4 的 Fiori Elements 只认 8 种 `ChartType`，没有 Delta；V2 的 Smart 控件也说明 Delta 没有自己的 `… | [FE] `isValidChartType`；[SMC] | U、V |
| MC-65 | 导航集合上的图用 `$expand($select;$orderby;$top)` 一次读回（第 3.3 节、ADR-025） | [FE]、ADR-025 | U、E、S、V |
| MC-70 | Bullet：实际值标签在条的上方、对齐实际值的末端，用语义色加粗；目标值标签在条的下方、对齐目标线；预测条与背景轨道同高；阈值是穿过条的短竖线，用阈值的语义色；目标线比条高。 | [SMP] Bullet Micro Chart | U、V |
| MC-71 | Radial：环较粗（约为直径的 15%）；百分数在环中间，常规字重、比正文大一号。 | [SMP] Radial Micro Chart | V、S |
| MC-72 | Harvey Ball：扇形比背景圆略小（内缩）；部分值用语义色（或定性色）加粗、比正文大，总数用正文颜色。 | [SMP] Harvey Ball Micro Chart | U、V |
| MC-73 | Comparison：每根条后面有浅色轨道；数值标签用条的语义色；条很细（4～6 px）。 | [SMP] Comparison Micro Chart | U、V |
| MC-74 | Area：阈值区域是实心的语义色；实际值线用正文颜色实线，目标值线用点线；起止数值标签用该点的语义色，维度标签用正文颜色。 | [SMP] Area Micro Chart | U、V |
| MC-75 | Delta：从上到下是值 1 的细条、差值的粗条、值 2 的细条，两端有竖向连接线；值条用中性色，差值条用语义色；名称在左、数值在右。 | [SMP] Delta Micro Chart | U、V |
| MC-76 | 文字说明带语义状态词（例如"实际 1,200（好）"），颜色不是唯一的信息载体（WCAG 1.4.1）。 | [SMP] 各示例的 `aria-label` | U、V |
| MC-77 | Stacked Bar：条较细（本库上限 20 px）、直角；标签在段内，放不下就隐藏。 | [SMP] Stacked Bar Micro Chart | V、S |
| MC-78 | Line：首尾标签都用正文颜色；数据点约 6～8 px。 | [SMP] Line Micro Chart | V、S |
