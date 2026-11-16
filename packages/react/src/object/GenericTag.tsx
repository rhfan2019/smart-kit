/** Generic tag (OP Message Handling): a KPI or situation with a status colour, e.g. in the header key information. */
import { CriticalityIcon } from '../field/SmartField';

const STATUS = ['neutral', 'negative', 'critical', 'positive', 'neutral', 'info'];

export interface GenericTagProps {
  text: string;
  /** Optional value shown after the text (KPI). */
  value?: string;
  /** Criticality 0 neutral, 1 negative, 2 critical, 3 positive, 5 information. */
  status?: number;
  onPress?(): void;
}

export function GenericTag(p: GenericTagProps) {
  const cls = ['sk-generic-tag', `sk-generic-tag--${STATUS[p.status ?? 0] ?? 'neutral'}`].join(' ');
  const body = (
    <>
      {p.status ? <CriticalityIcon criticality={p.status} /> : null}
      <span className="sk-generic-tag__text">{p.text}</span>
      {p.value ? <span className="sk-generic-tag__value">{p.value}</span> : null}
    </>
  );
  return p.onPress ? (
    <button type="button" className={cls} onClick={p.onPress} data-sk-generic-tag>{body}</button>
  ) : (
    <span className={cls} role="status" data-sk-generic-tag>{body}</span>
  );
}
