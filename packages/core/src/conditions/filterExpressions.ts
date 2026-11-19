/**
 * Capabilities.FilterExpressionRestrictions (ANN-40, P2-LR-19): which conditions a filter field allows, as SAP Fiori
 * elements 1.154 decides it.
 * - Several records for one property: the strictest wins, in the order SingleValue, MultiValue, SingleRange,
 *   MultiRange, SearchExpression, MultiRangeOrSearchExpression (sap.fe.core.converters.controls.ListReport.FilterField
 *   getSpecificAllowedExpression, CommonUtils.AllowedExpressionsPrio).
 * - The operators per expression are those of sap.fe.macros.CommonHelper getOperatorsForProperty, intersected with
 *   the operators of the type (sap.ui.mdc FilterOperatorUtil); without a restriction the type's operators apply,
 *   except on date fields: FE FieldHelper.operators gives them getOperatorsForDateProperty (basic operators and
 *   Empty, no semantic dates). Restricted date fields use FE's semantic date operators (manifest
 *   `useSemanticDateRange`, default true).
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

/**
 * One entry of a filter field's `settings.operatorConfiguration` (FE OperatorConfiguration): includes or excludes the
 * semantic date operators whose `key` (e.g. "TODAY") or `category` (e.g. "FIXED.DATE", "DYNAMIC.DATE.INT") equals one
 * of the comma-separated `equals` values or contains one of the `contains` values.
 */
export interface OperatorConfiguration {
  /** "key" or "category". */
  path: string;
  equals?: string;
  contains?: string;
  exclude?: boolean;
}

/** Filter bar options that change the operators of the fields (FE `useSemanticDateRange`, filter field `settings`). */
export interface FilterOperatorOptions {
  /** FE `useSemanticDateRange` (default true): false leaves date fields without semantic date operators. */
  semanticDates?: boolean;
  /** The field's `settings.operatorConfiguration`. */
  operatorConfiguration?: OperatorConfiguration[];
}

/** FE DefaultSemanticDateOperators.getOperatorsInfo / ExtendedSemanticDateOperators.getOperatorsInfo: key → category. */
function semanticOperatorsInfo(type?: EdmType): [string, string][] {
  const unit: Record<string, string> = { DAYS: 'DYNAMIC.DATE.INT', WEEKS: 'DYNAMIC.WEEK.INT', MONTHS: 'DYNAMIC.MONTH.INT', QUARTERS: 'DYNAMIC.QUARTER.INT', YEARS: 'DYNAMIC.YEAR.INT' };
  const units = Object.keys(unit);
  const info: [string, string][] = [
    ['YESTERDAY', 'FIXED.DATE'], ['TODAY', 'FIXED.DATE'], ['TOMORROW', 'FIXED.DATE'],
    ['DATE', 'DYNAMIC.DATE'], ['FROM', 'DYNAMIC.DATE'], ['TO', 'DYNAMIC.DATE'], ['DATERANGE', 'DYNAMIC.DATERANGE'],
    ['SPECIFICMONTH', 'DYNAMIC.MONTH'], ['TODAYFROMTO', 'DYNAMIC.DATE.INT'],
    ...['THISWEEK', 'LASTWEEK', 'NEXTWEEK'].map((k): [string, string] => [k, 'FIXED.WEEK']),
    ...['THISMONTH', 'LASTMONTH', 'NEXTMONTH'].map((k): [string, string] => [k, 'FIXED.MONTH']),
    ...['THISQUARTER', 'LASTQUARTER', 'NEXTQUARTER', 'QUARTER1', 'QUARTER2', 'QUARTER3', 'QUARTER4'].map((k): [string, string] => [k, 'FIXED.QUARTER']),
    ...['THISYEAR', 'LASTYEAR', 'NEXTYEAR', 'YEARTODATE', 'DATETOYEAR'].map((k): [string, string] => [k, 'FIXED.YEAR']),
    ...['LAST', 'NEXT'].flatMap((d) => units.map((u): [string, string] => [`${d}${u}`, unit[u]!])),
    ...['LAST', 'NEXT'].flatMap((d) => units.map((u): [string, string] => [`${d}${u}INCLUDED`, unit[u]!])),
  ];
  if (type === 'Edm.DateTimeOffset') info.push(['EQ', 'DYNAMIC.DATE'], ['BT', 'DYNAMIC.DATERANGE']);
  return [...info, ...EXTENDED.map((k): [string, string] => [k, 'DYNAMIC.DATE'])];
}

