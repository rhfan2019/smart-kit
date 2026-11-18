/**
 * sap.m.p13n.Popup (1.154): shows personalization panels (SelectionPanel, SortPanel, GroupPanel or any content) in a
 * Dialog or a ResponsivePopover. It is opened with `open(source)` on the ref; several panels are shown as tabs (the
 * first one selected, sap.m.p13n.Container), one panel directly. The Dialog has OK and Cancel (plus the
 * `additionalButtons`); closing fires `close` with the reason "Ok", "Cancel", "Escape" or (popover) "AutoClose".
 * Read the panels' state in `onClose` (their refs are still attached) — the Popup does not change the panels on
 * close, as in UI5, where sap.m.p13n.Engine applies the state on "Ok".
 * A `reset` callback adds a Reset button to the title bar (enabled by `open(source, { enableReset: true })` or by a
 * change in a panel); it asks for confirmation with `warningText`, resets the panels (search field) and calls `reset`.
 */
import { Button, Group, Modal, Paper, Portal, Tabs, Title } from '@mantine/core';
import { Children, isValidElement, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type KeyboardEvent, type ReactElement, type ReactNode, type Ref } from 'react';
import { MessageBox } from '../../messages/MessageBox';
import { PANEL_TITLES, PopupLinkContext, useP13nText } from './base';

/** sap.m.P13nPopupMode */
export type P13nPopupMode = 'Dialog' | 'ResponsivePopover';
export const P13nPopupMode = { Dialog: 'Dialog', ResponsivePopover: 'ResponsivePopover' } as const;

/** The `reason` of the `close` event. */
export type Popup$CloseReason = 'Ok' | 'Cancel' | 'Escape' | 'AutoClose';

export interface Popup$CloseEvent {
  /** Ok, Cancel, Escape, or AutoClose (ResponsivePopover closed by a click outside). */
  reason: Popup$CloseReason;
}

/** The settings of `open()` (Popup.open mSettings). */
export interface PopupOpenSettings {
  /** The key of the panel shown first (the React key of the panel element). */
  activePanel?: string;
  /** Whether the Reset button is enabled when the popup opens. */
  enableReset?: boolean;
  /** CSS width of the content (Dialog default "40rem", popover "30rem"). */
  contentWidth?: string;
  /** CSS height of the content (Dialog default "55rem" at most, popover "35rem"). */
  contentHeight?: string;
}

export interface $PopupSettings {
  /** The title of the popup. */
  title?: string;
  /** Dialog or ResponsivePopover (placed below the `open()` source). @defaultValue 'Dialog' */
  mode?: P13nPopupMode;
  /** The confirmation text shown before `reset` is called (only with `reset`). */
  warningText?: string;
  /** Called after the user confirmed a reset; the Reset button is shown only when it is given. */
  reset?: (control?: unknown) => void;
  /** The panels (sap.m.p13n.IContent): SelectionPanel, SortPanel, GroupPanel elements or other content; the React key is the panel key, its `title` prop the tab text. */
  panels?: ReactNode;
  /** Additional buttons in the Dialog footer, after OK and Cancel. */
  additionalButtons?: ReactNode[];
  /** Fired when the popup opens. */
  onOpen?: () => void;
  /** Fired when the popup closes. */
  onClose?: (e: Popup$CloseEvent) => void;
  ref?: Ref<Popup>;
}

/** Instance methods of Popup. */
export interface Popup {
  /** Opens the popup; in ResponsivePopover mode below `oSource` (an element). */
  open(oSource?: Element | null, mSettings?: PopupOpenSettings): void;
  /** Whether the popup is open. */
  isOpen(): boolean;
}

interface PanelEntry { key: string; title: string; element: ReactElement }

