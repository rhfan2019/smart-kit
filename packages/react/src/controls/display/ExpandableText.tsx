/** sap.m.ExpandableText: a long text cut after `maxCharacters` with a "More" link (in place or in a popover) (docs/26 §3.4). */
import { Popover } from '@mantine/core';
import { useEffect, useImperativeHandle, useState, type HTMLAttributes, type Ref } from 'react';
import { useControlText } from '../context';
import type { EmptyIndicatorMode } from '../types';
import { ALIGN, cx, EmptyIndicator, isEmpty, type TextAlignValue } from './shared';
import { TEXTS } from './texts';

/** sap.m.ExpandableTextOverflowMode */
export type ExpandableTextOverflowMode = 'InPlace' | 'Popover';
export const ExpandableTextOverflowMode = { InPlace: 'InPlace', Popover: 'Popover' } as const;

export interface $ExpandableTextSettings extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** The text. */
  text?: string;
  /** sap.m.WrappingType: Normal or Hyphenated. @defaultValue 'Normal' */
  wrappingType?: 'Normal' | 'Hyphenated';
  /** sap.ui.core.TextAlign. @defaultValue 'Begin' */
  textAlign?: TextAlignValue;
  /** Keeps line breaks and spaces. @defaultValue false */
  renderWhitespace?: boolean;
  /** InPlace expands the text, Popover shows the full text in a popover. @defaultValue 'InPlace' */
  overflowMode?: ExpandableTextOverflowMode;
  /** Characters shown before "More". @defaultValue 100 */
  maxCharacters?: number;
  /** InPlace mode: the full text is shown (default false). The control also toggles it itself; a changed prop wins. */
  expanded?: boolean;
  /** Shows "–" when text is empty. @defaultValue 'Off' */
  emptyIndicatorMode?: EmptyIndicatorMode;
  ref?: Ref<ExpandableText>;
}

/** Instance methods of ExpandableText. */
export interface ExpandableText {
  /** Whether the control can be bound to a label; always `false`, as in sap.m.ExpandableText (a text is not labelable). */
  hasLabelableHTMLElement(): boolean;
}

export function ExpandableText({
  text = '', wrappingType = 'Normal', textAlign = 'Begin', renderWhitespace = false, overflowMode = 'InPlace', maxCharacters = 100, expanded: expandedProp = false,
  emptyIndicatorMode = 'Off', className, style, ref, ...rest
}: $ExpandableTextSettings) {
  useImperativeHandle(ref, () => ({ hasLabelableHTMLElement: () => false }), []);
  const t = useControlText(TEXTS);
  const [expanded, setExpanded] = useState(expandedProp);
  const [popover, setPopover] = useState(false);
  useEffect(() => setExpanded(expandedProp), [expandedProp]);
  const long = text.length > maxCharacters;
  const cls = cx('sk-expandable-text', renderWhitespace && 'sk-expandable-text--whitespace', wrappingType === 'Hyphenated' && 'sk-expandable-text--hyphenated', className);
  const css = { textAlign: ALIGN[textAlign], ...style };
  if (isEmpty(text)) return <div {...rest} className={cls} style={css}><EmptyIndicator mode={emptyIndicatorMode} /></div>;
  const inPlace = overflowMode === 'InPlace';
  const open = inPlace ? expanded : popover;
  const shown = !long || (inPlace && expanded) ? text : `${text.slice(0, maxCharacters)}…`;
  const link = (
    <button type="button" className="sk-expandable-text__link" aria-expanded={open} onClick={() => (inPlace ? setExpanded((x) => !x) : setPopover((x) => !x))} data-sk-expandable-toggle>
      {inPlace && expanded ? t('ctl.expandableText.less') : t('ctl.expandableText.more')}
    </button>
  );
  return (
    <div {...rest} className={cls} style={css} data-sk-expandable-text={open ? 'expanded' : 'collapsed'}>
      <span className="sk-expandable-text__text">{shown}</span>
      {long ? ' ' : null}
      {long && inPlace ? link : null}
      {long && !inPlace ? (
        <Popover opened={popover} onChange={setPopover} position="bottom-start" withArrow shadow="md">
          <Popover.Target>{link}</Popover.Target>
          <Popover.Dropdown className={cx('sk-expandable-text__popover', renderWhitespace && 'sk-expandable-text--whitespace')} data-sk-expandable-popover>{text}</Popover.Dropdown>
        </Popover>
      ) : null}
    </div>
  );
}
