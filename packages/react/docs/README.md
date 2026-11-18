# smart-kit for coding agents — start here

> Ships inside `@rhfan2019/smart-kit` (`node_modules/@rhfan2019/smart-kit/docs/`) and matches the installed version.
> Read this file first, then the one you need:
>
> | File | What is in it |
> | --- | --- |
> | `docs/recipes.md` | Complete, compiling examples: list page, object page, freestyle page from building blocks, charts, cards, value help, editing (direct save / draft), actions, messages |
> | `docs/annotations.md` | Which OData annotation drives which part of the UI, with an annotation-file template |
> | `docs/pitfalls.md` | Common mistakes and what to do instead |
> | `docs/reference.md` | Generated: every export, its import path, every prop (required or not) with its description |
> | `skills/smart-kit-getting-started/SKILL.md` | Step by step from a PostgreSQL schema to a running list page and object page (CLI, server, front end) |
>
> The server and the CLI have their own `docs/README.md` in `@rhfan2019/smart-kit-server` and `@rhfan2019/smart-kit-cli`.

## What smart-kit is

React building blocks for business list pages and object pages on an **OData V4** service. The UI is driven by the
service's **`$metadata` and its annotations** (OASIS and SAP vocabularies: `UI.LineItem`, `UI.SelectionFields`,
`UI.HeaderInfo`, `UI.Facets`, `Common.Label`, `Common.ValueList`, `Capabilities.*`, …). You do not list columns,
filter fields or form fields in React: you annotate the service, and the components read the annotations. Without
annotations everything is derived (keys and first properties as columns, one form with all properties).

Two levels, use the highest one that fits:

1. **Templates** (`/templates`): `SmartListReport` (filter bar + variant management + table, optional chart) and
   `SmartObjectPage` (header, sections from `UI.Facets`, sub-tables, edit / create / delete, actions). One element per page.
2. **Building blocks**: `SmartFilterBar` + `useFilterState`, `SmartTable`, `SmartField`, `SmartForm`, `ChartView`,
   `MicroChart`, `DynamicPage`, `ObjectPageLayout`, cards (`/cards`), value help, messages — for pages the templates
   do not cover. Every block also has hooks (`useListQuery`, `useObject`, `useValueList`, …) for fully custom UI.

It is built on **Mantine 9** (components and theme), **TanStack Query 5** (data), **AG Grid 36** (grid table, optional).
The host app owns routing; smart-kit calls a `NavigationAdapter` you give it.

## Install

```bash
npm install @rhfan2019/smart-kit @rhfan2019/smart-kit-core \
  react react-dom @mantine/core @mantine/hooks @mantine/dates dayjs @tanstack/react-query
# only if you use the grid table (SmartTable mode "grid", SmartListReport, SmartObjectPage):
npm install ag-grid-community ag-grid-react
```

Styles, once, in this order (in the entry file):

```ts
import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import '@rhfan2019/smart-kit/styles.css';
```

