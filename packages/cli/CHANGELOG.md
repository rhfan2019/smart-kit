# @rhfan2019/smart-kit-cli

## 0.4.0

### Minor Changes

- 204d8c6: SAPUI5 alignment, stage 1 (docs/31, D37). **Breaking**: the general controls, message controls, cards and enums move to their SAPUI5 module paths with the prefix replaced, one class per module, default export (`import MessageBox from '@rhfan2019/smart-kit/m/MessageBox'`, `import { ValueState } from '@rhfan2019/smart-kit/ui/core/library'`); the subpaths `/controls`, `/messages` and `/cards` are removed and the root entry no longer exports these names. Types follow UI5's TypeScript names (`$MessageStripSettings`, `MessageStrip` as the instance type, `Timeline$FilterSelectionChangeEvent`). Properties, defaults, events and methods follow the SAPUI5 1.154 API; see the migration list in docs/25.
- 89ac1fc: SAPUI5 alignment, stage 2 (docs/31, D38). **Breaking**: the annotation-driven building blocks follow sap.fe.macros (`v4/fe/macros/Table`, `TreeTable`, `FilterBar`, `VariantManagement`, `Field`, `Form`, `Chart`, `MicroChart`, `MessageButton`, `Share`, `KPITag`, `Paginator`, `fcl/FlexibleColumnLayoutActions.block`) with `contextPath` / `metaPath`; layouts follow sap.f / sap.uxap / sap.m (`f/DynamicPage` + `DynamicPageTitle` + `DynamicPageHeader`, `f/FlexibleColumnLayout`, `uxap/ObjectPageLayout`, `uxap/AnchorBar`, `m/Table`, `m/GenericTag`); hooks are in `kit/`. The subpaths `/field`, `/filter`, `/variants`, `/table`, `/chart`, `/object`, `/page`, `/actions`, `/edit` are removed and the root entry exports only the infrastructure. `DraftMarker` and `OverflowActions` are removed (use `m/ObjectMarker`, `m/OverflowToolbar`). `Field` fires `change` when the value is committed and `liveChange` while typing, as UI5. See the migration list in docs/25.

## 0.3.0

### Minor Changes

- 42ec477: smart-kit-server: `$filter` supports the lambda operators `any` / `all` over collection navigations (with `$it` and nested variables), and a data scope may use them (`_ScopeKeys/any(k: k/CompanyCode eq '1000')`); the scope applies to reads, `$count`, key reads, `$expand`, navigation paths and lambdas of other sets, `$apply` and writes (TECH-054). Navigation joins can come from the storage mapping (`entitySets.<Set>.navigations.<name>.on`). New `createKysely(pool, { statementTimeout, keepSettings })` builds Kysely on the host's `pg` pool with UTC sessions and a statement timeout (TECH-066). smart-kit-cli: navigations without a foreign key (views) can be declared in `smart-kit.config.json` (`navigations.<name>` with `from`, `to`, `on`, `toMany` or `toOne`, `partner`); they are generated into the CSDL and the storage mapping, and `smart-kit check` reports declarations whose tables, views or columns do not exist (TECH-055); `checkDeclaredNavigations` exported.

## 0.2.0

No changes in this release.
