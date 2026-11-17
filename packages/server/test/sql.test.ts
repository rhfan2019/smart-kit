import { describe, expect, it } from 'vitest';
import { escapeLike, ODataServerError } from '../src/index';
import { compile } from './fixture';

const rejects = (fn: () => unknown, status: number, code?: string) => {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(ODataServerError);
    expect((e as ODataServerError).status).toBe(status);
    if (code) expect((e as ODataServerError).code).toBe(code);
    return (e as ODataServerError).message;
  }
  throw new Error('expected an error');
};

describe('SQL: values are parameters, names come from the metadata', () => {
  it('maps entity sets and properties to the tables and columns of the storage mapping', () => {
    const { sql, parameters } = compile('PurchaseOrders', "$select=NetAmount&$filter=Status eq 'NEW'");
    expect(sql).toContain('from "purchasing"."purchase_order" as "t0"');
    expect(sql).toContain('"t0"."status" = $1::text');
    expect(sql).toContain('"t0"."net_amount" as "NetAmount"');
    expect(parameters[0]).toBe('NEW');
  });

  it('keeps an injection attempt inside a string literal as a parameter value', () => {
    const evil = "x' or 1=1; drop table purchasing.purchase_order; --";
    const { sql, parameters } = compile('Suppliers', `$filter=${encodeURIComponent(`SupplierName eq '${evil.replace(/'/g, "''")}'`)}`);
    expect(parameters).toContain(evil);
    expect(sql).not.toContain('drop table');
    expect(sql).not.toContain('1=1');
  });

  it('never turns an unknown name into SQL: 400 instead', () => {
    rejects(() => compile('PurchaseOrders', '$filter=net_amount gt 1'), 400, 'PropertyNotFound');
    rejects(() => compile('PurchaseOrders', '$select=PurchaseOrder,pg_sleep'), 400, 'PropertyNotFound');
    rejects(() => compile('PurchaseOrders', '$orderby=NetAmount;delete'), 400);
    rejects(() => compile('PurchaseOrders', '$orderby=%22status%22'), 400);
    rejects(() => compile('PurchaseOrders', '$expand=_Item($select=x%22y)'), 400);
    rejects(() => compile('pg_user', ''), 404);
    rejects(() => compile("PurchaseOrders('1');drop", ''), 400);
  });

  it('escapes %, _ and \\ in LIKE patterns (contains, startswith, endswith, $search)', () => {
    expect(escapeLike('50%_off\\x')).toBe('50\\%\\_off\\\\x');
    const c = compile('PurchaseOrders', `$filter=${encodeURIComponent("contains(Description,'50%_off\\x')")}`);
    expect(c.sql).toContain(`"t0"."description" like $1 escape '\\'`);
    expect(c.parameters[0]).toBe('%50\\%\\_off\\\\x%');
    const s = compile('PurchaseOrders', `$filter=${encodeURIComponent("startswith(Description,'a_') and endswith(Description,'%')")}`);
    expect(s.parameters.slice(0, 2)).toEqual(['a\\_%', '%\\%']);
    const q = compile('PurchaseOrders', `$search=${encodeURIComponent('100%')}`);
    expect(q.sql).toContain('ilike $1 escape');
    expect(q.parameters[0]).toBe('%100\\%%');
  });

  it('casts literals to the property type and checks them against $metadata', () => {
    const c = compile('PurchaseOrders', '$filter=NetAmount gt 1000.5 and OrderDate ge 2026-01-01 and CreatedAt lt 2026-01-01T00:00:00Z and StatusCriticality eq 1');
    expect(c.sql).toContain('"t0"."net_amount" > $1::numeric');
    expect(c.sql).toContain('"t0"."order_date" >= $2::date');
    expect(c.sql).toContain('"t0"."created_at" < $3::timestamptz');
    expect(c.sql).toContain('"t0"."status_criticality" = $4::bigint');
    expect(rejects(() => compile('PurchaseOrders', "$filter=NetAmount eq 'abc'"), 400, 'TypeMismatch')).toMatch(/Edm.Decimal/);
    rejects(() => compile('PurchaseOrders', '$filter=Status eq 1'), 400, 'TypeMismatch');
    rejects(() => compile('PurchaseOrders', '$filter=OrderDate eq 2026-13-01'), 400, 'InvalidLiteral');
    rejects(() => compile('PurchaseOrders', '$filter=OrderDate eq 2026-01-01T00:00:00Z'), 400, 'TypeMismatch');
    rejects(() => compile("PurchaseOrders(4500000001)", ''), 400, 'TypeMismatch');
  });
});

