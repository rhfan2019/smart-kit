# 03 积木清单

> 状态：现行 · 2026-11-14。每个积木写明：
> - 职责（做什么、不做什么）
> - 输入（主要 props）、输出事件
> - 参考控件（只作对照，不复制代码）
> - 骨架锁定的部分、开放的部分
>
> 扩展点的完整清单见 `06-extension-and-theming.md`。
> 所有积木都必须放在 `SmartKitProvider` 之下。

## 0. 共同约定

- **`entitySet`**：指定积木绑定的实体集（列表）或实体路径（对象页），从模型取元数据。
- **id 寻址**：由模型生成的子项都有稳定的 id，规则见 `04-model-spec.md` 第 6 节：
  - 列：`DataField::Price`
  - 区块：`GeneralInformation`（Facet 的 `ID`，没有时由标签生成）
  - 筛选字段：属性路径
- **`extend` 属性**：数组，每项是 `{ id, position, render }`，`position` 可以是：
  - `'before' | 'after'` 加锚点 id
  - `'replace'`
  - `'start' | 'end'`
- **受控与非受控**：状态类的 props 都成对出现，如 `filters` + `onFiltersChange`，和 `defaultFilters`。只传默认值就是非受控。
- **复合部件**：`Xxx.Part` 写出来就覆盖默认渲染；不写就自动渲染。

## 1. 基础与上下文

| 积木 | 职责 | 不做 | 输入 | 参考 |
| --- | --- | --- | --- | --- |
| `SmartKitProvider` | 注入服务（模型 + 数据提供者）、语言和文案、导航适配器、页面状态存储、变体存储、渲染器注册表、TanStack Query 客户端（可选，用使用者自己的） | 不处理登录；不碰路由 | `services: { [name]: { model, dataProvider } }`、`defaultService`、`locale: 'zh' \| 'en'`、`messages?`、`navigation`、`pageState?`、`variants?`、`renderers?`、`queryClient?` | SAPUI5 Component + ODataModel |
| `loadService()`（core） | 拉取 `$metadata` 和注解文件，解析、合并、推导，得到 `MetaModel` | 不缓存到磁盘 | `{ url, fetch, annotationFiles?, overlay?, language }` | ODataMetaModel |
| `useMetaModel(entitySet)` | 取实体集、实体类型和解析后的 UI 描述 | — | — | ODataMetaModel |
| `useText()` | 库文案（带参数和复数） | 不翻译服务端标签 | — | i18n ResourceModel |

## 2. 页面布局

| 积木 | 职责 | 不做 | 输入 / 事件 | 锁定 | 开放 | 参考 |
| --- | --- | --- | --- | --- | --- | --- |
| `DynamicPage`（含 `.Title`、`.Header`、`.Content`、`.Footer`） | 页头标题区、可折叠的页头内容、内容区；展开、折叠、固定；snap on scroll（可关）；折叠时在标题区显示摘要插槽 | 不知道筛选和数据 | `headerExpanded` / `defaultHeaderExpanded` / `onHeaderExpandedChange`、`headerPinned`、`snapOnScroll`、`showFilterToggle`（显示"显示筛选 / 隐藏筛选"） | 标题区左右分区（标题和变体在左、动作在右）、页头功能按钮的位置、折叠时摘要的位置 | 各区内容 | sap.f.DynamicPage |

## 3. 列表页

| 积木 | 职责 | 不做 | 输入 / 事件 | 锁定 | 开放 | 参考 |
| --- | --- | --- | --- | --- | --- | --- |
| `SmartFilterBar`（含 `.Search`、`.Fields`、`.Actions`） | 从 `SelectionFields` 生成筛选字段；搜索框；"执行"；适配筛选；必填校验；即时和手动两种模式；为空的必填字段报错 | 不发查询（只产出条件） | `entitySet`、`filters` / `defaultFilters` / `onFiltersChange`、`search`、`liveMode`、`onGo`、`fields?`（显式字段 id）、`extend?` | 搜索框第一个且无标签；"执行"和"适配筛选 (n)"靠右，"执行"在前 | 字段的增加、替换、顺序；"执行"旁的自定义按钮 | sap.ui.comp.smartfilterbar.SmartFilterBar |
| `ConditionInput` | 单个字段的条件编辑：令牌、范围、日期范围、文本包含、固定值下拉；联想 | — | `property`、`conditions`、`onChange` | — | 可整体替换 | sap.ui.mdc.field.FieldBase / MultiInput |
| `ValueHelpDialog` | 搜索选择（值列表）和定义条件（包含 / 排除）两个页签 | 不发主查询 | `property`、`conditions`、`onOk`、`onCancel` | 两个页签的结构 | 列表列来自 ValueList | sap.ui.mdc.valuehelp.Dialog |
| `SmartVariantManagement` | 变体选择、另存为、保存、管理（改名、删除、设默认、自动执行）；"已修改"标记 | 不知道变体内容的结构（交给页面状态） | `pageKey`、`currentContent`、`onApply(content)`、`dirty` | 弹层布局 | — | sap.ui.comp.smartvariants.SmartVariantManagement |
| `FilterSummary` | 页头折叠时的筛选摘要文字（0、1、n 个，最多 5 个，超出加省略号） | — | `filters`、`entitySet` | 文案规则 | — | DynamicPage 的 snappedContent |
| `SmartTable`（含 `.Toolbar`、`.Title`、`.Actions`、`.Settings`、`.Export`、`.Columns`） | 从 `LineItem` 生成列；网格表格（自带滚动、虚拟化、按块服务端加载）或自动高度（"更多"按钮）；服务端排序；多选；行导航指示器；个性化；导出；无数据文案；错误消息条 | 不负责筛选界面；不做行内编辑（二期） | `entitySet` 或 `parent`（父对象上下文 + 导航）、`query`（来自 `useListQuery`）、`columns` / `onColumnsChange`、`sort` / `onSortChange`、`selection` / `onSelectionChange`、`mode: 'grid' \| 'auto'`、`growingThreshold`、`onRowNavigate`、`extend?` | 工具栏分区：左侧标题和条数，右侧动作 → 设置 → 导出；动作溢出时从右往左收进"更多" | 列、动作的增加和替换；工具栏整体替换；单元格渲染器 | sap.ui.comp.smarttable.SmartTable / sap.ui.mdc.Table |
| `TableP13nDialog` | 列的显隐和顺序、排序 | 分组（二期） | `columns`、`sort`、`onOk` | 页签结构 | — | sap.m.p13n.Popup |
| `SmartListReport` | **整页模板示例**：`DynamicPage` + `SmartVariantManagement` + `SmartFilterBar` + `SmartTable`，只用公开导出 | 没有任何内部接口 | `entitySet`、`pageKey`、`onNavigate` 及上面各积木的透传 | — | 全部（用积木重写即可） | sap.fe.templates.ListReport |

