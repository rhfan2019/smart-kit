// URL -> AST: resource path, key predicates and system query options.
import { badRequest, notImplemented } from '../errors';
import type { ApplyStep, ExpandItem, OrderByItem, QueryOptions } from './ast';
import { parseAggregate, parseFilter, parseGroupBy } from './filter';
import { parseSearch } from './search';

/** Splits at `sep` outside parentheses, single-quoted strings and double-quoted phrases. */
export function splitTopLevel(text: string, sep: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let quote: string | undefined;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quote) {
      if (c === quote) {
        if (quote === "'" && text[i + 1] === "'") i++;
        else quote = undefined;
      } else if (quote === '"' && c === '\\') i++;
      continue;
    }
    if (c === "'" || c === '"') quote = c;
    else if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (c === sep && depth === 0) {
      out.push(text.slice(start, i));
      start = i + 1;
    }
  }
  if (quote || depth !== 0) throw badRequest('InvalidSyntax', `Unbalanced quotes or parentheses in "${text}".`);
  out.push(text.slice(start));
  return out;
}

/** Splits "name(inner)" into name and inner; inner is undefined without parentheses. */
function nameAndArgs(text: string): { name: string; inner?: string } {
  const open = text.indexOf('(');
  if (open < 0) return { name: text.trim() };
  if (!text.trimEnd().endsWith(')')) throw badRequest('InvalidSyntax', `Expected ")" at the end of "${text}".`);
  return { name: text.slice(0, open).trim(), inner: text.slice(open + 1, text.trimEnd().length - 1) };
}

const PATH = /^[A-Za-z_][A-Za-z0-9_]*(\/[A-Za-z_][A-Za-z0-9_]*)*$/;

function path(text: string, option: string): string[] {
  const t = text.trim();
  if (!PATH.test(t)) throw badRequest('InvalidSyntax', `${option}: "${t}" is not a property path.`);
  return t.split('/');
}

function nonNegativeInt(text: string, option: string): number {
  if (!/^\d{1,9}$/.test(text.trim())) throw badRequest('InvalidSyntax', `${option} must be a non-negative integer, got "${text}".`);
  return Number(text.trim());
}

function parseOrderBy(text: string, option = '$orderby'): OrderByItem[] {
  return splitTopLevel(text, ',').map((item) => {
    const m = /^\s*(\S+?)(?:\s+(asc|desc))?\s*$/.exec(item);
    if (!m) throw badRequest('InvalidSyntax', `${option}: cannot read "${item}".`);
    return { path: path(m[1]!, option), descending: m[2] === 'desc' };
  });
}

function parseSelect(text: string): string[][] {
  return splitTopLevel(text, ',').flatMap((item) => {
    const t = item.trim();
    if (t === '*') return [];
    return [path(t, '$select')];
  });
}

function parseExpand(text: string): ExpandItem[] {
  return splitTopLevel(text, ',').map((item) => {
    const { name, inner } = nameAndArgs(item.trim());
    if (name === '*' || name.includes('$ref')) throw notImplemented(`$expand=${name} is not supported.`);
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw notImplemented(`$expand of "${name}": only navigation properties of the entity itself are supported.`);
    const options: QueryOptions = {};
    if (inner !== undefined && inner.trim() !== '') {
      for (const part of splitTopLevel(inner, ';')) {
        const eq = part.indexOf('=');
        if (eq < 0) throw badRequest('InvalidSyntax', `$expand=${name}(...): cannot read "${part}".`);
        readOption(options, part.slice(0, eq).trim(), part.slice(eq + 1), `$expand=${name}`);
      }
    }
    return { navigation: name, options };
  });
}

function parseApply(text: string): ApplyStep[] {
  return splitTopLevel(text, '/').map((step) => {
    const { name, inner } = nameAndArgs(step.trim());
    if (inner === undefined) throw badRequest('InvalidApply', `$apply: "${step}" is not a transformation.`);
    switch (name) {
      case 'filter':
        return { kind: 'filter', expr: parseFilter(inner, '$apply filter') };
      case 'search': {
        const expr = parseSearch(inner, '$apply search');
        if (!expr) throw badRequest('InvalidApply', '$apply: search() is empty.');
        return { kind: 'search', expr };
      }
      case 'groupby':
        return { kind: 'groupby', ...parseGroupBy(inner) };
      case 'aggregate':
        return { kind: 'aggregate', aggregates: parseAggregate(inner) };
      default:
        throw notImplemented(`$apply transformation '${name}' is not supported.`);
    }
  });
}

