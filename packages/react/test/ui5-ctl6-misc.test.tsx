/** Stage 6 (ctl6 misc): the remaining ref methods and properties of plain controls follow SAPUI5 1.154 (docs/31 stage 6). */
import { MantineProvider } from '@mantine/core';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { createRef, type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import Card from '@rhfan2019/smart-kit/f/Card';
import DynamicDateRange from '@rhfan2019/smart-kit/m/DynamicDateRange';
import ExpandableText from '@rhfan2019/smart-kit/m/ExpandableText';
import FeedListItem from '@rhfan2019/smart-kit/m/FeedListItem';
import OverflowToolbar from '@rhfan2019/smart-kit/m/OverflowToolbar';
import OverflowToolbarButton from '@rhfan2019/smart-kit/m/OverflowToolbarButton';
import ToggleButton from '@rhfan2019/smart-kit/m/ToggleButton';
import ViewSettingsDialog from '@rhfan2019/smart-kit/m/ViewSettingsDialog';
import UploadSetwithTable from '@rhfan2019/smart-kit/m/plugins/UploadSetwithTable';
import ProcessFlow, { type ProcessFlowConnectionLabel } from '@rhfan2019/smart-kit/suite/ui/commons/ProcessFlow';
import Timeline from '@rhfan2019/smart-kit/suite/ui/commons/Timeline';
import TimelineItem from '@rhfan2019/smart-kit/suite/ui/commons/TimelineItem';
import Currency from '@rhfan2019/smart-kit/ui/unified/Currency';
import { badgeValueText } from '../src/controls/display/buttonBadge';
import { isSafeUrl, parseHtml, plainText, styleObject } from '../src/controls/process/formattedText';

function view(ui: ReactNode) {
  return render(<MantineProvider env="test">{ui}</MantineProvider>);
}

describe('AL-07 sap.m.Button badge (ToggleButton, OverflowToolbarButton)', () => {
  it('AL-07 ToggleButton: setBadgeMinValue / setBadgeMaxValue limit the badge as Button.badgeValueFormatter', () => {
    expect(badgeValueText(undefined)).toBeNull();
    expect(badgeValueText(0)).toBeNull();
    expect(badgeValueText(5)).toBe('5');
    expect(badgeValueText(12000)).toBe('999+');
    expect(badgeValueText(120, 1, 99)).toBe('99+');
    expect(badgeValueText('abc')).toBe('');
    const ref = createRef<ToggleButton>();
    view(<ToggleButton ref={ref} text="Inbox" badge={120} />);
    const badge = () => screen.getByRole('button', { name: /Inbox/ }).querySelector('[data-sk-badge]');
    expect(badge()).toHaveTextContent('120');
    act(() => { ref.current!.setBadgeMaxValue(99).setBadgeMinValue(5); });
    expect(badge()).toHaveTextContent('99+');
    // invalid limits are ignored (min above max, max above 9999)
    act(() => { ref.current!.setBadgeMinValue(500); ref.current!.setBadgeMaxValue(20000); });
    expect(badge()).toHaveTextContent('99+');
    act(() => { ref.current!.setBadgeMinValue(99); ref.current!.setBadgeMaxValue(200); });
    expect(badge()).toHaveTextContent('120');
    act(() => { ref.current!.setBadgeMinValue(150); });
    expect(badge()).toBeNull();
  });

  it('AL-07 OverflowToolbarButton: a badge below the minimum (default 1) is hidden; setBadgeMaxValue caps it', () => {
    const ref = createRef<OverflowToolbarButton>();
    view(
      <OverflowToolbar>
        <OverflowToolbarButton ref={ref} text="Alerts" badge={42} />
        <OverflowToolbarButton text="None" badge={0} />
      </OverflowToolbar>,
    );
    expect(screen.getByRole('button', { name: 'None' }).querySelector('[data-sk-badge]')).toBeNull();
    const alerts = () => screen.getByRole('button', { name: /Alerts/ }).querySelector('[data-sk-badge]');
    expect(alerts()).toHaveTextContent('42');
    act(() => { ref.current!.setBadgeMaxValue(9); });
    expect(alerts()).toHaveTextContent('9+');
  });
});

describe('AL-07 small methods', () => {
  it('AL-07 ExpandableText: hasLabelableHTMLElement() is false', () => {
    const ref = createRef<ExpandableText>();
    view(<ExpandableText ref={ref} text="Some text" />);
    expect(ref.current!.hasLabelableHTMLElement()).toBe(false);
  });

  it('AL-07 Card: getGridItemRole() is null outside a grid container', () => {
    const ref = createRef<Card>();
    view(<Card ref={ref}>content</Card>);
    expect(ref.current!.getGridItemRole()).toBeNull();
  });

  it('AL-07 Currency: getFormattedValue() is the padded amount, "" for the currency *; getCurrencySymbol() the symbol', () => {
    const ref = createRef<Currency>();
    const { rerender } = view(<Currency ref={ref} value={1234.5} currency="EUR" maxPrecision={3} useSymbol={false} />);
    expect(ref.current!.getFormattedValue()).toBe('1,234.50 ');
    expect(ref.current!.getCurrencySymbol()).toBe('€');
    rerender(<MantineProvider env="test"><Currency ref={ref} value={10} currency="*" /></MantineProvider>);
    expect(ref.current!.getFormattedValue()).toBe('');
  });

  it('AL-07 UploadSetwithTable: getDefaultFileUploader() is the file input with the control settings', () => {
    const ref = createRef<UploadSetwithTable>();
    view(<UploadSetwithTable ref={ref} multiple fileTypes={['pdf']} />);
    const input = ref.current!.getDefaultFileUploader();
    expect(input).toBeInstanceOf(HTMLInputElement);
    expect(input).toHaveAttribute('type', 'file');
    expect(input!.multiple).toBe(true);
    expect(input).toHaveAttribute('accept', '.pdf');
  });
});

describe('AL-07 ProcessFlow', () => {
  it('AL-07 ProcessFlow: getNode / getLane return the data objects; setFocusToLabel focuses a shown label', () => {
    const ref = createRef<ProcessFlow>();
    const label: ProcessFlowConnectionLabel = { text: '2', priority: 1 };
    const lanes = [{ laneId: 'a', text: 'A', position: 0 }, { laneId: 'b', text: 'B', position: 1 }];
    const nodes = [
      { nodeId: 1, laneId: 'a', title: 'One', children: [{ nodeId: 2, connectionLabel: label }] },
      { nodeId: 2, laneId: 'b', title: 'Two' },
    ];
    view(<ProcessFlow ref={ref} lanes={lanes} nodes={nodes} showLabels />);
    expect(ref.current!.getNode(2)).toBe(nodes[1]);
    expect(ref.current!.getNode('1')).toBe(nodes[0]);
    expect(ref.current!.getNode(9)).toBeUndefined();
    expect(ref.current!.getLane('b')).toBe(lanes[1]);
    expect(ref.current!.getLane('x')).toBeUndefined();
    act(() => ref.current!.setFocusToLabel(label));
    expect(screen.getByRole('button', { name: '2' })).toHaveFocus();
  });
});

describe('AL-07 Timeline', () => {
  const items = (
    [
      <TimelineItem key="a" title="Created" dateTime="2026-01-10T10:00:00Z" filterValue="Open" />,
      <TimelineItem key="b" title="Approved" dateTime="2026-02-12T10:00:00Z" filterValue="Done" />,
      <TimelineItem key="c" title="Shipped" dateTime="2026-03-15T10:00:00Z" filterValue="Done" />,
    ]
  );
  const titles = (container: HTMLElement) => [...container.querySelectorAll('.sk-timeline__title')].map((x) => x.textContent);

  it('AL-07 Timeline: setCurrentFilter / getCurrentFilter, setCurrentSearch, setCurrentTimeFilter; the filter info bar and its clear icon', () => {
    const ref = createRef<Timeline>();
    const { container } = view(<Timeline ref={ref} sortOldestFirst>{items}</Timeline>);
    act(() => ref.current!.setCurrentFilter(['Done', 'Unknown']));
    expect(ref.current!.getCurrentFilter()).toEqual([{ key: 'Done', text: 'Done' }]);
    expect(titles(container)).toEqual(['Approved', 'Shipped']);
    const info = () => container.querySelector('[data-sk-timeline-filter-info]');
    expect(info()).toHaveTextContent('Filtered By: Items (Done)');
    act(() => ref.current!.setCustomFilterMessage('my filter'));
    expect(info()).toHaveTextContent('Filtered By: Items (Done), my filter');
    act(() => ref.current!.setModelFilterMessage('Data', 'Status done'));
    expect(info()).toHaveTextContent('Filtered By: Status done, my filter');
    act(() => ref.current!.setCurrentSearch('ship'));
    expect(titles(container)).toEqual(['Shipped']);
    act(() => ref.current!.setCurrentSearch(''));
    act(() => ref.current!.setCurrentTimeFilter({ from: new Date(2026, 2, 1), to: new Date(2026, 11, 31), type: 'Month' }));
    expect(titles(container)).toEqual(['Shipped']);
    expect(info()).toHaveTextContent(/Time Range \(March 2026 - December 2026\)/);
    fireEvent.click(within(info() as HTMLElement).getByRole('button', { name: 'Clear' }));
    expect(info()).toBeNull();
    expect(ref.current!.getCurrentFilter()).toEqual([]);
    expect(titles(container)).toEqual(['Created', 'Approved', 'Shipped']);
  });

  it('AL-07 Timeline: setModelFilter replaces a default filter (refresh false waits); setCustomModelFilter adds one; info bar clear removes it', () => {
    const ref = createRef<Timeline>();
    const { container } = view(<Timeline ref={ref} sortOldestFirst>{items}</Timeline>);
    act(() => ref.current!.setModelFilter({ type: 'Data', filter: (i) => i.title !== 'Created', refresh: false }));
    expect(titles(container)).toEqual(['Created', 'Approved', 'Shipped']);
    act(() => ref.current!.setModelFilter({ type: 'Search', filter: (i) => i.title !== 'Shipped' }));
    expect(titles(container)).toEqual(['Approved']);
    act(() => ref.current!.setModelFilter({ type: 'Search', filter: null }));
    act(() => ref.current!.setModelFilter({ type: 'Data', filter: null }));
    expect(titles(container)).toEqual(['Created', 'Approved', 'Shipped']);
    act(() => ref.current!.setCustomModelFilter('noApproved', (i) => i.title !== 'Approved'));
    expect(titles(container)).toEqual(['Created', 'Shipped']);
    act(() => ref.current!.setCustomFilterMessage('custom'));
    fireEvent.click(within(container.querySelector('[data-sk-timeline-filter-info]') as HTMLElement).getByRole('button', { name: 'Clear' }));
    expect(titles(container)).toEqual(['Created', 'Approved', 'Shipped']);
  });

  it('AL-07 Timeline: setCustomGrouping groups by a function; getGroups returns the shown groups', () => {
    const ref = createRef<Timeline>();
    const { container } = view(<Timeline ref={ref} sortOldestFirst>{items}</Timeline>);
    expect(ref.current!.getGroups()).toEqual([]);
    act(() => ref.current!.setCustomGrouping((d) => (d.getUTCMonth() < 2 ? { key: 'early', title: 'Early', date: d } : { key: 'late', title: 'Late', date: d })));
    expect([...container.querySelectorAll('.sk-timeline__group-header')].map((x) => x.textContent)).toEqual(['Early', 'Late']);
    expect(ref.current!.getGroups().map((g) => [g.key, g.title])).toEqual([['early', 'Early'], ['late', 'Late']]);
    act(() => ref.current!.setCustomGrouping(null));
    expect(container.querySelector('.sk-timeline__group-header')).toBeNull();
  });
});

describe('AL-07 ViewSettingsDialog', () => {
  const props = {
    filterItems: [
      { key: 'status', text: 'Status', items: [{ key: 'NEW', text: 'New' }, { key: 'APPR', text: 'Approved' }] },
      { key: 'region', text: 'Region', multiSelect: false, items: [{ key: 'N', text: 'North' }, { key: 'S', text: 'South' }] },
    ],
    presetFilterItems: [{ key: 'mine', text: 'Mine', selected: true }],
  };

  it('AL-07 ViewSettingsDialog: setSelectedFilterCompoundKeys / getSelectedFilterCompoundKeys / getSelectedFilterItems / getSelectedFilterString', () => {
    const ref = createRef<ViewSettingsDialog>();
    view(<ViewSettingsDialog ref={ref} {...props} />);
    expect(ref.current!.getSelectedFilterString()).toBe('Filtered by: Mine');
    expect(ref.current!.getSelectedFilterItems()).toEqual([]);
    let back: ViewSettingsDialog | undefined;
    act(() => { back = ref.current!.setSelectedFilterCompoundKeys({ status: { NEW: true, APPR: true }, region: { N: true, S: true } }); });
    // returns the instance (stable across renders), as UI5's `this`
    expect(back).toBe(ref.current);
    // a single-select filter keeps only the first value; the preset filter is cleared
    expect(ref.current!.getSelectedFilterCompoundKeys()).toEqual({ status: { NEW: true, APPR: true }, region: { N: true } });
    expect(ref.current!.getSelectedFilterItems().map((i) => i.key)).toEqual(['NEW', 'APPR', 'N']);
    expect(ref.current!.getSelectedFilterString()).toBe('Filtered by: Status (New, Approved), Region (North)');
    act(() => { ref.current!.setSelectedFilterCompoundKeys({ status: { APPR: true } }); });
    expect(ref.current!.getSelectedFilterCompoundKeys()).toEqual({ status: { APPR: true }, region: { N: true } });
  });

  it('AL-07 ViewSettingsDialog: setFilterSearchCallback(query, value) replaces filterSearchOperator', async () => {
    const ref = createRef<ViewSettingsDialog>();
    view(<ViewSettingsDialog ref={ref} {...props} />);
    act(() => { ref.current!.setFilterSearchCallback((q, v) => v.toLowerCase().endsWith(q.toLowerCase())); });
    act(() => ref.current!.open('filter'));
    fireEvent.click(await screen.findByRole('button', { name: /Status/ }));
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'ved' } });
    const group = screen.getByRole('group', { name: 'Status' });
    expect(within(group).queryByLabelText('New')).toBeNull();
    expect(within(group).getByLabelText('Approved')).toBeInTheDocument();
  });
});

