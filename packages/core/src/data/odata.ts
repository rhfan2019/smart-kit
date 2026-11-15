/** OData V4 data provider. See docs/05-data-provider.md §1. */
import type { MetaModel } from '../model/types';
import { resolveEntityPath, type EntityPath } from '../query/entityPath';
import { readQueryString, sourcePath, toQueryString, type QueryRequest, type QueryResult, type ReadRequest, type Row } from '../query/request';
import { buildModel, type BuildModelOptions } from '../model/buildModel';
import { errorFromResponse } from './errors';
import type { DataProvider, FetchLike, RequestOptions } from './provider';

export interface ODataV4ProviderOptions {
  /** Service root, ending with "/". */
  serviceUrl: string;
  model: MetaModel;
  fetch: FetchLike;
  /** Current UI language for Accept-Language ("zh", "en", …). */
  getLanguage?: () => string;
  /** Extra headers added to every request (e.g. a CSRF token). */
  headers?: () => Record<string, string>;
}

const ACCEPT = 'application/json;odata.metadata=minimal;IEEE754Compatible=true';

function join(root: string, rel: string): string {
  return root.endsWith('/') ? root + rel : `${root}/${rel}`;
}

export class ODataV4Provider implements DataProvider {
  constructor(private readonly o: ODataV4ProviderOptions) {}

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    const lang = this.o.getLanguage?.();
    return { Accept: ACCEPT, ...(lang ? { 'Accept-Language': lang } : {}), ...(this.o.headers?.() ?? {}), ...extra };
  }

  /** Builds the full URL of a list request (exposed for diagnostics and tests). */
  queryUrl(req: QueryRequest): string {
    const qs = toQueryString(this.o.model, req);
    return join(this.o.serviceUrl, sourcePath(this.o.model, req.source)) + (qs ? `?${qs}` : '');
  }

  readUrl(path: EntityPath, req: ReadRequest): string {
    const qs = readQueryString(req);
    return join(this.o.serviceUrl, resolveEntityPath(this.o.model, path).canonical) + (qs ? `?${qs}` : '');
  }

  async query(req: QueryRequest, opts: RequestOptions = {}): Promise<QueryResult> {
    const res = await this.o.fetch(this.queryUrl(req), { headers: this.headers(), signal: opts.signal });
    if (!res.ok) throw await errorFromResponse(res);
    const body = JSON.parse(await res.text()) as { value?: Row[]; '@odata.count'?: number | string };
    const count = body['@odata.count'];
    return { rows: body.value ?? [], count: count === undefined ? undefined : Number(count) };
  }

  async read(path: EntityPath, req: ReadRequest, opts: RequestOptions = {}): Promise<Row> {
    const res = await this.o.fetch(this.readUrl(path, req), { headers: this.headers(), signal: opts.signal });
    if (!res.ok) throw await errorFromResponse(res);
    return JSON.parse(await res.text()) as Row;
  }

  async update(path: EntityPath, patch: Row, opts: RequestOptions & { etag?: string }): Promise<{ row: Row; etag?: string }> {
    const url = join(this.o.serviceUrl, resolveEntityPath(this.o.model, path).canonical);
    const res = await this.o.fetch(url, {
      method: 'PATCH',
      headers: this.headers({ 'Content-Type': 'application/json;IEEE754Compatible=true', Prefer: 'return=representation', ...(opts.etag ? { 'If-Match': opts.etag } : {}) }),
      body: JSON.stringify(patch),
      signal: opts.signal,
    });
    if (!res.ok) throw await errorFromResponse(res);
    const text = await res.text();
    const row = text ? (JSON.parse(text) as Row) : {};
    return { row, etag: (row['@odata.etag'] as string | undefined) ?? res.headers.get('ETag') ?? undefined };
  }

  /** Generic JSON request against the service (used by the variant store). */
  async request<T>(method: string, rel: string, body?: unknown, extraHeaders: Record<string, string> = {}): Promise<T | undefined> {
    const res = await this.o.fetch(join(this.o.serviceUrl, rel), {
      method,
      headers: this.headers({ ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...extraHeaders }),
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) throw await errorFromResponse(res);
    const text = await res.text();
    return text ? (JSON.parse(text) as T) : undefined;
  }
}

export interface LoadServiceOptions extends BuildModelOptions {
  serviceUrl: string;
  fetch: FetchLike;
  language?: string;
  /** Annotation files as URLs (fetched) — in addition to `annotationFiles` given as text or objects. */
  annotationUrls?: string[];
}

/** Fetches $metadata (and annotation files), builds the model and returns it with a provider. */
export async function loadService(o: LoadServiceOptions): Promise<{ model: MetaModel; provider: ODataV4Provider }> {
  const headers = { Accept: 'application/xml', ...(o.language ? { 'Accept-Language': o.language } : {}) };
  const get = async (url: string) => {
    const res = await o.fetch(url, { headers });
    if (!res.ok) throw await errorFromResponse(res);
    return res.text();
  };
  const [metadata, ...files] = await Promise.all([get(join(o.serviceUrl, '$metadata')), ...(o.annotationUrls ?? []).map(get)]);
  const model = buildModel(metadata!, { annotationFiles: [...files, ...(o.annotationFiles ?? [])], overlay: o.overlay });
  return { model, provider: new ODataV4Provider({ serviceUrl: o.serviceUrl, model, fetch: o.fetch, getLanguage: o.language ? () => o.language! : undefined }) };
}
