# 15 微型图表（Micro Chart）规则清单

> 状态：**现行** · 2026-11-15 用户确认（讨论记录 D08、D09、D10）。与 SAP 官方不一致的一律以官方为准；配色沿用现有令牌体系；Delta 不由注解驱动。实现进度见第 6 节。
>
> 出处缩写：
> - **[MC]** SAP Fiori Design Guidelines v1.148《Micro Chart》总览页，以及九种图各自的页面（Area、Bullet、Column、Comparison、Delta、Harvey Ball、Line、Radial、Stacked Bar），2026-11-15 用内置浏览器通读。
> - **[API]** SAPUI5 1.154.0 `sap.suite.ui.microchart` 的 API 参考（各控件的属性默认值、文字资源、渲染方式）。
> - **[FE]** SAPUI5 1.154.0 `sap.fe.macros` 的 `MicroChart` 和 `MicroChartHelper`：OData V4 的 Fiori Elements 怎样把注解变成微型图表。只读来核对行为。SAPUI5 不是开源许可证，**不复制它的代码**。
> - **[SMC]** SAPUI5 1.154.0 `sap.ui.comp.smartmicrochart`（OData V2 的 Smart 微型图表）的说明，只用来对照。
> - **[OSS]** GitHub 上的开源实现，只借鉴做法：`@microcharts/react`（MIT，0.19.1，2026-09 发布，每个图都是 `img` 加一句由数据生成的文字说明）；`react-sparklines`（MIT，2017 年后没有更新，只作反例）。
> - **[ADR-021]** 二期的决定：自己用 SVG 画，不引入图表库。
> - **[SMP]** SAPUI5 1.154.0 Demo Kit 的微型图表示例（渲染结果），见第 7 节。
>
> 期次：本文的规则都是**三期**。"二期已有"表示 `MicroChart.tsx` 已经做了一部分，三期按本文核对、补齐。
>
> **优先级（D08，铁律）**：SAP 官方（[MC]，其次 [FE]、[API]）优先于本库二期的实现和文档。发现二期与官方不一致，改本库的代码和文档（ADR-021、`12-phase2-plan.md` 等），不改规则去迁就二期。
>
> 规则编号 MC-xx 供以后的验收标准引用。

## 0. 先说结论：二期的实现和规范差在哪里

| 项目 | 二期现状（`MicroChart.tsx`、`HeaderFacet.tsx`） | 规范 | 三期改成 |
| --- | --- | --- | --- |
| 种类 | 7 种；`Area` 画成折线，`BarStacked` 画成 Comparison | 9 种，各自独立（[MC]）；`Area` 是面积图，`BarStacked` 是 Stacked Bar（[FE]） | 补 Area、Stacked Bar；改正映射（MC-60） |
| 尺寸 | 固定 160×56（表格 96×24） | 填满父容器，没有固定宽高；范围 64×18 到 320×94（[MC]） | 随父容器变化，按实测高度隐藏标签（MC-02、MC-03） |
| 数字被截断 | 两端标签 `overflow: hidden`，可能截掉一半 | 数字不截断，放不下就隐藏；成对的标签一起隐藏（[MC]） | MC-04 |
| 没有数据 | 虚线框加"No data" | 页头：同尺寸的占位块加"No data"，可聚焦、不可点，无标签；表格单元格：留空（[MC]） | MC-05、MC-06 |
| Comparison 条数 | 最多 4 条 | 最多 12 条，至少 2 条；同一表格列条数相同（[MC]） | MC-41 |
| Bullet | 只有实际值和目标值 | 还有预测值、阈值标记、差值模式（[MC]、[FE]） | MC-21～MC-25 |
| Radial | 没有目标值就不画 | 没有 `TargetValue` 时总数按 100，`Value` 本身就是百分比（[FE]） | MC-51 |
| Harvey Ball | 总数优先用目标值 | 总数用 `MaximumValue`，没有就不画（[FE]） | MC-55 |
| Column、Line 的标签 | 两端只写维度或只写值 | 上方写首尾的值，下方写首尾的日期（[MC]） | MC-31、MC-36 |
| 颜色 | `Criticality` 或默认蓝色 | 还要支持 `CriticalityCalculation` 算出的语义色，以及无语义时的定性色板（[MC]、[FE]） | MC-08、MC-09；色板按现有三层令牌加，随主题切换 |
| Delta 的注解 | `ChartType` 为 `Waterfall` 时画 Delta（本库自定） | [FE] 不支持 Delta；`Waterfall` 不是微型图表类型 | 去掉这个约定，Delta 只作展示组件（MC-64） |
| 表格单元格 | 没有 | 九种都能放进表格，用最小尺寸，左对齐（[MC]） | MC-10 |

