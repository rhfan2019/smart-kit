/** Events of the calendar and timeline cards: Communication.Event, or the property paths given in `item` (docs/20 §3.1). */
import type { EntityUi, FieldModel, Row } from '@rhfan2019/smart-kit-core';
import { getPath } from '../field/values';

/** Property paths of an event (the manifest item template of the integration card, with property paths). */
export interface EventItemPaths {
  /** Start (calendar `startDate`, timeline `dateTime`); default Communication.Event/dtstart. */
  startDate?: string;
  /** End; default Communication.Event/dtend. */
  endDate?: string;
  /** Title; default Communication.Event/summary. */
  title?: string;
  /** Second line; default Communication.Event/description. */
  text?: string;
  /** Category (legend and colour); default Communication.Event/categories. */
  type?: string;
}

export interface CardEvent {
  row: Row;
  start: Date;
  end?: Date;
  title: string;
  text: string;
  type?: string;
  /** Display text of the category (Common.Text of the category property). */
  typeText?: string;
}

export function eventPaths(ui: EntityUi, item: EventItemPaths | undefined): EventItemPaths {
  const e = ui.event ?? {};
  return {
    startDate: item?.startDate ?? e.dtstart,
    endDate: item?.endDate ?? e.dtend,
    title: item?.title ?? e.summary,
    text: item?.text ?? e.description ?? e.location,
    type: item?.type ?? e.categories,
  };
}

const field = (id: string, path: string): FieldModel => ({ id, kind: 'field', path, label: id, criticalityIcon: false, isSemanticKey: false });

/** Synthetic columns that make the list request select the event properties (and their texts). */
export function eventColumns(paths: EventItemPaths): FieldModel[] {
  return Object.entries(paths).flatMap(([k, p]) => (p ? [field(k, p)] : []));
}

const str = (v: unknown) => (v === undefined || v === null ? '' : String(v));

export function toEvents(rows: Row[], paths: EventItemPaths, typeTextPath: string | undefined): CardEvent[] {
  const out: CardEvent[] = [];
  for (const row of rows) {
    const start = paths.startDate ? new Date(str(getPath(row, paths.startDate))) : undefined;
    if (!start || Number.isNaN(start.getTime())) continue;
    const endRaw = paths.endDate ? getPath(row, paths.endDate) : undefined;
    const end = endRaw ? new Date(str(endRaw)) : undefined;
    const type = paths.type ? str(getPath(row, paths.type)) || undefined : undefined;
    out.push({
      row,
      start,
      end: end && !Number.isNaN(end.getTime()) ? end : undefined,
      title: paths.title ? str(getPath(row, paths.title)) : '',
      text: paths.text ? str(getPath(row, paths.text)) : '',
      type,
      typeText: typeTextPath ? str(getPath(row, typeTextPath)) || type : type,
    });
  }
  return out;
}
