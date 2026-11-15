/**
 * List report page template, built only from public building blocks (AC-BOOT-01): variant management, filter bar,
 * grid table, filter summary, header expand/collapse and pin (the header snaps when the table scrolls), initial focus
 * and state restoration.
 */
import type { Row, SortItem, VariantContent } from '@rhfan2019/smart-kit-core';
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import {
  DynamicPage, FilterSummary, SmartFilterBar, SmartTable, SmartVariantManagement, useFilterState, useMetaModel, usePageState, useText, useVariants,
  type FilterFieldItem, type ExtendEntry, type TableExtendEntry,
} from '../index';

export interface SmartListReportProps {
  entitySet: string;
  service?: string;
  /** Key for variants and state restoration; defaults to the entity set. */
  pageKey?: string;
  /**
   * Live update mode (default true, recommended by the list report guideline): every change filters immediately.
   * False: manual update mode with "Go", for services where filtering on every change is too slow.
   */
  liveMode?: boolean;
  /** Execute the standard variant on load (default true). */
  autoExecute?: boolean;
  title?: string;
  headerActions?: ReactNode;
  filterExtend?: ExtendEntry<FilterFieldItem>[];
  tableExtend?: TableExtendEntry[];
  onRowNavigate?(row: Row, path: string): void;
  /** Content between header and table (e.g. KPI cards). */
  beforeTable?: ReactNode;
  /**
   * "Show Filters / Hide Filters" in the title bar instead of the expand/collapse and pin buttons on the header border
   * (the variant the list report guideline describes for grid tables). Default false: the header features as in the
   * SAP reference app; the header collapses while the table is scrolled down and expands at the top, unless pinned.
   */
  filterToggle?: boolean;
  className?: string;
}

export function SmartListReport(props: SmartListReportProps) {
  const p = { ...props, liveMode: props.liveMode ?? true };
  const t = useText();
  const pageKey = p.pageKey ?? `list:${p.entitySet}`;
  const { ui } = useMetaModel(p.entitySet, { service: p.service });
  // Execution on load waits for the variant list: a default variant decides whether to execute (LR-02, LR-15).
  const filter = useFilterState(p.entitySet, { service: p.service, pageKey, liveMode: p.liveMode, autoExecute: false });
  const [view, setView] = usePageState<{ columns?: string[]; sort?: SortItem[]; headerExpanded?: boolean; headerPinned?: boolean }>(`${pageKey}:view`, {});
  const columns = view.columns;
  const sort = view.sort ?? ui.presentation.sortOrder;

  const standard = useMemo<VariantContent>(
    () => ({ filters: filter.defaults.filters, search: '', filterFields: filter.defaults.fields, sort: ui.presentation.sortOrder }),
    [filter.defaults, ui],
  );
  const apply = (v: { content: VariantContent; autoApply: boolean }) => {
    filter.load({ filters: v.content.filters, search: v.content.search, fields: v.content.filterFields }, v.autoApply || p.liveMode === true);
    setView((s) => ({ ...s, columns: v.content.columns, sort: v.content.sort }));
  };
  const variants = useVariants(pageKey, { service: p.service, standard, onDefaultLoaded: (v) => apply({ content: v.content, autoApply: v.autoApply }) });
  const initialized = useRef(false);
  useEffect(() => {
    if (initialized.current || variants.isLoading) return;
    initialized.current = true;
    if (filter.applied === null && !variants.variants.some((v) => v.isDefault) && p.autoExecute !== false) filter.go();
  }, [variants.isLoading, variants.variants, filter, p.autoExecute]);
  const content: VariantContent = { filters: filter.filters, search: filter.search, filterFields: filter.fields, columns, sort };

  // LR-13: expanded when no query ran on start, collapsed otherwise.
  const headerExpanded = view.headerExpanded ?? filter.applied === null;
  const setHeaderExpanded = (v: boolean) => setView((s) => ({ ...s, headerExpanded: v }));

  // LR-14: initial focus.
  const latestFilter = useRef(filter);
  latestFilter.current = filter;
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let tries = 0;
    let stopped = false;
    const stop = () => { stopped = true; };
    document.addEventListener('pointerdown', stop, true);
    document.addEventListener('keydown', stop, true);
    const h = setInterval(() => {
      const root = rootRef.current;
      if (!root || stopped || ++tries > 60) return clearInterval(h);
      // Wait until the initial execution is decided and, if a query runs, until its rows are there.
      if (!initialized.current) return;
      if (latestFilter.current.applied !== null && !root.querySelector('.ag-row[row-index="0"], [data-sk-nodata], .sk-table__error')) return;
      // Re-apply while focus has fallen back to the document (rows may be re-rendered after the first paint).
      const active = document.activeElement;
      if (active && active !== document.body && active !== document.documentElement) return;
      let target: HTMLElement | null = null;
      const expanded = Boolean(root.querySelector('.sk-dynamic-page__header'));
      if (expanded) {
        const missing = latestFilter.current.missingRequired[0];
        if (missing) target = root.querySelector<HTMLElement>(`[data-sk-filter="${missing}"] input:not([type="hidden"])`);
        target ??= p.liveMode ? root.querySelector<HTMLElement>('[data-sk-filter] input:not([type="hidden"])') : root.querySelector<HTMLElement>('[data-sk-go]');
      } else target = root.querySelector<HTMLElement>('.ag-row[row-index="0"] [role="gridcell"]');
      target?.focus();
    }, 100);
    return () => {
      clearInterval(h);
      document.removeEventListener('pointerdown', stop, true);
      document.removeEventListener('keydown', stop, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once on mount
  }, []);

  return (
    <div ref={rootRef} className={['sk-list-report', p.className].filter(Boolean).join(' ')}>
      <DynamicPage
        layout="fill"
        filterToggle={p.filterToggle}
        snapOnScroll={!p.filterToggle}
        pinned={view.headerPinned ?? false}
        onPinnedChange={(v) => setView((s) => ({ ...s, headerPinned: v }))}
        heading={p.title ?? ui.headerInfo.typeNamePlural}
        headingContent={<SmartVariantManagement variants={variants} content={content} onApply={apply} standardName={p.title} autoApplyOption={!p.liveMode} />}
        actions={p.headerActions}
        summary={<FilterSummary entitySet={p.entitySet} service={p.service} filters={filter.filters} search={filter.search} />}
        header={<SmartFilterBar state={filter} extend={p.filterExtend} />}
        headerExpanded={headerExpanded}
        onHeaderExpandedChange={setHeaderExpanded}
        data-testid={`list-${p.entitySet}`}
      >
        {p.beforeTable}
        <SmartTable
          service={p.service}
          entitySet={p.entitySet}
          query={filter.applied}
          overlay={filter.dirty && !p.liveMode}
          columns={columns}
          onColumnsChange={(c) => setView((s) => ({ ...s, columns: c }))}
          sort={sort}
          onSortChange={(s) => setView((v) => ({ ...v, sort: s }))}
          extend={p.tableExtend}
          onRowNavigate={p.onRowNavigate}
          pageKey={pageKey}
          title={ui.headerInfo.typeNamePlural || t('object.sections')}
        />
      </DynamicPage>
    </div>
  );
}
