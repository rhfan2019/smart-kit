// AST -> query plan. Every property path is resolved against $metadata here (unknown names are a 400, never SQL),
// every literal is checked against the Edm type it is compared with, the Capabilities annotations are enforced,
// and the data scope (permissions) of every entity set the query touches is added (ADR-027).
import type { EdmType } from '@rhfan2019/smart-kit-core';
import { badRequest, notFound, notImplemented } from './errors';
import type { AggregateMethod, ApplyStep, CompareOp, Expr, Literal, OrderByItem, QueryOptions, SearchExpr } from './parser/ast';
import { parseFilter } from './parser/filter';
import type { PathSegment } from './parser/url';
import type { ColumnInfo, EntitySetInfo, NavigationInfo, ServiceSchema } from './schema';

/** A column, reached from the plan's entity set through zero or more single-valued navigations. */
export interface ColumnRef {
  /** Navigation names from the plan's entity set (single-valued only). */
  via: string[];
  column: ColumnInfo;
}

/** A bound (resolved and type-checked) filter expression. */
export type BoundExpr =
  | { kind: 'column'; ref: ColumnRef }
  | { kind: 'value'; value: string | boolean | null; edmType?: EdmType }
  | { kind: 'compare'; op: CompareOp; left: BoundExpr; right: BoundExpr }
  | { kind: 'in'; left: BoundExpr; list: BoundExpr[] }
  | { kind: 'and' | 'or'; left: BoundExpr; right: BoundExpr }
  | { kind: 'not'; operand: BoundExpr }
  | { kind: 'func'; name: 'tolower' | 'toupper' | 'trim' | 'length'; arg: BoundExpr }
  | { kind: 'like'; mode: 'contains' | 'startswith' | 'endswith'; arg: BoundExpr; text: string; caseInsensitive?: boolean }
  | { kind: 'search'; expr: SearchExpr; fields: ColumnRef[] }
  | { kind: 'const'; value: boolean };

/** "This row belongs to the parent addressed by the resource path": PurchaseOrders('1')/_Item. */
export interface ParentLink {
  set: EntitySetInfo;
  key: Record<string, BoundExpr>;
  /** Navigation from the parent to the rows of the plan. */
  navigation: NavigationInfo;
  where: BoundExpr[];
  parent?: ParentLink;
}

export interface ExpandPlan {
  navigation: NavigationInfo;
  plan: CollectionPlan;
}

export interface CollectionPlan {
  set: EntitySetInfo;
  /** Properties written to the response (keys first). */
  select: ColumnInfo[];
  /** Read but not written (the ETag property when not selected). */
  internal: ColumnInfo[];
  expand: ExpandPlan[];
  where: BoundExpr[];
  orderBy: { ref: ColumnRef; descending: boolean }[];
  skip: number;
  /** Rows to return; undefined = all (only for single-valued navigations). */
  top?: number;
  /** More rows than this means a next link (server-side paging). */
  pageSize?: number;
  count: boolean;
  parent?: ParentLink;
}

export interface AggregatePlan {
  set: EntitySetInfo;
  where: BoundExpr[];
  groupBy: { ref: ColumnRef; path: string[] }[];
  aggregates: { ref: ColumnRef; method: AggregateMethod; alias: string; edmType: EdmType }[];
  orderBy: { target: { kind: 'group' | 'aggregate'; index: number }; descending: boolean }[];
  skip: number;
  top?: number;
  parent?: ParentLink;
}

/** Data scope of an entity set for the current request: an OData $filter expression, or nothing (no restriction). */
export type ScopeFunction<C> = (entitySet: string, context: C) => string | undefined;

export interface PlanOptions<C> {
  schema: ServiceSchema;
  maxPageSize: number;
  /** $search: property paths searched per entity set (default: the string properties of the entity type). */
  searchFields?: Record<string, string[]>;
  scope?: ScopeFunction<C>;
  context: C;
}

