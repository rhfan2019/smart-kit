// Downloads and caches the SAPUI5 api.json files used by the alignment checks (docs/30 §7.1, §8).
// The files are SAP's: they are only cached under .cache/ui5 (git-ignored) and never committed or published (ADR-033 §9).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const UI5_VERSION = '1.154.0';
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const CACHE_DIR = path.join(ROOT, '.cache', 'ui5', UI5_VERSION);

/** Libraries whose api.json the checks read; a class belongs to the longest matching library name. */
export const LIBRARIES = [
  'sap.fe.macros', 'sap.fe.templates', 'sap.fe.core', 'sap.fe.base', 'sap.fe.controls',
  'sap.m', 'sap.f', 'sap.uxap', 'sap.ui.core', 'sap.ui.unified', 'sap.ui.table', 'sap.ui.layout',
  'sap.suite.ui.commons', 'sap.suite.ui.microchart', 'sap.ui.integration', 'sap.ui.mdc',
];

export function libraryOf(name) {
  let best = null;
  for (const lib of LIBRARIES) if ((name === lib || name.startsWith(lib + '.')) && (!best || lib.length > best.length)) best = lib;
  return best;
}

function apiUrl(lib) {
  return `https://ui5.sap.com/${UI5_VERSION}/test-resources/${lib.replaceAll('.', '/')}/designtime/api.json`;
}

export function apiFile(lib) {
  return path.join(CACHE_DIR, 'api', `${lib}.api.json`);
}

/** Ensures the api.json of every library is cached; downloads the missing ones. Missing libraries on the server are recorded as empty. */
export async function ensureApi(libs = LIBRARIES, { log = () => {} } = {}) {
  fs.mkdirSync(path.join(CACHE_DIR, 'api'), { recursive: true });
  for (const lib of libs) {
    const file = apiFile(lib);
    if (fs.existsSync(file)) continue;
    const url = apiUrl(lib);
    log(`download ${url}`);
    const res = await fetch(url);
    if (res.status === 404) { fs.writeFileSync(file, JSON.stringify({ library: lib, symbols: [], missing: true })); continue; }
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    fs.writeFileSync(file, await res.text());
  }
}

/** Loads the cached api.json files into one index by symbol name. */
export function loadApi(libs = LIBRARIES) {
  const symbols = new Map();
  for (const lib of libs) {
    const file = apiFile(lib);
    if (!fs.existsSync(file)) continue;
    const json = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const s of json.symbols ?? []) symbols.set(s.name, { ...s, library: lib });
  }
  return symbols;
}
