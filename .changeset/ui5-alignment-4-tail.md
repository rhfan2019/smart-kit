---
"@rhfan2019/smart-kit": minor
"@rhfan2019/smart-kit-core": minor
"@rhfan2019/smart-kit-server": minor
---

SAPUI5 alignment, stage 4 tail (docs/31, D45). The analytical table reads its first page, grand total and count in one Fiori elements style `$apply` (`concat`), sorts only by grouped or aggregated properties, reads non-groupable columns per row, and shows the basic search only with the `search` transformation; smart-kit-server supports `concat`, `orderby`, `skip`, `top` and `identity` in `$apply`. Value helps follow `Common.ValueListReferences` / `ValueListMapping` (optional `DataProvider.valueListService`); parameterized entity sets (`Common.ResultContext`, SelectionVariant Parameters) work in the list report. As real FE 1.154: constant `UI.Criticality` row highlights are not shown, date-times show seconds, personalization offers FE's property list, toolbar actions overflow only when they don't fit, delete confirmations have singular texts. See docs/25.
