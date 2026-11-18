/**
 * sap.m.MessageView and sap.m.MessageItem (docs/26 §3.1): a list of messages with a filter by type and a details page.
 * MessagePopover shows the same view in a popover.
 */
import { ActionIcon, Badge, UnstyledButton } from '@mantine/core';
import type { Message } from '@rhfan2019/smart-kit-core';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Fragment, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode, type Ref } from 'react';
import { useControlText } from '../controls/context';
import { elementsOf, MESSAGE_TYPE_ORDER, messageTypeOf, type MessageType } from '../controls/types';
import { MessageTypeIcon } from './MessageTypeIcon';
import { TEXTS } from './texts';

export interface $MessageItemSettings {
  /** Type of the message. @defaultValue 'Error' */
  type?: MessageType;
  title?: string;
  subtitle?: string;
  description?: string;
  /** A number shown at the end of the item (how often the message occurs). */
  counter?: number;
  /** The group of the item when the view has `groupItems`. */
  groupName?: string;
  /** The title is a link (fires onActiveTitlePress). @defaultValue false */
  activeTitle?: boolean;
  /** UI5 renders the description as HTML; smart-kit renders it as plain text. @defaultValue false */
  markupDescription?: boolean;
  /** A URL with a long text, loaded when the details page opens (shown as plain text; fires onLongtextLoaded). */
  longtextUrl?: string;
  /** A link shown on the details page (`link` aggregation). */
  link?: ReactNode;
  /** Text of the item (inherited from sap.ui.core.Item); like UI5, the view shows `title`, not `text`. */
  text?: string;
  /** Inherited from sap.ui.core.Item; like UI5, the view does not use it. @defaultValue true */
  enabled?: boolean;
}

/** An item as passed to event handlers: its properties, its React key, and (extension) the core message it came from. */
export type MessageViewItem = $MessageItemSettings & { key?: string; message?: Message };

/** sap.m.MessageItem: declares one message of a MessageView / MessagePopover (renders nothing on its own). */
export function MessageItem(_: $MessageItemSettings): null {
  return null;
}

export interface MessageView {
  /** Returns from the details page to the list (sap.m.MessageView#navigateBack). */
  navigateBack(): void;
}

/** The type filter of the list: a message type, or 'All'. */
export type MessageTypeFilter = MessageType | 'All';

/** Event object of `onItemSelect` (sap.m.MessageView#itemSelect): the item whose details are shown. */
export interface MessageView$ItemSelectEvent { item: MessageViewItem; messageTypeFilter: MessageTypeFilter }
/** Event object of `onListSelect` (sap.m.MessageView#listSelect): the list shown, filtered by type or not. */
export interface MessageView$ListSelectEvent { messageTypeFilter: MessageTypeFilter }
/** Event object of `onActiveTitlePress` (sap.m.MessageView#activeTitlePress). */
export interface MessageView$ActiveTitlePressEvent { item: MessageViewItem }

/**
 * Argument of `asyncDescriptionHandler` (sap.m.MessageView~asyncDescriptionHandler). The handler loads the description
 * of `item` (a copy of the item), sets `item.description` (UI5: `item.setDescription`) and calls `promise.resolve()`;
 * `promise.reject()` shows the details without it.
 */
export interface MessageViewAsyncDescriptionConfig {
  item: MessageViewItem;
  promise: { resolve(value?: unknown): void; reject(reason?: unknown): void };
}

/** The default description handler (as in UI5): loads `longtextUrl` with GET and uses the response text as the description. */
export function defaultAsyncDescriptionHandler(config: MessageViewAsyncDescriptionConfig): void {
  const url = config.item.longtextUrl;
  if (!url) return;
  fetch(url)
    .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`A request has failed for long text data. URL: ${url}`))))
    .then((text) => { config.item.description = text; config.promise.resolve(); })
    .catch((e: unknown) => config.promise.reject(e));
}

