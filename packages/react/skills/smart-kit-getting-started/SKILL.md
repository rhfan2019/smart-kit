---
name: smart-kit-getting-started
description: Build a new smart-kit app or add an entity to one — PostgreSQL tables → CSDL with smart-kit-cli → hand-written annotations → OData V4 service with smart-kit-server → React list page and object page with @rhfan2019/smart-kit. Use when starting a project with smart-kit, adding a table / entity to a smart-kit service, or when a smart-kit page shows nothing.
---

# smart-kit: from tables to a running list page and object page

Follow the steps in order; each ends with a check. Read `../../docs/README.md` (front end),
`node_modules/@rhfan2019/smart-kit-server/docs/README.md` and `node_modules/@rhfan2019/smart-kit-cli/docs/README.md`
when a step needs more detail. Requirements: Node ≥ 24, PostgreSQL ≥ 15 you may create a database in.

**Safety**: work only in a database (and roles) created for this project. Never change or drop other databases on
the same server.

Layout used below (one repository, two npm projects):

```
my-app/
  server/   smart-kit.config.json, sql/, generated/ (CLI output), annotations/, server.ts
  web/      Vite + React + TypeScript
```

## 1. Database

Create a database and a role for the app, then the tables. Naming conventions that give good OData names without
configuration: snake_case tables and columns; foreign key columns named `<target>_id` (→ navigation `_<Target>`);
items whose primary key contains the parent key (→ collection navigation on the parent); an integer `version`
column for optimistic locking; column comments become labels.

```sql
-- as a superuser (psql -d postgres): a database and roles of this project only
CREATE ROLE shop_app LOGIN PASSWORD 'shop_app';
CREATE DATABASE shop OWNER shop_app;
-- then connected to the new database (psql -d shop -U shop_app):
CREATE SCHEMA shop;
CREATE TABLE shop.customer (
  customer_id varchar(10) PRIMARY KEY,
  name        varchar(80) NOT NULL
);
COMMENT ON COLUMN shop.customer.customer_id IS 'Customer';
COMMENT ON COLUMN shop.customer.name IS 'Customer Name';
CREATE TABLE shop.sales_order (
  order_id    varchar(10) PRIMARY KEY,
  customer_id varchar(10) NOT NULL REFERENCES shop.customer,
  description varchar(120),
  status      varchar(10) NOT NULL DEFAULT 'NEW',
  net_amount  numeric(15,2) NOT NULL DEFAULT 0,
  currency    char(3) NOT NULL DEFAULT 'EUR',
  order_date  date NOT NULL DEFAULT current_date,
  version     integer NOT NULL DEFAULT 1
);
COMMENT ON COLUMN shop.sales_order.order_id IS 'Order';
COMMENT ON COLUMN shop.sales_order.customer_id IS 'Customer';
COMMENT ON COLUMN shop.sales_order.net_amount IS 'Net Amount';
CREATE TABLE shop.sales_order_item (
  order_id varchar(10) NOT NULL REFERENCES shop.sales_order ON DELETE CASCADE,
  item_no  integer NOT NULL,
  product  varchar(40) NOT NULL,
  quantity numeric(13,3) NOT NULL,
  PRIMARY KEY (order_id, item_no)
);
INSERT INTO shop.customer VALUES ('C1', 'Acme Corp'), ('C2', 'Bolt Ltd');
INSERT INTO shop.sales_order (order_id, customer_id, description, net_amount) VALUES ('1000', 'C1', 'Laptops', 2400), ('1001', 'C2', 'Cables', 80);
INSERT INTO shop.sales_order_item VALUES ('1000', 10, 'Laptop', 2), ('1000', 20, 'Dock', 2), ('1001', 10, 'Cable', 40);
```

Check: `psql -d shop -U shop_app -c 'select count(*) from shop.sales_order'` prints 2.

## 2. Server project and CSDL

```bash
mkdir -p server && cd server && npm init -y && npm pkg set type=module
npm install @rhfan2019/smart-kit-server @rhfan2019/smart-kit-core
npm install -D @rhfan2019/smart-kit-cli tsx typescript @types/node
```

