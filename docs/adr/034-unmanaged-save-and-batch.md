# ADR-034 非托管保存、宿主的事务、JSON 格式的 `$batch` 和逐请求授权

- **背景**：web-app-template 把列表页和对象页统一到 smart-kit（它的决策 2026-11-21）。它的实体集是读模型（schema `odata` 里的视图），写要走它自己的代码（权限点、审计、编号，用 Drizzle）；按 SAP RAP 的做法，界面只认 OData 一个入口。0.4.0 的服务只会自己对实体集背后的表执行 SQL，没有 `$batch`，授权只能在服务外面按 URL 判断。invoice-assure 因此把写绕到了 Server Action。
- **决定**：
  1. **非托管保存**（RAP 的 unmanaged save）：`EntitySetHooks` 增加 `create`、`update`、`delete`。给了哪个，哪个操作就由应用自己存；服务照旧做协议（属性白名单、Edm 类型、Capabilities、数据范围、ETag / If-Match、前后钩子、错误体、`sap-messages`），存完按键从实体集重读作为响应。`create` 返回新实体的键。ETag 属性由应用自己加一。动作返回的改动交给 `update`。
  2. **宿主的事务** `unitOfWork(e, work)`：给了它，服务不再自己开事务；每个写请求、`$batch` 的每个变更集调一次，服务自己的语句都在宿主交来的 Kysely 上执行（`createKyselyOnClient(client)`：跑在宿主事务的那条连接上，不开始、不提交、不归还）。这样应用的写、动作和服务的重读在同一个事务里，不管应用用什么库。
  3. **`$batch` 只做 JSON 格式**（OData 4.01）：`atomicityGroup` 相同的请求是一个变更集，一个事务；失败时整组不写，只回一条响应（带失败那条请求的 `id`）。URL 可以用 `$<id>` 引用本批次里新建的实体。没有 `Prefer: continue-on-error` 时第一处失败就结束。`multipart/mixed` 回 415。
  4. **逐请求授权** `authorize({ context, request, entitySet, operation, action })`：每个请求（包括 `$batch` 里的每一条）在路径解析后、读写前调用，`entitySet` 是路径最后落到的实体集。经 `$expand`、导航路径和值帮助碰到的实体集仍靠 `scope`。
  5. **前端**：`DataProvider` 增加可选的 `batch(operations, { atomic })`；`ODataV4Provider` 在 `batch: 'json'` 时才有它（SAP 的服务和测试服务只懂 multipart，所以不默认）。core 的 `writeAll` 有 `batch` 就发一次请求，没有就逐个发。页面上：删除选中的行、批量编辑是一个变更集；动作作用于多行是一次请求、各行各自成败，`UI.DataFieldForAction/InvocationGrouping` 为 `ChangeSet` 时全部或全不。
- **理由**：
  - 写留在应用自己的代码里，权限、审计、业务规则只有一处；界面仍然只有 OData 一个入口，Fiori elements 的行为（ETag 冲突、字段级错误、消息）不用重做。
  - JSON 批处理是标准格式，解析和调试都比 multipart 简单；两端都是自己的，不需要兼容 UI5 的 multipart。
  - 事务交给宿主而不是让应用改用 Kysely：模板和 invoice-assure 的写都在 Drizzle 上。
- **没做的**：
  - 对象页的直接保存仍是抬头一个 PATCH；子表的新建、删除还是点了就发，没有攒到“保存”里一起提交（子表没有待提交状态，要做得先加这一层）。服务端已经支持在一个变更集里建抬头和行项目（`$<id>/_Items`）。
  - 无绑定动作（S11）、深层新建、PUT、草稿、multipart 批处理。
- **代价**：`authorize` 和 `unitOfWork` 是宿主要写的两段代码；用 `createKyselyOnClient` 时服务的会话设置（UTC、语句超时）在每条语句前后设置和复位，一次写多两到三个往返。
- **状态**：采纳（2026-11-22，D51）。
