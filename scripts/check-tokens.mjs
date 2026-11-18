// AC-THEME-03: no literal colors, spacing or font sizes outside theme/tokens.css.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const SRC = join(ROOT, 'packages/react/src');
const files = (d) => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? files(join(d, n)) : [join(d, n)]));
const COLOR = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(|\boklch\(/;
const CSS_PX = /(?<![\w-])\d*\.?\d+px\b/;
const TS_PX = /['"`]\s*-?\d*\.?\d+(px|rem|em)\s*['"`]/;
const NAMED = /:\s*(red|blue|green|black|white|gray|grey|yellow|orange|purple)\s*[;}]/i;

const problems = [];
for (const f of files(SRC)) {
  const rel = relative(ROOT, f);
  if (f.endsWith('tokens.css') || /messages\.(zh|en)\.ts$/.test(f)) continue;
  if (!/\.(css|ts|tsx)$/.test(f)) continue;
  readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
    const code = line.replace(/\/\*.*?\*\/|\/\/.*$/g, '');
    if (COLOR.test(code)) problems.push(`${rel}:${i + 1} color literal: ${line.trim()}`);
    if (f.endsWith('.css') && !/@(container|media)/.test(code) && CSS_PX.test(code)) problems.push(`${rel}:${i + 1} size literal: ${line.trim()}`);
    if (f.endsWith('.css') && NAMED.test(code)) problems.push(`${rel}:${i + 1} named color: ${line.trim()}`);
    // `// ui5-default`: a CSS length that is the SAPUI5 default value of a property (ADR-033), not styling
    if (!f.endsWith('.css') && TS_PX.test(code) && !line.includes('// ui5-default')) problems.push(`${rel}:${i + 1} size literal: ${line.trim()}`);
  });
}
if (problems.length) {
  console.error(`check-tokens: ${problems.length} problem(s)\n${problems.join('\n')}`);
  process.exit(1);
}
console.log('check-tokens: ok');
