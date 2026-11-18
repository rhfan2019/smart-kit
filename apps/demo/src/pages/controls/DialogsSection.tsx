/** Demo section of the dialogs controls (docs/26 §3.8–3.9): date ranges, select and settings dialogs, a wizard, tabs. */
import { Button, Code, Group, SimpleGrid, Stack, Text, TextInput } from '@mantine/core';
import {
  DynamicDateRange, IconTabBar, IconTabFilter, IconTabSeparator, SelectDialog, TableSelectDialog, ViewSettingsDialog, Wizard, WizardStep,
  type DynamicDateRangeValue, type SelectDialogRef, type StandardListItem, type TableSelectDialogRef, type ViewSettingsDialogRef, type WizardRef,
} from '@rhfan2019/smart-kit/controls';
import { CheckCircle2, Clock, Inbox, Landmark, XCircle } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';

const SUPPLIERS: StandardListItem[] = [
  ['S1', 'Acme Corp', 'Berlin, DE', 'Active', 'Success'], ['S2', 'Bolt Ltd', 'London, GB', 'Active', 'Success'], ['S3', 'Cobalt Inc', 'Chicago, US', 'Blocked', 'Error'],
  ['S4', 'Delta Metals', 'Lyon, FR', 'In review', 'Warning'], ['S5', 'Evergreen Paper', 'Oslo, NO', 'Active', 'Success'], ['S6', 'Fjord Logistics', 'Bergen, NO', 'Active', 'Success'],
  ['S7', 'Granite Tools', 'Graz, AT', 'Active', 'Success'], ['S8', 'Harbor Freight', 'Rotterdam, NL', 'In review', 'Warning'],
].map(([key, title, description, info, infoState]) => ({ key: key!, title, description, info, infoState: infoState as StandardListItem['infoState'] }));
const ORDERS = Array.from({ length: 30 }, (_, i) => ({
  key: `45000000${String(i + 1).padStart(2, '0')}`,
  cells: [`45000000${String(i + 1).padStart(2, '0')}`, SUPPLIERS[i % SUPPLIERS.length]!.title, ['New', 'Approved', 'Rejected'][i % 3], `${(1200 + i * 731).toLocaleString('en-US')} EUR`],
}));
const STATUS = [{ key: 'NEW', text: 'New' }, { key: 'APPR', text: 'Approved' }, { key: 'REJ', text: 'Rejected' }];

function Box({ label, children }: { label: string; children: ReactNode }) {
  return <Stack gap="xs"><Text size="sm" c="dimmed">{label}</Text>{children}</Stack>;
}

