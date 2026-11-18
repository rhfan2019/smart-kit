/** Message controls (docs/26 §3.1, ADR-032): MessageToast, MessageBox, MessageStrip, MessageView, MessagePopover. */
import { Button, Group, MantineProvider } from '@mantine/core';
import { smartKitCssVariablesResolver, smartKitMantineTheme, SmartKitProvider } from '@rhfan2019/smart-kit';
import { MessageType, ValueState } from '@rhfan2019/smart-kit/controls';
import {
  MessageBox, MessageHost, MessageItem, MessagePopover, MessageStrip, MessageToast, MessageView, VerticalPlacementType, type MessagePopoverRef,
} from '@rhfan2019/smart-kit/messages';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useRef, type ReactNode } from 'react';

function Providers({ children }: { children: ReactNode }) {
  // SmartKitProvider renders a MessageHost itself; apps without it render <MessageHost /> (shown in the last story)
  return (
    <MantineProvider theme={smartKitMantineTheme} cssVariablesResolver={smartKitCssVariablesResolver} forceColorScheme="light">
      <SmartKitProvider services={{}} locale="en" namespace="storybook-controls-messages">
        <div style={{ display: 'grid', gap: 16, padding: 16, maxWidth: 720 }}>{children}</div>
      </SmartKitProvider>
    </MantineProvider>
  );
}

const meta: Meta = { title: 'smart-kit/Controls/Messages', parameters: { layout: 'fullscreen' }, decorators: [(Story) => <Providers><Story /></Providers>] };
export default meta;
type Story = StoryObj;

const items = (
  <>
    <MessageItem key="1" type={MessageType.Error} title="Net price is missing" subtitle="Item 10" description="Enter a net price for item 10 before saving." groupName="Items" />
    <MessageItem key="2" type={MessageType.Error} title="Delivery address is incomplete" groupName="Header" counter={2} />
    <MessageItem key="3" type={MessageType.Warning} title="Delivery date is in the past" subtitle="Item 20" groupName="Items" activeTitle />
    <MessageItem key="4" type={MessageType.Success} title="Prices recalculated" />
    <MessageItem key="5" type={MessageType.Information} title="Discount applied from the framework contract" />
  </>
);

export const Toast: Story = {
  render: () => (
    <Group>
      <Button onClick={() => MessageToast.show('Document saved')}>Show</Button>
      <Button variant="default" onClick={() => MessageToast.show('At the top, 6 s', { at: 'CenterTop', my: 'CenterTop', offset: '0 24', duration: 6000 })}>Top</Button>
    </Group>
  ),
};

export const Box: Story = {
  render: () => (
    <Group>
      <Button onClick={() => { void MessageBox.confirm('Delete this document?').then((a) => MessageToast.show(`Action: ${a}`)); }}>confirm</Button>
      <Button color="red" onClick={() => { void MessageBox.error('The document could not be posted.', { details: { code: 'E42', reason: 'Period closed' } }); }}>error</Button>
      <Button variant="default" onClick={() => { void MessageBox.warning('Unsaved changes will be lost.', { actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL], emphasizedAction: MessageBox.Action.OK }); }}>warning</Button>
      <Button variant="default" onClick={() => { void MessageBox.success('Posted.'); }}>success</Button>
      <Button variant="default" onClick={() => { void MessageBox.information('A new version is available.'); }}>information</Button>
      <Button variant="default" onClick={() => { void MessageBox.alert('Please check your entries.'); }}>alert</Button>
    </Group>
  ),
};

export const Strip: Story = {
  render: () => (
    <>
      <MessageStrip text="Draft saved automatically." type={ValueState.Information} showIcon />
      <MessageStrip text="All items were posted." type="Success" showIcon showCloseButton />
      <MessageStrip text="Two items have no delivery date." type="Warning" showIcon link={<a href="#items">Show items</a>} />
      <MessageStrip text="The document is locked by another user." type="Error" showIcon showCloseButton />
      <MessageStrip text="Color set 1, scheme 6" colorSet="ColorSet1" colorScheme={6} />
      <MessageStrip text="Color set 2, scheme 3" colorSet="ColorSet2" colorScheme={3} />
    </>
  ),
};

export const View: Story = { render: () => <MessageView groupItems>{items}</MessageView> };

function PopoverDemo() {
  const ref = useRef<MessagePopoverRef>(null);
  return (
    <div>
      <Button variant="subtle" color="red" onClick={(e) => ref.current?.toggle(e.currentTarget)}>5 messages</Button>
      <MessagePopover ref={ref} placement={VerticalPlacementType.Bottom} onActiveTitlePress={({ item }) => MessageToast.show(`Go to ${item.subtitle}`)}>{items}</MessagePopover>
    </div>
  );
}
export const Popover: Story = { render: () => <PopoverDemo /> };

/** Without a SmartKitProvider: render a MessageHost inside the MantineProvider. */
export const HostOnly: Story = {
  decorators: [(Story) => <MantineProvider theme={smartKitMantineTheme} forceColorScheme="light"><Story /><MessageHost /></MantineProvider>],
  render: () => <div style={{ padding: 16 }}><Button onClick={() => MessageToast.show('Toast without SmartKitProvider')}>Show</Button></div>,
};
