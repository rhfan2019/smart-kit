/**
 * sap.m.QuickView, sap.m.QuickViewPage, sap.m.QuickViewGroup, sap.m.QuickViewGroupElement (1.154): a popover with
 * one or more pages of grouped label / value pairs about an object, opened next to a control with `openBy()` on the
 * ref. A page shows the header, the avatar, the title (a link with `titleUrl`) and the description, then its groups;
 * an element of type "pageLink" navigates to the page with that `pageId` (with a back button, `navigate` and
 * `afterNavigate`). Escape or a click outside closes it (`beforeClose` / `afterClose` with the origin).
 */
import { ActionIcon, Anchor, Group, Loader, Paper, Portal, Text } from '@mantine/core';
import { ChevronLeft } from 'lucide-react';
import { Children, createContext, isValidElement, useCallback, useContext, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type CSSProperties, type ReactElement, type ReactNode, type Ref } from 'react';
import { useControlText } from '../context';
import { TEXTS } from '../dialogs/texts';

/** sap.m.PlacementType */
export type PlacementType = 'Auto' | 'Bottom' | 'Horizontal' | 'HorizontalPreferredLeft' | 'HorizontalPreferredRight' | 'Left' | 'PreferredBottomOrFlip' | 'PreferredLeftOrFlip'
  | 'PreferredRightOrFlip' | 'PreferredTopOrFlip' | 'Right' | 'Top' | 'Vertical' | 'VerticalPreferredBottom' | 'VerticalPreferredTop';
export const PlacementType = {
  Auto: 'Auto', Bottom: 'Bottom', Horizontal: 'Horizontal', HorizontalPreferredLeft: 'HorizontalPreferredLeft', HorizontalPreferredRight: 'HorizontalPreferredRight',
  Left: 'Left', PreferredBottomOrFlip: 'PreferredBottomOrFlip', PreferredLeftOrFlip: 'PreferredLeftOrFlip', PreferredRightOrFlip: 'PreferredRightOrFlip',
  PreferredTopOrFlip: 'PreferredTopOrFlip', Right: 'Right', Top: 'Top', Vertical: 'Vertical', VerticalPreferredBottom: 'VerticalPreferredBottom', VerticalPreferredTop: 'VerticalPreferredTop',
} as const;

/** sap.m.QuickViewGroupElementType */
export type QuickViewGroupElementType = 'email' | 'link' | 'mobile' | 'pageLink' | 'phone' | 'text';
export const QuickViewGroupElementType = { email: 'email', link: 'link', mobile: 'mobile', pageLink: 'pageLink', phone: 'phone', text: 'text' } as const;

// ---------------------------------------------------------------------------------------------------------------
// QuickViewGroupElement, QuickViewGroup, QuickViewPage

export interface $QuickViewGroupElementSettings {
  /** Whether the element is shown. @defaultValue true */
  visible?: boolean;
  /** The label. @defaultValue "" */
  label?: string;
  /** The value; smart-kit also takes an element (e.g. a formatted field). @defaultValue "" */
  value?: ReactNode;
  /** The address of a "link" element. @defaultValue "" */
  url?: string;
  /** The target of a "link" element. @defaultValue "_blank" */
  target?: string;
  /** text, link, email, phone, mobile or pageLink. @defaultValue 'text' */
  type?: QuickViewGroupElementType;
  /** The `pageId` a "pageLink" element navigates to. @defaultValue "" */
  pageLinkId?: string;
  /** The subject of the mail an "email" element starts. @defaultValue "" */
  emailSubject?: string;
}

const NavContext = createContext<((pageId: string) => void) | null>(null);

