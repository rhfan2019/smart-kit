import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildListRequest, buildModel, buildObjectRequest, compareDecimal, ConcurrencyError, createSessionPageStateStore, currencyDigits, errorFromResponse,
  formatValue, MemoryPageStateStore, MemoryProvider, MemoryVariantStore, ODataError, ODataV4Provider, ODataVariantStore, type FetchLike,
} from '../src';

const model = buildModel(readFileSync(join(import.meta.dirname, 'fixtures/shop.xml'), 'utf8'));
const ui = model.ui['Shop.Product']!;

const products = Array.from({ length: 30 }, (_, i) => ({
  ID: i + 1,
  Code: `P${String(i + 1).padStart(3, '0')}`,
  Name: i % 3 === 0 ? `Blue pen ${i}` : `Paper ${i}`,
  Price: (10 + i * 1.5).toFixed(2),
  Currency: i % 2 ? 'USD' : 'EUR',
  CategoryID: i % 2 ? 'C1' : 'C2',
  Status: i % 4 === 0 ? 'X' : 'A',
  StatusCriticality: 3,
  Rating: '4.5',
  Stock: '9007199254740993',
  ReleaseDate: `2026-01-${String((i % 28) + 1).padStart(2, '0')}`,
  Version: 1,
}));
const data = {
  Products: products,
  Categories: [{ ID: 'C1', Name: 'Office' }, { ID: 'C2', Name: 'School' }],
  Reviews: [{ ProductID: 1, ReviewNo: 1, Stars: 5, Text: 'good' }, { ProductID: 1, ReviewNo: 2, Stars: 3, Text: 'ok' }, { ProductID: 2, ReviewNo: 1, Stars: 1, Text: 'bad' }],
};
const memory = new MemoryProvider({ model, data });

describe('MemoryProvider', () => {
  it('filters, searches, sorts, pages, counts and expands', async () => {
    const req = buildListRequest(model, ui, {
      source: { entitySet: 'Products' },
      columns: ui.lineItem,
      filters: { Status: [{ operator: 'EQ', values: ['X'], exclude: true }], CategoryID: [{ operator: 'EQ', values: ['C2'] }] },
      search: 'pen',
      sort: [{ path: 'Price', descending: true }],
      top: 2,
      skip: 0,
      count: true,
    });
    const res = await memory.query(req);
    // pens in C2 (even index) that are not status X: indexes 6 and 18
    expect(res.count).toBe(2);
    expect(res.rows.map((r) => r.ID)).toEqual([19, 7]);
    expect(res.rows[0]!._Category).toEqual({ ID: 'C2', Name: 'School' });
  });

  it('queries through a collection navigation and reads by key', async () => {
    const res = await memory.query({ source: { parent: 'Products(1)', navigation: '_Review' }, select: ['Stars'], expand: [], orderBy: [], count: true });
    expect(res.rows.map((r) => r.Stars)).toEqual([5, 3]);
    const row = await memory.read('Products(2)', buildObjectRequest(model, 'Shop.Product', ui));
    expect(row.Code).toBe('P002');
    await expect(memory.read('Products(999)', { select: [], expand: [] })).rejects.toBeInstanceOf(ODataError);
  });
});

function fakeFetch(handler: (url: string, init?: Parameters<FetchLike>[1]) => { status?: number; body?: unknown; headers?: Record<string, string> }) {
  const calls: { url: string; init?: Parameters<FetchLike>[1] }[] = [];
  const f: FetchLike = async (url, init) => {
    calls.push({ url, init });
    const r = handler(url, init);
    const status = r.status ?? 200;
    return {
      ok: status < 300,
      status,
      statusText: 'X',
      headers: { get: (n: string) => r.headers?.[n] ?? null },
      text: async () => (r.body === undefined ? '' : typeof r.body === 'string' ? r.body : JSON.stringify(r.body)),
    };
  };
  return { f, calls };
}

describe('ODataV4Provider', () => {
  it('sends IEEE754Compatible and Accept-Language; parses string counts', async () => {
    const { f, calls } = fakeFetch(() => ({ body: { value: [{ ID: 1, Price: '12345678901234567.89' }], '@odata.count': '42' } }));
    const p = new ODataV4Provider({ serviceUrl: '/odata/shop/', model, fetch: f, getLanguage: () => 'zh' });
    const res = await p.query({ source: { entitySet: 'Products' }, select: ['ID', 'Price'], expand: [], orderBy: [], count: true, top: 10 });
    expect(res).toEqual({ rows: [{ ID: 1, Price: '12345678901234567.89' }], count: 42 });
    expect(calls[0]!.url).toBe('/odata/shop/Products?$count=true&$select=ID,Price&$top=10');
    expect(calls[0]!.init!.headers).toMatchObject({ Accept: 'application/json;odata.metadata=minimal;IEEE754Compatible=true', 'Accept-Language': 'zh' });
  });

  it('reads via the canonical URL', async () => {
    const { f, calls } = fakeFetch(() => ({ body: { ProductID: 7, ReviewNo: 2 } }));
    const p = new ODataV4Provider({ serviceUrl: '/s/', model, fetch: f });
    await p.read('Products(7)/_Review(ProductID=7,ReviewNo=2)', { select: ['Text'], expand: [] });
    expect(calls[0]!.url).toBe('/s/Reviews(ProductID=7,ReviewNo=2)?$select=Text');
  });

  it('AC-DATA-06 parses OData errors and distinguishes page and field scope', async () => {
    const { f } = fakeFetch(() => ({ status: 400, body: { error: { code: 'BAD', message: 'Invalid filter', details: [{ message: 'x', target: 'Price' }] } } }));
    const p = new ODataV4Provider({ serviceUrl: '/s/', model, fetch: f });
    const e = await p.query({ source: { entitySet: 'Products' }, select: [], expand: [], orderBy: [], count: false }).catch((x) => x as ODataError);
    expect(e).toBeInstanceOf(ODataError);
    expect(e).toMatchObject({ status: 400, code: 'BAD', message: 'Invalid filter', scope: 'page' });
    const field = await errorFromResponse({ status: 400, text: async () => JSON.stringify({ error: { message: 'Too long', target: "Products(1)/Name" } }) });
    expect(field.scope).toBe('field');
    const html = await errorFromResponse({ status: 502, statusText: 'Bad Gateway', text: async () => '<html>' });
    expect(html).toMatchObject({ code: 'HTTP_502', message: 'Bad Gateway' });
  });

  it('PATCH with If-Match; 412 becomes ConcurrencyError', async () => {
    const { f, calls } = fakeFetch((_, init) => (init?.headers?.['If-Match'] === 'W/"1"' ? { body: { ID: 1, '@odata.etag': 'W/"2"' } } : { status: 412, body: { error: { message: 'changed' } } }));
    const p = new ODataV4Provider({ serviceUrl: '/s/', model, fetch: f });
    expect(await p.update('Products(1)', { Name: 'n' }, { etag: 'W/"1"' })).toMatchObject({ etag: 'W/"2"' });
    await expect(p.update('Products(1)', { Name: 'n' }, { etag: 'W/"0"' })).rejects.toBeInstanceOf(ConcurrencyError);
    expect(calls[0]!.init).toMatchObject({ method: 'PATCH', body: '{"Name":"n"}' });
  });
});

