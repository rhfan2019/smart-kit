# ADR-028 卡片：与 SAPUI5 同名，注解驱动，外观对齐集成卡片，不做 manifest

- **背景**：用户要求实现 SAP Fiori 风格的各类卡片（讨论记录 D19）。SAP 有两套卡片：Integration Card 由 JSON manifest 描述，可放进任何宿主；概览页（OVP）卡片由 OData 注解驱动，只能放在概览页。调研和规则清单见 `20-research-cards.md`。
- **决定**（2026-11-16 用户确认，D19、D20）：
  - **名字与 SAPUI5 一致**（D20）：`Card`（sap.f.Card）、`Header`、`NumericHeader`、`NumericSideIndicator`（sap.f.cards）、`ListContent`、`TableContent`、`ObjectContent`、`AnalyticalContent`、`TimelineContent`、`CalendarContent`（sap.ui.integration.cards）；属性名沿用 SAPUI5 和 OVP 卡片设置。
  - **注解驱动为主**：各 `*Content` 从 `UI.LineItem`、`UI.Chart`、`UI.DataPoint`、`UI.HeaderInfo`、`UI.FieldGroup` / `UI.QuickViewFacets`、`Communication.Event` 取字段、标签、格式和语义色；注解给不出的（卡片标题、导航目标、日历特殊日）用 React props 补。
  - **外观和结构借 Integration Card**：页头 / 内容 / 页脚；默认页头和数值页头；计数"5 of 40"；日历卡片的交互（[CAL]）。
  - **不做 manifest**，不做 Adaptive、WebPage、Stack / 对象流、概览页布局框架。
  - 自定义卡片（Component / Custom 卡片）就是 `Card` 里放任意 React 内容。与 Mantine 的 `Card` 同名：本库内部不用 Mantine 的 `Card`；应用两者都用时引入时改名。
  - **外观**：尺寸取自 SAPUI5 1.154 集成卡片（Horizon）的实测值，写成卡片令牌 `--sk-card-*`；颜色和字体沿用本库主题（D08）。对比见 `20` 第 9 节。
  - **打包**：新子路径 `@rhfan2019/smart-kit/cards`（ADR-026）。日历自己画网格（约 3 KB），不用 `@mantine/dates`（只有三级下钻、外观要大量覆盖、会带进 dayjs）；图表复用 `/chart` 的 `SimpleChart`，扩展 Line、Donut（ADR-021）；取数复用 `useListQuery`（不含 AG Grid）。不引入新依赖。入口和"只用某张卡片"的场景都设体积上限；样式仍是一个文件，上限由 13 KB 调到 16 KB；根入口（全部子路径之和）上限由 80 KB 调到 95 KB（修订 AC-Q-02）。
- **理由**：与本库其他 Smart 组件一致（字段只在后端注解里写一次）；manifest 要在运行时解释，违背 ADR-026；Integration Card 的视觉规范比 OVP 卡片新、更完整，并且只有它有日历和时间线。
- **代价**：分析卡片只支持 `SimpleChart` 能画的图表类型，其余显示占位并提供插槽；没有意图导航，导航靠回调；与 UI5 的卡片 manifest 不兼容，不能直接复用 SAP 的卡片配置。
- **状态**：采纳（2026-11-16）。修订 ADR-021（`SimpleChart` 增加 Line、Donut）和 ADR-026 P5 的样式上限。
