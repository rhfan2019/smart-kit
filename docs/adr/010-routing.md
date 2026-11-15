# ADR-010 库不依赖路由；示例用 React Router

- **背景**：v5 第 6.10 节要求组件嵌进别的应用时不影响宿主路由。
- **决定**：
  - 库内只有 `NavigationAdapter` 和 `PageStateStore` 两个接口；
  - 用 lint 禁止导入路由库，禁止访问 `window.location` 和 `window.history`；
  - 示例应用用 React Router 8.5.1 实现适配器。
- **理由**：
  - 宿主可能用任何路由库，也可能没有路由；
  - React Router 是最常见的选择，示例对多数使用者最有参考价值。
- **代价**：
  - 使用者要写几十行适配器代码；示例里有一份可以复制的实现。
  - 默认的状态存储只在内存里，刷新页面后列表状态丢失；需要刷新后也能恢复时，注入 `createSessionPageStateStore`。
- **状态**：采纳。
