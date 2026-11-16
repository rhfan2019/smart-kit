# Changelog

All notable changes to `@rhfan2019/smart-kit` and `@rhfan2019/smart-kit-core` are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the packages use [Semantic Versioning](https://semver.org/).

## [Unreleased]

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
