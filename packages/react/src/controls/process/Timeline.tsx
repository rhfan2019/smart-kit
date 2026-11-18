/**
 * Timeline + TimelineItem (sap.suite.ui.commons.Timeline), docs/26 §3.6: items as JSX children (aggregation `content`),
 * newest first (or oldest first), vertical or horizontal, "More" after `growingThreshold` items, grouping headers and a
 * header bar with search, sort and a filter popover (item filter, time filter or `customFilter`).
 */
import { Avatar, Button, Checkbox, Popover, Textarea, TextInput } from '@mantine/core';
import { ArrowDownUp, Filter, Search, X } from 'lucide-react';
import { useImperativeHandle, useState, type ReactNode, type Ref } from 'react';
import { relativeDateTime } from '../../cards/format';
import type { TextFn } from '../../i18n/text';
import { useControlLocale, useControlText } from '../context';
import { elementsOf, preventable, toneOf, type PreventableEvent, type ValueState } from '../types';
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

export interface TimelineItemProps {
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
  /** Default false. */
  userNameClickable?: boolean;
  /** Image URL of the user, shown next to the name. */
  userPicture?: string;
  /** Icon on the axis (React node). */
  icon?: ReactNode;
  /** Default 'Circle'. */
  iconDisplayShape?: AvatarShape;
  /** Initials on the axis when there is no icon. */
  iconInitials?: string;
  /** Default 'XS'. */
  iconSize?: AvatarSize;
  iconTooltip?: string;
  /** Uses the title as tooltip of the icon when `iconTooltip` is not set (default true). */
  useIconTooltip?: boolean;
  /** Links in the item footer. */
  customAction?: TimelineCustomAction[];
  /** Replaces the reply box (with `enableSocial`). */
  customReply?: ReactNode;
  /** Embedded content (UI5 default aggregation `embeddedControl`). */
  children?: ReactNode;
  onUserNameClicked?: (e: { uiElement: HTMLElement }) => void;
  onSelect?: () => void;
  onPress?: () => void;
  onReplyPost?: (e: { value: string }) => void;
  onReplyListOpen?: () => void;
  onCustomActionClicked?: (e: { value: string; key: string; linkObj: HTMLElement }) => void;
}

/** An entry of Timeline; rendered by its parent. */
export function TimelineItem(_: TimelineItemProps): null {
  return null;
}

/** A Timeline item in event objects: its props and React key. */
export type TimelineSelectedItem = TimelineItemProps & { key?: string };

/** Why an item is filtered out (event `itemFiltering`). */
export interface TimelineFilterReasons { search?: boolean; data?: boolean; time?: boolean }
export interface TimelineTimeKeys { from?: Date; to?: Date }

export interface TimelineFilterSelectionChangeEvent {
  type?: TimelineFilterType;
  searchTerm?: string;
  /** Key of the first selected filter item. */
  selectedItem?: string;
  selectedItems?: TimelineFilterListItem[];
  timeKeys?: TimelineTimeKeys;
  clear?: boolean;
}

export interface TimelineItemFilteringEvent {
  item: TimelineSelectedItem;
  reasons: TimelineFilterReasons;
  dataKeys: string[];
  timeKeys: TimelineTimeKeys;
  searchTerm: string;
}

export interface TimelineProps {
  children?: ReactNode;
  /** Default 'Right'. */
  alignment?: TimelineAlignment;
  /** Default 'Vertical'. */
  axisOrientation?: TimelineAxisOrientation;
  /** Vertical axis with items alternating on both sides (default false). */
  enableDoubleSided?: boolean;
  /** Default true; false shows dots instead of the item icons. */
  showIcons?: boolean;
  /** CSS width (default '100%'). */
  width?: string;
  /** CSS height; with `enableScroll` the list scrolls inside it. */
  height?: string;
  /** CSS maximum height of item texts (they scroll beyond it). */
  textHeight?: string;
  noDataText?: string;
  /** Accepted for UI5 code; no effect (no data binding, ADR-032 rule 7). */
  enableBusyIndicator?: boolean;
  enableModelFilter?: boolean;
  groupBy?: string;
  dateTimePath?: string;
  lazyLoading?: boolean;
  /** Default true. */
  enableScroll?: boolean;
  /** Reply link and reply count on the items (default false). */
  enableSocial?: boolean;
  /** Growing even without paging data (default false; items always grow on the client here). */
  forceGrowing?: boolean;
  /** Items shown before "More" (default 5; 0 shows all). */
  growingThreshold?: number;
  /** Sorts by date (default true). */
  sort?: boolean;
  /** Default false (newest first). */
  sortOldestFirst?: boolean;
  /** Default 'None'. */
  groupByType?: TimelineGroupType;
  /** Default true. */
  showHeaderBar?: boolean;
  /** Default true. */
  showSearch?: boolean;
  /** Default true. */
  showSort?: boolean;
  /** Filter by the items' `filterValue` (default true). */
  showItemFilter?: boolean;
  /** Filter by a date range (default true). */
  showTimeFilter?: boolean;
  /** Title of the filter popover. */
  filterTitle?: string;
  /** Replaces the content of the filter popover. */
  customFilter?: ReactNode;
  /** Options of the item filter; default the distinct `filterValue`s. */
  filterList?: TimelineFilterListItem[];
  onSelect?: (e: { selectedItem: TimelineSelectedItem; userAction: boolean }) => void;
  onGrow?: () => void;
  onFilterOpen?: () => void;
  onFilterSelectionChange?: (e: TimelineFilterSelectionChangeEvent) => void;
  /** Fired for each item a filter would hide; `preventDefault()` keeps it. */
  onItemFiltering?: (e: PreventableEvent<TimelineItemFilteringEvent>) => void;
  onCustomMessageClosed?: () => void;
  ref?: Ref<TimelineRef>;
  'aria-label'?: string;
}

