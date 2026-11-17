# Changelog

All notable changes to `@rhfan2019/smart-kit`, `@rhfan2019/smart-kit-core`, `@rhfan2019/smart-kit-server` and `@rhfan2019/smart-kit-cli` are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the packages use [Semantic Versioning](https://semver.org/).

## [Unreleased]

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
