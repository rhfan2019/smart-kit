// Reads the public API of smart-kit exports with the TypeScript compiler (docs/30 §7.1 step 3).
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { ROOT } from './api-cache.mjs';

export const REACT_SRC = path.join(ROOT, 'packages', 'react', 'src');

export function createProgram() {
  const config = path.join(ROOT, 'packages', 'react', 'tsconfig.json');
  const parsed = ts.getParsedCommandLineOfConfigFile(config, {}, { ...ts.sys, onUnRecoverableConfigFileDiagnostic: (d) => { throw new Error(String(d.messageText)); } });
  const program = ts.createProgram(parsed.fileNames, parsed.options);
  return { program, checker: program.getTypeChecker() };
}

/** A program over a few files (the self-test fixtures, AL-20). */
export function createProgramFor(files) {
  const program = ts.createProgram(files, { jsx: ts.JsxEmit.ReactJSX, strict: true, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, target: ts.ScriptTarget.ES2022, noEmit: true, skipLibCheck: true });
  return { program, checker: program.getTypeChecker() };
}

/** The source file of a module path relative to src (`m/MessageStrip` → src/m/MessageStrip.tsx), or undefined. */
export function moduleFile(modulePath) {
  // the base subpaths (ADR-033 §7) keep their entry files
  if (['context', 'i18n', 'theme', 'util'].includes(modulePath)) return path.join(REACT_SRC, 'entries', `${modulePath}.ts`);
  for (const ext of ['.tsx', '.ts', '/index.tsx', '/index.ts']) {
    const f = path.join(REACT_SRC, modulePath + ext);
    if (fs.existsSync(f)) return f;
  }
  return undefined;
}

export function moduleExports({ program, checker }, file) {
  const sf = program.getSourceFile(file);
  if (!sf) return undefined;
  const sym = checker.getSymbolAtLocation(sf);
  if (!sym) return new Map();
  return new Map(checker.getExportsOfModule(sym).map((s) => [s.name, s]));
}

const resolveAlias = (checker, s) => (s.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(s) : s);

const FUNCTION_BUILTINS = new Set(['prototype', 'length', 'name', 'call', 'apply', 'bind', 'toString', 'arguments', 'caller', 'displayName', '$$typeof', 'propTypes', 'defaultProps', 'contextTypes', 'render', 'compare', 'type', '_payload', '_init']);

function tagValue(sym, checker, tagName) {
  for (const t of sym.getJsDocTags(checker)) {
    if (t.name !== tagName) continue;
    const text = (t.text ?? []).map((x) => x.text).join('').trim();
    return text;
  }
  return undefined;
}

export function normalizeDefault(text) {
  if (text === undefined) return undefined;
  let v = text.trim().replace(/^`|`$/g, '');
  v = v.replace(/^['"]|['"]$/g, '');
  const enumRef = /^[A-Z]\w*\.(\w+)$/.exec(v);
  if (enumRef) v = enumRef[1];
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  return v;
}

function nonNullable(checker, type) {
  return checker.getNonNullableType(type);
}

function instanceTypeOfRef(checker, refType, at) {
  const t = nonNullable(checker, refType);
  const parts = t.isUnion() ? t.types : [t];
  for (const part of parts) {
    const current = part.getProperty('current');
    if (current) return nonNullable(checker, checker.getTypeOfSymbolAtLocation(current, at));
  }
  // a callback ref: (instance: T | null) => void
  for (const part of parts) {
    const sig = part.getCallSignatures()[0];
    if (sig?.parameters[0]) return nonNullable(checker, checker.getTypeOfSymbolAtLocation(sig.parameters[0], at));
  }
  return undefined;
}

function membersOf(checker, type, at) {
  return type ? checker.getPropertiesOfType(type).map((s) => ({ name: s.name, sym: s, type: checker.getTypeOfSymbolAtLocation(s, at) })) : [];
}

/** Describes one exported value: component, enum, namespace-like object, function or constant. */
export function describeExport(ctx, exportSymbol, { name } = {}) {
  const { checker } = ctx;
  const sym = resolveAlias(checker, exportSymbol);
  const decl = sym.valueDeclaration ?? sym.declarations?.[0];
  const at = decl ?? exportSymbol.declarations?.[0];
  const out = { name: name ?? exportSymbol.name, kind: 'other', props: [], events: [], instance: [], statics: [], enumValues: [], file: decl?.getSourceFile().fileName };
  if (!(sym.flags & ts.SymbolFlags.Value) || !at) { out.kind = 'type'; return out; }
  const type = checker.getTypeOfSymbolAtLocation(sym, at);
  const calls = type.getCallSignatures();
  const props = checker.getPropertiesOfType(type).filter((s) => !FUNCTION_BUILTINS.has(s.name));
  const isUpper = /^[A-Z]/.test(out.name);

  // enum: a constant object whose values are string literals equal to their keys
  if (!calls.length && props.length && props.every((p) => {
    const t = checker.getTypeOfSymbolAtLocation(p, at);
    return t.isStringLiteral() && t.value === p.name;
  })) {
    out.kind = 'enum';
    out.enumValues = props.map((p) => p.name);
    return out;
  }
  out.statics = props.map((p) => p.name);
  if (calls.length && isUpper) {
    out.kind = 'component';
    out.mergedInterface = Boolean(sym.flags & ts.SymbolFlags.Interface);
    const param = calls[0].parameters[0];
    const propsType = param ? checker.getTypeOfSymbolAtLocation(param, at) : undefined;
    for (const m of membersOf(checker, propsType, at)) {
      // attributes inherited from React's DOM types (`extends ComponentProps<'div'>`) count as one react-idiom finding
      const fromReact = (m.sym.declarations ?? []).length > 0 && m.sym.declarations.every((d) => /[\\/]@types[\\/]react[\\/]/.test(d.getSourceFile().fileName));
      if (fromReact && m.name !== 'ref' && m.name !== 'children' && m.name !== 'key') { out.domAttributes = true; continue; }
      if (m.name === 'ref') {
        const inst = instanceTypeOfRef(checker, m.type, at);
        out.instance = membersOf(checker, inst, at).map((x) => x.name);
        out.hasRef = true;
        continue;
      }
      if (m.name === 'key') continue;
      if (/^on[A-Z]/.test(m.name)) {
        const fn = nonNullable(checker, m.type).getCallSignatures()[0];
        const evParam = fn?.parameters[0];
        const evType = evParam ? nonNullable(checker, checker.getTypeOfSymbolAtLocation(evParam, at)) : undefined;
        const isObject = evType && (evType.flags & ts.TypeFlags.Object) && !evType.getCallSignatures().length && !checker.isArrayType(evType) && !checker.isTupleType(evType);
        out.events.push({ name: m.name.slice(2, 3).toLowerCase() + m.name.slice(3), prop: m.name, params: isObject ? membersOf(checker, evType, at).map((x) => x.name) : null, paramTypeName: evType && evType.aliasSymbol ? evType.aliasSymbol.name : evType?.symbol?.name });
        continue;
      }
      out.props.push({ name: m.name, defaultValue: normalizeDefault(tagValue(m.sym, checker, 'defaultValue')), hasDefaultTag: tagValue(m.sym, checker, 'defaultValue') !== undefined });
    }
    return out;
  }
  if (calls.length) { out.kind = 'function'; return out; }
  out.kind = props.some((p) => checker.getTypeOfSymbolAtLocation(p, at).getCallSignatures().length) ? 'namespace' : 'constant';
  return out;
}
