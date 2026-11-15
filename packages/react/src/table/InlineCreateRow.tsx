/** A new row at the top of a sub-table (OP Create and edit subobjects: Add / Ctrl+Enter creates a row at the top). */
import { Button, Group } from '@mantine/core';
import { messagesFromError, resolvePath, type FieldModel, type Row } from '@rhfan2019/smart-kit-core';
import { useState } from 'react';
import { useService, useText } from '../context/SmartKitProvider';
import { fieldErrors, validate } from '../edit/editing';
import { SmartField } from '../field/SmartField';

export function InlineCreateRow(p: { service?: string; typeName: string; fields: FieldModel[]; onCreate(values: Row): Promise<void>; onCancel(): void }) {
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
    } catch (e) {
      const ms = messagesFromError(e);
      setErrors({ ...fieldErrors(ms), $row: ms.map((m) => m.message).join(' ') });
    } finally {
      setBusy(false);
    }
  };
  return (
    <form noValidate
      className="sk-inline-create" data-sk-inline-create role="group" aria-label={t('edit.newRow')}
      onSubmit={(e) => { e.preventDefault(); void submit(); }}
      onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void submit(); } if (e.key === 'Escape') p.onCancel(); }}
    >
      <div className="sk-inline-create__fields">
        {p.fields.map((f, i) => (
          <div key={f.id} className="sk-inline-create__field" data-sk-create-field={f.path}>
            <SmartField
              typeName={p.typeName} service={p.service} field={f} row={values} mode="edit" showLabel aria-label={f.label}
              value={f.path ? values[f.path] : undefined} required={f.path ? resolvePath(service.model.entityTypes, p.typeName, f.path).property?.mandatory : false}
              error={f.path ? errors[f.path] : undefined} onChange={(v) => setValues((x) => ({ ...x, [f.path!]: v }))}
              id={i === 0 ? 'sk-inline-create-first' : undefined}
            />
          </div>
        ))}
      </div>
      {errors.$row ? <div className="sk-form__error" role="alert">{errors.$row}</div> : null}
      <Group gap="xs" justify="flex-end">
        <Button type="submit" size="xs" loading={busy} data-sk-inline-create-submit>{t('edit.createRow')}</Button>
        <Button size="xs" variant="default" onClick={p.onCancel}>{t('common.cancel')}</Button>
      </Group>
    </form>
  );
}
