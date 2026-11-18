/**
 * sap.fe.macros.Paginator and sap.fe.macros.FlexibleColumnLayoutActions (ADR-033): the buttons Fiori elements puts into an
 * object page title's navigation actions. Inside a FlexibleColumnLayout column they work from its ColumnContext.
 */
import { ActionIcon, Group, Tooltip } from '@mantine/core';
import { ChevronDown, ChevronUp, Maximize2, Minimize2, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useText } from '../context/SmartKitProvider';
import { useColumn } from '../page/columnContext';

function LayoutButton({ label, icon, onClick, action, disabled, extra }: { label: string; icon: ReactNode; onClick?(): void; action: string; disabled?: boolean; extra?: Record<string, true> }) {
  return (
    <Tooltip label={label}>
      <ActionIcon variant="subtle" aria-label={label} onClick={onClick} disabled={disabled} data-sk-layout-action={action} {...extra}>{icon}</ActionIcon>
    </Tooltip>
  );
}

export interface $PaginatorSettings {
  /** Accessible name of the paginator (the object type, e.g. "Purchase Orders"). */
  ariaTitle?: string;
  /** Extension: go to the previous object; without it (and without column paging) the button is disabled. */
  onPrevious?(): void;
  /** Extension: go to the next object; without it (and without column paging) the button is disabled. */
  onNext?(): void;
}

/** sap.fe.macros.Paginator: previous / next object buttons. Without handlers it uses the paging of its column. */
export function Paginator(p: $PaginatorSettings) {
  const t = useText();
  const column = useColumn();
  const own = p.onPrevious !== undefined || p.onNext !== undefined;
  const paging = own ? { onPrevious: p.onPrevious, onNext: p.onNext } : column?.paging;
  if (!paging) return null;
  return (
    <Group gap={2} wrap="nowrap" role="group" aria-label={p.ariaTitle} data-sk-paging>
      <LayoutButton label={t('layout.previous')} icon={<ChevronUp className="sk-icon" />} onClick={paging.onPrevious} disabled={!paging.onPrevious} action="previous" extra={{ 'data-sk-paging-previous': true }} />
      <LayoutButton label={t('layout.next')} icon={<ChevronDown className="sk-icon" />} onClick={paging.onNext} disabled={!paging.onNext} action="next" extra={{ 'data-sk-paging-next': true }} />
    </Group>
  );
}

/** sap.fe.macros.FlexibleColumnLayoutActions: full screen / exit full screen and close of the mid and end column. */
export function FlexibleColumnLayoutActions() {
  const t = useText();
  const column = useColumn();
  if (!column?.fullScreen || !column.close) return null;
  return (
    <Group gap={2} wrap="nowrap" data-sk-fcl-actions>
      {column.fullScreen.active
        ? <LayoutButton label={t('layout.exitFullScreen')} icon={<Minimize2 className="sk-icon" />} onClick={column.fullScreen.toggle} action="exit-full-screen" />
        : <LayoutButton label={t('layout.fullScreen')} icon={<Maximize2 className="sk-icon" />} onClick={column.fullScreen.toggle} action="full-screen" />}
      <LayoutButton label={t('layout.close')} icon={<X className="sk-icon" />} onClick={column.close} action="close" />
    </Group>
  );
}
