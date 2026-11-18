import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createRef, type RefObject } from 'react';
import { describe, expect, it, vi } from 'vitest';
import useFilterState from '../src/kit/useFilterState';
import type { FilterStateApi } from '../src/kit/useFilterState';
import useVariants from '../src/kit/useVariants';
import FilterBar, { type $FilterBarSettings } from '../src/v4/fe/macros/FilterBar';
import VariantManagement from '../src/v4/fe/macros/VariantManagement';
import { wrap } from './helpers';

function Bar(p: Omit<$FilterBarSettings, 'state'> & { live?: boolean; onState?(s: FilterStateApi): void }) {
  const state = useFilterState('Products', { autoExecute: false, liveMode: p.live });
  p.onState?.(state);
  return <FilterBar {...p} state={state} />;
}

const field = (path: string) => document.querySelector(`[data-sk-filter="${path}"]`);

describe('FilterBar (sap.fe.macros.FilterBar)', () => {
  it('AL-05 FilterBar: defaults liveMode false (Go shown), showClearButton false, showMessages true', async () => {
    render(wrap(<Bar />));
    expect(await screen.findByRole('button', { name: 'Go' })).toBeTruthy();
    expect(document.querySelector('[data-sk-clear]')).toBeNull();
    // Status is mandatory: clearing it and pressing Go shows the error in a message box
    let s!: FilterStateApi;
    render(wrap(<Bar onState={(x) => { s = x; }} />));
    act(() => s.setConditions('Status', []));
    fireEvent.click(screen.getAllByRole('button', { name: 'Go' })[1]!);
    expect(await screen.findByText('Fill in all mandatory filter fields before running the search.')).toBeTruthy();
  });

  it('AL-05 FilterBar: liveMode hides Go; without state the bar keeps its own state for contextPath', async () => {
    render(wrap(<FilterBar contextPath="/Products" liveMode />));
    expect(await screen.findByText(/^Adapt Filters/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Go' })).toBeNull();
    expect(field('Code')).not.toBeNull();
  });

  it('AL-06 FilterBar: search, filterChanged and afterClear', async () => {
    const onSearch = vi.fn();
    const onFilterChanged = vi.fn();
    const onAfterClear = vi.fn();
    let s!: FilterStateApi;
    render(wrap(<Bar showClearButton onSearch={onSearch} onFilterChanged={onFilterChanged} onAfterClear={onAfterClear} onState={(x) => { s = x; }} />));
    fireEvent.click(await screen.findByRole('button', { name: 'Go' }));
    await waitFor(() => expect(onSearch).toHaveBeenCalledTimes(1));
    act(() => s.setConditions('Code', [{ operator: 'EQ', values: ['P1'] }]));
    await waitFor(() => expect(onFilterChanged).toHaveBeenCalledTimes(1));
    fireEvent.click(document.querySelector('[data-sk-clear]')!);
    expect(onAfterClear).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(s.filters).toEqual({}));
  });

  it('AL-07 FilterBar: setFilterValues, getFilters, getSelectionVariant, setSelectionVariant, triggerSearch', async () => {
    const ref = createRef<FilterBar>() as RefObject<FilterBar>;
    const onSearch = vi.fn();
    let s!: FilterStateApi;
    render(wrap(<Bar ref={ref} onSearch={onSearch} onState={(x) => { s = x; }} />));
    await screen.findByRole('button', { name: 'Go' });
    await act(() => ref.current.setFilterValues('Code', undefined, ['P1', 'P2']));
    await act(() => ref.current.setFilterValues('Price', 'BT', [1, 5]));
    expect(ref.current.getFilters().filters.Code).toEqual([{ operator: 'EQ', values: ['P1'] }, { operator: 'EQ', values: ['P2'] }]);
    act(() => s.setSearch('pen'));
    const sv = await ref.current.getSelectionVariant();
    expect(sv.SelectOptions).toContainEqual({ PropertyName: 'Price', Ranges: [{ Sign: 'I', Option: 'BT', Low: '1', High: '5' }] });
    expect(sv.SelectOptions).toContainEqual({ PropertyName: '$search', Ranges: [{ Sign: 'I', Option: 'EQ', Low: 'pen', High: null }] });
    await act(() => ref.current.setSelectionVariant({ SelectOptions: [{ PropertyName: 'Name', Ranges: [{ Sign: 'E', Option: 'CP', Low: 'Pen*' }] }, { PropertyName: 'Status', Ranges: [{ Sign: 'I', Option: 'EQ', Low: 'A' }] }] }));
    expect(s.filters).toEqual({ Name: [{ operator: 'StartsWith', values: ['Pen'], exclude: true }], Status: [{ operator: 'EQ', values: ['A'] }] });
    await act(async () => { await ref.current.triggerSearch(); });
    expect(s.applied?.filters.Status).toEqual([{ operator: 'EQ', values: ['A'] }]);
    await waitFor(() => expect(onSearch).toHaveBeenCalled());
    expect(ref.current.getActiveFiltersText()).toBe('3 filters active: Search, Product Name, Status');
    // empty mandatory field: triggerSearch rejects
    act(() => s.setConditions('Status', []));
    await expect(ref.current.triggerSearch()).rejects.toThrow();
  });

  it('AL-07 FilterBar: field visibility, enablement, activation, labels and tooltips', async () => {
    const ref = createRef<FilterBar>() as RefObject<FilterBar>;
    render(wrap(<Bar ref={ref} />));
    await screen.findByRole('button', { name: 'Go' });
    expect(await ref.current.getFilterFieldVisible('Code')).toBe(true);
    await act(() => ref.current.setFilterFieldVisible('Code', false));
    expect(field('Code')).toBeNull();
    expect(await ref.current.getFilterFieldVisible('Code')).toBe(false);
    await act(() => ref.current.setFilterFieldVisible('Name', true));
    expect(field('Name')).not.toBeNull();
    act(() => ref.current.setFilterFieldEnabled('Name', false));
    expect(ref.current.getFilterFieldEnabled('Name')).toBe(false);
    expect((field('Name')!.querySelector('input') as HTMLInputElement).disabled).toBe(true);
    await act(() => ref.current.setFilterFieldsLabel([{ conditionPath: 'Name', label: 'Product name' }]));
    await act(() => ref.current.setFilterFieldsTooltip([{ conditionPath: 'Name', tooltip: 'The name' }]));
    expect(field('Name')!.textContent).toContain('Product name');
    expect(field('Name')!.getAttribute('title')).toBe('The name');
    await act(() => ref.current.setFilterFieldsActive([{ conditionPath: 'Name', active: false }]));
    expect(field('Name')).toBeNull();
  });

  it('AL-06 FilterBar: filterFields adds custom fields at their anchor; Adaptation fields are not shown', async () => {
    render(wrap(<Bar filterFields={[
      { key: 'Custom', label: 'Custom field', anchor: 'Code', placement: 'Before', template: (c) => <span data-custom>{c.label}</span> },
      { key: 'Later', label: 'Later', availability: 'Adaptation' },
    ]} />));
    await screen.findByRole('button', { name: 'Go' });
    const ids = [...document.querySelectorAll('.sk-filterbar__field')].map((e) => e.getAttribute('data-sk-filter'));
    expect(ids.slice(0, 2)).toEqual(['Custom', 'Code']);
    expect(ids).not.toContain('Later');
    expect(screen.getByText('Custom field')).toBeTruthy();
  });
});

describe('VariantManagement (sap.fe.macros.VariantManagement)', () => {
  function Views(p: { showSetAsDefault?: boolean; onSelect?(e: unknown): void }) {
    const v = useVariants('vm', { service: 'shop', standard: { filters: {} } });
    return <VariantManagement id="vm1" for={['bar1']} headerLevel="H2" variants={v} content={{ filters: {} }} onSelect={p.onSelect ?? (() => undefined)} showSetAsDefault={p.showSetAsDefault} />;
  }

  it('AL-05 VariantManagement: showSetAsDefault true by default, false hides "Set as default"; headerLevel, id, for', async () => {
    const { unmount } = render(wrap(<Views />));
    fireEvent.click(screen.getByTitle('Select view'));
    fireEvent.click(await screen.findByText('Save As'));
    expect(await screen.findByLabelText('Set as Default')).toBeTruthy();
    unmount();
    render(wrap(<Views showSetAsDefault={false} />));
    expect(document.getElementById('vm1')).not.toBeNull();
    expect(document.getElementById('vm1')!.getAttribute('data-sk-for')).toBe('bar1');
    expect(document.querySelector('[data-sk-variant] h2')).not.toBeNull();
    fireEvent.click(screen.getByTitle('Select view'));
    fireEvent.click(await screen.findByText('Save As'));
    await screen.findByLabelText(/View/);
    expect(screen.queryByLabelText('Set as Default')).toBeNull();
  });

  it('AL-06 VariantManagement: select passes key, content and autoApply', async () => {
    const onSelect = vi.fn();
    render(wrap(<Views onSelect={onSelect} />));
    fireEvent.click(screen.getByTitle('Select view'));
    fireEvent.click(await screen.findByText('Standard', { selector: '[data-sk-variant-item] *, [data-sk-variant-item]' }));
    expect(onSelect).toHaveBeenCalledWith({ key: '', content: { filters: {} }, autoApply: true });
  });
});
