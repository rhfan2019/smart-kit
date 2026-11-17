// `smart-kit generate`: database -> generated CSDL + storage mapping; then check the annotation files.
// Only the two generated files are written. Annotation files are read, never changed.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative } from 'node:path';
import pg from 'pg';
import { checkAnnotations, indexCsdl, type CheckProblem } from './check';
import type { LoadedConfig } from './config';
import { toCsdl, toStorage } from './csdl';
import { introspect, type Queryable } from './introspect';

export interface GenerateResult {
  csdlPath: string;
  storagePath: string;
  changed: boolean;
  warnings: string[];
  problems: CheckProblem[];
  entitySets: string[];
}

/** Connection string: --url, then SMART_KIT_DATABASE_URL, then the configuration; otherwise pg reads the PG* variables. */
export const connectionOf = (config: LoadedConfig, url?: string) => url ?? process.env.SMART_KIT_DATABASE_URL ?? config.connection;

export async function generate(config: LoadedConfig, o: { url?: string; db?: Queryable } = {}): Promise<GenerateResult> {
  let client: pg.Client | undefined;
  let db = o.db;
  if (!db) {
    client = new pg.Client({ connectionString: connectionOf(config, o.url), application_name: 'smart-kit-cli' });
    await client.connect();
    db = client as unknown as Queryable;
  }
  try {
    const model = await introspect(db, config);
    const csdlPath = config.path(config.output.csdl);
    const storagePath = config.path(config.output.storage);
    const csdl = toCsdl(model, `PostgreSQL schema ${config.schema}`);
    const storage = `${JSON.stringify(toStorage(model), null, 2)}\n`;
    const changed = !existsSync(csdlPath) || readFileSync(csdlPath, 'utf8') !== csdl || !existsSync(storagePath) || readFileSync(storagePath, 'utf8') !== storage;
    mkdirSync(dirname(csdlPath), { recursive: true });
    mkdirSync(dirname(storagePath), { recursive: true });
    writeFileSync(csdlPath, csdl);
    writeFileSync(storagePath, storage);
    return { csdlPath, storagePath, changed, warnings: model.warnings, problems: check(config, csdl), entitySets: model.entities.map((e) => e.set) };
  } finally {
    await client?.end();
  }
}

/** `smart-kit check`: the annotation files against the generated CSDL file on disk. */
export function check(config: LoadedConfig, csdl = readFileSync(config.path(config.output.csdl), 'utf8')): CheckProblem[] {
  const index = indexCsdl(csdl);
  const files = (config.annotations ?? []).map((rel) => ({ name: relative(process.cwd(), config.path(rel)), xml: readFileSync(config.path(rel), 'utf8') }));
  return checkAnnotations(index, files);
}
