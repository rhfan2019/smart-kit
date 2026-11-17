/**
 * ADR-030: the docs that ship for coding agents stay true to the code.
 * - every `ts` / `tsx` code block in packages/<pkg>/docs/*.md and packages/react/skills/**\/SKILL.md compiles, imported
 *   the way a user imports (`@rhfan2019/...` resolves to the sources here); a block whose info string contains
 *   `no-check` is skipped;
 * - the generated reference (scripts/gen-agent-docs.mjs) is up to date;
 * - the subpath table of the React guide names every subpath, and every component it names is exported there;
 * - each package's `files` ships its docs.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '../..');
const PKGS = ['core', 'react', 'server', 'cli'];
const mdFiles = (dir: string): string[] =>
  existsSync(dir) ? readdirSync(dir, { recursive: true }).map(String).filter((f) => f.endsWith('.md')).map((f) => join(dir, f)) : [];
const docs = PKGS.flatMap((p) => [join(ROOT, 'packages', p, 'README.md'), ...mdFiles(join(ROOT, 'packages', p, 'docs')), ...mdFiles(join(ROOT, 'packages', p, 'skills'))])
  .filter((f) => !f.endsWith('reference.md'));

interface Block { file: string; line: number; lang: 'ts' | 'tsx'; code: string }
function blocks(file: string): Block[] {
  const out: Block[] = [];
  const lines = readFileSync(file, 'utf8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = /^```(tsx?)\b(.*)$/.exec(lines[i]!);
    if (!m) continue;
    const start = i + 1;
    while (i + 1 < lines.length && lines[i + 1] !== '```') i++;
    if (!m[2]!.includes('no-check')) out.push({ file, line: start, lang: m[1] as 'ts' | 'tsx', code: lines.slice(start, i + 1).join('\n') });
    i++;
  }
  return out;
}

describe('docs for coding agents (ADR-030)', () => {
  it('every ts / tsx code block compiles against the packages', () => {
    const all = docs.flatMap(blocks);
    expect(all.length).toBeGreaterThan(10);
    const dir = join(ROOT, 'node_modules/.cache/smart-kit-doc-blocks');
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    const names = all.map((b, i) => {
      const name = `b${String(i).padStart(3, '0')}.${b.lang}`;
      // each block is a module of its own (`export {}` keeps top-level names apart)
      writeFileSync(join(dir, name), `${b.code}\nexport {};\n`);
      return name;
    });
    writeFileSync(join(dir, 'tsconfig.json'), JSON.stringify({
      extends: '../../../tsconfig.base.json',
      compilerOptions: { types: ['node', 'vite/client'], noEmit: true, noUnusedLocals: false },
      files: names,
    }));
    let out = '';
    try {
      execFileSync(join(ROOT, 'node_modules/.bin/tsc'), ['-p', join(dir, 'tsconfig.json')], { encoding: 'utf8', cwd: ROOT });
    } catch (e) {
      out = String((e as { stdout?: string }).stdout ?? e);
    }
    // map "bNNN.tsx(line,col)" back to the doc file and line
    const mapped = out.replace(/(?:node_modules\/\.cache\/smart-kit-doc-blocks\/)?b(\d{3})\.tsx?\((\d+),(\d+)\)/g, (_m, n: string, l: string, c: string) => {
      const b = all[Number(n)]!;
      return `${relative(ROOT, b.file)}:${b.line + Number(l)}:${c}`;
    });
    expect(mapped.trim(), mapped).toBe('');
  }, 120_000);

  it('the generated API reference is up to date (node scripts/gen-agent-docs.mjs)', () => {
    let error = '';
    try {
      execFileSync('node', [join(ROOT, 'scripts/gen-agent-docs.mjs'), '--check'], { encoding: 'utf8', cwd: ROOT, stdio: 'pipe' });
    } catch (e) {
      error = String((e as { stderr?: string }).stderr ?? e);
    }
    expect(error).toBe('');
  }, 120_000);

  it('the subpath table of the React guide matches package.json and the entries', async () => {
    const guide = readFileSync(join(ROOT, 'packages/react/docs/README.md'), 'utf8');
    const pkg = JSON.parse(readFileSync(join(ROOT, 'packages/react/package.json'), 'utf8')) as { exports: Record<string, unknown> };
    const rows = [...guide.matchAll(/^\| `@rhfan2019\/smart-kit\/([\w.]+)` \| (.*?) \|/gm)];
    const listed = rows.map((r) => `./${r[1]}`).sort();
    expect(listed).toEqual(Object.keys(pkg.exports).filter((k) => k !== '.').sort());
    for (const [, sub, names] of rows) {
      if (sub === 'styles.css') continue;
      const mod = (await import(join(ROOT, `packages/react/src/entries/${sub}.ts`))) as Record<string, unknown>;
      for (const [, name] of names!.matchAll(/`(\w+)`/g)) expect(Object.keys(mod), `${name} in /${sub}`).toContain(name);
    }
  }, 60_000);

  it('every package ships docs/README.md and docs/reference.md', () => {
    for (const p of PKGS) {
      const pkg = JSON.parse(readFileSync(join(ROOT, 'packages', p, 'package.json'), 'utf8')) as { files: string[] };
      expect(pkg.files, p).toContain('docs');
      expect(existsSync(join(ROOT, 'packages', p, 'docs/README.md')), `${p}/docs/README.md`).toBe(true);
      expect(existsSync(join(ROOT, 'packages', p, 'docs/reference.md')), `${p}/docs/reference.md`).toBe(true);
    }
  });
});
