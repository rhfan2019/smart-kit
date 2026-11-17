# 22 卡片验收条目

> 状态：现行 · 2026-11-16（讨论记录 D16、D17，ADR-028）。规则和调研见 `20-research-cards.md`，截图见 `21-evidence/`。编号以合并时为准：并行分支 `odata-server` 也可能新增 20 号以后的文档。
>
> 写法沿用 `17-phase3-acceptance.md`：每条一个编号 CD-xx（CD-01～CD-10 直接用 `20` 第 2.1 节的规则编号），测试名称里带这个编号；`npm run trace -- --strict` 检查验收方式含 U 或 E 的条目都有**通过**的测试。
>
> 验收方式：U = 单元测试（`packages/core/test/cards.test.ts`、`packages/react/test/cards.test.tsx`）；E = 端到端（`tests/e2e/p4-cards.spec.ts`，连 `apps/mock`，演示页 `/cards`）；S = 截图（`docs/21-evidence/`，`E2E_EVIDENCE=1` 时生成）；V = 与 SAPUI5 1.154 集成卡片（Horizon 主题）逐项对比（`20` 第 9 节）；Z = 体积检查（`npm run size`）；D = 只是用法指引或"不做"，写进文档，不能用测试证明。

| 编号 | 要求 | 出处 | 验收方式 |
| --- | --- | --- | --- |
| CD-01 | 卡片 = 页头 + 内容区（可选页脚），外框圆角 16 px、阴影、背景；中英文和三种主题都能显示。 | [IC] Card Anatomy | U、E、S、V |
| CD-02 | 默认页头：标题必填（3 行截断）、副标题（2 行截断）、头像（图片、首字母或图标）；距卡片边 16 px，头像 48 px，头像与文字间距 8 px。 | [IC] Default Header | U、E、V |
| CD-03 | 计数"5 of 40"在页头右上；全部显示时、出错时、无数据时不显示；总数超过 1000 用缩写。 | [OVP] Counter | U、E、V |
| CD-04 | 数值页头："<副标题> \| <单位>"；主数值带语义色、缩写单位和趋势箭头；最多两个附加指标；下方一行说明。注解驱动时数值是 `UI.DataPoint` 的服务端合计，状态来自 `Criticality` / `CriticalityCalculation`，趋势来自 `TrendCalculation`，附加指标是目标值和偏差。 | [IC] Numeric Header；[OVP] Analytical KPI header | U、E、S、V |
| CD-05 | 整个页头是导航区（鼠标、Enter、空格）；默认打开该实体集的列表页（使用者的导航适配器有这个页面时）。 | [IC]、[OVP] Behavior | U、E |
| CD-06 | 卡片里没有可编辑字段。 | [OVP] | D |
| CD-07 | 卡片里的数字用短格式（1K）。 | [OVP] Formatting | U |
| CD-08 | 卡片宽度由宿主容器决定，组件不设宽。 | [IC] Responsiveness | E、V |
| CD-09 | 页头溢出菜单（刷新、添加到我的首页）：**不做**，没有启动台；刷新由宿主调用 TanStack Query 的 `invalidateQueries`。 | [OVP] Overflow Menu | D |
| CD-10 | 列表卡片：标题（行项目第 1 个字段）、描述（第 2 个）、右侧信息（第 1 个 DataPoint，带币种和语义色）；项目高 80 px，无分隔线；默认最多 5 项。 | [OVP] List Card；[IC] List | U、E、S、V |
| CD-11 | 页头标题默认用 `UI.HeaderInfo/TypeNamePlural`；行点击打开该对象的对象页。 | [OVP] List Card Navigation | U、E |
| CD-12 | 扩展列表项（`listType="extended"`）最多 6 个信息、默认 3 项；条形图列表（`listFlavor="bar"`）每行一根按最大值缩放的条。 | [OVP] List Item Types、Bar Chart List Card | U、E |
| CD-13 | 表格卡片：最多 3 列（按 `UI.Importance` 选、保持行项目顺序）、默认 3 行；表头一行带下边线，行高 44 px；语义键加粗，数字右对齐，状态着色。 | [OVP] Table Card；[IC] Table | U、E、S、V |
| CD-14 | 加载中显示与内容形状相同的占位块；无数据、出错时在卡片内显示提示，不影响其他卡片。 | [IC] 加载占位；[OVP] | U |
| CD-20 | 对象卡片：页头来自 `UI.HeaderInfo`；分组来自 `UI.QuickViewFacets`（默认）、`UI.Facets` 或一个 `UI.FieldGroup`；组标题 16 px 粗体，"标签：值"，项间距 16 px，组间距 28 px。 | [IC] Object；[OVP] Quick View Card | U、E、S、V |
| CD-21 | 对象卡片页脚：`UI.Identification` 的 `DataFieldForAction`，第一个是强调按钮；无参数的绑定动作直接执行并刷新。 | [OVP] Quick View Card footer | U |
| CD-30 | 分析卡片：`UI.Chart` 在服务端聚合，Column、Bar、Line、Donut 用 `SimpleChart` 画（ADR-021），默认最多 4 个数据点；三种导航模式。 | [OVP] Analytical Card | U、E、S |
| CD-31 | 其他图表类型（Bubble、Scatter、Waterfall 等）显示"不支持"提示，`renderChart` 插槽可以换成图表库。 | ADR-028 | D |
| CD-33 | 时间线卡片：`Communication.Event`（或 `item` 指定字段），最新的在前；图标、标题、相对日期（"Today at 1:30 PM"）、说明；每项 91 px。 | [IC] Timeline | U、E、S、V |
| CD-35 | 日历卡片：月历带周数、今天、选中日、特殊日；选中日的日程（今天只列未结束的）、"3 of 4"计数、"更多"；图例（方块是特殊日，圆点是日程类型）和"More (x)"。 | [CAL] | U、E、S、V |
| CD-36 | 日历卡片宽于 589 px 时两栏，否则一栏；最小宽度 295 px。 | [CAL] Width | U、E |
| CD-37 | 日期选择在卡片内逐级下钻：日 → 月 → 年 → 年区间，每级有上一页、下一页；"今天"回到今天。 | [CAL] Selecting a Date | U、E |
| CD-40 | 打包：子路径 `/cards`，只用 `Card` + `Header` 不超过 2 KB，列表卡片 45 KB、日历卡片 46 KB、分析卡片 52 KB（gzip，含 TanStack Query 和 core，不含 React、不含 AG Grid）。 | ADR-026、ADR-028 | Z |
| CD-41 | 组件名与 SAPUI5 一致：`Card`（sap.f.Card）、`Header`、`NumericHeader`、`NumericSideIndicator`（sap.f.cards）、`ListContent` 等（sap.ui.integration.cards）；属性名沿用 SAPUI5 和 OVP 卡片设置（`statusText`、`unitOfMeasurement`、`annotationPath`、`maxItems`……）。 | D17 | D |
| CD-50 | 模型保留卡片按限定符选用的注解：各 `UI.LineItem`、`UI.PresentationVariant`（含 `MaxItems`）、`UI.SelectionVariant`、`UI.DataPoint`、`UI.FieldGroup`、`UI.Identification`；注解路径设置接受 OVP 写法和短写法。 | [OVP] 卡片设置 | U |
| CD-51 | `Communication.Event` 进入模型（`dtstart`、`dtend`、`summary`、`description`、`location`、`categories`）。 | [VOC] Communication | U |
| CD-52 | `UI.TrendCalculation` 进入模型，算出 Up / Down / None（绝对或相对差）。 | [VOC] UI | U |

## 结果（2026-11-16）

- 单元测试：`packages/core/test/cards.test.ts` 4 个、`packages/react/test/cards.test.tsx` 19 个，全部通过。
- 端到端：`tests/e2e/p4-cards.spec.ts` 8 个，全部通过。
- 体积：见 CD-40，`npm run size` 通过；样式文件上限由 13 KB 调到 16 KB（ADR-028）。
- 与 SAPUI5 成品对比：`20` 第 9 节。
