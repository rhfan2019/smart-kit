/** Demo section of the Process controls (docs/26 §3.6, §3.7): purchase requisition → order → goods receipt → invoice. */
import { Button, Group, SimpleGrid, Stack, Text } from '@mantine/core';
import {
  ActionsPlaceholder, FeedInput, FeedListItem, MicroProcessFlow, MicroProcessFlowItem, ProcessFlow, Timeline, TimelineItem, UploadSetwithTable,
  type ProcessFlowLaneHeader, type ProcessFlowNode, type ProcessFlowRef, type TimelineGroupType, type UploadItem,
} from '@rhfan2019/smart-kit/controls';
import { ClipboardList, FileText, PackageCheck, Receipt, ThumbsUp } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';

const lanes: ProcessFlowLaneHeader[] = [
  { laneId: 'pr', text: 'Purchase Requisition', iconSrc: <ClipboardList />, position: 0, state: [{ state: 'Positive', value: 100 }] },
  { laneId: 'po', text: 'Purchase Order', iconSrc: <FileText />, position: 1, state: [{ state: 'Positive', value: 50 }, { state: 'Critical', value: 50 }] },
  { laneId: 'gr', text: 'Goods Receipt', iconSrc: <PackageCheck />, position: 2, state: [{ state: 'Positive', value: 60 }, { state: 'Planned', value: 40 }] },
  { laneId: 'iv', text: 'Supplier Invoice', iconSrc: <Receipt />, position: 3, state: [{ state: 'Negative', value: 30 }, { state: 'Planned', value: 70 }] },
];
const nodes: ProcessFlowNode[] = [
  { nodeId: 'pr1', laneId: 'pr', title: 'PR 10004711', titleAbbreviation: 'PR', state: 'Positive', stateText: 'Approved', texts: ['Laptops, 12 pcs', 'Anna Klein'],
    children: ['po1', { nodeId: 'po2', connectionLabel: { text: 'Split', state: 'Critical' } }] },
  { nodeId: 'po1', laneId: 'po', title: 'PO 4500017230', titleAbbreviation: 'PO', state: 'Positive', stateText: 'Sent to supplier', texts: ['EUR 14,280.00'], children: ['gr1'] },
  { nodeId: 'po2', laneId: 'po', title: 'PO 4500017231', titleAbbreviation: 'PO', state: 'Critical', stateText: 'Delivery overdue', texts: ['EUR 2,380.00'], children: ['gr2'] },
  { nodeId: 'gr1', laneId: 'gr', title: 'GR 5000088120', titleAbbreviation: 'GR', state: 'Positive', stateText: 'Posted', type: 'Aggregated', texts: ['3 deliveries'], children: ['iv1'] },
  { nodeId: 'gr2', laneId: 'gr', title: 'Goods receipt', titleAbbreviation: 'GR', state: 'Planned', stateText: 'Expected 12/04', children: ['iv2'] },
  { nodeId: 'iv1', laneId: 'iv', title: 'Invoice 5105600731', titleAbbreviation: 'IV', state: 'Negative', stateText: 'Price variance', texts: ['Blocked for payment'] },
  { nodeId: 'iv2', laneId: 'iv', title: 'Invoice', titleAbbreviation: 'IV', state: 'Planned', stateText: 'Not received' },
];

const history = [
  ['1', '2026-10-02T08:15:00Z', 'Requisition created', 'Anna Klein', 'Requisition', 'Laptops for the new sales team, 12 pcs.', undefined],
  ['2', '2026-10-03T13:40:00Z', 'Requisition approved', 'Marc Weber', 'Requisition', 'Approved within budget of cost center 4711.', 'Success'],
  ['3', '2026-10-06T09:05:00Z', 'Purchase order 4500017230 sent', 'Purchasing', 'Order', 'Sent to Acme Corp by EDI.', 'Information'],
  ['4', '2026-10-21T10:30:00Z', 'Delivery delayed', 'Acme Corp', 'Order', 'Partial delivery; 2 pcs follow in December.', 'Warning'],
  ['5', '2026-11-04T15:10:00Z', 'Goods receipt posted', 'Warehouse', 'Receipt', '10 pcs received in plant 1000.', 'Success'],
  ['6', '2026-11-12T11:00:00Z', 'Invoice blocked', 'Accounts Payable', 'Invoice', 'Unit price 1,190.00 instead of 1,150.00.', 'Error'],
  ['7', '2026-11-16T07:45:00Z', 'Price variance clarified', 'Anna Klein', 'Invoice', 'Supplier sends a credit memo.', 'Information'],
] as const;

