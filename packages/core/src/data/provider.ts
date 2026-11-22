/** Data provider interfaces. See docs/05-data-provider.md §1. */
import type { EntityPath } from '../query/entityPath';
import type { QueryRequest, QueryResult, QuerySource, ReadRequest, Row } from '../query/request';
import type { Message } from './messages';
import type { ValueListService } from '../model/valueListReferences';

export interface RequestOptions {
  signal?: AbortSignal;
}

/** Read capability: implemented in phase 1. */
export interface ReadDataProvider {
  query(req: QueryRequest, opts?: RequestOptions): Promise<QueryResult>;
  read(path: EntityPath, req: ReadRequest, opts?: RequestOptions): Promise<Row>;
  /**
   * Number of entities matching `req` (`<set>/$count?$filter=…&$search=…`; select, expand, order and paging are
   * ignored), as the FE list report counts its view tabs (sap.fe.templates.ListReport MultipleModeControl). Providers
   * without it count with `query({ …, top: 0, count: true })`.
   */
  count?(req: QueryRequest, opts?: RequestOptions): Promise<number>;
  /**
   * Loads the value help service of a Common.ValueListReferences entry (`reference`: URL of its `$metadata`, relative to
   * this service's `$metadata`): its model, its Common.ValueListMapping annotations and a provider for its data
   * (SAPUI5 ODataMetaModel `getOrCreateSharedModel`). Loaded once per URL. Providers without it have no referenced
   * value lists.
   */
  valueListService?(reference: string, opts?: RequestOptions): Promise<ValueListService>;
}

export interface WriteResult {
  row: Row;
  etag?: string;
  /** Success, information and warning messages of the response (`sap-messages`, ADR-023). */
  messages?: Message[];
}

/** Write capability (phase 2, ADR-018, ADR-024). */
export interface WriteDataProvider {
  /** PATCH with If-Match when an ETag is given; a stale ETag rejects with ConcurrencyError. */
  update(path: EntityPath, patch: Row, opts: RequestOptions & { etag?: string }): Promise<WriteResult>;
  /** POST to an entity set or a collection navigation; returns the created row and its entity path. */
  create(target: QuerySource, row: Row, opts?: RequestOptions): Promise<WriteResult & { path: EntityPath }>;
  /** DELETE (with If-Match when an ETag is given). */
  remove(path: EntityPath, opts?: RequestOptions & { etag?: string }): Promise<{ messages?: Message[] }>;
  /** Invokes an action: bound to `path` when given ("<path>/<Namespace.action>"), otherwise unbound. */
  invoke(action: string, opts?: RequestOptions & { path?: EntityPath; parameters?: Row }): Promise<{ row?: Row; messages?: Message[] }>;
}

/** One write of a batch: the arguments of `update`, `create`, `remove` or `invoke`. */
export type BatchOperation =
  | { kind: 'update'; path: EntityPath; patch: Row; etag?: string }
  | { kind: 'create'; target: QuerySource; row: Row }
  | { kind: 'remove'; path: EntityPath; etag?: string }
  | { kind: 'invoke'; action: string; path?: EntityPath; parameters?: Row };

/** The outcome of one operation of a batch, in the order of the operations. */
export type BatchResult =
  | { ok: true; row?: Row; etag?: string; /** `create`: the path of the new entity. */ path?: EntityPath; messages?: Message[] }
  | { ok: false; /** What `update` / `create` / `remove` / `invoke` would have thrown. */ error: unknown };

/** Several writes in one request (`$batch`). */
export interface BatchDataProvider {
  /**
   * Sends the operations in one request. `atomic`: one change set: all of them are written or none; when one fails,
   * its result carries the error and the others an error saying nothing was written. Otherwise each operation
   * succeeds or fails on its own. Rejects only when the batch request itself fails.
   */
  batch(operations: BatchOperation[], opts?: RequestOptions & { atomic?: boolean }): Promise<BatchResult[]>;
}

export type DataProvider = ReadDataProvider & Partial<WriteDataProvider> & Partial<BatchDataProvider>;

/** Minimal fetch signature, so that users can inject any implementation. */
export type FetchLike = (input: string, init?: { method?: string; headers?: Record<string, string>; body?: string; signal?: AbortSignal }) => Promise<{
  ok: boolean;
  status: number;
  statusText: string;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
}>;
