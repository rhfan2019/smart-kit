/** Process and collaboration controls (docs/26 §3.6, §3.7, ADR-032): SAPUI5 names, properties, events and methods. */
import { MantineProvider } from '@mantine/core';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Truck } from 'lucide-react';
import { createRef, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SmartKitProvider, smartKitMantineTheme } from '../src';
import ActionsPlaceholder from '@rhfan2019/smart-kit/m/upload/ActionsPlaceholder';
import FeedInput from '@rhfan2019/smart-kit/m/FeedInput';
import FeedListItem from '@rhfan2019/smart-kit/m/FeedListItem';
import MicroProcessFlow from '@rhfan2019/smart-kit/suite/ui/commons/MicroProcessFlow';
import MicroProcessFlowItem from '@rhfan2019/smart-kit/suite/ui/commons/MicroProcessFlowItem';
import ProcessFlow, { type ProcessFlowLaneHeader, type ProcessFlowNode } from '@rhfan2019/smart-kit/suite/ui/commons/ProcessFlow';
import Timeline from '@rhfan2019/smart-kit/suite/ui/commons/Timeline';
import TimelineItem from '@rhfan2019/smart-kit/suite/ui/commons/TimelineItem';
import UploaderTableItem from '@rhfan2019/smart-kit/m/upload/UploaderTableItem';
import UploadSetwithTable, { type UploadItem } from '@rhfan2019/smart-kit/m/plugins/UploadSetwithTable';
import { UploadSetwithTableActionPlaceHolder } from '@rhfan2019/smart-kit/m/library';
import { isoWeek, timelineGroup } from '../src/controls/process/Timeline';
import { layoutProcessFlow, pathBetween, zoomForWidth } from '../src/controls/process/ProcessFlow';
import { linkify } from '../src/controls/process/Feed';
import { restrictedCharacters, validationFailure } from '../src/controls/process/UploadSetwithTable';
import { processEn } from '../src/i18n/controls/process.en';
import { processZh } from '../src/i18n/controls/process.zh';
import { createText } from '../src/i18n/text';
import { TEXTS } from '../src/controls/process/texts';
import type { Messages } from '../src/i18n/messages.en';

function view(ui: ReactNode, locale?: 'en' | 'zh') {
  return render(
    <MantineProvider theme={smartKitMantineTheme} env="test">
      {locale ? <SmartKitProvider services={{}} locale={locale} namespace={`p${Math.random()}`} timeZone="Europe/Berlin">{ui}</SmartKitProvider> : ui}
    </MantineProvider>,
  );
}
const t = createText('en', TEXTS.en as Partial<Messages>);

const lanes: ProcessFlowLaneHeader[] = [
  { laneId: 'inv', text: 'Invoice', position: 3, state: [{ state: 'Planned', value: 100 }] },
  { laneId: 'pr', text: 'Requisition', position: 0, iconSrc: <Truck />, state: [{ state: 'Positive', value: 75 }, { state: 'Critical', value: 25 }] },
  { laneId: 'po', text: 'Purchase Order', position: 1 },
  { laneId: 'gr', text: 'Goods Receipt', position: 2 },
];
const nodes: ProcessFlowNode[] = [
  { nodeId: 'pr1', laneId: 'pr', title: 'PR 10000123', titleAbbreviation: 'PR', state: 'Positive', stateText: 'Approved', children: ['po1', { nodeId: 'po2', connectionLabel: { text: '2 items', state: 'Critical', priority: 1 } }], texts: ['Office supplies'] },
  { nodeId: 'po1', laneId: 'po', title: 'PO 4500000017', state: 'Positive', stateText: 'Sent', children: ['gr1'] },
  { nodeId: 'po2', laneId: 'po', title: 'PO 4500000018', state: 'Critical', stateText: 'Delayed', type: 'Aggregated' },
  { nodeId: 'gr1', laneId: 'gr', title: 'GR 5000000301', state: 'Neutral', stateText: 'Posted' },
  { nodeId: 'inv1', laneId: 'inv', title: 'Invoice 5105600', state: 'Planned', stateText: 'Expected', parents: ['gr1'] },
];
const node = (c: HTMLElement, id: string) => c.querySelector(`[data-node-id="${id}"]`) as HTMLElement;

