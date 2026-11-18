/**
 * Pure part of the Fiori elements comparison (docs/30 §7.2, AL-10 – AL-12, AL-21): batch parsing, request
 * normalization, structure / text snapshots, the diff, the deviation register and the report. No Playwright
 * imports here, so tests/unit/fe-compare.test.ts can test all of it.
 */

// ---------------------------------------------------------------------------------------------- types

/** Query options that are compared (AL-10); `$top` is the page size. */
export const COMPARED_OPTIONS = ['$select', '$filter', '$orderby', '$apply', '$expand', '$search', '$count', '$top'] as const;
export type ComparedOption = (typeof COMPARED_OPTIONS)[number];

/** One OData GET, relative to its service root, with only the compared options (canonical strings). */
export interface NormalizedRequest {
  /** Service root, e.g. "/odata/purchasing/". */
  service: string;
  /** Resource path relative to the service root, e.g. "PurchaseOrders" or "PurchaseOrders('1')/_Items". */
  resource: string;
  options: Partial<Record<ComparedOption, string>>;
}

/** What a list report shows (AL-11). Arrays keep the display order. */
export interface Structure {
  /** Filter bar fields by label; the basic search is "[search]". */
  filterFields: string[];
  /** Table column headers; columns without header text are left out. */
  columns: string[];
  /** Table toolbar actions by text; disabled ones get the suffix " [disabled]". */
  actions: string[];
  /** Options of the draft editing status filter (empty when there is none). */
  editingStatus: string[];
  /** View tabs / view switch entries (empty when there are none). */
  viewTabs: string[];
  /** Chart type of the chart view (empty string when there is none). */
  chartType: string;
}

/** Cell text of the first rows: one record per row, keyed by column header (AL-12). */
export type TextRows = Record<string, string>[];

export interface Snapshot {
  requests: NormalizedRequest[];
  structure: Structure;
  text: TextRows;
}

export type DiffKind = 'request' | 'structure' | 'text';

export interface Diff {
  kind: DiffKind;
  /** The aspect: a query option ("$select"), "request:<resource>" for an unmatched request, a structure key, or a column header (text). */
  member: string;
  /** Short English description. */
  detail: string;
  fe?: unknown;
  sk?: unknown;
}

/** Entry of the deviation register (tools/ui5-alignment/deviations.json, category fe-behavior). */
export interface FeDeviation {
  id?: string;
  module: string;
  kind: DiffKind;
  member: string;
  category: 'fe-behavior';
  stage: number;
  reason: string;
  ref?: string;
}

// ---------------------------------------------------------------------------------------------- requests

/** A request inside a multipart `$batch` body (changesets included). */
export interface BatchPart {
  method: string;
  url: string;
}

/** Splits a `$batch` request body into its requests (method and URL as written, usually relative to the service root). */
export function parseBatch(body: string): BatchPart[] {
  const out: BatchPart[] = [];
  const re = /^(GET|POST|PATCH|PUT|DELETE|HEAD) (\S+) HTTP\/1\.1\r?$/gm;
  for (let m = re.exec(body); m; m = re.exec(body)) out.push({ method: m[1]!, url: m[2]! });
  return out;
}

const decode = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

/** Splits a string at top-level occurrences of `sep` (not inside parentheses or quotes). */
export function splitTopLevel(s: string, sep: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let quoted = false;
  let cur = '';
  for (const c of s) {
    if (c === "'") quoted = !quoted;
    else if (!quoted && c === '(') depth++;
    else if (!quoted && c === ')') depth--;
    if (!quoted && depth === 0 && c === sep) {
      out.push(cur);
      cur = '';
    } else cur += c;
  }
  if (cur !== '' || out.length) out.push(cur);
  return out;
}

const collapse = (s: string) => s.replace(/\s+/g, ' ').trim();
const selectSet = (s: string) => [...new Set(s.split(',').map((x) => x.trim()).filter(Boolean))].sort().join(',');

/**
 * Canonical `$expand`: navigation properties sorted, nested `$select` sorted as a set, nested options sorted by
 * name, nested `$skip` dropped; e.g. "_B($select=y,x),_A" → "_A,_B($select=x,y)".
 */
