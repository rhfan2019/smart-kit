# 13 二期验收条目

> 状态：现行 · 2026-11-15。计划见 `12-phase2-plan.md`，结果见 `14-phase2-acceptance-report.md`。
>
> 写法沿用 `07-acceptance.md`：每条一个编号，测试名称里带这个编号，`npm run trace -- --strict` 检查每个编号都有**通过**的测试（读取 Vitest 和 Playwright 的结果文件，见 W9）。
>
> 列说明：
> - **出处**：规范缩写 + 章节 + 示意图编号。[LR] List Report、[OP] Object Page、[DP] Dynamic Page（v1.148，见 `12` 第 1 节）。
> - **验收方式**：E = 端到端（`tests/e2e/p2-*.spec.ts`，连 `apps/mock`）；U = 单元测试；S = 截图证据（`docs/14-evidence/<编号>.png`，端到端测试在 `E2E_EVIDENCE=1` 时生成）；M = 测量（测试里断言的尺寸、位置或请求，结果写进 `14`）。
> - 编号规则：`P2-<区域>-<序号>`；示意图条目的序号就是示意图上的编号（如 `P2-LRC-06a`）。
>
> 不适用的条目（依赖 SAP 平台，v5 第 2 节不做）也列出，并有一条测试证明对应位置的替代做法。

## 1. 列表页 · Components 示意图（[LR] Components，1–11）

| 编号 | 要求 | 出处 | 验收方式 |
| --- | --- | --- | --- |
| P2-LRC-01 | 动态页页头：页头标题和可展开 / 折叠的页头内容 | [LR] Components (1) | E、S |
| P2-LRC-02 | 页头标题：变体管理（或标题）；页头折叠时显示筛选摘要 | [LR] Components (2) | E |
| P2-LRC-03 | 变体管理：整页一个；保存并恢复筛选、所选页签（视图）和所有表格的设置 | [LR] Components (3)、Variant Management | E |
| P2-LRC-04 | 页头工具栏：全局非终结动作。分享按钮打开动作菜单（发送邮件、复制链接）；同类动作收进菜单按钮；不可用的动作隐藏 | [LR] Components (4)、Header Toolbar | E、S |
| P2-LRC-05 | 页头内容：筛选栏 | [LR] Components (5) | E |
| P2-LRC-06a | 页头功能：展开 / 折叠按钮在页头下沿正中；页头展开并且表格有数据时也可见（用户截图反馈） | [LR] Components (6a) | E、S、M |
| P2-LRC-06b | 页头功能：固定 / 取消固定按钮在展开 / 折叠按钮旁边 | [LR] Components (6b) | E、S |
| P2-LRC-07 | 内容区 | [LR] Components (7) | E |
| P2-LRC-08 | 表标题、文字页签或下拉：多视图时表标题后面是内容切换（≤3 个视图用分段按钮，>3 个用下拉）；或者用纯文字页签 | [LR] Components (8)、Multiple Views | E、S |
| P2-LRC-09 | 每个页签一个表工具栏 | [LR] Components (9) | E |
| P2-LRC-10 | 一张或多张表格和 / 或图表；可以只显示图表 | [LR] Components (10)、Simple Content | E、S |
| P2-LRC-11 | 页脚工具栏：有消息时显示消息按钮，点击打开消息弹窗，列出全部消息 | [LR] Components (11)、Footer Toolbar | E、S |

## 2. 列表页 · Actions 示意图（[LR] Actions，1–3）

| 编号 | 要求 | 出处 | 验收方式 |
| --- | --- | --- | --- |
| P2-LRA-01 | 全局动作在页头工具栏：分享；网格表格配"显示 / 隐藏筛选"时它也在这里；终结动作不放在这里 | [LR] Actions (1) | E |
| P2-LRA-02 | 表动作在表工具栏：新建始终可用；依赖选中的动作在没选中或对所选项都不可用时禁用；同类动作收进菜单按钮；无权限的动作隐藏 | [LR] Actions (2)、When to Enable, Disable, or Hide Actions | E、U |
| P2-LRA-03 | 行内动作：放在行内；不可用时隐藏，不禁用 | [LR] Actions (3)、Line Item Actions | E |

