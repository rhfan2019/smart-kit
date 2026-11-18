/**
 * The global queue behind `MessageToast.show` and `MessageBox.*` (docs/26 §3.1). A `MessageHost` (rendered by the
 * SmartKitProvider) subscribes and renders; only the first mounted host renders, so nested providers do not duplicate.
 */
import type { ReactNode } from 'react';

/** sap.ui.core.Popup.Dock */
export type Dock =
  | 'BeginTop' | 'BeginCenter' | 'BeginBottom' | 'CenterTop' | 'CenterCenter' | 'CenterBottom' | 'EndTop' | 'EndCenter' | 'EndBottom'
  | 'LeftTop' | 'LeftCenter' | 'LeftBottom' | 'RightTop' | 'RightCenter' | 'RightBottom';

export interface ToastEntry {
  id: number;
  message: ReactNode;
  duration: number;
  width?: string;
  my: Dock;
  at: Dock;
  of?: Element;
  offset: string;
  collision: string;
  autoClose: boolean;
  animationTimingFunction: string;
  animationDuration: number;
  onClose?: () => void;
}

export interface BoxEntry {
  id: number;
  message: ReactNode;
  title?: string;
  domId?: string;
  icon: string;
  actions: string[];
  emphasizedAction: string | null;
  initialFocus: string | null;
  details?: string | object | (() => Promise<string | object>);
  contentWidth?: string;
  verticalScrolling: boolean;
  horizontalScrolling: boolean;
  resolve(action: string | null): void;
}

interface State { toasts: ToastEntry[]; boxes: BoxEntry[] }

let state: State = { toasts: [], boxes: [] };
let nextId = 1;
const listeners = new Set<() => void>();
const hosts: symbol[] = [];

function emit(next: State) {
  state = next;
  listeners.forEach((l) => l());
}

export const messageStore = {
  subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; },
  get: () => state,
  id: () => nextId++,
  addToast(t: ToastEntry) {
    if (!hosts.length) console.warn('MessageToast.show: no MessageHost is mounted (render <SmartKitProvider> or <MessageHost />).');
    emit({ ...state, toasts: [...state.toasts, t] });
  },
  removeToast(id: number) {
    const t = state.toasts.find((x) => x.id === id);
    if (!t) return;
    emit({ ...state, toasts: state.toasts.filter((x) => x.id !== id) });
    t.onClose?.();
  },
  addBox(b: BoxEntry) {
    if (!hosts.length) console.warn('MessageBox: no MessageHost is mounted (render <SmartKitProvider> or <MessageHost />).');
    emit({ ...state, boxes: [...state.boxes, b] });
  },
  closeBox(id: number, action: string | null) {
    const b = state.boxes.find((x) => x.id === id);
    if (!b) return;
    emit({ ...state, boxes: state.boxes.filter((x) => x.id !== id) });
    b.resolve(action);
  },
  /** Registers a host; returns whether it is the rendering one and an unregister function. */
  register(token: symbol) { hosts.push(token); listeners.forEach((l) => l()); },
  unregister(token: symbol) { const i = hosts.indexOf(token); if (i >= 0) hosts.splice(i, 1); listeners.forEach((l) => l()); },
  isActive: (token: symbol) => hosts[0] === token,
  /** Test helper: drops every pending toast and box. */
  reset() { emit({ toasts: [], boxes: [] }); },
};
