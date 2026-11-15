/**
 * ObjectPageLayout: dynamic header, anchor or tab navigation, sections and subsections with title de-duplication,
 * "Show More", lazy loading (OP-01–OP-17). Sections are a view model so custom sections can be inserted anywhere.
 */
import { Button, Skeleton } from '@mantine/core';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useText } from '../context/SmartKitProvider';
import { DynamicPage, useDynamicPage } from '../page/DynamicPage';
import { applyExtensions, type ExtendEntry } from '../util/extend';
import { AnchorBar } from './AnchorBar';
import { scrollParent } from './scroll';
import { SECTION_ELEMENT_ID, useSectionScrollSpy } from './useSectionScrollSpy';

export interface SubSectionItem {
  id: string;
  title: string;
  count?: number;
  /** The content is a single table: its toolbar carries the title (OP-12 ③ ④). */
  isTable?: boolean;
  content: ReactNode;
  /** False: content is behind "Show More" (UI.PartOfPreview = false). */
  partOfPreview?: boolean;
  actions?: ReactNode;
  /** Render only when scrolled near (tables). */
  lazy?: boolean;
}

export interface SectionItem {
  id: string;
  title: string;
  subSections: SubSectionItem[];
  /** Message strip at the top of the section, above its title (OP-17). */
  messageStrip?: ReactNode;
}

export interface ObjectPageLayoutProps {
  /** Unique scope for element ids (e.g. the entity type). */
  scope: string;
  heading: ReactNode;
  subheading?: ReactNode;
  breadcrumbs?: ReactNode;
  avatar?: ReactNode;
  collapsedAvatar?: ReactNode;
  actions?: ReactNode;
  /** Header facets. */
  facets?: ReactNode;
  /** Message strip between title and header content (OP-17). */
  headerMessage?: ReactNode;
  sections: SectionItem[];
  extend?: ExtendEntry<SectionItem>[];
  navigation?: 'anchor' | 'tabs';
  selectedSection?: string;
  onSelectedSectionChange?(id: string): void;
  headerExpanded?: boolean;
  onHeaderExpandedChange?(v: boolean): void;
  headerPinned?: boolean;
  onHeaderPinnedChange?(v: boolean): void;
  footer?: ReactNode;
  className?: string;
}

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

function SubSectionView({ scope, sectionId, sub, showTitle }: { scope: string; sectionId: string; sub: SubSectionItem; showTitle: boolean }) {
  const t = useText();
  const [more, setMore] = useState(false);
  const hidden = sub.partOfPreview === false && !more;
  const content = sub.lazy ? <Lazy>{sub.content}</Lazy> : sub.content;
  return (
    <div className="sk-subsection" id={SECTION_ELEMENT_ID(scope, `${sectionId}::sub::${sub.id}`)} tabIndex={-1} data-sk-subsection={sub.id}>
      {showTitle && !sub.isTable ? (
        <div className="sk-subsection__header">
          <h3 className="sk-subsection__title">{sub.count === undefined ? sub.title : `${sub.title} (${sub.count})`}</h3>
          {sub.actions ? <div className="sk-subsection__actions">{sub.actions}</div> : null}
        </div>
      ) : null}
      {hidden ? null : content}
      {sub.partOfPreview === false ? (
        <div className="sk-subsection__more">
          <Button variant="subtle" size="xs" onClick={() => setMore(!more)} aria-expanded={more} data-sk-show-more>
            {more ? t('object.showLess') : t('object.showMore')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function SectionView({ scope, section, tabs }: { scope: string; section: SectionItem; tabs: boolean }) {
  const single = section.subSections.length === 1;
  const onlyTable = single && section.subSections[0]!.isTable;
  // OP-12: one subsection → its title is promoted (no separate subsection title); a lone table carries the title itself.
  const showSectionTitle = !tabs && !onlyTable;
  return (
    <section className="sk-section" id={SECTION_ELEMENT_ID(scope, section.id)} tabIndex={-1} aria-label={section.title} data-sk-section={section.id}>
      {section.messageStrip ? <div className="sk-section__message">{section.messageStrip}</div> : null}
      {showSectionTitle ? <h2 className="sk-section__title">{section.title}</h2> : null}
      <div className="sk-section__body">
        {section.subSections.map((sub) => (
          <SubSectionView key={sub.id} scope={scope} sectionId={section.id} sub={sub} showTitle={!single} />
        ))}
      </div>
    </section>
  );
}

interface NavProps {
  scope: string;
  sections: SectionItem[];
  tabs: boolean;
  tab: string | undefined;
  onTab(id: string): void;
  onActive(id: string): void;
}

/** Anchor bar rendered inside DynamicPage, so that anchors can collapse the header before scrolling. */
function SectionNavigation({ scope, sections, tabs, tab, onTab, onActive }: NavProps) {
  const ids = sections.map((s) => s.id);
  const spy = useSectionScrollSpy(scope, ids, !tabs);
  const page = useDynamicPage();
  const report = useRef(onActive);
  report.current = onActive;
  useEffect(() => { if (!tabs && spy.active) report.current(spy.active); }, [tabs, spy.active]);
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
      const collapsed = Boolean(page?.collapsed);
      if (collapsed && page?.expanded) page.setExpanded(false);
      onTab(sectionId);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (sub) return spy.scrollTo(`${sectionId}::sub::${sub}`);
        if (collapsed) {
          const bar = document.querySelector(`[data-testid="object-${CSS.escape(scope)}"] .sk-dynamic-page__navigation`);
          const container = scrollParent(bar);
          container.scrollTo({ top: 0 });
        }
      }));
      return;
    }
    spy.scrollTo(sub ? `${sectionId}::sub::${sub}` : sectionId);
  };
  return <AnchorBar items={items} active={tabs ? tab : spy.active} onSelect={select} tabs={tabs} />;
}

