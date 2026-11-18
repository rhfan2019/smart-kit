/**
 * sap.m.OverflowToolbar, sap.m.OverflowToolbarLayoutData, sap.m.OverflowToolbarButton and sap.m.ToolbarSpacer (docs/26 §3.5).
 * Children that do not fit move into a "More" popover: Low (and Disappear) first, then High, each from right to left; a
 * child's `layoutData` prop stands for the SAPUI5 layoutData aggregation.
 */
import { ActionIcon, Button, Popover } from '@mantine/core';
import { Ellipsis } from 'lucide-react';
import {
  Children, createContext, createElement, isValidElement, useContext, useImperativeHandle, useLayoutEffect, useRef, useState,
  type HTMLAttributes, type KeyboardEvent, type MouseEvent, type ReactElement, type ReactNode, type Ref,
} from 'react';
import { useControlText } from '../context';
import type { AriaHasPopup, ButtonType } from './ToggleButton';
import { cx } from './shared';
import { TEXTS } from './texts';

/** sap.m.OverflowToolbarPriority */
export type OverflowToolbarPriority = 'NeverOverflow' | 'High' | 'Low' | 'Disappear' | 'AlwaysOverflow';
export const OverflowToolbarPriority = { NeverOverflow: 'NeverOverflow', High: 'High', Low: 'Low', Disappear: 'Disappear', AlwaysOverflow: 'AlwaysOverflow' } as const;

/** sap.m.ToolbarDesign */
export type ToolbarDesign = 'Auto' | 'Transparent' | 'Solid' | 'Info';
export const ToolbarDesign = { Auto: 'Auto', Transparent: 'Transparent', Solid: 'Solid', Info: 'Info' } as const;

/** sap.m.ToolbarStyle */
export type ToolbarStyle = 'Standard' | 'Clear';
export const ToolbarStyle = { Standard: 'Standard', Clear: 'Clear' } as const;

/** sap.m.OverflowToolbarLayoutData: set it on a toolbar child as the `layoutData` prop. */
export interface OverflowToolbarLayoutData {
  /** When the child moves into the overflow (default High). */
  priority?: OverflowToolbarPriority;
  /** Children with the same non-zero group move into the overflow together (default 0). */
  group?: number;
  /** Pressing the child in the overflow closes the overflow (default true). */
  closeOverflowOnInteraction?: boolean;
}

/** True inside the overflow popover of an OverflowToolbar (OverflowToolbarButton shows its text there). */
const InOverflow = createContext(false);

export interface ToolbarSpacerProps {
  /** Fixed width (CSS length); without it the spacer takes the remaining space. */
  width?: string;
}

/** Pushes the following toolbar content to the end, or adds a fixed gap with `width`. */
export function ToolbarSpacer({ width }: ToolbarSpacerProps) {
  return <span className={cx('sk-toolbar-spacer', !width && 'sk-toolbar-spacer--flex')} style={width ? { width } : undefined} aria-hidden data-sk-toolbar-spacer />;
}

export interface OverflowToolbarButtonProps {
  /** Text: the tooltip and accessible name in the toolbar, shown next to the icon in the overflow. */
  text: string;
  /** Icon (a React node). */
  icon?: ReactNode;
  /** Visual type (default Transparent in the toolbar). */
  type?: ButtonType;
  /** Enabled (default true). */
  enabled?: boolean;
  /** Width (CSS length). */
  width?: string;
  /** Layout data in the OverflowToolbar. */
  layoutData?: OverflowToolbarLayoutData;
  /** Fired when the button is pressed. */
  onPress?(e: Record<string, never>): void;
  title?: string;
  'data-testid'?: string;
}

/** sap.m.OverflowToolbarButton: icon only in the toolbar, icon and text in the overflow. */
export function OverflowToolbarButton({ text, icon, type = 'Transparent', enabled = true, width, layoutData: _layoutData, onPress, title, ...rest }: OverflowToolbarButtonProps) {
  const inOverflow = useContext(InOverflow);
  const variant = type === 'Emphasized' ? 'filled' : type === 'Default' ? 'default' : 'subtle';
  const common = { ...rest, variant, disabled: !enabled, onClick: () => onPress?.({}), style: width ? { width } : undefined, 'data-sk-overflow-toolbar-button': inOverflow ? 'overflow' : 'toolbar' };
  return inOverflow || !icon ? (
    <Button {...common} leftSection={icon} title={title}>{text}</Button>
  ) : <ActionIcon {...common} aria-label={text} title={title ?? text}>{icon}</ActionIcon>;
}

