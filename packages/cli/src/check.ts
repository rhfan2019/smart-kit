// After a regeneration: do the hand-written annotations still point at existing types, properties, navigation
// properties and entity sets? Checks every <Annotations Target>, and the paths inside the annotations
// (Path, PropertyPath, NavigationPropertyPath, AnnotationPath, ValueList CollectionPath and ValueListProperty).
// Also: do the navigations declared in smart-kit.config.json (views) point at existing entities and columns?
import { xml2js, type Element } from 'xml-js';
import { isDeclaredNavigation, type CliConfig } from './config';

interface TypeInfo {
  properties: Set<string>;
  navigations: Map<string, string>; // name -> target type (qualified)
}

export interface CsdlIndex {
  namespace: string;
  alias?: string;
  container: string;
  types: Map<string, TypeInfo>; // qualified name -> info
  sets: Map<string, string>; // set name -> qualified type
  operations: Set<string>; // qualified action / function names
}

export interface CheckProblem {
  file: string;
  target: string;
  message: string;
}

const local = (name = '') => name.slice(name.indexOf(':') + 1);
const kids = (el: Element, name?: string) => (el.elements ?? []).filter((e) => e.type === 'element' && (!name || local(e.name) === name));
const attr = (el: Element, name: string) => (el.attributes?.[name] === undefined ? undefined : String(el.attributes[name]));

function schemas(xml: string): Element[] {
  const doc = xml2js(xml, { compact: false, ignoreComment: true }) as Element;
  const edmx = kids(doc, 'Edmx')[0];
  const ds = edmx && kids(edmx, 'DataServices')[0];
  return ds ? kids(ds, 'Schema') : [];
}

/** Indexes the types, sets and operations of a CSDL document (the generated one). */
export function indexCsdl(xml: string): CsdlIndex {
  const schema = schemas(xml)[0];
  if (!schema) throw new Error('The CSDL file has no Schema.');
  const ns = attr(schema, 'Namespace')!;
  const types = new Map<string, TypeInfo>();
  const operations = new Set<string>();
  for (const el of kids(schema)) {
    const kind = local(el.name);
    if (kind === 'EntityType' || kind === 'ComplexType') {
      const navigations = new Map<string, string>();
      for (const n of kids(el, 'NavigationProperty')) navigations.set(attr(n, 'Name')!, attr(n, 'Type')!.replace(/^Collection\((.*)\)$/, '$1'));
      types.set(`${ns}.${attr(el, 'Name')}`, { properties: new Set(kids(el, 'Property').map((p) => attr(p, 'Name')!)), navigations });
    } else if (kind === 'Action' || kind === 'Function') operations.add(`${ns}.${attr(el, 'Name')}`);
  }
  const container = kids(schema, 'EntityContainer')[0];
  const sets = new Map<string, string>();
  for (const s of container ? kids(container, 'EntitySet') : []) sets.set(attr(s, 'Name')!, attr(s, 'EntityType')!);
  return { namespace: ns, alias: attr(schema, 'Alias'), container: container ? `${ns}.${attr(container, 'Name')}` : '', types, sets, operations };
}

