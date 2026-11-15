# ADR-006 文档与示例用 Storybook

- **决定**：Storybook 10.6（`@storybook/react-vite`），放在 `apps/storybook`。故事使用 `MemoryProvider` 和测试服务的 `$metadata` 样本，不依赖运行中的服务。
- **理由**：每个积木可以单独展示，参数可调。
- **代价**：依赖较重；只作为开发依赖，不进入发布包。
- **状态**：采纳。
