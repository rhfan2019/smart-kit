// $filter and the groupby/aggregate steps of $apply, parsed with chevrotain into a typed AST (./ast.ts).
//
// Adapted from the filter grammar of @sap-ux/fe-mockserver-core (src/request/filterParser.ts and
// commonTokens.ts), Copyright (c) 2021-2026 SAP SE or an SAP affiliate company, licensed under the
// Apache License, Version 2.0 (http://www.apache.org/licenses/LICENSE-2.0); see packages/server/NOTICE.
// Changes: an operator-precedence grammar (or < and < not < comparison) instead of the flat AND/OR list;
// whitespace is skipped by the lexer; string literals may contain '' (an escaped quote) and any character;
// every literal is typed (string, number, date, dateTimeOffset, timeOfDay, guid, boolean, null) so that the
// query plan can check it against the property type; lambda operators any / all over collection navigations
// (`_Item/any(i: i/Plant eq '1010')`, `$it/...` for the outer entity) are parsed into a `lambda` node.
import { createToken, EmbeddedActionsParser, Lexer, type IToken, type TokenType } from 'chevrotain';
import { badRequest, notImplemented } from '../errors';
import type { AggregateItem, AggregateMethod, CompareOp, Expr, Literal } from './ast';

const Identifier = createToken({ name: 'Identifier', pattern: /[A-Za-z_][A-Za-z0-9_]*/ });
const keyword = (name: string, word: string) => createToken({ name, pattern: new RegExp(word), longer_alt: Identifier });

const WhiteSpace = createToken({ name: 'WhiteSpace', pattern: /\s+/, group: Lexer.SKIPPED });
const LParen = createToken({ name: 'LParen', pattern: /\(/ });
const RParen = createToken({ name: 'RParen', pattern: /\)/ });
const Comma = createToken({ name: 'Comma', pattern: /,/ });
const Slash = createToken({ name: 'Slash', pattern: /\// });
const Colon = createToken({ name: 'Colon', pattern: /:/ });
const StringLit = createToken({ name: 'StringLit', pattern: /'(?:[^']|'')*'/ });
const GuidLit = createToken({ name: 'GuidLit', pattern: /[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}(?![0-9A-Za-z_])/ });
const DateTimeOffsetLit = createToken({ name: 'DateTimeOffsetLit', pattern: /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,12})?)?(?:Z|[+-]\d{2}:\d{2})/i });
const DateLit = createToken({ name: 'DateLit', pattern: /\d{4}-\d{2}-\d{2}(?![\d:T])/ });
const TimeOfDayLit = createToken({ name: 'TimeOfDayLit', pattern: /\d{2}:\d{2}(?::\d{2}(?:\.\d{1,12})?)?/ });
const NumberLit = createToken({ name: 'NumberLit', pattern: /-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?(?![A-Za-z_])/ });
const And = keyword('And', 'and');
const Or = keyword('Or', 'or');
const Not = keyword('Not', 'not');
const In = keyword('In', 'in');
const CompareOpTok = createToken({ name: 'CompareOp', pattern: /(?:eq|ne|gt|ge|lt|le)/, longer_alt: Identifier });
const True = keyword('True', 'true');
const False = keyword('False', 'false');
const Null = keyword('Null', 'null');
const DollarCount = createToken({ name: 'DollarCount', pattern: /\$count(?![A-Za-z0-9_])/ });
const DollarIt = createToken({ name: 'DollarIt', pattern: /\$it(?![A-Za-z0-9_])/ });
const Any = keyword('Any', 'any');
const All = keyword('All', 'all');

const TOKENS: TokenType[] = [
  WhiteSpace, LParen, RParen, Comma, Slash, Colon, StringLit,
  GuidLit, DateTimeOffsetLit, DateLit, TimeOfDayLit, NumberLit,
  And, Or, Not, In, CompareOpTok, True, False, Null, DollarCount, DollarIt, Any, All, Identifier,
];
const FilterLexer = new Lexer(TOKENS, { positionTracking: 'onlyOffset', ensureOptimizations: false });

const AGGREGATE_METHODS = new Set<AggregateMethod>(['sum', 'min', 'max', 'average', 'countdistinct']);

class FilterParser extends EmbeddedActionsParser {
  constructor() {
    super(TOKENS, { maxLookahead: 3 });
    this.performSelfAnalysis();
  }

  expression = this.RULE('expression', (): Expr => this.SUBRULE(this.orExpr));

  private orExpr = this.RULE('orExpr', (): Expr => {
    let left = this.SUBRULE(this.andExpr);
    this.MANY(() => {
      this.CONSUME(Or);
      const right = this.SUBRULE2(this.andExpr);
      left = { kind: 'or', left, right };
    });
    return left;
  });

