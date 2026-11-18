/**
 * Supplier spend: a list report on a parameterized entity set (Common.ResultContext, stage 4 tail) — the parameters
 * "Display Currency" and "Key Date" are mandatory filter fields first, their defaults come from
 * UI.SelectionVariant/Parameters, and the rows are read from SpendParameters(P_DisplayCurrency=…,P_KeyDate=…)/Set.
 * The FE comparison (tests/e2e-fe/vhref.spec.ts) opens it next to apps/fe-reference `?app=purchasing-params`
 * (contextPath "/SpendParameters/Set").
 */
import { SmartListReport } from '@rhfan2019/smart-kit/templates';

export function SupplierSpendPage() {
  return <SmartListReport service="purchasing" entitySet="SpendParameters/Set" pageKey="spend" tableType="grid" />;
}