## 1. 通用规则（九种都适用）

| 编号 | 规则 | 出处 | 期次 |
| --- | --- | --- | --- |
| MC-01 | **用途**：在很小的地方一眼看出状况或变化，不能交互分析。要交互分析用图表视图（`ChartView`）；数据多也用图表视图。 | [MC] Usage | 三期 |
| MC-02 | **响应式**：图的大小完全由父容器决定，组件本身不设宽高。用 `ResizeObserver` 量出实际宽高，再决定显示哪些部分。官方的 L、M、S、XS 四档只是"响应式在某个尺寸下的样子"，不作为组件参数。 | [MC] Responsiveness | 三期 |
| MC-03 | **尺寸范围**：宽 64～320 px，高 18～94 px（九种相同）。父容器超出时，图不再变大，在容器里靠左；小于下限时按下限画，不再缩。 | [MC] 各页 Maximum and Minimum Sizes | 三期 |
| MC-04 | **数字永不截断**：放不下就整个隐藏，不显示"12…"。成对的标签（起点和终点、最小值和最大值）有一个放不下，两个都隐藏。文字标签（类别名）可以截断，但要能看到全称（用 `title`）。 | [MC] Guidelines · Truncation；Area、Column 页 | 三期 |
| MC-05 | **没有数据（页头和其他位置）**：画一个和图同样大小的占位块，中间写"No data"（本地化）；不显示标签和提示；占位块可以用键盘聚焦，但不能点击。 | [MC] "No data" Text | 三期 |
| MC-06 | **没有数据（表格单元格）**：单元格留空。页头微图表 Facet 没有数据时，页脚（单位）也一起去掉。 | [MC] Guidelines · "No data" Text | 三期 |
| MC-07 | **点击（可选）**：唯一的交互是点击，可以开或关。开了以后整个图是一个按钮（Enter、Space、点击）。二期已有：页头 Facet 点击后弹出大图。 | [MC] Clicking | 二期已有，三期核对 |
| MC-08 | **颜色**：只用两类颜色：语义色（好、警告、差、中性）和定性色板（无好坏含义时用，官方有 11 种色相）。**配色必须走现有的三层令牌体系，并随主题切换（铁律，D08）**：<br>• 原始值层：现有色阶不够 11 种色相，缺的色相按现有命名加色阶（例如 `--sk-teal-*`），只在这一层写颜色值。<br>• 语义层：每个主题（`yellow`、`navy`、`dark`，以及使用者自定义的主题）各定义一套 `--sk-color-chart-1` ～ `--sk-color-chart-11`，引用原始值；语义色直接用已有的 `--sk-color-positive`、`-critical`、`-negative`、`-neutral`。<br>• 组件层：`--sk-chart-palette-1` ～ `--sk-chart-palette-11` 引用语义层，作为局部微调入口；预测条、阈值区域这类浅色用已有的 `-wash` 令牌。<br>• 组件代码只引用组件层或语义层，不写颜色值；换主题（`data-theme`）或局部嵌套主题时图表颜色跟着变。每套色板在各自主题背景上的对比度至少 3:1（图形元素的无障碍要求）。写进 `06-extension-and-theming.md` 第 3 节。 | [MC]；[FE] `getColorPaletteForMicroChart`；`06` 第 3 节 | 三期 |
| MC-09 | **语义色从哪里来**：DataPoint 有 `Criticality` 就用它；没有 `Criticality` 但有 `CriticalityCalculation`，就按改进方向（`Maximize`、`Minimize`、`Target`）和各个区间值（`DeviationRange*`、`ToleranceRange*`、`AcceptanceRange*`）算出语义色；两样都没有就用中性色。算法放在 core，单元格、Facet、关键值共用。 | [FE] `calculateColorBinding` | 三期 |
| MC-10 | **放进表格**：九种都能放进表格单元格（网格表格、树形表格，含紧凑密度），用最小的一档，左对齐。列标题要说明图表的含义。 | [MC] 各页 Responsiveness | 三期 |
| MC-11 | **无障碍**：整个图是一张图片（`role="img"`），`aria-label` 是由数据生成的一句话（例如"销售额：实际 120 万，目标 150 万"），SVG 本身 `aria-hidden`。可点击时是按钮，说明文字放在按钮内容里。说明文字的格式参照 [API] 的文字资源（Actual、Target、Forecast、Threshold、Delta）。SAPUI5 用的是 `role="figure"`，我们沿用二期的 `img`，因为图里没有可单独读的子元素。 | [API] 渲染器和 messagebundle；[OSS] `@microcharts/react`；二期已有 | 二期已有，三期补齐新增的内容 |
| MC-12 | **隐藏**：度量字段被 `UI.Hidden` 隐藏时不画图（Bullet、Harvey Ball、Radial）。 | [FE] `isNotAlwaysHidden` | 三期 |
| MC-13 | **数字格式**：可见标签用短格式（例如"1.2K"），文字说明用完整格式。小数位按字段的 `Scale` 或 DataPoint 的 `ValueFormat.NumberOfFractionalDigits`。 | [FE] `getExpressionWithType(…, { style: 'short' })` | 三期 |

