/**
 * Table cells of the column types Fiori elements renders specially (sap.fe.macros.table.MdcTableTemplate, docs/29 §5):
 * a field group (its values stacked, no labels), connected fields (the template in one line), a contact (the name as
 * a link opening the details), an inline action (a button, disabled when not available), a DataFieldWithAction value
 * (a link running the action) and a DataFieldWithNavigationPath value (a link to the target object).
 */
import { Anchor, Button } from '@mantine/core';
import type { ActionModel, FieldModel, Row } from '@rhfan2019/smart-kit-core';
import type { ReactNode } from 'react';
import { isActionAvailable } from '../actions/useActionRunner';
import { ContactLink } from '../field/ContactLink';
import { Field } from '../field/Field';
import { getPath } from '../field/values';

export interface CellEnv {
  typeName: string;
  service?: string;
  /** Runs an action on the row. */
  run(action: ActionModel, row: Row): void;
  /** Opens the object reached from the row by a navigation property. */
  navigate(row: Row, navigation: string): void;
}

const stop = (e: { stopPropagation(): void }) => e.stopPropagation();

function plain(env: CellEnv, f: FieldModel, row: Row) {
  return <Field typeName={env.typeName} service={env.service} metaPath={{ ...f, action: undefined, navigationPath: undefined }} row={row} cell />;
}

/** Splits a ConnectedFields template "{A} – {B}" into literals and keys (sap.fe.macros.ConnectedFields). */
export function templateParts(text: string, keys: string[]): ({ key: string } | { literal: string })[] {
  const parts = text.split(/\{([^}]+)\}/);
  const placeholders = parts.filter((_, i) => i % 2 === 1).map((k) => k.trim());
  const perfect = placeholders.length === keys.length && new Set(placeholders).size === placeholders.length && placeholders.every((k) => keys.includes(k));
  if (!perfect) return keys.map((key) => ({ key }));
  return parts.flatMap((part, i): ({ key: string } | { literal: string })[] => (i % 2 === 1 ? [{ key: part.trim() }] : part ? [{ literal: part }] : []));
}

/** The cell content of a column of the given field, or undefined when the field is a plain one (rendered by Field). */
export function specialCell(env: CellEnv, f: FieldModel, row: Row): ReactNode | undefined {
  switch (f.kind) {
    case 'fieldGroup':
      return <span className="sk-cell__group" data-sk-field-group>{(f.fields ?? []).map((x) => <span key={x.id} className="sk-cell__group-item">{plain(env, x, row)}</span>)}</span>;
    case 'connectedFields': {
      const byKey = Object.fromEntries((f.template?.keys ?? []).map((k, i) => [k, f.fields?.[i]]));
      // FE shows nothing when every connected value is empty
      if ((f.fields ?? []).every((x) => x.path && (getPath(row, x.path) === null || getPath(row, x.path) === undefined))) return null;
      return (
        <span className="sk-cell__connected" data-sk-connected-fields>
          {templateParts(f.template?.text ?? '', f.template?.keys ?? []).map((part, i) => ('key' in part
            ? byKey[part.key] ? <span key={i}>{plain(env, byKey[part.key]!, row)}</span> : null
            : <span key={i}>{part.literal.replace(/ /g, ' ')}</span>))}
        </span>
      );
    }
    case 'contact':
      // the contact popover of Field (ContactLink): the list reads only the name, the details when it opens (as FE)
      return <ContactLink typeName={env.typeName} field={f} row={row} service={env.service} />;
    case 'action': {
      const a = f.action!;
      // FE: the button of an inline action is disabled where Core.OperationAvailable is false
      return (
        <Button size="compact-xs" variant="subtle" disabled={!isActionAvailable(a, row)} onClick={(e) => { stop(e); env.run(a, row); }} data-sk-inline-action={a.id}>{a.label}</Button>
      );
    }
    case 'field':
      if (f.action) {
        const a = f.action;
        return <Anchor component="button" type="button" size="sm" disabled={!isActionAvailable(a, row)} onClick={(e) => { stop(e); env.run(a, row); }} data-sk-field-action={a.id}>{plain(env, f, row)}</Anchor>;
      }
      if (f.navigationPath) {
        const nav = f.navigationPath;
        return <Anchor component="button" type="button" size="sm" onClick={(e) => { stop(e); env.navigate(row, nav); }} data-sk-field-navigation={nav}>{plain(env, f, row)}</Anchor>;
      }
      return undefined;
    default:
      return undefined;
  }
}