## 3. 列表页 · 行为规则

| 编号 | 要求 | 出处 | 验收方式 |
| --- | --- | --- | --- |
| P2-LR-01 | 多视图（内容切换）：同一张表的不同预筛选状态，视图用到的筛选字段不出现在筛选栏；所有视图共用排序和动作 | [LR] Multiple Views | E |
| P2-LR-02 | 多视图（页签）：每个视图一个页签，各自有表工具栏、排序和选择 | [LR] Multiple Views（第二种） | E |
| P2-LR-03 | 多内容：不同实体的表各放一个页签，共用筛选栏，页签显示条数（纯文字页签） | [LR] Multiple Content、Icon Tab Bar | E、S |
| P2-LR-04 | 图表：表格和图表可切换；图表随视图和筛选变化；点图表元素弹出框，"显示明细"下钻 | [LR] Simple Content、Multiple Views、Navigation（下钻） | E、U |
| P2-LR-05 | 响应式表格：滚动到底自动续载（scroll to load） | [LR] Table | E、M |
| P2-LR-06 | 吸顶：页签栏、表工具栏、列头在页面滚动时固定在顶部 | [LR] Sticky Behavior | E、M |
| P2-LR-07 | 响应式表格的列表页：页头随页面滚动折叠（snap on scroll），可以固定 | [LR] Expand / Collapse Behavior | E |
| P2-LR-08 | 响应式表格：点击整行导航；行上显示导航箭头 | [LR] Navigation | E |
| P2-LR-09 | 响应式表格：按 `UI.Importance` 在窄屏隐藏列；"显示明细 / 隐藏明细"把隐藏的列显示在行下方 | [LR] Responsiveness、`01` LR-21、LR-30 | E、S |
| P2-LR-10 | 网格表格只用于桌面和平板：手机宽度时列表页换成响应式表格 | [LR] Responsiveness | E |
| P2-LR-11 | 复制到剪贴板：复制所选行（制表符分隔，列与界面一致） | `01` LR-21 | E |
| P2-LR-12 | 个性化对话框：分组（响应式表格），按分组显示分组标题行 | [LR] Table Toolbar、`01` LR-19 | E |
| P2-LR-13 | 交叉导航：引用其他对象的字段显示为链接，点击打开快速预览 | [LR] Navigation | E、S |
| P2-LR-14 | 部分处理：动作只能处理部分所选项时，先提示"y 个中有 x 个无法处理"和原因，可以继续或取消；执行后才发现的失败用消息提示 | [LR] Partial Processing | E |
| P2-LR-15 | 用对话框新建：少于 8 个必填字段时，表工具栏的"新建"打开对话框；直接保存和草稿两种服务都支持 | [LR] Add/Create Items Using a Dialog | E |
| P2-LR-16 | 工作模式：工作清单模式下不再符合筛选的条目立即消失；连续模式下条目保留、做标记，并显示消息 | [LR] Working Modes | E |
| P2-LR-17 | 草稿列表：筛选栏有"编辑状态"；行上显示草稿标记（"草稿""未保存的修改"） | [LR] Examples（draft handling enabled）、[OP] Unsaved Changes | E |
| P2-LR-18 | 加载新数据时表格处于忙碌状态 | [LR] Filters | E |
| P2-LR-19 | 筛选字段按 `Capabilities.FilterExpressionRestrictions` 限制输入：`SingleValue` 只能一个值（有固定值时是单选下拉），`MultiValue` 只能多个值（无范围、无排除），`SingleRange` 只能一个值或一个范围（日期总是范围选择器），`SearchExpression` 只能搜索模式（纯文字按"包含"）；不允许的输入给出提示且不写入；取值帮助隐藏不允许的操作符、"排除"和"搜索并选择"；请求里从不带不允许的条件 | [LR] Filters、`01` LR-35、ANN-40 | E |

## 4. 对象页 · Components 示意图（[OP] Components，1–8）