export function canonicalExpand(expand: string): string {
  return splitTopLevel(expand, ',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const open = item.indexOf('(');
      if (open < 0) return item;
      const name = item.slice(0, open).trim();
      const inner = item.slice(open + 1, item.lastIndexOf(')'));
      const opts = splitTopLevel(inner, ';')
        .map((o) => {
          const eq = o.indexOf('=');
          const key = o.slice(0, eq).trim();
          const value = o.slice(eq + 1);
          if (key === '$select') return `$select=${selectSet(value)}`;
          if (key === '$expand') return `$expand=${canonicalExpand(value)}`;
          if (key === '$skip') return '';
          return `${key}=${collapse(value)}`;
        })
        .filter(Boolean)
        .sort();
      return opts.length ? `${name}(${opts.join(';')})` : name;
    })
    .sort()
    .join(',');
}

/**
 * Normalizes one OData data request. `url` may be absolute, server-relative ("/odata/x/Set?…") or relative to
 * the service root (inside a batch; then pass `service`). Returns undefined for requests that are not compared:
 * `$metadata`, the service document, `$batch` itself, annotation and i18n files.
 */
export function normalizeRequest(url: string, service?: string): NormalizedRequest | undefined {
  let path = url.replace(/^https?:\/\/[^/]+/, '');
  let root = service;
  if (path.startsWith('/')) {
    const m = /^(\/odata\/[^/?]+\/)(.*)$/.exec(path);
    if (!m) return undefined;
    root = m[1]!;
    path = m[2]!;
  }
  if (!root) return undefined;
  const q = path.indexOf('?');
  const resource = decode(q < 0 ? path : path.slice(0, q));
  if (!resource || /^\$(metadata|batch)\b/.test(resource) || /\.(xml|properties|json)$/.test(resource)) return undefined;
  const options: Partial<Record<ComparedOption, string>> = {};
  for (const pair of (q < 0 ? '' : path.slice(q + 1)).split('&').filter(Boolean)) {
    const eq = pair.indexOf('=');
    const key = decode(eq < 0 ? pair : pair.slice(0, eq));
    const value = decode(eq < 0 ? '' : pair.slice(eq + 1));
    if (!(COMPARED_OPTIONS as readonly string[]).includes(key)) continue; // $skip, sap-*, $format, …
    const k = key as ComparedOption;
    options[k] = k === '$select' ? selectSet(value) : k === '$expand' ? canonicalExpand(value) : collapse(value);
  }
  return { service: root, resource, options };
}

const setDiff = (a: string, b: string) => {
  const A = new Set(a.split(',').filter(Boolean));
  const B = new Set(b.split(',').filter(Boolean));
  return { onlyFe: [...A].filter((x) => !B.has(x)), onlySk: [...B].filter((x) => !A.has(x)) };
};

const describe = (r: NormalizedRequest) =>
  `${r.resource}${Object.keys(r.options).length ? `?${Object.entries(r.options).map(([k, v]) => `${k}=${v}`).join('&')}` : ''}`;

/** Number of compared options with the same value; used to pair the requests of one resource. */
const similarity = (a: NormalizedRequest, b: NormalizedRequest) =>
  COMPARED_OPTIONS.filter((k) => a.options[k] === b.options[k]).length + (a.options.$apply === undefined && b.options.$apply === undefined ? 1 : 0);

/**
 * Request diff (AL-10): requests are paired per service and resource (best match first); options of a pair are
 * compared one by one (`$select` as a set), unpaired requests become `request:<resource>`.
 */
export function diffRequests(fe: NormalizedRequest[], sk: NormalizedRequest[]): Diff[] {
  const out: Diff[] = [];
  const restSk = [...sk];
  const pairs: [NormalizedRequest, NormalizedRequest][] = [];
  const restFe: NormalizedRequest[] = [];
  for (const f of fe) {
    let best = -1;
    let score = -1;
    restSk.forEach((s, i) => {
      if (s.service !== f.service || s.resource !== f.resource) return;
      const v = similarity(f, s);
      if (v > score) {
        score = v;
        best = i;
      }
    });
    if (best < 0) restFe.push(f);
    else pairs.push([f, restSk.splice(best, 1)[0]!]);
  }
  for (const [f, s] of pairs) {
    for (const k of COMPARED_OPTIONS) {
      const a = f.options[k];
      const b = s.options[k];
      if (a === b) continue;
      if (k === '$select' && a !== undefined && b !== undefined) {
        const d = setDiff(a, b);
        out.push({ kind: 'request', member: k, detail: `${f.resource}: $select only in FE: [${d.onlyFe.join(', ')}]; only in smart-kit: [${d.onlySk.join(', ')}]`, fe: a, sk: b });
      } else {
        out.push({ kind: 'request', member: k, detail: `${f.resource}: ${k} FE=${a ?? '(none)'} smart-kit=${b ?? '(none)'}`, fe: a, sk: b });
      }
    }
  }
  for (const f of restFe) out.push({ kind: 'request', member: `request:${f.resource}`, detail: `request only in FE: ${describe(f)}`, fe: describe(f) });
  for (const s of restSk) out.push({ kind: 'request', member: `request:${s.resource}`, detail: `request only in smart-kit: ${describe(s)}`, sk: describe(s) });
  return out;
}

