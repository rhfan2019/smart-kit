/** Message controls with SAPUI5 names (docs/26 §3.1, ADR-032): MessageToast, MessageBox, MessageStrip, MessageView, MessagePopover. */
import { MantineProvider } from '@mantine/core';
import { createMessage } from '@rhfan2019/smart-kit-core';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useRef, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SmartKitProvider, smartKitMantineTheme } from '../src';
import MessageBox from '@rhfan2019/smart-kit/m/MessageBox';
import MessageButton from '@rhfan2019/smart-kit/v4/fe/macros/MessageButton';
import MessageHost from '@rhfan2019/smart-kit/kit/MessageHost';
import MessageItem from '@rhfan2019/smart-kit/m/MessageItem';
import MessagePopover, { type MessagePopover$BeforeOpenEvent, type MessagePopover$ItemSelectEvent } from '@rhfan2019/smart-kit/m/MessagePopover';
import MessageProvider from '@rhfan2019/smart-kit/kit/MessageProvider';
import MessageStrip from '@rhfan2019/smart-kit/m/MessageStrip';
import MessageToast from '@rhfan2019/smart-kit/m/MessageToast';
import MessageView, {
  type MessageView$ActiveTitlePressEvent, type MessageView$ItemSelectEvent, type MessageView$ListSelectEvent, type MessageViewAsyncDescriptionConfig,
} from '@rhfan2019/smart-kit/m/MessageView';
import useMessages from '@rhfan2019/smart-kit/kit/useMessages';
import { messageStore } from '../src/messages/messageStore';

const wrap = (children: ReactNode, locale?: 'en' | 'zh') => (
  <MantineProvider theme={smartKitMantineTheme} env="test">
    {locale ? <SmartKitProvider services={{}} locale={locale} namespace={`m${Math.random()}`}>{children}</SmartKitProvider> : <>{children}<MessageHost /></>}
  </MantineProvider>
);
const view = (children: ReactNode, locale?: 'en' | 'zh') => render(wrap(children, locale));

afterEach(() => { act(() => messageStore.reset()); vi.useRealTimers(); });

