/**
 * The sap.suite.ui.microchart controls (stage 6, docs/15-research-micro-chart.md) and the annotation mapping of
 * sap.fe.macros.MicroChart (MicroChartHelper of FE 1.154).
 */
import { buildModel, type ChartModel, type FieldModel } from '@rhfan2019/smart-kit-core';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AreaMicroChart from '@rhfan2019/smart-kit/suite/ui/microchart/AreaMicroChart';
import AreaMicroChartItem from '@rhfan2019/smart-kit/suite/ui/microchart/AreaMicroChartItem';
import AreaMicroChartLabel from '@rhfan2019/smart-kit/suite/ui/microchart/AreaMicroChartLabel';
import AreaMicroChartPoint from '@rhfan2019/smart-kit/suite/ui/microchart/AreaMicroChartPoint';
import BulletMicroChart from '@rhfan2019/smart-kit/suite/ui/microchart/BulletMicroChart';
import BulletMicroChartData from '@rhfan2019/smart-kit/suite/ui/microchart/BulletMicroChartData';
import ColumnMicroChart from '@rhfan2019/smart-kit/suite/ui/microchart/ColumnMicroChart';
import ColumnMicroChartData from '@rhfan2019/smart-kit/suite/ui/microchart/ColumnMicroChartData';
import ComparisonMicroChart from '@rhfan2019/smart-kit/suite/ui/microchart/ComparisonMicroChart';
import ComparisonMicroChartData from '@rhfan2019/smart-kit/suite/ui/microchart/ComparisonMicroChartData';
import DeltaMicroChart from '@rhfan2019/smart-kit/suite/ui/microchart/DeltaMicroChart';
import HarveyBallMicroChart from '@rhfan2019/smart-kit/suite/ui/microchart/HarveyBallMicroChart';
import HarveyBallMicroChartItem from '@rhfan2019/smart-kit/suite/ui/microchart/HarveyBallMicroChartItem';
import LineMicroChart from '@rhfan2019/smart-kit/suite/ui/microchart/LineMicroChart';
import LineMicroChartEmphasizedPoint from '@rhfan2019/smart-kit/suite/ui/microchart/LineMicroChartEmphasizedPoint';
import LineMicroChartLine from '@rhfan2019/smart-kit/suite/ui/microchart/LineMicroChartLine';
import LineMicroChartPoint from '@rhfan2019/smart-kit/suite/ui/microchart/LineMicroChartPoint';
import RadialMicroChart from '@rhfan2019/smart-kit/suite/ui/microchart/RadialMicroChart';
import StackedBarMicroChart from '@rhfan2019/smart-kit/suite/ui/microchart/StackedBarMicroChart';
import StackedBarMicroChartBar from '@rhfan2019/smart-kit/suite/ui/microchart/StackedBarMicroChartBar';
import { AreaMicroChartViewType, BulletMicroChartModeType, CommonBackgroundType, ComparisonMicroChartViewType, DeltaMicroChartViewType, HorizontalAlignmentType, LineType, MicroChartColorType } from '@rhfan2019/smart-kit/suite/ui/microchart/library';
import Field from '../src/v4/fe/macros/Field';
import { chartHidden, chartProps, seriesChartProps } from '../src/chart/fromModel';
import { MicroChartDrawing } from '../src/chart/MicroChart';
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

describe('sap.suite.ui.microchart library', () => {
  it('AL-05 the enums of sap/suite/ui/microchart/library', () => {
    expect(Object.keys(MicroChartColorType)).toHaveLength(17);
    expect(BulletMicroChartModeType.Delta).toBe('Delta');
    expect(Object.keys(CommonBackgroundType)).toHaveLength(9);
    expect(Object.values(AreaMicroChartViewType)).toEqual(['Normal', 'Wide']);
    expect(Object.values(ComparisonMicroChartViewType)).toEqual(['Normal', 'Wide', 'Responsive']);
    expect(Object.values(DeltaMicroChartViewType)).toEqual(['Normal', 'Wide', 'Responsive']);
    expect(Object.values(HorizontalAlignmentType)).toEqual(['Left', 'Center', 'Right']);
    expect(Object.values(LineType)).toEqual(['Solid', 'Dashed', 'Dotted']);
  });
});

