/** Dialogs controls (docs/26 §3.8–3.9, ADR-032): DynamicDateRange, SelectDialog, TableSelectDialog, ViewSettingsDialog, Wizard, IconTabBar. */
import { Button, MantineProvider, Stack, Text, TextInput } from '@mantine/core';
import { smartKitCssVariablesResolver, smartKitMantineTheme, SmartKitProvider } from '@rhfan2019/smart-kit';
import {
  DynamicDateRange, IconTabBar, IconTabFilter, IconTabSeparator, SelectDialog, TableSelectDialog, ViewSettingsDialog, Wizard, WizardStep,
  type DynamicDateRangeValue, type SelectDialogRef, type StandardListItem, type TableSelectDialogRef, type ViewSettingsDialogRef,
} from '@rhfan2019/smart-kit/controls';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { CheckCircle2, Clock, XCircle } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';

function Providers({ children }: { children: ReactNode }) {
  return (
    <MantineProvider theme={smartKitMantineTheme} cssVariablesResolver={smartKitCssVariablesResolver} forceColorScheme="light">
      <SmartKitProvider services={{}} locale="en" namespace="storybook-dialogs">
        <div style={{ padding: 16, maxWidth: 960 }}>{children}</div>
      </SmartKitProvider>
    </MantineProvider>
  );
}

const meta: Meta = { title: 'smart-kit/Controls/Dialogs', parameters: { layout: 'fullscreen' }, decorators: [(Story) => <Providers><Story /></Providers>] };
export default meta;
type Story = StoryObj;

const suppliers: StandardListItem[] = ['Acme Corp', 'Bolt Ltd', 'Cobalt Inc', 'Delta Metals', 'Evergreen Paper', 'Fjord Logistics'].map((title, i) => ({
  key: `S${i + 1}`, title, description: ['Berlin', 'London', 'Chicago'][i % 3], info: i === 2 ? 'Blocked' : 'Active', infoState: i === 2 ? 'Error' : 'Success',
}));

function DateRangeDemo() {
  const [value, setValue] = useState<DynamicDateRangeValue | undefined>({ operator: 'THISQUARTER', values: [] });
  return (
    <Stack maw={360}>
      <DynamicDateRange label="Order date" value={value} showClearIcon onChange={(e) => setValue(e.value)} />
      <Text size="sm">{value ? DynamicDateRange.toDates(value).map((d) => d.toLocaleString()).join(' – ') : '–'}</Text>
    </Stack>
  );
}
export const DynamicDateRangeStory: Story = { name: 'DynamicDateRange', render: () => <DateRangeDemo /> };

function SelectDemo() {
  const single = useRef<SelectDialogRef>(null);
  const multi = useRef<SelectDialogRef>(null);
  const table = useRef<TableSelectDialogRef>(null);
  const [out, setOut] = useState('');
  return (
    <Stack align="flex-start">
      <Button onClick={() => single.current?.open()}>SelectDialog (single)</Button>
      <Button onClick={() => multi.current?.open()}>SelectDialog (multi, remember)</Button>
      <Button onClick={() => table.current?.open()}>TableSelectDialog</Button>
      <Text size="sm">{out}</Text>
      <SelectDialog ref={single} title="Select Supplier" items={suppliers} onConfirm={(e) => setOut(e.selectedItem?.title ?? '')} />
      <SelectDialog ref={multi} title="Select Suppliers" items={suppliers} multiSelect rememberSelections showClearButton onConfirm={(e) => setOut(e.selectedItems.map((i) => i.title).join(', '))} />
      <TableSelectDialog
        ref={table} title="Select Order" columns={[{ header: 'Order' }, { header: 'Supplier' }, { header: 'Net Amount', hAlign: 'End' }]}
        items={suppliers.map((s, i) => ({ key: `45${i}`, cells: [`45000000${i + 1}`, s.title, `${(i + 1) * 1250} EUR`] }))} onConfirm={(e) => setOut(String(e.selectedItem?.key ?? ''))}
      />
    </Stack>
  );
}
export const SelectDialogs: Story = { render: () => <SelectDemo /> };

function ViewSettingsDemo() {
  const ref = useRef<ViewSettingsDialogRef>(null);
  const [out, setOut] = useState('');
  return (
    <Stack align="flex-start">
      <Button onClick={() => ref.current?.open()}>View settings</Button>
      <Text size="sm">{out}</Text>
      <ViewSettingsDialog
        ref={ref} sortItems={[{ key: 'date', text: 'Order Date', selected: true }, { key: 'amount', text: 'Net Amount' }]} groupItems={[{ key: 'status', text: 'Status' }]}
        filterItems={[{ key: 'status', text: 'Status', items: [{ key: 'NEW', text: 'New' }, { key: 'APPR', text: 'Approved' }, { key: 'REJ', text: 'Rejected' }] }]}
        onConfirm={(e) => setOut(`${e.sortItem?.text} ${e.sortDescending ? '↓' : '↑'} ${e.filterString}`)}
      />
    </Stack>
  );
}
export const ViewSettings: Story = { render: () => <ViewSettingsDemo /> };

function WizardDemo({ mode }: { mode: 'Scroll' | 'Page' }) {
  const [name, setName] = useState('');
  return (
    <div style={{ height: 480 }}>
      <Wizard renderMode={mode} finishButtonText="Create">
        <WizardStep id="general" title="General Data" validated={name.length > 1}><TextInput label="Supplier name" value={name} onChange={(e) => setName(e.currentTarget.value)} /></WizardStep>
        <WizardStep id="bank" title="Bank Details" optional><TextInput label="IBAN" /></WizardStep>
        <WizardStep id="review" title="Review"><Text>Supplier {name} will be created.</Text></WizardStep>
      </Wizard>
    </div>
  );
}
export const WizardScroll: Story = { render: () => <WizardDemo mode="Scroll" /> };
export const WizardPage: Story = { render: () => <WizardDemo mode="Page" /> };

export const IconTabBarStory: Story = {
  name: 'IconTabBar',
  render: () => (
    <IconTabBar content={<Text size="sm">No orders.</Text>}>
      <IconTabFilter key="all" showAll count="120" text="All">All orders</IconTabFilter>
      <IconTabSeparator key="sep" />
      <IconTabFilter key="open" icon={<Clock className="sk-icon" />} iconColor="Critical" count="42" text="Open">Open orders</IconTabFilter>
      <IconTabFilter key="approved" icon={<CheckCircle2 className="sk-icon" />} iconColor="Positive" count="70" text="Approved">Approved orders</IconTabFilter>
      <IconTabFilter key="rejected" icon={<XCircle className="sk-icon" />} iconColor="Negative" count="8" text="Rejected" />
    </IconTabBar>
  ),
};

export const IconTabBarTextOnly: Story = {
  render: () => (
    <IconTabBar headerMode="Inline" tabsOverflowMode="StartAndEnd" enableTabReordering>
      {Array.from({ length: 14 }, (_, i) => <IconTabFilter key={`m${i}`} text={`Month ${i + 1}`} count={String(10 + i)}>Orders of month {i + 1}</IconTabFilter>)}
    </IconTabBar>
  ),
};
