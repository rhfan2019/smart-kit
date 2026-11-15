import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildListRequest, buildModel, buildObjectRequest, buildValueHelpRequest, childPathOf, entityPathOf, parseEntityPath, propertyFilter,
  readQueryString, resolveEntityPath, sourcePath, startOfDayIso, toFilter, toLiteral, toQueryString, OPERATORS, type Condition,
} from '../src';

const model = buildModel(readFileSync(join(import.meta.dirname, 'fixtures/shop.xml'), 'utf8'));
const ui = model.ui['Shop.Product']!;

describe('inline annotations', () => {
  it('annotations written inline on elements are honoured', () => {
    const m = buildModel(`<?xml version="1.0"?><edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx"><edmx:Reference Uri="u"><edmx:Include Namespace="com.sap.vocabularies.Common.v1" Alias="Common"/></edmx:Reference><edmx:Reference Uri="c"><edmx:Include Namespace="Org.OData.Capabilities.V1" Alias="Capabilities"/></edmx:Reference><edmx:DataServices><Schema xmlns="http://docs.oasis-open.org/odata/ns/edm" Namespace="M"><EntityType Name="O"><Key><PropertyRef Name="ID"/></Key><Property Name="ID" Type="Edm.Int32" Nullable="false"><Annotation Term="Common.Label" String="Ident"/></Property></EntityType><EntityContainer Name="C"><EntitySet Name="Os" EntityType="M.O"><Annotation Term="Capabilities.SearchRestrictions"><Record><PropertyValue Property="Searchable" Bool="true"/></Record></Annotation></EntitySet></EntityContainer></Schema></edmx:DataServices></edmx:Edmx>`);
    expect(m.entityTypes['M.O']!.properties.ID!.label).toBe('Ident');
    expect(m.entitySets.Os!.capabilities.searchable).toBe(true);
  });
});

describe('literals (AC-DATA-02)', () => {
  it('formats every Edm type', () => {
    expect(toLiteral("O'Neil", 'Edm.String')).toBe("'O''Neil'");
    expect(toLiteral('12345678901234567.89', 'Edm.Decimal')).toBe('12345678901234567.89');
    expect(toLiteral('9007199254740993', 'Edm.Int64')).toBe('9007199254740993');
    expect(toLiteral(true, 'Edm.Boolean')).toBe('true');
    expect(toLiteral('2026-11-14', 'Edm.Date')).toBe('2026-11-14');
    expect(toLiteral('2026-11-14T10:00:00+08:00', 'Edm.DateTimeOffset')).toBe('2026-11-14T10:00:00+08:00');
    expect(toLiteral('13:45:00', 'Edm.TimeOfDay')).toBe('13:45:00');
    expect(toLiteral('7be6d296-9e7a-3505-b72e-4c7b98783578', 'Edm.Guid')).toBe('7be6d296-9e7a-3505-b72e-4c7b98783578');
    expect(() => toLiteral('abc', 'Edm.Int32')).toThrow();
    expect(() => toLiteral('14.11.2026', 'Edm.Date')).toThrow();
  });
});

describe('condition model (AC-DATA-02)', () => {
  const c = (operator: Condition['operator'], values: unknown[] = [], exclude = false): Condition => ({ operator, values, exclude });
  it('covers all 14 operators', () => {
    const expected: Record<string, string> = {
      EQ: "P eq 'a'", NE: "P ne 'a'", LT: "P lt 'a'", LE: "P le 'a'", GT: "P gt 'a'", GE: "P ge 'a'",
      BT: "(P ge 'a' and P le 'b')", NB: "not (P ge 'a' and P le 'b')",
      Contains: "contains(P,'a')", NotContains: "not contains(P,'a')", StartsWith: "startswith(P,'a')", EndsWith: "endswith(P,'a')",
      Empty: "(P eq null or P eq '')", NotEmpty: "(P ne null and P ne '')",
    };
    for (const op of OPERATORS) expect(propertyFilter('P', [c(op, ['a', 'b'])], 'Edm.String'), op).toBe(expected[op]);
    expect(propertyFilter('N', [c('Empty')], 'Edm.Int32')).toBe('N eq null');
  });
  it('same property: includes are or-ed, excludes negated and and-ed; properties and-ed', () => {
    const f = toFilter(
      { Status: [c('EQ', ['A']), c('EQ', ['B']), c('EQ', ['C'], true)], Price: [c('GE', ['10'])] },
      (p) => (p === 'Price' ? 'Edm.Decimal' : 'Edm.String'),
    );
    expect(f).toBe("(Status eq 'A' or Status eq 'B') and not (Status eq 'C') and Price ge 10");
  });
  it('skips incomplete conditions', () => {
    expect(toFilter({ A: [c('EQ', [''])], B: [c('BT', ['1'])] }, () => 'Edm.Int32')).toBeUndefined();
  });
  it('AC-DATA-05 calendar-day filters on DateTimeOffset use the time zone', () => {
    expect(startOfDayIso('2026-11-14', 'Asia/Shanghai')).toBe('2026-11-14T00:00:00+08:00');
    expect(startOfDayIso('2026-03-29', 'Europe/Berlin')).toBe('2026-03-29T00:00:00+01:00');
    expect(propertyFilter('T', [c('EQ', ['2026-11-14'])], 'Edm.DateTimeOffset', { timeZone: 'Asia/Shanghai' }))
      .toBe('(T ge 2026-11-14T00:00:00+08:00 and T lt 2026-11-15T00:00:00+08:00)');
    expect(propertyFilter('D', [c('BT', ['2026-01-01', '2026-01-31'])], 'Edm.Date')).toBe('(D ge 2026-01-01 and D le 2026-01-31)');
  });
});

