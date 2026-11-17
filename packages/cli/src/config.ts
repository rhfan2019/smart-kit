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

export interface NavigationConfig {
  /** Name of the single-valued navigation on the table with the foreign key (default: "_" + column or target type). */
  toOne?: string;
  /** Name of the collection navigation on the referenced table (default: generated only for compositions). */
  toMany?: string | false;
}

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
  /** Per foreign-key constraint name. */
  navigations?: Record<string, NavigationConfig>;
}

export interface LoadedConfig extends CliConfig {
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
  const baseDir = dirname(resolve(file));
  return { ...raw, baseDir, path: (rel: string) => resolve(baseDir, rel) };
}
