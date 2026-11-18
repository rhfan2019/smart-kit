/**
 * ViewSettingsDialog (sap.m.ViewSettingsDialog, docs/26 3.8): sort, group and filter pages behind a segmented button;
 * the filter page lists the filters, each opens a detail page with its values. Opened through the ref.
 */
import { ActionIcon, Button, Checkbox, Group, Radio, SegmentedControl, Text, TextInput, UnstyledButton } from '@mantine/core';
import { ArrowDownUp, ChevronLeft, ChevronRight, Filter, Layers, Search } from 'lucide-react';
import { useImperativeHandle, useState, type ReactNode, type Ref } from 'react';
import type { TextFn } from '../../i18n/text';
import { useControlText } from '../context';
import { preventable, type PreventableEvent } from '../types';
import { DialogFrame, type TitleAlignment } from './DialogFrame';
import { TEXTS } from './texts';

/** sap.m.StringFilterOperator (how the search field of a filter detail page matches the values). */
export type StringFilterOperator = 'AnyWordStartsWith' | 'Contains' | 'Equals' | 'StartsWith';
export const StringFilterOperator = { AnyWordStartsWith: 'AnyWordStartsWith', Contains: 'Contains', Equals: 'Equals', StartsWith: 'StartsWith' } as const;

/** sap.m.ViewSettingsItem */
export interface ViewSettingsItem {
  key: string;
  text: string;
  /** (true) */
  enabled?: boolean;
  /** (false) */
  selected?: boolean;
  /** (false) */
  wrapping?: boolean;
}

/** sap.m.ViewSettingsCustomTab: an own page with its own button in the header. */
export interface ViewSettingsCustomTab {
  key: string;
  title: string;
  icon?: ReactNode;
  content: ReactNode;
}

/** sap.m.ViewSettingsFilterItem */
export interface ViewSettingsFilterItem extends ViewSettingsItem {
  /** (true) */
  multiSelect?: boolean;
  items: ViewSettingsItem[];
}

/** The pages of the dialog (UI5 page ids; custom tabs use their key). */
export type ViewSettingsDialogPage = 'sort' | 'group' | 'filter' | (string & {});

export interface ViewSettingsDialogConfirmEvent {
  sortItem: ViewSettingsItem | undefined;
  sortDescending: boolean;
  groupItem: ViewSettingsItem | undefined;
  groupDescending: boolean;
  presetFilterItem: ViewSettingsItem | undefined;
  /** The selected values of all filters. */
  filterItems: ViewSettingsItem[];
  /** `{ valueKey: true }` of the selected values (UI5 `filterKeys`). */
  filterKeys: Record<string, boolean>;
  /** `{ filterKey: { valueKey: true } }` (UI5 `filterCompoundKeys`). */
  filterCompoundKeys: Record<string, Record<string, boolean>>;
  /** "Filtered by: Status (New, Approved)", or "Filtered by: <preset>"; empty without filters. */
  filterString: string;
}

export interface $ViewSettingsDialogSettings {
  /** ('View Settings') */
  title?: string;
  sortItems?: ViewSettingsItem[];
  groupItems?: ViewSettingsItem[];
  filterItems?: ViewSettingsFilterItem[];
  /** Predefined filters; picking one clears the other filters (and the other way round). */
  presetFilterItems?: ViewSettingsItem[];
  customTabs?: ViewSettingsCustomTab[];
  /** (false) */
  sortDescending?: boolean;
  /** (false) */
  groupDescending?: boolean;
  /** ('StartsWith') */
  filterSearchOperator?: StringFilterOperator;
  /** ('Auto') */
  titleAlignment?: TitleAlignment;
  /** Key of the selected preset filter (otherwise the preset with `selected`). */
  selectedPresetFilterItem?: string;
  /** Key of the selected sort item (otherwise the item with `selected`). */
  selectedSortItem?: string;
  /** Key of the selected group item (otherwise the item with `selected`). */
  selectedGroupItem?: string;
  /** Extension: the selected values per filter, `{ [filterKey]: valueKeys }` (otherwise the values with `selected`). */
  selectedFilterKeys?: Record<string, string[]>;
  onConfirm?(e: ViewSettingsDialogConfirmEvent): void;
  onCancel?(): void;
  /** Fired when the reset button is pressed. */
  onReset?(): void;
  /** Fired when the filters are reset (reset button or `clearFilters`). */
  onResetFilters?(): void;
  onFilterDetailPageOpened?(e: { parentFilterItem: ViewSettingsFilterItem }): void;
  /** Fired before the dialog closes (OK, Cancel, Escape); `preventDefault()` keeps it open. */
  onBeforeClose?(e: PreventableEvent<object>): void;
  ref?: Ref<ViewSettingsDialog>;
}

