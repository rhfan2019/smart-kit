/**
 * Conversion between filter conditions and the JSON form of `sap.fe.navigation.SelectionVariant` (`toJSONObject()`),
 * used by `FilterBar.getSelectionVariant` / `setSelectionVariant`.
 */
import { isRelativeDateOperator, type Condition, type FilterState, type Operator } from '@rhfan2019/smart-kit-core';

/** One range of a select option (sap.fe.navigation.SelectionVariant). */
export interface SelectionVariantRange {
  Sign: 'I' | 'E';
  Option: string;
  Low: string;
  High?: string | null;
  /** Description of the value (used by `setSelectionVariant(sv, true)`). */
  Text?: string;
}

/** The JSON object of a sap.fe.navigation.SelectionVariant. */
export interface SelectionVariant {
  SelectionVariantID?: string;
  Text?: string;
  ODataFilterExpression?: string;
  Parameters?: { PropertyName: string; PropertyValue: string }[];
  SelectOptions?: { PropertyName: string; Ranges: SelectionVariantRange[] }[];
}

const RANGE_OPTIONS = new Set(['EQ', 'NE', 'BT', 'NB', 'LT', 'LE', 'GT', 'GE']);
const str = (v: unknown) => (v === undefined || v === null ? '' : String(v));

function rangeOf(c: Condition): SelectionVariantRange | undefined {
  const Sign = c.exclude ? 'E' : 'I';
  const v = c.values;
  if (RANGE_OPTIONS.has(c.operator)) {
    const r: SelectionVariantRange = { Sign, Option: c.operator, Low: str(v[0]), High: c.operator === 'BT' || c.operator === 'NB' ? str(v[1]) : null };
    if (c.text) r.Text = c.text;
    return r;
  }
  if (c.operator === 'Contains') return { Sign, Option: 'CP', Low: `*${str(v[0])}*`, High: null };
  if (c.operator === 'StartsWith') return { Sign, Option: 'CP', Low: `${str(v[0])}*`, High: null };
  if (c.operator === 'EndsWith') return { Sign, Option: 'CP', Low: `*${str(v[0])}`, High: null };
  if (c.operator === 'NotContains') return { Sign: c.exclude ? 'I' : 'E', Option: 'CP', Low: `*${str(v[0])}*`, High: null };
  // Empty, NotEmpty and the relative date operators have no range form (FE leaves custom operators out as well)
  return undefined;
}

/** Filters and search as a SelectionVariant; the search text is the select option `$search` (as in FE). */
export function toSelectionVariant(filters: FilterState, search: string): SelectionVariant {
  const SelectOptions: NonNullable<SelectionVariant['SelectOptions']> = [];
  for (const [PropertyName, conditions] of Object.entries(filters)) {
    const Ranges = conditions.map(rangeOf).filter((r): r is SelectionVariantRange => Boolean(r));
    if (Ranges.length) SelectOptions.push({ PropertyName, Ranges });
  }
  if (search) SelectOptions.push({ PropertyName: '$search', Ranges: [{ Sign: 'I', Option: 'EQ', Low: search, High: null }] });
  return { SelectionVariantID: '', SelectOptions };
}

/** Conditions of a SelectionVariant; `$search` and unknown options are skipped (as FE's setSelectionVariant does). */
export function fromSelectionVariant(sv: SelectionVariant, prefillDescriptions = false): FilterState {
  const out: FilterState = {};
  for (const so of sv.SelectOptions ?? []) {
    if (so.PropertyName === '$search') continue;
    for (const r of so.Ranges ?? []) {
      let operator: string = r.Option;
      let values: unknown[] = r.Option === 'BT' || r.Option === 'NB' ? [r.Low, r.High] : [r.Low];
      if (r.Option === 'CP') {
        const s = r.Low.startsWith('*');
        const e = r.Low.endsWith('*');
        operator = s && e ? 'Contains' : e ? 'StartsWith' : s ? 'EndsWith' : 'EQ';
        values = [r.Low.replace(/^\*|\*$/g, '')];
      } else if (!RANGE_OPTIONS.has(r.Option) && !isRelativeDateOperator(r.Option)) continue;
      const c: Condition = { operator: operator as Operator, values };
      if (r.Sign === 'E') c.exclude = true;
      if (prefillDescriptions && r.Text) c.text = r.Text;
      (out[so.PropertyName] ??= []).push(c);
    }
  }
  for (const p of sv.Parameters ?? []) (out[p.PropertyName] ??= []).push({ operator: 'EQ', values: [p.PropertyValue] });
  return out;
}
