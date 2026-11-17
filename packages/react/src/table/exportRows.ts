/** Spreadsheet export of the current query (LR-20). Values are exported as displayed text (exact decimals). */
import type { QueryRequest, Row } from '@rhfan2019/smart-kit-core';
import type { ServiceHandle } from '../context/SmartKitProvider';
import { fieldValue, getPath } from '../field/values';
import type { TextFn } from '../i18n/text';
import type { ColumnItem } from './SmartTable';

const CHUNK = 500;

export interface ExportOptions {
  service: ServiceHandle;
  typeName: string;
  columns: ColumnItem[];
  title: string;
  pageRequest(skip: number, top: number, count: boolean): QueryRequest;
  limit: number;
  locale: string;
  timeZone?: string;
  t: TextFn;
  /** Injected for tests; defaults to downloading an .xlsx file. */
  write?(rows: string[][], fileName: string): Promise<void>;
  /** Called with the collected rows before the file is written; false cancels the export (no file). */
  before?(r: { count: number; truncated: boolean }): Promise<boolean>;
}

export async function collectRows(o: Pick<ExportOptions, 'service' | 'pageRequest' | 'limit'>): Promise<{ rows: Row[]; truncated: boolean }> {
  const rows: Row[] = [];
  let total: number | undefined;
  for (let skip = 0; skip < o.limit; skip += CHUNK) {
    const top = Math.min(CHUNK, o.limit - skip);
    const res = await o.service.dataProvider.query(o.pageRequest(skip, top, skip === 0));
    if (skip === 0) total = res.count;
    rows.push(...res.rows);
    if (res.rows.length < top) break;
  }
  return { rows, truncated: total !== undefined ? total > rows.length : rows.length >= o.limit };
}

export function toCells(o: Pick<ExportOptions, 'service' | 'typeName' | 'columns' | 'locale' | 'timeZone'>, rows: Row[]): string[][] {
  const header = o.columns.map((c) => c.label);
  const body = rows.map((r) =>
    o.columns.map((c) => {
      if (!c.field) return c.select?.length ? String(getPath(r, c.select[0]!) ?? '') : '';
      const v = fieldValue({ model: o.service.model, typeName: o.typeName, locale: o.locale, timeZone: o.timeZone }, c.field, r);
      return v.unit && v.formatted ? `${v.display} ${v.unit}` : v.display;
    }),
  );
  return [header, ...body];
}

async function downloadXlsx(cells: string[][], fileName: string): Promise<void> {
  const { default: writeXlsxFile } = await import('write-excel-file/browser');
  const data = cells.map((row, i) => row.map((value) => ({ value, type: String, fontWeight: i === 0 ? ('bold' as const) : undefined })));
  await writeXlsxFile(data).toFile(fileName);
}

export async function exportRows(o: ExportOptions): Promise<{ count: number; truncated: boolean; cancelled?: boolean }> {
  const { rows, truncated } = await collectRows(o);
  if (o.before && !(await o.before({ count: rows.length, truncated }))) return { count: rows.length, truncated, cancelled: true };
  const cells = toCells(o, rows);
  const safe = o.title.replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'export';
  await (o.write ?? downloadXlsx)(cells, `${safe}.xlsx`);
  if (truncated && typeof window !== 'undefined') console.info(o.t('table.exportLimit', { limit: o.limit }));
  return { count: rows.length, truncated };
}