## 4. 字段与表单

| 积木 | 职责 | 不做 | 输入 / 事件 | 锁定 | 开放 | 参考 |
| --- | --- | --- | --- | --- | --- | --- |
| `SmartField` | 按属性类型和注解显示值：文本排列、金额加币种、数量加单位、日期时间、布尔、状态（语义色加图标）、链接、图片、评分、进度；`mode: 'edit'` 时渲染对应的输入控件（一期只为编辑接缝提供，不保存） | 不发请求 | `entitySet` 或 `property`、`row`、`path`、`mode`、`value` / `onChange`（编辑） | — | 渲染器注册表按类型替换 | sap.ui.comp.smartfield.SmartField |
| `SmartForm` | FieldGroup 或 Identification 生成的表单；标签在上；按宽度 1 / 3 / 4 / 6 列；"显示更多" | 不保存 | `entitySet`、`row`、`fieldGroups`（Facet 目标）、`mode`、`extend?` | 标签在上、列数规则 | 字段的增加和替换 | sap.ui.comp.smartform.SmartForm |

## 5. 对象页

| 积木 | 职责 | 不做 | 输入 / 事件 | 锁定 | 开放 | 参考 |
| --- | --- | --- | --- | --- | --- | --- |
| `ObjectPageLayout`（含 `.Header`、`.Sections`、`.Footer`） | 动态页头 + 导航栏 + 区块容器；锚点或页签；滚动跟随；区块按需加载 | 不读数据 | `navigation: 'anchor' \| 'tabs'`、`selectedSection` / `onSelectedSectionChange`、`headerExpanded`、`headerPinned` | 区块只含子区块；标题去冗余规则（OP-12） | 区块的增加、替换、顺序 | sap.uxap.ObjectPageLayout |
| `ObjectPageHeader` | 面包屑、标题、副标题、头像、动作区、页头 Facet 容器、页头消息条位置 | — | `title`、`subtitle`、`image`、`breadcrumbs`、`actions`、`facets`、`messageStrip` | 各元素的位置和折叠行为（OP-01、OP-04） | 各元素内容 | sap.f.DynamicPageTitle + ObjectPageDynamicHeader |
| `HeaderFacet` | 一个页头 Facet：表单、纯文本、图片、关键值、进度、评分 | 微型图表（二期） | `facet`（模型生成）或 `kind` + 显式值 | 每种 Facet 的结构（OP-04） | 自定义 Facet | sap.fe 的 HeaderFacet 片段 |
| `AnchorBar` | 锚点、子区块菜单、溢出菜单、小屏下拉；方向键导航 | — | `sections`、`active`、`onSelect` | OP-08 | — | sap.uxap.AnchorBar |
| `Section`、`SubSection` | 区块和子区块；标题与条数；子区块工具栏；"显示更多 / 显示更少"；区块消息条位置 | — | `id`、`title`、`count`、`actions`、`moreContent` | OP-10、OP-11 | 内容 | sap.uxap.ObjectPageSection / SubSection |
| `SmartObjectPage` | **整页模板示例**：`useObject` + `ObjectPageLayout` + 从 `UI.Facets` 生成的区块（表单、子表），只用公开导出 | 不编辑 | `path`（实体路径）、`onNavigate`、`extend?` | — | 全部 | sap.fe.templates.ObjectPage |

## 6. 无界面 hook

| hook | 职责 | 返回 |
| --- | --- | --- |
| `useFilterState(entitySet, opts)` | 条件、搜索词、可见字段、必填校验、"与上次执行是否一致" | `{ filters, setFilters, search, setSearch, visibleFields, setVisibleFields, applied, go, dirty, missingRequired }` |
| `useListQuery(entitySet, opts)` | 把条件、排序、可见列变成查询，管理分页、计数、忙碌和错误 | `{ request, rows?, count, isFetching, error, fetchBlock(skip, top), refresh }` |
| `useVariants(pageKey)` | 读写变体存储 | `{ variants, current, select, saveAs, save, remove, setDefault, dirty }` |
| `useObject(path, opts)` | 读一个实体（按页头和首屏区块计算 `$select`、`$expand`） | `{ data, isLoading, error, refresh }` |
| `useSectionScrollSpy(sectionIds, scrollRoot)` | 当前区块、滚动到某区块（先折叠页头再滚动） | `{ active, scrollTo }` |
| `usePageState(key, initial)` | 读写页面状态（返回时恢复） | `[state, setState]` |
| `useTableContext()` / `useObjectContext()` | 给自定义内容用：数据、选中行、刷新、当前筛选 | — |
