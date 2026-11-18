/**
 * Field editors of the edit mode (phase 2, OP Edit): by Edm type and annotations. Value lists as FE's field with
 * value help (macros/internal/valuehelp): fixed values as a selection, other value lists (also those of
 * Common.ValueListReferences) as an input with type-ahead that shows the value with its text; dates in the medium
 * date style (sap.ui.model.odata.type.Date); UI.Placeholder as the placeholder.
 */
import { Autocomplete, Checkbox, Select, Textarea, TextInput } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { arrangeText, formatDate, valueListTextArrangement, type PropertyModel, type ValueListModel } from '@rhfan2019/smart-kit-core';
import dayjs from 'dayjs';
import { useState } from 'react';
import { useService, useSmartKit } from '../context/SmartKitProvider';
import { useValueList, useValueListsOfType } from '../filter/useValueList';

export interface FieldEditorProps {
  /** Property model of the field (`model.entityTypes[type].properties[name]`). */
  property?: PropertyModel;
  /** Value (controlled). */
  value: unknown;
  /** Called with the new value when it is committed (sap.fe.macros.Field#change): text editors on blur or Enter, the other editors at once. */
  onChange?(value: unknown): void;
  /** Called on every keystroke of a text editor with the text typed so far (sap.fe.macros.Field#liveChange). */
  onLiveChange?(value: string): void;
  /** Lines of a multi-line text editor (FieldFormatOptions.textLinesEdit); default 2. */
  minRows?: number;
  /** Maximum number of characters (FieldFormatOptions.textMaxLength); default: the property's MaxLength. */
  maxLength?: number;
  /** Accessible name / visible label. */
  label: string;
  /** Visible label (forms in dialogs); without it the label is only the accessible name. */
  showLabel?: boolean;
  /** Unit or currency code shown with the value. */
  unit?: string;
  /** Error text shown under the field. */
  error?: string;
  /** Shows the mandatory marker and validates that a value is entered. */
  required?: boolean;
  /** Disables the input. */
  disabled?: boolean;
  /** Element id (e.g. for an external `<label htmlFor>`). */
  id?: string;
  /** Name of the service in `SmartKitProvider` `services`; default: the provider's `defaultService`. */
  service?: string;
  /** Entity type and property path of the field: value lists of Common.ValueListReferences are loaded for them. */
  typeName?: string;
  path?: string;
  /** The value as displayed (with its text, e.g. "Name (Key)"): shown in a value help input while it is not changed. */
  displayValue?: string;
}

const NUMERIC = /Int|Decimal|Double|Single|Byte/;

/** "Text (Key)" of a value list entry as the property's text arrangement says (FE value help display format). */
function useEntryLabel(p: FieldEditorProps, vl: ValueListModel) {
  const model = useService(p.service).model;
  const arrangement = valueListTextArrangement(model, p.property, vl);
  return (code: string, text: unknown) => arrangeText(code, text === undefined || text === null ? undefined : String(text), arrangement);
}

function FixedValues(p: FieldEditorProps & { valueList: ValueListModel }) {
  const q = useValueList(p.valueList, { top: 100 }, p.service);
  const vl = p.valueList;
  const labelOf = useEntryLabel(p, vl);
  const data = (q.data?.rows ?? []).map((r) => {
    const code = String(r[vl.keyProperty] ?? '');
    return { value: code, label: labelOf(code, vl.descriptionProperty ? r[vl.descriptionProperty] : undefined) };
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

/** Parses a date typed in the medium style of `locale` (or ISO); null when it is no date. */
export function parseLocalDate(text: string, locale: string): string | null {
  const v = text.trim();
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const parts = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).formatToParts(new Date(Date.UTC(2000, 10, 22)));
  const order = parts.filter((x) => x.type === 'year' || x.type === 'month' || x.type === 'day').map((x) => x.type);
  const tokens = v.match(/\d+|[^\d\s.,/\-\u5e74\u6708\u65e5]+/gu) ?? [];
  if (tokens.length < 3) return null;
  const months = Array.from({ length: 12 }, (_, i) => new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2000, i, 1))).toLowerCase().replace(/\.$/, ''));
  const out: Record<string, number> = {};
  order.forEach((k, i) => {
    const tok = tokens[i]!;
    out[k] = /^\d+$/.test(tok) ? Number(tok) : months.findIndex((m) => m.startsWith(tok.toLowerCase().replace(/\.$/, ''))) + 1;
  });
  const d = dayjs(`${out.year}-${String(out.month).padStart(2, '0')}-${String(out.day).padStart(2, '0')}`, 'YYYY-MM-DD');
  return out.year && out.month > 0 && out.day && d.isValid() && d.month() + 1 === out.month ? d.format('YYYY-MM-DD') : null;
}