  private andExpr = this.RULE('andExpr', (): Expr => {
    let left = this.SUBRULE(this.notExpr);
    this.MANY(() => {
      this.CONSUME(And);
      const right = this.SUBRULE2(this.notExpr);
      left = { kind: 'and', left, right };
    });
    return left;
  });

  private notExpr = this.RULE('notExpr', (): Expr =>
    this.OR([
      {
        ALT: () => {
          this.CONSUME(Not);
          const operand = this.SUBRULE(this.notExpr);
          return { kind: 'not', operand } as Expr;
        },
      },
      { ALT: () => this.SUBRULE(this.compareExpr) },
    ]),
  );

  private compareExpr = this.RULE('compareExpr', (): Expr => {
    const left = this.SUBRULE(this.operand);
    let result: Expr = left;
    this.OPTION(() => {
      this.OR([
        {
          ALT: () => {
            const op = this.CONSUME(CompareOpTok).image as CompareOp;
            const right = this.SUBRULE2(this.operand);
            result = { kind: 'compare', op, left, right };
          },
        },
        {
          ALT: () => {
            this.CONSUME(In);
            this.CONSUME(LParen);
            const list: Expr[] = [];
            this.AT_LEAST_ONE_SEP({ SEP: Comma, DEF: () => list.push(this.SUBRULE3(this.operand)) });
            this.CONSUME(RParen);
            result = { kind: 'in', left, list };
          },
        },
      ]);
    });
    return result;
  });

  private operand = this.RULE('operand', (): Expr =>
    this.OR([
      {
        ALT: () => {
          this.CONSUME(LParen);
          const e = this.SUBRULE(this.expression);
          this.CONSUME(RParen);
          return e;
        },
      },
      { ALT: () => this.SUBRULE(this.call) },
      { ALT: () => this.SUBRULE(this.literal) },
      { ALT: () => this.SUBRULE(this.path) },
    ]),
  );

  private call = this.RULE('call', (): Expr => {
    const name = this.CONSUME(Identifier).image;
    this.CONSUME(LParen);
    const args: Expr[] = [];
    this.MANY_SEP({ SEP: Comma, DEF: () => args.push(this.SUBRULE(this.expression)) });
    this.CONSUME(RParen);
    return { kind: 'call', name, args };
  });

  /** A property path, or a lambda operator at its end: `_Item/any(i: i/Plant eq '1010')`, `_Item/all(i: ...)`. */
  private path = this.RULE('path', (): Expr => {
    const segments = [this.OR([{ ALT: () => this.CONSUME(Identifier).image }, { ALT: () => this.CONSUME(DollarIt).image }])];
    let lambda: Extract<Expr, { kind: 'lambda' }> | undefined;
    this.MANY(() => {
      this.CONSUME(Slash);
      this.OR2([
        {
          ALT: () => {
            const seg = this.CONSUME2(Identifier).image;
            this.ACTION(() => {
              if (lambda) throw badRequest('InvalidSyntax', `$filter: nothing may follow ${lambda.op}(...) in a path ('${seg}').`);
              segments.push(seg);
            });
          },
        },
        {
          ALT: () => {
            const op = this.OR3([{ ALT: () => this.CONSUME(Any).image }, { ALT: () => this.CONSUME(All).image }]) as 'any' | 'all';
            this.CONSUME(LParen);
            let variable: string | undefined;
            let body: Expr | undefined;
            this.OPTION(() => {
              variable = this.CONSUME3(Identifier).image;
              this.CONSUME(Colon);
              body = this.SUBRULE(this.expression);
            });
            this.CONSUME(RParen);
            this.ACTION(() => {
              if (lambda) throw badRequest('InvalidSyntax', `$filter: nothing may follow ${lambda.op}(...) in a path.`);
              if (op === 'all' && !body) throw badRequest('InvalidSyntax', '$filter: all() needs a condition: all(x: ...).');
              lambda = { kind: 'lambda', op, path: [...segments], variable, body };
            });
          },
        },
      ]);
    });
    return lambda ?? { kind: 'path', segments };
  });

  private literal = this.RULE('literal', (): Literal =>
    this.OR([
      { ALT: () => ({ kind: 'literal', type: 'string', value: unquote(this.CONSUME(StringLit).image) }) as Literal },
      { ALT: () => ({ kind: 'literal', type: 'guid', value: this.CONSUME(GuidLit).image.toLowerCase() }) as Literal },
      { ALT: () => ({ kind: 'literal', type: 'dateTimeOffset', value: this.CONSUME(DateTimeOffsetLit).image }) as Literal },
      { ALT: () => ({ kind: 'literal', type: 'date', value: this.CONSUME(DateLit).image }) as Literal },
      { ALT: () => ({ kind: 'literal', type: 'timeOfDay', value: this.CONSUME(TimeOfDayLit).image }) as Literal },
      { ALT: () => ({ kind: 'literal', type: 'number', value: this.CONSUME(NumberLit).image }) as Literal },
      { ALT: () => (this.CONSUME(True), { kind: 'literal', type: 'boolean', value: true }) as Literal },
      { ALT: () => (this.CONSUME(False), { kind: 'literal', type: 'boolean', value: false }) as Literal },
      { ALT: () => (this.CONSUME(Null), { kind: 'literal', type: 'null', value: null }) as Literal },
    ]),
  );

