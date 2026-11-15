# ADR-001 基础控件用 Mantine

- **背景**：v5 第 7 节要求基础控件不自己写；参考项目已用 Mantine 9.8 做出整页模板。
- **决定**：`@mantine/core`、`@mantine/hooks`、`@mantine/dates` 9.8.0，作为 `@rhfan2019/smart-kit` 的 **peer 依赖**。
- **理由**：
  - MIT 许可；
  - 控件齐全（组合框、多选令牌、日期范围、分段按钮、菜单、弹层、模态框、骨架屏）；
  - 主题完全由 CSS 变量驱动，可以桥接到我们的令牌；
  - 参考项目已验证与 AG Grid 共存。
- **代价**：使用者必须安装 Mantine 并引入它的样式；Mantine 大版本升级时，桥接的变量名可能变化，由 `tokens.css` 集中处理。
- **状态**：采纳。