describe('SQL: OData semantics', () => {
  it('appends the key to every ORDER BY (stable paging)', () => {
    const c = compile('PurchaseOrders', '$orderby=NetAmount desc&$top=10&$skip=20');
    expect(c.sql).toMatch(/order by "t0"\."net_amount" desc, "t0"\."purchase_order" asc limit \$\d+ offset \$\d+/);
    const items = compile("PurchaseOrders('1')/_Item", '$orderby=NetAmount');
    expect(items.sql).toMatch(/order by "t\d+"\."net_amount" asc, "t\d+"\."purchase_order" asc, "t\d+"\."purchase_order_item" asc/);
  });

  it('counts with COUNT(*) OVER() in the same query', () => {
    expect(compile('PurchaseOrders', '$count=true&$top=5').sql).toContain('count(*) over () as "@count"');
    expect(compile('PurchaseOrders', '$top=5').sql).not.toContain('count(*)');
  });

  it('caps the page size', () => {
    const c = compile('PurchaseOrders', '$top=5000', { maxPageSize: 100 });
    expect(c.parameters).toContain(101); // one more row tells whether there is a next page
  });

  it('expands a collection with LEFT JOIN LATERAL + json_agg, nested $select / $orderby / $top inside', () => {
    const c = compile("PurchaseOrders('4500000001')", '$expand=_Item($select=NetAmount;$orderby=NetAmount desc;$top=3)');
    expect(c.sql).toContain('left join lateral (select coalesce(json_agg(row_to_json("q');
    expect(c.sql).toMatch(/"t\d+"\."purchase_order" = "p\d+"\."PurchaseOrder"/);
    expect(c.sql).toMatch(/order by "t\d+"\."net_amount" desc, "t\d+"\."purchase_order" asc, "t\d+"\."purchase_order_item" asc limit \$\d+/);
    expect(c.parameters).toContain(3);
  });

  it('joins single-valued navigations for $filter, $orderby and $search', () => {
    const c = compile('PurchaseOrders', "$filter=_Supplier/Country eq 'DE'&$orderby=_Supplier/SupplierName&$search=steel");
    expect(c.sql.match(/left join "purchasing"\."supplier"/g)).toHaveLength(1);
    expect(c.sql).toMatch(/"t\d"\."supplier_name" ilike/);
  });

  it('uses two-valued logic: null comparisons, ne on nullable columns, negation', () => {
    // MovementType is nullable, Category is not
    expect(compile('ItemHistory', '$filter=MovementType eq null').sql).toContain('"t0"."movement_type" is null');
    expect(compile('ItemHistory', '$filter=MovementType ne null').sql).toContain('"t0"."movement_type" is not null');
    expect(compile('ItemHistory', "$filter=MovementType ne '101'").sql).toContain('"t0"."movement_type" is distinct from $1::text');
    expect(compile('ItemHistory', "$filter=not (MovementType eq '101')").sql).toContain('not (coalesce("t0"."movement_type" = $1::text, false))');
    expect(compile('ItemHistory', "$filter=not contains(MovementType,'1')").sql).toContain('not (coalesce("t0"."movement_type" like $1');
    expect(compile('ItemHistory', "$filter=not (Category eq 'GR')").sql).toContain('not ("t0"."category" = $1::text)');
    expect(compile('ItemHistory', '$filter=Amount gt null').sql).toContain('where false');
  });

  it('aggregates with GROUP BY ($apply)', () => {
    const c = compile('PurchaseOrders', "$apply=filter(CompanyCode eq '1000')/groupby((Status,_Status/Name),aggregate(NetAmount with sum as NetAmount))&$orderby=NetAmount desc&$top=5");
    expect(c.sql).toContain('sum("t0"."net_amount")');
    expect(c.sql).toMatch(/group by "t0"\."status", "t\d"\."name" order by sum\("t0"\."net_amount"\) desc, "t0"\."status" asc, "t\d"\."name" asc limit/);
    rejects(() => compile('PurchaseOrders', '$apply=groupby((Status),aggregate(Description with sum as D))'), 400, 'InvalidApply');
    rejects(() => compile('PurchaseOrders', '$apply=groupby((Status))&$orderby=NetAmount'), 400, 'InvalidOrderBy');
  });

  it('restricts child collections and single navigations to the parent in the path', () => {
    const c = compile("PurchaseOrders('4500000001')/_Item", '$top=10');
    expect(c.sql).toMatch(/exists \(select 1 from "purchasing"\."purchase_order" as "p\d+" where "p\d+"\."purchase_order" = \$1::text and "p\d+"\."purchase_order" = "t\d+"\."purchase_order"\)/);
    const m = compile("PurchaseOrderItems(PurchaseOrder='4500000001',PurchaseOrderItem=10)/_Material", '');
    expect(m.sql).toContain('from "purchasing"."material"');
    expect(m.parameters.slice(0, 2)).toEqual(['4500000001', '10']);
  });
});

