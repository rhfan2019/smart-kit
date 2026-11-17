# @rhfan2019/smart-kit-core

## 0.2.0

### Minor Changes

- 4056228: List tables show totals and group subtotals computed by the service ($apply), split by currency or unit (ADR-031): a "Totals" tab in the view settings, a totals row in grid and responsive tables, subtotals and row counts in the group headers of responsive tables; defaults from `UI.PresentationVariant` `Total` / `GroupBy`, allowed columns from `Aggregation.ApplySupported`; grouping and totals are stored in variants. smart-kit-server supports `$count as <alias>` in `aggregate()`.
