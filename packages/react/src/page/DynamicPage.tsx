/**
 * sap.f.DynamicPage, sap.f.DynamicPageTitle and sap.f.DynamicPageHeader (ADR-033; LR-01, LR-12, OP-01, OP-02; Dynamic Page
 * Layout guideline, see docs/11-guideline-gap-report.md §4). The page is composed as in SAPUI5: `title` takes a
 * DynamicPageTitle, `header` a DynamicPageHeader, `content` the page content.
 * - snap on scroll (unless `preserveHeaderStateOnScroll`): the header content scrolls away under the sticky title; while it
 *   is out of view the title shows its snapped state (`snappedHeading`, `snappedContent`). With `fitContent` (content with
 *   its own scrollbar, e.g. a grid table) the content reports its scrolling through `contentScrolled`: scrolling it down
 *   collapses the header, back at the top it expands again;
 * - snap on click: the expand/collapse button, and clicking the title bar where it has no active element
 *   (`toggleHeaderOnTitleClick`);
 * - pin: keeps the header content while scrolling; collapsing overrules and releases the pin; not offered on small
 *   screens or when the header would take more than 60% of the viewport;
 * - keyboard: the header expands when the keyboard focus enters it and collapses when the focus leaves it for the page
 *   content (unless pinned).
 * The expand/collapse and pin buttons sit centred on the bottom border of the header.
 */
import { ActionIcon, Button, Tooltip } from '@mantine/core';
import { ChevronDown, ChevronUp, Pin, PinOff } from 'lucide-react';
import { createContext, isValidElement, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useText } from '../context/SmartKitProvider';
import type { BackgroundDesign } from '../controls/dialogs/IconTabBar';
import type { PageBackgroundDesign } from '../controls/dialogs/Wizard';
import { OverflowToolbar } from '../controls/display/OverflowToolbar';
import { useColumn } from './columnContext';
import { dynamicPageLandmarks, landmarkProps, PageLandmarkOverride, type $DynamicPageAccessibleLandmarkInfoSettings } from './landmarks';

/** Page width from which the navigation actions share the line with the actions (DP Responsiveness). */
const LAYOUT_BREAKPOINT = 1280;
/** Page width below which a snapped title shows `snappedTitleOnMobile` only (DP Summary Line, docs/12 U-12). */
const SUMMARY_LINE_BREAKPOINT = 600;

/** sap.f.DynamicPageTitleShrinkRatio: flex-shrink factors of heading, content and actions ("1:1.6:1.6"). */
export type DynamicPageTitleShrinkRatio = '1:1.6:1.6' | '1:1:1' | '1.6:1:1.6' | '1.6:1.6:1' | '1:1:1.6' | '1:1.6:1' | '1.6:1:1';
export const DynamicPageTitleShrinkRatio = {
  '1:1.6:1.6': '1:1.6:1.6', '1:1:1': '1:1:1', '1.6:1:1.6': '1.6:1:1.6', '1.6:1.6:1': '1.6:1.6:1', '1:1:1.6': '1:1:1.6', '1:1.6:1': '1:1.6:1', '1.6:1:1': '1.6:1:1',
} as const;

/** Media ranges of the page (SAPUI5 `Device.media.RANGESETS.SAP_STANDARD_EXTENDED`). */
export function mediaRange(width: number): 'Phone' | 'Tablet' | 'Desktop' | 'LargeDesktop' {
  return width < 600 ? 'Phone' : width < 1024 ? 'Tablet' : width < 1440 ? 'Desktop' : 'LargeDesktop';
}

