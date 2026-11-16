/**
 * Object marker for drafts (OP Unsaved Changes, LR draft list): "Draft" for the user's own draft, "Unsaved Changes" /
 * "Locked" for another user's; pressing it opens a popover with who changed the object and when.
 */
import { Badge, CloseButton, Group, Popover, Stack, Text, UnstyledButton } from '@mantine/core';
import { formatDateTime, isDraftRow, type Row } from '@rhfan2019/smart-kit-core';
import { PencilLine } from 'lucide-react';
import { useState } from 'react';
import { useSmartKit, useText } from '../context/SmartKitProvider';
import { getPath } from '../field/values';

export type DraftState = 'own' | 'other' | undefined;

/** Draft state of a row: the user's own draft, another user's unsaved changes, or none. */
export function draftState(row: Row | undefined): DraftState {
  if (!row) return undefined;
  const own = getPath(row, 'DraftAdministrativeData/DraftIsCreatedByMe');
  if (isDraftRow(row)) return own === false ? 'other' : 'own';
  if (row.HasDraftEntity === true) return own === true ? 'own' : 'other';
  return undefined;
}

export function DraftMarker({ row, compact }: { row: Row | undefined; compact?: boolean }) {
  const t = useText();
  const { intlLocale, timeZone } = useSmartKit();
  const [opened, setOpened] = useState(false);
  const state = draftState(row);
  if (!state) return null;
  const user = String(getPath(row, 'DraftAdministrativeData/LastChangedByUser') ?? getPath(row, 'DraftAdministrativeData/InProcessByUser') ?? getPath(row, 'DraftAdministrativeData/CreatedByUser') ?? '');
  const when = getPath(row, 'DraftAdministrativeData/LastChangeDateTime');
  const label = state === 'own' ? t('draft.marker') : user ? t('draft.unsavedBy', { user }) : t('draft.unsavedChanges');
  return (
    <Popover opened={opened} onChange={setOpened} position="bottom-start" withArrow width={280} trapFocus returnFocus>
      <Popover.Target>
        <UnstyledButton className={['sk-draft-marker', compact ? 'sk-draft-marker--compact' : ''].join(' ')} onClick={(e) => { e.stopPropagation(); setOpened((o) => !o); }} aria-haspopup="dialog" aria-label={label} data-sk-draft-marker={state}>
          <PencilLine className="sk-icon" aria-hidden />
          <span>{state === 'own' ? t('draft.marker') : t('draft.unsavedChanges')}</span>
        </UnstyledButton>
      </Popover.Target>
      <Popover.Dropdown role="dialog" aria-label={t('draft.popoverTitle')} onClick={(e) => e.stopPropagation()} data-sk-draft-popover>
        <Group justify="space-between" mb="xs" wrap="nowrap">
          <Text fw={600}>{t('draft.popoverTitle')}</Text>
          <CloseButton aria-label={t('common.close')} onClick={() => setOpened(false)} data-sk-draft-popover-close />
        </Group>
        <Stack gap={4}>
          {state === 'own' ? <Text size="sm">{t('draft.ownDraft')}</Text> : <Badge variant="light" color="orange">{t('draft.lockedBy', { user: user || '?' })}</Badge>}
          {user ? <Text size="sm" data-sk-draft-user>{t('draft.changedBy', { user })}</Text> : null}
          {when ? <Text size="sm" data-sk-draft-time>{t('draft.changedAt', { time: formatDateTime(String(when), intlLocale, timeZone) })}</Text> : null}
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}
