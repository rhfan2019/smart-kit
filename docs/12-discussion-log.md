# 12 讨论记录

> 状态：现行。每次讨论一节，新的写在最后。只记结论、依据和待定的事；已经落到别的文档里的，写链接。

## D01 微型图表、OpenUI5、体积、三期（2026-11-15）

**问题**：要不要参考 Fiori 的 Micro Chart 做自己的组件；OpenUI5 有没有这些组件，会不会也很慢；smart-kit 的体积是否可控。

**结论**

1. **要做，放三期，9 种全做**（Area、Bullet、Column、Comparison、Delta、Harvey Ball、Line、Radial、Stacked Bar）。用户会提供每种图的官方文档，逐种整理规则后再开工。已改的文档：`01` LR-31 和第 7 节、`01b` OP-04、`02` 的 `UI.Chart`、`03` 的 `HeaderFacet`、`11` 的 O9。
2. **做法**：自己用 SVG 画，不引入图表库；分三层：纯展示组件（不依赖注解）→ core 解析 `UI.Chart` 和 DataPoint 的 `CriticalityCalculation` 等 → 接进 `SmartField`、`SmartTable`、`HeaderFacet`。先做只用本行字段的（Bullet、Radial、Harvey Ball），再做要导航集合数据的（Line、Column、Area、Comparison、Stacked Bar）；Delta 可能没有注解能驱动，待核实。
3. **OpenUI5 没有微型图表**：OpenUI5 1.154.0 共 26 个库，没有 `sap.suite.ui.microchart`、`sap.viz`、`sap.fe`，这些只在 SAPUI5 里。OpenUI5 与 SAPUI5 是同一个框架核心（运行时逐个加载模块和各库的主题文件），所以同样偏重。用户感到的慢还有一部分来自 Launchpad、Gateway 和先下载 `$metadata`，与前端选型无关。
4. **smart-kit 体积可控**：gzip 后 core 18.7 KB、react 32.9 KB，有构建预算（60 KB、80 KB，`npm run size`）。示例应用合计约 595 KB JS + 44 KB CSS，其中 AG Grid 约 210 KB 最大，React 约 67 KB，Mantine 约 78 KB（单独打包估算）。以后可优化：AG Grid 只注册用到的模块（现在是 `AllCommunityModule`，见 `SmartTable.tsx`），或表格延迟加载。微型图表预计合计在 10 KB 以内（gzip，估计）。

**待定**：`docs/prompt/项目目标与范围-v5.md` 第 11 行仍写"期数只有两期"，由用户决定是否改。

## D02 用 smart-kit 能不能提高开发效率（2026-11-15）

**问题**：invoice-assure 的发票页看着炫，但让人抓不住重点、无从下手，构建过程也痛苦。有了这套组件，工作量是不是转到 OData 和注解上？

**invoice-assure 的现状（2026-11-15 查看）**：Next.js + PostgreSQL（Drizzle），界面是 shadcn 一类的自建组件；没有自己的 OData 服务，只读 SAP 的 OData。410 次提交里约 72 次与界面有关，backlog 里有 52 个界面条目；界面被甲方否决过一次（UI-014）后重做；`src/features/cases/components` 下的组件合计约 6,500 行，其中发票处理页 `invoice-work.tsx` 约 1,200 行。最近的提交已经在"按 SAP Fiori 摆放页面"（0422a26、967a449）。

**结论**

1. **能提高效率，但只对"标准页面"**。列表（我的待办、全部发票、待过账）和对象页骨架（页头关键值、分区、行项目表、SAP 凭证表、锚点）可以由注解生成，不再一页一页手写和调样式。发票页里的业务部分仍要写代码：差异的解释和判断、决策栏、分录预览、智能体侧栏。smart-kit 给的是固定位置和扩展点，不替代这些。
2. **"抓不住重点"主要靠版式规范解决，组件库让规范不容易被破坏**。Fiori 的版式规定了重点放哪里：页头只放几个关键值和状态，动作在固定位置，内容按分区排。用了 smart-kit，页面结构由版式决定，不再每次凭感觉设计，"炫但没重点"的空间变小。
3. **工作量确实会转移，分三块**：
   - **数据服务**：smart-kit 读 OData V4。invoice-assure 的数据在 PostgreSQL，要么对外提供 OData V4 服务，要么按 `DataProvider` 接口（`query`、`read`）接自己的 API，并写一份 CSDL 描述实体。这是新增的工作。
   - **注解**：本质上是"用配置写页面设计"：哪些列、哪些筛选、页头放哪几个关键值、什么状态标红。设计决定仍然要做，只是写成注解，改起来比改 JSX 和样式快得多。注解有学习成本，可以由 AI 来写、人来审。
   - **自定义部分**：通过扩展点插进页面。
