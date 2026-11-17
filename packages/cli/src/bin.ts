#!/usr/bin/env node
// smart-kit <command> [options]
//   generate [--config smart-kit.config.json] [--url postgres://…] [--strict]
//       Reads the PostgreSQL schema, writes the generated CSDL and storage mapping, checks the annotation files.
//   check [--config smart-kit.config.json] [--strict]
//       Checks the annotation files against the generated CSDL on disk (no database).
// --strict: exit code 1 when an annotation points at something that does not exist.
import { relative } from 'node:path';
import { parseArgs } from 'node:util';
import { loadConfig } from './config';
import { check, generate } from './generate';
import type { CheckProblem } from './check';

const USAGE = `Usage: smart-kit <generate|check> [--config smart-kit.config.json] [--url postgres://…] [--strict]`;

function report(problems: CheckProblem[]) {
  if (!problems.length) {
    console.log('Annotations: every target and path exists.');
    return;
  }
  console.log(`Annotations: ${problems.length} target(s) or path(s) no longer exist:`);
  for (const p of problems) console.log(`  ${p.file}  ${p.target}: ${p.message}`);
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { config: { type: 'string', default: 'smart-kit.config.json' }, url: { type: 'string' }, strict: { type: 'boolean', default: false }, help: { type: 'boolean' } },
  });
  const command = positionals[0];
  if (values.help || !command) {
    console.log(USAGE);
    return;
  }
  const config = loadConfig(values.config!);
  let problems: CheckProblem[];
  if (command === 'generate') {
    const r = await generate(config, { url: values.url });
    console.log(`${r.changed ? 'Wrote' : 'Unchanged'}: ${relative(process.cwd(), r.csdlPath)}, ${relative(process.cwd(), r.storagePath)} (${r.entitySets.length} entity sets: ${r.entitySets.join(', ')})`);
    for (const w of r.warnings) console.log(`  warning: ${w}`);
    problems = r.problems;
  } else if (command === 'check') problems = check(config);
  else {
    console.error(USAGE);
    process.exit(2);
  }
  report(problems);
  if (values.strict && problems.length) process.exit(1);
}

main().catch((e: Error) => {
  console.error(`smart-kit: ${e.message}`);
  process.exit(1);
});