// ---------------------------------------------------------------------------------------------- structure, text

/** Differences of two ordered lists: missing / extra items, else the order. */
function listDiff(fe: string[], sk: string[]): string | undefined {
  if (fe.length === sk.length && fe.every((x, i) => x === sk[i])) return undefined;
  const onlyFe = fe.filter((x) => !sk.includes(x));
  const onlySk = sk.filter((x) => !fe.includes(x));
  const parts: string[] = [];
  if (onlyFe.length) parts.push(`only in FE: [${onlyFe.join(', ')}]`);
  if (onlySk.length) parts.push(`only in smart-kit: [${onlySk.join(', ')}]`);
  const common = fe.filter((x) => sk.includes(x));
  const commonSk = sk.filter((x) => fe.includes(x));
  if (common.join('\u0000') !== commonSk.join('\u0000')) parts.push(`order FE: [${common.join(', ')}] smart-kit: [${commonSk.join(', ')}]`);
  return parts.join('; ') || `FE: [${fe.join(', ')}] smart-kit: [${sk.join(', ')}]`;
}

export function diffStructure(fe: Structure, sk: Structure): Diff[] {
  const out: Diff[] = [];
  for (const k of ['filterFields', 'columns', 'actions', 'editingStatus', 'viewTabs'] as const) {
    const d = listDiff(fe[k], sk[k]);
    if (d) out.push({ kind: 'structure', member: k, detail: d, fe: fe[k], sk: sk[k] });
  }
  if (fe.chartType !== sk.chartType) out.push({ kind: 'structure', member: 'chartType', detail: `FE=${fe.chartType || '(none)'} smart-kit=${sk.chartType || '(none)'}`, fe: fe.chartType, sk: sk.chartType });
  return out;
}

/** Normalizes cell text: whitespace collapsed, trimmed. */
export const normalizeText = (s: string) => collapse(s.replace(/\u00a0|\u202f/g, ' '));

/** Text diff (AL-12): for each column present in both UIs, the cell texts of the first rows. */
export function diffText(fe: TextRows, sk: TextRows): Diff[] {
  const out: Diff[] = [];
  const headers = Object.keys(fe[0] ?? {}).filter((h) => h in (sk[0] ?? {}));
  if (fe.length !== sk.length) out.push({ kind: 'text', member: 'rows', detail: `row count FE=${fe.length} smart-kit=${sk.length}`, fe: fe.length, sk: sk.length });
  for (const h of headers) {
    const rows: string[] = [];
    for (let i = 0; i < Math.min(fe.length, sk.length); i++) {
      const a = normalizeText(fe[i]![h] ?? '');
      const b = normalizeText(sk[i]![h] ?? '');
      if (a !== b) rows.push(`row ${i + 1}: FE "${a}" smart-kit "${b}"`);
    }
    if (rows.length) out.push({ kind: 'text', member: h, detail: rows.join('; '), fe: fe.map((r) => r[h]), sk: sk.map((r) => r[h]) });
  }
  return out;
}

export function diffSnapshots(fe: Snapshot, sk: Snapshot): Diff[] {
  return [...diffRequests(fe.requests, sk.requests), ...diffStructure(fe.structure, sk.structure), ...diffText(fe.text, sk.text)];
}

// ---------------------------------------------------------------------------------------------- register

export const moduleOf = (scenario: string) => `fe:${scenario}`;

