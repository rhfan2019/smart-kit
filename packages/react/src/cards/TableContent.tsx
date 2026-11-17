/**
 * Table card content (sap.ui.integration.cards.TableContent; OVP table card) — docs/20 §2.2.
 * At most 3 columns (the most important line item fields, in line item order) and 3 rows by default; a column can be
 * a field or a data point (semantic colour). The semantic key column is the row identifier (bold).
 */
import type { FieldModel, Importance } from '@rhfan2019/smart-kit-core';
import { useSmartKit, useText } from '../context/SmartKitProvider';
import { fieldValue, type ValueContext } from '../field/values';
import { CardMessage, CardPlaceholder } from './CardStates';
import { withUnit } from './format';
import { criticalityState, itemKeyDown } from './ListContent';
import { useCardList, type CardDataProps } from './useCardList';

export interface TableContentProps extends CardDataProps {
  /** Maximum number of columns (default 3, OVP table card). */
  maxColumns?: number;
}

const RANK: Record<Importance | 'none', number> = { High: 0, Medium: 1, none: 1, Low: 2 };
const NUMERIC = new Set(['Edm.Decimal', 'Edm.Double', 'Edm.Single', 'Edm.Int16', 'Edm.Int32', 'Edm.Int64', 'Edm.Byte', 'Edm.SByte']);

/** The `max` most important fields, kept in line item order (charts are not shown in cards). */
export function cardColumns(columns: FieldModel[], max: number): FieldModel[] {
  const usable = columns.filter((c) => c.kind !== 'chart');
  const chosen = new Set([...usable].sort((a, b) => RANK[a.importance ?? 'none'] - RANK[b.importance ?? 'none']).slice(0, max));
  return usable.filter((c) => chosen.has(c));
}

export function TableContent(p: TableContentProps) {
  const maxColumns = p.maxColumns ?? 3;
  const { meta, columns, rows, query, onItemPress } = useCardList(p, { defaultMax: 3, columns: (c) => cardColumns(c, maxColumns) });
  const { locale, timeZone } = useSmartKit();
  const t = useText();
  if (query.isLoading) return <CardPlaceholder kind="table" rows={p.maxItems ?? 3} />;
  if (query.error) return <CardMessage kind="error" />;
  if (!rows.length) return <CardMessage kind="noItems" />;
  const ctx: ValueContext = { model: meta.service.model, typeName: meta.set.typeName, locale, timeZone };
  const numeric = (f: FieldModel) => NUMERIC.has(fieldValue(ctx, f, undefined).property?.edmType ?? '');
  return (
    <table className="sk-card__table" aria-label={t('card.typeTable')}>
      <thead>
        <tr>
          {columns.map((c) => (
            <th key={c.id} scope="col" className={numeric(c) ? 'sk-card__cell--end' : undefined}>{c.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => {
          const press = onItemPress ? () => onItemPress(row) : undefined;
          return (
            <tr key={i} className={press ? 'sk-card__row--pressable' : undefined} tabIndex={press ? 0 : -1} onClick={press} onKeyDown={press ? itemKeyDown(press) : undefined}>
              {columns.map((c) => {
                const v = fieldValue(ctx, c, row);
                const cls = [c.isSemanticKey && 'sk-card__cell--identifier', numeric(c) && 'sk-card__cell--end'].filter(Boolean).join(' ');
                return (
                  <td key={c.id} className={cls || undefined}>
                    <span className={criticalityState(v.criticality).trim() || undefined}>{withUnit(v, t)}</span>
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
