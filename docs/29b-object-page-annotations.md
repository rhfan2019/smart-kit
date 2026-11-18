# 29b 对象页的注解：和 Fiori elements 1.154 逐条对照

> 状态：阶段 6 第 1 项（`31`），2026-11-18。方法同 `29`（D33）：先读 sap.fe 1.154 的源码，写出 FE 的做法，再看 smart-kit 的代码，P1、P2 改到一致并用真 FE 核对（`tests/e2e-fe/op6.spec.ts`，7 个场景，加上 `op5.spec.ts` 的 5 个）。逐行对照表见 `29c-object-page-annotation-tables.md`。FE 源码在 `.cache/ui5/1.154.0/src/`（不提交）。

## 1. FE 的模块

| 部分 | FE 1.154 模块 | smart-kit |
| --- | --- | --- |
| 页面结构（区块、页头、动作、可编辑页头区块） | `sap/fe/core/converters/templates/ObjectPageConverter`、`templates/ObjectPage/ObjectPage.view.xml`、`view/fragments/Actions`、`Heading`、`SectionContent`、`HeaderFacet` | `packages/react/src/templates/ObjectPage.tsx` |
| 区块和子区块 | `converters/controls/ObjectPage/SubSection`（`createSubSections`、`createCollectionFacetSubSection`、`createReferenceFacetSubSection`） | `packages/core/src/model/buildModel.ts`（`buildSections`、`buildSubSection`、`contentForReference`） |
| 页头 Facet | `converters/controls/ObjectPage/HeaderFacet` | `buildHeaderFacet`；`packages/react/src/object/HeaderFacet.tsx` |
| 表单 | `converters/controls/Common/Form`（`getFormContainer`、`createFormDefinition`、`isFieldPartOfPreview`）、`macros/Form`、`FormElement` | `packages/react/src/object/Form.tsx`（`v4/fe/macros/Form`） |
| 页头、页脚动作 | `converters/objectPage/HeaderAndFooterAction`（`getHeaderDefaultActions`、`getFooterDefaultActions`）、`controls/Common/Action`（`getEnabledForAnnotationAction`）、`macros/FooterContent` | `ObjectPage.tsx`（`headerActions`、`footerItems`） |
| 草稿 | `templates/ObjectPage/components/DraftToggle`、`macros/draftIndicator`、`controllerextensions/editFlow`、`helpers/BindingHelper`（`Draft.HasNoDraftForCurrentUser`） | `ObjectPage.tsx`（草稿切换、`showSavedVersion`）、`object/DraftIndicator.tsx`、`core/src/state/edit.ts` |
| 字段的编辑状态 | `core/templating/UIFormatters`（`getEditableExpression`、`getEditMode`、`getRequiredExpression`）、`FieldControlHelper` | `packages/react/src/edit/fieldControl.ts`；`field/Field.tsx`、`field/FieldEditor.tsx` |
| 值帮助（编辑态） | `macros/internal/valuehelp`、`macros/ValueHelp` | `field/FieldEditor.tsx`（`ValueHelpInput`、`FixedValues`）；`filter/useValueList.ts`（`useValueListsOfType`） |
| 对象请求 | OData V4 模型的 autoExpandSelect（绑定到页面上的属性） | `core/src/query/request.ts`（`buildObjectRequest`、`objectFields`） |

## 2. 区块和子区块（SubSection、ObjectPageConverter）

