/**
 * Responsive table (ADR-020, LR Table / Sticky Behavior / Responsiveness): a semantic table that scrolls with the
 * page, loads more rows when its end comes into view ("scroll to load"), keeps the column headers sticky, hides
 * columns by UI.Importance on narrow widths and shows them below the row with "Show Details" (pop-in), groups rows,
 * and navigates by clicking the whole row.
 */
import { Checkbox, Loader, Text } from '@mantine/core';
import type { Row } from '@rhfan2019/smart-kit-core';
import { ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useText } from '../context/SmartKitProvider';
import { getPath } from '../field/values';

export interface ResponsiveColumn {
  id: string;
  label: string;
  importance: 'High' | 'Medium' | 'Low';
  align?: 'end';
  render(row: Row): ReactNode;
  /** Text of the grouping header (value of the group property). */
  groupValue?(row: Row): string;
}

export interface ResponsiveTableProps {
  label: string;
  columns: ResponsiveColumn[];
  rows: Row[];
  keyOf(row: Row): string;
  selectable?: boolean;
  selectedKeys: Set<string>;
  onSelectionChange(keys: Set<string>): void;
  navigable: boolean;
  onNavigate(row: Row): void;
  hasMore: boolean;
  loading: boolean;
  loadMore(): void;
  /** Show the columns hidden on this width below each row (pop-in). */
  showDetails: boolean;
  /** Column id to group by. */
  groupBy?: string;
  noData?: ReactNode;
  inlineActions?(row: Row): ReactNode;
  /** Keys of rows marked as changed (continuous working mode). */
  changedKeys?: Set<string>;
  rowMarker?(row: Row): ReactNode;
  /** Reports the ids of the columns hidden on the current width. */
  onHiddenColumnsChange?(ids: string[]): void;
}

/** Widths below which Low, then Medium columns move out of the table (sap.m.Table pop-in by importance). */
export function hiddenByImportance(width: number, importance: ResponsiveColumn['importance']): boolean {
  if (importance === 'High') return false;
  if (importance === 'Medium') return width < 600;
  return width < 1024;
}

