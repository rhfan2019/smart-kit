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
| `http://localhost:4420/index.html?app=purchasing-chart` | `fe.ref.purchasingchart` (`webapp/purchasing-chart/`) | `/odata/purchasing/` |
| `http://localhost:4420/index.html?app=purchasing-views` | `fe.ref.purchasingviews` (`webapp/purchasing-views/`) | `/odata/purchasing/` |
| `http://localhost:4420/index.html?app=purchasing-analytical` | `fe.ref.purchasinganalytical` (`webapp/purchasing-analytical/`) | `/odata/purchasing/` |

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

### Chart view (`purchasing-chart` ↔ `/po?chart=1`)

`webapp/purchasing-chart/manifest.json` is the `purchasing` manifest plus `views.paths`: `table` =
`com.sap.vocabularies.UI.v1.PresentationVariant` (the LineItem) and `chart` =
`com.sap.vocabularies.UI.v1.PresentationVariant#ByStatusChart` (its `Visualizations` is `@UI.Chart#ByStatus`, added
to the test service for this comparison). It corresponds to the demo's `/po?chart=1` (`chart="ByStatus"`: the table
with the table/chart switch). FE shows the two as view tabs, smart-kit as the switch in the table toolbar, so the
FE comparison `tests/e2e-fe/aggr.spec.ts` compares only the chart: the requests sent when the chart is shown (and
after a filter), the chart type, its dimensions and measures, and what it draws.

Not reproducible in the manifest (and therefore registered as differences, registered as `fe-behavior` in `tools/ui5-alignment/deviations.json`):

- the demo's `tableExtend` entry `DataField::PurchaseOrderType` with `position: "replace"` (renders the raw code);
  FE has no manifest setting that replaces the template of an annotation column;
- the custom action's position `start`: FE places custom actions by `position.anchor` relative to other actions,
  and the order of the standard actions (Create, Delete) is fixed by FE.

## Analytical table (`?app=purchasing-analytical` ↔ `/po?table=analytical`)

`webapp/purchasing-analytical/` is the `purchasing` component with `tableSettings.type: "AnalyticalTable"` (the
only FE table type with totals, group subtotals and grouping in a grid, D39). It corresponds to the demo's
`/po?table=analytical` (`tableType="AnalyticalTable"`). The test service declares `Aggregation.CustomAggregate#NetAmount`
and `UI.PresentationVariant/Total` = NetAmount, so both total the net amount. Used by `tests/e2e-fe/totals.spec.ts`
(scenario `po-analytical-totals`): the collection requests of `PurchaseOrders`, the totalled columns, the
personalization panels, the text of the totals row (several currencies: "Show Details") and the lines and request
of its details popover; the remaining differences are in
`tools/ui5-alignment/deviations.totals.json`.

## Multiple views (`?app=purchasing-views`)

`webapp/purchasing-views/` is the `purchasing` component with `views.paths` = the SelectionPresentationVariants
`#Open`, `#InDelivery`, `#Closed` and `showCounts: true` (a table per view in an IconTabBar). It corresponds to the
demo's `/po?views=tabs` (`views={{ mode: 'tabs', ids: ['Open', 'InDelivery', 'Closed'] }}`); used by
`tests/e2e-fe/draft.spec.ts` (scenario `po-views-tabs`). The draft scenarios of that spec (`po-draft-list-locked`,
`-unchanged`, `-own-draft`) use `?app=purchasing-draft` and `/po-draft`, choosing the editing status in both.

## Metadata adjustment

sap.fe needs the draft navigation property `SiblingEntity` on draft-enabled entity types (the "All" editing
status filters by `SiblingEntity/IsActiveEntity eq null`); the test service does not declare it, and without it
the draft list report never sends its data request. `apps/mock/lib/draft.mjs` now declares `SiblingEntity` (with
its navigation property binding) and evaluates `SiblingEntity/IsActiveEntity eq null` and `IsActiveEntity eq false`
as RAP / CAP do (`draftFilterCheck`), so `metadata.mjs` (`addSiblingEntity`) is a no-op and can be removed.

## Comparison

`npm run e2e:fe` (`playwright.fe.config.ts`, tests in `tests/e2e-fe/`) starts the test service, the demo and this
app (ports from `E2E_MOCK_PORT`, `E2E_DEMO_PORT`, `FE_PORT`), compares requests, structure and cell text, and
writes `reports/fe-compare/<scenario>.{json,md}`. A difference passes only when it is registered as `fe-behavior`
in `tools/ui5-alignment/deviations.json` (or the file named by `FE_DEVIATIONS`). `FE_BASELINE=1` rewrites
`tools/ui5-alignment/fe-baseline.json` from the current differences instead of failing (to be merged into `deviations.json` with ids).

## Annotation overlays (filter defaults and value help parameters)

`tests/e2e-fe/filter3.spec.ts` (docs/29 §4 P1-4, P1-5, P1-7, P1-8) needs annotations the test service does not
declare (`Common.FilterDefaultValue` without a default `UI.SelectionVariant`, a value list with In / Constant / Out
parameters, `Common.IsDigitSequence`, a set without `Capabilities.SearchRestrictions`). It lays them over the
purchasing `$metadata` in the browser (`page.route`), identically for this app and for the smart-kit demo `/po`, so
the manifests, the demo page and the other scenarios are unchanged. The overlay reads the metadata from the test
service directly, because `route.fetch` rejects this server's proxied response (it carries both `Content-Length`
and `Transfer-Encoding`).
