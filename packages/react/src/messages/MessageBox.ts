/** sap.m.MessageBox (docs/26 §3.1): a modal dialog for messages that need a reaction. Needs a MessageHost. */
import type { ReactNode } from 'react';
import { messageStore } from './messageStore';

/** sap.m.MessageBox.Action; a custom action is any other string (shown as the button text). */
export type MessageBoxAction = 'OK' | 'CANCEL' | 'YES' | 'NO' | 'ABORT' | 'RETRY' | 'IGNORE' | 'CLOSE' | 'DELETE';
/** sap.m.MessageBox.Icon */
export type MessageBoxIcon = 'NONE' | 'INFORMATION' | 'WARNING' | 'ERROR' | 'SUCCESS' | 'QUESTION';

const Action = { OK: 'OK', CANCEL: 'CANCEL', YES: 'YES', NO: 'NO', ABORT: 'ABORT', RETRY: 'RETRY', IGNORE: 'IGNORE', CLOSE: 'CLOSE', DELETE: 'DELETE' } as const;
const Icon = { NONE: 'NONE', INFORMATION: 'INFORMATION', WARNING: 'WARNING', ERROR: 'ERROR', SUCCESS: 'SUCCESS', QUESTION: 'QUESTION' } as const;

/** Options of `MessageBox.show` and the shortcuts (sap.m.MessageBox mOptions, 1.154). */
export interface MessageBoxOptions {
  /** Only `show`: the icon (default NONE; INFORMATION when `details` is set). */
  icon?: MessageBoxIcon;
  /** Dialog title; the shortcuts default to a title per type ("Alert", "Confirmation", "Error" …). */
  title?: string;
  /** One action or an array: MessageBox.Action values or custom texts. A single (non-array) action is emphasized. */
  actions?: Array<MessageBoxAction | (string & {})> | MessageBoxAction | (string & {});
  /** The emphasized action; the shortcuts emphasize OK only when `actions` is not given. null for none. */
  emphasizedAction?: MessageBoxAction | (string & {}) | null;
  /** Called with the pressed action, or null when the box was closed with Escape. */
  onClose?: (action: MessageBoxAction | (string & {}) | null) => void;
  /** Id of the dialog element. */
  id?: string;
  /** The action (or button text) whose button gets the initial focus. */
  initialFocus?: MessageBoxAction | (string & {}) | null;
  /** Shown after "View Details": a string, an object (as JSON) or a function returning a promise of one. */
  details?: string | object | (() => Promise<string | object>);
  /** CSS width of the dialog content. */
  contentWidth?: string;
  /** Scrolling of the content (UI5 default true for both). */
  verticalScrolling?: boolean;
  horizontalScrolling?: boolean;
  /** Accepted and ignored: smart-kit has no router (ADR-010) and no dependent-control lifecycle. */
  closeOnNavigation?: boolean;
  dependentOn?: unknown;
  /** Accepted and ignored (ADR-032 rule 7). */
  styleClass?: string;
  textDirection?: string;
}

type ActionName = MessageBoxAction | (string & {});
type Result = Promise<ActionName | null>;
interface Defaults { title?: string; icon: MessageBoxIcon; actions: ActionName | ActionName[] | undefined; emphasizedAction?: ActionName | null; isShow?: boolean }

/** The option normalisation of sap.m.MessageBox.show (1.154 source), on already merged options. */
function open(message: ReactNode, o: MessageBoxOptions, d: Defaults): Result {
  let icon = o.icon ?? d.icon;
  let actions: ActionName | ActionName[] | undefined = o.actions ?? d.actions;
  let emphasized: ActionName | null | undefined = 'emphasizedAction' in o ? o.emphasizedAction : d.emphasizedAction;
  if (d.isShow && 'details' in o && o.details !== undefined) {
    // show() with details: INFORMATION, OK + CANCEL, OK emphasized (unless given)
    if (o.icon === undefined) icon = Icon.INFORMATION;
    if (o.actions === undefined) actions = [Action.OK, Action.CANCEL];
    if (!('emphasizedAction' in o)) emphasized = Action.OK;
  }
  if (actions !== undefined && !Array.isArray(actions)) {
    if (emphasized !== null) emphasized = actions;
    actions = [actions];
  }
  if (!actions || !actions.length) { emphasized = Action.OK; actions = [Action.OK]; }
  return new Promise((resolve) => {
    messageStore.addBox({
      id: messageStore.id(), domId: o.id, message, title: o.title ?? d.title, icon, actions: actions as string[],
      emphasizedAction: emphasized ?? null, initialFocus: o.initialFocus ?? null, contentWidth: o.contentWidth,
      verticalScrolling: o.verticalScrolling ?? true, horizontalScrolling: o.horizontalScrolling ?? true, details: o.details,
      resolve: (a) => { o.onClose?.(a); resolve(a); },
    });
  });
}

/** Default title keys of the shortcuts, resolved by the host (texts follow the SmartKitProvider locale). */
export const TITLE = { alert: '@alert', confirm: '@confirm', error: '@error', information: '@information', warning: '@warning', success: '@success' } as const;

/** Shortcut defaults: OK is emphasized only when the caller gives no actions (sap.m.MessageBox 1.154). */
const shortcut = (o: MessageBoxOptions, title: string, icon: MessageBoxIcon, actions: ActionName | ActionName[], emphasized: ActionName | null): Defaults =>
  ({ title, icon, actions, emphasizedAction: emphasized === null ? null : o.actions ? null : emphasized });

/**
 * sap.m.MessageBox. Every method returns a promise of the pressed action (extension: UI5 returns nothing and only calls
 * `onClose`).
 */
export const MessageBox = {
  Action,
  Icon,
  /** A message box with the given options (defaults: no title, no icon, OK). */
  show: (message: ReactNode, o: MessageBoxOptions = {}): Result => open(message, o, { icon: Icon.NONE, actions: o.actions as ActionName, isShow: true } as Defaults),
  alert: (message: ReactNode, o: MessageBoxOptions = {}): Result => open(message, o, shortcut(o, TITLE.alert, Icon.NONE, Action.OK, Action.OK)),
  confirm: (message: ReactNode, o: MessageBoxOptions = {}): Result => open(message, o, shortcut(o, TITLE.confirm, Icon.QUESTION, [Action.OK, Action.CANCEL], Action.OK)),
  error: (message: ReactNode, o: MessageBoxOptions = {}): Result => open(message, o, shortcut(o, TITLE.error, Icon.ERROR, Action.CLOSE, null)),
  information: (message: ReactNode, o: MessageBoxOptions = {}): Result => open(message, o, shortcut(o, TITLE.information, Icon.INFORMATION, Action.OK, Action.OK)),
  warning: (message: ReactNode, o: MessageBoxOptions = {}): Result => open(message, o, shortcut(o, TITLE.warning, Icon.WARNING, Action.OK, Action.OK)),
  success: (message: ReactNode, o: MessageBoxOptions = {}): Result => open(message, o, shortcut(o, TITLE.success, Icon.SUCCESS, Action.OK, Action.OK)),
};
