// In-memory data sets shared by the mock data contributors (mockdata/<service>/<EntitySet>.js).
import { checkFilterValue } from './filter.mjs';
import { generateNorthwind } from './northwind.mjs';
import { generatePurchasing } from './purchasing.mjs';

const generators = { purchasing: generatePurchasing, northwind: generateNorthwind };
const pristine = {};

/** Entity sets that requests can change; they are copied on every (re)load so a reset restores the seed. */
const MUTABLE = new Set(['PurchaseOrders', 'PurchaseOrderItems', 'Variants']);

/** Rows of an entity set as generated (read-only sets are shared, changeable sets are fresh copies). */
export function initialData(service, entitySet) {
  pristine[service] ??= generators[service]();
  const rows = pristine[service][entitySet];
  if (!rows) throw new Error(`[mock] no data for ${service}/${entitySet}`);
  return MUTABLE.has(entitySet) ? rows.map((r) => ({ ...r })) : rows;
}

/** Nothing to do: the next getInitialDataSet call already returns fresh copies of the changeable sets. */
export function resetData() {}

/** Mock data contributor for one entity set (see MockDataContributor in @sap-ux/fe-mockserver-core). */
export function contributor(service, entitySet) {
  return {
    getInitialDataSet: () => initialData(service, entitySet),
    checkFilterValue: (type, mockValue, literal, operator) => checkFilterValue(type, mockValue, literal, operator),
  };
}
