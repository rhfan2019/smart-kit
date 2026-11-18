/**
 * Stage 6, object page annotations (docs/29b, docs/29c): sections, sub-sections, header facets, actions and the object
 * request as Fiori elements 1.154 builds them (converters ObjectPage/SubSection, HeaderFacet, Form, HeaderAndFooterAction).
 * The test service's annotations (apps/mock/Csdl/purchasing.template.xml, labels as their keys).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildModel, buildObjectRequest, readQueryString } from '../src';

const xml = readFileSync(join(import.meta.dirname, '../../../apps/mock/Csdl/purchasing.template.xml'), 'utf8').replace(/\{\{label:([^}]+)\}\}/g, '$1');
const model = buildModel(xml);
const order = model.ui['Purchasing.PurchaseOrder']!;
const item = model.ui['Purchasing.PurchaseOrderItem']!;
const contact = model.ui['Purchasing.SupplierContact']!;
const subIds = (ui: typeof order) => ui.sections.map((s) => [s.id, s.subSections.map((x) => x.id)]);

describe('AL-11 op6 sections and sub-sections (FE SubSection createSubSections)', () => {
  it('AL-11 op6 a collection facet of reference facets is one sub-section: a form with a container per facet', () => {
    expect(subIds(order)).toEqual([['GeneralInformation', ['GeneralInformation']], ['Items', ['Items']], ['NotesSection', ['NotesSection']]]);
    const c = order.sections[0]!.subSections[0]!.content;
    expect(c.kind === 'form' ? c.groups.map((g) => g.id) : []).toEqual(['GeneralData', 'AmountData']);
  });
  it('AL-11 op6 a collection facet with a table and a field group is a mixed sub-section, the table first', () => {
    const pricing = item.sections.find((s) => s.id === 'Pricing')!;
    expect(pricing.subSections.map((x) => x.id)).toEqual(['Pricing']);
    const c = pricing.subSections[0]!.content;
    expect(c.kind).toBe('mixed');
    expect(c.kind === 'mixed' ? c.parts.map((p) => p.content.kind) : []).toEqual(['table', 'form']);
  });
  it('AL-11 op6 a collection facet with a nested collection facet has a sub-section per child; UI.Hidden: true drops, a path is kept', () => {
    expect(subIds(contact)).toEqual([['ContactData', ['ContactData']], ['ContactActivity', ['ContactLast', 'ContactSupplier']]]);
    expect(contact.sections[1]!.subSections[1]!.hidden).toBe('_Supplier/IsBlocked');
  });
  it('AL-11 op6 UI.PartOfPreview false: the container is behind "Show More", a field behind "Show Details"; a data point is a form element', () => {
    const c = contact.sections[0]!.subSections[0]!.content;
    if (c.kind !== 'form') throw new Error('form expected');
    expect(c.groups.map((g) => [g.id, g.partOfPreview])).toEqual([['ContactReach', undefined], ['ContactScore', undefined], ['ContactBanking', false]]);
    expect(c.groups[0]!.fields.find((f) => f.path === 'Mobile')!.partOfPreview).toBe(false);
    expect(c.groups[1]!.fields[0]!.kind).toBe('dataPoint');
  });
});

describe('AL-11 op6 header facets (FE HeaderFacet)', () => {
  it('AL-11 op6 contact facet, collection facet of data points, a statically hidden facet is left out', () => {
    expect(contact.headerFacets.map((f) => [f.id, f.kind])).toEqual([['HeaderContact', 'contact'], ['HeaderPerformance', 'collection']]);
    const col = contact.headerFacets[1]!;
    expect(col.kind === 'collection' ? col.facets.map((f) => f.kind) : []).toEqual(['dataPoint', 'dataPoint']);
  });
});

describe('AL-10 op6 object request', () => {
  it('AL-10 op6 DV-FE-02: not the ETag property; UI.Hidden paths of facets are selected', () => {
    const q = readQueryString(buildObjectRequest(model, 'Purchasing.PurchaseOrder', order));
    expect(q).not.toMatch(/Version/);
    expect(readQueryString(buildObjectRequest(model, 'Purchasing.SupplierContact', contact))).toMatch(/_Supplier\(\$select=[^)]*IsBlocked/);
  });
  it('AL-11 op6 identification actions: determining ones for the footer, UI.UpdateHidden / DeleteHidden modelled', () => {
    expect(order.objectActions.map((a) => [a.name, a.determining])).toEqual([['approve', true], ['reject', true], ['close', false]]);
    expect(model.entitySets.PurchaseOrders!.capabilities.updateHidden).toBeUndefined();
  });
});
