# ADR-019 草稿测试服务

- **背景**：二期要在测试服务上验证草稿。把现有的采购服务改成草稿会让主键变成 `(PurchaseOrder, IsActiveEntity)`，一期全部实体路径和端到端用例都要改。
- **决定**：
  - 新增 `/odata/purchasing-draft/`：启动时从同一份 `purchasing.template.xml` 派生，给 `PurchaseOrder`、`PurchaseOrderItem` 加上 `IsActiveEntity`（键）、`HasActiveEntity`、`HasDraftEntity`、`DraftAdministrativeData`，以及 `Common.DraftRoot`（`draftEdit`、`draftActivate`、`draftPrepare`、`draftDiscard`）和 `Common.DraftNode`。
  - 草稿的创建、激活、放弃交给 `@sap-ux/fe-mockserver-core` 的原生草稿（`DraftMockEntitySet`）；前置层只补本库需要的部分（语言、Capabilities 检查、Decimal 字符串化、`sap-messages`）。
  - 原来的 `/odata/purchasing/` 保持非草稿，用来测直接保存（PATCH + ETag）；它的写能力在二期扩展为新建、删除和绑定动作。
- **理由**：两种编辑策略在同一个业务对象上对照；一期用例不受影响；草稿用引擎的现成实现，不重复造轮子。
- **代价**：两个服务的数据各自独立；`POST /test/reset` 同时重置两者。
- **状态**：采纳。
