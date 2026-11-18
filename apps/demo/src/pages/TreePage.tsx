/** Tree table (docs/26 §3.10): the cost center hierarchy with TopLevels; "?table=responsive" uses the responsive kernel. */
import { Button, Group, Text } from '@mantine/core';
import { useMetaModel } from '@rhfan2019/smart-kit';
import FilterSummary from '@rhfan2019/smart-kit/kit/FilterSummary';
import useFilterState from '@rhfan2019/smart-kit/kit/useFilterState';
import TreeTable, { type TreeTable$ToggleOpenStateEvent } from '@rhfan2019/smart-kit/v4/fe/macros/TreeTable';
import FilterBar from '@rhfan2019/smart-kit/v4/fe/macros/FilterBar';
import DynamicPage from '@rhfan2019/smart-kit/f/DynamicPage';
import DynamicPageTitle from '@rhfan2019/smart-kit/f/DynamicPageTitle';
import DynamicPageHeader from '@rhfan2019/smart-kit/f/DynamicPageHeader';
import { useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useShell } from '../App';

export function TreePage() {
  const { s } = useShell();
  const [params] = useSearchParams();
  const responsive = params.get('table') === 'responsive';
  const filter = useFilterState('CostCenters', { pageKey: 'tree', liveMode: true });
  const { ui } = useMetaModel('CostCenters');
  const ref = useRef<TreeTable>(null);
  const [last, setLast] = useState<TreeTable$ToggleOpenStateEvent | null>(null);
  const tools = (
    <Group gap="xs" wrap="nowrap">
      {last ? <Text size="xs" c="dimmed" data-demo-toggle-event>{s(last.expanded ? 'treeExpanded' : 'treeCollapsed', { name: String(last.rowContext.CostCenterName ?? ''), index: last.rowIndex })}</Text> : null}
      <Button variant="subtle" size="xs" onClick={() => ref.current?.expandToLevel(3)} data-demo-expand-all>{s('treeExpandAll')}</Button>
      <Button variant="subtle" size="xs" onClick={() => ref.current?.collapseAll()} data-demo-collapse-all>{s('treeCollapseAll')}</Button>
    </Group>
  );
  return (
    <DynamicPage
      fitContent={!responsive}
      preserveHeaderStateOnScroll
      title={<DynamicPageTitle heading={ui.headerInfo.typeNamePlural} snappedContent={<FilterSummary entitySet="CostCenters" filters={filter.filters} search={filter.search} />} />}
      header={<DynamicPageHeader><FilterBar state={filter} /></DynamicPageHeader>}
      data-testid="tree-page"
      content={(
        <TreeTable
          key={responsive ? 'r' : 'g'}
          contextPath="/CostCenters"
          responsive={responsive}
          query={filter.applied}
          ref={ref}
          onToggleOpenState={setLast}
          toolbarEnd={tools}
          navigable={false}
        />
      )}
    />
  );
}
