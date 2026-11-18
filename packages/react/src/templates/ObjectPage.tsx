/**
 * Object page template = sap.fe.templates.ObjectPage (ADR-033, docs/30 §5.3): its props are the manifest settings of
 * the object page (docs/26c §3.1, §3.3, §4, §8; types in ./ObjectPageSettings). Built only from public building blocks
 * (AC-BOOT-01): header with facets, page or tab layout, forms and sub-tables from UI.Facets, breadcrumbs for sub-object
 * pages, state restoration; edit (direct save or draft, ADR-018), create mode, delete, header and footer actions
 * (ADR-024), messages (ADR-023), object marker, the editable "Header" section, paging buttons, side content.
 */
import { Alert, Anchor, Avatar, Breadcrumbs, Button, Group, Image, Menu, Modal, Stack, Text, UnstyledButton } from '@mantine/core';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  capabilitiesFor, childPathOf, ConcurrencyError, DERIVED_GENERAL_SECTION, isDraftRow, messagesFromError, resolveEntityPath,
  siblingPath, targetEntitySet, type EditSession, type FieldModel, type Message, type Row, type SectionModel,
} from '@rhfan2019/smart-kit-core';
import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode, type Ref } from 'react';
import {
  actionPaths, fieldErrors, getPath, isActionAvailable, isEditable,
  typedText, usePageState, useService, useSmartKit, useText,
  validate,
} from '../index';
import ObjectPageLayout, { type SectionItem, type SubSectionItem } from '../uxap/ObjectPageLayout';
import ObjectPageDynamicHeaderTitle from '../uxap/ObjectPageDynamicHeaderTitle';
import type { OverflowToolbarLayoutData } from '../m/OverflowToolbar';
import Share from '../v4/fe/macros/Share';
import Paginator from '../v4/fe/macros/Paginator';
import FlexibleColumnLayoutActions from '../v4/fe/macros/fcl/FlexibleColumnLayoutActions.block';
import HeaderFacet from '../kit/HeaderFacet';
import useColumn from '../kit/useColumn';
import useObject from '../kit/useObject';
import useObjectTitle from '../kit/useObjectTitle';
import DraftIndicator from '../kit/DraftIndicator';
import Table, { type $ActionSettings, type $ColumnSettings, type ActionGroup } from '../v4/fe/macros/Table';
import MessageButton from '../v4/fe/macros/MessageButton';
import Field from '../v4/fe/macros/Field';
import Form from '../v4/fe/macros/Form';
import useActionRunner from '../kit/useActionRunner';
import useEditStrategy from '../kit/useEditStrategy';
import MessageProvider from '../kit/MessageProvider';
import useMessages from '../kit/useMessages';
import type {
  Context, ManifestAction, ManifestHeaderFacet, ManifestSection, ManifestSubSection, ObjectPageManifestSettings, Position,
  TableManifestConfiguration, TableManifestSettingsConfiguration,
} from './ObjectPageSettings';