export function QuickViewGroupElement({ visible = true, label = '', value = '', url = '', target = '_blank', type = 'text', pageLinkId = '', emailSubject = '' }: $QuickViewGroupElementSettings) {
  const navigate = useContext(NavContext);
  if (!visible) return null;
  const text = typeof value === 'string' || typeof value === 'number' ? String(value) : null;
  let shown: ReactNode = value;
  if (text !== null && text !== '') {
    if (type === 'link') shown = <Anchor href={url || text} target={target} rel={target === '_blank' ? 'noopener noreferrer' : undefined}>{text}</Anchor>;
    else if (type === 'email') shown = <Anchor href={`mailto:${text}${emailSubject ? `?subject=${encodeURIComponent(emailSubject)}` : ''}`}>{text}</Anchor>;
    else if (type === 'phone' || type === 'mobile') shown = <Anchor href={`tel:${text.replace(/\s/g, '')}`}>{text}</Anchor>;
    else if (type === 'pageLink') shown = <Anchor component="button" type="button" onClick={() => navigate?.(pageLinkId)} data-sk-quickview-pagelink={pageLinkId}>{text}</Anchor>;
  }
  return (
    <div className="sk-facet__pair" data-sk-quickview-element>
      {label ? <dt>{label}:</dt> : null}
      <dd>{shown}</dd>
    </div>
  );
}

export interface $QuickViewGroupSettings {
  /** Whether the group is shown. @defaultValue true */
  visible?: boolean;
  /** The heading of the group. @defaultValue "" */
  heading?: string;
  /** The elements (QuickViewGroupElement). */
  children?: ReactNode;
}

export function QuickViewGroup({ visible = true, heading = '', children }: $QuickViewGroupSettings) {
  if (!visible) return null;
  return (
    <dl className="sk-quickview__group" data-sk-quickview-group>
      {heading ? <Text size="sm" fw={600}>{heading}</Text> : null}
      {children}
    </dl>
  );
}

export interface $QuickViewPageSettings {
  /** The id other pages navigate to with a "pageLink" element. @defaultValue "" */
  pageId?: string;
  /** The header text of the page (shown at the top). @defaultValue "" */
  header?: string;
  /** The title. @defaultValue "" */
  title?: string;
  /** Makes the title a link. @defaultValue "" */
  titleUrl?: string;
  /** The description below the title. @defaultValue "" */
  description?: string;
  /** The avatar (a sap.m.Avatar element, e.g. Mantine's Avatar). */
  avatar?: ReactNode;
  /** The groups (QuickViewGroup). */
  children?: ReactNode;
}

