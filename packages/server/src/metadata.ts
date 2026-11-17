// $metadata: the generated CSDL (entity types and container, written by `smart-kit generate`) plus hand-written
// annotation files, merged into one document per language.
//  - References of the annotation files are added (one per vocabulary namespace).
//  - Their <Annotations> blocks go into the schema of the generated file. An annotation in a hand-written file
//    replaces the generated one with the same target, term and qualifier (e.g. Common.Label from a column comment).
//  - "{{label:<key>}}" placeholders are replaced from per-language label bundles (like i18n files).
import { js2xml, xml2js, type Element } from 'xml-js';

export interface MetadataSource {
  /** The generated CSDL XML (entity types, entity container). */
  csdl: string;
  /** Hand-written annotation files (CSDL XML documents with <Annotations>), in increasing precedence. */
  annotations?: string[];
  /** Label bundles per language ("en", "zh", …) for "{{label:<key>}}" placeholders. */
  labels?: Record<string, Record<string, string>>;
  /** Language used when Accept-Language matches no bundle (default: the first bundle). */
  defaultLanguage?: string;
}

const PLACEHOLDER = /\{\{label:([A-Za-z0-9_.]+)\}\}/g;
const local = (name = '') => name.slice(name.indexOf(':') + 1);
const kids = (el: Element, name?: string) => (el.elements ?? []).filter((e) => e.type === 'element' && (!name || local(e.name) === name));

function parseXml(xml: string, what: string): Element {
  try {
    return xml2js(xml, { compact: false, trim: true, ignoreComment: true }) as Element;
  } catch (e) {
    throw new Error(`[smart-kit-server] ${what} is not well-formed XML: ${(e as Error).message}`, { cause: e });
  }
}

function schemaOf(doc: Element, what: string): { edmx: Element; schema: Element } {
  const edmx = kids(doc, 'Edmx')[0];
  const ds = edmx && kids(edmx, 'DataServices')[0];
  const schema = ds && kids(ds, 'Schema')[0];
  if (!edmx || !schema) throw new Error(`[smart-kit-server] ${what}: expected edmx:Edmx / edmx:DataServices / Schema`);
  return { edmx, schema };
}

/** Namespace aliases declared by the references and schemas of a document. */
function aliases(edmx: Element): Record<string, string> {
  const out: Record<string, string> = {};
  for (const ref of kids(edmx, 'Reference')) for (const inc of kids(ref, 'Include')) if (inc.attributes?.Alias) out[String(inc.attributes.Alias)] = String(inc.attributes.Namespace);
  const ds = kids(edmx, 'DataServices')[0];
  for (const s of ds ? kids(ds, 'Schema') : []) if (s.attributes?.Alias) out[String(s.attributes.Alias)] = String(s.attributes.Namespace);
  return out;
}

/** Key of an annotation for "replaced by a later file": target + full term name + qualifier. */
function annotationKey(target: string, ann: Element, alias: Record<string, string>) {
  const term = String(ann.attributes?.Term ?? '');
  const dot = term.lastIndexOf('.');
  const full = dot > 0 && alias[term.slice(0, dot)] ? `${alias[term.slice(0, dot)]}${term.slice(dot)}` : term;
  return `${target}|${full}|${ann.attributes?.Qualifier ?? ''}`;
}

