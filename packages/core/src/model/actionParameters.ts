/**
 * Values of the action parameter dialog (FE sap.fe.macros.coreUI.OperationParameterDialog, sap.fe.core
 * controllerextensions/editFlow/operations OperationParameters and ODataOperation): default values, the values of the
 * request body, the parameters that are shown and the mandatory check.
 */
import type { Row } from '../query/request';
import type { ActionModel, ActionParameterModel } from './types';

const read = (row: Row | undefined, path: string): unknown => {
  let cur: unknown = row;
  for (const seg of path.split('/')) cur = cur && typeof cur === 'object' ? (cur as Row)[seg] : undefined;
  return cur;
};

const FIELD_CONTROL: Record<string, number> = { Hidden: 0, Inapplicable: 0, ReadOnly: 1, Optional: 3, Mandatory: 7 };

/** The Common.FieldControl of a parameter (0, 1, 3, 7) for the bound entity `row`; undefined without one. */
function fieldControl(p: ActionParameterModel, row: Row | undefined): number | undefined {
  const fc = p.property?.fieldControl;
  if (!fc) return undefined;
  const v = 'value' in fc ? fc.value : read(row, fc.path);
  if (v === undefined || v === null || v === '') return undefined;
  if (typeof v === 'number') return v;
  return FIELD_CONTROL[String(v)] ?? (Number.isFinite(Number(v)) ? Number(v) : undefined);
}

/** Edit state of a parameter's field (FE OperationParameterDialog getParameterEditMode, isRequiredExpression). */
export interface ActionParameterState {
  /** Not shown: UI.Hidden, and ResultIsActiveEntity (FE createField `visible`). */
  hidden: boolean;
  /** Common.FieldControl Mandatory (constant or path); Nullable is not read (FE isRequiredExpression). */
  required: boolean;
  /** Core.Computed / Core.Immutable, or Common.FieldControl ReadOnly. */
  readOnly: boolean;
  /** Common.FieldControl Inapplicable (FieldEditMode Disabled). */
  disabled: boolean;
}

/** Edit state of a parameter for the (first) bound entity `row`. */
export function actionParameterState(p: ActionParameterModel, row?: Row): ActionParameterState {
  const prop = p.property;
  const fc = fieldControl(p, row);
  const hidden = p.name === 'ResultIsActiveEntity' || Boolean(prop && (prop.hidden || (prop.hiddenPath && read(row, prop.hiddenPath) === true)));
  const readOnly = Boolean(prop?.computed || prop?.immutable) || fc === 1;
  return { hidden, required: fc === 7, readOnly, disabled: !readOnly && fc === 0 };
}

/**
 * FE OperationParameters: the dialog is skipped when every parameter but ResultIsActiveEntity has UI.Hidden true (then
 * the values are the constant UI.ParameterDefaultValue ones, see {@link actionParameterDefaults} with `constantsOnly`).
 * False when the action has no parameters.
 */
export function skipsParameterDialog(action: ActionModel): boolean {
  const shown = action.parameters.filter((p) => p.name !== 'ResultIsActiveEntity');
  return action.parameters.length > 0 && shown.every((p) => p.property?.hidden === true);
}

/**
 * Default values of the parameters (FE OperationParameterDialog getParameterDefaultValue): UI.ParameterDefaultValue as
 * a constant, or as a path read from the bound entities `rows`; with several rows a path value is used only when all
 * rows have the same one (otherwise the field stays empty). `constantsOnly`: the values FE uses without a dialog.
 */
export function actionParameterDefaults(action: ActionModel, rows: (Row | undefined)[], o: { constantsOnly?: boolean } = {}): Row {
  const out: Row = {};
  for (const p of action.parameters) {
    const d = p.defaultValue;
    if (!d) continue;
    if ('value' in d) out[p.name] = d.value;
    else if (!o.constantsOnly && rows.length) {
      const values = rows.map((r) => read(r, d.path));
      if (values.every((v) => v === values[0]) && values[0] !== undefined) out[p.name] = values[0];
    }
  }
  return out;
}

