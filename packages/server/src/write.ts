// Writes (ADR-018 direct save, ADR-024 bound actions): POST, PATCH, DELETE and bound actions, each request in one
// transaction. The generic part is protocol: property whitelist, JSON types against $metadata, Capabilities
// (Insert-/Update-/DeleteRestrictions), ETag / If-Match (412), the ETag property counts up, the data scope, OData
// error bodies and sap-messages. Business rules (numbers, defaults, totals, validation, what an action does) are
// hooks of the application, per entity set and per action.
import type { EdmType } from '@rhfan2019/smart-kit-core';
import { sql, type Kysely, type RawBuilder } from 'kysely';
import { badRequest, notFound, notImplemented, ODataServerError } from './errors';
import { etagOf, formatRow, keyPredicate, type FormatOptions } from './format';
import type { BoundExpr, Planner } from './plan';
import type { EntitySetInfo, ServiceSchema } from './schema';
import { SqlBuilder } from './sql';

export type Row = Record<string, unknown>;

/** An entry of the sap-messages header (ADR-023): 1 success, 2 info, 3 warning, 4 error. */
export interface ServiceMessage {
  code: string;
  message: string;
  numericSeverity: 1 | 2 | 3 | 4;
  target?: string;
}

/** What every hook gets. Rows are OData JSON values (Edm.Decimal and Edm.Int64 as numbers). */
export interface WriteContext<C> {
  context: C;
  request: Request;
  /** Primary language subtag of Accept-Language ("en", "zh", …). */
  language: string;
  /** The transaction of this request: SQL here commits or rolls back with the write. */
  db: Kysely<any>; // eslint-disable-line @typescript-eslint/no-explicit-any -- tables are known only at run time
  /** sap-messages of the response (success, info, warning). */
  messages: ServiceMessage[];
  /** Reads one entity (all properties) within the data scope, or undefined. */
  read(entitySet: string, key: Row): Promise<Row | undefined>;
}

export interface EntitySetHooks<C> {
  /** Properties a POST may set (default: all except Core.Computed). Others: 400 PropertyNotCreatable. */
  creatable?: string[];
  /** Properties a PATCH may change (default: all except keys, Core.Computed, Core.Immutable). Others: 400. */
  updatable?: string[];
  /** POST: `data` is the new row; assign keys and defaults, throw validationError(...) to refuse. */
  beforeCreate?(e: WriteContext<C> & { entitySet: string; data: Row; parent?: { entitySet: string; row: Row } }): void | Promise<void>;
  afterCreate?(e: WriteContext<C> & { entitySet: string; row: Row }): void | Promise<void>;
  /** PATCH: `data` is the current row with the patch applied; changes to it are written as well. */
  beforeUpdate?(e: WriteContext<C> & { entitySet: string; current: Row; patch: Row; data: Row }): void | Promise<void>;
  afterUpdate?(e: WriteContext<C> & { entitySet: string; row: Row; previous: Row }): void | Promise<void>;
  /** DELETE: delete dependent rows here (foreign keys), or refuse. */
  beforeDelete?(e: WriteContext<C> & { entitySet: string; current: Row }): void | Promise<void>;
  afterDelete?(e: WriteContext<C> & { entitySet: string; previous: Row }): void | Promise<void>;
  /**
   * Unmanaged save: the application stores the entity itself, instead of the service writing to the table of the entity
   * set. For entity sets that are read models (a view over several tables, computed columns) and for applications
   * whose writes live in their own code (permissions, audit, numbering). The service still does the protocol: property
   * whitelist, Edm types, Capabilities, the data scope, ETag / If-Match, the hooks before and after, and it answers
   * with the entity read again through the entity set.
   *
   * `create` gets the checked values and returns the key of the new entity (all key properties).
   */
  create?(e: WriteContext<C> & { entitySet: string; data: Row; parent?: { entitySet: string; row: Row } }): Row | Promise<Row>;
  /**
   * Unmanaged save of a PATCH (see `create`): `patch` holds the checked properties of the request, `data` the current
   * entity with the patch applied, `current` the entity as it is read now (If-Match was checked against it). The ETag
   * property is the application's to change.
   */
  update?(e: WriteContext<C> & { entitySet: string; key: Row; current: Row; patch: Row; data: Row }): void | Promise<void>;
  /** Unmanaged delete (see `create`). */
  delete?(e: WriteContext<C> & { entitySet: string; key: Row; current: Row }): void | Promise<void>;
}

