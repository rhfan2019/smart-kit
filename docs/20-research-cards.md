# 20 卡片（Card）调研与方案

> 状态：**现行** · 2026-11-16 用户确认（讨论记录 D16、D17，ADR-028）。验收条目见 `22-cards-acceptance.md`，截图见 `21-evidence/`。编号以合并时为准：并行的 `odata-server` 分支也可能新增文档、ADR 和 Dxx，合并时若撞号，由主会话统一改号。
>
> 出处缩写：
> - **[IC]** SAP Fiori Design Guidelines v1.154《Card》（`ui-elements/cards`，即 Integration Card，`sap.ui.integration.widgets.Card`），2026-11-16 用内置浏览器通读。
> - **[CAL]** 同版本《Calendar Card》（`ui-elements/calendar-card`）。
> - **[OVP]** 同版本《Overview Page (OVP) Floorplan》及其卡片子页：《Overview Page – Cards》《List Card》（含 Bar Chart List、Link List）《Table Card》《Analytical Card》《Stack Card | Quick View Card》。
> - **[CE]** SAPUI5 Card Explorer（Integration Card 的 manifest 结构：`sap.card` 的 `type`、`header`、`content`、`data`、`actions`、`footer`），按已有知识整理，未逐页核对；实现时以官方页面为准。
> - **[VOC]** OData 词汇表 `UI`、`Communication`（`Communication.Event`、`Communication.Contact`）。
>
> 规则编号 CD-xx 供以后的验收标准引用。

## 0. 结论（先看这一节）

1. SAP 有**两套**卡片，长得像，来源不同：
   - **Integration Card**（[IC]）：由 JSON manifest 描述，数据请求、字段映射、动作都写在 manifest 里，可以放进任何宿主（启动台首页、其他应用）。类型：List、Analytical、Table、Object、Timeline、Calendar、Component，另有 Adaptive、WebPage（[CE]）。
   - **Overview Page 卡片**（[OVP]）：Fiori Elements 的一部分，**由 OData 注解驱动**（`UI.LineItem`、`UI.Chart`、`UI.DataPoint`、`UI.HeaderInfo`、`UI.Identification` 等），只能放在概览页里。类型：Analytical、List、Bar Chart List、Link List、Table、Stack / Quick View、Custom。
   - [OVP] 明确写着"integration cards cannot be consumed by the overview page"，两者不互通。
2. **建议 smart-kit 走注解驱动为主**（与本库其他 Smart 组件一致，ADR-011），借用 Integration Card 的**外观与结构**（header / content / footer、默认页头和数值页头、计数"5 of 40"），因为 Integration Card 的设计规范比 OVP 卡片新、更完整，并且日历、时间线卡片只在 Integration Card 里有。
3. **不照搬 manifest**：manifest 本质是"在 JSON 里重写一遍注解已经表达的东西"，UI5 为此还要在运行时下载卡片运行时、解析 manifest——正是 ADR-026 要避免的。需要手工配置的地方用 React props 表达（类型检查、按需打包），不发明 JSON 格式。
4. **做了 7 种**：列表（含扩展项、条形图列表）、表格、对象、分析、时间线、日历，以及自定义（Component 卡片：`Card` 里放任意 React 内容）。**不做**：Adaptive Card、WebPage 卡片、Stack 卡片（对象流覆盖层）、可拖拽调大小的卡片布局、"添加到我的首页"。理由见第 4 节。
5. **组件名与 SAPUI5 一致**（D17，用户是 UI5 开发者）：容器 `Card`（`sap.f.Card`），页头 `Header`、`NumericHeader`、`NumericSideIndicator`（`sap.f.cards.*`），内容 `ListContent`、`TableContent`、`ObjectContent`、`AnalyticalContent`、`TimelineContent`、`CalendarContent`（`sap.ui.integration.cards.*Content`）。属性名沿用 SAPUI5（`statusText`、`unitOfMeasurement`、`iconSrc`、`maxItems`……）和 OVP 卡片设置（`annotationPath`、`presentationAnnotationPath`、`selectionAnnotationPath`、`chartAnnotationPath`、`dataPointAnnotationPath`、`identificationAnnotationPath`、`listType`、`listFlavor`）。
6. 全部放进新子路径 **`@rhfan2019/smart-kit/cards`**；图表复用 `/chart` 的 `SimpleChart`（扩展了 Line、Donut），**不引入新依赖**。日历没有用 `@mantine/dates` 的 `Calendar`，自己画网格（约 3 KB），理由见第 6 节。