/** fe-behavior entries of a register file's content (`{ "deviations": [...] }`); anything else is ignored. */
/** The `fe:` entries of the register: fe-behavior, and long-term ones (kit-extension, different-value) that the comparison also shows. */
export function feDeviations(register: unknown): FeDeviation[] {
  const list = (register as { deviations?: unknown } | undefined)?.deviations;
  if (!Array.isArray(list)) return [];
  return list.filter((d): d is FeDeviation => Boolean(d) && typeof d === 'object' && typeof (d as FeDeviation).category === 'string' && typeof (d as FeDeviation).module === 'string' && (d as FeDeviation).module.startsWith('fe:'));
}

export interface Checked {
  registered: { diff: Diff; deviation: FeDeviation }[];
  unregistered: Diff[];
  /** Register entries of this scenario that no longer match a difference (can be removed). */
  unused: FeDeviation[];
}

/**
 * A difference passes only when an entry with the same module, kind and member is registered. Entries with module
 * `fe:*` apply to every scenario: one entry per known cause (page size, fixed-value preload…) instead of one per
 * scenario, so that the fe-behavior count stays the number of distinct differences (AL-08).
 */
export function checkAgainstRegister(scenario: string, diffs: Diff[], deviations: FeDeviation[]): Checked {
  const own = deviations.filter((d) => d.module === moduleOf(scenario));
  const shared = deviations.filter((d) => d.module === 'fe:*');
  const mine = [...own, ...shared];
  const registered: Checked['registered'] = [];
  const unregistered: Diff[] = [];
  const used = new Set<FeDeviation>();
  for (const diff of diffs) {
    const deviation = mine.find((d) => d.kind === diff.kind && d.member === diff.member);
    if (deviation) {
      registered.push({ diff, deviation });
      used.add(deviation);
    } else unregistered.push(diff);
  }
  return { registered, unregistered, unused: own.filter((d) => !used.has(d)) };
}

/**
 * Plan stage (docs/31) of a baseline difference: 3 = P1 annotation issues of docs/29 §4 (draft list "All",
 * editing status options, aggregation of totals, default searchable), 5 = template settings (page size, toolbar
 * actions, variant management), 4 = other list report annotation issues.
 */
