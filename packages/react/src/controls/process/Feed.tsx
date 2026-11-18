/**
 * FeedInput and FeedListItem (sap.m), docs/26 §3.7: a comment box with avatar and post button, and one feed entry with
 * sender, text ("More" / "Less" after `maxCharacters`), info, timestamp, actions menu and the ListItemBase properties.
 */
import { ActionIcon, Avatar, Menu, Textarea } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { ChevronRight, MoreHorizontal, Pencil, Send, User } from 'lucide-react';
import { useId, useState, type MouseEvent, type ReactNode } from 'react';
import { useControlLocale, useControlText } from '../context';
import type { IndicationColor, ValueState } from '../types';
import { avatarProps, cx, dateTimeText, pressKeys, toDate, type AvatarShape, type AvatarSize, type DateLike } from './shared';
import { TEXTS } from './texts';

/** sap.m.LinkConversion */
export type LinkConversion = 'None' | 'All' | 'ProtocolOnly';
export const LinkConversion = { None: 'None', All: 'All', ProtocolOnly: 'ProtocolOnly' } as const;

/** sap.m.ListType (the constant object is exported by SelectDialog). */
export type ListType = 'Inactive' | 'Active' | 'Navigation' | 'Detail' | 'DetailAndActive';

interface AvatarInput { icon?: ReactNode; activeIcon?: ReactNode; initials?: string; size?: AvatarSize; shape?: AvatarShape; label?: string; onPress?: (e: MouseEvent<HTMLElement>) => void }

/** The avatar of FeedInput and FeedListItem: an image URL, a React node (icon), initials or a person icon. */
function FeedAvatar(p: AvatarInput) {
  const { size, radius } = avatarProps(p.size, p.shape);
  const make = (icon: ReactNode, cls: string) => {
    const src = typeof icon === 'string' ? icon : undefined;
    const content = src ? undefined : (icon ?? p.initials ?? <User className="sk-feed__avatar-icon" aria-hidden="true" />);
    return <Avatar className={cls} src={src} alt={p.label} radius={radius} size={size}>{content}</Avatar>;
  };
  const avatar = make(p.icon, 'sk-feed__avatar');
  if (!p.onPress) return avatar;
  return (
    <button type="button" className={cx('sk-feed__avatar-button', p.activeIcon !== undefined && 'sk-feed__avatar-button--swap')} aria-label={p.label} onClick={p.onPress}>
      {avatar}
      {p.activeIcon !== undefined && make(p.activeIcon, 'sk-feed__avatar sk-feed__avatar--active')}
    </button>
  );
}

export interface $FeedInputSettings {
  value?: string;
  /** Default true. */
  enabled?: boolean;
  /** Visible rows (default 2). */
  rows?: number;
  /** Lets the text exceed `maxLength` and shows how far it is over (default false). */
  showExceededText?: boolean;
  /** Maximum characters (default 0 = no limit). */
  maxLength?: number;
  /** Grows with the text (default false). */
  growing?: boolean;
  /** Maximum rows when growing (default 0 = no limit). */
  growingMaxLines?: number;
  /** Default "Post something here". */
  placeholder?: string;
  /** Image URL or React node of the avatar. */
  icon?: ReactNode;
  /** Default 'Circle'. */
  iconDisplayShape?: AvatarShape;
  iconInitials?: string;
  /** Default 'M'. */
  iconSize?: AvatarSize;
  /** Default true. */
  showIcon?: boolean;
  /** Tooltip and accessible name of the post button (default "Submit"). */
  buttonTooltip?: string;
  /** Further controls next to the post button. */
  actions?: ReactNode;
  onPost?: (e: { value: string }) => void;
  'aria-label'?: string;
}

export function FeedInput(p: $FeedInputSettings) {
  const t = useControlText(TEXTS);
  const [value, setValue] = useState(p.value ?? '');
  const [propValue, setPropValue] = useState(p.value);
  if (p.value !== propValue) {
    setPropValue(p.value);
    setValue(p.value ?? '');
  }
  const counterId = useId();
  const max = p.maxLength ?? 0;
  const over = max > 0 ? value.length - max : 0;
  const enabled = p.enabled !== false;
  const canPost = enabled && value.trim() !== '' && over <= 0;
  const post = () => {
    if (!canPost) return;
    p.onPost?.({ value });
    setValue('');
  };
  const placeholder = p.placeholder ?? t('ctl.feedInput.placeholder');
  const tooltip = p.buttonTooltip ?? t('ctl.feedInput.buttonTooltip');
  return (
    <div className={cx('sk-feed-input', !enabled && 'sk-feed-input--disabled')}>
      {p.showIcon !== false && <FeedAvatar icon={p.icon} initials={p.iconInitials} size={p.iconSize ?? 'M'} shape={p.iconDisplayShape} />}
      <div className="sk-feed-input__field">
        <Textarea
          className="sk-feed-input__textarea"
          value={value}
          placeholder={placeholder}
          aria-label={p['aria-label'] ?? placeholder}
          aria-describedby={over > 0 ? counterId : undefined}
          aria-invalid={over > 0 || undefined}
          disabled={!enabled}
          maxLength={max > 0 && !p.showExceededText ? max : undefined}
          rows={p.rows ?? 2}
          autosize={p.growing}
          minRows={p.growing ? p.rows ?? 2 : undefined}
          maxRows={p.growing && p.growingMaxLines ? p.growingMaxLines : undefined}
          onChange={(e) => setValue(e.currentTarget.value)}
        />
        {p.showExceededText && over > 0 && <span id={counterId} className="sk-feed-input__exceeded" aria-live="polite">{t('ctl.feedInput.exceeded', { count: over })}</span>}
      </div>
      <div className="sk-feed-input__actions">
        {p.actions}
        <ActionIcon className="sk-feed-input__post" variant="filled" size="lg" aria-label={tooltip} title={tooltip} disabled={!canPost} onClick={post}>
          <Send className="sk-feed__action-icon" aria-hidden="true" />
        </ActionIcon>
      </div>
    </div>
  );
}