export type {
  Context, ManifestAction, ManifestHeaderFacet, ManifestSection, ManifestSideContent, ManifestSubSection, NavigationSettingsConfiguration,
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

/** Draft administrative paths of a draft-enabled type. */
function draftSelect(type: { properties: Record<string, unknown>; navigations: Record<string, unknown> }): string[] {
  const out = ['IsActiveEntity', 'HasDraftEntity', 'HasActiveEntity'].filter((p) => p in type.properties);
  if (type.navigations.DraftAdministrativeData) out.push('DraftAdministrativeData/DraftIsCreatedByMe', 'DraftAdministrativeData/InProcessByUser', 'DraftAdministrativeData/LastChangedByUser', 'DraftAdministrativeData/LastChangeDateTime', 'DraftAdministrativeData/CreatedByUser');
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

/** Table personalization (`tableSettings › personalization`) as the building block's comma-separated value. */
export function personalizationOf(v: TableManifestSettingsConfiguration['personalization']): string | undefined {
  if (v === undefined || v === true) return undefined;
  if (v === false) return 'false';
  const parts = (['column', 'sort', 'filter', 'group', 'aggregate'] as const).filter((k) => v[k]).map((k) => k[0]!.toUpperCase() + k.slice(1));
  return parts.length ? parts.join(',') : 'false';
}

/** `columns` and `actions` of a sub-table configuration as the building block's aggregations. */
export function tableAggregationsOf(cfg: TableManifestConfiguration | undefined): { columns?: $ColumnSettings[]; actions?: $ActionSettings[]; actionGroups?: ActionGroup[] } {
  if (!cfg) return {};
  const placement = (p?: Position) => (p?.placement === 'Before' ? 'Before' as const : 'After' as const);
  const columns = cfg.columns ? Object.entries(cfg.columns).map(([key, c]) => ({
    key, header: c.header, anchor: c.position?.anchor, placement: placement(c.position), width: c.width, importance: c.importance,
    horizontalAlign: c.horizontalAlign, properties: c.properties, disableExport: c.disableExport, template: c.template,
  } satisfies $ColumnSettings)) : undefined;
  const entries = cfg.actions ? Object.entries(cfg.actions) : [];
  const actions = entries.filter(([, a]) => !a.menu).map(([key, a]) => ({
    key, text: a.text ?? key, anchor: a.position?.anchor, placement: placement(a.position), enabled: a.enabled, visible: a.visible,
    requiresSelection: a.requiresSelection, enableOnSelect: a.enableOnSelect, onPress: a.press ? (e) => a.press!({ selectedContexts: e.selectedContexts }) : undefined,
  } satisfies $ActionSettings));
  const actionGroups = entries.filter(([, a]) => a.menu).map(([key, a]) => ({ id: key, label: a.text ?? key, actions: a.menu! }));
  return { columns, actions: entries.length ? actions : undefined, actionGroups: actionGroups.length ? actionGroups : undefined };
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

/** A keyed header or footer action. */
interface KeyedAction { key: string; node: ReactNode; text?: string; press?(): void; menu?: string[] }

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
  // The draft instance is read while editing a draft (ADR-018).
  const readPath = session?.draft && session.path ? session.path : creating ? '' : p.path;
  const extra = useMemo(() => [...(p.additionalProperties ?? []), ...(draftEnabled ? draftSelect(type) : []), ...actionPaths(model.ui[typeName]!.objectActions)], [p.additionalProperties, draftEnabled, type, model, typeName]);
  const obj = useObject(readPath || `${entitySet}`, { service: p.service, extraSelect: extra, enabled: Boolean(readPath) });
  const ui = model.ui[typeName]!;
  const data = creating && !session?.draft ? values : obj.data;
  const pageKey = `object:${creating ? `new:${entitySet}` : resolved!.canonical}`;
  const [view, setView] = usePageState<{ headerExpanded?: boolean; pinned?: boolean; section?: string }>(pageKey, {});
  const [counts, setCounts] = useState<Record<string, number | undefined>>({});
  const [sideShown, setSideShown] = useState<Record<string, boolean>>({});
  const caps = capabilitiesFor(model, entitySet);
  const canWrite = Boolean(service.dataProvider.update && service.dataProvider.invoke);
  const editable = (p.editable ?? caps.updatable) && canWrite && !creating;
  const deletable = caps.deletable && Boolean(service.dataProvider.remove) && !creating;

  useImperativeHandle(p.ref, () => ({
    showSideContent: (key: string, show?: boolean) => setSideShown((s) => ({ ...s, [key]: show ?? !s[key] })),
  }), []);

  // Opening a draft directly (or returning to one) continues the edit session.
  const resumed = useRef(false);
  useEffect(() => {
    if (resumed.current || !obj.data || mode !== 'display' || !isDraftRow(obj.data)) return;
    resumed.current = true;
    void strategy.begin(p.path, obj.data).then((s) => { setSession(s); setValues({ ...s.values }); setMode('edit'); });
  }, [obj.data, mode, strategy, p.path]);

  // Create mode with the draft strategy: the draft is created when the page opens.
  const started = useRef(false);
  useEffect(() => {
    if (!creating || started.current) return;
    started.current = true;
    void strategy.create({ entitySet }, p.create?.initial ?? {}).then((s) => { setSession(s); setValues({ ...s.values }); }).catch((e) => messages.add(messagesFromError(e)));
  }, [creating, strategy, entitySet, p.create, messages]);

  const editableFields = useMemo(() => {
    const out: FieldModel[] = [];
    for (const s of ui.sections) for (const sub of s.subSections) if (sub.content.kind === 'form') for (const g of sub.content.groups) out.push(...g.fields);
    return out;
  }, [ui]);
  // Editable header fields: title, description and header form facets (OP Editing header content); only with
  // editableHeaderContent (FE: otherwise the header stays read-only while editing).
  const headerFields = useMemo(() => {
    const out: FieldModel[] = [];
    if (!headerEditable) return out;
    const add = (path: string | undefined) => {
      if (!path || path.includes('/')) return;
      const prop = type.properties[path];
      if (!isEditable(prop, creating) || out.some((f) => f.path === path)) return;
      out.push({ id: `Header::${path}`, kind: 'field', path, label: prop!.label, criticalityIcon: true, isSemanticKey: false });
    };
    add(ui.headerInfo.title);
    add(ui.headerInfo.description);
    for (const f of ui.headerFacets) if (f.kind === 'form') for (const fd of f.fields) add(fd.path);
    return out;
  }, [ui, type, creating, headerEditable]);

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

  const remove = async () => {
    setConfirm(null);
    try {
      await service.dataProvider.remove!(activePath, { etag: obj.data?.['@odata.etag'] as string | undefined });
      void invalidate();
      if (p.onDeleted) p.onDeleted();
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
    for (const s of ui.sections) for (const sub of s.subSections) if (sub.content.kind === 'form' && sub.content.groups.some((g) => g.fields.some((f) => f.path === path))) return s.id;
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
  const runner = useActionRunner({ service: p.service, onDone: () => { obj.refresh(); void invalidate(); } });
  const objectTarget = { row: data ?? {}, path: activePath, label: String(getPath(data, ui.headerInfo.title ?? type.keys[0]!) ?? '') };
  const headerModelActions = ui.objectActions.filter((a) => !a.determining && isActionAvailable(a, data));
  const footerActions = ui.objectActions.filter((a) => a.determining && isActionAvailable(a, data));
  const pageContext: Context = { getPath: () => `/${activePath}`, getObject: () => data ?? {} };
  /** Custom actions (ManifestAction) placed among the keyed standard and annotation actions. */
  const withCustomActions = (items: KeyedAction[], custom: Record<string, ManifestAction> | undefined, variant: 'subtle' | 'default'): KeyedAction[] => {
    // CancelAction has the position "End" in FE (HeaderAndFooterAction): custom actions go before it.
    const end = items.at(-1)?.key === 'CancelAction' ? items.at(-1) : undefined;
    const base = end ? items.slice(0, -1) : items;
    const inserted = insertByPosition<KeyedAction, ManifestAction>(base, custom, (key, a) => {
      if (!evaluate(a.visible, data)) return undefined;
      const disabled = !evaluate(a.enabled, data);
      const press = a.press ? () => a.press!({ bindingContext: pageContext }) : undefined;
      return { key, text: a.text, press, menu: a.menu, node: <Button key={key} variant={variant} disabled={disabled} onClick={press} data-sk-action={key}>{a.text ?? key}</Button> };
    });
    const placed = end ? [...inserted, end] : inserted;
    // Menu buttons (`menu`): the listed actions move into the menu.
    const inMenus = new Set(placed.flatMap((a) => a.menu ?? []));
    return placed.filter((a) => !inMenus.has(a.key)).map((a) => (a.menu ? {
      ...a,
      node: (
        <Menu key={a.key} position="bottom-end">
          <Menu.Target><Button variant={variant} data-sk-action-group={a.key}>{a.text ?? a.key}</Button></Menu.Target>
          <Menu.Dropdown>
            {a.menu.map((k) => placed.find((x) => x.key === k)).filter((x): x is KeyedAction => Boolean(x)).map((x) => (
              <Menu.Item key={x.key} onClick={x.press} data-sk-action={x.key}>{x.text ?? x.key}</Menu.Item>
            ))}
          </Menu.Dropdown>
        </Menu>
      ),
    } : a));
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

  // Tab layout: every tab with a table shows its item count (OP Tab Navigation), also before the tab is opened.
  const countQueries = useMemo(() => (!useIconTabBar || creating ? [] : ui.sections.flatMap((s: SectionModel) => s.subSections.flatMap((sub) => {
    if (sub.content.kind !== 'table' || !capabilitiesFor(model, entitySet, sub.content.navigation).countable) return [];
    const keys = model.entityTypes[sub.content.targetType]?.keys ?? [];
    return [{ id: sub.id, navigation: sub.content.navigation, keys }];
  }))), [useIconTabBar, ui, model, entitySet, creating]);
  const counted = useQueries({
    queries: countQueries.map((c) => ({
      queryKey: ['sk-count', service.name, readPath, c.navigation],
      queryFn: ({ signal }: { signal: AbortSignal }) => service.dataProvider.query({ source: { parent: readPath, navigation: c.navigation }, select: c.keys, expand: [], orderBy: [], top: 0, count: true }, { signal }),
    })),
  });
  const countKey = counted.map((q) => q.data?.count ?? '').join(',');
  const tabCounts = useMemo(() => Object.fromEntries(countQueries.map((c, i) => [c.id, counted[i]?.data?.count])), [countKey, countQueries]); // eslint-disable-line react-hooks/exhaustive-deps
  const countOf = (id: string) => counts[id] ?? tabCounts[id];

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
      const actions = s.actions ? withCustomActions([], s.actions, 'default') : [];
      const side = s.sideContent && sideShown[key] ? s.sideContent.template(data) : undefined;
      const content = (
        <div className={['sk-custom-subsection', side ? 'sk-custom-subsection--side' : '', s.sideContent?.equalSplit ? 'sk-custom-subsection--equal' : ''].filter(Boolean).join(' ')} data-sk-custom-subsection={key}>
          {actions.length ? <Group justify="flex-end" gap="xs" className="sk-custom-subsection__actions" data-sk-subsection-actions>{actions.map((a) => a.node)}</Group> : null}
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
    const annotationSections: KSection[] = ui.sections.map((s: SectionModel) => {
      const tableTitleLevel = s.subSections.length === 1 ? 3 : 4; // OP Title Styles
      return {
        key: s.id,
        id: s.id,
        title: label(s),
        subSections: s.subSections.flatMap((sub, index): KSub[] => {
          const subTitle = label(sub);
          const common = { key: sub.id, id: sub.id, title: subTitle, partOfPreview: sub.partOfPreview, lazy: lazyAll };
          if (sub.content.kind === 'form') {
            const groups = sub.content.groups;
            return [{ ...common, partOfPreview: editing ? true : sub.partOfPreview, content: <Form typeName={typeName} service={p.service} row={data} metaPath={groups} readOnly={!editing} values={formValues} onChange={(e) => change(e.path, e.value)} errors={errors} creating={creating} /> }];
          }
          if (sub.content.kind === 'dataPoint') {
            return [{ ...common, content: <HeaderFacet typeName={typeName} service={p.service} row={data} facet={{ id: sub.id, kind: 'dataPoint', label: subTitle, dataPoint: sub.content.dataPoint }} /> }];
          }
          if (sub.content.kind === 'chart') {
            return [{ ...common, content: <HeaderFacet typeName={typeName} service={p.service} row={data} path={readPath} facet={{ id: sub.id, kind: 'chart', label: subTitle, chart: sub.content.chart }} /> }];
          }
          if (creating && !session?.draft) return [];
          const nav = sub.content.navigation;
          const target = targetEntitySet(model, entitySet, nav);
          const last = index === s.subSections.length - 1;
          const cfg = tableConfigurationOf(p, nav);
          const ts = cfg?.tableSettings;
          const navEntry = p.navigation?.[nav];
          // "Routing" of smart-kit: a `navigation` entry, else the host's NavigationAdapter has an object page.
          const routed = navEntry ? Boolean(navEntry.detail) : Boolean(target && navigation?.hasObjectPage?.(target, service.name));
          const aggregations = tableAggregationsOf(cfg);
          return [{
            ...common,
            isTable: true,
            lazy: true,
            count: countOf(sub.id),
            content: (
              <Table
                service={p.service}
                contextPath={`/${entitySet}/${nav}`}
                bindingContext={readPath}
                header={ts?.header ?? subTitle}
                headerVisible={ts?.headerVisible}
                headerLevel={`H${tableTitleLevel}`}
                pageKey={`${pageKey}:${sub.id}`}
                type={ts?.type === 'TreeTable' ? undefined : ts?.type}
                selectionMode={ts?.selectionMode}
                enableExport={ts?.enableExport}
                exportFileName={ts?.exportFileName}
                exportSheetName={ts?.exportSheetName}
                exportRequestSize={ts?.exportRequestSize}
                disableCopyToClipboard={ts?.disableCopyToClipboard}
                enableFullScreen={ts?.enableFullScreen}
                personalization={personalizationOf(ts?.personalization)}
                rowCountMode={ts?.rowCountMode}
                selectionLimit={ts?.selectionLimit}
                frozenColumnCount={ts?.frozenColumnCount}
                disableColumnFreeze={ts?.disableColumnFreeze}
                widthIncludingColumnHeader={ts?.widthIncludingColumnHeader}
                condensedTableLayout={ts?.condensedTableLayout}
                popinLayout={ts?.popinLayout}
                threshold={ts?.threshold}
                scrollThreshold={ts?.scrollThreshold}
                ignoredFields={ts?.ignoredFields}
                isSearchable={ts?.isSearchable ?? true}
                modeForNoDataMessage={p.useTextForNoDataMessages ? 'text' : 'illustratedMessage-ExtraSmall'}
                columns={aggregations.columns}
                actions={aggregations.actions}
                actionGroups={aggregations.actionGroups}
                onRowPress={p.onRowNavigate ? (e) => p.onRowNavigate!(e.bindingContext.getObject(), e.bindingContext.getPath().slice(1)) : undefined}
                navigable={p.onRowNavigate ? true : routed}
                onCountChange={(c) => setCounts((x) => (x[sub.id] === c ? x : { ...x, [sub.id]: c }))}
                readOnly={!editing || Boolean(ts?.readOnly)}
                creationMode={{ name: creationModeOf(ts, routed) === 'CreationDialog' ? 'CreationDialog' : 'Inline' }}
                onCreated={() => setCounts((x) => ({ ...x, [sub.id]: undefined }))}
                growingScrollToLoad={useIconTabBar && last}
                showAllThreshold={p.showAllThreshold}
              />
            ),
          }];
        }),
      };
    });
    // Custom sections and overrides (`content › body › sections`, FE getSections: title, visible, sub-sections).
    let out = insertByPosition<KSection, ManifestSection>(
      annotationSections,
      customSections,
      (key, s) => {
        if (!evaluate(s.visible, data)) return undefined;
        const subs = s.subSections
          ? insertByPosition<KSub, ManifestSubSection>([], s.subSections, (k, c) => customSub(k, c, c.title))
          : [customSub(key, { template: s.template, actions: s.actions, isPartOfPreview: s.isPartOfPreview }, s.title)].filter((x): x is KSub => Boolean(x));
        return { key, id: key, title: s.title ?? key, messageStrip: s.messageStrip, subSections: subs };
      },
      (section, s) => {
        if (!evaluate(s.visible, data)) return undefined;
        const subs = insertByPosition<KSub, ManifestSubSection>(section.subSections, s.subSections, (k, c) => customSub(k, c, c.title),
          (sub, c) => (c.template || c.sideContent || c.actions || c.blocks ? customSub(sub.key, c, c.title, sub) : evaluate(c.visible, data) ? { ...sub, title: c.title ?? sub.title } : undefined));
        return { ...section, title: s.title ?? section.title, messageStrip: s.messageStrip ?? section.messageStrip, subSections: subs };
      },
    );
    out = out.filter((s) => s.subSections.length);
    // The editable header section in edit mode (FE createEditableHeaderSection, editableHeaderContent): the header
    // fields and the `templateEdit` of custom header facets, before all sections.
    if (editing && headerEditable) {
      const subs: KSub[] = [];
      if (headerFields.length) subs.push({ key: EDITABLE_HEADER_SECTION, id: EDITABLE_HEADER_SECTION, title: t('edit.headerSection'), content: <Form typeName={typeName} service={p.service} row={data} metaPath={[{ id: EDITABLE_HEADER_SECTION, fields: headerFields }]} readOnly={false} values={formValues} onChange={(e) => change(e.path, e.value)} errors={errors} creating={creating} /> });
      for (const f of headerFacets) if (f.custom?.templateEdit) subs.push({ key: f.key, id: f.key, title: f.custom.title ?? f.key, content: <div data-sk-custom-subsection={f.key}>{f.custom.templateEdit(data)}</div> });
      if (subs.length) out.unshift({ key: EDITABLE_HEADER_SECTION, id: EDITABLE_HEADER_SECTION, title: t('edit.headerSection'), subSections: subs });
    }
    return out.map(({ key: _k, subSections, ...s }) => ({ ...s, subSections: subSections.map(({ key: _s, ...sub }) => sub) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rebuilt when data, model, mode, settings or counts change
  }, [ui, data, typeName, readPath, p.service, counts, tabCounts, p.controlConfiguration, p.navigation, p.useTextForNoDataMessages, p.enableLazyLoading, customSections, sideShown, navigation, t, editing, formValues, errors, headerFields, headerFacets, headerEditable, useIconTabBar, creating, session]);

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

  // Global actions (OP Components (6)): business actions as text buttons, generic ones as icons; overflow right to left.
  // Custom actions (`content › header › actions`) are placed among EditAction, DeleteAction and the annotation actions;
  // Share stays at the end.
  // While editing, Edit / Delete and the annotation actions are hidden; the custom actions stay (FE: no mode dependency).
  const headerActions = withCustomActions(editing ? [] : [
    ...(editable ? [{ key: 'EditAction', node: <Button key="EditAction" variant="filled" disabled={busy || !obj.data} onClick={() => void startEdit()} data-sk-action="Edit">{t('actions.edit')}</Button> }] : []),
    ...(deletable ? [{ key: 'DeleteAction', node: <Button key="DeleteAction" variant="subtle" onClick={() => setConfirm('delete')} data-sk-action="Delete">{t('actions.delete')}</Button> }] : []),
    ...headerModelActions.map((a) => ({ key: a.id, text: a.label, press: () => runner.run(a, [objectTarget]), node: <Button key={a.id} variant="subtle" onClick={() => runner.run(a, [objectTarget])} data-sk-action={a.id}>{a.label}</Button> })),
  ], header?.actions, 'subtle');
  const actions = editing ? headerActions.map((a) => a.node) : [
    ...headerActions.map((a) => a.node),
    <Pinned key="Share" layoutData={{ priority: 'NeverOverflow' }}><Share title={heading} href={navigation?.href?.({ kind: 'object', path: activePath, service: service.name })} /></Pinned>,
  ];

  const message = typeof p.headerMessage === 'function' ? p.headerMessage(data) : p.headerMessage;
  const errorStrip = obj.error && !creating ? (
    <Alert color="red" variant="light" role="alert" data-sk-object-error>
      {'status' in obj.error && (obj.error as { status: number }).status === 404 ? typedText(t, 'object.notFound', ui.headerInfo.typeName) : typedText(t, 'object.loadError', ui.headerInfo.typeName, { message: obj.error.message })}
    </Alert>
  ) : null;

  // Footer toolbar (OP Footer Toolbar): messages; finalizing actions (SaveAction / CancelAction while editing, determining
  // actions in display mode) and the custom footer actions (`content › footer › actions`).
  const customFooter = p.content?.footer?.actions;
  const footerItems = withCustomActions(editing ? [
    { key: 'SaveAction', node: <Button key="SaveAction" onClick={() => void save()} loading={busy} data-sk-save>{creating ? t('actions.create') : t('edit.save')}</Button> },
    {
      key: 'CancelAction',
      node: (
        <Button key="CancelAction" variant="default" onClick={() => (session?.draft || session?.changed.size || creating ? setConfirm('discard') : void discard())} data-sk-cancel>
          {session?.draft ? t('edit.discardDraft') : t('edit.cancel')}
        </Button>
      ),
    },
  ] : footerActions.map((a, i) => ({ key: a.id, text: a.label, press: () => runner.run(a, [objectTarget]), node: <Button key={a.id} variant={i === 0 ? 'filled' : 'default'} onClick={() => runner.run(a, [objectTarget])} data-sk-action={a.id}>{a.label}</Button> })), customFooter, 'default');
  const footer = editing || footerItems.length || messages.messages.length ? (
    <Group justify="space-between" wrap="nowrap" data-sk-footer>
      <Group gap="xs"><MessageButton />{editing && session?.draft && draftStatus ? <Text size="sm" c="dimmed" role="status" data-sk-draft-status>{draftStatus === 'saving' ? t('edit.draftSaving') : t('edit.draftSaved')}</Text> : null}</Group>
      <Group gap="xs" wrap="nowrap">{footerItems.map((a) => a.node)}</Group>
    </Group>
  ) : undefined;

  const marker = draftEnabled && (mode === 'edit' || obj.data?.HasDraftEntity === true) ? <DraftIndicator row={session?.draft ? { ...obj.data, IsActiveEntity: false, DraftAdministrativeData: { DraftIsCreatedByMe: true, ...(obj.data?.DraftAdministrativeData as Row | undefined) } } : obj.data} /> : undefined;
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

/** A title action that never moves into the overflow (the OverflowToolbar reads `layoutData` from its children). */
function Pinned({ children }: { children: ReactNode; layoutData?: OverflowToolbarLayoutData }) {
  return <>{children}</>;
}
