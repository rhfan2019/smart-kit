/** sap.m.IllustratedMessage: an illustration with a title, a description and actions for empty and error states (docs/26 §3.3). */
import { createElement, type HTMLAttributes, type ReactNode } from 'react';
import type { MessageKey } from '../../i18n/messages.en';
import { useControlText } from '../context';
import { Illustration } from './illustrations';
import { cx } from './shared';
import { TEXTS } from './texts';

/** sap.m.IllustratedMessageType: the non-deprecated types of SAPUI5 1.154, drawn by this library. */
export const IllustratedMessageType = {
  Achievement: 'Achievement', AddDimensions: 'AddDimensions', AddingColumns: 'AddingColumns', AddPeopleToCalendar: 'AddPeopleToCalendar',
  BeforeSearch: 'BeforeSearch', DragFilesToUpload: 'DragFilesToUpload', EmptyPlanningCalendar: 'EmptyPlanningCalendar', FilteringColumns: 'FilteringColumns',
  GroupingColumns: 'GroupingColumns', KeyTask: 'KeyTask', NewMail: 'NewMail', NoActivities: 'NoActivities', NoChartData: 'NoChartData',
  NoColumnsSet: 'NoColumnsSet', NoData: 'NoData', NoEntries: 'NoEntries', NoFilterResults: 'NoFilterResults', NoMail: 'NoMail',
  NoNotifications: 'NoNotifications', NoSavedItems: 'NoSavedItems', NoSearchResults: 'NoSearchResults', NoTasks: 'NoTasks', PageNotFound: 'PageNotFound',
  ReceiveAppreciation: 'ReceiveAppreciation', ResizingColumns: 'ResizingColumns', SignOut: 'SignOut', SortingColumns: 'SortingColumns', Survey: 'Survey',
  UnableToLoad: 'UnableToLoad', UnableToLoadImage: 'UnableToLoadImage', UnableToUpload: 'UnableToUpload', UploadToCloud: 'UploadToCloud', UserHasSignedUp: 'UserHasSignedUp',
} as const;
export type IllustratedMessageType = (typeof IllustratedMessageType)[keyof typeof IllustratedMessageType];

/** sap.m.IllustratedMessageSize (without the deprecated Dot, Spot, Dialog and Scene). */
export type IllustratedMessageSize = 'Auto' | 'Base' | 'ExtraSmall' | 'Small' | 'Medium' | 'Large';
export const IllustratedMessageSize = { Auto: 'Auto', Base: 'Base', ExtraSmall: 'ExtraSmall', Small: 'Small', Medium: 'Medium', Large: 'Large' } as const;

export interface $IllustratedMessageSettings extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Description; defaults to the type's text when enableDefaultTitleAndDescription is on. */
  description?: string;
  /** Uses the default title and description of the type for the missing ones. @defaultValue true */
  enableDefaultTitleAndDescription?: boolean;
  /** Accepted for compatibility: the description stays plain text, HTML is not parsed. @defaultValue false */
  enableFormattedText?: boolean;
  /** Auto size also follows the container height; the container then needs a height. @defaultValue false */
  enableVerticalResponsiveness?: boolean;
  /**
   * Size (Auto: chosen by the container width — below 160px Base without illustration, then ExtraSmall, Small,
   * Medium, and from 680px Large).
   * @defaultValue 'Auto'
   */
  illustrationSize?: IllustratedMessageSize;
  /** Illustration; `src` takes precedence. @defaultValue 'NoSearchResults' */
  illustrationType?: IllustratedMessageType;
  /**
   * Illustration as a URI, taking precedence over `illustrationType`: `sap-illustration://<type>` (or
   * `sap-illustration://sapIllus/<type>`) for a type of the default set. Other sets are not available; the control then
   * falls back to `illustrationType`.
   * @defaultValue ''
   */
  src?: string;
  /** Title; defaults to the type's text when enableDefaultTitleAndDescription is on. */
  title?: string;
  /** sap.ui.core.TitleLevel of the title (Auto renders a level-2 heading). @defaultValue 'Auto' */
  ariaTitleLevel?: 'Auto' | 'H1' | 'H2' | 'H3' | 'H4' | 'H5' | 'H6';
  /** The illustration is decorative: hidden from screen readers (false: an image labelled with the title). @defaultValue false */
  decorative?: boolean;
  /** Actions below the description, usually buttons. */
  additionalContent?: ReactNode;
  /** IDs of the elements that label the illustration (aria-labelledby on the illustration; ignored when decorative). */
  illustrationAriaLabelledBy?: string | string[];
  /** IDs of the elements that describe the illustration (aria-describedby on the illustration; ignored when decorative). */
  illustrationAriaDescribedBy?: string | string[];
}

const TYPES = new Set<string>(Object.values(IllustratedMessageType));

/** The illustration type a `sap-illustration://` URI names in the default set, or undefined. */
export function illustrationTypeOfSrc(src: string | undefined): IllustratedMessageType | undefined {
  const m = /^sap-illustration:\/\/(?:(sapIllus)\/)?([A-Za-z]+)$/.exec(src ?? '');
  return m && TYPES.has(m[2]!) ? (m[2] as IllustratedMessageType) : undefined;
}

const ids = (v: string | string[] | undefined) => (Array.isArray(v) ? v.join(' ') : v) || undefined;

export function IllustratedMessage({
  description, enableDefaultTitleAndDescription = true, enableFormattedText: _formatted, enableVerticalResponsiveness = false, illustrationSize = 'Auto',
  illustrationType: typeProp = 'NoSearchResults', src = '', title, ariaTitleLevel = 'Auto', decorative = false, additionalContent,
  illustrationAriaLabelledBy, illustrationAriaDescribedBy, className, ...rest
}: $IllustratedMessageSettings) {
  const t = useControlText(TEXTS);
  const illustrationType = illustrationTypeOfSrc(src) ?? typeProp;
  const text = (part: 'title' | 'description') => t(`ctl.illustratedMessage.${illustrationType}.${part}` as MessageKey);
  const shownTitle = title || (enableDefaultTitleAndDescription ? text('title') : undefined);
  const shownDescription = description || (enableDefaultTitleAndDescription ? text('description') : undefined);
  const level = ariaTitleLevel === 'Auto' ? 'h2' : `h${ariaTitleLevel.slice(1)}`;
  const cls = cx(
    'sk-illustrated-message', `sk-illustrated-message--${illustrationSize.toLowerCase()}`, enableVerticalResponsiveness && illustrationSize === 'Auto' && 'sk-illustrated-message--vertical', className,
  );
  return (
    <div {...rest} className={cls} data-sk-illustrated-message={illustrationType} data-size={illustrationSize}>
      <div className="sk-illustrated-message__inner">
        {illustrationSize !== 'Base' ? (
          <Illustration type={illustrationType} className="sk-illustrated-message__illustration" label={decorative ? undefined : shownTitle || illustrationType}
            labelledBy={decorative ? undefined : ids(illustrationAriaLabelledBy)} describedBy={decorative ? undefined : ids(illustrationAriaDescribedBy)}
          />
        ) : null}
        {shownTitle ? createElement(level, { className: 'sk-illustrated-message__title' }, shownTitle) : null}
        {shownDescription ? <p className="sk-illustrated-message__description">{shownDescription}</p> : null}
        {additionalContent ? <div className="sk-illustrated-message__actions">{additionalContent}</div> : null}
      </div>
    </div>
  );
}
