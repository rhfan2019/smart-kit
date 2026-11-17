# 交接文档

> 最后更新：2026-11-16（npm 发布准备和给 AI 编程工具的文档，ADR-029、ADR-030，D23、D24）。新会话先读本文，再读 `docs/prompt/项目目标与范围-v5.md`。

## 1. 现状

- 阶段 0、1、1.5、2 全部完成，一期验收结果见 `docs/10-acceptance-report.md`。
- 所有提交都只在本地，**没有推送到远程**：用户要求全部完成后再决定是否推送。
- 唯一没有在本机验证的项：CI 工作流从未在 GitHub 上跑过；Linux 的截图基准还没有生成。
- 验收后的修正（2026-11-15）：测试服务换成 `@sap-ux/fe-mockserver-core`（ADR-017，不再需要 .NET）；页头按钮放到页头下沿正中；对象页锚点在平滑滚动下失效的缺陷已修（`10-acceptance-report.md` 第 5 节）。之后按规范逐项对照并全部处理（`11-guideline-gap-report.md` 第 7 节）：列表页默认即时模式，页头用展开 / 折叠和固定按钮（参照 SAP 参考应用）；锚点导航在末尾留空白；采购订单对象页默认页签导航；页头支持点击标题、折叠取消固定、60% 规则、键盘。

- **二期完成（2026-11-15）**：计划 `12-phase2-plan.md`，验收条目 `13-phase2-acceptance.md`（三篇基准规范每个示意图编号和行为规则，共 132 条，另 10 个二期注解术语），结果 `14-phase2-acceptance-report.md`（142/142 对应到通过的测试；端到端 181 个用例完整跑两遍都通过）。设计决定 ADR-018–024。二期在分支 `claude/phase-2-a32ce7` 上本地提交，**没有推送**。

- **自写 OData 服务（2026-11-16，ADR-027，讨论记录 D16、D17）**：新包 `@rhfan2019/smart-kit-server`（OData V4 服务，PostgreSQL：读、直接保存、绑定动作，业务规则是钩子；没有草稿）和 `@rhfan2019/smart-kit-cli`（命令 `smart-kit`：从表结构生成 CSDL、检查注解）；测试床 `apps/pg-server`（数据库 `smart_kit_purchasing`，端口 4402）。示例应用的读写场景在它上面全部通过（`npm run e2e:pg`，141 个），和内存测试服务的一致性测试 38 个请求形状全部相同。分支 `claude/odata-server-8d02a5`，从 `build/subpath-exports` 开出，**没有推送**。

- **npm 发布准备和给 AI 的文档（2026-11-16，ADR-029、ADR-030，讨论记录 D23、D24）**：分支 `claude/npm-publish`。`exports` 改为指向 `dist`，仓库里用自定义条件 `smart-kit-source` 走源码（npm 不认 `publishConfig.exports`，原配置发布后无法导入）；peer 依赖改成范围；Changesets 四包同步版本，`release.yml` 用 npm 可信发布；`npm run verify:pack` 在仓库外从 tgz 安装后逐项检查（已进 CI）；构建后 `scripts/fix-dts-imports.mjs` 给 `.d.ts` 的相对导入补扩展名（`nodenext` 项目才能用类型）。每个包带 `docs/`（React 包另有 `skills/smart-kit-getting-started/SKILL.md`），`docs/reference.md` 由 `scripts/gen-agent-docs.mjs` 从类型和 TSDoc 生成；文档代码块的类型检查在 `tests/unit/agent-docs.test.ts`；CLI 新命令 `smart-kit agents` 写使用方的 `AGENTS.md` / `CLAUDE.md`。**还没有发布到 npm**：第一次发布由用户手工执行（D24 列出命令）。

## 2. 下一步

0. invoice-assure 试用 0.1.0 发现的 23 个问题在 `docs/25-invoice-assure-issues.md`：已修 21 条（D29、D30 网格表分组，未提交、未发版），S10–S12 只记录。
0. 自写服务的草稿（D16 的 D 部分）还没做，要不要做由用户决定；`$batch`、深层新建、PUT 也没做。

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
| 后端只用 TypeScript；自写受限的 OData V4 服务（chevrotain 解析、Kysely + pg、CSDL 从表结构生成、注解单独手写），两个新包在本仓库 | D05、D13、ADR-027 |
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
| `npm run pg:setup` | 在本机 PostgreSQL 上建采购订单测试床（角色、数据库 `smart_kit_purchasing`、表、数据）；可重复执行，`-- --reseed` 重新写入数据 |
| `npm run pg:generate` | 从表结构重新生成 `apps/pg-server/generated/`，并检查手写注解（`-- --strict`：有失效目标时失败） |
| `npm run pg` | 启动 PostgreSQL 上的采购订单服务（http://localhost:4402/odata/purchasing/）；示例应用接它：`PURCHASING_URL=http://localhost:4402 npm run dev` |
| `npm run e2e:pg` | 示例应用对 PostgreSQL 服务的端到端测试（`playwright.pg.config.ts`，演示应用在 4403）；需要先 `npm run pg:setup` |
| `node scripts/rename-scope.mjs <@scope> --dry-run` | 改 npm scope |
| `npm run verify:pack` | 构建后执行：打 tgz，在仓库外新建 Vite + React 和 Node 项目从 tgz 安装，检查子路径、类型（bundler / nodenext）、体积、样式、随包文档、server 和 CLI（ADR-029） |
| `node scripts/gen-agent-docs.mjs` | 重新生成各包 `docs/reference.md`（改了导出或 TSDoc 后执行；`--check` 只检查） |
| `npx changeset` | 为要发布的改动写一条 changeset（四包同步版本，ADR-029） |

## 5. 环境

- Node 24、npm 11。不再需要 .NET（本机 `~/.dotnet` 里装过的 SDK 可以删除）。
- 端口：测试服务 4400，示例应用 4401，PostgreSQL 服务 4402，`e2e:pg` 用的示例应用 4403，Storybook 6006。
- PostgreSQL 17（Homebrew，`localhost:5432`，本机认证为 trust）。上面还有其他项目的数据库（`invoice_assure`、`invoice_assure_replay`、`sap_delivery_workbench_dev`、`web_app_template`、`postgres`），**不能碰**；本项目只用角色 `smart_kit`、`smart_kit_reader` 和数据库 `smart_kit_purchasing`。
- 示例应用的二期路由：`/po?views=switch|select|tabs|type|type-switch`（`type`：按订单类型的视图，来自示例的本地注解 `apps/demo/src/annotations.ts`）、`/po?contents=1`、`/po?table=responsive|auto`、`/po?chart=1`、`/po?working=continuous`、`/po-draft`（草稿服务）、`/fcl`（弹性分栏）、`/:service/object?create=PurchaseOrders`（新建模式）、`/:service/table?parent=…&nav=…`（"Show All"）。
- 参考项目在 `../00-fiori-list-report-floorplan-folk`，遵守它 `AGENTS.md` 的隔离规则（不访问 `03-invoice-assure`）。
