// The abstract syntax tree of the query options this service understands (ADR-027: URL -> AST -> query plan -> SQL).
// Literals carry their lexical type; the query-plan layer checks them against the Edm types in $metadata.

export type LiteralType = 'null' | 'boolean' | 'string' | 'number' | 'date' | 'dateTimeOffset' | 'timeOfDay' | 'guid';

export type Literal =
  | { kind: 'literal'; type: 'null'; value: null }
  | { kind: 'literal'; type: 'boolean'; value: boolean }
  | { kind: 'literal'; type: Exclude<LiteralType, 'null' | 'boolean'>; value: string };

export type CompareOp = 'eq' | 'ne' | 'gt' | 'ge' | 'lt' | 'le';

/** A $filter expression. */
export type Expr =
  | Literal
  | { kind: 'path'; segments: string[] }
  | { kind: 'compare'; op: CompareOp; left: Expr; right: Expr }
  | { kind: 'in'; left: Expr; list: Expr[] }
  | { kind: 'and' | 'or'; left: Expr; right: Expr }
  | { kind: 'not'; operand: Expr }
  | { kind: 'call'; name: string; args: Expr[] }
  /**
   * Lambda operator over a collection navigation: `path/any(variable: body)`, `path/any()`, `path/all(variable: body)`.
   * `path` may start with `$it` or an enclosing lambda variable. In `body`, paths start with `variable` (the member of
   * the collection), an enclosing variable, or `$it`; any other path is relative to `$it`, the entity being filtered.
   */
  | { kind: 'lambda'; op: 'any' | 'all'; path: string[]; variable?: string; body?: Expr };

/** A $search expression (OData URL conventions §5.1.7): terms, "phrases", AND / OR / NOT, parentheses. */
export type SearchExpr =
  | { kind: 'term'; text: string }
  | { kind: 'and' | 'or'; left: SearchExpr; right: SearchExpr }
  | { kind: 'not'; operand: SearchExpr };

export interface OrderByItem {
  path: string[];
  descending: boolean;
}

export interface ExpandItem {
  navigation: string;
  options: QueryOptions;
}

/** `count` is `$count as alias` (rows of the group; `path` is empty). */
export type AggregateMethod = 'sum' | 'min' | 'max' | 'average' | 'countdistinct' | 'count';

/** One step of $apply (OData Data Aggregation). Only the steps smart-kit sends (ADR-021). */
export type ApplyStep =
  | { kind: 'filter'; expr: Expr }
  | { kind: 'search'; expr: SearchExpr }
  | { kind: 'groupby'; paths: string[][]; aggregates: AggregateItem[] }
  | { kind: 'aggregate'; aggregates: AggregateItem[] };

export interface AggregateItem {
  path: string[];
  method: AggregateMethod;
  alias: string;
}

/** System query options of one request or one $expand item. */
export interface QueryOptions {
  select?: string[][];
  expand?: ExpandItem[];
  filter?: Expr;
  search?: SearchExpr;
  orderBy?: OrderByItem[];
  top?: number;
  skip?: number;
  count?: boolean;
  apply?: ApplyStep[];
}
