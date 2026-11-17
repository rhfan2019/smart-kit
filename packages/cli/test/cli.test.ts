import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import { describe, expect, it } from 'vitest';
import { checkAnnotations, checkDeclaredNavigations, indexCsdl, introspect, loadConfig, pascal, plural, toCsdl, toStorage, type Queryable } from '../src/index';

const APP = join(import.meta.dirname, '../../../apps/pg-server');

describe('naming', () => {
  it('turns tables and columns into PascalCase names, sets into plurals', () => {
    expect(pascal('purchase_order_item')).toBe('PurchaseOrderItem');
    expect(pascal('logo_url')).toBe('LogoUrl');
    expect(plural('OrderStatus')).toBe('OrderStatuses');
    expect(plural('Category')).toBe('Categories');
    expect(plural('Plant')).toBe('Plants');
  });
});

/** A fake pg_catalog: two tables, order (PK id) and order_line (PK order_id + line_no, FK to order). */
function fakeDb(): Queryable {
  const tables = [
    { oid: 1, name: 'sales_order', comment: 'Sales order', kind: 'r' },
    { oid: 2, name: 'order_line', comment: null, kind: 'r' },
    { oid: 3, name: 'audit_log', comment: null, kind: 'r' },
  ];
  const varchar = (n: number) => n + 4;
  const columns = [
    { oid: 1, name: 'order_id', num: 1, notnull: true, typname: 'varchar', typmod: varchar(10), comment: 'Order' },
    { oid: 1, name: 'net_amount', num: 2, notnull: true, typname: 'numeric', typmod: ((15 << 16) | 2) + 4, comment: 'Net Amount' },
    { oid: 1, name: 'created_at', num: 3, notnull: false, typname: 'timestamptz', typmod: 0, comment: null, generated: 's' },
    { oid: 1, name: 'payload', num: 4, notnull: false, typname: 'jsonb', typmod: -1, comment: null },
    { oid: 2, name: 'order_id', num: 1, notnull: true, typname: 'varchar', typmod: varchar(10), comment: null },
    { oid: 2, name: 'line_no', num: 2, notnull: true, typname: 'int4', typmod: -1, comment: 'Line' },
    { oid: 2, name: 'quantity', num: 3, notnull: true, typname: 'numeric', typmod: -1, comment: null },
    { oid: 3, name: 'text', num: 1, notnull: false, typname: 'text', typmod: -1, comment: null },
  ];
  const constraints = [
    { name: 'sales_order_pkey', type: 'p', rel: 1, frel: 0, key: [1], fkey: null, fschema: null },
    { name: 'order_line_pkey', type: 'p', rel: 2, frel: 0, key: [1, 2], fkey: null, fschema: null },
    { name: 'order_line_order_fk', type: 'f', rel: 2, frel: 1, key: [1], fkey: [1], fschema: 'sales' },
  ];
  return {
    async query<R>(text: string) {
      const rows = text.includes('pg_constraint') ? constraints : text.includes('pg_attribute') ? columns : tables;
      return { rows: rows as R[] };
    },
  };
}