| 编号 | 要求 | 出处 | 验收方式 |
| --- | --- | --- | --- |
| P2-OPC-01 | 动态页页头（必选）；显示模式下初始展开 | [OP] Components (1) | E |
| P2-OPC-02 | 导航栏（可选）：锚点或页签 | [OP] Components (2) | E |
| P2-OPC-03 | 内容区：区块和子区块 | [OP] Components (3) | E |
| P2-OPC-04 | Shell bar：由宿主提供，库不渲染；页面在宿主的顶栏下方（不适用项的替代：示例应用的顶栏） | [OP] Components (4) | E |
| P2-OPC-05 | 面包屑：在标题上方，只显示对象页内的下钻层级 | [OP] Components (5) | E |
| P2-OPC-06 | 全局动作：编辑、删除、业务动作在页头工具栏（文字按钮）；分享是图标；放不下时从右往左进溢出菜单 | [OP] Components (6)、Guidelines · Actions | E、S、M |
| P2-OPC-07 | 页头内容：Facet 从左往右排，放不下换行 | [OP] Components (7) | E |
| P2-OPC-08 | 页脚工具栏：终结动作（编辑 / 新建模式下保存、取消；显示模式下审批、拒绝） | [OP] Components (8)、Footer Toolbar | E、S |

## 5. 对象页 · 锚点栏示意图（[OP] Anchor Bar Navigation，1–11）

| 编号 | 要求 | 出处 | 验收方式 |
| --- | --- | --- | --- |
| P2-OPA-01 | 当前锚点：高亮，`aria-current` | [OP] 锚点栏图 (1) | E、S |
| P2-OPA-02 | 非当前锚点 | [OP] 锚点栏图 (2) | E |
| P2-OPA-03 | 子区块下拉：有多个子区块的锚点打开子区块菜单 | [OP] 锚点栏图 (3) | E |
| P2-OPA-04 | 子区块：菜单项点击后滚动到该子区块 | [OP] 锚点栏图 (4) | E |
| P2-OPA-05 | 子区块下拉指示：锚点旁的箭头 | [OP] 锚点栏图 (5) | E |
| P2-OPA-06 | 溢出轮播按钮：锚点放不下时出现左右箭头按钮，横向滚动锚点 | [OP] 锚点栏图 (6)、Overflow | E、S |
| P2-OPA-07 | 溢出菜单按钮：锚点栏右侧 | [OP] 锚点栏图 (7) | E |
| P2-OPA-08 | 溢出菜单：分层列出全部区块和子区块 | [OP] 锚点栏图 (8) | E、S |
| P2-OPA-09 | 溢出菜单里的区块（悬停）：悬停时有背景 | [OP] 锚点栏图 (9) | E、M |
| P2-OPA-10 | 溢出菜单里的区块：点击滚动到区块标题 | [OP] 锚点栏图 (10) | E |
| P2-OPA-11 | 溢出菜单里的子区块：缩进；点击滚动到子区块 | [OP] 锚点栏图 (11) | E |

## 6. 对象页 · 页签示意图（[OP] Tab Navigation，1–3）

| 编号 | 要求 | 出处 | 验收方式 |
| --- | --- | --- | --- |
| P2-OPT-01 | 页签导航：页签横排、始终可见；页签可带条数；有子区块时页签旁有下拉箭头（子导航默认开启） | [OP] 页签图 (1)、Subnavigation | E、S |
| P2-OPT-02 | 第一个子区块：页签内容里显示子区块标题，不显示区块标题 | [OP] 页签图 (2) | E |
| P2-OPT-03 | 第二个子区块：同上，依次排列 | [OP] 页签图 (3) | E |

## 7. 对象页 · 行为规则