const NUMERIC = new Set(['Edm.Byte', 'Edm.SByte', 'Edm.Int16', 'Edm.Int32', 'Edm.Int64', 'Edm.Decimal', 'Edm.Double', 'Edm.Single']);
const LITERAL_FOR: Record<string, Literal['type']> = {
  'Edm.String': 'string', 'Edm.Boolean': 'boolean', 'Edm.Date': 'date', 'Edm.DateTimeOffset': 'dateTimeOffset',
  'Edm.TimeOfDay': 'timeOfDay', 'Edm.Guid': 'guid',
};
const expectedLiteral = (t: EdmType): Literal['type'] | undefined => (NUMERIC.has(t) ? 'number' : LITERAL_FOR[t]);

function checkLiteralValue(lit: Literal, where: string) {
  if (lit.type === 'date' && Number.isNaN(Date.parse(`${lit.value}T00:00:00Z`))) throw badRequest('InvalidLiteral', `${where}: ${lit.value} is not a valid date.`);
  if (lit.type === 'dateTimeOffset' && Number.isNaN(Date.parse(lit.value))) throw badRequest('InvalidLiteral', `${where}: ${lit.value} is not a valid date and time.`);
  if (lit.type === 'date' || lit.type === 'dateTimeOffset') {
    const [, mo, d] = /^\d{4}-(\d{2})-(\d{2})/.exec(lit.value)!;
    if (Number(mo) < 1 || Number(mo) > 12 || Number(d) < 1 || Number(d) > 31) throw badRequest('InvalidLiteral', `${where}: ${lit.value} is not a valid date.`);
  }
  if (lit.type === 'timeOfDay') {
    const [h, m, s = '0'] = lit.value.split(':');
    if (Number(h) > 23 || Number(m) > 59 || Number(s) >= 60) throw badRequest('InvalidLiteral', `${where}: ${lit.value} is not a valid time of day.`);
  }
}

/** Checks a literal against the Edm type of the property it is compared with and returns the bound value. */
function typedValue(lit: Literal, type: EdmType | undefined, where: string): BoundExpr {
  if (lit.type === 'null') return { kind: 'value', value: null, edmType: type };
  checkLiteralValue(lit, where);
  if (type) {
    const expected = expectedLiteral(type);
    if (!expected) throw notImplemented(`${where}: comparisons on ${type} properties are not supported.`);
    if (expected !== lit.type) throw badRequest('TypeMismatch', `${where}: a ${type} property cannot be compared with the ${lit.type} literal ${JSON.stringify(lit.value)}.`);
  }
  const edmType = type ?? ({ string: 'Edm.String', number: 'Edm.Decimal', boolean: 'Edm.Boolean', date: 'Edm.Date', dateTimeOffset: 'Edm.DateTimeOffset', timeOfDay: 'Edm.TimeOfDay', guid: 'Edm.Guid' } as const)[lit.type];
  return { kind: 'value', value: lit.value, edmType };
}

/** The data type of a bound expression (undefined for untyped values). */
function typeOf(e: BoundExpr): EdmType | undefined {
  switch (e.kind) {
    case 'column':
      return e.ref.column.edmType;
    case 'value':
      return e.edmType;
    case 'func':
      return e.name === 'length' ? 'Edm.Int32' : 'Edm.String';
    default:
      return 'Edm.Boolean';
  }
}

export class Planner<C> {
  constructor(private readonly o: PlanOptions<C>) {}

  private scopeCache = new Map<string, Expr>();

  get schema() {
    return this.o.schema;
  }

  set(name: string): EntitySetInfo {
    const s = this.o.schema.entitySets[name];
    if (!s) throw notFound(`Entity set '${name}' not found.`);
    return s;
  }

  /** Resolves a property path (through single-valued navigations) to a column. */
  resolve(set: EntitySetInfo, segments: string[], where: string): ColumnRef {
    let cur = set;
    const via: string[] = [];
    for (const [i, seg] of segments.entries()) {
      const last = i === segments.length - 1;
      const col = cur.columns[seg];
      if (col && last) return { via, column: col };
      const nav = cur.navigations[seg];
      if (!nav) throw badRequest('PropertyNotFound', `${where}: '${segments.slice(0, i + 1).join('/')}' is not a property of ${set.name}.`, segments.join('/'));
      if (last) throw badRequest('InvalidPath', `${where}: '${segments.join('/')}' is a navigation property, not a property.`);
      if (nav.collection) throw notImplemented(`${where}: '${segments.slice(0, i + 1).join('/')}' is a collection; any() and all() are not supported.`);
      if (!nav.join) throw notImplemented(`Navigation '${seg}' of ${cur.name} has no referential constraints in $metadata.`);
      via.push(seg);
      cur = this.set(nav.target);
    }
    throw badRequest('InvalidPath', `${where}: empty path.`);
  }

