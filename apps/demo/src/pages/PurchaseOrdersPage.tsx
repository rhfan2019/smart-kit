/** Purchase order list: the list report template with extensions (AC-EXT-01, AC-EXT-02). */
import { Alert } from '@mantine/core';
import { SmartListReport, type TableExtendEntry } from '@rhfan2019/smart-kit';
import { useMemo, useState } from 'react';
import { useShell } from '../App';

export function PurchaseOrdersPage() {
  const { s } = useShell();
  const [message, setMessage] = useState<string | null>(null);
  const tableExtend = useMemo<TableExtendEntry[]>(() => [
    // Insert a custom column after the supplier column.
    {
      id: 'Custom::Overdue', position: 'after', anchor: 'DataField::Supplier',
      item: { id: 'Custom::Overdue', label: s('overdueColumn'), select: ['StatusCriticality'], width: 110, render: (row) => (row.StatusCriticality === 1 ? <span className="demo__overdue" data-demo-overdue>{s('overdue')}</span> : null) },
    },
    // Replace how the order type column is rendered.
    { id: 'DataField::PurchaseOrderType', position: 'replace', item: (col) => ({ ...col, render: (row) => <code data-demo-type>{String(row.PurchaseOrderType ?? '')}</code> }) },
    // A toolbar action that depends on the selection.
    {
      kind: 'action', id: 'Custom::Copy', position: 'start',
      item: { id: 'Custom::Copy', label: s('copyAction'), requiresSelection: true, onPress: (ctx) => setMessage(s('copied', { ids: ctx.selected.map((r) => String(r.PurchaseOrder)).join(', ') })) },
    },
  ], [s]);
  return (
    <SmartListReport
      entitySet="PurchaseOrders"
      pageKey="po"
      tableExtend={tableExtend}
      beforeTable={message ? <Alert withCloseButton onClose={() => setMessage(null)} data-demo-message>{message}</Alert> : null}
    />
  );
}