/** ExtendedSemanticDateOperators: FROM<op> / TO<op> of the fixed single days. */
const EXTENDED: string[] = [...FIXED_DAY_OPERATORS.map((o) => `FROM${o}`), ...FIXED_DAY_OPERATORS.map((o) => `TO${o}`)];
const LAST_NEXT = new Set(['LASTDAYS', 'LASTWEEKS', 'LASTMONTHS', 'LASTQUARTERS', 'LASTYEARS', 'NEXTDAYS', 'NEXTWEEKS', 'NEXTMONTHS', 'NEXTQUARTERS', 'NEXTYEARS']);

/**
 * FE SemanticDateOperators _filterOperation: the first configuration that matches decides; an excluded LAST<unit> /
 * NEXT<unit> also excludes its INCLUDED variant; the extended operators are excluded unless a configuration includes them.
 */
function semanticOperationAllowed(key: string, category: string, configs: OperatorConfiguration[]): boolean {
  const extended = EXTENDED.includes(key);
  let result: boolean | undefined;
  const found = configs.some((c) => {
    if (!c.path) return false;
    const value = c.path === 'key' ? key : c.path === 'category' ? category : undefined;
    if (!value) return false;
    const exclude = c.exclude ?? extended;
    const includedBase = (list: string[]) => exclude && value.endsWith('INCLUDED') && LAST_NEXT.has(value.replace('INCLUDED', '')) && list.includes(value.replace('INCLUDED', ''));
    for (const [list, hit] of [[c.contains, (v: string) => value.includes(v)], [c.equals, (v: string) => value === v]] as const) {
      if (!list) continue;
      const values = list.split(',');
      if (includedBase(values)) { result = false; return true; }
      for (const v of values) if (hit(v)) { result = !exclude; return true; }
    }
    return false;
  });
  return found ? result! : !extended;
}

/** FE SemanticDateOperators.getFilterOperations: the semantic date operators kept by an operator configuration. */
function configuredSemanticOperators(configs: OperatorConfiguration[], type?: EdmType): string[] {
  return semanticOperatorsInfo(type).filter(([k, c]) => semanticOperationAllowed(k, c, configs)).map(([k]) => k);
}

/** FE CommonHelper _isOperatorExcludedByManifest: a `key` configuration that excludes the operator. */
function excludedByKey(op: string, configs: OperatorConfiguration[] | undefined): boolean {
  return (configs ?? []).some((c) => c.path === 'key' && c.exclude === true && (c.equals ? c.equals.split(',').some((v) => v.trim() === op) : c.contains ? c.contains.split(',').some((v) => op.includes(v.trim())) : false));
}

/** The operators of a type (sap.ui.mdc FilterOperatorUtil.getOperatorsForType), in mdc names. */
function typeOperators(type?: EdmType): string[] {
  if (type === 'Edm.Boolean') return ['EQ', 'NE'];
  if (type === 'Edm.Guid') return ['EQ', 'NE'];
  if (isDate(type)) return [...DATE_BASIC, ...MDC_DATE_OPERATORS];
  if (type === undefined || type === 'Edm.String') return STRING;
  return NUMERIC;
}

/**
 * FE FieldHelper.operators: getOperatorsForProperty returns nothing for a field without a restriction, so a date
 * field falls back to CommonHelper.getOperatorsForDateProperty — the type's basic operators and Empty, without any
 * semantic or relative date operator, whatever `useSemanticDateRange` or `operatorConfiguration` say. Other types
 * keep the type's operators (undefined).
 */