  /** Binds a $filter AST to the entity set. */
  bind(set: EntitySetInfo, e: Expr, where: string): BoundExpr {
    const bindOperand = (x: Expr, other: Expr | undefined): BoundExpr => {
      if (x.kind === 'literal') {
        const otherBound = other && other.kind !== 'literal' ? this.bind(set, other, where) : undefined;
        return typedValue(x, otherBound ? typeOf(otherBound) : undefined, where);
      }
      return this.bind(set, x, where);
    };
    switch (e.kind) {
      case 'literal':
        if (e.type === 'boolean') return { kind: 'const', value: e.value };
        throw badRequest('InvalidFilter', `${where}: the literal ${JSON.stringify(e.value)} is not a condition.`);
      case 'path':
        return { kind: 'column', ref: this.resolve(set, e.segments, where) };
      case 'and':
      case 'or':
        return { kind: e.kind, left: this.condition(set, e.left, where), right: this.condition(set, e.right, where) };
      case 'not':
        return { kind: 'not', operand: this.condition(set, e.operand, where) };
      case 'compare': {
        const left = bindOperand(e.left, e.right);
        const right = bindOperand(e.right, e.left);
        const lt = typeOf(left);
        const rt = typeOf(right);
        const isNull = (b: BoundExpr) => b.kind === 'value' && b.value === null;
        if (lt && rt && !isNull(left) && !isNull(right) && !(NUMERIC.has(lt) && NUMERIC.has(rt)) && lt !== rt)
          throw badRequest('TypeMismatch', `${where}: cannot compare ${lt} with ${rt}.`);
        if ((isNull(left) || isNull(right)) && e.op !== 'eq' && e.op !== 'ne') return { kind: 'const', value: false }; // OData: x gt null is false
        return { kind: 'compare', op: e.op, left, right };
      }
      case 'in': {
        const left = this.bind(set, e.left, where);
        const list = e.list.map((x) => {
          if (x.kind !== 'literal') throw notImplemented(`${where}: only literals are supported in "in (...)".`);
          return typedValue(x, typeOf(left), where);
        });
        return { kind: 'in', left, list };
      }
      case 'call':
        return this.bindCall(set, e, where);
    }
  }

  /** Binds an expression that must be a condition (Edm.Boolean). */
  condition(set: EntitySetInfo, e: Expr, where: string): BoundExpr {
    const b = this.bind(set, e, where);
    if (typeOf(b) !== 'Edm.Boolean') throw badRequest('InvalidFilter', `${where}: expected a condition, got a ${typeOf(b) ?? 'value'}.`);
    return b;
  }

  private bindCall(set: EntitySetInfo, e: Extract<Expr, { kind: 'call' }>, where: string): BoundExpr {
    const stringArg = (x: Expr | undefined) => {
      if (!x) throw badRequest('InvalidFilter', `${where}: ${e.name}() needs more arguments.`);
      const b = this.bind(set, x, where);
      if (typeOf(b) !== 'Edm.String') throw badRequest('TypeMismatch', `${where}: ${e.name}() needs a string argument.`);
      return b;
    };
    switch (e.name) {
      case 'contains':
      case 'startswith':
      case 'endswith': {
        if (e.args.length !== 2) throw badRequest('InvalidFilter', `${where}: ${e.name}() takes two arguments.`);
        const arg = stringArg(e.args[0]);
        const lit = e.args[1]!;
        if (lit.kind !== 'literal' || lit.type !== 'string') throw notImplemented(`${where}: the second argument of ${e.name}() must be a string literal.`);
        return { kind: 'like', mode: e.name, arg, text: lit.value };
      }
      case 'tolower':
      case 'toupper':
      case 'trim':
      case 'length':
        if (e.args.length !== 1) throw badRequest('InvalidFilter', `${where}: ${e.name}() takes one argument.`);
        return { kind: 'func', name: e.name, arg: stringArg(e.args[0]) };
      default:
        throw notImplemented(`${where}: the function ${e.name}() is not supported.`);
    }
  }