describe('SQL: Capabilities annotations are enforced', () => {
  it('NonFilterableProperties, NonSortableProperties, Searchable, Countable', () => {
    rejects(() => compile('PurchaseOrders', "$filter=Notes eq 'x'"), 400, 'PropertyNotFilterable');
    rejects(() => compile('PurchaseOrders', '$orderby=Description'), 400, 'PropertyNotSortable');
    rejects(() => compile('Plants', '$search=x'), 400, 'SearchNotSupported');
    rejects(() => compile('ItemHistory', '$count=true'), 400, 'CountNotSupported');
  });

  it('FilterExpressionRestrictions', () => {
    rejects(() => compile('PurchaseOrders', "$filter=PurchaseOrderType ne 'NB'"), 400, 'FilterExpressionNotAllowed'); // SingleValue
    rejects(() => compile('PurchaseOrders', "$filter=PurchaseOrderType eq 'NB' or PurchaseOrderType eq 'FO'"), 400, 'FilterExpressionNotAllowed');
    rejects(() => compile('PurchaseOrders', "$filter=PurchasingGroup ge 'P01'"), 400, 'FilterExpressionNotAllowed'); // MultiValue
    rejects(() => compile('PurchaseOrders', "$filter=Description eq 'x'"), 400, 'FilterExpressionNotAllowed'); // SearchExpression
    compile('PurchaseOrders', "$filter=PurchasingGroup eq 'P01' or PurchasingGroup eq 'P02'");
    compile('PurchaseOrders', '$filter=OrderDate ge 2026-01-01 and OrderDate le 2026-02-01');
    compile('PurchaseOrders', "$filter=contains(Description,'x')");
  });
});

describe('SQL: data scope (permissions) at the query-plan layer', () => {
  const scope = (set: string) => (set === 'PurchaseOrders' ? "CompanyCode eq '1000'" : set === 'Suppliers' ? 'IsBlocked eq false' : undefined);

  it('restricts the addressed set, joined sets, parents in the path and $apply', () => {
    const root = compile('PurchaseOrders', '$top=1', { scope });
    expect(root.sql).toContain('"t0"."company_code" = $1::text');
    expect(root.parameters[0]).toBe('1000');
    const joined = compile('PurchaseOrders', '$orderby=_Supplier/SupplierName', { scope });
    expect(joined.sql).toMatch(/left join "purchasing"\."supplier" as "t\d" on "t\d"\."supplier" = "t0"\."supplier" and "t\d"\."is_blocked" = \$\d+::boolean/);
    const child = compile("PurchaseOrders('4500000001')/_Item", '', { scope });
    expect(child.sql).toMatch(/exists \(select 1 from "purchasing"\."purchase_order" as "p\d+" where .* and "p\d+"\."company_code" = \$\d+::text\)/);
    const agg = compile('PurchaseOrders', '$apply=groupby((Status),aggregate(NetAmount with sum as NetAmount))', { scope });
    expect(agg.sql).toContain('"t0"."company_code" = $1::text');
    const expanded = compile('PurchaseOrders', '$expand=_Supplier', { scope });
    expect(expanded.sql).toMatch(/"is_blocked" = \$\d+::boolean/);
  });
});
