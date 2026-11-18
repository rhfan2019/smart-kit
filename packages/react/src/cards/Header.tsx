/**
 * Card headers (sap.f.cards.Header, sap.f.cards.NumericHeader, sap.f.cards.NumericSideIndicator) — docs/20 CD-02–CD-05.
 * The whole header is the navigation area: `onPress`, else the content's default (its list page).
 */
import type { FilterState } from '@rhfan2019/smart-kit-core';
import { isValidElement, useEffect, useId, useState, type KeyboardEvent, type ReactElement, type ReactNode } from 'react';
import { useSmartKit, useText } from '../context/SmartKitProvider';
import type { ValueState, WrappingType } from '../controls/types';
import { MessageTypeIcon } from '../messages/MessageTypeIcon';
import { useCardContext } from './CardContext';
import { counterText } from './format';
import { useKpi } from './useKpi';

/** sap.m.ValueColor */
export type ValueColor = 'Good' | 'Critical' | 'Error' | 'Neutral' | 'None';
/** sap.m.DeviationIndicator */
export type DeviationIndicator = 'Up' | 'Down' | 'None';
/** sap.m.AvatarShape */
export type AvatarShape = 'Circle' | 'Square';
/** sap.m.AvatarColor */
export type AvatarColor =
  | 'Accent1' | 'Accent2' | 'Accent3' | 'Accent4' | 'Accent5' | 'Accent6' | 'Accent7' | 'Accent8' | 'Accent9' | 'Accent10'
  | 'Placeholder' | 'Random' | 'TileIcon' | 'Transparent';
/** sap.m.AvatarSize */
export type AvatarSize = 'XS' | 'S' | 'M' | 'L' | 'XL' | 'Custom';
/** sap.m.AvatarImageFitType */
export type AvatarImageFitType = 'Cover' | 'Contain';
/** sap.f.cards.NumericHeaderSideIndicatorsAlignment */
export type NumericHeaderSideIndicatorsAlignment = 'Begin' | 'End';

/** Settings of the card icon (avatar), shared by Header and NumericHeader. */
export interface CardIconSettings {
  /** Image URL of the avatar, or an icon element (for example from lucide-react; UI5 takes an icon URI, ADR-032 rule 5). */
  iconSrc?: string | ReactElement;
  /** Initials shown in the avatar. */
  iconInitials?: string;
  /** Avatar shape. @defaultValue 'Circle' */
  iconDisplayShape?: AvatarShape;
  /** Alternative text of the avatar (its accessible name). */
  iconAlt?: string;
  /** Background colour of the avatar. @defaultValue 'Transparent' */
  iconBackgroundColor?: AvatarColor;
  /** Size of the avatar ('Custom' is shown as 'S'). @defaultValue 'S' */
  iconSize?: AvatarSize;
  /** How an image fills the avatar. @defaultValue 'Cover' */
  iconFitType?: AvatarImageFitType;
}

/** Settings of sap.f.cards.BaseHeader shared by Header and NumericHeader. */
export interface BaseHeaderSettings {
  /** Counter text, e.g. "5 of 40"; default: from the content (CD-03). */
  statusText?: string;
  /** Lines before the title is truncated (CD-02). @defaultValue 3 */
  titleMaxLines?: number;
  /** Lines before the subtitle is truncated (CD-02). @defaultValue 2 */
  subtitleMaxLines?: number;
  /** Time of the oldest data in the card (ISO 8601), shown as a relative time such as "5 minutes ago". */
  dataTimestamp?: string;
  /** Wrapping of the title, subtitle and details texts. @defaultValue 'Normal' */
  wrappingType?: WrappingType;
  /** Info sections shown at the bottom of the header (`infoSection` aggregation). */
  infoSection?: ReactNode[];
  /** Additional content in the header's toolbar area, e.g. a menu button (`toolbar` aggregation); pressing it does not press the header. */
  toolbar?: ReactNode;
  /** Press of the header (event `press`). */
  onPress?(): void;
}

export interface $HeaderSettings extends BaseHeaderSettings, CardIconSettings {
  /** Title; default: from the content's annotations (UI.HeaderInfo). */
  title?: string;
  /** Subtitle text. */
  subtitle?: string;
  /** A status-coloured message icon in the icon area instead of the avatar (do not combine with iconSrc / iconInitials). @defaultValue 'None' */
  iconState?: ValueState;
}

const ACCENTS: AvatarColor[] = ['Accent1', 'Accent2', 'Accent3', 'Accent4', 'Accent5', 'Accent6', 'Accent7', 'Accent8', 'Accent9', 'Accent10'];
/** 'Random' picks an accent from the avatar's text, so it stays the same between renders. */
const resolveColor = (c: AvatarColor, seed: string): AvatarColor => {
  if (c !== 'Random') return c;
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) % 9973;
  return ACCENTS[h % ACCENTS.length]!;
};

