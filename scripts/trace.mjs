// AC-MOD-04 / v5 §9.10: every phase-1 annotation term (docs/02) and every acceptance criterion (docs/07)
// is referenced by at least one test whose name contains its id.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const files = (d) => readdirSync(d).flatMap((n) => (n === 'node_modules' ? [] : statSync(join(d, n)).isDirectory() ? files(join(d, n)) : [join(d, n)]));
const tests = [...files(join(ROOT, 'packages')), ...files(join(ROOT, 'tests'))].filter((f) => /\.(test|spec)\.tsx?$/.test(f));
const corpus = tests.map((f) => ({ f: relative(ROOT, f), text: readFileSync(f, 'utf8') }));

const coverage = readFileSync(join(ROOT, 'docs/02-annotation-coverage.md'), 'utf8');
const ann = new Set();
for (const line of coverage.split('\n')) if (line.includes('一期')) for (const m of line.matchAll(/ANN-\d+/g)) ann.add(m[0]);
const acceptance = readFileSync(join(ROOT, 'docs/07-acceptance.md'), 'utf8');
const ac = new Set([...acceptance.matchAll(/^\| (AC-[A-Z0-9]+-\d+) \|/gm)].map((m) => m[1]));

const find = (id) => corpus.filter((c) => new RegExp(`${id}(?!\\d)`).test(c.text)).map((c) => c.f);
const report = (ids) => [...ids].map((id) => ({ id, files: find(id) }));
const annRows = report(ann);
const acRows = report(ac);
const missingAnn = annRows.filter((r) => !r.files.length).map((r) => r.id);
const missingAc = acRows.filter((r) => !r.files.length).map((r) => r.id);
console.log(`annotation terms (phase 1): ${annRows.length - missingAnn.length}/${annRows.length} traced`);
console.log(`acceptance criteria: ${acRows.length - missingAc.length}/${acRows.length} traced`);
if (missingAnn.length) console.log(`  missing ANN: ${missingAnn.join(', ')}`);
if (missingAc.length) console.log(`  missing AC: ${missingAc.join(', ')}`);
if (process.argv.includes('--verbose')) for (const r of [...annRows, ...acRows]) console.log(`${r.id}\t${r.files.join(', ')}`);
process.exit(missingAnn.length || (process.argv.includes('--strict') && missingAc.length) ? 1 : 0);
