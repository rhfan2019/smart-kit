// Query plan -> PostgreSQL, composed with Kysely's `sql` template (ADR-027):
//  - every value is a parameter ($1, $2, ...); identifiers come only from the schema (the metadata whitelist) and are
//    quoted by sql.id(); the only raw SQL is fixed text in this file (operators, casts, function names);
//  - LIKE / ILIKE patterns escape %, _ and \ (escapeLike);
//  - the key always ends ORDER BY (the planner appends it); $count is COUNT(*) OVER() in the same query;
//  - a collection $expand is a LEFT JOIN LATERAL with json_agg, a single-valued one a LEFT JOIN LATERAL with
//    row_to_json (PostgREST's approach); the page is cut in an inner query first, so laterals only run for the
//    rows that are returned.
// OData's two-valued logic: a comparison with null is false, never unknown. Under "not", every predicate that may
// see null is wrapped in coalesce(…, false); "ne" on a nullable column is IS DISTINCT FROM.
import { sql, type RawBuilder } from 'kysely';
import type { AggregatePlan, BoundExpr, CollectionPlan, ColumnRef, ParentLink } from './plan';
import type { SearchExpr } from './parser/ast';
import type { ColumnInfo, EntitySetInfo, ServiceSchema } from './schema';

type Sql = RawBuilder<unknown>;

const OPS = { eq: '=', ne: '<>', gt: '>', ge: '>=', lt: '<', le: '<=' } as const;
const INTEGER = new Set(['Edm.Byte', 'Edm.SByte', 'Edm.Int16', 'Edm.Int32', 'Edm.Int64']);

/** Escapes the LIKE wildcards % and _ and the escape character \ itself. */
export const escapeLike = (text: string) => text.replace(/[\\%_]/g, (c) => `\\${c}`);

/** PostgreSQL type a literal parameter is cast to, chosen from the Edm type it is compared with (fixed list). */
function castFor(edmType: string | undefined, value: string | boolean): string {
  switch (edmType) {
    case 'Edm.Boolean': return 'boolean';
    case 'Edm.Decimal': return 'numeric';
    case 'Edm.Double': case 'Edm.Single': return 'double precision';
    case 'Edm.Date': return 'date';
    case 'Edm.DateTimeOffset': return 'timestamptz';
    case 'Edm.TimeOfDay': return 'time';
    case 'Edm.Guid': return 'uuid';
    default:
      if (edmType && INTEGER.has(edmType)) return /^-?\d{1,18}$/.test(String(value)) ? 'bigint' : 'numeric';
      return 'text';
  }
}

/** A column as written to the response: decimals and Int64 as exact text, dates and times in ISO 8601, UTC. */
export function outputExpr(col: Sql, c: Pick<ColumnInfo, 'edmType' | 'precision'>): Sql {
  switch (c.edmType) {
    case 'Edm.Decimal': case 'Edm.Int64': case 'Edm.Guid':
      return sql`(${col})::text`;
    case 'Edm.Date':
      return sql`to_char(${col}, 'YYYY-MM-DD')`;
    case 'Edm.TimeOfDay':
      return sql`to_char(${col}, 'HH24:MI:SS')`;
    case 'Edm.DateTimeOffset': {
      const p = c.precision ?? 0;
      const format = p <= 0 ? 'YYYY-MM-DD"T"HH24:MI:SS"Z"' : p <= 3 ? 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"' : 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"';
      return sql`to_char((${col})::timestamptz at time zone 'UTC', ${sql.lit(format)})`;
    }
    default:
      return col;
  }
}

class Aliases {
  private n = 0;
  next(prefix = 't') {
    return `${prefix}${this.n++}`;
  }
}

const table = (s: EntitySetInfo) => sql.id(...s.table);

/** One FROM item (an entity set under an alias) and the LEFT JOINs its expressions need for single-valued navigations. */
class Source {
  private readonly joins = new Map<string, { alias: string; set: EntitySetInfo; sql: Sql }>();
  constructor(
    readonly set: EntitySetInfo,
    readonly alias: string,
    private readonly b: SqlBuilder,
  ) {}

  /** The SQL of a column reference; adds the joins on the way. */
  col(ref: ColumnRef): Sql {
    let alias = this.alias;
    let set = this.set;
    let key = '';
    for (const navName of ref.via) {
      key += `/${navName}`;
      let j = this.joins.get(key);
      if (!j) {
        const nav = set.navigations[navName]!;
        const target = this.b.schema.entitySets[nav.target]!;
        const ta = this.b.aliases.next();
        const on = nav.join!.map((p) => sql`${sql.id(ta, target.columns[p.target]!.column)} = ${sql.id(alias, set.columns[p.source]!.column)}`);
        const scope = this.b.scopeOf(target).map((e) => new Source(target, ta, this.b).expr(e));
        j = { alias: ta, set: target, sql: sql`left join ${table(target)} as ${sql.id(ta)} on ${sql.join([...on, ...scope], sql` and `)}` };
        this.joins.set(key, j);
      }
      alias = j.alias;
      set = j.set;
    }
    return sql.id(alias, ref.column.column);
  }