4. **目前的限制**：
   - smart-kit 一期只读。审批、接受差异这类服务端动作（`UI.DataFieldForAction`）和编辑都在二期，invoice-assure 的处理页现在离不开这些。
   - smart-kit 基于 Mantine 和 AG Grid，与 invoice-assure 现有的组件体系不同，混用会出现两套外观。要么整体迁移，要么只在新页面上用。

**建议**（待用户决定）：不改 invoice-assure 的主线；等 smart-kit 二期有了动作和编辑以后，先挑一个只读页面（例如"全部发票"或"待过账"）试点，量一下前后的代码量和返工次数，再决定要不要迁移。

## D03 在 PostgreSQL 上做 OData V4 服务，还是接自己的 API（2026-11-15）

**问题**：基于 PostgreSQL 开发 OData V4 服务工作量大不大、有没有性能问题；改用 smart-kit 的数据接口接现有 API，会不会缺一部分 OData 的元数据。

**先厘清一点**：smart-kit 的模型始终来自 CSDL（`buildModel(metadata, …)`），数据提供者只负责取数。`loadService` 只是顺手从 `/$metadata` 下载 CSDL；换成自己的 `DataProvider` 时，同样要传一份 CSDL（服务定义加注解）。所以**元数据不会因为换接口而丢**，丢不丢取决于这份 CSDL 写没写全。

**结论**

1. **自己做 OData V4 服务的工作量，看做多少**：
   - 完整实现 OData V4 协议：很大，不建议。
   - 只做 smart-kit 会发的那部分（见 `query-shapes.md` 和 `05` 第 2、3 节）：`$select`、`$expand`（带 `$select`）、`$filter`（比较、`and`/`or`/`not`、`contains`/`startswith`/`endswith`、`null`）、`$orderby`、`$top`/`$skip`、`$count`、`$search`、按键读单条、父对象下的子集合、静态 `$metadata`、错误格式。工作量中等：一个受限的 `$filter` 解析器、转 SQL、响应格式，加测试；可以拿 smart-kit 的测试服务做对照。
   - 现成方案：SAP CAP（`@sap/cds` + `@cap-js/postgres`）最省事，注解直接写在 CDS 里。代价是在 Drizzle 之外再维护一套 CDS 模型、多一个服务进程，而且它不是开源许可证（D04 已核实：生产使用只限 SAP BTP 或向 SAP 许可的平台）。Node 上通用的开源 OData 服务端库据我所知大多不活跃（未逐个核实）。
2. **性能问题不在 OData 协议本身**，OData 只是把 URL 翻成 SQL。要注意的是翻出来的 SQL：
   - `$count=true`：每次首页都要数一遍，大表加复杂筛选时会慢，靠索引。
   - `contains`：会变成 `ILIKE '%x%'`，普通索引用不上，要用 `pg_trgm` 的 GIN 索引。
   - 集合的 `$expand`：逐行查会变成 N+1，要合并成一次 `IN` 查询或 `json_agg`。
   - `$search`：用 PostgreSQL 全文检索。
   - 服务端要限制单页最大行数。
   SAP 系统慢，主要是 Gateway、ABAP 栈和 Launchpad，不是 OData 协议。
3. **接自己的 API 不会缺元数据，但有四处要自己保证**：
   - CSDL 和数据库对不上：字段改了，CSDL 没改。办法是从 Drizzle 的表定义生成 CSDL 的实体部分，注解单独写一个文件。
   - 查询语义要自己实现：好处是 smart-kit 交给提供者的是结构化的请求（字段列表、条件、排序、分页），不用解析 OData 字符串，比做 OData 服务简单。
   - 安全：请求从浏览器发出，服务端必须按实体校验字段白名单，并套上数据范围和权限，不能直接拿前端给的字段名拼 SQL。
   - 失去互通：Excel、SAP 工具、UI5 应用不能直接读这个接口。
   其余的（多语言标签、值帮助、能力限制、错误）照常从 CSDL 和提供者来；错误要按 `05` 第 5 节抛库里的错误类型。

