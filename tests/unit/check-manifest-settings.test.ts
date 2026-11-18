// Self-test of the manifest settings check of the page templates (AL-13; scripts/check-manifest-settings.mjs, docs/26c):
// a missing setting, an extra prop, a wrong default and a wrong value set must be reported; registered deviations
// pass, unused ones are stale; the real templates' manifest files are well-formed.
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '../..');
const FIXTURES = join(import.meta.dirname, 'fixtures/manifest-check');

interface Finding { module: string; kind: string; member: string; detail?: string }
interface Manifest { template: string; module: string; settingsType: string; settings: { path: string; type: string; values?: string[]; default?: unknown; opaque?: boolean; unread?: boolean }[] }
interface CheckModule {
  runCheck(o: { only?: string[]; ctx?: unknown; dir?: string; file?: (m: Manifest) => string }): {
    findings: Finding[]; unregistered: Finding[]; registered: Finding[]; stale: { id: string }[]; kitPaths: Record<string, string[]>;
  };
  loadManifests(dir?: string, only?: string[]): Manifest[];
  matchManifestDeviations(findings: Finding[], deviations: object[]): { registered: Finding[]; unregistered: Finding[]; stale: { id: string }[] };
}
interface KitModule { createProgramFor(files: string[]): unknown }
const load = async <T,>(rel: string): Promise<T> => (await import(pathToFileURL(join(ROOT, rel)).href)) as T;

async function fixtureRun() {
  const check = await load<CheckModule>('scripts/check-manifest-settings.mjs');
  const kit = await load<KitModule>('scripts/ui5/kit-model.mjs');
  const file = join(FIXTURES, 'Page.ts');
  return check.runCheck({ ctx: kit.createProgramFor([file]), dir: FIXTURES, file: () => file });
}

const has = (list: Finding[], kind: string, member: string) => list.some((x) => x.kind === kind && x.member === member);

describe('AL-13 manifest settings check (scripts/check-manifest-settings.mjs)', () => {
  it('AL-13 walks nested settings: records as "*", arrays as "[]", stops at opaque paths and React functions', async () => {
    const r = await fixtureRun();
    const paths = r.kitPaths.Page!;
    expect(paths).toContain('views/paths/[]/annotationPath');
    expect(paths).toContain('controlConfiguration/@com.sap.vocabularies.UI.v1.LineItem/columns/*/header');
    expect(paths).toContain('controlConfiguration/@com.sap.vocabularies.UI.v1.LineItem/columns/*/template');
    expect(paths.some((p) => p.startsWith('controlConfiguration/*/'))).toBe(false);
  }, 60_000);

  it('AL-13 reports a missing setting, an extra prop, a wrong default and a wrong value set', async () => {
    const r = await fixtureRun();
    expect(has(r.unregistered, 'manifest-missing', 'hideFilterBar')).toBe(true);
    // settings FE declares but does not read are not required
    expect(has(r.findings, 'manifest-missing', 'stickyMultiTabHeader')).toBe(false);
    expect(has(r.unregistered, 'manifest-extra', 'service')).toBe(true);
    expect(has(r.unregistered, 'manifest-default', 'liveMode')).toBe(true);
    expect(has(r.unregistered, 'manifest-values', 'variantManagement')).toBe(true);
    expect(has(r.findings, 'manifest-default', 'initialLoad')).toBe(false);
    expect(has(r.findings, 'manifest-values', 'initialLoad')).toBe(false);
    // a React render function in place of FE's fragment name is the same setting (react-idiom), not an extra prop
    expect(has(r.findings, 'manifest-extra', 'controlConfiguration/@com.sap.vocabularies.UI.v1.LineItem/columns/*/template')).toBe(false);
  }, 60_000);

  it('AL-13 accepts registered deviations and reports unused ones as stale', async () => {
    const r = await fixtureRun();
    expect(has(r.registered, 'manifest-extra', 'pageKey')).toBe(true);
    expect(r.stale.map((d) => d.id)).toEqual(['DV-fx-002']);
    // a registered path covers the paths below it
    const check = await load<CheckModule>('scripts/check-manifest-settings.mjs');
    const m = check.matchManifestDeviations(
      [{ module: 'm', kind: 'manifest-missing', member: 'a/b/c' }, { module: 'm', kind: 'manifest-missing', member: 'a/bc' }],
      [{ id: 'X', module: 'm', kind: 'manifest-missing', member: 'a/b' }],
    );
    expect(m.registered.map((x) => x.member)).toEqual(['a/b/c']);
    expect(m.unregistered.map((x) => x.member)).toEqual(['a/bc']);
  }, 60_000);

  it('AL-13 the templates\' manifest files are well-formed', async () => {
    const check = await load<CheckModule>('scripts/check-manifest-settings.mjs');
    const manifests = check.loadManifests();
    expect(manifests.map((m) => m.template)).toContain('ListReport');
    for (const m of manifests) {
      expect(m.module).toMatch(/^v4\/fe\/templates\//);
      expect(m.settingsType).toBe(`$${m.template}Settings`);
      const paths = m.settings.map((s) => s.path);
      expect(new Set(paths).size, `${m.template}: duplicate paths`).toBe(paths.length);
      for (const s of m.settings) if (s.type === 'enum') expect(s.values?.length, s.path).toBeGreaterThan(0);
    }
    const lr = manifests.find((m) => m.template === 'ListReport')!;
    const byPath = new Map(lr.settings.map((s) => [s.path, s]));
    // FE defaults from the component @property declarations (docs/26c §1, §3.2)
    expect(byPath.get('initialLoad')?.default).toBe('Auto');
    expect(byPath.get('liveMode')?.default).toBe(false);
    expect(byPath.get('variantManagement')?.default).toBe('Page');
    expect(byPath.get('controlConfiguration/@com.sap.vocabularies.UI.v1.LineItem/tableSettings/creationMode/name')?.default).toBe('NewPage');
  });
});