export interface ViewSettingsDialog {
  /** Opens the dialog on a page (default: the first page that has items). */
  open(pageId?: ViewSettingsDialogPage): void;
  /** Deselects all filters and the preset filter. */
  clearFilters(): void;
}

interface Settings {
  sort: string | undefined;
  sortDescending: boolean;
  group: string | undefined;
  groupDescending: boolean;
  filters: Record<string, string[]>;
  preset: string | undefined;
}

/** Whether `text` matches the search `q` (lower case) with a StringFilterOperator. */
export function matchesFilter(text: string, q: string, op: StringFilterOperator = 'StartsWith'): boolean {
  const s = text.toLowerCase();
  if (!q) return true;
  switch (op) {
    case 'Equals': return s === q;
    case 'Contains': return s.includes(q);
    case 'AnyWordStartsWith': return s.split(/\s+/).some((w) => w.startsWith(q));
    default: return s.startsWith(q);
  }
}

/** "Filtered by: Status (New, Approved), Region (North)". */
export function viewSettingsFilterString(filterItems: ViewSettingsFilterItem[], filters: Record<string, string[]>, t: TextFn): string {
  const parts = filterItems.flatMap((f) => {
    const keys = filters[f.key] ?? [];
    const texts = f.items.filter((i) => keys.includes(i.key)).map((i) => i.text);
    return texts.length ? [`${f.text} (${texts.join(', ')})`] : [];
  });
  return parts.length ? t('ctl.vsd.filteredBy', { filters: parts.join(', ') }) : '';
}

function initial(p: $ViewSettingsDialogSettings): Settings {
  return {
    sort: p.selectedSortItem ?? p.sortItems?.find((i) => i.selected)?.key,
    sortDescending: p.sortDescending ?? false,
    group: p.selectedGroupItem ?? p.groupItems?.find((i) => i.selected)?.key,
    groupDescending: p.groupDescending ?? false,
    filters: Object.fromEntries((p.filterItems ?? []).map((f) => [f.key, p.selectedFilterKeys?.[f.key] ?? f.items.filter((i) => i.selected).map((i) => i.key)])),
    preset: p.selectedPresetFilterItem ?? p.presetFilterItems?.find((i) => i.selected)?.key,
  };
}

const emptyFilters = (p: $ViewSettingsDialogSettings) => Object.fromEntries((p.filterItems ?? []).map((f) => [f.key, [] as string[]]));

