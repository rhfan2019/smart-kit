/** Phase 2 building blocks (docs/13): charts, messages, editing, drafts, responsive table, layouts. */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '@mantine/core';
import { MICRO_COMPARISON_MAX } from '@rhfan2019/smart-kit';
import CreateDialog from '@rhfan2019/smart-kit/kit/CreateDialog';
import FieldEditor from '@rhfan2019/smart-kit/kit/FieldEditor';
import QuickViewLink from '@rhfan2019/smart-kit/kit/QuickViewLink';
import ObjectPage from '@rhfan2019/smart-kit/v4/fe/templates/ObjectPage';
import TableMacro from '@rhfan2019/smart-kit/v4/fe/macros/Table';
import MTable from '@rhfan2019/smart-kit/m/Table';
import DynamicPage from '@rhfan2019/smart-kit/f/DynamicPage';
import DynamicPageTitle from '@rhfan2019/smart-kit/f/DynamicPageTitle';
import FlexibleColumnLayout, { type $FlexibleColumnLayoutSettings } from '@rhfan2019/smart-kit/f/FlexibleColumnLayout';
import FlexibleColumnLayoutAccessibleLandmarkInfo from '@rhfan2019/smart-kit/f/FlexibleColumnLayoutAccessibleLandmarkInfo';
import GenericTag from '@rhfan2019/smart-kit/m/GenericTag';
import ObjectMarker from '@rhfan2019/smart-kit/m/ObjectMarker';
import Share from '@rhfan2019/smart-kit/v4/fe/macros/Share';
import FlexibleColumnLayoutActions from '@rhfan2019/smart-kit/v4/fe/macros/fcl/FlexibleColumnLayoutActions.block';
import SimpleChart from '@rhfan2019/smart-kit/kit/SimpleChart';
import ChartMacro from '@rhfan2019/smart-kit/v4/fe/macros/Chart';
import BulletMicroChart from '@rhfan2019/smart-kit/suite/ui/microchart/BulletMicroChart';
import RadialMicroChart from '@rhfan2019/smart-kit/suite/ui/microchart/RadialMicroChart';
import HarveyBallMicroChart from '@rhfan2019/smart-kit/suite/ui/microchart/HarveyBallMicroChart';
import DeltaMicroChart from '@rhfan2019/smart-kit/suite/ui/microchart/DeltaMicroChart';
import ColumnMicroChart from '@rhfan2019/smart-kit/suite/ui/microchart/ColumnMicroChart';
import LineMicroChart from '@rhfan2019/smart-kit/suite/ui/microchart/LineMicroChart';
import ComparisonMicroChart from '@rhfan2019/smart-kit/suite/ui/microchart/ComparisonMicroChart';
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
  // The sap.suite.ui.microchart controls; size Responsive fills the header facet sized box. All rules: "Phase 3".
  render: () => (
    <div style={{ ...pad, display: 'flex', gap: 24, flexWrap: 'wrap' }}>
      {[
        <BulletMicroChart key="b" size="Responsive" aria-label="Budget" targetValue={1440} actual={{ value: 1200 }} />,
        <RadialMicroChart key="r" size="Responsive" aria-label="Delivered" fraction={52} total={100} />,
        <HarveyBallMicroChart key="h" size="Responsive" aria-label="Received" total={8} items={[{ fraction: 3 }]} />,
        <DeltaMicroChart key="d" size="Responsive" aria-label="Invoiced" value1={900} value2={1200} />,
        <ColumnMicroChart key="c" size="Responsive" aria-label="Amounts" columns={[{ label: '1', value: 3 }, { label: '2', value: -1 }, { label: '3', value: 5 }]} />,
        <LineMicroChart key="l" size="Responsive" aria-label="Quantities" points={[{ x: 1, y: 3 }, { x: 2, y: 4 }, { x: 3, y: 2 }]} />,
        <ComparisonMicroChart key="m" size="Responsive" aria-label={`Top ${MICRO_COMPARISON_MAX}`} data={[{ title: 'A', value: 30 }, { title: 'B', value: 12 }]} onPress={() => undefined} />,
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

// sap.m.ListBase (UI5 alignment stage 6): unread rows, item actions with overflow, context menu, swipe (touch), upwards growing
export const ResponsiveTableListBase: Story = {
  render: () => (
    <div style={pad}>
      <MTable
        headerText="sap.m.ListBase" columns={[{ id: 'a', header: 'Name', cell: (r) => String(r.Name) }]} items={data.Products!.slice(0, 6)} keyOf={(r) => String(r.ID)}
        showUnread rowUnread={(r) => Number(r.ID) % 2 === 1}
        itemActionCount={2} rowActions={() => [{ type: 'Edit' }, { type: 'Delete' }, { key: 'copy', text: 'Copy' }]} onItemActionPress={(e) => console.log('itemActionPress', e.action, e.listItem)}
        contextMenu={(r) => <Button size="xs" variant="subtle">Open {String(r.Name)}</Button>}
        swipeContent={<Button size="xs">Approve</Button>}
        growing growingThreshold={3} growingDirection="Upwards"
      />
    </div>
  ),
};

function FclDemo() {
  const [layout, setLayout] = useState<NonNullable<$FlexibleColumnLayoutSettings['layout']>>('TwoColumnsMidExpanded');
  return (
    <div style={{ height: '100vh' }}>
      <FlexibleColumnLayout
        layout={layout} onStateChange={(e) => setLayout(e.layout)} beginColumnPages={<TableMacro contextPath="/Products" />}
        // drag the separator (or move it with the arrow keys): the new sizes arrive as columnsDistributionChange
        onColumnsDistributionChange={(e) => console.info('columnsDistributionChange', e.media, e.layout, e.columnsSizes)}
        landmarkInfo={<FlexibleColumnLayoutAccessibleLandmarkInfo firstColumnLabel="Products" middleColumnLabel="Product details" />}
        midColumnPages={<DynamicPage title={<DynamicPageTitle heading="Product" navigationActions={<FlexibleColumnLayoutActions />} />} content={<ObjectPage path="Products(1)" />} />}
      />
    </div>
  );
}
export const FlexibleColumns: Story = { render: () => <FclDemo /> };
