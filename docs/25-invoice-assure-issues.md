# invoice-assure 用 smart-kit 0.1.0 发现的问题

> 最后更新：2026-11-17（由 invoice-assure 的会话写入；同日本仓库修好 21 条，见“修复状态”）。invoice-assure 把列表页、记录页改用 smart-kit 0.1.0 时发现的问题，在本仓库修。修好一条、发版后，在这里写上本仓库的提交号和版本；invoice-assure 升级、拆掉绕行办法后，由那边在它的待办（TECH-054～TECH-076）里关掉，并从这里删掉那一条。

## 怎么用

- **背景**：invoice-assure（本机 `../03-invoice-assure`）把列表页、记录页改用 smart-kit 0.1.0（npm 上的 `@rhfan2019/smart-kit`、`-core`、`-server`、`-cli`），经 OData V4 读 PostgreSQL 里的视图。方向见 invoice-assure 的 `docs/decisions/2026-11-17-smart-kit-list-pages.md`，本仓库的讨论在 `docs/12-discussion-log.md` D27。
- **约定**：invoice-assure 不改 `node_modules`、不拷 smart-kit 的源码。下面的“本项目现在怎么绕”指 invoice-assure 的临时办法，修好后由那边拆掉。
- **能直接看的例子**：用户页（系统管理 → 用户）已经整页用 smart-kit：清单 + 弹性分栏（FCL）里的对象页，代码在 invoice-assure 的 `src/features/users/components/users-client.tsx`、`src/components/smart-kit/`、`src/server/odata/`。
- **编号**：S 是 invoice-assure 决策第 8 节的编号，TECH 是它的待办编号。代码位置指本仓库（核对时 `main` 在 e016471）。“本项目”都指 invoice-assure。

## 修复状态（2026-11-17，本仓库，未提交、未发版）

下一版（0.3.0，Changesets minor；0.2.0 是 ADR-031 的分组和合计）带上这些修改。发版后在这里补提交号和版本号；本项目升级、拆掉绕行办法后，按“怎么用”里的约定删掉对应的条目。讨论记录见 `docs/12-discussion-log.md` D29。

