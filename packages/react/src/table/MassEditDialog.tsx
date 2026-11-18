/**
 * The mass edit dialog of the table (sap.fe.macros.Table `massEdit`, FE MassEditDialogHelper / MassEditDialog): a
 * field per updatable column whose select offers "< Keep Existing Values >" (the default), the distinct values of the
 * selected rows (of the first 30, FE maxAnalyzedRows), "< Leave Blank >" for optional fields and a new value; Boolean
 * fields offer Yes / No. "Apply" changes the chosen fields of every selected row (draft lists: the drafts are edited
 * and activated, the edit strategy's begin / set / save).
 */
import { Button, Group, Modal, Select, Stack, Text } from '@mantine/core';
import type { EntityTypeModel, FieldModel, Row } from '@rhfan2019/smart-kit-core';
import { useMemo, useState, type ReactNode } from 'react';
import { useText } from '../context/SmartKitProvider';
import { isEditable } from '../edit/fieldControl';
import { FieldEditor } from '../field/FieldEditor';

const KEEP = '$keep';
const BLANK = '$blank';
const NEW = '$new';
/** Rows whose values are offered (FE maxAnalyzedRows). */
const ANALYZED = 30;

/** The fields of the dialog: updatable plain properties of the columns, filtered by `visibleFields` / `ignoredFields`. */
export function massEditFields(type: EntityTypeModel, columns: (FieldModel | undefined)[], o: { visibleFields?: string[]; ignoredFields?: string[] }): { path: string; label: string }[] {
  const out: { path: string; label: string }[] = [];
  for (const f of columns) {
    const path = f?.kind === 'field' ? f.path : undefined;
    if (!path || path.includes('/') || out.some((x) => x.path === path)) continue;
    const prop = type.properties[path];
    if (!isEditable(prop, false) || prop!.edmType === 'Edm.Stream') continue;
    if (o.visibleFields?.length && !o.visibleFields.includes(path)) continue;
    if (o.ignoredFields?.includes(path)) continue;
    out.push({ path, label: f!.label || prop!.label });
  }
  return out;
}

export interface MassEditDialogProps {
  opened: boolean;
  type: EntityTypeModel;
  typeName: string;
  service?: string;
  /** The fields of the shown columns; the dialog offers the updatable ones (`massEditFields`). */
  columns: (FieldModel | undefined)[];
  visibleFields?: string[];
  ignoredFields?: string[];
  rows: Row[];
  /** Further content below the fields (MassEdit `customContent`). */
  customContent?: ReactNode;
  /** Applies the changed values (property → value) to the rows. */
  onApply(changes: Row): Promise<void>;
  onClose(): void;
}

const keyOfValue = (v: unknown) => `v:${JSON.stringify(v)}`;

export default function MassEditDialog(props: MassEditDialogProps) {
  const fields = useMemo(() => massEditFields(props.type, props.columns, { visibleFields: props.visibleFields, ignoredFields: props.ignoredFields }), [props.type, props.columns, props.visibleFields, props.ignoredFields]);
  const p = { ...props, fields };
  const t = useText();
  const [choice, setChoice] = useState<Record<string, string>>({});
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [busy, setBusy] = useState(false);
  const analyzed = p.rows.slice(0, ANALYZED);
  const options = useMemo(() => Object.fromEntries(p.fields.map((f) => {
    const prop = p.type.properties[f.path]!;
    if (prop.edmType === 'Edm.Boolean') return [f.path, [{ value: KEEP, label: t('table.massEdit.keep') }, { value: keyOfValue(true), label: t('common.yes') }, { value: keyOfValue(false), label: t('common.no') }]];
    const distinct = [...new Map(analyzed.map((r) => r[f.path]).filter((v) => v !== null && v !== undefined && v !== '').map((v) => [keyOfValue(v), v])).entries()];
    return [f.path, [
      { value: KEEP, label: t('table.massEdit.keep') },
      { value: NEW, label: t('table.massEdit.new') },
      ...(prop.mandatory ? [] : [{ value: BLANK, label: t('table.massEdit.blank') }]),
      ...distinct.map(([value, v]) => ({ value, label: String(v) })),
    ]];
  })), [p.fields, p.rows]); // eslint-disable-line react-hooks/exhaustive-deps
  const changes = (): Row => {
    const out: Row = {};
    for (const f of p.fields) {
      const c = choice[f.path] ?? KEEP;
      if (c === KEEP) continue;
      if (c === BLANK) out[f.path] = null;
      else if (c === NEW) { if (values[f.path] !== undefined) out[f.path] = values[f.path]; }
      else out[f.path] = JSON.parse(c.slice(2));
    }
    return out;
  };
  const apply = async () => {
    setBusy(true);
    try { await p.onApply(changes()); } finally { setBusy(false); }
  };
  return (
    <Modal opened={p.opened} onClose={p.onClose} title={t('table.massEditTitle', { count: p.rows.length })} data-sk-mass-edit>
      <Stack gap="sm">
        {p.fields.map((f) => (
          <Stack key={f.path} gap={4} data-sk-mass-edit-field={f.path}>
            <Select label={f.label} allowDeselect={false} value={choice[f.path] ?? KEEP} data={options[f.path] ?? []} onChange={(v) => v && setChoice((x) => ({ ...x, [f.path]: v }))} comboboxProps={{ withinPortal: true }} />
            {(choice[f.path] ?? KEEP) === NEW ? (
              <FieldEditor property={p.type.properties[f.path]} value={values[f.path] ?? null} onChange={(v) => setValues((x) => ({ ...x, [f.path]: v }))} label={f.label} service={p.service} typeName={p.typeName} path={f.path} />
            ) : null}
          </Stack>
        ))}
        {p.customContent}
        {!p.fields.length ? <Text c="dimmed">{t('table.noData.empty')}</Text> : null}
        <Group justify="flex-end">
          <Button onClick={() => void apply()} loading={busy} disabled={!Object.keys(changes()).length} data-sk-mass-edit-apply>{t('table.massEdit.apply')}</Button>
          <Button variant="default" onClick={p.onClose}>{t('common.cancel')}</Button>
        </Group>
      </Stack>
    </Modal>
  );
}
