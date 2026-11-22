// The service: a Web-standard Request -> Response handler (Node, Next.js route handlers, Hono, Express via ./node).
import { buildModel, type MetaModel } from '@rhfan2019/smart-kit-core';
import type { Kysely } from 'kysely';
import { badRequest, errorBody, notFound, notImplemented, ODataServerError } from './errors';
import { etagOf, formatGroup, formatRow, type FormatOptions } from './format';
import { boundActions, MetadataDocuments, type MetadataSource } from './metadata';
import { parseQueryOptions, parseResourcePath } from './parser/url';
import { Planner, type CollectionPlan, type ScopeFunction } from './plan';
import { buildSchema, type ServiceSchema, type StorageMapping } from './schema';
import { SqlBuilder } from './sql';
import { Writer, type ActionHandler, type EntitySetHooks } from './write';

export interface ODataServiceOptions<C = undefined> {
  /** URL path of the service root, e.g. "/odata/purchasing/" (requests outside it get 404). */
  basePath: string;
  metadata: MetadataSource;
  /** Tables and columns of the entity sets (the *.storage.json file of `smart-kit generate`). */
  storage?: StorageMapping;
  /** Kysely on PostgreSQL (dialect `PostgresDialect` with a `pg` pool). */
  db: Kysely<any>; // eslint-disable-line @typescript-eslint/no-explicit-any -- tables are known only at run time
  /** Most rows per response; more rows are reached through @odata.nextLink (default 1000). */
  maxPageSize?: number;
  /** $search: property paths searched per entity set (default: the string properties of the entity type). */
  searchFields?: Record<string, string[]>;
  /** Per-request context (the user, the tenant …), passed to `scope`. */
  context?: (request: Request) => C | Promise<C>;
  /**
   * Data scope (permissions) per entity set: an OData $filter over the set's own properties and any() / all() over
   * its collection navigations (e.g. `_ScopeKeys/any(k: k/CompanyCode eq '1000')`), or undefined for no restriction.
   * Applied wherever the set is read: the addressed set, $count, parents in the path, $expand, navigation paths and
   * lambda operators in $filter and $orderby, $apply, and the reads of writes. Rows outside the scope do not exist
   * for the request (404 for a key). Navigations inside a scope condition see all rows of their targets.
   */
  scope?: ScopeFunction<C>;
  /**
   * The entity sets that accept writes, with their business rules: which properties a POST / PATCH may set, and hooks
   * before and after create, update and delete (numbers, defaults, totals, validation). An entity set not listed here
   * is read-only (405); a listed one (`{}` for no rules) is writable as far as its Capabilities Insert-, Update- and
   * DeleteRestrictions allow.
   */
  entitySets?: Record<string, EntitySetHooks<C>>;
  /** Bound actions by qualified name ("Purchasing.approve"); they must be declared in $metadata (annotation file). */
  actions?: Record<string, ActionHandler<C>>;
  /**
   * Called for every entity written to a read or write response (also expanded entities and the objects of grouped
   * paths in $apply), with the language of the request: e.g. language-dependent texts of code lists. Changes only
   * what is returned; filters and sorting still see the stored values.
   */
  afterRead?: (e: { entitySet: string; row: Record<string, unknown>; language: string; context: C }) => void;
  /**
   * Whether the request may touch the entity set it addresses: throw an `ODataServerError` (403) to refuse. Called once
   * for every request, also for each request inside a `$batch`, after the path is resolved and before anything is
   * read or written: `entitySet` is the set the path ends at (the items for `Orders('1')/_Items`). Entity sets reached
   * through `$expand`, navigation paths in `$filter` and value helps are not announced here: restrict those with `scope`.
   */
  authorize?: (e: { context: C; request: Request; entitySet: string; operation: 'read' | 'create' | 'update' | 'delete' | 'action'; action?: string }) => void | Promise<void>;
  /**
   * The unit of work of a write: called once per write request and once per change set (atomicity group) of a
   * `$batch`, instead of a transaction the service starts itself on `db`. The host begins its own transaction, calls
   * `work` with a Kysely instance that runs on that transaction's connection (`createKyselyOnClient`), and commits
   * when `work` resolves or rolls back when it rejects. With it the unmanaged `create` / `update` / `delete`
   * implementations, the action handlers and the service's own statements are one transaction, whatever database
   * library the host writes with.
   */
  unitOfWork?: <T>(e: { context: C; request: Request }, work: (db: Kysely<any>) => Promise<T>) => Promise<T>; // eslint-disable-line @typescript-eslint/no-explicit-any
  /** Refuse every write with 501, whatever the annotations say (default false). */
  readOnly?: boolean;
  /** Called for 5xx errors (logging). */
  onError?: (error: unknown, request: Request) => void;
}