  /** Raw column of this source itself (no navigation). */
  own(property: string): Sql {
    return sql.id(this.alias, this.set.columns[property]!.column);
  }

  joinSql(): Sql {
    return sql.join([...this.joins.values()].map((j) => j.sql), sql` `);
  }

  from(): Sql {
    return this.joins.size ? sql`${table(this.set)} as ${sql.id(this.alias)} ${this.joinSql()}` : sql`${table(this.set)} as ${sql.id(this.alias)}`;
  }

  /** May the expression be null (nullable column, or reached through a LEFT JOIN)? */
  private mayBeNull(e: BoundExpr): boolean {
    if (e.kind === 'column') return e.ref.column.nullable || e.ref.via.length > 0;
    if (e.kind === 'func' || e.kind === 'like') return this.mayBeNull(e.arg);
    return false;
  }

  private value(e: Extract<BoundExpr, { kind: 'value' }>): Sql {
    return sql`${e.value}::${sql.raw(castFor(e.edmType, e.value as string | boolean))}`;
  }

  private operand(e: BoundExpr): Sql {
    switch (e.kind) {
      case 'column':
        return this.col(e.ref);
      case 'value':
        return this.value(e);
      case 'func': {
        const fn = { tolower: 'lower', toupper: 'upper', trim: 'btrim', length: 'char_length' }[e.name];
        return sql`${sql.raw(fn)}(${this.operand(e.arg)})`;
      }
      default:
        return sql`(${this.expr(e)})`;
    }
  }

  /** A condition. `negated`: the expression sits under an odd number of "not". */
  expr(e: BoundExpr, negated = false): Sql {
    const leaf = (pred: Sql, nullable: boolean) => (negated && nullable ? sql`coalesce(${pred}, false)` : pred);
    switch (e.kind) {
      case 'const':
        return e.value ? sql`true` : sql`false`;
      case 'and':
      case 'or':
        return sql`(${this.expr(e.left, negated)} ${sql.raw(e.kind)} ${this.expr(e.right, negated)})`;
      case 'not':
        return sql`not (${this.expr(e.operand, !negated)})`;
      case 'column':
        return leaf(this.col(e.ref), this.mayBeNull(e));
      case 'compare': {
        const nullSide = [e.left, e.right].find((x) => x.kind === 'value' && x.value === null);
        if (nullSide) {
          const other = nullSide === e.left ? e.right : e.left;
          if (other.kind === 'value') return (other.value === null) === (e.op === 'eq') ? sql`true` : sql`false`;
          return e.op === 'eq' ? sql`${this.operand(other)} is null` : sql`${this.operand(other)} is not null`;
        }
        const nullable = this.mayBeNull(e.left) || this.mayBeNull(e.right);
        if (e.op === 'ne' && nullable) return sql`${this.operand(e.left)} is distinct from ${this.operand(e.right)}`;
        return leaf(sql`${this.operand(e.left)} ${sql.raw(OPS[e.op])} ${this.operand(e.right)}`, nullable);
      }
      case 'in': {
        const values = e.list.filter((x) => !(x.kind === 'value' && x.value === null));
        const parts: Sql[] = [];
        if (values.length) parts.push(leaf(sql`${this.operand(e.left)} in (${sql.join(values.map((v) => this.operand(v)))})`, this.mayBeNull(e.left)));
        if (values.length < e.list.length) parts.push(sql`${this.operand(e.left)} is null`);
        return parts.length === 1 ? parts[0]! : sql`(${sql.join(parts, sql` or `)})`;
      }
      case 'like': {
        const esc = escapeLike(e.text);
        const pattern = e.mode === 'contains' ? `%${esc}%` : e.mode === 'startswith' ? `${esc}%` : `%${esc}`;
        return leaf(sql`${this.operand(e.arg)} ${sql.raw(e.caseInsensitive ? 'ilike' : 'like')} ${pattern} escape '\\'`, this.mayBeNull(e.arg));
      }
      case 'search':
        return this.search(e.expr, e.fields, negated);
      case 'value':
      case 'func':
        throw new Error(`[smart-kit-server] ${e.kind} is not a condition`);
    }
  }

