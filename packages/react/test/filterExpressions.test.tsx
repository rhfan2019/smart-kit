/** P2-LR-19: Capabilities.FilterExpressionRestrictions shape the filter field and the value help. */
import { MantineProvider } from '@mantine/core';
import { MemoryProvider, MemoryVariantStore, type Condition, type FilterExpression, type MetaModel } from '@rhfan2019/smart-kit-core';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ConditionInput, SmartKitProvider, smartKitMantineTheme, ValueHelpDialog } from '../src';
import { shopData, shopModel } from './helpers';

function restricted(expressions: Record<string, FilterExpression>): MetaModel {
  const set = shopModel.entitySets.Products!;
  return {
    ...shopModel,
    entitySets: { ...shopModel.entitySets, Products: { ...set, capabilities: { ...set.capabilities, filterExpressions: expressions } } },
  };
}

function withModel(model: MetaModel, children: React.ReactNode) {
  const provider = new MemoryProvider({ model, data: shopData });
  return (
    <MantineProvider theme={smartKitMantineTheme}>
      <SmartKitProvider services={{ shop: { model, dataProvider: provider, variants: new MemoryVariantStore() } }} locale="en" namespace="test">
        {children}
      </SmartKitProvider>
    </MantineProvider>
  );
}

function Field({ path, onChange }: { path: string; onChange(c: Condition[]): void }) {
  const [conditions, setConditions] = useState<Condition[]>([]);
  return <ConditionInput entitySet="Products" path={path} label={path} conditions={conditions} onChange={(c) => { setConditions(c); onChange(c); }} />;
}

describe('FilterExpressionRestrictions (P2-LR-19)', () => {
  it('P2-LR-19 MultiValue: a range is refused with a hint, a value is accepted', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(withModel(restricted({ Code: 'MultiValue' }), <Field path="Code" onChange={onChange} />));
    const input = screen.getAllByLabelText('Code').find((e) => e.tagName === 'INPUT' && (e as HTMLInputElement).type !== 'hidden')!;
    await user.clear(input);
    await user.type(input, 'P1...P5{Enter}');
    expect(await screen.findByText('Enter values only, without ranges or exclusions.')).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalledWith([expect.objectContaining({ operator: 'BT' })]);
    await user.clear(input);
    await user.type(input, 'P1{Enter}');
    expect(onChange).toHaveBeenLastCalledWith([{ operator: 'EQ', values: ['P1'] }]);
  });

  it('P2-LR-19 SearchExpression: plain text becomes "contains"', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(withModel(restricted({ Name: 'SearchExpression' }), <Field path="Name" onChange={onChange} />));
    const input = screen.getAllByLabelText('Name').find((e) => e.tagName === 'INPUT' && (e as HTMLInputElement).type !== 'hidden')!;
    await user.clear(input);
    await user.type(input, 'pen{Enter}');
    expect(onChange).toHaveBeenLastCalledWith([{ operator: 'Contains', values: ['pen'] }]);
  });

  it('P2-LR-19 value help: no Exclude for MultiValue; no Search and Select tab for SearchExpression; one condition for SingleRange', () => {
    const dialog = (path: string, model: MetaModel) =>
      render(withModel(model, <ValueHelpDialog opened entitySet="Products" path={path} title={path} conditions={[]} onOk={() => undefined} onCancel={() => undefined} />));
    const a = dialog('CategoryID', restricted({ CategoryID: 'MultiValue' }));
    expect(screen.getByRole('tab', { name: 'Search and Select' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Define Conditions' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add condition' }));
    expect(screen.queryByText('Exclude')).toBeNull();
    a.unmount();
    const b = dialog('CategoryID', restricted({ CategoryID: 'SearchExpression' }));
    expect(screen.queryByRole('tab', { name: 'Search and Select' })).toBeNull();
    b.unmount();
    dialog('Price', restricted({ Price: 'SingleRange' }));
    const add = screen.getByRole('button', { name: 'Add condition' });
    fireEvent.click(add);
    expect(screen.getByRole('button', { name: 'Add condition' })).toBeDisabled();
  });
});
