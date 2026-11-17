// Business rules of the purchasing service on PostgreSQL, as smart-kit-server hooks: the same rules as the in-memory
// test service (apps/mock/lib/rules.mjs) — numbers and defaults on create, computed properties, order totals after
// item changes, validation with error details, the bound actions approve / reject / close and their messages.
// Texts, code lists and company currencies are imported from the mock, so both services answer with the same words.
import { sql, type Kysely } from 'kysely';
import { validationError, ODataServerError, type ActionHandler, type EntitySetHooks, type Row, type WriteContext } from '@rhfan2019/smart-kit-server';
// @ts-expect-error -- plain JavaScript module of the mock service, no types
import { SEVERITY, fieldLabel, statusName, text } from '../mock/lib/messages.mjs';
// @ts-expect-error -- plain JavaScript module of the mock service, no types
import { FX_FROM_EUR, ORDER_TYPE_CODES, STATUS, ZH_TEXTS, budgetOf, currencyOfCompany } from '../mock/lib/purchasing.mjs';
// @ts-expect-error -- plain JavaScript module of the mock service, no types
import { day, round } from '../mock/lib/fake.mjs';

type Lang = 'en' | 'zh';
type Db = Kysely<any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type Detail = { code: string; message: string; target?: string };

const MAX_ORDER_DATE = '2099-12-31';
const lang = (e: { language: string }): Lang => (e.language === 'zh' ? 'zh' : 'en');
const t = (e: { language: string }, key: string, ...args: unknown[]) => text(lang(e), key, ...args) as string;
const label = (e: { language: string }, key: string) => fieldLabel(lang(e), key) as string;
const isEmpty = (v: unknown) => v === undefined || v === null || String(v).trim() === '';
const nowSeconds = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
const status = (code: string) => (STATUS() as Record<string, { criticality: number }>)[code]!;

async function exists(db: Db, table: string, column: string, value: unknown) {
  // table and column are fixed names of this file, the value is a parameter
  const r = await sql`select 1 from ${sql.id('purchasing', table)} where ${sql.id(column)} = ${String(value)} limit 1`.execute(db);
  return r.rows.length > 0;
}

/** Computed properties of an order that follow its status and amounts (deriveOrder of the mock). */
function deriveOrder(o: Row) {
  o.BudgetAmount = budgetOf(Number(o.NetAmount));
  o.ApproveEnabled = o.Status === 'NEW';
  o.CloseEnabled = o.Status !== 'CLOSED';
}

async function validateOrder(e: WriteContext<unknown>, row: Row): Promise<Detail[]> {
  const details: Detail[] = [];
  const add = (code: string, key: string, target: string, ...args: unknown[]) => details.push({ code, message: t(e, key, ...args), target });
  const mandatory: [string, string][] = [['Supplier', 'F.Supplier'], ['CompanyCode', 'F.CompanyCode'], ['PurchaseOrderType', 'F.PurchaseOrderType'], ['PurchasingGroup', 'F.PurchasingGroup'], ['OrderDate', 'F.OrderDate']];
  for (const [p, l] of mandatory) if (isEmpty(row[p])) add('MANDATORY', 'mandatory', p, label(e, l));
  if (!isEmpty(row.Supplier) && !(await exists(e.db, 'supplier', 'supplier', row.Supplier))) add('UNKNOWN_VALUE', 'unknownValue', 'Supplier', label(e, 'F.Supplier'), row.Supplier);
  if (!isEmpty(row.CompanyCode) && !currencyOfCompany(row.CompanyCode)) add('UNKNOWN_VALUE', 'unknownValue', 'CompanyCode', label(e, 'F.CompanyCode'), row.CompanyCode);
  if (!isEmpty(row.PurchaseOrderType) && !(ORDER_TYPE_CODES() as string[]).includes(String(row.PurchaseOrderType)))
    add('UNKNOWN_VALUE', 'unknownValue', 'PurchaseOrderType', label(e, 'F.PurchaseOrderType'), row.PurchaseOrderType);
  if (!isEmpty(row.OrderDate) && String(row.OrderDate).slice(0, 10) > MAX_ORDER_DATE) add('DATE_TOO_LATE', 'dateTooLate', 'OrderDate');
  return details;
}

