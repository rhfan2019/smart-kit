# ADR-004 Vite library 模式构建

- **决定**：两个包都用 Vite 8 的 library 模式输出 ESM，`vite-plugin-dts` 输出类型声明；peer 依赖全部 external；样式单独输出 `styles.css`。
- **理由**：与示例应用和 Storybook 用同一套工具链。
- **代价**：不输出 CommonJS；使用者必须用支持 ESM 的打包工具。
- **状态**：采纳；"单一入口"部分被 ADR-026 修订（改为保留源文件结构、按子路径输出）。