  // ---------------------------------------------------------------- capabilities

  private checkFilterCapabilities(set: EntitySetInfo, e: Expr, caps = set.capabilities) {
    if (!caps.filterable) throw badRequest('FilterNotSupported', `Entity set '${set.name}' does not support $filter.`);
    // Per property: comparison operators, string functions, negation, number of conditions.
    const usage = new Map<string, { ops: CompareOp[]; fns: number; negated: boolean; inList: number }>();
    const usageOf = (p: string) => {
      let u = usage.get(p);
      if (!u) usage.set(p, (u = { ops: [], fns: 0, negated: false, inList: 0 }));
      return u;
    };
    const pathOf = (x: Expr): string | undefined => (x.kind === 'path' ? x.segments.join('/') : x.kind === 'call' && x.args[0] ? pathOf(x.args[0]) : undefined);
    const visit = (x: Expr, negated: boolean) => {
      switch (x.kind) {
        case 'path':
          usageOf(x.segments.join('/')).negated ||= negated;
          break;
        case 'and':
        case 'or':
          visit(x.left, negated);
          visit(x.right, negated);
          break;
        case 'not':
          visit(x.operand, !negated);
          break;
        case 'compare': {
          for (const side of [x.left, x.right]) {
            const p = pathOf(side);
            if (p) {
              const u = usageOf(p);
              u.ops.push(x.op);
              u.negated ||= negated;
            }
          }
          break;
        }
        case 'in': {
          const p = pathOf(x.left);
          if (p) {
            const u = usageOf(p);
            u.ops.push(...x.list.map(() => 'eq' as const));
            u.inList += 1;
            u.negated ||= negated;
          }
          break;
        }
        case 'call': {
          const p = pathOf(x);
          if (p) {
            const u = usageOf(p);
            u.fns += 1;
            u.negated ||= negated;
          }
          break;
        }
      }
    };
    visit(e, false);
    for (const [p, u] of usage) {
      if (caps.nonFilterable.includes(p))
        throw badRequest('PropertyNotFilterable', `Property '${p}' of entity set '${set.name}' is not filterable (Capabilities.FilterRestrictions/NonFilterableProperties).`, p);
      const kind = caps.filterExpressions[p];
      if (!kind) continue;
      const bad =
        (kind === 'SingleValue' && (u.ops.some((o) => o !== 'eq') || u.ops.length > 1 || u.fns > 0 || u.negated)) ||
        (kind === 'MultiValue' && (u.ops.some((o) => o !== 'eq') || u.fns > 0 || u.negated)) ||
        (kind === 'SingleRange' && (u.ops.includes('ne') || u.ops.length > 2 || u.fns > 0 || u.negated)) ||
        (kind === 'SearchExpression' && u.ops.length > 0);
      if (bad)
        throw badRequest('FilterExpressionNotAllowed', `Property '${p}' of entity set '${set.name}' allows only ${kind} conditions (Capabilities.FilterRestrictions/FilterExpressionRestrictions).`, p);
    }
  }

  private checkSearch(set: EntitySetInfo, caps = set.capabilities) {
    if (!caps.searchable) throw badRequest('SearchNotSupported', `Entity set '${set.name}' does not support $search (Capabilities.SearchRestrictions/Searchable is not true).`);
  }

  private searchFields(set: EntitySetInfo): ColumnRef[] {
    const paths = this.o.searchFields?.[set.name] ?? Object.values(set.columns).filter((c) => c.edmType === 'Edm.String').map((c) => c.property);
    return paths.map((p) => this.resolve(set, p.split('/'), `search fields of ${set.name}`));
  }

  /** Capabilities that apply to rows reached through `parent`: the target set's, refined by NavigationRestrictions. */
  private capsFor(set: EntitySetInfo, parent?: ParentLink) {
    if (!parent) return set.capabilities;
    const nav = this.o.schema.model.entitySets[parent.set.name]?.navigationCapabilities[parent.navigation.name];
    return nav ? { ...set.capabilities, ...nav } : set.capabilities;
  }

