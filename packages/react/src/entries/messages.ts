'use client';

/**
 * `@rhfan2019/smart-kit/messages`: the page message model with its footer button (ADR-023) and the message controls with
 * SAPUI5 names (docs/26 §3.1, ADR-032): MessageToast, MessageBox, MessageStrip, MessageView, MessagePopover.
 */
export { MessageProvider, MessageButton, MessageIcon, useMessages, type MessagesApi } from '../messages/MessageContext';
export { MessageToast, type MessageToastOptions } from '../messages/MessageToast';
export { MessageBox, type MessageBoxAction, type MessageBoxIcon, type MessageBoxOptions } from '../messages/MessageBox';
export { MessageHost } from '../messages/MessageHost';
export { MessageStrip, type MessageStripProps, type MessageStripRef } from '../messages/MessageStrip';
export {
  MessageView, MessageItem, type MessageViewProps, type MessageViewRef, type MessageItemProps, type MessageViewItem,
} from '../messages/MessageView';
export { MessagePopover, VerticalPlacementType, type MessagePopoverProps, type MessagePopoverRef } from '../messages/MessagePopover';