| 编号 | 状态 | 怎么用 |
| --- | --- | --- |
| S1 | 已修 | `scope` 返回的条件里可以对集合导航用 `any` / `all`（`_ScopeKeys/any(k: k/CompanyCode eq '1000')`），列表、`$count`、按键读（404）、别的集合的 `$expand` 和 `$filter`、`$apply`、写都套上；范围条件里的导航不再套目标的范围（不会递归）。`$filter` 本身也支持 `any` / `all` 了。注意：`Invoices('B')/_Lines` 在 B 超出范围时返回空列表（200），不是 404，和以前经父路径读的行为一致 |
| S2 | 已修 | `smart-kit.config.json` 的 `navigations` 里写 `{"from": "user_list", "to": "user_role_list", "on": {"id": "user_id"}, "toMany": "_Roles", "partner": "_User"}`；`generate` 写进 CSDL 和存储映射，`check --strict` 查出写错的表、视图和列。见 smart-kit-cli 的 `docs/README.md`“Navigations without a foreign key” |
| S3 | 已修 | 网格表也能分组了（D30）：视图设置的“分组”页选一列（或 `UI.PresentationVariant/GroupBy` 给默认值），每组前有一行组头，显示组值、行数和合计列的组小计，表尾有合计，都由服务按当前筛选算。只能按一列分组，不能折叠；分组时每次读 100 行，滚到底再读。用 AG Grid 免费版自己做，不需要 Enterprise 许可证 |
| S4 | 已修 | `SmartListReport` / `SmartTable` 的 `exportable={false}` 去掉导出按钮；`onBeforeExport(e)` 在读完要导出的行、写文件之前调用，`e` 带清单、条件、搜索、排序、列和行数，返回 `false` 不生成文件；`onExported(e)` 在写完后调用 |
| S5 | 已核实 | `MemoryProvider` 就是“宿主给行”的数据源：全部条件运算（含相对日期）、搜索、排序、计数、分组、合计和小计都在前端算；行变了调 `provider.setRows(集合, 行)`，再改 `SmartListReport` 的 `refreshToken`。见 React 包 `docs/recipes.md` 第 13 节 |
| S6 | 已修 | 日期筛选有“相对日期”按钮（今天、昨天、明天、本周/上周/下周、本月…、本季、本年、最近 / 未来 N 天、年初至今）；视图里存相对的说法，每次读清单按当天（服务的时区）算 |
| S7 | 已修 | 配色改用 `html[data-sk-theme]` 和 `data-sk-density`。本项目在 `<html>` 上写 `data-sk-theme="host"`，smart-kit 就不理 `data-theme`，全听宿主的 `--sk-*` |
| S8 | 已修 | `@import '@rhfan2019/smart-kit/styles.layered.css';`：同样的样式，放在 `@layer smart-kit` 里 |
| S9 | 已修 | 除 `/i18n` 外，各 React 入口的第一行都是 `'use client'` |
| S10–S12 | 只记录 | 未做 |
| S13 | 已修 | `createKysely(pool, { statementTimeout })`：用本项目已有的 `pg` 池；拿连接时设 UTC 和语句超时，还回池时恢复，本项目自己的查询不受影响。见 smart-kit-server 的 `docs/README.md`“Using the host's pg pool” |
| S14 | 已修 | 值列表的下拉、输入建议和令牌按 `UI.TextArrangement` 显示，`TextOnly` 只显示文字；没有注解时仍是“文字 (代码)” |
| S15 | 已修 | 保存、另存、管理失败时显示 `VariantStore` 抛出的文字，另存对话框保持打开。按权限关掉保存：`new ODataVariantStore(provider, 'Variants', { canSave })`（或自己的 `VariantStore` 带 `canSave`），也可以用 `SmartListReport` 的 `canSaveVariants`；为假时菜单里只剩选视图 |
| S16 | 已修 | `SmartListReport` 的 `refreshToken`：改它就重读表格、页签计数和图表（第一次的值不算） |
| S17 | 已修 | 自定义列可以写 `importance: 'High'`；弹入行的标签列至少 `--sk-size-popin-label`（96px）宽；本项目的吸顶横幅高度写进 `--sk-sticky-top`，随窗口滚动的页面就吸在它下面 |
| S18 | 已修 | 点“另存为”“管理”时先关菜单，再开对话框 |
| S19 | 已修 | 没有图片时，按 `UI.HeaderInfo/Initials` 显示缩写头像；类型带 `Communication.Contact`（人）时，没有 `Initials` 也按标题取首字，圆形；其他对象圆角方形 |
| S20 | 已修 | `SmartObjectPage` 的 `partialHeaderEdit={false}` 去掉“编辑页头”；开着时，保存失败对任何会话（草稿、直接保存、宿主的 `editStrategy`）都调 `session.cancel()`。保存那一下正文闪成编辑状态，是因为部分编辑也经宿主的 `begin`；接管保存的页面建议直接关掉部分编辑 |
| S21 | 已修 | `SmartObjectPage` 的 `share={false}` |
| S22 | 已修 | 文案带类型名：“用户已创建。”“这个用户已被别人改过，请重新加载后再试。”“没有这个用户。”；没有类型名时“已创建。”“没有找到。”。英文同理 |
| S23 | 已修 | 两栏、三栏之间有分隔条和箭头按钮，在 67/33、33/67 等比例之间切换；箭头只调 `onLayoutChange`，布局仍由宿主的路由决定（新布局名 `TwoColumnsBeginExpanded` 等）；`separatorArrows={false}` 去掉箭头。不能拖动 |

## 先修哪几条

| 顺序 | 编号                 | 为什么先修                                                                               |
| ---- | -------------------- | ---------------------------------------------------------------------------------------- |
| 1    | S15 · TECH-068       | 视图另存失败没有任何提示，用户以为存了                                                   |
| 2    | S22 · TECH-075       | 界面上出现内部词“对象”，违反本项目“只说用户的话”                                         |
| 3    | S20 · TECH-073       | 页面接管保存时，“编辑页头”保存失败会让页面停在编辑状态；现在只能用样式藏掉按钮           |
| 4    | S1、S2 · TECH-054/55 | 进项发票、原件、SAP 历史这些按发票、按订单看范围的清单，补上之前迁不了                   |
| 5    | S4 · TECH-057        | 每张清单都有导出，导出不能关也不能记操作记录                                             |
| 6    | S3、S5 · TECH-056/58 | 两个工作清单（预制到 SAP、待我核对）要用；S3 在未发版的 ADR-031 里可能已做，核实后补缺口 |
| 7    | 其余                 | 都已有绕行办法，按需要排                                                                 |

## 必须先补

### S1 · TECH-054：数据范围不能经导航

