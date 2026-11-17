---
"@rhfan2019/smart-kit-core": minor
"@rhfan2019/smart-kit": minor
"@rhfan2019/smart-kit-server": minor
---

Relative dates in date filter conditions (today, yesterday, this / last / next week, month, quarter and year, last / next X days, year to date): views store the operator and it is resolved against today when the list is read. Value list values in filter fields follow `UI.TextArrangement` (`TextOnly` hides the code). `FlexibleColumnLayout` has column separators with arrows that switch the ratios (new layouts `TwoColumnsBeginExpanded`, `ThreeColumnsEndExpanded`, `ThreeColumnsMidExpandedEndHidden`, `ThreeColumnsBeginExpandedEndHidden`) through `onLayoutChange`. Themes switch with `data-sk-theme` / `data-sk-density` (the former `data-theme` / `data-density` still work unless `<html>` has `data-sk-theme`); new stylesheet `@rhfan2019/smart-kit/styles.layered.css` inside `@layer smart-kit`; the React entries start with `'use client'`.
