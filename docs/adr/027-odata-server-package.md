# ADR-027 自写 OData V4 服务：`smart-kit-server` 和 `smart-kit-cli` 两个新包

- **背景**：后端只用 TypeScript，不用 .NET，也不用 CAP（CAP 的许可证只允许在 SAP BTP 或向 SAP 许可的平台上生产使用）。TypeScript 生态里没有成熟、开源、输出标准 V4 的现成服务端（调研见 `19-research-odata-server.md`，讨论记录 D03～D05、D12、D13）。
- **决定**：
  - 契约是标准 OData V4 加 OASIS / SAP 注解词汇表；服务端只实现 smart-kit 会发的请求（`query-shapes.md`、`05` 第 2、3 节），其余返回 `501` 和标准错误体。
  - **`@rhfan2019/smart-kit-server`**（Node）：分层为 URL → AST → 查询计划 → SQL。
    - 解析器自写，用 chevrotain（Apache-2.0），语法参照 `@sap-ux/fe-mockserver-core`（Apache-2.0，改写处保留版权声明）；AST 的字面量带类型，按 `$metadata` 的属性类型检查。
    - SQL 用 Kysely（MIT）生成，驱动 `pg`（MIT）。所有值参数化；表名、列名只来自元数据白名单；`ILIKE` 转义 `%`、`_`、`\`；排序最后追加主键；`$count` 用 `COUNT(*) OVER()`；集合 `$expand` 用 `LATERAL` + `json_agg`；服务端限制单页最大行数。
    - 权限和数据范围在查询计划层统一注入。
    - 对外接口是 Web 标准的 `Request` → `Response`，Next.js、Express、Hono 都能接。
    - 依赖 `@rhfan2019/smart-kit-core` 读取元数据模型。
  - **`@rhfan2019/smart-kit-cli`**（Node，只在开发时用）：从 PostgreSQL 的表结构生成 CSDL（表 → 实体，主键 → 键，外键 → 导航属性，列注释 → 标签）；注解单独手写一个文件；可以重复生成，只覆盖生成的文件；生成后检查注解指向的实体和字段是否还在。以后也负责 ADR-026 P6 的元数据预编译。
  - 两个包放在本仓库（monorepo），与 core、React 包同步发版。
  - 一致性测试：同一组请求同时发给本服务和 fe-mockserver，比较响应。
- **理由**：服务端依赖不能进浏览器包；CLI 不该成为生产依赖；同仓库便于一处改动跨包一次提交。选型理由见 `19` 第 3 节和 D13。
- **代价**：要自己维护一个受限的 OData 实现；Kysely 尚未到 1.0，要锁版本，升级时跑一致性测试。
- **状态**：采纳（2026-11-16），尚未实施。
