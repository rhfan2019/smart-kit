/** Message model (ADR-023): server messages (error details, `sap-messages` header) and client validation. */
import { ODataError } from './errors';

export type MessageType = 'error' | 'warning' | 'info' | 'success';

export interface Message {
  id: string;
  type: MessageType;
  message: string;
  code?: string;
  /** Property path (relative to the object) or resource path the message is about. */
  target?: string;
  /** Where the message came from; client validation messages are replaced on every validation. */
  source?: 'server' | 'client';
}

const SEVERITY: Record<number, MessageType> = { 1: 'success', 2: 'info', 3: 'warning', 4: 'error' };
let seq = 0;
const nextId = () => `m${++seq}`;

/** Messages of a `sap-messages` response header (a JSON array of { code, message, numericSeverity, target }). */
export function messagesFromHeader(value: string | null | undefined): Message[] {
  if (!value) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return [];
  }
  const list = Array.isArray(parsed) ? parsed : [parsed];
  return list.flatMap((m) => {
    if (!m || typeof m !== 'object') return [];
    const r = m as { code?: string; message?: string; numericSeverity?: number; severity?: string; target?: string };
    if (!r.message) return [];
    const type = SEVERITY[Number(r.numericSeverity)] ?? (r.severity === 'error' || r.severity === 'warning' || r.severity === 'info' || r.severity === 'success' ? r.severity : 'info');
    return [{ id: nextId(), type, message: r.message, code: r.code, target: r.target || undefined, source: 'server' as const }];
  });
}

/** Messages of a failed request: the details when there are any, otherwise the main error. */
export function messagesFromError(e: unknown): Message[] {
  if (e instanceof ODataError) {
    const details = e.details.filter((d) => d.message);
    if (details.length) return details.map((d) => ({ id: nextId(), type: 'error' as const, message: d.message, code: d.code, target: d.target || undefined, source: 'server' as const }));
    return [{ id: nextId(), type: 'error', message: e.message, code: e.code, target: e.target, source: 'server' }];
  }
  return [{ id: nextId(), type: 'error', message: e instanceof Error ? e.message : String(e), source: 'server' }];
}

/** Creates a message (client validation, custom code). */
export function createMessage(type: MessageType, message: string, o: { target?: string; code?: string; source?: Message['source'] } = {}): Message {
  return { id: nextId(), type, message, ...o };
}

/** Most severe type of a list, for the footer message button. */
export function highestSeverity(messages: Message[]): MessageType | undefined {
  for (const t of ['error', 'warning', 'info', 'success'] as const) if (messages.some((m) => m.type === t)) return t;
  return undefined;
}
