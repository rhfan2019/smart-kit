/**
 * sap.fe.macros.Field (docs/26b, ADR-033): displays, or edits, one property according to its type and annotations.
 * `contextPath` + `metaPath` locate the property (or a DataField / DataPoint) as in Fiori elements; the row is the
 * binding context the page provides (`row`, smart-kit has no UI5 model).
 */
import { Avatar, Progress, Rating } from '@mantine/core';
import { arrangeText, createMessage, formatNumber, resolvePath, type FieldModel, type MetaModel, type PropertyModel, type Row, type TextArrangement } from '@rhfan2019/smart-kit-core';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { useCallback, useImperativeHandle, useMemo, useRef, useState, type ReactNode, type Ref } from 'react';
import { MicroChartDrawing as MicroChart } from '../chart/MicroChart';
import { chartHidden, chartProps } from '../chart/fromModel';
import { useService, useSmartKit, useText } from '../context/SmartKitProvider';
import type { MessageType } from '../controls/types';
import { useMessages, type MessagesApi } from '../messages/MessageContext';
import type { FieldRenderer, FieldRenderProps } from './renderers';
import { fieldValue, getPath, resolveRef } from './values';
import { FieldEditor } from './FieldEditor';
import { fieldEditState } from '../edit/fieldControl';
import { QuickViewLink } from './QuickView';
import { ContactLink } from './ContactLink';
import { SemanticLink } from './SemanticLink';

/** sap.fe.macros.field.FieldFormatOptions: how the value is shown or edited (a data aggregation, ADR-032 rule 2). */
export interface FieldFormatOptions {
  /** Value and its Common.Text: 'Description', 'DescriptionValue', 'Value' or 'ValueDescription'; default from UI.TextArrangement. */
  displayMode?: 'Description' | 'DescriptionValue' | 'Value' | 'ValueDescription';
  /** 'Hidden' hides the unit or currency of an amount. */
  measureDisplayMode?: 'Hidden' | 'ReadOnly';
  /** Display mode: at most this many characters of a text are shown, the rest as "…". */
  textMaxCharactersDisplay?: number;
  /** Display mode: at most this many lines of a multi-line text are shown. */
  textMaxLines?: number;
  /** Edit mode: number of lines of a multi-line text editor. */
  textLinesEdit?: number;
  /** Edit mode: maximum number of characters (default: the property's MaxLength). */
  textMaxLength?: number;
  /** Not yet used by smart-kit (stage 3/4): dateTimePattern, dateTimeStyle, showDate, showTime, showTimezone, … */
  dateTimePattern?: string;
  dateTimeStyle?: 'short' | 'medium' | 'long' | 'full';
  disableIntegerGrouping?: boolean;
  enableEnlargeImage?: boolean;
  fieldEditStyle?: 'RadioButtons' | '';
  hasSituationsIndicator?: boolean;
  imageFitType?: 'Cover' | 'Contain';
  radioButtonsHorizontalLayout?: boolean;
  reactiveAreaMode?: 'Inline' | 'Overlay';
  showDate?: boolean;
  showTime?: boolean;
  showTimezone?: boolean;
  textExpandBehaviorDisplay?: 'InPlace' | 'Popover';
}

/** Event object of `onChange` (sap.fe.macros.Field#change). */
export interface Field$ChangeEvent {
  /** The new value. */
  value: boolean | number | string | undefined | null;
  /** False when the entered text is not a valid value of the property's type (e.g. not a number). */
  isValid: boolean;
}

/** Event object of `onLiveChange` (sap.fe.macros.Field#liveChange; UI5 documents no parameters). */
/** Event object of `onLiveChange` (sap.fe.macros.Field#liveChange has no parameters; `value`, the text typed so far, is a smart-kit extension). */
export interface Field$LiveChangeEvent {
  value: string;
}

/** Parameters of `addMessage` (sap.fe.macros.field.mixin.FieldMixin#addMessage). */
export interface Field$MessageParameters {
  message?: string;
  description?: string;
  persistent?: boolean;
  /** @defaultValue 'Error' */
  type?: MessageType;
}

