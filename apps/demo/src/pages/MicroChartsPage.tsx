/**
 * Micro chart scenarios (docs/15-research-micro-chart.md): every chart type in the business situation the SAP
 * guidelines name for it, at the size of the place it lives in (header facet, table cell). The data is fixed
 * demo data; the pages driven by annotations are linked at the end.
 */
import { MicroChart, type MicroChartCriticality, type MicroChartPoint, type MicroChartProps } from '@rhfan2019/smart-kit';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useShell } from '../App';
import { objectHref } from '../navigation';

type Lang = 'zh' | 'en';
type Placement = 'facet' | 'wideFacet' | 'cell';

/** Box of each place (docs/15 MC-02, MC-03): header facet 160 × 72, wide facet 320 × 94, table cell. */
const BOX: Record<Placement, { width: number | string; height: number | string }> = {
  facet: { width: 'var(--sk-microchart-facet-width)', height: 'var(--sk-microchart-facet-height)' },
  wideFacet: { width: 'var(--sk-microchart-max-width)', height: 'var(--sk-microchart-max-height)' },
  cell: { width: '100%', height: 'var(--sk-microchart-cell-height)' },
};

const TEXT = {
  zh: {
    title: '微型图表的应用场景',
    intro: '每个案例都是 SAP 规范为这种图指定的业务场景，图的大小就是它所在位置的大小（页头 Facet 160×72、宽 Facet 320×94、表格单元格）。数据是演示数据；最后一节链接到由注解驱动的真实页面。',
    place: { facet: '对象页页头 Facet · 160×72', wideFacet: '对象页页头 宽 Facet · 320×94', cell: '表格单元格' },
    why: '为什么用这种图', rules: '规则',
    single: '一个值和它的目标', singleText: '某个时点的一个关键值：和目标、预测、阈值比较（Bullet），或只看占比（Radial、Harvey Ball）。',
    time: '一段时间里的变化', timeText: '按时间排列的多个值：强调每期的值（Column），看趋势（Line），或和目标、阈值区域比较（Area）。',
    parts: '比较与构成', partsText: '几个类别之间比大小（Comparison），几部分占整体多少（Stacked Bar），两个数之差（Delta）。',
    table: '表格单元格里的微型图表：供应商绩效', tableText: '同一列的图用同一刻度，各行才能比较（MC-40、MC-59）；单元格低于 56 px，所以图上不显示标签，数值在屏幕阅读器的说明里（MC-27）；没有数据的单元格留空（MC-06）。',
    live: '由注解驱动的真实页面', liveText: '下面这些页面里的图都由服务的 UI.Chart、UI.DataPoint 注解生成，不是手写的属性。',
    liveList: '采购订单列表：“预算使用”列是每行的 Bullet', liveOrder: '订单 4500000001 页头：预算使用 Bullet、交货完成率 Radial', liveItem: '订单项目 10 页头：Harvey Ball、差值 Bullet、Line、Area、Column、Comparison、Stacked Bar', liveItems: '订单 4500000001 的“项目”表格：单元格里的数量折线（导航集合，$expand 读取）',
    supplier: '供应商', onTime: '准时交货率', spend: '采购额 / 预算', weekly: '近 12 周交货量', quality: '收货质量构成',
    good: '合格', concession: '让步接收', rejected: '退货', newSupplier: '（新供应商）',
  },
  en: {
    title: 'Micro Chart Scenarios',
    intro: 'Each case is the business situation the SAP guidelines give for the chart, at the size of the place it lives in (header facet 160×72, wide facet 320×94, table cell). The data is demo data; the last section links to real pages driven by annotations.',
    place: { facet: 'Object page header facet · 160×72', wideFacet: 'Object page header, wide facet · 320×94', cell: 'Table cell' },
    why: 'Why this chart', rules: 'Rules',
    single: 'One value and its target', singleText: 'One key value at a point in time: compared with target, forecast and thresholds (Bullet), or as a share only (Radial, Harvey Ball).',
    time: 'Change over time', timeText: 'Values in time order: the value of each period (Column), the trend (Line), or against target and threshold areas (Area).',
    parts: 'Comparison and composition', partsText: 'Sizes of a few categories (Comparison), the parts of a whole (Stacked Bar), the difference of two numbers (Delta).',
    table: 'Micro charts in table cells: supplier performance', tableText: 'The charts of a column share one scale, so rows can be compared (MC-40, MC-59). Cells are lower than 56 px, so the charts show no labels; the numbers are in the screen reader text (MC-27). A cell without data stays empty (MC-06).',
    live: 'Real pages driven by annotations', liveText: 'The charts on these pages come from the service\'s UI.Chart and UI.DataPoint annotations, not from hand-written props.',
    liveList: 'Purchase order list: the "Budget Usage" column is a bullet per row', liveOrder: 'Header of order 4500000001: budget usage bullet, delivery rate radial', liveItem: 'Header of order item 10: Harvey Ball, delta bullet, line, area, column, comparison, stacked bar', liveItems: '"Items" table of order 4500000001: quantity lines in the cells (collection navigation read with $expand)',
    supplier: 'Supplier', onTime: 'On-time delivery', spend: 'Spend / budget', weekly: 'Deliveries, last 12 weeks', quality: 'Goods receipt quality',
    good: 'Accepted', concession: 'Concession', rejected: 'Returned', newSupplier: '(new supplier)',
  },
} as const;

