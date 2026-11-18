# 30 开发文档：与 SAPUI5 对齐（铁律）

> 状态：现行 · 2026-11-17（讨论记录 D34，ADR-033）。推进计划见 `31-ui5-alignment-plan.md`，验收标准见 `32-ui5-alignment-acceptance.md`。

## 1. 铁律

> **组件名、命名空间（只换前缀）、属性、默认值、枚举、聚合、事件、方法，以及注解的处理，必须和 SAPUI5 1.154 一致。开发完成后必须和 UI5 核对。**

- 基准版本：**SAPUI5 1.154.0**（和 `26a` 一致）。换版本要另开讨论记录，重跑全部核对。
- "一致"的判定以两样东西为准：UI5 的 `api.json`（API）和 sap.fe 的源码加真 Fiori elements 的运行结果（注解语义）。文档、记忆、"大概是这样"都不算。
- 做不到的地方登记为偏差（第 6 节）。没登记的不同就是缺陷。

## 2. 对齐对象：选哪个 UI5 类

一个 smart-kit 组件按下面的顺序找它的 UI5 对应，取第一个有的：

1. **注解驱动的积木** → `sap.fe.macros`（OData V4 building blocks）。例如表格、筛选栏、字段、表单、图表、微图表、变体管理、消息按钮、分享、KPI 标签、分页器、多值字段、状态。
2. **页面模板** → `sap.fe.templates`（`ListReport`、`ObjectPage`）。它们在 Fiori elements 里由 manifest 配置，所以属性对齐 manifest 设置（第 5.3 节）。
3. **普通控件** → 它在 UI5 里的类：sap.m、sap.f（含 sap.f.cards）、sap.uxap、sap.ui.core（枚举）、sap.ui.unified、sap.ui.table、sap.suite.ui.commons、sap.suite.ui.microchart、sap.m.plugins、sap.m.upload、sap.m.p13n。
4. **都没有** → smart-kit 自己的组件，放在 `/kit`，映射表里写明理由。

V2 的 sap.ui.comp（SmartTable 等）**不作为**对齐对象（ADR-033 取代 ADR-011）。

## 3. 路径：只换前缀，后面无条件一致（D35）

**规则**：UI5 的模块路径 `sap/<路径>` → `@rhfan2019/smart-kit/<路径>`；OData V4 专用的库（`sap.fe.*`）→ `@rhfan2019/smart-kit/v4/<路径>`。去掉前缀以后，后面的每一段（命名空间、类名、`library`）都和 UI5 一字不差。

- **每个类一个模块，默认导出**，和 UI5 的 TypeScript 写法相同：

  | UI5（TypeScript） | smart-kit |
  | --- | --- |
  | `import Table from "sap/fe/macros/Table"` | `import Table from "@rhfan2019/smart-kit/v4/fe/macros/Table"` |
  | `import ListReport from "sap/fe/templates/ListReport/Component"`（模板是组件） | `import ListReport from "@rhfan2019/smart-kit/v4/fe/templates/ListReport"`（模块路径在阶段 5 按 sap.fe.templates 的实际结构定，原则不变） |
  | `import MessageBox from "sap/m/MessageBox"` | `import MessageBox from "@rhfan2019/smart-kit/m/MessageBox"` |
  | `import UploadSetwithTable from "sap/m/plugins/UploadSetwithTable"` | `import UploadSetwithTable from "@rhfan2019/smart-kit/m/plugins/UploadSetwithTable"` |
  | `import ProcessFlow from "sap/suite/ui/commons/ProcessFlow"` | `import ProcessFlow from "@rhfan2019/smart-kit/suite/ui/commons/ProcessFlow"` |
  | `import DynamicPage from "sap/f/DynamicPage"` | `import DynamicPage from "@rhfan2019/smart-kit/f/DynamicPage"` |

