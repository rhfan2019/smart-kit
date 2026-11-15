/** Phase 2 building blocks (docs/13): charts, messages, editing, drafts, responsive table, layouts. */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '@mantine/core';
import {
  ChartView, ColumnContext, CreateDialog, DraftMarker, DynamicPage, FieldEditor, FlexibleColumnLayout, GenericTag, MessageButton, MessageIcon, MessageProvider,
  MICRO_COMPARISON_MAX, MicroChart, OverflowActions, QuickViewLink, ResponsiveTable, ShareMenu, SimpleChart, SmartObjectPage, SmartTable, useMessages, type FclLayout,
} from '@rhfan2019/smart-kit';
import { createMessage } from '@rhfan2019/smart-kit-core';
import { useState } from 'react';
import { data, model } from './providers';

const meta: Meta = { title: 'smart-kit/Phase 2', parameters: { layout: 'fullscreen' } };
export default meta;
type Story = StoryObj;

const pad = { padding: 16 };

export const MicroCharts: Story = {
  render: () => (
    <div style={{ ...pad, display: 'flex', gap: 24, flexWrap: 'wrap' }}>
      <MicroChart kind="bullet" label="Budget" value={1200} target={1440} />
      <MicroChart kind="radial" label="Delivered" value={52} target={100} />
      <MicroChart kind="harvey" label="Received" value={3} target={8} />
      <MicroChart kind="delta" label="Invoiced" value={900} target={1200} />
      <MicroChart kind="column" label="Amounts" points={[{ label: '1', value: 3 }, { label: '2', value: -1 }, { label: '3', value: 5 }]} />
      <MicroChart kind="line" label="Quantities" points={[{ label: '1', value: 3 }, { label: '2', value: 4 }, { label: '3', value: 2 }]} />
      <MicroChart kind="comparison" label={`Top ${MICRO_COMPARISON_MAX}`} points={[{ label: 'A', value: 30 }, { label: 'B', value: 12 }]} onPress={() => undefined} />
    </div>
  ),
};

export const Chart: Story = {
  render: () => <div style={pad}><SimpleChart kind="column" title="Revenue" measureLabel="Revenue" dimensionLabel="Status" data={[{ key: 'A', label: 'Active', value: 12 }, { key: 'B', label: 'Blocked', value: 5 }]} onSelect={() => undefined} /></div>,
};

export const ChartViewOfAList: Story = {
  render: () => (
    <div style={pad}>
      <ChartView entitySet="Products" chart={{ id: 'S', title: 'Price by status', chartType: 'Column', dimensions: ['Status'], measures: ['Price'], dataPoints: {}, navigation: '', typeName: 'Shop.Product' }}
        filters={{}} executed title="Products" onDrilldown={() => undefined} />
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
      <DraftMarker row={{ IsActiveEntity: false, DraftAdministrativeData: { DraftIsCreatedByMe: true } }} />
      <DraftMarker row={{ IsActiveEntity: true, HasDraftEntity: true, DraftAdministrativeData: { DraftIsCreatedByMe: false, LastChangedByUser: 'Alex Miller', LastChangeDateTime: '2026-11-14T09:30:00Z' } }} />
      <GenericTag text="Status" value="Overdue" status={1} />
    </div>
  ),
};

export const HeaderActions: Story = {
  render: () => (
    <DynamicPage
      heading="Header with many actions" keyInfo={<GenericTag text="KPI" value="42" status={3} />}
      actionItems={['Edit', 'Delete', 'Approve', 'Reject', 'Release', 'Copy', 'Print'].map((id) => ({ id, label: id, onPress: () => undefined }))}
      actions={<ShareMenu title="Header" href="/" />}
      layoutActions={<OverflowActions items={[{ id: 'close', label: 'Close', onPress: () => undefined }]} />}
    >
      <div style={pad}>Resize the window: actions move into the overflow menu from right to left.</div>
    </DynamicPage>
  ),
};

export const ResponsiveTableAndQuickView: Story = {
  render: () => (
    <div style={pad}>
      <SmartTable entitySet="Products" mode="responsive" />
      <ResponsiveTable label="Plain" columns={[{ id: 'a', label: 'Name', importance: 'High', render: (r) => String(r.Name) }]} rows={data.Products!.slice(0, 3)} keyOf={(r) => String(r.ID)}
        selectedKeys={new Set()} onSelectionChange={() => undefined} navigable={false} onNavigate={() => undefined} hasMore={false} loading={false} loadMore={() => undefined} showDetails={false} />
      <QuickViewLink typeName="Shop.Product" field={model.ui['Shop.Product']!.lineItem[0]!} row={data.Products![0]}>Quick view (needs UI.QuickViewFacets)</QuickViewLink>
    </div>
  ),
};

function FclDemo() {
  const [layout, setLayout] = useState<FclLayout>('TwoColumnsMidExpanded');
  return (
    <div style={{ height: '100vh' }}>
      <FlexibleColumnLayout layout={layout} onLayoutChange={setLayout} begin={<SmartTable entitySet="Products" />} mid={<SmartObjectPage path="Products(1)" />} onCloseMid={() => setLayout('OneColumn')} />
      <ColumnContext.Provider value={{ column: 0, showBreadcrumbs: true }} />
    </div>
  );
}
export const FlexibleColumns: Story = { render: () => <FclDemo /> };
