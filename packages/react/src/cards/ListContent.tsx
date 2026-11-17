/**
 * List card content (sap.ui.integration.cards.ListContent; OVP list card) — docs/20 §2.2.
 * Annotation-driven: the line item gives title (1st field), description (2nd field), info on the right (the first
 * data point, else the first field with a criticality, else the 3rd field) and, for `listType="extended"`, further
 * attributes. `listFlavor="bar"` shows a bar for the info value (OVP bar chart list card).
 */
import type { FieldModel, Row } from '@rhfan2019/smart-kit-core';
import { lazy, Suspense, type KeyboardEvent } from 'react';
import { useSmartKit, useText } from '../context/SmartKitProvider';
import { fieldValue, type FieldValue, type ValueContext } from '../field/values';
import { CardMessage, CardPlaceholder } from './CardStates';
import { withUnit } from './format';
import { CardAvatar } from './Header';
import { useCardList, type CardDataProps } from './useCardList';

/** Loaded only when a list draws bullets (ADR-026 P4: an application without bullets does not ship the micro charts). */
const ItemBullet = lazy(() => import('./ItemBullet'));

export interface ListContentProps extends CardDataProps {
  /** OVP `listType`: "condensed" (standard item, 3 values; default) or "extended" (up to 6 values). */
  listType?: 'condensed' | 'extended';
  /**
   * OVP `listFlavor`: "standard" (default) or "bar" (bar chart list card). With "bar", a data point with a target
   * value is drawn as a bullet micro chart (the integration card's list item chart), otherwise as a bar.
   */
  listFlavor?: 'standard' | 'bar';
  /** Coloured line at the start of each item from the criticality of the item (integration card `highlight`). */
  highlight?: boolean;
  /** Icon in front of the info value when it has a state (integration card `info.showStateIcon`). */
  showStateIcon?: boolean;
}

/** Value state class of a criticality (sap.ui.core.ValueState colours). */
export const criticalityState = (c: number | undefined) =>
  c === 1 ? ' sk-card--state-error' : c === 2 ? ' sk-card--state-critical' : c === 3 ? ' sk-card--state-good' : c === 5 ? ' sk-card--state-information' : c === 0 ? ' sk-card--state-neutral' : '';

/** Highlight colour of an item by criticality (sap.ui.core.MessageType / IndicationColor). */
const HIGHLIGHT: Record<number, string> = { 0: 'none', 1: 'error', 2: 'warning', 3: 'success', 5: 'information' };

export function itemKeyDown(press: () => void) {
  return (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      press();
    }
  };
}

interface ListRoles {
  image?: FieldModel;
  title?: FieldModel;
  description?: FieldModel;
  info?: FieldModel;
  attributes: FieldModel[];
  /** The field whose criticality colours the item (highlight): the first field with a criticality. */
  highlight?: FieldModel;
}

/** Which line item field plays which role in a list item. */
export function listRoles(ctx: ValueContext, columns: FieldModel[], max: number): ListRoles {
  const isImage = (f: FieldModel) => f.kind === 'field' && Boolean(fieldValue(ctx, f, undefined).property?.isImageUrl);
  const image = columns.find(isImage);
  const rest = columns.filter((f) => f !== image && f.kind !== 'chart');
  const info = rest.find((f) => f.kind === 'dataPoint') ?? rest.slice(2).find((f) => f.criticality) ?? rest[2];
  const texts = rest.filter((f) => f !== info);
  return { image, title: texts[0], description: texts[1], info, attributes: texts.slice(2, 2 + max), highlight: rest.find((f) => f.criticality || f.dataPoint?.criticality) };
}

