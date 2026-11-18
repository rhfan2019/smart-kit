import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { applyExtensions, conditionText, createText, filterSummaryText, parseConditionText } from '../src';
import FilterSummary from '@rhfan2019/smart-kit/kit/FilterSummary';
import useFilterState from '@rhfan2019/smart-kit/kit/useFilterState';
import Table from '../src/v4/fe/macros/Table';
import Field from '../src/v4/fe/macros/Field';
import { shopData, shopModel, wrap } from './helpers';

const product = shopModel.entityTypes['Shop.Product']!;

describe('filter summary (AC-LR-03)', () => {
  const t = createText('en');
  it('0, 1, n and more than five fields', () => {
    expect(filterSummaryText(t, [])).toBe('No filters active');
    expect(filterSummaryText(t, ['Status'])).toBe('1 filter active: Status');
    expect(filterSummaryText(t, ['A', 'B'])).toBe('2 filters active: A, B');
    expect(filterSummaryText(t, ['A', 'B', 'C', 'D', 'E', 'F'])).toBe('6 filters active: A, B, C, D, E, …');
    expect(filterSummaryText(createText('zh'), ['状态'])).toBe('1 个筛选：状态');
  });
  it('renders labels of active fields', () => {
    render(wrap(<FilterSummary entitySet="Products" filters={{ CategoryID: [{ operator: 'EQ', values: ['C1'] }], Status: [{ operator: 'EQ', values: [''] }] }} />));
    expect(screen.getByText('1 filter active: Category')).toBeInTheDocument();
  });
});

describe('typed conditions', () => {
  it('parses operators and formats tokens', () => {
    expect(parseConditionText('>=10', product.properties.Price)).toEqual({ operator: 'GE', values: ['10'] });
    expect(parseConditionText('1...5', product.properties.Price)).toEqual({ operator: 'BT', values: ['1', '5'] });
    expect(parseConditionText('*pen*', product.properties.Name)).toEqual({ operator: 'Contains', values: ['pen'] });
    expect(parseConditionText('ab*', product.properties.Name)).toEqual({ operator: 'StartsWith', values: ['ab'] });
    expect(parseConditionText('!(=X)', product.properties.Status)).toEqual({ operator: 'EQ', values: ['X'], exclude: true });
    expect(parseConditionText('p1', product.properties.Code)).toEqual({ operator: 'EQ', values: ['P1'] }); // IsUpperCase
    expect(conditionText({ operator: 'EQ', values: ['C1'], text: 'Office' }, product.properties.CategoryID, 'en-US')).toBe('Office (C1)');
    expect(conditionText({ operator: 'BT', values: ['1000', '2000'] }, product.properties.Price, 'en-US')).toBe('1,000.00...2,000.00');
    expect(conditionText({ operator: 'EQ', values: ['X'], exclude: true }, product.properties.Status, 'en-US')).toBe('!(=X)');
  });
});

describe('extensions (docs/06 §1)', () => {
  const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  it('replace, insert before/after, start/end, missing anchor', () => {
    expect(applyExtensions(items, [{ id: 'x', position: 'after', anchor: 'a', item: { id: 'x' } }], 't').map((i) => i.id)).toEqual(['a', 'x', 'b', 'c']);
    expect(applyExtensions(items, [{ id: 'x', position: 'before', anchor: 'c', item: { id: 'x' } }], 't').map((i) => i.id)).toEqual(['a', 'b', 'x', 'c']);
    expect(applyExtensions(items, [{ id: 'x', position: 'start', item: { id: 'x' } }], 't').map((i) => i.id)).toEqual(['x', 'a', 'b', 'c']);
    expect(applyExtensions(items, [{ id: 'x', position: 'after', anchor: 'nope', item: { id: 'x' } }], 't').map((i) => i.id)).toEqual(['a', 'b', 'c', 'x']);
    const replaced = applyExtensions<{ id: string; v?: number }>(items, [{ id: 'b', position: 'replace', item: (o) => ({ ...o, v: 1 }) }], 't');
    expect(replaced[1]).toEqual({ id: 'b', v: 1 });
  });
});

