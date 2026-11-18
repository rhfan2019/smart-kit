/** sap.m.MessageStrip (docs/26 §3.1): an inline information bar above the content it relates to. */
import { CloseButton } from '@mantine/core';
import { useImperativeHandle, useState, type ReactNode, type Ref } from 'react';
import { useControlText } from '../controls/context';
import { toneOf, type MessageType } from '../controls/types';
import { MessageTypeIcon } from './MessageTypeIcon';
import { TEXTS } from './texts';

export interface MessageStrip {
  /** Closes the strip (sap.m.MessageStrip#close); fires onClose. */
  close(): void;
}

export interface $MessageStripSettings {
  text?: string;
  /** UI5 default 'Information'. */
  type?: MessageType;
  /** UI5 default false. */
  showIcon?: boolean;
  /** sap.m.MessageStripColorSet (1.143): 'Default' uses the colours of `type`; ColorSet1 / ColorSet2 use `colorScheme`. */
  colorSet?: 'Default' | 'ColorSet1' | 'ColorSet2';
  /** 1–10, only with ColorSet1 / ColorSet2 (UI5 default 1). */
  colorScheme?: number;
  /** Replaces the icon of the type (only with showIcon). UI5 takes an icon URI; smart-kit takes an element (ADR-032). */
  customIcon?: ReactNode;
  /** UI5 default false. */
  showCloseButton?: boolean;
  /** A link after the text (`link` aggregation). */
  link?: ReactNode;
  /** Links referenced from a formatted text (`controls` aggregation); shown after the text. */
  controls?: ReactNode[];
  /** UI5 parses `text` as limited HTML; smart-kit never parses HTML, so the text stays plain. Use `children` instead. */
  enableFormattedText?: boolean;
  /** Extension: rich content instead of `text`. */
  children?: ReactNode;
  onClose?: () => void;
  ref?: Ref<MessageStrip>;
}

export function MessageStrip(p: $MessageStripSettings) {
  const t = useControlText(TEXTS);
  const [closed, setClosed] = useState(false);
  // 'None' is shown as Information (sap.m.MessageStrip)
  const type = !p.type || p.type === 'None' ? 'Information' : p.type;
  const scheme = Math.min(10, Math.max(1, Math.round(p.colorScheme ?? 1)));
  const set = p.colorSet && p.colorSet !== 'Default' ? ` sk-message-strip--set${p.colorSet.slice(-1)} sk-message-strip--scheme${scheme}` : '';
  const close = () => { setClosed(true); p.onClose?.(); };
  useImperativeHandle(p.ref, () => ({ close }));
  if (closed) return null;
  return (
    <div className={`sk-message-strip sk-message-strip--${toneOf(type)}${set}`} role="note" aria-label={t(`ctl.msg.strip.${type}`)} data-sk-message-strip={type}>
      {p.showIcon ? <span className="sk-message-strip__icon">{p.customIcon ?? <MessageTypeIcon type={type} />}</span> : null}
      <div className="sk-message-strip__text">{p.children ?? p.text}{p.controls?.length ? <> {p.controls.map((c, i) => <span key={i} className="sk-message-strip__control">{c}</span>)}</> : null}{p.link ? <> {p.link}</> : null}</div>
      {p.showCloseButton ? <CloseButton size="sm" className="sk-message-strip__close" aria-label={t('common.close')} onClick={close} /> : null}
    </div>
  );
}
