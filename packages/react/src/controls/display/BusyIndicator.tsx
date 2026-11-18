/** sap.m.BusyIndicator: three pulsing dots or a rotating custom icon, optionally with a text (docs/26 §3.3). */
import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import { useControlText } from '../context';
import { cx } from './shared';
import { TEXTS } from './texts';

/** The custom icon properties shared by BusyIndicator and BusyDialog. */
export interface BusyCustomIconProps {
  /** Icon rotated instead of the dots (a React node). */
  customIcon?: ReactNode;
  /** Milliseconds per rotation of the custom icon (default 1000). */
  customIconRotationSpeed?: number;
  /** Width of the custom icon (CSS length; default 44px). */
  customIconWidth?: string;
  /** Height of the custom icon (CSS length; default 44px). */
  customIconHeight?: string;
}

export interface BusyIndicatorProps extends BusyCustomIconProps, HTMLAttributes<HTMLDivElement> {
  /** Text below the indicator. */
  text?: string;
  /** Size of the dots (CSS length; default 1rem). */
  size?: string;
}

export function BusyIndicator({ text, size, customIcon, customIconRotationSpeed = 1000, customIconWidth, customIconHeight, className, style, ...rest }: BusyIndicatorProps) {
  const t = useControlText(TEXTS);
  const css = {
    ...(size ? { '--sk-busy-size': size } : {}),
    ...(customIconWidth ? { '--sk-busy-icon-width': customIconWidth } : {}),
    ...(customIconHeight ? { '--sk-busy-icon-height': customIconHeight } : {}),
    '--sk-busy-speed': `${Math.max(0, customIconRotationSpeed)}ms`,
    ...style,
  } as CSSProperties;
  return (
    <div
      {...rest} className={cx('sk-busy-indicator', className)} style={css}
      role="progressbar" aria-busy="true" aria-valuemin={0} aria-valuemax={100} aria-label={text || t('ctl.busyIndicator.label')} data-sk-busy-indicator
    >
      {customIcon ? (
        <span className={cx('sk-busy-indicator__icon', customIconRotationSpeed > 0 && 'sk-busy-indicator__icon--spin')} aria-hidden>{customIcon}</span>
      ) : <span className="sk-busy-indicator__dots" aria-hidden><span /><span /><span /></span>}
      {text ? <span className="sk-busy-indicator__text" aria-live="polite">{text}</span> : null}
    </div>
  );
}
