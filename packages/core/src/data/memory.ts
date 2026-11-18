/** In-memory data provider: evaluates query requests directly (tests, Storybook, demos without a backend). */
import { compareValues, matches } from '../conditions/conditions';
import type { EntityTypeModel, MetaModel, NavigationModel } from '../model/types';
import { keyPredicate, resolveEntityPath, type EntityPath } from '../query/entityPath';
import { EDIT_STATE, editStateOf, matchesEditState } from '../query/draftEditState';
import { hiddenFilterPath } from '../query/hiddenFilters';
import { hierarchyOf } from '../query/hierarchy';
import { sourceInfo, type ExpandSpec, type HierarchyRequest, type QueryRequest, type QueryResult, type QuerySource, type ReadRequest, type Row } from '../query/request';
import { resolvePath } from '../model/buildModel';
import { ConcurrencyError, ODataError } from './errors';
import type { DataProvider, RequestOptions, WriteResult } from './provider';
import type { CsdlSource } from '../csdl/load';
import { readValueListService, type ValueListService } from '../model/valueListReferences';

/** Edm types summed by an aggregate without `with` (a custom aggregate); others are units (same value or null). */
const NUMERIC_TYPES = new Set(['Edm.Decimal', 'Edm.Double', 'Edm.Single', 'Edm.Int16', 'Edm.Int32', 'Edm.Int64', 'Edm.Byte', 'Edm.SByte']);

export interface MemoryProviderOptions {
  model: MetaModel;
  data: Record<string, Row[]>;
  /** Artificial latency in milliseconds. */
  latency?: number;
  /** Bound and unbound action handlers by qualified name (MemoryProvider.invoke). */
  actions?: Record<string, (row: Row | undefined, parameters: Row) => Row | undefined>;
  /**
   * Value help services of Common.ValueListReferences, by reference as annotated: the `$metadata` of the value help
   * service (with its Common.ValueListMapping annotations) and its rows by entity set.
   */
  valueListServices?: Record<string, { metadata: CsdlSource; data: Record<string, Row[]> }>;
}

/** Pairs of (source property, target property) that link `nav` from `type` to its target. */
function links(model: MetaModel, type: EntityTypeModel, nav: NavigationModel): { source: string; target: string }[] {
  if (nav.referentialConstraints.length) return nav.referentialConstraints.map((r) => ({ source: r.property, target: r.referencedProperty }));
  const target = model.entityTypes[nav.targetType]!;
  const partner = nav.partner ? target.navigations[nav.partner] : undefined;
  if (partner?.referentialConstraints.length) return partner.referentialConstraints.map((r) => ({ source: r.referencedProperty, target: r.property }));
  return type.keys.filter((k) => k in target.properties).map((k) => ({ source: k, target: k }));
}

function setPath(row: Row, path: string, value: unknown) {
  const segs = path.split('/');
  let cur = row;
  for (const s of segs.slice(0, -1)) cur = (cur[s] ??= {}) as Row;
  cur[segs[segs.length - 1]!] = value;
}

/**
 * In-memory data provider. Also the supported "host gives the rows" source (worklists the host computes): it evaluates
 * every filter operator, search, sort, paging, `$count`, grouping and `$apply` totals and subtotals in the browser.
 * After the host's rows change, call `setRows` and reload the page (`ListReport` `refreshToken`).
 */
export class MemoryProvider implements DataProvider {
  constructor(private readonly o: MemoryProviderOptions) {}

  private readonly vhServices = new Map<string, ValueListService>();

  /** The value help service of a Common.ValueListReferences entry from `valueListServices` (an in-memory provider). */
  async valueListService(reference: string): Promise<ValueListService> {
    const given = this.o.valueListServices?.[reference];
    if (!given) throw new ODataError({ status: 404, code: 'NotFound', message: `No value help service for "${reference}"` });
    let service = this.vhServices.get(reference);
    if (!service) {
      service = readValueListService(reference, reference, given.metadata, (model) => new MemoryProvider({ model, data: given.data, latency: this.o.latency }));
      this.vhServices.set(reference, service);
    }
    return service;
  }

  /** Replaces the rows of an entity set (the host computed new rows). Reload the tables afterwards (`refreshToken`). */
  setRows(entitySet: string, rows: Row[]): void {
    this.o.data[entitySet] = rows;
  }

  private rows(entitySet: string): Row[] {
    return this.o.data[entitySet] ?? [];
  }

