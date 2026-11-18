/**
 * IconTabBar, IconTabFilter and IconTabSeparator (sap.m, docs/26 3.9): tabs with icons and counts, given as JSX
 * children (the UI5 `key` is the React key). Tabs that do not fit go into an overflow menu ("More"); a filter with
 * child filters opens them in a menu; re-pressing the selected tab collapses the content when `expandable`.
 */
import { Menu } from '@mantine/core';
import { ChevronDown } from 'lucide-react';
import {
  Children, Fragment, isValidElement, useEffect, useId, useLayoutEffect, useRef, useState, type DragEvent, type KeyboardEvent, type ReactElement, type ReactNode,
} from 'react';
import { useControlText } from '../context';
import { TEXTS } from './texts';

/** sap.ui.core.IconColor */
export type IconColor = 'Default' | 'Positive' | 'Critical' | 'Negative' | 'Neutral' | 'Contrast' | 'Marker' | 'NonInteractive' | 'Tile';
export const IconColor = {
  Default: 'Default', Positive: 'Positive', Critical: 'Critical', Negative: 'Negative', Neutral: 'Neutral', Contrast: 'Contrast', Marker: 'Marker',
  NonInteractive: 'NonInteractive', Tile: 'Tile',
} as const;
/** sap.m.IconTabFilterDesign */
export type IconTabFilterDesign = 'Horizontal' | 'Vertical';
export const IconTabFilterDesign = { Horizontal: 'Horizontal', Vertical: 'Vertical' } as const;
/** sap.m.IconTabFilterInteractionMode */
export type IconTabFilterInteractionMode = 'Auto' | 'Select' | 'SelectLeavesOnly';
export const IconTabFilterInteractionMode = { Auto: 'Auto', Select: 'Select', SelectLeavesOnly: 'SelectLeavesOnly' } as const;
/** sap.m.IconTabHeaderMode */
export type IconTabHeaderMode = 'Inline' | 'Standard';
export const IconTabHeaderMode = { Inline: 'Inline', Standard: 'Standard' } as const;
/** sap.m.IconTabDensityMode */
export type IconTabDensityMode = 'Compact' | 'Cozy' | 'Inherit';
export const IconTabDensityMode = { Compact: 'Compact', Cozy: 'Cozy', Inherit: 'Inherit' } as const;
/** sap.m.TabsOverflowMode */
export type TabsOverflowMode = 'End' | 'StartAndEnd';
export const TabsOverflowMode = { End: 'End', StartAndEnd: 'StartAndEnd' } as const;
/** sap.m.BackgroundDesign */
export type BackgroundDesign = 'Solid' | 'Translucent' | 'Transparent';
export const BackgroundDesign = { Solid: 'Solid', Translucent: 'Translucent', Transparent: 'Transparent' } as const;

export interface $IconTabFilterSettings {
  text?: string;
  /** (true) */
  enabled?: boolean;
  /** ('') */
  count?: string;
  /** (false) The "all" tab: the count large, the text under it, no icon. */
  showAll?: boolean;
  icon?: ReactNode;
  /** ('Default') */
  iconColor?: IconColor;
  /** (true) */
  visible?: boolean;
  /** ('Vertical') */
  design?: IconTabFilterDesign;
  /** ('Auto') Auto: a filter with child filters and no content opens its menu; Select: it is selected; SelectLeavesOnly: only leaves are selected. */
  interactionMode?: IconTabFilterInteractionMode;
  /** The content (shown when the filter is selected) and child IconTabFilter / IconTabSeparator elements (UI5 `items`). */
  children?: ReactNode;
}

export interface $IconTabSeparatorSettings {
  icon?: ReactNode;
  /** (true) */
  visible?: boolean;
}

/** A tab of an IconTabBar; rendered by the IconTabBar (alone it renders nothing). */
export function IconTabFilter(_p: $IconTabFilterSettings): null { return null; }
/** A separator between tabs of an IconTabBar. */
export function IconTabSeparator(_p: $IconTabSeparatorSettings): null { return null; }

/** A filter as passed to `onSelect`: its props, its key and the keys of its child filters. */
export interface IconTabFilterItem extends Omit<$IconTabFilterSettings, 'children'> {
  key: string;
  /** Child filters (UI5 `items`). */
  items: IconTabItem[];
  /** The content, without the child filters. */
  content: ReactNode[];
  /** Key of the top-level filter it belongs to (its own key on the top level). */
  rootKey: string;
}
export type IconTabItem = ({ kind: 'filter' } & IconTabFilterItem) | ({ kind: 'separator'; key: string } & $IconTabSeparatorSettings);

