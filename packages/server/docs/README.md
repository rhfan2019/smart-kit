# @rhfan2019/smart-kit-server for coding agents

> Ships inside the package (`node_modules/@rhfan2019/smart-kit-server/docs/`). `docs/reference.md` lists every export.
> For the whole flow (database → CLI → server → React pages) follow
> `node_modules/@rhfan2019/smart-kit/skills/smart-kit-getting-started/SKILL.md`.

A **limited OData V4 service on PostgreSQL**, written for what the smart-kit front end sends: reads (`$select`,
`$expand`, `$filter` (with `any` / `all` over collection navigations), `$orderby`, `$top`/`$skip`, `$count`, `$search`, `$apply` with `filter`/`search`/`groupby`/
`aggregate` (`sum`, `min`, `max`, `average`, `countdistinct`, `$count as`, custom aggregates by name with their unit)), value helps, `$metadata`, direct save (PATCH with ETag, POST to a set or a collection navigation,
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

## Unmanaged save: the application stores the entity

By default the service writes to the table of the entity set itself. When the entity set is a **read model** (a view
over several tables, computed columns), or the application's writes live in its own code (permission checks, audit,
numbering, a different database library), give the entity set `create` / `update` / `delete`: the service still does
the protocol (property whitelist, Edm types, Capabilities, the data scope, ETag / If-Match → 412, the hooks before and
after, OData errors, `sap-messages`) and then calls your function instead of running SQL. The response is the entity
read again through the entity set, so computed columns of the view are there.

```ts
import { ODataServerError, type EntitySetHooks } from '@rhfan2019/smart-kit-server';

declare const orders: {
  create(input: { customer: string; note: string | null }): Promise<{ orderNo: string }>;
  update(orderNo: string, version: number, changes: { note?: string | null }): Promise<boolean>;
  remove(orderNo: string): Promise<void>;
};

export const Orders: EntitySetHooks<unknown> = {
  creatable: ['Customer', 'Note'],
  updatable: ['Note'],
  // returns the key of the new entity: every key property
  async create({ data }) {
    const { orderNo } = await orders.create({ customer: String(data.Customer), note: (data.Note as string | null) ?? null });
    return { OrderNo: orderNo };
  },
  // `patch`: the checked properties of the request; `current`: the entity as read now (If-Match was checked against it)
  async update({ key, current, patch }) {
    const stored = await orders.update(String(key.OrderNo), Number(current.Version), { note: patch.Note as string | null });
    if (!stored) throw new ODataServerError(412, 'PreconditionFailed', 'The order was changed by someone else.');
  },
  async delete({ key }) {
    await orders.remove(String(key.OrderNo));
  },
};
```

- The ETag property (`Version`) is yours to count up in `update`; the service only compares it.
- An action handler of such an entity set either stores what it does itself and returns nothing, or returns the
  changes, which then go to `update` as `patch`.
- Throw `ODataServerError` (or `validationError` for field errors) to refuse; anything else becomes a 500.
- Your function and the service must see the same transaction, or the re-read misses your write: see the next section.

## One transaction with the host: `unitOfWork`

Without it the service runs each write request in a transaction of its own on `db`. When your `create` / `update` /
`delete` or action handlers write through another connection (Drizzle, Prisma, plain `pg`), give `unitOfWork`: the
service calls it once per write request — and once per change set of a `$batch` — and does all its own statements on
the Kysely instance you hand to `work`. You begin, commit and roll back.

```ts
import { AsyncLocalStorage } from 'node:async_hooks';
import type pg from 'pg';
import { createKyselyOnClient, type ODataServiceOptions } from '@rhfan2019/smart-kit-server';

/** The connection of the running unit of work: your own writes take it from here. */
export const currentClient = new AsyncLocalStorage<pg.PoolClient>();

export const unitOfWork = (pool: pg.Pool): NonNullable<ODataServiceOptions<unknown>['unitOfWork']> =>
  async (_e, work) => {
    const client = await pool.connect();
    try {
      await client.query('begin');
      const result = await currentClient.run(client, () => work(createKyselyOnClient(client)));
      await client.query('commit');
      return result;
    } catch (e) {
      await client.query('rollback');
      throw e;
    } finally {
      client.release();
    }
  };
```

