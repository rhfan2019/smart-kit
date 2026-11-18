/**
 * sap.uxap.ObjectPageLayout, ObjectPageDynamicHeaderTitle and ObjectPageDynamicHeaderContent (ADR-033): dynamic header,
 * anchor or tab navigation, sections and subsections with title de-duplication, "Show More", lazy loading (OP-01–OP-17).
 * Sections are a view model (`sections`), so that custom sections can be inserted anywhere (`extend`).
 */
import { Button, Skeleton } from '@mantine/core';
import { isValidElement, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode, type Ref } from 'react';
import { useText } from '../context/SmartKitProvider';
import type { BackgroundDesign } from '../controls/dialogs/IconTabBar';
import { preventable, type PreventableEvent } from '../controls/types';
import { DynamicPage, DynamicPageHeader, DynamicPageTitle, useDynamicPage, type $DynamicPageHeaderSettings, type $DynamicPageTitleSettings, type DynamicPage$BreakpointChangeEvent } from '../page/DynamicPage';
import { landmarkProps, objectPageLandmarks, PageLandmarkOverride, type $ObjectPageAccessibleLandmarkInfoSettings, type FormattedLandmark } from '../page/landmarks';
import { applyExtensions, type ExtendEntry } from '../util/extend';
import { SectionBar } from './AnchorBar';
import { scrollParent } from './scroll';
import { SECTION_ELEMENT_ID, useSectionScrollSpy } from './useSectionScrollSpy';

/** sap.uxap.Importance */
export type Importance = 'High' | 'Medium' | 'Low';
export const Importance = { High: 'High', Medium: 'Medium', Low: 'Low' } as const;

/** sap.uxap.ObjectPageSubSectionLayout */
export type ObjectPageSubSectionLayout = 'TitleOnTop' | 'TitleOnLeft';
export const ObjectPageSubSectionLayout = { TitleOnTop: 'TitleOnTop', TitleOnLeft: 'TitleOnLeft' } as const;

/** sap.ui.core.TitleLevel */
type TitleLevel = 'Auto' | 'H1' | 'H2' | 'H3' | 'H4' | 'H5' | 'H6';

/** A layout block of a subsection (OP Blocks): occupies 1, 2 or 3 columns, or fewer when fewer are available. */
export interface BlockItem {
  id: string;
  columns: 1 | 2 | 3;
  content: ReactNode;
  /** Shown only after "Show More" (the subsection's moreBlocks). */
  more?: boolean;
}

export interface SubSectionItem {
  id: string;
  title: string;
  count?: number;
  /** The content is a single table: its toolbar carries the title (OP-12 ③ ④). */
  isTable?: boolean;
  content?: ReactNode;
  /** Layout blocks instead of (or after) `content`. */
  blocks?: BlockItem[];
  /** False: content is behind "Show More" (UI.PartOfPreview = false). */
  partOfPreview?: boolean;
  actions?: ReactNode;
  /** Render only when scrolled near (tables), with `enableLazyLoading`. */
  lazy?: boolean;
  /** With `showOnlyHighImportance` only High is shown (default High). */
  importance?: Importance;
}

export interface SectionItem {
  id: string;
  title: string;
  subSections: SubSectionItem[];
  /** Message strip at the top of the section, above its title (OP-17). */
  messageStrip?: ReactNode;
  /** With `showOnlyHighImportance` only High is shown (default High). */
  importance?: Importance;
}

/** sap.uxap.ObjectPageDynamicHeaderTitle: the same title as DynamicPageTitle. */
export type $ObjectPageDynamicHeaderTitleSettings = $DynamicPageTitleSettings;
/** Event object of ObjectPageDynamicHeaderTitle's stateChange. */
export interface ObjectPageDynamicHeaderTitle$StateChangeEvent {
  /** True when the header is now expanded. */
  isExpanded: boolean;
}
/** sap.uxap.ObjectPageDynamicHeaderTitle (rendered by the ObjectPageLayout it is given to as `headerTitle`). */
export function ObjectPageDynamicHeaderTitle(p: $ObjectPageDynamicHeaderTitleSettings) {
  return <DynamicPageTitle {...p} />;
}