describe('entity paths', () => {
  it('parses, resolves and builds paths with composite keys', () => {
    const p = childPathOf(model, entityPathOf(model, 'Products', { ID: 7 }), '_Review', { ProductID: 7, ReviewNo: 2 });
    expect(p).toBe('Products(7)/_Review(ProductID=7,ReviewNo=2)');
    const r = resolveEntityPath(model, p);
    expect(r).toMatchObject({ entitySet: 'Reviews', typeName: 'Shop.Review', canonical: 'Reviews(ProductID=7,ReviewNo=2)' });
    expect(r.levels.map((l) => l.path)).toEqual(['Products(7)', 'Products(7)/_Review(ProductID=7,ReviewNo=2)']);
    expect(parseEntityPath("Categories('A''B')")).toEqual([{ name: 'Categories', key: { '': "A'B" } }]);
    expect(entityPathOf(model, 'Categories', { ID: "A'B" })).toBe("Categories('A''B')");
  });
});

describe('query generation (AC-DATA-01)', () => {
  it('Q-01/Q-02/Q-04/Q-05/Q-05b/Q-06/Q-07 list request', () => {
    const req = buildListRequest(model, ui, {
      source: { entitySet: 'Products' },
      columns: ui.lineItem,
      filters: { Status: [{ operator: 'EQ', values: ['A'] }], Notes: [{ operator: 'Contains', values: ['x'] }] },
      search: ' pen ',
      sort: [{ path: 'Price', descending: true }, { path: 'Notes', descending: false }],
      skip: 0,
      top: 100,
      count: true,
    });
    expect(toQueryString(model, req)).toBe(
      "$count=true&$select=ID,Code,Name,CategoryID,Status,StatusCriticality,Price,Currency,Rating,Version&$filter=Status eq 'A'&$search=pen&$orderby=Currency,Price desc&$expand=_Category($select=Name)&$skip=0&$top=100"
        .replace(/ /g, '%20'),
    );
  });

  it('default sort from PresentationVariant; no $search when not searchable; no $count when not countable', () => {
    const req = buildListRequest(model, model.ui['Shop.Review']!, { source: { entitySet: 'Reviews' }, columns: model.ui['Shop.Review']!.lineItem, search: 'x', count: true });
    expect(req.search).toBeUndefined();
    expect(req.count).toBe(false);
    const p = buildListRequest(model, ui, { source: { entitySet: 'Products' }, columns: [] });
    expect(p.orderBy).toEqual([{ path: 'ReleaseDate', descending: true }]);
  });

  it('sub-table request through a navigation', () => {
    const table = ui.sections[1]!.subSections[0]!.content;
    if (table.kind !== 'table') throw new Error('expected table');
    const req = buildListRequest(model, model.ui['Shop.Review']!, { source: { parent: 'Products(7)', navigation: '_Review' }, columns: table.columns, top: 10, skip: 0, count: true, search: 'good' });
    expect(sourcePath(model, req.source)).toBe('Products(7)/_Review');
    expect(req.search).toBe('good'); // NavigationRestrictions make it searchable
    expect(req.count).toBe(false); // target set is not countable
  });

  it('Q-08 object request reads header and all form fields in one go', () => {
    const req = buildObjectRequest(model, 'Shop.Product', ui);
    expect(readQueryString(req)).toBe('$select=ID,Version,Name,Code,ImageUrl,CategoryID,Rating,Stock,Price,Currency,ReleaseDate,Notes&$expand=_Category($select=Name)');
  });

  it('Q-09 value help request with contains fallback when search is not supported', () => {
    const vl = model.entityTypes['Shop.Product']!.properties.CategoryID!.valueList!;
    const req = buildValueHelpRequest(model, vl, { search: 'pap' });
    expect(toQueryString(model, req)).toBe("$select=ID,Name&$filter=(contains(ID,'pap') or contains(Name,'pap'))&$orderby=ID&$skip=0&$top=50".replace(/ /g, '%20').replace("$select", '$count=true&$select'));
  });
});
