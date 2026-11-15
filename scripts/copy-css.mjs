// Copies the stylesheets of @rhfan2019/smart-kit into dist (styles.css imports tokens.css).
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const pkg = join(import.meta.dirname, '../packages/react');
mkdirSync(join(pkg, 'dist'), { recursive: true });
for (const f of ['styles.css', 'tokens.css']) copyFileSync(join(pkg, 'src/theme', f), join(pkg, 'dist', f));
console.log('copied styles.css, tokens.css');