async function validateItem(e: WriteContext<unknown>, row: Row): Promise<Detail[]> {
  const details: Detail[] = [];
  const add = (code: string, key: string, target: string, ...args: unknown[]) => details.push({ code, message: t(e, key, ...args), target });
  for (const [p, l] of [['Material', 'F.Material'], ['Plant', 'F.Plant'], ['OrderQuantity', 'F.OrderQuantity']] as const) if (isEmpty(row[p])) add('MANDATORY', 'mandatory', p, label(e, l));
  if (!isEmpty(row.Material) && !(await exists(e.db, 'material', 'material', row.Material))) add('UNKNOWN_VALUE', 'unknownValue', 'Material', label(e, 'F.Material'), row.Material);
  if (!isEmpty(row.Plant) && !(await exists(e.db, 'plant', 'plant', row.Plant))) add('UNKNOWN_VALUE', 'unknownValue', 'Plant', label(e, 'F.Plant'), row.Plant);
  if (!isEmpty(row.OrderQuantity) && !(Number(row.OrderQuantity) > 0)) add('NOT_POSITIVE', 'positive', 'OrderQuantity', label(e, 'F.OrderQuantity'));
  return details;
}

const noDescriptionWarning = (e: WriteContext<unknown>, row: Row) => {
  if (isEmpty(row.Description)) e.messages.push({ code: 'PO_NO_DESCRIPTION', message: t(e, 'noDescription'), numericSeverity: SEVERITY.warning, target: 'Description' });
};

/** Order totals from its items (after an item was created, changed or deleted). */
async function recomputeOrder(db: Db, purchaseOrder: unknown) {
  await sql`
    update purchasing.purchase_order o
    set net_amount = s.net, invoiced_amount = s.invoiced, budget_amount = round(s.net * 1.2, 2)
    from (select coalesce(sum(net_amount), 0) as net, coalesce(sum(invoiced_amount), 0) as invoiced
          from purchasing.purchase_order_item where purchase_order = ${String(purchaseOrder)}) s
    where o.purchase_order = ${String(purchaseOrder)}`.execute(db);
}

const ORDER_UPDATABLE = ['Description', 'Notes', 'PurchaseOrderType', 'PurchasingGroup', 'OrderDate', 'Supplier'];