  private async delay(signal?: AbortSignal) {
    if (this.o.latency) await new Promise((r) => setTimeout(r, this.o.latency));
    if (signal?.aborted) throw Object.assign(new Error('Aborted'), { name: 'AbortError' });
  }

  private navigate(entitySet: string, typeName: string, row: Row, navName: string): { set: string; rows: Row[]; collection: boolean } {
    const model = this.o.model;
    const type = model.entityTypes[typeName]!;
    const nav = type.navigations[navName]!;
    const set = model.entitySets[entitySet]!.navigationBindings[navName]!;
    const pairs = links(model, type, nav);
    const rows = this.rows(set).filter((r) => pairs.every((p) => String(r[p.target]) === String(row[p.source])));
    return { set, rows, collection: nav.collection };
  }

  private project(entitySet: string, typeName: string, row: Row, select: string[], expand: ExpandSpec[]): Row {
    const out: Row = {};
    const type = this.o.model.entityTypes[typeName]!;
    const props = select.length ? select : Object.keys(type.properties);
    for (const p of new Set([...type.keys, ...props])) if (p in row) out[p] = row[p];
    // As an OData V4 service: the entity's ETag comes with it whatever is selected.
    if (row['@odata.etag'] !== undefined) out['@odata.etag'] = row['@odata.etag'];
    for (const e of expand) {
      const nav = type.navigations[e.navigation];
      if (!nav) continue;
      const r = this.navigate(entitySet, typeName, row, e.navigation);
      const proj = (x: Row) => this.project(r.set, nav.targetType, x, e.select, e.expand);
      let rows = r.rows;
      if (r.collection && e.orderBy?.length) {
        const target = this.o.model.entityTypes[nav.targetType]!;
        rows = [...rows].sort((a, b) => {
          for (const s of e.orderBy!) {
            const c = compareValues(a[s.path], b[s.path], target.properties[s.path]?.edmType ?? 'Edm.String');
            if (c) return s.descending ? -c : c;
          }
          return 0;
        });
      }
      if (r.collection && e.top !== undefined) rows = rows.slice(0, e.top);
      out[e.navigation] = r.collection ? rows.map(proj) : rows[0] ? proj(rows[0]) : null;
    }
    return out;
  }

  private value(entitySet: string, typeName: string, row: Row, path: string): unknown {
    const segs = path.split('/');
    let cur: Row | undefined = row;
    let set = entitySet;
    let tn = typeName;
    for (let i = 0; i < segs.length - 1 && cur; i++) {
      const r = this.navigate(set, tn, cur, segs[i]!);
      set = r.set;
      tn = this.o.model.entityTypes[tn]!.navigations[segs[i]!]!.targetType;
      cur = r.rows[0];
    }
    return cur ? cur[segs[segs.length - 1]!] : undefined;
  }