export interface OverflowToolbarProps extends Omit<HTMLAttributes<HTMLDivElement>, 'style'> {
  /** Width (CSS length; default 100%). */
  width?: string;
  /** The whole toolbar is clickable and fires onPress (default false). */
  active?: boolean;
  /** Enabled (default true); a disabled toolbar disables its content. */
  enabled?: boolean;
  /** Height (CSS length; default: the control height). */
  height?: string;
  /** Background design (default Auto: transparent). */
  design?: ToolbarDesign;
  /** Clear removes the border (default Standard). */
  style?: ToolbarStyle;
  /** aria-haspopup of an active toolbar. */
  ariaHasPopup?: AriaHasPopup;
  /** Accepted for compatibility; the layout is always computed synchronously (default false). */
  asyncMode?: boolean;
  /** Fired when an active toolbar is pressed outside its interactive content; `srcControl` is the clicked element. */
  onPress?(e: { srcControl: HTMLElement }): void;
  /** Toolbar content: buttons, texts, ToolbarSpacer; `layoutData` on a child sets its overflow priority. */
  children?: ReactNode;
  ref?: Ref<OverflowToolbarRef>;
}

/** Instance methods of OverflowToolbar. */
export interface OverflowToolbarRef {
  /** Closes the overflow popover. */
  closeOverflow(): void;
  /** The toolbar element. */
  readonly element: HTMLDivElement | null;
}

const RANK: Record<OverflowToolbarPriority, number> = { Disappear: 0, Low: 0, High: 1, NeverOverflow: 2, AlwaysOverflow: 3 };

interface Item { el: ReactElement; data: OverflowToolbarLayoutData; priority: OverflowToolbarPriority; spacer: boolean }

/**
 * Indices to hide so the widths fit `available`. AlwaysOverflow items are always hidden; then Low and Disappear, then High,
 * each from right to left; items of the same group move together (a group takes its highest priority and its rightmost position).
 */
export function overflowIndices(widths: number[], data: OverflowToolbarLayoutData[], available: number, gap: number, moreWidth: number): Set<number> {
  const prio = (i: number) => data[i]?.priority ?? 'High';
  const hidden = new Set(data.flatMap((_, i) => (prio(i) === 'AlwaysOverflow' ? [i] : [])));
  const units: number[][] = [];
  const byGroup = new Map<number, number[]>();
  data.forEach((d, i) => {
    if (prio(i) === 'AlwaysOverflow') return;
    if (d.group) {
      const g = byGroup.get(d.group);
      if (g) return g.push(i);
      const unit = [i];
      byGroup.set(d.group, unit);
      units.push(unit);
    } else units.push([i]);
  });
  const rank = (u: number[]) => Math.max(...u.map((i) => RANK[prio(i)]));
  const movable = units.filter((u) => rank(u) < 2).sort((a, b) => rank(a) - rank(b) || Math.max(...b) - Math.max(...a));
  const used = () => widths.reduce((n, w, i) => (hidden.has(i) ? n : n + w + gap), -gap);
  const fits = () => used() + ([...hidden].some((i) => prio(i) !== 'Disappear') ? moreWidth + gap : 0) <= available;
  for (const u of movable) {
    if (fits()) break;
    u.forEach((i) => hidden.add(i));
  }
  return hidden;
}

const isInteractive = (target: HTMLElement, root: HTMLElement) => {
  if (!root.contains(target)) return true; // events bubbling from the overflow popover (a portal)
  const hit = target.closest('button, a, input, select, textarea, [role="button"], [tabindex]');
  return !!hit && hit !== root && root.contains(hit);
};

/** Renders a child without its `layoutData` prop (it is not a DOM attribute). */
function bare(el: ReactElement): ReactElement {
  const props = el.props as Record<string, unknown>;
  if (!('layoutData' in props)) return el;
  const { layoutData: _ignored, ...rest } = props;
  return createElement(el.type, { ...rest, key: el.key });
}