export const entitySets: Record<string, EntitySetHooks<unknown>> = {
  PurchaseOrders: {
    creatable: [...ORDER_UPDATABLE, 'CompanyCode'],
    updatable: ORDER_UPDATABLE,
    async beforeCreate(e) {
      const details = await validateOrder(e, e.data);
      if (details.length) throw validationError(t(e, 'orderInvalid'), details);
      // next number: highest + 1 (as the test service); the lock keeps two creates from taking the same one
      await sql`select pg_advisory_xact_lock(4500)`.execute(e.db);
      const { rows } = await sql<{ n: string }>`select coalesce(max(purchase_order::bigint), 4500000000) + 1 as n from purchasing.purchase_order`.execute(e.db);
      Object.assign(e.data, {
        PurchaseOrder: String(rows[0]!.n), Status: 'NEW', StatusCriticality: status('NEW').criticality, NetAmount: 0, InvoicedAmount: 0,
        DeliveredPercent: 0, CreatedAt: nowSeconds(), Currency: currencyOfCompany(e.data.CompanyCode) ?? '',
      });
      for (const p of ['Description', 'Notes']) if (e.data[p] === '' || e.data[p] === undefined) e.data[p] = null;
      deriveOrder(e.data);
    },
    afterCreate: (e) => noDescriptionWarning(e, e.row),
    async beforeUpdate(e) {
      const details = await validateOrder(e, e.data);
      if (details.length) throw validationError(t(e, 'orderInvalid'), details);
      deriveOrder(e.data);
    },
    afterUpdate: (e) => noDescriptionWarning(e, e.row),
    async beforeDelete(e) {
      // the items (and their conditions and history) go with the order
      for (const table of ['pricing_condition', 'item_history', 'purchase_order_item'])
        await sql`delete from ${sql.id('purchasing', table)} where purchase_order = ${String(e.current.PurchaseOrder)}`.execute(e.db);
    },
  },

  PurchaseOrderItems: {
    creatable: ['PurchaseOrder', 'Material', 'Plant', 'OrderQuantity', 'DeliveryDate'],
    updatable: ['DeliveryDate', 'Plant', 'OrderQuantity'],
    async beforeCreate(e) {
      const order = e.parent?.row ?? (isEmpty(e.data.PurchaseOrder) ? undefined : await e.read('PurchaseOrders', { PurchaseOrder: e.data.PurchaseOrder }));
      if (!order) throw new ODataServerError(404, 'NotFound', 'The purchase order of the item was not found.');
      e.data.PurchaseOrder = order.PurchaseOrder;
      const details = await validateItem(e, e.data);
      if (details.length) throw validationError(t(e, 'itemInvalid'), details);
      const { rows } = await sql<{ n: number }>`select coalesce(max(purchase_order_item), 0) + 10 as n from purchasing.purchase_order_item where purchase_order = ${String(order.PurchaseOrder)}`.execute(e.db);
      const { rows: mat } = await sql<{ base_unit: string; price_eur: string | null }>`
        select m.base_unit, p.price_eur from purchasing.material m left join purchasing.material_price p on p.material = m.material
        where m.material = ${String(e.data.Material)}`.execute(e.db);
      const currency = String(order.Currency ?? '');
      const scale = currency === 'JPY' ? 0 : 2;
      const eur = mat[0]?.price_eur;
      const typical = eur === null || eur === undefined ? null : round(Number(eur) * ((FX_FROM_EUR as Record<string, number>)[currency] ?? 1), scale);
      const price = typical !== null && typical > 0 ? typical : 1;
      const qty = Number(e.data.OrderQuantity) || 0;
      Object.assign(e.data, {
        PurchaseOrderItem: Number(rows[0]!.n), Currency: currency, OrderUnit: mat[0]?.base_unit ?? 'EA', OrderQuantity: qty, NetPrice: price,
        NetAmount: round(qty * price, 2), ReceivedQuantity: 0, InvoicedAmount: 0,
      });
      if (isEmpty(e.data.DeliveryDate)) e.data.DeliveryDate = day.add(String(order.OrderDate || new Date().toISOString().slice(0, 10)), 14);
    },
    afterCreate: (e) => recomputeOrder(e.db, e.row.PurchaseOrder),
    async beforeUpdate(e) {
      const details = await validateItem(e, e.data);
      if (details.length) throw validationError(t(e, 'itemInvalid'), details);
      e.data.NetAmount = round(Number(e.data.OrderQuantity) * Number(e.data.NetPrice), 2);
    },
    afterUpdate: (e) => recomputeOrder(e.db, e.row.PurchaseOrder),
    async beforeDelete(e) {
      const key = sql`purchase_order = ${String(e.current.PurchaseOrder)} and purchase_order_item = ${Number(e.current.PurchaseOrderItem)}`;
      await sql`delete from purchasing.pricing_condition where ${key}`.execute(e.db);
      await sql`delete from purchasing.item_history where ${key}`.execute(e.db);
    },
    afterDelete: (e) => recomputeOrder(e.db, e.previous.PurchaseOrder),
  },

  Variants: {
    beforeCreate(e) {
      e.data.ModifiedAt = new Date().toISOString();
    },
    beforeUpdate(e) {
      e.data.ModifiedAt = new Date().toISOString();
    },
  },
};

/** approve / reject / close: allowed in some statuses only; a success message tells what happened. */
function statusAction(allowed: (s: string) => boolean, to: string, fail: string, ok: string, code: string): ActionHandler<unknown> {
  return (e) => {
    const current = String(e.entity.Status);
    if (!allowed(current)) {
      const message = t(e, fail, e.entity.PurchaseOrder, statusName(lang(e), current));
      throw new ODataServerError(400, 'ACTION_NOT_AVAILABLE', message);
    }
    const changes: Row = { Status: to, StatusCriticality: status(to).criticality, NetAmount: e.entity.NetAmount };
    deriveOrder(changes);
    delete changes.NetAmount;
    e.messages.push({ code, message: t(e, ok, e.entity.PurchaseOrder), numericSeverity: SEVERITY.success, target: '' });
    return changes;
  };
}

export const actions: Record<string, ActionHandler<unknown>> = {
  'Purchasing.approve': statusAction((s) => s === 'NEW', 'APPR', 'cannotApprove', 'approved', 'PO_APPROVED'),
  'Purchasing.reject': statusAction((s) => s === 'NEW', 'REJ', 'cannotReject', 'rejected', 'PO_REJECTED'),
  'Purchasing.close': statusAction((s) => s !== 'CLOSED', 'CLOSED', 'cannotClose', 'closed', 'PO_CLOSED'),
};

/**
 * Chinese texts of the code lists (status, order type, condition and history category names), as the test service
 * swaps them: the database stores the English texts. A real application would keep a text table per language.
 */
export function afterRead(e: { row: Row; language: string }) {
  if (e.language !== 'zh') return;
  const texts = ZH_TEXTS as Record<string, Record<string, string>>;
  for (const [k, v] of Object.entries(e.row)) if (typeof v === 'string' && texts[k]?.[v]) e.row[k] = texts[k][v]!;
}

