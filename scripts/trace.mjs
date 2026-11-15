// Traceability (AC-MOD-04 / v5 §9.10, docs/13 W9):
// - phase 1: every phase-1 annotation term (docs/02) and every criterion of docs/07 is referenced by a test whose
//   name contains its id;
// - phase 2: every criterion of docs/13 and every phase-2 annotation term of docs/02 maps to a test that PASSED in the
//   latest results (reports/unit-results.json from `npm test`, reports/e2e-results.json from `npm run e2e`).
// `--strict` fails on any gap; `--verbose` lists the tests per id.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const strict = process.argv.includes('--strict');
const verbose = process.argv.includes('--verbose');
const files = (d) => readdirSync(d).flatMap((n) => (n === 'node_modules' ? [] : statSync(join(d, n)).isDirectory() ? files(join(d, n)) : [join(d, n)]));
const tests = [...files(join(ROOT, 'packages')), ...files(join(ROOT, 'tests'))].filter((f) => /\.(test|spec)\.tsx?$/.test(f));
const corpus = tests.map((f) => ({ f: relative(ROOT, f), text: readFileSync(f, 'utf8') }));
const idRe = (id) => new RegExp(`${id.replace(/[-]/g, '\\-')}(?![\\w])`);

// ---------------------------------------------------------------- phase 1 (test names in the sources)
const coverage = readFileSync(join(ROOT, 'docs/02-annotation-coverage.md'), 'utf8');
const ann1 = new Set();
const ann2 = new Set();
for (const line of coverage.split('\n')) {
  if (line.includes('一期')) for (const m of line.matchAll(/ANN-\d+/g)) ann1.add(m[0]);
  else if (line.includes('二期')) for (const m of line.matchAll(/ANN-\d+/g)) ann2.add(m[0]);
}
const acceptance = readFileSync(join(ROOT, 'docs/07-acceptance.md'), 'utf8');
const ac = new Set([...acceptance.matchAll(/^\| (AC-[A-Z0-9]+-\d+) \|/gm)].map((m) => m[1]));
const find = (id) => corpus.filter((c) => idRe(id).test(c.text)).map((c) => c.f);
const report = (ids) => [...ids].map((id) => ({ id, files: find(id) }));
const annRows = report(ann1);
const acRows = report(ac);
const missingAnn = annRows.filter((r) => !r.files.length).map((r) => r.id);
const missingAc = acRows.filter((r) => !r.files.length).map((r) => r.id);
console.log(`phase 1 · annotation terms: ${annRows.length - missingAnn.length}/${annRows.length} traced`);
console.log(`phase 1 · acceptance criteria (docs/07): ${acRows.length - missingAc.length}/${acRows.length} traced`);
if (missingAnn.length) console.log(`  missing ANN: ${missingAnn.join(', ')}`);
if (missingAc.length) console.log(`  missing AC: ${missingAc.join(', ')}`);
if (verbose) for (const r of [...annRows, ...acRows]) console.log(`${r.id}\t${r.files.join(', ')}`);

// ---------------------------------------------------------------- phase 2 (passing tests from the results)
/** Test titles with their status from the Vitest and Playwright JSON results. */
function results() {
  const out = [];
  const unit = join(ROOT, 'reports/unit-results.json');
  const e2e = join(ROOT, 'reports/e2e-results.json');
  const missing = [];
  if (existsSync(unit)) {
    const r = JSON.parse(readFileSync(unit, 'utf8'));
    for (const file of r.testResults ?? []) for (const t of file.assertionResults ?? []) out.push({ title: t.fullName ?? t.title, passed: t.status === 'passed', source: relative(ROOT, file.name) });
  } else missing.push('reports/unit-results.json (run `npm test`)');
  if (existsSync(e2e)) {
    const r = JSON.parse(readFileSync(e2e, 'utf8'));
    const walk = (suite, file) => {
      for (const spec of suite.specs ?? []) {
        // `ok` is true when every run of the spec passed (or passed on retry); skipped specs do not count.
        const ran = spec.tests.some((t) => t.status !== 'skipped');
        out.push({ title: spec.title, passed: spec.ok === true && ran, source: suite.file ?? file });
      }
      for (const s of suite.suites ?? []) walk(s, suite.file ?? file);
    };
    for (const s of r.suites ?? []) walk(s, s.file);
  } else missing.push('reports/e2e-results.json (run `npm run e2e`)');
  return { tests: out, missing };
}
const p2doc = readFileSync(join(ROOT, 'docs/13-phase2-acceptance.md'), 'utf8');
const p2 = [...new Set([...p2doc.matchAll(/^\| (P2-[A-Z]+-\d+[a-z]?) \|/gm)].map((m) => m[1]))];
const { tests: run, missing: noResults } = results();
const traced = (id) => run.filter((t) => idRe(id).test(t.title));
const p2Rows = [...p2, ...ann2].map((id) => {
  const ts = traced(id);
  return { id, total: ts.length, passed: ts.filter((t) => t.passed).length, sources: [...new Set(ts.map((t) => t.source))] };
});
const notTraced = p2Rows.filter((r) => r.total === 0).map((r) => r.id);
const notPassing = p2Rows.filter((r) => r.total > 0 && r.passed < r.total).map((r) => `${r.id} (${r.passed}/${r.total})`);
console.log(`phase 2 · criteria (docs/13) and phase-2 annotation terms: ${p2Rows.length - notTraced.length - notPassing.length}/${p2Rows.length} traced to passing tests`);
if (noResults.length) console.log(`  no results: ${noResults.join('; ')}`);
if (notTraced.length) console.log(`  without a test: ${notTraced.join(', ')}`);
if (notPassing.length) console.log(`  failing: ${notPassing.join(', ')}`);
if (verbose) for (const r of p2Rows) console.log(`${r.id}\t${r.passed}/${r.total}\t${r.sources.join(', ')}`);

const failed = missingAnn.length || (strict && (missingAc.length || noResults.length || notTraced.length || notPassing.length));
process.exit(failed ? 1 : 0);