/** sap.uxap.ObjectPageDynamicHeaderContent: the same as DynamicPageHeader. */
export type $ObjectPageDynamicHeaderContentSettings = $DynamicPageHeaderSettings;
/** sap.uxap.ObjectPageDynamicHeaderContent. */
export function ObjectPageDynamicHeaderContent(p: $ObjectPageDynamicHeaderContentSettings) {
  return <DynamicPageHeader {...p} />;
}

export interface $ObjectPageLayoutSettings {
  /** The sections. */
  sections: SectionItem[];
  /** The title, an ObjectPageDynamicHeaderTitle. */
  headerTitle?: ReactNode;
  /** Header content (header facets, the avatar). */
  headerContent?: ReactNode;
  /** Footer toolbar content (e.g. Save / Cancel while editing); shown with `showFooter`. */
  footer?: ReactNode;
  /** Id of the selected section (with `useIconTabBar`: the tab shown). */
  selectedSection?: string;
  /** Shows the anchor bar. @defaultValue true */
  showAnchorBar?: boolean;
  /** Anchors of sections with several subsections open a menu of the subsections. @defaultValue true */
  showAnchorBarPopover?: boolean;
  /** Anchor texts in upper case. @defaultValue true */
  upperCaseAnchorBar?: boolean;
  /** Background of the anchor bar. */
  backgroundDesignAnchorBar?: BackgroundDesign;
  /** Subsections marked `lazy` render only when scrolled near. @defaultValue false */
  enableLazyLoading?: boolean;
  /** Subsection titles above or left of their content. @defaultValue 'TitleOnTop' */
  subSectionLayout?: ObjectPageSubSectionLayout;
  /** Heading level of the section titles (subsection titles one below); Auto: H2. @defaultValue 'Auto' */
  sectionTitleLevel?: TitleLevel;
  /** One section at a time, with a tab bar instead of the anchor bar. @defaultValue false */
  useIconTabBar?: boolean;
  /** Shows the header content. @defaultValue true */
  showHeaderContent?: boolean;
  /** Blocks use two columns instead of three on large screens. @defaultValue false */
  useTwoColumnsForLargeScreen?: boolean;
  /** No effect with ObjectPageDynamicHeaderTitle (as in SAPUI5: only for the classic ObjectPageHeader). @defaultValue false */
  showTitleInHeaderContent?: boolean;
  /** Hides sections and subsections whose importance is not High. @defaultValue false */
  showOnlyHighImportance?: boolean;
  /** A child page: a stripe left of the header content. @defaultValue false */
  isChildPage?: boolean;
  /** No effect with ObjectPageDynamicHeaderTitle (as in SAPUI5: only for the classic ObjectPageHeader). @defaultValue false */
  alwaysShowContentHeader?: boolean;
  /** Offers the pin button for the header content. @defaultValue true */
  headerContentPinnable?: boolean;
  /** The header content is pinned; without it the page keeps the state itself. @defaultValue false */
  headerContentPinned?: boolean;
  /** Clicking the title bar expands or collapses the header. @defaultValue true */
  toggleHeaderOnTitleClick?: boolean;
  /** The header keeps its state while scrolling (no snap on scroll, no pin). @defaultValue false */
  preserveHeaderStateOnScroll?: boolean;
  /** Shows an "Edit Header" button in the header content (fires onEditHeaderButtonPress). @defaultValue false */
  showEditHeaderButton?: boolean;
  /** Shows the footer. @defaultValue false */
  showFooter?: boolean;
  /** Fired when the pin button is pressed. */
  onHeaderContentPinnedStateChange?(e: ObjectPageLayout$HeaderContentPinnedStateChangeEvent): void;
  /** Fired when the anchor bar becomes fixed under the snapped title, or moves with the header again. */
  onToggleAnchorBar?(e: ObjectPageLayout$ToggleAnchorBarEvent): void;
  /** Fired when the current section changes (scrolling, or another tab). */
  onSectionChange?(e: ObjectPageLayout$SectionChangeEvent): void;
  /** Fired when the "Edit Header" button is pressed. */
  onEditHeaderButtonPress?(e: Record<string, never>): void;
  /** Fired before navigating to a section chosen in the anchor bar or tab bar; preventDefault() cancels it. */
  onBeforeNavigate?(e: ObjectPageLayout$BeforeNavigateEvent): void;
  /** Fired when a section is chosen in the anchor bar or tab bar. */
  onNavigate?(e: ObjectPageLayout$NavigateEvent): void;
  /** Fired when the subsections in view change. */
  onSubSectionVisibilityChange?(e: ObjectPageLayout$SubSectionVisibilityChangeEvent): void;
  /** Fired when the page width moves into another media range. */
  onBreakpointChange?(e: ObjectPageLayout$BreakpointChangeEvent): void;
  /** ARIA landmark roles and labels of the page's containers, an ObjectPageAccessibleLandmarkInfo; without it main, banner and region with default labels. */
  landmarkInfo?: ReactNode;
  /** Extension: unique scope for element ids (e.g. the entity type). */
  scope: string;
  /** Extension: insert, replace or remove sections (ids as in the model). */
  extend?: ExtendEntry<SectionItem>[];
  /** Extension: message strip between title and header content (OP-17). */
  headerMessage?: ReactNode;
  /** Extension: the header is expanded (state restoration); without it the page keeps the state itself. */
  headerExpanded?: boolean;
  /** Extension: dynamic side content (OP Dynamic Side Content): contextual information on the right. */
  sideContent?: ReactNode;
  /** Extension: shows the side content. */
  sideContentOpen?: boolean;
  /** Extension: title of the side content. */
  sideContentTitle?: string;
  /** Extension: limits the page content to 1280px. */
  letterboxing?: boolean;
  /** Extra CSS class on the root element. */
  className?: string;
  ref?: Ref<ObjectPageLayout>;
}

