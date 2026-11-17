/** Phase 3 micro charts (docs/15-research-micro-chart.md): Bullet, Radial, Harvey Ball and the shared rules. */
import { buildModel, type ChartModel, type FieldModel } from '@rhfan2019/smart-kit-core';
import { render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MicroChart, SmartField } from '../src';
import { chartHidden, chartProps, seriesChartProps } from '../src/chart/fromModel';
import { wrap } from './helpers';

const bars = (root: Element, key?: string) => root.querySelectorAll(key ? `[data-sk-microchart-bar="${key}"]` : '[data-sk-microchart-bar]');

/** A ResizeObserver that reports one fixed content box. */
function fakeResize(width: number, height: number) {
  class RO {
    constructor(private cb: ResizeObserverCallback) {}
    observe() { this.cb([{ contentRect: { width, height } } as ResizeObserverEntry], this as unknown as ResizeObserver); }
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', RO);
}
afterEach(() => vi.unstubAllGlobals());

describe('docs/15 shared rules', () => {
  it('MC-02 / MC-27 the measured height decides the labels: below 56 px a bullet has none', () => {
    fakeResize(200, 30);
    const { container } = render(wrap(<MicroChart kind="bullet" label="Budget" value={10} target={20} />));
    expect(container.querySelector('.sk-microchart')).toHaveClass('sk-microchart--compact');
    expect(container.querySelector('.sk-microchart__lane')).toBeNull();
    // the text alternative still has everything
    expect(screen.getByRole('img', { name: 'Budget: Actual 10, Target 20' })).toBeInTheDocument();
  });

  it('MC-13 visible labels use the short form; the text alternative the full number', () => {
    render(wrap(<MicroChart kind="harvey" label="Qty" value={1500000} max={4000000} />));
    const img = screen.getByRole('img', { name: 'Qty: 1,500,000 of 4,000,000' });
    expect(img).toHaveTextContent('1.5M');
    expect(img).toHaveTextContent('4M');
  });

  it('MC-04 a number that does not fit hides its whole label group instead of being cut', () => {
    const spy = vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(function (this: HTMLElement) { return this.textContent === '1.2M' ? 80 : 0; });
    const { container } = render(wrap(<MicroChart kind="bullet" label="Budget" value={1234567} target={20} />));
    expect(container.querySelector('.sk-microchart__lane')).toHaveAttribute('data-sk-overflow');
    spy.mockRestore();
  });

  it('MC-05 no data: a focusable placeholder that cannot be pressed; MC-06 empty in table cells', () => {
    const onPress = vi.fn();
    const { container } = render(wrap(
      <>
        <MicroChart kind="bullet" label="A" onPress={onPress} />
        <span data-cell><MicroChart kind="harvey" label="B" value={1} hideOnNoData /></span>
      </>,
    ));
    const placeholder = screen.getByRole('img', { name: 'A: No data' });
    expect(placeholder).toHaveAttribute('tabindex', '0');
    expect(screen.queryByRole('button')).toBeNull();
    expect(container.querySelector('[data-cell]')).toBeEmptyDOMElement();
  });

  it('MC-08 every theme defines the eleven palette colours; components only reference tokens', () => {
    const css = readFileSync(join(import.meta.dirname, '../src/theme/tokens.css'), 'utf8');
    for (const theme of [":root,\n[data-sk-theme='yellow']", "[data-sk-theme='navy']", "[data-sk-theme='sky']", "[data-sk-theme='dark']"]) {
      const block = css.slice(css.indexOf(theme), css.indexOf('}', css.indexOf(theme)));
      for (let i = 1; i <= 11; i++) expect(block).toContain(`--sk-color-chart-${i}: var(--sk-`);
    }
    for (let i = 1; i <= 11; i++) expect(css).toContain(`--sk-chart-palette-${i}: var(--sk-color-chart-${i});`);
  });
});

describe('docs/15 bullet', () => {
  it('MC-22 the actual bar is neutral without criticality; MC-23 forecast bar; MC-25 thresholds', () => {
    render(wrap(<MicroChart kind="bullet" label="Sales" value={60} target={80} forecast={90} thresholds={[{ value: 40, criticality: 1 }, { value: 70, criticality: 2 }]} />));
    const img = screen.getByRole('img', { name: 'Sales: Actual 60, Target 80, Forecast 90, Thresholds 40, 70' });
    expect(img).toHaveClass('sk-chart--neutral');
    expect(bars(img, 'forecast')).toHaveLength(1);
    const th = bars(img, 'threshold');
    expect(th).toHaveLength(2);
    expect(th[0]).toHaveClass('sk-chart--negative');
    expect(th[1]).toHaveClass('sk-chart--critical');
  });

  it('MC-24 delta mode: the bar starts at the target and the label is the difference', () => {
    render(wrap(<MicroChart kind="bullet" label="Invoiced" value={760} target={1000} mode="delta" forecast={900} />));
    const img = screen.getByRole('img', { name: 'Invoiced: Difference -240, Target 1,000' });
    const bar = bars(img, 'delta')[0]!;
    expect(Number(bar.getAttribute('x')) + Number(bar.getAttribute('width'))).toBeCloseTo(100);
    expect(bars(img, 'forecast')).toHaveLength(0);
    expect(img).toHaveTextContent('-240');
  });

  it('MC-26 the scale covers all values; MinimumValue / MaximumValue win', () => {
    render(wrap(<MicroChart kind="bullet" label="S" value={50} target={100} min={0} max={200} />));
    const value = bars(screen.getByRole('img'), 'value')[0]!;
    expect(Number(value.getAttribute('width'))).toBeCloseTo(25);
  });
});

describe('docs/15 radial and Harvey Ball', () => {
  it('MC-51 radial without target: the value is the percentage', () => {
    render(wrap(<MicroChart kind="radial" label="Done" value={42} />));
    expect(screen.getByRole('img', { name: 'Done: 42%' })).toHaveClass('sk-chart--neutral');
  });

  it('MC-53 small radial: the percentage moves to the right of the ring', () => {
    fakeResize(120, 24);
    const { container } = render(wrap(<MicroChart kind="radial" label="Done" value={42} />));
    expect(container.querySelector('.sk-microchart__center')).toBeNull();
    expect(container.querySelector('.sk-microchart__side')).toHaveTextContent('42%');
  });

  it('MC-55 Harvey Ball total is the maximum; MC-56 palette colour without criticality; MC-57 small: slice label only', () => {
    fakeResize(120, 24);
    render(wrap(<MicroChart kind="harvey" label="Received" value={3} max={8} color={3} />));
    const img = screen.getByRole('img', { name: 'Received: 3 of 8' });
    expect(img).toHaveClass('sk-chart--palette-3');
    expect(img).toHaveTextContent('3');
    expect(img).not.toHaveTextContent('8');
  });
});

describe('docs/15 MC-10 micro chart in a cell', () => {
  const chart: ChartModel = {
    id: 'Bullet', title: 'Budget', chartType: 'Bullet', dimensions: [], measures: ['Price'], navigation: '', typeName: 'Shop.Product',
    dataPoints: { Price: { id: 'P', title: 'Price', value: 'Price', visualization: 'Number', targetValue: { value: 20 },
      criticalityCalculation: { improvementDirection: 'Minimize', deviationRangeHighValue: { value: 15 } } } },
  };
  const field: FieldModel = { id: 'c', kind: 'chart', label: 'Budget use', chart, criticalityIcon: false, isSemanticKey: false };

  it('renders the chart from the model; CriticalityCalculation colours it (MC-09)', () => {
    render(wrap(<SmartField service="shop" typeName="Shop.Product" field={field} row={{ Price: '18.50' }} cell />));
    expect(screen.getByRole('img', { name: /^Budget use: Actual 18\.5/ })).toHaveClass('sk-chart--negative');
  });

  it('MC-06 an empty cell without data; MC-60 MC-64 other chart types (Waterfall) draw nothing', () => {
    const { container } = render(wrap(
      <>
        <span data-a><SmartField service="shop" typeName="Shop.Product" field={field} row={{}} cell /></span>
        <span data-b><SmartField service="shop" typeName="Shop.Product" field={{ ...field, chart: { ...chart, chartType: 'Waterfall' } }} row={{ Price: 1 }} cell /></span>
      </>,
    ));
    expect(container.querySelector('[data-a] [data-sk-microchart]')).toBeNull();
    expect(container.querySelector('[data-b]')).toBeEmptyDOMElement();
  });
});

describe('docs/15 series charts', () => {
  const pts = (vals: number[], extra: Partial<{ criticality: 0 | 1 | 2 | 3 | 5; target: number }>[] = []) => vals.map((value, i) => ({ label: `P${i + 1}`, value, ...(extra[i] ?? {}) }));

  it('MC-35 MC-36 line: up to three lines in palette colours; start label = smallest first value, end label = largest last value', () => {
    render(wrap(<MicroChart kind="line" label="Q" lines={[pts([5, 7, 9]), pts([3, 4, 12]), pts([6, 6, 6]), pts([1, 1, 1])]} />));
    const img = screen.getByRole('img', { name: /^Q: Line 1 P1 5/ });
    expect(img.querySelectorAll('polyline')).toHaveLength(3);
    expect(img.querySelector('[data-sk-microchart-line="1"]')).toHaveClass('sk-chart--palette-2');
    expect(img.querySelector('.sk-microchart__edges--top')).toHaveTextContent('312');
    expect(img.querySelector('.sk-microchart__edges--bottom')).toHaveTextContent('P1P3');
  });

  it('MC-37 MC-39 line: points on request; threshold line; one point is drawn as a dot', () => {
    render(wrap(<>
      <MicroChart kind="line" label="A" points={pts([1, 2, 3])} showPoints threshold={2} />
      <MicroChart kind="line" label="B" points={pts([4])} />
    </>));
    const a = screen.getByRole('img', { name: /^A:/ });
    expect(bars(a)).toHaveLength(4); // three points and the threshold line
    expect(bars(a, 'threshold')).toHaveLength(1);
    expect(bars(screen.getByRole('img', { name: /^B:/ }))).toHaveLength(1);
  });

  it('MC-41 MC-42 comparison: labels above the bars up to 192 px, none up to 96 px; value labels carry the semantic colour', () => {
    fakeResize(150, 60);
    const { container, unmount } = render(wrap(<MicroChart kind="comparison" label="C" points={pts([10, -5], [{ criticality: 3 }, { criticality: 1 }])} />));
    expect(container.querySelector('.sk-microchart__rows--normal')).not.toBeNull();
    expect(container.querySelectorAll('.sk-microchart__row-fit')[1]).toHaveClass('sk-chart--negative');
    expect(screen.getByRole('img', { name: 'C: P1 10 (Good), P2 -5 (Bad)' })).toBeInTheDocument();
    unmount();
    fakeResize(90, 40);
    const r = render(wrap(<MicroChart kind="comparison" label="C" points={pts([10, 5])} />));
    expect(r.container.querySelector('.sk-microchart__rows--bare')).not.toBeNull();
    expect(r.container.querySelector('.sk-microchart__row-label')).toBeNull();
  });

  it('MC-46 MC-47 MC-48 MC-74 area: actual and dotted target lines, threshold areas by direction, coloured start and end values', () => {
    const points = pts([10, 50, 90], [{ criticality: 1, target: 60 }, { target: 60 }, { criticality: 3, target: 60 }]);
    render(wrap(<>
      <MicroChart kind="area" label="Max" points={points} areaThresholds={{ direction: 'Maximize', deviationLow: [20, 20, 20], toleranceLow: [40, 40, 40] }} />
      <MicroChart kind="area" label="Target" points={points} areaThresholds={{ direction: 'Target', deviationLow: [20, 20, 20], toleranceLow: [30, 30, 30], toleranceHigh: [70, 70, 70], deviationHigh: [80, 80, 80] }} />
      <MicroChart kind="area" label="Plain" points={pts([1, 2])} />
    </>));
    const max = screen.getByRole('img', { name: /^Max: P1 10, P2 50, P3 90, Target 60, 60, 60$/ });
    expect([...max.querySelectorAll('polygon')].map((p) => p.getAttribute('data-sk-microchart-bar'))).toEqual(['band-negative', 'band-critical', 'band-positive']);
    expect(bars(max, 'target')).toHaveLength(1);
    const top = max.querySelector('.sk-microchart__edges--top')!.children;
    expect(top[0]).toHaveClass('sk-chart--negative');
    expect(top[1]).toHaveClass('sk-chart--positive');
    expect(screen.getByRole('img', { name: /^Target:/ }).querySelectorAll('polygon')).toHaveLength(5);
    expect(screen.getByRole('img', { name: /^Plain:/ }).querySelectorAll('polygon')).toHaveLength(0);
  });

  it('MC-49 area wide view: labels before and after the chart; hidden below 36 px', () => {
    fakeResize(200, 40);
    const { container } = render(wrap(<MicroChart kind="area" label="W" view="wide" points={pts([1, 2])} />));
    expect(container.querySelectorAll('.sk-microchart__wide > .sk-microchart__texts')).toHaveLength(2);
  });

  it('MC-58 MC-59 stacked bar: percentages of the sum (one decimal), of the maximum when given, custom text, no negatives', () => {
    render(wrap(<>
      <MicroChart kind="stackedBar" label="S" points={[{ label: 'A', value: 1 }, { label: 'B', value: 2 }, { label: 'X', value: -4 }]} />
      <MicroChart kind="stackedBar" label="M" max={10} points={[{ label: 'A', value: 2, display: 'two' }, { label: 'B', value: 3, criticality: 3 }]} />
      <MicroChart kind="stackedBar" label="N" points={[{ label: 'A', value: -1 }]} />
    </>));
    const s = screen.getByRole('img', { name: 'S: A 1 (33.3%), B 2 (66.7%)' });
    expect(s).toHaveTextContent('33.3%66.7%');
    expect(bars(s)[0]).toHaveClass('sk-chart--palette-1');
    const m = screen.getByRole('img', { name: /^M:/ });
    expect((bars(m)[0] as HTMLElement).style.width).toBe('20%');
    expect(m).toHaveTextContent('two30%');
    expect(bars(m)[1]).toHaveClass('sk-chart--positive');
    expect(screen.getByRole('img', { name: 'N: No data' })).toBeInTheDocument();
  });

  it('MC-62 MC-63 delta: names left, values right, the delta in the middle; below 56 px only the delta value', () => {
    render(wrap(<MicroChart kind="delta" label="D" value={105} target={98} titles={['May', 'April']} criticality={3} />));
    const d = screen.getByRole('img', { name: 'D: May 105 compared with April 98, difference +7 (Good)' });
    expect(d).toHaveTextContent('May105+7April98');
    expect(bars(d, 'delta')[0]).toHaveClass('sk-chart--positive');
    fakeResize(120, 30);
    render(wrap(<MicroChart kind="delta" label="E" value={105} target={98} titles={['May', 'April']} />));
    expect(screen.getByRole('img', { name: /^E:/ })).toHaveTextContent(/^\+7$/);
  });

  it('MC-30 MC-33 column: neutral by default, semantic colours per column', () => {
    render(wrap(<MicroChart kind="column" label="K" points={pts([3, 4], [{}, { criticality: 2 }])} />));
    const k = screen.getByRole('img', { name: /^K:/ });
    expect(k).toHaveClass('sk-chart--neutral');
    expect(bars(k)[1]).toHaveClass('sk-chart--critical');
  });
});

describe('docs/15 §3 series charts from the model (ADR-025)', () => {
  const xml = `<?xml version="1.0"?>
<edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx">
  <edmx:Reference Uri="u"><edmx:Include Namespace="com.sap.vocabularies.UI.v1" Alias="UI"/></edmx:Reference>
  <edmx:Reference Uri="c"><edmx:Include Namespace="com.sap.vocabularies.Common.v1" Alias="Common"/></edmx:Reference>
  <edmx:DataServices><Schema xmlns="http://docs.oasis-open.org/odata/ns/edm" Namespace="T">
<EntityType Name="Order"><Key><PropertyRef Name="ID"/></Key><Property Name="ID" Type="Edm.String" Nullable="false"/><NavigationProperty Name="Items" Type="Collection(T.Item)"/></EntityType>
<EntityType Name="Item"><Key><PropertyRef Name="Pos"/></Key><Property Name="Pos" Type="Edm.Int32" Nullable="false"/><Property Name="Day" Type="Edm.Date"/><Property Name="Kind" Type="Edm.String"/><Property Name="KindName" Type="Edm.String"/><Property Name="Qty" Type="Edm.Decimal"/><Property Name="Plan" Type="Edm.Decimal"/></EntityType>
<EntityContainer Name="C"><EntitySet Name="Orders" EntityType="T.Order"><NavigationPropertyBinding Path="Items" Target="Items"/></EntitySet><EntitySet Name="Items" EntityType="T.Item"/></EntityContainer>
<Annotations Target="T.Item/Kind"><Annotation Term="Common.Text" Path="KindName"/></Annotations>
<Annotations Target="T.Item/Pos"><Annotation Term="UI.Hidden" Bool="true"/></Annotations>
<Annotations Target="T.Item">
  <Annotation Term="UI.DataPoint" Qualifier="Qty"><Record><PropertyValue Property="Value" Path="Qty"/><PropertyValue Property="TargetValue" Path="Plan"/>
    <PropertyValue Property="CriticalityCalculation"><Record><PropertyValue Property="ImprovementDirection" EnumMember="UI.ImprovementDirectionType/Maximize"/><PropertyValue Property="DeviationRangeLowValue" Decimal="5"/><PropertyValue Property="ToleranceRangeLowValue" Decimal="10"/></Record></PropertyValue></Record></Annotation>
  <Annotation Term="UI.Chart" Qualifier="Line"><Record><PropertyValue Property="ChartType" EnumMember="UI.ChartType/Line"/><PropertyValue Property="Dimensions"><Collection><PropertyPath>Day</PropertyPath></Collection></PropertyValue><PropertyValue Property="Measures"><Collection><PropertyPath>Qty</PropertyPath><PropertyPath>Plan</PropertyPath></Collection></PropertyValue></Record></Annotation>
  <Annotation Term="UI.Chart" Qualifier="Area"><Record><PropertyValue Property="ChartType" EnumMember="UI.ChartType/Area"/><PropertyValue Property="Dimensions"><Collection><PropertyPath>Day</PropertyPath></Collection></PropertyValue><PropertyValue Property="Measures"><Collection><PropertyPath>Qty</PropertyPath></Collection></PropertyValue>
    <PropertyValue Property="MeasureAttributes"><Collection><Record Type="UI.ChartMeasureAttributeType"><PropertyValue Property="Measure" PropertyPath="Qty"/><PropertyValue Property="DataPoint" AnnotationPath="@UI.DataPoint#Qty"/></Record></Collection></PropertyValue></Record></Annotation>
  <Annotation Term="UI.Chart" Qualifier="HiddenMeasure"><Record><PropertyValue Property="ChartType" EnumMember="UI.ChartType/Bullet"/><PropertyValue Property="Measures"><Collection><PropertyPath>Pos</PropertyPath></Collection></PropertyValue></Record></Annotation>
  <Annotation Term="UI.Chart" Qualifier="Radial"><Record><PropertyValue Property="ChartType" EnumMember="UI.ChartType/Donut"/><PropertyValue Property="Measures"><Collection><PropertyPath>Qty</PropertyPath></Collection></PropertyValue>
    <PropertyValue Property="MeasureAttributes"><Collection><Record Type="UI.ChartMeasureAttributeType"><PropertyValue Property="Measure" PropertyPath="Qty"/><PropertyValue Property="DataPoint" AnnotationPath="@UI.DataPoint#Qty"/></Record></Collection></PropertyValue></Record></Annotation>
  <Annotation Term="UI.Chart" Qualifier="Bars"><Record><PropertyValue Property="ChartType" EnumMember="UI.ChartType/Bar"/><PropertyValue Property="Dimensions"><Collection><PropertyPath>Kind</PropertyPath></Collection></PropertyValue><PropertyValue Property="Measures"><Collection><PropertyPath>Qty</PropertyPath></Collection></PropertyValue>
    <PropertyValue Property="MeasureAttributes"><Collection><Record Type="UI.ChartMeasureAttributeType"><PropertyValue Property="Measure" PropertyPath="Qty"/><PropertyValue Property="DataPoint" AnnotationPath="@UI.DataPoint#Scale"/></Record></Collection></PropertyValue></Record></Annotation>
  <Annotation Term="UI.DataPoint" Qualifier="Scale"><Record><PropertyValue Property="Value" Path="Qty"/><PropertyValue Property="MinimumValue" Decimal="0"/><PropertyValue Property="MaximumValue" Decimal="40"/></Record></Annotation>
  <Annotation Term="UI.Chart" Qualifier="Share"><Record><PropertyValue Property="ChartType" EnumMember="UI.ChartType/BarStacked"/><PropertyValue Property="Dimensions"><Collection><PropertyPath>Kind</PropertyPath></Collection></PropertyValue><PropertyValue Property="Measures"><Collection><PropertyPath>Qty</PropertyPath></Collection></PropertyValue></Record></Annotation>
</Annotations>
<Annotations Target="T.Order"><Annotation Term="UI.LineItem"><Collection>
  <Record Type="UI.DataFieldForAnnotation"><PropertyValue Property="Label" String="Trend"/><PropertyValue Property="Target" AnnotationPath="Items/@UI.Chart#Line"/></Record>
  <Record Type="UI.DataFieldForAnnotation"><PropertyValue Property="Label" String="Area"/><PropertyValue Property="Target" AnnotationPath="Items/@UI.Chart#Area"/></Record>
  <Record Type="UI.DataFieldForAnnotation"><PropertyValue Property="Label" String="Share"/><PropertyValue Property="Target" AnnotationPath="Items/@UI.Chart#Share"/></Record>
</Collection></Annotation></Annotations>
  </Schema></edmx:DataServices>
</edmx:Edmx>`;
  const model = buildModel(xml);
  const cols = model.ui['T.Order']!.lineItem;
  const row = { ID: 'A', Items: [
    { Pos: 1, Day: '2026-01-01', Kind: 'X', KindName: 'Freight', Qty: '4', Plan: '8' },
    { Pos: 2, Day: '2026-02-01', Kind: 'Y', KindName: 'Price', Qty: '12', Plan: '8' },
  ] };
  const ctx = { model, locale: 'en-US' };

  it('line: one line per measure; dates as labels', () => {
    const props = chartProps(ctx, 'T.Order', cols[0]!.chart!, row)!;
    expect(props.kind).toBe('line');
    expect(props.lines!.map((l) => l.map((p) => p.value))).toEqual([[4, 12], [8, 8]]);
    expect(props.lines![0]![0]!.label).toMatch(/Jan 1, 2026/);
  });

  it('area: per-point targets, criticality and thresholds from CriticalityCalculation', () => {
    const props = chartProps(ctx, 'T.Order', cols[1]!.chart!, row)!;
    expect(props.points!.map((p) => [p.value, p.target, p.criticality])).toEqual([[4, 8, 1], [12, 8, 3]]);
    expect(props.areaThresholds).toEqual({ direction: 'Maximize', deviationLow: [5, 5], toleranceLow: [10, 10], toleranceHigh: undefined, deviationHigh: undefined });
  });

  it('stacked bar: the dimension text names the segments; the cell renders from the expanded rows', () => {
    const props = chartProps(ctx, 'T.Order', cols[2]!.chart!, row)!;
    expect(props.points!.map((p) => p.label)).toEqual(['Freight', 'Price']);
    render(wrap(<span data-c><SmartField service="shop" typeName="T.Order" field={cols[2]!} row={row} cell /></span>, { model }));
    expect(screen.getByRole('img', { name: 'Share: Freight 4 (25%), Price 12 (75%)' })).toBeInTheDocument();
  });
});

describe('docs/15 optional chart features', () => {
  const pts = (vals: number[]) => vals.map((value, i) => ({ label: `P${i + 1}`, value }));

  it('MC-31 MC-32 column labels per column from 72 px when the columns are wide enough; otherwise first and last', () => {
    fakeResize(300, 90);
    const { container, unmount } = render(wrap(<MicroChart kind="column" label="C" columnLabels points={pts([3, 4, 5])} />));
    expect(container.querySelector('.sk-microchart__column-labels')).toHaveTextContent('345');
    expect(container.querySelector('.sk-microchart__edges--top')).toBeNull();
    unmount();
    fakeResize(300, 60);
    const r = render(wrap(<MicroChart kind="column" label="C" columnLabels points={pts([3, 4, 5])} />));
    expect(r.container.querySelector('.sk-microchart__column-labels')).toBeNull();
    expect(r.container.querySelector('.sk-microchart__edges--top')).toHaveTextContent('35');
  });

  it('MC-38 focus points; MC-39 threshold label; MC-40 fixed scale', () => {
    render(wrap(<>
      <MicroChart kind="line" label="F" points={pts([1, 5, 3])} focusPoints={[0, 2]} threshold={2} thresholdLabel />
      <MicroChart kind="line" label="S" points={pts([1, 2])} scaleMin={0} scaleMax={10} />
    </>));
    const f = screen.getByRole('img', { name: /^F:/ });
    expect(f.querySelectorAll('.sk-microchart__dot--focus')).toHaveLength(2);
    expect(f.querySelector('.sk-microchart__threshold-label')).toHaveTextContent('2');
    // with the scale 0–10 the values 1 and 2 stay in the lower part of the chart
    const ys = screen.getByRole('img', { name: /^S:/ }).querySelector('polyline')!.getAttribute('points')!.split(' ').map((xy) => Number(xy.split(',')[1]));
    expect(Math.min(...ys)).toBeGreaterThan(70);
  });

  it('MC-48 area minimum and maximum labels: three labels per row', () => {
    const { container } = render(wrap(<MicroChart kind="area" label="A" minMaxLabels points={pts([4, 9, 1, 6])} />));
    expect(container.querySelector('.sk-microchart__edges--top')).toHaveTextContent('496');
    expect(container.querySelector('.sk-microchart__edges--bottom')).toHaveTextContent('P11P4');
  });
});

describe('docs/15 rules from the model', () => {
  const model = buildModel(readFileSync(join(import.meta.dirname, 'microcharts.test.tsx'), 'utf8').split('const xml = `')[1]!.split('`;')[0]!);
  const ui = model.ui['T.Item']!;
  const item = { Pos: 1, Kind: 'X', KindName: 'Freight', Qty: '12', Plan: '8' };
  const ctx = { model, locale: 'en-US' };

  it('MC-12 a chart whose measure is hidden (UI.Hidden) is not drawn', () => {
    expect(chartHidden(model, ui.charts.HiddenMeasure!)).toBe(true);
    expect(chartHidden(model, ui.charts.Radial!)).toBe(false);
  });

  it('MC-52 radial: the colour comes from CriticalityCalculation; TargetValue is the total', () => {
    const props = chartProps(ctx, 'T.Item', ui.charts.Radial!, item)!;
    expect(props).toMatchObject({ kind: 'radial', value: 12, target: 8, criticality: 3 });
  });

  it('MC-43 comparison: names from the dimension text; MinimumValue / MaximumValue set the scale', () => {
    const props = seriesChartProps(ctx, ui.charts.Bars!, [item, { ...item, Kind: 'Y', KindName: 'Price', Qty: '20' }])!;
    expect(props).toMatchObject({ kind: 'comparison', min: 0, max: 40 });
    expect(props.points!.map((p) => p.label)).toEqual(['Freight', 'Price']);
    render(wrap(<MicroChart {...props} label="B" />));
    const bar = screen.getByRole('img', { name: /^B:/ }).querySelector('[data-sk-microchart-bar="1"]')!;
    expect(Number(bar.getAttribute('width'))).toBeCloseTo(50);
  });
});

describe('docs/15 §7 SAP anatomy (compared with the SAPUI5 1.154 samples)', () => {
  it('MC-70 bullet: actual value above the bar at its end, target below at the marker; forecast as high as the track; thresholds across the bar', () => {
    render(wrap(<MicroChart kind="bullet" label="B" value={50} target={100} forecast={80} min={0} max={100} thresholds={[{ value: 30, criticality: 1 }]} />));
    const img = screen.getByRole('img', { name: /^B:/ });
    const lanes = img.querySelectorAll('.sk-microchart__lane');
    expect(lanes).toHaveLength(2);
    expect((lanes[0]!.firstElementChild as HTMLElement).style.left).toBe('50%');
    expect((lanes[1]!.firstElementChild as HTMLElement).style.left).toBe('100%');
    expect(lanes[0]!.compareDocumentPosition(img.querySelector('svg')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(bars(img, 'forecast')[0]!.getAttribute('height')).toBe(img.querySelector('.sk-microchart__track')!.getAttribute('height'));
    expect(Number(bars(img, 'threshold')[0]!.getAttribute('height'))).toBeGreaterThan(12);
  });

  it('MC-72 Harvey Ball: the slice is inset; the value carries the semantic colour, the total the text colour', () => {
    render(wrap(<MicroChart kind="harvey" label="H" value={1} max={4} criticality={3} />));
    const img = screen.getByRole('img', { name: /^H:/ });
    expect(img.querySelector('.sk-microchart__value--mark')).toHaveTextContent('1');
    expect(img.querySelector('path')!.getAttribute('d')).toMatch(/^M20 20 L20 3\.5/);
  });

  it('MC-73 comparison: a track behind every bar', () => {
    render(wrap(<MicroChart kind="comparison" label="C" points={[{ label: 'A', value: 1 }, { label: 'B', value: 2 }]} />));
    expect(screen.getByRole('img', { name: /^C:/ }).querySelectorAll('.sk-microchart__row-plot .sk-microchart__track')).toHaveLength(2);
  });

  it('MC-75 delta: value 1, the delta, value 2 from top to bottom with connectors; neutral value bars', () => {
    render(wrap(<MicroChart kind="delta" label="D" value={10} target={6} />));
    const img = screen.getByRole('img', { name: /^D:/ });
    const y = (k: string) => Number(bars(img, k)[0]!.getAttribute('y'));
    expect(y('value1')).toBeLessThan(y('delta'));
    expect(y('delta')).toBeLessThan(y('value2'));
    expect(img.querySelectorAll('.sk-microchart__connector')).toHaveLength(2);
    expect(bars(img, 'value1')[0]).toHaveClass('sk-microchart__mark--plain');
  });

  it('MC-76 the text alternative names the semantic state, so colour is not the only carrier', () => {
    render(wrap(<>
      <MicroChart kind="radial" label="R" value={40} criticality={2} />
      <MicroChart kind="bullet" label="B" value={1} criticality={1} />
    </>, { locale: 'zh' }));
    expect(screen.getByRole('img', { name: 'R：40% (警告)' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'B：实际 1 (差)' })).toBeInTheDocument();
  });
});