- **枚举**从所在库的 `library` 模块具名导出：`import { ValueState } from "@rhfan2019/smart-kit/ui/core/library"`、`import { ButtonType } from "@rhfan2019/smart-kit/m/library"`（UI5：`sap/ui/core/library`、`sap/m/library`）。类上的枚举照旧是静态成员（`MessageBox.Action`）。
- **类型名**照 UI5 的 TypeScript 定义（`@openui5/types`、`@sapui5/types` 的命名规则）：
  - 设置（属性）类型：`$<类名>Settings`，从该模块具名导出（`import MessageStrip, { $MessageStripSettings } from ".../m/MessageStrip"`）；
  - 事件对象类型：`<类名>$<事件名首字母大写>Event`（`MessageStrip$CloseEvent`）；
  - 实例类型就是类名：`const ref = useRef<MessagePopover>(null)`（组件函数和同名接口合并，接口里是实例方法）。
- **"OData 相关"只指 `sap.fe.*`**：sap.m、sap.f、sap.uxap、sap.ui.*、sap.suite.* 和 OData 版本无关，不加 `v4`。将来做 V2（`sap.ui.comp` 等）时放 `@rhfan2019/smart-kit/v2/<路径>`。
- **UI5 没有对应的**：`@rhfan2019/smart-kit/kit/<名字>`（每个一个模块）；基础设施保留 `/context`、`/theme`、`/i18n`、`/util`。
- **根入口** `@rhfan2019/smart-kit` 不再导出组件（UI5 里 `sap/m/Table`、`sap/fe/macros/Table`、`sap/ui/table/Table` 同名，不能摊平）。**阶段 1 定（D37）**：归位的模块立即从根入口去掉；阶段 2 全部归位以后删除根入口，只留基础子路径和 UI5 模块。
- `package.json` 的 `exports`：阶段 1 起由 `scripts/gen-exports.mjs` 按模块文件生成明确的列表（D36 补记，路径和通配相同）。原设想是通配：`"./v4/*"`、`"./m/*"`、`"./f/*"`……（或统一 `"./*"`），源码目录按同样的路径放：`packages/react/src/v4/fe/macros/Table.tsx`、`packages/react/src/m/MessageBox.tsx`。打包按模块拆分（ADR-026 的"用多少付多少"更自然）。
- 路径里没有商标词（`sap` 已被替换），`check-trademark` 不受影响。

## 4. 现有导出的目标

"目标模块"一列是改名后的模块路径（省略前缀 `@rhfan2019/smart-kit/`）。"P"列是推进计划 `31` 的阶段。改名直接改，不留旧名（D35）。

