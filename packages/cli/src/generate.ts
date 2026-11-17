// `smart-kit generate`: database -> generated CSDL + storage mapping; then check the annotation files.
// Only the two generated files are written. Annotation files are read, never changed.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative } from 'node:path';
import pg from 'pg';
import { checkAnnotations, checkDeclaredNavigations, indexCsdl, type CheckProblem, type StorageFile } from './check';
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
    return { csdlPath, storagePath, changed, warnings: model.warnings, problems: check(config, csdl, storage), entitySets: model.entities.map((e) => e.set) };
  } finally {
    await client?.end();
  }
}

/**
 * `smart-kit check`: the annotation files, and the navigations declared in the configuration, against the generated
 * CSDL file and storage mapping on disk.
 */
export function check(config: LoadedConfig, csdl = readFileSync(config.path(config.output.csdl), 'utf8'), storage?: string): CheckProblem[] {
  const index = indexCsdl(csdl);
  const files = (config.annotations ?? []).map((rel) => ({ name: relative(process.cwd(), config.path(rel)), path: config.path(rel) }));
  // a listed annotation file that does not exist yet (a new project) is a problem to report, not a crash
  const missing: CheckProblem[] = files.filter((f) => !existsSync(f.path)).map((f) => ({ file: f.name, target: '(file)', message: 'annotation file not found (create it, or remove it from "annotations")' }));
  const annotations = checkAnnotations(index, files.filter((f) => existsSync(f.path)).map((f) => ({ name: f.name, xml: readFileSync(f.path, 'utf8') })));
  let navigations: CheckProblem[] = [];
  const declared = Object.values(config.navigations ?? {}).some((n) => 'from' in n);
  const storagePath = config.path(config.output.storage);
  if (declared) {
    const configName = config.file ? relative(process.cwd(), config.file) : 'smart-kit.config.json';
    if (storage === undefined && !existsSync(storagePath)) navigations = [{ file: configName, target: 'navigations', message: `storage mapping ${relative(process.cwd(), storagePath)} not found (run smart-kit generate)` }];
    else navigations = checkDeclaredNavigations(config, index, JSON.parse(storage ?? readFileSync(storagePath, 'utf8')) as StorageFile, configName);
  }
  return [...missing, ...annotations, ...navigations];
}
