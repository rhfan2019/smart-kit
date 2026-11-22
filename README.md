# smart-kit

> SAP、Fiori、SAPUI5 是 SAP SE 的注册商标。本项目与 SAP 无关联，未获任何授权或背书。

元数据驱动、白盒、可换主题的 React 组件库：从 OData V4 的 `$metadata` 与注解生成列表页和对象页的积木，页面由使用者在 JSX 里自己拼。

**状态：一期（只读的列表页、对象页、子对象页）和二期（编辑、草稿、弹性分栏及其余功能）已完成。** 验收结果见 [docs/10-acceptance-report.md](docs/10-acceptance-report.md) 和 [docs/14-phase2-acceptance-report.md](docs/14-phase2-acceptance-report.md)，目标与范围见 [docs/prompt/项目目标与范围-v5.md](docs/prompt/项目目标与范围-v5.md)。

## 包

| 包 | 内容 |
| --- | --- |
| `@rhfan2019/smart-kit-core` | 纯 TypeScript：CSDL 与注解解析、模型、查询生成、OData V4 和内存数据提供者、变体与页面状态存储 |
| `@rhfan2019/smart-kit` | React 积木：`v4/fe/macros/FilterBar`、`Table`、`Field`、`Form`、`ObjectPageLayout`、`v4/fe/templates/ListReport`、`v4/fe/templates/ObjectPage` 等；令牌与主题；中英文文案 |
| `@rhfan2019/smart-kit-server` | 只在 Node 里用：自写的 OData V4 服务，把请求翻译成 PostgreSQL 的 SQL；支持读、直接保存（修改、新建、删除）和绑定动作，业务规则写成钩子（ADR-027） |
| `@rhfan2019/smart-kit-cli` | 开发时用的命令 `smart-kit`：从 PostgreSQL 的表结构生成 CSDL，检查手写的注解是否失效 |

公开 API 见 [docs/api.md](docs/api.md)。

## 最小用法

```tsx
import { loadService } from '@rhfan2019/smart-kit-core';
import { SmartKitProvider, smartKitMantineTheme, smartKitCssVariablesResolver } from '@rhfan2019/smart-kit';
import ListReport from '@rhfan2019/smart-kit/v4/fe/templates/ListReport';
import '@rhfan2019/smart-kit/styles.css';

const { model, provider } = await loadService({ serviceUrl: '/odata/purchasing/', fetch, language: 'zh' });

<MantineProvider theme={smartKitMantineTheme} cssVariablesResolver={smartKitCssVariablesResolver} forceColorScheme="light">
  <SmartKitProvider services={{ purchasing: { model, dataProvider: provider } }} locale="zh" namespace="my-app" navigation={myAdapter}>
    <ListReport contextPath="/PurchaseOrders" />
  </SmartKitProvider>
</MantineProvider>
```

只用一部分组件时，可以从子路径引入，例如 `import { MicroChart } from '@rhfan2019/smart-kit/chart'`；应用只打包用到的代码，不用表格时也不必安装 AG Grid。子路径清单见 [docs/api.md](docs/api.md)，打包规则见 [ADR-026](docs/adr/026-bundling-and-subpaths.md)。

导航适配器的写法见 [apps/demo/src/navigation.ts](apps/demo/src/navigation.ts)；主题用根元素的 `data-sk-theme`（`yellow` / `navy` / `sky` / `dark`；`sky` 是接近 SAP Horizon 的浅色配色）和 `data-sk-density`（`comfortable` / `compact`）切换（旧的 `data-theme` / `data-density` 仍然有效，见 docs/06 第 3.4 节）。

## 在其他项目中使用

四个包都发布在 npm（scope `@rhfan2019`，同一版本号）：

```bash
# 前端（React）
npm install @rhfan2019/smart-kit @rhfan2019/smart-kit-core react react-dom @mantine/core @mantine/hooks @mantine/dates dayjs @tanstack/react-query
# 用表格、列表页模板、对象页模板时再装（可选 peer 依赖）
npm install ag-grid-community ag-grid-react
# 后端（Node ≥ 24，PostgreSQL）
npm install @rhfan2019/smart-kit-server @rhfan2019/smart-kit-core
npm install -D @rhfan2019/smart-kit-cli
```