| 现在 | 目标模块 | 对应 UI5 | P |
| --- | --- | --- | --- |
| `SmartTable` | `v4/fe/macros/Table`；层级表另有 `v4/fe/macros/TreeTable` | sap.fe.macros.Table、TreeTable | 2 |
| `SmartFilterBar` | `v4/fe/macros/FilterBar` | sap.fe.macros.FilterBar | 2 |
| `SmartField` | `v4/fe/macros/Field` | sap.fe.macros.Field | 2 |
| `SmartForm` | `v4/fe/macros/Form` | sap.fe.macros.Form | 2 |
| `SmartVariantManagement` | `v4/fe/macros/VariantManagement` | sap.fe.macros.VariantManagement | 2 |
| `ChartView` | `v4/fe/macros/Chart` | sap.fe.macros.Chart | 2 |
| `MicroChart`（注解驱动） | `v4/fe/macros/MicroChart`；九个控件 `suite/ui/microchart/BulletMicroChart` 等 | sap.fe.macros.MicroChart；sap.suite.ui.microchart.* | 2、6 |
| `MessageButton` | `v4/fe/macros/MessageButton` | sap.fe.macros.MessageButton | 2 |
| `ShareMenu` | `v4/fe/macros/Share` | sap.fe.macros.Share | 2 |
| `GenericTag`（KPI 用法） | `v4/fe/macros/KPITag`；普通标签 `m/GenericTag` | sap.fe.macros.KPITag；sap.m.GenericTag | 2、4 |
| FCL 的 `midPaging` / `endPaging` | `v4/fe/macros/Paginator`、`v4/fe/macros/FlexibleColumnLayoutActions` | sap.fe.macros.* | 2 |
| `SmartListReport` | `v4/fe/templates/ListReport`（具体路径阶段 5 定） | sap.fe.templates.ListReport | 5 |
| `SmartObjectPage` | `v4/fe/templates/ObjectPage`（同上） | sap.fe.templates.ObjectPage | 5 |
| `ResponsiveTable` | `m/Table`（另有 `m/Column`、`m/ColumnListItem`） | sap.m.Table | 2 |
| `TableP13nDialog` | `m/p13n/Popup` | sap.m.p13n.Popup | 6 |
| `DynamicPage` | `f/DynamicPage`、`f/DynamicPageTitle`、`f/DynamicPageHeader` | sap.f.* | 2 |
| `FlexibleColumnLayout` | `f/FlexibleColumnLayout`（`LayoutType` 在 `f/library`） | sap.f.FlexibleColumnLayout | 2 |
| `ObjectPageLayout`、`AnchorBar` | `uxap/ObjectPageLayout`、`uxap/AnchorBar`，另有 `uxap/ObjectPageSection`、`uxap/ObjectPageSubSection`、`uxap/ObjectPageDynamicHeaderTitle` | sap.uxap.* | 2 |
| `Card` | `f/Card` | sap.f.Card | 1 |
| `Header`、`NumericHeader`、`NumericSideIndicator` | `f/cards/Header` 等 | sap.f.cards.* | 1 |
| `ListContent` 等卡片内容 | `ui/integration/cards/ListContent` 等 | sap.ui.integration.cards.*（内部类，按集成卡片 manifest 的设置） | 1 |
| 消息控件（D31） | `m/MessageToast`、`m/MessageBox`、`m/MessageStrip`、`m/MessageView`、`m/MessageItem`、`m/MessagePopover` | sap.m.* | 1 |
| D31 的其他控件 | `m/ObjectStatus` … `m/IconTabBar`、`m/plugins/UploadSetwithTable`、`m/upload/UploadItem`…、`ui/unified/Currency`、`suite/ui/commons/ProcessFlow`… | 各自的类 | 1 |
| `ValueState`、`MessageType`、`IndicationColor`、`TitleLevel`… | `ui/core/library`（`MessageType` 按 UI5 是 `sap/ui/core/message/MessageType`，以 `api.json` 为准） | sap.ui.core.* | 1 |
| `ButtonType` 等 sap.m 枚举 | `m/library` | sap.m.* | 1 |
| `DraftMarker` | 删除，改用 `m/ObjectMarker` | sap.m.ObjectMarker | 2 |
| `OverflowActions` | 删除，改用 `m/OverflowToolbar` | sap.m.OverflowToolbar | 2 |
| `ValueHelpDialog`、`ConditionInput`、`AdaptFiltersDialog`、`FilterSummary`、`HeaderFacet`、`CreateDialog`、`SimpleChart`、`CriticalityIcon`、`FieldEditor`、`QuickViewLink` | `kit/<名字>`（阶段 0 查过：sap.fe.macros 和 sap.m 都没有公开对应，FE 里是 `macros/internal/*`、sap.ui.mdc 的内部组合或模板内部实现；`m/QuickView` 在阶段 6 另做，`QuickViewLink` 不是它） | 无（理由写在 `mapping.json`） | 0、2 |
| `SmartKitProvider`、`useSmartKit` 等 | `context`；文案 `i18n`；主题 `theme`（含 AG Grid 主题 `smartKitGridTheme`）；辅助函数（`getPath`、`conditionText`、`hiddenByImportance`、`draftState`、`messageTypeOf`、`toDates`…）`util` | 无 | 0、1 |
| hooks 和上下文（`useListQuery`、`useFilterState`、`useObject`、`useActionRunner`、`useMessages`、`MessageProvider`、`MessageHost`、`MessageIcon`、`ColumnContext`…） | `kit/<名字>`（每个一个模块） | 无 | 0、1、2 |
| 有自己模块的枚举：`IllustratedMessageType`、`IllustratedMessageSize`、`AvatarShape`、`AvatarSize`、`UploaderHttpRequestMethod`、`MessageType`、`CalendarWeekNumbering` | `m/IllustratedMessageType` 等、`ui/core/message/MessageType`、`base/i18n/date/CalendarWeekNumbering`，**默认导出**（api.json 的 `module` 不是 `library`，UI5 的 TypeScript 也是默认导入） | 同名 | 1 |

## 5. API 写法

### 5.1 通用（ADR-032 的八条规则，摘要）

