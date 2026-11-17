// Creates the PostgreSQL test bed for the purchasing service. Idempotent: creates only what is missing.
//
//   npm run setup -w pg-server            roles, database, schema, tables; seeds when the tables are empty
//   npm run setup -w pg-server -- --reseed   also replaces the data (only the tables of schema "purchasing")
//
// It creates exactly these objects and never touches, alters or drops anything else on the server:
//   role smart_kit         owner of the database and its tables (LOGIN)
//   role smart_kit_app     what smart-kit-server connects as: SELECT, INSERT, UPDATE, DELETE on the tables (LOGIN)
//   role smart_kit_reader  read-only (LOGIN), e.g. for smart-kit-cli
//   database smart_kit_purchasing, schema purchasing, the tables of sql/schema.sql
//   schema purchasing_seed: a copy of the changeable tables and purchasing_seed.reset(), which restores them
//     (the end-to-end tests call it through POST /test/reset of the server when E2E=1)
//
// Environment:
//   SMART_KIT_PG_ADMIN_URL  a role that may create roles and databases (default postgresql://localhost:5432/postgres,
//                           i.e. your OS user, as Homebrew's PostgreSQL sets it up)
//   SMART_KIT_DB_PASSWORD   password for both roles (optional; local Homebrew uses "trust" and needs none)
//
// The data comes from the generator of the in-memory test service (apps/mock/lib/purchasing.mjs), so both services
// hold the same rows: the conformance test compares their responses.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';
// @ts-expect-error -- plain JavaScript module of the mock service, no types
import { generatePurchasing } from '../mock/lib/purchasing.mjs';

export const DATABASE = 'smart_kit_purchasing';
export const OWNER = 'smart_kit';
export const READER = 'smart_kit_reader';
export const APP = 'smart_kit_app';
const ADMIN_URL = process.env.SMART_KIT_PG_ADMIN_URL ?? 'postgresql://localhost:5432/postgres';
const PASSWORD = process.env.SMART_KIT_DB_PASSWORD;

/** Tables in load order (parents first) with the entity set of the generated data. */
const TABLES: [table: string, entitySet: string][] = [
  ['order_status', 'OrderStatuses'],
  ['order_type', 'PurchaseOrderTypes'],
  ['supplier', 'Suppliers'],
  ['material', 'Materials'],
  ['plant', 'Plants'],
  ['purchase_order', 'PurchaseOrders'],
  ['purchase_order_item', 'PurchaseOrderItems'],
  ['pricing_condition', 'PricingConditions'],
  ['item_history', 'ItemHistory'],
];
/** Tables that requests change: copied to purchasing_seed and restored by purchasing_seed.reset(). */
const CHANGEABLE = ['purchase_order', 'purchase_order_item', 'pricing_condition', 'item_history', 'variant'];

/** The copy of the changeable tables and the function that restores them (security definer: runs as the owner). */
async function snapshot(db: pg.Client) {
  await db.query('create schema if not exists purchasing_seed');
  for (const t of CHANGEABLE) {
    await db.query(`drop table if exists purchasing_seed.${t}`);
    await db.query(`create table purchasing_seed.${t} as table purchasing.${t}`);
  }
  const order = ['purchase_order', 'purchase_order_item', 'pricing_condition', 'item_history', 'variant'];
  await db.query(`create or replace function purchasing_seed.reset() returns void language plpgsql security definer set search_path = pg_catalog as $$
    begin
      truncate ${CHANGEABLE.map((t) => `purchasing.${t}`).join(', ')};
      ${order.map((t) => `insert into purchasing.${t} select * from purchasing_seed.${t};`).join('\n      ')}
    end $$`);
  await db.query('revoke all on function purchasing_seed.reset() from public');
  await db.query(`grant usage on schema purchasing_seed to ${db.escapeIdentifier(APP)}`);
  await db.query(`grant execute on function purchasing_seed.reset() to ${db.escapeIdentifier(APP)}`);
  log('seed copy for purchasing_seed.reset() written');
}

async function seedPrices(db: pg.Client, data: { MaterialPrices: Record<string, number> }) {
  const { rows } = await db.query<{ n: string }>('select count(*) as n from purchasing.material_price');
  if (Number(rows[0]!.n) > 0) return;
  const prices = Object.entries(data.MaterialPrices).map(([material, price_eur]) => ({ material, price_eur }));
  await db.query('insert into purchasing.material_price select * from json_populate_recordset(null::purchasing.material_price, $1::json)', [JSON.stringify(prices)]);
  log(`material_price: ${prices.length} rows`);
}

const snake = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
const log = (m: string) => console.log(`[pg-setup] ${m}`);

