// ADR-030: generates the API reference that ships in each package for coding agents (docs/reference.md), from the
// TypeScript sources: every export of every entry, with its subpath, its kind, the props of components (required or
// optional, type, TSDoc) and the members of exported interfaces. Handwritten guides live next to it in docs/.
//   node scripts/gen-agent-docs.mjs           write the files
//   node scripts/gen-agent-docs.mjs --check   exit 1 when a file is out of date (CI, tests/unit/agent-docs.test.ts)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';

const ROOT = join(import.meta.dirname, '..');
const checkOnly = process.argv.includes('--check');

const react = JSON.parse(readFileSync(join(ROOT, 'packages/react/package.json'), 'utf8'));
const TARGETS = [
  {
    out: 'packages/react/docs/reference.md',
    title: '@rhfan2019/smart-kit — API reference',
    entries: Object.keys(react.exports)
      .filter((k) => k !== '.' && !k.endsWith('.css'))
      .map((k) => ({ spec: `@rhfan2019/smart-kit/${k.slice(2)}`, file: `packages/react/${react.exports[k]['smart-kit-source'].slice(2)}` })),
  },
  { out: 'packages/core/docs/reference.md', title: '@rhfan2019/smart-kit-core — API reference', entries: [{ spec: '@rhfan2019/smart-kit-core', file: 'packages/core/src/index.ts' }] },
  { out: 'packages/server/docs/reference.md', title: '@rhfan2019/smart-kit-server — API reference', entries: [{ spec: '@rhfan2019/smart-kit-server', file: 'packages/server/src/index.ts' }] },
  { out: 'packages/cli/docs/reference.md', title: '@rhfan2019/smart-kit-cli — API reference', entries: [{ spec: '@rhfan2019/smart-kit-cli', file: 'packages/cli/src/index.ts' }] },
];

const config = ts.getParsedCommandLineOfConfigFile(join(ROOT, 'packages/react/tsconfig.json'), {}, { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => {} });
const files = TARGETS.flatMap((t) => t.entries.map((e) => join(ROOT, e.file)));
const program = ts.createProgram(files, { ...config.options, types: ['node'], noEmit: true });
const checker = program.getTypeChecker();

const oneLine = (s) => s.replace(/\s+/g, ' ').trim();
const esc = (s) => s.replace(/\|/g, '\\|').replace(/</g, '&lt;');
const doc = (sym) => oneLine(ts.displayPartsToString(sym.getDocumentationComment(checker)));
const typeText = (t, node) => {
  const s = checker.typeToString(t, node, ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope);
  return s.length > 140 ? `${s.slice(0, 137)}…` : s;
};
const declOf = (sym) => sym.declarations?.[0];
const isComponentName = (n) => /^[A-Z]/.test(n);
const tags = (sym) => sym.getJsDocTags(checker).filter((t) => t.name === 'deprecated').map((t) => ` **Deprecated**${t.text ? `: ${ts.displayPartsToString(t.text)}` : ''}`).join('');

/** Rows of a props / options table: own properties of `t`, required ones first. */
function members(t, node) {
  const props = checker.getPropertiesOfType(t).filter((p) => !p.name.startsWith('__'));
  const rows = props.map((p) => {
    const optional = (p.flags & ts.SymbolFlags.Optional) !== 0;
    // the type as written in the declaration (keeps aliases such as ReactNode); computed otherwise
    const decl = p.declarations?.[0];
    const written = decl && ts.isMethodSignature(decl)
      ? `(${decl.parameters.map((q) => q.getText()).join(', ')}) => ${decl.type?.getText() ?? 'void'}`
      : decl?.type?.getText();
    const pt = checker.getTypeOfSymbolAtLocation(p, node);
    const type = written ? (oneLine(written).length > 140 ? `${oneLine(written).slice(0, 137)}…` : oneLine(written)) : typeText(optional ? checker.getNonNullableType(pt) : pt, node);
    return { name: p.name, optional, type, doc: doc(p) + tags(p) };
  });
  rows.sort((a, b) => Number(a.optional) - Number(b.optional));
  return rows;
}
const table = (rows, head = 'Prop') =>
  rows.length
    ? [`| ${head} | Required | Type | Description |`, '| --- | --- | --- | --- |', ...rows.map((r) => `| \`${r.name}\` | ${r.optional ? '' : '**yes**'} | \`${esc(r.type)}\` | ${esc(r.doc)} |`)].join('\n')
    : '_no props_';

