---
"@rhfan2019/smart-kit": minor
"@rhfan2019/smart-kit-core": minor
---

SAPUI5 alignment, stage 3 (docs/31, D40). **Behaviour changes** to match Fiori elements 1.154 on the list report: draft lists show own drafts and new drafts under "All" with the six editing-status options (filter key `$editState`, FE ids); each view applies its complete SelectionVariant; the search field is shown unless `Capabilities.SearchRestrictions/Searchable` is false; `Common.FilterDefaultValue` gives default conditions; value helps are filtered by In/InOut/Constant parameters and write Out/InOut back; `Common.IsDigitSequence` input is padded to MaxLength; unbound actions with `Core.OperationAvailable` false are disabled.
