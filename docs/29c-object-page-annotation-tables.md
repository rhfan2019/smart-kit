# 29c 对象页注解对照表（附录，`29b`）

> 2026-11-18，阶段 6。每行：FE 1.154 的做法（模块）、smart-kit 改前、结论（改前）、优先级（P1 结果错、P2 缺失或不同、P3 少见）、现状。"现状"里的"已改"都由 `tests/e2e-fe/op6.spec.ts`（或注明的单元测试）核对；"登记"指 `tools/ui5-alignment/deviations.op6.json`。

## A. 区块与子区块

| 注解 / 记录 | FE 1.154 | smart-kit（改前） | 结论 | P | 现状 |
| --- | --- | --- | --- | --- | --- |
| `UI.Facets` 顶层记录 | 每个一个区块（ObjectPageConverter getSectionFromAnnotation） | 同 | 一致 | – | 一致 |
| 区块标题 | Facet 的 Label；无 Label 时 showTitle false | Label，否则第一个子区块的标题 | 部分一致 | P3 | 锚点仍用子区块标题（FE 锚点同样取子区块标题）；`showTitle` 进模型 |
| `CollectionFacet`（只含引用 Facet） | 一个子区块，表单，每个引用 Facet 一个容器（createSubSections） | 每个引用 Facet 一个子区块 | 不一致 | P1 | 已改（op6-draft-display、op6-contact） |
| `CollectionFacet`（含集合 Facet） | 每个子 Facet 一个子区块 | 子集合 Facet 合成表单 | 部分一致 | P1 | 已改（op6-contact：ContactLast、ContactSupplier） |
| 第三层集合 Facet | 表单里忽略（getFormContainersForCollection） | 展开 | 不一致 | P3 | 已改 |
| 集合 Facet 含表格和表单 | 一个 Mixed 子区块，表格在前（若第一个是表格） | 两个子区块 | 不一致 | P1 | 已改（op6-item：Pricing） |
| 引用 Facet → `LineItem` | 子表（DataVisualization） | 同 | 一致 | – | 一致 |
| 引用 Facet → `FieldGroup` / `Identification` | 表单，一个容器，无容器标题 | 同 | 一致 | – | 一致；动作记录不作表单元素（已改） |
| 引用 Facet → `DataPoint` | 表单元素（"DataPoint::q"，标签 = Title） | 页头 Facet 样式 | 不一致 | P2 | 已改（op6-contact：Score） |
| 引用 Facet → `Communication.Contact` | 表单元素（"Contact::q"） | 不支持 | 未实现 | P3 | 已做（FE 1.154 在 ColumnLayout 里报错 cellsLarge，无 FE 场景） |
| 引用 Facet → `Communication.Address` | 表单元素（地址文字） | 不支持 | 未实现 | P3 | 未做 |
| 引用 Facet → `UI.Chart` / `PresentationVariant` | 图表子区块 | 只在页头支持 | 未实现 | P3 | 未做（测试服务没有） |
| `UI.Note`、`ReferenceURLFacet` | Note 子区块；URL Facet 不支持 | 不支持 | – | P3 | 未做 |
| Facet 的 `UI.Hidden` 常量 | visible false | 同 | 一致 | – | 一致 |
| Facet 的 `UI.Hidden` 路径 | 按对象求值，并 $select | 不读 | 未实现 | P2 | 已改（op6-contact-blocked；路径进 $select） |
| 引用 Facet 的 `UI.PartOfPreview` false | 子区块在"显示更多"后 | 同 | 一致 | – | 一致 |
| 集合里引用 Facet 的 `PartOfPreview` false | 该容器在 moreBlocks | 整个子区块（因为原来每个 Facet 一个子区块） | 部分一致 | P2 | 已改（op6-contact：Bank Details） |
| 字段的 `UI.PartOfPreview` false | "显示详细信息"后（ShowHideDetails） | 不读 | 未实现 | P2 | 已改（op6-contact：Mobile；单元测试） |
| 编辑态的"显示更多" | 不自动展开 | 编辑时全部展开 | 不一致 | P3 | 已改（按 FE） |
| 可编辑页头区块 | 一个子区块：标题、描述、页头 Facet 的全部字段（含只读和数据点，不含图表） | 只列可编辑的标题、描述、FieldGroup 字段 | 部分一致 | P2 | 已改（op6-draft-edit） |
| `useSingleTextAreaFieldAsNotes` | 单个多行字段的容器不显示标签 | 不读 | 未实现 | P2 | 已改 |

## B. 页头

