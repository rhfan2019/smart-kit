/** Process and collaboration controls (docs/26 §3.6, §3.7, ADR-032): ProcessFlow, MicroProcessFlow, Timeline, FeedInput, FeedListItem. */
import { MantineProvider } from '@mantine/core';
import { smartKitCssVariablesResolver, smartKitMantineTheme, SmartKitProvider } from '@rhfan2019/smart-kit';
import ActionsPlaceholder from '@rhfan2019/smart-kit/m/upload/ActionsPlaceholder';
import FeedInput from '@rhfan2019/smart-kit/m/FeedInput';
import FeedListItem from '@rhfan2019/smart-kit/m/FeedListItem';
import MicroProcessFlow from '@rhfan2019/smart-kit/suite/ui/commons/MicroProcessFlow';
import MicroProcessFlowItem from '@rhfan2019/smart-kit/suite/ui/commons/MicroProcessFlowItem';
import ProcessFlow, { type ProcessFlowLaneHeader, type ProcessFlowNode } from '@rhfan2019/smart-kit/suite/ui/commons/ProcessFlow';
import { RESTRICTED_FILE_NAME_CHARACTERS } from '@rhfan2019/smart-kit/util';
import Timeline from '@rhfan2019/smart-kit/suite/ui/commons/Timeline';
import TimelineItem from '@rhfan2019/smart-kit/suite/ui/commons/TimelineItem';
import UploaderHttpRequestMethod from '@rhfan2019/smart-kit/m/upload/UploaderHttpRequestMethod';
import UploaderTableItem from '@rhfan2019/smart-kit/m/upload/UploaderTableItem';
import UploadSetwithTable, { type UploadItem } from '@rhfan2019/smart-kit/m/plugins/UploadSetwithTable';
import { UploadSetwithTableActionPlaceHolder, UploadState } from '@rhfan2019/smart-kit/m/library';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { ClipboardList, FileText, PackageCheck, Receipt } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';

function Providers({ children }: { children: ReactNode }) {
  return (
    <MantineProvider theme={smartKitMantineTheme} cssVariablesResolver={smartKitCssVariablesResolver} forceColorScheme="light">
      <SmartKitProvider services={{}} locale="en" namespace="storybook-controls-process" timeZone="Europe/Berlin">
        <div style={{ display: 'grid', gap: 24, padding: 16 }}>{children}</div>
      </SmartKitProvider>
    </MantineProvider>
  );
}

const meta: Meta = { title: 'smart-kit/Controls/Process', parameters: { layout: 'fullscreen' }, decorators: [(Story) => <Providers><Story /></Providers>] };
export default meta;
type Story = StoryObj;

const lanes: ProcessFlowLaneHeader[] = [
  { laneId: 'pr', text: 'Purchase Requisition', iconSrc: <ClipboardList />, position: 0, state: [{ state: 'Positive', value: 100 }] },
  { laneId: 'po', text: 'Purchase Order', iconSrc: <FileText />, position: 1, state: [{ state: 'Positive', value: 50 }, { state: 'Critical', value: 50 }] },
  { laneId: 'gr', text: 'Goods Receipt', iconSrc: <PackageCheck />, position: 2, state: [{ state: 'Positive', value: 50 }, { state: 'Planned', value: 50 }] },
  { laneId: 'iv', text: 'Supplier Invoice', iconSrc: <Receipt />, position: 3, state: [{ state: 'Negative', value: 50 }, { state: 'Planned', value: 50 }] },
];
const nodes: ProcessFlowNode[] = [
  { nodeId: 'pr1', laneId: 'pr', title: 'PR 10004711', titleAbbreviation: 'PR', state: 'Positive', stateText: 'Approved', texts: ['Laptops, 12 pcs'], children: ['po1', { nodeId: 'po2', connectionLabel: { text: 'Split', state: 'Critical' } }] },
  { nodeId: 'po1', laneId: 'po', title: 'PO 4500017230', titleAbbreviation: 'PO', state: 'Positive', stateText: 'Sent', children: ['gr1'] },
  { nodeId: 'po2', laneId: 'po', title: 'PO 4500017231', titleAbbreviation: 'PO', state: 'Critical', stateText: 'Overdue', children: ['gr2'] },
  { nodeId: 'gr1', laneId: 'gr', title: 'GR 5000088120', titleAbbreviation: 'GR', state: 'Positive', stateText: 'Posted', type: 'Aggregated', children: ['iv1'] },
  { nodeId: 'gr2', laneId: 'gr', title: 'Goods receipt', titleAbbreviation: 'GR', state: 'Planned', stateText: 'Expected', children: ['iv2'] },
  { nodeId: 'iv1', laneId: 'iv', title: 'Invoice 5105600731', titleAbbreviation: 'IV', state: 'Negative', stateText: 'Blocked' },
  { nodeId: 'iv2', laneId: 'iv', title: 'Invoice', titleAbbreviation: 'IV', state: 'PlannedNegative', stateText: 'Not received' },
];

function ProcessFlowDemo() {
  const ref = useRef<ProcessFlow>(null);
  return (
    <>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={() => ref.current?.zoomIn()}>Zoom in</button>
        <button type="button" onClick={() => ref.current?.zoomOut()}>Zoom out</button>
        <button type="button" onClick={() => ref.current?.setSelectedPath('pr1', 'iv1')}>Path PR → invoice</button>
        <button type="button" onClick={() => ref.current?.setSelectedPath(null, null)}>Clear</button>
      </div>
      <ProcessFlow ref={ref} lanes={lanes} nodes={nodes} showLabels foldedCorners onNodePress={(e) => console.info('nodePress', e.oEvent.nodeId)} onHeaderPress={(e) => console.info('headerPress', e.oEvent.laneId)} />
    </>
  );
}

