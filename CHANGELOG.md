# Changelog

All notable changes to `@rhfan2019/smart-kit` and `@rhfan2019/smart-kit-core` are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the packages use [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Changed

- List report: the header has the expand/collapse and pin buttons (instead of "Show Filters / Hide Filters") and collapses while the table is scrolled down; `SmartListReport` `filterToggle` restores the previous behaviour.
- `DynamicPage`: the expand/collapse and pin buttons sit centred on the bottom border of the header; `layout="fill"` pages snap through `useDynamicPage().contentScrolled`.
- Filter bar token inputs stay one line high; table checkboxes are square; progress indicators in table cells are one line; the search icon is on the right.
- Test services (`apps/mock`) run on Node with `@sap-ux/fe-mockserver-core`; .NET is no longer needed.

### Fixed

- Object page anchors did nothing when the smooth scroll was cancelled by the header snapping; the clicked anchor stays active at the end of the page.

## [0.1.0] - 2026-11-14

### Added

- Phase 1 (read-only) list report and object page building blocks; see `docs/` for the full scope.