interface Scenario {
  id: string;
  title: Record<Lang, string>;
  subtitle: Record<Lang, string>;
  placement: Placement;
  why: Record<Lang, string>;
  rules: string;
  chart: Omit<MicroChartProps, 'label'>;
}

const monthNames = (lang: Lang, n: number, last = new Date(2026, 9, 1)) => Array.from({ length: n }, (_, i) =>
  new Intl.DateTimeFormat(lang === 'zh' ? 'zh-CN' : 'en-US', { month: 'short' }).format(new Date(last.getFullYear(), last.getMonth() - (n - 1 - i), 1)));
const weeks = (lang: Lang, n: number) => Array.from({ length: n }, (_, i) => (lang === 'zh' ? `第 ${31 + i} 周` : `W${31 + i}`));
const series = (labels: string[], values: number[], extra?: (v: number, i: number) => Partial<MicroChartPoint>): MicroChartPoint[] =>
  values.map((value, i) => ({ label: labels[i]!, value, ...extra?.(value, i) }));
const bySign = (v: number): Partial<MicroChartPoint> => ({ criticality: v < 0 ? 1 : 3 });

function scenarios(lang: Lang): { group: 'single' | 'time' | 'parts'; items: Scenario[] }[] {
  const m6 = monthNames(lang, 6);
  const m12 = monthNames(lang, 12);
  const w12 = weeks(lang, 12);
  const price = [41.8, 42.0, 42.3, 42.1, 42.9, 43.4, 43.2, 44.1, 44.8, 45.3, 45.0, 45.6];
  const cash = [3.1, 3.4, 3.2, 3.8, 4.1, 3.9, 4.4, 4.0, 4.6, 4.9, 5.2, 5.5].map((v) => v * 1e6);
  return [
    {
      group: 'single',
      items: [
        {
          id: 'bullet-revenue', placement: 'facet', rules: 'MC-20, MC-22, MC-23, MC-25',
          title: { zh: '年初至今销售收入', en: 'Revenue Year to Date' }, subtitle: { zh: '人民币 · 目标 1000 万', en: 'CNY · target 10M' },
          why: { zh: '一个时点的主要值（年初至今收入）同时和目标、预测比较，背景竖线是“差”（600 万）和“警告”（800 万）阈值。已超过警告线，所以是好（绿色）。', en: 'One main value at a point in time (revenue year to date) compared with target and forecast; the lines mark the critical (6M) and warning (8M) thresholds. It is above the warning line, so it is good (green).' },
          chart: { kind: 'bullet', value: 8.4e6, target: 10e6, forecast: 10.6e6, criticality: 3, thresholds: [{ value: 6e6, criticality: 1 }, { value: 8e6, criticality: 2 }] },
        },
        {
          id: 'bullet-cost', placement: 'facet', rules: 'MC-24, MC-09',
          title: { zh: '成本中心费用偏差', en: 'Cost Center Variance' }, subtitle: { zh: '实际与预算之差', en: 'Actual minus budget' },
          why: { zh: '关心的是“比预算多了多少”而不是总额，用差值子弹图（DataPoint 的 Visualization = DeltaBulletChart）。费用越低越好（Minimize），超支 18%，所以是差（红色）。', en: 'What matters is how far actual is from budget, not the total, so it is a delta bullet (DataPoint Visualization = DeltaBulletChart). Lower is better (Minimize); 18% over budget is critical (red).' },
          chart: { kind: 'bullet', mode: 'delta', value: 1.18e6, target: 1e6, criticality: 1 },
        },
        {
          id: 'radial-ontime', placement: 'facet', rules: 'MC-50, MC-51',
          title: { zh: '订单准时交货率', en: 'On-Time Delivery Rate' }, subtitle: { zh: '本季度', en: 'This quarter' },
          why: { zh: '只需要一个百分比。没有 TargetValue 时值本身就是百分数（MC-51）。要显示具体件数、或比较两个以上的值时不要用它。', en: 'Only one percentage is needed. Without a TargetValue the value is the percentage (MC-51). Not for absolute numbers or comparing more than two values.' },
          chart: { kind: 'radial', value: 92, criticality: 3 },
        },
        {
          id: 'harvey-received', placement: 'facet', rules: 'MC-55, MC-56, MC-57',
          title: { zh: '已收货数量', en: 'Quantity Received' }, subtitle: { zh: '件 · 订购 500', en: 'pcs · ordered 500' },
          why: { zh: '一个值占总数多少：已收 320 件 / 订购 500 件。总数来自 MaximumValue，没有总数就不画。收货进度没有好坏之分，所以用定性色板而不是语义色。', en: 'A value of a total: 320 of 500 pieces received. The total comes from MaximumValue; without it nothing is drawn. Progress is not good or bad, so it uses the qualitative palette, not a semantic colour.' },
          chart: { kind: 'harvey', value: 320, max: 500, color: 1 },
        },
        {
          id: 'harvey-contract', placement: 'facet', rules: 'MC-55, MC-56',
          title: { zh: '框架合同额度已用', en: 'Contract Volume Used' }, subtitle: { zh: '人民币 · 额度 800 万', en: 'CNY · volume 8M' },
          why: { zh: '同样是部分占总数，但额度快用完需要提醒，这时 DataPoint 带 Criticality，用语义色（警告）。', en: 'Again a part of a total, but nearly used up needs attention: the DataPoint has a Criticality, so it uses the semantic colour (warning).' },
          chart: { kind: 'harvey', value: 7.2e6, max: 8e6, criticality: 2 },
        },
        {
          id: 'empty-supplier', placement: 'facet', rules: 'MC-05',
          title: { zh: '新供应商的交货评分', en: 'Delivery Score of a New Supplier' }, subtitle: { zh: '还没有交货记录', en: 'No deliveries yet' },
          why: { zh: '值为空时，页头里不画一个 0 的假图，而是显示“没有数据”（表格单元格里则留空）。', en: 'Without a value the header shows "No data" instead of a misleading zero (a table cell stays empty).' },
          chart: { kind: 'bullet', target: 100 },
        },
      ],
    },
    {
      group: 'time',
      items: [
        {
          id: 'column-margin', placement: 'wideFacet', rules: 'MC-30, MC-31, MC-32',
          title: { zh: '近 6 个月毛利', en: 'Gross Margin, Last 6 Months' }, subtitle: { zh: '人民币', en: 'CNY' },
          why: { zh: '比较每个月的值本身，有正有负（7 月亏损）。柱子按正负着色，高度够 72 px 时每根柱子上显示数值。', en: 'Compares the value of each month, positive and negative (a loss in July). Columns are coloured by sign; at 72 px or higher each column shows its value.' },
          chart: { kind: 'column', columnLabels: true, points: series(m6, [420e3, 380e3, -120e3, 260e3, 510e3, 470e3], bySign) },
        },
        {
          id: 'line-price', placement: 'wideFacet', rules: 'MC-35, MC-38, MC-39',
          title: { zh: '原材料采购单价走势', en: 'Raw Material Unit Price Trend' }, subtitle: { zh: '近 12 周 · 合同价 44', en: 'Last 12 weeks · contract price 44' },
          why: { zh: '看形状和趋势：单价一路上涨，第 39 周起超过合同价。阈值线标出合同价，首尾两个焦点给出起止值；只画一条线（规范建议 1 条，最多 3 条）。', en: 'Shows the shape of the trend: the price keeps rising and passes the contract price from week 39. The threshold line marks the contract price; focus points give the first and last value. One line (recommended; at most three).' },
          chart: { kind: 'line', points: series(w12, price), threshold: 44, thresholdLabel: true, focusPoints: [0, 11] },
        },
        {
          id: 'area-cash', placement: 'wideFacet', rules: 'MC-45, MC-46, MC-47',
          title: { zh: '月末现金余额', en: 'Month-End Cash Balance' }, subtitle: { zh: '人民币 · 实际与目标', en: 'CNY · actual and target' },
          why: { zh: '一段时间里实际值（实线）和目标值（点线）的趋势，背景是阈值区域：低于 350 万为差、低于 400 万为警告（越高越好，Maximize）。', en: 'Actual (solid) and target (dotted) over time against threshold areas: below 3.5M is critical, below 4M is a warning (higher is better, Maximize).' },
          chart: {
            kind: 'area', points: series(m12, cash, () => ({ target: 4.5e6 })),
            areaThresholds: { direction: 'Maximize', deviationLow: m12.map(() => 3.5e6), toleranceLow: m12.map(() => 4e6) },
          },
        },
      ],
    },
    {
      group: 'parts',
      items: [
        {
          id: 'comparison-suppliers', placement: 'wideFacet', rules: 'MC-40, MC-41, MC-42',
          title: { zh: '前 5 大供应商采购额', en: 'Top 5 Suppliers by Spend' }, subtitle: { zh: '本年 · 人民币', en: 'This year · CNY' },
          why: { zh: '比较几个类别（供应商）的大小，不是时间序列。宽度超过 192 px 时名称在左、数值在右；最多 12 条。', en: 'Compares the size of a few categories (suppliers), not a time series. Wider than 192 px: names on the left, values on the right; at most 12 bars.' },
          chart: { kind: 'comparison', points: series(['Fasteners Ltd', 'Northstar Metals', 'Blue Ridge Plastics', 'Delta Logistics', 'Acme Tools'], [3.2e6, 2.6e6, 1.9e6, 1.1e6, 0.6e6]) },
        },
        {
          id: 'stacked-status', placement: 'wideFacet', rules: 'MC-58, MC-59',
          title: { zh: '订单金额按状态构成', en: 'Order Value by Status' }, subtitle: { zh: '本月 · 占比', en: 'This month · share' },
          why: { zh: '几部分叠成一根条，看各占整体多少：已开票、已收货待开票、未交货。没有最大值，所以全长是 100%，每段显示百分比。不能有负数。', en: 'The parts stacked into one bar to show their share: invoiced, received but not invoiced, open. No maximum, so the bar is 100% and each segment shows its percentage. No negative values.' },
          chart: { kind: 'stackedBar', points: [
            { label: lang === 'zh' ? '已开票' : 'Invoiced', value: 5.4e6, color: 1 },
            { label: lang === 'zh' ? '已收货待开票' : 'Received, not invoiced', value: 2.1e6, color: 2 },
            { label: lang === 'zh' ? '未交货' : 'Open', value: 1.5e6, color: 3 },
          ] },
        },
        {
          id: 'delta-quarter', placement: 'wideFacet', rules: 'MC-62, MC-64',
          title: { zh: '销售额：本季度比上季度', en: 'Sales: This Quarter vs Last' }, subtitle: { zh: '人民币', en: 'CNY' },
          why: { zh: '两个关键数字的差（这里是两个时间点）。值条用中性色，差值条用语义色（增长为好）。Delta 与 SAP 一致不由注解驱动，应用直接传值。', en: 'The difference of two key numbers (here two points in time). The value bars are neutral; the difference bar is semantic (growth is good). As in SAP, Delta is not driven by annotations; the application passes the values.' },
          chart: { kind: 'delta', value: 4.2e6, target: 3.6e6, titles: lang === 'zh' ? ['2026 年第 3 季度', '2026 年第 2 季度'] : ['Q3 2026', 'Q2 2026'], criticality: 3 },
        },
      ],
    },
  ];
}

