# @rhfan2019/smart-kit-server for coding agents

> Ships inside the package (`node_modules/@rhfan2019/smart-kit-server/docs/`). `docs/reference.md` lists every export.
> For the whole flow (database → CLI → server → React pages) follow
> `node_modules/@rhfan2019/smart-kit/skills/smart-kit-getting-started/SKILL.md`.

A **limited OData V4 service on PostgreSQL**, written for what the smart-kit front end sends: reads (`$select`,
`$expand`, `$filter`, `$orderby`, `$top`/`$skip`, `$count`, `$search`, `$apply` with `filter`/`search`/`groupby`/
`aggregate` (`sum`, `min`, `max`, `average`, `countdistinct`, `$count as`)), value helps, `$metadata`, direct save (PATCH with ETag, POST to a set or a collection navigation,
DELETE), bound actions. **Not** supported (answers 501): drafts, `$batch`, deep insert, PUT, functions, `$compute`.
Node only (≥ 24); never import it in browser code.

Layers: URL → AST (chevrotain parser) → query plan (Capabilities, data scope) → SQL (Kysely, every value a parameter,
names only from the metadata). The handler is Web-standard `Request` → `Response`, so it plugs into Node `http`
(`toNodeListener`), Express, Hono, Next.js route handlers, etc.

## Inputs

1. **Generated CSDL** (`generated/<name>.csdl.xml`) and **storage mapping** (`generated/<name>.storage.json`, which
   table and column each entity set and property is) — written by `smart-kit generate` (`@rhfan2019/smart-kit-cli`)
   from the database. Do not edit them; rerun the CLI after schema changes.
2. **Annotation file(s)**, hand-written (`annotations/<name>.annotations.xml`): UI annotations, Capabilities, and the
   declarations of bound actions. See `@rhfan2019/smart-kit` `docs/annotations.md` for a template.
3. Optional **label bundles** per language for `{{label:key}}` placeholders in the annotation file.

## Minimal server

```ts
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createODataService, createPostgresDb, toNodeListener, type StorageMapping } from '@rhfan2019/smart-kit-server';

const read = (file: string) => readFileSync(new URL(file, import.meta.url), 'utf8');

// one pool per process; the role needs SELECT (and INSERT/UPDATE/DELETE for writable sets) on the tables only
const { db } = createPostgresDb({ connectionString: process.env.DATABASE_URL ?? 'postgresql://app@localhost:5432/app' });

const service = createODataService({
  basePath: '/odata/shop/',
  metadata: {
    csdl: read('./generated/shop.csdl.xml'),
    annotations: [read('./annotations/shop.annotations.xml')],
  },
  storage: JSON.parse(read('./generated/shop.storage.json')) as StorageMapping,
  db,
  // $search: which properties each set looks in (default: its string properties; paths may go through navigations)
  searchFields: { Orders: ['OrderNo', 'Description', '_Customer/Name'] },
  // writes are opt-in: only these sets accept POST / PATCH / DELETE (then the Capabilities annotations apply)
  entitySets: { Orders: {}, OrderItems: {} },
});

createServer(toNodeListener((request) => service.handle(request))).listen(4004, () => {
  console.log('http://localhost:4004/odata/shop/$metadata');
});
```

Run TypeScript with `tsx server.ts` (or compile it). In a Vite front end, proxy `/odata` to this port
(`server: { proxy: { '/odata': 'http://localhost:4004' } }`).

## Business rules: hooks

```ts
import { validationError, type EntitySetHooks } from '@rhfan2019/smart-kit-server';

type Ctx = { user: string };

export const orders: EntitySetHooks<Ctx> = {
  // POST may only set these properties (others: 400); keys are assigned below
  creatable: ['Customer', 'Description', 'Currency'],
  updatable: ['Customer', 'Description'],
  async beforeCreate({ data, db }) {
    // `db` is the transaction of this request: a throw anywhere rolls back everything
    const last = await db.selectFrom('shop.sales_order').select(db.fn.max('order_no').as('max')).executeTakeFirst();
    data.OrderNo = String(Number(last?.max ?? 0) + 1).padStart(10, '0');
    data.Status = 'NEW';
    if (!data.Customer) throw validationError('Enter a customer.', [{ code: 'REQUIRED', message: 'Enter a customer.', target: 'Customer' }]);
  },
  beforeUpdate({ current }) {
    if (current.Status === 'CLOSED') throw validationError('Closed orders cannot be changed.', []);
  },
  afterUpdate({ messages }) {
    messages.push({ code: 'SAVED', message: 'Order saved.', numericSeverity: 1 }); // shown as a toast via sap-messages
  },
};
```

