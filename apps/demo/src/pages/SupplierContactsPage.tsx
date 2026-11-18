/**
 * Supplier contacts: the value display of the list report (docs/29 §5, stage 4) — e-mail and phone links, the contact
 * popover, external links, external IDs, masked values, time zones, data point formats, amounts and quantities.
 * The FE comparison (tests/e2e-fe/display4.spec.ts) opens it next to apps/fe-reference `?app=purchasing-display`; the
 * page passes the settings of that app's manifest (AL-13 F).
 */
import ListReport from '@rhfan2019/smart-kit/v4/fe/templates/ListReport';
import manifest from '../../../fe-reference/webapp/purchasing-display/manifest.json';
import { listReportSettings } from '../feListReport';

const settings = listReportSettings(manifest, { text: (key) => key });

export function SupplierContactsPage() {
  return <ListReport service="purchasing" pageKey="contacts" {...settings} />;
}
