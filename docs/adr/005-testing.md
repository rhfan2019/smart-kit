# ADR-005 测试栈

- **决定**：
  - 单元测试：Vitest 5.1，Testing Library（`@testing-library/react` 16），jsdom。
  - 端到端：Playwright 1.65，`@axe-core/playwright` 4.14 做无障碍检查。
  - 截图回归：Playwright 的 `toHaveScreenshot`。
- **理由**：与参考项目一致，已验证可用。
- **代价**：端到端测试需要先启动测试服务（纯 Node，ADR-017）；Playwright 的 `webServer` 配置会自动启动它。
- **状态**：采纳。
