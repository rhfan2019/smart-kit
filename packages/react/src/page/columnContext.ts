/** Context a FlexibleColumnLayout column gives to the DynamicPage inside it (ADR-022, DP Header Title (3), (6)). */
import { createContext, useContext, type ReactNode } from 'react';

export interface ColumnContextValue {
  /** Layout actions (close, full screen, exit full screen) and paging buttons, shown at the very right of the title bar. */
  layoutActions?: ReactNode;
  /** Breadcrumbs are only shown in full screen mode with one column (DP Header Title (3)). */
  showBreadcrumbs: boolean;
  /** Column index (0 begin, 1 mid, 2 end). */
  column: number;
}

export const ColumnContext = createContext<ColumnContextValue | null>(null);

export function useColumn(): ColumnContextValue | null {
  return useContext(ColumnContext);
}
