/** SmartField: displays (and, for the edit seam, edits) one field according to its type and annotations. */
import { Avatar, Checkbox, Progress, Rating, Textarea, TextInput, Tooltip } from '@mantine/core';
import { resolvePath, type FieldModel, type Row } from '@rhfan2019/smart-kit-core';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import { useService, useSmartKit, useText } from '../context/SmartKitProvider';
import type { FieldRenderer, FieldRenderProps } from './renderers';
import { fieldValue, resolveRef } from './values';

export interface SmartFieldProps {
  /** Entity type full name the field belongs to. Use `entitySet` instead when convenient. */
  typeName?: string;
  entitySet?: string;
  service?: string;
  /** A field from the model, or just a property path. */
  field?: FieldModel;
  path?: string;
  row: Row | undefined;
  mode?: 'display' | 'edit';
  /** Edit mode: controlled value and change handler. */
  value?: unknown;
  onChange?(value: unknown): void;
  /** Label for accessibility when used without a visible label. */
  'aria-label'?: string;
}

const CRITICALITY_CLASS: Record<number, string> = { 0: 'neutral', 1: 'negative', 2: 'critical', 3: 'positive', 5: 'info' };

export function CriticalityIcon({ criticality }: { criticality: number }) {
  if (criticality === 1) return <XCircle className="sk-icon" aria-hidden />;
  if (criticality === 2) return <AlertTriangle className="sk-icon" aria-hidden />;
  if (criticality === 3) return <CheckCircle2 className="sk-icon" aria-hidden />;
  if (criticality === 5) return <Info className="sk-icon" aria-hidden />;
  return null;
}

function rendererFor(registry: Record<string, FieldRenderer>, typeName: string, field: FieldModel, p: FieldRenderProps): FieldRenderer | undefined {
  const keys = [
    field.path ? `path:${typeName}/${field.path}` : undefined,
    field.dataPoint?.visualization === 'Rating' ? 'rating' : undefined,
    field.dataPoint?.visualization === 'Progress' ? 'progress' : undefined,
    p.property?.isImageUrl ? 'image' : undefined,
    field.url || p.property?.isUrl ? 'link' : undefined,
    p.property?.isCurrency ? 'currency' : undefined,
    p.unit !== undefined ? 'unit' : undefined,
    p.criticality !== undefined ? 'criticality' : undefined,
    p.property?.edmType === 'Edm.Boolean' ? 'boolean' : undefined,
    p.property ? `type:${p.property.edmType}` : undefined,
  ];
  for (const k of keys) if (k && registry[k]) return registry[k];
  return undefined;
}

