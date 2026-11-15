// AC-Q-04 / ADR-013: trademark words must not appear as standalone words in names.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const WORDS = new Set(['fiori', 'sap', 'sapui5', 'ui5', 'netweaver']);
const files = (d) => readdirSync(d).flatMap((n) => (n === 'node_modules' || n === 'dist' ? [] : statSync(join(d, n)).isDirectory() ? files(join(d, n)) : [join(d, n)]));
/** Splits an identifier into words: camelCase, PascalCase, snake_case, kebab-case, dots. */
export function words(id) {
  return id.replace(/([a-z\d])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2').split(/[^A-Za-z0-9]+/).filter(Boolean).map((w) => w.toLowerCase());
}
const bad = (id) => words(id).some((w) => WORDS.has(w));
const problems = [];
// package names
for (const p of ['package.json', 'packages/core/package.json', 'packages/react/package.json', 'apps/demo/package.json', 'apps/mock/package.json', 'apps/storybook/package.json']) {
  try {
    const name = JSON.parse(readFileSync(join(ROOT, p), 'utf8')).name;
    if (bad(name)) problems.push(`${p}: package name "${name}"`);
  } catch { /* optional */ }
}
for (const f of [...files(join(ROOT, 'packages/core/src')), ...files(join(ROOT, 'packages/react/src'))]) {
  const rel = relative(ROOT, f);
  const text = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  // exported identifiers and component names
  for (const m of text.matchAll(/export\s+(?:declare\s+)?(?:const|function|class|interface|type|enum|let)\s+([A-Za-z_$][\w$]*)/g)) if (bad(m[1])) problems.push(`${rel}: exported "${m[1]}"`);
  for (const m of text.matchAll(/export\s*\{([^}]*)\}/g)) for (const n of m[1].split(',').map((x) => x.trim().split(/\s+as\s+/).pop().replace(/^type\s+/, '')).filter(Boolean)) if (bad(n)) problems.push(`${rel}: exported "${n}"`);
  // CSS class names and custom properties
  for (const m of text.matchAll(/(?:\.|--)(sk-[\w-]+)/g)) if (bad(m[1])) problems.push(`${rel}: css name "${m[1]}"`);
  for (const m of text.matchAll(/className=["'`]([^"'`]+)["'`]/g)) for (const c of m[1].split(/\s+/)) if (bad(c)) problems.push(`${rel}: class "${c}"`);
}
if (problems.length) {
  console.error(`check-trademark: ${problems.length} problem(s)\n${problems.join('\n')}`);
  process.exit(1);
}
console.log('check-trademark: ok');
