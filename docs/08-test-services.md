# 08 测试服务

> 状态：现行 · 2026-11-15。代码在 `apps/mock`（Node，`@sap-ux/fe-mockserver-core` 加前置层 `server.mjs`）。选型理由见 `adr/017-mock-server-fe-mockserver.md`（取代 ADR-009 的 ASP.NET Core OData）。
>
> 三个服务都由本仓库编写，数据由固定随机种子生成，**不取自任何真实系统**，也不复制公开 Northwind 服务的数据。二期新增的写操作、动作和草稿服务见 §3.2–§3.4（ADR-019、ADR-023、ADR-024）。

## 1. 运行

| 命令 | 作用 |
| --- | --- |
| `npm run mock` | 启动测试服务，地址 `http://localhost:4400`（`MOCK_PORT` 可改）。数据在启动时按固定种子在内存里生成，约 0.1 秒；端口被占用时给出提示并退出 |
| `POST /test/reset` | 只在环境变量 `E2E=1` 时存在；两个采购服务一起重置：清空变体，撤销所有修改（包括新建和删除的订单与项目、动作改过的状态、草稿）。端到端测试在每个用例前调用 |

服务地址：

- 仿 Northwind：`/odata/northwind/`
- 采购订单：`/odata/purchasing/`（直接保存：PATCH + ETag）
- 采购订单（草稿）：`/odata/purchasing-draft/`（同一份模板派生，见 §3.4）
- `GET /` 列出以上服务

三个服务都：
- 支持 `$metadata`（XML，以及 `?$format=json` 的 CSDL JSON）；
- 支持 `$select`、`$expand`、`$filter`、`$orderby`、`$top`、`$skip`、`$count`；
- 支持 `IEEE754Compatible=true`；
- 支持 `$apply`（`filter`、`groupby`、`aggregate`，由引擎实现），可以和 `$count=true` 一起用；Decimal 聚合值按属性的小数位返回。

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
| `PurchaseOrders` | `PurchaseOrder`（String 10） | `PurchaseOrderType`（固定值）、`Supplier`（值帮助，文本经 `_Supplier/SupplierName`）、`CompanyCode`（不可改）、`OrderDate`（Date）、`CreatedAt`（DateTimeOffset）、`Status`（值帮助，状态色）、`StatusCriticality`、`NetAmount`（Decimal 15,2，币种 `Currency`）、`DeliveredPercent`（进度）、`Description`、`Notes`（多行，不可筛选）、`Version`（ETag）；二期计算字段：`BudgetAmount`（= 净值 × 1.2）、`InvoicedAmount`（项目已开票金额之和）、`ApproveEnabled`（状态为 NEW）、`CloseEnabled`（状态不是 CLOSED），后两个隐藏 | `_Supplier`、`_Status`、`_Item`（1:n） | 10,000 张，其中 `4500000001` 有 150 个项目、备注里有一个链接（`Terms: https://example.com/terms`），`4500000002` 有 230 个项目 |
| `PurchaseOrderItems` | `PurchaseOrder`、`PurchaseOrderItem`（Int32） | `Material`（值帮助，文本 `_Material/MaterialName`）、`Plant`、`OrderQuantity`（Decimal 13,3，单位 `OrderUnit`）、`NetPrice`、`NetAmount`、`Currency`、`DeliveryDate`、`ReceivedQuantity`、`InvoicedAmount`、`Version` | `_PurchaseOrder`、`_Material`、`_Plant`、`_PricingCondition`（1:n）、`_History`（1:n） | 约 30,000 |
| `PricingConditions` | `PurchaseOrder`、`PurchaseOrderItem`、`ConditionCounter` | `ConditionType`（固定值：基础价、折扣、运费、附加费）、`ConditionTypeName`、`Rate`（Decimal）、`RateUnit`、`ConditionAmount`、`Currency`、`IsStatistical` | `_Item` | 每个项目 2–4 条 |
| `ItemHistory` | `PurchaseOrder`、`PurchaseOrderItem`、`HistoryCounter` | `Category`（收货 / 发票）、`DocumentNumber`、`PostingDate`、`Quantity`（单位）、`Amount`（币种）、`MovementType` | `_Item` | 每个项目 0–3 条；**`Countable` 为 false**（用来测试能力降级） |
| `Suppliers` | `Supplier`（String 10） | `SupplierName`、`Country`、`City`、`Rating`（Decimal 2,1，评分）、`RatingCount`（Int32，评分次数 5–400，由编号的散列得出）、`LogoUrl`（`UI.IsImageURL`，指向服务自带的生成 SVG）、`IsBlocked` | — | 200 |
| `Materials` | `Material` | `MaterialName`、`MaterialGroup`、`BaseUnit` | — | 500 |
| `Plants` | `Plant` | `PlantName`、`City` | — | 12 |
| `OrderStatuses` | `Code` | `Name`、`Criticality` | — | 6（二期加了 `REJ` 已拒绝，只由"拒绝"动作产生） |
| `Variants` | `ID`（Guid） | `PageKey`、`Name`、`IsDefault`、`AutoApply`、`Content`、`ModifiedAt` | — | 空 |

