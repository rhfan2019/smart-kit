/**
 * Purchase order list: the list report template with extensions (AC-EXT-01, AC-EXT-02) and the phase-2 options.
 * Query parameters (docs/13): mode=manual, views=switch|tabs (views=select shows four views in a select;
 * views=type / type-switch: views by order type from the demo's local annotations, src/annotations.ts),
 * contents=1 (multiple content), table=responsive|auto, chart=1, working=continuous, filterToggle=1.
 */
import { Alert } from '@mantine/core';
import { SmartListReport, type ActionGroup, type TableExtendEntry } from '@rhfan2019/smart-kit';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useShell } from '../App';
import { ORDER_TYPE_VIEWS } from '../annotations';

export function PurchaseOrdersPage({ service = 'purchasing' }: { service?: string }) {
  const { s } = useShell();
  const [message, setMessage] = useState<string | null>(null);
  // Live update by default (list report guideline); ?mode=manual shows the manual mode with "Go".
  const [params] = useSearchParams();
  const manual = params.get('mode') === 'manual';
  const viewsParam = params.get('views');
  const table = params.get('table');
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
  // Similar actions in one menu button (LR Table Toolbar).
  const actionGroups = useMemo<ActionGroup[]>(() => [{ id: 'decide', label: s('decide'), actions: ['DataFieldForAction::Purchasing.approve', 'DataFieldForAction::Purchasing.reject'] }], [s]);
  return (
    <SmartListReport
      key={`${service}:${params.toString()}`}
      service={service}
      entitySet="PurchaseOrders"
      pageKey={service === 'purchasing' ? 'po' : `po:${service}`}
      liveMode={!manual}
      tableExtend={tableExtend}
      actionGroups={actionGroups}
      views={viewsParam === 'type' ? { mode: 'tabs', ids: ORDER_TYPE_VIEWS } : viewsParam === 'type-switch' ? { mode: 'switch', ids: ORDER_TYPE_VIEWS } : viewsParam === 'switch' ? { mode: 'switch', ids: ['Open', 'InDelivery', 'Closed'] } : viewsParam === 'select' ? { mode: 'switch' } : viewsParam === 'tabs' ? { mode: 'tabs', ids: ['Open', 'InDelivery', 'Closed'] } : undefined}
      contents={params.get('contents') ? [{ key: 'orders', entitySet: 'PurchaseOrders', tableExtend }, { key: 'items', entitySet: 'PurchaseOrderItems', title: s('items') }] : undefined}
      tableType={table === 'responsive' || table === 'auto' ? table : 'grid'}
      chart={params.get('chart') ? 'ByStatus' : undefined}
      workingMode={params.get('working') === 'continuous' ? 'continuous' : 'worklist'}
      filterToggle={params.get('filterToggle') === '1'}
      beforeTable={message ? <Alert withCloseButton onClose={() => setMessage(null)} data-demo-message>{message}</Alert> : null}
    />
  );
}
