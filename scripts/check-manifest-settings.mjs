#!/usr/bin/env node
// Manifest settings check of the page templates (AL-13; docs/26c, docs/30 §5.3, §7.1).
//
//   node scripts/check-manifest-settings.mjs                     check every tools/ui5-alignment/manifest.<Template>.json
//   node scripts/check-manifest-settings.mjs --only ObjectPage   only these templates (comma-separated)
//   node scripts/check-manifest-settings.mjs --json FILE         also write all findings as JSON
//   node scripts/check-manifest-settings.mjs --list              print the settings paths the TypeScript type declares
//
// Each manifest.<Template>.json lists the Fiori elements manifest settings of a template (path, type, values, default)
// and names the smart-kit module and its settings type (`$<Template>Settings`). The type is read with the TypeScript
// compiler and compared path by path:
//   manifest-missing  a FE setting the type does not declare (settings marked "unread" are exempt)
//   manifest-extra    a prop of the type that is no FE setting
//   manifest-default  the FE default (`default`) differs from the prop's @defaultValue (or the tag is missing)
//   manifest-values   the string values of an enum setting differ from the prop's string literal union
// A finding passes when it is registered in tools/ui5-alignment/deviations*.json with the template module, the kind and
// the setting path as member (a registered path also covers the paths below it). Registered entries no finding uses
// are reported as stale. Exit code 1 on unregistered findings or stale entries.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { createProgram, moduleFile, normalizeDefault } from './ui5/kit-model.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'tools', 'ui5-alignment');
export const KINDS = ['manifest-missing', 'manifest-extra', 'manifest-default', 'manifest-values'];

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

/** The manifest.<Template>.json files (optionally only some templates). */
export function loadManifests(dir = DIR, only) {
  return fs.readdirSync(dir).filter((f) => /^manifest\..+\.json$/.test(f)).sort()
    .map((f) => ({ file: f, ...readJson(path.join(dir, f)) }))
    .filter((m) => !only || only.includes(m.template));
}

/** Every deviation of deviations.json and deviations.<group>.json. */
export function loadDeviations(dir = DIR) {
  return fs.readdirSync(dir).filter((f) => /^deviations(\..+)?\.json$/.test(f))
    .flatMap((f) => (readJson(path.join(dir, f)).deviations ?? []).map((d) => ({ ...d, file: f })));
}

const REACT_TYPES = /[\\/]@types[\\/]react[\\/]/;

function tag(sym, checker, name) {
  for (const t of sym.getJsDocTags(checker)) if (t.name === name) return (t.text ?? []).map((x) => x.text).join('').trim();
  return undefined;
}

/**
 * Walks a settings type into paths: "/" between keys, "*" for a string index signature, "[]" for array items. Stops
 * at functions, React types, primitives and at `stopAt` paths. Each path: { path, defaultValue, hasDefault, values
 * (string literals of a union, or null when the type admits any string), function }.
 */