export interface $DynamicPageTitleSettings {
  /** The title (an h1 for a string; any element, e.g. a variant management, otherwise). */
  heading?: ReactNode;
  /** Replaces `heading` while the header is snapped (e.g. a small avatar and the title). */
  snappedHeading?: ReactNode;
  /** Replaces `heading` while the header is expanded. */
  expandedHeading?: ReactNode;
  /** Actions on the right; they move into an overflow from right to left when space runs out (an OverflowToolbar). */
  actions?: ReactNode;
  /** Layout actions at the very right (DP Header Title (6)), e.g. FlexibleColumnLayoutActions. */
  navigationActions?: ReactNode;
  /** Content in the middle of the title bar, e.g. key information (DP Header Title (4)). */
  content?: ReactNode;
  /** Shown under the heading while the header is snapped (e.g. the filter information). */
  snappedContent?: ReactNode;
  /** Shown under the heading while the header is expanded (e.g. the description). */
  expandedContent?: ReactNode;
  /** On phones, a snapped title shows only this title and a toggle (DP Summary Line). */
  snappedTitleOnMobile?: ReactNode;
  /** Breadcrumb links above the heading; inside a FlexibleColumnLayout only in full screen with one column. */
  breadcrumbs?: ReactNode;
  /** Flex-shrink factors of the heading, content and actions areas. @defaultValue '1:1.6:1.6' */
  areaShrinkRatio?: DynamicPageTitleShrinkRatio;
  /** Background of the title. */
  backgroundDesign?: BackgroundDesign;
  /** Fired when the header is expanded or collapsed (by the user or by scrolling). */
  onStateChange?(e: DynamicPageTitle$StateChangeEvent): void;
}

/** Event object of DynamicPageTitle's stateChange. */
export interface DynamicPageTitle$StateChangeEvent {
  /** True when the header is now expanded. */
  isExpanded: boolean;
}

export interface $DynamicPageHeaderSettings {
  /** Offer the pin button (only while the page snaps on scroll). @defaultValue true */
  pinnable?: boolean;
  /** Background of the header. */
  backgroundDesign?: BackgroundDesign;
  /** Header content (e.g. a filter bar or header facets). */
  children?: ReactNode;
}

export interface $DynamicPageSettings {
  /** The title, a DynamicPageTitle (or ObjectPageDynamicHeaderTitle). */
  title?: ReactNode;
  /** The header, a DynamicPageHeader. */
  header?: ReactNode;
  /** Page content. */
  content?: ReactNode;
  /** Footer toolbar content (e.g. Save / Cancel while editing); shown with `showFooter`. */
  footer?: ReactNode;
  /** Shows the footer. @defaultValue false */
  showFooter?: boolean;
  /** The header keeps its state while scrolling (no snap on scroll, no pin). @defaultValue false */
  preserveHeaderStateOnScroll?: boolean;
  /** The header is expanded; without it the page keeps the state itself. @defaultValue true */
  headerExpanded?: boolean;
  /** The header is pinned; without it the page keeps the state itself. @defaultValue false */
  headerPinned?: boolean;
  /** Clicking the title bar expands or collapses the header. @defaultValue true */
  toggleHeaderOnTitleClick?: boolean;
  /** Page background. @defaultValue 'Standard' */
  backgroundDesign?: PageBackgroundDesign;
  /** The content fills the remaining height and scrolls itself (grid tables); otherwise the page scrolls. @defaultValue false */
  fitContent?: boolean;
  /** Sticky content under the header (an anchor bar or tab bar). */
  stickySubheaderProvider?: ReactNode;
  /** ARIA landmark roles and labels of the page's containers, a DynamicPageAccessibleLandmarkInfo; without it no landmarks are written. */
  landmarkInfo?: ReactNode;
  /** Fired when the pin button is pressed. */
  onPinnedStateChange?(e: DynamicPage$PinnedStateChangeEvent): void;
  /** Fired when the page width moves into another media range. */
  onBreakpointChange?(e: DynamicPage$BreakpointChangeEvent): void;
  /** Extension: shown between title and header content; stays visible when snapped (object page message strip). */
  titleMessage?: ReactNode;
  /** Extension: limits the page content to 1280px (DP Responsiveness · letterboxing). */
  letterboxing?: boolean;
  /** Extension: "Show Filters / Hide Filters" in the title actions instead of the expand/collapse and pin buttons. */
  filterToggle?: boolean;
  /** Extra CSS class on the root element. */
  className?: string;
  'data-testid'?: string;
}

/** Event object of DynamicPage's pinnedStateChange. */
export interface DynamicPage$PinnedStateChangeEvent {
  /** True when the header is now pinned. */
  pinned: boolean;
}

/** Event object of DynamicPage's breakpointChange. */
export interface DynamicPage$BreakpointChangeEvent {
  /** The new media range: Phone, Tablet, Desktop or LargeDesktop. */
  currentRange: string;
  /** The page width in px. */
  currentWidth: number;
}

