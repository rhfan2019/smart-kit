import { act, fireEvent, render, screen } from '@testing-library/react';
import { createRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { Row } from '@rhfan2019/smart-kit-core';
import Field, { type Field$ChangeEvent } from '../src/v4/fe/macros/Field';
import Form from '../src/v4/fe/macros/Form';
import { shopData, wrap } from './helpers';

const row: Row = { ...shopData.Products![1]!, _Category: { Name: 'Office' } };

describe('Field: contextPath, metaPath, readOnly, value, description, formatOptions (AL-05)', () => {
  it('AL-05 Field: readOnly not set shows the formatted value; readOnly false shows the editor', () => {
    const { rerender } = render(wrap(<span data-testid="f"><Field contextPath="/Products" metaPath="Name" row={row} /></span>));
    expect(screen.getByTestId('f').textContent).toBe('Item 2');
    expect(screen.getByTestId('f').querySelector('input')).toBeNull();
    rerender(wrap(<span data-testid="f"><Field contextPath="/Products" metaPath="Name" row={row} readOnly={false} aria-label="Name" /></span>));
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Item 2');
  });
  it('AL-05 Field: metaPath to a data point; contextPath through a navigation', () => {
    render(wrap(<>
      <span data-testid="dp"><Field contextPath="/Products" metaPath="@com.sap.vocabularies.UI.v1.DataPoint#Stock" row={row} /></span>
      <span data-testid="nav"><Field contextPath="/Products/_Category" metaPath="Name" row={{ Name: 'Office' }} /></span>
    </>));
    expect(screen.getByTestId('dp').textContent).toBe('12');
    expect(screen.getByTestId('dp').querySelector('.sk-status--positive')).not.toBeNull();
    expect(screen.getByTestId('nav').textContent).toBe('Office');
  });
  it('AL-05 Field: value and description replace what the row has', () => {
    render(wrap(<span data-testid="f"><Field contextPath="/Products" metaPath="CategoryID" row={row} value="C9" description="Toys" /></span>));
    expect(screen.getByTestId('f').textContent).toBe('Toys (C9)');
  });
  it('AL-05 Field: formatOptions displayMode and measureDisplayMode', () => {
    render(wrap(<>
      <span data-testid="v"><Field contextPath="/Products" metaPath="CategoryID" row={row} formatOptions={{ displayMode: 'Value' }} /></span>
      <span data-testid="vd"><Field contextPath="/Products" metaPath="CategoryID" row={row} formatOptions={{ displayMode: 'ValueDescription' }} /></span>
      <span data-testid="u"><Field contextPath="/Products" metaPath="Price" row={row} formatOptions={{ measureDisplayMode: 'Hidden' }} /></span>
    </>));
    expect(screen.getByTestId('v').textContent).toBe('C1');
    expect(screen.getByTestId('vd').textContent).toBe('C1 (Office)');
    expect(screen.getByTestId('u').textContent).toBe('11.50');
  });
});

describe('Field: change and liveChange (AL-06)', () => {
  it('AL-06 Field: liveChange fires while typing; change gets { value, isValid } only when committed (blur, Enter)', () => {
    const changes: Field$ChangeEvent[] = [];
    const live = vi.fn();
    render(wrap(<Field contextPath="/Products" metaPath="Price" row={row} readOnly={false} aria-label="Price" onChange={(e) => changes.push(e)} onLiveChange={live} />));
    const input = screen.getByLabelText('Price') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '12' } });
    fireEvent.change(input, { target: { value: '12.5' } });
    expect(changes).toEqual([]);
    expect(live).toHaveBeenCalledTimes(2);
    expect(live.mock.calls[1]![0]).toEqual({ value: '12.5' });
    expect(input.value).toBe('12.5');
    fireEvent.blur(input);
    fireEvent.change(input, { target: { value: 'abc' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(changes).toEqual([{ value: '12.5', isValid: true }, { value: 'abc', isValid: false }]);
  });
  it('AL-06 Field: required comes from the annotations (Common.FieldControl Mandatory)', () => {
    render(wrap(<Field contextPath="/Products" metaPath="Name" row={row} readOnly={false} aria-label="Name" />));
    // Name is not mandatory in the shop model
    expect((screen.getByLabelText('Name') as HTMLInputElement).required).toBe(false);
  });
});

describe('Field: ref methods (AL-07)', () => {
  it('AL-07 Field: getValue, setValue, getEnabled, setEnabled, getMainPropertyAbsolutePath', () => {
    const ref = createRef<Field>();
    render(wrap(<Field ref={ref} contextPath="/Products" metaPath="Name" row={row} readOnly={false} aria-label="Name" />));
    expect(ref.current!.getValue()).toBe('Item 2');
    expect(ref.current!.getMainPropertyAbsolutePath()).toBe('/Products/Name');
    act(() => ref.current!.setValue('Other'));
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Other');
    expect(ref.current!.getValue()).toBe('Other');
    expect(ref.current!.getEnabled()).toBe(true);
    act(() => ref.current!.setEnabled(false));
    expect((screen.getByLabelText('Name') as HTMLInputElement).disabled).toBe(true);
    expect(ref.current!.getEnabled()).toBe(false);
  });
  it('AL-07 Field: addMessage shows the message at the editor, removeMessage removes it; getMessageManager outside a MessageProvider is null', () => {
    const ref = createRef<Field>();
    render(wrap(<Field ref={ref} contextPath="/Products" metaPath="Name" row={row} readOnly={false} aria-label="Name" />));
    let id = '';
    act(() => { id = ref.current!.addMessage({ message: 'Name is taken' }); });
    expect(screen.getByText('Name is taken')).toBeInTheDocument();
    act(() => ref.current!.removeMessage(id));
    expect(screen.queryByText('Name is taken')).toBeNull();
    expect(ref.current!.getMessageManager()).toBeNull();
  });
});

describe('Form: contextPath, metaPath, title, visible, layout (AL-05)', () => {
  it('AL-05 Form: metaPath to a field group, a facet id; title; visible false renders nothing', () => {
    const { container, rerender } = render(wrap(<Form contextPath="/Products" metaPath="@UI.FieldGroup#General" row={row} title="Product" />));
    expect(screen.getByRole('heading', { name: 'Product' })).toBeInTheDocument();
    expect([...container.querySelectorAll('[data-sk-field-path]')].map((e) => e.getAttribute('data-sk-field-path'))).toEqual(['Code', 'Name', 'CategoryID']);
    // a single container: no container title (FE)
    expect(screen.queryByRole('heading', { name: 'General' })).toBeNull();
    rerender(wrap(<Form contextPath="/Products" metaPath="GeneralInfo" row={row} />));
    expect(container.querySelectorAll('[data-sk-group]')).toHaveLength(2);
    expect(screen.getByRole('heading', { name: 'General' })).toBeInTheDocument();
    rerender(wrap(<Form contextPath="/Products" metaPath="GeneralInfo" row={row} visible={false} />));
    expect(container.querySelector('.sk-form')).toBeNull();
  });
  it('AL-05 Form: layout columns are passed to the column layout', () => {
    const { container } = render(wrap(<Form contextPath="/Products" metaPath="@UI.FieldGroup#General" row={row} layout={{ columnsM: 2, columnsXL: 4 }} />));
    const style = (container.querySelector('.sk-form') as HTMLElement).style;
    expect(style.getPropertyValue('--sk-form-cols-m')).toBe('2');
    expect(style.getPropertyValue('--sk-form-cols-xl')).toBe('4');
  });
  it('AL-06 Form: readOnly false edits; change gets { path, value }', () => {
    function Edit() {
      const [values, setValues] = useState<Row>({});
      return <Form contextPath="/Products" metaPath="@UI.FieldGroup#General" row={row} readOnly={false} values={values} onChange={(e) => setValues((v) => ({ ...v, [e.path]: e.value }))} />;
    }
    render(wrap(<Edit />));
    const input = screen.getByLabelText('Product Name') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'New name' } });
    expect(input.value).toBe('New name');
  });
});
