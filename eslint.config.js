// Lint rules that enforce the architecture (docs/06, docs/07): dependency direction, router isolation,
// no literal UI text, no dangerouslySetInnerHTML, templates use public exports only.
import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';
import noLiteralUiText from './tools/eslint/no-literal-ui-text.js';

const FRONTEND = ['react', 'react-dom', 'react/*', 'react-dom/*', '@mantine/*', 'ag-grid-*', '@tanstack/*', 'lucide-react', 'write-excel-file', 'write-excel-file/*'];
const ROUTERS = ['react-router', 'react-router/*', 'react-router-dom', 'react-router-dom/*', '@tanstack/react-router', '@tanstack/router*', 'next', 'next/*', 'wouter'];
const APPS = ['demo', 'demo/*', 'mock', '**/apps/**'];
// Node-only packages (ADR-027): never in browser code.
const NODE_ONLY = ['@rhfan2019/smart-kit-server', '@rhfan2019/smart-kit-server/*', '@rhfan2019/smart-kit-cli', '@rhfan2019/smart-kit-cli/*', 'pg', 'pg/*', 'kysely', 'kysely/*', 'chevrotain', 'node:*'];

export const boundaryRules = {
  core: {
    patterns: [
      { group: [...FRONTEND, '@rhfan2019/smart-kit', ...APPS], message: 'packages/core is pure TypeScript: no React, DOM libraries, UI packages or apps' },
      { group: NODE_ONLY, message: 'packages/core runs in the browser: no server packages, database drivers or Node modules (ADR-027)' },
    ],
  },
  react: {
    patterns: [
      { group: [...APPS, ...ROUTERS], message: 'packages/react must not depend on apps/* or any router library (docs/06 §5)' },
      { group: NODE_ONLY, message: 'packages/react runs in the browser: no server packages, database drivers or Node modules (ADR-027)' },
    ],
  },
  server: { patterns: [{ group: [...FRONTEND, '@rhfan2019/smart-kit', '@rhfan2019/smart-kit/*', ...APPS, '@rhfan2019/smart-kit-cli'], message: 'packages/server is Node only: no React, UI packages, apps or the CLI (ADR-027)' }] },
  templates: {
    patterns: [
      { group: [...APPS, ...ROUTERS], message: 'templates must not depend on apps/* or routers' },
      // the public API: the root entry and the UI5-aligned modules (ADR-033)
      { group: ['../*/**', '!../index', ...['m', 'f', 'ui', 'suite', 'base', 'kit', 'v4'].map((d) => `!../${d}/**`)], message: 'templates may only import the public API ("../index" or a public module such as "../m/MessageBox") (AC-BOOT-01)' },
    ],
  },
};

const noUrlAccess = {
  'no-restricted-globals': ['error', { name: 'location', message: 'The library never reads or writes the URL (NAV-06).' }, { name: 'history', message: 'The library never touches the history (NAV-06).' }],
  'no-restricted-properties': ['error', { object: 'window', property: 'location', message: 'NAV-06' }, { object: 'window', property: 'history', message: 'NAV-06' }, { object: 'document', property: 'location', message: 'NAV-06' }],
  'no-restricted-syntax': [
    'error',
    { selector: "Literal[value='popstate']", message: 'The library must not listen to popstate (NAV-06).' },
    { selector: "Literal[value='hashchange']", message: 'The library must not listen to hashchange (NAV-06).' },
    { selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']", message: 'dangerouslySetInnerHTML is not allowed (XSS, AC-EXT-05).' },
  ],
};

export default tseslint.config(
  { ignores: ['.cache/**', '**/node_modules/**', '**/dist/**', '**/bin/**', '**/obj/**', 'apps/mock/**', 'test-results/**', 'playwright-report/**', 'storybook-static/**', 'apps/storybook/storybook-static/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: { 'react-hooks': reactHooks, 'smart-kit': { rules: { 'no-literal-ui-text': noLiteralUiText } } },
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' }],
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  { files: ['packages/core/src/**'], rules: { 'no-restricted-imports': ['error', boundaryRules.core], ...noUrlAccess } },
  { files: ['packages/react/src/**'], rules: { 'no-restricted-imports': ['error', boundaryRules.react], ...noUrlAccess } },
  { files: ['packages/server/src/**', 'packages/cli/src/**'], rules: { 'no-restricted-imports': ['error', boundaryRules.server] } },
  { files: ['packages/react/src/**/*.tsx'], ignores: ['packages/react/src/i18n/**'], rules: { 'smart-kit/no-literal-ui-text': 'error' } },
  { files: ['packages/react/src/templates/**'], rules: { 'no-restricted-imports': ['error', boundaryRules.templates] } },
);
