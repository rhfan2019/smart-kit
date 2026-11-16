# 05 数据提供者、查询生成与能力降级

> 状态：现行 · 2026-11-14。代码在 `packages/core/src/data`、`packages/core/src/query`、`packages/core/src/conditions`。

## 1. 接口

```ts
/** 读能力：一期实现 */
interface ReadDataProvider {
  query(req: QueryRequest, opts?: { signal?: AbortSignal }): Promise<QueryResult>;
  read(path: EntityPath, req: ReadRequest, opts?: { signal?: AbortSignal }): Promise<Row>;
}
/** 写能力：一期只定义，阶段 1.5 的验证代码实现；二期正式实现 */
interface WriteDataProvider {
  update(path: EntityPath, patch: Row, opts: { etag?: string; signal?: AbortSignal }): Promise<{ row: Row; etag?: string }>;
}
type DataProvider = ReadDataProvider & Partial<WriteDataProvider>;

interface QueryRequest {
  /** 实体集，或"父对象路径 + 集合导航"（子表） */
  source: { entitySet: string } | { parent: EntityPath; navigation: string };
  select: string[];                  // 属性路径（可以经过单值导航，如 _Supplier/Name）
  expand: ExpandSpec[];              // 由 select 里经过导航的路径推导，也可以显式给出
  filters?: FilterState;             // 条件模型，见第 3 节；字段之间为"且"
  anyOf?: FilterState;               // 任一字段满足即可（值帮助在不支持 $search 时的回退）
  search?: string;
  orderBy: { path: string; descending: boolean }[];
  skip?: number; top?: number;
  count: boolean;
}
interface QueryResult { rows: Row[]; count?: number }   // count 只在请求了而且服务支持时才有
type Row = Record<string, unknown>;   // 见第 4 节的类型表示
```

两个实现：

- **`ODataV4Provider`**：
  - 构造参数：`{ serviceUrl, fetch, getLanguage }`。`fetch` 由使用者注入，库不处理登录和令牌。
  - 每个请求带 `Accept: application/json;odata.metadata=minimal;IEEE754Compatible=true` 和 `Accept-Language`。
  - 一期不用 `$batch`，理由见 `adr/015-no-batch-phase1.md`。
- **`MemoryProvider`**：
  - 构造参数：`{ model, data: { [entitySet]: Row[] } }`。
  - 直接对 `QueryRequest` 求值（筛选、搜索、排序、分页、计数、展开），不经过 URL。
  - 用于单元测试、Storybook，以及没有后端的演示。

## 2. 查询生成（`buildListRequest`、`toQueryString`）

| 选项 | 规则 | 编号 |
| --- | --- | --- |
| `$select` | 主键 + 可见列的路径 + 每列的附属路径（`Common.Text` 指向的文本、单位或币种、状态色路径、DataPoint 的值和目标值、图片地址）+ `PresentationVariant/RequestAtLeast`。去重，按出现顺序。**不取不可见的列**。经过单值导航的路径从 `$select` 移进对应导航的 `$expand($select=…)` | Q-01 |
| `$expand` | 只展开单值导航；同一导航的多个字段合并成一个 `$expand=_Supplier($select=Name,Country)`；`ExpandRestrictions` 不允许展开的导航不出现，模型给出警告，该列显示为空 | Q-02 |
| `$filter` | 由条件模型生成，见第 3 节。字段之间用 `and`；搜索不进 `$filter` | Q-03 |
| `$search` | 只在 `SearchRestrictions/Searchable` 为 true 时发送；按原样传，做 URL 编码 | Q-04 |
| `$orderby` | 当前排序；没有时用 `PresentationVariant/SortOrder`；不可排序的字段被丢弃 | Q-05 |
| 金额和数量列的排序 | 列带 `ISOCurrency` / `Unit` 路径时，先按单位路径升序，再按值排序（与 Fiori Elements 一致） | Q-05b |
| 分页 | 网格表格按块加载，每块 100 行（`$skip`、`$top`）；子表初始 10 行，"更多"每次再取 20 行 | Q-06 |
| `$count` | 列表和子表的第一块带 `$count=true`；`Countable` 为 false 时不带，条数显示为空，网格表格用"本块不满就停止"判断结尾 | Q-07 |
| 对象读取 | `GET 实体路径?$select=…&$expand=…`，一次读取页头（HeaderInfo、HeaderFacets）和**所有区块**表单用到的字段（与 Fiori Elements 一致）。子表各自单独查询，在区块进入视口附近时才发出（OP-16） | Q-08 |
| 值帮助 | `GET CollectionPath?$select=<全部参数>&$count=true&$orderby=<键>&$top=50`。有搜索词时：`SearchSupported` 为 true 就用 `$search`，否则对字符串类型参数用 `contains` 组合成 `or` | Q-09 |
| 键的格式 | 单键 `Set('A')` 或 `Set(10)`；复合键 `Set(K1='A',K2=10)`；字符串里的单引号写成两个；Guid 不加引号 | Q-10 |