- 每个包的 README（npm 页面）有安装、peer 依赖和最小示例；完整用法在包里的 `docs/` 下（随版本发布）。
- 从零开始（PostgreSQL 表 → `smart-kit generate` → 手写注解 → `smart-kit-server` → 列表页和对象页）：`node_modules/@rhfan2019/smart-kit/skills/smart-kit-getting-started/SKILL.md`。
- **让 AI 编程工具读到这些文档**：在你的项目里装上 `@rhfan2019/smart-kit-cli`（开发依赖）后执行 `npx smart-kit agents`，它在 `AGENTS.md` 里写入指向 `node_modules` 里各包文档的索引（Codex 等读取），并在 `CLAUDE.md` 里加 `@AGENTS.md`（Claude Code 读取）。升级 smart-kit 后再执行一次（ADR-030）。

## 发版

版本和发布用 [Changesets](https://github.com/changesets/changesets)，四个包同步版本（ADR-029）：

1. 每个要发布的改动：`npx changeset`，选 patch / minor / major，写一句给使用方看的说明，和代码一起提交。
2. 推送到 `main`，CI 通过后 GitHub Actions（`.github/workflows/release.yml`）开一个"chore: version packages"拉取请求（改版本号、内部依赖、各包 `CHANGELOG.md`）。
3. 合并这个拉取请求，CI 再次通过后，工作流构建并用 npm 可信发布（OIDC，带 provenance，不存 token）发布四个包，然后从 npm 安装刚发布的版本逐项检查。

没有 changeset 的推送不会发布任何东西。发布后也可以在本地检查：`node scripts/verify-pack.mjs --registry`。

本地检查打出来的包：`npm run build && npm run verify:pack`（在仓库外新建项目，从 tgz 安装后逐项检查）。第一次发布和配置可信发布者的步骤见 ADR-029。

## 开发

需要 Node 24。测试服务是纯 Node（SAP 开源的 `@sap-ux/fe-mockserver-core`，见 `apps/mock`）。

```bash
npm install
```

```bash
npm run mock
```

```bash
npm run dev
```

两个都启动后，浏览器打开 <http://localhost:4401/cards> 就是卡片演示页（右上角主题选"天蓝"最接近 SAPUI5 的样子；列表、表格、对象、分析、时间线、日历等各类卡片，组件名与 SAPUI5 相同，见 [docs/20-research-cards.md](docs/20-research-cards.md)）；也可以在演示应用顶部导航点"卡片"。

其余命令（测试、端到端、构建、Storybook）见 [docs/handoff.md](docs/handoff.md)。

## 在 PostgreSQL 上手工测试

除了内存里的测试服务，还有一个真正接数据库的采购订单服务：数据放在 PostgreSQL 里，由本仓库自写的 `smart-kit-server` 提供 OData V4 接口（ADR-027）。数据和内存测试服务完全相同（同一个生成器），业务规则也相同，所以两边看到的页面应该一样。它支持查看、编辑保存、新建、删除、审批 / 拒绝 / 关闭和保存视图；**草稿**不在其中（草稿服务 `/purchasing-draft` 仍由内存测试服务提供）。

**1. 准备**

- Node 24、npm 11，已经执行过 `npm install`。
- 本机有 PostgreSQL 17（macOS：`brew install postgresql@17`，再 `brew services start postgresql@17`），能用你的系统用户连上 `localhost:5432`。检查：

```bash
psql -h localhost -d postgres -c "select version()"
```

**2. 建数据库**（只需一次；可以重复执行，只建缺少的东西）

```bash
npm run pg:setup
```

它只创建这几样东西，不碰服务器上的其他数据库：角色 `smart_kit`（所有者）、`smart_kit_app`（服务用它连接，能读写这些表，不能改表结构）和 `smart_kit_reader`（只能读），数据库 `smart_kit_purchasing`，其中的 schema `purchasing`（11 张表）和 `purchasing_seed`（初始数据的副本，用来恢复），并写入 1 万张采购订单及其行项目、定价条件、收货和发票历史。想把数据恢复成初始状态：`npm run pg:setup -- --reseed`。管理员连接不是默认值时，设环境变量 `SMART_KIT_PG_ADMIN_URL`（例如 `postgresql://postgres:密码@localhost:5432/postgres`）。

**3. 重新生成 CSDL**（只有改了表结构才需要；仓库里已经有生成好的文件）

```bash
npm run pg:generate
```

它读取表结构，覆盖 `apps/pg-server/generated/` 下的两个文件（实体定义、表和列的对应关系），然后检查手写的注解文件 `apps/pg-server/annotations/purchasing.annotations.xml` 里指向的实体和字段是否都还在，不在的会列出来。注解文件本身永远不会被改写。

**4. 启动三个服务**（各开一个终端）

```bash
npm run mock
```

```bash
npm run pg
```

```bash
PURCHASING_URL=http://localhost:4402 npm run dev
```

- `npm run mock`：内存测试服务（4400），示例应用的其他服务和供应商头像还从这里来。
- `npm run pg`：PostgreSQL 上的采购订单服务，http://localhost:4402/odata/purchasing/ 。
- `PURCHASING_URL=… npm run dev`：示例应用（4401），`/odata/purchasing/` 改由 PostgreSQL 服务回答。不加 `PURCHASING_URL` 就还是内存测试服务，方便对比。

**5. 打开页面，看什么**

| 地址 | 看什么 |
| --- | --- |
| http://localhost:4401/po | 列表页：标题里的条数是 10000；试搜索（例如 `steel`）、筛选（状态、公司代码、订单日期）、点列头排序、往下滚动加载更多；值帮助（供应商、物料）能打开、能搜索 |
| http://localhost:4401/po?chart=1 | 列表页上方的图表视图：按状态汇总的金额（`$apply`） |
| 在列表里点 4500000001 | 对象页：页头的微图表、各区块的表单、150 行的行项目表（"更多"按钮继续加载） |
| 对象页上点"编辑"，改描述，点"保存" | 改动写进数据库（刷新后还在）；描述清空再保存，会出现"没有描述"的提示 |
| 列表里选一张"新建"状态的订单，点"审批" | 状态变成"已审批"，底部出现消息按钮，里面是成功消息 |
| 列表上点"新建"，填完必填字段 | 生成新订单号（从 4500010001 起），打开新订单的对象页 |
| 列表上"另存为"一个视图 | 视图存进数据库表 `purchasing.variant`，刷新后还能选 |
| 在行项目表里点一行 | 子对象页：定价条件、收货和发票历史，页头的折线图、面积图等系列图表 |
| http://localhost:4401/microcharts | 九种微图表的场景页（数据来自同一个服务） |
| 页面右上角切换中文 | 字段标签变成中文（来自标签包），状态名称等代码表文字也变成中文 |
| http://localhost:4402/odata/purchasing/$metadata | 合并后的元数据：生成的实体定义 + 手写的注解 |
| http://localhost:4402/odata/purchasing/PurchaseOrders?$top=3&$count=true | 原始的 OData 响应 |

想看服务实际执行的 SQL：在 PostgreSQL 里打开语句日志（`alter role smart_kit_reader set log_statement = 'all'`，日志位置见 `brew services info postgresql@17`），看完再 `alter role smart_kit_reader reset log_statement`。

想试数据范围（权限）：`PG_SCOPE_COMPANY=1000 npm run pg` 启动后，列表只剩公司代码 1000 的订单，其他订单的对象页返回"找不到"，也改不了、删不了。

想把数据恢复到初始状态（手工试过编辑之后）：`npm run pg:setup -- --reseed`，或者在 PostgreSQL 里执行 `select purchasing_seed.reset()`（约 1.5 秒）。

**6. 自动测试**

```bash
npm run e2e:pg
```

用 PostgreSQL 服务重跑示例应用的列表页、对象页、编辑、动作、视图、微图表和图表视图的端到端测试，三个服务会自动启动；每个用例之前数据会恢复到初始状态。单元测试 `npm test` 里还有一组一致性测试：同样的读写请求分别发给内存测试服务和 PostgreSQL 服务，比较响应。

## License

MIT
