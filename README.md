# smart-kit

> SAP、Fiori、SAPUI5 是 SAP SE 的注册商标。本项目与 SAP 无关联，未获任何授权或背书。

元数据驱动、白盒、可换主题的 React 组件库：从 OData V4 的 `$metadata` 与注解生成列表页和对象页的积木，页面由使用者在 JSX 里自己拼。

**状态：一期（只读的列表页、对象页、子对象页）和二期（编辑、草稿、弹性分栏及其余功能）已完成。** 验收结果见 [docs/10-acceptance-report.md](docs/10-acceptance-report.md) 和 [docs/14-phase2-acceptance-report.md](docs/14-phase2-acceptance-report.md)，目标与范围见 [docs/prompt/项目目标与范围-v5.md](docs/prompt/项目目标与范围-v5.md)。

## 包

| 包 | 内容 |
| --- | --- |
| `@rhfan2019/smart-kit-core` | 纯 TypeScript：CSDL 与注解解析、模型、查询生成、OData V4 和内存数据提供者、变体与页面状态存储 |
| `@rhfan2019/smart-kit` | React 积木：`SmartFilterBar`、`SmartTable`、`SmartField`、`SmartForm`、`ObjectPageLayout`、`SmartListReport`、`SmartObjectPage` 等；令牌与主题；中英文文案 |
| `@rhfan2019/smart-kit-server` | 只在 Node 里用：自写的 OData V4 服务（只读），把请求翻译成 PostgreSQL 的 SQL（ADR-027） |
| `@rhfan2019/smart-kit-cli` | 开发时用的命令 `smart-kit`：从 PostgreSQL 的表结构生成 CSDL，检查手写的注解是否失效 |

公开 API 见 [docs/api.md](docs/api.md)。

## 最小用法

```tsx
import { loadService } from '@rhfan2019/smart-kit-core';
import { SmartKitProvider, SmartListReport, smartKitMantineTheme, smartKitCssVariablesResolver } from '@rhfan2019/smart-kit';
import '@rhfan2019/smart-kit/styles.css';

const { model, provider } = await loadService({ serviceUrl: '/odata/purchasing/', fetch, language: 'zh' });

<MantineProvider theme={smartKitMantineTheme} cssVariablesResolver={smartKitCssVariablesResolver} forceColorScheme="light">
  <SmartKitProvider services={{ purchasing: { model, dataProvider: provider } }} locale="zh" namespace="my-app" navigation={myAdapter}>
    <SmartListReport entitySet="PurchaseOrders" />
  </SmartKitProvider>
</MantineProvider>
```

只用一部分组件时，可以从子路径引入，例如 `import { MicroChart } from '@rhfan2019/smart-kit/chart'`；应用只打包用到的代码，不用表格时也不必安装 AG Grid。子路径清单见 [docs/api.md](docs/api.md)，打包规则见 [ADR-026](docs/adr/026-bundling-and-subpaths.md)。

导航适配器的写法见 [apps/demo/src/navigation.ts](apps/demo/src/navigation.ts)；主题用根元素的 `data-theme`（`yellow` / `navy` / `dark`）和 `data-density`（`comfortable` / `compact`）切换。

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

其余命令（测试、端到端、构建、Storybook）见 [docs/handoff.md](docs/handoff.md)。

## 在 PostgreSQL 上手工测试

除了内存里的测试服务，还有一个真正接数据库的采购订单服务：数据放在 PostgreSQL 里，由本仓库自写的 `smart-kit-server` 提供 OData V4 接口（ADR-027）。数据和内存测试服务完全相同（同一个生成器），所以两边看到的页面应该一样。这个服务**只读**：没有新建、编辑、删除、审批这些按钮。

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

它只创建这几样东西，不碰服务器上的其他数据库：角色 `smart_kit`（所有者）和 `smart_kit_reader`（服务用它连接，只能读），数据库 `smart_kit_purchasing`，其中的 schema `purchasing` 和 9 张表，并写入 1 万张采购订单及其行项目、定价条件、收货和发票历史。想把数据恢复成初始状态：`npm run pg:setup -- --reseed`。管理员连接不是默认值时，设环境变量 `SMART_KIT_PG_ADMIN_URL`（例如 `postgresql://postgres:密码@localhost:5432/postgres`）。

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
| 在列表里点 4500000001 | 对象页：页头的微图表、各区块的表单、150 行的行项目表（"更多"按钮继续加载）；没有编辑、删除按钮 |
| 在行项目表里点一行 | 子对象页：定价条件、收货和发票历史，页头的折线图、面积图等系列图表 |
| http://localhost:4401/microcharts | 九种微图表的场景页（数据来自同一个服务） |
| 页面右上角切换中文 | 字段标签变成中文（来自标签包）；状态名称等代码表文字仍是英文，这是已知限制 |
| http://localhost:4402/odata/purchasing/$metadata | 合并后的元数据：生成的实体定义 + 手写的注解 |
| http://localhost:4402/odata/purchasing/PurchaseOrders?$top=3&$count=true | 原始的 OData 响应 |

想看服务实际执行的 SQL：在 PostgreSQL 里打开语句日志（`alter role smart_kit_reader set log_statement = 'all'`，日志位置见 `brew services info postgresql@17`），看完再 `alter role smart_kit_reader reset log_statement`。

想试数据范围（权限）：`PG_SCOPE_COMPANY=1000 npm run pg` 启动后，列表只剩公司代码 1000 的订单，其他订单的对象页返回"找不到"。

**6. 自动测试**

```bash
npm run e2e:pg
```

用 PostgreSQL 服务重跑示例应用的列表页、对象页、微图表和图表视图的端到端测试（需要写入的场景跳过），三个服务会自动启动。单元测试 `npm test` 里还有一组一致性测试：同样的请求分别发给内存测试服务和 PostgreSQL 服务，比较响应。

## License

MIT