function ChartBox({ placement, children }: { placement: Placement; children: ReactNode }) {
  return <div className="demo-mc__box" style={BOX[placement]}>{children}</div>;
}

function Card({ s, lang }: { s: Scenario; lang: Lang }) {
  const t = TEXT[lang];
  const title = s.title[lang];
  return (
    <article className="demo-mc__card" data-demo-scenario={s.id}>
      <div className="demo-mc__place">{t.place[s.placement]}</div>
      {/* Looks like a header facet: title, subtitle, chart (docs/15 MC-11). */}
      <div className="demo-mc__facet">
        <div className="demo-mc__facet-title">{title}</div>
        <div className="demo-mc__facet-subtitle">{s.subtitle[lang]}</div>
        <ChartBox placement={s.placement}><MicroChart label={title} {...s.chart} /></ChartBox>
      </div>
      <h4>{t.why}</h4>
      <p>{s.why[lang]}</p>
      <div className="demo-mc__rules">{t.rules}: {s.rules}</div>
    </article>
  );
}

interface SupplierRow { name: string; onTime?: number; spend?: number; budget?: number; weekly?: number[]; quality?: [number, number, number] }

const SUPPLIERS: SupplierRow[] = [
  { name: 'Fasteners Ltd', onTime: 96, spend: 3.2e6, budget: 3.5e6, weekly: [12, 14, 13, 15, 16, 15, 17, 18, 17, 19, 18, 20], quality: [1880, 40, 12] },
  { name: 'Northstar Metals', onTime: 88, spend: 2.6e6, budget: 2.4e6, weekly: [10, 9, 11, 10, 8, 9, 7, 8, 7, 6, 7, 6], quality: [940, 85, 60] },
  { name: 'Blue Ridge Plastics', onTime: 74, spend: 1.9e6, budget: 2.5e6, weekly: [6, 8, 5, 9, 4, 8, 6, 10, 5, 9, 6, 8], quality: [610, 30, 95] },
  { name: 'Delta Logistics', onTime: 99, spend: 1.1e6, budget: 1.2e6, weekly: [4, 4, 5, 5, 5, 6, 6, 6, 7, 7, 7, 8], quality: [410, 5, 2] },
  { name: 'Acme Tools', spend: 0.2e6, budget: 0.8e6 },
];

