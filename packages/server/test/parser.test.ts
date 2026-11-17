import { describe, expect, it } from 'vitest';
import { ODataServerError, parseFilter, parseQueryOptions, parseResourcePath, parseSearch } from '../src/index';

const fails = (fn: () => unknown, status: number, code?: string) => {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(ODataServerError);
    expect((e as ODataServerError).status).toBe(status);
    if (code) expect((e as ODataServerError).code).toBe(code);
    return;
  }
  throw new Error('expected an error');
};

describe('$filter parser', () => {
  it('binds "and" tighter than "or", "not" tighter than both', () => {
    expect(parseFilter("A eq 1 or B eq 2 and not C eq 3")).toEqual({
      kind: 'or',
      left: { kind: 'compare', op: 'eq', left: { kind: 'path', segments: ['A'] }, right: { kind: 'literal', type: 'number', value: '1' } },
      right: {
        kind: 'and',
        left: { kind: 'compare', op: 'eq', left: { kind: 'path', segments: ['B'] }, right: { kind: 'literal', type: 'number', value: '2' } },
        right: { kind: 'not', operand: { kind: 'compare', op: 'eq', left: { kind: 'path', segments: ['C'] }, right: { kind: 'literal', type: 'number', value: '3' } } },
      },
    });
  });

  it('types every literal', () => {
    const lit = (text: string) => (parseFilter(`P eq ${text}`) as { right: unknown }).right;
    expect(lit("'it''s'")).toEqual({ kind: 'literal', type: 'string', value: "it's" });
    expect(lit("'a/b,c(d)'")).toEqual({ kind: 'literal', type: 'string', value: 'a/b,c(d)' });
    expect(lit('-12.5e3')).toEqual({ kind: 'literal', type: 'number', value: '-12.5e3' });
    expect(lit('2026-11-16')).toEqual({ kind: 'literal', type: 'date', value: '2026-11-16' });
    expect(lit('2026-11-16T08:30:00+01:00')).toEqual({ kind: 'literal', type: 'dateTimeOffset', value: '2026-11-16T08:30:00+01:00' });
    expect(lit('2026-11-16T08:30:00.123Z')).toEqual({ kind: 'literal', type: 'dateTimeOffset', value: '2026-11-16T08:30:00.123Z' });
    expect(lit('13:45:00')).toEqual({ kind: 'literal', type: 'timeOfDay', value: '13:45:00' });
    expect(lit('0BA4F1C2-1111-4222-8333-123456789ABC')).toEqual({ kind: 'literal', type: 'guid', value: '0ba4f1c2-1111-4222-8333-123456789abc' });
    expect(lit('true')).toEqual({ kind: 'literal', type: 'boolean', value: true });
    expect(lit('null')).toEqual({ kind: 'literal', type: 'null', value: null });
  });

  it('keeps keywords inside identifiers apart (Order, notes, inStock, nullable)', () => {
    expect(parseFilter('Order eq notes or inStock eq nullable')).toMatchObject({ kind: 'or', left: { left: { segments: ['Order'] }, right: { segments: ['notes'] } } });
  });

  it('reads functions, navigation paths and in-lists', () => {
    expect(parseFilter("contains(tolower(_Supplier/SupplierName),'gmbh')")).toEqual({
      kind: 'call',
      name: 'contains',
      args: [{ kind: 'call', name: 'tolower', args: [{ kind: 'path', segments: ['_Supplier', 'SupplierName'] }] }, { kind: 'literal', type: 'string', value: 'gmbh' }],
    });
    expect(parseFilter("Status in ('NEW','APPR')")).toMatchObject({ kind: 'in', list: [{ value: 'NEW' }, { value: 'APPR' }] });
  });

  it('rejects syntax errors with 400 and lambda operators with 501', () => {
    fails(() => parseFilter('Status eq'), 400, 'InvalidSyntax');
    fails(() => parseFilter("Status eq 'open"), 400, 'InvalidSyntax');
    fails(() => parseFilter('Status eq 1; drop table x'), 400, 'InvalidSyntax');
    fails(() => parseFilter('(Status eq 1'), 400);
    fails(() => parseFilter('_Item/any(i:i/Plant eq 1)'), 501, 'NotImplemented');
    fails(() => parseFilter(''), 400);
  });
});

describe('$search parser', () => {
  it('reads terms, phrases, AND / OR / NOT; adjacent terms are AND', () => {
    expect(parseSearch('pen "two words" OR NOT (a AND b)')).toEqual({
      kind: 'or',
      left: { kind: 'and', left: { kind: 'term', text: 'pen' }, right: { kind: 'term', text: 'two words' } },
      right: { kind: 'not', operand: { kind: 'and', left: { kind: 'term', text: 'a' }, right: { kind: 'term', text: 'b' } } },
    });
    expect(parseSearch('ANDROID')).toEqual({ kind: 'term', text: 'ANDROID' });
    expect(parseSearch("100% it's_a\\b")).toEqual({ kind: 'and', left: { kind: 'term', text: '100%' }, right: { kind: 'term', text: "it's_a\\b" } });
    expect(parseSearch('   ')).toBeUndefined();
  });

  it('rejects broken expressions', () => {
    fails(() => parseSearch('(open'), 400, 'InvalidSearch');
    fails(() => parseSearch('a OR'), 400, 'InvalidSearch');
  });
});