  // ---------------------------------------------------------------- scope (permissions)

  /** The data scope of an entity set for this request, bound to the set. Applied wherever the set is read. */
  scope(set: EntitySetInfo): BoundExpr[] {
    const text = this.o.scope?.(set.name, this.o.context);
    if (text === undefined || text === null || text.trim() === '') return [];
    let ast = this.scopeCache.get(text);
    if (!ast) {
      ast = parseFilter(text, `scope of ${set.name}`);
      this.scopeCache.set(text, ast);
    }
    const bound = this.condition(set, ast, `scope of ${set.name}`);
    if (containsNavigation(bound)) throw new Error(`[smart-kit-server] the scope of ${set.name} may only use the set's own properties: ${text}`);
    return [bound];
  }

  // ---------------------------------------------------------------- resource path

  /** Resolves the resource path to the addressed entity set, whether one entity is addressed, and the parent chain. */
  resolvePath(segments: PathSegment[]): { set: EntitySetInfo; single: boolean; key?: Record<string, BoundExpr>; parent?: ParentLink } {
    const first = segments[0]!;
    let set = this.set(first.name);
    let key = first.key ? this.bindKey(set, first.key) : undefined;
    let single = !!first.key;
    let parent: ParentLink | undefined;
    for (const seg of segments.slice(1)) {
      if (!single) throw badRequest('InvalidPath', `'${seg.name}' can only follow a single entity.`);
      const nav = set.navigations[seg.name];
      if (!nav) {
        if (seg.name.includes('.')) throw notImplemented(`Operations ('${seg.name}') are not supported by this read-only service.`);
        throw notFound(`'${seg.name}' is not a navigation property of ${set.name}.`);
      }
      if (!nav.join) throw notImplemented(`Navigation '${seg.name}' of ${set.name} has no referential constraints in $metadata.`);
      parent = { set, key: key!, navigation: nav, where: this.scope(set), parent };
      set = this.set(nav.target);
      single = !nav.collection || !!seg.key;
      key = seg.key ? this.bindKey(set, seg.key) : undefined;
      if (seg.key && !nav.collection) throw badRequest('InvalidPath', `'${seg.name}' is single-valued and takes no key.`);
    }
    return { set, single, key, parent };
  }

  private bindKey(set: EntitySetInfo, raw: NonNullable<PathSegment['key']>): Record<string, BoundExpr> {
    const out: Record<string, BoundExpr> = {};
    if (raw.length === 1 && raw[0]!.name === undefined) {
      if (set.keys.length !== 1) throw badRequest('InvalidKey', `${set.name} has a composite key: name every key property.`);
      out[set.keys[0]!] = this.keyValue(set, set.keys[0]!, raw[0]!.value);
      return out;
    }
    for (const k of raw) {
      if (!k.name || !set.keys.includes(k.name)) throw badRequest('InvalidKey', `'${k.name}' is not a key property of ${set.name}.`);
      out[k.name] = this.keyValue(set, k.name, k.value);
    }
    const missing = set.keys.filter((k) => !(k in out));
    if (missing.length) throw badRequest('InvalidKey', `Key of ${set.name} is incomplete: ${missing.join(', ')} missing.`);
    return out;
  }

  private keyValue(set: EntitySetInfo, prop: string, text: string): BoundExpr {
    const ast = parseFilter(text, `key ${prop} of ${set.name}`);
    if (ast.kind !== 'literal') throw badRequest('InvalidKey', `Key ${prop} of ${set.name}: "${text}" is not a literal.`);
    const v = typedValue(ast, set.columns[prop]!.edmType, `key ${prop} of ${set.name}`);
    if (v.kind === 'value' && v.value === null) throw badRequest('InvalidKey', `Key ${prop} of ${set.name} cannot be null.`);
    return v;
  }

  // ---------------------------------------------------------------- collections