/** Instance (ref) of a Field. */
export interface Field {
  /** The current value (edited, set with `setValue`, `value` or read from the row). */
  getValue(): unknown;
  /** Sets the value shown or edited; the parent is not notified (no two-way binding), `change` is not fired. */
  setValue(value: unknown): void;
  /** Whether the editor is enabled (edit mode). */
  getEnabled(): boolean;
  /** Enables or disables the editor (edit mode). */
  setEnabled(enabled: boolean): void;
  /** Adds a message for the field (shown at the editor and in the page messages); returns its id. */
  addMessage(parameters: Field$MessageParameters): string;
  /** Removes a message added with `addMessage`. */
  removeMessage(id: string): void;
  /** `contextPath` + "/" + the property path ("/Items/Price"), or the property path without `contextPath`. */
  getMainPropertyAbsolutePath(): string | undefined;
  /** The page messages (smart-kit's message manager, `kit/useMessages`); null outside a MessageProvider. */
  getMessageManager(): MessagesApi | null;
}

export interface $FieldSettings {
  /** Entity set path the property belongs to, e.g. "/Items" (navigation: "/Items/_Category"). */
  contextPath?: string;
  /**
   * Property path relative to `contextPath` ("GrossAmount", "_Owner/Name"), a data point ("@com.sap.vocabularies.UI.v1.DataPoint#Rating",
   * alias "@UI.DataPoint#Rating"), or the field model of a DataField as the model read it from the annotations (tables, forms).
   */
  metaPath?: string | FieldModel;
  /** Entity type full name; instead of `contextPath` for types without an entity set (quick views, pages that have the type). */
  typeName?: string;
  /** Name of the service in `SmartKitProvider` `services`; default: the provider's `defaultService`. */
  service?: string;
  /** The row (binding context) to show the value of; undefined while loading. Text, unit, criticality and links come from the annotations of the property. */
  row: Row | undefined;
  /** false: the editor for the Edm type (value help from `Common.ValueList`); true or not set: the formatted value (text arrangement, unit, criticality). */
  readOnly?: boolean;
  /** The value; default: read from `row` by the property path. */
  value?: unknown;
  /** The description (text) of the value; default: the property's Common.Text read from `row`. */
  description?: string;
  /** How the value is shown or edited (sap.fe.macros.field.FieldFormatOptions). */
  formatOptions?: FieldFormatOptions;
  /** Edit mode: fired with the new value when it is committed (text: on blur or Enter; selection, date, checkbox: at once), as sap.fe.macros.Field#change. */
  onChange?: (e: Field$ChangeEvent) => void;
  /** Edit mode: fired while text is typed. */
  onLiveChange?: (e: Field$LiveChangeEvent) => void;
  /** Label for accessibility when used without a visible label. */
  'aria-label'?: string;
  /** Edit mode: error text from the page (validation, server messages that target the property). */
  error?: string;
  /** Edit mode: element id of the input. */
  id?: string;
  /** Edit mode: show the label above the editor (dialogs). */
  showLabel?: boolean;
  /** Rendered in a table cell: a micro chart without data leaves the cell empty (docs/15 MC-06). */
  cell?: boolean;
  /**
   * Semantic objects of the field: one name or a stringified array ('["A","B"]'). They overwrite the
   * Common.SemanticObject of the property (FE Field: the value is a smart link to the targets of these semantic objects,
   * from NavigationAdapter.semanticTargets, D42).
   */
  semanticObject?: string;
  ref?: Ref<Field>;
}

const CRITICALITY_CLASS: Record<number, string> = { 0: 'neutral', 1: 'negative', 2: 'critical', 3: 'positive', 5: 'info' };

const DISPLAY_MODE: Record<NonNullable<FieldFormatOptions['displayMode']>, TextArrangement> = {
  Description: 'TextOnly', DescriptionValue: 'TextFirst', Value: 'TextSeparate', ValueDescription: 'TextLast',
};

const MESSAGE_TYPE: Record<MessageType, 'error' | 'warning' | 'info' | 'success'> = { Error: 'error', Warning: 'warning', Information: 'info', Success: 'success', None: 'info' };