/** Avatar of a header or list item (sap.m.Avatar as the card uses it). */
export function CardAvatar(p: {
  src?: string | ReactElement; initials?: string; alt?: string; shape: AvatarShape; backgroundColor?: AvatarColor; size?: AvatarSize;
  fitType?: AvatarImageFitType; state?: ValueState;
}) {
  if (p.state && p.state !== 'None') {
    return (
      <span className="sk-card__avatar sk-card__avatar--state sk-card__avatar--transparent" role={p.alt ? 'img' : undefined} aria-label={p.alt} aria-hidden={p.alt ? undefined : true} data-sk-icon-state={p.state}>
        <MessageTypeIcon type={p.state} />
      </span>
    );
  }
  const element = isValidElement(p.src) ? p.src : undefined;
  const url = typeof p.src === 'string' && p.src ? p.src : undefined;
  if (!url && !p.initials && !element) return null;
  const kind = url ? 'image' : element ? 'icon' : 'initials';
  const color = resolveColor(p.backgroundColor ?? 'Transparent', p.initials ?? url ?? '');
  const size = !p.size || p.size === 'Custom' ? 'S' : p.size;
  const cls = [
    'sk-card__avatar', `sk-card__avatar--${p.shape.toLowerCase()}`, `sk-card__avatar--${kind}`,
    `sk-card__avatar--${color.toLowerCase()}`, size !== 'S' && `sk-card__avatar--size-${size.toLowerCase()}`, p.fitType === 'Contain' && 'sk-card__avatar--contain',
  ].filter(Boolean).join(' ');
  return (
    <span className={cls} role={p.alt ? 'img' : undefined} aria-label={p.alt} aria-hidden={p.alt ? undefined : true}>
      {url ? <img src={url} alt="" /> : element ?? p.initials}
    </span>
  );
}

const iconOf = (p: CardIconSettings & { iconState?: ValueState }) => (
  <CardAvatar
    src={p.iconSrc} initials={p.iconInitials} alt={p.iconAlt} shape={p.iconDisplayShape ?? 'Circle'} backgroundColor={p.iconBackgroundColor}
    size={p.iconSize} fitType={p.iconFitType} state={p.iconState}
  />
);

/** "5 minutes ago" for an ISO 8601 time (sap.f.cards.BaseHeader: "now" up to 44 seconds, then rounded minutes), refreshed every 15 s. */
function useDataTimestamp(iso: string | undefined): string | undefined {
  const { intlLocale } = useSmartKit();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!iso) return undefined;
    const id = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(id);
  }, [iso]);
  if (!iso) return undefined;
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return undefined;
  const rtf = new Intl.RelativeTimeFormat(intlLocale, { numeric: 'auto' });
  const seconds = Math.floor((now - time) / 1000);
  if (seconds <= 44) return rtf.format(0, 'second');
  const minutes = Math.floor((seconds - 44) / 60) + 1;
  if (minutes < 60) return rtf.format(-minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (hours < 24) return rtf.format(-hours, 'hour');
  return rtf.format(-Math.round(hours / 24), 'day');
}

/** Toolbar, data timestamp and info sections of a header. */
function useHeaderParts(p: BaseHeaderSettings) {
  const timestamp = useDataTimestamp(p.dataTimestamp);
  const toolbar = p.toolbar ? (
    // the toolbar is not part of the header's press area
    <div className="sk-card__toolbar" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} role="presentation">{p.toolbar}</div>
  ) : null;
  const bottom = timestamp || p.infoSection?.length ? (
    <>
      {timestamp ? <div className="sk-card__timestamp" data-sk-card-timestamp>{timestamp}</div> : null}
      {p.infoSection?.length ? <div className="sk-card__info-section">{p.infoSection.map((c, i) => <div key={i} className="sk-card__info">{c}</div>)}</div> : null}
    </>
  ) : null;
  return { toolbar, bottom };
}

/** Heading role and level of the header title (the card's `headingLevel`). */
function useHeading() {
  const level = useCardContext()?.headingLevel ?? 'H3';
  return { role: 'heading', 'aria-level': level === 'Auto' ? 3 : Number(level.slice(1)) };
}

function usePress(onPress: (() => void) | undefined) {
  const ctx = useCardContext();
  const press = onPress ?? ctx?.headerPress;
  const props = press
    ? {
        role: 'button',
        tabIndex: 0,
        onClick: press,
        onKeyDown: (e: KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            press();
          }
        },
      }
    : {};
  return { pressable: Boolean(press), props };
}

