/**
 * Descriptions of filter values that came without one (typed values, Out parameters written back by a value help):
 * read one by one from the field's value list, as the sap.ui.mdc field does (`getItemForValue`):
 * - a value written back (Out parameter, variant, default): `<VH set>?$select=<description>&$filter=<key> eq '<value>'&$top=2`;
 *   without `$select` when the field shows the code only (TextSeparate), where FE still checks the value (docs/29 §5,
 *   DV-filter3-044);
 * - a typed value (`typed`): checked against the key and the description, `$filter=<key> eq '<value>' or <description> eq '<value>'&$top=2`
 *   without `$select` (the key only with TextSeparate).
 * A value list of Common.ValueListReferences is read from its value help service.
 */
import { buildValueHelpRequest, type Condition, type QueryResult, type ValueListModel } from '@rhfan2019/smart-kit-core';
import { useQueries } from '@tanstack/react-query';
import { useService, useSmartKit } from '../context/SmartKitProvider';
import { getPath } from '../field/values';
import { useValueListSource } from './useValueList';

/** Text by value for the "EQ" conditions without text; undefined entries are still loading or unknown. */
export function useTokenDescriptions(vl: ValueListModel | undefined, conditions: Condition[], withDescription: boolean, serviceName?: string, typed: ReadonlySet<string> = new Set()): Record<string, string | undefined> {
  const service = useService(serviceName);
  const { namespace, locale } = useSmartKit();
  const source = useValueListSource(vl, serviceName);
  // only a value list with a description (the Common.Text of its key) is asked; FE does not check other values
  const values = vl && !vl.fixedValues && vl.descriptionProperty
    ? [...new Set(conditions.filter((c) => c.operator === 'EQ' && !c.exclude && c.text === undefined && c.values[0] !== undefined && c.values[0] !== '').map((c) => String(c.values[0])))]
    : [];
  const results = useQueries({
    queries: values.map((v) => {
      const purpose = typed.has(v) ? 'validate' as const : 'description' as const;
      return {
        queryKey: ['smart-kit', namespace, source?.key ?? service.name, locale, 'valueListText', vl?.collectionPath, vl?.keyProperty, withDescription, purpose, v],
        enabled: Boolean(source),
        // not cancelled when the field unmounts (e.g. the filter bar is collapsed and expanded again while it runs):
        // the text is kept for the next mount instead of being read twice
        queryFn: () => source!.dataProvider.query(buildValueHelpRequest(source!.model, vl!, { purpose, withDescription, keys: [v] })) as Promise<QueryResult>,
        staleTime: 60_000,
      };
    }),
  });
  const out: Record<string, string | undefined> = {};
  values.forEach((v, i) => {
    const rows = results[i]?.data?.rows ?? [];
    // a typed value may also have matched a description: the row whose key is the value
    const row = rows.length === 1 ? rows[0] : rows.find((r) => vl && String(getPath(r, vl.keyProperty)) === v);
    const text = row && vl?.descriptionProperty ? getPath(row, vl.descriptionProperty) : undefined;
    out[v] = withDescription && text !== undefined && text !== null && text !== '' ? String(text) : undefined;
  });
  return out;
}