- **现象**：smart-kit-server 的 `scope(entitySet, ctx)` 只能返回本集合自身字段上的 `$filter`；条件里经导航（如 `_ScopeKeys/any(k: k/CompanyCode eq '1000')`）会报错。
- **为什么要**：一张进项发票可能对着几张订单，范围按订单的“公司代码 · 采购组织 · 采购组”算，本表字段表达不了。本项目打算用视图 `odata.invoice_scope_key`（每张发票对着的维度组合，一行一组）做集合导航，条件写成 `_ScopeKeys/any(…)`。
- **期望**：`scope` 返回的条件里允许对集合导航用 `any` / `all`（读、计数、`$expand`、写都同样拼进去）；或者 `scope` 能返回参数化的 SQL 条件。
- **本项目现在怎么绕**：绕不了，这几张清单先不迁：进项发票、原件、SAP 的历史和物料凭证、操作记录里指向发票的。
- **验收**：范围外的发票在列表、`$count`、按键读（404）、从别的集合 `$expand`、`$filter` 经导航引用里都碰不到；范围内的都能读到。

### S2 · TECH-055：视图没有导航

- **现象**：smart-kit-cli 只按外键约束生成导航（`navigations.<约束名>`），视图没有外键，所以视图之间、视图和表之间都没有导航。
- **为什么要**：本项目只把视图暴露给 OData（schema `odata`）。S1 的 `_ScopeKeys` 要它；对象页的子表（如用户页的“角色”、订单的行）也要它。
- **期望**：在 `smart-kit.config.json` 里能给视图声明导航：目标实体、一对一还是一对多、对应字段（如 `{"from": "user_list", "to": "user_role_list", "on": {"Id": "UserId"}, "toMany": "_Roles"}`）。
- **本项目现在怎么绕**：用户页的“角色”区块用页面自己的部件（`sectionExtend`），不是 smart-kit 的子表。
- **验收**：声明后 `$metadata` 有这条导航，`$expand` 和对象页子表都能用；`smart-kit check` 能查出声明里写错的字段。

### S3 · TECH-056：网格表的分组小计和合计

- **现象**：0.1.0 里分组只在响应式表，网格表没有分组、小计、合计。
- **为什么要**：预制到 SAP、待我核对要按供应商、到期日分组，看每组的价税合计和总合计。
- **请先核实**：本仓库未发版的 ADR-031（4056228，CHANGELOG 的 Unreleased）已经做了响应式表的分组小计和两种表的合计行。请确认网格表能不能分组、组上有没有小计；没有的就补上。
- **本项目现在怎么绕**：这两张清单还没迁。
- **验收**：网格表按一列分组后，组头有行数和小计，表尾有合计，都由服务按当前筛选算。

### S4 · TECH-057：导出不能关，也没有钩子

- **现象**：表格工具栏的“导出到表格文件”总是在，并且在浏览器里直接生成 Excel，宿主不知道有人导出了。
- **为什么要**：本项目要求导出写操作记录（FEAT-130：谁、哪张清单、什么条件、多少行），有的清单不该让人导出。
- **期望**：`SmartListReport` / `SmartTable` 能关掉导出（如 `exportable={false}`），并有一个导出前或导出后的回调（带清单、条件、行数），宿主可以在回调里记录，也可以拒绝。
- **本项目现在怎么绕**：用户页的导出还开着，没有记录。
- **验收**：关掉后工具栏里没有导出按钮；开着时回调拿到的条件和行数与导出文件一致，回调拒绝时不生成文件。

### S5 · TECH-058：宿主给行的正式数据源

- **现象**：要核实 `MemoryProvider` 能不能当正式数据源用：全部条件运算、搜索、计数、分组、多个视图的计数。
- **为什么要**：两个工作清单的行由本项目的 TypeScript 规则算出来（分组、岗位分离、到期、能不能成批），写不成视图，只能由宿主把行交给表格。
- **期望**：一个说明清楚的“宿主给行”数据源：宿主给全部行（工作清单有业务上限），smart-kit 在前端做筛选、搜索、排序、分组、计数、小计；行变了能让它重读。
- **本项目现在怎么绕**：这两张清单还没迁。另外，本项目还没定这两张清单是不是走这条路（DEC-145）。
- **验收**：用 `MemoryProvider` 或新的数据源，筛选栏、视图、分组小计、导出（S4）都和 OData 清单一样能用。

### S15 · TECH-068：视图另存失败不提示；不能按权限关掉保存

- **现象**：
  - 在“另存为”对话框里点保存，宿主的 `VariantStore.create` 抛错（本项目是没有 `list.view:save` 权限）时，对话框不动、没有提示，只在控制台有未处理的 Promise。
  - 没有保存权限的人也看得到“保存”“另存为”。
