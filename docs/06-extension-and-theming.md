# 06 扩展点、主题令牌与路由隔离

> 状态：现行 · 2026-11-14。

## 1. 扩展机制总览

| 机制 | 写法 | 用途 |
| --- | --- | --- |
| 复合部件 | `<SmartTable><SmartTable.Toolbar>…</SmartTable.Toolbar></SmartTable>` | 写出来就覆盖这个部件的默认渲染；不写就自动渲染。部件内部可以再用默认子部件拼装（如 `<SmartTable.Title/>`） |
| 按 id 寻址 | `extend={[{ id: 'DataField::Price', position: 'replace', render: … }]}` | 替换由模型生成的某一项，不影响其余 |
| 插入位置 | `extend={[{ id: 'MyCol', position: 'after', anchor: 'DataField::Name', column: {…} }]}` | 在某个 id 之前或之后插入；`position: 'start' \| 'end'` 时不需要 `anchor` |
| 上下文 hook | `useTableContext()`、`useObjectContext()`、`useFilterBarContext()` | 自定义内容拿到数据、选中行、刷新方法、当前筛选 |
| 类型注册表 | `<SmartKitProvider renderers={{ currency: MyCurrency, 'criticality': MyStatus, 'type:Edm.Date': MyDate, 'custom:rating': … }}>` | 单元格和字段按类型替换渲染器 |
| 无界面 hook | 见 `03-component-inventory.md` 第 6 节 | 完全不用默认界面 |
| 受控 / 非受控 | `filters` + `onFiltersChange`，或 `defaultFilters` | 状态外置 |

`extend` 里的锚点 id 找不到时：
- 开发模式下在控制台打印警告；
- 插入项放到末尾（`after` 和 `end`）或开头（`before` 和 `start`）。

## 2. 扩展点清单

| 积木 | 部件（复合） | 可替换（按 id） | 可插入 | 注入的上下文 |
| --- | --- | --- | --- | --- |
| `DynamicPage` | `.Title`（`.Heading`、`.Actions`、`.Summary`）、`.Header`、`.Content`、`.Footer` | — | 标题区动作（`.Actions` 里自由放） | `useDynamicPage()`：`headerExpanded`、`toggleHeader`、`pinned` |
| `SmartFilterBar` | `.Search`、`.Fields`、`.Actions`（"执行"和"适配筛选"） | 筛选字段（属性路径为 id） | 筛选字段（自定义字段，带自己的条件编辑器）；`.Actions` 前的自定义按钮 | `useFilterBarContext()`：`filters`、`setFilters`、`search`、`go` |
| `SmartVariantManagement` | — | — | — | `useVariants()` |
| `SmartTable` | `.Toolbar`、`.Title`、`.Actions`、`.Settings`、`.Export`、`.NoData`、`.Error` | 列（`DataField::…`） | 列；工具栏动作（`extend` 的 `action` 项，位置相对于其他动作 id） | `useTableContext()`：`rows`（已加载）、`selected`、`refresh`、`filters`、`search`、`sort` |
| `SmartField` | — | — | — | 渲染器收到 `{ value, row, property, mode, onChange }` |
| `SmartForm` | — | 表单字段（id 同列） | 表单字段 | `useObjectContext()` |
| `ObjectPageLayout` | `.Header`、`.Sections`、`.Footer` | 区块和子区块（Facet id） | 区块（相对于区块 id）；子区块（相对于子区块 id） | `useObjectContext()`：`data`、`path`、`refresh`、`mode` |
| `ObjectPageHeader` | `.Title`、`.Actions`、`.Facets`、`.MessageStrip`、`.Breadcrumbs` | 页头 Facet（Facet id） | 页头 Facet；页头动作 | `useObjectContext()` |
| `Section` / `SubSection` | `.MessageStrip`、`.Actions` | — | 子区块里的自定义内容 | `useObjectContext()` |
| `SmartListReport` / `SmartObjectPage`（模板） | 透传以上全部 `extend` 和部件 | 同上 | 同上 | 同上 |

## 3. 令牌（三层）

所有令牌都定义在 `packages/react/src/theme/tokens.css`，前缀 `--sk-`。组件代码只引用**语义层**或**组件层**，不引用原始值。

### 3.1 原始值（色板，无语义）

| 令牌 | 说明 |
| --- | --- |
| `--sk-yellow-50 … --sk-yellow-900` | 明黄色阶 |
| `--sk-navy-50 … --sk-navy-900` | 海军蓝色阶（不是 SAP 蓝；色相偏紫的深蓝 `#1f2a5a` 系） |
| `--sk-ink-0 … --sk-ink-1000` | 中性暖灰，从白到墨黑 |
| `--sk-green-*`、`--sk-red-*`、`--sk-amber-*`、`--sk-blue-*` | 状态色色阶 |
| `--sk-font-sans` | `Inter, "PingFang SC", "Microsoft YaHei", system-ui, sans-serif` |
| `--sk-radius-1 … 4`、`--sk-space-1 … 8`、`--sk-font-size-1 … 7`、`--sk-shadow-1 … 3` | 尺寸刻度 |

### 3.2 语义层（组件默认引用这一层）

