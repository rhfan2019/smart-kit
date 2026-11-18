# fe-reference: SAP Fiori elements V4 reference app

A real Fiori elements V4 app (`sap.fe.templates.ListReport` + `sap.fe.templates.ObjectPage`) on the test service
(`apps/mock`), used by the FE comparison `npm run e2e:fe` (docs/30 §7.2, AL-10 – AL-13, AL-21).

- SAPUI5 **1.154.0** is loaded by the browser from `https://ui5.sap.com/1.154.0/resources/sap-ui-core.js` at
  runtime. No SAP runtime files are stored in this repository (AL-22).
- `server.mjs` (plain `node:http`, no dependencies) serves `webapp/` and proxies `/odata/*`, `/media/*`, `/test/*`
  to the test service, so the app and the service are same-origin.
- Not an npm workspace; nothing to install.

## Run

```sh
npm run mock                                   # test service on :4400 (E2E=1 for deterministic data and /test/reset)
node apps/fe-reference/server.mjs              # http://localhost:4420
# env: FE_PORT (default 4420), MOCK_URL (default http://localhost:4400)
```

| URL | Component | Service |
| --- | --- | --- |
| `http://localhost:4420/index.html` | `fe.ref.purchasing` (`webapp/purchasing/`) | `/odata/purchasing/` |
| `http://localhost:4420/index.html?app=purchasing-draft` | `fe.ref.purchasingdraft` (`webapp/purchasing-draft/`) | `/odata/purchasing-draft/` |

Both components start through `webapp/ext/start.js`; the shared extensions (custom column, custom action) are in
`webapp/ext/`. Variants are kept in the session storage flexibility connector (no LREP backend).

## Correspondence with the smart-kit demo

The FE comparison opens `/po` and `/po-draft` of the smart-kit demo (`apps/demo/src/pages/PurchaseOrdersPage.tsx`,
`SmartListReport` without query parameters, English). Each manifest setting matches a demo property:

| smart-kit demo (`SmartListReport`) | FE manifest (`ListReport` target `options.settings`) |
| --- | --- |
| `entitySet="PurchaseOrders"`, `service="purchasing"` / `"purchasing-draft"` | `contextPath: "/PurchaseOrders"`; `dataSources.mainService.uri` |
| `liveMode` (default `true`) | `liveMode: true` |
| `autoExecute` (default `true`) | `initialLoad: "Enabled"` |
| page variant management (`VariantManagement` in the page title) | `variantManagement: "Page"` |
| `tableType="grid"` | `controlConfiguration["@com.sap.vocabularies.UI.v1.LineItem"].tableSettings.type: "GridTable"` |
| multi selection (default of `Table`, `v4/fe/macros/Table`) | `tableSettings.selectionMode: "Multi"` |
| `exportable` (default `true`) | `tableSettings.enableExport: true` |
| `tableExtend` `Custom::Overdue` after `DataField::Supplier` | `columns["Custom::Overdue"]` with `position: { anchor: "DataField::Supplier", placement: "After" }`, template `fe.ref.ext.Overdue` |
| `tableExtend` action `Custom::Copy` (`requiresSelection`) | `actions["Custom::Copy"]` with `requiresSelection: true`, press `fe.ref.ext.CustomActions.copy` |
| `actionGroups` `decide` = approve, reject | `actions.decide.menu: ["DataFieldForAction::Purchasing.approve", "DataFieldForAction::Purchasing.reject"]` |
| `workingMode="worklist"` (default) | FE default (no setting) |
| row press → object page (`NavigationAdapter`) | `navigation.PurchaseOrders.detail.route: "PurchaseOrdersObjectPage"` |
| `filterToggle` (default `false`), `views`, `contents`, `chart` not set | no `views`, no chart in the manifest |

Not reproducible in the manifest (and therefore registered as differences, registered as `fe-behavior` in `tools/ui5-alignment/deviations.json`):

- the demo's `tableExtend` entry `DataField::PurchaseOrderType` with `position: "replace"` (renders the raw code);
  FE has no manifest setting that replaces the template of an annotation column;
- the custom action's position `start`: FE places custom actions by `position.anchor` relative to other actions,
  and the order of the standard actions (Create, Delete) is fixed by FE.

## Metadata adjustment

sap.fe needs the draft navigation property `SiblingEntity` on draft-enabled entity types (the "All" editing
status filters by `SiblingEntity/IsActiveEntity eq null`); the test service does not declare it, and without it
the draft list report never sends its data request. `metadata.mjs` (`addSiblingEntity`) adds it to the proxied
`$metadata` of entity types with `DraftAdministrativeData`, only when missing. @sap-ux/fe-mockserver-core already
evaluates `SiblingEntity` paths. Once `apps/mock` declares the property, the patch is a no-op and can be removed.

## Comparison

`npm run e2e:fe` (`playwright.fe.config.ts`, tests in `tests/e2e-fe/`) starts the test service, the demo and this
app (ports from `E2E_MOCK_PORT`, `E2E_DEMO_PORT`, `FE_PORT`), compares requests, structure and cell text, and
writes `reports/fe-compare/<scenario>.{json,md}`. A difference passes only when it is registered as `fe-behavior`
in `tools/ui5-alignment/deviations.json` (or the file named by `FE_DEVIATIONS`). `FE_BASELINE=1` rewrites
`tools/ui5-alignment/fe-baseline.json` from the current differences instead of failing (to be merged into `deviations.json` with ids).
