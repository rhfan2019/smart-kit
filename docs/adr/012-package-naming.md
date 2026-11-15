# ADR-012 包名与改名脚本

- **决定**：
  - 包名：`@rhfan2019/smart-kit`、`@rhfan2019/smart-kit-core`。
  - 改名脚本：`node scripts/rename-scope.mjs <新 scope>`。它替换所有 `package.json`、源码 import、文档里的旧 scope，然后运行 `npm install` 更新锁文件。
  - 不发布到 npm。
- **理由**：`package.json` 和 import 语句无法引用常量（v5 第 8 节）。
- **代价**：改名是一次性的大范围替换，需要单独提交。脚本有 `--dry-run` 选项，先列出将要修改的文件。
- **状态**：采纳。
