// The service schema the query plan works on: entity sets from $metadata (via smart-kit-core's model), each mapped
// to a table, every property to a column. Table and column names come only from here (the whitelist, ADR-027).
import type { CapabilityModel, EdmType, EntityTypeModel, MetaModel, PropertyModel } from '@rhfan2019/smart-kit-core';

/** Where the data of an entity set lives. Written by `smart-kit generate` (the *.storage.json file). */
export interface StorageMapping {
  entitySets: Record<string, { table: string; columns?: Record<string, string> }>;
}

export interface ColumnInfo {
  property: string;
  column: string;
  edmType: EdmType;
  nullable: boolean;
  scale?: number | 'variable';
  precision?: number;
}

export interface NavigationInfo {
  name: string;
  collection: boolean;
  /** Target entity set (NavigationPropertyBinding). */
  target: string;
  /** Join condition: source property = target property (pairs). Undefined when $metadata gives no constraints. */
  join?: { source: string; target: string }[];
  /** The single-valued navigation may have no target row (nullable, or a dangling key). */
  nullable: boolean;
}

export interface EntitySetInfo {
  name: string;
  typeName: string;
  type: EntityTypeModel;
  /** Schema-qualified table, e.g. ["purchasing", "purchase_order"]. */
  table: string[];
  columns: Record<string, ColumnInfo>;
  keys: string[];
  navigations: Record<string, NavigationInfo>;
  capabilities: CapabilityModel;
  /** Property used for the ETag (Core.OptimisticConcurrency), if any. */
  etag?: string;
}

export interface ServiceSchema {
  namespace: string;
  entitySets: Record<string, EntitySetInfo>;
  model: MetaModel;
}

const IDENT = /^[A-Za-z_][A-Za-z0-9_$]*$/;

function splitTable(table: string, set: string): string[] {
  const parts = table.split('.');
  if (parts.length > 2 || !parts.every((p) => IDENT.test(p))) throw new Error(`[smart-kit-server] storage mapping of ${set}: "${table}" is not a valid table name`);
  return parts;
}

/** Builds the schema; throws on mapping errors (a startup error, not a request error). */
export function buildSchema(model: MetaModel, storage: StorageMapping = { entitySets: {} }): ServiceSchema {
  const entitySets: Record<string, EntitySetInfo> = {};
  for (const set of Object.values(model.entitySets)) {
    const type = model.entityTypes[set.typeName];
    if (!type) throw new Error(`[smart-kit-server] entity set ${set.name}: type ${set.typeName} not found`);
    const map = storage.entitySets[set.name];
    const columns: Record<string, ColumnInfo> = {};
    for (const name of type.propertyOrder) {
      const p: PropertyModel = type.properties[name]!;
      const column = map?.columns?.[name] ?? name;
      if (!IDENT.test(column)) throw new Error(`[smart-kit-server] storage mapping of ${set.name}.${name}: "${column}" is not a valid column name`);
      columns[name] = { property: name, column, edmType: p.edmType, nullable: p.nullable, scale: p.scale, precision: p.precision };
    }
    entitySets[set.name] = {
      name: set.name,
      typeName: set.typeName,
      type,
      table: splitTable(map?.table ?? set.name, set.name),
      columns,
      keys: type.keys,
      navigations: {},
      capabilities: set.capabilities,
      etag: type.etag && columns[type.etag] ? type.etag : undefined,
    };
  }
  // Navigations: target from the binding, join from the referential constraints (or the partner's, reversed).
  for (const set of Object.values(model.entitySets)) {
    const info = entitySets[set.name]!;
    for (const nav of Object.values(info.type.navigations)) {
      const target = set.navigationBindings[nav.name];
      if (!target || !entitySets[target]) continue; // not bound: not navigable in this service
      let join: NavigationInfo['join'];
      if (nav.referentialConstraints.length) join = nav.referentialConstraints.map((r) => ({ source: r.property, target: r.referencedProperty }));
      else if (nav.partner) {
        const partner = entitySets[target]!.type.navigations[nav.partner];
        if (partner?.referentialConstraints.length) join = partner.referentialConstraints.map((r) => ({ source: r.referencedProperty, target: r.property }));
      }
      const nullable = !nav.collection && (join ?? []).some((j) => info.columns[j.source]?.nullable !== false);
      info.navigations[nav.name] = { name: nav.name, collection: nav.collection, target, join, nullable };
    }
  }
  return { namespace: model.namespace, entitySets, model };
}