describe('shared rules (docs/15)', () => {
  it('AL-05 size defaults to Auto (M, S on phones); Responsive fills the container; width / height override', () => {
    const { container } = render(wrap(<>
      <RadialMicroChart percentage={10} />
      <RadialMicroChart percentage={10} size="Responsive" />
      <RadialMicroChart percentage={10} size="XS" width="5rem" height="2rem" />
    </>));
    const [auto, responsive, xs] = [...container.querySelectorAll<HTMLElement>('.sk-microchart')];
    expect(auto).toHaveClass('sk-microchart--size-Auto');
    expect(responsive!.className).not.toMatch(/size-/);
    expect(xs).toHaveClass('sk-microchart--size-XS');
    expect(xs!.style.width).toBe('5rem');
    expect(xs!.style.height).toBe('2rem');
  });

  it('MC-02 / MC-27 the measured height decides the labels: below 56 px a bullet has none', () => {
    fakeResize(200, 30);
    const { container } = render(wrap(<BulletMicroChart size="Responsive" aria-label="Budget" targetValue={20}><BulletMicroChartData value={10} /></BulletMicroChart>));
    expect(container.querySelector('.sk-microchart')).toHaveClass('sk-microchart--compact');
    expect(container.querySelector('.sk-microchart__lane')).toBeNull();
    // the text alternative still has everything
    expect(screen.getByRole('img', { name: 'Budget: Actual 10, Target 20' })).toBeInTheDocument();
  });

  it('MC-04 a number that does not fit hides its whole label group instead of being cut', () => {
    const spy = vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(function (this: HTMLElement) { return this.textContent === '1234567' ? 80 : 0; });
    const { container } = render(wrap(<BulletMicroChart targetValue={20} actual={{ value: 1234567 }} />));
    expect(container.querySelector('.sk-microchart__lane')).toHaveAttribute('data-sk-overflow');
    spy.mockRestore();
  });

  it('AL-05 hideOnNoData defaults to false: a focusable "No data" placeholder that cannot be pressed (MC-05); true renders nothing (MC-06)', () => {
    const onPress = vi.fn();
    const { container } = render(wrap(
      <>
        <BulletMicroChart aria-label="A" onPress={onPress} />
        <span data-cell><HarveyBallMicroChart hideOnNoData><HarveyBallMicroChartItem fraction={1} /></HarveyBallMicroChart></span>
      </>,
    ));
    const placeholder = screen.getByRole('img', { name: 'A: No data' });
    expect(placeholder).toHaveAttribute('tabindex', '0');
    expect(screen.queryByRole('button')).toBeNull();
    expect(container.querySelector('[data-cell]')).toBeEmptyDOMElement();
  });

  it('AL-06 press: a button with the text alternative; Enter, Space and click fire it (MC-07, MC-11)', async () => {
    const onPress = vi.fn();
    render(wrap(<RadialMicroChart aria-label="Received" fraction={1} total={4} onPress={onPress} />));
    const button = screen.getByRole('button', { name: 'Received: 25%' });
    expect(button).toHaveClass('sk-microchart--pressable');
    const user = userEvent.setup();
    await user.tab();
    expect(button).toHaveFocus();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    await user.click(button);
    expect(onPress).toHaveBeenCalledTimes(3);
  });

  it('colours: MicroChartColorType semantic and Sequence values, palette parameters and CSS colours', () => {
    const { container } = render(wrap(<>
      <RadialMicroChart percentage={1} valueColor="Error" />
      <RadialMicroChart percentage={1} valueColor="Sequence3" />
      <RadialMicroChart percentage={1} valueColor="sapUiChartPaletteQualitativeHue5" />
      <RadialMicroChart percentage={1} valueColor="rebeccapurple" />
    </>));
    const roots = [...container.querySelectorAll<HTMLElement>('.sk-microchart')];
    expect(roots[0]).toHaveClass('sk-chart--negative');
    expect(roots[1]).toHaveClass('sk-chart--palette-3');
    expect(roots[2]).toHaveClass('sk-chart--palette-5');
    expect(roots[3]!.style.getPropertyValue('--sk-chart-mark')).toBe('rebeccapurple');
  });

  it('MC-08 every theme defines the eleven palette colours; components only reference tokens', () => {
    const css = readFileSync(join(import.meta.dirname, '../src/theme/tokens.css'), 'utf8');
    for (const theme of [":root,\n[data-sk-theme='yellow']", "[data-sk-theme='navy']", "[data-sk-theme='sky']", "[data-sk-theme='dark']"]) {
      const block = css.slice(css.indexOf(theme), css.indexOf('}', css.indexOf(theme)));
      for (let i = 1; i <= 11; i++) expect(block).toContain(`--sk-color-chart-${i}: var(--sk-`);
    }
    for (let i = 1; i <= 11; i++) expect(css).toContain(`--sk-chart-palette-${i}: var(--sk-color-chart-${i});`);
  });

  it('MC-76 the text alternative names the semantic state, so colour is not the only carrier', () => {
    render(wrap(<>
      <RadialMicroChart aria-label="R" percentage={40} valueColor="Critical" />
      <BulletMicroChart aria-label="B" actual={{ value: 1, color: 'Error' }} />
    </>, { locale: 'zh' }));
    expect(screen.getByRole('img', { name: 'R：40% (警告)' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'B：实际 1 (差)' })).toBeInTheDocument();
  });
});

