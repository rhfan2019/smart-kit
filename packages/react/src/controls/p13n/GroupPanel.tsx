/**
 * sap.m.p13n.GroupPanel (1.154): group criteria as query rows (QueryPanel), each with the field and, with
 * `enableShowField`, a "Show Field as Column" check box. The state is an array of sap.m.p13n.GroupItem (`p13nData`).
 */
import { Checkbox } from '@mantine/core';
import type { ReactNode, Ref } from 'react';
import { PANEL_TITLES, useP13nText, type BasePanel$ChangeEvent, type BasePanelMethods, type GroupItem } from './base';
import { QueryRows } from './QueryPanel';

/** GroupPanel `change` event (sap.m.p13n.BasePanel `change`). */
export type GroupPanel$ChangeEvent = BasePanel$ChangeEvent<GroupItem>;

export interface $GroupPanelSettings {
  /** A short text describing the panel (the tab text in a Popup). Default: the localized text "Group" (p13n.DEFAULT_TITLE_GROUP). @defaultValue ...see text or source */
  title?: string;
  /** Shows a check box per row whether the grouped field stays visible (GroupItem.showIfGrouped). @defaultValue false */
  enableShowField?: boolean;
  /** Whether the group criteria can be reordered (move buttons). @defaultValue true */
  enableReorder?: boolean;
  /** The maximum number of group criteria; -1: no limit. @defaultValue -1 */
  queryLimit?: number;
  /** A message strip shown above the rows (BasePanel `messageStrip`, a sap.m.MessageStrip element). */
  messageStrip?: ReactNode;
  /** The personalization state shown (BasePanel.setP13nData): the grouped items first, in group order. A new array starts the panel again. */
  p13nData?: GroupItem[];
  /** Fired when the user changes the state (BasePanel `change`; reason "showifgrouped" for the check box). */
  onChange?: (e: GroupPanel$ChangeEvent) => void;
  ref?: Ref<GroupPanel>;
}

/** Instance methods of GroupPanel (sap.m.p13n.BasePanel). */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- the instance type merged with the component (ADR-033)
export interface GroupPanel extends BasePanelMethods<GroupItem> {}

export function GroupPanel({ enableShowField = false, enableReorder = true, queryLimit = -1, messageStrip, p13nData, onChange, ref }: $GroupPanelSettings) {
  const t = useP13nText();
  return (
    <QueryRows<GroupItem>
      presence="grouped" enableReorder={enableReorder} queryLimit={queryLimit} placeholder={t('ctl.p13n.groupPlaceholder')} removeText={t('ctl.p13n.groupRemove')}
      messageStrip={messageStrip} p13nData={p13nData} onChange={onChange} panelRef={ref} fieldAttr="data-sk-p13n-group" className="sk-p13n-group"
      extra={enableShowField ? (item, update) => (
        <Checkbox
          disabled={!item} checked={item?.showIfGrouped ?? true} label={t('ctl.p13n.groupShowField')}
          onChange={(e) => update({ showIfGrouped: e.currentTarget.checked }, 'showifgrouped')} data-sk-p13n-show-field
        />
      ) : undefined}
    />
  );
}
PANEL_TITLES.set(GroupPanel as never, 'ctl.p13n.titleGroup');