  /** Plans a collection request (or one entity: `key` given). */
  collection(set: EntitySetInfo, o: QueryOptions, extra: { key?: Record<string, BoundExpr>; parent?: ParentLink; single?: boolean; nested?: string } = {}): CollectionPlan {
    const where: BoundExpr[] = [...this.scope(set)];
    const caps = this.capsFor(set, extra.parent);
    const scope = extra.nested ? `${extra.nested}: ` : '';
    if (extra.key) for (const [k, v] of Object.entries(extra.key)) where.push({ kind: 'compare', op: 'eq', left: { kind: 'column', ref: { via: [], column: set.columns[k]! } }, right: v });
    if (o.filter) {
      this.checkFilterCapabilities(set, o.filter, caps);
      where.push(this.condition(set, o.filter, `${scope}$filter`));
    }
    if (o.search) {
      this.checkSearch(set, caps);
      where.push({ kind: 'search', expr: o.search, fields: this.searchFields(set) });
    }
    if (o.count && !caps.countable) throw badRequest('CountNotSupported', `Entity set '${set.name}' is not countable (Capabilities.CountRestrictions/Countable is false).`);

    // $select: own properties; keys always; the ETag property is read for @odata.etag.
    const names = new Set<string>(set.keys);
    if (o.select?.length) {
      for (const p of o.select) {
        if (p.length > 1) throw notImplemented(`${scope}$select=${p.join('/')}: select properties of related entities with $expand=${p[0]}($select=...).`);
        const name = p[0]!;
        if (set.navigations[name]) continue; // selecting a navigation property adds nothing in JSON minimal
        if (!set.columns[name]) throw badRequest('PropertyNotFound', `${scope}$select: '${name}' is not a property of ${set.name}.`, name);
        names.add(name);
      }
    } else for (const name of Object.keys(set.columns)) names.add(name);
    const select = [...names].map((n) => set.columns[n]!);
    const internal = set.etag && !names.has(set.etag) ? [set.columns[set.etag]!] : [];

    const expand = (o.expand ?? []).map((item) => {
      const nav = set.navigations[item.navigation];
      if (!nav) throw badRequest('PropertyNotFound', `${scope}$expand: '${item.navigation}' is not a navigation property of ${set.name}.`, item.navigation);
      if (caps.nonExpandable.includes(item.navigation)) throw badRequest('NotExpandable', `${scope}$expand: '${item.navigation}' of ${set.name} cannot be expanded (Capabilities.ExpandRestrictions).`);
      if (!nav.join) throw notImplemented(`Navigation '${item.navigation}' of ${set.name} has no referential constraints in $metadata.`);
      const target = this.set(nav.target);
      if (!nav.collection && (item.options.filter || item.options.orderBy || item.options.top !== undefined || item.options.skip !== undefined))
        throw badRequest('InvalidExpand', `$expand=${item.navigation}: $filter, $orderby, $top and $skip apply to collections only.`);
      return { navigation: nav, plan: this.collection(target, item.options, { nested: `$expand=${item.navigation}`, single: !nav.collection }) };
    });

    const orderBy = this.orderBy(set, o.orderBy, caps, scope);
    const max = this.o.maxPageSize;
    const single = !!extra.key || extra.single;
    return {
      set,
      select,
      internal,
      expand,
      where,
      orderBy,
      skip: o.skip ?? 0,
      top: single ? undefined : Math.min(o.top ?? max, max),
      pageSize: single ? undefined : o.top === undefined || o.top > max ? max : undefined,
      count: !!o.count,
      parent: extra.parent,
    };
  }

  private orderBy(set: EntitySetInfo, items: OrderByItem[] | undefined, caps: EntitySetInfo['capabilities'], scope: string) {
    const out: CollectionPlan['orderBy'] = [];
    if (items?.length && !caps.sortable) throw badRequest('SortNotSupported', `Entity set '${set.name}' does not support $orderby.`);
    for (const item of items ?? []) {
      const p = item.path.join('/');
      if (caps.nonSortable.includes(p)) throw badRequest('PropertyNotSortable', `Property '${p}' of entity set '${set.name}' is not sortable (Capabilities.SortRestrictions/NonSortableProperties).`, p);
      out.push({ ref: this.resolve(set, item.path, `${scope}$orderby`), descending: item.descending });
    }
    // Stable paging: the key always ends the sort order (ADR-027).
    for (const k of set.keys) if (!out.some((x) => x.ref.via.length === 0 && x.ref.column.property === k)) out.push({ ref: { via: [], column: set.columns[k]! }, descending: false });
    return out;
  }

