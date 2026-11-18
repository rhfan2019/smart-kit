/** The icon of a MessageType / ValueState, coloured with the semantic tone (docs/26). */
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { toneOf, type MessageType } from '../controls/types';

export function MessageTypeIcon({ type }: { type: MessageType }) {
  const cls = `sk-icon sk-status--${toneOf(type)}`;
  if (type === 'Error') return <XCircle className={cls} aria-hidden />;
  if (type === 'Warning') return <AlertTriangle className={cls} aria-hidden />;
  if (type === 'Success') return <CheckCircle2 className={cls} aria-hidden />;
  return <Info className={cls} aria-hidden />;
}
