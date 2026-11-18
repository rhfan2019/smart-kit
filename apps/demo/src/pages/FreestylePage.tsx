/**
 * Freestyle page from building blocks: own toolbar replaces the default one and the order type cell is rendered by the
 * app (`Table` `extend`, a smart-kit extension of the building block; AC-EXT-01).
 */
import { Button, Group } from '@mantine/core';
import { useMetaModel } from '@rhfan2019/smart-kit';
import FilterSummary from '@rhfan2019/smart-kit/kit/FilterSummary';
import useFilterState from '@rhfan2019/smart-kit/kit/useFilterState';
import Table, { type TableExtendEntry } from '@rhfan2019/smart-kit/v4/fe/macros/Table';
import useTableContext from '@rhfan2019/smart-kit/kit/useTableContext';
import FilterBar from '@rhfan2019/smart-kit/v4/fe/macros/FilterBar';
import DynamicPage from '@rhfan2019/smart-kit/f/DynamicPage';
import DynamicPageTitle from '@rhfan2019/smart-kit/f/DynamicPageTitle';
import DynamicPageHeader from '@rhfan2019/smart-kit/f/DynamicPageHeader';
import { useShell } from '../App';

function MyToolbar() {
  const { s } = useShell();
  const table = useTableContext();
  return (
    <div className="sk-table__toolbar" data-demo-toolbar>
      <Table.Title />
      <span className="sk-grow" />
      <Group gap="xs">
        <span>{s('customToolbar')}</span>
        <Button variant="default" size="xs" onClick={table.refresh}>{s('refresh')}</Button>
        <Table.Settings />
      </Group>
    </div>
  );
}

// Replace how the order type column is rendered (the raw code).
const EXTEND: TableExtendEntry[] = [
  { id: 'DataField::PurchaseOrderType', position: 'replace', item: (col) => ({ ...col, render: (row) => <code data-demo-type>{String(row.PurchaseOrderType ?? '')}</code> }) },
];

export function FreestylePage() {
  const filter = useFilterState('PurchaseOrders', { pageKey: 'freestyle', liveMode: true });
  const { ui } = useMetaModel('PurchaseOrders');
  return (
    <DynamicPage
      fitContent
      title={<DynamicPageTitle heading={ui.headerInfo.typeNamePlural} snappedContent={<FilterSummary entitySet="PurchaseOrders" filters={filter.filters} search={filter.search} />} />}
      header={<DynamicPageHeader><FilterBar state={filter} /></DynamicPageHeader>}
      data-testid="freestyle"
      content={(
        <Table contextPath="/PurchaseOrders" query={filter.applied} pageKey="freestyle" extend={EXTEND}>
          <MyToolbar />
        </Table>
      )}
    />
  );
}