export function stageOf(diff: Diff, scenario: string): number {
  const text = `${diff.member} ${diff.detail}`;
  if (diff.member === 'editingStatus') return 3;
  if (/draft/.test(scenario) && /IsActiveEntity|SiblingEntity|DraftAdministrativeData|HasDraftEntity|HasActiveEntity|Editing Status/.test(text)) return 3;
  if (/aggregate\(|with sum|\$apply/.test(text)) return 3;
  if (diff.member === 'filterFields' && text.includes('[search]')) return 3;
  if (diff.member === '$top' || diff.member === 'actions' || diff.member === 'request:Variants') return 5;
  return 4;
}

/**
 * Known causes of baseline differences (key: "<kind>:<member>"), prefixed to the generated reason; `stage`
 * overrides `stageOf`.
 */
export const BASELINE_NOTES: Record<string, { stage?: number; note: string }> = {
  'text:Order Type': { stage: 5, note: 'demo-specific: the smart-kit demo replaces the Order Type cell (tableExtend "replace", raw code); the FE manifest has no equivalent, FE shows the text arrangement' },
  'structure:actions': { note: 'FE 1.154 shows no Create in the non-draft list report (also not with creationMode NewPage) and keeps the Decide menu enabled without a selection; toolbar order differs' },
  'request:request:Variants': { note: 'smart-kit stores page variants in the service (ODataVariantStore); FE uses the flexibility connector (SessionStorage here)' },
  'request:$top': { note: 'page size: FE GridTable derives it from the visible rows and threshold, smart-kit uses a fixed block size' },
  'request:request:OrderStatuses': { note: 'smart-kit preloads fixed-value lists (ValueListWithFixedValues) for display; FE reads the texts via $expand' },
  'request:request:PurchaseOrderTypes': { note: 'smart-kit preloads fixed-value lists (ValueListWithFixedValues) for display; FE reads the texts via $expand' },
  'request:request:PurchaseOrders': { note: 'smart-kit requests totals of UI.PresentationVariant/Total with "with sum" (docs/29 §4 P1-2); FE GridTable sends no totals request' },
};

/** Baseline register entries for the differences of one scenario: one entry per kind and member. */
export function baselineEntries(scenario: string, diffs: Diff[]): FeDeviation[] {
  const groups = new Map<string, Diff[]>();
  for (const d of diffs) {
    const key = `${d.kind}:${d.member}`;
    groups.set(key, [...(groups.get(key) ?? []), d]);
  }
  return [...groups.entries()].map(([key, ds]) => {
    const note = BASELINE_NOTES[key];
    const details = ds.map((d) => d.detail).join(' | ');
    return {
      module: moduleOf(scenario),
      kind: ds[0]!.kind,
      member: ds[0]!.member,
      category: 'fe-behavior' as const,
      stage: note?.stage ?? Math.min(...ds.map((d) => stageOf(d, scenario))),
      reason: (note ? `${note.note}. Actual: ${details}` : details).slice(0, 700),
      ref: `docs/30 §7.2; reports/fe-compare/${scenario}.md`,
    };
  });
}

/** Replaces the entries of one scenario in a baseline file's content. */
export function mergeBaseline(existing: unknown, scenario: string, entries: FeDeviation[]): { deviations: FeDeviation[] } {
  const others = feDeviations(existing).filter((d) => d.module !== moduleOf(scenario));
  return { deviations: [...others, ...entries].sort((a, b) => a.module.localeCompare(b.module) || a.kind.localeCompare(b.kind) || a.member.localeCompare(b.member)) };
}

// ---------------------------------------------------------------------------------------------- report

const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');

export function toMarkdown(scenario: string, fe: Snapshot, sk: Snapshot, checked: Checked): string {
  const lines = [`# FE comparison: ${scenario}`, '', `Unregistered differences: ${checked.unregistered.length}; registered: ${checked.registered.length}; unused register entries: ${checked.unused.length}.`, ''];
  lines.push('| status | kind | member | detail | register |', '| --- | --- | --- | --- | --- |');
  for (const d of checked.unregistered) lines.push(`| **unregistered** | ${d.kind} | ${cell(d.member)} | ${cell(d.detail)} | |`);
  for (const { diff: d, deviation } of checked.registered) lines.push(`| registered | ${d.kind} | ${cell(d.member)} | ${cell(d.detail)} | ${cell(`${deviation.id ?? ''} stage ${deviation.stage}`)} |`);
  for (const d of checked.unused) lines.push(`| unused entry | ${d.kind} | ${cell(d.member)} | ${cell(d.reason)} | ${cell(d.id ?? '')} |`);
  lines.push('', '## Requests', '', '### FE', '');
  for (const r of fe.requests) lines.push(`- \`${r.service}${describe(r)}\``);
  lines.push('', '### smart-kit', '');
  for (const r of sk.requests) lines.push(`- \`${r.service}${describe(r)}\``);
  lines.push('', '## Structure', '', '| aspect | FE | smart-kit |', '| --- | --- | --- |');
  for (const k of Object.keys(fe.structure) as (keyof Structure)[]) {
    const show = (v: Structure[keyof Structure]) => cell(Array.isArray(v) ? v.join(' · ') : v);
    lines.push(`| ${k} | ${show(fe.structure[k])} | ${show(sk.structure[k])} |`);
  }
  lines.push('');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------------------------- self-test (AL-21)

/**
 * Removes the `UI.DataField` with `Value Path="<path>"` from the unqualified `UI.LineItem` of `entityType` in a
 * `$metadata` document (the self-test: smart-kit then misses one column). Returns the input unchanged when not found.
 */
export function removeLineItemDataField(xml: string, entityType: string, path: string): string {
  const target = xml.indexOf(`<Annotations Target="${entityType}">`);
  if (target < 0) return xml;
  const start = xml.indexOf('<Annotation Term="UI.LineItem">', target);
  const end = start < 0 ? -1 : xml.indexOf('</Annotation>\n', xml.indexOf('</Collection>', start));
  if (start < 0 || end < 0) return xml;
  const block = xml.slice(start, end);
  const re = new RegExp(`<Record Type="UI\\.DataField">(?:(?!<Record)[\\s\\S])*?<PropertyValue Property="Value" Path="${path}"\\/>(?:(?!<Record)[\\s\\S])*?<\\/Record>\\s*`);
  return xml.slice(0, start) + block.replace(re, '') + xml.slice(end);
}
