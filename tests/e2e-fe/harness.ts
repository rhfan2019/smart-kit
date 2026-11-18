/**
 * Runs one comparison scenario: diff, deviation register, reports, baseline (docs/30 §7.2).
 *
 * Env:
 *   FE_DEVIATIONS  register file to read (default tools/ui5-alignment/deviations.json; missing file = empty)
 *   FE_BASELINE=1  (re)write the scenario's entries in tools/ui5-alignment/fe-baseline.json instead of failing
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { expect } from '@playwright/test';
import { baselineEntries, checkAgainstRegister, diffSnapshots, feDeviations, mergeBaseline, toMarkdown, type Checked, type Diff, type Snapshot } from './compare';

const ROOT = resolve(import.meta.dirname, '../..');
export const REGISTER = resolve(ROOT, process.env.FE_DEVIATIONS ?? 'tools/ui5-alignment/deviations.json');
export const BASELINE = resolve(ROOT, 'tools/ui5-alignment/fe-baseline.json');
export const REPORTS = resolve(ROOT, 'reports/fe-compare');

const readJson = (file: string): unknown => (existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : undefined);

/** The register plus the group registers `deviations.<group>.json` next to it (as scripts/check-ui5-api.mjs reads them). */
function readRegister(): unknown {
  const main = readJson(REGISTER) as { deviations?: unknown[] } | undefined;
  const dir = dirname(REGISTER);
  const extra = existsSync(dir) ? readdirSync(dir).filter((f) => /^deviations\..+\.json$/.test(f)) : [];
  const more = extra.flatMap((f) => ((readJson(resolve(dir, f)) as { deviations?: unknown[] } | undefined)?.deviations ?? []));
  return { deviations: [...(main?.deviations ?? []), ...more] };
}

export interface Outcome {
  diffs: Diff[];
  checked: Checked;
}

/** Diffs the snapshots, writes reports/fe-compare/<scenario>.{json,md}, and fails on unregistered differences. */
export function compareScenario(scenario: string, fe: Snapshot, sk: Snapshot, o: { report?: boolean; enforce?: boolean } = {}): Outcome {
  const diffs = diffSnapshots(fe, sk);
  const checked = checkAgainstRegister(scenario, diffs, feDeviations(readRegister()));
  if (o.report !== false) {
    mkdirSync(REPORTS, { recursive: true });
    writeFileSync(resolve(REPORTS, `${scenario}.json`), `${JSON.stringify({ scenario, register: REGISTER, diffs, unregistered: checked.unregistered, unused: checked.unused, fe, sk }, null, 2)}\n`);
    writeFileSync(resolve(REPORTS, `${scenario}.md`), toMarkdown(scenario, fe, sk, checked));
  }
  if (o.enforce === false) return { diffs, checked };
  if (process.env.FE_BASELINE === '1') {
    mkdirSync(dirname(BASELINE), { recursive: true });
    writeFileSync(BASELINE, `${JSON.stringify(mergeBaseline(readJson(BASELINE), scenario, baselineEntries(scenario, diffs)), null, 2)}\n`);
    return { diffs, checked };
  }
  expect(checked.unregistered.map((d) => `${d.kind} ${d.member}: ${d.detail}`), `unregistered FE differences (see reports/fe-compare/${scenario}.md)`).toEqual([]);
  return { diffs, checked };
}
