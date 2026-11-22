# Changelog

All notable changes to `@rhfan2019/smart-kit`, `@rhfan2019/smart-kit-core`, `@rhfan2019/smart-kit-server` and `@rhfan2019/smart-kit-cli` are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the packages use [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.5.0] - 2026-11-22

### Added (D51, ADR-034)

- smart-kit-server: unmanaged save (`EntitySetHooks.create` / `update` / `delete`: the application stores, the service keeps the protocol and re-reads the entity), `unitOfWork` with `createKyselyOnClient` (one transaction with the host's own writes), `$batch` in the OData 4.01 JSON format (atomic change sets, `$<id>` references, `continue-on-error`), `authorize` (called for every request, also inside a batch).
- smart-kit-core: `DataProvider.batch`, `writeAll`, `RolledBackError`, `ODataV4Provider` / `loadService` option `batch: 'json'`, `ActionModel.invocationGrouping`.
- smart-kit: deleting or mass-editing the selected rows and actions on several rows are one `$batch` request when the provider has `batch`; `ObjectPage` `onActionDone`; `ListReport` `navigationParameter` (inbound navigation) and absolute-path `controlConfiguration` keys for the tables of other entity sets; `autoPopinWidth` on responsive table columns.
- smart-kit-core / smart-kit: `NavigationAdapter.toCreate` — with it, "Create" of a list without draft whose creation mode is NewPage opens the object page in create mode, so creating and editing share one page; without it the dialog stays.
- smart-kit-cli: `generate` and `check` accept a schema without tables (an empty entity container).

### Changed — behaviour

- Responsive table: the automatic pop-in follows sap.m.Table (columns stay while their widths fit, by importance; the most important column always stays) instead of two fixed breakpoints.
- Object page: footer actions at the right end; the first section's title is visually hidden; sub-section blocks in 1 / 2 / 3 / 4 columns; overrides of sections and actions hidden by `UI.Hidden` no longer show up as untitled custom ones.
- List report: a view tab of another entity set without its own absolute-path key now takes the relative `@UI.LineItem` configuration (as Fiori elements does); switching the view tab marks the view as modified.
- smart-kit-server: hooks and unmanaged saves get `Edm.Decimal` / `Edm.Int64` values as numbers also when the client sent them as strings (`IEEE754Compatible`), as rows that were read have them.
- Grid tables: named by their header for assistive technology; the grid's screen reader texts are translated; group names of analytical tables are left-aligned.

## [0.4.0] - 2026-11-18

### Changed — behaviour (SAPUI5 alignment, stage 7, D48)

- smart-kit: object page sub-tables share the list report's table mapping; object page header / footer / section toolbars follow FE (`priority`, `group`, `overflowGroup`, `overflowGroups`, `defaultAction`, `applyObjectPageEmphasisRules`, `shareOverflowPriority` High); `defaultValuesFunction`, `afterExecution`; table `$ActionGroupSettings` with `defaultAction`, toolbar `template` content, column overrides, `showDataFieldsLabel`, `settings.mergeCells`, `exportSettings`, `aiNotice`, `formatOptions`; `useSemanticDateRange`, filter field `settings`. Settings FE accepts without effect are declared the same way.
- Behaviour as FE: unrestricted date filter fields only have basic operators; the action parameter dialog follows FE OperationParameterDialog (typed fields from annotations, defaults, mandatory by `Common.FieldControl`, typed request body); table micro charts show only the chart.
- The deviation register holds only kit-extension, react-idiom, no-binding and entries kept by decision D48 (`tests/unit/deviations-final.test.ts`, AL-31). smart-kit-core: `ActionParameterModel`, `actionParameterState` / `Defaults` / `Body` / `Errors`, `skipsParameterDialog`.

### Changed — breaking (SAPUI5 alignment, stage 6, D47)

- smart-kit: the nine sap.suite.ui.microchart controls replace `MicroChart kind=…` for data-only charts (`suite/ui/microchart/*`, UI5 properties: `actual`, `targetValue`, `columns`, `points` / `lines`, `data`, `bars`, `fraction` / `total`, `value1` / `value2` …); `m/p13n/Popup` with `SelectionPanel` / `SortPanel` / `GroupPanel` replaces the table and chart personalization dialogs; `m/QuickView` family; landmark info modules; enums `Size`, `ValueColor`, `P13nPopupMode`, `PlacementType`, `QuickViewGroupElementType`, `ListKeyboardMode`, `ListGrowingDirection`, `SwipeDirection`, `ListItemActionType` in `m/library`, `AccessibleLandmarkRole` in `ui/core/library`.
- sap.fe.macros members of 1.154 on Table / TreeTable / Chart / FilterBar / Field / Form, and the remaining ListReport / ObjectPage manifest settings that do not need the SAP runtime (docs/26b, docs/26c; AL-13: 0 unregistered).
- Behaviour as FE: collapsible grouped analytical table (subtotals in the group header while collapsed), list report grid tables always Auto (manifest `rowCountMode` / `rowCount` ignored, FE `_getTableMode`), "New Object" dialog before NewPage creation on draft lists, chart personalization on by default, mass edit and paste, toolbar overflow groups and priorities, object page header action order and Delete / Edit visibility, FE sort query row in the sort panel. smart-kit-core: analytical `groupLevels`, leaf counts and level filters.

### Changed — breaking (SAPUI5 alignment, stage 5, D46)

- smart-kit: `SmartListReport` → `v4/fe/templates/ListReport`, `SmartObjectPage` → `v4/fe/templates/ObjectPage`; the `/templates` subpath is removed. Props are the Fiori elements manifest settings (docs/26c), checked by `scripts/check-manifest-settings.mjs` in `npm run check:ui5` (AL-13).
- Defaults follow FE: `liveMode` false, `initialLoad` 'Auto', responsive table when no `tableSettings.type`, FE page sizes (`threshold`), NewPage creation on draft lists, view tab counts via `/$count`; the object page has no "Edit Header" dialog (`editableHeaderContent`: header facets in a "Header" section in edit mode), side content belongs to sub-sections, empty sub-object tables show an illustration.

### Changed — behaviour (SAPUI5 alignment, stage 4 tail, D45)

- Analytical table: one Fiori elements style `$apply` with `concat` for the first page, grand total and count; sorting only by grouped or aggregated properties; non-groupable columns read per row; basic search only with the `search` transformation; a failing first request shows the table error and no totals row.
- smart-kit-server: `$apply` supports `concat`, `orderby`, `skip`, `top` and `identity`.
- Value helps from `Common.ValueListReferences` / `ValueListMapping` (optional `DataProvider.valueListService`); parameterized entity sets (`Common.ResultContext`, SelectionVariant Parameters) in the list report.
- As real FE 1.154 (checked in 60 FE comparison scenarios): no row highlight for a constant `UI.Criticality`; date-times with seconds; FE's personalization property lists; toolbar overflow only when needed; singular delete confirmation texts; typeahead requests without `$count`.

### Changed — behaviour (SAPUI5 alignment, stage 4 tail: analytical table requests)

- The analytical table (`type="AnalyticalTable"`, not grouped) reads as Fiori elements 1.154 does: the first page, the grand total and the count in one `$apply` (`concat(aggregate(…),groupby((keys, groupable columns),aggregate(…))/orderby(…)/concat(aggregate($count as UI5__count),top(n)))`); following pages are plain list requests; properties the first page does not deliver are read per rendered row; `$orderby` keeps only grouped and aggregated properties; the `OperationAvailable` of toolbar actions is read when a row is selected. A failing first request fails rows and totals together.
- smart-kit-core: `buildAnalyticalRequests`, `ANALYTICAL_COUNT_ALIAS`; `QueryRequest.analytical`, `QueryResult.grandTotal`; `MemoryProvider` answers analytical requests.
- smart-kit-server: `$apply` transformations `concat`, `orderby`, `skip`, `top`, `identity` and `aggregate($count as …)` after `groupby`.

### Changed — behaviour (SAPUI5 alignment, stage 4, D43)

- List report columns and actions follow Fiori elements 1.154 (checked by `npm run e2e:fe`, 37 scenarios): one column per inline action, disabled when unavailable; data point, field group, connected fields and contact columns; row highlight from `UI.LineItem@UI.Criticality` (D41); toolbar order, action groups, copy action, `CreateHidden` / `DeleteHidden`, per-row `Deletable`, `Common.IsActionCritical`.
- Filter bar and value help: strictest `FilterExpressionRestrictions` and FE operators; all FE semantic date operators (relative dates are `ge … and le …`, no parentheses); `UI.HiddenFilter`; default conditions of `UI.Hidden` properties are dropped; `tolower` with `Capabilities.FilterFunctions`; qualified value lists, FE descriptions, 64 rows per page.
- Value display: `mailto:` / `tel:` links, `HTML5.LinkTarget` (same window by default), `Common.ExternalID`, `Common.Masked`, `Common.Timezone`, streams; semantic object links get their targets from the host's `NavigationAdapter` (D42). Requests: `$expand` selects the target keys, lists no longer select the ETag property, TextSeparate texts are not requested.
- Views and charts: SelectionPresentationVariant → PresentationVariant → LineItem; chart-only pages; FE chart types; no chart without `Aggregation.ApplySupported`; analytical / tree table chosen from the annotations when `type` is not set; `UI.KPI` tags.
- smart-kit-core: `Core.IsURL` and `Common.IsUpperCase` are no longer handled; `PropertyModel.criticality`, `isUrl` and `isUpperCase` are removed.

### Changed — behaviour (SAPUI5 alignment, stage 3, D39, D40)

- List report annotations follow Fiori elements 1.154 (checked by `npm run e2e:fe`, 15 scenarios): draft "All" and the six editing states; complete SelectionVariant per view; search field unless `Searchable=false`; `Common.FilterDefaultValue`; value help In/InOut/Constant filters and Out write-back; `Common.IsDigitSequence` padding; disabled unbound actions with `OperationAvailable` false.
- `Aggregation.CustomAggregate` is the authority: totals, charts, KPIs and cards request `aggregate(M)`. Totals and subtotals only in the analytical table (`type="AnalyticalTable"`, user decision D39); no totals without CustomAggregate; several units: one value with "Show Details".
- Charts: all dimensions and measures, grouped by the measure units ("Invalid data" for mixed units, as FE).
- smart-kit-server: `aggregate(Name)` without `with` for custom aggregates and their units.

### Changed — breaking (SAPUI5 alignment, stage 2, D38)

- smart-kit: annotation-driven building blocks follow sap.fe.macros: `SmartTable` → `v4/fe/macros/Table` (and `TreeTable`), `SmartFilterBar` → `v4/fe/macros/FilterBar`, `SmartVariantManagement` → `v4/fe/macros/VariantManagement`, `SmartField` → `v4/fe/macros/Field`, `SmartForm` → `v4/fe/macros/Form`, `ChartView` → `v4/fe/macros/Chart`, `MicroChart` → `v4/fe/macros/MicroChart`, `ShareMenu` → `v4/fe/macros/Share`; new `KPITag`, `Paginator`, `fcl/FlexibleColumnLayoutActions.block`. They take `contextPath` (`'/PurchaseOrders'`) and `metaPath` (`@UI.LineItem#Q`, a property path, …) and use the sap.fe.macros property, event and method names.
- smart-kit: layouts follow their UI5 classes: `f/DynamicPage` with `f/DynamicPageTitle` / `f/DynamicPageHeader`, `f/FlexibleColumnLayout` (`beginColumnPages`…, `onStateChange`), `uxap/ObjectPageLayout` with `uxap/ObjectPageDynamicHeaderTitle`, `uxap/AnchorBar`, `m/Table` (from `ResponsiveTable`), `m/GenericTag` (`status` is a `ValueState`). Defaults follow UI5 (`preserveHeaderStateOnScroll`, `showFooter`, `upperCaseAnchorBar`, `enableLazyLoading`…); the templates pass what they need, so the pages look and behave as before.
- smart-kit: `DraftMarker` and `OverflowActions` are removed (`m/ObjectMarker`, `m/OverflowToolbar`); hooks and components without a UI5 counterpart are in `kit/` (`kit/useFilterState`, `kit/useListQuery`, `kit/ValueHelpDialog`, `kit/smartKitGridTheme`…); helpers in `/util`.
- smart-kit: the subpaths `/field`, `/filter`, `/variants`, `/table`, `/chart`, `/object`, `/page`, `/actions`, `/edit` are removed; the root entry exports only `context`, `i18n`, `theme` and `util`.
- smart-kit: `Field` / `FieldEditor` fire `onChange` when the value is committed (blur or Enter for text) and `onLiveChange` while typing, as sap.fe.macros.Field.

### Changed — breaking (SAPUI5 alignment, stage 1, D37)

- smart-kit: the general controls, message controls, cards and enums are imported by their SAPUI5 module path with the prefix replaced, one class per module, default export: `m/MessageBox`, `m/MessageStrip`, `m/ObjectStatus`, `f/Card`, `f/cards/Header`, `ui/integration/cards/ListContent`, `suite/ui/commons/ProcessFlow`, `m/plugins/UploadSetwithTable`, `ui/unified/Currency`, …; enums from `ui/core/library`, `m/library`, `suite/ui/commons/library` (or their own module: `ui/core/message/MessageType`, `m/IllustratedMessageType`); infrastructure without a UI5 counterpart in `kit/` (`kit/MessageProvider`, `kit/useMessages`, `kit/MessageHost`, `kit/MessageIcon`); `MessageButton` in `v4/fe/macros/MessageButton`. The subpaths `/controls`, `/messages` and `/cards` are removed; the root entry no longer exports these names. The full table is in docs/api.md.
- smart-kit: types use the UI5 TypeScript names: `XxxProps` → `$XxxSettings`, `XxxRef` → the class itself (`useRef<MessageStrip>(null)`), event objects `<Class>$<Event>Event`.
- smart-kit: properties, defaults (`@defaultValue`), events, event parameters and methods of these controls follow SAPUI5 1.154; renamed members and behaviour changes are listed in docs/25 (migration list, stage 1), e.g. `Header icon` → `iconSrc`, `ViewSettingsDialog selectedFilterKeys` → `selectedFilterCompoundKeys`, ProcessFlow events with `oEvent`, `UploadSetwithTable uploader` as an `UploaderTableItem` element.

### Added (SAPUI5 alignment tooling, docs/30–32, ADR-033, stage 0)

- Repository: `npm run check:ui5` compares every public export with the SAPUI5 1.154.0 `api.json` (mapping `tools/ui5-alignment/mapping.json`, deviation register `tools/ui5-alignment/deviations.json`, report `reports/ui5-alignment.md`); `npm run e2e:fe` compares the demo list reports with a real Fiori elements 1.154 app (`apps/fe-reference`, SAPUI5 loaded from ui5.sap.com at runtime). No package changes.

### Added (general controls with SAPUI5 names, docs/26, ADR-032)

- smart-kit: new subpath `/controls`: `ObjectStatus`, `ObjectIdentifier`, `ObjectNumber`, `ObjectMarker`, `ToggleButton`, `IllustratedMessage`, `BusyIndicator`, `BusyDialog`, `Currency`, `ExpandableText`, `OverflowToolbar` (+ `OverflowToolbarButton`, `ToolbarSpacer`), `ProcessFlow`, `MicroProcessFlow`, `Timeline`, `FeedInput`, `FeedListItem`, `UploadSetwithTable`, `DynamicDateRange`, `SelectDialog`, `TableSelectDialog`, `ViewSettingsDialog`, `Wizard`, `IconTabBar` and their enums. Properties, defaults, events (`on` + UI5 event name) and methods (static functions or `ref`) follow the SAPUI5 1.154 API (`docs/26a-ui5-api-1.154.md`).
- smart-kit: message controls in `/messages`: `MessageToast.show`, `MessageBox.*` (return a promise of the action), `MessageStrip`, `MessageView` / `MessageItem`, `MessagePopover`; `SmartKitProvider` renders the `MessageHost`. The footer `MessageButton` now uses `MessagePopover`.
- smart-kit: `SmartTable tableType="TreeTable"` (also `ResponsiveTable`, `Table`, `AnalyticalTable`) for entity types with `Hierarchy.RecursiveHierarchy`; `ref` methods `expand`, `collapse`, `collapseAll`, `expandToLevel`, `isExpanded` and `onToggleOpenState`. `SmartListReport tableType` accepts the UI5 names too.
- smart-kit-core: `buildHierarchyRequest`, `hierarchyOf`, `hierarchyNodeOf`; `QueryRequest.hierarchy`; `MemoryProvider` answers `TopLevels` requests.

## [0.2.0, 0.3.0] - 2026-11-17

Released as 0.2.0 and 0.3.0 from the same changes (the package CHANGELOG.md files list each).

### Added (issues found by invoice-assure on 0.1.0, docs/25)

- smart-kit-server: `$filter` supports the lambda operators `any` / `all` over collection navigations (`_Item/any(i: i/Plant eq '1010')`, `any()`, nested lambdas, `$it`); the target's data scope applies to the rows a lambda sees.
- smart-kit-server: a data scope may use `any` / `all` over the set's collection navigations (`_ScopeKeys/any(k: k/CompanyCode eq '1000')`; inside the lambda body also single-valued navigations); it applies to reads, `$count`, key reads (404), the set as parent in a path, `$expand`, navigation paths and lambdas of other sets, `$apply` and writes. Navigations inside a scope condition see all rows of their targets (no recursion) (S1).
- smart-kit-server: the storage mapping can carry the join of a navigation (`entitySets.<Set>.navigations.<name>.on`), used when `$metadata` has no referential constraints.
- smart-kit-server: `createKysely(pool, { statementTimeout, keepSettings })` builds Kysely on the host's `pg` pool with the session settings of `createPostgresDb` (UTC, statement timeout), restored when the connection goes back to the pool; `KyselyOnPoolOptions` (S13).
- smart-kit-cli: navigations without a foreign key (views) are declared in `smart-kit.config.json` (`navigations.<name>` with `from`, `to`, `on`, `toMany` or `toOne`, optional `partner`) and generated into the CSDL and the storage mapping; `generate` warns about, and `check` (`--strict`) reports, declarations whose tables, views or columns do not exist; `checkDeclaredNavigations`, `DeclaredNavigationConfig`, `StorageFile` exported (S2).
- Tables: `exportable` (default true) and `onBeforeExport` / `onExported` with `ExportEvent` (filters, search, sort, columns, row count of the file); `onBeforeExport` returning false writes no file; also on `SmartListReport` (S4).
- `MemoryProvider` is documented as the "rows from the host" source (filters, search, sort, count, grouping, totals in the browser); `setRows(entitySet, rows)` (S5).
- Date filter conditions take relative dates (today, yesterday, tomorrow, this / last / next week, month, quarter and year, last / next X days, year to date): views store the operator, resolved against today in the provider's time zone each time the list is read (`RELATIVE_DATE_OPERATORS`, `relativeDateRange`, `resolveCondition`, `todayIn`, `isRelativeDateOperator`, types `RelativeDateOperator`, `ValueOperator`; `FilterOptions.today` / `weekStartsOn`). Date filter fields get a "Relative dates" button, the value help offers them under "Define Conditions"; `relativeDateText` (S6).
- New stylesheet `@rhfan2019/smart-kit/styles.layered.css`: the same styles inside `@layer smart-kit` (S8).
- The React entries (all except `/i18n`) start with `'use client'` for the Next.js App Router (S9).
- Views: `VariantStore.canSave` (`ODataVariantStore` option `canSave`, `ODataVariantStoreOptions`), `SmartVariantManagement` `canSave`, `SmartListReport` `canSaveVariants`, `VariantsApi.canSave`: false leaves only selecting views (S15).
- `SmartListReport` `refreshToken`: reloads the tables, tab counts and chart (S16).
- Custom columns take `importance` (responsive table pop-in); CSS variable `--sk-sticky-top` for host sticky bars above pages that scroll with the window (S17).
- Object page header without an image: an initials avatar from `UI.HeaderInfo/Initials`, for types with `Communication.Contact` from the title; round for persons, rounded square otherwise (`HeaderInfoModel.initials`, `person`) (S19).
- `SmartObjectPage` `partialHeaderEdit` (default true) and `share` (default true) (S20, S21).
- `FlexibleColumnLayout` shows column separators with arrow buttons that switch between the column ratios through `onLayoutChange`; new layouts `TwoColumnsBeginExpanded`, `ThreeColumnsEndExpanded`, `ThreeColumnsMidExpandedEndHidden`, `ThreeColumnsBeginExpandedEndHidden`; `separatorArrows={false}` hides the arrows; `fclArrows`, type `FclArrow` (S23).
- `typedText`, type `TypedKey`.
- Grid tables group too (docs/23 §9, D30): a group header row before each group with the group value, the row count and the subtotals of the totaled columns, computed by the service; grouped grid tables load rows in blocks of 100 while scrolling; group rows cannot be selected or opened; one level, no collapsing; without AG Grid Enterprise. The "Group" tab of the view settings and `UI.PresentationVariant/GroupBy` apply to grid tables; `Subtotals.version` (S3).

### Changed (docs/25)

- Texts no longer say "object": "User created.", "This User does not exist.", without a type name "Created." (`create.done`, `delete.done`, `edit.conflict`, `object.notFound`, `object.loadError` and new `…Type` keys) (S22).
- Themes and densities switch with `data-sk-theme` / `data-sk-density`. The former `data-theme` / `data-density` still work while `<html>` has no `data-sk-theme` / `data-sk-density`; a host that uses `data-theme` itself sets `data-sk-theme="host"` (S7).
- Value list values in filter fields (dropdown, suggestions, tokens) follow `UI.TextArrangement`: `TextOnly` shows the text without the code (`arrangeText`, `valueListTextArrangement`; `conditionText` takes `{ t, textArrangement }`) (S14).
- Pop-in labels of responsive tables are at least `--sk-size-popin-label` wide and no longer wrap short labels (S17).

### Fixed (docs/25)

- A failed view save (Save, Save As, Manage) shows the store's error; the Save As dialog stays open (S15).
- The view menu closes before its dialogs open, so it no longer floats above the dialog overlay (S18).
- A failed "Edit Header" save cancels the edit session of any strategy (draft, direct, host `editStrategy`), not only drafts (S20).
- Export errors are shown as messages instead of an unhandled promise.

### Added (grouping, subtotals and totals, ADR-031)

- Tables: a "Totals" tab in the view settings (columns from `Aggregation.ApplySupported` `AggregatableProperties`, default from `UI.PresentationVariant/Total`); grid tables show a pinned totals row, responsive tables a sticky totals row; amounts per currency or unit, computed by the service for the current filters and search (`$apply`), not from the loaded rows.
- Responsive tables: group headers show the row count and the subtotals of the group; only `GroupableProperties` can be grouped by (all sortable columns without `Aggregation.ApplySupported`); default grouping from `UI.PresentationVariant/GroupBy`; subtotals are requested only for the groups loaded so far, at most 50 per request.
- `SmartTable` props `groupBy`, `onGroupByChange`, `totals`, `onTotalsChange`, `presentation`; `TableP13nDialog` props `totalable`, `totals`; `ResponsiveTable` props `groupSummary`, `totals`; `VariantContent.groupBy` and `totals` (the list report stores them in variants).
- core: `buildTotalsRequest`, `collectTotals`, `canTotal`, `canGroup`, `canSubtotal`, `unitPathOf`, `groupKey`, `TOTAL_COUNT_ALIAS`, `MAX_GROUP_VALUES`, types `AggregationModel`, `TotalsEntry`, `TotalAmount`, `TotalsRequestOptions`; `CapabilityModel.aggregation`; `PresentationModel.groupBy` and `total`; `QueryRequest.aggregate` measures accept `countdistinct`, `count` (`$count as`) and an alias; `MemoryProvider` evaluates them.
- smart-kit-server: `$count as <alias>` in `aggregate()`.

### Added (npm publishing and docs for coding agents, ADR-029, ADR-030)

- The packages can be published and installed from npm: `exports` resolve to `dist` (the repository resolves the sources through the custom condition `smart-kit-source`; npm does not apply `publishConfig.exports`, so the previous manifests would have pointed to missing `src` files), `publishConfig.access: public`, repository / homepage / keywords, a README and LICENSE in every package; peer dependencies are `^` ranges.
- Versioning with Changesets (one `fixed` group for the four packages) and a release workflow with npm trusted publishing (provenance). From 0.1.0 on, each package also has a `CHANGELOG.md` generated by Changesets; this file keeps the history up to 0.1.0.
- `scripts/verify-pack.mjs` (`npm run verify:pack`, in CI): installs the packed tarballs into fresh Vite + React and Node projects outside the repository and checks every subpath, the types (bundler and nodenext), the MicroChart-only size, `styles.css`, the server and the CLI.
- Docs for coding agents inside the packages: `docs/README.md`, `docs/recipes.md`, `docs/annotations.md`, `docs/pitfalls.md`, a generated `docs/reference.md` (every export and prop, from TSDoc), and the skill `skills/smart-kit-getting-started/SKILL.md`; code blocks are type-checked in CI (`tests/unit/agent-docs.test.ts`).
- smart-kit-cli: `smart-kit agents` writes an index of those docs into `AGENTS.md` and `@AGENTS.md` into `CLAUDE.md`; `agents`, `agentsBlock`, `AgentsResult` exported.
- TSDoc for the props of the public components.

### Added (OData service on PostgreSQL, ADR-027)

- `@rhfan2019/smart-kit-server` writes (ADR-018 direct save, ADR-024 actions): PATCH with If-Match (412 on a stale ETag, the ETag property counts up), POST to an entity set or a collection navigation (201, Location), DELETE, bound actions declared in an annotation file; one transaction per request; the data scope applies to writes; values checked against the Edm types and MaxLength; database constraint errors as OData errors; `sap-messages`. Writes are opt-in per entity set (`entitySets` option with `creatable`, `updatable` and before/after hooks for create, update, delete), actions are implemented in `actions`; `validationError()` for 400 with field targets; `afterRead` changes rows before they are returned (language-dependent texts); `readOnly`; `$count` with `$apply`; `boundActions`.
- New package `@rhfan2019/smart-kit-server` (Node only): an OData V4 service on PostgreSQL. URL -> AST -> query plan -> SQL: own `$filter` / `$search` / `$apply` parsers on chevrotain (grammar adapted from `@sap-ux/fe-mockserver-core`, Apache-2.0, see its NOTICE) with typed literals checked against `$metadata`; Capabilities annotations enforced; a data scope (permissions) per entity set added wherever the set is read; SQL composed with Kysely (every value a parameter, names only from the metadata, LIKE escaping, key appended to ORDER BY, `COUNT(*) OVER()`, `$expand` via `LEFT JOIN LATERAL` + `json_agg`, max page size with next links). `$metadata` merges the generated CSDL with hand-written annotation files and per-language label bundles. Web-standard `Request` -> `Response` handler (`createODataService`), `toNodeListener`, `createPostgresDb`. Anything outside what smart-kit sends answers `501`.
- New package `@rhfan2019/smart-kit-cli` (command `smart-kit`): `generate` reads a PostgreSQL schema (tables, primary and foreign keys, column comments) and writes the generated CSDL and storage mapping, then reports annotation targets and paths that no longer exist; `check` does the latter without a database.
- `apps/pg-server`: the purchasing test bed on PostgreSQL (`npm run pg:setup`, `npm run pg`, port 4402), same data and business rules as the in-memory test service (rules in `rules.ts`), saved views in a `variant` table, `POST /test/reset` with `E2E=1`; `npm run e2e:pg` runs the demo's list, object page, edit, action, view, chart and server-rule scenarios against it; a conformance test compares both services for reads and writes.
- smart-kit-cli: actions and functions declared in an annotation file count as targets of the annotation check; tables can be left out (`"skip": true`).
- Demo: `PURCHASING_URL` serves `/odata/purchasing/` from another service.

### Fixed

- core: `Core.OptimisticConcurrency` on the entity set (where the Core vocabulary applies it) now sets the ETag property of the model, not only the annotation on the entity type.

### Added (cards, ADR-028, see docs/20)

- New subpath `@rhfan2019/smart-kit/cards` with SAP Fiori cards named as in SAPUI5: `Card` (sap.f.Card), `Header`, `NumericHeader`, `NumericSideIndicator` (sap.f.cards), and the annotation-driven contents `ListContent` (standard, extended, bar), `TableContent`, `ObjectContent`, `AnalyticalContent`, `TimelineContent`, `CalendarContent` (sap.ui.integration.cards). Settings use the OVP card names (`annotationPath`, `presentationAnnotationPath`, `selectionAnnotationPath`, `chartAnnotationPath`, `dataPointAnnotationPath`, `identificationAnnotationPath`, `maxItems`, `listType`, `listFlavor`).
- Header counter ("5 of 40"), default header title and navigation from the content; numeric KPI header from a `UI.DataPoint` summed on the server (state from `CriticalityCalculation`, trend from `TrendCalculation`, target and deviation).
- Calendar card with week numbers, special days, legend, appointments of the selected day and the four-level date drill-down (days, months, years, year ranges); two columns above 589 px.
- Sizes measured on the SAPUI5 1.154 integration cards (Horizon) as card tokens `--sk-card-*`; comparison in docs/20 §9, screenshots in docs/21-evidence, acceptance criteria in docs/22 (checked by `npm run trace -- --strict`).
- `ListContent`: `highlight` (6 px state line) and `showStateIcon`; groups from `UI.PresentationVariant/GroupBy` (list and table); with `listFlavor="bar"` a data point with a target value is a bullet micro chart. `TableContent`: the identifier column is a link with the `UI.HeaderInfo` description below; `Progress` data points are progress bars.
- New theme `sky` (light, Horizon-like colours measured on SAPUI5 1.154), next to `yellow`, `navy` and `dark`.
- `SimpleChart` draws `line` and `donut` too.
- Core: `parseAnnotationPath`, `calculateTrend`; the model keeps every qualified `UI.LineItem`, `UI.PresentationVariant` (with `MaxItems`), `UI.SelectionVariant`, `UI.DataPoint`, `UI.FieldGroup`, the `UI.Identification` fields, `Communication.Event` and `UI.TrendCalculation` (types `PresentationVariantModel` with `groupBy`, `EventModel`, `TrendCalculationModel`); `$apply` without dimensions is `aggregate(…)`.
- Test service: `SupplierMeetings` (Communication.Event) and card annotations on `PurchaseOrders`. Demo: card page `/cards`.
- `npm run size` budgets for `/cards` and the card scenarios; with the cards the stylesheet budget is 16 KB (was 13 KB) and the root entry (all subpaths together) 95 KB (was 80 KB, AC-Q-02).

### Changed (bundling, ADR-026)

- `@rhfan2019/smart-kit` now builds one output file per source file and offers subpath entries (`/context`, `/i18n`, `/theme`, `/util`, `/field`, `/filter`, `/variants`, `/table`, `/chart`, `/object`, `/page`, `/actions`, `/edit`, `/messages`, `/templates`). The root entry still exports everything. An application that imports only `MicroChart` now ships 5.1 KB gzip instead of about 505 KB.
- AG Grid modules are registered the first time a `SmartTable` renders, not when the module loads; `ag-grid-community` and `ag-grid-react` are optional peer dependencies (needed only for `/table` and `/templates`).
- `npm run size` checks a budget per entry and per application scenario (MicroChart only, SmartField only, list report, object page).

### Added (phase 3, micro charts, see docs/15)

- Demo: micro chart scenario page (`/microcharts`): every chart type in the business situation the SAP guidelines give for it, at the size of its place, with a supplier table of chart cells.

- Micro charts follow the SAP Fiori guidelines (docs/15, decision D08): they fill their container within 64×18 – 320×94 px, hide labels by the measured height, and hide numbers that do not fit instead of cutting them; "No data" placeholder (empty in table cells).
- Bullet: forecast bar, threshold markers and colours from `UI.CriticalityCalculation`, delta mode (`UI.VisualizationType/DeltaBulletChart`); Radial: without `TargetValue` the value is the percentage; Harvey Ball: the total is `MaximumValue`, qualitative palette colour without criticality.
- Micro charts in table and form cells (`UI.DataFieldForAnnotation` to a `UI.Chart` of the row, of a single-valued navigation, or over a collection navigation).
- All nine micro charts: Area (actual and dotted target lines, threshold areas from `CriticalityCalculation`, wide view) and Stacked Bar (percent of the sum or of a maximum, `Common.Text` labels) are new; Line draws up to three lines (one per measure) with threshold line, focus points and fixed scale; Column has start/end value and dimension labels (optional label per column); Comparison shows up to 12 bars with three width-dependent layouts; Delta shows names left, values right, the delta in the middle.
- Charts over a collection navigation are read with `$expand(…;$orderby=…;$top=…)` (ADR-025); core exports `chartExpand`, `chartSeriesSelect`, `chartIsSeries`, `MICRO_CHART_MAX_POINTS`, `MICRO_COMPARISON_MAX_BARS`; `ExpandSpec` has optional `orderBy` and `top`; the memory provider applies them.
- Appearance aligned with the SAPUI5 1.154 samples (docs/15 §7): bullet labels above/below the bar, threshold lines across the bar; comparison tracks; solid area threshold areas; delta layout; text alternatives name the semantic state.
- Phase-3 acceptance criteria (docs/17) are checked by `npm run trace -- --strict`.
- Model: DataPoint `ForecastValue`, `CriticalityCalculation`, `ValueFormat`, `DeltaBulletChart`; core exports `calculateCriticality` and the types `CriticalityCalculationModel`, `ImprovementDirection`; react exports the type `MicroChartThreshold`.
- Theme tokens: qualitative chart palette `--sk-color-chart-1…11` per theme, `--sk-chart-palette-1…11`, micro chart size limits.

### Changed (phase 3)

- `UI.ChartType` for micro charts: only the eight types of the OData V4 Fiori Elements (`Bullet`, `Donut`, `Pie`, `Column`, `Line`, `Area`, `Bar`, `BarStacked`). `Waterfall` no longer draws a delta chart, and `VerticalBullet`, `ColumnStacked`, `HorizontalWaterfall` are no longer accepted; `Area` and `BarStacked` are no longer drawn as line and comparison charts (their own charts follow).
- Delta micro chart without thresholds is neutral (was green / red by sign); line data points are hidden by default; comparison shows up to 12 bars (was 4) and `MICRO_COMPARISON_MAX` is 12.
- `MicroChart`: the `size` prop is ignored (the size follows the container); the fixed size tokens `--sk-microchart-width`, `-height`, `-width-s`, `-height-s`, `-circle`, `-circle-s`, `-ring-width` are removed.

### Fixed (phase 3)

- Header chart facets over a collection keep their footer line while the data loads, so the header no longer grows when it arrives (anchor navigation landed below the anchor bar on slow machines).

- `Decimal` constants in annotations (for example DataPoint `MinimumValue Decimal="0"`) were ignored.

### Added (phase 2, see docs/12–14)

- Editing: `DirectEditStrategy` (PATCH + ETag, POST) and `DraftEditStrategy` (Common.DraftRoot actions) with `editStrategyFor`; data provider writes `create`, `remove`, `invoke`; messages from `sap-messages` and error details (`messagesFromHeader`, `messagesFromError`).
- Model: actions (`UI.DataFieldForAction`, `Core.OperationAvailable`), charts (`UI.Chart`), views (qualified `UI.SelectionPresentationVariant`), quick view (`UI.QuickViewFacets`), `UI.Importance`, `Common.FieldControl` Mandatory / ReadOnly, draft actions, header micro chart and plain text facets, aggregated ratings; `buildAggregateRequest` (`$apply`).
- List report: share menu, multiple views (segmented button, select, tabs) and multiple content with counts, chart view with drilldown, responsive table (scroll to load, sticky headers, pop-in by importance, grouping), copy, table / line item actions with menu buttons and partial processing, create dialog, working modes, footer message button and popover, draft editing status and markers.
- Object page: edit and create modes, footer toolbar with finalizing actions, delete with confirmation, temporary "Header" section, partial header edit, inline and dialog creation of subobjects, object marker with the unsaved-changes popover, generic tag, layout blocks, `UI.Importance` in forms, "Show All (x)", paging buttons, dynamic side content, anchor bar carousel buttons, title styles.
- Dynamic page: key information, layout actions (1280px breakpoint), global action overflow from right to left, truncation when collapsed, F6 / Shift+F6, summary line on phones, letterboxing.
- `FlexibleColumnLayout` (one to three columns, layout actions, paging) driven by the host's router.
- Charts: `SimpleChart`, `MicroChart` (bullet, radial, Harvey ball, delta, column, line, comparison) in SVG.
- Filter fields honour `Capabilities.FilterExpressionRestrictions` (single value, multiple values, single range, search expression): the input, the value help and the request only allow what the service accepts; core exports `filterExpressionRules`, `conditionAllowed`, `restrictConditions` and the type `FilterExpressionRules`.
- Test services: writes, bound actions, `sap-messages`, the draft service `/odata/purchasing-draft/`, phase-2 annotations; `scripts/trace.mjs` checks that every docs/13 criterion maps to a passing test.

### Fixed (phase 2)

- Date range filters: the first click no longer completes the range (a range can be picked), and the field shows formatted dates instead of "ll – ll".
- With multiple views or content and a grid table, the tab bar no longer overlaps the table toolbar.
- Expanding a header that was collapsed by the button on a scrolled page shows the header instead of collapsing again.

- Test service memory grew with every `$filter` until it ran out of heap in long e2e runs (engine `getProperty` did not cache misses).

### Changed

- List report: expand/collapse and pin buttons on the header border; the header collapses while the table is scrolled down (unless pinned); `filterToggle` switches to "Show Filters / Hide Filters".
- Object page (anchor navigation): a spacer after the last section lets every anchor scroll its section under the anchor bar.
- `SmartListReport` defaults to live update mode (`liveMode`); "Apply Automatically" is offered only in manual mode (`SmartVariantManagement` `autoApplyOption`).
- `DynamicPage`: buttons centred on the bottom border of the header; snap on click on the title bar; collapsing releases the pin; no pin on small screens or when the header exceeds 60% of the viewport; the header expands and collapses with the keyboard focus.
- Object page: tabs show item counts before they are opened; switching tabs keeps a collapsed header collapsed; the first anchor scrolls to the top; the header image enlarges on press.
- Filter bar token inputs stay one line high; table checkboxes are square; progress indicators in table cells are one line; the search icon is on the right.
- Test services (`apps/mock`) run on Node with `@sap-ux/fe-mockserver-core`; .NET is no longer needed.

### Fixed

- Object page anchors did nothing when the smooth scroll was cancelled by the header snapping; the clicked anchor stays active at the end of the page.

## [0.1.0] - 2026-11-14

### Added

- Phase 1 (read-only) list report and object page building blocks; see `docs/` for the full scope.
