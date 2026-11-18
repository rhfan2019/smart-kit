/**
 * ADR-029: the published manifests. `exports` resolves to `dist` for everyone; only this repository turns on the
 * `smart-kit-source` condition (tsconfig `customConditions`, Vite / Vitest `resolve.conditions`, `tsx --conditions`),
 * so what `npm pack` puts in the tarball is the manifest in git (npm does not apply `publishConfig.exports`).
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '../..');
const DIRS = ['packages/core', 'packages/react', 'packages/server', 'packages/cli'];
type Manifest = {
  name: string;
  version: string;
  exports: Record<string, Record<string, string>>;
  publishConfig?: Record<string, unknown>;
  files: string[];
  repository?: { directory?: string };
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  license: string;
};
const read = (dir: string) => JSON.parse(readFileSync(join(ROOT, dir, 'package.json'), 'utf8')) as Manifest;
const manifests = DIRS.map((dir) => [dir, read(dir)] as const);

describe('published manifests (ADR-029)', () => {
  it.each(manifests)('%s: every export has a source condition first and points into dist otherwise', (dir, pkg) => {
    for (const [sub, target] of Object.entries(pkg.exports)) {
      const keys = Object.keys(target);
      expect(keys[0], `${dir} ${sub}`).toBe('smart-kit-source');
      expect(existsSync(join(ROOT, dir, target['smart-kit-source']!)), `${dir} ${sub} source`).toBe(true);
      for (const k of keys.slice(1)) expect(target[k], `${dir} ${sub} ${k}`).toMatch(/^\.\/dist\//);
    }
    expect(pkg.files).toContain('dist');
    expect(pkg.publishConfig).toEqual({ access: 'public' });
  });

  it.each(manifests)('%s: metadata for the npm page', (dir, pkg) => {
    expect(pkg.license).toBe('MIT');
    expect(pkg.repository?.directory).toBe(dir);
    expect(existsSync(join(ROOT, dir, 'README.md')), `${dir}/README.md`).toBe(true);
    expect(pkg.files).toContain('docs');
  });

  it('the four packages share one version and depend on each other at that version (Changesets fixed group)', () => {
    const version = manifests[0]![1].version;
    const names = new Set(manifests.map(([, p]) => p.name));
    for (const [, pkg] of manifests) {
      expect(pkg.version).toBe(version);
      for (const [dep, range] of Object.entries(pkg.dependencies ?? {})) if (names.has(dep)) expect(range, `${pkg.name} -> ${dep}`).toBe(version);
    }
  });

  it('peer dependencies are ranges, not exact versions', () => {
    for (const [, pkg] of manifests) for (const [dep, range] of Object.entries(pkg.peerDependencies ?? {})) expect(range, `${pkg.name} peer ${dep}`).toMatch(/^\^/);
  });
});

describe('no SAP files in the repository or the packages (ADR-033 §9, AL-22)', () => {
  it('AL-22 git tracks no api.json, sap.fe sources or SAPUI5 runtime files', async () => {
    const { execFileSync } = await import('node:child_process');
    const tracked = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean);
    const sap = tracked.filter((f) => /(^|\/)api\.json$|-dbg\.js$|library-preload\.js$|sap-ui-core\.js$|(^|\/)\.cache\//.test(f));
    expect(sap).toEqual([]);
  });

  it.each(manifests)('AL-22 %s publishes only its own files', (_dir, pkg) => {
    expect(pkg.files.every((f) => !/\.cache|api\.json|resources/.test(f))).toBe(true);
  });
});