## 1. 重名检查与命名（D17 修订）

方案初稿为了避开 Mantine 的 `Card` 用了 `CardShell`、`Smart*Card`；用户确认时要求**与 SAP 的组件命名保持一致**（用户是 UI5 开发者，同名可以减少理解成本），改成下表。

| 本库（`@rhfan2019/smart-kit/cards`） | SAPUI5 | 说明 |
| --- | --- | --- |
| `Card` | `sap.f.Card` | 容器：`header`、`headerPosition`、内容（children）、`footer`、`width`、`height` |
| `Header` | `sap.f.cards.Header` | `title`、`subtitle`、`statusText`、`iconSrc`、`iconInitials`、`iconDisplayShape`、`onPress`（事件 `press`） |
| `NumericHeader` | `sap.f.cards.NumericHeader` | `number`、`scale`、`trend`、`state`、`unitOfMeasurement`、`details`、`sideIndicators`；另有注解驱动的 `entitySet` + `dataPointAnnotationPath` |
| `NumericSideIndicator` | `sap.f.cards.NumericSideIndicator` | `title`、`number`、`unit`、`state` |
| `ListContent`、`TableContent`、`ObjectContent`、`AnalyticalContent`、`TimelineContent`、`CalendarContent` | `sap.ui.integration.cards.ListContent` 等 | SAPUI5 里由 manifest 配置；本库由注解驱动，设置名沿用 OVP 卡片（`annotationPath` 等） |

- **与 Mantine 的 `Card` 同名**：本库内部不用 Mantine 的 `Card`，所以没有冲突。应用里两者都要用时，引入时改名即可：`import { Card as FioriCard } from '@rhfan2019/smart-kit/cards'`。
- 本库其他地方没有 `Card`、`Header` 等导出（`api.test.ts` 检查每个名字只出现一次）。
- 不做 SAPUI5 的 `sap.ui.integration.widgets.Card`（manifest 驱动的那一个）：它的内容由 JSON 描述，本库用组件组合表达同样的东西。

## 2. SAP 的规范要点

### 2.1 通用结构（[IC]、[OVP]）

| 编号 | 规则 | 出处 |
| --- | --- | --- |
| CD-01 | 卡片 = 页头 + 内容区，两者之间有分隔线；外层容器有背景和边框。页脚只用于动作（OVP 只有 Quick View 卡片有页脚；Integration Card 有 `footer.actionsStrip`） | [IC]、[OVP] |
| CD-02 | **默认页头**：标题必填，超过三行截断加省略号；副标题可选，[IC] 超过两行截断，[OVP] 超过一行截断（取 [IC]）；可选头像（图片、图标、首字母）；内容有多条时显示计数 | [IC] |
| CD-03 | **计数**：格式"[卡片上的条数] of [总条数]"，如"5 of 40"；右对齐，不截断（标题换行让位）；全部显示时不显示计数；加载出错或无数据时也不显示；超过 1000 用缩写（1K） | [OVP] |
| CD-04 | **数值页头**：标题、副标题；有单位时副标题行显示"<副标题> \| <单位>"；主数值（KPI）带语义色和趋势箭头；最多两个附加指标（如目标值、偏差）；数值下方可有一行说明（如统计期间） | [IC]、[OVP] Analytical KPI header |
| CD-05 | 整个页头可点，打开卡片所代表的应用或页面；内容区可以有多个点击区域（行、数据点），由内容类型决定 | [IC]、[OVP] |
| CD-06 | 卡片里**没有可编辑字段** | [OVP] |
| CD-07 | 日期默认相对格式（"今天"）或中等格式；时间默认不显示；整数、小数、金额用短格式（1K） | [OVP] |
| CD-08 | 卡片大小随宿主容器变化，卡片自己不定宽 | [IC]、[CAL] |
| CD-09 | 页头溢出菜单：刷新（只刷新本卡片的数据） | [OVP]（"添加到我的首页"不做） |
| CD-10 | 视图切换：一张卡片可用下拉框切换几个"视角"（如"按物料组 / 按供应商"），适用于分析、列表、表格卡片 | [OVP] |

### 2.2 各类卡片

