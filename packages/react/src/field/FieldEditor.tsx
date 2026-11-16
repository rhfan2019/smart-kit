/** Field editors of the edit mode (phase 2, OP Edit): by Edm type and annotations. */
import { Checkbox, Select, Textarea, TextInput } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import type { PropertyModel, ValueListModel } from '@rhfan2019/smart-kit-core';
import dayjs from 'dayjs';
import { useValueList } from '../filter/useValueList';

export interface FieldEditorProps {
  property?: PropertyModel;
  value: unknown;
  onChange?(value: unknown): void;
  label: string;
  /** Visible label (forms in dialogs); without it the label is only the accessible name. */
  showLabel?: boolean;
  unit?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  service?: string;
}

const NUMERIC = /Int|Decimal|Double|Single|Byte/;

function FixedValues(p: FieldEditorProps & { valueList: ValueListModel }) {
  const q = useValueList(p.valueList, { top: 100 }, p.service);
  const vl = p.valueList;
  const data = (q.data?.rows ?? []).map((r) => {
    const code = String(r[vl.keyProperty] ?? '');
    const text = vl.descriptionProperty ? r[vl.descriptionProperty] : undefined;
    return { value: code, label: text ? `${String(text)} (${code})` : code };
  });
  const current = p.value === null || p.value === undefined ? null : String(p.value);
  if (current && !data.some((d) => d.value === current)) data.unshift({ value: current, label: current });
  return (
    <Select
      id={p.id} data={data} value={current} onChange={(v) => p.onChange?.(v)} label={p.showLabel ? p.label : undefined}
      aria-label={p.showLabel ? undefined : p.label} error={p.error} required={p.required} disabled={p.disabled} searchable allowDeselect={!p.required}
      data-sk-editor="select"
    />
  );
}

export function FieldEditor(p: FieldEditorProps) {
  const prop = p.property;
  const common = {
    id: p.id,
    label: p.showLabel ? p.label : undefined,
    'aria-label': p.showLabel ? undefined : p.label,
    error: p.error,
    required: p.required,
    disabled: p.disabled,
  };
  if (prop?.valueList?.fixedValues) return <FixedValues {...p} valueList={prop.valueList} />;
  if (prop?.edmType === 'Edm.Boolean') {
    return <Checkbox id={p.id} checked={p.value === true || p.value === 'true'} disabled={p.disabled} label={p.showLabel ? p.label : undefined} aria-label={p.showLabel ? undefined : p.label} onChange={(e) => p.onChange?.(e.currentTarget.checked)} data-sk-editor="boolean" />;
  }
  if (prop?.edmType === 'Edm.Date') {
    const d = typeof p.value === 'string' && p.value ? p.value : null;
    return (
      <DateInput
        {...common} value={d} valueFormat="YYYY-MM-DD" clearable={!p.required}
        onChange={(v) => p.onChange?.(v ? dayjs(v).format('YYYY-MM-DD') : null)}
        data-sk-editor="date"
      />
    );
  }
  if (prop?.multiLine) {
    return <Textarea {...common} value={String(p.value ?? '')} autosize minRows={2} maxLength={prop.maxLength} onChange={(e) => p.onChange?.(e.currentTarget.value)} data-sk-editor="text" />;
  }
  return (
    <TextInput
      {...common}
      value={p.value === null || p.value === undefined ? '' : String(p.value)}
      maxLength={prop?.maxLength}
      inputMode={prop && NUMERIC.test(prop.edmType) ? 'decimal' : undefined}
      rightSection={p.unit ? <span className="sk-field__unit">{p.unit}</span> : undefined}
      rightSectionWidth={p.unit ? 48 : undefined}
      description={prop?.description}
      onChange={(e) => p.onChange?.(e.currentTarget.value)}
      data-sk-editor={prop && NUMERIC.test(prop.edmType) ? 'number' : 'text'}
    />
  );
}