describe('ProcessFlow', () => {
  it('UE-40 lanes are columns in `position` order; a child starts on its parent row and siblings go below', () => {
    const l = layoutProcessFlow(lanes, nodes);
    expect(l.lanes.map((x) => x.laneId)).toEqual(['pr', 'po', 'gr', 'inv']);
    expect(['pr1', 'po1', 'po2', 'gr1', 'inv1'].map((id) => [l.placed.get(id)?.col, l.placed.get(id)?.row])).toEqual([[0, 0], [1, 0], [1, 1], [2, 0], [3, 0]]);
    expect(l.rows).toBe(2);
    const { container } = view(<ProcessFlow lanes={lanes} nodes={nodes} />);
    expect([...container.querySelectorAll('.sk-process-flow__lane')].map((e) => e.textContent)).toEqual(['Requisition', 'Purchase Order', 'Goods Receipt', 'Invoice']);
    expect(node(container, 'po2').style.gridRow).toBe('2');
    expect(node(container, 'po2')).toHaveClass('sk-process-flow__node--aggregated', 'sk-process-flow__node--critical');
  });

  it('UE-41 connectors are SVG paths with arrowheads; `parents` also connect; planned targets get dashed lines', () => {
    const { container } = view(<ProcessFlow lanes={lanes} nodes={nodes} />);
    const paths = [...container.querySelectorAll('path.sk-process-flow__line')];
    expect(paths.map((x) => x.getAttribute('data-connection')).sort()).toEqual(['gr1>inv1', 'po1>gr1', 'pr1>po1', 'pr1>po2']);
    expect(container.querySelectorAll('.sk-process-flow__arrow')).toHaveLength(4);
    expect(container.querySelector('[data-connection="gr1>inv1"]')).toHaveClass('sk-process-flow__line--planned');
    expect(node(container, 'inv1')).toHaveClass('sk-process-flow__node--planned');
  });

  it('UE-42 AL-06 nodePress gets { oEvent: node }, headerPress { oEvent: lane } (lane `onPress` too); nodes are buttons reachable by keyboard', () => {
    const onNodePress = vi.fn();
    const onHeaderPress = vi.fn();
    const lanePress = vi.fn();
    const { container } = view(<ProcessFlow lanes={lanes.map((l) => (l.laneId === 'po' ? { ...l, onPress: lanePress } : l))} nodes={nodes} onNodePress={onNodePress} onHeaderPress={onHeaderPress} />);
    const po1 = node(container, 'po1');
    expect(po1).toHaveAttribute('role', 'button');
    fireEvent.keyDown(po1, { key: 'Enter' });
    expect(onNodePress).toHaveBeenCalledWith({ oEvent: nodes[1] });
    fireEvent.click(screen.getByRole('button', { name: /Purchase Order/ }));
    expect(lanePress).toHaveBeenCalled();
    expect(onHeaderPress).toHaveBeenCalledWith({ oEvent: expect.objectContaining({ laneId: 'po' }) });
  });

  it('UE-43 no zoomLevel property: zoomIn / zoomOut / getZoomLevel / setZoomLevel; level Four shows titleAbbreviation; zoomLevel*Content replaces the content', () => {
    expect([zoomForWidth(80), zoomForWidth(50), zoomForWidth(20)]).toEqual(['Two', 'Three', 'Four']);
    const ref = createRef<ProcessFlow>();
    const custom = nodes.map((n) => (n.nodeId === 'gr1' ? { ...n, zoomLevelOneContent: <b>custom GR</b> } : n));
    const { container } = view(<ProcessFlow ref={ref} lanes={lanes} nodes={custom} />);
    expect(ref.current!.getZoomLevel()).toBe('Two');
    expect(node(container, 'pr1')).toHaveTextContent('Office supplies');
    let level = '';
    act(() => { level = ref.current!.zoomIn(); });
    expect(level).toBe('One');
    expect(container.querySelector('.sk-process-flow')).toHaveAttribute('data-zoom-level', 'One');
    expect(node(container, 'gr1')).toHaveTextContent('custom GR');
    act(() => ref.current!.setZoomLevel('Four'));
    expect(node(container, 'pr1').textContent).toBe('PR');
    act(() => { level = ref.current!.zoomOut(); });
    expect(level).toBe('Four');
  });

  it('UE-44 AL-06 setSelectedPath highlights the path and dims the rest; getFocusedNode; onOnError ({ oEvent: { text } }) for an unknown lane or node', () => {
    expect(pathBetween(layoutProcessFlow(lanes, nodes).edges, 'pr1', 'inv1')).toEqual(['pr1', 'po1', 'gr1', 'inv1']);
    const ref = createRef<ProcessFlow>();
    const onOnError = vi.fn();
    const { container } = view(<ProcessFlow ref={ref} lanes={lanes} nodes={[...nodes, { nodeId: 'x', laneId: 'nope', children: ['ghost'] }]} onNodePress={() => {}} onOnError={onOnError} />);
    expect(onOnError).toHaveBeenCalledWith({ oEvent: { text: expect.stringContaining('unknown lane nope') } });
    act(() => { ref.current!.setSelectedPath('pr1', 'gr1'); });
    expect(node(container, 'po1')).toHaveClass('sk-process-flow__node--highlighted');
    expect(node(container, 'po2')).toHaveClass('sk-process-flow__node--dimmed');
    expect(container.querySelector('[data-connection="pr1>po1"]')).toHaveClass('sk-process-flow__line--highlighted');
    act(() => { ref.current!.setSelectedPath(null, null); });
    expect(node(container, 'po2')).not.toHaveClass('sk-process-flow__node--dimmed');
    fireEvent.focus(node(container, 'po2'));
    expect(ref.current!.getFocusedNode()).toBe('po2');
  });

  it('UE-45 AL-06 showLabels shows connection labels (highest priority wins); labelPress gets { oEvent: { selectedLabel, connections } }; foldedCorners', () => {
    const onLabelPress = vi.fn();
    const { container, rerender } = view(<ProcessFlow lanes={lanes} nodes={nodes} onLabelPress={onLabelPress} foldedCorners />);
    expect(screen.queryByRole('button', { name: '2 items' })).toBeNull();
    expect(node(container, 'pr1')).toHaveClass('sk-process-flow__node--folded');
    rerender(<MantineProvider env="test"><ProcessFlow lanes={lanes} nodes={nodes} onLabelPress={onLabelPress} showLabels /></MantineProvider>);
    const label = screen.getByRole('button', { name: '2 items' });
    expect(label).toHaveClass('sk-process-flow__label--critical');
    fireEvent.click(label);
    const selectedLabel = expect.objectContaining({ text: '2 items' });
    expect(onLabelPress).toHaveBeenCalledWith({ oEvent: { selectedLabel, connections: [{ sourceNode: nodes[0], targetNode: nodes[2], label: selectedLabel }] } });
  });

  it('UE-46 the lane header shows its icon in a donut whose arcs follow `state`; the donut has an accessible summary', () => {
    const { container } = view(<ProcessFlow lanes={lanes} nodes={nodes} />);
    const donut = screen.getByRole('img', { name: 'Positive: 75%, Critical: 25%' });
    const arcs = donut.querySelectorAll('.sk-process-flow__donut-arc');
    expect([...arcs].map((a) => a.getAttribute('stroke-dasharray'))).toEqual(['75 25', '25 75']);
    expect(arcs[1]).toHaveClass('sk-process-flow__donut-arc--critical');
    expect(container.querySelector('.sk-process-flow__lane-glyph svg')).not.toBeNull();
  });
});

describe('MicroProcessFlow', () => {
  it('UE-47 renders an ordered list of state icons with separators, intermediary content, stepWidth and renderType', () => {
    const { container } = view(
      <MicroProcessFlow renderType="NoWrap" ariaLabel="Order steps" width="20rem">
        <MicroProcessFlowItem key="pr" state="Success" title="Requisition approved" showIntermediary intermediary={<i data-testid="mid">…</i>} />
        <MicroProcessFlowItem key="po" state="Warning" title="Order delayed" stepWidth="5rem" />
        <MicroProcessFlowItem key="gr" title="Goods receipt" showSeparator={false} />
        <MicroProcessFlowItem key="iv" state="Error" title="Invoice blocked" customControl={<span data-testid="custom">!</span>} />
      </MicroProcessFlow>,
    );
    const list = screen.getByRole('list', { name: 'Order steps' });
    expect(list.tagName).toBe('OL');
    expect(list).toHaveClass('sk-micro-flow--nowrap');
    expect(within(list).getAllByRole('listitem')).toHaveLength(4);
    expect(screen.getByRole('img', { name: 'Requisition approved' })).toHaveClass('sk-status--positive');
    expect(screen.getByRole('img', { name: 'Order delayed' })).toHaveClass('sk-status--critical');
    expect(container.querySelectorAll('.sk-micro-flow__separator')).toHaveLength(2);
    expect(screen.getByTestId('mid')).toBeInTheDocument();
    expect(screen.getByTestId('custom')).toBeInTheDocument();
    expect((container.querySelector('[data-state="Warning"]') as HTMLElement).style.inlineSize).toBe('5rem');
  });

  it('UE-48 an item with press is a button; press({ item }) carries the key and can be prevented', () => {
    const onPress = vi.fn((e) => e.preventDefault());
    view(<MicroProcessFlow renderType="ScrollingWithResizer"><MicroProcessFlowItem key="po" state="Information" title="PO sent" onPress={onPress} /></MicroProcessFlow>);
    fireEvent.click(screen.getByRole('button', { name: 'PO sent' }));
    expect(onPress.mock.calls[0][0].item).toMatchObject({ key: 'po', title: 'PO sent', state: 'Information' });
    expect(onPress.mock.calls[0][0].defaultPrevented).toBe(true);
    expect(screen.getByRole('button', { name: 'Scroll forward' })).toBeInTheDocument();
  });
});

const entries = [
  ['a', '2026-03-02T09:00:00Z', 'Requisition created', 'Anna', 'Requisition'],
  ['b', '2026-04-10T09:00:00Z', 'Purchase order sent', 'Ben', 'Order'],
  ['c', '2026-04-12T09:00:00Z', 'Order confirmed', 'Supplier', 'Order'],
  ['d', '2026-05-20T09:00:00Z', 'Goods received', 'Carl', 'Receipt'],
  ['e', '2026-06-01T09:00:00Z', 'Invoice posted', 'Dora', 'Invoice'],
  ['f', '2026-06-15T09:00:00Z', 'Payment released', 'Dora', 'Invoice'],
  ['g', '2026-07-01T09:00:00Z', 'Order closed', 'Ben', 'Order'],
] as const;
const items = (extra: Partial<Parameters<typeof TimelineItem>[0]> = {}) => entries.map(([k, d, title, user, f]) => (
  <TimelineItem key={k} dateTime={d} title={title} userName={user} filterValue={f} text={`Text of ${title}`} {...extra} />
));
const titles = () => [...document.querySelectorAll('.sk-timeline__title')].map((e) => e.textContent);