1. 名字、属性名、默认值、枚举值（首字母大写的字符串）和 UI5 一致；枚举同时导出同名常量对象。
2. 有外观的聚合用 JSX 子元素，UI5 的 `key` 用 React 的 `key`；纯数据聚合用同名数组属性。
3. 事件：`on` + 事件名，处理函数收到的对象字段名就是 UI5 的事件参数名；可阻止的事件带 `preventDefault()`。
4. 静态方法是同名静态函数；实例方法用 `ref`；不提供 `get*` / `set*`；`sap.ui.core.Control` 的通用属性只做 `visible`、`busy`、`busyIndicatorDelay`、`fieldGroupIds` 中真正用到的。
5. 图标属性（`sap.ui.core.URI`）收 React 元素。
6. `sap.ui.core.CSSSize` 收 CSS 长度字符串。
7. 不做：数据绑定、`styleClass`、`textDirection`、`aria*` 关联、`tooltip`。

### 5.2 sap.fe.macros 积木在 React 里的写法

Fiori elements 的积木靠 `metaPath`（注解路径）和 `contextPath`（实体集路径）定位注解，靠 UI5 模型取数据。smart-kit 没有 UI5 模型：

- `contextPath`：实体集路径，写法和 FE 一样（`/PurchaseOrders`；导航用 `/PurchaseOrders/_Item`）。
- `metaPath`：注解路径，写法和 FE 一样（`@com.sap.vocabularies.UI.v1.LineItem#Q`，也接受别名 `@UI.LineItem#Q`，或 `@UI.SelectionPresentationVariant#Q`）。
- 数据来源：`SmartKitProvider` 里的服务；多服务时用扩展属性 `service`（登记为偏差，类别 `kit-extension`）。
- 对象上下文（对象页里的表格、字段）：由页面组件提供，等价于 FE 的绑定上下文；需要显式传时用扩展属性。
- 现在的属性按第 4 节和 `28` 映射到积木的属性（例如 `SmartTable.title` → `Table.header`，`exportable` → `enableExport`，`mode` → `type`，`editing` → `readOnly` 取反）；积木 API 里没有、smart-kit 又需要的（`extend` 扩展点、`query` 等），登记为 `kit-extension` 偏差。

### 5.3 sap.fe.templates 模板

`ListReport`、`ObjectPage` 的属性对齐 Fiori elements 的 manifest 设置（`initialLoad`、`variantManagement`、`views`、`controlConfiguration` 里的 `tableSettings`（`type`、`selectionMode`、`creationMode`、`enableExport`…）、`sectionLayout`、`editableHeaderContent`、`content.header.anchorBarVisible` 等）。manifest 是嵌套结构，React 里用同样嵌套的对象属性（例如 `controlConfiguration={{ '@com.sap.vocabularies.UI.v1.LineItem': { tableSettings: { type: 'GridTable' } } }}`），不扁平化改名。设置的权威来源在阶段 0 定（第 8 节）。

### 5.4 注解语义

- 以 `29`、`29a` 为基线；`02` 在阶段 3 按 `29a` 重写，每条写明 FE 的模块（`converters/...`、`macros/...`）。
- 新增或修改一个注解的处理，先读 sap.fe 1.154 的对应模块，写清 FE 的行为，再写代码；同时加 FE 对比测试（第 7.2 节）。
- 有疑问时以真 Fiori elements 的运行结果为准，不以文档为准。

## 6. 偏差登记

文件：`tools/ui5-alignment/deviations.json`，每条：

```json
{ "id": "DV-001", "module": "v4/fe/macros/Table", "ui5": "sap.fe.macros.Table", "member": "service", "kind": "property",
  "category": "kit-extension", "reason": "smart-kit 没有 UI5 模型，多服务时指定服务", "ref": "docs/30 §5.2" }
```

类别：
- `kit-extension`：smart-kit 多出来的（UI5 没有）。
- `not-implemented`：UI5 有、smart-kit 暂时没做，必须写计划阶段。
- `react-idiom`：React 写法导致的必要不同（例如受控属性的 `defaultXxx` 初值、`children`）。
- `no-binding`：依赖 UI5 数据绑定、在 smart-kit 里没有意义的。
- `different-value`：取值不同（尽量没有；有就必须写为什么做不到）。
- `fe-behavior`：注解语义与 FE 不同（只允许暂时存在，必须写计划阶段）。