| 类别 | 令牌 |
| --- | --- |
| 表面 | `--sk-color-page`、`--sk-color-surface`、`--sk-color-surface-2`（表头、次级面板）、`--sk-color-surface-raised`（弹层） |
| 文字 | `--sk-color-text`、`--sk-color-text-muted`、`--sk-color-text-subtle`、`--sk-color-text-on-primary`、`--sk-color-link` |
| 交互 | `--sk-color-primary`、`--sk-color-primary-hover`、`--sk-color-accent`（选中下划线、当前锚点）、`--sk-color-accent-wash`（选中行底）、`--sk-color-hover`、`--sk-color-focus` |
| 边框 | `--sk-color-border`、`--sk-color-border-strong` |
| 状态 | `--sk-color-positive / -wash`、`--sk-color-critical / -wash`、`--sk-color-negative / -wash`、`--sk-color-info / -wash`、`--sk-color-neutral / -wash` |
| 尺寸 | `--sk-control-height`、`--sk-row-height`、`--sk-header-row-height`、`--sk-space-page-x`、`--sk-space-section`、`--sk-space-field`、`--sk-radius-control`、`--sk-radius-panel` |
| 文字刻度 | `--sk-text-page-title`、`--sk-text-object-title`、`--sk-text-section-title`、`--sk-text-body`、`--sk-text-label`、`--sk-text-kpi` |

### 3.3 组件层（局部微调入口）

| 令牌 | 默认 |
| --- | --- |
| `--sk-table-header-bg` | `var(--sk-color-surface-2)` |
| `--sk-table-row-selected-bg` | `var(--sk-color-accent-wash)` |
| `--sk-table-row-hover-bg` | `var(--sk-color-hover)` |
| `--sk-anchor-active-color` | `var(--sk-color-accent)` |
| `--sk-page-header-bg` | `var(--sk-color-surface)` |
| `--sk-facet-kpi-size` | `var(--sk-text-kpi)` |
| `--sk-filterbar-gap` | `var(--sk-space-field)` |

### 3.4 主题与密度

- **主题**：根元素（或任意容器）上的 `data-theme`，只重新定义语义层：

  | 值 | 主色 | 强调色 |
  | --- | --- | --- |
  | `yellow`（默认） | 墨黑 | 明黄 |
  | `navy` | 海军蓝 | 海军蓝的浅色 |
  | `dark` | 深色表面 | 明黄（作为线条和底色） |

- **密度**：`data-density`，`comfortable`（默认）或 `compact`。只重新定义尺寸令牌，例如控件高 32 → 26、行高 36 → 28。
- **Mantine 桥接**：在 `tokens.css` 里把 Mantine 的 CSS 变量（`--mantine-color-body`、`--mantine-color-text`、`--mantine-primary-color-filled` 等）指向语义层。Mantine 的 `forceColorScheme` 不使用，颜色完全由我们的变量决定。
- **AG Grid 桥接**：主题参数全部写成 `var(--sk-…)`，例如 `backgroundColor: 'var(--sk-color-surface)'`。切换主题时不重建表格。
- **JS 里的颜色**：图表、头像等需要在 JS 里用颜色的地方，用 `readToken('--sk-color-accent')` 读取计算后的值；`useThemeTokens()` 在 `data-theme` 变化时（通过 `MutationObserver`）重新读取。
- **检查**：
  - `npm run lint:tokens`：组件的 TS、TSX 和 CSS 里不出现颜色字面量（`#…`、`rgb(`、`hsl(`、颜色名）和像素字面量的间距、字号，只有 `tokens.css` 例外。
  - 对比度测试：读出四个组合下语义文字色和背景色的计算值，校验对比度不低于 4.5:1。

## 4. 文案

- **位置**：`packages/react/src/i18n/messages.zh.ts`、`messages.en.ts`，两者的键集合必须一致（单元测试检查）。
- **用法**：`useText()` 返回 `t(key, params)`。参数用 `{name}` 占位；复数用 `Intl.PluralRules` 选 `key.one` 或 `key.other`。
- **检查**：
  - `smart-kit/no-literal-ui-text` lint 规则：JSX 文本、以及 `title`、`label`、`placeholder`、`aria-label`、`alt` 等属性里不能出现字符串字面量（纯符号和空白除外）。
  - 测试检查 `packages/react/src` 里没有汉字（文案文件除外）。

## 5. 路由隔离

- 库内部不导入任何路由库，用 lint 规则禁止导入 `react-router*`、`@tanstack/*router*`、`next/*`。
- 库不访问 `window.location`、`window.history`，不监听 `popstate` 和 `hashchange`：用 lint 规则 `no-restricted-globals` 和 `no-restricted-properties` 禁止。
- **适配器接口**见 `05-data-provider.md` 第 8 节。
- **示例实现**：`apps/demo/src/navigation.ts` 用 React Router 实现适配器：
  - 列表页：`/po`、`/nw/products`。
  - 对象页：`/po/object?path=<编码后的实体路径>`。
  - 宿主应用自己的其他路由（演示用的 `/about`）在测试里验证不受影响（AC-NAV-06）。
