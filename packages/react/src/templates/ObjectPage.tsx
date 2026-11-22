/**
 * Object page template = sap.fe.templates.ObjectPage (ADR-033, docs/30 §5.3): its props are the manifest settings of
 * the object page (docs/26c §3.1, §3.3, §4, §8; types in ./ObjectPageSettings). Built only from public building blocks
 * (AC-BOOT-01): header with facets, page or tab layout, forms and sub-tables from UI.Facets, breadcrumbs for sub-object
 * pages, state restoration; edit (direct save or draft, ADR-018), create mode, delete, header and footer actions
 * (ADR-024), messages (ADR-023), object marker, the editable "Header" section, paging buttons, side content.
 */
import { ActionIcon, Alert, Anchor, Avatar, Breadcrumbs, Button, Group, Image, Menu, Modal, Stack, Text, UnstyledButton } from '@mantine/core';
import { ChevronDown } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  capabilitiesFor, resolvePath, childPathOf, ConcurrencyError, DERIVED_GENERAL_SECTION, entityPathOf, isDraftRow, messagesFromError, resolveEntityPath,
  siblingPath, targetEntitySet, type ActionModel, type EditSession, type FieldModel, type FormGroupModel, type HeaderFacetModel, type Message, type Row,
  type SectionModel, type SubSectionModel,
} from '@rhfan2019/smart-kit-core';
import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode, type Ref } from 'react';
import {
  actionPaths, fieldErrors, getPath, isActionAvailable,
  typedText, usePageState, useService, useSmartKit, useText,
  validate,
} from '../index';
import ObjectPageLayout, { type SectionItem, type SubSectionItem } from '../uxap/ObjectPageLayout';
import ObjectPageDynamicHeaderTitle from '../uxap/ObjectPageDynamicHeaderTitle';
import OverflowToolbar, { type OverflowToolbarLayoutData } from '../m/OverflowToolbar';
import ToolbarSpacer from '../m/ToolbarSpacer';
import Share from '../v4/fe/macros/Share';
import Paginator from '../v4/fe/macros/Paginator';
import FlexibleColumnLayoutActions from '../v4/fe/macros/fcl/FlexibleColumnLayoutActions.block';
import HeaderFacet from '../kit/HeaderFacet';
import useColumn from '../kit/useColumn';
import useObject from '../kit/useObject';
import useObjectTitle from '../kit/useObjectTitle';
import DraftIndicator from '../kit/DraftIndicator';
import Table, { type $ActionSettings, type $ColumnSettings, type $OverflowGroupSettings, type $TableSettings, type ActionGroup, type TableExtendEntry } from '../v4/fe/macros/Table';
import TreeTable from '../v4/fe/macros/TreeTable';
import { overflowGroupsOf, RenderContent, tableActionsOf, tableColumnsOf, tableSettingsOf } from './tableManifest';
import MessageButton from '../v4/fe/macros/MessageButton';
import Field from '../v4/fe/macros/Field';
import Form from '../v4/fe/macros/Form';
import useActionRunner, { type ActionResult } from '../kit/useActionRunner';
import useEditStrategy from '../kit/useEditStrategy';
import MessageProvider from '../kit/MessageProvider';
import useMessages from '../kit/useMessages';
import type {
  Context, HeaderFooterManifestAction, ManifestAction, ManifestHeaderFacet, ManifestSection, ManifestSubSection, ObjectPageManifestSettings,
  OverflowToolbarPriority, Position, TableManifestConfiguration, TableManifestSettingsConfiguration,
} from './ObjectPageSettings';

export type {
  ActionAfterExecutionConfiguration, Context, HeaderFooterManifestAction, ManifestAction, ManifestHeaderFacet, OverflowGroupConfiguration, OverflowToolbarPriority, ManifestSection, ManifestSideContent, ManifestSubSection, NavigationSettingsConfiguration,
  NavigationTargetConfiguration, ObjectPage$ActionPressEvent, ObjectPage$TableActionPressEvent, ObjectPageContent, ObjectPageHeaderContent,
  ObjectPageManifestSettings, Position, TableCreationModeConfiguration, TableManifestAction, TableManifestColumn, TableManifestConfiguration,
  TableManifestSettingsConfiguration,
} from './ObjectPageSettings';

/**
 * Props of the object page: the manifest settings (ObjectPageManifestSettings) plus what smart-kit needs without the
 * FE runtime (registered as kit-extension in tools/ui5-alignment/deviations.op5.json).
 */
export interface $ObjectPageSettings extends ObjectPageManifestSettings {
  /** Entity path, e.g. "Orders('1')" (FE: the route's binding context). Ignored in create mode. */
  path: string;
  /** Name of the service in `SmartKitProvider` `services`; default: the provider's `defaultService`. */
  service?: string;
  /** Create mode: a new object of `entitySet` (default the `entitySet` / `contextPath` setting). */
  create?: { entitySet?: string; initial?: Row };
  /** After a new object was saved; default NavigationAdapter.toObject. */
  onCreated?(path: string): void;
  /** After the object was deleted; default NavigationAdapter.toList. */
  onDeleted?(): void;
  /**
   * After an annotation action of the header or the footer (UI.Identification DataFieldForAction) has run, with its
   * result (`processed`, `failed`, `messages`); the page has already refreshed its own data. FE has no such hook (its
   * EditFlow offers only `onBeforeExecuteAction`); use it to refresh what the host shows next to the page.
   */
  onActionDone?(result: ActionResult): void;
  /** Offer "Edit" (default: when the entity set is updatable and the data provider can write). */
  editable?: boolean;
  /** Message strip under the title (OP-17). */
  headerMessage?: ReactNode | ((row: Row | undefined) => ReactNode);
  /** Key information in the title bar (DP Header Title (4)), e.g. a GenericTag. */
  keyInfo?: ReactNode | ((row: Row | undefined) => ReactNode);
  /** Row press of a sub-object table instead of NavigationAdapter.toObject (hosts without a NavigationAdapter, e.g. a flexible column layout). */
  onRowNavigate?(row: Row, path: string): void;
  /** Paging buttons for sub-object pages (OP Representation of Child Pages). @defaultValue true */
  paging?: boolean;
  /** Limit for sub-table previews with "Show All (x)". @defaultValue 200 */
  showAllThreshold?: number;
  /** Letterboxing of the page (DP Responsiveness). @defaultValue false */
  letterboxing?: boolean;
  /** Extra CSS class on the root element. */
  className?: string;
  /** Instance methods (sap.fe.templates.ObjectPage.ExtensionAPI). */
  ref?: Ref<ObjectPage>;
}

/** Instance methods of the object page (sap.fe.templates.ObjectPage.ExtensionAPI). */
export interface ObjectPage {
  /** Shows or hides the side content of the sub-section `subSectionKey` (`… › subSections › <key> › sideContent`); without `show` it toggles. */
  showSideContent(subSectionKey: string, show?: boolean): void;
}

/** Key of the editable header section (FE `EditableHeaderContent`). */
export const EDITABLE_HEADER_SECTION = '$Header';

/** Initials from a title: the first letters of up to two words (Latin), else the first character. */
function initialsOf(title: string): string {
  const words = title.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '';
  if (/^[A-Za-z]/.test(words[0]!)) return words.slice(0, 2).map((w) => w[0]!.toUpperCase()).join('');
  return [...words[0]!][0] ?? '';
}

function Crumb({ path, service, onClick }: { path: string; service?: string; onClick(): void }) {
  const { title, typeName } = useObjectTitle(path, service);
  const { navigation } = useSmartKit();
  const svc = useService(service);
  const href = navigation?.href?.({ kind: 'object', path, service: svc.name });
  return (
    <Anchor component={href ? 'a' : 'button'} href={href} size="sm" onClick={(e: React.MouseEvent) => { e.preventDefault(); onClick(); }} data-sk-breadcrumb>
      {title ?? typeName}
    </Anchor>
  );
}

/**
 * Draft administrative paths of a draft-enabled type, as FE's object page selects them (DraftIsCreatedByMe, DraftUUID,
 * InProcessByUser); who changed the draft and when is read when the draft indicator's popover opens.
 */
function draftSelect(type: { properties: Record<string, unknown>; navigations: Record<string, unknown> }): string[] {
  const out = ['IsActiveEntity', 'HasDraftEntity', 'HasActiveEntity'].filter((p) => p in type.properties);
  if (type.navigations.DraftAdministrativeData) out.push('DraftAdministrativeData/DraftIsCreatedByMe', 'DraftAdministrativeData/DraftUUID', 'DraftAdministrativeData/InProcessByUser');
  return out;
}

/** FE HeaderAndFooterAction IMPORTANT_CRITICALITIES: VeryPositive, Positive, Negative, VeryNegative (constants) come first. */
export function isCriticalAction(a: ActionModel): boolean {
  const c = a.criticality;
  return Boolean(c && 'value' in c && [4, 3, 1, -1].includes(Number(c.value)));
}

/** The path is true in the row (UI.Hidden, UI.UpdateHidden, UI.DeleteHidden given as a path). */
const isTrue = (row: Row | undefined, path: string | undefined) => {
  if (!path) return false;
  const v = getPath(row, path);
  return v === true || v === 'true';
};

