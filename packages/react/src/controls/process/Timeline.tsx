/**
 * Timeline + TimelineItem (sap.suite.ui.commons.Timeline), docs/26 §3.6: items as JSX children (aggregation `content`),
 * newest first (or oldest first), vertical or horizontal, "More" after `growingThreshold` items, grouping headers and a
 * header bar with search, sort and a filter popover (item filter, time filter or `customFilter`).
 */
import { Avatar, Button, Checkbox, Popover, Textarea, TextInput } from '@mantine/core';
import { ArrowDownUp, Filter, Search, X } from 'lucide-react';
import { useImperativeHandle, useRef, useState, type ReactNode, type Ref } from 'react';
import { relativeDateTime } from '../../cards/format';
import type { TextFn } from '../../i18n/text';
import { useControlLocale, useControlText } from '../context';
import { elementsOf, preventable, toneOf, type ValueState } from '../types';
import { avatarProps, cx, pressKeys, toDate, type AvatarShape, type AvatarSize, type DateLike } from './shared';
import { TEXTS } from './texts';

/** sap.suite.ui.commons.TimelineAxisOrientation */
export type TimelineAxisOrientation = 'Vertical' | 'Horizontal';
export const TimelineAxisOrientation = { Vertical: 'Vertical', Horizontal: 'Horizontal' } as const;

/** sap.suite.ui.commons.TimelineGroupType */
export type TimelineGroupType = 'None' | 'Year' | 'Quarter' | 'Month' | 'Week' | 'Day';
export const TimelineGroupType = { None: 'None', Year: 'Year', Quarter: 'Quarter', Month: 'Month', Week: 'Week', Day: 'Day' } as const;

/** sap.suite.ui.commons.TimelineAlignment: side of the items (Left / Right on the vertical axis, Top / Bottom on the horizontal). */
export type TimelineAlignment = 'Left' | 'Right' | 'Top' | 'Bottom';
export const TimelineAlignment = { Left: 'Left', Right: 'Right', Top: 'Top', Bottom: 'Bottom' } as const;

/** sap.suite.ui.commons.TimelineFilterType */
export type TimelineFilterType = 'Data' | 'Time' | 'Search';
export const TimelineFilterType = { Data: 'Data', Time: 'Time', Search: 'Search' } as const;

/** sap.suite.ui.commons.TimelineFilterListItem */
export interface TimelineFilterListItem {
  key: string;
  text?: string;
}

/** A link of the item footer (UI5 aggregation `customAction`, sap.ui.core.CustomData). */
export interface TimelineCustomAction {
  key: string;
  value: string;
}

export interface $TimelineItemSettings {
  /** Date or ISO string. */
  dateTime?: DateLike;
  title?: string;
  text?: string;
  /** Colours the icon (ValueState). */
  status?: ValueState;
  /** Value matched by the item filter (and the search). */
  filterValue?: string;
  /** Characters of `text` before "More". */
  maxCharacters?: number;
  /** Number of replies (with `enableSocial`). */
  replyCount?: number;
  userName?: string;
  /** @defaultValue false */
  userNameClickable?: boolean;
  /** Image URL of the user, shown next to the name. */
  userPicture?: string;
  /** Icon on the axis (React node). */
  icon?: ReactNode;
  /** @defaultValue 'Circle' */
  iconDisplayShape?: AvatarShape;
  /** Initials on the axis when there is no icon. */
  iconInitials?: string;
  /** @defaultValue 'XS' */
  iconSize?: AvatarSize;
  iconTooltip?: string;
  /** Uses the title as tooltip of the icon when `iconTooltip` is not set. @defaultValue true */
  useIconTooltip?: boolean;
  /** Links in the item footer. */
  customAction?: TimelineCustomAction[];
  /** Replaces the reply box (with `enableSocial`). */
  customReply?: ReactNode;
  /** The replies (a list), shown above the reply box when the replies or the reply link is pressed (with `enableSocial`). */
  replyList?: ReactNode;
  /** Embedded content (UI5 default aggregation `embeddedControl`). */
  children?: ReactNode;
  onUserNameClicked?: (e: TimelineItem$UserNameClickedEvent) => void;
  onSelect?: () => void;
  onPress?: () => void;
  onReplyPost?: (e: TimelineItem$ReplyPostEvent) => void;
  onReplyListOpen?: () => void;
  onCustomActionClicked?: (e: TimelineItem$CustomActionClickedEvent) => void;
}