- **每个 `UI.Facets` 记录是一个区块**（`getSectionFromAnnotation`），标题是 Facet 的 `Label`，没有 `Label` 时 `showTitle` 为 false。
- **子区块**（`createSubSections`）：引用 Facet 是一个子区块；集合 Facet 里**有**集合 Facet 时，每个子 Facet 一个子区块；**没有**时，集合 Facet 自己就是**一个**子区块——一个表单，每个引用 Facet 一个表单容器（`createFormDefinition`、`getFormContainersForCollection`，第三层的集合 Facet 被忽略）。smart-kit 原来每个引用 Facet 一个子区块（P1，已改）。
- **混合子区块**（`createCollectionFacetSubSection`）：集合 Facet 同时引用表格（LineItem、Chart、PresentationVariant 等）和表单时，是一个 `Mixed` 子区块，第一个 Facet 是表格时表格在前，否则表单在前。smart-kit 新增模型 `{ kind: 'mixed', parts }`（P1，已改；`op6-item` 核对）。
- **数据点、联系人在区块里是表单元素**（`createReferenceFacetSubSection`：FieldGroup、Identification、DataPoint、StatusInfo、Contact、Address 都是表单）；smart-kit 原来把区块里的数据点画成页头 Facet 的样子（P2，已改）。
- **`UI.Hidden`**：常量 true 的区块 / 子区块 / 容器不显示；路径按对象求值（`singletonPathVisitor`）。smart-kit 原来只认常量（P2，已改；`op6-contact-blocked` 核对 `_Supplier/IsBlocked`）。
- **`UI.PartOfPreview`**：引用 Facet 为 false → 整个子区块在"显示更多"后面；集合 Facet 里的引用 Facet 为 false → 那个**容器**在"显示更多"后面（`hasFacetsNotPartOfPreview`、`SectionContent` 的 `moreBlocks`）；**字段**为 false → 容器的"显示详细信息"按钮后面（`isFieldPartOfPreview`、`ShowHideDetails`）。smart-kit 原来只有子区块级（P2，已改；编辑态也不再自动展开，按 FE）。
- **可编辑的页头区块**（`createEditableHeaderSection`）：编辑态最前面的"页头"区块，**一个**子区块，含 HeaderInfo 的标题和描述，以及页头 Facet 的全部字段（可编辑的和只读的都列出，数据点也列出，微图表不列）和自定义页头 Facet 的 `templateEdit`。smart-kit 原来只列可编辑的字段（P2，已改）。
- 不支持的：`ReferenceURLFacet`（FE 也不支持）、区块里的 `UI.Chart`（P3，测试服务没有）、`Communication.Address`（P3；FE 1.154 的 ColumnLayout 在表单里放 Contact 时报错 "cellsLarge"，测试服务里因此不用）、`UI.Note`。

## 3. 页头（HeaderInfo、HeaderFacets）

- `UI.HeaderInfo`：`Title`、`Description`、`ImageUrl`、`TypeImageUrl`、`Initials`、`TypeName`。smart-kit 一致（阶段 2、5 已做）；`TypeImageUrl` 未用（P3）。
- `UI.HeaderFacets`（`HeaderFacet`）：引用 Facet 指向 FieldGroup（表单）、DataPoint（按 `Visualization` 显示）、Chart（微图表）、Identification、Contact、Address；集合 Facet 是一个容器里的多个引用 Facet（`createCollectionHeaderFacet`）。`UI.Hidden` 常量 true 不显示，路径按对象求值。smart-kit 新增联系人 Facet、集合 Facet、隐藏路径（P2，已改；`op6-contact` 核对）。地址 Facet 未做（P3）。

## 4. 动作（HeaderAndFooterAction、Actions 片段、FooterContent）

- **页头的顺序**：草稿切换（DraftActions）、协作头像、有重要 Criticality（VeryPositive、Positive、Negative、VeryNegative 常量）的注解动作、编辑、删除、复制（`UI.IsCopyAction`，只在第一层）、意图导航、其余注解动作；自定义动作按 `position` 插入；分享在最后。
- **注解动作**（`UI.Identification` 的 `DataFieldForAction`）：`Determining` 的在页脚，其余在页头；**显示态和编辑态都显示**（`isVisible` 只看 `UI.Hidden`）；`Core.OperationAvailable` 为 false 时**置灰**（`getEnabledForAnnotationAction`），绑定动作的 OperationAvailable 静态为 false 时不显示。smart-kit 原来隐藏不可用的动作、编辑时去掉页头注解动作（P1，已改；`fe:op5-*-edit`、`op6-*` 核对）。
- **编辑**：只在显示态；`UI.UpdateHidden`（常量或路径）为 true 时没有；草稿根上用户自己有草稿时没有（`Draft.HasNoDraftForCurrentUser`）。FE 1.154 只在草稿根或粘性会话时有编辑；smart-kit 非草稿也保留（直接保存，ADR-018，按 D42 的用户决定登记为 `kit-extension`）。
- **删除**：对象页在显示态、子对象页在编辑态；`UI.DeleteHidden`（常量或路径）为 true 时没有；`DeleteRestrictions/Deletable` 为路径时按对象置灰；草稿被其他用户处理（`InProcessByUser`）时置灰（P2，已改）。
- **页脚**（`getFooterDefaultActions`）：重要的确定性动作、保存、子对象页的应用（smart-kit 无，P3）、其余确定性动作、取消（`Placement.End`）。确定性动作在显示态也显示、不可用时置灰；保存和取消只在编辑态（P1，已改）。
- **草稿切换**（`DraftToggle`）：编辑草稿时页头有"草稿"菜单（"草稿" / "保存的版本"），在已保存版本上（用户自己有草稿）显示"保存的版本"；新建时没有。smart-kit 新增（P2，已改；切到保存的版本时草稿保留，用"草稿"或"编辑"回到草稿）。
- `Common.SideEffects`：smart-kit 未做（P2，长期；需要按 SideEffects 的目标在保存草稿字段后重读，属于编辑会话，登记在 `29c`）。
- 协作草稿（`DraftRoot/ShareAction`）：未做（P3，测试服务没有）。

