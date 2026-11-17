// $search (OData URL conventions §5.1.7): terms, "phrases", AND / OR / NOT, parentheses; adjacent terms are AND.
// Same semantics as the search of the test service (apps/mock/lib/filter.mjs, searchToFilter), on chevrotain.
import { createToken, EmbeddedActionsParser, Lexer, type TokenType } from 'chevrotain';
import { badRequest } from '../errors';
import type { SearchExpr } from './ast';

const Word = createToken({ name: 'Word', pattern: /[^\s()"]+/ });
const WhiteSpace = createToken({ name: 'WhiteSpace', pattern: /\s+/, group: Lexer.SKIPPED });
const LParen = createToken({ name: 'LParen', pattern: /\(/ });
const RParen = createToken({ name: 'RParen', pattern: /\)/ });
const Phrase = createToken({ name: 'Phrase', pattern: /"(?:[^"\\]|\\.)*"/ });
const AndTok = createToken({ name: 'AND', pattern: /AND/, longer_alt: Word });
const OrTok = createToken({ name: 'OR', pattern: /OR/, longer_alt: Word });
const NotTok = createToken({ name: 'NOT', pattern: /NOT/, longer_alt: Word });

const TOKENS: TokenType[] = [WhiteSpace, LParen, RParen, Phrase, AndTok, OrTok, NotTok, Word];
const SearchLexer = new Lexer(TOKENS, { positionTracking: 'onlyOffset', ensureOptimizations: false });

class SearchParser extends EmbeddedActionsParser {
  constructor() {
    super(TOKENS);
    this.performSelfAnalysis();
  }

  search = this.RULE('search', (): SearchExpr => this.SUBRULE(this.orExpr));

  private orExpr = this.RULE('orExpr', (): SearchExpr => {
    let left = this.SUBRULE(this.andExpr);
    this.MANY(() => {
      this.CONSUME(OrTok);
      const right = this.SUBRULE2(this.andExpr);
      left = { kind: 'or', left, right };
    });
    return left;
  });

  private andExpr = this.RULE('andExpr', (): SearchExpr => {
    let left = this.SUBRULE(this.unary);
    this.MANY(() => {
      this.OPTION(() => this.CONSUME(AndTok));
      const right = this.SUBRULE2(this.unary);
      left = { kind: 'and', left, right };
    });
    return left;
  });

  private unary = this.RULE('unary', (): SearchExpr =>
    this.OR([
      {
        ALT: () => {
          this.CONSUME(NotTok);
          return { kind: 'not', operand: this.SUBRULE(this.unary) } as SearchExpr;
        },
      },
      {
        ALT: () => {
          this.CONSUME(LParen);
          const e = this.SUBRULE(this.orExpr);
          this.CONSUME(RParen);
          return e;
        },
      },
      { ALT: () => ({ kind: 'term', text: this.CONSUME(Phrase).image.slice(1, -1).replace(/\\(.)/g, '$1') }) as SearchExpr },
      { ALT: () => ({ kind: 'term', text: this.CONSUME(Word).image }) as SearchExpr },
    ]),
  );
}

let parser: SearchParser | undefined;

/** Parses $search. Returns undefined for an empty search. */
export function parseSearch(text: string, option = '$search'): SearchExpr | undefined {
  if (!text.trim()) return undefined;
  const lexed = SearchLexer.tokenize(text);
  if (lexed.errors.length) throw badRequest('InvalidSearch', `${option}: unexpected character at position ${lexed.errors[0]!.offset + 1}.`);
  parser ??= new SearchParser();
  parser.input = lexed.tokens;
  const result = parser.search();
  if (parser.errors.length) throw badRequest('InvalidSearch', `${option}: ${parser.errors[0]!.message}`);
  return result;
}