## 2. 各种图

### 2.1 Bullet（子弹图）

| 编号 | 规则 | 出处 | 期次 |
| --- | --- | --- | --- |
| MC-20 | **用途**：一个主要的值（例如年初至今的收入）和目标值、预测值比较，背景是好、中、差的区间。只表示某个时点，**不用来画时间序列**。 | [MC] Bullet；总览 Comparison | 三期 |
| MC-21 | **结构**：实际值是一根横条；目标值是一根竖线（标记）；阈值是横条上下的小标记；实际值和目标值可以带标签。 | [MC] Bullet Intro | 二期有横条和目标线，三期补阈值和标签规则 |
| MC-22 | **颜色**：实际值只用语义色（好、警告、差、中性）。 | [MC] Bullet | 三期 |
| MC-23 | **预测值**：在实际值后面画一根同色但更浅的横条。 | [MC] Bullet | 三期 |
| MC-24 | **差值模式**：只显示实际值和目标值的差，差值条从目标线开始或结束。由 DataPoint 的 `Visualization` 为 `DeltaBulletChart` 打开。 | [MC] Bullet；[FE] `showDeltaValue` | 三期 |
| MC-25 | **阈值**：来自 `CriticalityCalculation`。方向不是 `Minimize` 时画 `DeviationRangeLowValue`（差）和 `ToleranceRangeLowValue`（警告）；方向不是 `Maximize` 时画 `ToleranceRangeHighValue`（警告）和 `DeviationRangeHighValue`（差）。 | [FE] `getBulletMicroChartAggregations` | 三期 |
| MC-26 | **刻度**：`MinimumValue`、`MaximumValue` 给刻度的起止；没给时由值、目标、预测、阈值中的最小和最大决定（二期是 0 到最大值的 1.1 倍，三期改成包含全部值）。 | [FE]；[API] `minValue`、`maxValue` | 二期已有，三期改 |
| MC-27 | **标签隐藏**：高度小于 56 px 时隐藏全部标签。 | [MC] Bullet Sizes | 三期 |

### 2.2 Column（柱状图）

| 编号 | 规则 | 出处 | 期次 |
| --- | --- | --- | --- |
| MC-30 | **用途**：比较一段时间或几个类别的多个值，强调值本身。柱子可以是正数或负数。 | [MC] Column | 二期已有 |
| MC-31 | **标签**：三种样式：①上方写首尾两根柱子的值，下方写起止日期（默认）；②每根柱子都有标签，只有柱子宽度不小于标签宽度时才用，否则自动退回①；③没有标签。 | [MC] Column | 三期 |
| MC-32 | **标签隐藏**：高度小于 72 px 时不显示每根柱子的标签，退回①；小于 56 px 时隐藏全部标签。 | [MC] Column Sizes | 三期 |
| MC-33 | **颜色**：强烈建议只用语义色；必须用定性色时，一张图只用一种颜色。每根柱子的语义色来自 DataPoint 的 `Criticality`（每行一个值）或 `CriticalityCalculation`。 | [MC] Column Components；[FE] | 二期有 `Criticality`，三期补 `CriticalityCalculation` |

### 2.3 Line（折线图）