describe('AL-07 DynamicDateRange', () => {
  it('AL-07 DynamicDateRange: addStandardOption, getOption, addGroup / setGroupHeader / getGroupHeader / removeCustomGroups', async () => {
    const ref = createRef<DynamicDateRange>();
    const fiscal = { key: 'FISCAL', getText: () => 'Fiscal year', getGroup: () => 'Fiscal', toDates: () => [new Date(2026, 3, 1), new Date(2027, 2, 31)] };
    view(<DynamicDateRange ref={ref} aria-label="d" standardOptions={['TODAY']} customOptions={[fiscal]} />);
    expect(ref.current!.getOption('FISCAL')).toBe(fiscal);
    expect(ref.current!.getOption('YESTERDAY')).toBeUndefined();
    act(() => ref.current!.addStandardOption('YESTERDAY'));
    const yesterday = ref.current!.getOption('YESTERDAY')!;
    expect(yesterday.getText!()).toBe('Yesterday');
    expect(yesterday.getGroup!()).toBe(1);
    expect(yesterday.getGroupHeader!()).toBe('Single Dates');
    expect(ref.current!.getGroupHeader('DateRanges')).toBe('Date Ranges');
    act(() => ref.current!.addGroup('Fiscal', 'Fiscal periods'));
    expect(ref.current!.getGroupHeader('Fiscal')).toBe('Fiscal periods');
    act(() => ref.current!.setGroupHeader('Fiscal', 'Company periods'));
    act(() => ref.current!.open());
    const list = await screen.findByRole('listbox');
    expect(within(list).getByRole('option', { name: 'Yesterday' })).toBeInTheDocument();
    expect(within(within(list).getByRole('group', { name: 'Company periods' })).getByRole('option', { name: 'Fiscal year' })).toBeInTheDocument();
    act(() => ref.current!.removeCustomGroups());
    expect(ref.current!.getGroupHeader('Fiscal')).toBeUndefined();
    expect(within(screen.getByRole('listbox')).getByRole('group', { name: 'Other Options' })).toBeInTheDocument();
  });
});