describe('MessageToast (sap.m.MessageToast.show)', () => {
  it('UE-01 shows the message as a status and closes after duration + animationDuration, then calls onClose', () => {
    vi.useFakeTimers();
    view(<span />);
    const onClose = vi.fn();
    act(() => MessageToast.show('Saved', { onClose }));
    expect(screen.getByRole('status')).toHaveTextContent('Saved');
    act(() => { vi.advanceTimersByTime(3000); });
    expect(screen.getByRole('status')).toHaveClass('sk-message-toast--fading');
    act(() => { vi.advanceTimersByTime(1000); });
    expect(screen.queryByRole('status')).toBeNull();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('UE-02 autoClose closes on the next press; width, animation and the default bottom margin are applied', () => {
    view(<span />);
    act(() => MessageToast.show('A', { width: '20em', animationTimingFunction: 'linear', animationDuration: 200 }));
    const toast = screen.getByRole('status');
    expect(toast.style.width).toBe('20em');
    expect(toast.style.transitionTimingFunction).toBe('linear');
    expect(toast).toHaveClass('sk-message-toast--default');
    act(() => { fireEvent.pointerDown(document.body); });
    expect(screen.queryByRole('status')).toBeNull();
    act(() => MessageToast.show('B', { autoClose: false, at: 'CenterTop', my: 'CenterTop' }));
    act(() => { fireEvent.pointerDown(document.body); });
    expect(screen.getByRole('status')).not.toHaveClass('sk-message-toast--default');
  });
});

describe('MessageBox (sap.m.MessageBox, defaults from the 1.154 source)', () => {
  const buttons = () => screen.getAllByRole('button').filter((b) => b.hasAttribute('data-sk-message-box-action'));
  const emphasized = () => buttons().filter((b) => b.getAttribute('data-variant') === 'filled').map((b) => b.getAttribute('data-sk-message-box-action'));

  it('UE-03 confirm: title "Confirmation", OK + Cancel, OK emphasized; resolves and calls onClose with the action', async () => {
    view(<span />);
    const onClose = vi.fn();
    let result: Promise<unknown>;
    act(() => { result = MessageBox.confirm('Delete the order?', { onClose }); });
    expect(await screen.findByText('Confirmation')).toBeInTheDocument();
    expect(buttons().map((b) => b.textContent)).toEqual(['OK', 'Cancel']);
    expect(emphasized()).toEqual(['OK']);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await expect(result!).resolves.toBe('CANCEL');
    expect(onClose).toHaveBeenCalledWith('CANCEL');
  });

  it('UE-04 shortcuts emphasize OK only without actions; show() emphasizes a single (non-array) action unless emphasizedAction is null', async () => {
    view(<span />);
    act(() => { void MessageBox.confirm('x', { actions: [MessageBox.Action.YES, MessageBox.Action.NO] }); });
    await screen.findByText('Yes');
    expect(emphasized()).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'No' }));
    await waitFor(() => expect(screen.queryByText('Yes')).toBeNull());
    act(() => { void MessageBox.warning('x', { actions: MessageBox.Action.DELETE }); });
    await screen.findByText('Delete');
    expect(emphasized()).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.queryByText('Delete')).toBeNull());
    act(() => { void MessageBox.show('x', { actions: MessageBox.Action.DELETE }); });
    await screen.findByText('Delete');
    expect(emphasized()).toEqual(['DELETE']);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.queryByText('Delete')).toBeNull());
    act(() => { void MessageBox.show('x', { actions: 'Custom', emphasizedAction: null }); });
    await screen.findByText('Custom');
    expect(emphasized()).toEqual([]);
  });

  it('UE-05 error: title "Error", only Close, nothing emphasized; Escape closes with null', async () => {
    view(<span />);
    let result: Promise<unknown>;
    act(() => { result = MessageBox.error('Failed'); });
    expect(await screen.findByText('Error')).toBeInTheDocument();
    expect(buttons().map((b) => b.getAttribute('data-sk-message-box-action'))).toEqual(['CLOSE']);
    expect(emphasized()).toEqual([]);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    await expect(result!).resolves.toBeNull();
  });

  it('UE-06 show with details: information icon, OK + Cancel; "View Details" shows the text; a function is loaded lazily', async () => {
    view(<span />);
    act(() => { void MessageBox.show('Problem', { details: { code: 42 } }); });
    await screen.findByText('Problem');
    expect(document.querySelector('[data-sk-message-box="INFORMATION"]')).not.toBeNull();
    expect(buttons().map((b) => b.textContent)).toEqual(['OK', 'Cancel']);
    fireEvent.click(screen.getByText('View Details'));
    expect(document.querySelector('[data-sk-message-box-details]')).toHaveTextContent('"code": 42');
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    const details = vi.fn(() => Promise.resolve('loaded later'));
    act(() => { void MessageBox.error('E2', { details }); });
    await screen.findByText('E2');
    expect(details).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('View Details'));
    expect(await screen.findByText('loaded later')).toBeInTheDocument();
  });

  it('UE-07 initialFocus takes an action or a button text; titles and buttons follow the provider locale', async () => {
    view(<span />, 'zh');
    act(() => { void MessageBox.confirm('删除？', { initialFocus: MessageBox.Action.CANCEL }); });
    expect(await screen.findByText('确认')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '取消' })).toHaveAttribute('data-autofocus');
    expect(screen.getByRole('button', { name: '确定' })).not.toHaveAttribute('data-autofocus');
  });

  it('UE-08 only the first mounted MessageHost renders (nested providers do not duplicate)', async () => {
    view(<SmartKitProvider services={{}} locale="en" namespace="inner"><span /></SmartKitProvider>, 'en');
    act(() => MessageToast.show('Once'));
    expect(screen.getAllByText('Once')).toHaveLength(1);
  });
});