`server/smart-kit.config.json` (the generated names: types `Customer`, `SalesOrder`, `SalesOrderItem`; sets
`Customers`, `SalesOrders`, `SalesOrderItems`; navigations `_Customer`, `_Order`, and on the order the items — named
`_Items` here instead of the default `_SalesOrderItem`):

```json
{
  "connection": "postgresql://shop_app:shop_app@localhost:5432/shop",
  "schema": "shop",
  "namespace": "Shop",
  "output": { "csdl": "generated/shop.csdl.xml", "storage": "generated/shop.storage.json" },
  "annotations": ["annotations/shop.annotations.xml"],
  "navigations": { "sales_order_item_order_id_fkey": { "toMany": "_Items" } }
}
```

Run `npx smart-kit generate`. Check: it prints `Wrote: generated/shop.csdl.xml, generated/shop.storage.json (3 entity
sets: …)` and reports `annotation file not found` for `annotations/shop.annotations.xml` (you write it next; without
`--strict` that is not an error). Open the CSDL and note the exact property and navigation names — annotations must
use them.

## 3. Annotations

Create `server/annotations/shop.annotations.xml` from the template in `../../docs/annotations.md` § "Annotation file
template", with namespace `Shop`, types `SalesOrder` / `SalesOrderItem`, set `SalesOrders`, the collection
navigation `_Items`, the text path `_Customer/Name`, the value help `CollectionPath` `Customers` (parameter
`CustomerId`), and the ETag:

```xml
<Annotations Target="Shop.Container/SalesOrders">
  <Annotation Term="Core.OptimisticConcurrency">
    <Collection><PropertyPath>Version</PropertyPath></Collection>
  </Annotation>
</Annotations>
```

(add `<edmx:Reference Uri="https://oasis-tcs.github.io/odata-vocabularies/vocabularies/Org.OData.Core.V1.xml"><edmx:Include Namespace="Org.OData.Core.V1" Alias="Core"/></edmx:Reference>`).
Mark what the server computes, so forms do not offer it:

```xml
<Annotations Target="Shop.SalesOrder/Version">
  <Annotation Term="Core.Computed" Bool="true"/>
  <Annotation Term="UI.Hidden" Bool="true"/>
</Annotations>
```
For a status colour see `../../docs/annotations.md` § "Status with a colour".
Check: `npx smart-kit check --strict` prints `Annotations: every target and path exists.`

## 4. Server

`server/server.ts`:

```ts
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createODataService, createPostgresDb, toNodeListener, validationError, type StorageMapping } from '@rhfan2019/smart-kit-server';

const read = (file: string) => readFileSync(new URL(file, import.meta.url), 'utf8');
const { db } = createPostgresDb({ connectionString: process.env.DATABASE_URL ?? 'postgresql://shop_app:shop_app@localhost:5432/shop' });

const service = createODataService({
  basePath: '/odata/shop/',
  metadata: { csdl: read('./generated/shop.csdl.xml'), annotations: [read('./annotations/shop.annotations.xml')] },
  storage: JSON.parse(read('./generated/shop.storage.json')) as StorageMapping,
  db,
  searchFields: { SalesOrders: ['OrderId', 'Description', '_Customer/Name'] },
  entitySets: {
    SalesOrders: {
      creatable: ['CustomerId', 'Description', 'Currency'],
      updatable: ['CustomerId', 'Description'],
      async beforeCreate({ data, db: tx }) {
        const last = await tx.selectFrom('shop.sales_order').select(tx.fn.max('order_id').as('max')).executeTakeFirst();
        data.OrderId = String(Number(last?.max ?? 999) + 1);
        if (!data.CustomerId) throw validationError('Enter a customer.', [{ code: 'REQUIRED', message: 'Enter a customer.', target: 'CustomerId' }]);
      },
    },
    SalesOrderItems: {},
  },
});

createServer(toNodeListener((request) => service.handle(request))).listen(4004, () => {
  console.log('OData service on http://localhost:4004/odata/shop/');
});
```

The server increments `Version` on every write and checks `If-Match`; the front end handles both. Run
`npx tsx server.ts`. Check: `curl -s 'http://localhost:4004/odata/shop/SalesOrders?$top=1&$count=true'`
returns JSON with `"@odata.count":2`; `curl -s http://localhost:4004/odata/shop/\$metadata | grep UI.LineItem`
finds your annotations.

## 5. Front end

