# Changelog

All notable changes to `@rhfan2019/smart-kit` and `@rhfan2019/smart-kit-core` are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the packages use [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added (phase 2, see docs/12–14)

- Editing: `DirectEditStrategy` (PATCH + ETag, POST) and `DraftEditStrategy` (Common.DraftRoot actions) with `editStrategyFor`; data provider writes `create`, `remove`, `invoke`; messages from `sap-messages` and error details (`messagesFromHeader`, `messagesFromError`).
- Model: actions (`UI.DataFieldForAction`, `Core.OperationAvailable`), charts (`UI.Chart`), views (qualified `UI.SelectionPresentationVariant`), quick view (`UI.QuickViewFacets`), `UI.Importance`, `Common.FieldControl` Mandatory / ReadOnly, draft actions, header micro chart and plain text facets, aggregated ratings; `buildAggregateRequest` (`$apply`).
- List report: share menu, multiple views (segmented button, select, tabs) and multiple content with counts, chart view with drilldown, responsive table (scroll to load, sticky headers, pop-in by importance, grouping), copy, table / line item actions with menu buttons and partial processing, create dialog, working modes, footer message button and popover, draft editing status and markers.
- Object page: edit and create modes, footer toolbar with finalizing actions, delete with confirmation, temporary "Header" section, partial header edit, inline and dialog creation of subobjects, object marker with the unsaved-changes popover, generic tag, layout blocks, `UI.Importance` in forms, "Show All (x)", paging buttons, dynamic side content, anchor bar carousel buttons, title styles.
- Dynamic page: key information, layout actions (1280px breakpoint), global action overflow from right to left, truncation when collapsed, F6 / Shift+F6, summary line on phones, letterboxing.
- `FlexibleColumnLayout` (one to three columns, layout actions, paging) driven by the host's router.
- Charts: `SimpleChart`, `MicroChart` (bullet, radial, Harvey ball, delta, column, line, comparison) in SVG.
- Test services: writes, bound actions, `sap-messages`, the draft service `/odata/purchasing-draft/`, phase-2 annotations; `scripts/trace.mjs` checks that every docs/13 criterion maps to a passing test.

### Fixed (phase 2)

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
