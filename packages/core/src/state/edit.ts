/**
 * Edit seam (phase 1 defines it, phase 2 implements it). See docs/05-data-provider.md §6.
 * Implementations: direct save (PATCH + ETag) and, in phase 2, draft.
 */
import type { EntityPath } from '../query/entityPath';
import type { Row } from '../query/request';

export interface EditSession {
  readonly path: EntityPath;
  /** Working copy. */
  readonly values: Row;
  set(property: string, value: unknown): void;
  /** Saves the changed properties; throws ConcurrencyError when the entity was changed meanwhile. */
  save(): Promise<{ row: Row; etag?: string }>;
  cancel(): Promise<void>;
}

export interface EditStrategy {
  readonly kind: string;
  begin(path: EntityPath, current: Row): Promise<EditSession>;
}
