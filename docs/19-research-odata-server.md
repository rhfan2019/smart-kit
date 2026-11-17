# 19 调研：可参考的 OData 服务端实现

> 状态：调研结论，待用户确认后写 ADR · 2026-11-16。背景见讨论记录 D04、D05：后端只用 TypeScript，不用 CAP，自写一个只覆盖 smart-kit 所需请求的 OData V4 服务（接 PostgreSQL）；动手前先找成熟方案参考，取其精华、弃其糟粕。
>
> 数据（星数、最近提交、月下载量）取自 GitHub 和 npm，2026-11-16。

## 1. 评判标准

1. **协议**：输出标准 OData V4（`@odata.context`、`@odata.count`、`value`、V4 的 `$metadata`），能被 smart-kit 和 SAPUI5 直接读。
2. **许可证**：OSI 认可的开源许可证（MIT、Apache-2.0、BSD），可以依赖、复制、改写。
3. **维护**：近一年有提交和发布。
4. **语言**：TypeScript 或 JavaScript，能直接用或照着改。
5. **相关度**：覆盖 smart-kit 实际发的请求（`query-shapes.md`、`05` 第 2、3 节），最好有"查询 → SQL"。

## 2. 候选一览

### 2.1 TypeScript / JavaScript 的服务端和解析器

| 项目 | 许可证 | 维护 | 协议 | 结论 |
| --- | --- | --- | --- | --- |
| `@sap-ux/fe-mockserver-core`（SAP/open-ux-odata） | Apache-2.0 | 活跃（2026-11） | OData V4 和 V2，含 `$apply`、`$search`、草稿、`$batch` | **最重要的参考**。smart-kit 已在用。请求解析用 chevrotain 写的语法（`$filter`、`$apply`、`$search`、`$batch`），正好覆盖 Fiori 会发的请求。缺点：定位是模拟服务，数据在内存里、用 JS 过滤；解析器不是公开 API（`dist/request/filterParser`）；AST 里的字面量是字符串，没有类型 |
| RESO 参考服务（RESOStandards/reso-tools） | **RESO EULA**，不是开源许可证：不能再分发，RESO 可以撤销 | 活跃（2026-11） | OData 4.01，PostgreSQL / MongoDB / SQLite | **只看不用**。架构和我们要做的最接近（TypeScript + PostgreSQL + 元数据驱动），做法值得学（见第 3 节），但代码不能复制或依赖 |
| Pine.js（balena-io/pinejs）及 `@balena/odata-parser`、`odata-to-abstract-sql`、`abstract-sql-compiler` | Apache-2.0 / BSD | 活跃（2026-11），balena 生产在用，月下载 3～26 万 | **不是 V4**：响应是 `{ d: … }`，`$metadata` 是 `DataServiceVersion 2.0` | 协议不合用；语法用 OMeta 写，模型用 SBVR，难以借用代码。**架构值得学**：URL → AST → 抽象 SQL → SQL，权限在抽象 SQL 这一层统一注入 |
| `odata-v4-parser`、`odata-v4-server`、`odata-v4-sql`、`odata-v4-pg`（jaystack） | MIT | 停止维护（2018～2022，`odata-v4-pg` 已归档） | V4 | 不用。`odata-v4-parser` 月下载仍有约 35 万，说明很多项目还靠它，但没人修 |
| `@odata/parser`、`@odata/server`（Soontao 的分支） | MIT | 停止维护（2022～2023） | V4 | 不用 |
| `@steedos/odata-v4-sql` | MIT | 2026-05 有发布 | jaystack 的分支 | 只是给 Steedos 自己用的补丁版，不作依据 |
| `azure-odata-sql`（Azure） | MIT | 已归档（2023） | 转 SQL Server 的 SQL | 不用 |
| `odata-filter-parser`（jadrake75） | Apache-2.0 | 2026-08 | 只解析 `$filter` 的简单子集 | 覆盖不够 |
| `@open-rap/runtime` | MIT | 2026-11-09 刚建，0 星 | V4 | 太新，不算成熟 |
| `ts-odata-v4-server`（leyton） | Apache-2.0 | 2026-04，月下载 64 | V4 | 用的人太少 |

结论：**TypeScript 生态里没有一个"成熟、开源、标准 V4、可直接拿来当服务端"的现成项目**，与 D05 的判断一致。所以按"自写，但每一块都有出处"来做。

### 2.2 其他语言的成熟项目（看行为和做法，不引入）