describe('introspection -> CSDL', () => {
  const config = { schema: 'sales', namespace: 'Sales', output: { csdl: 'x', storage: 'y' } };

  it('maps tables, keys, types, comments and foreign keys', async () => {
    const m = await introspect(fakeDb(), config);
    expect(m.entities.map((e) => [e.table, e.type, e.set, e.keys])).toEqual([
      ['sales_order', 'SalesOrder', 'SalesOrders', ['OrderId']],
      ['order_line', 'OrderLine', 'OrderLines', ['OrderId', 'LineNo']],
    ]);
    expect(m.warnings.join('\n')).toMatch(/payload: type jsonb is not supported/);
    expect(m.warnings.join('\n')).toMatch(/audit_log: no primary key/);
    const order = m.entities[0]!;
    expect(order.properties.find((p) => p.name === 'NetAmount')).toMatchObject({ edmType: 'Edm.Decimal', precision: 15, scale: 2, nullable: false, label: 'Net Amount' });
    expect(order.properties.find((p) => p.name === 'CreatedAt')).toMatchObject({ edmType: 'Edm.DateTimeOffset', precision: 0, nullable: true });
    // the foreign key is part of the line's key: a composition, so the order gets the collection too
    expect(order.navigations).toEqual([{ name: '_OrderLine', targetType: 'OrderLine', targetSet: 'OrderLines', collection: true, nullable: false, partner: '_Order' }]);
    expect(m.entities[1]!.navigations[0]).toMatchObject({ name: '_Order', collection: false, constraints: [{ property: 'OrderId', referencedProperty: 'OrderId' }] });

    const xml = toCsdl(m, 'test');
    expect(xml).toContain('<Property Name="NetAmount" Type="Edm.Decimal" Nullable="false" Precision="15" Scale="2"/>');
    expect(xml).toContain('<Property Name="Quantity" Type="Edm.Decimal" Nullable="false" Scale="variable"/>');
    expect(xml).toContain('<NavigationProperty Name="_OrderLine" Type="Collection(Sales.OrderLine)" Partner="_Order"/>');
    expect(xml).toContain('<NavigationPropertyBinding Path="_OrderLine" Target="OrderLines"/>');
    expect(xml).toContain('<Annotations Target="Sales.SalesOrder/NetAmount"><Annotation Term="Common.Label" String="Net Amount"/></Annotations>');
    // a generated column is computed by the database
    expect(order.properties.find((p) => p.name === 'CreatedAt')?.computed).toBe(true);
    expect(xml).toContain('<Annotations Target="Sales.SalesOrder/CreatedAt"><Annotation Term="Core.Computed" Bool="true"/></Annotations>');
    expect(toStorage(m).entitySets.OrderLines).toEqual({ table: 'sales.order_line', columns: { OrderId: 'order_id', LineNo: 'line_no', Quantity: 'quantity' } });
  });

  it('applies the configuration (names, types, navigations)', async () => {
    const m = await introspect(fakeDb(), {
      ...config,
      entities: { sales_order: { set: 'Orders', properties: { net_amount: { name: 'Amount' } } }, order_line: { type: 'Line' } },
      navigations: { order_line_order_fk: { toOne: '_Header', toMany: '_Lines' } },
    });
    expect(m.entities[0]).toMatchObject({ set: 'Orders', navigations: [{ name: '_Lines', targetType: 'Line' }] });
    expect(m.entities[0]!.properties.map((p) => p.name)).toContain('Amount');
    expect(m.entities[1]!.navigations[0]).toMatchObject({ name: '_Header', targetSet: 'Orders', partner: '_Lines' });
  });
});

