/**
 * Context a FlexibleColumnLayout column gives to its content (ADR-022, DP Header Title (3), (6)): FlexibleColumnLayoutActions
 * and Paginator in the title's navigationActions read it, DynamicPageTitle hides its breadcrumbs.
 */
import { createContext, useContext } from 'react';

/** sap.f.LayoutType: the column layouts of a FlexibleColumnLayout. */
export type LayoutType =
  | 'OneColumn' // 100
  | 'TwoColumnsBeginExpanded' // 67 / 33
  | 'TwoColumnsMidExpanded' // 33 / 67
  | 'ThreeColumnsMidExpanded' // 25 / 50 / 25
  | 'ThreeColumnsEndExpanded' // 25 / 25 / 50
  | 'ThreeColumnsMidExpandedEndHidden' // 33 / 67 / 0
  | 'ThreeColumnsBeginExpandedEndHidden' // 67 / 33 / 0
  | 'MidColumnFullScreen'
  | 'EndColumnFullScreen';
export const LayoutType = {
  OneColumn: 'OneColumn', TwoColumnsBeginExpanded: 'TwoColumnsBeginExpanded', TwoColumnsMidExpanded: 'TwoColumnsMidExpanded',
  ThreeColumnsMidExpanded: 'ThreeColumnsMidExpanded', ThreeColumnsEndExpanded: 'ThreeColumnsEndExpanded',
  ThreeColumnsMidExpandedEndHidden: 'ThreeColumnsMidExpandedEndHidden', ThreeColumnsBeginExpandedEndHidden: 'ThreeColumnsBeginExpandedEndHidden',
  MidColumnFullScreen: 'MidColumnFullScreen', EndColumnFullScreen: 'EndColumnFullScreen',
} as const;

/** Previous / next object of a column (the host's list), shown by Paginator. */
export interface ColumnPaging {
  onPrevious?(): void;
  onNext?(): void;
}

export interface ColumnContextValue {
  /** Column index (0 begin, 1 mid, 2 end). */
  column: number;
  /** The current layout. */
  layout: LayoutType;
  /** Breadcrumbs are only shown in full screen mode with one column (DP Header Title (3)). */
  showBreadcrumbs: boolean;
  /** Layout actions of the mid and end column (FlexibleColumnLayoutActions): the layout to switch to. */
  fullScreen?: { active: boolean; toggle(): void };
  /** Closes the column (the layout without it). */
  close?(): void;
  /** Paging of the column (Paginator), given by the host. */
  paging?: ColumnPaging;
}

export const ColumnContext = createContext<ColumnContextValue | null>(null);

export function useColumn(): ColumnContextValue | null {
  return useContext(ColumnContext);
}