/** Event object of the item's `onUserNameClicked`: the user name element. */
export interface TimelineItem$UserNameClickedEvent { uiElement: HTMLElement }
/** Event object of the item's `onReplyPost`. */
export interface TimelineItem$ReplyPostEvent { value: string }
/** Event object of the item's `onCustomActionClicked`: the action and its link element. */
export interface TimelineItem$CustomActionClickedEvent { value: string; key: string; linkObj: HTMLElement }

/** An entry of Timeline; rendered by its parent. */
export function TimelineItem(_: $TimelineItemSettings): null {
  return null;
}

/** A Timeline item in event objects: its props and React key. */
export type TimelineSelectedItem = $TimelineItemSettings & { key?: string };

/** Why an item is filtered out (event `itemFiltering`). */
export interface TimelineFilterReasons { search?: boolean; data?: boolean; time?: boolean }
export interface TimelineTimeKeys { from?: Date; to?: Date }

export interface Timeline$FilterSelectionChangeEvent {
  type?: TimelineFilterType;
  searchTerm?: string;
  /** Key of the first selected filter item. */
  selectedItem?: string;
  selectedItems?: TimelineFilterListItem[];
  timeKeys?: TimelineTimeKeys;
  clear?: boolean;
}

/** Event object of `onItemFiltering`; `preventDefault()` keeps the item (as in UI5). */
export interface Timeline$ItemFilteringEvent {
  item: TimelineSelectedItem;
  reasons: TimelineFilterReasons;
  dataKeys: string[];
  timeKeys: TimelineTimeKeys;
  searchTerm: string;
  preventDefault(): void;
}

/** Event object of `onSelect`. */
export interface Timeline$SelectEvent { selectedItem: TimelineSelectedItem; userAction: boolean }

/** A group of the Timeline (getGroups); stands for UI5's group header item, whose userName holds the group key. */
export interface TimelineGroup { key: string; title: string; dateTime?: Date }
/** Result of the grouping function of setCustomGrouping: the group key, its title and the item's date. */
export interface TimelineCustomGroup { key: string; title: string; date?: Date }
/**
 * A filter on the items for setModelFilter / setCustomModelFilter; it stands for sap.ui.model.Filter (like the Filter's
 * `test` function): true keeps the item. The items are filtered on the client, as a Timeline bound to a client model.
 */
export type TimelineItemFilter = (item: TimelineSelectedItem) => boolean;

export interface $TimelineSettings {
  children?: ReactNode;
  /** @defaultValue 'Right' */
  alignment?: TimelineAlignment;
  /** @defaultValue 'Vertical' */
  axisOrientation?: TimelineAxisOrientation;
  /** Vertical axis with items alternating on both sides. @defaultValue false */
  enableDoubleSided?: boolean;
  /** false shows dots instead of the item icons. @defaultValue true */
  showIcons?: boolean;
  /** CSS width. @defaultValue '100%' */
  width?: string;
  /** CSS height; with `enableScroll` the list scrolls inside it. */
  height?: string;
  /** CSS maximum height of item texts (they scroll beyond it). */
  textHeight?: string;
  noDataText?: string;
  /** Accepted for UI5 code; no effect (no data binding, ADR-032 rule 7). @defaultValue true */
  enableBusyIndicator?: boolean;
  /** Accepted for UI5 code; no effect (no data binding: the filters always work on the client). @defaultValue true */
  enableModelFilter?: boolean;
  groupBy?: string;
  dateTimePath?: string;
  /** Accepted for UI5 code; no effect (no data binding). @defaultValue false */
  lazyLoading?: boolean;
  /** @defaultValue true */
  enableScroll?: boolean;
  /** Reply link and reply count on the items. @defaultValue false */
  enableSocial?: boolean;
  /** Growing even without paging data (items always grow on the client here). @defaultValue false */
  forceGrowing?: boolean;
  /** Items shown before "More" (0 shows all). @defaultValue 5 */
  growingThreshold?: number;
  /** Sorts by date. @defaultValue true */
  sort?: boolean;
  /** false: newest first. @defaultValue false */
  sortOldestFirst?: boolean;
  /** @defaultValue 'None' */
  groupByType?: TimelineGroupType;
  /** @defaultValue true */
  showHeaderBar?: boolean;
  /** @defaultValue true */
  showSearch?: boolean;
  /** @defaultValue true */
  showSort?: boolean;
  /** Filter by the items' `filterValue`. @defaultValue true */
  showItemFilter?: boolean;
  /** Filter by a date range. @defaultValue true */
  showTimeFilter?: boolean;
  /** Title of the filter popover. */
  filterTitle?: string;
  /** Replaces the content of the filter popover. */
  customFilter?: ReactNode;
  /** Options of the item filter; default the distinct `filterValue`s. */
  filterList?: TimelineFilterListItem[];
  onSelect?: (e: Timeline$SelectEvent) => void;
  onGrow?: () => void;
  onFilterOpen?: () => void;
  onFilterSelectionChange?: (e: Timeline$FilterSelectionChangeEvent) => void;
  /** Fired for each item a filter would hide; `preventDefault()` keeps it. */
  onItemFiltering?: (e: Timeline$ItemFilteringEvent) => void;
  onCustomMessageClosed?: () => void;
  ref?: Ref<Timeline>;
  'aria-label'?: string;
}

