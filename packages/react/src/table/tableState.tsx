/**
 * Table state as the sap.fe.macros.Table API exposes it (docs/26b): quick filters (`quickVariantSelection`, FE
 * QuickFilterSelector), the PresentationVariant form of sort, grouping, totals and columns
 * (`getPresentationVariant` / `setPresentationVariant`, FE TableAPI with StateUtil retrieveExternalState /
 * convertPVToState) and the content of a table-level variant (`variantManagement` "Control").
 */
import { SegmentedControl, Select } from '@mantine/core';
import { parseAnnotationPath, type EntityUi, type FilterState, type InitialCondition, type Operator, type QueryRequest, type SortItem, type ViewModel } from '@rhfan2019/smart-kit-core';
import { useQueries } from '@tanstack/react-query';
import { useService, useText } from '../context/SmartKitProvider';
import { presentationVariant, sortOfPresentationVariant, type PresentationVariant } from '../list/presentationVariant';

/** One quick filter (FE QuickFilter): a selection variant applied as hidden filters of the table. */
export interface QuickVariant { key: string; text: string; conditions: InitialCondition[]; view?: ViewModel }

/** The quick filters of `quickVariantSelection.paths` (UI.SelectionVariant or UI.SelectionPresentationVariant paths). */
export function quickVariantsOf(ui: EntityUi, paths: string[] | undefined): QuickVariant[] {
  return (paths ?? []).flatMap((annotationPath) => {
    const { term, qualifier } = parseAnnotationPath(annotationPath.startsWith('@') ? annotationPath : `@${annotationPath}`);
    if (term === 'SelectionPresentationVariant') {
      const v = ui.views.find((x) => x.id === qualifier);
      return v ? [{ key: annotationPath, text: v.text, conditions: v.conditions, view: v }] : [];
    }
    if (term === 'SelectionVariant') {
      const sv = ui.selectionVariants[qualifier];
      return sv ? [{ key: annotationPath, text: ui.selectionVariantTexts?.[qualifier] ?? qualifier, conditions: sv }] : [];
    }
    return [];
  });
}

/** Conditions of a selection variant as filter state. */
export function conditionsAsFilters(conditions: InitialCondition[]): FilterState {
  const out: FilterState = {};
  for (const c of conditions) (out[c.path] ??= []).push({ operator: c.operator as Operator, values: c.values, exclude: c.exclude || undefined });
  return out;
}

/** Counts of the quick filters (`showCounts`): `<set>/$count` with each variant's conditions first. */
export function useQuickCounts(o: { service?: string; enabled: boolean; variants: QuickVariant[]; request(v: QuickVariant): QueryRequest | undefined; revision: number }): Record<string, number | undefined> {
  const service = useService(o.service);
  const targets = o.enabled ? o.variants.map((v) => ({ key: v.key, req: o.request(v) })) : [];
  const results = useQueries({
    queries: targets.map((x) => ({
      queryKey: ['smart-kit', 'quick-count', service.name, JSON.stringify(x.req), o.revision],
      enabled: Boolean(x.req),
      queryFn: async ({ signal }: { signal: AbortSignal }) => (service.dataProvider.count ? service.dataProvider.count(x.req!, { signal }) : (await service.dataProvider.query({ ...x.req!, top: 0, count: true }, { signal })).count),
    })),
  });
  return Object.fromEntries(targets.map((x, i) => [x.key, results[i]?.data]));
}

/** The quick filter switch (FE QuickFilterSelector): a segmented button with ≤ 3 entries, else a select. */
export function QuickVariantSwitch(p: { variants: QuickVariant[]; value: string | undefined; counts: Record<string, number | undefined>; onChange(key: string): void }) {
  const t = useText();
  if (p.variants.length < 2) return null;
  const label = (x: QuickVariant) => { const n = p.counts[x.key]; return n === undefined ? x.text : t('table.title', { title: x.text, count: n }); };
  const data = p.variants.map((x) => ({ value: x.key, label: label(x) }));
  return p.variants.length <= 3
    ? <SegmentedControl size="xs" value={p.value} onChange={p.onChange} data={data} aria-label={t('views.label')} data-sk-view-switch="segmented" data-sk-quick-variants />
    : <Select size="xs" w={200} value={p.value} allowDeselect={false} onChange={(v) => v && p.onChange(v)} data={data} aria-label={t('views.label')} data-sk-view-switch="select" data-sk-quick-variants />;
}

/** What `getPresentationVariant` reads and `setPresentationVariant` changes. */
export interface TablePvState {
  /** Visible column ids in order. */
  columns: string[];
  sort: SortItem[];
  /** Group property paths. */
  groupBy: string[];
  /** Property paths whose totals are shown. */
  totals: string[];
  initialExpansionLevel?: number;
}

/**
 * The PresentationVariant of the table (FE TableAPI getPresentationVariant): GroupBy and SortOrder, Aggregations when
 * totals are shown, initialExpansionLevel of tree tables, and the LineItem visualization with the visible columns.
 */
export function tablePresentationVariant(s: TablePvState): PresentationVariant {
  return presentationVariant({
    GroupBy: s.groupBy,
    SortOrder: s.sort.map((x) => ({ Property: x.path, Descending: Boolean(x.descending) })),
    ...(s.totals.length ? { Aggregations: Object.fromEntries(s.totals.map((x) => [x, {}])) } : {}),
    ...(s.initialExpansionLevel ? { initialExpansionLevel: s.initialExpansionLevel } : {}),
  }, [{ Type: 'LineItem', Content: s.columns.map((Value) => ({ Value })) }]);
}

/**
 * The state a PresentationVariant sets (FE convertPVToState): what it does not mention stays; unknown columns and
 * properties are left out.
 */
export function stateOfPresentationVariant(pv: PresentationVariant, current: TablePvState, known: { columns: string[]; properties: string[] }): TablePvState {
  const out: TablePvState = { ...current };
  const sort = sortOfPresentationVariant(pv);
  if (sort) out.sort = sort.filter((x) => known.properties.includes(x.path));
  if (Array.isArray(pv.GroupBy)) out.groupBy = (pv.GroupBy as unknown[]).filter((x): x is string => typeof x === 'string' && known.properties.includes(x));
  if (pv.Aggregations && typeof pv.Aggregations === 'object') out.totals = Object.keys(pv.Aggregations as object).filter((x) => known.properties.includes(x));
  const table = pv.Visualizations?.find((v) => !v.Type?.includes('Chart'));
  if (table && Array.isArray(table.Content)) out.columns = (table.Content as { Value?: string }[]).map((x) => x?.Value).filter((x): x is string => typeof x === 'string' && known.columns.includes(x));
  if (typeof pv.initialExpansionLevel === 'number') out.initialExpansionLevel = pv.initialExpansionLevel;
  return out;
}
