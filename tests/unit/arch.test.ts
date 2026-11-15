/** Repository-level architecture checks. */
import { execFileSync, execSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '../..');
const files = (d: string): string[] => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? files(join(d, n)) : [join(d, n)]));
const eslint = new ESLint({ cwd: ROOT });
const lint = async (code: string, file: string, rule?: string) =>
  (await eslint.lintText(code, { filePath: join(ROOT, file) }))[0]!.messages.filter((m) => !rule || m.ruleId === rule);

describe('dependency direction and router isolation (AC-NAV-04)', () => {
  it.each([
    ['core must not import React', "import { useState } from 'react';\nexport const x = useState;", 'packages/core/src/__probe.ts', 'no-restricted-imports'],
    ['core must not import Mantine', "import { Button } from '@mantine/core';\nexport const x = Button;", 'packages/core/src/__probe.ts', 'no-restricted-imports'],
    ['react must not import a router', "import { useNavigate } from 'react-router';\nexport const x = useNavigate;", 'packages/react/src/__probe.ts', 'no-restricted-imports'],
    ['react must not import apps', "import { App } from '../../../apps/demo/src/App';\nexport const x = App;", 'packages/react/src/__probe.ts', 'no-restricted-imports'],
    ['react must not read window.location', 'export const x = () => window.location.href;', 'packages/react/src/__probe.ts', 'no-restricted-properties'],
    ['react must not touch history', 'export const x = () => history.back();', 'packages/react/src/__probe.ts', 'no-restricted-globals'],
    ['react must not listen to popstate', "export const x = () => addEventListener('popstate', () => {});", 'packages/react/src/__probe.ts', 'no-restricted-syntax'],
  ])('rejects: %s', async (_n, code, file, rule) => {
    expect((await lint(code, file, rule)).length).toBeGreaterThan(0);
  });

  it('AC-BOOT-01 templates may only use the public entry', async () => {
    expect((await lint("import { SmartTable } from '../table/SmartTable';\nexport const x = SmartTable;", 'packages/react/src/templates/__probe.tsx', 'no-restricted-imports')).length).toBeGreaterThan(0);
    expect(await lint("import { SmartTable } from '../index';\nexport const x = SmartTable;", 'packages/react/src/templates/__probe.tsx', 'no-restricted-imports')).toEqual([]);
  });

  it('the whole repository passes lint', async () => {
    const results = await eslint.lintFiles(['packages', 'apps/demo', 'tests']);
    const errors = results.flatMap((r) => r.messages.filter((m) => m.severity === 2).map((m) => `${relative(ROOT, r.filePath)}:${m.line} ${m.ruleId} ${m.message}`));
    expect(errors).toEqual([]);
  }, 120_000);
});

describe('XSS (AC-EXT-05)', () => {
  it('dangerouslySetInnerHTML is rejected', async () => {
    expect((await lint('export const X = () => <div dangerouslySetInnerHTML={{ __html: "x" }} />;', 'packages/react/src/__probe.tsx', 'no-restricted-syntax')).length).toBeGreaterThan(0);
  });
});