/**
 * A bound action: returns the changes of the bound entity (written with the next ETag; handed to the unmanaged
 * `update` of the entity set when it has one), or nothing when the handler has stored everything itself.
 */
export type ActionHandler<C> = (e: WriteContext<C> & { entitySet: string; entity: Row; parameters: Row }) => Row | void | Promise<Row | void>;

/** 400 with error details, the shape smart-kit shows at the fields (ADR-023). */
export function validationError(message: string, details: { code: string; message: string; target?: string }[], code = 'VALIDATION_FAILED') {
  return new ODataServerError(400, code, message, undefined, details);
}

const NUMERIC = new Set(['Edm.Byte', 'Edm.SByte', 'Edm.Int16', 'Edm.Int32', 'Edm.Int64', 'Edm.Decimal', 'Edm.Double', 'Edm.Single']);
const INTEGER = new Set(['Edm.Byte', 'Edm.SByte', 'Edm.Int16', 'Edm.Int32', 'Edm.Int64']);

/** PostgreSQL type a written value is cast to (fixed list). */
function castOf(t: EdmType): string {
  if (INTEGER.has(t)) return 'bigint';
  switch (t) {
    case 'Edm.Decimal': return 'numeric';
    case 'Edm.Double': case 'Edm.Single': return 'double precision';
    case 'Edm.Boolean': return 'boolean';
    case 'Edm.Date': return 'date';
    case 'Edm.DateTimeOffset': return 'timestamptz';
    case 'Edm.TimeOfDay': return 'time';
    case 'Edm.Guid': return 'uuid';
    default: return 'text';
  }
}

const NUMBER = /^[-+]?(\d+(\.\d*)?|\.\d+)([eE][-+]?\d+)?$/;