describe('variant stores', () => {
  it('memory store saves, lists and removes', async () => {
    const s = new MemoryVariantStore();
    const v = await s.save({ id: '', pageKey: 'p', name: 'Mine', isDefault: true, autoApply: false, content: { filters: {} } });
    expect(v.id).toBeTruthy();
    expect((await s.list('p')).map((x) => x.name)).toEqual(['Mine']);
    await s.remove(v.id);
    expect(await s.list('p')).toEqual([]);
  });
  it('OData store maps rows to the Variants entity set', async () => {
    const { f, calls } = fakeFetch((url, init) => (init?.method === 'POST'
      ? { body: { ID: 'g1', PageKey: 'p', Name: 'A', IsDefault: false, AutoApply: true, Content: '{"filters":{}}' } }
      : { body: { value: [] } }));
    const s = new ODataVariantStore(new ODataV4Provider({ serviceUrl: '/s/', model, fetch: f }));
    const v = await s.save({ id: '', pageKey: 'p', name: 'A', isDefault: false, autoApply: true, content: { filters: {} } });
    expect(v).toMatchObject({ id: 'g1', autoApply: true });
    await s.list("o'p");
    expect(calls[1]!.url).toBe("/s/Variants?$filter=PageKey%20eq%20'o''p'&$orderby=Name");
  });
});

describe('page state stores (AC-NAV-05)', () => {
  it('memory store keeps values per key', () => {
    const s = new MemoryPageStateStore();
    s.set('list', { a: 1 });
    expect(s.get('list')).toEqual({ a: 1 });
  });
  it('session store prefixes keys with the namespace', () => {
    const backing = new Map<string, string>();
    const s = createSessionPageStateStore('demo', { getItem: (k) => backing.get(k) ?? null, setItem: (k, v) => void backing.set(k, v) });
    s.set('list', { a: 1 });
    expect([...backing.keys()]).toEqual(['demo:list']);
    expect(s.get('list')).toEqual({ a: 1 });
  });
});

describe('formatting (AC-DATA-04, AC-I18N-03)', () => {
  const dec = { edmType: 'Edm.Decimal', scale: 2, isCurrency: false, isDigitSequence: false } as const;
  it('decimals are formatted exactly from strings', () => {
    expect(formatValue('12345678901234567.89', dec, { locale: 'en-US' })).toBe('12,345,678,901,234,567.89');
    expect(formatValue('9007199254740993', { ...dec, edmType: 'Edm.Int64', scale: undefined }, { locale: 'zh-CN' })).toBe('9,007,199,254,740,993');
    expect(compareDecimal('12345678901234567.89', '12345678901234567.9')).toBe(-1);
    expect(compareDecimal('-1.5', '-1.50')).toBe(0);
  });
  it('currency digits follow ISO 4217', () => {
    expect(currencyDigits('JPY')).toBe(0);
    expect(formatValue('1234.5', { ...dec, isCurrency: true }, { locale: 'en-US', unitCode: 'JPY' })).toBe('1,235');
    expect(formatValue('1234.5', { ...dec, isCurrency: true }, { locale: 'de-DE', unitCode: 'EUR' })).toBe('1.234,50');
  });
  it('dates: Edm.Date has no time zone shift; DateTimeOffset uses the given zone', () => {
    const d = { edmType: 'Edm.Date', isCurrency: false, isDigitSequence: false } as const;
    expect(formatValue('2026-11-14', d, { locale: 'en-US', timeZone: 'Pacific/Honolulu' })).toBe('Nov 14, 2026');
    expect(formatValue('2026-11-14', d, { locale: 'zh-CN' })).toBe('2026年11月14日');
    const dt = { edmType: 'Edm.DateTimeOffset', isCurrency: false, isDigitSequence: false } as const;
    expect(formatValue('2026-11-14T16:30:00Z', dt, { locale: 'en-US', timeZone: 'Asia/Shanghai' }).replace(/\u202f/g, ' ')).toBe('Nov 15, 2026, 12:30:00 AM'); // medium style with seconds (FE DateTimeOffset)
  });
});