/** sap.m.FeedListItemAction (data array `actions` of FeedListItem). */
export interface FeedListItemAction {
  key: string;
  text: string;
  icon?: ReactNode;
  /** Default true. */
  enabled?: boolean;
  /** Default true. */
  visible?: boolean;
  onPress?: () => void;
}

/** Event of `onSenderPress` / `onIconPress`: the id and element pressed. */
export interface FeedListItemPressEvent { domRef: string; getDomRef: () => HTMLElement }

export interface $FeedListItemSettings {
  sender?: string;
  text?: string;
  info?: string;
  /** Date, ISO string (formatted in the smart-kit locale) or display text. */
  timestamp?: DateLike;
  /** Characters before "More" (default 500 on desktop, 300 on phones). */
  maxCharacters?: number;
  /** Text of the "More" link. */
  moreLabel?: string;
  /** Text of the "Less" link. */
  lessLabel?: string;
  /** Image URL or React node of the avatar. */
  icon?: ReactNode;
  /** Avatar while the pointer is on it (with `iconActive`). */
  activeIcon?: ReactNode;
  /** Default 'Circle'. */
  iconDisplayShape?: AvatarShape;
  iconInitials?: string;
  /** Default 'S'. */
  iconSize?: AvatarSize;
  /** Default true. */
  showIcon?: boolean;
  /** Sender as a link (default true; needs `onSenderPress`). */
  senderActive?: boolean;
  /** Avatar as a button (default true; needs `onIconPress`). */
  iconActive?: boolean;
  /** Turns URLs in the text into links (default 'None'). */
  convertLinksToAnchorTags?: LinkConversion;
  /** Target of the converted links (default '_blank'). */
  convertedLinksDefaultTarget?: string;
  /** ListItemBase: default 'Inactive'. */
  type?: ListType;
  /** Default true. */
  visible?: boolean;
  unread?: boolean;
  selected?: boolean;
  counter?: number;
  /** ValueState or IndicationColor: a coloured bar at the start (default 'None'). */
  highlight?: ValueState | IndicationColor;
  /** Accessible text of the highlight. */
  highlightText?: string;
  /** Marks the item as the one last navigated to. */
  navigated?: boolean;
  actions?: FeedListItemAction[];
  onSenderPress?: (e: FeedListItemPressEvent) => void;
  onIconPress?: (e: FeedListItemPressEvent) => void;
  /** With type Active, Navigation or DetailAndActive. */
  onPress?: () => void;
  /** With type Detail or DetailAndActive. */
  onDetailPress?: () => void;
}

const LINKS: Record<Exclude<LinkConversion, 'None'>, RegExp> = {
  All: /\b(?:(?:https?|ftp):\/\/|www\.)[^\s<]+/gi,
  ProtocolOnly: /\b(?:https?|ftp):\/\/[^\s<]+/gi,
};

/** Text with its URLs as links (sap.m.LinkConversion). */
export function linkify(text: string, mode: LinkConversion | undefined, target: string): ReactNode {
  if (!mode || mode === 'None') return text;
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(LINKS[mode])) {
    const url = m[0].replace(/[.,;:!?)]+$/, '');
    const i = m.index ?? 0;
    if (i > last) out.push(text.slice(last, i));
    out.push(<a key={i} className="sk-feed-item__link" href={url.startsWith('www.') ? `//${url}` : url} target={target} rel="noopener noreferrer">{url}</a>);
    last = i + url.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const ISO = /^\d{4}-\d{2}-\d{2}/;