/** Event object of ObjectPageLayout's headerContentPinnedStateChange. */
export interface ObjectPageLayout$HeaderContentPinnedStateChangeEvent {
  /** True when the header content is now pinned. */
  pinned: boolean;
}
/** Event object of ObjectPageLayout's toggleAnchorBar. */
export interface ObjectPageLayout$ToggleAnchorBarEvent {
  /** True: the anchor bar is fixed under the snapped title; false: it moves with the header. */
  fixed: boolean;
}
/** Event object of ObjectPageLayout's sectionChange. */
export interface ObjectPageLayout$SectionChangeEvent {
  /** Id of the section. */
  section: string;
  /** Id of the subsection, when one was chosen. */
  subSection?: string;
}
/** Event object of ObjectPageLayout's beforeNavigate. */
export type ObjectPageLayout$BeforeNavigateEvent = PreventableEvent<{
  /** Id of the section. */
  section: string;
  /** Id of the subsection, when one was chosen. */
  subSection?: string;
}>;
/** Event object of ObjectPageLayout's navigate. */
export interface ObjectPageLayout$NavigateEvent {
  /** Id of the section. */
  section: string;
  /** Id of the subsection, when one was chosen. */
  subSection?: string;
}
/** Event object of ObjectPageLayout's subSectionVisibilityChange. */
export interface ObjectPageLayout$SubSectionVisibilityChangeEvent {
  /** The subsections in view, by id. */
  visibleSubSections: Record<string, SubSectionItem>;
}
/** Event object of ObjectPageLayout's breakpointChange. */
export type ObjectPageLayout$BreakpointChangeEvent = DynamicPage$BreakpointChangeEvent;

/** Instance methods of ObjectPageLayout. */
export interface ObjectPageLayout {
  /** Id of the section currently in view (with `useIconTabBar`: the tab shown). */
  getScrollingSectionId(): string | undefined;
  /** Scrolls to a section or subsection (id); the scroll ends under the sticky title (`iDuration`, `iOffset` are not used). */
  scrollToSection(sId: string, iDuration?: number, iOffset?: number): void;
}

const LEVELS = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6'] as const;
type Heading = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
const tagOf = (level: TitleLevel | undefined, down: number): Heading => {
  const i = Math.min(5, (level && level !== 'Auto' ? LEVELS.indexOf(level) : 1) + down);
  return `h${i + 1}` as Heading;
};

