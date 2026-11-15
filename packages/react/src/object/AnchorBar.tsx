/** Anchor navigation: anchors, subsection menus, overflow menu, dropdown on small screens (OP-08). */
import { ActionIcon, Menu, Select, UnstyledButton } from '@mantine/core';
import { useElementSize, useMediaQuery } from '@mantine/hooks';
import { ChevronDown, MoreHorizontal } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useText } from '../context/SmartKitProvider';

export interface AnchorItem {
  id: string;
  title: string;
  count?: number;
  subSections: { id: string; title: string }[];
}

export interface AnchorBarProps {
  items: AnchorItem[];
  active?: string;
  onSelect(sectionId: string, subSectionId?: string): void;
  /** Tabs mode: render as tabs (OP-09). */
  tabs?: boolean;
}

export function AnchorBar(p: AnchorBarProps) {
  const t = useText();
  const small = useMediaQuery('(max-width: 599px)');
  const { ref: barRef, width } = useElementSize();
  const listRef = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);
  useEffect(() => {
    const el = listRef.current;
    setOverflowing(Boolean(el && el.scrollWidth > el.clientWidth + 1));
  }, [width, p.items]);
  // Keep the active anchor visible while scrolling.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>('[aria-current="true"]');
    el?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [p.active]);

  const label = (it: AnchorItem) => (it.count === undefined ? it.title : `${it.title} (${it.count})`);

  if (small && !p.tabs) {
    const data = p.items.flatMap((it) => [{ value: it.id, label: it.title }, ...(it.subSections.length > 1 ? it.subSections.map((s) => ({ value: `${it.id}::sub::${s.id}`, label: `— ${s.title}` })) : [])]);
    return (
      <div className="sk-anchorbar sk-anchorbar--select">
        <Select aria-label={t('object.sections')} value={p.active ?? null} data={data} allowDeselect={false} onChange={(v) => { if (!v) return; const [s, sub] = v.split('::sub::'); p.onSelect(s!, sub); }} />
      </div>
    );
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const buttons = [...(listRef.current?.querySelectorAll<HTMLElement>('[data-sk-anchor]') ?? [])];
    const i = buttons.indexOf(document.activeElement as HTMLElement);
    const next = buttons[(i + (e.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length];
    next?.focus();
    e.preventDefault();
  };

  return (
    <nav className={['sk-anchorbar', p.tabs ? 'sk-anchorbar--tabs' : ''].join(' ')} aria-label={t('object.sections')} ref={barRef}>
      <div className="sk-anchorbar__list" ref={listRef} role={p.tabs ? 'tablist' : undefined} onKeyDown={onKeyDown}>
        {p.items.map((it) => {
          const active = it.id === p.active;
          return (
            <div key={it.id} className="sk-anchorbar__item" data-active={active || undefined} role={p.tabs ? 'presentation' : undefined}>
              <UnstyledButton
                className="sk-anchorbar__anchor"
                data-sk-anchor={it.id}
                aria-current={active ? 'true' : undefined}
                role={p.tabs ? 'tab' : undefined}
                aria-selected={p.tabs ? active : undefined}
                onClick={() => p.onSelect(it.id)}
              >
                {label(it)}
              </UnstyledButton>
              {it.subSections.length > 1 ? (
                <Menu position="bottom-start">
                  <Menu.Target>
                    {/* In a tablist only tabs are allowed; the tab content shows all subsections, so the menu is a pointer shortcut there. */}
                    <ActionIcon size="sm" aria-label={t('object.subsections', { name: it.title })} data-sk-anchor-menu={it.id} {...(p.tabs ? { 'aria-hidden': true, tabIndex: -1 } : {})}><ChevronDown className="sk-icon" /></ActionIcon>
                  </Menu.Target>
                  <Menu.Dropdown>
                    {it.subSections.map((s) => <Menu.Item key={s.id} onClick={() => p.onSelect(it.id, s.id)}>{s.title}</Menu.Item>)}
                  </Menu.Dropdown>
                </Menu>
              ) : null}
            </div>
          );
        })}
      </div>
      {overflowing ? (
        <Menu position="bottom-end">
          <Menu.Target>
            <ActionIcon aria-label={t('object.moreSections')} data-sk-anchor-overflow><MoreHorizontal className="sk-icon" /></ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            {p.items.map((it) => (
              <div key={it.id}>
                <Menu.Item onClick={() => p.onSelect(it.id)} fw={600}>{label(it)}</Menu.Item>
                {it.subSections.length > 1 ? it.subSections.map((s) => <Menu.Item key={s.id} pl="xl" onClick={() => p.onSelect(it.id, s.id)}>{s.title}</Menu.Item>) : null}
              </div>
            ))}
          </Menu.Dropdown>
        </Menu>
      ) : null}
    </nav>
  );
}
