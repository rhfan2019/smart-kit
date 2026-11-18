#!/usr/bin/env node
// API check against SAPUI5 1.154.0 (docs/30 §7.1, ADR-033, AL-01..AL-09, AL-20).
//
//   npm run check:ui5                 compare; exit 1 on unregistered differences or stale deviations
//   npm run check:ui5 -- --report     also write reports/ui5-alignment.md
//   npm run check:ui5 -- --baseline   register every current difference in tools/ui5-alignment/deviations.json
//   npm run check:ui5 -- --prune      remove deviations no difference matches any more
//   npm run check:ui5 -- --only m/,f/  limit to modules with these prefixes (deviations.<name>.json files count too)
//   npm run check:ui5 -- --ignore-baseline  ignore the stage-0 placeholder deviations (reason "基线…")
//   npm run check:ui5 -- --format     rewrite mapping.json and deviations.json one entry per line
//   npm run check:ui5 -- --json FILE  write all findings as JSON (used by the plan / report tooling)
//
// The api.json files are downloaded to .cache/ui5/1.154.0 (git-ignored); nothing from SAP is committed.
import fs from 'node:fs';
import path from 'node:path';
import { ensureApi, loadApi, ROOT, UI5_VERSION, libraryOf, LIBRARIES } from './ui5/api-cache.mjs';
import { describeUi5 } from './ui5/ui5-model.mjs';
import { createProgram, describeExport, moduleExports, moduleFile, REACT_SRC } from './ui5/kit-model.mjs';
import { compareExport, matchDeviations } from './ui5/compare.mjs';

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const MAPPING = path.join(ROOT, 'tools', 'ui5-alignment', 'mapping.json');
const DEVIATIONS = path.join(ROOT, 'tools', 'ui5-alignment', 'deviations.json');
const PKG = path.join(ROOT, 'packages', 'react', 'package.json');

const MISSING_KINDS = new Set(['property', 'aggregation', 'association', 'event', 'event-param', 'event-preventDefault', 'method', 'static-method', 'static-member', 'enum-value', 'default-value', 'settings-type', 'instance-type', 'event-type', 'enum-type']);