describe('navigations declared in the configuration (views, TECH-055)', () => {
  /** Two views without foreign keys: user_list (id) and user_role_list (user_id, role_id). */
  const viewsDb = (): Queryable => {
    const tables = [
      { oid: 1, name: 'user_list', comment: null, kind: 'v' },
      { oid: 2, name: 'user_role_list', comment: null, kind: 'v' },
    ];
    const columns = [
      { oid: 1, name: 'id', num: 1, notnull: false, typname: 'text', typmod: -1, comment: null },
      { oid: 1, name: 'name', num: 2, notnull: false, typname: 'text', typmod: -1, comment: null },
      { oid: 2, name: 'user_id', num: 1, notnull: false, typname: 'text', typmod: -1, comment: null },
      { oid: 2, name: 'role_id', num: 2, notnull: false, typname: 'text', typmod: -1, comment: null },
    ];
    return { async query<R>(text: string) { return { rows: (text.includes('pg_constraint') ? [] : text.includes('pg_attribute') ? columns : tables) as R[] }; } };
  };
  const config = {
    schema: 'app', namespace: 'App', output: { csdl: 'x', storage: 'y' },
    entities: { user_list: { set: 'Users', keys: ['Id'] }, user_role_list: { set: 'UserRoles', keys: ['UserId', 'RoleId'] } },
    navigations: { user_roles: { from: 'user_list', to: 'user_role_list', on: { Id: 'user_id' }, toMany: '_Roles', partner: '_User' } },
  };

  it('generates the navigation, its partner and the join in the storage mapping', async () => {
    const m = await introspect(viewsDb(), config);
    expect(m.warnings).toEqual([]);
    const xml = toCsdl(m, 'test');
    expect(xml).toContain('<NavigationProperty Name="_Roles" Type="Collection(App.UserRoleList)" Partner="_User"/>');
    expect(xml).toMatch(/<NavigationProperty Name="_User" Type="App.UserList" Partner="_Roles">\s*<ReferentialConstraint Property="UserId" ReferencedProperty="Id"\/>/);
    expect(xml).toContain('<NavigationPropertyBinding Path="_Roles" Target="UserRoles"/>');
    const storage = toStorage(m);
    expect(storage.entitySets.Users).toMatchObject({ navigations: { _Roles: { on: { Id: 'UserId' } } } });
    expect(storage.entitySets.UserRoles).toMatchObject({ navigations: { _User: { on: { UserId: 'Id' } } } });
    expect(checkDeclaredNavigations(config, indexCsdl(xml), storage)).toEqual([]);
  });

  it('warns about and reports missing views and columns; refuses incomplete declarations', async () => {
    const bad = { ...config, navigations: { user_roles: { ...config.navigations.user_roles, on: { id: 'usr' } }, gone: { from: 'nobody', to: 'user_list', on: { a: 'id' }, toOne: '_X' } } };
    const m = await introspect(viewsDb(), bad);
    expect(m.warnings).toEqual([expect.stringMatching(/navigations\.user_roles: column user_role_list\.usr does not exist/), expect.stringMatching(/navigations\.gone: "nobody" is not an entity/)]);
    expect(checkDeclaredNavigations(bad, indexCsdl(toCsdl(m, 'test')), toStorage(m), 'smart-kit.config.json').map((p) => `${p.file} ${p.target}: ${p.message}`)).toEqual([
      "smart-kit.config.json navigations.user_roles: \"on\": column 'usr' does not exist in 'user_role_list'",
      expect.stringMatching(/^smart-kit\.config\.json navigations\.gone: "from": table or view 'nobody' is not an entity/),
    ]);
    const dir = mkdtempSync(join(tmpdir(), 'smart-kit-cli-'));
    const write = (nav: unknown) => {
      writeFileSync(join(dir, 'c.json'), JSON.stringify({ ...config, navigations: { n: nav } }));
      return () => loadConfig(join(dir, 'c.json'));
    };
    expect(write({ from: 'a', to: 'b', on: { x: 'y' } })).toThrow(/exactly one of "toOne" and "toMany"/);
    expect(write({ from: 'a', to: 'b', on: {}, toMany: '_B' })).toThrow(/needs "on"/);
    expect(write({ from: 'a', on: { x: 'y' }, toMany: '_B' })).toThrow(/needs "from" and "to"/);
    expect(write({ from: 'a', to: 'b', on: { x: 'y' }, toMany: '_B' })().navigations?.n).toMatchObject({ toMany: '_B' });
  });
});

describe('missing annotation file', () => {
  it('is reported as a problem, not thrown (a new project runs generate before writing it)', async () => {
    const { check } = await import('../src/index');
    const csdl = readFileSync(join(APP, 'generated/purchasing.csdl.xml'), 'utf8');
    const config = { ...loadConfig(join(APP, 'smart-kit.config.json')), annotations: ['annotations/does-not-exist.xml'] };
    expect(check(config, csdl)).toEqual([expect.objectContaining({ target: '(file)', message: expect.stringMatching(/not found/) })]);
  });
});