export function Popup({ title, mode = 'Dialog', warningText, reset, panels, additionalButtons, onOpen, onClose, ref }: $PopupSettings) {
  const t = useP13nText();
  const [state, setState] = useState<{ settings: PopupOpenSettings; source: Element | null; tab: string | null } | null>(null);
  const [resetEnabled, setResetEnabled] = useState(false);
  const openRef = useRef(false);
  const resets = useRef(new Set<() => void>());
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const entries: PanelEntry[] = [];
  Children.forEach(panels, (child) => {
    if (!isValidElement(child)) return;
    const props = child.props as { title?: string };
    const key = child.key != null ? String(child.key) : `panel${entries.length}`;
    const fallback = PANEL_TITLES.get(child.type as never);
    entries.push({ key, title: props.title ?? (fallback ? t(fallback as never) : key), element: child });
  });
  const first = entries[0]?.key ?? null;
  useImperativeHandle(ref, () => ({
    open: (oSource, mSettings = {}) => {
      openRef.current = true;
      setResetEnabled(Boolean(mSettings.enableReset));
      setState({ settings: mSettings, source: oSource ?? null, tab: mSettings.activePanel ?? null });
      onOpen?.();
    },
    isOpen: () => openRef.current,
  }), [onOpen]);
  // Popup._onClose: closes, then fires close; the panels are still mounted while the handler runs
  const close = useCallback((reason: Popup$CloseReason) => {
    if (!openRef.current) return;
    openRef.current = false;
    onCloseRef.current?.({ reason });
    setState(null);
  }, []);
  const link = useMemo(() => ({
    changed: () => setResetEnabled(true),
    registerReset: (fn: () => void) => { resets.current.add(fn); return () => { resets.current.delete(fn); }; },
  }), []);
  const doReset = () => {
    void MessageBox.warning(warningText ?? '', {
      actions: ['OK', 'CANCEL'], emphasizedAction: 'OK',
      onClose: (a) => {
        if (a !== 'OK') return;
        setResetEnabled(false);
        // Popup._resetPanels, then the callback
        resets.current.forEach((fn) => fn());
        reset?.();
      },
    });
  };
  const opened = state !== null;
  const tab = state?.tab && entries.some((e) => e.key === state.tab) ? state.tab : first;
  const content = entries.length > 1 ? (
    <Tabs value={tab} onChange={(v) => v && setState((s) => (s ? { ...s, tab: v } : s))} keepMounted keepMountedMode="display-none">
      <Tabs.List>
        {entries.map((e) => <Tabs.Tab key={e.key} value={e.key} {...{ [`data-sk-p13n-${e.key}-tab`]: '' }} data-sk-p13n-tab={e.key}>{e.title}</Tabs.Tab>)}
      </Tabs.List>
      {entries.map((e) => <Tabs.Panel key={e.key} value={e.key} className="sk-p13n__panel" data-sk-p13n-panel={e.key}>{e.element}</Tabs.Panel>)}
    </Tabs>
  ) : entries[0] ? <div className="sk-p13n__panel" data-sk-p13n-panel={entries[0].key}>{entries[0].element}</div> : null;
  const header = (
    <Group justify="space-between" wrap="nowrap" className="sk-grow">
      <Title order={2} size="h4">{title}</Title>
      {reset ? <Button size="xs" variant="subtle" disabled={!resetEnabled} onClick={doReset} data-sk-p13n-reset>{t('ctl.p13n.reset')}</Button> : null}
    </Group>
  );
  const onKeyDown = (e: KeyboardEvent) => {
    // Ctrl+Enter confirms (ShortcutHintsMixin on the OK button)
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); close('Ok'); }
  };
  const body = <PopupLinkContext.Provider value={link}>{content}</PopupLinkContext.Provider>;
  if (mode === 'ResponsivePopover') {
    return opened ? <PopoverFrame source={state.source} settings={state.settings} header={header} onClose={close}>{body}</PopoverFrame> : null;
  }
  return (
    <Modal
      opened={opened} onClose={() => close('Escape')} title={header} withCloseButton={false} closeOnClickOutside={false}
      size={state?.settings.contentWidth ?? 'var(--sk-size-p13n-dialog)'} classNames={{ title: 'sk-grow' }} className="sk-p13n-popup" data-sk-p13n-popup
    >
      <div onKeyDown={onKeyDown} style={{ maxHeight: state?.settings.contentHeight }}>
        {body}
        <Group justify="flex-end" className="sk-dialog-footer">
          <Button onClick={() => close('Ok')} data-sk-p13n-ok>{t('ctl.p13n.ok')}</Button>
          <Button variant="default" onClick={() => close('Cancel')} data-sk-p13n-cancel>{t('ctl.p13n.cancel')}</Button>
          {additionalButtons}
        </Group>
      </div>
    </Modal>
  );
}

/** The ResponsivePopover: below the source element, closed by Escape or a click outside ("AutoClose"). */
function PopoverFrame({ source, settings, header, onClose, children }: { source: Element | null; settings: PopupOpenSettings; header: ReactNode; onClose(r: Popup$CloseReason): void; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const rect = source?.getBoundingClientRect();
  useEffect(() => {
    const down = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node) && !source?.contains(e.target as Node)) onClose('AutoClose'); };
    const key = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') onClose('Escape'); };
    document.addEventListener('mousedown', down);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key); };
  }, [onClose, source]);
  return (
    <Portal>
      <Paper
        ref={box} shadow="md" withBorder role="dialog" aria-modal={false} className="sk-p13n-popup sk-p13n-popover" data-sk-p13n-popup
        style={{ position: 'fixed', top: rect ? rect.bottom + 4 : 64, left: rect ? Math.max(8, rect.left) : 64, width: settings.contentWidth ?? 'var(--sk-size-p13n-popover)', maxHeight: settings.contentHeight ?? 'var(--sk-size-p13n-popover-height)', overflow: 'auto', zIndex: 300, padding: 'var(--mantine-spacing-sm)' }}
      >
        <Group mb="xs">{header}</Group>
        {children}
      </Paper>
    </Portal>
  );
}
