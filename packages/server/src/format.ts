// Rows from PostgreSQL -> OData JSON (odata.metadata=minimal). Values arrive in their response form from SQL
// (decimals and Int64 as exact text, dates and times as ISO strings); here only the JSON type is chosen:
// with IEEE754Compatible=true, Edm.Decimal and Edm.Int64 stay strings, otherwise they become numbers.
import type { EdmType } from '@rhfan2019/smart-kit-core';
import type { AggregatePlan, CollectionPlan } from './plan';
import type { EntitySetInfo } from './schema';

export interface FormatOptions {
  ieee754: boolean;
  /** Service root URL, ending with "/" (for next links). */
  serviceRoot: string;
  /** Called for every entity written to the response (also expanded ones and the objects of grouped paths). */
  afterRead?: (entitySet: string, row: Record<string, unknown>) => void;
  /** Entity sets of the service (afterRead on the objects of grouped navigation paths). */
  entitySets?: Record<string, EntitySetInfo>;
}

type Row = Record<string, unknown>;

export function jsonValue(v: unknown, edmType: EdmType, o: FormatOptions): unknown {
  if (v === null || v === undefined) return null;
  if (edmType === 'Edm.Decimal' || edmType === 'Edm.Int64') return o.ieee754 ? String(v) : Number(v);
  if (edmType === 'Edm.Byte' || edmType === 'Edm.SByte' || edmType === 'Edm.Int16' || edmType === 'Edm.Int32' || edmType === 'Edm.Double' || edmType === 'Edm.Single')
    return typeof v === 'number' ? v : Number(v);
  return v;
}

/** A key literal of a URL: strings quoted ('' for '), everything else as is. */
function keyLiteral(v: unknown, edmType: EdmType): string {
  if (edmType === 'Edm.String') return `'${String(v).replace(/'/g, "''")}'`;
  return String(v);
}

export function keyPredicate(set: EntitySetInfo, row: Row): string {
  const keys = set.keys.map((k) => ({ k, lit: encodeURIComponent(keyLiteral(row[k], set.columns[k]!.edmType)).replace(/%27/g, "'") }));
  return keys.length === 1 ? `(${keys[0]!.lit})` : `(${keys.map((x) => `${x.k}=${x.lit}`).join(',')})`;
}

/** The weak ETag of a row: W/"<base64 of the concurrency property>", as the test service writes it. */
export const etagOf = (v: unknown) => `W/"${Buffer.from(String(v)).toString('base64')}"`;

export function formatRow(plan: CollectionPlan, row: Row, o: FormatOptions, top = false): Row {
  const out: Row = {};
  for (const c of plan.select) out[c.property] = jsonValue(row[c.property], c.edmType, o);
  for (const e of plan.expand) {
    const v = row[e.navigation.name];
    if (e.navigation.collection) {
      let list = (Array.isArray(v) ? v : []) as Row[];
      if (e.plan.pageSize && e.plan.top !== undefined && list.length > e.plan.top) {
        list = list.slice(0, e.plan.top);
        out[`${e.navigation.name}@odata.nextLink`] = `${o.serviceRoot}${plan.set.name}${keyPredicate(plan.set, row)}/${e.navigation.name}?$skip=${e.plan.skip + e.plan.top}`;
      }
      out[e.navigation.name] = list.map((r) => formatRow(e.plan, r, o));
    } else out[e.navigation.name] = v && typeof v === 'object' ? formatRow(e.plan, v as Row, o) : null;
  }
  if (top && plan.set.etag && row[plan.set.etag] !== undefined && row[plan.set.etag] !== null) out['@odata.etag'] = etagOf(row[plan.set.etag]);
  o.afterRead?.(plan.set.name, out);
  return out;
}

/** One group of a $apply result: grouped paths become nested objects (`_Status/Name` -> `{ _Status: { Name } }`). */
export function formatGroup(plan: AggregatePlan, row: Row, o: FormatOptions): Row {
  const out: Row = {};
  plan.groupBy.forEach((g, i) => {
    let target = out;
    for (const seg of g.path.slice(0, -1)) target = (target[seg] ??= {}) as Row;
    target[g.path[g.path.length - 1]!] = jsonValue(row[`g${i}`], g.ref.column.edmType, o);
  });
  plan.aggregates.forEach((a, i) => (out[a.alias] = jsonValue(row[`a${i}`], a.edmType, o)));
  if (o.afterRead) {
    // the objects of grouped navigation paths belong to the navigation's entity set
    const visit = (obj: Row, set: EntitySetInfo, schema: Record<string, EntitySetInfo>) => {
      for (const [k, v] of Object.entries(obj)) {
        const nav = set.navigations[k];
        if (nav && v && typeof v === 'object' && schema[nav.target]) visit(v as Row, schema[nav.target]!, schema);
      }
      o.afterRead!(set.name, obj);
    };
    visit(out, plan.set, o.entitySets ?? {});
  }
  return out;
}
