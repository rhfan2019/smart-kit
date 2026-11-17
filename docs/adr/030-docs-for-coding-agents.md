# ADR-030 给 AI 编程工具的文档：随包发布，`AGENTS.md` 索引

- **背景**：用户希望 Codex、Claude Code 等工具在别的项目里准确知道 smart-kit 怎么用（讨论记录 D23、D24）。模型的训练数据里没有本库的 API，靠猜会写出别的组件库的写法。
- **调研**（2026-11-16）：
  - Next.js 16.2 起把与版本对应的文档放进 `node_modules/next/dist/docs/`，项目根目录的 `AGENTS.md` 写一句"写代码前先读这里"。Vercel 的评测（训练数据里没有的 Next.js 16 API）：这种被动上下文通过率 100%，Skill 79%（明确要求调用时），什么都不给 53%。厂商自测，也有研究认为上下文文件可能降低成功率，所以以本库自己的实测（D24）为准。
  - TanStack Intent：把 Agent Skills 放在 `node_modules/<包>/skills/*/SKILL.md` 随包发布，升级包时 Skill 跟着变；还在 alpha。
  - `llms.txt`：给网站用的索引，编程工具不会自动读项目依赖的 `llms.txt`。
  - MCP 服务：要单独安装、运行和维护；Codex 和 Claude Code 都能直接读 `node_modules` 里的文件。
  - TSDoc：编辑器和工具读类型时能看到，但看不出组件之间怎么组合。
- **决定**：
  - 每个包带 `docs/`：`README.md`（手写：做什么、怎么组合、注解、常见错误）和 `reference.md`（`scripts/gen-agent-docs.mjs` 从类型和 TSDoc 生成：每个导出、它的子路径、组件的必填 / 可选属性和说明；`--check` 在 CI 和单元测试里检查是否过期）。React 包另有 `docs/recipes.md`（列表页、对象页、图表、卡片、值帮助、草稿 / 直接保存）、`docs/annotations.md`、`docs/pitfalls.md`。
  - "新项目起步"写成 Agent Skills 格式：`skills/smart-kit-getting-started/SKILL.md`（React 包），从 PostgreSQL 表到能运行的列表页和对象页。不依赖 TanStack Intent，只沿用它的目录约定。
  - `smart-kit agents`（CLI）在使用方项目的 `AGENTS.md` 里写入或更新一段带标记的索引（装了哪些 smart-kit 包、版本、每个包的文档文件），并让 `CLAUDE.md` 用 `@AGENTS.md` 引用它；只改标记之间的内容，可以重复执行。
  - 公开组件的属性补 TSDoc（生成的参考直接用它）。
  - 文档里的代码块必须能编译：`tests/unit/agent-docs.test.ts` 把 `ts` / `tsx` 代码块抽出来，按使用方的导入方式做类型检查（标 `no-check` 的除外）；组件清单与导出一致。
  - 不做 MCP 服务；`llms.txt` 暂不做。
- **理由**：文档跟包的版本一起走，不会和装的版本对不上；`AGENTS.md` 是 Codex 等工具共同的约定，`CLAUDE.md` 的 `@` 引用覆盖 Claude Code；参考部分生成、示例部分编译，文档不会悄悄和代码不一致。
- **代价**：tgz 变大（React 包的文档约 150 KB），但不进使用方的打包产物（ADR-026 管的是打包产物）。手写的指南仍要人维护，靠代码块编译和组件清单测试兜底。
- **状态**：采纳（2026-11-16）。