With Drizzle: `drizzle(client).transaction(async (tx) => store.run(tx, () => work(createKyselyOnClient(client))))`
begins and commits for you, and your mutations take `tx` from the store.

## `$batch`

`POST <service>/$batch` in the **JSON format** of OData 4.01 (`Content-Type: application/json`; `multipart/mixed`
answers 415):

```json
{ "requests": [
  { "id": "1", "atomicityGroup": "g1", "method": "POST", "url": "Orders", "body": { "Customer": "C1" } },
  { "id": "2", "atomicityGroup": "g1", "method": "POST", "url": "$1/_Items", "body": { "Product": "P1", "Quantity": 2 } },
  { "id": "3", "method": "POST", "url": "Orders('7')/Shop.approve", "body": {} },
  { "id": "4", "method": "GET", "url": "Orders('7')?$select=Status" }
] }
```

- The answer is `200` with `{ "responses": [{ "id", "status", "headers", "body" }] }` in the order of the requests.
- Requests with the same `atomicityGroup` are a **change set**: one transaction (one `unitOfWork`). When one of them
  fails nothing of the group is written and the group gets a single response: the error, with the `id` of the request
  that failed. A GET cannot be in a group; the requests of a group follow one another.
- A URL may start with `$<id>` of an earlier request that created an entity (`$1/_Items`).
- Each request carries its own `headers` (`If-Match`, `Prefer`); the cookies, `Authorization` and `Accept-Language`
  of the batch request apply to all of them. `context` is computed once for the batch.
- Without `Prefer: continue-on-error` the first failed request (or group) ends the batch.

In the browser, `ODataV4Provider` (and `loadService`) with `batch: 'json'` sends several writes of a page as one
batch: deleting or mass-editing the selected rows as one change set, an action on several rows as one request with
each row on its own (`UI.DataFieldForAction/InvocationGrouping` `ChangeSet`: all or none).

## Authorizing each request: `authorize`

`scope` decides which rows exist for a user; `authorize` decides whether the user may do this kind of thing at all.
It runs for every request — each request inside a `$batch` too — after the path is resolved and before anything is
read or written, with the entity set the path ends at (`Orders('1')/_Items` → `Items`).

```ts
import { ODataServerError, type ODataServiceOptions } from '@rhfan2019/smart-kit-server';

type Ctx = { permissions: Set<string> };
const NEEDED: Record<string, Record<string, string>> = {
  Orders: { read: 'order:view', create: 'order:create', update: 'order:edit', delete: 'order:delete', 'action:Shop.approve': 'order:approve' },
};

export const authorize: NonNullable<ODataServiceOptions<Ctx>['authorize']> = ({ context, entitySet, operation, action }) => {
  const needed = NEEDED[entitySet]?.[action ? `action:${action}` : operation];
  if (!needed || !context.permissions.has(needed)) throw new ODataServerError(403, 'PERMISSION_DENIED', `Missing permission ${needed ?? entitySet}.`);
};
```

Do not authorize in a wrapper around `service.handle` by looking at the URL: the requests of a `$batch` never pass
it one by one. Entity sets reached through `$expand`, navigation paths in `$filter` and value helps are not announced
to `authorize`; restrict those with `scope` (a set the user may not see: scope `false`).

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

The scope applies wherever the set is touched: the list and `$count`, a key read (404 outside the scope), the set as
parent in a path, `$expand` from other sets, navigation paths and `any` / `all` in `$filter` / `$orderby` of other sets,
`$apply`, and writes (PATCH / DELETE / actions answer 404, a POST whose new row falls outside answers 403).

**Scope through a collection navigation.** When the set's own fields cannot express the scope (an invoice belongs to
several orders, each with a company code), give the set a collection navigation to a "scope keys" set (one row per
dimension combination; for views declare it in `smart-kit.config.json`, see the CLI docs) and use `any`:

