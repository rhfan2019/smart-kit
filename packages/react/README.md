# @rhfan2019/smart-kit

Metadata-driven React building blocks for business list pages and object pages on **OData V4**. Columns, filters,
forms, value helps, charts and actions come from the service's `$metadata` and annotations (`UI.LineItem`,
`UI.SelectionFields`, `UI.Facets`, `Common.ValueList`, `Capabilities.*`, …); you assemble pages in JSX and extend
them where you need to. Built on Mantine 9, TanStack Query 5 and (optionally) AG Grid 36. English and Chinese texts.

> Not affiliated with SAP SE. It implements the open OData standard and the public annotation vocabularies.

## Install

```bash
npm install @rhfan2019/smart-kit @rhfan2019/smart-kit-core \
  react react-dom @mantine/core @mantine/hooks @mantine/dates dayjs @tanstack/react-query
# optional, for the grid table, ListReport (v4/fe/templates/ListReport) and ObjectPage (v4/fe/templates/ObjectPage):
npm install ag-grid-community ag-grid-react
```

Peer dependencies: `react` / `react-dom` ^19.3, `@mantine/core` / `hooks` / `dates` ^9.8, `dayjs` ^1.11,
`@tanstack/react-query` ^5.107; optional `ag-grid-community` / `ag-grid-react` ^36.3.

## Styles

Once, in the entry file, in this order:

```ts
import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import '@rhfan2019/smart-kit/styles.css';
```

## Minimal example: list page + object page

```tsx
import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import '@rhfan2019/smart-kit/styles.css';
import { MantineProvider } from '@mantine/core';
import { loadService, type NavigationAdapter } from '@rhfan2019/smart-kit-core';
import { SmartKitProvider, type ServiceConfig } from '@rhfan2019/smart-kit/context';
import { smartKitCssVariablesResolver, smartKitMantineTheme } from '@rhfan2019/smart-kit/theme';
import ListReport from '@rhfan2019/smart-kit/v4/fe/templates/ListReport';
import ObjectPage from '@rhfan2019/smart-kit/v4/fe/templates/ObjectPage';
import { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes, useNavigate, useSearchParams } from 'react-router';

function App() {
  const navigate = useNavigate();
  const [services, setServices] = useState<Record<string, ServiceConfig>>();
  useEffect(() => {
    loadService({ serviceUrl: '/odata/shop/', fetch: (url, init) => fetch(url, init), language: 'en' })
      .then(({ model, provider }) => setServices({ shop: { model, dataProvider: provider } }));
  }, []);
  const navigation = useMemo<NavigationAdapter>(() => ({
    toObject: (path) => navigate(`/object?path=${encodeURIComponent(path)}`),
    toList: () => navigate('/'),
    hasObjectPage: () => true,
  }), [navigate]);
  if (!services) return <p>Loading…</p>;
  return (
    <SmartKitProvider services={services} locale="en" namespace="shop" navigation={navigation}>
      <Routes>
        <Route path="/" element={<ListReport contextPath="/SalesOrders" />} />
        <Route path="/object" element={<ObjectRoute />} />
      </Routes>
    </SmartKitProvider>
  );
}

function ObjectRoute() {
  const path = useSearchParams()[0].get('path') ?? '';
  return <ObjectPage key={path} path={path} />;
}

createRoot(document.getElementById('root')!).render(
  <MantineProvider theme={smartKitMantineTheme} cssVariablesResolver={smartKitCssVariablesResolver}>
    <BrowserRouter><App /></BrowserRouter>
  </MantineProvider>,
);
```

Give the page a height (`html, body, #root { height: 100% }`). The service can be any OData V4 service with
annotations, for example one served by [`@rhfan2019/smart-kit-server`](https://www.npmjs.com/package/@rhfan2019/smart-kit-server)
from PostgreSQL.

## Subpaths

Import from the domain's subpath so the bundle contains only what you use (an app with only one micro chart control,
e.g. `suite/ui/microchart/BulletMicroChart`, ships about 3 KB gzip of smart-kit):

`/context` · `/theme` · `/i18n` · `/util` · `/field` · `/filter` · `/variants` · `/table` (AG Grid) · `/chart` ·
`/object` · `/page` · `/actions` · `/edit` · `/messages` · `/templates` (AG Grid) · `/cards` · `/styles.css`

The root entry `@rhfan2019/smart-kit` re-exports everything (and makes the bundler resolve AG Grid).

## Documentation

- In the package, for you and your coding agent: `docs/README.md` (start), `docs/recipes.md`, `docs/annotations.md`,
  `docs/pitfalls.md`, `docs/reference.md` (every export and prop), `skills/smart-kit-getting-started/SKILL.md`.
  `npm install -D @rhfan2019/smart-kit-cli && npx smart-kit agents` points Codex / Claude Code at them via `AGENTS.md`.
- Repository: <https://github.com/rhfan2019/smart-kit> (design records, changelog).

MIT License.