describe('Field and renderer registry (AC-EXT-05, AC-I18N-03)', () => {
  const row = shopData.Products![0]!;
  it('formats amounts with currency per locale', () => {
    const { rerender } = render(wrap(<span data-testid="f"><Field contextPath="/Products" metaPath="Price" row={{ ...row, Price: '1234.5' }} /></span>));
    expect(screen.getByTestId('f').textContent).toBe('1,234.50EUR');
    rerender(wrap(<span data-testid="f"><Field contextPath="/Products" metaPath="Price" row={{ ...row, Price: '1234.5' }} /></span>, { locale: 'zh' }));
    expect(screen.getByTestId('f').textContent).toBe('1,234.50EUR');
  });
  it('dates per locale', () => {
    render(wrap(<span data-testid="f"><Field contextPath="/Products" metaPath="ReleaseDate" row={row} /></span>, { locale: 'zh' }));
    expect(screen.getByTestId('f').textContent).toBe('2026年1月2日');
  });
  it('text arrangement shows text and code', () => {
    render(wrap(<span data-testid="f"><Field contextPath="/Products" metaPath="CategoryID" row={{ ...row, _Category: { Name: 'Office' } }} /></span>));
    expect(screen.getByTestId('f').textContent).toBe('Office (C2)');
  });
  it('a registered renderer replaces the default and receives the formatted value', () => {
    render(wrap(<span data-testid="f"><Field contextPath="/Products" metaPath="Price" row={row} /></span>, { renderers: { currency: (p) => <b data-testid="custom">{`${p.unit}:${p.formatted}`}</b> } }));
    expect(screen.getByTestId('f').textContent).toBe('EUR:10.50');
  });
  it('server text is rendered as text, never as HTML', () => {
    render(wrap(<span data-testid="f"><Field contextPath="/Products" metaPath="Name" row={{ ...row, Name: '<img src=x onerror=alert(1)>' }} /></span>));
    expect(screen.getByTestId('f').querySelector('img')).toBeNull();
    expect(screen.getByTestId('f').textContent).toBe('<img src=x onerror=alert(1)>');
  });
});

describe('useFilterState (AC-EXT-06)', () => {
  it('uncontrolled: defaults from SelectionVariant; Go is blocked by empty mandatory fields', () => {
    const { result } = renderHook(() => useFilterState('Products', { autoExecute: true }), { wrapper: ({ children }) => wrap(children) });
    // Status is mandatory and only has an exclude condition from the SelectionVariant → still "complete"
    expect(result.current.filters.Status).toEqual([{ operator: 'EQ', values: ['X'], exclude: true }]);
    expect(result.current.fields).toEqual(['Code', 'CategoryID', 'Status', 'Name']);
    expect(result.current.applied).not.toBeNull();
    act(() => result.current.setConditions('Status', []));
    expect(result.current.missingRequired).toEqual(['Status']);
    let ok = true;
    act(() => { ok = result.current.go(); });
    expect(ok).toBe(false);
    expect(result.current.showRequiredErrors).toBe(true);
    expect(result.current.dirty).toBe(true);
  });
  it('initial state given by the caller and loaded content', () => {
    const { result } = renderHook(() => useFilterState('Products', { initial: { filters: { Code: [{ operator: 'EQ', values: ['P1'] }] }, fields: ['Code'] }, autoExecute: false }), { wrapper: ({ children }) => wrap(children) });
    expect(result.current.applied).toBeNull();
    expect(result.current.activeCount).toBe(1);
    act(() => result.current.load({ filters: { Status: [{ operator: 'EQ', values: ['A'] }] } }, true));
    expect(result.current.applied?.filters).toEqual({ Status: [{ operator: 'EQ', values: ['A'] }] });
  });
});

describe('Table columns (AC-EXT-06)', () => {
  it('uncontrolled shows the LineItem; controlled shows the given columns', async () => {
    const { unmount } = render(wrap(<Table contextPath="/Products" rowCountMode="Fixed" />));
    await waitFor(() => expect(screen.getByText('Products (25)')).toBeInTheDocument());
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent?.trim())).toEqual(expect.arrayContaining(['Product Code', 'Product Name', 'Category', 'Price']));
    unmount();
    render(wrap(<Table contextPath="/Products" rowCountMode="Fixed" visibleColumns={['DataField::Name']} />));
    await waitFor(() => expect(screen.getByText('Products (25)')).toBeInTheDocument());
    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent?.trim()).filter(Boolean);
    expect(headers).toEqual(['Product Name']);
  });
  it('shows the "start" text before the query runs', () => {
    render(wrap(<Table contextPath="/Products" rowCountMode="Fixed" query={null} />));
    expect(screen.getByText('To start, set the relevant filters.')).toBeInTheDocument();
  });
});
