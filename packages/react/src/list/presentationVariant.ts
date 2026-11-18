/**
 * The JSON form of `sap.fe.navigation.PresentationVariant` (`toJSONObject()`), returned and accepted by the
 * `getPresentationVariant` / `setPresentationVariant` methods of the building blocks (smart-kit has no
 * sap.fe.navigation classes; the plain object is what FE serializes, D42).
 */
import type { SortItem } from '@rhfan2019/smart-kit-core';

/** A visualization of a PresentationVariant: the table's (Type "LineItem") or the chart's (Type "Chart"). */
export interface PresentationVariantVisualization {
  Type: string;
  /** Table: the visible columns (`{ Value }`); chart: chart type, dimensions and measures with their roles. */
  Content?: unknown;
}

/** sap.fe.navigation.PresentationVariant.ExternalPresentationVariant (the object of `toJSONObject()`). */
export interface PresentationVariant {
  /** Further properties (as FE's `setProperties`), e.g. GroupBy, Aggregations of a table. */
  [key: string]: unknown;
  PresentationVariantID: string;
  Version?: { Major: string; Minor: string; Patch: string };
  Text?: string;
  ContextUrl?: string;
  SortOrder?: { Property: string; Descending: boolean }[];
  Visualizations?: PresentationVariantVisualization[];
}

/** A PresentationVariant object as FE's toJSONObject writes it (Version 1.0.0, the default text for an empty ID). */
export function presentationVariant(properties: Record<string, unknown>, visualizations: PresentationVariantVisualization[]): PresentationVariant {
  return {
    Version: { Major: '1', Minor: '0', Patch: '0' },
    PresentationVariantID: '',
    Text: 'Presentation Variant with ID ',
    ...properties,
    ...(visualizations.length ? { Visualizations: visualizations } : {}),
  };
}

/** SortOrder of a PresentationVariant as smart-kit sort items; undefined when the PV has none. */
export function sortOfPresentationVariant(pv: PresentationVariant): SortItem[] | undefined {
  return Array.isArray(pv.SortOrder) ? pv.SortOrder.filter((s) => s && typeof s.Property === 'string').map((s) => ({ path: s.Property, descending: Boolean(s.Descending) })) : undefined;
}