function useStatus(statusText: string | undefined) {
  const ctx = useCardContext();
  const t = useText();
  const { intlLocale } = useSmartKit();
  if (statusText !== undefined) return statusText;
  return ctx?.counter ? counterText(t, intlLocale, ctx.counter.visible, ctx.counter.total) : undefined;
}

const clampStyle = (lines: number | undefined, dflt: number) => ({ WebkitLineClamp: lines ?? dflt });
const headerClass = (p: BaseHeaderSettings, pressable: boolean, extra = '') =>
  `sk-card__header${extra}${pressable ? ' sk-card__header--pressable' : ''}${p.wrappingType === 'Hyphenated' ? ' sk-card__header--hyphenated' : ''}`;

export function Header(props: $HeaderSettings) {
  const ctx = useCardContext();
  const d = ctx?.headerDefaults;
  const p = { ...props, title: props.title ?? d?.title, subtitle: props.subtitle ?? d?.subtitle, iconSrc: props.iconSrc ?? d?.iconSrc, iconInitials: props.iconInitials ?? d?.iconInitials };
  const t = useText();
  const ownId = useId();
  const titleId = ctx?.titleId ?? ownId;
  const status = useStatus(p.statusText);
  const { pressable, props: pressProps } = usePress(p.onPress);
  const heading = useHeading();
  const { toolbar, bottom } = useHeaderParts(p);
  return (
    <div className={headerClass(p, pressable)} aria-roledescription={t('card.header')} aria-labelledby={titleId} {...pressProps}>
      <div className="sk-card__header-row sk-card__header-row--center">
        {iconOf(p)}
        <div className="sk-card__header-text">
          <div id={titleId} className="sk-card__title" style={clampStyle(p.titleMaxLines, 3)} {...heading}>{p.title}</div>
          {p.subtitle && <div className="sk-card__subtitle" style={clampStyle(p.subtitleMaxLines, 2)}>{p.subtitle}</div>}
        </div>
        {status && <span className="sk-card__status">{status}</span>}
        {toolbar}
      </div>
      {bottom}
    </div>
  );
}

export interface $NumericSideIndicatorSettings {
  /** Title text. */
  title: string;
  /** The number to show. */
  number?: string;
  /** Unit or currency code shown with the value. */
  unit?: string;
  /** Colour of the number. @defaultValue 'None' */
  state?: ValueColor;
}

/** Side indicator of a numeric header (e.g. target, deviation). */
export function NumericSideIndicator(p: $NumericSideIndicatorSettings) {
  return (
    <div className="sk-card__side">
      <div className="sk-card__side-title">{p.title}</div>
      <div className={`sk-card__side-number${stateClass(p.state)}`}>{p.number}{p.unit}</div>
    </div>
  );
}

export interface $NumericHeaderSettings extends BaseHeaderSettings, CardIconSettings {
  /** Title; default: from the content's annotations (UI.HeaderInfo). */
  title?: string;
  /** Subtitle text. */
  subtitle?: string;
  /** Unit of the number, shown in the subtitle row: "<subtitle> | <unit>" (CD-04). */
  unitOfMeasurement?: string;
  /** The main indicator (KPI) value, already formatted. */
  number?: string;
  /** Scaling factor shown next to the number, e.g. "K". */
  scale?: string;
  /** Trend arrow. @defaultValue 'None' */
  trend?: DeviationIndicator;
  /** Semantic colour of the number. @defaultValue 'Neutral' */
  state?: ValueColor;
  /** Size of the number: "S" or "L". @defaultValue 'L' */
  numberSize?: 'S' | 'L';
  /** Shows the main indicator (number, scale, trend). @defaultValue true */
  numberVisible?: boolean;
  /** Text below the number, e.g. the period of the KPI. */
  details?: string;
  /** Lines before the details text is truncated. @defaultValue 1 */
  detailsMaxLines?: number;
  /** Semantic colour of the details text (UI5: restricted to SAP Work Zone, sap.ui.core.ValueState). */
  detailsState?: ValueColor;
  /** Up to two side indicators (CD-04). */
  sideIndicators?: $NumericSideIndicatorSettings[];
  /** Alignment of the side indicators: after the number ('Begin') or at the end of the header ('End'). @defaultValue 'Begin' */
  sideIndicatorsAlignment?: NumericHeaderSideIndicatorsAlignment;
  /** A micro chart shown next to the indicators (`microChart` aggregation). */
  microChart?: ReactNode;
  /**
   * Annotation-driven KPI (OVP KPI header, docs/20): the entity set and the UI.DataPoint whose value is summed on the
   * server. Number, scale, unit, state, trend and the target / deviation side indicators come from the data point
   * unless given as props.
   */
  entitySet?: string;
  /** Name of the service in `SmartKitProvider` `services`; default: the provider's `defaultService`. */
  service?: string;
  /** e.g. "com.sap.vocabularies.UI.v1.DataPoint#Spend" or "@UI.DataPoint#Spend". */
  dataPointAnnotationPath?: string;
  /** UI.SelectionVariant that filters the KPI. */
  selectionAnnotationPath?: string;
  /** Additional filters (e.g. from a filter bar). */
  filters?: FilterState;
}