function Lazy({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(typeof IntersectionObserver === 'undefined');
  useEffect(() => {
    if (visible || !ref.current) return;
    const near = () => ref.current && ref.current.getBoundingClientRect().top < window.innerHeight + 200;
    if (near()) { setVisible(true); return; }
    const onScroll = () => { if (near()) setVisible(true); };
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    const obs = new IntersectionObserver(([e]) => { if (e!.isIntersecting) setVisible(true); }, { rootMargin: '200px 0px' });
    obs.observe(ref.current);
    return () => { obs.disconnect(); document.removeEventListener('scroll', onScroll, { capture: true }); };
  }, [visible]);
  return <div ref={ref} className="sk-lazy">{visible ? children : <Skeleton height={120} radius="md" aria-busy />}</div>;
}

interface ViewOptions { scope: string; lazy: boolean; level: TitleLevel | undefined }

function SubSectionView({ o, sectionId, sub, showTitle }: { o: ViewOptions; sectionId: string; sub: SubSectionItem; showTitle: boolean }) {
  const t = useText();
  const [more, setMore] = useState(false);
  const hidden = sub.partOfPreview === false && !more;
  const hasMoreBlocks = Boolean(sub.blocks?.some((b) => b.more));
  const blocks = sub.blocks?.length ? (
    <div className="sk-blocks" data-sk-blocks>
      {sub.blocks.filter((b) => more || !b.more).map((b) => (
        <div key={b.id} className={`sk-block sk-block--${b.columns}`} data-sk-block={b.id} data-columns={b.columns}>{b.content}</div>
      ))}
    </div>
  ) : null;
  const content = <>{sub.lazy && o.lazy ? <Lazy>{sub.content}</Lazy> : sub.content}{blocks}</>;
  const Title = tagOf(o.level, 1);
  return (
    <div className="sk-subsection" id={SECTION_ELEMENT_ID(o.scope, `${sectionId}::sub::${sub.id}`)} tabIndex={-1} data-sk-subsection={sub.id}>
      {showTitle && !sub.isTable ? (
        <div className="sk-subsection__header">
          <Title className="sk-subsection__title">{sub.count === undefined ? sub.title : `${sub.title} (${sub.count})`}</Title>
          {sub.actions ? <div className="sk-subsection__actions">{sub.actions}</div> : null}
        </div>
      ) : null}
      {hidden ? null : content}
      {sub.partOfPreview === false || hasMoreBlocks ? (
        <div className="sk-subsection__more">
          <Button variant="subtle" size="xs" onClick={() => setMore(!more)} aria-expanded={more} data-sk-show-more>
            {more ? t('object.showLess') : t('object.showMore')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function SectionView({ o, section, tabs }: { o: ViewOptions; section: SectionItem; tabs: boolean }) {
  const single = section.subSections.length === 1;
  const onlyTable = single && section.subSections[0]!.isTable;
  // OP-12: one subsection → its title is promoted (no separate subsection title); a lone table carries the title itself.
  const showSectionTitle = !tabs && !onlyTable;
  const Title = tagOf(o.level, 0);
  return (
    <section className="sk-section" id={SECTION_ELEMENT_ID(o.scope, section.id)} tabIndex={-1} aria-label={section.title} data-sk-section={section.id}>
      {section.messageStrip ? <div className="sk-section__message">{section.messageStrip}</div> : null}
      {showSectionTitle ? <Title className="sk-section__title">{section.title}</Title> : null}
      <div className="sk-section__body">
        {section.subSections.map((sub) => (
          <SubSectionView key={sub.id} o={o} sectionId={section.id} sub={sub} showTitle={!single} />
        ))}
      </div>
    </section>
  );
}

interface NavApi { select(sectionId: string, sub?: string): void; active(): string | undefined }

interface NavProps {
  scope: string;
  sections: SectionItem[];
  tabs: boolean;
  tab: string | undefined;
  popover: boolean;
  upperCase: boolean;
  backgroundDesign?: BackgroundDesign;
  visible: boolean;
  api: React.RefObject<NavApi | null>;
  onTab(id: string): void;
  /** The user chose a section: false when beforeNavigate was prevented. */
  onChoose(section: string, subSection?: string): boolean;
  onActive(id: string): void;
  onFixed(fixed: boolean): void;
  /** Navigation landmark of the landmark info. */
  landmark?: FormattedLandmark;
}

/** Anchor bar rendered inside DynamicPage, so that anchors can collapse the header before scrolling. */
function SectionNavigation({ scope, sections, tabs, tab, popover, upperCase, backgroundDesign, visible, api, onTab, onChoose, onActive, onFixed, landmark }: NavProps) {
  const ids = sections.map((s) => s.id);
  const spy = useSectionScrollSpy(scope, ids, !tabs);
  const page = useDynamicPage();
  const report = useRef(onActive);
  report.current = onActive;
  useEffect(() => { if (!tabs && spy.active) report.current(spy.active); }, [tabs, spy.active]);
  const fixed = useRef(onFixed);
  fixed.current = onFixed;
  const collapsed = Boolean(page?.collapsed);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    fixed.current(collapsed);
  }, [collapsed]);
  const items = sections.map((s) => ({
    id: s.id,
    title: s.title,
    count: s.subSections.length === 1 ? s.subSections[0]!.count : undefined,
    subSections: s.subSections.map((x) => ({ id: x.id, title: x.title })),
  }));
  const select = (sectionId: string, sub?: string) => {
    if (tabs) {
      // Switching tabs keeps the header as it is. A header collapsed by scrolling stays collapsed, and the new tab
      // starts at its top, right under the tab bar.
      const wasCollapsed = Boolean(page?.collapsed);
      if (wasCollapsed && page?.expanded) page.setExpanded(false);
      onTab(sectionId);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (sub) return spy.scrollTo(`${sectionId}::sub::${sub}`);
        if (wasCollapsed) {
          const bar = document.querySelector(`[data-testid="object-${CSS.escape(scope)}"] .sk-dynamic-page__navigation`);
          const container = scrollParent(bar);
          container.scrollTo({ top: 0 });
        }
      }));
      return;
    }
    spy.scrollTo(sub ? `${sectionId}::sub::${sub}` : sectionId);
  };
  api.current = { select, active: () => (tabs ? tab : spy.active) };
  if (!visible) return null;
  return (
    <SectionBar
      content={items} selectedButton={tabs ? tab : spy.active} tabs={tabs} landmark={landmark} showPopover={popover} upperCase={upperCase} backgroundDesign={backgroundDesign}
      onSelect={(s, sub) => { if (onChoose(s, sub)) select(s, sub); }}
    />
  );
}

export function ObjectPageLayout(p: $ObjectPageLayoutSettings) {
  const t = useText();
  const all = useMemo(() => applyExtensions(p.sections, p.extend, 'ObjectPageLayout sections'), [p.sections, p.extend]);
  const sections = useMemo(() => (p.showOnlyHighImportance
    ? all.filter((s) => (s.importance ?? 'High') === 'High').map((s) => ({ ...s, subSections: s.subSections.filter((x) => (x.importance ?? 'High') === 'High') })).filter((s) => s.subSections.length)
    : all), [all, p.showOnlyHighImportance]);
  const ids = sections.map((s) => s.id);
  const tabs = Boolean(p.useIconTabBar);
  const [ownTab, setOwnTab] = useState<string | undefined>(undefined);
  const tab = (p.selectedSection && ids.includes(p.selectedSection) ? p.selectedSection : undefined) ?? ownTab ?? ids[0];
  const latest = useRef(p);
  latest.current = p;
  const onTab = (id: string) => { setOwnTab(id); latest.current.onSectionChange?.({ section: id }); };
  const onActive = (id: string) => latest.current.onSectionChange?.({ section: id });
  const onChoose = (section: string, subSection?: string) => {
    const e = preventable({ section, subSection });
    latest.current.onBeforeNavigate?.(e);
    if (e.defaultPrevented) return false;
    latest.current.onNavigate?.({ section, subSection });
    return true;
  };
  const nav = useRef<NavApi | null>(null);
  useImperativeHandle(p.ref, () => ({
    getScrollingSectionId: () => nav.current?.active() ?? (tabs ? tab : ids[0]),
    scrollToSection: (sId) => {
      const owner = sections.find((s) => s.id === sId) ?? sections.find((s) => s.subSections.some((x) => x.id === sId));
      if (!owner) return;
      nav.current?.select(owner.id, owner.id === sId ? undefined : sId);
    },
  }));

  // Anchor navigation: a spacer after the last section lets every section scroll up to the anchor bar, also when the
  // content is shorter than the window (as the UI5 object page does).
  const sectionsRef = useRef<HTMLDivElement>(null);
  const [spacer, setSpacer] = useState(0);
  useEffect(() => {
    const el = sectionsRef.current;
    if (tabs || !el) { setSpacer(0); return; }
    const compute = () => {
      const all = el.querySelectorAll<HTMLElement>('[data-sk-section]');
      const last = all[all.length - 1];
      const page = el.closest('.sk-dynamic-page');
      if (!last || !page) return setSpacer(0);
      const container = scrollParent(el);
      const viewport = container instanceof Window ? window.innerHeight : container.clientHeight;
      const sticky = (page.querySelector<HTMLElement>('.sk-dynamic-page__sticky')?.offsetHeight ?? 0) + (page.querySelector<HTMLElement>('.sk-dynamic-page__navigation')?.offsetHeight ?? 0);
      const content = page.querySelector<HTMLElement>('.sk-dynamic-page__content');
      const style = content ? getComputedStyle(content) : undefined;
      const padBottom = style ? (parseFloat(style.paddingBottom) || 0) + (parseFloat(style.rowGap) || 0) : 0; // the spacer follows after a gap
      const footer = page.querySelector<HTMLElement>('.sk-dynamic-page__footer')?.offsetHeight ?? 0;
      const fromLast = last.getBoundingClientRect().bottom - last.getBoundingClientRect().top;
      const next = Math.max(0, Math.ceil(viewport - sticky - fromLast - padBottom - footer));
      setSpacer((s) => (Math.abs(s - next) > 1 ? next : s));
    };
    compute();
    const ro = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(compute);
    ro?.observe(el);
    const sticky = el.closest('.sk-dynamic-page')?.querySelector('.sk-dynamic-page__sticky');
    if (ro && sticky) ro.observe(sticky);
    window.addEventListener('resize', compute);
    return () => { ro?.disconnect(); window.removeEventListener('resize', compute); };
  }, [tabs, sections.length]);

  // subSectionVisibilityChange: the subsections in view.
  const subKey = sections.map((s) => `${s.id}:${s.subSections.map((x) => x.id).join(',')}`).join('|');
  useEffect(() => {
    const el = sectionsRef.current;
    if (!el || typeof IntersectionObserver === 'undefined' || !latest.current.onSubSectionVisibilityChange) return;
    const byId = new Map(sections.flatMap((s) => s.subSections.map((x) => [x.id, x] as const)));
    const inView = new Set<string>();
    const obs = new IntersectionObserver((entries) => {
      let changed = false;
      for (const e of entries) {
        const id = (e.target as HTMLElement).dataset.skSubsection!;
        if (e.isIntersecting && !inView.has(id)) { inView.add(id); changed = true; }
        if (!e.isIntersecting && inView.has(id)) { inView.delete(id); changed = true; }
      }
      if (changed) latest.current.onSubSectionVisibilityChange?.({ visibleSubSections: Object.fromEntries([...inView].flatMap((id) => (byId.has(id) ? [[id, byId.get(id)!]] : []))) });
    });
    el.querySelectorAll<HTMLElement>('[data-sk-subsection]').forEach((n) => obs.observe(n));
    return () => obs.disconnect();
  }, [subKey, tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const sideOpen = p.sideContentOpen ?? false;
  const editHeader = p.showEditHeaderButton ? (
    <div className="sk-object-header__edit">
      <Button variant="subtle" size="xs" onClick={() => latest.current.onEditHeaderButtonPress?.({})} data-sk-edit-header>{t('actions.editHeader')}</Button>
    </div>
  ) : null;
  const header = (p.headerContent || editHeader) && p.showHeaderContent !== false ? (
    <DynamicPageHeader pinnable={p.headerContentPinnable !== false}>
      <div className="sk-object-header">{p.headerContent}{editHeader}</div>
    </DynamicPageHeader>
  ) : undefined;
  const o: ViewOptions = { scope: p.scope, lazy: Boolean(p.enableLazyLoading), level: p.sectionTitleLevel };
  // Landmarks (sap.uxap.ObjectPageLayoutRenderer): the header label carries the title text.
  const heading = isValidElement(p.headerTitle) ? (p.headerTitle.props as $ObjectPageDynamicHeaderTitleSettings).heading : undefined;
  const titleText = typeof heading === 'string' || typeof heading === 'number' ? String(heading) : undefined;
  const lm = objectPageLandmarks(landmarkProps<$ObjectPageAccessibleLandmarkInfoSettings>(p.landmarkInfo), {
    root: t('object.rootLabel'), header: titleText ? t('object.headerLabelWithTitle', { title: titleText }) : t('object.headerLabel'),
    footer: t('object.footerLabel'), navigation: t('object.sections'),
  });

  const page = (
    <PageLandmarkOverride.Provider value={lm}>
    <DynamicPage
      className={[
        'sk-object-page', tabs ? 'sk-object-page--tabs' : '', p.subSectionLayout === 'TitleOnLeft' ? 'sk-object-page--title-on-left' : '',
        p.useTwoColumnsForLargeScreen ? 'sk-object-page--two-columns' : '', p.isChildPage ? 'sk-object-page--child' : '', p.className,
      ].filter(Boolean).join(' ')}
      letterboxing={p.letterboxing}
      title={p.headerTitle}
      titleMessage={p.headerMessage}
      header={header}
      preserveHeaderStateOnScroll={p.preserveHeaderStateOnScroll}
      toggleHeaderOnTitleClick={p.toggleHeaderOnTitleClick}
      headerExpanded={p.headerExpanded}
      headerPinned={p.headerContentPinned}
      onPinnedStateChange={(e) => latest.current.onHeaderContentPinnedStateChange?.(e)}
      onBreakpointChange={(e) => latest.current.onBreakpointChange?.(e)}
      stickySubheaderProvider={sections.length > 1 || tabs ? (
        <SectionNavigation
          scope={p.scope} sections={sections} tabs={tabs} tab={tab} popover={p.showAnchorBarPopover !== false} upperCase={p.upperCaseAnchorBar !== false}
          backgroundDesign={p.backgroundDesignAnchorBar} visible={p.showAnchorBar !== false || tabs} api={nav}
          onTab={onTab} onChoose={onChoose} onActive={onActive} onFixed={(fixed) => latest.current.onToggleAnchorBar?.({ fixed })} landmark={lm.navigation}
        />
      ) : undefined}
      footer={p.footer}
      showFooter={p.showFooter}
      data-testid={`object-${p.scope}`}
      content={(
        <>
          <div className="sk-object-page__sections" ref={sectionsRef}>
            {(tabs ? sections.filter((s) => s.id === tab) : sections).map((s) => (
              <SectionView key={s.id} o={o} section={s} tabs={tabs} />
            ))}
          </div>
          {!tabs && spacer > 0 ? <div className="sk-object-page__spacer" style={{ height: spacer }} aria-hidden data-sk-spacer /> : null}
        </>
      )}
    />
    </PageLandmarkOverride.Provider>
  );
  if (!p.sideContent) return page;
  return (
    <div className="sk-object-page-wrap" data-side-open={sideOpen || undefined}>
      <div className="sk-object-page-wrap__main">{page}</div>
      {sideOpen ? (
        <aside className="sk-side-content" aria-label={p.sideContentTitle} data-sk-side-content>
          {p.sideContentTitle ? <h2 className="sk-side-content__title">{p.sideContentTitle}</h2> : null}
          {p.sideContent}
        </aside>
      ) : null}
    </div>
  );
}