const INTEGER = /^Edm\.(Byte|SByte|Int16|Int32)$/;
const FLOAT = /^Edm\.(Double|Single)$/;
const STRING_NUMBER = /^Edm\.(Int64|Decimal)$/;

/** A number typed in the dialog ("1,5" with a decimal comma is not accepted). */
export const isNumberText = (v: string) => /^[-+]?(\d+(\.\d*)?|\.\d+)([eE][-+]?\d+)?$/.test(v.trim());

/**
 * The value of one parameter in the request body, in the model format of its Edm type as SAPUI5's OData V4 model sends it
 * (IEEE754Compatible): Byte, SByte, Int16, Int32, Double and Single as JSON numbers; Int64 and Decimal as strings;
 * Boolean as a JSON boolean; Date "YYYY-MM-DD", DateTimeOffset, TimeOfDay, Guid and String as strings. "" is null.
 */
export function actionParameterValue(p: ActionParameterModel, value: unknown): unknown {
  if (value === undefined || value === null) return value;
  if (Array.isArray(value)) return value.map((v) => actionParameterValue({ ...p, collection: false }, v));
  if (typeof value === 'string' && value.trim() === '' && p.edmType !== 'Edm.String') return null;
  if (p.edmType === 'Edm.String') return value === '' ? null : String(value);
  if (p.edmType === 'Edm.Boolean') return value === true || value === 'true';
  if (INTEGER.test(p.edmType) || FLOAT.test(p.edmType)) {
    const n = typeof value === 'number' ? value : Number(String(value).trim());
    return Number.isFinite(n) ? n : value;
  }
  if (STRING_NUMBER.test(p.edmType)) return typeof value === 'number' ? String(value) : String(value).trim();
  return value;
}

/** FE ODataOperation setParametersValue: an empty value of a non-nullable parameter becomes its type's default. */
function typeDefault(p: ActionParameterModel): unknown {
  switch (p.edmType) {
    case 'Edm.String': return '';
    case 'Edm.Boolean': return false;
    case 'Edm.Byte': case 'Edm.Int16': case 'Edm.Int32': case 'Edm.Int64': return 0;
    case 'Edm.Decimal': return '0';
    default: return undefined;
  }
}

/**
 * The request body of an action (FE OperationParameterDialog onApply, ODataOperation setParametersValue): every
 * parameter with its typed value; parameters without a value are left out, except non-nullable ones, which get their
 * type's default ("" / false / 0 / "0").
 */
export function actionParameterBody(action: ActionModel, values: Row): Row {
  const out: Row = {};
  for (const p of action.parameters) {
    let v = actionParameterValue(p, values[p.name]);
    if (!v && !p.nullable) v = typeDefault(p) ?? v;
    if (v !== undefined) out[p.name] = v;
  }
  return out;
}

/**
 * Parameters that block the submit (FE ActionRuntime validateProperties): shown mandatory parameters without a value
 * ("missing") and shown numeric parameters whose text is no number ("invalid"), in parameter order.
 */
export function actionParameterErrors(action: ActionModel, values: Row, row?: Row): { name: string; kind: 'missing' | 'invalid' }[] {
  const out: { name: string; kind: 'missing' | 'invalid' }[] = [];
  for (const p of action.parameters) {
    const s = actionParameterState(p, row);
    if (s.hidden || s.readOnly || s.disabled) continue;
    const v = values[p.name];
    const empty = v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length);
    if (empty) {
      if (s.required) out.push({ name: p.name, kind: 'missing' });
    } else if ((INTEGER.test(p.edmType) || FLOAT.test(p.edmType) || STRING_NUMBER.test(p.edmType)) && typeof v === 'string' && !isNumberText(v)) {
      out.push({ name: p.name, kind: 'invalid' });
    }
  }
  return out;
}
