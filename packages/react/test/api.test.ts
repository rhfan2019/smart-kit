/** AC-Q-03: the package entries export exactly the names listed in docs/api.md. */
import { readFileSync } from 'node:fs';
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
    exports: Record<string, unknown>;
    publishConfig: { exports: Record<string, unknown> };
  };
  const subpaths = Object.keys(pkg.exports).filter((k) => k !== '.' && k !== './styles.css');

  it('every subpath has a source entry and a published entry', () => {
    expect(subpaths.length).toBeGreaterThan(0);
    expect(Object.keys(pkg.publishConfig.exports).sort()).toEqual(Object.keys(pkg.exports).sort());
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