```ts
import type { ScopeFunction } from '@rhfan2019/smart-kit-server';

type User = { companies: string[] };
const quote = (s: string) => `'${s.replace(/'/g, "''")}'`;

export const scope: ScopeFunction<User> = (entitySet, user) => {
  if (entitySet !== 'Invoices') return undefined;
  if (!user.companies.length) return 'false'; // sees nothing
  return `_ScopeKeys/any(k: k/CompanyCode in (${user.companies.map(quote).join(',')}))`;
};
```

What a scope condition may use: the set's own properties, and `any(…)` / `all(…)` over its collection navigations;
inside a lambda body, paths through the lambda variable may also follow single-valued navigations
(`k/_Order/PurchasingGroup eq 'P01'`), and `$it/…` refers to the scoped entity. A single-valued navigation outside a
lambda (`_Supplier/Country eq 'DE'`) is refused when the scope is first used (a 500 with a clear message: fix the
scope). Navigations inside a scope condition see **all** rows of their targets (the scope of `InvoiceScopeKeys`, if
any, is not applied inside the scope of `Invoices`), so scopes never recurse. Always quote values as above: the
condition is OData `$filter` text.

Authentication itself is the host's job (middleware before `service.handle`).

## Using the host's `pg` pool

`createPostgresDb` opens a pool of its own. When the application already has a `pg` `Pool`, build Kysely on it with
`createKysely` instead: the service's queries run in UTC with a statement timeout, as with `createPostgresDb`.

```ts
import pg from 'pg';
import { createKysely } from '@rhfan2019/smart-kit-server';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL }); // the application's pool

// each time the service takes a connection it sets TimeZone=UTC and statement_timeout, and resets both when it gives
// the connection back, so the application's own queries keep their settings
export const db = createKysely(pool, { statementTimeout: 15_000 });
```

Pass `db` to `createODataService`. Options: `statementTimeout` (milliseconds, default 15000), `keepSettings: true` to
set both once per connection and leave them (saves two short statements per use; then every query on that pool runs in
UTC with that timeout). `db.destroy()` does not end the pool; the application does. Without `createKysely`, build
Kysely yourself only on a pool whose sessions are already in UTC, e.g.
`new pg.Pool({ options: '-c TimeZone=UTC -c statement_timeout=15000' })` and
`new Kysely({ dialect: new PostgresDialect({ pool }) })`: dates and times are written in UTC, and
`timestamp without time zone` columns are read as UTC only in a UTC session.

## Custom aggregates (totals of analytical tables)

smart-kit (like Fiori elements) totals only **custom aggregates** and requests them by name, without `with`:
`$apply=filter(…)/groupby((Currency),aggregate(NetAmount))`. Analytical tables (`type="AnalyticalTable"`) show
totals and group subtotals only for them (D39). Declare one per measure in the annotation file, on the entity type
(or set) that has `Aggregation.ApplySupported`; the qualifier is the property name, the value its type:

```xml
<Annotations Target="Purchasing.PurchaseOrder">
  <Annotation Term="Aggregation.CustomAggregate" Qualifier="NetAmount" String="Edm.Decimal"/>
</Annotations>
```

This service answers `aggregate(NetAmount)` with the property `NetAmount` **summed** (the result is named like the
aggregate). To aggregate it with another method, list it in `ApplySupported/AggregatableProperties` with
`SupportedAggregationMethods` without `sum` (e.g. `max`); the first listed method is used. Only custom aggregates of a
property of the same name are supported (no computed aggregates); `aggregate(X)` for anything that is not declared
answers 400 `InvalidApply` — write `X with sum as X` instead.

The **unit** of a custom aggregate (its `Measures.ISOCurrency` / `Measures.Unit` path) may be named in the same
`aggregate()`, as Fiori elements and smart-kit request totals: `aggregate(NetAmount,Currency)` returns the currency
when all aggregated rows have the same one and **null** when they have several (the client then shows "Show Details"
and asks `groupby((Currency),aggregate(NetAmount))&$orderby=Currency` for the amounts per currency).

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
