/**
 * Grand totals and group subtotals of a table (docs/23): requested from the service with $apply for the current
 * filters and search, never added up from the loaded rows. As in Fiori elements (D39), the unit is aggregated with the
 * measure; a total over several currencies shows "Show Details", which lists the amounts per currency.
 */
import { Anchor, Loader, Popover, Text } from '@mantine/core';
import {
  buildTotalsRequest, collectTotals, formatValue, groupKey, MAX_GROUP_VALUES, resolvePath, sourceInfo, type FilterState, type QuerySource,
  type TotalAmount, type TotalsEntry,
} from '@rhfan2019/smart-kit-core';
import { useQueries, useQuery } from '@tanstack/react-query';
import { useMemo, useRef, useState } from 'react';
import { useService, useSmartKit, useText } from '../context/SmartKitProvider';

/** Totals are reloaded through `revision` (refresh, actions, edits); remounts within this time reuse them. */
const TOTALS_STALE_TIME = 60_000;

export interface TotalsQueryOptions {
  service?: string;
  source: QuerySource;
  filters?: FilterState;
  search?: string;
  /** Properties to sum. */
  measures: string[];
  enabled: boolean;
  /** Change to reload. */
  revision?: number;
}

export interface GrandTotals {
  entry?: TotalsEntry;
  error: Error | null;
  loading: boolean;
}

