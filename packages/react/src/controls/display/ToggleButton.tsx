/** sap.m.ToggleButton: a sap.m.Button that stays pressed until it is pressed again (docs/26 §3.2). */
import { ActionIcon, Button } from '@mantine/core';
import { useEffect, useState, type ReactNode, type Ref } from 'react';
import { badgeValueText, useButtonBadge } from './buttonBadge';
import type { OverflowToolbarLayoutData } from './OverflowToolbar';
import { cx } from './shared';

/** sap.m.ButtonType */
export type ButtonType = 'Default' | 'Back' | 'Accept' | 'Reject' | 'Transparent' | 'Ghost' | 'Up' | 'Unstyled' | 'Emphasized' | 'Critical' | 'Negative' | 'Success' | 'Neutral' | 'Attention';
export const ButtonType = {
  Default: 'Default', Back: 'Back', Accept: 'Accept', Reject: 'Reject', Transparent: 'Transparent', Ghost: 'Ghost', Up: 'Up', Unstyled: 'Unstyled',
  Emphasized: 'Emphasized', Critical: 'Critical', Negative: 'Negative', Success: 'Success', Neutral: 'Neutral', Attention: 'Attention',
} as const;

/** sap.m.ButtonAccessibleRole */
export type ButtonAccessibleRole = 'Default' | 'Link';
export const ButtonAccessibleRole = { Default: 'Default', Link: 'Link' } as const;

/** sap.m.BadgeStyle */
export type BadgeStyle = 'Default' | 'Attention';
export const BadgeStyle = { Default: 'Default', Attention: 'Attention' } as const;

/** sap.ui.core.aria.HasPopup */
export type AriaHasPopup = 'None' | 'Menu' | 'ListBox' | 'Tree' | 'Grid' | 'Dialog';

export interface $ToggleButtonSettings {
  /** Pressed state. The button also toggles itself, as in SAPUI5; a changed prop wins. @defaultValue false */
  pressed?: boolean;
  /** Button text; without it the button shows only the icon (then set `aria-label` or `title`). */
  text?: string;
  /** Visual type. @defaultValue 'Default' */
  type?: ButtonType;
  /** Width (CSS length). */
  width?: string;
  /** Enabled. @defaultValue true */
  enabled?: boolean;
  /** Icon (a React node). */
  icon?: ReactNode;
  /** Icon before the text; false puts it after. @defaultValue true */
  iconFirst?: boolean;
  /** Icon shown while the button is pressed. */
  activeIcon?: ReactNode;
  /** aria-haspopup. @defaultValue 'None' */
  ariaHasPopup?: AriaHasPopup;
  /** Link makes screen readers announce a link. @defaultValue 'Default' */
  accessibleRole?: ButtonAccessibleRole;
  /** Style of the badge. @defaultValue 'Default' */
  badgeStyle?: BadgeStyle;
  /**
   * Extension: badge value shown on the button (SAPUI5 sets it through BadgeCustomData). Limited as in sap.m.Button: hidden
   * below the minimum (1), `9999+`-style above the maximum, empty for a non-numeric value (see setBadgeMinValue / setBadgeMaxValue).
   */
  badge?: string | number;
  /** Layout data when the button is in an OverflowToolbar. */
  layoutData?: OverflowToolbarLayoutData;
  /** Fired after a press with the new state. */
  onPress?(e: ToggleButton$PressEvent): void;
  /** Tooltip (the SAPUI5 tooltip of sap.ui.core.Element). */
  title?: string;
  'aria-label'?: string;
  className?: string;
  'data-testid'?: string;
  ref?: Ref<ToggleButton>;
}

/** Instance methods of ToggleButton (the sap.m.Button badge methods). */
export interface ToggleButton {
  /** Value below which the badge is hidden (from 1 up to the current maximum; invalid values are ignored); returns the instance. @defaultValue 1 */
  setBadgeMinValue(iMin: number): ToggleButton;
  /** Value above which the badge shows `<max>+` (`999+` from 1000); from the current minimum up to 9999; returns the instance. @defaultValue 9999 */
  setBadgeMaxValue(iMax: number): ToggleButton;
}

/** Event object of ToggleButton's press. */
export interface ToggleButton$PressEvent {
  /** The new pressed state. */
  pressed: boolean;
}

const TONE: Partial<Record<ButtonType, string>> = { Accept: 'positive', Success: 'positive', Reject: 'negative', Negative: 'negative', Critical: 'critical', Attention: 'critical', Neutral: 'neutral' };

function variantOf(type: ButtonType, pressed: boolean): string {
  if (pressed) return 'filled';
  if (type === 'Emphasized') return 'light';
  if (type === 'Transparent' || type === 'Ghost' || type === 'Unstyled' || type === 'Back' || type === 'Up') return 'subtle';
  return TONE[type] ? 'light' : 'default';
}

export function ToggleButton({
  pressed: pressedProp = false, text, type = 'Default', width, enabled = true, icon, iconFirst = true, activeIcon, ariaHasPopup = 'None', accessibleRole = 'Default',
  badgeStyle = 'Default', badge, layoutData: _layoutData, onPress, className, ref, ...aria
}: $ToggleButtonSettings) {
  const limits = useButtonBadge(ref);
  const badgeShown = badgeValueText(badge, limits.min, limits.max);
  const [pressed, setPressed] = useState(pressedProp);
  useEffect(() => setPressed(pressedProp), [pressedProp]);
  const toggle = () => {
    const next = !pressed;
    setPressed(next);
    onPress?.({ pressed: next });
  };
  const tone = TONE[type];
  const shownIcon = pressed && activeIcon ? activeIcon : icon;
  const common = {
    ...aria,
    variant: variantOf(type, pressed),
    color: tone ? `var(--sk-color-${tone})` : undefined,
    disabled: !enabled,
    onClick: toggle,
    'aria-pressed': pressed,
    'aria-haspopup': ariaHasPopup === 'None' ? undefined : (ariaHasPopup.toLowerCase() as 'menu'),
    role: accessibleRole === 'Link' ? 'link' : undefined,
    className: cx('sk-toggle-button', pressed && 'sk-toggle-button--pressed', `sk-toggle-button--${type.toLowerCase()}`, badgeShown !== null && 'sk-has-badge', className),
    'data-sk-toggle-button': pressed ? 'pressed' : 'released',
    style: width ? { width } : undefined,
  };
  const badgeEl = badgeShown !== null ? <span className={cx('sk-button-badge', badgeStyle === 'Attention' && 'sk-button-badge--attention')} data-sk-badge>{badgeShown}</span> : null;
  return text ? (
    <Button {...common} leftSection={iconFirst ? shownIcon : undefined} rightSection={iconFirst ? undefined : shownIcon}>{text}{badgeEl}</Button>
  ) : <ActionIcon {...common}>{shownIcon}{badgeEl}</ActionIcon>;
}
