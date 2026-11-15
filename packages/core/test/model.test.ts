import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildModel, capabilitiesFor, DERIVED_GENERAL_SECTION, MODEL_VERSION, type MetaModel } from '../src';

const shopXml = readFileSync(join(import.meta.dirname, 'fixtures/shop.xml'), 'utf8');
const model: MetaModel = buildModel(shopXml);
const ui = model.ui['Shop.Product']!;
const product = model.entityTypes['Shop.Product']!;

describe('model basics', () => {
  it('AC-MOD-05 has a version and records warnings instead of throwing', () => {
    expect(model.version).toBe(MODEL_VERSION);
    expect(model.warnings.some((w) => w.code === 'UNSUPPORTED_RECORD')).toBe(true);
  });

  it('reads entity sets, keys, navigations and bindings', () => {
    expect(Object.keys(model.entitySets).sort()).toEqual(['Categories', 'Plains', 'Products', 'Reviews']);
    expect(product.keys).toEqual(['ID']);
    expect(product.navigations._Review).toMatchObject({ collection: true, targetType: 'Shop.Review', partner: '_Product' });
    expect(product.navigations._Category!.referentialConstraints).toEqual([{ property: 'CategoryID', referencedProperty: 'ID' }]);
    expect(model.entitySets.Products!.navigationBindings).toEqual({ _Category: 'Categories', _Review: 'Reviews' });
    expect(model.entityTypes['Shop.Review']!.keys).toEqual(['ProductID', 'ReviewNo']);
  });

  it('ANN-50 reads Core terms: OptimisticConcurrency, Computed', () => {
    expect(product.etag).toBe('Version');
    expect(product.properties.Version!.computed).toBe(true);
  });
});

describe('UI annotations', () => {
  it('ANN-01 LineItem: DataField, DataFieldForAnnotation; actions and hidden records are dropped', () => {
    expect(ui.lineItem.map((c) => c.id)).toEqual([
      'DataField::Code',
      'DataField::Name',
      'DataField::CategoryID',
      'DataField::Status',
      'DataField::Price',
      'DataFieldForAnnotation::UI.DataPoint#Rating',
      'DataField::_Category::Name',
    ]);
    const rating = ui.lineItem.find((c) => c.kind === 'dataPoint')!;
    expect(rating.label).toBe('Rating');
    expect(rating.dataPoint).toMatchObject({ value: 'Rating', visualization: 'Rating', targetValue: { value: 5 } });
    expect(ui.derived.lineItem).toBe(false);
  });

  it('ANN-02 SelectionFields in order, without hidden-filter fields', () => {
    expect(ui.selectionFields).toEqual(['Code', 'CategoryID', 'Status']);
  });

  it('ANN-03 HeaderInfo with title, description and image', () => {
    expect(ui.headerInfo).toEqual({ typeName: 'Product', typeNamePlural: 'Products', title: 'Name', description: 'Code', imageUrl: { path: 'ImageUrl' } });
  });

  it('ANN-04 PresentationVariant: sort order and RequestAtLeast', () => {
    expect(ui.presentation).toEqual({ sortOrder: [{ path: 'ReleaseDate', descending: true }], requestAtLeast: ['Version'] });
  });

  it('ANN-05 SelectionVariant: ranges become initial conditions (CP → Contains)', () => {
    expect(ui.selectionVariant).toEqual([
      { path: 'Status', exclude: true, operator: 'EQ', values: ['X'] },
      { path: 'Name', exclude: false, operator: 'Contains', values: ['pen'] },
    ]);
  });

  it('ANN-06 Facets: CollectionFacet → section with subsections; ReferenceFacet to nav LineItem → table', () => {
    expect(ui.sections.map((s) => [s.id, s.label, s.subSections.map((x) => x.id)])).toEqual([
      ['GeneralInfo', 'General Information', ['GeneralData', 'PriceData']],
      ['Reviews', 'Reviews', ['Reviews']],
      ['More', 'More', ['NotesData']],
    ]);
    const table = ui.sections[1]!.subSections[0]!.content;
    expect(table.kind).toBe('table');
    if (table.kind === 'table') {
      expect(table.navigation).toBe('_Review');
      expect(table.columns.map((c) => c.path)).toEqual(['ReviewNo', 'Stars', 'Text']);
    }
  });

  it('ANN-07 PartOfPreview=false marks subsections for "Show More"', () => {
    expect(ui.sections[2]!.subSections[0]!.partOfPreview).toBe(false);
    expect(ui.sections[0]!.subSections[0]!.partOfPreview).toBe(true);
  });

  it('ANN-08 HeaderFacets: form and data points', () => {
    expect(ui.headerFacets.map((f) => [f.id, f.kind])).toEqual([
      ['HeaderGeneral', 'form'],
      ['UI.DataPoint#Rating', 'dataPoint'],
      ['UI.DataPoint#Stock', 'dataPoint'],
    ]);
  });

  it('ANN-09 FieldGroup forms carry group label and fields', () => {
    const sub = ui.sections[0]!.subSections[0]!;
    expect(sub.content.kind).toBe('form');
    if (sub.content.kind === 'form') {
      expect(sub.content.groups[0]!.label).toBe('General');
      expect(sub.content.groups[0]!.fields.map((f) => f.path)).toEqual(['Code', 'Name', 'CategoryID']);
    }
  });

  it('ANN-10 DataPoint: title, visualization and constant criticality', () => {
    const stock = ui.headerFacets[2]!;
    expect(stock.kind === 'dataPoint' && stock.dataPoint).toMatchObject({ title: 'In Stock', value: 'Stock', visualization: 'Number', criticality: { value: 3 } });
  });

  it('ANN-11 Criticality path on a DataField', () => {
    expect(ui.lineItem.find((c) => c.path === 'Status')!.criticality).toEqual({ path: 'StatusCriticality' });
  });

  it('ANN-12 UI.Hidden removes fields; UI.HiddenFilter keeps the field but removes it from filters', () => {
    expect(product.properties.StatusCriticality!.hidden).toBe(true);
    expect(product.properties.Version!.hiddenFilter).toBe(true);
  });

  it('ANN-13 Common.Text with nested UI.TextArrangement', () => {
    expect(product.properties.CategoryID).toMatchObject({ text: '_Category/Name', textArrangement: 'TextFirst' });
  });

  it('ANN-14 IsImageURL and MultiLineText', () => {
    expect(product.properties.ImageUrl!.isImageUrl).toBe(true);
    expect(product.properties.Notes!.multiLine).toBe(true);
  });

  it('ANN-24 SemanticKey marks the key identifier column', () => {
    expect(ui.semanticKey).toEqual(['Code']);
    expect(ui.lineItem[0]!.isSemanticKey).toBe(true);
  });
});

