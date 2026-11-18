/**
 * Responsive table (ADR-020, LR Table / Sticky Behavior / Responsiveness): a semantic table that scrolls with the
 * page, loads more rows when its end comes into view ("scroll to load"), keeps the column headers sticky, hides
 * columns by UI.Importance on narrow widths and shows them below the row with "Show Details" (pop-in), groups rows
 * (with subtotals and counts in the group header) and shows a totals row at the end (docs/23), shows a tree
 * (treegrid, docs/26 §3.10) and navigates by clicking the whole row.
 */
import { Checkbox, Loader, Text } from '@mantine/core';
import type { HierarchyNode, Row } from '@rhfan2019/smart-kit-core';
import { ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useText } from '../context/SmartKitProvider';
import { getPath } from '../field/values';
import { TreeCell } from './tree';

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
  /** Accessible name / visible label. */
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
  /** Shows a busy indicator. */
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
  /** Subtotals of the group starting with `row`: row count and cells by column id (docs/23). */
  groupSummary?(row: Row): GroupSummary | undefined;
  /** Totals row after the last row: cells by column id (docs/23). */
  totals?: { label: ReactNode; cells: Record<string, ReactNode> };
  /** Tree rows (docs/26 §3.10): indentation and toggle in the first column. */
  tree?: { nodeOf(row: Row): HierarchyNode | undefined; toggle(row: Row): void };
}

export interface GroupSummary {
  count?: number;
  cells: Record<string, ReactNode>;
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

  /**
   * A group header or totals row: the label spans the columns before the first column with a value; values sit in
   * their columns. Values of columns that are not in the table on this width follow the label.
   */
  const summaryCells = (label: ReactNode, cells: Record<string, ReactNode> | undefined, scope: 'rowgroup' | 'row') => {
    const ids = Object.keys(cells ?? {});
    const first = visible.findIndex((c) => ids.includes(c.id));
    if (!cells || !ids.length) return <th colSpan={span} scope={scope}>{label}</th>;
    const lead = Math.max(1, first < 0 ? visible.length : first);
    const extra = p.columns.filter((c) => ids.includes(c.id) && !visible.slice(lead).includes(c));
    return (
      <>
        <th colSpan={lead + (p.selectable ? 1 : 0)} scope={scope}>
          {label}
          {extra.map((c) => <span key={c.id} className="sk-rtable__summary-extra" data-sk-summary-extra={c.id}>{c.label}: {cells[c.id]}</span>)}
        </th>
        {visible.slice(lead).map((c) => <td key={c.id} data-col={c.id} className={c.align === 'end' ? 'sk-rtable__end' : undefined}>{cells[c.id] ?? null}</td>)}
        {p.inlineActions ? <td /> : null}
        {p.navigable ? <td /> : null}
      </>
    );
  };

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
      <table role={p.tree ? 'treegrid' : 'grid'} aria-label={p.label} aria-rowcount={p.rows.length} onKeyDown={onKeyDown} className="sk-rtable__table">
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
            let header: ReactNode = null;
            if (groupCol && group !== lastGroup) {
              const summary = p.groupSummary?.(row);
              const title = t('table.groupHeader', { label: groupCol.label, value: group || '–' }) + (summary?.count !== undefined ? t('table.groupCount', { count: summary.count }) : '');
              header = (
                <tr key={`g:${group}`} className="sk-rtable__group" data-sk-group-row={group} data-sk-group-count={summary?.count}>
                  {summaryCells(title, summary?.cells, 'rowgroup')}
                </tr>
              );
            }
            lastGroup = group;
            const selected = p.selectedKeys.has(k);
            const node = p.tree?.nodeOf(row);
            return [
              header,
              <tr
                key={k}
                data-sk-row={k}
                aria-selected={p.selectable ? selected : undefined}
                aria-level={node ? node.level + 1 : undefined}
                aria-expanded={node && node.drillState !== 'leaf' ? node.drillState === 'expanded' : undefined}
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
                    {i === 0 && p.tree ? <TreeCell node={node} onToggle={() => p.tree!.toggle(row)}>{c.render(row)}</TreeCell> : c.render(row)}
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
        {p.totals && p.rows.length ? (
          <tfoot>
            <tr className="sk-rtable__total" data-sk-total-row>{summaryCells(p.totals.label, p.totals.cells, 'row')}</tr>
          </tfoot>
        ) : null}
      </table>
      {!p.rows.length && !p.loading ? <div className="sk-table__nodata sk-rtable__nodata" data-sk-nodata><Text c="dimmed">{p.noData}</Text></div> : null}
      <div ref={sentinelRef} className="sk-rtable__sentinel" aria-hidden />
      {p.loading ? <div className="sk-rtable__loading" role="status"><Loader size="xs" /> {t('table.loadingMore')}</div> : null}
    </div>
  );
}

/** Group value of a column backed by a field path. */
export const groupValueOf = (path: string) => (row: Row) => String(getPath(row, path) ?? '');