describe('BulletMicroChart', () => {
  it('AL-05 BulletMicroChart: mode Actual, the value and target as labels, MC-22 the actual colour Neutral; MC-23 forecast; MC-25 thresholds', () => {
    render(wrap(
      <BulletMicroChart aria-label="Sales" targetValue={80} forecastValue={90} thresholds={[{ value: 40, color: 'Error' }, <BulletMicroChartData key="c" value={70} color="Critical" />]}>
        <BulletMicroChartData value={60} />
      </BulletMicroChart>,
    ));
    const img = screen.getByRole('img', { name: 'Sales: Actual 60, Target 80, Forecast 90, Thresholds 40, 70' });
    expect(img).toHaveClass('sk-chart--neutral', 'sk-microchart--bullet');
    expect(img).toHaveTextContent('6080');
    expect(bars(img, 'forecast')).toHaveLength(1);
    const th = bars(img, 'threshold');
    expect(th).toHaveLength(2);
    expect(th[0]).toHaveClass('sk-chart--negative');
    expect(th[1]).toHaveClass('sk-chart--critical');
  });

  it('MC-24 Delta mode: the bar between actual and target, the label "Δ" and the absolute delta; no forecast', () => {
    render(wrap(<BulletMicroChart aria-label="Invoiced" mode="Delta" targetValue={1000} forecastValue={900} actual={{ value: 760 }} />));
    const img = screen.getByRole('img', { name: 'Invoiced: Difference -240, Target 1,000' });
    const bar = bars(img, 'delta')[0]!;
    expect(Number(bar.getAttribute('x')) + Number(bar.getAttribute('width'))).toBeCloseTo(100);
    expect(bars(img, 'forecast')).toHaveLength(0);
    expect(img).toHaveTextContent('Δ240');
  });

  it('MC-26 the scale covers all values and minValue / maxValue; smallRangeAllowed keeps a small range', () => {
    const { container } = render(wrap(<>
      <BulletMicroChart minValue={0} maxValue={200} targetValue={100} actual={{ value: 50 }} />
      <BulletMicroChart targetValue={205} actual={{ value: 200 }} thresholds={[{ value: 195 }]} />
      <BulletMicroChart targetValue={205} actual={{ value: 200 }} thresholds={[{ value: 195 }]} smallRangeAllowed />
    </>));
    const w = (i: number) => Number(bars(container.querySelectorAll('.sk-microchart')[i]!, 'value')[0]!.getAttribute('width'));
    expect(w(0)).toBeCloseTo(25);
    expect(w(1)).toBeCloseTo((200 / 205) * 100);
    expect(w(2)).toBeCloseTo(50);
  });

  it('AL-05 labels replace the numbers and get the scale suffix; showActualValue / showTargetValue / showThresholds / showValueMarker / scaleColor', () => {
    const { container, rerender } = render(wrap(<BulletMicroChart scale="M" actualValueLabel="1.2" targetValue={2} actual={{ value: 1.2 }} />));
    expect(container.querySelector('.sk-microchart')).toHaveTextContent('1.2M2M');
    rerender(wrap(<BulletMicroChart showActualValue={false} showTargetValue={false} showThresholds={false} showValueMarker scaleColor="Transparent" targetValue={2} actual={{ value: 1 }} thresholds={[{ value: 1.5 }]} />));
    const img = container.querySelector('.sk-microchart')!;
    expect(img.querySelector('.sk-microchart__lane')).toBeNull();
    expect(bars(img, 'threshold')).toHaveLength(0);
    expect(bars(img, 'marker')).toHaveLength(1);
    expect(img.querySelector('.sk-microchart__track')).toHaveClass('sk-microchart__track--transparent');
  });

  it('MC-70 SAP anatomy: actual value above the bar at its end, target below at the marker; forecast as high as the track', () => {
    render(wrap(<BulletMicroChart aria-label="B" targetValue={100} forecastValue={80} minValue={0} maxValue={100} thresholds={[{ value: 30, color: 'Error' }]} actual={{ value: 50 }} />));
    const img = screen.getByRole('img', { name: /^B:/ });
    const lanes = img.querySelectorAll('.sk-microchart__lane');
    expect(lanes).toHaveLength(2);
    expect((lanes[0]!.firstElementChild as HTMLElement).style.left).toBe('50%');
    expect((lanes[1]!.firstElementChild as HTMLElement).style.left).toBe('100%');
    expect(bars(img, 'forecast')[0]!.getAttribute('height')).toBe(img.querySelector('.sk-microchart__track')!.getAttribute('height'));
    expect(Number(bars(img, 'threshold')[0]!.getAttribute('height'))).toBeGreaterThan(12);
  });
});

describe('RadialMicroChart and HarveyBallMicroChart', () => {
  it('AL-05 RadialMicroChart: percentage wins over fraction / total, rounded down to one decimal, within 0–100 %; valueColor Neutral', () => {
    render(wrap(<>
      <RadialMicroChart aria-label="P" percentage={42.37} fraction={1} total={2} />
      <RadialMicroChart aria-label="F" fraction={1} total={4} />
      <RadialMicroChart aria-label="O" fraction={5} total={4} />
      <RadialMicroChart aria-label="N" />
    </>));
    expect(screen.getByRole('img', { name: 'P: 42.3%' })).toHaveClass('sk-chart--neutral');
    expect(screen.getByRole('img', { name: 'F: 25%' }).querySelector('.sk-microchart__center')).toHaveTextContent('25%');
    expect(screen.getByRole('img', { name: 'O: 100%' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'N: No data' })).toBeInTheDocument();
  });

  it('MC-53 small radial: the percentage moves to the right of the ring; alignContent', () => {
    fakeResize(120, 24);
    const { container } = render(wrap(<RadialMicroChart percentage={42} alignContent="Right" />));
    expect(container.querySelector('.sk-microchart__center')).toBeNull();
    expect(container.querySelector('.sk-microchart__side')).toHaveTextContent('42%');
    expect(container.querySelector('.sk-microchart')).toHaveClass('sk-microchart--align-Right');
  });

  it('AL-05 HarveyBallMicroChart: the first item against total; labels, scales (3 characters) and formattedLabel; MC-57 small: fraction only', () => {
    const { container, rerender } = render(wrap(
      <HarveyBallMicroChart aria-label="Received" total={8} totalScale="Pieces">
        <HarveyBallMicroChartItem fraction={3} color="Sequence3" fractionScale="Pc" />
        <HarveyBallMicroChartItem fraction={7} />
      </HarveyBallMicroChart>,
    ));
    const img = screen.getByRole('img', { name: 'Received: 3 of 8' });
    expect(img).toHaveClass('sk-chart--palette-3');
    expect(img).toHaveTextContent('3Pc8Pie');
    rerender(wrap(<HarveyBallMicroChart total={4000} totalLabel="4K" formattedLabel colorPalette={['Good']} items={[{ fraction: 1500, fractionLabel: '1.5K', formattedLabel: true, color: 'Error' }]} />));
    expect(container.querySelector('.sk-microchart')).toHaveClass('sk-chart--positive');
    expect(container.querySelector('.sk-microchart')).toHaveTextContent('1.5K4K');
    rerender(wrap(<HarveyBallMicroChart size="XS" total={8} showTotal items={[{ fraction: 3 }]} />));
    expect(container.querySelector('.sk-microchart')).toHaveTextContent(/^3$/);
  });

  it('MC-72 Harvey Ball: the slice is inset; the fraction carries the colour', () => {
    render(wrap(<HarveyBallMicroChart aria-label="H" total={4} items={[{ fraction: 1, color: 'Good' }]} />));
    const img = screen.getByRole('img', { name: /^H:/ });
    expect(img.querySelector('.sk-microchart__value--mark')).toHaveTextContent('1');
    expect(img.querySelector('path')!.getAttribute('d')).toMatch(/^M20 20 L20 3\.5/);
  });
});

