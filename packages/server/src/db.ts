// A Kysely instance on a pg pool with the session settings the SQL of this package relies on.
import { Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';

export interface PostgresDbOptions {
  /** Connection string, e.g. "postgres://smart_kit@localhost/smart_kit_purchasing" (or use the PG* environment variables). */
  connectionString?: string;
  /** Pool size (default 10). */
  max?: number;
  /** Statement timeout in milliseconds (default 15000): a runaway query is cancelled. */
  statementTimeout?: number;
}

/** Creates Kysely + pg. Sessions run in UTC; queries are cancelled after `statementTimeout`. */
export function createPostgresDb(o: PostgresDbOptions = {}) {
  const pool = new pg.Pool({
    connectionString: o.connectionString,
    max: o.max ?? 10,
    options: `-c TimeZone=UTC -c statement_timeout=${o.statementTimeout ?? 15000}`,
    application_name: 'smart-kit-server',
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tables are known only at run time
  return { db: new Kysely<any>({ dialect: new PostgresDialect({ pool }) }), pool };
}
