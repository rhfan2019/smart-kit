# ADR-024 动作

- **背景**：[LR] Actions 图的三个位置（页头工具栏、表工具栏、行内）和 [OP] 的页头动作、页脚动作都来自注解：`UI.DataFieldForAction`（`LineItem` 里是表动作，`Inline=true` 是行内动作；`Identification` 里是对象页动作，`Determining=true` 进页脚）。
- **决定**：
  - 模型：`ui.actions`（来自 `LineItem` 和 `Identification`），每个动作有 `id`、`label`、`action`（限定名）、`bound`、`inline`、`determining`、`criticality`、`operationAvailable`（`Core.OperationAvailable` 的常量或路径，路径形如 `_it/Prop`，按所选行求值）。
  - 数据层：`invoke(action, { path?, parameters })`，绑定动作按 `实体路径/命名空间.动作` POST。
  - 可用性：表动作需要选中；`operationAvailable` 对所选项全部为 false 时禁用；部分为 false 时执行前弹出部分处理对话框；行内动作在不可用时隐藏。
  - 执行后刷新表格或对象，读取 `sap-messages` 显示成功和警告。
- **理由**：与 Fiori Elements 的注解写法一致，使用者不需要写代码就能得到动作；也可以继续用一期的扩展点插入自定义动作。
- **代价**：动作参数对话框只支持基本类型参数。
- **状态**：采纳。
