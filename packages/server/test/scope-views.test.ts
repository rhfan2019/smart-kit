// Data scope through a collection navigation between views (TECH-054, TECH-055) and Kysely on the host's pool
// (TECH-066), end to end on PostgreSQL: temporary tables and views, `smart-kit` introspection with navigations
// declared in the configuration, the generated CSDL and storage mapping, the service with a scope `_ScopeKeys/any(…)`.
// Skipped when the database is not set up (npm run pg:setup); CI sets SMART_KIT_REQUIRE_PG=1.
import { checkDeclaredNavigations, indexCsdl, introspect, toCsdl, toStorage, type CliConfig, type Queryable } from '@rhfan2019/smart-kit-cli';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createKysely, createODataService, type StorageMapping } from '../src/index';

const DATABASE_URL = process.env.SMART_KIT_DATABASE_URL ?? 'postgresql://smart_kit_app@localhost:5432/smart_kit_purchasing';
// One connection: the temporary tables and views exist only in its session. The host's own setting is Berlin time.
const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 1, options: '-c TimeZone=Europe/Berlin' });
const available = await pool.query('select 1').then(() => true, () => false);
if (!available && process.env.SMART_KIT_REQUIRE_PG === '1') throw new Error('PostgreSQL test database not reachable; run npm run pg:setup');

const SETUP = `
  create temp table invoice (id text primary key, vendor_id text not null, amount numeric(15,2) not null, note text);
  create temp table invoice_order (invoice_id text not null, order_no text not null, company_code text not null, primary key (invoice_id, order_no));
  create temp table invoice_line (invoice_id text not null, line_no int not null, text text, primary key (invoice_id, line_no));
  create temp table vendor (vendor_id text primary key, name text not null);
  create temp view invoice_list as select id, vendor_id, amount, note from invoice;
  create temp view invoice_scope_key as select distinct invoice_id, company_code from invoice_order;
  create temp view invoice_line_list as select invoice_id, line_no, text from invoice_line;
  create temp view vendor_list as select vendor_id, name from vendor;
  insert into vendor values ('V1', 'One'), ('V2', 'Two');
  insert into invoice values ('A', 'V1', 100, null), ('B', 'V1', 200, null), ('C', 'V2', 300, null);
  insert into invoice_order values ('A', 'PO1', '1000'), ('A', 'PO2', '2000'), ('B', 'PO3', '2000'), ('C', 'PO4', '1000');
  insert into invoice_line values ('A', 1, 'a'), ('B', 1, 'b'), ('C', 1, 'c');`;

let schemaName = '';
const config = (): CliConfig => ({
  schema: schemaName,
  namespace: 'Invoicing',
  output: { csdl: 'x', storage: 'y' },
  entities: {
    invoice: { skip: true }, invoice_order: { skip: true }, invoice_line: { skip: true }, vendor: { skip: true },
    invoice_list: { type: 'Invoice', set: 'Invoices', keys: ['Id'] },
    invoice_scope_key: { type: 'InvoiceScopeKey', set: 'InvoiceScopeKeys', keys: ['InvoiceId', 'CompanyCode'] },
    invoice_line_list: { type: 'InvoiceLine', set: 'InvoiceLines', keys: ['InvoiceId', 'LineNo'] },
    vendor_list: { type: 'Vendor', set: 'Vendors', keys: ['VendorId'] },
  },
  navigations: {
    invoice_scope: { from: 'invoice_list', to: 'invoice_scope_key', on: { id: 'invoice_id' }, toMany: '_ScopeKeys' },
    invoice_lines: { from: 'invoice_line_list', to: 'invoice_list', on: { InvoiceId: 'Id' }, toOne: '_Invoice', partner: '_Lines' },
    vendor_invoices: { from: 'vendor_list', to: 'invoice_list', on: { vendor_id: 'vendor_id' }, toMany: '_Invoices', partner: '_Vendor' },
  },
});