/** Writes a register with one entry per line, so diffs stay readable. */
export function writeRegister(file, obj, listKey) {
  const head = Object.entries(obj).filter(([k]) => k !== listKey).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`);
  const list = obj[listKey].map((e) => `    ${JSON.stringify(e)}`).join(',\n');
  fs.writeFileSync(file, `{\n${head.join('\n')}\n  ${JSON.stringify(listKey)}: [\n${list}\n  ]\n}\n`);
}

function readJson(file, fallback) {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback;
}

/** Every public (module, export) pair from package.json `exports` (AL-01). Explicit entries list their value exports. */
function publicExports(ctx) {
  const pkg = readJson(PKG);
  const out = [];
  for (const [key, target] of Object.entries(pkg.exports ?? {})) {
    if (key === '.' || target === null) continue;
    const src = typeof target === 'object' ? target['smart-kit-source'] : undefined;
    if (!src || !/\.tsx?$/.test(src.replace('*', 'x'))) continue;
    const sub = key.replace(/^\.\//, '');
    const files = [];
    if (sub.includes('*')) {
      const [pre, post] = src.replace(/^\.\//, '').split('*');
      const dir = path.join(ROOT, 'packages', 'react', path.dirname(pre + 'x'));
      const walk = (d) => { if (!fs.existsSync(d)) return; for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) walk(f); else if (f.endsWith(post) && !/\.(test|stories)\./.test(f)) files.push(f); } };
      walk(dir);
      for (const f of files) {
        const rel = path.relative(path.join(ROOT, 'packages', 'react'), f).replace(/\\/g, '/');
        const mod = sub.replace('*', rel.slice(pre.length, rel.length - post.length));
        out.push(...valueExports(ctx, f).map((e) => ({ module: mod, export: e })));
      }
    } else {
      const f = path.join(ROOT, 'packages', 'react', src);
      out.push(...valueExports(ctx, f).map((e) => ({ module: sub, export: e })));
    }
  }
  return out;
}

function valueExports(ctx, file) {
  const ex = moduleExports(ctx, file);
  if (!ex) return [];
  const names = [];
  for (const [name, s] of ex) {
    const t = s.flags & 2097152 /* Alias */ ? ctx.checker.getAliasedSymbol(s) : s;
    if (t.flags & 111551 /* Value */) names.push(name);
  }
  return names;
}

function resolveEntry(ctx, entry) {
  const file = moduleFile(entry.module);
  if (file) {
    const ex = moduleExports(ctx, file);
    const sym = ex?.get(entry.export);
    if (sym) {
      const target = sym.flags & 2097152 ? ctx.checker.getAliasedSymbol(sym) : sym;
      const decl = target.valueDeclaration ?? target.declarations?.[0];
      const exportName = entry.export === 'default' ? decl?.name?.getText?.() : entry.export;
      return { kit: describeExport(ctx, sym, { name: exportName }), where: { atTarget: true, typeExports: new Set(ex.keys()), exportName } };
    }
  }
  if (entry.current) {
    const [sub, name] = entry.current.split('#');
    const f = path.join(REACT_SRC, 'entries', `${sub}.ts`);
    const ex = moduleExports(ctx, f);
    const sym = ex?.get(name);
    if (sym) return { kit: describeExport(ctx, sym, { name }), where: { atTarget: false, typeExports: new Set(ex.keys()), exportName: name } };
  }
  return { kit: undefined, where: { atTarget: false, typeExports: new Set() } };
}

export async function runCheck({ log = console.log } = {}) {
  const mapping = readJson(MAPPING, { entries: [] });
  // extra mappings (tools/ui5-alignment/mapping.<name>.json): new modules of parallel work, folded in when merged
  for (const f of fs.readdirSync(path.dirname(MAPPING)).filter((n) => /^mapping\..+\.json$/.test(n))) {
    mapping.entries.push(...readJson(path.join(path.dirname(MAPPING), f), { entries: [] }).entries);
  }
  const register = readJson(DEVIATIONS, { deviations: [] });
  // extra registers (tools/ui5-alignment/deviations.<name>.json): proposals of parallel work, folded in when merged
  const extra = fs.readdirSync(path.dirname(DEVIATIONS)).filter((f) => /^deviations\..+\.json$/.test(f))
    .flatMap((f) => readJson(path.join(path.dirname(DEVIATIONS), f), { deviations: [] }).deviations.map((d) => ({ ...d, file: f })));
  const needed = new Set(LIBRARIES);
  await ensureApi([...needed], { log });
  const symbols = loadApi();
  const ctx = createProgram();

  const findings = [];
  const perEntry = [];
  // AL-01: every public export is mapped, every mapping entry exists
  const covered = new Set();
  for (const e of mapping.entries) { covered.add(`${e.module}#${e.export}`); if (e.current) covered.add(e.current); }
  for (const p of publicExports(ctx)) {
    if (!covered.has(`${p.module}#${p.export}`)) findings.push({ module: p.module, ui5: '', kind: 'unmapped', member: p.export, detail: 'public export missing from mapping.json' });
  }
  const seen = new Set();
  for (const entry of mapping.entries) {
    const key = `${entry.module}#${entry.export}`;
    if (seen.has(key)) findings.push({ module: entry.module, ui5: entry.ui5, kind: 'duplicate-mapping', member: entry.export });
    seen.add(key);
    if (entry.ui5 === 'none' && !entry.reason) findings.push({ module: entry.module, ui5: 'none', kind: 'mapping-reason', member: entry.export, detail: '"none" needs a reason' });
    const ui5 = entry.ui5 && entry.ui5 !== 'none' ? describeUi5(entry.ui5, symbols) : undefined;
    if (ui5?.unresolvedAncestor) log(`warning: ${entry.ui5}: ancestor ${ui5.unresolvedAncestor} not in the cached libraries (${libraryOf(ui5.unresolvedAncestor) ?? 'unknown library'})`);
    const { kit, where } = resolveEntry(ctx, entry);
    // named exports of a shared module (library enums, base subpaths) are told apart by `module#export`
    const id = entry.export === 'default' ? entry.module : `${entry.module}#${entry.export}`;
    const list = compareExport(entry, ui5, kit, where).map((x) => ({ module: id, ui5: entry.ui5, stage: entry.stage, ...x }));
    findings.push(...list);
    const same = ui5 ? countSame(ui5, kit) : 0;
    perEntry.push({ entry, findings: list, same });
  }

  const only = onlyPrefixes();
  const inScope = (m) => !only || only.some((p) => m === p || m.startsWith(p));
  const scoped = findings.filter((x) => inScope(x.module));
  // --ignore-baseline: treat the stage-0 placeholder entries (reason "基线…") as absent, to see what is still open
  const usable = (d) => !(flag('--ignore-baseline') && String(d.reason ?? '').startsWith('基线'));
  const result = matchDeviations(scoped, [...register.deviations, ...extra].filter((d) => (d.module === '*' || inScope(d.module)) && usable(d)));
  return { mapping, register, extra, findings: scoped, perEntry: perEntry.filter((p) => inScope(p.entry.module)), ...result };
}

function countSame(ui5, kit) {
  if (!kit) return 0;
  if (ui5.kind === 'enum') return ui5.enumValues.filter((v) => kit.enumValues.includes(v)).length;
  const props = new Set(kit.props.map((p) => p.name));
  const events = new Set(kit.events.map((e) => e.name));
  return ui5.properties.filter((p) => props.has(p.name)).length + ui5.aggregations.filter((a) => props.has(a.name)).length
    + ui5.associations.filter((a) => props.has(a.name)).length + ui5.events.filter((e) => events.has(e.name)).length
    + ui5.methods.filter((m) => (m.static ? kit.statics : kit.instance).includes(m.name)).length;
}

/** `--only m/,f/Card`: limit the check to modules starting with one of the prefixes (for parallel work). */
function onlyPrefixes() {
  const i = args.indexOf('--only');
  return i >= 0 ? args[i + 1].split(',').filter(Boolean) : undefined;
}