export function OverflowToolbar({
  width, active = false, enabled = true, height, design = 'Auto', style = 'Standard', ariaHasPopup, asyncMode: _asyncMode, onPress, children, className, ref, ...rest
}: OverflowToolbarProps) {
  const t = useControlText(TEXTS);
  const boxRef = useRef<HTMLDivElement>(null);
  const widths = useRef<number[]>([]);
  const [hidden, setHidden] = useState<Set<number>>(new Set());
  const [open, setOpen] = useState(false);
  useImperativeHandle(ref, () => ({ closeOverflow: () => setOpen(false), get element() { return boxRef.current; } }));
  const items: Item[] = (Children.toArray(children).filter(isValidElement) as ReactElement[]).map((el) => {
    const spacer = el.type === ToolbarSpacer;
    const data = spacer ? { priority: 'NeverOverflow' as const } : ((el.props as { layoutData?: OverflowToolbarLayoutData }).layoutData ?? {});
    return { el, data, priority: data.priority ?? 'High', spacer };
  });
  const key = items.map((it) => `${String(it.el.key)}:${it.priority}:${it.data.group ?? 0}`).join('|');
  const latest = useRef(items);
  latest.current = items;

  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const compute = () => {
      const list = latest.current;
      // measure the visible items; hidden ones keep their last width
      for (const node of box.querySelectorAll<HTMLElement>(':scope > [data-sk-toolbar-item]')) {
        const i = Number(node.dataset.skToolbarItem);
        widths.current[i] = node.classList.contains('sk-overflow-toolbar__item--grow') ? 0 : node.offsetWidth;
      }
      const cs = getComputedStyle(box);
      const gap = parseFloat(cs.columnGap) || 0;
      const available = box.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
      const more = box.querySelector<HTMLElement>('[data-sk-toolbar-more]')?.offsetWidth || box.querySelector<HTMLElement>('[data-sk-toolbar-probe]')?.offsetWidth || 0;
      const data = list.map((it) => ({ ...it.data, priority: it.priority }));
      const next = available > 0
        ? overflowIndices(list.map((_, i) => widths.current[i] ?? 0), data, available, gap, more)
        : new Set(list.flatMap((it, i) => (it.priority === 'AlwaysOverflow' ? [i] : [])));
      setHidden((prev) => (prev.size === next.size && [...next].every((i) => prev.has(i)) ? prev : next));
    };
    compute();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(compute);
    ro.observe(box);
    return () => ro.disconnect();
  }, [key]);

  const overflow = items.flatMap((it, i) => (hidden.has(i) && it.priority !== 'Disappear' ? [it] : []));
  const press = (e: MouseEvent<HTMLDivElement> | KeyboardEvent<HTMLDivElement>) => {
    if (!active || !enabled || !boxRef.current) return;
    if (isInteractive(e.target as HTMLElement, boxRef.current)) return;
    onPress?.({ srcControl: e.target as HTMLElement });
  };
  return (
    <div
      {...rest} ref={boxRef} role="toolbar" inert={!enabled} aria-disabled={enabled ? undefined : true}
      tabIndex={active && enabled ? 0 : undefined} aria-haspopup={active && ariaHasPopup && ariaHasPopup !== 'None' ? (ariaHasPopup.toLowerCase() as 'menu') : undefined}
      style={{ ...(width ? { width } : {}), ...(height ? { height, minHeight: height } : {}) }}
      className={cx(
        'sk-overflow-toolbar', `sk-overflow-toolbar--${design.toLowerCase()}`, style === 'Clear' && 'sk-overflow-toolbar--clear', active && 'sk-overflow-toolbar--active',
        !enabled && 'sk-overflow-toolbar--disabled', className,
      )}
      onClick={press} onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); press(e); } }}
      data-sk-overflow-toolbar
    >
      {items.map((it, i) => (hidden.has(i) ? null : (
        <div key={it.el.key ?? i} className={cx('sk-overflow-toolbar__item', it.spacer && !(it.el.props as ToolbarSpacerProps).width && 'sk-overflow-toolbar__item--grow')} data-sk-toolbar-item={i}>{bare(it.el)}</div>
      )))}
      {overflow.length ? (
        <Popover opened={open} onChange={setOpen} position="bottom-end" shadow="md">
          <Popover.Target>
            <ActionIcon variant="subtle" aria-label={t('ctl.overflowToolbar.more')} aria-haspopup="true" aria-expanded={open} onClick={() => setOpen((o) => !o)} data-sk-toolbar-more>
              <Ellipsis className="sk-icon" />
            </ActionIcon>
          </Popover.Target>
          <Popover.Dropdown className="sk-overflow-toolbar__overflow" data-sk-toolbar-overflow>
            <InOverflow.Provider value>
              {overflow.map((it, i) => (
                <div
                  key={it.el.key ?? i} className="sk-overflow-toolbar__overflow-item"
                  onClick={(e) => { if (it.data.closeOverflowOnInteraction !== false && (e.target as HTMLElement).closest('button, a, [role="menuitem"]')) setOpen(false); }}
                >{bare(it.el)}</div>
              ))}
            </InOverflow.Provider>
          </Popover.Dropdown>
        </Popover>
      ) : (
        <span className="sk-overflow-toolbar__probe" aria-hidden data-sk-toolbar-probe><Ellipsis className="sk-icon" /></span>
      )}
    </div>
  );
}
