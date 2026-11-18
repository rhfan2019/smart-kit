/**
 * Supplier contacts: the value display of the list report (docs/29 §5, stage 4) — e-mail and phone links, the contact
 * popover, external links, external IDs, masked values, time zones, data point formats, amounts and quantities.
 * The FE comparison (tests/e2e-fe/display4.spec.ts) opens it next to apps/fe-reference `?app=purchasing-display`.
 */
import { SmartListReport } from '@rhfan2019/smart-kit/templates';

export function SupplierContactsPage() {
  return <SmartListReport service="purchasing" entitySet="SupplierContacts" pageKey="contacts" tableType="grid" />;
}
