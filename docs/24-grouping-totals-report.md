# 24 分组、小计和总计验收报告

> 状态：现行 · 2026-11-17。方案和验收条目见 `23-grouping-totals-plan.md`（第 7 节条目，第 8 节实施时的调整），决定见 ADR-031，讨论记录 D28。截图在 `24-evidence/`（`E2E_EVIDENCE=1` 时生成）。代码未提交。

## 1. 范围

- 两种表格：个性化对话框的"合计"页；表尾总计（网格表格是底部固定行，响应式表格是吸底行），按币种分行。
- 响应式表格：单级分组只能选 `GroupableProperties`；组标题显示条数和组小计；续载时只请求新出现的组。
- 默认值来自 `UI.PresentationVariant` 的 `Total`、`GroupBy`；分组和合计保存进视图。
- 数值全部由服务端 `$apply` 计算；smart-kit-server 新增 `$count as`。

## 2. 检查结果

| 检查 | 结果 |
| --- | --- |
| 类型检查 `npm run typecheck` | 通过 |
| lint（含令牌检查、商标检查）`npm run lint` | 通过 |
| 单元测试 `npm test` | 26 个文件、387 个测试全部通过（新增 `packages/core/test/totals.test.ts`；server 的解析器、SQL、一致性测试各加了 `$count as` 和合计请求） |
| 端到端 `npm run e2e`（内存测试服务） | 206 个全部通过（新增 `tests/e2e/p5-totals.spec.ts` 9 个） |
| 端到端 `npm run e2e:pg`（PostgreSQL） | 149 个全部通过（`p5-totals.spec.ts` 也在 PostgreSQL 上跑） |
| 可追溯 `npm run trace -- --strict` | 一期 33/33、72/72；二期 143/143；三期 58/58；卡片 27/27；分组和合计 9/9 |
| API 参考 `node scripts/gen-agent-docs.mjs --check` | 最新 |
| 体积 `npm run size`（gzip） | core 23.7 KB（预算 60）；`/table` 35.5 KB（预算 36）；`styles.css` 含令牌 16.0 KB（预算 16，余 30 字节） |

## 3. 逐条结果

| 编号 | 结果 | 测试 | 截图 |
| --- | --- | --- | --- |
| GT-01 | 通过 | `totals.test.ts`、`p5-totals.spec.ts` | [GT-01](24-evidence/GT-01.png) |
| GT-02 | 通过（网格和响应式；滚动续载后总计不变） | `p5-totals.spec.ts` | [GT-02](24-evidence/GT-02.png) |
| GT-03 | 通过（EUR、USD 分两行） | `totals.test.ts`、`p5-totals.spec.ts` | [GT-03](24-evidence/GT-03.png) |
| GT-04 | 通过（条数和小计与逐行相加的结果一致） | `p5-totals.spec.ts` | [GT-04](24-evidence/GT-04.png) |
| GT-05 | 通过（每次最多 50 个组值，没有组被请求两次） | `totals.test.ts`、`p5-totals.spec.ts` | — |
| GT-06 | 通过（选项是"不分组、供应商、状态、订单类型"） | `totals.test.ts`、`p5-totals.spec.ts` | — |
| GT-07 | 通过（另存视图、切回"标准"、再切回） | `totals.test.ts`、`p5-totals.spec.ts` | — |
| GT-08 | 通过（改筛选、删除后刷新；合计请求失败显示"–"，提示里有错误信息） | `p5-totals.spec.ts` | — |
| GT-09 | 通过（中文、暗色、紧凑；网格合计行随币种数变高） | `p5-totals.spec.ts` | [响应式](24-evidence/GT-09-responsive.png)、[网格](24-evidence/GT-09-grid.png) |

## 4. 过程中发现并处理的问题

| 问题 | 处理 |
| --- | --- |
| fe-mockserver 对字符串键做 `countdistinct` 返回拼接字符串 | 改用标准的 `$count as`，smart-kit-server 补上支持 |
| 续载时第一批组被整批重取，已显示的小计闪掉 | 只请求还没请求过的组；合计查询 `staleTime` 60 秒，刷新靠 `revision` |
| 切回"标准"视图分组不清 | 传了 `onGroupByChange` / `onTotalsChange` 时完全受控 |
| 吸底合计行被下面行的星级评分盖住 | 合计行 `z-index: 2` |
| 已有 e2e 把合计请求当成列表请求、把固定行当成数据行（AC-DATA-08、P2-LRC-11） | 测试辅助函数排除固定行和 `$apply` 请求；合计行等第一批数据出来再显示 |
| smart-kit-server 把查询串里的 `+` 当字面字符（Playwright `params` 用 `+` 表示空格） | 测试里自己编码 URL；服务端行为未改（见第 5 节） |

## 5. 未做和遗留

- 网格表格的分组、多级分组、导出带小计：按方案不做。
- CI（Linux）的截图基准 `tests/e2e/__screenshots__/linux/list-*.png` 没有在本机重新生成；列表页现在多了合计行，本机（darwin）基准在 2% 阈值内通过，Linux 上需要 CI 确认，超出时要更新基准。
- smart-kit-server 不把查询串里的 `+` 解码成空格（fe-mockserver 会）：表单编码的调用方会得到 400。是否要兼容，待决定。
