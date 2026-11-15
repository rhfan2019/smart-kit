# ADR-023 消息模型

- **背景**：[LR] 和 [OP] 都要求页脚工具栏在有消息时显示消息按钮，点开消息弹窗；编辑模式下用消息弹窗汇总表单校验。OData 标准里只有错误响应的 `error.details`；SAP 后端还会在成功的响应里带 `sap-messages` 头（警告、信息）。
- **决定**：
  - `core` 定义 `Message`（`type`：error / warning / info / success，`message`、`target`、`code`），`messagesFromError` 和 `messagesFromHeader` 两个解析函数。
  - `react` 提供 `MessageProvider`（页面级的消息集合）、`MessageButton`（页脚，按最严重的类型显示图标和数量）和 `MessagePopover`（按类型分组；有 `target` 的消息点击后定位到字段）。
  - 客户端校验（必填、类型、长度）也产生带 `target` 的消息。
- **理由**：一个模型覆盖服务端和客户端的消息；不依赖 SAP 特有的头，但能读取它。
- **代价**：`sap-messages` 不是 OData 标准；没有这个头的服务只有错误消息和客户端消息。
- **状态**：采纳。
