// Reads tables, columns, primary keys, foreign keys and comments of one PostgreSQL schema from pg_catalog and turns
// them into the entity model: table -> entity type, primary key -> key, foreign key -> navigation property,
// column comment -> Common.Label (ADR-027).
import type { CliConfig } from './config';
import { pascal, plural, type GenEntity, type GenModel, type GenProperty } from './model';

/** Anything with pg's `query(text, values)`: a pg.Client or pg.Pool. */
export interface Queryable {
  query<R = Record<string, unknown>>(text: string, values?: unknown[]): Promise<{ rows: R[] }>;
}

interface TableRow { oid: number; name: string; comment: string | null; kind: string }
interface ColumnRow { oid: number; name: string; num: number; notnull: boolean; typname: string; typmod: number; comment: string | null }
interface ConstraintRow { name: string; type: 'p' | 'f'; rel: number; frel: number; key: number[]; fkey: number[] | null; fschema: string | null }

const TABLES = `
  select c.oid::int as oid, c.relname as name, obj_description(c.oid, 'pg_class') as comment, c.relkind::text as kind
  from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = $1 and c.relkind in ('r', 'p', 'v', 'm')
  order by c.relname`;
const COLUMNS = `
  select a.attrelid::int as oid, a.attname as name, a.attnum::int as num, a.attnotnull as notnull,
         coalesce(bt.typname, t.typname) as typname,
         case when t.typtype = 'd' then t.typtypmod else a.atttypmod end as typmod,
         col_description(a.attrelid, a.attnum) as comment
  from pg_catalog.pg_attribute a
  join pg_catalog.pg_class c on c.oid = a.attrelid
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  join pg_catalog.pg_type t on t.oid = a.atttypid
  left join pg_catalog.pg_type bt on t.typtype = 'd' and bt.oid = t.typbasetype
  where n.nspname = $1 and a.attnum > 0 and not a.attisdropped
  order by a.attrelid, a.attnum`;
const CONSTRAINTS = `
  select con.conname as name, con.contype::text as type, con.conrelid::int as rel, con.confrelid::int as frel,
         con.conkey::int[] as key, con.confkey::int[] as fkey, fn.nspname as fschema
  from pg_catalog.pg_constraint con
  join pg_catalog.pg_class c on c.oid = con.conrelid
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  left join pg_catalog.pg_class fc on fc.oid = con.confrelid
  left join pg_catalog.pg_namespace fn on fn.oid = fc.relnamespace
  where n.nspname = $1 and con.contype in ('p', 'f')
  order by con.conname`;

/** PostgreSQL type -> Edm type and facets; undefined for types the service cannot serve. */
function edmOf(typname: string, typmod: number): Omit<GenProperty, 'name' | 'column' | 'nullable' | 'label'> | undefined {
  switch (typname) {
    case 'int2': return { edmType: 'Edm.Int16' };
    case 'int4': return { edmType: 'Edm.Int32' };
    case 'int8': return { edmType: 'Edm.Int64' };
    case 'float4': return { edmType: 'Edm.Single' };
    case 'float8': return { edmType: 'Edm.Double' };
    case 'numeric':
      if (typmod < 0) return { edmType: 'Edm.Decimal', scale: 'variable' };
      return { edmType: 'Edm.Decimal', precision: ((typmod - 4) >> 16) & 0xffff, scale: (typmod - 4) & 0xffff };
    case 'bool': return { edmType: 'Edm.Boolean' };
    case 'varchar': case 'bpchar': return typmod > 4 ? { edmType: 'Edm.String', maxLength: typmod - 4 } : { edmType: 'Edm.String' };
    case 'text': case 'citext': return { edmType: 'Edm.String' };
    case 'date': return { edmType: 'Edm.Date' };
    case 'timestamptz': case 'timestamp': return { edmType: 'Edm.DateTimeOffset', precision: typmod < 0 ? 6 : typmod };
    case 'time': return { edmType: 'Edm.TimeOfDay', ...(typmod >= 0 ? { precision: typmod } : {}) };
    case 'uuid': return { edmType: 'Edm.Guid' };
    default: return undefined;
  }
}

