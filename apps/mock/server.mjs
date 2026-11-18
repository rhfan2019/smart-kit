// Local OData V4 test services on http://localhost:4400 (docs/08-test-services.md):
//   /odata/northwind/         Northwind-like, structure only, no annotations
//   /odata/purchasing/        purchase orders with full UI annotations, labels in English and Chinese; direct save
//   /odata/purchasing-draft/  the same service with draft (ADR-019), derived from the same template
//
// Query evaluation, $expand/$select, $apply, paging, CRUD, draft, bound actions:
// @sap-ux/fe-mockserver-core (SAP open source, Apache-2.0); the business rules run as its contributor
// hooks (lib/rules.mjs). This file adds what that engine does not cover: per-language $metadata (XML and
// CSDL JSON), rejection of requests that violate the Capabilities annotations, $search over configured
// fields, optimistic concurrency (ETag / If-Match on Version), updatable / creatable-field checks and
// validation with error details, write rules of the draft service, sap-messages warnings,
// IEEE754Compatible decimals, CORS, supplier logos and the e2e reset endpoint.
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import feMockserver from '@sap-ux/fe-mockserver-core';
import { convert } from '@sap-ux/annotation-converter';
import { parse } from '@sap-ux/edmx-parser';
import { applyLabels, csdlXmlToJson, stripComments } from './lib/csdl.mjs';
import { initialData, resetData } from './lib/datasets.mjs';
import { DRAFT_ACTIONS, toDraftTemplate } from './lib/draft.mjs';
import { encodeFilterLiterals, searchTerm, searchToFilter } from './lib/filter.mjs';
import { SEVERITY, errorBody, text } from './lib/messages.mjs';
import { ZH_TEXTS } from './lib/purchasing.mjs';
import { BOUND_ACTIONS, DRAFT_SERVICE, draftOfOther, validateItem, validateOrder } from './lib/rules.mjs';

const FEMockserver = feMockserver.default ?? feMockserver;

// The engine's draft entity set never matches a $filter on DraftAdministrativeData/InProcessByUser
// (checkSpecificProperties returns false). The editing-status filters need it: let it be evaluated
// like any other path into the inline DraftAdministrativeData.
const { DraftMockEntitySet } = createRequire(import.meta.url)('@sap-ux/fe-mockserver-core/dist/data/entitySets/draftEntitySet.js');
const engineSpecific = DraftMockEntitySet.prototype.checkSpecificProperties;
DraftMockEntitySet.prototype.checkSpecificProperties = function (expr, ...rest) {
  return expr.identifier === 'DraftAdministrativeData/InProcessByUser' ? null : engineSpecific.call(this, expr, ...rest);
};
// Memory: the engine's MockDataEntitySet.getProperty memoizes resolved properties but not misses. Every $filter
// literal ("'1000'") is looked up as a property for every row it checks; each miss goes through the annotation
// converter's resolvePath, which records a message that is kept for the life of the process. Long e2e runs grew
// by ~1 KB per checked row until the server ran out of heap. Remember misses as well.
{
  const { MockDataEntitySet } = createRequire(import.meta.url)('@sap-ux/fe-mockserver-core/dist/data/entitySets/entitySet.js');
  const getProperty = MockDataEntitySet.prototype.getProperty;
  MockDataEntitySet.prototype.getProperty = function (identifier) {
    this.__skMisses ??= new Set();
    if (this.__skMisses.has(identifier)) return undefined;
    const found = getProperty.call(this, identifier);
    if (found === undefined) this.__skMisses.add(identifier);
    return found;
  };
}
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
const draftTemplate = toDraftTemplate(template);
const metadataDocs = {
  northwind: { en: stripComments(readFileSync(join(csdlDir, 'northwind.xml'), 'utf8')) },
  purchasing: {
    en: stripComments(applyLabels(template, label('en'), 'en')),
    zh: stripComments(applyLabels(template, label('zh'), 'zh')),
  },
  [DRAFT_SERVICE]: {
    en: stripComments(applyLabels(draftTemplate, label('en'), 'en')),
    zh: stripComments(applyLabels(draftTemplate, label('zh'), 'zh')),
  },
};
const SERVICE_NAMES = Object.keys(metadataDocs);
const isPurchasing = (svc) => svc === 'purchasing' || svc === DRAFT_SERVICE;
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
      keys: es.entityType.keys.map((k) => ({ name: k.name, type: k.type })),
      bindings: Object.fromEntries(Object.entries(es.navigationPropertyBinding ?? {}).map(([k, v]) => [k, v.name])),
      searchable: caps.SearchRestrictions?.Searchable?.valueOf() === true,
      countable: caps.CountRestrictions?.Countable?.valueOf() !== false,
      filterable: caps.FilterRestrictions?.Filterable?.valueOf() !== false,
      nonFilterable: paths(caps.FilterRestrictions, 'NonFilterableProperties'),
      filterExpressions: Object.fromEntries((caps.FilterRestrictions?.FilterExpressionRestrictions ?? []).map((r) => [r.Property?.value ?? r.Property?.path ?? String(r.Property), String(r.AllowedExpressions)])),
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
const PURCHASING_SEARCH = {
  PurchaseOrders: { fields: ['PurchaseOrder', 'Description'], lookups: [{ property: 'Supplier', keys: nameLookup(() => purchasing().suppliers, 'Supplier', 'SupplierName') }] },
  PurchaseOrderItems: { fields: ['Material', 'Plant'], lookups: [{ property: 'Material', keys: nameLookup(() => purchasing().materials, 'Material', 'MaterialName') }] },
  Suppliers: { fields: ['Supplier', 'SupplierName', 'City'] },
  Materials: { fields: ['Material', 'MaterialName'] },
  CostCenters: { fields: ['CostCenter', 'CostCenterName'] },
};
const SEARCH = { purchasing: PURCHASING_SEARCH, [DRAFT_SERVICE]: PURCHASING_SEARCH };

