/** Demo section of the dialogs controls (docs/26 §3.8–3.9): date ranges, select and settings dialogs, a wizard, tabs. */
import { Button, Code, Group, SimpleGrid, Stack, Text, TextInput } from '@mantine/core';
import DynamicDateRange, { type DynamicDateRangeValue } from '@rhfan2019/smart-kit/m/DynamicDateRange';
import IconTabBar from '@rhfan2019/smart-kit/m/IconTabBar';
import IconTabFilter from '@rhfan2019/smart-kit/m/IconTabFilter';
import IconTabSeparator from '@rhfan2019/smart-kit/m/IconTabSeparator';
import SelectDialog, { type StandardListItem } from '@rhfan2019/smart-kit/m/SelectDialog';
import TableSelectDialog from '@rhfan2019/smart-kit/m/TableSelectDialog';
import ViewSettingsDialog from '@rhfan2019/smart-kit/m/ViewSettingsDialog';
import Wizard from '@rhfan2019/smart-kit/m/Wizard';
import Popup from '@rhfan2019/smart-kit/m/p13n/Popup';
import SelectionPanel from '@rhfan2019/smart-kit/m/p13n/SelectionPanel';
import SortPanel from '@rhfan2019/smart-kit/m/p13n/SortPanel';
import QuickView from '@rhfan2019/smart-kit/m/QuickView';
import QuickViewPage from '@rhfan2019/smart-kit/m/QuickViewPage';
import QuickViewGroup from '@rhfan2019/smart-kit/m/QuickViewGroup';
import QuickViewGroupElement from '@rhfan2019/smart-kit/m/QuickViewGroupElement';
import WizardStep from '@rhfan2019/smart-kit/m/WizardStep';
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
  const selectRef = useRef<SelectDialog>(null);
  const tableRef = useRef<TableSelectDialog>(null);
  const viewRef = useRef<ViewSettingsDialog>(null);
  const wizardRef = useRef<Wizard>(null);
  const p13nRef = useRef<Popup>(null);
  const colsRef = useRef<SelectionPanel>(null);
  const sortRef = useRef<SortPanel>(null);
  const quickRef = useRef<QuickView>(null);
  const [p13n, setP13n] = useState('–');
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

      <Box label="sap.m.p13n.Popup · QuickView">
        <Group gap="xs">
          <Button variant="default" onClick={(e) => p13nRef.current?.open(e.currentTarget)} data-demo-p13n-open>Personalize</Button>
          <Button variant="default" onClick={(e) => quickRef.current?.openBy(e.currentTarget)} data-demo-quickview-open>Supplier quick view</Button>
        </Group>
        <Text size="sm">{p13n}</Text>
        <Popup
          ref={p13nRef} title="View Settings" warningText="Reset all changes?" reset={() => setP13n('Reset')}
          onClose={({ reason }) => setP13n(reason === 'Ok' ? `Columns: ${colsRef.current?.getP13nData(true).map((x) => x.label).join(', ')} · Sort: ${sortRef.current?.getP13nData(true).map((x) => `${x.label}${x.descending ? ' ↓' : ''}`).join(', ') || '–'}` : reason)}
          panels={[
            <SelectionPanel key="columns" ref={colsRef} title="Columns" showHeader enableCount p13nData={[{ name: 'po', label: 'Purchase Order', visible: true }, { name: 'supplier', label: 'Supplier', visible: true }, { name: 'amount', label: 'Net Amount', visible: false }]} />,
            <SortPanel key="sort" ref={sortRef} p13nData={[{ name: 'date', label: 'Order Date', sorted: true, descending: true }, { name: 'amount', label: 'Net Amount', sorted: false, descending: false }]} />,
          ]}
        />
        <QuickView ref={quickRef} placement="Bottom">
          <QuickViewPage pageId="supplier" header="Supplier" title="Domestic US Supplier 1" description="Wholesale">
            <QuickViewGroup heading="Contact">
              <QuickViewGroupElement label="Email" value="orders@supplier.test" type="email" />
              <QuickViewGroupElement label="Phone" value="+1 555 0100" type="phone" />
              <QuickViewGroupElement label="Contact person" value="Jane Doe" type="pageLink" pageLinkId="person" />
            </QuickViewGroup>
          </QuickViewPage>
          <QuickViewPage pageId="person" header="Contact person" title="Jane Doe" description="Sales" />
        </QuickView>
      </Box>

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
