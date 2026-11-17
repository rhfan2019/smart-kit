// ADR-029: installs the packed tarballs into fresh projects outside the repository and checks what a user gets.
//   node scripts/verify-pack.mjs [--keep]        (after `npm run build`; needs network access for the registry)
//   node scripts/verify-pack.mjs --registry      (after a release: installs the published versions from npm instead of
//                                                 tarballs of this checkout; the tarball checks are skipped)
//
// Web project (Vite + React + TypeScript, the peer dependencies at the tested versions):
//   - every subpath of @rhfan2019/smart-kit (and core) imports at runtime and exports what docs/api.md lists;
//   - the types are found: every value and type name from docs/api.md, with moduleResolution "bundler" and "nodenext";
//   - an app that imports only MicroChart ships what scripts/check-size.mjs measures (same method, ± 0.3 KB);
//   - styles.css resolves and ends up in the built app;
//   - the docs for coding agents are in the package (node_modules/@rhfan2019/smart-kit/docs, skills).
// Node project: smart-kit-server answers $metadata (and reads rows when the PostgreSQL test bed is there),
//   the `smart-kit` command runs (`--help`, `check --strict` on the test bed's annotations), and `smart-kit agents`
//   writes the AGENTS.md block.
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const ROOT = join(import.meta.dirname, '..');
const keep = process.argv.includes('--keep');
const fromRegistry = process.argv.includes('--registry');
const work = mkdtempSync(join(tmpdir(), 'smart-kit-verify-'));
const PACKAGES = { core: 'packages/core', react: 'packages/react', server: 'packages/server', cli: 'packages/cli' };
const json = (f) => JSON.parse(readFileSync(f, 'utf8'));
const run = (cmd, args, cwd, opts = {}) => execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts });
let failures = 0;
const check = (ok, label, detail = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${detail ? `  ${detail}` : ''}`);
};

// 1. pack -------------------------------------------------------------------------------------------------------
const tgz = {};
if (fromRegistry) {
  // the published version of this checkout, e.g. "0.1.0"; tgz[key] becomes that version range
  for (const [key, dir] of Object.entries(PACKAGES)) {
    const { name, version } = json(join(ROOT, dir, 'package.json'));
    let published = '';
    try { published = run('npm', ['view', '--prefer-online', `${name}@${version}`, 'version'], work).trim(); } catch { /* 404: not (yet) published */ }
    check(published === version, `${name}@${version} is on the registry`, published || 'not found');
    tgz[key] = version;
  }
  if (failures) {
    console.log('\nverify-pack: not every package is on the registry yet (a new package can take a few minutes to appear)');
    process.exit(1);
  }
} else {
for (const dir of Object.values(PACKAGES)) if (!existsSync(join(ROOT, dir, 'dist'))) throw new Error(`${dir}/dist is missing: run npm run build first`);
mkdirSync(join(work, 'tarballs'));
for (const [key, dir] of Object.entries(PACKAGES)) {
  const [info] = JSON.parse(run('npm', ['pack', '--json', '--pack-destination', join(work, 'tarballs')], join(ROOT, dir)));
  tgz[key] = join(work, 'tarballs', info.filename);
  const files = info.files.map((f) => f.path);
  check(!files.some((f) => f.startsWith('src/') || f.startsWith('test/')), `${info.name}: tarball has no src/ or test/`, `${files.length} files, ${(info.size / 1024).toFixed(0)} KB`);
  check(files.includes('README.md') && files.includes('LICENSE'), `${info.name}: README.md and LICENSE in the tarball`);
  const manifest = JSON.parse(run('tar', ['-xOzf', tgz[key], 'package/package.json'], work));
  const targets = JSON.stringify(manifest.exports);
  const missing = [...targets.matchAll(/"(\.\/dist\/[^"]+)"/g)].map((m) => m[1].slice(2)).filter((f) => !files.includes(f));
  check(missing.length === 0, `${info.name}: every exports target is in the tarball`, missing.join(', '));
}

}

// 2. web project ------------------------------------------------------------------------------------------------
const reactPkg = json(join(ROOT, PACKAGES.react, 'package.json'));
const tested = (name) => reactPkg.devDependencies[name] ?? reactPkg.dependencies[name];
const web = join(work, 'web');
mkdirSync(join(web, 'src'), { recursive: true });
const peers = Object.fromEntries(Object.keys(reactPkg.peerDependencies).map((n) => [n, tested(n)]));
writeFileSync(join(web, 'package.json'), JSON.stringify({
  name: 'verify-web', private: true, type: 'module',
  dependencies: { '@rhfan2019/smart-kit-core': tgz.core, '@rhfan2019/smart-kit': tgz.react, ...peers },
  devDependencies: {
    typescript: json(join(ROOT, 'package.json')).devDependencies.typescript,
    vite: tested('vite'), '@vitejs/plugin-react': tested('@vitejs/plugin-react'),
    '@types/react': tested('@types/react'), '@types/react-dom': tested('@types/react-dom'),
  },
}, null, 2));
console.log(`\ninstalling the web project in ${web} …`);
run('npm', ['install', '--no-audit', '--no-fund', '--loglevel=error', ...(fromRegistry ? ['--prefer-online'] : [])], web);

// runtime: every entry imports in Node (no bundler) and exports the documented names
const api = readFileSync(join(ROOT, 'docs/api.md'), 'utf8');
const documented = (pkg, kind) => {
  const section = api.split(/^## /m).find((s) => s.startsWith(`\`${pkg}\``));
  const part = kind === 'values' ? section.split('### 类型')[0] : section.split('### 类型')[1] ?? '';
  return [...part.matchAll(/^- `([\w$]+)`/gm)].map((m) => m[1]).sort();
};
const subpaths = Object.keys(reactPkg.exports).filter((k) => k !== './styles.css').map((k) => (k === '.' ? '@rhfan2019/smart-kit' : `@rhfan2019/smart-kit/${k.slice(2)}`));
writeFileSync(join(web, 'exports.mjs'), `const out = {};\nfor (const s of ${JSON.stringify(['@rhfan2019/smart-kit-core', ...subpaths])}) out[s] = Object.keys(await import(s)).sort();\nconsole.log(JSON.stringify(out));\n`);
let exportsBySubpath = {};
try {
  exportsBySubpath = JSON.parse(run('node', ['exports.mjs'], web));
  check(true, `runtime: ${Object.keys(exportsBySubpath).length} entries import in Node`);
} catch (e) {
  check(false, 'runtime: every entry imports in Node', String(e.stderr ?? e).split('\n').slice(0, 5).join(' | '));
}
const sameList = (a, b) => JSON.stringify(a) === JSON.stringify(b);
if (exportsBySubpath['@rhfan2019/smart-kit']) {
  check(sameList(exportsBySubpath['@rhfan2019/smart-kit'], documented('@rhfan2019/smart-kit', 'values')), 'runtime: root entry exports what docs/api.md lists');
  check(sameList(exportsBySubpath['@rhfan2019/smart-kit-core'], documented('@rhfan2019/smart-kit-core', 'values')), 'runtime: core exports what docs/api.md lists');
}

