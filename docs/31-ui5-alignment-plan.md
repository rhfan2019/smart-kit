# 31 推进计划：与 SAPUI5 对齐

> 状态：现行 · 2026-11-17（讨论记录 D34、D35，ADR-033）。规则见 `30-ui5-alignment-guide.md`，验收标准见 `32-ui5-alignment-acceptance.md`。每个阶段完成时在本文"进度"一节记一行，在 `12-discussion-log.md` 记一条。

## 0. 原则

- **先有核对工具，再改代码**：阶段 0 先把两道核对（API 核对、FE 对比测试）做出来，跑出基线；之后每个阶段都以"核对差异只减不增"推进。
- **按风险排序**：先改会导致结果错误的注解问题（D33 的 P1），再改名、再补全。
- **每阶段可发布**：每个阶段结束时全部检查通过、可以发一个 0.x 小版本；不在半途留红。
- **不留旧名**（D35）：改名直接改，不留废弃别名和旧子路径；每阶段把"旧 → 新"写进 `25` 的迁移清单，invoice-assure 由用户在全部完成后统一改。
- **在 main 上开发**（D35）：不开功能分支，每个阶段直接在 main 上本地提交。
- **不确定就核实**：遇到"FE 到底怎么做"的问题，读 sap.fe 源码或在 FE 对比应用里跑一遍，不凭印象。
- **范围外的不做**：本计划只做对齐。新功能另开讨论。

## 1. 阶段

### 阶段 0：基础设施和基线

1. ADR-033、本计划、`30`、`32` 已有（D34）。
2. `scripts/check-ui5-api.mjs` 和 `npm run check:ui5`（`30` 第 7.1 节）：下载并缓存 1.154.0 的 `api.json`；读 TypeScript 类型；比对；输出报告。
3. `tools/ui5-alignment/mapping.json`：现有全部导出逐个填对应的 UI5 类（`30` 第 4 节"待定"的几个在这里定下来，结果写回 `30`）。
4. `tools/ui5-alignment/deviations.json`：先把现状全部登记进去（基线），按类别统计。
5. 下载 sap.fe.macros、sap.fe.templates 的 `api.json`，生成 `26b-ui5-api-fe-1.154.md`（同 `26a` 的格式，覆盖 `Table`、`TreeTable`、`FilterBar`、`Field`、`Form`、`Chart`、`MicroChart`、`VariantManagement`、`MessageButton`、`Share`、`KPITag`、`Paginator`、`MultiValueField`、`Status`、`FlexibleColumnLayoutActions` 及其子类型）。
6. 确定 manifest 设置的权威来源（`30` 第 8 节），把 ListReport / ObjectPage 用到的设置列成 `26c-fe-manifest-settings-1.154.md`。
7. `apps/fe-reference` 和 `npm run e2e:fe`（`30` 第 7.2 节）：真 FE 列表页和对象页连 `apps/mock`；先做 3 个场景（采购订单列表页首屏、带筛选、草稿服务首屏），能输出请求和结构的差异。
8. 两道核对接进 CI（需要联网；缓存 `.cache/ui5`）。

完成标准：AL-01、AL-02、AL-20、AL-21 通过；基线报告 `reports/ui5-alignment.md` 生成并提交（只有统计和差异名，不含 SAP 文件内容）。

### 阶段 1：模块路径，D31 新控件归位

1. 模块路径改为"只换前缀"（`30` 第 3 节）：源码按 UI5 路径放（`packages/react/src/m/MessageBox.tsx`、`src/v4/fe/macros/…`、`src/ui/core/library.ts`、`src/kit/…`），每个类一个模块、默认导出；`package.json` 的 exports 改为通配；`vite.config.ts` 的入口、体积预算（按模块或按库）、`verify:pack`、`gen-agent-docs`、包文档的导入说明一并改。
2. D31 的控件、消息控件、卡片、枚举（`ui/core/library`、`m/library`、`f/library`、`suite/ui/commons/library`…）移到各自的模块；类型改名为 `$XxxSettings`、`Xxx$YyyEvent`、实例类型与类同名（`30` 第 3 节）。删除 `/controls`、`/messages`、`/cards` 等旧子路径。
3. 根入口：不再导出组件（只留基础设施或删除，在本阶段定，写进 `30`）。
4. D31 控件跑 `check:ui5`，剩下的差异修掉或登记（它们按 1.154 写过，差异应该很少）。
5. 示例应用、Storybook、测试、文档里的导入全部改为新路径。

