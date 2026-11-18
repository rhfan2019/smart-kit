/**
 * Hidden filters of a table (FE `filters.hiddenFilters`, e.g. the selection variant of a list report view): conditions
 * that apply in addition to the filter bar's, combined with "and" even for the same property. They travel in the
 * filter state under the key `$hidden:<path>`, so every request built from the filter state (rows, counts, totals,
 * chart, export) includes them.
 */
import type { FilterState } from '../conditions/conditions';

const PREFIX = '$hidden:';

/** Adds `hidden` to `filters` as hidden conditions. */
export function withHiddenFilters(filters: FilterState, hidden: FilterState): FilterState {
  const out: FilterState = { ...filters };
  for (const [path, conds] of Object.entries(hidden)) if (conds.length) out[`${PREFIX}${path}`] = conds;
  return out;
}

/** The property path of a hidden filter key, else undefined. */
export function hiddenFilterPath(key: string): string | undefined {
  return key.startsWith(PREFIX) ? key.slice(PREFIX.length) : undefined;
}

/** The hidden conditions of a filter state, by property path. */
export function hiddenFiltersOf(filters: FilterState | undefined): FilterState {
  const out: FilterState = {};
  for (const [key, conds] of Object.entries(filters ?? {})) {
    const path = hiddenFilterPath(key);
    if (path) out[path] = conds;
  }
  return out;
}
