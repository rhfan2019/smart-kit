// Conformance (ADR-027): the same requests to the in-memory test service (@sap-ux/fe-mockserver-core, apps/mock) and
// to smart-kit-server on PostgreSQL (apps/pg-server's database, seeded from the same generator); the responses must
// be equal. The requests are the shapes smart-kit sends (docs/query-shapes.md, docs/05 §2–3).
// Skipped when the database is not set up (npm run setup -w pg-server).
import { spawn, type ChildProcess } from 'node:child_process';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createODataService, createPostgresDb, type ODataService } from '../src/index';
import { metadataSource, storage } from './fixture';

const ROOT = join(import.meta.dirname, '../../..');
const MOCK_PORT = Number(process.env.CONFORMANCE_MOCK_PORT ?? 4495);
const MOCK = `http://localhost:${MOCK_PORT}/odata/purchasing/`;
const PG = 'http://pg.test/odata/purchasing/';
const DATABASE_URL = process.env.SMART_KIT_DATABASE_URL ?? 'postgresql://smart_kit_reader@localhost:5432/smart_kit_purchasing';
const HEADERS = { Accept: 'application/json;odata.metadata=minimal;IEEE754Compatible=true', 'Accept-Language': 'en' };

const { db, pool } = createPostgresDb({ connectionString: DATABASE_URL });
const available = await pool.query('select 1 from purchasing.purchase_order limit 1').then(() => true, () => false);
// CI sets SMART_KIT_REQUIRE_PG=1: there a missing database is a failure, not a skip.
if (!available && process.env.SMART_KIT_REQUIRE_PG === '1') throw new Error(`PostgreSQL test database not reachable (${process.env.SMART_KIT_DATABASE_URL ?? 'default URL'}); run npm run pg:setup`);

/** Response bodies without what legitimately differs: context URLs, ETags, and the Version the mock always adds. */
function normalize(body: unknown, selected?: Set<string>): unknown {
  if (Array.isArray(body)) return body.map((x) => normalize(x, selected));
  if (!body || typeof body !== 'object') return body;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (k === '@odata.context' || k === '@odata.etag' || k === '@odata.metadataEtag') continue;
    if (k === 'Version' && selected && !selected.has('Version')) continue;
    out[k] = normalize(v, selected);
  }
  return out;
}

