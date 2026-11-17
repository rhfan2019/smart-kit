/**
 * Data of list-like cards (list, table, timeline): the first `maxItems` rows of the entity set with the card's
 * line item, sort order and filter, plus the total count for the header counter (CD-03). Reports the counter and the
 * default header press (the list page of the entity set, CD-05) to the enclosing Card.
 */
import { entityPathOf, type FieldModel, type FilterState, type Row } from '@rhfan2019/smart-kit-core';
import { useCallback, useMemo } from 'react';
import { useMetaModel, useSmartKit } from '../context/SmartKitProvider';
import { useListQuery } from '../table/useListQuery';
import { cardFilters, resolveListSettings, type CardAnnotationSettings } from './annotations';
import { hasListPage, useReportHeaderDefaults, useReportToCard } from './CardContext';

export interface CardDataProps extends CardAnnotationSettings {
  /** Entity set name as in `$metadata`, e.g. "Orders". */
  entitySet: string;
  /** Name of the service in `SmartKitProvider` `services`; default: the provider's `defaultService`. */
  service?: string;
  /** Maximum number of items (manifest `maxItems`); default from UI.PresentationVariant/MaxItems, else per card type. */
  maxItems?: number;
  /** Additional filters, e.g. from a filter bar above the cards (the OVP global filter). */
  filters?: FilterState;
  /** Item press; default: the object page of the row when the navigation adapter has one (CD-05). */
  onItemPress?(row: Row): void;
  /** Header press default; false: the header does not navigate. */
  headerNavigation?: boolean;
}

export function useCardList(p: CardDataProps, o: { defaultMax: number; extraSelect?: string[]; columns?: (cols: FieldModel[]) => FieldModel[] }) {
  const meta = useMetaModel(p.entitySet, { service: p.service });
  const { navigation } = useSmartKit();
  const s = useMemo(() => resolveListSettings(meta.ui, p), [meta.ui, p.annotationPath, p.presentationAnnotationPath, p.selectionAnnotationPath]); // eslint-disable-line react-hooks/exhaustive-deps
  const columns = useMemo(() => (o.columns ? o.columns(s.columns) : s.columns), [s.columns]); // eslint-disable-line react-hooks/exhaustive-deps
  const filters = useMemo(() => cardFilters(s.conditions, p.filters), [s.conditions, p.filters]);
  const max = p.maxItems ?? s.maxItems ?? o.defaultMax;
  const extraSelect = useMemo(() => [...(o.extraSelect ?? []), ...(s.groupBy ? [s.groupBy] : [])], [o.extraSelect, s.groupBy]);
  const q = useListQuery({ service: p.service, source: { entitySet: p.entitySet }, columns, filters, sort: s.sort, pageSize: max, extraSelect });
  const rows = useMemo(() => q.rows.slice(0, max), [q.rows, max]);

  const serviceName = meta.service.name;
  const entitySet = p.entitySet;
  const headerPress = useCallback(() => navigation?.toList(entitySet, serviceName), [navigation, entitySet, serviceName]);
  const loaded = !q.isLoading && !q.error;
  useReportToCard(loaded && rows.length ? { visible: rows.length, total: q.count } : undefined, p.headerNavigation === false || !hasListPage(navigation, entitySet, serviceName) ? undefined : headerPress);

  useReportHeaderDefaults({ title: meta.ui.headerInfo.typeNamePlural });

  const hasObjectPage = navigation?.hasObjectPage?.(entitySet, serviceName) ?? Boolean(navigation);
  const onItemPress = p.onItemPress ?? (navigation && hasObjectPage ? (row: Row) => navigation.toObject(entityPathOf(meta.service.model, entitySet, row), serviceName) : undefined);
  return { meta, columns, rows, query: q, onItemPress, groupBy: s.groupBy };
}
