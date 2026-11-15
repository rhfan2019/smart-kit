/**
 * DynamicPage: sticky title area, collapsible header content, content area and footer (LR-01, LR-12, OP-01, OP-02).
 * Snap on scroll: the header content scrolls away under the sticky title; while it is out of view the title shows the
 * collapsed state (summary, small avatar). Pinning makes the header content sticky as well.
 */
import { ActionIcon, Button, Group, Tooltip } from '@mantine/core';
import { ChevronDown, ChevronUp, Pin, PinOff } from 'lucide-react';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useText } from '../context/SmartKitProvider';

export interface DynamicPageProps {
  /** Page or object title. */
  heading: ReactNode;
  /** Replaces the heading area (e.g. a variant management control). */
  headingContent?: ReactNode;
  subheading?: ReactNode;
  breadcrumbs?: ReactNode;
  /** Shown left of the title while the header is collapsed (object page image). */
  collapsedAvatar?: ReactNode;
  /** Global actions on the right of the title area. */
  actions?: ReactNode;
  /** Shown in the title area while the header is collapsed (filter information). */
  summary?: ReactNode;
  /** Shown between title and header content; stays visible when collapsed (object page message strip). */
  titleMessage?: ReactNode;
  header?: ReactNode;
  /** Sticky navigation under the header (anchor bar). */
  navigation?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
  headerExpanded?: boolean;
  defaultHeaderExpanded?: boolean;
  onHeaderExpandedChange?(expanded: boolean): void;
  pinned?: boolean;
  onPinnedChange?(pinned: boolean): void;
  /** Collapse while scrolling and offer pinning (responsive content). False for content with its own scrollbar. */
  snapOnScroll?: boolean;
  /** Show "Show Filters / Hide Filters" in the title actions instead of the header features (grid tables). */
  filterToggle?: boolean;
  /** 'fill' gives the content the remaining height (grid tables); 'flow' lets the page scroll. */
  layout?: 'fill' | 'flow';
  className?: string;
  'data-testid'?: string;
}

interface DynamicPageContext {
  collapsed: boolean;
  expanded: boolean;
  setExpanded(v: boolean): void;
  pinned: boolean;
  /** Height of the sticky area (title + pinned header + navigation), for scroll offsets. */
  stickyHeight(): number;
  /** Collapses the header, then calls `fn` (object page anchors: collapse first, then scroll). */
  collapseThen(fn: () => void): void;
}

const Ctx = createContext<DynamicPageContext | null>(null);
export function useDynamicPage(): DynamicPageContext | null {
  return useContext(Ctx);
}

