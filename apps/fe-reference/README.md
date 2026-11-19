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
| `http://localhost:4420/index.html?app=purchasing-display` | `fe.ref.purchasingdisplay` (`webapp/purchasing-display/`; also an object page of `PurchaseOrderItems` for `tests/e2e-fe/op6.spec.ts`) | `/odata/purchasing/` |
| `http://localhost:4420/index.html?app=purchasing-params` | `fe.ref.purchasingparams` (`webapp/purchasing-params/`) | `/odata/purchasing/` |
| `http://localhost:4420/index.html?app=purchasing-op` | `fe.ref.purchasingop` (`webapp/purchasing-op/`) | `/odata/purchasing-draft/` |
| `http://localhost:4420/index.html?app=purchasing-op7` | `fe.ref.purchasingop7` (`webapp/purchasing-op7/`; the object page toolbars of `tests/e2e-fe/op7.spec.ts`: overflow groups with separators, primary header and footer actions; demo `/purchasing-draft/object?…&fe=purchasing-op7`) | `/odata/purchasing-draft/` |

Both components start through `webapp/ext/start.js`; the shared extensions (custom column, custom action) are in
`webapp/ext/`. Variants are kept in the session storage flexibility connector (no LREP backend).

## Correspondence with the smart-kit demo

Since stage 5 the smart-kit list report `ListReport` (`@rhfan2019/smart-kit/v4/fe/templates/ListReport`) takes the FE
manifest settings as props (docs/26c, docs/30 §5.3), and the demo passes **the very settings object of these
manifests**: `apps/demo/src/feListReport.ts` reads `sap.ui5 › routing › targets › <ListReport target> › options ›
settings` from the imported `manifest.json` and only replaces what React cannot take from JSON — `{i18n>key}` texts by
the demo's texts, the fragment `fe.ref.ext.Overdue` (column `template`) and the handler
`fe.ref.ext.CustomActions.copy` (action `press`) by their React implementations. So a setting changed here changes
both apps.

| FE app (`?app=…`) | smart-kit demo | settings |
| --- | --- | --- |
| `purchasing` | `/po` (`PurchaseOrdersPage.tsx`) | `purchasing/manifest.json` |
| `purchasing-draft` | `/po-draft` | `purchasing-draft/manifest.json` |
| `purchasing-views` | `/po?views=tabs` | `purchasing-views/manifest.json` |
| `purchasing-chart` | `/po?chart=1` | `purchasing-chart/manifest.json` (a table view and the chart view) |
| `purchasing-analytical` | `/po?table=analytical` | `purchasing-analytical/manifest.json` |
| `purchasing-display` | `/contacts` (`SupplierContactsPage.tsx`) | `purchasing-display/manifest.json` |
| `purchasing-params` | `/spend` (`SupplierSpendPage.tsx`) | `purchasing-params/manifest.json` |

smart-kit extensions next to the settings (registered in `tools/ui5-alignment/deviations*.json`): `service`,
`pageKey`. Further query parameters of `/po` change single settings the same way the FE comparison lays them over the
manifest in the browser (`tests/e2e-fe/lr5.spec.ts`): `mode=manual` (`liveMode: false`), `table=responsive` /
`table=annotation` (`tableSettings.type`), `initialLoad=…`, `vm=None` (`variantManagement`), `selection=…`
(`selectionMode`), `export=0` (`enableExport`), `creation=CreationDialog` (`creationMode.name`), `threshold=…`,
`views=switch|select` (`quickVariantSelection`), `kpi=1` (`keyPerformanceIndicators`).

Still different (registered): the variants are stored in smart-kit's own variant service (`Variants`, D42); the
non-draft list keeps its Create button (D42); FE's order of the standard actions.

### Chart view (`purchasing-chart` ↔ `/po?chart=1`)

`webapp/purchasing-chart/manifest.json` is the `purchasing` manifest plus `views.paths`: `table` =
`com.sap.vocabularies.UI.v1.PresentationVariant` (the LineItem) and `chart` =
`com.sap.vocabularies.UI.v1.PresentationVariant#ByStatusChart` (its `Visualizations` is `@UI.Chart#ByStatus`, added
to the test service for this comparison). It corresponds to the demo's `/po?chart=1` (the same `views`: two tabs). The
FE comparison `tests/e2e-fe/aggr.spec.ts` compares only the chart: the requests sent when the chart is shown (and
after a filter), the chart type, its dimensions and measures, and what it draws.

Not reproducible in the manifest (and therefore registered as differences, registered as `fe-behavior` in `tools/ui5-alignment/deviations.json`):