### 3.1 注解（覆盖 `02-annotation-coverage.md` 的一期术语）

| 目标 | 注解 |
| --- | --- |
| `PurchaseOrders` 实体类型 | `HeaderInfo`（标题 `PurchaseOrder`，副标题 `Description`，图片 `_Supplier/LogoUrl`）；`LineItem`（含 `DataFieldForAnnotation` 指向供应商评分和交货进度的 DataPoint，以及 `Criticality`）；`SelectionFields`（`PurchaseOrder`、`Supplier`、`Status`、`OrderDate`、`PurchaseOrderType`）；`PresentationVariant`（按 `OrderDate` 降序，`RequestAtLeast` 含 `Currency`）；`SelectionVariant`（默认条件：状态不等于"已关闭"）；`HeaderFacets`（表单：供应商与采购组；关键值：净值；进度：交货进度；评分：供应商评分）；`Facets`（"常规信息"区块含两个子区块；"项目"区块只有一张表；"备注"区块 `PartOfPreview=false` 的子区块） |
| `PurchaseOrderItems` 实体类型 | `HeaderInfo`、`LineItem`、`Facets`（"项目数据"表单；"定价"区块的第一个子区块是定价条件表，第二个子区块是金额表单，对应 OP-12 第 ③ 种情况；"历史"区块只有一张表） |
| 属性 | `Common.Label`、`Common.Text` + `UI.TextArrangement`、`Common.ValueList`、`Common.ValueListWithFixedValues`、`Measures.ISOCurrency`、`Measures.Unit`、`UI.Hidden`（`StatusCriticality`）、`UI.HiddenFilter`、`UI.MultiLineText`、`UI.IsImageURL`、`Common.SemanticKey`、`Core.Computed` |
| 实体集 | `Capabilities.SearchRestrictions`（`PurchaseOrders`、`PurchaseOrderItems`、`Suppliers`、`Materials` 可搜索）、`FilterRestrictions`（`Notes` 不可筛选；`CompanyCode` 必填并有默认值；二期起 `FilterExpressionRestrictions`：`OrderDate` SingleRange、`PurchaseOrderType` SingleValue、`PurchasingGroup` MultiValue、`Description` SearchExpression，违反时前置层返回 400 `FilterExpressionNotAllowed`）、`SortRestrictions`（`Description` 不可排序）、`CountRestrictions`（`ItemHistory` 不可计数）、`UpdateRestrictions`（`PurchaseOrders` 可更新，供阶段 1.5 验证） |

