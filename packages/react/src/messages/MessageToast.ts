/** sap.m.MessageToast (docs/26 §3.1): a short, non-disruptive message that closes by itself. Needs a MessageHost. */
import type { ReactNode } from 'react';
import { messageStore, type Dock } from './messageStore';

export type { Dock };

/** sap.m.MessageToast `show` options (1.154). */
export interface MessageToastOptions {
  /** Milliseconds before the close animation starts (UI5 default 3000). */
  duration?: number;
  /** CSS width (UI5 default 15em; the default comes from the token --sk-toast-width). */
  width?: string;
  /** The point of the toast that is aligned (UI5 default 'CenterBottom'). */
  my?: Dock;
  /** The point of the reference (`of`) the toast is aligned to (UI5 default 'CenterBottom'). */
  at?: Dock;
  /** The reference element (default: the window). */
  of?: Element;
  /** Offset 'x y' in pixels (UI5 default '0 0'). */
  offset?: string;
  /** 'fit', 'flip' or 'none', per axis (UI5 default 'fit fit'); smart-kit always keeps the toast inside the window. */
  collision?: string;
  /** Called after the toast has closed. */
  onClose?: () => void;
  /** Closes as soon as the user touches or clicks the screen (UI5 default true). */
  autoClose?: boolean;
  /** CSS timing function of the close animation (UI5 default 'ease'). */
  animationTimingFunction?: string;
  /** Duration of the close animation in milliseconds (UI5 default 1000). */
  animationDuration?: number;
  /** Accepted and ignored: smart-kit has no router (ADR-010). */
  closeOnBrowserNavigation?: boolean;
}

export const MessageToast = {
  /** Shows `message` as a toast (sap.m.MessageToast.show). */
  show(message: ReactNode, o: MessageToastOptions = {}): void {
    messageStore.addToast({
      id: messageStore.id(), message, duration: Math.max(0, o.duration ?? 3000), width: o.width, my: o.my ?? 'CenterBottom', at: o.at ?? 'CenterBottom', of: o.of,
      offset: o.offset ?? '0 0', collision: o.collision ?? 'fit fit', autoClose: o.autoClose ?? true,
      animationTimingFunction: o.animationTimingFunction ?? 'ease', animationDuration: Math.max(0, o.animationDuration ?? 1000), onClose: o.onClose,
    });
  },
};