const NUMERIC = /Int|Decimal|Double|Single|Byte/;

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
    field.url || p.property?.isEmailAddress || p.property?.isPhoneNumber ? 'link' : undefined,
    p.property?.isCurrency ? 'currency' : undefined,
    p.unit !== undefined ? 'unit' : undefined,
    p.criticality !== undefined ? 'criticality' : undefined,
    p.property?.edmType === 'Edm.Boolean' ? 'boolean' : undefined,
    p.property ? `type:${p.property.edmType}` : undefined,
  ];
  for (const k of keys) if (k && registry[k]) return registry[k];
  return undefined;
}

/** Entity type of a context path: "/Items" → its type, "/Items/_Category" → the navigation's target type. */
export function typeOfContextPath(model: MetaModel, contextPath: string | undefined): string | undefined {
  if (!contextPath) return undefined;
  const [set, ...navs] = contextPath.replace(/^\//, '').split('/');
  let tn: string | undefined = model.entitySets[set!]?.typeName;
  for (const n of navs) tn = tn ? model.entityTypes[tn]?.navigations[n]?.targetType : undefined;
  return tn;
}

const DATA_POINT = /^@(?:com\.sap\.vocabularies\.UI\.v1|UI)\.DataPoint(?:#(.*))?$/;

function setPath(row: Row | undefined, path: string, value: unknown): Row {
  const segs = path.split('/');
  const out: Row = { ...(row ?? {}) };
  let cur = out;
  for (const s of segs.slice(0, -1)) {
    const next = cur[s];
    cur[s] = next && typeof next === 'object' ? { ...(next as Row) } : {};
    cur = cur[s] as Row;
  }
  cur[segs[segs.length - 1]!] = value;
  return out;
}

/** The `semanticObject` setting: one name or a stringified array of names; undefined when not set. */
export function parseSemanticObjects(value: string | undefined): string[] | undefined {
  const v = value?.trim();
  if (!v) return undefined;
  if (v.startsWith('[')) {
    try {
      const list: unknown = JSON.parse(v);
      if (Array.isArray(list)) return list.filter((x): x is string => typeof x === 'string' && x !== '');
    } catch { /* not an array: a single name */ }
  }
  return [v];
}

/** Scripts never run from a cell link. */
const UNSAFE_URL = /^\s*(javascript|vbscript|data):/i;

/**
 * The link of a displayed value (FE DisplayStyle getLinkTemplate): a DataFieldWithUrl opens its Url in the window of
 * HTML5.LinkTarget, without it in the same window ("_top", D41), any scheme; Communication.IsEmailAddress is a `mailto:`,
 * Communication.IsPhoneNumber a `tel:` link.
 */
export function linkOf(field: FieldModel, v: { value: unknown; property?: PropertyModel }, row: Row | undefined): { href: string; target?: string; kind: 'url' | 'email' | 'phone' } | undefined {
  if (field.url) {
    const url = resolveRef(row, field.url);
    if (url === null || url === undefined || url === '' || UNSAFE_URL.test(String(url))) return undefined;
    return { href: String(url), target: field.linkTarget ?? '_top', kind: 'url' };
  }
  if (v.value === null || v.value === undefined || v.value === '') return undefined;
  if (v.property?.isEmailAddress) return { href: `mailto:${String(v.value)}`, kind: 'email' };
  if (v.property?.isPhoneNumber) return { href: `tel:${String(v.value)}`, kind: 'phone' };
  return undefined;
}

/**
 * Edm.Stream (FE DisplayStyle getFileTemplate): a download link named by Core.ContentDisposition/Filename (or "No file
 * name"); without content (`@odata.mediaContentType` null) nothing is shown.
 */
function StreamLink({ row, path, property }: { row: Row | undefined; path: string; property: PropertyModel }) {
  const t = useText();
  const base = row ? getPath(row, path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '') : undefined;
  const name = path.split('/').pop()!;
  const owner = (path.includes('/') ? base : row) as Row | undefined;
  const contentType = owner?.[`${name}@odata.mediaContentType`];
  if (!owner || contentType === null || contentType === undefined) return null;
  const href = owner[`${name}@odata.mediaReadLink`];
  const filename = property.filename ? resolveRef(owner, property.filename) : undefined;
  return (
    <a className="sk-link" href={typeof href === 'string' ? href : undefined} download data-sk-link="file">
      {filename ? String(filename) : t('field.noFilename')}
    </a>
  );
}

/** sap.fe.macros.Field */
export function Field(props: $FieldSettings) {
  const { renderers, intlLocale, timeZone } = useSmartKit();
  const t = useText();
  const service = useService(props.service);
  const messages = useMessages();
  const typeName = props.typeName ?? typeOfContextPath(service.model, props.contextPath) ?? '';
  const { metaPath } = props;
  const field: FieldModel = useMemo(() => {
    if (metaPath && typeof metaPath === 'object') return metaPath;
    const dp = metaPath ? DATA_POINT.exec(metaPath) : null;
    const dataPoint = dp ? service.model.ui[typeName]?.dataPoints[dp[1] ?? ''] : undefined;
    if (dataPoint) return { id: `DataPoint::${dp![1] ?? ''}`, kind: 'dataPoint', dataPoint, label: dataPoint.title, criticalityIcon: true, isSemanticKey: false };
    const path = metaPath ?? '';
    return { id: `DataField::${path}`, kind: 'field', path, label: resolvePath(service.model.entityTypes, typeName, path).property?.label ?? path, criticalityIcon: true, isSemanticKey: false };
  }, [metaPath, service.model, typeName]);
  const mainPath = field.kind === 'dataPoint' ? field.dataPoint?.value : field.path;

  // ref state: a value set with setValue (until `value` changes), enabled, messages added with addMessage
  const [own, setOwn] = useState<{ value: unknown; for: unknown } | undefined>(undefined);
  const setValueOverride = own && own.for === props.value ? own : undefined;
  const [enabled, setEnabled] = useState(true);
  const [fieldMessages, setFieldMessages] = useState<{ id: string; message: string; type: MessageType }[]>([]);
  const valueProp = setValueOverride ? setValueOverride.value : props.value;
  const row = useMemo(() => (valueProp !== undefined && mainPath ? setPath(props.row, mainPath, valueProp) : props.row), [valueProp, mainPath, props.row]);
  const current = useRef<unknown>(undefined);
  current.current = mainPath ? (valueProp !== undefined ? valueProp : resolveRef(props.row, { path: mainPath })) : undefined;
  const { contextPath, onChange } = props;
  const addMessage = useCallback((p: Field$MessageParameters) => {
    const type = p.type ?? 'Error';
    const m = createMessage(MESSAGE_TYPE[type], p.message ?? '', { target: mainPath, source: 'client' });
    setFieldMessages((l) => [...l, { id: m.id, message: m.message, type }]);
    messages?.add([m]);
    return m.id;
  }, [mainPath, messages]);
  const removeMessage = useCallback((id: string) => {
    setFieldMessages((l) => l.filter((m) => m.id !== id));
    messages?.remove(id);
  }, [messages]);
  useImperativeHandle(props.ref, () => ({
    getValue: () => current.current,
    setValue: (value: unknown) => setOwn({ value, for: props.value }),
    getEnabled: () => enabled,
    setEnabled: (e: boolean) => setEnabled(e),
    addMessage,
    removeMessage,
    getMainPropertyAbsolutePath: () => (mainPath ? (contextPath ? `${contextPath.replace(/\/$/, '')}/${mainPath}` : mainPath) : undefined),
    getMessageManager: () => messages,
  }), [props.value, enabled, addMessage, removeMessage, mainPath, contextPath, messages]);

  if (field.kind === 'contact') return <span className="sk-field sk-field--contact"><ContactLink typeName={typeName} field={field} row={row} service={props.service} /></span>;
  if (field.kind === 'chart' && field.chart) {
    // Micro chart in a table or form cell (docs/15 MC-10): of the row, of a single-valued navigation or over a collection (ADR-025).
    const chart = field.chart;
    const cp = chartHidden(service.model, chart) ? undefined : chartProps({ model: service.model, locale: intlLocale, timeZone }, typeName, chart, row);
    if (!cp) return null;
    const measureProp = resolvePath(service.model.entityTypes, chart.typeName, chart.measures[0]!).property;
    const digits = chart.dataPoints[chart.measures[0]!]?.fractionDigits ?? (typeof measureProp?.scale === 'number' ? measureProp.scale : undefined);
    const fmt = (n: number) => formatNumber(String(n), intlLocale, digits !== undefined ? { min: digits, max: digits } : { max: 2 });
    return (
      <span className="sk-field sk-field--chart">
        <MicroChart {...cp} label={props['aria-label'] ?? field.label} format={fmt} hideOnNoData={props.cell} size={props.cell ? 'XS' : undefined} />
      </span>
    );
  }
  const fo = props.formatOptions ?? {};
  const v = fieldValue({ model: service.model, typeName, locale: intlLocale, timeZone }, field, row);
  const arrangement = fo.displayMode ? DISPLAY_MODE[fo.displayMode] : v.property?.textArrangement;
  if (props.description !== undefined) v.display = arrangeText(v.formatted, props.description, arrangement);
  else if (fo.displayMode && v.property?.text && mainPath) {
    const textPath = mainPath.includes('/') ? `${mainPath.slice(0, mainPath.lastIndexOf('/') + 1)}${v.property.text}` : v.property.text;
    const text = resolveRef(row, { path: textPath });
    v.display = arrangeText(v.formatted, text === undefined || text === null ? undefined : String(text), arrangement);
  }
  if (fo.measureDisplayMode === 'Hidden') v.unit = undefined;
  if (fo.textMaxCharactersDisplay !== undefined && v.display.length > fo.textMaxCharactersDisplay) v.display = `${v.display.slice(0, fo.textMaxCharactersDisplay)}…`;
  const mode = props.readOnly === false ? 'edit' : 'display';
  const change = (value: unknown) => {
    const isValid = !(v.property && NUMERIC.test(v.property.edmType) && value !== null && value !== undefined && String(value).trim() !== '' && !/^[-+]?(\d+(\.\d*)?|\.\d+)$/.test(String(value).trim()));
    onChange?.({ value: value as Field$ChangeEvent['value'], isValid });
  };
  const renderProps: FieldRenderProps = { ...v, row: row ?? {}, field, mode, onChange: change };
  const custom = rendererFor(renderers, typeName, field, renderProps);
  if (custom) return <>{custom(renderProps)}</>;
  if (mode === 'edit' && field.kind === 'field') {
    // Common.FieldControl, also as a path (FE FieldControlHelper): Mandatory (7) is required, Inapplicable (0) disabled
    const prefix = mainPath?.includes('/') ? mainPath.slice(0, mainPath.lastIndexOf('/')) : '';
    const edit = fieldEditState(v.property, props.row, true, prefix);
    // a changed value shows without the (old) text of the row until the row is read again
    const edited = mainPath !== undefined && valueProp !== undefined && valueProp !== resolveRef(props.row, { path: mainPath });
    const message = fieldMessages.find((m) => m.type === 'Error' || m.type === 'Warning')?.message;
    return (
      <FieldEditor
        property={v.property} value={v.value} onChange={change} onLiveChange={props.onLiveChange ? (text) => props.onLiveChange?.({ value: text }) : undefined}
        label={props['aria-label'] ?? field.label} unit={v.unit} error={props.error ?? message} required={edit.required} disabled={!enabled || edit.disabled}
        id={props.id} service={props.service} showLabel={props.showLabel} minRows={fo.textLinesEdit} maxLength={fo.textMaxLength}
        typeName={typeName} path={mainPath} displayValue={edited ? v.formatted : v.display}
      />
    );
  }

  const dp = field.dataPoint;
  if (dp?.visualization === 'Rating') {
    const max = Number(resolveRef(row, dp.targetValue) ?? 5) || 5;
    const value = Number(v.value ?? 0);
    const label = t('field.rating', { value: v.formatted || '0', max });
    return (
      <span className="sk-field sk-field--rating" title={label} role="img" aria-label={label}>
        <Rating value={value} count={max} fractions={2} readOnly size="sm" aria-hidden />
      </span>
    );
  }
  if (dp?.visualization === 'Progress') {
    // sap.fe.macros.internal.DataPoint createProgressIndicator; texts and percentage as DataPointTemplating
    // buildExpressionForProgressIndicatorDisplayValue / ValueFormatter computePercentage; state from the data point's Criticality.
    const targetRaw = resolveRef(row, dp.targetValue);
    const target = Number(targetRaw ?? 100) || 100;
    const value = Number(v.value ?? 0);
    const staticPercent = v.property?.unit && 'value' in v.property.unit && v.property.unit.value === '%';
    const percent = staticPercent ? value : (value / target) * 100;
    const targetText = v.property ? formatNumber(targetRaw ?? target, intlLocale) : String(target);
    const label = staticPercent ? `${v.formatted || '0'} %`
      : v.unit ? t('field.progressUnit', { value: v.formatted || '0', target: targetText, unit: v.unit })
        : t('field.progress', { value: v.formatted || '0', target: targetText });
    const state = v.criticality !== undefined ? CRITICALITY_CLASS[v.criticality] : undefined;
    return (
      <span className="sk-field sk-field--progress" data-sk-state={state}>
        <Progress value={Math.max(0, Math.min(100, Number.isFinite(percent) ? percent : 0))} aria-label={label} className={`sk-progress${state ? ` sk-progress--${state}` : ''}`} />
        <span className="sk-field__progress-text">{label}</span>
      </span>
    );
  }
  if (v.property?.isImageUrl) {
    return v.value ? <Avatar src={String(v.value)} alt={props['aria-label'] ?? field.label} size="sm" radius="sm" /> : null;
  }
  let content: ReactNode = v.display;
  if (v.property?.edmType === 'Edm.Boolean' && v.value !== null && v.value !== undefined) content = v.value === true || v.value === 'true' ? t('common.yes') : t('common.no');
  // Common.Masked (FE DisplayStyle "Masked", ValueFormatter formatPasswordText): one "*" per character.
  if (v.property?.masked && v.display) content = '*'.repeat(v.display.length);
  const link = linkOf(field, v, row);
  if (link && v.display) {
    const icon = field.iconUrl ? resolveRef(row, field.iconUrl) : undefined;
    content = (
      <a href={link.href} className="sk-link" target={link.target} rel={link.target === '_blank' ? 'noreferrer' : undefined} data-sk-link={link.kind}>
        {typeof icon === 'string' && icon ? <img src={icon} alt="" className="sk-link__icon" /> : null}
        {content}
      </a>
    );
  }
  // Smart links (D42): DataFieldWithIntentBasedNavigation, Common.SemanticObject; targets from the host's NavigationAdapter.
  // The `semanticObject` setting overwrites the property's semantic objects (FE Field semanticObject).
  const semanticObjects = field.intent ? [field.intent.semanticObject] : parseSemanticObjects(props.semanticObject) ?? (v.property?.semanticObject ? [v.property.semanticObject] : []);
  if (semanticObjects.length && !link && !field.quickView && v.display) {
    content = <SemanticLink semanticObject={semanticObjects} action={field.intent?.action} intent={Boolean(field.intent)} row={row} path={mainPath} service={props.service}>{content}</SemanticLink>;
  }
  if (v.property?.edmType === 'Edm.Stream') content = <StreamLink row={row} path={mainPath ?? ''} property={v.property} />;
  if (field.quickView && v.value !== null && v.value !== undefined && v.value !== '') content = <QuickViewLink typeName={typeName} field={field} row={row} service={props.service}>{content}</QuickViewLink>;
  const crit = v.criticality;
  const className = [
    'sk-field',
    crit !== undefined ? `sk-status sk-status--${CRITICALITY_CLASS[crit] ?? 'neutral'}` : '',
    field.isSemanticKey ? 'sk-field--key' : '',
    v.property?.multiLine ? 'sk-field--multiline' : '',
    v.property && NUMERIC.test(v.property.edmType) ? 'sk-field--number' : '',
  ].filter(Boolean).join(' ');
  const clamp = fo.textMaxLines ? { display: '-webkit-box', WebkitLineClamp: fo.textMaxLines, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' } : undefined;
  return (
    <span className={className}>
      {crit !== undefined && field.criticalityIcon ? <CriticalityIcon criticality={crit} /> : null}
      <span className="sk-field__value" style={clamp}>{content}</span>
      {v.unit && v.formatted ? <span className="sk-field__unit">{v.unit}</span> : null}
    </span>
  );
}
