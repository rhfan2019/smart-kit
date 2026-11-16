# ADR-022 弹性分栏由宿主路由驱动

- **背景**：NAV-07 要求列表和对象页并排显示。v5 第 6.10 节要求库不读写地址栏。
- **决定**：
  - 库提供受控组件 `FlexibleColumnLayout`：`layout` 取值 `OneColumn`、`TwoColumnsMidExpanded`、`ThreeColumnsMidExpanded`、`MidColumnFullScreen`、`EndColumnFullScreen`，三个列插槽，以及 `onLayoutChange`。列宽按 UI5 的默认比例（两列 33/67，三列 25/50/25；窄于 1024px 只显示最后一列）。
  - 布局动作（全屏、退出全屏、关闭）和分页按钮由 `FlexibleColumnLayout` 通过上下文交给列里的 `DynamicPage`，显示在标题栏最右侧（[DP] Header Title (6)）。
  - 导航适配器新增可选的 `layout` 参数；示例应用用 React Router 的地址 `/fcl/po?object=…&sub=…&layout=…` 实现。
- **理由**：列状态属于宿主的路由，与一期的导航适配器思路一致。
- **代价**：宿主要自己把地址映射成布局；示例里提供参考实现。
- **状态**：采纳。