describe('DeltaMicroChart', () => {
  it('AL-05 DeltaMicroChart: view Normal (titles above and below), the absolute delta in the middle, color Neutral (MC-62); MC-63 small: delta only', () => {
    render(wrap(<DeltaMicroChart aria-label="D" value1={105} value2={98} title1="May" title2="April" color="Good" />));
    const d = screen.getByRole('img', { name: 'D: May 105 compared with April 98, difference +7 (Good)' });
    expect(d).toHaveTextContent('May105798April');
    expect(bars(d, 'delta')[0]).toHaveClass('sk-chart--positive');
    render(wrap(<DeltaMicroChart aria-label="N" value1={1} value2={2} />));
    expect(bars(screen.getByRole('img', { name: /^N:/ }), 'delta')[0]).toHaveClass('sk-chart--neutral');
    fakeResize(120, 30);
    render(wrap(<DeltaMicroChart aria-label="E" value1={105} value2={98} title1="May" title2="April" deltaDisplayValue="+7 %" />));
    expect(screen.getByRole('img', { name: /^E:/ })).toHaveTextContent(/^\+7 %$/);
  });

  it('views: Wide puts the titles in a column on the left; Responsive above 12rem; display values replace the numbers', () => {
    fakeResize(250, 72);
    const { container } = render(wrap(<>
      <DeltaMicroChart view="Wide" value1={1} value2={2} title1="A" title2="B" displayValue1="one" displayValue2="two" />
      <DeltaMicroChart view="Responsive" value1={1} value2={2} title1="A" title2="B" />
      <DeltaMicroChart value1={1} value2={2} title1="A" title2="B" />
    </>));
    const grids = container.querySelectorAll('.sk-microchart__delta-grid');
    expect(grids[0]).toHaveClass('sk-microchart__delta-grid--wide');
    expect(grids[0]).toHaveTextContent('ABone1two');
    expect(grids[1]).toHaveClass('sk-microchart__delta-grid--wide');
    expect(grids[2]).not.toHaveClass('sk-microchart__delta-grid--wide');
  });

  it('MC-75 value 1, the delta, value 2 from top to bottom with connectors; neutral value bars', () => {
    render(wrap(<DeltaMicroChart aria-label="D" value1={10} value2={6} />));
    const img = screen.getByRole('img', { name: /^D:/ });
    const y = (k: string) => Number(bars(img, k)[0]!.getAttribute('y'));
    expect(y('value1')).toBeLessThan(y('delta'));
    expect(y('delta')).toBeLessThan(y('value2'));
    expect(img.querySelectorAll('.sk-microchart__connector')).toHaveLength(2);
    expect(bars(img, 'value1')[0]).toHaveClass('sk-microchart__mark--plain');
  });
});

describe('ColumnMicroChart', () => {
  const cols = [<ColumnMicroChartData key="a" label="Jan" value={10} />, <ColumnMicroChartData key="b" label="Feb" value={-5} color="Error" />, <ColumnMicroChartData key="c" label="Mar" value={20} />];

  it('AL-05 ColumnMicroChart: columns Neutral by default, negative below the baseline; labels only when given (MC-30 … MC-33)', () => {
    const { container, rerender } = render(wrap(<ColumnMicroChart aria-label="Trend">{cols}</ColumnMicroChart>));
    const img = screen.getByRole('img', { name: 'Trend: Jan 10, Feb -5, Mar 20' });
    expect(bars(img)).toHaveLength(3);
    expect(bars(img)[0]).toHaveClass('sk-chart--neutral');
    expect(bars(img)[1]).toHaveClass('sk-chart--negative');
    const base = Number(img.querySelector('.sk-microchart__baseline')!.getAttribute('y1'));
    expect(Number(bars(img)[1]!.getAttribute('y'))).toBeCloseTo(base);
    expect(img.querySelector('.sk-microchart__edges')).toBeNull();
    rerender(wrap(<ColumnMicroChart leftTopLabel={{ label: '10', color: 'Good' }} rightTopLabel={{ label: '20' }} leftBottomLabel={{ label: 'Jan' }} rightBottomLabel={{ label: 'Mar' }} showBottomLabels={false}>{cols}</ColumnMicroChart>));
    expect(container.querySelector('.sk-microchart__edges--top')).toHaveTextContent('1020');
    expect(container.querySelector('.sk-microchart__edges--top [data-sk-num]')).toHaveClass('sk-chart--positive');
    expect(container.querySelector('.sk-microchart__edges--bottom')).toBeNull();
  });

  it('MC-31 MC-32 allowColumnLabels: a label per column (displayValue or value) from 72 px when the columns are wide enough', () => {
    fakeResize(300, 90);
    const columns = [{ value: 3 }, { value: 4, displayValue: 'four' }, { value: 5 }];
    const { container, unmount } = render(wrap(<ColumnMicroChart allowColumnLabels columns={columns} leftTopLabel={{ label: '3' }} rightTopLabel={{ label: '5' }} />));
    expect(container.querySelector('.sk-microchart__column-labels')).toHaveTextContent('3four5');
    expect(container.querySelector('.sk-microchart__edges--top')).toBeNull();
    unmount();
    fakeResize(300, 60);
    const r = render(wrap(<ColumnMicroChart allowColumnLabels columns={columns} leftTopLabel={{ label: '3' }} rightTopLabel={{ label: '5' }} />));
    expect(r.container.querySelector('.sk-microchart__column-labels')).toBeNull();
    expect(r.container.querySelector('.sk-microchart__edges--top')).toHaveTextContent('35');
  });

  it('AL-06 ColumnMicroChartData press: the column fires it, not the chart', () => {
    const onColumn = vi.fn();
    const onChart = vi.fn();
    render(wrap(<ColumnMicroChart onPress={onChart} columns={[{ value: 1, onPress: onColumn }, { value: 2 }]} />));
    fireEvent.click(bars(screen.getByRole('button'))[0]!);
    expect(onColumn).toHaveBeenCalledTimes(1);
    expect(onChart).not.toHaveBeenCalled();
  });
});