export interface $MessageViewSettings {
  /** `MessageItem` elements. */
  children?: ReactNode;
  /** Extension: core messages (ADR-023), shown like MessageItems: text as title, target as subtitle and active title. */
  items?: Message[];
  /** Groups the items by `groupName`. @defaultValue false */
  groupItems?: boolean;
  /** Shows the header with the back button on the details page. @defaultValue true */
  showDetailsPageHeader?: boolean;
  /**
   * Loads the description of an item with a `longtextUrl` when its details open (the details page is busy meanwhile).
   * Default: `defaultAsyncDescriptionHandler` (GET `longtextUrl`, as UI5's default handler).
   */
  asyncDescriptionHandler?: (config: MessageViewAsyncDescriptionConfig) => void;
  /** A button at the end of the list header (MessagePopover `headerButton`). */
  headerButton?: ReactNode;
  onItemSelect?: (e: MessageView$ItemSelectEvent) => void;
  onActiveTitlePress?: (e: MessageView$ActiveTitlePressEvent) => void;
  onListSelect?: (e: MessageView$ListSelectEvent) => void;
  /** Fired after the description of an item with a `longtextUrl` has been loaded (`asyncDescriptionHandler`). */
  onLongtextLoaded?: () => void;
  ref?: Ref<MessageView>;
}

/** Items of the view: the MessageItem children, then the core messages. */
export function useViewItems(children: ReactNode, items: Message[] | undefined): MessageViewItem[] {
  return useMemo(() => [
    ...elementsOf<$MessageItemSettings>(children, MessageItem).map(({ key, props }) => ({ type: 'Error' as MessageType, ...props, key })),
    ...(items ?? []).map((m) => ({ key: m.id, type: messageTypeOf(m.type), title: m.message, subtitle: m.target, activeTitle: Boolean(m.target), message: m })),
  ], [children, items]);
}

const navigable = (i: MessageViewItem) => Boolean(i.description || i.longtextUrl || i.link);
/** Data attributes of an item (core messages keep the lower-case type for tests and styling hooks, ADR-023). */
const dataOf = (i: MessageViewItem) => ({ 'data-sk-message': i.message?.type ?? i.type, 'data-sk-message-target': i.message?.target });

