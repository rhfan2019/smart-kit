/** Variant storage. See docs/05-data-provider.md §7 and ADR-014. */
import type { FilterState } from '../conditions/conditions';
import type { SortItem } from '../query/request';
import type { ODataV4Provider } from '../data/odata';

export interface VariantContent {
  filters: FilterState;
  search?: string;
  /** Filter field ids visible in the filter bar. */
  filterFields?: string[];
  /** Visible column ids, in order. */
  columns?: string[];
  sort?: SortItem[];
  /** Group property of the table (responsive table, docs/23); null: explicitly not grouped. */
  groupBy?: string | null;
  /** Properties whose totals are shown (docs/23). */
  totals?: string[];
  /** Free-form extra state of custom content. */
  custom?: Record<string, unknown>;
}

export interface Variant {
  id: string;
  pageKey: string;
  name: string;
  isDefault: boolean;
  autoApply: boolean;
  content: VariantContent;
  modifiedAt?: string;
}

export interface VariantStore {
  /**
   * Whether the current user may save views (default true). When false, the view menu only selects views:
   * no Save, Save As or Manage. A host derives it from its permissions.
   */
  readonly canSave?: boolean;
  list(pageKey: string): Promise<Variant[]>;
  /** Creates (when `id` is empty) or updates a variant. */
  save(v: Variant): Promise<Variant>;
  remove(id: string): Promise<void>;
}

/** Id of the built-in "Standard" variant, which is never stored. */
export const STANDARD_VARIANT_ID = '';

export class MemoryVariantStore implements VariantStore {
  private items: Variant[] = [];
  private seq = 0;
  async list(pageKey: string): Promise<Variant[]> {
    return this.items.filter((v) => v.pageKey === pageKey).map((v) => structuredClone(v));
  }
  async save(v: Variant): Promise<Variant> {
    const saved = { ...structuredClone(v), id: v.id || `memory-${++this.seq}`, modifiedAt: new Date().toISOString() };
    this.items = [...this.items.filter((x) => x.id !== saved.id), saved];
    return structuredClone(saved);
  }
  async remove(id: string): Promise<void> {
    this.items = this.items.filter((v) => v.id !== id);
  }
}

interface VariantRow {
  ID: string;
  PageKey: string;
  Name: string;
  IsDefault: boolean;
  AutoApply: boolean;
  Content: string;
  ModifiedAt?: string;
}

const fromRow = (r: VariantRow): Variant => ({
  id: r.ID,
  pageKey: r.PageKey,
  name: r.Name,
  isDefault: r.IsDefault,
  autoApply: r.AutoApply,
  content: (() => { try { return JSON.parse(r.Content) as VariantContent; } catch { return { filters: {} }; } })(),
  modifiedAt: r.ModifiedAt,
});

export interface ODataVariantStoreOptions {
  /** See {@link VariantStore.canSave}. */
  canSave?: boolean;
}

/** Stores variants in an OData entity set (default "Variants"). */
export class ODataVariantStore implements VariantStore {
  readonly canSave: boolean;
  constructor(private readonly provider: ODataV4Provider, private readonly entitySet = 'Variants', options: ODataVariantStoreOptions = {}) {
    this.canSave = options.canSave ?? true;
  }

  async list(pageKey: string): Promise<Variant[]> {
    const q = `$filter=${encodeURIComponent(`PageKey eq '${pageKey.replace(/'/g, "''")}'`)}&$orderby=Name`;
    const body = await this.provider.request<{ value: VariantRow[] }>('GET', `${this.entitySet}?${q}`);
    return (body?.value ?? []).map(fromRow);
  }

  async save(v: Variant): Promise<Variant> {
    const row = { PageKey: v.pageKey, Name: v.name, IsDefault: v.isDefault, AutoApply: v.autoApply, Content: JSON.stringify(v.content) };
    if (!v.id) {
      const created = await this.provider.request<VariantRow>('POST', this.entitySet, row, { Prefer: 'return=representation' });
      return fromRow(created!);
    }
    const updated = await this.provider.request<VariantRow>('PATCH', `${this.entitySet}(${v.id})`, row, { Prefer: 'return=representation' });
    return updated ? fromRow(updated) : { ...v };
  }

  async remove(id: string): Promise<void> {
    await this.provider.request('DELETE', `${this.entitySet}(${id})`);
  }
}
