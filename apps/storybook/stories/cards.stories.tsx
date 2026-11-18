/** Cards (docs/20-research-cards.md, ADR-028): every card type, driven by the purchasing sample $metadata and in-memory data. */
import { MantineProvider } from '@mantine/core';
import { buildModel, MemoryProvider, type NavigationAdapter, type Row } from '@rhfan2019/smart-kit-core';
import { smartKitCssVariablesResolver, smartKitMantineTheme, SmartKitProvider } from '@rhfan2019/smart-kit';
import AnalyticalContent from '@rhfan2019/smart-kit/ui/integration/cards/AnalyticalContent';
import CalendarContent from '@rhfan2019/smart-kit/ui/integration/cards/CalendarContent';
import Card from '@rhfan2019/smart-kit/f/Card';
import Header from '@rhfan2019/smart-kit/f/cards/Header';
import ListContent from '@rhfan2019/smart-kit/ui/integration/cards/ListContent';
import NumericHeader from '@rhfan2019/smart-kit/f/cards/NumericHeader';
import NumericSideIndicator from '@rhfan2019/smart-kit/f/cards/NumericSideIndicator';
import ObjectContent from '@rhfan2019/smart-kit/ui/integration/cards/ObjectContent';
import TableContent from '@rhfan2019/smart-kit/ui/integration/cards/TableContent';
import TimelineContent from '@rhfan2019/smart-kit/ui/integration/cards/TimelineContent';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useMemo, type ReactNode } from 'react';
import xml from '../../../packages/core/test/samples/purchasing.en.xml?raw';

const model = buildModel(xml);
const suppliers: Row[] = ['Acme Corp', 'Bolt Ltd', 'Cobalt Inc'].map((name, i) => ({ Supplier: `S${i + 1}`, SupplierName: name, Country: 'DE', City: 'Berlin', Rating: 4 - i, LogoUrl: '', IsBlocked: false, RatingCount: 10 }));
const orders: Row[] = Array.from({ length: 12 }, (_, i) => ({
  PurchaseOrder: `45000000${String(i + 1).padStart(2, '0')}`, PurchaseOrderType: i % 3 ? 'NB' : 'FO', Supplier: `S${(i % 3) + 1}`, CompanyCode: '1000', PurchasingGroup: '001',
  OrderDate: `2026-10-${String(i + 1).padStart(2, '0')}`, CreatedAt: '2026-10-01T08:00:00Z', Status: i % 4 ? 'NEW' : 'APPR', StatusCriticality: i % 4 ? 0 : 3,
  NetAmount: 5000 + ((i * 7919) % 50000), Currency: 'EUR', DeliveredPercent: 0, Description: `Order ${i + 1}`, Notes: null, Version: 1, BudgetAmount: 0, InvoicedAmount: 0, ApproveEnabled: true, CloseEnabled: true,
}));
const meetings: Row[] = [
  ['Framework contract', '2026-11-16T07:30:00Z', 90, 'NEGO'], ['Quality review', '2026-11-16T10:00:00Z', 30, 'REVW'], ['Site audit', '2026-11-16T12:30:00Z', 90, 'AUDT'],
  ['Defect analysis', '2026-11-16T15:00:00Z', 60, 'REVW'], ['Volume discount', '2026-11-18T09:00:00Z', 60, 'NEGO'],
].map(([subject, start, minutes, cat], i) => ({
  Meeting: `M${i}`, Supplier: 'S1', Subject: subject, StartAt: start, EndAt: new Date(Date.parse(String(start)) + Number(minutes) * 60000).toISOString(), Location: 'Room A', Category: cat, CategoryName: cat,
}));
const data = {
  PurchaseOrders: orders, Suppliers: suppliers, SupplierMeetings: meetings,
  OrderStatuses: [{ Code: 'NEW', Name: 'New', Criticality: 0 }, { Code: 'APPR', Name: 'Approved', Criticality: 3 }],
  PurchaseOrderTypes: [{ Code: 'NB', Name: 'Standard Order' }, { Code: 'FO', Name: 'Framework Order' }],
};
const navigation: NavigationAdapter = { toObject: (p) => console.info('toObject', p), toList: (s) => console.info('toList', s), hasObjectPage: () => true };
const NOW = new Date('2026-11-16T08:00:00Z');

