/**
 * The "New Object" dialog of a NewPage creation (FE TransactionHelper performCreationWithPOST / createWithDialog with
 * creation mode "WithNavigation"): before the new draft is created, FE asks the fields of
 * MetaModelFunction getCreatePopupFields — the non-computed visible keys (not Edm.Guid, or a Guid with Common.Text),
 * then the non-computed visible immutable properties (Core.Immutable) — titled "New Object" with "Continue" and
 * "Cancel" (C_TRANSACTION_HELPER_SAPFE_ACTION_CREATE, …_BUTTON_CONTINUE). The values are sent with the POST.
 */
import { Button, Group, Modal, Stack } from '@mantine/core';
import { messagesFromError, type FieldModel, type MetaModel, type Row } from '@rhfan2019/smart-kit-core';
import { useState } from 'react';
import { useService, useText } from '../context/SmartKitProvider';
import { Field } from '../field/Field';
import { fieldErrors, validate } from './editing';

/** Fields FE asks before a creation (MetaModelFunction getCreatePopupFields): keys first, then immutable properties. */
export function createPopupFields(model: MetaModel, typeName: string): FieldModel[] {
  const type = model.entityTypes[typeName];
  if (!type) return [];
  const keys: string[] = [];
  const immutable: string[] = [];
  for (const name of type.propertyOrder) {
    const p = type.properties[name]!;
    // the draft key IsActiveEntity is set by the service, never asked
    if (p.computed || p.hidden || name === 'IsActiveEntity') continue;
    const isKey = type.keys.includes(name);
    if (isKey && (p.edmType !== 'Edm.Guid' || Boolean(p.text))) keys.push(name);
    else if (!isKey && p.immutable) immutable.push(name);
  }
  return [...keys, ...immutable].map((name) => ({ id: `DataField::${name}`, kind: 'field', path: name, label: type.properties[name]!.label, criticalityIcon: true, isSemanticKey: false }));
}

export interface NewObjectDialogProps {
  opened: boolean;
  service?: string;
  typeName: string;
  fields: FieldModel[];
  /** Creates the object with the values; throws to keep the dialog open (its messages are shown). */
  onContinue(values: Row): Promise<unknown>;
  onCancel(): void;
}

/** "New Object" dialog (FE CreateDialog "WithNavigation"). */
export function NewObjectDialog(p: NewObjectDialogProps) {
  const t = useText();
  const service = useService(p.service);
  const [values, setValues] = useState<Row>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const close = () => { setValues({}); setErrors({}); p.onCancel(); };
  const submit = async () => {
    const client = validate(service.model, p.typeName, p.fields, values, t, true);
    setErrors(fieldErrors(client));
    if (client.length) return;
    setBusy(true);
    try {
      // FE sends only the values entered
      await p.onContinue(Object.fromEntries(Object.entries(values).filter(([, v]) => v !== undefined && v !== '')));
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
    <Modal opened={p.opened} onClose={close} title={t('create.newObject')} data-sk-new-object-dialog closeButtonProps={{ 'aria-label': t('common.close') }}>
      <form noValidate onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <Stack gap="sm">
          {p.fields.map((f) => (
            <div key={f.id} data-sk-create-field={f.path}>
              <Field
                typeName={p.typeName} service={p.service} metaPath={f} row={values} readOnly={false} showLabel aria-label={f.label}
                value={f.path ? values[f.path] : undefined} error={f.path ? errors[f.path] : undefined}
                onChange={(e) => setValues((x) => ({ ...x, [f.path!]: e.value }))} onLiveChange={(e) => setValues((x) => ({ ...x, [f.path!]: e.value }))}
              />
            </div>
          ))}
          {errors.$form ? <div className="sk-form__error" role="alert">{errors.$form}</div> : null}
          <Group justify="flex-end">
            <Button type="submit" loading={busy} data-sk-create-submit>{t('create.continue')}</Button>
            <Button variant="default" onClick={close}>{t('common.cancel')}</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
