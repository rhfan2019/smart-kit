---
"@rhfan2019/smart-kit": minor
"@rhfan2019/smart-kit-core": minor
"@rhfan2019/smart-kit-server": minor
"@rhfan2019/smart-kit-cli": minor
---

SAPUI5 alignment, stage 1 (docs/31, D37). **Breaking**: the general controls, message controls, cards and enums move to their SAPUI5 module paths with the prefix replaced, one class per module, default export (`import MessageBox from '@rhfan2019/smart-kit/m/MessageBox'`, `import { ValueState } from '@rhfan2019/smart-kit/ui/core/library'`); the subpaths `/controls`, `/messages` and `/cards` are removed and the root entry no longer exports these names. Types follow UI5's TypeScript names (`$MessageStripSettings`, `MessageStrip` as the instance type, `Timeline$FilterSelectionChangeEvent`). Properties, defaults, events and methods follow the SAPUI5 1.154 API; see the migration list in docs/25.
