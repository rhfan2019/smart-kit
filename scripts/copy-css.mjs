// Copies the stylesheets of @rhfan2019/smart-kit into dist (styles.css imports tokens.css) and writes
// styles.layered.css: both inlined in `@layer smart-kit { … }` (S8), so no bundler support for `@import … layer()` is needed.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const pkg = join(import.meta.dirname, '../packages/react');
const src = (f) => join(pkg, 'src/theme', f);
mkdirSync(join(pkg, 'dist'), { recursive: true });
for (const f of ['styles.css', 'tokens.css']) copyFileSync(src(f), join(pkg, 'dist', f));

const IMPORT = /^@import '\.\/tokens\.css';\n/m;
const styles = readFileSync(src('styles.css'), 'utf8');
if (!IMPORT.test(styles)) throw new Error("copy-css: styles.css no longer starts with @import './tokens.css'");
const body = `${readFileSync(src('tokens.css'), 'utf8')}\n${styles.replace(IMPORT, '')}`;
if (/@import\b/.test(body)) throw new Error('copy-css: an @import cannot be inlined into @layer smart-kit');
writeFileSync(join(pkg, 'dist/styles.layered.css'), `/* @rhfan2019/smart-kit styles in the cascade layer "smart-kit" */\n@layer smart-kit {\n${body}\n}\n`);
console.log('copied styles.css, tokens.css; wrote styles.layered.css');
