// Creates the PostgreSQL test bed for the purchasing service. Idempotent: creates only what is missing.
//
//   npm run setup -w pg-server            roles, database, schema, tables; seeds when the tables are empty
//   npm run setup -w pg-server -- --reseed   also replaces the data (only the tables of schema "purchasing")
//
// It creates exactly these objects and never touches, alters or drops anything else on the server:
//   role smart_kit         owner of the database and its tables (LOGIN)
//   role smart_kit_reader  what smart-kit-server connects as: SELECT only (LOGIN)
//   database smart_kit_purchasing, schema purchasing, the tables of sql/schema.sql
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

const snake = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
const log = (m: string) => console.log(`[pg-setup] ${m}`);

async function ensureRoles(admin: pg.Client) {
  for (const role of [OWNER, READER]) {
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
  if (Number(rows[0]!.n) > 0 && !reseed) {
    log(`data present (${rows[0]!.n} purchase orders); use --reseed to replace it`);
    return;
  }
  const data = generatePurchasing() as Record<string, Record<string, unknown>[]>;
  await db.query('begin');
  try {
    await db.query(`truncate ${TABLES.map(([t]) => `purchasing.${t}`).join(', ')}`);
    for (const [table, set] of TABLES) {
      const rowsOf = data[set]!.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [snake(k), v])));
      for (let i = 0; i < rowsOf.length; i += 5000) {
        await db.query(`insert into purchasing.${table} select * from json_populate_recordset(null::purchasing.${table}, $1::json)`, [JSON.stringify(rowsOf.slice(i, i + 5000))]);
      }
      log(`${table}: ${rowsOf.length} rows`);
    }
    await db.query('commit');
  } catch (e) {
    await db.query('rollback');
    throw e;
  }
  await db.query('analyze purchasing.purchase_order, purchasing.purchase_order_item, purchasing.pricing_condition, purchasing.item_history');
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
    await seed(db, !!o.reseed);
  } finally {
    await db.end();
  }
  log(`ready: postgresql://${READER}@${url.host}/${DATABASE}`);
}

if (import.meta.main ?? process.argv[1]?.endsWith('setup.ts')) {
  setup({ reseed: process.argv.includes('--reseed') }).catch((e: Error) => {
    console.error(`[pg-setup] ${e.message}`);
    process.exit(1);
  });
}