| 编号 | 规则 | 出处 | 期次 |
| --- | --- | --- | --- |
| MC-35 | **用途**：看趋势或形状（迷你折线）。不用于不是时间段的场景。最多 3 条线，建议 1 条；每个度量一条线（`Measures` 里有几个就画几条）。 | [MC] Line；[FE] `getLineMicroChartAggragations` | 三期（二期只有 1 条） |
| MC-36 | **标签**：上方写首尾的值，下方写起止日期。多条线时，起点写所有线中最小的值，终点写最大的值。高度小于 56 px 时隐藏。 | [MC] Line Labels | 三期 |
| MC-37 | **数据点**：可以显示或隐藏，默认隐藏；显示时建议每张图 4（季度）到 12（月）个点；最小一档（表格）自动隐藏。 | [MC] Line Components；[API] `showPoints=false` | 二期总是显示，三期改成默认隐藏 |
| MC-38 | **焦点**：可以突出个别点（例如第一个和最后一个），中性焦点是蓝色，有语义的用语义色。最小一档自动隐藏。 | [MC] Focus points | 三期 |
| MC-39 | **阈值线**：可以画一条阈值线（默认 0），线上方和下方可以用两种语义色。阈值不是 0 时，标题或列标题要写明阈值（例如"高于 50"）。阈值标签占父容器一半以上宽度时隐藏。FE 从注解生成时不画阈值线。 | [MC] Threshold；[FE] `showThresholdLine = false` | 三期 |
| MC-40 | **颜色**：默认蓝色（`--sk-chart-color`）；一条线时建议用语义色，多条线时每条线一种颜色。表格里要让各行可比时，用统一的刻度（"手动刻度"）。 | [MC] Line | 三期 |

### 2.4 Comparison（对比条形图）

| 编号 | 规则 | 出处 | 期次 |
| --- | --- | --- | --- |
| MC-41 | **用途和条数**：比较前 N 名，或没有顺序的几项。最多 12 条，至少 2 条。同一个表格列里所有图的条数相同，否则会误导；列标题要说明图表。 | [MC] Comparison Guidelines | 二期最多 4 条，三期改 |
| MC-42 | **两种布局**：普通布局，标签在每根条的上方；宽度超过 192 px 时进入宽布局，类别名在左、值在右；宽度不超过 96 px 时隐藏标签。 | [MC] Comparison Sizes | 二期只有宽布局，三期改 |
| MC-43 | **类别名和值**：类别名取维度的 `Common.Text`，没有就取维度本身；值用短格式。颜色是每条的 `Criticality`，或定性色。刻度用 `MinimumValue`、`MaximumValue`。 | [FE] `getComparisonMicroChartAggregations` | 三期 |

### 2.5 Area（面积图）

| 编号 | 规则 | 出处 | 期次 |
| --- | --- | --- | --- |
| MC-45 | **用途**：一段时间里实际值和目标值的趋势，和背景里的阈值区域比较。不用于不比较时间的场景。 | [MC] Area | 三期（新增） |
| MC-46 | **结构**：实际值是实线，目标值是点线；阈值是背景上的彩色区域；没有阈值时背景透明，只有线。 | [MC] Area Components | 三期 |
| MC-47 | **阈值区域**：来自 `CriticalityCalculation`，按改进方向：`Maximize` 时，`DeviationRangeLowValue` 以下是差（红），`ToleranceRangeLowValue` 以上是好；`Minimize` 时，`ToleranceRangeHighValue` 以下是好，`DeviationRangeHighValue` 以上是差；`Target` 时，两端的 `DeviationRange` 外是差，`ToleranceRange` 之间是好。区间值可以是每个点各自的字段（随时间变化）。 | [FE] `getAreaMicroChartAggregations` | 三期 |
| MC-48 | **标签**：起止的值、起止的日期，可选最小值和最大值。只有起止标签时各占一半宽度；有最小、最大标签时各占三分之一。成对的标签一起隐藏。高度小于 56 px（普通布局）或 36 px（宽布局）时隐藏全部标签。 | [MC] Area Labels | 三期 |
| MC-49 | **宽布局**：标签放在图的左右两边。只在宽度不小于高度时用宽布局，否则用普通布局。 | [MC] Area Guidelines | 三期 |

### 2.6 Radial（环形百分比）