| 注解 | FE 1.154 | smart-kit（改前） | 结论 | P | 现状 |
| --- | --- | --- | --- | --- | --- |
| `HeaderInfo/Title`、`Description` | 标题、副标题 | 同 | 一致 | – | 一致 |
| `HeaderInfo/ImageUrl`、`Initials` | 头像、首字母 | 同 | 一致 | – | 一致 |
| `HeaderInfo/TypeImageUrl` | 无图片时的类型图标 | 不读 | 未实现 | P3 | 未做 |
| `HeaderFacets` → FieldGroup / DataPoint / Chart | 表单、KPI / 评分 / 进度、微图表 | 同 | 一致 | – | 一致（微图表文字由 macros6 组对照） |
| `HeaderFacets` → `CollectionFacet` | 一个容器里的多个引用 Facet | 不支持 | 未实现 | P2 | 已改（op6-contact：HeaderPerformance） |
| `HeaderFacets` → Contact | 联系人 Facet（ObjectPageHeaderContact） | 不支持 | 未实现 | P2 | 已改（op6-contact：HeaderContact） |
| `HeaderFacets` → Address | 地址 Facet | 不支持 | 未实现 | P3 | 未做 |
| 页头 Facet 的 `UI.Hidden` | 常量不显示，路径按对象 | 只认常量 | 部分一致 | P2 | 已改 |
| 页头评分的 `SampleSize` 是导航路径 | 解析失败（"Unsupported"），不 $select | 显示人数并 $select | 不一致 | P3 | 登记 different-value（不照抄 FE 缺陷） |

## C. 动作

| 注解 | FE 1.154 | smart-kit（改前） | 结论 | P | 现状 |
| --- | --- | --- | --- | --- | --- |
| `Identification` 的确定性动作 | 页脚，显示态也显示，不可用置灰 | 只显示可用的，且只在显示态 | 不一致 | P1 | 已改（op6-*、op5-*；DV-op5-185…189 过时） |
| 非确定性注解动作 | 页头，两种模式都显示，不可用置灰 | 只显示可用的，编辑时去掉 | 不一致 | P1 | 已改（op6-display：Close [disabled]；DV-op5-190、191 过时） |
| 绑定动作 OperationAvailable 静态 false | 不显示 | 不显示 | 一致 | – | 一致 |
| 动作记录的 `UI.Hidden` 路径 | 按对象隐藏 | 不读 | 未实现 | P2 | 已改（路径进 $select） |
| 重要 Criticality 的动作在前 | 页头、页脚都排在前面 | 按注解顺序 | 不一致 | P2 | 已改（单元测试） |
| `UI.Emphasized` | 无 Criticality 时强调 | 不读 | 未实现 | P3 | 已改 |
| `UI.IsCopyAction` | 页头"复制"（第一层） | 普通动作 | 部分一致 | P3 | 已改（按位置） |
| `DataFieldForActionGroup` 在 Identification | 菜单按钮 | 平铺 | 部分一致 | P3 | 未做 |
| `DataFieldForIntentBasedNavigation` 在 Identification | 页头按钮（需要启动台） | 忽略 | – | P3 | D42：不依赖启动台 |
| 编辑按钮 | 草稿根 / 粘性会话；显示态；`UpdateHidden`；有自己的草稿时没有 | 可更新且能写时都有 | 部分一致 | P2 | 已改 UpdateHidden、自己的草稿；非草稿保留编辑（登记 kit-extension，ADR-018，D42） |
| 删除按钮 | 显示态（子对象页编辑态）；`DeleteHidden`；Deletable 路径置灰；被他人锁定置灰 | 显示态，只看常量 | 部分一致 | P2 | 已改 |
| 保存、取消 | 编辑态；取消在最后 | 同 | 一致 | – | 一致 |
| 子对象页的"应用" | 页脚 | 无（子对象在根的草稿里直接改） | 未实现 | P3 | 未做 |
| 草稿切换（DraftToggle） | 编辑态"草稿"菜单；已保存版本上"保存的版本" | 无 | 未实现 | P2 | 已改（op6-draft-edit） |
| `Common.SideEffects` | 字段改后按目标重读、触发动作 | 不读（草稿后台保存后不重读） | 未实现 | P2 | 未做，长期：需要编辑会话按 SideEffects 的 SourceProperties / TargetProperties 分组 PATCH 后重读目标（core state/edit 和 data provider），测试服务没有 SideEffects |
| 协作草稿（`DraftRoot/ShareAction`） | 头像、邀请 | 无 | 未实现 | P3 | 未做 |

## D. 字段与编辑态