完成标准：AL-01～AL-09 对 D31 控件和卡片通过；AL-30（旧路径不存在）。

### 阶段 2：注解积木改名并对齐 sap.fe.macros

按 `30` 第 4 节，逐个做（建议顺序）：`Field`、`FilterBar`、`Table`（含 `TreeTable`）、`VariantManagement`、`Form`、`Chart`、`MicroChart`（注解驱动）、`MessageButton`、`Share`、`KPITag`、`Paginator`、`FlexibleColumnLayoutActions`，以及普通控件 `Table`（`/m`）、`DynamicPage`（含 Title / Header）、`FlexibleColumnLayout`、`ObjectPageLayout` 系列、`GenericTag`；删 `DraftMarker`、`OverflowActions`。

每个积木：
- 属性、事件、方法对齐 `26b`；`contextPath` / `metaPath` 按 `30` 第 5.2 节；旧名、旧属性直接删除（D35），写进 `25` 的迁移清单。
- `28` 里列出的同义改名、取值不同、用法不同的各项在这里一并完成。

完成标准：AL-01～AL-09 对这些组件通过；AL-30。

### 阶段 3：列表页注解，结果会错的（D33 P1）

`29` 第 4 节八项：草稿列表"全部"和六个编辑状态、`Aggregation.CustomAggregate`、图表全部维度和度量、`Common.FilterDefaultValue`、值帮助 In / InOut / Constant 过滤和 Out 回写、多视图完整 SV、搜索框缺省、`Common.IsDigitSequence` 补零；以及 `OperationAvailable` 对非绑定动作的缺陷。

每项：先在 FE 对比测试里加场景（测试服务缺注解就补），看 FE 的请求和结果，再改 smart-kit，直到对比一致。`02` 按 `29a` 重写为以 FE 源码为依据的覆盖表（每条写 FE 模块）。

完成标准：AL-10、AL-11、AL-12（P1 部分）通过；这些场景的 `fe-behavior` 偏差为 0。

### 阶段 4：列表页注解，其余（D33 P2、P3）

按 `29` 第 5、6 节：列（各种 DataField、CssDefaults、行高亮、个性化）、动作（ActionGroup、CreateHidden / DeleteHidden、IsActionCritical、IsCopyAction、Determining、Deletable 路径、新建方式）、筛选栏和值帮助（FilterExpressionRestrictions、HiddenFilter、FilterFunctions、带限定符的 ValueList、ValueListReferences、ResultContext、日期运算符、描述列、令牌排列）、值的显示（Communication、小数位和 CodeList、对齐、进度条状态色、LinkTarget、ExternalID、Masked、Timezone、Stream、SemanticObject 智能链接）、视图和图表（LineItem 选定规则、图表类型、多视图来源、自动选择表格类型、默认合计、KPI、SideEffects）。第 6 节"smart-kit 多做的"逐条决定后改。

完成标准：AL-12（全部）；列表页的 `fe-behavior` 偏差只剩用户确认保留的。

### 阶段 5：页面模板对齐 sap.fe.templates

1. `SmartListReport` → `ListReport`、`SmartObjectPage` → `ObjectPage`（`v4/fe/templates/…`，模块路径按 sap.fe.templates 的实际结构定），属性按 `26c` 的 manifest 设置（嵌套对象，`30` 第 5.3 节）。
2. `apps/fe-reference` 的 manifest 和 smart-kit 示例页的属性逐项对应，对比测试覆盖 `views`、`initialLoad`、`variantManagement`、`tableSettings`、`creationMode`、`sectionLayout`、`editableHeaderContent`。
3. D32 第 3.9 节（模板未核实部分）在这里完成。

完成标准：AL-13；AL-01～AL-09 对两个模板通过。

### 阶段 6：对象页注解和剩余控件

