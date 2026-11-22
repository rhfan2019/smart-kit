# @rhfan2019/smart-kit-server

## 0.5.0

### Minor Changes

- 62ced7d: Unmanaged save, `$batch` and fixes from the first applications (D51, ADR-034). smart-kit-server: `EntitySetHooks.create` / `update` / `delete` let the application store the entity while the service keeps the protocol; `unitOfWork` with `createKyselyOnClient` runs the service inside the host's transaction; `$batch` in the OData 4.01 JSON format with atomic change sets; `authorize` for every request. smart-kit-core: `DataProvider.batch`, `writeAll`, `batch: 'json'` on `ODataV4Provider`. smart-kit: several writes of a page are one batch request; responsive tables pop columns in the way sap.m.Table does; object page footer actions at the right, first section title hidden, `onActionDone`; list report `navigationParameter` and per-entity-set table settings; grid tables are named and their screen reader texts translated. smart-kit-cli: an empty schema is accepted. `NavigationAdapter.toCreate`: with it, "Create" of a list without draft opens the object page in create mode instead of a dialog. Hooks and unmanaged saves get Edm.Decimal / Edm.Int64 values as numbers also when the client sent them as strings (IEEE754Compatible).

### Patch Changes

- Updated dependencies [62ced7d]
  - @rhfan2019/smart-kit-core@0.5.0

## 0.4.0

### Minor Changes

- 204d8c6: SAPUI5 alignment, stage 1 (docs/31, D37). **Breaking**: the general controls, message controls, cards and enums move to their SAPUI5 module paths with the prefix replaced, one class per module, default export (`import MessageBox from '@rhfan2019/smart-kit/m/MessageBox'`, `import { ValueState } from '@rhfan2019/smart-kit/ui/core/library'`); the subpaths `/controls`, `/messages` and `/cards` are removed and the root entry no longer exports these names. Types follow UI5's TypeScript names (`$MessageStripSettings`, `MessageStrip` as the instance type, `Timeline$FilterSelectionChangeEvent`). Properties, defaults, events and methods follow the SAPUI5 1.154 API; see the migration list in docs/25.
- 89ac1fc: SAPUI5 alignment, stage 2 (docs/31, D38). **Breaking**: the annotation-driven building blocks follow sap.fe.macros (`v4/fe/macros/Table`, `TreeTable`, `FilterBar`, `VariantManagement`, `Field`, `Form`, `Chart`, `MicroChart`, `MessageButton`, `Share`, `KPITag`, `Paginator`, `fcl/FlexibleColumnLayoutActions.block`) with `contextPath` / `metaPath`; layouts follow sap.f / sap.uxap / sap.m (`f/DynamicPage` + `DynamicPageTitle` + `DynamicPageHeader`, `f/FlexibleColumnLayout`, `uxap/ObjectPageLayout`, `uxap/AnchorBar`, `m/Table`, `m/GenericTag`); hooks are in `kit/`. The subpaths `/field`, `/filter`, `/variants`, `/table`, `/chart`, `/object`, `/page`, `/actions`, `/edit` are removed and the root entry exports only the infrastructure. `DraftMarker` and `OverflowActions` are removed (use `m/ObjectMarker`, `m/OverflowToolbar`). `Field` fires `change` when the value is committed and `liveChange` while typing, as UI5. See the migration list in docs/25.
- 360b348: SAPUI5 alignment, stage 3 (D39, docs/23 §10): totals and group subtotals follow Fiori elements 1.154 — only the analytical table (`v4/fe/macros/Table` `type="AnalyticalTable"`, `SmartListReport` `tableType="AnalyticalTable"`) groups with subtotals and shows totals; the responsive table groups without counts or subtotals; the grid table (`GridTable`, the default) neither groups nor totals. Only custom aggregates (`Aggregation.CustomAggregate`) are totalled (`canTotal`; no "numeric property with sum" fallback); without `UI.PresentationVariant/Total` an analytical table totals all of them. smart-kit-server accepts `aggregate(Name)` without `with` for declared custom aggregates (the property of the same name, summed, or with the first `SupportedAggregationMethods` entry when sum is not listed). As in FE, the unit is aggregated with the measure (`aggregate(NetAmount,Currency)`; subtotals `groupby((Group,Text),aggregate(NetAmount,Currency,$count as …))`, no longer grouped by the currency): a total over several currencies shows "Show Details", a popover "Totals" / "Subtotals" with the amount per currency (`buildTotalsRequest` option `byUnit`, `TotalAmount.multiUnit`); an empty `PresentationVariant/Total` totals nothing (`PresentationModel.hasTotal`). smart-kit-server returns the unit of a custom aggregate named in `aggregate()` (the currency, or null for several).
- 5e909b2: SAPUI5 alignment, stage 4 tail (docs/31, D45). The analytical table reads its first page, grand total and count in one Fiori elements style `$apply` (`concat`), sorts only by grouped or aggregated properties, reads non-groupable columns per row, and shows the basic search only with the `search` transformation; smart-kit-server supports `concat`, `orderby`, `skip`, `top` and `identity` in `$apply`. Value helps follow `Common.ValueListReferences` / `ValueListMapping` (optional `DataProvider.valueListService`); parameterized entity sets (`Common.ResultContext`, SelectionVariant Parameters) work in the list report. As real FE 1.154: constant `UI.Criticality` row highlights are not shown, date-times show seconds, personalization offers FE's property list, toolbar actions overflow only when they don't fit, delete confirmations have singular texts. See docs/25.

