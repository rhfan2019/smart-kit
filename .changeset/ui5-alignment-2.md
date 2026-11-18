---
"@rhfan2019/smart-kit": minor
"@rhfan2019/smart-kit-core": minor
"@rhfan2019/smart-kit-server": minor
"@rhfan2019/smart-kit-cli": minor
---

SAPUI5 alignment, stage 2 (docs/31, D38). **Breaking**: the annotation-driven building blocks follow sap.fe.macros (`v4/fe/macros/Table`, `TreeTable`, `FilterBar`, `VariantManagement`, `Field`, `Form`, `Chart`, `MicroChart`, `MessageButton`, `Share`, `KPITag`, `Paginator`, `fcl/FlexibleColumnLayoutActions.block`) with `contextPath` / `metaPath`; layouts follow sap.f / sap.uxap / sap.m (`f/DynamicPage` + `DynamicPageTitle` + `DynamicPageHeader`, `f/FlexibleColumnLayout`, `uxap/ObjectPageLayout`, `uxap/AnchorBar`, `m/Table`, `m/GenericTag`); hooks are in `kit/`. The subpaths `/field`, `/filter`, `/variants`, `/table`, `/chart`, `/object`, `/page`, `/actions`, `/edit` are removed and the root entry exports only the infrastructure. `DraftMarker` and `OverflowActions` are removed (use `m/ObjectMarker`, `m/OverflowToolbar`). `Field` fires `change` when the value is committed and `liveChange` while typing, as UI5. See the migration list in docs/25.
