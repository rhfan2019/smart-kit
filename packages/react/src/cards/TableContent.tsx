/**
 * Table card content (sap.ui.integration.cards.TableContent; OVP table card) — docs/20 §2.2.
 * At most 3 columns (the most important line item fields, in line item order) and 3 rows by default; a column can be
 * a field or a data point (semantic colour). The semantic key column is the row identifier (bold).
 */
import type { FieldModel, Importance, Row } from '@rhfan2019/smart-kit-core';
import { useMemo } from 'react';
import { useMetaModel, useSmartKit, useText } from '../context/SmartKitProvider';
import { fieldValue, getPath, resolveRef, type FieldValue, type ValueContext } from '../field/values';
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
  const meta = useMetaModel(p.entitySet, { service: p.service });
  const hi = meta.ui.headerInfo;
  // The identifier column (the UI.HeaderInfo title) shows the HeaderInfo description below it (integration card `identifier`).
  const extra = useMemo(() => (hi.description ? [hi.description] : []), [hi.description]);
  const { columns, rows, query, onItemPress, groupBy } = useCardList(p, { defaultMax: 3, columns: (c) => cardColumns(c, maxColumns), extraSelect: extra });
  const { locale, timeZone } = useSmartKit();
  const t = useText();
  if (query.isLoading) return <CardPlaceholder kind="table" rows={p.maxItems ?? 3} />;
  if (query.error) return <CardMessage kind="error" />;
  if (!rows.length) return <CardMessage kind="noItems" />;
  const ctx: ValueContext = { model: meta.service.model, typeName: meta.set.typeName, locale, timeZone };
  const numeric = (f: FieldModel) => f.dataPoint?.visualization !== 'Progress' && NUMERIC.has(fieldValue(ctx, f, undefined).property?.edmType ?? '');
  const isIdentifier = (c: FieldModel) => c.isSemanticKey || (Boolean(hi.title) && c.path === hi.title);
  const groupField: FieldModel | undefined = groupBy ? columns.find((c) => c.path === groupBy) ?? { id: 'group', kind: 'field', path: groupBy, label: '', criticalityIcon: false, isSemanticKey: false } : undefined;
  let lastGroup: string | undefined;
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
        {rows.flatMap((row, i) => {
          const press = onItemPress ? () => onItemPress(row) : undefined;
          const out = [];
          if (groupField) {
            const g = fieldValue(ctx, groupField, row).display;
            if (g !== lastGroup) out.push(<tr key={`g${i}`} className="sk-card__group-row"><th scope="rowgroup" colSpan={columns.length}>{g}</th></tr>);
            lastGroup = g;
          }
          out.push(
            <tr key={i} className={press ? 'sk-card__row--pressable' : undefined} tabIndex={press ? 0 : -1} onClick={press} onKeyDown={press ? itemKeyDown(press) : undefined}>
              {columns.map((c) => {
                const v = fieldValue(ctx, c, row);
                const id = isIdentifier(c);
                const cls = [id && 'sk-card__cell--identifier', numeric(c) && 'sk-card__cell--end'].filter(Boolean).join(' ');
                if (c.dataPoint?.visualization === 'Progress') return <td key={c.id}><Progress dp={c.dataPoint} v={v} row={row} /></td>;
                if (id) {
                  const sub = hi.description && hi.description !== c.path ? getPath(row, hi.description) : undefined;
                  return (
                    <td key={c.id} className={cls}>
                      <span className={press ? 'sk-card__identifier sk-card__identifier--link' : 'sk-card__identifier'}>{withUnit(v, t)}</span>
                      {sub !== undefined && sub !== null && sub !== '' && <span className="sk-card__identifier-text">{String(sub)}</span>}
                    </td>
                  );
                }
                return (
                  <td key={c.id} className={cls || undefined}>
                    <span className={criticalityState(v.criticality).trim() || undefined}>{withUnit(v, t)}</span>
                  </td>
                );
              })}
            </tr>,
          );
          return out;
        })}
      </tbody>
    </table>
  );
}

/** Progress data point (UI.VisualizationType/Progress): the percentage above a bar in the state colour (sap.m.ProgressIndicator). */
function Progress({ dp, v, row }: { dp: NonNullable<FieldModel['dataPoint']>; v: FieldValue; row: Row }) {
  const value = Number(v.value);
  const target = Number(resolveRef(row, dp.targetValue) ?? 100) || 100;
  const pct = Number.isFinite(value) ? Math.max(0, Math.min(100, (value / target) * 100)) : 0;
  const state = criticalityState(v.criticality);
  return (
    <div className="sk-card__progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label={dp.title}>
      <span className="sk-card__progress-text">{`${Math.round(pct)}%`}</span>
      <span className={`sk-card__progress-track${state}`}>
        <span className="sk-card__progress-bar" style={{ inlineSize: `${pct.toFixed(1)}%` }} />
      </span>
    </div>
  );
}