### Patch Changes

- Updated dependencies [204d8c6]
- Updated dependencies [89ac1fc]
- Updated dependencies [360b348]
- Updated dependencies [360b348]
- Updated dependencies [360b348]
- Updated dependencies [5e909b2]
- Updated dependencies [66c48a3]
- Updated dependencies [a8a942b]
- Updated dependencies [ef4ffd0]
- Updated dependencies [8af2d4c]
- Updated dependencies [f7d8b64]
  - @rhfan2019/smart-kit-core@0.4.0

## 0.3.0

### Minor Changes

- 42ec477: Relative dates in date filter conditions (today, yesterday, this / last / next week, month, quarter and year, last / next X days, year to date): views store the operator and it is resolved against today when the list is read. Value list values in filter fields follow `UI.TextArrangement` (`TextOnly` hides the code). `FlexibleColumnLayout` has column separators with arrows that switch the ratios (new layouts `TwoColumnsBeginExpanded`, `ThreeColumnsEndExpanded`, `ThreeColumnsMidExpandedEndHidden`, `ThreeColumnsBeginExpandedEndHidden`) through `onLayoutChange`. Themes switch with `data-sk-theme` / `data-sk-density` (the former `data-theme` / `data-density` still work unless `<html>` has `data-sk-theme`); new stylesheet `@rhfan2019/smart-kit/styles.layered.css` inside `@layer smart-kit`; the React entries start with `'use client'`.
- 42ec477: smart-kit-server: `$filter` supports the lambda operators `any` / `all` over collection navigations (with `$it` and nested variables), and a data scope may use them (`_ScopeKeys/any(k: k/CompanyCode eq '1000')`); the scope applies to reads, `$count`, key reads, `$expand`, navigation paths and lambdas of other sets, `$apply` and writes (TECH-054). Navigation joins can come from the storage mapping (`entitySets.<Set>.navigations.<name>.on`). New `createKysely(pool, { statementTimeout, keepSettings })` builds Kysely on the host's `pg` pool with UTC sessions and a statement timeout (TECH-066). smart-kit-cli: navigations without a foreign key (views) can be declared in `smart-kit.config.json` (`navigations.<name>` with `from`, `to`, `on`, `toMany` or `toOne`, `partner`); they are generated into the CSDL and the storage mapping, and `smart-kit check` reports declarations whose tables, views or columns do not exist (TECH-055); `checkDeclaredNavigations` exported.

### Patch Changes

- Updated dependencies [42ec477]
- Updated dependencies [42ec477]
- Updated dependencies [42ec477]
  - @rhfan2019/smart-kit-core@0.3.0

## 0.2.0

### Minor Changes

- 4056228: List tables show totals and group subtotals computed by the service ($apply), split by currency or unit (ADR-031): a "Totals" tab in the view settings, a totals row in grid and responsive tables, subtotals and row counts in the group headers of responsive tables; defaults from `UI.PresentationVariant` `Total` / `GroupBy`, allowed columns from `Aggregation.ApplySupported`; grouping and totals are stored in variants. smart-kit-server supports `$count as <alias>` in `aggregate()`.

### Patch Changes

- Updated dependencies [4056228]
  - @rhfan2019/smart-kit-core@0.2.0
