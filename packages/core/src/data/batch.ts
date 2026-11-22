/** Several writes at once: one `$batch` when the provider has it, one request after another otherwise. */
import { ODataError } from './errors';
import type { BatchOperation, BatchResult, DataProvider, RequestOptions } from './provider';

/** The error of the operations of a change set that were not the one that failed. */
export class RolledBackError extends ODataError {
  override name = 'RolledBackError';
  constructor(message = 'Nothing was saved: another change of the same request failed.') {
    super({ status: 424, code: 'ROLLED_BACK', message });
  }
}

async function single(provider: DataProvider, op: BatchOperation, opts: RequestOptions): Promise<BatchResult> {
  try {
    switch (op.kind) {
      case 'update': {
        const r = await provider.update!(op.path, op.patch, { ...opts, etag: op.etag });
        return { ok: true, row: r.row, etag: r.etag, messages: r.messages };
      }
      case 'create': {
        const r = await provider.create!(op.target, op.row, opts);
        return { ok: true, row: r.row, etag: r.etag, path: r.path, messages: r.messages };
      }
      case 'remove': {
        const r = await provider.remove!(op.path, { ...opts, etag: op.etag });
        return { ok: true, messages: r.messages };
      }
      case 'invoke': {
        const r = await provider.invoke!(op.action, { ...opts, path: op.path, parameters: op.parameters });
        return { ok: true, row: r.row, messages: r.messages };
      }
    }
  } catch (error) {
    return { ok: false, error };
  }
}

/**
 * Runs the writes and reports each outcome, in order; never rejects for a failed operation.
 *
 * With a provider that has `batch` and more than one operation: one request. `atomic` then means all or nothing (one
 * change set). Without `batch` the operations are sent one after another: `atomic` cannot be kept then, so the
 * operations stop at the first failure (what was written before it stays).
 */
export async function writeAll(provider: DataProvider, operations: BatchOperation[], opts: RequestOptions & { atomic?: boolean } = {}): Promise<BatchResult[]> {
  if (!operations.length) return [];
  const { atomic, ...request } = opts;
  if (provider.batch && operations.length > 1) {
    try {
      return await provider.batch(operations, opts);
    } catch (error) {
      return operations.map(() => ({ ok: false, error }));
    }
  }
  const out: BatchResult[] = [];
  let stopped = false;
  for (const op of operations) {
    if (stopped) {
      out.push({ ok: false, error: new RolledBackError('Not sent: an earlier change of the same request failed.') });
      continue;
    }
    const r = await single(provider, op, request);
    out.push(r);
    if (!r.ok && atomic) stopped = true;
  }
  return out;
}