| 二期：`PurchaseOrders` 实体类型 | `LineItem` 各列的 `UI.Importance`（订单号、供应商、状态、净值 High；订单日期 Medium；供应商评分、交货进度、订单类型 Low），以及三个 `DataFieldForAction`：`Purchasing.approve`（审批）、`Purchasing.reject`（拒绝）、`Purchasing.close`（关闭，`Inline=true`）；`LineItem#Delivery`（订单号、供应商、交货进度、订单日期、净值）；`Identification`（审批、拒绝 `Determining=true`，关闭不是）；`FieldGroup#General` 的 `UI.Importance`（采购组、描述 Medium，创建时间 Low）；`SelectionPresentationVariant#All` / `#Open`（状态 NEW、APPR、ORD）/ `#InDelivery`（状态 PART，用 `LineItem#Delivery`）/ `#Closed`（状态 CLOSED），都带 `CompanyCode EQ 1000` 和按订单日期降序，`#All` 的第二个可视化是 `@UI.Chart#ByStatus`；`Aggregation.ApplySupported`（可分组：`Status`、`PurchaseOrderType`、`CompanyCode`、`Supplier`；可聚合：`NetAmount`）；`Chart#ByStatus`（柱形，维度状态，度量净值）、`Chart#ByType`（条形，维度订单类型）；`DataPoint#Budget`（值净值，目标 `BudgetAmount`，最小值 0）、`DataPoint#Invoiced`（值已开票金额，目标净值）；`Chart#BudgetBullet`（Bullet，度量净值，`MeasureAttributes` 指向 `DataPoint#Budget`）、`Chart#DeliveryRadial`（Donut，度量交货进度，指向 `DataPoint#Delivery`）；`FieldGroup#NotesText`（只有多行的备注）；`HeaderFacets` 追加 `HeaderBudget`、`HeaderDeliveryRadial`、`HeaderNotes`。`HeaderInfo` 不变 |
| 二期：`PurchaseOrderItems` 实体类型 | `HeaderFacets`：`ItemHarvey` → `@UI.Chart#ReceivedShare`（Pie，度量已收数量，`DataPoint#Received` 的目标是订单数量：哈维球）、`ItemDelta` → `@UI.Chart#InvoiceDelta`（Waterfall，度量净值和已开票金额：本库用 Waterfall 表示 Delta 微图）、`ItemConditions` → `_PricingCondition/@UI.Chart#Amounts`（Bar，比较图，维度条件类型名称，度量条件金额）、`ItemPricingColumn` → `_PricingCondition/@UI.Chart#AmountColumns`（Column，维度条件序号）、`ItemHistoryLine` → `_History/@UI.Chart#Quantities`（Line，维度历史序号，度量数量）。图表注解放在 `PricingCondition`、`ItemHistory` 类型上 |
| 二期：`Suppliers` 实体类型 | `FieldGroup#QuickView`（国家、城市、评分、冻结）、`QuickViewFacets`（一个指向它的 `ReferenceFacet`）；`DataPoint#Rating` 加了 `SampleSize`（路径 `RatingCount`）。`HeaderInfo`（类型名、标题 `SupplierName`、描述 `Supplier`、图片 `LogoUrl`）一期已有 |
| 二期：属性和动作 | `Common.FieldControl`（`Mandatory`）：订单的 `Supplier`、`CompanyCode`、`PurchaseOrderType`、`PurchasingGroup`、`OrderDate`，项目的 `Material`、`Plant`、`OrderQuantity`；`Core.Immutable`：订单的 `CompanyCode`、项目的 `Material`；动作 `approve`、`reject`、`close`（绑定参数 `_it`，返回订单）的 `Core.OperationAvailable`：`_it/ApproveEnabled`（审批、拒绝）、`_it/CloseEnabled`（关闭） |
| 二期：实体集 | `PurchaseOrders` 的 `InsertRestrictions`、`DeleteRestrictions` 改为 true；`PurchaseOrderItems` 加了 `UpdateRestrictions`、`InsertRestrictions`、`DeleteRestrictions`（都为 true） |

服务端按这些 Capabilities 拒绝违反的请求，返回 400。这样，客户端如果发出了会失败的请求，端到端测试就会失败。

### 3.2 写操作（`/odata/purchasing/`，直接保存）

| 请求 | 行为 |
| --- | --- |
| `POST PurchaseOrders` | 必填 `Supplier`、`CompanyCode`、`PurchaseOrderType`、`PurchasingGroup`、`OrderDate`；可选 `Description`、`Notes`。服务端给出下一个编号（现有最大号 + 1，首个是 `4500010001`），状态 NEW、净值 0、币种按公司代码（1000 EUR、2000 USD、3000 CNY、4000 JPY）、交货进度 0、创建时间为当前时间、`Version` 1。返回 201、实体、`ETag` 和 `Location` |
| `PATCH PurchaseOrders('…')` | 可改 `Description`、`Notes`、`PurchaseOrderType`、`PurchasingGroup`、`OrderDate`、`Supplier`；`CompanyCode` 只能在新建时给出。`If-Match` 过期返回 412 |
| `DELETE PurchaseOrders('…')` | 204，项目一起删除；`If-Match` 与 PATCH 相同 |
| `POST PurchaseOrders('…')/_Item` | 必填 `Material`、`Plant`、`OrderQuantity`（> 0）；可选 `DeliveryDate`（默认订单日期 + 14 天）。项目号为该订单最大项目号 + 10；净价取物料的常用价格（换算成订单币种，没有时为 1），金额 = 数量 × 净价，币种取订单，单位取物料 |
| `PATCH` / `DELETE PurchaseOrderItems(…)` | 可改 `DeliveryDate`、`Plant`、`OrderQuantity`（金额随之重算）；删除返回 204 |
| 校验失败 | 400，`error.details[]` 每条有 `code`、`message`、`target`（属性名）。代码：`MANDATORY`、`UNKNOWN_VALUE`（供应商、公司代码、订单类型、物料、工厂不存在）、`NOT_POSITIVE`、`DATE_TOO_LATE`（`OrderDate` 晚于 2099-12-31，新建和 PATCH 都检查） |
| 订单合计 | 项目新建、修改、删除后，订单的 `NetAmount`、`InvoicedAmount`、`BudgetAmount` 重算（订单的 `Version` 不变） |
| 警告 | 订单 POST / PATCH 成功后没有描述时，响应头 `sap-messages` 带一条警告：`numericSeverity` 3，`target` `Description`，"The purchase order has no description." |

