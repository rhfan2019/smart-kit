# ADR-007 npm workspaces

- **决定**：npm 11 workspaces，所有依赖锁定精确版本。
- **理由**：沿用参考项目；不引入 pnpm 等额外工具。
- **代价**：依赖提升可能掩盖漏写的依赖。所以每个包的 `package.json` 都要显式列出用到的依赖，由 ESLint 的 `import/no-extraneous-dependencies` 等价检查脚本验证。
- **状态**：采纳。
