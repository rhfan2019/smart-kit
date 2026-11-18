'use client';

/**
 * Root entry: the infrastructure only (context, i18n, theme, util; ADR-033, D38). Components are imported by their
 * UI5 module path (`@rhfan2019/smart-kit/m/MessageBox`, `@rhfan2019/smart-kit/v4/fe/macros/Table`) or from `kit/…`;
 * the page templates from `/templates` until stage 5. Everything exported here is listed in docs/api.md (AC-Q-03).
 */
export * from './entries/context';
export * from './entries/i18n';
export * from './entries/theme';
export * from './entries/util';
