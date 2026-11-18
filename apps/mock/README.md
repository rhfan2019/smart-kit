# apps/mock — 本地 OData V4 测试服务

纯 Node：查询引擎是 SAP 开源的 `@sap-ux/fe-mockserver-core`（Apache-2.0），`server.mjs` 是前置层。规格见 `docs/08-test-services.md`，选型见 `docs/adr/017-mock-server-fe-mockserver.md`。数据由固定种子生成，全部是虚构的。

## 运行

```sh
npm start            # http://localhost:4400
E2E=1 npm start      # 额外开放 POST /test/reset
MOCK_PORT=4500 npm start
```

数据在启动时于内存里生成（约 0.1 秒），不写文件；`data/` 里只有给查询引擎读的 `$metadata` 副本（不提交）。端口被占用时会提示并退出。

## 端点

| 地址 | 说明 |
| --- | --- |
| `/odata/northwind/` | 仿 Northwind，命名空间 `NorthwindLike`，**没有任何注解** |
| `/odata/purchasing/` | 采购订单，命名空间 `Purchasing`，完整 UI / Common / Measures / Capabilities / Core / Aggregation 注解，成本中心层级（`CostCenters`，Hierarchy 注解，TopLevels）；直接保存（新建、PATCH、删除、绑定动作 `approve` / `reject` / `close`） |
| `/odata/purchasing-draft/` | 同一份模板派生的草稿服务（`IsActiveEntity` 键、`draftEdit` / `draftActivate` / `draftPrepare`、`Common.DraftRoot` / `DraftNode`）；`4500000004` 有其他用户（虚构的 Alex Miller）的草稿 |
| `/odata/purchasing-vh/` | 采购服务的值帮助服务（阶段 4 收尾）：`CompanyCodes`，`$metadata` 里有给采购服务属性的 `Common.ValueListMapping`（目标 `Purchasing.PurchaseOrder/CompanyCode`）；采购服务里引用它的 `Common.ValueListReferences` 由 `tests/e2e-fe/vhref.spec.ts` 叠加 |
| `GET /` | 服务列表 |
| `…/$metadata`、`…/$metadata?$format=json` | CSDL XML / CSDL JSON |
| `/media/suppliers/{id}.svg` | 生成的供应商标志（`Supplier.LogoUrl`） |
| `POST /test/reset` | 只在 `E2E=1` 时存在：两个采购服务一起重置（变体、新建和删除的行、动作结果、草稿） |

## 文件

| 文件 | 内容 |
| --- | --- |
| `server.mjs` | HTTP 服务：CORS、按语言的 `$metadata`、Capabilities 检查、`$search` 改写、ETag 和可修改 / 可新建字段、校验（400 + `details`）、草稿服务的写规则（活动版本只读、其他用户的锁 409）、`sap-messages` 警告、Decimal 字符串化，其余交给引擎 |
| `lib/rules.mjs` | 业务规则，作为引擎数据贡献者的钩子：编号和默认值、计算字段、订单合计、绑定动作、草稿锁和激活校验 |
| `lib/messages.mjs` | 中英文消息文字、`sap-messages` 严重级别、OData 错误体 |
| `lib/draft.mjs` | 由采购模板派生草稿服务的 XML 变换，以及草稿服务的数据（含其他用户的草稿） |
| `lib/purchasing.mjs`、`lib/northwind.mjs`、`lib/fake.mjs` | 数据生成（固定种子） |
| `lib/datasets.mjs`、`mockdata/<服务>/<实体集>.js` | 引擎的数据贡献者：初始数据、`checkFilterValue` 和 `lib/rules.mjs` 的钩子（`mockdata/purchasing-draft/` 是草稿服务的） |
| `lib/filter.mjs` | `$search` → `$filter`、字符串字面量编码、OData 语义的比较 |
| `lib/csdl.mjs` | 标签占位符替换、CSDL XML → CSDL JSON |
| `Csdl/` | 手写的 CSDL（采购服务是带 `{{label:键}}` 的模板）和中英文标签 |
| `lib/spend.mjs`、`Csdl/purchasing-vh.xml` | 阶段 4 收尾：参数化实体集 `SpendParameters`（`Common.ResultContext`，结果在包含导航 `Set` 里，`SpendParameters(P_DisplayCurrency='EUR',P_KeyDate=2026-11-14)/Set` 按参数现算供应商支出）和值帮助服务 `purchasing-vh` 的数据 |