const SHAPES: [name: string, path: string][] = [
  // list report (A1, A4, A5): count, select, single-valued expands, search, sort with the currency first, paging
  ['list, first block', "PurchaseOrders?$count=true&$select=PurchaseOrder,Supplier,OrderDate,Status,StatusCriticality,NetAmount,Currency,DeliveredPercent,PurchaseOrderType&$orderby=OrderDate desc&$expand=_Supplier($select=Supplier,SupplierName,Rating),_Status($select=Code,Name)&$skip=0&$top=100"],
  ['list, second block', 'PurchaseOrders?$select=PurchaseOrder,NetAmount,Currency&$orderby=OrderDate desc&$skip=100&$top=100'],
  ['list, search', 'PurchaseOrders?$count=true&$select=PurchaseOrder,Description,Supplier&$search=steel&$orderby=PurchaseOrder&$top=50'],
  ['list, search two terms', 'PurchaseOrders?$count=true&$select=PurchaseOrder&$search=spare%20line&$top=30'],
  ['list, search over the supplier name', 'PurchaseOrders?$count=true&$select=PurchaseOrder,Supplier&$search=Fenufield&$top=30'],
  ['list, sort amount with the currency first (Q-05b)', 'PurchaseOrders?$count=true&$select=PurchaseOrder,NetAmount,Currency&$orderby=Currency,NetAmount desc&$top=40'],
  ['list, filter bar conditions', "PurchaseOrders?$count=true&$select=PurchaseOrder,Status,CompanyCode,OrderDate&$filter=(Status eq 'ORD' or Status eq 'PART') and CompanyCode eq '1000' and OrderDate ge 2026-01-01 and OrderDate le 2026-06-30&$orderby=PurchaseOrder&$top=100"],
  ['list, exclude and range', "PurchaseOrders?$count=true&$select=PurchaseOrder,NetAmount&$filter=not (Status eq 'CLOSED') and (NetAmount ge 1000 and NetAmount le 5000)&$orderby=NetAmount&$top=50"],
  ['list, string functions', "PurchaseOrders?$count=true&$select=PurchaseOrder,Description&$filter=contains(Description,'line 3') and startswith(Description,'Order')&$top=50"],
  ['list, filter over a navigation', "PurchaseOrders?$count=true&$select=PurchaseOrder,Supplier&$filter=_Supplier/Country eq 'DE'&$orderby=PurchaseOrder&$top=20"],
  ['list, date and time', "PurchaseOrders?$count=true&$select=PurchaseOrder,CreatedAt&$filter=CreatedAt ge 2026-10-01T00:00:00%2B02:00 and CreatedAt lt 2026-10-02T00:00:00Z&$orderby=CreatedAt&$top=50"],
  ['list, empty page with count', "PurchaseOrders?$count=true&$select=PurchaseOrder&$filter=Status eq 'REJ'&$top=10"],
  ['list, $top=0', 'PurchaseOrders?$count=true&$top=0'],
  // object page (A6) and child tables (A7, Q-06)
  ['object, header and sections', "PurchaseOrders('4500000001')?$select=PurchaseOrder,Description,Supplier,CompanyCode,PurchasingGroup,OrderDate,CreatedAt,Status,StatusCriticality,NetAmount,Currency,DeliveredPercent,Notes,BudgetAmount,InvoicedAmount,PurchaseOrderType&$expand=_Supplier($select=Supplier,SupplierName,LogoUrl,Rating,RatingCount,City),_Status($select=Code,Name),_PurchaseOrderType($select=Code,Name)"],
  ['object, all properties', "PurchaseOrders('4500000042')"],
  ['child table, first rows', "PurchaseOrders('4500000001')/_Item?$count=true&$select=PurchaseOrder,PurchaseOrderItem,Material,Plant,OrderQuantity,OrderUnit,NetPrice,NetAmount,Currency,DeliveryDate&$expand=_Material($select=Material,MaterialName)&$orderby=PurchaseOrderItem&$skip=0&$top=10"],
  ['child table, more rows', "PurchaseOrders('4500000001')/_Item?$select=PurchaseOrderItem,NetAmount&$orderby=PurchaseOrderItem&$skip=10&$top=20"],
  ['child table, sorted', "PurchaseOrders('4500000002')/_Item?$count=true&$select=PurchaseOrderItem,NetAmount&$orderby=NetAmount desc&$top=15"],
  ['sub-object page', "PurchaseOrderItems(PurchaseOrder='4500000001',PurchaseOrderItem=10)?$select=PurchaseOrder,PurchaseOrderItem,Material,OrderQuantity,OrderUnit,ReceivedQuantity,InvoicedAmount&$expand=_Material($select=Material,MaterialName),_Plant($select=Plant,PlantName)"],
  ['sub-object child table', "PurchaseOrderItems(PurchaseOrder='4500000001',PurchaseOrderItem=10)/_PricingCondition?$count=true&$orderby=ConditionCounter&$top=10"],
  ['history (not countable)', "PurchaseOrderItems(PurchaseOrder='4500000001',PurchaseOrderItem=10)/_History?$orderby=PostingDate,HistoryCounter&$top=10"],
  // value helps (A2, A3, Q-09)
  ['value help', 'Suppliers?$select=Supplier,SupplierName,Country,City&$count=true&$orderby=Supplier&$skip=0&$top=50'],
  ['value help, search', 'Suppliers?$select=Supplier,SupplierName,City&$count=true&$search=hamburg&$orderby=Supplier&$top=50'],
  ['value help, keys of tokens', "Suppliers?$select=Supplier,SupplierName&$filter=Supplier eq '0000100001' or Supplier eq '0000100007'&$orderby=Supplier&$top=50"],
  ['value help, contains fallback', "Plants?$select=Plant,PlantName,City&$count=true&$filter=(contains(Plant,'0') or contains(PlantName,'Plant'))&$orderby=Plant&$top=50"],
  ['value help, code list', 'OrderStatuses?$select=Code,Name,Criticality&$count=true&$orderby=Code&$top=50'],
  ['value help, materials', 'Materials?$select=Material,MaterialName,BaseUnit&$count=true&$search=bolt&$orderby=Material&$top=50'],
  // chart view and analytical facets ($apply, ADR-021)
  ['chart by status', 'PurchaseOrders?$apply=groupby((Status,_Status/Name),aggregate(NetAmount with sum as NetAmount))&$orderby=Status'],
  ['chart with filter', "PurchaseOrders?$apply=filter(CompanyCode eq '2000' and OrderDate ge 2026-01-01)/groupby((PurchaseOrderType),aggregate(NetAmount with sum as NetAmount,InvoicedAmount with sum as InvoicedAmount))&$orderby=PurchaseOrderType"],
  ['chart with search', 'PurchaseOrders?$apply=search(steel)/groupby((CompanyCode),aggregate(NetAmount with sum as NetAmount))&$orderby=CompanyCode'],
  ['chart of a child collection', "PurchaseOrders('4500000001')/_Item?$apply=groupby((Plant),aggregate(NetAmount with sum as NetAmount))&$orderby=Plant"],
  // micro chart series: a collection expand with $select / $orderby (the mock ignores a nested $top, so none here)
  ['micro chart series', "PurchaseOrderItems(PurchaseOrder='4500000003',PurchaseOrderItem=10)?$select=PurchaseOrder,PurchaseOrderItem,OrderQuantity&$expand=_History($select=HistoryCounter,PostingDate,Quantity;$orderby=PostingDate)"],
  // (A list with a collection expand per row is left out: the mock takes ~45 s for it, PostgreSQL ~20 ms.)
];

