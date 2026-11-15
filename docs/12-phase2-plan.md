# 12 二期计划

> 状态：现行 · 2026-11-15。范围依据：v5 第 2 节（二期）、`01`/`01b`/`11` 里标"二期"的条目，以及三篇基准规范（v1.148）里**每个带编号的示意图**和正文的行为规则。验收条目见 `13-phase2-acceptance.md`，结果见 `14-phase2-acceptance-report.md`。
>
> 用户的规则（2026-11-15）：不停下来询问；规范没写明的地方按默认建议执行并写进文档（本文第 5 节和各 ADR）；循环"开发 → 测试 → 修复"直到全绿。

## 1. 三篇基准规范

| 缩写 | 规范 | 带编号的示意图 |
| --- | --- | --- |
| [LR] | List Report Floorplan | Components（1–11，含 6a、6b）；Actions（1–3） |
| [OP] | Object Page Floorplan | Components（1–8）；Anchor Bar Navigation（1–11）；Tab Navigation（1–3） |
| [DP] | Dynamic Page Layout | Intro（1–3）；Components（1a、1b、2–8，含 6a、6b）；Header Title（1–6）；Header Content（1）；Header Features（1–2）；Footer Toolbar；Flexible Column Layout（1–3） |

2026-11-15 用内置浏览器通读三篇全文；示意图的编号以页面上紧跟示意图的有序列表为准（例如 [OP] 锚点栏图的 11 项："Active anchor … Subsection in overflow menu"）。

## 2. 范围

二期 = 一期没有做、而三篇规范要求或 `01`/`01b` 标为二期的全部内容。按区域分 9 个工作包：

| 包 | 内容 | 主要规则 |
| --- | --- | --- |
| W1 测试服务 | 采购服务开放写：新建、删除、绑定动作（审批、拒绝、关闭、发布）、`OperationAvailable`；草稿服务 `/odata/purchasing-draft/`（同一份 CSDL 加上草稿注解，用 `@sap-ux/fe-mockserver-core` 原生草稿）；`sap-messages` 消息头；新增注解（多视图、图表、微图表、快速预览、`UI.Importance`、`FieldControl`）；一个 230 个项目的订单 | ADR-019 |
| W2 core | 模型：动作、图表、微图表、快速预览、多视图（SPV）、重要性、字段控制、草稿；数据层：`create`、`delete`、`invoke`、`$apply` 聚合查询、消息解析；编辑策略：直接保存与草稿 | ADR-018、ADR-021、ADR-023、ADR-024 |
| W3 动态页 | 关键信息区、布局动作（1280px 断点）、全局动作溢出、标题在折叠时截断 / 展开时换行（最多 2 行）、无页头内容时不可交互、F6、摘要行（手机）、Letterboxing | [DP] 全部 |
| W4 列表页 | 分享菜单、多视图（分段按钮 / 下拉 / 页签）、多内容、图表视图与下钻、响应式表格（滚动加载、吸顶、重要性、显示明细、手机）、复制、分组、快速预览、表动作和行内动作、部分处理、对话框新建、工作模式、页脚消息按钮和消息弹窗、草稿列表的编辑状态 | [LR] 全部 |
| W5 对象页 | 编辑（直接保存、草稿）、新建模式、页脚工具栏、页头动作溢出、对象标记和未保存修改弹出框、临时"页头"区块、部分编辑、子对象行内新建和对话框、删除确认、消息弹窗、通用标签、纯文本 / 微图表 / 汇总评分 Facet、布局块、`UI.Importance`、"Show All (x)"、上一条 / 下一条、动态侧边内容、标题样式、锚点栏轮播按钮、页签子导航和小屏轮播 | [OP] 全部 |
| W6 弹性分栏 | `FlexibleColumnLayout`：一到三列，列表在第一列；全屏、退出全屏、关闭；面包屑只在单列全屏显示；分页按钮 | [DP] FCL、[OP] Child Pages、NAV-07 |
| W7 示例 | `apps/demo` 新路由：`/po?views=…`、`/po-draft`、`/fcl/...`、响应式表格页、图表、新建、编辑 | — |
| W8 测试 | 每块的单元测试和端到端测试；`docs/13` 每个条目至少一条测试，名称带条目编号 | — |
| W9 可追溯 | `scripts/trace.mjs` 读取 Vitest 和 Playwright 的 JSON 结果，`docs/13` 的每个条目都要指到**通过**的测试 | — |

不做（与一期相同，v5 第 2 节）：依赖 SAP 平台的功能（存为磁贴、SAP Jam、Key User Adaptation、Launchpad Shell Bar）、分析表和树形表、Overview Page、Analytical List Page。这些在 `13` 里写成"不适用"条目并说明，而不是漏掉。

## 3. 顺序

1. 文档：本文、`13`、ADR-018–024，更新 `02`–`06`、`08`。
2. W1 测试服务 → W2 core（其余各包都依赖它们）。
3. W3 动态页（列表页和对象页共用）。
4. W4 列表页、W5 对象页、W6 弹性分栏，每完成一块就写单元测试和端到端测试。
5. W9 可追溯、`docs/14`、交接文档、变更日志。
6. 循环：`typecheck`、`lint`、`test`、`e2e`（完整两遍）、`trace --strict`、`build`、`size`、`build-storybook`，直到全绿。

## 4. ADR 清单