const attachments: UploadItem[] = [
  { id: 'q', fileName: 'Quotation-ACME-4711.pdf', mediaType: 'application/pdf', fileSize: 254_000, uploadState: 'Complete' },
  { id: 'd', fileName: 'Delivery-note-5000088120.png', mediaType: 'image/png', fileSize: 1_240_000, uploadState: 'Complete' },
];

/** Attachments of the invoice; uploads are simulated (no server): the file is listed after a short delay. */
function Attachments({ onEvent }: { onEvent: (text: string) => void }) {
  const [items, setItems] = useState<UploadItem[]>(attachments);
  return (
    <UploadSetwithTable title="Invoice 5105600731 – attachments" items={items} multiple maxFileSize={10} fileTypes={['pdf', 'png', 'jpg', 'xlsx', 'docx']}
      uploadUrl="/demo-upload"
      onBeforeUploadStarts={(e) => {
        e.preventDefault();
        const { file, fileName, mediaType, fileSize } = e.item;
        onEvent(`beforeUploadStarts: ${fileName} (simulated upload)`);
        setTimeout(() => setItems((all) => [...all, {
          id: e.item.id, fileName, mediaType, fileSize, uploadState: 'Complete', url: file && typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : undefined,
        }]), 800);
      }}
      onFileTypeMismatch={(e) => onEvent(`fileTypeMismatch: ${e.item.fileName}`)}
      onFileSizeExceeded={(e) => onEvent(`fileSizeExceeded: ${e.item.fileName}`)}
      onItemRenamed={(e) => setItems((all) => all.map((i) => (i.id === e.item.id ? { ...i, fileName: e.item.fileName } : i)))}
      onRemove={(e) => setItems((all) => all.filter((i) => i.id !== e.item.id))}
      columns={[{ key: 'by', header: 'Uploaded by', cell: (i) => (i.id === 'q' ? 'Acme Corp' : 'Warehouse') }]}
      actions={<><ActionsPlaceholder placeholderFor="UploadButtonPlaceholder" /><Button size="xs" variant="subtle" onClick={() => setItems([])}>Clear</Button></>} />
  );
}

function Box({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Stack gap="xs">
      <Text size="sm" c="dimmed">{label}</Text>
      {children}
    </Stack>
  );
}