| 类型 | 内容区 | 取数 | 交互 | 数量上限（固定布局） | 出处 |
| --- | --- | --- | --- | --- | --- |
| **列表** List | 纵向列表。标准项 3 个信息（标题、描述、右侧值，可带图标 / 图片）；扩展项最多 6 个（`ObjectListItem` 式）；右侧值可用语义色。一张卡片只用一种项 | 一个实体集的结果集，带筛选和排序 | 页头 → 父应用（同样的筛选）；行 → 该对象详情；页头和行指向同一应用 | 标准项 ≤ 5，扩展项 ≤ 3 | [OVP] List |
| **条形图列表** Bar Chart List | 每行一个 Comparison 微型图表（可显示负值、语义色）；标准 3、紧凑 4、扩展 6 个信息 | 同上 | 同上 | ≤ 5 / ≤ 3 | [OVP] List |
| **链接列表** Link List | 链接集合（可带图标 / 图片、一行副标题），或图片轮播 | 静态配置，或实体集 | 链接跳转或弹出详情；页头**不**导航 | 列表变体 ≤ 6 | [OVP] List |
| **表格** Table | 响应式表格 | 同列表 | 页头 → 父应用；行 → 详情；单元格可以是字段或 DataPoint（语义色） | ≤ 3 列 × 3 行 | [OVP] Table |
| **分析** Analytical | 图表；页头可以是标准页头或 KPI 页头 | 聚合数据 | 页头可点；三种导航模式：无导航、数据点导航（默认）、只页头导航 | 建议 ≤ 4 个数据点、≤ 2 个系列 | [OVP] Analytical |
| **对象** Object | 一个对象的信息，分组显示，每组若干"标签：值"；可有页脚动作 | 一个对象 | 页头 → 对象详情；电话、邮件等可点 | 无 | [IC]、[OVP] Quick View |
| **时间线** Timeline | 按时间顺序排列的条目（图标、标题、说明、时间、负责人） | 一个集合，按时间排序 | 条目可点 | 由宿主决定 | [IC] |
| **日历** Calendar | 一个人（一个实体）的日历：月历（选中日、今天、特殊日）＋图例＋当天的日程列表＋"更多" | 日程集合和特殊日 | 选日期 → 日程列表和计数随之变；日历可逐级下钻（日 → 月 → 年 → 年区间）；日程可点；"更多"跳转 | 可见日程数可配；宽度 ≥ 295 px，> 589 px 变两栏；高度由内容决定，不滚动 | [CAL] |
| **组件** Component / **自定义** Custom | 任意内容 | 自行决定 | 自行决定 | — | [IC]、[OVP] |
| Stack / Quick View | 堆叠卡片入口 + 对象流覆盖层（最多 20 张 Quick View 卡片，可带动作）+ 占位卡片 | 集合 | 左半跳父应用，右半打开对象流 | 20 | [OVP] Stack |
| Adaptive | 微软 Adaptive Cards JSON（可含输入框、提交） | manifest | 提交表单 | — | [CE] |
| WebPage | 内嵌网页（iframe） | URL | — | — | [CE] |

## 3. 两条路线对比

| | Integration Card（manifest 驱动） | OVP 卡片（注解驱动） | smart-kit 建议 |
| --- | --- | --- | --- |
| 内容来源 | manifest 里写 `data.request`（URL、参数）和字段映射 `{title: "{Name}"}` | 实体集 + 注解：`UI.LineItem`（列表、表格）、`UI.Chart` + `UI.PresentationVariant`（分析）、`UI.DataPoint`（KPI、语义色）、`UI.HeaderInfo`（标题、图片）、`UI.Identification` / `UI.FieldGroup`（对象、导航） | **注解为主**，props 补充 |
| 可放在哪 | 任何宿主 | 只能在概览页 | 任何 React 页面（本身就是组件） |
| 改字段要改哪里 | manifest（和后端各写一份） | 后端注解，一处 | 后端注解，一处 |
| 日历、时间线 | 有 | 没有 | 用 `Communication.Event` 注解驱动（见下），也可用 props 指定字段 |
| 运行时代价 | 下载卡片运行时 + 解析 manifest + 请求数据 | 概览页框架 + `$metadata` | 只打包用到的卡片（ADR-026） |
| 精华（取） | 页头 / 内容 / 页脚的统一结构；数值页头；计数；日历、时间线的交互细节 | 一处注解、字段标签和格式自动来；语义色、单位、文本排列自动生效；页头和行导航指向同一结果集 | 两者都取 |
| 糟粕（弃） | 在 JSON 里重写一遍注解已表达的字段；自定义扩展要写 UI5 扩展类；Adaptive 卡片引一个大库 | 只能放在概览页；对象流覆盖层、固定 / 可调大小两种布局、卡片个性化，实现量大而收益小 | 不做 manifest；不做概览页框架本身（卡片是独立组件，布局交给使用者的 CSS Grid） |