export function SmartField(props: SmartFieldProps) {
  const { renderers, intlLocale, timeZone } = useSmartKit();
  const t = useText();
  const service = useService(props.service);
  const typeName = props.typeName ?? (props.entitySet ? service.model.entitySets[props.entitySet]?.typeName : undefined) ?? '';
  const field: FieldModel = useMemo(
    () => props.field ?? { id: `DataField::${props.path}`, kind: 'field', path: props.path, label: resolvePath(service.model.entityTypes, typeName, props.path ?? '').property?.label ?? props.path ?? '', criticalityIcon: true, isSemanticKey: false },
    [props.field, props.path, service.model, typeName],
  );
  const v = fieldValue({ model: service.model, typeName, locale: intlLocale, timeZone }, field, props.row);
  const mode = props.mode ?? 'display';
  const renderProps: FieldRenderProps = { ...v, row: props.row ?? {}, field, mode, onChange: props.onChange };
  const custom = rendererFor(renderers, typeName, field, renderProps);
  if (custom) return <>{custom(renderProps)}</>;
  if (mode === 'edit' && field.kind === 'field') return <FieldEditor {...renderProps} value={props.value ?? v.value} label={props['aria-label'] ?? field.label} />;

  const dp = field.dataPoint;
  if (dp?.visualization === 'Rating') {
    const max = Number(resolveRef(props.row, dp.targetValue) ?? 5) || 5;
    const value = Number(v.value ?? 0);
    const label = t('field.rating', { value: v.formatted || '0', max });
    return (
      <span className="sk-field sk-field--rating" title={label}>
        <Rating value={value} count={max} fractions={2} readOnly size="sm" aria-label={label} />
      </span>
    );
  }
  if (dp?.visualization === 'Progress') {
    const target = Number(resolveRef(props.row, dp.targetValue) ?? 100) || 100;
    const value = Number(v.value ?? 0);
    const label = t('field.progress', { value: v.formatted || '0', target });
    return (
      <span className="sk-field sk-field--progress">
        <Progress value={Math.max(0, Math.min(100, (value / target) * 100))} aria-label={label} className="sk-progress" />
        <span className="sk-field__progress-text">{label}</span>
      </span>
    );
  }
  if (v.property?.isImageUrl) {
    return v.value ? <Avatar src={String(v.value)} alt={props['aria-label'] ?? field.label} size="sm" radius="sm" /> : null;
  }
  let content: ReactNode = v.display;
  if (v.property?.edmType === 'Edm.Boolean' && v.value !== null && v.value !== undefined) content = v.value === true || v.value === 'true' ? t('common.yes') : t('common.no');
  const url = field.url ? resolveRef(props.row, field.url) : v.property?.isUrl ? v.value : undefined;
  if (url && typeof url === 'string' && /^(https?:|\/|mailto:)/i.test(url)) {
    content = (
      <a href={url} className="sk-link" target={url.startsWith('/') ? undefined : '_blank'} rel="noreferrer">
        {content}
      </a>
    );
  }
  const crit = v.criticality;
  const className = [
    'sk-field',
    crit !== undefined ? `sk-status sk-status--${CRITICALITY_CLASS[crit] ?? 'neutral'}` : '',
    field.isSemanticKey ? 'sk-field--key' : '',
    v.property?.multiLine ? 'sk-field--multiline' : '',
    v.property && /Int|Decimal|Double|Single|Byte/.test(v.property.edmType) ? 'sk-field--number' : '',
  ].filter(Boolean).join(' ');
  return (
    <span className={className}>
      {crit !== undefined && field.criticalityIcon ? <CriticalityIcon criticality={crit} /> : null}
      <span className="sk-field__value">{content}</span>
      {v.unit && v.formatted ? <span className="sk-field__unit">{v.unit}</span> : null}
    </span>
  );
}

/** Minimal editors for the edit seam (phase 1 does not save; see docs/05-data-provider.md §6). */
function FieldEditor(p: FieldRenderProps & { label: string }) {
  const prop = p.property;
  const disabled = Boolean(prop?.computed || prop?.isKey);
  if (prop?.edmType === 'Edm.Boolean') {
    return <Checkbox checked={p.value === true} disabled={disabled} aria-label={p.label} onChange={(e) => p.onChange?.(e.currentTarget.checked)} />;
  }
  if (prop?.multiLine) {
    return <Textarea value={String(p.value ?? '')} disabled={disabled} aria-label={p.label} autosize minRows={2} onChange={(e) => p.onChange?.(e.currentTarget.value)} />;
  }
  const input = (
    <TextInput
      value={p.value === null || p.value === undefined ? '' : String(p.value)}
      disabled={disabled}
      aria-label={p.label}
      maxLength={prop?.maxLength}
      inputMode={prop && /Int|Decimal|Double|Single|Byte/.test(prop.edmType) ? 'decimal' : undefined}
      rightSection={p.unit ? <span className="sk-field__unit">{p.unit}</span> : undefined}
      onChange={(e) => p.onChange?.(e.currentTarget.value)}
    />
  );
  return prop?.description ? <Tooltip label={prop.description}>{input}</Tooltip> : input;
}
