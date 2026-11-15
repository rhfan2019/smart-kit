// AC-Q-02: bundle size budgets (gzip, peer dependencies excluded). Run after `npm run build`.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const ROOT = join(import.meta.dirname, '..');
const BUDGETS = [
  ['packages/core/dist/index.js', 60],
  ['packages/react/dist/index.js', 80],
];
let failed = false;
for (const [file, kb] of BUDGETS) {
  const path = join(ROOT, file);
  if (!existsSync(path)) {
    console.error(`check-size: ${file} not found; run "npm run build" first`);
    process.exit(1);
  }
  const size = gzipSync(readFileSync(path)).length / 1024;
  const ok = size <= kb;
  failed ||= !ok;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${file}: ${size.toFixed(1)} KB gzip (budget ${kb} KB)`);
}
process.exit(failed ? 1 : 0);
