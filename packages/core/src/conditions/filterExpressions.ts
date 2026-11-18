/**
 * Capabilities.FilterExpressionRestrictions (ANN-40, P2-LR-19): which conditions a filter field allows, as SAP Fiori
 * elements 1.154 decides it.
 * - Several records for one property: the strictest wins, in the order SingleValue, MultiValue, SingleRange,
 *   MultiRange, SearchExpression, MultiRangeOrSearchExpression (sap.fe.core.converters.controls.ListReport.FilterField
 *   getSpecificAllowedExpression, CommonUtils.AllowedExpressionsPrio).
 * - The operators per expression are those of sap.fe.macros.CommonHelper getOperatorsForProperty, intersected with
 *   the operators of the type (sap.ui.mdc FilterOperatorUtil); without a restriction the type's operators apply.
 *   Date fields use FE's semantic date operators (manifest `useSemanticDateRange`, default true).
 * - At most one condition for SingleValue, SingleRange and Edm.Boolean (FilterFieldHelper maxConditions).
 *
 * smart-kit stores mdc's exclude operators as an include operator with `exclude: true` (NOTLT = LT excluded,
 * NotStartsWith = StartsWith excluded); NE, NB, NotContains and NotEmpty also exist as operators of their own.
 */
import type { EdmType, FilterExpression } from '../model/types';
import type { Condition, Operator } from './conditions';
import { COUNT_DATE_OPERATORS, FIXED_DAY_OPERATORS, MDC_DATE_OPERATORS, OPERATORS, RELATIVE_DATE_OPERATORS } from './conditions';

export interface FilterExpressionRules {
  /** The restriction, or undefined when the field is not restricted. */
  expression?: FilterExpression;
  /** Operators allowed as include conditions. */
  operators: readonly Operator[];
  /** Operators allowed with `exclude: true`. */
  excludeOperators: readonly Operator[];
  /** The field offers include / exclude: there are exclusions that are no operator of their own (NOTLT, NotStartsWith …). */
  exclude: boolean;
  /** Maximum number of conditions; undefined = any. */
  max?: number;
}

/** CommonUtils.AllowedExpressionsPrio */
export const ALLOWED_EXPRESSIONS_PRIORITY: readonly FilterExpression[] = ['SingleValue', 'MultiValue', 'SingleRange', 'MultiRange', 'SearchExpression', 'MultiRangeOrSearchExpression'];

/** The strictest of several allowed expressions (FE getSpecificAllowedExpression). */
export function strictestExpression(expressions: readonly FilterExpression[]): FilterExpression | undefined {
  return [...expressions].sort((a, b) => ALLOWED_EXPRESSIONS_PRIORITY.indexOf(a) - ALLOWED_EXPRESSIONS_PRIORITY.indexOf(b))[0];
}

/** mdc operator names → smart-kit operator and exclude flag. */
const MDC: Record<string, [Operator, boolean]> = {
  EQ: ['EQ', false], NE: ['NE', false], BT: ['BT', false], NOTBT: ['NB', false], LT: ['LT', false], LE: ['LE', false], GT: ['GT', false], GE: ['GE', false],
  NOTLT: ['LT', true], NOTLE: ['LE', true], NOTGT: ['GT', true], NOTGE: ['GE', true],
  Contains: ['Contains', false], NotContains: ['NotContains', false], StartsWith: ['StartsWith', false], NotStartsWith: ['StartsWith', true],
  EndsWith: ['EndsWith', false], NotEndsWith: ['EndsWith', true], Empty: ['Empty', false], NotEmpty: ['NotEmpty', false],
};
/** Exclusion forms that are the same condition as an operator of its own. */
const SAME_AS_EXCLUDED: Partial<Record<Operator, Operator>> = { NE: 'EQ', NB: 'BT', NotContains: 'Contains', NotEmpty: 'Empty' };

const STRING = ['Contains', 'EQ', 'BT', 'StartsWith', 'EndsWith', 'LT', 'LE', 'GT', 'GE', 'Empty', 'NotContains', 'NE', 'NOTBT', 'NotStartsWith', 'NotEndsWith', 'NOTLT', 'NOTLE', 'NOTGT', 'NOTGE', 'NotEmpty'];
const DATE_BASIC = ['EQ', 'BT', 'LT', 'LE', 'GT', 'GE', 'Empty', 'NE', 'NOTBT', 'NOTLT', 'NOTLE', 'NOTGT', 'NOTGE', 'NotEmpty'];
const NUMERIC = ['EQ', 'BT', 'LT', 'LE', 'GT', 'GE', 'NE', 'NOTBT', 'NOTLT', 'NOTLE', 'NOTGT', 'NOTGE'];
const RANGE_OPS = ['EQ', 'GE', 'LE', 'LT', 'GT', 'BT', 'NE', 'NOTBT', 'NOTLE', 'NOTLT', 'NOTGE', 'NOTGT'];
const SEARCH_OPS = ['Contains', 'NotContains', 'StartsWith', 'NotStartsWith', 'EndsWith', 'NotEndsWith'];

const isDate = (t?: EdmType) => t === 'Edm.Date' || t === 'Edm.DateTimeOffset';

