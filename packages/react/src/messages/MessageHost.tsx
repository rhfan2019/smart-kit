/**
 * Renders the toasts of `MessageToast.show` and the dialogs of `MessageBox.*` (docs/26 §3.1). The SmartKitProvider
 * renders one; apps without it render `<MessageHost />` inside their MantineProvider.
 */
import { Anchor, Button, Group, Loader, Modal, Text } from '@mantine/core';
import { AlertTriangle, CheckCircle2, HelpCircle, Info, XCircle } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { useControlText } from '../controls/context';
import type { MessageKey } from '../i18n/messages.en';
import { messageStore, type BoxEntry, type Dock, type ToastEntry } from './messageStore';
import { TEXTS } from './texts';

const ACTION_KEYS: Record<string, MessageKey> = {
  OK: 'ctl.msg.action.ok', CANCEL: 'ctl.msg.action.cancel', YES: 'ctl.msg.action.yes', NO: 'ctl.msg.action.no', ABORT: 'ctl.msg.action.abort',
  RETRY: 'ctl.msg.action.retry', IGNORE: 'ctl.msg.action.ignore', CLOSE: 'ctl.msg.action.close', DELETE: 'ctl.msg.action.delete',
};
const TITLE_KEYS: Record<string, MessageKey> = {
  '@alert': 'ctl.msg.title.alert', '@confirm': 'ctl.msg.title.confirm', '@error': 'ctl.msg.title.error',
  '@information': 'ctl.msg.title.information', '@warning': 'ctl.msg.title.warning', '@success': 'ctl.msg.title.success',
};

function BoxIcon({ icon }: { icon: string }) {
  if (icon === 'ERROR') return <XCircle className="sk-icon sk-status--negative" aria-hidden />;
  if (icon === 'WARNING') return <AlertTriangle className="sk-icon sk-status--critical" aria-hidden />;
  if (icon === 'SUCCESS') return <CheckCircle2 className="sk-icon sk-status--positive" aria-hidden />;
  if (icon === 'INFORMATION') return <Info className="sk-icon sk-status--info" aria-hidden />;
  if (icon === 'QUESTION') return <HelpCircle className="sk-icon sk-status--info" aria-hidden />;
  return null;
}

function Details({ details }: { details: NonNullable<BoxEntry['details']> }) {
  const t = useControlText(TEXTS);
  const [state, setState] = useState<{ text?: string; loading?: boolean; failed?: boolean }>({});
  const text = (v: string | object) => (typeof v === 'string' ? v : JSON.stringify(v, null, 2));
  const load = () => {
    if (typeof details !== 'function') { setState({ text: text(details) }); return; }
    setState({ loading: true });
    (details as () => Promise<string | object>)().then((v: string | object) => setState({ text: text(v) }), () => setState({ failed: true }));
  };
  if (state.text !== undefined) return <pre className="sk-message-box__details" data-sk-message-box-details>{state.text}</pre>;
  if (state.failed) {
    return (
      <Group gap="xs" mt="sm">
        <Text size="sm" className="sk-status--negative">{t('ctl.msg.detailsError')}</Text>
        <Anchor component="button" type="button" size="sm" onClick={load}>{t('ctl.msg.retry')}</Anchor>
      </Group>
    );
  }
  return state.loading
    ? <Loader size="xs" mt="sm" aria-label={t('ctl.msg.showDetails')} />
    : <Anchor component="button" type="button" size="sm" mt="sm" onClick={load} data-sk-message-box-show-details>{t('ctl.msg.showDetails')}</Anchor>;
}

function Box({ box }: { box: BoxEntry }) {
  const t = useControlText(TEXTS);
  const label = (a: string) => (ACTION_KEYS[a] ? t(ACTION_KEYS[a]) : a);
  const title = box.title ? (TITLE_KEYS[box.title] ? t(TITLE_KEYS[box.title]) : box.title) : undefined;
  // initialFocus is an action or a button text (case-insensitive); without it the first button gets the focus
  const wanted = box.initialFocus?.toLowerCase();
  const focus = (wanted && box.actions.find((a) => a.toLowerCase() === wanted || label(a).toLowerCase() === wanted)) ?? box.actions[0];
  const overflow = `${box.horizontalScrolling ? 'auto' : 'hidden'} ${box.verticalScrolling ? 'auto' : 'hidden'}`;
  return (
    <Modal
      opened onClose={() => messageStore.closeBox(box.id, null)} centered withCloseButton={false} trapFocus returnFocus
      size={box.contentWidth ?? 'md'} classNames={{ content: `sk-message-box sk-message-box--${box.icon.toLowerCase()}` }} id={box.domId}
      title={title || box.icon !== 'NONE' ? <Group gap="xs" wrap="nowrap"><BoxIcon icon={box.icon} /><span>{title}</span></Group> : undefined}
      aria-label={title || undefined} data-sk-message-box={box.icon}
    >
      <div className="sk-message-box__text" style={{ overflow }}>{typeof box.message === 'string' ? <Text size="sm" className="sk-message-box__plain">{box.message}</Text> : box.message}</div>
      {box.details !== undefined && box.details !== '' ? <Details details={box.details} /> : null}
      <Group justify="flex-end" gap="xs" mt="md" className="sk-message-box__footer">
        {box.actions.map((a) => (
          <Button
            key={a} size="sm" variant={a === box.emphasizedAction ? 'filled' : 'default'} data-autofocus={a === focus || undefined}
            onClick={() => messageStore.closeBox(box.id, a)} data-sk-message-box-action={a}
          >{label(a)}</Button>
        ))}
      </Group>
    </Modal>
  );
}

