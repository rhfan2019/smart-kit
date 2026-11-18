/** sap.m.ObjectIdentifier: the title (bold, optionally a link) and a secondary text of an object (docs/26 §3.2). */
import type { HTMLAttributes } from 'react';
import type { EmptyIndicatorMode } from '../types';
import { cx, EmptyIndicator, isEmpty, type ReactiveAreaMode } from './shared';

export interface ObjectIdentifierProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Object title (bold). */
  title?: string;
  /** Secondary text below the title. */
  text?: string;
  /** The title is a link that fires onTitlePress (default false). */
  titleActive?: boolean;
  /** Overlay enlarges the clickable area of an active title (default Inline). */
  reactiveAreaMode?: ReactiveAreaMode;
  /** Shows "–" when title and text are empty (default Off). */
  emptyIndicatorMode?: EmptyIndicatorMode;
  /** Fired when an active title is pressed; `domRef` is the title element. */
  onTitlePress?(e: { domRef: HTMLElement }): void;
}

export function ObjectIdentifier({ title, text, titleActive = false, reactiveAreaMode = 'Inline', emptyIndicatorMode = 'Off', onTitlePress, className, ...rest }: ObjectIdentifierProps) {
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