export function ProcessSection() {
  const flow = useRef<ProcessFlowRef>(null);
  const [zoom, setZoom] = useState('');
  const [event, setEvent] = useState('');
  const [group, setGroup] = useState<TimelineGroupType>('Month');
  const [posts, setPosts] = useState([
    { id: 1, sender: 'Marc Weber', initials: 'MW', text: 'Can we accept the partial delivery? Sales needs 10 laptops by Monday.', timestamp: '2026-11-15T16:20:00Z' },
    { id: 2, sender: 'Acme Corp', initials: 'AC', text: 'The remaining 2 laptops ship on December 4. Tracking: https://example.com/track/88120', timestamp: '2026-11-16T08:05:00Z' },
  ]);
  const zoomBy = (fn: (r: ProcessFlowRef) => unknown) => {
    if (!flow.current) return;
    fn(flow.current);
    setZoom(String(flow.current.getZoomLevel()));
  };
  return (
    <Stack gap="lg">
      <Box label="ProcessFlow: requisition → order → goods receipt → invoice (Ctrl + wheel zooms)">
        <Group gap="xs">
          <Button size="xs" variant="default" onClick={() => zoomBy((r) => r.zoomIn())}>Zoom in</Button>
          <Button size="xs" variant="default" onClick={() => zoomBy((r) => r.zoomOut())}>Zoom out</Button>
          <Button size="xs" variant="default" onClick={() => flow.current?.setSelectedPath('pr1', 'iv1')}>Highlight PR → blocked invoice</Button>
          <Button size="xs" variant="default" onClick={() => flow.current?.setSelectedPath(null, null)}>Clear path</Button>
          <Text size="xs" c="dimmed">{zoom && `Zoom level ${zoom}`} {event}</Text>
        </Group>
        <ProcessFlow ref={flow} lanes={lanes} nodes={nodes} showLabels
          onNodePress={(n) => setEvent(`nodePress: ${n.title}`)} onHeaderPress={(l) => setEvent(`headerPress: ${l.text}`)}
          onLabelPress={(l) => setEvent(`labelPress: ${l.text}`)} />
      </Box>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
        <Box label="MicroProcessFlow (one row per order)">
          {[
            ['4500017230', ['Success', 'Success', 'Success', 'Error']],
            ['4500017231', ['Success', 'Warning', 'None', 'None']],
          ].map(([po, states]) => (
            <Group key={po as string} gap="md">
              <Text size="sm" w="7rem">PO {po}</Text>
              <MicroProcessFlow ariaLabel={`Status of PO ${po}`}>
                {(states as string[]).map((s, i) => (
                  <MicroProcessFlowItem key={i} state={s as 'Success'} title={`${['Requisition', 'Order', 'Goods receipt', 'Invoice'][i]}: ${s}`}
                    showIntermediary={i === 1 && s === 'Warning'} onPress={(e) => setEvent(`press: ${e.item.title}`)} />
                ))}
              </MicroProcessFlow>
            </Group>
          ))}
        </Box>
        <Box label="Feed: comments on the order">
          <FeedInput iconInitials="AK" onPost={({ value }) => setPosts((p) => [{ id: Date.now(), sender: 'Anna Klein', initials: 'AK', text: value, timestamp: new Date().toISOString() }, ...p])}
            actions={<Button size="xs" variant="subtle" leftSection={<ThumbsUp size="1em" />}>Like</Button>} />
          <ul className="demo-feed-list" style={{ margin: 0, padding: 0 }}>
            {posts.map((p) => (
              <FeedListItem key={p.id} sender={p.sender} iconInitials={p.initials} text={p.text} timestamp={p.timestamp} info="Comment"
                convertLinksToAnchorTags="All" maxCharacters={80} onSenderPress={() => setEvent(`senderPress: ${p.sender}`)}
                actions={[
                  { key: 'reply', text: 'Reply', onPress: () => setEvent(`reply to ${p.sender}`) },
                  { key: 'delete', text: 'Delete', onPress: () => setPosts((all) => all.filter((x) => x.id !== p.id)) },
                ]} />
            ))}
          </ul>
        </Box>
      </SimpleGrid>

      <Box label="Timeline: history of requisition 10004711">
        <Group gap="xs">
          {(['None', 'Month', 'Week', 'Day'] as TimelineGroupType[]).map((g) => (
            <Button key={g} size="xs" variant={g === group ? 'filled' : 'default'} onClick={() => setGroup(g)}>{g}</Button>
          ))}
        </Group>
        <Timeline groupByType={group} enableSocial height="32rem" onSelect={({ selectedItem }) => setEvent(`select: ${selectedItem.title}`)}>
          {history.map(([k, date, title, user, filter, text, status]) => (
            <TimelineItem key={k} dateTime={date} title={title} userName={user} userNameClickable filterValue={filter} text={text} status={status}
              replyCount={k === '6' ? 2 : undefined} customAction={k === '6' ? [{ key: 'open', value: 'Open invoice' }] : undefined}
              onUserNameClicked={() => setEvent(`userNameClicked: ${user}`)} onReplyPost={({ value }) => setEvent(`reply: ${value}`)} />
          ))}
        </Timeline>
      </Box>

      <Box label="UploadSetwithTable: invoice attachments (drop files, preview, rename)">
        <Attachments onEvent={setEvent} />
      </Box>

      <Box label="Timeline (horizontal)">
        <Timeline axisOrientation="Horizontal" showHeaderBar={false} sortOldestFirst growingThreshold={0}>
          {history.slice(0, 5).map(([k, date, title, user, , , status]) => <TimelineItem key={k} dateTime={date} title={title} userName={user} status={status} />)}
        </Timeline>
      </Box>
    </Stack>
  );
}
