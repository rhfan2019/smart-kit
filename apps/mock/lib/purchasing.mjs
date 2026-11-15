// Deterministic invented purchasing data (fixed seed). Free text is English only; the few code-list
// texts that have a Chinese translation are listed in ZH_TEXTS and swapped per Accept-Language by the server.
import { Fake, day, round } from './fake.mjs';

export const TODAY = '2026-11-14';

// code, English, Chinese, criticality (0 neutral, 1 negative, 2 critical, 3 positive, 5 information)
const STATUSES = [
  ['NEW', 'New', '新建', 0],
  ['APPR', 'Approved', '已审批', 3],
  ['ORD', 'Ordered', '已下单', 5],
  ['PART', 'Partially Delivered', '部分交货', 2],
  ['CLOSED', 'Closed', '已关闭', 3],
];
const ORDER_TYPES = [
  ['NB', 'Standard Order', '标准采购订单'],
  ['FO', 'Framework Order', '框架订单'],
  ['UB', 'Stock Transport Order', '库存转储订单'],
];
const CONDITION_TYPES = [
  ['PBXX', 'Gross Price', '基础价'],
  ['RA01', 'Discount', '折扣'],
  ['FRA1', 'Freight', '运费'],
  ['ZSUR', 'Surcharge', '附加费'],
];
const HISTORY_CATEGORIES = [
  ['GR', 'Goods Receipt', '收货'],
  ['IR', 'Invoice Receipt', '发票'],
];

/** English -> Chinese for the localized text properties (by property name). */
export const ZH_TEXTS = {
  Name: Object.fromEntries([...STATUSES, ...ORDER_TYPES].map((s) => [s[1], s[2]])),
  ConditionTypeName: Object.fromEntries(CONDITION_TYPES.map((s) => [s[1], s[2]])),
  CategoryText: Object.fromEntries(HISTORY_CATEGORIES.map((s) => [s[1], s[2]])),
};

const COMPANIES = [
  ['1000', 'EUR', ['Hamburg', 'Munich', 'Cologne']],
  ['2000', 'USD', ['Chicago', 'Denver', 'Austin']],
  ['3000', 'CNY', ['Shanghai', 'Suzhou', 'Chengdu']],
  ['4000', 'JPY', ['Osaka', 'Nagoya', 'Yokohama']],
];
const FX_FROM_EUR = { EUR: 1, USD: 1.1, CNY: 7.8, JPY: 160 };

const MAT_BASE = ['Steel', 'Stainless', 'Aluminium', 'Brass', 'Copper', 'Nylon', 'PVC', 'Rubber', 'Oak', 'Glass', 'Ceramic', 'Carbon'];
const MAT_ITEMS = [
  ['Hex Bolt', 'MECH', 'EA'], ['Washer', 'MECH', 'EA'], ['Bracket', 'MECH', 'EA'], ['Hinge', 'MECH', 'EA'],
  ['Pipe', 'RAW', 'M'], ['Cable', 'ELEC', 'M'], ['Gasket', 'MECH', 'EA'], ['Bearing', 'MECH', 'EA'],
  ['Panel', 'RAW', 'EA'], ['Sheet', 'RAW', 'KG'], ['Valve', 'MECH', 'EA'], ['Spring', 'MECH', 'EA'],
  ['Filter', 'CONS', 'EA'], ['Connector', 'ELEC', 'EA'], ['Housing', 'MECH', 'EA'], ['Granulate', 'RAW', 'KG'],
  ['Coolant', 'CONS', 'L'], ['Lubricant', 'CONS', 'L'], ['Carton', 'PACK', 'EA'], ['Stretch Film', 'PACK', 'M'],
];
const MAT_SPECS = ['M6', 'M8', 'M10', 'M12', '10 mm', '25 mm', '40 mm', 'Type A', 'Type B', 'Type C', 'Grade 2', 'Grade 5', 'XL', 'DN50', 'DN80', 'Heavy Duty', 'Light'];
const DESC_WHAT = ['fasteners', 'spare parts', 'packaging material', 'raw material', 'electrical components', 'consumables', 'tooling', 'maintenance supplies', 'cabling', 'bearings'];
const DESC_FOR = ['line 1', 'line 2', 'line 3', 'the paint shop', 'the warehouse', 'the assembly hall', 'the pilot project', 'the service team', 'the prototype build'];
const NOTE_LINES = [
  'Deliver to gate 4 between 7:00 and 15:00.', 'Call the receiving desk one day before arrival.', 'Partial deliveries are accepted.',
  'Quality certificate required with each shipment.', 'Use reusable pallets where possible.', 'Price agreed in the annual negotiation.',
  'Urgent: production depends on this order.', 'Invoice must reference the purchase order number.', 'Packaging must be moisture-proof.',
  'Supplier confirmed the dates by phone.', 'Combine with the next scheduled shipment.', 'Label every box with the material number.',
];

