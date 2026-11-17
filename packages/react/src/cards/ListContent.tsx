/**
 * List card content (sap.ui.integration.cards.ListContent; OVP list card) — docs/20 §2.2.
 * Annotation-driven: the line item gives title (1st field), description (2nd field), info on the right (the first
 * data point, else the first field with a criticality, else the 3rd field) and, for `listType="extended"`, further
 * attributes. `listFlavor="bar"` shows a bar for the info value (OVP bar chart list card).
 */
import type { FieldModel, Row } from '@rhfan2019/smart-kit-core';
import type { KeyboardEvent } from 'react';
import { useSmartKit, useText } from '../context/SmartKitProvider';
import { fieldValue, type FieldValue, type ValueContext } from '../field/values';
import { CardMessage, CardPlaceholder } from './CardStates';
import { withUnit } from './format';
import { CardAvatar } from './Header';
import { useCardList, type CardDataProps } from './useCardList';

export interface ListContentProps extends CardDataProps {
  /** OVP `listType`: "condensed" (standard item, 3 values; default) or "extended" (up to 6 values). */
  listType?: 'condensed' | 'extended';
  /** OVP `listFlavor`: "standard" (default) or "bar" (bar chart list card). */
  listFlavor?: 'standard' | 'bar';
}

/** Value state class of a criticality (sap.ui.core.ValueState colours). */
export const criticalityState = (c: number | undefined) =>
  c === 1 ? ' sk-card--state-error' : c === 2 ? ' sk-card--state-critical' : c === 3 ? ' sk-card--state-good' : c === 5 ? ' sk-card--state-information' : c === 0 ? ' sk-card--state-neutral' : '';

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
}

/** Which line item field plays which role in a list item. */
export function listRoles(ctx: ValueContext, columns: FieldModel[], max: number): ListRoles {
  const isImage = (f: FieldModel) => f.kind === 'field' && Boolean(fieldValue(ctx, f, undefined).property?.isImageUrl);
  const image = columns.find(isImage);
  const rest = columns.filter((f) => f !== image && f.kind !== 'chart');
  const info = rest.find((f) => f.kind === 'dataPoint') ?? rest.slice(2).find((f) => f.criticality) ?? rest[2];
  const texts = rest.filter((f) => f !== info);
  return { image, title: texts[0], description: texts[1], info, attributes: texts.slice(2, 2 + max) };
}

export function ListContent(p: ListContentProps) {
  const extended = p.listType === 'extended';
  const { meta, columns, rows, query, onItemPress } = useCardList(p, { defaultMax: extended ? 3 : 5 });
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
  return (
    <ul className={`sk-card__list${extended ? ' sk-card__list--extended' : ''}${bar ? ' sk-card__list--bar' : ''}`} aria-label={t('card.typeList')}>
      {rows.map((row, i) => {
        const title = v(roles.title, row);
        const desc = v(roles.description, row);
        const info = v(roles.info, row);
        const img = v(roles.image, row);
        const press = onItemPress ? () => onItemPress(row) : undefined;
        const share = bar && barMax ? Math.min(1, Math.abs(Number(info?.value) || 0) / barMax) : 0;
        return (
          <li
            key={i}
            className={`sk-card__item${press ? ' sk-card__item--pressable' : ''}`}
            tabIndex={press ? 0 : -1}
            onClick={press}
            onKeyDown={press ? itemKeyDown(press) : undefined}
          >
            {img?.value ? <CardAvatar src={String(img.value)} shape="Square" /> : null}
            <div className="sk-card__item-main">
              <div className="sk-card__item-row">
                <span className="sk-card__item-title">{title?.display}</span>
                {extended && info && <span className={`sk-card__item-info${criticalityState(info.criticality)}`}>{withUnit(info, t)}</span>}
              </div>
              {(desc || (!extended && info)) && (
                <div className="sk-card__item-row">
                  <span className="sk-card__item-description">{desc?.display}</span>
                  {!extended && !bar && info && <span className={`sk-card__item-info${criticalityState(info.criticality)}`}>{withUnit(info, t)}</span>}
                  {bar && info && <span className={`sk-card__item-info${criticalityState(info.criticality)}`}>{withUnit(info, t)}</span>}
                </div>
              )}
              {bar && (
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
          </li>
        );
      })}
    </ul>
  );
}
