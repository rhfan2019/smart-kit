// $filter / $search helpers around the @sap-ux/fe-mockserver-core query engine.
//
// The engine's lexer does not accept '' (escaped quote) or " inside string literals, so literal
// characters it cannot lex are replaced by private-use placeholders before the request reaches it,
// and decoded again in checkFilterValue (comparisons). Inside string functions (contains, ...)
// the placeholders cannot be decoded, so such terms only match values that contain the
// placeholder characters, i.e. none: the request still succeeds.

const ENCODE = { "'": '', '"': '', '\\': '' };
const DECODE = Object.fromEntries(Object.entries(ENCODE).map(([k, v]) => [v, k]));

/** Re-encodes the contents of every string literal of a $filter expression. */
export function encodeFilterLiterals(filter) {
  let out = '';
  let i = 0;
  while (i < filter.length) {
    const c = filter[i];
    if (c !== "'") {
      out += c;
      i++;
      continue;
    }
    // inside a literal: '' is an escaped quote, a single ' ends it
    let j = i + 1;
    let body = '';
    while (j < filter.length) {
      if (filter[j] === "'") {
        if (filter[j + 1] === "'") {
          body += ENCODE["'"];
          j += 2;
          continue;
        }
        break;
      }
      body += ENCODE[filter[j]] ?? filter[j];
      j++;
    }
    out += `'${body}'`;
    i = j + 1;
  }
  return out;
}

export const decodeLiteral = (s) => s.replace(/[-]/g, (c) => DECODE[c]);
const quote = (s) => `'${String(s).replace(/'/g, "''")}'`;

/**
 * Parses $search (terms, "phrases", AND / OR / NOT, parentheses; adjacent terms are AND) and returns an
 * equivalent $filter expression built by `term(text)`.
 */
export function searchToFilter(search, term) {
  const tokens = [];
  const re = /\s*(?:(\()|(\))|"((?:[^"\\]|\\.)*)"|([^\s()"]+))/gy;
  let m;
  while ((m = re.exec(search)) && m[0].length) {
    if (m[1]) tokens.push({ t: '(' });
    else if (m[2]) tokens.push({ t: ')' });
    else if (m[3] !== undefined) tokens.push({ t: 'term', v: m[3].replace(/\\(.)/g, '$1') });
    else if (m[4] === 'AND' || m[4] === 'OR' || m[4] === 'NOT') tokens.push({ t: m[4] });
    else tokens.push({ t: 'term', v: m[4] });
  }
  let p = 0;
  const peek = () => tokens[p];
  const orExpr = () => {
    let left = andExpr();
    while (peek()?.t === 'OR') {
      p++;
      left = `(${left} or ${andExpr()})`;
    }
    return left;
  };
  const andExpr = () => {
    let left = unary();
    while (peek() && peek().t !== 'OR' && peek().t !== ')') {
      if (peek().t === 'AND') p++;
      left = `(${left} and ${unary()})`;
    }
    return left;
  };
  const unary = () => {
    const tok = tokens[p++];
    if (!tok) throw new Error('unexpected end of $search');
    if (tok.t === 'NOT') return `not ${unary()}`;
    if (tok.t === '(') {
      const e = orExpr();
      if (tokens[p++]?.t !== ')') throw new Error('missing ) in $search');
      return `(${e})`;
    }
    if (tok.t === 'term') return term(tok.v);
    throw new Error(`unexpected ${tok.t} in $search`);
  };
  const result = orExpr();
  if (p < tokens.length) throw new Error('invalid $search');
  return result;
}

/** Filter fragment for one search term over `fields` (case-insensitive contains) plus key lists from look-ups. */
export function searchTerm(text, fields, lookups = []) {
  const lower = text.toLowerCase();
  const parts = fields.map((f) => `contains(tolower(${f}),${quote(lower)})`);
  for (const { property, keys } of lookups) {
    const hit = keys(lower);
    if (hit.length) parts.push(`${property} in (${hit.map(quote).join(',')})`);
  }
  return `(${parts.join(' or ')})`;
}

const toNumber = (v) => (typeof v === 'number' ? v : Number.parseFloat(v));
const unquote = (lit) => {
  if (typeof lit !== 'string') return lit;
  if (lit === 'null') return null;
  if (lit.startsWith("guid'")) return lit.slice(5, -1);
  if (lit.startsWith("'")) return decodeLiteral(lit.slice(1, -1));
  return lit;
};

function compare(op, a, b) {
  switch (op) {
    case 'eq': return a === b;
    case 'ne': return a !== b;
    case 'gt': return a > b;
    case 'ge': return a >= b;
    case 'lt': return a < b;
    case 'le': return a <= b;
    default: return false;
  }
}

/**
 * Replacement for the engine's checkFilterValue: OData semantics for null (x eq null, x ne null,
 * comparisons with null are false), decoded string literals and typed comparisons.
 */
export function checkFilterValue(type, mockValue, literal, operator) {
  if (operator === 'in') {
    const list = (Array.isArray(literal) ? literal : [literal]).map(unquote);
    return list.some((v) => checkFilterValue(type, mockValue, v === null ? 'null' : typeof v === 'string' && type.match(/String|Guid/) ? `'${v}'` : v, 'eq'));
  }
  const lit = unquote(literal);
  const isNull = mockValue === null || mockValue === undefined;
  if (lit === null) return operator === 'eq' ? isNull : operator === 'ne' ? !isNull : false;
  if (isNull) return operator === 'ne';
  switch (type) {
    case 'Edm.Boolean':
      return compare(operator, !!mockValue, lit === true || lit === 'true');
    case 'Edm.Byte': case 'Edm.SByte': case 'Edm.Int16': case 'Edm.Int32': case 'Edm.Int64':
    case 'Edm.Decimal': case 'Edm.Double': case 'Edm.Single':
      return compare(operator, toNumber(mockValue), toNumber(lit));
    case 'Edm.Date':
      return compare(operator, String(mockValue).slice(0, 10), String(lit).slice(0, 10));
    case 'Edm.DateTimeOffset':
      return compare(operator, new Date(mockValue).getTime(), new Date(lit).getTime());
    case 'Edm.Guid':
      return compare(operator, String(mockValue).toLowerCase(), String(lit).toLowerCase());
    default:
      return compare(operator, String(mockValue), String(lit));
  }
}
