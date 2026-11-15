/**
 * Object page template, built only from public building blocks (AC-BOOT-01): header with facets, anchor or tab
 * navigation, forms and sub-tables from UI.Facets, breadcrumbs for sub-object pages, state restoration; phase 2:
 * edit (direct save or draft, ADR-018), create mode, delete, header and footer actions (ADR-024), messages (ADR-023),
 * object marker, temporary "Header" section, partial header edit, paging buttons, side content.
 */
import { ActionIcon, Alert, Anchor, Avatar, Breadcrumbs, Button, Group, Image, Modal, Stack, Text, Tooltip, UnstyledButton } from '@mantine/core';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  capabilitiesFor, childPathOf, ConcurrencyError, DERIVED_GENERAL_SECTION, isDraftRow, messagesFromError, resolveEntityPath, resolvePath,
  siblingPath, targetEntitySet, type EditSession, type FieldModel, type Message, type Row, type SectionModel,
} from '@rhfan2019/smart-kit-core';
import { ChevronDown, ChevronUp, PanelRight } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  actionPaths, DraftMarker, fieldErrors, getPath, HeaderFacet, isActionAvailable, isEditable, MessageButton, MessageProvider, ObjectPageLayout, ShareMenu, SmartField,
  SmartForm, SmartTable, useActionRunner, useColumn, useEditStrategy, useMessages, useObject, useObjectTitle, usePageState, useService, useSmartKit, useText,
  validate, type ExtendEntry, type SectionItem, type TableExtendEntry, type ToolbarAction,
} from '../index';