**建议**（已被 D04 取代：用户澄清 invoice-assure 只是练手项目，目标是成熟、符合最佳实践的框架）：invoice-assure 走"自己的 API"：一个服务端接口接收 smart-kit 的结构化请求，校验后用 Drizzle 翻成 SQL；CSDL 的实体部分从 Drizzle 表定义生成，注解手写。只有将来要给别的 OData 客户端用时，才做真正的 OData 服务。如果这条路走通，"结构化请求 → SQL"的适配器可以考虑做成 smart-kit 的一个服务端包，留作后续讨论。

## D04 以"成熟、符合最佳实践"为刚需，数据层用哪种方案（2026-11-15）

**前提**（用户澄清）：invoice-assure 只是练手项目，没有历史包袱。目标是做一套成熟、符合行业最佳实践的框架和组件，这是刚需。

**核实的事实**（2026-11-15）

| 候选 | 许可证 | 成熟度 | 能不能用 |
| --- | --- | --- | --- |
| SAP RAP / Gateway（ABAP） | SAP 系统自带 | SAP 官方，原生 OData V4 和注解 | 数据在 SAP 里时，首选 |
| SAP CAP（`@sap/cds` 10.2.2） | SAP Developer License 3.2：生产使用只限 SAP BTP 或向 SAP 许可的平台；`@cap-js/postgres` 本身是 Apache-2.0，但离不开 `@sap/cds` | 很成熟 | 只在部署到 BTP 时可用，不能作为独立框架的默认后端 |
| ASP.NET Core OData（`Microsoft.AspNetCore.OData` 9.5.0） | MIT | 微软维护，最成熟的开源 OData V4 服务端；配 EF Core + Npgsql 接 PostgreSQL | 可用，代价是后端用 .NET |
| Apache Olingo（Java，5.0.0） | Apache-2.0 | 老牌，但上次发布是 2023-12，更新慢、偏底层 | 不推荐作为默认 |
| Node 上的开源 OData 服务端（如 `odata-v4-server` 0.2.13） | — | 2022 年后没有更新 | 不可用 |
| `@sap-ux/fe-mockserver-core` | Apache-2.0 | 活跃，但定位是模拟服务 | 只用于开发和测试（smart-kit 已在用） |

**结论**

1. **契约用标准 OData V4 加 OASIS / SAP 注解词汇表，不用私有 API。** OData V4 是 OASIS 标准，也是 ISO/IEC 20802；Fiori Elements、SAP 后端、Excel、Power BI 都认它。smart-kit 保持"OData V4 是唯一的一等协议"，现有设计不变。`DataProvider` 接口保留，但只作为扩展点（内存数据、测试、特殊数据源），不作为推荐路径。D03 的"自己的 API"方案撤回。
2. **后端按数据在哪里分两种推荐组合**：
   - 数据在 SAP：RAP 发布 OData V4 服务，smart-kit 直接读。这是 SAP 项目里的标准做法。
   - 自己的数据（PostgreSQL）：ASP.NET Core OData + EF Core + Npgsql。这是在 SAP 平台之外唯一同时满足"成熟、开源许可、活跃维护、完整 OData V4"的选项。
3. **注解单独放一个文件**，不写进服务代码。两种后端都适用，这也是 Fiori 的通行做法（本地注解文件）；smart-kit 已经支持（`annotationUrls`、`annotationFiles`、覆盖层）。
4. **不自己写 OData 服务端。** 自写协议实现与"成熟"相矛盾，只在没有别的选择时考虑。
5. **性能**：沿用 D03 第 2 条（索引、`pg_trgm`、避免 N+1、限制页大小）。ASP.NET Core OData 把查询翻成 EF Core 的 LINQ 再到 SQL，集合 `$expand` 一次查出，页大小由 `MaxTop`、`PageSize` 控制。

**代价与待定**

