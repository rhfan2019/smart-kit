/** Filter information shown in the collapsed header (LR-03). */
import { activeFilterPaths, type FilterState } from '@rhfan2019/smart-kit-core';
import { useText } from '../context/SmartKitProvider';
import { useFieldLabel } from './ConditionInput';

export const SUMMARY_MAX_FIELDS = 5;

export function filterSummaryText(t: ReturnType<typeof useText>, labels: string[]): string {
  if (labels.length === 0) return t('summary.none');
  const shown = labels.slice(0, SUMMARY_MAX_FIELDS).join(', ') + (labels.length > SUMMARY_MAX_FIELDS ? ', …' : '');
  return labels.length === 1 ? t('summary.one', { fields: shown }) : t('summary.other', { count: labels.length, fields: shown });
}

export interface FilterSummaryProps {
  /** Entity set name as in `$metadata`, e.g. "Orders". */
  entitySet: string;
  /** Name of the service in `SmartKitProvider` `services`; default: the provider's `defaultService`. */
  service?: string;
  /** Filter state (from `useFilterState` / `FilterBar`), applied to the request. */
  filters: FilterState;
  /** Search term ($search). */
  search?: string;
  searchLabel?: string;
}

export function FilterSummary(p: FilterSummaryProps) {
  const t = useText();
  const label = useFieldLabel(p.entitySet, p.service);
  const labels = [...(p.search ? [p.searchLabel ?? t('filterBar.search')] : []), ...activeFilterPaths(p.filters).map(label)];
  return <span className="sk-filter-summary">{filterSummaryText(t, labels)}</span>;
}
