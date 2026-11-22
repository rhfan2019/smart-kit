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
  // context, i18n 13 → 14, 8 → 10: the texts of stage 6 (p13n panels, QuickView, mass edit, New Object dialog, chart personalization)
  // context 14 → 15 (0.5.0, D51): the grid's screen reader texts
  context: 15, i18n: 10, theme: 2, util: 12, // util 1 → 11 with the helpers from /controls (stage 1, ADR-033: messageTypeOf, toDates, viewSettingsFilterString …)
  // stage 2 (D38): the block subpaths are gone, the blocks are measured as modules below
};

/**
 * Budgets for the UI5-aligned modules (ADR-033): one module per class, library code only (dependencies external).
 * A module not listed here gets MODULE_DEFAULT. The former /controls, /messages and /cards entries were 59, 16 and 23 KB.
 */
// most controls share about 8 KB (provider texts and helpers); budgets are the first measurement plus about 15 %
// 14 → 16 (stage 6): the shared texts grew with the stage 6 controls (p13n panels, QuickView, mass edit)
const MODULE_DEFAULT = 16;
const MODULE_BUDGETS = {
  'm/DynamicDateRange': 21, 'm/IllustratedMessage': 16, 'm/plugins/UploadSetwithTable': 25,
  // stage 2 (D38): the building blocks; Table / TreeTable are the former /table entry (40 KB) plus the sap.fe.macros.Table API
  // (66 KB for Table / TreeTable, 19 / 20 KB for Field / Form after stage 4: FE column types, inline action columns, value display)
  // (FilterBar 30, ConditionInput / ValueHelpDialog 21 KB after stage 4: FE semantic date operators, value help descriptions and qualified lists)
  // the page templates (were together the /templates entry, 118 KB; stage 5 splits them into their sap.fe.templates modules)
  // (112 / 100 KB in stage 5; CreateDialog 20, HeaderFacet 23, QuickViewLink 19 KB before stage 6)
  // stage 6 (D47): Field renders the nine sap.suite.ui.microchart controls (DataPoint / Chart visualizations, +11 KB) and
  // the full sap.m.QuickView (pages, groups, navigation, +6 KB); every module that renders Field grows with it
  'v4/fe/macros/Field': 40, 'v4/fe/macros/Form': 41, 'kit/CreateDialog': 41, 'kit/HeaderFacet': 44, 'kit/QuickViewLink': 40,
  // stage 6 (D47): Table / TreeTable add the grouped analytical hierarchy, mass edit, paste, the table's own variant
  // management, quick variant selection and presentation / selection variant methods; Chart adds its p13n popup
  // (m/p13n panels), variant management and toolbar overflow groups; FilterBar the variant key methods
  'v4/fe/macros/Table': 100, 'v4/fe/macros/TreeTable': 100, 'v4/fe/macros/Chart': 48, 'v4/fe/macros/FilterBar': 32,
  'kit/ConditionInput': 23, 'kit/ValueHelpDialog': 23,
  // stage 7 (D48): Chart's action groups (split button, AI marker); Timeline grew with the shared texts
  'suite/ui/commons/Timeline': 17,
  // stage 6 (D47): ListReport adds the New Object dialog, combined views, Control variant management; ObjectPage the
  // FE header action order, the stage 6 object page settings and Field's growth
  'v4/fe/templates/ListReport': 140, 'v4/fe/templates/ObjectPage': 130,
};