/** The message list and details page, without a container. Used by MessageView and MessagePopover. */
export function MessageViewBody(p: $MessageViewSettings & { list: MessageViewItem[]; onBack?: () => void; collapsed?: boolean }) {
  const t = useControlText(TEXTS);
  const { list } = p;
  const [filter, setFilter] = useState<MessageTypeFilter>('All');
  const [selected, setSelected] = useState<MessageViewItem | null>(null);
  const counts = useMemo(() => MESSAGE_TYPE_ORDER.map((type) => [type, list.filter((i) => i.type === type).length] as const).filter(([, n]) => n > 0), [list]);
  const shown = filter === 'All' ? list : list.filter((i) => i.type === filter);
  // a single message opens its details directly (sap.m.MessageView)
  const single = list.length === 1 ? list[0]! : null;
  const details = selected && list.includes(selected) ? selected : single;
  useImperativeHandle(p.ref, () => ({ navigateBack: () => setSelected(null) }));
  // the description loaded by asyncDescriptionHandler, per item
  const [loaded, setLoaded] = useState<{ key: string; description?: string; busy: boolean } | null>(null);
  const { onLongtextLoaded } = p;
  const handler = p.asyncDescriptionHandler ?? defaultAsyncDescriptionHandler;
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  const detailsRef = useRef(details);
  detailsRef.current = details;
  // items are re-created on every render of the children: load once per item key and URL
  const loadKey = details?.longtextUrl ? `${details.key ?? list.indexOf(details)}\u0000${details.longtextUrl}` : null;
  useEffect(() => {
    const current = detailsRef.current;
    if (!loadKey || !current) return undefined;
    let live = true;
    const item: MessageViewItem = { ...current };
    setLoaded({ key: loadKey, busy: true });
    const done = (ok: boolean) => {
      if (!live) return;
      live = false;
      setLoaded({ key: loadKey, busy: false, description: ok ? item.description : undefined });
      onLongtextLoaded?.();
    };
    handlerRef.current({ item, promise: { resolve: () => done(true), reject: () => done(false) } });
    return () => { live = false; };
  }, [loadKey, onLongtextLoaded]);
  const loading = loaded && loaded.key === loadKey ? loaded : null;
  const description = loading?.description ?? details?.description;
  useEffect(() => { if (filter !== 'All' && !list.some((i) => i.type === filter)) setFilter('All'); }, [list, filter]);

  const title = (i: MessageViewItem) => (i.activeTitle && p.onActiveTitlePress
    ? <UnstyledButton className="sk-message-view__title sk-message-view__title--active" onClick={(e) => { e.stopPropagation(); p.onActiveTitlePress!({ item: i }); }}>{i.title}</UnstyledButton>
    : <span className="sk-message-view__title">{i.title}</span>);

  if (details) {
    return (
      <div className="sk-message-view__details" data-sk-message-view-details aria-busy={loading?.busy || undefined}>
        {p.showDetailsPageHeader !== false && !single ? (
          <div className="sk-message-view__header">
            <ActionIcon variant="subtle" aria-label={t('ctl.msg.back')} onClick={() => { setSelected(null); p.onBack?.(); }} data-sk-message-view-back><ChevronLeft className="sk-icon" aria-hidden /></ActionIcon>
            <span className="sk-message-view__header-title">{t('ctl.msg.messages')}</span>
            {p.headerButton}
          </div>
        ) : single && p.headerButton ? <div className="sk-message-view__header sk-message-view__header--end">{p.headerButton}</div> : null}
        <div className="sk-message-view__details-body" {...dataOf(details)}>
          <MessageTypeIcon type={details.type ?? 'Error'} />
          <div className="sk-message-view__details-text">
            {title(details)}
            {details.subtitle ? <div className="sk-message-view__subtitle">{details.subtitle}</div> : null}
            {description ? <div className="sk-message-view__description" data-sk-message-longtext={loading?.description !== undefined || undefined}>{description}</div> : null}
            {details.link ? <div className="sk-message-view__link">{details.link}</div> : null}
          </div>
        </div>
      </div>
    );
  }

  const groups = p.groupItems
    ? [...new Set(shown.map((i) => i.groupName ?? ''))].sort((a, b) => (a === '' ? -1 : b === '' ? 1 : 0)).map((g) => [g, shown.filter((i) => (i.groupName ?? '') === g)] as const)
    : [['', shown] as const];
  const choose = (f: MessageTypeFilter) => { setFilter(f); p.onListSelect?.({ messageTypeFilter: f }); };
  return (
    <div className="sk-message-view__list-page">
      {counts.length > 1 || p.headerButton ? (
        <div className="sk-message-view__header">
          {counts.length > 1 ? (
            <div className="sk-message-view__filter" role="group" aria-label={t('ctl.msg.filter')}>
              <button type="button" className="sk-message-view__filter-button" aria-pressed={filter === 'All'} onClick={() => choose('All')} data-sk-message-filter="All">{t('ctl.msg.all')}</button>
              {counts.map(([type, n]) => (
                <button key={type} type="button" className="sk-message-view__filter-button" aria-pressed={filter === type} onClick={() => choose(type)} aria-label={t(`ctl.msg.strip.${type === 'None' ? 'Information' : type}`)} data-sk-message-filter={type}>
                  <MessageTypeIcon type={type} /><span>{n}</span>
                </button>
              ))}
            </div>
          ) : <span className="sk-message-view__header-title">{t('ctl.msg.messages')}</span>}
          {p.headerButton ? <span className="sk-message-view__header-end">{p.headerButton}</span> : null}
        </div>
      ) : null}
      {p.collapsed && counts.length > 1 ? null : list.length ? (
        <ul className="sk-message-view__list" aria-label={t('ctl.msg.messages')}>
          {groups.map(([g, items]) => (
            <Fragment key={g || '-'}>
              {p.groupItems && g ? <li className="sk-message-view__group" role="presentation">{g}</li> : null}
              {items.map((i, n) => {
                const body = (
                  <>
                    <MessageTypeIcon type={i.type ?? 'Error'} />
                    <span className="sk-message-view__text">
                      {title(i)}
                      {i.subtitle ? <span className="sk-message-view__subtitle">{i.subtitle}</span> : null}
                    </span>
                    {i.counter ? <Badge size="sm" variant="light" color="gray" className="sk-message-view__counter">{i.counter}</Badge> : null}
                    {navigable(i) ? <ChevronRight className="sk-icon sk-message-view__arrow" aria-hidden /> : null}
                  </>
                );
                const open = () => { setSelected(i); p.onItemSelect?.({ item: i, messageTypeFilter: filter }); };
                return (
                  <li key={i.key ?? n} className="sk-message-view__item" {...dataOf(i)}>
                    {navigable(i)
                      ? <div role="button" tabIndex={0} className="sk-message-view__row sk-message-view__row--nav" onClick={open} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } }}>{body}</div>
                      : <div className="sk-message-view__row">{body}</div>}
                  </li>
                );
              })}
            </Fragment>
          ))}
        </ul>
      ) : <div className="sk-message-view__empty">{t('ctl.msg.noItems')}</div>}
    </div>
  );
}

/** sap.m.MessageView */
export function MessageView(p: $MessageViewSettings) {
  const list = useViewItems(p.children, p.items);
  return <div className="sk-message-view" data-sk-message-view><MessageViewBody {...p} list={list} /></div>;
}
