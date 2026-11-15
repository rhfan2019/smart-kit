/** Typed conditions in filter fields ("=A", ">10", "1...5", "*pen*") and their token texts. */
import { formatValue, type Condition, type Operator, type PropertyModel } from '@rhfan2019/smart-kit-core';

const NUMERIC = /Int|Decimal|Double|Single|Byte/;

/** Parses user input into a condition. Plain text means "equal to". */
export function parseConditionText(input: string, prop: PropertyModel | undefined): Condition | undefined {
  const s = input.trim();
  if (!s) return undefined;
  const isString = !prop || prop.edmType === 'Edm.String';
  const norm = (v: string) => {
    const x = v.trim();
    if (prop && NUMERIC.test(prop.edmType)) return x.replace(/,/g, '');
    return prop?.isUpperCase ? x.toUpperCase() : x;
  };
  let m: RegExpMatchArray | null;
  if (s === '<empty>') return { operator: 'Empty', values: [] };
  if ((m = s.match(/^!\(\s*(.+?)\s*\)$/))) {
    const inner = parseConditionText(m[1]!, prop);
    return inner ? { ...inner, exclude: true } : undefined;
  }
  if ((m = s.match(/^(.+?)\.\.\.(.+)$/))) return { operator: 'BT', values: [norm(m[1]!), norm(m[2]!)] };
  if ((m = s.match(/^(>=|<=|!=|>|<|=)\s*(.+)$/))) {
    const op: Record<string, Operator> = { '>=': 'GE', '<=': 'LE', '!=': 'NE', '>': 'GT', '<': 'LT', '=': 'EQ' };
    return { operator: op[m[1]!]!, values: [norm(m[2]!)] };
  }
  if (isString && s.length > 1 && s.startsWith('*') && s.endsWith('*')) return { operator: 'Contains', values: [norm(s.slice(1, -1))] };
  if (isString && s.endsWith('*')) return { operator: 'StartsWith', values: [norm(s.slice(0, -1))] };
  if (isString && s.startsWith('*')) return { operator: 'EndsWith', values: [norm(s.slice(1))] };
  return { operator: 'EQ', values: [norm(s)] };
}

/** Token text of a condition, e.g. "Office (C1)", ">10", "!(=X)". */
export function conditionText(c: Condition, prop: PropertyModel | undefined, locale: string, timeZone?: string): string {
  const fmt = (v: unknown) => (prop ? formatValue(v, prop, { locale, timeZone }) || String(v ?? '') : String(v ?? ''));
  const [a, b] = c.values;
  let s: string;
  switch (c.operator) {
    case 'EQ': s = c.text ? `${c.text} (${fmt(a)})` : c.exclude ? `=${fmt(a)}` : fmt(a); break;
    case 'NE': s = `!=${fmt(a)}`; break;
    case 'GT': s = `>${fmt(a)}`; break;
    case 'GE': s = `>=${fmt(a)}`; break;
    case 'LT': s = `<${fmt(a)}`; break;
    case 'LE': s = `<=${fmt(a)}`; break;
    case 'BT': s = `${fmt(a)}...${fmt(b)}`; break;
    case 'NB': s = `!(${fmt(a)}...${fmt(b)})`; break;
    case 'Contains': s = `*${String(a)}*`; break;
    case 'NotContains': s = `!(*${String(a)}*)`; break;
    case 'StartsWith': s = `${String(a)}*`; break;
    case 'EndsWith': s = `*${String(a)}`; break;
    case 'Empty': s = '<empty>'; break;
    case 'NotEmpty': s = '!(<empty>)'; break;
  }
  return c.exclude ? `!(${s})` : s;
}

export function sameCondition(x: Condition, y: Condition): boolean {
  return x.operator === y.operator && Boolean(x.exclude) === Boolean(y.exclude) && JSON.stringify(x.values) === JSON.stringify(y.values);
}
