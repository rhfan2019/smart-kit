/** Entity paths: OData resource paths such as `PurchaseOrders('1')/_Item(PurchaseOrder='1',PurchaseOrderItem=10)`. */
import type { EntityTypeModel, MetaModel } from '../model/types';
import { encodeKeyLiteral } from './literals';

export type EntityPath = string;

export interface PathSegment {
  name: string;
  /** Raw key values (strings unquoted, numbers as strings). Undefined for a segment without key predicate. */
  key?: Record<string, string>;
}

export class EntityPathError extends Error {
  override name = 'EntityPathError';
}

/** Builds the key predicate "(…)" for a row. */
export function keyPredicate(type: EntityTypeModel, row: Record<string, unknown>): string {
  const keys = type.keys;
  const lit = (k: string) => {
    const v = row[k];
    if (v === undefined || v === null) throw new EntityPathError(`Key property ${k} of ${type.name} is missing`);
    return encodeKeyLiteral(v, type.properties[k]!.edmType);
  };
  if (keys.length === 1) return `(${lit(keys[0]!)})`;
  return `(${keys.map((k) => `${k}=${lit(k)}`).join(',')})`;
}

function unquote(raw: string): string {
  const s = decodeURIComponent(raw.trim());
  return s.startsWith("'") && s.endsWith("'") ? s.slice(1, -1).replace(/''/g, "'") : s;
}

function splitTopLevel(s: string, sep: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let quote = false;
  let cur = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]!;
    if (ch === "'") {
      if (quote && s[i + 1] === "'") { cur += "''"; i++; continue; }
      quote = !quote;
    } else if (!quote && ch === '(') depth++;
    else if (!quote && ch === ')') depth--;
    if (!quote && depth === 0 && ch === sep) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur);
  return out;
}

export function parseEntityPath(path: EntityPath): PathSegment[] {
  return splitTopLevel(path.replace(/^\//, ''), '/').filter(Boolean).map((seg) => {
    const open = seg.indexOf('(');
    if (open < 0) return { name: seg };
    if (!seg.endsWith(')')) throw new EntityPathError(`Invalid segment "${seg}"`);
    const name = seg.slice(0, open);
    const inner = seg.slice(open + 1, -1);
    const parts = splitTopLevel(inner, ',');
    const key: Record<string, string> = {};
    if (parts.length === 1 && !/^[A-Za-z_][\w]*=/.test(parts[0]!)) key[''] = unquote(parts[0]!);
    else for (const p of parts) {
      const eq = p.indexOf('=');
      key[p.slice(0, eq).trim()] = unquote(p.slice(eq + 1));
    }
    return { name, key };
  });
}

export interface ResolvedPath {
  /** Entity set that canonically holds the addressed entity. */
  entitySet: string;
  typeName: string;
  /** Key values of the addressed entity, by key property name. */
  key: Record<string, string>;
  /** Canonical URL path relative to the service root, e.g. `PurchaseOrderItems(PurchaseOrder='1',PurchaseOrderItem=10)`. */
  canonical: string;
  /** Entity paths of every level, from the root down to this entity (for breadcrumbs). */
  levels: { path: EntityPath; entitySet: string; typeName: string; key: Record<string, string> }[];
}

/** Resolves an entity path against the model, following navigation property bindings. */
export function resolveEntityPath(model: MetaModel, path: EntityPath): ResolvedPath {
  const segments = parseEntityPath(path);
  if (!segments.length) throw new EntityPathError('Empty entity path');
  let entitySet = segments[0]!.name;
  let set = model.entitySets[entitySet];
  if (!set) throw new EntityPathError(`Unknown entity set "${entitySet}"`);
  let typeName = set.typeName;
  const levels: ResolvedPath['levels'] = [];
  let prefix = '';
  segments.forEach((seg, i) => {
    if (i > 0) {
      const target = set!.navigationBindings[seg.name];
      const nav = model.entityTypes[typeName]?.navigations[seg.name];
      if (!target || !nav) throw new EntityPathError(`Cannot follow "${seg.name}" from ${entitySet}`);
      entitySet = target;
      set = model.entitySets[target]!;
      typeName = nav.targetType;
    }
    const raw = segments[i]!;
    prefix = prefix ? `${prefix}/${raw.name}` : raw.name;
    if (!raw.key) return;
    const type = model.entityTypes[typeName]!;
    const key: Record<string, string> = {};
    if ('' in raw.key) key[type.keys[0]!] = raw.key['']!;
    else Object.assign(key, raw.key);
    prefix = `${prefix}${keyPredicate(type, key)}`;
    levels.push({ path: prefix, entitySet, typeName, key });
  });
  const last = levels[levels.length - 1];
  if (!last || last.typeName !== typeName) throw new EntityPathError(`Entity path "${path}" does not address a single entity`);
  const type = model.entityTypes[typeName]!;
  return { entitySet, typeName, key: last.key, canonical: `${entitySet}${keyPredicate(type, last.key)}`, levels };
}

/** Path of a row of `entitySet`. */
export function entityPathOf(model: MetaModel, entitySet: string, row: Record<string, unknown>): EntityPath {
  const set = model.entitySets[entitySet];
  if (!set) throw new EntityPathError(`Unknown entity set "${entitySet}"`);
  return `${entitySet}${keyPredicate(model.entityTypes[set.typeName]!, row)}`;
}

/** Path of a child row reached through `navigation` from `parent`. */
export function childPathOf(model: MetaModel, parent: EntityPath, navigation: string, row: Record<string, unknown>): EntityPath {
  const resolved = resolveEntityPath(model, parent);
  const nav = model.entityTypes[resolved.typeName]?.navigations[navigation];
  if (!nav) throw new EntityPathError(`Unknown navigation "${navigation}"`);
  return `${parent}/${navigation}${keyPredicate(model.entityTypes[nav.targetType]!, row)}`;
}