/** State of the surrounding DynamicPage (`kit/useDynamicPage`). */
export interface DynamicPageContext {
  collapsed: boolean;
  expanded: boolean;
  setExpanded(v: boolean): void;
  pinned: boolean;
  /** Height of the sticky area (title + pinned header + sticky subheader), for scroll offsets. */
  stickyHeight(): number;
  /** Collapses the header, then calls `fn` (object page anchors: collapse first, then scroll). */
  collapseThen(fn: () => void): void;
  /** `fitContent`: the content scrolled to `top` (px). Collapses or expands the header unless it is pinned. */
  contentScrolled(top: number): void;
}

const Ctx = createContext<DynamicPageContext | null>(null);
export function useDynamicPage(): DynamicPageContext | null {
  return useContext(Ctx);
}

/** What the page tells its title. */
interface TitleState {
  /** The page's `titleMessage` (smart-kit extension), shown at the bottom of the title (AC-OP-08). */
  message?: ReactNode;
  collapsed: boolean;
  summaryLine: boolean;
  wide: boolean;
  hasHeader: boolean;
  expanded: boolean;
  filterToggle: boolean;
  toggle(): void;
  onTitleClick(e: React.MouseEvent): void;
}
const TitleCtx = createContext<TitleState | null>(null);

const propsOf = <T,>(node: ReactNode): T => (isValidElement(node) ? (node.props as T) : ({} as T));
const textOf = (node: ReactNode) => (typeof node === 'string' || typeof node === 'number' ? String(node) : undefined);
const headingEl = (node: ReactNode) => (typeof node === 'string' || typeof node === 'number' ? <h1 className="sk-dynamic-page__heading" data-sk-heading>{node}</h1> : node);

/** sap.f.DynamicPageTitle: rendered by the DynamicPage it is given to (`title`). */
export function DynamicPageTitle(p: $DynamicPageTitleSettings) {
  const t = useText();
  const column = useColumn();
  const s = useContext(TitleCtx) ?? { collapsed: false, summaryLine: false, wide: true, hasHeader: false, expanded: true, filterToggle: false, toggle: () => undefined, onTitleClick: () => undefined };
  const breadcrumbs = column && !column.showBreadcrumbs ? undefined : p.breadcrumbs;
  const [shrinkHeading, shrinkContent, shrinkActions] = (p.areaShrinkRatio ?? '1:1.6:1.6').split(':').map(Number);
  const bg = p.backgroundDesign;
  if (s.summaryLine && p.snappedTitleOnMobile) {
    // DP Summary Line: on phones the snapped title shows only the title and an arrow button; tapping it toggles.
    return (
      <div className="sk-dynamic-page__title sk-dynamic-page__title--summary-line" data-collapsed data-sk-header-region data-snap onClick={s.onTitleClick} tabIndex={-1} data-sk-summary-line data-background-design={bg}>
        <div className="sk-dynamic-page__title-row">
          <div className="sk-dynamic-page__heading-block">{headingEl(p.snappedTitleOnMobile)}</div>
          <ActionIcon variant="subtle" aria-label={t('page.expandHeader')} aria-expanded={false} onClick={s.toggle} data-sk-header-toggle data-sk-summary-toggle>
            <ChevronDown className="sk-icon" />
          </ActionIcon>
        </div>
      </div>
    );
  }
  const heading = (s.collapsed ? p.snappedHeading : p.expandedHeading) ?? p.heading;
  const layout = p.navigationActions ? <div className="sk-dynamic-page__layout-actions" data-sk-layout-actions data-placement={s.wide ? 'inline' : 'above'}>{p.navigationActions}</div> : null;
  const actions = p.actions || (s.hasHeader && s.filterToggle) ? (
    <div className="sk-dynamic-page__actions" data-sk-global-actions style={{ flexShrink: shrinkActions }}>
      {p.actions ? <OverflowToolbar design="Transparent" style="Clear" className="sk-dynamic-page__toolbar">{p.actions}</OverflowToolbar> : null}
      {s.hasHeader && s.filterToggle ? (
        <Button variant="subtle" onClick={s.toggle} aria-expanded={s.expanded} data-sk-filter-toggle>
          {s.expanded ? t('page.hideFilters') : t('page.showFilters')}
        </Button>
      ) : null}
    </div>
  ) : null;
  return (
    <div className="sk-dynamic-page__title" data-collapsed={s.collapsed || undefined} data-sk-header-region data-snap={s.hasHeader || undefined} onClick={s.onTitleClick} tabIndex={-1} aria-label={textOf(p.heading) ?? textOf(p.snappedTitleOnMobile)} role="group" data-background-design={bg}>
      {layout && !s.wide ? <div className="sk-dynamic-page__layout-row">{layout}</div> : null}
      {breadcrumbs ? <div className="sk-dynamic-page__breadcrumbs">{breadcrumbs}</div> : null}
      <div className="sk-dynamic-page__title-row">
        <div className="sk-dynamic-page__heading-block" style={{ flexShrink: shrinkHeading }}>
          <div className="sk-dynamic-page__heading-line">{headingEl(heading)}</div>
          {!s.collapsed && p.expandedContent ? <div className="sk-dynamic-page__subheading" data-sk-subheading>{p.expandedContent}</div> : null}
          {s.collapsed && p.snappedContent ? <div className="sk-dynamic-page__summary" aria-live="polite" data-sk-snapped-content>{p.snappedContent}</div> : null}
        </div>
        {p.content ? <div className="sk-dynamic-page__key-info" data-sk-key-info style={{ flexShrink: shrinkContent }}>{p.content}</div> : null}
        {actions}
        {layout && s.wide ? <><span className="sk-dynamic-page__divider" aria-hidden />{layout}</> : null}
      </div>
      {s.message ? <div className="sk-dynamic-page__message">{s.message}</div> : null}
    </div>
  );
}