export interface SmartObjectPageProps {
  /** Entity path, e.g. "Orders('1')". Ignored in create mode. */
  path: string;
  service?: string;
  navigation?: 'anchor' | 'tabs';
  headerActions?: ReactNode;
  /** Message strip under the title (OP-17). */
  headerMessage?: ReactNode | ((row: Row | undefined) => ReactNode);
  /** Insert or replace sections. */
  sectionExtend?: ExtendEntry<SectionItem>[];
  /** Extensions for the sub-table of a navigation. */
  tableExtend?: Record<string, TableExtendEntry[]>;
  /** Extra paths to read (for custom content such as headerMessage). */
  extraSelect?: string[];
  /** Navigation of a sub-table row; default: NavigationAdapter.toObject when the adapter has an object page. */
  onRowNavigate?(row: Row, path: string): void;
  className?: string;
  /** Create mode (OP Create): a new object of this entity set. */
  create?: { entitySet: string; initial?: Row };
  /** After a new object was saved; default NavigationAdapter.toObject. */
  onCreated?(path: string): void;
  /** After the object was deleted; default NavigationAdapter.toList. */
  onDeleted?(): void;
  /** Offer "Edit" (default: when the entity set is updatable and the data provider can write). */
  editable?: boolean;
  /** How sub-objects of a navigation are created while editing (OP Create and edit subobjects). */
  subObjectCreate?: Record<string, 'inline' | 'dialog' | 'none'>;
  /** Key information in the title bar (DP Header Title (4)), e.g. a GenericTag. */
  keyInfo?: ReactNode | ((row: Row | undefined) => ReactNode);
  /** Dynamic side content (OP Dynamic Side Content). */
  sideContent?: ReactNode | ((row: Row | undefined) => ReactNode);
  sideContentTitle?: string;
  /** Paging buttons for sub-object pages (OP Representation of Child Pages; default true). */
  paging?: boolean;
  /** Limit for sub-table previews with "Show All (x)" (default 200). */
  showAllThreshold?: number;
  /** Letterboxing of the page (DP Responsiveness). */
  letterboxing?: boolean;
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

export function SmartObjectPage(p: SmartObjectPageProps) {
  const [navigate, setNavigate] = useState<((m: Message) => void) | undefined>(undefined);
  const register = useCallback((fn: (m: Message) => void) => setNavigate(() => fn), []);
  return (
    <MessageProvider onNavigate={navigate}>
      <ObjectPageInner {...p} registerNavigate={register} />
    </MessageProvider>
  );
}

type Mode = 'display' | 'edit' | 'create';

function ObjectPageInner(p: SmartObjectPageProps & { registerNavigate(fn: (m: Message) => void): void }) {
  const t = useText();
  const service = useService(p.service);
  const model = service.model;
  const { navigation } = useSmartKit();
  const column = useColumn();
  const messages = useMessages()!;
  const queryClient = useQueryClient();
  const creating = Boolean(p.create);
  const createSet = p.create?.entitySet;
  const activePath = useMemo(() => (creating ? '' : siblingPath(model, p.path, true)), [creating, model, p.path]);
  const resolved = useMemo(() => (creating ? undefined : resolveEntityPath(model, activePath)), [creating, model, activePath]);
  const entitySet = createSet ?? resolved!.entitySet;
  const typeName = model.entitySets[entitySet]!.typeName;
  const type = model.entityTypes[typeName]!;
  const setModel = model.entitySets[entitySet]!;
  const draftEnabled = Boolean(setModel.draft);
  const strategy = useEditStrategy(entitySet, p.service);

  // ------------------------------------------------------------------ edit session
  const [mode, setMode] = useState<Mode>(creating ? 'create' : 'display');
  const [session, setSession] = useState<EditSession | null>(null);
  const [values, setValues] = useState<Row>({});
  const [draftStatus, setDraftStatus] = useState<'saving' | 'saved' | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<'discard' | 'delete' | null>(null);
  const [partialEdit, setPartialEdit] = useState(false);
  const editing = mode !== 'display';
  // The draft instance is read while editing a draft (ADR-018).
  const readPath = session?.draft && session.path ? session.path : creating ? '' : p.path;
  const extra = useMemo(() => [...(p.extraSelect ?? []), ...(draftEnabled ? draftSelect(type) : []), ...actionPaths(model.ui[typeName]!.objectActions)], [p.extraSelect, draftEnabled, type, model, typeName]);
  const obj = useObject(readPath || `${entitySet}`, { service: p.service, extraSelect: extra, enabled: Boolean(readPath) });
  const ui = model.ui[typeName]!;
  const data = creating && !session?.draft ? values : obj.data;
  const pageKey = `object:${creating ? `new:${entitySet}` : resolved!.canonical}`;
  const [view, setView] = usePageState<{ headerExpanded?: boolean; pinned?: boolean; section?: string }>(pageKey, {});
  const [counts, setCounts] = useState<Record<string, number | undefined>>({});
  const caps = capabilitiesFor(model, entitySet);
  const canWrite = Boolean(service.dataProvider.update && service.dataProvider.invoke);
  const editable = (p.editable ?? caps.updatable) && canWrite && !creating;
  const deletable = caps.deletable && Boolean(service.dataProvider.remove) && !creating;

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
  // Editable header fields: title, description and header form facets (OP Editing header content).
  const headerFields = useMemo(() => {
    const out: FieldModel[] = [];
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
  }, [ui, type, creating]);

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
      messages.add([...r.messages, { id: `saved-${Date.now()}`, type: 'success', message: creating ? t('create.done') : t('edit.saved'), source: 'server' }]);
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
      messages.add(e instanceof ConcurrencyError ? [{ id: `conflict-${Date.now()}`, type: 'error', message: t('edit.conflict'), source: 'server' }] : messagesFromError(e));
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
    if (headerFields.some((f) => f.path === path) && editing) return '$Header';
    for (const s of ui.sections) for (const sub of s.subSections) if (sub.content.kind === 'form' && sub.content.groups.some((g) => g.fields.some((f) => f.path === path))) return s.id;
    return undefined;
  };
  const focusField = (m: Message) => {
    const path = m.target?.split('/').pop();
    if (!path) return;
    const section = sectionOfField(path);
    if (p.navigation === 'tabs' && section) setView((v) => ({ ...v, section }));
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

  // ------------------------------------------------------------------ header
  const titleValue = ui.headerInfo.title ? getPath(data, ui.headerInfo.title) : undefined;
  const heading = creating && (titleValue === undefined || titleValue === null || titleValue === '')
    ? t('create.title', { type: ui.headerInfo.typeName })
    : titleValue === undefined || titleValue === null || titleValue === '' ? ui.headerInfo.typeName : String(titleValue);
  const subheading = ui.headerInfo.description && data ? (
    <SmartField typeName={typeName} service={p.service} path={ui.headerInfo.description} row={data} />
  ) : undefined;
  const image = ui.headerInfo.imageUrl ? ('path' in ui.headerInfo.imageUrl ? getPath(data, ui.headerInfo.imageUrl.path) : ui.headerInfo.imageUrl.value) : undefined;
  // OP Image Facet: pressing the image enlarges it.
  const [enlarged, setEnlarged] = useState(false);
  const avatar = (size: 'sm' | 'lg') => (image ? (
    <UnstyledButton onClick={() => setEnlarged(true)} aria-label={t('object.enlargeImage', { name: heading })} className="sk-object-avatar__button" data-sk-avatar-enlarge={size}>
      <Avatar src={String(image)} alt={t('object.image', { name: heading })} size={size} radius="md" className="sk-object-avatar" />
    </UnstyledButton>
  ) : undefined);

  // Tab navigation: every tab with a table shows its item count (OP Tab Navigation), also before the tab is opened.
  const countQueries = useMemo(() => (p.navigation !== 'tabs' || creating ? [] : ui.sections.flatMap((s: SectionModel) => s.subSections.flatMap((sub) => {
    if (sub.content.kind !== 'table' || !capabilitiesFor(model, entitySet, sub.content.navigation).countable) return [];
    const keys = model.entityTypes[sub.content.targetType]?.keys ?? [];
    return [{ id: sub.id, navigation: sub.content.navigation, keys }];
  }))), [p.navigation, ui, model, entitySet, creating]);
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
  const sections: SectionItem[] = useMemo(() => {
    const label = (s: { id: string; label: string }) => (s.label || (s.id === DERIVED_GENERAL_SECTION ? t('object.generalInformation') : s.id));
    const out: SectionItem[] = ui.sections.map((s: SectionModel) => {
      const tableTitleLevel = s.subSections.length === 1 ? 3 : 4; // OP Title Styles
      return {
        id: s.id,
        title: label(s),
        subSections: s.subSections.flatMap((sub, index) => {
          const subTitle = label(sub);
          if (sub.content.kind === 'form') {
            const groups = sub.content.groups;
            return [{ id: sub.id, title: subTitle, partOfPreview: editing ? true : sub.partOfPreview, content: <SmartForm typeName={typeName} service={p.service} row={data} groups={groups} showGroupTitles={groups.length > 1} mode={editing ? 'edit' : 'display'} values={formValues} onChange={change} errors={errors} creating={creating} /> }];
          }
          if (sub.content.kind === 'dataPoint') {
            return [{ id: sub.id, title: subTitle, partOfPreview: sub.partOfPreview, content: <HeaderFacet typeName={typeName} service={p.service} row={data} facet={{ id: sub.id, kind: 'dataPoint', label: subTitle, dataPoint: sub.content.dataPoint }} /> }];
          }
          if (sub.content.kind === 'chart') {
            return [{ id: sub.id, title: subTitle, partOfPreview: sub.partOfPreview, content: <HeaderFacet typeName={typeName} service={p.service} row={data} path={readPath} facet={{ id: sub.id, kind: 'chart', label: subTitle, chart: sub.content.chart }} /> }];
          }
          if (creating && !session?.draft) return [];
          const nav = sub.content.navigation;
          const target = targetEntitySet(model, entitySet, nav);
          const last = index === s.subSections.length - 1;
          return [{
            id: sub.id,
            title: subTitle,
            isTable: true,
            lazy: true,
            count: countOf(sub.id),
            partOfPreview: sub.partOfPreview,
            content: (
              <SmartTable
                service={p.service}
                parent={{ path: readPath, navigation: nav }}
                title={subTitle}
                titleLevel={tableTitleLevel}
                pageKey={`${pageKey}:${sub.id}`}
                showSearch
                extend={p.tableExtend?.[nav]}
                onRowNavigate={p.onRowNavigate}
                navigable={p.onRowNavigate ? true : Boolean(target && navigation?.hasObjectPage?.(target, service.name))}
                onCountChange={(c) => setCounts((x) => (x[sub.id] === c ? x : { ...x, [sub.id]: c }))}
                editing={editing}
                createMode={p.subObjectCreate?.[nav] ?? 'inline'}
                onCreated={() => setCounts((x) => ({ ...x, [sub.id]: undefined }))}
                growing={p.navigation === 'tabs' && last ? 'scroll' : 'button'}
                showAllThreshold={p.showAllThreshold}
              />
            ),
          }];
        }),
      };
    });
    // Temporary "Header" section in global edit mode (OP Editing header content in Global Edit mode).
    if (editing && headerFields.length) {
      out.unshift({
        id: '$Header',
        title: t('edit.headerSection'),
        subSections: [{ id: '$Header', title: t('edit.headerSection'), content: <SmartForm typeName={typeName} service={p.service} row={data} groups={[{ id: '$Header', fields: headerFields }]} mode="edit" values={formValues} onChange={change} errors={errors} creating={creating} /> }],
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rebuilt when data, model, mode or counts change
  }, [ui, data, typeName, readPath, p.service, counts, tabCounts, p.tableExtend, navigation, t, editing, formValues, errors, headerFields, creating, session]);

  // Restore the section that was active when the page was left (NAV-04): once, with the value stored at mount.
  const initialSection = useRef(view.section);
  const restored = useRef(false);
  useEffect(() => {
    const id = initialSection.current;
    if (restored.current || !data || !id || p.navigation === 'tabs' || id === sections[0]?.id) return;
    restored.current = true;
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-sk-anchor="${CSS.escape(id)}"]`)?.click());
  }, [data, p.navigation, sections]);

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
  const paging = parentLevel && p.paging !== false && !editing ? (
    <Group gap={2} wrap="nowrap" data-sk-paging>
      <Tooltip label={t('layout.previous')}><ActionIcon variant="subtle" aria-label={t('layout.previous')} disabled={index <= 0} onClick={() => goSibling(-1)} data-sk-paging-previous><ChevronUp className="sk-icon" /></ActionIcon></Tooltip>
      <Tooltip label={t('layout.next')}><ActionIcon variant="subtle" aria-label={t('layout.next')} disabled={index < 0 || index >= (siblings.data?.rows.length ?? 0) - 1} onClick={() => goSibling(1)} data-sk-paging-next><ChevronDown className="sk-icon" /></ActionIcon></Tooltip>
    </Group>
  ) : null;
  const layoutActions = paging || column?.layoutActions ? <>{paging}{column?.layoutActions}</> : undefined;

  // Side content (OP Dynamic Side Content).
  const [sideOpen, setSideOpen] = useState(false);
  const side = typeof p.sideContent === 'function' ? p.sideContent(data) : p.sideContent;

  // Global actions (OP Components (6)): business actions as text buttons, generic ones as icons; overflow right to left.
  const actionItems: ToolbarAction[] = editing ? [] : [
    ...(editable ? [{ id: 'Edit', label: t('actions.edit'), emphasized: true, disabled: busy || !obj.data, onPress: () => void startEdit() }] : []),
    ...(deletable ? [{ id: 'Delete', label: t('actions.delete'), onPress: () => setConfirm('delete') }] : []),
    ...headerModelActions.map((a) => ({ id: a.id, label: a.label, onPress: () => runner.run(a, [objectTarget]) })),
    ...(side ? [{ id: 'SideContent', label: sideOpen ? t('object.hideSideContent') : t('object.showSideContent'), icon: <PanelRight className="sk-icon" />, onPress: () => setSideOpen((o) => !o) }] : []),
    { id: 'Share', label: t('actions.share'), onPress: () => undefined, render: () => <ShareMenu title={heading} href={navigation?.href?.({ kind: 'object', path: activePath, service: service.name })} /> },
  ];

  const message = typeof p.headerMessage === 'function' ? p.headerMessage(data) : p.headerMessage;
  const errorStrip = obj.error && !creating ? (
    <Alert color="red" variant="light" role="alert" data-sk-object-error>
      {'status' in obj.error && (obj.error as { status: number }).status === 404 ? t('object.notFound') : t('object.loadError', { message: obj.error.message })}
    </Alert>
  ) : null;

  // Footer toolbar (OP Footer Toolbar): messages; finalizing actions (Save / Cancel while editing, determining actions in display mode).
  const footer = editing ? (
    <Group justify="space-between" wrap="nowrap" data-sk-footer>
      <Group gap="xs"><MessageButton />{session?.draft && draftStatus ? <Text size="sm" c="dimmed" role="status" data-sk-draft-status>{draftStatus === 'saving' ? t('edit.draftSaving') : t('edit.draftSaved')}</Text> : null}</Group>
      <Group gap="xs" wrap="nowrap">
        <Button onClick={() => void save()} loading={busy} data-sk-save>{creating ? t('actions.create') : t('edit.save')}</Button>
        <Button variant="default" onClick={() => (session?.draft || session?.changed.size || creating ? setConfirm('discard') : void discard())} data-sk-cancel>
          {session?.draft ? t('edit.discardDraft') : t('edit.cancel')}
        </Button>
      </Group>
    </Group>
  ) : footerActions.length || messages.messages.length ? (
    <Group justify="space-between" wrap="nowrap" data-sk-footer>
      <MessageButton />
      <Group gap="xs" wrap="nowrap">
        {footerActions.map((a, i) => <Button key={a.id} variant={i === 0 ? 'filled' : 'default'} onClick={() => runner.run(a, [objectTarget])} data-sk-action={a.id}>{a.label}</Button>)}
      </Group>
    </Group>
  ) : undefined;

  const marker = draftEnabled && (mode === 'edit' || obj.data?.HasDraftEntity === true) ? <DraftMarker row={session?.draft ? { ...obj.data, IsActiveEntity: false, DraftAdministrativeData: { DraftIsCreatedByMe: true, ...(obj.data?.DraftAdministrativeData as Row | undefined) } } : obj.data} /> : undefined;
  const keyInfo = typeof p.keyInfo === 'function' ? p.keyInfo(data) : p.keyInfo;
  const editHeaderButton = !editing && editable && headerFields.length && ui.headerFacets.length ? (
    <Button variant="subtle" size="xs" onClick={() => setPartialEdit(true)} data-sk-edit-header>{t('actions.editHeader')}</Button>
  ) : null;

  return (
    <div ref={rootRef} className="sk-object-page-root" data-mode={mode}>
      <ObjectPageLayout
        className={p.className}
        scope={typeName.replace(/\W/g, '_')}
        heading={heading}
        subheading={subheading}
        breadcrumbs={breadcrumbs}
        avatar={avatar('lg')}
        collapsedAvatar={avatar('sm')}
        actions={p.headerActions}
        actionItems={actionItems}
        keyInfo={keyInfo}
        titleAddon={marker}
        layoutActions={layoutActions}
        headerMessage={errorStrip ?? message}
        facets={ui.headerFacets.length || editHeaderButton ? <>
          {ui.headerFacets.map((f) => <HeaderFacet key={f.id} facet={f} typeName={typeName} service={p.service} row={data} path={readPath || undefined} />)}
          {editHeaderButton ? <div className="sk-object-header__edit">{editHeaderButton}</div> : null}
        </> : undefined}
        sections={obj.error && !creating ? [] : sections}
        extend={p.sectionExtend}
        navigation={p.navigation}
        selectedSection={p.navigation === 'tabs' ? view.section : undefined}
        onSelectedSectionChange={(s) => setView((v) => (v.section === s ? v : { ...v, section: s }))}
        headerExpanded={view.headerExpanded}
        onHeaderExpandedChange={(e) => setView((v) => (v.headerExpanded === e ? v : { ...v, headerExpanded: e }))}
        headerPinned={view.pinned}
        onHeaderPinnedChange={(pin) => setView((v) => ({ ...v, pinned: pin }))}
        footer={footer}
        sideContent={side}
        sideContentOpen={sideOpen}
        sideContentTitle={p.sideContentTitle ?? t('object.sideContent')}
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
      {partialEdit ? <PartialEditDialog path={activePath} row={obj.data} fields={headerFields} typeName={typeName} service={p.service} entitySet={entitySet} onClose={(changed) => { setPartialEdit(false); if (changed) { obj.refresh(); void invalidate(); } }} /> : null}
    </div>
  );
}

/** Partial edit of the header (OP Editing header content in Partial Edit mode): a dialog with the header fields. */
function PartialEditDialog(p: { path: string; row: Row | undefined; fields: FieldModel[]; typeName: string; service?: string; entitySet: string; onClose(changed: boolean): void }) {
  const t = useText();
  const service = useService(p.service);
  const strategy = useEditStrategy(p.entitySet, p.service);
  const [values, setValues] = useState<Row>(() => Object.fromEntries(p.fields.map((f) => [f.path!, p.row?.[f.path!]])));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    const client = validate(service.model, p.typeName, p.fields, values, t);
    setErrors(fieldErrors(client));
    if (client.length || !p.row) return;
    setBusy(true);
    let session: EditSession | undefined;
    try {
      session = await strategy.begin(p.path, p.row);
      for (const f of p.fields) if (values[f.path!] !== p.row[f.path!]) session.set(f.path!, values[f.path!]);
      await session.save();
      p.onClose(true);
    } catch (e) {
      if (session?.draft) await session.cancel().catch(() => undefined);
      const ms = messagesFromError(e);
      const fe = fieldErrors(ms);
      setErrors(Object.keys(fe).length ? fe : { $form: ms.map((m) => m.message).join(' ') });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal opened onClose={() => p.onClose(false)} title={t('actions.editHeader')} data-sk-partial-edit closeButtonProps={{ 'aria-label': t('common.close') }}>
      <form noValidate onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <Stack gap="sm">
          {p.fields.map((f) => (
            <div key={f.id} data-sk-field-path={f.path}>
              <SmartField typeName={p.typeName} service={p.service} field={f} row={values} mode="edit" showLabel value={values[f.path!]} error={errors[f.path!]}
                required={resolvePath(service.model.entityTypes, p.typeName, f.path!).property?.mandatory} onChange={(v) => setValues((x) => ({ ...x, [f.path!]: v }))} />
            </div>
          ))}
          {errors.$form ? <div className="sk-form__error" role="alert">{errors.$form}</div> : null}
          <Group justify="flex-end">
            <Button type="submit" loading={busy} data-sk-partial-save>{t('edit.save')}</Button>
            <Button variant="default" onClick={() => p.onClose(false)}>{t('common.cancel')}</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
