/**
 * Semantic colour of a value from UI.CriticalityCalculation (docs/15 MC-09).
 *
 * Maximize: below DeviationRangeLow → negative; below ToleranceRangeLow → critical; below AcceptanceRangeLow (when given)
 * → neutral; otherwise positive. Minimize mirrors this with the High values. Target applies both sides. A missing
 * threshold is skipped.
 */
import type { Criticality, CriticalityCalculationModel, TrendCalculationModel, ValueRef } from './types';

export function calculateCriticality(
  calc: CriticalityCalculationModel,
  value: number,
  resolve: (ref: ValueRef | undefined) => number | undefined,
): Criticality | undefined {
  if (!Number.isFinite(value)) return undefined;
  const dir = calc.improvementDirection;
  const low = dir !== 'Minimize' ? side(value, resolve(calc.deviationRangeLowValue), resolve(calc.toleranceRangeLowValue), resolve(calc.acceptanceRangeLowValue), (a, b) => a < b) : 3;
  const high = dir !== 'Maximize' ? side(value, resolve(calc.deviationRangeHighValue), resolve(calc.toleranceRangeHighValue), resolve(calc.acceptanceRangeHighValue), (a, b) => a > b) : 3;
  // Worst of both sides: negative (1) < critical (2) < neutral (0) < positive (3).
  const rank: Record<Criticality, number> = { 1: 0, 2: 1, 0: 2, 5: 2, 3: 3 };
  return rank[low] <= rank[high] ? low : high;
}

function side(v: number, deviation: number | undefined, tolerance: number | undefined, acceptance: number | undefined, worse: (a: number, b: number) => boolean): Criticality {
  if (deviation !== undefined && worse(v, deviation)) return 1;
  if (tolerance !== undefined && worse(v, tolerance)) return 2;
  if (acceptance !== undefined && worse(v, acceptance)) return 0;
  return 3;
}

/**
 * Trend of a value from UI.TrendCalculation (numeric card header, docs/20): "Up" when the difference to the reference
 * reaches UpDifference (or StrongUpDifference), "Down" when it reaches DownDifference (or StrongDownDifference),
 * otherwise "None". Relative differences compare value / reference − 1.
 */
export function calculateTrend(
  calc: TrendCalculationModel,
  value: number,
  resolve: (ref: ValueRef | undefined) => number | undefined,
): 'Up' | 'Down' | 'None' {
  const ref = resolve(calc.referenceValue);
  if (!Number.isFinite(value) || ref === undefined) return 'None';
  const diff = calc.isRelative ? (ref === 0 ? Number.NaN : value / ref - 1) : value - ref;
  if (!Number.isFinite(diff)) return 'None';
  const up = resolve(calc.upDifference) ?? resolve(calc.strongUpDifference);
  const down = resolve(calc.downDifference) ?? resolve(calc.strongDownDifference);
  if (up !== undefined && diff >= up) return 'Up';
  if (down !== undefined && diff <= down) return 'Down';
  return 'None';
}
