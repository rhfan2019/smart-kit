/** sap.m.ObjectMarker: a predefined marker (flagged, favorite, draft, locked, unsaved) as icon and / or text (docs/26 §3.2). */
import { Flag, Lock, Star, UserPen, type LucideIcon } from 'lucide-react';
import type { HTMLAttributes } from 'react';
import type { MessageKey } from '../../i18n/messages.en';
import { useControlText } from '../context';
import { cx, type ReactiveAreaMode } from './shared';
import { TEXTS } from './texts';

/** sap.m.ObjectMarkerType */
export type ObjectMarkerType = 'Flagged' | 'Favorite' | 'Draft' | 'Locked' | 'Unsaved' | 'LockedBy' | 'UnsavedBy';
export const ObjectMarkerType = {
  Flagged: 'Flagged', Favorite: 'Favorite', Draft: 'Draft', Locked: 'Locked', Unsaved: 'Unsaved', LockedBy: 'LockedBy', UnsavedBy: 'UnsavedBy',
} as const;

/** sap.m.ObjectMarkerVisibility */
export type ObjectMarkerVisibility = 'IconOnly' | 'TextOnly' | 'IconAndText';
export const ObjectMarkerVisibility = { IconOnly: 'IconOnly', TextOnly: 'TextOnly', IconAndText: 'IconAndText' } as const;

export interface $ObjectMarkerSettings extends Omit<HTMLAttributes<HTMLElement>, 'type'> {
  /** The marker (no default: without a type nothing is rendered). */
  type?: ObjectMarkerType;
  /** Overlay enlarges the clickable area (default Inline). */
  reactiveAreaMode?: ReactiveAreaMode;
  /**
   * Icon, text or both. Without it, as in SAPUI5: Flagged and Favorite icon only; Draft text only; Locked, Unsaved, LockedBy and
   * UnsavedBy icon only on small screens (below 600px) and icon and text on larger ones.
   */
  visibility?: ObjectMarkerVisibility;
  /** The user name of LockedBy / UnsavedBy ("Locked by {name}"). */
  additionalInfo?: string;
  /** Makes the marker clickable. */
  onPress?(e: { type: ObjectMarkerType }): void;
}

const ICONS: Record<ObjectMarkerType, LucideIcon> = { Flagged: Flag, Favorite: Star, Draft: UserPen, Locked: Lock, Unsaved: UserPen, LockedBy: Lock, UnsavedBy: UserPen };
type Shown = ObjectMarkerVisibility | 'Responsive';
const DEFAULT: Record<ObjectMarkerType, Shown> = {
  Flagged: 'IconOnly', Favorite: 'IconOnly', Draft: 'TextOnly', Locked: 'Responsive', Unsaved: 'Responsive', LockedBy: 'Responsive', UnsavedBy: 'Responsive',
};

export function ObjectMarker({ type, reactiveAreaMode = 'Inline', visibility, additionalInfo, onPress, className, ...rest }: $ObjectMarkerSettings) {
  const t = useControlText(TEXTS);
  if (!type) return null;
  const by = type === 'LockedBy' || type === 'UnsavedBy';
  const text = by && !additionalInfo ? t(`ctl.objectMarker.${type}Another` as MessageKey) : t(`ctl.objectMarker.${type}` as MessageKey, { name: additionalInfo ?? '' });
  const vis: Shown = visibility ?? DEFAULT[type];
  const Icon = ICONS[type];
  const iconOnly = vis === 'IconOnly';
  const body = (
    <>
      {vis !== 'TextOnly' ? <Icon className="sk-icon sk-object-marker__icon" aria-hidden /> : null}
      {!iconOnly ? <span className="sk-object-marker__text">{text}</span> : null}
    </>
  );
  const cls = cx(
    'sk-object-marker', `sk-object-marker--${type.toLowerCase()}`, vis === 'Responsive' && 'sk-object-marker--responsive', onPress && 'sk-object-marker--active',
    onPress && reactiveAreaMode === 'Overlay' && 'sk-reactive-overlay', className,
  );
  const label = iconOnly ? text : undefined;
  const common = { ...rest, className: cls, title: rest.title ?? (vis === 'TextOnly' ? undefined : text), 'data-sk-object-marker': type, 'data-visibility': vis };
  return onPress ? (
    <button {...common} type="button" aria-label={label ?? text} onClick={() => onPress({ type })}>{body}</button>
  ) : (
    <span {...common} role={label ? 'img' : undefined} aria-label={label}>{body}</span>
  );
}
