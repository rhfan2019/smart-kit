/**
 * Chart view of a list report (LR Simple Content / Multiple Views, ADR-021): the data aggregated on the server by the
 * chart's dimension; selecting a bar opens a popover whose "Show Details" drills down (docs/12 U-4).
 */
import { Button, Popover, Text } from '@mantine/core';
import { buildAggregateRequest, formatNumber, resolvePath, type ChartModel, type FilterState } from '@rhfan2019/smart-kit-core';
import { useQuery } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { SimpleChart, type ChartDatum } from '../chart/SimpleChart';
import { useService, useSmartKit, useText } from '../context/SmartKitProvider';
import { getPath } from '../field/values';

export interface ChartViewProps {
  /** Entity set name as in `$metadata`, e.g. "Orders". */
  entitySet: string;
  /** Name of the service in `SmartKitProvider` `services`; default: the provider's `defaultService`. */
  service?: string;
  /** Chart from the model (`ui.charts[qualifier]`, from `UI.Chart`). */
  chart: ChartModel;
  /** Filter state (from `useFilterState` / `SmartFilterBar`), applied to the request. */
  filters: FilterState;
  /** Search term ($search). */
  search?: string;
  /** null: not executed yet. */
  executed: boolean;
  /** Toolbar title. */
  title: string;
  /** Toolbar content after the title (content switch). */
  titleAddon?: ReactNode;
  /** Toolbar content at the end (table / chart toggle). */
  toolbarEnd?: ReactNode;
  /** Drilldown: the dimension value of the selected element. */
  onDrilldown(dimension: string, value: string): void;
}

export function ChartView(p: ChartViewProps) {
  const service = useService(p.service);
  const { namespace, locale, intlLocale, timeZone } = useSmartKit();
  const t = useText();
  const model = service.model;
  const typeName = model.entitySets[p.entitySet]!.typeName;
  const dim = p.chart.dimensions[0];
  const measure = p.chart.measures[0]!;
  const dimProp = dim ? resolvePath(model.entityTypes, typeName, dim).property : undefined;
  const measureProp = resolvePath(model.entityTypes, typeName, measure).property;
  const req = buildAggregateRequest(model, p.chart, { source: { entitySet: p.entitySet }, filters: p.filters, search: p.search, timeZone });
  const q = useQuery({
    queryKey: ['smart-kit', namespace, service.name, locale, 'chart', JSON.stringify(req)],
    queryFn: ({ signal }) => service.dataProvider.query(req, { signal }),
    enabled: p.executed,
  });
  const unit = measureProp?.unit && 'path' in measureProp.unit ? measureProp.unit.path : undefined;
  const data: ChartDatum[] = (q.data?.rows ?? []).map((r) => {
    const key = String(getPath(r, dim ?? '') ?? '');
    const text = dimProp?.text ? getPath(r, dimProp.text) : undefined;
    const value = Number(r[measure.replace(/\//g, '_')] ?? 0);
    const scale = typeof measureProp?.scale === 'number' ? measureProp.scale : 2;
    return { key, label: text ? String(text) : key, value, formatted: `${formatNumber(String(value), intlLocale, { min: scale, max: scale })}${unit && r[unit] ? ` ${String(r[unit])}` : ''}` };
  });
  const [selected, setSelected] = useState<{ d: ChartDatum; anchor: Element } | null>(null);
  return (
    <section className="sk-table sk-chartview" aria-label={p.title} data-sk-chart-view={p.chart.id}>
      <div className="sk-table__toolbar" role="toolbar">
        <h2 className="sk-table__title sk-title--h3" data-sk-table-title>{p.title}</h2>
        {p.titleAddon}
        <span className="sk-grow" />
        {p.toolbarEnd}
      </div>
      <div className="sk-chartview__body">
        {!p.executed ? <Text c="dimmed" ta="center" p="lg">{t('table.noData.start')}</Text> : (
          <SimpleChart
            kind={p.chart.chartType === 'Bar' ? 'bar' : 'column'}
            title={p.chart.title}
            measureLabel={measureProp?.label ?? measure}
            dimensionLabel={dimProp?.label ?? dim ?? ''}
            data={data}
            loading={q.isLoading}
            format={(n) => formatNumber(String(n), intlLocale, { max: 0 })}
            selectedKey={selected?.d.key}
            onSelect={(d, anchor) => setSelected({ d, anchor })}
          />
        )}
        <Popover opened={Boolean(selected)} onChange={(o) => { if (!o) setSelected(null); }} position="top" withArrow trapFocus returnFocus>
          <Popover.Target>
            <span className="sk-chartview__anchor" style={selected ? anchorStyle(selected.anchor) : undefined} />
          </Popover.Target>
          <Popover.Dropdown data-sk-chart-popover>
            {selected ? (
              <div>
                <Text fw={600} size="sm">{t('chart.drilldownTitle', { dimension: dimProp?.label ?? '', value: selected.d.label })}</Text>
                <Text size="sm" mb="xs">{measureProp?.label}: {selected.d.formatted}</Text>
                <Button size="xs" onClick={() => { const d = selected.d; setSelected(null); if (dim) p.onDrilldown(dim, d.key); }} data-sk-chart-drilldown>{t('chart.drilldown')}</Button>
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
