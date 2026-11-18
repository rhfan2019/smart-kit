/**
 * sap.m.p13n.SortPanel (1.154): sort criteria as query rows (QueryPanel), each with the field, an ascending /
 * descending switch and the sort order text. The state is an array of sap.m.p13n.SortItem (`p13nData`).
 */
import { SegmentedControl } from '@mantine/core';
import type { ReactNode, Ref } from 'react';
import { PANEL_TITLES, useP13nText, type BasePanel$ChangeEvent, type BasePanelMethods, type SortItem } from './base';
import { QueryRows } from './QueryPanel';

/** SortPanel `change` event (sap.m.p13n.BasePanel `change`). */
export type SortPanel$ChangeEvent = BasePanel$ChangeEvent<SortItem>;

export interface $SortPanelSettings {
  /** A short text describing the panel (the tab text in a Popup). Default: the localized text "Sort" (p13n.DEFAULT_TITLE_SORT). @defaultValue ...see text or source */
  title?: string;
  /** Whether the sort criteria can be reordered (move buttons). @defaultValue true */
  enableReorder?: boolean;
  /** The maximum number of sort criteria; -1: no limit. @defaultValue -1 */
  queryLimit?: number;
  /** A message strip shown above the rows (BasePanel `messageStrip`, a sap.m.MessageStrip element). */
  messageStrip?: ReactNode;
  /** The personalization state shown (BasePanel.setP13nData): the sorted items first, in sort order. A new array starts the panel again. */
  p13nData?: SortItem[];
  /** Fired when the user changes the state (BasePanel `change`; reason "sortorder" when the order switch changes). */
  onChange?: (e: SortPanel$ChangeEvent) => void;
  ref?: Ref<SortPanel>;
}

/** Instance methods of SortPanel (sap.m.p13n.BasePanel). */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- the instance type merged with the component (ADR-033)
export interface SortPanel extends BasePanelMethods<SortItem> {}

export function SortPanel({ enableReorder = true, queryLimit = -1, messageStrip, p13nData, onChange, ref }: $SortPanelSettings) {
  const t = useP13nText();
  return (
    <QueryRows<SortItem>
      presence="sorted" enableReorder={enableReorder} queryLimit={queryLimit} placeholder={t('ctl.p13n.sortPlaceholder')} removeText={t('ctl.p13n.sortRemove')}
      messageStrip={messageStrip} p13nData={p13nData} onChange={onChange} panelRef={ref} fieldAttr="data-sk-p13n-sort-field" className="sk-p13n-sort"
      extra={(item, update) => (
        <SegmentedControl
            size="xs" disabled={!item} value={item?.descending ? 'desc' : 'asc'} aria-label={t('ctl.p13n.sortPlaceholder')}
            data={[{ value: 'asc', label: t('ctl.p13n.ascending') }, { value: 'desc', label: t('ctl.p13n.descending') }]}
          onChange={(v) => update({ descending: v === 'desc' }, 'sortorder')} data-sk-p13n-sort-order
        />
      )}
    />
  );
}
PANEL_TITLES.set(SortPanel as never, 'ctl.p13n.titleSort');
