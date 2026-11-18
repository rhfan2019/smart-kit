import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { niceTicks, SimpleChart, type ChartDatum } from '../src/chart';
import { BulletMicroChart } from '../src/chart/microBullet';
import { ColumnMicroChart } from '../src/chart/microColumn';
import { DeltaMicroChart } from '../src/chart/microDelta';
import { HarveyBallMicroChart } from '../src/chart/microHarvey';
import { RadialMicroChart } from '../src/chart/microRadial';
import { wrap } from './helpers';

const bars = (root: Element) => root.querySelectorAll('[data-sk-microchart-bar]');

describe('P2-OP-04 micro charts (ADR-021): the sap.suite.ui.microchart controls', () => {
  it('MC-21 bullet: value, target marker and text alternative', () => {
    render(wrap(<BulletMicroChart aria-label="Budget" targetValue={1440} actual={{ value: 1200, color: 'Good' }} />));
    const img = screen.getByRole('img', { name: 'Budget: Actual 1,200 (Good), Target 1,440' });
    expect(img).toHaveClass('sk-microchart--bullet', 'sk-chart--positive');
    expect(bars(img)).toHaveLength(2);
    expect(img.querySelector('[data-sk-microchart-bar="target"]')).not.toBeNull();
    expect(img).toHaveTextContent('12001440');
  });

  it('radial: percent in the centre', () => {
    render(wrap(<RadialMicroChart aria-label="Received" fraction={50} total={100} />));
    const img = screen.getByRole('img', { name: 'Received: 50%' });
    expect(img.querySelector('.sk-microchart__center')).toHaveTextContent('50%');
    expect(img.querySelectorAll('circle')).toHaveLength(2);
  });

  it('delta: two bars and the delta bar', () => {
    render(wrap(<DeltaMicroChart aria-label="Revenue" value1={80} value2={100} />));
    const img = screen.getByRole('img', { name: 'Revenue: 80 compared with 100, difference -20' });
    expect(bars(img)).toHaveLength(3);
    expect(img.querySelector('[data-sk-microchart-bar="delta"]')).toHaveClass('sk-chart--neutral');
  });

  it('empty, zero and missing data', () => {
    render(wrap(
      <>
        <BulletMicroChart aria-label="A" />
        <ColumnMicroChart aria-label="C" columns={[]} />
        <HarveyBallMicroChart aria-label="D" total={10} items={[{ fraction: 0 }]} />
        <BulletMicroChart aria-label="E" targetValue={0} actual={{ value: 0 }} />
      </>,
    ));
    for (const l of ['A', 'C']) expect(screen.getByRole('img', { name: `${l}: No data` })).toHaveTextContent('No data');
    expect(bars(screen.getByRole('img', { name: 'D: 0 of 10' }))).toHaveLength(0);
    expect(screen.getByRole('img', { name: 'E: Actual 0, Target 0' })).toBeInTheDocument();
  });

  it('Chinese text alternative', () => {
    render(wrap(<BulletMicroChart aria-label="预算" targetValue={2} actual={{ value: 1 }} />, { locale: 'zh' }));
    expect(screen.getByRole('img', { name: '预算：实际 1，目标 2' })).toBeInTheDocument();
  });
});

const data: ChartDatum[] = [
  { key: 'O', label: 'Open', value: 500 },
  { key: 'C', label: 'Closed', value: 1234, formatted: '1,234.00 EUR' },
  { key: 'X', label: 'A very long category label that must be truncated', value: 80 },
];

describe('P2-LR-04 chart view (ADR-021)', () => {
  it('nice ticks', () => {
    expect(niceTicks(0, 1234)).toEqual([0, 500, 1000, 1500]);
    expect(niceTicks(-20, 80)).toEqual([-25, 0, 25, 50, 75, 100]);
    expect(niceTicks(0, 0)).toEqual([0, 0.25, 0.5, 0.75, 1]);
  });

  it('renders bars, ticks and truncated labels; select by click', async () => {
    const onSelect = vi.fn();
    const { container } = render(wrap(<SimpleChart kind="column" title="Revenue" measureLabel="Revenue" dimensionLabel="Status" data={data} onSelect={onSelect} />));
    expect(container.querySelector('[data-sk-chart="column"]')).not.toBeNull();
    expect(screen.getByRole('group', { name: 'Revenue' })).toBeInTheDocument();
    expect(container.querySelectorAll('[data-sk-chart-bar]')).toHaveLength(3);
    expect(container.querySelectorAll('.sk-chart__tick').length).toBeGreaterThanOrEqual(4);
    const long = [...container.querySelectorAll('.sk-chart__category')].find((n) => n.querySelector('title'));
    expect(long?.querySelector('title')).toHaveTextContent(data[2]!.label);
    const closed = screen.getByRole('button', { name: 'Status Closed: 1,234.00 EUR' });
    await userEvent.setup().click(closed);
    expect(onSelect).toHaveBeenCalledWith(data[1], closed);
  });

  it('keyboard: Tab enters at the selected bar, arrows move, Enter and Space select', async () => {
    const onSelect = vi.fn();
    render(wrap(
      <>
        <button type="button">before</button>
        <SimpleChart kind="bar" measureLabel="Revenue" dimensionLabel="Status" data={data} onSelect={onSelect} selectedKey="C" />
      </>,
    ));
    expect(screen.getByRole('group', { name: 'Revenue by Status' })).toBeInTheDocument();
    const closed = screen.getByRole('button', { name: 'Status Closed: 1,234.00 EUR' });
    expect(closed).toHaveAttribute('aria-pressed', 'true');
    const user = userEvent.setup();
    await user.tab();
    await user.tab();
    expect(closed).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    const third = document.querySelector('[data-sk-chart-bar="X"]')!;
    expect(third).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onSelect).toHaveBeenLastCalledWith(data[2], third);
    await user.keyboard('{Home}');
    await user.keyboard(' ');
    expect(onSelect).toHaveBeenLastCalledWith(data[0], document.querySelector('[data-sk-chart-bar="O"]'));
    fireEvent.keyDown(document.querySelector('[data-sk-chart-bar="O"]')!, { key: 'ArrowLeft' });
    expect(document.querySelector('[data-sk-chart-bar="O"]')).toHaveFocus();
    expect(onSelect).toHaveBeenCalledTimes(2);
  });

  it('not interactive without onSelect: one image with all values', () => {
    render(wrap(<SimpleChart kind="column" measureLabel="Revenue" dimensionLabel="Status" data={data.slice(0, 2)} />));
    expect(screen.getByRole('img', { name: 'Revenue by Status: Open 500, Closed 1,234.00 EUR' })).toBeInTheDocument();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('loading and empty states', () => {
    const { container, rerender } = render(wrap(<SimpleChart kind="column" measureLabel="Revenue" dimensionLabel="Status" data={[]} loading />));
    expect(container.querySelector('[data-sk-chart][aria-busy="true"]')).not.toBeNull();
    expect(screen.getByText('Loading chart…')).toBeInTheDocument();
    rerender(wrap(<SimpleChart kind="column" measureLabel="Revenue" dimensionLabel="Status" data={[]} />));
    expect(screen.getByText('No data')).toBeInTheDocument();
    expect(container.querySelectorAll('[data-sk-chart-bar]')).toHaveLength(0);
  });
});
