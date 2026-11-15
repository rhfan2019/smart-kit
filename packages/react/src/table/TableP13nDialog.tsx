/** Personalization dialog: column visibility and order, sort (LR-19). Grouping is phase 2. */
import { ActionIcon, Button, Checkbox, Group, Modal, ScrollArea, Select, Stack, Tabs } from '@mantine/core';
import type { SortItem } from '@rhfan2019/smart-kit-core';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useText } from '../context/SmartKitProvider';

export interface TableP13nDialogProps {
  opened: boolean;
  columns: { id: string; label: string }[];
  visible: string[];
  sort: SortItem[];
  sortable: { path: string; label: string }[];
  onOk(visible: string[], sort: SortItem[]): void;
  onCancel(): void;
}

export function TableP13nDialog(p: TableP13nDialogProps) {
  const t = useText();
  const [order, setOrder] = useState<string[]>([]);
  const [shown, setShown] = useState<string[]>([]);
  const [sort, setSort] = useState<SortItem[]>([]);
  useEffect(() => {
    if (!p.opened) return;
    setOrder([...p.visible, ...p.columns.map((c) => c.id).filter((id) => !p.visible.includes(id))]);
    setShown(p.visible);
    setSort(p.sort.filter((s) => p.sortable.some((x) => x.path === s.path)));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when opened
  }, [p.opened]);
  const label = (id: string) => p.columns.find((c) => c.id === id)?.label ?? id;
  const move = (i: number, d: -1 | 1) => {
    const next = [...order];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j]!, next[i]!];
    setOrder(next);
  };
  return (
    <Modal opened={p.opened} onClose={p.onCancel} title={t('p13n.title')} size="lg">
      <Tabs defaultValue="columns" keepMounted={false}>
        <Tabs.List>
          <Tabs.Tab value="columns">{t('p13n.columns')}</Tabs.Tab>
          <Tabs.Tab value="sort">{t('p13n.sort')}</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="columns" className="sk-p13n__panel">
          <ScrollArea.Autosize mah="var(--sk-size-dialog-list)">
            <Stack gap="xs">
              {order.map((id, i) => (
                <Group key={id} justify="space-between" wrap="nowrap" className="sk-p13n__row">
                  <Checkbox label={label(id)} checked={shown.includes(id)} onChange={(e) => setShown(e.currentTarget.checked ? [...shown, id] : shown.filter((x) => x !== id))} />
                  <Group gap={0} wrap="nowrap">
                    <ActionIcon onClick={() => move(i, -1)} disabled={i === 0} aria-label={`${t('p13n.moveUp')}: ${label(id)}`}><ArrowUp className="sk-icon" /></ActionIcon>
                    <ActionIcon onClick={() => move(i, 1)} disabled={i === order.length - 1} aria-label={`${t('p13n.moveDown')}: ${label(id)}`}><ArrowDown className="sk-icon" /></ActionIcon>
                  </Group>
                </Group>
              ))}
            </Stack>
          </ScrollArea.Autosize>
        </Tabs.Panel>
        <Tabs.Panel value="sort" className="sk-p13n__panel">
          <Stack gap="xs">
            {sort.map((s, i) => (
              <Group key={i} wrap="nowrap" gap="xs">
                <Select
                  aria-label={t('p13n.sortBy')}
                  className="sk-grow"
                  value={s.path}
                  allowDeselect={false}
                  data={p.sortable.map((x) => ({ value: x.path, label: x.label }))}
                  onChange={(v) => v && setSort(sort.map((x, j) => (j === i ? { ...x, path: v } : x)))}
                />
                <Select
                  aria-label={t('p13n.sort')}
                  value={s.descending ? 'desc' : 'asc'}
                  allowDeselect={false}
                  data={[{ value: 'asc', label: t('p13n.ascending') }, { value: 'desc', label: t('p13n.descending') }]}
                  onChange={(v) => setSort(sort.map((x, j) => (j === i ? { ...x, descending: v === 'desc' } : x)))}
                />
                <ActionIcon onClick={() => setSort(sort.filter((_, j) => j !== i))} aria-label={t('p13n.removeSort')}><Trash2 className="sk-icon" /></ActionIcon>
              </Group>
            ))}
            <Button variant="subtle" className="sk-self-start" leftSection={<Plus className="sk-icon" />} disabled={!p.sortable.length}
              onClick={() => setSort([...sort, { path: p.sortable.find((x) => !sort.some((s) => s.path === x.path))?.path ?? p.sortable[0]!.path, descending: false }])}>
              {t('p13n.addSort')}
            </Button>
          </Stack>
        </Tabs.Panel>
      </Tabs>
      <Group justify="flex-end" className="sk-dialog-footer">
        <Button onClick={() => p.onOk(order.filter((id) => shown.includes(id)), sort)} data-sk-p13n-ok>{t('common.ok')}</Button>
        <Button variant="default" onClick={p.onCancel}>{t('common.cancel')}</Button>
      </Group>
    </Modal>
  );
}
