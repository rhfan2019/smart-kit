// ADR-029: the declaration files emitted by vite-plugin-dts keep the sources' extensionless relative imports
// ('./model/types'). TypeScript projects with moduleResolution node16 / nodenext (common for Node servers) reject
// those in ESM packages (TS2834), so after the build every relative specifier in dist/**/*.d.ts gets its explicit
// file: './x' -> './x.js' (when x.d.ts exists) or './x/index.js' (when x/index.d.ts exists).
//   node scripts/fix-dts-imports.mjs <package dir>
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const dist = resolve(process.argv[2] ?? '.', 'dist');
const files = readdirSync(dist, { recursive: true }).map(String).filter((f) => f.endsWith('.d.ts'));
let changed = 0;
for (const rel of files) {
  const file = join(dist, rel);
  const dir = dirname(file);
  const text = readFileSync(file, 'utf8');
  const next = text.replace(/((?:from|import)\s*\(?\s*)(['"])(\.{1,2}(?:\/[^'"]*)?)\2/g, (m, pre, q, spec) => {
    if (/\.(js|mjs|cjs|json|css)$/.test(spec)) return m;
    const base = spec.replace(/\/$/, '');
    if (base !== '.' && base !== '..' && existsSync(join(dir, `${base}.d.ts`))) return `${pre}${q}${base}.js${q}`;
    if (existsSync(join(dir, base, 'index.d.ts'))) return `${pre}${q}${base}/index.js${q}`;
    return m;
  });
  if (next !== text) {
    writeFileSync(file, next);
    changed++;
  }
}
console.log(`fix-dts-imports: ${changed} of ${files.length} declaration files in ${dist}`);
