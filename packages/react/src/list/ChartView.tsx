/**
 * Chart building block (sap.fe.macros.Chart, ADR-033): the chart of a list report (LR Simple Content / Multiple Views,
 * ADR-021), the data aggregated on the server by the chart's dimension. `contextPath` is the entity set, `metaPath` the
 * UI.Chart (or a UI.PresentationVariant / UI.SelectionPresentationVariant with one, docs/30 §5.2). Selecting a bar opens
 * a popover whose "Show Details" drills down (docs/12 U-4).
 */
import { Button, Popover, Text } from '@mantine/core';
import { buildAggregateRequest, formatNumber, resolvePath, type FilterState, type Row } from '@rhfan2019/smart-kit-core';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useImperativeHandle, useState, type ReactNode, type Ref } from 'react';
import { resolveChartMetaPath, resolveContextPath } from '../chart/metaPath';
import { SimpleChart, type ChartDatum } from '../chart/SimpleChart';
import { useService, useSmartKit, useText } from '../context/SmartKitProvider';
import { getPath } from '../field/values';
import { fromSelectionVariant, toSelectionVariant, type SelectionVariant } from '../filter/selectionVariant';

/** Instance of the chart building block (`ref`), sap.fe.macros.Chart. */
export interface Chart {
  /** The aggregated rows of the selected data points (sap.fe.macros.Chart#getSelectedContexts). */
  getSelectedContexts(): Row[];
  /** The chart's own filters (in addition to `query`) as a sap.fe.navigation.SelectionVariant JSON object. */
  getSelectionVariant(): Promise<SelectionVariant>;
  /** Replaces the chart's own filters (applied in addition to `query`; a property in both takes the chart's conditions). */
  setSelectionVariant(selectionVariant: SelectionVariant, prefillDescriptions?: boolean): Promise<void>;
}

/** One data point in `selectionChange`: the dimension and measure values by property path. */
export interface ChartSelectionData { data: Record<string, unknown> }

/** sap.fe.macros.Chart `selectionChange`: data points were selected or deselected. */
export interface Chart$SelectionChangeEvent {
  /** The data points whose selection changed. */
  data: ChartSelectionData[];
  /** True when they were selected, false when deselected. */
  selected: boolean;
}

/** Drilldown from the popover's "Show Details" (smart-kit). */
export interface Chart$DrilldownEvent {
  /** Property path of the dimension. */
  dimension: string;
  /** The dimension value of the selected data point. */
  value: string;
}

/** Applied filters of the chart; null: not executed yet. */
export interface ChartQuery {
  filters: FilterState;
  search?: string;
}

export interface $ChartSettings {
  /** Entity set path, e.g. "/Orders" (sap.fe.macros.Chart#contextPath). */
  contextPath: string;
  /**
   * Annotation path of the chart, e.g. "@com.sap.vocabularies.UI.v1.Chart#Q" (alias "@UI.Chart#Q"), or of a
   * UI.PresentationVariant / UI.SelectionPresentationVariant that contains one.
   */
  metaPath: string;
  /** Header text of the chart; default the UI.Chart Title. */
  header?: string;
  /**
   * Whether the header (title and the content after it) is shown; the toolbar actions stay.
   * @defaultValue true
   */
  headerVisible?: boolean;
  /**
   * "None": the data points cannot be selected; "Single": one; "Multiple": selecting adds to the selection.
   * @defaultValue Multiple
   */
  selectionMode?: 'None' | 'Single' | 'Multiple';
  /** Toolbar actions at the end of the toolbar (sap.fe.macros.Chart `actions`). */
  actions?: ReactNode;
  /** Data points were selected or deselected. */
  onSelectionChange?(e: Chart$SelectionChangeEvent): void;
  /** Name of the service in `SmartKitProvider` `services`; default: the provider's `defaultService`. */
  service?: string;
  /** Applied filters (from `useFilterState` / the filter bar); null means "not executed yet". Undefined loads without filters. */
  query?: ChartQuery | null;
  /** Content after the header text (e.g. the view switch of the list report). */
  headerContent?: ReactNode;
  /** Drilldown: "Show Details" of the selected data point. */
  onDrilldown?(e: Chart$DrilldownEvent): void;
  /** Change to reload. */
  revision?: number;
  /** getSelectedContexts, getSelectionVariant, setSelectionVariant. */
  ref?: Ref<Chart>;
}