### 3.1 每种卡片怎样从注解取数

| 卡片 | 必需的注解 | 可选 | 需要额外配置（props） |
| --- | --- | --- | --- |
| `ListContent` | 实体集；`UI.LineItem`（第 1 个字段作标题，第 2 个作描述，最后一个 DataField / DataPoint 作右侧值） | `UI.HeaderInfo`（卡片标题默认用 `TypeNamePlural`，图片用 `ImageUrl`）；`UI.PresentationVariant`（排序、`MaxItems`）；`UI.SelectionVariant`（筛选）；`UI.DataPoint.Criticality`（语义色）；`UI.Importance` | `title`（推荐写，卡片的"视角"是业务决定的，注解给不出）；`qualifier`（选哪个 LineItem / PresentationVariant）；`variant: 'standard' \| 'extended' \| 'bar'`；`onHeaderPress`、`onItemPress` |
| `TableContent` | 实体集；`UI.LineItem`（取前 3 列，按 `UI.Importance` 优先） | 同上 | 同上；`maxColumns` |
| `AnalyticalContent` | 实体集；`UI.Chart`（`ChartType` + 维度 + 度量） | `UI.DataPoint`（KPI 页头：值、`TargetValue`、`TrendCalculation`、`Criticality`）；`UI.PresentationVariant` | `NumericHeader` 的 `dataPointAnnotationPath` 给 KPI 页头；`onDataPointPress`（数据点导航）；`navigation` |
| `ObjectContent` | 实体集 + 键（或对象路径）；`UI.HeaderInfo` | `UI.QuickViewFacets`、`UI.FieldGroup`、`UI.Identification`（分组字段）；`UI.DataFieldForAction`（页脚动作） | `annotationPath`（QuickViewFacets / Facets / FieldGroup#Q）；`identificationAnnotationPath`；`onAction` |
| `TimelineContent` | 实体集；日期时间字段 | `Communication.Event`（`dtstart`、`summary`、`description`）；`UI.HeaderInfo` | 没有 `Communication.Event` 时用 `item` 指定 `startDate`、`title`、`text` 字段 |
| `CalendarContent` | 实体集；`Communication.Event`（`dtstart`、`dtend`、`summary`） | `Communication.Event.description`、`location`、`categories`（图例）；DataPoint 语义色 | 没有注解时用 props 指定字段；`specialDays`（特殊日，注解里没有对应术语）；`maxItems` |
| 链接列表（第二批） | — | `UI.LineItem` 里的 `DataFieldWithUrl` | `links` 静态数组（OVP 本身也是静态配置为主） |
| `Card` / `Header` | — | — | 全部 props；用于自定义卡片（对应 Component / Custom 卡片） |

**做不了或需要额外配置的**：

1. **卡片标题**：注解只能给出 `TypeNamePlural`（如"采购订单"），而卡片标题是"视角"（如"待审批的大额订单"），OVP 也是在 manifest 里配。→ `title` prop，缺省时用 `TypeNamePlural`。
2. **页头导航目标**：OVP 用 `UI.Identification` 里的 `DataFieldForIntentBasedNavigation`；本库没有启动台和意图导航。→ `onHeaderPress` / `onItemPress` 回调，或 `SmartKitProvider` 已有的导航钩子（与列表页一致）。
3. **日历的特殊日、图例**：标准词汇表没有对应术语。→ props。
4. **日历和时间线没有 `Communication.Event` 时**：→ props 指定字段（`startField` 等）。
5. **分析卡片的图表类型**：现有 `SimpleChart` 只有柱状（`Column`）和条形（`Bar`）。[OVP] 列出的 9 种里，第一批**只做 Column、Bar、Line、Donut**（Line、Donut 在 `SimpleChart` 里扩展，不另写图表）；Bubble、Scatter、Stacked Column、Vertical Bullet、Combined、Waterfall 不做，遇到时显示"不支持的图表类型"占位，并允许使用者用 `renderChart` 插槽换成自己的图表库（与 ADR-021 的"代价"一致）。**这一点需要用户确认**（Line、Donut 两种扩展是否值得做）。
6. **视图切换**（CD-10）：第二批；做法是 `views` prop 列出几个 qualifier。
7. **Stack / Quick View 对象流、Adaptive、WebPage**：不做（第 4 节）。