| 注解 | FE 1.154 | smart-kit（改前） | 结论 | P | 现状 |
| --- | --- | --- | --- | --- | --- |
| `Core.Computed` | 不可编辑 | 同 | 一致 | – | 一致 |
| `Core.Immutable`、键 | 只在新建时可编辑 | 同 | 一致 | – | 一致（op6-draft-edit：Company Code） |
| `Common.FieldControl` 常量 | ReadOnly、Inapplicable（禁用）、Mandatory | ReadOnly、Mandatory；Inapplicable 不读；Hidden 当隐藏（FE 当禁用） | 部分一致 | P2 | 已改 Inapplicable（禁用）；Hidden（已废弃）仍隐藏 |
| `Common.FieldControl` 路径 | 按对象求值（0 / 1 / 3 / 7） | 不读 | 未实现 | P2 | 已改（`edit/fieldControl.ts`，单元测试；测试服务没有路径型 FieldControl） |
| `UI.Hidden` 路径（字段） | 按对象隐藏 | 不读 | 未实现 | P2 | 已改 |
| `Common.ValueListWithFixedValues` | 下拉，文字按 TextArrangement | 下拉，固定"文字 (代码)" | 部分一致 | P2 | 已改（op6-draft-edit：Status 只显示文字） |
| `Common.ValueList`（非固定） | 带建议的输入框，显示"文字 (代码)"，值帮助对话框 | 普通输入框 | 未实现 | P2 | 已改输入框和建议（op6-draft-edit：Supplier）；单选值帮助对话框未做（长期，需把筛选栏的对话框做成单选模式） |
| `Common.ValueListReferences`（编辑态） | 加载值帮助服务 | 不加载 | 未实现 | P2 | 已改（`useValueListsOfType`；无 FE 编辑场景，DV-vhref-001 可删） |
| `Common.ValueListRelevantQualifiers`（引用） | 按行求限定符 | 全部列出 | 部分一致 | P3 | 登记 DV-op6-205 |
| `Edm.Date` 编辑 | 中等日期样式 | ISO | 不一致 | P2 | 已改（op6-draft-edit：Order Date） |
| `UI.Placeholder` | 占位文字 | 不读 | 未实现 | P2 | 已改 |
| `UI.MultiLineText` | 多行输入 | 同 | 一致 | – | 一致 |
| `Common.Text` + `TextArrangement` | 显示态按排列 | 同 | 一致 | – | 一致（op6 文字） |
| `Measures.ISOCurrency` / `Unit` | 值和单位 | 同 | 一致 | – | 一致 |
| `Common.IsUpperCase` | 不读（D41） | 不读 | 一致 | – | 一致 |
| `UI.ConnectedFields`、`DataFieldWithUrl` 在表单 | 一行 / 链接 | 同（阶段 4） | 一致 | – | 一致 |
| `Common.SemanticKey` | 子表的键列加粗、草稿标记 | 同 | 一致 | – | 一致 |
| 代码表（`Common.CurrencyCodes` 等） | 按代码表小数位 | Intl | 未实现 | P2 | 登记 DV-op6-201（长期） |
| `Edm.Stream` 编辑 / 图标 | 上传、图标 | 只有下载链接 | 部分一致 | P3 | 登记 DV-op6-203 |
| 联系人弹出框的全部电话 / 邮件 / 地址 | 全部列出 | 第一条 | 部分一致 | P3 | 登记 DV-op6-204 |

## E. 请求和草稿

| 项 | FE 1.154 | smart-kit（改前） | 结论 | P | 现状 |
| --- | --- | --- | --- | --- | --- |
| ETag 属性 | 不选，用 `@odata.etag` | 选（Version） | 不一致 | P2 | 已改（DV-FE-02 过时） |
| `DraftAdministrativeData` | DraftIsCreatedByMe、DraftUUID、InProcessByUser | 再加 3 个 | 部分一致 | P2 | 已改（其余在草稿指示器弹出时读） |
| 页签条数 | 无（也不请求 `$count`） | 每个表格页签显示条数并请求 | 不一致 | P2 | 已改（按 FE，D44） |
| 懒加载子区块的请求 | 屏幕外子区块出现时另发请求 | 一个请求读完（Q-08） | 不一致 | P3 | 登记 different-value（长期） |
| 页头微图表的集合导航 | `$expand` | 单独查询（ADR-025） | 不一致 | P3 | 登记 different-value（长期） |
| 参数化结果行的对象页 | `P(…)/Set(key)` | 不支持 | 未实现 | P3 | 登记 DV-op6-206 |
| 打开草稿、从草稿回到保存的版本 | editFlow toggleDraftActive | 只有打开草稿继续编辑 | 部分一致 | P2 | 已改（草稿切换） |
