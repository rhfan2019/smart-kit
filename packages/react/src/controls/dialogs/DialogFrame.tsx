/** The modal frame shared by the select and settings dialogs: title bar, content, footer; optionally draggable and resizable. */
import { Modal } from '@mantine/core';
import { useRef, useState, type PointerEvent, type ReactNode } from 'react';

/** sap.m.TitleAlignment (not exported from the entry: a shared enum, see the report). */
export type TitleAlignment = 'Auto' | 'Center' | 'None' | 'Start';

export interface DialogFrameProps {
  /** ('Auto') Auto and Start align the title at the start, Center centres it. */
  titleAlignment?: TitleAlignment;
  opened: boolean;
  onClose(): void;
  title: ReactNode;
  /** Extra content of the title bar (e.g. a segmented button or a reset button). */
  headerExtra?: ReactNode;
  /** Content under the title bar that does not scroll (search field, info bar). */
  subHeader?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  contentWidth?: string;
  contentHeight?: string;
  draggable?: boolean;
  resizable?: boolean;
  className?: string;
}

export function DialogFrame(p: DialogFrameProps) {
  const [offset, setOffset] = useState<[number, number]>([0, 0]);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const down = (e: PointerEvent<HTMLElement>) => {
    if (!p.draggable || (e.target as HTMLElement).closest('button, input, [role="radiogroup"]')) return;
    drag.current = { x: e.clientX, y: e.clientY, ox: offset[0], oy: offset[1] };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const move = (e: PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (d) setOffset([d.ox + e.clientX - d.x, d.oy + e.clientY - d.y]);
  };
  const up = () => { drag.current = null; };
  return (
    <Modal.Root opened={p.opened} onClose={p.onClose} size={p.contentWidth ?? 'lg'} centered onExitTransitionEnd={() => setOffset([0, 0])}>
      <Modal.Overlay />
      <Modal.Content
        className={`sk-dialog${p.resizable ? ' sk-dialog--resizable' : ''}${p.className ? ` ${p.className}` : ''}`}
        style={offset[0] || offset[1] ? { transform: `translate(${offset[0]}px, ${offset[1]}px)` } : undefined}
      >
        <Modal.Header className={`sk-dialog__header${p.draggable ? ' sk-dialog__header--draggable' : ''}`} onPointerDown={down} onPointerMove={move} onPointerUp={up}>
          <Modal.Title className={`sk-dialog__title${p.titleAlignment === 'Center' ? ' sk-dialog__title--center' : ''}`}>{p.title}</Modal.Title>
          {p.headerExtra}
          <Modal.CloseButton />
        </Modal.Header>
        {p.subHeader && <div className="sk-dialog__subheader">{p.subHeader}</div>}
        <Modal.Body className="sk-dialog__body" style={p.contentHeight ? { height: p.contentHeight } : undefined}>{p.children}</Modal.Body>
        {p.footer && <div className="sk-dialog__footer">{p.footer}</div>}
      </Modal.Content>
    </Modal.Root>
  );
}
