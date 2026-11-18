/**
 * Recursive hierarchies (docs/26 §3.10): the model lookup, the TopLevels request of a tree table and the node state
 * of its result rows (DrillState, DistanceFromRoot, LimitedDescendantCount).
 */
import type { EntityUi, MetaModel, RecursiveHierarchyModel } from '../model/types';
import { buildListRequest, sourceInfo, type HierarchyRequest, type ListRequestOptions, type QueryRequest, type Row } from './request';

/** The hierarchy of an entity type with this qualifier; without a qualifier the first one. */
export function hierarchyOf(model: MetaModel, typeName: string, qualifier?: string): RecursiveHierarchyModel | undefined {
  const all = model.entityTypes[typeName]?.hierarchies ?? [];
  return qualifier === undefined ? all[0] : all.find((h) => h.qualifier === qualifier);
}

export interface HierarchyRequestOptions extends Omit<ListRequestOptions, 'skip' | 'top' | 'count'> {
  /** Qualifier of Aggregation.RecursiveHierarchy; default the type's first hierarchy. */
  qualifier?: string;
  /** Levels shown from the roots (default 1). */
  levels?: number;
  /** Nodes expanded or collapsed apart from `levels` (TopLevels ExpandLevels). */
  expandLevels?: HierarchyRequest['expandLevels'];
}

/**
 * Builds the TopLevels request of a tree table: the list request (columns, filters, search, sort) plus the node id
 * and the hierarchy properties, without paging; the service returns the visible nodes in tree order.
 */
export function buildHierarchyRequest(model: MetaModel, ui: EntityUi, o: HierarchyRequestOptions): QueryRequest {
  const info = sourceInfo(model, o.source);
  const h = hierarchyOf(model, info.typeName, o.qualifier);
  if (!h) throw new Error(`${info.typeName} has no recursive hierarchy${o.qualifier ? ` "${o.qualifier}"` : ''}`);
  const props = model.entityTypes[info.typeName]!.properties;
  const extra = [h.nodeProperty, h.drillState, h.distanceFromRoot, h.limitedDescendantCount].filter((p): p is string => Boolean(p && p in props));
  const req = buildListRequest(model, ui, { ...o, extraSelect: [...(o.extraSelect ?? []), ...extra], count: false });
  const hierarchy: HierarchyRequest = { qualifier: h.qualifier, nodeProperty: h.nodeProperty, levels: o.levels ?? 1 };
  if (o.expandLevels?.length) hierarchy.expandLevels = o.expandLevels;
  return { ...req, skip: undefined, top: undefined, hierarchy };
}

export type DrillState = 'expanded' | 'collapsed' | 'leaf';

/** Node state of a row of a TopLevels result. */
export interface HierarchyNode {
  id: string;
  /** DistanceFromRoot (0 for roots). */
  level: number;
  drillState: DrillState;
  /** LimitedDescendantCount: visible descendants. */
  descendants?: number;
}

export function hierarchyNodeOf(h: RecursiveHierarchyModel, row: Row): HierarchyNode {
  const state = h.drillState ? String(row[h.drillState] ?? '') : '';
  const count = h.limitedDescendantCount ? row[h.limitedDescendantCount] : undefined;
  return {
    id: String(row[h.nodeProperty] ?? ''),
    // Int64 values arrive as strings with IEEE754Compatible=true.
    level: h.distanceFromRoot ? Number(row[h.distanceFromRoot] ?? 0) || 0 : 0,
    drillState: state === 'expanded' || state === 'collapsed' ? state : 'leaf',
    descendants: count === undefined || count === null ? undefined : Number(count),
  };
}