function unrestrictedDateOperators(type?: EdmType): string[] | undefined {
  return isDate(type) ? typeOperators(type).filter((x) => [...RANGE_OPS, 'Empty'].includes(x)) : undefined;
}

/**
 * FE CommonHelper.getOperatorsForProperty with `useSemanticDateRange` false (or an operator configuration), and
 * FieldHelper.operators: an unrestricted date field gets getOperatorsForDateProperty (the type's basic operators and Empty).
 */
function configuredOperators(expression: FilterExpression | undefined, type: EdmType | undefined, o: FilterOperatorOptions): string[] | undefined {
  const semantic = o.semanticDates !== false;
  const configs = o.operatorConfiguration?.length ? o.operatorConfiguration : undefined;
  const semanticOps = configs ? configuredSemanticOperators(configs, type) : SEMANTIC_RANGE;
  const supported = isDate(type) && semantic ? [...SEMANTIC_RANGE, ...typeOperators(type), 'DATE', 'FROM', 'TO', 'DATERANGE'] : typeOperators(type);
  const restrict = (ops: string[]) => supported.filter((x, i) => ops.includes(x) && supported.indexOf(x) === i);
  const emptyOps = isDate(type) && semantic && !excludedByKey('Empty', configs) ? ['Empty'] : [];
  switch (expression) {
    case 'SingleValue': return restrict(type === 'Edm.Date' && semantic ? SEMANTIC_SINGLE.filter((x) => !excludedByKey(x, configs)) : ['EQ']);
    case 'MultiValue': return restrict(['EQ', 'Empty', 'NotEmpty']);
    case 'SingleRange':
      if (semantic && isDate(type)) return restrict([...semanticOps, ...emptyOps]);
      if (type === 'Edm.DateTimeOffset') return restrict(['EQ', 'BT', ...emptyOps]);
      if (type === 'Edm.Date') return restrict([...RANGE_OPS, ...emptyOps]);
      return restrict(RANGE_OPS);
    case 'MultiRange': return restrict(isDate(type) ? [...RANGE_OPS, ...emptyOps] : RANGE_OPS);
    case 'SearchExpression': return restrict(SEARCH_OPS);
    case 'MultiRangeOrSearchExpression': return restrict([...SEARCH_OPS, ...RANGE_OPS]);
    default: return unrestrictedDateOperators(type);
  }
}

/** The operators FE allows for an expression on a type (getOperatorsForProperty), in mdc names; undefined = the type's. */
function expressionOperators(expression: FilterExpression | undefined, type?: EdmType, o?: FilterOperatorOptions): string[] | undefined {
  if (o && (o.semanticDates === false || o.operatorConfiguration?.length)) return configuredOperators(expression, type, o);
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
    default: return unrestrictedDateOperators(type);
  }
}

/**
 * The rules of a filter field. Without `type` the type is not known (e.g. a request built from a filter state only):
 * then the expression's operators are taken for a string or date property, whichever allows more.
 */
export function filterExpressionRules(expression: FilterExpression | undefined, type?: EdmType, options?: FilterOperatorOptions): FilterExpressionRules {
  let mdc = expressionOperators(expression, type, options) ?? typeOperators(type);
  // (without a restriction the date side keeps all date operators: whichever allows more)
  if (type === undefined) mdc = [...new Set([...(expressionOperators(expression, 'Edm.String') ?? STRING), ...(expression ? expressionOperators(expression, 'Edm.Date') ?? [] : typeOperators('Edm.Date'))])];
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
export function restrictConditions(expression: FilterExpression | undefined, conditions: Condition[], type?: EdmType, options?: FilterOperatorOptions): Condition[] {
  const rules = filterExpressionRules(expression, type, options);
  const allowed = conditions.filter((c) => conditionAllowed(rules, c));
  return rules.max !== undefined && allowed.length > rules.max ? allowed.slice(allowed.length - rules.max) : allowed;
}
