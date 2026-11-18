/**
 * Personalization of the chart building block (sap.fe.macros.Chart `personalization`, sap.ui.mdc.Chart p13nMode, FE
 * MdcChartTemplate / ChartDelegate): the chart type ("Type", the "Chart Type" button), the dimensions and measures
 * with their roles ("Item", the "View By" button and the "Chart" panel), the sort ("Sort" panel) and the chart's own
 * filter conditions ("Filter" panel), all in "View Settings". Also the PresentationVariant form of that state
 * (sap.fe.macros.Chart#getPresentationVariant, `_convertStateUtilToPresentationVariant`) and its storage in a variant.
 */
import { ActionIcon, Menu, Select, Stack, Tooltip } from '@mantine/core';
import type { ChartModel, Condition, FilterState, SortItem, VariantContent } from '@rhfan2019/smart-kit-core';
import { BarChart3, ListTree, Settings2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Item, SortItem as P13nSortItem } from '../controls/p13n/base';
import { Popup } from '../controls/p13n/Popup';
import { SelectionPanel } from '../controls/p13n/SelectionPanel';
import { SortPanel } from '../controls/p13n/SortPanel';
import { FE_CHART_TYPES } from '../chart/chartType';
import { useText } from '../context/SmartKitProvider';
import type { MessageKey } from '../i18n/messages.en';
import type { TextFn } from '../i18n/text';
import { ConditionInput } from '../filter/ConditionInput';
import { presentationVariant, sortOfPresentationVariant, type PresentationVariant } from './presentationVariant';

/** A dimension or measure of the chart with its role (sap.ui.mdc.chart.Item). */
export interface ChartItem {
  name: string;
  kind: 'Dimension' | 'Measure';
  /** Dimensions: "Category", "Series", "Category2"; measures: "Axis1" … "Axis4" (UI.Chart DimensionAttributes / MeasureAttributes). */
  role: string;
}

/** The personalized state of a chart. */
export interface ChartP13nState {
  /** UI.ChartType member, e.g. "Column". */
  chartType: string;
  items: ChartItem[];
  sort: SortItem[];
}

/** The panels `personalization` enables (FE MdcChartTemplate personalizationValues). */
export type ChartP13nMode = 'Sort' | 'Type' | 'Item' | 'Filter';
const ALL_MODES: ChartP13nMode[] = ['Sort', 'Type', 'Item', 'Filter'];

/**
 * The p13n modes of `personalization` (FE MdcChartTemplate checkPersonalizationInChartProperties): true / "true" all,
 * false / "false" none, a comma-separated list of Sort, Type, Item, Filter (an invalid entry disables all, as FE).
 */
export function chartP13nModes(personalization: string | boolean | undefined): ChartP13nMode[] {
  if (personalization === undefined || personalization === true || personalization === 'true') return ALL_MODES;
  if (personalization === false || personalization === 'false' || personalization === '') return [];
  const list = personalization.split(',').map((x) => x.trim());
  return list.every((x) => (ALL_MODES as string[]).includes(x)) ? (list as ChartP13nMode[]) : [];
}

/** The chart types the "Chart Type" button offers (FE 1.154 with one dimension and one measure, sap.chart.api.getChartTypes). */
export const CHART_TYPE_CHOICES = ['Bar', 'Column', 'Line', 'Pie', 'Donut', 'HeatMap', 'Bullet', 'VerticalBullet', 'BarStacked', 'ColumnStacked', 'BarStacked100', 'ColumnStacked100', 'Waterfall', 'HorizontalWaterfall'];

/** The state the annotations give (UI.Chart and the sort of its presentation variant). */
export function defaultChartState(chart: ChartModel, sort: SortItem[] | undefined): ChartP13nState {
  return {
    chartType: chart.chartType,
    items: [
      ...chart.dimensions.map((name): ChartItem => ({ name, kind: 'Dimension', role: chart.dimensionRoles?.[name] ?? 'Category' })),
      ...[...(chart.dynamicMeasures ?? []), ...chart.measures].map((name): ChartItem => ({ name, kind: 'Measure', role: chart.measureRoles?.[name] ?? 'Axis1' })),
    ],
    sort: sort ?? [],
  };
}