- 后端多了一门语言（C# / .NET）。前端仍是 React + TypeScript。用户是否接受 .NET，待用户决定。
- 如果坚持全栈 TypeScript，就没有成熟的开源 OData V4 服务端可用，只能在"自写受限子集"和"上 BTP 用 CAP"之间选，两者都不完全满足刚需。
- 下一步可做：用 ASP.NET Core OData + PostgreSQL 搭一个最小的参考后端，跑通 smart-kit 的列表页、对象页、值帮助，作为技术验证，记一条 ADR。

## D05 二期合并到 main（2026-11-15）

**问题**：二期在独立分支 `claude/phase-2-a32ce7` 上完成，是否合并到 `main`。

**结论**

1. **用户决定合并**，快进合并，`main` 现在包含二期的全部提交（`5a45388` 到 `3ef2e46`）。合并后实测：单元 189、端到端 182、可追溯 33/33、72/72、143/143 全部通过，类型检查、lint、构建、Storybook 也通过。二期的计划、验收标准和验收报告见 `12-phase2-plan.md`、`13-phase2-acceptance.md`、`14-phase2-acceptance-report.md`。
2. **与 D01 的关系**：二期已经做了页头微图表 Facet 的几种（Bullet、Donut、Pie、Waterfall 作为 Delta、Column、Line、Bar 作为 Comparison，见 ADR-021）；D01 定的"9 种全做、包括表格单元格里的微型图表"仍放三期，在二期基础上补齐。`02` 的 `UI.Chart` 两行据此合并。
3. **体积**：二期后 gzip 体积为 core 22.9 KB、react 64.7 KB（预算 60 KB、80 KB，合并后实测），D01 第 4 条里的 18.7 KB、32.9 KB 是一期的数字。
4. **二期的已知限制**（二期会话报告）：没有"保留草稿"提示；动作参数只支持基本类型。

**待定**：是否推送到远程，由用户决定。

## D05 技术栈只用 TypeScript；自写 OData 子集服务；微型图表开子会话（2026-11-15）

**用户的决定**

1. 技术栈必须简洁，后端也只用 TypeScript；不考虑 .NET，也完全不考虑 CAP。
2. 因此数据层的方案是：**自己写一个只覆盖部分功能的 OData V4 服务**（TypeScript，接 PostgreSQL）。契约仍是标准 OData V4 加注解词汇表（D04 第 1、3 条不变），只是服务端自写。
3. 原则：尽量少闭门造车。动手前先在 GitHub 上找成熟方案参考，取其精华、弃其糟粕。
4. 微型图表（D01）另开子会话推进，在子会话里等用户补充各图的参考链接。

**由此确定的范围**（沿用 D03 第 1 条）：服务端只实现 smart-kit 会发的请求形状（`query-shapes.md`、`05` 第 2、3 节）：`$metadata`（静态 CSDL 加独立注解文件）、`$select`、`$expand`（带 `$select`）、受限的 `$filter`、`$orderby`、`$top`/`$skip`、`$count`、`$search`、按键读单条、父对象下的子集合、OData 错误格式。性能注意事项见 D03 第 2 条。

**下一步（待开工）**：调研 GitHub 上可参考的实现，至少看三类：
- OData V4 的 URL / `$filter` 解析器（TypeScript 或 JavaScript）；
- 把 OData 查询翻成 SQL 或查询构建器的实现；
- 成熟服务端的行为，作为对照：`@sap-ux/fe-mockserver-core`（Apache-2.0，smart-kit 已在用，可直接当一致性测试的对照）、ASP.NET Core OData、Apache Olingo 的查询处理。
调研结果写成一份对比，选定参考对象后记一条 ADR。

**微型图表子会话**：已开（会话名 `micro-charts`，独立工作区和分支）。它先读现有代码和文档，然后等用户给 9 种图的参考链接，再写 `docs/13-research-micro-chart.md`，经用户确认后实现。

## D06 更正：二期已经做了七种微图表（2026-11-15）

讨论 D01～D05 期间，主分支合入了二期（`5a45388`～`3ef2e46`，含 ADR-018～024、`docs/13-phase2-acceptance.md`、`docs/14-phase2-acceptance-report.md`）。所以前面几条有过时的地方：