- **复现**：本项目用内置“系统管理员”（没有 `list.view:save`）在用户页另存视图。
- **期望**：
  - 保存失败时在对话框里显示宿主抛出的错误文字，对话框保持打开。
  - 能按权限关掉保存，例如 `VariantStore` 带一个 `canSave`，或 `SmartListReport` 有一个属性：为假时只能选视图，不能保存、另存、管理。
- **本项目现在怎么绕**：没有。系统管理员能不能存视图另待用户定（DEC-144）。
- **验收**：存失败时对话框里出现错误文字；关掉保存后，菜单里只剩选视图。

### S20 · TECH-073：“编辑页头”关不掉，保存失败时不结束页面接管的编辑

- **现象**：
  - 对象页在“抬头里有可编辑字段、有抬头信息块、可以编辑”时，总会显示“编辑页头”。代码在 `SmartObjectPage.tsx` 的 `editHeaderButton`，没有属性能关。
  - 它的对话框（`PartialEditDialog`）在提交时调 `strategy.begin` 开始编辑。保存失败时，只有草稿会话才调 `session.cancel()`；直接保存或宿主自己的 `editStrategy` 开的会话不会结束。
- **为什么是问题**：本项目用 `ServiceConfig.editStrategy` 接管保存，把整张表单（含页面自己的“角色”区块）一次交给 Server Action。宿主靠 `begin` 和 `save`/`cancel` 知道正文要不要显示成编辑状态。“编辑页头”保存失败后，正文会一直停在编辑状态；保存的那一下，正文也会闪成编辑状态。
- **期望**：
  - `SmartObjectPage` 能关掉部分编辑，例如 `partialHeaderEdit={false}`。
  - 部分编辑保存失败时，对任何会话都调 `session.cancel()`。
- **本项目现在怎么绕**：invoice-assure 的 `src/components/smart-kit/styles.css` 里用 `[data-sk-edit-header] { display: none; }` 藏掉按钮；“编辑”同样能改抬头字段。
- **验收**：关掉后没有“编辑页头”；开着时，保存失败后宿主的写入端收到 `cancel`。

### S22 · TECH-075：库文案用了内部词“对象”

- **现象**：中文文案里有“对象已创建。”（`create.done`）、“对象已被他人修改。请重新加载后再试。”（`edit.conflict`）、“对象不存在。”（`object.notFound`）、“对象加载失败：…”（`object.loadError`）、“对象已删除。”（`delete.done`）。用户在用户页新建一个人之后，消息里是“对象已创建。”。
- **为什么是问题**：用户不说“对象”。本项目的规矩是界面只用用户自己的词。
- **期望**：这些文案带上类型名（`UI.HeaderInfo/TypeName`），如“用户已创建。”“这个用户已被别人改过，请重新加载后再试。”“没有这个用户。”；没有类型名时用不含“对象”的说法（“已创建。”）。英文同理。
- **本项目现在怎么绕**：没有。
- **验收**：用户页新建、保存冲突、打开不存在的人，界面上都没有“对象”二字。

## 可以先绕开

### S6 · TECH-059：条件没有相对日期

- **现象**：筛选条件只能选固定日期，没有“今天”“本月”“最近 7 天”这类相对日期，存进视图后会过时。
- **期望**：日期条件可以选相对日期，视图里存的是相对的说法，每次打开按当天算。
- **本项目现在怎么绕**：旧视图里的相对日期，迁移时转成当天算出的固定日期。

### S7 · TECH-060：`data-theme` 和宿主同名

- **现象**：smart-kit 的配色用 `html[data-theme]`，取值 `yellow`、`sky` 和本项目的配色同名，宿主关不掉它的内置配色。
- **期望**：用 smart-kit 自己的属性名（如 `data-sk-theme`），或者给一个“不用内置配色、全听宿主的 `--sk-*`”的开关。
- **本项目现在怎么绕**：invoice-assure 的 `src/styles/theme.css` 末尾不在任何层里，把全部 `--sk-*` 指到本项目的令牌，优先级盖过 smart-kit。

### S8 · TECH-061：样式不在 `@layer` 里

- **现象**：`@rhfan2019/smart-kit/styles.css` 是不分层的样式，和宿主的 Tailwind、Mantine 层次难排。
- **期望**：发布带层的样式（如 `@layer smart-kit`），或者另出一个带层的入口。
- **本项目现在怎么绕**：`@import '@rhfan2019/smart-kit/styles.css' layer(smart-kit);`，层顺序在宿主的 `globals.css` 里声明。

### S9 · TECH-062：入口没有 `'use client'`

- **现象**：在 Next.js App Router 的服务端组件里误引 smart-kit 时，报的是 hooks 相关的错，看不出是少了客户端指令。
- **期望**：各个 React 入口加 `'use client'`。
- **本项目现在怎么绕**：只在客户端文件里引，并用 ESLint 限制引用的位置。

