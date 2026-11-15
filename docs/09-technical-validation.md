# 09 阶段 1.5 技术验证报告

> 日期：2026-11-14—15。**补记（2026-11-15）**：第 2 项验证的 ASP.NET Core OData 后来按 v5 第 3.3 节换成了 `@sap-ux/fe-mockserver-core`（ADR-017），本表保留当时的结论。v5 第 10 节要求验证五个高风险假设。结论：五项都成立；验证中有两处推翻或修正了阶段 1 的设计，已先改文档再继续。

| # | 假设 | 结论 | 证据 | 对设计的影响 |
| --- | --- | --- | --- | --- |
| 1 | 从真实 `$metadata` 解析、合并、推导，得到模型 | **成立** | `packages/core/test/samples.test.ts`：两个测试服务的 XML 与 JSON `$metadata`（中英文）都能建模，且 XML 与 JSON 得到相同模型（ANN-70）；采购订单服务的 UI 全部来自注解，Northwind 服务全部推导 | **修正**：`@sap-ux/edmx-parser` 不读写在元素内部的注解，只认 `<Annotations Target>` 块。新增 `csdl/hoist.ts`，解析前把内联注解挪成外部块（`04-model-spec.md` 第 1–2 节已更新） |
| 2 | ASP.NET Core OData 能原样输出 UI 注解，支持 `$batch`、`$count`、`$search`、ETag | **成立，有三处需自己写** | 测试服务在 `apps/mock`；技术验证的结论写在 ADR-009 | `$search` 不注册 `ISearchBinder` 时会被静默忽略，必须实现；`$batch` 变更集没有事务性（一期不用 `$batch`，ADR-015）；Microsoft.OData.Edm 不能原样输出部分注解形态，`$metadata` 直接输出模板（`08-test-services.md` 第 5 节） |
| 3 | 按 id 替换和按位置插入，在表格列、工具栏和对象页区块上可行 | **成立** | 端到端 AC-EXT-01（替换单元格、替换工具栏）、AC-EXT-02（插入列、插入依赖选中行的动作）、AC-EXT-03（插入区块并出现在锚点栏）；单元测试覆盖 `applyExtensions` 的各种位置 | 无 |
| 4 | 运行时切换主题和密度，Mantine 与 AG Grid 都跟着变 | **成立** | 端到端 AC-THEME-02：切换后表格背景、行高、按钮颜色都变化，表格 DOM 节点不重建；AG Grid 的主题参数直接写 `var(--sk-…)`（包括行高） | **补充**：Mantine 的 Alert、Badge 等用到的 red / blue / green / yellow / orange 色板也要桥接，否则深色主题下对比度不足（axe 发现，已修） |
| 5 | 编辑接缝：一个字段进入编辑、PATCH、处理 ETag 冲突 | **成立** | `spikes/edit-seam/directEditStrategy.ts` + 端到端 `edit-seam.spec.ts`：在采购订单服务上 PATCH 成功并拿到新 ETag；第二个持有旧 ETag 的编辑会话得到 `ConcurrencyError`（HTTP 412）；`SmartField` 的 `mode="edit"` 在 Storybook 里演示 | 验证代码在 `spikes/`，不在任何包的发布范围内 |

## 推翻的设计

- **对象读取**：阶段 1 原设计是"按区块分批读取表单字段"。观察参考应用后改为"一次读取页头和所有区块的表单字段，子表按需加载"（Q-08，`query-shapes.md`）。
- **锚点导航时先折叠页头**：原设计是点锚点时先把页头设为折叠。实测会让页头永久处于手动折叠状态，回到顶部也不再展开，不符合 snap on scroll。改为直接滚动越过页头，让它按滚动自然折叠，再按最终的吸顶高度校正一次位置。
