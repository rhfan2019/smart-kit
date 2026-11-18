/** Tree table (docs/26 §3.10): the cost center hierarchy with TopLevels; "?table=responsive" uses the responsive kernel. */
import { Button, Group, Text } from '@mantine/core';
import { DynamicPage, FilterSummary, SmartFilterBar, SmartTable, useFilterState, useMetaModel, type SmartTableRef, type ToggleOpenStateEvent } from '@rhfan2019/smart-kit';
import { useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useShell } from '../App';

export function TreePage() {
  const { s } = useShell();
  const [params] = useSearchParams();
  const responsive = params.get('table') === 'responsive';
  const filter = useFilterState('CostCenters', { pageKey: 'tree', liveMode: true });
  const { ui } = useMetaModel('CostCenters');
  const ref = useRef<SmartTableRef>(null);
  const [last, setLast] = useState<ToggleOpenStateEvent | null>(null);
  const tools = (
    <Group gap="xs" wrap="nowrap">
      {last ? <Text size="xs" c="dimmed" data-demo-toggle-event>{s(last.expanded ? 'treeExpanded' : 'treeCollapsed', { name: String(last.rowContext.CostCenterName ?? ''), index: last.rowIndex })}</Text> : null}
      <Button variant="subtle" size="xs" onClick={() => ref.current?.expandToLevel(3)} data-demo-expand-all>{s('treeExpandAll')}</Button>
      <Button variant="subtle" size="xs" onClick={() => ref.current?.collapseAll()} data-demo-collapse-all>{s('treeCollapseAll')}</Button>
    </Group>
  );
  return (
    <DynamicPage
      layout={responsive ? 'flow' : 'fill'}
      heading={ui.headerInfo.typeNamePlural}
      summary={<FilterSummary entitySet="CostCenters" filters={filter.filters} search={filter.search} />}
      header={<SmartFilterBar state={filter} />}
      data-testid="tree-page"
    >
      <SmartTable
        key={responsive ? 'r' : 'g'}
        entitySet="CostCenters"
        tableType="TreeTable"
        mode={responsive ? 'responsive' : undefined}
        query={filter.applied}
        ref={ref}
        onToggleOpenState={setLast}
        toolbarEnd={tools}
        navigable={false}
      />
    </DynamicPage>
  );
}