export const ProcessFlowStory: Story = { name: 'ProcessFlow', render: () => <ProcessFlowDemo /> };

export const MicroProcessFlowStory: Story = {
  name: 'MicroProcessFlow',
  render: () => (
    <>
      {(['Wrap', 'NoWrap', 'ScrollingWithResizer'] as const).map((type) => (
        <MicroProcessFlow key={type} renderType={type} ariaLabel={`Order steps (${type})`} width="16rem">
          <MicroProcessFlowItem key="pr" state="Success" title="Requisition approved" />
          <MicroProcessFlowItem key="po" state="Warning" title="Order delayed" showIntermediary />
          <MicroProcessFlowItem key="gr" state="Success" title="Goods received" />
          <MicroProcessFlowItem key="iv" state="Error" title="Invoice blocked" onPress={(e) => console.info('press', e.item.key)} />
          <MicroProcessFlowItem key="pay" title="Payment" />
        </MicroProcessFlow>
      ))}
    </>
  ),
};

const history = [
  ['1', '2026-10-02T08:15:00Z', 'Requisition created', 'Anna Klein', 'Requisition', undefined],
  ['2', '2026-10-03T13:40:00Z', 'Requisition approved', 'Marc Weber', 'Requisition', 'Success'],
  ['3', '2026-10-06T09:05:00Z', 'Purchase order sent', 'Purchasing', 'Order', 'Information'],
  ['4', '2026-10-21T10:30:00Z', 'Delivery delayed', 'Acme Corp', 'Order', 'Warning'],
  ['5', '2026-11-04T15:10:00Z', 'Goods receipt posted', 'Warehouse', 'Receipt', 'Success'],
  ['6', '2026-11-12T11:00:00Z', 'Invoice blocked', 'Accounts Payable', 'Invoice', 'Error'],
] as const;
const timelineItems = () => history.map(([k, d, title, user, f, status]) => (
  <TimelineItem key={k} dateTime={d} title={title} userName={user} filterValue={f} status={status} text={`${title} by ${user}.`} />
));

export const TimelineStory: Story = {
  name: 'Timeline',
  render: () => (
    <>
      <Timeline groupByType="Month" enableSocial>{timelineItems()}</Timeline>
      <Timeline enableDoubleSided showHeaderBar={false} growingThreshold={0}>{timelineItems()}</Timeline>
      <Timeline axisOrientation="Horizontal" showHeaderBar={false} sortOldestFirst growingThreshold={0}>{timelineItems()}</Timeline>
    </>
  ),
};

export const Feed: Story = {
  render: () => (
    <div style={{ maxWidth: 640 }}>
      <FeedInput iconInitials="AK" maxLength={200} showExceededText onPost={({ value }) => console.info('post', value)} />
      <ul style={{ margin: 0, padding: 0 }}>
        <FeedListItem sender="Marc Weber" iconInitials="MW" info="Comment" timestamp="2026-11-15T16:20:00Z" maxCharacters={60}
          text="Can we accept the partial delivery? Sales needs 10 laptops by Monday, the remaining 2 can follow in December."
          onSenderPress={(e) => console.info('senderPress', e.getDomRef())} actions={[{ key: 'reply', text: 'Reply' }, { key: 'delete', text: 'Delete', enabled: false }]} />
        <FeedListItem sender="Acme Corp" iconInitials="AC" timestamp="Yesterday" unread highlight="Warning" type="Navigation"
          text="Tracking for the shipment: https://example.com/track/88120" convertLinksToAnchorTags="All" onPress={() => console.info('press')} />
      </ul>
    </div>
  ),
};

const attachments: UploadItem[] = [
  { id: 'q', fileName: 'Quotation-4711.pdf', mediaType: 'application/pdf', url: 'https://example.com/quotation.pdf', fileSize: 254_000, uploadState: UploadState.Complete },
  { id: 'd', fileName: 'Delivery-note.png', mediaType: 'image/png', url: 'https://picsum.photos/seed/delivery/800/600', fileSize: 1_200_000, uploadState: UploadState.Complete },
];

function UploadDemo() {
  const ref = useRef<UploadSetwithTable>(null);
  const [items, setItems] = useState(attachments);
  return (
    <UploadSetwithTable ref={ref} title="Invoice attachments" items={items} multiple maxFileSize={10} fileTypes={['pdf', 'png', 'jpg', 'xlsx']}
      uploader={<UploaderTableItem uploadUrl="https://httpbin.org/post" httpRequestMethod={UploaderHttpRequestMethod.Post} useMultipart />}
      onUploadCompleted={(e) => console.info('uploadCompleted', e.status, e.item.fileName)}
      onItemRenamed={(e) => setItems((all) => all.map((i) => (i.id === e.item.id ? { ...i, fileName: e.item.fileName } : i)))}
      onRemove={(e) => setItems((all) => all.filter((i) => i.id !== e.item.id))}
      onFileTypeMismatch={(e) => console.info('fileTypeMismatch', e.item.fileName)}
      actions={<>
        <button type="button" onClick={() => console.info('restricted characters', RESTRICTED_FILE_NAME_CHARACTERS)}>Rules</button>
        <ActionsPlaceholder placeholderFor={UploadSetwithTableActionPlaceHolder.UploadButtonPlaceholder} />
        <button type="button" onClick={() => void UploaderTableItem.uploadFile(new Blob(['demo']), 'https://httpbin.org/post')}>Upload a blob</button>
      </>} />
  );
}

export const UploadSetwithTableStory: Story = {
  name: 'UploadSetwithTable',
  render: () => (
    <>
      <UploadDemo />
      <UploadSetwithTable title="Empty" uploadUrl="https://httpbin.org/post" />
    </>
  ),
};
