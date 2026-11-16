# ADR-018 编辑策略：直接保存与草稿

- **背景**：v5 第 3.2 节要求编辑是可插拔的策略，草稿只是其中一种；一期在 `core` 定义了 `EditStrategy` / `EditSession` 接口，阶段 1.5 的 `spikes/edit-seam` 验证了直接保存。
- **决定**：
  - `core` 提供两个实现：`DirectEditStrategy`（PATCH + `If-Match`；新建用 POST）和 `DraftEditStrategy`（`Common.DraftRoot` 的 `EditAction`、`ActivationAction`、`DiscardAction`，草稿上的修改即时 PATCH 到 `IsActiveEntity=false` 的实例；新建 POST 到实体集得到草稿）。
  - `EditSession` 扩展为：`values`、`set`、`save`、`cancel`，加上 `path`（草稿时是草稿实例的路径）、`draft`（是否草稿）、`flush()`（草稿的后台保存）、`create`（新建会话）。
  - `editStrategyFor(model, entitySet, provider)` 按模型选择：实体集有 `DraftRoot` 就用草稿，否则用直接保存；`SmartKitProvider` 的服务配置可以传入自己的策略。
  - 数据提供者的写能力扩展为 `update`、`create`、`remove`、`invoke`（动作）。
  - 草稿服务的实体路径带 `IsActiveEntity`：`EntityPath` 的解析和生成识别这个键，导航和面包屑用活动版本的路径（`IsActiveEntity=true`）。
- **理由**：两种策略共用一个界面层（`useEditSession`），对象页、子表和新建对话框不关心底层是哪一种。
- **代价**：草稿实例和活动实例的路径不同，对象页在编辑时要切换读取的路径；一期"不识别草稿服务"的警告在二期去掉，改为模型标记 `draft`。
- **状态**：采纳。
