#!/usr/bin/env node
// Generates the `exports` of packages/react/package.json from the module files (ADR-033 §2, docs/30 §3):
// every file under src/{m,f,ui,uxap,suite,base,kit,v4}/ is one public module at the same path, `./m/MessageBox` →
// src/m/MessageBox.ts and dist/m/MessageBox.js. The list is explicit (not a `./m/*` pattern) so that tooling
// (reference docs, verify:pack, size budgets) sees every module, and nothing outside these folders is exposed.
// The base subpaths (context, i18n, theme, util) and the not yet aligned subpaths stay as they are.
//
//   node scripts/gen-exports.mjs           rewrite package.json
//   node scripts/gen-exports.mjs --check   exit 1 when package.json (or the module list in docs/api.md) is out of date
// It also rewrites the module list in docs/api.md between <!-- ui5-modules:start --> and <!-- ui5-modules:end -->.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.join(import.meta.dirname, '..');
const PKG_DIR = path.join(ROOT, 'packages/react');
const PKG = path.join(PKG_DIR, 'package.json');
export const MODULE_DIRS = ['base', 'f', 'kit', 'm', 'suite', 'ui', 'uxap', 'v4'];

/** Module paths (without extension) of every public module file, sorted. */
export function moduleFiles() {
  const out = [];
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const f = path.join(dir, e.name);
      if (e.isDirectory()) walk(f);
      else if (/\.tsx?$/.test(e.name) && !/\.(test|stories|d)\.tsx?$/.test(e.name)) out.push(path.relative(path.join(PKG_DIR, 'src'), f).replace(/\\/g, '/'));
    }
  };
  for (const d of MODULE_DIRS) walk(path.join(PKG_DIR, 'src', d));
  return out.sort();
}

export function generate(pkg) {
  const keep = Object.entries(pkg.exports).filter(([k]) => !MODULE_DIRS.some((d) => k.startsWith(`./${d}/`)));
  const css = keep.filter(([k]) => k.endsWith('.css'));
  const rest = keep.filter(([k]) => !k.endsWith('.css'));
  const modules = moduleFiles().map((file) => {
    const mod = file.replace(/\.tsx?$/, '');
    return [`./${mod}`, { 'smart-kit-source': `./src/${file}`, types: `./dist/${mod}.d.ts`, import: `./dist/${mod}.js` }];
  });
  return { ...pkg, exports: Object.fromEntries([...rest, ...modules, ...css]) };
}

const API_MD = path.join(ROOT, 'docs/api.md');
const MAPPING = path.join(ROOT, 'tools/ui5-alignment/mapping.json');

/** The module table of docs/api.md: one row per module file, with its UI5 counterpart from mapping.json. */
export function apiModuleTable() {
  const mapping = JSON.parse(fs.readFileSync(MAPPING, 'utf8')).entries;
  const rows = moduleFiles().map((file) => {
    const mod = file.replace(/\.tsx?$/, '');
    const entries = mapping.filter((e) => e.module === mod);
    const ui5 = entries.map((e) => (e.ui5 === 'none' ? '无（' + e.reason + '）' : e.ui5.replace(/^manifest:/, 'manifest ') + (e.export === 'default' ? '' : ` → \`${e.export}\``))).join('；') || '—';
    return `| \`@rhfan2019/smart-kit/${mod}\` | ${ui5} |`;
  });
  return ['| 模块 | 对应的 SAPUI5（`tools/ui5-alignment/mapping.json`） |', '| --- | --- |', ...rows].join('\n');
}

function withTable(md) {
  return md.replace(/(<!-- ui5-modules:start -->\n)[\s\S]*?(\n?<!-- ui5-modules:end -->)/, `$1${apiModuleTable()}\n<!-- ui5-modules:end -->`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const raw = fs.readFileSync(PKG, 'utf8');
  const next = JSON.stringify(generate(JSON.parse(raw)), null, 2) + '\n';
  const md = fs.readFileSync(API_MD, 'utf8');
  const nextMd = withTable(md);
  if (process.argv.includes('--check')) {
    if (next !== raw || nextMd !== md) { console.error('packages/react/package.json exports or docs/api.md modules are out of date: run node scripts/gen-exports.mjs'); process.exit(1); }
    console.log('gen-exports: up to date');
  } else {
    fs.writeFileSync(PKG, next);
    fs.writeFileSync(API_MD, nextMd);
    console.log(`gen-exports: ${moduleFiles().length} modules`);
  }
}