  /** $search: every term matches (case-insensitively, as a substring) one of the search fields. */
  private search(e: SearchExpr, fields: ColumnRef[], negated: boolean): Sql {
    switch (e.kind) {
      case 'and':
      case 'or':
        return sql`(${this.search(e.left, fields, negated)} ${sql.raw(e.kind)} ${this.search(e.right, fields, negated)})`;
      case 'not':
        return sql`not (${this.search(e.operand, fields, !negated)})`;
      case 'term': {
        if (!fields.length) return sql`false`;
        const pattern = `%${escapeLike(e.text)}%`;
        const parts = fields.map((f) => {
          const c = f.column.edmType === 'Edm.String' ? this.col(f) : sql`(${this.col(f)})::text`;
          const pred = sql`${c} ilike ${pattern} escape '\\'`;
          return negated && (f.column.nullable || f.via.length) ? sql`coalesce(${pred}, false)` : pred;
        });
        return sql`(${sql.join(parts, sql` or `)})`;
      }
    }
  }
}

export interface BuiltQuery {
  query: Sql;
}

/** Builds the SQL of query plans. One builder per request (aliases are numbered per request). */
export class SqlBuilder {
  readonly aliases = new Aliases();
  constructor(
    readonly schema: ServiceSchema,
    readonly scopeOf: (set: EntitySetInfo) => BoundExpr[],
  ) {}

  private parentExists(link: ParentLink, child: Source): Sql {
    const p = new Source(link.set, this.aliases.next('p'), this);
    const conds: Sql[] = [];
    for (const [k, v] of Object.entries(link.key)) conds.push(p.expr({ kind: 'compare', op: 'eq', left: { kind: 'column', ref: { via: [], column: link.set.columns[k]! } }, right: v }));
    for (const pair of link.navigation.join!) conds.push(sql`${p.own(pair.source)} = ${child.own(pair.target)}`);
    for (const w of link.where) conds.push(p.expr(w));
    if (link.parent) conds.push(this.parentExists(link.parent, p));
    return sql`exists (select 1 from ${p.from()} where ${sql.join(conds, sql` and `)})`;
  }

  private where(plan: { where: BoundExpr[]; parent?: ParentLink }, src: Source, extra: Sql[] = []): Sql[] {
    const conds = [...extra, ...plan.where.map((w) => src.expr(w))];
    if (plan.parent) conds.push(this.parentExists(plan.parent, src));
    return conds;
  }

  /**
   * The rows of a collection plan with response property names, as one SELECT:
   *   select <outputs>, <expanded navigations> from (<page: filter, sort, limit>) p <lateral joins> order by …
   * `correlate`: conditions tying the rows to an outer row (expand).
   */
  rows(plan: CollectionPlan, correlate?: (src: Source) => Sql[], limitExtra = 0): Sql {
    const src = new Source(plan.set, this.aliases.next(), this);
    const conds = this.where(plan, src, correlate?.(src));
    const order = plan.orderBy.map((o) => src.col(o.ref));
    const needed = new Map<string, ColumnInfo>();
    for (const c of [...plan.select, ...plan.internal]) needed.set(c.property, c);
    for (const e of plan.expand) for (const pair of e.navigation.join!) needed.set(pair.source, plan.set.columns[pair.source]!);
    const pageCols: Sql[] = [...needed.keys()].map((p) => sql`${src.own(p)} as ${sql.id(p)}`);
    order.forEach((o, i) => pageCols.push(sql`${o} as ${sql.id(`@o${i}`)}`));
    if (plan.count) pageCols.push(sql`count(*) over () as ${sql.id('@count')}`);
    const orderSql = sql.join(order.map((o, i) => sql`${o} ${sql.raw(plan.orderBy[i]!.descending ? 'desc' : 'asc')}`));
    const limit = plan.top === undefined ? undefined : plan.top + limitExtra;
    const where = conds.length ? sql`where ${sql.join(conds, sql` and `)}` : sql``;
    const paging = sql`${limit === undefined ? sql`` : sql`limit ${limit}`} ${plan.skip ? sql`offset ${plan.skip}` : sql``}`;
    // FROM is rendered after the expressions above: they may have added joins.
    const page = sql`select ${sql.join(pageCols)} from ${src.from()} ${where} order by ${orderSql} ${paging}`;

    const p = this.aliases.next('p');
    const out: Sql[] = [...plan.select, ...plan.internal].map((c) => sql`${outputExpr(sql.id(p, c.property), c)} as ${sql.id(c.property)}`);
    const laterals: Sql[] = [];
    for (const e of plan.expand) {
      const x = this.aliases.next('x');
      const correlateInner = (inner: Source) => e.navigation.join!.map((pair) => sql`${inner.own(pair.target)} = ${sql.id(p, pair.source)}`);
      if (e.navigation.collection) {
        const inner = this.rows(e.plan, correlateInner, e.plan.pageSize ? 1 : 0);
        const q = this.aliases.next('q');
        const ords = e.plan.orderBy.map((o, i) => sql`${sql.id(q, `@o${i}`)} ${sql.raw(o.descending ? 'desc' : 'asc')}`);
        laterals.push(sql`left join lateral (select coalesce(json_agg(row_to_json(${sql.id(q)}) order by ${sql.join(ords)}), '[]'::json) as v from (${inner}) as ${sql.id(q)}) as ${sql.id(x)} on true`);
      } else {
        const inner = this.rows({ ...e.plan, top: 1 }, correlateInner);
        const q = this.aliases.next('q');
        laterals.push(sql`left join lateral (select row_to_json(${sql.id(q)}) as v from (${inner}) as ${sql.id(q)}) as ${sql.id(x)} on true`);
      }
      out.push(sql`${sql.id(x, 'v')} as ${sql.id(e.navigation.name)}`);
    }
    order.forEach((_, i) => out.push(sql.id(p, `@o${i}`)));
    if (plan.count) out.push(sql.id(p, '@count'));
    const outerOrder = sql.join(plan.orderBy.map((o, i) => sql`${sql.id(p, `@o${i}`)} ${sql.raw(o.descending ? 'desc' : 'asc')}`));
    return sql`select ${sql.join(out)} from (${page}) as ${sql.id(p)} ${sql.join(laterals, sql` `)} order by ${outerOrder}`;
  }