export function QuickViewPage({ header = '', title = '', titleUrl = '', description = '', avatar, children }: $QuickViewPageSettings) {
  return (
    <div className="sk-quickview" data-sk-quickview-page>
      {header ? <Text size="xs" c="dimmed" mb={4} data-sk-quickview-header>{header}</Text> : null}
      <Group gap="sm" wrap="nowrap" mb="sm">
        {avatar}
        <div>
          <Text fw={600} data-sk-quickview-title>{titleUrl ? <a className="sk-link" href={titleUrl}>{title}</a> : title}</Text>
          {description ? <Text size="sm" c="dimmed">{description}</Text> : null}
        </div>
      </Group>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// QuickView

/** Parameters of `navigate` (sap.m.NavContainer navigate). */
export interface QuickView$NavigateEvent {
  /** The settings of the page navigated from. */
  from: $QuickViewPageSettings;
  fromId: string;
  /** The settings of the page navigated to. */
  to: $QuickViewPageSettings;
  toId: string;
  firstTime: boolean;
  isTo: boolean;
  isBack: boolean;
  isBackToTop: boolean;
  isBackToPage: boolean;
  direction: 'to' | 'back';
  navOrigin: null;
  /** Cancels the navigation. */
  preventDefault(): void;
}
export interface QuickView$AfterNavigateEvent extends Omit<QuickView$NavigateEvent, 'preventDefault'> {
  /** Whether the page navigated to is the first page. */
  isTopPage: boolean;
}
export interface QuickView$BeforeOpenEvent { /** The element the quick view is opened by. */ openBy: Element | null }
export type QuickView$AfterOpenEvent = QuickView$BeforeOpenEvent;
export interface QuickView$BeforeCloseEvent {
  openBy: Element | null;
  /** The element that closed it: null for Escape or a click outside. */
  origin: Element | null;
}
export type QuickView$AfterCloseEvent = QuickView$BeforeCloseEvent;

export interface $QuickViewSettings {
  /** Where the popover appears next to the `openBy` control. @defaultValue 'Right' */
  placement?: PlacementType;
  /** The width of the popover. @defaultValue "320px" */
  width?: string;
  /** The pages (QuickViewPage); the first one is shown first. */
  children?: ReactNode;
  /** Shows a busy indicator instead of the page (sap.ui.core.Control busy). */
  busy?: boolean;
  /** The accessible name of the popover. */
  'aria-label'?: string;
  onNavigate?: (e: QuickView$NavigateEvent) => void;
  onAfterNavigate?: (e: QuickView$AfterNavigateEvent) => void;
  onBeforeOpen?: (e: QuickView$BeforeOpenEvent) => void;
  onAfterOpen?: (e: QuickView$AfterOpenEvent) => void;
  onBeforeClose?: (e: QuickView$BeforeCloseEvent) => void;
  onAfterClose?: (e: QuickView$AfterCloseEvent) => void;
  ref?: Ref<QuickView>;
}

/** Instance methods of QuickView. */
export interface QuickView {
  /** Opens the quick view next to `oControl` (an element). */
  openBy(oControl: Element | null): void;
  /** Closes the quick view. */
  close(): void;
  /** Goes back to the previous page. */
  navigateBack(): void;
}

type Side = 'Left' | 'Right' | 'Top' | 'Bottom';
/** The side for a placement: the preferred side, flipped (or the alternatives tried) when the popover does not fit. */
function sideOf(placement: PlacementType, rect: DOMRect, w: number, h: number): Side {
  const room: Record<Side, number> = { Left: rect.left, Right: window.innerWidth - rect.right, Top: rect.top, Bottom: window.innerHeight - rect.bottom };
  const fits = (s: Side) => room[s] >= (s === 'Left' || s === 'Right' ? w : h);
  const first = (...sides: Side[]) => sides.find(fits) ?? sides[0]!;
  switch (placement) {
    case 'Left': case 'Right': case 'Top': case 'Bottom': return placement;
    case 'PreferredLeftOrFlip': return first('Left', 'Right');
    case 'PreferredRightOrFlip': return first('Right', 'Left');
    case 'PreferredTopOrFlip': return first('Top', 'Bottom');
    case 'PreferredBottomOrFlip': return first('Bottom', 'Top');
    case 'Vertical': case 'VerticalPreferredBottom': return first('Bottom', 'Top');
    case 'VerticalPreferredTop': return first('Top', 'Bottom');
    case 'Horizontal': case 'HorizontalPreferredRight': return first('Right', 'Left');
    case 'HorizontalPreferredLeft': return first('Left', 'Right');
    default: return first('Right', 'Left', 'Bottom', 'Top');
  }
}

export function QuickView({ placement = 'Right', width = '320px', children, busy, onNavigate, onAfterNavigate, onBeforeOpen, onAfterOpen, onBeforeClose, onAfterClose, ref, ...rest }: $QuickViewSettings) { // ui5-default
  const dt = useControlText(TEXTS);
  const [source, setSource] = useState<Element | null>(null);
  const [opened, setOpened] = useState(false);
  const [stack, setStack] = useState<string[]>([]);
  const [pos, setPos] = useState<CSSProperties>({ visibility: 'hidden' });
  // the popover element (Portal mounts it after the first commit, so it is state, not a ref)
  const [boxEl, setBoxEl] = useState<HTMLDivElement | null>(null);
  const box = useRef<HTMLDivElement | null>(null);
  box.current = boxEl;
  const visited = useRef(new Set<string>());
  const pages: ReactElement<$QuickViewPageSettings>[] = [];
  Children.forEach(children, (c) => { if (isValidElement<$QuickViewPageSettings>(c)) pages.push(c); });
  const idOf = (p: ReactElement<$QuickViewPageSettings> | undefined, i: number) => p?.props.pageId || `page${i}`;
  const current = stack.length ? pages.findIndex((p, i) => idOf(p, i) === stack[stack.length - 1]) : 0;
  const page = pages[Math.max(0, current)];
  const close = useCallback((origin: Element | null = null) => {
    if (!opened) return;
    onBeforeClose?.({ openBy: source, origin });
    setOpened(false);
    onAfterClose?.({ openBy: source, origin });
    if (source instanceof HTMLElement) source.focus();
  }, [opened, source, onBeforeClose, onAfterClose]);
  const nav = (toId: string, back: boolean) => {
    const fromIdx = Math.max(0, current);
    const from = pages[fromIdx];
    const toIdx = pages.findIndex((p, i) => idOf(p, i) === toId);
    if (toIdx < 0) return;
    let prevented = false;
    const e: QuickView$NavigateEvent = {
      preventDefault: () => { prevented = true; },
      from: from?.props ?? {}, fromId: idOf(from, fromIdx), to: pages[toIdx]!.props, toId, firstTime: !visited.current.has(toId),
      isTo: !back, isBack: back, isBackToTop: false, isBackToPage: false, direction: back ? 'back' : 'to', navOrigin: null,
    };
    onNavigate?.(e);
    if (prevented) return;
    visited.current.add(toId);
    setStack((s) => (back ? s.slice(0, -1) : [...s, toId]));
    const { preventDefault: _p, ...after } = e;
    onAfterNavigate?.({ ...after, isTopPage: toIdx === 0 });
  };
  useImperativeHandle(ref, () => ({
    openBy: (oControl) => {
      onBeforeOpen?.({ openBy: oControl });
      visited.current = new Set([idOf(pages[0], 0)]);
      setStack([]);
      setSource(oControl);
      setPos({ visibility: 'hidden' });
      setOpened(true);
      onAfterOpen?.({ openBy: oControl });
    },
    close: () => close(null),
    navigateBack: () => { if (stack.length) nav(stack.length > 1 ? stack[stack.length - 2]! : idOf(pages[0], 0), true); },
  }));
  // position next to the source once the size is known
  useLayoutEffect(() => {
    if (!opened || !boxEl) return;
    const rect = source?.getBoundingClientRect() ?? new DOMRect(window.innerWidth / 2, window.innerHeight / 3, 0, 0);
    const { width: w, height: h } = boxEl.getBoundingClientRect();
    const side = sideOf(placement, rect, w, h);
    const clampX = (x: number) => Math.max(8, Math.min(x, window.innerWidth - w - 8));
    const clampY = (y: number) => Math.max(8, Math.min(y, window.innerHeight - h - 8));
    const gap = 8;
    const next: CSSProperties = side === 'Bottom' ? { top: rect.bottom + gap, left: clampX(rect.left) }
      : side === 'Top' ? { top: rect.top - h - gap, left: clampX(rect.left) }
      : side === 'Left' ? { top: clampY(rect.top), left: rect.left - w - gap }
      : { top: clampY(rect.top), left: rect.right + gap };
    setPos(next);
  }, [opened, boxEl, source, placement, current, busy]);
  useEffect(() => {
    if (!opened) return;
    boxEl?.focus();
    const down = (e: MouseEvent) => { const t = e.target as Node; if (box.current && !box.current.contains(t) && !source?.contains(t)) close(null); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); close(null); } };
    document.addEventListener('mousedown', down);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key); };
  }, [opened, boxEl, source, close]);
  if (!opened) return null;
  return (
    <Portal>
      <Paper
        ref={setBoxEl} shadow="md" withBorder role="dialog" aria-label={rest['aria-label']} tabIndex={-1} className="sk-quickview-popover" data-sk-quickview
        style={{ position: 'fixed', zIndex: 300, width, maxWidth: 'calc(100vw - 16px)', padding: 'var(--mantine-spacing-sm)', ...pos }}
        onClick={(e) => e.stopPropagation()}
      >
        {busy ? <Loader size="sm" /> : (
          <NavContext.Provider value={(id) => nav(id, false)}>
            {stack.length ? (
              <ActionIcon variant="subtle" size="sm" mb={4} onClick={() => nav(stack.length > 1 ? stack[stack.length - 2]! : idOf(pages[0], 0), true)} aria-label={dt('ctl.ddr.back')} data-sk-quickview-back>
                <ChevronLeft className="sk-icon" />
              </ActionIcon>
            ) : null}
            {page}
          </NavContext.Provider>
        )}
      </Paper>
    </Portal>
  );
}
