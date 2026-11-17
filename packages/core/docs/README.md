# @rhfan2019/smart-kit-core for coding agents

> Ships inside the package (`node_modules/@rhfan2019/smart-kit-core/docs/`); `docs/reference.md` lists every export.
> Most apps only need `loadService` from here plus the React package (`@rhfan2019/smart-kit`, start with its
> `docs/README.md`).

Pure TypeScript, no React: reads `$metadata` (CSDL XML or JSON) plus annotation files into a **model**
(`MetaModel`: entity sets, types, properties, navigations, and the UI derived from annotations), builds OData V4
requests, and talks to a service through a **data provider**.

```ts
import { loadService, keyPredicate, getEntitySet, type Row } from '@rhfan2019/smart-kit-core';

export async function firstOrders() {
  // fetches $metadata, builds the model, returns an ODataV4Provider for that service
  const { model, provider } = await loadService({ serviceUrl: '/odata/shop/', fetch: (url, init) => fetch(url, init), language: 'en' });
  const set = getEntitySet(model, 'Orders');
  const type = model.entityTypes[set.typeName]!;
  const result = await provider.query({ source: { entitySet: 'Orders' }, select: ['OrderNo', 'NetAmount'], expand: [], orderBy: [{ path: 'OrderNo', descending: true }], top: 5, count: true });
  return result.rows.map((row: Row) => `Orders${keyPredicate(type, row)}`);
}
```

| Need | Use |
| --- | --- |
| Load a service | `loadService({ serviceUrl, fetch, language?, annotationUrls?, annotationFiles?, overlay? })` |
| Model from files (tests, build time) | `buildModel(csdl, { annotationFiles?, overlay? })` |
| Entity path / key | `keyPredicate(type, row)`, `parseEntityPath`, `resolveEntityPath` |
| Conditions → `$filter` | `toFilter`, `filterString`, `OPERATORS`, `OPERATOR_ARITY` |
| Formatting like the UI | `formatValue`, `formatNumber`, `formatDate`, `formatDateTime` |
| Saved views in the service | `new ODataVariantStore(provider)` (entity set `Variants`) as `ServiceConfig.variants` |
| Back-navigation state | `createSessionPageStateStore()` as `SmartKitProvider` `pageState` |
| Tests without a server | `new MemoryProvider({ model, data })` |
| Errors | `ODataError` (status, details), `ConcurrencyError` (412), `messagesFromError` |

`ODataV4Provider` sends one request per call (no `$batch`), with `$select`/`$expand` from the model, `$count`,
ETags (`If-Match`) on writes, and reads `sap-messages` headers.