export function ResponsiveTable(p: ResponsiveTableProps) {
  const t = useText();
  const boxRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1440);
  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  // The first column always stays (it identifies the row).
  const visible = p.columns.filter((c, i) => i === 0 || !hiddenByImportance(width, c.importance));
  const hidden = p.columns.filter((c) => !visible.includes(c));
  const hiddenKey = hidden.map((c) => c.id).join('|');
  const report = useRef(p.onHiddenColumnsChange);
  report.current = p.onHiddenColumnsChange;
  useEffect(() => { report.current?.(hiddenKey ? hiddenKey.split('|') : []); }, [hiddenKey]);

  // Scroll to load: the sentinel after the last row starts the next request.
  const latest = useRef(p);
  latest.current = p;
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver(([e]) => {
      const l = latest.current;
      if (e!.isIntersecting && l.hasMore && !l.loading) l.loadMore();
    }, { rootMargin: '0px 0px 200px 0px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  useEffect(() => {
    // Rows may not fill the viewport yet: keep loading while the sentinel is visible.
    const el = sentinelRef.current;
    if (!el || !p.hasMore || p.loading) return;
    if (el.getBoundingClientRect().top < window.innerHeight + 200) p.loadMore();
  });

  const allSelected = p.rows.length > 0 && p.rows.every((r) => p.selectedKeys.has(p.keyOf(r)));
  const toggle = (row: Row) => {
    const k = p.keyOf(row);
    const next = new Set(p.selectedKeys);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    p.onSelectionChange(next);
  };
  const span = visible.length + (p.selectable ? 1 : 0) + (p.inlineActions ? 1 : 0) + (p.navigable ? 1 : 0);

  // Grid keyboard navigation (arrow keys between cells, Enter navigates, Space selects).
  const onKeyDown = (e: KeyboardEvent<HTMLTableElement>) => {
    const cell = (e.target as HTMLElement).closest<HTMLElement>('[data-sk-cell]');
    if (!cell) return;
    const tr = cell.parentElement as HTMLTableRowElement;
    const cells = [...tr.querySelectorAll<HTMLElement>('[data-sk-cell]')];
    const i = cells.indexOf(cell);
    const rows = [...(tr.closest('table')?.querySelectorAll<HTMLTableRowElement>('tr[data-sk-row], thead tr') ?? [])];
    const ri = rows.indexOf(tr);
    let next: HTMLElement | undefined;
    if (e.key === 'ArrowRight') next = cells[i + 1];
    else if (e.key === 'ArrowLeft') next = cells[i - 1];
    else if (e.key === 'ArrowDown') next = rows[ri + 1]?.querySelectorAll<HTMLElement>('[data-sk-cell]')[i];
    else if (e.key === 'ArrowUp') next = rows[ri - 1]?.querySelectorAll<HTMLElement>('[data-sk-cell]')[i];
    else if (e.key === 'Enter' && tr.dataset.skRow && p.navigable && e.target === cell) {
      const row = p.rows.find((r) => p.keyOf(r) === tr.dataset.skRow);
      if (row) p.onNavigate(row);
    } else if (e.key === ' ' && tr.dataset.skRow && p.selectable && e.target === cell) {
      const row = p.rows.find((r) => p.keyOf(r) === tr.dataset.skRow);
      if (row) { toggle(row); e.preventDefault(); }
    }
    if (next) {
      e.preventDefault();
      cell.tabIndex = -1;
      next.tabIndex = 0;
      next.focus();
    }
  };

  let lastGroup: string | undefined;
  const groupCol = p.groupBy ? p.columns.find((c) => c.id === p.groupBy) : undefined;
  return (
    <div className="sk-rtable" ref={boxRef} data-sk-responsive-table data-width={width}>
      <table role="grid" aria-label={p.label} aria-rowcount={p.rows.length} onKeyDown={onKeyDown} className="sk-rtable__table">
        <thead>
          <tr>
            {p.selectable ? (
              <th className="sk-rtable__select" data-sk-cell tabIndex={-1}>
                <Checkbox size="xs" checked={allSelected} indeterminate={!allSelected && p.selectedKeys.size > 0} aria-label={t('filterBar.selectAll')}
                  onChange={() => p.onSelectionChange(allSelected ? new Set() : new Set(p.rows.map(p.keyOf)))} />
              </th>
            ) : null}
            {visible.map((c, i) => <th key={c.id} data-sk-cell tabIndex={i === 0 ? 0 : -1} data-col={c.id} className={c.align === 'end' ? 'sk-rtable__end' : undefined}>{c.label}</th>)}
            {p.inlineActions ? <th data-sk-cell tabIndex={-1}><span className="sk-visually-hidden">{t('actions.inline')}</span></th> : null}
            {p.navigable ? <th data-sk-cell tabIndex={-1} className="sk-rtable__nav"><span className="sk-visually-hidden">{t('table.navigate')}</span></th> : null}
          </tr>
        </thead>
        <tbody>
          {p.rows.map((row) => {
            const k = p.keyOf(row);
            const group = groupCol ? (groupCol.groupValue?.(row) ?? '') : undefined;
            const header = groupCol && group !== lastGroup ? (
              <tr key={`g:${group}`} className="sk-rtable__group" data-sk-group-row={group}>
                <th colSpan={span} scope="rowgroup">{t('table.groupHeader', { label: groupCol.label, value: group || '–' })}</th>
              </tr>
            ) : null;
            lastGroup = group;
            const selected = p.selectedKeys.has(k);
            return [
              header,
              <tr
                key={k}
                data-sk-row={k}
                aria-selected={p.selectable ? selected : undefined}
                data-changed={p.changedKeys?.has(k) || undefined}
                className={['sk-rtable__row', p.navigable ? 'sk-rtable__row--nav' : ''].join(' ')}
                onClick={(e) => {
                  if (!p.navigable) return;
                  if ((e.target as HTMLElement).closest('button, a, input, label, [role="button"], [data-sk-no-nav]')) return;
                  p.onNavigate(row);
                }}
              >
                {p.selectable ? (
                  <td className="sk-rtable__select" data-sk-cell tabIndex={-1} data-sk-no-nav>
                    <Checkbox size="xs" checked={selected} onChange={() => toggle(row)} aria-label={t('table.selectRow')} />
                  </td>
                ) : null}
                {visible.map((c, i) => (
                  <td key={c.id} data-sk-cell tabIndex={-1} data-col={c.id} className={c.align === 'end' ? 'sk-rtable__end' : undefined}>
                    {c.render(row)}
                    {i === 0 && p.rowMarker ? p.rowMarker(row) : null}
                    {i === 0 && p.changedKeys?.has(k) ? <div className="sk-rtable__changed" data-sk-changed-marker>{t('table.changedItem')}</div> : null}
                    {i === 0 && p.showDetails && hidden.length ? (
                      <dl className="sk-rtable__popin" data-sk-popin>
                        {hidden.map((h) => (
                          <div key={h.id} className="sk-rtable__popin-pair"><dt>{h.label}:</dt><dd>{h.render(row)}</dd></div>
                        ))}
                      </dl>
                    ) : null}
                  </td>
                ))}
                {p.inlineActions ? <td data-sk-cell tabIndex={-1} className="sk-rtable__actions" data-sk-no-nav>{p.inlineActions(row)}</td> : null}
                {p.navigable ? <td data-sk-cell tabIndex={-1} className="sk-rtable__nav" aria-label={t('table.navigate')}><ChevronRight className="sk-icon" aria-hidden /></td> : null}
              </tr>,
            ];
          })}
        </tbody>
      </table>
      {!p.rows.length && !p.loading ? <div className="sk-table__nodata sk-rtable__nodata" data-sk-nodata><Text c="dimmed">{p.noData}</Text></div> : null}
      <div ref={sentinelRef} className="sk-rtable__sentinel" aria-hidden />
      {p.loading ? <div className="sk-rtable__loading" role="status"><Loader size="xs" /> {t('table.loadingMore')}</div> : null}
    </div>
  );
}

/** Group value of a column backed by a field path. */
export const groupValueOf = (path: string) => (row: Row) => String(getPath(row, path) ?? '');
