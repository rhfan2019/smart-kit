import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildModel, type MetaModel } from '../src';

const read = (f: string) => readFileSync(join(import.meta.dirname, 'samples', f), 'utf8');
const strip = (m: MetaModel) => ({ entitySets: m.entitySets, entityTypes: m.entityTypes, ui: m.ui });

describe('test service samples (AC-MOD-01, AC-MOD-03)', () => {
  const po = buildModel(read('purchasing.en.xml'));
  it('ANN-70 purchasing: XML and JSON $metadata give the same model', () => {
    expect(strip(buildModel(read('purchasing.en.json')))).toEqual(strip(po));
  });
  it('ANN-70 northwind: XML and JSON $metadata give the same model', () => {
    expect(strip(buildModel(read('northwind.en.json')))).toEqual(strip(buildModel(read('northwind.en.xml'))));
  });
  it('purchasing model carries the annotated UI', () => {
    const ui = po.ui['Purchasing.PurchaseOrder']!;
    expect(ui.derived).toEqual({ lineItem: false, selectionFields: false, headerInfo: false, sections: false });
    expect(ui.lineItem.length).toBeGreaterThanOrEqual(6);
    expect(ui.headerFacets.length).toBe(7);
    expect(ui.sections.map((s) => s.id)).toEqual(['GeneralInformation', 'Items', 'NotesSection']);
    expect(po.entitySets.PurchaseOrders!.capabilities).toMatchObject({ searchable: true, nonFilterable: ['Notes'], requiredFilters: ['CompanyCode'], nonSortable: ['Description'] });
    expect(po.entitySets.ItemHistory!.capabilities.countable).toBe(false);
    expect(po.warnings.filter((w) => w.level === 'warning')).toEqual([]);
  });
  it('Chinese labels come from the zh $metadata', () => {
    const zh = buildModel(read('purchasing.zh.xml'));
    expect(zh.entityTypes['Purchasing.PurchaseOrder']!.properties.Supplier!.label).toMatch(/[一-鿿]/);
  });
  it('AC-MOD-03 northwind (no annotations) is fully derived', () => {
    const nw = buildModel(read('northwind.en.xml'));
    const ui = nw.ui['NorthwindLike.Product']!;
    expect(ui.derived).toEqual({ lineItem: true, selectionFields: true, headerInfo: true, sections: true });
    expect(ui.lineItem.length).toBeGreaterThan(2);
    // AL-10 P1-7: without Capabilities.SearchRestrictions the set is searchable (FE, D34)
    expect(nw.entitySets.Products!.capabilities.searchable).toBe(true);
  });
});