const ROLE_TYPE = 'com.sap.vocabularies.UI.v1.ChartDimensionRoleType/';
const CHART_TYPE = 'com.sap.vocabularies.UI.v1.ChartType/';

/**
 * The PresentationVariant of the state, as FE writes it (Chart `_convertStateUtilToPresentationVariant`): the
 * sap.chart type with its first letter in upper case ("Column", "Stacked_column"), roles as ChartDimensionRoleType
 * (FE uses that type for the measures too), the sort as SortOrder.
 */
export function chartStateToPresentationVariant(s: ChartP13nState): PresentationVariant {
  const sapType = FE_CHART_TYPES[s.chartType] ?? s.chartType;
  const dims = s.items.filter((i) => i.kind === 'Dimension');
  const measures = s.items.filter((i) => i.kind === 'Measure');
  return presentationVariant({ SortOrder: s.sort.map((x) => ({ Property: x.path, Descending: x.descending })) }, [{
    Content: {
      ChartType: `${CHART_TYPE}${sapType.charAt(0).toUpperCase()}${sapType.slice(1)}`,
      DimensionAttributes: dims.map((d) => ({ Dimension: d.name, Role: `${ROLE_TYPE}${d.role}` })),
      Dimensions: dims.map((d) => d.name),
      MeasureAttributes: measures.map((m) => ({ Measure: m.name, Role: `${ROLE_TYPE}${m.role}` })),
      Measures: measures.map((m) => m.name),
    },
    Type: 'Chart',
  }]);
}

/** The UI.ChartType member of a PresentationVariant ChartType: a member ("ColumnStacked") or FE's form ("Stacked_column"). */
function chartTypeMember(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value) return undefined;
  const v = value.replace(/^.*\//, '');
  if (FE_CHART_TYPES[v]) return v;
  const sap = v.charAt(0).toLowerCase() + v.slice(1);
  return Object.keys(FE_CHART_TYPES).find((k) => FE_CHART_TYPES[k] === sap);
}

/**
 * Applies a PresentationVariant to the state (Chart#setPresentationVariant): what it names replaces the current
 * value — the chart type, the dimensions and measures (only `allowed` names), the sort; the rest stays.
 */
export function applyChartPresentationVariant(current: ChartP13nState, pv: PresentationVariant, allowed: (item: ChartItem) => boolean): ChartP13nState {
  const viz = pv.Visualizations?.find((v) => v?.Type?.includes('Chart'));
  const content = (viz?.Content ?? {}) as { ChartType?: unknown; Dimensions?: unknown; Measures?: unknown; DimensionAttributes?: unknown; MeasureAttributes?: unknown };
  const roleOf = (attrs: unknown, key: 'Dimension' | 'Measure', name: string, fallback: string) => {
    const a = Array.isArray(attrs) ? (attrs as Record<string, unknown>[]).find((x) => x?.[key] === name) : undefined;
    return typeof a?.Role === 'string' ? a.Role.replace(/^.*\//, '') : fallback;
  };
  const names = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : undefined);
  const dims = names(content.Dimensions);
  const measures = names(content.Measures);
  const items = dims || measures
    ? [
        ...(dims ? dims.map((name): ChartItem => ({ name, kind: 'Dimension', role: roleOf(content.DimensionAttributes, 'Dimension', name, 'Category') })) : current.items.filter((i) => i.kind === 'Dimension')),
        ...(measures ? measures.map((name): ChartItem => ({ name, kind: 'Measure', role: roleOf(content.MeasureAttributes, 'Measure', name, 'Axis1') })) : current.items.filter((i) => i.kind === 'Measure')),
      ].filter(allowed)
    : current.items;
  return { chartType: chartTypeMember(content.ChartType) ?? current.chartType, items, sort: sortOfPresentationVariant(pv) ?? current.sort };
}

