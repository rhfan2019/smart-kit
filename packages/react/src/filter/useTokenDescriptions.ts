/**
 * Descriptions of filter values that came without one (typed values, Out parameters written back by a value help):
 * read one by one from the field's value list, as the sap.ui.mdc field does (`getItemForValue`):
 * `<VH set>?$select=<description>&$filter=<key> eq '<value>'&$top=2`; without `$select` when the field shows the code
 * only (TextSeparate), where FE still checks the value (docs/29 §5, DV-filter3-044).
 */
import { buildValueHelpRequest, type Condition, type QueryResult, type ValueListModel } from '@rhfan2019/smart-kit-core';
import { useQueries } from '@tanstack/react-query';
import { useService, useSmartKit } from '../context/SmartKitProvider';
import { getPath } from '../field/values';

/** Text by value for the "EQ" conditions without text; undefined entries are still loading or unknown. */
export function useTokenDescriptions(vl: ValueListModel | undefined, conditions: Condition[], withDescription: boolean, serviceName?: string): Record<string, string | undefined> {
  const service = useService(serviceName);
  const { namespace, locale } = useSmartKit();
  // only a value list with a description (the Common.Text of its key) is asked; FE does not check other values
  const values = vl && !vl.fixedValues && vl.descriptionProperty
    ? [...new Set(conditions.filter((c) => c.operator === 'EQ' && !c.exclude && c.text === undefined && c.values[0] !== undefined && c.values[0] !== '').map((c) => String(c.values[0])))]
    : [];
  const results = useQueries({
    queries: values.map((v) => ({
      queryKey: ['smart-kit', namespace, service.name, locale, 'valueListText', vl?.collectionPath, vl?.keyProperty, withDescription, v],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        service.dataProvider.query(buildValueHelpRequest(service.model, vl!, { purpose: 'description', withDescription, keys: [v] }), { signal }) as Promise<QueryResult>,
      staleTime: 60_000,
    })),
  });
  const out: Record<string, string | undefined> = {};
  values.forEach((v, i) => {
    const row = results[i]?.data?.rows?.length === 1 ? results[i]!.data!.rows[0] : undefined;
    const text = row && vl?.descriptionProperty ? getPath(row, vl.descriptionProperty) : undefined;
    out[v] = withDescription && text !== undefined && text !== null && text !== '' ? String(text) : undefined;
  });
  return out;
}
