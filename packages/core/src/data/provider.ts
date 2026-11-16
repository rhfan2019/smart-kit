/** Data provider interfaces. See docs/05-data-provider.md §1. */
import type { EntityPath } from '../query/entityPath';
import type { QueryRequest, QueryResult, QuerySource, ReadRequest, Row } from '../query/request';
import type { Message } from './messages';

export interface RequestOptions {
  signal?: AbortSignal;
}

/** Read capability: implemented in phase 1. */
export interface ReadDataProvider {
  query(req: QueryRequest, opts?: RequestOptions): Promise<QueryResult>;
  read(path: EntityPath, req: ReadRequest, opts?: RequestOptions): Promise<Row>;
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

export type DataProvider = ReadDataProvider & Partial<WriteDataProvider>;

/** Minimal fetch signature, so that users can inject any implementation. */
export type FetchLike = (input: string, init?: { method?: string; headers?: Record<string, string>; body?: string; signal?: AbortSignal }) => Promise<{
  ok: boolean;
  status: number;
  statusText: string;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
}>;