  async query(req: QueryRequest, opts: RequestOptions = {}): Promise<QueryResult> {
    await this.delay(opts.signal);
    const model = this.o.model;
    const info = sourceInfo(model, req.source);
    let rows: Row[];
    if ('parent' in req.source) {
      const parent = resolveEntityPath(model, req.source.parent);
      const parentRow = this.findByKey(parent.entitySet, parent.typeName, parent.key);
      if (!parentRow) throw new ODataError({ status: 404, message: `Not found: ${req.source.parent}` });
      rows = this.navigate(parent.entitySet, parent.typeName, parentRow, req.source.navigation).rows;
    } else rows = this.rows(info.entitySet);
    const all = rows;

    const typeOf = (p: string) => resolvePath(model.entityTypes, info.typeName, p).property?.edmType ?? 'Edm.String';
    const val = (r: Row, p: string) => this.value(info.entitySet, info.typeName, r, p);
    // an expanded group of an analytical table: its conditions apply as well
    const filtersOf = req.levelFilter ? { ...req.filters, ...Object.fromEntries(Object.entries(req.levelFilter).map(([k, v]) => [`$hidden:${k}`, v])) } : req.filters;
    if (filtersOf) {
      const f = filtersOf;
      rows = rows.filter((r) => Object.entries(f).every(([key, cs]) => {
        if (key === EDIT_STATE) return true;
        const p = hiddenFilterPath(key) ?? key;
        return matches(val(r, p), cs, typeOf(p), { caseInsensitive: req.caseInsensitive });
      }));
      if (f[EDIT_STATE]) {
        // the other version of a draft-enabled row (OData SiblingEntity): same keys apart from IsActiveEntity
        const keys = model.entityTypes[info.typeName]!.keys.filter((k) => k !== 'IsActiveEntity');
        const sibling = (r: Row) => all.find((x) => x !== r && x.IsActiveEntity !== r.IsActiveEntity && keys.every((k) => x[k] === r[k]));
        const state = editStateOf(f);
        rows = rows.filter((r) => matchesEditState(state, r, sibling));
      }
    }
    if (req.anyOf && Object.keys(req.anyOf).length) {
      const a = req.anyOf;
      rows = rows.filter((r) => Object.entries(a).some(([p, cs]) => matches(val(r, p), cs, typeOf(p), { caseInsensitive: req.caseInsensitive })));
    }
    if (req.search) {
      const terms = req.search.toLowerCase().split(/\s+/).filter(Boolean);
      const type = model.entityTypes[info.typeName]!;
      const strings = Object.values(type.properties).filter((p) => p.edmType === 'Edm.String').map((p) => p.name);
      rows = rows.filter((r) => terms.every((t) => strings.some((p) => String(r[p] ?? '').toLowerCase().includes(t))));
    }
    if (req.hierarchy) return this.topLevels(info.entitySet, info.typeName, req, req.hierarchy, all, rows);
    if (req.orderBy.length) {
      rows = [...rows].sort((a, b) => {
        for (const s of req.orderBy) {
          const c = compareValues(val(a, s.path), val(b, s.path), typeOf(s.path));
          if (c) return s.descending ? -c : c;
        }
        return 0;
      });
    }
    // groupby((…),aggregate(…)) over `input`: one row per group, in the order of the (sorted) rows
    const groupRows = (input: Row[], agg: NonNullable<QueryRequest['aggregate']>): Row[] => {
      const alias = (m: (typeof agg.measures)[number]) => m.as ?? (m.with === 'count' ? 'count' : m.path.replace(/\//g, '_'));
      const groups = new Map<string, { row: Row; seen: Map<string, Set<string>> }>();
      for (const r of input) {
        const key = JSON.stringify(agg.groupBy.map((g) => val(r, g)));
        let g = groups.get(key);
        if (!g) {
          g = { row: {}, seen: new Map() };
          for (const p of agg.groupBy) setPath(g.row, p, val(r, p));
          for (const m of agg.measures) g.row[alias(m)] = 0;
          groups.set(key, g);
        }
        for (const m of agg.measures) {
          if (m.with === 'count') {
            g.row[alias(m)] = Number(g.row[alias(m)]) + 1;
            continue;
          }
          const v = val(r, m.path);
          if (!m.with && !NUMERIC_TYPES.has(typeOf(m.path))) {
            // a unit named with a custom aggregate (`aggregate(NetAmount,Currency)`): the unit when all rows share it, else null
            const first = !g.seen.has(alias(m));
            g.seen.set(alias(m), new Set());
            g.row[alias(m)] = first ? (v ?? null) : g.row[alias(m)] === v ? v : null;
            continue;
          }
          if (m.with === 'countdistinct') {
            const seen = g.seen.get(alias(m)) ?? new Set<string>();
            g.seen.set(alias(m), seen);
            if (v !== null && v !== undefined) seen.add(String(v));
            g.row[alias(m)] = seen.size;
          } else if (m.with === 'max' || m.with === 'min' || m.with === 'average') {
            // transformation aggregates of charts (Analytics.AggregatedProperty, stage 4)
            const seen = g.seen.get(alias(m)) ?? new Set<string>();
            g.seen.set(alias(m), seen);
            if (v === null || v === undefined) continue;
            const n = Number(v);
            const prev = seen.size ? Number(g.row[alias(m)]) : undefined;
            seen.add(String(seen.size));
            g.row[alias(m)] = prev === undefined ? n : m.with === 'max' ? Math.max(prev, n) : m.with === 'min' ? Math.min(prev, n) : prev + (n - prev) / seen.size;
          } else g.row[alias(m)] = Number(g.row[alias(m)]) + Number(v ?? 0);
        }
      }
      return [...groups.values()].map((g) => g.row);
    };
    if (req.analytical) {
      // analytical table (AL-10): grand total, number of leaves and the page of leaves of one concat() request
      const a = req.analytical;
      const leaves = groupRows(rows, { groupBy: a.groupBy, measures: a.measures });
      if (a.groupLevel) {
        const groups = groupRows(rows, { groupBy: a.groupLevel.groupBy, measures: a.groupLevel.measures });
        const gskip = req.skip ?? 0;
        const gt = a.grandTotal.length ? groupRows(rows, { groupBy: [], measures: a.grandTotal })[0] ?? {} : undefined;
        return { rows: req.top === undefined ? groups.slice(gskip) : groups.slice(gskip, gskip + req.top), count: req.count ? groups.length : undefined, leafCount: leaves.length, ...(gt ? { grandTotal: gt } : {}) };
      }
      const skip = req.skip ?? 0;
      const grandTotal = a.grandTotal.length ? groupRows(rows, { groupBy: [], measures: a.grandTotal })[0] ?? {} : undefined;
      return { rows: req.top === undefined ? leaves.slice(skip) : leaves.slice(skip, skip + req.top), count: req.count ? leaves.length : undefined, ...(grandTotal ? { grandTotal } : {}) };
    }
    if (req.aggregate) return { rows: groupRows(rows, req.aggregate).slice(0, req.top) };
    const count = rows.length;
    const skip = req.skip ?? 0;
    const page = req.top === undefined ? rows.slice(skip) : rows.slice(skip, skip + req.top);
    return { rows: page.map((r) => this.project(info.entitySet, info.typeName, r, req.select, req.expand)), count: req.count ? count : undefined };
  }

  /**
   * TopLevels (docs/26 §3.10): `rows` are the matching nodes; they are shown with their ancestors (ancestors … keep
   * start) in tree order, siblings sorted by `orderBy`, down to `levels` and the `expandLevels` of single nodes.
   */
  private topLevels(entitySet: string, typeName: string, req: QueryRequest, h: HierarchyRequest, all: Row[], matching: Row[]): QueryResult {
    const model = this.o.model;
    const def = hierarchyOf(model, typeName, h.qualifier);
    if (!def) throw new ODataError({ status: 400, message: `${typeName} has no recursive hierarchy "${h.qualifier}"` });
    const idOf = (r: Row) => String(r[h.nodeProperty] ?? '');
    const byId = new Map(all.map((r) => [idOf(r), r]));
    const parentOf = (r: Row): string | undefined => {
      if (def.parentProperty) {
        const v = r[def.parentProperty];
        return v === null || v === undefined || v === '' ? undefined : String(v);
      }
      const parent = this.navigate(entitySet, typeName, r, def.parentNavigation).rows[0];
      return parent ? idOf(parent) : undefined;
    };
    // The limited hierarchy: matching nodes and all their ancestors.
    const limited = new Set<string>();
    const matched = new Set(matching.map(idOf));
    for (const r of matching) {
      let id: string | undefined = idOf(r);
      while (id !== undefined && !limited.has(id) && byId.has(id)) {
        limited.add(id);
        id = parentOf(byId.get(id)!);
      }
    }
    const typeOf = (p: string) => resolvePath(model.entityTypes, typeName, p).property?.edmType ?? 'Edm.String';
    const nodes = all.filter((r) => limited.has(idOf(r)));
    if (req.orderBy.length) {
      nodes.sort((a, b) => {
        for (const s of req.orderBy) {
          const c = compareValues(this.value(entitySet, typeName, a, s.path), this.value(entitySet, typeName, b, s.path), typeOf(s.path));
          if (c) return s.descending ? -c : c;
        }
        return 0;
      });
    }
    const children = new Map<string, Row[]>();
    const roots: Row[] = [];
    for (const r of nodes) {
      const parent = parentOf(r);
      if (parent !== undefined && limited.has(parent)) (children.get(parent) ?? children.set(parent, []).get(parent)!).push(r);
      else roots.push(r);
    }
    const expand = new Map((h.expandLevels ?? []).map((e) => [e.nodeId, e.levels]));
    const filtered = Boolean(req.filters || req.anyOf || req.search);
    const out: Row[] = [];
    // `levels`: levels shown from this node down (1: the node only).
    const visit = (r: Row, depth: number, levels: number): number => {
      const id = idOf(r);
      if (expand.has(id)) {
        const n = expand.get(id);
        levels = n === null ? Infinity : n === 0 ? 1 : Math.max(levels, n! + 1);
      }
      const row: Row = { ...this.project(entitySet, typeName, r, req.select, req.expand) };
      out.push(row);
      const kids = children.get(id) ?? [];
      let shown = 0;
      if (levels > 1) for (const k of kids) shown += 1 + visit(k, depth + 1, levels - 1);
      if (def.drillState) row[def.drillState] = !kids.length ? 'leaf' : levels > 1 ? 'expanded' : 'collapsed';
      if (def.distanceFromRoot) row[def.distanceFromRoot] = depth;
      if (def.limitedDescendantCount) row[def.limitedDescendantCount] = shown;
      if (def.matched && filtered) row[def.matched] = matched.has(id);
      return shown;
    };
    for (const r of roots) visit(r, 0, h.levels ?? Infinity);
    const skip = req.skip ?? 0;
    return { rows: req.top === undefined ? out.slice(skip) : out.slice(skip, skip + req.top), count: req.count ? out.length : undefined };
  }

  private findByKey(entitySet: string, typeName: string, key: Record<string, string>): Row | undefined {
    const type = this.o.model.entityTypes[typeName]!;
    return this.rows(entitySet).find((r) => type.keys.every((k) => String(r[k]) === String(key[k])));
  }

  async read(path: EntityPath, req: ReadRequest, opts: RequestOptions = {}): Promise<Row> {
    await this.delay(opts.signal);
    const resolved = resolveEntityPath(this.o.model, path);
    const row = this.findByKey(resolved.entitySet, resolved.typeName, resolved.key);
    if (!row) throw new ODataError({ status: 404, message: `Not found: ${path}` });
    return this.project(resolved.entitySet, resolved.typeName, row, req.select, req.expand);
  }

  async update(path: EntityPath, patch: Row, opts: RequestOptions & { etag?: string } = {}): Promise<WriteResult> {
    await this.delay(opts.signal);
    const row = this.existing(path);
    const etag = row['@odata.etag'] as string | undefined;
    if (opts.etag && etag && opts.etag !== etag) {
      throw new ConcurrencyError({ status: 412, message: 'The entity was changed by someone else' });
    }
    Object.assign(row, patch);
    const next = `W/"${Date.now()}-${Math.random().toString(36).slice(2, 6)}"`;
    row['@odata.etag'] = next;
    return { row: { ...row }, etag: next, messages: [] };
  }

  private existing(path: EntityPath): Row {
    const resolved = resolveEntityPath(this.o.model, path);
    const row = this.findByKey(resolved.entitySet, resolved.typeName, resolved.key);
    if (!row) throw new ODataError({ status: 404, message: `Not found: ${path}` });
    return row;
  }

  async create(target: QuerySource, row: Row, opts: RequestOptions = {}): Promise<WriteResult & { path: EntityPath }> {
    await this.delay(opts.signal);
    const model = this.o.model;
    const info = sourceInfo(model, target);
    const created: Row = { ...row, '@odata.etag': `W/"${Date.now()}"` };
    if ('parent' in target) {
      // Foreign keys from the parent (referential constraints of the partner).
      const parent = resolveEntityPath(model, target.parent);
      const parentRow = this.findByKey(parent.entitySet, parent.typeName, parent.key);
      const nav = model.entityTypes[parent.typeName]!.navigations[target.navigation]!;
      if (parentRow) for (const l of links(model, model.entityTypes[parent.typeName]!, nav)) created[l.target] ??= parentRow[l.source];
    }
    (this.o.data[info.entitySet] ??= []).push(created);
    return { row: { ...created }, etag: created['@odata.etag'] as string, path: `${info.entitySet}${keyPredicate(model.entityTypes[info.typeName]!, created)}`, messages: [] };
  }

  async remove(path: EntityPath, opts: RequestOptions & { etag?: string } = {}) {
    await this.delay(opts.signal);
    const row = this.existing(path);
    const resolved = resolveEntityPath(this.o.model, path);
    const list = this.o.data[resolved.entitySet]!;
    list.splice(list.indexOf(row), 1);
    return { messages: [] };
  }

  async invoke(action: string, opts: RequestOptions & { path?: EntityPath; parameters?: Row } = {}) {
    await this.delay(opts.signal);
    const handler = this.o.actions?.[action];
    if (!handler) throw new ODataError({ status: 501, message: `Action ${action} is not implemented` });
    const row = opts.path ? this.existing(opts.path) : undefined;
    const result = handler(row, opts.parameters ?? {});
    return { row: result ? { ...result } : undefined, messages: [] };
  }
}
