# @rhfan2019/smart-kit-server

A limited **OData V4 service on PostgreSQL** for [smart-kit](https://github.com/rhfan2019/smart-kit) front ends, in
TypeScript: reads (`$select`, `$expand`, `$filter`, `$orderby`, paging, `$count`, `$search`, `$apply` aggregation),
value helps, `$metadata` with hand-written annotations, direct save (PATCH with ETag, POST, DELETE) and bound actions,
with business rules as hooks and a data scope per entity set. Web-standard `Request` → `Response` handler (Node
`http`, Express, Hono, Next.js). Not supported (501): drafts, `$batch`, deep insert, PUT. Node ≥ 24.

```bash
npm install @rhfan2019/smart-kit-server @rhfan2019/smart-kit-core
npm install -D @rhfan2019/smart-kit-cli   # generates the CSDL and storage mapping from your schema
```

```ts
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createODataService, createPostgresDb, toNodeListener, type StorageMapping } from '@rhfan2019/smart-kit-server';

const read = (file: string) => readFileSync(new URL(file, import.meta.url), 'utf8');
const { db } = createPostgresDb({ connectionString: process.env.DATABASE_URL! });
const service = createODataService({
  basePath: '/odata/shop/',
  metadata: { csdl: read('./generated/shop.csdl.xml'), annotations: [read('./annotations/shop.annotations.xml')] },
  storage: JSON.parse(read('./generated/shop.storage.json')) as StorageMapping,
  db,
  entitySets: { SalesOrders: {} }, // writes are opt-in per entity set
});
createServer(toNodeListener((request) => service.handle(request))).listen(4004);
```

Already have a `pg` pool? `createKysely(pool)` builds the `db` on it (UTC sessions, statement timeout). Data scopes
may go through collection navigations: `scope: (set, user) => set === 'Invoices' ? "_ScopeKeys/any(k: k/CompanyCode eq '1000')" : undefined`.

Every value is a SQL parameter; table and column names come only from the generated mapping. Documentation in the
package: `docs/README.md` (options, hooks, actions, data scope, pitfalls), `docs/reference.md`. The full flow from
tables to React pages: `@rhfan2019/smart-kit` `skills/smart-kit-getting-started/SKILL.md`.

The `$filter` / `$apply` grammar is adapted from `@sap-ux/fe-mockserver-core` (Apache-2.0), see `NOTICE`. MIT License.