API 核对脚本只放过登记过的偏差；`not-implemented` 和 `fe-behavior` 的条数按阶段只减不增（验收标准 AL-07）。

## 7. 核对（开发完成后必须做）

### 7.1 API 核对：`npm run check:ui5`

脚本 `scripts/check-ui5-api.mjs`：
1. 下载（或读缓存）SAPUI5 1.154.0 各库的 `api.json` 到 `.cache/ui5/1.154.0/`（不提交）。
2. 读映射表 `tools/ui5-alignment/mapping.json`：每个模块（例如 `v4/fe/macros/Table`）对应的 UI5 类全名，或 `"none"` 加理由。
3. 用 TypeScript 编译器读出每个模块的默认导出、设置类型（`$XxxSettings`）、实例类型（与类同名的接口）、事件类型、静态成员、枚举值。
4. 逐项比对：
   - 模块路径 = UI5 模块路径只换前缀（`sap.fe.*` 带 `v4`）；默认导出名 = 类名；枚举在 `library` 模块；类型名 `$<类>Settings`、`<类>$<事件>Event`；
   - UI5 的每个公开、未废弃的属性、聚合、关联、事件都有对应（事件为 `on` + 名字）；
   - 默认值：每个有 UI5 默认值的属性，TSDoc 里有 `@defaultValue`，且和 UI5 相同；
   - 事件参数：事件对象类型的字段名和 UI5 的参数名相同；
   - 方法：UI5 的公开实例方法（去掉 get / set / add / remove / bind 等）在实例类型里（通过 `ref` 调用），静态方法在组件上；
   - 枚举：值的集合相同（废弃的值可以没有）；
   - smart-kit 多出来的成员都登记为偏差。
5. 输出差异表；有未登记的差异时退出码非 0。`--report` 写出 `reports/ui5-alignment.md`（每个导出一行：同名数、偏差数、未登记数）。

实现（阶段 0）：`scripts/check-ui5-api.mjs` + `scripts/ui5/`（`api-cache.mjs` 下载和缓存，`ui5-model.mjs` 读 UI5 类并合并非基础祖先类的成员——`sap.ui.core.Control`、`Element`、`ManagedObject`、`BuildingBlock` 等基础类的成员不比，`kit-model.mjs` 用 TypeScript 读出属性、`@defaultValue`、事件参数、`ref` 上的方法和静态成员，`compare.mjs` 比对）。

- 差异的种类（`kind`）：`module-path`（还不在 UI5 路径）、`mapping-path`、`export-name`、`class-name`、`property`、`aggregation`、`association`、`event`、`event-param`、`event-preventDefault`、`default-value`、`method`、`static-method`、`static-member`、`enum-value`、`settings-type`、`instance-type`、`event-type`、`enum-type`、`kind`，多出来的 `extra-property`、`extra-event`、`extra-event-param`、`extra-method`、`extra-static`、`extra-enum-value`，以及 `dom-attributes`（属性继承了根元素的 DOM 属性，算一条）、`to-delete`（映射表里标了删除、还没删）、`manifest-settings`（模板和卡片内容，按 manifest 核对，`26c`）、`unmapped`（公开导出不在映射表里）。
- 偏差按 `module`（共享模块的具名导出写成 `m/library#ButtonType`）+ `kind` + `member` 匹配；`module: "*"` 对所有模块有效（例如 `className`、`textDirection`、aria 关联，ADR-032 规则 5、7）。
- 修好以后，对应的偏差成了"过时"（stale），脚本也报错：`--prune` 删掉它们。`--baseline` 把当前全部差异登记进去（只在阶段 0 用过一次）；`--format` 把两个表重写成一行一条。
- 自测：`tests/unit/check-ui5-api.test.ts`（AL-20），用 `tests/unit/fixtures/ui5-check/` 的组件故意改错属性名、默认值、事件参数。

### 7.2 Fiori elements 对比测试：`npm run e2e:fe`