/** Chart building block (sap.fe.macros.Chart). Renders nothing when the metaPath does not resolve to a UI.Chart. */
export function Chart(p: $ChartSettings) {
  const service = useService(p.service);
  const { namespace, locale, intlLocale, timeZone } = useSmartKit();
  const t = useText();
  const model = service.model;
  const ctx = resolveContextPath(model, p.contextPath);
  const chart = ctx ? resolveChartMetaPath(model, ctx.typeName, p.metaPath) : undefined;
  const selectionMode = p.selectionMode ?? 'Multiple';
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [popover, setPopover] = useState<{ d: ChartDatum; anchor: Element } | null>(null);
  const typeName = ctx?.typeName ?? '';
  const dim = chart?.dimensions[0];
  const measure = chart?.measures[0] ?? '';
  const dimProp = dim ? resolvePath(model.entityTypes, typeName, dim).property : undefined;
  const measureProp = measure ? resolvePath(model.entityTypes, typeName, measure).property : undefined;
  const [chartFilters, setChartFilters] = useState<FilterState>({});
  const executed = p.query !== null;
  const filters = { ...p.query?.filters, ...chartFilters };
  const req = chart && ctx ? buildAggregateRequest(model, chart, { source: { entitySet: ctx.entitySet }, filters, search: p.query?.search, timeZone }) : undefined;
  const reqKey = JSON.stringify(req);
  // A new query starts a new selection (data points of the old result may be gone).
  useEffect(() => { setSelectedKeys([]); setPopover(null); }, [reqKey, p.revision]);
  const q = useQuery({
    queryKey: ['smart-kit', namespace, service.name, locale, 'chart', reqKey, p.revision ?? 0],
    queryFn: ({ signal }) => service.dataProvider.query(req!, { signal }),
    enabled: executed && Boolean(req),
  });
  const rows = q.data?.rows ?? [];
  const keyOf = (r: Row) => String(getPath(r, dim ?? '') ?? '');
  const measureKey = measure.replace(/\//g, '_');
  const unit = measureProp?.unit && 'path' in measureProp.unit ? measureProp.unit.path : undefined;
  const data: ChartDatum[] = rows.map((r) => {
    const key = keyOf(r);
    const text = dimProp?.text ? getPath(r, dimProp.text) : undefined;
    const value = Number(r[measureKey] ?? 0);
    const scale = typeof measureProp?.scale === 'number' ? measureProp.scale : 2;
    return { key, label: text ? String(text) : key, value, formatted: `${formatNumber(String(value), intlLocale, { min: scale, max: scale })}${unit && r[unit] ? ` ${String(r[unit])}` : ''}` };
  });
  const selectedRows = () => rows.filter((r) => selectedKeys.includes(keyOf(r)));
  useImperativeHandle(p.ref, () => ({
    getSelectedContexts: selectedRows,
    getSelectionVariant: async () => toSelectionVariant(chartFilters, ''),
    async setSelectionVariant(selectionVariant, prefillDescriptions) { setChartFilters(fromSelectionVariant(selectionVariant, prefillDescriptions)); },
  }));
  if (!chart || !ctx) return null;
  const selectionData = (key: string): ChartSelectionData => {
    const r = rows.find((x) => keyOf(x) === key);
    return { data: { ...(dim ? { [dim]: key } : {}), [measure]: r ? Number(r[measureKey] ?? 0) : undefined } };
  };
  const select = (d: ChartDatum, anchor: Element) => {
    const wasSelected = selectedKeys.includes(d.key);
    if (selectionMode === 'Multiple' && wasSelected) {
      setSelectedKeys(selectedKeys.filter((k) => k !== d.key));
      setPopover(null);
      p.onSelectionChange?.({ data: [selectionData(d.key)], selected: false });
      return;
    }
    if (!wasSelected) {
      const deselected = selectionMode === 'Single' ? selectedKeys : [];
      setSelectedKeys(selectionMode === 'Single' ? [d.key] : [...selectedKeys, d.key]);
      if (deselected.length) p.onSelectionChange?.({ data: deselected.map(selectionData), selected: false });
      p.onSelectionChange?.({ data: [selectionData(d.key)], selected: true });
    }
    setPopover({ d, anchor });
  };
  const header = p.header ?? chart.title;
  return (
    <section className="sk-table sk-chartview" aria-label={header} data-sk-chart-view={chart.id}>
      <div className="sk-table__toolbar" role="toolbar">
        {p.headerVisible === false ? null : (
          <>
            <h2 className="sk-table__title sk-title--h3" data-sk-table-title>{header}</h2>
            {p.headerContent}
          </>
        )}
        <span className="sk-grow" />
        {p.actions}
      </div>
      <div className="sk-chartview__body">
        {!executed ? <Text c="dimmed" ta="center" p="lg">{t('table.noData.start')}</Text> : (
          <SimpleChart
            kind={chart.chartType === 'Bar' ? 'bar' : 'column'}
            title={chart.title}
            measureLabel={measureProp?.label ?? measure}
            dimensionLabel={dimProp?.label ?? dim ?? ''}
            data={data}
            loading={q.isLoading}
            format={(n) => formatNumber(String(n), intlLocale, { max: 0 })}
            selectedKeys={selectedKeys}
            onSelect={selectionMode === 'None' ? undefined : select}
          />
        )}
        <Popover opened={Boolean(popover)} onChange={(o) => { if (!o) setPopover(null); }} position="top" withArrow trapFocus returnFocus>
          <Popover.Target>
            <span className="sk-chartview__anchor" style={popover ? anchorStyle(popover.anchor) : undefined} />
          </Popover.Target>
          <Popover.Dropdown data-sk-chart-popover>
            {popover ? (
              <div>
                <Text fw={600} size="sm">{t('chart.drilldownTitle', { dimension: dimProp?.label ?? '', value: popover.d.label })}</Text>
                <Text size="sm" mb="xs">{measureProp?.label}: {popover.d.formatted}</Text>
                {p.onDrilldown ? (
                  <Button size="xs" onClick={() => { const d = popover.d; setPopover(null); if (dim) p.onDrilldown?.({ dimension: dim, value: d.key }); }} data-sk-chart-drilldown>{t('chart.drilldown')}</Button>
                ) : null}
              </div>
            ) : null}
          </Popover.Dropdown>
        </Popover>
      </div>
    </section>
  );
}

/** Positions the popover target over the selected chart element. */
function anchorStyle(anchor: Element): React.CSSProperties {
  const host = anchor.closest('.sk-chartview__body');
  const a = anchor.getBoundingClientRect();
  const h = host?.getBoundingClientRect();
  return { position: 'absolute', left: a.left - (h?.left ?? 0) + a.width / 2, top: a.top - (h?.top ?? 0), width: 1, height: 1 };
}
