/**
 * Stage 6, object page annotations (docs/29b, docs/29c): actions, sections and header facets of
 * v4/fe/templates/ObjectPage as Fiori elements 1.154 shows them (HeaderAndFooterAction, SubSection, HeaderFacet, Form).
 * The test service's annotations (apps/mock/Csdl/purchasing.template.xml) in a MemoryProvider.
 */
import { MantineProvider } from '@mantine/core';
import { buildModel, MemoryProvider, MemoryVariantStore } from '@rhfan2019/smart-kit-core';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ReactNode } from 'react';
import { beforeAll, describe, expect, it } from 'vitest';
import { SmartKitProvider, smartKitMantineTheme } from '../src';
import ObjectPage from '@rhfan2019/smart-kit/v4/fe/templates/ObjectPage';
import { editableHeaderGroups, isCriticalAction, splitPreview } from '../src/templates/ObjectPage';
import { fieldControlOf, fieldEditState } from '../src/edit/fieldControl';
import { parseLocalDate } from '../src/field/FieldEditor';

beforeAll(() => {
  (window as unknown as { getBoundingClientRect(): Partial<DOMRect> }).getBoundingClientRect = () => ({ top: 0, bottom: 0, height: 0 });
  if (!('fonts' in document)) Object.defineProperty(document, 'fonts', { configurable: true, value: { addEventListener() {}, removeEventListener() {}, ready: Promise.resolve() } });
});

const xml = readFileSync(join(import.meta.dirname, '../../../apps/mock/Csdl/purchasing.template.xml'), 'utf8').replace(/\{\{label:([^}]+)\}\}/g, '$1');
const model = buildModel(xml);
const order = { PurchaseOrder: '1', Description: 'Order', Supplier: 'S1', ApproveEnabled: false, CloseEnabled: true, Status: 'NEW', Currency: 'EUR', NetAmount: '10', '@odata.etag': 'W/"1"' };
const supplier = { Supplier: 'S1', SupplierName: 'Supplier One', IsBlocked: true, Rating: 3, RatingCount: 2 };
const contact = { ContactUUID: '5c0a0001-0d4e-4f00-8a00-000000001eef', ContactID: 'C1', Supplier: 'S1', FullName: 'Jo Doe', Email: 'jo@example.com', Mobile: '1', Iban: 'DE1', City: 'Berlin', Score: '2.0', ResponseRate: '1.0' };

function host(children: ReactNode) {
  const provider = new MemoryProvider({ model, data: { PurchaseOrders: [{ ...order }], Suppliers: [{ ...supplier }], SupplierContacts: [{ ...contact }] } });
  return (
    <MantineProvider theme={smartKitMantineTheme}>
      <SmartKitProvider services={{ p: { model, dataProvider: provider, variants: new MemoryVariantStore() } }} locale="en" namespace="op6">
        {children}
      </SmartKitProvider>
    </MantineProvider>
  );
}
const btn = (sel: string) => document.querySelector<HTMLButtonElement>(sel);
const footer = () => [...document.querySelectorAll<HTMLButtonElement>('[data-sk-footer] button')].map((b) => `${b.textContent?.trim()}${b.disabled ? ' [disabled]' : ''}`).filter((t) => t && !/^\d+$/.test(t));

describe('AL-11 op6 actions (FE HeaderAndFooterAction)', () => {
  it('AL-11 op6 determining actions are in the footer in display mode, disabled while OperationAvailable is false; header actions stay while editing', async () => {
    render(host(<ObjectPage service="p" path="PurchaseOrders('1')" sectionLayout="Page" />));
    await waitFor(() => expect(document.querySelector('[data-sk-heading]')?.textContent).toBe('1'));
    await waitFor(() => expect(footer()).toEqual(['A.Approve [disabled]', 'A.Reject [disabled]']));
    expect(btn('[data-sk-action="DataFieldForAction::Purchasing.close"]')!.disabled).toBe(false);
    fireEvent.click(btn('[data-sk-action="Edit"]')!);
    await waitFor(() => expect(btn('[data-sk-save]')).not.toBeNull());
    expect(footer()).toEqual(['Save', 'A.Approve [disabled]', 'A.Reject [disabled]', 'Cancel']);
    expect(btn('[data-sk-action="DataFieldForAction::Purchasing.close"]')).not.toBeNull();
    // the page's Delete (not the sub-table's) is hidden while editing the object page
    expect([...document.querySelectorAll('[data-sk-action="Delete"]')].filter((b) => !b.closest('[data-sk-table]'))).toEqual([]);
  });
  it('AL-11 op6 critical actions first (VeryPositive, Positive, Negative, VeryNegative constants)', () => {
    const a = model.ui['Purchasing.PurchaseOrder']!.objectActions[0]!;
    expect(isCriticalAction({ ...a, criticality: { value: 1 } })).toBe(true);
    expect(isCriticalAction({ ...a, criticality: { value: 2 } })).toBe(false);
    expect(isCriticalAction({ ...a, criticality: { path: 'C' } })).toBe(false);
  });
});