/** Requests both services must reject with the same status (Capabilities annotations). */
const REJECTED: [name: string, path: string][] = [
  ['non-filterable property', "PurchaseOrders?$filter=Notes eq 'x'"],
  ['non-sortable property', 'PurchaseOrders?$orderby=Description'],
  ['search on a set that is not searchable', 'Plants?$search=x'],
  ['count on a set that is not countable', 'ItemHistory?$count=true'],
  ['filter expression restriction', "PurchaseOrders?$filter=PurchaseOrderType ne 'NB'"],
];

let mock: ChildProcess | undefined;
let pgService: ODataService;

async function waitFor(url: string, ms: number) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`${url} did not start`);
}

const get = async (path: string) => {
  const [m, p] = await Promise.all([fetch(MOCK + path, { headers: HEADERS }), pgService.handle(new Request(PG + path, { headers: HEADERS }))]);
  return { mock: { status: m.status, body: await m.json() }, pg: { status: p.status, body: await p.json() } };
};

describe.skipIf(!available)('conformance: smart-kit-server on PostgreSQL vs. fe-mockserver-core', () => {
  beforeAll(async () => {
    pgService = createODataService({
      basePath: '/odata/purchasing/',
      metadata: metadataSource(),
      storage: storage(),
      db,
      searchFields: {
        PurchaseOrders: ['PurchaseOrder', 'Description', '_Supplier/SupplierName'],
        PurchaseOrderItems: ['Material', 'Plant', '_Material/MaterialName'],
        Suppliers: ['Supplier', 'SupplierName', 'City'],
        Materials: ['Material', 'MaterialName'],
      },
    });
    mock = spawn(process.execPath, [join(ROOT, 'apps/mock/run.mjs')], { env: { ...process.env, MOCK_PORT: String(MOCK_PORT), E2E: '' }, stdio: 'ignore' });
    await waitFor(`${MOCK}$metadata`, 90_000);
  });
  afterAll(async () => {
    mock?.kill();
    await pool.end();
  });

  it.each(SHAPES)('%s', async (_name, path) => {
    const r = await get(path);
    expect(r.pg.status, JSON.stringify(r.pg.body).slice(0, 300)).toBe(200);
    expect(r.mock.status).toBe(200);
    const select = new URLSearchParams(path.split('?')[1] ?? '').get('$select');
    const selected = select ? new Set(select.split(',')) : undefined;
    expect(normalize(r.pg.body, selected)).toEqual(normalize(r.mock.body, selected));
  });

  it.each(REJECTED)('rejects: %s', async (_name, path) => {
    const r = await get(path);
    expect(r.mock.status).toBe(400);
    expect(r.pg.status).toBe(400);
    expect(r.pg.body.error.code).toBe(r.mock.body.error.code);
  });

  it('$count of a collection', async () => {
    const [m, p] = await Promise.all([
      fetch(`${MOCK}PurchaseOrders/$count?$filter=${encodeURIComponent("Status eq 'NEW'")}`).then((r) => r.text()),
      pgService.handle(new Request(`${PG}PurchaseOrders/$count?$filter=${encodeURIComponent("Status eq 'NEW'")}`)).then((r) => r.text()),
    ]);
    expect(p).toBe(m);
  });
});
