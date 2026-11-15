# ADR-013 商标词检查

- **决定**：`npm run check:trademark`（`scripts/check-trademark.mjs`）检查以下位置是否出现独立的 `fiori`、`sap`、`sapui5`、`ui5`、`netweaver`：
  - 各包的包名；
  - `packages/*/src` 导出的标识符和组件名；
  - CSS 类名和变量名。

  "独立"按词边界判断：
  - 把驼峰、下划线、连字符拆成词，再整词比较；
  - 所以 `isApplicable`、`disappear` 不算。

  豁免：
  - 注解命名空间等协议标识符（`com.sap.vocabularies.*`）；
  - 第三方依赖的包名（`@sap-ux/*`）；
  - 注释和 Markdown 文档里的描述性引用。
- **状态**：采纳。