// types: every documented name resolves through the published .d.ts files, from its subpath
// one file per entry (the same names are exported by the root entry and by a subpath)
const typeFiles = [];
Object.entries(exportsBySubpath).forEach(([spec, names], i) => {
  if (!names.length) return;
  const extra = spec === '@rhfan2019/smart-kit' ? `export type { ${documented(spec, 'types').join(', ')} } from '${spec}';\n`
    : spec === '@rhfan2019/smart-kit-core' ? `export type { ${documented(spec, 'types').join(', ')} } from '${spec}';\n` : '';
  const f = `src/names${i}.ts`;
  writeFileSync(join(web, f), `export { ${names.join(', ')} } from '${spec}';\n${extra}`);
  typeFiles.push(f);
});
for (const [resolution, module] of [['bundler', 'ESNext'], ['nodenext', 'NodeNext']]) {
  writeFileSync(join(web, `tsconfig.${resolution}.json`), JSON.stringify({
    compilerOptions: { target: 'ES2023', module, moduleResolution: resolution, jsx: 'react-jsx', strict: true, noEmit: true, skipLibCheck: false, types: [], lib: ['ES2023', 'DOM', 'DOM.Iterable'] },
    files: typeFiles,
  }, null, 2));
  // skipLibCheck false so that our own .d.ts files are checked; errors inside other packages' declarations
  // (e.g. Mantine's side-effect CSS imports) are not ours and are ignored
  let own = [];
  try {
    run(join(web, 'node_modules/.bin/tsc'), ['-p', `tsconfig.${resolution}.json`], web);
  } catch (e) {
    const out = String(e.stdout ?? '') + String(e.stderr ?? '');
    own = out.split('\n').filter((l) => /error TS/.test(l) && (l.startsWith('node_modules/@rhfan2019/') || l.startsWith('src/')));
    if (!own.length && !/error TS/.test(out)) own = [out.split('\n').slice(0, 3).join(' | ')];
  }
  check(own.length === 0, `types: every documented name resolves (moduleResolution ${resolution}, smart-kit's .d.ts checked)`, own.slice(0, 6).join(' | '));
}