/** Instance methods of Timeline (via `ref`). */
export interface TimelineRef {
  /** Clears search, filters and growing. */
  reset(): void;
  /** Clears the time filter. */
  resetTimeLimits(): void;
  /** Recalculates the layout (nothing to do in React; kept for UI5 code). */
  adjustUI(): void;
  /** Shows a message strip above the items; closing it fires `onCustomMessageClosed`. */
  setCustomMessage(message: string | null): void;
}

interface Entry { id: string; item: TimelineSelectedItem; date?: Date; index: number }
interface Criteria { query: string; keys: string[]; time: TimelineTimeKeys }

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

/** The filters an item fails (empty object: it is shown). */
function failing(e: Entry, c: Criteria): TimelineFilterReasons {
  const r: TimelineFilterReasons = {};
  const q = c.query.trim().toLowerCase();
  if (q && ![e.item.title, e.item.text, e.item.userName, e.item.filterValue].some((v) => v?.toLowerCase().includes(q))) r.search = true;
  if (c.keys.length && !c.keys.includes(e.item.filterValue ?? '')) r.data = true;
  if ((c.time.from || c.time.to) && (!e.date || (c.time.from && e.date < c.time.from) || (c.time.to && e.date > c.time.to))) r.time = true;
  return r;
}

const dayInput = (d?: Date) => (d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : '');
const EMPTY: Criteria = { query: '', keys: [], time: {} };

export function Timeline(p: TimelineProps) {
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
  const horizontal = p.axisOrientation === 'Horizontal';
  const groupBy = p.groupByType ?? 'None';

  const all: Entry[] = elementsOf<TimelineItemProps>(p.children, TimelineItem)
    .map(({ key, props }, index) => ({ id: key ?? `i${index}`, item: { ...props, key }, date: toDate(props.dateTime), index }));
  const options: TimelineFilterListItem[] = p.filterList
    ?? [...new Set(all.map((e) => e.item.filterValue).filter((v): v is string => !!v))].map((key) => ({ key, text: key }));

  /** New filter criteria: fires itemFiltering for each item that would be hidden (preventDefault keeps it). */
  const apply = (next: Criteria, change: TimelineFilterSelectionChangeEvent) => {
    const keep = new Set<string>();
    for (const e of all) {
      const reasons = failing(e, next);
      if (!Object.keys(reasons).length || !p.onItemFiltering) continue;
      const ev = preventable({ item: e.item, reasons, dataKeys: next.keys, timeKeys: next.time, searchTerm: next.query });
      p.onItemFiltering(ev);
      if (ev.defaultPrevented) keep.add(e.id);
    }
    setCriteria(next);
    setKept(keep);
    setShown(threshold);
    p.onFilterSelectionChange?.(change);
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
  }));

  const sorted = all.filter((e) => kept.has(e.id) || !Object.keys(failing(e, criteria)).length);
  if (p.sort !== false) {
    sorted.sort((a, b) => {
      if (!a.date || !b.date) return a.date ? -1 : b.date ? 1 : a.index - b.index;
      return (oldestFirst ? 1 : -1) * (a.date.getTime() - b.date.getTime()) || a.index - b.index;
    });
  }
  const visible = threshold > 0 ? sorted.slice(0, shown) : sorted;

  const groups: Array<{ key: string; text?: string; entries: Entry[] }> = [];
  for (const e of visible) {
    const g = groupBy !== 'None' && e.date ? timelineGroup(t, groupBy, e.date, intlLocale, timeZone) : { key: '', text: undefined };
    const last = groups[groups.length - 1];
    if (last && last.key === g.key) last.entries.push(e);
    else groups.push({ key: g.key, text: g.text, entries: [e] });
  }

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
              onChange={(ev) => apply({ ...criteria, query: ev.currentTarget.value }, { type: 'Search', searchTerm: ev.currentTarget.value })} />
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
                      <Checkbox.Group value={criteria.keys} onChange={(keys) => apply({ ...criteria, keys }, {
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
                              apply({ ...criteria, time }, { type: 'Time', timeKeys: time });
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
            {p.social && <button type="button" className="sk-timeline__link" aria-expanded={replying} onClick={stop(() => setReplying((x) => !x))}>{t('ctl.timeline.reply')}</button>}
            {p.social && !!item.replyCount && (
              <button type="button" className="sk-timeline__link" onClick={stop(() => item.onReplyListOpen?.())}>{t('ctl.timeline.replies', { count: item.replyCount })}</button>
            )}
            {item.customAction?.map((a) => (
              <button key={a.key} type="button" className="sk-timeline__link"
                onClick={(ev) => { ev.stopPropagation(); item.onCustomActionClicked?.({ value: a.value, key: a.key, linkObj: ev.currentTarget }); }}>{a.value}</button>
            ))}
          </div>
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