describe('annotation check', () => {
  const csdl = readFileSync(join(APP, 'generated/purchasing.csdl.xml'), 'utf8');
  const index = indexCsdl(csdl);
  const file = (body: string) => [{ name: 'a.xml', xml: `<edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx"><edmx:DataServices><Schema Namespace="Purchasing.Annotations" xmlns="http://docs.oasis-open.org/odata/ns/edm">${body}</Schema></edmx:DataServices></edmx:Edmx>` }];

  it('passes the annotation file of the PostgreSQL service', () => {
    expect(checkAnnotations(index, [{ name: 'purchasing', xml: readFileSync(join(APP, 'annotations/purchasing.annotations.xml'), 'utf8') }])).toEqual([]);
  });

  it('reports targets and paths that no longer exist', () => {
    const problems = checkAnnotations(index, file(`
      <Annotations Target="Purchasing.PurchaseOrder/Gone"><Annotation Term="Common.Label" String="x"/></Annotations>
      <Annotations Target="Purchasing.Vanished"><Annotation Term="Common.Label" String="x"/></Annotations>
      <Annotations Target="Purchasing.Container/Nope"><Annotation Term="Capabilities.SearchRestrictions"/></Annotations>
      <Annotations Target="Purchasing.PurchaseOrder">
        <Annotation Term="UI.LineItem"><Collection>
          <Record Type="UI.DataField"><PropertyValue Property="Value" Path="NetAmount"/></Record>
          <Record Type="UI.DataField"><PropertyValue Property="Value" Path="_Supplier/Missing"/></Record>
          <Record Type="UI.DataFieldForAnnotation"><PropertyValue Property="Target" AnnotationPath="_Nowhere/@UI.DataPoint#X"/></Record>
        </Collection></Annotation>
      </Annotations>
      <Annotations Target="Purchasing.PurchaseOrder/Supplier">
        <Annotation Term="Common.ValueList"><Record Type="Common.ValueListType">
          <PropertyValue Property="CollectionPath" String="Supplierz"/>
        </Record></Annotation>
        <Annotation Term="Common.ValueList" Qualifier="B"><Record Type="Common.ValueListType">
          <PropertyValue Property="CollectionPath" String="Suppliers"/>
          <PropertyValue Property="Parameters"><Collection>
            <Record Type="Common.ValueListParameterInOut"><PropertyValue Property="LocalDataProperty" PropertyPath="Supplier"/><PropertyValue Property="ValueListProperty" String="SupplierNo"/></Record>
          </Collection></PropertyValue>
        </Record></Annotation>
      </Annotations>`));
    expect(problems.map((p) => `${p.target}: ${p.message}`)).toEqual([
      "Purchasing.PurchaseOrder/Gone: 'Gone' does not exist on Purchasing.PurchaseOrder",
      "Purchasing.Vanished: 'Purchasing.Vanished' is neither an entity type, the entity container nor an operation of Purchasing",
      "Purchasing.Container/Nope: entity set 'Nope' does not exist",
      "Purchasing.PurchaseOrder: Path '_Supplier/Missing' does not exist on Purchasing.PurchaseOrder",
      "Purchasing.PurchaseOrder: AnnotationPath '_Nowhere' does not exist on Purchasing.PurchaseOrder",
      "Purchasing.PurchaseOrder/Supplier: ValueList CollectionPath 'Supplierz' is not an entity set",
      "Purchasing.PurchaseOrder/Supplier: ValueListProperty: 'SupplierNo' does not exist on Purchasing.Supplier",
    ]);
  });
});

// Against the real database (skipped when it is not set up): the committed generated files are up to date,
// and generating twice gives the same bytes.
const url = process.env.SMART_KIT_DATABASE_URL ?? 'postgresql://smart_kit_reader@localhost:5432/smart_kit_purchasing';
const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 2000 });
const available = await client.connect().then(() => true, () => false);
// CI sets SMART_KIT_REQUIRE_PG=1: there a missing database is a failure, not a skip.
if (!available && process.env.SMART_KIT_REQUIRE_PG === '1') throw new Error(`PostgreSQL test database not reachable (${process.env.SMART_KIT_DATABASE_URL ?? 'default URL'}); run npm run pg:setup`);

describe.skipIf(!available)('generate against PostgreSQL', () => {
  it('reproduces the committed CSDL and storage mapping', async () => {
    const config = loadConfig(join(APP, 'smart-kit.config.json'));
    const model = await introspect(client as unknown as Queryable, config);
    await client.end();
    expect(model.warnings).toEqual([]);
    expect(toCsdl(model, `PostgreSQL schema ${config.schema}`)).toBe(readFileSync(join(APP, 'generated/purchasing.csdl.xml'), 'utf8'));
    expect(`${JSON.stringify(toStorage(model), null, 2)}\n`).toBe(readFileSync(join(APP, 'generated/purchasing.storage.json'), 'utf8'));
  });
});
