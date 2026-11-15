import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MicroChart, niceTicks, SimpleChart, type ChartDatum } from '../src/chart';
import { wrap } from './helpers';

const bars = (root: Element) => root.querySelectorAll('[data-sk-microchart-bar]');

describe('P2-OP-04 micro charts (ADR-021)', () => {
  it('bullet: value, target marker and text alternative', () => {
    render(wrap(<MicroChart kind="bullet" label="Budget" value={1200} target={1440} criticality={3} />));
    const img = screen.getByRole('img', { name: 'Budget: 1,200 of 1,440' });
    expect(img).toHaveClass('sk-microchart--bullet', 'sk-chart--positive');
    expect(bars(img)).toHaveLength(2);
    expect(img.querySelector('[data-sk-microchart-bar="target"]')).not.toBeNull();
    expect(img).toHaveTextContent('1,200');
  });

  it('bullet without target uses the plain value label; custom format is used', () => {
    render(wrap(<MicroChart kind="bullet" label="Stock" value={7} format={(n) => `${n} pc`} />));
    expect(screen.getByRole('img', { name: 'Stock: 7 pc' })).toBeInTheDocument();
  });

  it('radial: percent in the centre', () => {
    render(wrap(<MicroChart kind="radial" label="Received" value={50} target={100} />));
    const img = screen.getByRole('img', { name: 'Received: 50%' });
    expect(img.querySelector('.sk-microchart__center')).toHaveTextContent('50%');
    expect(img.querySelectorAll('circle')).toHaveLength(2);
  });

  it('harvey: sector and total', () => {
    render(wrap(<MicroChart kind="harvey" label="Capacity" value={30} target={120} />));
    const img = screen.getByRole('img', { name: 'Capacity: 30 of 120' });
    expect(img.querySelector('path[data-sk-microchart-bar="value"]')).not.toBeNull();
    expect(img).toHaveTextContent('120');
  });

  it('delta: two bars and a signed delta bar', () => {
    render(wrap(<MicroChart kind="delta" label="Revenue" value={80} target={100} />));
    const img = screen.getByRole('img', { name: 'Revenue: 80 compared with 100, difference -20' });
    expect(bars(img)).toHaveLength(3);
    expect(img.querySelector('[data-sk-microchart-bar="delta"]')).toHaveClass('sk-chart--negative');
  });

  const points = [{ label: 'Jan', value: 10 }, { label: 'Feb', value: -5, criticality: 1 as const }, { label: 'Mar', value: 20 }];
  it('column: one column per point, negative below the baseline, first and last labels', () => {
    render(wrap(<MicroChart kind="column" label="Trend" points={points} />));
    const img = screen.getByRole('img', { name: 'Trend: Jan 10, Feb -5, Mar 20' });
    expect(bars(img)).toHaveLength(3);
    expect(bars(img)[1]).toHaveClass('sk-chart--negative');
    const base = Number(img.querySelector('.sk-microchart__baseline')!.getAttribute('y1'));
    expect(Number(bars(img)[1]!.getAttribute('y'))).toBeCloseTo(base);
    expect(img.querySelector('.sk-microchart__edges')).toHaveTextContent('JanMar');
  });

  it('line: polyline with a dot per point and first / last values', () => {
    render(wrap(<MicroChart kind="line" label="Trend" points={points} />));
    const img = screen.getByRole('img', { name: 'Trend: Jan 10, Feb -5, Mar 20' });
    expect(img.querySelector('polyline')!.getAttribute('points')!.split(' ')).toHaveLength(3);
    expect(bars(img)).toHaveLength(3);
    expect(img.querySelector('.sk-microchart__edges')).toHaveTextContent('1020');
  });

  it('comparison: at most four bars with label and value', () => {
    const many = ['A', 'B', 'C', 'D', 'E'].map((label, i) => ({ label, value: (i + 1) * 10 }));
    render(wrap(<MicroChart kind="comparison" label="Top" points={many} />));
    const img = screen.getByRole('img', { name: 'Top: A 10, B 20, C 30, D 40' });
    expect(bars(img)).toHaveLength(4);
    expect(img.querySelectorAll('.sk-microchart__row-label')[3]).toHaveTextContent('D');
  });

  it('empty, zero and missing data', () => {
    render(wrap(
      <>
        <MicroChart kind="bullet" label="A" />
        <MicroChart kind="radial" label="B" value={5} target={0} />
        <MicroChart kind="column" label="C" points={[]} />
        <MicroChart kind="harvey" label="D" value={0} target={10} />
        <MicroChart kind="bullet" label="E" value={0} target={0} />
      </>,
    ));
    for (const l of ['A', 'B', 'C']) expect(screen.getByRole('img', { name: `${l}: No data` })).toHaveTextContent('No data');
    expect(bars(screen.getByRole('img', { name: 'D: 0 of 10' }))).toHaveLength(0);
    expect(screen.getByRole('img', { name: 'E: 0 of 0' })).toBeInTheDocument();
  });

  it('pressable: a button with the text alternative, Enter and Space press it', async () => {
    const onPress = vi.fn();
    render(wrap(<MicroChart kind="radial" label="Received" value={1} target={4} onPress={onPress} size="S" />));
    const button = screen.getByRole('button', { name: 'Received: 25%' });
    expect(button).toHaveClass('sk-microchart--S');
    expect(screen.queryByRole('img')).toBeNull();
    const user = userEvent.setup();
    await user.tab();
    expect(button).toHaveFocus();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    await user.click(button);
    expect(onPress).toHaveBeenCalledTimes(3);
  });

  it('Chinese text alternative', () => {
    render(wrap(<MicroChart kind="bullet" label="预算" value={1} target={2} />, { locale: 'zh' }));
    expect(screen.getByRole('img', { name: '预算：1 / 2' })).toBeInTheDocument();
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