1. 对象页注解：按 D33 的方法对照（FE 源码 `converters/ObjectPage/*`、`controls/Common/Form`、`HeaderFacet`、`SubSection` 等），写 `29b`、`29c`，再分 P1 / P2 修改，对比测试覆盖对象页（显示、编辑、草稿、子表、页头 Facet）。
2. 九个微图表控件（`suite/ui/microchart/…`）、`m/p13n/Popup`、`m/QuickView` 等 `30` 第 4 节剩下的。
3. 阶段 5 留下的（D46）：分组分析表改成可折叠层级；变式管理 `Control`；表格积木的变式和快速变式；组合视图；自定义页眉；后续块的 `$top`；草稿新建问非计算键的对话框；显示态页脚的确定性动作；编辑态页头的草稿切换；标为阶段 6 的 `manifest-missing`。另有两处声明了但没实现、也没登记的设置：对象页的 `variantManagement`（`ObjectPage.tsx` 不读）；列表页 `views.paths[].annotationPath` 指向 SelectionVariant（FE 允许，smart-kit 当默认视图处理）。

完成标准：AL-12 扩展到对象页；AL-01～AL-09 全部模块通过。

### 阶段 7：收尾和迁移清单

1. `25-invoice-assure-issues.md` 的迁移清单整理完整（旧名 → 新模块、属性改名、行为改动），供用户回去统一修改 invoice-assure。
2. `deviations.json` 只剩 `kit-extension`、`react-idiom`、`no-binding` 和用户确认保留的条目；写总结报告（每阶段做了什么、剩余偏差按类别、需要用户决定的事）。
3. 是否发 1.0 由用户决定。

完成标准：AL-31、AL-32。

## 2. 每个阶段都要做的

- 先写验收条目（`32` 的 AL 编号细化到具体组件或场景，写进 `32` 的附表），再写测试和代码。
- 全部检查通过（`30` 第 7 节），一个阶段至少一个提交；写 changeset（minor）和 CHANGELOG；更新 `docs/api.md`、`reference.md`、包文档、示例、Storybook、`handoff.md`。
- 在 `12-discussion-log.md` 记一条（Dxx），"进度"一节记一行，`25` 的迁移清单追加本阶段的改名。
- 遇到需要用户决定的取舍（例如推翻以前的有意设计、某个 UI5 功能做不到要登记长期偏差），停下来问，不自行决定。

## 3. 进度

| 阶段 | 状态 | 提交 | 讨论记录 | 说明 |
| --- | --- | --- | --- | --- |
| 0 | 完成 | 4ec9236 | D36 | `check:ui5`（189 个导出，基线 1146 条偏差）、`e2e:fe`（3 个场景 + 自测）、`26b`、`26c`、CI |
| 1 | 完成 | 533580a、204d8c6 | D37 | 63 个 UI5 模块，`/controls`、`/messages`、`/cards` 删除；阶段 1 模块 0 处未登记；`not-implemented` 752 → 441 |
| 2 | 完成 | 89ac1fc | D38 | 114 个 UI5 模块；旧子路径只剩 `/templates`，根入口只有基础设施；`not-implemented` 441 → 119 |
| 3 | 完成 | 360b348 | D39、D40 | 八项 P1 和 OperationAvailable 缺陷按 FE；FE 对比 15 个场景；`02` 按 FE 源码重写；`fe-behavior` 32 → 28 |
| 4 | 完成 | 66c48a3 | D43 | 列、动作、筛选栏、值帮助、值的显示、视图、图表、KPI 按 FE；FE 对比 37 个场景；`fe-behavior` 28 → 13；收尾（D45）：分析表单请求、引用的值帮助、参数化实体集、列和动作的 FE 核对，FE 对比 60 个场景 |
| 5 | 完成 | a8a942b | D46 | `ListReport`、`ObjectPage` 在 `v4/fe/templates`，属性是 manifest 设置（AL-13 核对：LR 333 项、OP 382 项，0 未登记）；`/templates` 删除；FE 对比 75 个场景 |
| 6 | 完成 | ef4ffd0 | D47 | 对象页注解按 FE（`29b`、`29c`）；九个微图、`m/p13n`、`m/QuickView`、landmark info；积木补齐 sap.fe.macros 成员，分组分析表可折叠；`check:ui5` 256 个导出 0 未登记，AL-13 0 未登记；FE 对比 101 个场景；`not-implemented` 135（阶段 7 处理） |
| 7 | 未开始 | | | |
