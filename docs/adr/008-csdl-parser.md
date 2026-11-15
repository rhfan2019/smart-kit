# ADR-008 CSDL 与注解解析用 `@sap-ux/*`

- **背景**：v5 第 3.3 节只排除专有许可的 SAP 包，开源许可的可以用。
- **决定**：
  - `@sap-ux/edmx-parser` 0.10.0（Apache-2.0，依赖 `xml-js`，不依赖 DOM）：解析 CSDL XML、合并多份文件。
  - `@sap-ux/annotation-converter` 0.10.23（Apache-2.0，依赖 `@sap-ux/vocabularies-types`）：别名展开、注解解析成类型化对象、路径解析。
  - 自己写 `csdlJsonToXml()`，因为这两个包只读 XML。
- **核实**（2026-11-14，在临时目录安装并运行）：
  - 两个包都在 npm 上，许可是 Apache-2.0，与 MIT 兼容。
  - `merge(服务, 覆盖层)` 后再 `convert()`，覆盖层里的同一术语整条替换服务里的；不同文件可以用不同别名。
  - 都不支持 CSDL JSON。
- **代价**：
  - 依赖上游的发布节奏。
  - 转换器的输出形状变化会影响 `buildModel`，所以锁定精确版本，并用测试 ANN-70–72 固定行为。
  - 遇到不支持的表达式时，上游会 `console.error`，`buildModel` 把它记成模型警告。
- **状态**：采纳。
