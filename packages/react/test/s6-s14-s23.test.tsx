/** S6 relative dates in filter fields, S14 UI.TextArrangement of value list values, S23 FCL column separator. */
import { createText } from '../src';
import FlexibleColumnLayout from '../src/f/FlexibleColumnLayout';
import { fclArrows, type LayoutType } from '../src/layout/FlexibleColumnLayout';
import { valueListTextArrangement, type Condition, type MetaModel, type TextArrangement } from '@rhfan2019/smart-kit-core';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { conditionText } from '../src';
import ConditionInput from '@rhfan2019/smart-kit/kit/ConditionInput';
import { MantineProvider } from '@mantine/core';
import { MemoryProvider, MemoryVariantStore } from '@rhfan2019/smart-kit-core';
import { SmartKitProvider, smartKitMantineTheme } from '../src';
import { shopData, shopModel, wrap } from './helpers';

function withModel(model: MetaModel, children: React.ReactNode) {
  return (
    <MantineProvider theme={smartKitMantineTheme}>
      <SmartKitProvider services={{ shop: { model, dataProvider: new MemoryProvider({ model, data: shopData }), variants: new MemoryVariantStore() } }} locale="en" namespace="test">
        {children}
      </SmartKitProvider>
    </MantineProvider>
  );
}

function Field({ path, initial = [], onChange }: { path: string; initial?: Condition[]; onChange(c: Condition[]): void }) {
  const [conditions, setConditions] = useState<Condition[]>(initial);
  return <ConditionInput entitySet="Products" path={path} label={path} conditions={conditions} onChange={(c) => { setConditions(c); onChange(c); }} />;
}

/** shopModel with Status values described by the category name, in the given text arrangement. */
function statusModel(arrangement: TextArrangement | undefined): MetaModel {
  const typeName = shopModel.entitySets.Products!.typeName;
  const et = shopModel.entityTypes[typeName]!;
  const status = et.properties.Status!;
  return {
    ...shopModel,
    entityTypes: {
      ...shopModel.entityTypes,
      [typeName]: { ...et, properties: { ...et.properties, Status: { ...status, textArrangement: arrangement, valueList: { ...status.valueList!, descriptionProperty: 'Name', parameters: [...status.valueList!.parameters, { kind: 'DisplayOnly', valueListProperty: 'Name' }] } } } },
    },
  };
}