describe('FeedListItem text as sap.m.FormattedText', () => {
  it('AL-05 FeedListItem: disableStyleAttribute false keeps inline styles; true drops them; unsupported tags go with their content', () => {
    const html = '<strong>Bold</strong> <span style="color: red">red</span><script>alert(1)</script><em>x</em><iframe>evil</iframe><blink>gone</blink> <a href="javascript:alert(1)">bad link</a> <a href="https://e.org">ok</a>';
    const { container, rerender } = view(<ul><FeedListItem sender="A" text={html} /></ul>);
    const text = container.querySelector('.sk-feed-item__text')!;
    expect(text.querySelector('strong')).toHaveTextContent('Bold');
    expect(text.querySelector('span[style*="color"]')).toHaveTextContent('red');
    expect(text.textContent).not.toContain('alert');
    expect(text.textContent).not.toContain('evil');
    expect(text.textContent).not.toContain('gone');
    expect(text.querySelector('em')).toHaveTextContent('x');
    expect(screen.getByRole('link', { name: 'ok' })).toHaveAttribute('target', '_blank');
    // an unsafe href becomes "#" (FormattedText with URLListValidator)
    expect(screen.getByText('bad link')).toHaveAttribute('href', '#');
    rerender(<MantineProvider env="test"><ul><FeedListItem sender="A" text={html} disableStyleAttribute /></ul></MantineProvider>);
    expect(container.querySelector('.sk-feed-item__text span[style*="color"]')).toBeNull();
  });

  it('AL-05 FeedListItem: the HTML helpers parse, sanitize and count plain text', () => {
    expect(plainText(parseHtml('a &amp; <b>b</b><strong>c</strong><br>d'))).toBe('a & c\nd');
    expect(isSafeUrl('https://x')).toBe(true);
    expect(isSafeUrl('/rel')).toBe(true);
    expect(isSafeUrl('javascript:alert(1)')).toBe(false);
    expect(styleObject('color: red; background: url(x); font-weight: bold !important')).toEqual({ color: 'red', fontWeight: 'bold' });
  });
});