function describeEntry(entry) {
  const sf = program.getSourceFile(join(ROOT, entry.file));
  const mod = checker.getSymbolAtLocation(sf);
  const out = [];
  const exportsOf = checker.getExportsOfModule(mod).sort((a, b) => a.name.localeCompare(b.name));
  const rows = [];
  for (const ex of exportsOf) {
    const sym = ex.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(ex) : ex;
    const d = declOf(sym);
    if (!d) continue;
    const isType = (sym.flags & (ts.SymbolFlags.Interface | ts.SymbolFlags.TypeAlias)) !== 0 && (sym.flags & ts.SymbolFlags.Value) === 0;
    const valueType = isType ? undefined : checker.getTypeOfSymbolAtLocation(sym, d);
    const sigs = valueType?.getCallSignatures() ?? [];
    let kind = isType ? (sym.flags & ts.SymbolFlags.Interface ? 'interface' : 'type') : sym.flags & ts.SymbolFlags.Class ? 'class' : sigs.length ? 'function' : 'const';
    if (kind === 'function' && /^use[A-Z]/.test(sym.name)) kind = 'hook';
    // a component: PascalCase function whose first parameter is an object of props (or no parameter) and returns JSX
    const ret = sigs[0] ? checker.typeToString(sigs[0].getReturnType()) : '';
    if (kind === 'function' && isComponentName(sym.name) && /Element|ReactNode|null/.test(ret)) kind = 'component';
    if (kind === 'const' && isComponentName(sym.name) && valueType && checker.typeToString(valueType).includes('ExoticComponent')) kind = 'component';
    rows.push({ name: ex.name, sym, d, kind, sigs, valueType, isType });
  }
  out.push(`## \`${entry.spec}\``, '');
  out.push(rows.map((r) => `\`${r.name}\` (${r.kind})`).join(' · '), '');
  for (const r of rows) {
    const summary = doc(r.sym) + tags(r.sym);
    if (r.kind === 'component') {
      out.push(`### \`${r.name}\` — component`, '');
      if (summary) out.push(summary, '');
      out.push(`\`import { ${r.name} } from '${entry.spec}';\``, '');
      const sig = r.sigs[0] ?? r.valueType?.getCallSignatures()[0];
      const p0 = sig?.getParameters()[0];
      if (p0) out.push(table(members(checker.getTypeOfSymbolAtLocation(p0, r.d), r.d)), '');
      else out.push('_no props_', '');
    } else if (r.kind === 'hook' || r.kind === 'function') {
      out.push(`### \`${r.name}\` — ${r.kind}`, '');
      if (summary) out.push(summary, '');
      for (const s of r.sigs.slice(0, 3)) out.push('```ts', `${r.name}${oneLine(checker.signatureToString(s, r.d, ts.TypeFormatFlags.NoTruncation))}`, '```', '');
    } else if (r.kind === 'interface') {
      const t = checker.getDeclaredTypeOfSymbol(r.sym);
      const rowsOf = members(t, r.d);
      out.push(`### \`${r.name}\` — interface`, '');
      if (summary) out.push(summary, '');
      // Props interfaces are already listed under their component; keep them short here.
      if (/Props$/.test(r.name)) out.push(`Props of \`${r.name.replace(/Props$/, '')}\` (see above).`, '');
      else out.push(table(rowsOf, 'Member'), '');
    } else if (r.kind === 'type') {
      out.push(`### \`${r.name}\` — type`, '');
      if (summary) out.push(summary, '');
      const text = oneLine(r.d.getText ? r.d.getText(r.d.getSourceFile()) : '');
      out.push('```ts', text.length > 400 ? `${text.slice(0, 397)}…` : text, '```', '');
    } else {
      out.push(`### \`${r.name}\` — ${r.kind}`, '');
      if (summary) out.push(summary, '');
      if (r.kind === 'class') {
        const ctor = checker.getTypeOfSymbolAtLocation(r.sym, r.d).getConstructSignatures()[0];
        if (ctor) out.push('```ts', `new ${r.name}${oneLine(checker.signatureToString(ctor, r.d, ts.TypeFormatFlags.NoTruncation)).replace(/:[^:]*$/, '')}`, '```', '');
      } else if (r.valueType) out.push('```ts', `const ${r.name}: ${typeText(r.valueType, r.d)}`, '```', '');
    }
  }
  return out.join('\n');
}

let stale = 0;
for (const t of TARGETS) {
  const body = [
    `# ${t.title}`,
    '',
    '> Generated by `scripts/gen-agent-docs.mjs` from the TypeScript sources and their TSDoc — do not edit. Start with',
    '> `docs/README.md` for how the pieces fit together; this file lists every export with its import path.',
    '',
    ...t.entries.map(describeEntry),
  ].join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
  const path = join(ROOT, t.out);
  const before = existsSync(path) ? readFileSync(path, 'utf8') : '';
  if (before === body) continue;
  if (checkOnly) {
    stale++;
    console.error(`out of date: ${relative(ROOT, path)} (run node scripts/gen-agent-docs.mjs)`);
  } else {
    writeFileSync(path, body);
    console.log(`wrote ${relative(ROOT, path)} (${(body.length / 1024).toFixed(0)} KB)`);
  }
}
if (stale) process.exit(1);