/** The state in a variant (VariantContent): items as "<kind>:<name>:<role>" in `columns`, the type as "type:<member>". */
export function chartStateToContent(s: ChartP13nState, filters: FilterState): VariantContent {
  return { filters, sort: s.sort, columns: [`type:${s.chartType}`, ...s.items.map((i) => `${i.kind}:${i.name}:${i.role}`)] };
}

export function chartStateFromContent(c: VariantContent, fallback: ChartP13nState): ChartP13nState {
  if (!c.columns) return { ...fallback, sort: c.sort ?? fallback.sort };
  const type = c.columns.find((x) => x.startsWith('type:'))?.slice(5);
  const items = c.columns.filter((x) => !x.startsWith('type:')).map((x): ChartItem => {
    const [kind, name = '', role = ''] = x.split(':');
    return { kind: kind === 'Measure' ? 'Measure' : 'Dimension', name, role };
  });
  return { chartType: type ?? fallback.chartType, items, sort: c.sort ?? [] };
}

// ---------------------------------------------------------------------------------------------- toolbar buttons

/** The name of a chart type (UI.ChartType member); the member itself without a text. */
export function chartTypeLabel(t: TextFn, member: string): string {
  const key = `chart.type.${member}` as MessageKey;
  const s = t(key);
  return s === key ? member : s;
}

export interface ChartPropertyChoice { name: string; label: string }