/** Horizontal (0, 0.5, 1) and vertical factors of a Dock point; Begin/Left = left, End/Right = right (LTR). */
function dockPoint(d: Dock): [number, number] {
  const x = /^(Begin|Left)/.test(d) ? 0 : /^(End|Right)/.test(d) ? 1 : 0.5;
  const y = /Top$/.test(d) ? 0 : /Bottom$/.test(d) ? 1 : 0.5;
  return [x, y];
}

function Toast({ toast }: { toast: ToastEntry }) {
  const ref = useRef<HTMLDivElement>(null);
  const [fading, setFading] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  useEffect(() => {
    const fade = setTimeout(() => setFading(true), toast.duration);
    const done = setTimeout(() => messageStore.removeToast(toast.id), toast.duration + toast.animationDuration);
    return () => { clearTimeout(fade); clearTimeout(done); };
  }, [toast]);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ref0 = toast.of?.getBoundingClientRect() ?? { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
    const [ax, ay] = dockPoint(toast.at);
    const [mx, my] = dockPoint(toast.my);
    const [ox = 0, oy = 0] = toast.offset.split(/\s+/).map((v) => Number.parseFloat(v) || 0);
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    let left = ref0.left + ax * ref0.width - mx * w + ox;
    let top = ref0.top + ay * ref0.height - my * h + oy;
    // collision "fit": keep the toast inside the window
    left = Math.min(Math.max(0, left), Math.max(0, window.innerWidth - w));
    top = Math.min(Math.max(0, top), Math.max(0, window.innerHeight - h));
    setPos({ left, top });
  }, [toast]);
  // the default position (CenterBottom of the window) keeps the UI5 bottom margin
  const atDefault = !toast.of && toast.at === 'CenterBottom' && toast.my === 'CenterBottom';
  const style: CSSProperties = {
    width: toast.width, transitionDuration: `${toast.animationDuration}ms`, transitionTimingFunction: toast.animationTimingFunction,
    ...(pos ? { left: pos.left, top: pos.top } : { visibility: 'hidden' }),
  };
  return (
    <div ref={ref} className={`sk-message-toast${fading ? ' sk-message-toast--fading' : ''}${atDefault ? ' sk-message-toast--default' : ''}`} style={style} role="status" data-sk-message-toast>
      {toast.message}
    </div>
  );
}

function Toasts({ toasts }: { toasts: ToastEntry[] }) {
  useEffect(() => {
    if (!toasts.some((x) => x.autoClose)) return undefined;
    // closes on the next press anywhere (sap.m.MessageToast autoClose); the press that showed the toast is already over
    const close = () => toasts.filter((x) => x.autoClose).forEach((x) => messageStore.removeToast(x.id));
    document.addEventListener('pointerdown', close, true);
    return () => document.removeEventListener('pointerdown', close, true);
  }, [toasts]);
  return <div className="sk-message-toasts" aria-live="polite">{toasts.map((x) => <Toast key={x.id} toast={x} />)}</div>;
}

/** Host of MessageToast and MessageBox. Only the first mounted host renders. */
export function MessageHost() {
  const [token] = useState(() => Symbol('message-host'));
  useEffect(() => { messageStore.register(token); return () => messageStore.unregister(token); }, [token]);
  const state = useSyncExternalStore(messageStore.subscribe, messageStore.get, messageStore.get);
  const active = useSyncExternalStore(messageStore.subscribe, () => messageStore.isActive(token), () => false);
  if (!active) return null;
  const box = state.boxes[0];
  return (
    <>
      {state.toasts.length ? <Toasts toasts={state.toasts} /> : null}
      {box ? <Box key={box.id} box={box} /> : null}
    </>
  );
}
