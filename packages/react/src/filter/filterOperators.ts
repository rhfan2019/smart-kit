/**
 * Operator options of the filter fields of a filter bar (FE manifest `useSemanticDateRange` and the filter fields'
 * `settings.operatorConfiguration`; CommonHelper.getOperatorsForProperty, FieldHelper.operators): set by the page
 * through useFilterState, read by the condition input and the value help dialog of the bar's fields.
 */
import type { FilterOperatorOptions } from '@rhfan2019/smart-kit-core';
import { createContext, useContext } from 'react';

/** The options of one field: the operator options and FE `settings.disableIntegerGrouping` (integers without grouping separators). */
export interface FilterFieldOptions extends FilterOperatorOptions {
  disableIntegerGrouping?: boolean;
}

export type FilterOperatorOptionsOf = (path: string) => FilterFieldOptions | undefined;

const INTEGER = /^Edm\.(Int16|Int32|Int64|Byte|SByte)$/;

/** The property as the field's tokens format it: an integer with `disableIntegerGrouping` is shown without grouping. */
export function displayProperty<P extends { edmType: string }>(prop: P | undefined, options: FilterFieldOptions | undefined): P | undefined {
  return prop && options?.disableIntegerGrouping && INTEGER.test(prop.edmType) ? { ...prop, edmType: 'Edm.String' } : prop;
}

export const FilterOperatorsContext = /*#__PURE__*/ createContext<FilterOperatorOptionsOf | undefined>(undefined);

/** The operator options of a field of the surrounding filter bar (undefined outside a filter bar or without options). */
export function useFilterOperatorOptions(path: string): FilterFieldOptions | undefined {
  return useContext(FilterOperatorsContext)?.(path);
}