describe('MessageStrip (sap.m.MessageStrip)', () => {
  it('UE-09 type and icon; None is shown as Information; the close button and close() fire onClose', () => {
    const onClose = vi.fn();
    const ref = { current: null as MessageStrip | null };
    const { rerender } = view(<MessageStrip text="Draft saved" type="Success" showIcon showCloseButton onClose={onClose} />);
    const strip = screen.getByRole('note', { name: 'Success' });
    expect(strip).toHaveClass('sk-message-strip--positive');
    expect(strip.querySelector('.sk-message-strip__icon svg')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('note')).toBeNull();
    rerender(wrap(<MessageStrip key="2" ref={(r) => { ref.current = r; }} text="Note" type="None" onClose={onClose} />));
    expect(screen.getByRole('note', { name: 'Information' })).toHaveClass('sk-message-strip--info');
    expect(screen.getByRole('note').querySelector('.sk-message-strip__icon')).toBeNull();
    act(() => ref.current!.close());
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('UE-10 colorSet ColorSet1 / ColorSet2 with colorScheme 1–10; link and controls follow the text', () => {
    view(<><MessageStrip text="A" colorSet="ColorSet1" colorScheme={4} /><MessageStrip text="B" colorSet="ColorSet2" colorScheme={12} link={<a href="#x">More</a>} controls={[<a key="1" href="#y">Y</a>]} /></>);
    const [a, b] = screen.getAllByRole('note');
    expect(a).toHaveClass('sk-message-strip--set1', 'sk-message-strip--scheme4');
    expect(b).toHaveClass('sk-message-strip--set2', 'sk-message-strip--scheme10');
    expect(within(b!).getByRole('link', { name: 'More' })).toBeInTheDocument();
    expect(within(b!).getByRole('link', { name: 'Y' })).toBeInTheDocument();
  });
});

describe('MessageView / MessageItem (sap.m.MessageView)', () => {
  const items = (
    <>
      <MessageItem key="1" type="Error" title="Net price missing" subtitle="Item 10" description="Enter a net price." groupName="Items" />
      <MessageItem key="2" type="Error" title="Supplier blocked" groupName="Header" counter={2} />
      <MessageItem key="3" type="Warning" title="Delivery date in the past" groupName="Items" />
      <MessageItem key="4" type="Information" title="Prices recalculated" />
    </>
  );

  it('UE-11 the filter shows All and one button per type with its count (Error, Warning, Success, Information order); listSelect fires', () => {
    const onListSelect = vi.fn();
    view(<MessageView onListSelect={onListSelect}>{items}</MessageView>);
    const filter = screen.getByRole('group', { name: 'Filter by type' });
    expect(within(filter).getAllByRole('button').map((b) => b.getAttribute('data-sk-message-filter'))).toEqual(['All', 'Error', 'Warning', 'Information']);
    expect(within(filter).getByRole('button', { name: 'Error' })).toHaveTextContent('2');
    fireEvent.click(within(filter).getByRole('button', { name: 'Warning' }));
    expect(onListSelect).toHaveBeenCalledWith({ messageTypeFilter: 'Warning' });
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByText('Delivery date in the past')).toBeInTheDocument();
  });

  it('UE-12 an item with a description opens the details page (itemSelect); navigateBack() and the back button return', () => {
    const onItemSelect = vi.fn();
    const ref = { current: null as MessageView | null };
    view(<MessageView ref={(r) => { ref.current = r; }} onItemSelect={onItemSelect}>{items}</MessageView>);
    expect(screen.getByText('Supplier blocked').closest('[role="button"]')).toBeNull();
    fireEvent.click(screen.getByText('Net price missing'));
    expect(onItemSelect).toHaveBeenCalledWith(expect.objectContaining({ item: expect.objectContaining({ key: '1', title: 'Net price missing' }), messageTypeFilter: 'All' }));
    expect(screen.getByText('Enter a net price.')).toBeInTheDocument();
    act(() => ref.current!.navigateBack());
    expect(screen.getByText('Supplier blocked')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Net price missing'));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(4);
  });

  it('UE-13 groupItems shows group headers (items without a group first); a single message shows its details directly', () => {
    const { rerender } = view(<MessageView groupItems>{items}</MessageView>);
    expect([...document.querySelectorAll('.sk-message-view__group')].map((g) => g.textContent)).toEqual(['Items', 'Header']);
    rerender(wrap(<MessageView><MessageItem type="Warning" title="Only one" description="Details." /></MessageView>));
    expect(screen.getByText('Details.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
  });

  it('UE-14 activeTitle renders the title as a link that fires activeTitlePress; core messages become items (target = subtitle, active)', () => {
    const onActiveTitlePress = vi.fn();
    const m = [createMessage('error', 'Purchasing group is required', { target: 'PurchasingGroup' }), createMessage('warning', 'Check the date')];
    view(<MessageView items={m} onActiveTitlePress={onActiveTitlePress} />);
    fireEvent.click(within(document.querySelector('[data-sk-message-target="PurchasingGroup"]') as HTMLElement).getByRole('button', { name: 'Purchasing group is required' }));
    expect(onActiveTitlePress).toHaveBeenCalledWith({ item: expect.objectContaining({ subtitle: 'PurchasingGroup', message: m[0] }) });
    expect(screen.getByText('Check the date').closest('button')).toBeNull();
  });

  it('UE-15 longtextUrl is loaded on the details page and fires longtextLoaded', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('The long text.'));
    const onLongtextLoaded = vi.fn();
    view(<MessageView onLongtextLoaded={onLongtextLoaded}><MessageItem type="Error" title="Long" longtextUrl="/texts/1" /></MessageView>);
    expect(await screen.findByText('The long text.')).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith('/texts/1');
    expect(onLongtextLoaded).toHaveBeenCalled();
    fetch.mockRestore();
  });
});

describe('Message controls: UI5 1.154 defaults, async description, event types (AL-05, AL-06)', () => {
  it('AL-05 MessageStrip: type defaults to Information, showIcon / showCloseButton to false, colorSet to Default', () => {
    view(<MessageStrip text="Plain" />);
    const strip = screen.getByRole('note', { name: 'Information' });
    expect(strip).toHaveClass('sk-message-strip--info');
    expect(strip.className).not.toMatch(/--set/);
    expect(strip.querySelector('.sk-message-strip__icon')).toBeNull();
    expect(within(strip).queryByRole('button')).toBeNull();
  });

  it('AL-05 MessageItem: type defaults to Error, activeTitle to false; MessageView: groupItems false, showDetailsPageHeader true', () => {
    const onActiveTitlePress = vi.fn();
    const { rerender } = view(
      <MessageView onActiveTitlePress={onActiveTitlePress}>
        <MessageItem key="a" title="No type" description="D" groupName="G" />
        <MessageItem key="b" type="Warning" title="W" />
      </MessageView>,
    );
    expect(document.querySelector('[data-sk-message="Error"]')).toHaveTextContent('No type');
    expect(screen.getByText('No type').closest('button')).toBeNull();
    expect(document.querySelector('.sk-message-view__group')).toBeNull();
    fireEvent.click(screen.getByText('No type'));
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
    rerender(wrap(
      <MessageView showDetailsPageHeader={false}>
        <MessageItem key="a" title="No type" description="D" />
        <MessageItem key="b" type="Warning" title="W" />
      </MessageView>,
    ));
    fireEvent.click(screen.getByText('No type'));
    expect(screen.getByText('D')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
  });

  it('AL-05 MessagePopover: placement defaults to Vertical, initiallyExpanded to true, groupItems to false', async () => {
    function P() {
      const ref = useRef<MessagePopover>(null);
      return (
        <>
          <button type="button" onClick={(e) => ref.current!.openBy(e.currentTarget)}>Open</button>
          <MessagePopover ref={ref}><MessageItem key="a" type="Error" title="E1" groupName="G" /><MessageItem key="b" type="Warning" title="W1" /></MessagePopover>
        </>
      );
    }
    view(<P />);
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('E1')).toBeInTheDocument();
    expect(dialog.querySelector('.sk-message-view__group')).toBeNull();
  });

  it('AL-06 asyncDescriptionHandler gets { item, promise }: the description set on item is shown after resolve; reject keeps the own description', async () => {
    const onLongtextLoaded = vi.fn();
    const handler = vi.fn((c: MessageViewAsyncDescriptionConfig) => {
      if (c.item.title === 'Good') { c.item.description = 'Loaded text'; c.promise.resolve(); } else c.promise.reject('no');
    });
    const { rerender } = view(
      <MessageView asyncDescriptionHandler={handler} onLongtextLoaded={onLongtextLoaded}><MessageItem type="Error" title="Good" longtextUrl="/t/1" /></MessageView>,
    );
    expect(await screen.findByText('Loaded text')).toBeInTheDocument();
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ item: expect.objectContaining({ title: 'Good', longtextUrl: '/t/1' }), promise: expect.objectContaining({ resolve: expect.any(Function), reject: expect.any(Function) }) }));
    expect(onLongtextLoaded).toHaveBeenCalledTimes(1);
    rerender(wrap(
      <MessageView asyncDescriptionHandler={handler} onLongtextLoaded={onLongtextLoaded}><MessageItem type="Error" title="Bad" description="Own text" longtextUrl="/t/2" /></MessageView>,
    ));
    await waitFor(() => expect(onLongtextLoaded).toHaveBeenCalledTimes(2));
    expect(screen.getByText('Own text')).toBeInTheDocument();
  });

  it('AL-06 itemSelect / listSelect / activeTitlePress objects are MessageView$…Event and MessagePopover$…Event', () => {
    const select: Array<MessageView$ItemSelectEvent | MessageView$ListSelectEvent | MessageView$ActiveTitlePressEvent> = [];
    view(
      <MessageView onItemSelect={(e) => select.push(e)} onListSelect={(e) => select.push(e)} onActiveTitlePress={(e) => select.push(e)}>
        <MessageItem key="a" type="Error" title="A" description="d" activeTitle />
        <MessageItem key="b" type="Warning" title="B" />
      </MessageView>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Warning' }));
    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    fireEvent.click(document.querySelector('.sk-message-view__title--active')!);
    fireEvent.click(document.querySelector('.sk-message-view__row--nav')!);
    expect(select).toEqual([
      { messageTypeFilter: 'Warning' }, { messageTypeFilter: 'All' }, { item: expect.objectContaining({ key: 'a' }) },
      { item: expect.objectContaining({ key: 'a' }), messageTypeFilter: 'All' },
    ]);
    const popoverEvent: MessagePopover$ItemSelectEvent = select[3] as MessageView$ItemSelectEvent;
    const open: MessagePopover$BeforeOpenEvent = { openBy: document.body };
    expect(Object.keys(popoverEvent)).toEqual(['item', 'messageTypeFilter']);
    expect(Object.keys(open)).toEqual(['openBy']);
  });
});