describe('Timeline', () => {
  it('UE-49 a list of items, newest first; sortOldestFirst reverses; sort=false keeps the children order', () => {
    const { rerender } = view(<Timeline growingThreshold={0}>{items()}</Timeline>);
    expect(screen.getByRole('list', { name: 'Timeline' })).toBeInTheDocument();
    expect(titles()[0]).toBe('Order closed');
    fireEvent.click(screen.getByRole('button', { name: 'Sort by date' }));
    expect(titles()[0]).toBe('Requisition created');
    rerender(<MantineProvider env="test"><Timeline growingThreshold={0} sortOldestFirst>{items()}</Timeline></MantineProvider>);
    expect(titles()[0]).toBe('Requisition created');
    rerender(<MantineProvider env="test"><Timeline growingThreshold={0} sort={false}>{[...items()].reverse()}</Timeline></MantineProvider>);
    expect(titles()[0]).toBe('Order closed');
    expect(titles()[6]).toBe('Requisition created');
    expect(screen.queryByRole('button', { name: 'Sort by date' })).toBeNull();
  });

  it('UE-50 shows growingThreshold (5) items, then "More" adds the next ones and fires grow', () => {
    const onGrow = vi.fn();
    view(<Timeline onGrow={onGrow}>{items()}</Timeline>);
    expect(titles()).toHaveLength(5);
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(titles()).toHaveLength(7);
    expect(onGrow).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'More' })).toBeNull();
  });

  it('UE-51 groupByType adds group headers (Year, Quarter, Month, Week, Day)', () => {
    expect(isoWeek(2026, 1, 1)).toEqual({ week: 1, year: 2026 });
    expect(isoWeek(2027, 1, 1)).toEqual({ week: 53, year: 2026 });
    const d = new Date('2026-11-16T09:00:00Z');
    expect(timelineGroup(t, 'Quarter', d, 'en-US', 'UTC').text).toBe('Q4 2026');
    expect(timelineGroup(t, 'Week', d, 'en-US', 'UTC').text).toBe('Week 47, 2026');
    expect(timelineGroup(createText('zh', TEXTS.zh as Partial<Messages>), 'Quarter', d, 'zh-CN', 'UTC').text).toBe('2026 年第 4 季度');
    view(<Timeline growingThreshold={0} groupByType="Month">{items()}</Timeline>, 'en');
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['July 2026', 'June 2026', 'May 2026', 'April 2026', 'March 2026']);
  });

  it('UE-52 search filters items and fires filterSelectionChange; itemFiltering can keep an item with preventDefault', () => {
    const onFilterSelectionChange = vi.fn();
    const onItemFiltering = vi.fn((e) => { if (e.item.key === 'g') e.preventDefault(); });
    view(<Timeline growingThreshold={0} onFilterSelectionChange={onFilterSelectionChange} onItemFiltering={onItemFiltering}>{items()}</Timeline>);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search' }), { target: { value: 'invoice' } });
    expect(onFilterSelectionChange).toHaveBeenCalledWith({ type: 'Search', searchTerm: 'invoice' });
    expect(onItemFiltering.mock.calls[0][0]).toMatchObject({ reasons: { search: true }, searchTerm: 'invoice' });
    expect(titles()).toEqual(['Order closed', 'Payment released', 'Invoice posted']);
  });

  it('UE-53 the filter popover filters by filterValue (filterList) and time; filterOpen fires; reset() clears everything', async () => {
    const ref = createRef<Timeline>();
    const onFilterOpen = vi.fn();
    const onFilterSelectionChange = vi.fn();
    view(
      <Timeline ref={ref} growingThreshold={0} filterTitle="Filter by step" onFilterOpen={onFilterOpen} onFilterSelectionChange={onFilterSelectionChange}
        filterList={[{ key: 'Order', text: 'Orders' }, { key: 'Invoice', text: 'Invoices' }]}>{items()}</Timeline>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Filter by step' }));
    expect(onFilterOpen).toHaveBeenCalled();
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Orders' }));
    expect(onFilterSelectionChange).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'Data', selectedItem: 'Order', selectedItems: [{ key: 'Order', text: 'Orders' }] }));
    expect(titles()).toEqual(['Order closed', 'Order confirmed', 'Purchase order sent']);
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-04-11' } });
    expect(titles()).toEqual(['Order closed', 'Order confirmed']);
    expect(onFilterSelectionChange).toHaveBeenLastCalledWith({ type: 'Time', timeKeys: { from: expect.any(Date), to: undefined } });
    act(() => ref.current!.reset());
    expect(titles()).toHaveLength(7);
  });

  it('UE-54 select({ selectedItem, userAction }), item press, userNameClicked({ uiElement }), customActionClicked and social replies', () => {
    const onSelect = vi.fn();
    const press = vi.fn();
    const userNameClicked = vi.fn();
    const action = vi.fn();
    const replyPost = vi.fn();
    const replyListOpen = vi.fn();
    view(
      <Timeline onSelect={onSelect} enableSocial showHeaderBar={false}>
        <TimelineItem key="b" dateTime="2026-04-10T09:00:00Z" title="Purchase order sent" userName="Ben" userNameClickable onUserNameClicked={userNameClicked} onPress={press}
          customAction={[{ key: 'open', value: 'Open order' }]} onCustomActionClicked={action} replyCount={2} onReplyPost={replyPost} onReplyListOpen={replyListOpen}>
          <span data-testid="embedded">PDF</span>
        </TimelineItem>
      </Timeline>,
    );
    expect(screen.queryByRole('toolbar')).toBeNull();
    expect(screen.getByTestId('embedded')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Purchase order sent/ }));
    expect(press).toHaveBeenCalled();
    expect(onSelect).toHaveBeenCalledWith({ selectedItem: expect.objectContaining({ key: 'b', title: 'Purchase order sent' }), userAction: true });
    fireEvent.click(screen.getByRole('button', { name: 'Ben' }));
    expect(userNameClicked).toHaveBeenCalledWith({ uiElement: screen.getByRole('button', { name: 'Ben' }) });
    fireEvent.click(screen.getByRole('button', { name: 'Open order' }));
    expect(action).toHaveBeenCalledWith(expect.objectContaining({ key: 'open', value: 'Open order' }));
    fireEvent.click(screen.getByRole('button', { name: '2 replies' }));
    expect(replyListOpen).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Reply' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Reply' }), { target: { value: 'Thanks' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Reply' })[1]);
    expect(replyPost).toHaveBeenCalledWith({ value: 'Thanks' });
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('UE-55 axisOrientation, alignment, enableDoubleSided, maxCharacters, noDataText and setCustomMessage', () => {
    const ref = createRef<Timeline>();
    const closed = vi.fn();
    const { container, rerender } = view(<Timeline ref={ref} axisOrientation="Horizontal" alignment="Top" onCustomMessageClosed={closed}>{items({ maxCharacters: 8 })}</Timeline>);
    const root = container.querySelector('.sk-timeline')!;
    expect(root).toHaveClass('sk-timeline--horizontal', 'sk-timeline--align-top');
    expect((root as HTMLElement).style.inlineSize).toBe('100%');
    expect(screen.getAllByText('Text of…').length).toBeGreaterThan(0);
    act(() => ref.current!.setCustomMessage('Showing the last 6 months'));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(closed).toHaveBeenCalled();
    rerender(<MantineProvider env="test"><Timeline enableDoubleSided>{items()}</Timeline></MantineProvider>);
    expect(container.querySelectorAll('.sk-timeline__item--end')).toHaveLength(2);
    rerender(<MantineProvider env="test"><Timeline noDataText="No history yet" /></MantineProvider>);
    expect(screen.getByRole('status')).toHaveTextContent('No history yet');
  });
});