| 编号 | 决策 |
| --- | --- |
| [018](adr/018-edit-strategies.md) | 编辑策略：直接保存（PATCH + ETag）和草稿（`Common.DraftRoot` 的动作）都实现 `EditStrategy`；按模型自动选择 |
| [019](adr/019-draft-test-service.md) | 草稿测试服务：同一份采购 CSDL 派生 `/odata/purchasing-draft/`，用 `@sap-ux/fe-mockserver-core` 的原生草稿 |
| [020](adr/020-responsive-table.md) | 响应式表格自己用 HTML 表格实现，不用 AG Grid |
| [021](adr/021-charts.md) | 图表和微图表自己用 SVG 实现，数据用 `$apply` 聚合；不引入图表库 |
| [022](adr/022-flexible-column-layout.md) | 弹性分栏：库提供受控的 `FlexibleColumnLayout`，列布局由宿主的路由决定 |
| [023](adr/023-messages.md) | 消息模型：OData 错误详情 + `sap-messages` 头 + 客户端校验，统一进页脚消息按钮和消息弹窗 |
| [024](adr/024-actions.md) | 动作：`UI.DataFieldForAction` 生成表动作、行内动作、页头动作和页脚动作；`Core.OperationAvailable` 决定可用性和部分处理 |

## 5. 规范没写明、按默认建议执行的决定

| 编号 | 问题 | 决定 | 理由 |
| --- | --- | --- | --- |
| U-3 | 分享菜单里有什么 | "发送邮件"（`mailto:`，正文是当前页面链接）和"复制链接"。"存为磁贴""SAP Jam"不做 | 规范列的另两项依赖 SAP 平台（v5 第 2 节不做） |
| U-4 | 图表下钻的目标 | 点图表元素弹出框，"显示明细"把该维度值作为筛选条件加到同一个列表页并切到表格视图 | [LR] 说"通常是另一个列表页"；本库不知道宿主有哪些列表页，用同一页面的表格最通用 |
| U-5 | 分组 | 只在响应式表格里提供（个性化对话框的"分组"页）；网格表格不提供 | AG Grid Community 没有行分组（ADR-002）；[LR] 说"只开启需要的功能" |
| U-6 | 多内容的筛选怎么作用到不同实体 | 筛选条件按属性名作用到有同名属性的实体集；没有同名属性的条件对该表忽略，并在页签上显示提示 | 规范只说"同时作用于所有表"，没有说明不同实体的映射 |
| U-7 | 直接保存服务的新建 | 列表页"新建"打开对话框（必填字段少于 8 个时），保存即 POST；对象页"新建"进入新建模式 | [LR] Add/Create Using a Dialog；[OP] Create |
| U-8 | 草稿的自动保存频率 | 字段失去焦点或停止输入 600ms 后 PATCH 草稿 | 规范只说"在后台自动保存" |
| U-9 | 工作模式的默认值 | 工作清单模式（规范说约 80% 的场景） | [LR] Working Modes |
| U-10 | "Show All (x)" 的阈值 | 子表条数大于 200 时只预览 20 行并显示链接；链接打开一个只有这张表的动态页 | [OP] Tables：">200 用导航到另一页，预览 10 行、不超过 20" |
| U-11 | 布局动作在什么页面出现 | 只在弹性分栏里出现（关闭、全屏、退出全屏）；单独使用的对象页没有布局动作 | [DP] Header Title (6)："主要由弹性分栏提供" |
| U-12 | 摘要行（手机）的阈值 | 页面宽度 < 600px 时，折叠的页头只显示标题和右侧箭头按钮 | [DP] Summary Line；600px 与一期的小屏断点一致 |
| U-13 | 对象页的 Letterboxing | 默认关闭；`DynamicPage` 的 `letterboxing` 属性开启时，内容最宽 1280px 居中 | [DP]：大多数业务应用不用 |
| U-14 | 动态侧边内容的开关位置 | 页头全局动作区的图标按钮"显示 / 隐藏侧边内容" | 规范只规定内容（只放上下文信息、不放终结动作），没有规定开关 |
| U-15 | 删除后去哪里 | 对象页删除成功后调用导航适配器回到列表页；列表页删除后刷新表格并显示消息 | [OP] Delete Objects 要求确认，返回位置未写 |
| U-16 | 微图表数据来源 | 微图表 Facet 引用 `UI.Chart`：单值类（Bullet、Radial、Harvey Ball、Delta）用 DataPoint；序列类（Column、Line、Comparison）用一个集合导航的前 N 条 | 与 SAP Fiori Elements 的注解写法一致 |
| U-17 | 网格表格在手机上 | `SmartListReport` 的 `tableType="auto"`：页面宽度 < 600px 时换成响应式表格 | [LR] Responsiveness：网格表格只支持桌面和平板，手机要换响应式控件 |

## 6. 风险与对策

| 风险 | 对策 |
| --- | --- |
| 草稿把主键变成 `(PurchaseOrder, IsActiveEntity)`，影响一期的实体路径和端到端用例 | 草稿放在单独的服务（ADR-019），一期用例不变 |
| 包体积预算（react ≤ 80 KB gzip） | 图表自己写 SVG，不引入库；新组件按需加载不做，先测体积，超了再拆 |
| 端到端用例数量翻倍，运行时间变长 | 用例按文件分组，共享测试服务；每个用例开始时重置数据（`POST /test/reset`） |
