// A Kysely instance on a pg pool with the session settings the SQL of this package relies on: TimeZone UTC (dates
// and times are written in UTC; `timestamp without time zone` columns are read as UTC) and a statement timeout.
import { Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';

const DEFAULT_STATEMENT_TIMEOUT = 15000;

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
    options: `-c TimeZone=UTC -c statement_timeout=${o.statementTimeout ?? DEFAULT_STATEMENT_TIMEOUT}`,
    application_name: 'smart-kit-server',
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tables are known only at run time
  return { db: new Kysely<any>({ dialect: new PostgresDialect({ pool }) }), pool };
}

export interface KyselyOnPoolOptions {
  /** Statement timeout in milliseconds (default 15000) for the queries of the service. */
  statementTimeout?: number;
  /**
   * false (default): the settings are made each time the service takes a connection from the pool and reset
   * (`RESET TimeZone`, `RESET statement_timeout`) when it gives the connection back, so the host's own queries on the
   * same pool keep the host's settings; two short statements per connection use.
   * true: the settings are made once per connection and stay; cheaper, for a pool whose connections may all run in
   * UTC with this statement timeout.
   */
  keepSettings?: boolean;
}

/**
 * Kysely on a `pg` pool the host already has (instead of the separate pool of `createPostgresDb`), with the session
 * settings this package relies on: TimeZone UTC and a statement timeout. `db.destroy()` does not end the host's
 * pool; the host ends it.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- tables are known only at run time
export function createKysely(pool: pg.Pool, o: KyselyOnPoolOptions = {}): Kysely<any> {
  const timeout = String(o.statementTimeout ?? DEFAULT_STATEMENT_TIMEOUT);
  if (!/^\d+$/.test(timeout)) throw new Error(`[smart-kit-server] statementTimeout must be a number of milliseconds, got ${timeout}`);
  const prepared = new WeakSet<pg.PoolClient>();
  const set = (c: pg.PoolClient) => c.query("select set_config('TimeZone', 'UTC', false), set_config('statement_timeout', $1, false)", [timeout]);
  // What PostgresDialect uses of a pool: connect(), end(), and Client / options (to cancel a query).
  const wrapper = {
    Client: (pool as unknown as { Client?: unknown }).Client,
    options: pool.options,
    async connect(): Promise<pg.PoolClient> {
      const client = await pool.connect();
      try {
        if (!o.keepSettings || !prepared.has(client)) await set(client);
      } catch (e) {
        client.release(e as Error);
        throw e;
      }
      if (o.keepSettings) {
        prepared.add(client);
        return client;
      }
      // A client proxy whose release() first restores the session defaults; the client itself is left unchanged.
      return new Proxy(client, {
        get(target, prop, receiver) {
          if (prop !== 'release') {
            const v = Reflect.get(target, prop, receiver) as unknown;
            return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(target) : v;
          }
          return (err?: Error | boolean) => {
            if (err) return target.release(err);
            target.query('reset TimeZone; reset statement_timeout').then(
              () => target.release(),
              (e: Error) => target.release(e),
            );
          };
        },
      });
    },
    async end() {
      // the host's pool: the host ends it
    },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tables are known only at run time
  return new Kysely<any>({ dialect: new PostgresDialect({ pool: wrapper as unknown as pg.Pool }) });
}

/**
 * Kysely on one connection the host holds: the connection of the host's own transaction, for the `unitOfWork` option
 * of the service. Every statement of the service then runs inside that transaction, next to the host's own writes
 * (whatever library they use). The session settings are made and reset around each use, as `createKysely` does;
 * nothing here begins, commits or releases: the host does.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- tables are known only at run time
export function createKyselyOnClient(client: pg.PoolClient | pg.Client, o: Pick<KyselyOnPoolOptions, 'statementTimeout'> = {}): Kysely<any> {
  // the client seen by createKysely: release() gives nothing back
  const held = new Proxy(client, {
    get(target, prop, receiver) {
      if (prop === 'release') return () => undefined;
      const v = Reflect.get(target, prop, receiver) as unknown;
      return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(target) : v;
    },
  }) as pg.PoolClient;
  const single = { Client: undefined, options: {}, connect: async () => held, end: async () => undefined };
  return createKysely(single as unknown as pg.Pool, { statementTimeout: o.statementTimeout });
}