describe('FeedInput and FeedListItem', () => {
  it('UE-56 FeedInput posts the value and clears; empty or over maxLength cannot post; buttonTooltip "Submit"; actions sit next to the button', () => {
    const onPost = vi.fn();
    view(<FeedInput onPost={onPost} maxLength={10} showExceededText iconInitials="RF" actions={<button type="button">Attach</button>} />);
    const box = screen.getByRole('textbox', { name: 'Post something here' });
    const post = screen.getByRole('button', { name: 'Submit' });
    expect(post).toBeDisabled();
    fireEvent.change(box, { target: { value: 'Please confirm the delivery date' } });
    expect(screen.getByText('22 characters over the limit')).toBeInTheDocument();
    expect(post).toBeDisabled();
    fireEvent.change(box, { target: { value: 'Confirmed' } });
    fireEvent.click(post);
    expect(onPost).toHaveBeenCalledWith({ value: 'Confirmed' });
    expect(box).toHaveValue('');
    expect(screen.getByText('RF')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Attach' })).toBeInTheDocument();
  });

  it('UE-57 AL-06 FeedListItem shows sender, text, info and timestamp; "More" / "Less" after maxCharacters; senderPress / iconPress get getDomRef (no deprecated domRef)', () => {
    const onSenderPress = vi.fn();
    const onIconPress = vi.fn();
    view(
      <ul>
        <FeedListItem sender="Anna Klein" text="The supplier confirmed the new delivery date for all items." info="Reply" timestamp="2026-11-16T09:00:00Z"
          maxCharacters={20} moreLabel="Show more" iconInitials="AK" onSenderPress={onSenderPress} onIconPress={onIconPress} />
        <FeedListItem sender="Ben" text="ok" timestamp="Yesterday" senderActive={false} onSenderPress={onSenderPress} />
      </ul>, 'en',
    );
    // collapsed back to the last space before maxCharacters, as sap.m.FeedListItem._getCollapsedText
    expect(screen.getByText(/^The supplier…$/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show more' }));
    expect(screen.getByText(/all items\./)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Less' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Nov 16, 2026, 10:00 AM')).toBeInTheDocument();
    expect(screen.getByText('Yesterday')).toBeInTheDocument();
    const [avatar, sender] = screen.getAllByRole('button', { name: 'Anna Klein' });
    fireEvent.click(sender);
    expect(onSenderPress.mock.calls[0][0].getDomRef()).toBe(sender);
    expect(screen.queryByRole('button', { name: 'Ben' })).toBeNull();
    fireEvent.click(avatar);
    expect(onIconPress.mock.calls[0][0].getDomRef()).toBe(avatar);
    expect(Object.keys(onIconPress.mock.calls[0][0])).toEqual(['getDomRef']);
  });

  it('UE-58 actions menu (visible, enabled), ListItemBase type / press / detailPress / unread / counter / highlight, link conversion', async () => {
    const approve = vi.fn();
    const onPress = vi.fn();
    const onDetailPress = vi.fn();
    const { container } = view(
      <ul>
        <FeedListItem sender="Carl" text="Details on https://example.com/po/4500000017." convertLinksToAnchorTags="All" type="DetailAndActive" onPress={onPress} onDetailPress={onDetailPress}
          unread counter={3} highlight="Warning" highlightText="Needs attention"
          actions={[{ key: 'ok', text: 'Approve', onPress: approve }, { key: 'no', text: 'Reject', enabled: false }, { key: 'hidden', text: 'Hidden', visible: false }]} />
      </ul>,
    );
    const li = container.querySelector('li')!;
    expect(li).toHaveClass('sk-feed-item--unread', 'sk-feed-item--active');
    expect(li).toHaveAttribute('data-highlight', 'Warning');
    expect(screen.getByText('Needs attention')).toHaveClass('sk-visually-hidden');
    expect(screen.getByLabelText('3 items')).toHaveTextContent('3');
    expect(screen.getByRole('link', { name: 'https://example.com/po/4500000017' })).toHaveAttribute('target', '_blank');
    fireEvent.click(li);
    expect(onPress).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(onDetailPress).toHaveBeenCalled();
    expect(onPress).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    expect(await screen.findByRole('menuitem', { name: 'Reject' })).toBeDisabled();
    expect(screen.queryByRole('menuitem', { name: 'Hidden' })).toBeNull();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Approve' }));
    expect(approve).toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole('menuitem', { name: 'Approve' })).toBeNull());
    const parts = linkify('see www.example.com and ftp://x.org', 'ProtocolOnly', '_self') as ReactNode[];
    expect(parts).toHaveLength(2);
  });

  it('UE-59 works without a SmartKitProvider (English) and uses the provider locale (Chinese texts, zh-CN dates); en and zh have the same keys', () => {
    expect(Object.keys(processZh).sort()).toEqual(Object.keys(processEn).sort());
    view(<FeedInput />);
    expect(screen.getByRole('textbox', { name: 'Post something here' })).toBeInTheDocument();
    view(<><FeedInput /><ul><FeedListItem sender="王芳" text="已收货" timestamp="2026-11-16T09:00:00Z" /></ul><Timeline /></>, 'zh');
    expect(screen.getByRole('textbox', { name: '发表内容' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '提交' })).toBeInTheDocument();
    expect(screen.getByText('没有条目')).toBeInTheDocument();
    expect(screen.getByText(/2026年11月16日/)).toBeInTheDocument();
  });
});

class MockXHR {
  static all: MockXHR[] = [];
  upload: { onprogress: ((e: { loaded: number; total: number; lengthComputable: boolean }) => void) | null } = { onprogress: null };
  status = 0;
  readyState = 1;
  responseText = '';
  responseXML = null;
  responseType = '';
  method = '';
  url = '';
  body: unknown;
  headers: Record<string, string> = {};
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  open(method: string, url: string) { this.method = method; this.url = url; }
  setRequestHeader(n: string, v: string) { this.headers[n] = v; }
  send(body: unknown) { this.body = body; MockXHR.all.push(this); }
  abort() { this.onabort?.(); }
  getAllResponseHeaders() { return 'Content-Type: application/json\r\nX-Doc: 42\r\n'; }
  progress(loaded: number, total: number) { act(() => this.upload.onprogress?.({ loaded, total, lengthComputable: true })); }
  respond(status: number, text = '') { this.status = status; this.readyState = 4; this.responseText = text; this.onload?.(); }
}
const file = (name: string, type = 'application/pdf', size = 10) => new File(['x'.repeat(size)], name, { type });
const choose = (container: HTMLElement, ...files: File[]) => {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  Object.defineProperty(input, 'files', { value: files, configurable: true });
  fireEvent.change(input);
};
const existing: UploadItem[] = [
  { id: 'a', fileName: 'Quotation-4711.pdf', mediaType: 'application/pdf', url: '/files/q.pdf', fileSize: 254_000, uploadState: 'Complete' },
  { id: 'b', fileName: 'Delivery-note.png', mediaType: 'image/png', url: '/files/d.png', fileSize: 2_400_000 },
];

