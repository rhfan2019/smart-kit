// AC-Q-02 and ADR-026 P7: bundle size budgets in KB gzip. Run after `npm run build`.
//
// Two kinds of check, both bundled with Vite exactly as an application would bundle the published package:
//  - entry:    one entry point with every dependency external — the library's own code behind that import;
//  - scenario: a tiny application that imports one thing — everything it ships except React itself
//              (Mantine, AG Grid, TanStack Query, smart-kit-core … all count). This is what a user pays.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { build } from 'vite';

const ROOT = join(import.meta.dirname, '..');
const SERVER_DIST = join(ROOT, 'packages/server/dist');
const CLI_DIST = join(ROOT, 'packages/cli/dist');
const DEMO_DIST = join(ROOT, 'apps/demo/dist');
const REACT_DIST = join(ROOT, 'packages/react/dist');
const CORE_DIST = join(ROOT, 'packages/core/dist');

/** Budgets for the library's own code per entry (dependencies external). */
const ENTRY_BUDGETS = {
  'core:.': 60,
  '.': 80,
  context: 8, i18n: 7, theme: 2, util: 1, field: 15, filter: 11, variants: 4, table: 36, chart: 12,
  object: 30, page: 7, actions: 3, edit: 19, messages: 2, templates: 69,
};

/** Budgets for what an application ships when it imports only this (React and React DOM excluded). */
const SCENARIOS = [
  { name: 'MicroChart only', code: "import { MicroChart } from '@rhfan2019/smart-kit/chart'; console.log(MicroChart);", budget: 8 },
  { name: 'MicroChart from the root entry', code: "import { MicroChart } from '@rhfan2019/smart-kit'; console.log(MicroChart);", budget: 8 },
  { name: 'SmartField only', code: "import { SmartField } from '@rhfan2019/smart-kit/field'; console.log(SmartField);", budget: 130 },
  { name: 'List report page', code: "import { SmartListReport } from '@rhfan2019/smart-kit/templates'; console.log(SmartListReport);", budget: 560 },
  { name: 'Object page', code: "import { SmartObjectPage } from '@rhfan2019/smart-kit/templates'; console.log(SmartObjectPage);", budget: 560 },
];

const alias = [
  { find: /^@rhfan2019\/smart-kit-core$/, replacement: join(CORE_DIST, 'index.js') },
  { find: /^@rhfan2019\/smart-kit\/(.+)$/, replacement: join(REACT_DIST, 'entries/$1.js') },
  { find: /^@rhfan2019\/smart-kit$/, replacement: join(REACT_DIST, 'index.js') },
];

/** Bundles `code` and returns the gzip size in KB of all JS chunks. */
async function bundle(code, external, keepExports = false) {
  const id = '\0size-entry';
  const out = await build({
    configFile: false,
    logLevel: 'silent',
    root: ROOT,
    resolve: { alias },
    define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [{ name: 'size-entry', resolveId: (s) => (s === 'size-entry' ? id : null), load: (s) => (s === id ? code : null) }],
    build: {
      write: false,
      minify: true,
      modulePreload: false,
      rollupOptions: { input: 'size-entry', external, ...(keepExports ? { preserveEntrySignatures: 'strict' } : {}) },
    },
  });
  const outputs = (Array.isArray(out) ? out : [out]).flatMap((o) => o.output);
  // Lazily loaded chunks (e.g. the Excel writer) are not part of the first load; count only the entry chunk and its static imports.
  const entry = outputs.find((o) => o.type === 'chunk' && o.isEntry);
  const seen = new Set();
  const walk = (name) => {
    if (seen.has(name)) return;
    seen.add(name);
    const chunk = outputs.find((o) => o.fileName === name);
    for (const i of chunk?.imports ?? []) walk(i);
  };
  walk(entry.fileName);
  const bytes = outputs.filter((o) => o.type === 'chunk' && seen.has(o.fileName)).reduce((n, o) => n + gzipSync(o.code).length, 0);
  return bytes / 1024;
}

const isPackage = (id) => !id.startsWith('.') && !id.startsWith('/') && !id.startsWith('\0') && id !== 'size-entry';
const reactOnly = (id) => id === 'react' || id === 'react-dom' || id.startsWith('react/') || id.startsWith('react-dom/');

let failed = false;
const report = (label, kb, budget) => {
  const ok = kb <= budget;
  failed ||= !ok;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label.padEnd(46)} ${kb.toFixed(1).padStart(6)} KB gzip (budget ${budget} KB)`);
};

const entryNames = ['.', ...readdirSync(join(REACT_DIST, 'entries')).filter((f) => f.endsWith('.js')).map((f) => f.slice(0, -3))];
console.log('Library code per entry (dependencies external):');
report('@rhfan2019/smart-kit-core', await bundle("export * from '@rhfan2019/smart-kit-core';", (id) => isPackage(id) && id !== '@rhfan2019/smart-kit-core', true), ENTRY_BUDGETS['core:.']);
for (const name of entryNames) {
  const spec = name === '.' ? '@rhfan2019/smart-kit' : `@rhfan2019/smart-kit/${name}`;
  const budget = ENTRY_BUDGETS[name];
  if (budget === undefined) {
    console.error(`FAIL ${spec}: no budget in scripts/check-size.mjs`);
    failed = true;
    continue;
  }
  report(spec, await bundle(`export * from '${spec}';`, (id) => isPackage(id) && !id.startsWith('@rhfan2019/'), true), budget);
}
// P5: one stylesheet for all components (styles.css imports tokens.css).
const css = ['styles.css', 'tokens.css'].reduce((n, f) => n + gzipSync(readFileSync(join(REACT_DIST, f))).length, 0) / 1024;
report('@rhfan2019/smart-kit/styles.css (with tokens.css)', css, 13);

console.log('\nWhat an application ships (everything except React):');
for (const s of SCENARIOS) report(s.name, await bundle(s.code, reactOnly), s.budget);

// ADR-027: the server packages are Node only. Their own code gets a budget like any entry (new in 2026-11: the
// OData service is ~21 KB gzip, the CLI ~8 KB; the budgets leave room for writes and drafts), and none of their
// code or dependencies may reach a browser bundle: core, the React package and the built demo app are scanned.
console.log('\nNode-only packages (ADR-027):');
const gz = (dir) => readdirSync(dir, { recursive: true }).filter((f) => String(f).endsWith('.js')).reduce((n, f) => n + gzipSync(readFileSync(join(dir, String(f)))).length, 0) / 1024;
report('@rhfan2019/smart-kit-server (own code)', gz(SERVER_DIST), 30);
report('@rhfan2019/smart-kit-cli (own code)', gz(CLI_DIST), 12);
const SERVER_ONLY = /\bfrom\s*["'](?:@rhfan2019\/smart-kit-(?:server|cli)|kysely|chevrotain|pg|pg-pool|pg-protocol|node:[a-z_/]+)["']|\bclass\s+\w*SqlBuilder\b|createODataService|PostgresDialect/;
for (const [label, dir] of [['@rhfan2019/smart-kit-core dist', CORE_DIST], ['@rhfan2019/smart-kit dist', REACT_DIST], ['apps/demo build', DEMO_DIST]]) {
  const hits = readdirSync(dir, { recursive: true })
    .filter((f) => String(f).endsWith('.js'))
    .filter((f) => SERVER_ONLY.test(readFileSync(join(dir, String(f)), 'utf8')));
  const ok = hits.length === 0;
  failed ||= !ok;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${`${label}: no server code`.padEnd(46)} ${ok ? '' : hits.join(', ')}`);
}
process.exit(failed ? 1 : 0);
