/**
 * Page messages (ADR-023): the footer shows a message button when there are messages; it opens the message popover
 * (LR Footer Toolbar, OP Message Handling · In Edit Mode).
 */
import { ActionIcon, Button } from '@mantine/core';
import { highestSeverity, type Message } from '@rhfan2019/smart-kit-core';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useText } from '../context/SmartKitProvider';
import { MessagePopover } from './MessagePopover';

export interface MessagesApi {
  messages: Message[];
  /** Adds server or custom messages. */
  add(list: Message[]): void;
  /** Replaces the client validation messages. */
  setClient(list: Message[]): void;
  remove(id: string): void;
  clear(): void;
  /** Called when a message with a target is pressed (focus the field). */
  onNavigate?(m: Message): void;
}

const Ctx = createContext<MessagesApi | null>(null);

export function MessageProvider({ children, onNavigate }: { children?: ReactNode; onNavigate?(m: Message): void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const add = useCallback((list: Message[]) => { if (list.length) setMessages((m) => [...m.filter((x) => !list.some((y) => y.message === x.message && y.target === x.target)), ...list]); }, []);
  const setClient = useCallback((list: Message[]) => setMessages((m) => [...m.filter((x) => x.source !== 'client'), ...list]), []);
  const remove = useCallback((id: string) => setMessages((m) => m.filter((x) => x.id !== id)), []);
  const clear = useCallback(() => setMessages([]), []);
  const value = useMemo(() => ({ messages, add, setClient, remove, clear, onNavigate }), [messages, add, setClient, remove, clear, onNavigate]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** The nearest page message collection, or null outside a MessageProvider. */
export function useMessages(): MessagesApi | null {
  return useContext(Ctx);
}

export function MessageIcon({ type }: { type: Message['type'] }) {
  if (type === 'error') return <XCircle className="sk-icon sk-status--negative" aria-hidden />;
  if (type === 'warning') return <AlertTriangle className="sk-icon sk-status--critical" aria-hidden />;
  if (type === 'success') return <CheckCircle2 className="sk-icon sk-status--positive" aria-hidden />;
  return <Info className="sk-icon sk-status--info" aria-hidden />;
}

/** sap.fe.macros.MessageButton `visibilityChange`: the button was shown or hidden. */
export interface MessageButton$VisibilityChangeEvent {
  /** Whether the button is visible now. */
  visible: boolean;
}

export interface $MessageButtonSettings {
  /** The button was shown (the first message arrived) or hidden (the last message went). */
  onVisibilityChange?(e: MessageButton$VisibilityChangeEvent): void;
}

/**
 * Footer message button with the message popover (sap.fe.macros.MessageButton; MessagePopover, docs/26): visible only
 * while there are messages.
 */
export function MessageButton({ onVisibilityChange }: $MessageButtonSettings = {}) {
  const api = useMessages();
  const t = useText();
  const button = useRef<HTMLButtonElement>(null);
  const popover = useRef<MessagePopover>(null);
  const count = api?.messages.length ?? 0;
  const visible = Boolean(api && count);
  // The button starts hidden; only changes are reported.
  const shown = useRef(false);
  useEffect(() => {
    if (shown.current === visible) return;
    shown.current = visible;
    onVisibilityChange?.({ visible });
  }, [visible, onVisibilityChange]);
  if (!api || !count) return null;
  const top = highestSeverity(api.messages)!;
  const order: Message['type'][] = ['error', 'warning', 'info', 'success'];
  const sorted = [...api.messages].sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
  return (
    <>
      <Button
        ref={button} variant="subtle" leftSection={<MessageIcon type={top} />} onClick={(e) => popover.current?.toggle(e.currentTarget)}
        aria-label={t('messages.button', { count })} aria-haspopup="dialog" data-sk-message-button={top}
      >
        {count}
      </Button>
      <MessagePopover
        ref={popover} items={sorted} placement="Top" aria-label={t('messages.title')}
        headerButton={<Button size="compact-xs" variant="subtle" onClick={() => { api.clear(); popover.current?.close(); }} data-sk-messages-clear>{t('messages.clear')}</Button>}
        onActiveTitlePress={api.onNavigate ? ({ item }) => { popover.current?.close(); if (item.message) api.onNavigate!(item.message); } : undefined}
      />
    </>
  );
}

/** Small icon-only variant for compact toolbars. */
export function MessageIndicator() {
  const api = useMessages();
  if (!api?.messages.length) return null;
  return <ActionIcon variant="subtle" aria-hidden tabIndex={-1}><MessageIcon type={highestSeverity(api.messages)!} /></ActionIcon>;
}
