// Local OData V4 test services on http://localhost:4400 (docs/08-test-services.md):
//   /odata/northwind/   Northwind-like, structure only, no annotations
//   /odata/purchasing/  purchase orders with full UI annotations, labels in English and Chinese
//
// Query evaluation, $expand/$select, paging, CRUD: @sap-ux/fe-mockserver-core (SAP open source, Apache-2.0).
// This file adds what that engine does not cover: per-language $metadata (XML and CSDL JSON), rejection of
// requests that violate the Capabilities annotations, $search over configured fields, optimistic
// concurrency (ETag / If-Match on Version), updatable-field checks, IEEE754Compatible decimals, CORS,
// supplier logos and the e2e reset endpoint.
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import feMockserver from '@sap-ux/fe-mockserver-core';
import { convert } from '@sap-ux/annotation-converter';
import { parse } from '@sap-ux/edmx-parser';
import { applyLabels, csdlXmlToJson, stripComments } from './lib/csdl.mjs';
import { initialData, resetData } from './lib/datasets.mjs';
import { encodeFilterLiterals, searchTerm, searchToFilter } from './lib/filter.mjs';
import { ZH_TEXTS } from './lib/purchasing.mjs';

const FEMockserver = feMockserver.default ?? feMockserver;
const root = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.MOCK_PORT ?? 4400);
const E2E = process.env.E2E === '1';
const CAP = 'Capabilities';

// ------------------------------------------------------------------ metadata
const csdlDir = join(root, 'Csdl');
const genDir = join(root, 'data');
mkdirSync(genDir, { recursive: true });

const template = readFileSync(join(csdlDir, 'purchasing.template.xml'), 'utf8');
const label = (lang) => JSON.parse(readFileSync(join(csdlDir, `labels.${lang}.json`), 'utf8'));
const metadataDocs = {
  northwind: { en: stripComments(readFileSync(join(csdlDir, 'northwind.xml'), 'utf8')) },
  purchasing: {
    en: stripComments(applyLabels(template, label('en'), 'en')),
    zh: stripComments(applyLabels(template, label('zh'), 'zh')),
  },
};
const json = {};
for (const [svc, byLang] of Object.entries(metadataDocs)) {
  json[svc] = {};
  for (const [lang, xml] of Object.entries(byLang)) json[svc][lang] = JSON.stringify(csdlXmlToJson(xml));
  writeFileSync(join(genDir, `${svc}.xml`), byLang.en); // input of the query engine (labels do not matter there)
}

/** Per service: entity sets with their type, capabilities, navigation bindings; decimal scales by property name. */
const services = {};
for (const svc of Object.keys(metadataDocs)) {
  const meta = convert(parse(metadataDocs[svc].en));
  const sets = {};
  for (const es of meta.entitySets) {
    const caps = es.annotations?.[CAP] ?? {};
    const paths = (rec, prop) => new Set((rec?.[prop] ?? []).map((p) => p.value ?? p.path ?? String(p)));
    sets[es.name] = {
      type: es.entityType,
      bindings: Object.fromEntries(Object.entries(es.navigationPropertyBinding ?? {}).map(([k, v]) => [k, v.name])),
      searchable: caps.SearchRestrictions?.Searchable?.valueOf() === true,
      countable: caps.CountRestrictions?.Countable?.valueOf() !== false,
      filterable: caps.FilterRestrictions?.Filterable?.valueOf() !== false,
      nonFilterable: paths(caps.FilterRestrictions, 'NonFilterableProperties'),
      sortable: caps.SortRestrictions?.Sortable?.valueOf() !== false,
      nonSortable: paths(caps.SortRestrictions, 'NonSortableProperties'),
      hasVersion: es.entityType.entityProperties.some((p) => p.name === 'Version'),
    };
  }
  const decimals = {};
  for (const et of meta.entityTypes)
    for (const p of et.entityProperties) {
      if (p.type !== 'Edm.Decimal' && p.type !== 'Edm.Int64') continue;
      const scale = p.type === 'Edm.Int64' ? 0 : Number(p.scale ?? 0);
      if (p.name in decimals && decimals[p.name] !== scale) throw new Error(`[mock] ${svc}: property ${p.name} has different scales`);
      decimals[p.name] = scale;
    }
  services[svc] = { sets, decimals };
}

