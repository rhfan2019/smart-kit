/**
 * Capabilities.FilterExpressionRestrictions (ANN-40, P2-LR-19): which conditions a filter field allows.
 * The OData vocabulary defines the expressions; the operator sets below are this library's reading of them
 * (docs/05 §3.1):
 * - SingleValue: one "equal to" value
 * - MultiValue: any number of "equal to" values
 * - SingleRange: one interval or one comparison (equal to, between, less / greater than …)
 * - MultiRange (default when not restricted): any conditions, including exclusions
 * - SearchExpression: text patterns (contains, starts with, ends with)
 * - MultiRangeOrSearchExpression: like MultiRange
 */
import type { FilterExpression } from '../model/types';
import type { Condition, Operator } from './conditions';
import { OPERATORS } from './conditions';

export interface FilterExpressionRules {
  /** The restriction, or undefined when the field is not restricted. */
  expression?: FilterExpression;
  operators: readonly Operator[];
  /** Exclude conditions ("not …") allowed. */
  exclude: boolean;
  /** Maximum number of conditions; undefined = any. */
  max?: number;
}

const RANGE: Operator[] = ['EQ', 'BT', 'LT', 'LE', 'GT', 'GE'];

export function filterExpressionRules(expression: FilterExpression | undefined): FilterExpressionRules {
  switch (expression) {
    case 'SingleValue': return { expression, operators: ['EQ'], exclude: false, max: 1 };
    case 'MultiValue': return { expression, operators: ['EQ'], exclude: false };
    case 'SingleRange': return { expression, operators: RANGE, exclude: false, max: 1 };
    case 'SearchExpression': return { expression, operators: ['Contains', 'StartsWith', 'EndsWith'], exclude: false };
    default: return { expression, operators: OPERATORS, exclude: true };
  }
}

/** Whether one condition is allowed by the rules (ignoring the maximum). */
export function conditionAllowed(rules: FilterExpressionRules, c: Condition): boolean {
  return rules.operators.includes(c.operator) && (rules.exclude || !c.exclude);
}

/** Keeps the allowed conditions, at most `max` (the latest ones win: a new single value replaces the old one). */
export function restrictConditions(expression: FilterExpression | undefined, conditions: Condition[]): Condition[] {
  const rules = filterExpressionRules(expression);
  const allowed = conditions.filter((c) => conditionAllowed(rules, c));
  return rules.max !== undefined && allowed.length > rules.max ? allowed.slice(allowed.length - rules.max) : allowed;
}