| 编号 | 要求 | 出处 | 验收方式 |
| --- | --- | --- | --- |
| P2-OP-01 | 对象标记：草稿和"未保存的修改"图标在标题右侧 | [OP] Dynamic Page Header、Unsaved Changes | E |
| P2-OP-02 | 表单 Facet：值可以是链接（快速预览） | [OP] Form Facet | E |
| P2-OP-03 | 纯文本 Facet：标题可选；默认宽 320px；文本可以内嵌链接 | [OP] Plain Text Facet | E、M |
| P2-OP-04 | 微图表 Facet：标题、副标题、图表、页脚（单位）；支持 Bullet、Column、Line、Comparison、Delta、Harvey Ball、Radial 七种；图表可点击。（三期按 SAP 规范修订，见 `15-research-micro-chart.md`） | [OP] Micro Chart Facet | E、U、S |
| P2-OP-05 | 进度 Facet：标题、副标题、进度条、页脚 | [OP] Progress Indicator Facet | E |
| P2-OP-06 | 评分 Facet：单个评分（标题、副标题、评分）和汇总评分（副标题是样本数，页脚 "x.x out of y"） | [OP] Rating Indicator Facet | E、U |
| P2-OP-07 | 关键值 Facet：状态文本右侧带图标 | [OP] Key Value Facet | E |
| P2-OP-08 | 锚点栏小屏变下拉（分层列出区块和子区块）；页签小屏用横向轮播，不变成下拉 | [OP] Anchor Bar · Responsiveness、Tab Navigation | E |
| P2-OP-09 | 标题样式：单表区块的表标题用 H3 样式（区块里还有其他内容时 H4）；子区块里表单的标题用 H5 样式 | [OP] Title Styles with Anchor Bar Navigation | E、M |
| P2-OP-10 | 表单字段按 `UI.Importance` 在小屏隐藏（未注解按 High，总是显示） | [OP] Forms within the Object Page | E、U |
| P2-OP-11 | 布局块：占 1 / 2 / 3 列，列不够时占可用列；块可以用"显示更多 / 显示更少" | [OP] Blocks | E、M |
| P2-OP-12 | 子表多于 200 条：只预览 20 行，表下方右对齐 "Show All (x)" 链接，打开只有这张表的页面 | [OP] Tables · Navigation to Another Page | E |
| P2-OP-13 | 页签模式下，表是页签里唯一或最后一个元素时，表格滚动加载 | [OP] Tables · Tab Navigation | E |
| P2-OP-14 | 子对象页的分页按钮（上一条 / 下一条）在布局动作区，在同级子对象之间切换 | [OP] Representation of Child Pages | E |
| P2-OP-15 | 编辑：点"编辑"切到编辑模式，内容位置不变；页脚出现"保存""取消" | [OP] Edit、Footer Toolbar | E、M |
| P2-OP-16 | 编辑模式初始焦点：第一个空的必填字段；没有必填字段时第一个可编辑元素 | [OP] Initial Focus | E |
| P2-OP-17 | 直接保存：PATCH 带 ETag；对象被别人改过时提示冲突，不覆盖 | v5 第 3.2 节、ADR-018 | E、U |
| P2-OP-18 | 草稿：编辑时创建草稿，修改在后台自动保存；"保存"激活草稿；"放弃草稿"恢复活动版本 | [OP] Unsaved Changes、v5 第 3.2 节 | E、U |
| P2-OP-19 | 未保存修改：标题右侧的图标，点击弹出框说明谁在何时修改，点外面或关闭按钮关闭 | [OP] Unsaved Changes | E、S |
| P2-OP-20 | 全局编辑时临时"页头"区块：可编辑的页头字段移到所有区块之前的"页头"区块 | [OP] Editing header content in Global Edit mode | E |
| P2-OP-21 | 部分编辑：页头的"编辑页头"按钮打开对话框，只编辑页头字段 | [OP] Editing header content in Partial Edit mode | E |
| P2-OP-22 | 子对象行内新建：子表工具栏"添加"在表首插入新行；Ctrl+Enter 同样 | [OP] Create and edit subobjects | E |
| P2-OP-23 | 子对象对话框：少于 8 个字段的子对象用对话框新建 | [OP] Create and edit subobjects | E |
| P2-OP-24 | 删除：显示模式的删除先弹确认对话框；确认后删除并回到列表 | [OP] Edit Actions in Display Mode、`12` U-15 | E |
| P2-OP-25 | 新建模式：标题显示 "New <对象名>" 占位，输入标识后换成实际值 | [OP] Create | E |
| P2-OP-26 | 页脚：显示模式下的终结动作（审批、拒绝），不可用时隐藏 | [OP] Footer Toolbar | E |
| P2-OP-27 | 编辑模式的消息弹窗：校验错误汇总在页脚消息按钮；点消息定位到字段 | [OP] In Edit Mode | E |
| P2-OP-28 | 显示模式的消息：通用标签（KPI / 情况）、对象状态；消息条（一期已有）不和对象状态重复 | [OP] Message Handling | E |
| P2-OP-29 | 逐步加载：区块显示忙碌占位；"显示更多"里的内容只在点开时渲染 | [OP] Loading Behavior | E |
| P2-OP-30 | 动态侧边内容：开关在页头；打开后占右侧；里面只放上下文信息，不放终结或全局动作 | [OP] Dynamic Side Content、`12` U-14 | E |

