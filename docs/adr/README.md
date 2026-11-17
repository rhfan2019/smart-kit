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
| [018](018-edit-strategies.md) | 编辑策略：直接保存与草稿都实现 `EditStrategy` | 采纳 |
| [019](019-draft-test-service.md) | 草稿测试服务 `/odata/purchasing-draft/`（引擎原生草稿） | 采纳 |
| [020](020-responsive-table.md) | 响应式表格自己用 HTML 表格实现 | 采纳 |
| [021](021-charts.md) | 图表和微图表用 SVG 自己实现，数据用 `$apply` | 采纳 |
| [022](022-flexible-column-layout.md) | 弹性分栏由宿主路由驱动 | 采纳 |
| [023](023-messages.md) | 消息模型 | 采纳 |
| [024](024-actions.md) | 动作 | 采纳 |
| [025](025-micro-chart-series.md) | 导航集合上的微型图表用 `$expand` 带 `$orderby`、`$top` 一起读 | 采纳 |
| [026](026-bundling-and-subpaths.md) | 打包规则：用多少付多少；React 包按领域分子路径 | 采纳（P4、P6、P8 待做） |
| [027](027-odata-server-package.md) | 自写 OData V4 服务：`smart-kit-server`、`smart-kit-cli` 两个新包 | 采纳，未实施 |
| [028](028-cards.md) | 卡片：与 SAPUI5 同名（`Card`、`Header`、`*Content`），注解驱动，外观对齐集成卡片，不做 manifest（编号以合并时为准） | 采纳 |