## 5. 字段（表单、编辑态）

- **可编辑**（`getEditableExpression`）：`Core.Computed` 不可编辑；键和 `Core.Immutable` 只在新建时可编辑；`Common.FieldControl` 为 ReadOnly（1）不可编辑，Inapplicable（0）显示为禁用的输入框，Mandatory（7）必填——**常量和路径都按对象求值**。smart-kit 原来只认常量（P2，已改：`edit/fieldControl.ts`，表单、字段和校验都用它）。
- **`UI.Hidden` 路径**：记录或属性上的路径按对象隐藏字段（P2，已改）。
- **值帮助**：`ValueListWithFixedValues` 是下拉；其他 `Common.ValueList`（以及 `Common.ValueListReferences` 引用的值帮助服务）是带建议的输入框，显示"文字 (代码)"（按 `TextArrangement`）。smart-kit 原来非固定值列表是普通输入框、引用的值帮助在编辑态不加载（P2，已改；`fe:vhref-edit`）。值帮助对话框（编辑态的单选对话框）未做（P2 剩余，登记）。
- **日期**：编辑框按中等日期样式显示（"Oct 2, 2026"），smart-kit 原来显示 ISO（P2，已改）。
- `UI.Placeholder`：输入框的占位文字（P2，已改）。`UI.MultiLineText`：多行（一致）。`Common.IsUpperCase`：FE 不读（D41）。`Common.Text` / `TextArrangement`、`Measures.ISOCurrency` / `Unit`：显示态一致（`op6` 文字核对）。`UI.ConnectedFields`、`DataFieldWithUrl`：表单里一致（阶段 4 的 Field）。

## 6. 请求

- FE 的对象请求由页面绑定的属性决定（autoExpandSelect）：键、标题和描述、表单字段及其文字和单位、OperationAvailable 和 `UI.Hidden` 的路径、草稿的 `IsActiveEntity`、`HasActiveEntity`、`HasDraftEntity` 和 `DraftAdministrativeData(DraftIsCreatedByMe, DraftUUID, InProcessByUser)`；**不选 ETag 属性**（用 `@odata.etag`）。smart-kit 原来选 ETag 属性（DV-FE-02）和草稿管理数据的全部字段（P2，已改：草稿指示器在弹出时再读）。
- 子区块的表格单独请求；Tabs 布局的页签**不显示条数**、也不为条数发请求（smart-kit 原来按设计指南显示，P2，已改为 FE）。
- 不同、长期保留的（登记）：FE 对屏幕外的懒加载子区块另发请求，smart-kit 一个请求读完（Q-08）；页头评分的 `SampleSize` 是导航路径时 FE 1.154 解析失败、不选，smart-kit 选并显示人数；页头微图表的集合导航 FE 放进 `$expand`，smart-kit 按 ADR-025 单独查询。

## 7. manifest 设置（阶段 6 的 `manifest-missing`）

本阶段实现：子表的 `tableSettings › rowPress`、`selectionChange`；区块的 `useSingleTextAreaFieldAsNotes`。其余 139 条按原因改登记为长期（`deviations.op6.json` 的 DV-op6-101…）：子表的设置要表格积木先支持（macros6）、路由设置（smart-kit 无路由，D42）、键盘命令（UI5 CommandExecution）、溢出分组（OverflowToolbar 的分组）、严格处理、内联编辑等。`variantManagement`（`None` / `Control`）声明了但对象页还没有可传的表格级变式（DV-table-005，macros6）。
