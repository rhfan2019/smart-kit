// Stage 4 tail (tests/e2e-fe/vhref.spec.ts): the parameterized entity set SpendParameters and the value help service
// purchasing-vh. Both are derived from the generated purchasing data; nothing here consumes random numbers.
import { pristineOf } from './datasets.mjs';
import { COMPANIES, FX_FROM_EUR } from './purchasing.mjs';

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Result rows of SpendParameters(P_DisplayCurrency=…,P_KeyDate=…)/Set: per supplier the orders dated on or before the
 * key date and their net amount converted into the display currency (via EUR, lib/purchasing.mjs FX_FROM_EUR).
 */
export function supplierSpend(displayCurrency, keyDate) {
  const data = pristineOf('purchasing');
  const rate = FX_FROM_EUR[displayCurrency];
  const bySupplier = new Map();
  if (rate === undefined) return [];
  for (const po of data.PurchaseOrders) {
    if (po.OrderDate > keyDate) continue;
    const eur = po.NetAmount / (FX_FROM_EUR[po.Currency] ?? 1);
    const cur = bySupplier.get(po.Supplier) ?? { count: 0, eur: 0 };
    cur.count++;
    cur.eur += eur;
    bySupplier.set(po.Supplier, cur);
  }
  return data.Suppliers.filter((s) => bySupplier.has(s.Supplier)).map((s) => ({
    Supplier: s.Supplier,
    SupplierName: s.SupplierName,
    Country: s.Country,
    OrderCount: bySupplier.get(s.Supplier).count,
    SpendAmount: displayCurrency === 'JPY' ? Math.round(bySupplier.get(s.Supplier).eur * rate) : round2(bySupplier.get(s.Supplier).eur * rate),
    DisplayCurrency: displayCurrency,
  }));
}

/** Contributor of SpendParameters: an entry exists for every parameter combination, its "Set" is computed. */
export const spendParameters = {
  getInitialDataSet: () => [],
  hasEntries: () => true,
  fetchEntries: (keys) => {
    const currency = String(keys.P_DisplayCurrency ?? '');
    const date = String(keys.P_KeyDate ?? '').slice(0, 10);
    return [{ P_DisplayCurrency: currency, P_KeyDate: date, Set: supplierSpend(currency, date) }];
  },
};

const COMPANY_NAMES = { 1000: ['Purchasing Germany GmbH', 'DE'], 2000: ['Purchasing US Inc.', 'US'], 3000: ['Purchasing China Ltd.', 'CN'], 4000: ['Purchasing Japan K.K.', 'JP'] };

/** CompanyCodes of the value help service purchasing-vh. */
export function generateValueHelp() {
  return {
    CompanyCodes: COMPANIES.map(([code, currency, cities]) => ({
      CompanyCode: code, CompanyCodeName: COMPANY_NAMES[code][0], City: cities[0], Country: COMPANY_NAMES[code][1], Currency: currency,
    })),
  };
}