// ------------------------------------------------------------------ $search fields
const purchasing = () => ({ suppliers: initialData('purchasing', 'Suppliers'), materials: initialData('purchasing', 'Materials') });
const nameLookup = (rows, key, name) => (term) => rows().filter((r) => r[name].toLowerCase().includes(term)).map((r) => r[key]);
const SEARCH = {
  purchasing: {
    PurchaseOrders: { fields: ['PurchaseOrder', 'Description'], lookups: [{ property: 'Supplier', keys: nameLookup(() => purchasing().suppliers, 'Supplier', 'SupplierName') }] },
    PurchaseOrderItems: { fields: ['Material', 'Plant'], lookups: [{ property: 'Material', keys: nameLookup(() => purchasing().materials, 'Material', 'MaterialName') }] },
    Suppliers: { fields: ['Supplier', 'SupplierName', 'City'] },
    Materials: { fields: ['Material', 'MaterialName'] },
  },
};

/** Properties a PATCH may change, per entity set (others: 400). Sets not listed are read-only. */
const UPDATABLE = {
  purchasing: {
    PurchaseOrders: ['Description', 'Notes', 'PurchaseOrderType', 'PurchasingGroup', 'OrderDate'],
    PurchaseOrderItems: ['DeliveryDate', 'Plant'],
    Variants: ['PageKey', 'Name', 'IsDefault', 'AutoApply', 'Content'],
  },
};

// ------------------------------------------------------------------ query engine
const engine = new FEMockserver({
  services: Object.keys(metadataDocs).map((svc) => ({
    urlPath: `/odata/${svc}`,
    metadataPath: join(genDir, `${svc}.xml`),
    mockdataPath: join(root, 'mockdata', svc),
    generateMockData: false,
    noETag: true,
  })),
});
await engine.isReady;
const router = engine.getRouter();

// ------------------------------------------------------------------ helpers
const langOf = (req) => (/^\s*zh/i.test(req.headers['accept-language'] ?? '') ? 'zh' : 'en');
const etagOf = (version) => `W/"${Buffer.from(String(version)).toString('base64')}"`;

function sendJson(res, status, body, headers = {}) {
  const text = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; odata.metadata=minimal', 'OData-Version': '4.0', ...headers });
  res.end(text);
}
const odataError = (res, status, code, message) => sendJson(res, status, { error: { code, message } });

function cors(req, res) {
  const origin = req.headers.origin;
  if (!origin) return;
  let host;
  try {
    host = new URL(origin).hostname;
  } catch {
    return;
  }
  if (host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host.endsWith('.localhost')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Expose-Headers', 'ETag, OData-Version, Location, Preference-Applied');
    res.setHeader('Vary', 'Origin');
  }
}

