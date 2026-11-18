/**
 * Personalization dialog of the table: column visibility and order, sort, grouping (LR-19, docs/12 U-5, docs/23) and
 * totals (docs/23). Built on sap.m.p13n.Popup with SelectionPanel / SortPanel / GroupPanel, as the mdc table of
 * Fiori elements; the totals are a SelectionPanel without reordering.
 */
import type { SortItem as KitSortItem } from '@rhfan2019/smart-kit-core';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useText } from '../context/SmartKitProvider';
import type { GroupItem, Item, SortItem } from '../controls/p13n/base';
import { GroupPanel } from '../controls/p13n/GroupPanel';
import { Popup } from '../controls/p13n/Popup';
import { SelectionPanel } from '../controls/p13n/SelectionPanel';
import { SortPanel } from '../controls/p13n/SortPanel';
import { MessageStrip } from '../messages/MessageStrip';

export interface TableP13nDialogProps {
  /** Whether the dialog is open (controlled). */
  opened: boolean;
  columns: { id: string; label: string }[];
  visible: string[];
  sort: KitSortItem[];
  sortable: { path: string; label: string }[];
  /** Called with the result when the user confirms. */
  onOk(visible: string[], sort: KitSortItem[], groupBy?: string | null, totals?: string[]): void;
  /** Called when the user cancels or closes the dialog. */
  onCancel(): void;
  /** Columns that can be grouped by; the "Group" tab is shown only when given. */
  groupable?: { id: string; label: string }[];
  groupBy?: string | null;
  /** Columns whose totals can be shown; the "Totals" tab is shown only when given and not empty (docs/23). */
  totalable?: { id: string; label: string }[];
  /** Column ids whose totals are shown. */
  totals?: string[];
}

const byLabel = (x: { label: string }, y: { label: string }) => x.label.localeCompare(y.label);

export function TableP13nDialog(p: TableP13nDialogProps) {
  const t = useText();
  const popup = useRef<Popup>(null);
  const columnsPanel = useRef<SelectionPanel>(null);
  const sortPanel = useRef<SortPanel>(null);
  const groupPanel = useRef<GroupPanel>(null);
  const totalsPanel = useRef<SelectionPanel>(null);
  const [round, setRound] = useState(0);
  useEffect(() => {
    if (p.opened && !popup.current?.isOpen()) { setRound((n) => n + 1); popup.current?.open(null); }
  }, [p.opened]);
  // the state of the panels, built again for each opening (sap.m.p13n.Engine sets it before Popup.open)
  const data = useMemo(() => {
    const label = (id: string) => p.columns.find((c) => c.id === id)?.label ?? id;
    // sap.m.p13n.SelectionPanel: the shown columns in their order, then the others alphabetically by label
    const columns: Item[] = [
      ...p.visible.map((id) => ({ name: id, label: label(id), visible: true })),
      ...p.columns.filter((c) => !p.visible.includes(c.id)).sort(byLabel).map((c) => ({ name: c.id, label: c.label, visible: false })),
    ];
    const sorted = p.sort.filter((s) => p.sortable.some((x) => x.path === s.path));
    const sort: SortItem[] = [
      ...sorted.map((s) => ({ name: s.path, label: p.sortable.find((x) => x.path === s.path)!.label, sorted: true, descending: Boolean(s.descending) })),
      ...p.sortable.filter((x) => !sorted.some((s) => s.path === x.path)).sort(byLabel).map((x) => ({ name: x.path, label: x.label, sorted: false, descending: false })),
    ];
    const group: GroupItem[] = [...(p.groupable ?? [])].sort(byLabel)
      .map((g) => ({ name: g.id, label: g.label, grouped: g.id === p.groupBy }))
      .sort((x, y) => Number(y.grouped) - Number(x.grouped));
    const totals: Item[] = (p.totalable ?? []).map((c) => ({ name: c.id, label: c.label, visible: (p.totals ?? []).includes(c.id) }));
    return { columns, sort, group, totals };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- built again when the dialog opens
  }, [round]);
  const panels = [
    <SelectionPanel key="columns" ref={columnsPanel} title={t('p13n.columns')} showHeader enableCount p13nData={data.columns} />,
    <SortPanel key="sort" ref={sortPanel} title={t('p13n.sort')} p13nData={data.sort} />,
    p.groupable ? <GroupPanel key="group" ref={groupPanel} title={t('table.group')} queryLimit={1} p13nData={data.group} /> : null,
    p.totalable?.length ? (
      <SelectionPanel key="totals" ref={totalsPanel} title={t('p13n.totals')} enableReorder={false} multiSelectMode="SelectAll" p13nData={data.totals}
        messageStrip={<MessageStrip text={t('p13n.totalsHint')} />} />
    ) : null,
  ];
  return (
    <Popup
      ref={popup} title={t('p13n.title')} panels={panels}
      onClose={({ reason }) => {
        if (reason !== 'Ok') { p.onCancel(); return; }
        const visible = columnsPanel.current?.getP13nData(true).map((x) => x.name) ?? p.visible;
        const sort = sortPanel.current?.getP13nData(true).map((x) => ({ path: x.name, descending: x.descending })) ?? p.sort;
        const groupBy = p.groupable ? (groupPanel.current?.getP13nData(true)[0]?.name ?? null) : undefined;
        const totals = p.totalable?.length ? totalsPanel.current?.getP13nData(true).map((x) => x.name) : undefined;
        p.onOk(visible, sort, groupBy, totals);
      }}
    />
  );
}
