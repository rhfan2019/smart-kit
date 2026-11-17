/** Phase 3 micro charts (docs/15-research-micro-chart.md): sizes, label hiding, no data, themes. */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { MicroChart, type MicroChartProps } from '@rhfan2019/smart-kit';

const meta: Meta = { title: 'smart-kit/Phase 3 micro charts', parameters: { layout: 'fullscreen' } };
export default meta;
type Story = StoryObj;

/** Container sizes from the largest to the smallest the guidelines allow (MC-03); the chart fills each one. */
const SIZES = [
  { name: '320 × 94', width: 320, height: 94 },
  { name: '200 × 72', width: 200, height: 72 },
  { name: '140 × 40', width: 140, height: 40 },
  { name: '64 × 18', width: 64, height: 18 },
];

function Grid({ charts }: { charts: (Omit<MicroChartProps, 'label'> & { label: string })[] }) {
  return (
    <table style={{ borderCollapse: 'separate', borderSpacing: 16, fontSize: 12 }}>
      <thead><tr><th />{SIZES.map((s) => <th key={s.name} style={{ textAlign: 'left' }}>{s.name}</th>)}</tr></thead>
      <tbody>
        {charts.map((c) => (
          <tr key={c.label}>
            <th style={{ textAlign: 'left', fontWeight: 'normal' }}>{c.label}</th>
            {SIZES.map((s) => <td key={s.name}><div style={{ width: s.width, height: s.height, outline: '1px dotted #ccc' }}><MicroChart {...c} /></div></td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export const Bullet: Story = {
  render: () => (
    <Grid charts={[
      { kind: 'bullet', label: 'Actual vs target', value: 120, target: 150, criticality: 3 },
      { kind: 'bullet', label: 'With forecast', value: 90, target: 150, forecast: 140, criticality: 2 },
      { kind: 'bullet', label: 'Thresholds', value: 60, target: 100, thresholds: [{ value: 40, criticality: 1 }, { value: 70, criticality: 2 }] },
      { kind: 'bullet', label: 'Delta mode', value: 760, target: 1000, mode: 'delta', criticality: 1 },
      { kind: 'bullet', label: 'Long numbers hide', value: 123456789, target: 150000000, criticality: 0 },
    ]} />
  ),
};

export const RadialAndHarveyBall: Story = {
  render: () => (
    <Grid charts={[
      { kind: 'radial', label: 'Radial 42 %', value: 42 },
      { kind: 'radial', label: 'Radial 3 of 4', value: 3, target: 4, criticality: 3 },
      { kind: 'harvey', label: 'Harvey Ball', value: 3, max: 8 },
      { kind: 'harvey', label: 'Harvey Ball palette 5', value: 70, max: 100, color: 5 },
      { kind: 'harvey', label: 'Harvey Ball critical', value: 7, max: 8, criticality: 2 },
    ]} />
  ),
};

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
const series = (vals: number[]) => vals.map((value, i) => ({ label: months[i % 6]!, value }));

export const LineAndColumn: Story = {
  render: () => (
    <Grid charts={[
      { kind: 'line', label: 'Line', points: series([3, 5, 4, 8, 7, 9]) },
      { kind: 'line', label: 'Three lines', lines: [series([3, 5, 4, 8]), series([2, 3, 6, 5]), series([6, 6, 7, 7])] },
      { kind: 'line', label: 'Points and threshold', points: series([3, -2, 4, 1]).map((p) => ({ ...p, criticality: p.value < 0 ? 1 : 3 } as const)), threshold: 0 },
      { kind: 'column', label: 'Column', points: series([5, 7, -3, 6, 8, 4]) },
      { kind: 'column', label: 'Column semantic', points: series([5, 7, 3]).map((p, i) => ({ ...p, criticality: ([3, 2, 1] as const)[i] })) },
      { kind: 'column', label: 'Column labels', columnLabels: true, points: series([5, 7, 3, 6]) },
      { kind: 'line', label: 'Focus, threshold label', points: series([3, 6, 4, 8]), focusPoints: [0, 3], threshold: 5, thresholdLabel: true },
    ]} />
  ),
};

export const AreaComparisonStacked: Story = {
  render: () => (
    <Grid charts={[
      { kind: 'area', label: 'Area (Maximize)', points: series([60, 90, 110, 140]).map((p) => ({ ...p, target: 120 })), areaThresholds: { direction: 'Maximize', deviationLow: [80, 80, 80, 80], toleranceLow: [100, 100, 100, 100] } },
      { kind: 'area', label: 'Area wide', view: 'wide', points: series([60, 90, 110, 140]).map((p) => ({ ...p, target: 120 })) },
      { kind: 'area', label: 'Area min / max', minMaxLabels: true, points: series([60, 150, 40, 140]) },
      { kind: 'comparison', label: 'Comparison', points: series([30, 12, -8, 20]).map((p) => ({ ...p, criticality: p.value < 0 ? 1 : 3 } as const)) },
      { kind: 'stackedBar', label: 'Stacked bar (percent)', points: series([20, 40, 50]) },
      { kind: 'stackedBar', label: 'Stacked bar (maximum)', max: 200, points: series([20, 40, 50]).map((p, i) => ({ ...p, criticality: ([3, 2, 1] as const)[i] })) },
      { kind: 'delta', label: 'Delta', value: 105, target: 98, titles: ['May 2026', 'Apr 2026'], criticality: 3 },
    ]} />
  ),
};

export const NoData: Story = {
  render: () => <Grid charts={[{ kind: 'bullet', label: 'No data (MC-05)' }, { kind: 'radial', label: 'Radial without value' }, { kind: 'harvey', label: 'Harvey Ball without total', value: 3 }]} />,
};

/** The qualitative palette and the semantic colours follow the theme (MC-08). */
export const PaletteInThemes: Story = {
  render: () => (
    <div>
      {(['yellow', 'navy', 'dark'] as const).map((theme) => (
        <div key={theme} data-sk-theme={theme} style={{ display: 'flex', gap: 16, padding: 16, background: 'var(--sk-color-surface)', color: 'var(--sk-color-text)' }}>
          <span style={{ width: 60 }}>{theme}</span>
          {Array.from({ length: 11 }, (_, i) => (
            <div key={i} style={{ width: 64, height: 40 }}><MicroChart kind="harvey" label={`Palette ${i + 1}`} value={i + 1} max={11} color={i + 1} /></div>
          ))}
          {([1, 2, 3, 0] as const).map((c) => <div key={c} style={{ width: 120, height: 40 }}><MicroChart kind="bullet" label={`Criticality ${c}`} value={60} target={80} criticality={c} /></div>)}
        </div>
      ))}
    </div>
  ),
};
