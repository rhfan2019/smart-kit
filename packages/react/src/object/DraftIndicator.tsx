/**
 * Draft indicator (OP Unsaved Changes, LR draft list; Fiori elements' internal draft indicator): an ObjectMarker "Draft"
 * for the user's own draft, "Locked by" / "Unsaved Changes by" for another user's; pressing it opens a popover with who
 * changed the object and when. Internal: pages use it, the public control is m/ObjectMarker.
 */
import { Badge, CloseButton, Group, Popover, Stack, Text } from '@mantine/core';
import { formatDateTime, isDraftRow, type Row } from '@rhfan2019/smart-kit-core';
import { useState } from 'react';
import { useSmartKit, useText } from '../context/SmartKitProvider';
import { ObjectMarker } from '../controls/display/ObjectMarker';
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

export interface DraftIndicatorProps {
  row: Row | undefined;
  compact?: boolean;
  /**
   * Icon only, as FE's DraftIndicator in a table's "Editing Status" column (`getIconOnlyContent`): Draft for a draft,
   * Locked when another user processes the draft (InProcessByUser), else Unsaved.
   */
  iconOnly?: boolean;
  /** Reads the row with its DraftAdministrativeData when the popover opens (lists request only InProcessByUser). */
  load?(): Promise<Row | undefined>;
}

export function DraftIndicator({ row: listed, compact, iconOnly, load }: DraftIndicatorProps) {
  const t = useText();
  const { intlLocale, timeZone } = useSmartKit();
  const [opened, setOpened] = useState(false);
  const [loaded, setLoaded] = useState<Row | undefined>();
  const state = draftState(listed);
  if (!state) return null;
  const row = loaded?.DraftAdministrativeData ? { ...listed, DraftAdministrativeData: { ...(listed?.DraftAdministrativeData as Row | undefined), ...(loaded.DraftAdministrativeData as Row) } } : listed;
  const toggle = () => {
    if (!opened && load && !loaded) void load().then(setLoaded, () => undefined);
    setOpened((o) => !o);
  };
  const locker = getPath(row, 'DraftAdministrativeData/InProcessByUser');
  const user = String(getPath(row, 'DraftAdministrativeData/LastChangedByUser') ?? locker ?? getPath(row, 'DraftAdministrativeData/CreatedByUser') ?? '');
  const when = getPath(row, 'DraftAdministrativeData/LastChangeDateTime');
  const type = iconOnly ? (listed?.IsActiveEntity === false ? 'Draft' : locker ? 'Locked' : 'Unsaved') : state === 'own' ? 'Draft' : locker ? 'LockedBy' : 'UnsavedBy';
  // withRoles off: Mantine would put aria-expanded on the wrapping span (not allowed there); the marker button carries it
  return (
    <Popover opened={opened} onChange={setOpened} position="bottom-start" withArrow width={280} trapFocus returnFocus withRoles={false}>
      <Popover.Target>
        {/* a click on the marker must not reach the table row (navigation) */}
        <span className={['sk-draft-indicator', compact ? 'sk-draft-indicator--compact' : ''].filter(Boolean).join(' ')} onClick={(e) => e.stopPropagation()}>
          <ObjectMarker
            type={type} additionalInfo={state === 'own' || iconOnly ? undefined : String(locker ?? user) || undefined}
            visibility={iconOnly ? 'IconOnly' : undefined}
            aria-haspopup="dialog" aria-expanded={opened} onPress={toggle} data-sk-draft-marker={state}
          />
        </span>
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
