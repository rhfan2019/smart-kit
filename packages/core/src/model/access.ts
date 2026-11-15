import { resolvePath } from './buildModel';
import type { CapabilityModel, EntitySetModel, EntityTypeModel, EntityUi, MetaModel, PropertyModel } from './types';

export class UnknownEntitySetError extends Error {
  override name = 'UnknownEntitySetError';
}

export function getEntitySet(model: MetaModel, name: string): EntitySetModel {
  const es = model.entitySets[name];
  if (!es) throw new UnknownEntitySetError(`Unknown entity set "${name}"`);
  return es;
}

export function getEntityType(model: MetaModel, typeName: string): EntityTypeModel {
  const et = model.entityTypes[typeName];
  if (!et) throw new UnknownEntitySetError(`Unknown entity type "${typeName}"`);
  return et;
}

export function getUi(model: MetaModel, typeName: string): EntityUi {
  return model.ui[typeName]!;
}

/** Resolves a property path ("_Supplier/SupplierName") against an entity type. */
export function getProperty(model: MetaModel, typeName: string, path: string): PropertyModel | undefined {
  return resolvePath(model.entityTypes, typeName, path).property;
}

/**
 * Capabilities that apply when reading `navigation` of `parentSet` (or `parentSet` itself):
 * target entity set restrictions, overridden by the parent's NavigationRestrictions.
 */
export function capabilitiesFor(model: MetaModel, parentSet: string, navigation?: string): CapabilityModel {
  const parent = getEntitySet(model, parentSet);
  if (!navigation) return parent.capabilities;
  const targetSet = parent.navigationBindings[navigation];
  const base = targetSet ? getEntitySet(model, targetSet).capabilities : parent.capabilities;
  return { ...base, ...(parent.navigationCapabilities[navigation] ?? {}) };
}

/** Entity set reached by following `navigation` from `entitySet`. */
export function targetEntitySet(model: MetaModel, entitySet: string, navigation: string): string | undefined {
  return model.entitySets[entitySet]?.navigationBindings[navigation];
}

export function isFilterable(caps: CapabilityModel, path: string): boolean {
  return caps.filterable && !caps.nonFilterable.includes(path);
}

export function isSortable(caps: CapabilityModel, path: string): boolean {
  return caps.sortable && !caps.nonSortable.includes(path);
}
