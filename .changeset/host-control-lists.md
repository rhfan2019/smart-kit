---
"@rhfan2019/smart-kit-core": minor
"@rhfan2019/smart-kit": minor
---

Fixes for the first consumer (docs/25): grid tables group with row counts and subtotals in group header rows; texts name the record type instead of "object" ("User created.", `typedText`); a failed view save shows the store's error in the dialog and `VariantStore.canSave` / `canSave` / `canSaveVariants` hide Save, Save As and Manage; the view menu closes before its dialogs open; `exportable`, `onBeforeExport` (can cancel) and `onExported` on `SmartTable` and `SmartListReport`; `refreshToken` on `SmartListReport`; `MemoryProvider.setRows` for rows computed by the host; `SmartObjectPage` `partialHeaderEdit` and `share`, a failed partial edit cancels any edit session, initials avatar from `UI.HeaderInfo/Initials` (round for `Communication.Contact`); `importance` on custom columns, wider pop-in labels and `--sk-sticky-top` for host sticky bars.