- 新应用 `apps/fe-reference`：一个真 Fiori elements V4 应用（`sap.fe.templates.ListReport`、`ObjectPage`），运行时从 `https://ui5.sap.com/1.154.0/` 加载（不提交 SAP 文件），连本仓库的测试服务 `apps/mock`（和示例应用同一份 `$metadata`、注解和数据）。manifest 设置和 smart-kit 示例页的属性一一对应。
- Playwright 场景（`tests/e2e-fe/*.spec.ts`）对同一场景分别打开 FE 应用和 smart-kit 示例页，比较：
  1. **请求**：记录 OData 请求（批处理拆开），规范化后比较 `$select`、`$filter`、`$orderby`、`$apply`、`$expand`、`$search`、`$count`（`$skip`/`$top` 的分页大小单独比较）；
  2. **结构**：筛选栏字段及顺序、表格列标题及顺序、工具栏动作、编辑状态选项、视图页签、图表类型；
  3. **文本**：前 N 行的单元格文本（同一语言、同一时区、同一数据）；
  4. **交互**：输入筛选条件、打开值帮助、排序、执行动作后的请求和结果。
- 差异要么修掉，要么登记为 `fe-behavior` 偏差（带计划阶段）。
- 测试服务的注解要覆盖 `29a` 里 P1、P2 的注解（缺的在测试服务里补）。

### 7.3 其他已有检查

`npm run typecheck`、`npm run lint`（含 `check-tokens`、`check-trademark`）、`npm test`、`npm run e2e`、`npm run build && npm run size`、`npm run trace -- --strict`、`npm run verify:pack`、`node scripts/gen-agent-docs.mjs --check` 全部通过。

## 8. 资料从哪里来

| 资料 | 地址 | 用法 |
| --- | --- | --- |
| API | `https://ui5.sap.com/1.154.0/test-resources/<库路径>/designtime/api.json`（例如 `sap/fe/macros`、`sap/m`、`sap/f`、`sap/uxap`、`sap/ui/core`、`sap/ui/unified`、`sap/ui/table`、`sap/suite/ui/commons`、`sap/suite/ui/microchart`、`sap/ui/integration`） | 核对脚本、写 API |
| 源码 | `https://ui5.sap.com/1.154.0/resources/<模块路径>-dbg.js`；sap.fe 整库：`resources/sap/fe/<core|macros|templates|base>/library-preload.js` | 注解语义、默认值有疑问时 |
| 词汇表 | `https://github.com/SAP/odata-vocabularies`、`https://github.com/oasis-tcs/odata-vocabularies` | 术语定义 |
| manifest 设置 | 阶段 0 确定：SAPUI5 文档（`https://ui5.sap.com/1.154.0/#/topic/...` 的 Fiori elements 章节）和 sap.fe 源码里读取 manifest 的位置（`converters/ManifestSettings`、`ManifestWrapper`） | 模板属性 |
| 已有核对结果 | `26a`（控件 API）、`28`（已有组件）、`29`、`29a`（列表页注解） | 起点 |

都是核对时下载，不提交到仓库，不随包发布。

## 9. 不留旧名（D35）

- 改名、改属性直接改，**不保留废弃别名、旧子路径、根入口的旧导出**。
- 使用方现在只有 invoice-assure，用得不多；对齐全部完成后由用户回去统一修改。为此每个阶段在 `25-invoice-assure-issues.md` 末尾的"迁移清单"里追加：旧名 → 新模块、属性改名、行为改动。
- 版本：每个阶段发一个 0.x 的小版本（0.x 期间小版本可以不兼容），changeset 写明不兼容的改动；全部完成后由用户决定何时发 1.0。
- 行为改动（例如草稿列表的"全部"、默认可搜索）按 FE 改，写进 CHANGELOG 和迁移清单。

## 10. 每项改动的工作流

1. 找对应的 UI5 类（第 2 节）和模块路径（第 3 节），写进 `mapping.json`。
2. 读 `api.json`（和需要时的源码），列出全部成员；先写测试（属性、默认值、事件参数、方法），再写代码。
3. 注解驱动的，先在 FE 对比测试里加场景，看 FE 的请求和结构，再实现。
4. 做不到的登记偏差。
5. 跑第 7 节的全部核对；更新 `docs/api.md`、`reference.md`、使用文档、示例、Storybook。
6. 一个阶段一个提交（或几个），写 changeset 和讨论记录。