export function DynamicPage(p: DynamicPageProps) {
  const t = useText();
  const [ownExpanded, setOwnExpanded] = useState(p.defaultHeaderExpanded ?? true);
  const expanded = p.headerExpanded ?? ownExpanded;
  const setExpanded = (v: boolean) => {
    if (p.headerExpanded === undefined) setOwnExpanded(v);
    p.onHeaderExpandedChange?.(v);
  };
  const [ownPinned, setOwnPinned] = useState(false);
  const pinned = p.snapOnScroll ? (p.pinned ?? ownPinned) : false;
  const setPinned = (v: boolean) => {
    if (p.pinned === undefined) setOwnPinned(v);
    p.onPinnedChange?.(v);
  };

  const headerRef = useRef<HTMLDivElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLDivElement>(null);
  const [titleHeight, setTitleHeight] = useState(0);
  useEffect(() => {
    const el = stickyRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setTitleHeight(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [scrolledPast, setScrolledPast] = useState(false);
  useEffect(() => {
    if (!p.snapOnScroll || pinned || !expanded || typeof IntersectionObserver === 'undefined') {
      setScrolledPast(false);
      return;
    }
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => setScrolledPast(!e!.isIntersecting && e!.boundingClientRect.top < (stickyRef.current?.getBoundingClientRect().bottom ?? 0)),
      { threshold: 0, rootMargin: `-${stickyRef.current?.offsetHeight ?? 0}px 0px 0px 0px` },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [p.snapOnScroll, pinned, expanded]);

  const hasHeader = Boolean(p.header);
  const collapsed = hasHeader && (!expanded || scrolledPast);
  const scrollTop = () => headerRef.current?.closest('.sk-dynamic-page')?.scrollIntoView({ block: 'start' });

  const ctx: DynamicPageContext = {
    collapsed,
    expanded,
    setExpanded,
    pinned,
    stickyHeight: () => (stickyRef.current?.offsetHeight ?? 0) + (navRef.current?.offsetHeight ?? 0),
    collapseThen: (fn) => {
      // With snap on scroll the header collapses by scrolling past it; without it, collapse explicitly.
      if (!p.snapOnScroll && !pinned && expanded && hasHeader) setExpanded(false);
      requestAnimationFrame(() => requestAnimationFrame(fn));
    },
  };

  const features = hasHeader && !p.filterToggle ? (
    <div className="sk-dynamic-page__features">
      <Tooltip label={collapsed ? t('page.expandHeader') : t('page.collapseHeader')}>
        <ActionIcon
          variant="default"
          size="sm"
          radius="xl"
          aria-label={collapsed ? t('page.expandHeader') : t('page.collapseHeader')}
          aria-expanded={!collapsed}
          onClick={() => {
            if (scrolledPast) { setExpanded(true); scrollTop(); }
            else setExpanded(!expanded);
          }}
          data-sk-header-toggle
        >
          {collapsed ? <ChevronDown className="sk-icon" /> : <ChevronUp className="sk-icon" />}
        </ActionIcon>
      </Tooltip>
      {p.snapOnScroll && !collapsed ? (
        <Tooltip label={pinned ? t('page.unpinHeader') : t('page.pinHeader')}>
          <ActionIcon variant={pinned ? 'filled' : 'default'} size="sm" radius="xl" aria-label={pinned ? t('page.unpinHeader') : t('page.pinHeader')} aria-pressed={pinned} onClick={() => setPinned(!pinned)} data-sk-header-pin>
            {pinned ? <PinOff className="sk-icon" /> : <Pin className="sk-icon" />}
          </ActionIcon>
        </Tooltip>
      ) : null}
    </div>
  ) : null;

  const titleArea = (
    <div className="sk-dynamic-page__title" data-collapsed={collapsed || undefined}>
      {p.breadcrumbs ? <div className="sk-dynamic-page__breadcrumbs">{p.breadcrumbs}</div> : null}
      <div className="sk-dynamic-page__title-row">
        {collapsed && p.collapsedAvatar ? <div className="sk-dynamic-page__avatar">{p.collapsedAvatar}</div> : null}
        <div className="sk-dynamic-page__heading-block">
          {p.headingContent ?? <h1 className="sk-dynamic-page__heading">{p.heading}</h1>}
          {p.subheading ? <div className="sk-dynamic-page__subheading">{p.subheading}</div> : null}
          {collapsed && p.summary ? <div className="sk-dynamic-page__summary" aria-live="polite">{p.summary}</div> : null}
        </div>
        <Group gap="xs" className="sk-dynamic-page__actions" wrap="nowrap">
          {p.actions}
          {hasHeader && p.filterToggle ? (
            <Button variant="subtle" onClick={() => setExpanded(!expanded)} aria-expanded={expanded} data-sk-filter-toggle>
              {expanded ? t('page.hideFilters') : t('page.showFilters')}
            </Button>
          ) : null}
        </Group>
      </div>
      {p.titleMessage ? <div className="sk-dynamic-page__message">{p.titleMessage}</div> : null}
    </div>
  );

  const headerContent = hasHeader && expanded ? (
    <div className="sk-dynamic-page__header" ref={headerRef} id={`${p['data-testid'] ?? 'sk'}-header`}>
      {p.header}
    </div>
  ) : null;

  return (
    <Ctx.Provider value={ctx}>
      <div className={['sk-dynamic-page', `sk-dynamic-page--${p.layout ?? 'flow'}`, p.className].filter(Boolean).join(' ')} data-testid={p['data-testid']}>
        <div className="sk-dynamic-page__sticky" ref={stickyRef}>
          {titleArea}
          {pinned || !p.snapOnScroll ? headerContent : null}
          {pinned || !p.snapOnScroll || scrolledPast ? features : null}
        </div>
        {p.snapOnScroll && !pinned ? (
          <>
            {headerContent}
            <div ref={sentinelRef} className="sk-dynamic-page__sentinel" aria-hidden />
            {!scrolledPast ? features : null}
          </>
        ) : null}
        {p.navigation ? (
          <div className="sk-dynamic-page__navigation" ref={navRef} style={{ top: titleHeight }}>
            {p.navigation}
          </div>
        ) : null}
        <div className="sk-dynamic-page__content">{p.children}</div>
        {p.footer ? <div className="sk-dynamic-page__footer">{p.footer}</div> : null}
      </div>
    </Ctx.Provider>
  );
}
