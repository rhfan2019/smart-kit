/**
 * Card headers (sap.f.cards.Header, sap.f.cards.NumericHeader, sap.f.cards.NumericSideIndicator) — docs/20 CD-02–CD-05.
 * The whole header is the navigation area: `onPress`, else the content's default (its list page).
 */
import type { FilterState } from '@rhfan2019/smart-kit-core';
import { useId, type KeyboardEvent, type ReactNode } from 'react';
import { useSmartKit, useText } from '../context/SmartKitProvider';
import { useCardContext } from './CardContext';
import { counterText } from './format';
import { useKpi } from './useKpi';

export type ValueColor = 'Good' | 'Critical' | 'Error' | 'Neutral' | 'None';
export type DeviationIndicator = 'Up' | 'Down' | 'None';

export interface $HeaderSettings {
  /** Title; default: from the content's annotations (UI.HeaderInfo). */
  title?: string;
  /** Subtitle text. */
  subtitle?: string;
  /** Counter text, e.g. "5 of 40"; default: from the content (CD-03). */
  statusText?: string;
  /** Image URL of the avatar. */
  iconSrc?: string;
  /** Initials shown in the avatar. */
  iconInitials?: string;
  /** Avatar shape (sap.m.AvatarShape); default "Circle". */
  iconDisplayShape?: 'Circle' | 'Square';
  iconAlt?: string;
  /** An icon element (for example from lucide-react) instead of an image or initials. */
  icon?: ReactNode;
  /** Lines before the title is truncated (default 3, CD-02). */
  titleMaxLines?: number;
  /** Lines before the subtitle is truncated (default 2, CD-02). */
  subtitleMaxLines?: number;
  /** Press of the header (event `press`). */
  onPress?(): void;
}

/** Avatar of a header or list item. */
export function CardAvatar(p: { src?: string; initials?: string; icon?: ReactNode; alt?: string; shape: 'Circle' | 'Square' }) {
  if (!p.src && !p.initials && !p.icon) return null;
  const kind = p.src ? 'image' : p.icon ? 'icon' : 'initials';
  return (
    <span className={`sk-card__avatar sk-card__avatar--${p.shape.toLowerCase()} sk-card__avatar--${kind}`} role={p.alt ? 'img' : undefined} aria-label={p.alt} aria-hidden={p.alt ? undefined : true}>
      {p.src ? <img src={p.src} alt="" /> : p.icon ?? p.initials}
    </span>
  );
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

export function Header(props: $HeaderSettings) {
  const ctx = useCardContext();
  const d = ctx?.headerDefaults;
  const p = { ...props, title: props.title ?? d?.title, subtitle: props.subtitle ?? d?.subtitle, iconSrc: props.iconSrc ?? d?.iconSrc, iconInitials: props.iconInitials ?? d?.iconInitials };
  const t = useText();
  const ownId = useId();
  const titleId = ctx?.titleId ?? ownId;
  const status = useStatus(p.statusText);
  const { pressable, props: pressProps } = usePress(p.onPress);
  return (
    <div className={`sk-card__header${pressable ? ' sk-card__header--pressable' : ''}`} aria-roledescription={t('card.header')} aria-labelledby={titleId} {...pressProps}>
      <CardAvatar src={p.iconSrc} initials={p.iconInitials} icon={p.icon} alt={p.iconAlt} shape={p.iconDisplayShape ?? 'Circle'} />
      <div className="sk-card__header-text">
        <div id={titleId} className="sk-card__title" style={clampStyle(p.titleMaxLines, 3)}>{p.title}</div>
        {p.subtitle && <div className="sk-card__subtitle" style={clampStyle(p.subtitleMaxLines, 2)}>{p.subtitle}</div>}
      </div>
      {status && <span className="sk-card__status">{status}</span>}
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
  /** Colour of the number (sap.m.ValueColor). */
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

export interface $NumericHeaderSettings extends Omit<$HeaderSettings, 'iconSrc' | 'iconInitials' | 'iconDisplayShape' | 'iconAlt' | 'icon'> {
  /** Unit of the number, shown in the subtitle row: "<subtitle> | <unit>" (CD-04). */
  unitOfMeasurement?: string;
  /** The main indicator (KPI) value, already formatted. */
  number?: string;
  /** Scaling factor shown next to the number, e.g. "K". */
  scale?: string;
  /** Trend arrow: "Up" | "Down" | "None". */
  trend?: DeviationIndicator;
  /** Value state colour: "Good" | "Error" | "Critical" | "Neutral" | "None". */
  state?: ValueColor;
  /** Size of the number (default "L"). */
  numberSize?: 'S' | 'L';
  /** Text below the number, e.g. the period of the KPI. */
  details?: string;
  detailsState?: ValueColor;
  /** Up to two side indicators (CD-04). */
  sideIndicators?: $NumericSideIndicatorSettings[];
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
  return (
    <div className={`sk-card__header sk-card__header--numeric${pressable ? ' sk-card__header--pressable' : ''}`} aria-roledescription={t('card.header')} aria-labelledby={titleId} {...pressProps}>
      <div className="sk-card__header-row">
        <div className="sk-card__header-text">
          <div id={titleId} className="sk-card__title" style={clampStyle(p.titleMaxLines, 3)}>{p.title}</div>
          {(p.subtitle || p.unitOfMeasurement) && (
            <div className="sk-card__subtitle" style={clampStyle(p.subtitleMaxLines, 2)}>
              {p.subtitle}
              {p.subtitle && p.unitOfMeasurement && <span className="sk-card__unit-separator" aria-hidden="true" />}
              {p.unitOfMeasurement && <span className="sk-card__unit">{p.unitOfMeasurement}</span>}
            </div>
          )}
        </div>
        {status && <span className="sk-card__status">{status}</span>}
      </div>
      {p.number !== undefined && (
        <div className="sk-card__indicators">
          <div className={`sk-card__main${stateClass(p.state)}${p.numberSize === 'S' ? ' sk-card__main--small' : ''}`}>
            <span className="sk-card__number">{p.number}</span>
            {(p.scale || (p.trend && p.trend !== 'None')) && (
              <span className="sk-card__scale-trend">
                {p.trend && p.trend !== 'None' && <TrendArrow trend={p.trend} />}
                {p.scale && <span className="sk-card__scale">{p.scale}</span>}
              </span>
            )}
          </div>
          {p.sideIndicators?.slice(0, 2).map((s) => <NumericSideIndicator key={s.title} {...s} />)}
        </div>
      )}
      {p.details && <div className={`sk-card__details${stateClass(p.detailsState)}`}>{p.details}</div>}
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