export function ListContent(p: ListContentProps) {
  const extended = p.listType === 'extended';
  const { meta, columns, rows, query, onItemPress, groupBy } = useCardList(p, { defaultMax: extended ? 3 : 5 });
  const { locale, timeZone } = useSmartKit();
  const t = useText();
  const ctx: ValueContext = { model: meta.service.model, typeName: meta.set.typeName, locale, timeZone };
  if (query.isLoading) return <CardPlaceholder kind="list" rows={p.maxItems ?? (extended ? 3 : 5)} />;
  if (query.error) return <CardMessage kind="error" />;
  if (!rows.length) return <CardMessage kind="noItems" />;
  const roles = listRoles(ctx, columns, extended ? 4 : 0);
  const v = (f: FieldModel | undefined, row: Row): FieldValue | undefined => (f ? fieldValue(ctx, f, row) : undefined);
  const bar = p.listFlavor === 'bar';
  const barMax = bar ? Math.max(...rows.map((r) => Math.abs(Number(v(roles.info, r)?.value) || 0)), 0) : 0;
  const bullet = bar && roles.info?.kind === 'dataPoint' && roles.info.dataPoint?.targetValue ? roles.info.dataPoint : undefined;
  const groupField = groupBy ? columns.find((c) => c.path === groupBy) ?? ({ id: 'group', kind: 'field', path: groupBy, label: '', criticalityIcon: false, isSemanticKey: false } as FieldModel) : undefined;
  const infoEl = (info: FieldValue | undefined) =>
    info && (
      <span className={`sk-card__item-info${criticalityState(info.criticality)}`}>
        {p.showStateIcon && <StateIcon criticality={info.criticality} />}
        {withUnit(info, t)}
      </span>
    );
  let lastGroup: string | undefined;
  return (
    <ul className={`sk-card__list${extended ? ' sk-card__list--extended' : ''}${bar ? ' sk-card__list--bar' : ''}`} aria-label={t('card.typeList')}>
      {rows.flatMap((row, i) => {
        const title = v(roles.title, row);
        const desc = v(roles.description, row);
        const info = v(roles.info, row);
        const img = v(roles.image, row);
        const press = onItemPress ? () => onItemPress(row) : undefined;
        const share = bar && barMax ? Math.min(1, Math.abs(Number(info?.value) || 0) / barMax) : 0;
        const hl = p.highlight && roles.highlight ? HIGHLIGHT[v(roles.highlight, row)?.criticality ?? 0] : undefined;
        const out = [];
        if (groupField) {
          const g = fieldValue(ctx, groupField, row).display;
          if (g !== lastGroup) out.push(<li key={`g${i}`} className="sk-card__group" role="presentation">{g}</li>);
          lastGroup = g;
        }
        out.push(
          <li
            key={i}
            className={`sk-card__item${press ? ' sk-card__item--pressable' : ''}${hl && hl !== 'none' ? ` sk-card__item--highlight sk-card__item--hl-${hl}` : ''}`}
            tabIndex={press ? 0 : -1}
            onClick={press}
            onKeyDown={press ? itemKeyDown(press) : undefined}
          >
            {img?.value ? <CardAvatar src={String(img.value)} shape="Square" /> : null}
            <div className="sk-card__item-main">
              <div className="sk-card__item-row">
                <span className="sk-card__item-title">{title?.display}</span>
                {extended && infoEl(info)}
              </div>
              {(desc || (!extended && info)) && (
                <div className="sk-card__item-row">
                  <span className="sk-card__item-description">{desc?.display}</span>
                  {!extended && infoEl(info)}
                </div>
              )}
              {bullet && info && (
                <div className="sk-card__item-chart">
                  <div className="sk-card__item-bullet">
                    <Suspense fallback={null}>
                      <ItemBullet dp={bullet} row={row} value={Number(info.value)} label={roles.info!.label} />
                    </Suspense>
                  </div>
                </div>
              )}
              {bar && !bullet && (
                <div className="sk-card__item-bar" role="img" aria-label={info ? `${roles.info?.label}: ${withUnit(info, t)}` : undefined}>
                  <span className={`sk-card__item-bar-fill${criticalityState(info?.criticality)}`} style={{ inlineSize: `${(share * 100).toFixed(1)}%` }} />
                </div>
              )}
              {extended && roles.attributes.length > 0 && (
                <div className="sk-card__item-attributes">
                  {roles.attributes.map((f) => {
                    const a = fieldValue(ctx, f, row);
                    return <span key={f.id} className={`sk-card__item-attribute${criticalityState(a.criticality)}`}>{withUnit(a, t)}</span>;
                  })}
                </div>
              )}
            </div>
          </li>,
        );
        return out;
      })}
    </ul>
  );
}

/** State icon of a value (sap.m.ObjectStatus showStateIcon): check, warning, error, information. */
export function StateIcon({ criticality }: { criticality: number | undefined }) {
  const kind = criticality === 3 ? 'positive' : criticality === 2 ? 'critical' : criticality === 1 ? 'negative' : criticality === 5 ? 'info' : undefined;
  if (!kind) return null;
  return (
    <svg className={`sk-card__state-icon sk-card__state-icon--${kind}`} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      {kind === 'critical' ? (
        <>
          <path d="M8 1.5 L15 14 L1 14 Z" />
          <path d="M8 6v4M8 11.8v.4" />
        </>
      ) : (
        <>
          <circle cx="8" cy="8" r="6.5" />
          <path d={kind === 'positive' ? 'M5 8.2l2 2 4-4.2' : kind === 'negative' ? 'M5.7 5.7l4.6 4.6M10.3 5.7l-4.6 4.6' : 'M8 7v4.5M8 4.6v.4'} />
        </>
      )}
    </svg>
  );
}
