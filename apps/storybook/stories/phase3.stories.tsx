/** Phase 3 micro charts (docs/15-research-micro-chart.md): the sap.suite.ui.microchart controls in sizes, label hiding, no data, themes. */
import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ReactElement } from 'react';
import AreaMicroChart from '@rhfan2019/smart-kit/suite/ui/microchart/AreaMicroChart';
import BulletMicroChart from '@rhfan2019/smart-kit/suite/ui/microchart/BulletMicroChart';
import ColumnMicroChart from '@rhfan2019/smart-kit/suite/ui/microchart/ColumnMicroChart';
import ComparisonMicroChart from '@rhfan2019/smart-kit/suite/ui/microchart/ComparisonMicroChart';
import DeltaMicroChart from '@rhfan2019/smart-kit/suite/ui/microchart/DeltaMicroChart';
import HarveyBallMicroChart from '@rhfan2019/smart-kit/suite/ui/microchart/HarveyBallMicroChart';
import LineMicroChart from '@rhfan2019/smart-kit/suite/ui/microchart/LineMicroChart';
import LineMicroChartEmphasizedPoint from '@rhfan2019/smart-kit/suite/ui/microchart/LineMicroChartEmphasizedPoint';
import RadialMicroChart from '@rhfan2019/smart-kit/suite/ui/microchart/RadialMicroChart';
import StackedBarMicroChart from '@rhfan2019/smart-kit/suite/ui/microchart/StackedBarMicroChart';

const meta: Meta = { title: 'smart-kit/Phase 3 micro charts', parameters: { layout: 'fullscreen' } };
export default meta;
type Story = StoryObj;

/** Container sizes from the largest to the smallest the guidelines allow (MC-03); size Responsive fills each one. */
const SIZES = [
  { name: '320 × 94', width: 320, height: 94 },
  { name: '200 × 72', width: 200, height: 72 },
  { name: '140 × 40', width: 140, height: 40 },
  { name: '64 × 18', width: 64, height: 18 },
];