参考应用（[APP]，剔除草稿部分）的查询形状，与以上规则对照的结论记在 `docs/query-shapes.md`。

## 3. 条件模型

```ts
interface Condition {
  operator: 'EQ' | 'NE' | 'BT' | 'NB' | 'LT' | 'LE' | 'GT' | 'GE'
          | 'Contains' | 'NotContains' | 'StartsWith' | 'EndsWith' | 'Empty' | 'NotEmpty';
  values: unknown[];        // 0、1 或 2 个值，按属性类型表示
  exclude?: boolean;        // 排除条件（值帮助对话框里的"排除"）
  text?: string;            // 只用于显示，例如值帮助选中项的描述
}
type FilterState = Record<string /* 属性路径 */, Condition[]>;
```

**允许的表达式（`Capabilities.FilterExpressionRestrictions`，二期，P2-LR-19）**：`filterExpressionRules(expression)` 给出每个字段允许的运算符、能否排除、最多几个条件；`restrictConditions` 去掉不允许的条件（单值、单范围只保留最后一个）。筛选字段、取值帮助、`useFilterState` 和 `buildListRequest` / `buildAggregateRequest` 都用它，所以请求里从不出现服务不接受的条件。

| 表达式 | 运算符 | 排除 | 个数 |
| --- | --- | --- | --- |
| `SingleValue` | EQ | 否 | 1 |
| `MultiValue` | EQ | 否 | 不限 |
| `SingleRange` | EQ、BT、LT、LE、GT、GE | 否 | 1 |
| `SearchExpression` | Contains、StartsWith、EndsWith（纯文字按 Contains） | 否 | 不限 |
| `MultiRange`、`MultiRangeOrSearchExpression`、未注解 | 全部 | 是 | 不限 |

语义：
- 同一字段：所有包含条件之间是 `or`；排除条件之间是 `and`，每条取反；两部分之间是 `and`。
- 不同字段之间是 `and`。

生成规则：

| 运算符 | OData |
| --- | --- |
| EQ / NE / LT / LE / GT / GE | `P eq v` 等 |
| BT / NB | `(P ge a and P le b)`；NB 取反 |
| Contains / StartsWith / EndsWith | `contains(P,'v')` 等；NotContains 用 `not contains(…)` |
| Empty | 字符串：`(P eq null or P eq '')`；其他类型：`P eq null` |
| NotEmpty | Empty 取反 |

**字面量**：
- 字符串加引号，内部单引号写两次。
- 数字（含 Decimal、Int64）原样输出，值始终用字符串携带。
- 布尔：`true` / `false`。
- Guid：不加引号。
- `Edm.Date`：`2026-11-14`。
- `Edm.DateTimeOffset`：带时区偏移的 ISO 字符串。
- `Edm.TimeOfDay`：`13:45:00`。

**日期范围**：
- `Edm.Date` 字段的范围条件直接比较日期。
- `Edm.DateTimeOffset` 字段，在筛选栏里按"日"选择时，转换成用户时区的 `[当天 00:00, 次日 00:00)`，即 `ge` 起点 `and lt` 终点。

## 4. 值的表示与格式化