export function DialogsSection() {
  const [range, setRange] = useState<DynamicDateRangeValue | undefined>({ operator: 'LASTDAYS', values: [30] });
  const [valid, setValid] = useState(true);
  const [supplier, setSupplier] = useState<string>('–');
  const [orders, setOrders] = useState<string>('–');
  const [view, setView] = useState<string>('Sorted by Order Date');
  const [done, setDone] = useState(false);
  const [name, setName] = useState('');
  const selectRef = useRef<SelectDialogRef>(null);
  const tableRef = useRef<TableSelectDialogRef>(null);
  const viewRef = useRef<ViewSettingsDialogRef>(null);
  const wizardRef = useRef<WizardRef>(null);
  const dates = range && valid ? DynamicDateRange.toDates(range).map((d) => d.toLocaleDateString()).join(' – ') : '';

  return (
    <Stack gap="lg" data-demo-dialogs>
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
        <Box label="DynamicDateRange">
          <DynamicDateRange label="Order date" value={range} showClearIcon width="100%"
            standardOptions={['DATE', 'DATERANGE', 'TODAY', 'YESTERDAY', 'LASTDAYS', 'LASTWEEKS', 'LASTMONTHS', 'NEXTDAYS', 'THISWEEK', 'THISMONTH', 'LASTMONTH', 'THISQUARTER', 'QUARTER1', 'QUARTER2', 'QUARTER3', 'QUARTER4', 'THISYEAR', 'YEARTODATE', 'SPECIFICMONTHINYEAR']}
            onChange={(e) => { setRange(e.value); setValid(e.valid); }} />
          <Text size="sm">toDates: <Code>{dates || '–'}</Code></Text>
        </Box>
        <Box label="SelectDialog · TableSelectDialog · ViewSettingsDialog">
          <Group gap="xs">
            <Button variant="default" onClick={() => selectRef.current?.open()}>Select supplier</Button>
            <Button variant="default" onClick={() => tableRef.current?.open()}>Select orders</Button>
            <Button variant="default" onClick={() => viewRef.current?.open()}>View settings</Button>
          </Group>
          <Text size="sm">Supplier: <b>{supplier}</b> · Orders: <b>{orders}</b></Text>
          <Text size="sm">{view}</Text>
          <SelectDialog ref={selectRef} title="Select Supplier" items={SUPPLIERS} onConfirm={(e) => setSupplier(e.selectedItem?.title ?? '–')} />
          <TableSelectDialog
            ref={tableRef} title="Select Purchase Orders" multiSelect showClearButton growingThreshold={10} items={ORDERS} contentWidth="48rem"
            columns={[{ header: 'Purchase Order' }, { header: 'Supplier' }, { header: 'Status', minScreenWidth: 'Tablet', demandPopin: true }, { header: 'Net Amount', hAlign: 'End' }]}
            onConfirm={(e) => setOrders(e.selectedItems.length ? `${e.selectedItems.length} selected` : '–')}
          />
          <ViewSettingsDialog
            ref={viewRef} sortItems={[{ key: 'date', text: 'Order Date', selected: true }, { key: 'amount', text: 'Net Amount' }, { key: 'supplier', text: 'Supplier' }]}
            groupItems={[{ key: 'supplier', text: 'Supplier' }, { key: 'status', text: 'Status' }]}
            presetFilterItems={[{ key: 'large', text: 'Orders above 10,000 EUR' }]}
            filterItems={[{ key: 'status', text: 'Status', items: STATUS }, { key: 'supplier', text: 'Supplier', items: SUPPLIERS.map((s) => ({ key: s.key, text: s.title! })) }]}
            onConfirm={(e) => setView([`Sorted by ${e.sortItem?.text ?? '–'}${e.sortDescending ? ' (descending)' : ''}`, e.groupItem && `grouped by ${e.groupItem.text}`, e.filterString].filter(Boolean).join(' · '))}
          />
        </Box>
      </SimpleGrid>

      <Box label="IconTabBar">
        <IconTabBar ariaTexts={{ headerLabel: 'Purchase order status' }} content={<Text size="sm">No orders in this status.</Text>}>
          <IconTabFilter key="all" showAll count="120" text="All">All 120 purchase orders of this month.</IconTabFilter>
          <IconTabSeparator key="sep" />
          <IconTabFilter key="open" icon={<Clock className="sk-icon" />} iconColor="Critical" count="42" text="Open">42 orders wait for approval.</IconTabFilter>
          <IconTabFilter key="approved" icon={<CheckCircle2 className="sk-icon" />} iconColor="Positive" count="70" text="Approved">70 orders are approved.</IconTabFilter>
          <IconTabFilter key="rejected" icon={<XCircle className="sk-icon" />} iconColor="Negative" count="8" text="Rejected" />
          <IconTabFilter key="other" icon={<Inbox className="sk-icon" />} iconColor="Neutral" text="Other">
            <IconTabFilter key="draft" text="Draft" count="5">5 drafts.</IconTabFilter>
            <IconTabFilter key="closed" text="Closed" count="31">31 closed orders.</IconTabFilter>
          </IconTabFilter>
        </IconTabBar>
      </Box>

      <Box label="Wizard (create supplier)">
        <div style={{ height: '28rem', border: '1px solid var(--sk-color-border)' }}>
          <Wizard ref={wizardRef} aria-label="Create supplier" finishButtonText="Create" onComplete={() => setDone(true)}>
            <WizardStep id="general" title="General Data" validated={name.trim().length > 1}>
              <TextInput label="Supplier name" required value={name} onChange={(e) => setName(e.currentTarget.value)} placeholder="At least two characters" />
            </WizardStep>
            <WizardStep id="bank" title="Bank Details" icon={<Landmark className="sk-icon" />} optional>
              <TextInput label="IBAN" placeholder="DE89 3704 0044 0532 0130 00" />
            </WizardStep>
            <WizardStep id="review" title="Review">
              <Text size="sm">Supplier <b>{name || '–'}</b> will be created.</Text>
            </WizardStep>
          </Wizard>
        </div>
        <Group gap="xs">
          <Button size="xs" variant="default" onClick={() => { wizardRef.current?.discardProgress('general'); setDone(false); }}>Start over</Button>
          {done && <Text size="sm" c="green">Supplier created.</Text>}
        </Group>
      </Box>
    </Stack>
  );
}
