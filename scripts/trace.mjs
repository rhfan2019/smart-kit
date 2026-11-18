// Traceability (AC-MOD-04 / v5 §9.10, docs/13 W9):
// - phase 1: every phase-1 annotation term (docs/02) and every criterion of docs/07 is referenced by a test whose
//   name contains its id;
// - phase 2: every criterion of docs/13 and every phase-2 annotation term of docs/02 maps to a test that PASSED in the
//   latest results (reports/unit-results.json from `npm test`, reports/e2e-results.json from `npm run e2e`);
// - phase 3: every micro chart criterion of docs/17 tested by U or E maps to a passing test;
// - cards: every criterion of docs/22 tested by U or E maps to a passing test;
// - controls: the same for docs/27;
// - grouping and totals: every criterion of docs/23 §7 tested by U or E maps to a passing test;
// - SAPUI5 alignment: every row of the docs/32 appendix tested by U, E or F maps to a passing test (F: reports/e2e-fe-results.json).
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
  // the Fiori elements comparison (npm run e2e:fe, docs/30 §7.2) is optional here; AL rows that need it say so
  const fe = join(ROOT, 'reports/e2e-fe-results.json');
  if (existsSync(fe)) {
    const r = JSON.parse(readFileSync(fe, 'utf8'));
    const walk = (suite, file) => {
      for (const spec of suite.specs ?? []) out.push({ title: spec.title, passed: spec.ok === true && spec.tests.some((t) => t.status !== 'skipped'), source: suite.file ?? file });
      for (const s of suite.suites ?? []) walk(s, suite.file ?? file);
    };
    for (const s of r.suites ?? []) walk(s, s.file);
  }
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

// ---------------------------------------------------------------- phase 3 (micro charts, docs/17)
const p3doc = readFileSync(join(ROOT, 'docs/17-phase3-acceptance.md'), 'utf8');
// Rows whose acceptance method includes U or E need a passing test; D (guidance only) does not.
const p3 = [...p3doc.matchAll(/^\| (MC-\d+) \|.*\| ([^|]*) \|$/gm)].filter((m) => /[UE]/.test(m[2])).map((m) => m[1]);
const p3Rows = p3.map((id) => {
  const ts = traced(id);
  return { id, total: ts.length, passed: ts.filter((t) => t.passed).length, sources: [...new Set(ts.map((t) => t.source))] };
});
const p3NotTraced = p3Rows.filter((r) => r.total === 0).map((r) => r.id);
const p3NotPassing = p3Rows.filter((r) => r.total > 0 && r.passed < r.total).map((r) => `${r.id} (${r.passed}/${r.total})`);
console.log(`phase 3 · micro chart criteria (docs/17): ${p3Rows.length - p3NotTraced.length - p3NotPassing.length}/${p3Rows.length} traced to passing tests`);
if (p3NotTraced.length) console.log(`  without a test: ${p3NotTraced.join(', ')}`);
if (p3NotPassing.length) console.log(`  failing: ${p3NotPassing.join(', ')}`);
if (verbose) for (const r of p3Rows) console.log(`${r.id}\t${r.passed}/${r.total}\t${r.sources.join(', ')}`);

// ---------------------------------------------------------------- cards (docs/22)
const cdDoc = readFileSync(join(ROOT, 'docs/22-cards-acceptance.md'), 'utf8');
const cd = [...cdDoc.matchAll(/^\| (CD-\d+) \|.*\| ([^|]*) \|$/gm)].filter((m) => /[UE]/.test(m[2])).map((m) => m[1]);
const cdRows = cd.map((id) => {
  const ts = traced(id);
  return { id, total: ts.length, passed: ts.filter((t) => t.passed).length, sources: [...new Set(ts.map((t) => t.source))] };
});
const cdNotTraced = cdRows.filter((r) => r.total === 0).map((r) => r.id);
const cdNotPassing = cdRows.filter((r) => r.total > 0 && r.passed < r.total).map((r) => `${r.id} (${r.passed}/${r.total})`);
console.log(`cards · criteria (docs/22): ${cdRows.length - cdNotTraced.length - cdNotPassing.length}/${cdRows.length} traced to passing tests`);
if (cdNotTraced.length) console.log(`  without a test: ${cdNotTraced.join(', ')}`);
if (cdNotPassing.length) console.log(`  failing: ${cdNotPassing.join(', ')}`);
if (verbose) for (const r of cdRows) console.log(`${r.id}\t${r.passed}/${r.total}\t${r.sources.join(', ')}`);

