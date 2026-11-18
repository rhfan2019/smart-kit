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
// context, messages, templates: MessageToast / MessageBox host in the SmartKitProvider and the message controls (docs/26)
const ENTRY_BUDGETS = {
  'core:.': 60,
  '.': 154, // everything, all subpaths together; 80 → 95 with the cards (ADR-028, /cards ≈ 18 KB); 95 → 154 with the controls (docs/26, /controls ≈ 57 KB) and the tree table
  // context, i18n, table, templates +1 to +2: the texts and the code of relative dates and the FCL separator (S6, S23)
  context: 12, i18n: 8, theme: 2, util: 4, // util 1 → 4 with the helpers from /controls (stage 1, ADR-033)
  field: 15, filter: 11, variants: 4, table: 40, chart: 12,
  object: 30, page: 7, actions: 3, edit: 19, templates: 84,
};

/**
 * Budgets for the UI5-aligned modules (ADR-033): one module per class, library code only (dependencies external).
 * A module not listed here gets MODULE_DEFAULT. The former /controls, /messages and /cards entries were 59, 16 and 23 KB.
 */
// most controls share about 8 KB (provider texts and helpers); budgets are the first measurement plus about 15 %
const MODULE_DEFAULT = 14;
const MODULE_BUDGETS = { 'm/DynamicDateRange': 19, 'm/plugins/UploadSetwithTable': 22 };

/** Budgets for what an application ships when it imports only this (React and React DOM excluded). */
const SCENARIOS = [
  { name: 'MicroChart only', code: "import { MicroChart } from '@rhfan2019/smart-kit/chart'; console.log(MicroChart);", budget: 8 },
  { name: 'MicroChart from the root entry', code: "import { MicroChart } from '@rhfan2019/smart-kit'; console.log(MicroChart);", budget: 8 },
  { name: 'SmartField only', code: "import { SmartField } from '@rhfan2019/smart-kit/field'; console.log(SmartField);", budget: 130 },
  { name: 'List report page', code: "import { SmartListReport } from '@rhfan2019/smart-kit/templates'; console.log(SmartListReport);", budget: 560 },
  { name: 'Object page', code: "import { SmartObjectPage } from '@rhfan2019/smart-kit/templates'; console.log(SmartObjectPage);", budget: 560 },
  // Cards (docs/20, ADR-028): a card with its content, no AG Grid.
  { name: 'Card + Header only (Component card)', code: "import Card from '@rhfan2019/smart-kit/f/Card'; import Header from '@rhfan2019/smart-kit/f/cards/Header'; console.log(Card, Header);", budget: 2 },
  { name: 'List card (Card + Header + ListContent)', code: "import Card from '@rhfan2019/smart-kit/f/Card'; import Header from '@rhfan2019/smart-kit/f/cards/Header'; import ListContent from '@rhfan2019/smart-kit/ui/integration/cards/ListContent'; console.log(Card, Header, ListContent);", budget: 45 },
  { name: 'Calendar card (Card + Header + CalendarContent)', code: "import Card from '@rhfan2019/smart-kit/f/Card'; import Header from '@rhfan2019/smart-kit/f/cards/Header'; import CalendarContent from '@rhfan2019/smart-kit/ui/integration/cards/CalendarContent'; console.log(Card, Header, CalendarContent);", budget: 46 },
  { name: 'Analytical card (NumericHeader + AnalyticalContent)', code: "import Card from '@rhfan2019/smart-kit/f/Card'; import NumericHeader from '@rhfan2019/smart-kit/f/cards/NumericHeader'; import AnalyticalContent from '@rhfan2019/smart-kit/ui/integration/cards/AnalyticalContent'; console.log(Card, NumericHeader, AnalyticalContent);", budget: 52 },
  // UI5 modules (ADR-033): one control costs only itself
  { name: 'MessageStrip only (m/MessageStrip)', code: "import MessageStrip from '@rhfan2019/smart-kit/m/MessageStrip'; console.log(MessageStrip);", budget: 40 },
  { name: 'ValueState only (ui/core/library)', code: "import { ValueState } from '@rhfan2019/smart-kit/ui/core/library'; console.log(ValueState);", budget: 1 },
];

const alias = [
  { find: /^@rhfan2019\/smart-kit-core$/, replacement: join(CORE_DIST, 'index.js') },
  // UI5-aligned modules live at their path in dist (dist/m/MessageBox.js), the other subpaths in dist/entries
  { find: /^@rhfan2019\/smart-kit\/((?:base|f|kit|m|suite|ui|v4)\/.+)$/, replacement: join(REACT_DIST, '$1.js') },
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
const moduleNames = Object.keys(JSON.parse(readFileSync(join(ROOT, 'packages/react/package.json'), 'utf8')).exports)
  .filter((k) => /^\.\/(base|f|kit|m|suite|ui|v4)\//.test(k)).map((k) => k.slice(2));
for (const name of moduleNames) {
  const spec = `@rhfan2019/smart-kit/${name}`;
  const code = name.endsWith('/library') ? `export * from '${spec}';` : `export { default } from '${spec}'; export * from '${spec}';`;
  report(spec, await bundle(code, (id) => isPackage(id) && !id.startsWith('@rhfan2019/'), true), MODULE_BUDGETS[name] ?? MODULE_DEFAULT);
}
// P5: one stylesheet for all components (styles.css imports tokens.css). 13 → 16 KB with the cards (ADR-028, about 4 KB).
const css = ['styles.css', 'tokens.css'].reduce((n, f) => n + gzipSync(readFileSync(join(REACT_DIST, f))).length, 0) / 1024;
// 16 → 17 KB: data-sk-theme selectors beside the former data-theme ones (S7), FCL separator, relative dates (S6, S23)
report('@rhfan2019/smart-kit/styles.css (with tokens.css)', css, 27); // 17 → 27 with the controls (docs/26, about 8 KB) and the tree table

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