describe('AL-11 op6 sections, forms and header facets', () => {
  it('AL-11 op6 UI.Hidden path hides the sub-section; contact and collection header facets; Show More / Show Details', async () => {
    render(host(<ObjectPage service="p" path="SupplierContacts(5c0a0001-0d4e-4f00-8a00-000000001eef)" />));
    await waitFor(() => expect(document.querySelector('[data-sk-heading]')?.textContent).toBe('Jo Doe'));
    await waitFor(() => expect(document.querySelector('[data-sk-subsection="ContactLast"]')).not.toBeNull());
    expect(document.querySelector('[data-sk-subsection="ContactSupplier"]')).toBeNull();
    expect([...document.querySelectorAll('.sk-object-header__facets > [data-sk-facet]')].map((f) => f.getAttribute('data-sk-facet'))).toEqual(['HeaderContact', 'HeaderPerformance']);
    expect(document.querySelector('[data-sk-field-path="Mobile"]')).toBeNull();
    fireEvent.click(document.querySelector('[data-sk-form-details="ContactReach"]')!);
    await waitFor(() => expect(document.querySelector('[data-sk-field-path="Mobile"]')).not.toBeNull());
  });
  it('AL-11 op6 splitPreview and the editable header groups (title, description, header facet fields, no charts)', () => {
    expect(splitPreview([{ id: 'a', fields: [] }, { id: 'b', fields: [], partOfPreview: false }]).more.map((g) => g.id)).toEqual(['b']);
    const ui = model.ui['Purchasing.PurchaseOrder']!;
    expect(editableHeaderGroups(ui, (p) => p).map((g) => g.id)).toEqual(['HeaderInfo', 'HeaderGeneral', 'HeaderNetAmount', 'HeaderDelivery', 'HeaderRating', 'HeaderNotes']);
  });
});

describe('AL-13 op6 section settings', () => {
  it('AL-13 op6 useSingleTextAreaFieldAsNotes: the single multi-line field of a container has no label', async () => {
    render(host(<ObjectPage service="p" path="PurchaseOrders('1')" content={{ body: { sections: { NotesSection: { useSingleTextAreaFieldAsNotes: true } } } }} />));
    await waitFor(() => expect(document.querySelector('[data-sk-subsection="NotesSection"] [data-sk-show-more]')).not.toBeNull());
    fireEvent.click(document.querySelector('[data-sk-subsection="NotesSection"] [data-sk-show-more]')!);
    await waitFor(() => expect(document.querySelector('[data-sk-subsection="NotesSection"] [data-sk-field-path="Notes"]')).not.toBeNull());
    expect(document.querySelector('[data-sk-subsection="NotesSection"] [data-sk-field-path="Notes"] .sk-form__label')?.textContent).toBe('');
  });
});

describe('AL-12 op6 field control and edit values', () => {
  it('AL-12 op6 Common.FieldControl path: 1 read-only, 0 disabled, 7 mandatory', () => {
    const prop = { ...model.entityTypes['Purchasing.PurchaseOrder']!.properties.Description!, fieldControl: { path: 'FC' } };
    expect(fieldControlOf(prop, { FC: 7 })).toBe(7);
    expect(fieldEditState(prop, { FC: 1 }, false)).toEqual({ editable: false, disabled: false, required: false });
    expect(fieldEditState(prop, { FC: 0 }, false)).toEqual({ editable: true, disabled: true, required: false });
    expect(fieldEditState(prop, { FC: 7 }, false).required).toBe(true);
  });
  it('AL-12 op6 dates are edited in the medium style', () => {
    expect(parseLocalDate('Oct 2, 2026', 'en-US')).toBe('2026-10-02');
    expect(parseLocalDate('2026年10月2日', 'zh-CN')).toBe('2026-10-02');
    expect(parseLocalDate('2026-10-02', 'en-US')).toBe('2026-10-02');
    expect(parseLocalDate('nope', 'en-US')).toBeNull();
  });
});
