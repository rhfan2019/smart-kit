// The purchasing service on PostgreSQL, served by @rhfan2019/smart-kit-server:
//   http://localhost:4402/odata/purchasing/
// Reads, direct save (PATCH with ETag, POST, DELETE), saved views (Variants) and the bound actions approve / reject /
// close; the business rules are in rules.ts. No drafts (the draft service stays on the in-memory test service).
// Prerequisite: `npm run pg:setup` (database) — `npm run pg:generate` only after a schema change.
//
// Environment: PG_SERVER_PORT (default 4402), SMART_KIT_DATABASE_URL (default: the app role on localhost),
// E2E=1: POST /test/reset restores the data (only when something was written since the last reset).
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { createODataService, createPostgresDb, toNodeListener, type StorageMapping } from '@rhfan2019/smart-kit-server';
import { actions, afterRead, entitySets } from './rules';

const root = import.meta.dirname;
const PORT = Number(process.env.PG_SERVER_PORT ?? 4402);
const DATABASE_URL = process.env.SMART_KIT_DATABASE_URL ?? 'postgresql://smart_kit_app@localhost:5432/smart_kit_purchasing';
const E2E = process.env.E2E === '1';
const read = (rel: string) => readFileSync(join(root, rel), 'utf8');
const labels = (lang: string) => JSON.parse(read(`../mock/Csdl/labels.${lang}.json`)) as Record<string, string>;

const { db, pool } = createPostgresDb({ connectionString: DATABASE_URL });
const service = createODataService({
  basePath: '/odata/purchasing/',
  metadata: {
    csdl: read('generated/purchasing.csdl.xml'),
    annotations: [read('annotations/purchasing.annotations.xml')],
    labels: { en: labels('en'), zh: labels('zh') },
  },
  storage: JSON.parse(read('generated/purchasing.storage.json')) as StorageMapping,
  db,
  // Same search fields as the in-memory test service (apps/mock/server.mjs), so that both find the same rows.
  searchFields: {
    PurchaseOrders: ['PurchaseOrder', 'Description', '_Supplier/SupplierName'],
    PurchaseOrderItems: ['Material', 'Plant', '_Material/MaterialName'],
    Suppliers: ['Supplier', 'SupplierName', 'City'],
    Materials: ['Material', 'MaterialName'],
  },
  entitySets,
  actions,
  afterRead,
  // the reused API specs read up to ~6 000 rows in one request (sums over all orders of a company code)
  maxPageSize: 10_000,
  // Data scope (permissions), e.g. one company code per user: PG_SCOPE_COMPANY=1000 restricts purchase orders.
  scope: (entitySet) => (entitySet === 'PurchaseOrders' && process.env.PG_SCOPE_COMPANY ? `CompanyCode eq '${process.env.PG_SCOPE_COMPANY.replace(/'/g, "''")}'` : undefined),
  onError: (e, req) => console.error('[pg-server]', req.method, req.url, e),
});

// E2E: remember whether anything was written, so that a reset only costs time when it is needed.
let dirty = false;
const odata = toNodeListener(async (r) => {
  const res = await service.handle(r);
  if (r.method !== 'GET' && r.method !== 'HEAD' && res.status < 300) dirty = true;
  return res;
});
const server = createServer((req, res) => {
  // Local development only: CORS for localhost origins, as the in-memory test service does.
  const origin = req.headers.origin;
  if (origin && /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Expose-Headers', 'ETag, OData-Version, Location, sap-messages, X-Smart-Kit-Service');
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('X-Smart-Kit-Service', 'postgres'); // lets the end-to-end tests see which service answered
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS', 'Access-Control-Allow-Headers': req.headers['access-control-request-headers'] ?? '*' });
    return res.end();
  }
  if (req.url === '/test/reset' && req.method === 'POST' && E2E) {
    const was = dirty;
    dirty = false;
    (was ? pool.query('select purchasing_seed.reset()') : Promise.resolve())
      .then(() => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ reset: was }));
      })
      .catch((e: Error) => {
        dirty = was;
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      });
    return;
  }
  if (req.url === '/' || req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ services: ['/odata/purchasing/'], database: DATABASE_URL.replace(/:[^:@/]*@/, ':***@') }));
  }
  void odata(req, res);
});
server.on('error', (e: NodeJS.ErrnoException) => {
  if (e.code === 'EADDRINUSE') console.error(`[pg-server] Port ${PORT} is already in use (lsof -nP -iTCP:${PORT} -sTCP:LISTEN), or set PG_SERVER_PORT.`);
  else console.error('[pg-server]', e);
  process.exit(1);
});
// Check the database before accepting requests: a clear message instead of 500s.
pool
  .query('select count(*) from purchasing.purchase_order')
  .then(() => server.listen(PORT, '127.0.0.1', () => console.log(`[pg-server] http://localhost:${PORT}/odata/purchasing/  (PostgreSQL ${DATABASE_URL.replace(/:[^:@/]*@/, ':***@')})`)))
  .catch((e: Error) => {
    console.error(`[pg-server] Cannot read the database (${e.message}). Run "npm run setup -w pg-server" first.`);
    process.exit(1);
  });