export function ObjectPageLayout(p: ObjectPageLayoutProps) {
  const sections = useMemo(() => applyExtensions(p.sections, p.extend, 'ObjectPageLayout sections'), [p.sections, p.extend]);
  const ids = sections.map((s) => s.id);
  const tabs = p.navigation === 'tabs';
  const [ownTab, setOwnTab] = useState<string | undefined>(undefined);
  const tab = (p.selectedSection && ids.includes(p.selectedSection) ? p.selectedSection : undefined) ?? ownTab ?? ids[0];
  const changed = useRef(p.onSelectedSectionChange);
  changed.current = p.onSelectedSectionChange;
  const onTab = (id: string) => { setOwnTab(id); changed.current?.(id); };
  const onActive = (id: string) => changed.current?.(id);

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

  const header = p.facets || p.avatar ? (
    <div className="sk-object-header">
      {p.avatar ? <div className="sk-object-header__avatar">{p.avatar}</div> : null}
      <div className="sk-object-header__facets">{p.facets}</div>
    </div>
  ) : undefined;

  return (
    <DynamicPage
      className={['sk-object-page', tabs ? 'sk-object-page--tabs' : '', p.className].filter(Boolean).join(' ')}
      heading={p.heading}
      subheading={p.subheading}
      breadcrumbs={p.breadcrumbs}
      collapsedAvatar={p.collapsedAvatar}
      actions={p.actions}
      titleMessage={p.headerMessage}
      header={header}
      snapOnScroll
      headerExpanded={p.headerExpanded}
      onHeaderExpandedChange={p.onHeaderExpandedChange}
      pinned={p.headerPinned}
      onPinnedChange={p.onHeaderPinnedChange}
      navigation={sections.length > 1 || tabs ? <SectionNavigation scope={p.scope} sections={sections} tabs={tabs} tab={tab} onTab={onTab} onActive={onActive} /> : undefined}
      footer={p.footer}
      data-testid={`object-${p.scope}`}
    >
      <div className="sk-object-page__sections" ref={sectionsRef}>
        {(tabs ? sections.filter((s) => s.id === tab) : sections).map((s) => (
          <SectionView key={s.id} scope={p.scope} section={s} tabs={tabs} />
        ))}
      </div>
      {!tabs && spacer > 0 ? <div className="sk-object-page__spacer" style={{ height: spacer }} aria-hidden data-sk-spacer /> : null}
    </DynamicPage>
  );
}