function categoryOf(kind) {
  if (kind.startsWith('extra-')) return 'kit-extension';
  return 'not-implemented';
}

function nextId(deviations) {
  let max = 0;
  for (const d of deviations) { const n = Number(/^DV-(\d+)$/.exec(d.id)?.[1] ?? 0); if (n > max) max = n; }
  return () => `DV-${String(++max).padStart(4, '0')}`;
}

function writeReport(r) {
  const lines = [];
  lines.push('# UI5 API alignment report', '');
  lines.push(`> Generated by \`npm run check:ui5 -- --report\` against SAPUI5 ${UI5_VERSION} api.json (docs/30 §7.1). Contains names and counts only, no SAP content.`, '');
  const byCat = {};
  for (const d of r.register.deviations) byCat[d.category] = (byCat[d.category] ?? 0) + 1;
  lines.push('## Deviations by category', '', '| Category | Count |', '| --- | --- |');
  for (const [c, n] of Object.entries(byCat).sort()) lines.push(`| ${c} | ${n} |`);
  lines.push(`| **total** | **${r.register.deviations.length}** |`, '');
  const byStage = {};
  for (const d of r.register.deviations) if (d.category === 'not-implemented' || d.category === 'fe-behavior') byStage[d.stage ?? '?'] = (byStage[d.stage ?? '?'] ?? 0) + 1;
  lines.push('## not-implemented + fe-behavior by planned stage', '', '| Stage | Count |', '| --- | --- |');
  for (const [s, n] of Object.entries(byStage).sort()) lines.push(`| ${s} | ${n} |`);
  lines.push('', '## Per export', '', '| Module | UI5 | Same | Deviations | Unregistered |', '| --- | --- | --- | --- | --- |');
  const unreg = new Set(r.unregistered.map((x) => `${x.module}|${x.kind}|${x.member}`));
  const idOf = (e) => (e.export === 'default' ? e.module : `${e.module}#${e.export}`);
  for (const p of r.perEntry) {
    const u = p.findings.filter((x) => unreg.has(`${x.module}|${x.kind}|${x.member}`)).length;
    lines.push(`| ${idOf(p.entry)} | ${p.entry.ui5} | ${p.same} | ${p.findings.length - u} | ${u} |`);
  }
  lines.push('');
  fs.mkdirSync(path.join(ROOT, 'reports'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'reports', 'ui5-alignment.md'), lines.join('\n'));
}

async function main() {
  const r = await runCheck();
  if (flag('--baseline') || flag('--prune')) {
    let devs = r.register.deviations;
    if (flag('--prune')) { const stale = new Set(r.stale.map((d) => d.id)); devs = devs.filter((d) => !stale.has(d.id)); }
    if (flag('--baseline')) {
      const id = nextId(devs);
      for (const x of r.unregistered) {
        devs.push({
          id: id(), module: x.module, ui5: x.ui5, kind: x.kind, member: x.member,
          category: categoryOf(x.kind), stage: x.stage ?? null,
          reason: x.kind.startsWith('extra-') ? `基线（阶段 0）：smart-kit 多出的成员，阶段 ${x.stage ?? '?'} 复核（多为改名前的旧名）` : `基线（阶段 0）：阶段 ${x.stage ?? '?'} 处理${x.detail ? `；${x.detail}` : ''}`,
          ref: 'docs/31 §1',
        });
      }
    }
    r.register.deviations = devs;
    writeRegister(DEVIATIONS, r.register, 'deviations');
    console.log(`deviations.json: ${devs.length} entries`);
    return;
  }
  if (flag('--format')) { writeRegister(DEVIATIONS, r.register, 'deviations'); writeRegister(MAPPING, r.mapping, 'entries'); }
  if (flag('--json')) fs.writeFileSync(args[args.indexOf('--json') + 1], JSON.stringify(r.findings, null, 2));
  if (flag('--report')) writeReport(r);
  const cats = {};
  for (const d of [...r.register.deviations, ...r.extra]) cats[d.category] = (cats[d.category] ?? 0) + 1;
  console.log(`check:ui5 (SAPUI5 ${UI5_VERSION}): ${r.mapping.entries.length} mapped exports, ${r.findings.length} differences, ${r.registered.length} registered, ${r.unregistered.length} unregistered, ${r.stale.length} stale deviations`);
  console.log(`deviations by category: ${Object.entries(cats).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}`);
  for (const x of r.unregistered.slice(0, 200)) console.log(`  UNREGISTERED ${x.module} [${x.ui5}] ${x.kind} ${x.member}${x.detail ? ` — ${x.detail}` : ''}`);
  if (r.unregistered.length > 200) console.log(`  … ${r.unregistered.length - 200} more`);
  for (const d of r.stale.slice(0, 100)) console.log(`  STALE ${d.id} ${d.module} ${d.kind} ${d.member} (fixed? remove it: --prune)`);
  if (r.unregistered.length || r.stale.length) process.exitCode = 1;
  void MISSING_KINDS;
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error(e); process.exit(2); });