| 项目 | 许可证 | 借鉴什么 |
| --- | --- | --- |
| ASP.NET Core OData、ODataLib（OData/AspNetCoreOData、OData/odata.net） | MIT | 协议细节的标准答案：字面量、空值、`$count` 与 `$top` 的关系、错误格式、`$expand` 嵌套选项。有疑问时以它和 OASIS 规范为准 |
| Data API builder（Azure/data-api-builder） | MIT | 用微软的 OData 解析器解析 `$filter`，再生成 PostgreSQL 的 SQL；"数据库策略"：把权限条件拼进每个查询的 WHERE |
| PostgREST | MIT | "URL 查询 → 安全的 PostgreSQL SQL"的事实标准（2.7 万星）：嵌入关联资源用 `LATERAL` + `json_agg` 一次查出（对应集合 `$expand`）；总数有精确、按执行计划估算、混合三种策略（对应 `$count` 的性能问题）；权限交给 PostgreSQL 的行级安全 |
| Apache Olingo（Java） | Apache-2.0 | GitHub 镜像已归档，不再参考 |

## 3. 取其精华：要照着做的

| 做法 | 出处 | 用在哪 |
| --- | --- | --- |
| 用 chevrotain 写 `$filter`、`$search` 的语法；语法规则对照 fe-mockserver 的写法（Apache-2.0，改写时保留版权声明） | fe-mockserver-core | 解析层 |
| AST 的字面量带类型（字符串、数字、日期、Guid、null），解析时就按 `$metadata` 里属性的类型检查 | RESO 解析器的 AST 设计（只借思路） | 解析层 |
| 分层：URL → AST → 查询计划 → SQL；权限和数据范围在"查询计划"这一层统一加，不在拼 SQL 时零散加 | Pine.js、Data API builder | 架构 |
| 所有用户输入一律参数化（`$1`、`$2`），列名和表名只能来自元数据里的白名单 | RESO、PostgREST | SQL 层，安全 |
| `contains` 等转 `ILIKE` 时转义 `%`、`_`、`\` | RESO | SQL 层 |
| 排序最后总是追加主键，保证分页稳定（同值的行不会跨页重复或丢失） | RESO（它的测试就是在 PostgreSQL 上踩过这个坑） | SQL 层 |
| `$count=true` 用 `COUNT(*) OVER()` 和数据一次查出；大表可以按配置改用估算 | RESO、PostgREST | 性能 |
| 集合 `$expand` 用 `LATERAL` 子查询 + `json_agg` 一次查出，避免逐行查询 | PostgREST | 性能 |
| 服务端限制单页最大行数 | ASP.NET Core OData（`MaxTop`、`PageSize`） | 性能 |
| 一致性测试：同一组请求同时发给我们的服务和 fe-mockserver，比较响应 | 本项目已有测试服务 | 测试 |

## 4. 弃其糟粕：不要的

- 不依赖已停维护的 jaystack 系列和 `@odata/*`。
- 不复制、不依赖 RESO 的代码（EULA，可被撤销）。
- 不照搬 Pine.js 的 OMeta 语法和 SBVR 建模，也不用它的 V2 风格响应。
- 不在 JS 里过滤数据（fe-mockserver 的做法只适合模拟），筛选、排序、分页、计数都交给 PostgreSQL。
- 不做完整协议：范围只限 smart-kit 会发的请求（D03 第 1 条），其余返回 `501 Not Implemented` 和标准错误体。

## 5. 待定（写 ADR 时决定）

> 2026-11-16 更新：第 1～3 条已定（自写解析器；Kysely + `pg`；从表结构生成、注解单独写、可重复生成），第 4 条的建议是同仓库新开 `smart-kit-server` 和 `smart-kit-cli` 两个包，见讨论记录 D13。

1. **解析器**：直接用 fe-mockserver-core 内部的解析器（省事，但依赖非公开 API，字面量没有类型），还是用 chevrotain 按它的语法自写一份（多一点工作，但稳定、有类型）。**建议自写**。
2. **生成 SQL 的方式**：用 Kysely（MIT，TypeScript 查询构建器，类型安全）、Drizzle，还是用 `pg` 直接写参数化 SQL。要看和使用者的项目怎么衔接。
3. **元数据从哪里来**：手写 CSDL，还是从表定义生成实体部分、注解单独写文件（D03 第 3 条）。
4. **放在哪里**：作为 smart-kit 的一个新包（例如 `smart-kit-server`），还是独立仓库。
