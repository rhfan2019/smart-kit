# ADR-003 数据请求用 TanStack Query

- **决定**：`@tanstack/react-query` 5.107.1，作为 peer 依赖。`SmartKitProvider` 可以接收使用者自己的 `QueryClient`；不传时内部创建一个。
- **理由**：缓存、去重、取消（`AbortSignal`）、失效重取都是现成的；与路由无关。
- **代价**：使用者的应用里会有一个 QueryClient；查询键都以 `['smart-kit', 服务名, …]` 开头，避免与宿主冲突。
- **状态**：采纳。