export interface ODataService {
  handle(request: Request): Promise<Response>;
  readonly schema: ServiceSchema;
  readonly model: MetaModel;
  /** $metadata of a language. */
  metadata(lang?: string): string;
}

const JSON_TYPE = 'application/json;odata.metadata=minimal';

type Db = Kysely<any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** What a request inside a `$batch` shares with the batch: the context, and the transaction of its change set. */
interface Shared<C> {
  context: C;
  trx?: Db;
}

/** One request of a JSON `$batch` (OData 4.01 JSON format, 19.1). */
interface BatchRequest {
  id: string;
  method: string;
  url: string;
  atomicityGroup?: string;
  headers?: Record<string, string>;
  body?: unknown;
}

function json(status: number, body: unknown, ieee754: boolean, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': `${JSON_TYPE}${ieee754 ? ';IEEE754Compatible=true' : ''}`, 'OData-Version': '4.0', ...headers },
  });
}

/** Creates the OData service. Throws when $metadata and the storage mapping do not fit together. */
export function createODataService<C = undefined>(options: ODataServiceOptions<C>): ODataService {
  const docs = new MetadataDocuments(options.metadata);
  const model = buildModel(docs.modelXml());
  const schema = buildSchema(model, options.storage);
  const basePath = options.basePath.endsWith('/') ? options.basePath : `${options.basePath}/`;
  const maxPageSize = options.maxPageSize ?? 1000;

  async function run(request: Request, url: URL, shared?: Shared<C>): Promise<Response> {
    const ieee754 = /IEEE754Compatible=true/i.test(request.headers.get('accept') ?? '');
    const rel = url.pathname.slice(basePath.length);
    if (rel === '$metadata') {
      if (/^(json|application\/json)/i.test(url.searchParams.get('$format') ?? '')) throw notImplemented('$metadata is served as XML only.');
      const lang = docs.language(request.headers.get('accept-language'));
      return new Response(docs.xml(lang), { status: 200, headers: { 'Content-Type': 'application/xml;charset=utf-8', 'OData-Version': '4.0', ...(lang ? { 'Content-Language': lang } : {}) } });
    }
    if (rel === '' || rel === '/') {
      const value = Object.keys(schema.entitySets).map((name) => ({ name, kind: 'EntitySet', url: name }));
      return json(200, { '@odata.context': `${basePath}$metadata`, value }, ieee754);
    }
    if (rel === '$batch') throw new ODataServerError(405, 'MethodNotAllowed', '$batch is sent with POST.');

    const { segments, count } = parseResourcePath(rel.split('/').filter((s, i, all) => s !== '' || i < all.length - 1));
    if (!segments.length) throw notFound(`No resource at ${url.pathname}`);
    const query = url.search.startsWith('?') ? url.search.slice(1) : url.search;
    const o = parseQueryOptions(query);
    const ctx = shared ? shared.context : ((await options.context?.(request)) as C);
    const planner = new Planner<C>({ schema, maxPageSize, searchFields: options.searchFields, scope: options.scope, context: ctx });
    const target = planner.resolvePath(segments);
    await options.authorize?.({ context: ctx, request, entitySet: target.set.name, operation: 'read' });
    const builder = new SqlBuilder(schema, (s) => planner.scope(s));
    const language = docs.language(request.headers.get('accept-language'));
    const fmt: FormatOptions = { ieee754, serviceRoot: `${url.origin}${basePath}`, entitySets: schema.entitySets, afterRead: options.afterRead && ((entitySet, row) => options.afterRead!({ entitySet, row, language, context: ctx })) };
    const db = shared?.trx ?? options.db;
    const exec = async (q: ReturnType<SqlBuilder['collection']>) => (await q.execute(db)).rows as Record<string, unknown>[];

    if (count) {
      if (target.single) throw badRequest('InvalidPath', '/$count needs a collection.');
      const caps = target.set.capabilities;
      if (!caps.countable) throw badRequest('CountNotSupported', `Entity set '${target.set.name}' is not countable (Capabilities.CountRestrictions/Countable is false).`);
      const plan = planner.collection(target.set, { filter: o.filter, search: o.search }, { parent: target.parent });
      const [row] = await exec(builder.count(plan));
      return new Response(String(row?.count ?? 0), { status: 200, headers: { 'Content-Type': 'text/plain', 'OData-Version': '4.0' } });
    }

    if (o.apply) {
      if (target.single) throw badRequest('InvalidPath', '$apply needs a collection.');
      const parts = planner.apply(target.set, o, target.parent);
      const body: Record<string, unknown> = { '@odata.context': `$metadata#${target.set.name}` };
      const value: Record<string, unknown>[] = [];
      for (const part of parts) {
        if (part.kind === 'count') {
          // concat(aggregate($count as UI5__count),…) of the analytical table: one row with the number of groups
          const [row] = await exec(builder.countGroups(part.plan));
          const n = String(row?.count ?? '0');
          value.push({ [part.alias]: ieee754 ? n : Number(n) }); // Edm.Int64
          continue;
        }
        const rows = await exec(builder.aggregate(part.plan));
        if (parts.length === 1 && part.plan.count) body['@odata.count'] = rows.length ? Number(rows[0]!['@count']) : 0;
        value.push(...rows.map((r) => formatGroup(part.plan, r, fmt)));
      }
      body.value = value;
      return json(200, body, ieee754);
    }

    if (target.single) {
      if (o.top !== undefined || o.skip !== undefined || o.orderBy || o.filter || o.search || o.count)
        throw badRequest('InvalidQuery', '$top, $skip, $orderby, $filter, $search and $count apply to collections only.');
      const plan = planner.collection(target.set, o, { key: target.key, parent: target.parent, single: true });
      const rows = await exec(builder.collection({ ...plan, top: 1 }));
      if (!rows[0]) throw notFound(`${decodeURIComponent(url.pathname.slice(basePath.length))} not found.`);
      const body = { '@odata.context': `$metadata#${target.set.name}/$entity`, ...formatRow(plan, rows[0], fmt, true) };
      const etag = plan.set.etag ? rows[0][plan.set.etag] : undefined;
      return json(200, body, ieee754, etag === undefined || etag === null ? {} : { ETag: etagOf(etag) });
    }

    const plan: CollectionPlan = planner.collection(target.set, o, { parent: target.parent });
    let rows = await exec(builder.collection(plan));
    let nextLink: string | undefined;
    if (plan.pageSize && plan.top !== undefined && rows.length > plan.top) {
      rows = rows.slice(0, plan.top);
      const next = new URL(url);
      const params = query.split('&').filter((p) => p && !/^(\$|%24)(skip|top)=/i.test(p));
      params.push(`$skip=${plan.skip + plan.top}`);
      if (o.top !== undefined) params.push(`$top=${o.top - plan.top}`);
      next.search = `?${params.join('&')}`;
      nextLink = next.toString();
    }
    let total: number | undefined;
    if (plan.count) total = rows.length ? Number(rows[0]!['@count']) : Number((await exec(new SqlBuilder(schema, (s) => planner.scope(s)).count(plan)))[0]?.count ?? 0);
    const body: Record<string, unknown> = { '@odata.context': `$metadata#${target.set.name}` };
    if (total !== undefined) body['@odata.count'] = total;
    body.value = rows.map((r) => formatRow(plan, r, fmt, true));
    if (nextLink) body['@odata.nextLink'] = nextLink;
    return json(200, body, ieee754);
  }

  const declaredActions = boundActions(docs.merged);

  async function write(request: Request, url: URL, shared?: Shared<C>): Promise<Response> {
    const ieee754 = /IEEE754Compatible=true/i.test(request.headers.get('accept') ?? '') || /IEEE754Compatible=true/i.test(request.headers.get('content-type') ?? '');
    const rel = url.pathname.slice(basePath.length);
    if (rel === '$batch') {
      if (shared) throw badRequest('InvalidBatch', 'A $batch cannot contain another $batch.');
      if (request.method !== 'POST') throw new ODataServerError(405, 'MethodNotAllowed', '$batch is sent with POST.');
      return batch(request, url);
    }
    if (rel === '' || rel === '/' || rel === '$metadata') throw new ODataServerError(405, 'MethodNotAllowed', `${request.method} is not allowed on ${url.pathname}.`);
    if (request.method === 'PUT') throw notImplemented('PUT is not supported; change entities with PATCH.');
    const raw = rel.split('/').filter((s, i, all) => s !== '' || i < all.length - 1);
    let action: string | undefined;
    const last = decodeURIComponent(raw[raw.length - 1] ?? '');
    if (raw.length > 1 && /^[A-Za-z_][\w]*(\.[A-Za-z_]\w*)+$/.test(last)) {
      action = last;
      raw.pop();
    }
    const { segments, count } = parseResourcePath(raw);
    if (!segments.length || count) throw notFound(`No resource at ${url.pathname}`);
    const ctx = shared ? shared.context : ((await options.context?.(request)) as C);
    const planner = new Planner<C>({ schema, maxPageSize, searchFields: options.searchFields, scope: options.scope, context: ctx });
    const target = planner.resolvePath(segments);
    const operation = action ? 'action' : request.method === 'POST' ? 'create' : request.method === 'DELETE' ? 'delete' : 'update';
    if (request.method !== 'POST' && request.method !== 'PATCH' && request.method !== 'MERGE' && request.method !== 'DELETE') throw notImplemented(`${request.method} is not supported.`);
    await options.authorize?.({ context: ctx, request, entitySet: target.set.name, operation, ...(action ? { action } : {}) });
    // one transaction per request; inside a change set, the transaction of the change set
    const trx = shared?.trx;
    const transact = <T,>(fn: (db: Db) => Promise<T>): Promise<T> =>
      trx ? fn(trx) : options.unitOfWork ? options.unitOfWork({ context: ctx, request }, fn) : options.db.transaction().execute(fn);
    const readDb = trx ?? options.db;
    const text = await request.text();
    let body: unknown;
    if (text.trim()) {
      try {
        body = JSON.parse(text);
      } catch {
        throw badRequest('InvalidBody', 'The request body is not valid JSON.');
      }
    }
    const language = docs.language(request.headers.get('accept-language')) || (request.headers.get('accept-language') ?? '').split(/[-,;]/)[0]!.trim() || 'en';
    const writer = new Writer<C>({ schema, hooks: options.entitySets ?? {}, actions: options.actions ?? {}, declaredActions, planner: () => planner, transact, context: ctx, request, language });
    const fmt: FormatOptions = { ieee754, serviceRoot: `${url.origin}${basePath}`, entitySets: schema.entitySets, afterRead: options.afterRead && ((entitySet, row) => options.afterRead!({ entitySet, row, language, context: ctx })) };
    const label = decodeURIComponent(rel);
    const minimal = /return=minimal/i.test(request.headers.get('prefer') ?? '');
    const headers = (extra: Record<string, string> = {}) => {
      const h: Record<string, string> = { ...extra };
      const m = writer.sapMessages();
      if (m) h['sap-messages'] = m;
      return h;
    };
    const entityResponse = async (status: number, key: Record<string, unknown>, extra: Record<string, string> = {}) => {
      const row = await writer.read(readDb, target.set, key, fmt);
      if (!row) throw notFound(`${label} not found.`);
      const etag = row['@odata.etag'] as string | undefined;
      const h = headers({ ...extra, ...(etag ? { ETag: etag } : {}) });
      if (minimal) return new Response(null, { status: 204, headers: { 'OData-Version': '4.0', ...h } });
      return json(status, { '@odata.context': `$metadata#${target.set.name}/$entity`, ...row }, ieee754, h);
    };
    const keyOnly = () => {
      if (!target.single || !target.key) throw badRequest('InvalidPath', `${request.method} needs a single entity addressed by its key.`);
      return target.key;
    };

    if (request.method === 'POST' && action) return entityResponse(200, await writer.action(readDb, target.set, keyOnly(), action, body, label));
    if (request.method === 'POST') {
      if (target.single) throw new ODataServerError(405, 'MethodNotAllowed', `POST to a single ${target.set.name} entity is not supported.`);
      const parent = target.parent ? { set: target.parent.set, key: target.parent.key, join: target.parent.navigation.join! } : undefined;
      const key = await writer.create(readDb, target.set, body, parent);
      return entityResponse(201, key, { Location: writer.location(fmt.serviceRoot, target.set, key) });
    }
    if (request.method === 'PATCH' || request.method === 'MERGE') return entityResponse(200, await writer.update(readDb, target.set, keyOnly(), body, label));
    if (request.method === 'DELETE') {
      await writer.remove(readDb, target.set, keyOnly(), label);
      return new Response(null, { status: 204, headers: { 'OData-Version': '4.0', ...headers() } });
    }
    throw notImplemented(`${request.method} is not supported.`);
  }

  /** An error as the response it becomes (5xx that are not OData errors are reported to `onError`). */
  function errorResponse(e: unknown, request: Request, ieee754: boolean): Response {
    if (e instanceof ODataServerError) return json(e.status, errorBody(e), ieee754);
    options.onError?.(e, request);
    return json(500, errorBody(new ODataServerError(500, 'InternalError', 'The service could not process the request.')), ieee754);
  }

  /**
   * `$batch` in the JSON format (OData 4.01): `{ "requests": [{ id, method, url, headers?, body?, atomicityGroup? }] }`,
   * answered with `{ "responses": [{ id, status, headers, body? }] }` in the order of the requests. Requests with the
   * same `atomicityGroup` are a change set: one transaction; when one of them fails nothing of the group is written
   * and the group gets a single response (`atomicityGroup`, and `id` of the request that failed). A URL may start with
   * `$<id>` of an earlier request that created an entity. Without `Prefer: continue-on-error` the first failed
   * request ends the batch.
   */
  async function batch(request: Request, url: URL): Promise<Response> {
    const ieee754 = /IEEE754Compatible=true/i.test(request.headers.get('accept') ?? '');
    if (!/^application\/json/i.test(request.headers.get('content-type') ?? ''))
      throw new ODataServerError(415, 'UnsupportedMediaType', '$batch accepts the JSON format only (Content-Type: application/json), not multipart/mixed.');
    let parsed: unknown;
    try {
      parsed = JSON.parse(await request.text());
    } catch {
      throw badRequest('InvalidBody', 'The request body is not valid JSON.');
    }
    const list = (parsed as { requests?: unknown } | null)?.requests;
    if (!Array.isArray(list)) throw badRequest('InvalidBatch', 'A $batch body is an object with a "requests" array.');
    const requests = list as BatchRequest[];
    const ids = new Set<string>();
    const closed = new Set<string>();
    requests.forEach((r, i) => {
      if (!r || typeof r !== 'object' || typeof r.id !== 'string' || !r.id || typeof r.method !== 'string' || typeof r.url !== 'string') throw badRequest('InvalidBatch', `Request ${i + 1} of the batch needs "id", "method" and "url".`);
      if (ids.has(r.id)) throw badRequest('InvalidBatch', `The request id '${r.id}' is used twice.`);
      ids.add(r.id);
      const g = r.atomicityGroup;
      if (g !== undefined && typeof g !== 'string') throw badRequest('InvalidBatch', `Request '${r.id}': "atomicityGroup" is a string.`);
      const previous = requests[i - 1]?.atomicityGroup;
      if (previous !== undefined && previous !== g) closed.add(previous);
      if (g !== undefined && closed.has(g)) throw badRequest('InvalidBatch', `The requests of atomicity group '${g}' must follow one another.`);
      if (g !== undefined && r.method.toUpperCase() === 'GET') throw badRequest('InvalidBatch', `Request '${r.id}': a GET cannot be part of an atomicity group.`);
    });
    const context = (await options.context?.(request)) as C;
    const continueOnError = /(^|[\s,;])(odata\.)?continue-on-error(?!\s*=\s*false)/i.test(request.headers.get('prefer') ?? '');
    /** Entities created in this batch, by request id: their path below the service root. */
    const created = new Map<string, string>();

    const subRequest = (r: BatchRequest): { request: Request; url: URL } => {
      const rel = r.url.replace(/^\$(?!batch\b|metadata\b)([^/?]+)/, (_all, id: string) => {
        const path = created.get(id);
        if (!path) throw badRequest('InvalidReference', `Request '${r.id}' refers to '$${id}', which is not an entity created earlier in this batch.`);
        return path;
      });
      const target = rel.startsWith('/') ? new URL(rel, url.origin) : new URL(rel, `${url.origin}${basePath}`);
      if (target.origin !== url.origin || !target.pathname.startsWith(basePath)) throw badRequest('InvalidBatch', `Request '${r.id}': the URL is outside this service.`);
      const headers = new Headers(request.headers);
      for (const h of ['content-type', 'content-length', 'prefer', 'if-match', 'if-none-match']) headers.delete(h);
      for (const [k, v] of Object.entries(r.headers ?? {})) headers.set(k, String(v));
      const method = r.method.toUpperCase();
      const body = r.body === undefined || r.body === null || method === 'GET' || method === 'DELETE' ? undefined : typeof r.body === 'string' ? r.body : JSON.stringify(r.body);
      if (body !== undefined && !headers.has('content-type')) headers.set('content-type', 'application/json');
      return { request: new Request(target, { method, headers, body }), url: target };
    };
    const entry = async (r: BatchRequest, res: Response) => {
      const headers: Record<string, string> = {};
      res.headers.forEach((v, k) => (headers[k] = v));
      const location = res.headers.get('location');
      if (res.status === 201 && location) created.set(r.id, decodeURIComponent(new URL(location).pathname.slice(basePath.length)));
      const text = await res.text();
      const isJson = /json/i.test(res.headers.get('content-type') ?? '');
      return { id: r.id, ...(r.atomicityGroup === undefined ? {} : { atomicityGroup: r.atomicityGroup }), status: res.status, headers, ...(text ? { body: isJson ? (JSON.parse(text) as unknown) : text } : {}) };
    };

    const responses: unknown[] = [];
    for (let i = 0; i < requests.length; ) {
      const first = requests[i]!;
      let failed = false;
      if (first.atomicityGroup === undefined) {
        i++;
        let res: Response;
        try {
          const sub = subRequest(first);
          if (options.readOnly && sub.request.method !== 'GET') throw notImplemented(`${sub.request.method} is not supported: this service is read-only.`);
          res = sub.request.method === 'GET' ? await run(sub.request, sub.url, { context }) : await write(sub.request, sub.url, { context });
        } catch (e) {
          res = errorResponse(e, request, ieee754);
        }
        failed = res.status >= 400;
        responses.push(await entry(first, res));
      } else {
        const group: BatchRequest[] = [];
        while (i < requests.length && requests[i]!.atomicityGroup === first.atomicityGroup) group.push(requests[i++]!);
        let at = group[0]!;
        const work = async (trx: Db) => {
          const out: unknown[] = [];
          for (const r of group) {
            at = r;
            const sub = subRequest(r);
            out.push(await entry(r, await write(sub.request, sub.url, { context, trx })));
          }
          return out;
        };
        try {
          if (options.readOnly) throw notImplemented('Writes are not supported: this service is read-only.');
          responses.push(...(await (options.unitOfWork ? options.unitOfWork({ context, request }, work) : options.db.transaction().execute(work))));
        } catch (e) {
          failed = true;
          for (const r of group) created.delete(r.id);
          const res = errorResponse(e, request, ieee754);
          responses.push({ ...(await entry({ ...at, id: at.id }, res)), atomicityGroup: first.atomicityGroup });
        }
      }
      if (failed && !continueOnError) break;
    }
    return json(200, { responses }, ieee754);
  }

  return {
    schema,
    model,
    metadata: (lang?: string) => docs.xml(lang ?? docs.language(null)),
    async handle(request: Request): Promise<Response> {
      const ieee754 = /IEEE754Compatible=true/i.test(request.headers.get('accept') ?? '');
      try {
        const url = new URL(request.url);
        if (!url.pathname.startsWith(basePath) && `${url.pathname}/` !== basePath) throw notFound(`No resource at ${url.pathname}`);
        if (`${url.pathname}/` === basePath) return Response.redirect(`${url.origin}${basePath}${url.search}`, 307);
        if (request.method === 'GET' || request.method === 'HEAD') return await run(request, url);
        // a read-only service still answers a $batch of reads (the writes in it get 501 one by one)
        if (options.readOnly && url.pathname.slice(basePath.length) !== '$batch') throw notImplemented(`${request.method} is not supported: this service is read-only.`);
        return await write(request, url);
      } catch (e) {
        return errorResponse(e, request, ieee754);
      }
    },
  };
}