describe('query options', () => {
  it('decodes per RFC 3986: "+" stays a plus', () => {
    const o = parseQueryOptions('$filter=CreatedAt%20lt%202026-01-01T00:00:00+01:00');
    expect(o.filter).toMatchObject({ right: { type: 'dateTimeOffset', value: '2026-01-01T00:00:00+01:00' } });
  });

  it('reads $expand with nested options, $orderby, $top, $skip, $count, $select', () => {
    const o = parseQueryOptions('$count=true&$select=A,B&$orderby=A%20desc,B&$top=10&$skip=20&$expand=_Item($select=X;$orderby=X%20desc;$top=3;$expand=_Material($select=Name)),_Supplier');
    expect(o).toMatchObject({
      count: true,
      select: [['A'], ['B']],
      orderBy: [{ path: ['A'], descending: true }, { path: ['B'], descending: false }],
      top: 10,
      skip: 20,
      expand: [
        { navigation: '_Item', options: { select: [['X']], top: 3, orderBy: [{ path: ['X'], descending: true }], expand: [{ navigation: '_Material', options: { select: [['Name']] } }] } },
        { navigation: '_Supplier', options: {} },
      ],
    });
  });

  it('reads $apply as typed steps', () => {
    const o = parseQueryOptions("$apply=filter(CompanyCode eq '1000')/search(pen)/groupby((Status,_Status/Name),aggregate(NetAmount with sum as NetAmount,Rating with average as R))");
    expect(o.apply).toEqual([
      { kind: 'filter', expr: { kind: 'compare', op: 'eq', left: { kind: 'path', segments: ['CompanyCode'] }, right: { kind: 'literal', type: 'string', value: '1000' } } },
      { kind: 'search', expr: { kind: 'term', text: 'pen' } },
      { kind: 'groupby', paths: [['Status'], ['_Status', 'Name']], aggregates: [{ path: ['NetAmount'], method: 'sum', alias: 'NetAmount' }, { path: ['Rating'], method: 'average', alias: 'R' }] },
    ]);
    expect(parseQueryOptions('$apply=groupby((Status),aggregate($count as N,NetAmount with sum as S))').apply).toEqual([
      { kind: 'groupby', paths: [['Status']], aggregates: [{ path: [], method: 'count', alias: 'N' }, { path: ['NetAmount'], method: 'sum', alias: 'S' }] },
    ]);
    fails(() => parseQueryOptions('$apply=groupby((Status),aggregate($count with N))'), 400);
    fails(() => parseQueryOptions('$apply=topcount(3,NetAmount)'), 501);
    fails(() => parseQueryOptions('$apply=groupby((A),aggregate(B with median as M))'), 501);
  });

  it('rejects what it does not support or understand', () => {
    fails(() => parseQueryOptions('$top=-1'), 400);
    fails(() => parseQueryOptions('$top=1&$top=2'), 400);
    fails(() => parseQueryOptions('$select=A;drop'), 400);
    fails(() => parseQueryOptions('$orderby=A%20sideways'), 400);
    fails(() => parseQueryOptions('$compute=A%20add%201%20as%20B'), 501);
    fails(() => parseQueryOptions('$expand=*'), 501);
    fails(() => parseQueryOptions('$expand=_Item($count=true)'), 501);
    fails(() => parseQueryOptions('$format=xml'), 501);
    expect(parseQueryOptions('sap-client=100&foo=bar')).toEqual({});
  });
});

describe('resource path', () => {
  it('reads keys (single, named, composite, quoted) and /$count', () => {
    expect(parseResourcePath(["PurchaseOrders('4500000001')", '_Item'])).toEqual({ segments: [{ name: 'PurchaseOrders', key: [{ value: "'4500000001'" }] }, { name: '_Item' }], count: false });
    expect(parseResourcePath(["PurchaseOrderItems(PurchaseOrder='1',PurchaseOrderItem=10)"]).segments[0]!.key).toEqual([{ name: 'PurchaseOrder', value: "'1'" }, { name: 'PurchaseOrderItem', value: '10' }]);
    expect(parseResourcePath(["Materials('a%2Cb%3D(c)')"]).segments[0]!.key).toEqual([{ value: "'a,b=(c)'" }]);
    expect(parseResourcePath(['PurchaseOrders', '$count'])).toEqual({ segments: [{ name: 'PurchaseOrders' }], count: true });
  });
});
