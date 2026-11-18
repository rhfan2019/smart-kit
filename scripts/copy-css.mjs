// Copies the stylesheets of @rhfan2019/smart-kit into dist and writes styles.layered.css (S8). styles.css imports
// tokens.css (kept as a separate file in dist) and the stylesheets of the controls (./controls-*.css, docs/26), which
// are inlined into dist/styles.css. styles.layered.css has everything inside `@layer smart-kit { … }`, so no bundler
// support for `@import … layer()` is needed.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const pkg = join(import.meta.dirname, '../packages/react');
const src = (f) => join(pkg, 'src/theme', f);
mkdirSync(join(pkg, 'dist'), { recursive: true });
copyFileSync(src('tokens.css'), join(pkg, 'dist/tokens.css'));

const IMPORT = /^@import '\.\/tokens\.css';\n/m;
const LOCAL = /^@import '\.\/(controls-[\w-]+\.css)';\n/gm;
const raw = readFileSync(src('styles.css'), 'utf8');
if (!IMPORT.test(raw)) throw new Error("copy-css: styles.css no longer starts with @import './tokens.css'");
const styles = raw.replace(LOCAL, (_, f) => `${readFileSync(src(f), 'utf8')}\n`);
writeFileSync(join(pkg, 'dist/styles.css'), styles);
const body = `${readFileSync(src('tokens.css'), 'utf8')}\n${styles.replace(IMPORT, '')}`;
if (/@import\b/.test(body)) throw new Error('copy-css: an @import cannot be inlined into @layer smart-kit');
writeFileSync(join(pkg, 'dist/styles.layered.css'), `/* @rhfan2019/smart-kit styles in the cascade layer "smart-kit" */\n@layer smart-kit {\n${body}\n}\n`);
console.log('copied styles.css (controls inlined), tokens.css; wrote styles.layered.css');