| 编号 | 规则 | 出处 | 期次 |
| --- | --- | --- | --- |
| MC-50 | **用途**：只显示一个百分比，圆环加中间的百分数。要显示具体数值（不是百分比）或要比较两个以上的值，用进度条。 | [MC] Radial | 二期已有 |
| MC-51 | **数值**：`TargetValue` 是总数，`Value` 是部分，显示 `Value / TargetValue` 的百分比；没有 `TargetValue` 时总数按 100，`Value` 本身就是百分比。不显示单位。 | [FE] `getRadialMicroChartProperties` | 三期改 |
| MC-52 | **颜色**：`Criticality` 或 `CriticalityCalculation` 的语义色，否则中性色。 | [FE] `calculateColorBinding` | 三期补 `CriticalityCalculation` |
| MC-53 | **标签位置**：小于 S 档时百分数移到圆环右边；右边也放不下就不显示。高度小于 56 px 时只留百分数。 | [MC] Radial Components | 二期已有，三期改成按实测尺寸 |

### 2.7 Harvey Ball（饼块）

| 编号 | 规则 | 出处 | 期次 |
| --- | --- | --- | --- |
| MC-55 | **用途和数值**：一个值占总数的多少，不是多块的饼图。部分是 `Value`，总数是 `MaximumValue`；**没有 `MaximumValue` 就不画**。 | [MC] Harvey Ball；[FE] `shouldRenderMicroChart` | 三期改 |
| MC-56 | **颜色**：有 `Criticality` 时用语义色，否则用定性色板。 | [MC]；[FE] `getColorPaletteForMicroChart` | 三期 |
| MC-57 | **标签**：部分的值和总数（短格式）。图随容器高度变大或变小；小于 S 档时只留饼块和部分的值；放不下值就不显示。 | [MC] Harvey Ball Components | 二期已有，三期改成按实测尺寸 |

### 2.8 Stacked Bar（堆叠条）

| 编号 | 规则 | 出处 | 期次 |
| --- | --- | --- | --- |
| MC-58 | **用途**：在列表、表格或对象页页头里，把几个值叠成一根条，看各部分占整体多少。不支持负数。不用于磁贴。 | [MC] Stacked Bar | 三期（新增） |
| MC-59 | **两种刻度**：设了最大值时，条的全长代表最大值（适合表格里各行比较，最大值取全表最大）；没设时全长代表 100%，每段显示百分比。百分比默认 1 位小数。每段的标签默认是百分比，也可以显示绝对值（`Common.Text`）或不显示；标签放不下就隐藏，最小高度时不显示标签。颜色用语义色或定性色板；**没有图例**，所以强烈建议用语义色并写清楚标题。 | [MC] Stacked Bar；[API] `precision=1`；[FE] `getStackMicroChartAggregations` | 三期 |

### 2.9 Delta（差值图）

| 编号 | 规则 | 出处 | 期次 |
| --- | --- | --- | --- |
| MC-62 | **用途和结构**：两个关键数字的差，可以是不同时间的，也可以是不同类别的。三根条：值 1、值 2、差值；差值可正可负，颜色由阈值决定（语义色）。左边的标签（两个值的名称或日期）可以省略，右边的数值标签总是显示。 | [MC] Delta | 二期已有 |
| MC-63 | **标签隐藏**：高度小于 56 px 时隐藏全部标签，但差值本身仍然显示；宽布局下标签放在左右两边，宽度不够时先隐藏数值，再隐藏日期标签。 | [MC] Delta Components | 三期 |
| MC-64 | **不由注解驱动（D08 决定，与 SAP 一致）**：OData V4 的 Fiori Elements 只认 8 种 `ChartType`，没有 Delta；V2 的 Smart 控件也说明 Delta 没有自己的 `ChartType`。所以：<br>• Delta 只作为展示组件导出（`MicroChart` 的 `kind="delta"`），开发者在扩展点或自定义 Facet 里自己传两个值。<br>• 去掉二期的 `Waterfall` → Delta 约定；模拟服务 `apps/mock/Csdl/purchasing.template.xml` 里的 `Waterfall` 注解改成标准写法。<br>• 想用注解表达"实际与目标之差"，用标准的 Bullet 差值模式（DataPoint 的 `Visualization` 为 `DeltaBulletChart`，MC-24）。 | [FE] `isValidChartType`；[SMC] | 三期 |

## 3. 注解映射

### 3.1 ChartType 对应哪种图（MC-60）

只用 [FE] 认可的 8 种。其他 `ChartType`（包括 `Waterfall`）不画微型图表，开发模式下在控制台给出警告（与 [FE] 的 `logWarning` 一致）：

