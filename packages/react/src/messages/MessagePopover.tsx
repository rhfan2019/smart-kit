/**
 * sap.m.MessagePopover (docs/26 §3.1): the MessageView in a popover, opened at a control with `openBy`.
 */
import { CloseButton, Popover, type PopoverProps } from '@mantine/core';
import { useCallback, useEffect, useImperativeHandle, useRef, useState, type CSSProperties, type Ref } from 'react';
import { useControlText } from '../controls/context';
import { MessageViewBody, useViewItems, type MessageViewProps, type MessageViewRef } from './MessageView';
import { TEXTS } from './texts';

/** sap.m.VerticalPlacementType */
export type VerticalPlacementType = 'Vertical' | 'Top' | 'Bottom';
export const VerticalPlacementType = { Vertical: 'Vertical', Top: 'Top', Bottom: 'Bottom' } as const;

export interface MessagePopoverRef extends MessageViewRef {
  /** Opens the popover at `control` (sap.m.MessagePopover#openBy). */
  openBy(control: Element): void;
  close(): void;
  isOpen(): boolean;
  /** Opens at `control`, or closes when open. */
  toggle(control: Element): void;
}

export interface MessagePopoverProps extends Omit<MessageViewProps, 'ref' | 'showDetailsPageHeader'> {
  /** UI5 default 'Vertical' (below, or above when there is no room). */
  placement?: VerticalPlacementType;
  /** Opens with the message list shown (UI5 default true); false opens with only the header and filter. */
  initiallyExpanded?: boolean;
  onBeforeOpen?: (e: { openBy: Element }) => void;
  onAfterOpen?: (e: { openBy: Element }) => void;
  onBeforeClose?: (e: { openBy: Element }) => void;
  onAfterClose?: (e: { openBy: Element }) => void;
  /** Accessible name of the popover (default "Messages"). */
  'aria-label'?: string;
  ref?: Ref<MessagePopoverRef>;
}

const POSITION: Record<VerticalPlacementType, PopoverProps['position']> = { Vertical: 'bottom', Bottom: 'bottom', Top: 'top' };

/** sap.m.MessagePopover */
export function MessagePopover(p: MessagePopoverProps) {
  const t = useControlText(TEXTS);
  const list = useViewItems(p.children, p.items);
  const [anchor, setAnchor] = useState<Element | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const view = useRef<MessageViewRef>(null);
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