/** sap.f.DynamicPageHeader: its content is rendered by the DynamicPage it is given to (`header`). */
export function DynamicPageHeader(p: $DynamicPageHeaderSettings) {
  return <>{p.children}</>;
}

export function DynamicPage(p: $DynamicPageSettings) {
  const t = useText();
  const titleProps = propsOf<$DynamicPageTitleSettings>(p.title);
  const headerProps = propsOf<$DynamicPageHeaderSettings>(p.header);
  const [ownExpanded, setOwnExpanded] = useState(true);
  const expanded = p.headerExpanded ?? ownExpanded;
  const latestTitle = useRef(titleProps);
  latestTitle.current = titleProps;
  const setExpanded = (v: boolean) => {
    if (p.headerExpanded === undefined) setOwnExpanded(v);
    latestTitle.current.onStateChange?.({ isExpanded: v });
  };
  const [ownPinned, setOwnPinned] = useState(false);
  const fill = Boolean(p.fitContent);
  const snap = !p.preserveHeaderStateOnScroll;
  /** Snap on scroll needs a scrolling page: never with fitContent. */
  const pageSnap = snap && !fill;
  const [pinAllowed, setPinAllowed] = useState(true);
  const pinnable = snap && pinAllowed && headerProps.pinnable !== false;
  const pinned = pinnable ? (p.headerPinned ?? ownPinned) : false;
  const autoCollapsed = useRef<number | null>(null); // time of the last collapse caused by content scrolling
  const lastTop = useRef(0);
  const setPinned = (v: boolean) => {
    if (p.headerPinned === undefined) setOwnPinned(v);
    p.onPinnedStateChange?.({ pinned: v });
  };

  const headerRef = useRef<HTMLElement>(null);
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
  const range = useRef<string | undefined>(undefined);
  const onBreakpoint = useRef(p.onBreakpointChange);
  onBreakpoint.current = p.onBreakpointChange;
  useEffect(() => {
    if (!pageWidth) return;
    const next = mediaRange(pageWidth);
    if (range.current !== undefined && range.current !== next) onBreakpoint.current?.({ currentRange: next, currentWidth: pageWidth });
    range.current = next;
  }, [pageWidth]);
  // No pin on small screens, or when the header (title + content) would take more than 60% of the viewport.
  useEffect(() => {
    if (!snap) return;
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
  }, [snap, expanded, p.header]);
  useEffect(() => {
    if (!pinAllowed && (p.headerPinned ?? ownPinned)) setPinned(false);
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
  const summaryLine = collapsed && pageWidth > 0 && pageWidth < SUMMARY_LINE_BREAKPOINT && Boolean(titleProps.snappedTitleOnMobile);
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
      if (!fill || !snap || pinned || !hasHeader) return;
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
    if (!hasHeader || p.toggleHeaderOnTitleClick === false) return;
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
  const latest = useRef({ collapsed, pinned, expand, collapse, hasHeader });
  latest.current = { collapsed, pinned, expand, collapse, hasHeader };
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
      {pinnable && !collapsed ? (
        <Tooltip label={pinned ? t('page.unpinHeader') : t('page.pinHeader')}>
          <ActionIcon variant={pinned ? 'filled' : 'default'} size="md" radius="xl" aria-label={pinned ? t('page.unpinHeader') : t('page.pinHeader')} aria-pressed={pinned} onClick={() => setPinned(!pinned)} data-sk-header-pin>
            {pinned ? <PinOff className="sk-icon" /> : <Pin className="sk-icon" />}
          </ActionIcon>
        </Tooltip>
      ) : null}
      </div>
    </div>
  ) : null;

  const titleState: TitleState = { message: summaryLine ? undefined : p.titleMessage, collapsed, summaryLine, wide, hasHeader, expanded, filterToggle: Boolean(p.filterToggle), toggle, onTitleClick };
  const titleArea = (
    <TitleCtx.Provider value={titleState}>
      {p.title}
    </TitleCtx.Provider>
  );

  // Landmarks (sap.f.DynamicPageRenderer): an ObjectPageLayout gives its own (PageLandmarkOverride).
  const override = useContext(PageLandmarkOverride);
  const lm = override ?? dynamicPageLandmarks(landmarkProps<$DynamicPageAccessibleLandmarkInfoSettings>(p.landmarkInfo), textOf(titleProps.heading), t('page.roleDescription'));
  // the tags differ by landmark (article / header / footer, or div with a role); the refs only need HTMLElement
  const RootTag = lm.root.tag as 'div';
  const HeaderTag = lm.header.tag as 'div';
  const FooterTag = lm.footer.tag as 'div';

  // sap.f.DynamicPageHeader: a region labelled "Expanded header" (or the info's headerContentLabel).
  const headerContent = hasHeader && expanded ? (
    <section className="sk-dynamic-page__header" ref={headerRef} id={`${p['data-testid'] ?? 'sk'}-header`} role="region" aria-label={lm.headerContentLabel ?? t('page.expandedHeader')} data-sk-header-region data-background-design={headerProps.backgroundDesign}>
      {p.header}
    </section>
  ) : null;

  return (
    <Ctx.Provider value={ctx}>
      <RootTag
        ref={rootRef}
        role={lm.root.role} aria-label={lm.root.label} aria-roledescription={lm.root.roleDescription}
        className={['sk-dynamic-page', `sk-dynamic-page--${fill ? 'fill' : 'flow'}`, p.letterboxing ? 'sk-dynamic-page--letterboxing' : '', p.className].filter(Boolean).join(' ')}
        data-testid={p['data-testid']} data-wide={wide || undefined} data-background-design={p.backgroundDesign ?? 'Standard'}
        style={{ ['--sk-sticky-offset' as string]: `calc(var(--sk-sticky-top) + ${titleHeight}px)` }}
      >
        <HeaderTag className="sk-dynamic-page__sticky" ref={stickyRef} role={lm.header.role} aria-label={lm.header.label}>
          {titleArea}
          {pinned || !pageSnap ? headerContent : null}
          {summaryLine ? null : pinned || !pageSnap || scrolledPast || !expanded ? features : null}
        </HeaderTag>
        {pageSnap && !pinned ? (
          <>
            {headerContent}
            <div ref={sentinelRef} className="sk-dynamic-page__sentinel" aria-hidden />
            {!scrolledPast && expanded ? features : null}
          </>
        ) : null}
        {p.stickySubheaderProvider ? (
          <div className="sk-dynamic-page__navigation" ref={navRef} style={{ top: `calc(var(--sk-sticky-top) + ${titleHeight}px)` }}>
            {p.stickySubheaderProvider}
          </div>
        ) : null}
        <div className="sk-dynamic-page__content" tabIndex={-1} role={lm.content.role} aria-label={lm.content.label}>
          <PageLandmarkOverride.Provider value={null}>{p.content}</PageLandmarkOverride.Provider>
        </div>
        {p.footer && p.showFooter ? <FooterTag className="sk-dynamic-page__footer" role={lm.footer.role} aria-label={lm.footer.label}>{p.footer}</FooterTag> : null}
      </RootTag>
    </Ctx.Provider>
  );
}