**绑定动作**（ADR-024）：`POST PurchaseOrders('…')/Purchasing.approve`（只在状态 NEW 时，变成 APPR）、`…/Purchasing.reject`（只在 NEW 时，变成 REJ，状态色 1）、`…/Purchasing.close`（除 CLOSED 外都可以，变成 CLOSED）。请求体 `{}`；可带 `If-Match`。成功返回 200 和更新后的订单（`Version` + 1，新 `ETag`），响应头 `sap-messages` 例如 `[{"code":"PO_APPROVED","message":"Purchase order 4500010001 approved.","numericSeverity":1,"target":""}]`。不可用时返回 400，例如 "Purchase order 4500000005 cannot be approved in status Closed."。`numericSeverity`：1 成功、2 信息、3 警告、4 错误。

**语言**：`Accept-Language: zh` 时错误和 `sap-messages` 的文字是中文（字段名取 `labels.zh.json`）。`sap-messages` 是 HTTP 头，非 ASCII 字符以 `\uXXXX` 转义，`JSON.parse` 后就是原文。

### 3.3 订单数据的二期补充

新数据都在主循环之后生成，主循环的随机数序列不变，一期已有的行不变（除下面两条）：

- `4500000001` 的 `Notes` 为 `Terms: https://example.com/terms`（原来为空）。
- `4500000002` 用另一个种子补到 230 个项目（项目号接着原有的 10 往后排，到 2300）；补的项目每个只有一条基础价条件、没有历史；该订单已关闭，所以补的项目全部收货、开票，订单净值随之变化。

### 3.4 草稿服务 `/odata/purchasing-draft/`（ADR-019）

启动时由 `apps/mock/lib/draft.mjs` 从同一份模板派生（中英文两套标签），命名空间仍是 `Purchasing`：

- `PurchaseOrder` 和 `PurchaseOrderItem` 的键加上 `IsActiveEntity`（Boolean），并有 `HasActiveEntity`、`HasDraftEntity` 和导航 `DraftAdministrativeData`（实体类型 `DraftAdministrativeData`，键 `DraftUUID`，字段 `DraftEntityType`、`CreationDateTime`、`CreatedByUser`、`DraftIsCreatedByMe`、`LastChangeDateTime`、`LastChangedByUser`、`DraftIsLastChangedByMe`、`InProcessByUser`、`DraftIsProcessedByMe`、`DraftAccessType`、`DraftIsKeptByUser` 和三个 `…Description`；实体集 `DraftAdministrativeData`）。草稿管理数据与实体内联存放（引擎的做法），用 `$expand=DraftAdministrativeData` 读取。
- 绑定动作 `Purchasing.draftEdit`（参数 `PreserveChanges`）、`Purchasing.draftActivate`、`Purchasing.draftPrepare`（参数 `SideEffectsQualifier`）；`PurchaseOrders` 有 `Common.DraftRoot`（`ActivationAction`、`EditAction`、`PreparationAction`），`PurchaseOrderItems` 有 `Common.DraftNode`。引擎不支持 `NewAction`，新建草稿用 POST。放弃草稿用 DELETE（OData V4 的做法，没有声明 `DiscardAction`）。
- 数据：与 `/odata/purchasing/` 相同的行，`IsActiveEntity` true、`HasActiveEntity` false、`HasDraftEntity` false。`4500000004` 有一份**其他用户**的草稿：创建人、上次更改人、处理人都是 `Alex Miller`（虚构），`DraftIsCreatedByMe` false，`LastChangeDateTime` 2026-11-14T09:30:00Z，草稿里描述后加了 " (rescheduled)"；它的活动版本 `HasDraftEntity` 为 true。当前用户是引擎的默认用户 `nobody`。
- 变体（`Variants`）单独存放，与直接保存服务互不影响。

