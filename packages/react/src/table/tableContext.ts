import { createContext, useContext } from 'react';
import type { FilterState, QuerySource, Row, SortItem } from '@rhfan2019/smart-kit-core';

/** What custom content in and around the table sees (AC-EXT-02, kit/useTableContext). */
export interface TableContextValue {
  entitySet: string;
  typeName: string;
  source: QuerySource;
  rows: Row[];
  selected: Row[];
  count?: number;
  filters: FilterState;
  search: string;
  sort: SortItem[];
  refresh(): void;
}

/**
 * The table's context. It lives in its own file so that kit/useTableContext does not pull in the table itself;
 * Table.tsx provides a larger internal value that extends `{ ctx }`.
 */
export const TableCtx = createContext<{ ctx: TableContextValue } | null>(null);

/** Context for custom content in and around the table (AC-EXT-02). */
export function useTableContext(): TableContextValue {
  const c = useContext(TableCtx);
  if (!c) throw new Error('Table parts must be used inside <Table> or <TreeTable>');
  return c.ctx;
}