| Edm 类型 | 在 `Row` 里 | 显示 |
| --- | --- | --- |
| `Edm.Decimal`、`Edm.Int64` | **字符串**（请求带 `IEEE754Compatible=true`，服务端返回字符串）；服务端返回数字时，转成字符串前先检查是否安全 | `Intl.NumberFormat.format(字符串)`，精确，不经过浮点数；小数位按 `Scale`；金额按币种的小数位 |
| `Edm.Int16/32`、`Edm.Byte`、`Edm.Double`、`Edm.Single` | number | `Intl.NumberFormat` |
| `Edm.Date` | `'YYYY-MM-DD'` 字符串 | 按 locale 显示日期，**不做时区换算**（日历日期） |
| `Edm.DateTimeOffset` | ISO 字符串（带偏移） | 按 locale **和用户时区**显示日期加时间；时区默认取浏览器设置，可以在 Provider 里指定 |
| `Edm.TimeOfDay` | `'HH:mm:ss'` 字符串 | 按 locale 显示时间，不做时区换算 |
| `Edm.Boolean` | boolean | "是 / 否"（库文案） |
| `Edm.Guid` | 字符串 | 原样 |

## 5. 错误

- 非 2xx 响应时，解析 OData JSON 错误格式 `{ error: { code, message, target?, details?: [{ code, message, target }] } }`，抛出 `ODataError`：

  ```ts
  class ODataError extends Error {
    status: number;
    code?: string;
    target?: string;
    details: { code?: string; message: string; target?: string }[];
    scope: 'page' | 'field';
  }
  ```

- **级别**：`target` 指向某个属性（例如 `Price`，或 `PurchaseOrders('1')/Price`）的是字段级，其余是页面级。字段级错误在编辑接缝里由字段显示（二期）；一期的查询和读取错误都按页面级，在表格上方或对象页页头显示消息条。
- 响应不是 JSON 时（例如网关返回 HTML），`message` 用 HTTP 状态文本，`code` 为 `HTTP_<状态>`。
- 412 映射为 `ConcurrencyError extends ODataError`（编辑接缝用）。
- `AbortError` 不当作错误显示。

## 6. 编辑接缝（一期只定义，阶段 1.5 验证；二期实现见第 9 节）

```ts
interface EditStrategy {
  readonly kind: 'direct' | 'draft' | string;
  begin(path: EntityPath, current: Row): Promise<EditSession>;
}
interface EditSession {
  readonly path: EntityPath;
  readonly values: Row;               // 编辑副本
  set(property: string, value: unknown): void;
  save(): Promise<{ row: Row; etag?: string }>;   // 冲突时抛 ConcurrencyError
  cancel(): Promise<void>;
}
```

- 直接保存策略：`begin` 记下读取时的 `@odata.etag`；`save` 只 PATCH 变化的字段，带 `If-Match`；遇到 412 抛 `ConcurrencyError`。
- 草稿策略是二期的事，**一期不写它的接口签名**。上面的 `begin`、`save`、`cancel` 已经能容纳"创建草稿 / 激活 / 放弃"，二期实现时再验证。
- 字段组件 `SmartField` 的 `mode: 'display' | 'edit'` 一期就有。
- 阶段 1.5 的验证代码放在 `spikes/edit-seam`，不在任何包的发布范围内。

## 7. 变体存储（存数据库）

```ts
interface VariantStore {
  list(pageKey: string): Promise<Variant[]>;
  save(v: Variant): Promise<Variant>;     // 新建或更新
  remove(id: string): Promise<void>;
}
interface Variant {
  id: string; pageKey: string; name: string;
  isDefault: boolean; autoApply: boolean;
  content: VariantContent;                // 筛选、搜索、可见筛选字段、列、排序
  modifiedAt?: string;
}
```

- **`ODataVariantStore`**：读写服务上的实体集（默认名 `Variants`）。字段：`ID`（Guid）、`PageKey`、`Name`、`IsDefault`、`AutoApply`、`Content`（JSON 字符串）、`ModifiedAt`。设默认时，由客户端把同一 `PageKey` 下其他变体的 `IsDefault` 改为 false。
- **`MemoryVariantStore`**：测试和 Storybook 用。
- **"标准"变体**：始终存在，不存进存储，内容来自注解（SelectionVariant、PresentationVariant、LineItem）。
- **一期不区分用户**：没有共享变体和个人变体之分，这是二期的事。