// the app: only MicroChart, plus the stylesheet
writeFileSync(join(web, 'index.html'), '<!doctype html><html><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>\n');
writeFileSync(join(web, 'src/main.tsx'), [
  "import '@rhfan2019/smart-kit/styles.css';",
  "import { createRoot } from 'react-dom/client';",
  "import { MicroChart } from '@rhfan2019/smart-kit/chart';",
  "createRoot(document.getElementById('root')!).render(<MicroChart kind=\"column\" label=\"Sales\" points={[{ label: 'a', value: 1 }, { label: 'b', value: 3 }]} />);",
  '',
].join('\n'));
writeFileSync(join(web, 'vite.config.js'), "import react from '@vitejs/plugin-react';\nexport default { plugins: [react()], logLevel: 'error' };\n");
try {
  run(join(web, 'node_modules/.bin/vite'), ['build'], web);
  const assets = readdirSync(join(web, 'dist/assets'));
  const css = assets.filter((f) => f.endsWith('.css')).map((f) => readFileSync(join(web, 'dist/assets', f), 'utf8')).join('');
  check(css.includes('--sk-') && css.includes('.sk-'), 'styles.css: resolves and ends up in the built app', `${(gzipSync(css).length / 1024).toFixed(1)} KB gzip`);
} catch (e) {
  check(false, 'vite build of the MicroChart app', String(e.stderr ?? e).split('\n').slice(0, 5).join(' | '));
}
// same measurement as check-size.mjs ("MicroChart only", everything except React), but resolved through node_modules
writeFileSync(join(web, 'measure.mjs'), `import { build } from 'vite';
import { gzipSync } from 'node:zlib';
const id = '\\0size-entry';
const code = "import { MicroChart } from '@rhfan2019/smart-kit/chart'; console.log(MicroChart);";
const reactOnly = (s) => s === 'react' || s === 'react-dom' || s.startsWith('react/') || s.startsWith('react-dom/');
const out = await build({ configFile: false, logLevel: 'silent', define: { 'process.env.NODE_ENV': '"production"' },
  plugins: [{ name: 'size-entry', resolveId: (s) => (s === 'size-entry' ? id : null), load: (s) => (s === id ? code : null) }],
  build: { write: false, minify: true, modulePreload: false, rollupOptions: { input: 'size-entry', external: reactOnly } } });
const chunks = (Array.isArray(out) ? out : [out]).flatMap((o) => o.output).filter((o) => o.type === 'chunk');
console.log((chunks.reduce((n, o) => n + gzipSync(o.code).length, 0) / 1024).toFixed(2));
`);
try {
  const installed = Number(run('node', ['measure.mjs'], web).trim());
  const sizeOut = run('node', ['scripts/check-size.mjs'], ROOT);
  const repo = Number(/MicroChart only\s+([\d.]+) KB/.exec(sizeOut)?.[1]);
  check(Math.abs(installed - repo) <= 0.3 && installed <= 8, 'size: an app with only MicroChart ships what check-size.mjs measures', `installed ${installed.toFixed(1)} KB, repo ${repo} KB gzip`);
} catch (e) {
  check(false, 'size: MicroChart only', String(e.stderr ?? e).split('\n').slice(0, 5).join(' | '));
}
// docs for coding agents ship with the package
const docsDir = join(web, 'node_modules/@rhfan2019/smart-kit/docs');
check(existsSync(join(docsDir, 'README.md')), 'agent docs: node_modules/@rhfan2019/smart-kit/docs/README.md');
check(existsSync(join(web, 'node_modules/@rhfan2019/smart-kit/skills/smart-kit-getting-started/SKILL.md')), 'agent docs: skills/smart-kit-getting-started/SKILL.md');

