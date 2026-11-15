# 08 测试服务

> 状态：现行 · 2026-11-15。代码在 `apps/mock`（Node，`@sap-ux/fe-mockserver-core` 加前置层 `server.mjs`）。选型理由见 `adr/017-mock-server-fe-mockserver.md`（取代 ADR-009 的 ASP.NET Core OData）。
>
> 两个服务都由本仓库编写，数据由固定随机种子生成，**不取自任何真实系统**，也不复制公开 Northwind 服务的数据。

## 1. 运行

| 命令 | 作用 |
| --- | --- |
| `npm run mock` | 启动测试服务，地址 `http://localhost:4400`（`MOCK_PORT` 可改）。数据在启动时按固定种子在内存里生成，约 0.1 秒；端口被占用时给出提示并退出 |
| `POST /test/reset` | 只在环境变量 `E2E=1` 时存在；清空变体，撤销所有修改。端到端测试在每个用例前调用 |

服务地址：

- 仿 Northwind：`/odata/northwind/`
- 采购订单：`/odata/purchasing/`

两个服务都：
- 支持 `$metadata`（XML，以及 `?$format=json` 的 CSDL JSON）；
- 支持 `$select`、`$expand`、`$filter`、`$orderby`、`$top`、`$skip`、`$count`；
- 支持 `IEEE754Compatible=true`。

## 2. 仿 Northwind 服务（无 UI 注解）

- **命名空间**：`NorthwindLike`。
- **实体集**：`Categories`、`Products`、`Suppliers`、`Customers`、`Orders`、`OrderDetails`、`Employees`。字段参照公开 Northwind V4 服务的结构，有删减。
- **注解**：只有数据结构，**没有任何注解**（包括 Capabilities）。
- **能力**：
  - 不支持 `$search`：服务端收到 `$search` 时返回 400。客户端按 Searchable 的默认值 false 不显示搜索框，所以不会发出这样的请求。
  - 支持 `$count`。
- **规模**：产品 500 个、订单 5,000 张、订单明细约 15,000 条。

## 3. 采购订单服务（完整注解）

- **命名空间**：`Purchasing`。
- **标签**：中英文两套，按 `Accept-Language` 返回。`$metadata` 由模板文件 `apps/mock/Csdl/purchasing.template.xml` 生成，模板里的 `{{label:键}}` 在启动时替换成 `labels.zh.json` 或 `labels.en.json` 里的文字。

| 实体集 | 键 | 主要字段 | 导航 | 规模 |
| --- | --- | --- | --- | --- |
| `PurchaseOrders` | `PurchaseOrder`（String 10） | `PurchaseOrderType`（固定值）、`Supplier`（值帮助，文本经 `_Supplier/SupplierName`）、`CompanyCode`、`OrderDate`（Date）、`CreatedAt`（DateTimeOffset）、`Status`（值帮助，状态色）、`StatusCriticality`、`NetAmount`（Decimal 15,2，币种 `Currency`）、`DeliveredPercent`（进度）、`Description`、`Notes`（多行，不可筛选）、`Version`（ETag） | `_Supplier`、`_Status`、`_Item`（1:n） | 10,000 张，其中 `4500000001` 有 150 个项目 |
| `PurchaseOrderItems` | `PurchaseOrder`、`PurchaseOrderItem`（Int32） | `Material`（值帮助，文本 `_Material/MaterialName`）、`Plant`、`OrderQuantity`（Decimal 13,3，单位 `OrderUnit`）、`NetPrice`、`NetAmount`、`Currency`、`DeliveryDate`、`ReceivedQuantity`、`InvoicedAmount`、`Version` | `_PurchaseOrder`、`_Material`、`_Plant`、`_PricingCondition`（1:n）、`_History`（1:n） | 约 30,000 |
| `PricingConditions` | `PurchaseOrder`、`PurchaseOrderItem`、`ConditionCounter` | `ConditionType`（固定值：基础价、折扣、运费、附加费）、`ConditionTypeName`、`Rate`（Decimal）、`RateUnit`、`ConditionAmount`、`Currency`、`IsStatistical` | `_Item` | 每个项目 2–4 条 |
| `ItemHistory` | `PurchaseOrder`、`PurchaseOrderItem`、`HistoryCounter` | `Category`（收货 / 发票）、`DocumentNumber`、`PostingDate`、`Quantity`（单位）、`Amount`（币种）、`MovementType` | `_Item` | 每个项目 0–3 条；**`Countable` 为 false**（用来测试能力降级） |
| `Suppliers` | `Supplier`（String 10） | `SupplierName`、`Country`、`City`、`Rating`（Decimal 2,1，评分）、`LogoUrl`（`UI.IsImageURL`，指向服务自带的生成 SVG）、`IsBlocked` | — | 200 |
| `Materials` | `Material` | `MaterialName`、`MaterialGroup`、`BaseUnit` | — | 500 |
| `Plants` | `Plant` | `PlantName`、`City` | — | 12 |
| `OrderStatuses` | `Code` | `Name`、`Criticality` | — | 5 |
| `Variants` | `ID`（Guid） | `PageKey`、`Name`、`IsDefault`、`AutoApply`、`Content`、`ModifiedAt` | — | 空 |

