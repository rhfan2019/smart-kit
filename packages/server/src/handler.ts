// The service: a Web-standard Request -> Response handler (Node, Next.js route handlers, Hono, Express via ./node).
import { buildModel, type MetaModel } from '@rhfan2019/smart-kit-core';
import type { Kysely } from 'kysely';
import { badRequest, errorBody, notFound, notImplemented, ODataServerError } from './errors';
import { etagOf, formatGroup, formatRow, type FormatOptions } from './format';
import { MetadataDocuments, type MetadataSource } from './metadata';
import { parseQueryOptions, parseResourcePath } from './parser/url';
import { Planner, type CollectionPlan, type ScopeFunction } from './plan';
import { buildSchema, type ServiceSchema, type StorageMapping } from './schema';
import { SqlBuilder } from './sql';

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
   * Data scope (permissions) per entity set: an OData $filter over the set's own properties, or undefined for no
   * restriction. Applied wherever the set is read: the addressed set, parents in the path, $expand, navigation paths
   * in $filter and $orderby, $apply. Rows outside the scope do not exist for the request (404 for a key).
   */
  scope?: ScopeFunction<C>;
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

  async function run(request: Request, url: URL): Promise<Response> {
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
    if (rel === '$batch') throw notImplemented('$batch is not supported; send single requests.');

    const { segments, count } = parseResourcePath(rel.split('/').filter((s, i, all) => s !== '' || i < all.length - 1));
    if (!segments.length) throw notFound(`No resource at ${url.pathname}`);
    const query = url.search.startsWith('?') ? url.search.slice(1) : url.search;
    const o = parseQueryOptions(query);
    const ctx = (await options.context?.(request)) as C;
    const planner = new Planner<C>({ schema, maxPageSize, searchFields: options.searchFields, scope: options.scope, context: ctx });
    const target = planner.resolvePath(segments);
    const builder = new SqlBuilder(schema, (s) => planner.scope(s));
    const fmt: FormatOptions = { ieee754, serviceRoot: `${url.origin}${basePath}` };
    const exec = async (q: ReturnType<SqlBuilder['collection']>) => (await q.execute(options.db)).rows as Record<string, unknown>[];

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
      const plan = planner.aggregate(target.set, o, target.parent);
      const rows = await exec(builder.aggregate(plan));
      return json(200, { '@odata.context': `$metadata#${target.set.name}`, value: rows.map((r) => formatGroup(plan, r, fmt)) }, ieee754);
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

  return {
    schema,
    model,
    metadata: (lang?: string) => docs.xml(lang ?? docs.language(null)),
    async handle(request: Request): Promise<Response> {
      const ieee754 = /IEEE754Compatible=true/i.test(request.headers.get('accept') ?? '');
      try {
        const url = new URL(request.url);
        if (!url.pathname.startsWith(basePath) && `${url.pathname}/` !== basePath) throw notFound(`No resource at ${url.pathname}`);
        if (request.method !== 'GET' && request.method !== 'HEAD')
          throw notImplemented(`${request.method} is not supported: this service is read-only (writes, actions and drafts are not implemented yet).`);
        if (`${url.pathname}/` === basePath) return Response.redirect(`${url.origin}${basePath}${url.search}`, 307);
        return await run(request, url);
      } catch (e) {
        if (e instanceof ODataServerError) return json(e.status, errorBody(e), ieee754);
        options.onError?.(e, request);
        const err = new ODataServerError(500, 'InternalError', 'The service could not process the request.');
        return json(500, errorBody(err), ieee754);
      }
    },
  };
}
