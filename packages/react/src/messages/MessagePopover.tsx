/**
 * sap.m.MessagePopover (docs/26 §3.1): the MessageView in a popover, opened at a control with `openBy`.
 */
import { CloseButton, Popover, type PopoverProps } from '@mantine/core';
import { useCallback, useEffect, useImperativeHandle, useRef, useState, type CSSProperties, type Ref } from 'react';
import { useControlText } from '../controls/context';
import {
  MessageViewBody, useViewItems, type $MessageViewSettings, type MessageView, type MessageView$ActiveTitlePressEvent,
  type MessageView$ItemSelectEvent, type MessageView$ListSelectEvent,
} from './MessageView';
import { TEXTS } from './texts';

/** sap.m.VerticalPlacementType */
export type VerticalPlacementType = 'Vertical' | 'Top' | 'Bottom';
export const VerticalPlacementType = { Vertical: 'Vertical', Top: 'Top', Bottom: 'Bottom' } as const;

export interface MessagePopover extends MessageView {
  /** Opens the popover at `control` (sap.m.MessagePopover#openBy). */
  openBy(control: Element): void;
  close(): void;
  isOpen(): boolean;
  /** Opens at `control`, or closes when open. */
  toggle(control: Element): void;
}

/** Event object of `onBeforeOpen` (sap.m.MessagePopover#beforeOpen): the control the popover opens at. */
export interface MessagePopover$BeforeOpenEvent { openBy: Element }
/** Event object of `onAfterOpen` (sap.m.MessagePopover#afterOpen). */
export interface MessagePopover$AfterOpenEvent { openBy: Element }
/** Event object of `onBeforeClose` (sap.m.MessagePopover#beforeClose). */
export interface MessagePopover$BeforeCloseEvent { openBy: Element }
/** Event object of `onAfterClose` (sap.m.MessagePopover#afterClose). */
export interface MessagePopover$AfterCloseEvent { openBy: Element }
/** Event object of `onItemSelect` (sap.m.MessagePopover#itemSelect). */
export type MessagePopover$ItemSelectEvent = MessageView$ItemSelectEvent;
/** Event object of `onListSelect` (sap.m.MessagePopover#listSelect). */
export type MessagePopover$ListSelectEvent = MessageView$ListSelectEvent;
/** Event object of `onActiveTitlePress` (sap.m.MessagePopover#activeTitlePress). */
export type MessagePopover$ActiveTitlePressEvent = MessageView$ActiveTitlePressEvent;

export interface $MessagePopoverSettings extends Omit<$MessageViewSettings, 'ref' | 'showDetailsPageHeader' | 'groupItems' | 'onItemSelect' | 'onListSelect' | 'onActiveTitlePress'> {
  /** Position of the popover: below, or above when there is no room ('Vertical'), always 'Top' or 'Bottom'. @defaultValue 'Vertical' */
  placement?: VerticalPlacementType;
  /** Opens with the message list shown; false opens with only the header and filter. @defaultValue true */
  initiallyExpanded?: boolean;
  /** Groups the items by `groupName`. @defaultValue false */
  groupItems?: boolean;
  onItemSelect?: (e: MessagePopover$ItemSelectEvent) => void;
  onListSelect?: (e: MessagePopover$ListSelectEvent) => void;
  onActiveTitlePress?: (e: MessagePopover$ActiveTitlePressEvent) => void;
  onBeforeOpen?: (e: MessagePopover$BeforeOpenEvent) => void;
  onAfterOpen?: (e: MessagePopover$AfterOpenEvent) => void;
  onBeforeClose?: (e: MessagePopover$BeforeCloseEvent) => void;
  onAfterClose?: (e: MessagePopover$AfterCloseEvent) => void;
  /** Accessible name of the popover (default "Messages"). */
  'aria-label'?: string;
  ref?: Ref<MessagePopover>;
}

const POSITION: Record<VerticalPlacementType, PopoverProps['position']> = { Vertical: 'bottom', Bottom: 'bottom', Top: 'top' };

/** sap.m.MessagePopover */
export function MessagePopover(p: $MessagePopoverSettings) {
  const t = useControlText(TEXTS);
  const list = useViewItems(p.children, p.items);
  const [anchor, setAnchor] = useState<Element | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const view = useRef<MessageView>(null);
  const [expanded, setExpanded] = useState(true);
  const { onBeforeOpen, onAfterOpen, onBeforeClose, onAfterClose, initiallyExpanded } = p;
  const openBy = useCallback((control: Element) => {
    onBeforeOpen?.({ openBy: control });
    setExpanded(initiallyExpanded !== false);
    setAnchor(control);
    setRect(control.getBoundingClientRect());
  }, [onBeforeOpen, initiallyExpanded]);
  const current = useRef<Element | null>(null);
  current.current = anchor;
  const close = useCallback(() => {
    const a = current.current;
    if (!a) return;
    current.current = null;
    onBeforeClose?.({ openBy: a });
    setAnchor(null);
    if (a instanceof HTMLElement && document.contains(a)) a.focus();
    onAfterClose?.({ openBy: a });
  }, [onBeforeClose, onAfterClose]);
  useEffect(() => { if (anchor) onAfterOpen?.({ openBy: anchor }); }, [anchor, onAfterOpen]);
  useImperativeHandle(p.ref, () => ({
    openBy, close, isOpen: () => current.current !== null,
    toggle: (c) => (current.current ? close() : openBy(c)),
    navigateBack: () => view.current?.navigateBack(),
  }), [openBy, close]);
  // follows the control while the page scrolls or resizes
  useEffect(() => {
    if (!anchor) return undefined;
    const update = () => setRect(anchor.getBoundingClientRect());
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => { window.removeEventListener('scroll', update, true); window.removeEventListener('resize', update); };
  }, [anchor]);
  const placeholder: CSSProperties = rect ? { position: 'fixed', left: rect.left, top: rect.top, width: rect.width, height: rect.height, pointerEvents: 'none' } : {};
  return (
    <Popover
      opened={anchor !== null} onChange={(o) => { if (!o) close(); }} onClose={close} position={POSITION[p.placement ?? 'Vertical']}
      width={360} withArrow withRoles={false} trapFocus returnFocus={false} closeOnEscape closeOnClickOutside withinPortal
      middlewares={{ flip: (p.placement ?? 'Vertical') === 'Vertical', shift: true }}
    >
      <Popover.Target><span aria-hidden className="sk-message-popover__anchor" style={placeholder} /></Popover.Target>
      <Popover.Dropdown role="dialog" aria-label={p['aria-label'] ?? t('ctl.msg.messages')} className="sk-message-popover" data-sk-message-popover>
        <MessageViewBody
          {...p} ref={view} list={list} collapsed={!expanded} onListSelect={(e) => { setExpanded(true); p.onListSelect?.(e); }}
          headerButton={<>{p.headerButton}<CloseButton size="sm" aria-label={t('common.close')} onClick={close} /></>}
        />
      </Popover.Dropdown>
    </Popover>
  );
}
