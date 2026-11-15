# apps/mock — 本地 OData V4 测试服务

ASP.NET Core OData 9.5（.NET 10）+ EF Core SQLite。规格见 `docs/08-test-services.md`，选型见 `docs/adr/009-mock-server.md`。数据由固定种子生成，全部是虚构的。

## 运行

需要 .NET 10 SDK（`$DOTNET_ROOT`、`~/.dotnet` 或 PATH 上的 `dotnet`）。

```sh
npm start            # 构建并启动，http://localhost:4400
npm run reset        # 删除 data/*.db 后重新生成再启动
E2E=1 npm start      # 额外开放 POST /test/reset
```

首次启动在 `data/` 生成 `northwind.db`、`purchasing.seed.db`（种子）和 `purchasing.db`（工作库），约 1 秒。

## 端点

| 地址 | 说明 |
| --- | --- |
| `/odata/northwind/` | 仿 Northwind，命名空间 `NorthwindLike`，**没有任何注解** |
| `/odata/purchasing/` | 采购订单，命名空间 `Purchasing`，完整 UI / Common / Measures / Capabilities / Core 注解 |
| `…/$metadata`、`…/$metadata?$format=json` | CSDL XML / CSDL JSON |
| `/media/suppliers/{id}.svg` | 生成的供应商标志（`Supplier.LogoUrl`） |
| `POST /test/reset` | 只在 `E2E=1` 时存在：用种子库覆盖工作库（清空变体、撤销 PATCH） |

- 采购服务的 `$metadata` 由 `Csdl/purchasing.template.xml` 生成，`{{label:键}}` 换成 `Csdl/labels.en.json` 或 `labels.zh.json`；`Accept-Language` 以 `zh` 开头时返回中文，否则英文。数据里的代码文本（状态名、订单类型名、条件类型名、历史类别名）也按请求语言返回。
- 查询：`$select`、`$expand`（可嵌套）、`$filter`、`$orderby`、`$top`（最大 1000）、`$skip`、`$count`、`$search`（只在可搜索的实体集上）；服务端不分页。
- 请求头 `Accept: application/json;IEEE754Compatible=true` 时 Decimal 和计数以字符串返回，小数位与 CSDL 的 `Scale` 一致（如 `"99.00"`）。
- `PurchaseOrders`、`PurchaseOrderItems` 带 ETag（`Version`）；`PATCH` 带过期的 `If-Match` 返回 412。
- `Variants` 支持增删改查，`POST` 没给 `ID` 时由服务端生成。

## 服务端按 Capabilities 拒绝的请求（HTTP 400）

错误体：`{"error":{"code":"…","message":"…"}}`。规则从 `$metadata` 的注解读取，对实体集和导航到的实体集都生效。

| 请求 | 错误码 |
| --- | --- |
| 在 `SearchRestrictions/Searchable` 不为 true 的实体集上用 `$search`（northwind 全部；purchasing 只有 `PurchaseOrders`、`Suppliers`、`Materials` 可搜索） | `SearchNotSupported` |
| `ItemHistory` 上的 `$count=true` 或 `/$count`（含 `…/_History?$count=true`） | `CountNotSupported` |
| `PurchaseOrders` 的 `$filter` 引用 `Notes` | `PropertyNotFilterable` |
| `PurchaseOrders` 的 `$orderby` 包含 `Description` | `PropertyNotSortable` |

`FilterRestrictions/RequiredProperties`（`CompanyCode`）只声明，不强制。

宽松处理：OData 的 `$search` 语法只允许纯字母的单词，服务端会把 `4500000001`、`M8` 这类单词自动当作短语（`"4500000001"`）处理。