// ---------------------------------------------------------------- general controls (docs/27)
const ueDoc = readFileSync(join(ROOT, 'docs/27-ui-elements-acceptance.md'), 'utf8');
const ue = [...ueDoc.matchAll(/^\| (UE-\d+) \|.*\| ([^|]*) \|$/gm)].filter((m) => /[UE]/.test(m[2])).map((m) => m[1]);
const ueRows = ue.map((id) => {
  const ts = traced(id);
  return { id, total: ts.length, passed: ts.filter((t) => t.passed).length, sources: [...new Set(ts.map((t) => t.source))] };
});
const ueNotTraced = ueRows.filter((r) => r.total === 0).map((r) => r.id);
const ueNotPassing = ueRows.filter((r) => r.total > 0 && r.passed < r.total).map((r) => `${r.id} (${r.passed}/${r.total})`);
console.log(`controls · criteria (docs/27): ${ueRows.length - ueNotTraced.length - ueNotPassing.length}/${ueRows.length} traced to passing tests`);
if (ueNotTraced.length) console.log(`  without a test: ${ueNotTraced.join(', ')}`);
if (ueNotPassing.length) console.log(`  failing: ${ueNotPassing.join(', ')}`);
if (verbose) for (const r of ueRows) console.log(`${r.id}\t${r.passed}/${r.total}\t${r.sources.join(', ')}`);

// ---------------------------------------------------------------- grouping and totals (docs/23 §7)
const gtDoc = readFileSync(join(ROOT, 'docs/23-grouping-totals-plan.md'), 'utf8');
const gt = [...gtDoc.matchAll(/^\| (GT-\d+) \|.*\| ([^|]*) \|$/gm)].filter((m) => /[UE]/.test(m[2])).map((m) => m[1]);
const gtRows = gt.map((id) => {
  const ts = traced(id);
  return { id, total: ts.length, passed: ts.filter((t) => t.passed).length, sources: [...new Set(ts.map((t) => t.source))] };
});
const gtNotTraced = gtRows.filter((r) => r.total === 0).map((r) => r.id);
const gtNotPassing = gtRows.filter((r) => r.total > 0 && r.passed < r.total).map((r) => `${r.id} (${r.passed}/${r.total})`);
console.log(`grouping and totals · criteria (docs/23): ${gtRows.length - gtNotTraced.length - gtNotPassing.length}/${gtRows.length} traced to passing tests`);
if (gtNotTraced.length) console.log(`  without a test: ${gtNotTraced.join(', ')}`);
if (gtNotPassing.length) console.log(`  failing: ${gtNotPassing.join(', ')}`);
if (verbose) for (const r of gtRows) console.log(`${r.id}\t${r.passed}/${r.total}\t${r.sources.join(', ')}`);

// ---------------------------------------------------------------- SAPUI5 alignment (docs/32 appendix)
// Only the rows listed in the appendix of docs/32 ("已生效的条目") are required: each stage adds the ones it covers.
const alDoc = readFileSync(join(ROOT, 'docs/32-ui5-alignment-acceptance.md'), 'utf8');
const alSection = alDoc.split(/^## 附表/m)[1] ?? '';
const al = [...alSection.matchAll(/^\| (AL-\d+(?:-[\w.]+)?) \| (\d+) \| ([^|]*) \|/gm)].filter((m) => /[UEF]/.test(m[3])).map((m) => m[1]);
const alRows = al.map((id) => {
  const ts = traced(id);
  return { id, total: ts.length, passed: ts.filter((t) => t.passed).length, sources: [...new Set(ts.map((t) => t.source))] };
});
const alNotTraced = alRows.filter((r) => r.total === 0).map((r) => r.id);
const alNotPassing = alRows.filter((r) => r.total > 0 && r.passed < r.total).map((r) => `${r.id} (${r.passed}/${r.total})`);
console.log(`ui5 alignment · criteria (docs/32 appendix): ${alRows.length - alNotTraced.length - alNotPassing.length}/${alRows.length} traced to passing tests`);
if (alNotTraced.length) console.log(`  without a test: ${alNotTraced.join(', ')}`);
if (alNotPassing.length) console.log(`  failing: ${alNotPassing.join(', ')}`);
if (verbose) for (const r of alRows) console.log(`${r.id}\t${r.passed}/${r.total}\t${r.sources.join(', ')}`);

const failed = missingAnn.length || (strict && (alNotTraced.length || alNotPassing.length || missingAc.length || noResults.length || notTraced.length || notPassing.length || p3NotTraced.length || p3NotPassing.length || cdNotTraced.length || cdNotPassing.length || ueNotTraced.length || ueNotPassing.length || gtNotTraced.length || gtNotPassing.length));
process.exit(failed ? 1 : 0);