- the demo's `tableExtend` entry `DataField::PurchaseOrderType` with `position: "replace"` (renders the raw code);
  FE has no manifest setting that replaces the template of an annotation column;
- the order of the standard actions (Create, Delete) is fixed by FE. (The demo's custom action `Custom::Copy` stands
  before Create, where FE puts a manifest action without `position.anchor`; it used to be at the start.)

## Analytical table (`?app=purchasing-analytical` ↔ `/po?table=analytical`)

`webapp/purchasing-analytical/` is the `purchasing` component with `tableSettings.type: "AnalyticalTable"` (the
only FE table type with totals, group subtotals and grouping in a grid, D39). It corresponds to the demo's
`/po?table=analytical` (the settings of this manifest). The test service declares `Aggregation.CustomAggregate#NetAmount`
and `UI.PresentationVariant/Total` = NetAmount, so both total the net amount. Used by `tests/e2e-fe/totals.spec.ts`
(scenario `po-analytical-totals`): the collection requests of `PurchaseOrders`, the totalled columns, the
personalization panels, the text of the totals row (several currencies: "Show Details") and the lines and request
of its details popover. `tests/e2e-fe/apply.spec.ts` (scenarios `apply-initial`, `-sort`, `-sort-amount`, `-filter`,
`-search`, `-paging`, `-grouped`) compares the single `$apply` (`concat`) request of rows, totals and count of the
ungrouped analytical table, and the grouped one. The remaining differences are in `tools/ui5-alignment/deviations.json`
(`DV-apply-*`).

## Multiple views (`?app=purchasing-views`)

`webapp/purchasing-views/` is the `purchasing` component with `views.paths` = the SelectionPresentationVariants
`#Open`, `#InDelivery`, `#Closed` and `showCounts: true` (a table per view in an IconTabBar). It corresponds to the
demo's `/po?views=tabs` (the settings of this manifest); used by
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

## Stage 4 views, charts, KPI and table type (`tests/e2e-fe/views4.spec.ts`)

The scenarios lay their annotations over the purchasing `$metadata` (as the filter overlays above) and, where FE
needs a manifest setting, over `purchasing/manifest.json` (`page.route`), so the manifests and the other scenarios
are unchanged:

| scenario | overlay | FE (`?app=…`) | smart-kit demo |
| --- | --- | --- | --- |
| `views4-pv-chart-first`, `views4-chart-<type>` | default `UI.PresentationVariant`: `@UI.Chart#ByStatus` first, SortOrder NetAmount desc (and another `ChartType`) | `purchasing` | `/po` |
| `views4-pv-not-compliant` | default PV without `Visualizations` | `purchasing` | `/po` |
| `views4-view-no-sort`, `views4-chart-view` | SPV#Open without SortOrder, RequestAtLeast CompanyCode; SPV#InDelivery shows only `@UI.Chart#ByStatus` | `purchasing-views` | `/po?views=tabs` |
| `views4-kpi-tag` | `UI.KPI#OpenAmount`; manifest `keyPerformanceIndicators.openAmount` | `purchasing` | `/po?kpi=1` (`keyPerformanceIndicators={{ openAmount: { qualifier: 'OpenAmount' } }}`) |
| `views4-table-type` | `ApplySupported/Transformations` with all eight; manifest without `tableSettings.type` | `purchasing` | `/po?table=annotation` (no `tableSettings.type`) |

The remaining differences are in `tools/ui5-alignment/deviations.views4.json`.

### Value display (`purchasing-display` ↔ `/contacts`)

`webapp/purchasing-display/manifest.json` is a list report on `/SupplierContacts` (the stage 4 block of the test
service: e-mail and phone, `Communication.Contact`, `DataFieldWithUrl` with and without `HTML5.LinkTarget`,
`Common.ExternalID`, `Common.Masked`, `Common.Timezone` / `IsTimezone`, data point `ValueFormat` and progress with
criticality, amounts and quantities) with the same settings as `purchasing` (grid table, multi selection, export, page
variants, live mode, initial load) and no extensions. It corresponds to the demo's `/contacts`
(`apps/demo/src/pages/SupplierContactsPage.tsx`, the settings of this manifest).
The FE comparison `tests/e2e-fe/display4.spec.ts` compares requests, structure, cell text and the cell links.

## Stage 4 tail: column and action types (`tests/e2e-fe/colsfe.spec.ts`)

