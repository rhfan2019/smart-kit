/** sap.m.BusyDialog: a modal busy indicator that blocks the page; opened and closed through its ref (docs/26 §3.3). */
import { Button, Modal } from '@mantine/core';
import { useImperativeHandle, useRef, useState, type Ref } from 'react';
import { useControlText } from '../context';
import { BusyIndicator, type BusyCustomIconProps } from './BusyIndicator';
import { cx } from './shared';
import { TEXTS } from './texts';

/** sap.m.TitleAlignment (inline union; see the final report on shared enums). */
export type TitleAlignmentValue = 'Auto' | 'Center' | 'None' | 'Start';

export interface $BusyDialogSettings extends BusyCustomIconProps {
  /** Text below the busy indicator. */
  text?: string;
  /** Dialog title. */
  title?: string;
  /** Alignment of the title (Auto: start, as in the Horizon theme). @defaultValue 'Auto' */
  titleAlignment?: TitleAlignmentValue;
  /** Text of the Cancel button (default "Cancel"). */
  cancelButtonText?: string;
  /** Shows a Cancel button; it, and Esc, close the dialog with `cancelPressed: true`. @defaultValue false */
  showCancelButton?: boolean;
  /** Fired when the dialog closes. */
  onClose?(e: BusyDialog$CloseEvent): void;
  ref?: Ref<BusyDialog>;
}

/** Event object of BusyDialog's close. */
export interface BusyDialog$CloseEvent {
  /** The dialog was closed by the Cancel button, Esc or `close(true)`. */
  cancelPressed: boolean;
}

/** Instance methods of BusyDialog. */
export interface BusyDialog {
  open(): void;
  /** Closes the dialog; `isClosedFromUserInteraction` becomes the event's `cancelPressed`. */
  close(isClosedFromUserInteraction?: boolean): void;
}

export function BusyDialog({ text, title, titleAlignment = 'Auto', cancelButtonText, showCancelButton = false, onClose, ref, ...icon }: $BusyDialogSettings) {
  const t = useControlText(TEXTS);
  const [opened, setOpened] = useState(false);
  const openRef = useRef(false);
  const close = (cancelPressed: boolean) => {
    if (!openRef.current) return;
    openRef.current = false;
    setOpened(false);
    onClose?.({ cancelPressed });
  };
  useImperativeHandle(ref, () => ({
    open() { openRef.current = true; setOpened(true); },
    close(fromUser) { close(!!fromUser); },
  }));
  return (
    <Modal
      opened={opened} onClose={() => close(true)} withCloseButton={false} closeOnClickOutside={false} closeOnEscape={showCancelButton} centered
      title={title} classNames={{ body: 'sk-busy-dialog__body', title: cx('sk-busy-dialog__title', titleAlignment === 'Center' && 'sk-busy-dialog__title--center') }}
      data-sk-busy-dialog aria-busy="true"
    >
      <BusyIndicator {...icon} className="sk-busy-dialog__indicator" />
      {text ? <div className="sk-busy-dialog__text" aria-live="polite">{text}</div> : null}
      {showCancelButton ? <Button variant="subtle" onClick={() => close(true)} data-sk-busy-cancel>{cancelButtonText || t('ctl.busyDialog.cancel')}</Button> : null}
    </Modal>
  );
}