With CSS cascade layers (Tailwind 4, Mantine's layered styles), import `@rhfan2019/smart-kit/styles.layered.css`
instead: the same rules inside `@layer smart-kit`; declare the order of your layers and any unlayered host rule wins.
See `docs/recipes.md` § 14.

## App setup (copy this)

Every smart-kit component must be inside `MantineProvider` (with the smart-kit theme) and `SmartKitProvider` (with
the loaded services). `loadService` fetches `$metadata` and builds the model; render nothing until it resolves.

```tsx
import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import '@rhfan2019/smart-kit/styles.css';
import { MantineProvider } from '@mantine/core';
import { loadService, type NavigationAdapter } from '@rhfan2019/smart-kit-core';
import { SmartKitProvider, type ServiceConfig } from '@rhfan2019/smart-kit/context';
import { smartKitCssVariablesResolver, smartKitMantineTheme } from '@rhfan2019/smart-kit/theme';
import { SmartListReport, SmartObjectPage } from '@rhfan2019/smart-kit/templates';
import { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes, useNavigate, useSearchParams } from 'react-router';

// The OData service root, e.g. served by @rhfan2019/smart-kit-server (proxy /odata to it in vite.config.ts).
const SERVICE_URL = '/odata/purchasing/';

function useServices() {
  const [services, setServices] = useState<Record<string, ServiceConfig>>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    loadService({ serviceUrl: SERVICE_URL, fetch: (url, init) => fetch(url, init), language: 'en' })
      .then(({ model, provider }) => setServices({ purchasing: { model, dataProvider: provider } }))
      .catch((e: Error) => setError(e.message));
  }, []);
  return { services, error };
}

/** Maps smart-kit's navigation requests to routes: one list route and one object route. */
function useNavigation(): NavigationAdapter {
  const navigate = useNavigate();
  return useMemo<NavigationAdapter>(() => {
    const objectHref = (path: string) => `/object?path=${encodeURIComponent(path)}`;
    return {
      toObject: (path) => navigate(objectHref(path)),
      toList: () => navigate('/'),
      href: (target) => (target.kind === 'object' ? objectHref(target.path) : '/'),
      hasObjectPage: (entitySet) => entitySet === 'PurchaseOrders' || entitySet === 'PurchaseOrderItems',
    };
  }, [navigate]);
}

function ObjectRoute() {
  const [params] = useSearchParams();
  const path = params.get('path') ?? '';
  // key: a new page instance per object, so state does not leak between objects
  return <SmartObjectPage key={path} path={path} />;
}

function App() {
  const { services, error } = useServices();
  const navigation = useNavigation();
  if (error) return <p role="alert">{error}</p>;
  if (!services) return <p>Loading…</p>;
  return (
    <SmartKitProvider services={services} locale="en" namespace="my-app" navigation={navigation}>
      <Routes>
        <Route path="/" element={<SmartListReport entitySet="PurchaseOrders" />} />
        <Route path="/object" element={<ObjectRoute />} />
      </Routes>
    </SmartKitProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <MantineProvider theme={smartKitMantineTheme} cssVariablesResolver={smartKitCssVariablesResolver}>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </MantineProvider>,
);
```

Notes:
- The list page and the object page fill their container: give the route a height (e.g. `html, body, #root { height: 100% }`).
- An entity path is the OData key form, e.g. `PurchaseOrders('4500000001')` or
  `PurchaseOrders(PurchaseOrder='4500000001')` — `SmartObjectPage` takes it in `path`; build one with `keyPredicate`
  from core (`` `PurchaseOrders${keyPredicate(type, row)}` ``) when you need it yourself.
- `locale` is `"en"` or `"zh"`. Pass the same language to `loadService` (`language`) for translated labels.
- Several services: put several entries in `services`, name one with `service="name"` on any component
  (default: `defaultService`, else the first).

## Import paths (UI5 modules and subpaths)

Classes that exist in SAPUI5 are imported by their UI5 module path with the prefix replaced (ADR-033): one module per
class, default export, as in UI5's TypeScript; `sap.fe.*` modules get an extra `v4`:

```tsx
import MessageBox from '@rhfan2019/smart-kit/m/MessageBox'; // sap/m/MessageBox
import MessageStrip, { type $MessageStripSettings } from '@rhfan2019/smart-kit/m/MessageStrip';
import Card from '@rhfan2019/smart-kit/f/Card'; // sap/f/Card
import { ValueState } from '@rhfan2019/smart-kit/ui/core/library'; // sap/ui/core/library
import MessageButton from '@rhfan2019/smart-kit/v4/fe/macros/MessageButton'; // sap/fe/macros/MessageButton
```

Settings types are `$<Class>Settings`, the instance type is the class itself (`useRef<MessageStrip>(null)`). What has
no UI5 counterpart is in `@rhfan2019/smart-kit/kit/<name>` (for example `kit/MessageProvider`, `kit/useMessages`).
`docs/reference.md` lists every module. The parts not yet moved to UI5 paths are still imported from the subpaths
below.

Import from the subpath of the domain. The root entry `@rhfan2019/smart-kit` exports the same names, but then the
bundler also resolves AG Grid; importing only what you use keeps the app small (an app with only `MicroChart`
ships about 5 KB gzip of smart-kit).

| Subpath | Main exports | Needs AG Grid |
| --- | --- | --- |
| `@rhfan2019/smart-kit/context` | `SmartKitProvider`, `useSmartKit`, `useService`, `useMetaModel`, `useText` | no |
| `@rhfan2019/smart-kit/theme` | `smartKitMantineTheme`, `smartKitCssVariablesResolver`, `readToken`, `useThemeTokens` | no |
| `@rhfan2019/smart-kit/i18n` | `createText`, `MESSAGES` | no |
| `@rhfan2019/smart-kit/util` | `applyExtensions`, `usePageState` | no |
| `@rhfan2019/smart-kit/field` | `SmartField`, `FieldEditor`, `CriticalityIcon`, `QuickViewLink` | no |
| `@rhfan2019/smart-kit/filter` | `SmartFilterBar`, `useFilterState`, `ConditionInput`, `ValueHelpDialog`, `AdaptFiltersDialog`, `FilterSummary` | no |
| `@rhfan2019/smart-kit/variants` | `SmartVariantManagement`, `useVariants` | no |
| `@rhfan2019/smart-kit/table` | `SmartTable`, `ResponsiveTable`, `TableP13nDialog`, `useListQuery`, `smartKitGridTheme` | **yes** |
| `@rhfan2019/smart-kit/chart` | `MicroChart`, `SimpleChart`, `ChartView` | no |
| `@rhfan2019/smart-kit/object` | `ObjectPageLayout`, `HeaderFacet`, `AnchorBar`, `SmartForm`, `DraftMarker`, `GenericTag`, `useObject` | no |
| `@rhfan2019/smart-kit/page` | `DynamicPage`, `FlexibleColumnLayout`, `OverflowActions`, `ShareMenu` | no |
| `@rhfan2019/smart-kit/actions` | `useActionRunner`, `isActionAvailable` | no |
| `@rhfan2019/smart-kit/edit` | `CreateDialog`, `useEditStrategy`, `validate` | no |
| `@rhfan2019/smart-kit/templates` | `SmartListReport`, `SmartObjectPage` | **yes** |
| `@rhfan2019/smart-kit/styles.css` | the one stylesheet of all components | — |
| `@rhfan2019/smart-kit/styles.layered.css` | the same stylesheet inside `@layer smart-kit` | — |

`@rhfan2019/smart-kit-core` (no React): `loadService`, `ODataV4Provider`, `MemoryProvider` (tests), `buildModel`,
`keyPredicate`, `ODataVariantStore`, `createSessionPageStateStore`, the types `Row`, `MetaModel`, `NavigationAdapter`,
`FilterState`, `Condition`. `docs/reference.md` lists every export of every subpath.

## Theme, texts

- Colours, spacing and sizes are CSS variables (`--sk-*`). Themes: set `data-sk-theme="yellow" | "navy" | "sky" | "dark"`
  and `data-sk-density="comfortable" | "compact"` on `<html>` or any container (defaults: yellow, comfortable). The
  former `data-theme` / `data-density` still work while `<html>` has no `data-sk-theme` / `data-sk-density`; a host
  that uses `data-theme` for its own themes sets `data-sk-theme="host"` (no built-in theme by that name) on `<html>`,
  so smart-kit ignores it. To use the host app's colours, point the semantic tokens at your variables:
  `:root { --sk-color-link: var(--my-brand); }` (after smart-kit's stylesheet, or unlayered with `styles.layered.css`).
- The React entries start with `'use client'` (all except `/i18n`): in Next.js App Router import them from client
  components; a server component importing one gets a client reference instead of a hooks error.
- Library texts are English and Chinese (`locale`); override any text with `messages` on `SmartKitProvider`.
- Labels of fields come from `Common.Label` in the service (per language from the server), not from React.

## Extending without forking

Templates and blocks take `*Extend` props (`filterExtend`, `tableExtend`, `sectionExtend`) with
`{ id, position: 'before' | 'after' | 'replace' | 'start' | 'end', anchor?, item }` entries; ids are the
model ids (a column is `DataField::<Path>` unless the record has an `ID`, an action `DataFieldForAction::<Namespace.action>`, a section the facet `ID`). To hide a model column or field, annotate it (`UI.Hidden`) or leave it out of `UI.LineItem`; there is no "remove" position. Field rendering can be replaced per type
or property with `renderers` on `SmartKitProvider`. `SmartTable` and `SmartFilterBar` accept children to replace their
default parts. See `docs/recipes.md` § "Freestyle page" and § "Extend a template".
