/** sap.m.ObjectIdentifier: the title (bold, optionally a link) and a secondary text of an object (docs/26 §3.2). */
import type { HTMLAttributes } from 'react';
import type { EmptyIndicatorMode } from '../types';
import { cx, EmptyIndicator, isEmpty, type ReactiveAreaMode } from './shared';

export interface $ObjectIdentifierSettings extends Omit<HTMLAttributes<HTMLDivElement>, 'title' | 'children'> {
  /** Object title (bold). */
  title?: string;
  /** Secondary text below the title. */
  text?: string;
  /** Renders the control; false renders nothing. @defaultValue true */
  visible?: boolean;
  /** The title is a link that fires onTitlePress. @defaultValue false */
  titleActive?: boolean;
  /** Overlay enlarges the clickable area of an active title. @defaultValue 'Inline' */
  reactiveAreaMode?: ReactiveAreaMode;
  /** Shows "–" when title and text are empty. @defaultValue 'Off' */
  emptyIndicatorMode?: EmptyIndicatorMode;
  /** Fired when an active title is pressed; `domRef` is the title element. */
  onTitlePress?(e: ObjectIdentifier$TitlePressEvent): void;
}

/** Event object of ObjectIdentifier's titlePress. */
export interface ObjectIdentifier$TitlePressEvent {
  /** The title element. */
  domRef: HTMLElement;
}

export function ObjectIdentifier({ title, text, visible = true, titleActive = false, reactiveAreaMode = 'Inline', emptyIndicatorMode = 'Off', onTitlePress, className, ...rest }: $ObjectIdentifierSettings) {
  if (!visible) return null;
  const empty = isEmpty(title) && isEmpty(text);
  return (
    <div {...rest} className={cx('sk-object-identifier', className)} data-sk-object-identifier>
      {empty ? <EmptyIndicator mode={emptyIndicatorMode} /> : null}
      {isEmpty(title) ? null : titleActive ? (
        <button
          type="button" className={cx('sk-object-identifier__title sk-object-identifier__link', reactiveAreaMode === 'Overlay' && 'sk-reactive-overlay')}
          onClick={(e) => onTitlePress?.({ domRef: e.currentTarget })}
        >{title}</button>
      ) : <div className="sk-object-identifier__title">{title}</div>}
      {isEmpty(text) ? null : <div className="sk-object-identifier__text">{text}</div>}
    </div>
  );
}
