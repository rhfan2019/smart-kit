/**
 * Requests of the analytical table as Fiori elements 1.154 sends them (AL-10; core `buildAnalyticalRequests`): the
 * first block reads the grand total, the number of rows and the first rows in one `$apply` (concat); the following
 * blocks are plain list requests; the rows of the first block read the properties they lack per row once they are
 * rendered (the late properties of the OData V4 model: `Orders('…')?$select=…&$expand=…`). What only the
 * toolbar actions need (Core.OperationAvailable of an action without an inline column) is not part of these requests
 * (FE: requestAtLeast properties that are neither groupable nor aggregatable are left out of `$$aggregation`); it is
 * read for a row when the row is selected (FE ActionRuntime: `Orders('…')?$select=ApproveEnabled`).
 */
import {
  buildAnalyticalRequests, collectTotals, sourceInfo, type FieldModel, type FilterState, type QueryRequest, type QueryResult, type QuerySource, type Row,
  type SortItem, type TotalsEntry,
} from '@rhfan2019/smart-kit-core';
import type { GridApi, IRowNode } from 'ag-grid-community';
import { useMemo, useRef, useState } from 'react';
import { useService, useSmartKit } from '../context/SmartKitProvider';

export interface AnalyticalRequestsOptions {
  /** Table of type AnalyticalTable, not grouped, executed. */
  enabled: boolean;
  service?: string;
  source: QuerySource;
  columns: FieldModel[];
  filters?: FilterState;
  search?: string;
  sort?: SortItem[];
  extraSelect?: string[];
  requestAtLeast?: string[];
  /** Measures whose grand total is shown. */
  totals: string[];
  /** Further properties of the rows grouped by (custom columns' properties, the row highlight). */
  groupExtra?: string[];
  /** Read for a row when it is selected, not with the rows (OperationAvailable paths of toolbar actions). */
  selectionPaths?: string[];
  /** The leaves are aggregated by the shown properties, without the keys (AnalyticalConfiguration aggregationOnLeafLevel). */
  aggregationOnLeafLevel?: boolean;
}

export interface AnalyticalRequestsResult {
  active: boolean;
  /** Changes with the requests (rebuild the datasource). */
  key: string;
  /** Changes when rows got late properties. */
  version: number;
  /** The request of a block, or undefined when not active. */
  blockRequest(skip: number, top: number): QueryRequest | undefined;
  /** Hands over the result of a block (the first carries the grand total). */
  received(skip: number, res: QueryResult): void;
  failed(skip: number, error: Error): void;
  /** Grand total from the first block handed over with `received` (grid blocks). */
  grand: { entry?: TotalsEntry; error: Error | null; loading: boolean };
  /** Grand total of a first page result (rows loaded through useListQuery). */
  grandOf(first: QueryResult | undefined, error: Error | null, loading: boolean): { entry?: TotalsEntry; error: Error | null; loading: boolean };
  /** The rows with the late properties read so far (rows loaded through useListQuery). */
  withLate(rows: Row[]): Row[];
  /** Reads the late properties of the rendered rows of the first block; `replace` gets the old and the new row. */
  loadLate(api: GridApi | null | undefined, pathOf: (row: Row) => string, replace: (old: Row, row: Row) => void): void;
  /** Reads `selectionPaths` of selected rows that lack them. */
  loadSelected(api: GridApi | null | undefined, rows: Row[], pathOf: (row: Row) => string, replace: (old: Row, row: Row) => void): void;
}

/** Merges what a per-row read returned into the grid row; returns the merged row. */
function merge(api: GridApi, row: Row, extra: Row, replace: (old: Row, row: Row) => void): Row | undefined {
  if (api.isDestroyed()) return undefined;
  let node: IRowNode<Row> | undefined;
  api.forEachNode((n) => { if (n.data === row) node = n as IRowNode<Row>; });
  const merged: Row = { ...row };
  for (const [k, v] of Object.entries(extra)) if (k !== '@odata.context') merged[k] = v;
  node?.setData(merged);
  replace(row, merged);
  return merged;
}

