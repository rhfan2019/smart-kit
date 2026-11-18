/**
 * Timeline card content (sap.ui.integration.cards.TimelineContent) — docs/20 §2.2.
 * Items in chronological order, newest first (SAPUI5 Timeline): icon, title, date ("Today at 9:00 AM"), text.
 * Driven by Communication.Event (dtstart, summary, description) or the property paths in `item`.
 */
import { resolvePath } from '@rhfan2019/smart-kit-core';
import { useMemo, type ReactNode } from 'react';
import { useMetaModel, useSmartKit, useText } from '../context/SmartKitProvider';
import { CardMessage, CardPlaceholder } from './CardStates';
import { eventColumns, eventPaths, toEvents, type EventItemPaths } from './events';
import { relativeDateTime } from './format';
import { itemKeyDown } from './ListContent';
import { useCardList, type CardDataProps } from './useCardList';

/** Property paths of the timeline items, named as the manifest's `content.item` (sap.card Timeline). */
export interface TimelineItemPaths {
  /** Title; default Communication.Event/summary. */
  title?: string;
  /** Second line; default Communication.Event/description (else location). */
  description?: string;
  /** Time of the item; default Communication.Event/dtstart. */
  dateTime?: string;
}

export interface $TimelineContentSettings extends CardDataProps {
  /** Property paths of the items (manifest `item`); default Communication.Event. */
  item?: TimelineItemPaths;
  /** Icon of every item; default a calendar icon. */
  icon?: ReactNode;
  /** Oldest item first instead of newest first. */
  sortOldestFirst?: boolean;
  /** Reference time for "Today" (default now). */
  now?: Date;
}

export function CalendarIcon() {
  return (
    <svg className="sk-card__icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <rect x="1.5" y="2.5" width="13" height="12" rx="1.5" />
      <path d="M1.5 6.5h13M5 1v3M11 1v3M4.5 9h2M9.5 9h2M4.5 11.5h2" />
    </svg>
  );
}

export function TimelineContent(p: $TimelineContentSettings) {
  const meta = useMetaModel(p.entitySet, { service: p.service });
  const paths = eventPaths(meta.ui, p.item && { startDate: p.item.dateTime, title: p.item.title, text: p.item.description });
  return <TimelineList {...p} paths={paths} />;
}

function TimelineList(p: $TimelineContentSettings & { paths: EventItemPaths }) {
  const cols = useMemo(() => eventColumns(p.paths), [p.paths.startDate, p.paths.title, p.paths.text]); // eslint-disable-line react-hooks/exhaustive-deps
  const { meta, rows, query, onItemPress } = useCardList(p, { defaultMax: 5, columns: () => cols });
  const { intlLocale, timeZone } = useSmartKit();
  const t = useText();
  if (query.isLoading) return <CardPlaceholder kind="timeline" rows={p.maxItems ?? 3} />;
  if (query.error) return <CardMessage kind="error" />;
  const typeText = p.paths.type ? resolvePath(meta.service.model.entityTypes, meta.set.typeName, p.paths.type).property?.text : undefined;
  const events = toEvents(rows, p.paths, typeText).sort((a, b) => (p.sortOldestFirst ? 1 : -1) * (a.start.getTime() - b.start.getTime()));
  if (!events.length) return <CardMessage kind="noItems" />;
  const now = p.now ?? new Date();
  return (
    <ul className="sk-card__timeline" aria-label={t('card.typeTimeline')}>
      {events.map((e, i) => {
        const press = onItemPress ? () => onItemPress(e.row) : undefined;
        return (
          <li key={i} className="sk-card__timeline-item">
            <span className="sk-card__timeline-icon">{p.icon ?? <CalendarIcon />}</span>
            {i < events.length - 1 && <span className="sk-card__timeline-line" aria-hidden="true" />}
            <div
              className={`sk-card__timeline-box${press ? ' sk-card__timeline-box--pressable' : ''}`}
              tabIndex={press ? 0 : -1}
              onClick={press}
              onKeyDown={press ? itemKeyDown(press) : undefined}
            >
              <div className="sk-card__timeline-title">{e.title}</div>
              <div className="sk-card__timeline-date">{relativeDateTime(t, intlLocale, e.start, now, timeZone)}</div>
              {e.text && <div className="sk-card__timeline-text">{e.text}</div>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