function SupplierTable({ lang }: { lang: Lang }) {
  const t = TEXT[lang];
  const w12 = weeks(lang, 12);
  const crit = (rate: number): MicroChartCriticality => (rate >= 95 ? 3 : rate >= 85 ? 2 : 1);
  // One scale per column (MC-40, MC-59): the largest value of the whole table.
  const spendMax = Math.max(...SUPPLIERS.flatMap((r) => [r.spend ?? 0, r.budget ?? 0]));
  const weeklyMax = Math.max(...SUPPLIERS.flatMap((r) => r.weekly ?? []));
  const qualityMax = Math.max(...SUPPLIERS.map((r) => (r.quality ?? [0, 0, 0]).reduce((a, b) => a + b, 0)));
  return (
    <table className="demo__table demo-mc__table" data-demo-supplier-table>
      <thead><tr><th>{t.supplier}</th><th>{t.onTime}</th><th>{t.spend}</th><th>{t.weekly}</th><th>{t.quality}</th></tr></thead>
      <tbody>
        {SUPPLIERS.map((r) => (
          <tr key={r.name}>
            <td>{r.name}{r.weekly ? '' : ` ${t.newSupplier}`}</td>
            <td><ChartBox placement="cell"><MicroChart kind="radial" label={`${r.name} · ${t.onTime}`} value={r.onTime} criticality={r.onTime === undefined ? undefined : crit(r.onTime)} hideOnNoData /></ChartBox></td>
            <td><ChartBox placement="cell"><MicroChart kind="bullet" label={`${r.name} · ${t.spend}`} value={r.spend} target={r.budget} min={0} max={spendMax} criticality={r.spend !== undefined && r.budget !== undefined && r.spend > r.budget ? 1 : 3} hideOnNoData /></ChartBox></td>
            <td><ChartBox placement="cell"><MicroChart kind="line" label={`${r.name} · ${t.weekly}`} points={r.weekly ? series(w12, r.weekly) : []} scaleMin={0} scaleMax={weeklyMax} hideOnNoData /></ChartBox></td>
            <td><ChartBox placement="cell"><MicroChart kind="stackedBar" label={`${r.name} · ${t.quality}`} max={qualityMax} hideOnNoData points={r.quality ? [
              { label: t.good, value: r.quality[0], criticality: 3 },
              { label: t.concession, value: r.quality[1], criticality: 2 },
              { label: t.rejected, value: r.quality[2], criticality: 1 },
            ] : []} /></ChartBox></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const ORDER = "PurchaseOrders('4500000001')";
const ITEM = `${ORDER}/_Item(PurchaseOrder='4500000001',PurchaseOrderItem=10)`;

export function MicroChartsPage() {
  const { locale } = useShell();
  const lang: Lang = locale === 'en' ? 'en' : 'zh';
  const t = TEXT[lang];
  return (
    <div className="demo__page demo-mc" data-demo-microcharts>
      <h1>{t.title}</h1>
      <p className="demo-mc__intro">{t.intro}</p>
      {scenarios(lang).map((g) => (
        <section key={g.group} className="demo-mc__section" data-demo-group={g.group}>
          <h2>{t[g.group]}</h2>
          <p>{t[`${g.group}Text`]}</p>
          <div className="demo-mc__grid">{g.items.map((s) => <Card key={s.id} s={s} lang={lang} />)}</div>
        </section>
      ))}
      <section className="demo-mc__section">
        <h2>{t.table}</h2>
        <p>{t.tableText}</p>
        <SupplierTable lang={lang} />
      </section>
      <section className="demo-mc__section" data-demo-live>
        <h2>{t.live}</h2>
        <p>{t.liveText}</p>
        <ul>
          <li><Link to="/po">{t.liveList}</Link></li>
          <li><Link to={objectHref('purchasing', ORDER)}>{t.liveOrder}</Link></li>
          <li><Link to={objectHref('purchasing', ITEM)}>{t.liveItem}</Link></li>
          <li><Link to={objectHref('purchasing', ORDER)}>{t.liveItems}</Link></li>
        </ul>
      </section>
    </div>
  );
}