const cap = (s) => s[0].toUpperCase() + s.slice(1);
const minDay = (a, b) => (a < b ? a : b);

function describe(f, orderDate) {
  switch (f.next(4)) {
    case 0: return `Replenishment of ${f.pick(DESC_WHAT)} for ${f.pick(DESC_FOR)}`;
    case 1: return `${cap(f.pick(DESC_WHAT))} Q${Math.floor((+orderDate.slice(5, 7) - 1) / 3) + 1} ${orderDate.slice(0, 4)}`;
    case 2: return `Spare stock of ${f.pick(DESC_WHAT)}`;
    default: return `Order for ${f.pick(DESC_FOR)}: ${f.pick(DESC_WHAT)}`;
  }
}

/** Generates the whole data set. Keys are entity set names. */
export function generatePurchasing() {
  const fake = new Fake(20261114);
  const OrderStatuses = STATUSES.map(([Code, Name, , Criticality]) => ({ Code, Name, Criticality }));
  const PurchaseOrderTypes = ORDER_TYPES.map(([Code, Name]) => ({ Code, Name }));

  const supplierNames = new Set();
  const Suppliers = [];
  for (let i = 1; i <= 200; i++) {
    let name;
    do name = fake.companyName(); while (supplierNames.has(name));
    supplierNames.add(name);
    const { country, city } = fake.place();
    const id = String(100000 + i).padStart(10, '0');
    Suppliers.push({
      Supplier: id, SupplierName: name, Country: country, City: city,
      Rating: round(1.5 + fake.double() * 3.5, 1), LogoUrl: `/media/suppliers/${id}.svg`, IsBlocked: fake.chance(0.05),
    });
  }

  const matNames = new Set();
  const materials = [];
  for (let i = 1; i <= 500; i++) {
    const [itemName, group, unit] = fake.pick(MAT_ITEMS);
    let name;
    do name = `${fake.pick(MAT_BASE)} ${itemName} ${fake.pick(MAT_SPECS)}`; while (matNames.has(name));
    matNames.add(name);
    materials.push({
      m: { Material: `MAT-${10000 + i}`, MaterialName: name, MaterialGroup: group, BaseUnit: unit },
      priceEur: fake.dec(0.2, unit === 'EA' ? 400 : 60, 2),
    });
  }

  const Plants = [];
  for (const [cc, , cities] of COMPANIES)
    for (let j = 0; j < 3; j++)
      Plants.push({ Plant: `${cc[0]}0${j + 1}0`, PlantName: `${cities[j]} ${fake.pick(['Plant', 'Works', 'Assembly', 'Distribution Center'])}`, City: cities[j] });

  const PurchaseOrders = [];
  const PurchaseOrderItems = [];
  const PricingConditions = [];
  const ItemHistory = [];
  let grDoc = 5000000000;
  let irDoc = 5105000000;
  const start = '2024-01-01';
  const span = day.toNum(TODAY) - day.toNum(start) - 4;

  for (let n = 1; n <= 10000; n++) {
    const first = n === 1;
    const company = first ? COMPANIES[0] : fake.weighted([[COMPANIES[0], 55], [COMPANIES[1], 20], [COMPANIES[2], 15], [COMPANIES[3], 10]]);
    const orderDate = first ? '2026-10-02' : day.add(start, fake.next(span));
    const age = day.toNum(TODAY) - day.toNum(orderDate);
    const status = first ? 'PART'
      : age > 150 ? fake.weighted([['CLOSED', 80], ['PART', 12], ['ORD', 8]])
      : fake.weighted([['NEW', 15], ['APPR', 20], ['ORD', 30], ['PART', 20], ['CLOSED', 15]]);
    const currency = first || !fake.chance(0.12) ? company[1] : company[1] === 'USD' ? 'EUR' : 'USD';
    const curScale = currency === 'JPY' ? 0 : 2;
    const created = new Date((day.toNum(orderDate) - fake.between(0, 2)) * 86400000 + ((fake.between(6, 18) * 60 + fake.between(0, 59)) * 60 + fake.between(0, 59)) * 1000);
    const po = {
      PurchaseOrder: String(4500000000 + n),
      PurchaseOrderType: first ? 'NB' : fake.weighted([['NB', 75], ['FO', 15], ['UB', 10]]),
      Supplier: first ? Suppliers[0].Supplier : fake.pick(Suppliers).Supplier,
      CompanyCode: company[0],
      PurchasingGroup: `P0${fake.between(1, 8)}`,
      OrderDate: orderDate,
      CreatedAt: created.toISOString().replace('.000Z', 'Z'),
      Status: status,
      StatusCriticality: 0,
      NetAmount: 0,
      Currency: currency,
      DeliveredPercent: 0,
      Description: first ? 'Framework call-off for line 3 maintenance' : describe(fake, orderDate),
      Notes: fake.chance(0.4) ? null : [...new Set(Array.from({ length: fake.between(1, 3) }, () => fake.pick(NOTE_LINES)))].join('\n'),
      Version: 1,
    };
    const plantsOfCompany = Plants.filter((p) => p.Plant[0] === company[0][0]);
    const itemCount = first ? 150 : fake.weighted([[1, 20], [2, 25], [3, 25], [4, 15], [5, 15]]);
    let ordered = 0, received = 0, poNet = 0;
    let minDelivery = '9999-12-31';
    for (let k = 1; k <= itemCount; k++) {
      const { m: mat, priceEur } = fake.pick(materials);
      const qty = mat.BaseUnit === 'EA' ? fake.between(1, 500) : fake.dec(0.5, 2000, 3);
      let gross = round(priceEur * FX_FROM_EUR[currency], curScale);
      if (gross === 0) gross = currency === 'JPY' ? 1 : 0.01;
      const it = {
        PurchaseOrder: po.PurchaseOrder, PurchaseOrderItem: k * 10, Material: mat.Material,
        Plant: fake.pick(plantsOfCompany).Plant, OrderQuantity: qty, OrderUnit: mat.BaseUnit,
        NetPrice: 0, NetAmount: 0, Currency: currency, DeliveryDate: day.add(orderDate, fake.between(7, 60)),
        ReceivedQuantity: 0, InvoicedAmount: 0, Version: 1,
      };
      let counter = 0;
      let net = 0;
      const cond = (type, rate, rateUnit, amount, statistical) => {
        amount = round(amount, curScale);
        PricingConditions.push({
          PurchaseOrder: it.PurchaseOrder, PurchaseOrderItem: it.PurchaseOrderItem, ConditionCounter: ++counter,
          ConditionType: type, ConditionTypeName: CONDITION_TYPES.find((c) => c[0] === type)[1],
          Rate: round(rate, 2), RateUnit: rateUnit, ConditionAmount: amount, Currency: currency, IsStatistical: statistical,
        });
        if (!statistical) net += amount;
      };
      const baseAmount = qty * gross;
      cond('PBXX', gross, currency, baseAmount, false);
      const extras = [];
      if (fake.chance(0.55)) extras.push('RA01');
      if (fake.chance(0.45)) extras.push('FRA1');
      if (fake.chance(0.3)) extras.push('ZSUR');
      if (extras.length === 0) extras.push(fake.pick(['RA01', 'FRA1', 'ZSUR']));
      for (const x of extras) {
        if (x === 'RA01') {
          const pct = fake.pick([2, 3, 5, 8, 10]);
          cond(x, -pct, '%', (-baseAmount * pct) / 100, false);
        } else if (x === 'FRA1') {
          const f = round(fake.between(10, 200) * FX_FROM_EUR[currency], curScale);
          cond(x, f, currency, f, fake.chance(0.3));
        } else {
          cond(x, 1.5, '%', (baseAmount * 1.5) / 100, false);
        }
      }
      it.NetAmount = round(net, 2);
      it.NetPrice = round(net / qty, 2);

      let frac = status === 'CLOSED' ? 1 : status === 'PART' ? fake.pick([0, 0.25, 0.5, 0.75, 1]) : 0;
      if (first && k === 1) frac = 0.5;
      let recQty = qty * frac;
      if (mat.BaseUnit === 'EA') recQty = Math.floor(recQty);
      recQty = round(recQty, 3);
      let hc = 0, recSum = 0, invSum = 0;
      if (recQty > 0) {
        const parts = recQty >= 2 && fake.chance(0.4) ? 2 : 1;
        const firstPart = parts === 2 ? (mat.BaseUnit === 'EA' ? Math.floor(recQty / 2) : round(recQty / 2, 3)) : recQty;
        for (const q of parts === 2 ? [firstPart, round(recQty - firstPart, 3)] : [recQty]) {
          ItemHistory.push({
            PurchaseOrder: it.PurchaseOrder, PurchaseOrderItem: it.PurchaseOrderItem, HistoryCounter: ++hc,
            Category: 'GR', CategoryText: HISTORY_CATEGORIES[0][1], DocumentNumber: String(++grDoc),
            PostingDate: minDay(day.add(it.DeliveryDate, fake.between(-3, 5) + hc * 3), TODAY), Quantity: round(q, 3), Unit: it.OrderUnit,
            Amount: round(q * it.NetPrice, 2), Currency: currency, MovementType: '101',
          });
          recSum = round(recSum + q, 3);
        }
        if (status === 'CLOSED' || fake.chance(0.5)) {
          const inv = round(status === 'CLOSED' ? it.NetAmount : recSum * it.NetPrice, 2);
          ItemHistory.push({
            PurchaseOrder: it.PurchaseOrder, PurchaseOrderItem: it.PurchaseOrderItem, HistoryCounter: ++hc,
            Category: 'IR', CategoryText: HISTORY_CATEGORIES[1][1], DocumentNumber: String(++irDoc),
            PostingDate: minDay(day.add(it.DeliveryDate, fake.between(5, 25)), TODAY), Quantity: recSum, Unit: it.OrderUnit,
            Amount: inv, Currency: currency, MovementType: null,
          });
          invSum += inv;
        }
      }
      it.ReceivedQuantity = recSum;
      it.InvoicedAmount = round(invSum, 2);
      ordered += qty;
      received += recSum;
      poNet += it.NetAmount;
      if (it.DeliveryDate < minDelivery) minDelivery = it.DeliveryDate;
      PurchaseOrderItems.push(it);
    }
    po.NetAmount = round(poNet, 2);
    po.DeliveredPercent = status === 'CLOSED' ? 100 : round(ordered === 0 ? 0 : (received * 100) / ordered, 1);
    if (status === 'PART' && (po.DeliveredPercent === 0 || po.DeliveredPercent === 100)) po.DeliveredPercent = 50;
    let crit = STATUSES.find((s) => s[0] === status)[3];
    if ((status === 'ORD' || status === 'PART') && minDelivery < TODAY) crit = 1; // overdue
    po.StatusCriticality = crit;
    PurchaseOrders.push(po);
  }

  return {
    OrderStatuses, PurchaseOrderTypes, Suppliers, Materials: materials.map((m) => m.m), Plants,
    PurchaseOrders, PurchaseOrderItems, PricingConditions, ItemHistory, Variants: [],
  };
}
