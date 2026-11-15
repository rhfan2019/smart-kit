// Business rules of the purchasing services, as hooks of the engine's mock data contributors
// (@sap-ux/fe-mockserver-core MockDataContributor: onBeforeAddEntry, executeAction, ...). They run inside
// the engine for both /odata/purchasing/ and /odata/purchasing-draft/: number assignment and defaults
// on create, computed properties, order totals after item changes, the bound actions approve / reject /
// close, and the draft checks (lock by another user, validation on activation).
import { pristineOf } from './datasets.mjs';
import { day, round } from './fake.mjs';
import { ORDER_TYPE_CODES, STATUS, currencyOfCompany, deriveOrder, typicalPrice } from './purchasing.mjs';
import { SEVERITY, errorBody, fieldLabel, langOf, statusName, text } from './messages.mjs';
import { DRAFT_ACTIONS } from './draft.mjs';

export const DRAFT_SERVICE = 'purchasing-draft';
export const MAX_ORDER_DATE = '2099-12-31';

const base = () => pristineOf('purchasing');
const lookups = {};
const lookup = (set, key) => (lookups[set] ??= new Set(base()[set].map((r) => r[key])));
const materialOf = (id) => base().Materials.find((m) => m.Material === id);
const isEmpty = (v) => v === undefined || v === null || String(v).trim() === '';
const nowSeconds = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
const today = () => new Date().toISOString().slice(0, 10);

// ------------------------------------------------------------------ validation

const ORDER_MANDATORY = [['Supplier', 'F.Supplier'], ['CompanyCode', 'F.CompanyCode'], ['PurchaseOrderType', 'F.PurchaseOrderType'], ['PurchasingGroup', 'F.PurchasingGroup'], ['OrderDate', 'F.OrderDate']];
const ITEM_MANDATORY = [['Material', 'F.Material'], ['Plant', 'F.Plant'], ['OrderQuantity', 'F.OrderQuantity']];

/** Error details ({ code, message, target }) for a purchase order (all fields: create, activation, merged PATCH). */
export function validateOrder(row, lang, prefix = '') {
  const details = [];
  const add = (code, key, target, ...args) => details.push({ code, message: text(lang, key, ...args), target: prefix + target });
  for (const [p, label] of ORDER_MANDATORY) if (isEmpty(row[p])) add('MANDATORY', 'mandatory', p, fieldLabel(lang, label));
  if (!isEmpty(row.Supplier) && !lookup('Suppliers', 'Supplier').has(row.Supplier)) add('UNKNOWN_VALUE', 'unknownValue', 'Supplier', fieldLabel(lang, 'F.Supplier'), row.Supplier);
  if (!isEmpty(row.CompanyCode) && !currencyOfCompany(row.CompanyCode)) add('UNKNOWN_VALUE', 'unknownValue', 'CompanyCode', fieldLabel(lang, 'F.CompanyCode'), row.CompanyCode);
  if (!isEmpty(row.PurchaseOrderType) && !ORDER_TYPE_CODES().includes(row.PurchaseOrderType))
    add('UNKNOWN_VALUE', 'unknownValue', 'PurchaseOrderType', fieldLabel(lang, 'F.PurchaseOrderType'), row.PurchaseOrderType);
  if (!isEmpty(row.OrderDate) && String(row.OrderDate).slice(0, 10) > MAX_ORDER_DATE) add('DATE_TOO_LATE', 'dateTooLate', 'OrderDate');
  return details;
}

/** Error details for an item. */
export function validateItem(row, lang, prefix = '') {
  const details = [];
  const add = (code, key, target, ...args) => details.push({ code, message: text(lang, key, ...args), target: prefix + target });
  for (const [p, label] of ITEM_MANDATORY) if (isEmpty(row[p])) add('MANDATORY', 'mandatory', p, fieldLabel(lang, label));
  if (!isEmpty(row.Material) && !lookup('Materials', 'Material').has(row.Material)) add('UNKNOWN_VALUE', 'unknownValue', 'Material', fieldLabel(lang, 'F.Material'), row.Material);
  if (!isEmpty(row.Plant) && !lookup('Plants', 'Plant').has(row.Plant)) add('UNKNOWN_VALUE', 'unknownValue', 'Plant', fieldLabel(lang, 'F.Plant'), row.Plant);
  if (!isEmpty(row.OrderQuantity) && !(Number(row.OrderQuantity) > 0)) add('NOT_POSITIVE', 'positive', 'OrderQuantity', fieldLabel(lang, 'F.OrderQuantity'));
  return details;
}

// ------------------------------------------------------------------ helpers