/** The groups of a form shown first, and those behind "Show More" (UI.PartOfPreview false, FE moreBlocks). */
export function splitPreview(groups: FormGroupModel[]): { preview: FormGroupModel[]; more: FormGroupModel[] } {
  return { preview: groups.filter((g) => g.partOfPreview !== false), more: groups.filter((g) => g.partOfPreview === false) };
}

/**
 * The form of the editable header section (FE createEditableHeaderSection): the title and the description
 * (HeaderInfo) and the fields of the header facets that are forms, data points or contacts, editable or not;
 * micro chart facets are not part of it.
 */
export function editableHeaderGroups(ui: { headerInfo: { title?: string; description?: string }; headerFacets: HeaderFacetModel[] }, label: (path: string) => string): FormGroupModel[] {
  const field = (path: string): FieldModel => ({ id: `Header::${path}`, kind: 'field', path, label: label(path), criticalityIcon: true, isSemanticKey: false });
  const info = [ui.headerInfo.title, ui.headerInfo.description].filter((x): x is string => Boolean(x)).map(field);
  const out: FormGroupModel[] = info.length ? [{ id: 'HeaderInfo', fields: info }] : [];
  const add = (f: HeaderFacetModel): void => {
    if (f.kind === 'collection') { f.facets.forEach(add); return; }
    const fields: FieldModel[] = f.kind === 'form' ? f.fields : f.kind === 'text' || f.kind === 'contact' ? [f.field]
      : f.kind === 'dataPoint' ? [{ id: f.id, kind: 'dataPoint', dataPoint: f.dataPoint, label: f.label ?? f.dataPoint.title, criticalityIcon: true, isSemanticKey: false }] : [];
    if (fields.length) out.push({ id: f.id, label: f.label, fields, ...(f.hidden ? { hidden: f.hidden } : {}) });
  };
  ui.headerFacets.forEach(add);
  return out;
}

// ---------------------------------------------------------------------------------------------- settings helpers

/** Evaluates `visible` / `enabled` (a function stands for a binding expression). */
export function evaluate(v: boolean | ((row: Row | undefined) => boolean) | undefined, row: Row | undefined, dflt = true): boolean {
  if (v === undefined) return dflt;
  return typeof v === 'function' ? v(row) : v;
}

/**
 * Places custom elements among keyed elements as FE's insertCustomElements: an existing key is overridden (`merge`),
 * a new one is inserted at its `position` (no anchor: "Before" = first, otherwise after the last element).
 */
export function insertByPosition<T extends { key: string }, C>(
  items: T[],
  custom: Record<string, C & { position?: Position }> | undefined,
  make: (key: string, c: C) => T | undefined,
  merge?: (item: T, c: C) => T | undefined,
): T[] {
  if (!custom) return items;
  let out = [...items];
  const pending: [string, C & { position?: Position }][] = [];
  for (const [key, c] of Object.entries(custom)) {
    const i = out.findIndex((x) => x.key === key);
    if (i >= 0) {
      const m = merge ? merge(out[i]!, c) : out[i];
      if (m) out[i] = m;
      else out = out.filter((_, j) => j !== i);
    } else pending.push([key, c]);
  }
  // Elements anchored to other custom elements wait until their anchor is placed (FE: delayed positioning).
  for (let round = 0; pending.length && round <= pending.length; round++) {
    for (let k = 0; k < pending.length; k++) {
      const [key, c] = pending[k]!;
      const pos = c.position;
      const anchor = pos?.anchor;
      if (anchor && !out.some((x) => x.key === anchor) && pending.some(([pk]) => pk === anchor)) continue;
      pending.splice(k--, 1);
      const item = make(key, c);
      if (!item) continue;
      const at = anchor ? out.findIndex((x) => x.key === anchor) : -1;
      if (pos?.placement === 'End' || (at < 0 && pos?.placement !== 'Before')) out.push(item);
      else if (at < 0) out.unshift(item);
      else out.splice(pos?.placement === 'Before' ? at : at + 1, 0, item);
    }
  }
  return out;
}

/** The `controlConfiguration` entry of the sub-table of `navigation` ("_Item/@com.sap.vocabularies.UI.v1.LineItem", alias "@UI."). */
export function tableConfigurationOf(settings: ObjectPageManifestSettings, navigation: string): TableManifestConfiguration | undefined {
  const cc = settings.controlConfiguration;
  if (!cc) return undefined;
  const full = `${navigation}/@com.sap.vocabularies.UI.v1.LineItem`;
  if (cc[full]) return cc[full];
  const key = Object.keys(cc).find((k) => k.replace('@UI.', '@com.sap.vocabularies.UI.v1.').split('#')[0] === full);
  return key ? cc[key] : undefined;
}

/**
 * Effective creation mode of a sub-object table (FE `_getCreationBehaviour`): the configured one, default NewPage;
 * NewPage without a route to the sub-object page falls back to Inline.
 */
export function creationModeOf(ts: TableManifestSettingsConfiguration | undefined, hasRoute: boolean): NonNullable<NonNullable<TableManifestSettingsConfiguration['creationMode']>['name']> {
  const name = ts?.creationMode?.name ?? 'NewPage';
  return name === 'NewPage' && !hasRoute ? 'Inline' : name;
}

export { personalizationOf } from './tableManifest';

/**
 * `columns`, `actions` and `overflowGroups` of a sub-table configuration as the building block's aggregations (the
 * list report's mapping, ./tableManifest).
 */
export function tableAggregationsOf(cfg: TableManifestConfiguration | undefined): {
  columns?: $ColumnSettings[]; actions?: $ActionSettings[]; actionGroups?: ActionGroup[]; extend?: TableExtendEntry[]; actionOverflowGroups?: $OverflowGroupSettings[];
} {
  if (!cfg) return {};
  const a = tableActionsOf(cfg.actions);
  return { columns: tableColumnsOf(cfg.columns), actions: a.actions, actionGroups: a.groups, extend: a.extend, actionOverflowGroups: overflowGroupsOf(cfg.overflowGroups) };
}

// ---------------------------------------------------------------------------------------------- component

/** sap.fe.templates.ObjectPage. */
export function ObjectPage(p: $ObjectPageSettings) {
  const [navigate, setNavigate] = useState<((m: Message) => void) | undefined>(undefined);
  const register = useCallback((fn: (m: Message) => void) => setNavigate(() => fn), []);
  return (
    <MessageProvider onNavigate={navigate}>
      <ObjectPageInner {...p} registerNavigate={register} />
    </MessageProvider>
  );
}

type Mode = 'display' | 'edit' | 'create';

type Variant = 'filled' | 'subtle' | 'default';

/**
 * A toolbar action of the header, the footer or a section (FE BaseAction after getActionsFromManifest and
 * insertCustomElements): its press, its overflow layout and what the emphasis rules need.
 */
export interface ToolbarAction {
  key: string;
  text?: string;
  press?(): void;
  disabled?: boolean;
  /** sap.m.OverflowToolbarLayoutData priority. */
  priority?: OverflowToolbarPriority;
  /** sap.m.OverflowToolbarLayoutData group (FE `overflowGroup ?? group`; manifest actions 0 without one). */
  group?: number;
  /** A manifest action (FE ActionUtilities isManifestAction). */
  manifest?: boolean;
  /** FE buttonType Emphasized: UI.Emphasized without a Criticality, or `isPrimaryAction` of the manifest. */
  emphasized?: boolean;
  /** The annotation action has a Criticality (FE hasCriticality). */
  critical?: boolean;
  /** Keys of the actions of a menu button. */
  menu?: string[];
  /** With `menu`: the key of the menu action the button runs itself (a split button). */
  defaultAction?: string;
  /** Header: custom content instead of a button. */
  template?(): ReactNode;
  /** The button of a standard or annotation action (its data attributes); custom actions are rendered by the toolbar. */
  render?(variant: Variant): ReactNode;
}

/** The visible actions the emphasis rules look at. */
export interface EmphasisAction { key: string; emphasized?: boolean; critical?: boolean; manifest?: boolean }

/**
 * The object page's emphasis rules (FE ActionUtilities applyObjectPageEmphasisRules with the templates' expressions)
 * for the visible header and footer actions: while an action with a criticality is visible nothing but criticality is
 * emphasized; else the first emphasized footer action (manifest primary actions before UI.Emphasized ones) is shown
 * first, emphasized and never in the overflow, and Save loses its emphasis; the first emphasized header action is so
 * shown in the header only while no footer is shown. Edit is emphasized while no action with a criticality is visible
 * (ObjectPageTemplating buildEmphasizedButtonExpression); all other emphasized actions are shown as Ghost.
 */
export function objectPageEmphasis(header: EmphasisAction[], footer: EmphasisAction[], o: { footerShown: boolean }): { header?: string; footer?: string; edit: boolean; save: boolean } {
  const criticality = [...header, ...footer].some((a) => a.critical);
  const first = (list: EmphasisAction[]) => {
    const emphasized = list.filter((a) => a.emphasized && !a.critical);
    return (emphasized.find((a) => a.manifest) ?? emphasized[0])?.key;
  };
  const footerFirst = criticality ? undefined : first(footer);
  const headerFirst = criticality || o.footerShown ? undefined : first(header);
  return { header: headerFirst, footer: footerFirst, edit: !criticality, save: !criticality && !footerFirst };
}

/**
 * Toolbar separators (FE Action addSeparators): before the first action of each overflow group whose
 * `overflowGroups` entry has `showSeparator`, unless it would be the first item.
 */
