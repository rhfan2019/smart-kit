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