const orderKeys = (row) => ('IsActiveEntity' in row ? { PurchaseOrder: row.PurchaseOrder, IsActiveEntity: row.IsActiveEntity } : { PurchaseOrder: row.PurchaseOrder });
const sameVersion = (a, b) => a.PurchaseOrder === b.PurchaseOrder && a.IsActiveEntity === b.IsActiveEntity;
export const lockedByOther = (row) => !!row?.HasDraftEntity && row.DraftAdministrativeData?.DraftIsCreatedByMe === false;
export const draftOfOther = (row) => row?.IsActiveEntity === false && row.DraftAdministrativeData?.DraftIsCreatedByMe === false;

/** Recomputes NetAmount, InvoicedAmount, BudgetAmount of the order (same draft version) of an item. */
async function recomputeOrder(ctx, item, req) {
  const orders = await ctx.base.getEntityInterface('PurchaseOrders');
  const [order] = await orders.fetchEntries(orderKeys(item), req);
  if (!order) return;
  const items = (await ctx.base.getAllEntries(req, true)).filter((r) => sameVersion(r, item));
  order.NetAmount = round(items.reduce((s, r) => s + Number(r.NetAmount), 0), 2);
  order.InvoicedAmount = round(items.reduce((s, r) => s + Number(r.InvoicedAmount), 0), 2);
  deriveOrder(order);
}

const ACTIONS = {
  approve: { allowed: (s) => s === 'NEW', to: 'APPR', fail: 'cannotApprove', ok: 'approved', code: 'PO_APPROVED' },
  reject: { allowed: (s) => s === 'NEW', to: 'REJ', fail: 'cannotReject', ok: 'rejected', code: 'PO_REJECTED' },
  close: { allowed: (s) => s !== 'CLOSED', to: 'CLOSED', fail: 'cannotClose', ok: 'closed', code: 'PO_CLOSED' },
};
export const BOUND_ACTIONS = Object.keys(ACTIONS);

// ------------------------------------------------------------------ PurchaseOrders

export function orderHooks(service) {
  const draft = service === DRAFT_SERVICE;
  return {
    /** POST: next number (highest + 1) and the defaults of a new order. */
    async onBeforeAddEntry(_keys, data, req) {
      const rows = await this.base.getAllEntries(req, true);
      data.PurchaseOrder = String(rows.reduce((m, r) => Math.max(m, Number(r.PurchaseOrder) || 0), 4500000000) + 1);
      Object.assign(data, { Status: 'NEW', StatusCriticality: STATUS().NEW.criticality, NetAmount: 0, InvoicedAmount: 0, DeliveredPercent: 0, CreatedAt: nowSeconds(), Version: 1 });
      data.Currency = currencyOfCompany(data.CompanyCode) ?? '';
      for (const p of ['Description', 'Notes']) if (data[p] === '' || data[p] === undefined) data[p] = null;
      if (draft && isEmpty(data.OrderDate)) data.OrderDate = today();
      deriveOrder(data);
    },
    /** PATCH: computed properties; a new draft (no active version yet) takes the currency of its company code. */
    async onBeforeUpdateEntry(_keys, data) {
      if (draft && data.IsActiveEntity === false && !data.HasActiveEntity) data.Currency = currencyOfCompany(data.CompanyCode) ?? data.Currency;
      deriveOrder(data);
    },
    /** DELETE (direct-save service): the items go with the order. */
    async removeEntry(keys, req) {
      await this.base.removeEntry(keys, req);
      if (draft || req?.method !== 'DELETE') return;
      const items = await this.base.getEntityInterface('PurchaseOrderItems');
      for (const it of await items.fetchEntries({ PurchaseOrder: keys.PurchaseOrder }, req))
        await items.removeEntry({ PurchaseOrder: it.PurchaseOrder, PurchaseOrderItem: it.PurchaseOrderItem }, req);
    },
    /** Draft checks before the engine's draft handling and the bound actions. */
    async onBeforeAction(def, data, keys, req) {
      const lang = langOf(req.headers);
      const fail = (status, code, message, details) => this.throwError(message, status, errorBody(code, message, details));
      if (!draft) return data;
      const [row] = await this.base.fetchEntries(keys, req);
      if (def.name === DRAFT_ACTIONS.edit) {
        if (keys.IsActiveEntity === false) fail(400, 'ACTIVE_ONLY', text(lang, 'activeOnly'));
        if (lockedByOther(row)) fail(409, 'LOCKED', text(lang, 'locked', row.DraftAdministrativeData.InProcessByUser));
      } else if (def.name === DRAFT_ACTIONS.activate || def.name === DRAFT_ACTIONS.prepare) {
        if (keys.IsActiveEntity !== false) fail(400, 'DRAFT_ONLY', text(lang, 'draftOnly'));
        if (!row) fail(404, 'NotFound', `PurchaseOrders(${keys.PurchaseOrder}) has no draft.`);
        if (draftOfOther(row)) fail(409, 'LOCKED', text(lang, 'locked', row.DraftAdministrativeData.InProcessByUser));
        if (def.name === DRAFT_ACTIONS.activate) {
          if (isEmpty(row.Currency)) row.Currency = currencyOfCompany(row.CompanyCode) ?? '';
          const details = validateOrder(row, lang);
          const items = (await (await this.base.getEntityInterface('PurchaseOrderItems')).getAllEntries(req, true)).filter((r) => sameVersion(r, row));
          for (const it of items)
            details.push(...validateItem(it, lang, `_Item(PurchaseOrder='${it.PurchaseOrder}',PurchaseOrderItem=${it.PurchaseOrderItem},IsActiveEntity=false)/`));
          if (details.length) fail(400, 'VALIDATION_FAILED', text(lang, 'orderInvalid'), details);
        }
      } else if (ACTIONS[def.name] && keys.IsActiveEntity === false) fail(400, 'ACTIVE_ONLY', text(lang, 'activeOnly'));
      return data;
    },
    /** approve / reject / close. */
    async executeAction(def, data, keys, req) {
      const rule = ACTIONS[def.name];
      if (!rule) return data;
      const lang = langOf(req.headers);
      const [row] = await this.base.fetchEntries(keys, req);
      if (!row) this.throwError('Not found', 404, errorBody('NotFound', `PurchaseOrders(${keys.PurchaseOrder}) not found.`));
      if (!rule.allowed(row.Status)) {
        const message = text(lang, rule.fail, row.PurchaseOrder, statusName(lang, row.Status));
        this.throwError(message, 400, errorBody('ACTION_NOT_AVAILABLE', message));
      }
      Object.assign(row, { Status: rule.to, StatusCriticality: STATUS()[rule.to].criticality, Version: Number(row.Version) + 1 });
      deriveOrder(row);
      req.addMessage(rule.code, text(lang, rule.ok, row.PurchaseOrder), SEVERITY.success, '');
      return { ...row };
    },
    /** Activation: the active version gets a new ETag. */
    async onAfterAction(def, _data, keys, response, req) {
      if (!draft || def.name !== DRAFT_ACTIONS.activate || !response) return response;
      const [row] = await this.base.fetchEntries({ ...keys, IsActiveEntity: true }, req);
      if (row) {
        row.Version = Number(row.Version) + 1;
        deriveOrder(row);
        Object.assign(response, { Version: row.Version, BudgetAmount: row.BudgetAmount, ApproveEnabled: row.ApproveEnabled, CloseEnabled: row.CloseEnabled });
      }
      return response;
    },
  };
}