describe('Common and Measures', () => {
  it('ANN-20 Common.Label, with humanized fallback', () => {
    expect(product.properties.Code!.label).toBe('Product Code');
    expect(product.properties.ReleaseDate!.label).toBe('Release Date');
    expect(product.properties.ReleaseDate!.labelDerived).toBe(true);
  });

  it('ANN-22 ValueList: collection, parameters, key and description; fixed values', () => {
    expect(product.properties.CategoryID!.valueList).toMatchObject({
      collectionPath: 'Categories',
      keyProperty: 'ID',
      descriptionProperty: 'Name',
      searchSupported: false,
      fixedValues: false,
    });
    expect(product.properties.Status!.valueList!.fixedValues).toBe(true);
  });

  it('ANN-25 format hints (IsUpperCase, IsDigitSequence)', () => {
    expect(product.properties.Code!.isUpperCase).toBe(true);
    expect(product.properties.Stock!.isDigitSequence).toBe(false);
  });

  it('ANN-30 Measures.ISOCurrency', () => {
    expect(product.properties.Price).toMatchObject({ unit: { path: 'Currency' }, isCurrency: true, scale: 2, precision: 15 });
  });
});

describe('Capabilities', () => {
  const caps = model.entitySets.Products!.capabilities;
  it('ANN-40 FilterRestrictions', () => {
    expect(caps.nonFilterable).toEqual(['Notes']);
    expect(caps.requiredFilters).toEqual(['Status']);
    expect(caps.filterExpressions).toEqual({ ReleaseDate: 'SingleRange' });
  });
  it('ANN-41 SortRestrictions', () => {
    expect(caps.nonSortable).toEqual(['Notes']);
  });
  it('ANN-42 SearchRestrictions; Searchable defaults to false', () => {
    expect(caps.searchable).toBe(true);
    expect(model.entitySets.Categories!.capabilities.searchable).toBe(false);
  });
  it('ANN-43 CountRestrictions; Top/Skip default to supported', () => {
    expect(model.entitySets.Reviews!.capabilities.countable).toBe(false);
    expect(caps.topSupported && caps.skipSupported).toBe(true);
  });
  it('ANN-45 Insert/Update/Delete restrictions are read into the model', () => {
    expect(caps.updatable).toBe(true);
    expect(caps.deletable).toBe(false);
  });
  it('ANN-46 NavigationRestrictions override the target set', () => {
    const viaNav = capabilitiesFor(model, 'Products', '_Review');
    expect(viaNav.searchable).toBe(true);
    expect(viaNav.countable).toBe(false);
  });
});

describe('derivation (no UI annotations)', () => {
  const plain = model.ui['Shop.Plain']!;
  it('ANN-60 columns: key + displayable properties, binary excluded', () => {
    expect(plain.lineItem.map((c) => c.path)).toEqual(['PlainId', 'ProductName', 'unit_price']);
    expect(plain.derived.lineItem).toBe(true);
  });
  it('ANN-61 selection fields: key + first string properties', () => {
    expect(plain.selectionFields).toEqual(['PlainId', 'ProductName']);
  });
  it('ANN-62 header info from names', () => {
    expect(plain.headerInfo).toMatchObject({ typeName: 'Plain', typeNamePlural: 'Plains', title: 'ProductName' });
  });
  it('ANN-63 sections: general form + one table per collection navigation', () => {
    expect(plain.sections.map((s) => s.id)).toEqual([DERIVED_GENERAL_SECTION, 'Lines::LineItem']);
    expect(plain.sections[1]!.subSections[0]!.content.kind).toBe('table');
  });
  it('ANN-64 labels are humanized property names', () => {
    expect(model.entityTypes['Shop.Plain']!.properties.unit_price!.label).toBe('Unit Price');
    expect(model.entityTypes['Shop.Plain']!.properties.PlainId!.label).toBe('Plain Id');
  });
});