Pass it as `entitySets: { Orders: orders }`. Hook data uses **property names** (as in `$metadata`); SQL in hooks
uses **table / column names** (as in the database), schema-qualified like the `table` entries of `storage.json`
(`'shop.sales_order'`). `validationError(message, details)` answers 400; a detail with
`target` (a property name) appears at that field in the object page.

## Actions

Declare the bound action in the annotation file and implement it under its qualified name:

```xml
<Action Name="approve" IsBound="true">
  <Parameter Name="_it" Type="Shop.Order" Nullable="false"/>
  <ReturnType Type="Shop.Order" Nullable="false"/>
</Action>
```

```ts
import { validationError, type ActionHandler } from '@rhfan2019/smart-kit-server';

export const approve: ActionHandler<unknown> = async ({ entity, db, messages, read }) => {
  if (entity.Status !== 'NEW') throw validationError('Only new orders can be approved.', []);
  await db.updateTable('shop.sales_order').set({ status: 'APPR' }).where('order_no', '=', String(entity.OrderNo)).execute();
  messages.push({ code: 'APPROVED', message: `Order ${String(entity.OrderNo)} approved.`, numericSeverity: 1 });
  return read('Orders', { OrderNo: entity.OrderNo }); // the changed entity is the response
};
```

`createODataService({ …, actions: { 'Shop.approve': approve } })`; show it in the UI with a `UI.DataFieldForAction`
(`Action` = `Shop.approve`) in `UI.LineItem` or `UI.Identification`.

## Data scope (permissions) and request context

```ts
import { createODataService, type ODataServiceOptions } from '@rhfan2019/smart-kit-server';

type Ctx = { company: string };

export function withScope(options: ODataServiceOptions<Ctx>) {
  return createODataService<Ctx>({
    ...options,
    // runs per request, e.g. from your session / JWT
    context: (request) => ({ company: request.headers.get('x-company') ?? '' }),
    // a $filter condition per entity set, added wherever the set is read, and enforced on writes
    scope: (entitySet, ctx) => (entitySet === 'Orders' ? `CompanyCode eq '${ctx.company.replace(/'/g, "''")}'` : undefined),
  });
}
```

Authentication itself is the host's job (middleware before `service.handle`).

## Other options

`maxPageSize` (default 1000 rows per request; next links beyond), `afterRead` (change rows before they are returned,
e.g. language-dependent texts), `readOnly` (refuse all writes), `onError` (log unexpected errors; the client gets a
standard OData error body), `metadata.labels` (`{ en: { key: 'Text' }, zh: { … } }` for `{{label:key}}`).
`service.metadata(lang)` returns the merged `$metadata` XML; `service.model` the parsed model.

## Pitfalls

- A property missing from `storage.json` cannot be read: rerun `smart-kit generate` after adding a column.
- Annotation targets must use the generated names (PascalCase types, plural sets, `_Target` navigations, unless
  renamed in `smart-kit.config.json`); `smart-kit check --strict` fails on stale targets — run it in CI.
- Written values are checked against the Edm type and `MaxLength` of `$metadata`; database constraint errors
  (duplicate key, foreign key) come back as OData errors.
- Optimistic locking: a set with `Core.OptimisticConcurrency` (an integer property such as `Version`) returns an
  ETag with every entity. **The server increments that property** on every PATCH and bound action — do not do it in a
  hook. A PATCH or DELETE whose `If-Match` does not match answers 412; a request **without** `If-Match` (or with `*`)
  is accepted unconditionally (the smart-kit front end always sends it). Re-read the entity (or use the `ETag`
  response header of the last write) before the next write from your own scripts.
- The CORS policy is the host's: add headers in your HTTP layer if the front end is on another origin.
