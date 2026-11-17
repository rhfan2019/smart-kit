/** Action availability (Core.OperationAvailable), without UI: shared by the action runner and the cards. */
import type { ActionModel, Row } from '@rhfan2019/smart-kit-core';
import { getPath } from '../field/values';

/** Whether an action can be applied to a row (Core.OperationAvailable; missing means available). */
export function isActionAvailable(action: ActionModel, row: Row | undefined): boolean {
  const a = action.operationAvailable;
  if (!a) return true;
  if ('value' in a) return a.value !== false && a.value !== 'false';
  const v = getPath(row, a.path);
  return v === true || v === 'true';
}

/** Paths an action needs in $select to decide its availability. */
export function actionPaths(actions: ActionModel[]): string[] {
  return actions.flatMap((a) => (a.operationAvailable && 'path' in a.operationAvailable ? [a.operationAvailable.path] : []));
}