export function withSeparators<T extends { key: string; group?: number }>(items: T[], groups: Record<string, { showSeparator?: boolean }> | undefined): (T | { key: string; group: number; separator: true })[] {
  if (!groups) return items;
  const seen = new Set<number>();
  const out: (T | { key: string; group: number; separator: true })[] = [];
  for (const item of items) {
    const g = item.group;
    if (g !== undefined && !seen.has(g)) {
      seen.add(g);
      if (groups[String(g)]?.showSeparator && out.length) out.push({ key: `Separator::${g}`, group: g, separator: true });
    }
    out.push(item);
  }
  return out;
}

/** A child of an OverflowToolbar with its layout data (the toolbar reads `layoutData` from its children). */
function ToolbarSlot({ children }: { children: ReactNode; layoutData?: OverflowToolbarLayoutData }) {
  return <>{children}</>;
}

function ObjectPageInner(p: $ObjectPageSettings & { registerNavigate(fn: (m: Message) => void): void }) {
  const t = useText();
  const service = useService(p.service);
  const model = service.model;
  const { navigation } = useSmartKit();
  const column = useColumn();
  const messages = useMessages()!;
  const queryClient = useQueryClient();
  const creating = Boolean(p.create);
  const createSet = p.create ? (p.create.entitySet ?? p.entitySet ?? p.contextPath?.replace(/^\//, '').split('/')[0]) : undefined;
  const activePath = useMemo(() => (creating ? '' : siblingPath(model, p.path, true)), [creating, model, p.path]);
  const resolved = useMemo(() => (creating ? undefined : resolveEntityPath(model, activePath)), [creating, model, activePath]);
  const entitySet = createSet ?? resolved!.entitySet;
  const typeName = model.entitySets[entitySet]!.typeName;
  const type = model.entityTypes[typeName]!;
  const setModel = model.entitySets[entitySet]!;
  const draftEnabled = Boolean(setModel.draft);
  const strategy = useEditStrategy(entitySet, p.service);

  // ------------------------------------------------------------------ settings (defaults of FE 1.154, docs/26c §3.3)
  const header = p.content?.header;
  const headerVisible = header?.visible ?? true;
  const anchorBarVisible = header?.anchorBarVisible ?? true;
  const useIconTabBar = anchorBarVisible && p.sectionLayout === 'Tabs';
  const headerEditable = headerVisible && (p.editableHeaderContent ?? true);

  // ------------------------------------------------------------------ edit session
  const [mode, setMode] = useState<Mode>(creating ? 'create' : 'display');
  const [session, setSession] = useState<EditSession | null>(null);
  const [values, setValues] = useState<Row>({});
  const [draftStatus, setDraftStatus] = useState<'saving' | 'saved' | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<'discard' | 'delete' | null>(null);
  const editing = mode !== 'display';
  // The draft switch (FE DraftToggle) shows the saved version of a draft: `shown` is then 'active'.
  const [shown, setShown] = useState<'active' | undefined>(undefined);
  // The draft instance is read while editing a draft (ADR-018).
  const readPath = session?.draft && session.path ? session.path : creating ? '' : shown === 'active' ? activePath : p.path;
  const caps0 = useMemo(() => capabilitiesFor(model, entitySet), [model, entitySet]);
  const extra = useMemo(() => {
    const actions = model.ui[typeName]!.objectActions;
    const refPath = (r: typeof caps0.deleteHidden) => (r && 'path' in r ? [r.path] : []);
    return [
      ...(p.additionalProperties ?? []), ...(draftEnabled ? draftSelect(type) : []), ...actionPaths(actions),
      // UI.Hidden of the actions, UI.UpdateHidden / UI.DeleteHidden and the Deletable path are bound to the buttons (FE)
      ...actions.flatMap((a) => (a.hidden ? [a.hidden] : [])), ...refPath(caps0.updateHidden), ...refPath(caps0.deleteHidden),
      ...(caps0.deletablePath ? [caps0.deletablePath] : []),
    ];
  }, [p.additionalProperties, draftEnabled, type, model, typeName, caps0]);
  const obj = useObject(readPath || `${entitySet}`, { service: p.service, extraSelect: extra, enabled: Boolean(readPath) });
  const ui = model.ui[typeName]!;
  const data = creating && !session?.draft ? values : obj.data;
  const pageKey = `object:${creating ? `new:${entitySet}` : resolved!.canonical}`;
  const [view, setView] = usePageState<{ headerExpanded?: boolean; pinned?: boolean; section?: string }>(pageKey, {});
  const [sideShown, setSideShown] = useState<Record<string, boolean>>({});
  const caps = caps0;
  const canWrite = Boolean(service.dataProvider.update && service.dataProvider.invoke);
  const editable = (p.editable ?? caps.updatable) && canWrite && !creating;
  const deletable = caps.deletable && Boolean(service.dataProvider.remove) && !creating;

  useImperativeHandle(p.ref, () => ({
    showSideContent: (key: string, show?: boolean) => setSideShown((s) => ({ ...s, [key]: show ?? !s[key] })),
  }), []);

  // Opening a draft directly (or returning to one) continues the edit session.
  const resumed = useRef(false);
  useEffect(() => {
    if (resumed.current || shown === 'active' || !obj.data || mode !== 'display' || !isDraftRow(obj.data)) return;
    resumed.current = true;
    void strategy.begin(p.path, obj.data).then((s) => { setSession(s); setValues({ ...s.values }); setMode('edit'); });
  }, [obj.data, mode, strategy, p.path, shown]);

  // Create mode with the draft strategy: the draft is created when the page opens.
  const started = useRef(false);
  useEffect(() => {
    if (!creating || started.current) return;
    started.current = true;
    void strategy.create({ entitySet }, p.create?.initial ?? {}).then((s) => { setSession(s); setValues({ ...s.values }); }).catch((e) => messages.add(messagesFromError(e)));
  }, [creating, strategy, entitySet, p.create, messages]);

  const editableFields = useMemo(() => {
    const out: FieldModel[] = [];
    const sub = (x: SubSectionModel): void => {
      if (x.content.kind === 'form') for (const g of x.content.groups) out.push(...g.fields);
      if (x.content.kind === 'mixed') x.content.parts.forEach(sub);
    };
    for (const s of ui.sections) s.subSections.forEach(sub);
    return out;
  }, [ui]);
  // The editable header section (FE createEditableHeaderSection, editableHeaderContent): title, description and the
  // fields of the header facets; without editableHeaderContent the header stays read-only while editing.
  const headerGroups = useMemo(
    () => (headerEditable ? editableHeaderGroups(ui, (path) => resolvePath(model.entityTypes, typeName, path).property?.label ?? path) : []),
    [ui, headerEditable, model, typeName],
  );
  const headerFields = useMemo(() => headerGroups.flatMap((g) => g.fields), [headerGroups]);

  const flushTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const change = useCallback((path: string, value: unknown) => {
    if (!session) {
      setValues((v) => ({ ...v, [path]: value }));
      return;
    }
    session.set(path, value);
    setValues({ ...session.values });
    if (session.draft) {
      // Background save of the draft (OP Unsaved Changes; docs/12 U-8).
      clearTimeout(flushTimer.current);
      flushTimer.current = setTimeout(() => {
        setDraftStatus('saving');
        session.flush().then((r) => { setDraftStatus('saved'); messages.add(r.messages); }).catch((e) => { setDraftStatus(null); messages.add(messagesFromError(e)); });
      }, 600);
    }
  }, [session, messages]);

  const errors = fieldErrors(messages.messages);
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['smart-kit'] });

  const startEdit = async () => {
    if (!obj.data) return;
    setBusy(true);
    try {
      const s = await strategy.begin(activePath, obj.data);
      setSession(s);
      setValues({ ...s.values });
      setShown(undefined);
      setMode('edit');
      messages.clear();
    } catch (e) {
      messages.add(messagesFromError(e));
    } finally {
      setBusy(false);
    }
  };

  // openInEditMode (FE ObjectPageController.isOpenInEditMode): the page starts editing once the object is read.
  const openedInEdit = useRef(false);
  useEffect(() => {
    if (!p.openInEditMode || openedInEdit.current || !obj.data || mode !== 'display' || !editable || isDraftRow(obj.data)) return;
    openedInEdit.current = true;
    void startEdit();
  }); // runs after every render: the guard above decides

  const save = async () => {
    const fields = [...editableFields, ...headerFields];
    const client = validate(model, typeName, fields, session?.values ?? values, t, creating);
    messages.setClient(client);
    if (client.length) return;
    setBusy(true);
    try {
      clearTimeout(flushTimer.current);
      let r: { path: string; messages: Message[] };
      if (session) r = await session.save();
      else {
        const s = await strategy.create({ entitySet }, values);
        r = await s.save();
      }
      messages.clear();
      messages.add([...r.messages, { id: `saved-${Date.now()}`, type: 'success', message: creating ? typedText(t, 'create.done', ui.headerInfo.typeName) : t('edit.saved'), source: 'server' }]);
      setSession(null);
      setDraftStatus(null);
      void invalidate();
      if (creating) {
        if (p.onCreated) p.onCreated(r.path);
        else navigation?.toObject(r.path, service.name);
        return;
      }
      setMode('display');
      if (p.path.includes('IsActiveEntity=false')) navigation?.toObject(activePath, service.name);
      obj.refresh();
    } catch (e) {
      messages.add(e instanceof ConcurrencyError ? [{ id: `conflict-${Date.now()}`, type: 'error', message: typedText(t, 'edit.conflict', ui.headerInfo.typeName), source: 'server' }] : messagesFromError(e));
    } finally {
      setBusy(false);
    }
  };

  const discard = async () => {
    setConfirm(null);
    clearTimeout(flushTimer.current);
    try {
      await session?.cancel();
    } catch (e) {
      messages.add(messagesFromError(e));
    }
    setSession(null);
    setDraftStatus(null);
    messages.clear();
    void invalidate();
    if (creating) {
      if (navigation) navigation.toList(entitySet, service.name);
      return;
    }
    setMode('display');
    if (p.path.includes('IsActiveEntity=false')) navigation?.toObject(activePath, service.name);
    obj.refresh();
  };

  // The draft switch (FE DraftToggle, editFlow toggleDraftActive): the saved version is shown in display mode; the
  // draft stays and is edited again with "Draft".
  const showSavedVersion = async () => {
    clearTimeout(flushTimer.current);
    try {
      await session?.flush();
    } catch (e) {
      messages.add(messagesFromError(e));
    }
    setSession(null);
    setDraftStatus(null);
    setMode('display');
    setShown('active');
    resumed.current = true;
    void invalidate();
  };

  const remove = async () => {
    setConfirm(null);
    try {
      // a sub-object is deleted in edit mode (FE getDeleteButtonVisibility), i.e. its draft instance
      await service.dataProvider.remove!(editing ? readPath : activePath, { etag: obj.data?.['@odata.etag'] as string | undefined });
      void invalidate();
      const parent = resolved && resolved.levels.length > 1 ? resolved.levels[resolved.levels.length - 2] : undefined;
      if (p.onDeleted) p.onDeleted();
      else if (parent) navigation?.toObject(editing ? siblingPath(model, parent.path, false) : parent.path, service.name);
      else navigation?.toList(entitySet, service.name);
    } catch (e) {
      messages.add(messagesFromError(e));
    }
  };

  // Initial focus in edit mode (OP Initial Focus): first empty mandatory field, else the first editable element.
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!editing) return;
    const h = requestAnimationFrame(() => requestAnimationFrame(() => {
      const root = rootRef.current;
      if (!root) return;
      const target = root.querySelector<HTMLElement>('[data-sk-mandatory-empty] input:not([type="hidden"]), [data-sk-mandatory-empty] textarea')
        ?? root.querySelector<HTMLElement>('[data-sk-editable] input:not([type="hidden"]), [data-sk-editable] textarea');
      target?.focus();
    }));
    return () => cancelAnimationFrame(h);
  }, [editing, Boolean(obj.data) || creating]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pressing a message focuses its field (OP In Edit Mode: message popover).
  const sectionOfField = (path: string) => {
    if (headerFields.some((f) => f.path === path) && editing) return EDITABLE_HEADER_SECTION;
    const has = (x: SubSectionModel): boolean => (x.content.kind === 'form' && x.content.groups.some((g) => g.fields.some((f) => f.path === path))) || (x.content.kind === 'mixed' && x.content.parts.some(has));
    for (const s of ui.sections) if (s.subSections.some(has)) return s.id;
    return undefined;
  };
  const focusField = (m: Message) => {
    const path = m.target?.split('/').pop();
    if (!path) return;
    const section = sectionOfField(path);
    if (useIconTabBar && section) setView((v) => ({ ...v, section }));
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const el = rootRef.current?.querySelector<HTMLElement>(`[data-sk-field-path="${CSS.escape(path)}"] input:not([type="hidden"]), [data-sk-field-path="${CSS.escape(path)}"] textarea`);
      el?.scrollIntoView({ block: 'center' });
      el?.focus();
    }));
  };
  const focusRef = useRef(focusField);
  focusRef.current = focusField;
  const register = p.registerNavigate;
  useEffect(() => { register((m) => focusRef.current(m)); }, [register]);

  // ------------------------------------------------------------------ actions (ADR-024)
  const onActionDone = useRef(p.onActionDone);
  onActionDone.current = p.onActionDone;
  const runner = useActionRunner({ service: p.service, onDone: (r) => { obj.refresh(); void invalidate(); onActionDone.current?.(r); } });
  const objectTarget = { row: data ?? {}, path: activePath, label: String(getPath(data, ui.headerInfo.title ?? type.keys[0]!) ?? '') };
  // Annotation actions (FE HeaderAndFooterAction): UI.Identification's DataFieldForAction; the button is shown unless
  // UI.Hidden is true and disabled while Core.OperationAvailable is false, in display and in edit mode. Determining
  // actions are in the footer, the others in the header; IsCopyAction is the header's "Copy" (only on the first level).
  const viewLevel = resolved?.levels.length ?? 1;
  // UI.Hidden given as a path hides the action for this object; only an explicit `visible` of the manifest entry of its
  // key overwrites that (FE getActionOverrideConfig `visible: overwrite`). The other keys of the entry (isPrimaryAction,
  // text …) never bring a hidden action back.
  const customFooter = p.content?.footer?.actions;
  const actionShown = (a: ActionModel, custom: Record<string, HeaderFooterManifestAction> | undefined) => custom?.[a.id]?.visible !== undefined || !isTrue(data, a.hidden);
  const headerModelActions = ui.objectActions.filter((a) => !a.determining && !a.copy && actionShown(a, header?.actions));
  const copyAction = viewLevel === 1 ? ui.objectActions.find((a) => !a.determining && a.copy && actionShown(a, header?.actions)) : undefined;
  const footerActions = ui.objectActions.filter((a) => a.determining && actionShown(a, customFooter));
  const hiddenActionKeys = new Set(ui.objectActions.filter((a) => isTrue(data, a.hidden)).map((a) => a.id));
  const pageContext: Context = { getPath: () => `/${activePath}`, getObject: () => data ?? {} };
  // FE EditFlow invokeAction isNavigable: a bound annotation action that returns another object of the page's entity set
  // navigates to it (not with afterExecution › navigateToInstance false or enableAutoScroll true)
  const navigateToResult = (r: ActionResult) => {
    const row = r.processed.length === 1 ? r.processed[0]!.row : undefined;
    const context = row?.['@odata.context'];
    if (!row || (typeof context === 'string' && !new RegExp(`#${entitySet}([(/]|$)`).test(context))) return;
    try {
      const target = entityPathOf(model, entitySet, row);
      if (resolveEntityPath(model, target).canonical !== resolveEntityPath(model, readPath || activePath).canonical) navigation?.toObject(target, service.name);
    } catch {
      // not an object of the page's entity set
    }
  };
  /**
   * An annotation action of the header or the footer, with the manifest entry of its key (FE getActionOverrideConfig:
   * text, visible, enabled, priority, group, isPrimaryAction, defaultValuesFunction, afterExecution).
   */
  const annotationAction = (a: ActionModel, o: { text?: string; override?: HeaderFooterManifestAction; priority?: OverflowToolbarPriority } = {}): ToolbarAction | undefined => {
    const m = o.override;
    if (m && !evaluate(m.visible, data)) return undefined;
    const text = m?.text ?? o.text ?? a.label;
    const navigable = a.bound && m?.afterExecution?.navigateToInstance !== false && m?.afterExecution?.enableAutoScroll !== true;
    const defaults = m?.defaultValuesFunction;
    const press = () => runner.run(a, [objectTarget], {
      defaultValues: defaults ? () => defaults({ contexts: [pageContext] }) : undefined,
      onDone: navigable ? navigateToResult : undefined,
    });
    const disabled = !isActionAvailable(a, data) || !data || (m?.enabled !== undefined && !evaluate(m.enabled, data));
    return {
      key: a.id, text, press, disabled, priority: m?.priority ?? o.priority, group: m?.overflowGroup ?? m?.group,
      emphasized: m?.isPrimaryAction ?? (a.emphasized && !a.criticality), critical: Boolean(a.criticality),
      render: (variant) => <Button key={a.id} variant={variant} disabled={disabled} onClick={press} data-sk-action={a.id}>{text}</Button>,
    };
  };
  /**
   * Custom actions (ManifestAction) placed among the keyed standard and annotation actions (FE insertCustomElements);
   * the entry of an annotation action's key overrides it (an entry for an annotation action that UI.Hidden hides is
   * left out: it is an override, not a custom action); the actions of a `menu` move into the menu button.
   */
  const placeActions = (items: (ToolbarAction & { annotation?: ActionModel; annotationText?: string })[], custom: Record<string, HeaderFooterManifestAction> | undefined, defaultPriority?: OverflowToolbarPriority): (ToolbarAction & { items?: ToolbarAction[] })[] => {
    // CancelAction has the position "End" in FE (HeaderAndFooterAction): custom actions go before it.
    const end = items.at(-1)?.key === 'CancelAction' ? items.at(-1) : undefined;
    const base = end ? items.slice(0, -1) : items;
    const entries = custom && Object.fromEntries(Object.entries(custom).filter(([key]) => !hiddenActionKeys.has(key) || base.some((x) => x.key === key)));
    const inserted = insertByPosition<ToolbarAction & { annotation?: ActionModel; annotationText?: string }, HeaderFooterManifestAction>(base, entries, (key, a) => {
      if (!evaluate(a.visible, data)) return undefined;
      const press = a.press ? () => a.press!({ bindingContext: pageContext }) : undefined;
      return {
        key, text: a.text, press, disabled: !evaluate(a.enabled, data), menu: a.menu, defaultAction: a.defaultAction, template: a.template,
        priority: a.priority ?? defaultPriority, group: a.overflowGroup ?? a.group ?? 0, manifest: true,
        // FE applyManifestPrimaryActionEmphasis: a menu only with a defaultAction
        emphasized: Boolean(a.isPrimaryAction && (!a.menu || a.defaultAction)),
      };
    }, (item, a) => (item.annotation ? annotationAction(item.annotation, { text: item.annotationText, override: a, priority: defaultPriority }) : item));
    const placed = end ? [...inserted, end] : inserted;
    const inMenus = new Set(placed.flatMap((a) => a.menu ?? []));
    return placed.filter((a) => !inMenus.has(a.key)).map((a) => (a.menu ? { ...a, items: a.menu.flatMap((k) => placed.filter((x) => x.key === k)) } : a));
  };
  /**
   * The items of an OverflowToolbar (FE OverflowToolbarLayoutData of each action, addSeparators): `first` is shown
   * first, emphasized and never in the overflow; `emphasize` decides the emphasis of the other buttons.
   */
  const toolbarItems = (actions: (ToolbarAction & { items?: ToolbarAction[] })[], o: { variant: Variant; overflowGroups?: Record<string, { showSeparator?: boolean }>; first?: string; firstAfter?: string; emphasize?(a: ToolbarAction): boolean; templates?: boolean }): ReactNode[] => {
    const firstItem = o.first ? actions.find((a) => a.key === o.first) : undefined;
    let ordered = firstItem ? actions.filter((a) => a !== firstItem) : actions;
    if (firstItem) {
      const at = o.firstAfter ? ordered.findIndex((a) => a.key === o.firstAfter) + 1 : 0;
      ordered = [...ordered.slice(0, at), firstItem, ...ordered.slice(at)];
    }
    return withSeparators(ordered, o.overflowGroups).map((a) => {
      if ('separator' in a) return <ToolbarSlot key={a.key} layoutData={{ group: a.group }}><span className="sk-toolbar__separator" role="separator" aria-orientation="vertical" data-sk-separator /></ToolbarSlot>;
      const isFirst = a === firstItem;
      const variant: Variant = isFirst || (o.emphasize?.(a) ?? false) ? 'filled' : o.variant;
      const layoutData: OverflowToolbarLayoutData = { priority: isFirst ? 'NeverOverflow' : a.priority, group: a.group || undefined };
      let node: ReactNode;
      if (a.template && o.templates) node = <span data-sk-toolbar-content={a.key}><RenderContent render={a.template} /></span>;
      else if (a.items) {
        const def = a.defaultAction ? a.items.find((x) => x.key === a.defaultAction) : undefined;
        const dropdown = (
          <Menu.Dropdown>
            {a.items.map((x) => <Menu.Item key={x.key} disabled={x.disabled} onClick={x.press} data-sk-action={x.key}>{x.text ?? x.key}</Menu.Item>)}
          </Menu.Dropdown>
        );
        // FE DefaultActionHandler / createMenuButton: with a defaultAction a split button (sap.m.MenuButton buttonMode "Split")
        node = def ? (
          <Group gap={0} wrap="nowrap" display="inline-flex" data-sk-action-group={a.key} data-sk-split>
            <Button variant={variant} disabled={a.disabled || def.disabled} onClick={def.press} data-sk-action-group-default={a.key}>{a.text ?? a.key}</Button>
            <Menu position="bottom-end">
              <Menu.Target><ActionIcon size="lg" variant={variant} disabled={a.disabled} aria-label={a.text ?? a.key} data-sk-action-group-arrow={a.key}><ChevronDown className="sk-icon" /></ActionIcon></Menu.Target>
              {dropdown}
            </Menu>
          </Group>
        ) : (
          <Menu position="bottom-end">
            <Menu.Target><Button variant={variant} disabled={a.disabled} rightSection={<ChevronDown className="sk-icon" />} data-sk-action-group={a.key}>{a.text ?? a.key}</Button></Menu.Target>
            {dropdown}
          </Menu>
        );
      } else node = a.render ? a.render(variant) : <Button variant={variant} disabled={a.disabled} onClick={a.press} data-sk-action={a.key}>{a.text ?? a.key}</Button>;
      return <ToolbarSlot key={a.key} layoutData={layoutData}>{node}</ToolbarSlot>;
    });
  };
  /** A section or sub-section toolbar (FE FormActions / FormActionButtons: Transparent buttons, no emphasis, no templates). */
  const sectionToolbar = (actions: Record<string, ManifestAction> | undefined, overflowGroups: Record<string, { showSeparator?: boolean }> | undefined): ReactNode => {
    const items = actions ? placeActions([], actions) : [];
    return items.length ? (
      <OverflowToolbar design="Transparent" style="Clear" className="sk-custom-subsection__actions" data-sk-subsection-actions>
        {toolbarItems(items, { variant: 'default', overflowGroups })}
      </OverflowToolbar>
    ) : null;
  };

  // ------------------------------------------------------------------ header
  const titleValue = ui.headerInfo.title ? getPath(data, ui.headerInfo.title) : undefined;
  const heading = creating && (titleValue === undefined || titleValue === null || titleValue === '')
    ? t('create.title', { type: ui.headerInfo.typeName })
    : titleValue === undefined || titleValue === null || titleValue === '' ? ui.headerInfo.typeName : String(titleValue);
  const subheading = ui.headerInfo.description && data ? (
    <Field typeName={typeName} service={p.service} metaPath={ui.headerInfo.description} row={data} />
  ) : undefined;
  const image = ui.headerInfo.imageUrl ? ('path' in ui.headerInfo.imageUrl ? getPath(data, ui.headerInfo.imageUrl.path) : ui.headerInfo.imageUrl.value) : undefined;
  // OP Image Facet: pressing the image enlarges it.
  const [enlarged, setEnlarged] = useState(false);
  // Without an image: initials from UI.HeaderInfo/Initials; for persons (Communication.Contact) else from the title.
  // Round for persons, a rounded square otherwise (Fiori avatar).
  const givenInitials = ui.headerInfo.initials ? ('path' in ui.headerInfo.initials ? getPath(data, ui.headerInfo.initials.path) : ui.headerInfo.initials.value) : undefined;
  const initials = image || creating || !data ? ''
    : givenInitials !== undefined && givenInitials !== null && givenInitials !== '' ? String(givenInitials).slice(0, 3)
      : ui.headerInfo.person && titleValue !== undefined && titleValue !== null && titleValue !== '' ? initialsOf(String(titleValue)) : '';
  const avatarRadius = ui.headerInfo.person ? 'xl' : 'md';
  const avatar = (size: 'sm' | 'lg') => (image ? (
    <UnstyledButton onClick={() => setEnlarged(true)} aria-label={t('object.enlargeImage', { name: heading })} className="sk-object-avatar__button" data-sk-avatar-enlarge={size}>
      <Avatar src={String(image)} alt={t('object.image', { name: heading })} size={size} radius={avatarRadius} className="sk-object-avatar" />
    </UnstyledButton>
  ) : initials ? (
    <Avatar size={size} radius={avatarRadius} className="sk-object-avatar sk-object-avatar--initials" aria-hidden data-sk-avatar-initials={initials}>{initials}</Avatar>
  ) : undefined);

  // Header facets: annotation facets and custom facets (`content › header › facets`) by position.
  const customHeaderFacets = header?.facets;
  const headerFacets = useMemo(() => insertByPosition<{ key: string; node: ReactNode; custom?: ManifestHeaderFacet }, ManifestHeaderFacet>(
    ui.headerFacets.map((f) => ({ key: f.id, node: <HeaderFacet key={f.id} facet={f} typeName={typeName} service={p.service} row={data} path={readPath || undefined} /> })),
    customHeaderFacets,
    (key, f) => (evaluate(f.visible, data) ? {
      key,
      custom: f,
      node: (
        <div key={key} className="sk-facet sk-facet--custom" data-sk-facet={key} data-sk-facet-kind="custom">
          {f.title ? <div className="sk-facet__title">{f.title}</div> : null}
          {f.subTitle ? <div className="sk-facet__subtitle">{f.subTitle}</div> : null}
          <div className="sk-facet__text">{f.template(data)}</div>
        </div>
      ),
    } : undefined),
  ), [ui.headerFacets, customHeaderFacets, typeName, p.service, data, readPath]);

  const formValues = editing ? values : undefined;
  const customSections = p.content?.body?.sections;
  const sections: SectionItem[] = useMemo(() => {
    const label = (s: { id: string; label: string }) => (s.label || (s.id === DERIVED_GENERAL_SECTION ? t('object.generalInformation') : s.id));
    const lazyAll = p.enableLazyLoading ?? false;
    type KSub = SubSectionItem & { key: string };
    type KSection = Omit<SectionItem, 'subSections'> & { key: string; subSections: KSub[] };
    // A custom sub-section: the template, its actions and its side content (`sideContent`, shown by showSideContent).
    const customSub = (key: string, s: ManifestSubSection, title: string | undefined, base?: KSub): KSub | undefined => {
      if (!evaluate(s.visible, data)) return undefined;
      const main = s.template ? s.template(data) : base?.content;
      const toolbar = sectionToolbar(s.actions, s.overflowGroups);
      const side = s.sideContent && sideShown[key] ? s.sideContent.template(data) : undefined;
      const content = (
        <div className={['sk-custom-subsection', side ? 'sk-custom-subsection--side' : '', s.sideContent?.equalSplit ? 'sk-custom-subsection--equal' : ''].filter(Boolean).join(' ')} data-sk-custom-subsection={key}>
          {toolbar}
          <div className="sk-custom-subsection__body">
            <div className="sk-custom-subsection__main">{main}</div>
            {side ? <aside className="sk-side-content" aria-label={title} data-sk-side-content={key}>{side}</aside> : null}
          </div>
        </div>
      );
      return {
        ...base,
        key,
        id: key,
        title: title ?? base?.title ?? '',
        content,
        blocks: s.blocks ?? base?.blocks,
        partOfPreview: s.isPartOfPreview ?? base?.partOfPreview,
        lazy: s.enableLazyLoading ?? base?.lazy ?? lazyAll,
        isTable: s.template ? false : base?.isTable,
      };
    };
    const form = (groups: FormGroupModel[]) => <Form typeName={typeName} service={p.service} row={data} metaPath={groups} readOnly={!editing} values={formValues} onChange={(e) => change(e.path, e.value)} errors={errors} creating={creating} />;
    const table = (sub: SubSectionModel, nav: string, level: number, last: boolean) => {
      const target = targetEntitySet(model, entitySet, nav);
      const cfg = tableConfigurationOf(p, nav);
      const ts = cfg?.tableSettings;
      const navEntry = p.navigation?.[nav];
      // "Routing" of smart-kit: a `navigation` entry, else the host's NavigationAdapter has an object page.
      const routed = navEntry ? Boolean(navEntry.detail) : Boolean(target && navigation?.hasObjectPage?.(target, service.name));
      const aggregations = tableAggregationsOf(cfg);
      const creation = creationModeOf(ts, routed) === 'CreationDialog' ? 'CreationDialog' : 'Inline';
      // quickVariantSelection (FE QuickFilter); hideTableTitle hides the title while there are quick filters
      const quick = ts?.quickVariantSelection;
      const settings: Omit<$TableSettings, 'type' | 'ref'> = {
        // the settings the list report maps the same way (FE getTableManifestConfiguration); mass edit saves in one change set
        ...tableSettingsOf(ts ?? {}, { massEditGrouping: 'ChangeSet' }),
        service: p.service,
        contextPath: `/${entitySet}/${nav}`,
        bindingContext: readPath,
        header: ts?.header ?? label(sub),
        headerVisible: ts?.headerVisible === false || (quick?.hideTableTitle && quick.paths.length > 0) ? false : undefined,
        headerLevel: `H${Math.min(6, level)}` as `H${3 | 4 | 5 | 6}`,
        pageKey: `${pageKey}:${sub.id}`,
        // FE: "Control" gives every sub-table its own variant management (findVariantManagement); "None" none
        variantManagement: p.variantManagement === 'Control' ? 'Control' : undefined,
        rowCountMode: ts?.rowCountMode,
        rowCount: ts?.rowCount,
        threshold: ts?.threshold,
        scrollThreshold: ts?.scrollThreshold,
        isSearchable: ts?.isSearchable ?? true,
        quickVariantSelection: quick ? { paths: quick.paths.map((x) => x.annotationPath), showCounts: quick.showCounts } : undefined,
        additionalProperties: ts?.additionalProperties,
        modeForNoDataMessage: p.useTextForNoDataMessages ? 'text' : 'illustratedMessage-ExtraSmall',
        columns: aggregations.columns,
        actions: aggregations.actions,
        actionGroups: aggregations.actionGroups,
        extend: aggregations.extend,
        actionOverflowGroups: aggregations.actionOverflowGroups,
        onRowPress: ts?.rowPress ?? (p.onRowNavigate ? (e) => p.onRowNavigate!(e.bindingContext.getObject(), e.bindingContext.getPath().slice(1)) : undefined),
        onSelectionChange: ts?.selectionChange,
        navigable: p.onRowNavigate || ts?.rowPress ? true : routed,
        readOnly: !editing || Boolean(ts?.readOnly),
        creationMode: { name: creation, creationFields: creation === 'CreationDialog' ? ts?.creationMode?.creationFields : undefined, createAtEnd: ts?.creationMode?.createAtEnd },
        growingScrollToLoad: useIconTabBar && last,
        showAllThreshold: p.showAllThreshold,
      };
      return ts?.type === 'TreeTable'
        ? <TreeTable key={sub.id} {...settings} disableLeafSelection={ts.disableLeafSelection} hierarchyQualifier={ts.hierarchyQualifier} />
        : <Table key={sub.id} {...settings} type={ts?.type} />;
    };
    /**
     * The content of an annotation sub-section (FE SectionContent): a form (its containers with UI.PartOfPreview false
     * behind "Show More", FE moreBlocks), a table, a data point or chart, or the parts of a mixed sub-section in order.
     */
    const contentOf = (sub: SubSectionModel, level: number, last: boolean, notes = false): Omit<KSub, 'key' | 'id' | 'title'> | undefined => {
      const c = sub.content;
      if (c.kind === 'form') {
        // useSingleTextAreaFieldAsNotes: the single multi-line text of a container is shown without its label
        const single = (g: FormGroupModel) => g.fields.length === 1 && g.fields[0]!.path && resolvePath(model.entityTypes, typeName, g.fields[0]!.path).property?.multiLine;
        const groups = notes ? c.groups.map((g) => (single(g) ? { ...g, fields: [{ ...g.fields[0]!, label: '' }] } : g)) : c.groups;
        const { preview, more } = splitPreview(groups);
        return {
          partOfPreview: sub.partOfPreview,
          content: preview.length ? form(preview) : undefined,
          blocks: more.length ? [{ id: `${sub.id}::More`, columns: 3, more: true, content: form(more) }] : undefined,
        };
      }
      if (c.kind === 'dataPoint') return { partOfPreview: sub.partOfPreview, content: <HeaderFacet typeName={typeName} service={p.service} row={data} facet={{ id: sub.id, kind: 'dataPoint', label: label(sub), dataPoint: c.dataPoint }} /> };
      if (c.kind === 'chart') return { partOfPreview: sub.partOfPreview, content: <HeaderFacet typeName={typeName} service={p.service} row={data} path={readPath} facet={{ id: sub.id, kind: 'chart', label: label(sub), chart: c.chart }} /> };
      if (c.kind === 'mixed') {
        const parts = c.parts.filter((x) => !isTrue(data, x.hidden)).map((x) => ({ part: x, c: contentOf(x, level + 1, false, notes) })).filter((x) => x.c);
        if (!parts.length) return undefined;
        return {
          partOfPreview: sub.partOfPreview,
          lazy: parts.some((x) => x.c!.isTable),
          content: (
            <div className="sk-mixed-subsection" data-sk-mixed-subsection={sub.id}>
              {parts.map((x) => <div key={x.part.id} className="sk-mixed-subsection__part" data-sk-subsection-part={x.part.id}>{x.c!.content}{x.c!.blocks?.map((b) => <div key={b.id}>{b.content}</div>)}</div>)}
            </div>
          ),
        };
      }
      if (creating && !session?.draft) return undefined;
      return { partOfPreview: sub.partOfPreview, isTable: true, lazy: true, content: table(sub, c.navigation, level, last) };
    };
    // UI.Hidden given as a path hides the section for this object. An entry of `content › body › sections` with its
    // key is an override: it changes only the keys it gives, so the section stays hidden unless the entry itself sets
    // `visible` (FE getSections `visible: overwrite`); it never becomes a custom section.
    const hiddenSections = new Set(ui.sections.filter((s) => isTrue(data, s.hidden) && customSections?.[s.id]?.visible === undefined).map((s) => s.id));
    const sectionEntries = customSections && Object.fromEntries(Object.entries(customSections).filter(([key]) => !hiddenSections.has(key)));
    const annotationSections: KSection[] = ui.sections.filter((s) => !hiddenSections.has(s.id)).map((s: SectionModel) => {
      const tableTitleLevel = s.subSections.length === 1 ? 3 : 4; // OP Title Styles
      const visible = s.subSections.filter((sub) => !isTrue(data, sub.hidden));
      return {
        key: s.id,
        id: s.id,
        title: label(s),
        subSections: visible.flatMap((sub, index): KSub[] => {
          const c = contentOf(sub, tableTitleLevel, index === visible.length - 1, Boolean(customSections?.[s.id]?.useSingleTextAreaFieldAsNotes));
          return c ? [{ key: sub.id, id: sub.id, title: label(sub), lazy: lazyAll, ...c }] : [];
        }),
      };
    });
    // Custom sections and overrides (`content › body › sections`, FE getSections: title, visible, sub-sections).
    let out = insertByPosition<KSection, ManifestSection>(
      annotationSections,
      sectionEntries,
      (key, s) => {
        if (!evaluate(s.visible, data)) return undefined;
        const subs = s.subSections
          ? insertByPosition<KSub, ManifestSubSection>([], s.subSections, (k, c) => customSub(k, c, c.title))
          : [customSub(key, { template: s.template, actions: s.actions, overflowGroups: s.overflowGroups, isPartOfPreview: s.isPartOfPreview }, s.title)].filter((x): x is KSub => Boolean(x));
        return { key, id: key, title: s.title ?? key, messageStrip: s.messageStrip, subSections: subs };
      },
      (section, s) => {
        if (!evaluate(s.visible, data)) return undefined;
        // the entry of an annotation sub-section that is not shown (UI.Hidden, or no content) is left out as well
        const shownSubs = new Set(section.subSections.map((x) => x.key));
        const absent = new Set((ui.sections.find((x) => x.id === section.key)?.subSections ?? []).map((x) => x.id).filter((id) => !shownSubs.has(id)));
        const subEntries = s.subSections && Object.fromEntries(Object.entries(s.subSections).filter(([k]) => !absent.has(k)));
        const subs = insertByPosition<KSub, ManifestSubSection>(section.subSections, subEntries, (k, c) => customSub(k, c, c.title),
          (sub, c) => (c.template || c.sideContent || c.actions || c.blocks ? customSub(sub.key, c, c.title, sub) : evaluate(c.visible, data) ? { ...sub, title: c.title ?? sub.title } : undefined));
        return { ...section, title: s.title ?? section.title, messageStrip: s.messageStrip ?? section.messageStrip, subSections: subs };
      },
    );
    out = out.filter((s) => s.subSections.length);
    // The editable header section in edit mode (FE createEditableHeaderSection, editableHeaderContent): the header
    // fields and the `templateEdit` of custom header facets, before all sections.
    if (editing && headerEditable) {
      const subs: KSub[] = [];
      if (headerGroups.length) subs.push({ key: EDITABLE_HEADER_SECTION, id: EDITABLE_HEADER_SECTION, title: t('edit.headerSection'), content: form(headerGroups) });
      for (const f of headerFacets) if (f.custom?.templateEdit) subs.push({ key: f.key, id: f.key, title: f.custom.title ?? f.key, content: <div data-sk-custom-subsection={f.key}>{f.custom.templateEdit(data)}</div> });
      if (subs.length) out.unshift({ key: EDITABLE_HEADER_SECTION, id: EDITABLE_HEADER_SECTION, title: t('edit.headerSection'), subSections: subs });
    }
    return out.map(({ key: _k, subSections, ...s }) => ({ ...s, subSections: subSections.map(({ key: _s, ...sub }) => sub) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rebuilt when data, model, mode, settings or counts change
  }, [ui, data, typeName, readPath, p.service, p.controlConfiguration, p.navigation, p.useTextForNoDataMessages, p.enableLazyLoading, customSections, sideShown, navigation, t, editing, formValues, errors, headerGroups, headerFacets, headerEditable, useIconTabBar, creating, session]);

  // Restore the section that was active when the page was left (NAV-04): once, with the value stored at mount.
  const initialSection = useRef(view.section);
  const restored = useRef(false);
  useEffect(() => {
    const id = initialSection.current;
    if (restored.current || !data || !id || useIconTabBar || id === sections[0]?.id) return;
    restored.current = true;
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-sk-anchor="${CSS.escape(id)}"]`)?.click());
  }, [data, useIconTabBar, sections]);

  const crumbs = resolved ? resolved.levels.slice(0, -1) : [];
  const breadcrumbs = crumbs.length ? (
    <Breadcrumbs aria-label={t('object.breadcrumbs')} separator="/">
      {crumbs.map((l) => <Crumb key={l.path} path={l.path} service={p.service} onClick={() => navigation?.toObject(l.path, service.name)} />)}
    </Breadcrumbs>
  ) : undefined;

  // Paging buttons of sub-object pages (OP Representation of Child Pages): previous / next sibling.
  const parentLevel = resolved && resolved.levels.length > 1 ? resolved.levels[resolved.levels.length - 2] : undefined;
  const lastNav = resolved && parentLevel ? activePath.slice(parentLevel.path.length + 1).split('(')[0]! : undefined;
  const siblings = useQuery({
    queryKey: ['smart-kit', 'siblings', service.name, parentLevel?.path, lastNav],
    enabled: p.paging !== false && Boolean(parentLevel && lastNav),
    queryFn: ({ signal }) => service.dataProvider.query({ source: { parent: parentLevel!.path, navigation: lastNav! }, select: type.keys, expand: [], orderBy: type.keys.map((k) => ({ path: k, descending: false })), top: 1000, count: false }, { signal }),
    staleTime: 30_000,
  });
  const keyMatch = (r: Row) => type.keys.every((k) => String(r[k]) === String(resolved?.key[k]));
  const index = siblings.data?.rows.findIndex(keyMatch) ?? -1;
  const goSibling = (d: -1 | 1) => {
    const row = siblings.data?.rows[index + d];
    if (row && parentLevel && lastNav) navigation?.toObject(childPathOf(model, parentLevel.path, lastNav, row), service.name);
  };
  // Navigation actions (DP Header Title (6)): the paginator (siblings of a sub-object, or the paging the column gives)
  // and the flexible column layout actions.
  const subPaging = Boolean(parentLevel) && p.paging !== false && !editing;
  const navigationActions = subPaging || column?.paging || column?.close ? (
    <>
      {subPaging ? (
        <Paginator
          ariaTitle={ui.headerInfo.typeNamePlural}
          onPrevious={index > 0 ? () => goSibling(-1) : undefined}
          onNext={index >= 0 && index < (siblings.data?.rows.length ?? 0) - 1 ? () => goSibling(1) : undefined}
        />
      ) : <Paginator ariaTitle={ui.headerInfo.typeNamePlural} />}
      <FlexibleColumnLayoutActions />
    </>
  ) : undefined;

  // Global actions (FE HeaderAndFooterAction getHeaderDefaultActions): the draft switch, the critical annotation actions,
  // Edit, Delete, Copy, the other annotation actions; custom actions (`content › header › actions`) placed among them;
  // Share at the end. Edit is shown in display mode (not with UI.UpdateHidden); Delete in display mode of the object
  // page, in edit mode of a sub-object page (not with UI.DeleteHidden), disabled while Deletable is false or another
  // user has the draft (InProcessByUser); the annotation actions in both modes.
  const refTrue = (r: typeof caps.updateHidden) => Boolean(r && ('value' in r ? r.value === true || r.value === 'true' : isTrue(data, r.path)));
  const draftAdmin = (data?.DraftAdministrativeData ?? undefined) as Row | undefined;
  const showDraftSwitch = Boolean(setModel.draft?.root && setModel.draft.editAction) && !refTrue(caps.updateHidden) && !creating && !session?.isNew
    && (editing ? Boolean(session?.draft) : data?.HasDraftEntity === true && draftAdmin?.DraftIsCreatedByMe === true);
  // FE Draft.HasNoDraftForCurrentUser: no Edit while the user has a draft of the object (the draft switch leads to it)
  const ownDraft = Boolean(setModel.draft?.root) && data?.HasDraftEntity === true && draftAdmin?.DraftIsCreatedByMe === true;
  const editVisible = editable && !editing && !refTrue(caps.updateHidden) && !ownDraft;
  const deleteVisible = deletable && (viewLevel > 1 ? editing : !editing) && !refTrue(caps.deleteHidden);
  const deleteEnabled = (!caps.deletablePath || isTrue(data, caps.deletablePath)) && !(setModel.draft?.root && draftAdmin?.InProcessByUser);
  // FE Actions.fragment.xml: Edit "High", the other header actions "Low" unless `priority` is set
  const headerAnnotation = (a: ActionModel, text?: string) => {
    const item = annotationAction(a, { text, priority: 'Low' });
    return item ? [{ ...item, annotation: a, annotationText: text }] : [];
  };
  const headerPlaced = placeActions([
    ...(showDraftSwitch ? [{
      key: 'DraftActions',
      render: () => (
        <Menu key="DraftActions" position="bottom-end">
          <Menu.Target>
            <Button variant="subtle" rightSection={<span aria-hidden>▾</span>} data-sk-action="SwitchDraftAndActiveObject">{editing ? t('draft.switchDraft') : t('draft.switchSavedVersion')}</Button>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item onClick={() => void (editing ? undefined : startEdit())} data-sk-draft-switch="draft">{t('draft.switchDraft')}</Menu.Item>
            <Menu.Item onClick={() => void (editing ? showSavedVersion() : undefined)} data-sk-draft-switch="active">{t('draft.switchSavedVersion')}</Menu.Item>
          </Menu.Dropdown>
        </Menu>
      ),
    }] : []),
    ...headerModelActions.filter(isCriticalAction).flatMap((a) => headerAnnotation(a)),
    ...(editVisible ? [{ key: 'EditAction', priority: 'High' as const, render: (v: Variant) => <Button key="EditAction" variant={v} disabled={busy || !obj.data} onClick={() => void startEdit()} data-sk-action="Edit">{t('actions.edit')}</Button> }] : []),
    ...(deleteVisible ? [{ key: 'DeleteAction', priority: 'Low' as const, render: (v: Variant) => <Button key="DeleteAction" variant={v} disabled={!deleteEnabled} onClick={() => setConfirm('delete')} data-sk-action="Delete">{t('actions.delete')}</Button> }] : []),
    ...(copyAction ? headerAnnotation(copyAction, copyAction.label || t('actions.copy')) : []),
    ...headerModelActions.filter((a) => !isCriticalAction(a)).flatMap((a) => headerAnnotation(a)),
  ], header?.actions, 'Low');

  const message = typeof p.headerMessage === 'function' ? p.headerMessage(data) : p.headerMessage;
  const errorStrip = obj.error && !creating ? (
    <Alert color="red" variant="light" role="alert" data-sk-object-error>
      {'status' in obj.error && (obj.error as { status: number }).status === 404 ? typedText(t, 'object.notFound', ui.headerInfo.typeName) : typedText(t, 'object.loadError', ui.headerInfo.typeName, { message: obj.error.message })}
    </Alert>
  ) : null;

  // Footer toolbar (OP Footer Toolbar): messages; finalizing actions (SaveAction / CancelAction while editing, determining
  // actions in display mode) and the custom footer actions (`content › footer › actions`).
  // FE getFooterDefaultActions: the critical determining actions, SaveAction, the other determining actions,
  // CancelAction (position End). The determining actions are shown in display and in edit mode (disabled while
  // Core.OperationAvailable is false); Save and Cancel only while editing.
  const footerAnnotation = (a: ActionModel) => {
    const item = annotationAction(a);
    return item ? [{ ...item, annotation: a }] : [];
  };
  const footerPlaced = placeActions([
    ...footerActions.filter(isCriticalAction).flatMap(footerAnnotation),
    ...(editing ? [{ key: 'SaveAction', render: (v: Variant) => <Button key="SaveAction" variant={v} onClick={() => void save()} loading={busy} data-sk-save>{creating ? t('actions.create') : t('edit.save')}</Button> }] : []),
    ...footerActions.filter((a) => !isCriticalAction(a)).flatMap(footerAnnotation),
    ...(editing ? [{
      key: 'CancelAction',
      render: () => (
        <Button key="CancelAction" variant="default" onClick={() => (session?.draft || session?.changed.size || creating ? setConfirm('discard') : void discard())} data-sk-cancel>
          {session?.draft ? t('edit.discardDraft') : t('edit.cancel')}
        </Button>
      ),
    }] : []),
  ], customFooter);
  // FE applyObjectPageEmphasisRules (header, footer, criticality) with the templates' Edit and Save expressions
  const emphasis = objectPageEmphasis(headerPlaced, footerPlaced, { footerShown: editing || footerPlaced.length > 0 });
  const footerItems = toolbarItems(footerPlaced, {
    variant: 'default', overflowGroups: p.content?.footer?.overflowGroups, first: emphasis.footer, emphasize: (a) => a.key === 'SaveAction' && emphasis.save,
  });
  const footer = editing || footerItems.length || messages.messages.length ? (
    <Group justify="space-between" wrap="nowrap" data-sk-footer>
      <Group gap="xs" wrap="nowrap"><MessageButton />{editing && session?.draft && draftStatus ? <Text size="sm" c="dimmed" role="status" data-sk-draft-status>{draftStatus === 'saving' ? t('edit.draftSaving') : t('edit.draftSaved')}</Text> : null}</Group>
      {/* FE FooterContent: the OverflowToolbar starts with a ToolbarSpacer, the actions are at its end */}
      {footerItems.length ? <OverflowToolbar design="Transparent" style="Clear" className="sk-object-footer__toolbar"><ToolbarSpacer key="Spacer" />{footerItems}</OverflowToolbar> : null}
    </Group>
  ) : undefined;
  // The header's OverflowToolbar: the emphasized-first action (draft: after the draft switch, FE Actions.fragment.xml),
  // the actions with separators (FE addSeparators), Share with `shareOverflowPriority` (macro:Share priority)
  const actions = [
    ...toolbarItems(headerPlaced, {
      variant: 'subtle', overflowGroups: header?.overflowGroups, first: emphasis.header, firstAfter: draftEnabled && showDraftSwitch ? 'DraftActions' : undefined,
      emphasize: (a) => a.key === 'EditAction' && emphasis.edit, templates: true,
    }),
    <ToolbarSlot key="Share" layoutData={{ priority: p.shareOverflowPriority ?? 'High' }}><Share title={heading} href={navigation?.href?.({ kind: 'object', path: activePath, service: service.name })} /></ToolbarSlot>,
  ];

  // The draft indicator reads who changed the draft and when as its popover opens (FE DraftIndicator; the page selects
  // only DraftIsCreatedByMe, DraftUUID and InProcessByUser).
  const loadDraftAdmin = () => service.dataProvider.read(readPath, { select: [], expand: [{ navigation: 'DraftAdministrativeData', select: [], expand: [] }] });
  const marker = draftEnabled && (mode === 'edit' || obj.data?.HasDraftEntity === true) ? <DraftIndicator load={readPath ? loadDraftAdmin : undefined} row={session?.draft ? { ...obj.data, IsActiveEntity: false, DraftAdministrativeData: { DraftIsCreatedByMe: true, ...(obj.data?.DraftAdministrativeData as Row | undefined) } } : obj.data} /> : undefined;
  const keyInfo = typeof p.keyInfo === 'function' ? p.keyInfo(data) : p.keyInfo;
  // The title (with the object marker next to it) and, while snapped, the small avatar before it.
  const headingLine = <><h1 className="sk-dynamic-page__heading" data-sk-heading>{heading}</h1>{marker ? <span className="sk-dynamic-page__title-addon">{marker}</span> : null}</>;
  const smallAvatar = avatar('sm');
  const largeAvatar = avatar('lg');
  // FE getShowHeaderContent: no header content without facets; with editableHeaderContent hidden while editing.
  const showHeaderContent = !(editing && headerEditable);

  return (
    <div ref={rootRef} className="sk-object-page-root" data-mode={mode} data-sk-section-layout={useIconTabBar ? 'Tabs' : 'Page'}>
      <ObjectPageLayout
        className={p.className}
        scope={typeName.replace(/\W/g, '_')}
        headerTitle={headerVisible ? (
          <ObjectPageDynamicHeaderTitle
            heading={headingLine}
            snappedHeading={smallAvatar ? <><div className="sk-dynamic-page__avatar">{smallAvatar}</div>{headingLine}</> : undefined}
            snappedTitleOnMobile={heading}
            expandedContent={subheading}
            snappedContent={subheading ? <div className="sk-dynamic-page__subheading" data-sk-subheading>{subheading}</div> : undefined}
            breadcrumbs={breadcrumbs}
            actions={actions.length ? actions : undefined}
            content={keyInfo}
            navigationActions={navigationActions}
            onStateChange={(e) => setView((v) => (v.headerExpanded === e.isExpanded ? v : { ...v, headerExpanded: e.isExpanded }))}
          />
        ) : undefined}
        headerMessage={errorStrip ?? message}
        headerContent={headerVisible && (largeAvatar || headerFacets.length) ? <>
          {largeAvatar ? <div className="sk-object-header__avatar">{largeAvatar}</div> : null}
          <div className="sk-object-header__facets">{headerFacets.map((f) => f.node)}</div>
        </> : undefined}
        showHeaderContent={showHeaderContent}
        sections={obj.error && !creating ? [] : sections}
        useIconTabBar={useIconTabBar}
        showAnchorBar={anchorBarVisible}
        toggleHeaderOnTitleClick={anchorBarVisible}
        headerContentPinnable={anchorBarVisible}
        upperCaseAnchorBar={false}
        enableLazyLoading
        selectedSection={useIconTabBar ? view.section : undefined}
        onSectionChange={(e) => setView((v) => (v.section === e.section ? v : { ...v, section: e.section }))}
        headerExpanded={view.headerExpanded}
        headerContentPinned={view.pinned}
        onHeaderContentPinnedStateChange={(e) => setView((v) => ({ ...v, pinned: e.pinned }))}
        footer={footer}
        showFooter={Boolean(footer)}
        letterboxing={p.letterboxing}
      />
      {image ? (
        <Modal opened={enlarged} onClose={() => setEnlarged(false)} title={heading} centered size="auto" closeButtonProps={{ 'aria-label': t('common.close') }}>
          <Image src={String(image)} alt={t('object.image', { name: heading })} className="sk-object-avatar__large" data-sk-avatar-large />
        </Modal>
      ) : null}
      {runner.dialogs}
      <Modal opened={confirm !== null} onClose={() => setConfirm(null)} title={confirm === 'delete' ? t('delete.title') : t('edit.discardDraft')} data-sk-confirm={confirm ?? undefined}>
        <Stack>
          <Text>{confirm === 'delete' ? t('delete.confirmOne', { name: heading }) : t('edit.discardQuestion')}</Text>
          <Group justify="flex-end">
            {confirm === 'delete'
              ? <Button color="red" onClick={() => void remove()} data-sk-confirm-ok>{t('actions.delete')}</Button>
              : <Button color="red" onClick={() => void discard()} data-sk-confirm-ok>{session?.draft ? t('edit.discardDraft') : t('edit.cancel')}</Button>}
            <Button variant="default" onClick={() => setConfirm(null)}>{confirm === 'delete' ? t('common.cancel') : t('edit.keepEditing')}</Button>
          </Group>
        </Stack>
      </Modal>
    </div>
  );
}