## 8. 动态页 · 示意图（[DP]）

| 编号 | 要求 | 出处 | 验收方式 |
| --- | --- | --- | --- |
| P2-DPI-01 | 页头（可折叠部分） | [DP] Intro (1) | E |
| P2-DPI-02 | 页面内容 | [DP] Intro (2) | E |
| P2-DPI-03 | 页脚工具栏（可选，终结动作） | [DP] Intro (3) | E |
| P2-DPC-01a | 页头标题 | [DP] Components (1a) | E |
| P2-DPC-01b | 可展开 / 折叠的页头内容 | [DP] Components (1b) | E |
| P2-DPC-02 | 标题 | [DP] Components (2) | E |
| P2-DPC-03 | 副标题 / 摘要 | [DP] Components (3) | E |
| P2-DPC-04 | 关键信息 / KPI | [DP] Components (4) | E |
| P2-DPC-05 | 全局动作 | [DP] Components (5) | E |
| P2-DPC-06a | 页头功能：展开 / 折叠 | [DP] Components (6a) | E |
| P2-DPC-06b | 页头功能：固定 / 取消固定 | [DP] Components (6b) | E |
| P2-DPC-07 | 页面内容 | [DP] Components (7) | E |
| P2-DPC-08 | 页脚工具栏 | [DP] Components (8) | E |
| P2-DPT-01 | 标题在标题栏左侧，始终可见；可以是文本、链接或变体管理 | [DP] Header Title (1) | E |
| P2-DPT-02 | 副标题 / 摘要在标题下方；列表页折叠时显示筛选摘要 | [DP] Header Title (2) | E |
| P2-DPT-03 | 面包屑在标题上方；弹性分栏里只在全屏单列时显示 | [DP] Header Title (3) | E |
| P2-DPT-04 | 关键信息在中部、左对齐 | [DP] Header Title (4) | E、M |
| P2-DPT-05 | 全局动作在右侧；页头折叠时同样可用，不隐藏不禁用 | [DP] Header Title (5) | E |
| P2-DPT-06 | 布局动作（关闭、全屏、退出全屏）：页面宽度 ≥ 1280px 时在全局动作右侧同一行，有分隔线；< 1280px 时在全局动作上方单独一行；总在最右，不进溢出 | [DP] Header Title (6)、Responsiveness | E、M |
| P2-DPH-01 | 页头内容：没有页头内容时自动隐藏，标题栏不可交互（不响应点击和滚动），没有展开 / 折叠按钮 | [DP] Header Content (1) | E |
| P2-DPH-02 | 页头功能：页头内容底部两个图标按钮（展开 / 折叠、固定 / 取消固定） | [DP] Header Features (1–2) | E、S |
| P2-DPF-01 | 页脚工具栏：只放关闭或终结动作 | [DP] Footer Toolbar | E |
| P2-DPL-01 | 弹性分栏：每一列都有自己的动态页（列 1、2、3） | [DP] Combining with FCL (1–3) | E、S |

## 9. 动态页 · 行为规则

