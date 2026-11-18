/** Phase 2 building blocks (docs/13): charts, messages, editing, drafts, responsive table, layouts. */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '@mantine/core';
import { MICRO_COMPARISON_MAX } from '@rhfan2019/smart-kit';
import CreateDialog from '@rhfan2019/smart-kit/kit/CreateDialog';
import FieldEditor from '@rhfan2019/smart-kit/kit/FieldEditor';
import QuickViewLink from '@rhfan2019/smart-kit/kit/QuickViewLink';
import { SmartObjectPage } from '@rhfan2019/smart-kit/templates';
import TableMacro from '@rhfan2019/smart-kit/v4/fe/macros/Table';
import MTable from '@rhfan2019/smart-kit/m/Table';
import DynamicPage from '@rhfan2019/smart-kit/f/DynamicPage';
import DynamicPageTitle from '@rhfan2019/smart-kit/f/DynamicPageTitle';
import FlexibleColumnLayout, { type $FlexibleColumnLayoutSettings } from '@rhfan2019/smart-kit/f/FlexibleColumnLayout';
import GenericTag from '@rhfan2019/smart-kit/m/GenericTag';
import ObjectMarker from '@rhfan2019/smart-kit/m/ObjectMarker';
import Share from '@rhfan2019/smart-kit/v4/fe/macros/Share';
import FlexibleColumnLayoutActions from '@rhfan2019/smart-kit/v4/fe/macros/fcl/FlexibleColumnLayoutActions.block';
import SimpleChart from '@rhfan2019/smart-kit/kit/SimpleChart';
import ChartMacro from '@rhfan2019/smart-kit/v4/fe/macros/Chart';
import MicroChart from '@rhfan2019/smart-kit/v4/fe/macros/MicroChart';
import MessageButton from '@rhfan2019/smart-kit/v4/fe/macros/MessageButton';
import MessageIcon from '@rhfan2019/smart-kit/kit/MessageIcon';
import MessageProvider from '@rhfan2019/smart-kit/kit/MessageProvider';
import useMessages from '@rhfan2019/smart-kit/kit/useMessages';
import { createMessage } from '@rhfan2019/smart-kit-core';
import { useState } from 'react';
import { data, model } from './providers';

const meta: Meta = { title: 'smart-kit/Phase 2', parameters: { layout: 'fullscreen' } };
export default meta;
type Story = StoryObj;

const pad = { padding: 16 };

export const MicroCharts: Story = {
  // Micro charts fill their container (docs/15 MC-02); each one gets a header facet sized box here. All rules: "Phase 3".
  render: () => (
    <div style={{ ...pad, display: 'flex', gap: 24, flexWrap: 'wrap' }}>
      {[
        <MicroChart key="b" kind="bullet" label="Budget" value={1200} target={1440} />,
        <MicroChart key="r" kind="radial" label="Delivered" value={52} target={100} />,
        <MicroChart key="h" kind="harvey" label="Received" value={3} max={8} />,
        <MicroChart key="d" kind="delta" label="Invoiced" value={900} target={1200} />,
        <MicroChart key="c" kind="column" label="Amounts" points={[{ label: '1', value: 3 }, { label: '2', value: -1 }, { label: '3', value: 5 }]} />,
        <MicroChart key="l" kind="line" label="Quantities" points={[{ label: '1', value: 3 }, { label: '2', value: 4 }, { label: '3', value: 2 }]} />,
        <MicroChart key="m" kind="comparison" label={`Top ${MICRO_COMPARISON_MAX}`} points={[{ label: 'A', value: 30 }, { label: 'B', value: 12 }]} onPress={() => undefined} />,
      ].map((chart) => <div key={chart.key} style={{ width: 160, height: 72 }}>{chart}</div>)}
    </div>
  ),
};

export const Chart: Story = {
  render: () => <div style={pad}><SimpleChart kind="column" title="Revenue" measureLabel="Revenue" dimensionLabel="Status" data={[{ key: 'A', label: 'Active', value: 12 }, { key: 'B', label: 'Blocked', value: 5 }]} onSelect={() => undefined} /></div>,
};

// The shop fixture has no UI.Chart; the story adds one (as `@UI.Chart#S` would).
model.ui['Shop.Product']!.charts.S ??= { id: 'S', title: 'Price by status', chartType: 'Column', dimensions: ['Status'], measures: ['Price'], dataPoints: {}, navigation: '', typeName: 'Shop.Product' };