- **微型图表**：二期已在页头做了七种微图表 Facet（Bullet、Column、Line、Comparison、Delta、Harvey Ball、Radial，`packages/react/src/chart/MicroChart.tsx`，ADR-021，P2-OP-04）。三期的范围相应改成：按官方规范补齐九种（加 Area、Stacked Bar，Line 和 Area 分开画），逐项对齐规范，并做表格单元格里的微型图表（LR-31）。`01`、`01b`、`02`、`03` 已按此改写。
- **D02 第 4 条"一期只读、动作和编辑在二期"**：二期已经有动作、编辑、草稿和消息，这条限制不再成立。
- **文档编号**：`13`、`14` 已被二期占用，微型图表的规则文档改用下一个空号（`15-research-micro-chart.md`），已告知 `micro-charts` 子会话。

## D07 微型图表：官方资料能否读、规则草稿（2026-11-15）

**问题**：用户给了 SAP Fiori 设计规范 v1.148 的 Micro Chart 入口页，问能不能读它和它链到的各图文档与示例。

**结论**

1. **能读**。sap.com 和 ui5.sap.com 直接抓取会被拒，用内置浏览器可以读。已读：总览页、九种图的设计规范页；SAPUI5 1.154.0 的 `sap.suite.ui.microchart` API 参考、`sap.ui.comp.smartmicrochart` 的说明，以及 OData V4 Fiori Elements（`sap.fe.macros`）把注解变成微型图表的源码。SAPUI5 不是开源许可证，源码只用来核对行为，不复制。
2. **规则草稿已写成 `15-research-micro-chart.md`**（MC-01～MC-65），按种类写了结构、尺寸、颜色、标签隐藏、没有数据、无障碍和注解映射，第 0 节列出二期实现与规范的差距。`02`、`03` 已加链接。
3. **几个关键事实**：
   - 九种图都是填满父容器、没有固定宽高，范围 64×18 到 320×94 px；数字不截断，放不下就隐藏。二期是固定 160×56，要改。
   - Fiori Elements（V4）只认 8 种 `ChartType`：`Bullet`、`Donut`（Radial）、`Pie`（Harvey Ball）、`Column`、`Line`、`Area`、`Bar`（Comparison）、`BarStacked`（Stacked Bar）。**Delta 没有标准的注解映射**；二期的 `Area`→折线、`BarStacked`→Comparison 是错的，要改。
   - Comparison 最多 12 条（二期是 4 条），同一表格列条数相同。
   - GitHub 上可借鉴的开源实现：`@microcharts/react`（MIT，每个图是 `img` 加一句由数据生成的说明，和我们的做法一致）。

**待定**（见 `15` 第 5 节）：Delta 的注解驱动方式（建议保留 `Waterfall` 约定并导出展示组件）；11 种定性色令牌的取值；是否去掉二期认的 `VerticalBullet`、`ColumnStacked`、`HorizontalWaterfall`。规则需用户确认后再动代码。

## D08 微型图表：以 SAP 规范为准；配色铁律；Delta（2026-11-15）

**用户的决定**

1. **铁律：凡是本库二期的规范或实现与 SAP 官方文档不一致，一律以 SAP 为准，并修改本库自己的文档。** 适用于尺寸（随父容器变化）、数字截断（放不下就隐藏，成对的一起隐藏）、`Area` 和 `BarStacked` 的映射、Comparison 的条数、没有数据时的显示。
2. **铁律：配色体系必须和现有体系一致，支持更换主题。** 新增的定性色板按现有三层令牌加（原始值 → 每个主题的语义层 → 组件层），组件代码不写颜色值（`15` MC-08）。
3. **Delta 由我参考 SAP 决定**：OData V4 的 Fiori Elements 不支持 Delta，所以 Delta 不由注解驱动，只作展示组件；去掉二期 `Waterfall` → Delta 的约定；想用注解表达"实际与目标之差"，用标准的 Bullet 差值模式（`DeltaBulletChart`）。二期多认的 `VerticalBullet`、`ColumnStacked`、`HorizontalWaterfall` 也一并去掉。

**已改的文档**：`15-research-micro-chart.md`（优先级说明、MC-08、MC-64、第 0、3.1、5 节）、`adr/021-charts.md`（状态里列出被修订的部分）、`02`（`UI.Chart` 二期一行）、`08`（模拟服务的 `Waterfall` 和哈维球总数，三期要改）、`13`（P2-OP-04 加注）。

**待做**：用户对 `15` 做最后确认后开工；实现时同步改模拟服务的注解（`apps/mock/Csdl/purchasing.template.xml`）。

