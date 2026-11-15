/** OData error parsing. See docs/05-data-provider.md §5. */

export interface ODataErrorDetail {
  code?: string;
  message: string;
  target?: string;
}

export class ODataError extends Error {
  override name = 'ODataError';
  readonly status: number;
  readonly code?: string;
  readonly target?: string;
  readonly details: ODataErrorDetail[];
  /** 'field' when the error targets a property, otherwise 'page'. */
  readonly scope: 'page' | 'field';

  constructor(init: { status: number; message: string; code?: string; target?: string; details?: ODataErrorDetail[] }) {
    super(init.message);
    this.status = init.status;
    this.code = init.code;
    this.target = init.target;
    this.details = init.details ?? [];
    this.scope = isPropertyTarget(init.target) ? 'field' : 'page';
  }
}

export class ConcurrencyError extends ODataError {
  override name = 'ConcurrencyError';
}

/** A target is a property when its last segment is a plain identifier (e.g. "Price" or "Set('1')/Price"). */
function isPropertyTarget(target: string | undefined): boolean {
  if (!target) return false;
  const last = target.split('/').pop() ?? '';
  return /^[A-Za-z_][\w]*$/.test(last) && !target.startsWith('$');
}

/** Builds an ODataError from a failed HTTP response. */
export async function errorFromResponse(res: { status: number; statusText?: string; text(): Promise<string> }): Promise<ODataError> {
  let body = '';
  try {
    body = await res.text();
  } catch {
    /* ignore */
  }
  let parsed: { error?: { code?: string; message?: string | { value?: string }; target?: string; details?: { code?: string; message?: string; target?: string }[] } } | undefined;
  try {
    parsed = body ? JSON.parse(body) : undefined;
  } catch {
    parsed = undefined;
  }
  const e = parsed?.error;
  const Ctor = res.status === 412 ? ConcurrencyError : ODataError;
  if (e) {
    const message = typeof e.message === 'string' ? e.message : e.message?.value ?? `HTTP ${res.status}`;
    return new Ctor({
      status: res.status,
      code: e.code,
      message,
      target: e.target,
      details: (e.details ?? []).map((d) => ({ code: d.code, message: d.message ?? '', target: d.target })),
    });
  }
  return new Ctor({ status: res.status, code: `HTTP_${res.status}`, message: res.statusText || `HTTP ${res.status}` });
}

export function isAbortError(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { name?: string }).name === 'AbortError';
}
