# 新会话提示词：按铁律与 SAPUI5 对齐

> 用法：新开一个会话，工作目录选本仓库（`00-smart-kit`），把下面"提示词"一节整段粘贴进去。

## 提示词

你接手 smart-kit 仓库的一项长期任务：**按铁律把 smart-kit 和 SAPUI5 1.154 对齐，并持续不间断地推进到完成。**

**铁律（ADR-033）**：组件名、模块路径、属性、默认值、枚举、聚合、事件、方法，以及注解的处理，必须和 SAPUI5 1.154.0 一致。模块路径只换前缀、后面无条件一致：`sap/m/MessageBox` → `@rhfan2019/smart-kit/m/MessageBox`；OData V4 专用的 `sap.fe.*` 多一层 `v4`：`sap/fe/macros/Table` → `@rhfan2019/smart-kit/v4/fe/macros/Table`；每个类一个模块、默认导出，枚举从 `…/library` 导出，类型名照 UI5 的 TypeScript 定义（`$TableSettings`、`Table$RowPressEvent`）。**不留旧名**：改名直接改，不要废弃别名和旧路径，invoice-assure 由用户最后统一改。V2（sap.ui.comp）暂不做。注解驱动的积木对齐 `sap.fe.macros`（`Table`、`FilterBar`、`Field`、`Form`……），页面模板对齐 `sap.fe.templates`（`ListReport`、`ObjectPage`，属性对齐 manifest 设置），普通控件对齐它们在 UI5 里的类。做不到的必须登记为偏差。开发完成后必须用 API 核对脚本和真 Fiori elements 的对比测试核对，不能凭阅读或记忆判断"一致"。

**开始前按顺序读**：
1. `docs/handoff.md`（现状、命令、环境、不能碰的东西）
2. `docs/adr/033-ui5-iron-rule.md`、`docs/adr/032-ui5-naming-for-controls.md`
3. `docs/30-ui5-alignment-guide.md`（开发文档：规则、命名空间、现有导出的目标、API 写法、偏差登记、两道核对、资料来源）
4. `docs/31-ui5-alignment-plan.md`（推进计划：阶段 0～7，每阶段的任务和完成标准，"进度"一节）
5. `docs/32-ui5-alignment-acceptance.md`（验收标准 AL-xx）
6. 已有的核对结果：`docs/26a-ui5-api-1.154.md`、`docs/28-ui5-alignment-audit.md`、`docs/29-list-report-annotations.md`、`docs/29a-list-report-annotation-tables.md`
7. `docs/12-discussion-log.md` 的 D31～D35

**怎么推进**：
- 从 `31` 的"进度"一节找到第一个没完成的阶段开始，按阶段顺序做，一个阶段做完、全部检查通过、提交，再做下一个，不停下来等确认，直到阶段 7 之前需要 invoice-assure 配合的地方。
- 先做核对工具（阶段 0），之后每一项改动都先看 UI5 的 `api.json` 或 sap.fe 源码 / 真 Fiori elements 的结果，再写测试，再写代码，最后跑核对。资料地址见 `30` 第 8 节；SAP 的文件只下载到缓存目录，不提交、不随包发布。
- 工具随意用：子代理、多代理工作流（Workflow）都可以，用户已经同意；能并行的就并行，但同一批文件只让一个代理改。
- 每个阶段：在 `docs/25-invoice-assure-issues.md` 的迁移清单里追加本阶段的"旧 → 新"、更新 `31` 的"进度"、在 `docs/12-discussion-log.md` 记一条 Dxx（问题、做法、结论；需要用户决定的写"用户决定：待定"）、写 changeset 和 CHANGELOG、更新 `docs/api.md`、`reference.md`、包文档、示例和 Storybook、更新 `docs/handoff.md`。
- **直接在 main 上开发和提交**（不开功能分支，D35），每个阶段至少一个提交；**不要推送、不要发布、不要建 PR**，除非用户在对话里说要（推送 main 会触发 CI 的发版流程）。
- **必须停下来问用户的情况**：要推翻以前有意的设计（`29` 里的草稿列表"全部"和默认可搜索两项，按铁律"注解处理必须和 FE 一致"改，D34 已写明，不用再问）；某个 UI5 / FE 功能做不到、要登记为长期偏差；版本号要升到 1.0。不要去改 invoice-assure。其他按 `30`、`31` 自行决定，并在讨论记录里写明理由。
- 回复用户用简体中文；代码注释用英文；遵守 `docs/handoff.md` 第 5 节的环境约束（本机 PostgreSQL 上别的项目的数据库不能碰；参考项目 `../00-fiori-list-report-floorplan-folk` 遵守它的 `AGENTS.md`）。

**完成的定义**：`32` 里 AL-01～AL-32 全部通过，`31` 的进度表到阶段 7 全部"完成"，最后给用户一份总结：每阶段做了什么、剩余的偏差清单（按类别）、invoice-assure 的迁移清单在哪、还需要用户决定的事。
