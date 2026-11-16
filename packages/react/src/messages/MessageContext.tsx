/**
 * Page messages (ADR-023): the footer shows a message button when there are messages; it opens the message popover
 * (LR Footer Toolbar, OP Message Handling · In Edit Mode).
 */
import { ActionIcon, Badge, Button, CloseButton, Group, Popover, Stack, Text, UnstyledButton } from '@mantine/core';
import { highestSeverity, type Message } from '@rhfan2019/smart-kit-core';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useText } from '../context/SmartKitProvider';

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

/** Footer message button with the message popover. Renders nothing without messages. */
export function MessageButton({ defaultOpened = false }: { defaultOpened?: boolean }) {
  const api = useMessages();
  const t = useText();
  const [opened, setOpened] = useState(defaultOpened);
  if (!api || !api.messages.length) return null;
  const top = highestSeverity(api.messages)!;
  const order: Message['type'][] = ['error', 'warning', 'info', 'success'];
  const sorted = [...api.messages].sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
  return (
    <Popover opened={opened} onChange={setOpened} position="top-start" width={360} withArrow trapFocus returnFocus>
      <Popover.Target>
        <Button variant="subtle" leftSection={<MessageIcon type={top} />} onClick={() => setOpened((o) => !o)} aria-label={t('messages.button', { count: api.messages.length })} aria-haspopup="dialog" data-sk-message-button={top}>
          {api.messages.length}
        </Button>
      </Popover.Target>
      <Popover.Dropdown role="dialog" aria-label={t('messages.title')} data-sk-message-popover>
        <Group justify="space-between" mb="xs">
          <Text fw={600}>{t('messages.title')}</Text>
          <Group gap={4}>
            <Button size="compact-xs" variant="subtle" onClick={() => { api.clear(); setOpened(false); }} data-sk-messages-clear>{t('messages.clear')}</Button>
            <CloseButton aria-label={t('common.close')} onClick={() => setOpened(false)} />
          </Group>
        </Group>
        <Stack gap={4} className="sk-messages__list">
          {sorted.map((m) => {
            const content = (
              <Group gap="xs" wrap="nowrap" align="flex-start">
                <MessageIcon type={m.type} />
                <div className="sk-messages__text">
                  <Text size="sm">{m.message}</Text>
                  {m.target ? <Badge size="xs" variant="light" color="gray">{m.target}</Badge> : null}
                </div>
              </Group>
            );
            return (
              <div key={m.id} className="sk-messages__item" data-sk-message={m.type} data-sk-message-target={m.target}>
                {m.target && api.onNavigate ? (
                  <UnstyledButton className="sk-messages__link" onClick={() => { setOpened(false); api.onNavigate!(m); }}>{content}</UnstyledButton>
                ) : content}
              </div>
            );
          })}
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}

/** Small icon-only variant for compact toolbars. */
export function MessageIndicator() {
  const api = useMessages();
  if (!api?.messages.length) return null;
  return <ActionIcon variant="subtle" aria-hidden tabIndex={-1}><MessageIcon type={highestSeverity(api.messages)!} /></ActionIcon>;
}