/** Resolves "PurchaseOrders('1')/_Item" to the addressed entity set, whether a single entity is addressed, and /$count. */
function resolveTarget(svc, resourcePath) {
  const segs = resourcePath.split('/').filter(Boolean).map(decodeURIComponent);
  const { sets } = services[svc];
  let set;
  let single = false;
  let count = false;
  for (const seg of segs) {
    if (seg === '$count') {
      count = true;
      continue;
    }
    const m = /^([^(]+)(\((.*)\))?$/.exec(seg);
    if (!m) return undefined;
    const name = m[1];
    if (!set) {
      set = sets[name] ? name : undefined;
      if (!set) return undefined;
      single = !!m[2];
    } else {
      const target = sets[set].bindings[name];
      if (!target) return undefined;
      const nav = sets[set].type.navigationProperties.find((n) => n.name === name);
      set = target;
      single = !!m[2] || !nav?.isCollection;
    }
  }
  return set ? { set, single, count } : undefined;
}

/** Collects property names referenced on the target itself (not inside lambda variables) in an expression. */
function referencedProperties(expr) {
  const withoutLiterals = expr.replace(/'(?:[^']|'')*'/g, "''");
  const names = new Set();
  for (const m of withoutLiterals.matchAll(/(?<![\w/.:])([A-Za-z_]\w*)(?![\w(:])/g)) names.add(m[1]);
  return names;
}

function checkCapabilities(svc, target, params) {
  const set = services[svc].sets[target.set];
  const search = params.get('$search');
  if (search !== null && !set.searchable)
    return ['SearchNotSupported', `Entity set '${target.set}' does not support $search (Capabilities.SearchRestrictions/Searchable is not true).`];
  if ((target.count || params.get('$count') === 'true') && !set.countable)
    return ['CountNotSupported', `Entity set '${target.set}' is not countable (Capabilities.CountRestrictions/Countable is false).`];
  const filter = params.get('$filter');
  if (filter !== null) {
    if (!set.filterable) return ['FilterNotSupported', `Entity set '${target.set}' does not support $filter.`];
    for (const p of referencedProperties(filter))
      if (set.nonFilterable.has(p)) return ['PropertyNotFilterable', `Property '${p}' of entity set '${target.set}' is not filterable (Capabilities.FilterRestrictions/NonFilterableProperties).`];
  }
  const orderby = params.get('$orderby');
  if (orderby !== null) {
    if (!set.sortable) return ['SortNotSupported', `Entity set '${target.set}' does not support $orderby.`];
    for (const item of orderby.split(',')) {
      const p = item.trim().split(/\s+/)[0];
      if (set.nonSortable.has(p)) return ['PropertyNotSortable', `Property '${p}' of entity set '${target.set}' is not sortable (Capabilities.SortRestrictions/NonSortableProperties).`];
    }
  }
  return undefined;
}

/** Rewrites $search into $filter and encodes string literals for the query engine. */
function rewriteQuery(svc, target, params) {
  const search = params.get('$search');
  let filter = params.get('$filter');
  if (search !== null && search.trim() !== '') {
    const conf = SEARCH[svc]?.[target.set];
    const fragment = conf ? searchToFilter(search, (t) => searchTerm(t, conf.fields, conf.lookups)) : 'false';
    filter = filter ? `(${filter}) and ${fragment}` : fragment;
  }
  params.delete('$search');
  if (filter !== null) params.set('$filter', encodeFilterLiterals(filter));
  // the ETag is computed from Version, so it is always read
  const select = params.get('$select');
  if (select && services[svc].sets[target.set].hasVersion && !select.split(',').includes('Version')) params.set('$select', `${select},Version`);
}

/** Decimal and Int64 values as strings with the declared scale; localized code-list texts; ETags. */
function postProcess(body, svc, target, { ieee754, lang }) {
  const { decimals } = services[svc];
  const zh = lang === 'zh' && svc === 'purchasing';
  const withEtag = target && services[svc].sets[target.set]?.hasVersion;
  const visit = (node, top) => {
    if (Array.isArray(node)) {
      for (const n of node) visit(n, top);
      return;
    }
    if (!node || typeof node !== 'object') return;
    for (const [k, v] of Object.entries(node)) {
      if (v && typeof v === 'object') visit(v, false);
      else if (ieee754 && typeof v === 'number' && k in decimals) node[k] = v.toFixed(decimals[k]);
      else if (zh && typeof v === 'string' && ZH_TEXTS[k]?.[v]) node[k] = ZH_TEXTS[k][v];
    }
    if (top && withEtag && node.Version !== undefined) node['@odata.etag'] = etagOf(node.Version);
    delete node['@odata.metadataEtag'];
  };
  if (Array.isArray(body.value)) {
    visit(body.value, true);
    if (!target?.withCount) delete body['@odata.count']; // the engine always counts; OData only does on $count=true
  } else visit(body, true);
  delete body['@odata.metadataEtag'];
  return body;
}

/** Hands a request to the query engine and post-processes its JSON response. */
function forward(req, res, svc, target) {
  const ieee754 = /IEEE754Compatible=true/i.test(req.headers.accept ?? '') || /IEEE754Compatible=true/i.test(req.headers['content-type'] ?? '');
  const lang = langOf(req);
  const chunks = [];
  const origWrite = res.write.bind(res);
  const origEnd = res.end.bind(res);
  res.write = (chunk, ...rest) => {
    if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, typeof rest[0] === 'string' ? rest[0] : 'utf8'));
    return true;
  };
  res.end = (chunk, ...rest) => {
    if (chunk && typeof chunk !== 'function') chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, typeof rest[0] === 'string' ? rest[0] : 'utf8'));
    let out = Buffer.concat(chunks);
    const type = String(res.getHeader('content-type') ?? '');
    if (type.includes('json') && out.length) {
      try {
        const body = postProcess(JSON.parse(out.toString('utf8')), svc, target, { ieee754, lang });
        if (target?.single && body['@odata.etag']) res.setHeader('ETag', body['@odata.etag']);
        out = Buffer.from(JSON.stringify(body));
        if (!ieee754) res.setHeader('Content-Type', type.replace(/;?\s*IEEE754Compatible=true/i, ''));
      } catch {
        /* not a JSON document: pass through */
      }
    }
    if (!res.headersSent) res.setHeader('Content-Length', out.length);
    origWrite(out);
    return origEnd();
  };
  router(req, res, () => odataError(res, 404, 'NotFound', `No resource at ${req.url}`));
}