describe('LineMicroChart', () => {
  it('AL-05 LineMicroChart: threshold 0 with its line; color Neutral; showPoints false; points as children', () => {
    render(wrap(
      <LineMicroChart aria-label="A">
        <LineMicroChartPoint x={0} y={1} /><LineMicroChartPoint x={1} y={2} /><LineMicroChartPoint x={2} y={3} />
      </LineMicroChart>,
    ));
    const a = screen.getByRole('img', { name: 'A: 1, 2, 3' });
    expect(a.querySelector('[data-sk-microchart-line="0"]')).toHaveClass('sk-chart--neutral');
    expect(bars(a, 'threshold')).toHaveLength(1);
    expect(a.querySelectorAll('.sk-microchart__dot')).toHaveLength(0);
    // the threshold 0 is part of the y range: the first point (1) is not at the bottom
    const ys = a.querySelector('polyline')!.getAttribute('points')!.split(' ').map((xy) => Number(xy.split(',')[1]));
    expect(ys[0]).toBeLessThan(90);
  });

  it('MC-37 MC-39 showPoints; threshold null disables it; showThresholdValue with thresholdDisplayValue; one point is a dot', () => {
    render(wrap(<>
      <LineMicroChart aria-label="P" showPoints threshold={2} showThresholdValue thresholdDisplayValue="Plan" points={[{ x: 0, y: 1 }, { x: 1, y: 3 }]} />
      <LineMicroChart aria-label="N" threshold={null} points={[{ x: 0, y: 1 }, { x: 1, y: 3 }]} />
      <LineMicroChart aria-label="H" showThresholdLine={false} points={[{ x: 0, y: 1 }, { x: 1, y: 3 }]} />
      <LineMicroChart aria-label="O" points={[{ x: 0, y: 4 }]} />
    </>));
    const p = screen.getByRole('img', { name: /^P:/ });
    expect(p.querySelectorAll('.sk-microchart__dot')).toHaveLength(2);
    expect(p.querySelector('.sk-microchart__threshold-label')).toHaveTextContent('Plan');
    expect(bars(screen.getByRole('img', { name: /^N:/ }), 'threshold')).toHaveLength(0);
    expect(bars(screen.getByRole('img', { name: /^H:/ }), 'threshold')).toHaveLength(0);
    expect(screen.getByRole('img', { name: /^O:/ }).querySelectorAll('.sk-microchart__dot')).toHaveLength(1);
  });

  it('MC-35 lines with their colour, type and showPoints; the points aggregation wins over lines; labels as properties', () => {
    render(wrap(<>
      <LineMicroChart aria-label="L" leftTopLabel="5" rightTopLabel="12" leftBottomLabel="Jan" rightBottomLabel="Mar" showTopLabels={false}
        lines={[<LineMicroChartLine key="a" color="Good" type="Dashed" showPoints points={[{ x: 0, y: 5 }, { x: 1, y: 9 }]} />, { color: 'Sequence2', points: [{ x: 0, y: 3 }, { x: 1, y: 12 }] }]} />
      <LineMicroChart aria-label="W" points={[{ x: 0, y: 1 }, { x: 1, y: 2 }]} lines={[{ points: [{ x: 0, y: 5 }] }]} />
    </>));
    const l = screen.getByRole('img', { name: 'L: Line 1 5, 9; Line 2 3, 12' });
    expect(l.querySelector('[data-sk-microchart-line="0"]')).toHaveClass('sk-chart--positive');
    expect(l.querySelector('[data-sk-microchart-line="0"] polyline')).toHaveClass('sk-microchart__line--dashed');
    expect(l.querySelector('[data-sk-microchart-line="1"]')).toHaveClass('sk-chart--palette-2');
    expect(l.querySelectorAll('[data-sk-microchart-line="0"] .sk-microchart__dot')).toHaveLength(2);
    expect(l.querySelector('.sk-microchart__edges--top')).toBeNull();
    expect(l.querySelector('.sk-microchart__edges--bottom')).toHaveTextContent('JanMar');
    expect(screen.getByRole('img', { name: 'W: 1, 2' })).toBeInTheDocument();
  });

  it('MC-38 emphasized points: shown points in their colour, the line grey (focus mode); { above, below } colours around the threshold', () => {
    render(wrap(<>
      <LineMicroChart aria-label="F">
        <LineMicroChartEmphasizedPoint x={0} y={1} show color="Error" />
        <LineMicroChartEmphasizedPoint x={1} y={5} />
        <LineMicroChartEmphasizedPoint x={2} y={3} show />
      </LineMicroChart>
      <LineMicroChart aria-label="S" threshold={2} color={{ above: 'Good', below: 'Error' }} showPoints points={[{ x: 0, y: 1 }, { x: 1, y: 3 }]} />
    </>));
    const f = screen.getByRole('img', { name: /^F:/ });
    const dots = f.querySelectorAll('.sk-microchart__dot');
    expect(dots).toHaveLength(2);
    expect(dots[0]).toHaveClass('sk-chart--negative');
    expect(f.querySelector('[data-sk-microchart-line="0"]')).toHaveClass('sk-microchart__line--muted');
    const s = screen.getByRole('img', { name: /^S:/ });
    expect(s.querySelectorAll('linearGradient stop')).toHaveLength(2);
    expect([...s.querySelectorAll('.sk-microchart__dot')].map((d) => d.getAttribute('class'))).toEqual([expect.stringContaining('sk-chart--negative'), expect.stringContaining('sk-chart--positive')]);
  });

  it('MC-40 minXValue / maxXValue / minYValue / maxYValue fix the scale', () => {
    render(wrap(<LineMicroChart aria-label="S" minYValue={0} maxYValue={10} points={[{ x: 0, y: 1 }, { x: 1, y: 2 }]} />));
    const ys = screen.getByRole('img', { name: /^S:/ }).querySelector('polyline')!.getAttribute('points')!.split(' ').map((xy) => Number(xy.split(',')[1]));
    expect(Math.min(...ys)).toBeGreaterThan(70);
  });
});