/** One feed entry; renders an `<li>`, so place it in a `<ul>` (like sap.m.List). */
export function FeedListItem(p: $FeedListItemSettings) {
  const t = useControlText(TEXTS);
  const { intlLocale, timeZone } = useControlLocale();
  const phone = useMediaQuery('(max-width: 37.5em)');
  const [expanded, setExpanded] = useState(false);
  const textId = useId();
  const senderId = useId();
  if (p.visible === false) return null;
  const max = p.maxCharacters ?? (phone ? 300 : 500);
  const text = p.text ?? '';
  const long = text.length > max;
  const shown = long && !expanded ? `${text.slice(0, max).trimEnd()}…` : text;
  const date = p.timestamp instanceof Date || (typeof p.timestamp === 'string' && ISO.test(p.timestamp)) ? toDate(p.timestamp) : undefined;
  const stamp = date ? dateTimeText(date, intlLocale, timeZone) : typeof p.timestamp === 'string' ? p.timestamp : undefined;
  const event = (el: HTMLElement): FeedListItemPressEvent => ({ domRef: el.id, getDomRef: () => el });
  const senderPress = p.senderActive !== false && p.onSenderPress ? (e: MouseEvent<HTMLElement>) => { e.stopPropagation(); p.onSenderPress?.(event(e.currentTarget)); } : undefined;
  const iconPress = p.iconActive !== false && p.onIconPress ? (e: MouseEvent<HTMLElement>) => { e.stopPropagation(); p.onIconPress?.(event(e.currentTarget)); } : undefined;
  const type = p.type ?? 'Inactive';
  const active = type === 'Active' || type === 'Navigation' || type === 'DetailAndActive';
  const detail = type === 'Detail' || type === 'DetailAndActive';
  const press = active ? () => p.onPress?.() : undefined;
  const actions = (p.actions ?? []).filter((a) => a.visible !== false);
  const highlight = p.highlight && p.highlight !== 'None' ? p.highlight : undefined;
  return (
    <li
      className={cx('sk-feed-item', active && 'sk-feed-item--active', p.unread && 'sk-feed-item--unread', p.selected && 'sk-feed-item--selected', p.navigated && 'sk-feed-item--navigated')}
      data-highlight={highlight}
      tabIndex={active ? 0 : undefined}
      aria-selected={p.selected || undefined}
      aria-labelledby={p.sender ? senderId : undefined}
      aria-describedby={text ? textId : undefined}
      onClick={press}
      onKeyDown={press ? pressKeys(press) : undefined}
    >
      {highlight && <span className="sk-visually-hidden">{p.highlightText ?? highlight}</span>}
      {p.showIcon !== false && (
        <FeedAvatar icon={p.icon} activeIcon={p.activeIcon} initials={p.iconInitials} size={p.iconSize ?? 'S'} shape={p.iconDisplayShape} label={p.sender} onPress={iconPress} />
      )}
      <div className="sk-feed-item__body">
        {p.sender && (senderPress
          ? <button type="button" id={senderId} className="sk-feed-item__sender sk-feed-item__sender--active" onClick={senderPress}>{p.sender}</button>
          : <span id={senderId} className="sk-feed-item__sender">{p.sender}</span>)}
        {p.unread && <span className="sk-visually-hidden">{t('ctl.feedListItem.unread')}</span>}
        {text && (
          <p className="sk-feed-item__text" id={textId}>
            {linkify(shown, p.convertLinksToAnchorTags, p.convertedLinksDefaultTarget ?? '_blank')}
            {long && (
              <button type="button" className="sk-feed-item__more" aria-expanded={expanded} aria-controls={textId}
                onClick={(e) => { e.stopPropagation(); setExpanded((x) => !x); }}>
                {expanded ? (p.lessLabel ?? t('ctl.feedListItem.less')) : (p.moreLabel ?? t('ctl.feedListItem.more'))}
              </button>
            )}
          </p>
        )}
        {(p.info || stamp) && (
          <div className="sk-feed-item__footer">
            {p.info && <span className="sk-feed-item__info">{p.info}</span>}
            {stamp && (date ? <time className="sk-feed-item__timestamp" dateTime={date.toISOString()}>{stamp}</time> : <span className="sk-feed-item__timestamp">{stamp}</span>)}
          </div>
        )}
      </div>
      <div className="sk-feed-item__end" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
        {p.counter !== undefined && p.counter !== null && <span className="sk-feed-item__counter" aria-label={t('ctl.feedListItem.counter', { count: p.counter })}>{p.counter}</span>}
        {actions.length > 0 && (
          <Menu position="bottom-end" withinPortal>
            <Menu.Target>
              <ActionIcon className="sk-feed-item__actions" variant="subtle" aria-label={t('ctl.feedListItem.actions')}>
                <MoreHorizontal className="sk-feed__action-icon" aria-hidden="true" />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              {actions.map((a) => (
                <Menu.Item key={a.key} leftSection={a.icon} disabled={a.enabled === false} onClick={() => a.onPress?.()}>{a.text}</Menu.Item>
              ))}
            </Menu.Dropdown>
          </Menu>
        )}
        {detail && (
          <ActionIcon className="sk-feed-item__detail" variant="subtle" aria-label={t('ctl.feedListItem.detail')} onClick={() => p.onDetailPress?.()}>
            <Pencil className="sk-feed__action-icon" aria-hidden="true" />
          </ActionIcon>
        )}
        {type === 'Navigation' && <ChevronRight className="sk-feed__action-icon sk-feed-item__nav" aria-hidden="true" />}
      </div>
    </li>
  );
}
