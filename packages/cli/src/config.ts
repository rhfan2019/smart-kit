// smart-kit.config.json: where the database is, which schema to read, how tables map to entities, where to write.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export interface EntityConfig {
  /** Entity type name (default: the table name in PascalCase). */
  type?: string;
  /** Entity set name (default: the plural of the type name). */
  set?: string;
  /** Key properties for views (tables use their primary key). */
  keys?: string[];
  /** Leave the table out. */
  skip?: boolean;
  /** Per column: property name and Edm type overrides. */
  properties?: Record<string, { name?: string; type?: string; skip?: boolean }>;
}

/** Names of the navigation properties generated from a foreign key constraint (`navigations.<constraint name>`). */
export interface NavigationConfig {
  /** Name of the single-valued navigation on the table with the foreign key (default: "_" + column or target type). */
  toOne?: string;
  /** Name of the collection navigation on the referenced table (default: generated only for compositions). */
  toMany?: string | false;
}

/**
 * A navigation the database has no foreign key for, e.g. between views (`navigations.<any name>` with `from`):
 *   { "from": "user_list", "to": "user_role_list", "on": { "id": "user_id" }, "toMany": "_Roles", "partner": "_User" }
 * gives user_list the collection navigation _Roles (and user_role_list the single-valued _User).
 */
export interface DeclaredNavigationConfig {
  /** Table or view the navigation starts from (its name in the schema, as in "entities"). */
  from: string;
  /** Table or view the navigation leads to. */
  to: string;
  /** Join: column of `from` -> column of `to` (column names; the property names of the entities work too). */
  on: Record<string, string>;
  /** Name of a single-valued navigation from `from` to `to` (one target row at most). Give this or `toMany`. */
  toOne?: string;
  /** Name of a collection navigation from `from` to `to`. Give this or `toOne`. */
  toMany?: string;
  /** Name of the navigation back from `to` to `from`: single-valued for `toMany`, a collection for `toOne`. */
  partner?: string;
}

export const isDeclaredNavigation = (n: NavigationConfig | DeclaredNavigationConfig): n is DeclaredNavigationConfig => 'from' in n;

export interface CliConfig {
  /** Connection string. --url and the environment variable SMART_KIT_DATABASE_URL take precedence; without any, pg reads PG*. */
  connection?: string;
  /** PostgreSQL schema to read. */
  schema: string;
  namespace: string;
  container?: string;
  output: { csdl: string; storage: string };
  /** Hand-written annotation files, checked after generation. */
  annotations?: string[];
  entities?: Record<string, EntityConfig>;
  /**
   * Per foreign-key constraint name: the names of its navigation properties. Entries with `from` declare
   * navigations without a foreign key (views): see DeclaredNavigationConfig.
   */
  navigations?: Record<string, NavigationConfig | DeclaredNavigationConfig>;
}

export interface LoadedConfig extends CliConfig {
  /** Path of the configuration file (used in messages). */
  file?: string;
  /** Directory of the configuration file: relative paths are resolved against it. */
  baseDir: string;
  path(rel: string): string;
}

export function loadConfig(file: string): LoadedConfig {
  const text = readFileSync(file, 'utf8');
  let raw: CliConfig;
  try {
    raw = JSON.parse(text) as CliConfig;
  } catch (e) {
    throw new Error(`${file} is not valid JSON: ${(e as Error).message}`, { cause: e });
  }
  for (const k of ['schema', 'namespace'] as const) if (!raw[k]) throw new Error(`${file}: "${k}" is required`);
  if (!raw.output?.csdl || !raw.output?.storage) throw new Error(`${file}: "output.csdl" and "output.storage" are required`);
  for (const [name, n] of Object.entries(raw.navigations ?? {})) {
    if (!n || typeof n !== 'object') throw new Error(`${file}: "navigations.${name}" must be an object`);
    if (!isDeclaredNavigation(n)) continue;
    const where = `${file}: "navigations.${name}"`;
    if (typeof n.from !== 'string' || typeof n.to !== 'string' || !n.from || !n.to) throw new Error(`${where} needs "from" and "to" (table or view names)`);
    if (!n.on || typeof n.on !== 'object' || !Object.keys(n.on).length || !Object.values(n.on).every((v) => typeof v === 'string'))
      throw new Error(`${where} needs "on": { "<column of ${n.from}>": "<column of ${n.to}>" }`);
    if (!!n.toOne === !!n.toMany) throw new Error(`${where} needs exactly one of "toOne" and "toMany" (the name of the navigation property on ${n.from})`);
  }
  const baseDir = dirname(resolve(file));
  return { ...raw, file, baseDir, path: (rel: string) => resolve(baseDir, rel) };
}