describe('texts (AC-I18N-02)', () => {
  it('literal UI text in components is rejected', async () => {
    expect((await lint('export const X = () => <button title="Save">Save</button>;', 'packages/react/src/__probe.tsx', 'smart-kit/no-literal-ui-text')).length).toBe(2);
    expect(await lint('export const X = ({ t }: { t: (k: string) => string }) => <button title={t("a")}>{t("b")} · </button>;', 'packages/react/src/__probe.tsx', 'smart-kit/no-literal-ui-text')).toEqual([]);
  });

  it('zh and en messages have the same keys', async () => {
    const { en } = await import('../../packages/react/src/i18n/messages.en');
    const { zh } = await import('../../packages/react/src/i18n/messages.zh');
    expect(Object.keys(zh).sort()).toEqual(Object.keys(en).sort());
    for (const k of Object.keys(en) as (keyof typeof en)[]) {
      expect(typeof zh[k], k).toBe(typeof en[k]);
      const params = (v: unknown) => [...JSON.stringify(v).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join();
      expect(params(zh[k]), k).toBe(params(en[k]));
    }
  });

  it('no Chinese characters in library code outside the zh messages', () => {
    const hits = [...files(join(ROOT, 'packages/react/src')), ...files(join(ROOT, 'packages/core/src'))]
      .filter((f) => !f.endsWith('.zh.ts'))
      .filter((f) => /[一-鿿]/.test(readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')))
      .map((f) => relative(ROOT, f));
    expect(hits).toEqual([]);
  });
});

describe('no business entities in library code (AC-BOOT-03)', () => {
  it('core and react sources do not mention business entities', () => {
    const words = ['PurchaseOrder', 'Purchasing', 'Supplier', 'Northwind', 'Product', 'Material', 'Customer', '采购', '订单', '供应商', '产品', '物料', '客户'];
    const hits = [...files(join(ROOT, 'packages/react/src')), ...files(join(ROOT, 'packages/core/src'))].flatMap((f) => {
      const text = readFileSync(f, 'utf8');
      return words.filter((w) => text.includes(w)).map((w) => `${relative(ROOT, f)}: ${w}`);
    });
    expect(hits).toEqual([]);
  });
});

describe('scripts', () => {
  it('AC-THEME-03 no literal colors or sizes outside tokens.css', () => {
    expect(execFileSync('node', ['scripts/check-tokens.mjs'], { cwd: ROOT, encoding: 'utf8' })).toContain('ok');
  });
  it('AC-Q-04 trademark words are not used as names', async () => {
    expect(execFileSync('node', ['scripts/check-trademark.mjs'], { cwd: ROOT, encoding: 'utf8' })).toContain('ok');
  });
  it('AC-MOD-04 every phase-1 annotation term is traced to a test', () => {
    expect(execFileSync('node', ['scripts/trace.mjs'], { cwd: ROOT, encoding: 'utf8' })).toMatch(/phase 1 · annotation terms: (\d+)\/\1 traced/);
  });
  it('AC-Q-06 changelog and semantic versions', () => {
    expect(readFileSync(join(ROOT, 'CHANGELOG.md'), 'utf8')).toMatch(/## \[0\.1\.0\]/);
    for (const p of ['packages/core/package.json', 'packages/react/package.json']) {
      expect(JSON.parse(readFileSync(join(ROOT, p), 'utf8')).version).toMatch(/^\d+\.\d+\.\d+(-[\w.]+)?$/);
    }
  });
});

describe('CI (AC-Q-01)', () => {
  it('the CI workflow runs every machine check', () => {
    const ci = readFileSync(join(ROOT, '.github/workflows/ci.yml'), 'utf8');
    for (const step of ['npm run typecheck', 'npm run lint', 'npm test', 'npm run trace -- --strict', 'npm run build', 'npm run size', 'npm run build-storybook', 'npm run e2e']) expect(ci).toContain(step);
    expect(ci).not.toContain('dotnet'); // the test services are plain Node (ADR-009)
  });
});

describe('Storybook (AC-Q-05, P2-GEN-07)', () => {
  it('every exported building block has a story', () => {
    const api = readFileSync(join(ROOT, 'docs/api.md'), 'utf8').split('## `@rhfan2019/smart-kit`')[1]!.split('### 类型')[0]!;
    const components = [...api.matchAll(/^- `([A-Z]\w+)`/gm)].map((m) => m[1]!).filter((n) => !/Error$|^MESSAGES$|^INTL_LOCALE$/.test(n));
    const stories = files(join(ROOT, 'apps/storybook')).filter((f) => !f.includes('storybook-static') && /\.tsx?$/.test(f)).map((f) => readFileSync(f, 'utf8')).join('\n');
    expect(components.filter((c) => !new RegExp(`\\b${c}\\b`).test(stories))).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------- contrast (AC-THEME-04)

function tokenTables(): Record<string, Record<string, string>> {
  const css = readFileSync(join(ROOT, 'packages/react/src/theme/tokens.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const blocks = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].map((m) => ({ selectors: m[1]!.split(',').map((s) => s.trim()), body: m[2]! }));
  const decls = (body: string) => Object.fromEntries([...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1]!, m[2]!.trim()]));
  const root: Record<string, string> = {};
  for (const b of blocks) if (b.selectors.includes(':root')) Object.assign(root, decls(b.body));
  const out: Record<string, Record<string, string>> = { yellow: { ...root } };
  for (const theme of ['navy', 'dark']) {
    const t = { ...root };
    for (const b of blocks) if (b.selectors.includes(`[data-theme='${theme}']`)) Object.assign(t, decls(b.body));
    out[theme] = t;
  }
  return out;
}

function resolve(t: Record<string, string>, v: string, depth = 0): string {
  const m = v.match(/^var\((--[\w-]+)\)$/);
  return m && depth < 10 ? resolve(t, t[m[1]!] ?? '', depth + 1) : v;
}

function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
const contrast = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
};

describe('contrast (AC-THEME-04)', () => {
  const pairs: [string, string][] = [
    ['--sk-color-text', '--sk-color-surface'], ['--sk-color-text', '--sk-color-page'], ['--sk-color-text-muted', '--sk-color-surface'],
    ['--sk-color-text-subtle', '--sk-color-surface'], ['--sk-color-text-on-primary', '--sk-color-primary'], ['--sk-color-link', '--sk-color-surface'],
    ['--sk-color-positive', '--sk-color-surface'], ['--sk-color-negative', '--sk-color-surface'], ['--sk-color-critical', '--sk-color-surface'],
    ['--sk-color-info', '--sk-color-surface'], ['--sk-color-neutral', '--sk-color-surface'], ['--sk-color-text', '--sk-color-accent-wash'],
    ['--sk-color-text-muted', '--sk-color-surface-2'],
  ];
  for (const [theme, tokens] of Object.entries(tokenTables())) {
    it.each(pairs)(`${theme}: %s on %s ≥ 4.5`, (fg, bg) => {
      const f = resolve(tokens, `var(${fg})`);
      const b = resolve(tokens, `var(${bg})`);
      expect(f, fg).toMatch(/^#/);
      expect(b, bg).toMatch(/^#/);
      expect(contrast(f, b)).toBeGreaterThanOrEqual(4.5);
    });
  }
});

describe('bundle size (AC-Q-02, P2-GEN-08)', () => {
  it('P2-GEN-08 both packages build and stay within the gzip budgets', () => {
    execSync('npm run build -w @rhfan2019/smart-kit-core && npm run build -w @rhfan2019/smart-kit', { cwd: ROOT, stdio: 'pipe' });
    const out = execSync('node scripts/check-size.mjs', { cwd: ROOT, encoding: 'utf8' });
    expect(out).not.toContain('FAIL');
  }, 180_000);
});