## D09 微型图表第一步开工（2026-11-15）

**用户的决定**：确认 `15-research-micro-chart.md` 的规则，开工。

**结果**（未提交，见 `15` 第 6.1 节）

1. Bullet、Radial、Harvey Ball 按规则做完，接进页头 Facet、表格单元格和表单（`SmartField`）。模拟服务的订单表加了一列"预算使用"（Bullet），子项页头的差值图改成标准的差值子弹图。
2. 三个通用规则对九种图都生效：随容器变化尺寸、数字放不下就隐藏、没有数据时的占位或留空。可见标签改用短格式（"6.7M"），这是 SAP 的做法（MC-13），否则大金额在 160 px 里放不下就会被隐藏。
3. 配色按铁律走三层令牌：新增 7 个色相的原始值，三个主题各一套 `--sk-color-chart-1～11`，组件层 `--sk-chart-palette-1～11`；`06` 第 3 节已补。
4. 发现并修正二期的一个缺陷：注解里的 `Decimal` 常量被忽略。
5. 检查：类型检查、lint（令牌、商标）、单元测试 205 个、构建、体积（core 23.6 KB、react 66.1 KB，预算 60、80 KB）通过；端到端测试 185 个全部通过；可追溯检查 33/33、72/72、143/143。
6. 为适应新列和新行为改了三个已有测试：`list.spec.ts` 的 AC-LR-10（新列也读净值，要一起隐藏）、`p2-object.spec.ts` 的 P2-OP-04（Delta 改成差值子弹图）和 P2-OPC-02（等数据加载完再量 Facet 位置）。

**下一步**：第二步，要导航集合数据的五种图（`15` 第 6.2 节），先核对请求形状并写 ADR。

## D10 微型图表全部完成；与 SAP 官方示例对比（2026-11-15）

**用户的要求**：按计划连续推进到全部完成；除了本项目的验收文档，还要与 SAP 的规范和效果细致对比，有问题自动修改，直到全部修好。

**结果**（未提交）

1. **九种图全部完成**，接进页头 Facet、表格和表单单元格。第二步的五种（Line、Column、Area、Comparison、Stacked Bar）按规则做完，Delta 只作展示组件。导航集合上的图在单元格里用 `$expand($select;$orderby;$top)` 一次读回，写成 ADR-025；测试服务不支持 `$expand` 里的 `$top`，客户端再截一次。
2. **与 SAPUI5 1.154 示例逐项对比**：在内置浏览器打开 Demo Kit 九种图的示例，读取示例里渲染出的元素位置、尺寸、颜色和字号，并截图对比。规范文字没写、示例里能看到的外观补成规则 MC-70～MC-78（`15` 第 7 节），发现的差异全部改掉：Bullet 标签位置、阈值画法、预测条高度；Radial 字重和环粗细；Harvey Ball 数值颜色；Comparison 轨道和数值颜色；Area 阈值区域颜色和实际值线颜色；Delta 三根条的顺序和颜色；Stacked Bar 粗细；文字说明加语义状态词。
3. **SAP 规范里的可选功能也做了**：Column 每柱标签、Line 焦点和阈值标签、固定刻度（让表格各行可比）、Area 最小最大标签和宽布局。
4. **验收文档**：`17-phase3-acceptance.md`（63 条，编号就是 MC-xx）、`18-phase3-acceptance-report.md`（结果、截图、与 SAP 示例的对比表）；`npm run trace -- --strict` 增加三期检查。
5. **检查**：类型检查、lint、单元测试 229 个、端到端测试 187 个、`trace --strict`（一期 33/33、72/72，二期 143/143，三期 57/57）、构建、Storybook、体积（core 24.2 KB、react 69.1 KB）全部通过。测试服务从实体集展开集合时太慢（约 34 秒），所以 Line 列只放在订单页的子表（`LineItem#InOrder`）。
6. **改了几个二期的测试**，都是因为按 SAP 改了行为：Delta 没有阈值时为中性色（原来按正负着色）、Line 数据点默认隐藏、Comparison 最多 12 条、Bullet 文字说明带状态词。

**仍是用法指引、不能用测试证明的条目**：MC-01、MC-20、MC-50（什么时候用哪种图），写在 `15` 里。