export const ChartOfAList: Story = {
  render: () => (
    <div style={pad}>
      <ChartMacro contextPath="/Products" metaPath="@com.sap.vocabularies.UI.v1.Chart#S" header="Products" onDrilldown={() => undefined} />
    </div>
  ),
};

function MessagesDemo() {
  const api = useMessages();
  return (
    <div style={pad}>
      <Button onClick={() => api?.add([createMessage('error', 'Price: enter a number.', { target: 'Price' }), createMessage('warning', 'The product has no description.'), createMessage('success', 'Saved.')])}>Add messages</Button>
      <p><MessageIcon type="warning" /> <MessageButton /></p>
    </div>
  );
}
export const Messages: Story = { render: () => <MessageProvider><MessagesDemo /></MessageProvider> };

export const Editors: Story = {
  render: () => (
    <div style={{ ...pad, maxWidth: 320, display: 'grid', gap: 12 }}>
      <FieldEditor label="Name" showLabel value="Pen" property={model.entityTypes['Shop.Product']!.properties.Name} />
      <FieldEditor label="Release date" showLabel value="2026-11-15" property={model.entityTypes['Shop.Product']!.properties.ReleaseDate} />
      <FieldEditor label="Price" showLabel value="12.5" unit="EUR" required error="Enter a value." property={model.entityTypes['Shop.Product']!.properties.Price} />
    </div>
  ),
};

function CreateDemo() {
  const [open, setOpen] = useState(true);
  const fields = model.ui['Shop.Product']!.lineItem.filter((f) => f.kind === 'field').slice(0, 3);
  return (
    <div style={pad}>
      <Button onClick={() => setOpen(true)}>Create</Button>
      <CreateDialog opened={open} onClose={() => setOpen(false)} title="New Product" typeName="Shop.Product" fields={fields} onCreate={async () => setOpen(false)} />
    </div>
  );
}
export const CreateInADialog: Story = { render: () => <CreateDemo /> };

export const DraftMarkers: Story = {
  render: () => (
    <div style={{ ...pad, display: 'flex', gap: 24 }}>
      <ObjectMarker type="Draft" />
      <ObjectMarker type="UnsavedBy" additionalInfo="Alex Miller" />
      <ObjectMarker type="LockedBy" additionalInfo="Alex Miller" />
      <GenericTag text="Status" value="Overdue" status="Error" />
    </div>
  ),
};

export const HeaderActions: Story = {
  render: () => (
    <DynamicPage
      title={(
        <DynamicPageTitle
          heading="Header with many actions" content={<GenericTag text="KPI" value="42" status="Success" />}
          actions={[...['Edit', 'Delete', 'Approve', 'Reject', 'Release', 'Copy', 'Print'].map((id) => <Button key={id} variant="subtle">{id}</Button>), <Share key="share" title="Header" href="/" />]}
          navigationActions={<Button variant="subtle">Close</Button>}
        />
      )}
      content={<div style={pad}>Resize the window: actions move into the overflow from right to left.</div>}
    />
  ),
};

export const ResponsiveTableAndQuickView: Story = {
  render: () => (
    <div style={pad}>
      <TableMacro contextPath="/Products" type="ResponsiveTable" />
      <MTable headerText="Plain" columns={[{ id: 'a', header: 'Name', importance: 'High', cell: (r) => String(r.Name) }]} items={data.Products!.slice(0, 3)} keyOf={(r) => String(r.ID)} mode="MultiSelect" />
      <QuickViewLink typeName="Shop.Product" field={model.ui['Shop.Product']!.lineItem[0]!} row={data.Products![0]}>Quick view (needs UI.QuickViewFacets)</QuickViewLink>
    </div>
  ),
};

function FclDemo() {
  const [layout, setLayout] = useState<NonNullable<$FlexibleColumnLayoutSettings['layout']>>('TwoColumnsMidExpanded');
  return (
    <div style={{ height: '100vh' }}>
      <FlexibleColumnLayout
        layout={layout} onStateChange={(e) => setLayout(e.layout)} beginColumnPages={<TableMacro contextPath="/Products" />}
        midColumnPages={<DynamicPage title={<DynamicPageTitle heading="Product" navigationActions={<FlexibleColumnLayoutActions />} />} content={<SmartObjectPage path="Products(1)" />} />}
      />
    </div>
  );
}
export const FlexibleColumns: Story = { render: () => <FclDemo /> };