export function walkSettingsType({ checker }, type, at, { stopAt = new Set() } = {}) {
  const out = new Map();
  const visit = (t, prefix, depth, seen) => {
    if (depth > 12 || stopAt.has(prefix)) return;
    const nn = checker.getNonNullableType(t);
    const parts = nn.isUnion() ? nn.types : [nn];
    const objects = [];
    for (const p of parts) {
      if (p.getCallSignatures().length) continue;
      if (p.flags & (ts.TypeFlags.StringLike | ts.TypeFlags.NumberLike | ts.TypeFlags.BooleanLike | ts.TypeFlags.EnumLike | ts.TypeFlags.Null | ts.TypeFlags.Undefined)) continue;
      const decl = (p.aliasSymbol ?? p.symbol)?.declarations?.[0];
      if (decl && REACT_TYPES.test(decl.getSourceFile().fileName)) continue;
      if (checker.isArrayType(p)) {
        const el = checker.getTypeArguments(p)[0];
        if (el) visitArray(el, prefix, depth, seen);
        continue;
      }
      if (p.flags & ts.TypeFlags.Object || p.flags & ts.TypeFlags.Intersection) objects.push(p);
    }
    for (const o of objects) {
      if (seen.has(o)) continue;
      const next = new Set(seen).add(o);
      for (const s of checker.getPropertiesOfType(o)) {
        const decl = s.declarations?.[0];
        if (decl && REACT_TYPES.test(decl.getSourceFile().fileName)) continue;
        const p = prefix ? `${prefix}/${s.name}` : s.name;
        const st = checker.getTypeOfSymbolAtLocation(s, decl ?? at);
        record(p, st, s);
        visit(st, p, depth + 1, next);
      }
      for (const info of checker.getIndexInfosOfType(o)) {
        if (!(info.keyType.flags & ts.TypeFlags.String)) continue;
        const p = prefix ? `${prefix}/*` : '*';
        record(p, info.type, undefined);
        visit(info.type, p, depth + 1, next);
      }
    }
  };
  const visitArray = (el, prefix, depth, seen) => {
    const nn = checker.getNonNullableType(el);
    const prim = (nn.isUnion() ? nn.types : [nn]).every((x) => x.flags & (ts.TypeFlags.StringLike | ts.TypeFlags.NumberLike | ts.TypeFlags.BooleanLike) || checker.isArrayType(x));
    if (prim) return;
    const p = `${prefix}/[]`;
    record(p, el, undefined);
    visit(el, p, depth + 1, seen);
  };
  const record = (p, t, sym) => {
    if (out.has(p)) return;
    const nn = checker.getNonNullableType(t);
    const parts = nn.isUnion() ? nn.types : [nn];
    const literals = parts.filter((x) => x.isStringLiteral()).map((x) => x.value);
    const anyString = parts.some((x) => x.flags & ts.TypeFlags.String);
    const text = sym ? tag(sym, checker, 'defaultValue') : undefined;
    out.set(p, {
      path: p,
      defaultValue: normalizeDefault(text),
      hasDefault: text !== undefined,
      values: literals.length ? (anyString ? null : literals.sort()) : undefined,
      function: parts.some((x) => x.getCallSignatures().length > 0),
    });
  };
  visit(type, '', 0, new Set());
  return out;
}

/** Reads `settingsType` of the template's module. */
export function readSettingsType(ctx, file, typeName) {
  const sf = ctx.program.getSourceFile(file);
  if (!sf) return undefined;
  const modSym = ctx.checker.getSymbolAtLocation(sf);
  const sym = modSym && ctx.checker.getExportsOfModule(modSym).find((s) => s.name === typeName);
  if (!sym) return undefined;
  const target = sym.flags & ts.SymbolFlags.Alias ? ctx.checker.getAliasedSymbol(sym) : sym;
  return { type: ctx.checker.getDeclaredTypeOfSymbol(target), at: target.declarations?.[0] ?? sf };
}

const covers = (base, p) => p === base || p.startsWith(`${base}/`);
const sameValue = (a, b) => (Array.isArray(a) || Array.isArray(b) ? JSON.stringify(a) === JSON.stringify(b) : String(a) === String(b));

/** Compares the manifest settings of one template with the walked type. Pure (used by the self-test). */
export function compareSettings(manifest, kit) {
  const f = [];
  const add = (kind, member, detail) => f.push({ module: manifest.module, template: manifest.template, kind, member, detail });
  const settings = manifest.settings ?? [];
  const opaque = settings.filter((s) => s.opaque).map((s) => s.path);
  const fe = new Map(settings.map((s) => [s.path, s]));
  // a missing (or extra) object is one finding: the paths below it are not reported again
  const ancestors = (p) => p.split('/').slice(0, -1).map((_, i, a) => a.slice(0, i + 1).join('/'));
  const missingParent = (p) => ancestors(p).some((a) => fe.has(a) && !kit.has(a));
  for (const s of settings) {
    const k = kit.get(s.path);
    if (!k) {
      if (!s.unread && !missingParent(s.path)) add('manifest-missing', s.path, `FE setting ${s.type}${s.default !== undefined ? ` (default ${JSON.stringify(s.default)})` : ''} not in ${manifest.settingsType}`);
      continue;
    }
    if (s.default !== undefined) {
      if (!k.hasDefault) add('manifest-default', s.path, `FE default ${JSON.stringify(s.default)}; no @defaultValue`);
      else if (!sameValue(k.defaultValue, s.default)) add('manifest-default', s.path, `FE default ${JSON.stringify(s.default)}, @defaultValue ${JSON.stringify(k.defaultValue)}`);
    }
    if (s.type === 'enum' && s.values) {
      const want = [...s.values].sort();
      if (k.values === null) add('manifest-values', s.path, `FE values ${want.join(', ')}; the prop accepts any string`);
      else if (k.values && JSON.stringify(k.values) !== JSON.stringify(want)) {
        const missing = want.filter((v) => !k.values.includes(v));
        const extra = k.values.filter((v) => !want.includes(v));
        add('manifest-values', s.path, `${missing.length ? `missing ${missing.join(', ')}` : ''}${missing.length && extra.length ? '; ' : ''}${extra.length ? `extra ${extra.join(', ')}` : ''}`);
      }
    }
  }
  for (const [p, k] of kit) {
    if (fe.has(p) || opaque.some((o) => p.startsWith(`${o}/`)) || ancestors(p).some((a) => kit.has(a) && !fe.has(a))) continue;
    add('manifest-extra', p, `not a FE setting${k.function ? ' (function)' : ''}`);
  }
  return f;
}