/** Budgets for what an application ships when it imports only this (React and React DOM excluded). */
const SCENARIOS = [
  // sap.fe.macros.MicroChart is annotation-driven (provider, model); the 8 KB data-only micro chart returns with the nine
  // sap.suite.ui.microchart controls in stage 6 (D38)
  { name: 'MicroChart only (v4/fe/macros/MicroChart)', code: "import MicroChart from '@rhfan2019/smart-kit/v4/fe/macros/MicroChart'; console.log(MicroChart);", budget: 44 },
  // the data-only micro charts are back (stage 6): one sap.suite.ui.microchart control without model or provider
  { name: 'BulletMicroChart only (suite/ui/microchart/BulletMicroChart)', code: "import BulletMicroChart from '@rhfan2019/smart-kit/suite/ui/microchart/BulletMicroChart'; console.log(BulletMicroChart);", budget: 4 },
  { name: 'Field only (v4/fe/macros/Field)', code: "import Field from '@rhfan2019/smart-kit/v4/fe/macros/Field'; console.log(Field);", budget: 140 }, // 130 → 140: micro charts and QuickView (stage 6, D47)
  { name: 'List report page', code: "import ListReport from '@rhfan2019/smart-kit/v4/fe/templates/ListReport'; console.log(ListReport);", budget: 620 }, // 560 → 580: stage 4 list report annotations; 580 → 620: stage 6 (D47),
  { name: 'Object page', code: "import ObjectPage from '@rhfan2019/smart-kit/v4/fe/templates/ObjectPage'; console.log(ObjectPage);", budget: 600 }, // 560 → 600: stage 6 (D47)
  // Cards (docs/20, ADR-028): a card with its content, no AG Grid.
  { name: 'Card + Header only (Component card)', code: "import Card from '@rhfan2019/smart-kit/f/Card'; import Header from '@rhfan2019/smart-kit/f/cards/Header'; console.log(Card, Header);", budget: 5 }, // 2 → 5: the sap.f.cards.Header API of 1.154 (avatar settings, dataTimestamp, infoSection, toolbar; stage 1)
  { name: 'List card (Card + Header + ListContent)', code: "import Card from '@rhfan2019/smart-kit/f/Card'; import Header from '@rhfan2019/smart-kit/f/cards/Header'; import ListContent from '@rhfan2019/smart-kit/ui/integration/cards/ListContent'; console.log(Card, Header, ListContent);", budget: 48 }, // 45 → 48: the 1.154 header API (stage 1)
  { name: 'Calendar card (Card + Header + CalendarContent)', code: "import Card from '@rhfan2019/smart-kit/f/Card'; import Header from '@rhfan2019/smart-kit/f/cards/Header'; import CalendarContent from '@rhfan2019/smart-kit/ui/integration/cards/CalendarContent'; console.log(Card, Header, CalendarContent);", budget: 49 },
  { name: 'Analytical card (NumericHeader + AnalyticalContent)', code: "import Card from '@rhfan2019/smart-kit/f/Card'; import NumericHeader from '@rhfan2019/smart-kit/f/cards/NumericHeader'; import AnalyticalContent from '@rhfan2019/smart-kit/ui/integration/cards/AnalyticalContent'; console.log(Card, NumericHeader, AnalyticalContent);", budget: 55 },
  // UI5 modules (ADR-033): one control costs only itself
  { name: 'MessageStrip only (m/MessageStrip)', code: "import MessageStrip from '@rhfan2019/smart-kit/m/MessageStrip'; console.log(MessageStrip);", budget: 40 },
  { name: 'ValueState only (ui/core/library)', code: "import { ValueState } from '@rhfan2019/smart-kit/ui/core/library'; console.log(ValueState);", budget: 1 },
];

const alias = [
  { find: /^@rhfan2019\/smart-kit-core$/, replacement: join(CORE_DIST, 'index.js') },
  // UI5-aligned modules live at their path in dist (dist/m/MessageBox.js), the other subpaths in dist/entries
  { find: /^@rhfan2019\/smart-kit\/((?:base|f|kit|m|suite|ui|uxap|v4)\/.+)$/, replacement: join(REACT_DIST, '$1.js') },
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
  .filter((k) => /^\.\/(base|f|kit|m|suite|ui|uxap|v4)\//.test(k)).map((k) => k.slice(2));
for (const name of moduleNames) {
  const spec = `@rhfan2019/smart-kit/${name}`;
  const code = name.endsWith('/library') ? `export * from '${spec}';` : `export { default } from '${spec}'; export * from '${spec}';`;
  report(spec, await bundle(code, (id) => isPackage(id) && !id.startsWith('@rhfan2019/'), true), MODULE_BUDGETS[name] ?? MODULE_DEFAULT);
}
// P5: one stylesheet for all components (styles.css imports tokens.css). 13 → 16 KB with the cards (ADR-028, about 4 KB).
const css = ['styles.css', 'tokens.css'].reduce((n, f) => n + gzipSync(readFileSync(join(REACT_DIST, f))).length, 0) / 1024;
// 16 → 17 KB: data-sk-theme selectors beside the former data-theme ones (S7), FCL separator, relative dates (S6, S23)
report('@rhfan2019/smart-kit/styles.css (with tokens.css)', css, 30); // 29 → 30 (0.5.0, D51): block grid steps, hidden first section title // 27 → 29: page controls of stage 2 (title toolbar, anchor bar, micro chart sizes) // 17 → 27 with the controls (docs/26, about 8 KB) and the tree table

console.log('\nWhat an application ships (everything except React):');
for (const s of SCENARIOS) report(s.name, await bundle(s.code, reactOnly), s.budget);

// ADR-027: the server packages are Node only. Their own code gets a budget like any entry (new in 2026-11: the
// OData service is ~21 KB gzip, the CLI ~8 KB; the budgets leave room for writes and drafts), and none of their
// code or dependencies may reach a browser bundle: core, the React package and the built demo app are scanned.
console.log('\nNode-only packages (ADR-027):');
const gz = (dir) => readdirSync(dir, { recursive: true }).filter((f) => String(f).endsWith('.js')).reduce((n, f) => n + gzipSync(readFileSync(join(dir, String(f)))).length, 0) / 1024;
report('@rhfan2019/smart-kit-server (own code)', gz(SERVER_DIST), 34); // 30 → 34 (0.5.0, ADR-034): $batch, unmanaged save, unit of work
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