/** Instance methods of Timeline (via `ref`). */
export interface Timeline {
  /** Clears search, filters and growing. */
  reset(): void;
  /** Clears the time filter. */
  resetTimeLimits(): void;
  /** Recalculates the layout (nothing to do in React; kept for UI5 code). */
  adjustUI(): void;
  /** Shows a message strip above the items; closing it fires `onCustomMessageClosed`. */
  setCustomMessage(message: string | null): void;
  /** The selected item-filter criteria, `{ key, text }` (text defaults to the key). */
  getCurrentFilter(): TimelineFilterListItem[];
  /** Selects item-filter criteria by key (one key or an array); keys not in the filter list are ignored. Fires no filterSelectionChange. */
  setCurrentFilter(aSelectedItemKeys: string[] | string): void;
  /** Sets the search term (the search field and the search filter); fires no filterSelectionChange. */
  setCurrentSearch(sSearchTerm: string): void;
  /** Sets the time range filter; `type` is the step used for the dates in the filter info bar (default Day). */
  setCurrentTimeFilter(mArguments: { from?: Date | null; to?: Date | null; type?: TimelineGroupType }): void;
  /** The shown groups (empty when not grouped); they stand for UI5's group header items. */
  getGroups(): TimelineGroup[];
  /** Groups by a function of the item date returning `{ key, title, date }` (instead of groupByType); `null` removes it. */
  setCustomGrouping(fnGroupBy: ((date: Date) => TimelineCustomGroup) | null): void;
  /**
   * Replaces one of the default filters (Data: item filter, Time: time range, Search: search) by `filter`; `null` restores
   * the default (and for Time clears the dates). With `refresh: false` it takes effect on the next filter change. A user
   * change of that filter goes back to the default filter, as in UI5.
   */
  setModelFilter(mArguments: { type: TimelineFilterType; filter?: TimelineItemFilter | null; refresh?: boolean }): void;
  /** Adds (or replaces) a filter on top of the default filters under an id; `null` removes it. Cleared by the info bar's clear icon. */
  setCustomModelFilter(sFilterId: string, oFilter: TimelineItemFilter | null): void;
  /** Replaces the default text of the Data or Time part of the filter info bar (Search is not supported, as in UI5). */
  setModelFilterMessage(sType: TimelineFilterType, sMessage: string): void;
  /** Appends a message to the filter info bar text. */
  setCustomFilterMessage(sMessage: string): void;
}

interface Entry { id: string; item: TimelineSelectedItem; date?: Date; index: number }
interface Criteria { query: string; keys: string[]; time: TimelineTimeKeys }
type ModelFilters = Partial<Record<TimelineFilterType, TimelineItemFilter>>;

const dateParts = (d: Date, timeZone?: string) => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
  const n = (type: string) => Number(parts.find((x) => x.type === type)?.value);
  return { y: n('year'), m: n('month'), d: n('day') };
};

/** ISO 8601 week and its year. */
export function isoWeek(y: number, m: number, d: number): { week: number; year: number } {
  const date = new Date(Date.UTC(y, m - 1, d));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const year = date.getUTCFullYear();
  return { week: Math.ceil(((date.getTime() - Date.UTC(year, 0, 1)) / 86400000 + 1) / 7), year };
}

/** Group key and header text of a date. */
export function timelineGroup(t: TextFn, type: TimelineGroupType, d: Date, intlLocale: string, timeZone?: string): { key: string; text: string } {
  const { y, m, d: day } = dateParts(d, timeZone);
  switch (type) {
    case 'Year': return { key: `${y}`, text: String(y) };
    case 'Quarter': {
      const quarter = Math.ceil(m / 3);
      return { key: `${y}-Q${quarter}`, text: t('ctl.timeline.quarter', { quarter, year: y }) };
    }
    case 'Month': return { key: `${y}-${m}`, text: new Intl.DateTimeFormat(intlLocale, { timeZone, year: 'numeric', month: 'long' }).format(d) };
    case 'Week': {
      const w = isoWeek(y, m, day);
      return { key: `${w.year}-W${w.week}`, text: t('ctl.timeline.week', { week: w.week, year: w.year }) };
    }
    default: return { key: `${y}-${m}-${day}`, text: new Intl.DateTimeFormat(intlLocale, { timeZone, dateStyle: 'full' }).format(d) };
  }
}