describe('UploadSetwithTable', () => {
  beforeEach(() => { MockXHR.all = []; vi.stubGlobal('XMLHttpRequest', MockXHR); });
  afterEach(() => vi.unstubAllGlobals());

  it('UE-90 empty state is an IllustratedMessage; the toolbar has the upload button (at ActionsPlaceholder); the table lists name, size, state and extra columns', () => {
    const { container, rerender } = view(<UploadSetwithTable />);
    expect(container.querySelector('[data-sk-illustrated-message="UploadToCloud"]')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Upload' })).toBeEnabled();
    rerender(
      <MantineProvider env="test">
        <UploadSetwithTable title="Invoice attachments" items={existing} columns={[{ key: 'by', header: 'Uploaded by', cell: (i) => (i.id === 'a' ? 'Anna' : 'Ben') }]}
          actions={<><button type="button">Scan</button><ActionsPlaceholder placeholderFor={UploadSetwithTableActionPlaceHolder.UploadButtonPlaceholder} /><button type="button">Help</button></>} />
      </MantineProvider>,
    );
    const toolbar = screen.getByRole('toolbar', { name: 'Invoice attachments' });
    expect(within(toolbar).getAllByRole('button').map((b) => b.textContent)).toEqual(['Scan', 'Upload', 'Help']);
    const table = screen.getByRole('table', { name: 'Invoice attachments' });
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['File name', 'Size', 'Status', 'Uploaded by', 'Actions']);
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows[0]).toHaveTextContent('Quotation-4711.pdf');
    expect(rows[0]).toHaveTextContent('248 kB');
    expect(rows[0]).toHaveTextContent('Uploaded');
    expect(rows[1]).toHaveTextContent('2.3 MB');
    expect(rows[1]).toHaveTextContent('Ben');
    rerender(<MantineProvider env="test"><UploadSetwithTable uploadButtonInvisible /></MantineProvider>);
    expect(screen.queryByRole('button', { name: 'Upload' })).toBeNull();
  });

  it('UE-91 a selected file uploads with XMLHttpRequest (headers, progress announced) and fires beforeInitiatingItemUpload, beforeUploadStarts and uploadCompleted', async () => {
    const order: string[] = [];
    const onUploadCompleted = vi.fn();
    const { container } = view(
      <UploadSetwithTable uploadUrl="/upload" headerFields={[{ name: 'x-csrf-token', value: 'abc' }]} onBeforeInitiatingItemUpload={() => order.push('initiating')}
        onBeforeUploadStarts={() => order.push('before')} onUploadCompleted={onUploadCompleted} />,
    );
    choose(container, file('Invoice-5105600.pdf', 'application/pdf', 2048));
    await waitFor(() => expect(MockXHR.all).toHaveLength(1));
    const xhr = MockXHR.all[0]!;
    expect([xhr.method, xhr.url, xhr.headers['x-csrf-token']]).toEqual(['POST', '/upload', 'abc']);
    expect(xhr.body).toBeInstanceOf(File);
    expect(order).toEqual(['initiating', 'before']);
    xhr.progress(512, 2048);
    expect(screen.getByText('Uploading 25%').closest('[aria-live]')).toHaveAttribute('aria-live', 'polite');
    act(() => xhr.respond(201, '{"id":42}'));
    await waitFor(() => expect(onUploadCompleted).toHaveBeenCalled());
    expect(onUploadCompleted.mock.calls[0][0]).toMatchObject({
      item: { fileName: 'Invoice-5105600.pdf', uploadState: 'Complete' }, response: '{"id":42}', responseText: '{"id":42}', status: 201, readyState: 4,
      headers: { 'content-type': 'application/json', 'x-doc': '42' },
    });
    expect(screen.getByRole('row', { name: /Invoice-5105600\.pdf/ })).toHaveAttribute('data-upload-state', 'Complete');
  });

  it('UE-92 AL-06 beforeUploadStarts can prevent the upload; an <UploaderTableItem> sets URL, method (Put) and multipart and gets its own events', async () => {
    const prevent = vi.fn((e) => e.preventDefault());
    const { container, unmount } = view(<UploadSetwithTable uploadUrl="/upload" onBeforeUploadStarts={prevent} />);
    choose(container, file('a.pdf'));
    await waitFor(() => expect(prevent).toHaveBeenCalled());
    expect(MockXHR.all).toHaveLength(0);
    expect(screen.getByRole('row', { name: /a\.pdf/ })).toHaveAttribute('data-upload-state', 'Ready');
    unmount();
    const events: string[] = [];
    const uploader = (
      <UploaderTableItem uploadUrl="/attachments" httpRequestMethod="Put" useMultipart
        onUploadStarted={() => events.push('started')} onUploadProgressed={(e) => events.push(`progress ${e.loaded}/${e.total}`)} onUploadCompleted={(e) => events.push(`completed ${e.responseXHR.status}`)} />
    );
    const v = view(<UploadSetwithTable uploadUrl="/ignored" uploader={uploader} />);
    choose(v.container, file('b.pdf'));
    await waitFor(() => expect(MockXHR.all).toHaveLength(1));
    const xhr = MockXHR.all[0]!;
    expect([xhr.method, xhr.url]).toEqual(['PUT', '/attachments']);
    // as UI5: the form field is named after the file, plus _charset_
    expect((xhr.body as FormData).get('b.pdf')).toBeInstanceOf(File);
    expect((xhr.body as FormData).get('_charset_')).toBe('UTF-8');
    xhr.progress(5, 10);
    act(() => xhr.respond(500));
    await waitFor(() => expect(screen.getByRole('row', { name: /b\.pdf/ })).toHaveAttribute('data-upload-state', 'Error'));
    expect(events).toEqual(['started', 'progress 5/10', 'completed 500']);
    expect(screen.getByText('Upload failed')).toHaveClass('sk-status--negative');
  });

  it('UE-93 fileTypes, mediaTypes, maxFileNameLength and maxFileSize fire their events and the file is not added', async () => {
    const ev = { onFileTypeMismatch: vi.fn(), onMediaTypeMismatch: vi.fn(), onFileNameLengthExceeded: vi.fn(), onFileSizeExceeded: vi.fn() };
    const { container } = view(<UploadSetwithTable multiple uploadUrl="/u" fileTypes={['pdf', 'PNG']} mediaTypes={['application/pdf', 'image/*']} maxFileNameLength={12} maxFileSize={0.001} {...ev} />);
    expect(container.querySelector('input[type="file"]')).toHaveAttribute('accept', '.pdf,.PNG,application/pdf,image/*');
    choose(container, file('notes.txt', 'text/plain'), file('fake.pdf', 'text/plain'), file('a-very-long-name.pdf'), file('big.pdf', 'application/pdf', 2000), file('ok.png', 'image/png'));
    await waitFor(() => expect(MockXHR.all).toHaveLength(1));
    expect(ev.onFileTypeMismatch.mock.calls[0][0].item.fileName).toBe('notes.txt');
    expect(ev.onMediaTypeMismatch.mock.calls[0][0].item.fileName).toBe('fake.pdf');
    expect(ev.onFileNameLengthExceeded.mock.calls[0][0].item.fileName).toBe('a-very-long-name.pdf');
    expect(ev.onFileSizeExceeded.mock.calls[0][0].item.fileName).toBe('big.pdf');
    expect(screen.getAllByRole('row')).toHaveLength(2);
    expect(validationFailure({ fileName: 'x.PDF', mediaType: 'application/pdf' }, { fileTypes: ['pdf'] })).toBeUndefined();
  });

  it('UE-94 file names with restricted characters are rejected with a message; fileNameValidationConfig includes, excludes or overrides characters', async () => {
    expect(restrictedCharacters()).toBe('\\:/*?"<>|[]{}@#$');
    expect(restrictedCharacters({ mode: 'include', characters: '%' })).toContain('%');
    expect(restrictedCharacters({ mode: 'exclude', characters: '#$' })).not.toMatch(/[#$]/);
    expect(restrictedCharacters({ mode: 'override', characters: '~' })).toBe('~');
    const { container, rerender } = view(<UploadSetwithTable uploadUrl="/u" />);
    choose(container, file('PO#4711.pdf'));
    expect(await screen.findByRole('alert')).toHaveTextContent('The file name "PO#4711.pdf" contains characters that are not allowed: #');
    expect(MockXHR.all).toHaveLength(0);
    rerender(<MantineProvider env="test"><UploadSetwithTable uploadUrl="/u" fileNameValidationConfig={{ mode: 'exclude', characters: '#' }} /></MantineProvider>);
    choose(container, file('PO#4711.pdf'));
    await waitFor(() => expect(MockXHR.all).toHaveLength(1));
  });

  it('UE-95 itemValidationHandler gets { oItem, iTotalItemsForUpload, oSource }; resolving uploads the returned item, rejecting skips it', async () => {
    const handler = vi.fn(async ({ oItem }: { oItem: UploadItem }) => {
      if (oItem.fileName === 'skip.pdf') throw new Error('duplicate');
      return { ...oItem, uploadUrl: `/u/${oItem.fileName}` };
    });
    const { container } = view(<UploadSetwithTable multiple uploadUrl="/u" itemValidationHandler={handler} />);
    choose(container, file('keep.pdf'), file('skip.pdf'));
    await waitFor(() => expect(MockXHR.all).toHaveLength(1));
    expect(handler.mock.calls[0][0]).toMatchObject({ iTotalItemsForUpload: 2, oItem: { fileName: 'keep.pdf' } });
    expect(handler.mock.calls[0][0].oSource).toHaveProperty('fileSelectionHandler');
    expect(MockXHR.all[0]!.url).toBe('/u/keep.pdf');
    expect(screen.queryByRole('row', { name: /skip\.pdf/ })).toBeNull();
  });

  it('UE-96 multiple=false takes one file; files dropped on the control are added; uploadEnabled=false disables upload and drop', async () => {
    const { container, rerender } = view(<UploadSetwithTable uploadUrl="/u" />);
    choose(container, file('one.pdf'), file('two.pdf'));
    await waitFor(() => expect(MockXHR.all).toHaveLength(1));
    const root = container.querySelector('.sk-upload-table')!;
    fireEvent.dragOver(root, { dataTransfer: { types: ['Files'], files: [] } });
    expect(screen.getByText('Drop files here')).toBeInTheDocument();
    fireEvent.drop(root, { dataTransfer: { types: ['Files'], files: [file('dropped.pdf')] } });
    await waitFor(() => expect(MockXHR.all).toHaveLength(2));
    expect(screen.queryByText('Drop files here')).toBeNull();
    rerender(<MantineProvider env="test"><UploadSetwithTable uploadUrl="/u" uploadEnabled={false} /></MantineProvider>);
    expect(screen.getByRole('button', { name: 'Upload' })).toBeDisabled();
    fireEvent.drop(root, { dataTransfer: { types: ['Files'], files: [file('no.pdf')] } });
    expect(MockXHR.all).toHaveLength(2);
  });

  it('UE-97 renameItem (and the row button) edits the name without its extension: Enter fires itemRenamed, Escape itemRenameCanceled', () => {
    const ref = createRef<UploadSetwithTable>();
    const onItemRenamed = vi.fn();
    const onItemRenameCanceled = vi.fn();
    view(<UploadSetwithTable ref={ref} items={existing} onItemRenamed={onItemRenamed} onItemRenameCanceled={onItemRenameCanceled} />);
    act(() => ref.current!.renameItem(existing[0]!));
    const box = screen.getByRole('textbox', { name: 'File name' });
    expect(box).toHaveValue('Quotation-4711');
    fireEvent.change(box, { target: { value: 'Quotation-final' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(onItemRenamed.mock.calls[0][0].item).toMatchObject({ id: 'a', fileName: 'Quotation-final.pdf' });
    fireEvent.click(screen.getAllByRole('button', { name: 'Rename' })[1]!);
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'File name' }), { key: 'Escape' });
    expect(onItemRenameCanceled.mock.calls[0][0].item).toMatchObject({ id: 'b' });
  });

  it('UE-98 terminateUpload aborts a running upload (uploadTerminated, row removed); download opens the URL; isRestricted checks the rules', async () => {
    const onUploadTerminated = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const ref = createRef<UploadSetwithTable>();
    const { container } = view(<UploadSetwithTable ref={ref} uploadUrl="/u" items={existing} fileTypes={['pdf', 'png']} uploader={<UploaderTableItem uploadUrl="/u" onUploadTerminated={onUploadTerminated} />} />);
    choose(container, file('big-scan.pdf'));
    await waitFor(() => expect(MockXHR.all).toHaveLength(1));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel upload' }));
    await waitFor(() => expect(onUploadTerminated).toHaveBeenCalled());
    expect(onUploadTerminated.mock.calls[0][0].item.fileName).toBe('big-scan.pdf');
    expect(screen.queryByRole('row', { name: /big-scan/ })).toBeNull();
    fireEvent.click(screen.getAllByRole('button', { name: 'Download' })[0]!);
    expect(click).toHaveBeenCalled();
    const restricted = vi.fn();
    view(<UploadSetwithTable items={[{ id: 'x', fileName: 'macro.xlsm' }]} fileTypes={['pdf']} onItemRenameCanceled={(e) => restricted(e.item.isRestricted())} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Rename' }).at(-1)!);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(restricted).toHaveBeenCalledWith(true);
    click.mockRestore();
  });

  it('UE-99 openFilePreview shows images in a dialog with carousel arrows and maxFileSizeforPreview; uploadItemViaUrl / uploadItemWithoutFile / UploaderTableItem.uploadFile; Chinese texts', async () => {
    const ref = createRef<UploadSetwithTable>();
    view(<UploadSetwithTable ref={ref} uploadUrl="/u" items={existing} previewDialog={{ maxFileSizeforPreview: 1 }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Quotation-4711.pdf' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByTitle('Quotation-4711.pdf').tagName).toBe('IFRAME');
    expect(within(dialog).getByText('1 of 2')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Next file' }));
    expect(await within(dialog).findByText('The file is too large to preview.')).toBeInTheDocument();
    fireEvent.click(within(dialog).getAllByRole('button', { name: 'Close' }).at(-1)!);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    let done!: Promise<UploadItem>;
    act(() => { done = ref.current!.uploadItemViaUrl('Contract.pdf', 'https://example.com/contract.pdf', Promise.resolve()); });
    await waitFor(() => expect(MockXHR.all).toHaveLength(1));
    act(() => MockXHR.all[0]!.respond(200));
    expect(await done).toMatchObject({ fileName: 'Contract.pdf', uploadState: 'Complete' });
    act(() => { done = ref.current!.uploadItemWithoutFile(Promise.resolve({ fileName: 'Placeholder.txt' })); });
    await waitFor(() => expect(MockXHR.all).toHaveLength(2));
    act(() => MockXHR.all[1]!.respond(200));
    expect(await done).toMatchObject({ fileName: 'Placeholder.txt', uploadState: 'Complete' });

    const sent = UploaderTableItem.uploadFile(file('x.pdf'), '/raw', [{ name: 'slug', value: 'x.pdf' }]);
    MockXHR.all[2]!.respond(204);
    expect((await sent).status).toBe(204);
    expect(MockXHR.all[2]!.headers.slug).toBe('x.pdf');

    view(<UploadSetwithTable items={existing} />, 'zh');
    expect(screen.getAllByRole('columnheader', { name: '文件名' }).length).toBe(1);
    expect(screen.getAllByText('已上传')).toHaveLength(2);
  });
});

describe('UI5 1.154 defaults, events and methods (AL-05, AL-06, AL-07)', () => {
  beforeEach(() => { MockXHR.all = []; vi.stubGlobal('XMLHttpRequest', MockXHR); });
  afterEach(() => vi.unstubAllGlobals());

  it('AL-05 FeedInput: enabled true, rows 2, maxLength 0, showIcon true, iconSize M, placeholder "Post something here", buttonTooltip "Submit"', () => {
    const { container } = view(<FeedInput />);
    const box = screen.getByRole('textbox', { name: 'Post something here' });
    expect(box).toBeEnabled();
    expect(box).toHaveAttribute('rows', '2');
    expect(box).not.toHaveAttribute('maxLength');
    expect(screen.getByRole('button', { name: 'Submit' })).toHaveAttribute('title', 'Submit');
    expect(container.querySelector('.sk-feed__avatar')).not.toBeNull();
  });

  it('AL-05 FeedListItem: type Inactive, visible true, unread / selected / navigated false, highlight None, senderActive / iconActive true, showIcon true, convertLinksToAnchorTags None', () => {
    const { container } = view(<ul><FeedListItem sender="Anna" text="see https://example.com" onSenderPress={() => {}} onIconPress={() => {}} /></ul>);
    const li = container.querySelector('li')!;
    expect(li).not.toHaveAttribute('tabindex');
    expect(li).not.toHaveClass('sk-feed-item--unread', 'sk-feed-item--selected', 'sk-feed-item--navigated');
    expect(li).not.toHaveAttribute('data-highlight');
    expect(screen.getAllByRole('button', { name: 'Anna' })).toHaveLength(2);
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('AL-05 MicroProcessFlow: renderType Wrap; MicroProcessFlowItem: state Standard (neutral dot), showSeparator true, showIntermediary false', () => {
    const { container } = view(<MicroProcessFlow><MicroProcessFlowItem key="a" title="A" /><MicroProcessFlowItem key="b" title="B" /></MicroProcessFlow>);
    expect(screen.getByRole('list')).not.toHaveClass('sk-micro-flow--nowrap');
    const a = screen.getByRole('img', { name: 'A' });
    expect(a.closest('li')).toHaveAttribute('data-state', 'Standard');
    expect(a).toHaveClass('sk-status--neutral');
    expect(a.querySelector('.sk-micro-flow__dot')).not.toBeNull();
    expect(container.querySelectorAll('.sk-micro-flow__separator')).toHaveLength(1);
    expect(container.querySelector('.sk-micro-flow__intermediary')).toBeNull();
  });

  it('AL-05 ProcessFlow: foldedCorners / showLabels false, scrollable / wheelZoomable true; ariaProperties sets label, role, labelledBy, describedBy, hasPopup', () => {
    const ref = createRef<ProcessFlow>();
    const { container, rerender } = view(<ProcessFlow ref={ref} lanes={lanes} nodes={nodes} />);
    const root = container.querySelector('.sk-process-flow') as HTMLElement;
    expect(root).not.toHaveClass('sk-process-flow--static');
    expect(node(container, 'pr1')).not.toHaveClass('sk-process-flow__node--folded');
    expect(container.querySelector('.sk-process-flow__label')).toBeNull();
    const before = ref.current!.getZoomLevel();
    fireEvent.wheel(root, { ctrlKey: true, deltaY: -1 });
    expect(ref.current!.getZoomLevel()).not.toBe(before);
    expect(root).toHaveAttribute('role', 'group');
    rerender(<MantineProvider env="test"><ProcessFlow lanes={lanes} nodes={nodes} ariaProperties={{ label: 'Document flow', role: 'region', describedBy: 'hint', hasPopup: 'dialog' }} /></MantineProvider>);
    expect(screen.getByRole('region', { name: 'Document flow' })).toHaveAttribute('aria-describedby', 'hint');
    expect(root).toHaveAttribute('aria-haspopup', 'dialog');
    rerender(<MantineProvider env="test"><ProcessFlow lanes={lanes} nodes={nodes} ariaProperties={{ labelledBy: 'title' }} /></MantineProvider>);
    expect(root).toHaveAttribute('aria-labelledby', 'title');
    expect(root).not.toHaveAttribute('aria-label');
  });

  it('AL-05 Timeline: width 100%, alignment Right, axisOrientation Vertical, growingThreshold 5, header bar with search, sort and filter; TimelineItem: useIconTooltip true, userNameClickable false', () => {
    const { container } = view(<Timeline>{items()}</Timeline>);
    const root = container.querySelector('.sk-timeline') as HTMLElement;
    expect(root.style.inlineSize).toBe('100%');
    expect(root).toHaveClass('sk-timeline--vertical', 'sk-timeline--align-right');
    expect(root).not.toHaveClass('sk-timeline--double');
    expect(titles()).toHaveLength(5);
    expect(titles()[0]).toBe('Order closed');
    expect(screen.getByRole('searchbox', { name: 'Search' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sort by date' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Filter' })).toBeInTheDocument();
    expect(container.querySelector('.sk-timeline__icon')).toHaveAttribute('title', 'Order closed');
    expect(screen.queryByRole('button', { name: 'Ben' })).toBeNull();
    expect(container.querySelector('.sk-timeline__footer')).toBeNull();
  });

  it('AL-05 TimelineItem replyList: the replies show above the reply box when the replies link or the reply link is pressed', () => {
    const onReplyListOpen = vi.fn();
    view(
      <Timeline enableSocial showHeaderBar={false}>
        <TimelineItem key="a" title="Order sent" replyCount={1} onReplyListOpen={onReplyListOpen} replyList={<ul><li>Thanks, received</li></ul>} />
      </Timeline>,
    );
    expect(screen.queryByText('Thanks, received')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '1 reply' }));
    expect(onReplyListOpen).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Thanks, received')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '1 reply' }));
    expect(screen.queryByText('Thanks, received')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Reply' }));
    expect(onReplyListOpen).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Thanks, received')).toBeInTheDocument();
  });

  it('AL-05 UploadSetwithTable: httpRequestMethod Post, multiple / directory / uploadButtonInvisible false, uploadEnabled true; UploaderTableItem: httpRequestMethod Post, useMultipart false', async () => {
    const { container, unmount } = view(<UploadSetwithTable uploadUrl="/u" />);
    const input = container.querySelector('input[type="file"]')!;
    expect(input).not.toHaveAttribute('multiple');
    expect(input).not.toHaveAttribute('webkitdirectory');
    expect(screen.getByRole('button', { name: 'Upload' })).toBeEnabled();
    choose(container, file('a.pdf'));
    await waitFor(() => expect(MockXHR.all).toHaveLength(1));
    expect(MockXHR.all[0]!.method).toBe('POST');
    unmount();
    const v = view(<UploadSetwithTable uploader={<UploaderTableItem uploadUrl="/x" />} />);
    choose(v.container, file('b.pdf'));
    await waitFor(() => expect(MockXHR.all).toHaveLength(2));
    expect([MockXHR.all[1]!.method, MockXHR.all[1]!.url]).toEqual(['POST', '/x']);
    expect(MockXHR.all[1]!.body).toBeInstanceOf(File);
  });

  it('AL-06 Timeline: select / itemFiltering / filterSelectionChange objects carry the UI5 parameter names; TimelineItem replyPost / customActionClicked / userNameClicked too', () => {
    const onSelect = vi.fn();
    const onItemFiltering = vi.fn();
    view(<Timeline growingThreshold={0} onSelect={onSelect} onItemFiltering={onItemFiltering}>{items()}</Timeline>);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search' }), { target: { value: 'closed' } });
    expect(Object.keys(onItemFiltering.mock.calls[0][0]).sort()).toEqual(['dataKeys', 'defaultPrevented', 'item', 'preventDefault', 'reasons', 'searchTerm', 'timeKeys']);
    fireEvent.click(screen.getByRole('button', { name: /Order closed/ }));
    expect(Object.keys(onSelect.mock.calls[0][0]).sort()).toEqual(['selectedItem', 'userAction']);
  });

  it('AL-06 UploadSetwithTable: onOnActivated({ oPlugin }) on mount, onOnDeactivated({ control }) on unmount; uploadCompleted gives responseXML as text', async () => {
    const onOnActivated = vi.fn();
    const onOnDeactivated = vi.fn();
    const onUploadCompleted = vi.fn();
    const { container, unmount } = view(<UploadSetwithTable uploadUrl="/u" onOnActivated={onOnActivated} onOnDeactivated={onOnDeactivated} onUploadCompleted={onUploadCompleted} />);
    expect(onOnActivated).toHaveBeenCalledTimes(1);
    expect(onOnActivated.mock.calls[0][0].oPlugin).toHaveProperty('fileSelectionHandler');
    choose(container, file('a.xml', 'application/xml'));
    await waitFor(() => expect(MockXHR.all).toHaveLength(1));
    const xhr = MockXHR.all[0]! as unknown as { responseXML: Document | null };
    xhr.responseXML = new DOMParser().parseFromString('<id>42</id>', 'application/xml');
    act(() => MockXHR.all[0]!.respond(201));
    await waitFor(() => expect(onUploadCompleted).toHaveBeenCalled());
    expect(onUploadCompleted.mock.calls[0][0].responseXML).toBe('42');
    const root = container.querySelector('.sk-upload-table');
    unmount();
    expect(onOnDeactivated).toHaveBeenCalledWith({ control: root });
  });

  it('AL-06 UploaderTableItem: uploadStarted / uploadProgressed / uploadCompleted ({ item, responseXHR }) / uploadTerminated', async () => {
    const ev = { onUploadStarted: vi.fn(), onUploadProgressed: vi.fn(), onUploadCompleted: vi.fn(), onUploadTerminated: vi.fn() };
    const { container } = view(<UploadSetwithTable multiple uploader={<UploaderTableItem uploadUrl="/u" {...ev} />} />);
    choose(container, file('a.pdf'), file('b.pdf'));
    await waitFor(() => expect(MockXHR.all).toHaveLength(2));
    expect(ev.onUploadStarted.mock.calls.map((c) => c[0].item.fileName)).toEqual(['a.pdf', 'b.pdf']);
    MockXHR.all[0]!.progress(3, 10);
    expect(ev.onUploadProgressed).toHaveBeenCalledWith(expect.objectContaining({ loaded: 3, total: 10, item: expect.objectContaining({ fileName: 'a.pdf' }) }));
    act(() => MockXHR.all[0]!.respond(200, 'ok'));
    expect(ev.onUploadCompleted.mock.calls[0][0].responseXHR).toMatchObject({ status: 200, readyState: 4, responseText: 'ok', headers: expect.stringContaining('X-Doc') });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel upload' }));
    await waitFor(() => expect(ev.onUploadTerminated).toHaveBeenCalledWith({ item: expect.objectContaining({ fileName: 'b.pdf' }) }));
  });

  it('AL-07 UploaderTableItem ref: uploadItem, terminateItem, download; UploadSetwithTable.registerUploaderEvents follows a standalone uploader', async () => {
    const ref = createRef<UploaderTableItem>();
    const table = createRef<UploadSetwithTable>();
    const completed = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    view(<><UploaderTableItem ref={ref} uploadUrl="/own" downloadUrl="/dl" onUploadCompleted={completed} /><UploadSetwithTable ref={table} onUploadCompleted={completed} /></>);
    const item = { id: 'x', fileName: 'x.pdf', file: file('x.pdf'), download: () => {}, isRestricted: () => false, terminateUpload: () => {} };
    act(() => ref.current!.uploadItem(item, [{ name: 'slug', value: 'x' }]));
    expect([MockXHR.all[0]!.url, MockXHR.all[0]!.headers.slug]).toEqual(['/own', 'x']);
    act(() => MockXHR.all[0]!.respond(200));
    expect(completed).toHaveBeenCalledTimes(1);
    act(() => table.current!.registerUploaderEvents(ref.current!));
    act(() => ref.current!.uploadItem({ ...item, id: 'y' }));
    act(() => MockXHR.all[1]!.respond(200));
    // the table follows the uploader; it fires uploadCompleted only for its own rows
    expect(completed).toHaveBeenCalledTimes(2);
    const terminated = vi.fn();
    view(<UploaderTableItem ref={ref} uploadUrl="/own" onUploadTerminated={terminated} />);
    act(() => ref.current!.uploadItem({ ...item, id: 'z' }));
    act(() => ref.current!.terminateItem({ ...item, id: 'z' }));
    expect(terminated).toHaveBeenCalledWith({ item: expect.objectContaining({ id: 'z' }) });
    expect(ref.current!.download({ fileName: 'n.pdf' })).toBe(false);
    expect(ref.current!.download({ fileName: 'x.pdf', url: '/files/x.pdf' })).toBe(true);
    expect(click).toHaveBeenCalled();
    click.mockRestore();
  });

  it('AL-07 UploadSetwithTable statics: findOn, getFileSizeWithUnits, getIconForFileType', () => {
    expect(UploadSetwithTable.getFileSizeWithUnits(254_000)).toBe('248.05 KB');
    expect(UploadSetwithTable.getFileSizeWithUnits(2_400_000)).toBe('2.29 MB');
    expect(UploadSetwithTable.getFileSizeWithUnits(2 * 1024 ** 3)).toBe('2.00 GB');
    const { container: icons } = render(<>{UploadSetwithTable.getIconForFileType('image/png', 'a.png')}{UploadSetwithTable.getIconForFileType('', 'b.xlsx')}</>);
    expect(icons.querySelectorAll('svg')).toHaveLength(2);
    const { container } = view(<div data-testid="host"><UploadSetwithTable /></div>);
    const plugin = UploadSetwithTable.findOn(screen.getByTestId('host'));
    expect(plugin).toHaveProperty('fileSelectionHandler');
    expect(UploadSetwithTable.findOn(container.querySelector('.sk-upload-table__toolbar'))).toBe(plugin);
    expect(UploadSetwithTable.findOn(document.createElement('div'))).toBeUndefined();
  });
});