async function readBody(req) {
  const parts = [];
  for await (const c of req) parts.push(c);
  return Buffer.concat(parts).toString('utf8');
}

/** Reads the current entity through the engine (for If-Match and Version). */
async function currentEntity(url) {
  const res = await fetch(`http://localhost:${PORT}${url}`, { headers: { Accept: 'application/json' } });
  return res.ok ? res.json() : undefined;
}

async function handleWrite(req, res, svc, target, url) {
  const raw = await readBody(req);
  let body = {};
  if (raw.trim()) {
    try {
      body = JSON.parse(raw);
    } catch {
      return odataError(res, 400, 'InvalidBody', 'Request body is not valid JSON.');
    }
  }
  const allowed = UPDATABLE[svc]?.[target.set];
  if (req.method === 'PATCH' || req.method === 'PUT') {
    if (!allowed) return odataError(res, 405, 'NotUpdatable', `Entity set '${target.set}' is read-only.`);
    const bad = Object.keys(body).filter((k) => !k.startsWith('@') && !allowed.includes(k));
    if (bad.length) return odataError(res, 400, 'PropertyNotUpdatable', `Properties not updatable: ${bad.join(', ')}. Updatable: ${allowed.join(', ')}.`);
    const current = await currentEntity(url.pathname);
    if (!current) return odataError(res, 404, 'NotFound', `${url.pathname} not found.`);
    if (services[svc].sets[target.set].hasVersion) {
      const ifMatch = req.headers['if-match'];
      if (ifMatch && ifMatch !== '*' && ifMatch !== etagOf(current.Version))
        return odataError(res, 412, 'PreconditionFailed', 'The entity was changed by someone else (ETag mismatch).');
      body.Version = Number(current.Version) + 1;
    }
    if (target.set === 'Variants') body.ModifiedAt = new Date().toISOString();
  } else if (req.method === 'POST') {
    if (target.set !== 'Variants') return odataError(res, 405, 'NotInsertable', `Entity set '${target.set}' does not support create.`);
    body.ModifiedAt = new Date().toISOString();
  } else if (req.method === 'DELETE' && target.set !== 'Variants') {
    return odataError(res, 405, 'NotDeletable', `Entity set '${target.set}' does not support delete.`);
  }
  req.body = Buffer.from(JSON.stringify(body));
  req._body = true; // body already read: tell body-parser in the engine to keep req.body
  req.headers['content-type'] = 'application/json';
  delete req.headers['if-match'];
  forward(req, res, svc, target);
}