  /** `(p1,p2/x)` or `(p1),aggregate(...)` — the arguments of groupby(...) without its outer parentheses. */
  groupbyArgs = this.RULE('groupbyArgs', (): { paths: string[][]; aggregates: AggregateItem[] } => {
    this.CONSUME(LParen);
    const paths: string[][] = [];
    this.AT_LEAST_ONE_SEP({ SEP: Comma, DEF: () => paths.push(this.SUBRULE(this.plainPath)) });
    this.CONSUME(RParen);
    let aggregates: AggregateItem[] = [];
    this.OPTION(() => {
      this.CONSUME2(Comma);
      const word = this.CONSUME(Identifier).image;
      this.ACTION(() => {
        if (word !== 'aggregate') throw notImplemented(`groupby with '${word}' is not supported; only aggregate(...) is.`);
      });
      this.CONSUME2(LParen);
      aggregates = this.SUBRULE(this.aggregateList);
      this.CONSUME2(RParen);
    });
    return { paths, aggregates };
  });

  /** `m with sum as alias, ...` — the arguments of aggregate(...). */
  aggregateList = this.RULE('aggregateList', (): AggregateItem[] => {
    const items: AggregateItem[] = [];
    this.AT_LEAST_ONE_SEP({
      SEP: Comma,
      DEF: () => {
        this.OR([
          {
            // `$count as alias`: number of rows of the group (OData Data Aggregation §3.1.4).
            ALT: () => {
              this.CONSUME(DollarCount);
              const asWord = this.CONSUME5(Identifier).image;
              const alias = this.CONSUME6(Identifier).image;
              this.ACTION(() => {
                if (asWord !== 'as') throw badRequest('InvalidApply', `Expected "$count as <alias>" in aggregate(), got "$count ${asWord}".`);
                items.push({ path: [], method: 'count', alias });
              });
            },
          },
          {
            ALT: () => {
              const path = this.SUBRULE(this.plainPath);
              const withWord = this.CONSUME(Identifier).image;
              const method = this.CONSUME2(Identifier).image;
              const asWord = this.CONSUME3(Identifier).image;
              const alias = this.CONSUME4(Identifier).image;
              this.ACTION(() => {
                if (withWord !== 'with' || asWord !== 'as') throw badRequest('InvalidApply', `Expected "<path> with <method> as <alias>" in aggregate(), got "${withWord} ${method} ${asWord}".`);
                if (!AGGREGATE_METHODS.has(method as AggregateMethod)) throw notImplemented(`Aggregation method '${method}' is not supported.`);
                items.push({ path, method: method as AggregateMethod, alias });
              });
            },
          },
        ]);
      },
    });
    return items;
  });

  private plainPath = this.RULE('plainPath', (): string[] => {
    const segments = [this.CONSUME(Identifier).image];
    this.MANY(() => {
      this.CONSUME(Slash);
      segments.push(this.CONSUME2(Identifier).image);
    });
    return segments;
  });
}

const unquote = (image: string) => image.slice(1, -1).replace(/''/g, "'");

let parser: FilterParser | undefined;

function run<T>(text: string, option: string, rule: (p: FilterParser) => T): T {
  const lexed = FilterLexer.tokenize(text);
  if (lexed.errors.length) {
    const e = lexed.errors[0]!;
    throw badRequest('InvalidSyntax', `${option}: unexpected character at position ${e.offset + 1}: "${text.slice(e.offset, e.offset + 12)}"`);
  }
  parser ??= new FilterParser();
  parser.input = lexed.tokens;
  const result = rule(parser);
  if (parser.errors.length) {
    const e = parser.errors[0]!;
    const tok: IToken = e.token;
    const where = Number.isNaN(tok.startOffset) || tok.image === '' ? 'at the end' : `at position ${tok.startOffset + 1} ("${tok.image}")`;
    throw badRequest('InvalidSyntax', `${option}: syntax error ${where}.`);
  }
  return result;
}

/** Parses a $filter expression (also used for filter() in $apply). */
export function parseFilter(text: string, option = '$filter'): Expr {
  if (!text.trim()) throw badRequest('InvalidSyntax', `${option} is empty.`);
  return run(text, option, (p) => p.expression());
}

/** Parses the arguments of groupby(...) in $apply. */
export function parseGroupBy(text: string) {
  return run(text, '$apply groupby', (p) => p.groupbyArgs());
}

/** Parses the arguments of aggregate(...) in $apply. */
export function parseAggregate(text: string) {
  return run(text, '$apply aggregate', (p) => p.aggregateList());
}