// ------------------------------------------------------------------ PurchaseOrderItems

export function itemHooks() {
  return {
    /** POST: next item number of the order (highest + 10) and defaults from the order and the material. */
    async onBeforeAddEntry(_keys, data, req) {
      const rows = await this.base.getAllEntries(req, true);
      data.PurchaseOrderItem = rows.reduce((m, r) => (r.PurchaseOrder === data.PurchaseOrder ? Math.max(m, r.PurchaseOrderItem) : m), 0) + 10;
      const orders = await this.base.getEntityInterface('PurchaseOrders');
      const [order] = await orders.fetchEntries(orderKeys(data), req);
      const currency = order?.Currency ?? '';
      data.Currency = currency;
      data.OrderUnit = materialOf(data.Material)?.BaseUnit ?? (data.OrderUnit || 'EA');
      data.OrderQuantity = Number(data.OrderQuantity) || 0;
      data.NetPrice = typicalPrice(base().MaterialPrices, data.Material, currency) ?? 1;
      data.NetAmount = round(data.OrderQuantity * data.NetPrice, 2);
      if (isEmpty(data.DeliveryDate)) data.DeliveryDate = day.add(order?.OrderDate || today(), 14);
      Object.assign(data, { ReceivedQuantity: 0, InvoicedAmount: 0, Version: 1 });
    },
    async onAfterAddEntry(_keys, data, req) {
      await recomputeOrder(this, data, req);
    },
    async onBeforeUpdateEntry(_keys, data) {
      data.NetAmount = round(Number(data.OrderQuantity) * Number(data.NetPrice), 2);
    },
    async onAfterUpdateEntry(_keys, data, req) {
      await recomputeOrder(this, data, req);
    },
    async removeEntry(keys, req) {
      const [row] = await this.base.fetchEntries(keys, req);
      await this.base.removeEntry(keys, req);
      if (row && req?.method === 'DELETE') await recomputeOrder(this, row, req);
    },
  };
}
