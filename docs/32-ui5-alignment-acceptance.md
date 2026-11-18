# 32 验收标准：与 SAPUI5 对齐

> 状态：现行 · 2026-11-17（讨论记录 D34、D35，ADR-033）。规则见 `30`，计划见 `31`。
>
> 验收方式：**S** = API 核对脚本 `npm run check:ui5`；**F** = Fiori elements 对比测试 `npm run e2e:fe`；**U** = 单元测试；**E** = 端到端；**Z** = 体积和打包检查；**D** = 文档检查（人工核对，写明核对人和日期）。
>
> 每个阶段开始时把用到的条目细化成附表（例如 AL-05 细化为"AL-05-Table：sap.fe.macros.Table 的 36 个属性"），测试名称带细化后的编号，`npm run trace -- --strict` 检查每条都有通过的测试。

## 1. 名字和命名空间

| 编号 | 标准 | 方式 |
| --- | --- | --- |
| AL-01 | 每个公开模块都在 `tools/ui5-alignment/mapping.json` 里：对应一个 UI5 类全名（或 `library`），或标 `none` 并写理由；没有遗漏、没有多余 | S |
| AL-02 | 有 UI5 对应的模块，路径 = UI5 模块路径只换前缀（`sap/m/MessageBox` → `@rhfan2019/smart-kit/m/MessageBox`；`sap.fe.*` 带 `v4`：`sap/fe/macros/Table` → `@rhfan2019/smart-kit/v4/fe/macros/Table`），默认导出名 = 类名；没有 UI5 对应的只在 `kit/…` 或基础子路径 | S |
| AL-03 | 枚举从所在库的 `library` 模块具名导出（`ui/core/library`、`m/library`…），类型和同名常量都有，值的集合等于 UI5 未废弃的值 | S |

## 2. API

| 编号 | 标准 | 方式 |
| --- | --- | --- |
| AL-04 | 对应 UI5 类的每个公开、未废弃的属性、聚合、关联都有同名属性，或已登记偏差 | S |
| AL-05 | 每个有 UI5 默认值的属性，TSDoc 写了 `@defaultValue`，值与 UI5 相同；单元测试证明不传时的行为符合默认值 | S、U |
| AL-06 | 每个 UI5 事件有 `on` + 事件名的属性；事件对象的字段名与 UI5 参数名相同；可阻止的事件有 `preventDefault()` | S、U |
| AL-07 | UI5 的公开实例方法在 `ref` 上，静态方法在组件上，名字和参数顺序相同 | S、U |
| AL-08 | smart-kit 多出来的属性、事件、方法全部登记为偏差，类别和理由合理；`not-implemented` 和 `fe-behavior` 两类的条数逐阶段只减不增，每条都写了计划阶段 | S、D |
| AL-09 | 类型名照 UI5 的 TypeScript 定义：设置类型 `$<类名>Settings`，事件对象类型 `<类名>$<事件名>Event`，实例类型与类同名（`useRef<Table>`） | S |

## 3. 注解语义

| 编号 | 标准 | 方式 |
| --- | --- | --- |
| AL-10 | FE 对比测试的每个场景：smart-kit 与 FE 发出的 OData 请求规范化后相同（`$select`、`$filter`、`$orderby`、`$apply`、`$expand`、`$search`、`$count`），或差异已登记为 `fe-behavior` 偏差 | F |
| AL-11 | 每个场景的结构相同：筛选栏字段及顺序、表格列标题及顺序、工具栏动作及可用性、编辑状态选项、视图页签、图表类型和维度度量 | F |
| AL-12 | 每个场景前 N 行的单元格文本相同（同一语言、时区、数据）；`29` 列出的 P1 场景全部在 F 里覆盖；`02` 按 FE 源码重写，每条写明 FE 模块 | F、D |
| AL-13 | 模板的每个 manifest 设置在 smart-kit 里有同名同义的属性；FE 对比应用的 manifest 和 smart-kit 示例页的属性一一对应，对比测试通过 | F、S |

## 4. 核对工具本身

| 编号 | 标准 | 方式 |
| --- | --- | --- |
| AL-20 | `npm run check:ui5` 能从 `ui5.sap.com` 下载 1.154.0 的 `api.json` 并缓存；有未登记差异时退出码非 0；有自测（故意改错一个属性名、默认值、事件参数，脚本能报出来） | U |
| AL-21 | `npm run e2e:fe` 能启动 FE 对比应用（运行时取自 `ui5.sap.com/1.154.0`）和 smart-kit 示例页，对同一场景输出请求、结构和文本的差异；有自测（故意让 smart-kit 少一列，测试失败） | E |
| AL-22 | 仓库和发布的包里没有 SAP 的文件（`api.json`、sap.fe 源码、SAPUI5 运行时）；只有映射表、偏差表和报告 | Z、D |

## 5. 不留旧名和发布（D35）

