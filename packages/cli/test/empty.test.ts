// An empty schema is legal: an application that has removed its sample and has not built its first table yet. `generate`
// writes a valid CSDL with an empty entity container and an empty storage mapping; `check --strict` has nothing to check.
import { buildModel } from '@rhfan2019/smart-kit-core';
import { createODataService } from '@rhfan2019/smart-kit-server';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { entitySetsOf } from '../src/generate';
import { check, generate, indexCsdl, introspect, loadConfig, toCsdl, toStorage, type Queryable } from '../src/index';

const ROOT = join(import.meta.dirname, '../../..');
const BIN = join(ROOT, 'packages/cli/src/bin.ts');

/** A fake pg_catalog: no tables, or the given tables (each with one text column and no key). */
function fakeDb(tableNames: string[] = []): Queryable {
  const tables = tableNames.map((name, i) => ({ oid: i + 1, name, comment: null, kind: 'r' }));
  const columns = tableNames.map((_, i) => ({ oid: i + 1, name: 'id', num: 1, notnull: true, typname: 'text', typmod: -1, comment: null }));
  const constraints = tableNames.map((name, i) => ({ name: `${name}_pkey`, type: 'p', rel: i + 1, frel: 0, key: [1], fkey: null, fschema: null }));
  return {
    async query<R>(text: string) {
      const rows = text.includes('pg_constraint') ? constraints : text.includes('pg_attribute') ? columns : tables;
      return { rows: rows as R[] };
    },
  };
}

function project(extra: Record<string, unknown> = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'smart-kit-empty-'));
  const file = join(dir, 'smart-kit.config.json');
  writeFileSync(file, JSON.stringify({ schema: 'app', namespace: 'App', output: { csdl: 'generated/app.csdl.xml', storage: 'generated/app.storage.json' }, ...extra }));
  return { dir, file, config: loadConfig(file) };
}

describe('empty schema: generate', () => {
  it('a schema without tables gives an empty model and a warning, not an error', async () => {
    const m = await introspect(fakeDb(), { schema: 'app', namespace: 'App', output: { csdl: 'x', storage: 'y' } });
    expect(m.entities).toEqual([]);
    expect(m.warnings).toEqual([expect.stringMatching(/Schema "app" has no tables/)]);
    const csdl = toCsdl(m, 'test');
    expect(csdl).toMatch(/<EntityContainer Name="Container">\s*<\/EntityContainer>/);
    expect(csdl).not.toContain('<EntityType');
    expect(toStorage(m).entitySets).toEqual({});
  });

  it('writes a valid CSDL with an empty entity container and an empty storage mapping; nothing to report', async () => {
    const { config } = project({ entities: {}, navigations: {}, annotations: [] });
    const r = await generate(config, { db: fakeDb() });
    expect(r).toMatchObject({ changed: true, entitySets: [], problems: [] });
    const csdl = readFileSync(r.csdlPath, 'utf8');
    const index = indexCsdl(csdl);
    expect(index).toMatchObject({ namespace: 'App', container: 'App.Container' });
    expect([...index.sets.keys()]).toEqual([]);
    expect(JSON.parse(readFileSync(r.storagePath, 'utf8')).entitySets).toEqual({});
    // the document is a model the UI and the server can read
    expect(Object.keys(buildModel(csdl).entitySets)).toEqual([]);
    // generating again changes nothing
    expect((await generate(config, { db: fakeDb() })).changed).toBe(false);
  });

  it('every table left out (`skip`) gives the same empty service, without the warning', async () => {
    const { config } = project({ entities: { sample: { skip: true } } });
    const r = await generate(config, { db: fakeDb(['sample']) });
    expect(r).toMatchObject({ entitySets: [], problems: [], warnings: [] });
    expect(readFileSync(r.csdlPath, 'utf8')).toMatch(/<EntityContainer Name="Container">\s*<\/EntityContainer>/);
  });

  it('the server starts on the empty CSDL: $metadata and an empty service document', async () => {
    const { config } = project();
    const r = await generate(config, { db: fakeDb() });
    const service = createODataService({
      basePath: '/odata/app/', metadata: { csdl: readFileSync(r.csdlPath, 'utf8') }, storage: JSON.parse(readFileSync(r.storagePath, 'utf8')),
      db: {} as never,
    });
    const metadata = await service.handle(new Request('http://localhost/odata/app/$metadata'));
    expect(metadata.status).toBe(200);
    expect(await metadata.text()).toContain('<EntityContainer Name="Container"');
    const root = await service.handle(new Request('http://localhost/odata/app/'));
    expect(root.status).toBe(200);
    expect((await root.json() as { value: unknown[] }).value).toEqual([]);
  });
});

describe('empty schema: check', () => {
  it('has nothing to check; a declared navigation or an annotation target that names an entity is still reported', async () => {
    const { config, dir } = project();
    await generate(config, { db: fakeDb() });
    expect(check(config)).toEqual([]);
    expect(entitySetsOf(config)).toEqual([]);
    // stale leftovers of the removed sample are real problems
    writeFileSync(join(dir, 'a.xml'), '<edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx"><edmx:DataServices><Schema Namespace="App.Annotations" xmlns="http://docs.oasis-open.org/odata/ns/edm"><Annotations Target="App.Sample"/></Schema></edmx:DataServices></edmx:Edmx>');
    expect(check({ ...config, annotations: ['a.xml'] })).toEqual([expect.objectContaining({ target: 'App.Sample' })]);
  });

  it('the command: `check --strict` exits 0 and says that there are no entity sets', async () => {
    const { config, file } = project({ entities: {} });
    await generate(config, { db: fakeDb() });
    const run = spawnSync(process.execPath, ['--import', 'tsx', BIN, 'check', '--config', file, '--strict'], { cwd: ROOT, encoding: 'utf8' });
    expect(run.stderr).toBe('');
    expect(run.status).toBe(0);
    expect(run.stdout).toMatch(/app\.csdl\.xml: no entity sets \(an empty entity container\)\./);
    expect(run.stdout).toMatch(/every target, path and column exists/);
  });
});
