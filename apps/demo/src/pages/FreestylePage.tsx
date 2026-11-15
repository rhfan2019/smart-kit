/** Freestyle page from building blocks: own toolbar replaces the default one (AC-EXT-01). */
import { Button, Group } from '@mantine/core';
import { DynamicPage, FilterSummary, SmartFilterBar, SmartTable, useFilterState, useMetaModel, useTableContext } from '@rhfan2019/smart-kit';
import { useShell } from '../App';

function MyToolbar() {
  const { s } = useShell();
  const table = useTableContext();
  return (
    <div className="sk-table__toolbar" data-demo-toolbar>
      <SmartTable.Title />
      <span className="sk-grow" />
      <Group gap="xs">
        <span>{s('customToolbar')}</span>
        <Button variant="default" size="xs" onClick={table.refresh}>{s('refresh')}</Button>
        <SmartTable.Settings />
      </Group>
    </div>
  );
}

export function FreestylePage() {
  const filter = useFilterState('PurchaseOrders', { pageKey: 'freestyle', liveMode: true });
  const { ui } = useMetaModel('PurchaseOrders');
  return (
    <DynamicPage
      layout="fill"
      filterToggle
      heading={ui.headerInfo.typeNamePlural}
      summary={<FilterSummary entitySet="PurchaseOrders" filters={filter.filters} search={filter.search} />}
      header={<SmartFilterBar state={filter} />}
      data-testid="freestyle"
    >
      <SmartTable entitySet="PurchaseOrders" query={filter.applied} pageKey="freestyle">
        <MyToolbar />
      </SmartTable>
    </DynamicPage>
  );
}