/** Checks the annotation files against the CSDL index. */
export function checkAnnotations(index: CsdlIndex, files: { name: string; xml: string }[]): CheckProblem[] {
  const problems: CheckProblem[] = [];
  // Actions and functions may be declared in the hand-written files themselves (the database knows none).
  index = { ...index, operations: new Set(index.operations) };
  for (const f of files)
    for (const s of schemas(f.xml))
      for (const op of kids(s).filter((e) => ['Action', 'Function'].includes(local(e.name)))) index.operations.add(`${index.namespace}.${attr(op, 'Name')}`);
  const qualify = (name: string) => (index.alias && name.startsWith(`${index.alias}.`) ? `${index.namespace}${name.slice(index.alias.length)}` : name);

  /** Resolves a path relative to a type; returns an error text or undefined. */
  const resolve = (typeName: string, path: string, kind: 'property' | 'navigation' | 'any'): string | undefined => {
    let type = index.types.get(typeName);
    const segs = path.split('/').filter((s) => s && s !== '$count');
    for (const [i, seg] of segs.entries()) {
      if (!type) return undefined;
      if (seg.startsWith('@')) return undefined; // annotation term: not checked here
      if (seg.includes('.')) return undefined; // type cast or bound operation
      const last = i === segs.length - 1;
      if (type.navigations.has(seg)) {
        type = index.types.get(type.navigations.get(seg)!);
        if (last && kind === 'property') return `'${path}' ends at a navigation property, not a property`;
        continue;
      }
      if (type.properties.has(seg) && last) return kind === 'navigation' ? `'${path}' is a property, not a navigation property` : undefined;
      return `'${segs.slice(0, i + 1).join('/')}' does not exist on ${typeName}`;
    }
    return undefined;
  };

  for (const file of files) {
    for (const schema of schemas(file.xml)) {
      for (const block of kids(schema, 'Annotations')) {
        const target = attr(block, 'Target') ?? '';
        const report = (message: string) => problems.push({ file: file.name, target, message });
        // Which type do paths inside this block start from?
        let base: string | undefined;
        const t = qualify(target);
        const [head, ...rest] = t.split('/');
        if (head === index.container || head === qualify(index.container)) {
          if (!rest.length) base = undefined;
          else {
            const setType = index.sets.get(rest[0]!);
            if (!setType) {
              report(`entity set '${rest[0]}' does not exist`);
              continue;
            }
            base = setType;
            if (rest.length > 1) {
              const err = resolve(setType, rest.slice(1).join('/'), 'any');
              if (err) {
                report(err);
                continue;
              }
            }
          }
        } else if (index.types.has(head!)) {
          base = head;
          if (rest.length) {
            const err = resolve(head!, rest.join('/'), 'any');
            if (err) {
              report(err);
              continue;
            }
          }
        } else if (index.operations.has(head!.replace(/\(.*$/, ''))) {
          continue;
        } else {
          report(`'${head}' is neither an entity type, the entity container nor an operation of ${index.namespace}`);
          continue;
        }
        if (!base) continue;
        walk(block, base, (kind, path, el) => {
          if (kind === 'CollectionPath') {
            if (!index.sets.has(path)) report(`ValueList CollectionPath '${path}' is not an entity set`);
            return;
          }
          if (kind === 'ValueListProperty') {
            const setType = index.sets.get(path.split('|')[0]!);
            const prop = path.split('|')[1]!;
            if (setType) {
              const err = resolve(setType, prop, 'property');
              if (err) report(`ValueListProperty: ${err}`);
            }
            return;
          }
          const p = kind === 'AnnotationPath' ? path.slice(0, Math.max(0, path.indexOf('@'))).replace(/\/$/, '') : path;
          if (!p) return;
          const err = resolve(base!, p, kind === 'NavigationPropertyPath' ? 'navigation' : kind === 'AnnotationPath' ? 'navigation' : 'any');
          if (err) report(`${kind} ${err}${el ? '' : ''}`);
        });
      }
    }
  }
  return problems;
}

type PathKind = 'Path' | 'PropertyPath' | 'NavigationPropertyPath' | 'AnnotationPath' | 'CollectionPath' | 'ValueListProperty';

/** Visits the path expressions of an annotation block. Paths inside a ValueList record are relative to its collection. */
function walk(el: Element, base: string, visit: (kind: PathKind, path: string, el?: Element) => void, collection?: string) {
  for (const child of kids(el)) {
    const name = local(child.name);
    let coll = collection;
    if (name === 'Record' && /ValueListType$/.test(attr(child, 'Type') ?? '')) {
      const cp = kids(child, 'PropertyValue').find((pv) => attr(pv, 'Property') === 'CollectionPath');
      coll = cp ? attr(cp, 'String') : undefined;
      if (coll) visit('CollectionPath', coll);
    }
    if (name === 'PropertyValue' && attr(child, 'Property') === 'ValueListProperty' && collection) {
      const v = attr(child, 'String') ?? attr(child, 'PropertyPath');
      if (v) visit('ValueListProperty', `${collection}|${v}`);
    } else if (name === 'PropertyValue' && attr(child, 'Property') === 'CollectionPath') {
      // handled with its record
    } else {
      for (const k of ['Path', 'PropertyPath', 'NavigationPropertyPath', 'AnnotationPath'] as const) {
        const v = attr(child, k);
        if (v !== undefined) visit(k, v, child);
      }
      if (['Path', 'PropertyPath', 'NavigationPropertyPath', 'AnnotationPath'].includes(name)) {
        const text = (child.elements ?? []).map((e) => e.text ?? '').join('').trim();
        if (text) visit(name as PathKind, text, child);
      }
    }
    walk(child, base, visit, coll);
  }
}

/** The generated storage mapping (*.storage.json), as far as the check needs it. */
export interface StorageFile {
  entitySets: Record<string, { table: string; columns?: Record<string, string>; navigations?: Record<string, { on: Record<string, string> }> }>;
}

/**
 * Checks the navigations declared in the configuration (`navigations.<name>` with `from`) against the generated
 * CSDL and storage mapping: `from` and `to` are entities, every column of `on` exists, and the navigation
 * properties were generated.
 */
export function checkDeclaredNavigations(config: Pick<CliConfig, 'schema' | 'navigations'>, index: CsdlIndex, storage: StorageFile, file = 'smart-kit.config.json'): CheckProblem[] {
  const problems: CheckProblem[] = [];
  const setOf = (table: string) => Object.entries(storage.entitySets).find(([, s]) => s.table === `${config.schema}.${table}` || s.table === table);
  for (const [key, n] of Object.entries(config.navigations ?? {})) {
    if (!isDeclaredNavigation(n)) continue;
    const target = `navigations.${key}`;
    const report = (message: string) => problems.push({ file, target, message });
    const from = setOf(n.from);
    const to = setOf(n.to);
    if (!from) report(`"from": table or view '${n.from}' is not an entity of the generated service (no such table or view in schema "${config.schema}", left out, or without keys)`);
    if (!to) report(`"to": table or view '${n.to}' is not an entity of the generated service (no such table or view in schema "${config.schema}", left out, or without keys)`);
    if (!from || !to) continue;
    const has = (s: StorageFile['entitySets'][string], name: string) => Object.entries(s.columns ?? {}).some(([p, c]) => c === name || p === name);
    const before = problems.length;
    for (const [a, b] of Object.entries(n.on)) {
      if (!has(from[1], a)) report(`"on": column '${a}' does not exist in '${n.from}'`);
      if (!has(to[1], b)) report(`"on": column '${b}' does not exist in '${n.to}'`);
    }
    if (problems.length > before) continue;
    const name = (n.toMany ?? n.toOne)!;
    const fromType = index.types.get(index.sets.get(from[0]) ?? '');
    const toType = index.types.get(index.sets.get(to[0]) ?? '');
    if (!fromType?.navigations.has(name) || !from[1].navigations?.[name]) report(`navigation property '${name}' of ${from[0]} is not in the generated files (run smart-kit generate)`);
    if (n.partner && (!toType?.navigations.has(n.partner) || !to[1].navigations?.[n.partner])) report(`navigation property '${n.partner}' of ${to[0]} is not in the generated files (run smart-kit generate)`);
  }
  return problems;
}
