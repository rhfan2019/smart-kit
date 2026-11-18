import type { Meta, StoryObj } from '@storybook/react-vite';
import type { Condition } from '@rhfan2019/smart-kit-core';
import { AdaptFiltersDialog, CriticalityIcon, AnchorBar, ConditionInput, DynamicPage, FilterSummary, HeaderFacet, ObjectPageLayout, SmartField, SmartFilterBar, SmartForm, SmartListReport, SmartObjectPage, SmartTable, SmartVariantManagement, TableP13nDialog, useFilterState, useVariants, ValueHelpDialog } from '@rhfan2019/smart-kit';
import { useState } from 'react';
import { data, model } from './providers';

const meta: Meta = { title: 'smart-kit/Building blocks', parameters: { layout: 'fullscreen' } };
export default meta;
type Story = StoryObj;

const ui = model.ui['Shop.Product']!;
const row = data.Products![0]!;
const full = { height: '100vh' };

export const ListReportTemplate: Story = { render: () => <div style={full}><SmartListReport entitySet="Products" /></div> };
export const ObjectPageTemplate: Story = { render: () => <SmartObjectPage path="Products(1)" /> };

export const Table: Story = { render: () => <div style={{ ...full, display: 'flex', flexDirection: 'column', padding: 16 }}><SmartTable entitySet="Products" /></div> };
export const SubTable: Story = { render: () => <div style={{ padding: 16 }}><SmartTable parent={{ path: 'Products(1)', navigation: '_Review' }} title="Reviews" showSearch /></div> };

function FilterBarDemo() {
  const state = useFilterState('Products', { pageKey: 'story-filter' });
  return <div style={{ padding: 16 }}><SmartFilterBar state={state} /><p><FilterSummary entitySet="Products" filters={state.filters} search={state.search} /></p></div>;
}
export const FilterBar: Story = { render: () => <FilterBarDemo /> };

function ConditionDemo() {
  const [c, setC] = useState<Condition[]>([{ operator: 'EQ', values: ['C1'], text: 'Office' }]);
  const [open, setOpen] = useState(false);
  return (
    <div style={{ padding: 16, maxWidth: 360 }}>
      <ConditionInput entitySet="Products" path="CategoryID" label="Category" conditions={c} onChange={setC} onValueHelp={() => setOpen(true)} />
      <ValueHelpDialog opened={open} entitySet="Products" path="CategoryID" title="Category" conditions={c} onOk={(x) => { setC(x); setOpen(false); }} onCancel={() => setOpen(false)} />
    </div>
  );
}
export const ConditionInputAndValueHelp: Story = { render: () => <ConditionDemo /> };

export const AdaptFilters: Story = { render: () => <AdaptFiltersDialog opened entitySet="Products" fields={['Code']} locked={['Status']} onOk={() => {}} onCancel={() => {}} /> };
export const Personalization: Story = {
  render: () => <TableP13nDialog opened columns={ui.lineItem.map((c) => ({ id: c.id, label: c.label }))} visible={ui.lineItem.slice(0, 3).map((c) => c.id)} sort={[{ path: 'Price', descending: true }]} sortable={[{ path: 'Price', label: 'Price' }, { path: 'Name', label: 'Product Name' }]} onOk={() => {}} onCancel={() => {}} />,
};

function VariantDemo() {
  const v = useVariants('story-variants', { standard: { filters: {} } });
  return <div style={{ padding: 16 }}><SmartVariantManagement variants={v} content={{ filters: { Status: [{ operator: 'EQ', values: ['A'] }] } }} onApply={() => {}} /></div>;
}
export const VariantManagement: Story = { render: () => <VariantDemo /> };

export const Fields: Story = {
  render: () => (
    <div style={{ padding: 16, display: 'grid', gap: 8 }}>
      {['Code', 'Name', 'Price', 'CategoryID', 'Status', 'ReleaseDate', 'ChangedAt', 'Stock', 'Notes'].map((p) => <div key={p}><b>{p}: </b><SmartField entitySet="Products" path={p} row={row} /></div>)}
      {ui.lineItem.filter((c) => c.kind === 'dataPoint').map((f) => <SmartField key={f.id} entitySet="Products" field={f} row={row} />)}
      <SmartField entitySet="Products" path="Name" row={row} mode="edit" />
      <div>{[0, 1, 2, 3, 5].map((c) => <CriticalityIcon key={c} criticality={c} />)}</div>
    </div>
  ),
};

export const Form: Story = { render: () => { const s = ui.sections[0]!.subSections[0]!.content; return s.kind === 'form' ? <SmartForm typeName="Shop.Product" row={row} groups={s.groups} /> : <span />; } };
export const HeaderFacets: Story = { render: () => <div style={{ display: 'flex', gap: 32, padding: 16 }}>{ui.headerFacets.map((f) => <HeaderFacet key={f.id} facet={f} typeName="Shop.Product" row={row} />)}</div> };
export const Anchors: Story = { render: () => <AnchorBar items={[{ id: 'a', title: 'General', subSections: [{ id: 'x', title: 'One' }, { id: 'y', title: 'Two' }] }, { id: 'b', title: 'Reviews', count: 30, subSections: [] }]} active="a" onSelect={() => {}} /> };
export const Page: Story = { render: () => <div style={full}><DynamicPage heading="Dynamic page" header={<div>Header content</div>} filterToggle layout="fill"><div>Content</div></DynamicPage></div> };
export const Layout: Story = {
  render: () => (
    <ObjectPageLayout scope="story" heading="Object" facets={<span>Facets</span>} sections={[
      { id: 's1', title: 'First', subSections: [{ id: 'a', title: 'A', content: <div style={{ height: 400 }}>A</div> }, { id: 'b', title: 'B', content: <div style={{ height: 400 }}>B</div> }] },
      { id: 's2', title: 'Second', subSections: [{ id: 'c', title: 'C', content: <div style={{ height: 600 }}>C</div> }] },
    ]} />
  ),
};