function Grid({ charts }: { charts: { label: string; chart: ReactElement }[] }) {
  return (
    <table style={{ borderCollapse: 'separate', borderSpacing: 16, fontSize: 12 }}>
      <thead><tr><th />{SIZES.map((s) => <th key={s.name} style={{ textAlign: 'left' }}>{s.name}</th>)}</tr></thead>
      <tbody>
        {charts.map((c) => (
          <tr key={c.label}>
            <th style={{ textAlign: 'left', fontWeight: 'normal' }}>{c.label}</th>
            {SIZES.map((s) => <td key={s.name}><div style={{ width: s.width, height: s.height, outline: '1px dotted #ccc' }}>{c.chart}</div></td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const R = 'Responsive' as const;
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
const xy = (vals: number[]) => vals.map((y, x) => ({ x, y }));

export const Bullet: Story = {
  render: () => (
    <Grid charts={[
      { label: 'Actual vs target', chart: <BulletMicroChart size={R} targetValue={150} actual={{ value: 120, color: 'Good' }} /> },
      { label: 'With forecast', chart: <BulletMicroChart size={R} targetValue={150} forecastValue={140} actual={{ value: 90, color: 'Critical' }} /> },
      { label: 'Thresholds', chart: <BulletMicroChart size={R} targetValue={100} actual={{ value: 60 }} thresholds={[{ value: 40, color: 'Error' }, { value: 70, color: 'Critical' }]} /> },
      { label: 'Delta mode', chart: <BulletMicroChart size={R} mode="Delta" targetValue={1000} actual={{ value: 760, color: 'Error' }} /> },
      { label: 'Labels and scale', chart: <BulletMicroChart size={R} scale="M" actualValueLabel="123.5" targetValueLabel="150" targetValue={150000000} actual={{ value: 123456789 }} /> },
    ]} />
  ),
};

export const RadialAndHarveyBall: Story = {
  render: () => (
    <Grid charts={[
      { label: 'Radial 42 %', chart: <RadialMicroChart size={R} percentage={42} /> },
      { label: 'Radial 3 of 4', chart: <RadialMicroChart size={R} fraction={3} total={4} valueColor="Good" /> },
      { label: 'Harvey Ball', chart: <HarveyBallMicroChart size={R} total={8} items={[{ fraction: 3 }]} /> },
      { label: 'Harvey Ball Sequence5', chart: <HarveyBallMicroChart size={R} total={100} totalScale="%" items={[{ fraction: 70, color: 'Sequence5', fractionScale: '%' }]} /> },
      { label: 'Harvey Ball critical', chart: <HarveyBallMicroChart size={R} total={8} items={[{ fraction: 7, color: 'Critical' }]} /> },
    ]} />
  ),
};

export const LineAndColumn: Story = {
  render: () => (
    <Grid charts={[
      { label: 'Line', chart: <LineMicroChart size={R} leftTopLabel="3" rightTopLabel="9" leftBottomLabel="Jan" rightBottomLabel="Jun" points={xy([3, 5, 4, 8, 7, 9])} /> },
      { label: 'Three lines', chart: <LineMicroChart size={R} lines={[{ color: 'Sequence1', points: xy([3, 5, 4, 8]) }, { color: 'Sequence2', type: 'Dashed', points: xy([2, 3, 6, 5]) }, { color: 'Sequence3', type: 'Dotted', points: xy([6, 6, 7, 7]) }]} /> },
      { label: 'Above / below threshold', chart: <LineMicroChart size={R} threshold={0} showPoints color={{ above: 'Good', below: 'Error' }} points={xy([3, -2, 4, 1])} /> },
      { label: 'Emphasized points', chart: <LineMicroChart size={R} threshold={5} showThresholdValue>{[3, 6, 4, 8].map((y, x) => <LineMicroChartEmphasizedPoint key={x} x={x} y={y} show={x === 0 || x === 3} color={x === 3 ? 'Good' : 'Neutral'} />)}</LineMicroChart> },
      { label: 'Column', chart: <ColumnMicroChart size={R} columns={[5, 7, -3, 6, 8, 4].map((value, i) => ({ value, label: months[i] }))} leftTopLabel={{ label: '5' }} rightTopLabel={{ label: '4' }} leftBottomLabel={{ label: 'Jan' }} rightBottomLabel={{ label: 'Jun' }} /> },
      { label: 'Column semantic', chart: <ColumnMicroChart size={R} columns={[{ value: 5, color: 'Good' }, { value: 7, color: 'Critical' }, { value: 3, color: 'Error' }]} /> },
      { label: 'Column labels', chart: <ColumnMicroChart size={R} allowColumnLabels columns={[5, 7, 3, 6].map((value) => ({ value }))} /> },
    ]} />
  ),
};

export const AreaComparisonStacked: Story = {
  render: () => (
    <Grid charts={[
      { label: 'Area (Maximize)', chart: <AreaMicroChart size={R} chart={{ points: xy([60, 90, 110, 140]) }} target={{ points: xy([120, 120, 120, 120]) }} minThreshold={{ color: 'Error', points: xy([80, 80, 80, 80]) }} maxThreshold={{ color: 'Good', points: xy([100, 100, 100, 100]) }} firstYLabel={{ label: '60' }} lastYLabel={{ label: '140' }} firstXLabel={{ label: 'Jan' }} lastXLabel={{ label: 'Apr' }} /> },
      { label: 'Area wide', chart: <AreaMicroChart size={R} view="Wide" chart={{ points: xy([60, 90, 110, 140]) }} firstYLabel={{ label: '60' }} lastYLabel={{ label: '140' }} firstXLabel={{ label: 'Jan' }} lastXLabel={{ label: 'Apr' }} /> },
      { label: 'Area min / max', chart: <AreaMicroChart size={R} chart={{ points: xy([60, 150, 40, 140]) }} firstYLabel={{ label: '60' }} maxLabel={{ label: '150' }} lastYLabel={{ label: '140' }} firstXLabel={{ label: 'Jan' }} minLabel={{ label: '40' }} lastXLabel={{ label: 'Apr' }} /> },
      { label: 'Comparison', chart: <ComparisonMicroChart size={R} data={[30, 12, -8, 20].map((value, i) => ({ value, title: months[i], color: value < 0 ? 'Error' : 'Good' }))} /> },
      { label: 'Stacked bar (percent)', chart: <StackedBarMicroChart size={R} bars={[{ value: 20 }, { value: 40 }, { value: 50 }]} /> },
      { label: 'Stacked bar (maximum)', chart: <StackedBarMicroChart size={R} maxValue={200} bars={[{ value: 20, valueColor: 'Good' }, { value: 40, valueColor: 'Critical' }, { value: 50, valueColor: 'Error' }]} /> },
      { label: 'Delta', chart: <DeltaMicroChart size={R} value1={105} value2={98} title1="May 2026" title2="Apr 2026" color="Good" /> },
    ]} />
  ),
};

export const NoData: Story = {
  render: () => <Grid charts={[{ label: 'No data (MC-05)', chart: <BulletMicroChart size={R} /> }, { label: 'Radial without value', chart: <RadialMicroChart size={R} /> }, { label: 'Harvey Ball without total', chart: <HarveyBallMicroChart size={R} items={[{ fraction: 3 }]} /> }]} />,
};

/** The qualitative palette and the semantic colours follow the theme (MC-08). */
export const PaletteInThemes: Story = {
  render: () => (
    <div>
      {(['yellow', 'navy', 'dark'] as const).map((theme) => (
        <div key={theme} data-sk-theme={theme} style={{ display: 'flex', gap: 16, padding: 16, background: 'var(--sk-color-surface)', color: 'var(--sk-color-text)' }}>
          <span style={{ width: 60 }}>{theme}</span>
          {Array.from({ length: 11 }, (_, i) => (
            <div key={i} style={{ width: 64, height: 40 }}><HarveyBallMicroChart size={R} aria-label={`Sequence${i + 1}`} total={11} items={[{ fraction: i + 1, color: `Sequence${i + 1}` }]} /></div>
          ))}
          {(['Error', 'Critical', 'Good', 'Neutral'] as const).map((c) => <div key={c} style={{ width: 120, height: 40 }}><BulletMicroChart size={R} aria-label={c} targetValue={80} actual={{ value: 60, color: c }} /></div>)}
        </div>
      ))}
    </div>
  ),
};
