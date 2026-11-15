# smart-kit

> SAP、Fiori、SAPUI5 是 SAP SE 的注册商标。本项目与 SAP 无关联，未获任何授权或背书。

元数据驱动、白盒、可换主题的 React 组件库：从 OData V4 的 `$metadata` 与注解生成列表页和对象页的积木，页面由使用者在 JSX 里自己拼。

**状态：一期（只读的列表页、对象页、子对象页）已完成。** 验收结果见 [docs/10-acceptance-report.md](docs/10-acceptance-report.md)，目标与范围见 [docs/prompt/项目目标与范围-v5.md](docs/prompt/项目目标与范围-v5.md)。

## 包

| 包 | 内容 |
| --- | --- |
| `@rhfan2019/smart-kit-core` | 纯 TypeScript：CSDL 与注解解析、模型、查询生成、OData V4 和内存数据提供者、变体与页面状态存储 |
| `@rhfan2019/smart-kit` | React 积木：`SmartFilterBar`、`SmartTable`、`SmartField`、`SmartForm`、`ObjectPageLayout`、`SmartListReport`、`SmartObjectPage` 等；令牌与主题；中英文文案 |

公开 API 见 [docs/api.md](docs/api.md)。

## 最小用法

```tsx
import { loadService } from '@rhfan2019/smart-kit-core';
import { SmartKitProvider, SmartListReport, smartKitMantineTheme, smartKitCssVariablesResolver } from '@rhfan2019/smart-kit';
import '@rhfan2019/smart-kit/styles.css';

const { model, provider } = await loadService({ serviceUrl: '/odata/purchasing/', fetch, language: 'zh' });

<MantineProvider theme={smartKitMantineTheme} cssVariablesResolver={smartKitCssVariablesResolver} forceColorScheme="light">
  <SmartKitProvider services={{ purchasing: { model, dataProvider: provider } }} locale="zh" namespace="my-app" navigation={myAdapter}>
    <SmartListReport entitySet="PurchaseOrders" />
  </SmartKitProvider>
</MantineProvider>
```

导航适配器的写法见 [apps/demo/src/navigation.ts](apps/demo/src/navigation.ts)；主题用根元素的 `data-theme`（`yellow` / `navy` / `dark`）和 `data-density`（`comfortable` / `compact`）切换。

## 开发

需要 Node 24。测试服务是纯 Node（SAP 开源的 `@sap-ux/fe-mockserver-core`，见 `apps/mock`）。

```bash
npm install
```

```bash
npm run mock
```

```bash
npm run dev
```

其余命令（测试、端到端、构建、Storybook）见 [docs/handoff.md](docs/handoff.md)。

## License

MIT