```bash
npm create vite@latest web -- --template react-ts && cd web
npm install @rhfan2019/smart-kit @rhfan2019/smart-kit-core react-router \
  @mantine/core @mantine/hooks @mantine/dates dayjs @tanstack/react-query ag-grid-community ag-grid-react
```

`web/vite.config.ts` — proxy the service:

```ts no-check
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/odata': 'http://localhost:4004' } },
});
```

`web/src/index.css`: replace the template's styles with `html, body, #root { height: 100%; margin: 0; }`.

`web/src/main.tsx` — the app setup of `../../docs/README.md` with this service:

```tsx
import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import '@rhfan2019/smart-kit/styles.css';
import './index.css';
import { MantineProvider } from '@mantine/core';
import { loadService, type NavigationAdapter } from '@rhfan2019/smart-kit-core';
import { SmartKitProvider, type ServiceConfig } from '@rhfan2019/smart-kit/context';
import { smartKitCssVariablesResolver, smartKitMantineTheme } from '@rhfan2019/smart-kit/theme';
import { SmartListReport, SmartObjectPage } from '@rhfan2019/smart-kit/templates';
import { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes, useNavigate, useSearchParams } from 'react-router';

function App() {
  const navigate = useNavigate();
  const [services, setServices] = useState<Record<string, ServiceConfig>>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    loadService({ serviceUrl: '/odata/shop/', fetch: (url, init) => fetch(url, init), language: 'en' })
      .then(({ model, provider }) => setServices({ shop: { model, dataProvider: provider } }))
      .catch((e: Error) => setError(e.message));
  }, []);
  const navigation = useMemo<NavigationAdapter>(() => {
    const href = (path: string) => `/object?path=${encodeURIComponent(path)}`;
    return {
      toObject: (path) => navigate(href(path)),
      toList: () => navigate('/'),
      href: (t) => (t.kind === 'object' ? href(t.path) : '/'),
      hasObjectPage: (set) => set === 'SalesOrders' || set === 'SalesOrderItems',
    };
  }, [navigate]);
  if (error) return <p role="alert">{error}</p>;
  if (!services) return <p>Loading…</p>;
  return (
    <SmartKitProvider services={services} locale="en" namespace="shop" navigation={navigation}>
      <Routes>
        <Route path="/" element={<SmartListReport entitySet="SalesOrders" />} />
        <Route path="/object" element={<ObjectRoute />} />
      </Routes>
    </SmartKitProvider>
  );
}

function ObjectRoute() {
  const [params] = useSearchParams();
  const path = params.get('path') ?? '';
  return <SmartObjectPage key={path} path={path} />;
}

createRoot(document.getElementById('root')!).render(
  <MantineProvider theme={smartKitMantineTheme} cssVariablesResolver={smartKitCssVariablesResolver}>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </MantineProvider>,
);
```

Delete the template's `App.tsx` / `App.css` if unused. Run `npm run dev` (server still running). Check in the
browser: the list shows the orders with the columns of `UI.LineItem` and the filter fields of `UI.SelectionFields`;
clicking a row opens the object page with the sections of `UI.Facets` and the items sub-table; "Edit" → change the
description → "Save" works; "Create" asks for the customer (value help) and creates order 1002.

## 6. Let the next agent find the docs

In `server/`: `npx smart-kit agents`. In `web/`: `npm install -D @rhfan2019/smart-kit-cli`, then `npx smart-kit agents`.
It writes the doc index into `AGENTS.md` and `@AGENTS.md` into `CLAUDE.md`; run it again after upgrading smart-kit.
At the repository root (one `AGENTS.md` for both), run it in each project and merge, or point the root file to both.

## Adding an entity later

1. Migration (table + comments) → `npx smart-kit generate --strict`.
2. Annotate it (`UI.HeaderInfo`, `UI.LineItem`, `UI.SelectionFields`, `UI.Facets`; Capabilities on the set).
3. List it in `entitySets` of the server if it is writable.
4. Add a route with `SmartListReport entitySet="…"` and extend `hasObjectPage`.

## If something is off

See `../../docs/pitfalls.md` § "When something does not show up". The most frequent causes: an annotation target or
path with the database name instead of the generated OData name; the entity set missing in `entitySets` (writes
answer 405); a page without height.