const SUPPORTED_NESTED = new Set(['$select', '$expand', '$filter', '$orderby', '$top', '$skip']);

function readOption(o: QueryOptions, name: string, value: string, scope?: string) {
  if (scope && !SUPPORTED_NESTED.has(name)) throw notImplemented(`${name} inside ${scope} is not supported.`);
  switch (name) {
    case '$select':
      o.select = parseSelect(value);
      break;
    case '$expand':
      o.expand = parseExpand(value);
      break;
    case '$filter':
      o.filter = parseFilter(value);
      break;
    case '$search':
      o.search = parseSearch(value);
      break;
    case '$orderby':
      o.orderBy = parseOrderBy(value);
      break;
    case '$top':
      o.top = nonNegativeInt(value, '$top');
      break;
    case '$skip':
      o.skip = nonNegativeInt(value, '$skip');
      break;
    case '$count':
      if (value !== 'true' && value !== 'false') throw badRequest('InvalidSyntax', `$count must be true or false, got "${value}".`);
      o.count = value === 'true';
      break;
    case '$apply':
      o.apply = parseApply(value);
      break;
    case '$format':
      if (!/^(json|application\/json)/i.test(value)) throw notImplemented(`$format=${value} is not supported; only JSON is.`);
      break;
    default:
      if (name.startsWith('$')) throw notImplemented(`System query option ${name} is not supported.`);
  }
}

/**
 * Reads the system query options of a query string ("a=1&b=2", without "?"). Decoding follows RFC 3986:
 * "+" is a literal plus (not a space), so that time zone offsets in literals survive. Custom options
 * (no "$") are ignored.
 */
export function parseQueryOptions(query: string): QueryOptions {
  const o: QueryOptions = {};
  const seen = new Set<string>();
  for (const pair of query.split('&')) {
    if (!pair) continue;
    const eq = pair.indexOf('=');
    let name: string;
    let value: string;
    try {
      name = decodeURIComponent(eq < 0 ? pair : pair.slice(0, eq));
      value = eq < 0 ? '' : decodeURIComponent(pair.slice(eq + 1));
    } catch {
      throw badRequest('InvalidSyntax', `Query option "${pair}" is not correctly percent-encoded.`);
    }
    if (!name.startsWith('$')) continue;
    if (seen.has(name)) throw badRequest('InvalidSyntax', `System query option ${name} appears more than once.`);
    seen.add(name);
    readOption(o, name, value);
  }
  return o;
}

/** One segment of a resource path: an entity set or navigation property, optionally with a key predicate. */
export interface PathSegment {
  name: string;
  /** Raw key values: one unnamed value, or named values. Typed by the query plan. */
  key?: { name?: string; value: string }[];
}

/** Parses a resource path below the service root ("PurchaseOrders('1')/_Item", "$count" allowed last). */
export function parseResourcePath(rawSegments: string[]): { segments: PathSegment[]; count: boolean } {
  const segments: PathSegment[] = [];
  let count = false;
  for (const [i, raw] of rawSegments.entries()) {
    let seg: string;
    try {
      seg = decodeURIComponent(raw);
    } catch {
      throw badRequest('InvalidSyntax', `Path segment "${raw}" is not correctly percent-encoded.`);
    }
    if (seg === '$count' && i === rawSegments.length - 1 && i > 0) {
      count = true;
      continue;
    }
    const { name, inner } = nameAndArgs(seg);
    if (!/^[A-Za-z_][A-Za-z0-9_.]*$/.test(name)) throw notImplemented(`Path segment "${seg}" is not supported.`);
    if (inner === undefined) {
      segments.push({ name });
      continue;
    }
    const parts = splitTopLevel(inner, ',');
    const key = parts.map((p) => {
      const eq = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/s.exec(p);
      if (eq && !p.trimStart().startsWith("'")) return { name: eq[1], value: eq[2]!.trim() };
      if (parts.length > 1) throw badRequest('InvalidKey', `Key predicate of "${name}": name every key property in a composite key.`);
      return { value: p.trim() };
    });
    segments.push({ name, key });
  }
  return { segments, count };
}
