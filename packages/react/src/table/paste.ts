/**
 * Pasting rows from the clipboard into a table (sap.fe.macros.Table `enablePaste`, FE TableAPI onPaste / PasteHelper
 * pasteData): each pasted line becomes a new row; its cells fill the visible columns in their order. Only columns of
 * plain properties are filled; computed properties (Core.Computed) only with `enablePastingOfComputedProperties`, as
 * FE leaves them out of the pasted data otherwise. All lines are parsed first — one wrong value stops the paste.
 */
import type { EntityTypeModel, FieldModel, Row } from '@rhfan2019/smart-kit-core';

/** The clipboard text as rows of cells (sap.m.plugins.PasteProvider: tab-separated cells, one row per line). */
export function parseClipboard(text: string): string[][] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  while (lines.length && lines[lines.length - 1]!.trim() === '') lines.pop();
  return lines.map((l) => l.split('\t'));
}

/** The target property of each visible column; null where a column takes no pasted value. */
export function pasteTargets(type: EntityTypeModel, fields: (FieldModel | undefined)[], withComputed: boolean): (string | null)[] {
  return fields.map((f) => {
    const path = f?.kind === 'field' ? f.path : undefined;
    const prop = path && !path.includes('/') ? type.properties[path] : undefined;
    if (!prop || prop.edmType === 'Edm.Stream') return null;
    if (prop.computed && !withComputed) return null;
    return prop.name;
  });
}

/** Parses one pasted cell for its property type; throws on a value the type does not accept. */
export function pastedValue(edmType: string, raw: string): unknown {
  const v = raw.trim();
  if (v === '') return null;
  if (/Edm\.(Int|Byte|SByte|Decimal|Double|Single)/.test(edmType)) {
    const n = Number(v.replace(/[\s,](?=\d{3}\b)/g, ''));
    if (!Number.isFinite(n)) throw new Error(`"${raw}" is not a number`);
    return /Edm\.Decimal/.test(edmType) ? String(n) : n;
  }
  if (edmType === 'Edm.Boolean') {
    if (/^(true|yes|x|1)$/i.test(v)) return true;
    if (/^(false|no|0)$/i.test(v)) return false;
    throw new Error(`"${raw}" is not a Boolean value`);
  }
  if (edmType === 'Edm.Date' || edmType === 'Edm.DateTimeOffset') {
    const d = /^\d{4}-\d{2}-\d{2}/.test(v) ? new Date(v.length === 10 ? `${v}T00:00:00Z` : v) : new Date(Date.parse(v));
    if (Number.isNaN(d.getTime())) throw new Error(`"${raw}" is not a date`);
    return edmType === 'Edm.Date' ? d.toISOString().slice(0, 10) : d.toISOString();
  }
  return v;
}

/** The new rows of a paste, or the errors by line (1-based). */
export function pastedRows(type: EntityTypeModel, targets: (string | null)[], cells: string[][]): { rows: Row[]; errors: { row: number; message: string }[] } {
  const rows: Row[] = [];
  const errors: { row: number; message: string }[] = [];
  cells.forEach((line, i) => {
    const row: Row = {};
    line.forEach((raw, j) => {
      const name = targets[j];
      if (!name) return;
      try {
        const value = pastedValue(type.properties[name]!.edmType, raw);
        if (value !== null) row[name] = value;
      } catch (e) {
        errors.push({ row: i + 1, message: `${type.properties[name]!.label}: ${(e as Error).message}` });
      }
    });
    rows.push(row);
  });
  return { rows, errors };
}
