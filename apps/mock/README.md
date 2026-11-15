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
| `/odata/purchasing/` | 采购订单，命名空间 `Purchasing`，完整 UI / Common / Measures / Capabilities / Core 注解 |
| `…/$metadata`、`…/$metadata?$format=json` | CSDL XML / CSDL JSON |
| `/media/suppliers/{id}.svg` | 生成的供应商标志（`Supplier.LogoUrl`） |
| `POST /test/reset` | 只在 `E2E=1` 时存在：清空变体、撤销所有修改 |

## 文件

| 文件 | 内容 |
| --- | --- |
| `server.mjs` | HTTP 服务：CORS、按语言的 `$metadata`、Capabilities 检查、`$search` 改写、ETag 和可修改字段、Decimal 字符串化，其余交给引擎 |
| `lib/purchasing.mjs`、`lib/northwind.mjs`、`lib/fake.mjs` | 数据生成（固定种子） |
| `lib/datasets.mjs`、`mockdata/<服务>/<实体集>.js` | 引擎的数据贡献者：初始数据和 `checkFilterValue` |
| `lib/filter.mjs` | `$search` → `$filter`、字符串字面量编码、OData 语义的比较 |
| `lib/csdl.mjs` | 标签占位符替换、CSDL XML → CSDL JSON |
| `Csdl/` | 手写的 CSDL（采购服务是带 `{{label:键}}` 的模板）和中英文标签 |
