/** OData V4 data provider. See docs/05-data-provider.md §1. */
import type { MetaModel } from '../model/types';
import { resolveEntityPath, type EntityPath } from '../query/entityPath';
import { keyPredicate } from '../query/entityPath';
import { readQueryString, sourceInfo, sourcePath, toQueryString, type QueryRequest, type QueryResult, type QuerySource, type ReadRequest, type Row } from '../query/request';
import { messagesFromHeader } from './messages';
import { ANALYTICAL_COUNT_ALIAS } from '../query/analytical';
import { ANALYTICAL_LEAVES_ALIAS } from '../query/request';
import { buildModel, type BuildModelOptions } from '../model/buildModel';
import { errorFromResponse } from './errors';
import type { DataProvider, FetchLike, RequestOptions, WriteResult } from './provider';
import { readValueListService, resolveValueListReference, serviceRootOf, type ValueListService } from '../model/valueListReferences';

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

  /** Value help services of Common.ValueListReferences by `$metadata` URL (SAPUI5 `mSharedModelByUrl`). */
  private readonly valueListServices = new Map<string, Promise<ValueListService>>();

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    const lang = this.o.getLanguage?.();
    return { Accept: ACCEPT, ...(lang ? { 'Accept-Language': lang } : {}), ...(this.o.headers?.() ?? {}), ...extra };
  }

  /** Builds the full URL of a list request (exposed for diagnostics and tests). */
  queryUrl(req: QueryRequest): string {
    const qs = toQueryString(this.o.model, req);
    return join(this.o.serviceUrl, sourcePath(this.o.model, req.source, req.filters)) + (qs ? `?${qs}` : '');
  }

  /** URL of a `$count` request: `<set>/$count` with only `$filter` and `$search`. */
  countUrl(req: QueryRequest): string {
    const qs = toQueryString(this.o.model, { ...req, select: [], expand: [], orderBy: [], count: false, skip: undefined, top: undefined, analytical: undefined, aggregate: undefined, hierarchy: undefined });
    return `${join(this.o.serviceUrl, sourcePath(this.o.model, req.source, req.filters))}/$count${qs ? `?${qs}` : ''}`;
  }

  async count(req: QueryRequest, opts: RequestOptions = {}): Promise<number> {
    const res = await this.o.fetch(this.countUrl(req), { headers: this.headers({ Accept: 'text/plain' }), signal: opts.signal });
    if (!res.ok) throw await errorFromResponse(res);
    return Number((await res.text()).trim());
  }

  readUrl(path: EntityPath, req: ReadRequest): string {
    const qs = readQueryString(req);
    return join(this.o.serviceUrl, resolveEntityPath(this.o.model, path).canonical) + (qs ? `?${qs}` : '');
  }

  async query(req: QueryRequest, opts: RequestOptions = {}): Promise<QueryResult> {
    const res = await this.o.fetch(this.queryUrl(req), { headers: this.headers(), signal: opts.signal });
    if (!res.ok) throw await errorFromResponse(res);
    const body = JSON.parse(await res.text()) as { value?: Row[]; '@odata.count'?: number | string };
    if (req.analytical) {
      // concat(): the grand total row first, then the row with the number of leaves, then the leaves (AL-10)
      const rows = [...(body.value ?? [])];
      // grouped: the number of leaves comes first (concat(groupby(…)/aggregate($count as UI5__leaves),…))
      const leavesRow = req.analytical.groupLevel ? rows.shift() : undefined;
      const leaves = leavesRow?.[ANALYTICAL_LEAVES_ALIAS];
      const grandTotal = req.analytical.grandTotal.length ? rows.shift() : undefined;
      const countRow = req.count ? rows.shift() : undefined;
      const n = countRow?.[ANALYTICAL_COUNT_ALIAS];
      return { rows, count: n === undefined || n === null ? undefined : Number(n), ...(grandTotal ? { grandTotal } : {}), ...(leaves === undefined || leaves === null ? {} : { leafCount: Number(leaves) }) };
    }
    const count = body['@odata.count'];
    return { rows: body.value ?? [], count: count === undefined ? undefined : Number(count) };
  }

  async read(path: EntityPath, req: ReadRequest, opts: RequestOptions = {}): Promise<Row> {
    const res = await this.o.fetch(this.readUrl(path, req), { headers: this.headers(), signal: opts.signal });
    if (!res.ok) throw await errorFromResponse(res);
    return JSON.parse(await res.text()) as Row;
  }

  private async write(method: string, url: string, body: unknown, opts: RequestOptions & { etag?: string } = {}) {
    const res = await this.o.fetch(url, {
      method,
      headers: this.headers({
        ...(body === undefined ? {} : { 'Content-Type': 'application/json;IEEE754Compatible=true' }),
        ...(method === 'DELETE' ? {} : { Prefer: 'return=representation' }),
        ...(opts.etag ? { 'If-Match': opts.etag } : {}),
      }),
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: opts.signal,
    });
    if (!res.ok) throw await errorFromResponse(res);
    const text = await res.text();
    const row = text ? (JSON.parse(text) as Row) : undefined;
    return { row, etag: (row?.['@odata.etag'] as string | undefined) ?? res.headers.get('ETag') ?? undefined, messages: messagesFromHeader(res.headers.get('sap-messages')) };
  }

  async update(path: EntityPath, patch: Row, opts: RequestOptions & { etag?: string } = {}): Promise<WriteResult> {
    const r = await this.write('PATCH', join(this.o.serviceUrl, resolveEntityPath(this.o.model, path).canonical), patch, opts);
    return { row: r.row ?? {}, etag: r.etag, messages: r.messages };
  }

  async create(target: QuerySource, row: Row, opts: RequestOptions = {}): Promise<WriteResult & { path: EntityPath }> {
    const r = await this.write('POST', join(this.o.serviceUrl, sourcePath(this.o.model, target)), row, opts);
    const created = r.row ?? {};
    const info = sourceInfo(this.o.model, target);
    const path = `${info.entitySet}${keyPredicate(this.o.model.entityTypes[info.typeName]!, created)}`;
    return { row: created, etag: r.etag, messages: r.messages, path };
  }

  async remove(path: EntityPath, opts: RequestOptions & { etag?: string } = {}) {
    const r = await this.write('DELETE', join(this.o.serviceUrl, resolveEntityPath(this.o.model, path).canonical), undefined, opts);
    return { messages: r.messages };
  }

  async invoke(action: string, opts: RequestOptions & { path?: EntityPath; parameters?: Row } = {}) {
    const url = opts.path ? join(this.o.serviceUrl, `${resolveEntityPath(this.o.model, opts.path).canonical}/${action}`) : join(this.o.serviceUrl, action.split('.').pop()!);
    const r = await this.write('POST', url, opts.parameters ?? {}, opts);
    return { row: r.row, messages: r.messages };
  }

  /**
   * The value help service of a Common.ValueListReferences entry: `$metadata` resolved against this service's
   * `$metadata` URL and read with the same headers and language; its data is read by an ODataV4Provider of its own.
   */
  valueListService(reference: string): Promise<ValueListService> {
    const metadataUrl = resolveValueListReference(this.o.serviceUrl, reference);
    let loaded = this.valueListServices.get(metadataUrl);
    if (!loaded) {
      loaded = (async () => {
        const lang = this.o.getLanguage?.();
        const res = await this.o.fetch(metadataUrl, { headers: { Accept: 'application/xml', ...(lang ? { 'Accept-Language': lang } : {}), ...(this.o.headers?.() ?? {}) } });
        if (!res.ok) throw await errorFromResponse(res);
        const metadata = await res.text();
        return readValueListService(reference, metadataUrl, metadata, (model) => new ODataV4Provider({ ...this.o, serviceUrl: serviceRootOf(metadataUrl), model }));
      })();
      loaded.catch(() => this.valueListServices.delete(metadataUrl));
      this.valueListServices.set(metadataUrl, loaded);
    }
    return loaded;
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
