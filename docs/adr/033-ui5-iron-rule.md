# ADR-033 铁律：组件、命名空间、API 和注解语义与 SAPUI5 1.154 一致

- **背景**：D31～D33 发现，smart-kit 只有组件名和 UI5 一致（ADR-011），属性、事件和方法大多按 React 习惯起名（`28`）；注解的处理和 Fiori elements 只有约 15% 完全一致（`29`）。使用方是 UI5 开发者，每处不同都要来回对照、试错。用户定下铁律（D34）。
- **决定**：
  1. **对齐的对象**：
     - 注解驱动的积木对齐 **sap.fe.macros**（OData V4 building blocks：`Table`、`FilterBar`、`Field`、`Form`、`Chart`、`MicroChart`、`VariantManagement`、`MessageButton`、`Share`、`KPITag`、`Paginator`……），不是 V2 的 sap.ui.comp。
     - 页面模板对齐 **sap.fe.templates**（`ListReport`、`ObjectPage`），属性对齐 Fiori elements 的 manifest 设置。
     - 普通控件对齐它们在 UI5 里的类（sap.m、sap.f、sap.uxap、sap.ui.core、sap.ui.unified、sap.ui.table、sap.suite.ui.commons、sap.suite.ui.microchart）。
  2. **路径只换前缀，后面无条件一致**（D35）：UI5 的模块路径 `sap/<路径>` 在 smart-kit 里是 `@rhfan2019/smart-kit/<路径>`；属于 OData V4 专用库的（`sap.fe.*`）多一层 `v4`：`@rhfan2019/smart-kit/v4/<路径>`。每个类一个模块、默认导出，和 UI5 的 TypeScript 写法一样；枚举从所在库的 `library` 模块具名导出。例如：
     - `import Table from "sap/fe/macros/Table"` → `import Table from "@rhfan2019/smart-kit/v4/fe/macros/Table"`
     - `import MessageBox from "sap/m/MessageBox"` → `import MessageBox from "@rhfan2019/smart-kit/m/MessageBox"`
     - `import { ValueState } from "sap/ui/core/library"` → `import { ValueState } from "@rhfan2019/smart-kit/ui/core/library"`
     - 类型名也照 UI5 的 TypeScript 定义：设置 `$TableSettings`，事件 `Table$RowPressEvent`，实例类型就是类名（`useRef<Table>`）。
     - V2（`sap.ui.comp` 等）暂不实现；将来做时放 `@rhfan2019/smart-kit/v2/<路径>`。
  3. **API 一致**：属性、默认值、枚举值、聚合、关联、事件和事件参数、方法，与 SAPUI5 1.154.0 的 `api.json` 一致；在 React 里的写法按 ADR-032 的八条规则。
  4. **注解语义一致**：同一份 `$metadata` 和注解，smart-kit 发出的 OData 请求、渲染出的结构（筛选字段、列、动作、单元格文本）与 Fiori elements 1.154 一致；有疑问时以 sap.fe 1.154 的源码为准。
  5. **偏差必须登记**：做不到或有意不同的地方，逐条登记在偏差表（`tools/ui5-alignment/deviations.json`，`30` 第 6 节），写明类别、原因和出处；没登记的偏差是缺陷。
  6. **必须核对**：开发完成后用 `30` 第 7 节的两道核对（API 核对脚本、和真 Fiori elements 的对比测试）证明一致，不能只凭阅读。
  7. **UI5 没有对应的**：放在 `@rhfan2019/smart-kit/kit/<名字>`（组件、hooks）或基础子路径（`/context`、`/theme`、`/i18n`、`/util`），并在映射表里写明"无 UI5 对应"的理由。
  8. **不留旧名**（D35）：改名直接改，不保留废弃别名和旧子路径；invoice-assure 由用户在对齐完成后统一修改。
  9. **SAP 的文件不进仓库**：`api.json`、sap.fe 源码、SAPUI5 运行时都在核对时从 `ui5.sap.com` 下载到缓存目录，不提交、不随包发布（v5 第 3.3 节）。
- **理由**：同名同义，UI5 开发者看 UI5 的 API 参考和 Fiori elements 文档就能用；有自动核对，以后每次改动都能证明没有偏离。
- **代价**：几乎所有现有组件要改名、改属性，使用方（invoice-assure）要整体改一次；根入口不再导出组件（UI5 里 `sap.m.Table`、`sap.fe.macros.Table`、`sap.ui.table.Table` 同名）；`package.json` 的 exports 改为通配（`./*`、`./v4/*`）；核对需要联网。
- **取代**：ADR-011（Smart* 名字，改为 sap.fe.macros 的名字）；补充 ADR-032（ADR-032 的 React 写法规则继续有效）。
- **状态**：采纳（2026-11-17，D34；路径、v4 和不留旧名按 D35 修订）。
