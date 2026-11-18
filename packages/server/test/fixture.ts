// The purchasing service of apps/pg-server (generated CSDL, hand-written annotations, storage mapping) for unit
// tests, and a Kysely instance that compiles SQL without a database.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildModel } from '@rhfan2019/smart-kit-core';
import { DummyDriver, Kysely, PostgresAdapter, PostgresIntrospector, PostgresQueryCompiler } from 'kysely';
import { buildSchema, MetadataDocuments, parseQueryOptions, parseResourcePath, Planner, SqlBuilder, type ScopeFunction, type StorageMapping } from '../src/index';

const APP = join(import.meta.dirname, '../../../apps/pg-server');
const read = (rel: string) => readFileSync(join(APP, rel), 'utf8');
export const labels = (lang: string) => JSON.parse(readFileSync(join(APP, `../mock/Csdl/labels.${lang}.json`), 'utf8')) as Record<string, string>;

export const metadataSource = () => ({
  csdl: read('generated/purchasing.csdl.xml'),
  annotations: [read('annotations/purchasing.annotations.xml')],
  labels: { en: labels('en'), zh: labels('zh') },
});
export const storage = () => JSON.parse(read('generated/purchasing.storage.json')) as StorageMapping;

const docs = new MetadataDocuments(metadataSource());
export const schema = buildSchema(buildModel(docs.modelXml()), storage());

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const compileDb = new Kysely<any>({
  dialect: {
    createAdapter: () => new PostgresAdapter(),
    createDriver: () => new DummyDriver(),
    createIntrospector: (db) => new PostgresIntrospector(db),
    createQueryCompiler: () => new PostgresQueryCompiler(),
  },
});

/** Plans and compiles a request ("PurchaseOrders", "$filter=…") the way the handler does. */
export function compile(path: string, query = '', o: { scope?: ScopeFunction<undefined>; maxPageSize?: number } = {}) {
  const planner = new Planner<undefined>({ schema, maxPageSize: o.maxPageSize ?? 1000, scope: o.scope, context: undefined, searchFields: { PurchaseOrders: ['PurchaseOrder', 'Description', '_Supplier/SupplierName'] } });
  const target = planner.resolvePath(parseResourcePath(path.split('/')).segments);
  const opts = parseQueryOptions(query);
  const b = new SqlBuilder(schema, (s) => planner.scope(s));
  const q = opts.apply
    ? b.aggregate(planner.aggregate(target.set, opts, target.parent))
    : b.collection(planner.collection(target.set, opts, { key: target.key, parent: target.parent, single: target.single }));
  return q.compile(compileDb) as { sql: string; parameters: readonly unknown[] };
}

/** The SQL of each part of a $apply request (concat() branches, Planner.apply). */
export function compileApply(path: string, query: string) {
  const planner = new Planner<undefined>({ schema, maxPageSize: 1000, context: undefined, searchFields: { PurchaseOrders: ['PurchaseOrder', 'Description', '_Supplier/SupplierName'] } });
  const target = planner.resolvePath(parseResourcePath(path.split('/')).segments);
  const b = new SqlBuilder(schema, (s) => planner.scope(s));
  return planner.apply(target.set, parseQueryOptions(query), target.parent).map((part) => ({
    kind: part.kind,
    ...(part.kind === 'count' ? { alias: part.alias } : {}),
    ...(b[part.kind === 'count' ? 'countGroups' : 'aggregate'](part.plan).compile(compileDb) as { sql: string; parameters: readonly unknown[] }),
  }));
}