| 请求 | 行为 |
| --- | --- |
| `POST PurchaseOrders` | 新建草稿（`IsActiveEntity=false`，编号同 §3.2），字段可以都不给；订单日期默认今天。必填项在激活时检查 |
| `POST PurchaseOrders(PurchaseOrder='…',IsActiveEntity=true)/Purchasing.draftEdit` | 建立（已有自己的草稿时返回该草稿）并返回草稿，项目一起复制。其他用户的草稿：409，"Locked by Alex Miller."（中文"已被 Alex Miller 锁定。"） |
| `PATCH PurchaseOrders(PurchaseOrder='…',IsActiveEntity=false)` | 可改字段同 §3.2；从未激活过的新草稿还可以改 `CompanyCode`（币种随之变化）。描述被改成空时带 `sap-messages` 警告。`If-Match` 规则同上 |
| `POST …(IsActiveEntity=false)/_Item`、`PATCH` / `DELETE` 草稿项目 | 同 §3.2，但项目的必填项也到激活时才检查 |
| `POST …(IsActiveEntity=false)/Purchasing.draftActivate` | 检查订单必填项、`OrderDate` ≤ 2099-12-31 和每个草稿项目的必填项，失败返回 400 和 `details`（项目的 `target` 形如 `_Item(PurchaseOrder='…',PurchaseOrderItem=10,IsActiveEntity=false)/Plant`）；成功返回活动版本（`Version` + 1） |
| `DELETE PurchaseOrders(PurchaseOrder='…',IsActiveEntity=false)` | 放弃草稿（含草稿项目），活动版本的 `HasDraftEntity` 变回 false |
| 写活动版本 | `PATCH` / `DELETE` / `POST _Item` 指向 `IsActiveEntity=true` 的订单或项目：400，代码 `DRAFT_REQUIRED`（"Edit the draft …"）。变体不受限制 |
| 其他用户的草稿 | 对 `4500000004` 草稿的 PATCH、DELETE、激活：409 |
| 绑定动作 | `approve`、`reject`、`close` 只用于活动版本（草稿上返回 400），规则同 §3.2 |

**编辑状态筛选**：`IsActiveEntity`、`HasDraftEntity`、`DraftAdministrativeData/InProcessByUser`、`DraftAdministrativeData/DraftIsCreatedByMe` 都可以用在 `$filter` 里。本服务没有 `SiblingEntity`，对应 Fiori Elements 的编辑状态：

| 编辑状态 | `$filter` |
| --- | --- |
| 全部（隐藏有自己草稿的活动版本） | `(IsActiveEntity eq false and DraftAdministrativeData/DraftIsCreatedByMe eq true) or (IsActiveEntity eq true and (HasDraftEntity eq false or DraftAdministrativeData/DraftIsCreatedByMe eq false))` |
| 自己的草稿 | `IsActiveEntity eq false and DraftAdministrativeData/DraftIsCreatedByMe eq true` |
| 被其他用户锁定 | `IsActiveEntity eq true and HasDraftEntity eq true and DraftAdministrativeData/DraftIsCreatedByMe eq false and DraftAdministrativeData/InProcessByUser ne ''` |
| 其他用户未保存的更改 | `IsActiveEntity eq true and HasDraftEntity eq true and DraftAdministrativeData/DraftIsCreatedByMe eq false and DraftAdministrativeData/InProcessByUser eq ''` |
| 没有更改 | `IsActiveEntity eq true and HasDraftEntity eq false` |

其他用户的草稿行（`4500000004`，`IsActiveEntity=false`）也在实体集里，所以"自己的草稿"必须带 `DraftIsCreatedByMe`。

### 3.5 二期新增的标签键

`labels.en.json` / `labels.zh.json` 各加了以下键：

