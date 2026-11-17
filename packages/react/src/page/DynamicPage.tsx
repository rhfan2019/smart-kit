/**
 * DynamicPage: sticky title area, collapsible header content, content area and footer (LR-01, LR-12, OP-01, OP-02;
 * Dynamic Page Layout guideline, see docs/11-guideline-gap-report.md §4):
 * - snap on scroll (layout "flow"): the header content scrolls away under the sticky title; while it is out of view
 *   the title shows the collapsed state (summary, small avatar). With layout "fill" (content with its own scrollbar,
 *   e.g. a grid table) the content reports its scrolling through `contentScrolled`: scrolling it down collapses the
 *   header, back at the top it expands again;
 * - snap on click: the expand/collapse button, and clicking the title bar where it has no active element;
 * - pin: keeps the header content while scrolling; collapsing overrules and releases the pin;
 *   not offered on small screens or when the header would take more than 60% of the viewport;
 * - keyboard: the header expands when the keyboard focus enters it and collapses when the focus leaves it for the page
 *   content (unless pinned).
 * The expand/collapse and pin buttons sit centred on the bottom border of the header.
 */
import { ActionIcon, Button, Group, Tooltip } from '@mantine/core';
import { ChevronDown, ChevronUp, Pin, PinOff } from 'lucide-react';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useText } from '../context/SmartKitProvider';
import { useColumn } from './columnContext';
import { OverflowActions, type ToolbarAction } from './OverflowActions';

/** Page width from which layout actions share the line with the global actions (DP Responsiveness). */
const LAYOUT_BREAKPOINT = 1280;
/** Page width below which a collapsed header becomes a summary line (DP Summary Line, docs/12 U-12). */
const SUMMARY_LINE_BREAKPOINT = 600;

export interface DynamicPageProps {
  /** Page or object title. */
  heading: ReactNode;
  /** Replaces the heading area (e.g. a variant management control). */
  headingContent?: ReactNode;
  /** Text under the title. */
  subheading?: ReactNode;
  /** Breadcrumb links above the title. */
  breadcrumbs?: ReactNode;
  /** Shown left of the title while the header is collapsed (object page image). */
  collapsedAvatar?: ReactNode;
  /** Global actions on the right of the title area. */
  actions?: ReactNode;
  /** Global actions that move into an overflow menu from right to left when space runs out (after `actions`). */
  actionItems?: ToolbarAction[];
  /** Key information / KPIs in the middle of the title bar, left-aligned (DP Header Title (4)). */
  keyInfo?: ReactNode;
  /** Layout actions (DP Header Title (6)); a FlexibleColumnLayout column provides them through its context. */
  layoutActions?: ReactNode;
  /** Shown right of the title (object marker, DP Header Title / OP Unsaved Changes). */
  titleAddon?: ReactNode;
  /** Limits the page content to 1280px (DP Responsiveness · letterboxing). */
  letterboxing?: boolean;
  /** Shown in the title area while the header is collapsed (filter information). */
  summary?: ReactNode;
  /** Shown between title and header content; stays visible when collapsed (object page message strip). */
  titleMessage?: ReactNode;
  header?: ReactNode;
  /** Sticky navigation under the header (anchor bar). */
  navigation?: ReactNode;
  /** Footer toolbar content (e.g. Save / Cancel while editing). */
  footer?: ReactNode;
  /** Content. */
  children?: ReactNode;
  headerExpanded?: boolean;
  defaultHeaderExpanded?: boolean;
  onHeaderExpandedChange?(expanded: boolean): void;
  pinned?: boolean;
  onPinnedChange?(pinned: boolean): void;
  /** Collapse while scrolling and offer pinning. With layout "fill" the scrolling of the content is used (see contentScrolled). */
  snapOnScroll?: boolean;
  /** Show "Show Filters / Hide Filters" in the title actions instead of the expand/collapse and pin buttons. */
  filterToggle?: boolean;
  /** 'fill' gives the content the remaining height (grid tables); 'flow' lets the page scroll. */
  layout?: 'fill' | 'flow';
  /** Extra CSS class on the root element. */
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
  /** Layout "fill": the content scrolled to `top` (px). Collapses or expands the header unless it is pinned. */
  contentScrolled(top: number): void;
}

const Ctx = createContext<DynamicPageContext | null>(null);
export function useDynamicPage(): DynamicPageContext | null {
  return useContext(Ctx);
}