### S10 · TECH-063：没有 `$batch`（只记录）

- **现象**：成批动作一行发一个请求，丢掉了“一次确认、逐张报结果”的做法。
- **本项目现在怎么绕**：成批的事用表格工具栏的自定义按钮，调本项目的 Server Action。暂不要求补，记下来供排期参考。

### S11 · TECH-064：服务端没有无绑定的动作（只记录）

- **现象**：smart-kit-server 只支持绑定动作。
- **本项目现在怎么绕**：新建按钮放页头，打开对象页的新建模式（`create`）。暂不要求补。

### S12 · TECH-065：`afterRead` 是同步的（只记录）

- **现象**：`afterRead` 只能放纯函数算的显示字段，不能查库。
- **本项目现在怎么绕**：要查库才能写出来的字段（如用户页的“看不到发票”）用自定义列，按当前页的行调本项目的查询。暂不要求补。

### S13 · TECH-066：文档没写怎么用宿主已有的连接池

- **现象**：smart-kit-server 的文档只讲 `createPostgresDb`，没写宿主已经有 `pg` 池时，怎么建 Kysely、要设哪些会话参数（UTC、语句超时）。
- **期望**：文档补一节；最好导出一个用现有池建 Kysely、设好会话参数的函数。
- **本项目现在怎么绕**：用 `createPostgresDb` 另开一个 4 个连接的小池。

### S14 · TECH-067：值列表把代码接在文字后面

- **现象**：固定值的下拉和输入建议显示成“在用 (active)”。代码在 `packages/react/src/filter/ConditionInput.tsx` 第 99 行和第 151 行：写死了 `` `${text} (${key})` ``，不看 `UI.TextArrangement`。
- **期望**：按 `UI.TextArrangement` 显示（`TextOnly` 只显示文字），默认至少不要把代码露给用户。
- **本项目现在怎么绕**：用户页的状态筛选改用中文文字当值列表的键（`StatusText`）。

### S16 · TECH-069：清单没有刷新参数

- **现象**：宿主在别处改了数据（抽屉、菜单、对话框），没办法让 `SmartListReport` 重读；换 `key` 只是重建组件，读到的是查询缓存里的旧数据。
- **期望**：一个刷新的办法，如 `refreshToken` 属性，或者导出一个让某个集合的查询失效的函数。
- **本项目现在怎么绕**：宿主自己建 `QueryClient` 传给 `SmartKitProvider`，改动后 `invalidateQueries()`（`SmartKitHost` 的 `refreshToken`）。

### S17 · TECH-070：窄屏的三处

- **现象**：
  - `tableExtend` 加的自定义列不能设 `UI.Importance`，窄屏下行菜单进了弹入行。
  - 弹入行里标签列太窄，“角色”这样的标签被挤成两行。
  - 吸顶的视图栏和宿主的吸顶横幅之间漏出一条内容。
- **期望**：自定义列能设重要程度；弹入行的标签列宽一些；吸顶时不留缝（或者能设吸顶的偏移量）。
- **本项目现在怎么绕**：给姓名、状态标了 `High`，其余照现在。

### S18 · TECH-071：视图菜单浮在对话框遮罩上面

- **现象**：打开“另存为”对话框后，视图菜单的弹层还浮在遮罩上面。
- **期望**：打开对话框时关掉菜单，或者菜单的层级低于对话框。

### S19 · TECH-072：对象页抬头没有缩写头像

- **现象**：`UI.HeaderInfo` 只认 `ImageUrl`，没有图片时抬头左边空着。
- **期望**：照 Fiori，没有图片时按 `UI.HeaderInfo/Initials`（或标题的首字）显示圆形缩写头像；人用圆形，其他对象用圆角方形。
- **本项目现在怎么绕**：用户页的抬头先不放头像。

### S21 · TECH-074：对象页不能隐藏“分享”

- **现象**：对象页抬头的动作里总有“分享”（`SmartObjectPage.tsx` 的 `actionItems` 最后一项），清单有 `share={false}`，对象页没有。
- **期望**：对象页也有 `share` 属性。
- **本项目现在怎么绕**：留着。

### S23 · TECH-076：两栏之间没有分隔条

- **现象**：`FlexibleColumnLayout` 两栏之间只有一条边线，不能把左栏拉宽或收窄。
- **期望**：照 Fiori 的 FCL，在分隔条上放箭头按钮（在 33/67、67/33 等几种比例之间切换），或者能拖动。
- **本项目现在怎么绕**：留着，左栏固定 33%。