| 编号 | 要求 | 出处 | 验收方式 |
| --- | --- | --- | --- |
| P2-DP-01 | 初始展开；启动时没有查询（内容为空）时必须展开 | [DP] Starting in Expanded or Collapsed Mode | E |
| P2-DP-02 | 滚动折叠：向下滚动时页头内容滚走，标题栏切换到折叠状态并固定；向上滚动时展开 | [DP] Snap on Scroll | E |
| P2-DP-03 | 点击折叠：点标题栏上没有可交互元素的地方切换；鼠标是手形；标题栏和展开 / 折叠按钮都有悬停效果 | [DP] Snap on Click | E、M |
| P2-DP-04 | 固定：滚动时保持展开；点"折叠"会取消固定并折叠 | [DP] Pinning the Header Content | E |
| P2-DP-05 | 手机上不提供固定；页头超过屏幕 60% 时也不提供 | [DP] Pinning the Header Content | E |
| P2-DP-06 | 特例：页面不能滚动（网格表格占满）时，不做滚动折叠 | [DP] Special Case | E |
| P2-DP-07 | 键盘：Tab 进入页头时展开、离开页头内容时折叠；F6 从页头之前跳到标题栏并展开；在页头内容里按 F6 跳出页头并折叠；Shift+F6 反向 | [DP] Keyboard Interaction | E |
| P2-DP-08 | 响应式：标题和副标题折叠时截断、展开时换行；折叠时最多 2 行 | [DP] Responsiveness | E、M |
| P2-DP-09 | 全局动作放不下时从右往左进溢出菜单；关键信息尽量保留 | [DP] Responsiveness | E、M |
| P2-DP-10 | Letterboxing：开启时内容最宽 1280px | [DP] Responsiveness | E、M |
| P2-DP-11 | 摘要行：手机上页头折叠后只显示标题和右侧箭头按钮；点它展开和折叠整个页头 | [DP] Summary Line | E |

## 10. 弹性分栏

| 编号 | 要求 | 出处 | 验收方式 |
| --- | --- | --- | --- |
| P2-FCL-01 | 列表页在第一列；点行在第二列打开对象页；子表行在第三列打开子对象页 | [LR] Components、[DP] FCL、`01b` NAV-07 | E、S |
| P2-FCL-02 | 布局动作：全屏、退出全屏、关闭；总在最右 | [DP] Header Title (6) | E |
| P2-FCL-03 | 面包屑只在全屏单列时显示 | [DP] Header Title (3) | E |
| P2-FCL-04 | 分页按钮（上一条 / 下一条）在布局动作区，在列表的相邻条目之间切换 | [DP] Header Title Guidelines、[OP] Child Pages | E |
| P2-FCL-05 | 列宽：两列时 1/3 + 2/3；三列时中间列最宽；窄屏只显示最后一列 | 规范未写比例，按 UI5 弹性分栏的默认值 | E、M |

## 11. 通用

| 编号 | 要求 | 出处 | 验收方式 |
| --- | --- | --- | --- |
| P2-GEN-01 | 新增的界面文字中英文都有，切换语言后没有另一种语言的残留 | v5 第 6.8 节 | E、U |
| P2-GEN-02 | axe：二期新增的页面（编辑、草稿、多视图、响应式表格、弹性分栏）零违规 | v5 第 6.9 节 | E |
| P2-GEN-03 | 新增组件不出现颜色、间距、字号字面量；三套主题下都可用 | v5 第 6.7 节 | C、E |
| P2-GEN-04 | 库仍不读写 `window.location`、`history`；弹性分栏的列状态由宿主路由决定 | v5 第 6.10 节 | U、E |
| P2-GEN-05 | 编辑策略是可插拔的接口：直接保存和草稿两种实现，按模型自动选择，使用者可以替换 | v5 第 3.2 节、6.4 节 | U |
| P2-GEN-06 | 注解覆盖矩阵（`02`）里标"二期"的术语都有测试 | `02` | U |
| P2-GEN-07 | 公开 API 只导出 `api.md` 列出的名字；新增积木都有 Storybook 故事 | AC-Q-03、AC-Q-05 | U、C |
| P2-GEN-08 | 包体积仍在预算内 | AC-Q-02 | C |
