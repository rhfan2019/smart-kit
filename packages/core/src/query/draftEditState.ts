/**
 * Editing status of a draft-enabled list (sap.fe.macros.filterBar.DraftEditState, SAPUI5 1.154): the options of the
 * "Editing Status" filter field and the filter each one adds to the list request. The filter field's condition is
 * kept in the filter state under the key `$editState` (FE's property key), with the option id as its only value.
 */
import type { FilterState } from '../conditions/conditions';
import type { Row } from './request';

/** Filter state key of the editing status (FE `$editState`). */
export const EDIT_STATE = '$editState';

/**
 * Option ids as in FE `EDITSTATE` (non-collaborative draft): "" = All, then All (Hiding Drafts), Unchanged,
 * Own Draft, Locked by Another User, Unsaved Changes by Another User.
 */
export const DRAFT_EDIT_STATES = ['', 'ALL_HIDING_DRAFTS', 'UNCHANGED', 'OWN_DRAFT', 'LOCKED', 'UNSAVED_CHANGES'] as const;
export type DraftEditState = (typeof DRAFT_EDIT_STATES)[number];

/** The editing status of a filter state ("" = All when none is set or the value is unknown). */
export function editStateOf(filters: FilterState | undefined): DraftEditState {
  const v = String(filters?.[EDIT_STATE]?.[0]?.values[0] ?? '');
  return (DRAFT_EDIT_STATES as readonly string[]).includes(v) ? (v as DraftEditState) : '';
}

const SIBLING_NULL = 'SiblingEntity/IsActiveEntity eq null';
const IN_PROCESS = 'DraftAdministrativeData/InProcessByUser';

/**
 * The `$filter` part of an editing status, written as the SAPUI5 V4 model writes FE's filter
 * (`DraftEditState.getFilterForEditState`; ODataListBinding `fetchFilter`: an "or" inside an "and" is wrapped in
 * parentheses, an "and" inside an "and" is not). `withinAnd`: other conditions are combined with it.
 */
export function editStateFilter(state: DraftEditState, withinAnd: boolean): string {
  switch (state) {
    case 'UNCHANGED':
      return 'IsActiveEntity eq true and HasDraftEntity eq false';
    case 'OWN_DRAFT':
      return 'IsActiveEntity eq false';
    case 'LOCKED':
      return `IsActiveEntity eq true and ${SIBLING_NULL} and ${IN_PROCESS} ne '' and ${IN_PROCESS} ne null`;
    case 'UNSAVED_CHANGES':
      return `IsActiveEntity eq true and ${SIBLING_NULL} and ${IN_PROCESS} eq ''`;
    case 'ALL_HIDING_DRAFTS':
      return 'IsActiveEntity eq true';
    default: {
      const all = `IsActiveEntity eq false or ${SIBLING_NULL}`;
      return withinAnd ? `(${all})` : all;
    }
  }
}

/**
 * In-memory evaluation of an editing status (MemoryProvider). `sibling` returns the other version of the row (the
 * own draft of an active instance, the active instance of a draft), as the service's `SiblingEntity` navigation does.
 */
export function matchesEditState(state: DraftEditState, row: Row, sibling: (row: Row) => Row | undefined): boolean {
  const active = row.IsActiveEntity !== false;
  const siblingActive = (sibling(row)?.IsActiveEntity as boolean | undefined) ?? null;
  const inProcess = (row.DraftAdministrativeData as Row | null | undefined)?.InProcessByUser;
  switch (state) {
    case 'UNCHANGED':
      return active && row.HasDraftEntity === false;
    case 'OWN_DRAFT':
      return !active;
    case 'LOCKED':
      return active && siblingActive === null && inProcess !== '' && inProcess !== null && inProcess !== undefined;
    case 'UNSAVED_CHANGES':
      return active && siblingActive === null && inProcess === '';
    case 'ALL_HIDING_DRAFTS':
      return active;
    default:
      return !active || siblingActive === null;
  }
}
