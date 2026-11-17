# @rhfan2019/smart-kit-core

The framework-free part of [smart-kit](https://github.com/rhfan2019/smart-kit): reads OData V4 `$metadata` (CSDL XML
or JSON) and annotation files into a model of entity sets, types and the UI the annotations describe; builds OData
requests; talks to a service through a data provider (`ODataV4Provider`, or `MemoryProvider` for tests). Pure
TypeScript, ESM, no React.

```bash
npm install @rhfan2019/smart-kit-core
```

```ts
import { loadService } from '@rhfan2019/smart-kit-core';

const { model, provider } = await loadService({ serviceUrl: '/odata/shop/', fetch: (url, init) => fetch(url, init), language: 'en' });
console.log(Object.keys(model.entitySets));
```

Usually you use it together with the React package [`@rhfan2019/smart-kit`](https://www.npmjs.com/package/@rhfan2019/smart-kit)
(`loadService` gives the `model` and `provider` for `SmartKitProvider`).

Documentation in the package: `docs/README.md`, `docs/reference.md` (every export). MIT License.
