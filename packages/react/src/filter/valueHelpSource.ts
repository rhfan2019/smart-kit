/**
 * The filter bar seen from its value helps (docs/29 §4 P1-5): In / InOut parameters read the conditions of other
 * filter fields, Out / InOut parameters write the selected row's values back to them (FE ValueHelpDelegate
 * `_getInitialFilterConditionsFromFilterBar`, `_onConditionPropagationToFilterBar`).
 */
import { type Condition, type FilterState, type ValueListModel } from '@rhfan2019/smart-kit-core';
import { createContext, useContext } from 'react';
import { getPath } from '../field/values';

export interface ValueHelpSource {
  /** Current conditions of the filter bar, by property path. */
  filters: FilterState;
  /** Paths of the fields shown in the filter bar (Out parameters only write to these). */
  fields: string[];
  /** Fields that take one condition only (FilterExpressionRestrictions SingleValue / SingleRange). */
  single: (path: string) => boolean;
  setConditions(path: string, conditions: Condition[]): void;
}

export const ValueHelpSourceContext = createContext<ValueHelpSource | undefined>(undefined);

/** The surrounding filter bar, if any. */
export function useValueHelpSource(): ValueHelpSource | undefined {
  return useContext(ValueHelpSourceContext);
}

/**
 * Writes the Out and InOut parameters of selected value list rows to the other filter fields shown in the bar:
 * one "EQ" condition per row and parameter, unless the field already has it; a single-value field keeps only the new
 * conditions (FE `_onConditionPropagationToFilterBar`). The parameter of the field itself is left out.
 */
export function propagateOut(vl: ValueListModel, rows: Record<string, unknown>[], source: ValueHelpSource | undefined): void {
  if (!source || !rows.length) return;
  const own = vl.parameters.find((x) => x.valueListProperty === vl.keyProperty && x.local)?.local;
  for (const p of vl.parameters) {
    if ((p.kind !== 'Out' && p.kind !== 'InOut') || !p.local || p.local === own || !source.fields.includes(p.local)) continue;
    const single = source.single(p.local);
    const current = single ? [] : source.filters[p.local] ?? [];
    const next = [...current];
    for (const row of rows) {
      const v = getPath(row, p.valueListProperty);
      if (v === undefined || v === null) continue;
      if (!next.some((c) => c.operator === 'EQ' && !c.exclude && String(c.values[0]) === String(v))) next.push({ operator: 'EQ', values: [v] });
    }
    if (single && next.length === 0) continue;
    if (next.length !== current.length || single) source.setConditions(p.local, single ? next.slice(-1) : next);
  }
}