const STATE: Record<ValueColor, string> = { Good: 'good', Critical: 'critical', Error: 'error', Neutral: 'neutral', None: '' };
export const stateClass = (s: ValueColor | undefined) => (s && STATE[s] ? ` sk-card--state-${STATE[s]}` : '');

export function NumericHeader(props: $NumericHeaderSettings) {
  return props.entitySet && props.dataPointAnnotationPath ? <KpiHeader {...props} entitySet={props.entitySet} dataPointAnnotationPath={props.dataPointAnnotationPath} /> : <NumericHeaderView {...props} />;
}

function KpiHeader(p: $NumericHeaderSettings & { entitySet: string; dataPointAnnotationPath: string }) {
  const kpi = useKpi(p);
  return <NumericHeaderView {...kpi} {...definedProps(p)} />;
}

const definedProps = <T extends object>(o: T): Partial<T> => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;

function NumericHeaderView(props: $NumericHeaderSettings) {
  const ctx = useCardContext();
  const p = { ...props, title: props.title ?? ctx?.headerDefaults?.title };
  const t = useText();
  const ownId = useId();
  const titleId = ctx?.titleId ?? ownId;
  const status = useStatus(p.statusText);
  const { pressable, props: pressProps } = usePress(p.onPress);
  const heading = useHeading();
  const { toolbar, bottom } = useHeaderParts(p);
  const showNumber = p.number !== undefined && p.numberVisible !== false;
  const sides = p.sideIndicators?.slice(0, 2) ?? [];
  return (
    <div className={headerClass(p, pressable, ' sk-card__header--numeric')} aria-roledescription={t('card.header')} aria-labelledby={titleId} {...pressProps}>
      <div className="sk-card__header-row">
        {iconOf(p)}
        <div className="sk-card__header-text">
          <div id={titleId} className="sk-card__title" style={clampStyle(p.titleMaxLines, 3)} {...heading}>{p.title}</div>
          {(p.subtitle || p.unitOfMeasurement) && (
            <div className="sk-card__subtitle" style={clampStyle(p.subtitleMaxLines, 2)}>
              {p.subtitle}
              {p.subtitle && p.unitOfMeasurement && <span className="sk-card__unit-separator" aria-hidden="true" />}
              {p.unitOfMeasurement && <span className="sk-card__unit">{p.unitOfMeasurement}</span>}
            </div>
          )}
        </div>
        {status && <span className="sk-card__status">{status}</span>}
        {toolbar}
      </div>
      {(showNumber || sides.length > 0 || p.microChart) && (
        <div className={`sk-card__indicators${p.sideIndicatorsAlignment === 'End' ? ' sk-card__indicators--end' : ''}`}>
          {showNumber && <div className={`sk-card__main${stateClass(p.state ?? 'Neutral')}${p.numberSize === 'S' ? ' sk-card__main--small' : ''}`}>
            <span className="sk-card__number">{p.number}</span>
            {(p.scale || (p.trend && p.trend !== 'None')) && (
              <span className="sk-card__scale-trend">
                {p.trend && p.trend !== 'None' && <TrendArrow trend={p.trend} />}
                {p.scale && <span className="sk-card__scale">{p.scale}</span>}
              </span>
            )}
          </div>}
          {sides.length > 0 && <div className="sk-card__sides">{sides.map((s) => <NumericSideIndicator key={s.title} {...s} />)}</div>}
          {p.microChart ? <div className="sk-card__microchart">{p.microChart}</div> : null}
        </div>
      )}
      {p.details && <div className={`sk-card__details${stateClass(p.detailsState)}`} style={clampStyle(p.detailsMaxLines, 1)}>{p.details}</div>}
      {bottom}
    </div>
  );
}

/** Trend arrow of the main indicator (outline triangle, the colour of the number). */
function TrendArrow({ trend }: { trend: 'Up' | 'Down' }) {
  return (
    <svg className={`sk-card__trend sk-card__trend--${trend.toLowerCase()}`} viewBox="0 0 12 10" aria-hidden="true" focusable="false">
      <path d={trend === 'Up' ? 'M6 1 L11 9 L1 9 Z' : 'M6 9 L11 1 L1 1 Z'} />
    </svg>
  );
}