describe('ComparisonMicroChart', () => {
  it('AL-05 ComparisonMicroChart: view Normal (labels above the bars), bars only up to 6rem; value labels carry the colour; a track behind every bar (MC-41, MC-42, MC-73)', () => {
    fakeResize(150, 60);
    const { container, unmount } = render(wrap(
      <ComparisonMicroChart aria-label="C">
        <ComparisonMicroChartData title="A" value={10} color="Good" />
        <ComparisonMicroChartData title="B" value={-5} color="Error" />
      </ComparisonMicroChart>,
    ));
    expect(container.querySelector('.sk-microchart__rows--normal')).not.toBeNull();
    expect(container.querySelectorAll('.sk-microchart__row-fit')[1]).toHaveClass('sk-chart--negative');
    expect(screen.getByRole('img', { name: 'C: A 10 (Good), B -5 (Bad)' })).toBeInTheDocument();
    expect(container.querySelectorAll('.sk-microchart__row-plot .sk-microchart__track')).toHaveLength(2);
    unmount();
    fakeResize(90, 40);
    const r = render(wrap(<ComparisonMicroChart data={[{ title: 'A', value: 10 }, { title: 'B', value: 5 }]} />));
    expect(r.container.querySelector('.sk-microchart__rows--bare')).not.toBeNull();
    expect(r.container.querySelector('.sk-microchart__row-label')).toBeNull();
  });

  it('views Wide and Responsive (above 12rem); colorPalette replaces the colours in turn; displayValue and scale', () => {
    fakeResize(250, 60);
    const { container } = render(wrap(<>
      <ComparisonMicroChart view="Wide" scale="K" data={[{ title: 'A', value: 1, displayValue: 'one', color: 'Error' }]} colorPalette={['Sequence2', 'Sequence4']} />
      <ComparisonMicroChart view="Responsive" data={[{ title: 'A', value: 1 }, { title: 'B', value: 2 }, { title: 'C', value: 3 }]} colorPalette={['Sequence2', 'Sequence4']} />
    </>));
    const [wide, responsive] = [...container.querySelectorAll('.sk-microchart')];
    expect(wide!.querySelector('.sk-microchart__rows--wide')).toHaveTextContent('AoneK');
    expect(bars(wide!)[0]).toHaveClass('sk-chart--palette-2');
    expect(responsive!.querySelector('.sk-microchart__rows--wide')).not.toBeNull();
    expect([...bars(responsive!)].map((b) => b.getAttribute('class')!.match(/palette-\d+/)![0])).toEqual(['palette-2', 'palette-4', 'palette-2']);
  });

  it('AL-06 ComparisonMicroChartData press', () => {
    const onPress = vi.fn();
    const { container } = render(wrap(<ComparisonMicroChart data={[{ title: 'A', value: 1, onPress }]} />));
    fireEvent.click(bars(container)[0]!);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('AreaMicroChart', () => {
  const line = (ys: number[]) => ys.map((y, x) => ({ x, y }));

  it('AL-05 AreaMicroChart: the chart line Neutral, the target dotted; areas above maxThreshold, below minThreshold, Critical between (MC-46, MC-47)', () => {
    render(wrap(
      <AreaMicroChart aria-label="Max" chart={{ points: line([10, 50, 90]) }} target={{ points: line([60, 60, 60]) }}
        minThreshold={{ color: 'Error', points: line([20, 20, 20]) }} maxThreshold={{ color: 'Good', points: line([40, 40, 40]) }} />,
    ));
    const max = screen.getByRole('img', { name: 'Max: 10, 50, 90, Target 60, 60, 60' });
    const polys = [...max.querySelectorAll('polygon')];
    expect(polys.map((p) => p.getAttribute('data-sk-microchart-bar'))).toEqual(['band-max', 'band-min', 'band-between']);
    expect(polys.map((p) => p.getAttribute('class')!.match(/band--(\w+)/)![1])).toEqual(['positive', 'negative', 'critical']);
    expect(bars(max, 'target')).toHaveLength(1);
    expect(bars(max, 'actual')[0]).toHaveClass('sk-chart--neutral');
  });

  it('the inner area between innerMinThreshold and innerMaxThreshold in innerMaxThreshold\'s colour; lines with colorPalette; points as children', () => {
    render(wrap(
      <AreaMicroChart aria-label="T" innerMinThreshold={{ points: line([30, 30]) }} innerMaxThreshold={{ color: 'Good', points: line([70, 70]) }} colorPalette={['Sequence5']}>
        <AreaMicroChartItem><AreaMicroChartPoint x={0} y={10} /><AreaMicroChartPoint x={1} y={90} /></AreaMicroChartItem>
      </AreaMicroChart>,
    ));
    const t = screen.getByRole('img', { name: /^T:/ });
    expect(t.querySelectorAll('polygon')).toHaveLength(1);
    expect(t.querySelector('polygon')).toHaveClass('sk-microchart__band--positive');
    expect(bars(t, 'line-0')[0]).toHaveClass('sk-chart--palette-5');
  });

  it('MC-48 labels from the label aggregations (coloured), min / max labels in thirds; showLabel; one point is no data', () => {
    const { container, rerender } = render(wrap(
      <AreaMicroChart chart={{ points: line([4, 9, 1, 6]) }} firstYLabel={<AreaMicroChartLabel label="4" color="Error" />} lastYLabel={{ label: '6' }} firstXLabel={{ label: 'P1' }} lastXLabel={{ label: 'P4' }}
        maxLabel={{ label: '9' }} minLabel={{ label: '1' }} />,
    ));
    expect(container.querySelector('.sk-microchart__edges--top')).toHaveTextContent('496');
    expect(container.querySelector('.sk-microchart__edges--top [data-sk-num]')).toHaveClass('sk-chart--negative');
    expect(container.querySelector('.sk-microchart__edges--bottom')).toHaveTextContent('P11P4');
    rerender(wrap(<AreaMicroChart showLabel={false} chart={{ points: line([4, 9]) }} firstYLabel={{ label: '4' }} />));
    expect(container.querySelector('.sk-microchart__edges')).toBeNull();
    rerender(wrap(<AreaMicroChart aria-label="One" chart={{ points: line([4]) }} />));
    expect(screen.getByRole('img', { name: 'One: No data' })).toBeInTheDocument();
  });

  it('MC-49 view Wide: labels before and after the chart', () => {
    fakeResize(200, 40);
    const { container } = render(wrap(<AreaMicroChart view="Wide" chart={{ points: line([1, 2]) }} firstYLabel={{ label: '1' }} lastYLabel={{ label: '2' }} />));
    expect(container.querySelectorAll('.sk-microchart__wide > .sk-microchart__texts')).toHaveLength(2);
  });

  it('AL-07 AreaMicroChartPoint: getXValue / getYValue through the ref', () => {
    const ref = createRef<AreaMicroChartPoint>();
    render(wrap(<AreaMicroChart chart={{ points: [<AreaMicroChartPoint key="a" ref={ref} x={3} />] }} />));
    expect(ref.current!.getXValue()).toBe(3);
    expect(ref.current!.getYValue()).toBeUndefined();
  });
});

describe('StackedBarMicroChart', () => {
  it('AL-05 StackedBarMicroChart: percentages of the sum with precision 1, palette colours in turn, labels shown (MC-58, MC-59)', () => {
    render(wrap(<StackedBarMicroChart aria-label="S"><StackedBarMicroChartBar value={1} /><StackedBarMicroChartBar value={2} /></StackedBarMicroChart>));
    const s = screen.getByRole('img', { name: 'S: 1 (33.3%), 2 (66.7%)' });
    expect(s).toHaveTextContent('33.3%66.7%');
    expect(bars(s)[0]).toHaveClass('sk-chart--palette-1');
    expect(bars(s)[1]).toHaveClass('sk-chart--palette-2');
  });

  it('maxValue: widths of the maximum and absolute labels; displayValue; valueColor; precision; displayZeroValue; showLabels', () => {
    const { container } = render(wrap(<>
      <StackedBarMicroChart maxValue={10} bars={[{ value: 2, displayValue: 'two' }, { value: 3, valueColor: 'Good' }]} />
      <StackedBarMicroChart precision={0} showLabels={false} bars={[{ value: 1 }, { value: 2 }]} />
      <StackedBarMicroChart displayZeroValue={false} bars={[{ value: 0 }, { value: 2 }]} />
      <StackedBarMicroChart aria-label="N" />
    </>));
    const [m, p, z] = [...container.querySelectorAll('.sk-microchart')];
    expect((bars(m!)[0] as HTMLElement).style.width).toBe('20%');
    expect(m).toHaveTextContent('two3');
    expect(bars(m!)[1]).toHaveClass('sk-chart--positive');
    expect(p!.querySelector('.sk-microchart__segment-label')).toBeNull();
    expect(screen.getByRole('img', { name: /33%/ })).toBe(p);
    expect(bars(z!)).toHaveLength(1);
    expect(screen.getByRole('img', { name: 'N: No data' })).toBeInTheDocument();
  });
});

describe('MicroChartHelper mapping (FE 1.154): annotation data → control', () => {
  it('bullet: DeltaBulletChart → mode Delta; criticality → actual colour; CriticalityCalculation → thresholds; MC-13 short labels', () => {
    render(wrap(<>
      <MicroChartDrawing kind="bullet" label="A" value={1200} target={1440} criticality={3} thresholds={[{ value: 500, criticality: 1 }]} />
      <MicroChartDrawing kind="bullet" label="D" value={760} target={1000} mode="delta" />
    </>));
    const a = screen.getByRole('img', { name: 'A: Actual 1,200 (Good), Target 1,440, Thresholds 500' });
    expect(a).toHaveClass('sk-chart--positive');
    expect(a).toHaveTextContent('1.2K1.4K');
    expect(bars(a, 'threshold')[0]).toHaveClass('sk-chart--negative');
    expect(bars(screen.getByRole('img', { name: /^D:/ }), 'delta')).toHaveLength(1);
  });

  it('MC-51 radial: TargetValue is the total, else the value is the percentage; MC-55 MC-56 Harvey Ball: MaximumValue, the qualitative palette without criticality', () => {
    render(wrap(<>
      <MicroChartDrawing kind="radial" label="R" value={1} target={4} />
      <MicroChartDrawing kind="radial" label="P" value={42} />
      <MicroChartDrawing kind="harvey" label="H" value={1500000} max={4000000} />
    </>));
    expect(screen.getByRole('img', { name: 'R: 25%' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'P: 42%' })).toBeInTheDocument();
    const h = screen.getByRole('img', { name: 'H: 1,500,000 of 4,000,000' });
    expect(h).toHaveClass('sk-chart--palette-1');
    expect(h).toHaveTextContent('1.5M4M');
  });

  const pts = (vals: number[], extra: Partial<{ criticality: 0 | 1 | 2 | 3 | 5; target: number; display: string }>[] = []) => vals.map((value, i) => ({ label: `P${i + 1}`, value, ...(extra[i] ?? {}) }));

  it('column and area: first / last value (criticality colour) and dimension labels, none with showLabels false (showOnlyChart)', () => {
    const { container } = render(wrap(<>
      <MicroChartDrawing kind="column" label="C" points={pts([10, -5, 20], [{ criticality: 1 }])} />
      <MicroChartDrawing kind="column" label="O" showLabels={false} points={pts([10, 20])} />
    </>));
    const c = screen.getByRole('img', { name: 'C: P1 10, P2 -5, P3 20' });
    expect(c.querySelector('.sk-microchart__edges--top')).toHaveTextContent('1020');
    expect(c.querySelector('.sk-microchart__edges--top [data-sk-num]')).toHaveClass('sk-chart--negative');
    expect(c.querySelector('.sk-microchart__edges--bottom')).toHaveTextContent('P1P3');
    expect(screen.getByRole('img', { name: /^O:/ }).querySelector('.sk-microchart__edges')).toBeNull();
    void container;
  });

  it('MC-35 MC-36 line: one line per measure, coloured by its last point; top labels smallest first / largest last value; no threshold line', () => {
    render(wrap(<MicroChartDrawing kind="line" label="Q" lines={[pts([5, 7, 9], [{}, {}, { criticality: 3 }]), pts([3, 4, 12])]} />));
    const q = screen.getByRole('img', { name: 'Q: Line 1 5, 7, 9; Line 2 3, 4, 12' });
    expect(q.querySelector('[data-sk-microchart-line="0"]')).toHaveClass('sk-chart--positive');
    expect(q.querySelector('[data-sk-microchart-line="1"]')).toHaveClass('sk-chart--neutral');
    expect(q.querySelector('.sk-microchart__edges--top')).toHaveTextContent('312');
    expect(q.querySelector('.sk-microchart__edges--bottom')).toHaveTextContent('P1P3');
    expect(bars(q, 'threshold')).toHaveLength(0);
  });

  it('comparison: the qualitative palette without criticality, semantic colours with it, at most 12 bars; stacked bar: the measure text as label', () => {
    const many = Array.from({ length: 14 }, (_, i) => ({ label: String.fromCharCode(65 + i), value: (i + 1) * 10 }));
    render(wrap(<>
      <MicroChartDrawing kind="comparison" label="Top" points={many} />
      <MicroChartDrawing kind="comparison" label="S" points={pts([1, 2], [{ criticality: 1 }])} />
      <MicroChartDrawing kind="stackedBar" label="B" points={pts([1, 3], [{ display: 'one' }])} />
    </>));
    const top = screen.getByRole('img', { name: /^Top: A 10, B 20, .*, L 120$/ });
    expect(bars(top)).toHaveLength(12);
    expect(bars(top)[1]).toHaveClass('sk-chart--palette-2');
    const s = screen.getByRole('img', { name: /^S:/ });
    expect(bars(s)[0]).toHaveClass('sk-chart--negative');
    expect(bars(s)[1]).toHaveClass('sk-chart--neutral');
    expect(screen.getByRole('img', { name: /^B:/ })).toHaveTextContent('one75%');
  });

  it('MC-47 MC-74 area: threshold items by improvement direction (Maximize: DeviationLow Error below, ToleranceLow Good above; Target: inner Good area); coloured start and end values', () => {
    const points = pts([10, 50, 90], [{ criticality: 1, target: 60 }, { target: 60 }, { criticality: 3, target: 60 }]);
    render(wrap(<>
      <MicroChartDrawing kind="area" label="Max" points={points} areaThresholds={{ direction: 'Maximize', deviationLow: [20, 20, 20], toleranceLow: [40, 40, 40] }} />
      <MicroChartDrawing kind="area" label="Target" points={points} areaThresholds={{ direction: 'Target', deviationLow: [20, 20, 20], toleranceLow: [30, 30, 30], toleranceHigh: [70, 70, 70], deviationHigh: [80, 80, 80] }} />
    </>));
    const max = screen.getByRole('img', { name: 'Max: 10, 50, 90, Target 60, 60, 60' });
    expect([...max.querySelectorAll('polygon')].map((p) => p.getAttribute('class')!.match(/band--(\w+)/)![1])).toEqual(['positive', 'negative', 'critical']);
    const top = max.querySelectorAll('.sk-microchart__edges--top [data-sk-num]');
    expect(top[0]).toHaveClass('sk-chart--negative');
    expect(top[1]).toHaveClass('sk-chart--positive');
    expect(screen.getByRole('img', { name: /^Target:/ }).querySelectorAll('polygon')).toHaveLength(4);
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
    render(wrap(<Field service="shop" typeName="Shop.Product" metaPath={field} row={{ Price: '18.50' }} cell />));
    expect(screen.getByRole('img', { name: /^Budget use: Actual 18\.5/ })).toHaveClass('sk-chart--negative');
  });

  it('MC-06 an empty cell without data; MC-60 MC-64 other chart types (Waterfall) draw nothing', () => {
    const { container } = render(wrap(
      <>
        <span data-a><Field service="shop" typeName="Shop.Product" metaPath={field} row={{}} cell /></span>
        <span data-b><Field service="shop" typeName="Shop.Product" metaPath={{ ...field, chart: { ...chart, chartType: 'Waterfall' } }} row={{ Price: 1 }} cell /></span>
      </>,
    ));
    expect(container.querySelector('[data-a] [data-sk-microchart]')).toBeNull();
    expect(container.querySelector('[data-b]')).toBeEmptyDOMElement();
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
    render(wrap(<span data-c><Field service="shop" typeName="T.Order" metaPath={cols[2]!} row={row} cell /></span>, { model }));
    expect(screen.getByRole('img', { name: 'Share: 4 (25%), 12 (75%)' })).toBeInTheDocument();
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
    render(wrap(<MicroChartDrawing {...props} label="B" />));
    const bar = screen.getByRole('img', { name: /^B:/ }).querySelector('[data-sk-microchart-bar="1"]')!;
    expect(Number(bar.getAttribute('width'))).toBeCloseTo(50);
  });
});
