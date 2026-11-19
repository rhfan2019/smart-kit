/**
 * Stage 7, the action parameter dialog (FE sap.fe.macros.coreUI.OperationParameterDialog): one field per parameter with
 * the field editor of its type and annotations, defaults (UI.ParameterDefaultValue), the mandatory check and the typed
 * request body. The test service's `reject` has the parameters (apps/mock "reject parameters").
 */
import { MantineProvider } from '@mantine/core';
import { buildModel, MemoryProvider, MemoryVariantStore, type Row } from '@rhfan2019/smart-kit-core';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { SmartKitProvider, smartKitMantineTheme } from '../src';
import ObjectPage from '@rhfan2019/smart-kit/v4/fe/templates/ObjectPage';

beforeAll(() => {
  (window as unknown as { getBoundingClientRect(): Partial<DOMRect> }).getBoundingClientRect = () => ({ top: 0, bottom: 0, height: 0 });
  if (!('fonts' in document)) Object.defineProperty(document, 'fonts', { configurable: true, value: { addEventListener() {}, removeEventListener() {}, ready: Promise.resolve() } });
});

const xml = readFileSync(join(import.meta.dirname, '../../../apps/mock/Csdl/purchasing.template.xml'), 'utf8').replace(/\{\{label:([^}]+)\}\}/g, '$1');
const model = buildModel(xml);
const order = (id: string): Row => ({ PurchaseOrder: id, Description: `Order ${id}`, Supplier: 'S1', ApproveEnabled: true, CloseEnabled: true, Status: 'NEW', OrderDate: '2026-05-06', Currency: 'EUR', NetAmount: '10', '@odata.etag': 'W/"1"' });

function host(reject: (row: Row | undefined, params: Row) => Row | undefined) {
  const provider = new MemoryProvider({
    model,
    data: { PurchaseOrders: [order('1')], PurchaseOrderItems: [], PurchaseOrderTypes: [{ Code: 'NB', Name: 'Standard' }, { Code: 'FO', Name: 'Framework' }] },
    actions: { 'Purchasing.reject': reject },
  });
  return (
    <MantineProvider theme={smartKitMantineTheme}>
      <SmartKitProvider services={{ p: { model, dataProvider: provider, variants: new MemoryVariantStore() } }} locale="en" namespace={`param7${Math.random()}`}>
        <ObjectPage service="p" path="PurchaseOrders('1')" sectionLayout="Page" />
      </SmartKitProvider>
    </MantineProvider>
  );
}
const dialog = () => document.querySelector('[data-sk-action-parameter-dialog]');
const field = (name: string) => document.querySelector(`[data-sk-action-parameter="${name}"]`)!;
const editor = (name: string) => field(name).querySelector('[data-sk-editor]')?.getAttribute('data-sk-editor');

async function openReject(reject = vi.fn((row: Row | undefined) => row)) {
  render(host(reject));
  const button = () => document.querySelector<HTMLButtonElement>('[data-sk-action="DataFieldForAction::Purchasing.reject"]')!;
  await waitFor(() => expect(button().disabled).toBe(false));
  fireEvent.click(button());
  await waitFor(() => expect(dialog()).not.toBeNull());
  return reject;
}

describe('AL-11 param7 the parameter dialog', () => {
  it('AL-11 param7 a field per parameter: label, control by type and annotations, defaults, mandatory marker', async () => {
    await openReject();
    const names = [...document.querySelectorAll('[data-sk-action-parameter]')].map((e) => e.getAttribute('data-sk-action-parameter'));
    expect(names).toEqual(['FollowUpType', 'RejectionNote', 'ReplyBy', 'Priority']);
    expect(['FollowUpType', 'RejectionNote', 'ReplyBy', 'Priority'].map(editor)).toEqual(['select', 'text', 'date', 'number']);
    expect(field('RejectionNote').querySelector('textarea')).not.toBeNull();
    expect(field('FollowUpType').querySelector('label')?.textContent).toContain('P.FollowUpType');
    // UI.ParameterDefaultValue: constant "NB" (the select shows the entry), the order's OrderDate, constant 2
    // the entry as "Text (Key)" (the key property's Common.Text with TextFirst in the value list entity)
    await waitFor(() => expect(field('FollowUpType').querySelector<HTMLInputElement>('input')!.value).toBe('Standard (NB)'));
    expect(field('ReplyBy').querySelector<HTMLInputElement>('input, button')).not.toBeNull();
    expect(field('ReplyBy').textContent + (field('ReplyBy').querySelector<HTMLInputElement>('input')?.value ?? '')).toMatch(/May 6, 2026|2026/);
    expect(field('Priority').querySelector<HTMLInputElement>('input')!.value).toBe('2');
    // Common.FieldControl Mandatory: required; the others are not (Nullable is not read)
    expect(field('RejectionNote').querySelector('textarea')!.required).toBe(true);
    expect(field('Priority').querySelector('input')!.required).toBe(false);
  });
});

describe('AL-10 param7 the request of the parameter dialog', () => {
  it('AL-10 param7 a missing mandatory value blocks the action with a message; then the body carries typed values', async () => {
    const reject = await openReject();
    fireEvent.click(document.querySelector('[data-sk-action-parameter-ok]')!);
    await waitFor(() => expect(field('RejectionNote').textContent).toContain('Enter a value for "P.RejectionNote".'));
    expect(reject).not.toHaveBeenCalled();
    expect(dialog()).not.toBeNull();
    fireEvent.change(field('RejectionNote').querySelector('textarea')!, { target: { value: 'Too expensive' } });
    fireEvent.change(field('Priority').querySelector('input')!, { target: { value: '5' } });
    fireEvent.click(document.querySelector('[data-sk-action-parameter-ok]')!);
    await waitFor(() => expect(reject).toHaveBeenCalled());
    expect(reject.mock.calls[0]![1]).toEqual({ FollowUpType: 'NB', RejectionNote: 'Too expensive', ReplyBy: '2026-05-06', Priority: 5 });
  });

  it('AL-10 param7 a number that is none is not sent', async () => {
    const reject = await openReject();
    fireEvent.change(field('RejectionNote').querySelector('textarea')!, { target: { value: 'x' } });
    fireEvent.change(field('Priority').querySelector('input')!, { target: { value: 'two' } });
    fireEvent.click(document.querySelector('[data-sk-action-parameter-ok]')!);
    await waitFor(() => expect(field('Priority').textContent).toContain('enter a number'));
    expect(reject).not.toHaveBeenCalled();
  });
});