## 4. 不做的和理由

| 不做 | 理由 |
| --- | --- |
| manifest（JSON 描述卡片） | 与注解重复；JSON 没有类型检查；需要运行时解释器，违背 ADR-026 |
| Adaptive Card | 需要微软 `adaptivecards` 库（体积大），而且含表单输入，与 CD-06"卡片不可编辑"冲突 |
| WebPage 卡片 | 就是 iframe，使用者用 `Card` + `<iframe>` 一行就能写，不值得做组件 |
| Stack 卡片 + 对象流 | 覆盖层、横向滚动箭头、占位卡片，交互量大；需求未出现。需要时第二批再评估 |
| 概览页框架（固定 / 可调大小布局、卡片个性化"管理卡片"） | 这是页面模板，不是卡片；卡片做成独立组件后，布局用 CSS Grid 即可。真要做概览页模板时另开 ADR |
| "添加到我的首页" | 没有启动台 |

## 5. 组件 API

```tsx
import { Card, Header, NumericHeader, ListContent, TableContent, ObjectContent,
         AnalyticalContent, TimelineContent, CalendarContent } from '@rhfan2019/smart-kit/cards';

// 列表卡片：UI.PresentationVariant（排序、MaxItems、用哪个 LineItem）+ UI.SelectionVariant（筛选）
<Card header={<Header title="待审批的大额订单" subtitle="按净值降序" />}>
  <ListContent entitySet="PurchaseOrders"
    presentationAnnotationPath="com.sap.vocabularies.UI.v1.PresentationVariant#CardLarge"
    selectionAnnotationPath="com.sap.vocabularies.UI.v1.SelectionVariant#CardNew" />
</Card>

// 分析卡片：KPI 页头（UI.DataPoint 合计）+ UI.Chart
<Card header={<NumericHeader title="采购支出" entitySet="PurchaseOrders" dataPointAnnotationPath="@UI.DataPoint#CardSpend" />}>
  <AnalyticalContent entitySet="PurchaseOrders" chartAnnotationPath="@UI.Chart#ByStatus" />
</Card>

// 对象卡片：页头省略标题时用 UI.HeaderInfo
<Card header={<Header />}><ObjectContent entitySet="Suppliers" keys={{ Supplier: '0000100001' }} /></Card>

// 日历卡片：Communication.Event；特殊日和图例文字用 props
<Card header={<Header title="我的会议" />}>
  <CalendarContent entitySet="SupplierMeetings" maxItems={3} specialDates={[{ startDate: '2026-11-20', type: 'holiday' }]}
    legendItems={[{ category: 'calendar', type: 'holiday', text: '公司假日' }]} />
</Card>

// 自定义卡片（Component 卡片）
<Card header={<Header title="公告" />}>任意 React 内容</Card>
```

公共行为：
- 内容组件把"可见条数 / 总条数"报给所在的 `Card`，`Header` 没有 `statusText` 时显示计数（CD-03）；内容组件也给出页头的默认导航（列表页）和默认标题（`TypeNamePlural`，对象卡片是 `HeaderInfo` 的标题、描述和图片）。
- 都用 TanStack Query 取数，`$top` = 显示条数，`$count=true` 取总数；分析卡片和 KPI 用 `$apply` 在服务端聚合。
- 加载中显示与内容形状相同的占位块；出错、无数据时在卡片内提示，不影响其他卡片。
- 文字走 i18n（中英文），颜色走令牌；尺寸写成卡片令牌（`--sk-card-*`，取自 SAPUI5 实测值）。
- 页头、行、日程、日期都能用键盘操作（Enter、空格；日历用方向键）。

## 6. 打包（ADR-026）