describe('MessagePopover (sap.m.MessagePopover)', () => {
  function Harness(p: { events: Record<string, ReturnType<typeof vi.fn>>; initiallyExpanded?: boolean }) {
    const ref = useRef<MessagePopover>(null);
    return (
      <>
        <button type="button" onClick={(e) => ref.current!.toggle(e.currentTarget)}>Open</button>
        <button type="button" onClick={() => p.events.isOpen!(ref.current!.isOpen())}>Ask</button>
        <MessagePopover
          ref={ref} initiallyExpanded={p.initiallyExpanded}
          onBeforeOpen={p.events.beforeOpen} onAfterOpen={p.events.afterOpen} onBeforeClose={p.events.beforeClose} onAfterClose={p.events.afterClose}
        >
          <MessageItem key="a" type="Error" title="E1" />
          <MessageItem key="b" type="Warning" title="W1" />
        </MessagePopover>
      </>
    );
  }
  const events = () => ({ beforeOpen: vi.fn(), afterOpen: vi.fn(), beforeClose: vi.fn(), afterClose: vi.fn(), isOpen: vi.fn() });

  it('UE-16 toggle / openBy / close / isOpen with beforeOpen, afterOpen, beforeClose, afterClose ({ openBy })', async () => {
    const e = events();
    view(<Harness events={e} />);
    const opener = screen.getByRole('button', { name: 'Open' });
    fireEvent.click(opener);
    const dialog = await screen.findByRole('dialog', { name: 'Messages' });
    expect(within(dialog).getByText('E1')).toBeInTheDocument();
    expect(e.beforeOpen).toHaveBeenCalledWith({ openBy: opener });
    expect(e.afterOpen).toHaveBeenCalledWith({ openBy: opener });
    fireEvent.click(screen.getByRole('button', { name: 'Ask' }));
    expect(e.isOpen).toHaveBeenLastCalledWith(true);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(e.beforeClose).toHaveBeenCalledWith({ openBy: opener });
    expect(e.afterClose).toHaveBeenCalledWith({ openBy: opener });
    expect(opener).toHaveFocus();
  });

  it('UE-17 initiallyExpanded=false opens with only the header; choosing a filter shows the list', async () => {
    view(<Harness events={events()} initiallyExpanded={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByText('E1')).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Error' }));
    expect(within(dialog).getByText('E1')).toBeInTheDocument();
  });

  it('UE-18 MessageButton (ADR-023) uses the MessagePopover: count, clear, and a message with a target navigates', async () => {
    const onNavigate = vi.fn();
    function Seed() {
      return <MessageProvider onNavigate={onNavigate}><Add /><MessageButton /></MessageProvider>;
    }
    function Add() {
      const api = useMessages()!;
      return <button type="button" onClick={() => api.add([createMessage('error', 'Group missing', { target: 'PurchasingGroup' }), createMessage('success', 'Saved')])}>seed</button>;
    }
    view(<Seed />, 'en');
    fireEvent.click(screen.getByRole('button', { name: 'seed' }));
    const button = document.querySelector('[data-sk-message-button="error"]') as HTMLElement;
    expect(button).toHaveTextContent('2');
    fireEvent.click(button);
    const popover = await waitFor(() => document.querySelector('[data-sk-message-popover]') as HTMLElement);
    expect(popover.querySelector('[data-sk-message="success"]')).toHaveTextContent('Saved');
    fireEvent.click(within(popover.querySelector('[data-sk-message-target="PurchasingGroup"]') as HTMLElement).getByRole('button'));
    expect(onNavigate).toHaveBeenCalledWith(expect.objectContaining({ target: 'PurchasingGroup' }));
    fireEvent.click(button);
    fireEvent.click(await waitFor(() => document.querySelector('[data-sk-messages-clear]') as HTMLElement));
    await waitFor(() => expect(document.querySelector('[data-sk-message-button]')).toBeNull());
  });

  it('UE-19 without a SmartKitProvider the controls use English texts; with one they follow its locale', () => {
    const { unmount } = view(<MessageView><MessageItem type="Error" title="a" /><MessageItem type="Warning" title="b" /></MessageView>);
    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument();
    unmount();
    view(<MessageView><MessageItem type="Error" title="a" /><MessageItem type="Warning" title="b" /></MessageView>, 'zh');
    expect(screen.getByRole('button', { name: '全部' })).toBeInTheDocument();
  });
});
