/** AC-Q-03: the package entries export exactly the names listed in docs/api.md. */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as core from '../../core/src';
import * as react from '../src';

const doc = readFileSync(join(import.meta.dirname, '../../../docs/api.md'), 'utf8');
function documented(pkg: string): string[] {
  const section = doc.split(/^## /m).find((s) => s.startsWith(`\`${pkg}\``))!;
  const values = section.split('### 类型')[0]!;
  return [...values.matchAll(/^- `([\w$]+)`/gm)].map((m) => m[1]!).sort();
}

describe('public API (AC-Q-03, P2-GEN-07)', () => {
  it('core runtime exports match docs/api.md', () => {
    expect(Object.keys(core).sort()).toEqual(documented('@rhfan2019/smart-kit-core'));
  });
  it('react runtime exports match docs/api.md', () => {
    expect(Object.keys(react).sort()).toEqual(documented('@rhfan2019/smart-kit'));
  });
});

describe('subpath entries (ADR-026)', () => {
  const pkg = JSON.parse(readFileSync(join(import.meta.dirname, '../package.json'), 'utf8')) as {
    exports: Record<string, Record<string, string>>;
  };
  const subpaths = Object.keys(pkg.exports).filter((k) => k !== '.' && !k.endsWith('.css'));

  it('every subpath has a source entry and a published entry (ADR-029)', () => {
    expect(subpaths.length).toBeGreaterThan(0);
    for (const sub of subpaths) {
      const name = sub.slice(2);
      expect(pkg.exports[sub]).toEqual({
        'smart-kit-source': `./src/entries/${name}.ts`,
        types: `./dist/entries/${name}.d.ts`,
        import: `./dist/entries/${name}.js`,
      });
    }
  });

  it('the subpaths together export exactly what the root entry exports, each name once', async () => {
    const seen: string[] = [];
    for (const sub of subpaths) {
      const mod = (await import(`../src/entries/${sub.slice(2)}.ts`)) as Record<string, unknown>;
      for (const name of Object.keys(mod)) {
        expect(react[name as keyof typeof react], `${sub} exports ${name}`).toBe(mod[name]);
        seen.push(name);
      }
    }
    expect(new Set(seen).size).toBe(seen.length);
    expect(seen.sort()).toEqual(Object.keys(react).sort());
  });
});

describe("'use client' (S9)", () => {
  it('the root entry and every React entry start with the directive; /i18n (no React) does not', () => {
    const src = join(import.meta.dirname, '../src');
    const first = (f: string) => readFileSync(join(src, f), 'utf8').split('\n')[0];
    expect(first('index.ts')).toBe("'use client';");
    for (const f of readdirSync(join(src, 'entries'))) expect(first(`entries/${f}`), f).toBe(f === 'i18n.ts' ? first('entries/i18n.ts') : "'use client';");
    expect(first('entries/i18n.ts')).not.toContain('use client');
  });
});

describe('layered stylesheet (S8)', () => {
  it('styles.layered.css is exported and imports styles.css into the smart-kit layer', () => {
    const pkg = JSON.parse(readFileSync(join(import.meta.dirname, '../package.json'), 'utf8')) as { exports: Record<string, Record<string, string>> };
    expect(pkg.exports['./styles.layered.css']).toEqual({ 'smart-kit-source': './src/theme/styles.layered.css', default: './dist/styles.layered.css' });
    expect(readFileSync(join(import.meta.dirname, '../src/theme/styles.layered.css'), 'utf8')).toContain("@import './styles.css' layer(smart-kit);");
  });
});