## 8. 页面状态与导航

```ts
interface PageStateStore {
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T): void;
}
interface NavigationAdapter {
  /** 进入对象页或子对象页；path 是实体路径，service 是服务名 */
  toObject(path: EntityPath, service?: string): void;
  /** 回到某个列表 */
  toList(entitySet: string, service?: string): void;
  /** 该实体集的行是否有对象页（决定是否显示导航指示器） */
  hasObjectPage?(entitySet: string, service?: string): boolean;
  /** 生成链接地址，给 <a href> 用（中键、新标签页打开）；返回 undefined 时只渲染按钮 */
  href?(target: { kind: 'object'; path: EntityPath } | { kind: 'list'; entitySet: string }): string | undefined;
}
```

- **页面状态的键**：`<namespace>:<页面 id>`。`namespace` 在 Provider 上必填，例如 `smart-kit-demo`。
- **默认存储**：`MemoryPageStateStore`，状态只存在内存里，刷新后丢失。
- **其他存储**：使用者可以注入基于 `sessionStorage` 的实现。库提供 `createSessionPageStateStore(prefix?)`，键已经由 Provider 加了命名空间，`prefix` 是可选的额外前缀；只在调用时访问 `sessionStorage`，访问失败就退回内存。
- **实体路径（`EntityPath`）**：字符串，用 OData 资源路径的写法，例如 `PurchaseOrders('4500000001')/_Item(PurchaseOrder='4500000001',PurchaseOrderItem=10)`。`core` 提供解析和生成函数，适配器负责把它放进宿主的 URL。

## 9. 二期：写能力、编辑策略、消息、聚合（2026-11-15）

```ts
interface WriteDataProvider {
  update(path, patch, { etag? }): Promise<WriteResult>;                 // PATCH，If-Match
  create(target: QuerySource, row): Promise<WriteResult & { path }>;   // POST 到实体集或集合导航
  remove(path, { etag? }): Promise<{ messages? }>;                      // DELETE
  invoke(action, { path?, parameters? }): Promise<{ row?, messages? }>; // 绑定动作：<path>/<Namespace.action>
}
interface WriteResult { row: Row; etag?: string; messages?: Message[] } // messages 来自 sap-messages 头
```

- **编辑策略**（ADR-018）：`DirectEditStrategy`（只 PATCH 改过的字段；新建 POST）和 `DraftEditStrategy`（`EditAction` 得到草稿 → 修改 PATCH 到 `IsActiveEntity=false` 的实例（`flush`，界面在停止输入 600ms 后调用）→ `PreparationAction` + `ActivationAction`；放弃 = DELETE 草稿；新建 = POST 得到草稿）。`editStrategyFor(model, entitySet, provider)` 按模型选择，服务配置的 `editStrategy` 可以替换。`siblingPath` 在活动实例和草稿实例的路径之间转换。
- **消息**（ADR-023）：`messagesFromHeader`（`sap-messages`，`numericSeverity` 1–4）、`messagesFromError`（`error.details` 优先）、`createMessage`、`highestSeverity`。
- **聚合**（ADR-021）：`buildAggregateRequest(model, chart, { source, filters, search })` 生成 `$apply=filter(…)/groupby((维度,维度文本),aggregate(度量 with sum as 度量))`；筛选放进 `filter()` 变换（`$apply` 先于 `$filter` 求值）。内存数据提供者按同样语义聚合。
- **草稿列表**：`SmartListReport` 对草稿根实体集加 `IsActiveEntity eq true`；"编辑状态"筛选映射为 `HasDraftEntity` 和 `DraftAdministrativeData/DraftIsCreatedByMe` 的条件（"他人的未保存修改"即测试服务的锁定）。
- **能力**：`InsertRestrictions`、`DeleteRestrictions`、`UpdateRestrictions` 决定新建、删除、编辑按钮是否出现。
