# 交接文档

> 最后更新：2026-11-15（二期完成）。新会话先读本文，再读 `docs/prompt/项目目标与范围-v5.md`。

## 1. 现状

- 阶段 0、1、1.5、2 全部完成，一期验收结果见 `docs/10-acceptance-report.md`。
- 所有提交都只在本地，**没有推送到远程**：用户要求全部完成后再决定是否推送。
- 唯一没有在本机验证的项：CI 工作流从未在 GitHub 上跑过；Linux 的截图基准还没有生成。
- 验收后的修正（2026-11-15）：测试服务换成 `@sap-ux/fe-mockserver-core`（ADR-017，不再需要 .NET）；页头按钮放到页头下沿正中；对象页锚点在平滑滚动下失效的缺陷已修（`10-acceptance-report.md` 第 5 节）。之后按规范逐项对照并全部处理（`11-guideline-gap-report.md` 第 7 节）：列表页默认即时模式，页头用展开 / 折叠和固定按钮（参照 SAP 参考应用）；锚点导航在末尾留空白；采购订单对象页默认页签导航；页头支持点击标题、折叠取消固定、60% 规则、键盘。

- **二期完成（2026-11-15）**：计划 `12-phase2-plan.md`，验收条目 `13-phase2-acceptance.md`（三篇基准规范每个示意图编号和行为规则，共 132 条，另 10 个二期注解术语），结果 `14-phase2-acceptance-report.md`（142/142 对应到通过的测试；端到端 181 个用例完整跑两遍都通过）。设计决定 ADR-018–024。二期在分支 `claude/phase-2-a32ce7` 上本地提交，**没有推送**。

## 2. 下一步

1. 用户决定是否推送；推送后看 CI，第一次运行时生成 Linux 截图基准（`npx playwright test tests/e2e/quality.spec.ts -g AC-THEME-01 --update-snapshots`）并提交。
2. `14` 第 6 节列出的限制（草稿"保持草稿"、动作参数对话框只支持基本类型、二期页面没有像素级截图回归）可以按需要再做。
3. `packages/core/test/samples/*`（导出的 `$metadata` 样本）是一期的；二期给测试服务加了注解，需要时用 `npm run samples` 重新导出。

## 3. 已定的关键决策

| 决策 | 出处 |
| --- | --- |
| 两期；一期为只读的列表页、对象页、子对象页 | v5 第 2 节 |
| 一期不做草稿，也不识别草稿服务 | v5 第 3.2 节 |
| 只排除专有许可的 SAP 包；解析用 `@sap-ux/*`，另加内联注解预处理和 CSDL JSON 转换 | v5 第 3.3 节、ADR-008、`09` |
| 测试服务用 `@sap-ux/fe-mockserver-core`（纯 Node） | ADR-017（取代 ADR-009） |
| 列表页页头用展开 / 折叠和固定按钮，表格滚动时折叠；默认即时模式 | LR-12、`11` C-1、D-8 |
| 采购订单对象页默认页签导航 | `11` D-7 |
| 列表页默认网格表格；`tableType` 可选响应式或按宽度自动 | ADR-002、ADR-020 |
| 编辑策略：直接保存和草稿，按模型选择 | ADR-018 |
| 草稿测试服务 `/odata/purchasing-draft/`（引擎原生草稿） | ADR-019 |
| 图表和微图表用 SVG 自己写，数据用 `$apply` | ADR-021 |
| 弹性分栏的布局由宿主路由决定 | ADR-022 |
| 消息模型（错误详情 + `sap-messages` + 客户端校验） | ADR-023 |
| 动作来自 `UI.DataFieldForAction`，可用性来自 `Core.OperationAvailable` | ADR-024 |
| 规范未写明处的默认做法 | `12` 第 5 节 U-3–U-17 |
| 变体存服务端实体集 | ADR-014 |
| 库不依赖路由；示例用 React Router | ADR-010 |
| 只支持中文和英文 | v5 第 6.8 节 |

## 4. 常用命令

| 命令 | 作用 |
| --- | --- |
| `npm run mock` | 启动测试服务（http://localhost:4400），数据在内存里生成；端口被占用时提示并退出 |
| `npm run dev` | 启动示例应用（http://localhost:4401，代理到测试服务） |
| `npm run storybook` | Storybook（http://localhost:6006） |
| `npm run typecheck` / `npm run lint` / `npm test` | 类型、lint 和令牌与商标检查、单元测试 |
| `npm run e2e` | 端到端；会自己启动测试服务（`E2E=1`）和示例应用。本机 4400 / 4401 已被占用时：`E2E_MOCK_PORT=4410 E2E_DEMO_PORT=4411 npm run e2e` |
| `npm run build` / `npm run size` | 构建两个包和示例应用；体积预算：每个入口一个上限，再按场景（只用 `MicroChart`、只用 `SmartField`、列表页、对象页）量应用实际要打包的体积（ADR-026） |
| `npm run trace -- --strict` | 注解覆盖与验收条目的可追溯检查；二期条目读取 `reports/` 下的测试结果，所以要先跑 `npm test` 和 `npm run e2e` |
| `npm run samples` | 从运行中的测试服务导出 `$metadata` 样本 |
| `node scripts/rename-scope.mjs <@scope> --dry-run` | 改 npm scope |

## 5. 环境

- Node 24、npm 11。不再需要 .NET（本机 `~/.dotnet` 里装过的 SDK 可以删除）。
- 端口：测试服务 4400，示例应用 4401，Storybook 6006。
- 示例应用的二期路由：`/po?views=switch|select|tabs|type|type-switch`（`type`：按订单类型的视图，来自示例的本地注解 `apps/demo/src/annotations.ts`）、`/po?contents=1`、`/po?table=responsive|auto`、`/po?chart=1`、`/po?working=continuous`、`/po-draft`（草稿服务）、`/fcl`（弹性分栏）、`/:service/object?create=PurchaseOrders`（新建模式）、`/:service/table?parent=…&nav=…`（"Show All"）。
- 参考项目在 `../00-fiori-list-report-floorplan-folk`，遵守它 `AGENTS.md` 的隔离规则（不访问 `03-invoice-assure`）。
