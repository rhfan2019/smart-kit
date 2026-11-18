---
"@rhfan2019/smart-kit": minor
"@rhfan2019/smart-kit-core": minor
---

SAPUI5 alignment, stage 5 (docs/31, D46). **Breaking**: the page templates follow sap.fe.templates: `SmartListReport` → `v4/fe/templates/ListReport`, `SmartObjectPage` → `v4/fe/templates/ObjectPage` (default exports); the `/templates` subpath is removed. Their props are the Fiori elements manifest settings with the same names, nesting and defaults (`initialLoad`, `liveMode`, `variantManagement`, `views`, `controlConfiguration` › `tableSettings` / `columns` / `actions`, `content.header` / `body.sections` / `footer`, `sectionLayout`, `editableHeaderContent`, `additionalProperties`, …); custom columns, actions, sections and facets are React render functions / handlers under the same keys. Defaults as FE: `liveMode` false, `initialLoad` 'Auto', responsive table when `tableSettings.type` is not set, FE page sizes, NewPage creation on draft lists, view tab counts via `/$count`, no "Edit Header" dialog on the object page (header facets are edited in a "Header" section). See the migration list in docs/25.