describe('relative dates in filter fields (S6)', () => {
  it('the relative dates button sets a relative condition; its token reads "This month"', async () => {
    const onChange = vi.fn();
    render(wrap(<Field path="ReleaseDate" onChange={onChange} />));
    fireEvent.click(screen.getByRole('button', { name: 'Relative dates' }));
    fireEvent.click(await screen.findByRole('button', { name: 'This month' }));
    expect(onChange).toHaveBeenLastCalledWith([{ operator: 'THISMONTH', values: [] }]);
    expect(await screen.findByText('This month')).toBeInTheDocument();
  });

  it('"last X days" takes the number of days', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(wrap(<Field path="ChangedAt" onChange={onChange} />));
    await user.click(screen.getByRole('button', { name: 'Relative dates' }));
    const days = (await screen.findAllByLabelText('Number of days'))[0]!;
    fireEvent.change(days, { target: { value: '30' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Last 30 days', hidden: true }));
    expect(onChange).toHaveBeenLastCalledWith([{ operator: 'LASTDAYS', values: [30] }]);
  });

  it('non-date fields have no relative dates', () => {
    render(wrap(<Field path="Name" onChange={() => undefined} />));
    expect(screen.queryByRole('button', { name: 'Relative dates' })).toBeNull();
  });

  it('conditionText: localized relative dates, the operator name without texts', () => {
    const zh = createText('zh');
    const en = createText('en');
    expect(conditionText({ operator: 'LASTDAYS', values: [7] }, undefined, 'en-US', undefined, { t: en })).toBe('Last 7 days');
    expect(conditionText({ operator: 'THISQUARTER', values: [], exclude: true }, undefined, 'zh-CN', undefined, { t: zh })).toBe('!(本季度)');
    expect(conditionText({ operator: 'TODAY', values: [] }, undefined, 'en-US')).toBe('TODAY');
  });
});

describe('UI.TextArrangement of value list values (S14)', () => {
  it('conditionText follows the arrangement of a selected value', () => {
    const c: Condition = { operator: 'EQ', values: ['A'], text: 'Active' };
    expect(conditionText(c, undefined, 'en-US')).toBe('Active (A)');
    expect(conditionText(c, undefined, 'en-US', undefined, { textArrangement: 'TextOnly' })).toBe('Active');
    expect(conditionText(c, undefined, 'en-US', undefined, { textArrangement: 'TextLast' })).toBe('A (Active)');
  });

  it("valueListTextArrangement: the property's, else the value list key property's", () => {
    const prop = (m: MetaModel, name: string) => m.entityTypes[m.entitySets.Products!.typeName]!.properties[name];
    expect(valueListTextArrangement(shopModel, prop(shopModel, 'CategoryID'))).toBe('TextFirst');
    expect(valueListTextArrangement(statusModel('TextOnly'), prop(statusModel('TextOnly'), 'Status'))).toBe('TextOnly');
    expect(valueListTextArrangement(shopModel, prop(shopModel, 'Name'))).toBeUndefined();
  });

  it.each([
    ['TextOnly', 'Office'],
    ['TextLast', 'C1 (Office)'],
    [undefined, 'Office (C1)'],
  ] as const)('fixed values with %s read "%s", in the dropdown and in the token', async (arrangement, label) => {
    const user = userEvent.setup();
    const model = statusModel(arrangement);
    const onChange = vi.fn();
    render(withModel(model, <Field path="Status" onChange={onChange} />));
    const input = screen.getAllByLabelText('Status').find((e) => e.tagName === 'INPUT' && (e as HTMLInputElement).type !== 'hidden')!;
    await user.click(input);
    await user.click(await screen.findByRole('option', { name: label, hidden: true }));
    expect(onChange).toHaveBeenLastCalledWith([{ operator: 'EQ', values: ['C1'], text: 'Office' }]);
    expect(await screen.findByText(label, { selector: '.mantine-Pill-label, [class*=Pill] *' })).toBeInTheDocument();
  });
});

describe('FCL column separator (S23)', () => {
  it('fclArrows switches between the UI5 ratios', () => {
    expect(fclArrows('TwoColumnsMidExpanded', false)[0]?.layout).toBe('TwoColumnsBeginExpanded');
    expect(fclArrows('TwoColumnsBeginExpanded', false)[0]?.layout).toBe('TwoColumnsMidExpanded');
    expect(fclArrows('ThreeColumnsMidExpanded', true).map((a) => a?.layout)).toEqual(['ThreeColumnsBeginExpandedEndHidden', 'ThreeColumnsEndExpanded']);
    expect(fclArrows('ThreeColumnsEndExpanded', true).map((a) => a?.layout)).toEqual([undefined, 'ThreeColumnsMidExpanded']);
    expect(fclArrows('ThreeColumnsMidExpandedEndHidden', true)[1]?.layout).toBe('ThreeColumnsMidExpanded');
    expect(fclArrows('ThreeColumnsMidExpanded', false)[1]).toBeUndefined();
    for (const l of ['OneColumn', 'MidColumnFullScreen', 'EndColumnFullScreen'] as LayoutType[]) expect(fclArrows(l, true)).toEqual([undefined, undefined]);
  });

  it('the arrow asks the host for the new layout (controlled) and the widths follow the layout', () => {
    const onLayoutChange = vi.fn();
    const ui = (layout: LayoutType) => wrap(<FlexibleColumnLayout layout={layout} separatorArrows onStateChange={(e) => onLayoutChange(e.layout)} beginColumnPages={<p>list</p>} midColumnPages={<p>object</p>} />);
    const { container, rerender } = render(ui('TwoColumnsMidExpanded'));
    expect(container.querySelector('[data-sk-fcl-separator="1"]')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Expand the first column' }));
    expect(onLayoutChange).toHaveBeenCalledWith('TwoColumnsBeginExpanded');
    // nothing changes until the host passes the new layout
    expect(container.querySelector('[data-sk-fcl-column="0"]')).toHaveAttribute('data-width', '33');
    rerender(ui('TwoColumnsBeginExpanded'));
    expect(container.querySelector('[data-sk-fcl-column="0"]')).toHaveAttribute('data-width', '67');
    fireEvent.click(screen.getByRole('button', { name: 'Expand the second column' }));
    expect(onLayoutChange).toHaveBeenLastCalledWith('TwoColumnsMidExpanded');
    rerender(ui('MidColumnFullScreen'));
    expect(container.querySelector('[data-sk-fcl-separator]')).toBeNull();
  });
});

describe('theme attributes (S7)', () => {
  it('each theme and density has a data-sk-* selector; the former data-theme / data-density only apply without data-sk-* on the root', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const css = readFileSync(join(import.meta.dirname, '../src/theme/tokens.css'), 'utf8');
    for (const theme of ['yellow', 'navy', 'sky', 'dark']) {
      expect(css).toContain(`[data-sk-theme='${theme}'],\n[data-theme='${theme}']:where(:root:not([data-sk-theme]), :root:not([data-sk-theme]) *) {`);
    }
    for (const density of ['comfortable', 'compact']) {
      expect(css).toContain(`[data-sk-density='${density}'],\n[data-density='${density}']:where(:root:not([data-sk-density]), :root:not([data-sk-density]) *) {`);
    }
    // no unguarded legacy selector is left
    expect(css.match(/^\[data-(theme|density)='\w+'\](?!:where)/gm)).toBeNull();
  });
});
