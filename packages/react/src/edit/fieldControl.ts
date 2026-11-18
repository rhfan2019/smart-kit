/** Editability of fields (ADR-018; FE UIFormatters getEditableExpression, FieldControlHelper). */
import type { PropertyModel, Row } from '@rhfan2019/smart-kit-core';

/** Whether a property can be changed: not computed, not a key, not read-only (immutable only when creating). */
export function isEditable(prop: PropertyModel | undefined, creating: boolean): boolean {
  if (!prop) return false;
  if (prop.computed || prop.readOnly || prop.hidden) return false;
  if (prop.isKey && !creating) return false;
  if (prop.isKey && creating && prop.name === 'IsActiveEntity') return false;
  if (prop.immutable && !creating) return false;
  return true;
}

/** Common.FieldControlType members as numbers (Common vocabulary). */
const FIELD_CONTROL: Record<string, number> = { Hidden: 0, Inapplicable: 0, ReadOnly: 1, Optional: 3, Mandatory: 7 };

/** The Common.FieldControl of a property for a row: the constant, or the value of its path (0, 1, 3, 7); undefined without one. */
export function fieldControlOf(prop: PropertyModel | undefined, row: Row | undefined, prefix = ''): number | undefined {
  const fc = prop?.fieldControl;
  if (!fc) return undefined;
  if ('value' in fc) return typeof fc.value === 'number' ? fc.value : FIELD_CONTROL[String(fc.value)] ?? (Number.isFinite(Number(fc.value)) ? Number(fc.value) : undefined);
  let v: unknown = row;
  for (const seg of (prefix ? `${prefix}/${fc.path}` : fc.path).split('/')) v = v && typeof v === 'object' ? (v as Row)[seg] : undefined;
  return v === undefined || v === null || v === '' ? undefined : Number(v);
}

/**
 * Edit state of a field (FE UIFormatters getEditableExpression, FieldControlHelper): not editable when computed, a key or
 * immutable (except when creating) or when the field control is read-only (1) or inapplicable (0, then shown disabled);
 * mandatory with FieldControl Mandatory (7, also as a path).
 */
export function fieldEditState(prop: PropertyModel | undefined, row: Row | undefined, creating: boolean, prefix = ''): { editable: boolean; disabled: boolean; required: boolean } {
  const fc = fieldControlOf(prop, row, prefix);
  const base = isEditable(prop, creating);
  return { editable: base && fc !== 1, disabled: base && fc === 0, required: Boolean(prop?.mandatory) || fc === 7 };
}

