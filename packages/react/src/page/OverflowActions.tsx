/**
 * Toolbar whose items move into a "More" menu from right to left when they do not fit (OP Guidelines · Actions,
 * DP Responsiveness: "adds the available buttons to the overflow menu from right to left").
 */
import { ActionIcon, Button, Menu, Tooltip } from '@mantine/core';
import { MoreHorizontal } from 'lucide-react';
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useText } from '../context/SmartKitProvider';

export interface ToolbarAction {
  id: string;
  label: string;
  onPress(): void;
  /** Icon-only button (generic actions such as Share); business actions use text buttons. */
  icon?: ReactNode;
  disabled?: boolean;
  /** Emphasized (primary) button. */
  emphasized?: boolean;
  /** Custom content instead of a button (e.g. a menu button); it never moves into the overflow. */
  render?(): ReactNode;
  'data-testid'?: string;
}

export interface OverflowActionsProps {
  /** Items to show. */
  items: ToolbarAction[];
  /** Text of the overflow button. */
  label?: string;
  /** Extra CSS class on the root element. */
  className?: string;
  'data-sk'?: string;
  /** Width available to the toolbar (default: the parent's width minus its other children). */
  availableWidth?(): number;
}

const GAP = 8;

export function OverflowActions(p: OverflowActionsProps) {
  const t = useText();
  const boxRef = useRef<HTMLDivElement>(null);
  const fixedRef = useRef<HTMLSpanElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const fixed = p.items.filter((a) => a.render);
  const flexible = p.items.filter((a) => !a.render);
  const [visible, setVisible] = useState(flexible.length);
  const latest = useRef(p.availableWidth);
  latest.current = p.availableWidth;
  const key = p.items.map((i) => `${i.id}:${i.label}:${i.disabled ? 1 : 0}`).join('|');

  useLayoutEffect(() => {
    const box = boxRef.current;
    const measure = measureRef.current;
    if (!box || !measure) return;
    const compute = () => {
      const widths = [...measure.children].map((c) => (c as HTMLElement).offsetWidth);
      const more = (measure.lastElementChild as HTMLElement | null)?.offsetWidth ?? 32;
      const parent = box.parentElement;
      const outside = parent ? [...parent.children].filter((c) => c !== box).reduce((n, c) => n + (c as HTMLElement).offsetWidth + GAP, 0) : 0;
      const available = (latest.current ? latest.current() : parent ? parent.clientWidth - outside : box.clientWidth) - (fixedRef.current?.offsetWidth ?? 0);
      const items = widths.slice(0, -1);
      const total = items.reduce((n, w) => n + w + GAP, 0);
      if (total <= available || available <= 0) return setVisible(items.length);
      let used = more + GAP;
      let n = 0;
      for (const w of items) {
        if (used + w + GAP > available) break;
        used += w + GAP;
        n++;
      }
      setVisible(n);
    };
    compute();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(compute);
    const row = box.closest('.sk-dynamic-page__title-row') ?? box.parentElement ?? box;
    ro.observe(row);
    return () => ro.disconnect();
  }, [key]);

  const button = (a: ToolbarAction) => (a.render ? <span key={a.id}>{a.render()}</span> : a.icon ? (
    <Tooltip key={a.id} label={a.label}>
      <ActionIcon variant="subtle" aria-label={a.label} disabled={a.disabled} onClick={a.onPress} data-sk-action={a.id} data-testid={a['data-testid']}>{a.icon}</ActionIcon>
    </Tooltip>
  ) : (
    <Button key={a.id} variant={a.emphasized ? 'filled' : 'subtle'} disabled={a.disabled} onClick={a.onPress} data-sk-action={a.id} data-testid={a['data-testid']}>{a.label}</Button>
  ));
  const shown = flexible.slice(0, visible);
  const hidden = flexible.slice(visible);
  return (
    <div ref={boxRef} className={['sk-overflow-actions', p.className].filter(Boolean).join(' ')} data-sk={p['data-sk']}>
      {shown.map(button)}
      {hidden.length ? (
        <Menu position="bottom-end">
          <Menu.Target>
            <ActionIcon variant="subtle" aria-label={p.label ?? t('table.overflow')} data-sk-overflow-button><MoreHorizontal className="sk-icon" /></ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            {hidden.map((a) => <Menu.Item key={a.id} leftSection={a.icon} disabled={a.disabled} onClick={a.onPress} data-sk-action={a.id}>{a.label}</Menu.Item>)}
          </Menu.Dropdown>
        </Menu>
      ) : null}
      {fixed.length ? <span ref={fixedRef} className="sk-overflow-actions__fixed">{fixed.map(button)}</span> : null}
      <div ref={measureRef} className="sk-overflow-actions__measure" aria-hidden>
        {flexible.map((a) => (a.icon ? <ActionIcon key={a.id} variant="subtle" tabIndex={-1}>{a.icon}</ActionIcon> : <Button key={a.id} variant="subtle" tabIndex={-1}>{a.label}</Button>))}
        <ActionIcon variant="subtle" tabIndex={-1}><MoreHorizontal className="sk-icon" /></ActionIcon>
      </div>
    </div>
  );
}
