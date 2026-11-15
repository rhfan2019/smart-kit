# 参考应用的查询形状

> 观察日期：2026-11-14。参考应用 Manage Products（SAPUI5 1.154.0，Fiori Elements V4）。
>
> 方法：在页面里拦截 `XMLHttpRequest`，解开 `$batch` 请求体，记录其中的 GET 行。
>
> 按 v5 第 4 节的要求，这里只记录"查询的形状"（用了哪些系统查询选项、怎么组合）。实体名、字段名只为说明形状，不保存任何响应内容。
>
> 本库对应的规则编号见 `05-data-provider.md` 第 2 节。

## 1. 观察到的请求

| # | 操作 | 请求（`$batch` 内的 GET 行，已删除 `HTTP/1.1`） |
| --- | --- | --- |
| A1 | 打开列表页（默认变体自动执行） | `Products?$count=true&$select=ID,IsActiveEntity,category_ID,currency_code,identifier,name,price,rating,thumbnailImage&$orderby=name&$expand=category($select=ID,name),supplier($select=ID,name)&$skip=0&$top=30` |
| A2 | 打开 Category 的值帮助对话框 | `Categories?$select=ID,identifier,name&$count=true&$orderby=identifier&$skip=0&$top=51` |
| A3 | 在值帮助里搜索 "Bat" | `Categories?$select=ID,identifier,name&$count=true&$search=Bat&$skip=0&$top=51` |
| A4 | 搜索框输入 "Pen"，点"执行" | 同 A1，多了 `&$search=Pen` |
| A5 | 在 Price 列头菜单里选降序 | 同 A4，`$orderby=currency_code,price desc` |
| A6 | 进入对象页 | `Products(ID=…,IsActiveEntity=true)?$select=<页头和所有区块表单用到的 20 个字段>&$expand=category($select=ID,name),supplier($select=ID,name)` |
| A7 | 对象页的子表 | `Products(ID=…,IsActiveEntity=true)/reviews?$count=true&$select=ID,date,rating,text,title&$expand=user($select=fullName,user)&$skip=0&$top=10` |

另外两点观察：
- 列表请求**没有**草稿过滤条件。这是一个只读的显示应用，只请求活动版本。
- 结果少于一页（26 条，页大小 30）时，滚动不再发请求。

## 2. 规则对照

| 规则 | 参考应用 | 本库 | 差异与解释 |
| --- | --- | --- | --- |
| Q-01 `$select` 只取所需字段 | A1 只含可见列、文本（经导航）、单位（`currency_code`）、键，加上 `rating`、`supplier` 等注解要求的字段 | 相同：键 + 可见列 + 附属路径 + `RequestAtLeast` | `IsActiveEntity` 是草稿键，一期不做草稿，所以不取 |
| Q-02 文本经导航时用 `$expand(...;$select=…)` | `category($select=ID,name)` | 相同 | — |
| Q-04 `$search` | A4、A3 | 相同；只在 `Searchable` 时发送 | — |
| Q-05 默认排序来自 PresentationVariant | `$orderby=name` | 相同 | — |
| Q-05b 金额列排序时先按币种排序 | `$orderby=currency_code,price desc` | **采用相同规则**：对带 `ISOCurrency` / `Unit` 路径的列排序时，先按单位路径（同方向为升序）再按值 | — |
| Q-06 分页大小 | 响应式表格 30 行一页 | 网格表格每块 100 行 | 一期列表页用网格表格（`adr/002`），网格表格按块加载，块大小与响应式表格不同 |
| Q-06 子表首屏行数 | 10 行 | 10 行，"更多"每次再取 20 行 | 与规范 OP-14"建议初始 10 行"一致 |
| Q-07 `$count=true` | 列表和子表的第一页都带 | 相同 | — |
| Q-08 对象读取 | 一次读取页头和**所有**区块表单字段，子表单独查询 | **采用相同做法** | 原先的设计是"按区块分批读取表单字段"，改为与参考应用一致；按需加载（OP-16）只用于子表 |
| Q-09 值帮助 | 选择全部参数、`$count=true`、按键排序、页大小 51 | 选择全部参数、`$count=true`、按键排序、每页 50 | 51 是 UI5 内部"多取一行判断是否还有"的做法，本库用 `$count` 判断 |
| 子表路径 | `父对象(键)/导航` | 相同 | — |