export interface $IconTabBarSettings {
  /** IconTabFilter and IconTabSeparator elements (UI5 `items`). */
  children?: ReactNode;
  /** Content shown for filters that have none of their own (UI5 `content`). */
  content?: ReactNode;
  /** (true) Pressing the selected tab collapses and expands the content. */
  expandable?: boolean;
  /** (true) */
  expanded?: boolean;
  /** Key of the selected filter; without it the first filter. The bar keeps the user's choice until this prop changes. */
  selectedKey?: string;
  /** (false) */
  upperCase?: boolean;
  /** (false) The bar fills the parent's height and the content scrolls. */
  stretchContentHeight?: boolean;
  /** (true) */
  applyContentPadding?: boolean;
  /** ('Solid') Background of the content. */
  backgroundDesign?: BackgroundDesign;
  /** ('Standard') Inline: text and count on one line. */
  headerMode?: IconTabHeaderMode;
  /** ('Solid') */
  headerBackgroundDesign?: BackgroundDesign;
  /** (false) Tabs can be moved by drag and drop and with Ctrl + arrow keys. */
  enableTabReordering?: boolean;
  /** (0) Kept for UI5 compatibility: drag and drop reorders on the top level only. */
  maxNestingLevel?: number;
  /** ('Cozy') */
  tabDensityMode?: IconTabDensityMode;
  /** Accessible texts of the header (UI5 `ariaTexts`). */
  ariaTexts?: { headerLabel?: string; headerDescription?: string };
  /** ('End') Where the overflow buttons go when the tabs do not fit. */
  tabsOverflowMode?: TabsOverflowMode;
  onSelect?(e: { item: IconTabFilterItem; key: string; previousKey: string | undefined; selectedItem: IconTabFilterItem; selectedKey: string }): void;
  onExpand?(e: { expand: boolean; collapse: boolean }): void;
}

/** Reads the filter tree from JSX (fragments are flattened; keys are the React keys). */
function itemsOf(children: ReactNode, rootKey?: string, path = ''): IconTabItem[] {
  const out: IconTabItem[] = [];
  let n = 0;
  const walk = (nodes: ReactNode) => Children.forEach(nodes, (c) => {
    if (!isValidElement(c)) return;
    if (c.type === Fragment) { walk((c.props as { children?: ReactNode }).children); return; }
    const key = c.key ?? `${path}${n}`;
    n += 1;
    if (c.type === IconTabSeparator) out.push({ kind: 'separator', key, ...(c.props as $IconTabSeparatorSettings) });
    if (c.type === IconTabFilter) {
      const { children: inner, ...props } = c.props as $IconTabFilterSettings;
      const content: ReactNode[] = [];
      Children.forEach(inner, (x) => { if (!(isValidElement(x) && (x.type === IconTabFilter || x.type === IconTabSeparator))) content.push(x); });
      out.push({ kind: 'filter', ...props, key, rootKey: rootKey ?? key, content, items: itemsOf(inner, rootKey ?? key, `${key}.`) });
    }
  });
  walk(children);
  return out;
}

const filtersIn = (items: IconTabItem[]): IconTabFilterItem[] => items.flatMap((i) => (i.kind === 'filter' && i.visible !== false ? [i, ...filtersIn(i.items)] : []));
const hasContent = (f: IconTabFilterItem) => f.content.some((c) => c !== null && c !== undefined && c !== false && c !== '');
/** Whether pressing the filter selects it (otherwise it opens the menu of its child filters). */
const selectable = (f: IconTabFilterItem) => {
  const leaf = !f.items.some((i) => i.kind === 'filter' && i.visible !== false);
  if (leaf) return true;
  const mode = f.interactionMode ?? 'Auto';
  return mode === 'Select' || (mode === 'Auto' && hasContent(f));
};

const TONE: Record<IconColor, string> = {
  Default: 'default', Positive: 'positive', Critical: 'critical', Negative: 'negative', Neutral: 'neutral', Contrast: 'contrast', Marker: 'marker', NonInteractive: 'noninteractive', Tile: 'tile',
};

