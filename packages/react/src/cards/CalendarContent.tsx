/**
 * Calendar card content (sap.ui.integration.cards.CalendarContent) — docs/20 §2.2, [CAL].
 * A month calendar with week numbers, today, the selected day and special days; a legend (squares: special days,
 * circles: appointment types) with "More (x)"; the appointments of the selected day with "More". The date picker
 * drills down in place: days → months → years → year ranges. Two columns above 589 px (container query).
 * Appointments come from Communication.Event (dtstart, dtend, summary, description, categories) or `item`.
 */
import { resolvePath, type FilterState, type Row } from '@rhfan2019/smart-kit-core';
import { useCallback, useMemo, useState, type KeyboardEvent } from 'react';
import { useMetaModel, useSmartKit, useText } from '../context/SmartKitProvider';
import { useListQuery } from '../table/useListQuery';
import { cardFilters, qualifierOf } from './annotations';
import { hasListPage, useReportHeaderDefaults, useReportToCard } from './CardContext';
import { CardMessage, CardPlaceholder } from './CardStates';
import { eventColumns, eventPaths, toEvents, type CardEvent, type EventItemPaths } from './events';
import { durationText } from './format';
import { itemKeyDown } from './ListContent';
import { CalendarIcon } from './TimelineContent';

export interface CalendarSpecialDate {
  /** Day, "YYYY-MM-DD". */
  startDate: string;
  /** Last day of a range, "YYYY-MM-DD". */
  endDate?: string;
  /** Legend type (matches `CalendarLegendItem.type`). */
  type: string;
}

export interface CalendarLegendItem {
  /** "calendar": special days (square); "appointment": appointment types (circle). */
  category: 'calendar' | 'appointment';
  text: string;
  type: string;
}

export interface CalendarContentProps {
  entitySet: string;
  service?: string;
  /** Property paths of the appointments; default Communication.Event. */
  item?: EventItemPaths;
  /** UI.SelectionVariant that filters the appointments. */
  selectionAnnotationPath?: string;
  filters?: FilterState;
  /** Initially selected day, "YYYY-MM-DD" (default today). */
  date?: string;
  /** Visible appointments of the selected day (default 2). */
  maxItems?: number;
  /** Visible legend items (default 2); the rest are counted in "More (x)". */
  maxLegendItems?: number;
  noItemsText?: string;
  specialDates?: CalendarSpecialDate[];
  /** Legend items (texts of special day types, for example); the appointment types found are added (one circle each). */
  legendItems?: CalendarLegendItem[];
  onAppointmentPress?(row: Row): void;
  /** Press of "More"; default: the list page of the entity set. */
  onMorePress?(date: string): void;
  /** Called when the user selects a day. */
  onSelect?(date: string): void;
  /** First day of the week, 0 = Sunday … 6 = Saturday; default from the locale. */
  firstDayOfWeek?: number;
  /** Reference time for "today" (default now). */
  now?: Date;
}

// ---------------------------------------------------------------- dates as "YYYY-MM-DD" (no time zone arithmetic)
const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (y: number, m: number, d: number) => {
  const t = new Date(Date.UTC(y, m, d));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
};
const parts = (s: string) => ({ y: Number(s.slice(0, 4)), m: Number(s.slice(5, 7)) - 1, d: Number(s.slice(8, 10)) });
const weekday = (s: string) => new Date(`${s}T00:00:00Z`).getUTCDay();
const addDays = (s: string, n: number) => {
  const { y, m, d } = parts(s);
  return ymd(y, m, d + n);
};
const dayOf = (date: Date, timeZone?: string) => new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);

/** First day of the week of a locale (Intl.Locale weekInfo; fallback Sunday for en-US, Monday otherwise). */
export function firstDayOf(locale: string): number {
  try {
    const l = new Intl.Locale(locale) as Intl.Locale & { weekInfo?: { firstDay: number }; getWeekInfo?(): { firstDay: number } };
    const info = l.getWeekInfo?.() ?? l.weekInfo;
    if (info) return info.firstDay % 7;
  } catch {
    // older engines
  }
  return locale === 'en-US' ? 0 : 1;
}

