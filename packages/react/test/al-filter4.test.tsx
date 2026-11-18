/** Stage 4 filter bar annotations in the filter fields (docs/29 §5 筛选栏和值帮助, AL-10 – AL-12). */
import { MantineProvider } from '@mantine/core';
import { MemoryProvider, MemoryVariantStore, type FilterExpression, type MetaModel } from '@rhfan2019/smart-kit-core';
import { fireEvent, render, renderHook, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { SmartKitProvider, smartKitMantineTheme } from '../src';
import useFilterState from '@rhfan2019/smart-kit/kit/useFilterState';
import ConditionInput from '@rhfan2019/smart-kit/kit/ConditionInput';
import { shopData, shopModel } from './helpers';

function withModel(model: MetaModel) {
  const provider = new MemoryProvider({ model, data: shopData });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MantineProvider theme={smartKitMantineTheme}>
        <SmartKitProvider services={{ shop: { model, dataProvider: provider, variants: new MemoryVariantStore() } }} locale="en" namespace="test">
          {children}
        </SmartKitProvider>
      </MantineProvider>
    );
  };
}

function variant(change: (m: MetaModel) => void, expressions: Record<string, FilterExpression> = {}): MetaModel {
  const m = structuredClone(shopModel) as MetaModel;
  const set = m.entitySets.Products!;
  set.capabilities.filterExpressions = { ...set.capabilities.filterExpressions, ...expressions };
  change(m);
  return m;
}

describe('AL-10 AL-11 stage 4 filter fields (docs/29 §5)', () => {
  it('AL-11 P2 SingleValue date: FE single-value semantic dates (today, first date of this week …)', async () => {
    const onChange = vi.fn();
    const Wrapper = withModel(variant(() => undefined, { ReleaseDate: 'SingleValue' }));
    render(<Wrapper><ConditionInput entitySet="Products" path="ReleaseDate" conditions={[]} onChange={onChange} label="Release" /></Wrapper>);
    fireEvent.click(screen.getByRole('button', { name: 'Relative dates' }));
    expect(await screen.findByRole('button', { name: 'First Date of This Week', hidden: true })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'This month', hidden: true })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Today', hidden: true }));
    expect(onChange).toHaveBeenLastCalledWith([{ operator: 'TODAY', values: [] }]);
  });

  it('AL-11 P2 SingleRange date: FE semantic operators with values (Last X weeks)', async () => {
    const onChange = vi.fn();
    const Wrapper = withModel(variant(() => undefined, { ReleaseDate: 'SingleRange' }));
    render(<Wrapper><ConditionInput entitySet="Products" path="ReleaseDate" conditions={[]} onChange={onChange} label="Release" /></Wrapper>);
    fireEvent.click(screen.getByRole('button', { name: 'Relative dates' }));
    await screen.findByRole('button', { name: 'Last 7 weeks', hidden: true });
    const count = document.querySelector('input[data-sk-relative-count="LASTWEEKS"]') as HTMLInputElement;
    fireEvent.change(count, { target: { value: '2' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Last 2 weeks', hidden: true }));
    expect(onChange).toHaveBeenLastCalledWith([{ operator: 'LASTWEEKS', values: [2] }]);
  });

  it('AL-12 P2 filter tokens with TextSeparate show the code only (FE FilterFieldTemplating)', () => {
    const Wrapper = withModel(variant((m) => { m.entityTypes['Shop.Product']!.properties.CategoryID!.textArrangement = 'TextSeparate'; }));
    render(<Wrapper><ConditionInput entitySet="Products" path="CategoryID" conditions={[{ operator: 'EQ', values: ['C1'], text: 'Office' }]} onChange={() => undefined} label="Category" /></Wrapper>);
    expect(screen.getByText('C1')).toBeInTheDocument();
    expect(screen.queryByText('Office (C1)')).toBeNull();
  });

  it('AL-11 P2 UI.HiddenFilter with a default condition: no field, the condition filters; UI.Hidden: the condition is dropped', () => {
    const model = variant((m) => {
      const props = m.entityTypes['Shop.Product']!.properties;
      props.Currency!.hiddenFilter = true;
      props.Notes!.hidden = true;
      m.ui['Shop.Product']!.selectionVariant = [
        ...m.ui['Shop.Product']!.selectionVariant,
        { path: 'Currency', exclude: false, operator: 'EQ', values: ['EUR'] },
        { path: 'Notes', exclude: false, operator: 'EQ', values: ['x'] },
      ];
    });
    const { result } = renderHook(() => useFilterState('Products', { service: 'shop' }), { wrapper: withModel(model) });
    expect(result.current.filters.Currency).toEqual([{ operator: 'EQ', values: ['EUR'], exclude: undefined }]);
    expect(result.current.fields).not.toContain('Currency');
    expect(result.current.filters.Notes).toBeUndefined();
    expect(result.current.fields).not.toContain('Notes');
  });
});