- 新子路径 `/cards`，入口 `src/entries/cards.ts`，根入口转导出；模块顶层无副作用；`package.json` 的 dev `exports` 和 `publishConfig.exports` 都有 `./cards`。
- 依赖：`/chart` 的 `SimpleChart`（分析卡片）、`/table` 的 `useListQuery`（**不含 AG Grid**，只依赖 TanStack Query）。不引入新依赖。
- **日历没用 `@mantine/dates` 的 `Calendar`**：SAP 的日历卡片有周数列、38×46 px 的日期格、周末底色、底部特殊日色条，以及"日 → 月 → 年 → 年区间"四级下钻；Mantine 的 `Calendar` 只有三级，外观要大量覆盖，还会把 `dayjs` 和 `@mantine/dates` 带进只用卡片的应用。自己画网格约 3 KB（gzip），日期用 `Intl` 格式化，一周从哪天开始取自 `Intl.Locale` 的 `weekInfo`。
- 实测（gzip，不含 React）：入口自身 20.4 KB（列表项里的 Bullet 图懒加载）；只用 `Card` + `Header` 1.5 KB；列表卡片 41.1 KB；日历卡片 41.7 KB；分析卡片 45.8 KB（多出的是 Mantine 的 `Skeleton`、`VisuallyHidden`，`SimpleChart` 用到）。上限见 `scripts/check-size.mjs` 和 `22` 的 CD-40。
- 样式仍是一个文件（P5）；卡片样式约 4 KB，样式上限由 13 KB 调到 16 KB。

## 7. 测试服务里加的数据

只改 `apps/mock`（不碰 `packages/server`、`packages/cli`）：
- `PurchaseOrders` 加带 qualifier 的 `UI.LineItem#Card`、`UI.PresentationVariant#Card`（按净值降序）、`UI.Chart#BySupplier`、KPI 用的 `UI.DataPoint`（已有净值的可复用）。
- 新实体集 `SupplierMeetings`：`Meeting`、`Supplier`、`Subject`、`StartAt`、`EndAt`、`Location`、`Category`（文本 `CategoryName`，中英文），加 `Communication.Event` 注解；固定种子生成，2026-10-26 到 2026-12-14 的工作日每天 0～3 个，2026-11-16（`MEETING_DAY`）正好 4 个。
- `PurchaseOrders` 新增 `UI.LineItem#CardList`、`#CardTable`，`UI.DataPoint#CardAmount`、`#CardSpend`（含 `CriticalityCalculation`、`TrendCalculation`），`UI.PresentationVariant#CardLarge`（`MaxItems` 5），`UI.SelectionVariant#CardNew`、`#CardEur`，`UI.Chart#CardTypeShare`（Donut）。
- `Suppliers` 的 `UI.QuickViewFacets` 已有，对象卡片直接用。

## 8. 用户的决定（D17）

1～5 条全部同意（注解驱动为主、第一批 7 种、`SimpleChart` 扩展 Line 和 Donut、`Communication.Event` 驱动日历和时间线、子路径 `/cards`），另加两条：组件名与 SAP 一致；验收标准是成品效果与 SAP 官方成品严格一致。

## 9. 与 SAPUI5 成品逐项对比（V）

参照：本机用 SAPUI5 1.154.0 运行时（`ui5.sap.com` CDN，Horizon 主题）渲染同样数据的 7 种集成卡片（参照页 `21-evidence/ui5-reference.html`：用任意静态服务器打开，从 SAPUI5 CDN 加载运行时，只用来看渲染结果，不复制代码），读取渲染出的元素位置、尺寸、字号、颜色，截图见 `21-evidence/ui5-reference.png`；本库的截图见 `21-evidence/CD-*.png`。卡片宽都是 340 px（日历 640 px），数值是相对卡片左上角的像素。

