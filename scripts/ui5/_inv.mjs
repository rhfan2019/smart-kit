import ts from 'typescript';
import { createProgram, moduleExports, REACT_SRC } from './kit-model.mjs';
import path from 'node:path'; import fs from 'node:fs';
const ctx = createProgram();
const dirs = process.argv.slice(2);
for (const d of dirs) for (const f of fs.readdirSync(path.join(REACT_SRC, d))) {
  const file = path.join(REACT_SRC, d, f); if (!/\.tsx?$/.test(f) || f === 'index.ts') continue;
  const ex = moduleExports(ctx, file); if (!ex) continue;
  const v = [], t = [];
  for (const [n, s] of ex) { const a = s.flags & ts.SymbolFlags.Alias ? ctx.checker.getAliasedSymbol(s) : s; (a.flags & ts.SymbolFlags.Value ? v : t).push(n); }
  console.log(`${d}/${f}\n  V: ${v.join(' ')}\n  T: ${t.join(' ')}`);
}
