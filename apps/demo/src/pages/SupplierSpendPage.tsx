/**
 * Supplier spend: a list report on a parameterized entity set (Common.ResultContext, stage 4 tail) — the parameters
 * "Display Currency" and "Key Date" are mandatory filter fields first, their defaults come from
 * UI.SelectionVariant/Parameters, and the rows are read from SpendParameters(P_DisplayCurrency=…,P_KeyDate=…)/Set.
 * The FE comparison (tests/e2e-fe/vhref.spec.ts) opens it next to apps/fe-reference `?app=purchasing-params`; the page
 * passes the settings of that app's manifest (contextPath "/SpendParameters/Set", AL-13 F).
 */
import ListReport from '@rhfan2019/smart-kit/v4/fe/templates/ListReport';
import manifest from '../../../fe-reference/webapp/purchasing-params/manifest.json';
import { listReportSettings } from '../feListReport';

const settings = listReportSettings(manifest, { text: (key) => key });

export function SupplierSpendPage() {
  return <ListReport service="purchasing" pageKey="spend" {...settings} />;
}
