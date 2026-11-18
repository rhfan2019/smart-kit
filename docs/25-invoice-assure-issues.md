# invoice-assure 用 smart-kit 发现的问题

> 最后更新：2026-11-17（由 invoice-assure 的会话写入）。invoice-assure 用 smart-kit 时发现、还没修的问题，在本仓库修。修好一条、发版后，在这里写上本仓库的提交号和版本；invoice-assure 升级、拆掉绕行办法后，由那边在它的待办里关掉，并从这里删掉那一条。

## 怎么用

- **背景**：invoice-assure（本机 `../03-invoice-assure`）把列表页、记录页改用 smart-kit（现在是 0.3.0，npm 上的 `@rhfan2019/smart-kit`、`-core`、`-server`、`-cli`），经 OData V4 读 PostgreSQL 里的视图。方向见 invoice-assure 的 `docs/decisions/2026-11-17-smart-kit-list-pages.md`，本仓库的讨论在 `docs/12-discussion-log.md` D27。
- **约定**：invoice-assure 不改 `node_modules`、不拷 smart-kit 的源码。下面的“本项目现在怎么绕”指 invoice-assure 的临时办法，修好后由那边拆掉。
- **能直接看的例子**：用户页（系统管理 → 用户）已经整页用 smart-kit：清单 + 弹性分栏（FCL）里的对象页，代码在 invoice-assure 的 `src/features/users/components/users-client.tsx`、`src/components/smart-kit/`、`src/server/odata/`。
- **编号**：S 是 invoice-assure 决策第 8 节的编号，TECH 是它的待办编号。代码位置指本仓库（核对时 `main` 在 e016471）。“本项目”都指 invoice-assure。

## 已关掉的（2026-11-17）

0.1.0 时记的 S1～S9、S13～S23 在 0.3.0 修好，invoice-assure 已升级到 0.3.0、拆掉了绕行办法，条目删去（历史见 Git 和 `docs/12-discussion-log.md` D29、D30）。

## 还没修

### S24 · TECH-077：对象页的区块和抬头关键值不能按数据隐藏

- **现象**：`UI.Hidden` 只认常量（`buildModel` 里按 `bool(...)` 读），`UI.Facets`、`UI.HeaderFacets` 里的 `ReferenceFacet` 写 `<Annotation Term="UI.Hidden" Path="…"/>` 不起作用；`SmartObjectPage` 也没有扩展抬头关键值的属性（只有 `sectionExtend`）。
- **为什么要**：invoice-assure 的发票对象页按“情形”换内容（疑似重复、确认订单、差异、补单据、会计复核、在等别人、已了结）：同一个实体类型，抬头关键值（匹配度环形图、单价对比微图、付款到期、复核进度）和第一个区块按每张发票的数据决定显示哪些。Fiori elements 用的就是路径式 `UI.Hidden`。
- **期望**：`UI.Facets`、`UI.HeaderFacets` 的 facet（含 `CollectionFacet`、`ReferenceFacet`）和 `UI.DataField` 支持 `UI.Hidden` 的 `Path`（布尔字段，按当前这一行算；编辑中按草稿值算），被隐藏的区块同时从锚点栏里拿掉。
- **本项目现在怎么绕**：发票页不用 `SmartObjectPage`，改用下一层的 `ObjectPageLayout`，由宿主按行给 `facets`、`sections`；代价是区块和字段不再来自注解。补上后可以回到 `SmartObjectPage`。
- **验收**：一个字段为真时区块和锚点都不出现、为假时出现；抬头关键值同理；切换到另一行（FCL 翻页）时跟着变。

### S25 · TECH-078：对象页的页脚不能放宿主自己的决定按钮

- **现象**：页脚的动作只来自 `UI.Identification` 里 `Determining` 的 `DataFieldForAction`，调服务端绑定动作；`SmartObjectPage` 没有 `footer` 之类的属性。
- **为什么要**：invoice-assure 的发票页把了结这一步的决定放在固定页脚（如“接受差异，交财务”“退回供应商”“确认，转待预制”），点了先弹本项目的对话框（选依据类型、写原因、带上数字员工起草的文字），再走本项目的 Server Action；按钮按人、按情形现算；缺条件时左边写缺什么（“还差 1 条复核打勾”）并能点过去。
- **期望**：`SmartObjectPage` 有一个页脚扩展（如 `footerActions: ReactNode | (row) => ReactNode`，再加一个页脚左侧的消息位），和模型动作排在一起，照 Fiori 的顺序（主按钮在前），保持固定、不随滚动消失。
- **本项目现在怎么绕**：同 S24，用 `ObjectPageLayout` 的 `footer`。
- **验收**：宿主给的按钮出现在页脚、按行变化；编辑状态下页脚仍是保存 / 取消。

## 只记录

### S10 · TECH-063：没有 `$batch`（只记录）

- **现象**：成批动作一行发一个请求，丢掉了“一次确认、逐张报结果”的做法。
- **本项目现在怎么绕**：成批的事用表格工具栏的自定义按钮，调本项目的 Server Action。暂不要求补，记下来供排期参考。

### S11 · TECH-064：服务端没有无绑定的动作（只记录）

- **现象**：smart-kit-server 只支持绑定动作。
- **本项目现在怎么绕**：新建按钮放页头，打开对象页的新建模式（`create`）。暂不要求补。

### S12 · TECH-065：`afterRead` 是同步的（只记录）

- **现象**：`afterRead` 只能放纯函数算的显示字段，不能查库。
- **本项目现在怎么绕**：要查库才能写出来的字段（如用户页的“看不到发票”）用自定义列，按当前页的行调本项目的查询。暂不要求补。