| `UI.Chart` 的 `ChartType` | 图 | 数据来自 | 必需的注解 |
| --- | --- | --- | --- |
| `Bullet` | Bullet | 本行 | `Measures[0]`，`MeasureAttributes[0].DataPoint`（`Value`） |
| `Donut` | Radial | 本行 | 同上 |
| `Pie` | Harvey Ball | 本行 | 同上，加 DataPoint 的 `MaximumValue` |
| `Column` | Column | 导航集合，每行一根柱 | 同上，加 `Dimensions[0]` |
| `Line` | Line | 导航集合，每行一个点 | 每个 `Measures[i]` 对应 `MeasureAttributes[i].DataPoint`，加 `Dimensions[0]` |
| `Area` | Area | 导航集合，每行一个点 | DataPoint（`Value`、`TargetValue`、`CriticalityCalculation`），加 `Dimensions[0]` |
| `Bar` | Comparison | 导航集合，每行一根条 | DataPoint，加 `Dimensions[0]` |
| `BarStacked` | Stacked Bar | 导航集合，每行一段 | DataPoint |

二期还认 `VerticalBullet`、`ColumnStacked`、`Waterfall`、`HorizontalWaterfall`，三期去掉（D08：以 SAP 为准）；`Area` 和 `BarStacked` 改成各自的图。

### 3.2 DataPoint 的各个属性用在哪里（MC-61）

| 属性 | 用在 | 说明 |
| --- | --- | --- |
| `Value` | 全部 | 主值 |
| `TargetValue` | Bullet（目标线）、Radial（总数，没有时按 100）、Area（目标线，每个点一个值） | |
| `ForecastValue` | Bullet（预测条） | 三期新增解析 |
| `MinimumValue`、`MaximumValue` | Bullet、Comparison（刻度）；Harvey Ball（`MaximumValue` 是总数） | 二期已解析 |
| `Criticality` | 全部（语义色） | 二期已解析 |
| `CriticalityCalculation` | Bullet（阈值和颜色）、Area（阈值区域）、Column、Radial（颜色） | 三期新增解析：`ImprovementDirection` 和六个区间值，每个值可以是常数或路径 |
| `Visualization` = `DeltaBulletChart` | Bullet 的差值模式 | 三期新增 |
| `ValueFormat` | 数字格式 | 三期新增 |

### 3.3 集合数据怎样取（MC-65）

Column、Line、Area、Comparison、Stacked Bar 的数据来自 `UI.Chart` 所在实体的导航集合（例如订单的 `ItemHistory`）。[FE] 对每个图单独绑定这个集合，只 `$select` 需要的字段（度量、维度、维度的 `Common.Text`、单位、`Criticality` 或区间值的路径、目标值），排序用 `PresentationVariant` 的 `SortOrder`。

- **页头**：二期已经这样取，一个 Facet 一次请求（`top` 12 或 4），三期补齐要选的字段、把 Comparison 的条数改成 12。
- **表格单元格**：每行一次请求不可接受。打算在表格的主请求里用 `$expand=导航($select=…;$orderby=…;$top=N)` 一起取回。要先核对 `query-shapes.md` 和模拟服务是否支持 `$expand` 里带 `$orderby`、`$top`，再写一条 ADR。

## 4. 实现方式（经确认后开工）

1. **纯展示组件**（`@rhfan2019/smart-kit`）：在二期的 `MicroChart.tsx` 上扩展，不重写。参数是数值和点，不认识注解。不引入图表库；颜色从 CSS 令牌取；`ResizeObserver` 量尺寸；`role="img"` 加文字说明。名字不含商标词（`scripts/check-trademark.mjs`）。
2. **core**：`ChartModel` 补 `CriticalityCalculation`、`ForecastValue`、`Visualization`、多个度量；新增语义色计算（MC-09）。
3. **接入**：`SmartField`（`DataFieldForAnnotation` 指向 `UI.Chart`）、`SmartTable` 的列、`HeaderFacet`。
4. **顺序**：Bullet、Radial、Harvey Ball（只用本行字段）→ Line、Column、Area、Comparison、Stacked Bar（要导航集合，先做 MC-65 的核对和 ADR）→ Delta（只核对展示组件，去掉 `Waterfall` 约定）。
5. **体积**：react 包现在 64.7 KB（预算 80 KB，gzip），新增部分控制在 10 KB 以内。每步跑 `npm run build && npm run size`。
6. **测试**：每条 MC 规则有单元测试（测试名带编号）；Storybook 每种图一组故事，包括各尺寸、没有数据、暗色主题；模拟服务用 `ItemHistory` 造序列数据。