| 项目 | SAPUI5 | 本库 | 说明 |
| --- | --- | --- | --- |
| 外框 | 圆角 16、阴影 `0 0 2px` + `0 2px 4px`、1 px 透明边框 | 相同（`--sk-card-radius`、`--sk-card-shadow`） | 阴影颜色随主题 |
| 页头文字 | 标题 x17 y17，14 px 粗体；副标题 y41（间距 8）；计数 12 px，右边缘 x323 | 相同 | |
| 页头头像 | 48 px，右边距 8，标题 x73 y21（垂直居中） | 相同 | |
| 列表项 | 高 80，标题距内容顶 18，描述再下 28，右侧信息与描述同行、右边缘 323；无分隔线 | 相同 | |
| 列表项头像 | 48 px、圆角 12，文字 x77 | 相同 | |
| 表格 | 表头行 47（上 14 下 16，下边线 1 px）；行高 44；列 x17 / x122 / x234；首列粗体 | 相同 | 本库字体略宽，长单号可能换行 |
| 对象卡片 | 组标题 16 px 粗体 y97、下边距 8；标签 y140，值再下 22；项间距 32；组间 28 | 相同 | 标签带冒号，中文用全角"：" |
| 数值页头 | 数值 36 px 细体；缩写单位粗体在数值右侧、趋势箭头在其上；附加指标右对齐、12 px；说明 12 px | 相同（数值 y60，SAP y62） | |
| 时间线 | 图标列 + 竖线；方框带左指箭头，边框 1 px、圆角 3；标题 x61 y71、日期 12 px 紧接其下、说明 +20；每项 91 | 相同（标题 x62） | 最新的在前 |
| 日历 | 内容内边距 16；导航行 44（上一页 x25、今天 x69、下一页 x134、月份 x178）；周名行 y133 高 32；日期格 38×46、圆角 8；周数列 12 px；周末底色（只限本月）；特殊日底部 5 px 色条；图例 16 8 内边距、行高 28、第二列 x179；日程框 48 高、左侧 4 px 色条；两栏时右栏 x336；卡片总高 550 | 相同（月份按钮 x181，字体所致） | 今天只列未结束的日程 |
| 颜色 | Horizon 色板 | 本库令牌（三套主题） | 沿用 D08：配色以本库令牌为准，语义（好、警告、差、中性）一致 |
| 字体 | "72" | 本库字体（Inter 等） | "72" 是 SAP 的字体，不随库分发 |

已知差异：分析卡片的图表区由 SAPUI5 的 VizFrame（`sap.viz`，SAPUI5 专有、体积大）画，本库用 `SimpleChart`（ADR-021），坐标轴和数据标签的样式不同；只对齐了图表区的位置和大小（x20、高 212）。

## 10. 第二轮：对照 Card Explorer 补齐（D18）

用户把演示页和 SAPUI5 Card Explorer 的"Integration Card Types"页（`ui5.sap.com/test-resources/sap/ui/integration/demokit/cardExplorer/webapp/index.html#/overview/cardTypes`）对比，觉得差距大。逐张看过后，差距有三类：

| 差距 | 原因 | 处理 |
| --- | --- | --- |
| 整体色调 | 演示页用本库默认的"明黄"主题（暖米色、墨黑），官方是 Horizon（浅灰底、白卡片、蓝色强调、鲜明的语义色） | 新增**天蓝主题**（`data-theme="sky"`，演示应用右上角"天蓝"），颜色取自 Horizon 实测：页面 #f5f6f7、文字 #131e29、标签 #556b82、链接 #0064d9、强调按钮 #0070f2、正向 #256f3a、警告 #b44f00、负向 #aa0808，状态图标 #30914c / #dd6100 / #f53232，图表色 #168eff 起的 11 色。原有主题不变 |
| 列表项 | 官方样例的列表项左侧有 6 px 状态色条（`highlight`），数值前有状态图标（`showStateIcon`），可以分组，可以内嵌 Bullet 图 | `ListContent` 增加 `highlight`、`showStateIcon`；`UI.PresentationVariant/GroupBy` 分组；`listFlavor="bar"` 且数据点有目标值时画 `MicroChart` Bullet（CD-15～CD-17） |
| 表格 | 首列是蓝色链接加一行灰色说明，进度列是进度条，有分组行 | 标识列（语义键或 `HeaderInfo/Title`）显示为链接并带 `HeaderInfo/Description`；`Visualization/Progress` 画进度条；分组行（CD-16、CD-18） |
| 演示数据 | 列表标题是订单号；时间线时间按浏览器时区显示 | 列表改用描述和供应商名称；演示页的卡片用柏林时区（与页面说明一致） |

仍然不同的：Card Explorer 里每张卡片的数据和配置不同（例如表格列宽在 manifest 里指定、对象卡片里有可编辑字段的表单），图表区仍是 `SimpleChart`（见第 9 节），字体仍是本库字体。截图：`21-evidence/CD-15-list-sky.png`、`CD-18-table-sky.png`、`CD-page-sky.png`。