/** Checks a JSON value against the property type; returns the SQL parameter (string, boolean or null). */
function sqlValue(set: EntitySetInfo, prop: string, v: unknown): string | boolean | null {
  const c = set.columns[prop]!;
  const bad = () => badRequest('InvalidValue', `${prop}: ${JSON.stringify(v)} is not a valid ${c.edmType}.`, prop);
  if (v === null || v === undefined) {
    if (!c.nullable) throw badRequest('NullNotAllowed', `${prop} cannot be null.`, prop);
    return null;
  }
  if (NUMERIC.has(c.edmType)) {
    const s = typeof v === 'number' ? String(v) : typeof v === 'string' ? v.trim() : undefined;
    if (s === undefined || !NUMBER.test(s)) throw bad();
    if (INTEGER.has(c.edmType) && !/^[-+]?\d+$/.test(s)) throw bad();
    return s;
  }
  if (c.edmType === 'Edm.Boolean') {
    if (typeof v !== 'boolean') throw bad();
    return v;
  }
  if (typeof v !== 'string') throw bad();
  const ok =
    c.edmType === 'Edm.Date' ? /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`))
    : c.edmType === 'Edm.DateTimeOffset' ? /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/i.test(v) && !Number.isNaN(Date.parse(v))
    : c.edmType === 'Edm.TimeOfDay' ? /^\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(v)
    : c.edmType === 'Edm.Guid' ? /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
    : true;
  if (!ok) throw bad();
  if (c.edmType === 'Edm.String') {
    const max = set.type.properties[prop]?.maxLength;
    if (max !== undefined && [...v].length > max) throw badRequest('ValueTooLong', `${prop}: at most ${max} characters.`, prop);
  }
  return v;
}

const param = (set: EntitySetInfo, prop: string, v: unknown): RawBuilder<unknown> => {
  const value = sqlValue(set, prop, v);
  return value === null ? sql`null` : sql`${value}::${sql.raw(castOf(set.columns[prop]!.edmType))}`;
};

/** JSON body -> row of properties (instance annotations "@…" dropped; navigation properties: deep writes are not supported). */
function bodyRow(set: EntitySetInfo, body: unknown): Row {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw badRequest('InvalidBody', 'The request body must be a JSON object.');
  const out: Row = {};
  for (const [k, v] of Object.entries(body as Row)) {
    if (k.startsWith('@') || k.includes('@odata.')) continue;
    if (set.navigations[k]) throw notImplemented(`Deep insert or update through '${k}' is not supported; write the related entities on their own.`);
    if (!set.columns[k]) throw badRequest('PropertyNotFound', `'${k}' is not a property of ${set.name}.`, k);
    // IEEE754Compatible clients send Edm.Decimal and Edm.Int64 as strings: hooks and unmanaged saves get numbers, as
    // rows that were read have them (anything that is not a number stays, and is refused when the value is checked)
    out[k] = typeof v === 'string' && NUMERIC.has(set.columns[k]!.edmType) && NUMBER.test(v.trim()) ? Number(v) : v;
  }
  return out;
}

/** Maps PostgreSQL constraint errors to OData errors (other database errors stay 500). */
function databaseError(e: unknown): never {
  const code = (e as { code?: string })?.code;
  const detail = (e as { detail?: string })?.detail;
  if (code === '23505') throw new ODataServerError(409, 'DuplicateKey', `An entity with this key already exists.${detail ? ` ${detail}` : ''}`);
  if (code === '23503') throw new ODataServerError(409, 'ReferenceConstraint', `The change violates a reference between entities.${detail ? ` ${detail}` : ''}`);
  if (code === '23502') throw badRequest('NullNotAllowed', `A mandatory value is missing.${(e as { column?: string }).column ? ` (${(e as { column?: string }).column})` : ''}`);
  if (code === '22001' || code === '22003') throw badRequest('InvalidValue', 'A value is too long or out of range.');
  throw e;
}

export interface WriteOptions<C> {
  schema: ServiceSchema;
  hooks: Record<string, EntitySetHooks<C>>;
  actions: Record<string, ActionHandler<C>>;
  /** Bound actions declared in $metadata: qualified name -> binding entity type. */
  declaredActions: Map<string, string>;
  planner: (db: Kysely<any>) => Planner<C>; // eslint-disable-line @typescript-eslint/no-explicit-any
  /** Runs the work of one request in a transaction (or inside the one of the change set it belongs to). */
  transact: <T>(fn: (trx: Kysely<any>) => Promise<T>) => Promise<T>; // eslint-disable-line @typescript-eslint/no-explicit-any
  context: C;
  request: Request;
  language: string;
}

/** Executes one write request inside a transaction. Returns the response. */
export class Writer<C> {
  private readonly messages: ServiceMessage[] = [];
  constructor(private readonly o: WriteOptions<C>) {}

  private ctx(db: Kysely<any>): WriteContext<C> { // eslint-disable-line @typescript-eslint/no-explicit-any
    return { context: this.o.context, request: this.o.request, language: this.o.language, db, messages: this.messages, read: (setName, key) => this.read(db, this.set(setName), key) };
  }

  private set(name: string): EntitySetInfo {
    const s = this.o.schema.entitySets[name];
    if (!s) throw notFound(`Entity set '${name}' not found.`);
    return s;
  }

  private boundKey(set: EntitySetInfo, key: Row): Record<string, BoundExpr> {
    const out: Record<string, BoundExpr> = {};
    for (const k of set.keys) {
      if (key[k] === undefined || key[k] === null) throw badRequest('InvalidKey', `Key ${k} of ${set.name} is missing.`);
      out[k] = { kind: 'value', value: String(key[k]), edmType: set.columns[k]!.edmType };
    }
    return out;
  }

  /** One entity with all properties (JSON numbers), within the data scope. */
  async read(db: Kysely<any>, set: EntitySetInfo, key: Row, fmt: FormatOptions = { ieee754: false, serviceRoot: '' }): Promise<Row | undefined> { // eslint-disable-line @typescript-eslint/no-explicit-any
    const planner = this.o.planner(db);
    const plan = planner.collection(set, {}, { key: this.boundKey(set, key), single: true });
    const rows = (await new SqlBuilder(this.o.schema, (s) => planner.scope(s)).collection({ ...plan, top: 1 }).execute(db)).rows as Row[];
    return rows[0] ? formatRow(plan, rows[0], fmt, true) : undefined;
  }

  private keyOf(set: EntitySetInfo, row: Row): Row {
    return Object.fromEntries(set.keys.map((k) => [k, row[k]]));
  }

  private checkIfMatch(set: EntitySetInfo, current: Row) {
    const ifMatch = this.o.request.headers.get('if-match');
    if (!ifMatch || ifMatch.trim() === '*' || !set.etag) return;
    if (!ifMatch.split(',').map((x) => x.trim()).includes(etagOf(current[set.etag])))
      throw new ODataServerError(412, 'PreconditionFailed', 'The entity was changed by someone else (ETag mismatch).');
  }

  private whereKey(set: EntitySetInfo, key: Row) {
    return sql.join(set.keys.map((k) => sql`${sql.id(set.columns[k]!.column)} = ${param(set, k, key[k])}`), sql` and `);
  }

  /** UPDATE of the changed properties; the ETag property counts up. */
  private async writeChanges(db: Kysely<any>, set: EntitySetInfo, current: Row, data: Row) { // eslint-disable-line @typescript-eslint/no-explicit-any
    const changes: Row = {};
    for (const [k, v] of Object.entries(data)) {
      if (!set.columns[k] || set.keys.includes(k)) continue;
      if (String(v ?? '\0') !== String(current[k] ?? '\0')) changes[k] = v;
    }
    if (set.etag && INTEGER.has(set.columns[set.etag]!.edmType)) changes[set.etag] = Number(current[set.etag] ?? 0) + 1;
    if (!Object.keys(changes).length) return;
    const assignments = Object.entries(changes).map(([k, v]) => sql`${sql.id(set.columns[k]!.column)} = ${param(set, k, v)}`);
    await sql`update ${sql.id(...set.table)} set ${sql.join(assignments)} where ${this.whereKey(set, current)}`.execute(db).catch(databaseError);
  }

  private async inTransaction<T>(_db: Kysely<any>, fn: (trx: Kysely<any>) => Promise<T>): Promise<T> { // eslint-disable-line @typescript-eslint/no-explicit-any
    return this.o.transact(fn);
  }

  /** The key an unmanaged `create` returned: every key property, nothing else. */
  private returnedKey(set: EntitySetInfo, key: unknown): Row {
    const row = key && typeof key === 'object' ? (key as Row) : {};
    const missing = set.keys.filter((k) => row[k] === undefined || row[k] === null);
    if (missing.length) throw new Error(`[smart-kit-server] create of ${set.name} must return the key of the new entity; missing: ${missing.join(', ')}`);
    return this.keyOf(set, row);
  }

  /** The entity of a key-addressed request, or 404. */
  private async current(db: Kysely<any>, set: EntitySetInfo, key: Record<string, BoundExpr>, label: string) { // eslint-disable-line @typescript-eslint/no-explicit-any
    const raw = Object.fromEntries(Object.entries(key).map(([k, v]) => [k, v.kind === 'value' ? v.value : undefined]));
    const row = await this.read(db, set, raw);
    if (!row) throw notFound(`${label} not found.`);
    return row;
  }

  /** Writes are opt-in: only entity sets listed in the `entitySets` option accept them (and then Capabilities decide). */
  private writable(set: EntitySetInfo) {
    if (!this.o.hooks[set.name]) throw new ODataServerError(405, 'NotWritable', `Entity set '${set.name}' is read-only in this service.`);
  }

  async create(db: Kysely<any>, set: EntitySetInfo, body: unknown, parent?: { set: EntitySetInfo; key: Record<string, BoundExpr>; join: { source: string; target: string }[] }) { // eslint-disable-line @typescript-eslint/no-explicit-any
    this.writable(set);
    if (!set.capabilities.insertable) throw new ODataServerError(405, 'NotInsertable', `Entity set '${set.name}' does not support create (Capabilities.InsertRestrictions).`);
    const hooks = this.o.hooks[set.name] ?? {};
    const data = bodyRow(set, body);
    const creatable = hooks.creatable ?? Object.keys(set.columns).filter((p) => !set.type.properties[p]?.computed);
    const bad = Object.keys(data).filter((k) => !creatable.includes(k));
    if (bad.length) throw badRequest('PropertyNotCreatable', `Properties not allowed on create: ${bad.join(', ')}. Allowed: ${creatable.join(', ')}.`, bad[0]);
    for (const [k, v] of Object.entries(data)) if (v !== null) sqlValue(set, k, v); // type errors before any hook runs
    return this.inTransaction(db, async (trx) => {
      const ctx = this.ctx(trx);
      let parentRow: Row | undefined;
      if (parent) {
        parentRow = await this.current(trx, parent.set, parent.key, `The parent ${parent.set.name} entity`);
        for (const j of parent.join) data[j.target] = parentRow[j.source];
      }
      const parentInfo = parent && parentRow ? { entitySet: parent.set.name, row: parentRow } : undefined;
      if (!hooks.create) {
        for (const k of set.keys) if (data[k] === undefined && set.columns[k]!.edmType === 'Edm.Guid') data[k] = crypto.randomUUID();
        if (set.etag && data[set.etag] === undefined && INTEGER.has(set.columns[set.etag]!.edmType)) data[set.etag] = 1;
      }
      await hooks.beforeCreate?.({ ...ctx, entitySet: set.name, data, parent: parentInfo });
      let key: Row;
      if (hooks.create) key = this.returnedKey(set, await Promise.resolve(hooks.create({ ...ctx, entitySet: set.name, data, parent: parentInfo })).catch(databaseError));
      else {
        const cols = Object.keys(data).filter((k) => set.columns[k] && data[k] !== undefined);
        const returning = sql.join(set.keys.map((k) => sql`${sql.id(set.columns[k]!.column)} as ${sql.id(k)}`));
        const res = await sql`insert into ${sql.id(...set.table)} (${sql.join(cols.map((k) => sql.id(set.columns[k]!.column)))}) values (${sql.join(cols.map((k) => param(set, k, data[k])))}) returning ${returning}`
          .execute(trx)
          .catch(databaseError);
        key = (res.rows as Row[])[0]!;
      }
      const row = await this.read(trx, set, key);
      if (!row) throw new ODataServerError(403, 'OutOfScope', `The new ${set.name} entity is outside your data scope.`);
      await hooks.afterCreate?.({ ...ctx, entitySet: set.name, row });
      return key;
    });
  }

  async update(db: Kysely<any>, set: EntitySetInfo, key: Record<string, BoundExpr>, body: unknown, label: string) { // eslint-disable-line @typescript-eslint/no-explicit-any
    this.writable(set);
    if (!set.capabilities.updatable) throw new ODataServerError(405, 'NotUpdatable', `Entity set '${set.name}' does not support update (Capabilities.UpdateRestrictions).`);
    const hooks = this.o.hooks[set.name] ?? {};
    const patch = bodyRow(set, body);
    const updatable = hooks.updatable ?? Object.keys(set.columns).filter((p) => !set.keys.includes(p) && !set.type.properties[p]?.computed && !set.type.properties[p]?.immutable);
    const bad = Object.keys(patch).filter((k) => !updatable.includes(k));
    if (bad.length) throw badRequest('PropertyNotUpdatable', `Properties not updatable: ${bad.join(', ')}. Updatable: ${updatable.join(', ')}.`, bad[0]);
    for (const [k, v] of Object.entries(patch)) sqlValue(set, k, v);
    return this.inTransaction(db, async (trx) => {
      const ctx = this.ctx(trx);
      const current = await this.current(trx, set, key, label);
      this.checkIfMatch(set, current);
      const data = { ...current, ...patch };
      await hooks.beforeUpdate?.({ ...ctx, entitySet: set.name, current, patch, data });
      if (hooks.update) await Promise.resolve(hooks.update({ ...ctx, entitySet: set.name, key: this.keyOf(set, current), current, patch, data })).catch(databaseError);
      else await this.writeChanges(trx, set, current, data);
      const row = (await this.read(trx, set, this.keyOf(set, current)))!;
      await hooks.afterUpdate?.({ ...ctx, entitySet: set.name, row, previous: current });
      return this.keyOf(set, current);
    });
  }

  async remove(db: Kysely<any>, set: EntitySetInfo, key: Record<string, BoundExpr>, label: string) { // eslint-disable-line @typescript-eslint/no-explicit-any
    this.writable(set);
    if (!set.capabilities.deletable) throw new ODataServerError(405, 'NotDeletable', `Entity set '${set.name}' does not support delete (Capabilities.DeleteRestrictions).`);
    const hooks = this.o.hooks[set.name] ?? {};
    await this.inTransaction(db, async (trx) => {
      const ctx = this.ctx(trx);
      const current = await this.current(trx, set, key, label);
      this.checkIfMatch(set, current);
      await hooks.beforeDelete?.({ ...ctx, entitySet: set.name, current });
      if (hooks.delete) await Promise.resolve(hooks.delete({ ...ctx, entitySet: set.name, key: this.keyOf(set, current), current })).catch(databaseError);
      else await sql`delete from ${sql.id(...set.table)} where ${this.whereKey(set, current)}`.execute(trx).catch(databaseError);
      await hooks.afterDelete?.({ ...ctx, entitySet: set.name, previous: current });
    });
  }

  async action(db: Kysely<any>, set: EntitySetInfo, key: Record<string, BoundExpr>, name: string, body: unknown, label: string) { // eslint-disable-line @typescript-eslint/no-explicit-any
    const qualified = name.includes('.') ? name : `${this.o.schema.namespace}.${name}`;
    const binding = this.o.declaredActions.get(qualified);
    if (!binding) throw notFound(`'${name}' is not a bound action of this service.`);
    if (binding !== set.typeName) throw badRequest('InvalidBinding', `Action ${qualified} is not bound to ${set.typeName}.`);
    const handler = this.o.actions[qualified];
    if (!handler) throw notImplemented(`Action ${qualified} is declared in $metadata but not implemented.`);
    const parameters = body && typeof body === 'object' && !Array.isArray(body) ? (body as Row) : {};
    return this.inTransaction(db, async (trx) => {
      const ctx = this.ctx(trx);
      const current = await this.current(trx, set, key, label);
      this.checkIfMatch(set, current);
      const changes = await handler({ ...ctx, entitySet: set.name, entity: current, parameters });
      if (changes && Object.keys(changes).length) {
        for (const k of Object.keys(changes)) if (!set.columns[k]) throw new Error(`[smart-kit-server] action ${qualified} returned an unknown property '${k}'`);
        const update = this.o.hooks[set.name]?.update;
        if (update) await Promise.resolve(update({ ...ctx, entitySet: set.name, key: this.keyOf(set, current), current, patch: changes, data: { ...current, ...changes } })).catch(databaseError);
        else await this.writeChanges(trx, set, current, { ...current, ...changes });
      }
      return this.keyOf(set, current);
    });
  }

  /** sap-messages header value (JSON, non-ASCII as \uXXXX: HTTP headers are Latin-1). */
  sapMessages(): string | undefined {
    if (!this.messages.length) return undefined;
    return JSON.stringify(this.messages).replace(/[\u007f-￿]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
  }

  location(serviceRoot: string, set: EntitySetInfo, key: Row) {
    return `${serviceRoot}${set.name}${keyPredicate(set, key)}`;
  }
}