/** Week number of a row: US numbering for Sunday-first weeks, ISO 8601 otherwise (as SAPUI5 per locale). */
export function weekNumber(rowStart: string, firstDay: number): number {
  if (firstDay === 0) {
    const { y } = parts(addDays(rowStart, 6));
    const jan1 = `${y}-01-01`;
    const diff = (Date.parse(`${addDays(rowStart, 6)}T00:00:00Z`) - Date.parse(`${jan1}T00:00:00Z`)) / 86400000;
    return Math.floor((diff + weekday(jan1)) / 7) + 1;
  }
  const thursday = addDays(rowStart, (4 - weekday(rowStart) + 7) % 7);
  const { y } = parts(thursday);
  return Math.floor((Date.parse(`${thursday}T00:00:00Z`) - Date.parse(`${y}-01-01T00:00:00Z`)) / 86400000 / 7) + 1;
}

/** The 6 × 7 days of a month view starting on `firstDay`. */
export function monthGrid(year: number, month: number, firstDay: number): string[] {
  const first = ymd(year, month, 1);
  const start = addDays(first, -((weekday(first) - firstDay + 7) % 7));
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

type Level = 'day' | 'month' | 'year' | 'range';
const YEARS = 20;

export function CalendarContent(p: CalendarContentProps) {
  const meta = useMetaModel(p.entitySet, { service: p.service });
  const { intlLocale, timeZone, navigation } = useSmartKit();
  const t = useText();
  const now = p.now ?? new Date();
  const today = dayOf(now, timeZone);
  const [selected, setSelected] = useState(p.date ?? today);
  const [view, setView] = useState(() => ({ y: parts(p.date ?? today).y, m: parts(p.date ?? today).m }));
  const [level, setLevel] = useState<Level>('day');
  const firstDay = p.firstDayOfWeek ?? firstDayOf(intlLocale);

  const paths = eventPaths(meta.ui, p.item);
  const columns = useMemo(() => eventColumns(paths), [paths.startDate, paths.endDate, paths.title, paths.text, paths.type]); // eslint-disable-line react-hooks/exhaustive-deps
  const grid = useMemo(() => monthGrid(view.y, view.m, firstDay), [view.y, view.m, firstDay]);
  const conditions = p.selectionAnnotationPath !== undefined ? meta.ui.selectionVariants[qualifierOf(p.selectionAnnotationPath)] : undefined;
  // The appointments of the visible weeks (and of the selected day when it is outside them).
  const from = grid[0]! < selected ? grid[0]! : selected;
  const to = grid[41]! > selected ? grid[41]! : selected;
  const filters = useMemo(
    () => cardFilters(conditions, { ...(p.filters ?? {}), ...(paths.startDate ? { [paths.startDate]: [{ operator: 'BT' as const, values: [from, to] }] } : {}) }),
    [conditions, p.filters, paths.startDate, from, to],
  );
  const q = useListQuery({ service: p.service, source: { entitySet: p.entitySet }, columns, filters, sort: paths.startDate ? [{ path: paths.startDate, descending: false }] : [], pageSize: 500 });
  const typeTextPath = paths.type ? resolvePath(meta.service.model.entityTypes, meta.set.typeName, paths.type).property?.text : undefined;
  const events = useMemo(() => toEvents(q.rows, paths, typeTextPath), [q.rows, paths.startDate, paths.endDate, paths.title, paths.text, paths.type, typeTextPath]); // eslint-disable-line react-hooks/exhaustive-deps

  // Appointment types → colour index 1..6, in order of appearance.
  const types = useMemo(() => {
    const m = new Map<string, { text: string; index: number }>();
    for (const e of events) if (e.type && !m.has(e.type)) m.set(e.type, { text: e.typeText ?? e.type, index: (m.size % 6) + 1 });
    return m;
  }, [events]);
  const specialTypes = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of p.specialDates ?? []) if (!m.has(s.type)) m.set(s.type, (m.size % 6) + 1);
    for (const l of p.legendItems ?? []) if (l.category === 'calendar' && !m.has(l.type)) m.set(l.type, (m.size % 6) + 1);
    return m;
  }, [p.specialDates, p.legendItems]);

  // Appointments of the selected day; on today only the ones that have not ended ([CAL] appointment list).
  const ofDay = events.filter((e) => dayOf(e.start, timeZone) === selected);
  const current = selected === today ? ofDay.filter((e) => (e.end ?? e.start).getTime() > now.getTime()) : ofDay;
  const max = p.maxItems ?? 2;
  const visible = current.slice(0, max);

  const svc = meta.service.name;
  const entitySet = p.entitySet;
  const headerPress = useCallback(() => navigation?.toList(entitySet, svc), [navigation, entitySet, svc]);
  useReportToCard(q.isLoading || q.error ? undefined : { visible: visible.length, total: current.length }, hasListPage(navigation, entitySet, svc) ? headerPress : undefined);
  useReportHeaderDefaults({ title: meta.ui.headerInfo.typeNamePlural });

  if (q.error) return <CardMessage kind="error" />;

  const select = (d: string) => {
    setSelected(d);
    const { y, m } = parts(d);
    setView({ y, m });
    p.onSelect?.(d);
  };
  // Legend: the given items first, then the special day and appointment types found that they do not name.
  const given = (p.legendItems ?? []).map((l) => ({ ...l, index: l.category === 'calendar' ? specialTypes.get(l.type) ?? 1 : types.get(l.type)?.index ?? 1 }));
  const named = new Set(given.map((l) => `${l.category}:${l.type}`));
  const legend: (CalendarLegendItem & { index: number })[] = [
    ...given,
    ...[...specialTypes.entries()].filter(([type]) => !named.has(`calendar:${type}`)).map(([type, index]) => ({ category: 'calendar' as const, text: type, type, index })),
    ...[...types.entries()].filter(([type]) => !named.has(`appointment:${type}`)).map(([type, v]) => ({ category: 'appointment' as const, text: v.text, type, index: v.index })),
  ];
  const maxLegend = p.maxLegendItems ?? 2;
  const more = p.onMorePress ?? (hasListPage(navigation, entitySet, svc) ? () => navigation!.toList(entitySet, svc) : undefined);

  return (
    <div className="sk-card__calendar" aria-label={t('card.typeCalendar')}>
      <div className="sk-card__calendar-body">
      <div className="sk-card__calendar-left">
        <CalendarPicker
          level={level}
          setLevel={setLevel}
          view={view}
          setView={setView}
          grid={grid}
          selected={selected}
          today={today}
          firstDay={firstDay}
          select={select}
          specialDates={p.specialDates ?? []}
          specialTypes={specialTypes}
        />
        {legend.length > 0 && (
          <ul className="sk-card__legend">
            {legend.slice(0, maxLegend).map((l) => (
              <li key={`${l.category}-${l.type}`} className="sk-card__legend-item">
                <span className={`sk-card__legend-swatch sk-card__legend-swatch--${l.category} sk-card--category-${l.index}`} aria-hidden="true" />
                {l.text}
              </li>
            ))}
            {legend.length > maxLegend && <li className="sk-card__legend-item sk-card__legend-more">{t('card.legendMore', { count: legend.length - maxLegend })}</li>}
          </ul>
        )}
      </div>
      <div className="sk-card__calendar-right">
        {q.isLoading ? (
          <CardPlaceholder kind="calendar" rows={max} />
        ) : visible.length === 0 ? (
          <div className="sk-card__message">{p.noItemsText ?? t('card.noAppointments')}</div>
        ) : (
          <ul className="sk-card__appointments">
            {visible.map((e, i) => (
              <Appointment key={i} e={e} index={e.type ? types.get(e.type)?.index : undefined} onPress={p.onAppointmentPress} />
            ))}
          </ul>
        )}
        {current.length > max && more && (
          <div className="sk-card__more">
            <button type="button" className="sk-card__button" onClick={() => more(selected)}>{t('card.more')}</button>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}

function Appointment({ e, index, onPress }: { e: CardEvent; index?: number; onPress?(row: Row): void }) {
  const { intlLocale, timeZone } = useSmartKit();
  const t = useText();
  const time = new Intl.DateTimeFormat(intlLocale, { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(e.start);
  const minutes = e.end ? Math.round((e.end.getTime() - e.start.getTime()) / 60000) : undefined;
  const press = onPress ? () => onPress(e.row) : undefined;
  return (
    <li className="sk-card__appointment">
      <div className="sk-card__appointment-time">
        {time}
        {minutes !== undefined && minutes > 0 && <span className="sk-card__appointment-duration">{durationText(t, minutes)}</span>}
      </div>
      <div
        className={`sk-card__appointment-box sk-card--category-${index ?? 1}${press ? ' sk-card__appointment-box--pressable' : ''}`}
        tabIndex={press ? 0 : -1}
        onClick={press}
        onKeyDown={press ? itemKeyDown(press) : undefined}
      >
        <div className="sk-card__appointment-title"><CalendarIcon />{e.title}</div>
        {e.text && <div className="sk-card__appointment-text">{e.text}</div>}
      </div>
    </li>
  );
}

interface PickerProps {
  level: Level;
  setLevel(l: Level): void;
  view: { y: number; m: number };
  setView(v: { y: number; m: number }): void;
  grid: string[];
  selected: string;
  today: string;
  firstDay: number;
  select(d: string): void;
  specialDates: CalendarSpecialDate[];
  specialTypes: Map<string, number>;
}

/** The calendar with its header (previous, Today, next, picker link) and the four drill-down levels ([CAL]). */
function CalendarPicker(p: PickerProps) {
  const { intlLocale } = useSmartKit();
  const t = useText();
  const { y, m } = p.view;
  const rangeStart = Math.floor(y / YEARS) * YEARS;
  const setRange = Math.floor(y / (YEARS * 12)) * YEARS * 12;
  const step = (dir: -1 | 1) => {
    if (p.level === 'day') p.setView({ y: m + dir < 0 ? y - 1 : m + dir > 11 ? y + 1 : y, m: (m + dir + 12) % 12 });
    else if (p.level === 'month') p.setView({ y: y + dir, m });
    else if (p.level === 'year') p.setView({ y: y + dir * YEARS, m });
    else p.setView({ y: y + dir * YEARS * 12, m });
  };
  const monthName = (mm: number, style: 'long' | 'short') => new Intl.DateTimeFormat(intlLocale, { month: style, timeZone: 'UTC' }).format(new Date(Date.UTC(2000, mm, 1)));
  const yearText = (yy: number) => new Intl.DateTimeFormat(intlLocale, { year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(yy, 0, 1)));
  const link =
    p.level === 'day'
      ? new Intl.DateTimeFormat(intlLocale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m, 1)))
      : p.level === 'month'
        ? yearText(y)
        : p.level === 'year'
          ? `${yearText(rangeStart)} – ${yearText(rangeStart + YEARS - 1)}`
          : undefined;
  const drill = () => p.setLevel(p.level === 'day' ? 'month' : p.level === 'month' ? 'year' : 'range');
  const goToday = () => {
    p.select(p.today);
    p.setLevel('day');
  };

  const special = (d: string) => p.specialDates.find((s) => d >= s.startDate && d <= (s.endDate ?? s.startDate));
  const dayName = (d: string, style: 'short' | 'long') => new Intl.DateTimeFormat(intlLocale, { weekday: style, timeZone: 'UTC' }).format(new Date(`${d}T00:00:00Z`));
  const longDate = (d: string) => new Intl.DateTimeFormat(intlLocale, { dateStyle: 'full', timeZone: 'UTC' }).format(new Date(`${d}T00:00:00Z`));

  const onGridKey = (e: KeyboardEvent, d: string) => {
    const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (delta !== undefined) {
      e.preventDefault();
      const next = addDays(d, delta);
      const grid = e.currentTarget.closest('.sk-card__calendar-grid');
      p.select(next);
      requestAnimationFrame(() => (grid?.querySelector(`[data-date="${next}"]`) as HTMLElement | null)?.focus());
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      p.select(d);
    }
  };

  return (
    <div className="sk-card__calendar-picker">
      <div className="sk-card__calendar-head">
        <button type="button" className="sk-card__nav-button" aria-label={t('card.previous')} onClick={() => step(-1)}><Chevron dir="left" /></button>
        <button type="button" className="sk-card__nav-button sk-card__nav-button--text" onClick={goToday} disabled={p.level === 'day' && p.selected === p.today && y === parts(p.today).y && m === parts(p.today).m}>{t('card.today')}</button>
        <button type="button" className="sk-card__nav-button" aria-label={t('card.next')} onClick={() => step(1)}><Chevron dir="right" /></button>
        {link && <button type="button" className="sk-card__nav-button sk-card__nav-button--text" onClick={drill} aria-live="polite">{link}</button>}
      </div>
      {p.level === 'day' && (
        <table className="sk-card__calendar-grid" role="grid">
          <thead>
            <tr>
              <th className="sk-card__calendar-week" scope="col"><span className="sk-card__sr-only">{t('card.calendarWeek')}</span></th>
              {p.grid.slice(0, 7).map((d) => (
                <th key={d} scope="col" abbr={dayName(d, 'long')}>{dayName(d, 'short')}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[0, 1, 2, 3, 4, 5].map((r) => {
              const row = p.grid.slice(r * 7, r * 7 + 7);
              return (
                <tr key={r}>
                  <th scope="row" className="sk-card__calendar-week">{weekNumber(row[0]!, p.firstDay)}</th>
                  {row.map((d) => {
                    const { m: dm } = parts(d);
                    const wd = weekday(d);
                    const sp = special(d);
                    const cls = [
                      'sk-card__day',
                      (wd === 0 || wd === 6) && 'sk-card__day--weekend',
                      dm !== m && 'sk-card__day--other',
                      d === p.today && 'sk-card__day--today',
                      d === p.selected && 'sk-card__day--selected',
                    ].filter(Boolean).join(' ');
                    return (
                      <td key={d} role="gridcell" aria-selected={d === p.selected}>
                        <span
                          className={cls}
                          data-date={d}
                          role="button"
                          tabIndex={d === p.selected ? 0 : -1}
                          aria-label={longDate(d)}
                          aria-current={d === p.today ? 'date' : undefined}
                          onClick={() => p.select(d)}
                          onKeyDown={(e) => onGridKey(e, d)}
                        >
                          {parts(d).d}
                          {sp && <span className={`sk-card__day-special sk-card--category-${p.specialTypes.get(sp.type) ?? 1}`} aria-hidden="true" />}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {p.level === 'month' && (
        <div className="sk-card__calendar-cells sk-card__calendar-cells--months">
          {Array.from({ length: 12 }, (_, i) => (
            <button key={i} type="button" className={`sk-card__cell${i === m ? ' sk-card__cell--selected' : ''}`} onClick={() => { p.setView({ y, m: i }); p.setLevel('day'); }}>
              {monthName(i, 'long')}
            </button>
          ))}
        </div>
      )}
      {p.level === 'year' && (
        <div className="sk-card__calendar-cells sk-card__calendar-cells--years">
          {Array.from({ length: YEARS }, (_, i) => rangeStart + i).map((yy) => (
            <button key={yy} type="button" className={`sk-card__cell${yy === y ? ' sk-card__cell--selected' : ''}`} onClick={() => { p.setView({ y: yy, m }); p.setLevel('month'); }}>
              {yearText(yy)}
            </button>
          ))}
        </div>
      )}
      {p.level === 'range' && (
        <div className="sk-card__calendar-cells sk-card__calendar-cells--ranges">
          {Array.from({ length: 12 }, (_, i) => setRange + i * YEARS).map((ys) => (
            <button key={ys} type="button" className={`sk-card__cell${ys === rangeStart ? ' sk-card__cell--selected' : ''}`} onClick={() => { p.setView({ y: ys + (y % YEARS), m }); p.setLevel('year'); }}>
              {yearText(ys)} – {yearText(ys + YEARS - 1)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Chevron({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg className="sk-card__icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d={dir === 'left' ? 'M10 3 L5 8 L10 13' : 'M6 3 L11 8 L6 13'} />
    </svg>
  );
}