// ------------------------------------------------------------------ supplier logos
function supplierLogo(id) {
  const s = initialData('purchasing', 'Suppliers').find((x) => x.Supplier === id);
  const initials = s
    ? s.SupplierName.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('')
    : id.replace(/^0+/, '').padStart(2, '0').slice(-2);
  let h = 2166136261;
  for (const c of id) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  const hue = h % 360;
  const esc = (t) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
  <circle cx="48" cy="48" r="48" fill="hsl(${hue},55%,42%)"/>
  <circle cx="48" cy="48" r="40" fill="none" stroke="hsl(${(hue + 40) % 360},70%,75%)" stroke-width="3"/>
  <text x="48" y="49" font-family="Helvetica,Arial,sans-serif" font-size="34" font-weight="700" fill="#fff" text-anchor="middle" dominant-baseline="central">${esc(initials)}</text>
</svg>`;
}

// ------------------------------------------------------------------ server
async function reset() {
  resetData('purchasing');
  for (const name of engine.getServiceRegistry().getServiceNames()) engine.getServiceRegistry().getService(name)?.reloadData?.();
}

async function handle(req, res) {
  try {
    cors(req, res);
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': req.headers['access-control-request-headers'] ?? '*',
        'Access-Control-Max-Age': '600',
      });
      return res.end();
    }
    const url = new URL(req.url, `http://localhost:${PORT}`);
    if (url.pathname === '/' && req.method === 'GET')
      return sendJson(res, 200, { services: ['/odata/northwind/', '/odata/purchasing/'], media: '/media/suppliers/{id}.svg', e2e: E2E });
    const logo = /^\/media\/suppliers\/([\w-]+)\.svg$/.exec(url.pathname);
    if (logo && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
      return res.end(supplierLogo(logo[1]));
    }
    if (url.pathname === '/test/reset' && req.method === 'POST' && E2E) {
      await reset();
      return sendJson(res, 200, { reset: true });
    }
    const m = /^\/odata\/(northwind|purchasing)(\/.*)?$/.exec(url.pathname);
    if (!m) return odataError(res, 404, 'NotFound', `No resource at ${url.pathname}`);
    const svc = m[1];
    const resource = m[2] ?? '/';
    if (resource === '/$metadata') {
      const lang = metadataDocs[svc][langOf(req)] ? langOf(req) : 'en';
      const format = url.searchParams.get('$format') ?? '';
      const accept = req.headers.accept ?? '';
      const asJson = /^(json|application\/json)/i.test(format) || (!format && accept.includes('application/json') && !accept.includes('xml'));
      res.writeHead(200, { 'Content-Type': `${asJson ? 'application/json' : 'application/xml'}; charset=utf-8`, 'OData-Version': '4.0' });
      return res.end(asJson ? json[svc][lang] : metadataDocs[svc][lang]);
    }
    if (resource === '/' || resource === '/$batch') return forward(req, res, svc, undefined);
    const target = resolveTarget(svc, resource);
    if (!target) return odataError(res, 404, 'NotFound', `No resource at ${url.pathname}`);
    if (req.method === 'GET') {
      const error = checkCapabilities(svc, target, url.searchParams);
      if (error) return odataError(res, 400, error[0], error[1]);
      try {
        rewriteQuery(svc, target, url.searchParams);
      } catch (e) {
        return odataError(res, 400, 'InvalidSearch', e.message);
      }
      target.withCount = url.searchParams.get('$count') === 'true';
      req.url = url.pathname + (url.searchParams.size ? `?${url.searchParams.toString().replace(/\+/g, '%20')}` : '');
      return forward(req, res, svc, target);
    }
    return await handleWrite(req, res, svc, target, url);
  } catch (e) {
    console.error('[mock]', e);
    if (!res.headersSent) odataError(res, 500, 'InternalError', String(e?.message ?? e));
    else res.end();
  }
}

// Loopback only (IPv4 and IPv6), never the network.
const server = createServer(handle);
server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`[mock] Port ${PORT} is already in use: the mock server (or another program) is already running.`);
    console.error(`[mock] Stop it first (macOS/Linux: lsof -nP -iTCP:${PORT} -sTCP:LISTEN), or set MOCK_PORT.`);
  } else console.error('[mock]', e);
  process.exit(1);
});
server.listen(PORT, '127.0.0.1', () => {
  const v6 = createServer(handle);
  v6.on('error', () => {}); // no IPv6 loopback: IPv4 is enough
  v6.listen(PORT, '::1');
  console.log(`[mock] http://localhost:${PORT}  services: /odata/northwind/  /odata/purchasing/${E2E ? '  (E2E=1: POST /test/reset)' : ''}`);
});