/** Grand totals: one amount per currency or unit for each measure. */
export function useGrandTotals(o: TotalsQueryOptions): GrandTotals {
  const service = useService(o.service);
  const { namespace, timeZone } = useSmartKit();
  const model = service.model;
  const req = useMemo(
    () => buildTotalsRequest(model, { source: o.source, filters: o.filters, search: o.search, measures: o.measures, timeZone }),
    [model, o.source, JSON.stringify(o.filters), o.search, o.measures.join('|'), timeZone], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const q = useQuery({
    queryKey: ['smart-kit', namespace, service.name, 'totals', JSON.stringify(req), o.revision ?? 0],
    enabled: o.enabled && o.measures.length > 0,
    staleTime: TOTALS_STALE_TIME,
    queryFn: ({ signal }) => service.dataProvider.query(req, { signal }),
  });
  const entry = useMemo(
    () => (q.data ? collectTotals(model, { source: o.source, measures: o.measures }, q.data.rows).get('') ?? { values: {} } : undefined),
    [q.data], // eslint-disable-line react-hooks/exhaustive-deps
  );
  return { entry, error: (q.error as Error | null) ?? null, loading: q.isFetching };
}

export interface SubtotalsQueryOptions extends TotalsQueryOptions {
  /** Group property. */
  groupBy: string;
  /** Group values present in the loaded rows, in order of appearance. */
  groupValues: unknown[];
}

export interface Subtotals {
  /** Subtotal and count of a group value (undefined while loading). */
  get(value: unknown): TotalsEntry | undefined;
  error: Error | null;
  loading: boolean;
  /** Changes when new subtotals arrived. */
  version: string;
}

/**
 * Subtotals and counts of the groups seen so far. Groups are requested in batches of at most MAX_GROUP_VALUES values;
 * loading more rows only requests the groups not asked for yet, so the subtotals already shown stay.
 */
export function useSubtotals(o: SubtotalsQueryOptions): Subtotals {
  const service = useService(o.service);
  const { namespace, timeZone } = useSmartKit();
  const model = service.model;
  const identity = JSON.stringify([o.groupBy, o.filters ?? {}, o.search ?? '', o.measures, o.revision ?? 0]);
  const batches = useRef<{ identity: string; chunks: unknown[][] }>({ identity, chunks: [] });
  if (batches.current.identity !== identity) batches.current = { identity, chunks: [] };
  const asked = new Set(batches.current.chunks.flat().map(groupKey));
  const fresh = o.groupValues.filter((v) => !asked.has(groupKey(v)));
  for (let i = 0; i < fresh.length; i += MAX_GROUP_VALUES) batches.current.chunks.push(fresh.slice(i, i + MAX_GROUP_VALUES));
  const chunks = batches.current.chunks;
  const results = useQueries({
    queries: chunks.map((values) => {
      const req = buildTotalsRequest(model, { source: o.source, filters: o.filters, search: o.search, measures: o.measures, groupBy: o.groupBy, groupValues: values, timeZone });
      return {
        queryKey: ['smart-kit', namespace, service.name, 'subtotals', JSON.stringify(req), o.revision ?? 0],
        enabled: o.enabled,
        staleTime: TOTALS_STALE_TIME,
        queryFn: ({ signal }: { signal: AbortSignal }) => service.dataProvider.query(req, { signal }),
      };
    }),
  });
  const dataKey = results.map((r) => r.dataUpdatedAt).join('|');
  const map = useMemo(() => {
    const out = new Map<string, TotalsEntry>();
    for (const r of results) {
      if (!r.data) continue;
      for (const [k, e] of collectTotals(model, { source: o.source, measures: o.measures, groupBy: o.groupBy }, r.data.rows)) out.set(k, e);
    }
    return out;
  }, [dataKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const error = (results.find((r) => r.error)?.error as Error | undefined) ?? null;
  return {
    get: (value) => {
      const e = map.get(groupKey(value));
      // A group the service did not return has no rows for the current filters (it changed meanwhile): count 0.
      if (!e && results.length && results.every((r) => r.data)) return { group: value, count: 0, values: {} };
      return e;
    },
    error,
    loading: results.some((r) => r.isFetching),
    version: dataKey,
  };
}

/** Formats a total of `path`: one line per currency or unit ("1,234.56 EUR"). */
export function useTotalFormatter(service: string | undefined, source: QuerySource) {
  const s = useService(service);
  const { intlLocale } = useSmartKit();
  const model = s.model;
  const typeName = sourceInfo(model, source).typeName;
  return (path: string, amounts: TotalAmount[] | undefined): string[] => {
    const prop = resolvePath(model.entityTypes, typeName, path).property;
    if (!prop || !amounts?.length) return [];
    return amounts.filter((a) => !a.multiUnit).map((a) => {
      // Sums of binary floats: drop the noise beyond the precision of the property before formatting.
      const v = formatValue(Math.round(a.value * 1e6) / 1e6, prop, { locale: intlLocale, unitCode: a.unit });
      return a.unit ? `${v} ${a.unit}` : v;
    });
  };
}

/** Amounts of a total, one line each. */
export function TotalLines({ lines, path }: { lines: string[]; path?: string }) {
  if (!lines.length) return null;
  return (
    <span className="sk-total" data-sk-total={path}>
      {lines.map((l, i) => <span key={i} className="sk-total__line">{l}</span>)}
    </span>
  );
}

/** What a "Show Details" popover requests: the total (or one group's subtotal) of `path` per unit. */
export interface UnitDetailsQuery {
  service?: string;
  source: QuerySource;
  filters?: FilterState;
  search?: string;
  path: string;
  /** Subtotal: the group property and value (FE: the filter of the group's context). */
  groupBy?: string;
  groupValue?: unknown;
  revision?: number;
}

/**
 * A total over several units (FE `getMultiCurrencyLink`, sap.fe.macros M_TABLE_SHOW_DETAILS): the link "Show Details"
 * opens a popover titled "Totals" / "Subtotals" (sap.m.table.Util createOrUpdateMultiUnitPopover) with one line per
 * unit, requested when it opens (`groupby((Currency),aggregate(NetAmount))&$orderby=Currency`).
 */
export function MultiUnitTotal({ query }: { query: UnitDetailsQuery }) {
  const t = useText();
  const [opened, setOpened] = useState(false);
  const service = useService(query.service);
  const { namespace, timeZone } = useSmartKit();
  const format = useTotalFormatter(query.service, query.source);
  const model = service.model;
  const grand = query.groupBy === undefined;
  const req = useMemo(
    () => buildTotalsRequest(model, {
      source: query.source, filters: query.filters, search: query.search, measures: [query.path], timeZone, byUnit: true,
      ...(grand ? {} : { groupBy: query.groupBy, groupValues: [query.groupValue ?? null] }),
    }),
    [model, query.source, JSON.stringify(query.filters), query.search, query.path, query.groupBy, JSON.stringify(query.groupValue), timeZone], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const q = useQuery({
    queryKey: ['smart-kit', namespace, service.name, 'total-units', JSON.stringify(req), query.revision ?? 0],
    enabled: opened,
    staleTime: TOTALS_STALE_TIME,
    queryFn: ({ signal }) => service.dataProvider.query(req, { signal }),
  });
  const lines = q.data ? format(query.path, collectTotals(model, { source: query.source, measures: [query.path], byUnit: true }, q.data.rows).get('')?.values[query.path]) : [];
  const title = grand ? t('table.multiTotalTitle') : t('table.multiGroupTitle');
  return (
    <span className="sk-total" data-sk-total={query.path} data-sk-total-multi-unit>
      <Popover opened={opened} onChange={setOpened} position={grand ? 'top' : 'bottom'} withArrow shadow="md" withinPortal trapFocus returnFocus>
        <Popover.Target>
          <Anchor component="button" type="button" size="sm" className="sk-total__details" onClick={(e) => { e.stopPropagation(); setOpened((o) => !o); }} data-sk-total-details>
            {t('table.multiUnitDetails')}
          </Anchor>
        </Popover.Target>
        <Popover.Dropdown aria-label={title} data-sk-total-units>
          <Text fw={700} size="sm" mb={4}>{title}</Text>
          {q.isFetching && !q.data ? <Loader size="xs" /> : q.error ? <Text size="sm" c="dimmed">–</Text> : (
            <span className="sk-total">{lines.map((l, i) => <span key={i} className="sk-total__line" data-sk-total-unit-line>{l}</span>)}</span>
          )}
        </Popover.Dropdown>
      </Popover>
    </span>
  );
}

