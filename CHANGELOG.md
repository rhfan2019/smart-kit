# Changelog

All notable changes to `@rhfan2019/smart-kit` and `@rhfan2019/smart-kit-core` are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the packages use [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Changed

- List report (grid table): "Show Filters / Hide Filters", no snap on scroll and no pin, as the guideline prescribes; `SmartListReport` `filterToggle={false}` shows the expand/collapse button instead.
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