async function ensureRoles(admin: pg.Client) {
  for (const role of [OWNER, APP, READER]) {
    const { rowCount } = await admin.query('select 1 from pg_roles where rolname = $1', [role]);
    const pw = PASSWORD ? ` password ${admin.escapeLiteral(PASSWORD)}` : '';
    if (!rowCount) {
      await admin.query(`create role ${admin.escapeIdentifier(role)} login${pw}`);
      log(`created role ${role}`);
    }
  }
}

async function ensureDatabase(admin: pg.Client) {
  const { rowCount } = await admin.query('select 1 from pg_database where datname = $1', [DATABASE]);
  if (rowCount) return;
  await admin.query(`create database ${admin.escapeIdentifier(DATABASE)} owner ${admin.escapeIdentifier(OWNER)}`);
  log(`created database ${DATABASE} (owner ${OWNER})`);
}

async function seed(db: pg.Client, reseed: boolean) {
  const { rows } = await db.query<{ n: string }>('select count(*) as n from purchasing.purchase_order');
  const generated = () => generatePurchasing() as Record<string, Record<string, unknown>[]> & { MaterialPrices: Record<string, number> };
  if (Number(rows[0]!.n) > 0 && !reseed) {
    log(`data present (${rows[0]!.n} purchase orders); use --reseed to replace it`);
    const { rowCount } = await db.query("select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace where n.nspname = 'purchasing_seed' and p.proname = 'reset'");
    const { rows: prices } = await db.query<{ n: string }>('select count(*) as n from purchasing.material_price');
    if (Number(prices[0]!.n) === 0) await seedPrices(db, generated());
    if (!rowCount) await snapshot(db);
    return;
  }
  const data = generated();
  await db.query('begin');
  try {
    await db.query(`truncate purchasing.variant, purchasing.material_price, ${TABLES.map(([t]) => `purchasing.${t}`).join(', ')}`);
    for (const [table, set] of TABLES) {
      const rowsOf = data[set]!.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [snake(k), v])));
      for (let i = 0; i < rowsOf.length; i += 5000) {
        await db.query(`insert into purchasing.${table} select * from json_populate_recordset(null::purchasing.${table}, $1::json)`, [JSON.stringify(rowsOf.slice(i, i + 5000))]);
      }
      log(`${table}: ${rowsOf.length} rows`);
    }
    await seedPrices(db, data);
    await db.query('commit');
  } catch (e) {
    await db.query('rollback');
    throw e;
  }
  await db.query('analyze purchasing.purchase_order, purchasing.purchase_order_item, purchasing.pricing_condition, purchasing.item_history');
  await snapshot(db);
}

export async function setup(o: { reseed?: boolean } = {}) {
  const admin = new pg.Client({ connectionString: ADMIN_URL, application_name: 'smart-kit-setup' });
  await admin.connect();
  try {
    await ensureRoles(admin);
    await ensureDatabase(admin);
  } finally {
    await admin.end();
  }
  const url = new URL(ADMIN_URL);
  url.pathname = `/${DATABASE}`;
  const db = new pg.Client({ connectionString: url.toString(), application_name: 'smart-kit-setup' });
  await db.connect();
  try {
    // objects are created as (and owned by) the owner role
    await db.query(`set role ${db.escapeIdentifier(OWNER)}`);
    await db.query(readFileSync(join(import.meta.dirname, 'sql/schema.sql'), 'utf8'));
    await db.query(`grant usage on schema purchasing to ${db.escapeIdentifier(READER)}`);
    await db.query(`grant select on all tables in schema purchasing to ${db.escapeIdentifier(READER)}`);
    await db.query(`alter default privileges in schema purchasing grant select on tables to ${db.escapeIdentifier(READER)}`);
    await db.query(`grant usage on schema purchasing to ${db.escapeIdentifier(APP)}`);
    await db.query(`grant select, insert, update, delete on all tables in schema purchasing to ${db.escapeIdentifier(APP)}`);
    await db.query(`alter default privileges in schema purchasing grant select, insert, update, delete on tables to ${db.escapeIdentifier(APP)}`);
    await seed(db, !!o.reseed);
  } finally {
    await db.end();
  }
  log(`ready: postgresql://${APP}@${url.host}/${DATABASE} (read and write), postgresql://${READER}@${url.host}/${DATABASE} (read only)`);
}

if (import.meta.main ?? process.argv[1]?.endsWith('setup.ts')) {
  setup({ reseed: process.argv.includes('--reseed') }).catch((e: Error) => {
    console.error(`[pg-setup] ${e.message}`);
    process.exit(1);
  });
}
