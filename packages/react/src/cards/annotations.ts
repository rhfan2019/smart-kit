/** Annotation settings of the cards, named as in the OVP card manifest settings (docs/20 §3.1). */
import { parseAnnotationPath, type EntityUi, type FilterState, type InitialCondition, type Operator } from '@rhfan2019/smart-kit-core';

/** Qualifier of an annotation path setting ("" when unqualified or not given). */
export function qualifierOf(path: string | undefined): string {
  return path ? parseAnnotationPath(path).qualifier : '';
}

/** UI.SelectionVariant conditions → filter state, merged with additional filters (both apply). */
export function cardFilters(conditions: InitialCondition[] | undefined, extra?: FilterState): FilterState | undefined {
  const out: FilterState = {};
  for (const c of conditions ?? []) (out[c.path] ??= []).push({ operator: c.operator as Operator, values: c.values, exclude: c.exclude || undefined });
  for (const [path, conds] of Object.entries(extra ?? {})) out[path] = [...(out[path] ?? []), ...conds];
  return Object.keys(out).length ? out : undefined;
}

export interface CardAnnotationSettings {
  /** UI.LineItem (or another collection) of the content, e.g. "com.sap.vocabularies.UI.v1.LineItem#Card". */
  annotationPath?: string;
  /** UI.PresentationVariant: sort order, MaxItems and the line item to use. */
  presentationAnnotationPath?: string;
  /** UI.SelectionVariant: the filter of the card. */
  selectionAnnotationPath?: string;
}

/** Resolves the line item, sort order, item limit and filter of a list-like card. */
export function resolveListSettings(ui: EntityUi, s: CardAnnotationSettings) {
  const pv = s.presentationAnnotationPath !== undefined ? ui.presentationVariants[qualifierOf(s.presentationAnnotationPath)] : undefined;
  const lineItemQualifier = s.annotationPath !== undefined ? qualifierOf(s.annotationPath) : pv?.lineItemQualifier ?? '';
  const columns = ui.lineItems[lineItemQualifier] ?? ui.lineItem;
  const sort = pv?.presentation.sortOrder.length ? pv.presentation.sortOrder : ui.presentation.sortOrder;
  const conditions = s.selectionAnnotationPath !== undefined ? ui.selectionVariants[qualifierOf(s.selectionAnnotationPath)] : undefined;
  return { columns, sort, maxItems: pv?.maxItems, conditions };
}
