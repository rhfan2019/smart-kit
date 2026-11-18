# ADR-032 通用控件的名字、属性、事件和方法沿用 SAPUI5

- **背景**：用户要参照 SAP Fiori 的 UI Elements 补一批通用控件（`26-ui-elements-plan.md`），并要求"组件的命名和它们的方法和 UI5 保持一致，避免切换成本"（D31）。D20 已经让卡片用了 SAPUI5 的名字，但只约定了控件名和属性名。
- **决定**：`26` 第 2 节的八条规则。要点：控件名、属性名、默认值、枚举值（首字母大写的字符串）和 SAPUI5 相同；有外观的聚合用 JSX 子元素（UI5 的 `key` 就是 React 的 `key`），纯数据的聚合用同名数组属性；事件是 `on` + 事件名，参数是同名字段的对象；静态方法是同名静态函数，实例方法通过 `ref` 调用；不提供 `get*` / `set*` 和数据绑定。`MessageToast`、`MessageBox` 由 `SmartKitProvider` 里的 `MessageHost` 承载。
- **核实**：API 以 SAPUI5 1.154.0 的 `api.json` 为准（`26a-ui5-api-1.154.md`），每个控件实现其中列出的全部公开、未废弃 API，不做的逐条写在 `26` 第 3 节。UI5 的图标属性（`sap.ui.core.URI`，指向 SAP 图标字体）改为接收 React 元素。
- **理由**：UI5 开发者看 UI5 的 API 参考就能用；ref 方法是 React 里最接近 UI5 实例方法的写法；枚举用 UI5 的值，`ValueState.Error` 这种写法也照样能用。
- **代价**：和 React / Mantine 的常见写法不同（`onPress` 而不是 `onClick`，`'Error'` 而不是 `'error'`）；core 的 `Message.type` 是小写，要用 `messageTypeOf()` 转换。名字可能让人以为与 SAP 有关，README 的声明照旧适用；`check-trademark` 不受影响（名字里没有商标词）。
- **状态**：采纳。