/** Reads the schema and builds the entity model. */
export async function introspect(db: Queryable, config: CliConfig): Promise<GenModel> {
  const warnings: string[] = [];
  // one after the other: a pg.Client runs one query at a time
  const tables = await db.query<TableRow>(TABLES, [config.schema]);
  const columns = await db.query<ColumnRow>(COLUMNS, [config.schema]);
  const constraints = await db.query<ConstraintRow>(CONSTRAINTS, [config.schema]);
  if (!tables.rows.length) throw new Error(`Schema "${config.schema}" has no tables (or the user cannot see them).`);

  const byOid = new Map<number, GenEntity>();
  const colName = new Map<string, string>(); // "<oid>:<attnum>" -> property name
  for (const t of tables.rows) {
    const ec = config.entities?.[t.name] ?? {};
    if (ec.skip) continue;
    const type = ec.type ?? pascal(t.name);
    const entity: GenEntity = { schema: config.schema, table: t.name, type, set: ec.set ?? plural(type), keys: [], properties: [], navigations: [] };
    if (t.comment) entity.description = t.comment;
    for (const c of columns.rows.filter((x) => x.oid === t.oid)) {
      const pc = ec.properties?.[c.name] ?? {};
      if (pc.skip) continue;
      const edm = edmOf(c.typname, c.typmod);
      if (!edm && !pc.type) {
        warnings.push(`${t.name}.${c.name}: type ${c.typname} is not supported; the column is left out (set "type" in the configuration to keep it).`);
        continue;
      }
      if (c.typname === 'timestamp') warnings.push(`${t.name}.${c.name}: "timestamp without time zone" is served as Edm.DateTimeOffset in UTC; prefer timestamptz.`);
      const p: GenProperty = { name: pc.name ?? pascal(c.name), column: c.name, nullable: !c.notnull, ...(edm ?? { edmType: pc.type! }) };
      if (pc.type) p.edmType = pc.type;
      if (c.comment) p.label = c.comment;
      entity.properties.push(p);
      colName.set(`${t.oid}:${c.num}`, p.name);
    }
    byOid.set(t.oid, entity);
  }

  for (const con of constraints.rows.filter((c) => c.type === 'p')) {
    const e = byOid.get(con.rel);
    if (e) e.keys = con.key.map((n) => colName.get(`${con.rel}:${n}`)!).filter(Boolean);
  }
  for (const [oid, e] of byOid) {
    const t = tables.rows.find((x) => x.oid === oid)!;
    const configured = config.entities?.[t.name]?.keys;
    if (configured) e.keys = configured;
    if (!e.keys.length) {
      warnings.push(`${t.name}: no primary key (and no "keys" in the configuration); the table is left out.`);
      byOid.delete(oid);
    }
  }

  // Foreign keys -> navigation properties. The single-valued side always; the collection side for compositions
  // (the foreign key is part of the child's key, e.g. items of an order) or when configured.
  for (const fk of constraints.rows.filter((c) => c.type === 'f')) {
    const child = byOid.get(fk.rel);
    const parent = byOid.get(fk.frel);
    if (!child) continue;
    if (!parent) {
      warnings.push(`${child.table}: foreign key ${fk.name} points to a table outside schema "${config.schema}" or to a left-out table; no navigation property.`);
      continue;
    }
    const nc = config.navigations?.[fk.name] ?? {};
    const own = fk.key.map((n) => colName.get(`${fk.rel}:${n}`));
    const ref = (fk.fkey ?? []).map((n) => colName.get(`${fk.frel}:${n}`));
    if (own.some((x) => !x) || ref.some((x) => !x)) {
      warnings.push(`${child.table}: foreign key ${fk.name} uses a left-out column; no navigation property.`);
      continue;
    }
    const single = own.length === 1 ? own[0]!.replace(/(Id|ID|Code)$/, '') || parent.type : parent.type;
    const toOne = nc.toOne ?? `_${single}`;
    const composition = own.every((p) => child.keys.includes(p!));
    const toMany = nc.toMany === false ? undefined : nc.toMany ?? (composition ? `_${child.type}` : undefined);
    const nullable = own.some((p) => child.properties.find((x) => x.name === p)?.nullable);
    for (const [e, name] of [[child, toOne], ...(toMany ? [[parent, toMany]] : [])] as [GenEntity, string][]) {
      if (e.properties.some((p) => p.name === name) || e.navigations.some((n) => n.name === name))
        throw new Error(`${e.table}: navigation property ${name} (from foreign key ${fk.name}) clashes with an existing name; set "navigations.${fk.name}" in the configuration.`);
    }
    child.navigations.push({
      name: toOne, targetType: parent.type, targetSet: parent.set, collection: false, nullable, partner: toMany,
      constraints: own.map((p, i) => ({ property: p!, referencedProperty: ref[i]! })),
    });
    if (toMany) parent.navigations.push({ name: toMany, targetType: child.type, targetSet: child.set, collection: true, nullable: false, partner: toOne });
  }

  const entities = [...byOid.values()];
  const sets = new Map<string, string>();
  for (const e of entities) {
    if (sets.has(e.set)) throw new Error(`Tables ${sets.get(e.set)} and ${e.table} both map to entity set ${e.set}; set "entities.<table>.set" in the configuration.`);
    sets.set(e.set, e.table);
  }
  return { namespace: config.namespace, container: config.container ?? 'Container', entities, warnings };
}
