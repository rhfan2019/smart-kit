// In-memory data sets shared by the mock data contributors (mockdata/<service>/<EntitySet>.js).
import { generateDraftData } from './draft.mjs';
import { checkFilterValue } from './filter.mjs';
import { generateNorthwind } from './northwind.mjs';
import { generatePurchasing } from './purchasing.mjs';
import { generateValueHelp } from './spend.mjs';

const generators = {
  purchasing: generatePurchasing,
  northwind: generateNorthwind,
  'purchasing-draft': () => generateDraftData(pristineOf('purchasing')),
  'purchasing-vh': generateValueHelp, // stage 4 tail: value help service (Common.ValueListReferences)
};
const pristine = {};

/** Entity sets that requests can change; they are copied on every (re)load so a reset restores the seed. */
const MUTABLE = new Set(['PurchaseOrders', 'PurchaseOrderItems', 'Variants', 'DraftAdministrativeData']);

/** The generated data of a service (generated once). */
export function pristineOf(service) {
  pristine[service] ??= generators[service]();
  return pristine[service];
}

/** Rows of an entity set as generated (read-only sets are shared, changeable sets are fresh copies). */
export function initialData(service, entitySet) {
  const rows = pristineOf(service)[entitySet];
  if (!rows) throw new Error(`[mock] no data for ${service}/${entitySet}`);
  return MUTABLE.has(entitySet) ? rows.map((r) => ({ ...r })) : rows;
}

/** Nothing to do: the next getInitialDataSet call already returns fresh copies of the changeable sets. */
export function resetData() {}

/**
 * Mock data contributor for one entity set (see MockDataContributor in @sap-ux/fe-mockserver-core).
 * `hooks` are further contributor methods (onBeforeAddEntry, executeAction, ...); they run with the
 * engine's `this` (this.base, this.throwError).
 */
export function contributor(service, entitySet, hooks = {}) {
  return {
    getInitialDataSet: () => initialData(service, entitySet),
    checkFilterValue: (type, mockValue, literal, operator) => checkFilterValue(type, mockValue, literal, operator),
    ...hooks,
  };
}
