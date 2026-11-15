# 架构决策记录（ADR）

每篇一个决策，格式：背景 → 决定 → 理由 → 代价 → 状态。推翻某个决策时，不删旧文，把状态改成"已被 ADR-xxx 取代"。

| 编号 | 决策 | 状态 |
| --- | --- | --- |
| [001](001-base-controls.md) | 基础控件用 Mantine | 采纳 |
| [002](002-table-kernel.md) | 表格内核用 AG Grid Community；一期只做网格表格和自动高度两种模式 | 采纳 |
| [003](003-data-fetching.md) | 数据请求用 TanStack Query | 采纳 |
| [004](004-build.md) | Vite library 模式构建 | 采纳 |
| [005](005-testing.md) | 测试栈 | 采纳 |
| [006](006-docs-storybook.md) | 文档与示例用 Storybook | 采纳 |
| [007](007-package-manager.md) | npm workspaces | 采纳 |
| [008](008-csdl-parser.md) | CSDL 与注解解析用 `@sap-ux/*` | 采纳 |
| [009](009-mock-server.md) | 测试服务用 ASP.NET Core OData | 已被 ADR-017 取代 |
| [010](010-routing.md) | 库不依赖路由；示例用 React Router | 采纳 |
| [011](011-component-naming.md) | 组件沿用 Smart* 名字 | 采纳 |
| [012](012-package-naming.md) | 包名与改名脚本 | 采纳 |
| [013](013-trademark-check.md) | 商标词检查 | 采纳 |
| [014](014-variant-storage.md) | 变体存服务端实体集 | 采纳 |
| [015](015-no-batch-phase1.md) | 一期不用 `$batch` | 采纳 |
| [016](016-export.md) | 导出用 write-excel-file | 采纳 |
| [017](017-mock-server-fe-mockserver.md) | 测试服务改用 `@sap-ux/fe-mockserver-core`（纯 Node） | 采纳 |
