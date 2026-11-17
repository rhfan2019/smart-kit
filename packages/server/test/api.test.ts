/** The entries of the Node packages export exactly the names listed in docs/api.md (like AC-Q-03 for the others). */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as cli from '../../cli/src';
import * as server from '../src';

const doc = readFileSync(join(import.meta.dirname, '../../../docs/api.md'), 'utf8');
function documented(pkg: string): string[] {
  const section = doc.split(/^## /m).find((s) => s.startsWith(`\`${pkg}\``))!;
  return [...section.split('### 类型')[0]!.matchAll(/^- `([\w$]+)`/gm)].map((m) => m[1]!).sort();
}

describe('public API of the Node packages', () => {
  it('server runtime exports match docs/api.md', () => expect(Object.keys(server).sort()).toEqual(documented('@rhfan2019/smart-kit-server')));
  it('cli runtime exports match docs/api.md', () => expect(Object.keys(cli).sort()).toEqual(documented('@rhfan2019/smart-kit-cli')));
});