export function DynamicPage(p: DynamicPageProps) {
  const t = useText();
  const column = useColumn();
  const layoutActions = p.layoutActions ?? column?.layoutActions;
  const breadcrumbs = column && !column.showBreadcrumbs ? undefined : p.breadcrumbs;
  const [ownExpanded, setOwnExpanded] = useState(p.defaultHeaderExpanded ?? true);
  const expanded = p.headerExpanded ?? ownExpanded;
  const setExpanded = (v: boolean) => {
    if (p.headerExpanded === undefined) setOwnExpanded(v);
    p.onHeaderExpandedChange?.(v);
  };
  const [ownPinned, setOwnPinned] = useState(false);
  const fill = p.layout === 'fill';
  /** Snap on scroll needs a scrolling page: never with layout "fill". */
  const pageSnap = Boolean(p.snapOnScroll) && !fill;
  const [pinAllowed, setPinAllowed] = useState(true);
  const pinned = p.snapOnScroll && pinAllowed ? (p.pinned ?? ownPinned) : false;
  const autoCollapsed = useRef<number | null>(null); // time of the last collapse caused by content scrolling
  const lastTop = useRef(0);
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
  const rootRef = useRef<HTMLDivElement>(null);
  const [pageWidth, setPageWidth] = useState(LAYOUT_BREAKPOINT);
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setPageWidth(el.clientWidth));
    ro.observe(el);
    setPageWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const wide = pageWidth >= LAYOUT_BREAKPOINT;
  // No pin on small screens, or when the header (title + content) would take more than 60% of the viewport.
  useEffect(() => {
    if (!p.snapOnScroll) return;
    const check = () => {
      const root = rootRef.current;
      if (!root) return;
      const scroller = root.closest<HTMLElement>('[data-sk-scroll-container]') ?? (function find(el: HTMLElement | null): HTMLElement | null {
        for (let cur = el?.parentElement ?? null; cur; cur = cur.parentElement) if (/(auto|scroll)/.test(getComputedStyle(cur).overflowY)) return cur;
        return null;
      })(root);
      const viewport = scroller ? scroller.clientHeight : window.innerHeight;
      const header = (root.querySelector<HTMLElement>('.sk-dynamic-page__title')?.offsetHeight ?? 0) + (headerRef.current?.offsetHeight ?? 0);
      const small = window.matchMedia?.('(max-width: 599px)').matches ?? false;
      setPinAllowed(!small && header <= viewport * 0.6);
    };
    check();
    window.addEventListener('resize', check);
    const ro = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(check);
    if (ro && headerRef.current) ro.observe(headerRef.current);
    return () => { window.removeEventListener('resize', check); ro?.disconnect(); };
  }, [p.snapOnScroll, expanded, p.header]);
  useEffect(() => {
    if (!pinAllowed && (p.pinned ?? ownPinned)) setPinned(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- release the pin when it stops being allowed
  }, [pinAllowed]);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [scrolledPast, setScrolledPast] = useState(false);
  useEffect(() => {
    if (!pageSnap || pinned || !expanded || typeof IntersectionObserver === 'undefined') {
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
  }, [pageSnap, pinned, expanded]);

  const hasHeader = Boolean(p.header);
  const collapsed = hasHeader && (!expanded || scrolledPast);
  const summaryLine = collapsed && pageWidth > 0 && pageWidth < SUMMARY_LINE_BREAKPOINT;
  const scrollTop = () => headerRef.current?.closest('.sk-dynamic-page')?.scrollIntoView({ block: 'start' });

  const ctx: DynamicPageContext = {
    collapsed,
    expanded,
    setExpanded,
    pinned,
    stickyHeight: () => (stickyRef.current?.offsetHeight ?? 0) + (navRef.current?.offsetHeight ?? 0),
    collapseThen: (fn) => {
      // With snap on scroll the header collapses by scrolling past it; without it, collapse explicitly.
      if (!pageSnap && !pinned && expanded && hasHeader) setExpanded(false);
      requestAnimationFrame(() => requestAnimationFrame(fn));
    },
    contentScrolled: (top) => {
      const previous = lastTop.current;
      lastTop.current = top;
      if (!fill || !p.snapOnScroll || pinned || !hasHeader) return;
      if (top > 0 && previous === 0 && expanded) {
        autoCollapsed.current = Date.now();
        setExpanded(false);
      } else if (top === 0 && previous > 0 && !expanded && autoCollapsed.current !== null) {
        // The taller content may clamp the scroll position to 0 right after collapsing: not a scroll to the top.
        if (Date.now() - autoCollapsed.current < 400) return;
        autoCollapsed.current = null;
        setExpanded(true);
      }
    },
  };
  /** Snap on click (button or title bar). Collapsing overrules the pin and releases it. */
  const expand = () => {
    if (scrolledPast) { setExpanded(true); scrollTop(); }
    else if (!expanded) {
      setExpanded(true);
      // DP Snap on Click: the expanded header must be visible; on a scrolled page its content sits above the viewport.
      if (pageSnap) requestAnimationFrame(scrollTop);
    }
  };
  const collapse = () => {
    if (pinned) setPinned(false);
    if (expanded && !scrolledPast) setExpanded(false);
  };
  const toggle = () => { autoCollapsed.current = null; if (collapsed) expand(); else collapse(); };
  const onTitleClick = (e: React.MouseEvent) => {
    if (!hasHeader) return;
    const target = e.target as HTMLElement;
    if (target.closest('button, a, input, select, textarea, label, [role="button"], [role="link"], [role="menuitem"], [tabindex]:not([tabindex="-1"]), [data-sk-no-snap]')) return;
    if (window.getSelection?.()?.toString()) return; // selecting text is not a click on the title
    toggle();
  };

  // Keyboard: expand when the keyboard focus enters the header, collapse when it leaves for the page content.
  const keyboard = useRef(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Tab' || e.key === 'F6') keyboard.current = true; };
    // F6 is handled below as a group jump; mark it as keyboard so that focus events count.
    const onPointer = () => { keyboard.current = false; };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('pointerdown', onPointer, true);
    return () => { document.removeEventListener('keydown', onKey, true); document.removeEventListener('pointerdown', onPointer, true); };
  }, []);
  const inHeader = (el: EventTarget | null) => el instanceof Element && el.closest('[data-sk-header-region]')?.closest('.sk-dynamic-page') === rootRef.current;
  const latest = useRef({ collapsed, pinned, expand, collapse, hasHeader, filterToggle: p.filterToggle });
  latest.current = { collapsed, pinned, expand, collapse, hasHeader, filterToggle: p.filterToggle };
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const onFocusIn = (e: FocusEvent) => {
      const l = latest.current;
      if (!keyboard.current || !l.hasHeader || !inHeader(e.target) || inHeader(e.relatedTarget)) return;
      if (l.collapsed) l.expand();
    };
    const onFocusOut = (e: FocusEvent) => {
      const l = latest.current;
      if (!keyboard.current || !l.hasHeader || !inHeader(e.target)) return;
      const next = e.relatedTarget;
      // Only when the focus moves to the page content (not to a popup, the shell or another header element).
      if (!(next instanceof Element) || inHeader(next) || !root.contains(next)) return;
      if (!l.pinned && !l.collapsed) l.collapse();
    };
    root.addEventListener('focusin', onFocusIn);
    root.addEventListener('focusout', onFocusOut);
    // F6 / Shift+F6 group jumps (DP Keyboard Interaction): into the header title bar (expands), out of the header
    // into the content (collapses), and back.
    const focusables = (el: Element) => [...el.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"])')].filter((x) => x.offsetParent !== null || x === document.activeElement);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'F6' || e.altKey || e.ctrlKey || e.metaKey) return;
      const l = latest.current;
      const title = root.querySelector<HTMLElement>(':scope > .sk-dynamic-page__sticky > .sk-dynamic-page__title');
      const content = root.querySelector<HTMLElement>(':scope > .sk-dynamic-page__content');
      if (!title || !content) return;
      const active = document.activeElement;
      const inHead = inHeader(active);
      const inContent = active instanceof Element && content.contains(active);
      const before = !root.contains(active) && active instanceof Node && Boolean(root.compareDocumentPosition(active) & Node.DOCUMENT_POSITION_PRECEDING);
      if (!e.shiftKey && !root.contains(active) && (before || !active || active === document.body)) {
        if (root.closest('[data-sk-fcl-column]') && root.closest('[data-sk-fcl-column]') !== document.querySelector('[data-sk-fcl-column]')) return;
        e.preventDefault();
        title.focus();
        if (l.hasHeader && l.collapsed) l.expand();
      } else if (!e.shiftKey && inHead) {
        e.preventDefault();
        (focusables(content)[0] ?? content).focus();
        if (l.hasHeader && !l.pinned && !l.collapsed) l.collapse();
      } else if (e.shiftKey && inContent) {
        e.preventDefault();
        title.focus();
        if (l.hasHeader && l.collapsed) l.expand();
      } else if (e.shiftKey && inHead) {
        e.preventDefault();
        const all = focusables(document.body);
        const prev = all.filter((x) => !root.contains(x) && Boolean(root.compareDocumentPosition(x) & Node.DOCUMENT_POSITION_PRECEDING)).pop();
        prev?.focus();
        if (l.hasHeader && !l.pinned && !l.collapsed) l.collapse();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => { root.removeEventListener('focusin', onFocusIn); root.removeEventListener('focusout', onFocusOut); document.removeEventListener('keydown', onKey); };
  }, []); // reads the latest state through refs

  const features = hasHeader && !p.filterToggle ? (
    <div className="sk-dynamic-page__features" data-sk-header-region>
      <div className="sk-dynamic-page__features-buttons">
      <Tooltip label={collapsed ? t('page.expandHeader') : t('page.collapseHeader')}>
        <ActionIcon
          variant="default"
          size="md"
          radius="xl"
          aria-label={collapsed ? t('page.expandHeader') : t('page.collapseHeader')}
          aria-expanded={!collapsed}
          onClick={toggle}
          data-sk-header-toggle
        >
          {collapsed ? <ChevronDown className="sk-icon" /> : <ChevronUp className="sk-icon" />}
        </ActionIcon>
      </Tooltip>
      {p.snapOnScroll && pinAllowed && !collapsed ? (
        <Tooltip label={pinned ? t('page.unpinHeader') : t('page.pinHeader')}>
          <ActionIcon variant={pinned ? 'filled' : 'default'} size="md" radius="xl" aria-label={pinned ? t('page.unpinHeader') : t('page.pinHeader')} aria-pressed={pinned} onClick={() => setPinned(!pinned)} data-sk-header-pin>
            {pinned ? <PinOff className="sk-icon" /> : <Pin className="sk-icon" />}
          </ActionIcon>
        </Tooltip>
      ) : null}
      </div>
    </div>
  ) : null;

  // Space for the global actions: the title row minus the title (natural width, at most 40%), key information,
  // layout actions and the other actions (DP Responsiveness: actions overflow before the key information goes).
  const actionSpace = () => {
    const row = rootRef.current?.querySelector<HTMLElement>(':scope > .sk-dynamic-page__sticky .sk-dynamic-page__title-row');
    if (!row) return 0;
    const w = (sel: string) => [...row.querySelectorAll<HTMLElement>(sel)].reduce((n, el) => n + el.offsetWidth, 0);
    const heading = row.querySelector<HTMLElement>('.sk-dynamic-page__heading-line');
    const sub = row.querySelector<HTMLElement>('.sk-dynamic-page__subheading');
    const natural = Math.max(heading?.scrollWidth ?? 0, Math.min(sub?.scrollWidth ?? 0, 240));
    const title = Math.min(natural, row.clientWidth * 0.4) + (row.querySelector('.sk-dynamic-page__avatar') ? 48 : 0);
    const others = [...(row.querySelector('[data-sk-global-actions]')?.children ?? [])].filter((c) => !c.classList.contains('sk-dynamic-page__action-items')).reduce((n, c) => n + (c as HTMLElement).offsetWidth + 8, 0);
    return row.clientWidth - title - w(':scope > .sk-dynamic-page__key-info') - w(':scope > .sk-dynamic-page__layout-actions') - w(':scope > .sk-dynamic-page__divider') - others - 4 * 16;
  };
  const globalActions = (
    <Group gap="xs" className="sk-dynamic-page__actions" wrap="nowrap" data-sk-global-actions>
      {p.actions}
      {p.actionItems?.length ? <OverflowActions items={p.actionItems} className="sk-dynamic-page__action-items" availableWidth={actionSpace} /> : null}
      {hasHeader && p.filterToggle ? (
        <Button variant="subtle" onClick={toggle} aria-expanded={expanded} data-sk-filter-toggle>
          {expanded ? t('page.hideFilters') : t('page.showFilters')}
        </Button>
      ) : null}
    </Group>
  );
  const layout = layoutActions ? <div className="sk-dynamic-page__layout-actions" data-sk-layout-actions data-placement={wide ? 'inline' : 'above'}>{layoutActions}</div> : null;
  const titleArea = summaryLine ? (
    // DP Summary Line: on phones the collapsed header shows only the title and an arrow button; tapping it toggles.
    <div className="sk-dynamic-page__title sk-dynamic-page__title--summary-line" data-collapsed data-sk-header-region data-snap onClick={onTitleClick} tabIndex={-1} data-sk-summary-line>
      <div className="sk-dynamic-page__title-row">
        {p.collapsedAvatar ? <div className="sk-dynamic-page__avatar">{p.collapsedAvatar}</div> : null}
        <div className="sk-dynamic-page__heading-block">
          {p.headingContent ?? <h1 className="sk-dynamic-page__heading">{p.heading}</h1>}
        </div>
        <ActionIcon variant="subtle" aria-label={t('page.expandHeader')} aria-expanded={false} onClick={toggle} data-sk-header-toggle data-sk-summary-toggle>
          <ChevronDown className="sk-icon" />
        </ActionIcon>
      </div>
    </div>
  ) : (
    <div className="sk-dynamic-page__title" data-collapsed={collapsed || undefined} data-sk-header-region data-snap={hasHeader || undefined} onClick={onTitleClick} tabIndex={-1} aria-label={typeof p.heading === 'string' ? p.heading : undefined} role="group">
      {layout && !wide ? <div className="sk-dynamic-page__layout-row">{layout}</div> : null}
      {breadcrumbs ? <div className="sk-dynamic-page__breadcrumbs">{breadcrumbs}</div> : null}
      <div className="sk-dynamic-page__title-row">
        {collapsed && p.collapsedAvatar ? <div className="sk-dynamic-page__avatar">{p.collapsedAvatar}</div> : null}
        <div className="sk-dynamic-page__heading-block">
          <div className="sk-dynamic-page__heading-line">
            {p.headingContent ?? <h1 className="sk-dynamic-page__heading" data-sk-heading>{p.heading}</h1>}
            {p.titleAddon ? <span className="sk-dynamic-page__title-addon">{p.titleAddon}</span> : null}
          </div>
          {p.subheading ? <div className="sk-dynamic-page__subheading" data-sk-subheading>{p.subheading}</div> : null}
          {collapsed && p.summary ? <div className="sk-dynamic-page__summary" aria-live="polite">{p.summary}</div> : null}
        </div>
        {p.keyInfo ? <div className="sk-dynamic-page__key-info" data-sk-key-info>{p.keyInfo}</div> : null}
        {globalActions}
        {layout && wide ? <><span className="sk-dynamic-page__divider" aria-hidden />{layout}</> : null}
      </div>
      {p.titleMessage ? <div className="sk-dynamic-page__message">{p.titleMessage}</div> : null}
    </div>
  );

  const headerContent = hasHeader && expanded ? (
    <div className="sk-dynamic-page__header" ref={headerRef} id={`${p['data-testid'] ?? 'sk'}-header`} data-sk-header-region>
      {p.header}
    </div>
  ) : null;

  return (
    <Ctx.Provider value={ctx}>
      <div ref={rootRef} className={['sk-dynamic-page', `sk-dynamic-page--${p.layout ?? 'flow'}`, p.letterboxing ? 'sk-dynamic-page--letterboxing' : '', p.className].filter(Boolean).join(' ')} data-testid={p['data-testid']} data-wide={wide || undefined} style={{ ['--sk-sticky-offset' as string]: `${titleHeight}px` }}>
        <div className="sk-dynamic-page__sticky" ref={stickyRef}>
          {titleArea}
          {pinned || !pageSnap ? headerContent : null}
          {summaryLine ? null : pinned || !pageSnap || scrolledPast || !expanded ? features : null}
        </div>
        {pageSnap && !pinned ? (
          <>
            {headerContent}
            <div ref={sentinelRef} className="sk-dynamic-page__sentinel" aria-hidden />
            {!scrolledPast && expanded ? features : null}
          </>
        ) : null}
        {p.navigation ? (
          <div className="sk-dynamic-page__navigation" ref={navRef} style={{ top: titleHeight }}>
            {p.navigation}
          </div>
        ) : null}
        <div className="sk-dynamic-page__content" tabIndex={-1}>{p.children}</div>
        {p.footer ? <div className="sk-dynamic-page__footer">{p.footer}</div> : null}
      </div>
    </Ctx.Provider>
  );
}