| 编号 | 标准 | 方式 |
| --- | --- | --- |
| AL-30 | 改过名的组件、属性、子路径，旧的全部不存在（没有废弃别名、没有旧子路径、根入口不导出组件）；示例、Storybook、测试、文档都用新路径 | S、Z |
| AL-31 | `25-invoice-assure-issues.md` 的迁移清单完整：每个旧名、旧属性、旧路径对应的新写法，以及每项行为改动；`deviations.json` 只剩 `kit-extension`、`react-idiom`、`no-binding` 和用户确认保留的条目 | D、S |
| AL-32 | 每个阶段：`typecheck`、`lint`、`test`、`e2e`、`size`、`trace --strict`、`verify:pack`、`gen-agent-docs --check`、`check:ui5`、`e2e:fe` 全部通过 | 全部 |

## 附表：已生效的条目

每个阶段把它覆盖的条目（或细化后的编号，如 `AL-05-Table`）加到下表；`npm run trace -- --strict` 要求方式含 U、E、F 的每一行都有名字带该编号、并且通过的测试（F 读 `reports/e2e-fe-results.json`）。S 由 `npm run check:ui5` 检查（退出码 0 即通过），D 写核对人和日期。

| 条目 | 从阶段 | 方式 | 范围 / 测试 |
| --- | --- | --- | --- |
| AL-01 | 0 | S | `check:ui5` 的 `unmapped` / `duplicate-mapping` / `mapping-reason` 检查：全部公开导出（189 个）都在 `mapping.json` |
| AL-02 | 0 | S、U | `check:ui5` 的 `module-path` / `mapping-path`；`tests/unit/check-ui5-api.test.ts` 的前缀规则 |
| AL-20 | 0 | U | `tests/unit/check-ui5-api.test.ts`（故意改错属性名、默认值、事件参数） |
| AL-21 | 0 | F | `tests/e2e-fe/*.spec.ts`（三个场景；故意让 smart-kit 少一列） |
| AL-22 | 0 | U | `tests/unit/packaging.test.ts`（git 不跟踪 SAP 文件；包的 `files` 不含缓存） |
| AL-03 | 1 | S | `check:ui5` 的 `enum-value` / `extra-enum-value` / `enum-type`：`ui/core/library`、`m/library`、`suite/ui/commons/library` 和有自己模块的枚举 |
| AL-04 | 1 | S | `check:ui5`：阶段 1 的模块（`m/`、`f/`、`ui/`、`suite/`、`base/`）没有未登记的 `property` / `aggregation` / `association` |
| AL-05 | 1 | S、U | `check:ui5` 的 `default-value`；`packages/react/test/controls-*.test.tsx`、`cards.test.tsx` 里 `AL-05` 开头的测试 |
| AL-06 | 1 | S、U | `check:ui5` 的 `event` / `event-param` / `event-preventDefault`；`AL-06` 开头的测试 |
| AL-07 | 1 | S、U | `check:ui5` 的 `method` / `static-method`；`AL-07` 开头的测试 |
| AL-08 | 1 | S、D | 偏差表 `not-implemented` 752 → 441、`fe-behavior` 32 → 32；每条都有理由和计划阶段（核对：Claude，2026-11-17） |
| AL-09 | 1 | S | `check:ui5` 的 `settings-type` / `instance-type` / `event-type` |
| AL-30 | 1 | U、Z | `packages/react/test/api.test.ts`（`/controls`、`/messages`、`/cards` 不存在）；`verify:pack` |
| AL-04 | 2 | S | `check:ui5`：`v4/fe/macros/*`、`m/Table`、`f/*`、`uxap/*`、`m/GenericTag` 没有未登记的属性、聚合、关联；没有基线占位条目 |
| AL-05 | 2 | S、U | `packages/react/test/table-ui5.test.tsx`、`filterBar.test.tsx`、`field-form.test.tsx`、`page.test.tsx`、`ui5-chart-macros.test.tsx` 里 `AL-05` 开头的测试 |
| AL-06 | 2 | S、U | 同上，`AL-06` 开头（含 `Field` 的 change / liveChange 时机） |
| AL-07 | 2 | S、U | 同上，`AL-07` 开头 |
| AL-30 | 2 | U、Z | `api.test.ts`：旧子路径全部不存在，根入口只导出基础设施；`verify:pack` |
| AL-10 | 3、4 | F、U | `tests/e2e-fe/*.spec.ts` 的 37 个场景（请求一致或差异已登记）；`packages/core/test/al-*.test.ts`、`filter-defaults.test.ts` 里 `AL-10` 开头的测试 |
| AL-11 | 3、4 | F、U | 同上（筛选字段、列、动作、编辑状态、视图页签、图表）；`al-draft`、`al-aggr`、`al-totals`、`filter-vh-params` 里 `AL-11` 开头的测试 |
| AL-12 | 3、4 | F、D | 各场景前 5 行单元格文本；`29` 第 4 节 P1 八项和第 5 节 P2 全部有场景（新列类型和动作在阶段 4 收尾补场景）；`02` 按 FE 源码重写，每条写明 FE 模块（核对：Claude，2026-11-18） |
| AL-08 | 3 | S、D | `fe-behavior` 32 → 28（`fe:*` 每种原因一条），`not-implemented` 119（阶段 3 不涉及 API）（核对：Claude，2026-11-18） |