function Providers({ children }: { children: ReactNode }) {
  const services = useMemo(() => ({ purchasing: { model, dataProvider: new MemoryProvider({ model, data, latency: 150 }) } }), []);
  return (
    <MantineProvider theme={smartKitMantineTheme} cssVariablesResolver={smartKitCssVariablesResolver} forceColorScheme="light">
      <SmartKitProvider services={services} locale="en" namespace="storybook-cards" navigation={navigation} timeZone="Europe/Berlin">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, 340px)', gap: 16, alignItems: 'start', padding: 16 }}>{children}</div>
      </SmartKitProvider>
    </MantineProvider>
  );
}

const meta: Meta = { title: 'smart-kit/Cards', parameters: { layout: 'fullscreen' }, decorators: [(Story) => <Providers><Story /></Providers>] };
export default meta;
type Story = StoryObj;

export const ListAndTable: Story = {
  render: () => (
    <>
      <Card header={<Header title="Large Orders" subtitle="By net amount" />}>
        <ListContent entitySet="PurchaseOrders" presentationAnnotationPath="@UI.PresentationVariant#CardLarge" />
      </Card>
      <Card header={<Header title="Large Orders (extended)" />}>
        <ListContent entitySet="PurchaseOrders" listType="extended" maxItems={3} presentationAnnotationPath="@UI.PresentationVariant#CardLarge" />
      </Card>
      <Card header={<Header title="Net Amount Comparison" />}>
        <ListContent entitySet="PurchaseOrders" listFlavor="bar" presentationAnnotationPath="@UI.PresentationVariant#CardLarge" />
      </Card>
      <Card header={<Header title="Orders" subtitle="Table card" />}>
        <TableContent entitySet="PurchaseOrders" annotationPath="@UI.LineItem#CardTable" />
      </Card>
    </>
  ),
};

export const ObjectAndAnalytical: Story = {
  render: () => (
    <>
      <Card header={<Header />}>
        <ObjectContent entitySet="Suppliers" keys={{ Supplier: 'S1' }} />
      </Card>
      <Card header={<NumericHeader title="Purchasing Spend" subtitle="Orders in EUR" details="Current year" entitySet="PurchaseOrders" dataPointAnnotationPath="@UI.DataPoint#CardSpend" />}>
        <AnalyticalContent entitySet="PurchaseOrders" chartAnnotationPath="@UI.Chart#ByStatus" />
      </Card>
      <Card header={<Header title="By Order Type" />}>
        <AnalyticalContent entitySet="PurchaseOrders" chartAnnotationPath="@UI.Chart#CardTypeShare" />
      </Card>
      <Card header={<NumericHeader title="Static KPI" unitOfMeasurement="EUR" number="125.6" scale="K" trend="Up" state="Good" sideIndicators={[{ title: 'Target', number: '150', unit: 'K' }]} />}>
        <div style={{ padding: 16 }}><NumericSideIndicator title="Side indicator alone" number="16.3" unit="%" state="Critical" /></div>
      </Card>
    </>
  ),
};

export const TimelineAndCalendar: Story = {
  render: () => (
    <>
      <Card header={<Header title="Supplier Meetings" />}>
        <TimelineContent entitySet="SupplierMeetings" maxItems={3} now={NOW} />
      </Card>
      <div style={{ gridColumn: 'span 2' }}>
        <Card width="640px" header={<Header title="My Meetings" subtitle="Supplier meetings" />}>
          <CalendarContent entitySet="SupplierMeetings" date="2026-11-16" now={NOW} maxItems={3} specialDates={[{ startDate: '2026-11-20', type: 'holiday' }]} legendItems={[{ category: 'calendar', type: 'holiday', text: 'Holiday' }]} />
        </Card>
      </div>
    </>
  ),
};