/** Splits findings into registered and unregistered; registered entries no finding uses are stale. */
export function matchManifestDeviations(findings, deviations) {
  const relevant = deviations.filter((d) => KINDS.includes(d.kind));
  const used = new Set();
  const registered = [];
  const unregistered = [];
  for (const x of findings) {
    const d = relevant.find((r) => r.module === x.module && r.kind === x.kind && covers(r.member ?? '', x.member));
    if (d) { used.add(d); registered.push({ ...x, deviation: d.id }); } else unregistered.push(x);
  }
  const modules = new Set(findings.map((x) => x.module));
  return { registered, unregistered, stale: relevant.filter((d) => modules.has(d.module) && !used.has(d)) };
}

/** Runs the check over the manifests (all, or `only` template names). */
export function runCheck({ only, ctx = createProgram(), dir = DIR, file = (m) => moduleFile(m.module) } = {}) {
  const manifests = loadManifests(dir, only);
  const findings = [];
  const kitPaths = {};
  const checkedModules = new Set();
  for (const m of manifests) {
    checkedModules.add(m.module);
    const f = file(m);
    const t = f && readSettingsType(ctx, f, m.settingsType);
    if (!t) { findings.push({ module: m.module, template: m.template, kind: 'manifest-type', member: m.settingsType, detail: `type ${m.settingsType} not exported by ${m.module}` }); continue; }
    const stopAt = new Set((m.settings ?? []).filter((s) => s.opaque).map((s) => s.path));
    const kit = walkSettingsType(ctx, t.type, t.at, { stopAt });
    kitPaths[m.template] = [...kit.keys()];
    findings.push(...compareSettings(m, kit));
  }
  const deviations = loadDeviations(dir).filter((d) => checkedModules.has(d.module));
  return { manifests, kitPaths, findings, ...matchManifestDeviations(findings, deviations) };
}

function main() {
  const args = process.argv.slice(2);
  const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
  const only = opt('--only')?.split(',').filter(Boolean);
  const r = runCheck({ only });
  if (!r.manifests.length) { console.error(`no manifest.<Template>.json${only ? ` for ${only.join(', ')}` : ''} in ${path.relative(ROOT, DIR)}`); process.exit(1); }
  if (args.includes('--list')) for (const [t, ps] of Object.entries(r.kitPaths)) console.log(`${t}:\n  ${ps.join('\n  ')}`);
  const json = opt('--json');
  if (json) fs.writeFileSync(json, `${JSON.stringify({ findings: r.findings, unregistered: r.unregistered, stale: r.stale.map((d) => d.id) }, null, 2)}\n`);
  for (const m of r.manifests) {
    const n = r.findings.filter((x) => x.template === m.template);
    console.log(`${m.template} (${m.module}, ${m.settingsType}): ${(m.settings ?? []).length} FE settings, ${n.length} differences, ${n.filter((x) => r.unregistered.includes(x)).length} unregistered`);
  }
  for (const x of r.unregistered) console.log(`  unregistered ${x.kind} ${x.module} ${x.member}: ${x.detail}`);
  for (const d of r.stale) console.log(`  stale ${d.id} (${d.file}) ${d.kind} ${d.member}`);
  if (r.unregistered.length || r.stale.length) process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