/** "Chart Type" (sap.ui.mdc.chart.ChartTypeButton): the selected type, a menu of the others. */
export function ChartTypeButton(p: { value: string; onChange(type: string): void }) {
  const t = useText();
  const label = (m: string) => chartTypeLabel(t, m);
  const choices = CHART_TYPE_CHOICES.includes(p.value) ? CHART_TYPE_CHOICES : [p.value, ...CHART_TYPE_CHOICES];
  const tip = t('chart.selectedType', { type: label(p.value) });
  return (
    <Menu position="bottom-end">
      <Menu.Target>
        <Tooltip label={tip}>
          <ActionIcon aria-label={tip} data-sk-chart-type-button={p.value}><BarChart3 className="sk-icon" /></ActionIcon>
        </Tooltip>
      </Menu.Target>
      <Menu.Dropdown data-sk-chart-type-menu>
        <Menu.Label>{t('chart.chartType')}</Menu.Label>
        {choices.map((m) => (
          <Menu.Item key={m} onClick={() => p.onChange(m)} data-sk-chart-type-choice={m} aria-current={m === p.value || undefined}>{label(m)}</Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}

/** "View By" (sap.ui.mdc.chart drill-down): adds a dimension that is not in the chart yet. */
export function ViewByButton(p: { dimensions: ChartPropertyChoice[]; onSelect(name: string): void }) {
  const t = useText();
  return (
    <Menu position="bottom-end">
      <Menu.Target>
        <Tooltip label={t('chart.viewBy')}>
          <ActionIcon aria-label={t('chart.viewBy')} disabled={!p.dimensions.length} data-sk-chart-view-by><ListTree className="sk-icon" /></ActionIcon>
        </Tooltip>
      </Menu.Target>
      <Menu.Dropdown data-sk-chart-view-by-menu>
        {p.dimensions.map((d) => <Menu.Item key={d.name} onClick={() => p.onSelect(d.name)} data-sk-chart-view-by-choice={d.name}>{d.label}</Menu.Item>)}
      </Menu.Dropdown>
    </Menu>
  );
}

export function ChartSettingsButton(p: { onClick(): void }) {
  const t = useText();
  return (
    <Tooltip label={t('table.settings')}>
      <ActionIcon onClick={p.onClick} aria-label={t('table.settings')} data-sk-chart-settings><Settings2 className="sk-icon" /></ActionIcon>
    </Tooltip>
  );
}

// ---------------------------------------------------------------------------------------------- dialog

export interface ChartP13nDialogProps {
  opened: boolean;
  modes: ChartP13nMode[];
  state: ChartP13nState;
  filters: FilterState;
  /** Dimensions and measures that can be added. */
  dimensions: ChartPropertyChoice[];
  measures: ChartPropertyChoice[];
  /** Properties the Filter panel offers. */
  filterable: ChartPropertyChoice[];
  entitySet: string;
  service?: string;
  /** Reset: back to the annotation state. */
  initial: ChartP13nState;
  onOk(state: ChartP13nState, filters: FilterState): void;
  onCancel(): void;
}

const DIMENSION_ROLES = ['Category', 'Series', 'Category2'];
const MEASURE_ROLES = ['Axis1', 'Axis2', 'Axis3', 'Axis4'];
const byLabel = (x: { label: string }, y: { label: string }) => x.label.localeCompare(y.label);

/** The chart's own filter conditions (the mdc chart's filter panel), a panel of the Popup. */
function ChartFilterPanel(p: { title: string; filters: FilterState; setFilters(f: FilterState): void; filterable: ChartPropertyChoice[]; labelOf(name: string): string; entitySet: string; service?: string }) {
  const t = useText();
  const setFilter = (path: string, conds: Condition[]) => {
    const next = { ...p.filters };
    if (conds.length) next[path] = conds;
    else delete next[path];
    p.setFilters(next);
  };
  return (
    <Stack gap={6} className="sk-p13n-panel" data-sk-chart-p13n-filter>
      {Object.keys(p.filters).map((path) => (
        <ConditionInput key={path} entitySet={p.entitySet} service={p.service} path={path} label={p.labelOf(path)} conditions={p.filters[path] ?? []} onChange={(c) => setFilter(path, c)} />
      ))}
      {p.filterable.some((x) => !(x.name in p.filters)) ? (
        <Select size="xs" placeholder={t('chart.addFilter')} aria-label={t('chart.addFilter')} value={null} searchable
          data={p.filterable.filter((x) => !(x.name in p.filters)).map((x) => ({ value: x.name, label: x.label }))}
          onChange={(v) => v && p.setFilters({ ...p.filters, [v]: [] })} data-sk-chart-p13n-add-filter />
      ) : null}
    </Stack>
  );
}

/**
 * "View Settings" of the chart (sap.ui.mdc.Chart p13n through sap.m.p13n.Popup): the "Chart" panel (Item) is a
 * sap.m.p13n.SelectionPanel of the dimensions and measures with the role in its item factory (mdc ChartItemPanel), "Sort"
 * a sap.m.p13n.SortPanel of the chart's items, "Filter" the chart's own conditions. The results are read when the popup
 * closes with OK.
 */
export function ChartP13nDialog(p: ChartP13nDialogProps) {
  const t = useText();
  const popup = useRef<Popup>(null);
  const itemPanel = useRef<SelectionPanel>(null);
  const sortPanel = useRef<SortPanel>(null);
  const [base, setBase] = useState<{ state: ChartP13nState; filters: FilterState; round: number }>({ state: p.state, filters: p.filters, round: 0 });
  const [roles, setRoles] = useState<Record<string, string>>({});
  const [filters, setFilters] = useState(p.filters);
  const start = (state: ChartP13nState, f: FilterState) => {
    setBase((b) => ({ state, filters: f, round: b.round + 1 }));
    setRoles(Object.fromEntries(state.items.map((i) => [i.name, i.role])));
    setFilters(f);
  };
  useEffect(() => {
    if (!p.opened || popup.current?.isOpen()) return;
    start(p.state, p.filters);
    popup.current?.open(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- built again when the dialog opens
  }, [p.opened]);
  const labelOf = (name: string) => [...p.dimensions, ...p.measures, ...p.filterable].find((x) => x.name === name)?.label ?? name;
  const kindOf = (name: string): 'Dimension' | 'Measure' => (base.state.items.find((i) => i.name === name)?.kind ?? (p.dimensions.some((d) => d.name === name) ? 'Dimension' : 'Measure'));
  const data = useMemo(() => {
    const s = base.state;
    // SelectionPanel: the chart's items in their order, then the other dimensions and measures by label
    const others = [...p.dimensions, ...p.measures].filter((c) => !s.items.some((i) => i.name === c.name)).sort(byLabel);
    const items: Item[] = [...s.items.map((i) => ({ name: i.name, label: labelOf(i.name), visible: true })), ...others.map((c) => ({ name: c.name, label: c.label, visible: false }))];
    const sorted = s.sort.filter((o) => s.items.some((i) => i.name === o.path));
    const sort: P13nSortItem[] = [
      ...sorted.map((o) => ({ name: o.path, label: labelOf(o.path), sorted: true, descending: Boolean(o.descending) })),
      ...s.items.filter((i) => !sorted.some((o) => o.path === i.name)).map((i) => ({ name: i.name, label: labelOf(i.name), sorted: false, descending: false })).sort(byLabel),
    ];
    return { items, sort };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- built again for each opening
  }, [base.round]);
  const roleSelect = (item: Item) => {
    if (!item.visible) return null;
    const kind = kindOf(item.name);
    const choices = kind === 'Dimension' ? DIMENSION_ROLES : MEASURE_ROLES;
    return (
      <Select size="xs" w={160} allowDeselect={false} aria-label={t('chart.layoutOption')} value={roles[item.name] ?? choices[0]}
        data={choices.map((x) => ({ value: x, label: t(`chart.role.${x}` as MessageKey) }))}
        onChange={(v) => v && setRoles((r) => ({ ...r, [item.name]: v }))} data-sk-chart-p13n-role={item.name} />
    );
  };
  const panels = [
    p.modes.includes('Item') ? <SelectionPanel key="item" ref={itemPanel} title={t('chart.panel')} showHeader enableCount p13nData={data.items} itemFactory={roleSelect} /> : null,
    p.modes.includes('Sort') ? <SortPanel key="sort" ref={sortPanel} title={t('p13n.sort')} p13nData={data.sort} /> : null,
    p.modes.includes('Filter') ? <ChartFilterPanel key="filter" title={t('chart.filter')} filters={filters} setFilters={setFilters} filterable={p.filterable} labelOf={labelOf} entitySet={p.entitySet} service={p.service} /> : null,
  ];
  return (
    <Popup
      ref={popup} title={t('p13n.title')} panels={panels} warningText={t('chart.resetWarning')}
      reset={() => start(p.initial, {})}
      onClose={({ reason }) => {
        if (reason !== 'Ok') { p.onCancel(); return; }
        const s = base.state;
        let items = s.items;
        if (itemPanel.current) {
          const chosen = itemPanel.current.getP13nData(true).map((x): ChartItem => {
            const kind = kindOf(x.name);
            return { name: x.name, kind, role: roles[x.name] ?? (kind === 'Dimension' ? DIMENSION_ROLES[0]! : MEASURE_ROLES[0]!) };
          });
          // a chart needs a dimension and a measure: without one of them the previous ones stay
          const keep = (kind: 'Dimension' | 'Measure') => (chosen.some((i) => i.kind === kind) ? [] : s.items.filter((i) => i.kind === kind));
          items = [...keep('Dimension'), ...chosen, ...keep('Measure')];
        }
        const sort = (sortPanel.current ? sortPanel.current.getP13nData(true).map((x) => ({ path: x.name, descending: x.descending })) : s.sort).filter((o) => items.some((i) => i.name === o.path));
        p.onOk({ ...s, items, sort }, Object.fromEntries(Object.entries(filters).filter(([, c]) => c.length)));
      }}
    />
  );
}