  /** The top-level query of a collection (or single entity) request. */
  collection(plan: CollectionPlan): Sql {
    return this.rows(plan, undefined, plan.pageSize ? 1 : 0);
  }

  /** SELECT count(*) over the plan's rows (for /$count, and $count=true when the page is empty). */
  count(plan: { set: EntitySetInfo; where: BoundExpr[]; parent?: ParentLink }): Sql {
    const src = new Source(plan.set, this.aliases.next(), this);
    const conds = this.where(plan, src);
    const where = conds.length ? sql`where ${sql.join(conds, sql` and `)}` : sql``;
    return sql`select count(*)::text as ${sql.id('count')} from ${src.from()} ${where}`;
  }

  /** $apply=…/groupby((…),aggregate(…)): one row per group; group values "g<i>", aggregates "a<i>". */
  aggregate(plan: AggregatePlan): Sql {
    const src = new Source(plan.set, this.aliases.next(), this);
    const conds = this.where(plan, src);
    const groups = plan.groupBy.map((g) => src.col(g.ref));
    const aggs = plan.aggregates.map((a) => {
      if (!a.ref) return sql`count(*)`;
      const c = src.col(a.ref);
      switch (a.method) {
        case 'count': return sql`count(*)`;
        case 'sum': return sql`sum(${c})`;
        case 'min': return sql`min(${c})`;
        case 'max': return sql`max(${c})`;
        case 'average': return sql`avg(${c})`;
        case 'countdistinct': return sql`count(distinct ${c})`;
      }
    });
    const cols: Sql[] = [
      ...groups.map((g, i) => sql`${outputExpr(g, plan.groupBy[i]!.ref.column)} as ${sql.id(`g${i}`)}`),
      ...aggs.map((a, i) => sql`${outputExpr(a, { edmType: plan.aggregates[i]!.edmType, precision: plan.aggregates[i]!.ref?.column.precision })} as ${sql.id(`a${i}`)}`),
    ];
    if (!cols.length) cols.push(sql`count(*) as ${sql.id('@n')}`);
    if (plan.count) cols.push(sql`count(*) over () as ${sql.id('@count')}`);
    const where = conds.length ? sql`where ${sql.join(conds, sql` and `)}` : sql``;
    const groupBy = groups.length ? sql`group by ${sql.join(groups)}` : sql``;
    const order = plan.orderBy.length
      ? sql`order by ${sql.join(plan.orderBy.map((o) => sql`${o.target.kind === 'group' ? groups[o.target.index]! : aggs[o.target.index]!} ${sql.raw(o.descending ? 'desc' : 'asc')}`))}`
      : sql``;
    const paging = sql`${plan.top === undefined ? sql`` : sql`limit ${plan.top}`} ${plan.skip ? sql`offset ${plan.skip}` : sql``}`;
    return sql`select ${sql.join(cols)} from ${src.from()} ${where} ${groupBy} ${order} ${paging}`;
  }
}
