/** Data provider interfaces. See docs/05-data-provider.md §1. */
import type { EntityPath } from '../query/entityPath';
import type { QueryRequest, QueryResult, ReadRequest, Row } from '../query/request';

export interface RequestOptions {
  signal?: AbortSignal;
}

/** Read capability: implemented in phase 1. */
export interface ReadDataProvider {
  query(req: QueryRequest, opts?: RequestOptions): Promise<QueryResult>;
  read(path: EntityPath, req: ReadRequest, opts?: RequestOptions): Promise<Row>;
}

/** Write capability: defined in phase 1, implemented by the stage 1.5 edit-seam validation, productized in phase 2. */
export interface WriteDataProvider {
  update(path: EntityPath, patch: Row, opts: RequestOptions & { etag?: string }): Promise<{ row: Row; etag?: string }>;
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