  // ---------------------------------------------------------------- $apply

  aggregate(set: EntitySetInfo, o: QueryOptions, parent?: ParentLink): AggregatePlan {
    const steps = o.apply as ApplyStep[];
    if (o.filter || o.search || o.select || o.expand || o.count) throw notImplemented('$apply cannot be combined with $filter, $search, $select, $expand or $count in this service; put filters into filter() of $apply.');
    const caps = this.capsFor(set, parent);
    const where: BoundExpr[] = [...this.scope(set)];
    let grouped: { paths: string[][]; aggregates: { path: string[]; method: AggregateMethod; alias: string }[] } | undefined;
    for (const step of steps) {
      if (grouped) throw notImplemented('$apply: transformations after groupby() or aggregate() are not supported.');
      if (step.kind === 'filter') {
        this.checkFilterCapabilities(set, step.expr, caps);
        where.push(this.condition(set, step.expr, '$apply filter'));
      } else if (step.kind === 'search') {
        this.checkSearch(set, caps);
        where.push({ kind: 'search', expr: step.expr, fields: this.searchFields(set) });
      } else if (step.kind === 'groupby') grouped = step;
      else grouped = { paths: [], aggregates: step.aggregates };
    }
    if (!grouped) throw notImplemented('$apply without groupby() or aggregate() is not supported.');
    const groupBy = grouped.paths.map((path) => ({ ref: this.resolve(set, path, '$apply groupby'), path }));
    const aliases = new Set<string>();
    const aggregates = grouped.aggregates.map((a) => {
      const ref = this.resolve(set, a.path, '$apply aggregate');
      if (aliases.has(a.alias) || groupBy.some((g) => g.path[0] === a.alias)) throw badRequest('InvalidApply', `$apply: alias '${a.alias}' is used twice.`);
      aliases.add(a.alias);
      const t = ref.column.edmType;
      if (a.method !== 'countdistinct' && a.method !== 'min' && a.method !== 'max' && !NUMERIC.has(t)) throw badRequest('InvalidApply', `$apply: ${a.method} needs a numeric property, '${a.path.join('/')}' is ${t}.`);
      const edmType: EdmType = a.method === 'countdistinct' ? 'Edm.Int64' : a.method === 'average' ? 'Edm.Decimal' : t;
      return { ref, method: a.method, alias: a.alias, edmType };
    });
    const orderBy: AggregatePlan['orderBy'] = [];
    for (const item of o.orderBy ?? []) {
      const p = item.path.join('/');
      const gi = groupBy.findIndex((g) => g.path.join('/') === p);
      const ai = aggregates.findIndex((a) => a.alias === p);
      if (gi >= 0) orderBy.push({ target: { kind: 'group', index: gi }, descending: item.descending });
      else if (ai >= 0) orderBy.push({ target: { kind: 'aggregate', index: ai }, descending: item.descending });
      else throw badRequest('InvalidOrderBy', `$orderby: '${p}' is neither grouped nor aggregated by $apply.`);
    }
    for (const [i] of groupBy.entries()) if (!orderBy.some((x) => x.target.kind === 'group' && x.target.index === i)) orderBy.push({ target: { kind: 'group', index: i }, descending: false });
    const max = this.o.maxPageSize;
    return { set, where, groupBy, aggregates, orderBy, skip: o.skip ?? 0, top: Math.min(o.top ?? max, max), parent };
  }
}

function containsNavigation(e: BoundExpr): boolean {
  switch (e.kind) {
    case 'column':
      return e.ref.via.length > 0;
    case 'compare':
    case 'and':
    case 'or':
      return containsNavigation(e.left) || containsNavigation(e.right);
    case 'in':
      return containsNavigation(e.left);
    case 'not':
      return containsNavigation(e.operand);
    case 'func':
    case 'like':
      return containsNavigation(e.arg);
    case 'search':
      return e.fields.some((f) => f.via.length > 0);
    default:
      return false;
  }
}