/** Properties a PATCH may change, per entity set (others: 400). Sets not listed are read-only. */
const PURCHASING_UPDATABLE = {
  PurchaseOrders: ['Description', 'Notes', 'PurchaseOrderType', 'PurchasingGroup', 'OrderDate', 'Supplier'],
  PurchaseOrderItems: ['DeliveryDate', 'Plant', 'OrderQuantity'],
  Variants: ['PageKey', 'Name', 'IsDefault', 'AutoApply', 'Content'],
};
const UPDATABLE = { purchasing: PURCHASING_UPDATABLE, [DRAFT_SERVICE]: PURCHASING_UPDATABLE };
/** Properties a POST may set, per entity set (others: 400); immutable ones (Core.Immutable) are only here. */
const CREATABLE = {
  PurchaseOrders: [...PURCHASING_UPDATABLE.PurchaseOrders, 'CompanyCode'],
  PurchaseOrderItems: ['PurchaseOrder', 'Material', 'Plant', 'OrderQuantity', 'DeliveryDate'],
};

// ------------------------------------------------------------------ query engine
const engine = new FEMockserver({
  services: SERVICE_NAMES.map((svc) => ({
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
const odataError = (res, status, code, message, details) => sendJson(res, status, errorBody(code, message, details));

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
    res.setHeader('Access-Control-Expose-Headers', 'ETag, OData-Version, Location, Preference-Applied, sap-messages');
    res.setHeader('Vary', 'Origin');
  }
}

/**
 * Resolves "PurchaseOrders('1')/_Item" to the addressed entity set, whether a single entity is addressed,
 * /$count, a trailing bound action ("Purchasing.approve" -> action "approve", entity path before it) and
 * the IsActiveEntity key of the addressed instance (draft service).
 */
function resolveTarget(svc, resourcePath) {
  const segs = resourcePath.split('/').filter(Boolean).map(decodeURIComponent);
  const { sets } = services[svc];
  let set;
  let single = false;
  let count = false;
  let active;
  let action;
  for (const [i, seg] of segs.entries()) {
    if (seg === '$count') {
      count = true;
      continue;
    }
    const m = /^([^(]+)(\((.*)\))?$/.exec(seg);
    if (!m) return undefined;
    const name = m[1];
    const activeKey = /(?:^|,)\s*IsActiveEntity\s*=\s*(true|false)\s*(?:,|$)/.exec(m[3] ?? '');
    if (activeKey) active = activeKey[1] === 'true';
    if (!set) {
      set = sets[name] ? name : undefined;
      if (!set) return undefined;
      single = !!m[2];
    } else if (sets[set].bindings[name]) {
      const nav = sets[set].type.navigationProperties.find((n) => n.name === name);
      set = sets[set].bindings[name];
      single = !!m[2] || !nav?.isCollection;
    } else if (i === segs.length - 1 && single && name.includes('.')) {
      action = name.slice(name.lastIndexOf('.') + 1);
    } else return undefined;
  }
  return set ? { set, single, count, active, action, entityPath: action ? segs.slice(0, -1).join('/') : undefined } : undefined;
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
    // Capabilities.FilterExpressionRestrictions: reject conditions the property does not allow.
    const plain = filter.replace(/'(?:[^']|'')*'/g, "''");
    for (const [prop, kind] of Object.entries(set.filterExpressions)) {
      const ops = [...plain.matchAll(new RegExp(`(?<![\\w/])${prop}\\s+(eq|ne|gt|ge|lt|le)\\b`, 'g'))].map((m) => m[1]);
      const fns = [...plain.matchAll(new RegExp(`(contains|startswith|endswith)\\(\\s*${prop}\\b`, 'g'))].length;
      const negated = new RegExp(`not\\s*\\(?[^()]*\\b${prop}\\b`).test(plain);
      const bad =
        (kind === 'SingleValue' && (ops.some((o) => o !== 'eq') || ops.length > 1 || fns || negated)) ||
        (kind === 'MultiValue' && (ops.some((o) => o !== 'eq') || fns || negated)) ||
        (kind === 'SingleRange' && (ops.includes('ne') || ops.length > 2 || fns || negated)) ||
        (kind === 'SearchExpression' && ops.length > 0);
      if (bad) return ['FilterExpressionNotAllowed', `Property '${prop}' of entity set '${target.set}' allows only ${kind} conditions (Capabilities.FilterRestrictions/FilterExpressionRestrictions).`];
    }
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
  const zh = lang === 'zh' && isPurchasing(svc);
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
      else if (typeof v === 'number' && k in decimals) node[k] = Number(v.toFixed(decimals[k])); // aggregates: no float noise
      else if (zh && typeof v === 'string' && ZH_TEXTS[k]?.[v]) node[k] = ZH_TEXTS[k][v];
    }
    if (top && withEtag && node.Version !== undefined) node['@odata.etag'] = etagOf(node.Version);
    delete node['@odata.metadataEtag'];
    delete node.Processed; // bookkeeping of the engine's draft activation, not a property
  };
  if (Array.isArray(body.value)) {
    visit(body.value, true);
    if (!target?.withCount) delete body['@odata.count']; // the engine always counts; OData only does on $count=true
    if (target?.topZero) body.value = []; // the engine treats $top=0 as "no limit"
  } else visit(body, true);
  delete body['@odata.metadataEtag'];
  return body;
}

/** OData key predicate "(A='x',B=10,IsActiveEntity=false)" of a row. */
function keyPredicate(svc, set, row) {
  const lit = (k) => {
    const v = row[k.name];
    return k.type === 'Edm.String' ? `'${String(v).replace(/'/g, "''")}'` : String(v);
  };
  const keys = services[svc].sets[set].keys;
  return keys.length === 1 && keys[0].type === 'Edm.String' ? `(${lit(keys[0])})` : `(${keys.map((k) => `${k.name}=${lit(k)}`).join(',')})`;
}

/** sap-messages is JSON in an HTTP header: non-ASCII characters (Chinese texts) as \\uXXXX escapes. */
const asciiJson = (json) => json.replace(/[\u007f-\uffff]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);

/** Appends entries to the sap-messages header the engine may already have set. */
function addSapMessages(res, messages) {
  if (!messages.length) return;
  let current = [];
  try {
    current = JSON.parse(String(res.getHeader('sap-messages') ?? '[]'));
  } catch {
    /* not JSON: replace */
  }
  res.setHeader('sap-messages', asciiJson(JSON.stringify([...current, ...messages])));
}

/**
 * Hands a request to the query engine and post-processes its JSON response. `after(body)` may return
 * sap-messages entries for a successful response.
 */
function forward(req, res, svc, target, after) {
  const ieee754 = /IEEE754Compatible=true/i.test(req.headers.accept ?? '') || /IEEE754Compatible=true/i.test(req.headers['content-type'] ?? '');
  const lang = langOf(req);
  const chunks = [];
  const origWrite = res.write.bind(res);
  const origEnd = res.end.bind(res);
  const origSetHeader = res.setHeader.bind(res);
  res.setHeader = (name, value) => origSetHeader(name, String(name).toLowerCase() === 'sap-messages' ? asciiJson(String(value)) : value);
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
        if (target?.action && res.statusCode < 300 && !body.error) body['@odata.context'] = `$metadata#${target.set}/$entity`;
        if (res.statusCode === 201 && target && !body.error) res.setHeader('Location', `http://${req.headers.host ?? `localhost:${PORT}`}/odata/${svc}/${target.set}${keyPredicate(svc, target.set, body)}`);
        if (res.statusCode < 300 && after) addSapMessages(res, after(body));
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

/** Reads the current entity through the engine (for If-Match, Version and validation). */
async function currentEntity(svc, path) {
  const res = await fetch(`http://localhost:${PORT}/odata/${svc}/${path.replace(/^\//, '')}`, { headers: { Accept: 'application/json' } });
  return res.ok ? res.json() : undefined;
}

const ifMatchFails = (req, current) => {
  const ifMatch = req.headers['if-match'];
  return !!ifMatch && ifMatch !== '*' && ifMatch !== etagOf(current.Version);
};
const preconditionFailed = (res) => odataError(res, 412, 'PreconditionFailed', 'The entity was changed by someone else (ETag mismatch).');
const locked = (res, lang, row) => odataError(res, 409, 'LOCKED', text(lang, 'locked', row.DraftAdministrativeData.InProcessByUser));

/** sap-messages warning for a purchase order without description. */
const noDescriptionWarning = (lang) => ({ code: 'PO_NO_DESCRIPTION', message: text(lang, 'noDescription'), numericSeverity: SEVERITY.warning, target: 'Description' });
const isBlank = (v) => v === undefined || v === null || String(v).trim() === '';
const warnWithoutDescription = (lang) => (row) => (isBlank(row.Description) ? [noDescriptionWarning(lang)] : []);

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
  const lang = langOf(req);
  const draft = svc === DRAFT_SERVICE;
  const orders = target.set === 'PurchaseOrders';
  const items = target.set === 'PurchaseOrderItems';
  const resource = url.pathname.slice(`/odata/${svc}/`.length);
  const { hasVersion } = services[svc].sets[target.set];
  const invalid = (details) => odataError(res, 400, 'VALIDATION_FAILED', text(lang, orders ? 'orderInvalid' : 'itemInvalid'), details);
  let after;

  // draft service: the active version of orders and items only changes through the draft
  if (draft && (orders || items) && target.active === true && !(target.action && [DRAFT_ACTIONS.edit, ...BOUND_ACTIONS].includes(target.action)))
    return odataError(res, 400, 'DRAFT_REQUIRED', text(lang, 'editDraft'));

  if (target.action) {
    if (req.method !== 'POST') return odataError(res, 405, 'MethodNotAllowed', 'Actions are invoked with POST.');
    if (hasVersion && req.headers['if-match'] && req.headers['if-match'] !== '*') {
      const current = await currentEntity(svc, target.entityPath);
      if (!current) return odataError(res, 404, 'NotFound', `${target.entityPath} not found.`);
      if (ifMatchFails(req, current)) return preconditionFailed(res);
    }
  } else if (req.method === 'PATCH' || req.method === 'PUT') {
    const allowed = UPDATABLE[svc]?.[target.set];
    if (!allowed) return odataError(res, 405, 'NotUpdatable', `Entity set '${target.set}' is read-only.`);
    const current = await currentEntity(svc, resource);
    if (!current) return odataError(res, 404, 'NotFound', `${url.pathname} not found.`);
    // a new draft (never activated) may still set the immutable company code
    const settable = draft && orders && current.IsActiveEntity === false && !current.HasActiveEntity ? [...allowed, 'CompanyCode'] : allowed;
    const bad = Object.keys(body).filter((k) => !k.startsWith('@') && !settable.includes(k));
    if (bad.length) return odataError(res, 400, 'PropertyNotUpdatable', `Properties not updatable: ${bad.join(', ')}. Updatable: ${settable.join(', ')}.`);
    if (draftOfOther(current)) return locked(res, lang, current);
    if (hasVersion) {
      if (ifMatchFails(req, current)) return preconditionFailed(res);
      body.Version = Number(current.Version) + 1;
    }
    if (!draft && (orders || items)) {
      const merged = { ...current, ...body };
      const details = orders ? validateOrder(merged, lang) : validateItem(merged, lang);
      if (details.length) return invalid(details);
    }
    if (orders && (!draft || 'Description' in body)) after = warnWithoutDescription(lang);
    if (target.set === 'Variants') body.ModifiedAt = new Date().toISOString();
  } else if (req.method === 'POST') {
    if (target.set === 'Variants') body.ModifiedAt = new Date().toISOString();
    else if (orders || items) {
      if (target.single) return odataError(res, 405, 'MethodNotAllowed', `POST to a single ${target.set} entity is not supported.`);
      if (items && draft && !resource.includes('/')) return odataError(res, 405, 'NotInsertable', 'Create draft items through the order: PurchaseOrders(...)/_Item.');
      const allowed = CREATABLE[target.set];
      const bad = Object.keys(body).filter((k) => !k.startsWith('@') && !allowed.includes(k));
      if (bad.length) return odataError(res, 400, 'PropertyNotCreatable', `Properties not allowed on create: ${bad.join(', ')}. Allowed: ${allowed.join(', ')}.`);
      if (items) {
        const parentPath = resource.includes('/')
          ? resource.slice(0, resource.lastIndexOf('/'))
          : !isBlank(body.PurchaseOrder) ? `PurchaseOrders('${String(body.PurchaseOrder).replace(/'/g, "''")}')` : undefined;
        const parent = parentPath && (await currentEntity(svc, parentPath));
        if (!parent) return odataError(res, 404, 'NotFound', 'The purchase order of the item was not found.');
        if (draftOfOther(parent)) return locked(res, lang, parent);
        body.PurchaseOrder = parent.PurchaseOrder;
        body.DeliveryDate ??= null; // the engine would prefill today: null lets the rules default it from the order date
      }
      if (!draft) {
        const details = orders ? validateOrder(body, lang) : validateItem(body, lang);
        if (details.length) return invalid(details);
        if (orders) after = warnWithoutDescription(lang);
      }
      target.single = true; // the response is the created entity (ETag header)
    } else return odataError(res, 405, 'NotInsertable', `Entity set '${target.set}' does not support create.`);
  } else if (req.method === 'DELETE') {
    if (orders || items) {
      const current = await currentEntity(svc, resource);
      if (!current) return odataError(res, 404, 'NotFound', `${url.pathname} not found.`);
      if (draftOfOther(current)) return locked(res, lang, current);
      if (hasVersion && ifMatchFails(req, current)) return preconditionFailed(res);
    } else if (target.set !== 'Variants') return odataError(res, 405, 'NotDeletable', `Entity set '${target.set}' does not support delete.`);
  }
  req.body = Buffer.from(JSON.stringify(body));
  req._body = true; // body already read: tell body-parser in the engine to keep req.body
  req.headers['content-type'] = 'application/json';
  delete req.headers['if-match'];
  forward(req, res, svc, target, after);
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
  // every service reloads its contributors: fresh copies of the changeable sets, so created rows,
  // drafts, deletions, action results and variants are gone (both purchasing services)
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
      return sendJson(res, 200, { services: SERVICE_NAMES.map((s) => `/odata/${s}/`), media: '/media/suppliers/{id}.svg', e2e: E2E });
    const logo = /^\/media\/suppliers\/([\w-]+)\.svg$/.exec(url.pathname);
    if (logo && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
      return res.end(supplierLogo(logo[1]));
    }
    if (url.pathname === '/test/reset' && req.method === 'POST' && E2E) {
      await reset();
      return sendJson(res, 200, { reset: true });
    }
    const m = /^\/odata\/(northwind|purchasing|purchasing-draft)(\/.*)?$/.exec(url.pathname);
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
      target.topZero = url.searchParams.get('$top') === '0';
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
  console.log(`[mock] http://localhost:${PORT}  services: ${SERVICE_NAMES.map((s) => `/odata/${s}/`).join('  ')}${E2E ? '  (E2E=1: POST /test/reset)' : ''}`);
});