export function IconTabBar(p: $IconTabBarSettings) {
  const t = useControlText(TEXTS);
  const uid = useId();
  const all = itemsOf(p.children);
  const filters = filtersIn(all);
  const first = filters.find((f) => f.enabled !== false && selectable(f));
  const [selected, setSelected] = useState<string | undefined>(p.selectedKey);
  const [expanded, setExpanded] = useState(p.expanded ?? true);
  // Follow the props when they change (UI5 property semantics: the control also changes them).
  const [propSel, setPropSel] = useState(p.selectedKey);
  if (propSel !== p.selectedKey) { setPropSel(p.selectedKey); setSelected(p.selectedKey); }
  const [propExp, setPropExp] = useState(p.expanded);
  if (propExp !== p.expanded) { setPropExp(p.expanded); setExpanded(p.expanded ?? true); }

  const current = filters.find((f) => f.key === selected) ?? first;
  const [order, setOrder] = useState<string[]>([]);
  const top = all.filter((i) => i.visible !== false);
  const ordered = [...top].sort((a, b) => {
    const ia = order.indexOf(a.key);
    const ib = order.indexOf(b.key);
    return (ia < 0 ? top.indexOf(a) + 1e6 : ia) - (ib < 0 ? top.indexOf(b) + 1e6 : ib);
  });

  // Overflow: measure each top-level item once it is shown, keep the widths, hide what does not fit.
  const header = useRef<HTMLDivElement>(null);
  const widths = useRef(new Map<string, number>());
  const moreWidth = useRef(0);
  const [hidden, setHidden] = useState<{ start: string[]; end: string[] }>({ start: [], end: [] });
  const [tick, setTick] = useState(0);
  const orderKey = ordered.map((i) => i.key).join('|');
  useLayoutEffect(() => {
    const el = header.current;
    if (!el) return;
    el.querySelectorAll<HTMLElement>('[data-sk-itb-item]').forEach((n) => { if (n.offsetWidth) widths.current.set(n.dataset.skItbItem!, n.offsetWidth); });
    el.querySelectorAll<HTMLElement>('[data-sk-itb-more]').forEach((n) => { if (n.offsetWidth) moreWidth.current = Math.max(moreWidth.current, n.offsetWidth); });
    const avail = el.clientWidth;
    const keys = orderKey ? orderKey.split('|') : [];
    const w = (k: string) => widths.current.get(k) ?? 0;
    const total = keys.reduce((s, k) => s + w(k), 0);
    let next: { start: string[]; end: string[] } = { start: [], end: [] };
    if (avail > 0 && total > avail) {
      const sel = keys.indexOf(current?.rootKey ?? '');
      const both = (p.tabsOverflowMode ?? 'End') === 'StartAndEnd';
      const room = avail - moreWidth.current * (both ? 2 : 1);
      // The window [a, b) of shown items: from the start, moved right until the selected tab is inside.
      let a = 0;
      const fits = (from: number) => { let s = 0; let b = from; while (b < keys.length && s + w(keys[b]!) <= room) { s += w(keys[b]!); b += 1; } return b; };
      let b = fits(a);
      if (sel >= b) {
        if (both) { while (sel >= b && a < sel) { a += 1; b = fits(a); } }
        else b = Math.max(1, b);
      }
      next = { start: keys.slice(0, a), end: keys.slice(b) };
      // End mode: the selected tab replaces the last shown one.
      if (!both && sel >= b && b > 0) next = { start: [], end: [...keys.slice(b - 1, sel), ...keys.slice(sel + 1)] };
    }
    setHidden((h) => (h.start.join('|') === next.start.join('|') && h.end.join('|') === next.end.join('|') ? h : next));
  }, [orderKey, tick, current?.rootKey, p.tabsOverflowMode]);
  useEffect(() => {
    const el = header.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => setTick((x) => x + 1));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const select = (f: IconTabFilterItem) => {
    if (f.enabled === false) return;
    const previousKey = current?.key;
    if (f.key === previousKey) {
      if (p.expandable ?? true) {
        const exp = !expanded;
        setExpanded(exp);
        p.onExpand?.({ expand: exp, collapse: !exp });
      }
      return;
    }
    setSelected(f.key);
    if (!expanded) { setExpanded(true); p.onExpand?.({ expand: true, collapse: false }); }
    p.onSelect?.({ item: f, key: f.key, previousKey, selectedItem: f, selectedKey: f.key });
  };

  // Keyboard: arrows move the focus, Ctrl + arrows move the tab (reordering), Home / End.
  const tabsRef = useRef<HTMLDivElement>(null);
  const focusables = () => [...(tabsRef.current?.querySelectorAll<HTMLElement>('[role="tab"]:not([disabled])') ?? [])].filter((n) => !n.closest('[hidden]'));
  const move = (key: string, delta: number) => {
    const keys = ordered.map((i) => i.key);
    const i = keys.indexOf(key);
    // Move past the next tab (separators are passed over).
    let j = i + delta;
    while (j > 0 && j < keys.length - 1 && ordered[j]!.kind === 'separator') j += delta;
    j = Math.max(0, Math.min(keys.length - 1, j));
    if (i < 0 || i === j) return;
    keys.splice(j, 0, keys.splice(i, 1)[0]!);
    setOrder(keys);
  };
  const onKey = (e: KeyboardEvent<HTMLElement>, key: string) => {
    const horizontal = e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === 'ArrowDown' || e.key === 'ArrowUp';
    if (horizontal && (e.ctrlKey || e.metaKey) && p.enableTabReordering) {
      e.preventDefault();
      move(key, e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1);
      requestAnimationFrame(() => [...(tabsRef.current?.querySelectorAll<HTMLElement>('[data-sk-itb-key]') ?? [])].find((n) => n.dataset.skItbKey === key)?.focus());
      return;
    }
    const list = focusables();
    const i = list.indexOf(e.currentTarget);
    let target: HTMLElement | undefined;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') target = list[(i + 1) % list.length];
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') target = list[(i - 1 + list.length) % list.length];
    else if (e.key === 'Home') target = list[0];
    else if (e.key === 'End') target = list.at(-1);
    if (target) { e.preventDefault(); target.focus(); }
  };
  const drag = useRef<string | null>(null);
  const dnd = (key: string) => (p.enableTabReordering ? {
    draggable: true,
    onDragStart: (e: DragEvent) => { drag.current = key; e.dataTransfer?.setData('text/plain', key); },
    onDragOver: (e: DragEvent) => { if (drag.current && drag.current !== key) e.preventDefault(); },
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      const from = drag.current;
      drag.current = null;
      if (!from || from === key) return;
      const keys = ordered.map((i) => i.key).filter((k) => k !== from);
      keys.splice(keys.indexOf(key) + (ordered.findIndex((i) => i.key === from) < ordered.findIndex((i) => i.key === key) ? 1 : 0), 0, from);
      setOrder(keys);
    },
  } : {});

  const anyIcon = filters.some((f) => f.icon !== undefined && f.icon !== null);
  const inline = (p.headerMode ?? 'Standard') === 'Inline';
  const tabId = (key: string) => `${uid}-tab-${key}`;
  const panelId = `${uid}-panel`;
  const descId = `${uid}-desc`;
  const rootSelected = current?.rootKey;

  const label = (f: IconTabFilterItem, inMenu = false) => {
    const count = f.count ? <span className="sk-itb__count">{f.count}</span> : null;
    const text = f.text ? <span className="sk-itb__text">{f.text}</span> : null;
    if (inline || inMenu) return <span className="sk-itb__inline">{inMenu && f.icon ? <span className={`sk-itb__menu-icon sk-itb__tone--${TONE[f.iconColor ?? 'Default']}`}>{f.icon}</span> : null}{text}{f.count ? <span className="sk-itb__count"> ({f.count})</span> : null}</span>;
    if (f.showAll) return <span className="sk-itb__all">{count}{text}</span>;
    if (!anyIcon) return <span className="sk-itb__textonly">{count}{text}</span>;
    const icon = <span className={`sk-itb__icon sk-itb__tone--${TONE[f.iconColor ?? 'Default']}`} aria-hidden>{f.icon}</span>;
    return (f.design ?? 'Vertical') === 'Horizontal'
      ? <span className="sk-itb__horizontal">{icon}<span className="sk-itb__stack">{count}{text}</span></span>
      : <span className="sk-itb__vertical"><span className="sk-itb__top">{icon}{count}</span>{text}</span>;
  };

  /** Menu entries of filters (nested ones indented). */
  const menuItems = (items: IconTabItem[], level = 0): ReactElement[] => items.flatMap((i) => {
    if (i.visible === false) return [];
    if (i.kind === 'separator') return [<Menu.Divider key={i.key} />];
    const entry = (
      <Menu.Item key={i.key} disabled={i.enabled === false || (!selectable(i) && (i.interactionMode ?? 'Auto') !== 'Auto')} onClick={() => { if (selectable(i)) select(i); }}
        className={`sk-itb__menu-item${i.key === current?.key ? ' sk-itb__menu-item--selected' : ''}`} style={{ paddingInlineStart: `calc(var(--sk-space-4) + ${level} * var(--sk-space-5))` }}
        data-sk-itb-menu-key={i.key} aria-current={i.key === current?.key || undefined}>
        {label(i, true)}
      </Menu.Item>
    );
    return [entry, ...menuItems(i.items, level + 1)];
  });

  const overflow = (keys: string[], where: 'start' | 'end') => {
    if (!keys.length) return null;
    const items = ordered.filter((i) => keys.includes(i.key));
    const count = filtersIn(items).length;
    return (
      <Menu position={where === 'start' ? 'bottom-start' : 'bottom-end'} withinPortal>
        <Menu.Target>
          <button type="button" className="sk-itb__more" data-sk-itb-more={where} aria-haspopup="menu" title={t('ctl.tabs.more')}>
            <span>{where === 'start' ? t('ctl.tabs.overflow', { count }) : t('ctl.tabs.more')}</span>
            <ChevronDown className="sk-icon" aria-hidden />
          </button>
        </Menu.Target>
        <Menu.Dropdown className="sk-itb__menu">{menuItems(items)}</Menu.Dropdown>
      </Menu>
    );
  };

  const tab = (f: IconTabFilterItem) => {
    const isSel = f.key === rootSelected;
    const hasSub = f.items.some((i) => i.kind === 'filter' && i.visible !== false);
    const opensMenu = hasSub && !selectable(f);
    const button = (
      <button
        type="button" role="tab" id={tabId(f.key)} aria-selected={isSel} aria-controls={isSel ? panelId : undefined} aria-disabled={f.enabled === false || undefined}
        aria-haspopup={hasSub ? 'menu' : undefined} aria-expanded={isSel && (p.expandable ?? true) ? expanded : undefined}
        tabIndex={isSel || (!rootSelected && f === filters[0]) ? 0 : -1} disabled={f.enabled === false} data-sk-itb-key={f.key}
        className={`sk-itb__tab sk-itb__tab--${TONE[f.iconColor ?? 'Default']}${isSel ? ' sk-itb__tab--selected' : ''}`}
        onClick={opensMenu ? undefined : () => select(f)} onKeyDown={(e) => onKey(e, f.key)}
      >
        {label(f)}
        {hasSub && <ChevronDown className="sk-icon sk-itb__expand" aria-hidden />}
      </button>
    );
    if (!hasSub) return button;
    return (
      <Menu position="bottom-start" withinPortal>
        <Menu.Target>{button}</Menu.Target>
        <Menu.Dropdown className="sk-itb__menu">
          {selectable(f) && menuItems([{ ...f, items: [], kind: 'filter' }])}
          {menuItems(f.items)}
        </Menu.Dropdown>
      </Menu>
    );
  };

  const content = current && hasContent(current) ? current.content : p.content;
  const density = (p.tabDensityMode ?? 'Cozy').toLowerCase();
  return (
    <div
      className={[
        'sk-itb', `sk-itb--${density}`, `sk-itb--bg-${(p.backgroundDesign ?? 'Solid').toLowerCase()}`, `sk-itb--header-bg-${(p.headerBackgroundDesign ?? 'Solid').toLowerCase()}`,
        p.upperCase ? 'sk-itb--upper' : '', p.stretchContentHeight ? 'sk-itb--stretch' : '', inline ? 'sk-itb--inline' : '', anyIcon ? '' : 'sk-itb--textonly',
      ].filter(Boolean).join(' ')}
    >
      <div className="sk-itb__header" ref={header}>
        {overflow(hidden.start, 'start')}
        <div
          ref={tabsRef} role="tablist" className="sk-itb__tabs" aria-label={p.ariaTexts?.headerLabel} aria-describedby={p.ariaTexts?.headerDescription ? descId : undefined}
          aria-orientation="horizontal"
        >
          {ordered.map((i) => {
            const isHidden = hidden.start.includes(i.key) || hidden.end.includes(i.key);
            return (
              <div key={i.key} className={`sk-itb__item${isHidden ? ' sk-itb__item--hidden' : ''}`} data-sk-itb-item={i.key} hidden={isHidden} {...(i.kind === 'filter' ? dnd(i.key) : {})}>
                {i.kind === 'filter' ? tab(i) : <span className="sk-itb__separator" role="separator" aria-orientation="vertical">{i.icon}</span>}
              </div>
            );
          })}
        </div>
        {overflow(hidden.end, 'end')}
        {p.ariaTexts?.headerDescription && <span id={descId} hidden>{p.ariaTexts.headerDescription}</span>}
      </div>
      {current && (
        <div
          role="tabpanel" id={panelId} aria-labelledby={tabId(current.rootKey)} hidden={!expanded}
          className={`sk-itb__content${(p.applyContentPadding ?? true) ? ' sk-itb__content--padded' : ''}`}
        >
          {expanded ? content : null}
        </div>
      )}
    </div>
  );
}