## 5. 已决定（D08，2026-11-15）

1. **以 SAP 为准**：二期与官方不一致的地方（尺寸、数字截断、`Area` 和 `BarStacked` 的映射、Comparison 条数、没有数据的显示）都按官方改，并修正本库文档。
2. **配色**：沿用现有三层令牌体系，随主题切换，见 MC-08。
3. **Delta**：与 SAP 一致，不由注解驱动，只作展示组件，见 MC-64。
4. **二期多认的 `ChartType`**（`VerticalBullet`、`ColumnStacked`、`Waterfall`、`HorizontalWaterfall`）：去掉，见第 3.1 节。

## 6. 实现进度

### 6.1 第一步：只用本行字段的图（2026-11-15 完成，未提交）

| 规则 | 状态 | 测试 |
| --- | --- | --- |
| MC-02、MC-03 随容器变化、尺寸上下限 | 完成：组件不设宽高，`ResizeObserver` 量实际大小；页头 Facet 给 160×72，表格单元格给行高减内边距 | `microcharts.test.tsx`、`p3-microcharts.spec.ts` |
| MC-04 数字不截断，放不下就隐藏，成对一起隐藏 | 完成（全部九种的数字标签） | `microcharts.test.tsx` |
| MC-05、MC-06 没有数据 | 完成：占位块可聚焦、不可点；表格单元格留空；页头去掉页脚 | `microcharts.test.tsx` |
| MC-08 定性色板，随主题切换 | 完成：三层令牌，三个主题各一套 11 色，对比度均 ≥ 3:1 | `microcharts.test.tsx`、`p3-microcharts.spec.ts` |
| MC-09 `CriticalityCalculation` 算语义色 | 完成：core 的 `calculateCriticality` | `phase3.test.ts` |
| MC-10 表格和表单单元格里的微型图表 | 完成（本行的图）；导航集合的图见 6.2 | `microcharts.test.tsx`、`p3-microcharts.spec.ts` |
| MC-12 度量隐藏时不画 | 完成 | — |
| MC-13 可见标签用短格式（"6.7M"），文字说明用完整数字 | 完成 | `microcharts.test.tsx` |
| MC-20～MC-27 Bullet | 完成：预测条、阈值标记、差值模式、刻度、56 px 以下无标签 | `microcharts.test.tsx`、`p3-microcharts.spec.ts` |
| MC-50～MC-53 Radial | 完成：无目标值时值即百分比；小尺寸时百分数移到右边；页脚不显示单位 | 同上 |
| MC-55～MC-57 Harvey Ball | 完成：总数用 `MaximumValue`；无语义时用定性色 | 同上 |
| MC-60 `ChartType` 映射 | 完成：只认八种；`Waterfall` 等不再画；`Area`、`BarStacked` 暂时不画（等 6.2，不再画成错的图） | `microcharts.test.tsx` |
| MC-61 DataPoint 新属性 | 完成：`ForecastValue`、`CriticalityCalculation`、`DeltaBulletChart`、`ValueFormat` | `phase3.test.ts` |
| MC-64 Delta 不由注解驱动 | 完成：模拟服务的 `Waterfall` 改成差值子弹图 | `p2-object.spec.ts`、`p3-microcharts.spec.ts` |

顺带修正：注解里的 `Decimal` 常量（例如 `MinimumValue Decimal="0"`）以前被忽略。

截图：`docs/16-evidence/`（`MC-02-order.png`、`MC-10.png`、`MC-24-item.png`）。

### 6.2 第二步：要导航集合数据的图（2026-11-15 完成，未提交）