describe.skipIf(!available)('scope through a navigation between views (PostgreSQL)', () => {
  let csdl = '';
  let storage: StorageMapping = { entitySets: {} };
  const ROOT = 'http://test/odata/';
  const service = () =>
    createODataService<{ company: string }>({
      basePath: '/odata/',
      metadata: { csdl },
      storage,
      db: createKysely(pool, { statementTimeout: 5000 }),
      context: (r) => ({ company: r.headers.get('x-company') ?? '1000' }),
      scope: (set, c) => (set === 'Invoices' ? `_ScopeKeys/any(k: k/CompanyCode eq '${c.company}')` : undefined),
      entitySets: { Invoices: {} },
    });
  const get = async (path: string, company = '1000') => {
    const r = await service().handle(new Request(ROOT + path, { headers: { Accept: 'application/json', 'x-company': company } }));
    const text = await r.text();
    return { status: r.status, body: text && r.headers.get('content-type')?.includes('json') ? JSON.parse(text) : text };
  };
  const ids = (b: { value: { Id: string }[] }) => b.value.map((x) => x.Id);

  beforeAll(async () => {
    await pool.query(SETUP);
    schemaName = (await pool.query<{ n: string }>('select nspname as n from pg_namespace where oid = pg_my_temp_schema()')).rows[0]!.n;
    const model = await introspect(pool as unknown as Queryable, config());
    expect(model.warnings).toEqual([]);
    csdl = toCsdl(model, 'test');
    storage = toStorage(model) as StorageMapping;
  });
  afterAll(() => pool.end());

  it('generates the declared navigations into $metadata and the storage mapping', async () => {
    expect(csdl).toContain('<NavigationProperty Name="_ScopeKeys" Type="Collection(Invoicing.InvoiceScopeKey)"/>');
    expect(csdl).toContain('<NavigationPropertyBinding Path="_ScopeKeys" Target="InvoiceScopeKeys"/>');
    expect(csdl).toMatch(/<NavigationProperty Name="_Invoice" Type="Invoicing.Invoice" Partner="_Lines">\s*<ReferentialConstraint Property="InvoiceId" ReferencedProperty="Id"\/>/);
    expect(storage.entitySets.Invoices!.navigations).toEqual({ _ScopeKeys: { on: { Id: 'InvoiceId' } }, _Lines: { on: { Id: 'InvoiceId' } }, _Vendor: { on: { VendorId: 'VendorId' } } });
    expect((await get('$metadata')).body).toContain('Name="_ScopeKeys"');
    expect(checkDeclaredNavigations(config(), indexCsdl(csdl), storage)).toEqual([]);
  });

  it('reports declared navigations with missing views or columns', async () => {
    const bad: CliConfig = { ...config(), navigations: { a: { from: 'invoice_list', to: 'nowhere', on: { id: 'x' }, toMany: '_X' }, b: { from: 'invoice_list', to: 'vendor_list', on: { vendor: 'vendor_id' }, toOne: '_Y' } } };
    const model = await introspect(pool as unknown as Queryable, bad);
    expect(model.warnings).toEqual([expect.stringMatching(/navigations\.a: "nowhere" is not an entity/), expect.stringMatching(/navigations\.b: column invoice_list\.vendor does not exist/)]);
    expect(checkDeclaredNavigations(bad, indexCsdl(toCsdl(model, 'test')), toStorage(model)).map((p) => `${p.target}: ${p.message}`)).toEqual([
      expect.stringMatching(/^navigations\.a: "to": table or view 'nowhere' is not an entity/),
      "navigations.b: \"on\": column 'vendor' does not exist in 'invoice_list'",
    ]);
    // a declaration that exists in the configuration but not (yet) in the generated files
    expect(checkDeclaredNavigations(config(), indexCsdl(toCsdl(model, 'test')), toStorage(model)).map((p) => p.message)).toContain("navigation property '_ScopeKeys' of Invoices is not in the generated files (run smart-kit generate)");
  });

  it('reads, counts and addresses only invoices in the scope', async () => {
    expect(ids((await get('Invoices?$orderby=Id')).body)).toEqual(['A', 'C']);
    expect(ids((await get('Invoices?$orderby=Id', '2000')).body)).toEqual(['A', 'B']);
    expect((await get('Invoices/$count')).body).toBe('2');
    expect((await get('Invoices?$count=true&$top=0')).body['@odata.count']).toBe(2);
    expect((await get("Invoices('B')")).status).toBe(404);
    expect((await get("Invoices('A')")).status).toBe(200);
    expect((await get("Invoices('B')/_Lines")).body.value).toEqual([]); // the parent is out of scope: no rows
    expect((await get("Invoices('A')/_Lines")).body.value).toHaveLength(1);
    expect((await get('Invoices?$apply=aggregate($count as N)')).body.value[0].N).toBe(2);
  });

  it('hides out-of-scope invoices from $expand, paths and lambdas of other sets', async () => {
    const vendors = (await get('Vendors?$expand=_Invoices($select=Id;$orderby=Id)&$orderby=VendorId')).body;
    expect(vendors.value.map((v: { _Invoices: { Id: string }[] }) => v._Invoices.map((i) => i.Id))).toEqual([['A'], ['C']]);
    expect((await get("Vendors?$filter=_Invoices/any(i: i/Id eq 'B')")).body.value).toEqual([]);
    expect((await get("Vendors?$filter=_Invoices/any(i: i/Id eq 'B')", '2000')).body.value.map((v: { VendorId: string }) => v.VendorId)).toEqual(['V1']);
    expect((await get('Vendors?$filter=_Invoices/all(i: i/Amount lt 150)&$orderby=VendorId')).body.value.map((v: { VendorId: string }) => v.VendorId)).toEqual(['V1']);
    const lines = (await get('InvoiceLines?$filter=_Invoice/Amount gt 0&$orderby=InvoiceId')).body;
    expect(lines.value.map((l: { InvoiceId: string }) => l.InvoiceId)).toEqual(['A', 'C']);
    const expanded = (await get('InvoiceLines?$expand=_Invoice($select=Id)&$orderby=InvoiceId')).body;
    expect(expanded.value.map((l: { _Invoice: { Id: string } | null }) => l._Invoice?.Id ?? null)).toEqual(['A', null, 'C']);
    // the scope keys themselves can be filtered with any() from the invoices
    expect(ids((await get("Invoices?$filter=_ScopeKeys/any(k: k/CompanyCode eq '2000')", '1000')).body)).toEqual(['A']);
  });

  it('keeps writes inside the scope', async () => {
    const svc = service();
    const patch = (key: string) => svc.handle(new Request(`${ROOT}Invoices('${key}')`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ Note: 'x' }) }));
    expect((await patch('B')).status).toBe(404);
    expect((await patch('A')).status).toBeLessThan(300);
    expect((await pool.query("select note from invoice where id in ('A','B') order by id")).rows).toEqual([{ note: 'x' }, { note: null }]);
  });

  it('createKysely: the service runs in UTC with its statement timeout; the host keeps its own settings', async () => {
    const db = createKysely(pool, { statementTimeout: 1234 });
    const { sql } = await import('kysely');
    const r = await sql<{ tz: string; t: string }>`select current_setting('TimeZone') as tz, current_setting('statement_timeout') as t`.execute(db);
    expect(r.rows[0]).toEqual({ tz: 'UTC', t: '1234ms' });
    const host = await pool.query<{ tz: string }>("select current_setting('TimeZone') as tz");
    expect(host.rows[0]!.tz).toBe('Europe/Berlin');
    await db.destroy(); // does not end the host's pool
    expect((await pool.query('select 1 as one')).rows[0].one).toBe(1);
    const kept = createKysely(pool, { keepSettings: true });
    await sql`select 1`.execute(kept);
    expect((await pool.query<{ tz: string }>("select current_setting('TimeZone') as tz")).rows[0]!.tz).toBe('UTC');
    await pool.query("set TimeZone = 'Europe/Berlin'");
  });
});