/** Merges the generated CSDL and the annotation files into one CSDL XML document (placeholders kept). */
export function mergeMetadata(source: Pick<MetadataSource, 'csdl' | 'annotations'>): string {
  const doc = parseXml(source.csdl, 'generated CSDL');
  const { edmx, schema } = schemaOf(doc, 'generated CSDL');
  const baseAlias = aliases(edmx);
  const files = (source.annotations ?? []).map((xml, i) => {
    const d = parseXml(xml, `annotation file #${i + 1}`);
    return { ...schemaOf(d, `annotation file #${i + 1}`), alias: {} as Record<string, string> };
  });

  // References: one per namespace; an alias must mean the same namespace everywhere.
  const refs = kids(edmx, 'Reference');
  const known = new Map<string, string>(); // namespace -> alias
  for (const r of refs) for (const inc of kids(r, 'Include')) known.set(String(inc.attributes?.Namespace), String(inc.attributes?.Alias ?? ''));
  const ds = kids(edmx, 'DataServices')[0]!;
  for (const f of files) {
    f.alias = { ...baseAlias, ...aliases(f.edmx) };
    for (const r of kids(f.edmx, 'Reference')) {
      for (const inc of kids(r, 'Include')) {
        const ns = String(inc.attributes?.Namespace);
        const al = String(inc.attributes?.Alias ?? '');
        if (known.has(ns)) {
          if (known.get(ns) !== al) throw new Error(`[smart-kit-server] vocabulary ${ns} has alias "${known.get(ns)}" in one file and "${al}" in another`);
          continue;
        }
        if (al && baseAlias[al] && baseAlias[al] !== ns) throw new Error(`[smart-kit-server] alias "${al}" means ${baseAlias[al]} in the generated CSDL and ${ns} in an annotation file`);
        known.set(ns, al);
        edmx.elements!.splice(edmx.elements!.indexOf(ds), 0, { type: 'element', name: 'edmx:Reference', attributes: { ...r.attributes }, elements: [inc] });
      }
    }
  }

  // Annotations: later files replace earlier ones (target + term + qualifier).
  const blocks: { target: string; ann: Element; alias: Record<string, string> }[] = [];
  const collect = (s: Element, alias: Record<string, string>) => {
    for (const block of kids(s, 'Annotations')) for (const ann of kids(block, 'Annotation')) blocks.push({ target: String(block.attributes?.Target), ann, alias });
  };
  collect(schema, baseAlias);
  for (const f of files) collect(f.schema, f.alias);
  const winner = new Map<string, number>();
  blocks.forEach((b, i) => winner.set(annotationKey(b.target, b.ann, b.alias), i));
  const byTarget = new Map<string, Element[]>();
  blocks.forEach((b, i) => {
    if (winner.get(annotationKey(b.target, b.ann, b.alias)) !== i) return;
    let list = byTarget.get(b.target);
    if (!list) byTarget.set(b.target, (list = []));
    list.push(b.ann);
  });
  // Operations (actions, functions) may be declared in a hand-written file: the database knows nothing about them.
  const operations = files.flatMap((f) => kids(f.schema).filter((e) => ['Action', 'Function'].includes(local(e.name))));
  schema.elements = [
    ...kids(schema).filter((e) => local(e.name) !== 'Annotations'),
    ...operations,
    ...[...byTarget].map(([target, elements]): Element => ({ type: 'element', name: 'Annotations', attributes: { Target: target }, elements })),
  ];
  return `<?xml version="1.0" encoding="utf-8"?>\n${js2xml({ elements: doc.elements!.filter((e) => e.type === 'element') }, { spaces: 0 })}`;
}

const escapeXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

/** Replaces "{{label:<key>}}" placeholders; throws when a bundle misses a key. */
export function applyLabels(xml: string, labels: Record<string, string>, lang: string): string {
  const missing = new Set<string>();
  const out = xml.replace(PLACEHOLDER, (m, key: string) => {
    if (key in labels) return escapeXml(labels[key]!);
    missing.add(key);
    return m;
  });
  if (missing.size) throw new Error(`[smart-kit-server] labels for "${lang}" miss the keys: ${[...missing].sort().join(', ')}`);
  return out;
}

/** The $metadata documents of a service, one per language. */
/** Bound actions of a CSDL document: qualified name -> qualified binding type. */
export function boundActions(xml: string): Map<string, string> {
  const doc = parseXml(xml, '$metadata');
  const { edmx, schema } = schemaOf(doc, '$metadata');
  const ns = String(schema.attributes?.Namespace);
  const alias = aliases(edmx);
  const qualify = (t: string) => {
    const dot = t.lastIndexOf('.');
    return dot > 0 && alias[t.slice(0, dot)] ? `${alias[t.slice(0, dot)]}${t.slice(dot)}` : t;
  };
  const out = new Map<string, string>();
  for (const a of kids(schema, 'Action')) {
    if (String(a.attributes?.IsBound) !== 'true') continue;
    const first = kids(a, 'Parameter')[0];
    if (first) out.set(`${ns}.${a.attributes?.Name}`, qualify(String(first.attributes?.Type)));
  }
  return out;
}

export class MetadataDocuments {
  readonly merged: string;
  private readonly byLang = new Map<string, string>();
  readonly languages: string[];
  private readonly fallback: string;

  constructor(source: MetadataSource) {
    this.merged = mergeMetadata(source);
    this.languages = Object.keys(source.labels ?? {});
    for (const lang of this.languages) this.byLang.set(lang, applyLabels(this.merged, source.labels![lang]!, lang));
    if (!this.languages.length) {
      const left = [...this.merged.matchAll(PLACEHOLDER)].map((m) => m[1]);
      if (left.length) throw new Error(`[smart-kit-server] $metadata has label placeholders but no label bundles: ${[...new Set(left)].slice(0, 5).join(', ')}`);
    }
    this.fallback = source.defaultLanguage ?? this.languages[0] ?? '';
  }

  /** The language of a request: the first Accept-Language entry that has a bundle. */
  language(acceptLanguage: string | null): string {
    for (const part of (acceptLanguage ?? '').split(',')) {
      const tag = part.split(';')[0]!.trim().toLowerCase();
      if (!tag) continue;
      if (this.byLang.has(tag)) return tag;
      const primary = tag.split('-')[0]!;
      if (this.byLang.has(primary)) return primary;
    }
    return this.fallback;
  }

  /** The document for a language (the first bundle's when it has none). */
  xml(lang: string): string {
    return this.byLang.get(lang) ?? this.byLang.get(this.fallback) ?? this.merged;
  }

  /** A document to build the model from: labels of the default language. */
  modelXml(): string {
    return this.xml(this.fallback);
  }
}
