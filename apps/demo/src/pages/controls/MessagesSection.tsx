/** Demo section of the message controls (docs/26 §3.1): MessageToast, MessageBox, MessageStrip, MessageView, MessagePopover. */
import { Button, Group, SimpleGrid, Stack, Text } from '@mantine/core';
import MessageBox from '@rhfan2019/smart-kit/m/MessageBox';
import MessageItem from '@rhfan2019/smart-kit/m/MessageItem';
import MessagePopover from '@rhfan2019/smart-kit/m/MessagePopover';
import MessageStrip from '@rhfan2019/smart-kit/m/MessageStrip';
import MessageToast from '@rhfan2019/smart-kit/m/MessageToast';
import MessageView from '@rhfan2019/smart-kit/m/MessageView';
import { useRef } from 'react';

const items = (
  <>
    <MessageItem key="1" type="Error" title="Net price is missing" subtitle="Item 10" description="Enter a net price for item 10 before you save the purchase order." groupName="Items" activeTitle />
    <MessageItem key="2" type="Error" title="Supplier 100042 is blocked for purchasing" groupName="Header" />
    <MessageItem key="3" type="Warning" title="Delivery date is in the past" subtitle="Item 20" groupName="Items" counter={2} />
    <MessageItem key="4" type="Success" title="Prices recalculated from the framework contract" />
    <MessageItem key="5" type="Information" title="A newer version of the contract exists" description="Contract 4600000012 version 3 is valid from next month." />
  </>
);

export function MessagesSection() {
  const popover = useRef<MessagePopover>(null);
  return (
    <Stack gap="lg">
      <div>
        <Text fw={600} mb="xs">MessageToast · MessageBox</Text>
        <Group gap="xs" data-demo-message-buttons>
          <Button size="xs" onClick={() => MessageToast.show('Purchase order 4500000017 saved')}>MessageToast.show</Button>
          <Button size="xs" variant="default" onClick={() => { void MessageBox.confirm('Delete purchase order 4500000017?').then((a) => MessageToast.show(`Action: ${a ?? 'Escape'}`)); }}>confirm</Button>
          <Button size="xs" variant="default" onClick={() => { void MessageBox.error('The purchase order could not be released.', { details: { code: 'ME/055', text: 'Release strategy not found' } }); }}>error (details)</Button>
          <Button size="xs" variant="default" onClick={() => { void MessageBox.warning('Unsaved changes will be lost.'); }}>warning</Button>
          <Button size="xs" variant="default" onClick={() => { void MessageBox.success('All items were released.'); }}>success</Button>
          <Button size="xs" variant="default" onClick={() => { void MessageBox.show('Send the order to the supplier now?', { title: 'Output', actions: [MessageBox.Action.YES, MessageBox.Action.NO], emphasizedAction: MessageBox.Action.YES }); }}>show (Yes / No)</Button>
        </Group>
      </div>
      <div>
        <Text fw={600} mb="xs">MessageStrip</Text>
        <Stack gap="xs">
          <MessageStrip text="This purchase order was created from a contract." showIcon />
          <MessageStrip text="All items have been delivered." type="Success" showIcon showCloseButton />
          <MessageStrip text="Two items have no delivery date." type="Warning" showIcon link={<a href="#items">Show items</a>} />
          <MessageStrip text="The purchase order is locked by Anna Weber." type="Error" showIcon showCloseButton />
          <MessageStrip text="ColorSet1, scheme 5" colorSet="ColorSet1" colorScheme={5} />
        </Stack>
      </div>
      <SimpleGrid cols={{ base: 1, md: 2 }}>
        <div>
          <Text fw={600} mb="xs">MessageView (groupItems)</Text>
          <MessageView groupItems onActiveTitlePress={({ item }) => MessageToast.show(`Go to ${item.subtitle ?? item.title}`)}>{items}</MessageView>
        </div>
        <div>
          <Text fw={600} mb="xs">MessagePopover</Text>
          <Button size="xs" variant="subtle" color="red" onClick={(e) => popover.current?.toggle(e.currentTarget)} data-demo-message-popover>5 messages</Button>
          <MessagePopover ref={popover} onActiveTitlePress={({ item }) => { popover.current?.close(); MessageToast.show(`Go to ${item.subtitle ?? item.title}`); }}>{items}</MessagePopover>
        </div>
      </SimpleGrid>
    </Stack>
  );
}
