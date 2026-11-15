/**
 * Object page template, built only from public building blocks (AC-BOOT-01): header with facets, anchor or tab
 * navigation, forms and sub-tables from UI.Facets, breadcrumbs for sub-object pages, state restoration.
 */
import { Alert, Anchor, Avatar, Breadcrumbs } from '@mantine/core';
import { DERIVED_GENERAL_SECTION, resolveEntityPath, targetEntitySet, type Row, type SectionModel } from '@rhfan2019/smart-kit-core';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  getPath, HeaderFacet, ObjectPageLayout, SmartField, SmartForm, SmartTable, useObject, useObjectTitle, usePageState, useService, useSmartKit, useText,
  type ExtendEntry, type SectionItem, type TableExtendEntry,
} from '../index';

export interface SmartObjectPageProps {
  /** Entity path, e.g. "Orders('1')". */
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

export function SmartObjectPage(p: SmartObjectPageProps) {
  const t = useText();
  const service = useService(p.service);
  const { navigation } = useSmartKit();
  const obj = useObject(p.path, { service: p.service, extraSelect: p.extraSelect });
  const { ui, typeName, data } = obj;
  const resolved = useMemo(() => resolveEntityPath(service.model, p.path), [service.model, p.path]);
  const pageKey = `object:${resolved.canonical}`;
  const [view, setView] = usePageState<{ headerExpanded?: boolean; pinned?: boolean; section?: string }>(pageKey, {});
  const [counts, setCounts] = useState<Record<string, number | undefined>>({});

  const title = ui.headerInfo.title ? getPath(data, ui.headerInfo.title) : undefined;
  const heading = title === undefined || title === null || title === '' ? ui.headerInfo.typeName : String(title);
  const subheading = ui.headerInfo.description ? (
    <SmartField typeName={typeName} service={p.service} path={ui.headerInfo.description} row={data} />
  ) : undefined;
  const image = ui.headerInfo.imageUrl ? ('path' in ui.headerInfo.imageUrl ? getPath(data, ui.headerInfo.imageUrl.path) : ui.headerInfo.imageUrl.value) : undefined;
  const avatar = (size: 'sm' | 'lg') => (image ? <Avatar src={String(image)} alt={t('object.image', { name: heading })} size={size} radius="md" className="sk-object-avatar" /> : undefined);

  const sections: SectionItem[] = useMemo(() => {
    const label = (s: { id: string; label: string }) => (s.label || (s.id === DERIVED_GENERAL_SECTION ? t('object.generalInformation') : s.id));
    return ui.sections.map((s: SectionModel) => ({
      id: s.id,
      title: label(s),
      subSections: s.subSections.map((sub) => {
        const subTitle = label(sub);
        if (sub.content.kind === 'form') {
          const groups = sub.content.groups;
          return { id: sub.id, title: subTitle, partOfPreview: sub.partOfPreview, content: <SmartForm typeName={typeName} service={p.service} row={data} groups={groups} showGroupTitles={groups.length > 1} /> };
        }
        if (sub.content.kind === 'dataPoint') {
          return { id: sub.id, title: subTitle, partOfPreview: sub.partOfPreview, content: <HeaderFacet typeName={typeName} service={p.service} row={data} facet={{ id: sub.id, kind: 'dataPoint', label: subTitle, dataPoint: sub.content.dataPoint }} /> };
        }
        const nav = sub.content.navigation;
        const target = targetEntitySet(service.model, resolved.entitySet, nav);
        return {
          id: sub.id,
          title: subTitle,
          isTable: true,
          lazy: true,
          count: counts[sub.id],
          partOfPreview: sub.partOfPreview,
          content: (
            <SmartTable
              service={p.service}
              parent={{ path: p.path, navigation: nav }}
              title={subTitle}
              pageKey={`${pageKey}:${sub.id}`}
              showSearch
              extend={p.tableExtend?.[nav]}
              onRowNavigate={p.onRowNavigate}
              navigable={p.onRowNavigate ? true : Boolean(target && navigation?.hasObjectPage?.(target, service.name))}
              onCountChange={(c) => setCounts((x) => (x[sub.id] === c ? x : { ...x, [sub.id]: c }))}
            />
          ),
        };
      }),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rebuilt when data, model or counts change
  }, [ui, data, typeName, p.path, p.service, counts, p.tableExtend, navigation, t]);

  // Restore the active section (NAV-04).
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current || !data || !view.section || p.navigation === 'tabs' || view.section === sections[0]?.id) return;
    restored.current = true;
    const id = view.section;
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-sk-anchor="${CSS.escape(id)}"]`)?.click());
  }, [data, view.section, p.navigation, sections]);

  const crumbs = resolved.levels.slice(0, -1);
  const breadcrumbs = crumbs.length ? (
    <Breadcrumbs aria-label={t('object.breadcrumbs')} separator="/">
      {crumbs.map((l) => <Crumb key={l.path} path={l.path} service={p.service} onClick={() => navigation?.toObject(l.path, service.name)} />)}
    </Breadcrumbs>
  ) : undefined;

  const message = typeof p.headerMessage === 'function' ? p.headerMessage(data) : p.headerMessage;
  const errorStrip = obj.error ? (
    <Alert color="red" variant="light" role="alert" data-sk-object-error>
      {obj.error && 'status' in obj.error && (obj.error as { status: number }).status === 404 ? t('object.notFound') : t('object.loadError', { message: obj.error.message })}
    </Alert>
  ) : null;

  return (
    <ObjectPageLayout
      className={p.className}
      scope={typeName.replace(/\W/g, '_')}
      heading={heading}
      subheading={subheading}
      breadcrumbs={breadcrumbs}
      avatar={avatar('lg')}
      collapsedAvatar={avatar('sm')}
      actions={p.headerActions}
      headerMessage={errorStrip ?? message}
      facets={ui.headerFacets.length ? ui.headerFacets.map((f) => <HeaderFacet key={f.id} facet={f} typeName={typeName} service={p.service} row={data} />) : undefined}
      sections={obj.error ? [] : sections}
      extend={p.sectionExtend}
      navigation={p.navigation}
      selectedSection={p.navigation === 'tabs' ? view.section : undefined}
      onSelectedSectionChange={(s) => setView((v) => (v.section === s ? v : { ...v, section: s }))}
      headerExpanded={view.headerExpanded}
      onHeaderExpandedChange={(e) => setView((v) => (v.headerExpanded === e ? v : { ...v, headerExpanded: e }))}
      headerPinned={view.pinned}
      onHeaderPinnedChange={(pin) => setView((v) => ({ ...v, pinned: pin }))}
    />
  );
}