| 规则 | 状态 | 测试 |
| --- | --- | --- |
| MC-30～MC-33 Column | 完成：默认中性色；上方首尾值、下方首尾维度值；可选每柱标签（72 px 以上且柱子够宽，否则退回首尾） | `charts.test.tsx`、`microcharts.test.tsx` |
| MC-35～MC-40 Line | 完成：每个度量一条线（最多 3 条，定性色）；多条线时起点取最小首值、终点取最大末值；数据点默认隐藏，语义点和焦点显示；阈值线和阈值标签；固定刻度（`scaleMin`、`scaleMax`）；只有一个点时画成点 | 同上 |
| MC-41～MC-43 Comparison | 完成：最多 12 条；宽于 192 px 两侧标签、96～192 px 标签在条上方、不超过 96 px 无标签；名称取维度的 `Common.Text`；`MinimumValue`、`MaximumValue` 定刻度 | 同上 |
| MC-45～MC-49 Area | 完成：实际值实线、目标值点线；阈值区域按改进方向；起止值、起止维度标签；可选最小最大标签；宽布局 | 同上 |
| MC-58、MC-59 Stacked Bar | 完成：不支持负数；无最大值时按合计 100%，有最大值时按最大值；百分比 1 位小数；`Common.Text` 作段标签；无语义时用定性色 | 同上 |
| MC-62、MC-63 Delta | 完成（只作展示组件）：名称在左、数值在右、差值在中间；56 px 以下只留差值 | 同上 |
| MC-65 请求形状 | 完成：表格和表单单元格用 `$expand($select;$orderby;$top)`，页头 Facet 单独查询，`$select` 相同（ADR-025） | `phase3.test.ts`、`p3-microcharts.spec.ts` |

模拟服务新增：子项页头的 Area（`ItemHistoryArea`）和 Stacked Bar（`ItemConditionShare`）；订单页"子项"表格加一列 Line（`_History/@UI.Chart#Quantities`）。

## 7. 外观细节：对照 SAPUI5 官方示例（D10）

2026-11-15 用内置浏览器打开 SAPUI5 1.154.0 Demo Kit 的九种微型图表示例，读取示例页面里渲染出的元素（位置、尺寸、颜色、字号）和截图，与本库逐项对比。规范文字没写、示例里能看到的外观，按"以 SAP 为准"补成下面的规则；差异已全部改掉。

| 编号 | 规则 | 出处 | 期次 |
| --- | --- | --- | --- |
| MC-70 | Bullet：实际值标签在条的上方、对齐实际值的末端，用语义色加粗；目标值标签在条的下方、对齐目标线；预测条与背景轨道同高；阈值是穿过条的短竖线，用阈值的语义色；目标线比条高。 | [SMP] Bullet Micro Chart | 三期 |
| MC-71 | Radial：环较粗（约为直径的 15%）；百分数在环中间，常规字重、比正文大一号。 | [SMP] Radial Micro Chart | 三期 |
| MC-72 | Harvey Ball：扇形比背景圆略小（内缩）；部分值用语义色（或定性色）加粗、比正文大，总数用正文颜色。 | [SMP] Harvey Ball Micro Chart | 三期 |
| MC-73 | Comparison：每根条后面有浅色轨道；数值标签用条的语义色；条很细（4～6 px）。 | [SMP] Comparison Micro Chart | 三期 |
| MC-74 | Area：阈值区域是实心的语义色；实际值线用正文颜色实线，目标值线用点线；起止数值标签用该点的语义色，维度标签用正文颜色。 | [SMP] Area Micro Chart | 三期 |
| MC-75 | Delta：从上到下是值 1 的细条、差值的粗条、值 2 的细条，两端有竖向连接线；值条用中性色，差值条用语义色；名称在左、数值在右。 | [SMP] Delta Micro Chart | 三期 |
| MC-76 | 文字说明带语义状态词（例如"实际 1,200（好）"），颜色不是唯一的信息载体（WCAG 1.4.1）。SAPUI5 的说明同样带 Good、Critical 等词。 | [SMP] 各示例的 `aria-label` | 三期 |
| MC-77 | Stacked Bar：条较细（本库上限 20 px）、直角；标签在段内，放不下就隐藏。 | [SMP] Stacked Bar Micro Chart | 三期 |
| MC-78 | Line：首尾标签都用正文颜色；数据点约 6～8 px。 | [SMP] Line Micro Chart | 三期 |

出处缩写 **[SMP]**：SAPUI5 1.154.0 Demo Kit 的 `sap.suite.ui.microchart` 示例（`ui5.sap.com`，Samples），只看渲染结果，不复制代码。

对比时发现并改掉的差异：Bullet 两个标签都在条上方、阈值是条上下的小刻度、预测条偏矮；Radial 百分数加粗、环偏细；Harvey Ball 部分值不着色；Comparison 没有轨道、数值不着色、条偏粗；Area 阈值区域用浅色、实际值线用蓝色；Delta 三根条的顺序和粗细不同、值条用蓝色；Stacked Bar 条偏粗、有圆角；Line 底部标签用浅色；文字说明没有状态词。
