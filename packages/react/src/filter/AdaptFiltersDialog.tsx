/** "Adapt Filters": show or hide filter fields; fields with a value or mandatory fields cannot be hidden (LR-09). */
import { Button, Checkbox, Group, Modal, ScrollArea, Stack, TextInput, Tooltip } from '@mantine/core';
import { isFilterable } from '@rhfan2019/smart-kit-core';
import { Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useMetaModel, useText } from '../context/SmartKitProvider';

export interface AdaptFiltersDialogProps {
  /** Whether the dialog is open (controlled). */
  opened: boolean;
  /** Entity set name as in `$metadata`, e.g. "Orders". */
  entitySet: string;
  /** Name of the service in `SmartKitProvider` `services`; default: the provider's `defaultService`. */
  service?: string;
  fields: string[];
  /** Fields that cannot be hidden (they carry a condition or are mandatory). */
  locked: string[];
  /** Called with the result when the user confirms. */
  onOk(fields: string[]): void;
  /** Called when the user cancels or closes the dialog. */
  onCancel(): void;
}

/** All properties that can be offered as filter fields. */
export function useFilterableProperties(entitySet: string, service?: string): { path: string; label: string }[] {
  const { type, capabilities } = useMetaModel(entitySet, { service });
  return useMemo(
    () =>
      type.propertyOrder
        .map((n) => type.properties[n]!)
        .filter((p) => !p.hidden && !p.hiddenFilter && p.edmType.startsWith('Edm.') && !/Stream|Binary|Geo/.test(p.edmType) && isFilterable(capabilities, p.name))
        .map((p) => ({ path: p.name, label: p.label })),
    [type, capabilities],
  );
}

export function AdaptFiltersDialog(p: AdaptFiltersDialogProps) {
  const t = useText();
  const all = useFilterableProperties(p.entitySet, p.service);
  const [selected, setSelected] = useState(p.fields);
  const [q, setQ] = useState('');
  useEffect(() => {
    if (p.opened) { setSelected(p.fields); setQ(''); }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when opened
  }, [p.opened]);
  const visible = all.filter((f) => f.label.toLowerCase().includes(q.toLowerCase()));
  return (
    <Modal opened={p.opened} onClose={p.onCancel} title={t('adapt.title')} size="md">
      <Stack gap="sm">
        <TextInput value={q} onChange={(e) => setQ(e.currentTarget.value)} placeholder={t('adapt.searchFields')} aria-label={t('adapt.searchFields')} leftSection={<Search className="sk-icon" />} data-autofocus />
        <ScrollArea.Autosize mah="var(--sk-size-dialog-list)">
          <Stack gap="xs" className="sk-adapt__list">
            {visible.map((f) => {
              const locked = p.locked.includes(f.path);
              const box = (
                <Checkbox
                  key={f.path}
                  label={f.label}
                  checked={selected.includes(f.path)}
                  disabled={locked}
                  onChange={(e) => {
                    const on = e.currentTarget.checked;
                    setSelected(on ? [...selected, f.path] : selected.filter((x) => x !== f.path));
                  }}
                />
              );
              return locked ? <Tooltip key={f.path} label={t('adapt.locked')}><div>{box}</div></Tooltip> : box;
            })}
          </Stack>
        </ScrollArea.Autosize>
      </Stack>
      <Group justify="flex-end" className="sk-dialog-footer">
        <Button onClick={() => p.onOk(all.map((f) => f.path).filter((x) => selected.includes(x)).concat(selected.filter((x) => !all.some((f) => f.path === x))))}>{t('common.ok')}</Button>
        <Button variant="default" onClick={p.onCancel}>{t('common.cancel')}</Button>
      </Group>
    </Modal>
  );
}