/** A value list that is not a fixed list: an input with type-ahead; the entries show "Text (Key)". */
function ValueHelpInput(p: FieldEditorProps & { valueList: ValueListModel }) {
  const vl = p.valueList;
  const current = p.value === null || p.value === undefined ? '' : String(p.value);
  const shown = p.displayValue ?? current;
  const [text, setText] = useState<string | undefined>(undefined);
  const q = useValueList(vl, { search: text || undefined, top: 20, enabled: text !== undefined }, p.service);
  const labelOf = useEntryLabel(p, vl);
  const options = (q.data?.rows ?? []).map((r) => {
    const code = String(r[vl.keyProperty] ?? '');
    return { value: labelOf(code, vl.descriptionProperty ? r[vl.descriptionProperty] : undefined), key: code };
  });
  const keyOf = (t: string) => options.find((o) => o.value === t)?.key ?? /\(([^()]*)\)\s*$/.exec(t)?.[1] ?? t.trim();
  const commit = (t: string) => {
    setText(undefined);
    if (t === shown) return;
    p.onChange?.(t.trim() ? keyOf(t) : null);
  };
  return (
    <Autocomplete
      id={p.id} label={p.showLabel ? p.label : undefined} aria-label={p.showLabel ? undefined : p.label} error={p.error} required={p.required} disabled={p.disabled}
      placeholder={p.property?.placeholder}
      value={text ?? shown} data={[...new Map(options.map((o) => [o.value, o.value])).values()]} filter={({ options: o }) => o}
      onChange={(t) => { setText(t); p.onLiveChange?.(t); }}
      onOptionSubmit={(t) => commit(t)}
      onBlur={() => { if (text !== undefined) commit(text); }}
      data-sk-editor="valuehelp"
    />
  );
}

export function FieldEditor(p: FieldEditorProps) {
  const prop = p.property;
  const { intlLocale } = useSmartKit();
  // Common.ValueList, or the value lists of Common.ValueListReferences (loaded from the value help services)
  const referenced = useValueListsOfType(p.typeName ?? '', p.path ?? prop?.name ?? '', p.service, Boolean(prop?.valueListReferences?.length && p.typeName));
  const valueList = prop?.valueList ?? referenced.valueList;
  const fixed = prop?.valueList?.fixedValues ?? referenced.fixedValues;
  // text editors keep the typed text until it is committed (blur, Enter), as UI5 fires `change` only then
  const [draft, setDraft] = useState<string | undefined>(undefined);
  const type = (text: string) => { setDraft(text); p.onLiveChange?.(text); };
  const commit = () => { if (draft !== undefined) { p.onChange?.(draft); setDraft(undefined); } };
  const textValue = draft ?? (p.value === null || p.value === undefined ? '' : String(p.value));
  const common = {
    id: p.id,
    label: p.showLabel ? p.label : undefined,
    'aria-label': p.showLabel ? undefined : p.label,
    error: p.error,
    required: p.required,
    disabled: p.disabled,
  };
  if (valueList && fixed) return <FixedValues {...p} valueList={valueList} />;
  if (valueList && !NUMERIC.test(prop?.edmType ?? '') && prop?.edmType !== 'Edm.Date' && prop?.edmType !== 'Edm.Boolean') return <ValueHelpInput {...p} valueList={valueList} />;
  if (prop?.edmType === 'Edm.Boolean') {
    return <Checkbox id={p.id} checked={p.value === true || p.value === 'true'} disabled={p.disabled} label={p.showLabel ? p.label : undefined} aria-label={p.showLabel ? undefined : p.label} onChange={(e) => p.onChange?.(e.currentTarget.checked)} data-sk-editor="boolean" />;
  }
  if (prop?.edmType === 'Edm.Date') {
    const d = typeof p.value === 'string' && p.value ? p.value : null;
    return (
      <DateInput
        {...common} value={d} valueFormat={(v) => formatDate(v, intlLocale)} dateParser={(v) => parseLocalDate(v, intlLocale)} clearable={!p.required}
        placeholder={prop.placeholder}
        onChange={(v) => p.onChange?.(v ? dayjs(v).format('YYYY-MM-DD') : null)}
        data-sk-editor="date"
      />
    );
  }
  if (prop?.multiLine) {
    return <Textarea {...common} placeholder={prop.placeholder} value={textValue} autosize minRows={p.minRows ?? 2} maxLength={p.maxLength ?? prop.maxLength} onChange={(e) => type(e.currentTarget.value)} onBlur={commit} data-sk-editor="text" />;
  }
  return (
    <TextInput
      {...common}
      value={textValue}
      placeholder={prop?.placeholder}
      maxLength={p.maxLength ?? prop?.maxLength}
      inputMode={prop && NUMERIC.test(prop.edmType) ? 'decimal' : undefined}
      rightSection={p.unit ? <span className="sk-field__unit">{p.unit}</span> : undefined}
      rightSectionWidth={p.unit ? 48 : undefined}
      description={prop?.description}
      onChange={(e) => type(e.currentTarget.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') commit(); }}
      data-sk-editor={prop && NUMERIC.test(prop.edmType) ? 'number' : 'text'}
    />
  );
}