/** FE DefaultSemanticDateOperators getSemanticDateOperations (Edm.DateTimeOffset adds EQ and BT) and the extended FROM<op> / TO<op>. */
const SEMANTIC_RANGE: string[] = [
  'TODAY', 'YESTERDAY', 'TOMORROW', 'DATE', 'FROM', 'TO', 'DATERANGE', 'SPECIFICMONTH', 'TODAYFROMTO', 'THISWEEK', 'LASTWEEK', 'NEXTWEEK',
  'THISMONTH', 'LASTMONTH', 'NEXTMONTH', 'THISQUARTER', 'LASTQUARTER', 'NEXTQUARTER', 'QUARTER1', 'QUARTER2', 'QUARTER3', 'QUARTER4',
  'THISYEAR', 'LASTYEAR', 'NEXTYEAR', 'YEARTODATE', 'DATETOYEAR', ...COUNT_DATE_OPERATORS,
  ...FIXED_DAY_OPERATORS.map((o) => `FROM${o}`), ...FIXED_DAY_OPERATORS.map((o) => `TO${o}`),
];
/** FE getSingleValueDateOperations: the fixed single days and DATE. */
const SEMANTIC_SINGLE: string[] = [...FIXED_DAY_OPERATORS, 'DATE'];

/** The operators of a type (sap.ui.mdc FilterOperatorUtil.getOperatorsForType), in mdc names. */
function typeOperators(type?: EdmType): string[] {
  if (type === 'Edm.Boolean') return ['EQ', 'NE'];
  if (type === 'Edm.Guid') return ['EQ', 'NE'];
  if (isDate(type)) return [...DATE_BASIC, ...MDC_DATE_OPERATORS];
  if (type === undefined || type === 'Edm.String') return STRING;
  return NUMERIC;
}

/** The operators FE allows for an expression on a type (getOperatorsForProperty), in mdc names; undefined = the type's. */
function expressionOperators(expression: FilterExpression | undefined, type?: EdmType): string[] | undefined {
  // supported: FE's basic semantic date operators, the type's and the extended ones (semantic date range on)
  const supported = isDate(type) ? [...SEMANTIC_RANGE, ...typeOperators(type), 'DATE', 'FROM', 'TO', 'DATERANGE'] : typeOperators(type);
  const restrict = (ops: string[]) => supported.filter((o, i) => ops.includes(o) && supported.indexOf(o) === i);
  const dateEmpty = isDate(type) ? ['Empty'] : [];
  switch (expression) {
    case 'SingleValue': return restrict(type === 'Edm.Date' ? SEMANTIC_SINGLE : ['EQ']);
    case 'MultiValue': return restrict(['EQ', 'Empty', 'NotEmpty']);
    case 'SingleRange':
      if (isDate(type)) return restrict([...SEMANTIC_RANGE, ...(type === 'Edm.DateTimeOffset' ? ['EQ', 'BT'] : []), ...dateEmpty]);
      return restrict(RANGE_OPS);
    case 'MultiRange': return restrict([...RANGE_OPS, ...dateEmpty]);
    case 'SearchExpression': return restrict(SEARCH_OPS);
    case 'MultiRangeOrSearchExpression': return restrict([...SEARCH_OPS, ...RANGE_OPS]);
    default: return undefined;
  }
}

/**
 * The rules of a filter field. Without `type` the type is not known (e.g. a request built from a filter state only):
 * then the expression's operators are taken for a string or date property, whichever allows more.
 */
export function filterExpressionRules(expression: FilterExpression | undefined, type?: EdmType): FilterExpressionRules {
  let mdc = expressionOperators(expression, type) ?? typeOperators(type);
  if (type === undefined) mdc = [...new Set([...(expressionOperators(expression, 'Edm.String') ?? STRING), ...(expressionOperators(expression, 'Edm.Date') ?? typeOperators('Edm.Date'))])];
  // an operator list that leaves nothing (e.g. SearchExpression on a number): the type's operators (FE: empty list = default)
  if (!mdc.length) mdc = typeOperators(type);
  const operators: Operator[] = [];
  const excludeOperators: Operator[] = [];
  // an exclusion that is not an operator of its own (NOTLT, NotStartsWith …): the field offers include / exclude
  let ownExclusions = false;
  for (const name of mdc) {
    const m = MDC[name];
    const [op, excl] = m ?? [name as Operator, false];
    if (!(OPERATORS as readonly string[]).includes(op) && !(RELATIVE_DATE_OPERATORS as readonly string[]).includes(op)) continue;
    if (excl) ownExclusions = true;
    const list = excl ? excludeOperators : operators;
    if (!list.includes(op)) list.push(op);
    const same = SAME_AS_EXCLUDED[op];
    if (!excl && same && !excludeOperators.includes(same)) excludeOperators.push(same);
  }
  // date fields: FE's DATE / DATERANGE are smart-kit's EQ / BT on a date (the date picker writes those)
  if (operators.includes('DATE') && !operators.includes('EQ')) operators.push('EQ');
  if (operators.includes('DATERANGE') && !operators.includes('BT')) operators.push('BT');
  const max = expression === 'SingleValue' || expression === 'SingleRange' || type === 'Edm.Boolean' ? 1 : undefined;
  return { expression, operators, excludeOperators, exclude: ownExclusions, max };
}

/** Whether one condition is allowed by the rules (ignoring the maximum). */
export function conditionAllowed(rules: FilterExpressionRules, c: Condition): boolean {
  return c.exclude ? rules.excludeOperators.includes(c.operator) : rules.operators.includes(c.operator);
}

/** Keeps the allowed conditions, at most `max` (the latest ones win: a new single value replaces the old one). */
export function restrictConditions(expression: FilterExpression | undefined, conditions: Condition[], type?: EdmType): Condition[] {
  const rules = filterExpressionRules(expression, type);
  const allowed = conditions.filter((c) => conditionAllowed(rules, c));
  return rules.max !== undefined && allowed.length > rules.max ? allowed.slice(allowed.length - rules.max) : allowed;
}