export function ViewSettingsDialog(p: $ViewSettingsDialogSettings) {
  const t = useControlText(TEXTS);
  const custom = p.customTabs ?? [];
  const pages: ViewSettingsDialogPage[] = [
    ...(p.sortItems?.length ? ['sort'] : []), ...(p.groupItems?.length ? ['group'] : []),
    ...(p.filterItems?.length || p.presetFilterItems?.length ? ['filter'] : []), ...custom.map((c) => c.key),
  ];
  const [opened, setOpened] = useState(false);
  const [page, setPage] = useState<ViewSettingsDialogPage>(pages[0] ?? 'sort');
  const [detail, setDetail] = useState<string | null>(null);
  const [detailSearch, setDetailSearch] = useState('');
  // The confirmed settings: start from the props, then what the user confirmed (UI5 keeps them in the control).
  const [committed, setCommitted] = useState<Settings | null>(null);
  const [draft, setDraft] = useState<Settings>(() => initial(p));

  const clearFilters = () => {
    const next = (x: Settings): Settings => ({ ...x, filters: emptyFilters(p), preset: undefined });
    setDraft(next);
    setCommitted((c) => (c ? next(c) : next(initial(p))));
    p.onResetFilters?.();
  };
  useImperativeHandle(p.ref, () => ({
    open(pageId) {
      setDraft(committed ?? initial(p));
      setPage(pageId && pages.includes(pageId) ? pageId : pages[0] ?? 'sort');
      setDetail(null);
      setOpened(true);
    },
    clearFilters,
  }));

  /** Closes unless `beforeClose` is prevented. */
  const closeWith = (after: () => void) => {
    const e = preventable({});
    p.onBeforeClose?.(e);
    if (e.defaultPrevented) return;
    setOpened(false);
    after();
  };
  const cancel = () => closeWith(() => p.onCancel?.());
  const confirm = () => closeWith(() => {
    const filterItems = p.filterItems ?? [];
    const selectedValues = filterItems.flatMap((f) => f.items.filter((i) => draft.filters[f.key]?.includes(i.key)));
    const preset = p.presetFilterItems?.find((i) => i.key === draft.preset);
    setCommitted(draft);
    p.onConfirm?.({
      sortItem: p.sortItems?.find((i) => i.key === draft.sort),
      sortDescending: draft.sortDescending,
      groupItem: p.groupItems?.find((i) => i.key === draft.group),
      groupDescending: draft.groupDescending,
      presetFilterItem: preset,
      filterItems: selectedValues,
      filterKeys: Object.fromEntries(selectedValues.map((i) => [i.key, true])),
      filterCompoundKeys: Object.fromEntries(filterItems.filter((f) => draft.filters[f.key]?.length).map((f) => [f.key, Object.fromEntries(draft.filters[f.key]!.map((k) => [k, true]))])),
      filterString: preset ? t('ctl.vsd.filteredBy', { filters: preset.text }) : viewSettingsFilterString(filterItems, draft.filters, t),
    });
  });
  const reset = () => {
    const start = initial({ ...p, selectedFilterKeys: undefined });
    setDraft({ ...start, filters: emptyFilters(p), preset: undefined });
    p.onReset?.();
    p.onResetFilters?.();
  };
  const openDetail = (f: ViewSettingsFilterItem) => { setDetail(f.key); setDetailSearch(''); p.onFilterDetailPageOpened?.({ parentFilterItem: f }); };

  const tabOf = (id: string) => custom.find((c) => c.key === id);
  const pageLabel = (id: ViewSettingsDialogPage) => tabOf(id)?.title ?? t(`ctl.vsd.${id as 'sort' | 'group' | 'filter'}`);
  const icon = { sort: <ArrowDownUp className="sk-icon" aria-hidden />, group: <Layers className="sk-icon" aria-hidden />, filter: <Filter className="sk-icon" aria-hidden /> } as Record<string, ReactNode>;
  const detailItem = p.filterItems?.find((f) => f.key === detail);
  const changed = JSON.stringify(draft) !== JSON.stringify({ ...initial({ ...p, selectedFilterKeys: undefined }), filters: emptyFilters(p), preset: undefined });
  const wrap = (i: ViewSettingsItem) => (i.wrapping ? 'sk-vsd__item sk-vsd__item--wrapping' : 'sk-vsd__item');

  const header = (pages.length > 1 || custom.length > 0) && !detailItem ? (
    <SegmentedControl
      size="xs" value={page} onChange={(v) => setPage(v)} aria-label={p.title ?? t('ctl.vsd.title')} className="sk-vsd__pages"
      data={pages.map((id) => ({
        value: id,
        label: <span className="sk-vsd__page" title={pageLabel(id)} aria-label={pageLabel(id)}>{tabOf(id) ? tabOf(id)!.icon ?? pageLabel(id) : icon[id]}</span>,
      }))}
    />
  ) : null;

  let body: ReactNode;
  if (detailItem) {
    const multi = detailItem.multiSelect ?? true;
    const sel = draft.filters[detailItem.key] ?? [];
    const q = detailSearch.trim().toLowerCase();
    const items = detailItem.items.filter((i) => matchesFilter(i.text, q, p.filterSearchOperator));
    const set = (keys: string[]) => setDraft({ ...draft, preset: undefined, filters: { ...draft.filters, [detailItem.key]: keys } });
    const selectable = detailItem.items.filter((i) => i.enabled !== false);
    const all = selectable.every((i) => sel.includes(i.key));
    body = (
      <div className="sk-vsd__detail">
        <TextInput type="search" size="xs" value={detailSearch} onChange={(e) => setDetailSearch(e.currentTarget.value)} leftSection={<Search className="sk-icon" />} aria-label={t('ctl.list.search')} placeholder={t('ctl.list.search')} />
        {multi ? (
          <>
            <Checkbox className="sk-vsd__select-all" label={t('ctl.vsd.selectAll')} checked={all} indeterminate={!all && sel.length > 0} onChange={() => set(all ? [] : selectable.map((i) => i.key))} />
            <div role="group" aria-label={detailItem.text} className="sk-vsd__options">
              {items.map((i) => (
                <Checkbox key={i.key} className={wrap(i)} label={i.text} disabled={i.enabled === false} checked={sel.includes(i.key)}
                  onChange={(e) => set(e.currentTarget.checked ? [...sel, i.key] : sel.filter((k) => k !== i.key))} />
              ))}
            </div>
          </>
        ) : (
          <Radio.Group value={sel[0] ?? null} onChange={(v) => set([v])} aria-label={detailItem.text}>
            <div className="sk-vsd__options">{items.map((i) => <Radio key={i.key} className={wrap(i)} value={i.key} label={i.text} disabled={i.enabled === false} />)}</div>
          </Radio.Group>
        )}
      </div>
    );
  } else if (tabOf(page)) {
    body = tabOf(page)!.content;
  } else if (page === 'filter') {
    body = (
      <div className="sk-vsd__filters">
        {p.presetFilterItems?.length ? (
          <Radio.Group value={draft.preset ?? ''} onChange={(v) => setDraft({ ...draft, preset: v || undefined, filters: v ? emptyFilters(p) : draft.filters })}>
            <div className="sk-vsd__options">
              {p.presetFilterItems.map((i) => <Radio key={i.key} className={wrap(i)} value={i.key} label={i.text} disabled={i.enabled === false} />)}
            </div>
          </Radio.Group>
        ) : null}
        {p.filterItems?.length ? <Text size="sm" fw={600} className="sk-vsd__section">{t('ctl.vsd.filterBy')}</Text> : null}
        <div role="list">
          {(p.filterItems ?? []).map((f) => {
            const n = draft.filters[f.key]?.length ?? 0;
            return (
              <div key={f.key} role="listitem" className="sk-vsd__filter">
                <UnstyledButton className={wrap(f)} disabled={f.enabled === false} onClick={() => openDetail(f)} data-sk-filter={f.key}>
                  <span className="sk-grow">{f.text}</span>
                  {n > 0 && <span className="sk-vsd__count">{n}</span>}
                  <ChevronRight className="sk-icon" aria-hidden />
                </UnstyledButton>
              </div>
            );
          })}
        </div>
      </div>
    );
  } else {
    const isSort = page === 'sort';
    const items = (isSort ? p.sortItems : p.groupItems) ?? [];
    const key = isSort ? draft.sort : draft.group;
    const desc = isSort ? draft.sortDescending : draft.groupDescending;
    body = (
      <div className="sk-vsd__lists">
        <Radio.Group label={t(isSort ? 'ctl.vsd.sortOrder' : 'ctl.vsd.groupOrder')} value={desc ? 'desc' : 'asc'}
          onChange={(v) => setDraft(isSort ? { ...draft, sortDescending: v === 'desc' } : { ...draft, groupDescending: v === 'desc' })}>
          <div className="sk-vsd__options">
            <Radio value="asc" label={t('ctl.vsd.ascending')} />
            <Radio value="desc" label={t('ctl.vsd.descending')} />
          </div>
        </Radio.Group>
        <Radio.Group label={t(isSort ? 'ctl.vsd.sortBy' : 'ctl.vsd.groupBy')} value={key ?? ''}
          onChange={(v) => setDraft(isSort ? { ...draft, sort: v || undefined } : { ...draft, group: v || undefined })}>
          <div className="sk-vsd__options">
            {!isSort && <Radio value="" label={t('ctl.vsd.notGrouped')} />}
            {items.map((i) => <Radio key={i.key} className={wrap(i)} value={i.key} label={i.text} disabled={i.enabled === false} />)}
          </div>
        </Radio.Group>
      </div>
    );
  }

  const title = detailItem ? (
    <Group gap="xs" wrap="nowrap">
      <ActionIcon variant="subtle" onClick={() => setDetail(null)} aria-label={t('ctl.vsd.back')} title={t('ctl.vsd.back')}><ChevronLeft className="sk-icon" /></ActionIcon>
      <span>{detailItem.text}</span>
    </Group>
  ) : (p.title ?? t('ctl.vsd.title'));

  return (
    <DialogFrame
      opened={opened} onClose={cancel} title={title} titleAlignment={p.titleAlignment} contentWidth="md" className="sk-vsd"
      headerExtra={(
        <Group gap="xs" wrap="nowrap">
          {header}
          <Button size="xs" variant="subtle" disabled={!changed} onClick={reset}>{t('ctl.vsd.reset')}</Button>
        </Group>
      )}
      subHeader={!detailItem && (pages.length > 1 || custom.length > 0) ? <Text size="sm" fw={600}>{pageLabel(page)}</Text> : undefined}
      footer={(
        <Group justify="flex-end" gap="xs">
          <Button size="sm" onClick={confirm}>{t('common.ok')}</Button>
          <Button size="sm" variant="default" onClick={cancel}>{t('common.cancel')}</Button>
        </Group>
      )}
    >
      {body}
    </DialogFrame>
  );
}
