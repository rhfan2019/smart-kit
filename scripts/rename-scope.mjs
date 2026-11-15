// ADR-012: replaces the npm scope everywhere (package.json files, imports, docs). Usage:
//   node scripts/rename-scope.mjs <new-scope> [--dry-run]      e.g. node scripts/rename-scope.mjs @acme
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = join(import.meta.dirname, '..');
const OLD = '@rhfan2019';
const [next, ...flags] = process.argv.slice(2);
const dry = flags.includes('--dry-run');
if (!next || !/^@[a-z0-9][a-z0-9._-]*$/.test(next)) {
  console.error('usage: node scripts/rename-scope.mjs <@new-scope> [--dry-run]');
  process.exit(1);
}
const SKIP = new Set(['node_modules', 'dist', '.git', 'bin', 'obj', 'storybook-static', 'test-results', 'playwright-report']);
const EXT = /\.(json|ts|tsx|js|mjs|md|html|css|yml|yaml)$/;
const files = (d) => readdirSync(d).flatMap((n) => (SKIP.has(n) ? [] : statSync(join(d, n)).isDirectory() ? files(join(d, n)) : EXT.test(n) ? [join(d, n)] : []));
const changed = [];
for (const f of files(ROOT)) {
  if (f.endsWith('package-lock.json') || f.includes(`${join('docs', 'prompt')}`)) continue;
  const text = readFileSync(f, 'utf8');
  if (!text.includes(`${OLD}/`)) continue;
  changed.push(relative(ROOT, f));
  if (!dry) writeFileSync(f, text.split(`${OLD}/`).join(`${next}/`));
}
console.log(`${dry ? 'would change' : 'changed'} ${changed.length} file(s):\n${changed.join('\n')}`);
if (!dry) {
  execSync('npm install --no-audit --no-fund', { cwd: ROOT, stdio: 'inherit' });
  // The script itself keeps the old scope as the default "from" value; update OLD when renaming again.
}