/**
 * Rows of a first page that still lack their late properties, and the rows that got them (original -> merged). Keyed
 * by the row objects of the query cache, so a table mounted again over cached rows keeps or completes them.
 */
const PENDING = new WeakSet<Row>();
const LATE = new WeakMap<Row, Row>();
const MERGED = new WeakSet<Row>();

export function useAnalyticalRequests(o: AnalyticalRequestsOptions): AnalyticalRequestsResult {
  const service = useService(o.service);
  const { timeZone } = useSmartKit();
  const model = service.model;
  const notWithRows = new Set(o.selectionPaths ?? []);
  const opts = { source: o.source, columns: o.columns, filters: o.filters, search: o.search, sort: o.sort, extraSelect: o.extraSelect?.filter((x) => !notWithRows.has(x)), requestAtLeast: o.requestAtLeast, totals: o.totals, groupExtra: o.groupExtra, aggregationOnLeafLevel: o.aggregationOnLeafLevel, timeZone };
  const optsKey = JSON.stringify({ ...opts, columns: o.columns.map((c) => c.id) });
  const requests = useMemo(() => {
    if (!o.enabled) return undefined;
    return buildAnalyticalRequests(model, model.ui[sourceInfo(model, o.source).typeName]!, opts);
  }, [o.enabled, model, optsKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const key = requests ? JSON.stringify(requests.first) : '';
  const [grand, setGrand] = useState<{ key: string; entry?: TotalsEntry; error: Error | null }>({ key: '', error: null });
  const askedSelected = useRef(new WeakSet<Row>());
  const [version, setVersion] = useState(0);
  const grandOf = (res: QueryResult | undefined) => (res?.grandTotal ? collectTotals(model, { source: o.source, measures: o.totals }, [res.grandTotal]).get('') ?? { values: {} } : undefined);
  const replaceAndRemember = (replace: (old: Row, row: Row) => void) => (old: Row, row: Row) => {
    LATE.set(old, row);
    MERGED.add(row);
    replace(old, row);
    setVersion((n) => n + 1);
  };
  return {
    active: Boolean(requests),
    key,
    version,
    blockRequest: (skip, top) => (!requests ? undefined : skip === 0 ? { ...requests.first, top } : requests.page(skip, top)),
    received: (skip, res) => {
      if (!requests || skip !== 0) return;
      if (requests.late) for (const r of res.rows) if (!LATE.has(r) && !MERGED.has(r)) PENDING.add(r);
      setGrand({ key, entry: grandOf(res), error: null });
    },
    failed: (skip, error) => { if (requests && skip === 0) setGrand({ key, error }); },
    grand: { entry: grand.key === key ? grand.entry : undefined, error: grand.key === key ? grand.error : null, loading: grand.key !== key },
    grandOf: (first, error, loading) => ({ entry: grandOf(first), error, loading }),
    withLate: (rows) => (requests ? rows.map((r) => LATE.get(r) ?? r) : rows),
    loadLate: (api, pathOf, replace) => {
      const late = requests?.late;
      if (!late || !api || api.isDestroyed()) return;
      for (const node of api.getRenderedNodes() as IRowNode<Row>[]) {
        const row = node.data;
        if (!row || !PENDING.has(row)) continue;
        PENDING.delete(row);
        void service.dataProvider.read(pathOf(row), late).then((extra) => merge(api, row, extra, replaceAndRemember(replace)), () => { /* the row keeps what the first block delivered */ });
      }
    },
    loadSelected: (api, rows, pathOf, replace) => {
      const paths = [...notWithRows];
      if (!requests || !paths.length || !api || api.isDestroyed()) return;
      for (const row of rows) {
        const missing = paths.filter((x) => !x.includes('/') && row[x] === undefined);
        if (!missing.length || askedSelected.current.has(row)) continue;
        askedSelected.current.add(row);
        void service.dataProvider.read(pathOf(row), { select: missing, expand: [] }).then((extra) => merge(api, row, extra, replaceAndRemember(replace)), () => { /* the action stays unavailable */ });
      }
    },
  };
}