### 3.1 注解（覆盖 `02-annotation-coverage.md` 的一期术语）

| 目标 | 注解 |
| --- | --- |
| `PurchaseOrders` 实体类型 | `HeaderInfo`（标题 `PurchaseOrder`，副标题 `Description`，图片 `_Supplier/LogoUrl`）；`LineItem`（含 `DataFieldForAnnotation` 指向供应商评分和交货进度的 DataPoint，以及 `Criticality`）；`SelectionFields`（`PurchaseOrder`、`Supplier`、`Status`、`OrderDate`、`PurchaseOrderType`）；`PresentationVariant`（按 `OrderDate` 降序，`RequestAtLeast` 含 `Currency`）；`SelectionVariant`（默认条件：状态不等于"已关闭"）；`HeaderFacets`（表单：供应商与采购组；关键值：净值；进度：交货进度；评分：供应商评分）；`Facets`（"常规信息"区块含两个子区块；"项目"区块只有一张表；"备注"区块 `PartOfPreview=false` 的子区块） |
| `PurchaseOrderItems` 实体类型 | `HeaderInfo`、`LineItem`、`Facets`（"项目数据"表单；"定价"区块的第一个子区块是定价条件表，第二个子区块是金额表单，对应 OP-12 第 ③ 种情况；"历史"区块只有一张表） |
| 属性 | `Common.Label`、`Common.Text` + `UI.TextArrangement`、`Common.ValueList`、`Common.ValueListWithFixedValues`、`Measures.ISOCurrency`、`Measures.Unit`、`UI.Hidden`（`StatusCriticality`）、`UI.HiddenFilter`、`UI.MultiLineText`、`UI.IsImageURL`、`Common.SemanticKey`、`Core.Computed` |
| 实体集 | `Capabilities.SearchRestrictions`（`PurchaseOrders`、`PurchaseOrderItems`、`Suppliers`、`Materials` 可搜索）、`FilterRestrictions`（`Notes` 不可筛选；`CompanyCode` 必填并有默认值）、`SortRestrictions`（`Description` 不可排序）、`CountRestrictions`（`ItemHistory` 不可计数）、`UpdateRestrictions`（`PurchaseOrders` 可更新，供阶段 1.5 验证） |

服务端按这些 Capabilities 拒绝违反的请求，返回 400。这样，客户端如果发出了会失败的请求，端到端测试就会失败。

## 4. 一致性

- `npm run samples` 从运行中的服务导出 `$metadata`（两种语言 × XML 和 JSON），存到 `packages/core/test/samples/`，供单元测试离线使用。
- 单元测试 ANN-70 检查同一服务的 XML 样本和 JSON 样本得到相同模型。

## 5. 与上文的差异（实现时的调整）

- 多了 `PurchaseOrderTypes` 实体集（订单类型的固定值来源），以及 `PurchasingGroup` 字段（页头表单 Facet）。
- `PurchaseOrders` 的 Insert / Delete 限制为 false；项目和供应商有 `Common.SemanticKey`。
- 状态码：NEW（0）、APPR（3）、ORD（5）、PART（2）、CLOSED（3）；已下单或部分交货且交货日早于 2026-11-14 的订单，`StatusCriticality` 为 1（逾期）。
- `$metadata` 的 XML 是模板替换标签后的原文；CSDL JSON 由 `apps/mock/lib/csdl.mjs` 从 XML 转换。单元测试 ANN-70 保证两者得到相同模型。
- 代码表文本（状态名、订单类型名、条件类型名、历史类别名）按 `Accept-Language` 返回中文或英文；按这些文本筛选和排序时用的是英文原文。
- `$search` 由前置层改写成 `$filter`：每个词在该实体集的搜索字段里做不区分大小写的包含匹配（采购订单：订单号、描述、供应商名称；项目：物料、物料名称、工厂；供应商：编号、名称、城市；物料：编号、名称），词之间是"且"，支持 `OR`、`NOT`、括号和带引号的短语。
- 引擎的筛选有两处与 OData 不一致，已修正或绕开（ADR-017）：`eq null` / `ne null` 由数据贡献者的 `checkFilterValue` 重新实现；字符串里的 `''` 和 `"` 先换成私用区字符再交给引擎，比较时换回，但在 `contains` 等字符串函数里无法换回，这类条件匹配不到数据（请求仍然成功）。
- 引擎总是返回 `@odata.count`；前置层在请求没有 `$count=true` 时去掉它，这样"不可计数"的实体集也不会带出条数。
- 必填筛选（`RequiredProperties`）只声明、不在服务端强制。
- PATCH 只接受部分字段（采购订单：描述、备注、订单类型、采购组、订单日期；项目：交货日期、工厂），其他字段返回 400；`If-Match` 与当前 `Version` 不符时返回 412。
- 数据量与 .NET 版本相同的规则生成，但随机数生成器不同，具体数值和名称与 2026-11-14 之前不同（例如默认筛选下的采购订单是 1616 张）。