/** The filters an item fails (empty object: it is shown); a model filter (setModelFilter) replaces the default one of its type. */
function failing(e: Entry, c: Criteria, mf: ModelFilters = {}): TimelineFilterReasons {
  const r: TimelineFilterReasons = {};
  const q = c.query.trim().toLowerCase();
  if (mf.Search ? !mf.Search(e.item) : q && ![e.item.title, e.item.text, e.item.userName, e.item.filterValue].some((v) => v?.toLowerCase().includes(q))) r.search = true;
  if (mf.Data ? !mf.Data(e.item) : c.keys.length && !c.keys.includes(e.item.filterValue ?? '')) r.data = true;
  if (mf.Time ? !mf.Time(e.item) : (c.time.from || c.time.to) && (!e.date || (c.time.from && e.date < c.time.from) || (c.time.to && e.date > c.time.to))) r.time = true;
  return r;
}

const dayInput = (d?: Date) => (d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : '');
const EMPTY: Criteria = { query: '', keys: [], time: {} };

export function Timeline(p: $TimelineSettings) {
  const t = useControlText(TEXTS);
  const { intlLocale, timeZone } = useControlLocale();
  const [now] = useState(() => new Date());
  const threshold = p.growingThreshold ?? 5;
  const [shown, setShown] = useState(threshold);
  const [criteria, setCriteria] = useState<Criteria>(EMPTY);
  const [kept, setKept] = useState<Set<string>>(() => new Set());
  const [oldestFirst, setOldestFirst] = useState(!!p.sortOldestFirst);
  const [propOldest, setPropOldest] = useState(p.sortOldestFirst);
  if (p.sortOldestFirst !== propOldest) {
    setPropOldest(p.sortOldestFirst);
    setOldestFirst(!!p.sortOldestFirst);
  }
  const [filterOpen, setFilterOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  // setModelFilter: `pendingFilters` holds the latest call, `modelFilters` what is applied (refresh: false waits)
  const pendingFilters = useRef<ModelFilters>({});
  const [modelFilters, setModelFilters] = useState<ModelFilters>({});
  const [customFilters, setCustomFilters] = useState<ReadonlyMap<string, TimelineItemFilter>>(() => new Map());
  // setModelFilterMessage / setCustomFilterMessage
  const [messages, setMessages] = useState<{ data?: string; range?: string; custom?: string }>({});
  const [rangeType, setRangeType] = useState<TimelineGroupType | undefined>();
  const [customGroupBy, setCustomGroupBy] = useState<{ fn: (date: Date) => TimelineCustomGroup } | null>(null);
  const groupsRef = useRef<TimelineGroup[]>([]);
  const horizontal = p.axisOrientation === 'Horizontal';
  const groupBy = p.groupByType ?? 'None';

  const all: Entry[] = elementsOf<$TimelineItemSettings>(p.children, TimelineItem)
    .map(({ key, props }, index) => ({ id: key ?? `i${index}`, item: { ...props, key }, date: toDate(props.dateTime), index }));
  const options: TimelineFilterListItem[] = p.filterList
    ?? [...new Set(all.map((e) => e.item.filterValue).filter((v): v is string => !!v))].map((key) => ({ key, text: key }));

  /** New filter criteria: fires itemFiltering for each item that would be hidden (preventDefault keeps it). */
  const apply = (next: Criteria, change?: Timeline$FilterSelectionChangeEvent, mf: ModelFilters = modelFilters) => {
    const keep = new Set<string>();
    for (const e of all) {
      const reasons = failing(e, next, mf);
      if (!Object.keys(reasons).length || !p.onItemFiltering) continue;
      const ev = preventable({ item: e.item, reasons, dataKeys: next.keys, timeKeys: next.time, searchTerm: next.query });
      p.onItemFiltering(ev);
      if (ev.defaultPrevented) keep.add(e.id);
    }
    setCriteria(next);
    setKept(keep);
    setShown(threshold);
    if (change) p.onFilterSelectionChange?.(change);
  };
  /** A user change of one filter type: it drops the model filter and the message of that type (as Timeline._filterData). */
  const userApply = (type: TimelineFilterType, next: Criteria, change: Timeline$FilterSelectionChangeEvent) => {
    const mf = { ...pendingFilters.current };
    delete mf[type];
    pendingFilters.current = mf;
    setModelFilters(mf);
    if (type !== 'Search') setMessages((m) => ({ ...m, [type === 'Data' ? 'data' : 'range']: undefined }));
    apply(next, change, mf);
  };
  /** The clear icon of the filter info bar (Timeline._clearFilter): item and time filters, their model filters and messages, custom filters. */
  const clearFilter = () => {
    const mf = { ...pendingFilters.current };
    delete mf.Data;
    delete mf.Time;
    pendingFilters.current = mf;
    setModelFilters(mf);
    setCustomFilters(new Map());
    setMessages({});
    apply({ ...criteria, keys: [], time: {} }, { clear: true }, mf);
  };
  const reset = () => {
    setCriteria(EMPTY);
    setKept(new Set());
    setShown(threshold);
    setOldestFirst(!!p.sortOldestFirst);
  };
  useImperativeHandle(p.ref, () => ({
    reset,
    resetTimeLimits: () => setCriteria((c) => ({ ...c, time: {} })),
    adjustUI: () => {},
    setCustomMessage: (m) => setMessage(m || null),
    getCurrentFilter: () => criteria.keys.map((key) => {
      const o = options.find((x) => x.key === key);
      return { key, text: o?.text || key };
    }),
    setCurrentFilter: (aSelectedItemKeys) => {
      if (!aSelectedItemKeys) return;
      const wanted = Array.isArray(aSelectedItemKeys) ? aSelectedItemKeys : [aSelectedItemKeys];
      apply({ ...criteria, keys: options.filter((o) => wanted.includes(o.key)).map((o) => o.key) });
    },
    setCurrentSearch: (sSearchTerm) => apply({ ...criteria, query: sSearchTerm ?? '' }),
    setCurrentTimeFilter: (mArguments) => {
      setRangeType(mArguments.type);
      apply({ ...criteria, time: { from: mArguments.from ?? undefined, to: mArguments.to ?? undefined } });
    },
    getGroups: () => groupsRef.current,
    setCustomGrouping: (fnGroupBy) => setCustomGroupBy(fnGroupBy ? { fn: fnGroupBy } : null),
    setModelFilter: ({ type, filter, refresh }) => {
      const mf = { ...pendingFilters.current };
      if (filter) mf[type] = filter;
      else delete mf[type];
      pendingFilters.current = mf;
      if (refresh === false) return;
      setModelFilters(mf);
      // a removed Time filter also resets the dates (as in UI5)
      apply(type === 'Time' && !filter ? { ...criteria, time: {} } : criteria, undefined, mf);
    },
    setCustomModelFilter: (sFilterId, oFilter) => setCustomFilters((m) => {
      const next = new Map(m);
      if (oFilter) next.set(sFilterId, oFilter);
      else next.delete(sFilterId);
      return next;
    }),
    setModelFilterMessage: (sType, sMessage) => {
      if (sType === 'Data') setMessages((m) => ({ ...m, data: sMessage }));
      if (sType === 'Time') setMessages((m) => ({ ...m, range: sMessage }));
    },
    setCustomFilterMessage: (sMessage) => setMessages((m) => ({ ...m, custom: sMessage })),
  }));

  const custom = [...customFilters.values()];
  const sorted = all.filter((e) => custom.every((f) => f(e.item)) && (kept.has(e.id) || !Object.keys(failing(e, criteria, modelFilters)).length));
  if (p.sort !== false) {
    sorted.sort((a, b) => {
      if (!a.date || !b.date) return a.date ? -1 : b.date ? 1 : a.index - b.index;
      return (oldestFirst ? 1 : -1) * (a.date.getTime() - b.date.getTime()) || a.index - b.index;
    });
  }
  const visible = threshold > 0 ? sorted.slice(0, shown) : sorted;

  const groups: Array<{ key: string; text?: string; date?: Date; entries: Entry[] }> = [];
  for (const e of visible) {
    const own = customGroupBy && e.date ? customGroupBy.fn(e.date) : undefined;
    const g = own ? { key: own.key, text: own.title, date: own.date ?? e.date }
      : groupBy !== 'None' && e.date ? { ...timelineGroup(t, groupBy, e.date, intlLocale, timeZone), date: e.date } : { key: '', text: undefined, date: undefined };
    const last = groups[groups.length - 1];
    if (last && last.key === g.key) last.entries.push(e);
    else groups.push({ key: g.key, text: g.text, date: g.date, entries: [e] });
  }
  groupsRef.current = groups.filter((g) => g.text !== undefined).map((g) => ({ key: g.key, title: g.text!, dateTime: g.date }));

  // the filter info bar text (Timeline._getFilterMessage / _getRangeMessage)
  const rangeTitle = (d: Date | undefined) => (d ? timelineGroup(t, rangeType && rangeType !== 'None' ? rangeType : 'Day', d, intlLocale, timeZone).text : '');
  const infoParts: string[] = [];
  if (messages.data) infoParts.push(messages.data);
  else if (criteria.keys.length) {
    infoParts.push(`${p.filterTitle || t('ctl.timeline.filterItems')} (${criteria.keys.map((k) => options.find((o) => o.key === k)?.text || k).join(', ')})`);
  }
  // UI5's range filter always has both dates; here one date is enough to show the range part
  if (messages.range) infoParts.push(messages.range);
  else if (criteria.time.from || criteria.time.to) infoParts.push(`${t('ctl.timeline.rangeSelection')} (${rangeTitle(criteria.time.from)} - ${rangeTitle(criteria.time.to)})`);
  if (messages.custom) infoParts.push(messages.custom);
  const filterInfo = infoParts.length ? t('ctl.timeline.filterInfoBy', { text: infoParts.join(', ') }) : null;

  const select = (item: TimelineSelectedItem) => {
    item.onPress?.();
    item.onSelect?.();
    p.onSelect?.({ selectedItem: item, userAction: true });
  };

  const total = visible.length;
  let done = 0;
  let side = 0;
  const showFilter = (p.showItemFilter !== false && options.length > 0) || p.showTimeFilter !== false || !!p.customFilter;
  const showBar = p.showHeaderBar !== false && (p.showSearch !== false || (p.showSort !== false && p.sort !== false) || showFilter);
  const activeFilters = criteria.keys.length > 0 || !!criteria.time.from || !!criteria.time.to;
  const align = (p.alignment ?? 'Right').toLowerCase();
  const scroll = p.enableScroll !== false && !!p.height;

  return (
    <div
      className={cx('sk-timeline', horizontal ? 'sk-timeline--horizontal' : 'sk-timeline--vertical', `sk-timeline--align-${align}`,
        p.enableDoubleSided && !horizontal && 'sk-timeline--double', scroll && 'sk-timeline--scroll')}
      style={{ inlineSize: p.width ?? '100%', blockSize: p.height || undefined }}
    >
      {showBar && (
        <div className="sk-timeline__bar" role="toolbar" aria-label={p['aria-label'] ?? t('ctl.timeline.label')}>
          {p.showSearch !== false && (
            <TextInput className="sk-timeline__search" size="xs" type="search" placeholder={t('ctl.timeline.search')} aria-label={t('ctl.timeline.search')}
              leftSection={<Search className="sk-timeline__bar-icon" aria-hidden="true" />} value={criteria.query}
              onChange={(ev) => userApply('Search', { ...criteria, query: ev.currentTarget.value }, { type: 'Search', searchTerm: ev.currentTarget.value })} />
          )}
          {p.showSort !== false && p.sort !== false && (
            <Button className="sk-timeline__sort" size="xs" variant="subtle" aria-label={t('ctl.timeline.sort')} aria-pressed={oldestFirst} title={t('ctl.timeline.sort')}
              onClick={() => setOldestFirst((x) => !x)}>
              <ArrowDownUp className="sk-timeline__bar-icon" aria-hidden="true" />
            </Button>
          )}
          {showFilter && (
            <Popover opened={filterOpen} onChange={setFilterOpen} position="bottom-end" withinPortal trapFocus>
              <Popover.Target>
                <Button className={cx('sk-timeline__filter', activeFilters && 'sk-timeline__filter--active')} size="xs" variant={activeFilters ? 'light' : 'subtle'}
                  aria-label={p.filterTitle ?? t('ctl.timeline.filterTitle')} aria-haspopup="dialog" aria-expanded={filterOpen}
                  onClick={() => {
                    if (!filterOpen) p.onFilterOpen?.();
                    setFilterOpen((o) => !o);
                  }}>
                  <Filter className="sk-timeline__bar-icon" aria-hidden="true" />
                </Button>
              </Popover.Target>
              <Popover.Dropdown className="sk-timeline__filter-popover" role="dialog" aria-label={p.filterTitle ?? t('ctl.timeline.filterTitle')}>
                <div className="sk-timeline__filter-title">{p.filterTitle ?? t('ctl.timeline.filterTitle')}</div>
                {p.customFilter ?? (
                  <>
                    {p.showItemFilter !== false && options.length > 0 && (
                      <Checkbox.Group value={criteria.keys} onChange={(keys) => userApply('Data', { ...criteria, keys }, {
                        type: 'Data', selectedItem: keys[0], selectedItems: options.filter((o) => keys.includes(o.key)),
                      })}>
                        <div className="sk-timeline__filter-list">
                          {options.map((o) => <Checkbox key={o.key} size="xs" value={o.key} label={o.text ?? o.key} />)}
                        </div>
                      </Checkbox.Group>
                    )}
                    {p.showTimeFilter !== false && (
                      <div className="sk-timeline__filter-time">
                        {(['from', 'to'] as const).map((k) => (
                          <TextInput key={k} size="xs" type="date" label={t(k === 'from' ? 'ctl.timeline.from' : 'ctl.timeline.to')} value={dayInput(criteria.time[k])}
                            onChange={(ev) => {
                              const v = ev.currentTarget.value;
                              const d = v ? new Date(`${v}T${k === 'from' ? '00:00:00' : '23:59:59.999'}`) : undefined;
                              const time = { ...criteria.time, [k]: d };
                              userApply('Time', { ...criteria, time }, { type: 'Time', timeKeys: time });
                            }} />
                        ))}
                      </div>
                    )}
                    <Button size="xs" variant="subtle" onClick={() => apply({ ...criteria, keys: [], time: {} }, { clear: true })}>{t('ctl.timeline.clear')}</Button>
                  </>
                )}
              </Popover.Dropdown>
            </Popover>
          )}
        </div>
      )}
      {filterInfo && (
        <div className="sk-timeline__filter-info" role="status" title={filterInfo} data-sk-timeline-filter-info>
          <span>{filterInfo}</span>
          <button type="button" className="sk-timeline__message-close" aria-label={t('ctl.timeline.clear')} title={t('ctl.timeline.clear')} onClick={clearFilter}>
            <X className="sk-timeline__bar-icon" aria-hidden="true" />
          </button>
        </div>
      )}
      {message && (
        <div className="sk-timeline__message" role="status">
          <span>{message}</span>
          <button type="button" className="sk-timeline__message-close" aria-label={t('ctl.timeline.close')} onClick={() => { setMessage(null); p.onCustomMessageClosed?.(); }}>
            <X className="sk-timeline__bar-icon" aria-hidden="true" />
          </button>
        </div>
      )}
      {total === 0
        ? <div className="sk-timeline__empty" role="status">{p.noDataText ?? t('ctl.timeline.noData')}</div>
        : (
          <ul className="sk-timeline__list" aria-label={p['aria-label'] ?? t('ctl.timeline.label')}>
            {groups.map((g) => {
              const items = g.entries.map((e) => (
                <TimelineEntry key={e.id} e={e} last={++done === total} end={!!p.enableDoubleSided && !horizontal && side++ % 2 === 1}
                  showIcons={p.showIcons !== false} social={!!p.enableSocial} textHeight={p.textHeight} now={now}
                  pressable={!!(e.item.onSelect || e.item.onPress || p.onSelect)} onSelect={select} />
              ));
              return g.text === undefined ? items : (
                <li key={`group-${g.key}`} className="sk-timeline__group">
                  <div className="sk-timeline__group-header" role="heading" aria-level={3}>{g.text}</div>
                  <ul className="sk-timeline__group-list">{items}</ul>
                </li>
              );
            })}
          </ul>
        )}
      {threshold > 0 && sorted.length > visible.length && (
        <Button className="sk-timeline__more" variant="subtle" size="xs" onClick={() => { setShown((s) => s + threshold); p.onGrow?.(); }}>{t('ctl.timeline.more')}</Button>
      )}
    </div>
  );
}

function TimelineEntry(p: {
  e: Entry; last: boolean; end: boolean; showIcons: boolean; social: boolean; textHeight?: string; now: Date; pressable: boolean;
  onSelect: (item: TimelineSelectedItem) => void;
}) {
  const t = useControlText(TEXTS);
  const { intlLocale, timeZone } = useControlLocale();
  const [expanded, setExpanded] = useState(false);
  const [replying, setReplying] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [reply, setReply] = useState('');
  const { item, date } = p.e;
  const press = () => p.onSelect(item);
  const max = item.maxCharacters;
  const text = item.text ?? '';
  const long = !!max && text.length > max;
  const tooltip = item.iconTooltip ?? (item.useIconTooltip !== false ? item.title : undefined);
  const av = avatarProps(item.iconSize ?? 'XS', item.iconDisplayShape);
  const glyph = !p.showIcons ? <span className="sk-timeline__dot" />
    : item.icon ?? (item.iconInitials ? <Avatar className="sk-timeline__avatar" size={av.size} radius={av.radius}>{item.iconInitials}</Avatar> : <span className="sk-timeline__dot" />);
  const stop = (fn: () => void) => (ev: { stopPropagation(): void }) => {
    ev.stopPropagation();
    fn();
  };
  return (
    <li className={cx('sk-timeline__item', p.end && 'sk-timeline__item--end')} data-status={item.status ?? 'None'}>
      <span className={`sk-timeline__icon sk-status--${toneOf(item.status)}`} title={tooltip} aria-hidden="true">{glyph}</span>
      {!p.last && <span className="sk-timeline__line" aria-hidden="true" />}
      <div
        className={cx('sk-timeline__box', p.pressable && 'sk-timeline__box--active')}
        role={p.pressable ? 'button' : undefined}
        tabIndex={p.pressable ? 0 : undefined}
        onClick={p.pressable ? press : undefined}
        onKeyDown={p.pressable ? pressKeys(press) : undefined}
      >
        {(item.userName || date) && (
          <div className="sk-timeline__meta">
            {item.userPicture && <Avatar className="sk-timeline__user-picture" src={item.userPicture} alt="" size="sm" radius="xl" />}
            {item.userName && (item.userNameClickable
              ? <button type="button" className="sk-timeline__user sk-timeline__user--active" onClick={(ev) => { ev.stopPropagation(); item.onUserNameClicked?.({ uiElement: ev.currentTarget }); }}>{item.userName}</button>
              : <span className="sk-timeline__user">{item.userName}</span>)}
            {date && <time className="sk-timeline__date" dateTime={date.toISOString()}>{relativeDateTime(t, intlLocale, date, p.now, timeZone)}</time>}
          </div>
        )}
        {item.title && <div className="sk-timeline__title">{item.title}</div>}
        {text && (
          <div className="sk-timeline__text" style={p.textHeight ? { maxBlockSize: p.textHeight } : undefined}>
            {long && !expanded ? `${text.slice(0, max).trimEnd()}…` : text}
            {long && (
              <button type="button" className="sk-timeline__more-text" aria-expanded={expanded} onClick={stop(() => setExpanded((x) => !x))}>
                {t(expanded ? 'ctl.timeline.less' : 'ctl.timeline.more')}
              </button>
            )}
          </div>
        )}
        {item.children !== undefined && <div className="sk-timeline__embedded">{item.children}</div>}
        {(p.social || !!item.customAction?.length) && (
          <div className="sk-timeline__footer">
            {p.social && (
              <button type="button" className="sk-timeline__link" aria-expanded={replying} onClick={stop(() => {
                if (!replying) item.onReplyListOpen?.();
                setReplying((x) => !x);
              })}>{t('ctl.timeline.reply')}</button>
            )}
            {p.social && !!item.replyCount && (
              <button type="button" className="sk-timeline__link" aria-expanded={item.replyList !== undefined ? listOpen : undefined} onClick={stop(() => {
                if (!listOpen) item.onReplyListOpen?.();
                setListOpen((x) => !x);
              })}>{t('ctl.timeline.replies', { count: item.replyCount })}</button>
            )}
            {item.customAction?.map((a) => (
              <button key={a.key} type="button" className="sk-timeline__link"
                onClick={(ev) => { ev.stopPropagation(); item.onCustomActionClicked?.({ value: a.value, key: a.key, linkObj: ev.currentTarget }); }}>{a.value}</button>
            ))}
          </div>
        )}
        {p.social && (replying || listOpen) && item.replyList !== undefined && item.customReply === undefined && (
          <div className="sk-timeline__reply-list" onClick={(ev) => ev.stopPropagation()} onKeyDown={(ev) => ev.stopPropagation()}>{item.replyList}</div>
        )}
        {p.social && replying && (
          <div className="sk-timeline__reply" onClick={(ev) => ev.stopPropagation()} onKeyDown={(ev) => ev.stopPropagation()}>
            {item.customReply ?? (
              <>
                <Textarea size="xs" rows={2} value={reply} aria-label={t('ctl.timeline.reply')} onChange={(ev) => setReply(ev.currentTarget.value)} />
                <Button size="xs" disabled={!reply.trim()} onClick={() => { item.onReplyPost?.({ value: reply }); setReply(''); setReplying(false); }}>{t('ctl.timeline.reply')}</Button>
              </>
            )}
          </div>
        )}
      </div>
    </li>
  );
}
