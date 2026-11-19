/** Spreadsheet export of the current query (LR-20). Values are exported as displayed text (exact decimals). */
import { resolvePath, type FieldModel, type QueryRequest, type Row } from '@rhfan2019/smart-kit-core';
import type { ServiceHandle } from '../context/SmartKitProvider';
import { fieldValue, getPath } from '../field/values';
import type { TextFn } from '../i18n/text';
import type { ColumnItem } from './Table';

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
  write?(rows: string[][], fileName: string, sheetName?: string, columns?: ExportColumn[]): Promise<void>;
  /** Sheet name of the file. */
  sheetName?: string;
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

/** The sheet layout of a column (sap.fe.macros.table.ColumnExportSettings width, wrap, textAlign, numeric type). */
export interface ExportColumn {
  /** Width in characters. */
  width?: number;
  wrap?: boolean;
  align?: 'left' | 'right' | 'center';
  /** The values are numbers (type Number, BigNumber, Currency, Percentage). */
  numeric?: boolean;
}

const NUMERIC_TYPES = new Set(['Number', 'BigNumber', 'Currency', 'Percentage']);
const ALIGN: Record<string, ExportColumn['align']> = { Left: 'left', Begin: 'left', Right: 'right', End: 'right', Center: 'center' };

/** The layout of the exported columns (FE getCustomExportSettings: wrap by default when several properties are exported). */
export function exportColumns(columns: ColumnItem[]): ExportColumn[] {
  return columns.map((c) => {
    const es = c.exportSettings;
    const props = es?.property ?? (c.field ? undefined : c.select);
    return { width: es?.width, wrap: es?.wrap ?? (props?.length ?? 0) > 1, align: es?.textAlign ? ALIGN[es.textAlign] : undefined, numeric: es?.type ? NUMERIC_TYPES.has(es.type) : undefined };
  });
}

export function toCells(o: Pick<ExportOptions, 'service' | 'typeName' | 'columns' | 'locale' | 'timeZone'>, rows: Row[]): string[][] {
  const ctx = { model: o.service.model, typeName: o.typeName, locale: o.locale, timeZone: o.timeZone };
  const header = o.columns.map((c) => c.exportSettings?.label ?? c.label);
  /** A property as the column shows it (or raw for numbers, booleans and enumerations of the export settings). */
  const valueOf = (c: ColumnItem, path: string, r: Row): string => {
    const es = c.exportSettings;
    const raw = getPath(r, path);
    if (es?.type === 'Boolean' && typeof raw === 'boolean') return (raw ? es.trueValue : es.falseValue) ?? String(raw);
    if (es?.type === 'Enumeration' && es.valueMap) return es.valueMap[String(raw)] ?? String(raw ?? '');
    if (es?.type && NUMERIC_TYPES.has(es.type)) return raw === null || raw === undefined ? '' : String(raw);
    if (!resolvePath(o.service.model.entityTypes, o.typeName, path).property) return String(raw ?? '');
    const f: FieldModel = { id: path, kind: 'field', path, label: '', criticalityIcon: false, isSemanticKey: false };
    const v = fieldValue(ctx, f, r);
    return v.unit && v.formatted ? `${v.display} ${v.unit}` : v.display;
  };
  const body = rows.map((r) =>
    o.columns.map((c) => {
      const es = c.exportSettings;
      // FE getCustomExportSettings: the properties (export settings, else a custom column's) with a template, by
      // default each value on its own line (_appendCustomTemplate)
      const props = es?.property ?? (c.field ? undefined : c.select);
      if (props?.length) {
        const values = props.map((x) => valueOf(c, x, r));
        const template = es?.template ?? (props.length > 1 || !c.field ? values.map((_, i) => `{${i}}`).join('\n') : undefined);
        if (template) return template.replace(/\{(\d+)\}/g, (_, i: string) => values[Number(i)] ?? '');
      }
      if (!c.field) return '';
      if (es?.type && c.field.kind === 'field' && c.field.path) return valueOf(c, c.field.path, r);
      const v = fieldValue(ctx, c.field, r);
      return v.unit && v.formatted ? `${v.display} ${v.unit}` : v.display;
    }),
  );
  return [header, ...body];
}

async function downloadXlsx(cells: string[][], fileName: string, sheetName?: string, columns?: ExportColumn[]): Promise<void> {
  const { default: writeXlsxFile } = await import('write-excel-file/browser');
  const data = cells.map((row, i) => row.map((value, j) => {
    const col = columns?.[j];
    const numeric = i > 0 && col?.numeric && value !== '' && Number.isFinite(Number(value));
    return {
      value: numeric ? Number(value) : value, type: numeric ? Number : String, fontWeight: i === 0 ? ('bold' as const) : undefined,
      ...(col?.wrap ? { wrap: true } : {}), ...(i > 0 && col?.align ? { align: col.align } : {}),
    };
  }));
  const widths = columns?.some((c) => c.width) ? columns.map((c) => (c.width ? { width: c.width } : {})) : undefined;
  await writeXlsxFile(data, { ...(sheetName ? { sheet: sheetName } : {}), ...(widths ? { columns: widths } : {}) }).toFile(fileName);
}

export async function exportRows(o: ExportOptions): Promise<{ count: number; truncated: boolean; cancelled?: boolean }> {
  const { rows, truncated } = await collectRows(o);
  if (o.before && !(await o.before({ count: rows.length, truncated }))) return { count: rows.length, truncated, cancelled: true };
  const cells = toCells(o, rows);
  const safe = o.title.replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'export';
  await (o.write ?? downloadXlsx)(cells, `${safe}.xlsx`, o.sheetName, exportColumns(o.columns));
  if (truncated && typeof window !== 'undefined') console.info(o.t('table.exportLimit', { limit: o.limit }));
  return { count: rows.length, truncated };
}