- 字段：`F.BudgetAmount`、`F.ApproveEnabled`、`F.CloseEnabled`、`F.RatingCount`
- 动作：`A.Approve`、`A.Reject`、`A.Close`
- 数据点：`DP.Budget`、`DP.Invoiced`、`DP.Received`
- 图表标题：`CH.ByStatus`、`CH.ByType`、`CH.BudgetBullet`、`CH.DeliveryRadial`、`CH.ReceivedShare`、`CH.InvoiceDelta`、`CH.Amounts`、`CH.AmountColumns`、`CH.Quantities`
- 字段组：`FG.NotesText`、`FG.QuickView`
- 视图：`SPV.All`、`SPV.Open`、`SPV.InDelivery`、`SPV.Closed`
- 草稿服务：`T.DraftAdministrativeData`、`F.IsActiveEntity`、`F.HasActiveEntity`、`F.HasDraftEntity`、`F.Draft.<字段名>`（`DraftAdministrativeData` 的 15 个字段）

已有的 `F.InvoicedAmount` 同时用于订单的 `InvoicedAmount`。

## 4. 一致性

- `npm run samples` 从运行中的服务导出 `$metadata`（两种语言 × XML 和 JSON），存到 `packages/core/test/samples/`，供单元测试离线使用。
- 单元测试 ANN-70 检查同一服务的 XML 样本和 JSON 样本得到相同模型。

## 5. 与上文的差异（实现时的调整）

- 多了 `PurchaseOrderTypes` 实体集（订单类型的固定值来源），以及 `PurchasingGroup` 字段（页头表单 Facet）。
- 一期 `PurchaseOrders` 的 Insert / Delete 限制为 false，二期改为 true（§3.2）；项目和供应商有 `Common.SemanticKey`。
- 状态码：NEW（0）、APPR（3）、ORD（5）、PART（2）、CLOSED（3），二期加 REJ（1，只由"拒绝"动作产生）；已下单或部分交货且交货日早于 2026-11-14 的订单，`StatusCriticality` 为 1（逾期）。
- `$metadata` 的 XML 是模板替换标签后的原文；CSDL JSON 由 `apps/mock/lib/csdl.mjs` 从 XML 转换。单元测试 ANN-70 保证两者得到相同模型。
- 代码表文本（状态名、订单类型名、条件类型名、历史类别名）按 `Accept-Language` 返回中文或英文；按这些文本筛选和排序时用的是英文原文。
- `$search` 由前置层改写成 `$filter`：每个词在该实体集的搜索字段里做不区分大小写的包含匹配（采购订单：订单号、描述、供应商名称；项目：物料、物料名称、工厂；供应商：编号、名称、城市；物料：编号、名称），词之间是"且"，支持 `OR`、`NOT`、括号和带引号的短语。
- 引擎的筛选有两处与 OData 不一致，已修正或绕开（ADR-017）：`eq null` / `ne null` 由数据贡献者的 `checkFilterValue` 重新实现；字符串里的 `''` 和 `"` 先换成私用区字符再交给引擎，比较时换回，但在 `contains` 等字符串函数里无法换回，这类条件匹配不到数据（请求仍然成功）。
- 引擎总是返回 `@odata.count`；前置层在请求没有 `$count=true` 时去掉它，这样"不可计数"的实体集也不会带出条数。
- 必填筛选（`RequiredProperties`）只声明、不在服务端强制。
- PATCH 只接受部分字段（采购订单：描述、备注、订单类型、采购组、订单日期，二期加供应商；项目：交货日期、工厂，二期加订单数量），其他字段返回 400；`If-Match` 与当前 `Version` 不符时返回 412。
- 业务规则（编号、默认值、计算字段、订单合计、动作、草稿锁和激活校验）是引擎数据贡献者的钩子（`apps/mock/lib/rules.mjs`），两个采购服务共用；字段白名单、校验、`If-Match`、写活动版本的拒绝和"无描述"警告在前置层 `server.mjs`。
- 引擎对 `DraftAdministrativeData/InProcessByUser` 的筛选总是返回 false（`DraftMockEntitySet.checkSpecificProperties`）；前置层在启动时改写这个方法，让它按普通路径比较。
- 引擎把 `$top=0` 当成不限条数；前置层在这种情况下返回空的 `value`（`@odata.count` 照常）。
- `$batch` 直接交给引擎，不经过前置层的检查（与一期相同）。
- 数据量与 .NET 版本相同的规则生成，但随机数生成器不同，具体数值和名称与 2026-11-14 之前不同（例如默认筛选下的采购订单是 1616 张）。
