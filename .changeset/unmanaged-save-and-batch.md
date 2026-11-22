---
"@rhfan2019/smart-kit": minor
"@rhfan2019/smart-kit-core": minor
"@rhfan2019/smart-kit-server": minor
"@rhfan2019/smart-kit-cli": minor
---

Unmanaged save, `$batch` and fixes from the first applications (D51, ADR-034). smart-kit-server: `EntitySetHooks.create` / `update` / `delete` let the application store the entity while the service keeps the protocol; `unitOfWork` with `createKyselyOnClient` runs the service inside the host's transaction; `$batch` in the OData 4.01 JSON format with atomic change sets; `authorize` for every request. smart-kit-core: `DataProvider.batch`, `writeAll`, `batch: 'json'` on `ODataV4Provider`. smart-kit: several writes of a page are one batch request; responsive tables pop columns in the way sap.m.Table does; object page footer actions at the right, first section title hidden, `onActionDone`; list report `navigationParameter` and per-entity-set table settings; grid tables are named and their screen reader texts translated. smart-kit-cli: an empty schema is accepted. `NavigationAdapter.toCreate`: with it, "Create" of a list without draft opens the object page in create mode instead of a dialog. Hooks and unmanaged saves get Edm.Decimal / Edm.Int64 values as numbers also when the client sent them as strings (IEEE754Compatible).
