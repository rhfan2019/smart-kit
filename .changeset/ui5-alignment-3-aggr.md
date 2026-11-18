---
"@rhfan2019/smart-kit": minor
"@rhfan2019/smart-kit-core": minor
---

SAPUI5 alignment, stage 3 (docs/31; docs/29 §4 P1-2, P1-3): `Aggregation.CustomAggregate` is read (`AggregationModel.customAggregates`) and custom aggregates are requested as Fiori elements requests them, `aggregate(NetAmount)` instead of `NetAmount with sum as NetAmount`, in totals, charts, KPIs and cards; when the entity declares custom aggregates only those can be totalled. The list report chart (`v4/fe/macros/Chart`) sends FE's request (`buildChartRequest`: grouped by all dimensions and the units of the measures, groups sorted, `$count=true`, no `$orderby` and `$top` unless sorted), draws all measures as grouped bars (dimensions with the role Series split them into series) and, as FE, shows "Invalid data / Some measures have different units." instead of adding up amounts in different currencies. New core exports `buildChartRequest`, `aggregateMeasure`, `isCustomAggregate`, types `AggregateMeasure`, `ChartRequestOptions`; `ChartModel.dimensionRoles`.