The `cols5-*` scenarios (`?app=purchasing` ↔ `/po`) lay a LineItem with the stage 4 column and action types
(`cols5-types`), a constant row highlight (`cols5-negative`, `-very-negative`, `-very-positive`),
`UI.CreateHidden` / `UI.DeleteHidden` (`cols5-create-delete-hidden`) and a path `Deletable`
(`cols5-deletable-path`) over the purchasing `$metadata`, as the overlays above. Besides requests, structure and cell
text they compare the row highlights, column widths, toolbar actions after selecting rows and the confirmation
texts. `cols5-p13n-GridTable` / `-ResponsiveTable` compare the personalization's columns, sort and group properties
(FE responsive table: `purchasing/manifest.json` overlaid with `tableSettings.type`), and
`cols5-contacts-expand-header` (`?app=purchasing-display` ↔ `/contacts`) checks that expanding the header does not
request the list again.

## Stage 4 tail: value help service and parameterized entity set (`tests/e2e-fe/vhref.spec.ts`)

- **Common.ValueListReferences / ValueListMapping** (`vhref-*` scenarios, `?app=purchasing` ↔ `/po`): the test service
  has a value help service `/odata/purchasing-vh/` (`apps/mock/Csdl/purchasing-vh.xml`, `CompanyCodes`) whose
  `$metadata` declares `Common.ValueListMapping` for `Purchasing.PurchaseOrder/CompanyCode`. The reference
  (`Common.ValueListReferences` = `../purchasing-vh/$metadata`) is laid over the purchasing `$metadata` in the browser
  (`page.route`, as the filter overlays above), identically for this app and the demo, so the other scenarios keep a
  company code field without value help. This server proxies `/odata/purchasing-vh/` like the other services.
- **Parameterized entity set** (`params-*` scenarios): `webapp/purchasing-params/manifest.json` is a list report with
  `contextPath: "/SpendParameters/Set"` (the result set contained in the parameter set `SpendParameters`,
  `Common.ResultContext`), `variantManagement: "Page"`, `initialLoad: "Enabled"`, `liveMode: true`, a grid table with
  multi selection and export, no object page. It corresponds to the demo's `/spend`
  (`apps/demo/src/pages/SupplierSpendPage.tsx`, the settings of this manifest).

## Object page settings (stage 5, `tests/e2e-fe/op5.spec.ts`)

The object page targets of the manifests are the settings of the demo's object pages: `apps/demo/src/pages/objectPageSettings.tsx`
imports the manifest JSON and passes the `options.settings` of the `sap.fe.templates.ObjectPage` target to
`v4/fe/templates/ObjectPage` unchanged; it only resolves what FE names by string (fragment names in `template` → React
render functions, extension functions in `press` → handlers, `{i18n>key}` → the demo's texts).

| FE app (object page target) | smart-kit demo | settings |
| --- | --- | --- |
| `purchasing`, `purchasing-chart`, `purchasing-views`, `purchasing-analytical` | `/purchasing/object?path=PurchaseOrders(…)` | `sectionLayout: "Tabs"`; custom section `Custom::Timeline` after `GeneralInformation` (fragment `ext/Timeline`) with side content (`ext/SupplierInfo`) and the sub-section action `Custom::SupplierInfo` (`CustomActions.toggleSupplierInfo` → `showSideContent`) |
| `purchasing-draft` | `/purchasing-draft/object?path=…` | the same, plus `controlConfiguration["_Item/@com.sap.vocabularies.UI.v1.LineItem#InOrder"].tableSettings.creationMode.name: "CreationDialog"` |
| `purchasing-op` | `/purchasing-draft/object?path=…&fe=purchasing-op` | defaults (`sectionLayout: "Page"`), `editableHeaderContent: false`, `useTextForNoDataMessages: true`, custom header facet `Custom::Contact` after `HeaderGeneral` (`ext/ContactFacet`), header action `Custom::Remind`, footer action `Custom::Check` |
| `purchasing-display` (`SupplierContacts`) | `/purchasing/object?path=SupplierContacts(…)` | defaults (the former `editableHeaderContent: false` was removed: the demo uses the FE default) |

The demo additions without a manifest setting are the message strip under the title, the status tag in the title, a
message strip and layout blocks in `Custom::Timeline` (registered as `kit-extension` in
`tools/ui5-alignment/deviations.op5.json`). The FE comparison opens order 4500000001 in both apps and compares the
sections, header facets, header and footer actions (keys and texts), the section layout, the anchor bar, the header
content and the side content, in display mode, after Edit and after the sub-section action. (FE starts the draft
with `$$inheritExpandSelect`, which UI5 allows only for actions with `EntitySetPath`: the draft actions of
`apps/mock/data/purchasing-draft.xml` declare `EntitySetPath="_it"` since stage 5.)
