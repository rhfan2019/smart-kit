/**
 * sap.uxap.AnchorBar (ADR-033): anchors, subsection menus (`showPopover`), overflow menu, dropdown on small screens (OP-08).
 * ObjectPageLayout renders the same bar as tabs when `useIconTabBar` is set.
 */
import { ActionIcon, Menu, Select, UnstyledButton } from '@mantine/core';
import { useElementSize, useMediaQuery } from '@mantine/hooks';
import { ChevronDown, ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import { useEffect, useImperativeHandle, useRef, useState, type KeyboardEvent, type MouseEvent, type Ref } from 'react';
import { useText } from '../context/SmartKitProvider';
import type { BackgroundDesign } from '../controls/dialogs/IconTabBar';
import type { AriaHasPopup } from '../controls/display/ToggleButton';
import type { ToolbarDesign, ToolbarStyle } from '../controls/display/OverflowToolbar';

export interface AnchorItem {
  id: string;
  title: string;
  count?: number;
  subSections: { id: string; title: string }[];
}

export interface $AnchorBarSettings {
  /** The anchors: one per section, with the subsections for the popover. */
  content?: AnchorItem[];
  /** Id of the selected anchor (section). */
  selectedButton?: string;
  /** Anchors of sections with several subsections open a menu of the subsections. @defaultValue true */
  showPopover?: boolean;
  /** Anchor texts in upper case. @defaultValue false */
  upperCase?: boolean;
  /** Background of the bar. */
  backgroundDesign?: BackgroundDesign;
  /** Width (CSS length; default 100%). */
  width?: string;
  /** The whole bar is clickable and fires onPress. @defaultValue false */
  active?: boolean;
  /** Enabled; a disabled bar disables its anchors. @defaultValue true */
  enabled?: boolean;
  /** Height (CSS length; default: the bar height). */
  height?: string;
  /** Background design of the toolbar. @defaultValue 'Auto' */
  design?: ToolbarDesign;
  /** Clear removes the border. @defaultValue 'Standard' */
  style?: ToolbarStyle;
  /** aria-haspopup of an active bar. */
  ariaHasPopup?: AriaHasPopup;
  /** Fired when an active bar is pressed outside its anchors; `srcControl` is the clicked element. */
  onPress?(e: AnchorBar$PressEvent): void;
  /** Extension: an anchor (and optionally one of its subsections) was chosen; the page scrolls to it. */
  onSelect?(sectionId: string, subSectionId?: string): void;
  ref?: Ref<AnchorBar>;
}

/** Event object of AnchorBar's press. */
export interface AnchorBar$PressEvent {
  /** The clicked element. */
  srcControl: HTMLElement;
}

/** Instance methods of AnchorBar. */
export interface AnchorBar {
  /** Scrolls the bar so that the anchor of the section is visible (`iDuration` 0: without animation). */
  scrollToSection(sId: string, iDuration?: number): void;
  /** Scrolls the bar so that the selected anchor is visible. */
  scrollToCurrentlySelectedSection(): void;
}

const NO_ITEMS: AnchorItem[] = [];

/** sap.uxap.AnchorBar. */
export function AnchorBar(p: $AnchorBarSettings) {
  return <SectionBar {...p} />;
}

/** The anchor bar, or the tab bar of an ObjectPageLayout with `useIconTabBar` (OP-09). */
export function SectionBar({ tabs: tabMode, ...p }: $AnchorBarSettings & { tabs?: boolean }) {
  const t = useText();
  const items = p.content ?? NO_ITEMS;
  const select = (sectionId: string, sub?: string) => p.onSelect?.(sectionId, sub);
  const popover = p.showPopover !== false;
  const small = useMediaQuery('(max-width: 599px)');
  const { ref: barRef, width } = useElementSize();
  const listRef = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);
  const [edges, setEdges] = useState({ start: true, end: true });
  const updateEdges = () => {
    const el = listRef.current;
    if (!el) return;
    setOverflowing(el.scrollWidth > el.clientWidth + 1);
    setEdges({ start: el.scrollLeft <= 1, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 1 });
  };
  useEffect(updateEdges, [width, items]);
  // Overflow carousel buttons (OP anchor bar (6)): scroll the anchors horizontally by most of the visible width.
  const scrollBy = (dir: 1 | -1) => {
    const el = listRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(80, el.clientWidth * 0.7), behavior: 'smooth' });
  };
  const reveal = (el: HTMLElement | null | undefined, duration?: number) => el?.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: duration === 0 ? 'auto' : undefined });
  useImperativeHandle(p.ref, () => ({
    scrollToSection: (sId, iDuration) => reveal(listRef.current?.querySelector<HTMLElement>(`[data-sk-anchor="${CSS.escape(sId)}"]`), iDuration),
    scrollToCurrentlySelectedSection: () => reveal(listRef.current?.querySelector<HTMLElement>('[aria-current="true"]')),
  }));
  // Keep the active anchor visible while scrolling.
  useEffect(() => {
    reveal(listRef.current?.querySelector<HTMLElement>('[aria-current="true"]'));
  }, [p.selectedButton]);

  const label = (it: AnchorItem) => (it.count === undefined ? it.title : `${it.title} (${it.count})`);

  if (small && !tabMode) {
    const data = items.flatMap((it) => [{ value: it.id, label: it.title }, ...(it.subSections.length > 1 ? it.subSections.map((s) => ({ value: `${it.id}::sub::${s.id}`, label: `— ${s.title}` })) : [])]);
    return (
      <div className="sk-anchorbar sk-anchorbar--select">
        <Select aria-label={t('object.sections')} value={p.selectedButton ?? null} data={data} allowDeselect={false} onChange={(v) => { if (!v) return; const [s, sub] = v.split('::sub::'); select(s!, sub); }} />
      </div>
    );
  }

  const active = p.active === true;
  const press = (e: MouseEvent<HTMLElement>) => {
    if (!active || p.enabled === false) return;
    const target = e.target as HTMLElement;
    const hit = target.closest('button, a, input, [role="button"], [role="tab"], [tabindex]');
    if (hit && hit !== e.currentTarget && e.currentTarget.contains(hit)) return;
    p.onPress?.({ srcControl: target });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const buttons = [...(listRef.current?.querySelectorAll<HTMLElement>('[data-sk-anchor]') ?? [])];
    const i = buttons.indexOf(document.activeElement as HTMLElement);
    const next = buttons[(i + (e.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length];
    next?.focus();
    e.preventDefault();
  };

  return (
    <nav
      className={['sk-anchorbar', tabMode ? 'sk-anchorbar--tabs' : '', p.upperCase ? 'sk-anchorbar--upper' : '', `sk-anchorbar--${(p.design ?? 'Auto').toLowerCase()}`, p.style === 'Clear' ? 'sk-anchorbar--clear' : '', active ? 'sk-anchorbar--active' : ''].filter(Boolean).join(' ')}
      aria-label={t('object.sections')} ref={barRef} inert={p.enabled === false} aria-disabled={p.enabled === false ? true : undefined}
      aria-haspopup={active && p.ariaHasPopup && p.ariaHasPopup !== 'None' ? (p.ariaHasPopup.toLowerCase() as 'menu') : undefined}
      style={{ ...(p.width ? { width: p.width } : {}), ...(p.height ? { height: p.height, minHeight: p.height } : {}) }}
      data-background-design={p.backgroundDesign} onClick={press}
    >
      {overflowing && !edges.start ? (
        <ActionIcon variant="subtle" size="sm" aria-label={t('layout.previous')} tabIndex={-1} onClick={() => scrollBy(-1)} data-sk-anchor-scroll="back"><ChevronLeft className="sk-icon" /></ActionIcon>
      ) : null}
      <div className="sk-anchorbar__list" ref={listRef} role={tabMode ? 'tablist' : undefined} onKeyDown={onKeyDown} onScroll={updateEdges}>
        {items.map((it) => {
          const active = it.id === p.selectedButton;
          return (
            <div key={it.id} className="sk-anchorbar__item" data-active={active || undefined} role={tabMode ? 'presentation' : undefined}>
              <UnstyledButton
                className="sk-anchorbar__anchor"
                data-sk-anchor={it.id}
                aria-current={active ? 'true' : undefined}
                role={tabMode ? 'tab' : undefined}
                aria-selected={tabMode ? active : undefined}
                onClick={() => select(it.id)}
              >
                {label(it)}
              </UnstyledButton>
              {popover && it.subSections.length > 1 ? (
                <Menu position="bottom-start">
                  <Menu.Target>
                    {/* In a tablist only tabs are allowed; the tab content shows all subsections, so the menu is a pointer shortcut there. */}
                    <ActionIcon size="sm" aria-label={t('object.subsections', { name: it.title })} data-sk-anchor-menu={it.id} {...(tabMode ? { 'aria-hidden': true, tabIndex: -1 } : {})}><ChevronDown className="sk-icon" /></ActionIcon>
                  </Menu.Target>
                  <Menu.Dropdown>
                    {it.subSections.map((s) => <Menu.Item key={s.id} onClick={() => select(it.id, s.id)}>{s.title}</Menu.Item>)}
                  </Menu.Dropdown>
                </Menu>
              ) : null}
            </div>
          );
        })}
      </div>
      {overflowing && !edges.end ? (
        <ActionIcon variant="subtle" size="sm" aria-label={t('layout.next')} tabIndex={-1} onClick={() => scrollBy(1)} data-sk-anchor-scroll="forward"><ChevronRight className="sk-icon" /></ActionIcon>
      ) : null}
      {overflowing && !tabMode ? (
        <Menu position="bottom-end">
          <Menu.Target>
            <ActionIcon aria-label={t('object.moreSections')} data-sk-anchor-overflow><MoreHorizontal className="sk-icon" /></ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            {items.map((it) => (
              <div key={it.id}>
                <Menu.Item onClick={() => select(it.id)} fw={600} data-sk-overflow-section={it.id}>{label(it)}</Menu.Item>
                {it.subSections.length > 1 ? it.subSections.map((s) => <Menu.Item key={s.id} pl="xl" onClick={() => select(it.id, s.id)} data-sk-overflow-subsection={s.id}>{s.title}</Menu.Item>) : null}
              </div>
            ))}
          </Menu.Dropdown>
        </Menu>
      ) : null}
    </nav>
  );
}
