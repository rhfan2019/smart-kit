/** Editing helpers shared by the object page, sub-tables and create dialogs (ADR-018). */
import { Button, Group, Modal, Stack } from '@mantine/core';
import {
  createMessage, editStrategyFor, messagesFromError, resolvePath, type EditStrategy, type FieldModel, type Message, type MetaModel,
  type PropertyModel, type QuerySource, type Row,
} from '@rhfan2019/smart-kit-core';
import { useMemo, useState } from 'react';
import { useService, useText } from '../context/SmartKitProvider';
import type { TextFn } from '../i18n/text';
import { Field } from '../field/Field';

/** The edit strategy of an entity set (service override or the default by model). */
export function useEditStrategy(entitySet: string, serviceName?: string): EditStrategy {
  const service = useService(serviceName);
  return useMemo(() => service.editStrategy?.(entitySet) ?? editStrategyFor(service.model, entitySet, service.dataProvider), [service, entitySet]);
}

/** Whether a property can be changed: not computed, not a key, not read-only (immutable only when creating). */
export function isEditable(prop: PropertyModel | undefined, creating: boolean): boolean {
  if (!prop) return false;
  if (prop.computed || prop.readOnly || prop.hidden) return false;
  if (prop.isKey && !creating) return false;
  if (prop.isKey && creating && prop.name === 'IsActiveEntity') return false;
  if (prop.immutable && !creating) return false;
  return true;
}

const NUMERIC = /Int|Decimal|Double|Single|Byte/;

/** Client validation (OP In Edit Mode): mandatory fields and number formats; messages target the property path. */
export function validate(model: MetaModel, typeName: string, fields: FieldModel[], values: Row, t: TextFn, creating = false): Message[] {
  const out: Message[] = [];
  const seen = new Set<string>();
  for (const f of fields) {
    if (f.kind !== 'field' || !f.path || f.path.includes('/') || seen.has(f.path)) continue;
    seen.add(f.path);
    const prop = resolvePath(model.entityTypes, typeName, f.path).property;
    if (!isEditable(prop, creating)) continue;
    const v = values[f.path];
    const empty = v === undefined || v === null || v === '';
    if (prop!.mandatory && empty) out.push(createMessage('error', t('edit.requiredField', { field: f.label }), { target: f.path, source: 'client' }));
    else if (!empty && NUMERIC.test(prop!.edmType) && !/^[-+]?(\d+(\.\d*)?|\.\d+)$/.test(String(v).trim())) out.push(createMessage('error', t('edit.invalidNumber', { field: f.label }), { target: f.path, source: 'client' }));
  }
  return out;
}

/** Field errors by property path from messages. */
export function fieldErrors(messages: Message[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of messages) if (m.type === 'error' && m.target) out[m.target.split('/').pop()!] ??= m.message;
  return out;
}

/** Fields of a create dialog: the mandatory properties (LR Add/Create Using a Dialog: fewer than 8 required fields). */
export function createFields(model: MetaModel, typeName: string, lineItem: FieldModel[]): FieldModel[] {
  const type = model.entityTypes[typeName]!;
  const mandatory = type.propertyOrder.map((n) => type.properties[n]!).filter((p) => p.mandatory && isEditable(p, true));
  if (mandatory.length) {
    return mandatory.map((p) => lineItem.find((f) => f.path === p.name) ?? { id: `DataField::${p.name}`, kind: 'field', path: p.name, label: p.label, criticalityIcon: true, isSemanticKey: false });
  }
  return lineItem.filter((f) => f.kind === 'field' && f.path && !f.path.includes('/') && isEditable(type.properties[f.path], true));
}

export interface CreateDialogProps {
  /** Whether the dialog is open (controlled). */
  opened: boolean;
  /** Called when the dialog closes. */
  onClose(): void;
  /** Dialog title, e.g. "Create Purchase Order". */
  title: string;
  /** Name of the service in `SmartKitProvider` `services`; default: the provider's `defaultService`. */
  service?: string;
  /** Full name of the entity type, e.g. "Shop.Order" (`model.entitySets[set].typeName`). */
  typeName: string;
  /** Fields asked in the dialog (usually from `createFields(...)`: keys that are not computed and mandatory properties). */
  fields: FieldModel[];
  /** Creates the object from the values; throws to keep the dialog open (messages are shown in the dialog). */
  onCreate(values: Row): Promise<void>;
}

/** Dialog with the fields of a new object (LR Add/Create Items Using a Dialog, OP Create and edit subobjects). */
export function CreateDialog(p: CreateDialogProps) {
  const t = useText();
  const service = useService(p.service);
  const [values, setValues] = useState<Row>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    const client = validate(service.model, p.typeName, p.fields, values, t, true);
    setErrors(fieldErrors(client));
    if (client.length) return;
    setBusy(true);
    try {
      await p.onCreate(values);
      setValues({});
      setErrors({});
    } catch (e) {
      const ms = messagesFromError(e);
      const fe = fieldErrors(ms);
      setErrors(Object.keys(fe).length ? fe : { $form: ms.map((m) => m.message).join(' ') });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal opened={p.opened} onClose={() => { setValues({}); setErrors({}); p.onClose(); }} title={p.title} data-sk-create-dialog closeButtonProps={{ 'aria-label': t('common.close') }}>
      <form noValidate onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <Stack gap="sm">
          {p.fields.map((f) => {
            return (
              <div key={f.id} data-sk-create-field={f.path}>
                <Field
                  typeName={p.typeName} service={p.service} metaPath={f} row={values} readOnly={false} showLabel aria-label={f.label}
                  value={f.path ? values[f.path] : undefined} error={f.path ? errors[f.path] : undefined}
                  onChange={(e) => setValues((x) => ({ ...x, [f.path!]: e.value }))} onLiveChange={(e) => setValues((x) => ({ ...x, [f.path!]: e.value }))}
                />
              </div>
            );
          })}
          {errors.$form ? <div className="sk-form__error" role="alert">{errors.$form}</div> : null}
          <Group justify="flex-end">
            <Button type="submit" loading={busy} data-sk-create-submit>{t('actions.create')}</Button>
            <Button variant="default" onClick={() => { setValues({}); setErrors({}); p.onClose(); }}>{t('common.cancel')}</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

/** Creates an entity with the edit strategy (draft: create, set, activate; direct: POST). */
export async function createWith(strategy: EditStrategy, target: QuerySource, values: Row): Promise<{ path: string; row: Row; messages: Message[] }> {
  const session = await strategy.create(target, strategy.kind === 'draft' ? {} : values);
  if (strategy.kind === 'draft') for (const [k, v] of Object.entries(values)) session.set(k, v);
  try {
    return await session.save();
  } catch (e) {
    if (strategy.kind === 'draft') await session.cancel().catch(() => undefined);
    throw e;
  }
}