// 3. Node project -----------------------------------------------------------------------------------------------
const node = join(work, 'node');
mkdirSync(node);
writeFileSync(join(node, 'package.json'), JSON.stringify({
  name: 'verify-node', private: true, type: 'module',
  dependencies: { '@rhfan2019/smart-kit-core': tgz.core, '@rhfan2019/smart-kit-server': tgz.server, kysely: json(join(ROOT, PACKAGES.server, 'package.json')).dependencies.kysely },
  devDependencies: { '@rhfan2019/smart-kit-cli': tgz.cli },
}, null, 2));
console.log(`\ninstalling the Node project in ${node} …`);
run('npm', ['install', '--no-audit', '--no-fund', '--loglevel=error', ...(fromRegistry ? ['--prefer-online'] : [])], node);
for (const d of ['generated', 'annotations']) cpSync(join(ROOT, 'apps/pg-server', d), join(node, d), { recursive: true });
cpSync(join(ROOT, 'apps/mock/Csdl/labels.en.json'), join(node, 'labels.en.json'));
cpSync(join(ROOT, 'apps/pg-server/smart-kit.config.json'), join(node, 'smart-kit.config.json'));
try {
  const help = run(join(node, 'node_modules/.bin/smart-kit'), ['--help'], node);
  check(/generate/.test(help) && /check/.test(help), 'cli: `smart-kit --help` runs from node_modules/.bin');
} catch (e) {
  check(false, 'cli: `smart-kit --help`', String(e.stderr ?? e).split('\n')[0]);
}
try {
  run(join(node, 'node_modules/.bin/smart-kit'), ['check', '--config', 'smart-kit.config.json', '--strict'], node);
  check(true, 'cli: `smart-kit check --strict` on the test bed annotations');
} catch (e) {
  check(false, 'cli: `smart-kit check --strict`', String(e.stdout ?? '') + String(e.stderr ?? ''));
}
try {
  run(join(node, 'node_modules/.bin/smart-kit'), ['agents'], node);
  const agents = readFileSync(join(node, 'AGENTS.md'), 'utf8');
  const claude = readFileSync(join(node, 'CLAUDE.md'), 'utf8');
  run(join(node, 'node_modules/.bin/smart-kit'), ['agents'], node); // a second run replaces the block, it does not add one
  const again = readFileSync(join(node, 'AGENTS.md'), 'utf8');
  check(agents.includes('node_modules/@rhfan2019/smart-kit-server/docs/README.md') && claude.includes('@AGENTS.md') && again === agents, 'cli: `smart-kit agents` writes AGENTS.md and CLAUDE.md, idempotent');
} catch (e) {
  check(false, 'cli: `smart-kit agents`', String(e.stderr ?? e).split('\n')[0]);
}
writeFileSync(join(node, 'serve.mjs'), `import { readFileSync } from 'node:fs';
import { createODataService, createPostgresDb } from '@rhfan2019/smart-kit-server';
const url = process.env.SMART_KIT_DATABASE_URL ?? 'postgresql://smart_kit_app@localhost:5432/smart_kit_purchasing';
const { db, pool } = createPostgresDb({ connectionString: url });
const service = createODataService({
  basePath: '/odata/purchasing/',
  metadata: { csdl: readFileSync('generated/purchasing.csdl.xml', 'utf8'), annotations: [readFileSync('annotations/purchasing.annotations.xml', 'utf8')], labels: { en: JSON.parse(readFileSync('labels.en.json', 'utf8')) } },
  storage: JSON.parse(readFileSync('generated/purchasing.storage.json', 'utf8')),
  db,
});
const meta = await service.handle(new Request('http://x/odata/purchasing/$metadata'));
const xml = await meta.text();
let rows = 'skipped';
try {
  const res = await service.handle(new Request('http://x/odata/purchasing/PurchaseOrders?$top=2&$count=true'));
  rows = res.status === 200 ? String((await res.json()).value.length) : 'status ' + res.status;
} catch (e) { rows = 'error ' + e.message; }
await pool.end();
console.log(JSON.stringify({ status: meta.status, entitySet: xml.includes('EntitySet Name="PurchaseOrders"'), rows }));
`);
try {
  const r = JSON.parse(run('node', ['serve.mjs'], node));
  check(r.status === 200 && r.entitySet, 'server: createODataService answers $metadata');
  const needPg = process.env.SMART_KIT_REQUIRE_PG === '1';
  if (r.rows === '2' || needPg) check(r.rows === '2', 'server: reads rows from the PostgreSQL test bed', r.rows);
  else console.log(`skip server: reading rows (no PostgreSQL test bed: ${r.rows})`);
} catch (e) {
  check(false, 'server: createODataService', String(e.stderr ?? e).split('\n').slice(0, 5).join(' | '));
}

console.log(`\n${failures ? `verify-pack: ${failures} problem(s)` : 'verify-pack: ok'}${keep ? `  (kept ${work})` : ''}`);
if (!keep) rmSync(work, { recursive: true, force: true });
process.exit(failures ? 1 : 0);
